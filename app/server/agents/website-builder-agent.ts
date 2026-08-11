import type {
  LandingData,
  LandingImageAsset,
  LandingSectionType,
} from "../../landing-data";
import {
  buildLandingManifest,
  getLandingSectionSnapshot,
} from "../../landing-manifest";
import {
  applyLandingOperations,
  LandingOperationValidationError,
  type LandingOperation,
} from "../../landing-operations";
import type {
  BuilderAgentResult,
  BuilderIntent,
  BuilderProgressReporter,
  PipelineResumeState,
} from "../../builder-generation";
import {
  landingBuilderSkill,
  parseLandingOperations,
  preserveInternalAssetUrls,
} from "../skills/landing-builder-skill";
import {
  landingUiDesignSkill,
  resolveRuntimeSkill,
} from "../skills/runtime-skills";
import {
  runAiChatTool,
  type AiChatProvider,
} from "../tools/ai-chat-tool";
import { createDemoBuilderPlan } from "./builder-plan";
import { runLandingCreationPipeline } from "./landing-creation-pipeline";
import { runPlanningAgent } from "./planning-agent";

import {
  buildSimpleActionOperations,
  describeSimpleAction,
} from "./simple-action-executor";
import {
  listLandingAssetUrls,
  listLandingTextTargets,
  resolveBuilderPlanTarget,
} from "./target-resolver";

type WebsiteBuilderAgentInput = {
  prompt: string;
  current: LandingData;
  selectedSection?: LandingSectionType | null;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  availableAssets?: LandingImageAsset[];
  providerUrl: string;
  modelName: string;
  apiKey?: string;
  fallbackProviders?: AiChatProvider[];
  resume?: PipelineResumeState;
  createDemoLanding: (prompt: string, current: LandingData) => LandingData;
  progress?: BuilderProgressReporter;
};

export type WebsiteBuilderAgentResult = BuilderAgentResult;

function operationSection(operation: LandingOperation) {
  if ("section" in operation) return operation.section;
  if (operation.type === "assign_image") {
    if (operation.target === "hero") return "hero";
    if (operation.target.startsWith("portfolio:")) return "portfolio";
    return "gallery";
  }
  return null;
}

function assertSurgicalScope(
  operations: LandingOperation[],
  intent: BuilderIntent
) {
  if (intent.targetField) {
    const invalid = operations.filter(
      (operation) =>
        operation.type !== "update_text" ||
        operation.section !== intent.targetSections[0] ||
        operation.field !== intent.targetField
    );
    if (invalid.length) {
      throw new LandingOperationValidationError([
        `Yêu cầu này chỉ được sửa trường ${intent.targetField} trong section ${intent.targetSections[0]}.`,
      ]);
    }
    return;
  }

  if (!intent.targetSections.length) return;
  const affectedSections = operations
    .map(operationSection)
    .filter(
      (section): section is LandingSectionType => section !== null
    );
  const unrelated = affectedSections.filter(
    (section) => !intent.targetSections.includes(section)
  );
  if (unrelated.length) {
    throw new LandingOperationValidationError([
      `Operation đã sửa section ngoài phạm vi: ${Array.from(
        new Set(unrelated)
      ).join(", ")}.`,
    ]);
  }
}

function validationErrors(error: unknown) {
  if (error instanceof LandingOperationValidationError) return error.errors;
  if (error instanceof Error) return [error.message];
  return ["Kết quả AI không hợp lệ."];
}

export async function runWebsiteBuilderAgent(
  input: WebsiteBuilderAgentInput
): Promise<WebsiteBuilderAgentResult> {
  input.progress?.({
    type: "status",
    stage: "understanding",
    message: "Đang phân tích yêu cầu và phạm vi cần thay đổi…",
  });
  const currentManifest = buildLandingManifest(input.current);
  const projectAssets = Array.from(
    new Map(
      (input.availableAssets || [])
        .filter((asset) => asset.url.trim())
        .map((asset) => [asset.url.trim(), { ...asset, url: asset.url.trim() }])
    ).values()
  );
  const availableAssets = projectAssets.length
    ? projectAssets.map((asset) => asset.url)
    : listLandingAssetUrls(input.current);
  let intent = input.apiKey
    ? await runPlanningAgent({
        prompt: input.prompt,
        manifest: currentManifest,
        textTargets: listLandingTextTargets(input.current),
        availableAssets,
        selectedSection: input.selectedSection,
        history: input.history,
        providerUrl: input.providerUrl,
        modelName: input.modelName,
        apiKey: input.apiKey,
        fallbackProviders: input.fallbackProviders,
      })
    : createDemoBuilderPlan(input.prompt);
  if (input.apiKey) {
    const resolution = resolveBuilderPlanTarget(intent, input.current, {
      selectedSection: input.selectedSection,
      prompt: input.prompt,
    });
    if (resolution.status === "clarify") {
      intent = {
        ...intent,
        mode: "clarify",
        action: "clarify",
        target: {},
        targetSections: [],
        targetField: undefined,
        clarificationQuestion: resolution.question,
      };
    } else {
      intent = resolution.plan;
    }
  }
  const activeLanding = input.current;
  const activeManifest = buildLandingManifest(activeLanding);
  const runtimeSkill =
    intent.mode === "create"
      ? landingUiDesignSkill
      : resolveRuntimeSkill(input.prompt);
  input.progress?.({
    type: "status",
    stage: "planning",
    message:
      intent.mode === "clarify"
        ? "Lumo cần thêm thông tin để xác định đúng phần cần sửa."
        : intent.targetSections.length
          ? `Đã xác định section: ${intent.targetSections.join(", ")}.`
          : intent.mode === "create"
            ? "Đang lập cấu trúc landing page mới…"
            : "Đang lập kế hoạch thay đổi tối thiểu…",
  });

  if (!input.apiKey) {
    input.progress?.({
      type: "status",
      stage: "generating",
      message: "Đang tạo nội dung bằng chế độ mẫu…",
    });
    const landing = input.createDemoLanding(input.prompt, activeLanding);
    input.progress?.({
      type: "validation",
      stage: "validating",
      valid: true,
      attempt: 1,
    });
    input.progress?.({
      type: "status",
      stage: "applying",
      message: "Đang áp dụng bản thiết kế mẫu…",
    });
    return {
      landing,
      message:
        "Mình đã áp dụng yêu cầu vào bản thiết kế. Bạn có thể tiếp tục mô tả ngành, màu sắc, tiêu đề hoặc CTA muốn thay đổi.",
      mode: "demo",
      operations: [{ type: "replace_landing", value: landing }],
      changedSections: landing.sectionOrder,
      intent,
      manifest: buildLandingManifest(landing),
      skill: {
        id: landingBuilderSkill.id,
        version: landingBuilderSkill.version,
      },
      runtimeSkill: runtimeSkill
        ? {
            id: runtimeSkill.id,
            version: runtimeSkill.version,
            name: runtimeSkill.name,
            description: runtimeSkill.description,
          }
        : undefined,
    };
  }

  if (intent.mode === "clarify") {
    return {
      landing: input.current,
      message:
        intent.clarificationQuestion ||
        "Bạn có thể mô tả rõ hơn phần cần chỉnh sửa không?",
      mode: "ai",
      operations: [],
      changedSections: [],
      intent,
      manifest: currentManifest,
      skill: {
        id: landingBuilderSkill.id,
        version: landingBuilderSkill.version,
      },
      runtimeSkill: runtimeSkill
        ? {
            id: runtimeSkill.id,
            version: runtimeSkill.version,
            name: runtimeSkill.name,
            description: runtimeSkill.description,
          }
        : undefined,
    };
  }

  const simpleOperations = buildSimpleActionOperations(intent);
  if (simpleOperations) {
    input.progress?.({
      type: "status",
      stage: "validating",
      message: "Đang kiểm tra action và đúng vị trí cần thay đổi…",
    });
    assertSurgicalScope(simpleOperations, intent);
    const applied = applyLandingOperations(
      input.current,
      simpleOperations
    );
    input.progress?.({
      type: "validation",
      stage: "validating",
      valid: true,
      attempt: 1,
    });
    input.progress?.({
      type: "status",
      stage: "applying",
      message: "Đang áp dụng thay đổi trực tiếp vào landing page…",
    });
    return {
      landing: applied.landing,
      message: describeSimpleAction(intent),
      mode: "ai",
      operations: simpleOperations,
      changedSections: applied.changedSections,
      intent,
      manifest: buildLandingManifest(applied.landing),
      skill: {
        id: landingBuilderSkill.id,
        version: landingBuilderSkill.version,
      },
      runtimeSkill: runtimeSkill
        ? {
            id: runtimeSkill.id,
            version: runtimeSkill.version,
            name: runtimeSkill.name,
            description: runtimeSkill.description,
          }
        : undefined,
    };
  }

  if (intent.mode === "create") {
    const created = await runLandingCreationPipeline({
      prompt: input.prompt,
      plan: intent,
      baseLanding: activeLanding,
      providerUrl: input.providerUrl,
      modelName: input.modelName,
      apiKey: input.apiKey,
      fallbackProviders: input.fallbackProviders,
      resume: input.resume,
      progress: input.progress,
    });
    const warningSuffix = created.warnings.length
      ? ` ${created.warnings.length} section dùng nội dung mẫu an toàn vì AI chưa trả đúng schema.`
      : "";
    return {
      landing: created.landing,
      message: `Mình đã tạo landing page bằng pipeline động và đạt ${created.qualityReport.overall}/100 điểm chất lượng.${warningSuffix}`,
      mode: "ai",
      operations: created.operations,
      changedSections: created.changedSections,
      intent,
      manifest: buildLandingManifest(created.landing),
      skill: {
        id: landingBuilderSkill.id,
        version: landingBuilderSkill.version,
      },
      runtimeSkill: runtimeSkill
        ? {
            id: runtimeSkill.id,
            version: runtimeSkill.version,
            name: runtimeSkill.name,
            description: runtimeSkill.description,
          }
        : undefined,
      project: created.project,
      qualityReport: created.qualityReport,
    };
  }

  const targetSnapshots = Object.fromEntries(
    intent.targetSections.map((section) => [
      section,
      getLandingSectionSnapshot(activeLanding, section),
    ])
  );
  const runtimeSkillContext = runtimeSkill
    ? [
        `Runtime skill: ${runtimeSkill.name}.`,
        `Mục tiêu: ${runtimeSkill.description}`,
        `Quy tắc bổ sung: ${runtimeSkill.rules.join(" ")}`,
      ].join("\n")
    : "";
  const systemPrompt = [
    landingBuilderSkill.instructions,
    runtimeSkillContext,
    "Ví dụ chỉnh headline: {\"operations\":[{\"type\":\"update_text\",\"section\":\"hero\",\"field\":\"headline\",\"value\":\"Tiêu đề mới\"}],\"explanation\":\"Đã đổi tiêu đề Hero.\"}",
    "Ví dụ ẩn bảng giá: {\"operations\":[{\"type\":\"hide_section\",\"section\":\"pricing\"}],\"explanation\":\"Đã ẩn bảng giá.\"}",
  ]
    .filter(Boolean)
    .join("\n\n");
  const userPrompt = [
    input.history?.length
      ? `Lịch sử hội thoại gần nhất:\n${input.history
          .map((turn) => `${turn.role}: ${turn.content}`)
          .join("\n")}`
      : "",
    `Intent:\n${JSON.stringify(intent)}`,
    `Section manifest:\n${JSON.stringify(activeManifest)}`,
    `Dữ liệu các section mục tiêu:\n${JSON.stringify(targetSnapshots)}`,
    `Tóm tắt landing hiện tại:\n${JSON.stringify({
      brand: activeLanding.brand,
      palette: activeLanding.palette,
      design: activeLanding.design,
      sectionOrder: activeLanding.sectionOrder,
      hiddenSections: activeLanding.hiddenSections,
      assets: [
        activeLanding.heroImage,
        ...activeLanding.gallery.map((item) => item.url),
        ...activeLanding.portfolio.map((item) => item.imageUrl),
      ].filter(Boolean),
    })}`,
    `Yêu cầu mới của người dùng:\n${input.prompt}`,
    !intent.targetSections.length && intent.mode === "edit"
      ? `Landing page hiện tại để xử lý yêu cầu toàn trang:\n${JSON.stringify(
          activeLanding
        )}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  let landing: LandingData | null = null;
  let operations: LandingOperation[] = [];
  let changedSections: LandingSectionType[] = [];
  let repairContext = "";
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    input.progress?.({
      type: "status",
      stage: "generating",
      message:
        attempt === 1
          ? "Đang tạo các thay đổi chính xác…"
          : "Đang tự sửa phản hồi chưa hợp lệ…",
    });
    const output = await runAiChatTool({
      providerUrl: input.providerUrl,
      apiKey: input.apiKey,
      modelName: input.modelName,
      fallbackProviders: input.fallbackProviders,
      jsonMode: true,
      systemPrompt:
        attempt === 1
          ? systemPrompt
          : [
              systemPrompt,
              "Phản hồi trước không hợp lệ. Chỉ sửa các lỗi được liệt kê và trả lại JSON operations hợp lệ.",
            ].join("\n\n"),
      userPrompt: [userPrompt, repairContext].filter(Boolean).join("\n\n"),
    });
    input.progress?.({
      type: "status",
      stage: "validating",
      message: "Đang kiểm tra schema, phạm vi và quy tắc dữ liệu…",
    });
    try {
      const parsed = parseLandingOperations(
        output,
        activeLanding,
        intent.mode
      );
      assertSurgicalScope(parsed.operations, intent);
      const applied = applyLandingOperations(
        activeLanding,
        parsed.operations
      );
      input.progress?.({
        type: "validation",
        stage: "validating",
        valid: true,
        attempt,
      });
      input.progress?.({
        type: "status",
        stage: "applying",
        message: `Đang áp dụng ${parsed.operations.length} thay đổi đã kiểm tra…`,
      });
      operations = parsed.operations;
      landing = applied.landing;
      changedSections = applied.changedSections;
      break;
    } catch (error) {
      lastError = error;
      const errors = validationErrors(error);
      input.progress?.({
        type: "validation",
        stage: "validating",
        valid: false,
        errors,
        attempt,
      });
      repairContext = [
        `Phản hồi chưa hợp lệ:\n${output.slice(0, 8000)}`,
        `Các lỗi cần sửa:\n${errors.map((item) => `- ${item}`).join("\n")}`,
      ].join("\n\n");
    }
  }

  if (!landing) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Agent chưa tạo được thay đổi hợp lệ.");
  }

  landing = preserveInternalAssetUrls(activeLanding, landing);

  return {
    landing,
    message: `Mình đã áp dụng ${operations.length} thay đổi đúng phạm vi yêu cầu.`,
    mode: "ai",
    operations,
    changedSections,
    intent,
    manifest: buildLandingManifest(landing),
    skill: {
      id: landingBuilderSkill.id,
      version: landingBuilderSkill.version,
    },
    runtimeSkill: runtimeSkill
      ? {
          id: runtimeSkill.id,
          version: runtimeSkill.version,
          name: runtimeSkill.name,
          description: runtimeSkill.description,
        }
      : undefined,
  };
}

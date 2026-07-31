import type {
  LandingData,
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
} from "../../builder-generation";
import {
  applySectionVisibilityIntent,
  landingBuilderSkill,
  parseLandingOperations,
  preserveInternalAssetUrls,
} from "../skills/landing-builder-skill";
import { resolveRuntimeSkill } from "../skills/runtime-skills";
import { runAiChatTool } from "../tools/ai-chat-tool";
import { createDemoBuilderPlan } from "./builder-plan";
import { resolveLandingRecipe } from "./landing-recipes";
import { runPlanningAgent } from "./planning-agent";

type WebsiteBuilderAgentInput = {
  prompt: string;
  current: LandingData;
  selectedSection?: LandingSectionType | null;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  providerUrl: string;
  modelName: string;
  apiKey?: string;
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

function validateCreationQuality(
  landing: LandingData,
  recipe: { visibleSections: LandingSectionType[] }
) {
  const errors: string[] = [];
  const mainPromise = `${landing.headline} ${landing.accentLine}`.trim();
  const visibleSections = landing.sectionOrder.filter(
    (section) => !landing.hiddenSections.includes(section)
  );
  const expectedSections = recipe.visibleSections.filter(
    (section) => section !== "hero" && section !== "finalCta"
  );
  const missingExpected = expectedSections.filter(
    (section) => !visibleSections.includes(section)
  );

  if (mainPromise.length < 20) {
    errors.push("Thông điệp Hero quá ngắn để thể hiện giá trị chính.");
  }
  if (landing.description.trim().length < 45) {
    errors.push("Mô tả Hero chưa đủ rõ về lợi ích hoặc đối tượng.");
  }
  if (landing.primaryCta.trim().length < 3) {
    errors.push("Landing page chưa có CTA chính rõ ràng.");
  }
  if (visibleSections.length < 6) {
    errors.push("Landing page chưa đủ các phần cho hành trình chuyển đổi.");
  }
  if (
    expectedSections.length >= 4 &&
    missingExpected.length > Math.floor(expectedSections.length / 2)
  ) {
    errors.push(
      `Landing page đang thiếu quá nhiều section theo mục tiêu: ${missingExpected.join(
        ", "
      )}.`
    );
  }
  if (
    [mainPromise, landing.description, landing.primaryCta].some((value) =>
      /\b(lorem ipsum|placeholder|tiêu đề mẫu|nội dung mẫu)\b/i.test(value)
    )
  ) {
    errors.push("Landing page còn chứa nội dung mẫu.");
  }

  if (errors.length) {
    throw new LandingOperationValidationError(errors);
  }
}

function operationsFromVisibilityFallback(
  prompt: string,
  current: LandingData
) {
  const result = applySectionVisibilityIntent(prompt, current);
  const operations: LandingOperation[] = result.changedSections.map(
    (section) => ({
      type: result.landing.hiddenSections.includes(section)
        ? "hide_section"
        : "show_section",
      section,
    }) as LandingOperation
  );
  return { ...result, operations };
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
  const intent = input.apiKey
    ? await runPlanningAgent({
        prompt: input.prompt,
        manifest: currentManifest,
        selectedSection: input.selectedSection,
        history: input.history,
        providerUrl: input.providerUrl,
        modelName: input.modelName,
        apiKey: input.apiKey,
      })
    : createDemoBuilderPlan(input.prompt);
  const runtimeSkill = resolveRuntimeSkill(input.prompt);
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
    const landing = input.createDemoLanding(input.prompt, input.current);
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

  const targetSnapshots = Object.fromEntries(
    intent.targetSections.map((section) => [
      section,
      getLandingSectionSnapshot(input.current, section),
    ])
  );
  const runtimeSkillContext = runtimeSkill
    ? [
        `Runtime skill: ${runtimeSkill.name}.`,
        `Mục tiêu: ${runtimeSkill.description}`,
        `Quy tắc bổ sung: ${runtimeSkill.rules.join(" ")}`,
      ].join("\n")
    : "";
  const creationRecipe =
    intent.mode === "create" ? resolveLandingRecipe(intent) : null;
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
    creationRecipe
      ? `Recipe chuyển đổi bắt buộc tham khảo:\n${JSON.stringify(
          creationRecipe
        )}`
      : "",
    `Section manifest:\n${JSON.stringify(currentManifest)}`,
    `Dữ liệu các section mục tiêu:\n${JSON.stringify(targetSnapshots)}`,
    `Tóm tắt landing hiện tại:\n${JSON.stringify({
      brand: input.current.brand,
      palette: input.current.palette,
      sectionOrder: input.current.sectionOrder,
      hiddenSections: input.current.hiddenSections,
      assets: [
        input.current.heroImage,
        ...input.current.gallery.map((item) => item.url),
        ...input.current.portfolio.map((item) => item.imageUrl),
      ].filter(Boolean),
    })}`,
    intent.mode === "create"
      ? `LandingData mẫu bắt buộc giữ đúng cấu trúc khi dùng replace_landing:\n${JSON.stringify(
          input.current
        )}`
      : "",
    `Yêu cầu mới của người dùng:\n${input.prompt}`,
    !intent.targetSections.length && intent.mode === "edit"
      ? `Landing page hiện tại để xử lý yêu cầu toàn trang:\n${JSON.stringify(
          input.current
        )}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  let landing: LandingData | null = null;
  let operations: LandingOperation[] = [];
  let changedSections: LandingSectionType[] = [];
  let usedVisibilityFallback = false;
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
        input.current,
        intent.mode
      );
      assertSurgicalScope(parsed.operations, intent);
      const applied = applyLandingOperations(
        input.current,
        parsed.operations
      );
      if (creationRecipe) {
        validateCreationQuality(applied.landing, creationRecipe);
      }
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
    const deterministic = operationsFromVisibilityFallback(
      input.prompt,
      input.current
    );
    if (!deterministic.changedSections.length) throw lastError;
    input.progress?.({
      type: "status",
      stage: "applying",
      message: "Đang áp dụng thay đổi hiển thị bằng quy tắc an toàn…",
    });
    landing = deterministic.landing;
    operations = deterministic.operations;
    changedSections = deterministic.changedSections;
    usedVisibilityFallback = true;
  }

  landing = preserveInternalAssetUrls(input.current, landing);

  return {
    landing,
    message: usedVisibilityFallback
      ? "Mình đã cập nhật các phần hiển thị trên landing page theo yêu cầu."
      : `Mình đã áp dụng ${operations.length} thay đổi đúng phạm vi yêu cầu.`,
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

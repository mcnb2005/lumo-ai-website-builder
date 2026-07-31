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
import { analyzeBuilderIntent } from "./intent-analyzer";

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

function normalizeCommand(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .toLowerCase();
}

function isHeaderBrandRequest(prompt: string) {
  const normalized = normalizeCommand(prompt);
  return /\b(tren dau|phia tren|thanh tren|dau trang|header|logo|ten thuong hieu)\b/.test(
    normalized
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPreviousInsertion(
  history: WebsiteBuilderAgentInput["history"]
) {
  const previousUserMessage = [...(history || [])]
    .reverse()
    .find((turn) => turn.role === "user")?.content;
  if (!previousUserMessage) return null;

  const insertedText = previousUserMessage.match(
    /(?:thêm|chèn)\s+chữ\s+(.+?)\s+vào\s+giữa/i
  )?.[1]?.trim();
  const anchors = previousUserMessage.match(
    /(?:vào|ở)\s+giữa(?:\s+(?:phần|chữ))?\s+(.+?)\s+và\s+(.+?)(?:\s+(?:ở|phía|trên|đầu)\b|$)/i
  );
  if (!insertedText || !anchors?.[1] || !anchors[2]) return null;

  return {
    insertedText,
    firstAnchor: anchors[1].trim(),
    secondAnchor: anchors[2].trim(),
  };
}

function insertBetweenBrandAnchors(
  brand: string,
  insertedText: string,
  firstAnchor: string,
  secondAnchor: string
) {
  if (normalizeCommand(brand).includes(normalizeCommand(insertedText))) {
    return brand;
  }

  const lowerBrand = brand.toLocaleLowerCase("vi");
  const firstIndex = lowerBrand.indexOf(firstAnchor.toLocaleLowerCase("vi"));
  const secondIndex = lowerBrand.indexOf(secondAnchor.toLocaleLowerCase("vi"));
  if (firstIndex < 0 || secondIndex < 0) return brand;

  const earlier =
    firstIndex < secondIndex
      ? { index: firstIndex, length: firstAnchor.length }
      : { index: secondIndex, length: secondAnchor.length };
  const laterIndex = firstIndex < secondIndex ? secondIndex : firstIndex;
  return [
    brand.slice(0, earlier.index + earlier.length).trimEnd(),
    insertedText,
    brand.slice(laterIndex).trimStart(),
  ]
    .filter(Boolean)
    .join(" ");
}

function removeMistakenInsertion(value: string, insertedText: string) {
  return value
    .replace(new RegExp(escapeRegExp(insertedText), "i"), "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:;–—-]+|[\s,.:;–—-]+$/g, "")
    .trim();
}

function keepOnlyRequestedScope(
  prompt: string,
  current: LandingData,
  next: LandingData,
  history: WebsiteBuilderAgentInput["history"]
) {
  if (!isHeaderBrandRequest(prompt)) {
    return { landing: next, scope: null as "brand" | null };
  }

  const previousInsertion = extractPreviousInsertion(history);
  const isCorrection =
    /\b(nham|y toi|khong phai|sai cho)\b/.test(normalizeCommand(prompt));
  const generatedBrand =
    typeof next.brand === "string" && next.brand.trim()
      ? next.brand
      : current.brand;
  const brand =
    previousInsertion &&
    !normalizeCommand(generatedBrand).includes(
      normalizeCommand(previousInsertion.insertedText)
    )
      ? insertBetweenBrandAnchors(
          current.brand,
          previousInsertion.insertedText,
          previousInsertion.firstAnchor,
          previousInsertion.secondAnchor
        )
      : generatedBrand;

  return {
    landing: {
      ...current,
      brand,
      headline:
        previousInsertion && isCorrection
          ? removeMistakenInsertion(
              current.headline,
              previousInsertion.insertedText
            )
          : current.headline,
      accentLine:
        previousInsertion && isCorrection
          ? removeMistakenInsertion(
              current.accentLine,
              previousInsertion.insertedText
            )
          : current.accentLine,
    },
    scope: "brand" as const,
  };
}

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
  prompt: string,
  operations: LandingOperation[],
  targetSections: LandingSectionType[]
) {
  if (isHeaderBrandRequest(prompt)) {
    const invalid = operations.filter(
      (operation) =>
        operation.type !== "update_text" ||
        operation.section !== "hero" ||
        operation.field !== "brand"
    );
    if (invalid.length) {
      throw new LandingOperationValidationError([
        "Yêu cầu này chỉ được sửa trường brand trên thanh đầu trang.",
      ]);
    }
    return;
  }

  if (!targetSections.length) return;
  const affectedSections = operations
    .map(operationSection)
    .filter(
      (section): section is LandingSectionType => section !== null
    );
  const unrelated = affectedSections.filter(
    (section) => !targetSections.includes(section)
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
  const intent = analyzeBuilderIntent({
    prompt: input.prompt,
    manifest: currentManifest,
    selectedSection: input.selectedSection,
    history: input.history,
  });
  const runtimeSkill = resolveRuntimeSkill(input.prompt);
  input.progress?.({
    type: "status",
    stage: "planning",
    message: intent.targetSections.length
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
      assertSurgicalScope(
        input.prompt,
        parsed.operations,
        intent.targetSections
      );
      const applied = applyLandingOperations(
        input.current,
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

  const scopedResult = keepOnlyRequestedScope(
    input.prompt,
    input.current,
    landing,
    input.history
  );
  landing = preserveInternalAssetUrls(
    input.current,
    scopedResult.landing
  );

  return {
    landing,
    message:
      scopedResult.scope === "brand"
        ? "Mình đã cập nhật tên thương hiệu trên thanh đầu trang và giữ nguyên nội dung Hero."
        : usedVisibilityFallback
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

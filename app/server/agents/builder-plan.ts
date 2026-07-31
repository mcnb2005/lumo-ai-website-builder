import type {
  LandingEditableField,
  LandingManifest,
} from "../../landing-manifest";
import type { LandingSectionType } from "../../landing-data";

export const pagePurposes = [
  "sell_product",
  "service",
  "lead_generation",
  "course",
  "event",
  "portfolio",
  "launch",
  "promotion",
  "booking",
  "general",
] as const;

export type PagePurpose = (typeof pagePurposes)[number];

export type BuilderPlan = {
  mode: "create" | "edit" | "clarify";
  summary: string;
  confidence: number;
  targetSections: LandingSectionType[];
  targetField?: LandingEditableField;
  pagePurpose: PagePurpose;
  businessType: string;
  audience: string;
  primaryGoal: string;
  tone: string;
  recommendedSections: LandingSectionType[];
  clarificationQuestion?: string;
  source: "ai" | "demo";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asText(value: unknown, fallback = "", maxLength = 500) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI Planner không trả về JSON hợp lệ.");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

export function parseBuilderPlan(
  text: string,
  manifest: LandingManifest
): BuilderPlan {
  const value = extractJson(text);
  if (!isRecord(value)) {
    throw new Error("BuilderPlan phải là một object.");
  }

  const rawMode = value.mode;
  if (
    rawMode !== "create" &&
    rawMode !== "edit" &&
    rawMode !== "clarify"
  ) {
    throw new Error("BuilderPlan.mode không hợp lệ.");
  }

  const confidence =
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1
      ? value.confidence
      : 0;
  const availableSections = new Set(
    manifest.sections.map((section) => section.type)
  );
  const rawTargets = Array.isArray(value.targetSections)
    ? value.targetSections
    : [];
  const unknownTargets = rawTargets.filter(
    (section) =>
      typeof section !== "string" ||
      !availableSections.has(section as LandingSectionType)
  );
  if (unknownTargets.length) {
    throw new Error("BuilderPlan chứa section không tồn tại.");
  }
  const targetSections = Array.from(
    new Set(rawTargets as LandingSectionType[])
  );

  const purpose = pagePurposes.includes(value.pagePurpose as PagePurpose)
    ? (value.pagePurpose as PagePurpose)
    : "general";
  const rawRecommended = Array.isArray(value.recommendedSections)
    ? value.recommendedSections
    : [];
  const recommendedSections = Array.from(
    new Set(
      rawRecommended.filter(
        (section): section is LandingSectionType =>
          typeof section === "string" &&
          availableSections.has(section as LandingSectionType)
      )
    )
  );
  const targetField = asText(value.targetField) as
    | LandingEditableField
    | "";

  if (targetField) {
    if (rawMode !== "edit" || targetSections.length !== 1) {
      throw new Error(
        "targetField chỉ dùng khi chỉnh sửa đúng một section."
      );
    }
    const section = manifest.sections.find(
      (item) => item.type === targetSections[0]
    );
    if (!section?.editableFields.includes(targetField)) {
      throw new Error("targetField không thuộc section mục tiêu.");
    }
  }

  const lowConfidence = confidence < 0.6;
  const mode = lowConfidence ? "clarify" : rawMode;
  const clarificationQuestion =
    mode === "clarify"
      ? asText(
          value.clarificationQuestion,
          "Bạn có thể nói rõ phần nào của landing page cần thay đổi không?"
        )
      : undefined;

  return {
    mode,
    summary: asText(
      value.summary,
      mode === "create"
        ? "Tạo landing page mới."
        : mode === "edit"
          ? "Chỉnh sửa landing page hiện tại."
          : "Cần làm rõ yêu cầu."
    ),
    confidence,
    targetSections: mode === "create" ? [] : targetSections,
    targetField: targetField || undefined,
    pagePurpose: purpose,
    businessType: asText(value.businessType, "Doanh nghiệp"),
    audience: asText(value.audience, "Khách hàng mục tiêu"),
    primaryGoal: asText(value.primaryGoal, "Thực hiện CTA chính"),
    tone: asText(value.tone, "Rõ ràng, đáng tin cậy"),
    recommendedSections,
    clarificationQuestion,
    source: "ai",
  };
}

export function createDemoBuilderPlan(prompt: string): BuilderPlan {
  return {
    mode: "create",
    summary: `Tạo landing page mẫu theo yêu cầu: ${prompt.slice(0, 180)}`,
    confidence: 1,
    targetSections: [],
    pagePurpose: "general",
    businessType: "Doanh nghiệp",
    audience: "Khách hàng mục tiêu",
    primaryGoal: "Liên hệ hoặc đăng ký",
    tone: "Rõ ràng, đáng tin cậy",
    recommendedSections: [],
    source: "demo",
  };
}

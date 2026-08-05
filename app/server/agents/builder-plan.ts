import type {
  LandingEditableField,
  LandingManifest,
} from "../../landing-manifest";
import type {
  LandingImageTarget,
  LandingSectionType,
} from "../../landing-data";
import { extractAiJson } from "../tools/ai-json";

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

export const builderActions = [
  "create_landing",
  "generate_content",
  "update_text",
  "replace_section",
  "hide_section",
  "show_section",
  "move_section",
  "add_section",
  "assign_image",
  "set_palette",
  "clarify",
] as const;

export type BuilderAction = (typeof builderActions)[number];

export type BuilderTarget = {
  section?: LandingSectionType;
  field?: LandingEditableField;
  index?: number;
  nestedIndex?: number;
  imageTarget?: LandingImageTarget;
  paletteToken?: "ink" | "paper" | "accent" | "soft" | "line";
};

export type BuilderPlan = {
  mode: "create" | "edit" | "clarify";
  action: BuilderAction;
  target: BuilderTarget;
  value?: string;
  matchText?: string;
  toIndex?: number;
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

function asIndex(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

function isImageTarget(value: unknown): value is LandingImageTarget {
  return (
    value === "hero" ||
    value === "gallery:add" ||
    (typeof value === "string" &&
      /^(?:gallery|portfolio):\d+$/.test(value))
  );
}

export function parseBuilderPlan(
  text: string,
  manifest: LandingManifest
): BuilderPlan {
  const value = extractAiJson(text, "AI Planner không trả về JSON hợp lệ.");
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

  if (!builderActions.includes(value.action as BuilderAction)) {
    throw new Error("BuilderPlan.action không hợp lệ.");
  }
  const rawAction = value.action as BuilderAction;

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

  const rawTarget = isRecord(value.target) ? value.target : {};
  const rawSection = asText(rawTarget.section) as LandingSectionType | "";
  if (rawSection && !availableSections.has(rawSection)) {
    throw new Error("BuilderPlan.target.section không tồn tại.");
  }
  const rawField = asText(rawTarget.field) as LandingEditableField | "";
  if (rawField) {
    if (!rawSection) {
      throw new Error("BuilderPlan.target.field cần target.section.");
    }
    const section = manifest.sections.find(
      (item) => item.type === rawSection
    );
    if (!section?.editableFields.includes(rawField)) {
      throw new Error("BuilderPlan.target.field không thuộc section mục tiêu.");
    }
  }

  const imageTarget = isImageTarget(rawTarget.imageTarget)
    ? rawTarget.imageTarget
    : undefined;
  const paletteToken =
    rawTarget.paletteToken === "ink" ||
    rawTarget.paletteToken === "paper" ||
    rawTarget.paletteToken === "accent" ||
    rawTarget.paletteToken === "soft" ||
    rawTarget.paletteToken === "line"
      ? rawTarget.paletteToken
      : undefined;
  const target: BuilderTarget = {
    section: rawSection || undefined,
    field: rawField || undefined,
    index: asIndex(rawTarget.index),
    nestedIndex: asIndex(rawTarget.nestedIndex),
    imageTarget,
    paletteToken,
  };

  if (
    (rawAction === "hide_section" ||
      rawAction === "show_section" ||
      rawAction === "move_section" ||
      rawAction === "add_section" ||
      rawAction === "replace_section") &&
    !target.section
  ) {
    throw new Error(`BuilderPlan.action ${rawAction} cần target.section.`);
  }
  if (rawAction === "hide_section" && target.section === "finalCta") {
    throw new Error("finalCta không thể bị ẩn.");
  }
  if (rawAction === "move_section" && asIndex(value.toIndex) === undefined) {
    throw new Error("BuilderPlan.move_section cần toIndex.");
  }
  if (rawAction === "assign_image" && !target.imageTarget) {
    throw new Error("BuilderPlan.assign_image cần target.imageTarget.");
  }
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

  const lowConfidence = confidence < 0.6;
  const mode = lowConfidence ? "clarify" : rawMode;
  const action: BuilderAction =
    mode === "clarify" ? "clarify" : rawAction;
  const clarificationQuestion =
    mode === "clarify"
      ? asText(
          value.clarificationQuestion,
          "Bạn có thể nói rõ phần nào của landing page cần thay đổi không?"
        )
      : undefined;
  const targetSections =
    mode === "create" || !target.section ? [] : [target.section];

  return {
    mode,
    action,
    target,
    value: asText(value.value) || undefined,
    matchText: asText(value.matchText) || undefined,
    toIndex: asIndex(value.toIndex),
    summary: asText(
      value.summary,
      mode === "create"
        ? "Tạo landing page mới."
        : mode === "edit"
          ? "Chỉnh sửa landing page hiện tại."
          : "Cần làm rõ yêu cầu."
    ),
    confidence,
    targetSections,
    targetField: target.field,
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
    action: "create_landing",
    target: {},
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

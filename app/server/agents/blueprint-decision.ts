import {
  landingSectionTypes,
  landingSectionVariantOptions,
  type LandingData,
  type LandingSectionType,
} from "../../landing-data";
import type {
  BuilderPlan,
  CreativeFreedom,
  VisualDirection,
} from "./builder-plan";

export const templateFitLevels = ["strong", "partial", "weak"] as const;
export type TemplateFit = (typeof templateFitLevels)[number];

export type BlueprintDecision = {
  creativeFreedom: CreativeFreedom;
  templateFit: TemplateFit;
  deviationReason: string;
  sections: LandingSectionType[];
  sectionVariants: Partial<Record<LandingSectionType, string>>;
  typography: NonNullable<LandingData["design"]>["typography"];
  density: NonNullable<LandingData["design"]>["density"];
  radius: NonNullable<LandingData["design"]>["radius"];
  palette: LandingData["palette"];
  visualDirection: VisualDirection;
};

const hexColorPattern = /^#[0-9a-f]{6}$/i;
const blueprintSections = new Set<LandingSectionType>(
  landingSectionTypes.filter((section) => section !== "customBlock")
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, maxLength = 1_000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} phải là chuỗi không rỗng.`);
  }
  return value.trim().slice(0, maxLength);
}

export function normalizeBlueprintSectionAlias(
  value: unknown
): LandingSectionType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const alias = normalized.toLocaleLowerCase("en");
  if (alias === "demo" || alias === "product-demo" || alias === "visual-demo") {
    return "gallery";
  }
  if (alias === "case-study-demo" || alias === "work-demo") {
    return "portfolio";
  }
  return blueprintSections.has(normalized as LandingSectionType)
    ? (normalized as LandingSectionType)
    : null;
}

export function normalizeBlueprintVariantAlias(
  section: LandingSectionType,
  value: unknown
) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase("en");
  if (
    section === "hero" &&
    (normalized === "full-bleed" || normalized === "full-screen")
  ) {
    return "image-background";
  }
  if (
    section === "hero" &&
    (normalized === "demo" || normalized === "product-demo")
  ) {
    return "product-showcase";
  }
  return landingSectionVariantOptions[section].includes(normalized)
    ? normalized
    : null;
}

function parseVisualDirection(value: unknown): VisualDirection {
  if (!isRecord(value)) {
    throw new Error("BlueprintDecision.visualDirection phải là object.");
  }
  const mood = Array.isArray(value.mood)
    ? value.mood
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const density = value.density;
  const radius = value.radius;
  const contrast = value.contrast;
  if (!mood.length) {
    throw new Error("BlueprintDecision.visualDirection.mood không hợp lệ.");
  }
  if (density !== "compact" && density !== "balanced" && density !== "airy") {
    throw new Error("BlueprintDecision.visualDirection.density không hợp lệ.");
  }
  if (
    radius !== "none" &&
    radius !== "small" &&
    radius !== "medium" &&
    radius !== "large"
  ) {
    throw new Error("BlueprintDecision.visualDirection.radius không hợp lệ.");
  }
  if (contrast !== "soft" && contrast !== "balanced" && contrast !== "high") {
    throw new Error("BlueprintDecision.visualDirection.contrast không hợp lệ.");
  }
  return {
    mood,
    typography: requiredText(
      value.typography,
      "BlueprintDecision.visualDirection.typography",
      300
    ),
    density,
    imageStyle: requiredText(
      value.imageStyle,
      "BlueprintDecision.visualDirection.imageStyle",
      300
    ),
    radius,
    contrast,
  };
}

export function parseBlueprintDecision(
  value: unknown,
  expectedFreedom?: CreativeFreedom
): BlueprintDecision {
  if (!isRecord(value)) {
    throw new Error("BlueprintDecision phải là object.");
  }
  const creativeFreedom = value.creativeFreedom;
  if (
    creativeFreedom !== "low" &&
    creativeFreedom !== "medium" &&
    creativeFreedom !== "high"
  ) {
    throw new Error("BlueprintDecision.creativeFreedom không hợp lệ.");
  }
  if (expectedFreedom && creativeFreedom !== expectedFreedom) {
    throw new Error(
      `BlueprintDecision.creativeFreedom phải giữ mức ${expectedFreedom}.`
    );
  }
  if (!templateFitLevels.includes(value.templateFit as TemplateFit)) {
    throw new Error("BlueprintDecision.templateFit không hợp lệ.");
  }
  if (!Array.isArray(value.sections)) {
    throw new Error("BlueprintDecision.sections phải là mảng.");
  }
  const sections = value.sections.map((section) => {
    const normalized = normalizeBlueprintSectionAlias(section);
    if (!normalized) {
      throw new Error(`BlueprintDecision chứa section không hợp lệ: ${String(section)}`);
    }
    return normalized;
  });
  if (new Set(sections).size !== sections.length) {
    throw new Error("BlueprintDecision.sections không được trùng lặp.");
  }
  if (sections[0] !== "hero" || sections.at(-1) !== "finalCta") {
    throw new Error("BlueprintDecision phải đặt hero đầu và finalCta cuối.");
  }

  if (!isRecord(value.sectionVariants)) {
    throw new Error("BlueprintDecision.sectionVariants phải là object.");
  }
  const sectionVariants: Partial<Record<LandingSectionType, string>> = {};
  Object.entries(value.sectionVariants).forEach(([rawSection, rawVariant]) => {
    const section = normalizeBlueprintSectionAlias(rawSection);
    if (!section || !sections.includes(section)) {
      throw new Error(
        `BlueprintDecision.sectionVariants chứa section không được chọn: ${rawSection}`
      );
    }
    const variant = normalizeBlueprintVariantAlias(section, rawVariant);
    if (!variant) {
      throw new Error(
        `BlueprintDecision.sectionVariants.${section} không hợp lệ.`
      );
    }
    sectionVariants[section] = variant;
  });
  sections.forEach((section) => {
    if (!sectionVariants[section]) {
      throw new Error(
        `BlueprintDecision.sectionVariants thiếu variant cho ${section}.`
      );
    }
  });

  if (!isRecord(value.typography)) {
    throw new Error("BlueprintDecision.typography phải là object.");
  }
  const heading = value.typography.heading;
  const body = value.typography.body;
  if (heading !== "editorial" && heading !== "modern" && heading !== "friendly") {
    throw new Error("BlueprintDecision.typography.heading không hợp lệ.");
  }
  if (body !== "sans" && body !== "humanist") {
    throw new Error("BlueprintDecision.typography.body không hợp lệ.");
  }

  const density = value.density;
  if (
    density !== "compact" &&
    density !== "comfortable" &&
    density !== "spacious"
  ) {
    throw new Error("BlueprintDecision.density không hợp lệ.");
  }
  const radius = value.radius;
  if (
    radius !== "none" &&
    radius !== "sm" &&
    radius !== "md" &&
    radius !== "lg" &&
    radius !== "full"
  ) {
    throw new Error("BlueprintDecision.radius không hợp lệ.");
  }

  if (!isRecord(value.palette)) {
    throw new Error("BlueprintDecision.palette phải là object.");
  }
  const rawPalette = value.palette;
  const paletteTokens = ["ink", "paper", "accent", "soft", "line"] as const;
  const palette = Object.fromEntries(
    paletteTokens.map((token) => {
      const color = rawPalette[token];
      if (typeof color !== "string" || !hexColorPattern.test(color)) {
        throw new Error(`BlueprintDecision.palette.${token} không hợp lệ.`);
      }
      return [token, color];
    })
  ) as LandingData["palette"];

  return {
    creativeFreedom,
    templateFit: value.templateFit as TemplateFit,
    deviationReason: requiredText(
      value.deviationReason,
      "BlueprintDecision.deviationReason"
    ),
    sections,
    sectionVariants,
    typography: { heading, body },
    density,
    radius,
    palette,
    visualDirection: parseVisualDirection(value.visualDirection),
  };
}

function fallbackVariant(
  section: LandingSectionType,
  plan: BuilderPlan,
  templateLanding: LandingData
) {
  return (
    normalizeBlueprintVariantAlias(section, plan.sectionVariants?.[section]) ||
    normalizeBlueprintVariantAlias(
      section,
      templateLanding.design?.sectionVariants[section]
    ) ||
    landingSectionVariantOptions[section][0]
  );
}

export function createTemplateBaselineDecision(input: {
  plan: BuilderPlan;
  templateLanding: LandingData;
}): BlueprintDecision {
  const middleSections = input.templateLanding.sectionOrder.filter(
    (section) =>
      section !== "hero" &&
      section !== "finalCta" &&
      section !== "customBlock" &&
      !input.templateLanding.hiddenSections.includes(section)
  );
  const sections: LandingSectionType[] = [
    "hero",
    ...Array.from(new Set(middleSections)),
    "finalCta",
  ];
  const design = input.templateLanding.design!;
  return {
    creativeFreedom: input.plan.creativeFreedom,
    templateFit: "strong",
    deviationReason:
      "Blueprint Planner không trả về schema hợp lệ nên dùng template baseline an toàn.",
    sections,
    sectionVariants: Object.fromEntries(
      sections.map((section) => [
        section,
        fallbackVariant(section, input.plan, input.templateLanding),
      ])
    ),
    typography: input.plan.typography || design.typography,
    density: input.plan.density || design.density || "comfortable",
    radius: input.plan.radius || design.radius || "md",
    palette: structuredClone(input.templateLanding.palette),
    visualDirection: input.plan.visualDirection || {
      mood: [input.plan.tone],
      typography: input.plan.typography?.heading || design.typography.heading,
      density: "balanced",
      imageStyle: "Phù hợp với nội dung và không tự gán ảnh.",
      radius: "medium",
      contrast: "balanced",
    },
  };
}

import type { LandingData, LandingSectionType } from "../../landing-data";
import type { LandingEditableField } from "../../landing-manifest";
import type { BuilderPlan, BuilderTarget } from "./builder-plan";

export type LandingTextTarget = {
  section: LandingSectionType;
  field: LandingEditableField;
  value: string;
  index?: number;
  nestedIndex?: number;
};

export type TargetResolution =
  | { status: "resolved"; plan: BuilderPlan }
  | { status: "clarify"; question: string };

function textTarget(
  section: LandingSectionType,
  field: LandingEditableField,
  value: string,
  index?: number,
  nestedIndex?: number
): LandingTextTarget {
  return { section, field, value, index, nestedIndex };
}

export function listLandingTextTargets(
  landing: LandingData
): LandingTextTarget[] {
  return [
    textTarget("hero", "brand", landing.brand),
    textTarget("hero", "navCta", landing.navCta),
    textTarget("hero", "eyebrow", landing.eyebrow),
    textTarget("hero", "headline", landing.headline),
    textTarget("hero", "accentLine", landing.accentLine),
    textTarget("hero", "description", landing.description),
    textTarget("hero", "primaryCta", landing.primaryCta),
    textTarget("hero", "secondaryCta", landing.secondaryCta),
    textTarget("hero", "proof", landing.proof),
    ...landing.stats.flatMap((item, index) => [
      textTarget("stats", "stats.value", item.value, index),
      textTarget("stats", "stats.label", item.label, index),
    ]),
    ...landing.features.flatMap((item, index) => [
      textTarget("features", "features.number", item.number, index),
      textTarget("features", "features.title", item.title, index),
      textTarget("features", "features.text", item.text, index),
    ]),
    ...landing.pricing.flatMap((item, index) => [
      textTarget("pricing", "pricing.name", item.name, index),
      textTarget("pricing", "pricing.price", item.price, index),
      textTarget(
        "pricing",
        "pricing.description",
        item.description,
        index
      ),
      ...item.features.map((feature, nestedIndex) =>
        textTarget(
          "pricing",
          "pricing.feature",
          feature,
          index,
          nestedIndex
        )
      ),
      textTarget("pricing", "pricing.cta", item.cta, index),
    ]),
    ...landing.portfolio.flatMap((item, index) => [
      textTarget(
        "portfolio",
        "portfolio.category",
        item.category,
        index
      ),
      textTarget("portfolio", "portfolio.title", item.title, index),
      textTarget(
        "portfolio",
        "portfolio.description",
        item.description,
        index
      ),
    ]),
    ...landing.gallery.flatMap((item, index) => [
      textTarget("gallery", "gallery.alt", item.alt, index),
      textTarget("gallery", "gallery.caption", item.caption, index),
    ]),
    textTarget(
      "testimonial",
      "testimonial.quote",
      landing.testimonial.quote
    ),
    textTarget(
      "testimonial",
      "testimonial.name",
      landing.testimonial.name
    ),
    textTarget(
      "testimonial",
      "testimonial.role",
      landing.testimonial.role
    ),
    ...landing.faq.flatMap((item, index) => [
      textTarget("faq", "faq.question", item.question, index),
      textTarget("faq", "faq.answer", item.answer, index),
    ]),
    textTarget("leadForm", "leadForm.title", landing.leadForm.title),
    textTarget(
      "leadForm",
      "leadForm.description",
      landing.leadForm.description
    ),
    ...landing.leadForm.fields.map((field, index) =>
      textTarget("leadForm", "leadForm.field", field, index)
    ),
    textTarget(
      "leadForm",
      "leadForm.buttonText",
      landing.leadForm.buttonText
    ),
    textTarget("finalCta", "primaryCta", landing.primaryCta),
  ];
}

export function listLandingAssetUrls(landing: LandingData) {
  return Array.from(
    new Set(
      [
        landing.heroImage,
        ...landing.gallery.map((item) => item.url),
        ...landing.portfolio.map((item) => item.imageUrl),
      ].filter(Boolean)
    )
  );
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

function sameIndex(expected: number | undefined, actual: number | undefined) {
  return expected === undefined || expected === actual;
}

function targetLabel(target: LandingTextTarget) {
  const position =
    target.index === undefined
      ? ""
      : ` mục ${target.index + 1}${
          target.nestedIndex === undefined
            ? ""
            : `, dòng ${target.nestedIndex + 1}`
        }`;
  return `${target.section}.${target.field}${position}`;
}

function withResolvedTarget(
  plan: BuilderPlan,
  candidate: LandingTextTarget
): BuilderPlan {
  const target: BuilderTarget = {
    ...plan.target,
    section: candidate.section,
    field: candidate.field,
    index: candidate.index,
    nestedIndex: candidate.nestedIndex,
  };
  return {
    ...plan,
    target,
    targetSections: [candidate.section],
    targetField: candidate.field,
  };
}

export function resolveBuilderPlanTarget(
  plan: BuilderPlan,
  landing: LandingData
): TargetResolution {
  if (plan.mode !== "edit") return { status: "resolved", plan };

  if (
    plan.action === "hide_section" ||
    plan.action === "show_section" ||
    plan.action === "move_section" ||
    plan.action === "add_section" ||
    plan.action === "replace_section"
  ) {
    if (!plan.target.section) {
      return {
        status: "clarify",
        question: "Bạn muốn thao tác với section nào trên landing page?",
      };
    }
    return { status: "resolved", plan };
  }

  if (plan.action === "assign_image") {
    if (!plan.target.imageTarget) {
      return {
        status: "clarify",
        question: "Bạn muốn đặt ảnh vào Hero, thư viện hay dự án nào?",
      };
    }
    if (!plan.value || !listLandingAssetUrls(landing).includes(plan.value)) {
      return {
        status: "clarify",
        question:
          "Bạn hãy chọn một ảnh đã tải lên và nói rõ vị trí muốn đặt ảnh.",
      };
    }
    return { status: "resolved", plan };
  }

  if (plan.action !== "update_text") {
    return { status: "resolved", plan };
  }
  if (plan.value === undefined) {
    return {
      status: "clarify",
      question: "Bạn muốn thay nội dung đó thành câu nào?",
    };
  }

  const matchText = plan.matchText
    ? normalizeLookup(plan.matchText)
    : "";
  const candidates = listLandingTextTargets(landing).filter((candidate) => {
    if (
      plan.target.section &&
      candidate.section !== plan.target.section
    ) {
      return false;
    }
    if (plan.target.field && candidate.field !== plan.target.field) {
      return false;
    }
    if (!sameIndex(plan.target.index, candidate.index)) return false;
    if (!sameIndex(plan.target.nestedIndex, candidate.nestedIndex)) {
      return false;
    }
    if (
      matchText &&
      !normalizeLookup(candidate.value).includes(matchText)
    ) {
      return false;
    }
    return true;
  });

  if (candidates.length === 1) {
    return {
      status: "resolved",
      plan: withResolvedTarget(plan, candidates[0]),
    };
  }
  if (!candidates.length) {
    return {
      status: "clarify",
      question: plan.matchText
        ? `Không tìm thấy chữ “${plan.matchText}” ở vị trí bạn mô tả. Bạn muốn sửa phần nào?`
        : "Không tìm thấy đúng trường cần sửa. Bạn hãy chọn section hoặc nói rõ vị trí nội dung.",
    };
  }

  return {
    status: "clarify",
    question: `Có nhiều vị trí phù hợp (${candidates
      .slice(0, 3)
      .map(targetLabel)
      .join(", ")}). Bạn muốn sửa vị trí nào?`,
  };
}

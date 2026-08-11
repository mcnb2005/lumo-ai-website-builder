import type {
  LandingData,
  LandingImageAsset,
  LandingSectionType,
} from "../../landing-data";
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

type TargetResolutionContext = {
  selectedSection?: LandingSectionType | null;
  prompt?: string;
};

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
    textTarget("features", "featuresEyebrow", landing.featuresEyebrow),
    textTarget("features", "featuresHeadline", landing.featuresHeadline),
    textTarget("pricing", "pricingEyebrow", landing.pricingEyebrow),
    textTarget("pricing", "pricingHeadline", landing.pricingHeadline),
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
    textTarget("portfolio", "portfolioEyebrow", landing.portfolioEyebrow),
    textTarget("portfolio", "portfolioHeadline", landing.portfolioHeadline),
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
    textTarget("gallery", "galleryEyebrow", landing.galleryEyebrow),
    textTarget("gallery", "galleryHeadline", landing.galleryHeadline),
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
    textTarget("faq", "faqEyebrow", landing.faqEyebrow),
    textTarget("faq", "faqHeadline", landing.faqHeadline),
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
    textTarget("finalCta", "finalCtaEyebrow", landing.finalCtaEyebrow),
    textTarget("finalCta", "finalCtaHeadline", landing.finalCtaHeadline),
    textTarget("finalCta", "primaryCta", landing.primaryCta),
  ];
}

export function listLandingImageAssets(landing: LandingData) {
  const assets: LandingImageAsset[] = [
    ...(landing.heroImage
      ? [{ url: landing.heroImage, alt: landing.brand }]
      : []),
    ...landing.gallery
      .filter((item) => Boolean(item.url))
      .map((item) => ({ url: item.url, alt: item.alt })),
    ...landing.portfolio
      .filter((item) => Boolean(item.imageUrl))
      .map((item) => ({ url: item.imageUrl, alt: item.title })),
  ];
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.url)) return false;
    seen.add(asset.url);
    return true;
  });
}

export function listLandingAssetUrls(landing: LandingData) {
  return listLandingImageAssets(landing).map((asset) => asset.url);
}

function normalizeLookup(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

function withPaletteTarget(
  plan: BuilderPlan,
  paletteToken: NonNullable<BuilderTarget["paletteToken"]>,
  section?: LandingSectionType
): BuilderPlan {
  const resolvedSection = plan.target.section || section;
  return {
    ...plan,
    target: {
      ...plan.target,
      section: resolvedSection,
      paletteToken,
    },
    targetSections: resolvedSection ? [resolvedSection] : [],
  };
}

function resolvePaletteTarget(
  plan: BuilderPlan,
  context: TargetResolutionContext
): TargetResolution {
  if (plan.target.paletteToken) return { status: "resolved", plan };

  const request = normalizeLookup(`${context.prompt || ""} ${plan.summary}`);
  const selectedSection = plan.target.section || context.selectedSection || undefined;

  if (/\b(toan trang|nen trang|ca trang|landing page|website)\b/.test(request)) {
    return { status: "resolved", plan: withPaletteTarget(plan, "paper") };
  }
  if (/\b(mau chu|chu chinh|van ban)\b/.test(request)) {
    return { status: "resolved", plan: withPaletteTarget(plan, "ink") };
  }
  if (/\b(mau nhan|nut|cta|diem nhan)\b/.test(request)) {
    return { status: "resolved", plan: withPaletteTarget(plan, "accent") };
  }
  if (/\b(duong vien|vien|duong ke)\b/.test(request)) {
    return { status: "resolved", plan: withPaletteTarget(plan, "line") };
  }
  if (selectedSection && /\b(nen|phan nay|section|the|form)\b/.test(request)) {
    return {
      status: "resolved",
      plan: withPaletteTarget(plan, "soft", selectedSection),
    };
  }

  return {
    status: "clarify",
    question: selectedSection
      ? `Bạn muốn đổi nền toàn trang hay nền section ${selectedSection} đang chọn?`
      : "Bạn muốn đổi nền toàn trang, nền section, màu chữ, màu nhấn hay đường viền?",
  };
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
  landing: LandingData,
  context: TargetResolutionContext = {}
): TargetResolution {
  if (plan.mode !== "edit") return { status: "resolved", plan };

  if (plan.action === "set_palette") {
    return resolvePaletteTarget(plan, context);
  }

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

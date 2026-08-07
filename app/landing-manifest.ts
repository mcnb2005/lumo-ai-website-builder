import type { LandingData, LandingSectionType } from "./landing-data";

export type LandingEditableField =
  | "brand"
  | "navCta"
  | "eyebrow"
  | "headline"
  | "accentLine"
  | "description"
  | "primaryCta"
  | "secondaryCta"
  | "proof"
  | "featuresEyebrow"
  | "featuresHeadline"
  | "pricingEyebrow"
  | "pricingHeadline"
  | "portfolioEyebrow"
  | "portfolioHeadline"
  | "galleryEyebrow"
  | "galleryHeadline"
  | "faqEyebrow"
  | "faqHeadline"
  | "finalCtaEyebrow"
  | "finalCtaHeadline"
  | "stats.value"
  | "stats.label"
  | "features.number"
  | "features.title"
  | "features.text"
  | "pricing.name"
  | "pricing.price"
  | "pricing.description"
  | "pricing.feature"
  | "pricing.cta"
  | "portfolio.category"
  | "portfolio.title"
  | "portfolio.description"
  | "gallery.alt"
  | "gallery.caption"
  | "testimonial.quote"
  | "testimonial.name"
  | "testimonial.role"
  | "faq.question"
  | "faq.answer"
  | "leadForm.title"
  | "leadForm.description"
  | "leadForm.field"
  | "leadForm.buttonText";

export const editableFieldsBySection: Record<
  LandingSectionType,
  readonly LandingEditableField[]
> = {
  hero: [
    "brand",
    "navCta",
    "eyebrow",
    "headline",
    "accentLine",
    "description",
    "primaryCta",
    "secondaryCta",
    "proof",
  ],
  stats: ["stats.value", "stats.label"],
  features: [
    "featuresEyebrow",
    "featuresHeadline",
    "features.number",
    "features.title",
    "features.text",
  ],
  pricing: [
    "pricingEyebrow",
    "pricingHeadline",
    "pricing.name",
    "pricing.price",
    "pricing.description",
    "pricing.feature",
    "pricing.cta",
  ],
  portfolio: [
    "portfolioEyebrow",
    "portfolioHeadline",
    "portfolio.category",
    "portfolio.title",
    "portfolio.description",
  ],
  gallery: [
    "galleryEyebrow",
    "galleryHeadline",
    "gallery.alt",
    "gallery.caption",
  ],
  testimonial: [
    "testimonial.quote",
    "testimonial.name",
    "testimonial.role",
  ],
  faq: ["faqEyebrow", "faqHeadline", "faq.question", "faq.answer"],
  leadForm: [
    "leadForm.title",
    "leadForm.description",
    "leadForm.field",
    "leadForm.buttonText",
  ],
  customBlock: [],
  finalCta: ["finalCtaEyebrow", "finalCtaHeadline", "primaryCta"],
};

const sectionLabels: Record<LandingSectionType, string> = {
  hero: "Mở đầu",
  stats: "Số liệu nổi bật",
  features: "Lợi ích",
  pricing: "Bảng giá",
  portfolio: "Dự án",
  gallery: "Hình ảnh",
  testimonial: "Đánh giá",
  faq: "Câu hỏi thường gặp",
  leadForm: "Form đăng ký",
  customBlock: "Khối tùy chỉnh",
  finalCta: "Kêu gọi hành động",
};

export type LandingManifestItem = {
  id: LandingSectionType;
  type: LandingSectionType;
  title: string;
  visible: boolean;
  position: number;
  editableFields: readonly LandingEditableField[];
};

export type LandingManifest = {
  sections: LandingManifestItem[];
};

export function buildLandingManifest(landing: LandingData): LandingManifest {
  return {
    sections: landing.sectionOrder.map((section, position) => ({
      id: section,
      type: section,
      title: sectionLabels[section],
      visible: !landing.hiddenSections.includes(section),
      position,
      editableFields: editableFieldsBySection[section],
    })),
  };
}

export function getLandingSectionSnapshot(
  landing: LandingData,
  section: LandingSectionType
) {
  switch (section) {
    case "hero":
      return {
        brand: landing.brand,
        navCta: landing.navCta,
        eyebrow: landing.eyebrow,
        headline: landing.headline,
        accentLine: landing.accentLine,
        description: landing.description,
        primaryCta: landing.primaryCta,
        secondaryCta: landing.secondaryCta,
        proof: landing.proof,
        heroImage: landing.heroImage,
      };
    case "stats":
      return landing.stats;
    case "features":
      return {
        eyebrow: landing.featuresEyebrow,
        headline: landing.featuresHeadline,
        items: landing.features,
      };
    case "pricing":
      return {
        eyebrow: landing.pricingEyebrow,
        headline: landing.pricingHeadline,
        items: landing.pricing,
      };
    case "portfolio":
      return {
        eyebrow: landing.portfolioEyebrow,
        headline: landing.portfolioHeadline,
        items: landing.portfolio,
      };
    case "gallery":
      return {
        eyebrow: landing.galleryEyebrow,
        headline: landing.galleryHeadline,
        items: landing.gallery,
      };
    case "testimonial":
      return landing.testimonial;
    case "faq":
      return {
        eyebrow: landing.faqEyebrow,
        headline: landing.faqHeadline,
        items: landing.faq,
      };
    case "leadForm":
      return landing.leadForm;
    case "customBlock":
      return landing.customBlock;
    case "finalCta":
      return {
        eyebrow: landing.finalCtaEyebrow,
        headline: landing.finalCtaHeadline,
        primaryCta: landing.primaryCta,
      };
  }
}

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
  features: ["features.number", "features.title", "features.text"],
  pricing: [
    "pricing.name",
    "pricing.price",
    "pricing.description",
    "pricing.feature",
    "pricing.cta",
  ],
  portfolio: [
    "portfolio.category",
    "portfolio.title",
    "portfolio.description",
  ],
  gallery: ["gallery.alt", "gallery.caption"],
  testimonial: [
    "testimonial.quote",
    "testimonial.name",
    "testimonial.role",
  ],
  faq: ["faq.question", "faq.answer"],
  leadForm: [
    "leadForm.title",
    "leadForm.description",
    "leadForm.field",
    "leadForm.buttonText",
  ],
  finalCta: ["primaryCta"],
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
      return landing.features;
    case "pricing":
      return landing.pricing;
    case "portfolio":
      return landing.portfolio;
    case "gallery":
      return landing.gallery;
    case "testimonial":
      return landing.testimonial;
    case "faq":
      return landing.faq;
    case "leadForm":
      return landing.leadForm;
    case "finalCta":
      return { primaryCta: landing.primaryCta };
  }
}

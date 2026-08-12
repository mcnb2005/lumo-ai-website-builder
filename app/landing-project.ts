import {
  landingSectionTypes,
  normalizeLandingData,
  type LandingData,
  type LandingDesign,
  type LandingImageAsset,
  type LandingImagePresentation,
  type LandingSectionType,
} from "./landing-data";
import type { PagePurpose } from "./server/agents/builder-plan";
import type {
  CreativeFreedom,
  VisualDirection,
} from "./server/agents/builder-plan";
import type { TemplateFit } from "./server/agents/blueprint-decision";

export type BusinessBrief = {
  sourcePrompt: string;
  businessType: string;
  product: string;
  audience: string;
  conversionGoal: PagePurpose;
  tone: string;
  primaryCta: string;
};

export type LandingBlueprintSection = {
  id: string;
  type: LandingSectionType;
  variant: string;
  purpose: string;
  order: number;
};

export type LandingBlueprint = {
  templateId: string;
  creativeFreedom: CreativeFreedom;
  templateFit: TemplateFit;
  deviationReason: string;
  visualDirection: VisualDirection;
  sections: LandingBlueprintSection[];
};

export type LandingContent = Pick<
  LandingData,
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
  | "stats"
  | "features"
  | "pricing"
  | "testimonial"
  | "faq"
  | "leadForm"
> & {
  portfolio: Array<Pick<LandingData["portfolio"][number], "title" | "category" | "description">>;
  gallery: Array<Pick<LandingData["gallery"][number], "alt" | "caption">>;
};

export type LandingProjectDesign = {
  template: LandingDesign;
  palette: LandingData["palette"];
  sectionOrder: LandingSectionType[];
  hiddenSections: LandingSectionType[];
  sectionColors: LandingData["sectionColors"];
};

export type LandingAssetLibrary = {
  hero?: LandingImageAsset & LandingImagePresentation;
  portfolio: Array<(LandingImageAsset & LandingImagePresentation) | null>;
  gallery: Array<(LandingImageAsset & LandingImagePresentation) | null>;
};

export type LandingProject = {
  schemaVersion: 2;
  brief: BusinessBrief;
  blueprint: LandingBlueprint;
  content: LandingContent;
  design: LandingProjectDesign;
  assets: LandingAssetLibrary;
};

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as Partial<T>;
}

export function landingProjectFromLanding(
  landing: LandingData,
  brief: BusinessBrief,
  blueprint: LandingBlueprint
): LandingProject {
  const normalized = normalizeLandingData(landing);
  const {
    design,
    palette,
    sectionOrder,
    hiddenSections,
    sectionColors,
    heroImage,
    heroImageFit,
    heroImagePosition,
    portfolio,
    gallery,
    ...contentFields
  } = normalized;

  return {
    schemaVersion: 2,
    brief,
    blueprint,
    content: {
      ...contentFields,
      portfolio: portfolio.map(({ title, category, description }) => ({
        title,
        category,
        description,
      })),
      gallery: gallery.map(({ alt, caption }) => ({ alt, caption })),
    },
    design: {
      template: structuredClone(design!),
      palette: structuredClone(palette),
      sectionOrder: [...sectionOrder],
      hiddenSections: [...hiddenSections],
      sectionColors: structuredClone(sectionColors),
    },
    assets: {
      hero: heroImage
        ? {
            url: heroImage,
            alt: `Hình ảnh nổi bật của ${normalized.brand}`,
            ...withoutUndefined({
              imageFit: heroImageFit,
              imagePosition: heroImagePosition,
            }),
          }
        : undefined,
      portfolio: portfolio.map((item) =>
        item.imageUrl
          ? {
              url: item.imageUrl,
              alt: item.title,
              ...withoutUndefined({
                imageFit: item.imageFit,
                imagePosition: item.imagePosition,
              }),
            }
          : null
      ),
      gallery: gallery.map((item) =>
        item.url
          ? {
              url: item.url,
              alt: item.alt,
              ...withoutUndefined({
                imageFit: item.imageFit,
                imagePosition: item.imagePosition,
              }),
            }
          : null
      ),
    },
  };
}

export function compileLandingProject(project: LandingProject): LandingData {
  const portfolio = project.content.portfolio.map((item, index) => {
    const asset = project.assets.portfolio[index];
    return {
      ...item,
      imageUrl: asset?.url || "",
      ...(asset?.imageFit ? { imageFit: asset.imageFit } : {}),
      ...(asset?.imagePosition ? { imagePosition: asset.imagePosition } : {}),
    };
  });
  const gallery = project.content.gallery.map((item, index) => {
    const asset = project.assets.gallery[index];
    return {
      ...item,
      url: asset?.url || "",
      ...(asset?.imageFit ? { imageFit: asset.imageFit } : {}),
      ...(asset?.imagePosition ? { imagePosition: asset.imagePosition } : {}),
    };
  });

  return normalizeLandingData({
    ...project.content,
    design: structuredClone(project.design.template),
    palette: structuredClone(project.design.palette),
    sectionOrder: [...project.design.sectionOrder],
    hiddenSections: [...project.design.hiddenSections],
    sectionColors: structuredClone(project.design.sectionColors),
    heroImage: project.assets.hero?.url || "",
    heroImageFit: project.assets.hero?.imageFit,
    heroImagePosition: project.assets.hero?.imagePosition,
    portfolio,
    gallery,
  });
}

export function completeSectionOrder(visible: LandingSectionType[]) {
  return [
    ...visible,
    ...landingSectionTypes.filter((section) => !visible.includes(section)),
  ];
}

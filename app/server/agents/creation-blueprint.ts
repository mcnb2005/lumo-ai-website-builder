import {
  landingSectionVariantOptions,
  landingSectionTypes,
  type LandingData,
  type LandingSectionType,
} from "../../landing-data";
import {
  completeSectionOrder,
  type BusinessBrief,
  type LandingBlueprint,
} from "../../landing-project";
import type { BuilderPlan } from "./builder-plan";
import { resolveLandingRecipe } from "./landing-recipes";

const sectionPurposes: Record<string, string> = {
  hero: "Nêu giá trị chính, đối tượng và hành động ưu tiên.",
  stats: "Đưa ra bằng chứng định lượng ngắn gọn.",
  features: "Giải thích lợi ích và điểm khác biệt cốt lõi.",
  pricing: "Làm rõ lựa chọn, giá trị và bước mua hoặc đăng ký.",
  portfolio: "Chứng minh năng lực bằng dự án hoặc ví dụ thực tế.",
  gallery: "Tạo bằng chứng trực quan cho sản phẩm hoặc dịch vụ.",
  testimonial: "Tăng độ tin cậy bằng lời chứng thực cụ thể.",
  faq: "Giải quyết băn khoăn trước khi chuyển đổi.",
  leadForm: "Thu thập đúng thông tin cần thiết cho mục tiêu chuyển đổi.",
  finalCta: "Nhắc lại lợi ích và CTA chính ở cuối trang.",
  customBlock: "Khối nội dung tùy chỉnh do AI tạo bằng HTML.",
};

export function createBusinessBrief(
  plan: BuilderPlan,
  sourcePrompt: string
): BusinessBrief {
  return {
    sourcePrompt: sourcePrompt.trim().slice(0, 2_000),
    businessType: plan.businessType,
    product: plan.businessType,
    audience: plan.audience,
    conversionGoal: plan.pagePurpose,
    tone: plan.tone,
    primaryCta: plan.primaryGoal,
  };
}

function validVariant(section: LandingSectionType, candidate: string | undefined) {
  const options = landingSectionVariantOptions[section];
  return candidate && options.includes(candidate) ? candidate : options[0];
}

export function createLandingBlueprint(input: {
  plan: BuilderPlan;
  brief: BusinessBrief;
}): LandingBlueprint {
  const recipe = resolveLandingRecipe(input.plan);
  
  let middleSections: LandingSectionType[] = [];
  if (input.plan.recommendedSections && input.plan.recommendedSections.length > 0) {
    middleSections = input.plan.recommendedSections.filter((s: string) => s !== "hero" && s !== "finalCta") as LandingSectionType[];
  } else {
    middleSections = recipe.visibleSections.filter(
      (section) => section !== "hero" && section !== "finalCta"
    );
  }

  const visible = Array.from(
    new Set<LandingSectionType>([
      "hero",
      ...middleSections,
      "finalCta",
    ])
  );

  return {
    templateId: "dynamic",
    sections: visible.map((section, order) => {
      const preferred = input.plan.sectionVariants?.[section];
      const variant =
        section === "hero"
          ? validVariant(section, preferred || "centered")
          : validVariant(section, preferred);
      return {
        id: `${section}-main`,
        type: section,
        variant,
        purpose: sectionPurposes[section as string],
        order,
      };
    }),
  };
}

export function applyBlueprintToLanding(
  landing: LandingData,
  blueprint: LandingBlueprint
) {
  const visible = blueprint.sections.map((section) => section.type);
  const sectionVariants = Object.fromEntries(
    blueprint.sections.map((section) => [section.type, section.variant])
  );
  return {
    ...landing,
    design: {
      ...landing.design!,
      templateId: blueprint.templateId,
      sectionVariants: {
        ...landing.design?.sectionVariants,
        ...sectionVariants,
      },
    },
    sectionOrder: completeSectionOrder(visible),
    hiddenSections: landingSectionTypes.filter(
      (section) => !visible.includes(section) && section !== "finalCta"
    ),
  };
}

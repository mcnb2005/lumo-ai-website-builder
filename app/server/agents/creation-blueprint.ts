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
import type { TemplateSelection } from "../../templates/registry";
import type { BuilderPlan } from "./builder-plan";
import type { BlueprintDecision } from "./blueprint-decision";

const sectionPurposes: Record<LandingSectionType, string> = {
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
  customBlock: "Khối nội dung tùy chỉnh chỉ dùng qua thao tác chuyên biệt.",
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
  brief: BusinessBrief;
  templateSelection: TemplateSelection;
  decision: BlueprintDecision;
}): LandingBlueprint {
  return {
    templateId: input.templateSelection.id,
    creativeFreedom: input.decision.creativeFreedom,
    templateFit: input.decision.templateFit,
    deviationReason: input.decision.deviationReason,
    visualDirection: input.decision.visualDirection,
    sections: input.decision.sections.map((section, order) => ({
      id: `${section}-main`,
      type: section,
      variant: validVariant(section, input.decision.sectionVariants[section]),
      purpose:
        section === "hero" || section === "finalCta"
          ? `${sectionPurposes[section]} CTA chính: ${input.brief.primaryCta}`
          : sectionPurposes[section],
      order,
    })),
  };
}

export function createLandingBlueprintFromLanding(
  landing: LandingData
): LandingBlueprint {
  const visible = landing.sectionOrder.filter(
    (section) =>
      section !== "customBlock" && !landing.hiddenSections.includes(section)
  );
  return {
    templateId: landing.design?.templateId || "dynamic",
    creativeFreedom: "medium",
    templateFit: "partial",
    deviationReason: "Khôi phục Blueprint từ checkpoint đã được xác thực.",
    visualDirection: {
      mood: ["checkpoint"],
      typography: landing.design?.typography.heading || "modern",
      density: "balanced",
      imageStyle: "Giữ nguyên asset đã có trong checkpoint.",
      radius: "medium",
      contrast: "balanced",
    },
    sections: visible.map((section, order) => ({
      id: `${section}-main`,
      type: section,
      variant: validVariant(
        section,
        landing.design?.sectionVariants[section]
      ),
      purpose: sectionPurposes[section],
      order,
    })),
  };
}

export function applyBlueprintToLanding(
  landing: LandingData,
  blueprint: LandingBlueprint,
  decision: BlueprintDecision
) {
  const visible = blueprint.sections.map((section) => section.type);
  const sectionVariants = Object.fromEntries(
    blueprint.sections.map((section) => [section.type, section.variant])
  );
  return {
    ...landing,
    palette: structuredClone(decision.palette),
    design: {
      ...landing.design!,
      templateId: blueprint.templateId,
      sectionVariants: {
        ...landing.design?.sectionVariants,
        ...sectionVariants,
      },
      typography: decision.typography,
      density: decision.density,
      radius: decision.radius,
    },
    sectionOrder: completeSectionOrder(visible),
    hiddenSections: landingSectionTypes.filter(
      (section) => !visible.includes(section) && section !== "finalCta"
    ),
  };
}

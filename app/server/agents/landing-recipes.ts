import type { LandingSectionType } from "../../landing-data";
import type { BuilderPlan, PagePurpose } from "./builder-plan";

type LandingRecipe = {
  visibleSections: LandingSectionType[];
  guidance: string[];
};

const commonClosing: LandingSectionType[] = [
  "testimonial",
  "faq",
  "leadForm",
  "finalCta",
];

const recipes: Record<PagePurpose, LandingRecipe> = {
  sell_product: {
    visibleSections: [
      "hero",
      "stats",
      "features",
      "gallery",
      "pricing",
      ...commonClosing,
    ],
    guidance: [
      "Nêu rõ sản phẩm, lợi ích khác biệt và lý do tin tưởng ngay ở Hero.",
      "Giá hoặc gói mua phải rõ ràng và CTA hướng đến đặt mua hoặc nhận tư vấn.",
      "Dùng bằng chứng, đánh giá và FAQ để xử lý phản đối trước khi mua.",
    ],
  },
  service: {
    visibleSections: [
      "hero",
      "features",
      "portfolio",
      "pricing",
      ...commonClosing,
    ],
    guidance: [
      "Giải thích vấn đề khách hàng, kết quả dịch vụ và quy trình hợp tác.",
      "CTA hướng đến nhận báo giá, gọi điện hoặc đăng ký tư vấn.",
    ],
  },
  lead_generation: {
    visibleSections: [
      "hero",
      "stats",
      "features",
      "testimonial",
      "leadForm",
      "faq",
      "finalCta",
    ],
    guidance: [
      "Giữ một ưu đãi chính và giảm tối đa độ dài form.",
      "Nói rõ người dùng nhận được gì sau khi gửi thông tin.",
    ],
  },
  course: {
    visibleSections: [
      "hero",
      "stats",
      "features",
      "pricing",
      "testimonial",
      "faq",
      "leadForm",
      "finalCta",
    ],
    guidance: [
      "Nêu rõ khóa học dành cho ai, học được gì và kết quả sau khóa học.",
      "CTA hướng đến đăng ký hoặc nhận chương trình học.",
    ],
  },
  event: {
    visibleSections: [
      "hero",
      "stats",
      "features",
      "portfolio",
      "leadForm",
      "faq",
      "finalCta",
    ],
    guidance: [
      "Hero phải có tên, thời gian, địa điểm hoặc hình thức tham dự.",
      "Nêu diễn giả, nội dung chính và CTA đăng ký tham dự.",
    ],
  },
  portfolio: {
    visibleSections: [
      "hero",
      "stats",
      "portfolio",
      "gallery",
      "testimonial",
      "leadForm",
      "finalCta",
    ],
    guidance: [
      "Dùng dự án tiêu biểu để chứng minh năng lực.",
      "CTA hướng đến trao đổi dự án hoặc yêu cầu báo giá.",
    ],
  },
  launch: {
    visibleSections: [
      "hero",
      "features",
      "gallery",
      "stats",
      "leadForm",
      "faq",
      "finalCta",
    ],
    guidance: [
      "Tạo cảm giác sắp ra mắt nhưng không dùng thông tin khan hiếm giả.",
      "CTA hướng đến đăng ký nhận thông báo hoặc đặt trước.",
    ],
  },
  promotion: {
    visibleSections: [
      "hero",
      "features",
      "pricing",
      "testimonial",
      "faq",
      "leadForm",
      "finalCta",
    ],
    guidance: [
      "Nêu rõ ưu đãi, điều kiện và thời hạn.",
      "Giữ một CTA mua hoặc đăng ký ưu đãi xuyên suốt trang.",
    ],
  },
  booking: {
    visibleSections: [
      "hero",
      "features",
      "portfolio",
      "testimonial",
      "leadForm",
      "faq",
      "finalCta",
    ],
    guidance: [
      "Nêu rõ dịch vụ có thể đặt và thông tin cần để xác nhận.",
      "CTA hướng đến gửi yêu cầu đặt lịch hoặc liên hệ xác nhận.",
    ],
  },
  general: {
    visibleSections: [
      "hero",
      "stats",
      "features",
      "portfolio",
      "testimonial",
      "faq",
      "leadForm",
      "finalCta",
    ],
    guidance: [
      "Duy trì một thông điệp chính và một CTA chuyển đổi xuyên suốt trang.",
      "Sắp xếp nội dung theo lời hứa, bằng chứng, lợi ích, chi tiết và CTA.",
    ],
  },
};

export function resolveLandingRecipe(plan: BuilderPlan) {
  const base = recipes[plan.pagePurpose];
  const supplementalSections = plan.recommendedSections
    .filter(
      (section) =>
        section !== "hero" &&
        section !== "finalCta" &&
        !base.visibleSections.includes(section)
    )
    .slice(0, 2);
  const visibleSections = Array.from(
    new Set<LandingSectionType>([
      "hero",
      ...base.visibleSections,
      ...supplementalSections,
      "finalCta",
    ])
  );

  return {
    ...base,
    visibleSections,
    brief: {
      purpose: plan.pagePurpose,
      businessType: plan.businessType,
      audience: plan.audience,
      primaryGoal: plan.primaryGoal,
      tone: plan.tone,
    },
  };
}

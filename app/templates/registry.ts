import {
  defaultLanding,
  landingSectionTypes,
  normalizeLandingData,
  type LandingData,
  type LandingDesign,
  type LandingSectionType,
} from "../landing-data";

export const templateCategories = [
  "product",
  "service",
  "course",
  "event",
  "portfolio",
  "lead-generation",
] as const;

export type TemplateCategory = (typeof templateCategories)[number];

export type LandingTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  version: number;
  tags: string[];
  recommendedFor: string[];
  landing: LandingData;
};

export type TemplateSelection = {
  id: string;
  name: string;
  description: string;
  reason: string;
  confidence: number;
};

const allSections = [...landingSectionTypes];

function makeTemplate(input: Omit<LandingTemplate, "landing"> & {
  design: Omit<LandingDesign, "templateId" | "templateVersion">;
  landing: Partial<LandingData>;
}): LandingTemplate {
  const landing = normalizeLandingData({
    ...structuredClone(defaultLanding),
    ...input.landing,
    design: {
      templateId: input.id,
      templateVersion: input.version,
      ...input.design,
    },
  });

  return {
    id: input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    version: input.version,
    tags: input.tags,
    recommendedFor: input.recommendedFor,
    landing,
  };
}

export const landingTemplates: LandingTemplate[] = [
  makeTemplate({
    id: "product-modern",
    name: "Sản phẩm hiện đại",
    description: "Tập trung vào sản phẩm, lợi ích, giá bán và hành động mua.",
    category: "product",
    version: 1,
    tags: ["hiện đại", "sản phẩm", "thương mại", "tin cậy"],
    recommendedFor: ["sell_product", "launch", "promotion"],
    design: {
      sectionVariants: {
        hero: "product-showcase",
        stats: "cards",
        features: "bento",
        pricing: "cards",
        gallery: "showcase",
        testimonial: "card",
        faq: "two-columns",
        leadForm: "two-columns",
        finalCta: "banner",
      },
      typography: { heading: "modern", body: "sans" },
    },
    landing: {
      brand: "Nexa Home",
      navCta: "Nhận ưu đãi",
      eyebrow: "Thiết kế cho cuộc sống hiện đại",
      headline: "Một sản phẩm tốt cho",
      accentLine: "mỗi ngày nhẹ nhàng hơn.",
      description:
        "Khám phá giải pháp được thiết kế rõ ràng, dễ sử dụng và phù hợp với nhịp sống của gia đình hiện đại.",
      primaryCta: "Mua ngay",
      secondaryCta: "Xem sản phẩm",
      proof: "Được hàng nghìn khách hàng tin chọn",
      featuresEyebrow: "Lợi ích nổi bật",
      featuresHeadline: "Khác biệt có thể cảm nhận ngay.",
      pricingEyebrow: "Lựa chọn phù hợp",
      pricingHeadline: "Mức giá rõ ràng, giá trị lâu dài.",
      finalCtaEyebrow: "Sẵn sàng trải nghiệm?",
      finalCtaHeadline: "Chọn sản phẩm phù hợp với bạn hôm nay.",
      sectionOrder: allSections,
      hiddenSections: ["portfolio"],
      palette: {
        ink: "#10243e",
        paper: "#f7f5ef",
        accent: "#f2673a",
        soft: "#e3edf3",
        line: "#cbd4d9",
      },
    },
  }),
  makeTemplate({
    id: "service-editorial",
    name: "Dịch vụ cao cấp",
    description: "Bố cục biên tập dành cho tư vấn, thiết kế và dịch vụ chuyên môn.",
    category: "service",
    version: 1,
    tags: ["cao cấp", "tối giản", "chuyên nghiệp", "dịch vụ"],
    recommendedFor: ["service", "booking", "general"],
    design: {
      sectionVariants: {
        hero: "split",
        stats: "row",
        features: "numbered",
        pricing: "minimal",
        portfolio: "editorial",
        testimonial: "highlight",
        faq: "list",
        leadForm: "two-columns",
        finalCta: "minimal",
      },
      typography: { heading: "editorial", body: "humanist" },
    },
    landing: {
      brand: "Atelier",
      navCta: "Nhận báo giá",
      eyebrow: "Dịch vụ được thiết kế riêng",
      headline: "Từ nhu cầu thực tế đến",
      accentLine: "kết quả đáng tin cậy.",
      description:
        "Một quy trình rõ ràng, đội ngũ giàu kinh nghiệm và giải pháp phù hợp với từng mục tiêu kinh doanh.",
      primaryCta: "Nhận tư vấn",
      secondaryCta: "Xem dự án",
      proof: "Đồng hành cùng doanh nghiệp từ ý tưởng đến triển khai",
      featuresEyebrow: "Cách chúng tôi tạo giá trị",
      featuresHeadline: "Rõ ràng trong quy trình. Chỉn chu trong kết quả.",
      portfolioEyebrow: "Dự án đã thực hiện",
      portfolioHeadline: "Kinh nghiệm được chứng minh bằng công việc thực tế.",
      leadForm: {
        title: "Trao đổi về dự án của bạn",
        description: "Để lại thông tin để nhận tư vấn và báo giá phù hợp.",
        fields: ["Họ và tên", "Email", "Số điện thoại", "Nhu cầu tư vấn"],
        buttonText: "Nhận báo giá",
        successMessage: "Cảm ơn bạn! Chúng tôi sẽ liên hệ sớm.",
      },
      sectionOrder: allSections,
      hiddenSections: ["gallery"],
      palette: {
        ink: "#183126",
        paper: "#f5efe5",
        accent: "#b45136",
        soft: "#dce6d8",
        line: "#cbc6ba",
      },
    },
  }),
  makeTemplate({
    id: "course-friendly",
    name: "Khóa học thân thiện",
    description: "Giải thích chương trình học, kết quả và lộ trình đăng ký rõ ràng.",
    category: "course",
    version: 1,
    tags: ["giáo dục", "thân thiện", "năng động", "khóa học"],
    recommendedFor: ["course", "lead_generation"],
    design: {
      sectionVariants: {
        hero: "centered",
        stats: "cards",
        features: "grid",
        pricing: "comparison",
        testimonial: "card",
        faq: "two-columns",
        leadForm: "centered",
        finalCta: "banner",
      },
      typography: { heading: "friendly", body: "sans" },
    },
    landing: {
      brand: "BrightPath",
      navCta: "Đăng ký học thử",
      eyebrow: "Học đúng lộ trình",
      headline: "Tiến bộ từng bước,",
      accentLine: "tự tin mỗi ngày.",
      description:
        "Chương trình thực tế, người hướng dẫn tận tâm và lộ trình phù hợp với mục tiêu của từng học viên.",
      primaryCta: "Đăng ký ngay",
      secondaryCta: "Xem chương trình",
      proof: "Học viên được theo sát trong suốt lộ trình",
      featuresEyebrow: "Bạn sẽ học được gì?",
      featuresHeadline: "Kiến thức có hệ thống, kỹ năng dùng được ngay.",
      pricingEyebrow: "Học phí",
      pricingHeadline: "Chọn lộ trình phù hợp với mục tiêu của bạn.",
      finalCtaEyebrow: "Bắt đầu ngay hôm nay",
      finalCtaHeadline: "Đăng ký để được tư vấn lộ trình miễn phí.",
      sectionOrder: allSections,
      hiddenSections: ["portfolio", "gallery"],
      palette: {
        ink: "#17213a",
        paper: "#fff9ef",
        accent: "#e95f49",
        soft: "#e8e4f6",
        line: "#d8d1c8",
      },
    },
  }),
  makeTemplate({
    id: "event-bold",
    name: "Sự kiện nổi bật",
    description: "Tạo cảm giác cấp thiết với thông tin thời gian và đăng ký nổi bật.",
    category: "event",
    version: 1,
    tags: ["sự kiện", "workshop", "nổi bật", "năng lượng"],
    recommendedFor: ["event", "launch", "promotion"],
    design: {
      sectionVariants: {
        hero: "image-background",
        stats: "cards",
        features: "bento",
        portfolio: "masonry",
        testimonial: "minimal",
        faq: "list",
        leadForm: "compact",
        finalCta: "banner",
      },
      typography: { heading: "modern", body: "sans" },
    },
    landing: {
      brand: "NEXT Forum",
      navCta: "Giữ chỗ",
      eyebrow: "Sự kiện dành cho người kiến tạo",
      headline: "Gặp gỡ. Chia sẻ.",
      accentLine: "Tạo ra điều mới.",
      description:
        "Một ngày kết nối cùng diễn giả, chuyên gia và cộng đồng để biến ý tưởng thành hành động.",
      primaryCta: "Đăng ký tham dự",
      secondaryCta: "Xem chương trình",
      proof: "Số lượng chỗ ngồi được công bố minh bạch",
      featuresEyebrow: "Nội dung sự kiện",
      featuresHeadline: "Một ngày cô đọng, nhiều kết nối giá trị.",
      leadForm: {
        title: "Đăng ký tham dự",
        description: "Điền thông tin để giữ chỗ và nhận thông báo từ ban tổ chức.",
        fields: ["Họ và tên", "Email", "Số điện thoại", "Đơn vị công tác"],
        buttonText: "Giữ chỗ ngay",
        successMessage: "Bạn đã đăng ký thành công!",
      },
      sectionOrder: allSections,
      hiddenSections: ["pricing", "gallery"],
      palette: {
        ink: "#20211f",
        paper: "#f7f1e8",
        accent: "#f15a32",
        soft: "#f4d96f",
        line: "#c8c3b8",
      },
    },
  }),
  makeTemplate({
    id: "portfolio-editorial",
    name: "Portfolio biên tập",
    description: "Đặt dự án và hình ảnh ở trung tâm cho cá nhân hoặc studio sáng tạo.",
    category: "portfolio",
    version: 1,
    tags: ["portfolio", "cá nhân", "studio", "biên tập"],
    recommendedFor: ["portfolio", "service"],
    design: {
      sectionVariants: {
        hero: "centered",
        stats: "row",
        features: "numbered",
        portfolio: "editorial",
        gallery: "masonry",
        testimonial: "minimal",
        leadForm: "compact",
        finalCta: "minimal",
      },
      typography: { heading: "editorial", body: "humanist" },
    },
    landing: {
      brand: "Minh Studio",
      navCta: "Cùng hợp tác",
      eyebrow: "Thiết kế và định hướng hình ảnh",
      headline: "Công việc tốt tạo nên",
      accentLine: "một lời giới thiệu đáng nhớ.",
      description:
        "Tuyển chọn những dự án thể hiện cách chúng tôi suy nghĩ, hợp tác và tạo ra kết quả.",
      primaryCta: "Trao đổi dự án",
      secondaryCta: "Xem portfolio",
      proof: "Làm việc trực tiếp với người phụ trách sáng tạo",
      portfolioEyebrow: "Dự án chọn lọc",
      portfolioHeadline: "Mỗi dự án bắt đầu bằng một câu hỏi đúng.",
      galleryEyebrow: "Hình ảnh",
      galleryHeadline: "Chi tiết tạo nên bản sắc.",
      sectionOrder: allSections,
      hiddenSections: ["pricing", "faq"],
      palette: {
        ink: "#171916",
        paper: "#f1eee7",
        accent: "#c94d31",
        soft: "#d9ded5",
        line: "#c7c3b9",
      },
    },
  }),
  makeTemplate({
    id: "lead-minimal",
    name: "Thu thập khách hàng",
    description: "Một thông điệp, một ưu đãi và form ngắn tập trung chuyển đổi.",
    category: "lead-generation",
    version: 1,
    tags: ["lead", "tối giản", "quảng cáo", "chuyển đổi"],
    recommendedFor: ["lead_generation", "booking", "promotion"],
    design: {
      sectionVariants: {
        hero: "centered",
        stats: "row",
        features: "grid",
        testimonial: "card",
        faq: "list",
        leadForm: "centered",
        finalCta: "minimal",
      },
      typography: { heading: "modern", body: "sans" },
    },
    landing: {
      brand: "GrowthKit",
      navCta: "Nhận tài liệu",
      eyebrow: "Tài liệu thực hành miễn phí",
      headline: "Một hướng dẫn ngắn để",
      accentLine: "bắt đầu đúng ngay hôm nay.",
      description:
        "Nhận tài liệu cô đọng, dễ áp dụng và được xây dựng từ những tình huống thực tế.",
      primaryCta: "Nhận miễn phí",
      secondaryCta: "Xem nội dung",
      proof: "Không spam. Có thể hủy nhận tin bất cứ lúc nào.",
      featuresEyebrow: "Bạn sẽ nhận được",
      featuresHeadline: "Nội dung ngắn gọn, hành động rõ ràng.",
      leadForm: {
        title: "Nhận tài liệu qua email",
        description: "Nhập thông tin để nhận đường dẫn tải tài liệu.",
        fields: ["Họ và tên", "Email"],
        buttonText: "Gửi tài liệu cho tôi",
        successMessage: "Hãy kiểm tra email của bạn!",
      },
      sectionOrder: allSections,
      hiddenSections: ["pricing", "portfolio", "gallery"],
      palette: {
        ink: "#15352c",
        paper: "#fbfaf6",
        accent: "#d94d31",
        soft: "#dcecdf",
        line: "#ccd6cf",
      },
    },
  }),
];

export function getLandingTemplate(id: string | null | undefined) {
  return landingTemplates.find((template) => template.id === id) || null;
}

export function createLandingFromTemplate(id: string) {
  const template = getLandingTemplate(id) || landingTemplates[0];
  return structuredClone(template.landing);
}

export function createBlankLanding() {
  return normalizeLandingData({
    ...structuredClone(defaultLanding),
    design: {
      templateId: "blank",
      templateVersion: 1,
      sectionVariants: {
        hero: "centered",
        leadForm: "centered",
        finalCta: "minimal",
      },
      typography: { heading: "modern", body: "sans" },
    },
    brand: "Dự án mới",
    eyebrow: "Giới thiệu thương hiệu",
    headline: "Viết tiêu đề chính",
    accentLine: "và thông điệp nổi bật.",
    description: "Mô tả ngắn về sản phẩm, dịch vụ hoặc doanh nghiệp của bạn.",
    primaryCta: "Liên hệ",
    secondaryCta: "Tìm hiểu thêm",
    proof: "Thêm bằng chứng tạo niềm tin",
    hiddenSections: landingSectionTypes.filter(
      (section): section is LandingSectionType =>
        section !== "hero" && section !== "finalCta"
    ),
    palette: {
      ink: "#17231d",
      paper: "#fbfaf6",
      accent: "#d85a38",
      soft: "#e7ece7",
      line: "#d6d8d3",
    },
  });
}

export function applyTemplateDesign(current: LandingData, templateId: string) {
  const template = getLandingTemplate(templateId);
  if (!template) return normalizeLandingData(current);
  return normalizeLandingData({
    ...current,
    design: structuredClone(template.landing.design),
    palette: structuredClone(template.landing.palette),
    sectionOrder: [...template.landing.sectionOrder],
    hiddenSections: [...template.landing.hiddenSections],
  });
}

export function selectTemplateForBrief(brief: {
  pagePurpose: string;
  tone?: string;
  businessType?: string;
}): TemplateSelection {
  const haystack = `${brief.tone || ""} ${brief.businessType || ""}`.toLocaleLowerCase("vi");
  const ranked = landingTemplates
    .map((template) => {
      let score = template.recommendedFor.includes(brief.pagePurpose) ? 70 : 15;
      score += template.tags.filter((tag) => haystack.includes(tag)).length * 8;
      return { template, score };
    })
    .sort((left, right) => right.score - left.score);
  const selected = ranked[0]?.template || landingTemplates[0];
  const score = ranked[0]?.score || 50;

  return {
    id: selected.id,
    name: selected.name,
    description: selected.description,
    reason: `Phù hợp với mục tiêu ${brief.pagePurpose.replaceAll("_", " ")} và phong cách ${brief.tone || "rõ ràng"}.`,
    confidence: Math.min(0.98, Math.max(0.65, score / 100)),
  };
}

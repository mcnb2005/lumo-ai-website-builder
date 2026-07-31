export const landingSectionTypes = [
  "hero",
  "stats",
  "features",
  "pricing",
  "portfolio",
  "gallery",
  "testimonial",
  "faq",
  "leadForm",
  "finalCta",
] as const;

export type LandingSectionType = (typeof landingSectionTypes)[number];

export type LandingImageTarget =
  | "hero"
  | "gallery:add"
  | `gallery:${number}`
  | `portfolio:${number}`;

export type LandingImageAsset = {
  id?: string;
  url: string;
  alt: string;
};

export type LandingData = {
  brand: string;
  navCta: string;
  eyebrow: string;
  headline: string;
  accentLine: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  proof: string;
  heroImage: string;
  sectionOrder: LandingSectionType[];
  hiddenSections: LandingSectionType[];
  stats: Array<{ value: string; label: string }>;
  features: Array<{ number: string; title: string; text: string }>;
  pricing: Array<{
    name: string;
    price: string;
    description: string;
    features: string[];
    highlighted: boolean;
    cta: string;
  }>;
  portfolio: Array<{
    title: string;
    category: string;
    description: string;
    imageUrl: string;
  }>;
  gallery: Array<{ url: string; alt: string; caption: string }>;
  testimonial: { quote: string; name: string; role: string };
  faq: Array<{ question: string; answer: string }>;
  leadForm: {
    title: string;
    description: string;
    fields: string[];
    buttonText: string;
    successMessage: string;
  };
  palette: {
    ink: string;
    paper: string;
    accent: string;
    soft: string;
    line: string;
  };
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

export const defaultLanding: LandingData = {
  brand: "Morrow",
  navCta: "Nhận tư vấn",
  eyebrow: "Hệ điều hành cho đội ngũ sáng tạo",
  headline: "Từ ý tưởng đến",
  accentLine: "tăng trưởng thật.",
  description:
    "Morrow gom dự án, phản hồi và hiệu suất vào một không gian làm việc rõ ràng — để đội ngũ tập trung tạo ra những điều đáng nhớ.",
  primaryCta: "Bắt đầu miễn phí",
  secondaryCta: "Xem cách hoạt động",
  proof: "Được tin dùng bởi 2.000+ đội ngũ hiện đại",
  heroImage: "",
  sectionOrder: [
    "hero",
    "stats",
    "features",
    "pricing",
    "portfolio",
    "gallery",
    "testimonial",
    "faq",
    "leadForm",
    "finalCta",
  ],
  hiddenSections: [],
  stats: [
    { value: "3.4×", label: "Nhanh hơn từ brief đến launch" },
    { value: "42%", label: "Ít vòng phản hồi hơn" },
    { value: "18h", label: "Tiết kiệm mỗi tuần" },
  ],
  features: [
    {
      number: "01",
      title: "Một nơi cho mọi ý tưởng",
      text: "Biến brief, tài liệu và phản hồi rời rạc thành một nguồn thông tin chung.",
    },
    {
      number: "02",
      title: "Nhịp làm việc tự động",
      text: "Giữ mọi người đúng tiến độ với quy trình linh hoạt và nhắc việc thông minh.",
    },
    {
      number: "03",
      title: "Hiệu quả nhìn thấy được",
      text: "Đo thời gian, chất lượng và tác động mà không cần thêm bảng tính.",
    },
  ],
  pricing: [
    {
      name: "Khởi đầu",
      price: "Miễn phí",
      description: "Dành cho cá nhân muốn thử một cách làm việc rõ ràng hơn.",
      features: ["1 không gian làm việc", "3 dự án", "Báo cáo cơ bản"],
      highlighted: false,
      cta: "Dùng thử",
    },
    {
      name: "Tăng trưởng",
      price: "299.000đ/tháng",
      description: "Dành cho đội ngũ nhỏ cần phối hợp và phát triển nhanh.",
      features: ["Không giới hạn dự án", "Tự động hóa", "Báo cáo nâng cao"],
      highlighted: true,
      cta: "Bắt đầu ngay",
    },
    {
      name: "Doanh nghiệp",
      price: "Liên hệ",
      description: "Giải pháp linh hoạt cho quy trình và yêu cầu riêng.",
      features: ["Phân quyền nâng cao", "Hỗ trợ ưu tiên", "Tùy chỉnh theo nhu cầu"],
      highlighted: false,
      cta: "Nhận tư vấn",
    },
  ],
  portfolio: [
    {
      title: "Chiến dịch ra mắt mùa hè",
      category: "Thương hiệu",
      description: "Từ chiến lược đến bộ nhận diện và trang chuyển đổi.",
      imageUrl: "",
    },
    {
      title: "Nền tảng học tập mới",
      category: "Sản phẩm số",
      description: "Trải nghiệm học đơn giản, thân thiện và tập trung vào kết quả.",
      imageUrl: "",
    },
    {
      title: "Không gian bán lẻ",
      category: "Trải nghiệm",
      description: "Kết nối câu chuyện thương hiệu giữa trực tuyến và cửa hàng.",
      imageUrl: "",
    },
  ],
  gallery: [],
  testimonial: {
    quote:
      "Morrow giúp đội ngũ của chúng tôi ra mắt chiến dịch trong vài ngày thay vì vài tuần.",
    name: "Minh Anh",
    role: "Creative Director, Folklore",
  },
  faq: [
    {
      question: "Tôi có thể dùng thử trước không?",
      answer:
        "Có. Bạn có thể bắt đầu miễn phí, khám phá quy trình và nâng cấp khi cần thêm tính năng.",
    },
    {
      question: "Mất bao lâu để bắt đầu?",
      answer:
        "Chỉ vài phút. Tạo không gian, thêm dự án đầu tiên và mời đội ngũ của bạn.",
    },
    {
      question: "Dữ liệu của tôi có an toàn không?",
      answer:
        "Dữ liệu được lưu trữ an toàn và chỉ những thành viên được cấp quyền mới có thể truy cập.",
    },
  ],
  leadForm: {
    title: "Sẵn sàng biến ý tưởng thành kết quả?",
    description:
      "Để lại thông tin, đội ngũ của chúng tôi sẽ liên hệ trong một ngày làm việc.",
    fields: ["Họ và tên", "Email", "Số điện thoại", "Nhu cầu của bạn"],
    buttonText: "Gửi yêu cầu",
    successMessage: "Cảm ơn bạn! Chúng tôi sẽ liên hệ sớm.",
  },
  palette: {
    ink: "#15271f",
    paper: "#f6f2e8",
    accent: "#e8542f",
    soft: "#dfe9d9",
    line: "#c9c8bd",
  },
};

export const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Chào bạn, mình là Lumo. Hãy mô tả doanh nghiệp hoặc sản phẩm — mình sẽ tạo landing page và sửa trực tiếp theo từng tin nhắn.",
  },
];

export function normalizeLandingData(
  value: Partial<LandingData> | null | undefined
): LandingData {
  if (!value) return structuredClone(defaultLanding);
  return {
    ...structuredClone(defaultLanding),
    ...value,
    sectionOrder: (() => {
      const allowed = new Set(landingSectionTypes);
      const normalized = Array.isArray(value.sectionOrder)
        ? value.sectionOrder.filter(
            (section): section is LandingSectionType =>
              typeof section === "string" && allowed.has(section as LandingSectionType)
          )
        : [];
      if (!normalized.length) {
        return defaultLanding.sectionOrder;
      }
      const unique = normalized.filter(
        (section, index, all) => all.indexOf(section) === index
      );
      if (!unique.includes("hero")) unique.unshift("hero");
      if (!unique.includes("finalCta")) unique.push("finalCta");
      return unique;
    })(),
    hiddenSections: Array.isArray(value.hiddenSections)
      ? value.hiddenSections.filter(
          (section, index, all): section is LandingSectionType =>
            typeof section === "string" &&
            landingSectionTypes.includes(section as LandingSectionType) &&
            section !== "hero" &&
            section !== "finalCta" &&
            all.indexOf(section) === index
        )
      : [],
    stats: Array.isArray(value.stats) ? value.stats : defaultLanding.stats,
    features: Array.isArray(value.features)
      ? value.features
      : defaultLanding.features,
    pricing: Array.isArray(value.pricing)
      ? value.pricing
      : defaultLanding.pricing,
    portfolio: Array.isArray(value.portfolio)
      ? value.portfolio
      : defaultLanding.portfolio,
    gallery: Array.isArray(value.gallery)
      ? value.gallery
      : defaultLanding.gallery,
    faq: Array.isArray(value.faq) ? value.faq : defaultLanding.faq,
    testimonial: {
      ...defaultLanding.testimonial,
      ...(value.testimonial || {}),
    },
    leadForm: {
      ...defaultLanding.leadForm,
      ...(value.leadForm || {}),
    },
    palette: {
      ...defaultLanding.palette,
      ...(value.palette || {}),
    },
  };
}

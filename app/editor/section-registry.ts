export const sectionRegistry = {
  hero: { label: "Mở đầu" },
  stats: { label: "Số liệu nổi bật" },
  features: { label: "Lợi ích" },
  pricing: { label: "Bảng giá" },
  portfolio: { label: "Dự án" },
  gallery: { label: "Hình ảnh" },
  testimonial: { label: "Đánh giá" },
  faq: { label: "Câu hỏi thường gặp" },
  leadForm: { label: "Form đăng ký" },
  finalCta: { label: "Kêu gọi hành động" },
} as const;

export type SectionRegistryKey = keyof typeof sectionRegistry;

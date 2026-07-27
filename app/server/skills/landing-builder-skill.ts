import type { LandingData } from "../../landing-data";

const requiredKeys: Array<keyof LandingData> = [
  "brand",
  "navCta",
  "eyebrow",
  "headline",
  "accentLine",
  "description",
  "primaryCta",
  "secondaryCta",
  "proof",
  "heroImage",
  "sectionOrder",
  "stats",
  "features",
  "pricing",
  "portfolio",
  "gallery",
  "testimonial",
  "faq",
  "leadForm",
  "palette",
];

export function isLandingData(value: unknown): value is LandingData {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return requiredKeys.every((key) => key in record);
}

export function parseLandingJson(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI trả về dữ liệu không hợp lệ.");
  }

  const value = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  if (!isLandingData(value)) {
    throw new Error("AI chưa trả về đủ nội dung landing page.");
  }
  return value;
}

export const landingBuilderSkill = {
  id: "landing-builder",
  version: "1.0.0",
  name: "Thiết kế landing page",
  description:
    "Biến yêu cầu tiếng Việt thành dữ liệu landing page an toàn để renderer hiển thị.",
  instructions: [
    "Bạn là chuyên gia conversion copywriting và thiết kế landing page.",
    "Cập nhật toàn bộ JSON landing page theo yêu cầu bằng tiếng Việt tự nhiên.",
    "Giữ nguyên tất cả khóa và kiểu dữ liệu trong JSON.",
    "sectionOrder chỉ được dùng stats, features, pricing, portfolio, gallery, testimonial, faq, leadForm.",
    "Giữ 3 stats, 3 features, tối đa 3 gói giá, tối đa 6 mục portfolio, tối đa 8 ảnh gallery và tối đa 6 FAQ.",
    "Không thay đổi URL ảnh bắt đầu bằng /api/assets/.",
    "Màu phải là mã hex hợp lệ.",
    "Không thêm khóa mới.",
    "Chỉ trả về một JSON object hợp lệ, không markdown, không giải thích.",
  ].join(" "),
} as const;


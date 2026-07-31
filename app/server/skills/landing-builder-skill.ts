import {
  normalizeLandingData,
  type LandingData,
  type LandingSectionType,
} from "../../landing-data";
import {
  parseLandingOperationEnvelope,
  type LandingOperationMode,
} from "../../landing-operations";

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
  "featuresEyebrow",
  "featuresHeadline",
  "pricingEyebrow",
  "pricingHeadline",
  "heroImage",
  "sectionOrder",
  "hiddenSections",
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

export function parseLandingJson(text: string, current?: LandingData) {
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
  if (!value || typeof value !== "object") {
    throw new Error("AI chưa trả về đủ nội dung landing page.");
  }
  const record = value as Record<string, unknown>;
  const recognizedKeys = requiredKeys.filter((key) => key in record);
  if (!recognizedKeys.length) {
    throw new Error("AI chưa trả về đủ nội dung landing page.");
  }

  const partial = Object.fromEntries(
    recognizedKeys.map((key) => [key, record[key]])
  ) as Partial<LandingData>;

  return normalizeLandingData({
    ...(current || {}),
    ...partial,
    hiddenSections: Array.isArray(record.hiddenSections)
      ? (record.hiddenSections as LandingData["hiddenSections"])
      : current?.hiddenSections || [],
  });
}

export function parseLandingOperations(
  text: string,
  current: LandingData,
  mode: LandingOperationMode
) {
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("AI trả về dữ liệu operation không hợp lệ.");
  }
  const value = JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  return parseLandingOperationEnvelope(value, {
    mode,
    current,
    source: "ai",
  });
}

const sectionAliases: Array<{
  section: Exclude<LandingSectionType, "finalCta">;
  aliases: string[];
}> = [
  { section: "stats", aliases: ["số liệu", "thống kê", "con số"] },
  {
    section: "features",
    aliases: ["giải pháp", "lợi ích", "tính năng", "đặc điểm"],
  },
  { section: "pricing", aliases: ["bảng giá", "gói giá", "giá bán"] },
  { section: "portfolio", aliases: ["dự án", "portfolio", "sản phẩm mẫu"] },
  { section: "gallery", aliases: ["thư viện", "hình ảnh", "gallery"] },
  {
    section: "testimonial",
    aliases: ["đánh giá", "cảm nhận", "khách hàng nói"],
  },
  {
    section: "faq",
    aliases: ["câu hỏi thường gặp", "faq", "hỏi đáp"],
  },
  {
    section: "leadForm",
    aliases: ["form đăng ký", "biểu mẫu", "form liên hệ", "đăng ký"],
  },
];

function normalizedPrompt(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .toLowerCase();
}

export function applySectionVisibilityIntent(
  prompt: string,
  landing: LandingData
) {
  const normalized = normalizedPrompt(prompt);
  const wantsHide =
    /\b(xoa|bo|an|loai bo|remove|hide)\b/.test(normalized);
  const wantsShow =
    /\b(hien|hien thi|them lai|bat lai|show|unhide)\b/.test(normalized);
  if (!wantsHide && !wantsShow) {
    return { landing, changedSections: [] as LandingSectionType[] };
  }

  const matchedSections = sectionAliases
    .filter(({ aliases }) =>
      aliases.some((alias) => normalized.includes(normalizedPrompt(alias)))
    )
    .map(({ section }) => section);
  if (!matchedSections.length) {
    return { landing, changedSections: [] as LandingSectionType[] };
  }

  const hiddenSections = wantsHide
    ? Array.from(new Set([...landing.hiddenSections, ...matchedSections]))
    : landing.hiddenSections.filter(
        (section) => !matchedSections.some((matched) => matched === section)
      );

  return {
    landing: normalizeLandingData({ ...landing, hiddenSections }),
    changedSections: matchedSections,
  };
}

export function preserveInternalAssetUrls(
  current: LandingData,
  next: LandingData
) {
  const internalPrefix = "/api/assets/";
  const allowedUrls = new Set<string>([
    current.heroImage,
    ...current.portfolio.map((item) => item?.imageUrl),
    ...current.gallery.map((image) => image?.url),
  ].filter(
    (url): url is string =>
      typeof url === "string" && url.startsWith(internalPrefix)
  ));

  function safeUrl(url: unknown, fallback: unknown = "") {
    const candidate = typeof url === "string" ? url : "";
    const fallbackUrl = typeof fallback === "string" ? fallback : "";
    if (!candidate) return fallbackUrl;
    if (
      !candidate.startsWith(internalPrefix) ||
      allowedUrls.has(candidate)
    ) {
      return candidate;
    }
    return allowedUrls.has(fallbackUrl) ? fallbackUrl : "";
  }

  return normalizeLandingData({
    ...next,
    heroImage: safeUrl(next.heroImage, current.heroImage),
    portfolio: next.portfolio.map((item, index) => ({
      ...item,
      imageUrl: safeUrl(
        item?.imageUrl,
        current.portfolio[index]?.imageUrl
      ),
    })),
    gallery: next.gallery.filter(
      (image) =>
        typeof image?.url === "string" &&
        (!image.url.startsWith(internalPrefix) || allowedUrls.has(image.url))
    ),
  });
}

export const landingBuilderSkill = {
  id: "landing-builder",
  version: "2.0.0",
  name: "Thiết kế landing page",
  description:
    "Biến yêu cầu tiếng Việt thành dữ liệu landing page an toàn để renderer hiển thị.",
  instructions: [
    "Bạn là chuyên gia conversion copywriting và thiết kế landing page.",
    "Mọi phản hồi phải là một JSON object có khóa operations là một mảng và explanation là một câu ngắn.",
    "Khi chỉnh sửa, luôn trả thay đổi nhỏ nhất có thể; không trả lại toàn bộ LandingData.",
    "Các operation được phép: update_text, replace_section, set_palette, hide_section, show_section, move_section, add_section, assign_image và replace_landing.",
    "update_text có dạng {type, section, field, value, index?, nestedIndex?}. Chỉ dùng field có trong manifest; field của mảng phải có index, pricing.feature phải có cả index và nestedIndex.",
    "replace_section chỉ dùng khi người dùng yêu cầu viết lại toàn bộ một section.",
    "set_palette có token ink, paper, accent, soft hoặc line và value là mã hex 6 ký tự.",
    "hide_section được dùng cho hero và các section nội dung; không được dùng cho finalCta.",
    "assign_image chỉ được dùng với URL ảnh đã có trong context; không tự tạo URL ảnh.",
    "replace_landing chỉ được dùng khi intent.mode là create và value phải là LandingData hoàn chỉnh.",
    "sectionOrder chỉ được dùng hero, stats, features, pricing, portfolio, gallery, testimonial, faq, leadForm, finalCta và không được chứa phần tử trùng.",
    "Giữ nguyên sectionOrder và hiddenSections nếu người dùng chỉ yêu cầu sửa nội dung.",
    "Chỉ sửa đúng trường hoặc section người dùng yêu cầu; không tự viết lại các phần không liên quan.",
    "Nếu người dùng nói trên đầu, đầu trang, header, logo hoặc tên thương hiệu thì đó là trường brand trên thanh điều hướng, không phải headline hay accentLine của Hero.",
    "Dùng lịch sử hội thoại để hiểu các câu sửa lại như 'bạn nhầm rồi', nhưng ưu tiên yêu cầu mới nhất.",
    "hero có thể nằm trong hiddenSections; finalCta luôn hiển thị và không được đưa vào hiddenSections.",
    "Giữ 3 stats, 3 features, tối đa 3 gói giá, tối đa 6 mục portfolio và tối đa 6 FAQ; không tự xóa hoặc giới hạn số ảnh gallery người dùng đã tải.",
    "Không thay đổi URL ảnh bắt đầu bằng /api/assets/.",
    "Màu phải là mã hex hợp lệ.",
    "Không thêm field hoặc operation ngoài schema.",
    "Chỉ trả về một JSON object hợp lệ, không markdown và không văn bản bên ngoài JSON.",
  ].join(" "),
} as const;

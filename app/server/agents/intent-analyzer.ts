import type { BuilderIntent } from "../../builder-generation";
import type { LandingManifest } from "../../landing-manifest";
import type { LandingSectionType } from "../../landing-data";

const sectionAliases: Record<LandingSectionType, string[]> = {
  hero: [
    "hero",
    "mở đầu",
    "phần đầu",
    "đầu trang",
    "header",
    "tiêu đề chính",
    "thương hiệu",
    "logo",
  ],
  stats: ["số liệu", "thống kê", "con số"],
  features: ["lợi ích", "tính năng", "giải pháp", "đặc điểm"],
  pricing: ["bảng giá", "giá bán", "gói giá", "pricing"],
  portfolio: ["dự án", "portfolio", "sản phẩm mẫu"],
  gallery: ["hình ảnh", "thư viện", "gallery"],
  testimonial: ["đánh giá", "cảm nhận", "khách hàng nói"],
  faq: ["faq", "câu hỏi thường gặp", "hỏi đáp"],
  leadForm: ["form", "biểu mẫu", "đăng ký", "liên hệ"],
  finalCta: ["cta cuối", "kêu gọi hành động cuối", "cuối trang"],
};

function normalizeCommand(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .toLowerCase();
}

function includesAlias(prompt: string, aliases: string[]) {
  const normalized = normalizeCommand(prompt);
  return aliases.some((alias) =>
    normalized.includes(normalizeCommand(alias))
  );
}

export function analyzeBuilderIntent(input: {
  prompt: string;
  manifest: LandingManifest;
  selectedSection?: LandingSectionType | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): BuilderIntent {
  const normalized = normalizeCommand(input.prompt);
  const explicitCreate =
    /\b(tao|lam|xay dung|thiet ke)\b/.test(normalized) &&
    /\b(landing|trang web|website|trang ban hang)\b/.test(normalized);
  const explicitEdit =
    /\b(sua|doi|thay|viet lai|xoa|bo|an|hien|them|chen|di chuyen)\b/.test(
      normalized
    );
  const hasPreviousUserRequest = (input.history || []).some(
    (turn) => turn.role === "user"
  );
  const mode =
    explicitCreate && !explicitEdit && !hasPreviousUserRequest
      ? "create"
      : "edit";

  const mentionedSections = input.manifest.sections
    .filter((item) => includesAlias(input.prompt, sectionAliases[item.type]))
    .map((item) => item.type);
  const refersToSelection =
    /\b(phan nay|muc nay|section nay|doan nay|cho nay)\b/.test(normalized);
  const isWholePageRequest =
    /\b(toan bo|ca trang|trang nay|landing page|website)\b/.test(normalized);
  const targetSections = Array.from(
    new Set(
      mentionedSections.length
        ? mentionedSections
        : input.selectedSection && (refersToSelection || !isWholePageRequest)
          ? [input.selectedSection]
          : []
    )
  );

  return {
    mode,
    targetSections,
    summary:
      mode === "create"
        ? "Tạo một landing page mới từ yêu cầu kinh doanh."
        : targetSections.length
          ? `Chỉ chỉnh sửa: ${targetSections.join(", ")}.`
          : "Chỉnh sửa tối thiểu các phần liên quan trực tiếp đến yêu cầu.",
  };
}

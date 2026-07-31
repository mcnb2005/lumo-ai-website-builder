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

function isCreateRequest(prompt: string) {
  const normalized = normalizeCommand(prompt);
  const createsWebsite =
    /\b(tao|lam|xay dung|thiet ke)\b/.test(normalized) &&
    /\b(landing|trang web|website|trang ban hang)\b/.test(normalized);
  const createsProject =
    /\b(tao|mo|bat dau)\s+(?:mot\s+)?(?:du an|project)(?:\s+moi)?\b/.test(
      normalized
    );

  return createsWebsite || createsProject;
}

function isCreationCorrection(prompt: string) {
  const normalized = normalizeCommand(prompt);
  return /\b(co ma|y toi|toi bao|ban nham|nham roi|khong phai|sai roi|lam lai)\b/.test(
    normalized
  );
}

export function analyzeBuilderIntent(input: {
  prompt: string;
  manifest: LandingManifest;
  selectedSection?: LandingSectionType | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): BuilderIntent {
  const normalized = normalizeCommand(input.prompt);
  const previousUserPrompt = [...(input.history ?? [])]
    .reverse()
    .find((item) => item.role === "user")?.content;
  const explicitCreate = isCreateRequest(input.prompt);
  const continuesCreate =
    isCreationCorrection(input.prompt) &&
    Boolean(previousUserPrompt && isCreateRequest(previousUserPrompt));
  const mode = explicitCreate || continuesCreate ? "create" : "edit";

  const mentionedSections = input.manifest.sections
    .filter((item) => includesAlias(input.prompt, sectionAliases[item.type]))
    .map((item) => item.type);
  const refersToSelection =
    /\b(phan nay|muc nay|section nay|doan nay|cho nay)\b/.test(normalized);
  const isWholePageRequest =
    /\b(toan bo|ca trang|trang nay|trang web|landing page|website)\b/.test(
      normalized
    );
  const targetSections = Array.from(
    new Set(
      mode === "create"
        ? []
        : mentionedSections.length
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

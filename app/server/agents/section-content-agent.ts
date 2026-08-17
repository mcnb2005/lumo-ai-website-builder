import type { LandingData } from "../../landing-data";
import {
  buildLandingManifest,
  getLandingSectionSnapshot,
} from "../../landing-manifest";
import { applyLandingOperations } from "../../landing-operations";
import type { BusinessBrief, LandingBlueprintSection } from "../../landing-project";
import {
  runAiChatTool,
  type AiChatProvider,
  type AiChatUsageReporter,
} from "../tools/ai-chat-tool";
import { extractAiJson } from "../tools/ai-json";
import {
  compileSectionDraftToOperations,
  describeSectionDraftSchema,
  isContentSectionType,
  parseSectionDraftEnvelope,
  type ContentSectionType,
} from "./section-draft";

const sectionRules: Record<ContentSectionType, string[]> = {
  hero: [
    "Headline và accentLine tổng cộng tối đa 12-16 từ.",
    "Description tối đa 35-50 từ.",
    "CTA chính tối đa 5 từ và thể hiện đúng mục tiêu chuyển đổi.",
    "Phải nói rõ sản phẩm, đối tượng hoặc kết quả chính; không dùng khẩu hiệu chung chung.",
  ],
  stats: [
    "Giữ đúng 3 số liệu ngắn.",
    "Không bịa chứng nhận hoặc số liệu khó kiểm chứng; có thể dùng thông số sản phẩm, thời lượng hoặc cam kết có điều kiện.",
  ],
  features: [
    "Tạo 3 lợi ích khác nhau, mỗi mô tả một câu ngắn.",
    "Viết lợi ích theo kết quả khách hàng nhận được, không chỉ liệt kê tính năng.",
  ],
  pricing: [
    "Tối đa 3 gói hoặc lựa chọn.",
    "Tên gói, giá, mô tả và CTA phải nhất quán với mục tiêu chuyển đổi.",
  ],
  portfolio: [
    "Viết dự án hoặc trường hợp sử dụng liên quan trực tiếp tới brief.",
    "Nếu dữ liệu hiện tại đã có ảnh do người dùng đặt, giữ nguyên số lượng item để nội dung tiếp tục khớp với ảnh.",
    "Không thay đổi imageUrl, imageFit hoặc imagePosition.",
  ],
  gallery: [
    "Chỉ sửa tiêu đề, nhãn, alt hoặc caption hiện có.",
    "Không tạo URL ảnh và không dùng replace_section.",
  ],
  testimonial: [
    "Lời chứng thực phải cụ thể, tự nhiên và không chứa thành tích không có trong brief.",
  ],
  faq: [
    "Tạo 3-6 câu hỏi xử lý băn khoăn trước khi chuyển đổi.",
    "Câu trả lời ngắn, rõ và không hứa hẹn quá mức.",
  ],
  leadForm: [
    "Form chỉ hỏi các trường thật sự cần cho mục tiêu chuyển đổi.",
    "Nêu rõ người dùng nhận được gì sau khi gửi form.",
  ],
  finalCta: [
    "Nhắc lại kết quả chính bằng một câu cụ thể.",
    "Không dùng replace_section vì finalCta chỉ có các trường text trong manifest.",
  ],
};

export async function runSectionContentAgent(input: {
  landing: LandingData;
  section: LandingBlueprintSection;
  brief: BusinessBrief;
  providerUrl: string;
  modelName: string;
  apiKey: string;
  fallbackProviders?: AiChatProvider[];
  onUsage?: AiChatUsageReporter;
  repairIssues?: string[];
}) {
  const sectionType = input.section.type;
  if (!isContentSectionType(sectionType)) {
    throw new Error(
      "customBlock không được tạo qua Content Agent; hãy dùng operation chuyên dụng."
    );
  }
  const sectionDraftSchema = describeSectionDraftSchema(sectionType);
  const sectionDraftSystemPrompt = [
    `Bạn là Content Generator chỉ phụ trách section ${input.section.type}.`,
    "Ngôn ngữ bắt buộc: xác định ngôn ngữ chính từ BusinessBrief.sourcePrompt và viết toàn bộ nội dung người dùng nhìn thấy bằng ngôn ngữ tương đồng. Không mặc định tiếng Việt chỉ vì system prompt dùng tiếng Việt; nếu người dùng chỉ định ngôn ngữ, phải làm đúng ngôn ngữ đó.",
    "Chỉ trả về một JSON object SectionDraft đúng schema được cung cấp.",
    "Không trả về operations, LandingData, JSONPath, markdown hoặc code fence.",
    "Chỉ tạo nội dung; không quyết định template, màu, thứ tự, trạng thái ẩn/hiện hoặc URL ảnh.",
    "Các ô ảnh trong Hero, Gallery và Portfolio có thể để trống để người dùng tự kéo-thả. Giữ nguyên mọi URL ảnh đang có và tuyệt đối không tạo, sửa, suy đoán hoặc tự gán URL ảnh.",
    `Schema bắt buộc: ${sectionDraftSchema}`,
    ...sectionRules[sectionType],
  ].join(" ");
  const manifest = buildLandingManifest(input.landing);
  const sectionManifest = manifest.sections.find(
    (item) => item.type === input.section.type
  );
  const snapshot = getLandingSectionSnapshot(input.landing, input.section.type);
  let repairContext = "";
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const output = await runAiChatTool({
      providerUrl: input.providerUrl,
      modelName: input.modelName,
      apiKey: input.apiKey,
      fallbackProviders: input.fallbackProviders,
      onUsage: input.onUsage,
      jsonMode: true,
      temperature: 0.35,
      systemPrompt: sectionDraftSystemPrompt,
      userPrompt: [
        `Prompt gốc của người dùng, dùng làm chuẩn ngôn ngữ:\n${input.brief.sourcePrompt}`,
        `BusinessBrief:\n${JSON.stringify(input.brief)}`,
        `LandingBlueprintSection:\n${JSON.stringify(input.section)}`,
        `SectionDraft schema:\n${sectionDraftSchema}`,
        `Manifest section:\n${JSON.stringify(sectionManifest)}`,
        `Dữ liệu section hiện tại:\n${JSON.stringify(snapshot)}`,
        input.repairIssues?.length
          ? `Các lỗi chất lượng cần sửa:\n${input.repairIssues.map((item) => `- ${item}`).join("\n")}`
          : "",
        repairContext,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    try {
      const parsedOutput = extractAiJson(
        output,
        `Không thể đọc output của Content Agent ${input.section.type}.`
      );
      const envelope = parseSectionDraftEnvelope(
        parsedOutput,
        sectionType,
        input.landing
      );
      const operations = compileSectionDraftToOperations(
        sectionType,
        envelope.draft,
        input.landing
      );
      if (!operations.length) {
        throw new Error(`Content Agent chưa tạo thay đổi cho section ${input.section.type}.`);
      }
      applyLandingOperations(input.landing, operations);
      return operations;
    } catch (error) {
      lastError = error;
      let parsedOutput: unknown = null;
      try {
        parsedOutput = extractAiJson(
          output,
          `Không thể đọc output của Content Agent ${input.section.type}.`
        );
      } catch (parseError) {
        parsedOutput = {
          parseError:
            parseError instanceof Error ? parseError.message : String(parseError),
        };
      }
      console.error(
        `[ContentAgent:${input.section.type}] validation failed`,
        JSON.stringify(
          {
            attempt,
            aiOutput: output,
            draft:
              parsedOutput &&
              typeof parsedOutput === "object" &&
              "draft" in parsedOutput
                ? (parsedOutput as { draft: unknown }).draft
                : undefined,
            parsedOutput,
            expectedDraftSchema: sectionDraftSchema,
            sectionManifest,
            sectionSnapshot: snapshot,
            validationError:
              error instanceof Error ? error.message : String(error),
          },
          null,
          2
        )
      );
      repairContext = [
        "Phản hồi trước chưa hợp lệ. Hãy sửa đúng lỗi sau rồi trả lại toàn bộ JSON SectionDraft:",
        error instanceof Error ? error.message : "Schema không hợp lệ.",
        `Schema bắt buộc: ${sectionDraftSchema}`,
        `Phản hồi trước: ${output.slice(0, 5_000)}`,
      ].join("\n");
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Không thể tạo nội dung section ${input.section.type}.`);
}

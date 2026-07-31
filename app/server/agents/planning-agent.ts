import type { LandingManifest } from "../../landing-manifest";
import type { LandingSectionType } from "../../landing-data";
import { runAiChatTool } from "../tools/ai-chat-tool";
import {
  parseBuilderPlan,
  pagePurposes,
  type BuilderPlan,
} from "./builder-plan";

type PlanningAgentInput = {
  prompt: string;
  manifest: LandingManifest;
  selectedSection?: LandingSectionType | null;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  providerUrl: string;
  modelName: string;
  apiKey: string;
};

const plannerInstructions = [
  "Bạn là AI Planner cho trình tạo landing page.",
  "Nhiệm vụ duy nhất là hiểu ý định, phạm vi và mục tiêu kinh doanh; không viết nội dung landing page và không tạo operation.",
  "Phân tích toàn bộ câu, lịch sử gần nhất, section đang chọn và manifest. Không quyết định dựa trên một từ khóa đơn lẻ.",
  "mode=create khi người dùng muốn bắt đầu, tạo mới hoặc làm lại toàn bộ website/project/landing page.",
  "mode=edit khi người dùng muốn thay đổi trang hiện tại.",
  "mode=clarify khi có từ hai cách hiểu hợp lý trở lên hoặc chưa đủ thông tin để xác định phần cần sửa.",
  "Section đang chọn chỉ là tín hiệu hỗ trợ. Không giới hạn vào section đang chọn nếu yêu cầu rõ ràng là tạo trang mới hoặc sửa toàn trang.",
  "Dùng lịch sử để hiểu câu đính chính, nhưng yêu cầu mới nhất luôn được ưu tiên.",
  "targetSections là [] khi tạo mới hoặc chỉnh sửa toàn trang; khi chỉnh sửa cục bộ chỉ chứa section thực sự cần sửa.",
  "targetField chỉ được đặt khi người dùng chỉ rõ đúng một trường trong một section.",
  `pagePurpose chỉ được là: ${pagePurposes.join(", ")}.`,
  "confidence nằm trong khoảng 0 đến 1. Nếu confidence dưới 0.6, chọn clarify và đặt clarificationQuestion ngắn, cụ thể.",
  "recommendedSections dùng cho trang mới, được sắp theo hành trình chuyển đổi.",
  "Chỉ trả một JSON object, không markdown và không giải thích bên ngoài JSON.",
].join(" ");

export async function runPlanningAgent(
  input: PlanningAgentInput
): Promise<BuilderPlan> {
  const context = [
    input.history?.length
      ? `Lịch sử hội thoại:\n${input.history
          .map((turn) => `${turn.role}: ${turn.content}`)
          .join("\n")}`
      : "",
    `Section đang chọn: ${input.selectedSection || "không có"}`,
    `Manifest:\n${JSON.stringify(input.manifest)}`,
    `Yêu cầu mới:\n${input.prompt}`,
    `Schema đầu ra:
{
  "mode": "create | edit | clarify",
  "summary": "Tóm tắt chính xác yêu cầu",
  "confidence": 0.0,
  "targetSections": [],
  "targetField": "tùy chọn",
  "pagePurpose": "general",
  "businessType": "Ngành/sản phẩm",
  "audience": "Đối tượng chính",
  "primaryGoal": "Hành động chuyển đổi chính",
  "tone": "Giọng điệu",
  "recommendedSections": [],
  "clarificationQuestion": "chỉ dùng khi clarify"
}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  let repair = "";
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const output = await runAiChatTool({
      providerUrl: input.providerUrl,
      apiKey: input.apiKey,
      modelName: input.modelName,
      temperature: 0.1,
      systemPrompt:
        attempt === 1
          ? plannerInstructions
          : `${plannerInstructions} Phản hồi trước sai schema. Hãy sửa đúng lỗi và chỉ trả JSON.`,
      userPrompt: [context, repair].filter(Boolean).join("\n\n"),
    });

    try {
      return parseBuilderPlan(output, input.manifest);
    } catch (error) {
      lastError = error;
      repair = [
        `Phản hồi trước:\n${output.slice(0, 5000)}`,
        `Lỗi schema:\n${
          error instanceof Error ? error.message : "Không xác định"
        }`,
      ].join("\n\n");
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("AI Planner không thể lập kế hoạch hợp lệ.");
}

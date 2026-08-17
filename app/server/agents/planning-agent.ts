import type { LandingManifest } from "../../landing-manifest";
import type { LandingSectionType } from "../../landing-data";
import { landingUiDesignSkill } from "../skills/runtime-skills";
import {
  runAiChatTool,
  type AiChatProvider,
  type AiChatUsageReporter,
} from "../tools/ai-chat-tool";
import {
  builderPlanSystemPromptRules,
  builderActions,
  parseBuilderPlan,
  pagePurposes,
  type BuilderPlan,
} from "./builder-plan";
import type { LandingTextTarget } from "./target-resolver";

type PlanningAgentInput = {
  prompt: string;
  manifest: LandingManifest;
  textTargets: LandingTextTarget[];
  availableAssets: string[];
  selectedSection?: LandingSectionType | null;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  providerUrl: string;
  modelName: string;
  apiKey: string;
  fallbackProviders?: AiChatProvider[];
  onUsage?: AiChatUsageReporter;
};

const plannerInstructions = [
  "Bạn là AI Planner cho trình tạo landing page.",
  "Nhiệm vụ là hiểu ý định và trả BuilderPlan có action và target chính xác; không tạo operation và không trả LandingData.",
  "Phân tích toàn bộ câu, lịch sử gần nhất, section đang chọn, manifest và danh sách text target. Không quyết định dựa trên một từ khóa đơn lẻ.",
  "mode=create và action=create_landing khi người dùng muốn tạo mới hoặc làm lại toàn bộ landing page.",
  "mode=edit khi người dùng muốn thay đổi trang hiện tại.",
  "mode=clarify và action=clarify khi có nhiều target phù hợp hoặc thiếu thông tin quan trọng.",
  `action chỉ được là: ${builderActions.join(", ")}.`,
  "Dùng update_text khi người dùng cho biết nội dung mới chính xác. Đặt value là nội dung mới, matchText là nội dung cũ nếu có.",
  "Dùng generate_content khi cần AI viết nội dung sáng tạo hoặc sửa nhiều trường, và đặt section/field rõ nhất có thể.",
  "Dùng hide_section/show_section/move_section/add_section cho thao tác bố cục. Hero được phép ẩn và hiện lại; finalCta không được ẩn.",
  "Dùng assign_image chỉ khi value đúng bằng một URL trong availableAssets và đặt target.imageTarget là hero, gallery:add, gallery:n hoặc portfolio:n.",
  "Dùng set_palette với value là mã màu hex và luôn đặt target.paletteToken: paper cho nền toàn trang, soft cho nền section hoặc thẻ, ink cho chữ chính, accent cho nút/màu nhấn, line cho đường viền.",
  "Nếu người dùng nói nền phần này và đang chọn một section, đặt target.section là section đang chọn và paletteToken=soft. Nếu nói nền toàn trang, dùng paletteToken=paper.",
  "Nếu không thể xác định người dùng muốn đổi nền toàn trang, nền section, chữ, màu nhấn hay đường viền thì chọn clarify và hỏi lại; không trả set_palette thiếu paletteToken.",
  "Nếu cùng một chữ xuất hiện ở nhiều text target mà người dùng không chỉ rõ vị trí, hãy hỏi lại thay vì tự chọn.",
  "Section đang chọn chỉ là tín hiệu hỗ trợ. Yêu cầu mới nhất luôn được ưu tiên.",
  ...builderPlanSystemPromptRules,
  `pagePurpose chỉ được là: ${pagePurposes.join(", ")}.`,
  "Khi mode=create, suy ra creativeFreedom: low nếu người dùng muốn bám sát mẫu hoặc bố cục an toàn; high nếu người dùng yêu cầu sáng tạo, phá cách hoặc brief rất rõ; nếu không có tín hiệu rõ thì dùng medium.",
  "confidence nằm trong khoảng 0 đến 1. Nếu confidence dưới 0.6, chọn clarify.",
  `Khi tạo trang mới, áp dụng skill ${landingUiDesignSkill.name}: ${landingUiDesignSkill.rules.join(" ")}`,
  "QUAN TRỌNG: Kiến trúc mới của hệ thống yêu cầu bạn thực hiện quy trình thiết kế theo thứ tự: Business Intent -> Visual Direction -> Blueprint (recommendedSections) -> Variant Selection.",
  "1. Visual Direction: Cung cấp visualDirection (mood, typography, density, imageStyle, radius, contrast) phù hợp với lĩnh vực kinh doanh.",
  "2. Blueprint: recommendedSections chỉ gồm các section thật sự phục vụ mục tiêu, được sắp xếp theo hành trình chuyển đổi; luôn bắt đầu bằng hero và kết thúc bằng finalCta.",
  "3. Variant Selection: Với mỗi section trong recommendedSections, BẮT BUỘC cung cấp sectionVariants tương ứng (vd: hero: 'minimal', features: 'cards'). ĐỪNG CHỌN NGẪU NHIÊN. Áp dụng theo Visual Direction.",
  "Mẹo Variant: Hero 'minimal' cho agency/B2B; 'image-background' cho event. Features 'cards' cho consumer app; 'minimal' cho thiết kế tinh tế; 'bento' cho SaaS. FAQ 'grid' tiết kiệm không gian. Final CTA 'split' rất cân đối cho desktop.",
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
    `Các text target hiện có:\n${JSON.stringify(input.textTargets)}`,
    `URL ảnh có thể dùng:\n${JSON.stringify(input.availableAssets)}`,
    `Yêu cầu mới:\n${input.prompt}`,
    `Schema đầu ra:
{
  "mode": "create | edit | clarify",
  "action": "một action hợp lệ",
  "target": {
    "section": "tùy chọn",
    "field": "tùy chọn",
    "index": 0,
    "nestedIndex": 0,
    "imageTarget": "tùy chọn",
    "paletteToken": "tùy chọn"
  },
  "value": "giá trị mới hoặc URL ảnh, tùy chọn",
  "matchText": "nội dung cũ cần tìm, tùy chọn",
  "toIndex": 0,
  "summary": "Tóm tắt chính xác yêu cầu",
  "confidence": 0.0,
  "pagePurpose": "general",
  "businessType": "Ngành/sản phẩm",
  "audience": "Đối tượng chính",
  "primaryGoal": "Hành động chuyển đổi chính",
  "tone": "Giọng điệu",
  "creativeFreedom": "low | medium | high",
  "recommendedSections": [],
  "sectionVariants": { "hero": "split", "features": "bento" },
  "typography": { "heading": "modern", "body": "sans" },
  "radius": "md",
  "density": "comfortable",
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
      fallbackProviders: input.fallbackProviders,
      onUsage: input.onUsage,
      jsonMode: true,
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

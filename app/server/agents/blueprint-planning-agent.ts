import {
  landingSectionTypes,
  landingSectionVariantOptions,
  type LandingData,
} from "../../landing-data";
import type { BusinessBrief } from "../../landing-project";
import type { TemplateSelection } from "../../templates/registry";
import { extractAiJson } from "../tools/ai-json";
import {
  runAiChatTool,
  type AiChatProvider,
  type AiChatUsageReporter,
} from "../tools/ai-chat-tool";
import type { BuilderPlan } from "./builder-plan";
import {
  createTemplateBaselineDecision,
  parseBlueprintDecision,
  type BlueprintDecision,
} from "./blueprint-decision";
import { resolveLandingRecipe } from "./landing-recipes";

type BlueprintPlanningAgentInput = {
  prompt: string;
  plan: BuilderPlan;
  brief: BusinessBrief;
  templateSelection: TemplateSelection;
  templateLanding: LandingData;
  providerUrl: string;
  modelName: string;
  apiKey: string;
  fallbackProviders?: AiChatProvider[];
  onUsage?: AiChatUsageReporter;
};

export type BlueprintPlanningResult = {
  decision: BlueprintDecision;
  usedFallback: boolean;
  warning?: string;
};

const blueprintPlannerInstructions = [
  "Bạn là Blueprint Planner và Creative Director cho Lumo AI Website Builder.",
  "Template là baseline, không phải constraint. Bạn được phép thay đổi mạnh cấu trúc nếu User Brief cho thấy một composition khác tốt hơn.",
  "Hãy đánh giá template trước khi quyết định giữ, thay, bỏ, thêm hoặc đổi thứ tự section. Không có quota giới hạn số section hoặc số variant được thay đổi.",
  "creativeFreedom=low ưu tiên baseline khi vẫn phù hợp; medium giữ hành trình chuyển đổi hợp lý nhưng được đổi section và variant tự do; high chỉ xem template như inspiration/fallback và có thể dựng Blueprint gần như mới.",
  "Chỉ dùng section và variant trong catalog được cung cấp. Không dùng customBlock trong luồng tạo tự động.",
  "Hard constraints duy nhất: không duplicate section; hero đứng đầu; finalCta đứng cuối; mọi section/variant phải hợp lệ; typography, density, radius và palette phải đúng enum/schema.",
  "Alias: hero full-bleed hoặc full-screen phải trả canonical image-background; nếu trọng tâm là demo giao diện/sản phẩm thì có thể chọn product-showcase.",
  "Alias: yêu cầu section Demo phải được diễn giải thành gallery cho trình diễn hình ảnh hoặc portfolio cho công việc/case study. Không trả section tên Demo.",
  "features.alternating là variant hợp lệ và có thể dùng khi brief cần nhịp nội dung xen kẽ.",
  "Không tự gán asset, không tạo URL ảnh và không sinh HTML/CSS/JS tự do.",
  "deviationReason phải giải thích ngắn gọn vì sao Blueprint cuối bám hoặc lệch template.",
  "Chỉ trả một JSON object, không markdown và không giải thích bên ngoài JSON.",
].join(" ");

function templateBaseline(landing: LandingData) {
  const visibleSections = landing.sectionOrder.filter(
    (section) =>
      section !== "customBlock" && !landing.hiddenSections.includes(section)
  );
  return {
    visibleSections,
    sectionVariants: landing.design?.sectionVariants,
    typography: landing.design?.typography,
    density: landing.design?.density,
    radius: landing.design?.radius,
    palette: landing.palette,
  };
}

export async function runBlueprintPlanningAgent(
  input: BlueprintPlanningAgentInput
): Promise<BlueprintPlanningResult> {
  const sectionCatalog = Object.fromEntries(
    landingSectionTypes
      .filter((section) => section !== "customBlock")
      .map((section) => [section, landingSectionVariantOptions[section]])
  );
  const context = [
    `User Brief gốc:\n${input.prompt}`,
    `Business Intent:\n${JSON.stringify(input.brief)}`,
    `Intent Planner:\n${JSON.stringify({
      creativeFreedom: input.plan.creativeFreedom,
      pagePurpose: input.plan.pagePurpose,
      businessType: input.plan.businessType,
      audience: input.plan.audience,
      primaryGoal: input.plan.primaryGoal,
      tone: input.plan.tone,
      visualDirection: input.plan.visualDirection,
      recommendedSections: input.plan.recommendedSections,
      sectionVariants: input.plan.sectionVariants,
      typography: input.plan.typography,
      density: input.plan.density,
      radius: input.plan.radius,
    })}`,
    `Template được chọn làm baseline:\n${JSON.stringify({
      ...input.templateSelection,
      baseline: templateBaseline(input.templateLanding),
    })}`,
    `Journey fallback theo mục tiêu:\n${JSON.stringify(
      resolveLandingRecipe(input.plan)
    )}`,
    `Component catalog:\n${JSON.stringify(sectionCatalog)}`,
    `Schema đầu ra:
{
  "creativeFreedom": "${input.plan.creativeFreedom}",
  "templateFit": "strong | partial | weak",
  "deviationReason": "Lý do thiết kế ngắn gọn",
  "sections": ["hero", "...", "finalCta"],
  "sectionVariants": { "hero": "split", "features": "alternating" },
  "typography": { "heading": "editorial | modern | friendly", "body": "sans | humanist" },
  "density": "compact | comfortable | spacious",
  "radius": "none | sm | md | lg | full",
  "palette": { "ink": "#112233", "paper": "#ffffff", "accent": "#ff5500", "soft": "#eef1f0", "line": "#ccd2d0" },
  "visualDirection": {
    "mood": ["từ khóa"],
    "typography": "mô tả typography",
    "density": "compact | balanced | airy",
    "imageStyle": "hướng hình ảnh",
    "radius": "none | small | medium | large",
    "contrast": "soft | balanced | high"
  }
}`,
  ].join("\n\n");

  let repair = "";
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let output = "";
    try {
      output = await runAiChatTool({
        providerUrl: input.providerUrl,
        apiKey: input.apiKey,
        modelName: input.modelName,
        fallbackProviders: input.fallbackProviders,
        onUsage: input.onUsage,
        jsonMode: true,
        temperature: 0.25,
        systemPrompt:
          attempt === 1
            ? blueprintPlannerInstructions
            : `${blueprintPlannerInstructions} Phản hồi trước sai schema. Hãy sửa đúng lỗi và chỉ trả JSON.`,
        userPrompt: [context, repair].filter(Boolean).join("\n\n"),
      });
      const rawDecision = extractAiJson(
        output,
        "Blueprint Planner không trả về JSON hợp lệ."
      );
      return {
        decision: parseBlueprintDecision(
          rawDecision,
          input.plan.creativeFreedom
        ),
        usedFallback: false,
      };
    } catch (error) {
      lastError = error;
      repair = [
        output ? `Phản hồi trước:\n${output.slice(0, 5_000)}` : "",
        `Lỗi schema:\n${
          error instanceof Error ? error.message : "Không xác định"
        }`,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  }

  return {
    decision: createTemplateBaselineDecision({
      plan: input.plan,
      templateLanding: input.templateLanding,
    }),
    usedFallback: true,
    warning: `Blueprint Planner dùng template baseline sau khi không thể tạo Blueprint hợp lệ: ${
      lastError instanceof Error ? lastError.message : "lỗi không xác định"
    }`,
  };
}

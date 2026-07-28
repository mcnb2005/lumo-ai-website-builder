import type { LandingData } from "../../landing-data";
import {
  landingBuilderSkill,
  parseLandingJson,
} from "../skills/landing-builder-skill";
import { resolveRuntimeSkill } from "../skills/runtime-skills";
import { runAiChatTool } from "../tools/ai-chat-tool";

type WebsiteBuilderAgentInput = {
  prompt: string;
  current: LandingData;
  providerUrl: string;
  modelName: string;
  apiKey?: string;
  createDemoLanding: (prompt: string, current: LandingData) => LandingData;
};

export type WebsiteBuilderAgentResult = {
  landing: LandingData;
  message: string;
  mode: "ai" | "demo";
  skill: {
    id: string;
    version: string;
  };
  runtimeSkill?: {
    id: string;
    version: string;
    name: string;
    description: string;
  };
};

export async function runWebsiteBuilderAgent(
  input: WebsiteBuilderAgentInput
): Promise<WebsiteBuilderAgentResult> {
  const runtimeSkill = resolveRuntimeSkill(input.prompt);

  if (!input.apiKey) {
    return {
      landing: input.createDemoLanding(input.prompt, input.current),
      message:
        "Mình đã áp dụng yêu cầu vào bản thiết kế. Bạn có thể tiếp tục mô tả ngành, màu sắc, tiêu đề hoặc CTA muốn thay đổi.",
      mode: "demo",
      skill: {
        id: landingBuilderSkill.id,
        version: landingBuilderSkill.version,
      },
      runtimeSkill: runtimeSkill
        ? {
            id: runtimeSkill.id,
            version: runtimeSkill.version,
            name: runtimeSkill.name,
            description: runtimeSkill.description,
          }
        : undefined,
    };
  }

  const output = await runAiChatTool({
    providerUrl: input.providerUrl,
    apiKey: input.apiKey,
    modelName: input.modelName,
    systemPrompt: landingBuilderSkill.instructions,
    userPrompt: [
      `Yêu cầu của người dùng:\n${input.prompt}`,
      `Landing page hiện tại:\n${JSON.stringify(input.current)}`,
    ].join("\n\n"),
  });

  return {
    landing: parseLandingJson(output, input.current),
    message:
      "Mình đã viết lại nội dung và cập nhật thiết kế theo yêu cầu. Hãy tiếp tục nhắn nếu bạn muốn tinh chỉnh.",
    mode: "ai",
    skill: {
      id: landingBuilderSkill.id,
      version: landingBuilderSkill.version,
    },
    runtimeSkill: runtimeSkill
      ? {
          id: runtimeSkill.id,
          version: runtimeSkill.version,
          name: runtimeSkill.name,
          description: runtimeSkill.description,
        }
      : undefined,
  };
}

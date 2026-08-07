import { runAiChatTool, type AiChatProvider } from "../tools/ai-chat-tool";

type ReferenceImageAnalysisInput = {
  imageDataUrl: string;
  userPrompt: string;
  providerUrl: string;
  modelName: string;
  apiKey: string;
  fallbackProviders?: AiChatProvider[];
};

const analysisInstructions = [
  "You are a visual analyst for a landing-page builder.",
  "Analyze the reference image to guide a new landing page inspired by its layout and style, never a pixel-perfect copy.",
  "Do not copy logos, brand names, written content, product images, or other proprietary assets from the reference.",
  "Describe the visual hierarchy, form placement and reasonable fields, CTA, spacing, colors, typography, and overall tone.",
  "Recommend a responsive, independent landing page for desktop and mobile.",
  "Return a concise but concrete brief in Vietnamese. Do not use markdown or JSON.",
].join(" ");

export async function analyzeReferenceImage(
  input: ReferenceImageAnalysisInput
) {
  const result = await runAiChatTool({
    providerUrl: input.providerUrl,
    modelName: input.modelName,
    apiKey: input.apiKey,
    fallbackProviders: input.fallbackProviders,
    systemPrompt: analysisInstructions,
    userPrompt: [
      "Analyze this reference image to guide a landing page.",
      input.userPrompt
        ? `User context: ${input.userPrompt}`
        : "There is no additional user description. Infer the design direction from the image.",
    ].join("\n\n"),
    imageInputs: [{ dataUrl: input.imageDataUrl, detail: "high" }],
    temperature: 0.2,
    maxAttempts: 2,
  });

  return result.slice(0, 6_000);
}

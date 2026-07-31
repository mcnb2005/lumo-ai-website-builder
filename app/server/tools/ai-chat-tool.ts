export type AiChatToolInput = {
  providerUrl: string;
  apiKey: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
};

type ChatCompletionPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  choices?: Array<{
    message?: { content?: string | null };
  }>;
};

export async function runAiChatTool(input: AiChatToolInput) {
  const response = await fetch(
    `${input.providerUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.modelName,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Nhà cung cấp AI trả về lỗi ${response.status}: ${detail.slice(0, 180)}`
    );
  }

  const payload = (await response.json()) as ChatCompletionPayload;
  if (payload.error) {
    throw new Error(
      `Nhà cung cấp AI báo lỗi: ${
        payload.error.message ||
        payload.error.type ||
        payload.error.code ||
        "Không xác định"
      }`
    );
  }
  const output = payload.choices?.[0]?.message?.content?.trim();
  if (!output) {
    throw new Error("Nhà cung cấp AI không trả về nội dung.");
  }
  return output;
}

export type AiChatProvider = {
  providerUrl: string;
  apiKey: string;
  modelName: string;
  name?: string;
};

export type AiImageInput = {
  dataUrl: string;
  detail?: "auto" | "low" | "high";
};

export type AiChatUsage = {
  providerName: string;
  modelName: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  usageReported: boolean;
};

export type AiChatUsageReporter = (usage: AiChatUsage) => void;

export type AiChatToolInput = AiChatProvider & {
  systemPrompt: string;
  userPrompt: string;
  imageInputs?: AiImageInput[];
  temperature?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  jsonMode?: boolean;
  fallbackProviders?: AiChatProvider[];
  onUsage?: AiChatUsageReporter;
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
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

const retryableStatuses = new Set([429, 500, 502, 503, 504]);

class AiProviderRequestError extends Error {
  status?: number;
  retryable: boolean;
  retryAfterMs?: number;

  constructor(
    message: string,
    options?: { status?: number; retryable?: boolean; retryAfterMs?: number }
  ) {
    super(message);
    this.name = "AiProviderRequestError";
    this.status = options?.status;
    this.retryable = Boolean(options?.retryable);
    this.retryAfterMs = options?.retryAfterMs;
  }
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

function parseRetryAfter(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1_000, 10_000);
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(Math.max(date - Date.now(), 0), 10_000);
    }
  }
  return undefined;
}

function retryDelay(attempt: number, retryAfterMs?: number) {
  if (typeof retryAfterMs === "number") return retryAfterMs;
  const exponential = 750 * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(exponential + jitter, 5_000);
}

function providerEndpoint(providerUrl: string) {
  const normalized = providerUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    throw new AiProviderRequestError(
      "URL nhà cung cấp AI không hợp lệ. URL phải bắt đầu bằng http:// hoặc https://."
    );
  }
  return /\/chat\/completions$/i.test(normalized)
    ? normalized
    : `${normalized}/chat/completions`;
}

function providerIdentity(provider: AiChatProvider, index: number) {
  let host = provider.providerUrl;
  try {
    host = new URL(provider.providerUrl).host || provider.providerUrl;
  } catch {
    // requestProvider will report the invalid URL with an actionable message.
  }
  return (
    provider.name?.trim() ||
    `${index === 0 ? "chính" : `dự phòng ${index}`} (${host} / ${provider.modelName})`
  );
}

function isRetryablePayloadError(payload: ChatCompletionPayload) {
  const detail = [
    payload.error?.message,
    payload.error?.type,
    payload.error?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(?:429|500|502|503|504|rate.?limit|overload|internal|unavailable|timeout|api_error)/i.test(
    detail
  );
}

function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

export function normalizeAiChatUsage(
  payload: ChatCompletionPayload,
  provider: AiChatProvider
): AiChatUsage {
  const promptTokens = tokenCount(
    payload.usage?.prompt_tokens ?? payload.usage?.input_tokens
  );
  const completionTokens = tokenCount(
    payload.usage?.completion_tokens ?? payload.usage?.output_tokens
  );
  const totalTokens =
    tokenCount(payload.usage?.total_tokens) ??
    (promptTokens !== null && completionTokens !== null
      ? promptTokens + completionTokens
      : null);

  return {
    providerName: provider.name?.trim() || "AI",
    modelName: payload.model?.trim() || provider.modelName,
    promptTokens,
    completionTokens,
    totalTokens,
    usageReported: Boolean(payload.usage),
  };
}

async function requestProvider(
  provider: AiChatProvider,
  input: AiChatToolInput,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    const imageInputs = input.imageInputs?.filter((image) => image.dataUrl) || [];
    const userContent = imageInputs.length
      ? [
          { type: "text", text: input.userPrompt },
          ...imageInputs.map((image) => ({
            type: "image_url",
            image_url: {
              url: image.dataUrl,
              detail: image.detail || "auto",
            },
          })),
        ]
      : input.userPrompt;
    response = await fetch(providerEndpoint(provider.providerUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.modelName,
        ...(input.jsonMode
          ? { response_format: { type: "json_object" } }
          : {}),
        ...(typeof input.temperature === "number"
          ? { temperature: input.temperature }
          : {}),
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AiProviderRequestError(
        `Nhà cung cấp AI không phản hồi sau ${Math.round(timeoutMs / 1_000)} giây.`,
        { retryable: true }
      );
    }
    throw new AiProviderRequestError(
      error instanceof Error
        ? `Không thể kết nối nhà cung cấp AI: ${error.message}`
        : "Không thể kết nối nhà cung cấp AI.",
      { retryable: true }
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new AiProviderRequestError(
      `Nhà cung cấp AI trả về lỗi ${response.status}: ${detail.slice(0, 180)}`,
      {
        status: response.status,
        retryable: retryableStatuses.has(response.status),
        retryAfterMs: parseRetryAfter(response),
      }
    );
  }

  let payload: ChatCompletionPayload;
  try {
    payload = (await response.json()) as ChatCompletionPayload;
  } catch {
    throw new AiProviderRequestError(
      "Nhà cung cấp AI trả về dữ liệu không phải JSON hợp lệ.",
      { retryable: true }
    );
  }
  if (payload.error) {
    throw new AiProviderRequestError(
      `Nhà cung cấp AI báo lỗi: ${
        payload.error.message ||
        payload.error.type ||
        payload.error.code ||
        "Không xác định"
      }`,
      { retryable: isRetryablePayloadError(payload) }
    );
  }
  const output = payload.choices?.[0]?.message?.content?.trim();
  if (!output) {
    throw new AiProviderRequestError("Nhà cung cấp AI không trả về nội dung.");
  }
  input.onUsage?.(normalizeAiChatUsage(payload, provider));
  return output;
}

export async function runAiChatTool(input: AiChatToolInput) {
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 60_000);
  const maxAttempts = Math.min(5, Math.max(1, input.maxAttempts ?? 3));
  const providers = [
    {
      providerUrl: input.providerUrl,
      apiKey: input.apiKey,
      modelName: input.modelName,
      name: input.name || "AI chính",
    },
    ...(input.fallbackProviders || []),
  ].filter(
    (provider, index, all) =>
      Boolean(provider.providerUrl && provider.apiKey && provider.modelName) &&
      all.findIndex(
        (candidate) =>
          candidate.providerUrl.trim().replace(/\/+$/, "") ===
            provider.providerUrl.trim().replace(/\/+$/, "") &&
          candidate.modelName === provider.modelName &&
          candidate.apiKey === provider.apiKey
      ) === index
  );
  if (!providers.length) {
    throw new Error(
      "Chưa cấu hình nhà cung cấp AI. Hãy kiểm tra AI_PROVIDER_URL, AI_MODEL_NAME và AI_API_KEY."
    );
  }
  const failures: string[] = [];

  for (const [providerIndex, provider] of providers.entries()) {
    let providerError: unknown = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await requestProvider(provider, input, timeoutMs);
      } catch (error) {
        providerError = error;
        const retryable =
          error instanceof AiProviderRequestError && error.retryable;
        if (!retryable || attempt >= maxAttempts) break;
        await wait(
          retryDelay(
            attempt,
            error instanceof AiProviderRequestError
              ? error.retryAfterMs
              : undefined
          )
        );
      }
    }
    failures.push(
      `${providerIdentity(provider, providerIndex)}: ${
        providerError instanceof Error
          ? providerError.message
          : "Lỗi không xác định"
      }`
    );
  }

  if (failures.length === 1) {
    throw new Error(failures[0]);
  }
  throw new Error(
    `Đã thử ${failures.length} cấu hình AI nhưng đều thất bại. ${failures.join(" | ")}`
  );
}

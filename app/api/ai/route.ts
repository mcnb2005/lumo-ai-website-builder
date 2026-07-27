import { ensureDatabase, getD1, getRuntimeEnv } from "../../../db";
import { getChatGPTUser } from "../../chatgpt-auth";
import { defaultLanding, type LandingData } from "../../landing-data";
import { runWebsiteBuilderAgent } from "../../server/agents/website-builder-agent";
import { isLandingData } from "../../server/skills/landing-builder-skill";
import { createDemoLanding } from "../../server/tools/demo-landing-tool";

async function enforceUsageLimit(request: Request) {
  await ensureDatabase();
  const identity = await getChatGPTUser();
  const forwardedIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  const subject = identity?.email || forwardedIp;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subject)
  );
  const key = Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const period = new Date().toISOString().slice(0, 10);
  const limit = identity ? 100 : 10;
  const db = getD1();
  const existing = await db
    .prepare("SELECT period, count FROM ai_usage WHERE key = ?")
    .bind(key)
    .first<{ period: string; count: number }>();
  const currentCount = existing?.period === period ? existing.count : 0;

  if (currentCount >= limit) {
    throw new Error(
      identity
        ? "Bạn đã dùng hết lượt AI hôm nay. Hãy quay lại vào ngày mai."
        : "Bạn đã dùng hết 10 lượt thử hôm nay. Đăng nhập để tiếp tục."
    );
  }

  await db
    .prepare(
      `INSERT INTO ai_usage (key, period, count, updated_at)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         period = excluded.period,
         count = CASE
           WHEN ai_usage.period = excluded.period THEN ai_usage.count + 1
           ELSE 1
         END,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(key, period)
    .run();
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      prompt?: string;
      current?: LandingData;
    };
    const prompt = payload.prompt?.trim();
    const current = isLandingData(payload.current)
      ? payload.current
      : defaultLanding;

    if (!prompt) {
      return Response.json(
        { error: "Hãy nhập yêu cầu chỉnh sửa." },
        { status: 400 }
      );
    }

    await enforceUsageLimit(request);

    const runtime = getRuntimeEnv();
    const result = await runWebsiteBuilderAgent({
      prompt,
      current,
      providerUrl:
        runtime.AI_PROVIDER_URL || "https://api.openai.com/v1",
      modelName:
        runtime.AI_MODEL_NAME || runtime.OPENAI_MODEL || "gpt-5.6-terra",
      apiKey: runtime.AI_API_KEY || runtime.OPENAI_API_KEY,
      createDemoLanding,
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể xử lý yêu cầu AI.";
    return Response.json(
      { error: message },
      { status: message.includes("lượt") ? 429 : 500 }
    );
  }
}

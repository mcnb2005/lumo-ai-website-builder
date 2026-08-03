import { ensureDatabase, getD1, getRuntimeEnv } from "../../../db";
import {
  defaultLanding,
  landingSectionTypes,
  type LandingData,
  type LandingSectionType,
} from "../../landing-data";
import { getCurrentDatabaseUser } from "../../server-user";
import { runWebsiteBuilderAgent } from "../../server/agents/website-builder-agent";
import { isLandingData } from "../../server/skills/landing-builder-skill";
import { createDemoLanding } from "../../server/tools/demo-landing-tool";
import type { BuilderStreamEvent } from "../../builder-generation";

function streamEvent(event: BuilderStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Không thể xử lý yêu cầu AI.";
}

async function enforceUsageLimit(request: Request) {
  await ensureDatabase();
  const identity = await getCurrentDatabaseUser();
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
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để sử dụng AI tạo landing page." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as {
      prompt?: string;
      current?: LandingData;
      selectedSection?: LandingSectionType | null;
      history?: Array<{
        role?: "user" | "assistant";
        content?: string;
      }>;
    };
    const prompt = payload.prompt?.trim();
    const current = isLandingData(payload.current)
      ? payload.current
      : defaultLanding;
    const selectedSection =
      typeof payload.selectedSection === "string" &&
      landingSectionTypes.includes(payload.selectedSection)
        ? payload.selectedSection
        : null;
    const history = Array.isArray(payload.history)
      ? payload.history
          .filter(
            (
              turn
            ): turn is {
              role: "user" | "assistant";
              content: string;
            } =>
              (turn?.role === "user" || turn?.role === "assistant") &&
              typeof turn.content === "string" &&
              Boolean(turn.content.trim())
          )
          .slice(-8)
      : [];

    if (!prompt) {
      return Response.json(
        { error: "Hãy nhập yêu cầu chỉnh sửa." },
        { status: 400 }
      );
    }

    await enforceUsageLimit(request);

    const runtime = getRuntimeEnv();
    const agentInput = {
      prompt,
      current,
      selectedSection,
      history,
      providerUrl:
        runtime.AI_PROVIDER_URL || "https://api.openai.com/v1",
      modelName:
        runtime.AI_MODEL_NAME || runtime.OPENAI_MODEL || "gpt-5.6-terra",
      apiKey: runtime.AI_API_KEY || runtime.OPENAI_API_KEY,
      createDemoLanding,
    };

    if (request.headers.get("accept")?.includes("text/event-stream")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (event: BuilderStreamEvent) => {
            controller.enqueue(encoder.encode(streamEvent(event)));
          };

          void runWebsiteBuilderAgent({
            ...agentInput,
            progress: send,
          })
            .then((result) => {
              send({
                type: "status",
                stage: "completed",
                message: "Landing page đã được cập nhật.",
              });
              send({ type: "complete", stage: "completed", result });
            })
            .catch((error) => {
              send({
                type: "error",
                stage: "failed",
                message: errorMessage(error),
              });
            })
            .finally(() => controller.close());
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    const result = await runWebsiteBuilderAgent(agentInput);

    return Response.json(result);
  } catch (error) {
    const message = errorMessage(error);
    return Response.json(
      { error: message },
      { status: message.includes("lượt") ? 429 : 500 }
    );
  }
}

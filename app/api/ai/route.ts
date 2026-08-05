import { and, eq } from "drizzle-orm";
import {
  ensureDatabase,
  getAssetsBucket,
  getD1,
  getDb,
  getRuntimeEnv,
} from "../../../db";
import { assets } from "../../../db/schema";
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
import type {
  BuilderStreamEvent,
  PipelineResumeState,
} from "../../builder-generation";
import { getPipelineErrorDetails } from "../../server/agents/pipeline-stage-error";
import { analyzeReferenceImage } from "../../server/agents/reference-image-analysis";

function streamEvent(event: BuilderStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Không thể xử lý yêu cầu AI.";
}

function toBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function loadReferenceImageDataUrl(userId: string, assetId: string) {
  await ensureDatabase();
  const [asset] = await getDb()
    .select({
      objectKey: assets.objectKey,
      contentType: assets.contentType,
      size: assets.size,
    })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.ownerId, userId)))
    .limit(1);
  if (!asset) {
    throw new Error("Không tìm thấy ảnh tham chiếu trong thư viện của bạn.");
  }
  if (!asset.contentType.startsWith("image/") || asset.size > 5 * 1024 * 1024) {
    throw new Error("Ảnh tham chiếu phải là ảnh tối đa 5 MB.");
  }

  const object = await getAssetsBucket().get(asset.objectKey);
  if (!object) {
    throw new Error("Không thể mở ảnh tham chiếu đã chọn.");
  }
  const data = new Uint8Array(await object.arrayBuffer());
  return `data:${asset.contentType};base64,${toBase64(data)}`;
}

function referencePrompt(prompt: string, analysis: string) {
  return [
    "Tạo hoặc cập nhật landing page dựa trên brief ảnh tham chiếu bên dưới.",
    "Chỉ lấy cảm hứng từ bố cục và phong cách; không sao chép logo, nội dung hay tài sản thương hiệu trong ảnh.",
    prompt,
    `Brief anh tham chieu:\n${analysis}`,
  ]
    .filter(Boolean)
    .join("\n\n");
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
      referenceAssetId?: string;
      current?: LandingData;
      selectedSection?: LandingSectionType | null;
      history?: Array<{
        role?: "user" | "assistant";
        content?: string;
      }>;
      resume?: PipelineResumeState;
    };
    const prompt = payload.prompt?.trim();
    const referenceAssetId = payload.referenceAssetId?.trim();
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
    if (!prompt && !referenceAssetId) {
      return Response.json(
        { error: "Hãy nhập yêu cầu chỉnh sửa." },
        { status: 400 }
      );
    }

    await enforceUsageLimit(request);

    const runtime = getRuntimeEnv();
    const fallbackProviders =
      runtime.AI_FALLBACK_PROVIDER_URL &&
      runtime.AI_FALLBACK_MODEL_NAME &&
      runtime.AI_FALLBACK_API_KEY
        ? [
            {
              name: "AI dự phòng",
              providerUrl: runtime.AI_FALLBACK_PROVIDER_URL,
              modelName: runtime.AI_FALLBACK_MODEL_NAME,
              apiKey: runtime.AI_FALLBACK_API_KEY,
            },
          ]
        : undefined;
    const providerUrl = runtime.AI_PROVIDER_URL || "https://api.openai.com/v1";
    const modelName =
      runtime.AI_MODEL_NAME || runtime.OPENAI_MODEL || "gpt-5.6-terra";
    const apiKey = runtime.AI_API_KEY || runtime.OPENAI_API_KEY;
    if (referenceAssetId && !apiKey) {
      throw new Error("Cần cấu hình khóa API có hỗ trợ phân tích ảnh tham chiếu.");
    }
    const sourcePrompt =
      prompt || "Tạo một landing page mới dựa trên ảnh tham chiếu đã chọn.";
    const imageAnalysis =
      referenceAssetId && apiKey
        ? await analyzeReferenceImage({
            imageDataUrl: await loadReferenceImageDataUrl(user.id, referenceAssetId),
            userPrompt: sourcePrompt,
            providerUrl,
            modelName,
            apiKey,
            fallbackProviders,
          })
        : "";
    const agentPrompt = imageAnalysis
      ? referencePrompt(sourcePrompt, imageAnalysis)
      : sourcePrompt;
    const resume =
      payload.resume?.prompt?.trim() === agentPrompt &&
      isLandingData(payload.resume.landing)
        ? {
            prompt: payload.resume.prompt,
            landing: payload.resume.landing,
            completedSections: Array.isArray(payload.resume.completedSections)
              ? payload.resume.completedSections.filter(
                  (section, index, all): section is LandingSectionType =>
                    landingSectionTypes.includes(section) &&
                    all.indexOf(section) === index
                )
              : [],
          }
        : undefined;
    const agentInput = {
      prompt: agentPrompt,
      current,
      selectedSection,
      history,
      providerUrl,
      modelName,
      apiKey,
      fallbackProviders,
      resume,
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
              const pipeline = getPipelineErrorDetails(error);
              send({
                type: "error",
                stage: "failed",
                message: errorMessage(error),
                pipelineStage: pipeline?.pipelineStage,
                resume: pipeline?.resume,
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
    const pipeline = getPipelineErrorDetails(error);
    return Response.json(
      {
        error: message,
        pipelineStage: pipeline?.pipelineStage,
        resume: pipeline?.resume,
      },
      { status: message.includes("lượt") ? 429 : 500 }
    );
  }
}

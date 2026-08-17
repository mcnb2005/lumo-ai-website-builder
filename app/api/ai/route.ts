import { and, desc, eq } from "drizzle-orm";
import {
  ensureDatabase,
  getAssetsBucket,
  getDb,
  getRuntimeEnv,
} from "../../../db";
import { assets } from "../../../db/schema";
import {
  defaultLanding,
  landingSectionTypes,
  type LandingData,
  type LandingImageAsset,
  type LandingSectionType,
} from "../../landing-data";
import {
  forbiddenCompanyResponse,
  getAuthenticatedCompanyContext,
  unauthorizedCompanyResponse,
} from "../../company-access";
import { canCreateLanding } from "../../company-data";
import { runWebsiteBuilderAgent } from "../../server/agents/website-builder-agent";
import { isLandingData } from "../../server/skills/landing-builder-skill";
import { createDemoLanding } from "../../server/tools/demo-landing-tool";
import type {
  BuilderStreamEvent,
  PipelineResumeState,
} from "../../builder-generation";
import { getPipelineErrorDetails } from "../../server/agents/pipeline-stage-error";
import { analyzeReferenceImage } from "../../server/agents/reference-image-analysis";
import {
  AiUsageLimitError,
  assertAiUsageAvailable,
  recordSuccessfulAiUsage,
} from "../../server/ai-usage";
import type { AiChatUsage } from "../../server/tools/ai-chat-tool";

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
  const data = new Uint8Array(await new Response(object.body).arrayBuffer());
  return `data:${asset.contentType};base64,${toBase64(data)}`;
}

async function listProjectAssets(
  userId: string,
  projectId: string
): Promise<LandingImageAsset[]> {
  await ensureDatabase();
  const rows = await getDb()
    .select({ id: assets.id, filename: assets.filename })
    .from(assets)
    .where(and(eq(assets.projectId, projectId), eq(assets.ownerId, userId)))
    .orderBy(desc(assets.createdAt));
  return rows.map((asset) => ({
    id: asset.id,
    url: `/api/assets/${asset.id}`,
    alt: asset.filename.replace(/\.[^.]+$/, ""),
  }));
}

function referencePrompt(prompt: string, analysis: string) {
  return [
    "Tạo hoặc cập nhật landing page dựa trên brief ảnh tham chiếu bên dưới.",
    "Chỉ lấy cảm hứng từ bố cục và phong cách; không sao chép logo, nội dung hay tài sản thương hiệu trong ảnh.",
    "Ngôn ngữ của toàn bộ nội dung đầu ra phải theo yêu cầu gốc của người dùng, không theo ngôn ngữ của phần hướng dẫn hoặc brief ảnh.",
    `Yêu cầu gốc của người dùng:\n${prompt}`,
    `Brief anh tham chieu:\n${analysis}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedCompanyContext();
    if (!auth) return unauthorizedCompanyResponse();
    if (
      auth.user.mustChangePassword ||
      !canCreateLanding(auth.company.role)
    ) {
      return forbiddenCompanyResponse();
    }
    const user = auth.user;

    const payload = (await request.json()) as {
      prompt?: string;
      projectId?: string;
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
    const projectId = payload.projectId?.trim();
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

    const usageIdentity = {
      userId: user.id,
      email: user.email,
      companyId: auth.company.companyId,
    };
    await assertAiUsageAvailable(usageIdentity);
    const usageCalls: AiChatUsage[] = [];
    const onUsage = (usage: AiChatUsage) => usageCalls.push(usage);

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
            onUsage,
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
      availableAssets: projectId
        ? await listProjectAssets(user.id, projectId)
        : [],
      selectedSection,
      history,
      providerUrl,
      modelName,
      apiKey,
      fallbackProviders,
      onUsage,
      resume,
      createDemoLanding,
    };

    const finalizeUsage = async () => {
      if (!usageCalls.length) return;
      try {
        await recordSuccessfulAiUsage({
          ...usageIdentity,
          projectId: projectId || null,
          calls: usageCalls,
        });
      } catch {
        // The completed AI result remains available if metering persistence fails.
      }
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
            .then(async (result) => {
              await finalizeUsage();
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
    await finalizeUsage();

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
      { status: error instanceof AiUsageLimitError ? 429 : 500 }
    );
  }
}

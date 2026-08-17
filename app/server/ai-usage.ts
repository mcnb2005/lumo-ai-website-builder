import { ensureDatabase, getD1 } from "../../db";
import type { AiUsageSummary } from "../ai-usage-contract";
import type { AiChatUsage } from "./tools/ai-chat-tool";

export const SIGNED_IN_AI_DAILY_LIMIT = 100;

type AiUsageIdentity = {
  userId: string;
  email: string;
  companyId: string;
};

type RecordAiUsageInput = AiUsageIdentity & {
  projectId: string | null;
  calls: AiChatUsage[];
};

type UsageEventRow = {
  providerModels: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  tokenUsageComplete: number;
  costMicros: number | null;
  createdAt: string;
};

export class AiUsageLimitError extends Error {
  constructor() {
    super("Bạn đã dùng hết lượt AI hôm nay. Hãy quay lại sau khi hạn mức được đặt lại.");
    this.name = "AiUsageLimitError";
  }
}

export function aiUsagePeriod(now = new Date()) {
  const period = now.toISOString().slice(0, 10);
  const resetAt = new Date(`${period}T00:00:00.000Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { period, resetAt: resetAt.toISOString() };
}

export async function aiUsageKey(email: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.trim().toLowerCase())
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseModels(value: string) {
  try {
    const parsed = JSON.parse(value) as Array<{ model?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((item) =>
            typeof item?.model === "string" ? item.model.trim() : ""
          )
          .filter(Boolean)
      )
    );
  } catch {
    return [];
  }
}

function sumComplete(
  calls: AiChatUsage[],
  field: "promptTokens" | "completionTokens" | "totalTokens"
) {
  const values = calls.map((call) => call[field]);
  if (!values.length || values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value || 0), 0);
}

async function readSummary(identity: AiUsageIdentity): Promise<AiUsageSummary> {
  await ensureDatabase();
  const key = await aiUsageKey(identity.email);
  const { period, resetAt } = aiUsagePeriod();
  const db = getD1();
  const [aggregate, latest] = await Promise.all([
    db
      .prepare("SELECT period, count FROM ai_usage WHERE key = ?")
      .bind(key)
      .first<{ period: string; count: number }>(),
    db
      .prepare(
        `SELECT
           provider_models AS providerModels,
           prompt_tokens AS promptTokens,
           completion_tokens AS completionTokens,
           total_tokens AS totalTokens,
           token_usage_complete AS tokenUsageComplete,
           cost_micros AS costMicros,
           created_at AS createdAt
         FROM ai_usage_events
         WHERE key = ? AND period = ?
         ORDER BY created_at DESC
         LIMIT 1`
      )
      .bind(key, period)
      .first<UsageEventRow>(),
  ]);
  const used = aggregate?.period === period ? Number(aggregate.count || 0) : 0;

  return {
    period,
    used,
    limit: SIGNED_IN_AI_DAILY_LIMIT,
    remaining: Math.max(0, SIGNED_IN_AI_DAILY_LIMIT - used),
    resetAt,
    latest: latest
      ? {
          models: parseModels(latest.providerModels),
          promptTokens: latest.promptTokens,
          completionTokens: latest.completionTokens,
          totalTokens: latest.totalTokens,
          tokenUsageComplete: Boolean(latest.tokenUsageComplete),
          costMicros: latest.costMicros,
          createdAt: latest.createdAt,
        }
      : null,
  };
}

export async function getAiUsageSummary(identity: AiUsageIdentity) {
  return readSummary(identity);
}

export async function assertAiUsageAvailable(identity: AiUsageIdentity) {
  const summary = await readSummary(identity);
  if (summary.used >= summary.limit) throw new AiUsageLimitError();
  return summary;
}

export async function recordSuccessfulAiUsage(input: RecordAiUsageInput) {
  if (!input.calls.length) return getAiUsageSummary(input);

  await ensureDatabase();
  const key = await aiUsageKey(input.email);
  const { period } = aiUsagePeriod();
  const providerModels = JSON.stringify(
    input.calls.map((call) => ({
      provider: call.providerName,
      model: call.modelName,
    }))
  );
  const promptTokens = sumComplete(input.calls, "promptTokens");
  const completionTokens = sumComplete(input.calls, "completionTokens");
  const totalTokens = sumComplete(input.calls, "totalTokens");
  const tokenUsageComplete = input.calls.every(
    (call) => call.usageReported && call.totalTokens !== null
  );
  const db = getD1();

  await db.batch([
    db
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
      .bind(key, period),
    db
      .prepare(
        `INSERT INTO ai_usage_events
         (id, key, user_id, company_id, project_id, period, provider_models,
          prompt_tokens, completion_tokens, total_tokens, token_usage_complete,
          cost_micros, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`
      )
      .bind(
        crypto.randomUUID(),
        key,
        input.userId,
        input.companyId,
        input.projectId,
        period,
        providerModels,
        promptTokens,
        completionTokens,
        totalTokens,
        tokenUsageComplete ? 1 : 0
      ),
  ]);

  return getAiUsageSummary(input);
}

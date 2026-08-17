import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadAiChatTool() {
  const source = await readFile(
    new URL("../app/server/tools/ai-chat-tool.ts", import.meta.url),
    "utf8"
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  );
}

test("normalizes standard and input/output token usage without inventing cost", async () => {
  const { normalizeAiChatUsage } = await loadAiChatTool();
  const provider = {
    providerUrl: "https://example.com/v1",
    apiKey: "test",
    modelName: "configured-model",
    name: "AI chính",
  };

  assert.deepEqual(
    normalizeAiChatUsage(
      {
        model: "reported-model",
        usage: {
          prompt_tokens: 120,
          completion_tokens: 30,
          total_tokens: 150,
        },
      },
      provider
    ),
    {
      providerName: "AI chính",
      modelName: "reported-model",
      promptTokens: 120,
      completionTokens: 30,
      totalTokens: 150,
      usageReported: true,
    }
  );

  assert.deepEqual(
    normalizeAiChatUsage(
      { usage: { input_tokens: 8, output_tokens: 5 } },
      provider
    ),
    {
      providerName: "AI chính",
      modelName: "configured-model",
      promptTokens: 8,
      completionTokens: 5,
      totalTokens: 13,
      usageReported: true,
    }
  );
});

test("ships successful-only AI metering, daily summary and Studio usage feedback", async () => {
  const [schema, database, service, route, usageRoute, meter, studio, migration] =
    await Promise.all([
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/server/ai-usage.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/ai/usage/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/editor/AiUsageMeter.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../drizzle/0014_ai_usage_tracking.sql", import.meta.url),
        "utf8"
      ),
    ]);

  assert.match(schema, /export const aiUsageEvents/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS ai_usage_events/);
  assert.match(migration, /CREATE TABLE `ai_usage_events`/);
  assert.match(service, /SIGNED_IN_AI_DAILY_LIMIT = 100/);
  assert.match(service, /recordSuccessfulAiUsage/);
  assert.match(service, /cost_micros, created_at/);
  assert.match(service, /NULL, CURRENT_TIMESTAMP/);
  assert.doesNotMatch(route, /enforceUsageLimit/);
  assert.match(route, /assertAiUsageAvailable/);
  assert.match(route, /await finalizeUsage\(\)/);
  assert.match(usageRoute, /getAiUsageSummary/);
  assert.match(meter, /AI hôm nay/);
  assert.match(meter, /Đặt lại/);
  assert.match(meter, /Chi phí chưa có dữ liệu/);
  assert.match(studio, /setAiUsageRefreshKey/);
});

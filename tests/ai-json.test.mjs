import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadAiJsonModule() {
  const source = await readFile(
    new URL("../app/server/tools/ai-json.ts", import.meta.url),
    "utf8"
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  return import(moduleUrl);
}

test("extractAiJson accepts fenced JSON and ignores text after the object", async () => {
  const { extractAiJson } = await loadAiJsonModule();
  assert.deepEqual(
    extractAiJson('```json\n{"operations":[]}\n``` trailing text', "invalid"),
    { operations: [] }
  );
});

test("extractAiJson safely removes trailing commas outside strings", async () => {
  const { extractAiJson } = await loadAiJsonModule();
  assert.deepEqual(
    extractAiJson(
      '{"operations":[{"value":"keep ,} text",}],"explanation":"ok",}',
      "invalid"
    ),
    {
      operations: [{ value: "keep ,} text" }],
      explanation: "ok",
    }
  );
});

test("extractAiJson rejects structurally invalid JSON", async () => {
  const { extractAiJson } = await loadAiJsonModule();
  assert.throws(
    () =>
      extractAiJson(
        '{"operations":[}],"explanation":"broken"}',
        "invalid"
      ),
    /invalid/
  );
});

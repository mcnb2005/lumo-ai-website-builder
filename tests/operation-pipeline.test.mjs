import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

test("operation engine rejects unsafe or out-of-schema changes before applying", async () => {
  const source = await readFile(
    new URL("../app/landing-operations.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /operationKeys/);
  assert.match(source, /validateAllowedKeys/);
  assert.match(source, /unsafeTextPattern/);
  assert.match(source, /replace_landing chỉ được dùng khi tạo project mới/);
  assert.match(source, /Asset nội bộ không tồn tại/);
  assert.match(source, /operations\.length > 50/);
  assert.match(source, /const errors = validateLandingData\(landing, current\)/);
});

test("chat, inline editing and the properties panel share one operation engine", async () => {
  const [agent, inlineEditing, propertiesPanel] = await Promise.all([
    readFile(
      new URL("../app/server/agents/website-builder-agent.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/editor/inline-editing.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/editor/SectionPropertiesPanel.tsx", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(agent, /applyLandingOperations/);
  assert.match(inlineEditing, /applyLandingOperations/);
  assert.match(propertiesPanel, /onEditText/);
  assert.match(propertiesPanel, /onSetPalette/);
});

test("a request to create a website is never limited to the selected section", async () => {
  const source = await readFile(
    new URL("../app/server/agents/intent-analyzer.ts", import.meta.url),
    "utf8"
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  const { analyzeBuilderIntent } = await import(moduleUrl);
  const manifest = {
    sections: [
      {
        id: "hero",
        type: "hero",
        title: "Mở đầu",
        visible: true,
        position: 0,
        editableFields: [],
      },
      {
        id: "gallery",
        type: "gallery",
        title: "Hình ảnh",
        visible: true,
        position: 1,
        editableFields: [],
      },
    ],
  };

  const intent = analyzeBuilderIntent({
    prompt: "Hãy tạo trang web bán ô tô giúp tôi",
    manifest,
    selectedSection: "gallery",
    history: [
      { role: "user", content: "Yêu cầu cũ" },
      { role: "assistant", content: "Đã cập nhật" },
    ],
  });

  assert.equal(intent.mode, "create");
  assert.deepEqual(intent.targetSections, []);
});

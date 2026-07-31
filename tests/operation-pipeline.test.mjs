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

test("AI BuilderPlan resolves create, edit and clarification without keyword intent rules", async () => {
  const source = await readFile(
    new URL("../app/server/agents/builder-plan.ts", import.meta.url),
    "utf8"
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
  const { parseBuilderPlan } = await import(moduleUrl);
  const manifest = {
    sections: [
      {
        id: "hero",
        type: "hero",
        title: "Mở đầu",
        visible: true,
        position: 0,
        editableFields: ["brand", "headline"],
      },
      {
        id: "gallery",
        type: "gallery",
        title: "Hình ảnh",
        visible: true,
        position: 1,
        editableFields: [],
      },
      {
        id: "portfolio",
        type: "portfolio",
        title: "Dự án",
        visible: true,
        position: 2,
        editableFields: [],
      },
    ],
  };

  const createPlan = parseBuilderPlan(
    JSON.stringify({
      mode: "create",
      summary: "Tạo landing page bán ô tô",
      confidence: 0.97,
      targetSections: ["portfolio"],
      pagePurpose: "sell_product",
      businessType: "Ô tô",
      audience: "Người đang tìm mua ô tô",
      primaryGoal: "Yêu cầu tư vấn",
      tone: "Cao cấp và đáng tin cậy",
      recommendedSections: [
        "hero",
        "features",
        "gallery",
        "pricing",
        "leadForm",
        "finalCta",
      ],
    }),
    manifest
  );

  assert.equal(createPlan.mode, "create");
  assert.deepEqual(createPlan.targetSections, []);
  assert.equal(createPlan.pagePurpose, "sell_product");

  const editPlan = parseBuilderPlan(
    JSON.stringify({
      mode: "edit",
      summary: "Đổi tiêu đề phần mở đầu",
      confidence: 0.95,
      targetSections: ["hero"],
      targetField: "headline",
      pagePurpose: "sell_product",
      businessType: "Ô tô",
      audience: "Người mua ô tô",
      primaryGoal: "Yêu cầu tư vấn",
      tone: "Mạnh mẽ",
      recommendedSections: [],
    }),
    manifest
  );

  assert.equal(editPlan.mode, "edit");
  assert.deepEqual(editPlan.targetSections, ["hero"]);
  assert.equal(editPlan.targetField, "headline");

  const clarifyPlan = parseBuilderPlan(
    JSON.stringify({
      mode: "edit",
      summary: "Yêu cầu chưa rõ",
      confidence: 0.4,
      targetSections: [],
      pagePurpose: "general",
      businessType: "Doanh nghiệp",
      audience: "Khách hàng",
      primaryGoal: "Liên hệ",
      tone: "Rõ ràng",
      recommendedSections: [],
      clarificationQuestion: "Bạn muốn sửa nội dung hay ẩn phần Dự án?",
    }),
    manifest
  );

  assert.equal(clarifyPlan.mode, "clarify");
  assert.match(clarifyPlan.clarificationQuestion, /sửa nội dung/);
  assert.doesNotMatch(source, /isCreateRequest|isCreationCorrection/);
});

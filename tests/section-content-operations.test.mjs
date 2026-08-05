import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadOperationNormalizer() {
  const source = await readFile(
    new URL("../app/landing-operation-normalizer.ts", import.meta.url),
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

test("normalizes the real features Content Agent output to LandingOperation schema", async () => {
  const { normalizeLandingOperationInput } = await loadOperationNormalizer();
  const currentFeaturesSnapshot = {
    eyebrow: "Lợi ích nổi bật",
    headline: "Khác biệt có thể cảm nhận ngay.",
    items: [
      {
        number: "01",
        title: "Một nơi cho mọi ý tưởng",
        text: "Biến brief, tài liệu và phản hồi rời rạc thành một nguồn thông tin chung.",
      },
      {
        number: "02",
        title: "Nhịp làm việc tự động",
        text: "Giữ mọi người đúng tiến độ với quy trình linh hoạt và nhắc việc thông minh.",
      },
      {
        number: "03",
        title: "Hiệu quả nhìn thấy được",
        text: "Đo thời gian, chất lượng và tác động mà không cần thêm bảng tính.",
      },
    ],
  };
  const featuresManifest = {
    id: "features",
    type: "features",
    title: "Lợi ích",
    visible: true,
    position: 1,
    editableFields: [
      "featuresEyebrow",
      "featuresHeadline",
      "features.number",
      "features.title",
      "features.text",
    ],
  };
  const actualAiOutput = {
    operations: [
      {
        type: "update_text",
        field: "items[0].text",
        value: "Giúp da trở nên mịn màng và tươi sáng hơn",
      },
      {
        type: "update_text",
        field: "items[1].text",
        value: "Cải thiện tình trạng mụn và giảm viêm da",
      },
      {
        type: "update_text",
        field: "items[2].text",
        value:
          "Bảo vệ da khỏi tác động của môi trường và giảm dấu hiệu lão hóa",
      },
    ],
    explanation:
      "Cập nhật lợi ích của sản phẩm chăm sóc da để khách hàng hiểu rõ hơn về giá trị của sản phẩm",
  };

  assert.equal(currentFeaturesSnapshot.items.length, 3);
  assert.deepEqual(featuresManifest.editableFields, [
    "featuresEyebrow",
    "featuresHeadline",
    "features.number",
    "features.title",
    "features.text",
  ]);

  const normalized = normalizeLandingOperationInput(actualAiOutput, {
    mode: "edit",
    source: "ai",
    targetSection: "features",
    editableFields: featuresManifest.editableFields,
  });

  assert.deepEqual(normalized.operations[0], {
    type: "update_text",
    section: "features",
    field: "features.text",
    index: 0,
    value: "Giúp da trở nên mịn màng và tươi sáng hơn",
  });
  assert.deepEqual(normalized.operations[1], {
    type: "update_text",
    section: "features",
    field: "features.text",
    index: 1,
    value: "Cải thiện tình trạng mụn và giảm viêm da",
  });
  assert.deepEqual(normalized.operations[2], {
    type: "update_text",
    section: "features",
    field: "features.text",
    index: 2,
    value:
      "Bảo vệ da khỏi tác động của môi trường và giảm dấu hiệu lão hóa",
  });
});

test("does not guess an unsupported or ambiguous scoped field", async () => {
  const { normalizeLandingOperationInput } = await loadOperationNormalizer();
  const invalidOutput = {
    operations: [
      {
        type: "update_text",
        field: "items[0].unsupported",
        value: "Không được tự ánh xạ",
      },
    ],
  };

  const normalized = normalizeLandingOperationInput(invalidOutput, {
    mode: "edit",
    source: "ai",
    targetSection: "features",
    editableFields: [
      "featuresEyebrow",
      "featuresHeadline",
      "features.number",
      "features.title",
      "features.text",
    ],
  });

  assert.deepEqual(normalized.operations[0], {
    type: "update_text",
    section: "features",
    field: "items[0].unsupported",
    value: "Không được tự ánh xạ",
  });
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadSectionDraftModule() {
  const source = await readFile(
    new URL("../app/server/agents/section-draft.ts", import.meta.url),
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

const currentLanding = {
  pricingEyebrow: "Gói phù hợp",
  pricingHeadline: "Bắt đầu nhỏ. Lớn lên dễ dàng.",
  pricing: [
    {
      name: "Khởi đầu",
      price: "Miễn phí",
      description: "Dùng thử",
      features: ["Một project"],
      highlighted: false,
      cta: "Dùng thử",
    },
  ],
  portfolio: [],
  gallery: [],
};

test("compiles a pricing draft wrapper to the array required by replace_section", async () => {
  const { parseSectionDraftEnvelope, compileSectionDraftToOperations } =
    await loadSectionDraftModule();
  const aiOutput = {
    draft: {
      eyebrow: "Chọn gói phù hợp",
      headline: "Sở hữu chiếc xe dành cho bạn",
      items: [
        {
          name: "Tiêu chuẩn",
          price: "Liên hệ",
          description: "Tư vấn theo nhu cầu",
          features: ["Nhiều mẫu xe", "Hỗ trợ hồ sơ"],
          highlighted: true,
          cta: "Nhận tư vấn",
        },
      ],
    },
    explanation: "Tạo bảng giá ô tô",
  };

  const envelope = parseSectionDraftEnvelope(aiOutput, "pricing", currentLanding);
  const operations = compileSectionDraftToOperations(
    "pricing",
    envelope.draft,
    currentLanding
  );

  assert.deepEqual(operations, [
    {
      type: "update_text",
      section: "pricing",
      field: "pricingEyebrow",
      value: "Chọn gói phù hợp",
    },
    {
      type: "update_text",
      section: "pricing",
      field: "pricingHeadline",
      value: "Sở hữu chiếc xe dành cho bạn",
    },
    {
      type: "replace_section",
      section: "pricing",
      value: aiOutput.draft.items,
    },
  ]);
  assert.ok(Array.isArray(operations[2].value));
});

test("rejects malformed pricing items before operation application", async () => {
  const { parseSectionDraftEnvelope, SectionDraftValidationError } =
    await loadSectionDraftModule();

  assert.throws(
    () =>
      parseSectionDraftEnvelope(
        {
          draft: {
            eyebrow: "Gói phù hợp",
            headline: "Chọn xe",
            items: { name: "Sai vì không phải mảng" },
          },
        },
        "pricing",
        currentLanding
      ),
    (error) => {
      assert.ok(error instanceof SectionDraftValidationError);
      assert.match(error.message, /draft\.items phải là mảng/);
      return true;
    }
  );
});

test("compiler preserves project image fields instead of accepting AI image URLs", async () => {
  const { parseSectionDraftEnvelope, compileSectionDraftToOperations } =
    await loadSectionDraftModule();
  const landingWithPortfolio = {
    ...currentLanding,
    portfolio: [
      {
        title: "Cũ",
        category: "Cũ",
        description: "Cũ",
        imageUrl: "/api/assets/real-image",
        imageFit: "smart",
        imagePosition: "center",
      },
    ],
  };
  const envelope = parseSectionDraftEnvelope(
    {
      draft: {
        eyebrow: "Dự án",
        headline: "Mẫu xe nổi bật",
        items: [
          {
            title: "Sedan mới",
            category: "Sedan",
            description: "Phù hợp gia đình trẻ",
          },
        ],
      },
    },
    "portfolio",
    landingWithPortfolio
  );
  const operations = compileSectionDraftToOperations(
    "portfolio",
    envelope.draft,
    landingWithPortfolio
  );
  const replacement = operations.find(
    (operation) => operation.type === "replace_section"
  );

  assert.deepEqual(replacement.value[0], {
    title: "Sedan mới",
    category: "Sedan",
    description: "Phù hợp gia đình trẻ",
    imageUrl: "/api/assets/real-image",
    imageFit: "smart",
    imagePosition: "center",
  });
});

test("all list section drafts compile their items to array replace operations", async () => {
  const { parseSectionDraftEnvelope, compileSectionDraftToOperations } =
    await loadSectionDraftModule();
  const cases = [
    {
      section: "stats",
      draft: {
        items: [
          { value: "10+", label: "Mẫu xe" },
          { value: "24/7", label: "Hỗ trợ" },
          { value: "3 năm", label: "Bảo hành" },
        ],
      },
    },
    {
      section: "features",
      draft: {
        eyebrow: "Lợi ích",
        headline: "Chọn xe dễ dàng",
        items: [
          { number: "01", title: "Đa dạng", text: "Nhiều lựa chọn." },
          { number: "02", title: "Minh bạch", text: "Thông tin rõ ràng." },
          { number: "03", title: "Hỗ trợ", text: "Tư vấn tận tâm." },
        ],
      },
    },
    {
      section: "faq",
      draft: {
        eyebrow: "FAQ",
        headline: "Câu hỏi thường gặp",
        items: [
          { question: "Có trả góp không?", answer: "Có hỗ trợ hồ sơ." },
          { question: "Có bảo hành không?", answer: "Có theo từng mẫu xe." },
          { question: "Có lái thử không?", answer: "Có thể đăng ký trước." },
        ],
      },
    },
  ];

  for (const item of cases) {
    const envelope = parseSectionDraftEnvelope(
      { draft: item.draft },
      item.section,
      currentLanding
    );
    const operations = compileSectionDraftToOperations(
      item.section,
      envelope.draft,
      currentLanding
    );
    const replacement = operations.find(
      (operation) => operation.type === "replace_section"
    );
    assert.ok(replacement, `${item.section} must compile replace_section`);
    assert.ok(Array.isArray(replacement.value));
  }
});

test("allows gallery draft generation even when current gallery is empty", async () => {
  const { parseSectionDraftEnvelope, compileSectionDraftToOperations } =
    await loadSectionDraftModule();
  const envelope = parseSectionDraftEnvelope(
    {
      draft: {
        eyebrow: "Thư viện",
        headline: "Ảnh sản phẩm",
        items: [
          { alt: "Ảnh 1", caption: "Mô tả 1" },
          { alt: "Ảnh 2", caption: "Mô tả 2" },
        ],
      },
    },
    "gallery",
    currentLanding
  );

  const operations = compileSectionDraftToOperations(
    "gallery",
    envelope.draft,
    currentLanding
  );

  assert.deepEqual(operations, [
    { type: "update_text", section: "gallery", field: "galleryEyebrow", value: "Thư viện" },
    { type: "update_text", section: "gallery", field: "galleryHeadline", value: "Ảnh sản phẩm" },
  ]);
});

test("creation content agent consumes SectionDraft instead of AI-authored operations", async () => {
  const source = await readFile(
    new URL("../app/server/agents/section-content-agent.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /parseSectionDraftEnvelope/);
  assert.match(source, /compileSectionDraftToOperations/);
  assert.doesNotMatch(source, /parseLandingOperations/);
  assert.match(source, /Không trả về operations/);
});

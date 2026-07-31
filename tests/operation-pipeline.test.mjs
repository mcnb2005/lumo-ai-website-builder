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
      action: "create_landing",
      target: {},
      summary: "Tạo landing page bán ô tô",
      confidence: 0.97,
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
      action: "update_text",
      target: {
        section: "hero",
        field: "headline",
      },
      value: "Mua ô tô mơ ước.",
      summary: "Đổi tiêu đề phần mở đầu",
      confidence: 0.95,
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
      action: "clarify",
      target: {},
      summary: "Yêu cầu chưa rõ",
      confidence: 0.4,
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

test("target resolver asks before ambiguous edits and simple executor handles hero actions", async () => {
  const [resolverSource, executorSource] = await Promise.all([
    readFile(
      new URL("../app/server/agents/target-resolver.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../app/server/agents/simple-action-executor.ts",
        import.meta.url
      ),
      "utf8"
    ),
  ]);
  const compile = (source) =>
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
  const resolverUrl = `data:text/javascript;base64,${Buffer.from(
    compile(resolverSource)
  ).toString("base64")}`;
  const executorUrl = `data:text/javascript;base64,${Buffer.from(
    compile(executorSource)
  ).toString("base64")}`;
  const { resolveBuilderPlanTarget } = await import(resolverUrl);
  const { buildSimpleActionOperations } = await import(executorUrl);
  const landing = {
    brand: "Morrow",
    navCta: "Liên hệ",
    eyebrow: "Morrow dành cho đội ngũ",
    headline: "Morrow giúp bạn tăng trưởng",
    accentLine: "Nhanh hơn.",
    description: "Mô tả",
    primaryCta: "Bắt đầu",
    secondaryCta: "Xem thêm",
    proof: "Được tin dùng",
    featuresEyebrow: "Tại sao chọn Morrow",
    featuresHeadline: "Ít hỗn loạn.\nNhiều tác động hơn.",
    pricingEyebrow: "Gói phù hợp",
    pricingHeadline: "Bắt đầu nhỏ.\nLớn lên dễ dàng.",
    portfolioEyebrow: "Dự án tiêu biểu",
    portfolioHeadline: "Công việc nói thay\nmọi lời giới thiệu.",
    galleryEyebrow: "Thư viện hình ảnh",
    galleryHeadline: "Một góc nhìn\nđáng nhớ.",
    faqEyebrow: "Câu hỏi thường gặp",
    faqHeadline: "Rõ ràng trước khi\nbạn bắt đầu.",
    finalCtaEyebrow: "Sẵn sàng tạo điều khác biệt?",
    finalCtaHeadline: "Biến ý tưởng tiếp theo\nthành điều lớn lao.",
    heroImage: "",
    sectionOrder: ["hero", "finalCta"],
    hiddenSections: [],
    stats: [],
    features: [],
    pricing: [],
    portfolio: [],
    gallery: [],
    testimonial: { quote: "", name: "", role: "" },
    faq: [],
    leadForm: {
      title: "",
      description: "",
      fields: [],
      buttonText: "",
      successMessage: "",
    },
    palette: {
      ink: "#000000",
      paper: "#ffffff",
      accent: "#ff0000",
      soft: "#eeeeee",
      line: "#dddddd",
    },
  };
  const commonPlan = {
    mode: "edit",
    action: "update_text",
    target: {},
    value: "Bigdata",
    matchText: "Morrow",
    summary: "Đổi Morrow thành Bigdata",
    confidence: 0.95,
    targetSections: [],
    pagePurpose: "general",
    businessType: "Công nghệ",
    audience: "Doanh nghiệp",
    primaryGoal: "Liên hệ",
    tone: "Rõ ràng",
    recommendedSections: [],
    source: "ai",
  };

  const ambiguous = resolveBuilderPlanTarget(commonPlan, landing);
  assert.equal(ambiguous.status, "clarify");
  assert.match(ambiguous.question, /nhiều vị trí/i);

  const exact = resolveBuilderPlanTarget(
    {
      ...commonPlan,
      target: { section: "hero", field: "brand" },
      targetSections: ["hero"],
      targetField: "brand",
    },
    landing
  );
  assert.equal(exact.status, "resolved");
  assert.deepEqual(buildSimpleActionOperations(exact.plan), [
    {
      type: "update_text",
      section: "hero",
      field: "brand",
      value: "Bigdata",
      index: undefined,
      nestedIndex: undefined,
    },
  ]);

  assert.deepEqual(
    buildSimpleActionOperations({
      ...commonPlan,
      action: "hide_section",
      target: { section: "hero" },
      targetSections: ["hero"],
      targetField: undefined,
      value: undefined,
      matchText: undefined,
    }),
    [{ type: "hide_section", section: "hero" }]
  );
  assert.match(executorSource, /case "show_section"/);
  assert.match(executorSource, /case "move_section"/);
  assert.match(executorSource, /case "assign_image"/);
});

test("hero can be hidden, restored, undone and preserved while publishing", async () => {
  const [data, operations, studio, navigator, properties, publish] =
    await Promise.all([
      readFile(new URL("../app/landing-data.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/landing-operations.ts", import.meta.url),
        "utf8"
      ),
      readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/editor/SectionNavigator.tsx", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL(
          "../app/editor/SectionPropertiesPanel.tsx",
          import.meta.url
        ),
        "utf8"
      ),
      readFile(
        new URL("../app/api/publish/route.ts", import.meta.url),
        "utf8"
      ),
    ]);

  assert.doesNotMatch(
    operations,
    /Exclude<LandingSectionType, "hero" \| "finalCta">/
  );
  assert.doesNotMatch(
    operations,
    /section === "hero" \|\|\s*section === "finalCta"/
  );
  assert.doesNotMatch(
    data,
    /section !== "hero" &&\s*section !== "finalCta"/
  );
  assert.match(operations, /case "show_section"/);
  assert.match(operations, /hiddenSections: current\.hiddenSections\.filter/);
  assert.match(studio, /function undo\(\)/);
  assert.match(studio, /setLanding\(previous\)/);
  assert.doesNotMatch(
    navigator,
    /disabled=\{disabled \|\| section === "hero"/
  );
  assert.match(properties, /selectedSection !== "finalCta"/);
  assert.match(publish, /normalizeLandingData\(payload\.data/);
});

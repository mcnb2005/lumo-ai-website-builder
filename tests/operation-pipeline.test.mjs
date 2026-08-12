import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function compileModule(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function toModuleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

async function loadLandingValidationModules() {
  const [dataSource, manifestSource, normalizerSource, operationsSource] =
    await Promise.all([
      readFile(new URL("../app/landing-data.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/landing-manifest.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/landing-operation-normalizer.ts", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../app/landing-operations.ts", import.meta.url),
        "utf8"
      ),
    ]);
  const dataUrl = toModuleUrl(compileModule(dataSource));
  const manifestUrl = toModuleUrl(compileModule(manifestSource));
  const normalizerUrl = toModuleUrl(compileModule(normalizerSource));
  const resolvedOperationsSource = operationsSource
    .replace('"./landing-data"', JSON.stringify(dataUrl))
    .replace('"./landing-manifest"', JSON.stringify(manifestUrl))
    .replace('"./landing-operation-normalizer"', JSON.stringify(normalizerUrl));
  const [dataModule, operationsModule] = await Promise.all([
    import(dataUrl),
    import(toModuleUrl(compileModule(resolvedOperationsSource))),
  ]);
  return { ...dataModule, ...operationsModule };
}

async function loadBlueprintDecisionModule() {
  const [dataSource, decisionSource] = await Promise.all([
    readFile(new URL("../app/landing-data.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/server/agents/blueprint-decision.ts", import.meta.url),
      "utf8"
    ),
  ]);
  const dataUrl = toModuleUrl(compileModule(dataSource));
  const resolvedDecisionSource = decisionSource.replace(
    '"../../landing-data"',
    JSON.stringify(dataUrl)
  );
  return import(toModuleUrl(compileModule(resolvedDecisionSource)));
}

test("operation engine rejects unsafe or out-of-schema changes before applying", async () => {
  const source = await readFile(
    new URL("../app/landing-operations.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /landingOperationKeys as operationKeys/);
  assert.match(source, /validateAllowedKeys/);
  assert.match(source, /unsafeTextPattern/);
  assert.match(source, /replace_landing chỉ được dùng khi tạo project mới/);
  assert.match(source, /Asset nội bộ không tồn tại/);
  assert.match(source, /operations\.length > 50/);
  assert.match(source, /const errors = validateLandingData\(landing, current\)/);
  assert.match(source, /normalizeLandingOperationInput\(rawValue, options\)/);
});

test("custom blocks use their dedicated operation instead of replace_section", async () => {
  const {
    defaultLanding,
    normalizeLandingData,
    parseLandingOperationEnvelope,
  } = await loadLandingValidationModules();
  const current = normalizeLandingData(defaultLanding);

  assert.throws(
    () =>
      parseLandingOperationEnvelope(
        {
          operations: [
            {
              type: "replace_section",
              section: "customBlock",
              value: { htmlCode: "<section>Không hợp lệ</section>" },
            },
          ],
        },
        { mode: "edit", current, source: "ai" }
      ),
    /update_custom_block/
  );
});

test("blueprint decisions normalize semantic aliases into registered catalog values", async () => {
  const { parseBlueprintDecision } = await loadBlueprintDecisionModule();
  const decision = parseBlueprintDecision(
    {
      creativeFreedom: "high",
      templateFit: "weak",
      deviationReason: "The brief is demo-led and needs a more visual journey.",
      sections: ["hero", "Demo", "features", "finalCta"],
      sectionVariants: {
        hero: "full-screen",
        Demo: "showcase",
        features: "alternating",
        finalCta: "split",
      },
      typography: { heading: "modern", body: "sans" },
      density: "spacious",
      radius: "lg",
      palette: {
        ink: "#101828",
        paper: "#ffffff",
        accent: "#7c3aed",
        soft: "#f1edff",
        line: "#d8d1ef",
      },
      visualDirection: {
        mood: ["futuristic", "cinematic"],
        typography: "Bold modern display headings",
        density: "airy",
        imageStyle: "Product footage and UI stills",
        radius: "large",
        contrast: "high",
      },
    },
    "high"
  );

  assert.deepEqual(decision.sections, [
    "hero",
    "gallery",
    "features",
    "finalCta",
  ]);
  assert.equal(decision.sectionVariants.hero, "image-background");
  assert.equal(decision.sectionVariants.gallery, "showcase");
  assert.equal(decision.sectionVariants.features, "alternating");
});

test("operation engine accepts and validates per-section color overrides", async () => {
  const { defaultLanding, normalizeLandingData, validateLandingData } =
    await loadLandingValidationModules();
  const landing = normalizeLandingData({
    ...defaultLanding,
    sectionColors: {
      hero: {
        background: "#ffffff",
        text: "#112233",
        accent: "#ff6600",
      },
    },
  });

  assert.deepEqual(validateLandingData(landing), []);

  const invalidColorLanding = {
    ...landing,
    sectionColors: {
      hero: { background: "purple" },
    },
  };
  assert.match(
    validateLandingData(invalidColorLanding).join("\n"),
    /sectionColors\.hero\.background.*hex/i
  );
});

test("set_design applies controlled stats text sizes without changing unrelated sections", async () => {
  const {
    defaultLanding,
    normalizeLandingData,
    parseLandingOperationEnvelope,
    applyLandingOperations,
    validateLandingData,
  } = await loadLandingValidationModules();
  const current = normalizeLandingData(defaultLanding);
  const envelope = parseLandingOperationEnvelope(
    {
      operations: [
        {
          type: "set_design",
          sectionTextSizes: {
            stats: { value: "xl", label: "lg" },
          },
        },
      ],
    },
    { mode: "edit", current, source: "ai" }
  );
  const applied = applyLandingOperations(current, envelope.operations);

  assert.equal(applied.landing.design.sectionTextSizes.stats.value, "xl");
  assert.equal(applied.landing.design.sectionTextSizes.stats.label, "lg");
  assert.deepEqual(applied.changedSections, ["stats"]);
  assert.deepEqual(validateLandingData(applied.landing), []);

  assert.throws(
    () =>
      parseLandingOperationEnvelope(
        {
          operations: [
            {
              type: "set_design",
              sectionTextSizes: { stats: { value: "huge" } },
            },
          ],
        },
        { mode: "edit", current, source: "ai" }
      ),
    /sectionTextSizes\.stats\.value/
  );
});

test("set_design applies controlled pricing text sizes and detects no-op changes", async () => {
  const {
    defaultLanding,
    normalizeLandingData,
    parseLandingOperationEnvelope,
    applyLandingOperations,
    validateLandingData,
  } = await loadLandingValidationModules();
  const current = normalizeLandingData(defaultLanding);
  const envelope = parseLandingOperationEnvelope(
    {
      operations: [
        {
          type: "set_design",
          sectionTextSizes: {
            pricing: {
              heading: "lg",
              name: "lg",
              price: "xl",
              description: "lg",
              features: "lg",
              cta: "lg",
            },
          },
        },
      ],
    },
    { mode: "edit", current, source: "ai" }
  );
  const applied = applyLandingOperations(current, envelope.operations);

  assert.deepEqual(applied.landing.design.sectionTextSizes.pricing, {
    heading: "lg",
    name: "lg",
    price: "xl",
    description: "lg",
    features: "lg",
    cta: "lg",
  });
  assert.deepEqual(applied.changedSections, ["pricing"]);
  assert.deepEqual(validateLandingData(applied.landing), []);

  const noOpEnvelope = parseLandingOperationEnvelope(
    {
      operations: [
        {
          type: "set_design",
          sectionTextSizes: {
            pricing: { heading: "md" },
          },
        },
      ],
    },
    { mode: "edit", current, source: "ai" }
  );
  const noOp = applyLandingOperations(current, noOpEnvelope.operations);
  assert.deepEqual(noOp.changedSections, []);

  assert.throws(
    () =>
      parseLandingOperationEnvelope(
        {
          operations: [
            {
              type: "set_design",
              sectionTextSizes: { pricing: { price: "huge" } },
            },
          ],
        },
        { mode: "edit", current, source: "ai" }
      ),
    /sectionTextSizes\.pricing\.price/
  );
});

test("section typography tokens preserve responsive editor rendering and prompt mapping", async () => {
  const [canvas, styles, skill, builderPlan, websiteBuilderAgent] = await Promise.all([
    readFile(
      new URL("../app/components/LandingCanvas.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(
      new URL("../app/server/skills/landing-builder-skill.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/builder-plan.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/website-builder-agent.ts", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(canvas, /stats-value-size-/);
  assert.match(canvas, /stats-label-size-/);
  assert.match(canvas, /pricing-heading-size-/);
  assert.match(canvas, /pricing-price-size-/);
  assert.match(canvas, /pricing-cta-size-/);
  assert.match(styles, /\.landing-canvas\.is-compact \.stat-card > span/);
  assert.doesNotMatch(
    styles,
    /\.landing-canvas\.is-compact \.stat-card span\s*\{/
  );
  assert.match(styles, /--pricing-heading-font-size/);
  assert.match(styles, /--pricing-price-font-delta/);
  assert.match(styles, /\.pricing-section\.pricing-price-size-xl/);
  assert.match(skill, /sectionTextSizes\.stats\.value/);
  assert.match(skill, /sectionTextSizes\.stats\.label/);
  assert.match(skill, /sectionTextSizes\.pricing\.heading/);
  assert.match(skill, /'Toàn bộ\/chữ phần bảng giá'/);
  assert.match(builderPlan, /"set_design"/);
  assert.match(builderPlan, /đổi cỡ chữ/);
  assert.match(websiteBuilderAgent, /noLandingChangeMessage/);
  assert.match(websiteBuilderAgent, /changedSections\.length/);
});

test("AI operation normalizer is schema-driven and preserves ambiguous unknown fields", async () => {
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
  const { normalizeLandingOperationInput } = await import(moduleUrl);
  const landing = { brand: "Lumo" };
  const input = {
    operations: [
      {
        type: "replace_landing",
        section: "hero",
        value: landing,
        unexpected: "must-still-be-validated",
      },
      {
        type: "update_text",
        targetSection: "hero",
        targetField: "headline",
        text: "Tiêu đề mới",
        toIndex: 4,
      },
      {
        type: "hide_section",
        section: "pricing",
        value: "redundant protocol field",
      },
      {
        type: "show_section",
        section: "hero",
        targetSection: "gallery",
      },
    ],
  };

  const normalized = normalizeLandingOperationInput(input, {
    mode: "create",
    source: "ai",
  });

  assert.deepEqual(normalized.operations[0], {
    type: "replace_landing",
    value: landing,
    unexpected: "must-still-be-validated",
  });
  assert.deepEqual(normalized.operations[1], {
    type: "update_text",
    section: "hero",
    field: "headline",
    value: "Tiêu đề mới",
  });
  assert.deepEqual(normalized.operations[2], {
    type: "hide_section",
    section: "pricing",
  });
  assert.equal(normalized.operations[3], input.operations[3]);
  assert.equal(input.operations[0].section, "hero");
  assert.deepEqual(
    normalizeLandingOperationInput(input, { mode: "edit", source: "ai" }),
    normalized
  );
  assert.equal(
    normalizeLandingOperationInput(input, { mode: "create", source: "ui" }),
    input
  );
  assert.match(source, /landingOperationSchemas/);
  assert.match(source, /knownProtocolKeys/);
  assert.match(source, /conflictingAliases/);
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
  const [source, aiJsonSource] = await Promise.all([
    readFile(
      new URL("../app/server/agents/builder-plan.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/tools/ai-json.ts", import.meta.url),
      "utf8"
    ),
  ]);
  const aiJsonJavascript = ts.transpileModule(aiJsonSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const aiJsonModuleUrl = `data:text/javascript;base64,${Buffer.from(aiJsonJavascript).toString("base64")}`;
  const sourceWithResolvedAiJson = source.replace(
    '"../tools/ai-json"',
    JSON.stringify(aiJsonModuleUrl)
  );
  const javascript = ts.transpileModule(sourceWithResolvedAiJson, {
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

  const imageHeroInput = {
    mode: "create",
    action: "create_landing",
    target: {},
    summary: "Create an event landing page",
    confidence: 0.98,
    pagePurpose: "event",
    businessType: "Conference",
    audience: "Design leaders",
    primaryGoal: "Register",
    tone: "Confident",
    recommendedSections: ["hero", "finalCta"],
    sectionVariants: { hero: "image-background" },
  };

  const imageHeroPlan = parseBuilderPlan(
    JSON.stringify(imageHeroInput),
    manifest
  );
  assert.equal(imageHeroPlan.sectionVariants?.hero, "image-background");
  assert.equal("heroImage" in imageHeroPlan, false);

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

  const palettePlan = parseBuilderPlan(
    JSON.stringify({
      mode: "edit",
      action: "set_palette",
      target: {},
      value: "#f4efe6",
      summary: "Đổi màu nền cho đẹp hơn",
      confidence: 0.92,
      pagePurpose: "general",
      businessType: "Doanh nghiệp",
      audience: "Khách hàng",
      primaryGoal: "Liên hệ",
      tone: "Tinh tế",
      recommendedSections: [],
    }),
    manifest
  );

  assert.equal(palettePlan.action, "set_palette");
  assert.equal(palettePlan.target.paletteToken, undefined);

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

test("creation keeps uploaded assets manual and makes the whole Hero droppable", async () => {
  const [
    canvas,
    planner,
    builderPlan,
    sectionContent,
    creationPipeline,
    websiteBuilder,
    aiRoute,
    studio,
    styles,
  ] = await Promise.all([
    readFile(new URL("../app/components/LandingCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/server/agents/planning-agent.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/server/agents/builder-plan.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/server/agents/section-content-agent.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/landing-creation-pipeline.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/website-builder-agent.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  const imageBackgroundFrame = canvas.match(
    /function HeroImageBackgroundFrame[\s\S]*?\r?\n}\r?\n/
  )?.[0];
  assert.ok(imageBackgroundFrame);
  assert.doesNotMatch(imageBackgroundFrame, /items\[0\]/);
  assert.match(canvas, /!hasImage && preferred === "image-background"/);
  assert.match(canvas, /\[null, items\[1\], items\[2\]\]/);
  assert.match(canvas, /function HeroEditorDropSurface/);
  assert.match(canvas, /onDropImage\?\.\("hero", payload\)/);
  assert.match(
    styles,
    /\.hero-editor-drop-surface\s*\{[\s\S]*?width:\s*100%;[\s\S]*?display:\s*block;/
  );
  assert.match(
    styles,
    /\.hero-editor-drop-surface \.hero-image-wrap\s*\{[\s\S]*?display:\s*grid;/
  );
  assert.match(
    styles,
    /\.hero-editor-drop-surface \.hero-image-wrap > \.image-drop-zone\s*\{[\s\S]*?align-self:\s*stretch;/
  );
  assert.match(canvas, /target="hero"/);
  assert.match(canvas, /target=\{`portfolio:\$\{index\}`\}/);
  assert.match(canvas, /target="gallery:add"/);
  assert.match(planner, /builderPlanSystemPromptRules/);
  assert.match(planner, /input\.availableAssets/);
  assert.doesNotMatch(planner, /"heroImage":/);
  assert.match(builderPlan, /mode=create[\s\S]{0,220}availableAssets/);
  assert.doesNotMatch(builderPlan, /heroImage\?: string/);
  assert.doesNotMatch(builderPlan, /heroVariantRequiresImage/);
  assert.match(sectionContent, /BusinessBrief\.sourcePrompt/);
  assert.match(sectionContent, /Các ô ảnh trong Hero, Gallery và Portfolio có thể để trống/);
  assert.doesNotMatch(sectionContent, /heroVariantRequiresImage/);
  assert.doesNotMatch(creationPipeline, /assignProjectAssetsToLanding/);
  assert.doesNotMatch(creationPipeline, /availableAssets/);
  assert.doesNotMatch(websiteBuilder, /creationAssets/);
  assert.match(aiRoute, /listProjectAssets/);
  assert.match(studio, /function placeUploadedImages/);
  assert.match(studio, /function galleryItemsForAssets/);
  assert.match(studio, /Ảnh này đã có trong thư viện hình ảnh/);
  assert.match(studio, /projectId,/);
});

test("new projects are persisted before the first asset upload", async () => {
  const studio = await readFile(
    new URL("../app/Studio.tsx", import.meta.url),
    "utf8"
  );

  assert.match(studio, /persistedProjectIdRef/);
  assert.match(studio, /projectSaveRequestRef/);
  assert.match(studio, /const persistProject = useCallback/);
  assert.match(
    studio,
    /if \(persistedProjectIdRef\.current !== projectId\) \{\s*await persistProject/
  );
  assert.doesNotMatch(
    studio,
    /saveState === "saving"[\s\S]{0,120}setTimeout\(resolve, 900\)/
  );
  assert.match(
    studio,
    /setSaveState\(user \? "saving" : "guest"\)/
  );
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

  const palettePlan = {
    ...commonPlan,
    action: "set_palette",
    target: {},
    targetSections: [],
    targetField: undefined,
    value: "#f4efe6",
    matchText: undefined,
    summary: "Đổi màu nền cho đẹp hơn",
  };
  const selectedSectionBackground = resolveBuilderPlanTarget(
    palettePlan,
    landing,
    {
      selectedSection: "leadForm",
      prompt: "Hãy làm màu nền phần này khác cho đẹp hơn",
    }
  );
  assert.equal(selectedSectionBackground.status, "resolved");
  assert.equal(selectedSectionBackground.plan.target.paletteToken, "soft");
  assert.equal(selectedSectionBackground.plan.target.section, "leadForm");
  assert.deepEqual(
    buildSimpleActionOperations(selectedSectionBackground.plan),
    [{ type: "set_palette", token: "soft", value: "#f4efe6" }]
  );

  const wholePageBackground = resolveBuilderPlanTarget(
    palettePlan,
    landing,
    { prompt: "Đổi nền toàn trang sang màu mới" }
  );
  assert.equal(wholePageBackground.status, "resolved");
  assert.equal(wholePageBackground.plan.target.paletteToken, "paper");

  const unclearPalette = resolveBuilderPlanTarget(palettePlan, landing, {
    prompt: "Làm màu khác cho đẹp hơn",
  });
  assert.equal(unclearPalette.status, "clarify");
  assert.match(unclearPalette.question, /nền toàn trang/i);
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

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses a controlled template registry for AI, manual and blank project flows", async () => {
  const [registry, data, agent, studio, dialog, canvas, operations, styles] =
    await Promise.all([
      readFile(new URL("../app/templates/registry.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/landing-data.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/server/agents/website-builder-agent.ts", import.meta.url),
        "utf8"
      ),
      readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/templates/NewProjectDialog.tsx", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../app/components/LandingCanvas.tsx", import.meta.url),
        "utf8"
      ),
      readFile(new URL("../app/landing-operations.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  for (const templateId of [
    "product-modern",
    "service-editorial",
    "course-friendly",
    "event-bold",
    "portfolio-editorial",
    "lead-minimal",
  ]) {
    assert.match(registry, new RegExp(`id: "${templateId}"`));
  }

  assert.match(registry, /selectTemplateForBrief/);
  assert.match(registry, /recommendedFor\.includes\(brief\.pagePurpose\)/);
  assert.doesNotMatch(registry, /sectionOrder: allSections/);
  assert.equal(
    (registry.match(/sectionOrder: \[\r?\n\s+"hero"/g) || []).length,
    6
  );
  assert.match(
    registry,
    /id: "product-modern"[\s\S]*?sectionOrder: \[\s*"hero",\s*"gallery"/
  );
  assert.match(
    registry,
    /id: "service-editorial"[\s\S]*?sectionOrder: \[\s*"hero",\s*"stats",\s*"portfolio"/
  );
  assert.match(
    registry,
    /id: "lead-minimal"[\s\S]*?sectionOrder: \[\s*"hero",\s*"leadForm"/
  );
  assert.doesNotMatch(registry, /isCreateRequest|isCreationCorrection/);
  assert.match(data, /type LandingDesign/);
  assert.match(data, /sectionVariants/);
  assert.match(data, /templateId/);
  assert.match(operations, /landingSectionVariantOptions/);
  assert.match(agent, /selectTemplateForBrief\(intent\)/);
  assert.match(agent, /createLandingFromTemplate\(templateSelection\.id\)/);
  assert.match(agent, /runLandingCreationPipeline/);
  assert.match(studio, /NewProjectDialog/);
  assert.match(studio, /createProjectWithAi/);
  assert.match(studio, /applyTemplateDesign/);
  assert.match(dialog, /Tạo bằng AI/);
  assert.match(dialog, /Chọn template/);
  assert.match(dialog, /Trang trắng/);
  assert.match(dialog, /TemplatePreviewArt/);
  assert.match(dialog, /template-card-preview is-\$\{template\.category\}/);
  assert.match(styles, /art-product-bottle/);
  assert.match(styles, /art-service-portrait/);
  assert.match(styles, /art-course-progress/);
  assert.match(styles, /art-event-stage/);
  assert.match(styles, /art-portfolio-tile/);
  assert.match(styles, /art-lead-form/);
  assert.match(canvas, /variantClass/);
  assert.match(canvas, /template-\$\{templateClass\}/);
  assert.match(canvas, /const heroVariantFrames/);
  assert.match(canvas, /HeroSplitFrame/);
  assert.match(canvas, /HeroCenteredFrame/);
  assert.match(canvas, /HeroProductShowcaseFrame/);
  assert.match(canvas, /HeroImageBackgroundFrame/);
  assert.match(canvas, /variant=\{data\.design\?\.sectionVariants\.hero\}/);
});

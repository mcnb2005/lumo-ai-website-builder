import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports hero and final CTA sections for drag-and-drop editor", async () => {
  const [
    landingData,
    registry,
    studio,
    canvas,
    navigator,
    inlineComponent,
    inlineEditing,
    operations,
    manifest,
    propertiesPanel,
    generationProgress,
  ] = await Promise.all([
    readFile(new URL("../app/landing-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/section-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LandingCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/SectionNavigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/InlineEditableText.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/inline-editing.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-manifest.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/editor/SectionPropertiesPanel.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/editor/GenerationProgress.tsx", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(landingData, /"hero"/);
  assert.match(landingData, /"finalCta"/);
  assert.match(landingData, /hiddenSections/);
  assert.match(registry, /hero:/);
  assert.match(registry, /finalCta:/);
  assert.match(studio, /function updateLanding/);
  assert.match(studio, /applyLandingOperations/);
  assert.match(studio, /type: "move_section"/);
  assert.match(studio, /landing\.hiddenSections/);
  assert.match(studio, /type LandingImageTarget/);
  assert.doesNotMatch(studio, /id="image-placement"/);
  assert.match(studio, /target === "gallery:add"/);
  assert.match(studio, /portfolioIndex/);
  assert.match(studio, /ensureSectionVisible/);
  assert.match(studio, /multiple/);
  assert.match(studio, /application\/x-lumo-asset/);
  assert.match(studio, /if \(target\) \{\s*placeUploadedImages\(newAssets, target\)/);
  assert.match(studio, /Ảnh chưa được chèn · kéo vào vị trí trên bản xem trước/);
  assert.doesNotMatch(studio, /onClick=\{\(\) =>\s*placeUploadedImages/);
  assert.match(canvas, /function ImageDropZone/);
  assert.match(canvas, /onDropImage/);
  assert.match(canvas, /gallery:add/);
  assert.match(canvas, /onRemoveImage/);
  assert.match(studio, /reorderGalleryImage/);
  assert.match(canvas, /copyMove/);
  assert.match(canvas, /SortableSectionFrame/);
  assert.match(canvas, /mode === "editor"/);
  assert.match(canvas, /function editableText/);
  assert.match(canvas, /onEditText/);
  assert.match(studio, /applyLandingTextEdit/);
  assert.match(studio, /onEditText=\{editLandingText\}/);
  assert.match(inlineComponent, /contentEditable/);
  assert.match(inlineComponent, /suppressContentEditableWarning/);
  assert.match(inlineComponent, /event\.key === "Escape"/);
  assert.match(inlineComponent, /event\.key === "Enter"/);
  assert.match(inlineEditing, /export function applyLandingTextEdit/);
  assert.match(inlineEditing, /operationForTextEdit/);
  assert.match(operations, /case "pricing\.feature"/);
  assert.match(operations, /case "leadForm\.field"/);
  assert.match(operations, /case "featuresHeadline"/);
  assert.match(operations, /case "pricingHeadline"/);
  assert.match(operations, /case "portfolioHeadline"/);
  assert.match(operations, /case "galleryHeadline"/);
  assert.match(operations, /case "faqHeadline"/);
  assert.match(operations, /case "finalCtaHeadline"/);
  assert.match(manifest, /buildLandingManifest/);
  assert.match(manifest, /"featuresHeadline"/);
  assert.match(manifest, /"pricingHeadline"/);
  assert.match(manifest, /"portfolioHeadline"/);
  assert.match(manifest, /"galleryHeadline"/);
  assert.match(manifest, /"faqHeadline"/);
  assert.match(manifest, /"finalCtaHeadline"/);
  assert.match(canvas, /data\.featuresHeadline/);
  assert.match(canvas, /data\.pricingHeadline/);
  assert.match(canvas, /data\.portfolioHeadline/);
  assert.match(canvas, /data\.galleryHeadline/);
  assert.match(canvas, /data\.faqHeadline/);
  assert.match(canvas, /data\.finalCtaHeadline/);
  assert.doesNotMatch(canvas, /<h2>Ít hỗn loạn\.<br \/>Nhiều tác động hơn\.<\/h2>/);
  assert.doesNotMatch(canvas, /<h2>Bắt đầu nhỏ\.<br \/>Lớn lên dễ dàng\.<\/h2>/);
  assert.doesNotMatch(canvas, /<h2>Công việc nói thay<br \/>mọi lời giới thiệu\.<\/h2>/);
  assert.doesNotMatch(canvas, /<h2>Một góc nhìn<br \/>đáng nhớ\.<\/h2>/);
  assert.doesNotMatch(canvas, /<h2>Rõ ràng trước khi<br \/>bạn bắt đầu\.<\/h2>/);
  assert.doesNotMatch(canvas, /<h2>Biến ý tưởng tiếp theo<br \/>thành điều lớn lao\.<\/h2>/);
  assert.match(propertiesPanel, /section-properties__header/);
  assert.match(propertiesPanel, /landing\.featuresHeadline/);
  assert.match(propertiesPanel, /landing\.pricingHeadline/);
  assert.match(propertiesPanel, /landing\.portfolioHeadline/);
  assert.match(propertiesPanel, /landing\.galleryHeadline/);
  assert.match(propertiesPanel, /landing\.faqHeadline/);
  assert.match(propertiesPanel, /landing\.finalCtaHeadline/);
  assert.match(propertiesPanel, /onSetPalette/);
  assert.match(generationProgress, /GenerationStage/);
  assert.match(navigator, /sortableKeyboardCoordinates/);
  assert.match(navigator, /onReorder/);
});

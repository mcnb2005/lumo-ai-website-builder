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
    colorPanel,
    generationProgress,
    imageDragPayload,
    styles,
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
      new URL("../app/editor/SectionColorPanel.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/editor/GenerationProgress.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/image-drag-payload.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(landingData, /"hero"/);
  assert.match(landingData, /"finalCta"/);
  assert.match(landingData, /hiddenSections/);
  assert.match(landingData, /heroImageFit/);
  assert.match(landingData, /heroImagePosition/);
  assert.match(landingData, /sectionColors/);
  assert.match(landingData, /"cover" \| "contain" \| "smart"/);
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
  assert.match(studio, /function setImagePresentation/);
  assert.match(studio, /<SectionColorPanel/);
  assert.match(studio, /onSetColor=\{setSectionColor\}/);
  assert.match(studio, /onResetColors=\{resetSectionColors\}/);
  assert.match(studio, /multiple/);
  assert.match(studio, /LUMO_ASSET_DRAG_TYPE/);
  assert.match(studio, /createLandingImageDragPayload/);
  assert.match(studio, /draggable=\{false\}/);
  assert.match(studio, /window\.addEventListener\("paste", handlePaste\)/);
  assert.match(studio, /clipboardImageFiles/);
  assert.match(studio, /event\.dataTransfer\.files/);
  assert.match(studio, /asset-upload-zone/);
  assert.match(studio, /\+ Click hoặc kéo ảnh vào đây/);
  assert.match(studio, /if \(target\) \{\s*placeUploadedImages\(newAssets, target\)/);
  assert.match(studio, /Kéo từng ảnh vào đúng vị trí trên bản xem trước\./);
  assert.doesNotMatch(studio, /onClick=\{\(\) =>\s*placeUploadedImages/);
  assert.match(canvas, /function ImageDropZone/);
  assert.match(canvas, /function HeroEditorDropSurface/);
  assert.match(canvas, /onDropImage\?\.\("hero", payload\)/);
  assert.match(canvas, /readLandingImageDrop/);
  assert.match(canvas, /onDropImage/);
  assert.match(canvas, /gallery:add/);
  assert.match(canvas, /onRemoveImage/);
  assert.match(canvas, /function imagePresentationStyle/);
  assert.match(canvas, /function PresentedImage/);
  assert.match(canvas, /smart-image-frame/);
  assert.match(canvas, /smart-image-background/);
  assert.match(canvas, /HeroVariantFrame/);
  assert.match(canvas, /hasImage=\{Boolean\(data\.heroImage\)\}/);
  assert.match(canvas, /objectFit/);
  assert.match(canvas, /objectPosition/);
  assert.match(studio, /reorderGalleryImage/);
  assert.match(canvas, /copyMove/);
  assert.match(canvas, /parseLandingImageDragPayload/);
  assert.match(canvas, /getData\("text\/plain"\)/);
  assert.match(imageDragPayload, /application\/x-lumo-asset/);
  assert.match(imageDragPayload, /lumo-asset:/);
  assert.match(imageDragPayload, /Ảnh tải lên/);
  assert.match(canvas, /SortableSectionFrame/);
  assert.match(canvas, /mode === "editor"/);
  assert.match(canvas, /function editableText/);
  assert.match(canvas, /onEditText/);
  assert.match(canvas, /selectedSection === section/);
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
  assert.match(colorPanel, /section-color-panel__header/);
  assert.match(colorPanel, /landing\.sectionColors\[selectedSection\]/);
  assert.match(colorPanel, /type="color"/);
  assert.match(colorPanel, /"background"/);
  assert.match(colorPanel, /"text"/);
  assert.match(colorPanel, /"accent"/);
  assert.match(colorPanel, /contrastRatio/);
  assert.match(colorPanel, /onResetColors/);
  assert.match(styles, /\.section-color-panel\s*\{/);
  assert.match(styles, /\.section-color-panel__fields\s*\{/);
  assert.match(styles, /\.section-color-field\s*\{/);
  assert.match(styles, /\.section-color-field__control input\[type="color"\]/);
  assert.match(styles, /\.section-color-panel__contrast\.is-warning/);
  assert.match(styles, /\.section-color-panel__visibility/);
  assert.match(styles, /\.preview-loading\s*\{/);
  assert.match(styles, /contain: layout paint/);
  assert.match(styles, /\.preview-scroll\s*\{[\s\S]*?container-type:\s*inline-size/);
  assert.match(styles, /container-name:\s*landing-preview/);
  assert.match(styles, /@container landing-preview \(max-width:\s*980px\)/);
  assert.match(
    styles,
    /\.landing-canvas\.is-compact \.landing-hero\.has-image\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
  );
  assert.match(
    styles,
    /\.landing-canvas\.is-compact \.landing-hero\.variant-product-showcase \.hero-product-media\s*\{[\s\S]*?transform:\s*none/
  );
  assert.match(styles, /@container landing-preview \(max-width:\s*560px\)/);
  assert.match(styles, /min-height:\s*240px/);
  const productShowcaseRuleIndex = styles.indexOf(
    ".landing-hero.variant-product-showcase.has-image"
  );
  const publicResponsiveOverrideIndex = styles.lastIndexOf(
    "@media (max-width: 980px)"
  );
  assert.ok(publicResponsiveOverrideIndex > productShowcaseRuleIndex);
  assert.match(
    styles.slice(publicResponsiveOverrideIndex),
    /\.landing-hero\.variant-product-showcase\.has-image[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/
  );
  assert.match(generationProgress, /GenerationStage/);
  assert.match(styles, /\.landing-hero\.variant-centered/);
  assert.match(styles, /\.landing-hero\.variant-product-showcase/);
  assert.match(styles, /\.landing-hero\.variant-image-background/);
  assert.match(styles, /\.landing-hero:not\(\.has-image\)/);
  assert.match(styles, /min-height: 138px/);
  assert.match(styles, /\.hero-editor-drop-surface\.is-drag-active/);
  assert.match(navigator, /sortableKeyboardCoordinates/);
  assert.match(navigator, /onReorder/);
});

test("asset uploads honor the advertised 5 MB limit and report readable errors", async () => {
  const [studio, nextConfig] = await Promise.all([
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(nextConfig, /bodySizeLimit:\s*["']6mb["']/);
  assert.match(studio, /MAX_IMAGE_SIZE\s*=\s*5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(studio, /const responseText = await response\.text\(\)/);
  assert.match(studio, /response\.status === 413/);
  assert.match(studio, /vượt quá giới hạn tải lên 5 MB/);
});

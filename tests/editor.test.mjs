import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports hero and final CTA sections for drag-and-drop editor", async () => {
  const [landingData, registry, studio, canvas, navigator] = await Promise.all([
    readFile(new URL("../app/landing-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/section-registry.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LandingCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/SectionNavigator.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(landingData, /"hero"/);
  assert.match(landingData, /"finalCta"/);
  assert.match(landingData, /hiddenSections/);
  assert.match(registry, /hero:/);
  assert.match(registry, /finalCta:/);
  assert.match(studio, /function updateLanding/);
  assert.match(studio, /arrayMove\(current\.sectionOrder/);
  assert.match(studio, /landing\.hiddenSections/);
  assert.match(canvas, /SortableSectionFrame/);
  assert.match(canvas, /mode === "editor"/);
  assert.match(navigator, /sortableKeyboardCoordinates/);
  assert.match(navigator, /onReorder/);
});

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("defines the complete Lumo studio experience", async () => {
  const [studio, landing] = await Promise.all([
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/LandingCanvas.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /\{landing\.brand\} Landing/);
  assert.match(studio, /Xuất bản/);
  assert.match(studio, /\/api\/ai/);
  assert.match(studio, /\/api\/publish/);
  assert.match(landing, /landing-hero/);
  assert.match(landing, /handlePreviewNavigation/);
  assert.match(landing, /event\.preventDefault\(\)/);
  assert.doesNotMatch(studio, /codex-preview|react-loading-skeleton/i);
});

test("ships production metadata and removes starter artifacts", async () => {
  const [layout, page, packageJson, css] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Lumo — Tạo landing page bằng AI/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /<Studio \/>/);
  assert.match(packageJson, /"name": "lumo-ai-landing-studio"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(css, /"Times New Roman", Times, "Noto Serif", serif/);
  assert.match(css, /letter-spacing: normal/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url))
  );
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});

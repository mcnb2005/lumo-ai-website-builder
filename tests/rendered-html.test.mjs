import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("defines the complete multi-project Lumo studio experience", async () => {
  const [studio, landing, projects, publish] = await Promise.all([
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/components/LandingCanvas.tsx", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/publish/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(studio, /Dự án mới/);
  assert.match(studio, /Đăng nhập để lưu/);
  assert.match(studio, /\/api\/ai/);
  assert.match(studio, /\/api\/publish/);
  assert.match(studio, /\/api\/assets/);
  assert.match(landing, /pricing-section/);
  assert.match(landing, /portfolio-section/);
  assert.match(landing, /gallery-section/);
  assert.match(landing, /faq-section/);
  assert.match(landing, /lead-section/);
  assert.match(landing, /isTrustedImageUrl/);
  assert.match(landing, /handlePreviewNavigation/);
  assert.match(landing, /event\.preventDefault\(\)/);
  assert.match(projects, /projects\.ownerId/);
  assert.match(publish, /projects\.ownerId/);
  assert.doesNotMatch(studio, /codex-preview|react-loading-skeleton/i);
});

test("ships production metadata, persistence and image storage", async () => {
  const [layout, page, packageJson, css, schema, hosting] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Lumo/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /<Studio \/>/);
  assert.match(packageJson, /"name": "lumo-ai-landing-studio"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(css, /"Times New Roman", Times, "Noto Serif", serif/);
  assert.match(css, /letter-spacing: normal/);
  assert.match(schema, /ownerId: text\("owner_id"\)/);
  assert.match(schema, /export const assets/);
  assert.match(schema, /export const leads/);
  assert.match(hosting, /"r2": "ASSETS"/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url))
  );
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../public/og.png", import.meta.url));
});

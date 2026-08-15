import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships project publishing settings, metadata, social preview and slug redirects", async () => {
  const [
    schema,
    database,
    migration,
    settings,
    publishApi,
    publicProject,
    publicPage,
    publicApi,
    studio,
    dialog,
  ] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../drizzle/0013_publishing_versions_account_security.sql",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(new URL("../app/publish-settings.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/publish/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/server/public-project.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/p/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public/[slug]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/PublishSettingsDialog.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /publishSettings: text\("publish_settings"\)/);
  assert.match(schema, /export const projectSlugRedirects/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS project_slug_redirects/);
  assert.match(migration, /CREATE TABLE `project_slug_redirects`/);
  assert.match(settings, /seoTitle/);
  assert.match(settings, /canonicalUrl/);
  assert.match(settings, /noIndex/);
  assert.match(settings, /new URL\(canonicalUrl\)/);
  assert.match(publishApi, /project_slug_redirects/);
  assert.match(publishApi, /createProjectSnapshot/);
  assert.match(publicProject, /getPublishedProjectBySlug/);
  assert.match(publicPage, /generateMetadata/);
  assert.match(publicPage, /permanentRedirect/);
  assert.match(publicPage, /robots/);
  assert.match(publicPage, /openGraph/);
  assert.match(publicApi, /Response\.redirect[\s\S]*?308/);
  assert.match(studio, /PublishSettingsDialog/);
  assert.match(dialog, /Facebook/);
  assert.match(dialog, /Zalo/);
  assert.match(dialog, /Slug cũ sẽ tự chuyển hướng/);
});

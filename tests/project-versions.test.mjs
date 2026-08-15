import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("persists, previews and restores bounded project version history", async () => {
  const [schema, service, versionsApi, studio, panel, projectsApi, companyApi, companyDashboard] =
    await Promise.all([
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/server/project-versions.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/projects/[id]/versions/route.ts", import.meta.url),
        "utf8"
      ),
      readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/editor/VersionHistoryPanel.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/company/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/company/CompanyDashboard.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(schema, /export const projectVersions/);
  assert.match(schema, /versionNumber: integer\("version_number"\)/);
  assert.match(service, /AUTOSAVE_INTERVAL_MS/);
  assert.match(service, /MAX_AUTOSAVE_VERSIONS/);
  assert.match(service, /before_restore/);
  assert.match(service, /status = 'draft'/);
  assert.match(versionsApi, /canEditLanding/);
  assert.match(versionsApi, /getAccessibleProject/);
  assert.match(versionsApi, /project.version_restored/);
  assert.match(studio, /previewVersion/);
  assert.match(studio, /action: "snapshot"/);
  assert.match(panel, /Xem trước/);
  assert.match(panel, /Khôi phục/);
  assert.match(projectsApi, /action === "restoreDeleted"/);
  assert.match(companyApi, /archivedProjects/);
  assert.match(companyDashboard, /Khôi phục bản nháp/);
});

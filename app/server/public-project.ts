import { ensureDatabase, getD1 } from "../../db";
import { inferDashboardType } from "../dashboard-config";
import { normalizeLandingData } from "../landing-data";
import {
  parseStoredPublishSettings,
  publishSettingsWithLandingDefaults,
} from "../publish-settings";

type PublicProjectRow = {
  id: string;
  name: string;
  slug: string;
  data: string;
  dashboard_type: string;
  publish_settings: string;
};

async function findProject(slug: string) {
  const direct = await getD1()
    .prepare(
      `SELECT id, name, slug, data, dashboard_type, publish_settings
       FROM projects
       WHERE slug = ? AND status = 'published' AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(slug)
    .first<PublicProjectRow>();
  if (direct) return { row: direct, redirected: false };

  const redirected = await getD1()
    .prepare(
      `SELECT project.id, project.name, project.slug, project.data,
        project.dashboard_type, project.publish_settings
       FROM project_slug_redirects redirect
       INNER JOIN projects project ON project.id = redirect.project_id
       WHERE redirect.slug = ?
         AND project.status = 'published'
         AND project.deleted_at IS NULL
       LIMIT 1`
    )
    .bind(slug)
    .first<PublicProjectRow>();
  return redirected
    ? { row: redirected, redirected: true }
    : { row: null, redirected: false };
}

export async function getPublishedProjectBySlug(slug: string) {
  await ensureDatabase();
  const found = await findProject(slug);
  if (!found.row) return null;
  const landing = normalizeLandingData(JSON.parse(found.row.data));
  const publishSettings = publishSettingsWithLandingDefaults(
    parseStoredPublishSettings(found.row.publish_settings),
    landing
  );
  const requestedAssetIds = [
    publishSettings.ogAssetId,
    publishSettings.faviconAssetId,
  ].filter((value): value is string => Boolean(value));
  const validAssetIds = new Set<string>();
  if (requestedAssetIds.length) {
    const placeholders = requestedAssetIds.map(() => "?").join(", ");
    const assets = await getD1()
      .prepare(
        `SELECT id FROM assets
         WHERE project_id = ? AND id IN (${placeholders})`
      )
      .bind(found.row.id, ...requestedAssetIds)
      .all<{ id: string }>();
    for (const asset of assets.results || []) validAssetIds.add(asset.id);
  }
  return {
    id: found.row.id,
    name: found.row.name,
    slug: found.row.slug,
    redirected: found.redirected,
    landing,
    dashboardType:
      found.row.dashboard_type === "auto"
        ? inferDashboardType(landing)
        : found.row.dashboard_type === "orders"
          ? "orders"
          : "leads",
    publishSettings: {
      ...publishSettings,
      ogAssetId:
        publishSettings.ogAssetId && validAssetIds.has(publishSettings.ogAssetId)
          ? publishSettings.ogAssetId
          : null,
      faviconAssetId:
        publishSettings.faviconAssetId &&
        validAssetIds.has(publishSettings.faviconAssetId)
          ? publishSettings.faviconAssetId
          : null,
    },
  };
}


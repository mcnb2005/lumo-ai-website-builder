import { ensureDatabase, getD1 } from "../../db";
import { parseStoredPublishSettings } from "../publish-settings";

export type ProjectVersionReason =
  | "initial"
  | "autosave"
  | "before_ai"
  | "publish"
  | "before_restore";

const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_AUTOSAVE_VERSIONS = 50;

type SnapshotRow = {
  id: string;
  project_id: string;
  version_number: number;
  reason: ProjectVersionReason;
  data: string;
  messages: string;
  publish_settings: string;
  created_at: string;
};

function summary(row: SnapshotRow) {
  return {
    id: row.id,
    versionNumber: Number(row.version_number),
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export async function createProjectSnapshot(input: {
  projectId: string;
  userId: string;
  reason: ProjectVersionReason;
  force?: boolean;
}) {
  await ensureDatabase();
  const database = getD1();
  const project = await database
    .prepare(
      `SELECT data, messages, publish_settings, deleted_at
       FROM projects WHERE id = ? LIMIT 1`
    )
    .bind(input.projectId)
    .first<{
      data: string;
      messages: string;
      publish_settings: string;
      deleted_at: string | null;
    }>();
  if (!project || project.deleted_at) return null;

  const latest = await database
    .prepare(
      `SELECT id, project_id, version_number, reason, data, messages,
        publish_settings, created_at
       FROM project_versions
       WHERE project_id = ?
       ORDER BY version_number DESC
       LIMIT 1`
    )
    .bind(input.projectId)
    .first<SnapshotRow>();
  const unchanged =
    latest?.data === project.data &&
    latest.messages === project.messages &&
    latest.publish_settings === project.publish_settings;
  if (unchanged) return latest ? summary(latest) : null;

  if (
    !input.force &&
    input.reason === "autosave" &&
    latest?.created_at &&
    Date.now() - new Date(latest.created_at).getTime() < AUTOSAVE_INTERVAL_MS
  ) {
    return null;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO project_versions
       (id, project_id, version_number, reason, data, messages,
        publish_settings, created_by_id, created_at)
       SELECT ?, ?,
         COALESCE(MAX(version_number), 0) + 1,
         ?, ?, ?, ?, ?, ?
       FROM project_versions
       WHERE project_id = ?`
    )
    .bind(
      id,
      input.projectId,
      input.reason,
      project.data,
      project.messages,
      project.publish_settings,
      input.userId,
      createdAt,
      input.projectId
    )
    .run();

  await database
    .prepare(
      `DELETE FROM project_versions
       WHERE id IN (
         SELECT id FROM project_versions
         WHERE project_id = ? AND reason = 'autosave'
         ORDER BY version_number DESC
         LIMIT -1 OFFSET ?
       )`
    )
    .bind(input.projectId, MAX_AUTOSAVE_VERSIONS)
    .run();

  const inserted = await database
    .prepare(
      `SELECT id, project_id, version_number, reason, data, messages,
        publish_settings, created_at
       FROM project_versions WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first<SnapshotRow>();
  return inserted ? summary(inserted) : null;
}

export async function listProjectVersions(projectId: string) {
  await ensureDatabase();
  const result = await getD1()
    .prepare(
      `SELECT id, project_id, version_number, reason, data, messages,
        publish_settings, created_at
       FROM project_versions
       WHERE project_id = ?
       ORDER BY version_number DESC
       LIMIT 100`
    )
    .bind(projectId)
    .all<SnapshotRow>();
  return (result.results || []).map(summary);
}

export async function readProjectVersion(projectId: string, versionId: string) {
  await ensureDatabase();
  const row = await getD1()
    .prepare(
      `SELECT id, project_id, version_number, reason, data, messages,
        publish_settings, created_at
       FROM project_versions
       WHERE id = ? AND project_id = ?
       LIMIT 1`
    )
    .bind(versionId, projectId)
    .first<SnapshotRow>();
  if (!row) return null;
  return {
    ...summary(row),
    data: JSON.parse(row.data),
    messages: JSON.parse(row.messages),
    publishSettings: parseStoredPublishSettings(row.publish_settings),
  };
}

export async function restoreProjectVersion(input: {
  projectId: string;
  versionId: string;
  userId: string;
}) {
  const version = await readProjectVersion(input.projectId, input.versionId);
  if (!version) return null;
  await createProjectSnapshot({
    projectId: input.projectId,
    userId: input.userId,
    reason: "before_restore",
    force: true,
  });
  const now = new Date().toISOString();
  await getD1()
    .prepare(
      `UPDATE projects
       SET data = ?, messages = ?, publish_settings = ?, status = 'draft',
           published_at = NULL, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(
      JSON.stringify(version.data),
      JSON.stringify(version.messages),
      JSON.stringify(version.publishSettings),
      now,
      input.projectId
    )
    .run();
  return { ...version, updatedAt: now };
}


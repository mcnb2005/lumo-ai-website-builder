import { and, desc, eq } from "drizzle-orm";
import { ensureDatabase, getD1, getDb } from "../../../db";
import { leads, projects, recordNotifications } from "../../../db/schema";
import {
  notificationSummaryFromColumns,
  sendOwnerRecordNotification,
} from "../../server/owner-notifications";
import { getCurrentDatabaseUser } from "../../server-user";

const leadStatuses = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;

type LeadStatus = (typeof leadStatuses)[number];

function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    leadStatuses.includes(value as LeadStatus)
  );
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để xem khách hàng tiềm năng." },
        { status: 401 }
      );
    }
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) {
      return Response.json({ error: "Thiếu mã dự án." }, { status: 400 });
    }

    await ensureDatabase();
    const [project] = await getDb()
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.ownerId, user.id))
      )
      .limit(1);
    if (!project) {
      return Response.json(
        { error: "Bạn không có quyền xem dữ liệu này." },
        { status: 403 }
      );
    }

    const rows = await getDb()
      .select({
        id: leads.id,
        payload: leads.payload,
        status: leads.status,
        notes: leads.notes,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        notificationStatus: recordNotifications.status,
        notificationRecipientEmail: recordNotifications.recipientEmail,
        notificationAttemptCount: recordNotifications.attemptCount,
        notificationLastError: recordNotifications.lastError,
        notificationLastAttemptAt: recordNotifications.lastAttemptAt,
        notificationSentAt: recordNotifications.sentAt,
      })
      .from(leads)
      .leftJoin(
        recordNotifications,
        and(
          eq(recordNotifications.recordType, "lead"),
          eq(recordNotifications.recordId, leads.id)
        )
      )
      .where(eq(leads.projectId, projectId))
      .orderBy(desc(leads.createdAt))
      .limit(500);
    return Response.json({
      leads: rows.map((row) => ({
        id: row.id,
        values: JSON.parse(row.payload),
        status: isLeadStatus(row.status) ? row.status : "new",
        notes: row.notes || "",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt || row.createdAt,
        notification: notificationSummaryFromColumns(row),
      })),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách liên hệ.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json(
        { error: "Đăng nhập để cập nhật khách hàng." },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as {
      id?: string;
      projectId?: string;
      status?: unknown;
      notes?: unknown;
    };
    const id = payload.id?.trim();
    const projectId = payload.projectId?.trim();
    if (!id || !projectId || !isLeadStatus(payload.status)) {
      return Response.json(
        { error: "Thông tin cập nhật chưa hợp lệ." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const db = getDb();
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.ownerId, user.id))
      )
      .limit(1);
    if (!project) {
      return Response.json(
        { error: "Bạn không có quyền cập nhật dữ liệu này." },
        { status: 403 }
      );
    }

    const notes =
      typeof payload.notes === "string" ? payload.notes.trim().slice(0, 4000) : "";
    const updatedAt = new Date().toISOString();
    const updated = await db
      .update(leads)
      .set({
        status: payload.status,
        notes,
        updatedAt,
      })
      .where(and(eq(leads.id, id), eq(leads.projectId, projectId)))
      .returning({ id: leads.id });

    if (!updated.length) {
      return Response.json(
        { error: "Không tìm thấy khách hàng." },
        { status: 404 }
      );
    }

    return Response.json({
      lead: {
        id,
        status: payload.status,
        notes,
        updatedAt,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật khách hàng.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      slug?: string;
      values?: Record<string, string>;
    };
    const slug = payload.slug?.trim();
    const values = payload.values;
    if (!slug || !values || typeof values !== "object") {
      return Response.json(
        { error: "Thông tin gửi lên chưa hợp lệ." },
        { status: 400 }
      );
    }

    const safeValues = Object.fromEntries(
      Object.entries(values)
        .slice(0, 12)
        .map(([key, value]) => [
          key.slice(0, 80),
          String(value).trim().slice(0, 2000),
        ])
    );
    if (!Object.values(safeValues).some(Boolean)) {
      return Response.json(
        { error: "Hãy nhập ít nhất một thông tin." },
        { status: 400 }
      );
    }

    await ensureDatabase();
    const [project] = await getDb()
      .select({ id: projects.id, status: projects.status })
      .from(projects)
      .where(eq(projects.slug, slug))
      .limit(1);
    if (!project || project.status !== "published") {
      return Response.json(
        { error: "Landing page chưa được xuất bản." },
        { status: 404 }
      );
    }

    const serializedPayload = JSON.stringify(safeValues);
    const duplicate = await getD1()
      .prepare(
        `SELECT id
         FROM leads
         WHERE project_id = ?
           AND payload = ?
           AND created_at >= datetime('now', '-2 minutes')
         LIMIT 1`
      )
      .bind(project.id, serializedPayload)
      .first<{ id: string }>();
    if (duplicate) {
      return Response.json({ submitted: true, duplicate: true });
    }

    const id = crypto.randomUUID();
    await getDb().insert(leads).values({
      id,
      projectId: project.id,
      payload: serializedPayload,
    });
    await sendOwnerRecordNotification({
      projectId: project.id,
      recordType: "lead",
      recordId: id,
      origin: new URL(request.url).origin,
    }).catch(() => undefined);
    return Response.json({ submitted: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể gửi thông tin lúc này.",
      },
      { status: 500 }
    );
  }
}

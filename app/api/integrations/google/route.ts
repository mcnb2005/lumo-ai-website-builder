import { ensureDatabase, getD1 } from "../../../../db";
import { decryptGoogleRefreshToken } from "../../../google-auth";
import { getCurrentDatabaseUser } from "../../../server-user";

function unauthorized() {
  return Response.json(
    { error: "Đăng nhập để quản lý kết nối Google của bạn." },
    { status: 401 }
  );
}

export async function GET() {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) return unauthorized();

    await ensureDatabase();
    const connection = await getD1()
      .prepare(
        `SELECT connected_email, scopes, updated_at
         FROM google_connections WHERE user_id = ? LIMIT 1`
      )
      .bind(user.id)
      .first<{
        connected_email: string;
        scopes: string;
        updated_at: string;
      }>();

    return Response.json({
      connection: connection
        ? {
            connected: true,
            email: connection.connected_email,
            scopes: connection.scopes.split(" ").filter(Boolean),
            updatedAt: connection.updated_at,
          }
        : { connected: false },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể kiểm tra kết nối Google.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) return unauthorized();

    await ensureDatabase();
    const database = getD1();
    const connection = await database
      .prepare(
        `SELECT encrypted_refresh_token, token_iv
         FROM google_connections WHERE user_id = ? LIMIT 1`
      )
      .bind(user.id)
      .first<{
        encrypted_refresh_token: string;
        token_iv: string;
      }>();

    if (connection) {
      try {
        const refreshToken = await decryptGoogleRefreshToken(
          connection.encrypted_refresh_token,
          connection.token_iv
        );
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(
            refreshToken
          )}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
      } catch {
        // The local connection is still removed if Google already revoked it.
      }
      await database
        .prepare("DELETE FROM google_connections WHERE user_id = ?")
        .bind(user.id)
        .run();
    }

    return Response.json({ disconnected: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể ngắt kết nối Google.",
      },
      { status: 500 }
    );
  }
}

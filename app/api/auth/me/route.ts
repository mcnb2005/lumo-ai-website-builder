import { getCurrentDatabaseUser } from "../../../server-user";

export async function GET() {
  try {
    const user = await getCurrentDatabaseUser();
    if (!user) {
      return Response.json({ user: null }, { status: 401 });
    }
    return Response.json({ user });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể kiểm tra đăng nhập.",
      },
      { status: 500 }
    );
  }
}

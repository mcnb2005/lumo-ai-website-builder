import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeRelativeReturnPath } from "../../google-auth";
import { getCurrentDatabaseUser } from "../../server-user";
import { PasswordChangeForm } from "./PasswordChangeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đổi mật khẩu — Lumo",
  description: "Đổi mật khẩu tài khoản Lumo của bạn.",
};

export default async function AccountPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentDatabaseUser();
  const params = await searchParams;
  const returnTo = safeRelativeReturnPath(params.returnTo);
  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent("/account/password")}`);
  }

  return (
    <main className="login-shell password-change-shell">
      <section className="login-panel password-change-panel">
        <a className="login-brand login-brand-dark" href="/login">
          <span aria-hidden="true">✦</span>
          lumo
        </a>
        <div className="login-card">
          <PasswordChangeForm
            returnTo={returnTo}
            mustChangePassword={Boolean(user.mustChangePassword)}
          />
        </div>
      </section>
    </main>
  );
}

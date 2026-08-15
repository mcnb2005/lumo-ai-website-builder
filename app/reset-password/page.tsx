import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu — Lumo",
  description: "Đặt mật khẩu mới cho tài khoản Lumo.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="login-shell password-change-shell">
      <section className="login-panel password-change-panel">
        <a className="login-brand login-brand-dark" href="/login">
          <span aria-hidden="true">✦</span>
          lumo
        </a>
        <div className="login-card">
          <ResetPasswordForm token={params.token || ""} />
        </div>
      </section>
    </main>
  );
}

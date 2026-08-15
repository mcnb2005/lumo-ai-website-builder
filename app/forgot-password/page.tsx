import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Quên mật khẩu — Lumo",
  description: "Yêu cầu liên kết đặt lại mật khẩu Lumo.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="login-shell password-change-shell">
      <section className="login-panel password-change-panel">
        <a className="login-brand login-brand-dark" href="/login">
          <span aria-hidden="true">✦</span>
          lumo
        </a>
        <div className="login-card">
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}

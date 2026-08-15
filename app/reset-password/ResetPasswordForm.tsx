"use client";

import { FormEvent, useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (password !== confirmation) {
      setNotice("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể đặt lại mật khẩu.");
      }
      setCompleted(true);
      setNotice(result.message || "Đã đổi mật khẩu.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể đặt lại mật khẩu."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="password-change-form" onSubmit={submit}>
      <p className="login-eyebrow">BẢO MẬT TÀI KHOẢN</p>
      <h2>Đặt mật khẩu mới</h2>
      <p className="login-description">
        Mật khẩu mới phải có ít nhất 8 ký tự. Sau khi đổi, các phiên đăng nhập
        cũ sẽ được đăng xuất.
      </p>
      {!token ? (
        <div className="login-form-alert">
          Liên kết đặt lại mật khẩu chưa hợp lệ.
        </div>
      ) : null}
      {notice ? (
        <div className={`login-form-alert${completed ? " is-success" : ""}`}>
          {notice}
        </div>
      ) : null}
      {!completed && token ? (
        <>
          <label>
            Mật khẩu mới
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
            />
          </label>
          <label>
            Nhập lại mật khẩu mới
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
            />
          </label>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Đang lưu…" : "Lưu mật khẩu mới"}
          </button>
        </>
      ) : null}
      <a className="account-form-back" href="/login">
        {completed ? "Đăng nhập lại" : "← Quay lại đăng nhập"}
      </a>
    </form>
  );
}

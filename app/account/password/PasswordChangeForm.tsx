"use client";

import { FormEvent, useState } from "react";

export function PasswordChangeForm({
  returnTo,
  mustChangePassword,
}: {
  returnTo: string;
  mustChangePassword: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (newPassword !== confirmPassword) {
      setNotice("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          returnTo,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể đổi mật khẩu.");
      }
      window.location.replace(result.redirectTo || "/");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể đổi mật khẩu."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="password-change-form" onSubmit={submitPassword}>
      <p className="login-eyebrow">
        {mustChangePassword ? "MẬT KHẨU TẠM" : "BẢO MẬT TÀI KHOẢN"}
      </p>
      <h2>
        {mustChangePassword
          ? "Đổi mật khẩu để bắt đầu làm việc"
          : "Đổi mật khẩu tài khoản"}
      </h2>
      <p className="login-description">
        Nhập mật khẩu tạm do admin cấp, sau đó đặt mật khẩu riêng của bạn.
      </p>

      {notice ? <div className="login-form-alert">{notice}</div> : null}

      <label>
        Mật khẩu hiện tại
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <label>
        Mật khẩu mới
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label>
        Nhập lại mật khẩu mới
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <button type="submit" disabled={isSaving}>
        {isSaving ? "Đang lưu..." : "Lưu mật khẩu mới"}
      </button>
    </form>
  );
}

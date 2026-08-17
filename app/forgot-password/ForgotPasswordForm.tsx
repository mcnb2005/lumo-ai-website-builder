"use client";

import { FormEvent, useState } from "react";

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const result = (await response.json()) as { message?: string };
      setNotice(
        result.message ||
          "Nếu tài khoản có email hợp lệ, Lumo đã gửi liên kết đặt lại mật khẩu."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="password-change-form" onSubmit={submit}>
      <p className="login-eyebrow">KHÔI PHỤC TÀI KHOẢN</p>
      <h2>Quên mật khẩu?</h2>
      <p className="login-description">
        Nhập email hoặc tên tài khoản. Nếu tài khoản có email thật, Lumo sẽ gửi
        một liên kết có hiệu lực trong 30 phút.
      </p>
      {notice ? <div className="login-form-alert is-success">{notice}</div> : null}
      <label>
        Email hoặc tên tài khoản
        <input
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          maxLength={254}
          required
        />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Đang gửi…" : "Gửi liên kết đặt lại"}
      </button>
      <a className="account-form-back" href="/login">
        ← Quay lại đăng nhập
      </a>
    </form>
  );
}

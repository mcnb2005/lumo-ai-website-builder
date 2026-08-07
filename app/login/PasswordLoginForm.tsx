"use client";

import { FormEvent, useId, useState } from "react";

export function PasswordLoginForm({ returnTo }: { returnTo: string }) {
  const identifierId = useId();
  const passwordId = useId();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, returnTo }),
      });
      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể đăng nhập.");
      }
      window.location.replace(result.redirectTo || "/");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể đăng nhập."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="password-login-form" onSubmit={submitLogin}>
      {notice ? <div className="login-form-alert">{notice}</div> : null}
      <label className="sr-only" htmlFor={identifierId}>
        Tên đăng nhập hoặc email
      </label>
      <div className="password-input-shell">
        <span className="password-input-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </span>
        <input
          id={identifierId}
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="Email hoặc tên tài khoản"
          autoComplete="username"
          required
        />
      </div>
      <label className="sr-only" htmlFor={passwordId}>
        Mật khẩu
      </label>
      <div className="password-input-shell">
        <span className="password-input-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            <path d="M12 14v3" />
          </svg>
        </span>
        <input
          id={passwordId}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Nhập mật khẩu của bạn"
          autoComplete="current-password"
          required
        />
        <button
          type="button"
          className="password-visibility-button"
          aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={showPassword}
          onClick={() => setShowPassword((current) => !current)}
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <path d="M12 9a3 3 0 0 1 3 3 3 3 0 0 1-.88 2.12" />
            <path d="M9.88 14.12A3 3 0 0 1 12 9" />
            {!showPassword ? <path d="M4 4l16 16" /> : null}
          </svg>
        </button>
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}

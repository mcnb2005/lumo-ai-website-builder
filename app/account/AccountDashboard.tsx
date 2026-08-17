"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AccountInfo = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  companyName: string;
  companyRole: "owner" | "admin" | "member" | "viewer";
  hasPassword: boolean;
  createdAt: string | null;
};

type AccountSession = {
  id: string;
  userAgent: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Chưa xác định";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deviceName(userAgent: string | null) {
  if (!userAgent) return "Thiết bị không xác định";
  const browser = /Edg\//.test(userAgent)
    ? "Microsoft Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Trình duyệt";
  const device = /Mobile|Android|iPhone/i.test(userAgent)
    ? "điện thoại"
    : "máy tính";
  return `${browser} trên ${device}`;
}

export function AccountDashboard() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accountResponse, sessionsResponse] = await Promise.all([
        fetch("/api/account"),
        fetch("/api/account/sessions"),
      ]);
      const accountResult = (await accountResponse.json()) as {
        account?: AccountInfo;
        error?: string;
      };
      const sessionsResult = (await sessionsResponse.json()) as {
        sessions?: AccountSession[];
        error?: string;
      };
      if (!accountResponse.ok || !accountResult.account) {
        throw new Error(accountResult.error || "Không thể tải tài khoản.");
      }
      setAccount(accountResult.account);
      setSessions(sessionsResponse.ok ? sessionsResult.sessions || [] : []);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể tải tài khoản."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function revokeSession(sessionId: string) {
    setIsWorking(true);
    setNotice("");
    try {
      const response = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const result = (await response.json()) as {
        error?: string;
        currentRemoved?: boolean;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể đăng xuất phiên này.");
      }
      if (result.currentRemoved) {
        window.location.replace("/login");
        return;
      }
      setNotice("Đã đăng xuất phiên đã chọn.");
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể đăng xuất phiên này."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function revokeOtherSessions() {
    setIsWorking(true);
    setNotice("");
    try {
      const response = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allOthers: true }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể đăng xuất các phiên khác.");
      }
      setNotice("Đã đăng xuất tất cả phiên khác.");
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể đăng xuất các phiên khác."
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        "Xóa tài khoản sẽ đăng xuất bạn và gỡ các landing page đang công khai. Thao tác này không thể hoàn tác từ giao diện."
      )
    ) {
      return;
    }
    setIsWorking(true);
    setNotice("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa tài khoản.");
      }
      window.location.replace("/login");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể xóa tài khoản."
      );
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <main className="account-shell">
      <aside className="account-sidebar">
        <Link className="company-logo" href="/">
          <span>✦</span>
          lumo
        </Link>
        <p>TÀI KHOẢN</p>
        <nav>
          <a href="#profile">Thông tin cá nhân</a>
          <a href="#security">Bảo mật</a>
          <a href="#sessions">Phiên đăng nhập</a>
          <a href="#data">Dữ liệu của bạn</a>
        </nav>
        <Link className="company-back" href="/">
          ← Về trình tạo trang
        </Link>
      </aside>

      <section className="account-content">
        <header className="account-hero">
          <div>
            <p>TRUNG TÂM TÀI KHOẢN</p>
            <h1>Quản lý quyền riêng tư và bảo mật</h1>
          </div>
          {account ? (
            <span className="account-identity">
              <b>{account.name.slice(0, 1).toUpperCase()}</b>
              <span>
                <strong>{account.name}</strong>
                <small>{account.email}</small>
              </span>
            </span>
          ) : null}
        </header>

        {notice ? <div className="account-notice" aria-live="polite">{notice}</div> : null}
        {isLoading ? <div className="account-loading">Đang tải tài khoản…</div> : null}

        {account ? (
          <>
            <section className="account-panel" id="profile">
              <div className="account-panel-heading">
                <div>
                  <p>HỒ SƠ</p>
                  <h2>Thông tin cá nhân</h2>
                </div>
              </div>
              <dl className="account-profile-grid">
                <div><dt>Họ tên</dt><dd>{account.name}</dd></div>
                <div><dt>Email</dt><dd>{account.email}</dd></div>
                <div><dt>Tên đăng nhập</dt><dd>{account.username || "Chưa đặt"}</dd></div>
                <div><dt>Công ty</dt><dd>{account.companyName}</dd></div>
                <div><dt>Vai trò</dt><dd>{account.companyRole}</dd></div>
                <div><dt>Ngày tạo</dt><dd>{formatDate(account.createdAt)}</dd></div>
              </dl>
            </section>

            <section className="account-panel" id="security">
              <div className="account-panel-heading">
                <div>
                  <p>BẢO MẬT</p>
                  <h2>Mật khẩu</h2>
                </div>
                {account.hasPassword ? (
                  <a className="account-primary-action" href="/account/password?returnTo=%2Faccount">
                    Đổi mật khẩu
                  </a>
                ) : (
                  <span>Đang đăng nhập bằng Google</span>
                )}
              </div>
              <p className="account-panel-copy">
                Lumo giới hạn thử đăng nhập sai. Khi đặt lại mật khẩu, toàn bộ
                phiên đăng nhập cũ sẽ bị thu hồi.
              </p>
            </section>

            <section className="account-panel" id="sessions">
              <div className="account-panel-heading">
                <div>
                  <p>THIẾT BỊ</p>
                  <h2>Phiên đăng nhập</h2>
                </div>
                {sessions.some((session) => !session.isCurrent) ? (
                  <button type="button" disabled={isWorking} onClick={() => void revokeOtherSessions()}>
                    Đăng xuất các phiên khác
                  </button>
                ) : null}
              </div>
              <div className="account-session-list">
                {sessions.map((session) => (
                  <article key={session.id}>
                    <div className="account-session-icon" aria-hidden="true">▣</div>
                    <div>
                      <strong>
                        {deviceName(session.userAgent)}
                        {session.isCurrent ? <em>Phiên hiện tại</em> : null}
                      </strong>
                      <span>Hoạt động: {formatDate(session.lastSeenAt || session.createdAt)}</span>
                      <small>Hết hạn: {formatDate(session.expiresAt)}</small>
                    </div>
                    <button type="button" disabled={isWorking} onClick={() => void revokeSession(session.id)}>
                      Đăng xuất
                    </button>
                  </article>
                ))}
                {!sessions.length ? (
                  <p className="account-panel-copy">
                    Phiên đăng nhập local không dùng cookie nên không xuất hiện tại đây.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="account-panel" id="data">
              <div className="account-panel-heading">
                <div>
                  <p>DỮ LIỆU</p>
                  <h2>Tải dữ liệu cá nhân</h2>
                </div>
                <a className="account-primary-action" href="/api/account/export">
                  Tải file JSON
                </a>
              </div>
              <p className="account-panel-copy">
                File xuất gồm hồ sơ, tư cách thành viên, kết nối Google không
                chứa token bí mật và các project do bạn sở hữu.
              </p>
            </section>

            <section className="account-panel account-danger-zone">
              <div className="account-panel-heading">
                <div>
                  <p>VÙNG NGUY HIỂM</p>
                  <h2>Xóa tài khoản</h2>
                </div>
              </div>
              <p className="account-panel-copy">
                Nếu bạn là chủ công ty, hãy xử lý thành viên khác trước. Khi
                xóa, các trang của công ty một thành viên sẽ ngừng công khai.
              </p>
              <label>
                Nhập <strong>XOA TAI KHOAN</strong> để xác nhận
                <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
              </label>
              <button
                className="account-delete-button"
                type="button"
                disabled={isWorking || deleteConfirmation !== "XOA TAI KHOAN"}
                onClick={() => void deleteAccount()}
              >
                Xóa tài khoản của tôi
              </button>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

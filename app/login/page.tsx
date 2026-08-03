import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentDatabaseUser } from "../server-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng nhập — Lumo",
  description: "Đăng nhập để tạo và quản lý landing page bằng AI.",
};

export default async function LoginPage() {
  const user = await getCurrentDatabaseUser();
  if (user) redirect("/");

  return (
    <main className="login-shell">
      <section className="login-showcase" aria-label="Giới thiệu Lumo">
        <a className="login-brand login-brand-light" href="/login">
          <span aria-hidden="true">✦</span>
          lumo
        </a>

        <div className="login-showcase-copy">
          <p className="login-eyebrow">AI WEBSITE BUILDER</p>
          <h1>Biến ý tưởng thành landing page trong vài phút.</h1>
          <p>
            Tạo trang bằng AI, chỉnh sửa trực quan, quản lý khách hàng và toàn
            bộ dự án của công ty tại một nơi.
          </p>
        </div>

        <ul className="login-benefits">
          <li>
            <span aria-hidden="true">01</span>
            Chat với AI để tạo nội dung và bố cục
          </li>
          <li>
            <span aria-hidden="true">02</span>
            Kéo thả, xem trước và xuất bản tức thì
          </li>
          <li>
            <span aria-hidden="true">03</span>
            Phân quyền nhân viên và quản lý dự án tập trung
          </li>
        </ul>
      </section>

      <section className="login-panel">
        <a className="login-brand login-brand-dark" href="/login">
          <span aria-hidden="true">✦</span>
          lumo
        </a>

        <div className="login-card">
          <p className="login-eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          <h2>Đăng nhập để sử dụng Lumo</h2>
          <p className="login-description">
            Bạn cần đăng nhập bằng tài khoản Google trước khi tạo, chỉnh sửa
            hoặc quản lý landing page.
          </p>

          <a
            className="google-login-button"
            href="/api/auth/google/start?returnTo=%2F"
          >
            <span className="google-login-icon" aria-hidden="true">
              G
            </span>
            Đăng nhập bằng Google
          </a>

          <p className="login-note">
            Khi tiếp tục, bạn đồng ý sử dụng tài khoản theo chính sách của công
            ty. Landing page đã xuất bản vẫn có thể được khách hàng truy cập
            công khai.
          </p>
        </div>

        <p className="login-footer">© 2026 Lumo AI Website Builder</p>
      </section>
    </main>
  );
}

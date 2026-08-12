"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JoinResult = {
  joined?: boolean;
  companyName?: string;
  requiresTransfer?: boolean;
  currentCompanyName?: string;
  targetCompanyName?: string;
  message?: string;
  error?: string;
};

async function requestJoin(token: string, confirmTransfer: boolean) {
  const response = await fetch("/api/company/invitations/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, confirmTransfer }),
  });
  const payload = (await response.json()) as JoinResult;
  return { response, payload };
}

function redirectAfterJoin(payload: JoinResult) {
  if (payload.joined) {
    window.setTimeout(() => window.location.replace("/"), 900);
  }
}

export function CompanyJoin({ token }: { token: string }) {
  const [result, setResult] = useState<JoinResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function acceptTransfer() {
    setIsLoading(true);
    try {
      const { response, payload } = await requestJoin(token, true);
      setResult(payload);
      if (response.ok) redirectAfterJoin(payload);
    } catch {
      setResult({ error: "Không thể kết nối đến hệ thống." });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function acceptInvitation() {
      try {
        const { response, payload } = await requestJoin(token, false);
        if (cancelled) return;
        setResult(payload);
        if (response.ok) redirectAfterJoin(payload);
      } catch {
        if (!cancelled) {
          setResult({ error: "Không thể kết nối đến hệ thống." });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void acceptInvitation();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="company-join-page">
      <section>
        <Link className="company-logo company-join-logo" href="/">
          <span>✦</span>
          lumo
        </Link>
        <p>LỜI MỜI THÀNH VIÊN</p>
        {isLoading ? (
          <>
            <h1>Đang kiểm tra lời mời…</h1>
            <span>Vui lòng chờ trong giây lát.</span>
          </>
        ) : result?.joined ? (
          <>
            <h1>Đã tham gia {result.companyName}</h1>
            <span>
              Tài khoản của bạn đã được cấp quyền trong không gian công ty.
            </span>
            <Link className="company-join-primary" href="/">
              Bắt đầu tạo landing page
            </Link>
          </>
        ) : result?.requiresTransfer ? (
          <>
            <h1>Chuyển sang {result.targetCompanyName}</h1>
            <span>{result.message}</span>
            <div className="company-join-warning">
              Không gian hiện tại: <strong>{result.currentCompanyName}</strong>.
              Project của bạn vẫn được giữ và chuyển vào công ty mới.
            </div>
            <button
              className="company-join-primary"
              type="button"
              onClick={() => void acceptTransfer()}
            >
              Đồng ý chuyển và tham gia
            </button>
          </>
        ) : (
          <>
            <h1>Không thể nhận lời mời</h1>
            <span>{result?.error || "Lời mời không hợp lệ."}</span>
            <Link className="company-join-secondary" href="/">
              Quay về trang chủ
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

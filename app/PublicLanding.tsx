"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LandingCanvas } from "./components/LandingCanvas";
import { normalizeLandingData, type LandingData } from "./landing-data";
import type { ResolvedDashboardType } from "./dashboard-config";

export function PublicLanding({ slug }: { slug: string }) {
  const [landing, setLanding] = useState<LandingData | null>(null);
  const [dashboardType, setDashboardType] =
    useState<ResolvedDashboardType>("leads");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const result = (await response.json()) as {
          landing?: LandingData;
          dashboardType?: ResolvedDashboardType;
          error?: string;
        };
        if (!response.ok || !result.landing) {
          throw new Error(result.error || "Không tìm thấy landing page.");
        }
        setLanding(normalizeLandingData(result.landing));
        setDashboardType(result.dashboardType || "leads");
      })
      .catch((cause: Error) => setError(cause.message));
  }, [slug]);

  if (error) {
    return (
      <main className="public-state">
        <span>404</span>
        <h1>Landing page chưa sẵn sàng</h1>
        <p>{error}</p>
        <Link href="/">Quay lại Lumo</Link>
      </main>
    );
  }

  if (!landing) {
    return (
      <main className="public-state">
        <span className="loading-star">✦</span>
        <h1>Đang mở landing page…</h1>
      </main>
    );
  }

  return (
    <LandingCanvas
      data={landing}
      slug={slug}
      submissionType={dashboardType}
    />
  );
}

"use client";

import { useEffect, useState } from "react";
import { LandingCanvas } from "./components/LandingCanvas";
import { normalizeLandingData, type LandingData } from "./landing-data";

export function PublicLanding({ slug }: { slug: string }) {
  const [landing, setLanding] = useState<LandingData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const result = (await response.json()) as {
          landing?: LandingData;
          error?: string;
        };
        if (!response.ok || !result.landing) {
          throw new Error(result.error || "Không tìm thấy landing page.");
        }
        setLanding(normalizeLandingData(result.landing));
      })
      .catch((cause: Error) => setError(cause.message));
  }, [slug]);

  if (error) {
    return (
      <main className="public-state">
        <span>404</span>
        <h1>Landing page chưa sẵn sàng</h1>
        <p>{error}</p>
        <a href="/">Quay lại Lumo</a>
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

  return <LandingCanvas data={landing} slug={slug} />;
}

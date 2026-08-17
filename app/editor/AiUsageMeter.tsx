"use client";

import { useEffect, useState } from "react";
import type { AiUsageSummary } from "../ai-usage-contract";

function formatResetTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "vào ngày mai";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatTokens(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function AiUsageMeter({ refreshKey }: { refreshKey: number }) {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    void fetch("/api/ai/usage", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          usage?: AiUsageSummary;
          error?: string;
        };
        if (!response.ok || !result.usage) {
          throw new Error(result.error || "Không thể tải lượt AI.");
        }
        if (active) {
          setUsage(result.usage);
          setError("");
        }
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không thể tải lượt AI."
        );
      });

    return () => {
      active = false;
    };
  }, [refreshKey, retryKey]);

  if (!usage && error) {
    return (
      <div className="ai-usage-meter is-error" role="status">
        <span>Chưa tải được lượt AI.</span>
        <button
          type="button"
          onClick={() => {
            setError("");
            setRetryKey((value) => value + 1);
          }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="ai-usage-meter is-loading" role="status">
        Đang tải lượt AI…
      </div>
    );
  }

  const percentage = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const latest = usage.latest;
  const modelLabel = latest?.models.length
    ? latest.models.join(", ")
    : "Chưa có model gần nhất";
  const tokenLabel =
    latest?.totalTokens === null || latest?.totalTokens === undefined
      ? "Provider chưa trả token"
      : `${formatTokens(latest.totalTokens)} token`;
  const costLabel =
    latest?.costMicros === null || latest?.costMicros === undefined
      ? "Chi phí chưa có dữ liệu"
      : `Chi phí $${(latest.costMicros / 1_000_000).toFixed(4)}`;

  return (
    <section
      className={`ai-usage-meter${usage.remaining === 0 ? " is-exhausted" : ""}`}
      aria-label="Mức sử dụng AI hôm nay"
    >
      <div className="ai-usage-summary">
        <span>AI hôm nay</span>
        <strong>
          {usage.used}/{usage.limit} lượt
        </strong>
      </div>
      <div
        className="ai-usage-progress"
        role="progressbar"
        aria-label={`${usage.used} trên ${usage.limit} lượt AI đã dùng`}
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      <p>
        Còn {usage.remaining} lượt · Đặt lại {formatResetTime(usage.resetAt)}
      </p>
      {latest ? (
        <small title={`${modelLabel} · ${tokenLabel} · ${costLabel}`}>
          {modelLabel} · {tokenLabel} · {costLabel}
        </small>
      ) : null}
    </section>
  );
}

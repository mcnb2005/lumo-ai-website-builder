"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, LandingData } from "../landing-data";
import type { ProjectPublishSettings } from "../publish-settings";

export type ProjectVersionDetail = {
  id: string;
  versionNumber: number;
  reason: string;
  createdAt: string;
  data: LandingData;
  messages: ChatMessage[];
  publishSettings: ProjectPublishSettings;
};

type VersionSummary = Pick<
  ProjectVersionDetail,
  "id" | "versionNumber" | "reason" | "createdAt"
>;

const reasonLabels: Record<string, string> = {
  initial: "Khởi tạo dự án",
  autosave: "Tự động lưu",
  before_ai: "Trước khi AI chỉnh sửa",
  publish: "Đã xuất bản",
  before_restore: "Trước khi khôi phục",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionHistoryPanel({
  open,
  projectId,
  onClose,
  onPreview,
  onRestored,
}: {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onPreview: (version: ProjectVersionDetail | null) => void;
  onRestored: (version: ProjectVersionDetail) => void;
}) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState("");

  const loadVersions = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/versions`
      );
      const result = (await response.json()) as {
        versions?: VersionSummary[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể tải lịch sử phiên bản.");
      }
      setVersions(result.versions || []);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Không thể tải lịch sử phiên bản."
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadVersions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadVersions, open]);

  async function readVersion(versionId: string) {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(
        projectId
      )}/versions?versionId=${encodeURIComponent(versionId)}`
    );
    const result = (await response.json()) as {
      version?: ProjectVersionDetail;
      error?: string;
    };
    if (!response.ok || !result.version) {
      throw new Error(result.error || "Không thể mở phiên bản.");
    }
    return result.version;
  }

  async function previewVersion(versionId: string) {
    setIsWorking(true);
    setNotice("");
    try {
      const version = await readVersion(versionId);
      setSelectedId(versionId);
      onPreview(version);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể xem phiên bản.");
    } finally {
      setIsWorking(false);
    }
  }

  async function restoreVersion(version: VersionSummary) {
    if (
      !window.confirm(
        `Khôi phục phiên bản ${version.versionNumber}? Trạng thái hiện tại sẽ được lưu lại trước khi khôi phục.`
      )
    ) {
      return;
    }
    setIsWorking(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore", versionId: version.id }),
        }
      );
      const result = (await response.json()) as {
        restored?: ProjectVersionDetail;
        error?: string;
      };
      if (!response.ok || !result.restored) {
        throw new Error(result.error || "Không thể khôi phục phiên bản.");
      }
      onRestored(result.restored);
      onPreview(null);
      setSelectedId("");
      setNotice("Đã khôi phục thành bản nháp. Hãy kiểm tra rồi xuất bản lại.");
      await loadVersions();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể khôi phục phiên bản."
      );
    } finally {
      setIsWorking(false);
    }
  }

  if (!open) return null;
  return (
    <div className="studio-dialog-backdrop version-dialog-backdrop" role="presentation">
      <section
        className="version-history-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
      >
        <header>
          <div>
            <p>LỊCH SỬ DỰ ÁN</p>
            <h2 id="version-history-title">Các phiên bản đã lưu</h2>
          </div>
          <button
            type="button"
            className="studio-dialog-close"
            onClick={() => {
              onPreview(null);
              onClose();
            }}
            aria-label="Đóng lịch sử phiên bản"
          >
            ×
          </button>
        </header>

        {notice ? <p className="version-history-notice" aria-live="polite">{notice}</p> : null}
        <div className="version-history-list">
          {isLoading ? <p>Đang tải lịch sử…</p> : null}
          {!isLoading && !versions.length ? (
            <div className="version-history-empty">
              <strong>Chưa có snapshot</strong>
              <span>Lumo sẽ lưu trước khi AI chỉnh sửa và mỗi lần xuất bản.</span>
            </div>
          ) : null}
          {versions.map((version) => (
            <article
              key={version.id}
              className={selectedId === version.id ? "is-selected" : ""}
            >
              <div>
                <strong>Phiên bản {version.versionNumber}</strong>
                <span>{reasonLabels[version.reason] || "Bản đã lưu"}</span>
                <small>{formatDate(version.createdAt)}</small>
              </div>
              <div>
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => void previewVersion(version.id)}
                >
                  Xem trước
                </button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={isWorking}
                  onClick={() => void restoreVersion(version)}
                >
                  Khôi phục
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

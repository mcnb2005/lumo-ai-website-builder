"use client";

import { useEffect } from "react";
import type { LandingData, LandingImageAsset } from "../landing-data";
import {
  publishSettingsWithLandingDefaults,
  type ProjectPublishSettings,
} from "../publish-settings";

export function PublishSettingsDialog({
  open,
  landing,
  slug,
  settings,
  assets,
  isPublishing,
  onClose,
  onSlugChange,
  onSettingsChange,
  onPublish,
}: {
  open: boolean;
  landing: LandingData;
  slug: string;
  settings: ProjectPublishSettings;
  assets: LandingImageAsset[];
  isPublishing: boolean;
  onClose: () => void;
  onSlugChange: (slug: string) => void;
  onSettingsChange: (patch: Partial<ProjectPublishSettings>) => void;
  onPublish: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPublishing) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isPublishing, onClose, open]);

  if (!open) return null;
  const effective = publishSettingsWithLandingDefaults(settings, landing);
  const ogAsset = assets.find((asset) => asset.id === settings.ogAssetId);
  const faviconAsset = assets.find(
    (asset) => asset.id === settings.faviconAssetId
  );
  const publicPath = `/p/${slug || "duong-dan-cua-ban"}`;

  return (
    <div className="studio-dialog-backdrop" role="presentation">
      <section
        className="publish-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-settings-title"
      >
        <header>
          <div>
            <p>CÀI ĐẶT XUẤT BẢN</p>
            <h2 id="publish-settings-title">SEO và chia sẻ</h2>
          </div>
          <button
            type="button"
            className="studio-dialog-close"
            onClick={onClose}
            disabled={isPublishing}
            aria-label="Đóng cài đặt xuất bản"
          >
            ×
          </button>
        </header>

        <div className="publish-settings-grid">
          <div className="publish-settings-form">
            <label>
              Đường dẫn trang
              <span className="publish-slug-field">
                <b>/p/</b>
                <input
                  value={slug}
                  onChange={(event) => onSlugChange(event.target.value)}
                  maxLength={80}
                  pattern="[a-z0-9-]+"
                  autoComplete="off"
                  required
                />
              </span>
              <small>Slug cũ sẽ tự chuyển hướng sang slug mới.</small>
            </label>

            <label>
              SEO title
              <input
                value={settings.seoTitle}
                onChange={(event) =>
                  onSettingsChange({ seoTitle: event.target.value })
                }
                maxLength={70}
                placeholder={landing.headline || landing.brand}
              />
              <small>{settings.seoTitle.length}/70 ký tự</small>
            </label>

            <label>
              SEO description
              <textarea
                value={settings.seoDescription}
                onChange={(event) =>
                  onSettingsChange({ seoDescription: event.target.value })
                }
                maxLength={180}
                rows={3}
                placeholder={landing.description}
              />
              <small>{settings.seoDescription.length}/180 ký tự</small>
            </label>

            <label>
              Canonical URL
              <input
                type="url"
                value={settings.canonicalUrl}
                onChange={(event) =>
                  onSettingsChange({ canonicalUrl: event.target.value })
                }
                maxLength={2048}
                placeholder={`https://ten-mien-cua-ban.com${publicPath}`}
              />
              <small>Để trống để dùng URL xuất bản của Lumo.</small>
            </label>

            <div className="publish-asset-fields">
              <label>
                Ảnh Open Graph
                <select
                  value={settings.ogAssetId || ""}
                  onChange={(event) =>
                    onSettingsChange({ ogAssetId: event.target.value || null })
                  }
                >
                  <option value="">Không dùng ảnh</option>
                  {assets
                    .filter((asset) => asset.id)
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.alt || "Ảnh đã tải"}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Favicon
                <select
                  value={settings.faviconAssetId || ""}
                  onChange={(event) =>
                    onSettingsChange({
                      faviconAssetId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Dùng favicon Lumo</option>
                  {assets
                    .filter((asset) => asset.id)
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.alt || "Ảnh đã tải"}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <label className="publish-index-toggle">
              <input
                type="checkbox"
                checked={!settings.noIndex}
                onChange={(event) =>
                  onSettingsChange({ noIndex: !event.target.checked })
                }
              />
              <span>
                <strong>Cho phép công cụ tìm kiếm lập chỉ mục</strong>
                <small>Tắt tùy chọn này để thêm noindex, nofollow.</small>
              </span>
            </label>
          </div>

          <aside className="social-preview-panel" aria-label="Bản xem trước chia sẻ">
            <div className="social-preview-heading">
              <div>
                <span>Facebook</span>
                <span>Zalo</span>
              </div>
              {faviconAsset ? (
                <i
                  aria-label={`Favicon: ${faviconAsset.alt}`}
                  style={{ backgroundImage: `url("${faviconAsset.url}")` }}
                />
              ) : null}
            </div>
            <div className="social-preview-card">
              <div
                className={`social-preview-image${ogAsset ? " has-image" : ""}`}
                style={
                  ogAsset
                    ? { backgroundImage: `url("${ogAsset.url}")` }
                    : undefined
                }
                role="img"
                aria-label={ogAsset?.alt || "Chưa chọn ảnh Open Graph"}
              >
                {!ogAsset ? <span>Chọn ảnh Open Graph để xem preview</span> : null}
              </div>
              <div className="social-preview-copy">
                <small>{settings.canonicalUrl || publicPath}</small>
                <strong>{effective.seoTitle}</strong>
                <p>{effective.seoDescription}</p>
              </div>
            </div>
            <p>
              Mạng xã hội có thể lưu cache bản xem trước cũ trong một khoảng thời
              gian sau khi bạn xuất bản lại.
            </p>
          </aside>
        </div>

        <footer>
          <button type="button" onClick={onClose} disabled={isPublishing}>
            Để sau
          </button>
          <button
            className="is-primary"
            type="button"
            onClick={onPublish}
            disabled={isPublishing || !slug.trim()}
          >
            {isPublishing ? "Đang xuất bản…" : "Xuất bản ngay"}
          </button>
        </footer>
      </section>
    </div>
  );
}

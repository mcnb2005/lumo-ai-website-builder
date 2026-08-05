"use client";

import type {
  LandingData,
  LandingSectionColors,
  LandingSectionType,
} from "../landing-data";
import { sectionRegistry } from "./section-registry";

type SectionColorToken = keyof LandingSectionColors;

type SectionColorPanelProps = {
  landing: LandingData;
  selectedSection: LandingSectionType | null;
  isBusy: boolean;
  onSetColor: (
    section: LandingSectionType,
    token: SectionColorToken,
    value: string
  ) => void;
  onResetColors: (section: LandingSectionType) => void;
  onToggleVisibility: (section: LandingSectionType) => void;
};

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4)
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function ColorField({
  label,
  value,
  inherited,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  inherited: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="section-color-field">
      <span>
        <strong>{label}</strong>
        <small>{inherited ? "Màu toàn trang" : "Màu riêng"}</small>
      </span>
      <span className="section-color-field__control">
        <code>{value.toUpperCase()}</code>
        <input
          type="color"
          value={value}
          disabled={disabled}
          aria-label={`Chọn ${label.toLowerCase()}`}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

export function SectionColorPanel({
  landing,
  selectedSection,
  isBusy,
  onSetColor,
  onResetColors,
  onToggleVisibility,
}: SectionColorPanelProps) {
  if (!selectedSection) {
    return (
      <aside className="section-color-panel" aria-label="Màu của section">
        <header className="section-color-panel__header">
          <small>MÀU SECTION</small>
          <strong>Chưa chọn section</strong>
        </header>
        <p className="section-color-panel__empty">
          Chọn một khối trong danh sách hoặc trên bản xem trước để đổi màu riêng.
        </p>
      </aside>
    );
  }

  const overrides = landing.sectionColors[selectedSection] ?? {};
  const resolved = {
    background: overrides.background ?? landing.palette.paper,
    text: overrides.text ?? landing.palette.ink,
    accent: overrides.accent ?? landing.palette.accent,
  };
  const ratio = contrastRatio(resolved.text, resolved.background);
  const hasOverrides = Object.keys(overrides).length > 0;
  const isHidden = landing.hiddenSections.includes(selectedSection);

  return (
    <aside className="section-color-panel" aria-label="Màu của section">
      <header className="section-color-panel__header">
        <small>MÀU SECTION</small>
        <strong>{sectionRegistry[selectedSection].label}</strong>
      </header>

      <div
        className="section-color-panel__preview"
        style={{
          backgroundColor: resolved.background,
          color: resolved.text,
          borderColor: resolved.accent,
        }}
        aria-label="Xem trước bảng màu"
      >
        <span>Màu chữ</span>
        <i style={{ backgroundColor: resolved.accent }} aria-hidden="true" />
      </div>

      <div className="section-color-panel__fields">
        <ColorField
          label="Màu nền"
          value={resolved.background}
          inherited={!overrides.background}
          disabled={isBusy}
          onChange={(value) =>
            onSetColor(selectedSection, "background", value)
          }
        />
        <ColorField
          label="Màu chữ"
          value={resolved.text}
          inherited={!overrides.text}
          disabled={isBusy}
          onChange={(value) => onSetColor(selectedSection, "text", value)}
        />
        <ColorField
          label="Màu nhấn"
          value={resolved.accent}
          inherited={!overrides.accent}
          disabled={isBusy}
          onChange={(value) => onSetColor(selectedSection, "accent", value)}
        />
      </div>

      <p
        className={`section-color-panel__contrast${
          ratio >= 4.5 ? " is-good" : " is-warning"
        }`}
      >
        <span aria-hidden="true">{ratio >= 4.5 ? "✓" : "!"}</span>
        {ratio >= 4.5
          ? `Tương phản tốt (${ratio.toFixed(1)}:1)`
          : `Nên tăng tương phản (${ratio.toFixed(1)}:1)`}
      </p>

      <button
        className="section-color-panel__reset"
        type="button"
        disabled={isBusy || !hasOverrides}
        onClick={() => onResetColors(selectedSection)}
      >
        Dùng màu toàn trang
      </button>
      <button
        className="section-color-panel__visibility"
        type="button"
        disabled={isBusy || selectedSection === "finalCta"}
        onClick={() => onToggleVisibility(selectedSection)}
      >
        {isHidden ? "Hiện section" : "Ẩn section"}
      </button>
    </aside>
  );
}

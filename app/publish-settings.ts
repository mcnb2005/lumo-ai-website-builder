import type { LandingData } from "./landing-data";

export type ProjectPublishSettings = {
  seoTitle: string;
  seoDescription: string;
  ogAssetId: string | null;
  faviconAssetId: string | null;
  canonicalUrl: string;
  noIndex: boolean;
};

export const defaultPublishSettings: ProjectPublishSettings = {
  seoTitle: "",
  seoDescription: "",
  ogAssetId: null,
  faviconAssetId: null,
  canonicalUrl: "",
  noIndex: false,
};

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function assetId(value: unknown) {
  const normalized = text(value, 100);
  return normalized || null;
}

export function normalizePublishSettings(
  value: unknown
): ProjectPublishSettings {
  if (!value || typeof value !== "object") {
    return { ...defaultPublishSettings };
  }
  const raw = value as Record<string, unknown>;
  const canonicalUrl = text(raw.canonicalUrl, 2048);
  if (canonicalUrl) {
    let parsed: URL;
    try {
      parsed = new URL(canonicalUrl);
    } catch {
      throw new Error("Canonical URL chưa đúng định dạng.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Canonical URL phải bắt đầu bằng http:// hoặc https://.");
    }
  }
  return {
    seoTitle: text(raw.seoTitle, 70),
    seoDescription: text(raw.seoDescription, 180),
    ogAssetId: assetId(raw.ogAssetId),
    faviconAssetId: assetId(raw.faviconAssetId),
    canonicalUrl,
    noIndex: raw.noIndex === true,
  };
}

export function parseStoredPublishSettings(value: string | null | undefined) {
  try {
    return normalizePublishSettings(value ? JSON.parse(value) : null);
  } catch {
    return { ...defaultPublishSettings };
  }
}

export function publishSettingsWithLandingDefaults(
  settings: ProjectPublishSettings,
  landing: LandingData
) {
  return {
    ...settings,
    seoTitle: settings.seoTitle || landing.headline || landing.brand,
    seoDescription:
      settings.seoDescription || landing.description,
  };
}

export function normalizeProjectSlug(value: unknown) {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80)
    : "";
}

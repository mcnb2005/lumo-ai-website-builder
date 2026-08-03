import type { LandingImageAsset, LandingImageTarget } from "./landing-data";

export const LUMO_ASSET_DRAG_TYPE = "application/x-lumo-asset";
export const LUMO_ASSET_TEXT_PREFIX = "lumo-asset:";

export type LandingImageDragPayload = {
  asset: LandingImageAsset;
  source?: LandingImageTarget;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLandingImageTarget(value: unknown): value is LandingImageTarget {
  return (
    value === "hero" ||
    value === "gallery:add" ||
    (typeof value === "string" && /^(gallery|portfolio):\d+$/.test(value))
  );
}

export function createLandingImageDragPayload(
  asset: LandingImageAsset,
  source?: LandingImageTarget
) {
  const serialized = JSON.stringify(source ? { asset, source } : { asset });

  return {
    custom: serialized,
    text: `${LUMO_ASSET_TEXT_PREFIX}${serialized}`,
  };
}

export function parseLandingImageDragPayload(
  customPayload: string,
  textPayload: string
): LandingImageDragPayload | null {
  const custom = customPayload.trim();
  const text = textPayload.trim();
  const serialized = custom
    ? custom
    : text.startsWith(LUMO_ASSET_TEXT_PREFIX)
      ? text.slice(LUMO_ASSET_TEXT_PREFIX.length)
      : "";

  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    const wrapped = isRecord(parsed) && isRecord(parsed.asset);
    const rawAsset = wrapped ? parsed.asset : parsed;

    if (!isRecord(rawAsset) || typeof rawAsset.url !== "string") return null;

    const url = rawAsset.url.trim();
    if (!url) return null;

    const alt =
      typeof rawAsset.alt === "string" && rawAsset.alt.trim()
        ? rawAsset.alt.trim()
        : "Ảnh tải lên";
    const id = typeof rawAsset.id === "string" ? rawAsset.id : undefined;
    const source =
      wrapped && isLandingImageTarget(parsed.source) ? parsed.source : undefined;

    return {
      asset: {
        ...(id ? { id } : {}),
        url,
        alt,
      },
      ...(source ? { source } : {}),
    };
  } catch {
    return null;
  }
}

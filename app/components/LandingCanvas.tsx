"use client";

import {
  Children,
  type DragEvent as ReactDragEvent,
  FormEvent,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useState,
  useRef,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type {
  LandingData,
  LandingImageAsset,
  LandingImageFit,
  LandingImagePosition,
  LandingImageTarget,
  LandingSectionType,
} from "../landing-data";
import type { ResolvedDashboardType } from "../dashboard-config";
import {
  createLandingImageDragPayload,
  LUMO_ASSET_DRAG_TYPE,
  parseLandingImageDragPayload,
} from "../image-drag-payload";
import { InlineEditableText } from "../editor/InlineEditableText";
import { SortableSectionFrame } from "../editor/SortableSectionFrame";
import type { LandingTextEdit } from "../editor/inline-editing";

type LandingCanvasProps = {
  data: LandingData;
  compact?: boolean;
  slug?: string;
  submissionType?: ResolvedDashboardType;
  mode?: "public" | "editor";
  selectedSection?: LandingSectionType | null;
  sectionOrder?: LandingSectionType[];
  onSelectSection?: (section: LandingSectionType) => void;
  onReorderSections?: (activeId: LandingSectionType, overId: LandingSectionType) => void;
  onDropImage?: (
    target: LandingImageTarget,
    payload: {
      files?: File[];
      asset?: LandingImageAsset;
      source?: LandingImageTarget;
    }
  ) => void;
  onRemoveImage?: (target: LandingImageTarget) => void;
  onEditText?: (edit: LandingTextEdit) => void;
  onPositionChange?: (target: LandingImageTarget, position: string) => void;
  isBusy?: boolean;
};

type ImageDropZoneProps = {
  target: LandingImageTarget;
  label: string;
  hasImage?: boolean;
  asset?: LandingImageAsset;
  children?: ReactNode;
  onDropImage?: LandingCanvasProps["onDropImage"];
  onRemoveImage?: LandingCanvasProps["onRemoveImage"];
};

function readLandingImageDrop(dataTransfer: DataTransfer) {
  const files = Array.from(dataTransfer.files).filter((file) =>
    file.type.startsWith("image/")
  );
  if (files.length) return { files };

  return parseLandingImageDragPayload(
    dataTransfer.getData(LUMO_ASSET_DRAG_TYPE),
    dataTransfer.getData("text/plain")
  );
}

function ImageDropZone({
  target,
  label,
  hasImage = false,
  asset,
  children,
  onDropImage,
  onRemoveImage,
}: ImageDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    const payload = readLandingImageDrop(event.dataTransfer);
    if (payload) onDropImage?.(target, payload);
  }

  return (
    <div
      className={`image-drop-zone${isDragActive ? " is-drag-active" : ""}${
        hasImage ? " has-image" : " is-empty"
      }`}
      draggable={Boolean(asset)}
      onDragStart={(event) => {
        if (!asset) return;
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "copyMove";
        const payload = createLandingImageDragPayload(asset, target);
        event.dataTransfer.setData(LUMO_ASSET_DRAG_TYPE, payload.custom);
        event.dataTransfer.setData("text/plain", payload.text);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = asset ? "move" : "copy";
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragActive(false);
        }
      }}
      onDrop={handleDrop}
    >
      {children}
      <span className="image-drop-label">{label}</span>
      {hasImage && onRemoveImage ? (
        <button
          className="image-remove-button"
          type="button"
          aria-label={`Xóa ${label.toLowerCase()}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemoveImage(target);
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

type HeroVariantFrameProps = {
  variant?: string;
  hasImage: boolean;
  children: ReactNode;
};

function heroFrameClass(variant: string, hasImage: boolean) {
  return `landing-hero variant-${variant}${hasImage ? " has-image" : ""}`;
}

function HeroSplitFrame({
  items,
  hasImage,
}: {
  items: ReactNode[];
  hasImage: boolean;
}) {
  return (
    <section className={heroFrameClass("split", hasImage)}>
      {items[0]}
      <div className="hero-split-copy">{items[1]}</div>
      {items[2] ? <aside className="hero-split-media">{items[2]}</aside> : null}
    </section>
  );
}

function HeroCenteredFrame({
  items,
  hasImage,
}: {
  items: ReactNode[];
  hasImage: boolean;
}) {
  return (
    <section className={heroFrameClass("centered", hasImage)}>
      {items[0]}
      <div className="hero-centered-content">{items[1]}</div>
      {items[2] ? <div className="hero-centered-media">{items[2]}</div> : null}
    </section>
  );
}

function HeroProductShowcaseFrame({
  items,
  hasImage,
}: {
  items: ReactNode[];
  hasImage: boolean;
}) {
  return (
    <section className={heroFrameClass("product-showcase", hasImage)}>
      {items[0]}
      <div className="hero-product-copy">{items[1]}</div>
      {items[2] ? <aside className="hero-product-media">{items[2]}</aside> : null}
    </section>
  );
}

function HeroImageBackgroundFrame({
  items,
  hasImage,
}: {
  items: ReactNode[];
  hasImage: boolean;
}) {
  return (
    <section className={heroFrameClass("image-background", hasImage)}>
      {items[2] ? <div className="hero-background-media">{items[2]}</div> : null}
      <div className="hero-background-copy">{items[1]}</div>
    </section>
  );
}

function HeroEditorDropSurface({
  children,
  onDropImage,
}: {
  children: ReactNode;
  onDropImage?: LandingCanvasProps["onDropImage"];
}) {
  const [isDragActive, setIsDragActive] = useState(false);

  return (
    <div
      className={`hero-editor-drop-surface${
        isDragActive ? " is-drag-active" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragActive(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        const payload = readLandingImageDrop(event.dataTransfer);
        if (payload) onDropImage?.("hero", payload);
      }}
    >
      {children}
    </div>
  );
}

function HeroMinimalFrame({
  items,
}: {
  items: ReactNode[];
  hasImage: boolean;
}) {
  return (
    <section className={heroFrameClass("minimal", false)}>
      <div className="hero-minimal-content">{items[1]}</div>
    </section>
  );
}

const heroVariantFrames = {
  split: HeroSplitFrame,
  centered: HeroCenteredFrame,
  "product-showcase": HeroProductShowcaseFrame,
  "image-background": HeroImageBackgroundFrame,
  minimal: HeroMinimalFrame,
} as const;

function HeroVariantFrame({
  variant,
  hasImage,
  children,
}: HeroVariantFrameProps) {
  const preferred =
    variant && variant in heroVariantFrames
      ? (variant as keyof typeof heroVariantFrames)
      : "split";
  const resolved = hasImage ? preferred : "centered";
  const Frame = heroVariantFrames[resolved];
  const items = Children.toArray(children);
  const frameItems =
    !hasImage && preferred === "image-background"
      ? [null, items[1], items[2]]
      : items;
  return <Frame items={frameItems} hasImage={hasImage} />;
}

function fieldName(label: string, index: number) {
  const normalized = normalizedFieldLabel(label)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${normalized || "field"}_${index + 1}`;
}

function normalizedFieldLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function imagePresentationStyle(
  fit: LandingImageFit | undefined,
  position: LandingImagePosition | undefined,
  fallbackFit: LandingImageFit = "cover"
): CSSProperties {
  const resolvedFit = fit || fallbackFit;
  return {
    objectFit: resolvedFit === "smart" ? "contain" : resolvedFit,
    objectPosition: position || "center",
  };
}

function PresentedImage({
  src,
  alt,
  fit,
  position,
  fallbackFit = "cover",
  loading,
  isEditable = false,
  onPositionChange,
}: {
  src: string;
  alt: string;
  fit: LandingImageFit | undefined;
  position: LandingImagePosition | undefined;
  fallbackFit?: LandingImageFit;
  loading?: "eager" | "lazy";
  isEditable?: boolean;
  onPositionChange?: (position: string) => void;
}) {
  const [positionDraft, setPositionDraft] = useState<{
    source: LandingImagePosition | undefined;
    value: string | null;
  }>({ source: position, value: null });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const currentPercent = useRef({ x: 50, y: 50 });
  const localPos = positionDraft.source === position ? positionDraft.value : null;

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!isEditable) return;
    const resolvedFit = fit || fallbackFit;
    if (resolvedFit !== "cover") return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };

    let px = 50, py = 50;
    const posStr = localPos || position || "center";
    if (posStr === "center") { px = 50; py = 50; }
    else if (posStr === "top") { px = 50; py = 0; }
    else if (posStr === "bottom") { px = 50; py = 100; }
    else if (posStr === "left") { px = 0; py = 50; }
    else if (posStr === "right") { px = 100; py = 50; }
    else {
      const match = posStr.match(/^(\d+(\.\d+)?)% (\d+(\.\d+)?)%$/);
      if (match) {
        px = parseFloat(match[1]);
        py = parseFloat(match[3]);
      }
    }
    currentPercent.current = { x: px, y: py };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!isDragging) return;
    const img = e.currentTarget;

    const dw = img.clientWidth;
    const dh = img.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;

    if (!nw || !nh) return;

    const scale = Math.max(dw / nw, dh / nh);
    const sw = nw * scale;
    const sh = nh * scale;

    const dx_max = sw - dw;
    const dy_max = sh - dh;

    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    let dPx = 0;
    if (dx_max > 0) dPx = -(dx / dx_max) * 100;

    let dPy = 0;
    if (dy_max > 0) dPy = -(dy / dy_max) * 100;

    let { x, y } = currentPercent.current;
    x = Math.max(0, Math.min(100, x + dPx));
    y = Math.max(0, Math.min(100, y + dPy));

    currentPercent.current = { x, y };
    setPositionDraft({
      source: position,
      value: `${x.toFixed(2)}% ${y.toFixed(2)}%`,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (localPos && onPositionChange) {
      onPositionChange(localPos);
    }
  };

  if (fit === "smart") {
    return (
      <span className="smart-image-frame">
        <img
          className="smart-image-background"
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{ objectPosition: position || "center" }}
        />
        <img
          className="smart-image-foreground"
          src={src}
          alt={alt}
          loading={loading}
          draggable={false}
          style={imagePresentationStyle("contain", position)}
        />
      </span>
    );
  }

  const resolvedFit = fit || fallbackFit;
  const style = imagePresentationStyle(fit, localPos || position, fallbackFit);

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      draggable={false}
      style={{
        ...style,
        cursor: isEditable && resolvedFit === "cover" ? (isDragging ? "grabbing" : "grab") : undefined,
        touchAction: isEditable && resolvedFit === "cover" ? "none" : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}

export function LandingCanvas({
  data,
  compact = false,
  slug,
  submissionType = "leads",
  mode = "public",
  selectedSection = null,
  sectionOrder,
  onSelectSection,
  onReorderSections,
  onDropImage,
  onRemoveImage,
  onEditText,
  onPositionChange,
  isBusy = false,
}: LandingCanvasProps) {
  const [formState, setFormState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [formError, setFormError] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const style = {
    "--site-ink": data.palette.ink,
    "--site-paper": data.palette.paper,
    "--site-accent": data.palette.accent,
    "--site-soft": data.palette.soft,
    "--site-line": data.palette.line,
  } as CSSProperties;
  function handlePreviewNavigation(event: MouseEvent<HTMLElement>) {
    if (!compact) return;

    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;

    event.preventDefault();
    const href = anchor.getAttribute("href");
    if (!href?.startsWith("#")) return;

    const scroller = event.currentTarget.closest(".preview-scroll");
    const destination = event.currentTarget.querySelector<HTMLElement>(href);
    if (!scroller || !destination) return;

    const destinationTop =
      destination.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;
    scroller.scrollTo({ top: destinationTop, behavior: "smooth" });
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "editor") {
      onSelectSection?.("leadForm");
      return;
    }
    if (compact) return;
    if (!slug) {
      setFormState("error");
      setFormError("Form sẽ hoạt động sau khi landing page được xuất bản.");
      return;
    }

    setFormState("sending");
    setFormError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = Object.fromEntries(
      Array.from(form.entries()).map(([key, value]) => [key, String(value)])
    );

    try {
      const isOrder = submissionType === "orders";
      const response = await fetch(isOrder ? "/api/orders" : "/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, values }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Không thể gửi thông tin.");
      }
      formElement.reset();
      setFormState("sent");
      if (result.message) {
        setFormError(result.message);
      }
    } catch (error) {
      setFormState("error");
      setFormError(
        error instanceof Error ? error.message : "Không thể gửi thông tin."
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorderSections?.(active.id as LandingSectionType, over.id as LandingSectionType);
  }

  function editableText(
    section: LandingSectionType,
    value: string,
    label: string,
    edit: Omit<LandingTextEdit, "value">,
    multiline = false
  ) {
    return (
      <InlineEditableText
        value={value}
        label={label}
        multiline={multiline}
        onActivate={() => onSelectSection?.(section)}
        onCommit={
          mode === "editor" && !isBusy && onEditText
            ? (nextValue) =>
                onEditText({ ...edit, section, value: nextValue })
            : undefined
        }
      />
    );
  }

  function variantClass(section: LandingSectionType) {
    const variant = data.design?.sectionVariants[section];
    return variant && /^[a-z0-9-]+$/.test(variant)
      ? ` variant-${variant}`
      : "";
  }

  function sectionThemeStyle(section: LandingSectionType) {
    const colors = data.sectionColors[section];
    if (!colors) return undefined;

    const themedStyle: CSSProperties = {};
    if (colors.background) {
      themedStyle.backgroundColor = colors.background;
      Object.assign(themedStyle, {
        "--site-paper": colors.background,
        "--site-soft": colors.background,
      });
    }
    if (colors.text) {
      themedStyle.color = colors.text;
      Object.assign(themedStyle, { "--site-ink": colors.text });
    }
    if (colors.accent) {
      Object.assign(themedStyle, { "--site-accent": colors.accent });
    }
    if (colors.background || colors.text) {
      const lineText = colors.text ?? data.palette.ink;
      const lineBackground = colors.background ?? data.palette.paper;
      Object.assign(themedStyle, {
        "--site-line": `color-mix(in srgb, ${lineText} 18%, ${lineBackground})`,
      });
    }
    return themedStyle;
  }

  function renderSection(section: LandingSectionType) {
    const content = (() => {
      switch (section) {
      case "hero":
        return (
          <HeroEditorDropSurface
            onDropImage={mode === "editor" ? onDropImage : undefined}
          >
            <HeroVariantFrame
              variant={data.design?.sectionVariants.hero}
              hasImage={Boolean(data.heroImage)}
              key={section}
            >
              <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
              <div className="hero-copy">
              <p className="landing-eyebrow">
                <span />
                {editableText("hero", data.eyebrow, "Nhãn mở đầu", {
                  field: "eyebrow",
                })}
              </p>
              <h1>
                {editableText("hero", data.headline, "Tiêu đề chính", {
                  field: "headline",
                })}
                <em>
                  {editableText("hero", data.accentLine, "Dòng nhấn tiêu đề", {
                    field: "accentLine",
                  })}
                </em>
              </h1>
              <p className="landing-description">
                {editableText("hero", data.description, "Mô tả mở đầu", {
                  field: "description",
                }, true)}
              </p>
              <div className="landing-actions">
                <a className="button-primary" href="#contact">
                  {editableText("hero", data.primaryCta, "Nút chính", {
                    field: "primaryCta",
                  })}
                  <span aria-hidden="true">↗</span>
                </a>
                <a className="button-secondary" href="#features">
                  <span className="play-dot" aria-hidden="true">▶</span>
                  {editableText("hero", data.secondaryCta, "Nút phụ", {
                    field: "secondaryCta",
                  })}
                </a>
              </div>
              <div className="trust-row">
                <div className="avatar-stack" aria-hidden="true">
                  <span>MA</span><span>HN</span><span>KT</span>
                </div>
                <p>
                  {editableText("hero", data.proof, "Thông tin tạo niềm tin", {
                    field: "proof",
                  })}
                </p>
              </div>
              </div>
              {mode === "editor" ? (
                <div className="hero-image-wrap">
                  <ImageDropZone
                  target="hero"
                  label={
                    data.heroImage
                      ? "Thả ảnh để thay ảnh Hero"
                      : "Thả ảnh Hero vào đây"
                  }
                  hasImage={Boolean(data.heroImage)}
                  asset={
                    data.heroImage
                      ? {
                          url: data.heroImage,
                          alt: `Hình ảnh nổi bật của ${data.brand}`,
                        }
                      : undefined
                  }
                  onDropImage={onDropImage}
                  onRemoveImage={onRemoveImage}
                >
                  {data.heroImage ? (
                    <PresentedImage
                      src={data.heroImage}
                      alt={`Hình ảnh nổi bật của ${data.brand}`}
                      fit={data.heroImageFit}
                      position={data.heroImagePosition}
                      fallbackFit="contain"
                      isEditable={mode === "editor"}
                      onPositionChange={(pos) => onPositionChange?.("hero", pos)}
                    />
                  ) : null}
                  </ImageDropZone>
                </div>
              ) : data.heroImage ? (
                <div className="hero-image-wrap">
                  <PresentedImage
                  src={data.heroImage}
                  alt={`Hình ảnh nổi bật của ${data.brand}`}
                  fit={data.heroImageFit}
                  position={data.heroImagePosition}
                  fallbackFit="contain"
                  isEditable={false}
                  onPositionChange={(pos) => onPositionChange?.("hero", pos)}
                  />
                </div>
              ) : null}
            </HeroVariantFrame>
          </HeroEditorDropSurface>
        );
      case "stats": {
        const statsTextSizes = data.design?.sectionTextSizes?.stats;
        return (
          <section
            className={`stats-grid${variantClass("stats")} stats-value-size-${statsTextSizes?.value || "md"} stats-label-size-${statsTextSizes?.label || "md"}`}
            aria-label="Kết quả nổi bật"
            key={section}
          >
            {data.stats.map((stat, index) => (
              <div className="stat-card" key={`${stat.label}-${index}`}>
                <strong>
                  {editableText("stats", stat.value, `Giá trị số liệu ${index + 1}`, {
                    field: "stats.value",
                    index,
                  })}
                </strong>
                <span>
                  {editableText("stats", stat.label, `Nhãn số liệu ${index + 1}`, {
                    field: "stats.label",
                    index,
                  })}
                </span>
              </div>
            ))}
          </section>
        );
      }
      case "features":
        return (
          <section className={`feature-section${variantClass("features")}`} id="features" key={section}>
            <div className="section-heading">
              <p>
                {editableText(
                  "features",
                  data.featuresEyebrow,
                  "Nhãn section lợi ích",
                  { field: "featuresEyebrow" }
                )}
              </p>
              <h2>
                {editableText(
                  "features",
                  data.featuresHeadline,
                  "Tiêu đề section lợi ích",
                  { field: "featuresHeadline" },
                  true
                )}
              </h2>
            </div>
            <div className="feature-list">
              {data.features.map((feature, index) => (
                <article className="feature-item" key={`${feature.number}-${index}`}>
                  <span>
                    {editableText("features", feature.number, `Số thứ tự lợi ích ${index + 1}`, {
                      field: "features.number",
                      index,
                    })}
                  </span>
                  <h3>
                    {editableText("features", feature.title, `Tiêu đề lợi ích ${index + 1}`, {
                      field: "features.title",
                      index,
                    })}
                  </h3>
                  <p>
                    {editableText("features", feature.text, `Mô tả lợi ích ${index + 1}`, {
                      field: "features.text",
                      index,
                    }, true)}
                  </p>
                  <i aria-hidden="true">↗</i>
                </article>
              ))}
            </div>
          </section>
        );
      case "pricing": {
        if (!data.pricing.length) return null;
        const pricingTextSizes = data.design?.sectionTextSizes?.pricing;
        const pricingTextSizeClasses = [
          `pricing-heading-size-${pricingTextSizes?.heading || "md"}`,
          `pricing-name-size-${pricingTextSizes?.name || "md"}`,
          `pricing-price-size-${pricingTextSizes?.price || "md"}`,
          `pricing-description-size-${pricingTextSizes?.description || "md"}`,
          `pricing-features-size-${pricingTextSizes?.features || "md"}`,
          `pricing-cta-size-${pricingTextSizes?.cta || "md"}`,
        ].join(" ");
        return (
          <section
            className={`content-section pricing-section${variantClass("pricing")} ${pricingTextSizeClasses}`}
            id="pricing"
            key={section}
          >
            <div className="section-heading">
              <p>
                {editableText(
                  "pricing",
                  data.pricingEyebrow,
                  "Nhãn section bảng giá",
                  { field: "pricingEyebrow" }
                )}
              </p>
              <h2>
                {editableText(
                  "pricing",
                  data.pricingHeadline,
                  "Tiêu đề section bảng giá",
                  { field: "pricingHeadline" },
                  true
                )}
              </h2>
            </div>
            <div className="pricing-grid">
              {data.pricing.map((plan, index) => (
                <article
                  className={`pricing-card${plan.highlighted ? " is-highlighted" : ""}`}
                  key={`${plan.name}-${index}`}
                >
                  {plan.highlighted ? <span className="popular-pill">Phổ biến</span> : null}
                  <p>
                    {editableText("pricing", plan.name, `Tên gói ${index + 1}`, {
                      field: "pricing.name",
                      index,
                    })}
                  </p>
                  <strong>
                    {editableText("pricing", plan.price, `Giá gói ${index + 1}`, {
                      field: "pricing.price",
                      index,
                    })}
                  </strong>
                  <small>
                    {editableText("pricing", plan.description, `Mô tả gói ${index + 1}`, {
                      field: "pricing.description",
                      index,
                    }, true)}
                  </small>
                  <ul>
                    {plan.features.map((feature, featureIndex) => (
                      <li key={`${feature}-${featureIndex}`}>
                        <span>✓</span>
                        {editableText(
                          "pricing",
                          feature,
                          `Quyền lợi ${featureIndex + 1} của gói ${index + 1}`,
                          {
                            field: "pricing.feature",
                            index,
                            nestedIndex: featureIndex,
                          }
                        )}
                      </li>
                    ))}
                  </ul>
                  <a href="#contact">
                    {editableText("pricing", plan.cta, `Nút gói ${index + 1}`, {
                      field: "pricing.cta",
                      index,
                    })}
                  </a>
                </article>
              ))}
            </div>
          </section>
        );
      }
      case "portfolio":
        if (!data.portfolio.length) return null;
        return (
          <section className={`content-section portfolio-section${variantClass("portfolio")}`} id="portfolio" key={section}>
            <div className="section-heading">
              <p>
                {editableText(
                  "portfolio",
                  data.portfolioEyebrow,
                  "Nhãn section dự án",
                  { field: "portfolioEyebrow" }
                )}
              </p>
              <h2>
                {editableText(
                  "portfolio",
                  data.portfolioHeadline,
                  "Tiêu đề section dự án",
                  { field: "portfolioHeadline" },
                  true
                )}
              </h2>
            </div>
            <div className="portfolio-grid">
              {data.portfolio.map((item, index) => (
                <article className="portfolio-card" key={`${item.title}-${index}`}>
                  {mode === "editor" ? (
                    <ImageDropZone
                      target={`portfolio:${index}`}
                      label={
                        item.imageUrl
                          ? `Thả ảnh để thay dự án ${index + 1}`
                          : `Thả ảnh dự án ${index + 1} vào đây`
                      }
                      hasImage={Boolean(item.imageUrl)}
                      asset={
                        item.imageUrl
                          ? { url: item.imageUrl, alt: item.title }
                          : undefined
                      }
                      onDropImage={onDropImage}
                      onRemoveImage={onRemoveImage}
                    >
                      {item.imageUrl ? (
                        <PresentedImage
                          src={item.imageUrl}
                          alt={item.title}
                          loading="lazy"
                          fit={item.imageFit}
                          position={item.imagePosition}
                          isEditable={mode === "editor"}
                          onPositionChange={(pos) => onPositionChange?.(`portfolio:${index}`, pos)}
                        />
                      ) : (
                        <div className="portfolio-placeholder" aria-hidden="true">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                        </div>
                      )}
                    </ImageDropZone>
                  ) : item.imageUrl ? (
                    <PresentedImage
                      src={item.imageUrl}
                      alt={item.title}
                      loading="lazy"
                      fit={item.imageFit}
                      position={item.imagePosition}
                      isEditable={false}
                      onPositionChange={(pos) => onPositionChange?.(`portfolio:${index}`, pos)}
                    />
                  ) : (
                    <div className="portfolio-placeholder" aria-hidden="true">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  )}
                  <p>
                    {editableText("portfolio", item.category, `Danh mục dự án ${index + 1}`, {
                      field: "portfolio.category",
                      index,
                    })}
                  </p>
                  <h3>
                    {editableText("portfolio", item.title, `Tên dự án ${index + 1}`, {
                      field: "portfolio.title",
                      index,
                    })}
                  </h3>
                  <small>
                    {editableText(
                      "portfolio",
                      item.description,
                      `Mô tả dự án ${index + 1}`,
                      { field: "portfolio.description", index },
                      true
                    )}
                  </small>
                </article>
              ))}
            </div>
          </section>
        );
      case "gallery":
        if (!data.gallery.length && mode !== "editor") return null;
        return (
          <section className={`content-section gallery-section${variantClass("gallery")}`} id="gallery" key={section}>
            <div className="section-heading">
              <p>
                {editableText(
                  "gallery",
                  data.galleryEyebrow,
                  "Nhãn section hình ảnh",
                  { field: "galleryEyebrow" }
                )}
              </p>
              <h2>
                {editableText(
                  "gallery",
                  data.galleryHeadline,
                  "Tiêu đề section hình ảnh",
                  { field: "galleryHeadline" },
                  true
                )}
              </h2>
            </div>
            <div className="gallery-grid">
              {data.gallery.map((image, index) => (
                <figure key={`${image.url}-${index}`}>
                  {mode === "editor" ? (
                    <ImageDropZone
                      target={`gallery:${index}`}
                      label={`Thả ảnh để thay ảnh ${index + 1}`}
                      hasImage
                      asset={{ url: image.url, alt: image.alt }}
                      onDropImage={onDropImage}
                      onRemoveImage={onRemoveImage}
                    >
                      <PresentedImage
                        src={image.url}
                        alt={image.alt}
                        loading="lazy"
                        fit={image.imageFit}
                        position={image.imagePosition}
                        isEditable={mode === "editor"}
                        onPositionChange={(pos) => onPositionChange?.(`gallery:${index}`, pos)}
                      />
                    </ImageDropZone>
                  ) : (
                    <PresentedImage
                      src={image.url}
                      alt={image.alt}
                      loading="lazy"
                      fit={image.imageFit}
                      position={image.imagePosition}
                      isEditable={false}
                      onPositionChange={(pos) => onPositionChange?.(`gallery:${index}`, pos)}
                    />
                  )}
                  {image.caption || mode === "editor" ? (
                    <figcaption>
                      {editableText(
                        "gallery",
                        image.caption,
                        `Chú thích ảnh ${index + 1}`,
                        { field: "gallery.caption", index }
                      )}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
              {mode === "editor" ? (
                <ImageDropZone
                  target="gallery:add"
                  label="Thả ảnh để thêm vào thư viện"
                  onDropImage={onDropImage}
                />
              ) : null}
            </div>
          </section>
        );
      case "testimonial":
        return (
          <section className={`quote-section${variantClass("testimonial")}`} id="proof" key={section}>
            <p className="quote-mark" aria-hidden="true">“</p>
            <blockquote>
              {editableText("testimonial", data.testimonial.quote, "Nội dung đánh giá", {
                field: "testimonial.quote",
              }, true)}
            </blockquote>
            <div>
              <span className="quote-avatar">
                {data.testimonial.name.slice(0, 1)}
              </span>
              <p>
                <strong>
                  {editableText("testimonial", data.testimonial.name, "Tên khách hàng", {
                    field: "testimonial.name",
                  })}
                </strong>
                {editableText("testimonial", data.testimonial.role, "Vai trò khách hàng", {
                  field: "testimonial.role",
                })}
              </p>
            </div>
          </section>
        );
      case "faq":
        if (!data.faq.length) return null;
        return (
          <section className={`content-section faq-section${variantClass("faq")}`} id="faq" key={section}>
            <div className="section-heading">
              <p>
                {editableText("faq", data.faqEyebrow, "Nhãn section FAQ", {
                  field: "faqEyebrow",
                })}
              </p>
              <h2>
                {editableText(
                  "faq",
                  data.faqHeadline,
                  "Tiêu đề section FAQ",
                  { field: "faqHeadline" },
                  true
                )}
              </h2>
            </div>
            <div className="faq-list">
              {data.faq.map((item, index) => (
                <details key={`${item.question}-${index}`}>
                  <summary>
                    {editableText("faq", item.question, `Câu hỏi ${index + 1}`, {
                      field: "faq.question",
                      index,
                    })}
                    <span>+</span>
                  </summary>
                  <p>
                    {editableText("faq", item.answer, `Câu trả lời ${index + 1}`, {
                      field: "faq.answer",
                      index,
                    }, true)}
                  </p>
                </details>
              ))}
            </div>
          </section>
        );
      case "leadForm":
        return (
          <section className={`lead-section${variantClass("leadForm")}`} id="contact" key={section}>
            <div className="lead-copy">
              <p>Kết nối với {data.brand}</p>
              <h2>
                {editableText("leadForm", data.leadForm.title, "Tiêu đề form", {
                  field: "leadForm.title",
                })}
              </h2>
              <span>
                {editableText("leadForm", data.leadForm.description, "Mô tả form", {
                  field: "leadForm.description",
                }, true)}
              </span>
            </div>
            <form onSubmit={submitLead}>
              {data.leadForm.fields.map((field, index) => {
                const name = fieldName(field, index);
                const normalizedField = normalizedFieldLabel(field);
                const isMessage =
                  normalizedField.includes("nhu cau") ||
                  normalizedField.includes("tin nhan");
                const isEmail = normalizedField.includes("email");
                const isPhone =
                  normalizedField.includes("dien thoai") ||
                  normalizedField.includes("so dien thoai");
                return (
                  <label key={`${field}-${index}`}>
                    <span>
                      {editableText("leadForm", field, `Tên trường ${index + 1}`, {
                        field: "leadForm.field",
                        index,
                      })}
                    </span>
                    {isMessage ? (
                      <textarea name={name} rows={3} required />
                    ) : (
                      <input
                        name={name}
                        type={
                          isEmail
                            ? "email"
                            : isPhone
                              ? "tel"
                              : "text"
                        }
                        required
                      />
                    )}
                  </label>
                );
              })}
              <button
                type="submit"
                disabled={formState === "sending" || (compact && mode !== "editor")}
              >
                {formState === "sending"
                  ? "Đang gửi…"
                  : editableText("leadForm", data.leadForm.buttonText, "Nút gửi form", {
                      field: "leadForm.buttonText",
                    })}
                <span aria-hidden="true">↗</span>
              </button>
              {formState === "sent" ? (
                <p className="form-success">
                  {formError || data.leadForm.successMessage}
                </p>
              ) : null}
              {formState === "error" ? (
                <p className="form-error">{formError}</p>
              ) : null}
            </form>
          </section>
        );
      case "customBlock":
        if (!data.customBlock?.htmlCode) return null;
        return (
          <section
            key={section}
            className={`custom-block-section${variantClass("customBlock")}`}
            style={sectionThemeStyle(section)}
            dangerouslySetInnerHTML={{ __html: data.customBlock.htmlCode }}
          />
        );
      case "finalCta":
        return (
          <section className={`final-cta${variantClass("finalCta")}`} id="cta" key={section}>
            <p>
              {editableText(
                "finalCta",
                data.finalCtaEyebrow,
                "Nhãn kêu gọi hành động",
                { field: "finalCtaEyebrow" }
              )}
            </p>
            <h2>
              {editableText(
                "finalCta",
                data.finalCtaHeadline,
                "Tiêu đề kêu gọi hành động",
                { field: "finalCtaHeadline" },
                true
              )}
            </h2>
            <a href="#contact">
              {editableText("finalCta", data.primaryCta, "Nút kêu gọi hành động", {
                field: "primaryCta",
              })}
              <span aria-hidden="true">↗</span>
            </a>
          </section>
        );
      default:
        return null;
    }
    })();

    if (!content) return null;
    const themedContent = (
      <div
        className="landing-section-theme"
        data-section-theme={section}
        style={sectionThemeStyle(section)}
      >
        {content}
      </div>
    );

    if (mode === "editor") {
      return (
        <SortableSectionFrame
          key={section}
          id={section}
          selected={selectedSection === section}
          disabled={isBusy}
          onSelect={(value) => onSelectSection?.(value)}
        >
          {themedContent}
        </SortableSectionFrame>
      );
    }

    return <div key={section}>{themedContent}</div>;
  }

  const orderedSections = (sectionOrder ?? data.sectionOrder).filter(
    (section) => !data.hiddenSections.includes(section)
  );
  const visibleSections = new Set(orderedSections);
  const navigationCandidates: Array<{
    section: LandingSectionType;
    href: string;
    label: string;
  }> = [
    { section: "features", href: "#features", label: "Giải pháp" },
    { section: "pricing", href: "#pricing", label: "Bảng giá" },
    { section: "portfolio", href: "#portfolio", label: "Dự án" },
  ];
  const navigationItems = navigationCandidates.filter((item) =>
    visibleSections.has(item.section)
  );
  const templateClass = data.design?.templateId?.replace(/[^a-z0-9-]/gi, "-") || "default";
  const headingClass = data.design?.typography.heading || "editorial";
  const bodyClass = data.design?.typography.body || "sans";

  return (
    <article
      className={`landing-canvas template-${templateClass} heading-${headingClass} body-${bodyClass}${compact ? " is-compact" : ""}`}
      style={style}
      onClick={handlePreviewNavigation}
    >
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label={`${data.brand} — trang chủ`}>
          <span className="brand-mark" aria-hidden="true" />
          {editableText("hero", data.brand, "Tên thương hiệu", {
            field: "brand",
          })}
        </a>
        <nav aria-label="Điều hướng landing page">
          {navigationItems.map((item) => (
            <a href={item.href} key={item.section}>
              {item.label}
            </a>
          ))}
          <a className="nav-cta" href="#contact">
            {editableText("hero", data.navCta, "Nút trên thanh điều hướng", {
              field: "navCta",
            })}
          </a>
        </nav>
      </header>

      <main id="top">
        {mode === "editor" ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
              {orderedSections.map(renderSection)}
            </SortableContext>
          </DndContext>
        ) : (
          orderedSections.map(renderSection)
        )}
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top">
          <span className="brand-mark" aria-hidden="true" />
          {editableText("hero", data.brand, "Tên thương hiệu ở chân trang", {
            field: "brand",
          })}
        </a>
        <p>© 2026 {data.brand}. Tạo với Lumo.</p>
      </footer>
    </article>
  );
}

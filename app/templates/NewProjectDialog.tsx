"use client";

import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  landingTemplates,
  templateCategories,
  type LandingTemplate,
  type TemplateCategory,
} from "./registry";

type NewProjectDialogProps = {
  open: boolean;
  mode?: "create" | "switch";
  busy?: boolean;
  onClose: () => void;
  onCreateWithAi: (prompt: string) => void;
  onChooseTemplate: (templateId: string) => void;
  onCreateBlank: () => void;
};

const categoryLabels: Record<TemplateCategory | "all", string> = {
  all: "Tất cả",
  product: "Sản phẩm",
  service: "Dịch vụ",
  course: "Khóa học",
  event: "Sự kiện",
  portfolio: "Portfolio",
  "lead-generation": "Thu thập lead",
};

function TemplatePreviewArt({ category }: { category: TemplateCategory }) {
  if (category === "product") {
    return (
      <>
        <span className="art-product-panel" />
        <span className="art-product-bottle" />
        <span className="art-product-cap" />
        <span className="art-product-shadow" />
      </>
    );
  }

  if (category === "service") {
    return (
      <>
        <span className="art-service-portrait" />
        <span className="art-service-card" />
        <span className="art-service-line is-long" />
        <span className="art-service-line is-short" />
        <span className="art-service-badge" />
      </>
    );
  }

  if (category === "course") {
    return (
      <>
        <span className="art-course-card is-back" />
        <span className="art-course-card is-mid" />
        <span className="art-course-card is-front">
          <i />
          <b />
        </span>
        <span className="art-course-progress" />
      </>
    );
  }

  if (category === "event") {
    return (
      <>
        <span className="art-event-light is-left" />
        <span className="art-event-light is-right" />
        <span className="art-event-stage" />
        <span className="art-event-date" />
        <span className="art-event-people" />
      </>
    );
  }

  if (category === "portfolio") {
    return (
      <>
        <span className="art-portfolio-tile is-large" />
        <span className="art-portfolio-tile is-top" />
        <span className="art-portfolio-tile is-mid" />
        <span className="art-portfolio-tile is-bottom" />
      </>
    );
  }

  return (
    <>
      <span className="art-lead-form" />
      <span className="art-lead-field is-one" />
      <span className="art-lead-field is-two" />
      <span className="art-lead-button" />
      <span className="art-lead-cursor" />
    </>
  );
}

function TemplatePreview({ template }: { template: LandingTemplate }) {
  const palette = template.landing.palette;

  return (
    <div
      className={`template-card-preview is-${template.category}`}
      style={
        {
          "--preview-paper": palette.paper,
          "--preview-ink": palette.ink,
          "--preview-accent": palette.accent,
          "--preview-soft": palette.soft,
        } as CSSProperties
      }
    >
      <div className="template-preview-copy" aria-hidden="true">
        <span className="template-preview-kicker" />
        <span className="template-preview-title" />
        <span className="template-preview-body" />
        <span className="template-preview-cta" />
      </div>
      <div className="template-preview-art" aria-hidden="true">
        <TemplatePreviewArt category={template.category} />
      </div>
    </div>
  );
}

export function NewProjectDialog({
  open,
  mode = "create",
  busy = false,
  onClose,
  onCreateWithAi,
  onChooseTemplate,
  onCreateBlank,
}: NewProjectDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [view, setView] = useState<"ai" | "templates">(
    mode === "switch" ? "templates" : "ai"
  );

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, mode, onClose, open]);

  const templates = useMemo(
    () =>
      category === "all"
        ? landingTemplates
        : landingTemplates.filter((template) => template.category === category),
    [category]
  );

  if (!open) return null;

  function submitAi(event: FormEvent) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || busy) return;
    onCreateWithAi(value);
  }

  return (
    <div className="new-project-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="new-project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="new-project-heading">
          <div>
            <span>{mode === "switch" ? "THƯ VIỆN GIAO DIỆN" : "DỰ ÁN MỚI"}</span>
            <h2 id="new-project-title">
              {mode === "switch"
                ? "Chọn một thiết kế khác"
                : "Bạn muốn bắt đầu thế nào?"}
            </h2>
            <p>
              {mode === "switch"
                ? "Nội dung hiện tại được giữ nguyên; chỉ bố cục, màu sắc và kiểu trình bày thay đổi."
                : "Để AI chọn thiết kế, chọn một mẫu có sẵn hoặc bắt đầu từ trang trắng."}
            </p>
          </div>
          <button
            className="new-project-close"
            type="button"
            aria-label="Đóng"
            disabled={busy}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {mode === "create" ? (
          <nav className="new-project-tabs" aria-label="Cách bắt đầu">
            <button
              type="button"
              className={view === "ai" ? "is-active" : ""}
              onClick={() => setView("ai")}
            >
              ✦ Tạo bằng AI
            </button>
            <button
              type="button"
              className={view === "templates" ? "is-active" : ""}
              onClick={() => setView("templates")}
            >
              Chọn template
            </button>
            <button type="button" disabled={busy} onClick={onCreateBlank}>
              Trang trắng
            </button>
          </nav>
        ) : null}

        {view === "ai" && mode === "create" ? (
          <form className="ai-project-starter" onSubmit={submitAi}>
            <div className="ai-starter-copy">
              <span>LUỒNG ĐƯỢC ĐỀ XUẤT</span>
              <h3>Mô tả mục tiêu, Lumo lo phần còn lại.</h3>
              <p>
                AI sẽ phân tích ngành, mục tiêu chuyển đổi và phong cách; sau đó
                chọn một template có kiểm soát từ thư viện.
              </p>
            </div>
            <label htmlFor="new-project-prompt">Bạn muốn tạo landing page về điều gì?</label>
            <textarea
              id="new-project-prompt"
              autoFocus
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ví dụ: Tạo landing page bán máy lọc không khí cho gia đình trẻ, phong cách hiện đại và đáng tin cậy."
              rows={4}
            />
            <div className="ai-starter-examples">
              {["Bán sản phẩm", "Giới thiệu dịch vụ", "Quảng bá khóa học"].map(
                (label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setPrompt(
                        label === "Bán sản phẩm"
                          ? "Tạo landing page bán sản phẩm, làm nổi bật lợi ích, giá và nút mua ngay."
                          : label === "Giới thiệu dịch vụ"
                            ? "Tạo landing page giới thiệu dịch vụ chuyên nghiệp và thu thập yêu cầu báo giá."
                            : "Tạo landing page quảng bá khóa học với chương trình, học phí và form đăng ký."
                      )
                    }
                  >
                    {label}
                  </button>
                )
              )}
            </div>
            <button className="ai-starter-submit" type="submit" disabled={!prompt.trim() || busy}>
              {busy ? "Đang chuẩn bị…" : "Tạo landing page bằng AI"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        ) : (
          <div className="template-library">
            <div className="template-filters" aria-label="Lọc template">
              {(["all", ...templateCategories] as const).map((item) => (
                <button
                  type="button"
                  key={item}
                  className={category === item ? "is-active" : ""}
                  onClick={() => setCategory(item)}
                >
                  {categoryLabels[item]}
                </button>
              ))}
            </div>
            <div className="template-grid">
              {templates.map((template) => (
                  <article className="template-card" key={template.id}>
                    <TemplatePreview template={template} />
                    <div className="template-card-copy">
                      <span>{categoryLabels[template.category]}</span>
                      <h3>{template.name}</h3>
                      <p>{template.description}</p>
                      <div>
                        {template.tags.slice(0, 3).map((tag) => (
                          <small key={tag}>{tag}</small>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onChooseTemplate(template.id)}
                      >
                        {mode === "switch" ? "Dùng thiết kế này" : "Chọn mẫu"}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import {
  FormEvent,
  type CSSProperties,
  type MouseEvent,
  useState,
} from "react";
import type {
  LandingData,
  LandingSectionType,
} from "../landing-data";

type LandingCanvasProps = {
  data: LandingData;
  compact?: boolean;
  slug?: string;
};

function fieldName(label: string, index: number) {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${normalized || "field"}_${index + 1}`;
}

export function LandingCanvas({
  data,
  compact = false,
  slug,
}: LandingCanvasProps) {
  const [formState, setFormState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [formError, setFormError] = useState("");
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
    if (compact) return;
    if (!slug) {
      setFormState("error");
      setFormError("Form sẽ hoạt động sau khi landing page được xuất bản.");
      return;
    }

    setFormState("sending");
    setFormError("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      Array.from(form.entries()).map(([key, value]) => [key, String(value)])
    );

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, values }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Không thể gửi thông tin.");
      }
      event.currentTarget.reset();
      setFormState("sent");
    } catch (error) {
      setFormState("error");
      setFormError(
        error instanceof Error ? error.message : "Không thể gửi thông tin."
      );
    }
  }

  function renderSection(section: LandingSectionType) {
    switch (section) {
      case "stats":
        return (
          <section className="stats-grid" aria-label="Kết quả nổi bật" key={section}>
            {data.stats.map((stat) => (
              <div className="stat-card" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </section>
        );
      case "features":
        return (
          <section className="feature-section" id="features" key={section}>
            <div className="section-heading">
              <p>Tại sao chọn {data.brand}</p>
              <h2>Ít hỗn loạn.<br />Nhiều tác động hơn.</h2>
            </div>
            <div className="feature-list">
              {data.features.map((feature) => (
                <article className="feature-item" key={feature.number}>
                  <span>{feature.number}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                  <i aria-hidden="true">↗</i>
                </article>
              ))}
            </div>
          </section>
        );
      case "pricing":
        if (!data.pricing.length) return null;
        return (
          <section className="content-section pricing-section" id="pricing" key={section}>
            <div className="section-heading">
              <p>Gói phù hợp</p>
              <h2>Bắt đầu nhỏ.<br />Lớn lên dễ dàng.</h2>
            </div>
            <div className="pricing-grid">
              {data.pricing.map((plan) => (
                <article
                  className={`pricing-card${plan.highlighted ? " is-highlighted" : ""}`}
                  key={plan.name}
                >
                  {plan.highlighted ? <span className="popular-pill">Phổ biến</span> : null}
                  <p>{plan.name}</p>
                  <strong>{plan.price}</strong>
                  <small>{plan.description}</small>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}><span>✓</span>{feature}</li>
                    ))}
                  </ul>
                  <a href="#contact">{plan.cta}</a>
                </article>
              ))}
            </div>
          </section>
        );
      case "portfolio":
        if (!data.portfolio.length) return null;
        return (
          <section className="content-section portfolio-section" id="portfolio" key={section}>
            <div className="section-heading">
              <p>Dự án tiêu biểu</p>
              <h2>Công việc nói thay<br />mọi lời giới thiệu.</h2>
            </div>
            <div className="portfolio-grid">
              {data.portfolio.map((item, index) => (
                <article className="portfolio-card" key={`${item.title}-${index}`}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.title} loading="lazy" />
                  ) : (
                    <div className="portfolio-placeholder" aria-hidden="true">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  )}
                  <p>{item.category}</p>
                  <h3>{item.title}</h3>
                  <small>{item.description}</small>
                </article>
              ))}
            </div>
          </section>
        );
      case "gallery":
        if (!data.gallery.length) return null;
        return (
          <section className="content-section gallery-section" id="gallery" key={section}>
            <div className="section-heading">
              <p>Thư viện hình ảnh</p>
              <h2>Một góc nhìn<br />đáng nhớ.</h2>
            </div>
            <div className="gallery-grid">
              {data.gallery.map((image, index) => (
                <figure key={`${image.url}-${index}`}>
                  <img src={image.url} alt={image.alt} loading="lazy" />
                  {image.caption ? <figcaption>{image.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        );
      case "testimonial":
        return (
          <section className="quote-section" id="proof" key={section}>
            <p className="quote-mark" aria-hidden="true">“</p>
            <blockquote>{data.testimonial.quote}</blockquote>
            <div>
              <span className="quote-avatar">
                {data.testimonial.name.slice(0, 1)}
              </span>
              <p>
                <strong>{data.testimonial.name}</strong>
                {data.testimonial.role}
              </p>
            </div>
          </section>
        );
      case "faq":
        if (!data.faq.length) return null;
        return (
          <section className="content-section faq-section" id="faq" key={section}>
            <div className="section-heading">
              <p>Câu hỏi thường gặp</p>
              <h2>Rõ ràng trước khi<br />bạn bắt đầu.</h2>
            </div>
            <div className="faq-list">
              {data.faq.map((item) => (
                <details key={item.question}>
                  <summary>{item.question}<span>+</span></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        );
      case "leadForm":
        return (
          <section className="lead-section" id="contact" key={section}>
            <div className="lead-copy">
              <p>Kết nối với {data.brand}</p>
              <h2>{data.leadForm.title}</h2>
              <span>{data.leadForm.description}</span>
            </div>
            <form onSubmit={submitLead}>
              {data.leadForm.fields.map((field, index) => {
                const name = fieldName(field, index);
                const isMessage =
                  field.toLocaleLowerCase("vi").includes("nhu cầu") ||
                  field.toLocaleLowerCase("vi").includes("tin nhắn");
                return (
                  <label key={`${field}-${index}`}>
                    <span>{field}</span>
                    {isMessage ? (
                      <textarea name={name} rows={3} required />
                    ) : (
                      <input
                        name={name}
                        type={field.toLowerCase().includes("email") ? "email" : "text"}
                        required
                      />
                    )}
                  </label>
                );
              })}
              <button type="submit" disabled={formState === "sending" || compact}>
                {formState === "sending" ? "Đang gửi…" : data.leadForm.buttonText}
                <span aria-hidden="true">↗</span>
              </button>
              {formState === "sent" ? (
                <p className="form-success">{data.leadForm.successMessage}</p>
              ) : null}
              {formState === "error" ? (
                <p className="form-error">{formError}</p>
              ) : null}
            </form>
          </section>
        );
    }
  }

  return (
    <article
      className={`landing-canvas${compact ? " is-compact" : ""}`}
      style={style}
      onClick={handlePreviewNavigation}
    >
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label={`${data.brand} — trang chủ`}>
          <span className="brand-mark" aria-hidden="true" />
          {data.brand}
        </a>
        <nav aria-label="Điều hướng landing page">
          <a href="#features">Giải pháp</a>
          <a href="#pricing">Bảng giá</a>
          <a href="#portfolio">Dự án</a>
          <a className="nav-cta" href="#contact">{data.navCta}</a>
        </nav>
      </header>

      <main id="top">
        <section className={`landing-hero${data.heroImage ? " has-image" : ""}`}>
          <div className="hero-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div className="hero-copy">
            <p className="landing-eyebrow"><span />{data.eyebrow}</p>
            <h1>{data.headline}<em>{data.accentLine}</em></h1>
            <p className="landing-description">{data.description}</p>
            <div className="landing-actions">
              <a className="button-primary" href="#contact">
                {data.primaryCta}<span aria-hidden="true">↗</span>
              </a>
              <a className="button-secondary" href="#features">
                <span className="play-dot" aria-hidden="true">▶</span>
                {data.secondaryCta}
              </a>
            </div>
            <div className="trust-row">
              <div className="avatar-stack" aria-hidden="true">
                <span>MA</span><span>HN</span><span>KT</span>
              </div>
              <p>{data.proof}</p>
            </div>
          </div>
          {data.heroImage ? (
            <div className="hero-image-wrap">
              <img src={data.heroImage} alt={`Hình ảnh nổi bật của ${data.brand}`} />
            </div>
          ) : null}
        </section>

        {data.sectionOrder.map(renderSection)}

        <section className="final-cta" id="cta">
          <p>Sẵn sàng tạo điều khác biệt?</p>
          <h2>Biến ý tưởng tiếp theo<br />thành điều lớn lao.</h2>
          <a href="#contact">{data.primaryCta}<span aria-hidden="true">↗</span></a>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#top">
          <span className="brand-mark" aria-hidden="true" />
          {data.brand}
        </a>
        <p>© 2026 {data.brand}. Tạo với Lumo.</p>
      </footer>
    </article>
  );
}

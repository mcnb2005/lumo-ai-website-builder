"use client";

import type { CSSProperties } from "react";
import type { LandingData } from "../landing-data";

type LandingCanvasProps = {
  data: LandingData;
  compact?: boolean;
};

export function LandingCanvas({ data, compact = false }: LandingCanvasProps) {
  const style = {
    "--site-ink": data.palette.ink,
    "--site-paper": data.palette.paper,
    "--site-accent": data.palette.accent,
    "--site-soft": data.palette.soft,
    "--site-line": data.palette.line,
  } as CSSProperties;

  return (
    <article
      className={`landing-canvas${compact ? " is-compact" : ""}`}
      style={style}
    >
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label={`${data.brand} — trang chủ`}>
          <span className="brand-mark" aria-hidden="true" />
          {data.brand}
        </a>
        <nav aria-label="Điều hướng landing page">
          <a href="#features">Giải pháp</a>
          <a href="#proof">Khách hàng</a>
          <a className="nav-cta" href="#cta">
            {data.navCta}
          </a>
        </nav>
      </header>

      <main id="top">
        <section className="landing-hero">
          <div className="hero-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="landing-eyebrow">
            <span />
            {data.eyebrow}
          </p>
          <h1>
            {data.headline}
            <em>{data.accentLine}</em>
          </h1>
          <p className="landing-description">{data.description}</p>
          <div className="landing-actions">
            <a className="button-primary" href="#cta">
              {data.primaryCta}
              <span aria-hidden="true">↗</span>
            </a>
            <a className="button-secondary" href="#features">
              <span className="play-dot" aria-hidden="true">▶</span>
              {data.secondaryCta}
            </a>
          </div>
          <div className="trust-row">
            <div className="avatar-stack" aria-hidden="true">
              <span>MA</span>
              <span>HN</span>
              <span>KT</span>
            </div>
            <p>{data.proof}</p>
          </div>
        </section>

        <section className="stats-grid" aria-label="Kết quả nổi bật">
          {data.stats.map((stat) => (
            <div className="stat-card" key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section className="feature-section" id="features">
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

        <section className="quote-section" id="proof">
          <p className="quote-mark" aria-hidden="true">“</p>
          <blockquote>{data.testimonial.quote}</blockquote>
          <div>
            <span className="quote-avatar">{data.testimonial.name.slice(0, 1)}</span>
            <p>
              <strong>{data.testimonial.name}</strong>
              {data.testimonial.role}
            </p>
          </div>
        </section>

        <section className="final-cta" id="cta">
          <p>Sẵn sàng làm việc sáng tạo hơn?</p>
          <h2>Biến ý tưởng tiếp theo<br />thành điều lớn lao.</h2>
          <a href="mailto:hello@example.com">
            {data.primaryCta}
            <span aria-hidden="true">↗</span>
          </a>
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

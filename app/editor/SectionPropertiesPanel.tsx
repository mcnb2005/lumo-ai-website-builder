"use client";

import {
  useId,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import type {
  LandingData,
  LandingImageFit,
  LandingImagePosition,
  LandingImageTarget,
  LandingSectionType,
} from "../landing-data";
import type { LandingTextEdit } from "./inline-editing";
import { sectionRegistry } from "./section-registry";

type SectionPropertiesPanelProps = {
  landing: LandingData;
  selectedSection: LandingSectionType | null;
  isBusy?: boolean;
  onEditText: (edit: LandingTextEdit) => void;
  onSetPalette: (
    token: keyof LandingData["palette"],
    value: string
  ) => void;
  onToggleVisibility: (section: LandingSectionType) => void;
  onSetImagePresentation: (
    target: LandingImageTarget,
    patch: {
      imageFit?: LandingImageFit;
      imagePosition?: LandingImagePosition;
    }
  ) => void;
};

function ImagePresentationFields({
  target,
  fit,
  position,
  disabled,
  onCommit,
}: {
  target: LandingImageTarget;
  fit: LandingImageFit | undefined;
  position: LandingImagePosition | undefined;
  disabled: boolean;
  onCommit: SectionPropertiesPanelProps["onSetImagePresentation"];
}) {
  const fitId = useId();
  const positionId = useId();

  return (
    <div className="property-image-presentation">
      <strong>Cách hiển thị ảnh</strong>
      <div className="property-image-presentation__grid">
        <label htmlFor={fitId}>
          <span>Kích thước</span>
          <select
            id={fitId}
            value={fit || "smart"}
            disabled={disabled}
            onChange={(event) =>
              onCommit(target, {
                imageFit: event.target.value as LandingImageFit,
              })
            }
          >
            <option value="smart">Vừa khung thông minh</option>
            <option value="contain">Hiện đầy đủ</option>
            <option value="cover">Lấp đầy khung</option>
          </select>
        </label>
        <label htmlFor={positionId}>
          <span>Trọng tâm</span>
          <select
            id={positionId}
            value={position || "center"}
            disabled={disabled}
            onChange={(event) =>
              onCommit(target, {
                imagePosition: event.target.value as LandingImagePosition,
              })
            }
          >
            <option value="center">Ở giữa</option>
            <option value="top">Phía trên</option>
            <option value="bottom">Phía dưới</option>
            <option value="left">Bên trái</option>
            <option value="right">Bên phải</option>
          </select>
        </label>
      </div>
      <small>
        “Vừa khung thông minh” giữ đủ ảnh và dùng nền mờ để lấp khoảng trống.
      </small>
    </div>
  );
}

function PropertyTextField({
  label,
  value,
  edit,
  multiline = false,
  disabled = false,
  onCommit,
}: {
  label: string;
  value: string;
  edit: Omit<LandingTextEdit, "value">;
  multiline?: boolean;
  disabled?: boolean;
  onCommit: (edit: LandingTextEdit) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  function commit() {
    const next = draft.trim();
    if (next !== value) onCommit({ ...edit, value: next });
  }

  const commonProps = {
    id,
    value: draft,
    disabled,
    onChange: (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (
      event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      if (event.key === "Escape") {
        setDraft(value);
        event.currentTarget.blur();
      }
      if (!multiline && event.key === "Enter") {
        event.preventDefault();
        commit();
        event.currentTarget.blur();
      }
    },
  };

  return (
    <label className="property-field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea {...commonProps} rows={3} />
      ) : (
        <input {...commonProps} type="text" />
      )}
    </label>
  );
}

function PaletteField({
  label,
  token,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  token: keyof LandingData["palette"];
  value: string;
  disabled: boolean;
  onCommit: (
    token: keyof LandingData["palette"],
    value: string
  ) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <label className="property-color">
      <span>{label}</span>
      <span>
        <input
          type="color"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== value) onCommit(token, draft);
          }}
        />
        <code>{draft.toUpperCase()}</code>
      </span>
    </label>
  );
}

export function SectionPropertiesPanel({
  landing,
  selectedSection,
  isBusy = false,
  onEditText,
  onSetPalette,
  onToggleVisibility,
  onSetImagePresentation,
}: SectionPropertiesPanelProps) {
  const textField = (
    label: string,
    value: string,
    edit: Omit<LandingTextEdit, "value">,
    multiline = false
  ) => (
    <PropertyTextField
      key={`${edit.field}-${edit.index ?? "root"}-${edit.nestedIndex ?? "root"}-${value}`}
      label={label}
      value={value}
      edit={edit}
      multiline={multiline}
      disabled={isBusy}
      onCommit={onEditText}
    />
  );

  function renderFields(section: LandingSectionType) {
    switch (section) {
      case "hero":
        return (
          <>
            {textField("Tên thương hiệu", landing.brand, {
              section,
              field: "brand",
            })}
            {textField("Nhãn mở đầu", landing.eyebrow, {
              section,
              field: "eyebrow",
            })}
            {textField("Tiêu đề", landing.headline, {
              section,
              field: "headline",
            })}
            {textField("Dòng nhấn", landing.accentLine, {
              section,
              field: "accentLine",
            })}
            {textField(
              "Mô tả",
              landing.description,
              { section, field: "description" },
              true
            )}
            {textField("Nút chính", landing.primaryCta, {
              section,
              field: "primaryCta",
            })}
            {textField("Nút phụ", landing.secondaryCta, {
              section,
              field: "secondaryCta",
            })}
            <div className="property-image-status">
              <span>Ảnh Hero</span>
              <strong>
                {landing.heroImage
                  ? "Đã có ảnh · kéo ảnh khác để thay"
                  : "Chưa có ảnh · kéo ảnh vào Hero"}
              </strong>
            </div>
            {landing.heroImage ? (
              <ImagePresentationFields
                target="hero"
                fit={landing.heroImageFit}
                position={landing.heroImagePosition}
                disabled={isBusy}
                onCommit={onSetImagePresentation}
              />
            ) : null}
          </>
        );
      case "stats":
        return landing.stats.map((item, index) => (
          <fieldset key={`stat-${index}`}>
            <legend>Số liệu {index + 1}</legend>
            {textField("Giá trị", item.value, {
              section,
              field: "stats.value",
              index,
            })}
            {textField("Nhãn", item.label, {
              section,
              field: "stats.label",
              index,
            })}
          </fieldset>
        ));
      case "features":
        return (
          <>
            {textField("Nhãn section", landing.featuresEyebrow, {
              section,
              field: "featuresEyebrow",
            })}
            {textField(
              "Tiêu đề section",
              landing.featuresHeadline,
              { section, field: "featuresHeadline" },
              true
            )}
            {landing.features.map((item, index) => (
              <fieldset key={`feature-${index}`}>
                <legend>Lợi ích {index + 1}</legend>
                {textField("Số thứ tự", item.number, {
                  section,
                  field: "features.number",
                  index,
                })}
                {textField("Tiêu đề", item.title, {
                  section,
                  field: "features.title",
                  index,
                })}
                {textField(
                  "Mô tả",
                  item.text,
                  { section, field: "features.text", index },
                  true
                )}
              </fieldset>
            ))}
          </>
        );
      case "pricing":
        return (
          <>
            {textField("Nhãn section", landing.pricingEyebrow, {
              section,
              field: "pricingEyebrow",
            })}
            {textField(
              "Tiêu đề section",
              landing.pricingHeadline,
              { section, field: "pricingHeadline" },
              true
            )}
            {landing.pricing.map((item, index) => (
              <fieldset key={`pricing-${index}`}>
                <legend>Gói {index + 1}</legend>
                {textField("Tên gói", item.name, {
                  section,
                  field: "pricing.name",
                  index,
                })}
                {textField("Giá", item.price, {
                  section,
                  field: "pricing.price",
                  index,
                })}
                {textField(
                  "Mô tả",
                  item.description,
                  { section, field: "pricing.description", index },
                  true
                )}
                {textField("Nút", item.cta, {
                  section,
                  field: "pricing.cta",
                  index,
                })}
              </fieldset>
            ))}
          </>
        );
      case "portfolio":
        return (
          <>
            {textField("Nhãn section", landing.portfolioEyebrow, {
              section,
              field: "portfolioEyebrow",
            })}
            {textField(
              "Tiêu đề section",
              landing.portfolioHeadline,
              { section, field: "portfolioHeadline" },
              true
            )}
            {landing.portfolio.map((item, index) => (
              <fieldset key={`portfolio-${index}`}>
                <legend>Dự án {index + 1}</legend>
                {textField("Danh mục", item.category, {
                  section,
                  field: "portfolio.category",
                  index,
                })}
                {textField("Tên dự án", item.title, {
                  section,
                  field: "portfolio.title",
                  index,
                })}
                {textField(
                  "Mô tả",
                  item.description,
                  { section, field: "portfolio.description", index },
                  true
                )}
                {item.imageUrl ? (
                  <ImagePresentationFields
                    target={`portfolio:${index}`}
                    fit={item.imageFit}
                    position={item.imagePosition}
                    disabled={isBusy}
                    onCommit={onSetImagePresentation}
                  />
                ) : null}
              </fieldset>
            ))}
          </>
        );
      case "gallery":
        return (
          <>
            {textField("Nhãn section", landing.galleryEyebrow, {
              section,
              field: "galleryEyebrow",
            })}
            {textField(
              "Tiêu đề section",
              landing.galleryHeadline,
              { section, field: "galleryHeadline" },
              true
            )}
            {landing.gallery.length ? (
              landing.gallery.map((item, index) => (
                <fieldset key={`gallery-${index}`}>
                  <legend>Ảnh {index + 1}</legend>
                  {textField("Mô tả ảnh", item.alt, {
                    section,
                    field: "gallery.alt",
                    index,
                  })}
                  {textField("Chú thích", item.caption, {
                    section,
                    field: "gallery.caption",
                    index,
                  })}
                  <ImagePresentationFields
                    target={`gallery:${index}`}
                    fit={item.imageFit}
                    position={item.imagePosition}
                    disabled={isBusy}
                    onCommit={onSetImagePresentation}
                  />
                </fieldset>
              ))
            ) : (
              <p className="properties-empty">
                Kéo ảnh từ khay ảnh vào section để bắt đầu.
              </p>
            )}
          </>
        );
      case "testimonial":
        return (
          <>
            {textField(
              "Nội dung đánh giá",
              landing.testimonial.quote,
              { section, field: "testimonial.quote" },
              true
            )}
            {textField("Tên khách hàng", landing.testimonial.name, {
              section,
              field: "testimonial.name",
            })}
            {textField("Vai trò", landing.testimonial.role, {
              section,
              field: "testimonial.role",
            })}
          </>
        );
      case "faq":
        return (
          <>
            {textField("Nhãn section", landing.faqEyebrow, {
              section,
              field: "faqEyebrow",
            })}
            {textField(
              "Tiêu đề section",
              landing.faqHeadline,
              { section, field: "faqHeadline" },
              true
            )}
            {landing.faq.map((item, index) => (
              <fieldset key={`faq-${index}`}>
                <legend>Câu hỏi {index + 1}</legend>
                {textField("Câu hỏi", item.question, {
                  section,
                  field: "faq.question",
                  index,
                })}
                {textField(
                  "Câu trả lời",
                  item.answer,
                  { section, field: "faq.answer", index },
                  true
                )}
              </fieldset>
            ))}
          </>
        );
      case "leadForm":
        return (
          <>
            {textField("Tiêu đề form", landing.leadForm.title, {
              section,
              field: "leadForm.title",
            })}
            {textField(
              "Mô tả",
              landing.leadForm.description,
              { section, field: "leadForm.description" },
              true
            )}
            {landing.leadForm.fields.map((field, index) =>
              textField(`Trường ${index + 1}`, field, {
                section,
                field: "leadForm.field",
                index,
              })
            )}
            {textField("Nút gửi", landing.leadForm.buttonText, {
              section,
              field: "leadForm.buttonText",
            })}
          </>
        );
      case "finalCta":
        return (
          <>
            {textField("Nhãn section", landing.finalCtaEyebrow, {
              section,
              field: "finalCtaEyebrow",
            })}
            {textField(
              "Tiêu đề section",
              landing.finalCtaHeadline,
              { section, field: "finalCtaHeadline" },
              true
            )}
            {textField("Nút kêu gọi hành động", landing.primaryCta, {
              section,
              field: "primaryCta",
            })}
          </>
        );
    }
  }

  return (
    <aside className="section-properties" aria-label="Thuộc tính section">
      <div className="section-properties__header">
        <small>THUỘC TÍNH</small>
        <strong>
          {selectedSection
            ? sectionRegistry[selectedSection].label
            : "Chưa chọn section"}
        </strong>
      </div>
      {selectedSection ? (
        <>
          <div className="section-properties__fields">
            {renderFields(selectedSection)}
          </div>
          <div className="section-properties__palette">
            <strong>Màu toàn trang</strong>
            <PaletteField
              key={`ink-${landing.palette.ink}`}
              label="Màu chữ"
              token="ink"
              value={landing.palette.ink}
              disabled={isBusy}
              onCommit={onSetPalette}
            />
            <PaletteField
              key={`accent-${landing.palette.accent}`}
              label="Màu nhấn"
              token="accent"
              value={landing.palette.accent}
              disabled={isBusy}
              onCommit={onSetPalette}
            />
            <PaletteField
              key={`paper-${landing.palette.paper}`}
              label="Nền"
              token="paper"
              value={landing.palette.paper}
              disabled={isBusy}
              onCommit={onSetPalette}
            />
          </div>
          {selectedSection !== "finalCta" ? (
            <button
              className="section-properties__visibility"
              type="button"
              disabled={isBusy}
              onClick={() => onToggleVisibility(selectedSection)}
            >
              {landing.hiddenSections.includes(selectedSection)
                ? "Hiện section"
                : "Ẩn section"}
            </button>
          ) : null}
        </>
      ) : (
        <p className="properties-empty">
          Chọn một section trên danh sách hoặc bản xem trước để chỉnh nội dung.
        </p>
      )}
    </aside>
  );
}

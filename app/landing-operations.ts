import {
  landingTextSizes,
  landingSectionVariantOptions,
  landingSectionTypes,
  normalizeLandingData,
  type LandingData,
  type LandingImageTarget,
  type LandingSectionTextSizes,
  type LandingSectionType,
  type LandingTextSize,
} from "./landing-data";
import {
  editableFieldsBySection,
  type LandingEditableField,
} from "./landing-manifest";
import {
  landingOperationKeys as operationKeys,
  normalizeLandingOperationInput,
} from "./landing-operation-normalizer";

export type LandingOperation =
  | {
      type: "update_text";
      section: LandingSectionType;
      field: LandingEditableField;
      value: string;
      index?: number;
      nestedIndex?: number;
    }
  | {
      type: "replace_section";
      section: Exclude<LandingSectionType, "customBlock" | "finalCta">;
      value: unknown;
    }
  | {
      type: "set_palette";
      token: keyof LandingData["palette"];
      value: string;
    }
  | {
      type: "hide_section";
      section: Exclude<LandingSectionType, "finalCta">;
    }
  | {
      type: "show_section";
      section: LandingSectionType;
    }
  | {
      type: "move_section";
      section: LandingSectionType;
      toIndex: number;
    }
  | {
      type: "add_section";
      section: LandingSectionType;
      atIndex?: number;
    }
  | {
      type: "assign_image";
      target: LandingImageTarget;
      url: string;
      alt?: string;
    }
  | {
      type: "set_variant";
      section: LandingSectionType;
      variant: string;
    }
  | {
      type: "set_design";
      typography?: {
        heading?: "editorial" | "modern" | "friendly";
        body?: "sans" | "humanist";
      };
      sectionTextSizes?: LandingSectionTextSizes;
      radius?: "none" | "sm" | "md" | "lg" | "full";
      density?: "compact" | "comfortable" | "spacious";
    }
  | {
      type: "update_custom_block";
      htmlCode: string;
    }
  | {
      type: "replace_landing";
      value: LandingData;
    };

export type LandingOperationEnvelope = {
  operations: LandingOperation[];
  explanation?: string;
};

export type LandingOperationMode = "create" | "edit";

export class LandingOperationValidationError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(errors[0] || "Thay đổi landing page không hợp lệ.");
    this.name = "LandingOperationValidationError";
    this.errors = errors;
  }
}

const indexedFields = new Set<LandingEditableField>([
  "stats.value",
  "stats.label",
  "features.number",
  "features.title",
  "features.text",
  "pricing.name",
  "pricing.price",
  "pricing.description",
  "pricing.feature",
  "pricing.cta",
  "portfolio.category",
  "portfolio.title",
  "portfolio.description",
  "gallery.alt",
  "gallery.caption",
  "faq.question",
  "faq.answer",
  "leadForm.field",
]);

const nestedFields = new Set<LandingEditableField>(["pricing.feature"]);
const paletteTokens = ["ink", "paper", "accent", "soft", "line"] as const;
const sectionColorTokens = ["background", "text", "accent"] as const;
const sectionTextSizeFields = {
  stats: ["value", "label"],
  pricing: ["heading", "name", "price", "description", "features", "cta"],
} as const;
const hexColorPattern = /^#[0-9a-f]{6}$/i;
const unsafeTextPattern =
  /<\s*script\b|javascript\s*:|on(?:error|load|click)\s*=/i;
const landingKeys: Array<keyof LandingData> = [
  "brand",
  "navCta",
  "eyebrow",
  "headline",
  "accentLine",
  "description",
  "primaryCta",
  "secondaryCta",
  "proof",
  "featuresEyebrow",
  "featuresHeadline",
  "pricingEyebrow",
  "pricingHeadline",
  "portfolioEyebrow",
  "portfolioHeadline",
  "galleryEyebrow",
  "galleryHeadline",
  "faqEyebrow",
  "faqHeadline",
  "finalCtaEyebrow",
  "finalCtaHeadline",
  "heroImage",
  "heroImageFit",
  "heroImagePosition",
  "sectionOrder",
  "hiddenSections",
  "sectionColors",
  "design",
  "stats",
  "features",
  "pricing",
  "portfolio",
  "gallery",
  "testimonial",
  "faq",
  "leadForm",
  "customBlock",
  "palette",
];
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSection(value: unknown): value is LandingSectionType {
  return (
    typeof value === "string" &&
    landingSectionTypes.includes(value as LandingSectionType)
  );
}

function isLandingTextSize(value: unknown): value is LandingTextSize {
  return landingTextSizes.includes(value as LandingTextSize);
}

function isEditableField(value: unknown): value is LandingEditableField {
  return Object.values(editableFieldsBySection).some((fields) =>
    fields.includes(value as LandingEditableField)
  );
}

function isSafeText(value: unknown, maxLength = 3000): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    !unsafeTextPattern.test(value)
  );
}

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function validateAllowedKeys(
  value: unknown,
  allowedKeys: readonly string[],
  path: string
) {
  if (!isRecord(value)) return [];
  const allowed = new Set(allowedKeys);
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${path}.${key} không được hỗ trợ.`);
}

function validateSectionTextSizes(
  value: unknown,
  path: string,
  requireChange = false
) {
  if (!isRecord(value)) return [`${path} phải là object.`];

  const errors = validateAllowedKeys(
    value,
    Object.keys(sectionTextSizeFields),
    path
  );
  let hasSectionChange = false;

  Object.entries(sectionTextSizeFields).forEach(([section, fields]) => {
    const sectionValue = value[section];
    if (sectionValue === undefined) return;
    hasSectionChange = true;

    if (!isRecord(sectionValue)) {
      errors.push(`${path}.${section} phải là object.`);
      return;
    }

    errors.push(...validateAllowedKeys(sectionValue, fields, `${path}.${section}`));
    const suppliedFields = fields.filter(
      (field) => sectionValue[field] !== undefined
    );
    suppliedFields.forEach((field) => {
      if (!isLandingTextSize(sectionValue[field])) {
        errors.push(`${path}.${section}.${field} không hợp lệ.`);
      }
    });

    if (requireChange && !suppliedFields.length) {
      errors.push(`${path}.${section} phải có ít nhất một cỡ chữ cần đổi.`);
    }
  });

  if (requireChange && !hasSectionChange) {
    errors.push(`${path} phải có ít nhất một section cần đổi cỡ chữ.`);
  }
  return errors;
}

function currentAssetUrls(landing: LandingData) {
  return new Set(
    [
      landing.heroImage,
      ...landing.gallery.map((item) => item.url),
      ...landing.portfolio.map((item) => item.imageUrl),
    ].filter(Boolean)
  );
}

function collectTextValidationErrors(value: unknown, path = "landing") {
  const errors: string[] = [];
  if (typeof value === "string") {
    if (unsafeTextPattern.test(value)) {
      errors.push(`${path} chứa HTML hoặc URL script không an toàn.`);
    }
    return errors;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...collectTextValidationErrors(item, `${path}[${index}]`));
    });
    return errors;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      errors.push(...collectTextValidationErrors(item, `${path}.${key}`));
    });
  }
  return errors;
}

function validateStringRecord(
  value: unknown,
  fields: string[],
  path: string
) {
  if (!isRecord(value)) return [`${path} phải là object.`];
  return fields.flatMap((field) =>
    isSafeText(value[field])
      ? []
      : [`${path}.${field} phải là chuỗi hợp lệ.`]
  );
}

export function validateLandingData(
  value: unknown,
  current?: LandingData
): string[] {
  if (!isRecord(value)) return ["LandingData phải là object."];

  const errors: string[] = validateAllowedKeys(
    value,
    landingKeys,
    "landing"
  );
  const stringFields: Array<keyof LandingData> = [
    "brand",
    "navCta",
    "eyebrow",
    "headline",
    "accentLine",
    "description",
    "primaryCta",
    "secondaryCta",
    "proof",
    "featuresEyebrow",
    "featuresHeadline",
    "pricingEyebrow",
    "pricingHeadline",
    "portfolioEyebrow",
    "portfolioHeadline",
    "galleryEyebrow",
    "galleryHeadline",
    "faqEyebrow",
    "faqHeadline",
    "finalCtaEyebrow",
    "finalCtaHeadline",
    "heroImage",
  ];
  stringFields.forEach((field) => {
    if (!isSafeText(value[field], field === "heroImage" ? 1200 : 3000)) {
      errors.push(`${field} phải là chuỗi hợp lệ.`);
    }
  });

  if (
    value.heroImageFit !== undefined &&
    value.heroImageFit !== "cover" &&
    value.heroImageFit !== "contain" &&
    value.heroImageFit !== "smart"
  ) {
    errors.push("heroImageFit phải là cover, contain hoặc smart.");
  }
  if (
    value.heroImagePosition !== undefined &&
    value.heroImagePosition !== "center" &&
    value.heroImagePosition !== "top" &&
    value.heroImagePosition !== "bottom" &&
    value.heroImagePosition !== "left" &&
    value.heroImagePosition !== "right" &&
    !/^(\d+(\.\d+)?)% (\d+(\.\d+)?)%$/.test(value.heroImagePosition as string)
  ) {
    errors.push("heroImagePosition không hợp lệ.");
  }

  if (
    !Array.isArray(value.sectionOrder) ||
    value.sectionOrder.some((section) => !isSection(section))
  ) {
    errors.push("sectionOrder chứa section không được hỗ trợ.");
  } else {
    const order = value.sectionOrder as LandingSectionType[];
    if (new Set(order).size !== order.length) {
      errors.push("sectionOrder không được chứa section trùng.");
    }
    if (!order.includes("hero") || !order.includes("finalCta")) {
      errors.push("sectionOrder phải có hero và finalCta.");
    }
  }

  if (
    !Array.isArray(value.hiddenSections) ||
    value.hiddenSections.some(
      (section) =>
        !isSection(section) || section === "finalCta"
    )
  ) {
    errors.push("hiddenSections chứa section không hợp lệ.");
  }

  if (!isRecord(value.sectionColors)) {
    errors.push("sectionColors phải là object.");
  } else {
    errors.push(
      ...validateAllowedKeys(
        value.sectionColors,
        landingSectionTypes,
        "sectionColors"
      )
    );
    Object.entries(value.sectionColors).forEach(([section, colors]) => {
      if (!isSection(section)) return;
      if (!isRecord(colors)) {
        errors.push(`sectionColors.${section} phải là object.`);
        return;
      }
      errors.push(
        ...validateAllowedKeys(
          colors,
          sectionColorTokens,
          `sectionColors.${section}`
        )
      );
      Object.entries(colors).forEach(([token, color]) => {
        if (
          sectionColorTokens.includes(
            token as (typeof sectionColorTokens)[number]
          ) &&
          (typeof color !== "string" || !hexColorPattern.test(color))
        ) {
          errors.push(
            `sectionColors.${section}.${token} phải là mã màu hex 6 ký tự.`
          );
        }
      });
    });
  }

  if (value.design !== undefined) {
    if (!isRecord(value.design)) {
      errors.push("design phải là object.");
    } else {
      errors.push(
        ...validateAllowedKeys(
          value.design,
          [
            "templateId",
            "templateVersion",
            "sectionVariants",
            "typography",
            "sectionTextSizes",
            "radius",
            "density",
          ],
          "design"
        )
      );

      if (!isSafeText(value.design.templateId, 100)) {
        errors.push("design.templateId phải là chuỗi hợp lệ.");
      }
      if (
        typeof value.design.templateVersion !== "number" ||
        !Number.isInteger(value.design.templateVersion) ||
        value.design.templateVersion < 1
      ) {
        errors.push("design.templateVersion phải là số nguyên dương.");
      }

      if (!isRecord(value.design.sectionVariants)) {
        errors.push("design.sectionVariants phải là object.");
      } else {
        errors.push(
          ...validateAllowedKeys(
            value.design.sectionVariants,
            landingSectionTypes,
            "design.sectionVariants"
          )
        );
        Object.entries(value.design.sectionVariants).forEach(
          ([section, variant]) => {
            if (
              !isSection(section) ||
              typeof variant !== "string" ||
              !landingSectionVariantOptions[section].includes(variant)
            ) {
              errors.push(`design.sectionVariants.${section} không hợp lệ.`);
            }
          }
        );
      }

      if (!isRecord(value.design.typography)) {
        errors.push("design.typography phải là object.");
      } else {
        errors.push(
          ...validateAllowedKeys(
            value.design.typography,
            ["heading", "body"],
            "design.typography"
          )
        );
        if (
          value.design.typography.heading !== "editorial" &&
          value.design.typography.heading !== "modern" &&
          value.design.typography.heading !== "friendly"
        ) {
          errors.push("design.typography.heading không hợp lệ.");
        }
        if (
          value.design.typography.body !== "sans" &&
          value.design.typography.body !== "humanist"
        ) {
          errors.push("design.typography.body không hợp lệ.");
        }
      }
      if (value.design.sectionTextSizes !== undefined) {
        errors.push(
          ...validateSectionTextSizes(
            value.design.sectionTextSizes,
            "design.sectionTextSizes"
          )
        );
      }
      if (
        value.design.radius !== undefined &&
        value.design.radius !== "none" &&
        value.design.radius !== "sm" &&
        value.design.radius !== "md" &&
        value.design.radius !== "lg" &&
        value.design.radius !== "full"
      ) {
        errors.push("design.radius không hợp lệ.");
      }
      if (
        value.design.density !== undefined &&
        value.design.density !== "compact" &&
        value.design.density !== "comfortable" &&
        value.design.density !== "spacious"
      ) {
        errors.push("design.density không hợp lệ.");
      }
    }
  }

  const arrayRules: Array<{
    key: "stats" | "features" | "pricing" | "portfolio" | "gallery" | "faq";
    max: number;
    fields: string[];
  }> = [
    { key: "stats", max: 6, fields: ["value", "label"] },
    { key: "features", max: 12, fields: ["number", "title", "text"] },
    {
      key: "pricing",
      max: 6,
      fields: ["name", "price", "description", "cta"],
    },
    {
      key: "portfolio",
      max: 12,
      fields: ["title", "category", "description", "imageUrl"],
    },
    { key: "gallery", max: 50, fields: ["url", "alt", "caption"] },
    { key: "faq", max: 12, fields: ["question", "answer"] },
  ];

  arrayRules.forEach(({ key, max, fields }) => {
    const items = value[key];
    if (!Array.isArray(items)) {
      errors.push(`${key} phải là mảng.`);
      return;
    }
    if (items.length > max) errors.push(`${key} vượt quá ${max} mục.`);
    items.forEach((item, index) => {
      errors.push(...validateStringRecord(item, fields, `${key}[${index}]`));
      const extraFields =
        key === "pricing"
          ? ["features", "highlighted"]
          : key === "portfolio" || key === "gallery"
            ? ["imageFit", "imagePosition"]
            : [];
      errors.push(
        ...validateAllowedKeys(
          item,
          [...fields, ...extraFields],
          `${key}[${index}]`
        )
      );
      if (
        key === "pricing" &&
        (!isRecord(item) ||
          !Array.isArray(item.features) ||
          item.features.some((feature) => !isSafeText(feature)))
      ) {
        errors.push(`${key}[${index}].features phải là mảng chuỗi hợp lệ.`);
      }
      if (
        key === "pricing" &&
        (!isRecord(item) || typeof item.highlighted !== "boolean")
      ) {
        errors.push(`${key}[${index}].highlighted phải là boolean.`);
      }
      if (
        (key === "portfolio" || key === "gallery") &&
        isRecord(item) &&
        item.imageFit !== undefined &&
        item.imageFit !== "cover" &&
        item.imageFit !== "contain" &&
        item.imageFit !== "smart"
      ) {
        errors.push(`${key}[${index}].imageFit không hợp lệ.`);
      }
      if (
        (key === "portfolio" || key === "gallery") &&
        isRecord(item) &&
        item.imagePosition !== undefined &&
        item.imagePosition !== "center" &&
        item.imagePosition !== "top" &&
        item.imagePosition !== "bottom" &&
        item.imagePosition !== "left" &&
        item.imagePosition !== "right" &&
        !/^(\d+(\.\d+)?)% (\d+(\.\d+)?)%$/.test(item.imagePosition as string)
      ) {
        errors.push(`${key}[${index}].imagePosition không hợp lệ.`);
      }
    });
  });

  errors.push(
    ...validateAllowedKeys(
      value.testimonial,
      ["quote", "name", "role"],
      "testimonial"
    )
  );
  errors.push(
    ...validateStringRecord(
      value.testimonial,
      ["quote", "name", "role"],
      "testimonial"
    )
  );
  errors.push(
    ...validateAllowedKeys(
      value.leadForm,
      ["title", "description", "fields", "buttonText", "successMessage"],
      "leadForm"
    )
  );
  errors.push(
    ...validateStringRecord(
      value.leadForm,
      ["title", "description", "buttonText", "successMessage"],
      "leadForm"
    )
  );
  if (
    !isRecord(value.leadForm) ||
    !Array.isArray(value.leadForm.fields) ||
    value.leadForm.fields.some((field) => !isSafeText(field))
  ) {
    errors.push("leadForm.fields phải là mảng chuỗi hợp lệ.");
  }

  if (
    !isRecord(value.customBlock) ||
    typeof value.customBlock.htmlCode !== "string"
  ) {
    errors.push("customBlock.htmlCode phải là chuỗi hợp lệ.");
  }

  if (!isRecord(value.palette)) {
    errors.push("palette phải là object.");
  } else {
    const palette = value.palette;
    errors.push(...validateAllowedKeys(palette, paletteTokens, "palette"));
    paletteTokens.forEach((token) => {
      if (
        typeof palette[token] !== "string" ||
        !hexColorPattern.test(palette[token] as string)
      ) {
        errors.push(`palette.${token} phải là mã màu hex 6 ký tự.`);
      }
    });
  }

  if (current) {
    const allowedAssets = currentAssetUrls(current);
    const proposedAssets = [
      value.heroImage,
      ...(Array.isArray(value.gallery)
        ? value.gallery.map((item) => (isRecord(item) ? item.url : ""))
        : []),
      ...(Array.isArray(value.portfolio)
        ? value.portfolio.map((item) =>
            isRecord(item) ? item.imageUrl : ""
          )
        : []),
    ];
    proposedAssets.forEach((asset) => {
      if (
        typeof asset === "string" &&
        asset.startsWith("/api/assets/") &&
        !allowedAssets.has(asset)
      ) {
        errors.push(`Asset nội bộ không tồn tại: ${asset}`);
      }
    });
  }

  errors.push(...collectTextValidationErrors(value));
  return Array.from(new Set(errors));
}

function parseIndex(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0
    ? Number(value)
    : undefined;
}

export function parseLandingOperationEnvelope(
  rawValue: unknown,
  options: {
    mode: LandingOperationMode;
    current: LandingData;
    source?: "ai" | "ui" | "system";
    targetSection?: LandingSectionType;
    editableFields?: readonly LandingEditableField[];
  }
): LandingOperationEnvelope {
  const value = normalizeLandingOperationInput(rawValue, options);
  if (!isRecord(value) || !Array.isArray(value.operations)) {
    throw new LandingOperationValidationError([
      "Phản hồi phải là object có mảng operations.",
    ]);
  }
  const envelopeErrors = validateAllowedKeys(
    value,
    ["operations", "explanation"],
    "response"
  );
  if (envelopeErrors.length) {
    throw new LandingOperationValidationError(envelopeErrors);
  }
  if (!value.operations.length) {
    throw new LandingOperationValidationError([
      "Agent chưa trả về thay đổi nào.",
    ]);
  }
  if (value.operations.length > 50) {
    throw new LandingOperationValidationError([
      "Một lần chỉnh sửa không được vượt quá 50 operations.",
    ]);
  }

  const errors: string[] = [];
  const operations: LandingOperation[] = [];

  value.operations.forEach((rawOperation, operationIndex) => {
    const path = `operations[${operationIndex}]`;
    if (!isRecord(rawOperation) || typeof rawOperation.type !== "string") {
      errors.push(`${path} không hợp lệ.`);
      return;
    }
    const allowedOperationKeys = operationKeys[rawOperation.type];
    if (allowedOperationKeys) {
      errors.push(
        ...validateAllowedKeys(rawOperation, allowedOperationKeys, path)
      );
    }

    switch (rawOperation.type) {
      case "update_text": {
        const { section, field, value: text } = rawOperation;
        if (!isSection(section)) {
          errors.push(`${path}.section không hợp lệ.`);
          return;
        }
        if (
          !isEditableField(field) ||
          !editableFieldsBySection[section].includes(field)
        ) {
          errors.push(`${path}.field không thuộc section ${section}.`);
          return;
        }
        if (!isSafeText(text)) {
          errors.push(`${path}.value phải là chuỗi an toàn.`);
          return;
        }
        const index = parseIndex(rawOperation.index);
        const nestedIndex = parseIndex(rawOperation.nestedIndex);
        if (indexedFields.has(field) && index === undefined) {
          errors.push(`${path}.index là bắt buộc cho ${field}.`);
          return;
        }
        if (nestedFields.has(field) && nestedIndex === undefined) {
          errors.push(`${path}.nestedIndex là bắt buộc cho ${field}.`);
          return;
        }
        operations.push({
          type: "update_text",
          section,
          field,
          value: text,
          index,
          nestedIndex,
        });
        return;
      }
      case "replace_section": {
        if (!isSection(rawOperation.section)) {
          errors.push(`${path}.section không hợp lệ.`);
          return;
        }
        if (
          rawOperation.section === "customBlock" ||
          rawOperation.section === "finalCta"
        ) {
          errors.push(
            rawOperation.section === "customBlock"
              ? "customBlock phải dùng update_custom_block."
              : "finalCta không có dữ liệu section riêng để thay thế."
          );
          return;
        }
        if (rawOperation.section === "hero") {
          errors.push(
            ...validateAllowedKeys(
              rawOperation.value,
              [
                "brand",
                "navCta",
                "eyebrow",
                "headline",
                "accentLine",
                "description",
                "primaryCta",
                "secondaryCta",
                "proof",
                "heroImage",
              ],
              `${path}.value`
            )
          );
        }
        operations.push({
          type: "replace_section",
          section: rawOperation.section,
          value: rawOperation.value,
        });
        return;
      }
      case "set_palette": {
        if (
          typeof rawOperation.token !== "string" ||
          !paletteTokens.includes(
            rawOperation.token as (typeof paletteTokens)[number]
          ) ||
          typeof rawOperation.value !== "string" ||
          !hexColorPattern.test(rawOperation.value)
        ) {
          errors.push(`${path} chứa màu hoặc token không hợp lệ.`);
          return;
        }
        operations.push({
          type: "set_palette",
          token: rawOperation.token as keyof LandingData["palette"],
          value: rawOperation.value,
        });
        return;
      }
      case "hide_section": {
        if (
          !isSection(rawOperation.section) ||
          rawOperation.section === "finalCta"
        ) {
          errors.push(`${path}.section không thể ẩn.`);
          return;
        }
        operations.push({
          type: "hide_section",
          section: rawOperation.section,
        });
        return;
      }
      case "show_section": {
        if (!isSection(rawOperation.section)) {
          errors.push(`${path}.section không hợp lệ.`);
          return;
        }
        operations.push({
          type: "show_section",
          section: rawOperation.section,
        });
        return;
      }
      case "move_section": {
        if (
          !isSection(rawOperation.section) ||
          !Number.isInteger(rawOperation.toIndex) ||
          Number(rawOperation.toIndex) < 0
        ) {
          errors.push(`${path} có section hoặc toIndex không hợp lệ.`);
          return;
        }
        operations.push({
          type: "move_section",
          section: rawOperation.section,
          toIndex: Number(rawOperation.toIndex),
        });
        return;
      }
      case "add_section": {
        if (!isSection(rawOperation.section)) {
          errors.push(`${path}.section không hợp lệ.`);
          return;
        }
        operations.push({
          type: "add_section",
          section: rawOperation.section,
          atIndex: parseIndex(rawOperation.atIndex),
        });
        return;
      }
      case "assign_image": {
        const target = rawOperation.target;
        const url = rawOperation.url;
        const validTarget =
          target === "hero" ||
          target === "gallery:add" ||
          (typeof target === "string" &&
            /^(gallery|portfolio):\d+$/.test(target));
        if (!validTarget || typeof url !== "string" || url.length > 1200) {
          errors.push(`${path} có target hoặc URL ảnh không hợp lệ.`);
          return;
        }
        const allowedAssets = currentAssetUrls(options.current);
        if (
          options.source === "ai" &&
          url &&
          !allowedAssets.has(url)
        ) {
          errors.push(`${path} tham chiếu ảnh chưa có trong project.`);
          return;
        }
        operations.push({
          type: "assign_image",
          target: target as LandingImageTarget,
          url,
          alt:
            typeof rawOperation.alt === "string"
              ? normalizeText(rawOperation.alt)
              : undefined,
        });
        return;
      }
      case "set_variant": {
        if (!isSection(rawOperation.section)) {
          errors.push(`${path}.section không hợp lệ.`);
          return;
        }
        if (
          typeof rawOperation.variant !== "string" ||
          !landingSectionVariantOptions[rawOperation.section]?.includes(
            rawOperation.variant
          )
        ) {
          errors.push(`${path}.variant không hợp lệ cho section ${rawOperation.section}.`);
          return;
        }
        operations.push({
          type: "set_variant",
          section: rawOperation.section,
          variant: rawOperation.variant,
        });
        return;
      }
      case "set_design": {
        if (
          rawOperation.typography === undefined &&
          rawOperation.sectionTextSizes === undefined &&
          rawOperation.radius === undefined &&
          rawOperation.density === undefined
        ) {
          errors.push(`${path} phải có ít nhất một cấu hình design cần đổi.`);
          return;
        }
        if (rawOperation.typography !== undefined) {
          if (!isRecord(rawOperation.typography)) {
            errors.push(`${path}.typography phải là object.`);
            return;
          }
          const { heading, body } = rawOperation.typography;
          if (
            heading !== undefined &&
            heading !== "editorial" &&
            heading !== "modern" &&
            heading !== "friendly"
          ) {
            errors.push(`${path}.typography.heading không hợp lệ.`);
            return;
          }
          if (
            body !== undefined &&
            body !== "sans" &&
            body !== "humanist"
          ) {
            errors.push(`${path}.typography.body không hợp lệ.`);
            return;
          }
        }
        if (rawOperation.sectionTextSizes !== undefined) {
          const sectionTextSizeErrors = validateSectionTextSizes(
            rawOperation.sectionTextSizes,
            `${path}.sectionTextSizes`,
            true
          );
          if (sectionTextSizeErrors.length) {
            errors.push(...sectionTextSizeErrors);
            return;
          }
        }
        if (
          rawOperation.radius !== undefined &&
          rawOperation.radius !== "none" &&
          rawOperation.radius !== "sm" &&
          rawOperation.radius !== "md" &&
          rawOperation.radius !== "lg" &&
          rawOperation.radius !== "full"
        ) {
          errors.push(`${path}.radius không hợp lệ.`);
          return;
        }
        if (
          rawOperation.density !== undefined &&
          rawOperation.density !== "compact" &&
          rawOperation.density !== "comfortable" &&
          rawOperation.density !== "spacious"
        ) {
          errors.push(`${path}.density không hợp lệ.`);
          return;
        }
        operations.push({
          type: "set_design",
          typography: rawOperation.typography as
            | Extract<LandingOperation, { type: "set_design" }>["typography"]
            | undefined,
          sectionTextSizes: rawOperation.sectionTextSizes as
            | LandingSectionTextSizes
            | undefined,
          radius: rawOperation.radius as Extract<
            LandingOperation,
            { type: "set_design" }
          >["radius"],
          density: rawOperation.density as Extract<
            LandingOperation,
            { type: "set_design" }
          >["density"],
        });
        return;
      }
      case "update_custom_block": {
        if (typeof rawOperation.htmlCode !== "string") {
          errors.push(`${path}.htmlCode phải là chuỗi.`);
          return;
        }
        operations.push({
          type: "update_custom_block",
          htmlCode: rawOperation.htmlCode,
        });
        return;
      }
      case "replace_landing": {
        if (options.mode !== "create" && options.source !== "system") {
          errors.push("replace_landing chỉ được dùng khi tạo project mới.");
          return;
        }
        const landingErrors = validateLandingData(
          rawOperation.value,
          options.current
        );
        if (landingErrors.length) {
          errors.push(...landingErrors.map((error) => `${path}: ${error}`));
          return;
        }
        operations.push({
          type: "replace_landing",
          value: normalizeLandingData(
            rawOperation.value as Partial<LandingData>
          ),
        });
        return;
      }
      default:
        errors.push(`${path}.type “${rawOperation.type}” không được hỗ trợ.`);
    }
  });

  if (errors.length) throw new LandingOperationValidationError(errors);
  return {
    operations,
    explanation:
      typeof value.explanation === "string"
        ? normalizeText(value.explanation)
        : undefined,
  };
}

function updateIndexedItem<T>(
  items: T[],
  index: number | undefined,
  update: (item: T) => T
) {
  if (index === undefined || index < 0 || index >= items.length) {
    throw new LandingOperationValidationError([
      `Không tìm thấy phần tử tại vị trí ${index ?? "không xác định"}.`,
    ]);
  }
  return items.map((item, itemIndex) =>
    itemIndex === index ? update(item) : item
  );
}

function applyTextOperation(
  current: LandingData,
  operation: Extract<LandingOperation, { type: "update_text" }>
) {
  const value = normalizeText(operation.value);
  const { field, index, nestedIndex } = operation;

  switch (field) {
    case "brand":
    case "navCta":
    case "eyebrow":
    case "headline":
    case "accentLine":
    case "description":
    case "primaryCta":
    case "secondaryCta":
    case "proof":
    case "featuresEyebrow":
    case "featuresHeadline":
    case "pricingEyebrow":
    case "pricingHeadline":
    case "portfolioEyebrow":
    case "portfolioHeadline":
    case "galleryEyebrow":
    case "galleryHeadline":
    case "faqEyebrow":
    case "faqHeadline":
    case "finalCtaEyebrow":
    case "finalCtaHeadline":
      return { ...current, [field]: value };
    case "stats.value":
    case "stats.label": {
      const key = field.split(".")[1] as "value" | "label";
      return {
        ...current,
        stats: updateIndexedItem(current.stats, index, (item) => ({
          ...item,
          [key]: value,
        })),
      };
    }
    case "features.number":
    case "features.title":
    case "features.text": {
      const key = field.split(".")[1] as "number" | "title" | "text";
      return {
        ...current,
        features: updateIndexedItem(current.features, index, (item) => ({
          ...item,
          [key]: value,
        })),
      };
    }
    case "pricing.name":
    case "pricing.price":
    case "pricing.description":
    case "pricing.cta": {
      const key = field.split(".")[1] as
        | "name"
        | "price"
        | "description"
        | "cta";
      return {
        ...current,
        pricing: updateIndexedItem(current.pricing, index, (item) => ({
          ...item,
          [key]: value,
        })),
      };
    }
    case "pricing.feature":
      return {
        ...current,
        pricing: updateIndexedItem(current.pricing, index, (item) => ({
          ...item,
          features: updateIndexedItem(
            item.features,
            nestedIndex,
            () => value
          ),
        })),
      };
    case "portfolio.category":
    case "portfolio.title":
    case "portfolio.description": {
      const key = field.split(".")[1] as
        | "category"
        | "title"
        | "description";
      return {
        ...current,
        portfolio: updateIndexedItem(current.portfolio, index, (item) => ({
          ...item,
          [key]: value,
        })),
      };
    }
    case "gallery.alt":
    case "gallery.caption": {
      const key = field.split(".")[1] as "alt" | "caption";
      return {
        ...current,
        gallery: updateIndexedItem(current.gallery, index, (item) => ({
          ...item,
          [key]: value,
        })),
      };
    }
    case "testimonial.quote":
    case "testimonial.name":
    case "testimonial.role": {
      const key = field.split(".")[1] as "quote" | "name" | "role";
      return {
        ...current,
        testimonial: { ...current.testimonial, [key]: value },
      };
    }
    case "faq.question":
    case "faq.answer": {
      const key = field.split(".")[1] as "question" | "answer";
      return {
        ...current,
        faq: updateIndexedItem(current.faq, index, (item) => ({
          ...item,
          [key]: value,
        })),
      };
    }
    case "leadForm.title":
    case "leadForm.description":
    case "leadForm.buttonText": {
      const key = field.split(".")[1] as
        | "title"
        | "description"
        | "buttonText";
      return {
        ...current,
        leadForm: { ...current.leadForm, [key]: value },
      };
    }
    case "leadForm.field":
      return {
        ...current,
        leadForm: {
          ...current.leadForm,
          fields: updateIndexedItem(
            current.leadForm.fields,
            index,
            () => value
          ),
        },
      };
  }
}

function applyReplaceSection(
  current: LandingData,
  operation: Extract<LandingOperation, { type: "replace_section" }>
): LandingData {
  const { section, value } = operation;
  switch (section) {
    case "hero": {
      if (!isRecord(value)) {
        throw new LandingOperationValidationError([
          "Dữ liệu hero phải là object.",
        ]);
      }
      const allowedFields = editableFieldsBySection.hero.filter(
        (field) => !field.includes(".")
      );
      const patch = Object.fromEntries(
        allowedFields
          .filter((field) => typeof value[field] === "string")
          .map((field) => [field, normalizeText(value[field] as string)])
      );
      return { ...current, ...patch };
    }
    case "stats":
    case "features":
    case "pricing":
    case "portfolio":
    case "gallery":
    case "faq": {
      let items = value;
      const patch: Partial<LandingData> = {};
      
      if (isRecord(value) && Array.isArray(value.items)) {
        items = value.items;
        if (section !== "stats") {
          if (typeof value.eyebrow === "string") {
            patch[`${section}Eyebrow` as keyof LandingData] = value.eyebrow as never;
          }
          if (typeof value.headline === "string") {
            patch[`${section}Headline` as keyof LandingData] = value.headline as never;
          }
        }
      }

      if (!Array.isArray(items)) {
        throw new LandingOperationValidationError([
          `Dữ liệu ${section} phải là mảng.`,
        ]);
      }
      return normalizeLandingData({ ...current, ...patch, [section]: items });
    }
    case "testimonial":
    case "leadForm":
      if (!isRecord(value)) {
        throw new LandingOperationValidationError([
          `Dữ liệu ${section} phải là object.`,
        ]);
      }
      return normalizeLandingData({ ...current, [section]: value });
  }
}

function ensureSectionPresent(
  current: LandingData,
  section: LandingSectionType,
  atIndex?: number
) {
  const withoutSection = current.sectionOrder.filter((item) => item !== section);
  const fallbackIndex = withoutSection.includes("finalCta")
    ? withoutSection.indexOf("finalCta")
    : withoutSection.length;
  const insertIndex =
    atIndex === undefined
      ? fallbackIndex
      : Math.min(Math.max(atIndex, 0), withoutSection.length);
  const sectionOrder = [...withoutSection];
  sectionOrder.splice(insertIndex, 0, section);
  return normalizeLandingData({
    ...current,
    sectionOrder,
    hiddenSections: current.hiddenSections.filter((item) => item !== section),
  });
}

function applyImageOperation(
  current: LandingData,
  operation: Extract<LandingOperation, { type: "assign_image" }>
) {
  const { target, url, alt = "" } = operation;
  if (target === "hero") {
    return {
      ...current,
      heroImage: url,
      heroImageFit: "smart" as const,
      heroImagePosition: "center" as const,
    };
  }
  if (target === "gallery:add") {
    return ensureSectionPresent(
      {
        ...current,
        gallery: [
          ...current.gallery,
          {
            url,
            alt,
            caption: "",
            imageFit: "cover" as const,
            imagePosition: "center" as const,
          },
        ],
      },
      "gallery"
    );
  }
  if (target.startsWith("gallery:")) {
    const index = Number(target.split(":")[1]);
    return {
      ...current,
      gallery: updateIndexedItem(current.gallery, index, (item) => ({
        ...item,
        url,
        alt: alt || item.alt,
      })),
    };
  }
  const index = Number(target.split(":")[1]);
  return {
    ...current,
    portfolio: updateIndexedItem(current.portfolio, index, (item) => ({
      ...item,
      imageUrl: url,
      imageFit: "cover" as const,
      imagePosition: "center" as const,
    })),
  };
}

export function applyLandingOperations(
  current: LandingData,
  operations: LandingOperation[]
) {
  let landing = current;
  const changedSections = new Set<LandingSectionType>();

  operations.forEach((operation) => {
    switch (operation.type) {
      case "update_text":
        landing = applyTextOperation(landing, operation);
        changedSections.add(operation.section);
        break;
      case "replace_section":
        landing = applyReplaceSection(landing, operation);
        changedSections.add(operation.section);
        break;
      case "set_palette":
        landing = {
          ...landing,
          palette: {
            ...landing.palette,
            [operation.token]: operation.value,
          },
        };
        landing.sectionOrder.forEach((section) => changedSections.add(section));
        break;
      case "hide_section":
        landing = normalizeLandingData({
          ...landing,
          hiddenSections: Array.from(
            new Set([...landing.hiddenSections, operation.section])
          ),
        });
        changedSections.add(operation.section);
        break;
      case "show_section":
        landing = ensureSectionPresent(landing, operation.section);
        changedSections.add(operation.section);
        break;
      case "move_section": {
        const withoutSection = landing.sectionOrder.filter(
          (section) => section !== operation.section
        );
        const toIndex = Math.min(operation.toIndex, withoutSection.length);
        withoutSection.splice(toIndex, 0, operation.section);
        landing = normalizeLandingData({
          ...landing,
          sectionOrder: withoutSection,
        });
        changedSections.add(operation.section);
        break;
      }
      case "add_section":
        landing = ensureSectionPresent(
          landing,
          operation.section,
          operation.atIndex
        );
        changedSections.add(operation.section);
        break;
      case "assign_image":
        landing = applyImageOperation(landing, operation);
        changedSections.add(
          operation.target === "hero"
            ? "hero"
            : operation.target.startsWith("portfolio:")
              ? "portfolio"
              : "gallery"
        );
        break;
      case "set_variant":
        landing = {
          ...landing,
          design: {
            ...landing.design!,
            sectionVariants: {
              ...landing.design?.sectionVariants,
              [operation.section]: operation.variant,
            },
          },
        };
        changedSections.add(operation.section);
        break;
      case "set_design":
        landing = {
          ...landing,
          design: {
            ...landing.design!,
            typography: operation.typography ? {
              ...landing.design!.typography,
              ...operation.typography,
            } : landing.design!.typography,
            sectionTextSizes: operation.sectionTextSizes
              ? {
                  ...landing.design!.sectionTextSizes,
                  stats: operation.sectionTextSizes.stats
                    ? {
                        ...landing.design!.sectionTextSizes?.stats,
                        ...operation.sectionTextSizes.stats,
                      }
                    : landing.design!.sectionTextSizes?.stats,
                  pricing: operation.sectionTextSizes.pricing
                    ? {
                        ...landing.design!.sectionTextSizes?.pricing,
                        ...operation.sectionTextSizes.pricing,
                      }
                    : landing.design!.sectionTextSizes?.pricing,
                }
              : landing.design!.sectionTextSizes,
            ...(operation.radius !== undefined ? { radius: operation.radius } : {}),
            ...(operation.density !== undefined ? { density: operation.density } : {}),
          },
        };
        if (
          operation.typography ||
          operation.radius !== undefined ||
          operation.density !== undefined
        ) {
          landing.sectionOrder.forEach((section) => changedSections.add(section));
        }
        if (operation.sectionTextSizes?.stats) changedSections.add("stats");
        if (operation.sectionTextSizes?.pricing) changedSections.add("pricing");
        break;
      case "update_custom_block":
        landing = {
          ...landing,
          customBlock: { htmlCode: operation.htmlCode },
        };
        changedSections.add("customBlock");
        break;
      case "replace_landing":
        landing = normalizeLandingData(operation.value);
        landing.sectionOrder.forEach((section) => changedSections.add(section));
        break;
    }
  });

  const errors = validateLandingData(landing, current);
  if (errors.length) throw new LandingOperationValidationError(errors);

  const normalizedCurrent = normalizeLandingData(current);
  const normalizedLanding = normalizeLandingData(landing);
  const hasChanges =
    JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedLanding);

  return {
    landing: normalizedLanding,
    changedSections: hasChanges ? Array.from(changedSections) : [],
  };
}

export function operationForTextEdit(input: {
  section: LandingSectionType;
  field: LandingEditableField;
  value: string;
  index?: number;
  nestedIndex?: number;
}): Extract<LandingOperation, { type: "update_text" }> {
  return {
    type: "update_text",
    section: input.section,
    field: input.field,
    value: input.value,
    index: input.index,
    nestedIndex: input.nestedIndex,
  };
}

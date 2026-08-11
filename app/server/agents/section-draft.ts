import type { LandingData, LandingSectionType } from "../../landing-data";
import type { LandingEditableField } from "../../landing-manifest";
import type { LandingOperation } from "../../landing-operations";

type HeroDraft = Pick<
  LandingData,
  | "brand"
  | "navCta"
  | "eyebrow"
  | "headline"
  | "accentLine"
  | "description"
  | "primaryCta"
  | "secondaryCta"
  | "proof"
>;

type HeadingListDraft<T> = {
  eyebrow: string;
  headline: string;
  items: T[];
};

type PortfolioContentItem = Pick<
  LandingData["portfolio"][number],
  "title" | "category" | "description"
>;

type GalleryContentItem = Pick<
  LandingData["gallery"][number],
  "alt" | "caption"
>;

export type SectionDraftByType = {
  hero: HeroDraft;
  stats: { items: LandingData["stats"] };
  features: HeadingListDraft<LandingData["features"][number]>;
  pricing: HeadingListDraft<LandingData["pricing"][number]>;
  portfolio: HeadingListDraft<PortfolioContentItem>;
  gallery: HeadingListDraft<GalleryContentItem>;
  testimonial: LandingData["testimonial"];
  faq: HeadingListDraft<LandingData["faq"][number]>;
  leadForm: LandingData["leadForm"];
  finalCta: Pick<
    LandingData,
    "finalCtaEyebrow" | "finalCtaHeadline" | "primaryCta"
  >;
};

export type SectionDraftEnvelope<S extends LandingSectionType> = {
  draft: SectionDraftByType[S];
  explanation?: string;
};

export class SectionDraftValidationError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(errors[0] || "SectionDraft không hợp lệ.");
    this.name = "SectionDraftValidationError";
    this.errors = errors;
  }
}

const unsafeTextPattern =
  /<\s*script\b|javascript\s*:|on(?:error|load|click)\s*=/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeString(value: unknown, maxLength = 3_000): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength &&
    !unsafeTextPattern.test(value)
  );
}

function allowedKeyErrors(
  value: unknown,
  allowedKeys: readonly string[],
  path: string
) {
  if (!isRecord(value)) return [`${path} phải là object.`];
  const allowed = new Set(allowedKeys);
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${path}.${key} không được hỗ trợ.`);
}

function stringFieldErrors(
  value: unknown,
  fields: readonly string[],
  path: string
) {
  if (!isRecord(value)) return [`${path} phải là object.`];
  return fields.flatMap((field) =>
    isSafeString(value[field])
      ? []
      : [`${path}.${field} phải là chuỗi hợp lệ.`]
  );
}

function validateObjectArray(
  value: unknown,
  allowedFields: readonly string[],
  path: string,
  options?: { min?: number; max?: number },
  stringFields: readonly string[] = allowedFields
) {
  const errors: string[] = [];
  if (!Array.isArray(value)) return [`${path} phải là mảng.`];
  if (options?.min !== undefined && value.length < options.min) {
    errors.push(`${path} phải có ít nhất ${options.min} mục.`);
  }
  if (options?.max !== undefined && value.length > options.max) {
    errors.push(`${path} không được vượt quá ${options.max} mục.`);
  }
  value.forEach((item, index) => {
    errors.push(...allowedKeyErrors(item, allowedFields, `${path}[${index}]`));
    errors.push(
      ...stringFieldErrors(item, stringFields, `${path}[${index}]`)
    );
  });
  return errors;
}

function validateHeadingList(
  draft: unknown,
  allowedFields: readonly string[],
  options?: { min?: number; max?: number },
  stringFields: readonly string[] = allowedFields
) {
  const errors = allowedKeyErrors(
    draft,
    ["eyebrow", "headline", "items"],
    "draft"
  );
  errors.push(...stringFieldErrors(draft, ["eyebrow", "headline"], "draft"));
  errors.push(
    ...validateObjectArray(
      isRecord(draft) ? draft.items : undefined,
      allowedFields,
      "draft.items",
      options,
      stringFields
    )
  );
  return errors;
}

function validateDraft(
  draft: unknown,
  section: LandingSectionType,
  current: Partial<LandingData>
) {
  switch (section) {
    case "hero": {
      const fields = [
        "brand",
        "navCta",
        "eyebrow",
        "headline",
        "accentLine",
        "description",
        "primaryCta",
        "secondaryCta",
        "proof",
      ];
      return [
        ...allowedKeyErrors(draft, fields, "draft"),
        ...stringFieldErrors(draft, fields, "draft"),
      ];
    }
    case "stats": {
      const errors = allowedKeyErrors(draft, ["items"], "draft");
      errors.push(
        ...validateObjectArray(
          isRecord(draft) ? draft.items : undefined,
          ["value", "label"],
          "draft.items",
          { min: 3, max: 6 }
        )
      );
      return errors;
    }
    case "features":
      return validateHeadingList(draft, ["number", "title", "text"], {
        min: 3,
        max: 12,
      });
    case "pricing": {
      const errors = validateHeadingList(
        draft,
        ["name", "price", "description", "features", "highlighted", "cta"],
        { min: 1, max: 3 },
        ["name", "price", "description", "cta"]
      );
      if (isRecord(draft) && Array.isArray(draft.items)) {
        draft.items.forEach((item, index) => {
          if (!isRecord(item)) return;
          if (
            !Array.isArray(item.features) ||
            !item.features.length ||
            item.features.some((feature) => !isSafeString(feature))
          ) {
            errors.push(
              `draft.items[${index}].features phải là mảng chuỗi hợp lệ.`
            );
          }
          if (typeof item.highlighted !== "boolean") {
            errors.push(
              `draft.items[${index}].highlighted phải là boolean.`
            );
          }
        });
      }
      return errors;
    }
    case "portfolio": {
      const errors = validateHeadingList(
        draft,
        ["title", "category", "description"],
        { min: 1, max: 12 }
      );
      if (
        isRecord(draft) &&
        Array.isArray(draft.items) &&
        current.portfolio?.some((item) => Boolean(item.imageUrl)) &&
        draft.items.length !== current.portfolio.length
      ) {
        errors.push(
          "draft.items của portfolio phải giữ nguyên số lượng ảnh hiện có."
        );
      }
      return errors;
    }
    case "gallery": {
      const errors = validateHeadingList(draft, ["alt", "caption"], {
        min: 0,
        max: 50,
      });
      if (
        isRecord(draft) &&
        Array.isArray(draft.items) &&
        (current.gallery?.length ?? 0) > 0 &&
        draft.items.length !== current.gallery.length
      ) {
        errors.push(
          "draft.items của gallery phải giữ nguyên số lượng ảnh hiện có."
        );
      }
      return errors;
    }
    case "testimonial": {
      const fields = ["quote", "name", "role"];
      return [
        ...allowedKeyErrors(draft, fields, "draft"),
        ...stringFieldErrors(draft, fields, "draft"),
      ];
    }
    case "faq":
      return validateHeadingList(draft, ["question", "answer"], {
        min: 3,
        max: 6,
      });
    case "leadForm": {
      const fields = [
        "title",
        "description",
        "fields",
        "buttonText",
        "successMessage",
      ];
      const errors = allowedKeyErrors(draft, fields, "draft");
      errors.push(
        ...stringFieldErrors(
          draft,
          ["title", "description", "buttonText", "successMessage"],
          "draft"
        )
      );
      const formFields = isRecord(draft) ? draft.fields : undefined;
      if (
        !Array.isArray(formFields) ||
        formFields.length < 1 ||
        formFields.length > 8 ||
        formFields.some((field) => !isSafeString(field))
      ) {
        errors.push("draft.fields phải là mảng gồm 1-8 chuỗi hợp lệ.");
      }
      return errors;
    }
    case "finalCta": {
      const fields = ["finalCtaEyebrow", "finalCtaHeadline", "primaryCta"];
      return [
        ...allowedKeyErrors(draft, fields, "draft"),
        ...stringFieldErrors(draft, fields, "draft"),
      ];
    }
  }
}

export function parseSectionDraftEnvelope<S extends LandingSectionType>(
  value: unknown,
  section: S,
  current: Partial<LandingData>
): SectionDraftEnvelope<S> {
  if (!isRecord(value)) {
    throw new SectionDraftValidationError([
      "Phản hồi phải là object có khóa draft.",
    ]);
  }
  const errors = allowedKeyErrors(value, ["draft", "explanation"], "response");
  if (!("draft" in value)) errors.push("response.draft là bắt buộc.");
  if (
    value.explanation !== undefined &&
    !isSafeString(value.explanation, 1_000)
  ) {
    errors.push("response.explanation phải là chuỗi hợp lệ.");
  }
  errors.push(...validateDraft(value.draft, section, current));
  if (errors.length) throw new SectionDraftValidationError(errors);
  return {
    draft: value.draft as SectionDraftByType[S],
    explanation:
      typeof value.explanation === "string"
        ? value.explanation.trim()
        : undefined,
  };
}

function updateText(
  section: LandingSectionType,
  field: LandingEditableField,
  value: string,
  index?: number
): LandingOperation {
  return index === undefined
    ? { type: "update_text", section, field, value }
    : { type: "update_text", section, field, value, index };
}

function headingOperations(
  section: "features" | "pricing" | "portfolio" | "gallery" | "faq",
  eyebrow: string,
  headline: string
): LandingOperation[] {
  const fields = {
    features: ["featuresEyebrow", "featuresHeadline"],
    pricing: ["pricingEyebrow", "pricingHeadline"],
    portfolio: ["portfolioEyebrow", "portfolioHeadline"],
    gallery: ["galleryEyebrow", "galleryHeadline"],
    faq: ["faqEyebrow", "faqHeadline"],
  } as const;
  return [
    updateText(section, fields[section][0], eyebrow),
    updateText(section, fields[section][1], headline),
  ];
}

export function compileSectionDraftToOperations<S extends LandingSectionType>(
  section: S,
  rawDraft: SectionDraftByType[S],
  current: Partial<LandingData>
): LandingOperation[] {
  switch (section) {
    case "hero": {
      const draft = rawDraft as SectionDraftByType["hero"];
      return (
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
        ] as const
      ).map((field) => updateText("hero", field, draft[field]));
    }
    case "stats": {
      const draft = rawDraft as SectionDraftByType["stats"];
      return [{ type: "replace_section", section: "stats", value: draft.items }];
    }
    case "features": {
      const draft = rawDraft as SectionDraftByType["features"];
      return [
        ...headingOperations("features", draft.eyebrow, draft.headline),
        { type: "replace_section", section: "features", value: draft.items },
      ];
    }
    case "pricing": {
      const draft = rawDraft as SectionDraftByType["pricing"];
      return [
        ...headingOperations("pricing", draft.eyebrow, draft.headline),
        { type: "replace_section", section: "pricing", value: draft.items },
      ];
    }
    case "portfolio": {
      const draft = rawDraft as SectionDraftByType["portfolio"];
      const items = draft.items.map((item, index) => ({
        ...item,
        imageUrl: current.portfolio?.[index]?.imageUrl || "",
        imageFit: current.portfolio?.[index]?.imageFit,
        imagePosition: current.portfolio?.[index]?.imagePosition,
      }));
      return [
        ...headingOperations("portfolio", draft.eyebrow, draft.headline),
        { type: "replace_section", section: "portfolio", value: items },
      ];
    }
    case "gallery": {
      const draft = rawDraft as SectionDraftByType["gallery"];
      const maxItems = Math.max(current.gallery?.length ?? 0, 0);
      return [
        ...headingOperations("gallery", draft.eyebrow, draft.headline),
        ...draft.items
          .slice(0, maxItems)
          .flatMap((item, index) => [
            updateText("gallery", "gallery.alt", item.alt, index),
            updateText("gallery", "gallery.caption", item.caption, index),
          ]),
      ];
    }
    case "testimonial": {
      const draft = rawDraft as SectionDraftByType["testimonial"];
      return [
        { type: "replace_section", section: "testimonial", value: draft },
      ];
    }
    case "faq": {
      const draft = rawDraft as SectionDraftByType["faq"];
      return [
        ...headingOperations("faq", draft.eyebrow, draft.headline),
        { type: "replace_section", section: "faq", value: draft.items },
      ];
    }
    case "leadForm": {
      const draft = rawDraft as SectionDraftByType["leadForm"];
      return [{ type: "replace_section", section: "leadForm", value: draft }];
    }
    case "finalCta": {
      const draft = rawDraft as SectionDraftByType["finalCta"];
      return [
        updateText(
          "finalCta",
          "finalCtaEyebrow",
          draft.finalCtaEyebrow
        ),
        updateText(
          "finalCta",
          "finalCtaHeadline",
          draft.finalCtaHeadline
        ),
        updateText("finalCta", "primaryCta", draft.primaryCta),
      ];
    }
  }
}

const sectionDraftSchemas: Record<LandingSectionType, string> = {
  hero:
    '{"draft":{"brand":"...","navCta":"...","eyebrow":"...","headline":"...","accentLine":"...","description":"...","primaryCta":"...","secondaryCta":"...","proof":"..."},"explanation":"..."}',
  stats:
    '{"draft":{"items":[{"value":"...","label":"..."}]} ,"explanation":"..."}',
  features:
    '{"draft":{"eyebrow":"...","headline":"...","items":[{"number":"01","title":"...","text":"..."}]},"explanation":"..."}',
  pricing:
    '{"draft":{"eyebrow":"...","headline":"...","items":[{"name":"...","price":"...","description":"...","features":["..."],"highlighted":false,"cta":"..."}]},"explanation":"..."}',
  portfolio:
    '{"draft":{"eyebrow":"...","headline":"...","items":[{"title":"...","category":"...","description":"..."}]},"explanation":"..."}',
  gallery:
    '{"draft":{"eyebrow":"...","headline":"...","items":[{"alt":"...","caption":"..."}]},"explanation":"..."}',
  testimonial:
    '{"draft":{"quote":"...","name":"...","role":"..."},"explanation":"..."}',
  faq:
    '{"draft":{"eyebrow":"...","headline":"...","items":[{"question":"...","answer":"..."}]},"explanation":"..."}',
  leadForm:
    '{"draft":{"title":"...","description":"...","fields":["Họ và tên","Email"],"buttonText":"...","successMessage":"..."},"explanation":"..."}',
  finalCta:
    '{"draft":{"finalCtaEyebrow":"...","finalCtaHeadline":"...","primaryCta":"..."},"explanation":"..."}',
};

export function describeSectionDraftSchema(section: LandingSectionType) {
  return sectionDraftSchemas[section];
}

type LandingOperationNormalizationOptions = {
  mode: "create" | "edit";
  source?: "ai" | "ui" | "system";
};

type LandingOperationSchema = {
  required: readonly string[];
  optional?: readonly string[];
  aliases?: Readonly<Record<string, string>>;
};

/**
 * Single structural source of truth for landing operations.
 * Validation, AI normalization and prompt documentation share this registry.
 */
export const landingOperationSchemas = {
  update_text: {
    required: ["type", "section", "field", "value"],
    optional: ["index", "nestedIndex"],
    aliases: {
      targetSection: "section",
      targetField: "field",
      text: "value",
      content: "value",
      nested_index: "nestedIndex",
    },
  },
  replace_section: {
    required: ["type", "section", "value"],
    aliases: { targetSection: "section", data: "value" },
  },
  set_palette: {
    required: ["type", "token", "value"],
    aliases: { color: "value" },
  },
  hide_section: {
    required: ["type", "section"],
    aliases: { targetSection: "section" },
  },
  show_section: {
    required: ["type", "section"],
    aliases: { targetSection: "section" },
  },
  move_section: {
    required: ["type", "section", "toIndex"],
    aliases: {
      targetSection: "section",
      index: "toIndex",
      to_index: "toIndex",
    },
  },
  add_section: {
    required: ["type", "section"],
    optional: ["atIndex"],
    aliases: {
      targetSection: "section",
      index: "atIndex",
      at_index: "atIndex",
    },
  },
  assign_image: {
    required: ["type", "target", "url"],
    optional: ["alt"],
    aliases: { imageUrl: "url", altText: "alt" },
  },
  replace_landing: {
    required: ["type", "value"],
    aliases: { landing: "value", data: "value" },
  },
} as const satisfies Record<string, LandingOperationSchema>;

const operationSchemaEntries = Object.entries(
  landingOperationSchemas
) as Array<[string, LandingOperationSchema]>;

export const landingOperationKeys: Record<string, readonly string[]> =
  Object.fromEntries(
    operationSchemaEntries.map(([type, schema]) => [
      type,
      [...schema.required, ...(schema.optional ?? [])],
    ])
  );

const knownProtocolKeys = new Set(
  operationSchemaEntries.flatMap(([, schema]) => [
    ...schema.required,
    ...(schema.optional ?? []),
    ...Object.keys(schema.aliases ?? {}),
  ])
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasValue(value: Record<string, unknown>, key: string) {
  return key in value && value[key] !== undefined;
}

function sameJsonValue(left: unknown, right: unknown) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function normalizeOperation(operation: unknown): unknown {
  if (!isRecord(operation) || typeof operation.type !== "string") {
    return operation;
  }

  const schema = landingOperationSchemas[
    operation.type as keyof typeof landingOperationSchemas
  ] as LandingOperationSchema | undefined;
  if (!schema) return operation;

  const normalized = { ...operation };
  const conflictingAliases = new Set<string>();
  let changed = false;

  Object.entries(schema.aliases ?? {}).forEach(([alias, canonical]) => {
    if (!hasValue(normalized, alias)) return;
    if (!hasValue(normalized, canonical)) {
      normalized[canonical] = normalized[alias];
      delete normalized[alias];
      changed = true;
      return;
    }
    if (sameJsonValue(normalized[alias], normalized[canonical])) {
      delete normalized[alias];
      changed = true;
      return;
    }
    // Preserve conflicting aliases so strict validation reports ambiguity.
    conflictingAliases.add(alias);
  });

  const hasAllRequiredFields = schema.required.every((key) =>
    hasValue(normalized, key)
  );
  if (hasAllRequiredFields) {
    const allowedKeys = new Set([
      ...schema.required,
      ...(schema.optional ?? []),
    ]);
    Object.keys(normalized).forEach((key) => {
      if (
        !allowedKeys.has(key) &&
        knownProtocolKeys.has(key) &&
        !conflictingAliases.has(key)
      ) {
        delete normalized[key];
        changed = true;
      }
    });
  }

  return changed ? normalized : operation;
}

export function describeLandingOperationSchemas() {
  return operationSchemaEntries
    .map(([type, schema]) => {
      const required = schema.required.filter((key) => key !== "type");
      const optional = schema.optional ?? [];
      return `${type}: bắt buộc [${required.join(", ")}], tùy chọn [${optional.join(", ")}]`;
    })
    .join("; ");
}

export function normalizeLandingOperationInput(
  value: unknown,
  options: LandingOperationNormalizationOptions
): unknown {
  if (
    options.source !== "ai" ||
    !isRecord(value) ||
    !Array.isArray(value.operations)
  ) {
    return value;
  }

  let changed = false;
  const operations = value.operations.map((operation) => {
    const normalized = normalizeOperation(operation);
    if (normalized !== operation) changed = true;
    return normalized;
  });

  return changed ? { ...value, operations } : value;
}

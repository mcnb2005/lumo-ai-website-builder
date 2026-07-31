import type { LandingSectionType } from "../landing-data";
import {
  applyLandingOperations,
  operationForTextEdit,
} from "../landing-operations";
import type { LandingData } from "../landing-data";
import type { LandingEditableField } from "../landing-manifest";

export type LandingTextField = LandingEditableField;

export type LandingTextEdit = {
  section?: LandingSectionType;
  field: LandingTextField;
  value: string;
  index?: number;
  nestedIndex?: number;
};

function inferSection(field: LandingTextField): LandingSectionType {
  if (
    field === "brand" ||
    field === "navCta" ||
    field === "eyebrow" ||
    field === "headline" ||
    field === "accentLine" ||
    field === "description" ||
    field === "primaryCta" ||
    field === "secondaryCta" ||
    field === "proof"
  ) {
    return "hero";
  }
  return field.split(".")[0] as LandingSectionType;
}

export function applyLandingTextEdit(
  current: LandingData,
  edit: LandingTextEdit
): LandingData {
  return applyLandingOperations(current, [
    operationForTextEdit({
      section: edit.section || inferSection(edit.field),
      field: edit.field,
      value: edit.value,
      index: edit.index,
      nestedIndex: edit.nestedIndex,
    }),
  ]).landing;
}

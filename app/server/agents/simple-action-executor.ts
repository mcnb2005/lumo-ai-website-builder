import type { LandingOperation } from "../../landing-operations";
import type { BuilderPlan } from "./builder-plan";

export function buildSimpleActionOperations(
  plan: BuilderPlan
): LandingOperation[] | null {
  switch (plan.action) {
    case "update_text":
      if (
        !plan.target.section ||
        !plan.target.field ||
        plan.value === undefined
      ) {
        return null;
      }
      return [
        {
          type: "update_text",
          section: plan.target.section,
          field: plan.target.field,
          value: plan.value,
          index: plan.target.index,
          nestedIndex: plan.target.nestedIndex,
        },
      ];
    case "hide_section":
      if (
        !plan.target.section ||
        plan.target.section === "finalCta"
      ) {
        return null;
      }
      return [
        {
          type: "hide_section",
          section: plan.target.section,
        },
      ];
    case "show_section":
      return plan.target.section
        ? [{ type: "show_section", section: plan.target.section }]
        : null;
    case "move_section":
      return plan.target.section && plan.toIndex !== undefined
        ? [
            {
              type: "move_section",
              section: plan.target.section,
              toIndex: plan.toIndex,
            },
          ]
        : null;
    case "add_section":
      return plan.target.section
        ? [{ type: "add_section", section: plan.target.section }]
        : null;
    case "assign_image":
      return plan.target.imageTarget && plan.value
        ? [
            {
              type: "assign_image",
              target: plan.target.imageTarget,
              url: plan.value,
            },
          ]
        : null;
    case "set_palette":
      return plan.target.paletteToken && plan.value
        ? [
            {
              type: "set_palette",
              token: plan.target.paletteToken,
              value: plan.value,
            },
          ]
        : null;
    default:
      return null;
  }
}

export function describeSimpleAction(plan: BuilderPlan) {
  switch (plan.action) {
    case "hide_section":
      return "Mình đã ẩn section theo yêu cầu.";
    case "show_section":
      return "Mình đã hiển thị lại section theo yêu cầu.";
    case "move_section":
      return "Mình đã di chuyển section đến đúng vị trí.";
    case "assign_image":
      return "Mình đã đặt ảnh vào đúng vị trí đã chọn.";
    case "update_text":
      return "Mình đã sửa đúng nội dung được chỉ định.";
    case "set_palette":
      return "Mình đã cập nhật màu theo yêu cầu.";
    case "add_section":
      return "Mình đã thêm section vào landing page.";
    default:
      return "Mình đã áp dụng thay đổi.";
  }
}

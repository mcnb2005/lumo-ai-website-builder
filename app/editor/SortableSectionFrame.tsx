"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import type { LandingSectionType } from "../landing-data";
import { sectionRegistry } from "./section-registry";

type SortableSectionFrameProps = {
  id: LandingSectionType;
  selected: boolean;
  disabled?: boolean;
  onSelect: (section: LandingSectionType) => void;
  children: ReactNode;
};

export function SortableSectionFrame({
  id,
  selected,
  disabled = false,
  onSelect,
  children,
}: SortableSectionFrameProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const label = sectionRegistry[id].label;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      data-section-id={id}
      className={`sortable-section-frame${
        selected ? " is-selected" : ""
      }${isDragging ? " is-dragging" : ""}`}
      onClick={() => onSelect(id)}
      role="group"
      aria-label={`Khối ${label}`}
    >
      <div className="sortable-section-frame__toolbar">
        <button
          type="button"
          className="sortable-section-frame__handle"
          aria-label={`Kéo ${label}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LandingSectionType } from "../landing-data";
import { sectionRegistry } from "./section-registry";

type SectionNavigatorProps = {
  sectionOrder: LandingSectionType[];
  selectedSection: LandingSectionType | null;
  onSelect: (section: LandingSectionType) => void;
  onReorder: (
    activeSection: LandingSectionType,
    overSection: LandingSectionType
  ) => void;
  onToggleVisibility: (section: LandingSectionType) => void;
  onAddSection: () => void;
  hiddenSections: LandingSectionType[];
  isBusy?: boolean;
};

type SortableNavigatorItemProps = {
  section: LandingSectionType;
  selected: boolean;
  hidden: boolean;
  disabled: boolean;
  onSelect: (section: LandingSectionType) => void;
  onToggleVisibility: (section: LandingSectionType) => void;
};

function SortableNavigatorItem({
  section,
  selected,
  hidden,
  disabled,
  onSelect,
  onToggleVisibility,
}: SortableNavigatorItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section, disabled });
  const label = sectionRegistry[section].label;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`${selected ? "is-selected" : ""}${
        hidden ? " is-hidden" : ""
      }${isDragging ? " is-dragging" : ""}`}
    >
      <button
        type="button"
        className="section-navigator__drag"
        aria-label={`Kéo ${label}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button
        type="button"
        className="section-navigator__label"
        onClick={() => onSelect(section)}
      >
        <span>{label}</span>
        {hidden ? <small>Đang ẩn</small> : null}
      </button>
      <button
        type="button"
        className="section-navigator__toggle"
        onClick={() => onToggleVisibility(section)}
        aria-label={`${hidden ? "Hiện" : "Ẩn"} ${label}`}
        aria-pressed={!hidden}
        disabled={disabled || section === "finalCta"}
      >
        {hidden ? "Hiện" : "Ẩn"}
      </button>
    </li>
  );
}

export function SectionNavigator({
  sectionOrder,
  selectedSection,
  onSelect,
  onReorder,
  onToggleVisibility,
  onAddSection,
  hiddenSections,
  isBusy = false,
}: SectionNavigatorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(
      active.id as LandingSectionType,
      over.id as LandingSectionType
    );
  }

  return (
    <aside
      className="section-navigator"
      aria-label="Danh sách các khối trên trang"
    >
      <div className="section-navigator__header">
        <div>
          <small>TRÌNH BỐ CỤC</small>
          <strong>Các khối trên trang</strong>
        </div>
        <button type="button" onClick={onAddSection} disabled={isBusy}>
          + Thêm
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sectionOrder}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {sectionOrder.map((section) => (
              <SortableNavigatorItem
                key={section}
                section={section}
                selected={selectedSection === section}
                hidden={hiddenSections.includes(section)}
                disabled={isBusy}
                onSelect={onSelect}
                onToggleVisibility={onToggleVisibility}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <p className="section-navigator__hint">
        Kéo bằng tay nắm hoặc dùng phím cách và phím mũi tên.
      </p>
    </aside>
  );
}

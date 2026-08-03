"use client";

import { useEffect, useRef, useState } from "react";

type InlineEditableTextProps = {
  value: string;
  label: string;
  onCommit?: (value: string) => void;
  onActivate?: () => void;
  multiline?: boolean;
  className?: string;
};

function normalizeEditableText(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
}

export function InlineEditableText({
  value,
  label,
  onCommit,
  onActivate,
  multiline = false,
  className = "",
}: InlineEditableTextProps) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || document.activeElement === element) return;
    element.innerText = value;
  }, [value]);

  function restoreValue() {
    if (elementRef.current) {
      elementRef.current.innerText = value;
    }
  }

  function commitValue() {
    const nextValue = normalizeEditableText(elementRef.current?.innerText || "");
    setIsEditing(false);
    if (nextValue === value) {
      restoreValue();
      return;
    }
    onCommit?.(nextValue);
  }

  if (!onCommit) {
    return (
      <span className={className}>
        {value}
      </span>
    );
  }

  return (
    <span
      ref={elementRef}
      className={`inline-editable-text${multiline ? " is-multiline" : ""}${
        isEditing ? " is-editing" : ""
      }${className ? ` ${className}` : ""}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline={multiline}
      data-edit-label={label}
      data-empty={!value || undefined}
      spellCheck
      tabIndex={0}
      onFocus={(event) => {
        setIsEditing(true);
        onActivate?.();
        event.currentTarget.dataset.empty = "";
      }}
      onBlur={commitValue}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          restoreValue();
          event.currentTarget.blur();
          return;
        }
        if (event.key === "Enter" && (!multiline || !event.shiftKey)) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
    >
      {value}
    </span>
  );
}

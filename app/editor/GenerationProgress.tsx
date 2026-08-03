"use client";

import type { GenerationStage } from "../builder-generation";

const visibleStages = [
  "understanding",
  "planning",
  "generating",
  "validating",
  "applying",
] as const;

const stageLabels: Record<(typeof visibleStages)[number], string> = {
  understanding: "Hiểu yêu cầu",
  planning: "Xác định phần cần sửa",
  generating: "Tạo thay đổi",
  validating: "Kiểm tra dữ liệu",
  applying: "Áp dụng vào trang",
};

export function GenerationProgress({
  stage,
  message,
  validationErrors = [],
}: {
  stage: GenerationStage;
  message: string;
  validationErrors?: string[];
}) {
  const currentIndex = visibleStages.indexOf(
    stage as (typeof visibleStages)[number]
  );
  const completed = stage === "completed";
  const failed = stage === "failed";

  return (
    <div
      className={`generation-progress is-${stage}`}
      role="status"
      aria-live="polite"
    >
      <div className="generation-progress__heading">
        <span aria-hidden="true">{failed ? "!" : completed ? "✓" : "✦"}</span>
        <div>
          <strong>
            {failed
              ? "Chưa thể áp dụng thay đổi"
              : completed
                ? "Đã hoàn thành"
                : "Lumo đang thiết kế"}
          </strong>
          <p>{message}</p>
        </div>
      </div>
      <ol>
        {visibleStages.map((item, index) => {
          const isDone = completed || (!failed && currentIndex > index);
          const isCurrent = !completed && !failed && currentIndex === index;
          return (
            <li
              className={
                isDone ? "is-done" : isCurrent ? "is-current" : "is-pending"
              }
              key={item}
            >
              <span aria-hidden="true">
                {isDone ? "✓" : isCurrent ? "●" : "○"}
              </span>
              {stageLabels[item]}
            </li>
          );
        })}
      </ol>
      {validationErrors.length ? (
        <details>
          <summary>Chi tiết cần sửa ({validationErrors.length})</summary>
          <ul>
            {validationErrors.slice(0, 4).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

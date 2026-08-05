import type { PipelineResumeState } from "../../builder-generation";

export class PipelineStageError extends Error {
  pipelineStage: string;
  resume?: PipelineResumeState;

  constructor(
    pipelineStage: string,
    cause: unknown,
    resume?: PipelineResumeState
  ) {
    const detail =
      cause instanceof Error ? cause.message : "Lỗi không xác định trong pipeline.";
    super(`Không thể hoàn tất bước ${pipelineStage}: ${detail}`);
    this.name = "PipelineStageError";
    this.pipelineStage = pipelineStage;
    this.resume = resume;
    if (cause instanceof Error) this.cause = cause;
  }
}

export function getPipelineErrorDetails(error: unknown) {
  if (!(error instanceof PipelineStageError)) return null;
  return {
    pipelineStage: error.pipelineStage,
    resume: error.resume,
  };
}

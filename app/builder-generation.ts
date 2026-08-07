import type { LandingData, LandingSectionType } from "./landing-data";
import type { LandingManifest } from "./landing-manifest";
import type { LandingOperation } from "./landing-operations";
import type { LandingProject } from "./landing-project";
import type { BuilderPlan } from "./server/agents/builder-plan";
import type { LandingQualityReport } from "./server/agents/quality-evaluator";

export const generationStages = [
  "understanding",
  "planning",
  "generating",
  "validating",
  "applying",
  "completed",
  "failed",
] as const;

export type GenerationStage = (typeof generationStages)[number];

export type BuilderIntent = BuilderPlan;

export type BuilderAgentResult = {
  landing: LandingData;
  message: string;
  mode: "ai" | "demo";
  operations: LandingOperation[];
  changedSections: LandingSectionType[];
  intent: BuilderIntent;
  manifest: LandingManifest;
  skill: {
    id: string;
    version: string;
  };
  runtimeSkill?: {
    id: string;
    version: string;
    name: string;
    description: string;
  };
  project?: LandingProject;
  qualityReport?: LandingQualityReport;
};

export type PipelineResumeState = {
  prompt: string;
  landing: LandingData;
  completedSections: LandingSectionType[];
};

export type BuilderStreamEvent =
  | {
      type: "status";
      stage: Exclude<GenerationStage, "failed">;
      message: string;
    }
  | {
      type: "validation";
      stage: "validating";
      valid: boolean;
      errors?: string[];
      attempt: number;
    }
  | {
      type: "checkpoint";
      stage: "generating";
      section: LandingSectionType;
      message: string;
      landing: LandingData;
      completedSections: LandingSectionType[];
      resume: PipelineResumeState;
    }
  | {
      type: "complete";
      stage: "completed";
      result: BuilderAgentResult;
    }
  | {
      type: "error";
      stage: "failed";
      message: string;
      pipelineStage?: string;
      resume?: PipelineResumeState;
    };

export type BuilderProgressReporter = (
  event: Exclude<BuilderStreamEvent, { type: "complete" | "error" }>
) => void;

import type { LandingData, LandingSectionType } from "./landing-data";
import type { LandingManifest } from "./landing-manifest";
import type { LandingOperation } from "./landing-operations";
import type { BuilderPlan } from "./server/agents/builder-plan";

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
      type: "complete";
      stage: "completed";
      result: BuilderAgentResult;
    }
  | {
      type: "error";
      stage: "failed";
      message: string;
    };

export type BuilderProgressReporter = (
  event: Exclude<BuilderStreamEvent, { type: "complete" | "error" }>
) => void;

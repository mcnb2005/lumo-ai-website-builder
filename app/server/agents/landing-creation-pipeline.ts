import type {
  BuilderProgressReporter,
  PipelineResumeState,
} from "../../builder-generation";
import {
  normalizeLandingData,
  type LandingData,
  type LandingSectionType,
} from "../../landing-data";
import {
  compileLandingProject,
  landingProjectFromLanding,
  type LandingProject,
} from "../../landing-project";
import {
  applyLandingOperations,
  type LandingOperation,
} from "../../landing-operations";
import { preserveInternalAssetUrls } from "../skills/landing-builder-skill";
import type { BuilderPlan } from "./builder-plan";
import {
  applyBlueprintToLanding,
  createBusinessBrief,
  createLandingBlueprint,
} from "./creation-blueprint";
import {
  evaluateLandingQuality,
  type LandingQualityReport,
} from "./quality-evaluator";
import { runSectionContentAgent } from "./section-content-agent";
import { PipelineStageError } from "./pipeline-stage-error";
import type { AiChatProvider } from "../tools/ai-chat-tool";

type LandingCreationPipelineResult = {
  landing: LandingData;
  project: LandingProject;
  qualityReport: LandingQualityReport;
  operations: LandingOperation[];
  changedSections: LandingSectionType[];
  warnings: string[];
};

function preserveAssets(current: LandingData, next: LandingData) {
  return normalizeLandingData({
    ...preserveInternalAssetUrls(current, next),
    heroImage: current.heroImage,
    heroImageFit: current.heroImageFit,
    heroImagePosition: current.heroImagePosition,
    portfolio: next.portfolio.map((item, index) => ({
      ...item,
      imageUrl: current.portfolio[index]?.imageUrl || "",
      imageFit: current.portfolio[index]?.imageFit,
      imagePosition: current.portfolio[index]?.imagePosition,
    })),
    gallery: next.gallery.map((item, index) => ({
      ...item,
      url: current.gallery[index]?.url || "",
      imageFit: current.gallery[index]?.imageFit,
      imagePosition: current.gallery[index]?.imagePosition,
    })),
  });
}

export async function runLandingCreationPipeline(input: {
  prompt: string;
  plan: BuilderPlan;
  baseLanding: LandingData;
  providerUrl: string;
  modelName: string;
  apiKey: string;
  fallbackProviders?: AiChatProvider[];
  resume?: PipelineResumeState;
  progress?: BuilderProgressReporter;
}): Promise<LandingCreationPipelineResult> {
  const brief = createBusinessBrief(input.plan, input.prompt);
  const blueprint = createLandingBlueprint({
    plan: input.plan,
    brief,
  });
  const canResume =
    input.resume?.prompt.trim() === input.prompt.trim() &&
    Array.isArray(input.resume.completedSections);
  let landing = canResume
    ? normalizeLandingData(input.resume?.landing)
    : normalizeLandingData(
        applyBlueprintToLanding(input.baseLanding, blueprint)
      );

  if (!canResume && (input.plan.typography || input.plan.radius || input.plan.density) && landing.design) {
    landing.design = {
      ...landing.design,
      typography: input.plan.typography ? {
        ...landing.design.typography,
        ...input.plan.typography,
      } : landing.design.typography,
      ...(input.plan.radius ? { radius: input.plan.radius } : {}),
      ...(input.plan.density ? { density: input.plan.density } : {}),
    };
  }
  const operations: LandingOperation[] = [];
  const changedSections = new Set<LandingSectionType>();
  const warnings: string[] = [];
  const completedSections = new Set<LandingSectionType>(
    canResume
      ? input.resume!.completedSections.filter((section) =>
          blueprint.sections.some((item) => item.type === section)
        )
      : []
  );

  const createResumeState = (): PipelineResumeState => ({
    prompt: input.prompt,
    landing,
    completedSections: Array.from(completedSections),
  });

  input.progress?.({
    type: "status",
    stage: "planning",
    message: `Đã lập blueprint động gồm ${blueprint.sections.length} section.`,
  });

  for (let index = 0; index < blueprint.sections.length; index += 1) {
    const section = blueprint.sections[index];
    if (completedSections.has(section.type)) continue;
    const pipelineStage = `generateSection("${section.type}")`;
    input.progress?.({
      type: "status",
      stage: "generating",
      message: `Đang chạy ${pipelineStage} (${index + 1}/${blueprint.sections.length})…`,
    });
    try {
      const sectionOperations = await runSectionContentAgent({
        landing,
        section,
        brief,
        providerUrl: input.providerUrl,
        modelName: input.modelName,
        apiKey: input.apiKey,
        fallbackProviders: input.fallbackProviders,
      });
      const applied = applyLandingOperations(landing, sectionOperations);
      landing = preserveAssets(landing, applied.landing);
      sectionOperations.forEach((operation) => operations.push(operation));
      applied.changedSections.forEach((changed) => changedSections.add(changed));
      completedSections.add(section.type);
      await input.progress?.({
        type: "checkpoint",
        stage: "generating",
        section: section.type,
        message: `Đã lưu checkpoint sau ${pipelineStage}.`,
        landing,
        completedSections: Array.from(completedSections),
        resume: createResumeState(),
      });
    } catch (error) {
      throw new PipelineStageError(
        pipelineStage,
        error,
        createResumeState()
      );
    }
  }

  let qualityReport = evaluateLandingQuality(landing, brief, blueprint);
  input.progress?.({
    type: "validation",
    stage: "validating",
    valid: qualityReport.passed,
    errors: qualityReport.issues.map((issue) => issue.message),
    attempt: 1,
  });

  for (let repairAttempt = 1; repairAttempt <= 2 && !qualityReport.passed; repairAttempt += 1) {
    const sectionsToRepair = Array.from(
      new Set(
        qualityReport.issues
          .map((issue) => issue.section)
          .filter((section): section is LandingSectionType => Boolean(section))
      )
    ).slice(0, 3);
    if (!sectionsToRepair.length) break;

    input.progress?.({
      type: "status",
      stage: "generating",
      message: `Đang tự cải thiện chất lượng lần ${repairAttempt}/2…`,
    });
    for (const sectionType of sectionsToRepair) {
      const section = blueprint.sections.find((item) => item.type === sectionType);
      if (!section) continue;
      const repairIssues = qualityReport.issues
        .filter((issue) => issue.section === sectionType)
        .map((issue) => issue.message);
      try {
        const sectionOperations = await runSectionContentAgent({
          landing,
          section,
          brief,
          providerUrl: input.providerUrl,
          modelName: input.modelName,
          apiKey: input.apiKey,
          fallbackProviders: input.fallbackProviders,
          repairIssues,
        });
        const applied = applyLandingOperations(landing, sectionOperations);
        landing = preserveAssets(landing, applied.landing);
        sectionOperations.forEach((operation) => operations.push(operation));
        applied.changedSections.forEach((changed) => changedSections.add(changed));
        await input.progress?.({
          type: "checkpoint",
          stage: "generating",
          section: sectionType,
          message: `Đã lưu checkpoint sau repairSection("${sectionType}").`,
          landing,
          completedSections: Array.from(completedSections),
          resume: createResumeState(),
        });
      } catch (error) {
        throw new PipelineStageError(
          `repairSection("${sectionType}")`,
          error,
          createResumeState()
        );
      }
    }
    qualityReport = evaluateLandingQuality(landing, brief, blueprint);
    input.progress?.({
      type: "validation",
      stage: "validating",
      valid: qualityReport.passed,
      errors: qualityReport.issues.map((issue) => issue.message),
      attempt: repairAttempt + 1,
    });
  }

  const project = landingProjectFromLanding(landing, brief, blueprint);
  landing = compileLandingProject(project);
  input.progress?.({
    type: "status",
    stage: "applying",
    message: `Đang áp dụng landing page đã kiểm tra (${qualityReport.overall}/100)…`,
  });

  return {
    landing,
    project,
    qualityReport,
    operations,
    changedSections: Array.from(changedSections),
    warnings,
  };
}

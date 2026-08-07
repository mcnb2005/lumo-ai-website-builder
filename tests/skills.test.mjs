import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exposes runtime skills and the validated operation pipeline", async () => {
  const [
    skills,
    agent,
    landingSkill,
    aiTool,
    studio,
    operations,
    generation,
    aiRoute,
    planner,
    builderPlan,
    recipes,
    creationPipeline,
    blueprint,
    sectionContent,
    qualityEvaluator,
    landingProject,
    pipelineStageError,
    designSkillDoc,
    componentCatalog,
  ] = await Promise.all([
    readFile(new URL("../app/server/skills/runtime-skills.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/server/agents/website-builder-agent.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/server/skills/landing-builder-skill.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/tools/ai-chat-tool.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/Studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/landing-operations.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/builder-generation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/server/agents/planning-agent.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/builder-plan.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/landing-recipes.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/landing-creation-pipeline.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/creation-blueprint.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/section-content-agent.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../app/server/agents/quality-evaluator.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../app/landing-project.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/server/agents/pipeline-stage-error.ts", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL("../.agents/skills/landing-ui-design/SKILL.md", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../.agents/skills/landing-ui-design/references/component-catalog.md",
        import.meta.url
      ),
      "utf8"
    ),
  ]);

  assert.match(skills, /export const runtimeSkills/);
  assert.match(skills, /landingUiDesignSkill/);
  assert.match(skills, /không sinh HTML, CSS, JSX hoặc React tự do/);
  assert.match(skills, /"edit-landing"/);
  assert.match(skills, /"design-form"/);
  assert.match(skills, /"publish-check"/);
  assert.match(agent, /resolveRuntimeSkill/);
  assert.match(agent, /parseLandingOperations/);
  assert.match(agent, /buildLandingManifest/);
  assert.match(agent, /runPlanningAgent/);
  assert.match(agent, /runLandingCreationPipeline/);
  assert.match(agent, /intent\.mode === "create"[\s\S]*landingUiDesignSkill/);
  assert.match(agent, /attempt <= 2/);
  assert.match(agent, /validationErrors/);
  assert.match(agent, /applyLandingOperations/);
  assert.match(agent, /runtimeSkill\.rules/);
  assert.match(agent, /resolveBuilderPlanTarget/);
  assert.match(agent, /buildSimpleActionOperations/);
  assert.match(agent, /preserveInternalAssetUrls/);
  assert.match(agent, /intent\.targetField/);
  assert.match(planner, /parseBuilderPlan/);
  assert.match(planner, /confidence dưới 0\.6/);
  assert.match(planner, /landingUiDesignSkill\.rules/);
  assert.doesNotMatch(planner, /isCreateRequest|isCreationCorrection/);
  assert.match(builderPlan, /mode: "create" \| "edit" \| "clarify"/);
  assert.match(builderPlan, /action: BuilderAction/);
  assert.match(builderPlan, /target: BuilderTarget/);
  assert.match(builderPlan, /lowConfidence/);
  assert.match(recipes, /sell_product/);
  assert.match(recipes, /primaryGoal/);
  assert.match(recipes, /\.\.\.base\.visibleSections/);
  assert.match(recipes, /\.slice\(0, 2\)/);
  assert.match(blueprint, /createBusinessBrief/);
  assert.match(blueprint, /createLandingBlueprint/);
  assert.match(blueprint, /resolveLandingRecipe/);
  assert.match(blueprint, /input\.templateLanding\.sectionOrder\.filter/);
  assert.match(blueprint, /section === "hero" && !input\.templateLanding\.heroImage/);
  assert.match(creationPipeline, /runSectionContentAgent/);
  assert.match(creationPipeline, /evaluateLandingQuality/);
  assert.match(creationPipeline, /repairAttempt <= 2/);
  assert.match(creationPipeline, /landingProjectFromLanding/);
  assert.match(creationPipeline, /compileLandingProject/);
  assert.match(creationPipeline, /type: "checkpoint"/);
  assert.match(creationPipeline, /completedSections/);
  assert.match(creationPipeline, /generateSection\(\"\$\{section\.type\}\"\)/);
  assert.match(creationPipeline, /PipelineStageError/);
  assert.match(sectionContent, /Content Generator chỉ phụ trách section/);
  assert.match(sectionContent, /parseSectionDraftEnvelope/);
  assert.match(sectionContent, /compileSectionDraftToOperations/);
  assert.match(sectionContent, /applyLandingOperations/);
  assert.doesNotMatch(sectionContent, /parseLandingOperations/);
  assert.match(sectionContent, /attempt <= 2/);
  assert.match(qualityEvaluator, /businessRelevance/);
  assert.match(qualityEvaluator, /contentCompleteness/);
  assert.match(qualityEvaluator, /conversionClarity/);
  assert.match(qualityEvaluator, /visualSafety/);
  assert.match(qualityEvaluator, /overall >= 80/);
  assert.match(landingProject, /type LandingProject/);
  assert.match(landingProject, /brief: BusinessBrief/);
  assert.match(landingProject, /blueprint: LandingBlueprint/);
  assert.match(landingProject, /content: LandingContent/);
  assert.match(landingProject, /design: LandingProjectDesign/);
  assert.match(landingProject, /assets: LandingAssetLibrary/);
  assert.match(landingSkill, /recognizedKeys/);
  assert.match(landingSkill, /parseLandingOperations/);
  assert.match(landingSkill, /operations/);
  assert.match(landingSkill, /aliases: \["giải pháp", "lợi ích", "tính năng"/);
  assert.match(landingSkill, /section: "pricing"/);
  assert.match(landingSkill, /section: "portfolio"/);
  assert.match(
    landingSkill,
    /typeof url === "string" && url\.startsWith\(internalPrefix\)/
  );
  assert.match(landingSkill, /typeof image\?\.url === "string"/);
  assert.match(aiTool, /if \(payload\.error\)/);
  assert.match(aiTool, /429, 500, 502, 503, 504/);
  assert.match(aiTool, /AbortController/);
  assert.match(aiTool, /timeoutMs \?\? 60_000/);
  assert.match(aiTool, /fallbackProviders/);
  assert.match(aiTool, /response_format/);
  assert.match(aiTool, /jsonMode/);
  assert.match(aiTool, /candidate\.apiKey === provider\.apiKey/);
  assert.match(aiTool, /providerEndpoint/);
  assert.match(aiTool, /parseRetryAfter/);
  assert.match(aiTool, /Đã thử \$\{failures\.length\} cấu hình AI/);
  assert.match(pipelineStageError, /class PipelineStageError/);
  assert.match(studio, /setNotice\(errorMessage\)/);
  assert.match(studio, /pipelineResumeRef/);
  assert.match(studio, /event\.type === "checkpoint"/);
  assert.match(studio, /readBuilderResponse/);
  assert.match(studio, /GenerationProgress/);
  assert.match(operations, /export type LandingOperation/);
  assert.match(operations, /parseLandingOperationEnvelope/);
  assert.match(operations, /validateLandingData/);
  assert.match(operations, /applyLandingOperations/);
  assert.match(generation, /"understanding"/);
  assert.match(generation, /"validating"/);
  assert.match(generation, /"applying"/);
  assert.match(aiRoute, /text\/event-stream/);
  assert.match(aiRoute, /data: \$\{JSON\.stringify\(event\)\}/);
  assert.match(designSkillDoc, /controlled data and registered variants/);
  assert.match(designSkillDoc, /Do not ask the model to emit free-form HTML/);
  assert.match(componentCatalog, /`product-showcase`/);
  assert.match(componentCatalog, /`two-columns`/);
});

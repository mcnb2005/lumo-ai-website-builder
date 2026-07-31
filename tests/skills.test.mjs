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
  ]);

  assert.match(skills, /export const runtimeSkills/);
  assert.match(skills, /"edit-landing"/);
  assert.match(skills, /"design-form"/);
  assert.match(skills, /"publish-check"/);
  assert.match(agent, /resolveRuntimeSkill/);
  assert.match(agent, /parseLandingOperations/);
  assert.match(agent, /buildLandingManifest/);
  assert.match(agent, /runPlanningAgent/);
  assert.match(agent, /resolveLandingRecipe/);
  assert.match(agent, /validateCreationQuality/);
  assert.match(agent, /attempt <= 2/);
  assert.match(agent, /validationErrors/);
  assert.match(agent, /applyLandingOperations/);
  assert.match(agent, /runtimeSkill\.rules/);
  assert.match(agent, /applySectionVisibilityIntent/);
  assert.match(agent, /preserveInternalAssetUrls/);
  assert.match(agent, /intent\.targetField/);
  assert.match(planner, /parseBuilderPlan/);
  assert.match(planner, /confidence dưới 0\.6/);
  assert.doesNotMatch(planner, /isCreateRequest|isCreationCorrection/);
  assert.match(builderPlan, /mode: "create" \| "edit" \| "clarify"/);
  assert.match(builderPlan, /lowConfidence/);
  assert.match(recipes, /sell_product/);
  assert.match(recipes, /primaryGoal/);
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
  assert.match(studio, /setNotice\(errorMessage\)/);
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
});

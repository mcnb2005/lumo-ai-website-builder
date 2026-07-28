import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("exposes runtime skills for the website builder agent", async () => {
  const [skills, agent] = await Promise.all([
    readFile(new URL("../app/server/skills/runtime-skills.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/server/agents/website-builder-agent.ts", import.meta.url), "utf8"),
  ]);

  assert.match(skills, /export const runtimeSkills/);
  assert.match(skills, /"edit-landing"/);
  assert.match(skills, /"design-form"/);
  assert.match(skills, /"publish-check"/);
  assert.match(agent, /resolveRuntimeSkill/);
});

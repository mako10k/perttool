import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as perttool from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("Grammar 6 and CLI Contract 7 activate plan assurance atomically", async () => {
  const source = await readFile(
    path.join(root, "docs", "examples", "minimal.pert"),
    "utf8",
  );
  assert.equal(perttool.COMMAND_REGISTRY.length, 45);
  assert.equal(perttool.getJsonSchemaCatalog().length, 21);
  assert.equal(perttool.getJsonSchema("Perttool.NextResult.v5"), null);
  assert.equal(perttool.getJsonSchema("Perttool.AdvanceResult.v1"), null);
  assert.ok(perttool.getJsonSchema("Perttool.PlanAssuranceResult.v1"));
  assert.equal("evaluatePlanAssurance" in perttool, false);
  assert.equal("hashTaskPlanContract" in perttool, false);

  const sealed = perttool.planAssuranceMutation(source, {
    kind: "plan_assurance.seal",
    reason: "Public Contract 7 acceptance",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  assert.equal(sealed.schemaVersion, "Perttool.MutationResult.v4");
  assert.equal(
    sealed.governance?.schemaVersion,
    "Perttool.GovernanceDecision.v2",
  );
  assert.ok(sealed.updatedText);

  const checked = perttool.checkDocument(sealed.updatedText);
  assert.equal(checked.schemaVersion, "Perttool.CheckResult.v4");
  assert.equal(checked.grammarVersion, 6);
  assert.equal(checked.assurance?.coverage, "complete");
  const work = checked.assurance.taskResults.find(({ taskId }) =>
    taskId === "WORK"
  );
  assert.ok(work);
  assert.equal(work?.status, "verified");

  const next = perttool.selectNextTasks(sealed.updatedText);
  assert.equal(next.schemaVersion, "Perttool.NextResult.v6");
  assert.equal(
    next.temporal.authority.policy,
    "recommendation_v1_plus_release_gate_plus_plan_assurance_v1",
  );
  assert.deepEqual(
    next.temporal.authority.startableRecommendedTaskIds,
    ["WORK"],
  );

  const changed = perttool.planMutation(sealed.updatedText, {
    kind: "task.set",
    id: "WORK",
    set: { title: "Changed after review" },
  });
  assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
  assert.equal(
    changed.assuranceImpact?.after.taskResults[0]?.status,
    "review_required",
  );
  assert.deepEqual(
    perttool.selectNextTasks(changed.updatedText).temporal.authority
      .startableRecommendedTaskIds,
    [],
  );

  const exported = perttool.exportMermaid(sealed.updatedText, {
    analysis: "both",
  });
  assert.equal(exported.ok, true, JSON.stringify(exported.diagnostics));
  assert.match(exported.artifact, /Perttool\.MermaidProfile\.v2/);
  const imported = perttool.importMermaid(exported.artifact);
  assert.equal(imported.ok, true, JSON.stringify(imported.diagnostics));
  assert.equal(imported.analysis, "both");
  assert.match(imported.artifact, /  version 6\n/);
  assert.equal(
    perttool.exportMermaid(imported.artifact, { analysis: "both" }).artifact,
    exported.artifact,
  );

  const temporary = await mkdtemp(path.join(os.tmpdir(), "perttool-assure-public-"));
  try {
    const plan = path.join(temporary, "sealed.pert");
    await writeFile(plan, sealed.updatedText, "utf8");
    const hash = run([
      "plan-assurance",
      "hash",
      plan,
      "WORK",
      "--kind",
      "contract",
    ]);
    assert.equal(hash.status, 0, hash.stderr);
    assert.equal(hash.stdout, `${work.contractHash}\n`);
    assert.match(hash.stderr, /^PTSEM-114 warning: duration_unit day is deprecated;/);

    const show = run([
      "plan-assurance",
      "show",
      plan,
      "--format=json",
    ]);
    assert.equal(show.status, 0, show.stderr);
    const shown = JSON.parse(show.stdout);
    assert.equal(shown.schema_version, "Perttool.PlanAssuranceResult.v1");
    assert.equal(shown.cli_contract_version, 7);
    assert.equal(shown.assurance.coverage, "complete");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function digest(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

test("Contract 9 retains the Grammar 6 plan-assurance surface", async () => {
  const source = await readFile(
    path.join(root, "docs", "examples", "minimal.pert"),
    "utf8",
  );
  assert.equal(perttool.COMMAND_REGISTRY.length, 56);
  assert.equal(perttool.getJsonSchemaCatalog().length, 23);
  assert.equal(perttool.getJsonSchema("Perttool.NextResult.v5"), null);
  assert.equal(perttool.getJsonSchema("Perttool.AdvanceResult.v1"), null);
  assert.ok(perttool.getJsonSchema("Perttool.PlanAssuranceResult.v2"));
  assert.equal("evaluatePlanAssurance" in perttool, false);
  assert.equal("hashTaskPlanContract" in perttool, false);

  const sealed = perttool.planAssuranceMutation(source, {
    kind: "plan_assurance.seal",
    reason: "Public Contract 7 acceptance",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  assert.equal(sealed.schemaVersion, "Perttool.MutationResult.v6");
  assert.equal(
    sealed.governance?.schemaVersion,
    "Perttool.GovernanceDecision.v2",
  );
  assert.ok(sealed.updatedText);

  const checked = perttool.checkDocument(sealed.updatedText);
  assert.equal(checked.schemaVersion, "Perttool.CheckResult.v6");
  assert.equal(checked.grammarVersion, 6);
  assert.equal(checked.assurance?.coverage, "complete");
  const work = checked.assurance.taskResults.find(({ taskId }) =>
    taskId === "WORK"
  );
  assert.ok(work);
  assert.equal(work?.status, "verified");

  const next = perttool.selectNextTasks(sealed.updatedText);
  assert.equal(next.schemaVersion, "Perttool.NextResult.v8");
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
    assert.equal(shown.schema_version, "Perttool.PlanAssuranceResult.v2");
    assert.equal(shown.cli_contract_version, 9);
    assert.equal(shown.assurance.coverage, "complete");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Issue 14 inspects valid Grammar 7 plans through file and stdin without mutation", async () => {
  const source = await readFile(
    path.join(root, "docs", "examples", "minimal.pert"),
    "utf8",
  );
  const sealed = perttool.planAssuranceMutation(source, {
    kind: "plan_assurance.seal",
    reason: "Accepted Grammar 7 inspection regression basis",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  const migrated = perttool.planMilestoneAcceptanceMigration(
    sealed.updatedText,
    {
      repositoryId: "issue-14-regression",
      repositoryRelativePath: "grammar7.pert",
      objectFormat: "sha1",
      headCommit: "a".repeat(40),
      headBlob: "b".repeat(40),
      stage0Blob: "b".repeat(40),
      sourceDigest: digest(sealed.updatedText),
    },
  );
  assert.equal(migrated.ok, true, JSON.stringify(migrated.diagnostics));
  const temporary = await mkdtemp(path.join(os.tmpdir(), "perttool-issue-14-"));
  try {
    const plan = path.join(temporary, "grammar7.pert");
    await writeFile(plan, migrated.candidateText, "utf8");
    const before = await readFile(plan, "utf8");

    const nextRun = run(["dag", "next", plan, "--format=json"]);
    assert.equal(nextRun.status, 0, nextRun.stderr);
    const next = JSON.parse(nextRun.stdout);
    const work = next.assurance.task_results.find(({ task_id: id }) =>
      id === "WORK"
    );
    assert.ok(work);

    for (const operand of [
      { args: [plan], options: {} },
      { args: ["-"], options: { input: migrated.candidateText } },
    ]) {
      const shownRun = run([
        "plan-assurance",
        "show",
        ...operand.args,
        "--task",
        "WORK",
        "--format=json",
      ], operand.options);
      assert.equal(shownRun.status, 0, shownRun.stderr);
      const shown = JSON.parse(shownRun.stdout);
      assert.equal(shown.ok, true);
      assert.equal(shown.cli_contract_version, 9);
      assert.equal(shown.grammar_version, 7);
      assert.equal(shown.source_digest, digest(migrated.candidateText));
      assert.deepEqual(shown.selected_task_ids, ["WORK"]);
      assert.deepEqual(shown.assurance.task_results, [work]);

      for (const [kind, property] of [
        ["contract", "contract_hash"],
        ["computed-basis", "computed_basis_hash"],
        ["exported", "exported_assurance_hash"],
      ]) {
        const hashRun = run([
          "plan-assurance",
          "hash",
          ...operand.args,
          "WORK",
          "--kind",
          kind,
          "--format=json",
        ], operand.options);
        assert.equal(hashRun.status, 0, hashRun.stderr);
        const selected = JSON.parse(hashRun.stdout);
        assert.equal(selected.ok, true);
        assert.equal(selected.grammar_version, 7);
        assert.equal(selected.selected_hash, work[property]);
      }
    }

    assert.equal(await readFile(plan, "utf8"), before);

    const invalid = `${migrated.candidateText.trimEnd()}\n\nmilestone_acceptance_receipt BROKEN:\n  model 1\n`;
    const rejected = run([
      "plan-assurance",
      "show",
      "-",
      "--format=json",
    ], { input: invalid });
    assert.equal(rejected.status, 1, rejected.stderr);
    const failure = JSON.parse(rejected.stdout);
    assert.equal(failure.ok, false);
    assert.equal(failure.grammar_version, 7);
    assert.equal(
      failure.diagnostics.some(({ code }) => code.startsWith("PTMAC-")),
      true,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [installedCli, workspace, retainedPlan] = process.argv.slice(2);
if (
  installedCli === undefined ||
  workspace === undefined ||
  retainedPlan === undefined
) {
  process.stderr.write(
    "Usage: node scripts/check-package-assurance.mjs <installed-cli> <workspace> <retained-plan>\n",
  );
  process.exit(2);
}
for (const value of [installedCli, workspace, retainedPlan]) {
  if (!path.isAbsolute(value)) {
    process.stderr.write("all package-assurance paths must be absolute\n");
    process.exit(2);
  }
}

mkdirSync(workspace);
const sealedPlan = path.join(workspace, "sealed.pert");

function invoke(args, expectedStatus = 0) {
  const result = spawnSync(installedCli, args, {
    cwd: workspace,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(
    result.status,
    expectedStatus,
    [
      `unexpected exit for: perttool ${args.join(" ")}`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join("\n"),
  );
  return result;
}

function invokeJson(args) {
  const result = invoke([...args, "--format=json"]);
  assert.ok(
    result.stderr === "" ||
      /^PTSEM-114 warning: duration_unit day is deprecated;/.test(result.stderr),
    result.stderr,
  );
  const value = JSON.parse(result.stdout);
  assert.equal(value.ok, true);
  assert.equal(value.cli_contract_version, 8);
  return value;
}

function invokeGit(args) {
  const result = spawnSync("git", args, {
    cwd: workspace,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
  });
  assert.equal(result.status, 0, result.stderr);
}

const sealed = invokeJson([
  "plan-assurance",
  "seal",
  retainedPlan,
  "--reason",
  "Installed package Contract 8 compatibility acceptance",
]);
assert.equal(sealed.schema_version, "Perttool.MutationResult.v5");
assert.equal(
  sealed.governance?.schema_version,
  "Perttool.GovernanceDecision.v2",
);
assert.equal(sealed.write?.written, false);
assert.match(sealed.updated_text, /  version 6\n/);
assert.match(sealed.updated_text, /^plan_seal /m);
writeFileSync(sealedPlan, sealed.updated_text, "utf8");

invokeGit(["init", "--quiet", "-b", "main"]);
invokeGit(["config", "user.name", "Perttool Package Test"]);
invokeGit(["config", "user.email", "perttool@example.invalid"]);
invokeGit(["add", "--", "sealed.pert"]);
invokeGit(["commit", "--quiet", "-m", "sealed Grammar 6 baseline"]);
const migrated = invokeJson([
  "document",
  "migrate",
  sealedPlan,
  "--target-grammar",
  "7",
  "--write",
]);
assert.equal(
  migrated.schema_version,
  "Perttool.MilestoneAcceptanceMigrationResult.v1",
);
assert.equal(migrated.ok, true);
assert.equal(migrated.target_grammar_version, 7);
assert.match(readFileSync(sealedPlan, "utf8"), /  version 7\n/u);

const shown = invokeJson(["plan-assurance", "show", sealedPlan]);
assert.equal(shown.schema_version, "Perttool.PlanAssuranceResult.v1");
assert.equal(shown.grammar_version, 7);
assert.equal(shown.assurance?.coverage, "complete");
const work = shown.assurance?.task_results?.find(({ task_id: taskId }) =>
  taskId === "WORK"
);
assert.ok(work);
assert.equal(work.status, "verified");

const hash = invoke([
  "plan-assurance",
  "hash",
  sealedPlan,
  "WORK",
  "--kind",
  "contract",
]);
assert.match(hash.stderr, /^PTSEM-114 warning: duration_unit day is deprecated;/);
assert.match(hash.stdout, /^sha256:[0-9a-f]{64}\n$/);
assert.equal(hash.stdout, `${work.contract_hash}\n`);

const next = invokeJson(["dag", "next", sealedPlan]);
assert.equal(next.schema_version, "Perttool.NextResult.v7");
assert.equal(
  next.temporal?.authority?.policy,
  "recommendation_v1_plus_release_gate_plus_plan_assurance_v1",
);
assert.deepEqual(
  next.temporal?.authority?.startable_recommended_task_ids,
  ["WORK"],
);

process.stdout.write(
  "installed package Contract 8 plan-assurance compatibility passed\n",
);

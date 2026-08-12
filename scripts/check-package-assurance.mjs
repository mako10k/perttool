#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
  assert.equal(value.cli_contract_version, 7);
  return value;
}

const sealed = invokeJson([
  "plan-assurance",
  "seal",
  retainedPlan,
  "--reason",
  "Installed package Contract 7 acceptance",
]);
assert.equal(sealed.schema_version, "Perttool.MutationResult.v4");
assert.equal(
  sealed.governance?.schema_version,
  "Perttool.GovernanceDecision.v2",
);
assert.equal(sealed.write?.written, false);
assert.match(sealed.updated_text, /  version 6\n/);
assert.match(sealed.updated_text, /^plan_seal /m);
writeFileSync(sealedPlan, sealed.updated_text, "utf8");

const shown = invokeJson(["plan-assurance", "show", sealedPlan]);
assert.equal(shown.schema_version, "Perttool.PlanAssuranceResult.v1");
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
assert.equal(next.schema_version, "Perttool.NextResult.v6");
assert.equal(
  next.temporal?.authority?.policy,
  "recommendation_v1_plus_release_gate_plus_plan_assurance_v1",
);
assert.deepEqual(
  next.temporal?.authority?.startable_recommended_task_ids,
  ["WORK"],
);

process.stdout.write(
  "installed package Contract 7 plan-assurance acceptance passed\n",
);

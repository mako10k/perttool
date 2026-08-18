#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [installedCli, workspace, fixture] = process.argv.slice(2);
if (
  installedCli === undefined ||
  workspace === undefined ||
  fixture === undefined
) {
  process.stderr.write(
    "Usage: node scripts/check-package-actuals.mjs <installed-cli> <workspace> <fixture>\n",
  );
  process.exit(2);
}
for (const value of [installedCli, workspace, fixture]) {
  if (!path.isAbsolute(value)) {
    process.stderr.write("all paths must be absolute\n");
    process.exit(2);
  }
}

mkdirSync(workspace);
const plan = path.join(workspace, "actuals.pert");
copyFileSync(fixture, plan);

function invoke(program, args, expectedStatus = 0) {
  const result = spawnSync(program, args, {
    cwd: workspace,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    expectedStatus,
    `${program} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

function json(args, expectedStatus = 0) {
  const result = invoke(installedCli, [...args, "--format=json"], expectedStatus);
  assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout);
  assert.equal(value.cli_contract_version, 9);
  return value;
}

function lifecycle(action, at, extra = []) {
  return json([
    "task",
    action,
    plan,
    "WORK",
    "--at",
    at,
    ...extra,
    "--actor",
    "user",
    "--write",
  ]);
}

invoke("git", ["init", "--quiet"]);
invoke("git", ["config", "user.name", "perttool-package-check"]);
invoke("git", ["config", "user.email", "package-check@example.com"]);
invoke("git", ["add", "actuals.pert"]);
invoke("git", ["commit", "--quiet", "-m", "baseline"]);

const checked = json(["document", "check", plan]);
assert.equal(checked.schema_version, "Perttool.CheckResult.v6");
assert.equal(checked.grammar_version, 5);

lifecycle("start", "2026-07-29T09:00:00+09:00");
lifecycle("suspend", "2026-07-29T11:00:00+09:00");
const suspended = json(["dag", "next", plan]);
assert.equal(suspended.schema_version, "Perttool.NextResult.v8");
assert.deepEqual(suspended.groups.suspended, ["WORK"]);
lifecycle("resume", "2026-07-29T12:00:00+09:00");
lifecycle(
  "finish",
  "2026-07-29T15:00:00+09:00",
  ["--active-time", "5", "--effort", "6"],
);

invoke("git", ["add", "actuals.pert"]);
invoke("git", ["commit", "--quiet", "-m", "record actuals"]);
const history = json(["project", "history", plan, "--task", "WORK"]);
assert.equal(history.schema_version, "Perttool.ProjectHistoryResult.v1");
assert.equal(history.history.status, "complete");
assert.equal(history.events.length, 4);

const observation = json([
  "project",
  "observe-velocity",
  plan,
  "--task",
  "WORK",
]);
assert.equal(
  observation.schema_version,
  "Perttool.VelocityObservationResult.v1",
);
assert.equal(observation.observation.evidence, "declared");
assert.equal(json(["project", "show", plan]).project.velocity, "6p/1d");

const migration = json([
  "project",
  "migrate-unit",
  plan,
  "--to-unit",
  "day",
]);
assert.equal(migration.schema_version, "Perttool.UnitMigrationResult.v4");
assert.equal(migration.ok, true, JSON.stringify(migration, null, 2));
assert.equal(
  migration.converted_fields.some(
    ({ entity_kind, field_path }) =>
      entity_kind === "work_event" &&
      field_path.startsWith("work_event.") &&
      field_path.endsWith(".planned_value"),
  ),
  true,
);

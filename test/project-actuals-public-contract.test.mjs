import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const fixture = path.join(
  root,
  "test",
  "fixtures",
  "project-actuals-v5.pert",
);

function run(program, args, options = {}) {
  return spawnSync(program, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    input: options.input,
  });
}

function cliJson(args, expectedStatus = 0) {
  const result = run(process.execPath, [cli, ...args, "--format=json"]);
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  assert.equal(json.cli_contract_version, 8);
  return json;
}

function git(directory, args) {
  const result = run("git", ["-C", directory, ...args]);
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  return result.stdout.trim();
}

function lifecycle(pathname, action, at, extra = []) {
  return cliJson([
    "task",
    action,
    pathname,
    "WORK",
    "--at",
    at,
    ...extra,
    "--actor",
    "user",
    "--write",
  ]);
}

test("Contract 6 publishes Grammar 5 lifecycle, history, and observation without Git or velocity mutation", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-contract6-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const pathname = path.join(directory, "actuals.pert");
  copyFileSync(fixture, pathname);

  git(directory, ["init", "--quiet"]);
  git(directory, ["config", "user.name", "perttool-test"]);
  git(directory, ["config", "user.email", "perttool-test@example.com"]);
  git(directory, ["add", "actuals.pert"]);
  git(directory, ["commit", "--quiet", "-m", "baseline"]);
  assert.equal(git(directory, ["rev-list", "--count", "HEAD"]), "1");

  const checked = cliJson(["document", "check", pathname]);
  assert.equal(checked.schema_version, "Perttool.CheckResult.v5");
  assert.equal(checked.grammar_version, 5);
  assert.deepEqual(checked.actuals_inputs.events, []);

  const started = lifecycle(
    pathname,
    "start",
    "2026-07-29T09:00:00+09:00",
  );
  assert.equal(started.schema_version, "Perttool.MutationResult.v5");
  assert.equal(started.lifecycle.from_state, "planned");
  assert.equal(started.lifecycle.to_state, "active");
  assert.equal(started.lifecycle.event.kind, "start");
  assert.equal(started.lifecycle.event.planned_value.display, "3");

  lifecycle(
    pathname,
    "suspend",
    "2026-07-29T11:00:00+09:00",
    ["--reason", "review"],
  );
  const suspendedAnalysis = cliJson(["dag", "analyze", pathname]);
  assert.equal(suspendedAnalysis.schema_version, "Perttool.AnalysisResult.v6");
  assert.deepEqual(suspendedAnalysis.precedence.suspended_task_ids, ["WORK"]);
  assert.equal(
    suspendedAnalysis.precedence.conditional_on_suspensions_resumed,
    true,
  );
  const suspendedNext = cliJson(["dag", "next", pathname]);
  assert.equal(suspendedNext.schema_version, "Perttool.NextResult.v7");
  assert.deepEqual(suspendedNext.groups.suspended, ["WORK"]);
  assert.deepEqual(suspendedNext.groups.ready, []);

  lifecycle(
    pathname,
    "resume",
    "2026-07-29T12:00:00+09:00",
  );
  const finished = lifecycle(
    pathname,
    "finish",
    "2026-07-29T15:00:00+09:00",
    ["--active-time", "5", "--effort", "6"],
  );
  assert.equal(finished.lifecycle.coverage, "complete");
  assert.equal(finished.lifecycle.event.active_time.display, "5");
  assert.equal(finished.lifecycle.event.effort.display, "6");

  assert.equal(
    git(directory, ["rev-list", "--count", "HEAD"]),
    "1",
    "lifecycle safe writes must not create Git commits",
  );
  assert.equal(
    cliJson(["project", "show", pathname]).project.velocity,
    "6p/1d",
  );

  git(directory, ["add", "actuals.pert"]);
  git(directory, ["commit", "--quiet", "-m", "record actuals"]);

  const history = cliJson([
    "project",
    "history",
    pathname,
    "--task",
    "WORK",
  ]);
  assert.equal(history.schema_version, "Perttool.ProjectHistoryResult.v1");
  assert.equal(history.history.status, "complete");
  assert.equal(history.history.traversal, "first_parent");
  assert.equal(history.history.repository_relative_path, "actuals.pert");
  assert.deepEqual(
    history.tasks.map(({ task_id, coverage }) => [task_id, coverage]),
    [["WORK", "complete"]],
  );
  assert.equal(history.events.length, 4);

  const observation = cliJson([
    "project",
    "observe-velocity",
    pathname,
    "--task",
    "WORK",
  ]);
  assert.equal(
    observation.schema_version,
    "Perttool.VelocityObservationResult.v1",
  );
  assert.equal(observation.observation.evidence, "declared");
  assert.deepEqual(observation.observation.selected_task_ids, ["WORK"]);
  assert.equal(
    observation.observation.candidates.find(
      ({ measure }) => measure === "elapsed_hour_throughput",
    ).adoptable_velocity_token,
    "0.5p/1h",
  );
  assert.equal(
    cliJson(["project", "show", pathname]).project.velocity,
    "6p/1d",
    "observation must not adopt a candidate automatically",
  );

  const advanced = cliJson([
    "dag",
    "advance",
    pathname,
    "--actor",
    "user",
  ], 1);
  assert.equal(advanced.schema_version, "Perttool.AdvanceResult.v3");
  assert.equal(advanced.diagnostics[0].code, "PTMAC-101");
  assert.equal(advanced.advance, null);
  assert.equal(
    readFileSync(pathname, "utf8").includes("work_event"),
    true,
    "Contract 8 blocks old-document advance before migration",
  );
});

test("Contract 6 keeps legacy status-only finish and rejects it for Grammar 5", () => {
  const legacy = cliJson([
    "task",
    "finish",
    "docs/examples/minimal.pert",
    "WORK",
  ]);
  assert.equal(legacy.schema_version, "Perttool.MutationResult.v5");
  assert.equal(legacy.ok, true);
  assert.equal(legacy.lifecycle, null);

  const grammar5 = cliJson(
    ["task", "finish", "test/fixtures/project-actuals-v5.pert", "WORK"],
    1,
  );
  assert.equal(grammar5.ok, false);
  assert.equal(grammar5.lifecycle, null);
  assert.equal(grammar5.diagnostics[0].code, "PTACT-105");
  assert.equal(
    grammar5.diagnostics[0].data.cause,
    "status_only_finish_not_allowed",
  );
});

test("Contract 8 package root retains actuals services without target names", () => {
  for (const name of [
    "planLifecycleMutation",
    "planFinishActuals",
    "inspectProjectHistory",
    "inspectProjectHistoryFile",
    "observeProjectVelocity",
    "projectHistoryResultToJson",
    "velocityObservationResultToJson",
  ]) {
    assert.equal(typeof publicApi[name], "function", name);
  }
  for (const name of [
    "TARGET_GRAMMAR_5_CAPABILITY",
    "planTargetActualsLifecycle",
    "inspectTargetProjectHistory",
    "observeTargetProjectVelocity",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  assert.equal(publicApi.COMMAND_REGISTRY.length, 53);
  assert.equal(
    publicApi.COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 8,
    ),
    true,
  );
});

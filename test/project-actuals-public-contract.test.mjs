// R: Verify public actuals CLI behavior, residual updates, and history contracts.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
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
  assert.equal(json.cli_contract_version, 11);
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
  assert.equal(checked.schema_version, "Perttool.CheckResult.v6");
  assert.equal(checked.grammar_version, 5);
  assert.deepEqual(checked.actuals_inputs.events, []);

  const started = lifecycle(
    pathname,
    "start",
    "2026-07-29T09:00:00+09:00",
  );
  assert.equal(started.schema_version, "Perttool.MutationResult.v6");
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
  assert.equal(suspendedAnalysis.schema_version, "Perttool.AnalysisResult.v7");
  assert.deepEqual(suspendedAnalysis.precedence.suspended_task_ids, ["WORK"]);
  assert.equal(
    suspendedAnalysis.precedence.conditional_on_suspensions_resumed,
    true,
  );
  const suspendedNext = cliJson(["dag", "next", pathname]);
  assert.equal(suspendedNext.schema_version, "Perttool.NextResult.v9");
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
    "1p/2h",
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
  assert.equal(advanced.schema_version, "Perttool.AdvanceResult.v4");
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
  assert.equal(legacy.schema_version, "Perttool.MutationResult.v6");
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

test("Contract 9 package root retains actuals services without target names", () => {
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
  assert.equal(publicApi.COMMAND_REGISTRY.length, 75);
  assert.equal(
    publicApi.COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 11,
    ),
    true,
  );
});

for (const initial of [
  { name: "three-point", fields: "  estimate:\n    optimistic 5p\n    most_likely 8p\n    pessimistic 13p", baseline: "25/3p", numerator: "25", denominator: "3" },
  { name: "rational", fields: "  duration 7/3p", baseline: "7/3p", numerator: "7", denominator: "3" },
]) {
  test(`remaining estimate preserves ${initial.name} first-start evidence through CLI lifecycle and history`, (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), "perttool-residual-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const pathname = path.join(directory, "actuals.pert");
    writeFileSync(pathname, readFileSync(fixture, "utf8").replace("  duration 3p", initial.fields));
    git(directory, ["init", "--quiet"]);
    git(directory, ["config", "user.name", "perttool-test"]);
    git(directory, ["config", "user.email", "perttool-test@example.com"]);
    const commit = (message) => {
      git(directory, ["add", "actuals.pert"]);
      git(directory, ["commit", "--quiet", "-m", message]);
    };
    commit("planned");
    const at = "2026-07-29T09:00:00+09:00";
    lifecycle(pathname, "start", at);
    const started = readFileSync(pathname, "utf8");
    const startBlock = started.slice(started.indexOf("work_event "));
    assert.ok(startBlock.includes(`planned_value ${initial.baseline}`));
    commit("start");
    const args = ["task", "set", pathname, "WORK", "--optimistic", "1p", "--most-likely", "2p", "--pessimistic", "4p"];
    const preview = cliJson([...args, "--diff"]);
    assert.equal(preview.ok, true);
    assert.equal(readFileSync(pathname, "utf8"), started);
    const written = cliJson([...args, "--actor", "user", "--expect-digest", preview.source_digest, "--write"]);
    assert.equal(written.ok, true);
    const remaining = readFileSync(pathname, "utf8");
    assert.equal(remaining.slice(remaining.indexOf("work_event ")), startBlock);
    assert.equal(cliJson(["document", "check", pathname]).ok, true);
    const analysis = cliJson(["dag", "analyze", pathname, "--schedule", "both"]);
    assert.equal(analysis.precedence.makespan.numerator, "13");
    assert.equal(analysis.precedence.makespan.denominator, "6");
    assert.deepEqual(analysis.resource.makespan, analysis.precedence.makespan);
    const retry = lifecycle(pathname, "start", at);
    assert.equal(retry.changed, false);
    assert.equal(readFileSync(pathname, "utf8"), remaining);
    const conflict = cliJson(["task", "start", pathname, "WORK", "--at", "2026-07-29T10:00:00+09:00", "--event-id", retry.lifecycle.event.id], 1);
    assert.ok(conflict.diagnostics.some(({ code }) => code === "PTACT-106"));
    commit("remaining estimate");
    lifecycle(pathname, "suspend", "2026-07-29T11:00:00+09:00");
    // The original consumer is suspended; preview another residual there too.
    assert.equal(cliJson([...args, "--diff"]).ok, true);
    const durationArgs = ["task", "set", pathname, "WORK", "--duration", "1/3p"];
    const durationPreview = cliJson(durationArgs);
    assert.equal(durationPreview.ok, true);
    assert.equal(cliJson([...durationArgs, "--actor", "user", "--expect-digest", durationPreview.source_digest, "--write"]).ok, true);
    assert.ok(readFileSync(pathname, "utf8").includes(startBlock.trimEnd()));
    lifecycle(pathname, "resume", "2026-07-29T12:00:00+09:00");
    lifecycle(pathname, "finish", "2026-07-29T15:00:00+09:00", ["--active-time", "5", "--effort", "6"]);
    commit("finish");
    const history = cliJson(["project", "history", pathname, "--task", "WORK"]);
    assert.equal(history.history.status, "complete");
    assert.equal(history.tasks[0].planned_value.numerator, initial.numerator);
    assert.equal(history.tasks[0].planned_value.denominator, initial.denominator);
    const observation = cliJson(["project", "observe-velocity", pathname, "--task", "WORK"]);
    const elapsed = observation.observation.candidates.find(({ measure }) => measure === "elapsed_hour_throughput");
    assert.equal(elapsed.rate.numerator, initial.numerator);
    assert.equal(elapsed.rate.denominator, "18");
    writeFileSync(pathname, readFileSync(pathname, "utf8").replace(`planned_value ${initial.baseline}`, "planned_value 99p"));
    commit("tampered same-ID baseline");
    const altered = cliJson(["project", "history", pathname, "--task", "WORK"], 1);
    assert.ok(altered.diagnostics.some(({ code }) => code === "PTHIS-103"));
  });
}

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");
const fixture = (name) => `test/fixtures/e2e/${name}.pert`;

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function runJson(args, expectedStatus = 0) {
  const result = run([...args, "--format=json"]);
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.endsWith("\n"), true);
  return JSON.parse(result.stdout);
}

test("E2E-001: discover commands, validate a plan, and compare capacity what-if", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /perttool dag analyze <file>/);
  assert.match(help.stdout, /perttool dag next <file>/);

  const nextHelp = runJson(["dsl", "help", "next", "--level=detail"]);
  assert.equal(nextHelp.topic_id, "next");
  assert.ok(nextHelp.sections.some(({ id }) => id === "selection"));

  const source = fixture("capacity-what-if");
  const checked = runJson(["dsl", "check", source]);
  assert.equal(checked.ok, true);
  assert.equal(checked.document_id, "RELEASE_CAPACITY");

  const baseline = runJson(["dag", "analyze", source]);
  assert.equal(baseline.precedence.makespan.display, "5");
  assert.equal(baseline.resource.makespan.display, "8");

  const baselineNext = runJson(["dag", "next", source]);
  assert.deepEqual(baselineNext.groups.ready, ["API", "UI"]);
  assert.deepEqual(baselineNext.groups.runnable_now, ["API"]);
  const ui = baselineNext.tasks.find(({ id }) => id === "UI");
  assert.ok(ui);
  assert.deepEqual(ui.resource_rejections[0].earlier_selected_task_ids, ["API"]);

  const override = runJson(["dag", "analyze", source, "--capacity=ENGINEERS=2"]);
  assert.equal(override.precedence.makespan.display, "5");
  assert.equal(override.resource.makespan.display, "5");

  const overrideNext = runJson(["dag", "next", source, "--capacity=ENGINEERS=2"]);
  assert.deepEqual(overrideNext.groups.ready, ["API", "UI"]);
  assert.deepEqual(overrideNext.groups.runnable_now, ["API", "UI"]);
});

test("E2E-002: active allocation blocks only tasks requiring the occupied resource", () => {
  const source = fixture("active-resource");
  assert.equal(runJson(["dsl", "check", source]).ok, true);

  const analyzed = runJson(["dag", "analyze", source]);
  assert.equal(analyzed.precedence.makespan.display, "3");
  assert.equal(analyzed.resource.makespan.display, "4");

  const next = runJson(["dag", "next", source]);
  assert.deepEqual(next.groups.active, ["MITIGATE"]);
  assert.deepEqual(next.groups.ready, ["STATUS_UPDATE", "RUNBOOK"]);
  assert.deepEqual(next.groups.runnable_now, ["STATUS_UPDATE"]);
  const runbook = next.tasks.find(({ id }) => id === "RUNBOOK");
  assert.ok(runbook);
  assert.deepEqual(runbook.resource_rejections[0].active_task_ids, ["MITIGATE"]);
});

test("E2E-003: external block is visible and can fail a strict automation run", () => {
  const source = fixture("blocked-approval");
  assert.equal(runJson(["dsl", "check", source]).ok, true);

  const analyzed = runJson(["dag", "analyze", source]);
  assert.equal(analyzed.ok, true);
  assert.equal(analyzed.resource.conditional_on_blocks_resolved, true);
  assert.ok(analyzed.diagnostics.some(({ code }) => code === "PTRES-303"));

  const next = runJson(["dag", "next", source]);
  assert.deepEqual(next.groups.ready, ["IMPLEMENT"]);
  assert.deepEqual(next.groups.runnable_now, ["IMPLEMENT"]);
  assert.deepEqual(next.groups.blocked_now, ["SECURITY_REVIEW"]);
  assert.deepEqual(next.groups.upcoming, ["RELEASE"]);

  const strict = run([
    "dag",
    "next",
    source,
    "--warnings-as-errors",
    "--color=never",
  ]);
  assert.equal(strict.status, 1);
  assert.equal(strict.stdout, "");
  assert.match(strict.stderr, /PTRES-303 warning:/);
});

test("E2E-004: recording completion recalculates the remaining frontier and duration", () => {
  const beforeSource = fixture("progress-before");
  const afterSource = fixture("progress-after");
  assert.equal(runJson(["dsl", "check", beforeSource]).ok, true);
  assert.equal(runJson(["dsl", "check", afterSource]).ok, true);

  const beforeAnalysis = runJson(["dag", "analyze", beforeSource]);
  const afterAnalysis = runJson(["dag", "analyze", afterSource]);
  assert.equal(beforeAnalysis.precedence.makespan.display, "5");
  assert.equal(afterAnalysis.precedence.makespan.display, "3");
  assert.ok(afterAnalysis.diagnostics.some(({ code }) => code === "PTDAG-208"));

  const beforeNext = runJson(["dag", "next", beforeSource]);
  const afterNext = runJson(["dag", "next", afterSource]);
  assert.deepEqual(beforeNext.groups.ready, ["DESIGN"]);
  assert.deepEqual(beforeNext.groups.upcoming, ["IMPLEMENT"]);
  assert.deepEqual(afterNext.groups.ready, ["IMPLEMENT"]);
  assert.deepEqual(afterNext.groups.upcoming, []);
  assert.equal(afterNext.tasks.some(({ id }) => id === "DESIGN"), false);
});

test("E2E-005: all read-only document commands reject an undefined resource", () => {
  const source = fixture("invalid-resource");
  for (const command of [
    ["dsl", "check"],
    ["dag", "analyze"],
    ["dag", "next"],
  ]) {
    const result = runJson([...command, source], 1);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some(({ code }) => code === "PTSEM-206"));
  }
});

test("E2E-006: AI can validate point estimates and consume explicit velocity forecasts", () => {
  const source = "docs/examples/point-velocity.pert";
  const checked = runJson(["dsl", "check", source]);
  assert.equal(checked.ok, true);

  const analyzed = runJson(["dag", "analyze", source]);
  assert.equal(analyzed.duration_unit, "point");
  assert.equal(analyzed.precedence.makespan.display, "10");
  assert.equal(analyzed.resource.makespan.display, "15");
  assert.equal(analyzed.velocity_forecast.precedence_makespan.display, "5");
  assert.equal(analyzed.velocity_forecast.resource_makespan.display, "7.5");

  const next = runJson(["dag", "next", source]);
  assert.deepEqual(next.groups.ready, ["IMPLEMENT", "DESIGN"]);
  assert.deepEqual(next.groups.runnable_now, ["IMPLEMENT"]);
  const implement = next.tasks.find(({ id }) => id === "IMPLEMENT");
  assert.equal(implement.expected.display, "10");
  assert.equal(implement.forecast_expected.display, "5");
});

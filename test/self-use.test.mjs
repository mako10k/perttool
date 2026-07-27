import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeDocument,
  checkDocument,
  convertWithVelocity,
  planFormat,
  planAdvance,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function exact(value) {
  return `${value.numerator}/${value.denominator}`;
}

function detailedPlanProjection(text) {
  const checked = checkDocument(text);
  const analyzed = analyzeDocument(text);
  const next = selectNextTasks(text);
  assert.equal(checked.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.ok(analyzed.precedence);
  assert.ok(analyzed.resource);
  const rejectionTask = next.tasks.find(({ resourceRejections }) => resourceRejections.length > 0);
  const rejection = rejectionTask?.resourceRejections[0];
  return {
    check: {
      document_id: checked.documentId,
      grammar_version: checked.grammarVersion,
      summary: checked.summary,
    },
    analyze: {
      duration_unit: analyzed.durationUnit,
      precedence_makespan: exact(analyzed.precedence.makespan),
      precedence_forecast_unit: analyzed.velocityForecast.targetUnit,
      precedence_forecast: exact(convertWithVelocity(
        analyzed.precedence.makespan,
        analyzed.velocityForecast,
      )),
      precedence_critical_tasks: analyzed.precedence.critical.taskIds,
      resource_makespan: exact(analyzed.resource.makespan),
      resource_forecast: exact(convertWithVelocity(
        analyzed.resource.makespan,
        analyzed.velocityForecast,
      )),
      resource_delay: exact(analyzed.resource.resourceDelay),
      resource_arcs: analyzed.resource.resourceArcs.map(({ id }) => id),
      schedule_critical_tasks: analyzed.resource.scheduleCritical.taskIds,
    },
    next: {
      groups: {
        active: next.groups.active,
        ready: next.groups.ready,
        runnable_now: next.groups.runnableNow,
        blocked_now: next.groups.blockedNow,
        upcoming: next.groups.upcoming,
      },
      resource_rejection:
        rejection === undefined
          ? null
          : {
              task_id: rejectionTask.id,
              resource_id: rejection.resourceId,
              capacity: rejection.capacity,
              earlier_selected_task_ids: rejection.earlierSelectedTaskIds,
            },
    },
  };
}

function macroPlanProjection(text) {
  const checked = checkDocument(text);
  const analyzed = analyzeDocument(text);
  const next = selectNextTasks(text);
  assert.equal(checked.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.ok(analyzed.precedence);
  assert.ok(analyzed.resource);
  return {
    check: {
      document_id: checked.documentId,
      grammar_version: checked.grammarVersion,
      summary: checked.summary,
    },
    analyze: {
      precedence_makespan: exact(analyzed.precedence.makespan),
      precedence_critical_tasks: analyzed.precedence.critical.taskIds,
      resource_makespan: exact(analyzed.resource.makespan),
      resource_delay: exact(analyzed.resource.resourceDelay),
      resource_arcs: analyzed.resource.resourceArcs.map(({ id }) => id),
      schedule_critical_tasks: analyzed.resource.scheduleCritical.taskIds,
    },
    next: {
      groups: {
        active: next.groups.active,
        ready: next.groups.ready,
        runnable_now: next.groups.runnableNow,
        blocked_now: next.groups.blockedNow,
        upcoming: next.groups.upcoming,
      },
    },
  };
}

test("grammar plan check/analyze/next matches the read-only self-use golden", async () => {
  const text = await readFile(path.join(root, "plans/grammar.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/grammar.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("grammar plan is a stable formatter round-trip golden", async () => {
  const text = await readFile(path.join(root, "plans/grammar.pert"), "utf8");
  const first = planFormat(text);
  assert.equal(first.ok, true);
  assert.equal(first.changed, false);
  assert.equal(first.updatedText, text);
  assert.deepEqual(first.edits, []);
  const repeated = planFormat(first.updatedText);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.updatedText, text);
});

test("control-plane plan matches the Issue #1 design roadmap golden", async () => {
  const text = await readFile(path.join(root, "plans/control-plane.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/control-plane.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("operations plan matches the M1-M4 implementation roadmap golden", async () => {
  const text = await readFile(path.join(root, "plans/operations.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/operations.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("operations plan has a valid idempotent advance candidate", async () => {
  const text = await readFile(path.join(root, "plans/operations.pert"), "utf8");
  const before = selectNextTasks(text);
  const advanced = planAdvance(text);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.changed, true);
  assert.ok(advanced.advance.removedTaskIds.includes("ADVANCE_PLANNER"));
  assert.ok(advanced.advance.removedTaskIds.includes("ADVANCE_CLI_ACCEPTANCE"));
  assert.ok(advanced.advance.removedTaskIds.includes("PROJECT_METADATA_CLI"));
  assert.deepEqual(advanced.advance.frontierBefore, ["PROJECT_METADATA_CLI_READY"]);
  assert.deepEqual(advanced.advance.frontierAfter, ["PROJECT_METADATA_CLI_READY"]);
  assert.deepEqual(advanced.advance.readyBefore, []);
  assert.deepEqual(advanced.advance.readyAfter, []);
  assert.deepEqual(selectNextTasks(advanced.updatedText).groups, before.groups);

  const repeated = planAdvance(advanced.updatedText);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.diff, "");
  assert.deepEqual(repeated.edits, []);
});

test("recommendation plan matches the MIG-01 to MIG-07 implementation roadmap", async () => {
  const text = await readFile(path.join(root, "plans/recommendation.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/recommendation.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("agent guidance plan matches the Issue #2 beta implementation roadmap", async () => {
  const text = await readFile(path.join(root, "plans/agent-guidance.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/agent-guidance.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("English baseline plan matches the phased post-beta migration roadmap", async () => {
  const text = await readFile(path.join(root, "plans/english-baseline.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/english-baseline.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("owner-aware governance plan matches the Issue #4 roadmap", async () => {
  const text = await readFile(path.join(root, "plans/governance.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/governance.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("CLI surface reset plan matches the review-derived post-beta roadmap", async () => {
  const text = await readFile(path.join(root, "plans/cli-surface-reset.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/cli-surface-reset.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("0.2.0 release plan matches the completed Contract 3 release roadmap", async () => {
  const text = await readFile(path.join(root, "plans/release-0.2.0.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/release-0.2.0.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("0.3.0 release plan matches the Contract 4 release roadmap", async () => {
  const text = await readFile(path.join(root, "plans/release-0.3.0.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/release-0.3.0.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("0.4.0 release plan matches the Contract 5 release roadmap", async () => {
  const text = await readFile(path.join(root, "plans/release-0.4.0.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/release-0.4.0.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("scheduling and units plan matches the milestone-level roadmap", async () => {
  const text = await readFile(path.join(root, "plans/scheduling-units.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/scheduling-units.expected.json"),
    "utf8",
  ));
  assert.deepEqual(macroPlanProjection(text), expected);
});

test("scheduling and units SU-M1 plan matches the contract detail", async () => {
  const text = await readFile(path.join(root, "plans/scheduling-units-m1.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/scheduling-units-m1.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("scheduling and units SU-M2 plan matches the target-Core detail", async () => {
  const text = await readFile(path.join(root, "plans/scheduling-units-m2.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/scheduling-units-m2.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("scheduling and units SU-M2R plan matches the rational-Duration detail", async () => {
  const text = await readFile(path.join(root, "plans/scheduling-units-m2r.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/scheduling-units-m2r.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("scheduling and units SU-M3 plan matches the temporal-deadline detail", async () => {
  const text = await readFile(path.join(root, "plans/scheduling-units-m3.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/scheduling-units-m3.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("scheduling and units SU-M4 plan matches the migration-Core detail", async () => {
  const text = await readFile(path.join(root, "plans/scheduling-units-m4.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/scheduling-units-m4.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("scheduling and units SU-M5 plan matches the Contract 4 cutover detail", async () => {
  const text = await readFile(path.join(root, "plans/scheduling-units-m5.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/scheduling-units-m5.expected.json"),
    "utf8",
  ));
  assert.deepEqual(detailedPlanProjection(text), expected);
});

test("MVP plan check/analyze/next matches the macro roadmap golden", async () => {
  const text = await readFile(path.join(root, "plans/mvp.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/mvp.expected.json"),
    "utf8",
  ));
  assert.deepEqual(macroPlanProjection(text), expected);
});

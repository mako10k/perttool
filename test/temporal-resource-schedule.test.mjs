import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  analyzeTemporalResourceSchedule,
} from "../dist/analysis/temporal-resource.js";
import {
  projectTargetTemporalInputs,
} from "../dist/application/target-temporal-input.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

function exact(value) {
  return `${value.numerator}/${value.denominator}`;
}

function scheduleText(text, options) {
  const checked = validateTargetGrammar3Document(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.notEqual(checked.validatedDocument, null);
  const inputs = projectTargetTemporalInputs(checked.validatedDocument);
  return analyzeTemporalResourceSchedule(
    checked.validatedDocument,
    inputs,
    options,
  );
}

async function scheduleFixture(name) {
  return scheduleText(
    await readFile(path.join(fixtureDirectory, name), "utf8"),
  );
}

test("temporal resource scheduler remains an internal target boundary", () => {
  assert.equal("analyzeTemporalResourceSchedule" in publicApi, false);
  assert.equal("TEMPORAL_RESOURCE_PROJECTION_IDENTITY" in publicApi, false);
});

test("TUE-004 applies a future leap-day release to the heuristic schedule", async () => {
  const result = await scheduleFixture("calendar-date-v2.pert");
  assert.equal(result.state, "available");
  assert.deepEqual(result.algorithm, {
    id: "perttool.temporal-parallel-sgs",
    version: 1,
    optimal: false,
  });
  assert.deepEqual(result.scheduler, {
    id: "parallel-sgs",
    version: 1,
    optimal: false,
  });
  assert.equal(exact(result.makespan), "3/1");
  assert.deepEqual(result.tasks.map((task) => ({
    id: task.id,
    release: exact(task.releaseBound),
    start: exact(task.start),
    finish: exact(task.finish),
  })), [{
    id: "LEAP_WINDOW",
    release: "1/1",
    start: "1/1",
    finish: "3/1",
  }]);
  assert.deepEqual(result.milestones.map(({ id, reach }) => [
    id,
    exact(reach),
  ]), [
    ["START", "0/1"],
    ["RELEASED", "3/1"],
  ]);
});

test("TUE-005 equal release instants start at zero", async () => {
  const result = await scheduleFixture("calendar-offset-v2.pert");
  assert.equal(result.state, "available");
  assert.equal(exact(result.tasks[0].releaseBound), "0/1");
  assert.equal(exact(result.tasks[0].start), "0/1");
  assert.equal(exact(result.tasks[0].finish), "2/1");
  assert.equal(exact(result.makespan), "2/1");
});

test("TUE-006 unavailable release bounds fail the schedule closed", async () => {
  const result = await scheduleFixture("mixed-kind-v2.pert");
  assert.equal(result.state, "unavailable");
  assert.equal(result.makespan, null);
  assert.deepEqual(result.tasks, []);
  assert.deepEqual(
    result.unavailableCauses.map(({ cause, taskId }) => [cause, taskId]),
    [["incomparable_temporal_kinds", "FUTURE_CLOCK"]],
  );
});

const eventOrderSource = `project TEMPORAL_EVENTS:
  version 3
  title "release event ordering"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

resource WORKER:
  title "worker"
  capacity 1

milestone START:
  title "start"
  state reached

milestone A_DONE:
  title "a"

milestone B_DONE:
  title "b"

milestone C_DONE:
  title "c"

milestone FINISH:
  title "finish"

task A START -> A_DONE:
  title "occupy worker"
  duration 3d
  priority 100
  requires:
    WORKER 1

task B START -> B_DONE:
  title "released while worker is busy"
  duration 1d
  not_before 2026-07-27
  priority 90
  requires:
    WORKER 1

task C START -> C_DONE:
  title "released independently"
  duration 1/3d
  not_before 2026-07-27
  priority 80

gate A_GATE A_DONE -> FINISH:
  reason "a"

gate B_GATE B_DONE -> FINISH:
  reason "b"

gate C_GATE C_DONE -> FINISH:
  reason "c"
`;

test("completion, release, and stable start events preserve resource capacity", () => {
  const result = scheduleText(eventOrderSource);
  assert.equal(result.state, "available");
  assert.deepEqual(result.tasks.map((task) => ({
    id: task.id,
    eligible: exact(task.eligibleTime),
    start: exact(task.start),
    finish: exact(task.finish),
    wait: exact(task.resourceWait),
  })), [
    { id: "A", eligible: "0/1", start: "0/1", finish: "3/1", wait: "0/1" },
    { id: "C", eligible: "2/1", start: "2/1", finish: "7/3", wait: "0/1" },
    { id: "B", eligible: "2/1", start: "3/1", finish: "4/1", wait: "1/1" },
  ]);
  assert.equal(exact(result.makespan), "4/1");
  assert.equal(result.capacities[0].effective, 1);

  const capacityTwo = scheduleText(eventOrderSource, {
    capacityOverrides: new Map([["WORKER", 2]]),
  });
  assert.equal(capacityTwo.state, "available");
  assert.deepEqual(
    capacityTwo.tasks.map(({ id, start }) => [id, exact(start)]),
    [["A", "0/1"], ["C", "2/1"], ["B", "2/1"]],
  );
  assert.equal(exact(capacityTwo.makespan), "3/1");
  assert.equal(capacityTwo.capacities[0].override, 2);
  assert.equal(capacityTwo.capacities[0].effective, 2);
});

test("active work ignores retained not_before and blocked work stays qualified", () => {
  const source = eventOrderSource
    .replace("task A START -> A_DONE:", "task A START -> A_DONE:")
    .replace(
      "  priority 100\n  requires:",
      "  not_before 2026-07-30\n  status active\n  priority 100\n  requires:",
    )
    .replace(
      "  priority 90\n  requires:",
      "  status blocked\n  priority 90\n  blocked_reason \"waiting\"\n  requires:",
    );
  const result = scheduleText(source);
  assert.equal(result.state, "available");
  const active = result.tasks.find(({ id }) => id === "A");
  const blocked = result.tasks.find(({ id }) => id === "B");
  assert.equal(active.releaseBound, null);
  assert.equal(exact(active.start), "0/1");
  assert.equal(blocked.conditionalBlocked, true);
  assert.equal(result.conditionalOnBlocksResolved, true);
  assert.deepEqual(result.blockedTaskIds, ["B"]);
});

test("temporal resource scheduling is byte-independent and deterministic", () => {
  const first = scheduleText(eventOrderSource);
  const second = scheduleText(eventOrderSource);
  assert.deepEqual(second, first);
});

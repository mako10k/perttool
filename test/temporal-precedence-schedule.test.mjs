import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  analyzeTemporalPrecedenceSchedule,
} from "../dist/analysis/temporal-precedence.js";
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

function analyzeText(text) {
  const checked = validateTargetGrammar3Document(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.notEqual(checked.validatedDocument, null);
  return analyzeTemporalPrecedenceSchedule(
    checked.validatedDocument,
    projectTargetTemporalInputs(checked.validatedDocument),
  );
}

async function analyzeFixture(name) {
  return analyzeText(
    await readFile(path.join(fixtureDirectory, name), "utf8"),
  );
}

test("temporal precedence projection remains an internal target boundary", () => {
  assert.equal("analyzeTemporalPrecedenceSchedule" in publicApi, false);
  assert.equal("TEMPORAL_PRECEDENCE_PROJECTION_IDENTITY" in publicApi, false);
});

test("TUE-004 derives release-aware leap-day precedence", async () => {
  const result = await analyzeFixture("calendar-date-v2.pert");
  assert.equal(result.state, "available");
  assert.deepEqual(result.algorithm, {
    id: "perttool.temporal-precedence-earliest",
    version: 1,
    optimal: null,
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

test("TUE-005 equal release instants preserve a zero bound", async () => {
  const result = await analyzeFixture("calendar-offset-v2.pert");
  assert.equal(result.state, "available");
  assert.equal(exact(result.tasks[0].releaseBound), "0/1");
  assert.equal(exact(result.tasks[0].start), "0/1");
  assert.equal(exact(result.tasks[0].finish), "2/1");
});

test("TUE-006 fails closed without changing structural source", async () => {
  const result = await analyzeFixture("mixed-kind-v2.pert");
  assert.equal(result.state, "unavailable");
  assert.equal(result.makespan, null);
  assert.deepEqual(result.tasks, []);
  assert.deepEqual(
    result.unavailableCauses.map(({ cause, taskId }) => [cause, taskId]),
    [["incomparable_temporal_kinds", "FUTURE_CLOCK"]],
  );
});

test("parallel joins use max source completion and per-task release bounds", () => {
  const source = `project PRECEDENCE_RELEASE:
  version 3
  title "precedence release"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone A_DONE:
  title "a"

milestone B_DONE:
  title "b"

milestone JOIN:
  title "join"

milestone FINISH:
  title "finish"

task A START -> A_DONE:
  title "a"
  duration 1/3d
  not_before 2026-07-27

task B START -> B_DONE:
  title "b"
  duration 3d

gate A_GATE A_DONE -> JOIN:
  reason "a"

gate B_GATE B_DONE -> JOIN:
  reason "b"

task C JOIN -> FINISH:
  title "c"
  duration 1d
  not_before 2026-07-29
`;
  const result = analyzeText(source);
  assert.equal(result.state, "available");
  assert.deepEqual(result.tasks.map((task) => ({
    id: task.id,
    release: exact(task.releaseBound),
    start: exact(task.start),
    finish: exact(task.finish),
  })), [
    { id: "A", release: "2/1", start: "2/1", finish: "7/3" },
    { id: "B", release: "0/1", start: "0/1", finish: "3/1" },
    { id: "C", release: "4/1", start: "4/1", finish: "5/1" },
  ]);
  assert.deepEqual(
    result.milestones.map(({ id, reach }) => [id, exact(reach)]),
    [
      ["START", "0/1"],
      ["A_DONE", "7/3"],
      ["B_DONE", "3/1"],
      ["JOIN", "3/1"],
      ["FINISH", "5/1"],
    ],
  );
  assert.equal(exact(result.makespan), "5/1");
});

test("active and done tasks retain snapshot completion meanings", () => {
  const source = `project SNAPSHOT_STATUS:
  version 2
  title "snapshot status"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone ACTIVE_DONE:
  title "active"

milestone DONE_DONE:
  title "done"

milestone FINISH:
  title "finish"

task ACTIVE START -> ACTIVE_DONE:
  title "remaining"
  duration 2d
  status active
  not_before 2026-07-30

task DONE START -> DONE_DONE:
  title "done"
  duration 9d
  status done

gate ACTIVE_GATE ACTIVE_DONE -> FINISH:
  reason "active"

gate DONE_GATE DONE_DONE -> FINISH:
  reason "done"
`;
  const result = analyzeText(source);
  assert.equal(result.state, "available");
  const active = result.tasks.find(({ id }) => id === "ACTIVE");
  const done = result.tasks.find(({ id }) => id === "DONE");
  assert.equal(active.releaseBound, null);
  assert.equal(exact(active.start), "0/1");
  assert.equal(exact(active.finish), "2/1");
  assert.equal(done, undefined);
  assert.equal(
    exact(result.milestones.find(({ id }) => id === "DONE_DONE").reach),
    "0/1",
  );
  assert.equal(exact(result.makespan), "2/1");
});

test("blocked predecessors keep exact output conditional and deterministic", () => {
  const source = `project BLOCKED_PRECEDENCE:
  version 2
  title "blocked"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task BLOCKED START -> FINISH:
  title "blocked"
  duration 2d
  status blocked
  blocked_reason "external"
`;
  const first = analyzeText(source);
  const second = analyzeText(source);
  assert.deepEqual(second, first);
  assert.equal(first.conditionalOnBlocksResolved, true);
  assert.deepEqual(first.blockedTaskIds, ["BLOCKED"]);
  assert.equal(first.tasks[0].conditionalBlocked, true);
});

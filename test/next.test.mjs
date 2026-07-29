import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { selectNextTasks } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

test("parallel next selects a deterministic runnable subset", async () => {
  const text = await readFile(path.join(root, "docs/examples/parallel.pert"), "utf8");
  const result = selectNextTasks(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.groups, {
    active: [],
    suspended: [],
    ready: ["CORE", "CLI", "DOCS"],
    runnableNow: ["CORE", "CLI"],
    blockedNow: [],
    upcoming: ["TEST", "PACKAGE"],
  });
  const docs = result.tasks.find(({ id }) => id === "DOCS");
  assert.equal(docs.classification, "ready");
  assert.equal(docs.runnableNow, false);
  assert.deepEqual(docs.resourceRejections.map((rejection) => ({
    resourceId: rejection.resourceId,
    capacity: rejection.capacity,
    activeUsage: rejection.activeUsage,
    earlierSelectedUsage: rejection.earlierSelectedUsage,
    usedBeforeDecision: rejection.usedBeforeDecision,
    required: rejection.required,
    available: rejection.available,
    deficit: rejection.deficit,
    activeTaskIds: rejection.activeTaskIds,
    earlierSelectedTaskIds: rejection.earlierSelectedTaskIds,
  })), [{
    resourceId: "DEVELOPERS",
    capacity: 2,
    activeUsage: 0,
    earlierSelectedUsage: 2,
    usedBeforeDecision: 2,
    required: 1,
    available: 0,
    deficit: 1,
    activeTaskIds: [],
    earlierSelectedTaskIds: ["CORE", "CLI"],
  }]);
});

test("capacity override changes runnable now but not ready classification", async () => {
  const text = await readFile(path.join(root, "docs/examples/parallel.pert"), "utf8");
  const result = selectNextTasks(text, {
    capacityOverrides: new Map([["DEVELOPERS", 3]]),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.groups.ready, ["CORE", "CLI", "DOCS"]);
  assert.deepEqual(result.groups.runnableNow, ["CORE", "CLI", "DOCS"]);
  assert.equal(result.tasks.find(({ id }) => id === "DOCS").resourceRejections.length, 0);
});

test("done tasks are excluded and active/upcoming follow effective reached state", async () => {
  const text = await readFile(
    path.join(root, "docs/examples/advance-partial-before.pert"),
    "utf8",
  );
  const result = selectNextTasks(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.groups.active, ["BRANCH_B"]);
  assert.deepEqual(result.groups.upcoming, ["RELEASE"]);
  assert.equal(result.tasks.some(({ status }) => status === "done"), false);
});

test("blocked and ready classifications stay distinct from runnable membership", () => {
  const text = `project CLASSIFY:
  title "classify"
  duration_unit day
  finish FINISH

resource DEVICE:
  title "device"
  capacity 1

milestone NOW:
  title "now"
  state reached

milestone ACTIVE_DONE:
  title "active"

milestone BLOCKED_DONE:
  title "blocked"

milestone READY_DONE:
  title "ready"

milestone MID:
  title "mid"

milestone UPCOMING_DONE:
  title "upcoming"

milestone LATER_BLOCKED_DONE:
  title "later blocked"

milestone FINISH:
  title "finish"

task ACTIVE NOW -> ACTIVE_DONE:
  title "active"
  duration 2d
  status active
  requires:
    DEVICE 1

task BLOCKED_NOW NOW -> BLOCKED_DONE:
  title "blocked now"
  duration 1d
  status blocked
  blocked_reason "external"

task READY NOW -> READY_DONE:
  title "ready"
  duration 1d
  requires:
    DEVICE 1

task UPSTREAM NOW -> MID:
  title "upstream"
  duration 1d
  priority 10

task UPCOMING MID -> UPCOMING_DONE:
  title "upcoming"
  duration 1d

task BLOCKED_LATER MID -> LATER_BLOCKED_DONE:
  title "blocked later"
  duration 1d
  status blocked
  blocked_reason "later"

gate ACTIVE_GATE ACTIVE_DONE -> FINISH:
  reason "active"

gate BLOCKED_GATE BLOCKED_DONE -> FINISH:
  reason "blocked"

gate READY_GATE READY_DONE -> FINISH:
  reason "ready"

gate UPCOMING_GATE UPCOMING_DONE -> FINISH:
  reason "upcoming"

gate LATER_BLOCKED_GATE LATER_BLOCKED_DONE -> FINISH:
  reason "later blocked"
`;
  const result = selectNextTasks(text);
  assert.equal(result.ok, true);
  assert.deepEqual(result.groups.active, ["ACTIVE"]);
  assert.deepEqual(result.groups.ready, ["UPSTREAM", "READY"]);
  assert.deepEqual(result.groups.runnableNow, ["UPSTREAM"]);
  assert.deepEqual(result.groups.blockedNow, ["BLOCKED_NOW"]);
  assert.deepEqual(result.groups.upcoming, ["BLOCKED_LATER", "UPCOMING"]);
  const ready = result.tasks.find(({ id }) => id === "READY");
  assert.equal(ready.classification, "ready");
  assert.equal(ready.runnableNow, false);
  assert.deepEqual(ready.resourceRejections[0].activeTaskIds, ["ACTIVE"]);
  const blockedLater = result.tasks.find(({ id }) => id === "BLOCKED_LATER");
  assert.equal(blockedLater.classification, "upcoming");
  assert.equal(blockedLater.blockedReason, "later");
});

test("upcoming explanation obeys the requested depth", () => {
  const text = `project EXPLAIN:
  title "explain"
  duration_unit day
  finish DONE

milestone NOW:
  title "now"
  state reached

milestone FIRST:
  title "first"

milestone SECOND:
  title "second"

milestone DONE:
  title "done"

task STEP_ONE NOW -> FIRST:
  title "one"
  duration 1d

task STEP_TWO FIRST -> SECOND:
  title "two"
  duration 1d

task TARGET SECOND -> DONE:
  title "target"
  duration 1d
`;
  const shallow = selectNextTasks(text, { explainDepth: 0 });
  const shallowNode = shallow.tasks.find(({ id }) => id === "TARGET").explanation[0];
  assert.equal(shallowNode.milestoneId, "SECOND");
  assert.deepEqual(shallowNode.unsatisfiedEdges.map(({ edgeId }) => edgeId), ["STEP_TWO"]);
  assert.deepEqual(shallowNode.children, []);
  assert.equal(shallowNode.truncated, true);

  const deep = selectNextTasks(text, { explainDepth: 1 });
  const deepNode = deep.tasks.find(({ id }) => id === "TARGET").explanation[0];
  assert.equal(deepNode.truncated, false);
  assert.deepEqual(deepNode.children.map(({ milestoneId }) => milestoneId), ["FIRST"]);
  assert.deepEqual(
    deepNode.children[0].unsatisfiedEdges.map(({ edgeId }) => edgeId),
    ["STEP_ONE"],
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  add,
  analyzeDocument,
  analyzePrecedence,
  analyzeResources,
  buildResidualGraph,
  checkDocument,
  formatDecimal,
  rational,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function precedenceExample(name, maxPaths = 10) {
  const text = await readFile(path.join(root, "docs/examples", name), "utf8");
  const checked = checkDocument(text);
  assert.equal(checked.ok, true);
  return analyzePrecedence(buildResidualGraph(checked.document), maxPaths);
}

function exact(value) {
  return `${value.numerator}/${value.denominator}`;
}

test("Rational arithmetic is canonical and display rounding is derived", () => {
  assert.deepEqual(rational(10n, 100n), { numerator: 1n, denominator: 10n });
  assert.deepEqual(add(rational(1n, 6n), rational(1n, 3n)), {
    numerator: 1n,
    denominator: 2n,
  });
  assert.equal(formatDecimal(rational(13n, 6n), 3), "2.167");
  assert.equal(formatDecimal(rational(-1n, 8n), 2), "-0.13");
});

test("PERT example preserves exact expected duration and variance", async () => {
  const result = await precedenceExample("pert-estimate.pert");
  const design = result.edges.find(({ id }) => id === "DESIGN");
  assert.equal(exact(design.expected), "13/6");
  assert.equal(exact(design.variance), "1/4");
  assert.equal(exact(result.makespan), "31/6");
  assert.deepEqual(result.critical.taskIds, ["DESIGN", "BUILD"]);
  assert.equal(exact(result.critical.representativePath.variance), "1/4");
});

test("parallel precedence CPM matches the normative float table", async () => {
  const result = await precedenceExample("parallel.pert");
  assert.equal(exact(result.makespan), "6/1");
  const expected = new Map([
    ["CORE", ["0/1", "4/1", "0/1", "0/1"]],
    ["CLI", ["0/1", "3/1", "1/1", "0/1"]],
    ["DOCS", ["0/1", "2/1", "2/1", "0/1"]],
    ["TEST", ["4/1", "6/1", "0/1", "0/1"]],
    ["PACKAGE", ["4/1", "5/1", "1/1", "0/1"]],
  ]);
  for (const [id, values] of expected) {
    const edge = result.edges.find((candidate) => candidate.id === id);
    assert.deepEqual(
      [exact(edge.es), exact(edge.ef), exact(edge.totalFloat), exact(edge.freeFloat)],
      values,
      id,
    );
  }
  assert.deepEqual(result.critical.drivingEdgeIds, [
    "CORE",
    "CORE_READY",
    "TEST",
    "TEST_RELEASE_GATE",
  ]);
  assert.deepEqual(result.critical.representativePath.taskIds, ["CORE", "TEST"]);
  assert.equal(result.critical.pathCount, 1n);
});

test("canonical advance before and after have the same precedence result", async () => {
  const before = await precedenceExample("advance-partial-before.pert");
  const after = await precedenceExample("advance-partial-after.pert");
  const project = (result) => ({
    makespan: exact(result.makespan),
    milestones: result.milestones.map(({ id, earliest, latest, slack }) => [
      id,
      exact(earliest),
      exact(latest),
      exact(slack),
    ]),
    edges: result.edges.map(({ id, expected, totalFloat, freeFloat }) => [
      id,
      exact(expected),
      exact(totalFloat),
      exact(freeFloat),
    ]),
    path: result.critical.representativePath.edgeIds,
  });
  assert.deepEqual(project(before), project(after));
});

test("canonical advance before and after have the same resource schedule", async () => {
  const beforeText = await readFile(path.join(root, "docs/examples/advance-partial-before.pert"), "utf8");
  const afterText = await readFile(path.join(root, "docs/examples/advance-partial-after.pert"), "utf8");
  const before = analyzeDocument(beforeText, { maxPaths: 10 }).resource;
  const after = analyzeDocument(afterText, { maxPaths: 10 }).resource;
  const project = (result) => ({
    makespan: exact(result.makespan),
    tasks: result.tasks.map(({ id, status, start, finish }) => [
      id,
      status,
      exact(start),
      exact(finish),
    ]),
    arcs: result.resourceArcs.map(({ id }) => id),
    path: result.scheduleCritical.representativePath,
  });
  assert.deepEqual(project(before), project(after));
});

test("critical epsilon does not change exact driving path count", () => {
  const text = `project EPSILON:
  title "epsilon"
  duration_unit day
  critical_epsilon 0.5d
  finish DONE

milestone NOW:
  title "now"
  state reached

milestone A_DONE:
  title "a"

milestone B_DONE:
  title "b"

milestone DONE:
  title "done"

task A NOW -> A_DONE:
  title "a"
  duration 2d

task B NOW -> B_DONE:
  title "b"
  duration 1.5d

gate A_GATE A_DONE -> DONE:
  reason "a"

gate B_GATE B_DONE -> DONE:
  reason "b"
`;
  const checked = checkDocument(text);
  assert.equal(checked.ok, true);
  const result = analyzePrecedence(buildResidualGraph(checked.document), 10);
  assert.deepEqual(result.critical.taskIds, ["A", "B"]);
  assert.deepEqual(result.critical.drivingEdgeIds, ["A", "A_GATE"]);
  assert.equal(result.critical.pathCount, 1n);
  assert.deepEqual(result.critical.representativePath.taskIds, ["A"]);
});

test("multiple critical paths are counted exactly and enumerated with a limit", () => {
  const text = `project DIAMOND:
  title "diamond"
  duration_unit day
  finish DONE

milestone NOW:
  title "now"
  state reached

milestone A_DONE:
  title "a"

milestone B_DONE:
  title "b"

milestone DONE:
  title "done"

task A NOW -> A_DONE:
  title "a"
  duration 1d

task B NOW -> B_DONE:
  title "b"
  duration 1d

gate A_GATE A_DONE -> DONE:
  reason "a"

gate B_GATE B_DONE -> DONE:
  reason "b"
`;
  const result = analyzeDocument(text, { mode: "both", maxPaths: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.precedence.critical.pathCount, 2n);
  assert.equal(result.precedence.critical.paths.length, 1);
  assert.equal(result.precedence.critical.pathsTruncated, true);
  assert.deepEqual(result.precedence.critical.representativePath.edgeIds, ["A", "A_GATE"]);
  assert.equal(result.resource.scheduleCritical.pathCount, 2n);
  assert.equal(result.diagnostics.some(({ code }) => code === "PTDAG-302"), true);
});

test("complete zero-task project has a zero makespan in both results", () => {
  const text = `project COMPLETE:
  title "complete"
  duration_unit day
  finish DONE

milestone DONE:
  title "done"
  state reached
`;
  const result = analyzeDocument(text, { maxPaths: 10 });
  assert.equal(result.ok, true);
  assert.equal(exact(result.precedence.makespan), "0/1");
  assert.equal(exact(result.resource.makespan), "0/1");
  assert.deepEqual(result.precedence.critical.representativePath.edgeIds, []);
  assert.deepEqual(result.resource.tasks, []);
});

test("active tasks are fixed at zero and can release an exclusive resource", () => {
  const text = `project ACTIVE:
  title "active"
  duration_unit day
  finish DONE

resource DEVICE:
  title "device"
  capacity 1

milestone NOW:
  title "now"
  state reached

milestone A_DONE:
  title "a"

milestone B_DONE:
  title "b"

milestone DONE:
  title "done"

task ACTIVE_TASK NOW -> A_DONE:
  title "active"
  duration 2d
  status active
  requires:
    DEVICE 1

task WAITING NOW -> B_DONE:
  title "waiting"
  duration 1d
  requires:
    DEVICE 1

gate A_GATE A_DONE -> DONE:
  reason "a"

gate B_GATE B_DONE -> DONE:
  reason "b"
`;
  const result = analyzeDocument(text, { maxPaths: 10 });
  assert.equal(result.ok, true);
  assert.equal(exact(result.resource.makespan), "3/1");
  assert.deepEqual(
    result.resource.tasks.map(({ id, start, finish }) => [id, exact(start), exact(finish)]),
    [
      ["ACTIVE_TASK", "0/1", "2/1"],
      ["WAITING", "2/1", "3/1"],
    ],
  );
  assert.deepEqual(result.resource.resourceArcs.map(({ id }) => id), [
    "resource:ACTIVE_TASK:WAITING",
  ]);
});

test("multi-resource witness contributions merge into one stable arc", () => {
  const text = `project MULTI_RESOURCE:
  title "multi"
  duration_unit day
  finish DONE

resource LEFT:
  title "left"
  capacity 1

resource RIGHT:
  title "right"
  capacity 1

milestone NOW:
  title "now"
  state reached

milestone A_DONE:
  title "a"

milestone B_DONE:
  title "b"

milestone DONE:
  title "done"

task A NOW -> A_DONE:
  title "a"
  duration 1d
  priority 10
  requires:
    LEFT 1
    RIGHT 1

task B NOW -> B_DONE:
  title "b"
  duration 1d
  requires:
    LEFT 1
    RIGHT 1

gate A_GATE A_DONE -> DONE:
  reason "a"

gate B_GATE B_DONE -> DONE:
  reason "b"
`;
  const result = analyzeDocument(text, { maxPaths: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.resource.resourceArcs.length, 1);
  const arc = result.resource.resourceArcs[0];
  assert.equal(arc.id, "resource:A:B");
  assert.deepEqual([...arc.resources], [["LEFT", 1], ["RIGHT", 1]]);
});

test("candidate scan skips a non-fitting task and starts a later fitting task", () => {
  const text = `project SKIP:
  title "skip"
  duration_unit day
  finish DONE

resource WORKERS:
  title "workers"
  capacity 2

milestone NOW:
  title "now"
  state reached

milestone ACTIVE_DONE:
  title "active"

milestone HIGH_DONE:
  title "high"

milestone LOW_DONE:
  title "low"

milestone DONE:
  title "done"

task ACTIVE NOW -> ACTIVE_DONE:
  title "active"
  duration 2d
  status active
  requires:
    WORKERS 1

task HIGH NOW -> HIGH_DONE:
  title "high"
  duration 1d
  priority 20
  requires:
    WORKERS 2

task LOW NOW -> LOW_DONE:
  title "low"
  duration 1d
  priority 10
  requires:
    WORKERS 1

gate ACTIVE_GATE ACTIVE_DONE -> DONE:
  reason "active"

gate HIGH_GATE HIGH_DONE -> DONE:
  reason "high"

gate LOW_GATE LOW_DONE -> DONE:
  reason "low"
`;
  const result = analyzeDocument(text, { maxPaths: 10 });
  assert.equal(result.ok, true);
  const tasks = new Map(result.resource.tasks.map((task) => [task.id, task]));
  assert.equal(exact(tasks.get("LOW").start), "0/1");
  assert.equal(exact(tasks.get("HIGH").start), "2/1");
});

test("parallel resource schedule matches the normative default timeline", async () => {
  const text = await readFile(path.join(root, "docs/examples/parallel.pert"), "utf8");
  const checked = checkDocument(text);
  const graph = buildResidualGraph(checked.document);
  const precedence = analyzePrecedence(graph, 10);
  const result = analyzeResources(graph, precedence, new Map(), 10);
  assert.equal(exact(result.makespan), "8/1");
  assert.equal(exact(result.resourceDelay), "2/1");
  assert.deepEqual(
    result.tasks.map(({ id, start, finish }) => [id, exact(start), exact(finish)]),
    [
      ["CLI", "0/1", "3/1"],
      ["CORE", "0/1", "4/1"],
      ["DOCS", "3/1", "5/1"],
      ["TEST", "5/1", "7/1"],
      ["PACKAGE", "7/1", "8/1"],
    ],
  );
  assert.deepEqual(result.resourceArcs.map(({ id }) => id), [
    "resource:CLI:DOCS",
    "resource:TEST:PACKAGE",
  ]);
  assert.deepEqual(result.scheduleCritical.representativePath.taskIds, [
    "CLI",
    "DOCS",
    "TEST",
    "PACKAGE",
  ]);
  assert.deepEqual(result.scheduleCritical.taskIds, ["CLI", "DOCS", "TEST", "PACKAGE"]);
  const developers = result.resources.find(({ id }) => id === "DEVELOPERS");
  const testEnvironment = result.resources.find(({ id }) => id === "TEST_ENV");
  assert.equal(exact(developers.utilization), "9/16");
  assert.equal(exact(testEnvironment.utilization), "3/8");
  assert.equal(result.constraintGraphReplay.ok, true);
});

for (const [developers, testEnvironment, makespan, arcs, criticalTasks] of [
  [3, 1, "7/1", ["resource:TEST:PACKAGE"], ["CORE", "TEST", "PACKAGE"]],
  [2, 2, "7/1", ["resource:CLI:DOCS"], ["CLI", "DOCS", "TEST"]],
  [3, 2, "6/1", [], ["CORE", "TEST"]],
]) {
  test(`capacity ${developers}/${testEnvironment} changes only the resource schedule`, async () => {
    const text = await readFile(path.join(root, "docs/examples/parallel.pert"), "utf8");
    const checked = checkDocument(text);
    const graph = buildResidualGraph(checked.document);
    const precedence = analyzePrecedence(graph, 10);
    const result = analyzeResources(
      graph,
      precedence,
      new Map([
        ["DEVELOPERS", developers],
        ["TEST_ENV", testEnvironment],
      ]),
      10,
    );
    assert.equal(exact(precedence.makespan), "6/1");
    assert.equal(exact(result.makespan), makespan);
    assert.deepEqual(result.resourceArcs.map(({ id }) => id), arcs);
    assert.deepEqual(result.scheduleCritical.representativePath.taskIds, criticalTasks);
    assert.equal(result.constraintGraphReplay.ok, true);
  });
}

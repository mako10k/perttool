// R: Verify exact concurrent selection and boundary budgets against independent subset enumeration.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { selectMaximumCountTasks } from "../dist/recommendation/maximum-count.js";
import { selectMaximumCountFromRanking } from "../dist/recommendation/maximum-count-ranking.js";
import { analyzePrecedence, buildResidualGraph, checkDocument } from "../dist/index.js";

const digest = `sha256:${"a".repeat(64)}`;
const requirement = (resourceId, units) => ({ resourceId, units });
function task(taskId, units = 1, rankGroup = 0, eligibility = "eligible") {
  return { taskId, rankGroup, eligibility, requirements: [requirement("WORKER", units)] };
}
function snapshot(candidates, units = 2, activeTasks = []) {
  return { sourceDigest: digest, capacities: [requirement("WORKER", units)], candidates, activeTasks };
}

test("count first: two one-unit tasks replace a higher-ranked two-unit task", () => {
  const result = selectMaximumCountTasks(snapshot([task("A", 2), task("B", 1, 1), task("C", 1, 2)]));
  assert.deepEqual(result.selectedTaskIds, ["B", "C"]);
  assert.equal(result.maximumTaskCount, 2);
  assert.equal(result.algorithm.optimalTaskCount, true);
  assert.equal(result.resources[0].remainingUnits, 0);
});

test("boundary group reports budget after active and outside-group allocations", () => {
  const active = [{ taskId: "ACTIVE", requirements: [requirement("WORKER", 1)] }];
  const result = selectMaximumCountTasks(snapshot([
    task("P", 1, 0), task("X", 1, 1), task("Y", 1, 1), task("Z", 1, 1),
  ], 4, active));
  assert.deepEqual(result.selectedTaskIds, ["P", "X", "Y"]);
  assert.equal(result.boundaryGroups.length, 1);
  const group = result.boundaryGroups[0];
  assert.deepEqual(group.candidates.map((item) => item.taskId), ["X", "Y", "Z"]);
  assert.deepEqual(group.selectedTaskIds, ["X", "Y"]);
  assert.deepEqual(group.unselectedTaskIds, ["Z"]);
  assert.deepEqual(group.resources, [{
    resourceId: "WORKER", capacity: 4, activeUsage: 1, outsideGroupUsage: 1,
    allocatableUnits: 2, selectedUsage: 2, remainingUnits: 0,
  }]);
});

test("semantic rank group counts precede ID tie-break across maximum-count sets", () => {
  // Count from the best semantic rank group precedes individual ID preference.
  const input = {
    sourceDigest: digest,
    capacities: [requirement("WORKER", 2), requirement("DEVICE", 1)],
    activeTasks: [],
    candidates: [
      { ...task("A"), requirements: [requirement("WORKER", 1), requirement("DEVICE", 1)] },
      task("B"),
      { ...task("C", 1, 1), requirements: [requirement("WORKER", 1), requirement("DEVICE", 1)] },
      task("D", 1, 2),
    ],
  };
  const result = selectMaximumCountTasks(input);
  // Two from rank 0 beats either rank-0 + rank-1 choice.
  assert.deepEqual(result.selectedTaskIds, ["A", "B"]);
  input.candidates[1] = { ...task("B"), requirements: [requirement("WORKER", 2)] };
  // Count remains primary: B alone loses to A+D.
  assert.deepEqual(selectMaximumCountTasks(input).selectedTaskIds, ["A", "D"]);
});

test("lower-ID member of a tie cannot displace a better-ranked member of another group", () => {
  const input = {
    sourceDigest: digest, activeTasks: [],
    capacities: [requirement("WORKER", 1), requirement("DEVICE", 1), requirement("EXTRA", 1)],
    candidates: [
      { ...task("A"), requirements: [requirement("WORKER", 1), requirement("DEVICE", 1)] },
      task("B"),
      { ...task("C", 1, 1), requirements: [requirement("DEVICE", 1), requirement("EXTRA", 1)] },
      { ...task("D", 1, 2), requirements: [requirement("EXTRA", 1)] },
    ],
  };
  const result = selectMaximumCountTasks(input);
  assert.deepEqual(result.selectedTaskIds, ["B", "C"]);
  const tied = result.boundaryGroups.find((group) => group.rankGroup === 0);
  assert.deepEqual(tied.resources.map((item) => [item.resourceId, item.allocatableUnits]), [
    ["DEVICE", 0], ["EXTRA", 0], ["WORKER", 1],
  ]);
});

test("time and assurance exclusions reserve nothing; all eligible candidates remain considered", () => {
  const input = snapshot([
    task("A", 1, 0, "time_withheld"), task("B", 1, 0, "assurance_withheld"),
    task("C", 1, 1), task("D", 1, 2),
  ]);
  const result = selectMaximumCountTasks(input);
  assert.deepEqual(result.selectedTaskIds, ["C", "D"]);
  assert.deepEqual(result.excludedTasks, [
    { taskId: "A", reason: "time_withheld" },
    { taskId: "B", reason: "assurance_withheld" },
  ]);
  assert.deepEqual(result.boundaryGroups, []);
});

test("multiple resources constrain jointly; zero capacity and free tasks retain exact meaning", () => {
  const input = {
    sourceDigest: digest, activeTasks: [],
    capacities: [requirement("WORKER", 2), requirement("DEVICE", 1)],
    candidates: [
      { ...task("A"), requirements: [requirement("WORKER", 1), requirement("DEVICE", 1)] },
      { ...task("B"), requirements: [requirement("WORKER", 1), requirement("DEVICE", 1)] },
      task("C"),
    ],
  };
  const result = selectMaximumCountTasks(input);
  assert.deepEqual(result.selectedTaskIds, ["A", "C"]);
  const group = result.boundaryGroups[0];
  assert.deepEqual(group.resources.map((item) => [item.resourceId, item.allocatableUnits]), [
    ["DEVICE", 1], ["WORKER", 2],
  ]);
  assert.deepEqual(selectMaximumCountTasks(snapshot([task("A")], 0)).selectedTaskIds, []);
  assert.deepEqual(selectMaximumCountTasks(snapshot([
    task("A"), { ...task("FREE"), requirements: [] },
  ], 0)).selectedTaskIds, ["FREE"]);
});

test("exact safe-integer capacities do not round a division up", () => {
  const units = Number.MAX_SAFE_INTEGER;
  const result = selectMaximumCountTasks(snapshot([
    task("A", units), task("B", units - 1), task("C", 1),
  ], units));
  assert.deepEqual(result.selectedTaskIds, ["B", "C"]);
  assert.equal(result.resources[0].remainingUnits, 0);
});

test("identity, active usage and eligibility violations cannot produce a feasible claim", () => {
  const cases = [
    { ...snapshot([task("A")]), sourceDigest: "stale" },
    snapshot([task("A"), task("A")]),
    snapshot([task("A")], 1, [{ taskId: "A", requirements: [] }]),
    snapshot([task("A", -1)]),
    snapshot([task("A")], 0, [{ taskId: "ACTIVE", requirements: [requirement("WORKER", 1)] }]),
    snapshot([{ ...task("A"), eligibility: "unknown" }]),
    snapshot([{ ...task("A"), requirements: [requirement("UNKNOWN", 1)] }]),
    snapshot([{ ...task("A"), requirements: [requirement("WORKER", 1), requirement("WORKER", 1)] }]),
  ];
  for (const input of cases) assert.throws(() => selectMaximumCountTasks(input));
});

function exhaustive(input) {
  const candidates = input.candidates.filter((item) => item.eligibility === "eligible")
    .sort((a, b) => a.rankGroup - b.rankGroup || (a.taskId < b.taskId ? -1 : 1));
  const groups = [...new Set(candidates.map((item) => item.rankGroup))].sort((a, b) => a - b);
  let best = [];
  let bestScore = [-1];
  for (let mask = 0; mask < 2 ** candidates.length; mask++) {
    const set = candidates.filter((_, index) => (mask & (2 ** index)) !== 0);
    const feasible = input.capacities.every(({ resourceId, units }) =>
      [...input.activeTasks, ...set].reduce((sum, item) => sum +
        (item.requirements.find((value) => value.resourceId === resourceId)?.units ?? 0), 0) <= units);
    if (!feasible) continue;
    const score = [set.length, ...groups.map((group) => set.filter((item) => item.rankGroup === group).length),
      ...candidates.map((item) => Number(set.includes(item)))];
    const decisive = score.findIndex((value, index) => value !== bestScore[index]);
    if (decisive >= 0 && score[decisive] > (bestScore[decisive] ?? -1)) {
      best = set.map((item) => item.taskId);
      bestScore = score;
    }
  }
  return best;
}

test("independent exhaustive oracle verifies count, semantic group preference and ID choices", () => {
  let seed = 48001;
  const random = (limit) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % limit;
  };
  for (let iteration = 0; iteration < 500; iteration++) {
    const input = {
      sourceDigest: digest,
      capacities: [requirement("WORKER", random(7)), requirement("DEVICE", random(5))],
      activeTasks: [],
      candidates: Array.from({ length: 1 + random(9) }, (_, index) => ({
        taskId: `T${index}`, rankGroup: random(3),
        eligibility: ["eligible", "eligible", "eligible", "time_withheld", "assurance_withheld"][random(5)],
        requirements: [requirement("WORKER", random(4)), requirement("DEVICE", random(3))]
          .filter((item) => item.units > 0),
      })),
    };
    assert.deepEqual(selectMaximumCountTasks(input).selectedTaskIds, exhaustive(input), `case ${iteration}`);
    assert.deepEqual(selectMaximumCountTasks({ ...input, candidates: [...input.candidates].reverse() }),
      selectMaximumCountTasks(input), `permutation ${iteration}`);
  }
});

test("real ranking adapter retains all ready candidates beyond the old horizon and applied capacity", () => {
  const source = readFileSync(new URL("./fixtures/recommendation/rec-008-runnable-authority.pert", import.meta.url), "utf8");
  const checked = checkDocument(source);
  assert.equal(checked.ok, true);
  const graph = buildResidualGraph(checked.document);
  const input = { graph, precedence: analyzePrecedence(graph, 100) };
  const eligibility = {
    sourceDigest: `sha256:${createHash("sha256").update(source).digest("hex")}`,
    tasks: new Map([["CRITICAL", "eligible"], ["HIGH_PRIORITY", "eligible"]]),
  };
  assert.deepEqual(selectMaximumCountFromRanking(input, eligibility).selectedTaskIds, ["CRITICAL"]);
  assert.deepEqual(selectMaximumCountFromRanking({ ...input, appliedCapacities: new Map([["REVIEWER", 2]]) }, eligibility)
    .selectedTaskIds, ["CRITICAL", "HIGH_PRIORITY"]);
  assert.throws(() => selectMaximumCountFromRanking(input, { ...eligibility, tasks: new Map() }), /eligibility is missing/u);
});

test("equal-requirement frontier is compressed without dropping tied members or mutating input", () => {
  const input = snapshot(Array.from({ length: 1000 }, (_, i) => task(`T${String(i).padStart(4, "0")}`)), 2);
  const before = JSON.stringify(input);
  const started = performance.now();
  const result = selectMaximumCountTasks(input);
  assert.deepEqual(result.selectedTaskIds, ["T0000", "T0001"]);
  assert.equal(result.boundaryGroups[0].candidates.length, 1000);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(result.boundaryGroups[0].resources[0]), true);
  // Report a measurement; do not make a host-speed assertion part of correctness.
  console.log(`1000-candidate equal-profile elapsed_ms=${(performance.now() - started).toFixed(3)}`);
});

test("diverse profiles that all fit select every candidate without enumerating subsets", () => {
  const candidates = Array.from({ length: 1000 }, (_, index) => task(`T${index}`, index + 1));
  const result = selectMaximumCountTasks(snapshot(candidates, 500500));
  assert.equal(result.maximumTaskCount, 1000);
  assert.equal(result.resources[0].remainingUnits, 0);
  assert.deepEqual(result.boundaryGroups, []);
});

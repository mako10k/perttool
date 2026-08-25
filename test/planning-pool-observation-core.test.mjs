import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import {
  milestoneCriterionSetCommitment,
} from "../dist/milestone-acceptance/source.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";
import {
  observePlanningPool,
  PLANNING_OBSERVATION_CORE_CAPABILITY,
  PLANNING_OBSERVATION_CORE_LIMITS,
} from "../dist/planning-pool/observation.js";

const q = (id) => `POOL::${id}`;

function source() {
  const description = "Reviewed outcome evidence is accepted";
  const criterionCommitment = sha256DigestUtf8(JSON.stringify([
    "Perttool.MilestoneCriterion.v1", "M1", "R1", "ACCEPT", true,
    "observation", description,
  ]));
  const setCommitment = milestoneCriterionSetCommitment("M1", "R1", [{
    criterionId: "ACCEPT",
    required: true,
    evidenceKind: "observation",
    description,
    commitment: criterionCommitment,
  }]);
  return `${[
    "project POOL:",
    "  version 9",
    '  title "Pool"',
    "  as_of 2026-08-25",
    "  duration_unit point",
    "  finish END",
    "",
    "work W1:",
    '  title "Shared complete"',
    '  description "Retain non-DAG rationale"',
    "  milestone_links:",
    "    M1",
    "  task_links:",
    "    T_SHARED",
    "  depends_on:",
    "    W3",
    "",
    "work W2:",
    '  title "Shared and open"',
    "  milestone_links:",
    "    M1",
    "  task_links:",
    "    T_SHARED",
    "    T_OPEN",
    "  depends_on:",
    "    W3",
    "",
    "work W3:",
    '  title "Draft obligation"',
    "  events:",
    "    EV_START",
    "    EV_END",
    "  activities:",
    "    ACT_DRAFT",
    "  depends_on:",
    "    W2",
    "",
    "work W4:",
    '  title "Empty"',
    "",
    "event EV_START:",
    '  title "Draft start"',
    "",
    "event EV_END:",
    '  title "Draft end"',
    "",
    "activity ACT_DRAFT EV_START -> EV_END:",
    '  title "Draft activity"',
    "  duration 1p",
    "",
    "window SPRINT:",
    '  title "Sprint"',
    '  objective "Reach one reviewed outcome"',
    "  start 2026-08-20",
    "  end 2026-09-01",
    "  works:",
    "    W2",
    "    W3",
    "",
    "window RELEASE:",
    '  title "Release"',
    '  objective "Coordinate release evidence"',
    "  start 2026-08-25",
    "  end 2026-09-05",
    "  works:",
    "    W1",
    "    W2",
    "",
    "work_order:",
    "  W1",
    "  W2",
    "  W3",
    "  W4",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "Reviewed"',
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task T_SHARED START -> M1:",
    '  title "Shared task"',
    "  duration 1p",
    "  status done",
    "",
    "task T_OPEN M1 -> END:",
    '  title "Open task"',
    "  duration 1p",
    "",
    "work_event WE_SHARED_FINISH:",
    "  model 1",
    "  task T_SHARED",
    "  kind finish",
    "  occurred_at 2026-08-24T10:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
    "",
    "milestone_criterion_set M1_R1:",
    "  milestone M1",
    "  revision R1",
    `  commitment ${setCommitment}`,
    `  criterion ACCEPT required observation ${JSON.stringify(description)}`,
    "",
    "milestone_acceptance_receipt M1_ACCEPTED:",
    "  model 1",
    "  set M1_R1",
    `  set_commitment ${setCommitment}`,
    "  criterion ACCEPT",
    `  criterion_commitment ${criterionCommitment}`,
    "  action verify",
    "  evidence_kind observation",
    '  evidence_reference "planning observation fixture"',
    "  evidence_revision none",
    "  verifier codex",
    "  occurred_at 2026-08-25T00:00:00Z",
    "",
  ].join("\n")}\n`;
}

function context(text, overrides = {}) {
  return {
    source_digest: sha256DigestUtf8(text),
    evidence_state: "complete",
    recommended_task_ids: [q("T_OPEN")],
    startable_task_ids: [q("T_OPEN")],
    ...overrides,
  };
}

function request(text, selection, overrides = {}) {
  return {
    request_schema_version: "Perttool.PlanningObservationRequest.v1",
    source_digest: sha256DigestUtf8(text),
    selection,
    observation_at: null,
    close_dispositions: [],
    ...overrides,
  };
}

function observe(selection, overrides = {}, text = source(), execution = context(text)) {
  return observePlanningPool(
    text,
    request(text, selection, overrides),
    execution,
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
}

test("PPOC-001 and PPOC-002 fix the private closed and source-bound boundary", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/planning-pool-observation-core-v1.json", "utf8"));
  assert.deepEqual(fixture.cases.map(({ id }) => id), Array.from({ length: 16 }, (_, index) => `PPOC-${String(index + 1).padStart(3, "0")}`));
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.equal(Object.isFrozen(PLANNING_OBSERVATION_CORE_CAPABILITY), true);
  assert.deepEqual(PLANNING_OBSERVATION_CORE_LIMITS, {
    requestUtf8Bytes: 8_388_608,
    derivedEntityRecords: 100_000,
  });
  assert.throws(
    () => observePlanningPool(source(), request(source(), { kind: "pool" }), context(source()), { ...PLANNING_OBSERVATION_CORE_CAPABILITY }),
    /private planning observation Core capability/u,
  );
  const stale = observePlanningPool(source(), {
    ...request(source(), { kind: "pool" }),
    source_digest: `sha256:${"0".repeat(64)}`,
  }, context(source()), PLANNING_OBSERVATION_CORE_CAPABILITY);
  assert.equal(stale.ok, false);
  assert.equal(stale.diagnostics.some(({ code }) => code === "PTPOOL-111"), true);
  const unknownTask = observePlanningPool(
    source(),
    request(source(), { kind: "pool" }),
    context(source(), { recommended_task_ids: [q("UNKNOWN")], startable_task_ids: [] }),
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
  assert.equal(unknownTask.ok, false);
  assert.equal(unknownTask.diagnostics.some(({ code }) => code === "PTPOOL-107"), true);
  const unknown = observePlanningPool(source(), {
    ...request(source(), { kind: "pool" }),
    unexpected: true,
  }, context(source()), PLANNING_OBSERVATION_CORE_CAPABILITY);
  assert.equal(unknown.ok, false);
});

test("PPOC-003 through PPOC-005 keep refinement, lifecycle, and shared Task attribution independent", () => {
  const result = observe({ kind: "work", work_ids: [q("W1"), q("W2"), q("W3")] });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const w1 = result.works.find(({ workId }) => workId === q("W1"));
  const w2 = result.works.find(({ workId }) => workId === q("W2"));
  const w3 = result.works.find(({ workId }) => workId === q("W3"));
  assert.equal(w1.refinement.residualDescriptionPresent, true);
  assert.deepEqual(w1.refinement.uncoveredDependencyIds, []);
  assert.deepEqual(w3.refinement.activityIds, [q("ACT_DRAFT")]);
  assert.equal(w3.execution.state, "partial");
  assert.deepEqual(w3.execution.unprojectedActivityIds, [q("ACT_DRAFT")]);
  assert.deepEqual(w1.execution.tasks[0], {
    taskId: q("T_SHARED"),
    status: "done",
    actualsCoverage: "finish_only",
    workEventIds: [q("WE_SHARED_FINISH")],
    complete: true,
    attribution: "non_exclusive",
  });
  assert.equal(w2.execution.tasks.find(({ taskId }) => taskId === q("T_SHARED")).attribution, "non_exclusive");
  assert.equal(w2.execution.tasks.find(({ taskId }) => taskId === q("T_OPEN")).complete, false);
});

test("PPOC-006 and PPOC-007 reuse authoritative reach and acceptance without per-Work copies", () => {
  const result = observe({ kind: "work", work_ids: [q("W1"), q("W2")] });
  for (const work of result.works) {
    assert.deepEqual(work.outcome.milestones.map(({ milestoneId, closure, acceptance, attribution }) => ({ milestoneId, closure, acceptance, attribution })), [{
      milestoneId: q("M1"),
      closure: "reached",
      acceptance: "accepted",
      attribution: "non_exclusive",
    }]);
    assert.equal(work.outcome.milestones[0].criteria[0].state, "satisfied");
  }
  assert.deepEqual(result.aggregates.uniqueMilestoneIds, [q("M1")]);
  assert.deepEqual(result.aggregates.acceptedMilestoneIds, [q("M1")]);
  assert.equal("complete" in result.works[0], false);
});

test("PPOC-008 through PPOC-010 separate membership occurrences, identity unions, and selected execution", () => {
  const window = observe({ kind: "persisted", window_id: q("SPRINT") });
  assert.equal(window.ok, true, JSON.stringify(window.diagnostics));
  assert.deepEqual(window.selectedWorkOrder, [q("W2"), q("W3")]);
  assert.equal(window.membershipOccurrences.length, 4);
  assert.equal(window.aggregates.membershipOccurrenceCount, 3);
  assert.deepEqual(window.aggregates.uniqueTaskIds, [q("T_OPEN"), q("T_SHARED")]);
  assert.deepEqual(window.aggregates.completedTaskIds, [q("T_SHARED")]);
  assert.equal(window.window.selectedExecution, "partial");

  const complete = observe({
    kind: "ad_hoc", title: null, objective: null, start: null, end: null,
    work_ids: [q("W1")],
  });
  assert.equal(complete.window.selectedExecution, "complete");
  assert.equal(complete.window.window.qualifiedId, null);
  assert.equal(complete.aggregates.uniqueTaskIds.length, 1);
});

test("PPOC-011 and PPOC-012 observe half-open time and return objective without achievement", () => {
  const fallback = observe({ kind: "persisted", window_id: q("SPRINT") });
  assert.deepEqual(fallback.window.temporalPosition, {
    state: "inside",
    observationValue: "2026-08-25",
    source: "project_as_of",
    cause: null,
  });
  assert.equal(fallback.window.objective, "Reach one reviewed outcome");
  assert.equal("objectiveAchieved" in fallback.window, false);
  assert.deepEqual(fallback.window.temporalOverlaps, [{
    windowId: q("RELEASE"),
    state: "overlap",
    intersectionStart: "2026-08-25",
    intersectionEnd: "2026-09-01",
    cause: null,
  }]);

  const after = observe({ kind: "persisted", window_id: q("SPRINT") }, { observation_at: "2026-09-01" });
  assert.equal(after.window.temporalPosition.state, "after");
  const unavailable = observe({ kind: "persisted", window_id: q("SPRINT") }, { observation_at: "2026-08-25T00:00:00+09:00" });
  assert.equal(unavailable.window.temporalPosition.state, "unavailable");
});

test("PPOC-013 and PPOC-014 retain dependency organization and require explicit close disposition", () => {
  const result = observe({ kind: "pool" }, {
    close_dispositions: [
      { work_id: q("W1"), disposition: "retained_backlog" },
      { work_id: q("W4"), disposition: "archive_requested" },
    ],
  });
  const w2 = result.works.find(({ workId }) => workId === q("W2"));
  const w3 = result.works.find(({ workId }) => workId === q("W3"));
  const w4 = result.works.find(({ workId }) => workId === q("W4"));
  assert.deepEqual(w2.organization.dependencyCycleIds, [q("W2"), q("W3")]);
  assert.deepEqual(w3.organization.dependencyCycleIds, [q("W2"), q("W3")]);
  assert.equal(w4.organization.archiveable, true);
  assert.equal(w4.closeDisposition, "archive_requested");
  assert.equal(w2.closeDisposition, "not_applicable");
  assert.equal(result.works.find(({ workId }) => workId === q("W1")).closeDisposition, "retained_backlog");
});

test("PPOC-015 keeps incomplete global facts explicit and fails closed on unavailable strict evidence", () => {
  const text = source();
  const incomplete = observePlanningPool(
    text,
    request(text, { kind: "pool" }),
    context(text, { evidence_state: "incomplete", startable_task_ids: [] }),
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
  assert.equal(incomplete.ok, true);
  assert.equal(incomplete.evidence.state, "incomplete");
  assert.equal(incomplete.globalExecution.evidenceState, "incomplete");
  assert.deepEqual(incomplete.globalExecution.recommendedTaskIds, [q("T_OPEN")]);
  const unavailable = observePlanningPool(
    text,
    request(text, { kind: "pool" }),
    context(text, { evidence_state: "unavailable", recommended_task_ids: [], startable_task_ids: [] }),
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
  assert.equal(unavailable.ok, true);
  assert.equal(unavailable.globalExecution.evidenceState, "unavailable");

  const invalid = text.replace("  status done", "  status active");
  const failed = observePlanningPool(
    invalid,
    request(invalid, { kind: "pool" }),
    context(invalid),
    PLANNING_OBSERVATION_CORE_CAPABILITY,
  );
  assert.equal(failed.ok, false);
  assert.equal(failed.evidence.state, "unavailable");
});

test("PPOC-016 keeps every public runtime facade unchanged and defers history", () => {
  for (const name of [
    "observePlanningPool",
    "PLANNING_OBSERVATION_CORE_CAPABILITY",
    "PLANNING_OBSERVATION_CORE_LIMITS",
    "PlanningPoolResult",
    "PlanningObservationRequest",
  ]) {
    assert.equal(name in rootApi, false, `root:${name}`);
    assert.equal(name in nodeApi, false, `node:${name}`);
    assert.equal(name in coreApi, false, `core:${name}`);
  }
  const result = observe({ kind: "pool" });
  assert.deepEqual(result.evidence, {
    mode: "current",
    state: "complete",
    sourceDigest: sha256DigestUtf8(source()),
    historyRequested: false,
  });
  assert.equal(result.schemaVersion, "Perttool.PlanningPoolResult.v1");
  assert.equal(result.observationCapability, "perttool.planning-observation-core@1");
});

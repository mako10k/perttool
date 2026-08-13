import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  observeTargetProjectVelocity,
  renderTargetVelocityObservationText,
  targetVelocityObservationResultToJson,
} from "../dist/application/target-velocity-observation.js";
import {
  projectDeclaredCalendarValue,
} from "../dist/model/target-calendar.js";

function timestamp(source) {
  const value = projectDeclaredCalendarValue(source);
  assert.notEqual(value, null, source);
  return value;
}

function quantity(numerator, denominator, unit) {
  return {
    numerator: String(numerator),
    denominator: String(denominator),
    unit,
    display: denominator === 1
      ? String(numerator)
      : String(Number(numerator) / Number(denominator)),
  };
}

function task({
  id,
  start = "2026-07-28T09:00:00+09:00",
  finish = "2026-07-28T12:00:00+09:00",
  points = [3, 1],
  effort = [4, 1],
  coverage = "complete",
  baselineSource = "start_baseline",
  baselineCommitId,
  suspensions = [],
} = {}) {
  return {
    taskId: id,
    coverage,
    eventIds: coverage === "unrecorded"
      ? []
      : [`WE-${id}-start`, `WE-${id}-finish`],
    firstStart:
      coverage === "complete" ? timestamp(start) : null,
    lastFinish:
      coverage === "complete" || coverage === "finish_only"
        ? timestamp(finish)
        : null,
    suspensionIntervals: suspensions.map((suspension, index) => ({
      suspendEventId: `WE-${id}-suspend-${index}`,
      resumeEventId:
        suspension.finish === null ? null : `WE-${id}-resume-${index}`,
      start: timestamp(suspension.start),
      finish:
        suspension.finish === null ? null : timestamp(suspension.finish),
      duration: null,
    })),
    cycleTime: coverage === "complete" ? quantity(3, 1, "hour") : null,
    derivedActiveTime:
      coverage === "complete" ? quantity(3, 1, "hour") : null,
    explicitActiveTime: null,
    effort:
      effort === null ? null : quantity(effort[0], effort[1], "person_hour"),
    plannedValue:
      points === null ? null : quantity(points[0], points[1], "point"),
    baselineSource: points === null ? null : baselineSource,
    baselineEventId:
      points === null || baselineSource === "finish_snapshot"
        ? null
        : `WE-${id}-start`,
    baselineCommitId:
      points === null ? null : baselineCommitId ?? `commit-${id}`,
    qualifiers:
      baselineSource === "finish_snapshot" ? ["finish_snapshot"] : [],
    unavailableCauses: [],
  };
}

function transition(taskId, fromState, toState, occurredAt, suffix) {
  return {
    taskId,
    fromState,
    toState,
    commitId: `commit-${taskId}-${suffix}`,
    recordedAt: timestamp(occurredAt),
    sourceDigest: `sha256:${suffix}`,
    evidenceClass: "git_recorded_transition",
  };
}

function history({
  tasks,
  transitions = [],
  status = "complete",
  ok = true,
  diagnostics = [],
}) {
  return {
    ok,
    modelVersion: 1,
    documentId: "OBSERVATION",
    grammarVersion: 5,
    history: {
      id: "perttool.project-history",
      version: 1,
      status,
      traversal: "first_parent",
      repositorySnapshotId: "sha1:HEAD",
      repositoryRelativePath: "plans/observation.pert",
      requestedRevision: "HEAD",
      resolvedRevision: "0123456789abcdef",
      sourceDigest: "sha256:observation",
      inspectedCommitIds: ["0123456789abcdef"],
      unavailableCauses: [],
    },
    events: [],
    gitRecordedTransitions: transitions,
    tasks,
    diagnostics,
  };
}

function candidate(result, measure) {
  return result.observation.candidates.find(
    (value) => value.measure === measure,
  );
}

test("parallel completed work yields one exact window and separate effort productivity", () => {
  const input = history({
    tasks: [
      task({ id: "B" }),
      task({ id: "A" }),
    ],
  });
  const before = JSON.stringify(input);
  const result = observeTargetProjectVelocity(input, {
    evidence: "declared",
  });

  assert.equal(result.schemaVersion, "Perttool.VelocityObservationResult.v1");
  assert.equal(result.ok, true);
  assert.deepEqual(result.observation.selectedTaskIds, ["A", "B"]);
  assert.deepEqual(
    result.observation.candidates.map(({ measure }) => measure),
    [
      "elapsed_hour_throughput",
      "active_date_throughput",
      "effort_productivity",
    ],
  );

  const elapsed = candidate(result, "elapsed_hour_throughput");
  assert.equal(elapsed.state, "available");
  assert.deepEqual(
    [elapsed.numerator.numerator, elapsed.denominator.numerator],
    ["6", "3"],
  );
  assert.deepEqual(elapsed.rate, {
    numerator: "2",
    denominator: "1",
    unit: "point_per_hour",
  });
  assert.equal(elapsed.adoptableVelocityToken, "2p/1h");
  assert.deepEqual(elapsed.includedTaskIds, ["A", "B"]);

  const activeDate = candidate(result, "active_date_throughput");
  assert.equal(activeDate.state, "available");
  assert.equal(activeDate.denominator.numerator, "1");
  assert.deepEqual(activeDate.rate, {
    numerator: "6",
    denominator: "1",
    unit: "point_per_day",
  });
  assert.equal(activeDate.adoptableVelocityToken, "6p/1d");

  const effort = candidate(result, "effort_productivity");
  assert.equal(effort.state, "available");
  assert.equal(effort.denominator.numerator, "8");
  assert.deepEqual(effort.rate, {
    numerator: "3",
    denominator: "4",
    unit: "point_per_person_hour",
  });
  assert.equal(effort.adoptableVelocityToken, null);
  assert.equal(JSON.stringify(input), before);

  const json = targetVelocityObservationResultToJson(
    result,
    "plans/observation.pert",
  );
  assert.equal(json.cli_contract_version, 7);
  assert.equal(json.source_digest, "sha256:observation");
  assert.equal(
    json.observation.candidates[0].adoptable_velocity_token,
    "2p/1h",
  );
  const text = renderTargetVelocityObservationText(result);
  assert.equal(text, renderTargetVelocityObservationText(result));
  assert.match(text, /^OBSERVATION evidence=declared/m);
  assert.match(text, /source_digest=sha256:observation/u);
  assert.match(text, /history_source_digest=sha256:observation/u);
  assert.match(
    text,
    /^VELOCITY_CANDIDATE id=declared_elapsed_hour_throughput/m,
  );
});

test("active-date observation uses evidenced dates and fails closed on offset or interval gaps", () => {
  const exactDates = observeTargetProjectVelocity(
    history({
      tasks: [
        task({
          id: "LONG",
          start: "2026-07-28T23:00:00+09:00",
          finish: "2026-07-30T00:00:00+09:00",
          effort: null,
        }),
      ],
    }),
  );
  assert.equal(
    candidate(exactDates, "elapsed_hour_throughput").denominator.numerator,
    "25",
  );
  assert.equal(
    candidate(exactDates, "active_date_throughput").denominator.numerator,
    "2",
  );

  const mixed = observeTargetProjectVelocity(
    history({
      tasks: [
        task({ id: "JST" }),
        task({
          id: "UTC",
          start: "2026-07-28T00:00:00+00:00",
          finish: "2026-07-28T03:00:00+00:00",
        }),
      ],
    }),
  );
  assert.equal(
    candidate(mixed, "elapsed_hour_throughput").state,
    "available",
  );
  assert.equal(
    candidate(mixed, "active_date_throughput").state,
    "unavailable",
  );
  assert.deepEqual(
    candidate(mixed, "active_date_throughput").unavailableCauses.map(
      ({ cause }) => cause,
    ),
    ["mixed_offsets"],
  );

  const incomplete = observeTargetProjectVelocity(
    history({
      tasks: [
        task({
          id: "OPEN_INTERVAL",
          suspensions: [{
            start: "2026-07-28T10:00:00+09:00",
            finish: null,
          }],
        }),
      ],
    }),
  );
  const activeDate = candidate(incomplete, "active_date_throughput");
  assert.equal(activeDate.state, "unavailable");
  assert.deepEqual(activeDate.includedTaskIds, []);
  assert.deepEqual(
    activeDate.unavailableCauses.map(({ cause }) => cause),
    ["incomplete_active_intervals"],
  );
});

test("finish-only samples contribute only explicit effort with snapshot qualification", () => {
  const result = observeTargetProjectVelocity(
    history({
      tasks: [
        task({
          id: "FINISH_ONLY",
          coverage: "finish_only",
          baselineSource: "finish_snapshot",
          points: [4, 1],
          effort: [5, 2],
        }),
        task({
          id: "NO_EFFORT",
          effort: null,
        }),
      ],
    }),
  );
  assert.equal(
    candidate(result, "elapsed_hour_throughput").includedTaskIds.includes(
      "FINISH_ONLY",
    ),
    false,
  );
  const effort = candidate(result, "effort_productivity");
  assert.equal(effort.state, "available");
  assert.deepEqual(effort.includedTaskIds, ["FINISH_ONLY"]);
  assert.deepEqual(effort.qualifiers, ["finish_snapshot"]);
  assert.deepEqual(effort.rate, {
    numerator: "8",
    denominator: "5",
    unit: "point_per_person_hour",
  });
  assert.deepEqual(
    effort.excluded[0].causes.map(({ cause }) => cause),
    ["missing_effort"],
  );
});

test("Git-recorded throughput remains separate and never becomes adoptable actual velocity", () => {
  const legacy = task({
    id: "LEGACY",
    coverage: "unrecorded",
    baselineSource: "finish_snapshot",
    baselineCommitId: "commit-LEGACY-done",
    points: [6, 1],
    effort: null,
  });
  const input = history({
    tasks: [legacy],
    transitions: [
      transition(
        "LEGACY",
        "planned",
        "active",
        "2026-07-28T09:00:00+09:00",
        "active",
      ),
      transition(
        "LEGACY",
        "active",
        "done",
        "2026-07-28T12:00:00+09:00",
        "done",
      ),
    ],
  });
  const result = observeTargetProjectVelocity(input, { evidence: "all" });
  assert.deepEqual(
    result.observation.candidates.map(({ measure }) => measure),
    [
      "elapsed_hour_throughput",
      "active_date_throughput",
      "effort_productivity",
      "git_recorded_elapsed_hour_throughput",
    ],
  );
  const recorded = candidate(
    result,
    "git_recorded_elapsed_hour_throughput",
  );
  assert.equal(recorded.state, "available");
  assert.deepEqual(recorded.rate, {
    numerator: "2",
    denominator: "1",
    unit: "point_per_hour",
  });
  assert.equal(recorded.adoptableVelocityToken, null);
  assert.deepEqual(recorded.qualifiers, ["recorded_not_actual"]);
  assert.equal(recorded.evidenceClass, "git_recorded_transition");
  assert.deepEqual(
    result.observation.candidates[0].includedTaskIds,
    [],
  );
});

test("selection and history availability are typed without guessing", () => {
  const input = history({ tasks: [task({ id: "A" })] });
  for (const [request, cause] of [
    [{ taskIds: ["A", "A"] }, "duplicate_task"],
    [{ taskIds: ["UNKNOWN"] }, "unknown_task"],
    [{ evidence: "future" }, "unsupported_evidence"],
  ]) {
    const result = observeTargetProjectVelocity(input, request);
    assert.equal(result.ok, false);
    assert.deepEqual(
      result.diagnostics.map(({ code, data }) => [code, data.cause]),
      [["PTOBS-101", cause]],
    );
    assert.deepEqual(result.observation.candidates, []);
  }

  const incomplete = observeTargetProjectVelocity(
    history({
      tasks: [task({ id: "A" })],
      status: "incomplete",
      diagnostics: [{
        code: "PTHIS-102",
        severity: "warning",
        message: "history incomplete",
      }],
    }),
  );
  assert.equal(incomplete.ok, true);
  assert.equal(
    candidate(incomplete, "elapsed_hour_throughput").state,
    "unavailable",
  );
  assert.deepEqual(
    candidate(incomplete, "elapsed_hour_throughput").unavailableCauses.map(
      ({ cause }) => cause,
    ),
    ["history_incomplete"],
  );

  const empty = observeTargetProjectVelocity(input, { taskIds: [] });
  assert.equal(
    candidate(empty, "elapsed_hour_throughput").state,
    "unavailable",
  );
  assert.deepEqual(
    candidate(empty, "elapsed_hour_throughput").unavailableCauses.map(
      ({ cause }) => cause,
    ),
    ["no_selected_tasks"],
  );
});

test("target composition preserves incomplete-history warning without suppressing current declared evidence", () => {
  const recordedHistory = history({
    tasks: [task({ id: "A" })],
    status: "incomplete",
    diagnostics: [{
      code: "PTHIS-102",
      severity: "warning",
      message: "history incomplete",
    }],
  });
  const currentActuals = history({ tasks: [task({ id: "A" })] });
  const result = observeTargetProjectVelocity(
    recordedHistory,
    { evidence: "declared" },
    {
      currentActuals,
      currentSourceDigest: "sha256:current",
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.sourceDigest, "sha256:current");
  assert.equal(result.history.status, "incomplete");
  assert.equal(result.history.sourceDigest, "sha256:observation");
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTHIS-102"]);
  assert.equal(
    candidate(result, "elapsed_hour_throughput").state,
    "available",
  );
});

test("velocity observation is public without target-prefixed package exports", () => {
  for (const name of [
    "observeProjectVelocity",
    "velocityObservationResultToJson",
    "renderVelocityObservationText",
  ]) {
    assert.equal(name in publicApi, true, name);
  }
  for (const name of [
    "observeTargetProjectVelocity",
    "targetVelocityObservationResultToJson",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
});

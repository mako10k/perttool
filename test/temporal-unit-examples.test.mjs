import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function baseline() {
  return JSON.parse(
    await readFile(path.join(fixtureDirectory, "cases.json"), "utf8"),
  );
}

function byId(document, caseId) {
  const result = document.cases.find(
    (candidate) => candidate.case_id === caseId,
  );
  assert.ok(result, caseId);
  return result;
}

test("temporal/unit examples publish one contiguous machine baseline", async () => {
  const document = await baseline();
  const examples = await repositoryFile("docs/examples/temporal-units.md");
  const requirements = await repositoryFile("docs/requirements.md");

  assert.equal(
    document.schema_version,
    "Perttool.TemporalUnitExampleBaseline.v2",
  );
  assert.deepEqual(document.target_contract, {
    grammar_version: 3,
    cli_contract_version: 4,
    interface: {
      id: "perttool.temporal-unit-interface",
      version: 2,
    },
    calendar: {
      id: "perttool.calendar-projection",
      version: 1,
      profile_id: "perttool.calendar.continuous-fixed-offset",
      profile_version: 1,
    },
    deadline: {
      id: "perttool.deadline-evaluation",
      version: 1,
    },
    unit_migration: {
      id: "perttool.unit-migration",
      version: 2,
    },
    unit_migration_result: "Perttool.UnitMigrationResult.v2",
  });

  const expectedIds = Array.from(
    { length: 20 },
    (_, index) => `TUE-${String(index + 1).padStart(3, "0")}`,
  );
  assert.deepEqual(
    document.cases.map((example) => example.case_id),
    expectedIds,
  );
  for (const caseId of expectedIds) {
    assert.match(examples, new RegExp(`### ${caseId} `));
  }
  assert.match(
    requirements,
    /- \[x\] \[Normative boundary examples and machine-readable acceptance cases\]\(examples\/temporal-units\.md\)/,
  );
});

test("every target source fixture is explicit Grammar 2 input", async () => {
  const document = await baseline();
  const fixtureNames = [
    ...new Set(
      document.cases
        .map((example) => example.fixture)
        .filter((fixture) => fixture !== undefined),
    ),
  ].sort();

  assert.deepEqual(fixtureNames, [
    "calendar-date-v2.pert",
    "calendar-offset-v2.pert",
    "deadline-blocked-v2.pert",
    "deadline-complete-v2.pert",
    "deadline-resource-v2.pert",
    "migration-hour-v2.pert",
    "migration-nonrepresentable-v2.pert",
    "migration-point-v2.pert",
    "mixed-kind-v2.pert",
  ]);

  for (const fixtureName of fixtureNames) {
    const source = await readFile(
      path.join(fixtureDirectory, fixtureName),
      "utf8",
    );
    assert.match(source, /^project [A-Z][A-Z0-9_]*:/);
    assert.match(source, /^  version 2$/m);
    assert.match(source, /^  as_of /m);
    assert.match(source, /^  finish [A-Z][A-Z0-9_]*$/m);
  }
});

test("calendar cases fix validation, exact release, offsets, and start authority", async () => {
  const document = await baseline();

  assert.deepEqual(
    byId(document, "TUE-001").expected.diagnostic_code_by_field,
    {
      "milestone.deadline": "PTDSL-005",
      "task.not_before": "PTDSL-005",
      "task.deadline": "PTDSL-005",
    },
  );
  assert.deepEqual(
    byId(document, "TUE-002").expected.diagnostic_code_by_field,
    {
      "milestone.deadline": "PTSEM-112",
      "task.not_before": "PTSEM-112",
      "task.deadline": "PTSEM-112",
    },
  );
  assert.deepEqual(
    byId(document, "TUE-003").expected.diagnostic_code_by_literal,
    {
      "2026-02-29": "PTDSL-008",
      "2026-07-25T10:00:00": "PTDSL-008",
      "2026-07-25T10:00:60Z": "PTDSL-008",
    },
  );

  const leap = byId(document, "TUE-004").expected;
  assert.deepEqual(leap.release_bound, {
    numerator: "1",
    denominator: "1",
    unit: "day",
  });
  assert.equal(leap.precedence.finish_calendar, "2028-03-02");
  assert.equal(leap.precedence.assessment, "lower_bound_late");
  assert.equal(leap.resource.optimal, false);
  assert.equal(leap.combined_assessment, "forecast_infeasible");
  assert.deepEqual(leap.next_authority, {
    structurally_ready_task_ids: ["LEAP_WINDOW"],
    recommendation_task_ids: ["LEAP_WINDOW"],
    runnable_now_task_ids: [],
    startable_recommended_task_ids: [],
    delayed_recommended_task_ids: ["LEAP_WINDOW"],
    time_eligibility: "not_yet_eligible",
    explanation_code: "not_before_future",
  });

  const offsets = byId(document, "TUE-005").expected;
  assert.equal(offsets.release_bound, "0/1h");
  assert.equal(offsets.destination_relationship, "same_deadline");
  assert.equal(offsets.declared_source_text_preserved, true);
  assert.deepEqual(offsets.next_authority, {
    runnable_now_task_ids: ["OFFSET_EQUAL"],
    startable_recommended_task_ids: ["OFFSET_EQUAL"],
    time_eligibility: "eligible",
    explanation_code: "not_before_reached",
  });

  const authority = byId(document, "TUE-006").expected;
  assert.deepEqual(authority.structurally_ready_task_ids, ["FUTURE_CLOCK"]);
  assert.deepEqual(authority.recommendation_task_ids, ["FUTURE_CLOCK"]);
  assert.deepEqual(authority.runnable_now_task_ids, []);
  assert.deepEqual(authority.startable_recommended_task_ids, []);
  assert.deepEqual(authority.unavailable_causes, [
    "incomparable_temporal_kinds",
  ]);
  assert.equal(authority.classification, "ready");
  assert.equal(authority.deadline_facts_used_for_ranking, false);
  assert.equal(authority.combined_assessment, "unavailable");
});

test("deadline cases keep proof, heuristic, block, and history meanings separate", async () => {
  const document = await baseline();

  const inclusive = byId(document, "TUE-008").expected;
  assert.deepEqual(inclusive.forecast_relation_and_margin, {
    completion_before_deadline: {
      relation: "before_deadline",
      signed_margin: "1/1 calendar_days",
    },
    completion_on_deadline: {
      relation: "on_deadline",
      signed_margin: "0/1 calendar_days",
    },
    completion_after_deadline: {
      relation: "after_deadline",
      signed_margin: "-1/1 calendar_days",
    },
  });
  assert.deepEqual(inclusive.destination_relationship_by_pair, {
    "task_2026-07-24__milestone_2026-07-25":
      "task_deadline_before_milestone",
    "task_2026-07-25__milestone_2026-07-25": "same_deadline",
    "task_2026-07-26__milestone_2026-07-25":
      "task_deadline_after_milestone",
    task_date__milestone_date_time: "unavailable",
    "task_2026-07-25__milestone_absent": "deadline_absent",
  });
  assert.deepEqual(inclusive.deadline_absent, {
    deadline_evaluation_present: false,
    temporal_schedule_state: "available",
  });
  assert.deepEqual(inclusive.combined_state_witnesses, {
    incomplete_and_current_overdue: "overdue",
    precedence_on_time_and_resource_unavailable: "not_proven_late",
    all_forecast_relationships_unavailable: "unavailable",
  });

  const resource = byId(document, "TUE-009").expected;
  assert.equal(resource.precedence.assessment, "lower_bound_on_time");
  assert.equal(resource.resource.assessment, "heuristic_late");
  assert.equal(resource.resource.optimal, false);
  assert.equal(resource.combined_assessment, "at_risk");
  assert.equal(resource.proof_of_infeasibility, false);

  const blocked = byId(document, "TUE-010").expected;
  assert.equal(blocked.conditional_on_blocks_resolved, true);
  assert.deepEqual(blocked.blocked_task_ids, ["BLOCKED_INPUT"]);
  assert.equal(blocked.invented_block_duration, false);

  const complete = byId(document, "TUE-011").expected;
  assert.equal(
    complete.completion_state,
    "complete_actual_time_unavailable",
  );
  assert.equal(complete.current_state, "not_applicable");
  assert.equal(complete.actual_completion_inferred, false);
  assert.equal(complete.time_eligibility, "not_applicable");
  assert.equal(
    complete.time_eligibility_explanation_code,
    "task_already_started",
  );
});

test("migration cases fix exact inventory, grammar upgrade, idempotence, and inverse", async () => {
  const document = await baseline();

  const pointToDay = byId(document, "TUE-012").expected;
  assert.equal(pointToDay.velocity_disposition, "retained");
  assert.equal(pointToDay.grammar_disposition, "retained");
  assert.deepEqual(pointToDay.converted_tokens_by_field, {
    "project.critical_epsilon": "0.25d",
    "project.target_duration": "6d",
    "task.FIXED.duration": "2d",
    "task.ESTIMATED.estimate.optimistic": "1d",
    "task.ESTIMATED.estimate.most_likely": "2d",
    "task.ESTIMATED.estimate.pessimistic": "3d",
  });
  assert.equal(pointToDay.reversibility, "exact");
  assert.deepEqual(pointToDay.temporal_tokens_by_field, {
    "project.as_of": "2026-07-25T09:00:00+09:00",
    "milestone.MID.deadline": "2026-07-27T09:00:00+09:00",
    "milestone.FINISH.deadline": "2026-07-30T09:00:00+09:00",
    "task.FIXED.not_before": "2026-07-25T09:00:00+09:00",
    "task.FIXED.deadline": "2026-07-27T09:00:00+09:00",
    "task.ESTIMATED.deadline": "2026-07-30T09:00:00+09:00",
  });

  const hourToPoint = byId(document, "TUE-013").expected;
  assert.equal(hourToPoint.velocity_disposition, "inserted");
  assert.equal(hourToPoint.grammar_disposition, "retained");
  assert.equal(
    hourToPoint.converted_tokens_by_field["task.FIXED.duration"],
    "5p",
  );
  assert.equal(
    hourToPoint.reversibility,
    "values_exact_metadata_changed",
  );
  assert.deepEqual(hourToPoint.temporal_tokens_by_field, {
    "project.as_of": "2026-07-25T09:00:00Z",
    "milestone.MID.deadline": "2026-07-25T11:30:00Z",
    "milestone.FINISH.deadline": "2026-07-25T14:30:00Z",
    "task.FIXED.not_before": "2026-07-25T09:00:00Z",
    "task.FIXED.deadline": "2026-07-25T11:30:00Z",
    "task.ESTIMATED.deadline": "2026-07-25T14:30:00Z",
  });

  const failures = byId(document, "TUE-014").expected;
  assert.deepEqual(failures.diagnostic_codes, [
    "PTMIG-405",
    "PTMIG-404",
    "PTMIG-405",
    "PTMIG-406",
  ]);
  assert.equal(failures.partial_candidate_exposed, false);

  const rational = byId(document, "TUE-015").expected;
  assert.equal(rational.ok, true);
  assert.equal(rational.source_grammar_version, 2);
  assert.equal(rational.target_grammar_version, 3);
  assert.equal(
    rational.grammar_disposition,
    "upgraded_for_exact_fraction",
  );
  assert.deepEqual(rational.converted_tokens_by_field, {
    "project.critical_epsilon": "1/3d",
    "project.target_duration": "2/3d",
    "task.FIXED.duration": "1/3d",
    "task.ESTIMATED.estimate.optimistic": "1/3d",
    "task.ESTIMATED.estimate.most_likely": "2/3d",
    "task.ESTIMATED.estimate.pessimistic": "1d",
  });
  assert.equal(rational.reversibility, "values_exact_metadata_changed");
  assert.equal(rational.candidate_exposed, true);
  assert.equal(rational.ptmig_408_emitted, false);

  const idempotent = byId(document, "TUE-016").expected;
  assert.equal(idempotent.changed, false);
  assert.deepEqual(idempotent.edits, []);
  assert.equal(idempotent.rescaled_again, false);

  const inverse = byId(document, "TUE-017").expected;
  assert.equal(inverse.exact_duration_values_restored, true);
  assert.equal(inverse.temporal_source_tokens_byte_equal, true);
  assert.equal(inverse.original_token, "4.00p");
  assert.equal(inverse.inverse_token, "4p");
  assert.equal(inverse.whole_document_byte_equal, false);
});

test("Grammar 3 cases fix exact Duration compatibility and malformed input", async () => {
  const document = await baseline();
  const exact = byId(document, "TUE-019").expected;

  assert.deepEqual(exact.exact_and_canonical_by_literal, {
    "1d": { exact: "1/1d", canonical: "1d" },
    "0.5d": { exact: "1/2d", canonical: "0.5d" },
    "1/3d": { exact: "1/3d", canonical: "1/3d" },
    "4/6d": { exact: "2/3d", canonical: "2/3d" },
    "0/7d": { exact: "0/1d", canonical: "0d" },
  });
  assert.equal(exact.grammar_2_fraction_diagnostic, "PTDSL-007");
  assert.equal(exact.rounded, false);

  const malformed = byId(document, "TUE-020");
  assert.deepEqual(malformed.input.invalid_duration_literals, [
    "1/0d",
    "-1/3d",
    "1/-3d",
    "1 /3d",
    "1/ 3d",
    "1.5/3d",
    "1/3.0d",
    "1/2/3d",
  ]);
  assert.equal(malformed.expected.diagnostic_code, "PTDSL-007");
  assert.equal(malformed.expected.candidate, null);
  assert.equal(malformed.expected.rational_arithmetic_reached, false);
});

test("projection case fixes schema, semantic ordering, labels, and determinism", async () => {
  const projection = byId(await baseline(), "TUE-018").expected;

  assert.deepEqual(projection.json, {
    check_schema: "Perttool.CheckResult.v2",
    project_schema: "Perttool.ProjectResult.v2",
    analysis_schema: "Perttool.AnalysisResult.v3",
    next_schema: "Perttool.NextResult.v4",
    unit_migration_schema: "Perttool.UnitMigrationResult.v2",
    cli_contract_version: 4,
    declared_temporal_order: [
      "project:CALENDAR_OFFSET.as_of",
      "milestone:FINISH.deadline",
      "task:OFFSET_EQUAL.not_before",
      "task:OFFSET_EQUAL.deadline",
    ],
    deadline_subject_order: [
      "task:OFFSET_EQUAL",
      "milestone:FINISH",
    ],
    paired_view_order: ["precedence", "resource"],
  });
  assert.deepEqual(projection.text.analysis_section_order, [
    "TEMPORAL PRECEDENCE",
    "TEMPORAL RESOURCE",
    "DEADLINES",
  ]);
  assert.equal(projection.text.next_first_section, "START AUTHORITY");
  assert.equal(projection.text.next_last_section, "TEMPORAL CONTEXT");
  assert.equal(projection.text.resource_qualification, "optimal=false");
  assert.equal(projection.repeat_byte_equal, true);
  assert.equal(projection.text_and_json_same_core_result, true);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  historicalOccurrenceId,
  projectHistoricalTransitionModel,
  projectHistoricalTransitionSequence,
  classifyHistoricalTransition,
} from "../dist/history/historical-transition.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar6Document,
} from "../dist/semantic/target-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const commits = ["1", "2", "3", "4"].map((digit) => digit.repeat(40));

function diagnosticText(result) {
  return result.diagnostics
    .map(({ code, message }) => `${code} ${message}`)
    .join("; ");
}

function projection(source) {
  const checked = validateTargetGrammar6Document(
    source,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(checked.ok, true, diagnosticText(checked));
  assert.notEqual(checked.validatedDocument, null);
  return projectHistoricalTransitionModel(checked.validatedDocument);
}

function plannedSource({
  duration = "1/3p",
  title = "Work",
  representation = false,
} = {}) {
  const lines = representation
    ? [
        "# representation-only variant",
        "project P:",
        "  title \"Plan\"",
        "  version 5",
        "  duration_unit point",
        "  as_of 2026-08-06",
        "  finish END",
        "  velocity 1.0p/1.0d",
        "",
        "milestone END:",
        "  title \"End\"",
        "",
        "milestone START:",
        "  state reached",
        "  title \"Start\"",
        "",
        "task T START -> END:",
        `  duration ${duration}`,
        `  title ${JSON.stringify(title)}`,
      ]
    : [
        "project P:",
        "  version 5",
        "  title \"Plan\"",
        "  as_of 2026-08-06",
        "  duration_unit point",
        "  velocity 1p/1d",
        "  finish END",
        "",
        "milestone START:",
        "  title \"Start\"",
        "  state reached",
        "",
        "milestone END:",
        "  title \"End\"",
        "",
        "task T START -> END:",
        `  title ${JSON.stringify(title)}`,
        `  duration ${duration}`,
      ];
  return `${lines.join(representation ? "\r\n" : "\n")}${
    representation ? "\r\n" : "\n"
  }`;
}

function activeSource({
  title = "Work",
  startAt = "2026-08-06T10:00:00+09:00",
  includePause = false,
} = {}) {
  return `${[
    "project P:",
    "  version 5",
    "  title \"Plan\"",
    "  as_of 2026-08-06",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish END",
    "",
    "milestone START:",
    "  title \"Start\"",
    "  state reached",
    "",
    "milestone END:",
    "  title \"End\"",
    "",
    "task T START -> END:",
    `  title ${JSON.stringify(title)}`,
    "  duration 1p",
    "  status active",
    "",
    "work_event WE_START:",
    "  model 1",
    "  task T",
    "  kind start",
    `  occurred_at ${startAt}`,
    "  planned_value 1p",
    ...(includePause
      ? [
          "",
          "work_event WE_SUSPEND:",
          "  model 1",
          "  task T",
          "  kind suspend",
          "  occurred_at 2026-08-06T10:15:00+09:00",
          "  reason \"pause\"",
          "",
          "work_event WE_RESUME:",
          "  model 1",
          "  task T",
          "  kind resume",
          "  occurred_at 2026-08-06T10:30:00+09:00",
        ]
      : []),
  ].join("\n")}\n`;
}

function advanceSource() {
  return `${[
    "project ADVANCE:",
    "  version 5",
    "  title \"Advance\"",
    "  as_of 2026-08-06",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish DONE",
    "",
    "milestone START:",
    "  title \"Start\"",
    "  state reached",
    "",
    "milestone DONE:",
    "  title \"Done\"",
    "",
    "task WORK START -> DONE:",
    "  title \"Work\"",
    "  duration 1p",
    "  status done",
    "",
    "work_event WE_START:",
    "  model 1",
    "  task WORK",
    "  kind start",
    "  occurred_at 2026-08-06T10:00:00+09:00",
    "  planned_value 1p",
    "",
    "work_event WE_FINISH:",
    "  model 1",
    "  task WORK",
    "  kind finish",
    "  occurred_at 2026-08-06T11:00:00+09:00",
    "  active_time 1h",
    "  effort 1ph",
  ].join("\n")}\n`;
}

function parallelSource({ includeTask = true, taskTitle = "Optional" } = {}) {
  return `${[
    "project EPOCHS:",
    "  version 5",
    "  title \"Epochs\"",
    "  as_of 2026-08-06",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish END",
    "",
    "milestone START:",
    "  title \"Start\"",
    "  state reached",
    "",
    "milestone END:",
    "  title \"End\"",
    "",
    "task KEEP START -> END:",
    "  title \"Keep\"",
    "  duration 1p",
    ...(includeTask
      ? [
          "",
          "task T START -> END:",
          `  title ${JSON.stringify(taskTitle)}`,
          "  duration 2p",
        ]
      : []),
  ].join("\n")}\n`;
}

test("HTM-001 and HTM-002 project exact semantics apart from source fidelity", async () => {
  const fixture = JSON.parse(await readFile(
    path.join(root, "test/fixtures/historical-transition-model-v1.json"),
    "utf8",
  ));
  const planned = projection(plannedSource());
  const represented = projection(plannedSource({
    duration: "2/6p",
    representation: true,
  }));

  assert.equal(planned.semantic.model, fixture.model);
  assert.equal(planned.model_version, fixture.model_version);
  assert.equal(planned.semantic.tasks[0].plan.timing.value.numerator, "1");
  assert.equal(planned.semantic.tasks[0].plan.timing.value.denominator, "3");
  assert.equal(planned.semantic.tasks[0].plan.timing.value.unit, "point");
  assert.equal(planned.semantic_digest, represented.semantic_digest);
  assert.notEqual(
    planned.source_fidelity.source_digest,
    represented.source_fidelity.source_digest,
  );
  assert.equal(Object.isFrozen(planned.semantic), true);
  assert.equal(Object.isFrozen(planned.semantic.tasks), true);
  assert.equal(
    classifyHistoricalTransition(planned, represented).class,
    "representation_only",
  );
  assert.equal(planned.semantic_digest, fixture.vectors.planned_semantic_digest);

  const grammarInputs = [
    [1, "docs/examples/minimal.pert"],
    [2, "test/fixtures/temporal-units/calendar-date-v2.pert"],
    [3, "test/fixtures/rational-duration/contract3-rejection-v3.pert"],
    [4, "plans/release-0.4.0.pert"],
    [5, "test/fixtures/project-actuals-v5.pert"],
    [6, "plans/historical-dag.pert"],
  ];
  for (const [grammarVersion, relativePath] of grammarInputs) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    const model = projection(source);
    assert.equal(model.semantic.project.grammar_version, grammarVersion);
  }
  const assuranceModel = projection(await readFile(
    path.join(root, "plans/historical-dag.pert"),
    "utf8",
  ));
  assert.equal(assuranceModel.semantic.plan_seals.length > 0, true);
  assert.equal(assuranceModel.semantic.task_outcomes.length > 0, true);
});

test("HTM-003 and HTM-004 classify lifecycle extension and event conflict", () => {
  const planned = projection(plannedSource({ duration: "1p" }));
  const active = projection(activeSource());
  const paused = projection(activeSource({ includePause: true }));
  const conflicting = projection(activeSource({
    startAt: "2026-08-06T10:01:00+09:00",
  }));

  assert.equal(
    classifyHistoricalTransition(planned, active).class,
    "lifecycle_projection",
  );
  assert.equal(
    classifyHistoricalTransition(active, paused).class,
    "evidence_extension",
  );
  const conflict = classifyHistoricalTransition(active, conflicting);
  assert.equal(conflict.class, "conflict");
  assert.deepEqual(conflict.causes, ["event_payload_changed"]);
});

test("HTM-005 and HTM-006 permit future edits and protect frozen task meaning", () => {
  const planned = projection(plannedSource());
  const changed = projection(plannedSource({ title: "Changed future work" }));
  assert.equal(
    classifyHistoricalTransition(planned, changed).class,
    "future_plan_edit",
  );

  const active = projection(activeSource());
  const frozenChanged = projection(activeSource({ title: "Changed active work" }));
  const conflict = classifyHistoricalTransition(active, frozenChanged);
  assert.equal(conflict.class, "conflict");
  assert.deepEqual(conflict.causes, ["topology_conflict"]);
});

test("HTM-007 and HTM-008 require one exact unforced canonical advance candidate", () => {
  const source = advanceSource();
  const planned = publicApi.planAdvance(source);
  assert.equal(planned.ok, true, diagnosticText(planned));
  assert.equal(planned.changed, true);
  assert.notEqual(planned.updatedText, null);
  const before = projection(source);
  const after = projection(planned.updatedText);
  const candidate = {
    planner_version: "perttool.canonical-advance.v1",
    base_semantic_digest: before.semantic_digest,
    candidate: after,
    complete: true,
    force_requested: false,
    owner_assertion_used: false,
    repository_proof_assumed: false,
    persistence_assumed: false,
  };

  const exact = classifyHistoricalTransition(before, after, {
    canonicalAdvanceCandidate: candidate,
  });
  assert.equal(exact.class, "canonical_advance");
  assert.equal(
    exact.canonical_advance.candidate_semantic_digest,
    after.semantic_digest,
  );

  const withoutProof = classifyHistoricalTransition(before, after);
  assert.equal(withoutProof.class, "ambiguous_edit");
  assert.deepEqual(withoutProof.causes, ["noncanonical_removal"]);
  assert.equal(
    classifyHistoricalTransition(before, after, {
      canonicalAdvanceCandidate: { ...candidate, force_requested: true },
    }).class,
    "ambiguous_edit",
  );
});

test("HTM-009 through HTM-011 derive deterministic occurrence, value, and topology epochs", async () => {
  const fixture = JSON.parse(await readFile(
    path.join(root, "test/fixtures/historical-transition-model-v1.json"),
    "utf8",
  ));
  const base = projection(parallelSource());
  const changed = projection(parallelSource({ taskTitle: "Changed optional" }));
  const removed = projection(parallelSource({ includeTask: false }));
  const reintroduced = projection(parallelSource({ taskTitle: "Reintroduced" }));
  const result = projectHistoricalTransitionSequence([
    {
      commit_id: commits[0],
      projection: base,
      connected_to_previous: false,
      is_merge_commit: false,
    },
    {
      commit_id: commits[1],
      projection: changed,
      connected_to_previous: true,
      is_merge_commit: false,
    },
    {
      commit_id: commits[2],
      projection: removed,
      connected_to_previous: true,
      is_merge_commit: false,
    },
    {
      commit_id: commits[3],
      projection: reintroduced,
      connected_to_previous: true,
      is_merge_commit: true,
    },
  ]);

  const firstTask = result.checkpoints[0].entity_value_epochs.find(
    ({ entity_kind, source_id }) => entity_kind === "task" && source_id === "T",
  );
  const changedTask = result.checkpoints[1].entity_value_epochs.find(
    ({ entity_kind, source_id }) => entity_kind === "task" && source_id === "T",
  );
  const reintroducedTask = result.checkpoints[3].entity_value_epochs.find(
    ({ entity_kind, source_id }) => entity_kind === "task" && source_id === "T",
  );
  assert.equal(firstTask.occurrence_id, changedTask.occurrence_id);
  assert.equal(firstTask.value_epoch_ordinal, 1);
  assert.equal(changedTask.value_epoch_ordinal, 2);
  assert.equal(
    result.checkpoints[0].topology_epoch_id,
    result.checkpoints[1].topology_epoch_id,
  );
  assert.equal(reintroducedTask.occurrence_id, null);
  assert.equal(reintroducedTask.value_epoch_ordinal, null);
  assert.equal(result.checkpoints[3].topology_epoch_id, null);
  assert.equal(result.checkpoints[3].transition.is_merge_commit, true);
  assert.equal(
    result.causes.some(
      ({ cause, source_id }) =>
        cause === "identity_ambiguous" && source_id === "T",
    ),
    true,
  );
  assert.equal(firstTask.occurrence_id, fixture.vectors.task_occurrence_id);
  assert.equal(
    result.checkpoints[0].topology_epoch_id,
    fixture.vectors.base_topology_epoch_id,
  );
  assert.equal(
    historicalOccurrenceId({
      projectId: "EPOCHS",
      entityKind: "task",
      sourceId: "T",
      introducedCommitId: commits[0],
    }),
    firstTask.occurrence_id,
  );

  const replacedProject = projection(
    parallelSource().replace("project EPOCHS:", "project REPLACED:"),
  );
  const identityConflict = projectHistoricalTransitionSequence([
    {
      commit_id: commits[0],
      projection: base,
      connected_to_previous: false,
      is_merge_commit: false,
    },
    {
      commit_id: commits[1],
      projection: replacedProject,
      connected_to_previous: true,
      is_merge_commit: false,
    },
  ]);
  assert.equal(identityConflict.checkpoints[1].transition.class, "conflict");
  assert.equal(
    identityConflict.checkpoints[1].entity_value_epochs.every(
      ({ occurrence_id }) => occurrence_id === null,
    ),
    true,
  );
});

test("HTM-012 keeps the active public and write surfaces unchanged", async () => {
  const fixture = JSON.parse(await readFile(
    path.join(root, "test/fixtures/historical-transition-model-v1.json"),
    "utf8",
  ));
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    Array.from({ length: 12 }, (_, index) =>
      `HTM-${String(index + 1).padStart(3, "0")}`
    ),
  );
  assert.equal("projectHistoricalTransitionModel" in publicApi, false);
  assert.equal("classifyHistoricalTransition" in publicApi, false);
  assert.equal("projectHistoricalTransitionSequence" in publicApi, false);
  assert.equal(publicApi.COMMAND_REGISTRY.length, 45);
  assert.equal(publicApi.getJsonSchemaCatalog().length, 21);
});

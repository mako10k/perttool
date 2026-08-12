import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  HISTORICAL_DAG_MODEL_ID,
  HISTORICAL_LINEAR_CORE_LIMITS,
  reconstructHistoricalLinearHistory,
} from "../dist/history/historical-graph.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";
import { planTargetPlanAssuranceAdvance } from "../dist/assurance/advance.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const encoder = new TextEncoder();
const commits = Array.from({ length: 8 }, (_, index) =>
  (index + 1).toString(16).repeat(40)
);

function source({
  title = "Plan",
  taskTitle = "Work",
  includeSecondTask = false,
} = {}) {
  return `${[
    "project P:",
    "  version 5",
    `  title ${JSON.stringify(title)}`,
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
    `  title ${JSON.stringify(taskTitle)}`,
    "  duration 1p",
    ...(includeSecondTask
      ? [
          "",
          "task U START -> END:",
          "  title \"Second\"",
          "  duration 2p",
        ]
      : []),
  ].join("\n")}\n`;
}

function activeSource(startAt = "2026-08-06T10:00:00+09:00") {
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
    "  title \"Work\"",
    "  duration 1p",
    "  status active",
    "",
    "work_event WE_START:",
    "  model 1",
    "  task T",
    "  kind start",
    `  occurred_at ${startAt}`,
    "  planned_value 1p",
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

function cyclicLineageSource() {
  return `${[
    "project CYCLE:",
    "  version 5",
    "  title \"Cycle history\"",
    "  as_of 2026-08-06",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish C",
    "",
    "milestone A:",
    "  title \"A\"",
    "  state reached",
    "",
    "milestone B:",
    "  title \"B\"",
    "",
    "milestone C:",
    "  title \"C\"",
    "",
    "task DONE A -> B:",
    "  title \"Done\"",
    "  duration 1p",
    "  status done",
    "",
    "task KEEP_A A -> C:",
    "  title \"Keep A\"",
    "  duration 1p",
    "",
    "task KEEP_B B -> C:",
    "  title \"Keep B\"",
    "  duration 1p",
  ].join("\n")}\n`;
}

function encode(value) {
  return typeof value === "string" ? encoder.encode(value) : value;
}

function evidence(values, { mergeAt = -1, status = "complete" } = {}) {
  const bytes = values.map(encode);
  const snapshots = bytes.map((value, index) => {
    const missing = value === null;
    const sourceBytes = missing ? null : value;
    const commitId = commits[index];
    const parentCommitIds = index === 0
      ? []
      : mergeAt === index
        ? [commits[index - 1], "f".repeat(40)]
        : [commits[index - 1]];
    return {
      modelVersion: 1,
      objectFormat: "sha1",
      repositoryId: "git-repository:sha256:" + "a".repeat(64),
      repositoryReadSnapshotId: "git-read:sha256:" + "b".repeat(64),
      repositoryRelativePath: "plans/example.pert",
      commitId,
      parentCommitIds,
      blobId: missing ? null : (index + 9).toString(16).repeat(40),
      sourceDigest: missing ? null : digestDocumentBytes(sourceBytes),
      source: sourceBytes,
      recordedAt: `2026-08-0${index + 1}T00:00:00Z`,
      isMergeCommit: mergeAt === index,
      isEndpoint: index === bytes.length - 1,
      isLowerBoundary: index === 0,
    };
  });
  return {
    ok: true,
    modelVersion: 1,
    status,
    ancestryProfile: "first_parent",
    objectFormat: "sha1",
    repositoryId: snapshots[0].repositoryId,
    repositoryReadSnapshotId: snapshots[0].repositoryReadSnapshotId,
    repositoryRelativePath: snapshots[0].repositoryRelativePath,
    requestedEndpoint: "HEAD",
    resolvedEndpoint: snapshots.at(-1).commitId,
    requestedLowerBoundary: commits[0],
    resolvedLowerBoundary: commits[0],
    oldestInspectedCommitId: commits[0],
    currentSourceDigest: snapshots.at(-1).sourceDigest,
    aggregateRawSnapshotBytes: bytes.reduce(
      (sum, value) => sum + (value?.byteLength ?? 0),
      0,
    ),
    limits: {
      inspectedCommits: 2048,
      rawBytesPerSnapshot: 8388608,
      aggregateRawSnapshotBytes: 134217728,
    },
    inspectedCommitIds: snapshots.map(({ commitId }) => commitId),
    snapshots,
    causes: status === "incomplete"
      ? [{
          cause: "shallow_origin",
          subject: "inspection",
          commitId: commits[0],
          limit: null,
          actual: null,
        }]
      : [],
  };
}

function advance(text) {
  const result = planTargetPlanAssuranceAdvance(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.notEqual(result.updatedText, null);
  return result.updatedText;
}

test("HLR-001 selects one exact semantic snapshot without invented history", () => {
  const result = reconstructHistoricalLinearHistory(evidence([source()]));
  assert.equal(result.model, HISTORICAL_DAG_MODEL_ID);
  assert.equal(result.status, "complete");
  assert.equal(result.ancestry_profile, "first_parent");
  assert.equal(result.checkpoints.length, 1);
  assert.equal(result.selected_snapshot.commit_id, commits[0]);
  assert.equal(result.effective_checkpoint_id, commits[0]);
  assert.equal(result.lineage.occurrences.length, 3);
  assert.equal(result.timeline.entries.length, 1);
  assert.equal(Object.isFrozen(result), true);
});

test("HLR-002 classifies invalid sources and never crosses a continuity gap", () => {
  const result = reconstructHistoricalLinearHistory(evidence([
    source(),
    "project BROKEN:\n  version 5\n  title\n",
    source({ taskTitle: "Later" }),
  ]));
  assert.equal(result.status, "incomplete");
  assert.deepEqual(
    result.timeline.entries.map(({ validity }) => validity),
    ["semantic_valid", "syntax_invalid", "semantic_valid"],
  );
  assert.equal(result.timeline.segments.length, 2);
  assert.equal(result.lineage, null);
  assert.equal(result.effective_checkpoint_id, commits[2]);
  assert.equal(result.causes.some(({ cause }) => cause === "syntax_invalid"), true);

  const invalidEndpoint = reconstructHistoricalLinearHistory(evidence([
    source(),
    "project INVALID:\n  version 5\n  title \"Invalid\"\n",
  ]));
  assert.equal(invalidEndpoint.selected_snapshot, null);
  assert.equal(invalidEndpoint.effective_checkpoint_id, commits[0]);

  const unsupported = reconstructHistoricalLinearHistory(evidence([
    source().replace("version 5", "version 8"),
  ]));
  assert.equal(unsupported.timeline.entries[0].validity, "grammar_unsupported");

  const semanticInvalid = reconstructHistoricalLinearHistory(evidence([
    "project INVALID:\n  version 5\n  title \"Invalid\"\n  duration_unit point\n",
  ]));
  assert.equal(semanticInvalid.timeline.entries[0].validity, "semantic_invalid");
});

test("HLR-003 preserves representation-only and future-plan epochs", () => {
  const represented = `# comment\r\n${source().replaceAll("\n", "\r\n")}`;
  const result = reconstructHistoricalLinearHistory(evidence([
    source(),
    represented,
    source({ includeSecondTask: true }),
  ]));
  assert.deepEqual(
    result.checkpoints.map(({ transition }) => transition.class),
    ["initial", "representation_only", "future_plan_edit"],
  );
  assert.equal(
    result.checkpoints[0].graph.topology_epoch_id,
    result.checkpoints[1].graph.topology_epoch_id,
  );
  assert.notEqual(
    result.checkpoints[1].graph.topology_epoch_id,
    result.checkpoints[2].graph.topology_epoch_id,
  );

  const unsealed = source().replace(
    "  finish END",
    "  finish END\n  plan_assurance_model 1\n  plan_assurance_hash_model 1",
  ).replace("version 5", "version 6");
  const withheld = reconstructHistoricalLinearHistory(evidence([unsealed]));
  assert.equal(withheld.checkpoints[0].assurance, "withheld");
  assert.notEqual(withheld.lineage, null);
  assert.equal(
    withheld.causes.some(({ cause }) => cause === "assurance_withheld"),
    true,
  );
});

test("HLR-004 freezes stable events and rejects changed payloads", () => {
  const stable = reconstructHistoricalLinearHistory(evidence([
    activeSource(),
    activeSource(),
  ]));
  assert.equal(stable.lineage.frozen_work_events.length, 1);
  assert.equal(
    stable.lineage.frozen_work_events[0].first_observed_commit_id,
    commits[0],
  );
  assert.equal(
    stable.lineage.frozen_work_events[0].last_observed_commit_id,
    commits[1],
  );
  const conflict = reconstructHistoricalLinearHistory(evidence([
    activeSource(),
    activeSource("2026-08-06T10:01:00+09:00"),
  ]));
  assert.equal(conflict.lineage, null);
  assert.equal(
    conflict.causes.some(({ cause }) => cause === "event_payload_changed"),
    true,
  );
});

test("HLR-005 proves canonical advance and rehydrates retired topology", () => {
  const before = advanceSource();
  const after = advance(before);
  const result = reconstructHistoricalLinearHistory(evidence([before, after]));
  assert.equal(result.status, "complete");
  assert.deepEqual(
    result.checkpoints.map(({ transition }) => transition.class),
    ["initial", "canonical_advance"],
  );
  assert.equal(result.selected_snapshot.graph.occurrences.length, 1);
  assert.equal(result.lineage.occurrences.length >= 3, true);
  assert.equal(result.lineage.retired_occurrence_ids.length >= 2, true);
  assert.equal(result.lineage.canonical_advance_proofs.length, 1);
  assert.deepEqual(
    result.lineage.canonical_advance_proofs[0].removed_task_ids,
    ["WORK"],
  );
  assert.equal(result.lineage.frozen_work_events.length, 2);
});

test("HLR-006 refuses a deletion combined with an unrelated edit", () => {
  const before = advanceSource();
  const after = advance(before).replace('title "Advance"', 'title "Edited"');
  const result = reconstructHistoricalLinearHistory(evidence([before, after]));
  assert.equal(result.lineage, null);
  assert.equal(
    result.checkpoints[1].transition.class,
    "ambiguous_edit",
  );
  assert.equal(
    result.causes.some(({ cause }) => cause === "noncanonical_removal"),
    true,
  );
});

test("HLR-007 does not invent occurrence identity after a gap", () => {
  const result = reconstructHistoricalLinearHistory(evidence([
    source(),
    new Uint8Array([0xff]),
    source(),
  ]));
  assert.equal(result.lineage, null);
  assert.equal(
    result.causes.some(({ cause }) => cause === "identity_ambiguous"),
    true,
  );
  assert.equal(
    result.checkpoints[1].graph.occurrences.some(
      ({ source_id, occurrence_id }) => source_id === "T" && occurrence_id === null,
    ),
    true,
  );
});

test("HLR-008 keeps timeline but rejects a cycle existing only in lineage", () => {
  const before = cyclicLineageSource();
  const afterAdvance = advance(before);
  const afterEdit = afterAdvance.replace(
    "task KEEP_A A -> C:",
    "task REVERSE B -> A:\n  title \"Reverse\"\n  duration 1p\n  status done\n\ntask KEEP_A A -> C:",
  );
  const result = reconstructHistoricalLinearHistory(evidence([
    before,
    afterAdvance,
    afterEdit,
  ]));
  assert.equal(result.timeline.entries.length, 3);
  assert.equal(result.lineage, null);
  assert.equal(
    result.causes.some(({ cause }) => cause === "lineage_cycle"),
    true,
    JSON.stringify({
      causes: result.causes,
      diagnostics: result.timeline.entries.map(({ diagnostic_codes }) => diagnostic_codes),
    }),
  );
  assert.equal(
    result.timeline.entries.every(({ validity }) => validity === "semantic_valid"),
    true,
    JSON.stringify(result.timeline.entries.map(({ diagnostic_codes }) => diagnostic_codes)),
  );
});

test("HLR-009 retains merge provenance without inspecting a side lane", () => {
  const result = reconstructHistoricalLinearHistory(evidence([
    source(),
    source({ taskTitle: "Merged" }),
  ], { mergeAt: 1 }));
  assert.equal(result.checkpoints[1].is_merge_commit, true);
  assert.equal(result.checkpoints[1].parent_commit_ids.length, 2);
  assert.equal(result.checkpoints[1].transition.is_merge_commit, true);
  assert.equal(result.checkpoints.length, 2);
});

test("HLR-010 applies output limits without silently truncating views", () => {
  const result = reconstructHistoricalLinearHistory(
    evidence([source(), source({ includeSecondTask: true })]),
    { limits: { transitionRecords: 0 } },
  );
  assert.equal(result.status, "incomplete");
  assert.equal(result.lineage, null);
  assert.equal(result.timeline, null);
  assert.equal(result.selected_snapshot, null);
  assert.equal(result.effective_checkpoint_id, commits[1]);
  assert.deepEqual(
    result.causes.filter(({ cause }) => cause === "hard_limit").map(({ limit }) => limit),
    ["transitionRecords"],
  );

  const shallow = reconstructHistoricalLinearHistory(evidence(
    [source()],
    { status: "incomplete" },
  ));
  assert.equal(shallow.status, "incomplete");
  assert.equal(shallow.lineage, null);
  assert.equal(
    shallow.causes.some(({ cause }) => cause === "shallow_origin"),
    true,
  );
});

test("HLR-011 binds immutable ranges and is byte deterministic", () => {
  const input = evidence([source()]);
  const first = reconstructHistoricalLinearHistory(input);
  const second = reconstructHistoricalLinearHistory(input);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  const binding = first.selected_snapshot.source_bindings[0];
  assert.deepEqual(
    Object.keys(binding).sort(),
    [
      "blob_id",
      "commit_id",
      "declaration_kind",
      "owner_path",
      "range",
      "repository_id",
      "repository_relative_path",
      "source_digest",
      "source_id",
    ],
  );
  assert.equal(binding.commit_id, commits[0]);
  assert.equal(binding.blob_id, "9".repeat(40));
  assert.equal(binding.source_digest, input.snapshots[0].sourceDigest);
});

test("HLR-012 keeps the public runtime and source bytes unchanged", async () => {
  const fixture = JSON.parse(await readFile(
    path.join(root, "test/fixtures/historical-linear-core-v1.json"),
    "utf8",
  ));
  assert.equal(fixture.schema_version, "Perttool.HistoricalLinearCoreCases.v1");
  assert.equal(fixture.historical_dag_model_version, 1);
  assert.deepEqual(fixture.limits, {
    entity_value_epochs: HISTORICAL_LINEAR_CORE_LIMITS.entityValueEpochs,
    transition_records: HISTORICAL_LINEAR_CORE_LIMITS.transitionRecords,
    rendered_graph_occurrences:
      HISTORICAL_LINEAR_CORE_LIMITS.renderedGraphOccurrences,
    historical_source_bindings:
      HISTORICAL_LINEAR_CORE_LIMITS.historicalSourceBindings,
  });
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from({ length: 12 }, (_, index) =>
      `HLR-${String(index + 1).padStart(3, "0")}`
    ),
  );
  assert.equal("reconstructHistoricalLinearHistory" in publicApi, false);
  assert.equal(publicApi.COMMAND_REGISTRY.length, 53);
  assert.equal(publicApi.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(publicApi).length, 129);
  const original = source();
  const input = evidence([original]);
  reconstructHistoricalLinearHistory(input);
  assert.equal(new TextDecoder().decode(input.snapshots[0].source), original);
});

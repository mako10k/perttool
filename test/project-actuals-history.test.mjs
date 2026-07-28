import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  inspectTargetProjectHistory,
  inspectTargetProjectHistoryFile,
  renderTargetProjectHistoryText,
  targetProjectHistoryResultToJson,
} from "../dist/application/target-project-history.js";
import {
  probeGitHistory,
} from "../dist/history/git-probe.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../dist/parser/document-parser.js";

function git(repository, ...args) {
  const result = spawnSync(
    "git",
    ["-C", repository, ...args],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function write(path, source) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, source, "utf8");
}

let commitSequence = 30;

function commit(repository, message) {
  commitSequence += 1;
  git(repository, "add", "-A");
  const minute = String(commitSequence % 60).padStart(2, "0");
  const recordedAt = `2026-07-28T13:${minute}:00+09:00`;
  const result = spawnSync(
    "git",
    ["-C", repository, "commit", "-m", message],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: recordedAt,
        GIT_COMMITTER_DATE: recordedAt,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return git(repository, "rev-parse", "HEAD");
}

async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), "perttool-project-history."));
  t.after(() => rm(root, { recursive: true, force: true }));
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Perttool Test");
  git(root, "config", "user.email", "perttool@example.invalid");
  return root;
}

function event(id, fields) {
  return [
    "",
    `work_event ${id}:`,
    "  model 1",
    "  task WORK",
    ...fields,
  ];
}

function actualsSource({
  status = "planned",
  events = [],
  includeTask = true,
  version = 5,
  finishReached = false,
  taskTarget = "DONE",
} = {}) {
  return [
    "project HISTORY:",
    `  version ${version}`,
    '  title "history"',
    "  as_of 2026-07-28",
    "  duration_unit point",
    "  velocity 4p/1d",
    "  finish DONE",
    "",
    ...(includeTask
      ? [
          "milestone NOW:",
          '  title "now"',
          "  state reached",
        ]
      : []),
    ...(taskTarget === "MID"
      ? [
          "",
          "milestone MID:",
          '  title "mid"',
        ]
      : []),
    "",
    "milestone DONE:",
    '  title "done"',
    ...(finishReached ? ["  state reached"] : []),
    ...(includeTask
      ? [
          "",
          `task WORK NOW -> ${taskTarget}:`,
          '  title "work"',
          "  duration 4p",
          `  status ${status}`,
          ...events,
        ]
      : []),
    ...(includeTask && taskTarget === "MID"
      ? [
          "",
          "gate AFTER_WORK MID -> DONE:",
          '  reason "retain a valid finish path"',
        ]
      : []),
    "",
  ].join("\n");
}

test("project history deduplicates declared events and retains advance removal", async (t) => {
  const root = await repository(t);
  const plan = join(root, "plans", "actuals.pert");
  const open = actualsSource({
    status: "active",
    events: [
      ...event("WE-start", [
        "  kind start",
        "  occurred_at 2026-07-28T09:00:00+09:00",
        "  planned_value 4p",
      ]),
      ...event("WE-suspend", [
        "  kind suspend",
        "  occurred_at 2026-07-28T11:00:00+09:00",
        '  reason "review"',
      ]),
      ...event("WE-resume", [
        "  kind resume",
        "  occurred_at 2026-07-28T13:00:00+09:00",
      ]),
    ],
  });
  await write(plan, open);
  const startCommit = commit(root, "record open work");
  const finished = actualsSource({
    status: "done",
    events: [
      ...event("WE-start", [
        "  kind start",
        "  occurred_at 2026-07-28T09:00:00+09:00",
        "  planned_value 4p",
      ]),
      ...event("WE-suspend", [
        "  kind suspend",
        "  occurred_at 2026-07-28T11:00:00+09:00",
        '  reason "review"',
      ]),
      ...event("WE-resume", [
        "  kind resume",
        "  occurred_at 2026-07-28T13:00:00+09:00",
      ]),
      ...event("WE-finish", [
        "  kind finish",
        "  occurred_at 2026-07-28T17:00:00+09:00",
        "  active_time 6h",
        "  effort 8ph",
      ]),
    ],
  });
  await write(plan, finished);
  const finishCommit = commit(root, "record finish");
  await write(plan, actualsSource({
    includeTask: false,
    finishReached: true,
  }));
  const advanceCommit = commit(root, "advance completed task");

  const result = await inspectTargetProjectHistoryFile(
    { targetPath: plan, taskIds: ["WORK"] },
    TARGET_GRAMMAR_5_CAPABILITY,
  );

  assert.equal(result.ok, true);
  assert.equal(
    result.history.status,
    "complete",
    JSON.stringify(result.history.unavailableCauses),
  );
  assert.deepEqual(
    result.events.map(({ event }) => event.id),
    ["WE-finish", "WE-resume", "WE-start", "WE-suspend"],
  );
  assert.equal(
    result.events.find(({ event }) => event.id === "WE-start")
      .firstSeenCommitId,
    startCommit,
  );
  assert.equal(
    result.events.find(({ event }) => event.id === "WE-start")
      .lastSeenCommitId,
    finishCommit,
  );
  assert.equal(
    result.events.find(({ event }) => event.id === "WE-start")
      .removalCommitId,
    advanceCommit,
  );
  assert.deepEqual(result.gitRecordedTransitions, []);
  assert.equal(result.tasks.length, 1);
  const summary = result.tasks[0];
  assert.equal(summary.coverage, "complete");
  assert.equal(summary.firstStart.sourceText, "2026-07-28T09:00:00+09:00");
  assert.equal(summary.lastFinish.sourceText, "2026-07-28T17:00:00+09:00");
  assert.deepEqual(
    [summary.cycleTime.numerator, summary.cycleTime.denominator],
    ["8", "1"],
  );
  assert.deepEqual(
    [
      summary.derivedActiveTime.numerator,
      summary.derivedActiveTime.denominator,
    ],
    ["6", "1"],
  );
  assert.deepEqual(
    [summary.effort.numerator, summary.effort.denominator],
    ["8", "1"],
  );
  assert.equal(summary.baselineSource, "start_baseline");
  assert.equal(summary.baselineEventId, "WE-start");
  assert.equal(summary.baselineCommitId, startCommit);
  assert.deepEqual(summary.unavailableCauses, []);

  const json = targetProjectHistoryResultToJson(
    result,
    "plans/actuals.pert",
  );
  assert.equal(json.schema_version, "Perttool.ProjectHistoryResult.v1");
  assert.equal(json.cli_contract_version, 6);
  assert.equal(json.history.status, "complete");
  assert.equal(json.events.length, 4);
  assert.equal("occurred_at" in json.events[0].event, true);
  const text = renderTargetProjectHistoryText(result);
  assert.equal(text, renderTargetProjectHistoryText(result));
  assert.match(text, /^HISTORY status=complete/m);
  assert.match(text, /^EVENT id=WE-finish/m);
  assert.match(text, /^TASK_ACTUAL task=WORK coverage=complete/m);
});

test("finish-only history uses the last committed pre-advance task value", async (t) => {
  const root = await repository(t);
  const plan = join(root, "actuals.pert");
  await write(plan, actualsSource({
    status: "done",
    events: event("WE-finish", [
      "  kind finish",
      "  occurred_at 2026-07-28T18:00:00+09:00",
      "  effort 5/2ph",
    ]),
  }));
  const finishCommit = commit(root, "record standalone finish");
  await write(plan, actualsSource({
    includeTask: false,
    finishReached: true,
  }));
  const removalCommit = commit(root, "advance standalone finish");

  const probe = await probeGitHistory({ targetPath: plan });
  const result = inspectTargetProjectHistory(
    probe,
    {},
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  const summary = result.tasks.find(({ taskId }) => taskId === "WORK");
  assert.equal(result.ok, true);
  assert.equal(summary.coverage, "finish_only");
  assert.equal(summary.firstStart, null);
  assert.equal(summary.cycleTime, null);
  assert.equal(summary.derivedActiveTime, null);
  assert.deepEqual(
    [summary.effort.numerator, summary.effort.denominator],
    ["5", "2"],
  );
  assert.deepEqual(
    [summary.plannedValue.numerator, summary.plannedValue.denominator],
    ["4", "1"],
  );
  assert.equal(summary.baselineSource, "finish_snapshot");
  assert.equal(summary.baselineCommitId, finishCommit);
  assert.equal(result.events[0].removalCommitId, removalCommit);
  assert.deepEqual(summary.qualifiers, ["finish_snapshot"]);
});

test("legacy Git transitions retain recorded provenance without actual time", async (t) => {
  const root = await repository(t);
  const plan = join(root, "legacy.pert");
  await write(plan, actualsSource({ version: 4, status: "active" }));
  const activeCommit = commit(root, "record active status");
  await write(plan, actualsSource({ version: 4, status: "done" }));
  const doneCommit = commit(root, "record done status");

  const probe = await probeGitHistory({ targetPath: plan });
  const result = inspectTargetProjectHistory(
    probe,
    {},
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.gitRecordedTransitions.map(
      ({ fromState, toState, commitId, evidenceClass }) => [
        fromState,
        toState,
        commitId,
        evidenceClass,
      ],
    ),
    [
      ["absent", "active", activeCommit, "git_recorded_transition"],
      ["active", "done", doneCommit, "git_recorded_transition"],
    ],
  );
  const json = targetProjectHistoryResultToJson(result, "legacy.pert");
  assert.equal(
    "occurred_at" in json.git_recorded_transitions[1],
    false,
  );
  assert.equal(
    json.git_recorded_transitions[1].recorded_at.source_text,
    result.gitRecordedTransitions[1].recordedAt.sourceText,
  );
  assert.equal(result.events.length, 0);
  assert.equal(result.tasks[0].coverage, "unrecorded");
  assert.equal(result.tasks[0].lastFinish, null);

  const duplicateSelection = inspectTargetProjectHistory(
    probe,
    { taskIds: ["WORK", "WORK"] },
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(duplicateSelection.ok, false);
  assert.deepEqual(
    duplicateSelection.diagnostics.map(({ code, data }) => [
      code,
      data.cause,
    ]),
    [["PTCLI-001", "duplicate_task"]],
  );
});

test("conflicting event payloads fail closed with PTHIS-103", async (t) => {
  const root = await repository(t);
  const plan = join(root, "conflict.pert");
  await write(plan, actualsSource({
    status: "done",
    events: event("WE-finish", [
      "  kind finish",
      "  occurred_at 2026-07-28T18:00:00+09:00",
      "  effort 1ph",
    ]),
  }));
  const firstPayloadCommit = commit(root, "record first payload");
  await write(plan, actualsSource({
    status: "done",
    events: event("WE-finish", [
      "  kind finish",
      "  occurred_at 2026-07-28T18:00:00+09:00",
      "  effort 2ph",
    ]),
  }));
  const conflictCommit = commit(root, "change event payload");

  const probe = await probeGitHistory({ targetPath: plan });
  const result = inspectTargetProjectHistory(
    probe,
    {},
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.history.status, "unavailable");
  const conflictingCommits = [
    firstPayloadCommit,
    conflictCommit,
  ].sort();
  assert.deepEqual(
    result.history.unavailableCauses.map(
      ({ cause, commitId, eventId }) => [cause, commitId, eventId],
    ),
    conflictingCommits.map((commitId) => [
      "event_payload_changed",
      commitId,
      "WE-finish",
    ]),
  );
  assert.deepEqual(
    result.diagnostics.map(({ code, data }) => [code, data.cause]),
    [
      ["PTHIS-103", "event_payload_changed"],
      ["PTHIS-103", "event_payload_changed"],
    ],
  );
  assert.deepEqual(result.events, []);
});

test("shallow history remains incomplete and never invents actual evidence", async (t) => {
  const origin = await repository(t);
  const plan = join(origin, "plans", "legacy.pert");
  await write(plan, actualsSource({ version: 4, status: "active" }));
  commit(origin, "record active");
  await write(plan, actualsSource({ version: 4, status: "done" }));
  commit(origin, "record done");

  const parent = await mkdtemp(join(tmpdir(), "perttool-history-shallow."));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const clone = join(parent, "clone");
  const cloned = spawnSync(
    "git",
    ["clone", "--depth=1", pathToFileURL(origin).href, clone],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_TERMINAL_PROMPT: "0",
        LC_ALL: "C",
      },
    },
  );
  assert.equal(cloned.status, 0, cloned.stderr);
  const probe = await probeGitHistory({
    targetPath: join(clone, "plans", "legacy.pert"),
  });
  const result = inspectTargetProjectHistory(
    probe,
    {},
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.equal(result.history.status, "incomplete");
  assert.deepEqual(
    result.history.unavailableCauses.map(({ cause }) => cause),
    ["shallow_boundary"],
  );
  assert.deepEqual(
    result.diagnostics.map(({ code, severity }) => [code, severity]),
    [["PTHIS-102", "warning"]],
  );
  assert.deepEqual(result.gitRecordedTransitions, []);
  assert.equal(result.tasks[0].coverage, "unrecorded");
  assert.equal(result.tasks[0].lastFinish, null);
  assert.equal(
    result.tasks[0].unavailableCauses.some(
      ({ cause }) => cause === "history_incomplete",
    ),
    true,
  );
});

test("task identity replacement and unsupported source stay qualified", async (t) => {
  const root = await repository(t);
  const plan = join(root, "qualified.pert");
  await write(plan, actualsSource({
    version: 4,
    status: "planned",
    taskTarget: "MID",
  }));
  commit(root, "record first task identity");
  await write(plan, actualsSource({
    version: 4,
    status: "planned",
    taskTarget: "DONE",
  }));
  const replacementCommit = commit(root, "replace task identity");
  const probe = await probeGitHistory({ targetPath: plan });
  const replacement = inspectTargetProjectHistory(
    probe,
    {},
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(replacement.ok, true);
  assert.equal(replacement.history.status, "incomplete");
  assert.deepEqual(
    replacement.history.unavailableCauses.map(
      ({ cause, commitId, taskId }) => [cause, commitId, taskId],
    ),
    [["task_identity_replaced", replacementCommit, "WORK"]],
  );
  assert.equal(replacement.gitRecordedTransitions.length, 1);
  assert.deepEqual(
    replacement.gitRecordedTransitions.map(
      ({ fromState, toState }) => [fromState, toState],
    ),
    [["absent", "planned"]],
  );
  assert.equal(replacement.tasks[0].coverage, "unavailable");
  assert.equal(replacement.tasks[0].plannedValue, null);
  assert.deepEqual(
    replacement.tasks[0].unavailableCauses.map(({ cause }) => cause),
    ["history_incomplete"],
  );

  const unsupportedSource = Buffer.from(
    actualsSource({ version: 6, status: "planned" }),
  );
  const unsupportedProbe = {
    ok: true,
    modelVersion: 1,
    status: "complete",
    traversal: "first_parent",
    objectFormat: "sha1",
    repositorySnapshotId: `git:sha1:${"a".repeat(40)}`,
    repositoryRelativePath: "qualified.pert",
    requestedRevision: "HEAD",
    resolvedRevision: "a".repeat(40),
    headCommitId: "a".repeat(40),
    currentSourceDigest: `sha256:${"b".repeat(64)}`,
    selectedSourceDigest: `sha256:${"b".repeat(64)}`,
    inspectedCommitIds: ["a".repeat(40)],
    snapshots: [{
      repositorySnapshotId: `git:sha1:${"a".repeat(40)}`,
      relativePath: "qualified.pert",
      commitId: "a".repeat(40),
      parentCommitIds: [],
      recordedAt: "2026-07-28T13:59:00+09:00",
      sourceDigest: `sha256:${"b".repeat(64)}`,
      source: unsupportedSource,
    }],
    availability: [],
  };
  const unsupported = inspectTargetProjectHistory(
    unsupportedProbe,
    {},
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(unsupported.ok, true);
  assert.equal(unsupported.history.status, "incomplete");
  assert.deepEqual(
    unsupported.history.unavailableCauses.map(({ cause }) => cause),
    ["unsupported_source_version"],
  );
});

test("project history target remains absent from the active package root", async () => {
  for (const name of [
    "inspectProjectHistory",
    "inspectTargetProjectHistory",
    "inspectTargetProjectHistoryFile",
    "targetProjectHistoryResultToJson",
    "renderTargetProjectHistoryText",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  const declarations = await readFile(
    new URL("../dist/index.d.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(declarations, /ProjectHistoryResult/);
  assert.doesNotMatch(declarations, /inspectTargetProjectHistory/);
});

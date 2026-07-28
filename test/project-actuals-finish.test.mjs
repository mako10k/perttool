import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  deriveWorkEventId,
} from "../dist/actuals/lifecycle.js";
import {
  planTargetActualsAdvance,
} from "../dist/application/target-actuals-advance.js";
import {
  planTargetFinishActualsMutation,
} from "../dist/application/target-actuals-mutation.js";
import {
  persistTargetActualsResult,
} from "../dist/application/target-actuals-write.js";
import {
  SafeWriteConflictError,
} from "../dist/io/safe-write.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../dist/parser/document-parser.js";

function source({
  version = 4,
  status = "active",
  blockedReason = false,
  events = [],
  lineEnding = "\n",
  bom = false,
  tail = "",
} = {}) {
  const lines = [
    "project ACTUALS:",
    `  version ${version}`,
    '  title "actuals"',
    "  as_of 2026-07-28",
    "  duration_unit point",
    "  velocity 3p/1d",
    "  finish DONE",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "done"',
    "",
    "task WORK NOW -> DONE:",
    '  title "work"',
    "  estimate:",
    "    optimistic 1p",
    "    most_likely 3p",
    "    pessimistic 5p",
    `  status ${status}`,
    ...(blockedReason ? ['  blocked_reason "external"'] : []),
    ...events,
    ...(tail === "" ? [] : ["", tail]),
    "",
  ];
  return `${bom ? "\uFEFF" : ""}${lines.join(lineEnding)}`;
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

function finishRequest(overrides = {}) {
  return {
    kind: "task.finish.actual",
    taskId: "WORK",
    event: {
      occurredAt: "2026-07-28T17:00:00.000+09:00",
      activeTime: "4/2h",
      effort: "6/2ph",
      ...overrides,
    },
  };
}

async function workspace(t) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "perttool-actuals-finish-"),
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("eventful finish is one source-preserving Grammar 5 candidate", () => {
  const original = source({
    lineEnding: "\r\n",
    bom: true,
    tail: "# retained trailing comment",
  });
  const result = planTargetFinishActualsMutation(
    original,
    finishRequest(),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  const eventId = deriveWorkEventId(
    "WORK",
    "finish",
    "2026-07-28T17:00:00+09:00",
  );

  assert.equal(result.schemaVersion, "Perttool.MutationResult.v3");
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.lifecycle.modelVersion, 1);
  assert.equal(result.lifecycle.taskId, "WORK");
  assert.equal(result.lifecycle.fromState, "active");
  assert.equal(result.lifecycle.toState, "done");
  assert.equal(result.lifecycle.coverage, "finish_only");
  assert.equal(result.lifecycle.event.id, eventId);
  assert.equal(result.lifecycle.event.activeTime.sourceText, "2h");
  assert.equal(result.lifecycle.event.effort.sourceText, "3ph");
  assert.equal(result.governance.applicable, false);
  assert.equal(result.governance.writeAuthorized, true);
  assert.match(result.updatedText, /\uFEFFproject ACTUALS:\r\n  version 5/);
  assert.match(result.updatedText, /  status done\r\n/);
  assert.match(result.updatedText, new RegExp(`work_event ${eventId}:`));
  assert.match(
    result.updatedText,
    /occurred_at 2026-07-28T17:00:00\+09:00\r\n/,
  );
  assert.match(result.updatedText, /  active_time 2h\r\n  effort 3ph\r\n/);
  assert.match(result.updatedText, /# retained trailing comment/);
  assert.equal(result.updatedText.includes("\n") &&
    result.updatedText.replaceAll("\r\n", "").includes("\n"), false);
  for (let index = 1; index < result.edits.length; index += 1) {
    assert.ok(
      result.edits[index - 1].endOffset <= result.edits[index].startOffset,
    );
  }
});

test("identical finish retry is a no-op and payload drift is PTACT-106", () => {
  const first = planTargetFinishActualsMutation(
    source(),
    finishRequest(),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(first.ok, true);
  const repeated = planTargetFinishActualsMutation(
    first.updatedText,
    finishRequest(),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
  assert.equal(repeated.updatedText, first.updatedText);
  assert.equal(repeated.lifecycle.coverage, "finish_only");

  const conflict = planTargetFinishActualsMutation(
    first.updatedText,
    finishRequest({ effort: "4ph" }),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(conflict.ok, false);
  assert.equal(conflict.updatedText, null);
  assert.deepEqual(
    conflict.diagnostics
      .filter(({ code }) => code.startsWith("PTACT"))
      .map(({ code, data }) => [code, data.cause]),
    [["PTACT-106", "event_identity_conflict"]],
  );
});

test("finish validates explicit request time and exact measurement units", () => {
  const cases = [
    [
      {
        kind: "task.finish.actual",
        taskId: "WORK",
        event: {},
      },
      "occurred_at_required",
    ],
    [finishRequest({ occurredAt: "2026-07-28T17:00:00Z" }), "invalid_occurred_at"],
    [finishRequest({ activeTime: "2d" }), "invalid_active_time"],
    [finishRequest({ effort: "2h" }), "invalid_effort"],
    [finishRequest({ reason: "not a finish field" }), "invalid_finish_event_fields"],
  ];
  for (const [request, detail] of cases) {
    const result = planTargetFinishActualsMutation(
      source(),
      request,
      TARGET_GRAMMAR_5_CAPABILITY,
    );
    assert.equal(result.ok, false, detail);
    assert.equal(result.updatedText, null, detail);
    const diagnostic = result.diagnostics.find(
      ({ code }) => code === "PTACT-105",
    );
    assert.equal(diagnostic.data.cause, "invalid_request", detail);
    assert.equal(diagnostic.data.detail, detail);
    assert.equal(diagnostic.span, undefined);
  }
});

test("finish-only preserves the exact estimate baseline and clears legacy block", () => {
  const result = planTargetFinishActualsMutation(
    source({ status: "blocked", blockedReason: true }),
    finishRequest({ activeTime: undefined, effort: "5/2ph" }),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.equal(result.lifecycle.fromState, "blocked");
  assert.equal(result.lifecycle.coverage, "finish_only");
  assert.match(result.updatedText, /  estimate:\n    optimistic 1p/);
  assert.doesNotMatch(result.updatedText, /blocked_reason/);
  assert.equal(result.lifecycle.event.plannedValue, null);
  assert.deepEqual(result.lifecycle.event.effort.value, {
    numerator: 5n,
    denominator: 2n,
  });
});

test("finish closes a valid sequence and rejects mismatched explicit active time", () => {
  const original = source({
    version: 5,
    status: "active",
    events: [
      ...event("WE-start", [
        "  kind start",
        "  occurred_at 2026-07-28T09:00:00+09:00",
        "  planned_value 3p",
      ]),
      ...event("WE-suspend", [
        "  kind suspend",
        "  occurred_at 2026-07-28T12:00:00+09:00",
        '  reason "pause"',
      ]),
      ...event("WE-resume", [
        "  kind resume",
        "  occurred_at 2026-07-28T14:00:00+09:00",
      ]),
    ],
  });
  const accepted = planTargetFinishActualsMutation(
    original,
    finishRequest({ activeTime: "6h", effort: "7ph" }),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.lifecycle.coverage, "complete");

  const mismatch = planTargetFinishActualsMutation(
    original,
    finishRequest({ activeTime: "5h" }),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.updatedText, null);
  assert.deepEqual(
    mismatch.diagnostics
      .filter(({ code }) => code.startsWith("PTACT"))
      .map(({ code, data }) => [code, data.cause]),
    [["PTACT-107", "active_time_mismatch"]],
  );
});

test("a second distinct finish fails closed as PTACT-104", () => {
  const first = planTargetFinishActualsMutation(
    source(),
    finishRequest(),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  const second = planTargetFinishActualsMutation(
    first.updatedText,
    finishRequest({ occurredAt: "2026-07-28T18:00:00+09:00" }),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(second.ok, false);
  assert.equal(second.updatedText, null);
  assert.deepEqual(
    second.diagnostics
      .filter(({ code }) => code.startsWith("PTACT"))
      .map(({ code, data }) => [code, data.cause]),
    [["PTACT-104", "event_after_finish"]],
  );
});

test("Grammar 5 actuals write retains governance and optimistic safe-write gates", async (t) => {
  const directory = await workspace(t);
  const target = path.join(directory, "actuals.pert");
  const original = source();
  await writeFile(target, original, "utf8");

  const preview = planTargetFinishActualsMutation(
    original,
    finishRequest(),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  const previewWrite = await persistTargetActualsResult(
    preview,
    TARGET_GRAMMAR_5_CAPABILITY,
    { mode: "in_place", target },
  );
  assert.equal(previewWrite.written, false);
  assert.equal(await readFile(target, "utf8"), original);

  const authorized = planTargetFinishActualsMutation(
    original,
    finishRequest(),
    TARGET_GRAMMAR_5_CAPABILITY,
    { governance: { intent: "persist" } },
  );
  assert.equal(authorized.ok, true);
  const staleTarget = path.join(directory, "stale.pert");
  await writeFile(staleTarget, original, "utf8");
  await assert.rejects(
    persistTargetActualsResult(
      authorized,
      TARGET_GRAMMAR_5_CAPABILITY,
      {
        mode: "in_place",
        target: staleTarget,
        expectedDigest: `sha256:${"0".repeat(64)}`,
      },
    ),
    (error) =>
      error instanceof SafeWriteConflictError &&
      error.reason === "expected_digest_mismatch",
  );
  assert.equal(await readFile(staleTarget, "utf8"), original);

  const written = await persistTargetActualsResult(
    authorized,
    TARGET_GRAMMAR_5_CAPABILITY,
    {
      mode: "in_place",
      target,
      expectedDigest: authorized.originalDigest,
    },
  );
  assert.equal(written.written, true);
  assert.equal(await readFile(target, "utf8"), authorized.updatedText);
});

function advanceSource() {
  return [
    "project ACTUALS:",
    "  version 5",
    '  title "actuals"',
    "  as_of 2026-07-28",
    "  duration_unit point",
    "  velocity 3p/1d",
    "  finish END",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    "milestone MID:",
    '  title "mid"',
    "",
    "milestone END:",
    '  title "end"',
    "",
    "task DONE_WORK NOW -> MID:",
    '  title "done work"',
    "  duration 3p",
    "  status done",
    "",
    "task OPEN_WORK MID -> END:",
    '  title "open work"',
    "  duration 3p",
    "  status active",
    "",
    "work_event WE-done:",
    "  model 1",
    "  task DONE_WORK",
    "  kind finish",
    "  occurred_at 2026-07-28T10:00:00+09:00",
    "",
    "work_event WE-open:",
    "  model 1",
    "  task OPEN_WORK",
    "  kind start",
    "  occurred_at 2026-07-28T11:00:00+09:00",
    "  planned_value 3p",
    "",
  ].join("\n");
}

test("actuals advance removes only events owned by removed tasks", () => {
  const preview = planTargetActualsAdvance(
    advanceSource(),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(preview.schemaVersion, "Perttool.MutationResult.v3");
  assert.equal(preview.ok, true);
  assert.equal(preview.lifecycle, null);
  assert.deepEqual(preview.advance.removedTaskIds, ["DONE_WORK"]);
  assert.deepEqual(preview.advance.removedWorkEventIds, ["WE-done"]);
  assert.doesNotMatch(preview.updatedText, /DONE_WORK|WE-done/);
  assert.match(preview.updatedText, /OPEN_WORK/);
  assert.match(preview.updatedText, /work_event WE-open:/);
  assert.deepEqual(preview.governance.affectedScopes, ["dag"]);

  const denied = planTargetActualsAdvance(
    advanceSource(),
    TARGET_GRAMMAR_5_CAPABILITY,
    { governance: { intent: "persist", actor: "codex" } },
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.governance.writeAuthorized, false);
  assert.equal(
    denied.diagnostics.some(({ code }) => code === "PTGOV-101"),
    true,
  );
});

test("authorized actuals advance uses the Grammar 5 safe-write path", async (t) => {
  const directory = await workspace(t);
  const target = path.join(directory, "advance.pert");
  const original = advanceSource();
  await writeFile(target, original, "utf8");
  const authorized = planTargetActualsAdvance(
    original,
    TARGET_GRAMMAR_5_CAPABILITY,
    { governance: { intent: "persist", actor: "user" } },
  );
  assert.equal(authorized.ok, true);
  assert.equal(authorized.governance.writeAuthorized, true);
  const write = await persistTargetActualsResult(
    authorized,
    TARGET_GRAMMAR_5_CAPABILITY,
    {
      mode: "in_place",
      target,
      expectedDigest: authorized.originalDigest,
    },
  );
  assert.equal(write.written, true);
  assert.equal(await readFile(target, "utf8"), authorized.updatedText);
  assert.doesNotMatch(await readFile(target, "utf8"), /WE-done/);
});

test("finish and actuals advance remain internal until Contract 6 activation", () => {
  for (const name of [
    "deriveWorkEventId",
    "planTargetFinishActualsMutation",
    "planTargetActualsAdvance",
    "persistTargetActualsResult",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
});

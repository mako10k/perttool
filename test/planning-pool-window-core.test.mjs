import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import { planningReshapeSha256 } from "../dist/planning-pool/reshape-normalize.js";
import {
  auditPlanningReshape,
  PLANNING_RESHAPE_CORE_CAPABILITY,
} from "../dist/planning-pool/reshape.js";
import {
  auditPlanningWindowMutation,
  inspectPlanningWindowSelection,
  PLANNING_WINDOW_CORE_CAPABILITY,
} from "../dist/planning-pool/window.js";

const q = (id) => `POOL::${id}`;

function source() {
  return `${[
    "project POOL:",
    "  version 9",
    '  title "Pool"',
    "  as_of 2026-08-25",
    "  duration_unit point",
    "  finish END",
    "",
    "work W1:",
    '  title "First"',
    "",
    "work W2:",
    '  title "Second"',
    "  depends_on:",
    "    W1",
    "",
    "work W3:",
    '  title "Third"',
    "  depends_on:",
    "    W2",
    "",
    "window SPRINT:",
    '  title "Sprint"',
    '  objective "Reach the reviewed outcome"',
    "  start 2026-08-01",
    "  end 2026-08-15",
    "  works:",
    "    W2",
    "    W3",
    "",
    "window RELEASE:",
    '  title "Release"',
    '  objective "Validate the release outcome"',
    "  start 2026-08-10",
    "  end 2026-09-01",
    "  works:",
    "    W1",
    "    W2",
    "",
    "window NEXT:",
    '  title "Next"',
    '  objective "Shape the next outcome"',
    "  start 2026-08-15",
    "  end 2026-08-30",
    "  works:",
    "    W3",
    "",
    "window CLOCK:",
    '  title "Clock"',
    '  objective "Observe a fixed-offset interval"',
    "  start 2026-08-01T00:00:00+09:00",
    "  end 2026-08-02T00:00:00+09:00",
    "  works:",
    "    W1",
    "",
    "work_order:",
    "  W1",
    "  W2",
    "  W3",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task BASE START -> END:",
    '  title "Base"',
    "  duration 1p",
    "",
  ].join("\n")}\n`;
}

function finalFields(overrides = {}) {
  return {
    title: "Iteration",
    objective: "Reach one explicit outcome",
    start: "2026-09-01",
    end: "2026-09-15",
    work_ids: [q("W1"), q("W3")],
    ...overrides,
  };
}

function request(text, operation, windowId, overrides = {}) {
  return {
    request_schema_version: "Perttool.WindowMutationRequest.v1",
    source_digest: planningReshapeSha256(text),
    operation,
    window_id: q(windowId),
    final: operation === "close" ? null : finalFields(),
    objective_disposition: operation === "close" ? "discard" : null,
    carry_over_work_ids: [],
    carry_over_target: null,
    ...overrides,
  };
}

function audit(input, text = source()) {
  return auditPlanningWindowMutation(text, input, PLANNING_WINDOW_CORE_CAPABILITY);
}

function compositeSource() {
  return `${[
    "project POOL:",
    "  version 9",
    '  title "Pool"',
    "  as_of 2026-08-25",
    "  duration_unit point",
    "  finish END",
    "",
    "work W1:",
    '  title "Source"',
    '  description "Move"',
    "",
    "work W2:",
    '  title "Stable"',
    "",
    "window NOW:",
    '  title "Now"',
    '  objective "Shape the current outcome"',
    "  works:",
    "    W1",
    "    W2",
    "",
    "window NEXT:",
    '  title "Next"',
    '  objective "Shape the next outcome"',
    "  works:",
    "    W2",
    "",
    "work_order:",
    "  W1",
    "  W2",
    "",
    "milestone END:",
    '  title "End"',
    "  state reached",
    "",
  ].join("\n")}\n`;
}

function compositeCloseRequest(text) {
  return {
    request_schema_version: "Perttool.PlanningReshapeRequest.v1",
    normalization_contract: "perttool.planning-reshape-normalization@1",
    source_digest: planningReshapeSha256(text),
    intent: "composite",
    affected_work_ids: [q("W1"), q("W3")],
    created_works: [{ work_id: q("W3"), title: "Moved", insert_after_work_id: q("W1") }],
    removed_work_ids: [],
    semantic_elements: [{
      element_id: "MOVE",
      origin: { kind: "existing", work_id: q("W1"), start_utf16: 0, end_utf16: 4, source_text: "Move" },
      destination: { kind: "work", work_id: q("W3"), position: 0, text: "Move" },
    }],
    planning_entity_dispositions: [],
    association_dispositions: [],
    projection_link_dispositions: [],
    dependency_dispositions: [],
    window_membership_dispositions: [{ window_id: q("NOW"), origin_work_id: q("W1"), destination_work_id: q("W3") }],
    final_work_order: [q("W1"), q("W3"), q("W2")],
    add_residual_description: [],
    strict_fragment: null,
    window_close: {
      window_id: q("NOW"),
      objective_disposition: "discard",
      carry_over_work_ids: [q("W3")],
      carry_over_target: { kind: "existing", window_id: q("NEXT") },
    },
  };
}

test("PPWC-001 fixes a private capability and sixteen dependency-ordered cases", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/planning-pool-window-core-v1.json", "utf8"));
  assert.deepEqual(fixture.cases.map(({ id }) => id), Array.from({ length: 16 }, (_, index) => `PPWC-${String(index + 1).padStart(3, "0")}`));
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.equal(Object.isFrozen(PLANNING_WINDOW_CORE_CAPABILITY), true);
  const unknown = request(source(), "add", "NEW");
  unknown.unexpected = true;
  assert.equal(audit(unknown).ok, false);
  assert.throws(
    () => auditPlanningWindowMutation(source(), request(source(), "add", "NEW"), { ...PLANNING_WINDOW_CORE_CAPABILITY }),
    /private planning Window Core capability/u,
  );
});

test("PPWC-002 and PPWC-003 add and set complete persisted Windows", () => {
  const text = source();
  const added = audit(request(text, "add", "ITERATION"), text);
  assert.equal(added.ok, true, JSON.stringify(added.diagnostics));
  assert.match(added.candidateText, /window ITERATION:[\s\S]*objective "Reach one explicit outcome"[\s\S]*works:\n    W1\n    W3\n\nwork_order:/u);
  assert.equal(added.before, null);
  assert.equal(added.after.qualifiedId, q("ITERATION"));
  assert.deepEqual(added.destructiveRecords, []);

  const set = audit(request(text, "set", "SPRINT", {
    final: finalFields({
      title: "Sprint revised",
      objective: "Reach a revised reviewed outcome",
      start: null,
      end: "2026-08-20",
      work_ids: [q("W3")],
    }),
  }), text);
  assert.equal(set.ok, true, JSON.stringify(set.diagnostics));
  assert.equal(set.before.qualifiedId, q("SPRINT"));
  assert.deepEqual(set.after.workIds, [q("W3")]);
  assert.match(set.candidateText, /window SPRINT:\n  title "Sprint revised"\n  objective "Reach a revised reviewed outcome"\n  end 2026-08-20\n  works:\n    W3/u);
});

test("PPWC-004 through PPWC-008 keep selection, overlap, and dependency facts advisory", () => {
  const text = source();
  const persisted = inspectPlanningWindowSelection(
    text,
    { kind: "persisted", window_id: q("SPRINT") },
    PLANNING_WINDOW_CORE_CAPABILITY,
  );
  assert.equal(persisted.ok, true, JSON.stringify(persisted.diagnostics));
  assert.deepEqual(persisted.orderedWorkIds, [q("W2"), q("W3")]);
  assert.deepEqual(persisted.dependencies, [
    { dependentWorkId: q("W2"), prerequisiteWorkId: q("W1"), covered: false },
    { dependentWorkId: q("W3"), prerequisiteWorkId: q("W2"), covered: true },
  ]);
  assert.deepEqual(persisted.membershipOverlaps, [
    { windowId: q("RELEASE"), sharedWorkIds: [q("W2")] },
    { windowId: q("NEXT"), sharedWorkIds: [q("W3")] },
  ]);
  assert.deepEqual(persisted.temporalOverlaps, [
    { windowId: q("RELEASE"), state: "overlap", intersectionStart: "2026-08-10", intersectionEnd: "2026-08-15", cause: null },
    { windowId: q("NEXT"), state: "disjoint", intersectionStart: null, intersectionEnd: null, cause: null },
    { windowId: q("CLOCK"), state: "unavailable", intersectionStart: null, intersectionEnd: null, cause: "incomparable_temporal_kinds" },
  ]);

  const adHoc = inspectPlanningWindowSelection(
    text,
    { kind: "ad_hoc", title: null, objective: null, start: null, end: null, work_ids: [] },
    PLANNING_WINDOW_CORE_CAPABILITY,
  );
  assert.equal(adHoc.ok, true, JSON.stringify(adHoc.diagnostics));
  assert.equal(adHoc.selection.qualifiedId, null);
  assert.deepEqual(adHoc.orderedWorkIds, []);
  assert.equal(adHoc.sourceDigest, planningReshapeSha256(text));
  assert.equal(adHoc.selection.workIds.length, 0);
});

test("PPWC-009 through PPWC-012 close contracts only the selected Window and carries explicitly", () => {
  const text = source();
  const empty = audit(request(text, "close", "SPRINT"), text);
  assert.equal(empty.ok, true, JSON.stringify(empty.diagnostics));
  assert.doesNotMatch(empty.candidateText, /^window SPRINT:$/mu);
  assert.match(empty.candidateText, /^window RELEASE:$/mu);
  assert.deepEqual(empty.closeReport.carryOver, []);
  assert.equal(empty.closeReport.removedWindow.objective, "Reach the reviewed outcome");

  const existing = audit(request(text, "close", "SPRINT", {
    carry_over_work_ids: [q("W2"), q("W3")],
    carry_over_target: { kind: "existing", window_id: q("RELEASE") },
  }), text);
  assert.equal(existing.ok, true, JSON.stringify(existing.diagnostics));
  assert.deepEqual(existing.closeReport.carryOver, [
    { workId: q("W2"), targetWindowId: q("RELEASE"), status: "already_selected" },
    { workId: q("W3"), targetWindowId: q("RELEASE"), status: "selected" },
  ]);
  assert.match(existing.candidateText, /window RELEASE:[\s\S]*works:\n    W1\n    W2\n    W3/u);
  assert.match(existing.candidateText, /^window NEXT:$/mu);

  const next = audit(request(text, "close", "SPRINT", {
    carry_over_work_ids: [q("W2"), q("W3")],
    carry_over_target: {
      kind: "new",
      window_id: q("FOLLOW_UP"),
      title: "Follow up",
      objective: "Reach the carried outcome",
      start: "2026-08-15",
      end: null,
    },
  }), text);
  assert.equal(next.ok, true, JSON.stringify(next.diagnostics));
  assert.equal(next.closeReport.targetCreated, true);
  assert.match(next.candidateText, /window FOLLOW_UP:[\s\S]*works:\n    W2\n    W3/u);
  assert.doesNotMatch(next.candidateText, /objective "Reach the reviewed outcome"/u);
  assert.match(next.candidateText, /^task BASE START -> END:$/mu);

  const compositeText = compositeSource();
  const composite = auditPlanningReshape(
    compositeText,
    compositeCloseRequest(compositeText),
    PLANNING_RESHAPE_CORE_CAPABILITY,
  );
  assert.equal(composite.ok, true, JSON.stringify(composite.diagnostics));
  assert.equal(composite.windowCloseReport.removedWindow.qualifiedId, q("NOW"));
  assert.deepEqual(composite.windowCloseReport.carryOver, [
    { workId: q("W3"), targetWindowId: q("NEXT"), status: "selected" },
  ]);
  assert.doesNotMatch(composite.candidateText, /^window NOW:$/mu);
  assert.match(composite.candidateText, /window NEXT:[\s\S]*works:\n    W2\n    W3/u);
  assert.match(composite.candidateText, /work W3:[\s\S]*description "Move"/u);
  const wrongIntent = compositeCloseRequest(compositeText);
  wrongIntent.intent = "reshape";
  assert.equal(auditPlanningReshape(compositeText, wrongIntent, PLANNING_RESHAPE_CORE_CAPABILITY).ok, false);
});

test("PPWC-013 rejects invalid objectives, bounds, membership, and implicit carry-over", () => {
  const text = source();
  const invalid = [
    request(text, "add", "BAD_OBJECTIVE", { final: finalFields({ objective: "" }) }),
    request(text, "add", "BAD_BOUNDS", { final: finalFields({ start: "2026-09-15", end: "2026-09-01" }) }),
    request(text, "add", "BAD_WORK", { final: finalFields({ work_ids: [q("UNKNOWN")] }) }),
    request(text, "close", "SPRINT", { carry_over_work_ids: [q("W2")] }),
    request(text, "close", "SPRINT", { objective_disposition: null }),
    request(text, "close", "SPRINT", {
      carry_over_work_ids: [q("W1")],
      carry_over_target: { kind: "existing", window_id: q("RELEASE") },
    }),
  ];
  for (const item of invalid) {
    const result = audit(item, text);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics.some(({ code }) => code === "PTPOOL-107"), true);
    assert.equal(result.candidateText, null);
  }
});

test("PPWC-014 and PPWC-015 bind candidates and classify canonical history without DAG authority", () => {
  const text = source();
  const stale = request(text, "set", "SPRINT", { source_digest: `sha256:${"0".repeat(64)}` });
  const staleResult = audit(stale, text);
  assert.equal(staleResult.ok, false);
  assert.equal(staleResult.diagnostics.some(({ code }) => code === "PTPOOL-111"), true);

  const result = audit(request(text, "close", "SPRINT", {
    carry_over_work_ids: [q("W2"), q("W3")],
    carry_over_target: { kind: "existing", window_id: q("RELEASE") },
  }), text);
  assert.equal(result.candidateDigest, planningReshapeSha256(result.candidateText));
  assert.deepEqual(result.destructiveRecords.map(({ qualifiedId, ownerClass }) => [qualifiedId, ownerClass]), [
    [q("SPRINT"), "canonical"],
    [q("RELEASE"), "canonical"],
  ]);
  assert.deepEqual(result.authorityImpact, {
    affectedScopes: [], ordinaryMaintenance: true, userResponseRequired: false,
  });
});

test("PPWC-016 keeps the Window Core private and the public runtime unchanged", () => {
  assert.equal(rootApi.COMMAND_REGISTRY.length, 67);
  assert.equal(rootApi.getJsonSchemaCatalog().length, 26);
  assert.equal(Object.keys(rootApi).length, 139);
  assert.equal(Object.keys(nodeApi).length, 139);
  assert.equal(Object.keys(coreApi).length, 51);
  assert.equal("auditPlanningWindowMutation" in rootApi, false);
  assert.equal(rootApi.checkDocument(source()).ok, true);
});

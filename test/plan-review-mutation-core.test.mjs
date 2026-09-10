import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import {
  planPlanReviewCreate,
  planPlanReviewResolve,
} from "../dist/application/plan-review-mutation.js";
import { planPlanReviewResolve as planCoreResolve } from "../dist/plan-review/mutation.js";
import {
  PLAN_REVIEW_AUTHORITY_ID,
  PLAN_REVIEW_CREATE_REQUEST_ID,
  PLAN_REVIEW_RESOLVE_REQUEST_ID,
} from "../dist/plan-review/mutation-types.js";
import {
  normalizePlanReviewCreateRequest,
  normalizePlanReviewResolveRequest,
} from "../dist/plan-review/request.js";
import { persistPlanReviewMutation } from "../dist/plan-review/write.js";
import { SafeWriteConflictError } from "../dist/io/safe-write.js";

function source() {
  return `${[
    "project REVIEW:",
    "  version 10",
    '  title "Review"',
    "  as_of 2026-09-10",
    "  duration_unit point",
    "  velocity 4p/1d",
    "  finish END",
    "  dag_owner user",
    "  dag_delegates [delegate]",
    "",
    "resource DEV:",
    '  title "Developer"',
    "  capacity 1",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task TASK_A START -> END:",
    '  title "Task A"',
    '  description "Deliver the outcome"',
    "  duration 2p",
    "  priority 7",
    "  requires:",
    "    DEV 1",
    "",
  ].join("\n")}\n`;
}

function createInput(overrides = {}) {
  return {
    schemaVersion: PLAN_REVIEW_CREATE_REQUEST_ID,
    requestId: "PRR_001",
    taskId: "TASK_A",
    reason: "Review the estimate",
    createdAt: "2026-09-10T15:30:00+09:00",
    actor: "codex",
    ...overrides,
  };
}

function resolveInput(overrides = {}) {
  return {
    schemaVersion: PLAN_REVIEW_RESOLVE_REQUEST_ID,
    requestId: "PRR_001",
    outcome: "plan_retained",
    resolvedAt: "2026-09-10T16:15:00+09:00",
    actor: "user",
    resolutionReason: "Reviewed",
    ...overrides,
  };
}

function changedBatch(duration = "3p") {
  return {
    kind: "batch",
    mutations: [{ kind: "task.set", id: "TASK_A", set: { duration } }],
  };
}

function openSource() {
  const result = planPlanReviewCreate(source(), createInput());
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.updatedText;
}

function codes(result) {
  return result.diagnostics.map(({ code }) => code);
}

test("PRMC-001 normalizes only the closed create and resolve identities", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/plan-review-mutation-core-v1.json", "utf8"));
  const accepted = new Set();
  assert.deepEqual(fixture.cases.map(({ id }) => id),
    Array.from({ length: 14 }, (_, index) => `PRMC-${String(index + 1).padStart(3, "0")}`));
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.equal(PLAN_REVIEW_AUTHORITY_ID, "Perttool.PlanReviewAuthorityDecision.v1");
  assert.equal(normalizePlanReviewCreateRequest({ ...createInput(), extra: true }).ok, false);
  assert.equal(normalizePlanReviewCreateRequest(createInput({ createdAt: "2026-09-10T06:30:00Z" })).ok, false);
  assert.equal(normalizePlanReviewResolveRequest(resolveInput({ request: changedBatch() })).ok, false);
  assert.equal(normalizePlanReviewResolveRequest(resolveInput({
    outcome: "plan_changed", request: { ...changedBatch(), extra: true },
  })).ok, false);
  assert.equal(normalizePlanReviewResolveRequest(resolveInput({
    outcome: "plan_changed", request: { kind: "batch", mutations: [{ kind: "plan_review.create" }] },
  })).ok, false);
  assert.equal(normalizePlanReviewResolveRequest(resolveInput({
    outcome: "plan_changed", request: {
      kind: "batch", mutations: [{ kind: "task.set", id: "TASK_A", set: { duration: "3p" }, extra: true }],
    },
  })).ok, false);
});

test("PRMC-002 creates once and treats the exact normalized create as a no-op", () => {
  const created = planPlanReviewCreate(source(), createInput());
  assert.equal(created.ok, true, JSON.stringify(created.diagnostics));
  assert.equal(created.changed, true);
  assert.equal(created.requestAfter.locator, null);
  assert.equal(created.projectionBefore.state, "clear");
  assert.equal(created.projectionAfter.state, "review_required");
  const replay = planPlanReviewCreate(created.updatedText, createInput());
  assert.equal(replay.ok, true);
  assert.equal(replay.changed, false);
  assert.deepEqual(replay.edits, []);
  assert.equal(replay.updatedText, created.updatedText);
});

test("PRMC-003 rejects a conflicting create and inserts requests by ID", () => {
  const first = planPlanReviewCreate(source(), createInput({ requestId: "PRR_002" }));
  const second = planPlanReviewCreate(first.updatedText, createInput({ requestId: "PRR_001" }));
  assert.equal(second.ok, true, JSON.stringify(second.diagnostics));
  assert.ok(second.updatedText.indexOf("plan_review_request PRR_001") <
    second.updatedText.indexOf("plan_review_request PRR_002"));
  const conflict = planPlanReviewCreate(second.updatedText, createInput({ reason: "Different" }));
  assert.equal(conflict.ok, false);
  assert.deepEqual(codes(conflict), ["PTREV-105"]);
  assert.equal(conflict.updatedText, null);
});

test("PRMC-004 permits direct DAG owner and delegate resolution", () => {
  for (const actor of ["user", "delegate"]) {
    const result = planPlanReviewResolve(openSource(), resolveInput({ actor }));
    assert.equal(result.ok, true, `${actor}: ${JSON.stringify(result.diagnostics)}`);
    assert.equal(result.planReviewAuthority.actor_direct, true);
    assert.equal(result.planReviewAuthority.authorized, true);
    assert.equal(result.requestAfter.outcome, "plan_retained");
    assert.equal(result.projectionAfter.state, "clear");
  }
});

test("PRMC-005 requires the exact owner assertion for a non-direct actor", () => {
  const denied = planPlanReviewResolve(openSource(), resolveInput({ actor: "codex" }));
  assert.equal(denied.ok, false);
  assert.deepEqual(codes(denied), ["PTREV-106"]);
  assert.equal(denied.planReviewAuthority.owner_confirmation_required, true);
  assert.equal(denied.updatedText, null);
  const confirmed = planPlanReviewResolve(openSource(), resolveInput({
    actor: "codex", acceptedOwners: ["user"],
  }));
  assert.equal(confirmed.ok, true, JSON.stringify(confirmed.diagnostics));
  assert.equal(confirmed.planReviewAuthority.owner_confirmation_satisfied, true);
});

test("PRMC-006 rejects a stale expected source digest before candidate construction", () => {
  const result = planPlanReviewResolve(openSource(), resolveInput(), {
    expectedDigest: `sha256:${"0".repeat(64)}`,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["PTREV-106"]);
  assert.equal(result.requestBefore, null);
  assert.equal(result.updatedText, null);
});

test("PRMC-007 retains an equal semantic basis without storing basis fields", () => {
  const result = planPlanReviewResolve(openSource(), resolveInput());
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.planBasis, {
    status: "unchanged", beforeDigest: null, afterDigest: null,
  });
  assert.doesNotMatch(result.updatedText, /plan_basis_/u);
  assert.match(result.updatedText, /reviewed_source_digest sha256:[0-9a-f]{64}/u);
});

test("PRMC-008 composes one guarded plan change and one resolution candidate", () => {
  const result = planPlanReviewResolve(openSource(), resolveInput({
    outcome: "plan_changed", request: changedBatch(),
  }));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.composedMutation.ok, true);
  assert.equal(result.planBasis.status, "changed");
  assert.notEqual(result.planBasis.beforeDigest, result.planBasis.afterDigest);
  assert.match(result.updatedText, /duration 3p/u);
  assert.match(result.updatedText, /change_request_digest sha256:[0-9a-f]{64}/u);
  assert.equal(result.edits.length, 2);
});

test("PRMC-009 preserves an independent composed guard failure", () => {
  const guard = Object.freeze({
    ok: false, changed: false, originalDigest: `sha256:${"1".repeat(64)}`,
    updatedDigest: null, updatedText: null, edits: Object.freeze([]),
    diagnostics: Object.freeze([{ code: "PTGOV-101", severity: "error", message: "denied" }]),
    diagnosticsTruncated: false,
  });
  const result = planCoreResolve(openSource(), resolveInput({
    outcome: "plan_changed", request: changedBatch(),
  }), {}, { composeBatch: () => guard });
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["PTGOV-101", "PTREV-109"]);
  assert.equal(result.composedMutation, guard);
  assert.equal(result.updatedText, null);
});

test("PRMC-010 rejects plan_changed when only excluded presentation meaning changes", () => {
  const result = planPlanReviewResolve(openSource(), resolveInput({
    outcome: "plan_changed",
    request: { kind: "batch", mutations: [{ kind: "project.set", set: { title: "Renamed" } }] },
  }));
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), ["PTREV-107"]);
  assert.equal(result.updatedText, null);
});

test("PRMC-011 short-circuits exact changed replay and rejects a batch digest mismatch", () => {
  const request = resolveInput({ outcome: "plan_changed", request: changedBatch() });
  const resolved = planPlanReviewResolve(openSource(), request);
  assert.equal(resolved.ok, true, JSON.stringify(resolved.diagnostics));
  const replay = planPlanReviewResolve(resolved.updatedText, request);
  assert.equal(replay.ok, true);
  assert.equal(replay.changed, false);
  assert.equal(replay.composedMutation, null);
  assert.equal(replay.planReviewAuthority, null);
  const mismatch = planPlanReviewResolve(resolved.updatedText,
    { ...request, request: changedBatch("4p") });
  assert.equal(mismatch.ok, false);
  assert.deepEqual(codes(mismatch), ["PTREV-105"]);
  assert.equal(mismatch.updatedText, null);
});

test("PRMC-012 binds authority and composed mutation to the complete candidate", () => {
  const original = openSource();
  const result = planPlanReviewResolve(original, resolveInput({
    outcome: "plan_changed", request: changedBatch(),
  }));
  assert.equal(result.planReviewAuthority.source_digest, result.originalDigest);
  assert.equal(result.planReviewAuthority.candidate_digest, result.updatedDigest);
  assert.equal(result.composedMutation.originalDigest, result.originalDigest);
  assert.match(result.diff, /duration 3p/u);
  assert.match(result.diff, /outcome plan_changed/u);
});

test("PRMC-013 persists only one validated digest-bound candidate", async () => {
  const result = planPlanReviewResolve(openSource(), resolveInput());
  const calls = [];
  const persistence = {
    replaceValidatedDocument: async (target, candidate, options, validate) => {
      calls.push({ mode: "in_place", target, candidate, options });
      assert.equal(validate(candidate).ok, true);
      return { mode: "in_place", target, written: true, digest: result.updatedDigest };
    },
    createValidatedDocument: async () => assert.fail("unexpected create"),
    createValidatedDocumentFromSource: async (sourcePath, target, candidate, validate, options) => {
      calls.push({ mode: "out", sourcePath, target, candidate, options });
      assert.equal(validate(candidate).ok, true);
      return { mode: "out", target, written: true, digest: result.updatedDigest };
    },
    createArtifact: async () => assert.fail("unexpected artifact"),
  };
  const written = await persistPlanReviewMutation(result, {
    mode: "in_place", target: "/plan.pert", expectedDigest: result.originalDigest,
  }, persistence);
  assert.deepEqual(written, { mode: "in_place", target: "/plan.pert", written: true });
  assert.equal(calls.length, 1);
  const output = await persistPlanReviewMutation(result, {
    mode: "out", source: "/plan.pert", target: "/candidate.pert",
  }, persistence);
  assert.deepEqual(output, { mode: "out", target: "/candidate.pert", written: true });
  assert.equal(calls[0].candidate, calls[1].candidate);
  assert.equal(calls.length, 2);
  await assert.rejects(
    persistPlanReviewMutation(result, {
      mode: "in_place", target: "/plan.pert", expectedDigest: `sha256:${"0".repeat(64)}`,
    }, persistence),
    SafeWriteConflictError,
  );
  assert.equal(calls.length, 2);
});

test("PRMC-014 leaves root, Node, Core, and CLI Application exports unchanged", () => {
  for (const api of [rootApi, nodeApi, coreApi]) {
    for (const name of [
      "planPlanReviewCreate", "planPlanReviewResolve", "persistPlanReviewMutation",
      "PLAN_REVIEW_CREATE_REQUEST_ID", "PLAN_REVIEW_RESOLVE_REQUEST_ID",
    ]) assert.equal(name in api, false, name);
  }
});

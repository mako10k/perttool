import assert from "node:assert/strict";
import test from "node:test";
import {
  planPlanReviewBatchMutation,
  planPlanReviewCreate,
  planPlanReviewResolve,
} from "../dist/application/plan-review-mutation.js";
import {
  assessPlanReviewAdvanceHistory,
  composePlanReviewAdvanceCandidate,
} from "../dist/plan-review/advance.js";
import { assessPlanReviewTaskLifecycle } from "../dist/plan-review/lifecycle.js";

const creation = (requestId) => ({
  schemaVersion: "Perttool.PlanReviewCreateRequest.v1",
  requestId, taskId: "TASK_A", reason: "Review the plan",
  createdAt: "2026-09-10T15:30:00+09:00", actor: "codex",
});
const resolution = (requestId, overrides = {}) => ({
  schemaVersion: "Perttool.PlanReviewResolveRequest.v1",
  requestId, outcome: "plan_retained",
  resolvedAt: "2026-09-10T16:15:00+09:00", actor: "user",
  resolutionReason: "Reviewed", ...overrides,
});

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
    "  duration 2p",
    "  status done",
    "  priority 7",
    "  requires:",
    "    DEV 1",
    "",
    "task TASK_B START -> END:",
    '  title "Task B"',
    "  duration 1p",
    "  priority 6",
    "  requires:",
    "    DEV 1",
    "",
  ].join("\n")}\n`;
}

function withRequests(ids) {
  return ids.reduce((text, id) => {
    const result = planPlanReviewCreate(text, creation(id));
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    return result.updatedText;
  }, source());
}

function removeTaskEdit(text) {
  const startOffset = text.indexOf("task TASK_A START -> END:");
  const endOffset = text.indexOf("task TASK_B START -> END:", startOffset);
  assert.notEqual(startOffset, -1);
  assert.notEqual(endOffset, -1);
  return { startOffset, endOffset, replacement: "" };
}

const renameBatch = Object.freeze({
  kind: "batch",
  mutations: Object.freeze([
    Object.freeze({ kind: "task.remove", id: "TASK_A" }),
    Object.freeze({ kind: "task.add", id: "TASK_C", from: "START", to: "END",
      task: Object.freeze({ title: "Task C", duration: "2p" }) }),
  ]),
});

test("open references block ordinary removal with declaration-order IDs", () => {
  const text = withRequests(["PRR_A", "PRR_B"]);
  const result = planPlanReviewBatchMutation(text, {
    kind: "batch", mutations: [{ kind: "task.remove", id: "TASK_A" }],
  }, { governance: { intent: "persist", actor: "user" } });
  assert.equal(result.ok, false);
  assert.equal(result.updatedText, null);
  const blocking = result.diagnostics.find(({ code }) => code === "PTREV-108");
  assert.deepEqual(blocking.data.request_ids, ["PRR_A", "PRR_B"]);
});

test("ordinary mutations preserve resolved historical declaration bytes", () => {
  const opened = withRequests(["PRR_A"]);
  const resolved = planPlanReviewResolve(opened, resolution("PRR_A"));
  assert.equal(resolved.ok, true, JSON.stringify(resolved.diagnostics));
  const changed = planPlanReviewBatchMutation(resolved.updatedText, {
    kind: "batch", mutations: [{ kind: "task.remove", id: "TASK_A" }],
  }, { governance: { intent: "persist", actor: "user" } });
  assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
  assert.match(changed.updatedText, /plan_review_request PRR_A TASK_A:/u);
  assert.deepEqual(assessPlanReviewTaskLifecycle(resolved.updatedText,
    changed.updatedText, "ordinary").removedRequestIds, []);
});

test("remove-and-add rename blocks open references and accepts atomic resolution", () => {
  const opened = withRequests(["PRR_A"]);
  const denied = planPlanReviewBatchMutation(opened, renameBatch,
    { governance: { intent: "persist", actor: "user" } });
  assert.equal(denied.ok, false);
  assert.deepEqual(denied.diagnostics.find(({ code }) => code === "PTREV-108")?.data.request_ids,
    ["PRR_A"], JSON.stringify(denied.diagnostics));
  const resolved = planPlanReviewResolve(opened, resolution("PRR_A", {
    outcome: "plan_changed", request: renameBatch,
  }));
  assert.equal(resolved.ok, true, JSON.stringify(resolved.diagnostics));
  assert.match(resolved.updatedText, /task TASK_C START -> END:/u);
  assert.match(resolved.updatedText, /plan_review_request PRR_A TASK_A:/u);
  assert.match(resolved.updatedText, /outcome plan_changed/u);
});

test("advance removes input-pre-resolved requests with their Task", () => {
  const opened = withRequests(["PRR_A"]);
  const resolved = planPlanReviewResolve(opened, resolution("PRR_A"));
  assert.equal(resolved.ok, true, JSON.stringify(resolved.diagnostics));
  const text = resolved.updatedText;
  const candidate = composePlanReviewAdvanceCandidate(text,
    [removeTaskEdit(text)], ["TASK_A"]);
  assert.equal(candidate.ok, true, JSON.stringify(candidate.diagnostics));
  assert.deepEqual(candidate.removedRequestIds, ["PRR_A"]);
  assert.equal(candidate.destructiveRecords.length, 1);
  assert.equal(candidate.destructiveRecords[0].entityKind, "plan_review_request");
  assert.equal(candidate.updatedText.includes("plan_review_request"), false);
});

test("advance blocks a still-open request and retains a same-candidate resolution", () => {
  const text = withRequests(["PRR_A"]);
  const blocked = composePlanReviewAdvanceCandidate(text,
    [removeTaskEdit(text)], ["TASK_A"]);
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.blockingRequestIds, ["PRR_A"]);
  assert.equal(blocked.diagnostics.some(({ code }) => code === "PTREV-108"), true);

  const resolved = planPlanReviewResolve(text, resolution("PRR_A", {
    outcome: "plan_changed",
    request: { kind: "batch", mutations: [{ kind: "task.remove", id: "TASK_A" }] },
  }));
  assert.equal(resolved.ok, true, JSON.stringify(resolved.diagnostics));
  const retained = composePlanReviewAdvanceCandidate(text, resolved.edits, ["TASK_A"]);
  assert.equal(retained.ok, true, JSON.stringify(retained.diagnostics));
  assert.deepEqual(retained.removedRequestIds, []);
  assert.match(retained.updatedText, /plan_review_request PRR_A TASK_A:/u);
  assert.match(retained.updatedText, /outcome plan_changed/u);
});

test("a plan_changed removal rejects another open request for the same Task", () => {
  const text = withRequests(["PRR_A", "PRR_B"]);
  const result = planPlanReviewResolve(text, resolution("PRR_A", {
    outcome: "plan_changed",
    request: { kind: "batch", mutations: [{ kind: "task.remove", id: "TASK_A" }] },
  }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.find(({ code }) => code === "PTREV-108")?.data.request_ids,
    ["PRR_B"], JSON.stringify(result.diagnostics));
});

test("removed declaration requires exact current, HEAD, and stage-0 bytes", () => {
  const opened = withRequests(["PRR_A"]);
  const resolved = planPlanReviewResolve(opened, resolution("PRR_A"));
  assert.equal(resolved.ok, true);
  const text = resolved.updatedText;
  const candidate = composePlanReviewAdvanceCandidate(text,
    [removeTaskEdit(text)], ["TASK_A"]);
  assert.equal(candidate.ok, true);
  const bytes = (value) => new TextEncoder().encode(value);
  const baseline = {
    status: "complete", currentSource: bytes(text), headSource: bytes(text),
    indexSource: bytes(text), repositorySnapshotId: "snapshot",
    repositoryRelativePath: "plan.pert", headCommitId: "head",
  };
  assert.equal(assessPlanReviewAdvanceHistory(text, candidate, baseline).status, "passed");
  const changedHead = { ...baseline, headSource: bytes(text.replace(
    'resolution_reason "Reviewed"', 'resolution_reason "Changed"')) };
  const denied = assessPlanReviewAdvanceHistory(text, candidate, changedHead);
  assert.equal(denied.status, "blocked");
  assert.deepEqual(denied.overlappingEntityIds, ["REVIEW::PRR_A"]);
  assert.equal(assessPlanReviewAdvanceHistory(text, candidate,
    changedHead, true).status, "forced");
  const changedIndex = { ...baseline, indexSource: bytes(text.replace(
    'resolution_reason "Reviewed"', 'resolution_reason "Changed"')) };
  assert.equal(assessPlanReviewAdvanceHistory(text, candidate,
    changedIndex).status, "blocked");
});

test("BOM and CRLF remain part of exact advance history correspondence", () => {
  const opened = withRequests(["PRR_A"]);
  const resolved = planPlanReviewResolve(opened, resolution("PRR_A"));
  assert.equal(resolved.ok, true);
  const text = `\uFEFF${resolved.updatedText.replaceAll("\n", "\r\n")}`;
  const candidate = composePlanReviewAdvanceCandidate(text,
    [removeTaskEdit(text)], ["TASK_A"]);
  assert.equal(candidate.ok, true, JSON.stringify(candidate.diagnostics));
  const bytes = new TextEncoder().encode(text);
  const baseline = {
    status: "complete", currentSource: bytes, headSource: bytes,
    indexSource: bytes, repositorySnapshotId: "snapshot",
    repositoryRelativePath: "plan.pert", headCommitId: "head",
  };
  assert.equal(assessPlanReviewAdvanceHistory(text, candidate, baseline).status,
    "passed");
});

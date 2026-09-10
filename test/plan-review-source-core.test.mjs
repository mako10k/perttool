import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import {
  canonicalPlanReviewBasisJson,
  digestPlanReviewBasis,
  PLAN_REVIEW_BASIS_ID,
  projectPlanReviewBasis,
} from "../dist/plan-review/basis.js";
import { formatPlanReviewSource } from "../dist/plan-review/format.js";
import { projectPlanReviewState } from "../dist/plan-review/projection.js";
import {
  parsePlanReviewSource,
  PLAN_REVIEW_REQUEST_FIELD_ORDER,
  PLAN_REVIEW_SOURCE_CAPABILITY,
  PLAN_REVIEW_SOURCE_LIMITS,
  PLAN_REVIEW_SOURCE_MODEL_VERSION,
} from "../dist/plan-review/source.js";

const digest = (value) => `sha256:${value.repeat(64)}`;

function openRequest({ id = "PRR_001", task = "TASK_A", reason = "Review the estimate", locator = null } = {}) {
  return [
    `plan_review_request ${id} ${task}:`,
    "  model 1",
    `  reason ${JSON.stringify(reason)}`,
    "  created_at 2026-09-10T15:30:00+09:00",
    "  created_by codex",
    ...(locator === null ? [] : [`  locator ${JSON.stringify(locator)}`]),
  ];
}

function resolvedRequest({ id = "PRR_002", task = "TASK_A", outcome = "plan_retained" } = {}) {
  return [
    `plan_review_request ${id} ${task}:`,
    "  model 1",
    '  reason "Review the estimate"',
    "  created_at 2026-09-10T15:30:00+09:00",
    "  created_by codex",
    `  outcome ${outcome}`,
    "  resolved_at 2026-09-10T16:15:00+09:00",
    "  resolved_by user",
    '  resolution_reason "Reviewed"',
    `  reviewed_source_digest ${digest("a")}`,
    ...(outcome === "plan_changed" ? [
      `  change_request_digest ${digest("b")}`,
      `  plan_basis_before ${digest("c")}`,
      `  plan_basis_after ${digest("d")}`,
    ] : []),
  ];
}

function source({ version = 10, requests = [openRequest()], taskStatus = "planned" } = {}) {
  return `${[
    "project REVIEW:",
    `  version ${version}`,
    '  title "Review"',
    "  as_of 2026-09-10",
    "  duration_unit point",
    "  velocity 4p/1d",
    "  finish END",
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
    `  status ${taskStatus}`,
    "  priority 7",
    "  requires:",
    "    DEV 1",
    "  tags [review, core]",
    "",
    ...requests.flatMap((request) => [...request, ""]),
  ].join("\n")}\n`;
}

function planningPoolSource(eventOrder) {
  return source().replace(
    "milestone START:",
    [
      "work WORK_A:",
      '  title "Outcome"',
      "  events:",
      ...eventOrder.map((id) => `    ${id}`),
      "",
      "event EVENT_A:",
      '  title "First"',
      "",
      "event EVENT_B:",
      '  title "Second"',
      "",
      "work_order:",
      "  WORK_A",
      "",
      "milestone START:",
    ].join("\n"),
  );
}

function parse(text, options) {
  return parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY, options);
}

function codes(result) {
  return result.diagnostics.map(({ code }) => code);
}

test("PRSC-001 keeps one private identity-checked Grammar 10 capability", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/plan-review-source-core-v1.json", "utf8"));
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    Array.from({ length: 12 }, (_, index) => `PRSC-${String(index + 1).padStart(3, "0")}`),
  );
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.equal(Object.isFrozen(PLAN_REVIEW_SOURCE_CAPABILITY), true);
  assert.equal(PLAN_REVIEW_SOURCE_MODEL_VERSION, 1);
  assert.equal(PLAN_REVIEW_BASIS_ID, "Perttool.PlanReviewBasis.v1");
  assert.deepEqual(PLAN_REVIEW_SOURCE_LIMITS, {
    sourceOrCandidateUtf8Bytes: 8_388_608,
    requests: 10_000,
    reasonUtf8Bytes: 16_384,
    resolutionReasonUtf8Bytes: 16_384,
    locatorUtf8Bytes: 8_192,
  });
  assert.deepEqual(PLAN_REVIEW_REQUEST_FIELD_ORDER, [
    "model", "reason", "created_at", "created_by", "locator", "outcome",
    "resolved_at", "resolved_by", "resolution_reason", "reviewed_source_digest",
    "change_request_digest", "plan_basis_before", "plan_basis_after",
  ]);
  assert.throws(
    () => parsePlanReviewSource("", { ...PLAN_REVIEW_SOURCE_CAPABILITY }),
    /Grammar 10 Plan Review source capability is required/u,
  );
});

test("PRSC-002 delegates unchanged Grammar 1 through 9 without a review model", () => {
  for (let version = 1; version <= 9; version += 1) {
    const result = parse(source({ version, requests: [] }));
    assert.equal(result.ok, true, `Grammar ${version}: ${JSON.stringify(result.diagnostics)}`);
    assert.equal(result.grammarVersion, version);
    assert.equal(result.model, null);
  }
});

test("PRSC-003 projects a complete open request in declaration order", () => {
  const result = parse(source({ requests: [
    openRequest({ id: "PRR_002", locator: "run:42" }),
    openRequest({ id: "PRR_001", reason: "Second observation" }),
  ] }));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.model.requests.map(({ id }) => id), ["PRR_002", "PRR_001"]);
  const request = result.model.requests[0];
  assert.equal(request.qualifiedId, "REVIEW::PRR_002");
  assert.equal(request.qualifiedTaskId, "REVIEW::TASK_A");
  assert.equal(request.taskReferenceState, "current");
  assert.equal(request.locator, "run:42");
  assert.equal(request.outcome, null);
  assert.equal(Object.isFrozen(request), true);
});

test("PRSC-004 distinguishes resolved current and historical Task references", () => {
  const current = parse(source({ requests: [resolvedRequest()] }));
  assert.equal(current.ok, true, JSON.stringify(current.diagnostics));
  assert.equal(current.model.requests[0].taskReferenceState, "current");
  const historical = parse(source({ requests: [resolvedRequest({ task: "REMOVED" })] }));
  assert.equal(historical.ok, true, JSON.stringify(historical.diagnostics));
  assert.equal(historical.model.requests[0].taskReferenceState, "historical");
  const invalidOpen = parse(source({ requests: [openRequest({ task: "REMOVED" })] }));
  assert.equal(codes(invalidOpen).includes("PTREV-102"), true);
});

test("PRSC-005 enforces conditional field sets and canonical field order", () => {
  const changed = parse(source({ requests: [resolvedRequest({ outcome: "plan_changed" })] }));
  assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
  assert.equal(changed.model.requests[0].changeRequestDigest, digest("b"));
  const missing = parse(source({ requests: [resolvedRequest({ outcome: "plan_changed" }).slice(0, -1)] }));
  assert.equal(codes(missing).includes("PTREV-101"), true);
  const extra = parse(source({ requests: [[...resolvedRequest(), `  plan_basis_before ${digest("c")}`]] }));
  assert.equal(codes(extra).includes("PTREV-101"), true);
  const reordered = parse(source({ requests: [[
    ...openRequest().slice(0, 2),
    openRequest()[3],
    openRequest()[2],
    ...openRequest().slice(4),
  ]] }));
  assert.equal(codes(reordered).includes("PTREV-101"), true);
  const equalBasis = resolvedRequest({ outcome: "plan_changed" })
    .map((line) => line.startsWith("  plan_basis_after ") ? `  plan_basis_after ${digest("c")}` : line);
  assert.equal(codes(parse(source({ requests: [equalBasis] }))).includes("PTREV-107"), true);
});

test("PRSC-006 closes the shared identity namespace and declaration region", () => {
  const collision = parse(source({ requests: [openRequest({ id: "TASK_A" })] }));
  assert.equal(codes(collision).includes("PTREV-101"), true);
  const duplicate = parse(source({ requests: [openRequest(), openRequest()] }));
  assert.equal(codes(duplicate).includes("PTREV-101"), true);
  const malformed = parse(source().replace("plan_review_request PRR_001 TASK_A:", "plan_review_request PRR_001:"));
  assert.equal(codes(malformed).includes("PTREV-101"), true);
});

test("PRSC-007 enforces exact source and free-text limits", () => {
  const longReason = "x".repeat(PLAN_REVIEW_SOURCE_LIMITS.reasonUtf8Bytes + 1);
  assert.equal(codes(parse(source({ requests: [openRequest({ reason: longReason })] }))).includes("PTREV-103"), true);
  const longLocator = "x".repeat(PLAN_REVIEW_SOURCE_LIMITS.locatorUtf8Bytes + 1);
  assert.equal(codes(parse(source({ requests: [openRequest({ locator: longLocator })] }))).includes("PTREV-103"), true);
  const oversized = `${source()}#${"x".repeat(PLAN_REVIEW_SOURCE_LIMITS.sourceOrCandidateUtf8Bytes)}\n`;
  assert.equal(codes(parse(oversized)).includes("PTREV-103"), true);
  const resolved = resolvedRequest().map((line) => line.startsWith("  resolution_reason ")
    ? `  resolution_reason ${JSON.stringify("x".repeat(PLAN_REVIEW_SOURCE_LIMITS.resolutionReasonUtf8Bytes + 1))}`
    : line);
  assert.equal(codes(parse(source({ requests: [resolved] }))).includes("PTREV-103"), true);
  assert.equal(codes(parse(source().replace(
    "2026-09-10T15:30:00+09:00",
    "2026-09-10T06:30:00Z",
  ))).includes("PTREV-101"), true);
  const tooMany = Array.from(
    { length: PLAN_REVIEW_SOURCE_LIMITS.requests + 1 },
    (_, index) => openRequest({ id: `PRR_${index}` }),
  );
  assert.equal(codes(parse(source({ requests: tooMany }))).includes("PTREV-103"), true);
});

test("PRSC-008 preserves BOM, CRLF, comments, spans, and format idempotence", () => {
  const text = `\uFEFF${source({ requests: [openRequest({ reason: "line\\nbreak" })] })}`
    .replace("  created_at 2026-09-10T15:30:00+09:00", "  # retained\n  created_at 2026-09-10T15:30:00.000+09:00")
    .replaceAll("\n", "\r\n");
  const result = parse(text);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const span = result.model.requests[0].idSpan;
  assert.equal(text.slice(span.start.offset, span.end.offset), "PRR_001");
  const formatted = formatPlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY);
  assert.equal(formatted.ok, true, JSON.stringify(formatted.diagnostics));
  assert.equal(formatted.changed, true);
  assert.equal(formatted.formattedText.startsWith("\uFEFFproject REVIEW:"), true);
  assert.equal(/(?<!\r)\n/u.test(formatted.formattedText), false);
  assert.match(formatted.formattedText, /# retained/u);
  assert.match(formatted.formattedText, /created_at 2026-09-10T15:30:00\+09:00/u);
  const repeated = formatPlanReviewSource(formatted.formattedText, PLAN_REVIEW_SOURCE_CAPABILITY);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
});

test("PRSC-009 derives advisory review state without changing request order", () => {
  const mixed = parse(source({ requests: [
    resolvedRequest(),
    openRequest({ id: "PRR_003" }),
    openRequest({ id: "PRR_004" }),
  ] }));
  assert.equal(mixed.ok, true, JSON.stringify(mixed.diagnostics));
  assert.deepEqual(projectPlanReviewState(mixed.model), {
    model_version: 1,
    state: "review_required",
    open_request_ids: ["PRR_003", "PRR_004"],
    required_actions: [{
      kind: "review_before_new_downstream_work",
      request_ids: ["PRR_003", "PRR_004"],
    }],
  });
  const clear = parse(source({ requests: [resolvedRequest()] }));
  assert.deepEqual(projectPlanReviewState(clear.model).required_actions, []);
  assert.equal(projectPlanReviewState(clear.model).state, "clear");
});

test("PRSC-010 projects the closed semantic plan basis", () => {
  const result = parse(source());
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  const basis = projectPlanReviewBasis(result.model);
  assert.equal(basis.model_version, 1);
  assert.deepEqual(basis.project, {
    id: "REVIEW",
    finish_milestone_id: "END",
    duration_unit: "point",
    velocity: "4p/1d",
    target_duration: null,
    critical_epsilon: "0p",
  });
  assert.equal(basis.resources[0].capacity, 1);
  assert.equal(basis.milestones.length, 2);
  assert.equal(basis.tasks[0].timing.value.numerator, "2");
  assert.equal(basis.tasks[0].description, "Deliver the outcome");
  assert.equal(basis.gates.length, 0);
  assert.equal(basis.planning_pool, null);
});

test("PRSC-011 fixes deterministic digest inclusion and exclusion", () => {
  const original = parse(source());
  const basis = projectPlanReviewBasis(original.model);
  const canonical = canonicalPlanReviewBasisJson(basis);
  assert.equal(JSON.parse(canonical).model_version, 1);
  assert.equal(canonicalPlanReviewBasisJson({ z: 1, a: 2 }), '{"a":2,"z":1}');
  assert.equal(digestPlanReviewBasis(basis), digestPlanReviewBasis(projectPlanReviewBasis(parse(source()).model)));
  const poolA = parse(planningPoolSource(["EVENT_B", "EVENT_A"]));
  const poolB = parse(planningPoolSource(["EVENT_A", "EVENT_B"]));
  assert.equal(poolA.ok, true, JSON.stringify(poolA.diagnostics));
  assert.equal(poolB.ok, true, JSON.stringify(poolB.diagnostics));
  assert.deepEqual(projectPlanReviewBasis(poolA.model).planning_pool.works[0].event_ids, ["EVENT_A", "EVENT_B"]);
  assert.equal(
    digestPlanReviewBasis(projectPlanReviewBasis(poolA.model)),
    digestPlanReviewBasis(projectPlanReviewBasis(poolB.model)),
  );
  for (const excluded of [
    source().replace('title "Review"', 'title "Presentation changed"'),
    source().replace("status planned", "status active"),
    source({ requests: [openRequest({ reason: "Changed request evidence" })] }),
  ]) {
    assert.equal(
      digestPlanReviewBasis(projectPlanReviewBasis(parse(excluded).model)),
      digestPlanReviewBasis(basis),
    );
  }
  for (const included of [
    source().replace('description "Deliver the outcome"', 'description "Changed plan"'),
    source().replace("duration 2p", "duration 3p"),
    source().replace("capacity 1", "capacity 2"),
  ]) {
    assert.notEqual(
      digestPlanReviewBasis(projectPlanReviewBasis(parse(included).model)),
      digestPlanReviewBasis(basis),
    );
  }
});

test("PRSC-012 retains the current public package surfaces", () => {
  for (const api of [rootApi, nodeApi, coreApi]) {
    for (const name of [
      "PLAN_REVIEW_SOURCE_CAPABILITY",
      "parsePlanReviewSource",
      "formatPlanReviewSource",
      "projectPlanReviewBasis",
      "projectPlanReviewState",
    ]) assert.equal(name in api, false, name);
  }
});

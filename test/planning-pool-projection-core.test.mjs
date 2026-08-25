import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import {
  auditPlanningProjection,
  PLANNING_PROJECTION_CORE_CAPABILITY,
  planningProjectionSourceIsValid,
} from "../dist/planning-pool/projection.js";
import {
  preflightPlanningReshape,
  preparePlanningReshapeApply,
  planningReshapeBinding,
  PLANNING_RESHAPE_CORE_CAPABILITY,
} from "../dist/planning-pool/reshape.js";
import {
  normalizePlanningReshapeRequest,
  planningReshapeSha256,
} from "../dist/planning-pool/reshape-normalize.js";
import { PlanningReshapeTokenRegistry } from "../dist/planning-pool/reshape-token.js";

const q = (id) => `POOL::${id}`;

function planningSource({ shared = true } = {}) {
  return `${[
    "project POOL:",
    "  version 9",
    '  title "Pool"',
    "  as_of 2026-08-24",
    "  duration_unit point",
    "  finish END",
    "  dag_owner owner",
    "",
    "work W1:",
    '  title "First Work"',
    '  description "Meaning one"',
    "  events:",
    "    MID",
    "  activities:",
    "    A1",
    "    A2",
    "",
    ...(shared ? [
      "work W2:",
      '  title "Second Work"',
      '  description "Meaning two"',
      "  events:",
      "    MID",
      "  activities:",
      "    A1",
      "",
    ] : []),
    "event MID:",
    '  title "Internal state"',
    '  description "Refined internal outcome"',
    "  tags [internal]",
    "",
    "activity A1 START -> MID:",
    '  title "Reach internal state"',
    '  description "First strict fragment"',
    "  duration 2p",
    "  priority 70",
    "  requires:",
    "    DEVELOPERS 1",
    "",
    "activity A2 MID -> END:",
    '  title "Reach finish"',
    "  estimate:",
    "    optimistic 1p",
    "    most_likely 2p",
    "    pessimistic 3p",
    '  owner "owner"',
    "",
    "work_order:",
    "  W1",
    ...(shared ? ["  W2"] : []),
    "",
    "resource DEVELOPERS:",
    '  title "Developers"',
    "  capacity 1",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task BASE START -> END:",
    '  title "Retained strict route"',
    "  duration 1p",
    "",
  ].join("\n")}\n`;
}

function baseRequest(text, overrides = {}) {
  return {
    request_schema_version: "Perttool.PlanningReshapeRequest.v1",
    normalization_contract: "perttool.planning-reshape-normalization@1",
    source_digest: planningReshapeSha256(text),
    intent: "project",
    affected_work_ids: [],
    created_works: [],
    removed_work_ids: [],
    semantic_elements: [],
    planning_entity_dispositions: [],
    association_dispositions: [],
    projection_link_dispositions: [],
    dependency_dispositions: [],
    window_membership_dispositions: [],
    final_work_order: [],
    add_residual_description: [],
    strict_fragment: { kind: "project", event_ids: [], activity_ids: [] },
    window_close: null,
    ...overrides,
  };
}

function unchangedDescription(workId, text) {
  return {
    element_id: `MEANING_${workId}`,
    origin: { kind: "existing", work_id: q(workId), start_utf16: 0, end_utf16: text.length, source_text: text },
    destination: { kind: "work", work_id: q(workId), position: 0, text },
  };
}

function projectRequest(text, { shared = true, acknowledge = false } = {}) {
  const workIds = shared ? ["W1", "W2"] : ["W1"];
  const associations = [
    ["event", "MID", "W1"],
    ["activity", "A1", "W1"],
    ["activity", "A2", "W1"],
    ...(shared ? [["event", "MID", "W2"], ["activity", "A1", "W2"]] : []),
  ];
  return baseRequest(text, {
    affected_work_ids: workIds.map(q),
    semantic_elements: [unchangedDescription("W1", "Meaning one"), ...(shared ? [unchangedDescription("W2", "Meaning two")] : [])],
    planning_entity_dispositions: [
      { entity_kind: "event", entity_id: q("MID"), action: "project" },
      { entity_kind: "activity", entity_id: q("A1"), action: "project" },
      { entity_kind: "activity", entity_id: q("A2"), action: "project" },
    ],
    association_dispositions: associations.map(([entity_kind, id, work]) => ({
      entity_kind, entity_id: q(id), origin_work_id: q(work), destination_work_id: null,
    })),
    projection_link_dispositions: associations.map(([entityKind, id, work]) => ({
      strict_kind: entityKind === "event" ? "milestone" : "task",
      strict_id: q(id), origin_work_id: null, destination_work_id: q(work),
    })),
    add_residual_description: acknowledge ? workIds.map((id) => ({ work_id: q(id), text: id === "W1" ? "Meaning one" : "Meaning two" })) : [],
    strict_fragment: { kind: "project", event_ids: [q("MID")], activity_ids: [q("A1"), q("A2")] },
  });
}

function deferralRequest(text, { active = false } = {}) {
  const taskLinks = [
    ["task", "A1", "W1"], ["task", "A2", "W1"], ["milestone", "MID", "W1"],
    ["task", "A1", "W2"], ["milestone", "MID", "W2"],
  ];
  return baseRequest(text, {
    intent: "defer",
    affected_work_ids: [q("W1"), q("W2")],
    semantic_elements: [unchangedDescription("W1", "Meaning one"), unchangedDescription("W2", "Meaning two")],
    planning_entity_dispositions: [
      { entity_kind: "event", entity_id: q("MID"), action: "defer" },
      { entity_kind: "activity", entity_id: q("A1"), action: "defer" },
      { entity_kind: "activity", entity_id: q("A2"), action: "defer" },
    ],
    association_dispositions: taskLinks.map(([strictKind, id, work]) => ({
      entity_kind: strictKind === "milestone" ? "event" : "activity",
      entity_id: q(id), origin_work_id: null, destination_work_id: q(work),
    })),
    projection_link_dispositions: taskLinks.map(([strict_kind, id, work]) => ({
      strict_kind, strict_id: q(id), origin_work_id: q(work), destination_work_id: null,
    })),
    strict_fragment: { kind: "defer", task_ids: [q("A1"), q("A2")], milestone_ids: [q("MID")] },
    ...(active ? { source_digest: planningReshapeSha256(text) } : {}),
  });
}

function project(text = planningSource()) {
  return auditPlanningProjection(text, projectRequest(text), PLANNING_PROJECTION_CORE_CAPABILITY);
}

function deterministicRegistry() {
  return new PlanningReshapeTokenRegistry({ randomBytes: (size) => new Uint8Array(size).fill(7) });
}

test("PPRJ-001 fixes a private capability and sixteen dependency-ordered cases", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/planning-pool-projection-core-v1.json", "utf8"));
  assert.deepEqual(fixture.cases.map(({ id }) => id), Array.from({ length: 16 }, (_, index) => `PPRJ-${String(index + 1).padStart(3, "0")}`));
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.equal(Object.isFrozen(PLANNING_PROJECTION_CORE_CAPABILITY), true);
  const text = planningSource();
  const normalized = normalizePlanningReshapeRequest(projectRequest(text));
  assert.equal(normalized.ok, true, JSON.stringify(normalized.diagnostics));
  const reordered = structuredClone(projectRequest(text));
  reordered.strict_fragment.activity_ids.reverse();
  assert.equal(normalizePlanningReshapeRequest(reordered).preflightHash, normalized.preflightHash);
  const unknown = structuredClone(projectRequest(text));
  unknown.strict_fragment.unexpected = true;
  assert.equal(normalizePlanningReshapeRequest(unknown).ok, false);
  assert.throws(
    () => auditPlanningProjection(text, projectRequest(text), { ...PLANNING_PROJECTION_CORE_CAPABILITY }),
    /private planning projection Core capability/u,
  );
});

test("PPRJ-002 through PPRJ-005 transfer same identities once and validate the complete strict DAG", () => {
  const result = project();
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(planningProjectionSourceIsValid(result.candidateText), true);
  assert.doesNotMatch(result.candidateText, /^event MID:|^activity A[12] /mu);
  assert.equal(result.candidateText.match(/^milestone MID:$/gmu)?.length, 1);
  assert.equal(result.candidateText.match(/^task A1 START -> MID:$/gmu)?.length, 1);
  assert.equal(result.candidateText.match(/^task A2 MID -> END:$/gmu)?.length, 1);
  assert.match(result.candidateText, /work W1:[\s\S]*milestone_links:\n    MID[\s\S]*task_links:\n    A1\n    A2/u);
  assert.match(result.candidateText, /work W2:[\s\S]*milestone_links:\n    MID[\s\S]*task_links:\n    A1/u);
  assert.deepEqual(result.transfers.map(({ qualifiedId, affectedWorkIds }) => [qualifiedId, affectedWorkIds]), [
    [q("MID"), [q("W1"), q("W2")]], [q("A1"), [q("W1"), q("W2")]], [q("A2"), [q("W1")]],
  ]);

  const partial = structuredClone(projectRequest(planningSource()));
  partial.affected_work_ids = [q("W1")];
  const rejected = auditPlanningProjection(planningSource(), partial, PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.diagnostics.some(({ code }) => code === "PTPOOL-108"), true);

  const cyclicSource = planningSource().replace("activity A2 MID -> END:", "activity A2 MID -> START:");
  const cyclic = auditPlanningProjection(cyclicSource, projectRequest(cyclicSource), PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(cyclic.ok, false);
  assert.equal(cyclic.diagnostics.some(({ code }) => code === "PTPOOL-110" || code.startsWith("PTDAG-")), true);
});

test("PPRJ-006 and PPRJ-007 retain residual assistance and classify draft versus canonical destruction", () => {
  const text = planningSource();
  const warning = project(text);
  assert.equal(warning.diagnostics.filter(({ code }) => code === "PTPOOL-112").length, 2);
  const acknowledged = auditPlanningProjection(text, projectRequest(text, { acknowledge: true }), PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(acknowledged.diagnostics.some(({ code }) => code === "PTPOOL-112"), false);
  assert.equal(warning.destructiveRecords.filter(({ ownerClass }) => ownerClass === "temporary_draft").length, 3);
  assert.equal(warning.destructiveRecords.some(({ ownerClass, entityKind }) => ownerClass === "canonical" && entityKind === "work"), true);
  assert.equal(warning.destructiveRecords.some(({ qualifiedId }) => qualifiedId === q("MID")), true);
});

test("PPRJ-008 and PPRJ-009 archive only an already empty Work", () => {
  const text = planningSource({ shared: false }).replace(
    "event MID:",
    'work EMPTY:\n  title "Empty Work"\n\nevent MID:',
  ).replace("work_order:\n  W1", "work_order:\n  W1\n  EMPTY");
  const archive = baseRequest(text, {
    intent: "archive",
    affected_work_ids: [q("EMPTY")],
    removed_work_ids: [q("EMPTY")],
    strict_fragment: null,
    final_work_order: [q("W1")],
  });
  const accepted = auditPlanningProjection(text, archive, PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(accepted.ok, true, JSON.stringify(accepted.diagnostics));
  assert.doesNotMatch(accepted.candidateText, /^work EMPTY:$/mu);
  assert.match(accepted.candidateText, /work_order:\n  W1/u);

  const rejected = structuredClone(archive);
  rejected.affected_work_ids = [q("W1")];
  rejected.removed_work_ids = [q("W1")];
  rejected.semantic_elements = [unchangedDescription("W1", "Meaning one")];
  const unavailable = auditPlanningProjection(text, rejected, PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.diagnostics.some(({ code }) => code === "PTPOOL-113"), true);
});

test("PPRJ-010 through PPRJ-012 defer one closed unstarted fragment and retain boundary Milestones", () => {
  const projected = project();
  const deferred = auditPlanningProjection(projected.candidateText, deferralRequest(projected.candidateText), PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(deferred.ok, true, JSON.stringify(deferred.diagnostics));
  assert.equal(planningProjectionSourceIsValid(deferred.candidateText), true);
  assert.doesNotMatch(deferred.candidateText, /^milestone MID:|^task A[12] /mu);
  assert.match(deferred.candidateText, /^event MID:$/mu);
  assert.match(deferred.candidateText, /^activity A1 START -> MID:$/mu);
  assert.match(deferred.candidateText, /^activity A2 MID -> END:$/mu);
  assert.match(deferred.candidateText, /^milestone START:$/mu);
  assert.match(deferred.candidateText, /^milestone END:$/mu);
  assert.match(deferred.candidateText, /^task BASE START -> END:$/mu);
  assert.deepEqual(deferred.transfers.map(({ direction }) => direction), ["to_planning", "to_planning", "to_planning"]);
  assert.equal(deferred.destructiveRecords.some(({ ownerClass, qualifiedId }) => ownerClass === "canonical" && qualifiedId === q("A1")), true);
});

test("PPRJ-013 and PPRJ-014 reject direct, started, retained-consumer, and evidence-bearing reallocation", () => {
  const projected = project();
  const direct = structuredClone(deferralRequest(projected.candidateText));
  direct.strict_fragment.task_ids = [q("BASE")];
  direct.strict_fragment.milestone_ids = [];
  direct.planning_entity_dispositions = [{ entity_kind: "activity", entity_id: q("BASE"), action: "defer" }];
  direct.association_dispositions = [];
  direct.projection_link_dispositions = [];
  assert.equal(auditPlanningProjection(projected.candidateText, direct, PLANNING_PROJECTION_CORE_CAPABILITY).diagnostics.some(({ code }) => code === "PTPOOL-109"), true);

  const activeText = projected.candidateText.replace('task A1 START -> MID:\n  title "Reach internal state"', 'task A1 START -> MID:\n  title "Reach internal state"\n  status active');
  const active = auditPlanningProjection(activeText, deferralRequest(activeText), PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(active.ok, false);
  assert.equal(active.diagnostics.some(({ code }) => code === "PTPOOL-109"), true);

  const retained = structuredClone(deferralRequest(projected.candidateText));
  retained.strict_fragment.task_ids = [];
  retained.planning_entity_dispositions = [{ entity_kind: "event", entity_id: q("MID"), action: "defer" }];
  retained.association_dispositions = retained.association_dispositions.filter(({ entity_kind }) => entity_kind === "event");
  retained.projection_link_dispositions = retained.projection_link_dispositions.filter(({ strict_kind }) => strict_kind === "milestone");
  const retainedResult = auditPlanningProjection(projected.candidateText, retained, PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(retainedResult.diagnostics.some(({ code, message }) => code === "PTPOOL-109" && /retained strict structure/u.test(message)), true);

  const evidence = projected.candidateText.replace(
    'task A1 START -> MID:\n  title "Reach internal state"',
    'task A1 START -> MID:\n  title "Reach internal state"\n  status active',
  );
  const move = baseRequest(evidence, {
    intent: "composite",
    affected_work_ids: [q("W1"), q("W2")],
    semantic_elements: [unchangedDescription("W1", "Meaning one"), unchangedDescription("W2", "Meaning two")],
    projection_link_dispositions: [
      { strict_kind: "milestone", strict_id: q("MID"), origin_work_id: q("W1"), destination_work_id: q("W1") },
      { strict_kind: "milestone", strict_id: q("MID"), origin_work_id: q("W2"), destination_work_id: q("W2") },
      { strict_kind: "task", strict_id: q("A1"), origin_work_id: q("W1"), destination_work_id: q("W1") },
      { strict_kind: "task", strict_id: q("A1"), origin_work_id: q("W2"), destination_work_id: q("W1") },
      { strict_kind: "task", strict_id: q("A2"), origin_work_id: q("W1"), destination_work_id: q("W1") },
    ],
    strict_fragment: null,
  });
  const moved = auditPlanningProjection(evidence, move, PLANNING_PROJECTION_CORE_CAPABILITY);
  assert.equal(moved.diagnostics.some(({ code }) => code === "PTPOOL-109"), true);
});

test("PPRJ-015 reuses normalized preflight, opaque token, and exact candidate binding", () => {
  const text = planningSource();
  const request = projectRequest(text);
  const registry = deterministicRegistry();
  const preflight = preflightPlanningReshape(text, request, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(preflight.ok, true, JSON.stringify(preflight.diagnostics));
  const prepared = preparePlanningReshapeApply(text, request, preflight.preflightHash, preflight.preflightToken, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(prepared.ok, true, JSON.stringify(prepared.diagnostics));
  assert.equal(planningReshapeBinding(prepared).candidateDigest, preflight.candidateDigest);
  assert.deepEqual(prepared.authorityImpact, { affectedScopes: ["dag"], requiredOwner: "owner", userResponseRequired: true });
});

test("PPRJ-016 keeps projection private and the public runtime unchanged", () => {
  for (const api of [rootApi, nodeApi, coreApi]) {
    assert.equal("auditPlanningProjection" in api, false);
    assert.equal("PLANNING_PROJECTION_CORE_CAPABILITY" in api, false);
  }
  assert.equal(rootApi.COMMAND_REGISTRY.length, 67);
  assert.equal(rootApi.getJsonSchemaCatalog().length, 26);
  assert.equal(Object.keys(rootApi).length, 139);
  assert.equal(Object.keys(nodeApi).length, 139);
  assert.equal(Object.keys(coreApi).length, 51);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import {
  canonicalPlanningReshapeJson,
  normalizePlanningReshapeRequest,
  planningReshapeSha256,
} from "../dist/planning-pool/reshape-normalize.js";
import {
  PlanningReshapeTokenRegistry,
  PLANNING_RESHAPE_TOKEN_CAPACITY,
  PLANNING_RESHAPE_TOKEN_LIFETIME_MS,
} from "../dist/planning-pool/reshape-token.js";
import {
  auditPlanningReshape,
  planningReshapeBinding,
  preflightPlanningReshape,
  preparePlanningReshapeApply,
  PLANNING_RESHAPE_CORE_CAPABILITY,
  PLANNING_RESHAPE_CORE_LIMITS,
} from "../dist/planning-pool/reshape.js";

function source({ references = true, description = "Alpha Beta", second = true } = {}) {
  const planning = [
    "work W1:",
    '  title "First Work"',
    `  description ${JSON.stringify(description)}`,
    ...(references ? [
      "  events:",
      "    E1",
      "  milestone_links:",
      "    END",
      ...(second ? ["  depends_on:", "    W2"] : []),
    ] : []),
    "",
    ...(second ? [
      "work W2:",
      '  title "Second Work"',
      '  description "Gamma"',
      ...(references ? ["  events:", "    E2"] : []),
      "",
    ] : []),
    ...(references ? [
      "event E1:",
      '  title "First state"',
      "",
      ...(second ? ["event E2:", '  title "Second state"', ""] : []),
    ] : []),
    ...(references && second ? [
      "window WIN:",
      '  title "Window"',
      '  objective "Refine both Works"',
      "  works:",
      "    W1",
      "    W2",
      "",
    ] : []),
    "work_order:",
    "  W1",
    ...(second ? ["  W2"] : []),
    "",
  ];
  return `${[
    "project POOL:",
    "  version 9",
    '  title "Pool"',
    "  as_of 2026-08-24",
    "  duration_unit point",
    "  finish END",
    "  dag_owner owner",
    "",
    ...planning,
    "milestone END:",
    '  title "End"',
    "  state reached",
  ].join("\n")}\n`;
}

function request(text, overrides = {}) {
  return {
    request_schema_version: "Perttool.PlanningReshapeRequest.v1",
    normalization_contract: "perttool.planning-reshape-normalization@1",
    source_digest: planningReshapeSha256(text),
    intent: "reshape",
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
    strict_fragment: null,
    window_close: null,
    ...overrides,
  };
}

function splitRequest(text) {
  return request(text, {
    affected_work_ids: ["POOL::W1", "POOL::W3"],
    created_works: [{ work_id: "POOL::W3", title: "Moved meaning", insert_after_work_id: "POOL::W1" }],
    semantic_elements: [
      {
        element_id: "E_ALPHA",
        origin: { kind: "existing", work_id: "POOL::W1", start_utf16: 0, end_utf16: 6, source_text: "Alpha " },
        destination: { kind: "work", work_id: "POOL::W1", position: 0, text: "Alpha " },
      },
      {
        element_id: "E_BETA",
        origin: { kind: "existing", work_id: "POOL::W1", start_utf16: 6, end_utf16: 10, source_text: "Beta" },
        destination: { kind: "work", work_id: "POOL::W3", position: 0, text: "Beta" },
      },
    ],
    planning_entity_dispositions: [{ entity_kind: "event", entity_id: "POOL::E1", action: "retain" }],
    association_dispositions: [{ entity_kind: "event", entity_id: "POOL::E1", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
    projection_link_dispositions: [{ strict_kind: "milestone", strict_id: "POOL::END", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
    dependency_dispositions: [{
      dependent_work_id: "POOL::W1",
      prerequisite_work_id: "POOL::W2",
      action: "rebind",
      final_dependent_work_id: "POOL::W3",
      final_prerequisite_work_id: "POOL::W2",
    }],
    window_membership_dispositions: [{ window_id: "POOL::WIN", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
    final_work_order: ["POOL::W1", "POOL::W3", "POOL::W2"],
  });
}

function noOpRequest(text, { references = false, residual = false } = {}) {
  return request(text, {
    affected_work_ids: ["POOL::W1"],
    semantic_elements: [{
      element_id: "E1",
      origin: { kind: "existing", work_id: "POOL::W1", start_utf16: 0, end_utf16: 12, source_text: "Keep meaning" },
      destination: { kind: "work", work_id: "POOL::W1", position: 0, text: "Keep meaning" },
    }],
    ...(references ? {
      planning_entity_dispositions: [{ entity_kind: "event", entity_id: "POOL::E1", action: "retain" }],
      association_dispositions: [{ entity_kind: "event", entity_id: "POOL::E1", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
      projection_link_dispositions: [{ strict_kind: "milestone", strict_id: "POOL::END", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
    } : {}),
    add_residual_description: residual ? [{ work_id: "POOL::W1", text: "Keep meaning" }] : [],
  });
}

function deterministicRegistry(options = {}) {
  let counter = 1;
  return new PlanningReshapeTokenRegistry({
    randomBytes: (size) => new Uint8Array(size).fill(counter++),
    ...options,
  });
}

test("PPRC-001 keeps a private capability and dependency-ordered cases", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/planning-pool-reshape-core-v1.json", "utf8"));
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    Array.from({ length: 16 }, (_, index) => `PPRC-${String(index + 1).padStart(3, "0")}`),
  );
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.equal(Object.isFrozen(PLANNING_RESHAPE_CORE_CAPABILITY), true);
  assert.deepEqual(PLANNING_RESHAPE_CORE_LIMITS, {
    affectedWorks: 2048,
    semanticRows: 50000,
    relationshipDispositions: 200000,
  });
  assert.throws(
    () => auditPlanningReshape(source(), request(source()), { ...PLANNING_RESHAPE_CORE_CAPABILITY }),
    /private planning reshape Core capability/u,
  );
  const text = source({ references: false, second: false, description: "Keep meaning" });
  const unknown = { ...noOpRequest(text), unexpected: true };
  assert.equal(normalizePlanningReshapeRequest(unknown).ok, false);
  const oversized = request(text, {
    affected_work_ids: Array.from({ length: 2049 }, (_, index) => `POOL::W${index}`),
  });
  const limited = normalizePlanningReshapeRequest(oversized);
  assert.equal(limited.ok, false);
  assert.equal(limited.diagnostics.some(({ code }) => code === "PTPOOL-115"), true);
  for (const api of [rootApi, nodeApi, coreApi]) {
    for (const name of ["auditPlanningReshape", "preflightPlanningReshape"]) {
      assert.equal(name in api, false, name);
    }
  }
  assert.equal(typeof rootApi.PlanningReshapeTokenRegistry, "function");
  assert.equal(typeof coreApi.preflightPlanningPoolReshape, "function");
});

test("PPRC-002 reproduces the accepted canonical hash vectors", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/planning-pool-contract-v1.json", "utf8"));
  for (const vector of fixture.hash_vectors) {
    const normalized = normalizePlanningReshapeRequest(JSON.parse(vector.canonical_utf8));
    assert.equal(normalized.ok, true, JSON.stringify(normalized.diagnostics));
    assert.equal(normalized.canonicalUtf8, vector.canonical_utf8);
    assert.equal(normalized.preflightHash, vector.preflight_hash);
    assert.equal(Buffer.byteLength(normalized.canonicalUtf8, "utf8"), vector.utf8_bytes);
  }
});

test("PPRC-003 normalizes representation order and preserves semantic order", () => {
  const text = source({ references: false, second: false, description: "Keep meaning" });
  const first = noOpRequest(text);
  first.affected_work_ids = ["POOL::W2", "POOL::W1"];
  const second = Object.fromEntries(Object.entries(first).reverse());
  second.affected_work_ids = [...first.affected_work_ids].reverse();
  const left = normalizePlanningReshapeRequest(first);
  const right = normalizePlanningReshapeRequest(second);
  assert.equal(left.preflightHash, right.preflightHash);
  assert.equal(left.canonicalUtf8, canonicalPlanningReshapeJson(left.request));
  const changed = structuredClone(first);
  changed.semantic_elements[0].destination.text = "Changed meaning";
  assert.notEqual(normalizePlanningReshapeRequest(changed).preflightHash, left.preflightHash);
  const ordered = structuredClone(first);
  ordered.final_work_order = ["POOL::W1", "POOL::W0"];
  assert.notEqual(normalizePlanningReshapeRequest(ordered).preflightHash, left.preflightHash);
});

test("PPRC-004 atomically splits description, references, dependency, Window, and order", () => {
  const text = source();
  const result = auditPlanningReshape(text, splitRequest(text), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.changed, true);
  assert.deepEqual(result.beforeDescriptions, [{ workId: "POOL::W1", description: "Alpha Beta", elementIds: ["E_ALPHA", "E_BETA"] }]);
  assert.deepEqual(result.afterDescriptions, [
    { workId: "POOL::W1", description: "Alpha ", elementIds: ["E_ALPHA"] },
    { workId: "POOL::W3", description: "Beta", elementIds: ["E_BETA"] },
  ]);
  assert.match(result.candidateText, /work W3:[\s\S]*description "Beta"[\s\S]*depends_on:\n    W2/u);
  assert.match(result.candidateText, /work_order:\n  W1\n  W3\n  W2/u);

  const chained = request(text, {
    affected_work_ids: ["POOL::W0", "POOL::W9"],
    created_works: [
      { work_id: "POOL::W0", title: "Second created", insert_after_work_id: "POOL::W9" },
      { work_id: "POOL::W9", title: "First created", insert_after_work_id: "POOL::W1" },
    ],
    final_work_order: ["POOL::W1", "POOL::W9", "POOL::W0", "POOL::W2"],
  });
  assert.equal(auditPlanningReshape(text, chained, PLANNING_RESHAPE_CORE_CAPABILITY).ok, true);
});

test("PPRC-005 merges all meaning and references without a tombstone", () => {
  const text = source();
  const merge = request(text, {
    affected_work_ids: ["POOL::W1", "POOL::W2"],
    removed_work_ids: ["POOL::W2"],
    semantic_elements: [
      { element_id: "E_W1", origin: { kind: "existing", work_id: "POOL::W1", start_utf16: 0, end_utf16: 10, source_text: "Alpha Beta" }, destination: { kind: "work", work_id: "POOL::W1", position: 0, text: "Alpha Beta" } },
      { element_id: "E_W2", origin: { kind: "existing", work_id: "POOL::W2", start_utf16: 0, end_utf16: 5, source_text: "Gamma" }, destination: { kind: "work", work_id: "POOL::W1", position: 1, text: "Gamma" } },
    ],
    planning_entity_dispositions: [
      { entity_kind: "event", entity_id: "POOL::E1", action: "retain" },
      { entity_kind: "event", entity_id: "POOL::E2", action: "retain" },
    ],
    association_dispositions: [
      { entity_kind: "event", entity_id: "POOL::E1", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" },
      { entity_kind: "event", entity_id: "POOL::E2", origin_work_id: "POOL::W2", destination_work_id: "POOL::W1" },
    ],
    projection_link_dispositions: [{ strict_kind: "milestone", strict_id: "POOL::END", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
    dependency_dispositions: [{ dependent_work_id: "POOL::W1", prerequisite_work_id: "POOL::W2", action: "no_longer_required", reason: "absorbed" }],
    window_membership_dispositions: [
      { window_id: "POOL::WIN", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" },
      { window_id: "POOL::WIN", origin_work_id: "POOL::W2", destination_work_id: "POOL::W1" },
    ],
    final_work_order: ["POOL::W1"],
  });
  const result = auditPlanningReshape(text, merge, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.match(result.candidateText, /description "Alpha BetaGamma"[\s\S]*events:\n    E1\n    E2/u);
  assert.doesNotMatch(result.candidateText, /work W2:|tombstone|redirect/u);
  assert.match(result.candidateText, /work_order:\n  W1/u);
});

test("PPRC-006 and PPRC-007 account for creation and discard and reject incomplete coverage", () => {
  const text = source({ references: false, second: false, description: "Keep meaning" });
  const reshape = request(text, {
    intent: "composite",
    affected_work_ids: ["POOL::W1"],
    semantic_elements: [
      { element_id: "OLD", origin: { kind: "existing", work_id: "POOL::W1", start_utf16: 0, end_utf16: 12, source_text: "Keep meaning" }, destination: { kind: "discard", reason: "obsolete premise" } },
      { element_id: "NEW", origin: { kind: "created", source_text: "New meaning", asserted_new_meaning: true }, destination: { kind: "work", work_id: "POOL::W1", position: 0, text: "New meaning" } },
    ],
  });
  const accepted = auditPlanningReshape(text, reshape, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(accepted.ok, true, JSON.stringify(accepted.diagnostics));
  assert.match(accepted.candidateText, /description "New meaning"/u);
  for (const invalid of [
    { ...reshape, semantic_elements: [{ ...reshape.semantic_elements[0], origin: { ...reshape.semantic_elements[0].origin, start_utf16: 1 } }, reshape.semantic_elements[1]] },
    { ...reshape, semantic_elements: [{ ...reshape.semantic_elements[0], origin: { ...reshape.semantic_elements[0].origin, source_text: "Wrong meaning" } }, reshape.semantic_elements[1]] },
    { ...reshape, semantic_elements: [reshape.semantic_elements[0], { ...reshape.semantic_elements[1], destination: { ...reshape.semantic_elements[1].destination, position: 1 } }] },
  ]) {
    const rejected = preflightPlanningReshape(text, invalid, deterministicRegistry(), PLANNING_RESHAPE_CORE_CAPABILITY);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.preflightToken, null);
    assert.equal(rejected.diagnostics.some(({ code }) => code === "PTPOOL-110"), true);
  }
});

test("PPRC-008 and PPRC-009 require complete typed reference dispositions", () => {
  const text = source();
  const incomplete = splitRequest(text);
  incomplete.association_dispositions = [];
  const rejected = auditPlanningReshape(text, incomplete, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(rejected.ok, false);
  assert.match(rejected.diagnostics.map(({ message }) => message).join("\n"), /has no disposition/u);

  const represented = request(text, {
    affected_work_ids: ["POOL::W1"],
    semantic_elements: [{ element_id: "ALL", origin: { kind: "existing", work_id: "POOL::W1", start_utf16: 0, end_utf16: 10, source_text: "Alpha Beta" }, destination: { kind: "work", work_id: "POOL::W1", position: 0, text: "Alpha Beta" } }],
    planning_entity_dispositions: [{ entity_kind: "event", entity_id: "POOL::E1", action: "retain" }],
    association_dispositions: [{ entity_kind: "event", entity_id: "POOL::E1", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
    projection_link_dispositions: [{ strict_kind: "milestone", strict_id: "POOL::END", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
    dependency_dispositions: [{ dependent_work_id: "POOL::W1", prerequisite_work_id: "POOL::W2", action: "represented", represented_by: ["POOL::E1"] }],
    window_membership_dispositions: [{ window_id: "POOL::WIN", origin_work_id: "POOL::W1", destination_work_id: "POOL::W1" }],
  });
  assert.equal(auditPlanningReshape(text, represented, PLANNING_RESHAPE_CORE_CAPABILITY).ok, true);
  const self = structuredClone(splitRequest(text));
  self.dependency_dispositions[0].final_prerequisite_work_id = "POOL::W3";
  assert.equal(auditPlanningReshape(text, self, PLANNING_RESHAPE_CORE_CAPABILITY).ok, false);
});

test("PPRC-010 returns complete read-only preflight evidence and user boundary", () => {
  const text = source();
  const registry = deterministicRegistry({ now: () => Date.parse("2026-08-24T00:00:00Z") });
  const result = preflightPlanningReshape(text, splitRequest(text), registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.PlanningReshapePreflightResult.v1");
  assert.equal(result.preflightToken.length >= 43, true);
  assert.equal(result.tokenExpiresAt, "2026-08-24T01:00:00.000Z");
  assert.equal(result.sourceDigest, planningReshapeSha256(text));
  assert.equal(result.candidateDigest, planningReshapeSha256(result.candidateText));
  assert.deepEqual(result.authorityImpact, { affectedScopes: [], requiredOwner: null, userResponseRequired: false });
  assert.equal("self_review" in result, false);
  assert.equal(text, source());
});

test("PPRC-011 enforces opaque token entropy, digest-only storage, capacity, and expiry", () => {
  let now = 1_000;
  const registry = deterministicRegistry({ now: () => now, capacity: 1 });
  const binding = Object.freeze({
    normalizationContract: "perttool.planning-reshape-normalization@1",
    preflightHash: `sha256:${"1".repeat(64)}`,
    sourceDigest: `sha256:${"2".repeat(64)}`,
    candidateDigest: `sha256:${"3".repeat(64)}`,
  });
  const issued = registry.issue(binding);
  assert.equal(Buffer.from(issued.token, "base64url").byteLength, 32);
  assert.equal(registry.issue(binding), null);
  const snapshot = registry.snapshots()[0];
  assert.match(snapshot.tokenDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(JSON.stringify(snapshot).includes(issued.token), false);
  const restored = deterministicRegistry({ now: () => now, capacity: 1, snapshots: [snapshot] });
  assert.equal(restored.verify(issued.token, binding).ok, true);
  assert.deepEqual({ PLANNING_RESHAPE_TOKEN_CAPACITY, PLANNING_RESHAPE_TOKEN_LIFETIME_MS }, {
    PLANNING_RESHAPE_TOKEN_CAPACITY: 256,
    PLANNING_RESHAPE_TOKEN_LIFETIME_MS: 3600000,
  });
  const portableDefault = new PlanningReshapeTokenRegistry().issue(binding);
  assert.equal(Buffer.from(portableDefault.token, "base64url").byteLength, 32);
  now += 3_600_000;
  assert.equal(registry.verify(issued.token, binding).state, "expired");
  assert.notEqual(registry.issue(binding), null);
});

test("PPRC-012 and PPRC-013 rebind, recover, and consume exactly once", () => {
  const text = source();
  const reshape = splitRequest(text);
  const registry = deterministicRegistry();
  const preflight = preflightPlanningReshape(text, reshape, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  const prepared = preparePlanningReshapeApply(text, reshape, preflight.preflightHash, preflight.preflightToken, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(prepared.ok, true, JSON.stringify(prepared.diagnostics));
  const binding = planningReshapeBinding(prepared);
  for (const invalid of [
    preparePlanningReshapeApply(text, reshape, `sha256:${"0".repeat(64)}`, preflight.preflightToken, registry, PLANNING_RESHAPE_CORE_CAPABILITY),
    preparePlanningReshapeApply(text, reshape, preflight.preflightHash, "caller-salt", registry, PLANNING_RESHAPE_CORE_CAPABILITY),
    preparePlanningReshapeApply(`${text}# changed\n`, reshape, preflight.preflightHash, preflight.preflightToken, registry, PLANNING_RESHAPE_CORE_CAPABILITY),
  ]) {
    assert.equal(invalid.ok, false);
    assert.equal(invalid.diagnostics.some(({ code }) => code === "PTPOOL-111"), true);
  }
  assert.deepEqual(registry.beginCommit(preflight.preflightToken, binding), { ok: true, state: "committing", recovered: false, completed: false });
  assert.deepEqual(registry.settleCommit(preflight.preflightToken, binding.sourceDigest), { ok: true, state: "unused", recovered: true, completed: false });
  assert.equal(registry.beginCommit(preflight.preflightToken, binding).ok, true);
  assert.deepEqual(registry.settleCommit(preflight.preflightToken, binding.candidateDigest), { ok: true, state: "consumed", recovered: false, completed: true });
  assert.equal(registry.verify(preflight.preflightToken, binding).state, "consumed");

  const second = preflightPlanningReshape(text, reshape, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  const secondPrepared = preparePlanningReshapeApply(text, reshape, second.preflightHash, second.preflightToken, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(registry.beginCommit(second.preflightToken, planningReshapeBinding(secondPrepared)).ok, true);
  assert.equal(registry.settleCommit(second.preflightToken, `sha256:${"f".repeat(64)}`).state, "mismatch");
});

test("PPRC-014 and PPRC-015 retain bounded no-op assistance and one-time consumption", () => {
  const plain = source({ references: false, second: false, description: "Keep meaning" });
  const registry = deterministicRegistry();
  const preflight = preflightPlanningReshape(plain, noOpRequest(plain), registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(preflight.ok, true);
  assert.equal(preflight.changed, false);
  assert.equal(preflight.diagnostics.some(({ code }) => code === "PTPOOL-117"), true);
  const prepared = preparePlanningReshapeApply(plain, noOpRequest(plain), preflight.preflightHash, preflight.preflightToken, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  const binding = planningReshapeBinding(prepared);
  assert.equal(registry.beginCommit(preflight.preflightToken, binding).ok, true);
  assert.equal(registry.settleCommit(preflight.preflightToken, binding.sourceDigest).state, "consumed");

  const commented = plain.replace("work_order:\n  W1", "work_order:\n  # keep order bytes\n  W1");
  const preserved = auditPlanningReshape(commented, noOpRequest(commented), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(preserved.ok, true, JSON.stringify(preserved.diagnostics));
  assert.match(preserved.candidateText, /work_order:\n  # keep order bytes\n  W1/u);

  const referenced = source({ second: false, description: "Keep meaning" });
  const warning = auditPlanningReshape(referenced, noOpRequest(referenced, { references: true }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(warning.ok, true, JSON.stringify(warning.diagnostics));
  assert.equal(warning.diagnostics.some(({ code }) => code === "PTPOOL-112"), true);
  const acknowledged = auditPlanningReshape(referenced, noOpRequest(referenced, { references: true, residual: true }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(acknowledged.diagnostics.some(({ code }) => code === "PTPOOL-112"), false);
});

test("PPRC-016 preserves the public runtime and records no LLM self-review", () => {
  assert.equal(rootApi.COMMAND_REGISTRY.length, 71);
  assert.equal(rootApi.getJsonSchemaCatalog().length, 29);
  assert.equal(Object.keys(rootApi).length, 139);
  assert.equal(Object.keys(nodeApi).length, 139);
  assert.equal(Object.keys(coreApi).length, 51);
  assert.equal(rootApi.getCommandDiscovery({ resource: null, action: null }).cliContractVersion, 10);
  assert.equal(rootApi.COMMAND_REGISTRY.filter(({ path }) => path[0] === "work" || path[0] === "window").length, 11);
});

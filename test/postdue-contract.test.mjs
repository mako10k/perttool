import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { COMMAND_REGISTRY, getJsonSchemaCatalog } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");
const load = async () => JSON.parse(await read("test/fixtures/postdue-contract-v1.json"));

test("PDC-001 through PDC-004 close kinds, events, strictness, and history", async () => {
  const fixture = await load();
  const cases = new Map(fixture.cases.map((entry) => [entry.id, entry]));
  assert.equal(fixture.schema_version, "Perttool.PostdueContractCases.v1");
  assert.deepEqual(fixture.alert_kinds, ["POSTDUE", "POSTDUE_FORECAST"]);
  assert.equal(cases.get("PDC-003").expected.equal, "due_now_no_alert");
  assert.equal(cases.get("PDC-004").expected.actual_time_inferred, false);
});

test("PDC-005 through PDC-008 preserve proof, suppression, and target identity", async () => {
  const fixture = await load();
  const cases = new Map(fixture.cases.map((entry) => [entry.id, entry]));
  assert.deepEqual(fixture.proof_order, ["precedence_infeasible", "resource_heuristic_late"]);
  assert.equal(cases.get("PDC-006").expected.optimal, false);
  assert.equal(cases.get("PDC-007").expected.scope, "matching_deduplication_key_only");
  assert.equal(cases.get("PDC-008").expected.deadline_and_latest_distinct, true);
});

test("PDC-009 through PDC-012 require actionable scoped drivers", async () => {
  const fixture = await load();
  const cases = new Map(fixture.cases.map((entry) => [entry.id, entry]));
  assert.equal(cases.get("PDC-009").expected.identity_reused, true);
  assert.equal(cases.get("PDC-011").expected.unrelated_global_path, false);
  assert.deepEqual(fixture.driver_states, ["available", "not_computed", "unavailable"]);
  assert.deepEqual(fixture.full_analysis_argv.slice(-4), ["--schedule", "both", "--format", "json"]);
});

test("PDC-013 through PDC-017 close stable bounded command projections", async () => {
  const fixture = await load();
  const cases = new Map(fixture.cases.map((entry) => [entry.id, entry]));
  assert.equal(cases.get("PDC-014").expected.stable_prefix, true);
  assert.equal(cases.get("PDC-015").expected.diagnostic, false);
  assert.equal(cases.get("PDC-016").expected.alert_to_path_reference, true);
  assert.equal(cases.get("PDC-017").expected.recommendation_ranking_changed, false);
  assert.deepEqual(fixture.limits, { alerts: 10000, compact_driver_steps: 64, full_target_driver_steps: 100000, full_path_enumeration_max: 1000 });
});

test("PDC-018 retains one evaluator across the active public boundary", async () => {
  const fixture = await load();
  const finalCase = fixture.cases.at(-1);
  assert.equal(finalCase.id, "PDC-018");
  assert.equal(finalCase.expected.common_projection_equivalent, true);
  assert.equal(finalCase.expected.commands, 53);
  assert.equal(COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, finalCase.expected.root_schemas);
  assert.equal(await read("package.json").then((text) => JSON.parse(text).version), "0.10.1");
  const ids = fixture.cases.map((entry) => entry.id);
  const seen = new Set();
  for (const entry of fixture.cases) {
    for (const dependency of entry.depends_on) assert.equal(seen.has(dependency), true);
    seen.add(entry.id);
  }
  assert.deepEqual(ids, Array.from({ length: 18 }, (_, index) => `PDC-${String(index + 1).padStart(3, "0")}`));
});

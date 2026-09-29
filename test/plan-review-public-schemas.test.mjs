// R: Verify the closed Contract 11 Plan Review schema boundary.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  parsePlanReviewSource,
  PLAN_REVIEW_SOURCE_CAPABILITY,
} from "../dist/plan-review/source.js";
import { projectPlanReviewBasis } from "../dist/plan-review/basis.js";

const base = "https://github.com/mako10k/perttool/schemas/";
const directory = new URL("../schemas/", import.meta.url);
const names = readdirSync(directory).filter((name) => name.endsWith(".schema.json"));
const schemas = new Map(names.map((name) => [
  name,
  JSON.parse(readFileSync(new URL(name, directory), "utf8")),
]));
const ajv = new Ajv2020({ strict: false, allErrors: true });
for (const value of schemas.values()) ajv.addSchema(value);

function validate(identity, value) {
  const checker = ajv.getSchema(`${base}${identity}.schema.json`);
  assert.equal(typeof checker, "function", identity);
  return checker(value);
}

const clear = {
  model_version: 1,
  state: "clear",
  open_request_ids: [],
  required_actions: [],
};

test("Contract 11 has 31 active roots and compiles Plan Review identities", () => {
  assert.equal(names.length, 32); // 31 roots plus Common.
  assert.equal(schemas.has("Perttool.NextResult.v8.schema.json"), false);
  for (const identity of [
    "Perttool.NextResult.v9",
    "Perttool.PlanReviewResult.v1",
    "Perttool.PlanReviewMutationResult.v1",
  ]) {
    assert.equal(typeof ajv.getSchema(`${base}${identity}.schema.json`), "function");
  }
  for (const [name, schema] of schemas) {
    if (name === "Perttool.Common.v1.schema.json") continue;
    if (schema.properties?.cli_contract_version !== undefined) {
      assert.deepEqual(schema.properties.cli_contract_version, { const: 11 }, name);
    }
  }
});

test("Plan Review projection and read result reject unknown fields", () => {
  const identity = "Perttool.PlanReviewResult.v1";
  const row = {
    schema_version: identity,
    cli_contract_version: 11,
    tool_version: "0.11.1",
    operation: "plan.review-list",
    ok: true,
    document_id: "PROJECT_A",
    source: "plan.pert",
    query: { state: "all", request_id: null },
    projection: clear,
    requests: [],
    diagnostics: [],
  };
  assert.equal(validate(identity, row), true, JSON.stringify(ajv.errors));
  assert.equal(validate(identity, { ...row, unexpected: true }), false);
  assert.equal(validate(identity, { ...row, projection: { ...clear, unexpected: true } }), false);
  assert.equal(validate(identity, { ...row, query: { ...row.query, unexpected: true } }), false);
});

test("Next v9 requires a complete Plan Review projection on success", () => {
  const schema = schemas.get("Perttool.NextResult.v9.schema.json");
  assert.equal(schema.properties.schema_version.const, "Perttool.NextResult.v9");
  assert.equal(schema.properties.cli_contract_version.const, 11);
  assert.ok(schema.required.includes("plan_review"));
  const projection = "Perttool.PlanReviewResult.v1.schema.json#/$defs/projection";
  assert.deepEqual(schema.properties.plan_review.anyOf,
    [{ $ref: projection }, { type: "null" }]);
  assert.deepEqual(schema.allOf, [{
    if: { properties: { ok: { const: true } } },
    then: { properties: { plan_review: { $ref: projection } } },
  }]);
  assert.equal(schema.properties.grammar_version.maximum, 10);
});

test("the public closed Basis identity accepts a real Core projection", () => {
  const text = [
    "project REVIEW:", "  version 10", '  title "Review"',
    "  as_of 2026-09-10", "  duration_unit point", "  velocity 4p/1d",
    "  finish END", "", "milestone START:", '  title "Start"',
    "  state reached", "", "milestone END:", '  title "End"', "",
    "task TASK_A START -> END:", '  title "Task A"',
    '  description "Deliver"', "  duration 2p", "  status planned", "",
  ].join("\n");
  const parsed = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  const basis = projectPlanReviewBasis(parsed.model);
  const checker = ajv.getSchema(
    `${base}Perttool.PlanReviewMutationResult.v1.schema.json#/$defs/basis`,
  );
  assert.equal(checker(basis), true, JSON.stringify(checker.errors));
  assert.equal(checker({ ...basis, unexpected: true }), false);
});

test("Contract 11 advance allows optional removed pre-resolved request IDs", () => {
  const advance = schemas.get("Perttool.AdvanceResult.v4.schema.json")
    .properties.advance.oneOf[0];
  assert.equal(advance.required.includes("removed_plan_review_request_ids"), false);
  assert.equal(advance.properties.removed_plan_review_request_ids.$ref,
    "Perttool.Common.v1.schema.json#/$defs/stringArray");
  const row = Object.fromEntries(advance.required.map((field) => [field, []]));
  row.removed_plan_review_request_ids = ["PRR_001"];
  const checker = ajv.getSchema(
    `${base}Perttool.AdvanceResult.v4.schema.json#/properties/advance/oneOf/0`,
  );
  assert.equal(checker(row), true, JSON.stringify(checker.errors));
  const without = { ...row };
  delete without.removed_plan_review_request_ids;
  assert.equal(checker(without), true, JSON.stringify(checker.errors));
  assert.equal(checker({ ...row, unexpected: true }), false);
  assert.equal(checker({ ...row, removed_plan_review_request_ids: [17] }), false);
});

test("public create and resolve request identities validate library inputs", () => {
  const schema = `${base}Perttool.PlanReviewMutationResult.v1.schema.json`;
  const create = ajv.getSchema(`${schema}#/$defs/createRequest`);
  const resolve = ajv.getSchema(`${schema}#/$defs/resolveRequest`);
  const createInput = {
    schema_version: "Perttool.PlanReviewCreateRequest.v1",
    request_id: "PRR_001", task_id: "TASK_A", reason: "Recheck estimate",
    created_at: "2026-09-10T09:00:00+09:00", actor: "codex",
  };
  assert.equal(create(createInput), true, JSON.stringify(create.errors));
  assert.equal(create({ ...createInput, locator: "run:42" }), true);
  assert.equal(create({ ...createInput, locator: null }), false);
  assert.equal(create({ ...createInput, unexpected: true }), false);

  const retained = {
    schema_version: "Perttool.PlanReviewResolveRequest.v1",
    request_id: "PRR_001", outcome: "plan_retained",
    resolved_at: "2026-09-10T10:00:00+09:00", actor: "user",
    resolution_reason: "Current plan remains suitable",
  };
  const batch = { kind: "batch", mutations: [
    { kind: "task.set", id: "TASK_A", set: { description: "Revised plan" } },
  ] };
  assert.equal(resolve(retained), true, JSON.stringify(resolve.errors));
  assert.equal(resolve({ ...retained, accepted_owners: ["owner"] }), true);
  assert.equal(resolve({ ...retained, request: batch }), false);
  const changed = { ...retained, outcome: "plan_changed", request: batch };
  assert.equal(resolve(changed), true, JSON.stringify(resolve.errors));
  const { request: unused, ...withoutBatch } = changed;
  assert.equal(resolve(withoutBatch), false);
  assert.equal(resolve({ ...changed, unexpected: true }), false);
  assert.equal(resolve({ ...changed, request: {
    ...batch, mutations: [{ ...batch.mutations[0], unknown: true }],
  } }), false);
  assert.equal(resolve({ ...changed, request: {
    ...batch, mutations: [{ kind: "plan_review.resolve", id: "PRR_001" }],
  } }), false);
});

test("result request summaries remain distinct from the public inputs", () => {
  const schema = `${base}Perttool.PlanReviewMutationResult.v1.schema.json`;
  const createSummary = ajv.getSchema(`${schema}#/$defs/createRequestSummary`);
  const resolveSummary = ajv.getSchema(`${schema}#/$defs/resolveRequestSummary`);
  assert.equal(createSummary({
    schema_version: "Perttool.PlanReviewCreateRequest.v1",
    request_id: "PRR_001", task_id: "TASK_A", reason: "Recheck",
    created_at: "2026-09-10T09:00:00+09:00", actor: "codex", locator: null,
  }), true, JSON.stringify(createSummary.errors));
  assert.equal(resolveSummary({
    schema_version: "Perttool.PlanReviewResolveRequest.v1",
    request_id: "PRR_001", outcome: "plan_changed",
    resolved_at: "2026-09-10T10:00:00+09:00", actor: "user",
    resolution_reason: "Changed plan", accepted_owners: [],
    change_request_digest: `sha256:${"a".repeat(64)}`,
  }), true, JSON.stringify(resolveSummary.errors));
  assert.deepEqual(
    schemas.get("Perttool.PlanReviewMutationResult.v1.schema.json")
      .properties.request.oneOf.map((branch) => branch.$ref ?? branch.type),
    ["#/$defs/createRequestSummary", "#/$defs/resolveRequestSummary", "null"],
  );
});

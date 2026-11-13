// R: Verify the successor dispatch schemas, typed examples and cross-field public contract.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { analyzePrecedence, buildResidualGraph, checkDocument } from "../dist/index.js";
import { rfc8785Json } from "../dist/model/rfc8785.js";
import { selectMaximumCountTasks } from "../dist/recommendation/maximum-count.js";
import { selectMaximumCountFromRanking } from "../dist/recommendation/maximum-count-ranking.js";
import { explainRecommendationCandidateComparison, rankRecommendationCandidates } from "../dist/recommendation/ranking.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const fixture = readJson("test/fixtures/maximum-count-public-contract-v1.json");
const nextSchema = readJson("docs/contracts/maximum-count-next.schema.json");
const overrideSchema = readJson("docs/contracts/maximum-count-override.schema.json");
const descriptions = readJson("docs/contracts/maximum-count-descriptions.json");
const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function validators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of readdirSync(path.join(root, "schemas"))) {
    if (!name.endsWith(".schema.json")) continue;
    const schema = readJson(`schemas/${name}`);
    if (schema.$id !== nextSchema.$id && schema.$id !== overrideSchema.$id) ajv.addSchema(schema);
  }
  ajv.addSchema(nextSchema);
  ajv.addSchema(overrideSchema);
  return { next: ajv.getSchema(nextSchema.$id), override: ajv.getSchema(overrideSchema.$id) };
}

function jsonRequirements(requirements) {
  return requirements.map(({ resourceId, units }) => ({ resource_id: resourceId, units }));
}

function exact(value) {
  return { numerator: String(value.numerator), denominator: String(value.denominator) };
}

function sourceSnapshot(entry) {
  const source = readFileSync(path.join(root, entry.fixture), "utf8");
  const checked = checkDocument(source);
  assert.equal(checked.ok, true, entry.id);
  const graph = buildResidualGraph(checked.document);
  const overrides = new Map(Object.entries(entry.capacity_overrides));
  const input = { graph, precedence: analyzePrecedence(graph, 100), appliedCapacities: overrides };
  const ranking = rankRecommendationCandidates(input);
  const selected = selectMaximumCountFromRanking(input, {
    sourceDigest: digest(source),
    tasks: new Map(ranking.candidates.map((candidate) => [candidate.taskId, "eligible"])),
  });
  const groups = [];
  for (const [index, candidate] of ranking.candidates.entries()) {
    const previous = ranking.candidates[index - 1];
    if (previous === undefined ||
      explainRecommendationCandidateComparison(previous, candidate).decisiveRuleId !== "task_id_tiebreak") {
      groups.push({
        rank_group: groups.length,
        task_ids: [],
        rank_key: {
          critical_class: candidate.precedenceCriticalClass,
          precedence_total_float: exact(candidate.precedenceTotalFloat),
          explicit_priority: candidate.explicitPriority,
          new_ready_task_count: candidate.newReadyTaskCount,
          new_satisfied_gate_count: candidate.newSatisfiedGateCount,
          new_reached_milestone_count: candidate.newReachedMilestoneCount,
          next_gate_task_distance: candidate.nextGateTaskDistance,
          finish_task_distance: candidate.finishTaskDistance,
          expected_duration: exact(candidate.expectedDuration),
        },
      });
    }
    groups.at(-1).task_ids.push(candidate.taskId);
  }
  const active = graph.edges.filter((edge) => edge.kind === "task" && edge.status === "active");
  return {
    selected,
    snapshot: {
      model_version: 1, source_digest: digest(source), grammar_version: 1,
      duration_unit: "point", critical_epsilon: exact(graph.criticalEpsilon),
      capacity_overrides: [...overrides].sort(([a], [b]) => a < b ? -1 : 1)
        .map(([resource_id, capacity]) => ({ resource_id, capacity })),
      resources: selected.resources.map((resource) => ({
        resource_id: resource.resourceId, capacity: resource.capacity, active_usage: resource.activeUsage,
        active_task_ids: active.filter((task) => task.requirements.some((item) => item.resourceId === resource.resourceId))
          .map((task) => task.id).sort(),
      })),
      active_tasks: active.map((task) => ({ task_id: task.id, requirements: jsonRequirements(task.requirements) }))
        .sort((a, b) => a.task_id < b.task_id ? -1 : 1),
      candidates: ranking.candidates.map((candidate) => ({
        task_id: candidate.taskId,
        rank_group: groups.find((group) => group.task_ids.includes(candidate.taskId)).rank_group,
        requirements: jsonRequirements(candidate.requirements),
        time_eligibility: "eligible", assurance_eligibility: "eligible",
      })),
      rank_groups: groups,
    },
  };
}

function verifyGraph(recommendation) {
  const collections = ["facts", "decision_steps", "task_decisions", "comparisons", "reason_occurrences", "descriptions"];
  const records = collections.flatMap((key) => recommendation[key]);
  const allIds = records.map((record) => record.id).concat(recommendation.result_decision.id);
  assert.equal(new Set(allIds).size, allIds.length);
  const factIds = new Set(recommendation.facts.map((record) => record.id));
  const steps = new Map(recommendation.decision_steps.map((record) => [record.id, record]));
  const reasonIds = new Set(recommendation.reason_occurrences.map((record) => record.id));
  const comparisonIds = new Set(recommendation.comparisons.map((record) => record.id));
  const descriptionIds = new Set(recommendation.descriptions.map((record) => record.id));
  const expressionReferences = (value) => {
    if (value === null || typeof value !== "object") return;
    if (value.kind === "fact") assert.ok(factIds.has(value.fact_id));
    for (const child of Object.values(value)) expressionReferences(child);
  };
  const verifyReferences = (record) => {
    for (const id of record.input_fact_ids ?? record.fact_ids ?? []) assert.ok(factIds.has(id), id);
    for (const id of record.step_ids ?? []) assert.ok(steps.has(id), id);
    for (const id of record.reason_occurrence_ids ?? record.source_reason_ids ?? []) assert.ok(reasonIds.has(id), id);
    for (const id of record.comparison_ids ?? record.source_comparison_ids ?? []) assert.ok(comparisonIds.has(id), id);
    for (const id of record.description_ids ?? []) assert.ok(descriptionIds.has(id), id);
    if (record.description_id !== undefined && record.description_id !== null) assert.ok(descriptionIds.has(record.description_id));
    if (record.decision_step_id !== undefined) assert.ok(steps.has(record.decision_step_id));
    if (record.joint_feasibility_fact_id !== undefined) assert.ok(factIds.has(record.joint_feasibility_fact_id));
    expressionReferences(record.expression ?? record.emission_expression ?? record.decisive_expression);
  };
  for (const record of [...records, recommendation.result_decision]) verifyReferences(record);
  const visited = new Set();
  const pending = new Set();
  function visit(id) {
    assert.ok(steps.has(id), id);
    assert.equal(pending.has(id), false, "acyclic explanation");
    if (visited.has(id)) return;
    pending.add(id);
    for (const dependency of steps.get(id).depends_on_step_ids) visit(dependency);
    pending.delete(id);
    visited.add(id);
  }
  for (const id of steps.keys()) visit(id);
  for (const decision of recommendation.task_decisions) {
    assert.equal(steps.get(decision.decisive_step_id).role, "decisive");
    assert.ok(descriptionIds.has(decision.summary_description_id));
  }
}

function verifySelection(result) {
  const recommendation = result.recommendation;
  const selection = recommendation.selection;
  const input = selection.input;
  assert.equal(input.source_digest, result.source_digest);
  assert.deepEqual(input.capacity_overrides, result.capacity_overrides);
  assert.equal(selection.input_digest, digest(rfc8785Json(input)));
  assert.equal(recommendation.result_decision.id, `rec:decision:result:R:${selection.input_digest}`);
  const selected = selection.selected_task_ids;
  for (const ids of [recommendation.recommended_task_ids, recommendation.result_decision.recommended_task_ids,
    result.groups.runnable_now, result.temporal.authority.startable_recommended_task_ids]) assert.deepEqual(ids, selected);
  const optimum = selectMaximumCountTasks({
    sourceDigest: input.source_digest,
    capacities: input.resources.map((item) => ({ resourceId: item.resource_id, units: item.capacity })),
    activeTasks: input.active_tasks.map((task) => ({ taskId: task.task_id,
      requirements: task.requirements.map((item) => ({ resourceId: item.resource_id, units: item.units })) })),
    candidates: input.candidates.map((task) => ({ taskId: task.task_id, rankGroup: task.rank_group,
      requirements: task.requirements.map((item) => ({ resourceId: item.resource_id, units: item.units })),
      eligibility: task.time_eligibility !== "eligible" ? "time_withheld"
        : task.assurance_eligibility !== "eligible" ? "assurance_withheld" : "eligible" })),
  });
  assert.deepEqual(selected, optimum.selectedTaskIds);
  assert.equal(selection.maximum_task_count, optimum.maximumTaskCount);
  const selectedSet = new Set(selected);
  const candidateIds = input.candidates.map((task) => task.task_id);
  assert.deepEqual([...result.groups.ready].sort(), [...candidateIds].sort());
  const eligibleIds = input.candidates.filter((task) =>
    task.time_eligibility === "eligible" && task.assurance_eligibility === "eligible").map((task) => task.task_id);
  assert.deepEqual(result.temporal.authority.eligible_task_ids, eligibleIds);
  for (const resource of selection.resources) {
    const expected = optimum.resources.find((item) => item.resourceId === resource.resource_id);
    assert.deepEqual([resource.capacity, resource.active_usage, resource.outside_group_usage,
      resource.allocatable_units, resource.selected_usage, resource.remaining_units],
    [expected.capacity, expected.activeUsage, expected.outsideGroupUsage,
      expected.allocatableUnits, expected.selectedUsage, expected.remainingUnits]);
  }
  for (const fact of recommendation.facts) assert.equal(fact.provenance.source_digest, result.source_digest);
  for (const task of result.tasks) assert.equal(task.runnable_now, selectedSet.has(task.id));
  for (const decision of recommendation.task_decisions) {
    assert.equal(decision.recommended_set_member, selectedSet.has(decision.subject_task_id));
    assert.equal(decision.tier, decision.recommended_set_member ? "recommended" : "deferred");
  }
  assert.deepEqual(selection.boundary_groups.map((group) => group.rank_group), optimum.boundaryGroups.map((group) => group.rankGroup));
  for (const group of selection.boundary_groups) {
    const expected = optimum.boundaryGroups.find((item) => item.rankGroup === group.rank_group);
    assert.deepEqual(group.candidates.map((task) => task.task_id), expected.candidates.map((task) => task.taskId));
    assert.deepEqual(group.selected_task_ids, expected.selectedTaskIds);
    assert.deepEqual(group.unselected_task_ids, expected.unselectedTaskIds);
    assert.deepEqual(group.outside_selected_task_ids, selected.filter((id) => !group.selected_task_ids.includes(id)));
    for (const row of group.resources) {
      const resource = expected.resources.find((item) => item.resourceId === row.resource_id);
      assert.deepEqual([row.capacity, row.active_usage, row.outside_group_usage, row.allocatable_units, row.selected_usage, row.remaining_units],
        [resource.capacity, resource.activeUsage, resource.outsideGroupUsage, resource.allocatableUnits, resource.selectedUsage, resource.remainingUnits]);
    }
  }
  verifyGraph(recommendation);
}

test("candidate Next and Override closed schemas compile and validate complete wire examples", () => {
  const validate = validators();
  for (const example of [fixture.boundary_example, fixture.empty_example]) {
    assert.equal(validate.next(example), true, JSON.stringify(validate.next.errors));
    verifySelection(example);
  }
  assert.equal(validate.override(fixture.override_example), true, JSON.stringify(validate.override.errors));
});

test("contract vectors bind actual source ranking, both capacities, count first and boundary units", () => {
  assert.equal(fixture.cases.length, 5);
  for (const entry of fixture.cases) {
    const { selected, snapshot } = sourceSnapshot(entry);
    assert.deepEqual(selected.selectedTaskIds, entry.expected_selected_task_ids, entry.id);
    assert.equal(digest(rfc8785Json(snapshot)), entry.input_digest, entry.id);
    if (entry.id === "BOUNDARY_BUDGET") assert.deepEqual(snapshot, fixture.boundary_example.recommendation.selection.input);
    if (entry.id === "EMPTY") assert.deepEqual(snapshot, fixture.empty_example.recommendation.selection.input);
  }
  assert.notEqual(fixture.cases[0].input_digest, fixture.cases[1].input_digest);
});

test("schema rejects incompatible identities, missing budgets, unknown fields and incomplete success", () => {
  const validate = validators().next;
  const mutations = [
    (value) => { value.schema_version = "Perttool.NextResult.v9"; },
    (value) => { value.cli_contract_version = 11; },
    (value) => { value.recommendation.algorithm.optimality_scope = "makespan"; },
    (value) => { value.recommendation.selection.unknown_control = true; },
    (value) => { delete value.recommendation.selection.boundary_groups[0].resources[0].allocatable_units; },
    (value) => { value.temporal.authority.complete = false; },
    (value) => { value.recommendation = null; },
    (value) => { value.recommendation.task_decisions[0].tier = "allowed"; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(fixture.boundary_example);
    mutate(value);
    assert.equal(validate(value), false);
  }
});

test("semantic checks reject disconnected starts, stale identity, false optimum and missing tied members", () => {
  const mutations = [
    (value) => { value.groups.runnable_now = []; },
    (value) => { value.recommendation.selection.maximum_task_count++; },
    (value) => { value.recommendation.selection.input.resources[0].capacity++; },
    (value) => { value.recommendation.selection.boundary_groups[0].candidates.pop(); },
    (value) => { value.recommendation.selection.boundary_groups[0].resources[0].allocatable_units++; },
    (value) => { value.recommendation.selection.input.candidates[0].time_eligibility = "not_yet_eligible"; },
    (value) => { value.recommendation.decision_steps[0].depends_on_step_ids.push("missing"); },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(fixture.boundary_example);
    mutate(value);
    assert.throws(() => verifySelection(value));
  }
});

test("description registry fixes every code and exact rendered text in the examples", () => {
  const registry = new Map(descriptions.entries.map((item) => [item.key, item]));
  assert.equal(registry.size, 20);
  const codes = nextSchema.$defs.reasonOccurrence.properties.code.enum;
  for (const code of codes) assert.ok(registry.has(`recommendation.reason.${code}`));
  function render(value) {
    if (value.type === "entity") return value.value.id;
    if (value.type === "list" || value.type === "set") return `[${value.items.map(render).join(", ")}]`;
    return value.value;
  }
  for (const example of [fixture.boundary_example, fixture.empty_example]) {
    for (const description of example.recommendation.descriptions) {
      const template = registry.get(description.key);
      assert.ok(template);
      assert.deepEqual(description.parameters.map((parameter) => parameter.name).sort(), Object.keys(template.parameters).sort());
      let text = template.template;
      for (const parameter of description.parameters) text = text.replaceAll(`{${parameter.name}}`, render(parameter.value));
      assert.equal(description.text, text);
      assert.equal(description.registry_version, 2);
    }
  }
});

test("override v2 preserves the exact input commitment and records the deferred replacement", () => {
  const example = fixture.override_example.override;
  const { override_id, ...payload } = example;
  assert.equal(override_id, `override:${digest(rfc8785Json(payload))}`);
  assert.equal(example.source.selection_input_digest, fixture.boundary_example.recommendation.selection.input_digest);
  assert.equal(example.source.result_decision_id, fixture.boundary_example.recommendation.result_decision.id);
  assert.deepEqual(example.selection.selected_task_ids, ["P", "X", "Z"]);
  assert.deepEqual(example.selection.trigger_codes, ["deferred_selected"]);
  assert.deepEqual(example.feasibility.resource_witnesses[0].selected_task_ids, ["P", "X", "Z"]);
  const invalid = structuredClone(fixture.override_example);
  invalid.override.source.schema_version = "Perttool.NextResult.v9";
  assert.equal(validators().override(invalid), false);
});

test("MCP schema is self-contained and preserves successful-result conditions", async () => {
  const schema = readJson("docs/contracts/maximum-count-mcp.schema.json");
  const { MCP_TOOL_OUTPUT_SCHEMAS } = await import("../adapters/mcp/dist/schema.js");
  const { $id: _id, title: _title, ...semanticSchema } = schema;
  assert.deepEqual(semanticSchema, MCP_TOOL_OUTPUT_SCHEMAS.perttool_next);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  const result = structuredClone(fixture.boundary_example);
  for (const key of ["schema_version", "cli_contract_version", "recommendation_interface_version",
    "tool_version", "operation", "source", "source_digest"]) delete result[key];
  const value = {
    schema_version: "Perttool.McpNextResult.v2", mcp_protocol_model_version: 1,
    operation: "dag_next",
    source: { kind: "inline", document_id: fixture.boundary_example.document_id,
      source_digest: fixture.boundary_example.source_digest },
    result_schema_version: "Perttool.NextResult.v10", result,
  };
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  value.result.recommendation = null;
  assert.equal(validate(value), false);
});

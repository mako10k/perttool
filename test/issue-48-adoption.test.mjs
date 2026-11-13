// R: Verify real model-2 Application selection, eligibility, evidence and override behavior before facade activation.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { selectNextTasks } from "../dist/application/contract12-next.js";
import { selectNextTasks as legacyNext } from "../dist/application/contract11-runtime.js";
import { recommendationAnalysisToJson } from "../dist/recommendation/json.js";
import { validateMaximumCountAnalysis } from "../dist/recommendation/maximum-count-validation.js";
import { validateOverride, overrideValidationResultToJson } from "../dist/recommendation/override-dispatch.js";
import { dispatchDescriptionRegistry } from "../dist/recommendation/maximum-count-descriptions.js";

const fixture = JSON.parse(readFileSync("test/fixtures/maximum-count-public-contract-v1.json", "utf8"));
const source = (name) => readFileSync(`test/fixtures/recommendation/${name}.pert`, "utf8");
function validator(file) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of readdirSync("schemas").filter((name) => name.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(readFileSync(`schemas/${name}`, "utf8")));
  }
  const schema = JSON.parse(readFileSync(file, "utf8"));
  return ajv.getSchema(schema.$id) ?? ajv.compile(schema);
}
function request(result, selectedTaskIds = ["P", "X", "Z"]) {
  return {
    sourceSchemaVersion: result.schemaVersion, sourceDigest: result.recommendation.sourceDigest,
    sourceResultDecisionId: result.recommendation.resultDecision.id, selectedTaskIds,
    actor: { kind: "human", id: "operator", authentication: "caller_asserted" },
    decidedAt: "2026-11-13T05:00:00Z", reasonCode: "human_priority_decision", reasonText: "Select the tied replacement",
    evidenceReferences: [], acknowledgedNegativeFactReasonIds: [],
  };
}

test("model-2 Application binds all source vectors and shares recommendation, runnable and authority sets", () => {
  for (const entry of fixture.cases) {
    const result = selectNextTasks(readFileSync(entry.fixture, "utf8"), { capacityOverrides: new Map(Object.entries(entry.capacity_overrides)) });
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.schemaVersion, "Perttool.NextResult.v10");
    assert.equal(result.recommendation.selection.inputDigest, entry.input_digest);
    assert.deepEqual(result.groups.runnableNow, entry.expected_selected_task_ids);
    assert.deepEqual(result.recommendation.recommendedTaskIds, result.groups.runnableNow);
    assert.deepEqual(result.temporal.authority.startableRecommendedTaskIds, result.groups.runnableNow);
    assert.deepEqual(validateMaximumCountAnalysis(result.recommendation), []);
  }
});

test("actual explanation satisfies the closed public model and exact description registry", () => {
  const result = selectNextTasks(source("rec-009-boundary-budget"));
  const value = structuredClone(fixture.boundary_example);
  value.recommendation = recommendationAnalysisToJson(result.recommendation);
  const validate = validator("docs/contracts/maximum-count-next.schema.json");
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  assert.deepEqual(dispatchDescriptionRegistry, JSON.parse(readFileSync("docs/contracts/maximum-count-descriptions.json", "utf8")).entries);
});

test("future release is excluded before maximizing and leaves capacity for an eligible task", () => {
  const text = source("rec-010-count-first").replace("version 1", "version 3")
    .replace("duration_unit point", "duration_unit hour\n  as_of 2026-11-13T09:00:00Z")
    .replaceAll(/(duration \d+)p/g, "$1h");
  const delayed = text.replace("task A START -> LARGE_DONE:\n", "task A START -> LARGE_DONE:\n  not_before 2026-11-14T09:00:00Z\n");
  const result = selectNextTasks(delayed);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.groups.runnableNow, ["B", "C"]);
  assert.deepEqual(result.temporal.authority.timeWithheldTaskIds, ["A"]);
  assert.equal(result.recommendation.taskDecisions.find((task) => task.subjectTaskId === "A").tier, "deferred");
});

test("model-2 override validates a feasible tied replacement and its closed result", () => {
  const result = selectNextTasks(source("rec-009-boundary-budget"));
  const overridden = validateOverride(result, request(result));
  assert.equal(overridden.ok, true, JSON.stringify(overridden.diagnostics));
  const validate = validator("docs/contracts/maximum-count-override.schema.json");
  assert.equal(validate(overrideValidationResultToJson(overridden)), true, JSON.stringify(validate.errors));
  assert.deepEqual(overridden.override.selection.selectedTaskIds, ["P", "X", "Z"]);
  assert.equal(overridden.override.source.selectionInputDigest, result.recommendation.selection.inputDigest);
});

test("override rejects stale selection commitment and infeasible or normal selections", () => {
  const result = selectNextTasks(source("rec-009-boundary-budget"));
  const stale = { ...request(result), sourceResultDecisionId: "rec:decision:result:R:sha256:" + "0".repeat(64) };
  assert.equal(validateOverride(result, stale).diagnostics[0].code, "PTOVR-102");
  assert.equal(validateOverride(result, request(result, ["P", "X", "Y", "Z"])).diagnostics[0].code, "PTOVR-104");
  assert.equal(validateOverride(result, request(result, ["P", "X", "Y"])).diagnostics[0].code, "PTOVR-106");
  const altered = structuredClone(result);
  altered.recommendation.selection.input.resources[0].capacity++;
  assert.equal(validateOverride(altered, request(result)).diagnostics[0].code, "PTOVR-101");
});

test("legacy v9 source retains Issue 37 behavior and the v1 override path", () => {
  const result = legacyNext(source("rec-008-runnable-authority"));
  assert.deepEqual(result.groups.runnableNow, ["HIGH_PRIORITY"]);
  assert.deepEqual(result.temporal.authority.startableRecommendedTaskIds, []);
  const value = validateOverride(result, request(result, ["HIGH_PRIORITY"]));
  assert.equal(value.schemaVersion, "Perttool.OverrideDecision.v1");
  assert.equal(value.ok, true, JSON.stringify(value.diagnostics));
});

test("model-2 invariant validation rejects false optimum and broken reason links", () => {
  const result = selectNextTasks(source("rec-010-count-first"));
  const altered = structuredClone(result.recommendation);
  altered.selection.maximumTaskCount++;
  assert.equal(validateMaximumCountAnalysis(altered)[0].code, "PTREC-301");
  const broken = structuredClone(result.recommendation);
  broken.reasonOccurrences[0].decisionStepId = "missing";
  assert.equal(validateMaximumCountAnalysis(broken)[0].code, "PTREC-301");
});

test("override preserves an explicitly supplied raw-byte source identity", async () => {
  const { createHash } = await import("node:crypto");
  const text = source("rec-009-boundary-budget");
  const rawDigest = `sha256:${createHash("sha256").update(Buffer.concat([Buffer.from([239, 187, 191]), Buffer.from(text)])).digest("hex")}`;
  const result = selectNextTasks(text, { sourceDigest: rawDigest });
  assert.equal(result.ok, true);
  assert.equal(result.recommendation.selection.input.sourceDigest, rawDigest);
  assert.equal(validateOverride(result, request(result)).ok, true);
});

test("override rejects an inconsistent active allocation or eligible-task projection", () => {
  const result = selectNextTasks(source("rec-009-boundary-budget"));
  const altered = structuredClone(result);
  altered.tasks.find((task) => task.id === "ACTIVE").requirements[0].units = 2;
  assert.equal(validateOverride(altered, request(result)).diagnostics[0].code, "PTOVR-101");
  const authority = structuredClone(result);
  authority.temporal.authority.eligibleTaskIds = ["P", "X"];
  assert.equal(validateOverride(authority, request(result)).diagnostics[0].code, "PTOVR-101");
});

test("editor focus and Planning Pool context consume the same current selection", async () => {
  const { inspectEditorDagFocus } = await import("../dist/application/editor-dag-focus.js");
  const { strictPlanningExecutionContext } = await import("../dist/application/contract10-planning.js");
  const text = source("rec-010-count-first");
  const result = selectNextTasks(text);
  const focus = inspectEditorDagFocus(text, result.recommendation.sourceDigest);
  assert.equal(focus.status, "current", focus.reason);
  assert.deepEqual(focus.focus.recommendedTaskIds, ["B", "C"]);
  assert.deepEqual(focus.focus.startableTaskIds, ["B", "C"]);
  const planning = strictPlanningExecutionContext(text);
  assert.equal(planning.evidence_state, "complete");
  assert.deepEqual(planning.recommended_task_ids.map((id) => id.split("::").at(-1)), ["B", "C"]);
  assert.deepEqual(planning.startable_task_ids, planning.recommended_task_ids);
});

test("applied capacity below a large requirement still selects fitting tasks and qualifies resource forecasts", () => {
  const result = selectNextTasks(source("rec-010-count-first"), { capacityOverrides: new Map([["WORKER", 1]]) });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.groups.runnableNow, ["B"]);
  assert.deepEqual(result.temporal.authority.startableRecommendedTaskIds, ["B"]);
  assert.equal(result.recommendation.selection.maximumTaskCount, 1);
  assert.equal(result.tasks.every((task) => task.scheduleCritical === null), true);
  assert.equal(result.scheduleAlerts, null);
  const large = result.tasks.find((task) => task.id === "A");
  assert.equal(large.resourceRejections[0].deficit, 2);
});

test("zero capacity admits free tasks and preserves the active-allocation error", () => {
  const text = source("rec-010-count-first");
  const zero = selectNextTasks(text, { capacityOverrides: new Map([["WORKER", 0]]) });
  assert.equal(zero.ok, true, JSON.stringify(zero.diagnostics));
  assert.deepEqual(zero.groups.runnableNow, []);
  const free = text.replace("task C START -> SMALL_DONE:\n  title \"Small C\"\n  duration 1p\n  requires:\n    WORKER 1", "task C START -> SMALL_DONE:\n  title \"Small C\"\n  duration 1p");
  const selected = selectNextTasks(free, { capacityOverrides: new Map([["WORKER", 0]]) });
  assert.equal(selected.ok, true, JSON.stringify(selected.diagnostics));
  assert.deepEqual(selected.groups.runnableNow, ["C"]);
  const active = selectNextTasks(source("rec-009-boundary-budget"), { capacityOverrides: new Map([["WORKER", 0]]) });
  assert.equal(active.ok, false);
  assert.equal(active.recommendation, null);
  assert.ok(active.diagnostics.some((item) => item.code === "PTRES-202"));
});

test("file, stdin and MCP entrypoints share the exact capacity-two, one and zero selections", async () => {
  const { spawnSync } = await import("node:child_process");
  const { createPerttoolMcpAdapter, MCP_TOOL_INPUT_SCHEMAS, MCP_TOOL_OUTPUT_SCHEMAS } = await import("../adapters/mcp/dist/index.js");
  const { fromJsonSchema } = await import("@modelcontextprotocol/server");
  const file = "test/fixtures/recommendation/rec-010-count-first.pert";
  const text = readFileSync(file, "utf8");
  const nextSchema = validator("docs/contracts/maximum-count-next.schema.json");
  const wireSchema = new Ajv2020({ allErrors: true, strict: true }).compile(MCP_TOOL_OUTPUT_SCHEMAS.perttool_next);
  const adapter = createPerttoolMcpAdapter();
  for (const [capacity, expected] of [[2, ["B", "C"]], [1, ["B"]], [0, []]]) {
    const fileResult = spawnSync(process.execPath, ["dist/cli.js", "dag", "next", file, `--capacity=WORKER=${capacity}`, "--format=json"], { encoding: "utf8" });
    const stdin = spawnSync(process.execPath, ["dist/cli.js", "dag", "next", "-", `--capacity=WORKER=${capacity}`, "--format=json"], { encoding: "utf8", input: text });
    assert.equal(fileResult.status, 0, fileResult.stderr);
    assert.equal(stdin.status, 0, stdin.stderr);
    const json = JSON.parse(fileResult.stdout);
    assert.equal(nextSchema(json), true, JSON.stringify(nextSchema.errors));
    assert.deepEqual(json.groups.runnable_now, expected);
    assert.deepEqual(JSON.parse(stdin.stdout).recommendation.selection, json.recommendation.selection);
    const args = { source: { kind: "inline", text }, capacities: [{ resourceId: "WORKER", capacity }] };
    const validated = await fromJsonSchema(MCP_TOOL_INPUT_SCHEMAS.perttool_next)["~standard"].validate(args);
    assert.equal(validated.issues, undefined, JSON.stringify(validated.issues));
    const response = await adapter.executeTool("perttool_next", args);
    assert.equal(response.isError, false, JSON.stringify(response.structuredContent));
    assert.equal(wireSchema(response.structuredContent), true, JSON.stringify(wireSchema.errors));
    assert.deepEqual(response.structuredContent.result.recommendation.selection, json.recommendation.selection);
    assert.deepEqual(response.structuredContent.result.temporal.authority.startable_recommended_task_ids, expected);
  }
  assert.equal(readFileSync(file, "utf8"), text);
});

test("assurance withholding is applied before selecting an independently eligible task", async () => {
  const { planAssuranceMutation } = await import("../dist/index.js");
  const sealed = planAssuranceMutation(source("rec-008-runnable-authority"), {
    kind: "plan_assurance.seal", reason: "Verify independent eligibility before selection",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  const changed = sealed.updatedText.replace('title "Driving path"', 'title "Driving path revised"');
  const result = selectNextTasks(changed);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.temporal.authority.assuranceWithheldTaskIds, ["CRITICAL"]);
  assert.deepEqual(result.groups.runnableNow, ["HIGH_PRIORITY"]);
  assert.deepEqual(result.temporal.authority.startableRecommendedTaskIds, ["HIGH_PRIORITY"]);
});

test("multiple-resource input commitments normalize requirements and override map order", () => {
  const text = source("rec-010-count-first").replace("milestone START:", 'resource GPU:\n  title "GPU"\n  capacity 1\n\nmilestone START:')
    .replace("    WORKER 2", "    WORKER 2\n    GPU 1");
  const first = selectNextTasks(text, { capacityOverrides: new Map([["GPU", 1], ["WORKER", 2]]) });
  const second = selectNextTasks(text, { capacityOverrides: new Map([["WORKER", 2], ["GPU", 1]]) });
  assert.equal(first.ok, true, JSON.stringify(first.diagnostics));
  assert.equal(second.ok, true, JSON.stringify(second.diagnostics));
  assert.deepEqual(first.recommendation.selection, second.recommendation.selection);
  assert.deepEqual(first.recommendation.selection.input.candidates.find((candidate) => candidate.taskId === "A").requirements,
    [{ resourceId: "GPU", units: 1 }, { resourceId: "WORKER", units: 2 }]);
});

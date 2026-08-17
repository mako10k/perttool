import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as packageRoot from "../dist/index.js";
import * as nodeFacade from "../dist/node/index.js";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getJsonSchemaCatalog,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function tableIds(document, prefix) {
  return [
    ...document.matchAll(
      new RegExp("^\\| `(" + prefix + "-\\d{3})` \\|", "gmu"),
    ),
  ].map((match) => match[1]);
}

async function fixture() {
  return JSON.parse(
    await repositoryText("test/fixtures/temporal-schedule-contract-v1.json"),
  );
}

test("temporal schedule contract selects one bounded Grammar 8 DSL", async () => {
  const cases = await fixture();
  assert.equal(
    cases.schema_version,
    "Perttool.TemporalScheduleContractCases.v1",
  );
  assert.equal(cases.activation_state, "contract_only");
  assert.equal(cases.target_grammar_version, 8);
  assert.equal(cases.target_cli_contract_version, 9);
  assert.deepEqual(cases.source_syntax.top_level_declarations_added, [
    "calendar",
  ]);
  assert.deepEqual(cases.source_syntax.project_fields, [
    "time_zone",
    "tzdb",
    "calendar",
    "workday",
  ]);
  assert.deepEqual(cases.source_syntax.resource_fields, [
    "calendar",
    "available_from",
    "available_until",
    "availability",
  ]);
  assert.deepEqual(cases.source_syntax.task_when_events, ["start", "finish"]);
  assert.deepEqual(cases.source_syntax.milestone_when_events, ["reach"]);
  assert.deepEqual(cases.source_syntax.bound_directions, [
    "earliest",
    "latest",
  ]);
  assert.equal(cases.source_syntax.task_calendar, false);
  assert.equal(cases.source_syntax.resource_type, false);
  assert.equal(cases.source_syntax.rrule, false);
  assert.equal(cases.source_syntax.legacy_not_before_in_grammar_8, false);
});

test("zone data and calendar algorithms are immutable and host independent", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.zone_data, {
    authority: "IANA Time Zone Database",
    release: "2026c",
    archive: "tzdata2026c.tar.gz",
    sha256: "e4a178a4477f3d0ea77cc31828ff72aa38feff8d61aa13e7e99e142e9d902be4",
    range_start_inclusive: "1970-01-01T00:00:00Z",
    range_end_exclusive: "2100-01-01T00:00:00Z",
    project_zone_count: 1,
    host_zone_input: false,
    network_input: false,
  });
  assert.deepEqual(cases.algorithm_identities, {
    calendar_arithmetic: "perttool.calendar-projection@2",
    calendar_profile: "perttool.calendar.named-weekly-capacity@1",
    working_time: "perttool.calendar-working-time@1",
    temporal_precedence: "perttool.temporal-precedence-earliest@2",
    temporal_resource: "perttool.temporal-parallel-sgs@2",
    temporal_resource_optimal: false,
    required_schedule: "perttool.required-precedence-backward@1",
    schedule_target: "perttool.schedule-target-evaluation@1",
    schedule_alert: "perttool.schedule-alert@1",
    target_driver_path: "perttool.target-driver-path@1",
  });
});

test("generic availability, constraints, required schedule, and alerts stay distinct", async () => {
  const cases = await fixture();
  const byId = new Map(cases.cases.map((contractCase) => [contractCase.id, contractCase]));

  assert.deepEqual(byId.get("TSC-007").expected, {
    validity_order: 1,
    capacity_override_order: 2,
    calendar_order: 3,
    override_can_open_calendar_gap: true,
    override_can_open_outside_validity: false,
    capacity_range: "zero_through_nominal",
  });
  assert.equal(
    byId.get("TSC-012").expected.release_all_requirements_in_gap,
    true,
  );
  assert.equal(
    byId.get("TSC-017").expected.equal_earliest_latest,
    "valid_exact_event",
  );
  assert.equal(
    byId.get("TSC-018").expected.deadline_becomes_hard_constraint,
    false,
  );
  assert.equal(
    byId.get("TSC-021").expected.resource_optimal,
    false,
  );
  assert.deepEqual(cases.alert_kinds, ["POSTDUE", "POSTDUE_FORECAST"]);
  assert.equal(byId.get("TSC-023").expected.equality, "due_now_no_alert");
  assert.equal(
    byId.get("TSC-024").expected.proof,
    "precedence_infeasible",
  );
  assert.equal(
    byId.get("TSC-025").expected.proof,
    "resource_heuristic_late",
  );
  assert.deepEqual(byId.get("TSC-028").expected.json_argv, [
    "perttool",
    "dag",
    "analyze",
    "FILE",
    "--schedule",
    "both",
    "--format",
    "json",
  ]);
});

test("hard limits, diagnostics, assurance, and public boundaries are closed", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.hard_limits, {
    calendars_per_document: 256,
    weekly_windows_per_calendar: 64,
    dated_exceptions_per_calendar: 4096,
    availability_overrides_per_resource: 4096,
    aggregate_change_instants: 100000,
    work_segments_per_projection: 1000000,
    schedule_alerts: 10000,
    compact_driver_steps_per_alert: 64,
    full_driver_steps_per_alert: 100000,
    full_path_enumeration_max: 1000,
  });
  assert.deepEqual(
    cases.diagnostic_codes,
    Array.from({ length: 9 }, (_, index) => `PTSCH-${101 + index}`),
  );
  assert.deepEqual(cases.commands_added, [
    "calendar add",
    "calendar set",
    "calendar remove",
  ]);
  assert.equal(cases.target_command_count, 56);
  assert.equal(cases.target_root_schema_count, 23);
  assert.deepEqual(cases.target_result_schemas, [
    "Perttool.ProjectResult.v5",
    "Perttool.CheckResult.v6",
    "Perttool.AnalysisResult.v7",
    "Perttool.NextResult.v8",
    "Perttool.MutationResult.v6",
    "Perttool.PlanAssuranceResult.v2",
    "Perttool.UnitMigrationResult.v4",
  ]);
});

test("all thirty-two temporal schedule cases are dependency ordered", async () => {
  const cases = await fixture();
  const accepted = new Set();
  for (const contractCase of cases.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      contractCase.id,
    );
    assert.equal(typeof contractCase.operation, "string");
    assert.equal(Object.keys(contractCase.expected).length > 0, true);
    accepted.add(contractCase.id);
  }
  assert.deepEqual([...accepted], expectedIds("TSC", 32));
});

test("contract task has not activated Grammar 8 or Contract 9 runtime", async () => {
  const cases = await fixture();
  const packageJson = JSON.parse(await repositoryText("package.json"));
  const activeSchemas = getJsonSchemaCatalog().map(({ schemaId }) => schemaId);

  assert.equal(packageJson.version, cases.active_runtime_unchanged.tool_version);
  assert.equal(COMMAND_REGISTRY.length, cases.active_runtime_unchanged.commands);
  assert.equal(activeSchemas.length, cases.active_runtime_unchanged.root_schemas);
  assert.equal(Object.keys(packageRoot).length, cases.active_runtime_unchanged.root_exports);
  assert.equal(Object.keys(nodeFacade).length, cases.active_runtime_unchanged.node_exports);
  assert.equal(Object.keys(core).length, cases.active_runtime_unchanged.core_exports);
  assert.equal(
    COMMAND_REGISTRY.some(({ path: commandPath }) => commandPath[0] === "calendar"),
    false,
  );
  for (const schema of cases.target_result_schemas) {
    assert.equal(activeSchemas.includes(schema), false, schema);
  }
});

test("specification, requirements, design, legacy baselines, acceptance, and plan align", async () => {
  const [
    specification,
    requirements,
    design,
    backlog,
    legacyCalendar,
    legacyDeadline,
    acceptance,
    plan,
  ] = await Promise.all([
    repositoryText("docs/specs/temporal-schedule.md"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/specs/temporal-calendar.md"),
    repositoryText("docs/specs/temporal-deadline.md"),
    repositoryText("docs/process/temporal-schedule-contract-acceptance.md"),
    repositoryText("plans/temporal-schedule.pert"),
  ]);
  assert.match(specification, /- Document status: Accepted design 1\.0/u);
  assert.match(specification, /## 2\. Scoped supersession instead of additive temporal layers/u);
  assert.match(specification, /There is no human resource kind/u);
  assert.match(specification, /POSTDUE_FORECAST/u);
  assert.deepEqual(tableIds(specification, "TSC"), expectedIds("TSC", 32));
  assert.match(
    requirements,
    /\[Calendar-Aware Temporal Scheduling Contract\]\(specs\/temporal-schedule\.md\)/u,
  );
  assert.match(design, /### Post-MVP Slice 7: Calendar-aware temporal scheduling/u);
  assert.match(backlog, /plans\/temporal-schedule\.pert/u);
  assert.match(
    legacyCalendar,
    /Grammar 8 scoped successor: \[Calendar-Aware Temporal Scheduling Contract\]/u,
  );
  assert.match(
    legacyDeadline,
    /Grammar 8 scoped successor: \[Calendar-Aware Temporal Scheduling Contract\]/u,
  );
  assert.match(acceptance, /- Document status: Accepted 1\.0/u);

  const checked = checkDocument(plan);
  assert.equal(checked.ok, true);
  const task = checked.document.declarations.find(
    ({ kind, id }) => kind === "task" && id === "TEMPORAL_SCHEDULE_CONTRACT",
  );
  assert.equal(task?.fields.find(({ name }) => name === "status")?.value, "done");
});

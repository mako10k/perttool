import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDocument, checkDocument, selectNextTasks } from "../dist/application/contract9-temporal.js";
import { getProjectMetadata } from "../dist/application/contract9-project.js";
import { contract9AnalysisTemporalToJson, contract9CheckResultToJson, contract9ProjectResultToJson, contract9ScheduleAlertsToJson, liftContract9AnalysisResultJson, liftContract9NextResultJson, renderContract9ScheduleAlerts } from "../dist/application/contract9-projection.js";

const source = `${[
  "project PROJECTION:", "  version 8", '  title "Projection"', "  as_of 2026-08-17T18:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "", "calendar STANDARD:", "  mon 09:00..17:00", "",
  "milestone START:", '  title "Start"', "  state reached", "", "milestone END:", '  title "End"', "  when reach latest 2026-08-17T16:00:00+09:00", "",
  "task WORK START -> END:", '  title "Work"', "  duration 1h",
].join("\n")}\n`;

test("Contract 9 wire projection owns snake case, bigint, and one-based spans", () => {
  const result = analyzeDocument(source, { sourceOperand: "relative plan.pert" });
  const temporal = contract9AnalysisTemporalToJson(result.temporalSchedule);
  const alerts = contract9ScheduleAlertsToJson(result.scheduleAlerts);
  assert.equal(typeof temporal.required.resource_comparison.events[0].signed_slack_seconds.numerator, "string");
  assert.equal(alerts.occurrences[0].source_range.start.line >= 1, true);
  assert.equal(alerts.occurrences[0].source_range.start.column >= 1, true);
});

test("POSTDUE text keeps proof qualification and exact argv element boundaries", () => {
  const result = analyzeDocument(source, { sourceOperand: "relative plan.pert" });
  const text = renderContract9ScheduleAlerts(result.scheduleAlerts);
  assert.match(text, /POSTDUE milestone=END event=reach/u);
  assert.match(text, /proof=current_snapshot/u);
  assert.doesNotMatch(text, /^ANALYZE /mu);
  const unavailable = { ...result.scheduleAlerts, occurrences: result.scheduleAlerts.occurrences.map((item) => ({ ...item,
    driver: { ...item.driver, state: "unavailable", analysisArgv: ["perttool", "dag", "analyze", "relative plan.pert", "--format", "json"] } })) };
  assert.match(renderContract9ScheduleAlerts(unavailable), /ANALYZE "perttool" "dag" "analyze" "relative plan\.pert" "--format" "json"/u);
});

test("Project and Check wire envelopes expose only Contract 9 identities and fields", () => {
  const envelope = { source: "relative plan.pert", sourceDigest: `sha256:${"0".repeat(64)}` };
  const project = contract9ProjectResultToJson(getProjectMetadata(source), envelope);
  const checked = contract9CheckResultToJson(checkDocument(source, { sourceOperand: envelope.source }), envelope);
  assert.equal(project.schema_version, "Perttool.ProjectResult.v5");
  assert.equal(project.cli_contract_version, 9);
  assert.equal(project.temporal_schedule.grammar_version, 8);
  assert.equal(checked.schema_version, "Perttool.CheckResult.v6");
  assert.equal(checked.cli_contract_version, 9);
  assert.equal(checked.schedule_alerts.occurrences[0].kind, "POSTDUE");
  assert.equal("document" in checked, false);
});

test("Analysis and Next lift only their replacement fields over complete Contract 8 projections", () => {
  const analysis = analyzeDocument(source, { sourceOperand: "relative plan.pert" });
  const next = selectNextTasks(source, { sourceOperand: "relative plan.pert" });
  const analysisWire = liftContract9AnalysisResultJson({ schema_version: "Perttool.AnalysisResult.v6", retained: true }, analysis);
  const nextWire = liftContract9NextResultJson({ schema_version: "Perttool.NextResult.v7", retained: true }, next);
  assert.deepEqual([analysisWire.schema_version, analysisWire.cli_contract_version, analysisWire.retained], ["Perttool.AnalysisResult.v7", 9, true]);
  assert.equal(analysisWire.schedule_alerts.occurrences[0].kind, "POSTDUE");
  assert.deepEqual([nextWire.schema_version, nextWire.cli_contract_version, nextWire.retained], ["Perttool.NextResult.v8", 9, true]);
  assert.throws(() => liftContract9AnalysisResultJson({ schema_version: "Perttool.AnalysisResult.v5" }, analysis), /expected Perttool.AnalysisResult\.v6/u);
});

import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { checkDocument, analyzeDocument, selectNextTasks } from "../dist/application/contract9-temporal.js";
import { CONTRACT9_COMMAND_REGISTRY, getContract9CommandDiscovery } from "../dist/command/contract9-discovery.js";
import { validateContract9CommandInvocation } from "../dist/command/contract9-usage.js";

const grammar8 = `${[
  "project CONTRACT9:", "  version 8", '  title "Contract 9"',
  "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
  "calendar STANDARD:", "  mon 09:00..12:00, 13:00..17:00", "",
  "milestone START:", '  title "Start"', "  state reached", "",
  "milestone END:", '  title "End"', "  when reach latest 2026-08-17T10:00:00+09:00", "",
  "resource DEV:", '  title "Developer"', "  capacity 1", "  calendar STANDARD", "",
  "task BUILD START -> END:", '  title "Build"', "  duration 2h", "  requires:", "    DEV 1",
].join("\n")}\n`;

test("Contract 9 composition emits the three closed temporal result identities", () => {
  const checked = checkDocument(grammar8, { sourceOperand: "plan.pert" });
  const analyzed = analyzeDocument(grammar8, { mode: "both", sourceOperand: "plan.pert" });
  const next = selectNextTasks(grammar8, { sourceOperand: "plan.pert" });
  assert.equal(checked.ok, true, JSON.stringify(checked.diagnostics));
  assert.equal(checked.schemaVersion, "Perttool.CheckResult.v6");
  assert.equal(analyzed.schemaVersion, "Perttool.AnalysisResult.v7");
  assert.equal(next.schemaVersion, "Perttool.NextResult.v8");
  assert.equal(checked.scheduleAlerts.summary.postdueForecast, 1);
  assert.equal(analyzed.scheduleAlerts.summary.postdueForecast, 1);
  assert.equal(next.scheduleAlerts.summary.postdueForecast, 1);
  assert.equal(analyzed.temporalSchedule.required.state, "available");
  assert.equal(checked.scheduleAlerts.occurrences[0].driver.state, "available");
  assert.ok(checked.scheduleAlerts.occurrences[0].driver.steps.length > 0);
});

test("Contract 9 preserves legacy semantics under the replacement result identities", () => {
  const grammar7 = grammar8.replace("  version 8", "  version 7")
    .replace('  time_zone "Asia/Tokyo"\n  tzdb "2026c"\n  calendar STANDARD\n', "")
    .replace("calendar STANDARD:\n  mon 09:00..12:00, 13:00..17:00\n\n", "")
    .replace("  when reach latest 2026-08-17T10:00:00+09:00\n", "")
    .replace("  calendar STANDARD\n", "");
  const checked = checkDocument(grammar7);
  const analyzed = analyzeDocument(grammar7);
  const next = selectNextTasks(grammar7);
  assert.equal(checked.schemaVersion, "Perttool.CheckResult.v6");
  assert.equal(analyzed.schemaVersion, "Perttool.AnalysisResult.v7");
  assert.equal(next.schemaVersion, "Perttool.NextResult.v8");
  assert.equal(checked.scheduleAlerts, null);
  assert.equal(analyzed.temporalSchedule, null);
  assert.equal(analyzed.scheduleAlerts, null);
  assert.equal(next.scheduleAlerts, null);
});

test("Contract 9 catalog is closed at 56 while the public Contract 8 catalog remains active", () => {
  assert.equal(CONTRACT9_COMMAND_REGISTRY.length, 56);
  assert.deepEqual(CONTRACT9_COMMAND_REGISTRY.slice(-3).map(({ operation }) => operation),
    ["calendar.add", "calendar.set", "calendar.remove"]);
  const discovery = getContract9CommandDiscovery({ resource: "calendar", action: null });
  assert.equal(discovery.ok, true);
  assert.equal(discovery.cliContractVersion, 9);
  assert.equal(discovery.commands.length, 3);
  assert.equal(validateContract9CommandInvocation(["calendar", "add", "plan.pert", "STANDARD", "--weekday", "mon 09:00..17:00"]).ok, true);
  assert.equal(publicApi.COMMAND_REGISTRY.length, 53);
  assert.equal(publicApi.COMMAND_REGISTRY.some(({ operation }) => operation.startsWith("calendar.")), false);
});

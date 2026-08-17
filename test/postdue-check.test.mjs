import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { projectTargetPostdueCheck } from "../dist/application/target-postdue-check.js";

const base = Object.freeze({ schemaVersion: "Perttool.CheckResult.v5", ok: true, documentId: "P",
  diagnostics: Object.freeze([{ code: "EXISTING" }]), diagnosticsTruncated: true,
  summary: Object.freeze({ errors: 0, warnings: 1 }), acceptance: null });
const driver = Object.freeze({ state: "not_computed", pathId: null, steps: Object.freeze([]), truncated: false,
  analysisArgv: Object.freeze(["perttool", "dag", "analyze", "p.pert", "--schedule", "both", "--format", "json"]) });
const alerts = Object.freeze({ modelVersion: 1, documentId: "P",
  evaluator: Object.freeze({ id: "perttool.schedule-alert", version: 1, optimal: null }), state: "available",
  summary: Object.freeze({ postdue: 1, postdueForecast: 1, total: 2 }),
  occurrences: Object.freeze([{ alertId: "a1", driver }, { alertId: "a2", driver }]),
  truncation: Object.freeze({ truncated: false, emitted: 2, total: 2, totalKnown: true }), unavailableCauses: Object.freeze([]) });

test("PDCHECK-001 through PDCHECK-004 project compact alerts and exact argv", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/postdue-check-v1.json", "utf8"));
  assert.equal(fixture.cases.length, 10);
  const result = projectTargetPostdueCheck(base, alerts);
  assert.equal(result.schemaVersion, "Perttool.CheckResult.v6");
  assert.deepEqual(result.scheduleAlerts.occurrences[0].driver.analysisArgv, driver.analysisArgv);
  const excessive = { ...alerts, occurrences: Object.freeze([{ alertId: "a3", driver: Object.freeze({ state: "available", steps: Object.freeze(Array.from({ length: 65 }, (_, index) => ({ id: String(index) }))) }) }]), summary: Object.freeze({ postdue: 1, postdueForecast: 0, total: 1 }), truncation: Object.freeze({ truncated: false, emitted: 1, total: 1, totalKnown: true }) };
  assert.throws(() => projectTargetPostdueCheck(base, excessive), /compact limit/);
});

test("PDCHECK-005 through PDCHECK-007 keep alerts separate and success unchanged", () => {
  const result = projectTargetPostdueCheck(base, alerts);
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics, base.diagnostics);
  assert.equal(result.diagnosticsTruncated, true);
  assert.deepEqual(result.scheduleAlerts.summary, { postdue: 1, postdueForecast: 1, total: 2 });
});

test("PDCHECK-008 through PDCHECK-010 fail closed and retain public v5", () => {
  assert.throws(() => projectTargetPostdueCheck(base, { ...alerts, documentId: "OTHER" }), /identities differ/);
  assert.throws(() => projectTargetPostdueCheck({ ...base, ok: false }, alerts), /invalid Check/);
  assert.equal("projectTargetPostdueCheck" in publicApi, false);
  assert.equal(publicApi.getJsonSchemaCatalog().some(({ schemaId }) => schemaId === "Perttool.CheckResult.v6"), false);
});

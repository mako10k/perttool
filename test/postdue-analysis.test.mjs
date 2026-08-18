import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { projectTargetPostdueAnalysis } from "../dist/application/target-postdue-analysis.js";

const base = Object.freeze({ schemaVersion: "Perttool.AnalysisResult.v7", ok: true, documentId: "P", precedence: Object.freeze({ legacy: true }), resource: Object.freeze({ legacy: true }), acceptance: null });
const profile = Object.freeze({ state: "available", algorithm: Object.freeze({ id: "perttool.temporal-precedence-earliest", version: 2, optimal: null }), makespanSeconds: null, tasks: Object.freeze([]), milestones: Object.freeze([]), utilization: Object.freeze([]), unavailableCauses: Object.freeze([]) });
const resource = Object.freeze({ ...profile, algorithm: Object.freeze({ id: "perttool.temporal-parallel-sgs", version: 2, optimal: false }) });
const scheduler = Object.freeze({ modelVersion: 1, documentId: "P", source: Object.freeze({}), precedence: profile, resource });
const required = Object.freeze({ modelVersion: 1, documentId: "P", source: scheduler.source, state: "available", algorithm: Object.freeze({ id: "perttool.required-precedence-backward", version: 1, optimal: null }), anchor: null, tasks: Object.freeze([]), milestones: Object.freeze([]), precedenceComparison: Object.freeze({ state: "available", classification: "feasible", optimal: null, events: Object.freeze([]) }), resourceComparison: Object.freeze({ state: "available", classification: "resource_heuristic_late", optimal: false, events: Object.freeze([{ signedSlackSeconds: Object.freeze({ numerator: -1n, denominator: 1n }) }]) }), unavailableCauses: Object.freeze([]) });
const alerts = Object.freeze({ modelVersion: 1, documentId: "P", evaluator: Object.freeze({ id: "perttool.schedule-alert", version: 1, optimal: null }), state: "available", summary: Object.freeze({ postdue: 0, postdueForecast: 1, total: 1 }), occurrences: Object.freeze([{ alertId: "alert:1", driver: Object.freeze({ state: "available", pathId: "driver:1", steps: Object.freeze([{ kind: "task", id: "A" }]), truncated: false }) }]), truncation: Object.freeze({ truncated: false, emitted: 1, total: 1, totalKnown: true }), unavailableCauses: Object.freeze([]) });

test("PDA-001 through PDA-005 project forward, required, slack, and qualification", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/postdue-analysis-v1.json", "utf8"));
  assert.equal(fixture.cases.length, 12);
  const result = projectTargetPostdueAnalysis(base, scheduler, required, alerts);
  assert.equal(result.schemaVersion, "Perttool.AnalysisResult.v7");
  assert.equal(result.temporalSchedule.precedence, profile);
  assert.equal(result.temporalSchedule.resource.algorithm.optimal, false);
  assert.equal(result.temporalSchedule.required.resourceComparison.events[0].signedSlackSeconds.numerator, -1n);
});

test("PDA-006 through PDA-009 retain full or unavailable driver evidence", () => {
  assert.equal(projectTargetPostdueAnalysis(base, scheduler, required, alerts).scheduleAlerts.occurrences[0].driver.pathId, "driver:1");
  const unavailable = { ...alerts, occurrences: Object.freeze([{ alertId: "alert:2", driver: Object.freeze({ state: "unavailable", pathId: null, steps: Object.freeze([]), truncated: false }) }]) };
  assert.equal(projectTargetPostdueAnalysis(base, scheduler, required, unavailable).scheduleAlerts.occurrences[0].driver.state, "unavailable");
  const notComputed = { ...alerts, occurrences: Object.freeze([{ alertId: "alert:3", driver: Object.freeze({ state: "not_computed", pathId: null, steps: Object.freeze([]), truncated: false }) }]) };
  assert.throws(() => projectTargetPostdueAnalysis(base, scheduler, required, notComputed), /requires computed/);
});

test("PDA-010 through PDA-012 enforce complete bindings and public activation", () => {
  assert.throws(() => projectTargetPostdueAnalysis(base, scheduler, null, alerts), /must be complete/);
  assert.throws(() => projectTargetPostdueAnalysis(base, { ...scheduler, documentId: "OTHER" }, required, alerts), /identities differ/);
  const result = projectTargetPostdueAnalysis(base, scheduler, required, alerts);
  assert.equal(result.precedence, base.precedence);
  assert.equal("projectTargetPostdueAnalysis" in publicApi, false);
  assert.equal(publicApi.getJsonSchemaCatalog().some(({ schemaId }) => schemaId === "Perttool.AnalysisResult.v7"), true);
});

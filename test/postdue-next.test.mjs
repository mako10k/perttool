import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { projectTargetPostdueNext } from "../dist/application/target-postdue-next.js";

const base = Object.freeze({ schemaVersion: "Perttool.NextResult.v8", ok: true, documentId: "P",
  groups: Object.freeze({ ready: Object.freeze(["A"]), runnableNow: Object.freeze(["A"]), active: Object.freeze([]), blockedNow: Object.freeze([]), upcoming: Object.freeze([]), suspended: Object.freeze([]) }),
  recommendation: Object.freeze({ recommendedTaskIds: Object.freeze(["A"]) }),
  temporal: Object.freeze({ authority: Object.freeze({ startableRecommendedTaskIds: Object.freeze(["A"]) }), tasks: Object.freeze([]) }),
  acceptance: null });
const alerts = Object.freeze({ modelVersion: 1, documentId: "P",
  evaluator: Object.freeze({ id: "perttool.schedule-alert", version: 1, optimal: null }), state: "available",
  summary: Object.freeze({ postdue: 1, postdueForecast: 0, total: 1 }),
  occurrences: Object.freeze([{ alertId: "alert:1", driver: Object.freeze({ state: "not_computed",
    analysisArgv: Object.freeze(["perttool", "dag", "analyze", "p.pert", "--schedule", "both", "--format", "json"]) }) }]),
  truncation: Object.freeze({ truncated: false, emitted: 1, total: 1, totalKnown: true }), unavailableCauses: Object.freeze([]) });

test("PDN-001 through PDN-004 project complete compact alert context", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/postdue-next-v1.json", "utf8"));
  assert.equal(fixture.cases.length, 12);
  const result = projectTargetPostdueNext(base, alerts);
  assert.equal(result.schemaVersion, "Perttool.NextResult.v8");
  assert.equal(result.scheduleAlerts.occurrences[0].alertId, "alert:1");
  assert.deepEqual(result.scheduleAlerts.occurrences[0].driver.analysisArgv, alerts.occurrences[0].driver.analysisArgv);
});

test("PDN-005 through PDN-008 preserve recommendation and authority", () => {
  const result = projectTargetPostdueNext(base, alerts);
  assert.equal(result.recommendation, base.recommendation);
  assert.equal(result.groups, base.groups);
  assert.equal(result.temporal, base.temporal);
  const unavailable = { ...alerts, state: "unavailable", occurrences: Object.freeze([]),
    summary: Object.freeze({ postdue: 0, postdueForecast: 0, total: 0 }),
    truncation: Object.freeze({ truncated: false, emitted: 0, total: null, totalKnown: false }),
    unavailableCauses: Object.freeze([{ code: "forward_schedule_unavailable", entityIds: Object.freeze(["A"]) }]) };
  assert.equal(projectTargetPostdueNext(base, unavailable).recommendation, base.recommendation);
});

test("PDN-009 through PDN-012 bind documents and activate public v8", () => {
  assert.throws(() => projectTargetPostdueNext(base, { ...alerts, documentId: "OTHER" }), /identities differ/);
  assert.equal("projectTargetPostdueNext" in publicApi, false);
  assert.equal(publicApi.getJsonSchemaCatalog().some(({ schemaId }) => schemaId === "Perttool.NextResult.v8"), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { evaluateContract9PlanAssurance } from "../dist/application/contract9-assurance.js";

function source({ when = "  when start earliest 2026-08-17T10:00:00+09:00", calendar = "  mon 09:00..17:00", hashModel = 2 } = {}) {
  return `${[
    "project ASSURANCE_V2:", "  version 8", '  title "Assurance v2"',
    "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
    `  plan_assurance_model 1`, `  plan_assurance_hash_model ${hashModel}`,
    '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
    "calendar STANDARD:", calendar, "",
    "milestone START:", '  title "Start"', "  state reached", "",
    "milestone END:", '  title "End"', "",
    "task WORK START -> END:", '  title "Work"', "  duration 1h", when,
  ].join("\n")}\n`;
}

test("hash model 2 computes TaskPlanContract v2 and includes ordered when values", () => {
  const first = evaluateContract9PlanAssurance(source());
  const changed = evaluateContract9PlanAssurance(source({ when: "  when start earliest 2026-08-17T11:00:00+09:00" }));
  assert.equal(first.ok, true);
  assert.equal(first.hashModelVersion, 2);
  assert.equal(first.taskResults[0].status, "unsealed");
  assert.match(first.taskResults[0].contractHash, /^sha256:[0-9a-f]{64}$/u);
  assert.notEqual(first.taskResults[0].contractHash, changed.taskResults[0].contractHash);
});

test("ambient calendar changes recompute scheduling but do not mass-change task contracts", () => {
  const first = evaluateContract9PlanAssurance(source());
  const changed = evaluateContract9PlanAssurance(source({ calendar: "  mon 08:00..16:00" }));
  assert.equal(first.taskResults[0].contractHash, changed.taskResults[0].contractHash);
});

test("fractional bound seconds are reduced before canonical hashing", () => {
  const result = evaluateContract9PlanAssurance(source({ when: "  when start earliest 2026-08-17T10:00:00.5000+09:00" }));
  assert.equal(result.ok, true);
  assert.match(result.taskResults[0].contractHash, /^sha256:[0-9a-f]{64}$/u);
});

test("Grammar 8 never evaluates a v1 assurance hash as model 2", () => {
  const result = evaluateContract9PlanAssurance(source({ hashModel: 1 }));
  assert.equal(result.ok, true);
  assert.equal(result.taskResults[0].status, "unavailable");
  assert.equal(result.taskResults[0].directCauses[0].kind, "unknown_model");
  assert.equal("evaluateContract9PlanAssurance" in publicApi, false);
});

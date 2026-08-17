import assert from "node:assert/strict";
import test from "node:test";
import { planMutation as planContract8Mutation, planUnitMigration as planContract8UnitMigration } from "../dist/application/contract8-milestone-acceptance.js";
import { liftContract9Candidate } from "../dist/application/contract9-candidate.js";

const source = `${[
  "project CONTRACT9_CANDIDATE:", "  version 8", '  title "Candidate"',
  "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
  "calendar STANDARD:", "  # preserve me", "  mon 09:00..12:00, 13:00..17:00", "",
  "milestone START:", '  title "Start"', "  state reached", "",
  "milestone END:", '  title "End"', "  when reach latest 2026-08-18T17:00:00+09:00", "",
  "resource DEV:", '  title "Developer"', "  capacity 1", "  calendar STANDARD", "",
  "task WORK START -> END:", '  title "Work"', "  duration 2h", "  when start earliest 2026-08-17T10:00:00+09:00",
  "  requires:", "    DEV 1",
].join("\n")}\n`;

test("Contract 9 candidate lift reapplies legacy mutation edits to the complete Grammar 8 source", () => {
  const result = liftContract9Candidate(source,
    (base) => planContract8Mutation(base, { kind: "task.set", id: "WORK", set: { title: "Changed" } }),
    { originalLabel: "plan.pert", updatedLabel: "candidate" });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.MutationResult.v6");
  assert.match(result.updatedText, /title "Changed"/u);
  assert.match(result.updatedText, /# preserve me/u);
  assert.match(result.updatedText, /when start earliest 2026-08-17T10:00:00\+09:00/u);
  assert.match(result.diff, /^--- plan\.pert\n\+\+\+ candidate\n/u);
});

test("Contract 9 unit migration retains all temporal bytes and uses result model 4", () => {
  const result = liftContract9Candidate(source,
    (base) => planContract8UnitMigration(base, { targetUnit: "point", replacementVelocity: "1p/1h" }));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.UnitMigrationResult.v4");
  assert.deepEqual(result.unitMigration, { id: "perttool.unit-migration", version: 4 });
  for (const retained of ["calendar STANDARD:", "  # preserve me", "  when reach latest", "  when start earliest"]) {
    assert.ok(result.updatedText.includes(retained), retained);
  }
});

test("Contract 9 lift fails closed when a legacy edit invalidates the complete temporal candidate", () => {
  const result = liftContract9Candidate(source,
    (base) => planContract8Mutation(base, { kind: "project.set", set: { version: 7 } }));
  assert.equal(result.ok, false);
  assert.equal(result.updatedText, null);
  assert.equal(result.updatedDigest, null);
  assert.deepEqual(result.edits, []);
});

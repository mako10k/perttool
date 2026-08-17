import assert from "node:assert/strict";
import test from "node:test";
import { planContract9Format, planContract9GrammarMigration } from "../dist/application/contract9-format-migration.js";
import { validateContract9CommandInvocation } from "../dist/command/contract9-usage.js";
import { CONTRACT9_COMMAND_REGISTRY } from "../dist/command/contract9-discovery.js";
import { persistContract9Mutation } from "../dist/application/contract9-write.js";

const grammar7 = `${["project MIGRATE:", "  version 7", '  title "Migrate"', "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END", "", "milestone START:", '  title "Start"', "  state reached", "", "milestone END:", '  title "End"', "", "task WORK START -> END:", '  title "Work"', "  duration 1h", "  not_before 2026-08-17T10:00:00+09:00"].join("\n")}\n`;

test("Grammar 7 migration changes only version and exact not_before spelling", () => {
  const result = planContract9GrammarMigration(grammar7);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.targetGrammarVersion, 8);
  assert.deepEqual(result.migratedTaskIds, ["WORK"]);
  assert.match(result.updatedText, /^  version 8$/mu);
  assert.match(result.updatedText, /^  when start earliest 2026-08-17T10:00:00\+09:00$/mu);
  assert.doesNotMatch(result.updatedText, /not_before/u);
  assert.equal(result.edits.length, 1);
});

test("assurance migration stops for a separate model-2 initial seal and Advance v3 stays unchanged", () => {
  const assurance = grammar7.replace("  finish END", "  finish END\n  plan_assurance_model 1\n  plan_assurance_hash_model 1");
  const result = planContract9GrammarMigration(assurance);
  assert.equal(result.ok, false);
  assert.equal(result.updatedText, null);
  assert.equal(result.requiredAction, "initialize_plan_assurance_hash_model_2");
  const advance = CONTRACT9_COMMAND_REGISTRY.find(({ operation }) => operation === "dag.advance");
  assert.deepEqual(advance.resultSchemas, ["Perttool.AdvanceResult.v3", "Perttool.CliError.v1"]);
});

test("format and migration candidates share the Grammar 8 write validator", async () => {
  const migrated = planContract9GrammarMigration(grammar7);
  assert.deepEqual(await persistContract9Mutation(migrated, { mode: "preview" }), { mode: "preview", target: null, written: false });
  const formatted = planContract9Format(migrated.updatedText);
  assert.deepEqual(await persistContract9Mutation(formatted, { mode: "preview" }), { mode: "preview", target: null, written: false });
});

test("Contract 9 accepts only target grammar 8 and Grammar 8 formatting is idempotent", () => {
  assert.equal(validateContract9CommandInvocation(["document", "migrate", "plan.pert", "--target-grammar", "8"]).ok, true);
  assert.equal(validateContract9CommandInvocation(["document", "migrate", "plan.pert", "--target-grammar", "7"]).ok, false);
  const migrated = planContract9GrammarMigration(grammar7);
  const first = planContract9Format(migrated.updatedText);
  assert.equal(first.ok, true, JSON.stringify(first.diagnostics));
  const second = planContract9Format(first.updatedText);
  assert.equal(second.ok, true);
  assert.equal(second.changed, false);
  assert.equal(second.updatedText, first.updatedText);
});

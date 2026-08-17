import assert from "node:assert/strict";
import test from "node:test";
import { planMutation as planContract8Mutation } from "../dist/application/contract8-milestone-acceptance.js";
import { composeContract9MixedMutation } from "../dist/application/contract9-mixed-mutation.js";
import { planContract9TemporalMutation } from "../dist/application/contract9-temporal-mutation.js";
import { validateContract9CommandInvocation } from "../dist/command/contract9-usage.js";
import { applyTextEdits } from "../dist/mutation/text-edits.js";

const source = `${[
  "project MIXED:", "  version 8", '  title "Mixed"', "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  "  plan_assurance_model 1", "  plan_assurance_hash_model 2", '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
  "calendar STANDARD:", "  mon 09:00..17:00", "", "milestone START:", '  title "Start"', "  state reached", "",
  "milestone END:", '  title "End"', "", "resource DEV:", '  title "Developer"', "  capacity 1", "",
  "task WORK START -> END:", '  title "Work"', "  duration 1h", "  requires:", "    DEV 1",
].join("\n")}\n`;

function mixedInvocation() {
  const invocation = validateContract9CommandInvocation(["task", "set", "plan.pert", "WORK", "--title", "Changed",
    "--when", "finish latest 2026-08-17T16:00:00+09:00"]);
  assert.equal(invocation.ok, true, invocation.ok ? "" : invocation.error.message);
  return invocation;
}

test("mixed mutation composes one exact candidate and model-2 assurance impact", () => {
  const invocation = mixedInvocation();
  const result = composeContract9MixedMutation(source,
    (base) => planContract8Mutation(base, { kind: "task.set", id: "WORK", set: { title: "Changed" } }),
    (candidate) => planContract9TemporalMutation(candidate, invocation));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.MutationResult.v6");
  assert.match(result.updatedText, /title "Changed"/u);
  assert.match(result.updatedText, /when finish latest 2026-08-17T16:00:00\+09:00/u);
  assert.equal(applyTextEdits(source, result.edits), result.updatedText);
  assert.deepEqual(result.assuranceImpact.affectedTaskIds, ["WORK"]);
  assert.notEqual(result.assuranceImpact.before.taskResults[0].contractHash,
    result.assuranceImpact.after.taskResults[0].contractHash);
});

test("mixed mutation fails closed when a temporal edit touches a legacy replacement", () => {
  const result = composeContract9MixedMutation(source,
    (base) => planContract8Mutation(base, { kind: "task.set", id: "WORK", set: { title: "Changed" } }),
    (candidate) => ({ ok: true, documentId: "MIXED", changed: true,
      updatedText: `${candidate.slice(0, candidate.indexOf('title "Changed"'))}title "Other"${candidate.slice(candidate.indexOf('title "Changed"') + 15)}`,
      edits: [{ startOffset: candidate.indexOf('title "Changed"'), endOffset: candidate.indexOf('title "Changed"') + 15,
        replacement: 'title "Other"' }], diagnostics: [], diagnosticsTruncated: false }));
  assert.equal(result.ok, false);
  assert.equal(result.updatedText, null);
  assert.equal(result.diagnostics.at(-1).code, "PTSCH-110");
});

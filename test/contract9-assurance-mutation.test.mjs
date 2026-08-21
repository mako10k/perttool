import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { planContract9AssuranceSealMutation } from "../dist/application/contract9-assurance-mutation.js";
import { evaluateContract9PlanAssurance } from "../dist/application/contract9-assurance.js";

const source = `${[
  "project ASSURANCE_MUTATION_V2:", "  version 8", '  title "Assurance mutation"',
  "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
  "calendar STANDARD:", "  # calendar comment remains", "  mon 09:00..17:00", "",
  "milestone START:", '  title "Start"', "  state reached", "",
  "milestone END:", '  title "End"', "",
  "task WORK START -> END:", '  title "Work"', "  duration 1h",
  "  when start earliest 2026-08-17T10:00:00+09:00",
].join("\n")}\n`;

test("model-2 initial seal enables hash model 2 and seals the complete v2 basis", () => {
  const result = planContract9AssuranceSealMutation(source, { kind: "plan_assurance.seal", reason: "Reviewed v2 baseline" });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.MutationResult.v6");
  assert.equal(result.governance.applicable, true);
  assert.deepEqual(result.governance.affectedScopes, ["plan_assurance"]);
  assert.equal(result.governance.intent, "preview");
  assert.match(result.updatedText, /plan_assurance_model 1\n  plan_assurance_hash_model 2/u);
  assert.match(result.updatedText, /plan_seal WORK:\n  accepted_contract sha256:[0-9a-f]{64}\n  accepted_basis sha256:[0-9a-f]{64}/u);
  assert.match(result.updatedText, /# calendar comment remains/u);
  const evaluated = evaluateContract9PlanAssurance(result.updatedText);
  assert.equal(evaluated.hashModelVersion, 2);
  assert.equal(evaluated.coverage, "complete");
  assert.equal(evaluated.taskResults[0].status, "verified");
  assert.equal("planContract9AssuranceSealMutation" in publicApi, false);
});

test("model-2 reseal binds a changed when contract and preserves unrelated source", () => {
  const initial = planContract9AssuranceSealMutation(source, { kind: "plan_assurance.seal", reason: "Initial" });
  const changed = initial.updatedText.replace("10:00:00+09:00", "11:00:00+09:00")
    .replace('  reason "Initial"', '  # seal review note\n  reason "Initial"');
  assert.equal(evaluateContract9PlanAssurance(changed).taskResults[0].status, "review_required");
  const resealed = planContract9AssuranceSealMutation(changed,
    { kind: "plan_assurance.reseal", taskIds: ["WORK"], reason: "Accepted time change" });
  assert.equal(resealed.ok, true, JSON.stringify(resealed.diagnostics));
  assert.equal((resealed.updatedText.match(/^plan_seal WORK:/gmu) ?? []).length, 1);
  assert.match(resealed.updatedText, /reason "Accepted time change"/u);
  assert.match(resealed.updatedText, /# calendar comment remains/u);
  assert.match(resealed.updatedText, /# seal review note/u);
  assert.equal(evaluateContract9PlanAssurance(resealed.updatedText).taskResults[0].status, "verified");
});

test("model-2 reseal establishes the first basis for a newly added task", () => {
  const initial = planContract9AssuranceSealMutation(source,
    { kind: "plan_assurance.seal", reason: "Initial" });
  const beforeWork = /plan_seal WORK:[\s\S]*?(?=\n\n|$)/u.exec(initial.updatedText)[0];
  const partial = initial.updatedText
    .replace(
      "milestone END:",
      "milestone ADDED:\n  title \"Added\"\n\nmilestone END:",
    )
    .replace(
      "\nplan_seal WORK:",
      "\ntask ADDED_WORK START -> ADDED:\n  title \"Added work\"\n  duration 1h\n\ngate ADDED_JOIN ADDED -> END:\n  reason \"retain one connected finish path\"\n\nplan_seal WORK:",
    );
  const before = evaluateContract9PlanAssurance(partial);
  assert.equal(before.coverage, "partial");
  assert.equal(before.taskResults.find(({ taskId }) => taskId === "ADDED_WORK").status, "unsealed");
  const resealed = planContract9AssuranceSealMutation(partial, {
    kind: "plan_assurance.reseal",
    taskIds: ["ADDED_WORK"],
    reason: "Reviewed newly added task",
  });
  assert.equal(resealed.ok, true, JSON.stringify(resealed.diagnostics));
  assert.equal(
    /plan_seal WORK:[\s\S]*?(?=\n\n|$)/u.exec(resealed.updatedText)[0],
    beforeWork,
  );
  assert.match(
    resealed.updatedText,
    /plan_seal ADDED_WORK:[\s\S]*reason "Reviewed newly added task"/u,
  );
  assert.equal(evaluateContract9PlanAssurance(resealed.updatedText).coverage, "complete");
});

test("model-2 seal mutation rejects unknown models, missing seals, and empty reasons", () => {
  const wrong = source.replace('  time_zone "Asia/Tokyo"', "  plan_assurance_model 1\n  plan_assurance_hash_model 1\n  time_zone \"Asia/Tokyo\"");
  assert.equal(planContract9AssuranceSealMutation(wrong, { kind: "plan_assurance.seal", reason: "x" }).ok, false);
  assert.equal(planContract9AssuranceSealMutation(source, { kind: "plan_assurance.reseal", taskIds: ["WORK"], reason: "x" }).ok, false);
  assert.equal(planContract9AssuranceSealMutation(source, { kind: "plan_assurance.reseal", taskIds: ["WORK", "WORK"], reason: "x" }).ok, false);
  assert.equal(planContract9AssuranceSealMutation(source, { kind: "plan_assurance.seal", reason: "" }).ok, false);
});

test("model-2 persistence authority is evaluated against the pre-change owner", () => {
  const denied = planContract9AssuranceSealMutation(source,
    { kind: "plan_assurance.seal", reason: "Persist" }, { governance: { intent: "persist", actor: "codex" } });
  assert.equal(denied.ok, false);
  assert.equal(denied.governance.writeAuthorized, false);
  assert.equal(denied.diagnostics[0].code, "PTGOV-101");
  const accepted = planContract9AssuranceSealMutation(source,
    { kind: "plan_assurance.seal", reason: "Persist" },
    { governance: { intent: "persist", actor: "codex", acceptedByOwner: ["user"] } });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.governance.writeAuthorized, true);
});

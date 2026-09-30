// R: Verify public Plan Review composition preserves real independent decisions.
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import Ajv2020 from "ajv/dist/2020.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = process.env.PERTTOOL_PLAN_REVIEW_PACKAGE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = await import(pathToFileURL(path.join(root, "dist/index.js")).href);

function source(version = 10) {
  return `project REVIEW:
  version ${version}
  title "Review"
  as_of 2026-09-30
  duration_unit point
  velocity 2p/1d
  finish END
  dag_owner user
  goal_owner boss

milestone START:
  title "Start"
  state reached

milestone MID:
  title "Middle"

milestone END:
  title "End"

task WORK START -> MID:
  title "Work"
  duration 1p

gate JOIN MID -> END:
  reason "Join"
`;
}

function opened(text = source()) {
  const result = api.planPlanReviewCreate(text, {
    schemaVersion: api.PLAN_REVIEW_CREATE_REQUEST_ID,
    requestId: "REVIEW_1", taskId: "WORK", reason: "Review the plan",
    createdAt: "2026-09-30T10:00:00+09:00", actor: "codex",
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.updatedText;
}

function resolve(text, mutations, extra = {}) {
  return api.planPlanReviewResolve(text, {
    schemaVersion: api.PLAN_REVIEW_RESOLVE_REQUEST_ID,
    requestId: "REVIEW_1", outcome: "plan_changed", actor: "user",
    resolvedAt: "2026-09-30T11:00:00+09:00",
    resolutionReason: "Reviewed the complete candidate",
    request: { kind: "batch", mutations }, ...extra,
  });
}

function denied(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.updatedText, null);
  assert.equal(result.updatedDigest, null);
  assert.equal(result.diagnostics.some((item) => item.code === code), true,
    JSON.stringify(result.diagnostics));
}

const durationChange = { kind: "task.set", id: "WORK", set: { duration: "2p" } };

test("Plan Review DAG authority does not supply independent goal authority", () => {
  const text = opened();
  const mutations = [
    { kind: "project.set", set: { goalDelegates: ["new_delegate"] } },
    durationChange,
  ];
  const result = resolve(text, mutations);
  denied(result, "PTGOV-101");
  denied(result, "PTREV-109");
  assert.deepEqual(result.composedMutation.governance.requiredOwnerConfirmations, ["boss"]);
  const approved = resolve(text, mutations, { acceptedOwners: ["boss"] });
  assert.equal(approved.ok, true, JSON.stringify(approved.diagnostics));
  assert.notEqual(approved.planBasis.beforeDigest, approved.planBasis.afterDigest);
});

test("Plan Review rejects an invalid composed duration without a resolution candidate", () => {
  const result = resolve(opened(), [
    { kind: "task.set", id: "WORK", set: { duration: "-1p" } },
  ]);
  denied(result, "PTDSL-007");
  denied(result, "PTREV-109");
});

test("Plan Review preserves assurance source guards against orphaned seals", () => {
  const sealed = api.planAssuranceMutation(source(8), {
    kind: "plan_assurance.seal", reason: "Accepted planning basis",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  const result = resolve(opened(sealed.updatedText.replace("  version 8", "  version 10")), [
    { kind: "task.remove", id: "WORK" },
    { kind: "task.add", id: "OTHER", from: "START", to: "MID",
      task: { title: "Replacement", duration: "2p" } },
  ]);
  denied(result, "PTASSURE-101");
  denied(result, "PTREV-109");
});

test("Plan Review retains assurance mismatch observations without treating warnings as denial", () => {
  const sealed = api.planAssuranceMutation(source(8), {
    kind: "plan_assurance.seal", reason: "Accepted planning basis",
  });
  assert.equal(sealed.ok, true, JSON.stringify(sealed.diagnostics));
  const result = resolve(opened(sealed.updatedText.replace("  version 8", "  version 10")),
    [durationChange]);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.diagnostics.some(({ code, severity }) =>
    code === "PTASSURE-202" && severity === "warning"), true);
  assert.deepEqual(result.composedMutation.assuranceImpact.after.directMismatchTaskIds, ["WORK"]);
  assert.match(result.updatedText, /outcome plan_changed/u);
});

test("Plan Review preserves milestone acceptance validity when a referenced milestone is removed", (t) => {
  const criteria = api.planCriterionSetReplacement(source(7), {
    setId: "MID_R1", milestoneId: "MID", revisionId: "R1",
    criteria: [{ criterionId: "CHECK", required: true,
      evidenceKind: "command", description: "Gate passes" }],
  });
  assert.equal(criteria.ok, true, JSON.stringify(criteria.diagnostics));
  const mutations = [
    { kind: "task.set", id: "WORK", to: "END" },
    { kind: "gate.remove", id: "JOIN" },
    { kind: "milestone.remove", id: "MID" },
  ];
  const text = opened(criteria.updatedText.replace("  version 7", "  version 10"));
  const result = resolve(text, mutations);
  denied(result, "PTMAC-105");
  denied(result, "PTREV-109");
  // Legacy callers retain the lower failure; the new adapter owns translation.
  assert.throws(() => api.planBatchMutation(criteria.updatedText, { kind: "batch", mutations },
    { governance: { intent: "persist", actor: "user" } }),
    /Contract 8 mutation lost milestone acceptance source validity/u);
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-plan-review-guard-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "plan.pert");
  const request = path.join(directory, "batch.json");
  const output = path.join(directory, "output.pert");
  writeFileSync(file, text); writeFileSync(request, JSON.stringify({ kind: "batch", mutations }));
  const child = spawnSync(process.execPath, [path.join(root, "dist/cli.js"), "plan", "review-resolve", file,
    "REVIEW_1", "--outcome", "plan_changed", "--request", request, "--resolved-at", "2026-09-30T11:00:00+09:00",
    "--actor", "user", "--resolution-reason", "Reviewed", "--output", output, "--format=json"], { encoding: "utf8" });
  assert.equal(child.status, 1, child.stderr + child.stdout);
  const wire = JSON.parse(child.stdout);
  assert.equal(wire.diagnostics.some(({ code }) => code === "PTMAC-105"), true);
  assert.equal(wire.diagnostics.some(({ code }) => code === "PTREV-109"), true);
  assert.equal(wire.candidate.text, null); assert.equal(wire.write.written, false);
  assert.equal(readFileSync(file, "utf8"), text);
  assert.deepEqual(readdirSync(directory).sort(), ["batch.json", "plan.pert"]);
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  for (const name of readdirSync(path.join(root, "schemas")).filter((name) => name.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(root, "schemas", name))));
  }
  const validate = ajv.getSchema("https://github.com/mako10k/perttool/schemas/Perttool.PlanReviewMutationResult.v1.schema.json");
  assert.equal(validate(wire), true, JSON.stringify(validate.errors));
});

test("lifecycle-only and governance-only candidates do not qualify as plan_changed", () => {
  for (const mutation of [
    { kind: "task.set", id: "WORK", set: { status: "done" } },
    { kind: "project.set", set: { dagDelegates: ["new_delegate"] } },
  ]) {
    const result = resolve(opened(), [mutation]);
    denied(result, "PTREV-107");
    assert.equal(result.composedMutation.ok, true);
  }
});

test("evidence-only and Plan-Review-only operations are outside the closed change batch", () => {
  for (const mutation of [
    { kind: "task_outcome.add", id: "OUT_WORK", taskId: "WORK",
      status: "conformant", reason: "Reviewed outcome" },
    { kind: "milestone_acceptance.receipt", receiptId: "RECEIPT_1" },
    { kind: "plan_review.create", requestId: "REVIEW_2", taskId: "WORK" },
  ]) {
    const result = resolve(opened(), [mutation]);
    denied(result, "PTREV-104");
    assert.equal(result.composedMutation, null);
  }
});

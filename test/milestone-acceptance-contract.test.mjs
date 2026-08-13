import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getJsonSchemaCatalog,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

async function fixture() {
  return JSON.parse(
    await repositoryText(
      "test/fixtures/milestone-acceptance-contract-v1.json",
    ),
  );
}

test("milestone acceptance contract fixes the separate state and version boundary", async () => {
  const [specification, requirements, design, backlog, plan] = await Promise.all([
    repositoryText("docs/specs/milestone-acceptance.md"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("plans/milestone-acceptance.pert"),
  ]);

  assert.match(specification, /- Status: Normative 1\.0/u);
  assert.match(specification, /Active source grammar: Grammar 7/u);
  assert.match(specification, /Active source CLI contract: Contract 8/u);
  assert.match(specification, /closure\s+unreached \| reached/u);
  assert.match(
    specification,
    /acceptance\s+not_declared \| pending \| accepted \| failed \| unavailable/u,
  );
  assert.match(specification, /A declared set is non-empty and contains at least one required/u);
  assert.match(
    specification,
    /No\s+criterion ID, receipt, waiver, or acceptance state continues implicitly/u,
  );
  assert.match(specification, /Git retains the exact prior snapshot/u);
  assert.match(specification, /Contract 8 has 53 commands and 23 root schemas/u);
  assert.match(specification, /`Perttool\.AdvanceResult\.v3`/u);
  assert.match(specification, /`Perttool\.MilestoneAcceptanceResult\.v1`/u);
  assert.match(requirements, /^### 2\.9 Separate graph closure from milestone outcome acceptance$/mu);
  assert.match(requirements, /^### 7\.11 Milestone outcome acceptance$/mu);
  assert.match(design, /^### Milestone outcome acceptance Contract 8 slice$/mu);
  assert.match(
    backlog,
    /Status: Contract, source\/migration, evaluator, governed mutation,\s+acceptance-aware advance, atomic Grammar 7 \/ Contract 8 public runtime, and\s+historical reconstruction accepted \(2026-08-12\); read-only LSP, VSIX, and MCP\s+adapter projection, final cross-surface gate, criteria, and receipts accepted,\s+and the plan canonically advanced locally \(2026-08-13\)/u,
  );
  assert.doesNotMatch(plan, /^task MILESTONE_ACCEPTANCE_CONTRACT /mu);
  assert.doesNotMatch(plan, /^task MILESTONE_ACCEPTANCE_ADAPTERS /mu);
  assert.doesNotMatch(plan, /^task MILESTONE_ACCEPTANCE_ACCEPTANCE /mu);
  assert.match(plan, /^milestone_acceptance_receipt MAC_FINAL_ACCEPTED:/mu);
});

test("criterion, receipt, governance, and assurance boundaries are closed", async () => {
  const [specification, cases] = await Promise.all([
    repositoryText("docs/specs/milestone-acceptance.md"),
    fixture(),
  ]);

  assert.deepEqual(cases.criterion_evidence_kinds, [
    "test",
    "command",
    "artifact",
    "observation",
    "owner",
  ]);
  assert.deepEqual(cases.receipt_actions, [
    "verify",
    "fail",
    "unavailable",
    "revoke",
    "waive",
  ]);
  assert.match(specification, /at most one unrevoked terminal receipt/u);
  assert.match(specification, /pre-change effective `dag_owner` and delegates/u);
  assert.match(specification, /`actor`, `verifier`, and `accepted_by_owner` are distinct/u);
  assert.match(specification, /None is authenticated/u);
  assert.match(specification, /Timestamp order has no authority|give a newer assertion precedence/u);
  assert.match(
    specification,
    /excluded from task-plan assurance hashes,\s+seals, and downstream start authority in model 1/u,
  );
});

test("migration and advance compose exact proof without partial authority", async () => {
  const specification = await repositoryText("docs/specs/milestone-acceptance.md");

  assert.match(specification, /current bytes equal to the target blob in `HEAD`/u);
  assert.match(specification, /stage-0 index equal to that `HEAD` blob/u);
  assert.match(specification, /repository, path, object format, `HEAD`, blob, raw source digest/u);
  assert.match(specification, /Only that closed set is grandfathered/u);
  assert.match(specification, /creates no criterion, evidence, waiver, or\s+accepted state/u);
  assert.match(specification, /pure provisional advance plan/u);
  assert.match(specification, /explanatory non-persistable output/u);
  assert.match(specification, /One blocked affected milestone blocks the entire advance/u);
  assert.match(specification, /Partial advance\s+does not exist/u);
  assert.match(specification, /History safety remains an orthogonal Git guard/u);
});

test("all twenty-five contract cases are dependency ordered", async () => {
  const cases = await fixture();
  assert.equal(
    cases.schema_version,
    "Perttool.MilestoneAcceptanceContractCases.v1",
  );
  assert.equal(cases.milestone_acceptance_model_version, 1);
  assert.equal(cases.target_grammar_version, 7);
  assert.equal(cases.target_cli_contract_version, 8);
  assert.equal(cases.target_command_count, 53);
  assert.equal(cases.target_root_schema_count, 23);
  assert.deepEqual(
    cases.cases.map(({ id }) => id),
    expectedIds("MAC", 25),
  );

  const accepted = new Set();
  for (const contractCase of cases.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      `${contractCase.id}: dependencies must precede the case`,
    );
    assert.equal(typeof contractCase.boundary, "string");
    accepted.add(contractCase.id);
  }
  assert.equal(cases.partial_advance, false);
  assert.equal(cases.general_acceptance_force, false);
  assert.equal(cases.verifier_trust, "caller_assertion");
  assert.equal(cases.runtime_status, "public_active");
});

test("active runtime and current plan expose Contract 8 while older inputs remain readable", async () => {
  const plan = await repositoryText("plans/milestone-acceptance.pert");
  const checked = checkDocument(plan);
  assert.equal(checked.ok, true);
  assert.equal(checked.grammarVersion, 7);
  assert.equal(COMMAND_REGISTRY.length, 53);
  assert.equal(getJsonSchemaCatalog().length, 23);
  assert.doesNotMatch(plan, /^task /mu);
  assert.match(plan, /^milestone_acceptance_receipt MAC_FINAL_ACCEPTED:/mu);

  const next = selectNextTasks(plan, {
    capacityOverrides: new Map([["DEVELOPERS", 1]]),
  });
  assert.equal(next.ok, true);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.deepEqual(next.groups.runnableNow, []);
  assert.deepEqual(next.groups.ready, []);
});

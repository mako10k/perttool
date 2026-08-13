import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getJsonSchemaCatalog,
} from "../dist/index.js";
import * as publicApi from "../dist/index.js";

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

test("plan assurance interface fixes one atomic Grammar 6 and Contract 7 target", async () => {
  const [requirements, semantics, contract, examples, design, acceptance] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/specs/plan-assurance.md"),
      repositoryText("docs/specs/plan-assurance-interface.md"),
      repositoryText("docs/examples/plan-assurance.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/process/plan-assurance-interface-acceptance.md"),
    ]);

  assert.match(semantics, /- Status: Normative 1\.0/);
  assert.match(contract, /- Source grammar target: Grammar 6/);
  assert.match(contract, /- Public CLI target: CLI Contract 7/);
  assert.match(contract, /44 registered paths/);
  assert.match(contract, /twenty root result identities/);
  assert.match(contract, /Perttool\.PlanAssuranceResult\.v1/);
  assert.match(contract, /Perttool\.GovernanceDecision\.v2/);
  assert.match(
    contract,
    /recommendation_v1_plus_release_gate_plus_plan_assurance_v1/,
  );
  for (const action of [
    "initial_seal",
    "replan_and_reseal",
    "restore_assurance_evidence",
  ]) {
    assert.equal(contract.includes(`\`${action}\``), true, action);
  }
  assert.match(contract, /affected scope\s+`plan_assurance`/);
  assert.match(contract, /PTASSURE-101/);
  assert.match(contract, /PTASSURE-306/);
  assert.match(contract, /No model-1 `disable` command exists/);
  assert.match(contract, /accepted_contract/);
  assert.match(contract, /accepted_inputs/);
  assert.match(contract, /one opaque basis hash cannot/);
  assert.match(contract, /--kind contract\|computed-basis\|exported/);
  assert.match(
    contract,
    /exactly one canonical lowercase\s+`sha256:<64 lowercase hexadecimal digits>` value/,
  );
  assert.match(contract, /PTASSURE-203/);
  assert.match(contract, /does not add, replace, or repair a\s+`plan_seal`/);
  assert.match(contract, /Lossless Mermaid support uses semantic profile 2/);
  assert.match(contract, /completed `ASSURE_PUBLIC_CONTRACT` cutover/);

  for (const sourceRecord of [
    "task_relation",
    "plan_seal",
    "task_outcome",
    "assurance_receipt",
  ]) {
    assert.equal(contract.includes(`\`${sourceRecord}\``), true, sourceRecord);
    assert.equal(examples.includes(sourceRecord), true, sourceRecord);
  }

  for (const command of [
    "plan-assurance show",
    "plan-assurance hash",
    "plan-assurance seal",
    "plan-assurance reseal",
    "plan-dependency add",
    "plan-dependency set",
    "plan-dependency remove",
    "task-outcome add",
    "task-outcome set",
    "task-outcome remove",
  ]) {
    assert.equal(contract.includes(command), true, command);
  }

  assert.match(requirements, /Plan Assurance Interface\s+Contract/);
  assert.match(design, /Plan Assurance Interface Contract/);
  assert.match(acceptance, /Status: Accepted target 1\.0/);
  assert.match(acceptance, /does not select a package or release version/);
});

test("plan assurance interface cases and SHA-256 vectors are fixed", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/plan-assurance-interface-v1.json"),
  );
  const ids = expectedIds("PAI", 12);

  assert.equal(
    fixture.schema_version,
    "Perttool.PlanAssuranceInterfaceCases.v1",
  );
  assert.equal(fixture.grammar_version, 6);
  assert.equal(fixture.cli_contract_version, 7);
  assert.equal(
    fixture.runtime_status,
    "active_grammar_6_cli_contract_7",
  );
  assert.equal(fixture.registered_command_count, 44);
  assert.equal(fixture.commands.includes("plan-assurance hash"), true);
  assert.equal(
    fixture.result_identities.plan_assurance_hash,
    "Perttool.PlanAssuranceResult.v1",
  );
  assert.deepEqual(fixture.inspection.hash_kinds, [
    "contract",
    "computed-basis",
    "exported",
  ]);
  assert.equal(fixture.inspection.failure_text_bytes, 0);
  assert.equal(fixture.inspection.inspection_mutates_source, false);
  assert.equal(fixture.root_schema_count, 20);
  assert.equal(
    fixture.authority_policy,
    "recommendation_v1_plus_release_gate_plus_plan_assurance_v1",
  );
  assert.deepEqual(fixture.required_action_kinds, [
    "initial_seal",
    "replan_and_reseal",
    "restore_assurance_evidence",
  ]);
  assert.equal(fixture.governance.interface_version, 2);
  assert.equal(fixture.governance.new_scope, "plan_assurance");
  assert.deepEqual(fixture.cases.map(({ id }) => id), ids);

  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      `${contractCase.id}: dependencies must precede the case`,
    );
    assert.equal(typeof contractCase.operation, "string");
    assert.equal(Object.keys(contractCase.expected).length > 0, true);
    accepted.add(contractCase.id);
  }

  for (const vector of fixture.hash_vectors) {
    const digest = createHash("sha256")
      .update(Buffer.from(vector.canonical_utf8, "utf8"))
      .digest("hex");
    assert.equal(`sha256:${digest}`, vector.sha256, vector.name);
  }
});

test("the active Contract 8 surface retains the selected assurance interface", () => {
  assert.equal("evaluatePlanAssurance" in publicApi, false);
  assert.equal("hashTaskPlanContract" in publicApi, false);
  const commandPaths = COMMAND_REGISTRY.map(({ path: commandPath }) =>
    commandPath.join(" "),
  );
  for (const prefix of ["plan-assurance", "plan-dependency", "task-outcome"]) {
    assert.equal(
      commandPaths.some((commandPath) => commandPath.startsWith(prefix)),
      true,
      prefix,
    );
  }

  const schemaIds = getJsonSchemaCatalog().map(({ schemaId }) => schemaId);
  assert.equal(schemaIds.some((id) => /PlanAssurance/.test(id)), true);

  const grammar6Target = `project ASSURED:
  version 6
  title "Future target"
  as_of 2026-08-03
  duration_unit day
  finish M1
  plan_assurance_model 1
  plan_assurance_hash_model 1

milestone M0:
  title "Start"
  state reached

milestone M1:
  title "Finish"

task A M0 -> M1:
  title "A"
  duration 1d
  status planned

plan_seal A:
  accepted_contract sha256:e35fe89aabf48b47a19c513e63a7782591e8bf098f79a6b3ad789f905ef3cf2d
  accepted_basis sha256:3923becd976daeca7047a65206633ed3b8210b426f1bf969107728f5261cd489
  reason "Future target"
`;
  assert.equal(checkDocument(grammar6Target).ok, true);
});

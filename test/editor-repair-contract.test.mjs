import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as packageRoot from "../dist/index.js";
import * as nodeFacade from "../dist/node/index.js";
import {
  EDITOR_MUTATION_PROTOCOL_MODEL_VERSION,
  EDITOR_PROTOCOL_MODEL_VERSION,
} from "../adapters/lsp/dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function fixture() {
  return JSON.parse(
    await repositoryText("test/fixtures/editor-repair-contract-v1.json"),
  );
}

test("E1 registry version 1 contains one bounded repair and no refactoring", async () => {
  const cases = await fixture();
  assert.equal(cases.schema_version, "Perttool.EditorRepairContractCases.v1");
  assert.equal(cases.parent_contract, "Perttool.EditorMutationContractCases.v1");
  assert.equal(cases.activation_state, "contract_only");
  assert.equal(cases.activation_gate, "EDITOR_REPAIR_ACCEPTED");
  assert.deepEqual(cases.registry.categories, ["repair", "refactoring"]);
  assert.equal(cases.registry.version, 1);
  assert.equal(cases.registry.entries.length, 1);
  assert.deepEqual(cases.registry.entries[0], {
    id: "duration_unit_to_point",
    category: "repair",
    source_diagnostic: "PTSEM-114",
    source_grammar_versions: [6, 7],
    source_units: ["day", "hour"],
    target_unit: "point",
    replacement_velocity: null,
    quickfix_title: "Migrate duration unit to point",
    explicit_kind: "quickfix",
    document_kind: "source.fixAll.perttool",
    automatic_eligible: true,
  });
  assert.equal(cases.registry.refactoring_entry_count, 0);
  assert.equal(cases.registry.unknown_entry, "unavailable_no_edit");
});

test("E1 requires exact unit migration and a complete unsealed whole-plan closure", async () => {
  const cases = await fixture();
  assert.equal(cases.source_requirements.declared_velocity_required, true);
  assert.equal(cases.source_requirements.replacement_velocity_allowed, false);
  assert.equal(cases.candidate_requirements.same_grammar, true);
  assert.equal(cases.candidate_requirements.retain_velocity_token, true);
  assert.deepEqual(cases.candidate_requirements.governance_scopes, []);
  assert.deepEqual(cases.candidate_requirements.destructive_record_ranges, []);
  assert.equal(cases.candidate_requirements.strict_class, "E1");
  assert.equal(cases.closure.registry_v1_scope, "all_plan_tasks");
  assert.equal(cases.closure.source_coverage, "unsealed");
  assert.equal(cases.closure.candidate_coverage, "unsealed");
  assert.equal(cases.closure.source_task_status, "unsealed");
  assert.equal(cases.closure.candidate_task_status, "unsealed");
  assert.equal(cases.closure.accepted_basis_allowed, false);
  assert.equal(cases.closure.protected_records_allowed, false);
  assert.ok(cases.conversion_inventory.forbidden_field_paths.includes(
    "work_event.*.planned_value",
  ));
});

test("Quick Fix, Fix All, and automatic repair remain versioned and atomic", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.binding_fields, [
    "documentUri",
    "documentGeneration",
    "documentVersion",
    "sourceDigest",
  ]);
  assert.equal(cases.interactions.quickfix.explicit_only, true);
  assert.equal(cases.interactions.quickfix.maximum_actions, 1);
  assert.equal(cases.interactions.quickfix.workspace_edit_form, "documentChanges");
  assert.equal(cases.interactions.quickfix.contains_command, false);
  assert.equal(cases.interactions.fix_all.kind, "source.fixAll.perttool");
  assert.equal(cases.interactions.fix_all.partial_application, false);
  assert.equal(cases.interactions.fix_all.second_candidate_validation, true);
  assert.equal(
    cases.interactions.automatic.client_kind_must_be_explicit,
    "source.fixAll.perttool",
  );
  assert.equal(
    cases.interactions.automatic.extension_changes_code_actions_on_save,
    false,
  );
  assert.equal(cases.interactions.automatic.second_binding_check, true);
});

test("E1 recovery and diagnostic ownership do not synthesize authority", async () => {
  const cases = await fixture();
  assert.equal(
    cases.recovery.forward_applied_to_source,
    "exact_candidate_bytes",
  );
  assert.equal(
    cases.recovery.inverse_applied_to_candidate,
    "exact_source_bytes",
  );
  assert.equal(cases.recovery.independent_retained_recovery, false);
  assert.deepEqual(cases.diagnostic_ownership, {
    "PTSEM-114": "semantic_validator",
    "PTMIG-401..409": "unit_migration",
    "PTEDM-102": "editor_classification_or_closure",
    "PTEDM-104": "editor_stale_binding",
    "PTEDM-105": "editor_recovery",
    "PTEDM-107": "editor_interaction",
    "PTEDM-108": "editor_limit",
    "PTEDM-110": "editor_candidate",
  });
});

test("all twenty-two E1 contract cases are complete and dependency ordered", async () => {
  const cases = await fixture();
  const accepted = new Set();
  for (const contractCase of cases.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      contractCase.id,
    );
    accepted.add(contractCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from(
      { length: 22 },
      (_, index) => `ERC-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("contract acceptance changes no current E0, package, or repair runtime", async () => {
  const [cases, packageJsonText, server, protocol, vscodeManifestText] =
    await Promise.all([
      fixture(),
      repositoryText("package.json"),
      repositoryText("adapters/lsp/src/server.ts"),
      repositoryText("adapters/lsp/src/protocol.ts"),
      repositoryText("adapters/vscode/package.json"),
    ]);
  const packageJson = JSON.parse(packageJsonText);
  const vscodeManifest = JSON.parse(vscodeManifestText);
  assert.equal(EDITOR_PROTOCOL_MODEL_VERSION, 1);
  assert.equal(EDITOR_MUTATION_PROTOCOL_MODEL_VERSION, 2);
  assert.equal(packageJson.version, cases.active_baseline.tool_version);
  assert.equal(Object.keys(packageRoot).length, cases.active_baseline.root_export_count);
  assert.equal(Object.keys(nodeFacade).length, cases.active_baseline.node_export_count);
  assert.equal(Object.keys(core).length, cases.active_baseline.core_export_count);
  assert.match(server, /documentFormattingProvider: true/u);
  assert.equal(/source\.fixAll\.perttool/u.test(server), false);
  assert.equal(/duration_unit_to_point/u.test(server), false);
  assert.equal(/EditorRepairCandidateV1/u.test(protocol), false);
  assert.equal(
    vscodeManifest.contributes.commands.some(({ command }) =>
      /repair|fixAll/iu.test(command),
    ),
    false,
  );
});

test("normative E1 contract and parent boundary are cross-linked", async () => {
  const [
    contract,
    parent,
    acceptance,
    requirements,
    basicDesign,
    backlog,
    aiDevelopment,
    selfUse,
    plansReadme,
    agents,
    copilot,
    selectedPlan,
  ] = await Promise.all([
    repositoryText("docs/specs/editor-repairs.md"),
    repositoryText("docs/specs/editor-mutations.md"),
    repositoryText("docs/process/editor-repair-contract-acceptance.md"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/process/ai-development.md"),
    repositoryText("docs/process/self-use.md"),
    repositoryText("plans/README.md"),
    repositoryText("AGENTS.md"),
    repositoryText(".github/copilot-instructions.md"),
    repositoryText("plans/editor-mutations.pert"),
  ]);
  assert.match(contract, /^# E1 Unsealed Editor Repair Contract$/mu);
  assert.match(contract, /Registry version 1 contains one `repair` and no `refactoring`/u);
  assert.match(contract, /EDITOR_REPAIR_ACCEPTANCE/u);
  assert.match(parent, /E1 Unsealed Editor Repair Contract/u);
  assert.match(parent, /contract-only/u);
  assert.match(acceptance, /ERC-001` through `ERC-022/u);
  assert.match(acceptance, /EDITOR_REPAIR_ACCEPTANCE/u);
  for (const text of [
    requirements,
    basicDesign,
    backlog,
    aiDevelopment,
    selfUse,
    plansReadme,
    agents,
    copilot,
  ]) {
    assert.match(text, /duration_unit_to_point/u);
    assert.match(text, /EDITOR_REPAIR_ACCEPTANCE/u);
  }
  for (const text of [
    acceptance,
    backlog,
    aiDevelopment,
    selfUse,
    plansReadme,
    agents,
    copilot,
  ]) {
    assert.match(text, /fac511d0/u);
  }
  assert.match(selectedPlan, /task EDITOR_REPAIR_CONTRACT[\s\S]*?status done/u);
  assert.match(selectedPlan, /milestone_criterion_set EDITOR_REPAIR_CONTRACT_ACCEPTED_R1/u);
  assert.match(selectedPlan, /milestone_acceptance_receipt EDITOR_REPAIR_CONTRACT_EVIDENCE/u);
  assert.match(selectedPlan, /evidence_revision e4681530dc2da2918b046f0a41ea94edfe94799e/u);
  assert.match(selectedPlan, /task_outcome OUTCOME_EDITOR_REPAIR_CONTRACT/u);
  assert.match(selectedPlan, /against_basis sha256:9f7292b4879cdb59d27daba0456112760319d05c77e8b352973a74a70f08f6a6/u);
});

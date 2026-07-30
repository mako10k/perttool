import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const baselinePath = path.join(
  testDirectory,
  "fixtures",
  "governance",
  "cases.json",
);

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function baseline() {
  return JSON.parse(await readFile(baselinePath, "utf8"));
}

function byId(document, caseId) {
  const result = document.cases.find(
    (candidate) => candidate.case_id === caseId,
  );
  assert.ok(result, caseId);
  return result;
}

test("governance examples publish one contiguous target-contract baseline", async () => {
  const [document, examples, requirements] = await Promise.all([
    baseline(),
    repositoryFile("docs/examples/governance.md"),
    repositoryFile("docs/requirements.md"),
  ]);

  assert.equal(
    document.schema_version,
    "Perttool.GovernanceExampleBaseline.v1",
  );
  assert.deepEqual(document.target_contract, {
    grammar_version: 4,
    cli_contract_version: 5,
    interface: {
      id: "perttool.governance-interface",
      version: 1,
    },
    source_contract_version: 1,
    semantics_version: 1,
    project_result: "Perttool.ProjectResult.v3",
    mutation_result: "Perttool.MutationResult.v2",
    decision: "Perttool.GovernanceDecision.v1",
    denial_diagnostic: "PTGOV-101",
    invalid_core_input_diagnostic: "PTGOV-102",
    unused_assertion_diagnostic: "PTGOV-103",
    stale_write_diagnostic: "PTIO-501",
  });

  const expectedIds = Array.from(
    { length: 16 },
    (_, index) => `GOV-${String(index + 1).padStart(3, "0")}`,
  );
  assert.deepEqual(
    document.cases.map((example) => example.case_id),
    expectedIds,
  );
  for (const caseId of expectedIds) {
    assert.equal(
      [...examples.matchAll(new RegExp(`^### ${caseId}\\b`, "gm"))].length,
      1,
      caseId,
    );
  }
  assert.match(
    requirements,
    /- \[x\] \[Normative authority and write-path examples\]\(examples\/governance\.md\)/,
  );
});

test("defaults and preview observations preserve omission and preview-first behavior", async () => {
  const document = await baseline();

  assert.deepEqual(document.snapshots.DEFAULT, {
    declared: {
      goal_owner: null,
      goal_delegates: null,
      dag_owner: null,
      dag_delegates: null,
    },
    effective: {
      goal_owner: "user",
      goal_delegates: [],
      dag_owner: "user",
      dag_delegates: [],
    },
  });

  const metadata = byId(document, "GOV-001").expected;
  assert.equal(metadata.schema_version, "Perttool.ProjectResult.v3");
  assert.equal(metadata.source_changed, false);
  assert.equal(metadata.grammar_upgraded, false);
  assert.equal(metadata.governance_decision, null);

  const preview = byId(document, "GOV-002");
  assert.deepEqual(preview.request, {
    intent: "preview",
    actor: null,
    accepted_by_owner: [],
  });
  assert.equal(preview.expected.ok, true);
  assert.deepEqual(preview.expected.diagnostic_codes, []);
  assert.deepEqual(preview.expected.governance.affected_scopes, ["goal"]);
  assert.deepEqual(
    preview.expected.governance.required_owner_confirmations,
    ["user"],
  );
  assert.equal(preview.expected.governance.write_authorized, false);
  assert.equal(
    preview.expected.governance.scopes[0].denial_cause,
    "actor_required",
  );
});

test("owner, delegate, and confirmation cases fix direct and denied authority", async () => {
  const document = await baseline();
  const direct = byId(document, "GOV-003").expected;

  assert.deepEqual(direct.authorized, [
    { scope: "goal", actor: "user", basis: "owner" },
    { scope: "goal", actor: "llm", basis: "delegate" },
    { scope: "dag", actor: "codex", basis: "delegate" },
  ]);
  assert.deepEqual(direct.not_directly_authorized, [
    { scope: "goal", actor: "codex", required_owner: "user" },
  ]);

  const missing = byId(document, "GOV-004");
  const matching = byId(document, "GOV-005");
  const wrong = byId(document, "GOV-006");
  const actorless = byId(document, "GOV-007");
  assert.equal(missing.candidate_identity, matching.candidate_identity);
  assert.equal(missing.expected.candidate_retained, true);
  assert.deepEqual(missing.expected.diagnostic_codes, ["PTGOV-101"]);
  assert.equal(missing.expected.scope.denial_cause, "owner_confirmation_required");
  assert.deepEqual(matching.request.accepted_by_owner, ["user"]);
  assert.equal(matching.expected.scope.scope_authorized, true);
  assert.equal(matching.expected.write.safe_write_entered, true);
  assert.equal(wrong.expected.scope.denial_cause, "owner_confirmation_mismatch");
  assert.equal(wrong.expected.invalid_input_diagnostic_emitted, false);
  assert.equal(actorless.expected.scope.owner_confirmation_present, true);
  assert.equal(actorless.expected.scope.denial_cause, "actor_required");
  assert.equal(actorless.expected.write.written, false);
});

test("batch, self-authorization, and stale cases remain atomic and digest-bound", async () => {
  const document = await baseline();

  const equalOwner = byId(document, "GOV-008").expected;
  assert.deepEqual(equalOwner.affected_scopes, ["goal", "dag"]);
  assert.deepEqual(equalOwner.required_owner_confirmations, ["user"]);
  assert.equal(equalOwner.write_authorized, true);
  assert.equal(equalOwner.assertion_level, "operation");

  const splitOwner = byId(document, "GOV-009").expected;
  assert.deepEqual(splitOwner.required_owner_confirmations, ["user", "llm"]);
  assert.deepEqual(splitOwner.partial_assertion.scope_authorized, {
    goal: true,
    dag: false,
  });
  assert.equal(splitOwner.partial_assertion.written, false);
  assert.deepEqual(splitOwner.complete_assertion.accepted_by_owner, [
    "llm",
    "user",
  ]);
  assert.equal(splitOwner.complete_assertion.write_authorized, true);

  const selfAuthorization = byId(document, "GOV-010").expected;
  assert.deepEqual(selfAuthorization.effective_delegates_used, []);
  assert.equal(
    selfAuthorization.candidate_delegates_used_for_authority,
    false,
  );
  assert.equal(selfAuthorization.actor_direct, false);
  assert.equal(selfAuthorization.write_authorized, false);
  assert.equal(selfAuthorization.later_decision_requires_new_digest, true);

  const stale = byId(document, "GOV-011").expected;
  assert.equal(stale.governance_write_authorized, true);
  assert.deepEqual(stale.diagnostic_codes, ["PTIO-501"]);
  assert.equal(stale.governance_denial_emitted, false);
  assert.equal(stale.exit_code, 5);
  assert.equal(stale.retry.prior_decision_reusable, false);
});

test("ordinary, cutover, and presentation cases retain explicit non-goals", async () => {
  const document = await baseline();

  const ordinary = byId(document, "GOV-012").expected;
  assert.deepEqual(ordinary, {
    applicable: false,
    affected_scopes: [],
    required_owner_confirmations: [],
    owner_confirmation_required: false,
    write_authorized: true,
    scopes: [],
    existing_safe_write_rules_retained: true,
  });

  const boundary = byId(document, "GOV-013").expected;
  assert.deepEqual(boundary.ordinary_transformations, [
    "document.format",
    "project.migrate-unit",
  ]);
  assert.deepEqual(boundary.new_document_operations, [
    "project.init",
    "dag.import",
  ]);
  assert.equal(boundary.pre_change_snapshot_invented, false);
  assert.equal(boundary.existing_document_replacement_exempt, false);

  const validation = byId(document, "GOV-014").expected;
  assert.equal(validation.cli_invalid.diagnostic_code, "PTCLI-001");
  assert.equal(validation.cli_invalid.exit_code, 2);
  assert.equal(validation.cli_invalid.document_io_reached, false);
  assert.equal(validation.core_invalid.diagnostic_code, "PTGOV-102");
  assert.equal(validation.core_invalid.governance_decision, null);
  assert.deepEqual(validation.contract_4, {
    grammar_4_accepted: false,
    governance_options_accepted: false,
    partial_public_surface: false,
  });
  assert.equal(validation.contract_5_activation, "atomic");

  const presentation = byId(document, "GOV-015").expected;
  assert.equal(
    document.generated_warning,
    "# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.",
  );
  assert.equal(presentation.generated_warning_exact, true);
  assert.equal(presentation.direct_edit_governance_decision, null);
  assert.equal(presentation.claims_authentication, false);
  assert.equal(presentation.claims_verified_consultation, false);
  assert.equal(presentation.claims_durable_audit, false);
  assert.equal(presentation.claims_direct_edit_prevention, false);

  const runtimeWarning = byId(document, "GOV-016").expected;
  assert.equal(runtimeWarning.applicable, false);
  assert.deepEqual(runtimeWarning.affected_scopes, []);
  assert.equal(runtimeWarning.write_authorized, true);
  assert.deepEqual(runtimeWarning.diagnostic_codes, ["PTGOV-103"]);
  assert.equal(runtimeWarning.severity, "warning");
  assert.equal(runtimeWarning.default_exit_code, 0);
  assert.equal(runtimeWarning.default_write_allowed, true);
  assert.equal(runtimeWarning.warnings_as_errors_exit_code, 1);
  assert.equal(runtimeWarning.warnings_as_errors_write_allowed, false);
  assert.equal(runtimeWarning.detects_governed_candidate_reuse, false);
});

test("requirements, specifications, design, and source cases link the same examples", async () => {
  const [requirements, design, authority, source, interfaceContract, sourceCases] =
    await Promise.all([
      repositoryFile("docs/requirements.md"),
      repositoryFile("docs/basic-design.md"),
      repositoryFile("docs/specs/governance-authority.md"),
      repositoryFile("docs/specs/governance-source.md"),
      repositoryFile("docs/specs/governance-interface.md"),
      repositoryFile("docs/examples/governance-source.md"),
    ]);

  assert.match(requirements, /\[Normative Owner-Aware Governance Examples\]\(examples\/governance\.md\)/);
  assert.match(design, /\[normative governance examples\]\(examples\/governance\.md\)/);
  const specificationLink =
    /Normative governance examples: \[\.\.\/examples\/governance\.md\]\(\.\.\/examples\/governance\.md\)/;
  assert.match(authority, specificationLink);
  assert.match(source, specificationLink);
  assert.match(interfaceContract, specificationLink);
  assert.match(sourceCases, /\[authority and write-path examples\]\(governance\.md\)/);
});

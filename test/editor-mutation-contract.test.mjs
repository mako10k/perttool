import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as packageRoot from "../dist/index.js";
import * as nodeFacade from "../dist/node/index.js";
import { checkDocument } from "../dist/index.js";
import {
  EDITOR_PROTOCOL_MODEL_VERSION,
} from "../adapters/lsp/dist/index.js";

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

function tableIds(document, prefix) {
  return [
    ...document.matchAll(new RegExp("^\\| `(" + prefix + "-\\d{3})` \\|", "gm")),
  ].map((match) => match[1]);
}

async function fixture() {
  return JSON.parse(
    await repositoryText("test/fixtures/editor-mutation-contract-v1.json"),
  );
}

test("editor mutation contract fixes four strict candidate classes", async () => {
  const cases = await fixture();
  assert.equal(cases.schema_version, "Perttool.EditorMutationContractCases.v1");
  assert.equal(cases.editor_protocol_model_version, 2);
  assert.deepEqual(cases.active_editor_protocol_model_versions, [1]);
  assert.equal(cases.activation_state, "contract_only");
  assert.deepEqual(cases.class_order, ["E0", "E1", "E2", "E3"]);
  assert.deepEqual(
    cases.classes.map(({ id, implicit_maximum }) => [id, implicit_maximum]),
    [
      ["E0", "user_enabled_format_on_save"],
      ["E1", "homogeneous_unsealed_closure_and_complete_validation"],
      ["E2", "never"],
      ["E3", "never"],
    ],
  );
  assert.equal(cases.classification.unit, "complete_final_candidate");
  assert.equal(cases.classification.precedence, "strictest_applicable_class");
  assert.equal(cases.classification.unknown, "unavailable_no_edit");
  assert.equal(cases.classification.assurance_hash_sufficient_for_e0, false);
  assert.deepEqual(cases.document_binding_fields, [
    "documentUri",
    "documentGeneration",
    "documentVersion",
    "sourceDigest",
  ]);
});

test("model 2 capability gates cannot activate a stricter class early", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.negotiation.model_2_offer, [2, 1]);
  assert.equal(cases.negotiation.selection, "highest_mutually_supported");
  assert.equal(cases.negotiation.authority_from_negotiation, false);
  assert.deepEqual(
    cases.capability_gates.map(({ gate, classes }) => [gate, classes]),
    [
      ["EDITOR_FORMAT_CORE_READY", ["E0"]],
      ["EDITOR_REPAIR_ACCEPTED", ["E1"]],
      ["EDITOR_RECOVERABLE_ACCEPTED", ["E2"]],
      ["EDITOR_AUTHORITY_UI_READY", ["E3"]],
    ],
  );
  assert.deepEqual(cases.forbidden_capabilities, [
    "textDocument/rangeFormatting",
    "textDocument/onTypeFormatting",
    "textDocument/rename",
    "workspace/executeCommand",
    "workspace/willCreateFiles",
    "workspace/willRenameFiles",
    "workspace/willDeleteFiles",
  ]);
});

test("E0 through E3 retain their semantic, recovery, and authority boundaries", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.e0, {
    semantic_equivalence: "complete_fingerprint_equality",
    format_options: "validate_required_shape_then_use_perttool_canonical_format",
    edits: "ordered_non_overlapping_smallest_core_ranges_utf16",
    unchanged: "empty_array",
    idempotent: true,
    extension_changes_format_on_save_setting: false,
  });
  assert.equal(cases.e1.required_before_and_after_state, "unsealed");
  assert.ok(cases.e1.forbidden_effects.includes("seal_or_reseal"));
  assert.ok(cases.e1.forbidden_effects.includes("governance_scope"));
  assert.equal(cases.e2.recovery_independent_of_undo, true);
  assert.equal(cases.e2.implicit, false);
  assert.ok(cases.e3_causes.includes("sealed_planning_basis_change"));
  assert.ok(cases.e3_causes.includes("dag_advance"));
  assert.ok(cases.e3_forbidden_surfaces.includes("format_on_save"));
});

test("custom preview, apply, diagnostics, and hard limits are closed", async () => {
  const cases = await fixture();
  assert.deepEqual(cases.custom_methods, {
    preview: "perttool/editorMutationPreview",
    apply: "perttool/editorMutationApply",
    preview_schema: "Perttool.EditorMutationPreviewResult.v1",
    apply_schema: "Perttool.EditorMutationApplyResult.v1",
    statuses: ["preview", "authorized", "denied", "invalid", "unavailable", "stale"],
    preview_grants_authority: false,
    server_applies_workspace_edit: false,
    editor_applies_workspace_edit: true,
  });
  assert.deepEqual(
    cases.diagnostic_codes,
    Array.from({ length: 10 }, (_, index) => `PTEDM-${101 + index}`),
  );
  assert.deepEqual(cases.hard_limits, {
    source_utf8_bytes: 8_388_608,
    candidate_utf8_bytes: 8_388_608,
    forward_edits: 10_000,
    inverse_edits: 10_000,
    replacement_utf8_bytes_each_direction: 8_388_608,
    affected_entity_field_identities: 20_000,
    diff_utf8_bytes: 1_048_576,
    retained_previews_per_connection: 8,
    retained_preview_recovery_utf8_bytes_per_connection: 33_554_432,
  });
});

test("contract fixture retains its exact pre-activation model-1 baseline", async () => {
  const cases = await fixture();
  const packageJson = JSON.parse(await repositoryText("package.json"));
  assert.equal(EDITOR_PROTOCOL_MODEL_VERSION, 1);
  assert.deepEqual(cases.active_editor_protocol_model_versions, [1]);
  assert.equal(cases.active_baseline.document_formatting_provider, false);
  assert.equal(packageJson.version, cases.active_baseline.tool_version);
  assert.equal(Object.keys(packageRoot).length, cases.active_baseline.root_export_count);
  assert.equal(Object.keys(nodeFacade).length, cases.active_baseline.node_export_count);
  assert.equal(Object.keys(core).length, cases.active_baseline.core_export_count);
});

test("all twenty-four mutation cases are complete and dependency ordered", async () => {
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
  assert.deepEqual([...accepted], expectedIds("EMC", 24));
});

test("editor mutation contract aligns specification, design, backlog, acceptance, and plan", async () => {
  const [specification, requirements, design, backlog, acceptance, model1, plan] =
    await Promise.all([
      repositoryText("docs/specs/editor-mutations.md"),
      repositoryText("docs/requirements.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/backlog.md"),
      repositoryText("docs/process/editor-mutation-contract-acceptance.md"),
      repositoryText("docs/specs/editor-protocol.md"),
      repositoryText("plans/editor-mutations.pert"),
    ]);
  assert.match(specification, /- Document status: Accepted 1\.0/);
  assert.match(specification, /Editor protocol model version: 2/);
  assert.deepEqual(tableIds(specification, "EMC"), expectedIds("EMC", 24));
  assert.match(requirements, /\[Tiered Editor Mutation Contract\]\(specs\/editor-mutations\.md\)/);
  assert.match(design, /`Perttool\.EditorSemanticFingerprint\.v1`/);
  assert.match(backlog, /EDITOR-MUTATION-001/);
  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(model1, /\[Tiered Editor Mutation Contract\]\(editor-mutations\.md\)/);

  const checked = checkDocument(plan);
  const task = checked.document.declarations.find(
    ({ kind, id }) => kind === "task" && id === "EDITOR_MUTATION_CONTRACT",
  );
  assert.equal(checked.ok, true);
  assert.equal(task?.fields.find(({ name }) => name === "status")?.value, "done");
});

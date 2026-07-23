import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const contractPath = path.join(
  testDirectory,
  "fixtures/agent-guidance/contract.v1.json",
);
const baselinePath = path.join(
  testDirectory,
  "fixtures/agent-guidance/provider-baseline.v1.json",
);
const specificationPath = path.join(root, "docs/specs/agent-guidance.md");
const examplesPath = path.join(root, "docs/examples/agent-guidance.md");

const providerOrder = [
  "codex",
  "github-copilot",
  "claude-code",
  "grok-build",
  "antigravity",
];

const surfaceOrder = [
  "instruction",
  "workflow",
  "delegated_agent",
  "enforcement",
  "prompt",
  "connector",
];

const supportStatusOrder = [
  "native",
  "compatible",
  "preview",
  "deprecated",
  "unsupported",
  "unknown",
];

async function readCanonicalJson(filePath) {
  const text = await readFile(filePath, "utf8");
  const value = JSON.parse(text);
  assert.equal(text, `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

test("agent guidance contract fixes independent public version identities", async () => {
  const contract = await readCanonicalJson(contractPath);

  assert.equal(contract.contract_id, "perttool.agent-guidance.contract");
  assert.equal(contract.contract_version, 1);
  assert.equal(
    contract.result_schema_version,
    "Perttool.AgentGuidanceResult.v1",
  );
  assert.equal(contract.guidance_interface_version, 1);
  assert.equal(
    contract.profile_schema_version,
    "Perttool.AgentGuidanceProfile.v1",
  );
  assert.equal(contract.profile_data_version, 1);
  assert.equal(contract.guidance_taxonomy_version, 1);
  assert.equal(contract.risk_taxonomy_version, 1);
  assert.equal(contract.description_registry_version, 1);
  assert.equal(contract.description_locale, "en");
  assert.equal(contract.staleness_policy_version, 1);
  assert.deepEqual(contract.result_root_field_order, [
    "schema_version",
    "guidance_interface_version",
    "profile_schema_version",
    "profile_data_version",
    "guidance_taxonomy_version",
    "risk_taxonomy_version",
    "description_registry_version",
    "description_locale",
    "staleness_policy_version",
    "tool_version",
    "operation",
    "ok",
    "profile_digest",
    "snapshot_as_of",
    "query",
    "providers",
    "guidance_records",
    "risk_records",
    "sources",
    "capabilities",
    "diagnostics",
  ]);
  for (const documentField of [
    "document_id",
    "source",
    "source_digest",
    "diagnostics_truncated",
  ]) {
    assert.equal(contract.result_root_field_order.includes(documentField), false);
  }
});

test("provider baseline and public taxonomy have the same complete axes", async () => {
  const [contract, baseline] = await Promise.all([
    readCanonicalJson(contractPath),
    readCanonicalJson(baselinePath),
  ]);

  assert.deepEqual(contract.provider_order, providerOrder);
  assert.deepEqual(contract.surface_order, surfaceOrder);
  assert.deepEqual(baseline.providers.map(({ provider_id }) => provider_id), providerOrder);
  assert.deepEqual(baseline.surface_order, surfaceOrder);
  assert.deepEqual(contract.aliases, [
    { alias: "grok", provider_id: "grok-build" },
  ]);

  for (const provider of baseline.providers) {
    assert.deepEqual(
      provider.surfaces.map(({ surface_id }) => surface_id),
      surfaceOrder,
      provider.provider_id,
    );
  }
});

test("support status has an explicit one-to-one evidence decision", async () => {
  const contract = await readCanonicalJson(contractPath);

  assert.deepEqual(contract.support_status_order, supportStatusOrder);
  assert.deepEqual(
    contract.support_status_evidence.map(({ support_status }) => support_status),
    supportStatusOrder,
  );
  assert.deepEqual(
    contract.support_status_evidence.map(({ evidence_kind }) => evidence_kind),
    [
      "official_native_documentation",
      "official_compatibility_documentation",
      "official_preview_notice",
      "official_deprecation_notice",
      "official_unsupported_notice",
      "insufficient_official_evidence",
    ],
  );
  assert.deepEqual(contract.artifact_resolution_order, [
    "known",
    "not_applicable",
    "unknown",
  ]);
});

test("guidance composition preserves project authority before provider detail", async () => {
  const contract = await readCanonicalJson(contractPath);
  const guidanceIds = contract.guidance.map(({ guidance_id }) => guidance_id);

  assert.deepEqual(contract.composition_order, [
    "project_control",
    "common_surface",
    "provider",
  ]);
  assert.deepEqual(guidanceIds.slice(0, 5), [
    "project_plan_is_authority",
    "consult_dag_next_before_start",
    "recompute_after_state_change",
    "require_explicit_human_override",
    "keep_provider_priority_identical",
  ]);
  assert.ok(
    contract.guidance
      .filter(({ origin }) => origin === "project_control")
      .every(({ directive }) => directive === "must"),
  );
});

test("every risk has a closed mitigation reference", async () => {
  const contract = await readCanonicalJson(contractPath);
  const guidanceIds = new Set(
    contract.guidance.map(({ guidance_id }) => guidance_id),
  );
  const riskIds = contract.risk.map(({ risk_id }) => risk_id);

  assert.equal(new Set(riskIds).size, riskIds.length);
  for (const risk of contract.risk) {
    assert.ok(risk.mitigation_guidance_ids.length > 0, risk.risk_id);
    for (const guidanceId of risk.mitigation_guidance_ids) {
      assert.ok(guidanceIds.has(guidanceId), `${risk.risk_id}:${guidanceId}`);
    }
  }
});

test("diagnostic meanings and read-only capability boundary are stable", async () => {
  const contract = await readCanonicalJson(contractPath);

  assert.deepEqual(
    contract.diagnostics.map(({ code, exit_code }) => [code, exit_code]),
    [
      ["PTAGT-101", 1],
      ["PTAGT-102", 1],
      ["PTAGT-201", 0],
      ["PTAGT-202", 0],
      ["PTAGT-203", 0],
      ["PTAGT-301", 1],
      ["PTAGT-302", 70],
      ["PTAGT-303", 70],
    ],
  );
  assert.ok(
    Object.values(contract.capabilities).every((value) => value === false),
  );
});

test("all normative case IDs are documented exactly once", async () => {
  const [contract, examples] = await Promise.all([
    readCanonicalJson(contractPath),
    readFile(examplesPath, "utf8"),
  ]);
  const caseIds = contract.normative_cases.map(({ case_id }) => case_id);

  assert.equal(new Set(caseIds).size, caseIds.length);
  assert.deepEqual(
    caseIds,
    Array.from({ length: 20 }, (_, index) =>
      `AGT-${String(index + 1).padStart(3, "0")}`),
  );
  for (const caseId of caseIds) {
    assert.equal(
      examples.match(new RegExp(`^### ${caseId} `, "gm"))?.length,
      1,
      caseId,
    );
  }
});

test("normative documents expose every stable guidance and risk ID", async () => {
  const [contract, specification] = await Promise.all([
    readCanonicalJson(contractPath),
    readFile(specificationPath, "utf8"),
  ]);

  for (const { guidance_id: guidanceId } of contract.guidance) {
    assert.ok(specification.includes(`\`${guidanceId}\``), guidanceId);
  }
  for (const { risk_id: riskId } of contract.risk) {
    assert.ok(specification.includes(`\`${riskId}\``), riskId);
  }
});

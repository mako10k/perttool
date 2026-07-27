import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function tableIds(document, prefix) {
  return [
    ...document.matchAll(
      new RegExp("^\\| `(" + prefix + "-\\d{3})` \\|", "gm"),
    ),
  ].map((match) => match[1]);
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("governance design acceptance closes every review finding and trace", async () => {
  const acceptance = await repositoryFile(
    "docs/process/governance-design-acceptance.md",
  );

  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(
    acceptance,
    /There are no open governance design review findings\./,
  );
  for (const findingId of ["GOV-R1", "GOV-R2", "GOV-R3", "GOV-R4"]) {
    assert.match(
      acceptance,
      new RegExp("\\| `" + findingId + "` \\|[^\\n]+\\| Resolved \\|"),
    );
  }
  assert.deepEqual(tableIds(acceptance, "GOV-AC"), expectedIds("GOV-AC", 10));
  assert.deepEqual(tableIds(acceptance, "GOV-IF"), expectedIds("GOV-IF", 15));
  assert.deepEqual(tableIds(acceptance, "GOV-NG"), expectedIds("GOV-NG", 9));
});

test("accepted governance identities remain aligned with normative contracts", async () => {
  const [acceptance, source, authority, interfaceContract] = await Promise.all([
    repositoryFile("docs/process/governance-design-acceptance.md"),
    repositoryFile("docs/specs/governance-source.md"),
    repositoryFile("docs/specs/governance-authority.md"),
    repositoryFile("docs/specs/governance-interface.md"),
  ]);
  const normativeContracts = [source, authority, interfaceContract].join("\n");

  for (const identity of [
    "perttool.governance-interface",
    "Perttool.ProjectResult.v3",
    "Perttool.MutationResult.v2",
    "Perttool.GovernanceDecision.v1",
    "PTGOV-101",
    "PTGOV-102",
    "PTIO-501",
  ]) {
    assert.ok(acceptance.includes(identity), identity);
    assert.ok(normativeContracts.includes(identity), identity);
  }
  for (const boundary of [
    "Grammar 1, 2, and 3",
    "Grammar 4",
    "CLI Contract 4",
    "CLI Contract 5",
  ]) {
    assert.ok(acceptance.includes(boundary), boundary);
  }
});

test("every accepted governance example is cited by the review", async () => {
  const [acceptance, sourceExamples, authorityExamples] = await Promise.all([
    repositoryFile("docs/process/governance-design-acceptance.md"),
    repositoryFile("docs/examples/governance-source.md"),
    repositoryFile("docs/examples/governance.md"),
  ]);

  for (const caseId of expectedIds("GOV-SRC", 6)) {
    assert.equal(
      [...sourceExamples.matchAll(new RegExp(`^### ${caseId}\\b`, "gm"))].length,
      1,
      caseId,
    );
    assert.ok(acceptance.includes(caseId), caseId);
  }
  for (const caseId of expectedIds("GOV", 15)) {
    assert.equal(
      [...authorityExamples.matchAll(new RegExp(`^### ${caseId}\\b`, "gm"))]
        .length,
      1,
      caseId,
    );
    assert.ok(acceptance.includes(caseId), caseId);
  }
});

test("requirements and design adopt the review without claiming runtime activation", async () => {
  const [acceptance, requirements, design] = await Promise.all([
    repositoryFile("docs/process/governance-design-acceptance.md"),
    repositoryFile("docs/requirements.md"),
    repositoryFile("docs/basic-design.md"),
  ]);

  assert.match(
    requirements,
    /- \[x\] \[Cross-cutting Issue #4 design acceptance\]\(process\/governance-design-acceptance\.md\)/,
  );
  assert.match(
    design,
    /\[cross-cutting governance design acceptance\s+review\]\(process\/governance-design-acceptance\.md\)/,
  );
  assert.match(
    acceptance,
    /This is design acceptance, not runtime activation\./,
  );
  assert.match(
    acceptance,
    /active `0\.3\.0` runtime[\s\S]*Grammar 1, 2, and 3[\s\S]*CLI Contract 4/,
  );
  assert.match(
    acceptance,
    /rejects explicit\s+Grammar 4 and governance options, and performs no owner-aware write\s+enforcement/,
  );
});

test("implementation trace and current plan frontier remain aligned", async () => {
  const [acceptance, plan] = await Promise.all([
    repositoryFile("docs/process/governance-design-acceptance.md"),
    repositoryFile("plans/governance.pert"),
  ]);

  for (const taskId of [
    "GOV_SOURCE_MODEL",
    "GOV_AUTHORITY_CORE",
    "GOV_CLI_PREVIEW",
    "GOV_WRITE_ENFORCEMENT",
    "GOV_GUIDANCE",
    "GOV_ACCEPTANCE",
  ]) {
    assert.ok(acceptance.includes(taskId), taskId);
  }
  for (const taskId of [
    "GOV_WRITE_ENFORCEMENT",
    "GOV_GUIDANCE",
    "GOV_ACCEPTANCE",
  ]) {
    assert.ok(plan.includes(`task ${taskId} `), taskId);
  }
  for (const completedTaskId of [
    "GOV_SOURCE_MODEL",
    "GOV_AUTHORITY_CORE",
    "GOV_CLI_PREVIEW",
  ]) {
    assert.ok(!plan.includes(`task ${completedTaskId} `), completedTaskId);
  }
  assert.match(
    plan,
    /milestone CLI_PREVIEW_READY:\n(?:  .+\n)*  state reached/,
  );
  for (const boundary of [
    "Authentication and identity verification",
    "Recommendation ranking and scheduling",
    "MIG-08 recommendation override apply and audit",
    "Git integration and history policy",
    "Release publication",
  ]) {
    assert.ok(acceptance.includes(boundary), boundary);
  }
  assert.match(
    acceptance,
    /does not pre-authorize a later resource combination/,
  );
});

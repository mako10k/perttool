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

test("governance interface selects the atomic Grammar 4 and Contract 5 identities", async () => {
  const [contract, requirements, design] = await Promise.all([
    repositoryFile("docs/specs/governance-interface.md"),
    repositoryFile("docs/requirements.md"),
    repositoryFile("docs/basic-design.md"),
  ]);

  assert.match(contract, /Document status: Normative 1\.0/);
  assert.match(contract, /Interface ID: `perttool\.governance-interface`/);
  assert.match(contract, /Interface version: `1`/);
  assert.match(contract, /Target grammar version: `4`/);
  assert.match(contract, /Target CLI contract version: `5`/);
  assert.match(
    contract,
    /\| Project result \| `Perttool\.ProjectResult\.v2` \| `Perttool\.ProjectResult\.v3` \|/,
  );
  assert.match(
    contract,
    /\| Mutation and advance result \| `Perttool\.MutationResult\.v1` \| `Perttool\.MutationResult\.v2` \|/,
  );
  assert.match(
    contract,
    /No earlier implementation slice may expose Grammar 4,[\s\S]*`cli_contract_version=5`/,
  );
  assert.match(
    requirements,
    /\[Core, CLI, help, JSON, and diagnostic interface contract\]\(specs\/governance-interface\.md\)/,
  );
  assert.match(
    design,
    /Governance interface version 1 selects one optional\s+actor, repeatable `--accepted-by-owner`/,
  );
});

test("caller assertions and distinct-owner batch confirmation have one shape", async () => {
  const contract = await repositoryFile("docs/specs/governance-interface.md");

  assert.match(contract, /interface GovernanceRequestInput/);
  assert.match(contract, /readonly intent\?: GovernancePersistenceIntent/);
  assert.match(contract, /readonly actor\?: PrincipalId \| null/);
  assert.match(contract, /readonly acceptedByOwner\?: readonly PrincipalId\[\]/);
  assert.match(
    contract,
    /\| `--accepted-by-owner` \| `principal-id` \| yes \| empty set \| `accepted_by_owner` \|/,
  );
  assert.match(
    contract,
    /Duplicate `--accepted-by-owner` values are a\s+usage error/,
  );
  assert.match(
    contract,
    /Assertions are\s+operation-level values\. They MUST NOT be embedded in one batch member/,
  );
  assert.match(
    contract,
    /If their\s+owners differ, both values occur/,
  );
  assert.match(
    contract,
    /An owner confirmation never substitutes for the required actor/,
  );
});

test("Core and CLI metadata requests preserve explicit empty lists and pre-change authority", async () => {
  const [contract, source, authority, mutation] = await Promise.all([
    repositoryFile("docs/specs/governance-interface.md"),
    repositoryFile("docs/specs/governance-source.md"),
    repositoryFile("docs/specs/governance-authority.md"),
    repositoryFile("docs/specs/mutation.md"),
  ]);

  for (const field of [
    "goalOwner",
    "goalDelegates",
    "dagOwner",
    "dagDelegates",
  ]) {
    assert.ok(contract.includes(field), field);
  }
  for (const option of [
    "--goal-owner",
    "--goal-delegates",
    "--dag-owner",
    "--dag-delegates",
  ]) {
    assert.ok(contract.includes(option), option);
  }
  assert.match(contract, /`<principal-list>` is the exact bracketed Grammar 4 list, including `\[\]`/);
  assert.match(
    contract,
    /project-set request that adds any governance field creates the Grammar 4\s+upgrade in the same final candidate/,
  );
  assert.match(
    contract,
    /Candidate\s+metadata never changes the pre-change decision/,
  );
  assert.match(source, /\[Governance Interface contract\]\(governance-interface\.md\)/);
  assert.match(authority, /\[interface contract\]\(governance-interface\.md\)/);
  assert.match(mutation, /selects MutationResult v2 at the later Contract 5 cutover/);
});

test("governance decision and result schemas expose complete preview and write facts", async () => {
  const contract = await repositoryFile("docs/specs/governance-interface.md");

  assert.match(contract, /interface GovernanceDecisionV1/);
  for (const field of [
    "sourceDigest",
    "intent",
    "applicable",
    "actor",
    "acceptedByOwner",
    "affectedScopes",
    "requiredOwnerConfirmations",
    "ownerConfirmationRequired",
    "writeAuthorized",
    "scopes",
  ]) {
    assert.ok(contract.includes(field), field);
  }
  for (const scopeField of [
    "requiredOwner",
    "effectiveDelegates",
    "actorDirect",
    "ownerConfirmationRequired",
    "ownerConfirmationPresent",
    "scopeAuthorized",
    "denialCause",
  ]) {
    assert.ok(contract.includes(scopeField), scopeField);
  }
  assert.match(contract, /### 6\.2 `Perttool\.ProjectResult\.v3`/);
  assert.match(contract, /### 6\.3 `Perttool\.MutationResult\.v2`/);
  assert.match(
    contract,
    /An unauthorized persistent result:[\s\S]*retains `changed`, `updated_digest`, `updated_text`, `diff`, and `edits`[\s\S]*`write\.written=false`/,
  );
  assert.match(
    contract,
    /With `intent="preview"`, an unauthorized decision does not make an otherwise\s+valid candidate fail/,
  );
  assert.match(
    contract,
    /Grammar 1, 2, and 3 return four declared nulls plus `user`\s+owners and empty effective delegate arrays/,
  );
});

test("governance diagnostics reuse domain exit 1 and retain write-conflict exit 5", async () => {
  const contract = await repositoryFile("docs/specs/governance-interface.md");

  assert.match(
    contract,
    /message    required owner-aware write authority was not established against the pre-change document/,
  );
  assert.match(
    contract,
    /An applicable persistent decision with `write_authorized=false` emits exactly\s+one diagnostic/,
  );
  assert.match(contract, /`PTGOV-101` is a domain error and exits `1`/);
  assert.match(contract, /Malformed `GovernanceRequestInput` is:[\s\S]*PTGOV-102/);
  assert.match(
    contract,
    /code       PTGOV-103[\s\S]*severity   warning[\s\S]*owner_confirmation_not_applicable/,
  );
  assert.match(
    contract,
    /With `--warnings-as-errors`, the existing warning policy returns exit\s+1 and prevents the write/,
  );
  assert.match(
    contract,
    /code       PTGOV-104[\s\S]*severity   warning[\s\S]*owner_confirmation_on_governed_preview/,
  );
  assert.match(
    contract,
    /With\s+`--warnings-as-errors`, the existing warning policy returns exit 1 while\s+retaining the candidate and decision/,
  );
  assert.match(contract, /Contract 5 adds no exit code/);
  assert.match(
    contract,
    /An authorized request that\s+then observes a stale digest retains `PTIO-501` and exit `5`/,
  );
  assert.match(
    contract,
    /`PTGOV-101` performs no expected-digest assertion, target creation, temporary\s+file creation, rename, or in-place replacement/,
  );
});

test("registry, help, and unchanged-operation boundaries are explicit", async () => {
  const contract = await repositoryFile("docs/specs/governance-interface.md");

  for (const command of [
    "project set",
    "dag advance",
    "task add",
    "task set",
    "task remove",
    "gate add",
    "gate set",
    "gate remove",
    "milestone add",
    "milestone remove",
    "batch apply",
  ]) {
    assert.ok(contract.includes(command), command);
  }
  assert.match(contract, /Every projected command descriptor has `contractVersion=5`/);
  assert.match(
    contract,
    /Text help and JSON help are projections of the same descriptor/,
  );
  assert.match(contract, /`guide editing` MUST explain/);
  assert.match(
    contract,
    /`document format` and exact unit migration remain ordinary transformations/,
  );
  assert.match(
    contract,
    /MCP, LSP, VSIX, authentication, signatures, RBAC, durable approval audit, Git\s+integration, recommendation override apply/,
  );
});

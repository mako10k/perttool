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

test("governance source fixes PrincipalId, PrincipalList, and Grammar 4", async () => {
  const [source, grammar] = await Promise.all([
    repositoryFile("docs/specs/governance-source.md"),
    repositoryFile("docs/specs/dsl-grammar.md"),
  ]);

  assert.match(source, /Document status: Normative 1\.0/);
  assert.match(source, /Governance source contract version: 1/);
  assert.match(source, /PrincipalId = Identifier/);
  assert.match(source, /comparison is exact and case-sensitive/);
  assert.match(source, /initial domain accepts at least `user`, `llm`, and `codex`/);
  for (const field of [
    "goal_owner",
    "goal_delegates",
    "dag_owner",
    "dag_delegates",
  ]) {
    assert.ok(source.includes(field), field);
    assert.ok(grammar.includes(field), field);
  }
  assert.match(
    grammar,
    /Grammar versions: 1, 2, 3, 4, 5, and 6 active/,
  );
  assert.match(
    grammar,
    /Grammar version 4 is selected only by an explicit `version 4`/,
  );
  assert.match(grammar, /Duplicate principal in one governance delegate list/);
});

test("declared and effective governance defaults remain source preserving", async () => {
  const [source, mutation, examples] = await Promise.all([
    repositoryFile("docs/specs/governance-source.md"),
    repositoryFile("docs/specs/mutation.md"),
    repositoryFile("docs/examples/governance-source.md"),
  ]);

  for (const defaultRule of [
    "effective.goalOwner     = declared.goalOwner     ?? user",
    "effective.goalDelegates = declared.goalDelegates ?? []",
    "effective.dagOwner      = declared.dagOwner      ?? user",
    "effective.dagDelegates  = declared.dagDelegates  ?? []",
  ]) {
    assert.ok(source.includes(defaultRule), defaultRule);
  }
  assert.match(
    source,
    /An explicit empty list is `\[\]`, not `null`/,
  );
  assert.match(
    source,
    /Formatting an existing document does not insert omitted governance defaults/,
  );
  assert.match(
    mutation,
    /mutation that adds any governance field to Grammar 1, 2, or 3 atomically\s+sets `project\.version=4`/,
  );
  assert.match(
    mutation,
    /Removing the\s+last governance field does not automatically downgrade Grammar 4/,
  );
  for (const caseId of [
    "GOV-SRC-001",
    "GOV-SRC-002",
    "GOV-SRC-003",
    "GOV-SRC-004",
    "GOV-SRC-005",
    "GOV-SRC-006",
  ]) {
    assert.equal(
      [...examples.matchAll(new RegExp(`^### ${caseId}\\b`, "gm"))].length,
      1,
      caseId,
    );
  }
});

test("project metadata, generated warnings, and pre-change snapshots have one contract", async () => {
  const [source, authority, interfaces, requirements] = await Promise.all([
    repositoryFile("docs/specs/governance-source.md"),
    repositoryFile("docs/specs/governance-authority.md"),
    repositoryFile("docs/specs/interfaces.md"),
    repositoryFile("docs/requirements.md"),
  ]);

  const warning =
    "# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.";
  assert.ok(source.includes(warning));
  assert.match(
    source,
    /`project show` exposes both declared and effective governance metadata/,
  );
  assert.match(source, /interface GovernanceSourceSnapshot/);
  assert.match(
    source,
    /The final\s+candidate is parsed separately and never replaces the pre-change authority\s+snapshot/,
  );
  assert.match(
    authority,
    /consumes that snapshot and\s+does not reinterpret source tokens/,
  );
  assert.match(
    interfaces,
    /expose both\s+declared and effective owner\/delegate metadata/,
  );
  assert.match(
    requirements,
    /\[Governance Source and Effective-Metadata\s+specification\]\(specs\/governance-source\.md\)/,
  );
});

test("unit migration, Mermaid, and recommendation boundaries fail closed", async () => {
  const [source, unitMigration, mermaid] = await Promise.all([
    repositoryFile("docs/specs/governance-source.md"),
    repositoryFile("docs/specs/unit-migration.md"),
    repositoryFile("docs/specs/mermaid-profile.md"),
  ]);

  assert.match(
    unitMigration,
    /Grammar 4 source is never changed to Grammar 3/,
  );
  assert.match(
    unitMigration,
    /preserve `goal_owner`, `goal_delegates`, `dag_owner`, and\s+`dag_delegates`/,
  );
  assert.match(
    mermaid,
    /MUST NOT claim a lossless Grammar 4 export or import/,
  );
  assert.match(
    source,
    /Declared or effective governance values are not recommendation candidate\s+facts/,
  );
  assert.match(
    source,
    /runtime continues to support Grammar 1, 2, and 3,\s+rejects explicit `version 4`/,
  );
});

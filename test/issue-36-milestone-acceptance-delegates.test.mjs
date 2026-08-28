import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { planMilestoneAcceptanceMigration } from
  "../dist/milestone-acceptance/migration.js";
import {
  planAcceptanceReceiptMutation,
  planCriterionSetReplacement,
} from "../dist/milestone-acceptance/mutation.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist/cli.js");
const replacement = Object.freeze({
  setId: "DONE_R1",
  milestoneId: "DONE",
  revisionId: "R1",
  criteria: Object.freeze([{
    criterionId: "BUILD",
    required: true,
    evidenceKind: "command",
    description: "Complete gate passes",
  }]),
});

function grammar6(governanceLines) {
  return `${[
    "project P:",
    "  version 6",
    '  title "P"',
    "  duration_unit point",
    "  finish DONE",
    ...governanceLines,
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "Done"',
    "",
    "task WORK START -> DONE:",
    '  title "Work"',
    "  duration 1p",
    "",
  ].join("\n")}`;
}

function migrate(governanceLines) {
  const source = grammar6(governanceLines);
  const result = planMilestoneAcceptanceMigration(source, {
    repositoryId: "issue-36",
    repositoryRelativePath: "plan.pert",
    objectFormat: "sha1",
    headCommit: "a".repeat(40),
    headBlob: "b".repeat(40),
    stage0Blob: "b".repeat(40),
    sourceDigest: sha256DigestUtf8(source),
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.candidateText;
}

function replace(text, governance) {
  return planCriterionSetReplacement(text, replacement, { governance });
}

function directDecision(result, expectedDelegates) {
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.governance.writeAuthorized, true);
  assert.equal(result.governance.scopes[0].actorDirect, true);
  assert.deepEqual(result.governance.scopes[0].effectiveDelegates,
    expectedDelegates);
}

function run(cwd, args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("canonical absent, empty, one, and multiple delegate values govern replacement", () => {
  const absent = migrate([]);
  const empty = migrate(["  dag_owner user", "  dag_delegates []"]);
  for (const text of [absent, empty]) {
    const owner = replace(text, { intent: "persist", actor: "user" });
    directDecision(owner, []);
    for (const governance of [
      { intent: "persist" },
      { intent: "persist", actor: "codex" },
      { intent: "persist", actor: "wrong" },
    ]) {
      const denied = replace(text, governance);
      assert.equal(denied.ok, false);
      assert.deepEqual(denied.diagnostics, ["PTGOV-101"]);
      assert.deepEqual(denied.governance.scopes[0].effectiveDelegates, []);
    }
  }

  const one = replace(
    migrate(["  dag_owner user", "  dag_delegates [codex]"]),
    { intent: "persist", actor: "codex" },
  );
  directDecision(one, ["codex"]);

  const multiple = replace(
    migrate(["  dag_owner user", "  dag_delegates [llm, codex]"]),
    { intent: "persist", actor: "llm" },
  );
  directDecision(multiple, ["codex", "llm"]);
});

test("every receipt action uses canonical pre-change effective delegates", () => {
  const source = migrate([
    "  dag_owner user",
    "  dag_delegates [codex, llm]",
  ]);
  const pending = replace(source, {
    intent: "persist",
    actor: "codex",
  });
  directDecision(pending, ["codex", "llm"]);

  const common = {
    setId: "DONE_R1",
    criterionId: "BUILD",
  };
  const actions = [
    {
      ...common,
      receiptId: "VERIFY",
      action: "verify",
      evidenceKind: "command",
      evidenceReference: "npm run check",
      evidenceRevision: "abc123",
      verifier: "codex",
      occurredAt: "2026-08-28T00:00:00Z",
    },
    { ...common, receiptId: "FAIL", action: "fail", reason: "Failed" },
    {
      ...common,
      receiptId: "UNAVAILABLE",
      action: "unavailable",
      reason: "Unavailable",
    },
    { ...common, receiptId: "WAIVE", action: "waive", reason: "Accepted" },
  ];
  for (const input of actions) {
    const result = planAcceptanceReceiptMutation(pending.updatedText, input, {
      governance: { intent: "persist", actor: "codex" },
    });
    directDecision(result, ["codex", "llm"]);
  }

  const terminal = planAcceptanceReceiptMutation(pending.updatedText, {
    ...common,
    receiptId: "VERIFY_FOR_REVOKE",
    action: "verify",
    evidenceKind: "command",
    evidenceReference: "npm run check",
    evidenceRevision: "abc123",
    verifier: "codex",
    occurredAt: "2026-08-28T00:00:00Z",
  }, { governance: { intent: "persist", actor: "codex" } });
  const revoked = planAcceptanceReceiptMutation(terminal.updatedText, {
    ...common,
    receiptId: "REVOKE",
    action: "revoke",
    revokes: "VERIFY_FOR_REVOKE",
  }, { governance: { intent: "persist", actor: "codex" } });
  directDecision(revoked, ["codex", "llm"]);
});

test("project show, preview, expected digest, and in-place write agree", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-issue-36-"));
  try {
    const plan = path.join(directory, "plan.pert");
    writeFileSync(plan, migrate([
      "  dag_owner user",
      "  dag_delegates [codex]",
    ]));

    const shown = run(directory, [
      "project", "show", "plan.pert", "--format=json",
    ]);
    assert.equal(shown.status, 0, shown.stderr);
    assert.deepEqual(JSON.parse(shown.stdout).project.governance.effective
      .dag_delegates, ["codex"]);

    const preview = run(directory, [
      "milestone", "acceptance", "replace", "plan.pert", "DONE", "DONE_R1",
      "R1", "--criterion", "BUILD:required:command:Complete gate passes",
      "--actor", "codex", "--format=json",
    ]);
    assert.equal(preview.status, 0, preview.stderr || preview.stdout);
    const projected = JSON.parse(preview.stdout);
    assert.equal(projected.write.written, false);
    assert.equal(projected.governance.write_authorized, true);
    assert.equal(projected.governance.scopes[0].actor_direct, true);
    assert.deepEqual(projected.governance.scopes[0].effective_delegates,
      ["codex"]);

    const stale = run(directory, [
      "milestone", "acceptance", "replace", "plan.pert", "DONE", "DONE_R1",
      "R1", "--criterion", "BUILD:required:command:Complete gate passes",
      "--actor", "codex", "--expect-digest", `sha256:${"0".repeat(64)}`,
      "--write", "--format=json",
    ]);
    assert.notEqual(stale.status, 0);
    assert.doesNotMatch(readFileSync(plan, "utf8"),
      /milestone_criterion_set/u);

    const written = run(directory, [
      "milestone", "acceptance", "replace", "plan.pert", "DONE", "DONE_R1",
      "R1", "--criterion", "BUILD:required:command:Complete gate passes",
      "--actor", "codex", "--expect-digest", projected.source_digest,
      "--write", "--format=json",
    ]);
    assert.equal(written.status, 0, written.stderr || written.stdout);
    const persisted = JSON.parse(written.stdout);
    assert.equal(persisted.write.written, true);
    assert.equal(persisted.updated_digest, projected.updated_digest);
    assert.equal(readFileSync(plan, "utf8"), projected.updated_text);

    const after = run(directory, [
      "project", "show", "plan.pert", "--format=json",
    ]);
    assert.equal(after.status, 0, after.stderr);
    assert.deepEqual(JSON.parse(after.stdout).project.governance.effective
      .dag_delegates, ["codex"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("all eighteen Issue 36 cases are dependency ordered", async () => {
  const fixture = JSON.parse(await readFile(new URL(
    "fixtures/issue-36-milestone-acceptance-delegates-v1.json",
    import.meta.url,
  ), "utf8"));
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true,
      item.id);
    accepted.add(item.id);
  }
  assert.deepEqual([...accepted], Array.from({ length: 18 }, (_, index) =>
    `I36-${String(index + 1).padStart(3, "0")}`));
});

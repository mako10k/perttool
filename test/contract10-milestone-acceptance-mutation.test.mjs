import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist/cli.js");
const fixture = path.join(root, "test/fixtures/issue-29-planning-human.pert");

function run(cwd, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, expectedStatus, [
    `unexpected exit for ${args.join(" ")}`,
    result.stdout,
    result.stderr,
  ].join("\n"));
  return result;
}

function json(cwd, args, expectedStatus = 0) {
  return JSON.parse(run(cwd, [...args, "--format=json"], expectedStatus).stdout);
}

function applyJsonEdits(text, edits) {
  let candidate = text;
  for (const edit of [...edits].reverse()) {
    candidate = candidate.slice(0, edit.start_offset) + edit.replacement +
      candidate.slice(edit.end_offset);
  }
  return candidate;
}

function governedGrammar9() {
  return readFileSync(fixture, "utf8").replace(
    "  duration_unit point\n",
    "  duration_unit point\n  dag_owner user\n  dag_delegates [codex]\n",
  );
}

function planningDeclarations(text) {
  return /^work W1:[\s\S]*?(?=^milestone START:)/mu.exec(text)?.[0] ?? "";
}

function replaceArgs(actor) {
  return [
    "milestone", "acceptance", "replace", "plan.pert", "REVIEWED",
    "REVIEWED_R1", "R1", "--criterion", "TEST:required:test:Review",
    "--actor", actor,
  ];
}

function declarationBlock(text, header) {
  const start = text.indexOf(`${header}\n`);
  assert.notEqual(start, -1, `missing declaration ${header}`);
  let end = text.indexOf("\n", start) + 1;
  while (end < text.length) {
    const next = text.indexOf("\n", end);
    const lineEnd = next < 0 ? text.length : next + 1;
    const line = text.slice(end, lineEnd);
    if (!/^[ \t]/u.test(line)) break;
    end = lineEnd;
  }
  return text.slice(start, end);
}

function planningBlocks(text) {
  return [...text.matchAll(
    /^(?:work [A-Za-z][A-Za-z0-9_-]*:|event [A-Za-z][A-Za-z0-9_-]*:|activity [A-Za-z][A-Za-z0-9_-]* [A-Za-z][A-Za-z0-9_-]* -> [A-Za-z][A-Za-z0-9_-]*:|window [A-Za-z][A-Za-z0-9_-]*:|work_order:)\r?\n(?:^[ \t].*(?:\r?\n|$))*/gmu,
  )].map(([block]) => block);
}

function moveAcceptanceRecords(text, placement) {
  const set = declarationBlock(text, "milestone_criterion_set REVIEWED_R1:");
  const receipt = declarationBlock(text,
    "milestone_acceptance_receipt REVIEWED_ACCEPTED:");
  const records = `${set}\n${receipt}\n`;
  const without = text
    .replace(set, "")
    .replace(receipt, "");
  if (placement === "after") return `${without}\n\n${records}`;
  const anchor = placement === "before"
    ? "work W1:"
    : "event DRAFT_START:";
  return without.replace(anchor, `${records}${anchor}`);
}

test("Contract 10 criterion replacement preserves Planning Pool and governance binding", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-contract10-acceptance-"));
  try {
    const plan = path.join(directory, "plan.pert");
    const source = governedGrammar9();
    const planning = planningDeclarations(source);
    assert.notEqual(planning, "");
    writeFileSync(plan, source, "utf8");

    const preview = json(directory, replaceArgs("codex"));
    assert.equal(preview.ok, true);
    assert.equal(preview.cli_contract_version, 10);
    assert.equal(preview.changed, true);
    assert.equal(preview.write.written, false);
    assert.equal(preview.governance.write_authorized, true);
    assert.equal(preview.governance.source_digest, preview.source_digest);
    assert.equal(planningDeclarations(preview.updated_text), planning);
    assert.match(preview.updated_text, /^  version 9$/mu);
    assert.match(preview.updated_text, /^milestone_criterion_set REVIEWED_R1:$/mu);

    const denied = json(directory, replaceArgs("wrong"));
    assert.equal(denied.ok, true);
    assert.equal(denied.governance.write_authorized, false);
    assert.equal(denied.governance.scopes[0].denial_cause,
      "owner_confirmation_required");
    assert.equal(readFileSync(plan, "utf8"), source);

    const deniedPersist = json(directory, [
      ...replaceArgs("wrong"), "--write", "--expect-digest",
      preview.source_digest,
    ], 1);
    assert.equal(deniedPersist.schema_version,
      "Perttool.MutationResult.v6");
    assert.equal(deniedPersist.cli_contract_version, 10);
    assert.equal(deniedPersist.operation, "milestone-acceptance.replace");
    assert.equal(deniedPersist.ok, false);
    assert.equal(deniedPersist.changed, true);
    assert.equal(deniedPersist.write.written, false);
    assert.equal(deniedPersist.diagnostics[0].code, "PTGOV-101");
    assert.match(deniedPersist.updated_text, /^  version 9$/mu);
    assert.match(deniedPersist.updated_text,
      /^milestone_criterion_set REVIEWED_R1:$/mu);
    assert.match(deniedPersist.updated_text,
      /^  criterion TEST required test "Review"$/mu);
    assert.equal(planningDeclarations(deniedPersist.updated_text), planning);
    assert.equal(applyJsonEdits(source, deniedPersist.edits),
      deniedPersist.updated_text);
    assert.equal(deniedPersist.governance.source_digest,
      deniedPersist.source_digest);
    assert.equal(readFileSync(plan, "utf8"), source);

    const stale = json(directory, [
      ...replaceArgs("codex"), "--write", "--expect-digest",
      `sha256:${"0".repeat(64)}`,
    ], 5);
    assert.equal(stale.ok, false);
    assert.equal(stale.schema_version, "Perttool.CliError.v1");
    assert.equal(stale.cli_contract_version, 10);
    assert.equal(stale.diagnostics[0].code, "PTIO-501");
    assert.equal(stale.diagnostics[0].data.reason,
      "expected_digest_mismatch");
    assert.equal(readFileSync(plan, "utf8"), source);

    const written = json(directory, [
      ...replaceArgs("codex"), "--write", "--expect-digest",
      preview.source_digest,
    ]);
    assert.equal(written.ok, true);
    assert.equal(written.write.written, true);
    assert.equal(written.updated_digest, preview.updated_digest);
    assert.equal(readFileSync(plan, "utf8"), preview.updated_text);
    assert.equal(planningDeclarations(readFileSync(plan, "utf8")), planning);

    const repeated = json(directory, replaceArgs("codex"));
    assert.equal(repeated.ok, true);
    assert.equal(repeated.changed, false);
    assert.deepEqual(repeated.edits, []);
    assert.equal(repeated.updated_text, preview.updated_text);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Contract 10 exposes every receipt action without losing Planning Pool declarations", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-contract10-receipt-"));
  try {
    const plan = path.join(directory, "plan.pert");
    const source = governedGrammar9();
    const planning = planningDeclarations(source);
    writeFileSync(plan, source, "utf8");
    const replaced = json(directory, replaceArgs("codex"));
    writeFileSync(plan, replaced.updated_text, "utf8");

    const cases = [
      [
        "verify", "VERIFY", "--evidence-kind", "test",
        "--evidence-reference", "npm run check", "--evidence-revision",
        "abc123", "--verifier", "codex", "--occurred-at",
        "2026-08-28T00:00:00Z",
      ],
      ["fail", "FAIL", "--reason", "Failed"],
      ["unavailable", "UNAVAILABLE", "--reason", "Unavailable"],
      ["waive", "WAIVE", "--reason", "Accepted"],
    ];
    for (const [action, receiptId, ...options] of cases) {
      const result = json(directory, [
        "milestone", "acceptance", action, "plan.pert", "REVIEWED_R1",
        "TEST", receiptId, ...options, "--actor", "codex",
      ]);
      assert.equal(result.ok, true, `${action} failed`);
      assert.equal(result.governance.write_authorized, true);
      assert.equal(result.governance.source_digest, result.source_digest);
      assert.equal(planningDeclarations(result.updated_text), planning);
      assert.match(result.updated_text,
        new RegExp(`^milestone_acceptance_receipt ${receiptId}:$`, "mu"));
    }

    const verified = json(directory, [
      "milestone", "acceptance", "verify", "plan.pert", "REVIEWED_R1",
      "TEST", "VERIFY_FOR_REVOKE", "--evidence-kind", "test",
      "--evidence-reference", "npm run check", "--evidence-revision",
      "abc123", "--verifier", "codex", "--occurred-at",
      "2026-08-28T00:00:00Z", "--actor", "codex",
    ]);
    writeFileSync(plan, verified.updated_text, "utf8");
    const revoked = json(directory, [
      "milestone", "acceptance", "revoke", "plan.pert", "REVIEWED_R1",
      "TEST", "REVOKE", "--revokes", "VERIFY_FOR_REVOKE", "--actor",
      "codex",
    ]);
    assert.equal(revoked.ok, true);
    assert.equal(revoked.governance.source_digest, revoked.source_digest);
    assert.equal(planningDeclarations(revoked.updated_text), planning);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Contract 10 also lifts Grammar 9 documents with no Planning Pool declarations", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-contract10-empty-pool-"));
  try {
    const plan = path.join(directory, "plan.pert");
    const source = governedGrammar9().replace(
      /^work W1:[\s\S]*?(?=^milestone START:)/mu,
      "",
    );
    writeFileSync(plan, source, "utf8");
    const preview = json(directory, replaceArgs("codex"));
    assert.equal(preview.ok, true);
    assert.match(preview.updated_text, /^  version 9$/mu);
    assert.doesNotMatch(preview.updated_text, /^work /mu);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Contract 10 replacement preserves Pool declarations with acceptance records before, between, or after them", () => {
  const directory = mkdtempSync(path.join(tmpdir(),
    "perttool-contract10-acceptance-order-"));
  try {
    const plan = path.join(directory, "plan.pert");
    writeFileSync(plan, governedGrammar9(), "utf8");
    const replaced = json(directory, replaceArgs("codex"));
    writeFileSync(plan, replaced.updated_text, "utf8");
    const accepted = json(directory, [
      "milestone", "acceptance", "verify", "plan.pert", "REVIEWED_R1",
      "TEST", "REVIEWED_ACCEPTED", "--evidence-kind", "test",
      "--evidence-reference", "npm run check", "--evidence-revision",
      "abc123", "--verifier", "codex", "--occurred-at",
      "2026-08-28T00:00:00Z", "--actor", "codex",
    ]);
    const expectedPlanning = planningBlocks(accepted.updated_text);
    assert.equal(expectedPlanning.length, 7);

    for (const placement of ["before", "between", "after"]) {
      const source = moveAcceptanceRecords(accepted.updated_text, placement);
      writeFileSync(plan, source, "utf8");
      assert.equal(json(directory, ["document", "check", "plan.pert"]).ok,
        true, `${placement} source is invalid`);
      const preview = json(directory, [
        "milestone", "acceptance", "replace", "plan.pert", "REVIEWED",
        "REVIEWED_R2", "R2", "--criterion",
        "TEST2:required:test:Second review", "--actor", "codex",
      ]);
      assert.equal(preview.ok, true, `${placement} preview failed`);
      assert.deepEqual(planningBlocks(preview.updated_text), expectedPlanning,
        `${placement} changed Planning Pool declarations`);
      assert.doesNotMatch(preview.updated_text,
        /^milestone_acceptance_receipt REVIEWED_ACCEPTED:$/mu);
      assert.match(preview.updated_text,
        /^milestone_criterion_set REVIEWED_R2:$/mu);

      if (placement === "before") {
        const written = json(directory, [
          "milestone", "acceptance", "replace", "plan.pert", "REVIEWED",
          "REVIEWED_R2", "R2", "--criterion",
          "TEST2:required:test:Second review", "--actor", "codex", "--write",
          "--expect-digest", preview.source_digest,
        ]);
        assert.equal(written.write.written, true);
        assert.equal(readFileSync(plan, "utf8"), preview.updated_text);
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

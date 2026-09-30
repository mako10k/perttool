import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
const packageRoot = process.env.PERTTOOL_PLAN_REVIEW_PACKAGE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { planAcceptanceReceiptMutation, planCriterionSetReplacement, planMilestoneAcceptanceMigration } =
  await import(pathToFileURL(path.join(packageRoot, "dist/index.js")));
import { sha256DigestUtf8 } from "../dist/model/sha256.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(packageRoot, "dist", "cli.js");

function run(args, expectedStatus = 0, cwd = root) {
  const child = spawnSync(process.execPath, [cli, ...args, "--format=json"], {
    cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(child.status, expectedStatus, `${args.join(" ")}\n${child.stderr}\n${child.stdout}`);
  assert.equal(child.stderr, "");
  return JSON.parse(child.stdout);
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${args.join(" ")}\n${result.stderr}`);
}

function acceptedSource() {
  const base = `project REVIEW_ADVANCE:\n  version 6\n  title "Review advance"\n  duration_unit point\n  finish END\n  dag_owner user\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone MID:\n  title "Accepted milestone"\n\nmilestone END:\n  title "End"\n\ntask DONE START -> MID:\n  title "Completed task"\n  duration 1p\n  status done\n\ntask NEXT MID -> END:\n  title "Next task"\n  duration 1p\n`;
  const proof = {
    repositoryId: "repo", repositoryRelativePath: "plan.pert", objectFormat: "sha1",
    headCommit: "a".repeat(40), headBlob: "b".repeat(40), stage0Blob: "b".repeat(40),
    sourceDigest: sha256DigestUtf8(base),
  };
  const migrated = planMilestoneAcceptanceMigration(base, proof);
  assert.equal(typeof migrated.candidateText, "string");
  const set = planCriterionSetReplacement(migrated.candidateText, {
    setId: "MID_R1", milestoneId: "MID", revisionId: "R1",
    criteria: [{ criterionId: "DONE_OK", required: true, evidenceKind: "owner", description: "Done task accepted" }],
  });
  assert.equal(set.ok, true, JSON.stringify(set.diagnostics));
  const receipt = planAcceptanceReceiptMutation(set.updatedText, {
    receiptId: "MID_OK", setId: "MID_R1", criterionId: "DONE_OK",
    action: "waive", reason: "Accepted canonical advance regression",
  });
  assert.equal(receipt.ok, true, JSON.stringify(receipt.diagnostics));
  return receipt.updatedText;
}

test("public Grammar 10 advance removes a pre-resolved request and blocks an open request", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-plan-review-advance-"));
  try {
    const pathname = path.join(directory, "plan.pert");
    writeFileSync(pathname, acceptedSource());
    for (const target of ["8", "9", "10"]) {
      const migration = run(["document", "migrate", pathname, "--target-grammar", target, "--write"]);
      assert.equal(migration.ok, true);
    }
    const opened = run(["plan", "review-request", pathname, "REVIEW_DONE", "DONE",
      "--reason", "Review the completed task", "--created-at", "2026-09-29T21:00:00+09:00",
      "--actor", "user", "--in-place"]);
    assert.equal(opened.ok, true);
    const blocked = run(["dag", "advance", pathname], 1);
    assert.equal(blocked.diagnostics.some(({ code }) => code === "PTREV-108"), true);
    assert.equal(readFileSync(pathname, "utf8").includes("plan_review_request REVIEW_DONE"), true);

    const resolved = run(["plan", "review-resolve", pathname, "REVIEW_DONE",
      "--outcome", "plan_retained", "--resolved-at", "2026-09-29T21:10:00+09:00",
      "--actor", "user", "--resolution-reason", "Reviewed the completed task", "--in-place"]);
    assert.equal(resolved.ok, true);
    const preview = run(["dag", "advance", pathname]);
    assert.equal(preview.ok, true);
    assert.deepEqual(preview.advance.removed_task_ids, ["DONE"]);
    assert.deepEqual(preview.advance.removed_plan_review_request_ids, ["REVIEW_DONE"]);
    assert.equal(preview.updated_text.includes("plan_review_request REVIEW_DONE"), false);
    assert.equal(preview.updated_text.includes("task DONE START -> MID"), false);
    assert.match(preview.updated_text, /milestone MID:/u);
    assert.match(preview.updated_text, /MID_R1|MID_OK/u);

    git(directory, ["init", "--quiet"]);
    git(directory, ["config", "user.name", "Perttool Test"]);
    git(directory, ["config", "user.email", "perttool@example.invalid"]);
    git(directory, ["add", "plan.pert"]);
    git(directory, ["commit", "--quiet", "-m", "accepted pre-advance source"]);
    const written = run(["dag", "advance", pathname, "--write", "--actor", "user"]);
    assert.equal(written.ok, true);
    assert.equal(written.write.written, true);
    assert.equal(written.history_guard.status, "passed");
    assert.equal(readFileSync(pathname, "utf8"), preview.updated_text);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

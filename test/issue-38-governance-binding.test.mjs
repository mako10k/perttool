import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { planAssuranceMutation } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");

function digest(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function source(grammarVersion) {
  const temporal = grammarVersion >= 8;
  return `${[
    "project ISSUE38:",
    `  version ${grammarVersion}`,
    '  title "Governance binding"',
    temporal
      ? "  as_of 2026-09-07T09:00:00+09:00"
      : "  as_of 2026-09-07",
    temporal ? "  duration_unit hour" : "  duration_unit point",
    ...(temporal ? [] : ["  velocity 1p/1d"]),
    "  finish END",
    "  dag_owner user",
    "  dag_delegates [codex]",
    ...(temporal
      ? [
          '  time_zone "Asia/Tokyo"',
          '  tzdb "2026c"',
          "  calendar STANDARD",
          "",
          "calendar STANDARD:",
          "  mon 09:00..17:00",
        ]
      : []),
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task WORK START -> END:",
    '  title "Work"',
    temporal ? "  duration 1h" : "  duration 1p",
    "  status done",
  ].join("\n")}\n`;
}

function assertBinding(result, text) {
  assert.ok(result.governance, "expected a governance decision");
  assert.equal(result.originalDigest, digest(text));
  assert.equal(result.governance.sourceDigest, result.originalDigest);
}

function runJson(cwd, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args, "--format=json"], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(result.status, expectedStatus, [
    `unexpected exit for ${args.join(" ")}`,
    result.stdout,
    result.stderr,
  ].join("\n"));
  return JSON.parse(result.stdout);
}

test("Issue 38 rebinds governed Grammar 7, 8, and 9 assurance results", () => {
  for (const grammarVersion of [7, 8, 9]) {
    const original = source(grammarVersion);
    const preview = planAssuranceMutation(
      original,
      { kind: "plan_assurance.seal", reason: "Reviewed source binding" },
      { governance: { intent: "preview", actor: "codex" } },
    );
    assert.equal(preview.ok, true, JSON.stringify(preview.diagnostics));
    assert.equal(preview.changed, true);
    assertBinding(preview, original);
    assert.deepEqual(preview.governance.affectedScopes, ["plan_assurance"]);
    assert.deepEqual(preview.governance.requiredOwnerConfirmations, []);
    assert.equal(preview.governance.writeAuthorized, true);

    const denied = planAssuranceMutation(
      original,
      { kind: "plan_assurance.seal", reason: "Denied persistence" },
      { governance: { intent: "persist", actor: "wrong" } },
    );
    assert.equal(denied.ok, false);
    assert.equal(denied.changed, true);
    assertBinding(denied, original);
    assert.deepEqual(denied.governance.requiredOwnerConfirmations, ["user"]);
    assert.equal(denied.governance.writeAuthorized, false);
    assert.equal(denied.governance.scopes[0].denialCause,
      "owner_confirmation_required");
    assert.ok(denied.diagnostics.some(({ code }) => code === "PTGOV-101"));

    const outcome = planAssuranceMutation(preview.updatedText, {
      kind: "task_outcome.add",
      id: "OUTCOME_WORK",
      taskId: "WORK",
      status: "conformant",
      reason: "Accepted result",
    });
    assert.equal(outcome.ok, true, JSON.stringify(outcome.diagnostics));
    const noOp = planAssuranceMutation(outcome.updatedText, {
      kind: "task_outcome.set",
      id: "OUTCOME_WORK",
      status: "conformant",
      reason: "Accepted result",
    });
    assert.equal(noOp.ok, true, JSON.stringify(noOp.diagnostics));
    assert.equal(noOp.changed, false);
    assertBinding(noOp, outcome.updatedText);
    assert.equal(noOp.governance.applicable, false);

    const invalid = planAssuranceMutation(
      outcome.updatedText,
      {
        kind: "task_outcome.set",
        id: "OUTCOME_WORK",
        status: "conformant",
        reason: "Accepted result",
      },
      { warningsAsErrors: true },
    );
    assert.equal(invalid.ok, false);
    assert.equal(invalid.changed, false);
    assertBinding(invalid, outcome.updatedText);
    assert.ok(invalid.diagnostics.some(({ severity }) => severity === "warning"));
  }
});

test("Issue 38 keeps CLI preview, separate output, and in-place bindings equal", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-issue-38-"));
  try {
    for (const grammarVersion of [7, 8, 9]) {
      const original = source(grammarVersion);
      const previewPath = path.join(directory, `preview-${grammarVersion}.pert`);
      await writeFile(previewPath, original, "utf8");
      const preview = runJson(directory, [
        "plan-assurance", "seal", previewPath,
        "--reason", "CLI preview binding", "--actor", "codex",
      ]);
      assert.equal(preview.ok, true);
      assert.equal(preview.write.written, false);
      assert.equal(preview.governance.source_digest, preview.source_digest);
      assert.equal(await readFile(previewPath, "utf8"), original);

      const outSource = path.join(directory, `out-source-${grammarVersion}.pert`);
      const outTarget = path.join(directory, `out-candidate-${grammarVersion}.pert`);
      await writeFile(outSource, original, "utf8");
      const separate = runJson(directory, [
        "plan-assurance", "seal", outSource,
        "--reason", "CLI output binding", "--actor", "codex",
        "--out", outTarget,
      ]);
      assert.equal(separate.ok, true);
      assert.equal(separate.write.mode, "out");
      assert.equal(separate.write.written, true);
      assert.equal(separate.governance.source_digest, separate.source_digest);
      assert.equal(await readFile(outSource, "utf8"), original);
      assert.equal(await readFile(outTarget, "utf8"), separate.updated_text);

      const writePath = path.join(directory, `write-${grammarVersion}.pert`);
      await writeFile(writePath, original, "utf8");
      const written = runJson(directory, [
        "plan-assurance", "seal", writePath,
        "--reason", "CLI write binding", "--actor", "codex",
        "--write", "--expect-digest", digest(original),
      ]);
      assert.equal(written.ok, true);
      assert.equal(written.write.mode, "in_place");
      assert.equal(written.write.written, true);
      assert.equal(written.governance.source_digest, written.source_digest);
      assert.equal(await readFile(writePath, "utf8"), written.updated_text);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

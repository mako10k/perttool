import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const source = path.join(root, "plans", "plan-review-request.pert");
const schemaBase = "https://github.com/mako10k/perttool/schemas/";

function run(args, expected = 0) {
  const child = spawnSync(process.execPath, [cli, ...args, "--format=json"], {
    cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(child.status, expected, `${args.join(" ")}\n${child.stderr}\n${child.stdout}`);
  assert.equal(child.stderr, "");
  return JSON.parse(child.stdout);
}

function ajv() {
  const validator = new Ajv2020({ allErrors: true, strict: true });
  for (const name of readdirSync(path.join(root, "schemas")).filter((name) => name.endsWith(".schema.json"))) {
    validator.addSchema(JSON.parse(readFileSync(path.join(root, "schemas", name), "utf8")));
  }
  return validator;
}

function conforms(validator, value) {
  const check = validator.getSchema(`${schemaBase}${value.schema_version}.schema.json`);
  assert.equal(typeof check, "function");
  assert.equal(check(value), true, JSON.stringify(check.errors));
}

test("Plan Review public CLI binds migration, advisory Next, resolution, and closed results", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-plan-review-public-"));
  try {
    const grammar9 = readFileSync(source, "utf8");
    const migration = run(["document", "migrate", source, "--target-grammar", "10"]);
    assert.equal(migration.ok, true);
    assert.equal(migration.changed, true);
    assert.equal(migration.updated_text, grammar9.replace("  version 9", "  version 10"));
    const migrated = path.join(directory, "migrated.pert");
    const opened = path.join(directory, "opened.pert");
    const resolved = path.join(directory, "resolved.pert");
    writeFileSync(migrated, migration.updated_text);
    const before = run(["dag", "next", migrated]);
    const creation = run(["plan", "review-request", migrated, "REVIEW_1", "PLAN_REVIEW_PUBLIC_CONTRACT",
      "--reason", "Recheck the public contract", "--created-at", "2026-09-29T21:00:00+09:00",
      "--actor", "codex", "--output", opened]);
    assert.equal(creation.ok, true);
    assert.equal(creation.write.written, true);
    assert.equal(readFileSync(opened, "utf8"), creation.candidate.text);
    assert.equal(creation.plan_basis.status, "unchanged");
    const after = run(["dag", "next", opened]);
    assert.equal(after.schema_version, "Perttool.NextResult.v9");
    assert.deepEqual(after.recommendation.recommended_task_ids, before.recommendation.recommended_task_ids);
    assert.deepEqual(after.temporal.authority.startable_recommended_task_ids,
      before.temporal.authority.startable_recommended_task_ids);
    assert.deepEqual(after.plan_review.open_request_ids, ["REVIEW_1"]);
    const shown = run(["plan", "review-show", opened, "REVIEW_1"]);
    assert.equal(shown.requests[0].state, "open");
    const resolution = run(["plan", "review-resolve", opened, "REVIEW_1",
      "--outcome", "plan_retained", "--resolved-at", "2026-09-29T21:10:00+09:00",
      "--actor", "user", "--resolution-reason", "Reviewed the current plan", "--output", resolved]);
    assert.equal(resolution.ok, true);
    assert.equal(readFileSync(resolved, "utf8"), resolution.candidate.text);
    assert.equal(run(["plan", "review-show", resolved, "REVIEW_1"]).requests[0].outcome, "plan_retained");
    assert.deepEqual(run(["dag", "next", resolved]).plan_review.open_request_ids, []);
    const validator = ajv();
    for (const value of [creation, shown, resolution, before, after]) conforms(validator, value);
    const older = run(["plan", "review-request", source, "REVIEW_1", "PLAN_REVIEW_PUBLIC_CONTRACT",
      "--reason", "Review", "--created-at", "2026-09-29T21:00:00+09:00", "--actor", "codex"], 1);
    assert.equal(older.candidate.text, null);
    assert.equal(older.diagnostics[0].code, "PTREV-110");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("failed Next and stale Plan Review bindings retain closed public results", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-plan-review-failure-"));
  try {
    const invalid = path.join(directory, "invalid.pert");
    writeFileSync(invalid, "project BROKEN:\n  version 10\n");
    const next = run(["dag", "next", invalid], 1);
    assert.equal(next.ok, false);
    assert.equal(next.plan_review, null);
    conforms(ajv(), next);

    const migrated = path.join(directory, "migrated.pert");
    const sourceText = readFileSync(source, "utf8").replace("  version 9", "  version 10");
    writeFileSync(migrated, sourceText);
    const stale = run(["plan", "review-request", migrated, "REVIEW_STALE", "PLAN_REVIEW_PUBLIC_CONTRACT",
      "--reason", "Review", "--created-at", "2026-09-29T21:00:00+09:00",
      "--actor", "codex", "--expected-digest", `sha256:${"0".repeat(64)}`], 5);
    assert.equal(stale.ok, false);
    assert.equal(stale.diagnostics[0].code, "PTREV-106");
    conforms(ajv(), stale);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

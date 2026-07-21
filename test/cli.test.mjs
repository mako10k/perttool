import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

test("dsl check text writes data to stdout", () => {
  const result = run(["dsl", "check", "docs/examples/minimal.pert", "--color", "never"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^OK docs\/examples\/minimal\.pert project=MINIMAL /);
  assert.equal(result.stderr, "");
});

test("dsl check JSON is stable and contains no ANSI escape", () => {
  const result = run(["dsl", "check", "docs/examples/parallel.pert", "--format", "json"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.endsWith("\n"), true);
  assert.equal(result.stdout.includes("\u001b"), false);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CheckResult.v1");
  assert.equal(json.document_id, "PARALLEL");
  assert.deepEqual(json.summary, {
    resources: 2,
    milestones: 8,
    tasks: 5,
    gates: 5,
    errors: 0,
    warnings: 0,
  });
});

test("stdin and file checks have the same semantic summary", async () => {
  const text = await readFile(path.join(root, "docs/examples/minimal.pert"), "utf8");
  const fromFile = run(["dsl", "check", "docs/examples/minimal.pert", "--format=json"]);
  const fromStdin = run(["dsl", "check", "-", "--format=json"], { input: text });
  assert.equal(fromFile.status, 0);
  assert.equal(fromStdin.status, 0);
  assert.deepEqual(JSON.parse(fromFile.stdout).summary, JSON.parse(fromStdin.stdout).summary);
  assert.equal(JSON.parse(fromStdin.stdout).source, "<stdin>");
});

test("invalid document returns exit 1 and one-based JSON span", () => {
  const result = run([
    "dsl",
    "check",
    "test/fixtures/invalid/undefined-endpoint.pert",
    "--format=json",
  ]);
  assert.equal(result.status, 1);
  const json = JSON.parse(result.stdout);
  const diagnostic = json.diagnostics.find(({ code }) => code === "PTSEM-204");
  assert.ok(diagnostic);
  assert.ok(diagnostic.span.start.line >= 1);
  assert.ok(diagnostic.span.start.column >= 1);
});

test("warnings-as-errors returns exit 1 without a success result", () => {
  const result = run([
    "dsl",
    "check",
    "docs/examples/advance-partial-before.pert",
    "--warnings-as-errors",
    "--color=never",
  ]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /PTDAG-208 warning:/);
});

test("missing input returns the stable I/O exit code as JSON", () => {
  const result = run([
    "dsl",
    "check",
    "test/fixtures/does-not-exist.pert",
    "--format=json",
  ]);
  assert.equal(result.status, 3);
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CliError.v1");
  assert.equal(json.diagnostics[0].code, "PTCLI-003");
});

test("dsl help exposes the estimate topic as JSON", () => {
  const result = run([
    "dsl",
    "help",
    "syntax",
    "estimate",
    "--level",
    "detail",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.HelpResult.v1");
  assert.equal(json.topic_id, "syntax.estimate");
  assert.ok(json.syntax.includes("    optimistic 1d"));
});

test("unknown command is a usage error", () => {
  const result = run(["dag", "analyze", "docs/examples/minimal.pert", "--format=json"]);
  assert.equal(result.status, 2);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CliError.v1");
  assert.equal(json.diagnostics[0].code, "PTCLI-001");
});

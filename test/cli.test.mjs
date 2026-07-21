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

test("dsl help exposes point velocity syntax for AI clients", () => {
  const result = run([
    "dsl",
    "help",
    "syntax",
    "velocity",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.topic_id, "syntax.velocity");
  assert.ok(json.syntax.includes("  velocity 20p/10d"));
  assert.ok(json.sections.some(({ id }) => id === "scope"));
});

test("dag analyze defaults to separate precedence and resource JSON results", () => {
  const result = run([
    "dag",
    "analyze",
    "docs/examples/parallel.pert",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.AnalysisResult.v2");
  assert.equal(json.mode, "both");
  assert.equal(json.precedence.makespan.numerator, "6");
  assert.equal(json.resource.makespan.numerator, "8");
  assert.equal(json.resource.algorithm.optimal, false);
  assert.deepEqual(json.resource.resource_arcs.map(({ id }) => id), [
    "resource:CLI:DOCS",
    "resource:TEST:PACKAGE",
  ]);
});

test("dag analyze text keeps precedence and heuristic resource sections distinct", () => {
  const result = run([
    "dag",
    "analyze",
    "docs/examples/parallel.pert",
    "--color=never",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  for (const section of [
    "QUALIFIERS",
    "PRECEDENCE",
    "PRECEDENCE CRITICAL",
    "RESOURCE SCHEDULE",
    "RESOURCE CRITICAL",
    "RESOURCE UTILIZATION",
  ]) {
    assert.match(result.stdout, new RegExp(`^${section}$`, "m"));
  }
  assert.match(result.stdout, /^ALGORITHM parallel-sgs@1 optimal=false$/m);
});

test("dag analyze returns point values and separate velocity forecasts", () => {
  const result = run([
    "dag",
    "analyze",
    "docs/examples/point-velocity.pert",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.duration_unit, "point");
  assert.equal(json.velocity.points.display, "20");
  assert.equal(json.velocity.period.unit, "day");
  assert.equal(json.precedence.makespan.unit, "point");
  assert.equal(json.precedence.makespan.display, "10");
  assert.equal(json.resource.makespan.display, "15");
  assert.equal(json.velocity_forecast.qualifier, "velocity_forecast");
  assert.equal(json.velocity_forecast.precedence_makespan.display, "5");
  assert.equal(json.velocity_forecast.resource_makespan.display, "7.5");

  const text = run([
    "dag",
    "analyze",
    "docs/examples/point-velocity.pert",
    "--color=never",
  ]);
  assert.equal(text.status, 0);
  assert.match(text.stdout, /^VELOCITY 20p\/10d$/m);
  assert.match(text.stdout, /^VELOCITY FORECAST 7\.5d$/m);
});

test("dag analyze warnings-as-errors suppresses the text success result", () => {
  const result = run([
    "dag",
    "analyze",
    "docs/examples/advance-partial-before.pert",
    "--warnings-as-errors",
    "--color=never",
  ]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /PTDAG-208 warning:/);
});

test("dag analyze preserves exact PERT values in precedence mode", () => {
  const result = run([
    "dag",
    "analyze",
    "docs/examples/pert-estimate.pert",
    "--schedule=precedence",
    "--precision=2",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  const design = json.precedence.edges.find(({ id }) => id === "DESIGN");
  assert.deepEqual(
    [design.expected.numerator, design.expected.denominator, design.expected.display],
    ["13", "6", "2.17"],
  );
  assert.equal(json.resource, null);
});

test("capacity overrides change resource schedule without changing precedence", () => {
  const result = run([
    "dag",
    "analyze",
    "docs/examples/parallel.pert",
    "--capacity",
    "DEVELOPERS=3",
    "--capacity=TEST_ENV=2",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.precedence.makespan.display, "6");
  assert.equal(json.resource.makespan.display, "6");
  assert.deepEqual(json.resource.resource_arcs, []);
});

test("dag next JSON separates readiness from the runnable resource subset", () => {
  const result = run([
    "dag",
    "next",
    "docs/examples/parallel.pert",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.NextResult.v2");
  assert.deepEqual(json.groups, {
    active: [],
    ready: ["CORE", "CLI", "DOCS"],
    runnable_now: ["CORE", "CLI"],
    blocked_now: [],
    upcoming: ["TEST", "PACKAGE"],
  });
  const docs = json.tasks.find(({ id }) => id === "DOCS");
  assert.equal(docs.classification, "ready");
  assert.equal(docs.runnable_now, false);
  assert.deepEqual(docs.resource_rejections, [{
    resource_id: "DEVELOPERS",
    capacity: 2,
    active_usage: 0,
    earlier_selected_usage: 2,
    used_before_decision: 2,
    required: 1,
    available: 0,
    deficit: 1,
    active_task_ids: [],
    earlier_selected_task_ids: ["CORE", "CLI"],
  }]);
});

test("dag next includes per-task velocity forecasts without replacing point estimates", () => {
  const result = run([
    "dag",
    "next",
    "docs/examples/point-velocity.pert",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.duration_unit, "point");
  assert.equal(json.velocity_forecast.target_unit, "day");
  const design = json.tasks.find(({ id }) => id === "DESIGN");
  assert.equal(design.expected.unit, "point");
  assert.equal(design.expected.display, "5");
  assert.equal(design.forecast_expected.unit, "day");
  assert.equal(design.forecast_expected.display, "2.5");
});

test("dag next text uses stable operational sections and explanations", () => {
  const result = run([
    "dag",
    "next",
    "docs/examples/parallel.pert",
    "--color=never",
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  const sections = [
    "ACTIVE",
    "RUNNABLE NOW",
    "READY / WAITING RESOURCE",
    "BLOCKED NOW",
    "UPCOMING",
  ];
  let previous = -1;
  for (const section of sections) {
    const index = result.stdout.indexOf(`\n${section}\n`);
    assert.ok(index > previous, `${section} must follow the previous section`);
    previous = index;
  }
  assert.match(result.stdout, /DEVELOPERS capacity=2 used=2 .*occupants=CORE,CLI/);
  assert.match(result.stdout, /waiting milestone=INTEGRATION_READY unsatisfied=CLI_READY,CORE_READY,DOCS_READY/);
});

test("dag next capacity override changes runnable membership but not readiness", () => {
  const result = run([
    "dag",
    "next",
    "docs/examples/parallel.pert",
    "--capacity=DEVELOPERS=3",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.deepEqual(json.groups.ready, ["CORE", "CLI", "DOCS"]);
  assert.deepEqual(json.groups.runnable_now, ["CORE", "CLI", "DOCS"]);
});

test("dag next accepts stdin and rejects an invalid explanation depth", async () => {
  const text = await readFile(path.join(root, "docs/examples/minimal.pert"), "utf8");
  const fromStdin = run(["dag", "next", "-", "--format=json"], { input: text });
  assert.equal(fromStdin.status, 0);
  assert.equal(JSON.parse(fromStdin.stdout).source, "<stdin>");

  const invalid = run([
    "dag",
    "next",
    "docs/examples/minimal.pert",
    "--explain-depth=33",
    "--format=json",
  ]);
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stdout).diagnostics[0].code, "PTCLI-001");
});

test("invalid capacity override is a usage or analysis error at the correct boundary", () => {
  const duplicate = run([
    "dag",
    "analyze",
    "docs/examples/parallel.pert",
    "--capacity=DEVELOPERS=2",
    "--capacity=DEVELOPERS=3",
    "--format=json",
  ]);
  assert.equal(duplicate.status, 2);
  assert.equal(JSON.parse(duplicate.stdout).diagnostics[0].code, "PTCLI-001");

  const unknown = run([
    "dag",
    "analyze",
    "docs/examples/parallel.pert",
    "--capacity=UNKNOWN=1",
    "--format=json",
  ]);
  assert.equal(unknown.status, 1);
  assert.equal(JSON.parse(unknown.stdout).diagnostics[0].code, "PTSEM-206");
});

test("analysis help documents exact arithmetic and capacity what-if", () => {
  const analysis = run([
    "dsl",
    "help",
    "analysis",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(analysis.status, 0);
  assert.ok(JSON.parse(analysis.stdout).sections.some(({ id }) => id === "exact"));

  const resources = run([
    "dsl",
    "help",
    "analysis",
    "resources",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(resources.status, 0);
  assert.ok(JSON.parse(resources.stdout).sections.some(({ id }) => id === "witness"));
});

test("unknown command is a usage error", () => {
  const result = run(["dag", "render", "docs/examples/minimal.pert", "--format=json"]);
  assert.equal(result.status, 2);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CliError.v1");
  assert.equal(json.diagnostics[0].code, "PTCLI-001");
});

import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { exportMermaid } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");
const minimalPath = "docs/examples/minimal.pert";
const minimalText = readFileSync(path.join(root, minimalPath), "utf8");

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

test("document check text writes data to stdout", () => {
  const result = run(["document", "check", "docs/examples/minimal.pert", "--color", "never"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^OK docs\/examples\/minimal\.pert project=MINIMAL /);
  assert.equal(result.stderr, "");
});

test("document check JSON is stable and contains no ANSI escape", () => {
  const result = run(["document", "check", "docs/examples/parallel.pert", "--format", "json"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.endsWith("\n"), true);
  assert.equal(result.stdout.includes("\u001b"), false);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CheckResult.v3");
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
  const fromFile = run(["document", "check", "docs/examples/minimal.pert", "--format=json"]);
  const fromStdin = run(["document", "check", "-", "--format=json"], { input: text });
  assert.equal(fromFile.status, 0);
  assert.equal(fromStdin.status, 0);
  assert.deepEqual(JSON.parse(fromFile.stdout).summary, JSON.parse(fromStdin.stdout).summary);
  assert.equal(JSON.parse(fromStdin.stdout).source, "<stdin>");
});

test("invalid document returns exit 1 and one-based JSON span", () => {
  const result = run([
    "document", "check",
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

test("diagnostic limit is stable across read-only document commands", () => {
  for (const command of [
    ["document", "check"],
    ["project", "show"],
    ["dag", "analyze"],
    ["dag", "next"],
  ]) {
    const result = run([
      ...command,
      "test/fixtures/invalid/multiple-syntax-errors.pert",
      "--max-diagnostics=2",
      "--format=json",
    ]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, "");
    const json = JSON.parse(result.stdout);
    assert.equal(json.diagnostics.length, 2);
    assert.equal(json.diagnostics_truncated, true);
    assert.deepEqual(json.diagnostics.map(({ code }) => code), ["PTDSL-006", "PTDSL-003"]);
  }

  const render = run([
    "dag", "render", "test/fixtures/invalid/multiple-syntax-errors.pert",
    "--to=mermaid", "--max-diagnostics=2", "--format=json",
  ]);
  assert.equal(render.status, 1);
  const renderJson = JSON.parse(render.stdout);
  assert.equal(renderJson.diagnostics.length, 2);
  assert.equal(renderJson.diagnostics_truncated, true);
  assert.equal(renderJson.artifact, null);
  assert.deepEqual(renderJson.diagnostics.map(({ code }) => code), ["PTDSL-006", "PTDSL-003"]);

  const text = run([
    "document", "check",
    "test/fixtures/invalid/multiple-syntax-errors.pert",
    "--max-diagnostics=2",
    "--color=never",
  ]);
  assert.equal(text.status, 1);
  assert.match(text.stderr, /DIAGNOSTICS_TRUNCATED true limit=2/);
});

test("warnings-as-errors returns exit 1 without a success result", () => {
  const result = run([
    "document", "check",
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
    "document", "check",
    "test/fixtures/does-not-exist.pert",
    "--format=json",
  ]);
  assert.equal(result.status, 3);
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CliError.v1");
  assert.equal(json.diagnostics[0].code, "PTCLI-003");
});

test("guide exposes the estimate topic as JSON", () => {
  const result = run([
    "guide",
    "syntax",
    "estimate",
    "--level",
    "detail",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.GuideResult.v1");
  assert.equal(json.cli_contract_version, 6);
  assert.equal(json.topic_id, "syntax.estimate");
  assert.ok(json.syntax.includes("    optimistic 1d"));
});

test("guide exposes point velocity syntax for AI clients", () => {
  const result = run([
    "guide",
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
  assert.equal(json.schema_version, "Perttool.AnalysisResult.v4");
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
  assert.equal(json.schema_version, "Perttool.NextResult.v5");
  assert.equal(json.recommendation_interface_version, 1);
  assert.equal(json.recommendation.explanation_status.complete, true);
  assert.deepEqual(json.recommendation.recommended_task_ids, ["CORE"]);
  assert.deepEqual(json.groups, {
    active: [],
    suspended: [],
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

test("dag advance exposes candidate, diff, structured summary, and stdin preview", () => {
  const source = "docs/examples/advance-partial-before.pert";
  const sourceText = readFileSync(path.join(root, source), "utf8");
  const help = run(["dag", "advance", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Command: perttool dag advance/);
  assert.match(help.stdout, /0: file type=path-or-stdin required=true/);
  assert.match(help.stdout, /--expect-digest/);

  const preview = run(["dag", "advance", source, "--color=never"]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /^project ADVANCE_PARTIAL:/);
  assert.doesNotMatch(preview.stdout, /task BRANCH_A /);
  assert.match(preview.stdout, /milestone A_DONE:[\s\S]*?state reached/);
  assert.match(preview.stderr, /^PREVIEW dag\.advance changed=true /m);
  assert.match(preview.stderr, /^ADVANCE removed_tasks=BRANCH_A removed_gates=- removed_milestones=- removed_work_events=-$/m);
  assert.match(preview.stderr, /^ADVANCE frontier_before=A_DONE,NOW frontier_after=A_DONE,NOW ready_before=- ready_after=-$/m);

  const diff = run(["dag", "advance", source, "--diff", "--color=never"]);
  assert.equal(diff.status, 0, diff.stderr);
  assert.match(diff.stdout, /^--- docs\/examples\/advance-partial-before\.pert/m);
  assert.match(diff.stdout, /^-task BRANCH_A NOW -> A_DONE:$/m);
  assert.match(diff.stderr, /removed_tasks=BRANCH_A/);

  const jsonResult = run(["dag", "advance", source, "--format=json"]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const json = JSON.parse(jsonResult.stdout);
  assert.equal(json.schema_version, "Perttool.MutationResult.v3");
  assert.equal(json.operation, "dag.advance");
  assert.equal(json.document_id, "ADVANCE_PARTIAL");
  assert.deepEqual(json.write, { mode: "preview", target: null, written: false });
  assert.deepEqual(json.advance, {
    removed_task_ids: ["BRANCH_A"],
    removed_gate_ids: [],
    removed_milestone_ids: [],
    removed_work_event_ids: [],
    frontier_before: ["A_DONE", "NOW"],
    frontier_after: ["A_DONE", "NOW"],
    ready_before: [],
    ready_after: [],
  });
  assert.match(json.updated_text, /^project ADVANCE_PARTIAL:/);
  assert.match(json.diff, /^--- docs\/examples\/advance-partial-before\.pert/m);
  assert.ok(json.edits.length > 0);

  const completeText = [
    "project COMPLETE_GATE:",
    "  title \"complete gate\"",
    "  duration_unit day",
    "  finish DONE",
    "",
    "milestone NOW:",
    "  title \"now\"",
    "  state reached",
    "",
    "milestone MID:",
    "  title \"middle\"",
    "",
    "milestone DONE:",
    "  title \"done\"",
    "",
    "task WORK NOW -> MID:",
    "  title \"work\"",
    "  duration 1d",
    "  status done",
    "",
    "gate RELEASE MID -> DONE:",
    "  reason \"release\"",
    "",
  ].join("\n");
  const complete = run(["dag", "advance", "-", "--format=json"], {
    input: completeText,
  });
  assert.equal(complete.status, 0, complete.stderr);
  assert.deepEqual(JSON.parse(complete.stdout).advance, {
    removed_task_ids: ["WORK"],
    removed_gate_ids: ["RELEASE"],
    removed_milestone_ids: ["MID", "NOW"],
    removed_work_event_ids: [],
    frontier_before: ["DONE"],
    frontier_after: ["DONE"],
    ready_before: [],
    ready_after: [],
  });

  const stdin = run(["dag", "advance", "-", "--format=json"], { input: sourceText });
  assert.equal(stdin.status, 0, stdin.stderr);
  assert.equal(JSON.parse(stdin.stdout).source, "<stdin>");

  const invalid = run([
    "dag", "advance", "test/fixtures/invalid/undefined-endpoint.pert", "--format=json",
  ]);
  assert.equal(invalid.status, 1, invalid.stderr);
  const invalidJson = JSON.parse(invalid.stdout);
  assert.equal(invalidJson.ok, false);
  assert.equal(invalidJson.updated_text, null);
  assert.equal(invalidJson.advance, null);
});

test("dag advance shares safe-write locks and repeated write is a no-op", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-advance-write-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "partial.pert");
  copyFileSync(path.join(root, "docs/examples/advance-partial-before.pert"), source);
  const initialDigest = JSON.parse(run([
    "document", "check", source, "--format=json",
  ]).stdout).source_digest;

  const written = run([
    "dag", "advance", source, "--write", "--expect-digest", initialDigest,
    "--actor", "user", "--format=json",
  ]);
  assert.equal(written.status, 0, written.stderr);
  const writtenJson = JSON.parse(written.stdout);
  assert.equal(writtenJson.write.mode, "in_place");
  assert.equal(writtenJson.write.written, true);
  assert.equal(readFileSync(source, "utf8"), writtenJson.updated_text);
  assert.doesNotMatch(readFileSync(source, "utf8"), /task BRANCH_A /);

  const repeated = run(["dag", "advance", source, "--write", "--format=json"]);
  assert.equal(repeated.status, 0, repeated.stderr);
  const repeatedJson = JSON.parse(repeated.stdout);
  assert.equal(repeatedJson.changed, false);
  assert.equal(repeatedJson.diff, "");
  assert.deepEqual(repeatedJson.edits, []);
  assert.equal(repeatedJson.write.written, false);
  assert.deepEqual(repeatedJson.advance.removed_task_ids, []);

  const outPath = path.join(directory, "candidate.pert");
  const out = run([
    "dag", "advance", "docs/examples/advance-partial-before.pert",
    "--out", outPath, "--actor", "user", "--format=json",
  ]);
  assert.equal(out.status, 0, out.stderr);
  assert.equal(JSON.parse(out.stdout).write.written, true);
  assert.equal(readFileSync(outPath, "utf8"), JSON.parse(out.stdout).updated_text);

  const stale = run([
    "dag", "advance", source, "--write",
    "--expect-digest", `sha256:${"0".repeat(64)}`,
    "--actor", "user", "--format=json",
  ]);
  assert.equal(stale.status, 5, stale.stderr);
  assert.equal(JSON.parse(stale.stdout).diagnostics[0].data.reason, "expected_digest_mismatch");

  for (const args of [
    ["dag", "advance", source, "--diff", "--write"],
    ["dag", "advance", "-", "--write"],
  ]) {
    const rejected = run([...args, "--format=json"]);
    assert.equal(rejected.status, 2, rejected.stderr);
    assert.equal(JSON.parse(rejected.stdout).diagnostics[0].code, "PTCLI-001");
  }
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
    "guide",
    "analysis",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(analysis.status, 0);
  assert.ok(JSON.parse(analysis.stdout).sections.some(({ id }) => id === "exact"));

  const resources = run([
    "guide",
    "analysis",
    "resources",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(resources.status, 0);
  assert.ok(JSON.parse(resources.stdout).sections.some(({ id }) => id === "witness"));
});

test("diagnostic help documents recovery, phase suppression, and limits", () => {
  const result = run([
    "guide",
    "errors",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.deepEqual(json.sections.map(({ id }) => id), ["recovery", "phases", "limit"]);
  assert.ok(json.syntax.some((line) => line.includes("--max-diagnostics")));
});

test("dag render requires the explicit artifact target", () => {
  const result = run(["dag", "render", "docs/examples/minimal.pert", "--format=json"]);
  assert.equal(result.status, 2);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CliError.v1");
  assert.equal(json.diagnostics[0].code, "PTCLI-001");
});

test("dag render exposes Core-identical Mermaid in text and JSON", () => {
  const expected = exportMermaid(minimalText);
  assert.equal(expected.ok, true);

  const help = run(["dag", "render", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--to kind=value type=artifact-format required=true/);
  assert.match(help.stdout, /default=null enum=mermaid/);
  assert.match(help.stdout, /--analysis kind=value type=mermaid-analysis-mode/);
  assert.match(help.stdout, /enum=none, precedence, resource, both/);

  const text = run([
    "dag", "render", minimalPath, "--to", "mermaid", "--color=never",
  ]);
  assert.equal(text.status, 0, text.stderr);
  assert.equal(text.stdout, expected.artifact);
  assert.equal(text.stderr, "");

  const jsonResult = run([
    "dag", "render", minimalPath, "--to=mermaid", "--format=json",
  ]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const json = JSON.parse(jsonResult.stdout);
  assert.equal(json.schema_version, "Perttool.ExportResult.v1");
  assert.equal(json.operation, "dag.render");
  assert.equal(json.artifact, expected.artifact);
  assert.equal(json.artifact_digest, expected.artifactDigest);
  assert.deepEqual(json.loss_report, { lossless: true, records: [] });
  assert.deepEqual(json.generated_ids, []);
  assert.deepEqual(json.write, { mode: "preview", target: null, written: false });
});

test("dag render passes analysis and capacity options into the profile snapshot", () => {
  const result = run([
    "dag", "render", "docs/examples/parallel.pert", "--to=mermaid",
    "--analysis=both", "--capacity=TEST_ENV=2", "--format=json",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.analysis, "both");
  assert.deepEqual(json.capacity_overrides, [
    { resource_id: "TEST_ENV", capacity: 2 },
  ]);
  assert.match(json.artifact, /"analysis":"both"/);
  assert.match(json.artifact, /CORE: .* \/ CP \/ S=0-4d/);

  const invalid = run([
    "dag", "render", minimalPath, "--to=mermaid",
    "--capacity=DEVELOPERS=2", "--format=json",
  ]);
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stdout).diagnostics[0].code, "PTCLI-001");
});

test("dag render reports plain-profile loss and strict-loss suppresses the artifact", () => {
  const plain = run([
    "dag", "render", minimalPath, "--to=mermaid", "--profile=plain",
    "--format=json",
  ]);
  assert.equal(plain.status, 0, plain.stderr);
  const plainJson = JSON.parse(plain.stdout);
  assert.equal(plainJson.ok, true);
  assert.equal(plainJson.loss_report.lossless, false);
  assert.deepEqual(plainJson.loss_report.records.map(({ code }) => code), ["PTCNV-206"]);
  assert.match(plainJson.artifact, /^flowchart LR\n/);

  const strict = run([
    "dag", "render", minimalPath, "--to=mermaid", "--profile=plain",
    "--strict-loss", "--format=json",
  ]);
  assert.equal(strict.status, 4, strict.stderr);
  const strictJson = JSON.parse(strict.stdout);
  assert.equal(strictJson.ok, false);
  assert.equal(strictJson.artifact, null);
  assert.equal(strictJson.artifact_digest, null);
  assert.equal(strictJson.write.written, false);
});

test("dag render suppresses invalid artifacts and writes output exclusively", (t) => {
  const invalid = run([
    "dag", "render", "test/fixtures/invalid/undefined-endpoint.pert",
    "--to=mermaid", "--format=json",
  ]);
  assert.equal(invalid.status, 1, invalid.stderr);
  const invalidJson = JSON.parse(invalid.stdout);
  assert.equal(invalidJson.artifact, null);
  assert.equal(invalidJson.loss_report.lossless, false);
  assert.ok(invalidJson.diagnostics.some(({ code }) => code === "PTSEM-204"));

  const directory = mkdtempSync(path.join(tmpdir(), "perttool-render-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "minimal.mmd");
  const written = run([
    "dag", "render", minimalPath, "--to=mermaid", "--out", output,
    "--format=json",
  ]);
  assert.equal(written.status, 0, written.stderr);
  const writtenJson = JSON.parse(written.stdout);
  assert.deepEqual(writtenJson.write, { mode: "out", target: output, written: true });
  assert.equal(readFileSync(output, "utf8"), writtenJson.artifact);

  const collision = run([
    "dag", "render", minimalPath, "--to=mermaid", "--out", output,
    "--format=json",
  ]);
  assert.equal(collision.status, 5, collision.stderr);
  const collisionJson = JSON.parse(collision.stdout);
  assert.equal(collisionJson.diagnostics[0].code, "PTIO-501");
  assert.equal(collisionJson.diagnostics[0].data.reason, "target_exists");
  assert.equal(readFileSync(output, "utf8"), writtenJson.artifact);

  const emptyOut = run([
    "dag", "render", minimalPath, "--to=mermaid", "--out=", "--format=json",
  ]);
  assert.equal(emptyOut.status, 2);
  assert.equal(JSON.parse(emptyOut.stdout).diagnostics[0].code, "PTCLI-001");
});

test("dag import restores a profile in text and JSON", () => {
  const profile = exportMermaid(minimalText).artifact;
  const help = run(["dag", "import", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Command: perttool dag import/);
  assert.match(help.stdout, /--from kind=value type=artifact-format required=true/);
  assert.match(help.stdout, /default=null enum=mermaid/);
  assert.match(help.stdout, /--strict-loss/);

  const text = run([
    "dag", "import", "-", "--from=mermaid", "--color=never",
  ], { input: profile });
  assert.equal(text.status, 0, text.stderr);
  assert.equal(JSON.parse(run(["document", "check", "-", "--format=json"], {
    input: text.stdout,
  }).stdout).ok, true);
  assert.equal(exportMermaid(text.stdout).artifact, profile);

  const jsonResult = run([
    "dag", "import", "-", "--from", "mermaid", "--format=json",
  ], { input: profile });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const json = JSON.parse(jsonResult.stdout);
  assert.equal(json.schema_version, "Perttool.ImportResult.v1");
  assert.equal(json.operation, "dag.import");
  assert.equal(json.document_id, "MINIMAL");
  assert.equal(json.profile, "perttool");
  assert.equal(json.artifact_format, "pert");
  assert.equal(json.loss_report.lossless, true);
  assert.deepEqual(json.generated_ids, []);
  assert.deepEqual(json.write, { mode: "preview", target: null, written: false });
  assert.equal(exportMermaid(json.artifact).artifact, profile);

  const corrupted = run([
    "dag", "import", "-", "--from=mermaid", "--format=json",
  ], { input: profile.replace('"duration":"1d"', '"duration":"2d"') });
  assert.equal(corrupted.status, 1, corrupted.stderr);
  const corruptedJson = JSON.parse(corrupted.stdout);
  assert.equal(corruptedJson.profile, "perttool");
  assert.equal(corruptedJson.artifact, null);
  assert.equal(corruptedJson.diagnostics[0].code, "PTCNV-104");
});

test("dag import reports plain loss, enforces strict-loss, and writes exclusively", (t) => {
  const plain = exportMermaid(minimalText, { profile: "plain" }).artifact;
  const preview = run([
    "dag", "import", "-", "--from=mermaid", "--format=json",
  ], { input: plain });
  assert.equal(preview.status, 0, preview.stderr);
  const previewJson = JSON.parse(preview.stdout);
  assert.equal(previewJson.ok, true);
  assert.equal(previewJson.profile, "plain");
  assert.equal(previewJson.loss_report.lossless, false);
  assert.ok(previewJson.loss_report.records.some(({ code }) => code === "PTCNV-203"));
  assert.ok(previewJson.generated_ids.length > 0);

  const strict = run([
    "dag", "import", "-", "--from=mermaid", "--strict-loss", "--format=json",
  ], { input: plain });
  assert.equal(strict.status, 4, strict.stderr);
  const strictJson = JSON.parse(strict.stdout);
  assert.equal(strictJson.ok, false);
  assert.equal(strictJson.artifact, null);
  assert.equal(strictJson.write.written, false);

  const directory = mkdtempSync(path.join(tmpdir(), "perttool-import-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "minimal.pert");
  const profile = exportMermaid(minimalText).artifact;
  const written = run([
    "dag", "import", "-", "--from=mermaid", "--out", output, "--format=json",
  ], { input: profile });
  assert.equal(written.status, 0, written.stderr);
  const writtenJson = JSON.parse(written.stdout);
  assert.deepEqual(writtenJson.write, { mode: "out", target: output, written: true });
  assert.equal(readFileSync(output, "utf8"), writtenJson.artifact);
  assert.equal(JSON.parse(run(["document", "check", output, "--format=json"]).stdout).ok, true);

  const collision = run([
    "dag", "import", "-", "--from=mermaid", "--out", output, "--format=json",
  ], { input: profile });
  assert.equal(collision.status, 5, collision.stderr);
  assert.equal(JSON.parse(collision.stdout).diagnostics[0].data.reason, "target_exists");

  for (const args of [
    ["dag", "import", "-"],
    ["dag", "import", "-", "--from=svg"],
    ["dag", "import", "-", "--from=mermaid", "--write"],
  ]) {
    const invalid = run([...args, "--format=json"], { input: profile });
    assert.equal(invalid.status, 2, invalid.stderr);
    assert.equal(JSON.parse(invalid.stdout).diagnostics[0].code, "PTCLI-001");
  }
});

test("document format exposes candidate, diff, JSON, and stdin previews", () => {
  const source = "test/fixtures/grammar/formatter-roundtrip.pert";
  const expected = readFileSync(
    path.join(root, "test/golden/grammar/formatter-roundtrip.expected.pert"),
    "utf8",
  );
  const sourceText = readFileSync(path.join(root, source), "utf8");

  const help = run(["document", "format", "--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Command: perttool document format/);
  assert.match(help.stdout, /0: file type=path-or-stdin required=true/);

  const preview = run(["document", "format", source, "--color=never"]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(preview.stdout, expected);
  assert.match(preview.stderr, /^PREVIEW document\.format changed=true /);

  const diff = run(["document", "format", source, "--diff", "--color=never"]);
  assert.equal(diff.status, 0, diff.stderr);
  assert.match(diff.stdout, /^--- test\/fixtures\/grammar\/formatter-roundtrip\.pert$/m);
  assert.match(diff.stdout, /^\+\+\+ candidate$/m);
  assert.equal(diff.stderr, "");

  const jsonResult = run(["document", "format", source, "--format=json"]);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const json = JSON.parse(jsonResult.stdout);
  assert.equal(json.schema_version, "Perttool.FormatResult.v1");
  assert.equal(json.operation, "document.format");
  assert.equal(json.document_id, "FORMATTER_ROUNDTRIP");
  assert.equal(json.updated_text, expected);
  assert.match(json.diff, /^--- test\/fixtures\/grammar\/formatter-roundtrip\.pert/m);
  assert.ok(json.edits.length > 0);
  assert.deepEqual(json.write, { mode: "preview", target: null, written: false });

  const withBom = `\uFEFF${sourceText}`;
  const stdin = run(["document", "format", "-", "--format=json"], { input: withBom });
  assert.equal(stdin.status, 0, stdin.stderr);
  const stdinJson = JSON.parse(stdin.stdout);
  assert.equal(stdinJson.source, "<stdin>");
  assert.equal(stdinJson.updated_text.startsWith("\uFEFF# formatter"), true);
  assert.equal(stdinJson.source_digest, stdinJson.original_digest);
});

test("document format check mode reports drift without hiding a valid candidate", () => {
  const source = "test/fixtures/grammar/formatter-roundtrip.pert";
  const expected = "test/golden/grammar/formatter-roundtrip.expected.pert";

  const changed = run(["document", "format", source, "--check", "--color=never"]);
  assert.equal(changed.status, 1);
  assert.equal(changed.stdout, "");
  assert.equal(changed.stderr, "");

  const changedDiff = run([
    "document", "format", source, "--check", "--diff", "--color=never",
  ]);
  assert.equal(changedDiff.status, 1);
  assert.match(changedDiff.stdout, /^--- test\/fixtures\/grammar\/formatter-roundtrip\.pert/m);

  const changedJson = run(["document", "format", source, "--check", "--format=json"]);
  assert.equal(changedJson.status, 1);
  const json = JSON.parse(changedJson.stdout);
  assert.equal(json.ok, false);
  assert.equal(json.changed, true);
  assert.match(json.updated_text, /^# formatter round-trip source/);
  assert.match(json.diff, /^--- test\/fixtures\/grammar\/formatter-roundtrip\.pert/m);
  assert.ok(json.edits.length > 0);

  const canonical = run(["document", "format", expected, "--check", "--color=never"]);
  assert.equal(canonical.status, 0, canonical.stderr);
  assert.equal(canonical.stdout, "");
});

test("document format validates write option combinations and suppresses invalid candidates", () => {
  const source = "test/fixtures/grammar/formatter-roundtrip.pert";
  for (const options of [
    [source, "--write", "--out", "other.pert"],
    [source, "--check", "--write"],
    [source, "--check", "--out", "other.pert"],
    [source, "--diff", "--write"],
    [source, "--diff", "--out", "other.pert"],
    [source, "--expect-digest", `sha256:${"0".repeat(64)}`],
    [source, "--write", "--expect-digest", "sha256:invalid"],
    ["-", "--write"],
  ]) {
    const result = run(["document", "format", ...options, "--format=json"], {
      input: options[0] === "-" ? minimalText : undefined,
    });
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).diagnostics[0].code, "PTCLI-001");
  }

  const invalid = run([
    "document", "format", "test/fixtures/invalid/undefined-endpoint.pert", "--format=json",
  ]);
  assert.equal(invalid.status, 1);
  const invalidJson = JSON.parse(invalid.stdout);
  assert.equal(invalidJson.ok, false);
  assert.equal(invalidJson.updated_text, null);
  assert.equal(invalidJson.diff, null);
  assert.deepEqual(invalidJson.edits, []);

  const warningText = minimalText
    .replace("project MINIMAL:", "project   MINIMAL:")
    .replace("  duration 1d\n", "  duration 01.0d\n  status done\n");
  const strict = run([
    "document", "format", "-", "--warnings-as-errors", "--format=json",
  ], { input: warningText });
  assert.equal(strict.status, 1);
  const strictJson = JSON.parse(strict.stdout);
  assert.equal(strictJson.ok, false);
  assert.match(strictJson.updated_text, /project MINIMAL:/);
  assert.match(strictJson.diff, /^--- <stdin>/m);
  assert.ok(strictJson.diagnostics.some(({ code }) => code === "PTDAG-208"));
});

test("document format safely writes in place and to a new output", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-format-write-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "plan.pert");
  const canonical = readFileSync(
    path.join(root, "test/golden/grammar/formatter-roundtrip.expected.pert"),
    "utf8",
  );
  copyFileSync(path.join(root, "test/fixtures/grammar/formatter-roundtrip.pert"), source);

  const written = run(["document", "format", source, "--write", "--format=json"]);
  assert.equal(written.status, 0, written.stderr);
  const writtenJson = JSON.parse(written.stdout);
  assert.deepEqual(writtenJson.write, {
    mode: "in_place",
    target: source,
    written: true,
  });
  assert.equal(readFileSync(source, "utf8"), canonical);

  const noOp = run(["document", "format", source, "--write", "--format=json"]);
  assert.equal(noOp.status, 0, noOp.stderr);
  assert.deepEqual(JSON.parse(noOp.stdout).write, {
    mode: "in_place",
    target: source,
    written: false,
  });

  const out = path.join(directory, "out.pert");
  const outResult = run(["document", "format", "-", "--out", out, "--format=json"], {
    input: canonical,
  });
  assert.equal(outResult.status, 0, outResult.stderr);
  assert.deepEqual(JSON.parse(outResult.stdout).write, {
    mode: "out",
    target: out,
    written: true,
  });
  assert.equal(readFileSync(out, "utf8"), canonical);

  const existing = run(["document", "format", source, "--out", out, "--format=json"]);
  assert.equal(existing.status, 5);
  const existingJson = JSON.parse(existing.stdout);
  assert.equal(existingJson.schema_version, "Perttool.CliError.v1");
  assert.equal(existingJson.diagnostics[0].code, "PTIO-501");
  assert.equal(existingJson.diagnostics[0].data.reason, "target_exists");

  const beforeConflict = readFileSync(source, "utf8");
  const stale = run([
    "document", "format", source, "--write",
    "--expect-digest", `sha256:${"0".repeat(64)}`, "--format=json",
  ]);
  assert.equal(stale.status, 5);
  const staleJson = JSON.parse(stale.stdout);
  assert.equal(staleJson.diagnostics[0].code, "PTIO-501");
  assert.equal(staleJson.diagnostics[0].data.reason, "expected_digest_mismatch");
  assert.equal(readFileSync(source, "utf8"), beforeConflict);

  const symlink = path.join(directory, "linked.pert");
  symlinkSync(source, symlink);
  const linked = run(["document", "format", symlink, "--write", "--format=json"]);
  assert.equal(linked.status, 5);
  assert.equal(JSON.parse(linked.stdout).diagnostics[0].data.reason, "symlink");
  assert.equal(readFileSync(source, "utf8"), beforeConflict);
});

test("task mutation commands expose candidate, diff, JSON, and stdin previews", () => {
  const actionHelp = run(["task", "add", "--help"]);
  assert.equal(actionHelp.status, 0, actionHelp.stderr);
  assert.match(actionHelp.stdout, /Command: perttool task add/);
  assert.match(actionHelp.stdout, /0: file type=path-or-stdin required=true/);
  assert.match(actionHelp.stdout, /1: id type=task-id required=true/);
  assert.match(actionHelp.stdout, /2: from type=milestone-id required=true/);
  assert.match(actionHelp.stdout, /3: to type=milestone-id required=true/);

  const defaultPreview = run([
    "task", "set", minimalPath, "WORK", "--title", "default preview", "--color=never",
  ]);
  assert.equal(defaultPreview.status, 0, defaultPreview.stderr);
  assert.match(defaultPreview.stdout, /^project MINIMAL:/);
  assert.match(defaultPreview.stdout, /title "default preview"/);
  assert.doesNotMatch(defaultPreview.stdout, /^--- /m);
  assert.match(
    defaultPreview.stderr,
    /^PREVIEW task\.set changed=true original_digest=sha256:[0-9a-f]{64} updated_digest=sha256:[0-9a-f]{64}$/m,
  );

  const added = run([
    "task", "add", minimalPath, "EXTRA", "NOW", "DONE",
    "--title", "extra", "--duration", "2d", "--format=json",
  ]);
  assert.equal(added.status, 0, added.stderr);
  const addedJson = JSON.parse(added.stdout);
  assert.equal(addedJson.schema_version, "Perttool.MutationResult.v3");
  assert.equal(addedJson.operation, "task.add");
  assert.equal(addedJson.document_id, "MINIMAL");
  assert.equal(addedJson.write.mode, "preview");
  assert.equal(addedJson.write.written, false);
  assert.match(addedJson.updated_text, /task EXTRA NOW -> DONE:/);
  assert.match(addedJson.diff, /^--- docs\/examples\/minimal\.pert\n\+\+\+ candidate/m);
  assert.ok(addedJson.edits.every(({ start_offset, end_offset }) =>
    Number.isInteger(start_offset) && Number.isInteger(end_offset)));

  const setFromStdin = run([
    "task", "set", "-", "WORK", "--title", "updated", "--duration", "2d",
    "--add-tag", "selected", "--format=json",
  ], { input: minimalText });
  assert.equal(setFromStdin.status, 0, setFromStdin.stderr);
  const setJson = JSON.parse(setFromStdin.stdout);
  assert.equal(setJson.source, "<stdin>");
  assert.match(setJson.updated_text, /title "updated"/);
  assert.match(setJson.updated_text, /duration 2d/);
  assert.match(setJson.updated_text, /tags \[selected\]/);

  const estimated = run([
    "task", "set", "docs/examples/parallel.pert", "DOCS",
    "--optimistic", "1d", "--most-likely", "2d", "--pessimistic", "3d",
    "--priority", "4", "--owner", "agent", "--require", "DEVELOPERS=2",
    "--source", "issue:preview", "--format=json",
  ]);
  assert.equal(estimated.status, 0, estimated.stderr);
  const estimatedText = JSON.parse(estimated.stdout).updated_text;
  assert.match(estimatedText, /estimate:\n    optimistic 1d\n    most_likely 2d\n    pessimistic 3d/);
  assert.match(estimatedText, /priority 4/);
  assert.match(estimatedText, /DEVELOPERS 2/);
  assert.match(estimatedText, /owner "agent"/);
  assert.match(estimatedText, /source "issue:preview"/);

  const parallelTasks = minimalText.replace(
    "task WORK NOW -> DONE:\n  title \"Do work\"\n  duration 1d\n",
    [
      "task FIRST NOW -> DONE:",
      "  title \"first\"",
      "  duration 1d",
      "",
      "task SECOND NOW -> DONE:",
      "  title \"second\"",
      "  duration 1d",
      "",
    ].join("\n"),
  );
  const removed = run([
    "task", "remove", "-", "FIRST", "--format=json",
  ], { input: parallelTasks });
  assert.equal(removed.status, 0, removed.stderr);
  assert.doesNotMatch(JSON.parse(removed.stdout).updated_text, /task FIRST/);
  assert.match(JSON.parse(removed.stdout).updated_text, /task SECOND/);

  const finished = run(["task", "finish", minimalPath, "WORK", "--diff", "--color=never"]);
  assert.equal(finished.status, 0, finished.stderr);
  assert.match(finished.stdout, /^--- docs\/examples\/minimal\.pert/m);
  assert.match(finished.stdout, /^\+  status done$/m);
});

test("project show and set expose all metadata without direct source editing", () => {
  const showHelp = run(["project", "show", "--help"]);
  assert.equal(showHelp.status, 0, showHelp.stderr);
  assert.match(showHelp.stdout, /Command: perttool project show/);
  assert.match(showHelp.stdout, /0: file type=path-or-stdin required=true/);
  const setHelp = run(["project", "set", "--help"]);
  assert.equal(setHelp.status, 0, setHelp.stderr);
  assert.match(setHelp.stdout, /--velocity kind=value type=velocity/);
  assert.match(
    setHelp.stdout,
    /enum=description, as_of, velocity, critical_epsilon, target_duration, goal_owner, goal_delegates, dag_owner, dag_delegates/,
  );

  const shown = run([
    "project", "show", "test/fixtures/grammar/all-fields.pert", "--format=json",
  ]);
  assert.equal(shown.status, 0, shown.stderr);
  const shownJson = JSON.parse(shown.stdout);
  assert.equal(shownJson.schema_version, "Perttool.ProjectResult.v3");
  assert.equal(shownJson.operation, "project.show");
  assert.equal(shownJson.document_id, "ALL_FIELDS");
  assert.equal(shownJson.grammar_version, 1);
  assert.deepEqual(shownJson.project, {
    id: "ALL_FIELDS",
    version: 1,
    title: "all declaration fields",
    description: "project description",
    as_of: {
      kind: "date_time",
      source_text: "2026-07-21T20:00:00+09:00",
      year: 2026,
      month: 7,
      day: 21,
      hour: 20,
      minute: 0,
      second: { numerator: "0", denominator: "1" },
      offset_minutes: 540,
    },
    duration_unit: "point",
    velocity: "10p/5d",
    finish: "DONE",
    finish_deadline: null,
    governance: {
      source_contract_version: 1,
      declared: {
        goal_owner: null,
        goal_delegates: null,
        dag_owner: null,
        dag_delegates: null,
      },
      effective: {
        goal_owner: "user",
        goal_delegates: [],
        dag_owner: "user",
        dag_delegates: [],
      },
    },
    critical_epsilon: "0p",
    target_duration: "20p",
  });

  const text = run([
    "project", "show", "test/fixtures/grammar/all-fields.pert", "--color=never",
  ]);
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /^PROJECT ALL_FIELDS\nVERSION 1\n/);
  assert.match(text.stdout, /^VELOCITY 10p\/5d$/m);

  const preview = run([
    "project", "set", "-", "--id", "CLI_PROJECT", "--title", "CLI project",
    "--as-of", "2026-07-23", "--velocity", "12p/5d",
    "--critical-epsilon", "1p", "--target-duration", "25p",
    "--clear", "description", "--format=json",
  ], { input: readFileSync(path.join(root, "test/fixtures/grammar/all-fields.pert"), "utf8") });
  assert.equal(preview.status, 0, preview.stderr);
  const previewJson = JSON.parse(preview.stdout);
  assert.equal(previewJson.schema_version, "Perttool.MutationResult.v3");
  assert.equal(previewJson.operation, "project.set");
  assert.equal(previewJson.source, "<stdin>");
  assert.equal(previewJson.write.mode, "preview");
  assert.match(previewJson.updated_text, /^project CLI_PROJECT:/);
  assert.match(previewJson.updated_text, /  velocity 12p\/5d/);
  assert.doesNotMatch(previewJson.updated_text, /project description/);

  const conflict = run([
    "project", "set", minimalPath, "--description", "set",
    "--clear", "description", "--format=json",
  ]);
  assert.equal(conflict.status, 2);
  assert.equal(JSON.parse(conflict.stdout).schema_version, "Perttool.CliError.v1");

  const invalid = run([
    "project", "set", minimalPath, "--duration-unit", "point",
    "--velocity", "10p/1d", "--format=json",
  ]);
  assert.equal(invalid.status, 1, invalid.stderr);
  const invalidJson = JSON.parse(invalid.stdout);
  assert.equal(invalidJson.updated_text, null);
  assert.deepEqual(invalidJson.edits, []);
});

test("mutation preview preserves a UTF-8 BOM and hashes the same document bytes", () => {
  const withBom = `\uFEFF${minimalText}`;
  const result = run([
    "task", "set", "-", "WORK", "--title", "BOM preserved", "--format=json",
  ], { input: withBom });
  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.updated_text.startsWith("\uFEFFproject MINIMAL:"), true);
  assert.equal(json.original_digest, json.source_digest);
});

test("milestone and resource add set remove actions project to mutation Core", () => {
  const milestoneSet = run([
    "milestone", "set", minimalPath, "DONE", "--title", "completed", "--format=json",
  ]);
  assert.equal(milestoneSet.status, 0, milestoneSet.stderr);
  assert.match(JSON.parse(milestoneSet.stdout).updated_text, /title "completed"/);

  for (const args of [
    ["milestone", "add", minimalPath, "ISOLATED", "--title", "isolated"],
    ["milestone", "remove", minimalPath, "DONE"],
  ]) {
    const rejected = run([...args, "--format=json"]);
    assert.equal(rejected.status, 1, rejected.stderr);
    const json = JSON.parse(rejected.stdout);
    assert.equal(json.schema_version, "Perttool.MutationResult.v3");
    assert.equal(json.ok, false);
    assert.equal(json.updated_text, null);
    assert.equal(json.diff, null);
    assert.deepEqual(json.edits, []);
  }

  const resourceAdd = run([
    "resource", "add", minimalPath, "UNUSED", "--title", "unused",
    "--capacity", "2", "--format=json",
  ]);
  assert.equal(resourceAdd.status, 0, resourceAdd.stderr);
  assert.match(JSON.parse(resourceAdd.stdout).updated_text, /resource UNUSED:/);

  const resourceSet = run([
    "resource", "set", "docs/examples/parallel.pert", "TEST_ENV",
    "--capacity", "2", "--description", "parallel tests", "--format=json",
  ]);
  assert.equal(resourceSet.status, 0, resourceSet.stderr);
  assert.match(JSON.parse(resourceSet.stdout).updated_text, /description "parallel tests"/);
  assert.match(JSON.parse(resourceSet.stdout).updated_text, /capacity 2/);

  const withUnusedResource = minimalText.replace(
    "\nmilestone NOW:",
    "\nresource UNUSED:\n  title \"unused\"\n  capacity 1\n\nmilestone NOW:",
  );
  const resourceRemove = run([
    "resource", "remove", "-", "UNUSED", "--format=json",
  ], { input: withUnusedResource });
  assert.equal(resourceRemove.status, 0, resourceRemove.stderr);
  assert.doesNotMatch(JSON.parse(resourceRemove.stdout).updated_text, /resource UNUSED:/);
});

test("batch apply supports request or document stdin but rejects a shared stdin", (t) => {
  const request = {
    kind: "batch",
    mutations: [
      { kind: "task.remove", id: "WORK" },
      { kind: "milestone.add", id: "MID", milestone: { title: "middle" } },
      {
        kind: "task.add", id: "FIRST", from: "NOW", to: "MID",
        task: { title: "first", duration: "1d" },
      },
      {
        kind: "task.add", id: "SECOND", from: "MID", to: "DONE",
        task: { title: "second", duration: "1d" },
      },
    ],
  };
  const requestText = JSON.stringify(request);
  const requestFromStdin = run([
    "batch", "apply", minimalPath, "--request", "-", "--format=json",
  ], { input: requestText });
  assert.equal(requestFromStdin.status, 0, requestFromStdin.stderr);
  const requestJson = JSON.parse(requestFromStdin.stdout);
  assert.match(requestJson.updated_text, /milestone MID:/);
  assert.match(requestJson.updated_text, /task SECOND MID -> DONE:/);

  const directory = mkdtempSync(path.join(tmpdir(), "perttool-mutation-request-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const requestPath = path.join(directory, "request.json");
  writeFileSync(requestPath, requestText, "utf8");
  const documentFromStdin = run([
    "batch", "apply", "-", "--request", requestPath, "--format=json",
  ], { input: minimalText });
  assert.equal(documentFromStdin.status, 0, documentFromStdin.stderr);
  assert.equal(JSON.parse(documentFromStdin.stdout).source, "<stdin>");

  const conflict = run([
    "batch", "apply", "-", "--request", "-", "--format=json",
  ]);
  assert.equal(conflict.status, 2);
  assert.match(
    JSON.parse(conflict.stdout).diagnostics[0].message,
    /document and request stdin are mutually exclusive/,
  );

  const nested = run([
    "batch", "apply", minimalPath, "--request", "-", "--format=json",
  ], {
    input: JSON.stringify({ kind: "batch", mutations: [{ kind: "batch", mutations: [] }] }),
  });
  assert.equal(nested.status, 1);
  const nestedJson = JSON.parse(nested.stdout);
  assert.equal(nestedJson.diagnostics[0].code, "PTMUT-301");
  assert.equal(nestedJson.updated_text, null);

  const nonBatch = run([
    "batch", "apply", minimalPath, "--request", "-", "--format=json",
  ], { input: JSON.stringify({ kind: "task.finish", id: "WORK" }) });
  assert.equal(nonBatch.status, 1);
  const nonBatchJson = JSON.parse(nonBatch.stdout);
  assert.equal(nonBatchJson.diagnostics[0].code, "PTMUT-301");
  assert.equal(nonBatchJson.updated_text, null);
});

test("mutation CLI validates write options and suppresses failed candidates", () => {
  for (const options of [
    ["--write", "--out", "other.pert"],
    ["--diff", "--write"],
    ["--expect-digest", `sha256:${"0".repeat(64)}`],
    ["--write", "--expect-digest", "sha256:invalid"],
  ]) {
    const result = run([
      "task", "set", minimalPath, "WORK", "--title", "updated",
      ...options, "--format=json",
    ]);
    assert.equal(result.status, 2);
    const json = JSON.parse(result.stdout);
    assert.equal(json.schema_version, "Perttool.CliError.v1");
    assert.equal(json.diagnostics[0].code, "PTCLI-001");
  }

  const invalidJson = run([
    "task", "set", minimalPath, "WORK", "--status", "blocked", "--format=json",
  ]);
  assert.equal(invalidJson.status, 1);
  const invalid = JSON.parse(invalidJson.stdout);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.updated_text, null);
  assert.equal(invalid.diff, null);
  assert.deepEqual(invalid.edits, []);

  const invalidText = run([
    "task", "set", minimalPath, "WORK", "--status", "blocked", "--color=never",
  ]);
  assert.equal(invalidText.status, 1);
  assert.equal(invalidText.stdout, "");
  assert.match(invalidText.stderr, /blocked_reason/);

  const strict = run([
    "task", "finish", minimalPath, "WORK", "--warnings-as-errors", "--format=json",
  ]);
  assert.equal(strict.status, 1);
  const strictJson = JSON.parse(strict.stdout);
  assert.equal(strictJson.ok, false);
  assert.match(strictJson.updated_text, /status done/);
  assert.match(strictJson.diff, /^--- docs\/examples\/minimal\.pert/m);
  assert.ok(strictJson.edits.length > 0);

  const limited = run([
    "task", "set", "test/fixtures/invalid/multiple-syntax-errors.pert", "WORK",
    "--title", "x", "--max-diagnostics=2", "--format=json",
  ]);
  assert.equal(limited.status, 1);
  const limitedJson = JSON.parse(limited.stdout);
  assert.equal(limitedJson.diagnostics.length, 2);
  assert.equal(limitedJson.diagnostics_truncated, true);
  assert.equal(limitedJson.updated_text, null);
});

test("mutation CLI exposes unused owner assertions and strict mode prevents write", (t) => {
  const preview = run([
    "task", "set", minimalPath, "WORK", "--title", "updated",
    "--accepted-by-owner", "user", "--format=json",
  ]);
  assert.equal(preview.status, 0, preview.stderr);
  const previewJson = JSON.parse(preview.stdout);
  assert.equal(previewJson.ok, true);
  assert.equal(previewJson.governance.applicable, false);
  assert.deepEqual(previewJson.governance.accepted_by_owner, ["user"]);
  assert.deepEqual(
    previewJson.diagnostics.map(({ code, severity }) => ({ code, severity })),
    [{ code: "PTGOV-103", severity: "warning" }],
  );

  const directory = mkdtempSync(
    path.join(tmpdir(), "perttool-governance-warning-"),
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, "plan.pert");
  copyFileSync(path.join(root, minimalPath), target);
  const before = readFileSync(target, "utf8");
  const sourceDigest = JSON.parse(run([
    "document", "check", target, "--format=json",
  ]).stdout).source_digest;
  const strict = run([
    "task", "set", target, "WORK", "--title", "updated",
    "--accepted-by-owner", "user", "--write",
    "--expect-digest", sourceDigest, "--warnings-as-errors", "--format=json",
  ]);
  assert.equal(strict.status, 1, strict.stderr);
  const strictJson = JSON.parse(strict.stdout);
  assert.equal(strictJson.ok, false);
  assert.equal(strictJson.write.written, false);
  assert.equal(strictJson.diagnostics[0].code, "PTGOV-103");
  assert.equal(readFileSync(target, "utf8"), before);

  const allowed = run([
    "task", "set", target, "WORK", "--title", "updated",
    "--accepted-by-owner", "user", "--write",
    "--expect-digest", sourceDigest, "--format=json",
  ]);
  assert.equal(allowed.status, 0, allowed.stderr);
  const allowedJson = JSON.parse(allowed.stdout);
  assert.equal(allowedJson.ok, true);
  assert.equal(allowedJson.write.written, true);
  assert.equal(allowedJson.diagnostics[0].code, "PTGOV-103");
  assert.match(readFileSync(target, "utf8"), /title "updated"/);
});

test("entity and batch mutation commands share the safe-write path", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-mutation-write-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const taskPath = path.join(directory, "task.pert");
  copyFileSync(path.join(root, minimalPath), taskPath);
  const initialDigest = JSON.parse(run([
    "document", "check", taskPath, "--format=json",
  ]).stdout).source_digest;
  const task = run([
    "task", "set", taskPath, "WORK", "--title", "implemented", "--write",
    "--expect-digest", initialDigest, "--format=json",
  ]);
  assert.equal(task.status, 0, task.stderr);
  assert.deepEqual(JSON.parse(task.stdout).write, {
    mode: "in_place",
    target: taskPath,
    written: true,
  });
  assert.match(readFileSync(taskPath, "utf8"), /title "implemented"/);

  const milestonePath = path.join(directory, "milestone.pert");
  copyFileSync(path.join(root, minimalPath), milestonePath);
  const milestone = run([
    "milestone", "set", milestonePath, "DONE", "--title", "released", "--write",
    "--color=never",
  ]);
  assert.equal(milestone.status, 0, milestone.stderr);
  assert.equal(milestone.stdout, "");
  assert.match(
    milestone.stderr,
    new RegExp(`^WRITE milestone\\.set mode=in_place target=${milestonePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} digest=sha256:[0-9a-f]{64} written=true\\n$`),
  );
  assert.match(readFileSync(milestonePath, "utf8"), /title "released"/);

  const resourcePath = path.join(directory, "resource.pert");
  copyFileSync(path.join(root, "docs/examples/parallel.pert"), resourcePath);
  const resource = run([
    "resource", "set", resourcePath, "DEVELOPERS", "--capacity", "3", "--write",
    "--format=json",
  ]);
  assert.equal(resource.status, 0, resource.stderr);
  assert.equal(JSON.parse(resource.stdout).write.written, true);
  assert.match(readFileSync(resourcePath, "utf8"), /resource DEVELOPERS:[\s\S]*capacity 3/);

  const batchPath = path.join(directory, "batch.pert");
  copyFileSync(path.join(root, minimalPath), batchPath);
  const batchDigest = JSON.parse(run([
    "document", "check", batchPath, "--format=json",
  ]).stdout).source_digest;
  const request = {
    kind: "batch",
    mutations: [{
      kind: "gate.add",
      id: "APPROVAL",
      from: "NOW",
      to: "DONE",
      gate: { reason: "batched approval" },
    }],
  };
  const batch = run([
    "batch", "apply", batchPath, "--request", "-", "--write",
    "--expect-digest", batchDigest, "--actor", "user", "--format=json",
  ], { input: JSON.stringify(request) });
  assert.equal(batch.status, 0, batch.stderr);
  assert.equal(JSON.parse(batch.stdout).write.written, true);
  assert.match(
    readFileSync(batchPath, "utf8"),
    /gate APPROVAL NOW -> DONE:\n  reason "batched approval"/,
  );

  const gateOutPath = path.join(directory, "gate-out.pert");
  const gateOut = run([
    "batch", "apply", minimalPath, "--request", "-", "--out", gateOutPath,
    "--actor", "user", "--format=json",
  ], { input: JSON.stringify(request) });
  assert.equal(gateOut.status, 0, gateOut.stderr);
  assert.deepEqual(JSON.parse(gateOut.stdout).write, {
    mode: "out",
    target: gateOutPath,
    written: true,
  });
  assert.match(readFileSync(gateOutPath, "utf8"), /gate APPROVAL NOW -> DONE:/);

  const outPath = path.join(directory, "out.pert");
  const out = run([
    "task", "set", minimalPath, "WORK", "--title", "copied", "--out", outPath,
    "--format=json",
  ]);
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout).write, {
    mode: "out",
    target: outPath,
    written: true,
  });
  assert.match(readFileSync(outPath, "utf8"), /title "copied"/);
  assert.equal(readFileSync(path.join(root, minimalPath), "utf8"), minimalText);

  const strictPath = path.join(directory, "strict.pert");
  copyFileSync(path.join(root, minimalPath), strictPath);
  const beforeStrict = readFileSync(strictPath, "utf8");
  const strict = run([
    "task", "finish", strictPath, "WORK", "--write", "--warnings-as-errors",
    "--format=json",
  ]);
  assert.equal(strict.status, 1);
  const strictJson = JSON.parse(strict.stdout);
  assert.deepEqual(strictJson.write, {
    mode: "in_place",
    target: strictPath,
    written: false,
  });
  assert.equal(readFileSync(strictPath, "utf8"), beforeStrict);
});

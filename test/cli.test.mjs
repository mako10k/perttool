import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

test("diagnostic limit is stable across read-only document commands", () => {
  for (const command of [
    ["dsl", "check"],
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

  const text = run([
    "dsl",
    "check",
    "test/fixtures/invalid/multiple-syntax-errors.pert",
    "--max-diagnostics=2",
    "--color=never",
  ]);
  assert.equal(text.status, 1);
  assert.match(text.stderr, /DIAGNOSTICS_TRUNCATED true limit=2/);
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

test("diagnostic help documents recovery, phase suppression, and limits", () => {
  const result = run([
    "dsl",
    "help",
    "errors",
    "--level=detail",
    "--format=json",
  ]);
  assert.equal(result.status, 0);
  const json = JSON.parse(result.stdout);
  assert.deepEqual(json.sections.map(({ id }) => id), ["recovery", "phases", "limit"]);
  assert.ok(json.syntax.some((line) => line.includes("--max-diagnostics")));
});

test("unknown command is a usage error", () => {
  const result = run(["dag", "render", "docs/examples/minimal.pert", "--format=json"]);
  assert.equal(result.status, 2);
  const json = JSON.parse(result.stdout);
  assert.equal(json.schema_version, "Perttool.CliError.v1");
  assert.equal(json.diagnostics[0].code, "PTCLI-001");
});

test("task mutation commands expose candidate, diff, JSON, and stdin previews", () => {
  const actionHelp = run(["task", "add", "--help"]);
  assert.equal(actionHelp.status, 0, actionHelp.stderr);
  assert.match(actionHelp.stdout, /perttool task add <file> <id> <from> <to>/);

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
  assert.equal(addedJson.schema_version, "Perttool.MutationResult.v1");
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
    "task WORK NOW -> DONE:\n  title \"作業する\"\n  duration 1d\n",
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
    assert.equal(json.schema_version, "Perttool.MutationResult.v1");
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

test("mutation apply supports request or document stdin but rejects a shared stdin", (t) => {
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
    "mutation", "apply", minimalPath, "--request", "-", "--format=json",
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
    "mutation", "apply", "-", "--request", requestPath, "--format=json",
  ], { input: minimalText });
  assert.equal(documentFromStdin.status, 0, documentFromStdin.stderr);
  assert.equal(JSON.parse(documentFromStdin.stdout).source, "<stdin>");

  const conflict = run([
    "mutation", "apply", "-", "--request", "-", "--format=json",
  ]);
  assert.equal(conflict.status, 2);
  assert.match(JSON.parse(conflict.stdout).diagnostics[0].message, /cannot both use stdin/);

  const nested = run([
    "mutation", "apply", minimalPath, "--request", "-", "--format=json",
  ], {
    input: JSON.stringify({ kind: "batch", mutations: [{ kind: "batch", mutations: [] }] }),
  });
  assert.equal(nested.status, 1);
  const nestedJson = JSON.parse(nested.stdout);
  assert.equal(nestedJson.diagnostics[0].code, "PTMUT-301");
  assert.equal(nestedJson.updated_text, null);

  const nonBatch = run([
    "mutation", "apply", minimalPath, "--request", "-", "--format=json",
  ], { input: JSON.stringify({ kind: "task.finish", id: "WORK" }) });
  assert.equal(nonBatch.status, 1);
  const nonBatchJson = JSON.parse(nonBatch.stdout);
  assert.equal(nonBatchJson.diagnostics[0].code, "PTMUT-301");
  assert.equal(nonBatchJson.updated_text, null);
});

test("mutation preview rejects writes and suppresses failed candidates", () => {
  for (const option of [
    ["--write"],
    ["--out", "other.pert"],
    ["--expect-digest", `sha256:${"0".repeat(64)}`],
  ]) {
    const result = run([
      "task", "set", minimalPath, "WORK", "--title", "updated",
      ...option, "--format=json",
    ]);
    assert.equal(result.status, 2);
    const json = JSON.parse(result.stdout);
    assert.equal(json.schema_version, "Perttool.CliError.v1");
    assert.match(json.diagnostics[0].message, /not implemented/);
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

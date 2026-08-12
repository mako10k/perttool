import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  planAcceptanceReceiptMutation,
  planAdvance,
  planCriterionSetReplacement,
  planMilestoneAcceptanceAdvance,
  planMilestoneAcceptanceMigration,
} from "../dist/index.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");
const fixture = (name) => `test/fixtures/e2e/${name}.pert`;

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function runJson(args, expectedStatus = 0, options = {}) {
  const result = run([...args, "--format=json"], options);
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.endsWith("\n"), true);
  const json = JSON.parse(result.stdout);
  assert.equal(json.cli_contract_version, 8);
  return json;
}

function acceptanceReadyAdvanceSource(text) {
  const migrated = planMilestoneAcceptanceMigration(text, {
    repositoryId: "e2e-test",
    repositoryRelativePath: "partial.pert",
    objectFormat: "sha1",
    headCommit: "a".repeat(40),
    headBlob: "b".repeat(40),
    stage0Blob: "b".repeat(40),
    sourceDigest: sha256DigestUtf8(text),
  });
  assert.equal(migrated.ok, true);
  let candidate = migrated.candidateText;
  const provisional = planMilestoneAcceptanceAdvance(candidate, {
    provisionalPlanner: (baseText) => planAdvance(baseText),
  });
  for (const [index, blocked] of provisional.acceptanceGuard?.blockedMilestones.entries() ?? []) {
    const setId = `ACCEPT_${blocked.milestoneId}_${index + 1}`;
    const criterionId = `ACCEPTED_${index + 1}`;
    const replacement = planCriterionSetReplacement(candidate, {
      milestoneId: blocked.milestoneId,
      setId,
      revisionId: "R1",
      criteria: [{
        criterionId,
        required: true,
        evidenceKind: "owner",
        description: "Accepted for end-to-end advance regression",
      }],
    });
    assert.equal(replacement.ok, true);
    const waived = planAcceptanceReceiptMutation(replacement.updatedText, {
      setId,
      criterionId,
      receiptId: `WAIVE_${blocked.milestoneId}_${index + 1}`,
      action: "waive",
      reason: "Accepted end-to-end advance regression fixture",
    });
    assert.equal(waived.ok, true);
    candidate = waived.updatedText;
  }
  return candidate;
}

function commitRepository(directory, relativePath) {
  for (const args of [
    ["init", "--quiet"],
    ["config", "user.name", "Perttool Test"],
    ["config", "user.email", "perttool@example.invalid"],
    ["add", "--", relativePath],
    ["commit", "--quiet", "-m", "baseline"],
  ]) {
    const result = spawnSync("git", ["-C", directory, ...args], {
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      `git ${args.join(" ")}\n${result.stderr}`,
    );
  }
}

test("E2E-001: discover commands, validate a plan, and compare capacity what-if", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /^perttool command catalog \(CLI Contract 8\)$/m);
  assert.match(help.stdout, /^  document  /m);
  assert.match(help.stdout, /^    check  /m);
  assert.match(help.stdout, /^  project  /m);
  assert.match(help.stdout, /^    init  /m);
  assert.match(help.stdout, /^  gate  /m);
  assert.match(help.stdout, /^    add  /m);
  assert.match(help.stdout, /^  batch  /m);
  assert.match(help.stdout, /^    apply  /m);

  const nextHelp = runJson(["guide", "next", "--level=detail"]);
  assert.equal(nextHelp.topic_id, "next");
  assert.ok(nextHelp.sections.some(({ id }) => id === "selection"));

  const source = fixture("capacity-what-if");
  const checked = runJson(["document", "check", source]);
  assert.equal(checked.ok, true);
  assert.equal(checked.document_id, "RELEASE_CAPACITY");

  const baseline = runJson(["dag", "analyze", source]);
  assert.equal(baseline.precedence.makespan.display, "5");
  assert.equal(baseline.resource.makespan.display, "8");

  const baselineNext = runJson(["dag", "next", source]);
  assert.deepEqual(baselineNext.groups.ready, ["API", "UI"]);
  assert.deepEqual(baselineNext.groups.runnable_now, ["API"]);
  const ui = baselineNext.tasks.find(({ id }) => id === "UI");
  assert.ok(ui);
  assert.deepEqual(ui.resource_rejections[0].earlier_selected_task_ids, ["API"]);

  const override = runJson(["dag", "analyze", source, "--capacity=ENGINEERS=2"]);
  assert.equal(override.precedence.makespan.display, "5");
  assert.equal(override.resource.makespan.display, "5");

  const overrideNext = runJson(["dag", "next", source, "--capacity=ENGINEERS=2"]);
  assert.deepEqual(overrideNext.groups.ready, ["API", "UI"]);
  assert.deepEqual(overrideNext.groups.runnable_now, ["API", "UI"]);
});

test("E2E-015: AI resolves provider guidance without reading a project document", () => {
  const guidance = runJson([
    "agent",
    "help",
    "grok",
    "workflow",
    "--level=detail",
  ]);
  assert.equal(guidance.schema_version, "Perttool.AgentGuidanceResult.v1");
  assert.equal(guidance.operation, "agent.help");
  assert.equal(guidance.query.canonical_provider_id, "grok-build");
  assert.equal(guidance.query.alias_applied, true);
  assert.equal(guidance.providers[0].surfaces[0].surface_id, "workflow");
  assert.ok(
    guidance.guidance_records.some(
      ({ guidance_id: id }) => id === "consult_dag_next_before_start",
    ),
  );
  assert.ok(
    Object.values(guidance.capabilities).every((value) => value === false),
  );
});

test("E2E-016: AI reads and updates velocity entirely through the CLI", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-project-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, "plan.pert");
  copyFileSync(path.join(root, "test/fixtures/grammar/all-fields.pert"), source);

  const before = runJson(["project", "show", source]);
  assert.equal(before.project.velocity, "10p/5d");
  const digest = before.source_digest;

  const written = runJson([
    "project",
    "set",
    source,
    "--velocity=12p/5d",
    "--as-of=2026-07-23",
    "--write",
    `--expect-digest=${digest}`,
  ]);
  assert.equal(written.operation, "project.set");
  assert.equal(written.write.mode, "in_place");
  assert.equal(written.write.written, true);

  const after = runJson(["project", "show", source]);
  assert.equal(after.project.velocity, "12p/5d");
  assert.deepEqual(after.project.as_of, {
    kind: "date",
    source_text: "2026-07-23",
    year: 2026,
    month: 7,
    day: 23,
  });
  assert.equal(after.source_digest, written.updated_digest);
});

test("E2E-002: active allocation blocks only tasks requiring the occupied resource", () => {
  const source = fixture("active-resource");
  assert.equal(runJson(["document", "check", source]).ok, true);

  const analyzed = runJson(["dag", "analyze", source]);
  assert.equal(analyzed.precedence.makespan.display, "3");
  assert.equal(analyzed.resource.makespan.display, "4");

  const next = runJson(["dag", "next", source]);
  assert.deepEqual(next.groups.active, ["MITIGATE"]);
  assert.deepEqual(next.groups.ready, ["STATUS_UPDATE", "RUNBOOK"]);
  assert.deepEqual(next.groups.runnable_now, ["STATUS_UPDATE"]);
  const runbook = next.tasks.find(({ id }) => id === "RUNBOOK");
  assert.ok(runbook);
  assert.deepEqual(runbook.resource_rejections[0].active_task_ids, ["MITIGATE"]);
});

test("E2E-003: external block is visible and can fail a strict automation run", () => {
  const source = fixture("blocked-approval");
  assert.equal(runJson(["document", "check", source]).ok, true);

  const analyzed = runJson(["dag", "analyze", source]);
  assert.equal(analyzed.ok, true);
  assert.equal(analyzed.resource.conditional_on_blocks_resolved, true);
  assert.ok(analyzed.diagnostics.some(({ code }) => code === "PTRES-303"));

  const next = runJson(["dag", "next", source]);
  assert.deepEqual(next.groups.ready, ["IMPLEMENT"]);
  assert.deepEqual(next.groups.runnable_now, ["IMPLEMENT"]);
  assert.deepEqual(next.groups.blocked_now, ["SECURITY_REVIEW"]);
  assert.deepEqual(next.groups.upcoming, ["RELEASE"]);

  const strict = run([
    "dag",
    "next",
    source,
    "--warnings-as-errors",
    "--color=never",
  ]);
  assert.equal(strict.status, 1);
  assert.equal(strict.stdout, "");
  assert.match(strict.stderr, /PTRES-303 warning:/);
});

test("E2E-004: recording completion recalculates the remaining frontier and duration", () => {
  const beforeSource = fixture("progress-before");
  const afterSource = fixture("progress-after");
  assert.equal(runJson(["document", "check", beforeSource]).ok, true);
  assert.equal(runJson(["document", "check", afterSource]).ok, true);

  const beforeAnalysis = runJson(["dag", "analyze", beforeSource]);
  const afterAnalysis = runJson(["dag", "analyze", afterSource]);
  assert.equal(beforeAnalysis.precedence.makespan.display, "5");
  assert.equal(afterAnalysis.precedence.makespan.display, "3");
  assert.ok(afterAnalysis.diagnostics.some(({ code }) => code === "PTDAG-208"));

  const beforeNext = runJson(["dag", "next", beforeSource]);
  const afterNext = runJson(["dag", "next", afterSource]);
  assert.deepEqual(beforeNext.groups.ready, ["DESIGN"]);
  assert.deepEqual(beforeNext.groups.upcoming, ["IMPLEMENT"]);
  assert.deepEqual(afterNext.groups.ready, ["IMPLEMENT"]);
  assert.deepEqual(afterNext.groups.upcoming, []);
  assert.equal(afterNext.tasks.some(({ id }) => id === "DESIGN"), false);
});

test("E2E-005: all read-only document commands reject an undefined resource", () => {
  const source = fixture("invalid-resource");
  for (const command of [
    ["document", "check", source],
    ["dag", "analyze", source],
    ["dag", "next", source],
    ["dag", "render", source, "--to=mermaid"],
  ]) {
    const result = runJson(command, 1);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some(({ code }) => code === "PTSEM-206"));
  }
});

test("E2E-006: AI can validate point estimates and consume explicit velocity forecasts", () => {
  const source = "docs/examples/point-velocity.pert";
  const checked = runJson(["document", "check", source]);
  assert.equal(checked.ok, true);

  const analyzed = runJson(["dag", "analyze", source]);
  assert.equal(analyzed.duration_unit, "point");
  assert.equal(analyzed.precedence.makespan.display, "10");
  assert.equal(analyzed.resource.makespan.display, "15");
  assert.equal(analyzed.velocity_forecast.precedence_makespan.display, "5");
  assert.equal(analyzed.velocity_forecast.resource_makespan.display, "7.5");

  const next = runJson(["dag", "next", source]);
  assert.deepEqual(next.groups.ready, ["IMPLEMENT", "DESIGN"]);
  assert.deepEqual(next.groups.runnable_now, ["IMPLEMENT"]);
  const implement = next.tasks.find(({ id }) => id === "IMPLEMENT");
  assert.equal(implement.expected.display, "10");
  assert.equal(implement.forecast_expected.display, "5");
});

test("E2E-007: multiple syntax errors recover without semantic cascades", () => {
  const source = "test/fixtures/invalid/multiple-syntax-errors.pert";
  for (const command of [
    ["document", "check", source],
    ["dag", "analyze", source],
    ["dag", "next", source],
    ["dag", "render", source, "--to=mermaid"],
  ]) {
    const result = runJson([...command, "--max-diagnostics=3"], 1);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics.length, 3);
    assert.equal(result.diagnostics_truncated, true);
    assert.deepEqual(result.diagnostics.map(({ code }) => code), [
      "PTDSL-006",
      "PTDSL-003",
      "PTDSL-012",
    ]);
    assert.equal(
      result.diagnostics.some(({ code }) => code.startsWith("PTSEM-") || code.startsWith("PTDAG-")),
      false,
    );
  }
});

test("E2E-008: mutation preview is valid for the next command and leaves the source unchanged", () => {
  const source = "docs/examples/minimal.pert";
  const before = readFileSync(path.join(root, source), "utf8");
  const preview = runJson([
    "task", "set", source, "WORK", "--title", "implemented", "--duration", "2d",
  ]);
  assert.equal(preview.operation, "task.set");
  assert.equal(preview.changed, true);
  assert.equal(preview.write.mode, "preview");
  assert.equal(preview.write.written, false);
  assert.match(preview.updated_text, /title "implemented"/);
  assert.match(preview.diff, /^--- docs\/examples\/minimal\.pert\n\+\+\+ candidate/m);

  const checked = runJson(["document", "check", "-"], 0, { input: preview.updated_text });
  assert.equal(checked.ok, true);
  assert.equal(checked.document_id, "MINIMAL");
  assert.equal(readFileSync(path.join(root, source), "utf8"), before);
});

test("E2E-009: atomic batch replaces a path and feeds analysis without intermediate writes", () => {
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
        task: { title: "second", duration: "2d" },
      },
      {
        kind: "gate.add", id: "APPROVAL", from: "MID", to: "DONE",
        gate: { reason: "approval required" },
      },
    ],
  };
  const preview = runJson([
    "batch", "apply", "docs/examples/minimal.pert", "--request", "-",
  ], 0, { input: JSON.stringify(request) });
  assert.equal(preview.ok, true);
  assert.match(preview.updated_text, /task FIRST NOW -> MID:/);
  assert.match(preview.updated_text, /task SECOND MID -> DONE:/);
  assert.match(preview.updated_text, /gate APPROVAL MID -> DONE:/);

  const analyzed = runJson(["dag", "analyze", "-"], 0, { input: preview.updated_text });
  assert.equal(analyzed.ok, true);
  assert.equal(analyzed.precedence.makespan.display, "3");
});

test("E2E-010: formatter preview feeds validation and leaves the source unchanged", () => {
  const source = "test/fixtures/grammar/formatter-roundtrip.pert";
  const expected = readFileSync(
    path.join(root, "test/golden/grammar/formatter-roundtrip.expected.pert"),
    "utf8",
  );
  const before = readFileSync(path.join(root, source), "utf8");
  const preview = runJson(["document", "format", source]);
  assert.equal(preview.operation, "document.format");
  assert.equal(preview.changed, true);
  assert.equal(preview.updated_text, expected);
  assert.deepEqual(preview.write, { mode: "preview", target: null, written: false });

  const checked = runJson(["document", "check", "-"], 0, { input: preview.updated_text });
  assert.equal(checked.document_id, "FORMATTER_ROUNDTRIP");
  const stable = run(["document", "format", "-", "--check"], { input: preview.updated_text });
  assert.equal(stable.status, 0, stable.stderr);
  assert.equal(stable.stdout, "");
  assert.equal(readFileSync(path.join(root, source), "utf8"), before);
});

test("E2E-011: safe writes on temporary copies feed check, analyze, and next", (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-safe-write-e2e-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const grammarOriginal = readFileSync(path.join(root, "plans/grammar.pert"), "utf8");
  const grammarCopy = path.join(directory, "grammar.pert");
  writeFileSync(
    grammarCopy,
    grammarOriginal.replace("project GRAMMAR:", "project   GRAMMAR:"),
    "utf8",
  );
  const formatted = runJson(["document", "format", grammarCopy, "--write"]);
  assert.equal(formatted.changed, true);
  assert.equal(formatted.write.mode, "in_place");
  assert.equal(formatted.write.written, true);
  assert.equal(readFileSync(grammarCopy, "utf8"), grammarOriginal);
  assert.equal(runJson(["document", "check", grammarCopy]).ok, true);
  assert.equal(runJson(["dag", "analyze", grammarCopy]).ok, true);
  assert.equal(runJson(["dag", "next", grammarCopy]).ok, true);

  const mutationCopy = path.join(directory, "minimal.pert");
  copyFileSync(path.join(root, "docs/examples/minimal.pert"), mutationCopy);
  const mutated = runJson([
    "task", "set", mutationCopy, "WORK", "--title", "implemented", "--write",
  ]);
  assert.equal(mutated.write.mode, "in_place");
  assert.equal(mutated.write.written, true);
  assert.equal(runJson(["document", "check", mutationCopy]).ok, true);
  assert.equal(runJson(["dag", "analyze", mutationCopy]).ok, true);
  assert.deepEqual(runJson(["dag", "next", mutationCopy]).groups.ready, ["WORK"]);
});

test("E2E-012: Mermaid export preserves semantics and analysis context", (t) => {
  const help = runJson(["guide", "mermaid", "--level=detail"]);
  assert.match(help.summary, /dag render/);
  assert.ok(help.syntax.some((line) => line.includes("--to mermaid")));

  const source = "docs/examples/parallel.pert";
  const preview = runJson([
    "dag", "render", source, "--to=mermaid", "--analysis=both",
    "--capacity=TEST_ENV=2",
  ]);
  assert.equal(preview.ok, true);
  assert.equal(preview.profile, "perttool");
  assert.equal(preview.loss_report.lossless, true);
  assert.match(preview.artifact, /%% perttool:profile/);
  assert.match(preview.artifact, /"capacity_overrides":\[\{"resource_id":"TEST_ENV","capacity":2\}\]/);
  assert.match(preview.artifact, /%% perttool:resource \{"id":"TEST_ENV"[^\n]*"capacity":1/);
  assert.match(preview.artifact, /CORE: .* \/ CP \/ S=0-4d/);

  const directory = mkdtempSync(path.join(tmpdir(), "perttool-mermaid-e2e-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "parallel.mmd");
  const written = runJson([
    "dag", "render", source, "--to=mermaid", "--analysis=both",
    "--capacity=TEST_ENV=2", "--out", output,
  ]);
  assert.equal(written.write.written, true);
  assert.equal(readFileSync(output, "utf8"), preview.artifact);

  const strictPlain = runJson([
    "dag", "render", source, "--to=mermaid", "--profile=plain", "--strict-loss",
  ], 4);
  assert.equal(strictPlain.artifact, null);
  assert.deepEqual(strictPlain.loss_report.records.map(({ code }) => code), ["PTCNV-206"]);
});

test("E2E-013: advance preview and safe write preserve a partial join", (t) => {
  const source = "docs/examples/advance-partial-before.pert";
  const beforeText = readFileSync(path.join(root, source), "utf8");
  const acceptedText = acceptanceReadyAdvanceSource(beforeText);
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-advance-e2e-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const copy = path.join(directory, "partial.pert");
  writeFileSync(copy, acceptedText, "utf8");
  const beforeNext = runJson(["dag", "next", copy]);
  const preview = runJson(["dag", "advance", copy]);
  assert.equal(preview.changed, true);
  assert.deepEqual(preview.advance.removed_task_ids, ["BRANCH_A"]);
  assert.deepEqual(preview.advance.frontier_before, ["A_DONE", "NOW"]);
  assert.deepEqual(preview.advance.frontier_after, ["A_DONE", "NOW"]);
  assert.equal(readFileSync(path.join(root, source), "utf8"), beforeText);

  assert.equal(runJson(["document", "check", "-"], 0, { input: preview.updated_text }).ok, true);
  assert.equal(runJson(["dag", "analyze", "-"], 0, { input: preview.updated_text }).ok, true);
  const afterNext = runJson(["dag", "next", "-"], 0, { input: preview.updated_text });
  assert.deepEqual(afterNext.groups, beforeNext.groups);

  commitRepository(directory, "partial.pert");
  const digest = runJson(["document", "check", copy]).source_digest;
  const written = runJson([
    "dag", "advance", copy, "--write", "--expect-digest", digest,
    "--actor", "user",
  ]);
  assert.equal(written.write.written, true);
  assert.equal(readFileSync(copy, "utf8"), preview.updated_text);
  assert.equal(runJson(["document", "check", copy]).ok, true);
  assert.deepEqual(runJson(["dag", "next", copy]).groups, beforeNext.groups);

  const repeated = runJson(["dag", "advance", copy, "--write"]);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.diff, "");
  assert.equal(repeated.write.written, false);
});

test("E2E-014: lossless Mermaid profile round-trips and plain import stays explicit", (t) => {
  const source = "docs/examples/parallel.pert";
  const rendered = runJson([
    "dag", "render", source, "--to=mermaid", "--analysis=both",
    "--capacity=TEST_ENV=2",
  ]);
  const imported = runJson([
    "dag", "import", "-", "--from=mermaid",
  ], 0, { input: rendered.artifact });
  assert.equal(imported.profile, "perttool");
  assert.equal(imported.loss_report.lossless, true);
  assert.deepEqual(imported.generated_ids, []);
  assert.equal(runJson(["document", "check", "-"], 0, { input: imported.artifact }).ok, true);
  assert.equal(runJson([
    "dag", "render", "-", "--to=mermaid", "--analysis=both",
    "--capacity=TEST_ENV=2",
  ], 0, { input: imported.artifact }).artifact, rendered.artifact);

  const directory = mkdtempSync(path.join(tmpdir(), "perttool-mermaid-import-e2e-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "parallel.pert");
  const written = runJson([
    "dag", "import", "-", "--from=mermaid", "--out", output,
  ], 0, { input: rendered.artifact });
  assert.equal(written.write.written, true);
  assert.equal(readFileSync(output, "utf8"), imported.artifact);
  assert.equal(runJson(["dag", "analyze", output]).ok, true);

  const corrupted = runJson([
    "dag", "import", "-", "--from=mermaid",
  ], 1, { input: rendered.artifact.replace("ptm_NOW -->", "ptm_RELEASED -->") });
  assert.equal(corrupted.artifact, null);
  assert.equal(corrupted.diagnostics[0].code, "PTCNV-105");

  const plain = runJson([
    "dag", "render", source, "--to=mermaid", "--profile=plain",
  ]);
  const strict = runJson([
    "dag", "import", "-", "--from=mermaid", "--strict-loss",
  ], 4, { input: plain.artifact });
  assert.equal(strict.artifact, null);
  assert.equal(strict.loss_report.lossless, false);
});

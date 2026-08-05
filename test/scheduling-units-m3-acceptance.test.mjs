import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  analyzeTargetTemporalDocument,
  selectTargetTemporalTasks,
} from "../dist/application/target-temporal-analysis.js";
import { CONTRACT4_COMMAND_REGISTRY } from "../dist/command/discovery.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const fixtureDirectory = path.join(testDirectory, "fixtures", "temporal-units");

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

function contiguousIds(prefix) {
  return Array.from(
    { length: 20 },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function targetAnalyze(source) {
  return analyzeTargetTemporalDocument(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
}

function targetNext(source) {
  return selectTargetTemporalTasks(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("SU-M3 acceptance traces every interface and example observation", async () => {
  const [acceptance, baselineText] = await Promise.all([
    repositoryFile("docs/process/scheduling-units-m3-acceptance.md"),
    repositoryFile("test/fixtures/temporal-units/cases.json"),
  ]);
  const baseline = JSON.parse(baselineText);

  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(acceptance, /no open SU-M3 acceptance findings/);
  assert.match(
    acceptance,
    /No Git push, GitHub release, npm publication, dist-tag change, or Contract 4\s+activation is authorized/,
  );

  const tuiIds = [...acceptance.matchAll(/^\| `(TUI-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  const tueIds = [...acceptance.matchAll(/^\| `(TUE-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(tuiIds, contiguousIds("TUI"));
  assert.deepEqual(tueIds, contiguousIds("TUE"));
  assert.deepEqual(
    baseline.cases.map(({ case_id: caseId }) => caseId),
    contiguousIds("TUE"),
  );

  for (const evidence of [
    "test/calendar-arithmetic.test.mjs",
    "test/temporal-input-projection.test.mjs",
    "test/temporal-precedence-schedule.test.mjs",
    "test/temporal-resource-schedule.test.mjs",
    "test/temporal-deadline-evaluation.test.mjs",
    "test/target-temporal-analysis.test.mjs",
    "test/temporal-unit-examples.test.mjs",
    "scripts/check-package.sh",
  ]) {
    assert.ok(acceptance.includes(evidence), evidence);
  }
});

test("TUE-004 through TUE-011 compose exact temporal evidence and authority", async () => {
  const leap = targetNext(await fixture("calendar-date-v2.pert"));
  assert.equal(leap.ok, true);
  assert.equal(leap.schemaVersion, "Perttool.NextResult.v4");
  assert.deepEqual(leap.groups.ready, ["LEAP_WINDOW"]);
  assert.deepEqual(leap.groups.runnableNow, []);
  assert.deepEqual(leap.recommendation.recommendedTaskIds, ["LEAP_WINDOW"]);
  assert.deepEqual(leap.temporal.authority.delayedRecommendedTaskIds, [
    "LEAP_WINDOW",
  ]);
  assert.equal(leap.temporal.authority.deadlineFactsUsedForRanking, false);

  const equalOffset = targetNext(await fixture("calendar-offset-v2.pert"));
  assert.deepEqual(equalOffset.groups.runnableNow, ["OFFSET_EQUAL"]);
  assert.deepEqual(
    equalOffset.temporal.authority.startableRecommendedTaskIds,
    ["OFFSET_EQUAL"],
  );

  const mixed = targetNext(await fixture("mixed-kind-v2.pert"));
  assert.deepEqual(mixed.groups.ready, ["FUTURE_CLOCK"]);
  assert.deepEqual(mixed.groups.runnableNow, []);
  assert.deepEqual(
    mixed.temporal.authority.unavailableRecommendedTaskIds,
    ["FUTURE_CLOCK"],
  );

  const risk = targetNext(await fixture("deadline-resource-v2.pert"));
  assert.deepEqual(risk.recommendation.recommendedTaskIds, ["RESOURCE_FIRST"]);
  const deadlineTask = risk.temporal.tasks.find(
    ({ taskId }) => taskId === "DEADLINE_TASK",
  );
  assert.equal(deadlineTask.taskDeadlineEvaluation.combinedAssessment, "at_risk");
  assert.equal(risk.temporal.authority.deadlineFactsUsedForRanking, false);

  const blocked = targetAnalyze(await fixture("deadline-blocked-v2.pert"));
  assert.equal(blocked.ok, true);
  assert.ok(
    blocked.temporal.deadlineEvaluations.every(
      ({ conditionalOnBlocksResolved }) => conditionalOnBlocksResolved,
    ),
  );

  const complete = targetAnalyze(await fixture("deadline-complete-v2.pert"));
  assert.deepEqual(
    complete.temporal.deadlineEvaluations.map(({ completionState }) =>
      completionState
    ),
    [
      "complete_actual_time_unavailable",
      "complete_actual_time_unavailable",
    ],
  );
});

test("Grammar 3 exact fractions and malformed input preserve the target boundary", () => {
  const exactSource = `project M3_EXACT:
  version 3
  title "exact"
  as_of 2026-07-25T09:00:00Z
  duration_unit hour
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration 1/3h
  deadline 2026-07-25T10:00:00Z
`;
  const exact = targetAnalyze(exactSource);
  assert.equal(exact.ok, true);
  assert.equal(exact.schemaVersion, "Perttool.AnalysisResult.v3");
  assert.equal(exact.base.precedence.makespan.numerator, 1n);
  assert.equal(exact.base.precedence.makespan.denominator, 3n);
  assert.equal(
    exact.temporal.precedence.tasks[0].finish.calendar.sourceText,
    "2026-07-25T09:20:00Z",
  );
  const publicExact = publicApi.analyzeDocument(exactSource);
  assert.equal(publicExact.ok, true);
  assert.equal(publicExact.schemaVersion, "Perttool.AnalysisResult.v5");

  const malformed = targetAnalyze(
    exactSource.replace("duration 1/3h", "duration 1/0h"),
  );
  assert.equal(malformed.ok, false);
  assert.equal(malformed.base, null);
  assert.equal(malformed.temporal, null);
  assert.equal(
    malformed.diagnostics.some(({ code }) => code === "PTDSL-007"),
    true,
  );
});

test("target Analysis v3 and Next v4 are deterministic and retain Recommendation v1", async () => {
  const source = await repositoryFile("docs/examples/parallel.pert");
  const active = publicApi.selectNextTasks(source);
  const firstAnalysis = targetAnalyze(source);
  const secondAnalysis = targetAnalyze(source);
  const firstNext = targetNext(source);
  const secondNext = targetNext(source);

  assert.deepEqual(secondAnalysis, firstAnalysis);
  assert.deepEqual(secondNext, firstNext);
  assert.deepEqual(firstNext.recommendation, active.recommendation);
  assert.deepEqual(firstNext.tasks, active.tasks);
  assert.deepEqual(firstNext.groups.ready, active.groups.ready);
  assert.equal(firstNext.recommendation.explanationStatus.complete, true);
  assert.equal(firstNext.recommendation.explanationStatus.truncated, false);
  assert.equal(firstNext.temporal.authority.deadlineFactsUsedForRanking, false);
});

test("active package root keeps temporal helpers internal while CLI uses Contract 7", async () => {
  for (const targetName of [
    "TARGET_GRAMMAR_3_CAPABILITY",
    "prepareTargetTemporalInputs",
    "projectTargetTemporalInputs",
    "analyzeTemporalPrecedenceSchedule",
    "analyzeTemporalResourceSchedule",
    "evaluateTemporalDeadlines",
    "analyzeTargetTemporalDocument",
    "selectTargetTemporalTasks",
    "selectNextTasksFromAnalysis",
  ]) {
    assert.equal(targetName in publicApi, false, targetName);
  }

  const manifest = JSON.parse(await repositoryFile("package.json"));
  assert.deepEqual(Object.keys(manifest.exports), [
    ".",
    "./core",
    "./node",
    "./schemas/*",
  ]);
  assert.equal(CONTRACT4_COMMAND_REGISTRY.length, 28);
  assert.ok(
    CONTRACT4_COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 4,
    ),
  );

  const help = runCli(["help", "--format=json"]);
  const guide = runCli(["guide", "--format=json"]);
  assert.equal(help.status, 0, help.stderr);
  assert.equal(guide.status, 0, guide.stderr);
  for (const serialized of [help.stdout, guide.stdout]) {
    assert.equal(serialized.includes("NextResult.v6"), true);
  }
  assert.equal(help.stdout.includes("Perttool.AnalysisResult.v5"), true);
  assert.equal(help.stdout.includes('"not-before"'), true);
  assert.equal(help.stdout.includes('"deadline"'), true);
  assert.equal(JSON.parse(help.stdout).cli_contract_version, 7);
  assert.equal(JSON.parse(guide.stdout).cli_contract_version, 7);

  const targetFixture = path.join(
    fixtureDirectory,
    "calendar-offset-v2.pert",
  );
  for (const [route, schemaVersion] of [
    [["document", "check"], "Perttool.CheckResult.v4"],
    [["project", "show"], "Perttool.ProjectResult.v4"],
    [["dag", "analyze"], "Perttool.AnalysisResult.v5"],
    [["dag", "next"], "Perttool.NextResult.v6"],
  ]) {
    const accepted = runCli([...route, targetFixture, "--format=json"]);
    assert.equal(accepted.status, 0);
    assert.equal(accepted.stderr, "");
    const result = JSON.parse(accepted.stdout);
    assert.equal(result.schema_version, schemaVersion);
    assert.equal(result.cli_contract_version, 7);
    assert.equal(result.ok, true);
    assert.equal(result.grammar_version, 2);
  }
});

test("the SU-M5 handoff keeps atomic activation and release separately gated", async () => {
  const acceptance = await repositoryFile(
    "docs/process/scheduling-units-m3-acceptance.md",
  );
  assert.match(
    acceptance,
    /SU-M5 may expose the accepted temporal target Core only as part of the atomic\s+Contract 4 cutover/,
  );
  assert.match(
    acceptance,
    /activate Grammar 3, target Check\/Project results,\s+AnalysisResult v3, NextResult v4, the release-gated normal authority/,
  );
  assert.match(
    acceptance,
    /SU-M5 must not publish only a temporal schema, only a migration command, or a\s+partial authority switch/,
  );
});

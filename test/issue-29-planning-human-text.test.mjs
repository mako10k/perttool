import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { renderPlanningHistoricalObservationText } from "../dist/planning-pool/human.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const fixture = path.join(root, "test", "fixtures", "issue-29-planning-human.pert");
const workObservation = path.join(root, "test", "fixtures", "issue-29-work-observation.json");
const windowObservation = path.join(root, "test", "fixtures", "issue-29-window-observation.json");
const updateIntent = path.join(root, "test", "fixtures", "issue-29-update-work-intent.json");
const staleIntent = path.join(root, "test", "fixtures", "issue-29-stale-intent.json");
const goldenRoot = path.join(root, "test", "golden", "planning-pool-human");

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, TMPDIR: "/tmp", TMP: "/tmp", TEMP: "/tmp" },
  });
  assert.equal(result.status, expectedStatus, result.stderr);
  return result;
}

function text(args) {
  return run(args).stdout;
}

function json(args) {
  return JSON.parse(run([...args, "--format", "json"]).stdout);
}

function golden(name) {
  return readFileSync(path.join(goldenRoot, name), "utf8");
}

function normalizePreflight(value) {
  return value
    .replace(/^Preflight token: .+$/mu, "Preflight token: <TOKEN>")
    .replace(/^Expires at: .+$/mu, "Expires at: <EXPIRES>");
}

test("Issue #29 keeps list compact and gives Work and Window show stable semantic text", () => {
  assert.equal(
    text(["work", "list", fixture]),
    "POOL::W1\tShape reviewed outcome\nPOOL::W2\tPrepare shared input\n",
  );
  assert.equal(
    text(["window", "list", fixture]),
    "POOL::SPRINT\tCurrent sprint\tProduce one reviewed user-visible outcome\n",
  );

  const workText = text(["work", "show", fixture, "W1"]);
  const workJson = json(["work", "show", fixture, "W1"]);
  assert.equal(workText, golden("work-show.expected.txt"));
  assert.equal(workJson.works[0].description.value, "Retain user-visible outcome");
  assert.deepEqual(workJson.windows.map(({ qualified_id }) => qualified_id), ["POOL::SPRINT"]);
  for (const fact of [
    workJson.works[0].qualified_id,
    workJson.works[0].events[0].qualified_id,
    workJson.works[0].activities[0].qualified_id,
    workJson.works[0].milestone_links[0].qualified_id,
    workJson.works[0].task_links[0].qualified_id,
    workJson.works[0].depends_on[0].qualified_id,
    workJson.windows[0].qualified_id,
  ]) assert.match(workText, new RegExp(fact.replaceAll("::", "::"), "u"));
  assert.doesNotMatch(workText, /(?:span|offset|column)[=:]/iu);

  const windowText = text(["window", "show", fixture, "SPRINT"]);
  const windowJson = json(["window", "show", fixture, "SPRINT"]);
  assert.equal(windowText, golden("window-show.expected.txt"));
  assert.match(windowText, new RegExp(windowJson.windows[0].objective, "u"));
  assert.match(windowText, /Start: 2026-08-25/u);
  assert.match(windowText, /End: 2026-09-01/u);
  assert.match(windowText, /POOL::W1  global_order=1/u);
  assert.doesNotMatch(windowText, /(?:span|offset|column)[=:]/iu);
});

test("Issue #29 renders current Work and Window observations by independent axes with JSON parity", () => {
  const cases = [
    {
      resource: "work",
      request: workObservation,
      golden: "work-observe.expected.txt",
    },
    {
      resource: "window",
      request: windowObservation,
      golden: "window-observe.expected.txt",
    },
  ];
  for (const item of cases) {
    const args = [item.resource, "observe", fixture, "--request", item.request];
    const rendered = text(args);
    const machine = json(args);
    assert.equal(rendered, golden(item.golden));
    for (const heading of [
      "REFINEMENT", "EXECUTION", "OUTCOME", "ORGANIZATION", "TEMPORAL", "GLOBAL EXECUTION",
    ]) assert.match(rendered, new RegExp(`^${heading}$`, "mu"));
    assert.match(rendered, new RegExp(machine.works[0].work_id, "u"));
    assert.match(rendered, new RegExp(machine.works[0].execution.tasks[0].task_id, "u"));
    assert.match(rendered, new RegExp(machine.works[0].outcome.milestones[0].milestone_id, "u"));
    assert.match(rendered, new RegExp(machine.global_execution.recommended_task_ids[0], "u"));
    assert.doesNotMatch(rendered, /(?:span|offset|column)[=:]/iu);
  }
});

test("Issue #29 renders historical observation as stable axis summaries instead of raw JSON", () => {
  const result = {
    documentId: "POOL",
    sourceDigest: "sha256:current",
    evidence: {
      state: "incomplete",
      ancestryProfile: "first_parent",
      resolvedEndpoint: "abc123",
      continuityQualified: false,
    },
    axisStates: {
      refinement: "complete",
      execution: "unknown",
      outcome: "unknown",
      organization: "complete",
      temporal: "unavailable",
      closeDisposition: "unknown",
    },
    current: { state: "observed" },
    snapshots: [{}, {}],
    lineage: {
      workOccurrences: [{}],
      windowOccurrences: [{}],
      relationOccurrences: [{}, {}],
      gaps: [{}],
    },
    diagnostics: [{
      code: "PTPOOL-209",
      severity: "warning",
      message: "Historical temporal evidence is unavailable.",
    }],
  };
  const rendered = renderPlanningHistoricalObservationText("work.observe", result);
  assert.equal(rendered, golden("work-observe-history.expected.txt"));
  for (const heading of [
    "REFINEMENT", "EXECUTION", "OUTCOME", "ORGANIZATION", "TEMPORAL", "GLOBAL EXECUTION", "HISTORY",
  ]) assert.match(rendered, new RegExp(`^${heading}$`, "mu"));
  assert.doesNotMatch(rendered, /^\s*[{}\[\]"]|"(?:axisStates|snapshots|lineage)"/mu);
});

test("Issue #29 renders reshape preflight binding, meaning, authority, token, diagnostics, and next action", () => {
  const args = [
    "work", "reshape", "preflight", fixture, "--intent-request", updateIntent,
  ];
  const rendered = text(args);
  const machine = json(args);
  assert.equal(normalizePreflight(rendered), golden("reshape-preflight.expected.txt"));
  assert.match(rendered, new RegExp(machine.source_digest, "u"));
  assert.match(rendered, new RegExp(machine.candidate_digest, "u"));
  assert.match(rendered, new RegExp(machine.preflight_hash, "u"));
  assert.match(rendered, /^Preflight token: \S+$/mu);
  assert.match(rendered, /^Expires at: \S+$/mu);
  assert.match(rendered, /Before:[\s\S]*Retain user-visible outcome/u);
  assert.match(rendered, /After:[\s\S]*Retain reviewed user-visible outcome/u);
  assert.match(rendered, /^AUTHORITY$/mu);
  assert.match(rendered, /^NEXT ACTION$/mu);
  assert.doesNotMatch(rendered, /candidateText|candidate_text|startOffset|source span/iu);

  const blocked = run([
    "work", "reshape", "preflight", fixture, "--intent-request", staleIntent,
  ], 1).stdout;
  assert.match(blocked, /^Status: blocked$/mu);
  assert.match(blocked, /PTPOOL-111 error: Planning reshape source_digest does not match current raw source/u);
  assert.match(blocked, /^Preflight token: \(none\)$/mu);
  assert.match(blocked, /Correct the reported diagnostics and rerun preflight\./u);
});

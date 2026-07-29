import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as perttool from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

test("Contract 6 public Core retains Grammar 3 without target capability exports", async () => {
  const text = await fixture("migration-nonrepresentable-v2.pert");
  const parsed = perttool.parseDocument(text);
  const diagnostics = perttool.validateDocument(
    parsed.document,
    parsed.diagnostics,
  );
  assert.deepEqual(diagnostics, []);

  const checked = perttool.checkDocument(text);
  assert.equal(checked.ok, true);
  assert.equal(checked.grammarVersion, 2);
  assert.notEqual(checked.temporalInputs, null);

  for (const name of [
    "TARGET_GRAMMAR_3_CAPABILITY",
    "parseTargetGrammar3Document",
    "validateTargetGrammar3Document",
    "analyzeTargetTemporalDocument",
    "selectTargetTemporalTasks",
  ]) {
    assert.equal(name in perttool, false, name);
  }
});

test("Contract 6 public results retain typed temporal and release-gated views", async () => {
  const text = await fixture("calendar-date-v2.pert");
  const project = perttool.getProjectMetadata(text);
  assert.equal(project.ok, true);
  assert.equal(project.project.asOf.kind, "date");
  assert.equal(project.project.finishDeadline.kind, "date");

  const analysis = perttool.analyzeDocument(text);
  assert.equal(analysis.schemaVersion, "Perttool.AnalysisResult.v4");
  assert.equal(analysis.ok, true);
  assert.equal(analysis.temporal.precedence.state, "available");
  assert.equal(analysis.precedence.makespan.numerator, 2n);

  const next = perttool.selectNextTasks(text);
  assert.equal(next.schemaVersion, "Perttool.NextResult.v5");
  assert.deepEqual(next.recommendation.recommendedTaskIds, ["LEAP_WINDOW"]);
  assert.deepEqual(next.groups.runnableNow, []);
  assert.deepEqual(
    next.temporal.authority.delayedRecommendedTaskIds,
    ["LEAP_WINDOW"],
  );
});

test("Contract 6 public formatting and mutation preserve exact temporal source", () => {
  const text = `project PUBLIC_CORE:
  version 3
  title "public core"
  as_of 2026-07-26
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration 2/6d
`;
  const formatted = perttool.formatDocument(text);
  assert.equal(formatted.ok, true);
  assert.match(formatted.formattedText, /duration 1\/3d/);

  const mutated = perttool.planMutation(formatted.formattedText, {
    kind: "batch",
    mutations: [
      {
        kind: "task.set",
        id: "WORK",
        set: {
          notBefore: "2026-07-27",
          deadline: "2026-07-28",
        },
      },
      {
        kind: "milestone.set",
        id: "FINISH",
        set: { deadline: "2026-07-29" },
      },
    ],
  });
  assert.equal(mutated.ok, true);
  assert.match(mutated.updatedText, /not_before 2026-07-27/);
  assert.match(mutated.updatedText, /deadline 2026-07-28/);
  assert.match(mutated.updatedText, /deadline 2026-07-29/);
  assert.equal(perttool.checkDocument(mutated.updatedText).ok, true);
});

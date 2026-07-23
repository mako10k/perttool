import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  checkDocument,
  getProjectMetadata,
  planMutation,
} from "../dist/index.js";

const allFields = await readFile("test/fixtures/grammar/all-fields.pert", "utf8");

const dayPlan = [
  "project UNIT_CHANGE:",
  "  version 1",
  "  title \"unit change\"",
  "  duration_unit day",
  "  finish DONE",
  "",
  "milestone NOW:",
  "  title \"now\"",
  "  state reached",
  "",
  "milestone DONE:",
  "  title \"done\"",
  "",
  "task WORK NOW -> DONE:",
  "  title \"work\"",
  "  duration 1d",
  "",
].join("\n");

test("project metadata exposes every project field without source inspection", () => {
  const result = getProjectMetadata(allFields);
  assert.equal(result.ok, true);
  assert.equal(result.documentId, "ALL_FIELDS");
  assert.equal(result.grammarVersion, 1);
  assert.deepEqual(result.project, {
    id: "ALL_FIELDS",
    version: 1,
    title: "all declaration fields",
    description: "project description",
    asOf: "2026-07-21T20:00:00+09:00",
    durationUnit: "point",
    velocity: "10p/5d",
    finish: "DONE",
    criticalEpsilon: "0p",
    targetDuration: "20p",
  });

  const invalid = getProjectMetadata("project BROKEN:\n  title \"broken\"\n");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.project, null);
  assert.equal(invalid.grammarVersion, null);
});

test("project set updates and clears project fields with local edits", () => {
  const input = allFields.replace(
    "  description \"project description\"",
    "  # project context\n  description \"project description\"",
  );
  const updated = planMutation(input, {
    kind: "project.set",
    set: {
      id: "UPDATED_PROJECT",
      version: 1,
      title: "updated project",
      description: "first\nsecond",
      asOf: "2026-07-23",
      durationUnit: "point",
      velocity: "12p/5d",
      finish: "DONE",
      criticalEpsilon: "1p",
      targetDuration: "25p",
    },
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.changed, true);
  assert.match(updated.updatedText, /^project UPDATED_PROJECT:/);
  assert.match(updated.updatedText, /  # project context\n  description \|\n    first\n    second\n/);
  assert.match(updated.updatedText, /  velocity 12p\/5d/);
  assert.match(updated.updatedText, /  critical_epsilon 1p/);
  assert.equal(checkDocument(updated.updatedText).ok, true);

  const cleared = planMutation(updated.updatedText, {
    kind: "project.set",
    clear: [
      "description",
      "as_of",
      "velocity",
      "critical_epsilon",
      "target_duration",
    ],
  });
  assert.equal(cleared.ok, false);
  assert.equal(cleared.updatedText, null);
  assert.ok(cleared.diagnostics.some(({ code }) => code === "PTSEM-111"));

  const clearDayOptionals = planMutation(dayPlan.replace(
    "  duration_unit day",
    [
      "  description \"optional\"",
      "  as_of 2026-07-23",
      "  duration_unit day",
      "  velocity 10p/1d",
      "  critical_epsilon 0d",
      "  target_duration 2d",
    ].join("\n"),
  ), {
    kind: "project.set",
    clear: [
      "description",
      "as_of",
      "velocity",
      "critical_epsilon",
      "target_duration",
    ],
  });
  assert.equal(clearDayOptionals.ok, true);
  assert.doesNotMatch(
    clearDayOptionals.updatedText,
    /description|as_of|velocity|critical_epsilon|target_duration/,
  );
});

test("project set rejects invalid candidates and no-op requests deterministically", () => {
  const invalidUnit = planMutation(dayPlan, {
    kind: "project.set",
    set: { durationUnit: "point", velocity: "10p/1d" },
  });
  assert.equal(invalidUnit.ok, false);
  assert.equal(invalidUnit.updatedText, null);
  assert.deepEqual(invalidUnit.edits, []);
  assert.ok(invalidUnit.diagnostics.some(({ code }) => code === "PTSEM-105"));

  const noOp = planMutation(dayPlan, {
    kind: "project.set",
    set: {
      id: "UNIT_CHANGE",
      version: 1,
      title: "unit change",
      durationUnit: "day",
      finish: "DONE",
    },
  });
  assert.equal(noOp.ok, true);
  assert.equal(noOp.changed, false);
  assert.deepEqual(noOp.edits, []);
});

test("atomic batch can change project-wide unit with dependent task fields", () => {
  const result = planMutation(dayPlan, {
    kind: "batch",
    mutations: [
      {
        kind: "project.set",
        set: {
          durationUnit: "point",
          velocity: "10p/1d",
        },
      },
      {
        kind: "task.set",
        id: "WORK",
        set: { duration: "10p" },
      },
    ],
  });
  assert.equal(result.ok, true);
  assert.match(result.updatedText, /duration_unit point/);
  assert.match(result.updatedText, /velocity 10p\/1d/);
  assert.match(result.updatedText, /duration 10p/);
  assert.equal(getProjectMetadata(result.updatedText).project.durationUnit, "point");

  const duplicate = planMutation(dayPlan, {
    kind: "batch",
    mutations: [
      { kind: "project.set", set: { title: "one" } },
      { kind: "project.set", set: { title: "two" } },
    ],
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.diagnostics.at(-1).code, "PTMUT-301");
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  checkTargetDocument,
} from "../dist/application/target-check.js";
import {
  getTargetProjectMetadata,
} from "../dist/application/target-project.js";
import {
  TARGET_GRAMMAR_2_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

function date(sourceText, year, month, day) {
  return {
    kind: "date",
    sourceText,
    year,
    month,
    day,
  };
}

function dateTime(
  sourceText,
  year,
  month,
  day,
  hour,
  minute,
  numerator,
  denominator,
  offsetMinutes,
) {
  return {
    kind: "date_time",
    sourceText,
    year,
    month,
    day,
    hour,
    minute,
    second: { numerator, denominator },
    offsetMinutes,
  };
}

test("target declared-input Core is capability-checked and remains internal", () => {
  assert.equal("checkTargetDocument" in publicApi, false);
  assert.equal("getTargetProjectMetadata" in publicApi, false);
  assert.throws(
    () => checkTargetDocument("", {
      id: "perttool.target-grammar-2-source",
      version: 1,
      grammarVersion: 2,
    }),
    /target Grammar 2 source capability is required/,
  );
  assert.throws(
    () => getTargetProjectMetadata("", {
      id: "perttool.target-grammar-2-source",
      version: 1,
      grammarVersion: 2,
    }),
    /target Grammar 2 source capability is required/,
  );
});

test("TUI-004 projects exact declared inputs and finish deadline", async () => {
  const text = await readFile(
    path.join(fixtureDirectory, "calendar-offset-v2.pert"),
    "utf8",
  );
  const checked = checkTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.equal(checked.documentId, "CALENDAR_OFFSET");
  assert.equal(checked.grammarVersion, 2);
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.summary, {
    resources: 0,
    milestones: 2,
    tasks: 1,
    gates: 0,
    errors: 0,
    warnings: 0,
  });
  assert.deepEqual(checked.temporalInputs, {
    anchor: dateTime(
      "2026-07-25T09:00:00+09:00",
      2026,
      7,
      25,
      9,
      0,
      "0",
      "1",
      540,
    ),
    milestoneDeadlines: [
      {
        milestoneId: "FINISH",
        deadline: dateTime(
          "2026-07-25T11:00:00+09:00",
          2026,
          7,
          25,
          11,
          0,
          "0",
          "1",
          540,
        ),
      },
    ],
    taskConstraints: [
      {
        taskId: "OFFSET_EQUAL",
        notBefore: dateTime(
          "2026-07-25T00:00:00Z",
          2026,
          7,
          25,
          0,
          0,
          "0",
          "1",
          0,
        ),
        deadline: dateTime(
          "2026-07-25T02:00:00Z",
          2026,
          7,
          25,
          2,
          0,
          "0",
          "1",
          0,
        ),
      },
    ],
  });

  const project = getTargetProjectMetadata(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.deepEqual(project, {
    ok: true,
    documentId: "CALENDAR_OFFSET",
    grammarVersion: 2,
    project: {
      id: "CALENDAR_OFFSET",
      version: 2,
      title: "Equal instants with different offsets",
      description: null,
      asOf: checked.temporalInputs.anchor,
      durationUnit: "hour",
      velocity: null,
      finish: "FINISH",
      finishDeadline: checked.temporalInputs.milestoneDeadlines[0].deadline,
      criticalEpsilon: null,
      targetDuration: null,
    },
    diagnostics: [],
    diagnosticsTruncated: false,
  });
  assert.deepEqual(
    checkTargetDocument(text, TARGET_GRAMMAR_2_CAPABILITY),
    checked,
  );

  const publicChecked = publicApi.checkDocument(text);
  assert.equal(publicChecked.ok, true);
  assert.deepEqual(publicChecked.temporalInputs, checked.temporalInputs);
  const publicProject = publicApi.getProjectMetadata(text);
  assert.equal(publicProject.ok, true);
  const { governance, ...publicProjectWithoutGovernance } =
    publicProject.project;
  assert.deepEqual(publicProjectWithoutGovernance, project.project);
  assert.deepEqual(governance.declared, {
    goalOwner: null,
    goalDelegates: null,
    dagOwner: null,
    dagDelegates: null,
  });
  assert.equal(governance.effective.goalOwner, "user");
  assert.equal(governance.effective.dagOwner, "user");
});

test("declared temporal arrays retain source declaration order", async () => {
  const text = await readFile(
    path.join(fixtureDirectory, "migration-point-v2.pert"),
    "utf8",
  );
  const checked = checkTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.deepEqual(
    checked.temporalInputs.milestoneDeadlines.map(({ milestoneId }) => milestoneId),
    ["MID", "FINISH"],
  );
  assert.deepEqual(
    checked.temporalInputs.taskConstraints.map(({ taskId }) => taskId),
    ["FIXED", "ESTIMATED"],
  );
  assert.deepEqual(checked.temporalInputs.taskConstraints.map(
    ({ notBefore, deadline }) => ({
      notBefore: notBefore?.sourceText ?? null,
      deadline: deadline?.sourceText ?? null,
    }),
  ), [
    {
      notBefore: "2026-07-25T09:00:00+09:00",
      deadline: "2026-07-27T09:00:00+09:00",
    },
    {
      notBefore: null,
      deadline: "2026-07-30T09:00:00+09:00",
    },
  ]);

  const project = getTargetProjectMetadata(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(
    project.project.finishDeadline.sourceText,
    "2026-07-30T09:00:00+09:00",
  );
  assert.equal(project.project.velocity, "20p/10d");
  assert.equal(project.project.criticalEpsilon, "0.5p");
  assert.equal(project.project.targetDuration, "12p");
});

test("valid Grammar 1 projects a typed optional anchor and empty temporal arrays", () => {
  const text = `project COMPATIBLE:
  version 1
  title "compatible"
  as_of 2026-07-25T09:00:00.5000+09:30
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration 1d
`;
  const checked = checkTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.equal(checked.grammarVersion, 1);
  assert.deepEqual(checked.temporalInputs, {
    anchor: dateTime(
      "2026-07-25T09:00:00.5000+09:30",
      2026,
      7,
      25,
      9,
      0,
      "1",
      "2",
      570,
    ),
    milestoneDeadlines: [],
    taskConstraints: [],
  });
  const project = getTargetProjectMetadata(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(project.ok, true);
  assert.equal(project.grammarVersion, 1);
  assert.deepEqual(project.project.asOf, checked.temporalInputs.anchor);
  assert.equal(project.project.finishDeadline, null);

  const withoutAnchor = checkTargetDocument(
    text.replace("  as_of 2026-07-25T09:00:00.5000+09:30\n", ""),
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.deepEqual(withoutAnchor.temporalInputs, {
    anchor: null,
    milestoneDeadlines: [],
    taskConstraints: [],
  });
});

test("syntax failures suppress untrusted temporal inputs completely", () => {
  const text = `project CLOSED:
  version 1
  title "closed"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone FINISH:
  title "finish"
  deadline 2026-07-26
`;
  const checked = checkTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(checked.ok, false);
  assert.equal(checked.grammarVersion, null);
  assert.equal(checked.temporalInputs, null);
  assert.deepEqual(checked.summary, {
    resources: 0,
    milestones: 0,
    tasks: 0,
    gates: 0,
    errors: 1,
    warnings: 0,
  });
  assert.deepEqual(checked.diagnostics.map(({ code }) => code), ["PTDSL-005"]);

  const project = getTargetProjectMetadata(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(project.ok, false);
  assert.equal(project.grammarVersion, null);
  assert.equal(project.project, null);
});

test("semantic failures retain trusted declared inputs but suppress project metadata", () => {
  const text = `project MISSING_ANCHOR:
  version 2
  title "missing anchor"
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-07-28

task WORK START -> FINISH:
  title "work"
  duration 1d
  not_before 2026-07-26
  deadline 2026-07-27
`;
  const checked = checkTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
    { maxDiagnostics: 2 },
  );
  assert.equal(checked.ok, false);
  assert.equal(checked.grammarVersion, 2);
  assert.equal(checked.diagnosticsTruncated, true);
  assert.equal(checked.diagnostics.length, 2);
  assert.equal(checked.summary.errors, 3);
  assert.deepEqual(checked.temporalInputs, {
    anchor: null,
    milestoneDeadlines: [
      {
        milestoneId: "FINISH",
        deadline: date("2026-07-28", 2026, 7, 28),
      },
    ],
    taskConstraints: [
      {
        taskId: "WORK",
        notBefore: date("2026-07-26", 2026, 7, 26),
        deadline: date("2026-07-27", 2026, 7, 27),
      },
    ],
  });

  const project = getTargetProjectMetadata(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(project.ok, false);
  assert.equal(project.grammarVersion, null);
  assert.equal(project.project, null);
  assert.equal(project.diagnostics.length, 3);
});

test("an invalid legacy anchor cannot enter a target temporal result", () => {
  const text = `project INVALID_ANCHOR:
  version 1
  title "invalid anchor"
  as_of 2026-02-29
  duration_unit day
  finish FINISH

milestone FINISH:
  title "finish"
`;
  const checked = checkTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(checked.ok, false);
  assert.equal(checked.grammarVersion, 1);
  assert.equal(checked.temporalInputs, null);
  assert.deepEqual(checked.diagnostics.map(({ code }) => code), ["PTDSL-008"]);

  const project = getTargetProjectMetadata(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(project.ok, false);
  assert.equal(project.grammarVersion, null);
  assert.equal(project.project, null);
});

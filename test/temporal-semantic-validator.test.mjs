import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  TARGET_GRAMMAR_2_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetDocument,
} from "../dist/semantic/target-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

function declaration(result, id) {
  const document = result.validatedDocument?.document;
  assert.ok(document);
  const found = document.declarations.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(found, id);
  return found;
}

function field(result, id, name) {
  const found = declaration(result, id).fields.find(
    (candidate) => candidate.name === name,
  );
  assert.ok(found, `${id}.${name}`);
  return found;
}

test("target validation boundary is internal and capability-checked", () => {
  assert.equal("validateTargetDocument" in publicApi, false);
  assert.equal("validateTargetDocumentSemantics" in publicApi, false);
  assert.throws(
    () => validateTargetDocument("", {
      id: "perttool.target-grammar-2-source",
      version: 1,
      grammarVersion: 2,
    }),
    /target Grammar 2 source capability is required/,
  );
});

test("target validation retains valid Grammar 1 contextual IDs", () => {
  const text = `project COMPATIBLE:
  version 1
  title "compatible"
  duration_unit day
  finish deadline

milestone not_before:
  title "start"
  state reached

milestone deadline:
  title "finish"

task WORK not_before -> deadline:
  title "work"
  duration 1d
`;
  const result = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.validatedDocument?.grammarVersion, 1);
  assert.equal(Object.isFrozen(result.validatedDocument), true);
});

test("TUE-002 reports PTSEM-112 at every temporal field without an anchor", () => {
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
  deadline 2026-07-25

task WORK START -> FINISH:
  title "work"
  duration 1d
  not_before 2026-07-25
  deadline 2026-07-25
`;
  const result = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.validatedDocument, null);
  assert.equal(result.diagnosticsTruncated, false);
  assert.deepEqual(
    result.diagnostics.map(
      ({ code, entityId, helpTopic, message, span }) => ({
        code,
        entityId,
        helpTopic,
        message,
        source: text.slice(span.start.offset, span.end.offset),
      }),
    ),
    [
      {
        code: "PTSEM-112",
        entityId: "FINISH",
        helpTopic: "syntax.temporal",
        message: "milestone FINISH.deadline requires project.as_of",
        source: "2026-07-25",
      },
      {
        code: "PTSEM-112",
        entityId: "WORK",
        helpTopic: "syntax.temporal",
        message: "task WORK.not_before requires project.as_of",
        source: "2026-07-25",
      },
      {
        code: "PTSEM-112",
        entityId: "WORK",
        helpTopic: "syntax.temporal",
        message: "task WORK.deadline requires project.as_of",
        source: "2026-07-25",
      },
    ],
  );

  const active = publicApi.checkDocument(text);
  assert.deepEqual(
    active.diagnostics.map(({ code }) => code),
    ["PTDSL-005", "PTDSL-005", "PTDSL-005"],
  );
});

test("target diagnostics retain the ordinary deterministic limit", () => {
  const text = `project LIMITED:
  version 2
  title "limited"
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-07-25

task WORK START -> FINISH:
  title "work"
  duration 1d
  not_before 2026-07-25
  deadline 2026-07-25
`;
  const result = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
    { maxDiagnostics: 2 },
  );
  assert.equal(result.ok, false);
  assert.equal(result.validatedDocument, null);
  assert.equal(result.diagnosticsTruncated, true);
  assert.deepEqual(
    result.diagnostics.map(({ code }) => code),
    ["PTSEM-112", "PTSEM-112"],
  );
});

test("TUE-006 mixed temporal kinds remain a valid source boundary", async () => {
  const text = await readFile(
    path.join(fixtureDirectory, "mixed-kind-v2.pert"),
    "utf8",
  );
  const result = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.validatedDocument?.grammarVersion, 2);
  assert.equal(field(result, "MIXED_KIND", "as_of").value.kind, "date");
  assert.equal(
    field(result, "FUTURE_CLOCK", "not_before").value.kind,
    "date_time",
  );
});

test("TUE-007 date anchor and hour duration remain valid without promotion", () => {
  const text = `project DATE_HOUR:
  version 2
  title "date anchor and hour duration"
  as_of 2026-07-25
  duration_unit hour
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration 1h
`;
  const result = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(field(result, "DATE_HOUR", "as_of").value, {
    kind: "date",
    sourceText: "2026-07-25",
    year: 2026,
    month: 7,
    day: 25,
  });
  assert.equal(field(result, "WORK", "duration").rawValue, "1h");
});

test("TUE-011 retains temporal history without inventing actual time", async () => {
  const text = await readFile(
    path.join(fixtureDirectory, "deadline-complete-v2.pert"),
    "utf8",
  );
  const result = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(field(result, "HISTORICAL", "status").value, "done");
  assert.equal(
    field(result, "HISTORICAL", "not_before").value.sourceText,
    "2026-07-23",
  );
  assert.equal(
    field(result, "HISTORICAL", "deadline").value.sourceText,
    "2026-07-24",
  );
  assert.equal(field(result, "FINISH", "state").value, "reached");
  assert.equal(
    field(result, "FINISH", "deadline").value.sourceText,
    "2026-07-25",
  );
  assert.equal(
    declaration(result, "HISTORICAL").fields.some(
      ({ name }) => name === "actual_start" || name === "actual_finish",
    ),
    false,
  );
});

test("active tasks retain temporal source without reapplying start eligibility", () => {
  const text = `project ACTIVE_HISTORY:
  version 2
  title "active history"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-07-27

task WORK START -> FINISH:
  title "active work"
  duration 1d
  not_before 2026-07-26
  deadline 2026-07-27
  status active
`;
  const result = validateTargetDocument(
    text,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(field(result, "WORK", "status").value, "active");
  assert.equal(
    field(result, "WORK", "not_before").value.sourceText,
    "2026-07-26",
  );
  assert.equal(
    field(result, "WORK", "deadline").value.sourceText,
    "2026-07-27",
  );
});

test("target Grammar 2 validation reads no clock for temporal source", () => {
  const text = `project PURE:
  version 2
  title "pure validation"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-07-26

task WORK START -> FINISH:
  title "work"
  duration 1d
  not_before 2026-07-25T00:00:00Z
`;
  const OriginalDate = globalThis.Date;
  class ForbiddenDate extends OriginalDate {
    constructor(...args) {
      void args;
      throw new Error("clock or host-zone access");
    }

    static now() {
      throw new Error("clock access");
    }

    static parse() {
      throw new Error("host date parsing");
    }

    static UTC() {
      throw new Error("host date conversion");
    }
  }
  globalThis.Date = ForbiddenDate;
  try {
    const result = validateTargetDocument(
      text,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.diagnostics, []);
  } finally {
    globalThis.Date = OriginalDate;
  }
});

test("all normative Grammar 2 fixtures cross the validated boundary", async () => {
  const names = (await readdir(fixtureDirectory))
    .filter((name) => name.endsWith("-v2.pert"))
    .sort();
  assert.equal(names.length, 9);
  for (const name of names) {
    const text = await readFile(path.join(fixtureDirectory, name), "utf8");
    const result = validateTargetDocument(
      text,
      TARGET_GRAMMAR_2_CAPABILITY,
    );
    assert.equal(
      result.ok,
      true,
      `${name}: ${result.diagnostics
        .map(({ code, message }) => `${code} ${message}`)
        .join("; ")}`,
    );
    assert.equal(result.validatedDocument?.grammarVersion, 2, name);
  }
});

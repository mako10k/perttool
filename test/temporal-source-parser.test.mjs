import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  parseTargetDocument,
  TARGET_GRAMMAR_2_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

function declaration(result, id) {
  const found = result.document.declarations.find(
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

test("target Grammar 2 source capability is internal and identity-checked", () => {
  assert.equal("parseTargetDocument" in publicApi, false);
  assert.equal("TARGET_GRAMMAR_2_CAPABILITY" in publicApi, false);
  assert.throws(
    () => parseTargetDocument("", {
      id: "perttool.target-grammar-2-source",
      version: 1,
      grammarVersion: 2,
    }),
    /target Grammar 2 source capability is required/,
  );
});

test("Grammar 1 remains closed while temporal words remain contextual IDs", () => {
  const temporalFields = `project CLOSED:
  version 1
  title "closed"
  as_of 2026-07-25
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
  const active = publicApi.parseDocument(temporalFields);
  const target = parseTargetDocument(
    temporalFields,
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.deepEqual(
    active.diagnostics.map(({ code }) => code),
    ["PTDSL-005", "PTDSL-005", "PTDSL-005"],
  );
  assert.deepEqual(target, active);
  assert.equal(
    target.document.declarations.some((candidate) =>
      candidate.fields.some(({ name }) =>
        name === "deadline" || name === "not_before")),
    false,
  );

  const contextualIds = `project CONTEXTUAL:
  version 1
  title "contextual IDs"
  duration_unit day
  finish DONE

milestone deadline:
  title "deadline remains an ID"
  state reached

milestone DONE:
  title "done"

task not_before deadline -> DONE:
  title "not_before remains an ID"
  duration 1d
`;
  const checked = publicApi.checkDocument(contextualIds);
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  const targetContextualIds = parseTargetDocument(
    contextualIds.replace("version 1", "version 2"),
    TARGET_GRAMMAR_2_CAPABILITY,
  );
  assert.deepEqual(targetContextualIds.diagnostics, []);
});

test("target Grammar 2 accepts only the three temporal field positions", () => {
  const text = `project EXACT_FIELDS:
  version 2
  title "exact fields"
  as_of 2026-07-25
  deadline 2026-07-25
  duration_unit day
  finish FINISH

resource WORKERS:
  title "workers"
  capacity 1
  not_before 2026-07-25

milestone FINISH:
  title "finish"
  not_before 2026-07-25

gate WAIT FINISH -> DONE:
  reason "wait"
  deadline 2026-07-25

milestone DONE:
  title "done"
`;
  const parsed = parseTargetDocument(text, TARGET_GRAMMAR_2_CAPABILITY);
  assert.deepEqual(
    parsed.diagnostics.map(({ code, entityId }) => ({ code, entityId })),
    [
      { code: "PTDSL-005", entityId: "EXACT_FIELDS" },
      { code: "PTDSL-005", entityId: "WORKERS" },
      { code: "PTDSL-005", entityId: "FINISH" },
      { code: "PTDSL-005", entityId: "WAIT" },
    ],
  );
});

test("target Grammar 2 parses exact declared calendar source records", async () => {
  const text = await readFile(
    path.join(fixtureDirectory, "calendar-offset-v2.pert"),
    "utf8",
  );
  const active = publicApi.parseDocument(text);
  assert.deepEqual(
    active.diagnostics.map(({ code }) => code),
    ["PTDSL-005", "PTDSL-005", "PTDSL-005"],
  );

  const parsed = parseTargetDocument(text, TARGET_GRAMMAR_2_CAPABILITY);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(field(parsed, "CALENDAR_OFFSET", "as_of").value, {
    kind: "date_time",
    sourceText: "2026-07-25T09:00:00+09:00",
    year: 2026,
    month: 7,
    day: 25,
    hour: 9,
    minute: 0,
    second: { numerator: 0n, denominator: 1n },
    offsetMinutes: 540,
  });
  assert.deepEqual(field(parsed, "FINISH", "deadline").value, {
    kind: "date_time",
    sourceText: "2026-07-25T11:00:00+09:00",
    year: 2026,
    month: 7,
    day: 25,
    hour: 11,
    minute: 0,
    second: { numerator: 0n, denominator: 1n },
    offsetMinutes: 540,
  });
  assert.deepEqual(field(parsed, "OFFSET_EQUAL", "not_before").value, {
    kind: "date_time",
    sourceText: "2026-07-25T00:00:00Z",
    year: 2026,
    month: 7,
    day: 25,
    hour: 0,
    minute: 0,
    second: { numerator: 0n, denominator: 1n },
    offsetMinutes: 0,
  });

  for (const [id, name] of [
    ["CALENDAR_OFFSET", "as_of"],
    ["FINISH", "deadline"],
    ["OFFSET_EQUAL", "not_before"],
    ["OFFSET_EQUAL", "deadline"],
  ]) {
    const temporalField = field(parsed, id, name);
    assert.equal(
      text.slice(
        temporalField.valueSpan.start.offset,
        temporalField.valueSpan.end.offset,
      ),
      temporalField.rawValue,
    );
  }
});

test("target calendar values retain exact fractional seconds and offsets", () => {
  const text = `project FRACTIONAL:
  version 2
  title "fractional"
  as_of 2026-07-25T10:20:30.2500-03:30
  duration_unit hour
  finish FINISH

milestone FINISH:
  title "finish"
`;
  const parsed = parseTargetDocument(text, TARGET_GRAMMAR_2_CAPABILITY);
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(field(parsed, "FRACTIONAL", "as_of").value, {
    kind: "date_time",
    sourceText: "2026-07-25T10:20:30.2500-03:30",
    year: 2026,
    month: 7,
    day: 25,
    hour: 10,
    minute: 20,
    second: { numerator: 121n, denominator: 4n },
    offsetMinutes: -210,
  });
});

test("TUE-003 invalid temporal literals report exact source errors", () => {
  const text = `project INVALID_TEMPORAL:
  version 2
  title "invalid temporal"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-02-29

task WORK START -> FINISH:
  title "work"
  duration 1d
  not_before 2026-07-25T10:00:00
  deadline 2026-07-25T10:00:60Z
`;
  const parsed = parseTargetDocument(text, TARGET_GRAMMAR_2_CAPABILITY);
  assert.deepEqual(
    parsed.diagnostics.map(({ code, helpTopic, span }) => ({
      code,
      helpTopic,
      source: text.slice(span.start.offset, span.end.offset),
    })),
    [
      {
        code: "PTDSL-008",
        helpTopic: "syntax.temporal",
        source: "2026-02-29",
      },
      {
        code: "PTDSL-008",
        helpTopic: "syntax.temporal",
        source: "2026-07-25T10:00:00",
      },
      {
        code: "PTDSL-008",
        helpTopic: "syntax.temporal",
        source: "2026-07-25T10:00:60Z",
      },
    ],
  );
});

test("all normative Grammar 2 source fixtures parse through the target capability", async () => {
  const names = (await readdir(fixtureDirectory))
    .filter((name) => name.endsWith("-v2.pert"))
    .sort();
  assert.equal(names.length, 9);
  for (const name of names) {
    const text = await readFile(path.join(fixtureDirectory, name), "utf8");
    const parsed = parseTargetDocument(text, TARGET_GRAMMAR_2_CAPABILITY);
    assert.deepEqual(
      parsed.diagnostics,
      [],
      `${name}: ${parsed.diagnostics
        .map(({ code, message }) => `${code} ${message}`)
        .join("; ")}`,
    );
  }
});

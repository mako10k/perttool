import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  ACTUALS_SOURCE_MODEL_VERSION,
  projectActualsSourceModel,
  workEventsForTask,
} from "../dist/actuals/source.js";
import {
  TARGET_GRAMMAR_5_DECLARATION_FIELD_ORDER,
} from "../dist/model/declaration-fields.js";
import {
  parseDocument,
  parseTargetGrammar5Document,
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  formatTargetGrammar5Document,
} from "../dist/formatter/target-source-formatter.js";
import {
  validateTargetGrammar5Document,
} from "../dist/semantic/target-validator.js";

function source({
  version = 5,
  status = "active",
  events = [],
  taskId = "WORK",
  duration = "4p",
  extraDeclarations = [],
} = {}) {
  return [
    "project ACTUALS:",
    `  version ${version}`,
    '  title "actuals"',
    "  as_of 2026-07-28",
    "  duration_unit point",
    "  velocity 4p/1d",
    "  finish DONE",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "done"',
    "",
    `task ${taskId} NOW -> DONE:`,
    '  title "work"',
    `  duration ${duration}`,
    `  status ${status}`,
    ...extraDeclarations,
    ...events,
    "",
  ].join("\n");
}

function event(id, fields) {
  return [
    "",
    `# leading ${id}`,
    `work_event ${id}:`,
    "  # owned field comment",
    ...fields.map((field) => `  ${field}`),
  ];
}

function diagnosticsFor(text) {
  return validateTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
  ).diagnostics;
}

test("Grammar 5 actuals source capability is internal and identity checked", async () => {
  for (const name of [
    "TARGET_GRAMMAR_5_CAPABILITY",
    "parseTargetGrammar5Document",
    "validateTargetGrammar5Document",
    "formatTargetGrammar5Document",
    "projectActualsSourceModel",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  assert.equal(Object.isFrozen(TARGET_GRAMMAR_5_CAPABILITY), true);
  assert.equal(Object.isFrozen(TARGET_GRAMMAR_5_DECLARATION_FIELD_ORDER), true);
  assert.deepEqual(TARGET_GRAMMAR_5_DECLARATION_FIELD_ORDER.work_event, [
    "model",
    "task",
    "kind",
    "occurred_at",
    "planned_value",
    "active_time",
    "effort",
    "reason",
  ]);
  assert.throws(
    () =>
      parseTargetGrammar5Document("", {
        ...TARGET_GRAMMAR_5_CAPABILITY,
      }),
    /target Grammar 5 actuals source capability is required/,
  );
  const rootDeclarations = await readFile(
    new URL("../dist/index.d.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(rootDeclarations, /TargetDeclarationKind/);
  assert.doesNotMatch(rootDeclarations, /TargetGrammar5/);
  const syntaxDeclarations = await readFile(
    new URL("../dist/model/syntax.d.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    syntaxDeclarations,
    /DeclarationNode<Kind extends TargetDeclarationKind = DeclarationKind>/,
  );
  const parserDeclarations = await readFile(
    new URL("../dist/parser/document-parser.d.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    parserDeclarations,
    /parseDocument\(text: string, options\?: ParseOptions\): ParseResult;/,
  );
});

test("canonical Grammar 5 source validates and projects exact task-owned events", async () => {
  const markdown = await readFile("docs/examples/project-actuals.md", "utf8");
  const text = /```pert\n([\s\S]*?)```/.exec(markdown)?.[1];
  assert.ok(text);
  const checked = validateTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.equal(checked.grammarVersion, 5);
  assert.ok(checked.validatedDocument);

  const model = projectActualsSourceModel(checked.validatedDocument);
  assert.equal(model.modelVersion, ACTUALS_SOURCE_MODEL_VERSION);
  assert.equal(model.grammarVersion, 5);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.events), true);
  assert.deepEqual(
    model.events.map(({ id, taskId, kind }) => ({ id, taskId, kind })),
    [
      { id: "WE-start", taskId: "WORK", kind: "start" },
      { id: "WE-suspend", taskId: "WORK", kind: "suspend" },
      { id: "WE-resume", taskId: "WORK", kind: "resume" },
      { id: "WE-finish", taskId: "WORK", kind: "finish" },
    ],
  );
  const start = model.events[0];
  const finish = model.events[3];
  assert.deepEqual(start.plannedValue.value, {
    numerator: 4n,
    denominator: 1n,
  });
  assert.equal(start.plannedValue.unit, "point");
  assert.deepEqual(finish.activeTime.value, {
    numerator: 6n,
    denominator: 1n,
  });
  assert.deepEqual(finish.effort.value, {
    numerator: 8n,
    denominator: 1n,
  });
  assert.deepEqual(
    workEventsForTask(model, "WORK").map(({ id }) => id),
    ["WE-start", "WE-suspend", "WE-resume", "WE-finish"],
  );
  assert.deepEqual(workEventsForTask(model, "UNKNOWN"), []);
});

test("Grammar 5 formatter preserves structure and canonicalizes exact event values", () => {
  const text = source({
    status: "done",
    events: [
      ...event("WE-start", [
        "model 01",
        "task WORK",
        "kind start",
        "occurred_at 2026-07-28T09:00:00.5000+09:00",
        "planned_value 8/2p",
      ]),
      ...event("WE-finish", [
        "model 1",
        "task WORK",
        "kind finish",
        "occurred_at 2026-07-28T17:00:00.000+00:00",
        "active_time 12/2h",
        "effort 8/4ph",
      ]),
    ],
  }).replace("  version 5", "  version 0005");
  const checked = validateTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(checked.ok, true);

  const formatted = formatTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.equal(formatted.changed, true);
  assert.match(formatted.formattedText, /  version 5/);
  assert.match(formatted.formattedText, /  model 1/);
  assert.match(
    formatted.formattedText,
    /occurred_at 2026-07-28T09:00:00\.5\+09:00/,
  );
  assert.match(
    formatted.formattedText,
    /occurred_at 2026-07-28T17:00:00\+00:00/,
  );
  assert.match(formatted.formattedText, /planned_value 4p/);
  assert.match(formatted.formattedText, /active_time 6h/);
  assert.match(formatted.formattedText, /effort 2ph/);
  assert.match(formatted.formattedText, /# leading WE-start/);
  assert.match(formatted.formattedText, /  # owned field comment/);

  const repeated = formatTargetGrammar5Document(
    formatted.formattedText,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
  assert.equal(repeated.formattedText, formatted.formattedText);
});

test("Grammar 5 validates model, task ownership, kind fields, and planned value", () => {
  const cases = [
    {
      name: "unsupported model",
      fields: [
        "model 2",
        "task WORK",
        "kind start",
        "occurred_at 2026-07-28T09:00:00+09:00",
        "planned_value 4p",
      ],
      code: "PTACT-101",
      cause: "unsupported_event_model",
    },
    {
      name: "missing task",
      fields: [
        "model 1",
        "task UNKNOWN",
        "kind start",
        "occurred_at 2026-07-28T09:00:00+09:00",
        "planned_value 4p",
      ],
      code: "PTACT-102",
      cause: "missing_task",
    },
    {
      name: "wrong task kind",
      fields: [
        "model 1",
        "task NOW",
        "kind start",
        "occurred_at 2026-07-28T09:00:00+09:00",
        "planned_value 4p",
      ],
      code: "PTACT-102",
      cause: "wrong_entity_kind",
    },
    {
      name: "missing planned value",
      fields: [
        "model 1",
        "task WORK",
        "kind start",
        "occurred_at 2026-07-28T09:00:00+09:00",
      ],
      code: "PTACT-103",
      cause: "missing_field",
    },
    {
      name: "forbidden finish reason",
      fields: [
        "model 1",
        "task WORK",
        "kind finish",
        "occurred_at 2026-07-28T17:00:00+09:00",
        'reason "not allowed"',
      ],
      code: "PTACT-103",
      cause: "forbidden_field",
    },
    {
      name: "planned value mismatch",
      fields: [
        "model 1",
        "task WORK",
        "kind start",
        "occurred_at 2026-07-28T09:00:00+09:00",
        "planned_value 5p",
      ],
      code: "PTACT-103",
      cause: "planned_value_mismatch",
    },
  ];
  for (const contractCase of cases) {
    const diagnostics = diagnosticsFor(source({
      events: event("WE-case", contractCase.fields),
    }));
    assert.ok(
      diagnostics.some(
        ({ code, data }) =>
          code === contractCase.code && data?.cause === contractCase.cause,
      ),
      `${contractCase.name}: ${JSON.stringify(diagnostics)}`,
    );
  }
});

test("start planned_value matches the exact three-point PERT expectation", () => {
  const text = source({
    events: event("WE-estimate", [
      "model 1",
      "task WORK",
      "kind start",
      "occurred_at 2026-07-28T09:00:00+09:00",
      "planned_value 13/6p",
    ]),
  }).replace(
    "  duration 4p",
    [
      "  estimate:",
      "    optimistic 1p",
      "    most_likely 2p",
      "    pessimistic 4p",
    ].join("\n"),
  );
  const checked = validateTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  const model = projectActualsSourceModel(checked.validatedDocument);
  assert.deepEqual(model.events[0].plannedValue.value, {
    numerator: 13n,
    denominator: 6n,
  });
});

test("Grammar 5 rejects non-offset event times and invalid exact hour quantities", () => {
  for (const occurredAt of [
    "2026-07-28",
    "2026-07-28T09:00:00",
    "2026-07-28T09:00:00Z",
    "2026-07-28T09:00:00-00:00",
  ]) {
    const diagnostics = diagnosticsFor(source({
      events: event("WE-time", [
        "model 1",
        "task WORK",
        "kind start",
        `occurred_at ${occurredAt}`,
        "planned_value 4p",
      ]),
    }));
    assert.ok(
      diagnostics.some(({ code }) => code === "PTDSL-008"),
      occurredAt,
    );
  }

  for (const field of [
    "active_time 1/0h",
    "active_time -1h",
    "active_time 1e2h",
    "active_time 1p",
    "effort 1/0ph",
    "effort -1ph",
    "effort 1e2ph",
    "effort 1h",
  ]) {
    const diagnostics = diagnosticsFor(source({
      events: event("WE-exact", [
        "model 1",
        "task WORK",
        "kind finish",
        "occurred_at 2026-07-28T17:00:00+09:00",
        field,
      ]),
    }));
    assert.ok(
      diagnostics.some(({ code }) => code === "PTDSL-007"),
      field,
    );
  }
});

test("Grammar 1 through 4 remain closed while Grammar 5 accepts suspended and contextual IDs", () => {
  const grammar4 = source({
    version: 4,
    taskId: "work_event",
    status: "active",
  });
  assert.deepEqual(
    parseTargetGrammar5Document(grammar4, TARGET_GRAMMAR_5_CAPABILITY),
    parseDocument(grammar4),
  );

  const futureEvent = source({
    version: 4,
    events: event("WE-future", [
      "model 1",
      "task WORK",
      "kind finish",
      "occurred_at 2026-07-28T17:00:00+09:00",
    ]),
  });
  assert.ok(
    parseDocument(futureEvent).diagnostics.some(
      ({ code }) => code === "PTDSL-003",
    ),
  );

  const suspended = source({ status: "suspended" });
  const target = validateTargetGrammar5Document(
    suspended,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(target.ok, true);
  assert.ok(
    publicApi.parseDocument(suspended).diagnostics.some(
      ({ code }) => code === "PTDSL-012",
    ),
  );
});

test("work-event IDs share the global document namespace", () => {
  const diagnostics = diagnosticsFor(source({
    events: event("WORK", [
      "model 1",
      "task WORK",
      "kind finish",
      "occurred_at 2026-07-28T17:00:00+09:00",
    ]),
  }));
  assert.ok(diagnostics.some(({ code }) => code === "PTSEM-201"));
});

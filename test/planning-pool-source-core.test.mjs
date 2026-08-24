import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";
import {
  formatPlanningPoolSource,
  planPlanningPoolMigration,
  planPlanningPoolSourceMutation,
} from "../dist/planning-pool/format.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
  PLANNING_POOL_SOURCE_LIMITS,
  PLANNING_POOL_SOURCE_MODEL_VERSION,
} from "../dist/planning-pool/source.js";

function source({
  works = [
    ["W1", [
      '  title "First outcome"',
      '  description "Residual one"',
      "  events:",
      "    E1",
      "  activities:",
      "    A1",
      "    A2",
      "  milestone_links:",
      "    END",
      "  task_links:",
      "    STRICT",
      "  depends_on:",
      "    W2",
    ]],
      ["W2", ['  title "Second outcome"', "  events:", "    E2"]],
  ],
  events = [
    ["E1", ['  title "First state"', "  tags [draft]"]],
    ["E2", ['  title "Second state"']],
  ],
  activities = [
    ["A1", "E1", "E2", [
      '  title "Shape first transition"',
      "  duration 5p",
      "  priority 7",
      "  requires:",
      "    DEVELOPERS 1",
    ]],
    ["A2", "E2", "E1", ['  title "Shape return transition"']],
  ],
  windows = [
    ["SPRINT", [
      '  title "Sprint"',
      '  objective "Users can inspect the first outcome."',
      "  start 2026-08-24",
      "  end 2026-09-07",
      "  works:",
      "    W1",
      "    W2",
    ]],
  ],
  order = ["W2", "W1"],
  version = 9,
} = {}) {
  const planning = [
    ...works.flatMap(([id, fields]) => [`work ${id}:`, ...fields, ""]),
    ...events.flatMap(([id, fields]) => [`event ${id}:`, ...fields, ""]),
    ...activities.flatMap(([id, from, to, fields]) => [
      `activity ${id} ${from} -> ${to}:`, ...fields, "",
    ]),
    ...windows.flatMap(([id, fields]) => [`window ${id}:`, ...fields, ""]),
    ...(works.length === 0 ? [] : ["work_order:", ...order.map((id) => `  ${id}`), ""]),
  ];
  return `${[
    "project POOL:",
    `  version ${version}`,
    '  title "Pool"',
    "  as_of 2026-08-24",
    "  duration_unit point",
    "  finish END",
    "",
    "resource DEVELOPERS:",
    '  title "Developers"',
    "  capacity 2",
    "",
    ...planning,
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task STRICT START -> END:",
    '  title "Strict execution"',
    "  duration 1p",
  ].join("\n")}\n`;
}

function parse(text, options) {
  return parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY, options);
}

function codes(result) {
  return result.diagnostics.map(({ code }) => code);
}

test("PPSC-001 keeps one private identity-checked Grammar 9 capability", async () => {
  const fixture = JSON.parse(
    await readFile("test/fixtures/planning-pool-source-core-v1.json", "utf8"),
  );
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    Array.from({ length: 16 }, (_, index) => `PPSC-${String(index + 1).padStart(3, "0")}`),
  );
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.equal(Object.isFrozen(PLANNING_POOL_SOURCE_CAPABILITY), true);
  assert.equal(PLANNING_POOL_SOURCE_MODEL_VERSION, 1);
  assert.deepEqual(PLANNING_POOL_SOURCE_LIMITS, {
    sourceOrCandidateUtf8Bytes: 8388608,
    works: 10000,
    events: 20000,
    activities: 20000,
    associationsPlusProjectionLinks: 100000,
    workDependencies: 100000,
    persistedWindows: 2048,
    persistedWindowMemberships: 100000,
  });
  assert.throws(
    () => parsePlanningPoolSource("", { ...PLANNING_POOL_SOURCE_CAPABILITY }),
    /Grammar 9 planning-pool source capability is required/u,
  );
  for (const api of [rootApi, nodeApi, coreApi]) {
    for (const name of [
      "PLANNING_POOL_SOURCE_CAPABILITY",
      "parsePlanningPoolSource",
      "formatPlanningPoolSource",
      "planPlanningPoolMigration",
    ]) assert.equal(name in api, false, name);
  }
});

test("PPSC-002 delegates Grammar 1 through 8 without a planning model", () => {
  for (let version = 1; version <= 8; version += 1) {
    const result = parse(source({ works: [], events: [], activities: [], windows: [], order: [], version }));
    assert.equal(result.ok, true, `Grammar ${version}: ${JSON.stringify(result.diagnostics)}`);
    assert.equal(result.grammarVersion, version);
    assert.equal(result.model, null);
  }
  assert.equal(parse(source({ version: 8 })).ok, false);
});

test("PPSC-003 and PPSC-004 project incomplete Work and cyclic AoA fragments", () => {
  const incomplete = parse(source({
    works: [["W1", ['  title "Uncovered outcome"']]],
    events: [],
    activities: [],
    windows: [],
    order: ["W1"],
  }));
  assert.equal(incomplete.ok, true, JSON.stringify(incomplete.diagnostics));
  assert.equal(incomplete.model.works[0].description, null);
  assert.equal("status" in incomplete.model.works[0], false);
  assert.equal(incomplete.model.works[0].qualifiedId, "POOL::W1");

  const parsed = parse(source());
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  assert.deepEqual(parsed.model.activities.map(({ from, to }) => [from.id, to.id]), [
    ["E1", "E2"],
    ["E2", "E1"],
  ]);
  assert.deepEqual(parsed.model.dependencyCycles, []);
  assert.equal(Object.isFrozen(parsed.model.activities[0].from), true);
});

test("PPSC-005 fixes one complete semantic Work order", () => {
  const parsed = parse(source());
  assert.deepEqual(parsed.model.workOrder.map(({ id }) => id), ["W2", "W1"]);
  assert.deepEqual(parsed.model.works.map(({ id }) => id), ["W1", "W2"]);
  for (const invalid of [
    source().replace("work_order:\n  W2\n  W1\n", ""),
    source().replace("  W2\n  W1\n", "  W1\n  W1\n"),
    source().replace("  W2\n  W1\n", "  W2\n"),
  ]) assert.equal(codes(parse(invalid)).includes("PTPOOL-103"), true);
});

test("PPSC-006 validates associations, projection links, and last consumers", () => {
  const parsed = parse(source());
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.model.works[0].events.map(({ qualifiedId }) => qualifiedId), ["POOL::E1"]);
  assert.deepEqual(parsed.model.works[0].taskLinks.map(({ id }) => id), ["STRICT"]);
  const orphan = parse(source().replace("  events:\n    E1\n", ""));
  assert.equal(codes(orphan).includes("PTPOOL-104"), true);
  const wrongLink = parse(source().replace("    STRICT\n", "    START\n"));
  assert.equal(codes(wrongLink).includes("PTPOOL-104"), true);
  const qualified = parse(source().replace("    E1\n", "    POOL::E1\n"));
  assert.equal(codes(qualified).includes("PTPOOL-102"), true);
});

test("PPSC-007 retains dependency cycles but rejects self and duplicates", () => {
  const cyclic = source().replace(
    'work W2:\n  title "Second outcome"\n',
    'work W2:\n  title "Second outcome"\n  depends_on:\n    W1\n',
  );
  const parsed = parse(cyclic);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  assert.deepEqual(parsed.model.dependencyCycles, [["W1", "W2"]]);
  const self = parse(source().replace("    W2\n\n", "    W1\n\n"));
  assert.equal(codes(self).includes("PTPOOL-106"), true);
  const duplicate = parse(source().replace("  depends_on:\n    W2", "  depends_on:\n    W2\n    W2"));
  assert.equal(codes(duplicate).includes("PTPOOL-106"), true);
});

test("PPSC-008 retains complete optional Activity plan fields", () => {
  const text = source().replace(
    "  duration 5p\n  priority 7\n",
    [
      "  estimate:",
      "    optimistic 3p",
      "    most_likely 5p",
      "    pessimistic 8p",
      "  priority 7",
      '  owner "team"',
      "  when start earliest 2026-08-25T00:00:00+00:00",
      "  deadline 2026-09-07",
    ].join("\n") + "\n",
  );
  const parsed = parse(text);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  const activity = parsed.model.activities[0];
  assert.equal(activity.duration, null);
  assert.equal(activity.estimate.mostLikely.sourceText, "5p");
  assert.equal(activity.priority, 7);
  assert.equal(activity.owner, "team");
  assert.equal(activity.when[0].event, "start");
  assert.equal(activity.when[0].value.sourceText, "2026-08-25T00:00:00+00:00");
  assert.equal(Object.isFrozen(activity.when[0].value), true);
  assert.equal("status" in activity, false);
  const wrongUnit = parse(source().replace("duration 5p", "duration 5h"));
  assert.equal(codes(wrongUnit).includes("PTPOOL-105"), true);
  const dateOnlyWhen = parse(text.replace("2026-08-25T00:00:00+00:00", "2026-08-25"));
  assert.equal(codes(dateOnlyWhen).includes("PTPOOL-105"), true);
  const reversedBounds = parse(text.replace(
    "  when start earliest 2026-08-25T00:00:00+00:00",
    "  when start earliest 2026-08-25T00:00:00+00:00\n  when start latest 2026-08-24T00:00:00+00:00",
  ));
  assert.equal(codes(reversedBounds).includes("PTPOOL-105"), true);
  const wrongZone = parse(text
    .replace(
      "  as_of 2026-08-24",
      '  as_of 2026-08-24T09:00:00+09:00\n  time_zone "Asia/Tokyo"\n  tzdb "2026c"\n  calendar STANDARD',
    )
    .replace("resource DEVELOPERS:", "calendar STANDARD:\n\nresource DEVELOPERS:"));
  assert.equal(codes(wrongZone).includes("PTPOOL-105"), true);
});

test("PPSC-009 validates active Window objective, membership, and bounds", () => {
  const parsed = parse(source());
  assert.equal(parsed.model.windows[0].qualifiedId, "POOL::SPRINT");
  assert.deepEqual(parsed.model.windows[0].works.map(({ id }) => id), ["W1", "W2"]);
  for (const invalid of [
    source().replace('  objective "Users can inspect the first outcome."\n', ""),
    source().replace("  works:\n    W1\n    W2\n", ""),
    source().replace("start 2026-08-24", "start 2026-09-08"),
    source().replace("    W2\n\nwork_order", "    UNKNOWN\n\nwork_order"),
  ]) assert.equal(codes(parse(invalid)).includes("PTPOOL-107"), true);
});

test("PPSC-010 closes the shared namespace", () => {
  const collision = parse(source().replace("work W1:", "work START:"));
  assert.equal(codes(collision).includes("PTPOOL-102"), true);
  const duplicate = parse(source().replace("event E2:", "event E1:"));
  assert.equal(codes(duplicate).includes("PTPOOL-102"), true);
  const endpoint = parse(source().replace("activity A1 E1 -> E2:", "activity A1 E1 -> STRICT:"));
  assert.equal(codes(endpoint).includes("PTPOOL-105"), true);
  const qualifiedIdentity = parse(source().replace("work W1:", "work POOL::W1:"));
  assert.equal(codes(qualifiedIdentity).includes("PTPOOL-102"), true);
  const emptyTitle = parse(source().replace('  title "First outcome"', '  title ""'));
  assert.equal(codes(emptyTitle).includes("PTPOOL-102"), true);
});

test("PPSC-011 preserves BOM and CRLF UTF-16 source spans", () => {
  const text = `\uFEFF${source().replaceAll("\n", "\r\n")}`;
  const parsed = parse(text);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  const span = parsed.model.works[0].idSpan;
  assert.equal(text.slice(span.start.offset, span.end.offset), "W1");
  const invalid = parse(text.replace('title "First outcome"', "title invalid"), { maxDiagnostics: 1 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.diagnostics.length, 1);
  assert.ok(invalid.diagnosticCounts.errors >= 1);
});

test("PPSC-012 formats only owned values and is idempotent", () => {
  const text = source()
    .replace("duration 5p", "duration 5.0p")
    .replace("priority 7", "priority 007")
    .replace("tags [draft]", 'tags ["draft"]')
    .replace("  start 2026-08-24\n", "  start 2026-08-24\n  # retained planning comment\n");
  const formatted = formatPlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  assert.equal(formatted.ok, true, JSON.stringify(formatted.diagnostics));
  assert.equal(formatted.changed, true);
  assert.match(formatted.formattedText, /duration 5p/u);
  assert.match(formatted.formattedText, /priority 7/u);
  assert.match(formatted.formattedText, /tags \[draft\]/u);
  assert.match(formatted.formattedText, /# retained planning comment/u);
  const repeated = formatPlanningPoolSource(formatted.formattedText, PLANNING_POOL_SOURCE_CAPABILITY);
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
});

test("PPSC-013 migrates Grammar 8 by changing only version", () => {
  const grammar8 = source({ works: [], events: [], activities: [], windows: [], order: [], version: 8 });
  const migrated = planPlanningPoolMigration(grammar8, PLANNING_POOL_SOURCE_CAPABILITY);
  assert.equal(migrated.ok, true, JSON.stringify(migrated.diagnostics));
  assert.equal(migrated.changed, true);
  assert.equal(migrated.edits.length, 1);
  assert.equal(migrated.candidateText, grammar8.replace("  version 8", "  version 9"));
  assert.equal(parse(migrated.candidateText).ok, true);
  const repeated = planPlanningPoolMigration(migrated.candidateText, PLANNING_POOL_SOURCE_CAPABILITY);
  assert.equal(repeated.changed, false);
  const old = planPlanningPoolMigration(grammar8.replace("version 8", "version 7"), PLANNING_POOL_SOURCE_CAPABILITY);
  assert.equal(codes(old).includes("PTPOOL-116"), true);
});

test("PPSC-014 enforces the exact source-byte limit", () => {
  const oversized = `${source()}#${"x".repeat(PLANNING_POOL_SOURCE_LIMITS.sourceOrCandidateUtf8Bytes)}\n`;
  const parsed = parse(oversized);
  assert.equal(parsed.ok, false);
  assert.equal(codes(parsed).includes("PTPOOL-115"), true);
  const tooManyWindows = `${source({
    works: [], events: [], activities: [], windows: [], order: [],
  })}${Array.from(
    { length: PLANNING_POOL_SOURCE_LIMITS.persistedWindows + 1 },
    (_, index) => `window W${index}:\n`,
  ).join("")}`;
  assert.equal(codes(parse(tooManyWindows)).includes("PTPOOL-115"), true);
});

test("PPSC-015 revalidates complete private mutation candidates", () => {
  const text = source();
  const title = text.indexOf('"First outcome"');
  const valid = planPlanningPoolSourceMutation(
    text,
    [{ startOffset: title, endOffset: title + '"First outcome"'.length, replacement: '"Changed outcome"' }],
    PLANNING_POOL_SOURCE_CAPABILITY,
  );
  assert.equal(valid.ok, true, JSON.stringify(valid.diagnostics));
  const reference = text.indexOf("    E1");
  const invalid = planPlanningPoolSourceMutation(
    text,
    [{ startOffset: reference + 4, endOffset: reference + 6, replacement: "UNKNOWN" }],
    PLANNING_POOL_SOURCE_CAPABILITY,
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.updatedText, null);
  assert.deepEqual(invalid.edits, []);
});

test("PPSC-016 preserves the active public boundary", () => {
  assert.equal(rootApi.COMMAND_REGISTRY.length, 56);
  assert.equal(rootApi.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(rootApi).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(coreApi).length, 45);
  assert.equal(rootApi.getCommandDiscovery({ resource: null, action: null }).cliContractVersion, 9);
  assert.equal(rootApi.checkDocument(source()).ok, false);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  formatTemporalScheduleSource,
  planTemporalScheduleSourceMutation,
} from "../dist/temporal-schedule/format.js";
import {
  parseTemporalScheduleSource,
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
  TEMPORAL_SCHEDULE_SOURCE_LIMITS,
  TEMPORAL_SCHEDULE_SOURCE_MODEL_VERSION,
} from "../dist/temporal-schedule/source.js";
import {
  TZDB_2026C_ARCHIVE_SHA256,
  TZDB_2026C_RANGE,
  TZDB_2026C_TRANSITIONS,
} from "../dist/temporal-schedule/tzdb-2026c.js";

const archiveDigest = "e4a178a4477f3d0ea77cc31828ff72aa38feff8d61aa13e7e99e142e9d902be4";

function source({
  calendar = [
    "  mon 09:00..12:00, 13:00..18:00",
    "  tue 09:00..12:00, 13:00..18:00",
    "  except 2026-09-21 off",
  ],
  project = [],
  resource = [],
  task = [],
  milestone = [],
  zone = "Asia/Tokyo",
  asOf = "2026-08-17T09:00:00+09:00",
} = {}) {
  return `${[
    "project DELIVERY:",
    "  version 8",
    '  title "Delivery"',
    `  as_of ${asOf}`,
    "  duration_unit hour",
    "  finish RELEASED",
    `  time_zone ${JSON.stringify(zone)}`,
    '  tzdb "2026c"',
    "  calendar STANDARD",
    ...project,
    "",
    "calendar STANDARD:",
    ...calendar,
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone RELEASED:",
    '  title "Released"',
    ...milestone,
    "",
    "resource DEVICE:",
    '  title "Device"',
    "  capacity 2",
    "  calendar STANDARD",
    ...resource,
    "",
    "task TEST START -> RELEASED:",
    '  title "Test"',
    "  duration 4h",
    ...task,
    "  requires:",
    "    DEVICE 1",
  ].join("\n")}\n`;
}

function parse(text, options) {
  return parseTemporalScheduleSource(
    text,
    TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
    options,
  );
}

function codes(result) {
  return result.diagnostics.map(({ code }) => code);
}

test("TSS-001 keeps the Grammar 8 source capability internal and identity checked", async () => {
  const fixture = JSON.parse(
    await readFile("test/fixtures/temporal-schedule-source-core-v1.json", "utf8"),
  );
  assert.equal(fixture.cases.length, 14);
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    Array.from({ length: 14 }, (_, index) => `TSS-${String(index + 1).padStart(3, "0")}`),
  );
  assert.equal(Object.isFrozen(TEMPORAL_SCHEDULE_SOURCE_CAPABILITY), true);
  assert.equal(TEMPORAL_SCHEDULE_SOURCE_MODEL_VERSION, 1);
  assert.deepEqual(TEMPORAL_SCHEDULE_SOURCE_LIMITS, {
    calendars: 256,
    weeklyWindowsPerCalendar: 64,
    exceptionsPerCalendar: 4096,
    availabilityOverridesPerResource: 4096,
    aggregateChangeInstants: 100000,
  });
  assert.throws(
    () => parseTemporalScheduleSource("", { ...TEMPORAL_SCHEDULE_SOURCE_CAPABILITY }),
    /Grammar 8 temporal schedule source capability is required/,
  );
  for (const name of [
    "TEMPORAL_SCHEDULE_SOURCE_CAPABILITY",
    "parseTemporalScheduleSource",
    "formatTemporalScheduleSource",
    "planTemporalScheduleSourceMutation",
    "TZDB_2026C_TRANSITIONS",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
});

test("TSS-002 delegates every legacy grammar without changing active behavior", () => {
  for (const version of [1, 2, 3, 4, 5, 6, 7]) {
    const text = `${[
      "project LEGACY:",
      `  version ${version}`,
      '  title "Legacy"',
      "  as_of 2026-08-17",
      "  duration_unit point",
      "  finish END",
      "",
      "milestone START:",
      '  title "Start"',
      "  state reached",
      "",
      "milestone END:",
      '  title "End"',
      "",
      "task WORK START -> END:",
      '  title "Work"',
      "  duration 1p",
    ].join("\n")}\n`;
    const result = parse(text);
    assert.equal(result.ok, true, `Grammar ${version}: ${JSON.stringify(result.diagnostics)}`);
    assert.equal(result.grammarVersion, version);
    assert.equal(result.model, null);
  }
  assert.equal(publicApi.checkDocument(source()).ok, false);
});

test("TSS-003 projects reusable calendars, generic availability, and event bounds", () => {
  const text = source({
    resource: [
      "  available_from 2026-08-17T09:00:00+09:00",
      "  available_until 2026-10-01T00:00:00+09:00",
      "  availability 2026-09-01T09:00:00+09:00..2026-09-01T18:00:00+09:00 capacity 1",
    ],
    task: [
      "  when finish latest 2026-09-30T18:00:00+09:00",
      "  when start earliest 2026-08-18T09:00:00+09:00",
    ],
    milestone: ["  when reach latest 2026-09-30T18:00:00+09:00"],
  });
  const result = parse(text);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.ok(result.model);
  assert.equal(Object.isFrozen(result.model), true);
  assert.equal(result.model.asOf.sourceText, "2026-08-17T09:00:00+09:00");
  assert.deepEqual(result.model.profile, {
    kind: "named_zone",
    zoneId: "Asia/Tokyo",
    tzdbRelease: "2026c",
    calendarId: "STANDARD",
    workdayHours: null,
  });
  assert.deepEqual(result.model.calendars[0].weekdays.map(({ weekday }) => weekday), ["mon", "tue"]);
  assert.equal(result.model.resources[0].overrides[0].capacity, 1);
  assert.deepEqual(result.model.taskBounds.map(({ event, direction }) => [event, direction]), [
    ["finish", "latest"],
    ["start", "earliest"],
  ]);
  const bound = result.model.taskBounds[0];
  assert.equal(text.slice(bound.value.span.start.offset, bound.value.span.end.offset), bound.value.sourceText);
});

test("TSS-004 validates pinned IANA offsets across ordinary and DST instants", () => {
  const before = parse(source({
    zone: "America/New_York",
    asOf: "2026-03-08T01:30:00-05:00",
    task: ["  when start earliest 2026-03-08T03:30:00-04:00"],
  }));
  assert.equal(before.ok, true, JSON.stringify(before.diagnostics));
  const mismatch = parse(source({
    zone: "America/New_York",
    asOf: "2026-03-08T03:30:00-05:00",
  }));
  assert.equal(mismatch.ok, false);
  assert.equal(codes(mismatch).includes("PTSCH-105"), true);
  const unknown = parse(source({ zone: "Mars/Olympus" }));
  assert.equal(unknown.ok, false);
  assert.equal(codes(unknown).includes("PTSCH-105"), true);
});

test("TSS-005 validates windows and exceptions and projects canonical order", () => {
  const ordered = parse(source({ calendar: [
    "  except 2026-09-22 10:00..16:00",
    "  fri off",
    "  tue 13:00..18:00",
    "  mon 09:00..12:00",
    "  except 2026-09-21 off",
  ] }));
  assert.equal(ordered.ok, true);
  assert.deepEqual(ordered.model.calendars[0].weekdays.map(({ weekday }) => weekday), ["mon", "tue", "fri"]);
  assert.deepEqual(ordered.model.calendars[0].exceptions.map(({ date }) => date), ["2026-09-21", "2026-09-22"]);
  for (const calendar of [
    ["  mon 09:00..12:00, 12:00..18:00"],
    ["  mon 18:00..09:00"],
    ["  mon 24:00..24:00"],
    ["  except 2026-02-30 off"],
    ["  mon 09:00..12:00", "  mon 13:00..18:00"],
  ]) {
    const invalid = parse(source({ calendar }));
    assert.equal(invalid.ok, false, calendar.join("; "));
    assert.equal(codes(invalid).includes("PTSCH-103"), true);
  }
});

test("TSS-006 validates generic validity and nonoverlapping capacity replacements", () => {
  const sorted = parse(source({ resource: [
    "  availability 2026-09-02T09:00:00+09:00..2026-09-02T10:00:00+09:00 capacity 0",
    "  availability 2026-09-01T09:00:00+09:00..2026-09-01T10:00:00+09:00 capacity 2",
  ] }));
  assert.equal(sorted.ok, true);
  assert.deepEqual(sorted.model.resources[0].overrides.map(({ capacity }) => capacity), [2, 0]);
  for (const resource of [
    ["  available_from 2026-09-02T09:00:00+09:00", "  available_until 2026-09-01T09:00:00+09:00"],
    ["  availability 2026-09-01T09:00:00+09:00..2026-09-01T10:00:00+09:00 capacity 3"],
    [
      "  availability 2026-09-01T09:00:00+09:00..2026-09-01T11:00:00+09:00 capacity 1",
      "  availability 2026-09-01T10:00:00+09:00..2026-09-01T12:00:00+09:00 capacity 1",
    ],
  ]) {
    const invalid = parse(source({ resource }));
    assert.equal(invalid.ok, false);
    assert.equal(codes(invalid).includes("PTSCH-104"), true);
  }
});

test("TSS-007 rejects incomplete profiles, references, offsets, and source limits", () => {
  const incomplete = parse(source().replace('  tzdb "2026c"\n', ""));
  assert.equal(codes(incomplete).includes("PTSCH-101"), true);
  const reference = parse(source().replace("  calendar STANDARD\n", "  calendar UNKNOWN\n"));
  assert.equal(codes(reference).includes("PTSCH-102"), true);
  const duplicate = parse(source().replace("calendar STANDARD:", "calendar DEVICE:"));
  assert.equal(codes(duplicate).includes("PTSCH-102"), true);
  const calendars = Array.from({ length: 257 }, (_, index) => `calendar C${index}:\n`).join("\n");
  const limited = parse(source() + calendars);
  assert.equal(codes(limited).includes("PTSCH-109"), true);
});

test("TSS-008 closes event pairs and rejects the legacy not_before alias", () => {
  const exact = parse(source({ task: [
    "  when start earliest 2026-09-01T09:00:00+09:00",
    "  when start latest 2026-09-01T09:00:00+09:00",
  ] }));
  assert.equal(exact.ok, true);
  const reversed = parse(source({ task: [
    "  when start earliest 2026-09-02T09:00:00+09:00",
    "  when start latest 2026-09-01T09:00:00+09:00",
  ] }));
  assert.equal(codes(reversed).includes("PTSCH-107"), true);
  const duplicate = parse(source({ milestone: [
    "  when reach latest 2026-09-01T09:00:00+09:00",
    "  when reach latest 2026-09-02T09:00:00+09:00",
  ] }));
  assert.equal(codes(duplicate).includes("PTSCH-106"), true);
  const legacy = parse(source({ task: ["  not_before 2026-09-01T09:00:00+09:00"] }));
  assert.equal(codes(legacy).includes("PTSCH-108"), true);
  const continuous = source({
    asOf: "2026-08-17",
    task: ["  when start earliest 2026-09-01T09:00:00+09:00"],
  })
    .replace('  time_zone "Asia/Tokyo"\n', "")
    .replace('  tzdb "2026c"\n', "")
    .replaceAll("  calendar STANDARD\n", "")
    .replace(/calendar STANDARD:\n[\s\S]*?\n(?=milestone START:)/u, "");
  assert.equal(codes(parse(continuous)).includes("PTSCH-106"), true);
});

test("TSS-009 formats only owned values and is idempotent", () => {
  const text = source({
    calendar: [
      "  fri off",
      "  tue 13:00..18:00",
      "  mon 09:00..12:00",
      "  # retained calendar comment",
      "  except 2026-09-22 off",
      "  except 2026-09-21 10:00..16:00",
    ],
    resource: [
      "  availability 2026-09-02T09:00:00.000+09:00..2026-09-02T10:00:00.000+09:00 capacity 1",
      "  availability 2026-09-01T09:00:00.000+09:00..2026-09-01T10:00:00.000+09:00 capacity 2",
    ],
    task: [
      "  when finish latest 2026-09-30T18:00:00.000+09:00",
      "  when start earliest 2026-09-01T09:00:00.000+09:00",
    ],
  });
  const formatted = formatTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(formatted.ok, true);
  assert.equal(formatted.changed, true);
  assert.match(formatted.formattedText, /# retained calendar comment/u);
  assert.doesNotMatch(formatted.formattedText, /fri off/u);
  assert.ok(formatted.formattedText.indexOf("mon 09:00") < formatted.formattedText.indexOf("tue 13:00"));
  assert.ok(formatted.formattedText.indexOf("2026-09-01T09:00") < formatted.formattedText.indexOf("2026-09-02T09:00"));
  const repeated = formatTemporalScheduleSource(
    formatted.formattedText,
    TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
  );
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.edits, []);
});

test("TSS-010 validates the complete candidate before returning a mutation plan", () => {
  const text = source();
  const titleStart = text.indexOf('"Delivery"');
  const valid = planTemporalScheduleSourceMutation(
    text,
    [{ startOffset: titleStart, endOffset: titleStart + 10, replacement: '"Updated"' }],
    TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
  );
  assert.equal(valid.ok, true);
  assert.match(valid.updatedText, /title "Updated"/u);
  const calendarStart = text.indexOf("STANDARD", text.indexOf("time_zone"));
  const invalid = planTemporalScheduleSourceMutation(
    text,
    [{ startOffset: calendarStart, endOffset: calendarStart + 8, replacement: "UNKNOWN" }],
    TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.updatedText, null);
  assert.deepEqual(invalid.edits, []);
  assert.equal(codes(invalid).includes("PTSCH-102"), true);
});

test("TSS-011 retains exact CRLF/BOM spans and total diagnostic counts", () => {
  const text = `\uFEFF${source({ task: [
    "  when start earliest invalid",
    "  when start earliest invalid-again",
  ] }).replaceAll("\n", "\r\n")}`;
  const result = parse(text, { maxDiagnostics: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnosticsTruncated, true);
  assert.ok(result.diagnosticCounts.errors >= 2);
  const span = result.diagnostics[0].span;
  assert.ok(span);
  assert.equal(text.slice(span.start.offset, span.end.offset).length > 0, true);
});

test("TSS-012 composes existing Grammar 7 milestone acceptance source", async () => {
  const grammar7 = await readFile("plans/release-0.9.4.pert", "utf8");
  const grammar8 = grammar7.replace("  version 7", "  version 8");
  const result = parse(grammar8);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.grammarVersion, 8);
  assert.equal(result.model.profile.kind, "continuous_fixed_offset");
});

test("TSS-013 embeds one exact deeply immutable offline zone-data artifact", () => {
  assert.equal(TZDB_2026C_ARCHIVE_SHA256, archiveDigest);
  assert.deepEqual(TZDB_2026C_RANGE, { start: 0, end: 4102444800 });
  assert.equal(Object.keys(TZDB_2026C_TRANSITIONS).length, 598);
  assert.equal(Object.isFrozen(TZDB_2026C_TRANSITIONS), true);
  assert.equal(Object.isFrozen(TZDB_2026C_TRANSITIONS["America/New_York"]), true);
  assert.equal(Object.isFrozen(TZDB_2026C_TRANSITIONS["America/New_York"][0]), true);
  assert.deepEqual(TZDB_2026C_TRANSITIONS["Asia/Tokyo"], [[0, 32400]]);
});

test("TSS-014 leaves active catalogs, facade counts, and source bytes unchanged", async () => {
  const contract = JSON.parse(
    await readFile("test/fixtures/temporal-schedule-contract-v1.json", "utf8"),
  );
  const active = contract.active_runtime_unchanged;
  assert.equal(Object.keys(publicApi).length, active.root_exports);
  assert.equal(Object.keys(publicApi.COMMAND_REGISTRY).length, active.commands);
  assert.equal(publicApi.getJsonSchemaCatalog().length, active.root_schemas);
  assert.equal(publicApi.getGuide(null, "index").cliContractVersion, active.cli_contract_version);
  const text = source();
  parse(text);
  assert.equal(text, source());
});

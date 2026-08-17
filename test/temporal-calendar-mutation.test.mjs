import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { planCalendarMutation } from "../dist/temporal-schedule/calendar-mutation.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../dist/temporal-schedule/source.js";

const source = `${[
  "project CALENDAR_MUTATION:", "  version 8", '  title "Calendar mutation"',
  "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
  "calendar STANDARD:", "  # retained calendar note", "  mon 09:00..17:00", "",
  "milestone START:", '  title "Start"', "  state reached", "",
  "milestone END:", '  title "End"', "",
  "resource DEV:", '  title "Developer"', "  capacity 1", "  calendar STANDARD", "",
  "task WORK START -> END:", '  title "Work"', "  duration 1h", "  requires:", "    DEV 1",
].join("\r\n")}\r\n`;

test("calendar add and set produce one complete validated Grammar 8 candidate", () => {
  const added = planCalendarMutation(source, { action: "add", id: "NIGHT",
    weekdays: ["mon 20:00..24:00", "tue 00:00..04:00"], exceptions: ["2026-08-18 off"] },
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(added.ok, true, JSON.stringify(added.diagnostics));
  assert.match(added.updatedText, /calendar NIGHT:\r\n  mon 20:00\.\.24:00\r\n  tue 00:00\.\.04:00\r\n  except 2026-08-18 off\r\n/u);
  assert.equal(parseTemporalScheduleSource(added.updatedText, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY).ok, true);

  const changed = planCalendarMutation(added.updatedText, { action: "set", id: "STANDARD",
    weekdays: ["mon 08:00..12:00, 13:00..18:00"], exceptions: ["2026-08-19 off"] },
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
  assert.match(changed.updatedText, /calendar STANDARD:\r\n  # retained calendar note\r\n  mon 08:00\.\.12:00, 13:00\.\.18:00\r\n  except 2026-08-19 off\r\n/u);
  assert.doesNotMatch(changed.updatedText, /mon 09:00\.\.17:00/u);
});

test("calendar remove is reference-safe and source preserving", () => {
  const referenced = planCalendarMutation(source, { action: "remove", id: "STANDARD" }, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(referenced.ok, false);
  assert.equal(referenced.updatedText, null);
  assert.ok(referenced.diagnostics.some(({ code }) => code === "PTSCH-102"));

  const added = planCalendarMutation(source, { action: "add", id: "UNUSED" }, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  const removed = planCalendarMutation(added.updatedText, { action: "remove", id: "UNUSED" }, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(removed.ok, true, JSON.stringify(removed.diagnostics));
  assert.equal(removed.updatedText, source);
});

test("calendar mutations reject missing identities, invalid values, and forged capabilities", () => {
  const missing = planCalendarMutation(source, { action: "set", id: "MISSING", weekdays: ["mon off"] }, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(missing.ok, false);
  assert.match(missing.diagnostics.at(-1).message, /does not exist/u);
  const invalid = planCalendarMutation(source, { action: "set", id: "STANDARD", weekdays: ["mon 17:00..09:00"] }, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.updatedText, null);
  assert.throws(() => planCalendarMutation(source, { action: "remove", id: "STANDARD" }, { ...TEMPORAL_SCHEDULE_SOURCE_CAPABILITY }), /capability is required/u);
  assert.equal("planCalendarMutation" in publicApi, false);
});

import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { planTemporalEntityMutation } from "../dist/temporal-schedule/entity-mutation.js";
import { TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../dist/temporal-schedule/source.js";

const source = `${[
  "project ENTITY_MUTATION:", "  version 8", '  title "Entity mutation"',
  "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "  workday 8h", "",
  "calendar STANDARD:", "  mon 09:00..17:00", "",
  "calendar SHORT:", "  mon 10:00..16:00", "",
  "milestone START:", '  title "Start"', "  state reached", "",
  "milestone END:", '  title "End"', "  # milestone note", "",
  "resource DEV:", '  title "Developer"', "  capacity 2", "  # availability note", "",
  "task WORK START -> END:", '  title "Work"', "  duration 1h", "  # task note", "  priority 10", "  requires:", "    DEV 1",
].join("\r\n")}\r\n`;

function mutate(text, mutation) {
  return planTemporalEntityMutation(text, mutation, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
}

test("project and resource temporal fields compose in complete validated candidates", () => {
  const project = mutate(source, { kind: "project.set", set: {
    timeZone: '"Asia/Tokyo"', tzdb: '"2026c"', calendar: "STANDARD", workday: "8h",
  } });
  assert.equal(project.ok, true, JSON.stringify(project.diagnostics));
  assert.match(project.updatedText, /finish END\r\n  time_zone "Asia\/Tokyo"\r\n  tzdb "2026c"\r\n  calendar STANDARD\r\n  workday 8h/u);
  const resource = mutate(project.updatedText, { kind: "resource.set", id: "DEV", set: {
    calendar: "SHORT", availableFrom: "2026-08-17T09:00:00+09:00", availableUntil: "2026-12-31T18:00:00+09:00",
    availability: ["2026-08-18T09:00:00+09:00..2026-08-18T12:00:00+09:00 capacity 1"],
  } });
  assert.equal(resource.ok, true, JSON.stringify(resource.diagnostics));
  assert.match(resource.updatedText, /capacity 2\r\n  # availability note\r\n  calendar SHORT\r\n  available_from/u);
  assert.match(resource.updatedText, /# availability note/u);
});

test("task and milestone when values are complete ordered option sets", () => {
  const project = mutate(source, { kind: "project.set", set: {
    timeZone: '"Asia/Tokyo"', tzdb: '"2026c"', calendar: "STANDARD",
  } });
  const task = mutate(project.updatedText, { kind: "task.set", id: "WORK", when: [
    "start earliest 2026-08-17T10:00:00+09:00", "finish latest 2026-08-17T15:00:00+09:00",
  ] });
  assert.equal(task.ok, true, JSON.stringify(task.diagnostics));
  assert.match(task.updatedText, /duration 1h\r\n  # task note\r\n  when start earliest/u);
  assert.match(task.updatedText, /# task note/u);
  const milestone = mutate(task.updatedText, { kind: "milestone.set", id: "END",
    when: ["reach latest 2026-08-17T16:00:00+09:00"] });
  assert.equal(milestone.ok, true, JSON.stringify(milestone.diagnostics));
  assert.match(milestone.updatedText, /# milestone note/u);
});

test("partial profiles, invalid intervals, unknown entities, and forged capabilities fail closed", () => {
  assert.equal(mutate(source, { kind: "project.set", set: { tzdb: null } }).ok, false);
  const missing = mutate(source, { kind: "resource.set", id: "MISSING", set: { calendar: "STANDARD" } });
  assert.equal(missing.ok, false);
  assert.equal(missing.changed, false);
  assert.equal(missing.diagnostics.at(-1).code, "PTSCH-102");
  assert.throws(() => planTemporalEntityMutation(source, { kind: "task.set", id: "WORK", when: [] },
    { ...TEMPORAL_SCHEDULE_SOURCE_CAPABILITY }), /capability is required/u);
  assert.equal("planTemporalEntityMutation" in publicApi, false);
});

test("replacement and removal preserve comments between temporal fields", () => {
  const configured = mutate(source, { kind: "project.set", set: {
    timeZone: '"Asia/Tokyo"', tzdb: '"2026c"', calendar: "STANDARD", workday: "8h",
  } });
  const withComment = configured.updatedText.replace(
    '  time_zone "Asia/Tokyo"\r\n  tzdb "2026c"',
    '  time_zone "Asia/Tokyo"\r\n  # temporal ownership note\r\n  tzdb "2026c"',
  );
  const changed = mutate(withComment, { kind: "project.set", set: {
    timeZone: '"Asia/Tokyo"', tzdb: '"2026c"', calendar: "SHORT", workday: null,
  } });
  assert.equal(changed.ok, true, JSON.stringify(changed.diagnostics));
  assert.match(changed.updatedText, /time_zone "Asia\/Tokyo"\r\n  # temporal ownership note\r\n  tzdb "2026c"\r\n  calendar SHORT/u);
  assert.match(changed.updatedText, /  tzdb "2026c"/u);
  assert.doesNotMatch(changed.updatedText, /  workday /u);
});

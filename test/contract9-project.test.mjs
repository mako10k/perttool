import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { getProjectMetadata } from "../dist/application/contract9-project.js";

const source = `${[
  "project CONTRACT9_PROJECT:", "  version 8", '  title "Project"',
  "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "  workday 8h", "",
  "calendar STANDARD:", "  mon 09:00..12:00, 13:00..18:00", "",
  "milestone START:", '  title "Start"', "  state reached", "",
  "milestone END:", '  title "End"', "  when reach latest 2026-08-18T18:00:00+09:00", "",
  "resource DEV:", '  title "Developer"', "  capacity 1", "  calendar STANDARD",
  "  available_until 2026-12-31T18:00:00+09:00", "",
  "task WORK START -> END:", '  title "Work"', "  duration 1h", "  requires:", "    DEV 1",
].join("\n")}\n`;

test("ProjectResult v5 exposes the one authoritative Grammar 8 temporal source model", () => {
  const result = getProjectMetadata(source);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.ProjectResult.v5");
  assert.equal(result.grammarVersion, 8);
  assert.equal(result.project.version, 8);
  assert.equal(result.temporalSchedule.profile.kind, "named_zone");
  assert.equal(result.temporalSchedule.profile.zoneId, "Asia/Tokyo");
  assert.equal(result.temporalSchedule.calendars[0].id, "STANDARD");
  assert.equal(result.temporalSchedule.resources[0].resourceId, "DEV");
  assert.equal(result.temporalSchedule.milestoneBounds[0].entityId, "END");
  assert.equal("getContract9ProjectMetadata" in publicApi, false);
});

test("ProjectResult v5 keeps legacy project meaning and has no invented calendar", () => {
  const legacy = source.replace("  version 8", "  version 7")
    .replace('  time_zone "Asia/Tokyo"\n  tzdb "2026c"\n  calendar STANDARD\n  workday 8h\n', "")
    .replace("calendar STANDARD:\n  mon 09:00..12:00, 13:00..18:00\n\n", "")
    .replace("  when reach latest 2026-08-18T18:00:00+09:00\n", "")
    .replace("  calendar STANDARD\n  available_until 2026-12-31T18:00:00+09:00\n", "");
  const result = getProjectMetadata(legacy);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.schemaVersion, "Perttool.ProjectResult.v5");
  assert.equal(result.grammarVersion, 7);
  assert.equal(result.project.version, 7);
  assert.equal(result.temporalSchedule, null);
});

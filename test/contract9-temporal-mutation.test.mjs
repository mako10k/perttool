import assert from "node:assert/strict";
import test from "node:test";
import { planContract9TemporalMutation } from "../dist/application/contract9-temporal-mutation.js";
import { validateContract9CommandInvocation } from "../dist/command/contract9-usage.js";

const source = `${[
  "project DISPATCH:", "  version 8", '  title "Dispatch"', "  as_of 2026-08-17T09:00:00+09:00",
  "  duration_unit hour", "  finish END", '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
  "calendar STANDARD:", "  mon 09:00..17:00", "", "calendar SHORT:", "  mon 10:00..16:00", "",
  "milestone START:", '  title "Start"', "  state reached", "", "milestone END:", '  title "End"', "",
  "resource DEV:", '  title "Developer"', "  capacity 1", "", "task WORK START -> END:", '  title "Work"', "  duration 1h",
].join("\n")}\n`;

function invocation(...argv) {
  const checked = validateContract9CommandInvocation(argv);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.error.message);
  return checked;
}

test("Contract 9 temporal dispatcher connects all five mutation surfaces", () => {
  const calendar = planContract9TemporalMutation(source,
    invocation("calendar", "set", "plan.pert", "SHORT", "--weekday", "mon 11:00..15:00"));
  assert.equal(calendar.ok, true, JSON.stringify(calendar.diagnostics));
  assert.match(calendar.updatedText, /calendar SHORT:\n  mon 11:00\.\.15:00/u);
  const project = planContract9TemporalMutation(calendar.updatedText,
    invocation("project", "set", "plan.pert", "--calendar", "SHORT", "--workday", "7h"));
  assert.equal(project.ok, true, JSON.stringify(project.diagnostics));
  assert.match(project.updatedText, /  calendar SHORT\n  workday 7h/u);
  const resource = planContract9TemporalMutation(project.updatedText,
    invocation("resource", "set", "plan.pert", "DEV", "--calendar", "SHORT", "--available-until", "2026-12-31T18:00:00+09:00"));
  assert.equal(resource.ok, true, JSON.stringify(resource.diagnostics));
  const task = planContract9TemporalMutation(resource.updatedText,
    invocation("task", "set", "plan.pert", "WORK", "--when", "finish latest 2026-08-17T16:00:00+09:00"));
  assert.equal(task.ok, true, JSON.stringify(task.diagnostics));
  const milestone = planContract9TemporalMutation(task.updatedText,
    invocation("milestone", "set", "plan.pert", "END", "--when", "reach latest 2026-08-17T17:00:00+09:00"));
  assert.equal(milestone.ok, true, JSON.stringify(milestone.diagnostics));
  assert.match(milestone.updatedText, /when reach latest 2026-08-17T17:00:00\+09:00/u);
});

test("legacy-only invocations remain assigned to the existing mutation path", () => {
  assert.equal(planContract9TemporalMutation(source,
    invocation("task", "set", "plan.pert", "WORK", "--title", "Renamed")), null);
});

test("clear produces complete replacement sets and mixed clear conflicts fail before planning", () => {
  const withBounds = planContract9TemporalMutation(source,
    invocation("task", "set", "plan.pert", "WORK", "--when", "start earliest 2026-08-17T10:00:00+09:00"));
  const cleared = planContract9TemporalMutation(withBounds.updatedText,
    invocation("task", "set", "plan.pert", "WORK", "--clear", "when"));
  assert.equal(cleared.ok, true, JSON.stringify(cleared.diagnostics));
  assert.doesNotMatch(cleared.updatedText, /  when /u);
  assert.throws(() => planContract9TemporalMutation(source,
    invocation("task", "set", "plan.pert", "WORK", "--when", "finish latest 2026-08-17T16:00:00+09:00", "--clear", "when")),
  /conflicts/u);
});

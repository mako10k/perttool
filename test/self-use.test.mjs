import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeDocument,
  checkDocument,
  convertWithVelocity,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function exact(value) {
  return `${value.numerator}/${value.denominator}`;
}

test("grammar plan check/analyze/next matches the read-only self-use golden", async () => {
  const text = await readFile(path.join(root, "plans/grammar.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/grammar.expected.json"),
    "utf8",
  ));
  const checked = checkDocument(text);
  const analyzed = analyzeDocument(text);
  const next = selectNextTasks(text);
  assert.equal(checked.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.ok(analyzed.precedence);
  assert.ok(analyzed.resource);
  const rejectionTask = next.tasks.find(({ id }) => id === "FIELD_FIXTURES");
  assert.ok(rejectionTask);
  assert.equal(rejectionTask.resourceRejections.length, 1);
  const rejection = rejectionTask.resourceRejections[0];
  const actual = {
    check: {
      document_id: checked.documentId,
      grammar_version: checked.grammarVersion,
      summary: checked.summary,
    },
    analyze: {
      duration_unit: analyzed.durationUnit,
      precedence_makespan: analyzed.precedence.makespan.numerator.toString(),
      precedence_forecast_unit: analyzed.velocityForecast.targetUnit,
      precedence_forecast: exact(convertWithVelocity(
        analyzed.precedence.makespan,
        analyzed.velocityForecast,
      )),
      precedence_critical_tasks: analyzed.precedence.critical.taskIds,
      resource_makespan: analyzed.resource.makespan.numerator.toString(),
      resource_forecast: exact(convertWithVelocity(
        analyzed.resource.makespan,
        analyzed.velocityForecast,
      )),
      resource_delay: analyzed.resource.resourceDelay.numerator.toString(),
      resource_arcs: analyzed.resource.resourceArcs.map(({ id }) => id),
      schedule_critical_tasks: analyzed.resource.scheduleCritical.taskIds,
    },
    next: {
      groups: {
        active: next.groups.active,
        ready: next.groups.ready,
        runnable_now: next.groups.runnableNow,
        blocked_now: next.groups.blockedNow,
        upcoming: next.groups.upcoming,
      },
      resource_rejection: {
        task_id: rejectionTask.id,
        resource_id: rejection.resourceId,
        capacity: rejection.capacity,
        earlier_selected_task_ids: rejection.earlierSelectedTaskIds,
      },
    },
  };
  assert.deepEqual(actual, expected);
});

test("MVP plan check/analyze/next matches the macro roadmap golden", async () => {
  const text = await readFile(path.join(root, "plans/mvp.pert"), "utf8");
  const expected = JSON.parse(await readFile(
    path.join(testDirectory, "golden/self-use/mvp.expected.json"),
    "utf8",
  ));
  const checked = checkDocument(text);
  const analyzed = analyzeDocument(text);
  const next = selectNextTasks(text);
  assert.equal(checked.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.ok(analyzed.precedence);
  assert.ok(analyzed.resource);
  const actual = {
    check: {
      document_id: checked.documentId,
      grammar_version: checked.grammarVersion,
      summary: checked.summary,
    },
    analyze: {
      precedence_makespan: analyzed.precedence.makespan.numerator.toString(),
      precedence_critical_tasks: analyzed.precedence.critical.taskIds,
      resource_makespan: analyzed.resource.makespan.numerator.toString(),
      resource_delay: analyzed.resource.resourceDelay.numerator.toString(),
      resource_arcs: analyzed.resource.resourceArcs.map(({ id }) => id),
      schedule_critical_tasks: analyzed.resource.scheduleCritical.taskIds,
    },
    next: {
      groups: {
        active: next.groups.active,
        ready: next.groups.ready,
        runnable_now: next.groups.runnableNow,
        blocked_now: next.groups.blockedNow,
        upcoming: next.groups.upcoming,
      },
    },
  };
  assert.deepEqual(actual, expected);
});

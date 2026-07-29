import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(testDirectory, "fixtures/recommendation");
const manifestPath = path.join(fixtureDirectory, "cases.json");
const goldenPath = path.join(
  testDirectory,
  "golden/recommendation/v2-projection.expected.json",
);
const cli = path.join(root, "dist/cli.js");

function exact(value) {
  if (value === null) return null;
  return `${value.numerator}/${value.denominator}${value.unit}`;
}

function projectTask(task) {
  return {
    id: task.id,
    status: task.status,
    classification: task.classification,
    runnable_now: task.runnable_now,
    priority: task.priority,
    blocked_reason: task.blocked_reason,
  };
}

function projectTaskFact(task) {
  return {
    id: task.id,
    expected: exact(task.expected),
    total_float: exact(task.total_float),
    earliest_start: exact(task.earliest_start),
    precedence_critical: task.precedence_critical,
    schedule_critical: task.schedule_critical,
    requirements: task.requirements,
  };
}

function runCurrent(relativeFixture) {
  const result = spawnSync(
    process.execPath,
    [cli, "dag", "next", `test/fixtures/recommendation/${relativeFixture}`, "--format=json"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const json = JSON.parse(result.stdout);
  return {
    schema_version: json.schema_version,
    groups: json.groups,
    tasks: json.tasks.map(projectTask),
    task_facts: json.tasks
      .filter(({ classification }) => classification === "ready" || classification === "active")
      .map(projectTaskFact),
    resource_rejections: Object.fromEntries(
      json.tasks
        .filter(({ resource_rejections }) => resource_rejections.length > 0)
        .map(({ id, resource_rejections }) => [id, resource_rejections]),
    ),
    upcoming_explanations: Object.fromEntries(
      json.tasks
        .filter(({ classification, explanation }) =>
          classification === "upcoming" && explanation.length > 0)
        .map(({ id, explanation }) => [id, JSON.stringify(explanation)]),
    ),
  };
}

test("REC-001 through REC-011 have a complete fixture or unit-input baseline", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.schema_version, "Perttool.RecommendationFixtureBaseline.v1");
  assert.equal(
    manifest.algorithm_id,
    "perttool.recommendation-ranking.lexicographic-frontier",
  );
  assert.equal(manifest.algorithm_version, 1);
  assert.deepEqual(
    manifest.cases.map(({ case_id }) => case_id),
    Array.from({ length: 11 }, (_, index) => `REC-${String(index + 1).padStart(3, "0")}`),
  );

  for (const entry of manifest.cases) {
    assert.ok(entry.fixture !== undefined || entry.unit_input !== undefined, entry.case_id);
    if (entry.fixture !== undefined) {
      const source = await readFile(path.join(fixtureDirectory, entry.fixture), "utf8");
      const checked = checkDocument(source);
      assert.equal(checked.ok, true, entry.case_id);
      assert.equal(checked.diagnostics.length, 0, entry.case_id);
      const projection = runCurrent(entry.fixture);
      assert.deepEqual(
        [...projection.groups.ready].sort(),
        [...entry.expected.ready_task_ids].sort(),
        entry.case_id,
      );
      for (const [taskId, candidate] of Object.entries(entry.candidate_facts)) {
        const task = projection.tasks.find(({ id }) => id === taskId);
        const facts = projection.task_facts.find(({ id }) => id === taskId);
        if (task === undefined || facts === undefined) {
          const rejection = Object.values(projection.resource_rejections)
            .flat()
            .find(({ resource_id }) => resource_id === taskId);
          assert.ok(rejection, `${entry.case_id}:${taskId}:known fixture entity`);
          assert.equal(rejection.capacity, candidate.capacity, `${entry.case_id}:${taskId}:capacity`);
          assert.equal(
            rejection.active_usage,
            candidate.active_usage,
            `${entry.case_id}:${taskId}:active_usage`,
          );
          assert.deepEqual(
            rejection.active_task_ids,
            candidate.active_task_ids,
            `${entry.case_id}:${taskId}:active_task_ids`,
          );
          continue;
        }
        if (candidate.critical_class !== undefined) {
          assert.equal(
            facts.precedence_critical ? "driving" : "non_critical",
            candidate.critical_class,
            `${entry.case_id}:${taskId}:critical_class`,
          );
        }
        if (candidate.total_float !== undefined) {
          assert.equal(
            facts.total_float.replace(/point$/, "p"),
            candidate.total_float,
            `${entry.case_id}:${taskId}:total_float`,
          );
        }
        if (candidate.priority !== undefined) {
          assert.equal(task.priority, candidate.priority, `${entry.case_id}:${taskId}:priority`);
        }
        if (candidate.requirements !== undefined) {
          assert.deepEqual(
            Object.fromEntries(facts.requirements.map(({ resource_id, units }) =>
              [resource_id, units])),
            candidate.requirements,
            `${entry.case_id}:${taskId}:requirements`,
          );
        }
      }
    }
    const tiers = Object.values(entry.expected.tiers ?? {});
    if (entry.expected.ready_task_ids !== undefined) {
      assert.deepEqual(
        Object.keys(entry.expected.tiers).sort(),
        [...entry.expected.ready_task_ids].sort(),
        `${entry.case_id}:tier coverage`,
      );
      for (const taskId of entry.expected.recommended_task_ids) {
        assert.equal(entry.expected.tiers[taskId], "recommended", `${entry.case_id}:${taskId}`);
      }
    }
    assert.equal(tiers.includes("discouraged"), false, entry.case_id);
  }

  const resourceEmpty = manifest.cases.find(({ case_id }) => case_id === "REC-006");
  const noCandidate = manifest.cases.find(({ case_id }) => case_id === "REC-007");
  assert.deepEqual(resourceEmpty.expected.ready_task_ids, ["FRONTIER_TEST", "SIDE_DOCS"]);
  assert.deepEqual(resourceEmpty.expected.recommended_task_ids, []);
  assert.deepEqual(noCandidate.expected.ready_task_ids, []);
  assert.deepEqual(noCandidate.expected.recommended_task_ids, []);
});

test("NextResult.v5 preserves the stable v2 operational field baseline", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expected = JSON.parse(await readFile(goldenPath, "utf8"));
  const actual = Object.fromEntries(
    manifest.cases
      .filter(({ fixture }) => fixture !== undefined)
      .map(({ case_id, fixture }) => [case_id, runCurrent(fixture)]),
  );
  for (const [caseId, projection] of Object.entries(actual)) {
    assert.equal(projection.schema_version, "Perttool.NextResult.v5");
    const { schema_version: _currentSchema, ...currentOperational } = projection;
    const { schema_version: _baselineSchema, ...baselineOperational } = expected[caseId];
    assert.deepEqual(currentOperational.groups.suspended, [], caseId);
    assert.deepEqual(
      {
        ...currentOperational,
        groups: Object.fromEntries(
          Object.entries(currentOperational.groups).filter(
            ([name]) => name !== "suspended",
          ),
        ),
      },
      baselineOperational,
      caseId,
    );
  }
});

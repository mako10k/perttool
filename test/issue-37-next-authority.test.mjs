import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { getJsonSchema, selectNextTasks } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const fixture = path.join(
  root,
  "test/fixtures/recommendation/rec-008-runnable-authority.pert",
);
const cli = path.join(root, "dist/cli.js");

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return result.stdout;
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schemaRoot = path.join(root, "schemas");
  for (const name of readdirSync(schemaRoot).filter((candidate) =>
    candidate.endsWith(".schema.json")
  )) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(schemaRoot, name), "utf8")));
  }
  return ajv;
}

test("Issue #37 composes raw recommendation with runnable selection before start authority", () => {
  const source = readFileSync(fixture, "utf8");
  const result = selectNextTasks(source);
  assert.equal(result.ok, true);
  assert.deepEqual(result.recommendation.recommendedTaskIds, ["CRITICAL"]);
  assert.deepEqual(result.groups.runnableNow, ["HIGH_PRIORITY"]);
  assert.equal(
    result.tasks.find(({ id }) => id === "CRITICAL").runnableNow,
    false,
  );
  assert.deepEqual(
    result.tasks
      .find(({ id }) => id === "CRITICAL")
      .resourceRejections[0].earlierSelectedTaskIds,
    ["HIGH_PRIORITY"],
  );
  assert.deepEqual(result.temporal.authority.rawRecommendedTaskIds, [
    "CRITICAL",
  ]);
  assert.deepEqual(
    result.temporal.authority.temporalStartableRecommendedTaskIds,
    [],
  );
  assert.deepEqual(
    result.temporal.authority.startableRecommendedTaskIds,
    [],
  );
});

test("Issue #37 JSON and text expose the same non-runnable raw recommendation", () => {
  const before = readFileSync(fixture);
  const json = JSON.parse(run(["dag", "next", fixture, "--format=json"]));
  assert.equal(json.schema_version, "Perttool.NextResult.v8");
  assert.deepEqual(json.recommendation.recommended_task_ids, ["CRITICAL"]);
  assert.deepEqual(json.groups.runnable_now, ["HIGH_PRIORITY"]);
  assert.deepEqual(json.temporal.authority.raw_recommended_task_ids, [
    "CRITICAL",
  ]);
  assert.deepEqual(
    json.temporal.authority.temporal_startable_recommended_task_ids,
    [],
  );
  assert.deepEqual(json.temporal.authority.startable_recommended_task_ids, []);

  const text = run(["dag", "next", fixture, "--color=never"]);
  assert.match(text, /^STARTABLE RECOMMENDED -$/mu);
  assert.match(text, /^NON-RUNNABLE RAW RECOMMENDED CRITICAL$/mu);
  assert.match(text, /^RUNNABLE NOW\nHIGH_PRIORITY /mu);
  assert.deepEqual(readFileSync(fixture), before);
});

test("Issue #37 complete JSON satisfies the active closed schema and documents authority", () => {
  const json = JSON.parse(run(["dag", "next", fixture, "--format=json"]));
  const validate = validator().getSchema(
    "https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v8.schema.json",
  );
  assert.equal(validate(json), true, JSON.stringify(validate.errors));

  const schema = getJsonSchema("Perttool.NextResult.v8");
  const authority = schema.$defs.nextTemporal.properties.authority.properties;
  assert.match(
    authority.startable_recommended_task_ids.description,
    /groups[.]runnable_now/u,
  );
  assert.match(
    authority.raw_recommended_task_ids.description,
    /informational and non-executable/u,
  );
});

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { getProjectMetadata } from "../dist/application/contract9-project.js";
import { analyzeDocument } from "../dist/application/contract9-temporal.js";
import { contract7SnakeJson } from "../dist/application/contract7-projection.js";

const activeDirectory = "schemas";
const identities = Object.freeze([
  "Perttool.AnalysisResult.v7",
  "Perttool.CheckResult.v6",
  "Perttool.MutationResult.v6",
  "Perttool.NextResult.v8",
  "Perttool.PlanAssuranceResult.v2",
  "Perttool.ProjectResult.v5",
  "Perttool.UnitMigrationResult.v4",
]);
const grammar8 = `${[
  "project SCHEMA_WIRE:", "  version 8", '  title "Schema wire"', "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
  '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "  workday 8h", "", "calendar STANDARD:", "  mon 09:00..12:00, 13:00..18:00", "",
  "milestone START:", '  title "Start"', "  state reached", "", "milestone END:", '  title "End"', "  when reach latest 2026-08-18T18:00:00+09:00", "",
  "resource DEV:", '  title "Developer"', "  capacity 1", "  calendar STANDARD", "", "task WORK START -> END:", '  title "Work"', "  duration 1h", "  requires:", "    DEV 1",
].join("\n")}\n`;

async function schema(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function unspecifiedObjects(value, pointer = "") {
  if (value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => unspecifiedObjects(item, `${pointer}/${index}`));
  const types = Array.isArray(value.type) ? value.type : [value.type];
  const here = types.includes("object") && !Object.hasOwn(value, "properties") &&
    !Object.hasOwn(value, "patternProperties") &&
    !(value.additionalProperties !== null && typeof value.additionalProperties === "object") ? [pointer] : [];
  return [...here, ...Object.entries(value).flatMap(([key, child]) => unspecifiedObjects(child, `${pointer}/${key}`))];
}

function wirePositions(value) {
  if (Array.isArray(value)) return value.map(wirePositions);
  if (value === null || typeof value !== "object") return value;
  const projected = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, wirePositions(child)]));
  if (Object.keys(projected).length === 3 && Number.isInteger(projected.offset) && Number.isInteger(projected.line) && Number.isInteger(projected.column)) {
    projected.line += 1;
    projected.column += 1;
  }
  return projected;
}

test("Contract 9 activates exactly seven replacement schema artifacts at canonical paths", async () => {
  const names = (await readdir(activeDirectory)).sort();
  for (const identity of identities) {
    assert.ok(names.includes(`${identity}.schema.json`), identity);
    const value = await schema(path.join(activeDirectory, `${identity}.schema.json`));
    assert.equal(value.$id, `https://github.com/mako10k/perttool/schemas/${identity}.schema.json`);
    assert.equal(value.title, identity);
    assert.equal(value.properties.schema_version.const, identity);
    assert.equal(value.properties.cli_contract_version.const, 9);
  }
});

test("active Contract 9 schema references compile from canonical paths", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of (await readdir(activeDirectory)).filter((name) => name.endsWith(".schema.json"))) {
    ajv.addSchema(await schema(path.join(activeDirectory, name)));
  }
  for (const identity of identities) {
    assert.equal(typeof ajv.getSchema(`https://github.com/mako10k/perttool/schemas/${identity}.schema.json`), "function");
  }
});

test("active Contract 9 schemas contain no unspecified object shape", async () => {
  const failures = [];
  for (const identity of identities) {
    const value = await schema(path.join(activeDirectory, `${identity}.schema.json`));
    failures.push(...unspecifiedObjects(value).map((pointer) => `${identity}${pointer}`));
  }
  assert.deepEqual(failures, []);
});

test("real Grammar 8 temporal projections satisfy the active nested contracts", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of (await readdir(activeDirectory)).filter((name) => name.endsWith(".schema.json"))) ajv.addSchema(await schema(path.join(activeDirectory, name)));
  const project = wirePositions(contract7SnakeJson(getProjectMetadata(grammar8)));
  const analysis = wirePositions(contract7SnakeJson(analyzeDocument(grammar8)));
  for (const [reference, value] of [
    ["https://github.com/mako10k/perttool/schemas/Perttool.ProjectResult.v5.schema.json#/properties/temporal_schedule", project.temporal_schedule],
    ["https://github.com/mako10k/perttool/schemas/Perttool.AnalysisResult.v7.schema.json#/properties/temporal_schedule", analysis.temporal_schedule],
    ["https://github.com/mako10k/perttool/schemas/Perttool.AnalysisResult.v7.schema.json#/properties/schedule_alerts", analysis.schedule_alerts],
  ]) {
    const validate = ajv.getSchema(reference);
    assert.equal(validate(value), true, `${reference}: ${JSON.stringify(validate.errors)}`);
  }
  const projectWithUnknown = structuredClone(project.temporal_schedule);
  projectWithUnknown.calendars[0].unexpected = true;
  assert.equal(ajv.getSchema("https://github.com/mako10k/perttool/schemas/Perttool.ProjectResult.v5.schema.json#/properties/temporal_schedule")(projectWithUnknown), false);
  const analysisWithUnknown = structuredClone(analysis.temporal_schedule);
  analysisWithUnknown.required.algorithm.unexpected = true;
  assert.equal(ajv.getSchema("https://github.com/mako10k/perttool/schemas/Perttool.AnalysisResult.v7.schema.json#/properties/temporal_schedule")(analysisWithUnknown), false);
});

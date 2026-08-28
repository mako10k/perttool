import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  COMMAND_REGISTRY,
  getJsonSchema,
  getJsonSchemaCatalog,
} from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const schemaDirectory = path.join(root, "schemas");
const schemaBase = "https://github.com/mako10k/perttool/schemas/";
const requestSchemaIds = Object.freeze([
  "Perttool.PlanningObservationRequest.v1",
  "Perttool.PlanningReshapeRequest.v1",
  "Perttool.WindowMutationRequest.v1",
]);

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of readdirSync(schemaDirectory)) {
    if (!name.endsWith(".schema.json")) continue;
    ajv.addSchema(JSON.parse(readFileSync(path.join(schemaDirectory, name), "utf8")));
  }
  return ajv;
}

function runSchema(schemaId) {
  const result = spawnSync(
    process.execPath,
    [cli, "schema", schemaId, "--format=json"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function documentedExamples() {
  const source = readFileSync(
    path.join(root, "docs", "examples", "planning-pool-requests.md"),
    "utf8",
  );
  return [...source.matchAll(/```json\n([\s\S]*?)\n```/gu)].map((match) =>
    JSON.parse(match[1])
  );
}

test("Issue #31 publishes exactly three standalone request schema roots", () => {
  const requestEntries = getJsonSchemaCatalog().filter(
    ({ schemaId }) => requestSchemaIds.includes(schemaId),
  );
  assert.deepEqual(requestEntries.map(({ schemaId }) => schemaId), requestSchemaIds);
  for (const entry of requestEntries) {
    assert.equal(entry.commandResult, false);
    assert.equal(entry.publicLibraryResult, false);
    assert.equal(
      entry.artifactPath,
      `schemas/${entry.schemaId}.schema.json`,
    );
    assert.equal(
      getJsonSchema(entry.schemaId)?.$id,
      `${schemaBase}${entry.schemaId}.schema.json`,
    );
    const selected = runSchema(entry.schemaId);
    assert.equal(selected.schemas.length, 29);
    assert.equal(selected.schema.$id, `${schemaBase}${entry.schemaId}.schema.json`);
  }
});

test("documented Planning Pool request examples compile and validate strictly", () => {
  const ajv = validator();
  const examples = documentedExamples();
  assert.deepEqual(
    examples.map(({ request_schema_version: schemaId }) => schemaId).sort(),
    [...requestSchemaIds].sort(),
  );

  for (const example of examples) {
    const schemaId = example.request_schema_version;
    const validate = ajv.getSchema(`${schemaBase}${schemaId}.schema.json`);
    assert.equal(typeof validate, "function", schemaId);
    assert.equal(validate(example), true, JSON.stringify(validate.errors));
    assert.equal(
      validate({ ...example, unexpected_request_field: true }),
      false,
      `${schemaId} must reject unknown root fields`,
    );
  }
});

test("standalone request schemas reject unsupported enum and version values", () => {
  const ajv = validator();
  const examples = Object.fromEntries(
    documentedExamples().map((example) => [example.request_schema_version, example]),
  );
  const invalid = [
    {
      schemaId: "Perttool.PlanningObservationRequest.v1",
      value: {
        ...examples["Perttool.PlanningObservationRequest.v1"],
        selection: { kind: "unsupported" },
      },
    },
    {
      schemaId: "Perttool.PlanningReshapeRequest.v1",
      value: {
        ...examples["Perttool.PlanningReshapeRequest.v1"],
        request_schema_version: "Perttool.PlanningReshapeRequest.v2",
      },
    },
    {
      schemaId: "Perttool.WindowMutationRequest.v1",
      value: {
        ...examples["Perttool.WindowMutationRequest.v1"],
        operation: "reopen",
      },
    },
  ];
  for (const { schemaId, value } of invalid) {
    const validate = ajv.getSchema(`${schemaBase}${schemaId}.schema.json`);
    assert.equal(validate(value), false, schemaId);
  }
});

test("Contract 10 Help links every low-level request option to its schema", () => {
  const expected = new Map([
    ["work observe", "Perttool.PlanningObservationRequest.v1"],
    ["window observe", "Perttool.PlanningObservationRequest.v1"],
    ["work reshape preflight", "Perttool.PlanningReshapeRequest.v1"],
    ["work reshape apply", "Perttool.PlanningReshapeRequest.v1"],
    ["window add", "Perttool.WindowMutationRequest.v1"],
    ["window set", "Perttool.WindowMutationRequest.v1"],
    ["window close", "Perttool.WindowMutationRequest.v1"],
  ]);
  for (const [commandPath, schemaId] of expected) {
    const command = COMMAND_REGISTRY.find(
      ({ path: segments }) => segments.join(" ") === commandPath,
    );
    const option = command?.options.find(({ name }) => name === "request");
    assert.equal(
      option?.description,
      `Validate against ${schemaId}; discover it with perttool schema ${schemaId}.`,
      commandPath,
    );
  }
});

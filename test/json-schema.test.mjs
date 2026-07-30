import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  COMMAND_REGISTRY,
  getJsonSchema,
  getJsonSchemaCatalog,
  JSON_SCHEMA_DIALECT,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const schemaDirectory = path.join(root, "schemas");
const schemaBase =
  "https://github.com/mako10k/perttool/schemas/";

function schemaFiles() {
  return readdirSync(schemaDirectory)
    .filter((name) => name.endsWith(".schema.json"))
    .sort();
}

function readSchema(name) {
  return JSON.parse(
    readFileSync(path.join(schemaDirectory, name), "utf8"),
  );
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of schemaFiles()) {
    ajv.addSchema(readSchema(name));
  }
  return ajv;
}

function run(args, expectedStatus = 0, cwd = root) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(" ")}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
  );
  return result;
}

function cliJson(args, expectedStatus = 0, cwd = root) {
  const result = run([...args, "--format=json"], expectedStatus, cwd);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function validateResult(ajv, value, label) {
  const schemaId = `${schemaBase}${value.schema_version}.schema.json`;
  const validate = ajv.getSchema(schemaId);
  assert.equal(typeof validate, "function", `${label}: ${schemaId}`);
  assert.equal(
    validate(value),
    true,
    `${label}: ${JSON.stringify(validate.errors)}`,
  );
  const unexpectedRootField = {
    ...value,
    unexpected_contract_field: true,
  };
  assert.equal(
    validate(unexpectedRootField),
    false,
    `${label}: root contract must be closed`,
  );
}

test("Contract 6 result identities resolve to one closed bundled catalog", () => {
  const catalog = getJsonSchemaCatalog();
  const advertised = [...new Set(
    COMMAND_REGISTRY.flatMap(({ resultSchemas }) => resultSchemas),
  )].sort();
  const commandSchemas = catalog
    .filter(({ commandResult }) => commandResult)
    .map(({ schemaId }) => schemaId);
  assert.deepEqual(commandSchemas, advertised);
  assert.equal(COMMAND_REGISTRY.length, 34);
  assert.equal(advertised.length, 17);
  assert.deepEqual(
    catalog
      .filter(({ publicLibraryResult }) => publicLibraryResult)
      .map(({ schemaId }) => schemaId),
    ["Perttool.OverrideDecision.v1"],
  );

  const expectedFiles = [
    "Perttool.Common.v1.schema.json",
    ...catalog.map(({ schemaId }) => `${schemaId}.schema.json`),
  ].sort();
  assert.deepEqual(schemaFiles(), expectedFiles);
  assert.equal(new Set(catalog.map(({ schemaId }) => schemaId)).size, 18);
  assert.equal(
    new Set(catalog.map(({ artifactPath }) => artifactPath)).size,
    18,
  );

  for (const entry of catalog) {
    assert.equal(
      entry.artifactPath,
      `schemas/${entry.schemaId}.schema.json`,
    );
    const artifact = readSchema(`${entry.schemaId}.schema.json`);
    assert.equal(artifact.$schema, JSON_SCHEMA_DIALECT);
    assert.equal(
      artifact.$id,
      `${schemaBase}${entry.schemaId}.schema.json`,
    );
    assert.equal(getJsonSchema(entry.schemaId), getJsonSchema(entry.schemaId));
    assert.equal(Object.isFrozen(getJsonSchema(entry.schemaId)), true);
  }
  assert.equal(getJsonSchema("Perttool.Missing.v1"), null);
});

test("schema command lists, resolves, and rejects schema identities", () => {
  const catalog = cliJson(["schema"]);
  assert.equal(catalog.schema_version, "Perttool.SchemaResult.v1");
  assert.equal(catalog.operation, "schema");
  assert.equal(catalog.ok, true);
  assert.equal(catalog.query.schema_id, null);
  assert.equal(catalog.schemas.length, 18);
  assert.equal(catalog.schema, null);

  const selected = cliJson([
    "schema",
    "Perttool.NextResult.v5",
  ]);
  assert.equal(selected.ok, true);
  assert.equal(selected.query.schema_id, "Perttool.NextResult.v5");
  assert.equal(
    selected.schema.$id,
    `${schemaBase}Perttool.NextResult.v5.schema.json`,
  );

  const missing = cliJson(["schema", "Perttool.Missing.v1"], 1);
  assert.equal(missing.ok, false);
  assert.equal(missing.schema, null);
  assert.equal(missing.diagnostics[0].code, "PTSCH-001");

  const text = run(["schema", "Perttool.CheckResult.v3"]).stdout;
  assert.match(text, /^Schema: Perttool\.CheckResult\.v3$/m);
  assert.match(
    text,
    /^Artifact: schemas\/Perttool\.CheckResult\.v3\.schema\.json$/m,
  );
});

test("actual success, invalid, unavailable, and usage results validate", (t) => {
  const ajv = validator();
  const temporary = mkdtempSync(
    path.join(tmpdir(), "perttool-json-schema."),
  );
  t.after(() => rmSync(temporary, { recursive: true, force: true }));

  const minimal = path.join(root, "docs", "examples", "minimal.pert");
  const point = path.join(
    root,
    "docs",
    "examples",
    "point-velocity.pert",
  );
  const invalid = path.join(
    root,
    "test",
    "fixtures",
    "invalid",
    "multiple-syntax-errors.pert",
  );
  const warning = path.join(
    root,
    "docs",
    "examples",
    "advance-partial-before.pert",
  );
  const outside = path.join(temporary, "outside.pert");
  copyFileSync(minimal, outside);
  const mermaid = run([
    "dag",
    "render",
    minimal,
    "--to",
    "mermaid",
  ]).stdout;
  const mermaidPath = path.join(temporary, "minimal.mmd");
  writeFileSync(mermaidPath, mermaid, "utf8");

  const results = [
    cliJson(["help"]),
    cliJson(["guide"]),
    cliJson(["agent", "help", "codex", "instruction"]),
    cliJson(["document", "check", minimal]),
    cliJson(["document", "check", warning]),
    cliJson(["document", "format", minimal]),
    cliJson([
      "project",
      "init",
      "SCHEMA_SAMPLE",
      "--title",
      "Schema sample",
      "--duration-unit",
      "day",
      "--initial-milestone",
      "START",
      "--initial-milestone-title",
      "Start",
      "--finish",
      "START",
    ]),
    cliJson(["project", "show", minimal]),
    cliJson(["dag", "analyze", minimal]),
    cliJson(["dag", "next", minimal]),
    cliJson(["dag", "render", minimal, "--to", "mermaid"]),
    cliJson(["dag", "import", mermaidPath, "--from", "mermaid"]),
    cliJson([
      "task",
      "set",
      minimal,
      "WORK",
      "--title",
      "Schema sample",
      "--actor",
      "user",
    ]),
    cliJson([
      "project",
      "migrate-unit",
      point,
      "--to-unit",
      "day",
    ]),
    cliJson(["project", "history", minimal]),
    cliJson(["project", "observe-velocity", minimal]),
    cliJson(["project", "history", outside], 1),
    cliJson(["project", "observe-velocity", outside], 1),
    cliJson(["schema", "Perttool.CheckResult.v3"]),
    cliJson(["help", "--unknown"], 2),
    cliJson([
      "document",
      "check",
      invalid,
      "--max-diagnostics",
      "1",
    ], 1),
    JSON.parse(
      readFileSync(
        path.join(
          root,
          "test",
          "golden",
          "recommendation",
          "override-decision.expected.json",
        ),
        "utf8",
      ),
    ),
  ];

  for (const [index, result] of results.entries()) {
    validateResult(ajv, result, `result ${index}`);
  }
  assert.ok(
    results[4].diagnostics.some(
      ({ code, severity }) =>
        code === "PTDAG-208" && severity === "warning",
    ),
  );
  assert.ok(["complete", "incomplete"].includes(results[14].history.status));
  assert.ok(["complete", "incomplete"].includes(results[15].history.status));
  assert.equal(results[16].history.status, "unavailable");
  assert.equal(results[17].history.status, "unavailable");
  assert.equal(results[20].diagnostics_truncated, true);
});

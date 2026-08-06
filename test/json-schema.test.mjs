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
  getJsonSchemaResult,
  jsonSchemaResultToJson,
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

function assertRejectsNestedField(ajv, value, pathSegments, label) {
  const schemaId = `${schemaBase}${value.schema_version}.schema.json`;
  const validate = ajv.getSchema(schemaId);
  const candidate = structuredClone(value);
  let target = candidate;
  for (const segment of pathSegments) {
    target = target[segment];
  }
  assert.equal(
    typeof target,
    "object",
    `${label}: target must be an object`,
  );
  assert.notEqual(target, null, `${label}: target must not be null`);
  assert.equal(
    Array.isArray(target),
    false,
    `${label}: target must not be an array`,
  );
  target.unexpected_nested_contract_field = true;
  assert.equal(
    validate(candidate),
    false,
    `${label}: nested contract must be closed`,
  );
}

function schemaReferences(value) {
  const references = [];
  const visit = (current) => {
    if (current === null || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (typeof current.$ref === "string") references.push(current.$ref);
    Object.values(current).forEach(visit);
  };
  visit(value);
  return references;
}

test("Contract 7 result identities resolve to one closed bundled catalog", () => {
  const catalog = getJsonSchemaCatalog();
  const advertised = [...new Set(
    COMMAND_REGISTRY.flatMap(({ resultSchemas }) => resultSchemas),
  )].sort();
  const commandSchemas = catalog
    .filter(({ commandResult }) => commandResult)
    .map(({ schemaId }) => schemaId);
  assert.deepEqual(commandSchemas, advertised);
  assert.equal(COMMAND_REGISTRY.length, 45);
  assert.equal(advertised.length, 20);
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
  assert.equal(new Set(catalog.map(({ schemaId }) => schemaId)).size, 21);
  assert.equal(
    new Set(catalog.map(({ artifactPath }) => artifactPath)).size,
    21,
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

test("every bundled object contract is concrete and explicitly closed", () => {
  const failures = [];
  const inspect = (value, schemaName, pointer) => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        inspect(item, schemaName, `${pointer}/${index}`)
      );
      return;
    }
    const types = Array.isArray(value.type) ? value.type : [value.type];
    if (types.includes("object")) {
      const hasProperties = Object.hasOwn(value, "properties");
      const hasPatternProperties = Object.hasOwn(value, "patternProperties");
      const hasTypedAdditionalProperties =
        value.additionalProperties !== null &&
        typeof value.additionalProperties === "object";
      if (
        !hasProperties &&
        !hasPatternProperties &&
        !hasTypedAdditionalProperties
      ) {
        failures.push(
          `${schemaName}${pointer}: object shape is unspecified`,
        );
      }
      if (hasProperties && value.additionalProperties !== false) {
        failures.push(
          `${schemaName}${pointer}: property object is not closed`,
        );
      }
      if (hasProperties && !Array.isArray(value.required)) {
        failures.push(
          `${schemaName}${pointer}: required fields are unspecified`,
        );
      }
    }
    for (const [key, nested] of Object.entries(value)) {
      inspect(nested, schemaName, `${pointer}/${key}`);
    }
  };

  for (const name of schemaFiles()) {
    inspect(readSchema(name), name, "");
  }
  assert.deepEqual(failures, []);
});

test("schema command lists, resolves, and rejects schema identities", () => {
  const catalog = cliJson(["schema"]);
  assert.equal(catalog.schema_version, "Perttool.SchemaResult.v1");
  assert.equal(catalog.operation, "schema");
  assert.equal(catalog.ok, true);
  assert.equal(catalog.query.schema_id, null);
  assert.equal(catalog.schemas.length, 21);
  assert.equal(catalog.schema, null);

  const selected = cliJson([
    "schema",
    "Perttool.NextResult.v6",
  ]);
  assert.equal(selected.ok, true);
  assert.deepEqual(selected.query, {
    schema_id: "Perttool.NextResult.v6",
  });
  assert.equal(
    selected.schema.$id,
    `${schemaBase}Perttool.NextResult.v6.schema.json`,
  );
  assert.ok(Object.hasOwn(selected.schema, "$defs"));
  assert.deepEqual(
    jsonSchemaResultToJson(
      getJsonSchemaResult("Perttool.NextResult.v6"),
    ),
    selected,
  );

  const explicitFull = cliJson([
    "schema",
        "Perttool.NextResult.v6",
    "--view",
    "full",
  ]);
  assert.deepEqual(explicitFull.query, {
    schema_id: "Perttool.NextResult.v6",
    view: "full",
  });
  assert.deepEqual(explicitFull.schema, selected.schema);

  const outline = cliJson([
    "schema",
    "Perttool.NextResult.v6",
    "--view",
    "outline",
  ]);
  assert.deepEqual(outline.query, {
    schema_id: "Perttool.NextResult.v6",
    view: "outline",
  });
  assert.equal(Object.hasOwn(outline.schema, "$defs"), false);
  assert.match(outline.schema.$id, /[?]view=outline$/);
  assert.ok(
    JSON.stringify(outline.schema).length <
      JSON.stringify(selected.schema).length / 2,
  );
  const references = schemaReferences(outline.schema);
  assert.ok(references.length > 0);
  assert.equal(
    references.every((reference) => reference.startsWith(schemaBase)),
    true,
  );
  assert.equal(
    outline.schema.properties.groups.$ref,
    `${schemaBase}Perttool.NextResult.v6.schema.json#/properties/groups`,
  );
  const ajv = validator();
  assert.doesNotThrow(() => ajv.compile(outline.schema));

  const recommendationRef =
    outline.schema.properties.recommendation.$ref;
  const detail = cliJson([
    "schema",
    "Perttool.NextResult.v6",
    "--view",
    "outline",
    "--ref",
    recommendationRef,
  ]);
  assert.deepEqual(detail.query, {
    schema_id: "Perttool.NextResult.v6",
    view: "outline",
    ref: recommendationRef,
  });
  assert.equal(detail.schema.type, "object");
  assert.ok(detail.schema.properties.result_decision);
  assert.equal(Object.hasOwn(detail.schema, "$defs"), false);
  assert.match(detail.schema.$id, /[?]view=outline&ref=/);
  assert.doesNotThrow(() => ajv.compile(detail.schema));

  const commonDetail = cliJson([
    "schema",
    "Perttool.NextResult.v6",
    "--view=outline",
    "--ref",
    "Perttool.Common.v1.schema.json#/$defs/diagnostics",
  ]);
  assert.equal(commonDetail.ok, true);
  assert.equal(commonDetail.schema.type, "array");
  assert.match(commonDetail.schema.$id, /Perttool[.]Common[.]v1[.]schema[.]json[?]/);

  const missing = cliJson(["schema", "Perttool.Missing.v1"], 1);
  assert.equal(missing.ok, false);
  assert.equal(missing.schema, null);
  assert.equal(missing.diagnostics[0].code, "PTSCH-001");

  const missingRef = cliJson([
    "schema",
    "Perttool.NextResult.v6",
    "--view=outline",
    "--ref=#/$defs/missing",
  ], 1);
  assert.equal(missingRef.schema, null);
  assert.equal(missingRef.diagnostics[0].code, "PTSCH-002");
  assert.equal(
    missingRef.diagnostics[0].data.ref,
    "#/$defs/missing",
  );
  const validateSchemaResult = ajv.getSchema(
    `${schemaBase}Perttool.SchemaResult.v1.schema.json`,
  );
  for (const result of [explicitFull, outline, detail, commonDetail, missingRef]) {
    assert.equal(
      validateSchemaResult(result),
      true,
      JSON.stringify(validateSchemaResult.errors),
    );
  }
  const refWithoutViewPayload = structuredClone(detail);
  delete refWithoutViewPayload.query.view;
  assert.equal(validateSchemaResult(refWithoutViewPayload), false);
  const viewWithoutIdentityPayload = structuredClone(outline);
  viewWithoutIdentityPayload.query.schema_id = null;
  assert.equal(validateSchemaResult(viewWithoutIdentityPayload), false);

  const refWithoutOutline = cliJson([
    "schema",
    "Perttool.NextResult.v6",
    "--ref=#/$defs/recommendation",
  ], 2);
  assert.equal(refWithoutOutline.schema_version, "Perttool.CliError.v1");
  assert.equal(refWithoutOutline.ok, false);

  const viewWithoutIdentity = cliJson([
    "schema",
    "--view=outline",
  ], 2);
  assert.equal(viewWithoutIdentity.schema_version, "Perttool.CliError.v1");
  assert.equal(viewWithoutIdentity.ok, false);

  const text = run(["schema", "Perttool.CheckResult.v4"]).stdout;
  assert.match(text, /^Schema: Perttool\.CheckResult\.v4$/m);
  assert.match(
    text,
    /^Artifact: schemas\/Perttool\.CheckResult\.v4\.schema\.json$/m,
  );
  const outlineText = run([
    "schema",
    "Perttool.CheckResult.v4",
    "--view=outline",
  ]).stdout;
  assert.match(outlineText, /^View: outline$/m);
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
  const temporal = path.join(
    root,
    "test",
    "fixtures",
    "temporal-units",
    "deadline-resource-v2.pert",
  );
  const temporalAnalysis = cliJson(["dag", "analyze", temporal]);
  const temporalNext = cliJson(["dag", "next", temporal]);
  const lifecycleMutation = cliJson([
    "task",
    "start",
    path.join(root, "test", "fixtures", "project-actuals-v5.pert"),
    "WORK",
    "--at",
    "2026-07-30T09:00:00+09:00",
    "--actor",
    "user",
  ]);
  const advanceMutation = cliJson([
    "dag",
    "advance",
    warning,
    "--actor",
    "user",
  ]);
  const exactUnitMigration = cliJson([
    "project",
    "migrate-unit",
    path.join(
      root,
      "test",
      "fixtures",
      "temporal-units",
      "migration-nonrepresentable-v2.pert",
    ),
    "--to-unit",
    "day",
  ]);
  const unavailableUnitMigration = cliJson([
    "project",
    "migrate-unit",
    minimal,
    "--to-unit",
    "hour",
  ], 1);

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
    cliJson(["schema", "Perttool.CheckResult.v4"]),
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
    temporalAnalysis,
    temporalNext,
    lifecycleMutation,
    advanceMutation,
    exactUnitMigration,
    unavailableUnitMigration,
    cliJson([
      "dag",
      "history",
      path.join(root, "plans", "historical-dag.pert"),
      "--view",
      "lineage",
    ]),
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

  assertRejectsNestedField(
    ajv,
    results[0],
    ["commands", 0, "options", 0],
    "command option",
  );
  assertRejectsNestedField(
    ajv,
    results[2],
    ["providers", 0, "surfaces", 0, "status_evidence"],
    "guidance evidence",
  );
  assertRejectsNestedField(
    ajv,
    results[14],
    ["tasks", 0],
    "history task",
  );
  assertRejectsNestedField(
    ajv,
    results[21],
    ["override", "reason"],
    "override reason",
  );
  assertRejectsNestedField(
    ajv,
    temporalAnalysis,
    ["resource", "tasks", 0, "priority_key"],
    "resource priority key",
  );
  assertRejectsNestedField(
    ajv,
    temporalAnalysis,
    ["temporal", "deadline_evaluations", 0, "resource"],
    "deadline resource view",
  );
  assertRejectsNestedField(
    ajv,
    temporalNext,
    ["recommendation", "decision_steps", 0, "expression"],
    "recommendation expression",
  );
  assertRejectsNestedField(
    ajv,
    temporalNext,
    ["temporal", "tasks", 0, "time_eligibility"],
    "next temporal eligibility",
  );
  assertRejectsNestedField(
    ajv,
    lifecycleMutation,
    ["lifecycle", "event"],
    "lifecycle event",
  );
  assertRejectsNestedField(
    ajv,
    advanceMutation,
    ["advance"],
    "advance details",
  );
  assertRejectsNestedField(
    ajv,
    advanceMutation,
    ["history_guard"],
    "advance history guard",
  );
  assertRejectsNestedField(
    ajv,
    exactUnitMigration,
    ["converted_fields", 0],
    "converted unit field",
  );
  assertRejectsNestedField(
    ajv,
    unavailableUnitMigration,
    ["unavailable_causes", 0],
    "unit migration unavailable cause",
  );
});

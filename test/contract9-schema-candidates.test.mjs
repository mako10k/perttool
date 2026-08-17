import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const activeDirectory = "schemas";
const candidateDirectory = "schemas/candidates/contract9";
const identities = Object.freeze([
  "Perttool.AnalysisResult.v7",
  "Perttool.CheckResult.v6",
  "Perttool.MutationResult.v6",
  "Perttool.NextResult.v8",
  "Perttool.PlanAssuranceResult.v2",
  "Perttool.ProjectResult.v5",
  "Perttool.UnitMigrationResult.v4",
]);

async function schema(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("Contract 9 stages exactly seven replacement identities outside the active catalog", async () => {
  const names = (await readdir(candidateDirectory)).sort();
  assert.deepEqual(names, identities.map((id) => `${id}.schema.json`));
  for (const identity of identities) {
    const value = await schema(path.join(candidateDirectory, `${identity}.schema.json`));
    assert.equal(value.$id, `https://github.com/mako10k/perttool/schemas/${identity}.schema.json`);
    assert.equal(value.title, identity);
    assert.equal(value.properties.schema_version.const, identity);
    assert.equal(value.properties.cli_contract_version.const, 9);
  }
  const activeNames = await readdir(activeDirectory);
  assert.equal(activeNames.some((name) => identities.some((id) => name === `${id}.schema.json`)), false);
});

test("staged Contract 9 schema references compile without changing the active registry", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of (await readdir(activeDirectory)).filter((name) => name.endsWith(".schema.json"))) {
    ajv.addSchema(await schema(path.join(activeDirectory, name)));
  }
  for (const identity of identities) ajv.addSchema(await schema(path.join(candidateDirectory, `${identity}.schema.json`)));
  for (const identity of identities) {
    assert.equal(typeof ajv.getSchema(`https://github.com/mako10k/perttool/schemas/${identity}.schema.json`), "function");
  }
});

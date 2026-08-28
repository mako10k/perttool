import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { COMMAND_REGISTRY } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const schemaBase = "https://github.com/mako10k/perttool/schemas/";
const compoundPaths = Object.freeze([
  "milestone acceptance replace",
  "milestone acceptance verify",
  "milestone acceptance fail",
  "milestone acceptance unavailable",
  "milestone acceptance revoke",
  "milestone acceptance waive",
  "milestone acceptance show",
  "work reshape preflight",
  "work reshape apply",
]);

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    expectedStatus,
    `${args.join(" ")}\n${result.stdout}\n${result.stderr}`,
  );
  return result;
}

function json(args, expectedStatus = 0) {
  const result = run([...args, "--format=json"], expectedStatus);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function helpValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schemaRoot = path.join(root, "schemas");
  for (const name of readdirSync(schemaRoot).filter((entry) => entry.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(schemaRoot, name), "utf8")));
  }
  return ajv.getSchema(`${schemaBase}Perttool.CommandHelpResult.v1.schema.json`);
}

test("Issue #32 accepts natural operands for every active compound Help path", () => {
  assert.deepEqual(
    COMMAND_REGISTRY
      .filter(({ path: commandPath }) => commandPath.length === 3)
      .map(({ path: commandPath }) => commandPath.join(" ")),
    compoundPaths,
  );

  for (const commandPath of compoundPaths) {
    const segments = commandPath.split(" ");
    const natural = json(["help", ...segments]);
    const quotedAction = json(["help", segments[0], segments.slice(1).join(" ")]);
    assert.equal(natural.ok, true, commandPath);
    assert.deepEqual(natural.commands.map(({ path: selected }) => selected), [segments]);
    assert.deepEqual(quotedAction, natural, commandPath);

    const human = run(["help", ...segments]);
    assert.equal(human.stderr, "");
    assert.match(human.stdout, new RegExp(`^Command: perttool ${commandPath}$`, "m"));
  }
});

test("Issue #32 diagnoses incomplete compound actions with exact child actions", () => {
  const validate = helpValidator();
  assert.equal(typeof validate, "function");
  const cases = [
    {
      args: ["help", "work", "reshape"],
      children: ["apply", "preflight"],
    },
    {
      args: ["help", "milestone", "acceptance"],
      children: ["fail", "replace", "revoke", "show", "unavailable", "verify", "waive"],
    },
  ];

  for (const { args, children } of cases) {
    const result = json(args, 1);
    assert.equal(result.ok, false);
    assert.deepEqual(result.resources, []);
    assert.deepEqual(result.commands, []);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0].code, "PTHLP-003");
    assert.deepEqual(result.diagnostics[0].data.available_child_actions, children);
    assert.match(result.diagnostics[0].message, /incomplete action/u);
    for (const child of children) assert.match(result.diagnostics[0].message, new RegExp(`\\b${child}\\b`));
    assert.equal(validate(result), true, JSON.stringify(validate.errors));

    const human = run(args, 1);
    assert.equal(human.stdout, "");
    assert.match(human.stderr, /^PTHLP-003 error: incomplete action /m);
    assert.match(human.stderr, new RegExp(`available child actions: ${children.join(", ")}`));
  }
});

test("Issue #32 preserves resource-only, direct-action, and unknown Help behavior", () => {
  const resource = json(["help", "work"]);
  assert.equal(resource.ok, true);
  assert.deepEqual(resource.resources[0].actions, [
    "list",
    "observe",
    "reshape apply",
    "reshape preflight",
    "show",
  ]);
  assert.deepEqual(
    resource.commands.map(({ path: commandPath }) => commandPath.join(" ")),
    ["work list", "work show", "work observe", "work reshape preflight", "work reshape apply"],
  );

  const direct = json(["help", "work", "list"]);
  assert.equal(direct.ok, true);
  assert.deepEqual(direct.commands.map(({ path: commandPath }) => commandPath), [["work", "list"]]);

  const unknown = json(["help", "work", "reshape", "missing"], 1);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.diagnostics[0].code, "PTHLP-003");
  assert.match(unknown.diagnostics[0].message, /^unknown action reshape missing /u);
  assert.equal("available_child_actions" in unknown.diagnostics[0].data, false);

  const help = COMMAND_REGISTRY.find(({ operation }) => operation === "help");
  assert.notEqual(help, undefined);
  assert.equal(help.effect, "read");
  assert.equal(help.input, "none");
  assert.equal(help.output.fileEffect, "none");
  assert.equal(help.options.some(({ name }) => ["write", "out", "diff", "accepted-by-owner"].includes(name)), false);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  commandDescriptorToJson,
  commandOptionSets,
  commandRegistryToJson,
  getCommandDescriptor,
  getCommandDescriptorByOperation,
  renderCommandHelp,
  renderTopLevelHelp,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

const expectedPaths = [
  "dsl check",
  "dsl format",
  "dsl help",
  "agent help",
  "project show",
  "project set",
  "dag analyze",
  "dag next",
  "dag advance",
  "dag render",
  "dag import",
  "task add",
  "task set",
  "task remove",
  "task finish",
  "milestone add",
  "milestone set",
  "milestone remove",
  "resource add",
  "resource set",
  "resource remove",
  "mutation apply",
];

const knownSchemas = new Set([
  "Perttool.AgentGuidanceResult.v1",
  "Perttool.AnalysisResult.v2",
  "Perttool.CheckResult.v1",
  "Perttool.CliError.v1",
  "Perttool.ExportResult.v1",
  "Perttool.FormatResult.v1",
  "Perttool.HelpResult.v1",
  "Perttool.ImportResult.v1",
  "Perttool.MutationResult.v1",
  "Perttool.NextResult.v3",
  "Perttool.ProjectResult.v1",
]);

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("command registry covers the complete active Contract 2 surface exactly once", () => {
  assert.deepEqual(
    COMMAND_REGISTRY.map((descriptor) => descriptor.path.join(" ")),
    expectedPaths,
  );
  assert.equal(new Set(COMMAND_REGISTRY.map(({ operation }) => operation)).size, 22);

  for (const descriptor of COMMAND_REGISTRY) {
    assert.equal(descriptor.contractVersion, 2, descriptor.operation);
    assert.equal(
      getCommandDescriptor(...descriptor.path),
      descriptor,
      descriptor.operation,
    );
    assert.equal(
      getCommandDescriptorByOperation(descriptor.operation),
      descriptor,
      descriptor.operation,
    );
    assert.notEqual(descriptor.summary, "", descriptor.operation);
    assert.ok(descriptor.operands.every(
      (operand, index) => operand.position === index,
    ), descriptor.operation);
    assert.ok(descriptor.examples.length > 0, descriptor.operation);
    assert.ok(descriptor.resultSchemas.length > 0, descriptor.operation);
    assert.ok(
      descriptor.resultSchemas.every((schema) => knownSchemas.has(schema)),
      descriptor.operation,
    );
    assert.ok(descriptor.exitStatuses.length > 0, descriptor.operation);
    assert.deepEqual(descriptor.output.formats, ["text", "json"], descriptor.operation);
    assert.equal(
      new Set(descriptor.options.map(({ name }) => name)).size,
      descriptor.options.length,
      descriptor.operation,
    );
  }
});

test("JSON command descriptors are deterministic projections of the same registry", () => {
  const first = commandRegistryToJson();
  const second = commandRegistryToJson();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(first).includes("mutuallyExclusive"), false);
  assert.equal(JSON.stringify(first).includes('"mutually_exclusive"'), true);
  assert.equal(first.length, COMMAND_REGISTRY.length);
  for (let index = 0; index < COMMAND_REGISTRY.length; index += 1) {
    assert.deepEqual(
      first[index],
      commandDescriptorToJson(COMMAND_REGISTRY[index]),
      COMMAND_REGISTRY[index].operation,
    );
  }
});

test("expanded options drive parsing metadata and every text-help option", () => {
  for (const descriptor of COMMAND_REGISTRY) {
    const optionSets = commandOptionSets(descriptor);
    const classified = new Set([
      ...optionSets.values,
      ...optionSets.flags,
      ...optionSets.repeatable,
    ]);
    assert.deepEqual(
      classified,
      new Set(descriptor.options.map(({ name }) => name)),
      descriptor.operation,
    );

    const helpOptions = new Set(
      [...renderCommandHelp(descriptor).matchAll(/--([a-z][a-z0-9-]*)/g)]
        .map((match) => match[1]),
    );
    assert.deepEqual(
      helpOptions,
      new Set(descriptor.options.map(({ name }) => name)),
      descriptor.operation,
    );
    const projectedText = [
      descriptor.topLevelUsage ?? "",
      ...descriptor.examples.map(({ invocation }) => invocation),
    ].join("\n");
    for (const match of projectedText.matchAll(/--([a-z][a-z0-9-]*)/g)) {
      assert.ok(classified.has(match[1]), `${descriptor.operation} --${match[1]}`);
    }

    for (const option of descriptor.options) {
      assert.equal(option.spelling.cli, `--${option.name}`, descriptor.operation);
      assert.notEqual(option.valueType, "", `${descriptor.operation} --${option.name}`);
      if (option.kind === "flag") {
        assert.equal(option.valueType, null, `${descriptor.operation} --${option.name}`);
        assert.equal(option.repeatable, false, `${descriptor.operation} --${option.name}`);
      }
    }
  }
});

test("top-level and exact command help are registry projections", () => {
  const top = run(["--help"]);
  assert.equal(top.status, 0, top.stderr);
  assert.equal(top.stdout, `${renderTopLevelHelp()}\n`);

  for (const descriptor of COMMAND_REGISTRY) {
    const result = run([...descriptor.path, "--help"]);
    assert.equal(result.status, 0, `${descriptor.operation}: ${result.stderr}`);
    assert.equal(result.stdout, `${renderCommandHelp(descriptor)}\n`);
    assert.equal(result.stderr, "");
  }
});

test("every registered path dispatches through registry-derived option validation", () => {
  for (const descriptor of COMMAND_REGISTRY) {
    const result = run([...descriptor.path, "--registry-completeness-probe"]);
    assert.equal(result.status, 2, `${descriptor.operation}: ${result.stderr}`);
    assert.match(
      result.stderr,
      /unknown option --registry-completeness-probe/,
      descriptor.operation,
    );
  }

  const unknown = run(["project", "init", "--help"]);
  assert.equal(unknown.status, 2);
  assert.match(
    unknown.stderr,
    /unknown or not-yet-implemented command: project init/,
  );
});

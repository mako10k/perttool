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
  getCommandDiscovery,
  renderCommandHelpResult,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

const expectedPaths = [
  "help",
  "guide",
  "document check",
  "document format",
  "project init",
  "project show",
  "project history",
  "project observe-velocity",
  "project set",
  "project migrate-unit",
  "dag analyze",
  "dag next",
  "dag advance",
  "dag render",
  "dag import",
  "task add",
  "task set",
  "task remove",
  "task start",
  "task suspend",
  "task resume",
  "task finish",
  "gate add",
  "gate set",
  "gate remove",
  "milestone add",
  "milestone set",
  "milestone remove",
  "resource add",
  "resource set",
  "resource remove",
  "batch apply",
  "agent help",
];

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("the Contract 6 registry covers the complete active surface exactly once", () => {
  assert.equal(COMMAND_REGISTRY.length, expectedPaths.length);
  assert.deepEqual(
    commandRegistryToJson(),
    COMMAND_REGISTRY.map(commandDescriptorToJson),
  );
  assert.deepEqual(
    getCommandDiscovery({ resource: null, action: null }).commands,
    COMMAND_REGISTRY,
  );
  assert.deepEqual(
    COMMAND_REGISTRY.map((descriptor) =>
      descriptor.path.join(" ")
    ),
    expectedPaths,
  );
  assert.equal(
    new Set(COMMAND_REGISTRY.map(({ operation }) => operation)).size,
    expectedPaths.length,
  );
  for (const descriptor of COMMAND_REGISTRY) {
    assert.equal(descriptor.contractVersion, 6, descriptor.operation);
    assert.notEqual(descriptor.summary, "", descriptor.operation);
    assert.ok(
      descriptor.operands.every(
        (operand, index) => operand.position === index,
      ),
      descriptor.operation,
    );
    assert.ok(descriptor.examples.length > 0, descriptor.operation);
    assert.ok(descriptor.resultSchemas.length > 0, descriptor.operation);
    assert.ok(descriptor.exitStatuses.length > 0, descriptor.operation);
    assert.deepEqual(
      descriptor.output.formats,
      ["text", "json"],
      descriptor.operation,
    );
    assert.equal(
      new Set(descriptor.options.map(({ name }) => name)).size,
      descriptor.options.length,
      descriptor.operation,
    );
  }
});

test("JSON descriptors and option parsing metadata are deterministic projections", () => {
  const first = COMMAND_REGISTRY.map(commandDescriptorToJson);
  const second = COMMAND_REGISTRY.map(commandDescriptorToJson);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(first).includes("mutuallyExclusive"), false);
  assert.equal(JSON.stringify(first).includes('"mutually_exclusive"'), true);

  for (const descriptor of COMMAND_REGISTRY) {
    const optionSets = commandOptionSets(descriptor);
    assert.deepEqual(
      new Set([
        ...optionSets.values,
        ...optionSets.flags,
        ...optionSets.repeatable,
      ]),
      new Set(descriptor.options.map(({ name }) => name)),
      descriptor.operation,
    );
    for (const option of descriptor.options) {
      assert.equal(
        option.spelling.cli,
        `--${option.name}`,
        descriptor.operation,
      );
      if (option.kind === "flag") {
        assert.equal(option.valueType, null, descriptor.operation);
        assert.equal(option.repeatable, false, descriptor.operation);
      }
    }
  }
});

test("top-level and exact command help are active-registry projections", () => {
  const topResult = getCommandDiscovery({ resource: null, action: null });
  const top = run(["--help"]);
  assert.equal(top.status, 0, top.stderr);
  assert.equal(top.stdout, renderCommandHelpResult(topResult));

  for (const descriptor of COMMAND_REGISTRY) {
    const [resource, action] = descriptor.path;
    const query = getCommandDiscovery({
      resource,
      action: action ?? null,
    });
    const result = run([...descriptor.path, "--help"]);
    assert.equal(result.status, 0, `${descriptor.operation}: ${result.stderr}`);
    assert.equal(result.stdout, renderCommandHelpResult(query));
    assert.equal(result.stderr, "");
  }
});

test("every registered path dispatches through registry-derived validation", () => {
  for (const descriptor of COMMAND_REGISTRY) {
    const result = run([
      ...descriptor.path,
      "--registry-completeness-probe",
    ]);
    assert.equal(result.status, 2, `${descriptor.operation}: ${result.stderr}`);
    assert.match(
      result.stderr,
      /unknown option --registry-completeness-probe/,
      descriptor.operation,
    );
    assert.match(result.stderr, /help: perttool help /, descriptor.operation);
  }
});

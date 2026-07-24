import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  COMMAND_REGISTRY,
  commandDescriptorToJson,
} from "../dist/index.js";
import {
  CONTRACT3_COMMAND_HELP_REGISTRY,
  commandHelpResultToJson,
  getCommandDiscovery,
  renderCommandHelpResult,
  serializeCommandHelpResult,
} from "../dist/command/discovery.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

const expectedPaths = [
  "help",
  "guide",
  "document check",
  "document format",
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
  "batch apply",
  "agent help",
];

const expectedResources = [
  ["document", ["check", "format"]],
  ["project", ["show", "set"]],
  ["dag", ["analyze", "next", "advance", "render", "import"]],
  ["task", ["add", "set", "remove", "finish"]],
  ["milestone", ["add", "set", "remove"]],
  ["resource", ["add", "set", "remove"]],
  ["batch", ["apply"]],
  ["agent", ["help"]],
];

const knownSchemas = new Set([
  "Perttool.AgentGuidanceResult.v1",
  "Perttool.AnalysisResult.v2",
  "Perttool.CheckResult.v1",
  "Perttool.CliError.v1",
  "Perttool.CommandHelpResult.v1",
  "Perttool.ExportResult.v1",
  "Perttool.FormatResult.v1",
  "Perttool.GuideResult.v1",
  "Perttool.ImportResult.v1",
  "Perttool.MutationResult.v1",
  "Perttool.NextResult.v3",
  "Perttool.ProjectResult.v1",
]);

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("Contract 3 command discovery projects every implemented capability in canonical order", () => {
  assert.deepEqual(
    CONTRACT3_COMMAND_HELP_REGISTRY.map(({ path: commandPath }) =>
      commandPath.join(" ")
    ),
    expectedPaths,
  );
  assert.equal(
    new Set(CONTRACT3_COMMAND_HELP_REGISTRY.map(({ operation }) => operation)).size,
    expectedPaths.length,
  );
  assert.ok(
    CONTRACT3_COMMAND_HELP_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 3,
    ),
  );
  assert.equal(
    CONTRACT3_COMMAND_HELP_REGISTRY.some(
      ({ path: commandPath }) =>
        commandPath.join(" ") === "project init"
        || commandPath[0] === "gate",
    ),
    false,
  );
  for (const descriptor of CONTRACT3_COMMAND_HELP_REGISTRY) {
    assert.notEqual(descriptor.summary, "", descriptor.operation);
    assert.ok(descriptor.examples.length > 0, descriptor.operation);
    assert.ok(descriptor.resultSchemas.length > 0, descriptor.operation);
    assert.ok(
      descriptor.resultSchemas.every((schema) => knownSchemas.has(schema)),
      descriptor.operation,
    );
    assert.ok(
      descriptor.operands.every(
        (operand, index) => operand.position === index,
      ),
      descriptor.operation,
    );
    assert.equal(
      new Set(descriptor.options.map(({ name }) => name)).size,
      descriptor.options.length,
      descriptor.operation,
    );
  }

  const top = getCommandDiscovery({ resource: null, action: null });
  assert.equal(top.ok, true);
  assert.equal(top.schemaVersion, "Perttool.CommandHelpResult.v1");
  assert.equal(top.cliContractVersion, 3);
  assert.equal(top.operation, "help");
  assert.deepEqual(
    top.resources.map(({ name, actions }) => [name, actions]),
    expectedResources,
  );
  assert.deepEqual(top.commands, CONTRACT3_COMMAND_HELP_REGISTRY);
  const topText = renderCommandHelpResult(top);
  for (const commandPath of expectedPaths) {
    const [resource, action] = commandPath.split(" ");
    if (action === undefined) {
      assert.match(topText, new RegExp(`^  ${resource}  `, "m"));
    } else {
      assert.match(topText, new RegExp(`^    ${action}  `, "m"));
    }
  }
});

test("Contract 3 renames are derived projections while Contract 2 remains active", () => {
  assert.deepEqual(
    COMMAND_REGISTRY.map(({ path: commandPath }) => commandPath.join(" ")).slice(0, 3),
    ["dsl check", "dsl format", "dsl help"],
  );
  assert.equal(COMMAND_REGISTRY.at(-1)?.operation, "mutation.apply");

  const guide = getCommandDiscovery({ resource: "guide", action: null });
  assert.equal(guide.ok, true);
  assert.deepEqual(guide.commands[0]?.path, ["guide"]);
  assert.equal(guide.commands[0]?.operation, "guide");
  assert.deepEqual(
    guide.commands[0]?.resultSchemas,
    ["Perttool.GuideResult.v1", "Perttool.CliError.v1"],
  );
  assert.match(guide.commands[0]?.examples[0]?.invocation ?? "", /^perttool guide /);

  const documentCheck = getCommandDiscovery({
    resource: "document",
    action: "check",
  });
  assert.equal(documentCheck.commands[0]?.operation, "document.check");
  assert.match(
    documentCheck.commands[0]?.examples[0]?.invocation ?? "",
    /^perttool document check /,
  );

  const batch = getCommandDiscovery({ resource: "batch", action: "apply" });
  assert.equal(batch.commands[0]?.operation, "batch.apply");
  assert.match(
    batch.commands[0]?.examples[0]?.invocation ?? "",
    /^perttool batch apply /,
  );

  for (const args of [
    ["help", "--format", "json"],
    ["document", "check", "--help"],
    ["batch", "apply", "--help"],
  ]) {
    const result = runCli(args);
    assert.equal(result.status, 2, `${args.join(" ")}: ${result.stderr}`);
  }
});

test("resource and action queries return complete projections of one result", () => {
  const resource = getCommandDiscovery({ resource: "project", action: null });
  assert.equal(resource.ok, true);
  assert.deepEqual(resource.resources.map(({ name }) => name), ["project"]);
  assert.deepEqual(
    resource.commands.map(({ path: commandPath }) => commandPath.join(" ")),
    ["project show", "project set"],
  );
  assert.deepEqual(resource.resources[0]?.actions, ["show", "set"]);

  const action = getCommandDiscovery({
    resource: "project",
    action: "show",
  });
  assert.equal(action.ok, true);
  assert.equal(action.commands.length, 1);
  const descriptor = action.commands[0];
  assert.ok(descriptor);
  assert.deepEqual(
    commandHelpResultToJson(action).commands,
    [commandDescriptorToJson(descriptor)],
  );

  const text = renderCommandHelpResult(action);
  assert.match(text, /^Command: perttool project show$/m);
  assert.match(text, /^Operation: project\.show$/m);
  for (const operand of descriptor.operands) {
    assert.match(text, new RegExp(`: ${operand.name} type=${operand.valueType}`));
  }
  for (const option of descriptor.options) {
    assert.match(text, new RegExp(`^  --${option.name} `, "m"));
    assert.match(text, new RegExp(`json=${option.spelling.json}$`, "m"));
  }
  for (const schema of descriptor.resultSchemas) {
    assert.ok(text.includes(schema), schema);
  }
  for (const status of descriptor.exitStatuses) {
    assert.match(text, new RegExp(`^  ${status.code}: `, "m"));
  }
  for (const example of descriptor.examples) {
    assert.ok(text.includes(example.invocation), example.id);
  }
});

test("unknown help targets return stable lookup diagnostics and empty commands", () => {
  const cases = [
    {
      query: { resource: "missing", action: null },
      code: "PTHLP-002",
    },
    {
      query: { resource: "project", action: "missing" },
      code: "PTHLP-003",
    },
    {
      query: { resource: null, action: "show" },
      code: "PTHLP-002",
    },
  ];

  for (const { query, code } of cases) {
    const result = getCommandDiscovery(query);
    assert.equal(result.ok, false);
    assert.deepEqual(result.commands, []);
    assert.deepEqual(result.resources, []);
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0]?.code, code);
    assert.match(renderCommandHelpResult(result), new RegExp(`^${code} error:`, "m"));
    const json = commandHelpResultToJson(result);
    assert.equal(json.ok, false);
    assert.deepEqual(json.commands, []);
  }
});

test("text and JSON command discovery are byte deterministic", () => {
  const queries = [
    { resource: null, action: null },
    { resource: "project", action: null },
    { resource: "project", action: "set" },
    { resource: "guide", action: null },
    { resource: "missing", action: null },
  ];
  for (const query of queries) {
    const first = getCommandDiscovery(query);
    const second = getCommandDiscovery(query);
    assert.equal(
      serializeCommandHelpResult(first),
      serializeCommandHelpResult(second),
    );
    assert.equal(renderCommandHelpResult(first), renderCommandHelpResult(second));
    assert.ok(serializeCommandHelpResult(first).endsWith("\n"));
    assert.ok(renderCommandHelpResult(first).endsWith("\n"));
  }
});

test("command discovery runs outside a project without I/O or environment discovery", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "perttool-command-help-"),
  );
  try {
    const moduleUrl = pathToFileURL(
      path.join(root, "dist", "command", "discovery.js"),
    ).href;
    const script = [
      `import { getCommandDiscovery, serializeCommandHelpResult } from ${JSON.stringify(moduleUrl)};`,
      "process.stdout.write(serializeCommandHelpResult(getCommandDiscovery({resource:null,action:null})));",
    ].join("\n");
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", script],
      {
        cwd: temporaryDirectory,
        encoding: "utf8",
        env: {},
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ok, true);
    assert.deepEqual(await readdir(temporaryDirectory), []);

    const source = await readFile(
      path.join(root, "src", "command", "discovery.ts"),
      "utf8",
    );
    const imports = [...source.matchAll(/from "([^"]+)"/g)]
      .map((match) => match[1]);
    assert.deepEqual(
      [...new Set(imports)].sort(),
      ["../model/diagnostics.js", "../version.js", "./registry.js"],
    );
    assert.doesNotMatch(source, /\b(?:fetch|process\.env|node:)/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

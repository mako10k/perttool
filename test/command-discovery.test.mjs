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
  commandHelpResultToJson,
  getCommandDiscovery,
  renderCommandHelpResult,
  serializeCommandHelpResult,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

const expectedPaths = [
  "help",
  "schema",
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
  "dag history",
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
  "plan-assurance show",
  "plan-assurance hash",
  "plan-assurance seal",
  "plan-assurance reseal",
  "plan-dependency add",
  "plan-dependency set",
  "plan-dependency remove",
  "task-outcome add",
  "task-outcome set",
  "task-outcome remove",
  "document migrate",
  "milestone acceptance replace",
  "milestone acceptance verify",
  "milestone acceptance fail",
  "milestone acceptance unavailable",
  "milestone acceptance revoke",
  "milestone acceptance waive",
  "milestone acceptance show",
  "calendar add",
  "calendar set",
  "calendar remove",
];

const expectedResources = [
  ["agent", ["help"]],
  ["batch", ["apply"]],
  ["calendar", ["add", "remove", "set"]],
  ["dag", ["advance", "analyze", "history", "import", "next", "render"]],
  ["document", ["check", "format", "migrate"]],
  ["gate", ["add", "remove", "set"]],
  ["milestone", ["acceptance fail", "acceptance replace", "acceptance revoke", "acceptance show", "acceptance unavailable", "acceptance verify", "acceptance waive", "add", "remove", "set"]],
  ["plan-assurance", ["hash", "reseal", "seal", "show"]],
  ["plan-dependency", ["add", "remove", "set"]],
  ["project", ["history", "init", "migrate-unit", "observe-velocity", "set", "show"]],
  ["resource", ["add", "remove", "set"]],
  ["task", ["add", "finish", "remove", "resume", "set", "start", "suspend"]],
  ["task-outcome", ["add", "remove", "set"]],
];

const knownSchemas = new Set([
  "Perttool.AgentGuidanceResult.v1",
  "Perttool.AnalysisResult.v7",
  "Perttool.AdvanceResult.v3",
  "Perttool.CheckResult.v6",
  "Perttool.CliError.v1",
  "Perttool.CommandHelpResult.v1",
  "Perttool.ExportResult.v1",
  "Perttool.FormatResult.v1",
  "Perttool.GuideResult.v1",
  "Perttool.HistoricalGraphResult.v1",
  "Perttool.ImportResult.v1",
  "Perttool.InitResult.v1",
  "Perttool.MilestoneAcceptanceMigrationResult.v1",
  "Perttool.MilestoneAcceptanceResult.v1",
  "Perttool.MutationResult.v6",
  "Perttool.NextResult.v8",
  "Perttool.PlanAssuranceResult.v2",
  "Perttool.ProjectHistoryResult.v1",
  "Perttool.ProjectResult.v5",
  "Perttool.SchemaResult.v1",
  "Perttool.UnitMigrationResult.v4",
  "Perttool.VelocityObservationResult.v1",
]);

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("Contract 9 command discovery projects every implemented capability in canonical order", () => {
  assert.deepEqual(
    COMMAND_REGISTRY.map(({ path: commandPath }) =>
      commandPath.join(" ")
    ),
    expectedPaths,
  );
  assert.equal(
    new Set(COMMAND_REGISTRY.map(({ operation }) => operation)).size,
    expectedPaths.length,
  );
  assert.ok(
    COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 9,
    ),
  );
  for (const descriptor of COMMAND_REGISTRY) {
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
  assert.equal(top.cliContractVersion, 9);
  assert.equal(top.operation, "help");
  assert.deepEqual(
    top.resources.map(({ name, actions }) => [name, actions]),
    expectedResources,
  );
  assert.deepEqual(top.commands, COMMAND_REGISTRY);
  const topText = renderCommandHelpResult(top);
  for (const commandPath of expectedPaths) {
    const [resource, ...actionParts] = commandPath.split(" ");
    if (actionParts.length === 0) {
      assert.match(topText, new RegExp(`^  ${resource}  `, "m"));
    } else {
      const action = actionParts.join(" ");
      assert.match(topText, new RegExp(`^    ${action}  `, "m"));
    }
  }
});

test("Contract 9 projections are the active public surface", () => {
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
    ["guide", "syntax"],
    ["document", "check", "--help"],
    ["batch", "apply", "--help"],
    ["gate", "add", "--help"],
    ["project", "init", "--help"],
  ]) {
    const result = runCli(args);
    assert.equal(result.status, 0, `${args.join(" ")}: ${result.stderr}`);
  }

  for (const args of [
    ["dsl", "check", "docs/examples/minimal.pert", "--format=json"],
    ["dsl", "format", "docs/examples/minimal.pert", "--format=json"],
    ["dsl", "help", "--format=json"],
    [
      "mutation",
      "apply",
      "docs/examples/minimal.pert",
      "--request",
      "missing.json",
      "--format=json",
    ],
  ]) {
    const result = runCli(args);
    assert.equal(result.status, 2, `${args.join(" ")}: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.cli_contract_version, 9);
    assert.equal(json.help_target.resource, null);
    assert.equal(json.help_target.action, null);
  }
});

test("project init discovery covers the complete public Contract 9 target", () => {
  const result = getCommandDiscovery({
    resource: "project",
    action: "init",
  });
  assert.equal(result.ok, true);
  const descriptor = result.commands[0];
  assert.ok(descriptor);
  assert.deepEqual(descriptor.path, ["project", "init"]);
  assert.equal(descriptor.operation, "project.init");
  assert.deepEqual(
    descriptor.operands.map(({ name, valueType }) => [name, valueType]),
    [["project-id", "project-id"]],
  );
  assert.deepEqual(
    descriptor.options.map(
      ({ name, required, defaultValue, conflicts }) => [
        name,
        required,
        defaultValue,
        conflicts,
      ],
    ),
    [
      ["title", true, null, []],
      ["duration-unit", false, "point", []],
      ["initial-milestone", true, null, []],
      ["initial-milestone-title", true, null, []],
      ["finish", true, null, []],
      ["version", false, 1, []],
      ["as-of", false, null, []],
      ["velocity", false, null, []],
      ["initial-milestone-deadline", false, null, []],
      ["goal-owner", false, null, []],
      ["goal-delegates", false, null, []],
      ["dag-owner", false, null, []],
      ["dag-delegates", false, null, []],
      ["out", false, null, []],
      ["format", false, "text", []],
      ["color", false, "auto", ["format=json when color=always"]],
    ],
  );
  assert.equal(
    descriptor.options.some(({ name }) =>
      ["write", "expect-digest"].includes(name)
    ),
    false,
  );
  assert.equal(descriptor.input, "none");
  assert.deepEqual(descriptor.stdin, {
    document: false,
    artifact: false,
    request: false,
    mutuallyExclusive: false,
  });
  assert.equal(descriptor.effect, "write-or-create");
  assert.deepEqual(descriptor.output, {
    formats: ["text", "json"],
    payload: "candidate-document",
    fileEffect: "optional-create",
  });
  assert.deepEqual(descriptor.resultSchemas, [
    "Perttool.InitResult.v1",
    "Perttool.CliError.v1",
  ]);
  assert.deepEqual(
    descriptor.exitStatuses.map(({ code }) => code),
    [0, 1, 2, 3, 5, 70],
  );
});

test("gate discovery covers the complete public Contract 9 mutation surface", () => {
  const add = getCommandDiscovery({ resource: "gate", action: "add" });
  assert.equal(add.ok, true);
  assert.deepEqual(
    add.commands[0]?.operands.map(({ name }) => name),
    ["file", "id", "from", "to"],
  );
  assert.equal(
    add.commands[0]?.options.find(({ name }) => name === "reason")?.required,
    true,
  );

  const set = getCommandDiscovery({ resource: "gate", action: "set" });
  assert.deepEqual(
    set.commands[0]?.options
      .filter(({ name }) => ["from", "to", "reason"].includes(name))
      .map(({ name }) => name),
    ["from", "to", "reason"],
  );

  const remove = getCommandDiscovery({ resource: "gate", action: "remove" });
  assert.equal(
    remove.commands[0]?.options.some(
      ({ name }) => ["from", "to", "reason"].includes(name),
    ),
    false,
  );
  for (const result of [add, set, remove]) {
    assert.equal(result.commands[0]?.effect, "preview");
    assert.deepEqual(
      result.commands[0]?.resultSchemas,
      ["Perttool.MutationResult.v6", "Perttool.CliError.v1"],
    );
  }
});

test("resource and action queries return complete projections of one result", () => {
  const resource = getCommandDiscovery({ resource: "project", action: null });
  assert.equal(resource.ok, true);
  assert.deepEqual(resource.resources.map(({ name }) => name), ["project"]);
  assert.deepEqual(
    resource.commands.map(({ path: commandPath }) => commandPath.join(" ")),
    [
      "project init",
      "project show",
      "project history",
      "project observe-velocity",
      "project set",
      "project migrate-unit",
    ],
  );
  assert.deepEqual(
    resource.resources[0]?.actions,
    ["history", "init", "migrate-unit", "observe-velocity", "set", "show"],
  );

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

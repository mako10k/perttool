import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CONTRACT4_COMMAND_HELP_REGISTRY } from "../dist/command/discovery.js";
import {
  commandUsageErrorToJson,
  renderCommandUsageError,
  serializeCommandUsageError,
  validateCommandInvocation,
} from "../dist/command/usage.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function invalid(argv) {
  const result = validateCommandInvocation(argv);
  assert.equal(result.ok, false, argv.join(" "));
  return result.error;
}

test("Contract 4 usage recovery returns the most specific stable help target", () => {
  const cases = [
    {
      argv: [],
      kind: "missing_resource",
      token: null,
      operation: null,
      target: { resource: null, action: null },
    },
    {
      argv: ["projcet", "show"],
      kind: "unknown_resource",
      token: "projcet",
      operation: null,
      target: { resource: null, action: null },
    },
    {
      argv: ["project"],
      kind: "missing_action",
      token: null,
      operation: null,
      target: { resource: "project", action: null },
    },
    {
      argv: ["project", "shwo"],
      kind: "unknown_action",
      token: "shwo",
      operation: null,
      target: { resource: "project", action: null },
    },
    {
      argv: ["project", "show", "plan.pert", "--formt", "json"],
      kind: "unknown_option",
      token: "--formt",
      operation: "project.show",
      target: { resource: "project", action: "show" },
    },
    {
      argv: ["project", "show", "plan.pert", "--format"],
      kind: "missing_option_value",
      token: "--format",
      operation: "project.show",
      target: { resource: "project", action: "show" },
    },
    {
      argv: ["project", "show", "plan.pert", "--format", "yaml"],
      kind: "invalid_option_value",
      token: "yaml",
      operation: "project.show",
      target: { resource: "project", action: "show" },
    },
    {
      argv: ["project", "show", "plan.pert", "--format", "text", "--format=json"],
      kind: "duplicate_option",
      token: "--format=json",
      operation: "project.show",
      target: { resource: "project", action: "show" },
    },
    {
      argv: ["document", "format", "plan.pert", "--diff=true"],
      kind: "unexpected_option_value",
      token: "--diff=true",
      operation: "document.format",
      target: { resource: "document", action: "format" },
    },
    {
      argv: ["project", "show"],
      kind: "missing_operand",
      token: null,
      operation: "project.show",
      target: { resource: "project", action: "show" },
    },
    {
      argv: ["project", "show", "plan.pert", "extra"],
      kind: "extra_operand",
      token: "extra",
      operation: "project.show",
      target: { resource: "project", action: "show" },
    },
    {
      argv: ["project", "init", "PROJECT"],
      kind: "missing_required_option",
      token: "--title",
      operation: "project.init",
      target: { resource: "project", action: "init" },
    },
    {
      argv: ["document", "format", "plan.pert", "--diff", "--write"],
      kind: "option_conflict",
      token: "--write",
      operation: "document.format",
      target: { resource: "document", action: "format" },
    },
    {
      argv: [
        "dag",
        "render",
        "plan.pert",
        "--to",
        "mermaid",
        "--capacity",
        "DEV=1",
      ],
      kind: "option_requires",
      token: "--capacity",
      operation: "dag.render",
      target: { resource: "dag", action: "render" },
    },
  ];

  for (const expected of cases) {
    const error = invalid(expected.argv);
    assert.equal(error.kind, expected.kind);
    assert.equal(error.token, expected.token);
    assert.equal(error.operation, expected.operation);
    assert.deepEqual(error.helpTarget, expected.target);
    assert.equal(error.code, "PTCLI-001");
    if (
      !["unknown_resource", "unknown_action", "unknown_option"].includes(
        error.kind,
      )
    ) {
      assert.equal(error.suggestion, null);
    }
  }
});

test("descriptor conflicts cover direct, conditional, and stdin relationships", () => {
  const cases = [
    ["document", "format", "plan.pert", "--write", "--diff"],
    ["document", "format", "plan.pert", "--diff", "--write"],
    [
      "document",
      "check",
      "plan.pert",
      "--format=json",
      "--color=always",
    ],
    ["document", "format", "-", "--write"],
    ["batch", "apply", "-", "--request", "-"],
  ];

  for (const argv of cases) {
    assert.equal(invalid(argv).kind, "option_conflict", argv.join(" "));
  }
});

test("usage suggestions are deterministic members of the resolved registry scope", () => {
  const resources = new Set(
    CONTRACT4_COMMAND_HELP_REGISTRY
      .filter(({ path: commandPath }) => commandPath.length === 2)
      .map(({ path: commandPath }) => commandPath[0]),
  );
  const projectActions = new Set(
    CONTRACT4_COMMAND_HELP_REGISTRY
      .filter(({ path: commandPath }) => commandPath[0] === "project")
      .map(({ path: commandPath }) => commandPath[1]),
  );
  const show = CONTRACT4_COMMAND_HELP_REGISTRY.find(
    ({ operation }) => operation === "project.show",
  );
  assert.ok(show);
  const showOptions = new Set(show.options.map(({ name }) => name));

  const cases = [
    {
      error: invalid(["projcet", "show"]),
      kind: "resource",
      value: "project",
      scope: resources,
    },
    {
      error: invalid(["project", "shwo"]),
      kind: "action",
      value: "show",
      scope: projectActions,
    },
    {
      error: invalid(["project", "show", "plan.pert", "--formt", "json"]),
      kind: "option",
      value: "format",
      scope: showOptions,
    },
  ];

  for (const { error, kind, value, scope } of cases) {
    assert.deepEqual(error.suggestion, { kind, value });
    assert.equal(scope.has(error.suggestion.value), true);
  }
  assert.equal(
    invalid(["project", "show", "plan.pert", "--banana"]).suggestion,
    null,
  );
  assert.equal(
    invalid(["project", "show", "plan.pert", "--formt", "json"]).suggestion
      .value,
    "format",
  );
});

test("valid invocation projection preserves operands, repeatable options, and help alias", () => {
  const initialized = validateCommandInvocation([
    "project",
    "init",
    "PROJECT",
    "--title",
    "Project",
    "--duration-unit",
    "day",
    "--initial-milestone",
    "START",
    "--initial-milestone-title",
    "Started",
    "--finish",
    "START",
  ]);
  assert.equal(initialized.ok, true);
  assert.equal(initialized.helpAlias, false);
  assert.equal(initialized.descriptor.operation, "project.init");
  assert.deepEqual(initialized.operands, ["PROJECT"]);

  const repeated = validateCommandInvocation([
    "dag",
    "analyze",
    "plan.pert",
    "--capacity",
    "DEV=1",
    "--capacity",
    "OPS=2",
  ]);
  assert.equal(repeated.ok, true);
  assert.deepEqual(
    repeated.options.filter(({ name }) => name === "capacity"),
    [
      { name: "capacity", value: "DEV=1" },
      { name: "capacity", value: "OPS=2" },
    ],
  );

  for (const descriptor of CONTRACT4_COMMAND_HELP_REGISTRY) {
    const result = validateCommandInvocation([...descriptor.path, "--help"]);
    assert.equal(result.ok, true, descriptor.path.join(" "));
    assert.equal(result.helpAlias, true);
    assert.deepEqual(result.operands, []);
    assert.deepEqual(result.options, []);
  }
});

test("usage error text and JSON are byte deterministic and recovery-complete", () => {
  const error = invalid([
    "project",
    "show",
    "plan.pert",
    "--formt",
    "json",
  ]);
  const json = commandUsageErrorToJson(error);
  assert.deepEqual(Object.keys(json), [
    "schema_version",
    "cli_contract_version",
    "tool_version",
    "operation",
    "ok",
    "help_target",
    "usage",
    "diagnostics",
  ]);
  assert.equal(json.schema_version, "Perttool.CliError.v1");
  assert.equal(json.cli_contract_version, 4);
  assert.equal(json.operation, "project.show");
  assert.equal(json.ok, false);
  assert.deepEqual(json.help_target, {
    resource: "project",
    action: "show",
  });
  assert.deepEqual(json.usage, {
    kind: "unknown_option",
    token: "--formt",
    suggestion: { kind: "option", value: "format" },
  });
  assert.equal(json.diagnostics[0].code, "PTCLI-001");

  const serialized = serializeCommandUsageError(error);
  const text = renderCommandUsageError(error);
  assert.equal(serialized, serializeCommandUsageError(error));
  assert.equal(text, renderCommandUsageError(error));
  assert.ok(serialized.endsWith("\n"));
  assert.ok(text.endsWith("\n"));
  assert.match(text, /^PTCLI-001 error: unknown option --formt$/m);
  assert.match(text, /^  token: --formt$/m);
  assert.match(text, /^  suggestion: --format$/m);
  assert.match(text, /^  help: perttool help project show$/m);
});

test("usage recovery runs outside a project without I/O or environment discovery", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "perttool-command-usage-"),
  );
  try {
    const moduleUrl = pathToFileURL(
      path.join(root, "dist", "command", "usage.js"),
    ).href;
    const script = [
      `import { serializeCommandUsageError, validateCommandInvocation } from ${JSON.stringify(moduleUrl)};`,
      'const result = validateCommandInvocation(["project", "shwo"]);',
      'if (result.ok) throw new Error("expected invalid invocation");',
      "process.stdout.write(serializeCommandUsageError(result.error));",
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
    assert.equal(JSON.parse(result.stdout).usage.kind, "unknown_action");
    assert.deepEqual(await readdir(temporaryDirectory), []);

    const source = await readFile(
      path.join(root, "src", "command", "usage.ts"),
      "utf8",
    );
    const imports = [...source.matchAll(/from "([^"]+)"/g)]
      .map((match) => match[1]);
    assert.deepEqual(
      [...new Set(imports)].sort(),
      ["../version.js", "./discovery.js", "./registry.js"],
    );
    assert.doesNotMatch(source, /\b(?:fetch|process\.env|node:)/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

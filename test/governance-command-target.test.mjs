import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  CONTRACT4_COMMAND_REGISTRY,
} from "../dist/command/discovery.js";
import {
  TARGET_GOVERNANCE_COMMAND_REGISTRY,
  getTargetGovernanceCommandDiscovery,
  renderTargetGovernanceCommandHelpResult,
  serializeTargetGovernanceCommandHelpResult,
  targetGovernanceCommandHelpResultToJson,
} from "../dist/command/target-governance-discovery.js";
import {
  governanceRequestFromTargetInvocation,
  serializeTargetGovernanceCommandUsageError,
  validateTargetGovernanceCommandInvocation,
} from "../dist/command/target-governance-usage.js";
import {
  validateCommandInvocation,
} from "../dist/command/usage.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

const governedOperations = [
  "project.set",
  "dag.advance",
  "task.add",
  "task.set",
  "task.remove",
  "gate.add",
  "gate.set",
  "gate.remove",
  "milestone.add",
  "milestone.remove",
  "batch.apply",
];

function descriptor(operation) {
  const found = TARGET_GOVERNANCE_COMMAND_REGISTRY.find(
    (candidate) => candidate.operation === operation,
  );
  assert.ok(found, operation);
  return found;
}

function option(command, name) {
  const found = command.options.find((candidate) => candidate.name === name);
  assert.ok(found, `${command.operation} --${name}`);
  return found;
}

function projectInitArgs(...extra) {
  return [
    "project",
    "init",
    "SAMPLE",
    "--title",
    "Sample",
    "--duration-unit",
    "day",
    "--initial-milestone",
    "START",
    "--initial-milestone-title",
    "Started",
    "--finish",
    "START",
    ...extra,
  ];
}

test("target Contract 5 registry is a complete deterministic projection", () => {
  assert.equal(TARGET_GOVERNANCE_COMMAND_REGISTRY.length, 28);
  assert.deepEqual(
    TARGET_GOVERNANCE_COMMAND_REGISTRY.map(({ path: commandPath }) =>
      commandPath.join(" ")
    ),
    CONTRACT4_COMMAND_REGISTRY.map(({ path: commandPath }) =>
      commandPath.join(" ")
    ),
  );
  assert.ok(
    TARGET_GOVERNANCE_COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 5,
    ),
  );
  for (const command of TARGET_GOVERNANCE_COMMAND_REGISTRY) {
    assert.equal(
      new Set(command.options.map(({ name }) => name)).size,
      command.options.length,
      command.operation,
    );
    assert.equal(
      command.resultSchemas.includes("Perttool.ProjectResult.v2"),
      false,
      command.operation,
    );
    assert.equal(
      command.resultSchemas.includes("Perttool.MutationResult.v1"),
      false,
      command.operation,
    );
  }
  assert.deepEqual(
    descriptor("project.show").resultSchemas,
    ["Perttool.ProjectResult.v3", "Perttool.CliError.v1"],
  );
  for (const active of CONTRACT4_COMMAND_REGISTRY.filter(({ resultSchemas }) =>
    resultSchemas.includes("Perttool.MutationResult.v1")
  )) {
    assert.ok(
      descriptor(active.operation).resultSchemas.includes(
        "Perttool.MutationResult.v2",
      ),
      active.operation,
    );
  }
});

test("only actual scope-capable commands receive the governance assertion group", () => {
  const actual = TARGET_GOVERNANCE_COMMAND_REGISTRY
    .filter((command) =>
      command.options.some(({ sharedGroup }) => sharedGroup === "governance")
    )
    .map(({ operation }) => operation);
  assert.deepEqual(actual, governedOperations);
  for (const operation of governedOperations) {
    const command = descriptor(operation);
    const actor = option(command, "actor");
    const accepted = option(command, "accepted-by-owner");
    assert.equal(actor.valueType, "principal-id");
    assert.equal(actor.repeatable, false);
    assert.equal(actor.sharedGroup, "governance");
    assert.equal(accepted.valueType, "principal-id");
    assert.equal(accepted.repeatable, true);
    assert.equal(accepted.sharedGroup, "governance");
    assert.equal(
      accepted.description,
      "Single-candidate caller assertion that the named effective owner was consulted for the previewed affected scopes; do not reuse it across commands.",
    );
  }
  for (const operation of [
    "document.format",
    "project.init",
    "project.migrate-unit",
    "dag.import",
    "task.finish",
    "milestone.set",
    "resource.add",
    "resource.set",
    "resource.remove",
  ]) {
    assert.equal(
      descriptor(operation).options.some(
        ({ sharedGroup }) => sharedGroup === "governance",
      ),
      false,
      operation,
    );
  }
});

test("target project options and help expose the accepted caller-assertion meaning", () => {
  for (const operation of ["project.init", "project.set"]) {
    const command = descriptor(operation);
    assert.deepEqual(
      [
        "goal-owner",
        "goal-delegates",
        "dag-owner",
        "dag-delegates",
      ].map((name) => [
        name,
        option(command, name).valueType,
        option(command, name).spelling.dsl,
      ]),
      [
        ["goal-owner", "principal-id", "goal_owner"],
        ["goal-delegates", "principal-list", "goal_delegates"],
        ["dag-owner", "principal-id", "dag_owner"],
        ["dag-delegates", "principal-list", "dag_delegates"],
      ],
    );
  }
  assert.deepEqual(
    option(descriptor("project.set"), "clear").enumValues.slice(-4),
    [
      "goal_owner",
      "goal_delegates",
      "dag_owner",
      "dag_delegates",
    ],
  );

  const help = getTargetGovernanceCommandDiscovery({
    resource: "project",
    action: "set",
  });
  assert.equal(help.ok, true);
  assert.equal(help.cliContractVersion, 5);
  const text = renderTargetGovernanceCommandHelpResult(help);
  assert.match(
    text,
    /description=Single-candidate caller assertion that the named effective owner was consulted for the previewed affected scopes; do not reuse it across commands\./,
  );
  assert.doesNotMatch(
    text,
    /\b(?:authenticated|verified|signed|durable approval ledger)\b/i,
  );
  const json = targetGovernanceCommandHelpResultToJson(help);
  assert.equal(json.cli_contract_version, 5);
  const accepted = json.commands[0].options.find(
    ({ name }) => name === "accepted-by-owner",
  );
  assert.equal(
    accepted.description,
    "Single-candidate caller assertion that the named effective owner was consulted for the previewed affected scopes; do not reuse it across commands.",
  );
  assert.equal(
    serializeTargetGovernanceCommandHelpResult(help),
    `${JSON.stringify(json, null, 2)}\n`,
  );
});

test("target usage prepares one operation-level request before document I/O", () => {
  const preview = validateTargetGovernanceCommandInvocation([
    "project",
    "set",
    "plan.pert",
    "--actor",
    "codex",
    "--accepted-by-owner",
    "user",
    "--accepted-by-owner",
    "llm",
    "--diff",
  ]);
  assert.equal(preview.ok, true);
  assert.deepEqual(governanceRequestFromTargetInvocation(preview), {
    intent: "preview",
    actor: "codex",
    acceptedByOwner: ["user", "llm"],
  });

  const persist = validateTargetGovernanceCommandInvocation([
    "task",
    "remove",
    "plan.pert",
    "WORK",
    "--actor=codex",
    "--out",
    "candidate.pert",
  ]);
  assert.equal(persist.ok, true);
  assert.deepEqual(governanceRequestFromTargetInvocation(persist), {
    intent: "persist",
    actor: "codex",
    acceptedByOwner: [],
  });
});

test("malformed and duplicate target assertions are Contract 5 usage errors", () => {
  for (const [argv, kind] of [
    [
      ["project", "set", "plan.pert", "--actor", "user@example.com"],
      "invalid_option_value",
    ],
    [
      [
        "project",
        "set",
        "plan.pert",
        "--accepted-by-owner",
        "user",
        "--accepted-by-owner",
        "user",
      ],
      "duplicate_option",
    ],
    [
      projectInitArgs("--goal-delegates", "[user, user]"),
      "invalid_option_value",
    ],
    [
      projectInitArgs("--goal-owner", "user", "--version", "3"),
      "option_conflict",
    ],
  ]) {
    const result = validateTargetGovernanceCommandInvocation(argv);
    assert.equal(result.ok, false, argv.join(" "));
    assert.equal(result.error.kind, kind);
    const json = JSON.parse(
      serializeTargetGovernanceCommandUsageError(result.error),
    );
    assert.equal(json.cli_contract_version, 5);
    assert.equal(json.diagnostics[0].code, "PTCLI-001");
  }
  assert.equal(
    validateTargetGovernanceCommandInvocation(
      projectInitArgs("--goal-owner", "user", "--version", "4"),
    ).ok,
    true,
  );
  assert.equal(
    validateTargetGovernanceCommandInvocation(
      projectInitArgs("--goal-owner", "user"),
    ).ok,
    true,
  );
});

test("active root and CLI expose Contract 9 without target-prefixed helpers", () => {
  assert.equal("planTargetGovernanceMutation" in publicApi, false);
  assert.equal("TARGET_GOVERNANCE_COMMAND_REGISTRY" in publicApi, false);
  assert.ok(
    publicApi.COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 9,
    ),
  );
  assert.equal(
    publicApi.COMMAND_REGISTRY.some(({ options }) =>
      options.some(({ name }) =>
        [
          "actor",
          "accepted-by-owner",
          "goal-owner",
          "goal-delegates",
          "dag-owner",
          "dag-delegates",
        ].includes(name)
      )
    ),
    true,
  );
  const activeUsage = publicApi.validateCommandInvocation([
    "project",
    "set",
    "docs/examples/minimal.pert",
    "--actor",
    "codex",
  ]);
  assert.equal(activeUsage.ok, true);

  const run = spawnSync(
    process.execPath,
    [
      cli,
      "project",
      "set",
      "docs/examples/minimal.pert",
      "--actor",
      "codex",
      "--title",
      "governed preview",
      "--format",
      "json",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  const json = JSON.parse(run.stdout);
  assert.equal(json.cli_contract_version, 9);
  assert.equal(json.schema_version, "Perttool.MutationResult.v6");
  assert.equal(json.governance.applicable, false);
});

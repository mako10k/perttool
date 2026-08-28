import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  commandDescriptorToJson,
  getCommandDiscovery,
  renderCommandHelpResult,
  validateCommandInvocation,
} from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");

const taskOnlyOptions = Object.freeze([
  ["not-before", "2026-08-27T09:00:00+09:00"],
  ["deadline", "2026-12-31"],
  ["title", "Ignored title"],
  ["description", "Ignored description"],
  ["status", "done"],
  ["priority", "100"],
  ["owner", "ignored-owner"],
  ["blocked-reason", "Ignored reason"],
  ["source", "Ignored source"],
  ["duration", "1p"],
  ["optimistic", "1p"],
  ["most-likely", "2p"],
  ["pessimistic", "3p"],
  ["tag", "ignored-tag"],
  ["require", "IGNORED=1"],
]);

const mutationSharedOptions = Object.freeze([
  "actor",
  "accepted-by-owner",
  "format",
  "color",
  "max-diagnostics",
  "warnings-as-errors",
  "diff",
  "write",
  "out",
  "expect-digest",
]);

const planningCommands = Object.freeze([
  Object.freeze({
    operation: "work.reshape.preflight",
    path: Object.freeze(["work", "reshape", "preflight"]),
    options: Object.freeze([
      "request",
      "intent-request",
      "add-residual-description",
      "format",
      "color",
      "max-diagnostics",
      "warnings-as-errors",
    ]),
    operands: Object.freeze(["missing-issue-26.pert"]),
    required: Object.freeze(["--request", "missing-issue-26.json"]),
  }),
  Object.freeze({
    operation: "work.reshape.apply",
    path: Object.freeze(["work", "reshape", "apply"]),
    options: Object.freeze([
      "request",
      "intent-request",
      "preflight-hash",
      "preflight-token",
      "add-residual-description",
      ...mutationSharedOptions,
    ]),
    operands: Object.freeze(["missing-issue-26.pert"]),
    required: Object.freeze([
      "--request",
      "missing-issue-26.json",
      "--preflight-hash",
      `sha256:${"0".repeat(64)}`,
      "--preflight-token",
      "missing-token",
    ]),
  }),
  ...["add", "set", "close"].map((action) => Object.freeze({
    operation: `window.${action}`,
    path: Object.freeze(["window", action]),
    options: Object.freeze(["request", "intent-request", ...mutationSharedOptions]),
    operands: Object.freeze(["missing-issue-26.pert", "SPRINT"]),
    required: Object.freeze(["--request", "missing-issue-26.json"]),
  })),
]);

test("Issue #26 Planning Pool descriptors expose only operation-owned options", () => {
  for (const command of planningCommands) {
    const descriptor = COMMAND_REGISTRY.find(
      ({ operation }) => operation === command.operation,
    );
    assert.ok(descriptor, command.operation);
    assert.deepEqual(
      descriptor.options.map(({ name }) => name),
      command.options,
      command.operation,
    );
    const json = commandDescriptorToJson(descriptor);
    assert.deepEqual(
      json.options.map(({ name }) => name),
      command.options,
      `${command.operation}: JSON discovery`,
    );
    const help = renderCommandHelpResult(getCommandDiscovery({
      resource: command.path[0],
      action: command.path.slice(1).join(" "),
    }));
    for (const name of command.options) {
      assert.match(
        help,
        new RegExp(`--${name}\\b`, "u"),
        `${command.operation}: --${name}`,
      );
    }
    for (const [name] of taskOnlyOptions) {
      assert.doesNotMatch(
        help,
        new RegExp(`--${name}\\b`, "u"),
        `${command.operation}: --${name}`,
      );
    }
  }
});

test("Issue #26 usage rejects every Task-only Planning Pool option", () => {
  for (const command of planningCommands) {
    for (const [name, value] of taskOnlyOptions) {
      const validation = validateCommandInvocation([
        ...command.path,
        ...command.operands,
        ...command.required,
        `--${name}`,
        value,
      ]);
      assert.equal(validation.ok, false, `${command.operation}: --${name}`);
      assert.equal(validation.error.kind, "unknown_option");
      assert.equal(validation.error.operation, command.operation);
      assert.equal(validation.error.token, `--${name}`);
    }
  }
});

test("Issue #26 real CLI rejects inapplicable options before document input", () => {
  for (const args of [
    [
      "window",
      "add",
      "missing-issue-26.pert",
      "SPRINT",
      "--request",
      "missing-issue-26.json",
      "--status",
      "done",
    ],
    [
      "work",
      "reshape",
      "apply",
      "missing-issue-26.pert",
      "--request",
      "missing-issue-26.json",
      "--preflight-hash",
      `sha256:${"0".repeat(64)}`,
      "--preflight-token",
      "missing-token",
      "--deadline",
      "2026-12-31",
    ],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 2, `${args.join(" ")}\n${result.stderr}`);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /PTCLI-001 error: unknown option/u);
    assert.doesNotMatch(result.stderr, /ENOENT|not found/u);
  }
});

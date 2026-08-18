import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as packageRoot from "../dist/index.js";
import * as nodeApi from "../dist/node/index.js";
import { createCliApplicationFacade } from "../dist/application/cli-facade.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function runCli(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("CLI Application facade retains established service identity", () => {
  const facade = createCliApplicationFacade(packageRoot.createNodeHost());
  assert.equal(Object.isFrozen(facade), true);
  assert.equal(facade.hostModelVersion, 1);
  assert.equal(facade.checkDocument, packageRoot.checkDocument);
  assert.equal(facade.analyzeDocument, packageRoot.analyzeDocument);
  assert.equal(facade.selectNextTasks, packageRoot.selectNextTasks);
  assert.equal(facade.planFormat, packageRoot.planFormat);
  assert.equal(facade.getProjectMetadata, packageRoot.getProjectMetadata);
  assert.equal(facade.getAgentHelp, packageRoot.getAgentHelp);
});

test("CLI environmental work is bound to supplied Node Host ports", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "perttool-cli-facade-"));
  const sourcePath = path.join(root, "docs", "examples", "minimal.pert");
  const artifactPath = path.join(temporary, "artifact.txt");
  const documentPath = path.join(temporary, "candidate.pert");
  const base = packageRoot.createNodeHost();
  const calls = { document: 0, digest: 0, git: 0, persistence: 0 };
  const host = Object.freeze({
    ...base,
    digest: Object.freeze({
      ...base.digest,
      sha256Bytes(bytes) {
        calls.digest += 1;
        return base.digest.sha256Bytes(bytes);
      },
    }),
    documentBytes: Object.freeze({
      async read(target) {
        calls.document += 1;
        return base.documentBytes.read(target);
      },
    }),
    gitEvidence: Object.freeze({
      ...base.gitEvidence,
      async probeHistory() {
        calls.git += 1;
        return Object.freeze({
          ok: false,
          modelVersion: 1,
          kind: "git_command_failed",
          operation: "injected-cli-parity-probe",
        });
      },
    }),
    safePersistence: Object.freeze({
      ...base.safePersistence,
      async createValidatedDocument(...args) {
        calls.persistence += 1;
        return base.safePersistence.createValidatedDocument(...args);
      },
      async createArtifact(...args) {
        calls.persistence += 1;
        return base.safePersistence.createArtifact(...args);
      },
    }),
  });
  const facade = createCliApplicationFacade(host);
  try {
    const source = await facade.readDocumentContent(sourcePath);
    assert.equal(source.digest, base.digest.sha256Bytes(source.bytes));
    assert.equal(source.text, await repositoryText("docs/examples/minimal.pert"));
    await facade.createArtifactFile(artifactPath, "facade artifact\n");
    await facade.createTargetGrammar6DocumentFile(
      documentPath,
      source.text,
      TARGET_GRAMMAR_6_CAPABILITY,
    );
    const history = await facade.inspectTargetProjectHistoryFile(
      { targetPath: sourcePath },
      TARGET_GRAMMAR_6_CAPABILITY,
    );
    assert.equal(history.ok, false);
    assert.equal(history.diagnostics[0].data.operation, "injected-cli-parity-probe");
    assert.equal(facade.recheckAdvanceHistoryBaseline, host.gitEvidence.recheckAdvanceBaseline);
    assert.deepEqual(calls, { document: 1, digest: 1, git: 1, persistence: 2 });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Contract 9 CLI bytes retain direct Application semantics", async () => {
  const file = "docs/examples/minimal.pert";
  const first = runCli("document", "check", file, "--format=json");
  const second = runCli("document", "check", file, "--format=json");
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stderr, second.stderr);
  const wire = JSON.parse(first.stdout);
  const direct = packageRoot.checkDocument(await repositoryText(file));
  assert.equal(wire.schema_version, "Perttool.CheckResult.v6");
  assert.equal(wire.cli_contract_version, 9);
  assert.equal(wire.document_id, direct.documentId);
  assert.equal(wire.grammar_version, direct.grammarVersion);
  assert.deepEqual(wire.summary, {
    resources: direct.summary.resources,
    milestones: direct.summary.milestones,
    tasks: direct.summary.tasks,
    gates: direct.summary.gates,
    errors: direct.summary.errors,
    warnings: direct.summary.warnings,
  });
});

test("CLI and Node activate the same milestone acceptance services", () => {
  const help = runCli("help", "--format=json");
  const schemas = runCli("schema", "--format=json");
  assert.equal(help.status, 0, help.stderr);
  assert.equal(schemas.status, 0, schemas.stderr);
  assert.equal(JSON.parse(help.stdout).commands.length, 56);
  assert.equal(JSON.parse(schemas.stdout).schemas.length, 23);
  assert.equal(packageRoot.COMMAND_REGISTRY.length, 56);
  assert.equal(packageRoot.getJsonSchemaCatalog().length, 23);
  assert.deepEqual(Object.keys(packageRoot), Object.keys(nodeApi));
  assert.equal(Object.keys(packageRoot).length, 129);
  assert.equal(Object.keys(core).length, 45);
  for (const name of Object.keys(packageRoot)) {
    assert.equal(packageRoot[name], nodeApi[name], name);
  }
});

test("CLI composition has no editor or MCP dependency", async () => {
  const [source, facade, manifestText] = await Promise.all([
    repositoryText("src/cli.ts"),
    repositoryText("src/application/cli-facade.ts"),
    repositoryText("package.json"),
  ]);
  assert.match(source, /createCliApplicationFacade\([\s\S]*createNodeHost\(\),[\s\S]*createHistoricalGraphGitEvidenceHost\(\),[\s\S]*\)/u);
  assert.equal(/from "\.\/history\/git-probe\.js"/u.test(source), false);
  assert.equal(/from "\.\/io\/(?:document-file|target-safe-write)\.js"/u.test(source), false);
  assert.equal(/adapters\/(?:lsp|vscode|mcp)|vscode-language|modelcontextprotocol/u.test(source), false);
  assert.equal(/adapters\/(?:lsp|vscode|mcp)|vscode-language|modelcontextprotocol/u.test(facade), false);
  assert.deepEqual(JSON.parse(manifestText).dependencies ?? {}, {});
});

test("CLI facade cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/cli-facade-parity-cases-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.CliFacadeParityCases.v1");
  assert.equal(fixture.cli_contract_version, 7);
  const accepted = new Set();
  for (const acceptanceCase of fixture.cases) {
    assert.equal(
      acceptanceCase.depends_on.every((id) => accepted.has(id)),
      true,
      acceptanceCase.id,
    );
    accepted.add(acceptanceCase.id);
  }
  assert.deepEqual([...accepted], expectedIds("CFP", 10));
});

test("CLI facade acceptance and completed lifecycle remain aligned", async () => {
  const [acceptance, plan] = await Promise.all([
    repositoryText("docs/process/adapter-cli-facade-parity-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Task: `CLI_FACADE_PARITY`/u);
  assert.match(
    acceptance,
    /WE-80a3a5d16c2e7063b8bb9fefe0cb0922f678368df1cef3fcbbbea701779647ed/u,
  );
  assert.match(plan, /task CLI_FACADE_PARITY [\s\S]*?status done/u);
  assert.match(
    plan,
    /work_event WE-80a3a5d16c2e7063b8bb9fefe0cb0922f678368df1cef3fcbbbea701779647ed:/u,
  );
});

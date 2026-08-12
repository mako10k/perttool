import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import {
  sha256Digest,
  sha256DigestUtf8,
} from "../dist/model/sha256.js";
import * as nodeApi from "../dist/node/index.js";
import * as packageRoot from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function fixture() {
  return JSON.parse(
    await repositoryText("test/fixtures/node-host-boundary-cases-v1.json"),
  );
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".ts") ? [absolute] : [];
  }));
  return nested.flat();
}

test("Node Host port contracts remain portable and inward-owned", async () => {
  const [cases, contracts, hostSource] = await Promise.all([
    fixture(),
    repositoryText("src/ports/node-host.ts"),
    repositoryText("src/node/host.ts"),
  ]);
  assert.equal(cases.schema_version, "Perttool.NodeHostBoundaryCases.v1");
  assert.equal(cases.port_model_version, 1);
  assert.equal(/from "node:/u.test(contracts), false);
  assert.equal(/^import (?!type\b)/mu.test(contracts), false);
  assert.match(hostSource, /from "node:crypto"/u);
  assert.match(hostSource, /from "node:fs\/promises"/u);
  assert.equal(/\.\/application\/|\.\.\/application\/|\.\/cli/u.test(hostSource), false);
});

test("Node builtins remain confined to logical and concrete hosts", async () => {
  const cases = await fixture();
  const files = await sourceFiles(path.join(root, "src"));
  const owners = [];
  for (const absolute of files) {
    const source = await readFile(absolute, "utf8");
    if (/from "node:|import\("node:/u.test(source)) {
      owners.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  owners.sort();
  assert.deepEqual(owners, [...cases.node_builtin_sources].sort());
});

test("Node Host is additive while root and Node facades remain identical", async () => {
  const cases = await fixture();
  assert.equal(Object.keys(packageRoot).length, cases.target.root_runtime_exports);
  assert.equal(Object.keys(nodeApi).length, cases.target.node_runtime_exports);
  assert.equal(Object.keys(core).length, cases.target.core_runtime_exports);
  assert.deepEqual(Object.keys(nodeApi), Object.keys(packageRoot));
  for (const name of Object.keys(packageRoot)) {
    if (["checkDocument", "analyzeDocument", "selectNextTasks"].includes(name)) {
      assert.notEqual(nodeApi[name], packageRoot[name], name);
    } else {
      assert.equal(nodeApi[name], packageRoot[name], name);
    }
  }
  assert.equal(typeof packageRoot.createNodeHost, "function");
  assert.equal("createNodeHost" in core, false);
  assert.equal(Object.keys(packageRoot.COMMAND_REGISTRY).length, cases.target.commands + 1);
  assert.equal(packageRoot.getJsonSchemaCatalog().length, cases.target.root_schemas + 1);
});

test("Node Host digest, byte sources, and process context are exact and bounded", async () => {
  const host = packageRoot.createNodeHost();
  assert.equal(host.modelVersion, 1);
  assert.equal(Object.isFrozen(host), true);
  for (const value of Object.values(host)) {
    if (typeof value === "object") assert.equal(Object.isFrozen(value), true);
  }
  assert.equal(
    host.digest.sha256Utf8(""),
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    host.digest.sha256Bytes(new TextEncoder().encode("abc")),
    "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );

  const planPath = path.join(root, "docs/examples/minimal.pert");
  const planBytes = await host.documentBytes.read(planPath);
  assert.equal(
    host.digest.sha256Bytes(planBytes),
    packageRoot.digestDocumentBytes(planBytes),
  );
  const schemaLocation = new URL(
    "../schemas/Perttool.Common.v1.schema.json",
    import.meta.url,
  );
  const schema = JSON.parse(
    new TextDecoder().decode(host.bundledArtifacts.read(schemaLocation)),
  );
  assert.equal(schema.$schema, packageRoot.JSON_SCHEMA_DIALECT);

  assert.deepEqual(Object.keys(host.processContext).sort(), [
    "cwd",
    "pid",
    "platform",
    "umask",
  ]);
  assert.equal(host.processContext.cwd(), process.cwd());
  assert.equal(host.processContext.pid(), process.pid);
  assert.equal(host.processContext.platform(), process.platform);
  assert.equal(Number.isInteger(host.processContext.umask()), true);
});

test("portable semantic SHA-256 matches the Node Host across block boundaries", () => {
  const host = packageRoot.createNodeHost();
  const inputs = [
    "",
    "abc",
    "semantic plan identity",
    "café 🚀 plan",
    "x".repeat(55),
    "x".repeat(56),
    "x".repeat(63),
    "x".repeat(64),
    "x".repeat(65),
    "x".repeat(1000),
  ];
  for (const input of inputs) {
    const bytes = new TextEncoder().encode(input);
    assert.equal(sha256DigestUtf8(input), host.digest.sha256Utf8(input), input.length);
    assert.equal(sha256Digest(bytes), host.digest.sha256Bytes(bytes), input.length);
    assert.equal(sha256DigestUtf8(input), sha256Digest(bytes), input.length);
  }
});

test("Node Host preserves Git evidence and safe-persistence guarantees", async () => {
  const host = packageRoot.createNodeHost();
  const planPath = path.join(root, "plans/adapter-platform.pert");
  const currentBytes = await host.documentBytes.read(planPath);
  const history = await host.gitEvidence.probeHistory({
    targetPath: planPath,
    expectedSourceDigest: host.digest.sha256Bytes(currentBytes),
  });
  assert.equal(history.ok, true);
  if (history.ok) {
    assert.equal(history.currentSourceDigest, host.digest.sha256Bytes(currentBytes));
    assert.equal(history.traversal, "first_parent");
  }

  const temporary = await mkdtemp(path.join(tmpdir(), "perttool-node-host-"));
  try {
    const target = path.join(temporary, "artifact.txt");
    const written = await host.safePersistence.createArtifact(target, "host boundary\n");
    assert.equal(written.written, true);
    assert.equal(
      written.digest,
      host.digest.sha256Utf8("host boundary\n"),
    );
    await assert.rejects(
      () => host.safePersistence.createArtifact(target, "replacement\n"),
      (error) => error instanceof packageRoot.SafeWriteConflictError &&
        error.reason === "target_exists",
    );
    assert.equal(await readFile(target, "utf8"), "host boundary\n");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("Node Host cases, acceptance record, and lifecycle state are aligned", async () => {
  const [cases, specification, acceptance, plan] = await Promise.all([
    fixture(),
    repositoryText("docs/specs/node-host-boundary.md"),
    repositoryText("docs/process/adapter-node-host-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  const accepted = new Set();
  for (const boundaryCase of cases.cases) {
    assert.equal(
      boundaryCase.depends_on.every((id) => accepted.has(id)),
      true,
      boundaryCase.id,
    );
    accepted.add(boundaryCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from({ length: 8 }, (_, index) =>
      `NHP-${String(index + 1).padStart(3, "0")}`),
  );
  assert.match(specification, /- Document status: Accepted 1\.0/u);
  assert.match(acceptance, /- Document status: Accepted 1\.0/u);
  assert.match(
    plan,
    /task NODE_PORT_BOUNDARY[\s\S]*?status done[\s\S]*?task CLI_FACADE_PARITY/u,
  );
});

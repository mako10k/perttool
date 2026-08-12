import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ProtocolError,
  ProtocolErrorCode,
  fromJsonSchema,
} from "@modelcontextprotocol/server";
import {
  MCP_LIMITS,
  MCP_PROTOCOL_MODEL_VERSION,
  MCP_PROTOCOL_REVISION,
  MCP_TOOL_INPUT_SCHEMAS,
  MCP_TOOL_OUTPUT_SCHEMAS,
  createPerttoolMcpAdapter,
  createRegistrationCatalog,
  externalSchemaReferences,
} from "../adapters/mcp/dist/index.js";
import {
  analyzeDocument,
  checkDocument,
  createNodeHost,
  selectNextTasks,
} from "../dist/node/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function fixture() {
  return JSON.parse(
    await repositoryText("test/fixtures/mcp-read-adapter-cases-v1.json"),
  );
}

function digestBytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function input(kind, text) {
  return { source: { kind, text } };
}

async function validate(schema, value) {
  const validator = fromJsonSchema(schema);
  const result = await validator["~standard"].validate(value);
  assert.equal(result.issues, undefined, result.issues?.[0]?.message);
}

function assertContentIdentity(result) {
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
}

test("private MCP workspace pins the accepted stable SDK and source inventory", async () => {
  const [cases, manifestText, lockText, sourceEntries] = await Promise.all([
    fixture(),
    repositoryText("adapters/mcp/package.json"),
    repositoryText("package-lock.json"),
    readdir(path.join(root, "adapters/mcp/src")),
  ]);
  const manifest = JSON.parse(manifestText);
  const lock = JSON.parse(lockText);
  assert.equal(cases.schema_version, "Perttool.McpReadAdapterCases.v1");
  assert.equal(cases.protocol_model_version, MCP_PROTOCOL_MODEL_VERSION);
  assert.equal(cases.protocol_revision, MCP_PROTOCOL_REVISION);
  assert.equal(manifest.name, cases.workspace.name);
  assert.equal(manifest.private, true);
  assert.equal(manifest.dependencies[cases.sdk.package], cases.sdk.version);
  assert.equal(
    lock.packages[`node_modules/${cases.sdk.package}`].version,
    cases.sdk.version,
  );
  assert.deepEqual(
    sourceEntries.filter((name) => name.endsWith(".ts")).sort(),
    cases.workspace.source_files,
  );
});

test("discovery is exact, deterministic, and advertises no write capability", async () => {
  const cases = await fixture();
  const adapter = createPerttoolMcpAdapter();
  assert.deepEqual(adapter.resourceUris, cases.resources);
  assert.deepEqual(adapter.toolNames, cases.tools);
  const capabilities = await adapter.readResource("perttool://capabilities");
  assert.equal(capabilities.schema_version, "Perttool.McpCapabilities.v1");
  assert.deepEqual(capabilities.source_kinds, ["inline", "registered"]);
  assert.ok(capabilities.unavailable.includes("mutations"));
  assert.ok(capabilities.unavailable.includes("git_refs"));
  assert.ok(capabilities.unavailable.includes("network_transport"));
  assert.equal(JSON.stringify(capabilities).includes(path.sep + "home"), false);

  const server = adapter.createServer();
  assert.deepEqual(server.server.getCapabilities(), {
    resources: { subscribe: false, listChanged: false },
    tools: { listChanged: false },
  });
  await server.close();
  await assert.rejects(
    () => adapter.readResource("perttool://capabilities?extra=true"),
    /unknown perttool resource/u,
  );
});

test("all local schemas are closed at their adapter roots and have no external reference", async () => {
  for (const name of Object.keys(MCP_TOOL_INPUT_SCHEMAS)) {
    assert.deepEqual(externalSchemaReferences(MCP_TOOL_INPUT_SCHEMAS[name]), []);
    assert.deepEqual(externalSchemaReferences(MCP_TOOL_OUTPUT_SCHEMAS[name]), []);
    const inputSchema = MCP_TOOL_INPUT_SCHEMAS[name];
    if (inputSchema.type === "object") {
      assert.equal(inputSchema.additionalProperties, false, name);
    }
    const outputSchema = MCP_TOOL_OUTPUT_SCHEMAS[name];
    assert.equal(outputSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  }

  const unknown = {
    source: { kind: "inline", text: "" },
    unexpected: true,
  };
  const validator = fromJsonSchema(MCP_TOOL_INPUT_SCHEMAS.perttool_check);
  const checked = await validator["~standard"].validate(unknown);
  assert.ok(checked.issues?.length > 0);
});

test("inline tools preserve exact source identity and Application result identities", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  const digest = digestBytes(Buffer.from(text, "utf8"));
  const adapter = createPerttoolMcpAdapter();
  const calls = [
    ["perttool_check", input("inline", text), checkDocument(text).schemaVersion],
    ["perttool_analyze", input("inline", text), analyzeDocument(text).schemaVersion],
    [
      "perttool_next",
      input("inline", text),
      selectNextTasks(text, { sourceDigest: digest }).schemaVersion,
    ],
  ];
  for (const [name, args, applicationIdentity] of calls) {
    const result = await adapter.executeTool(name, args);
    assert.equal(result.isError, false, name);
    assert.equal(result.structuredContent.result_schema_version, applicationIdentity);
    assert.deepEqual(result.structuredContent.source, {
      kind: "inline",
      document_id: null,
      source_digest: digest,
    });
    assert.equal("document" in result.structuredContent.result, false);
    assertContentIdentity(result);
    await validate(MCP_TOOL_OUTPUT_SCHEMAS[name], result.structuredContent);
  }
});

test("domain-invalid documents retain bounded diagnostics as tool errors", async () => {
  const adapter = createPerttoolMcpAdapter();
  for (const name of ["perttool_check", "perttool_analyze", "perttool_next"]) {
    const result = await adapter.executeTool(name, input("inline", "not a PERT document\n"));
    assert.equal(result.isError, true, name);
    assert.notEqual(result.structuredContent.schema_version, "Perttool.McpSourceError.v1");
    assert.equal(result.structuredContent.result.ok, false);
    assert.ok(result.structuredContent.result.diagnostics.length > 0);
    assertContentIdentity(result);
    await validate(MCP_TOOL_OUTPUT_SCHEMAS[name], result.structuredContent);
  }
});

test("registered sources bind exact hidden paths and never invoke Git or persistence", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  const bytes = Buffer.from(text, "utf8");
  const digest = digestBytes(bytes);
  const reads = [];
  const forbidden = () => {
    throw new Error("forbidden host port invoked");
  };
  const host = {
    modelVersion: 1,
    digest: {
      sha256Bytes: digestBytes,
      sha256Utf8: (value) => digestBytes(Buffer.from(value, "utf8")),
    },
    documentBytes: {
      read: async (sourcePath) => {
        reads.push(sourcePath);
        return bytes;
      },
    },
    bundledArtifacts: { read: forbidden },
    gitEvidence: {
      probeHistory: forbidden,
      captureAdvanceBaseline: forbidden,
      recheckAdvanceBaseline: forbidden,
    },
    safePersistence: {
      replaceValidatedDocument: forbidden,
      createValidatedDocument: forbidden,
      createValidatedDocumentFromSource: forbidden,
      createArtifact: forbidden,
    },
    processContext: {
      cwd: forbidden,
      pid: forbidden,
      platform: forbidden,
      umask: forbidden,
    },
  };
  const hiddenPath = path.join(root, "docs/examples/minimal.pert");
  const adapter = createPerttoolMcpAdapter({
    host,
    registrations: [{ documentId: "main-plan", path: hiddenPath }],
  });
  const result = await adapter.executeTool("perttool_check", {
    source: {
      kind: "registered",
      documentId: "main-plan",
      expectedDigest: digest,
    },
  });
  assert.equal(result.isError, false);
  assert.deepEqual(reads, [hiddenPath]);
  assert.equal(result.content[0].text.includes(hiddenPath), false);
  assert.deepEqual(result.structuredContent.source, {
    kind: "registered",
    document_id: "main-plan",
    source_digest: digest,
  });

  const unknown = await adapter.executeTool("perttool_check", {
    source: {
      kind: "registered",
      documentId: "unknown",
      expectedDigest: digest,
    },
  });
  assert.equal(unknown.structuredContent.diagnostic.code, "PTMCP-101");
  assert.equal(unknown.content[0].text.includes(hiddenPath), false);

  const mismatch = await adapter.executeTool("perttool_check", {
    source: {
      kind: "registered",
      documentId: "main-plan",
      expectedDigest: `sha256:${"0".repeat(64)}`,
    },
  });
  assert.equal(mismatch.structuredContent.diagnostic.code, "PTMCP-103");
  assert.equal(mismatch.content[0].text.includes(hiddenPath), false);
});

test("startup, argument, request, source, and cancellation limits fail closed", async () => {
  assert.throws(
    () => createRegistrationCatalog([
      { documentId: "relative", path: "relative.pert" },
    ]),
    /must be absolute/u,
  );
  assert.throws(
    () => createRegistrationCatalog([
      { documentId: "same", path: "/tmp/one.pert" },
      { documentId: "same", path: "/tmp/two.pert" },
    ]),
    /duplicate MCP document ID/u,
  );
  assert.throws(
    () => createRegistrationCatalog(Array.from(
      { length: MCP_LIMITS.registrations + 1 },
      (_, index) => ({ documentId: `document-${index}`, path: `/tmp/${index}.pert` }),
    )),
    /registration count exceeds/u,
  );

  const adapter = createPerttoolMcpAdapter();
  await assert.rejects(
    () => adapter.executeTool("perttool_analyze", {
      source: { kind: "inline", text: "" },
      capacities: [
        { resourceId: "DEV", capacity: 1 },
        { resourceId: "DEV", capacity: 2 },
      ],
    }),
    (error) => error instanceof ProtocolError &&
      error.code === ProtocolErrorCode.InvalidParams,
  );
  const oversizedRequest = await adapter.executeTool("perttool_check", {
    source: { kind: "inline", text: "x".repeat(MCP_LIMITS.requestBytes) },
  });
  assert.equal(oversizedRequest.structuredContent.diagnostic.code, "PTMCP-104");

  const baseHost = createNodeHost();
  const oversizedSource = createPerttoolMcpAdapter({
    host: {
      ...baseHost,
      documentBytes: {
        read: async () => new Uint8Array(MCP_LIMITS.sourceBytes + 1),
      },
    },
    registrations: [{ documentId: "large", path: "/tmp/large.pert" }],
  });
  const oversizedSourceResult = await oversizedSource.executeTool("perttool_check", {
    source: {
      kind: "registered",
      documentId: "large",
      expectedDigest: digestBytes(new Uint8Array(MCP_LIMITS.sourceBytes + 1)),
    },
  });
  assert.equal(oversizedSourceResult.structuredContent.diagnostic.code, "PTMCP-104");

  const cancelled = new AbortController();
  cancelled.abort();
  const cancelledResult = await adapter.executeTool(
    "perttool_help",
    { kind: "command" },
    cancelled.signal,
  );
  assert.equal(cancelledResult.structuredContent.diagnostic.code, "PTMCP-107");

  const ticks = [0, MCP_LIMITS.deadlineMilliseconds];
  const expired = createPerttoolMcpAdapter({ now: () => ticks.shift() ?? ticks.at(-1) });
  const expiredResult = await expired.executeTool("perttool_help", { kind: "command" });
  assert.equal(expiredResult.structuredContent.diagnostic.code, "PTMCP-107");

  const outputBounded = createPerttoolMcpAdapter({ outputByteLimit: 1 });
  const outputBoundedResult = await outputBounded.executeTool(
    "perttool_help",
    { kind: "command" },
  );
  assert.equal(outputBoundedResult.isError, true);
  assert.equal(outputBoundedResult.structuredContent.diagnostic.code, "PTMCP-105");

  const text = await repositoryText("docs/examples/minimal.pert");
  const bytes = Buffer.from(text, "utf8");
  let releaseReads;
  const readGate = new Promise((resolve) => {
    releaseReads = resolve;
  });
  const concurrent = createPerttoolMcpAdapter({
    host: {
      ...baseHost,
      documentBytes: { read: async () => readGate.then(() => bytes) },
    },
    registrations: [{ documentId: "gated", path: "/tmp/gated.pert" }],
  });
  const registeredInput = {
    source: {
      kind: "registered",
      documentId: "gated",
      expectedDigest: digestBytes(bytes),
    },
  };
  const admitted = Array.from(
    { length: MCP_LIMITS.concurrentTools },
    () => concurrent.executeTool("perttool_check", registeredInput),
  );
  const rejected = await concurrent.executeTool("perttool_check", registeredInput);
  assert.equal(rejected.structuredContent.diagnostic.code, "PTMCP-107");
  releaseReads();
  assert.equal((await Promise.all(admitted)).every((result) => !result.isError), true);
});

test("offline help and schema tools retain shared registry results", async () => {
  const adapter = createPerttoolMcpAdapter();
  const calls = [
    ["perttool_help", { kind: "command" }, "Perttool.CommandHelpResult.v1"],
    ["perttool_help", { kind: "guide" }, "Perttool.GuideResult.v1"],
    ["perttool_schema", {}, "Perttool.SchemaResult.v1"],
  ];
  for (const [name, args, identity] of calls) {
    const result = await adapter.executeTool(name, args);
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.source, null);
    assert.equal(result.structuredContent.result_schema_version, identity);
    await validate(MCP_TOOL_OUTPUT_SCHEMAS[name], result.structuredContent);
  }
  const notFound = await adapter.executeTool("perttool_schema", {
    schema_id: "Perttool.Unknown.v1",
  });
  assert.equal(notFound.isError, true);
  assert.equal(notFound.structuredContent.result.diagnostics[0].code, "PTSCH-001");
});

test("modern stdio discovery, listing, resource reads, and tool calls stay protocol-only", async () => {
  const child = spawn(process.execPath, [path.join(root, "adapters/mcp/dist/main.js")], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    while (true) {
      const newline = stdout.indexOf("\n");
      if (newline < 0) break;
      const line = stdout.slice(0, newline);
      stdout = stdout.slice(newline + 1);
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve !== undefined) {
        pending.delete(message.id);
        resolve(message);
      }
    }
  });
  const envelope = {
    "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_REVISION,
    "io.modelcontextprotocol/clientInfo": { name: "perttool-test", version: "1.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
  const request = (id, method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timed out waiting for ${method}`));
    }, 5_000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: { ...params, _meta: envelope },
    })}\n`);
  });

  try {
    const legacy = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("legacy rejection timed out")), 5_000);
      pending.set(1, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin.write(`${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "legacy", version: "1.0.0" },
        },
      })}\n`);
    });
    assert.equal((await legacy).error.code, -32022);

    const discovered = await request(2, "server/discover");
    assert.deepEqual(discovered.result.supportedVersions, [MCP_PROTOCOL_REVISION]);
    assert.deepEqual(discovered.result.capabilities, {
      resources: { subscribe: false, listChanged: false },
      tools: { listChanged: false },
    });

    const listedTools = await request(3, "tools/list");
    assert.deepEqual(
      listedTools.result.tools.map(({ name }) => name),
      (await fixture()).tools,
    );
    assert.equal(listedTools.result.tools.every(
      ({ annotations }) => annotations.readOnlyHint === true &&
        annotations.destructiveHint === false &&
        annotations.idempotentHint === true &&
        annotations.openWorldHint === false,
    ), true);

    const listedResources = await request(4, "resources/list");
    assert.deepEqual(
      listedResources.result.resources.map(({ uri }) => uri),
      (await fixture()).resources,
    );
    const resource = await request(5, "resources/read", {
      uri: "perttool://capabilities",
    });
    assert.equal(
      JSON.parse(resource.result.contents[0].text).schema_version,
      "Perttool.McpCapabilities.v1",
    );

    const source = await repositoryText("docs/examples/minimal.pert");
    const called = await request(6, "tools/call", {
      name: "perttool_next",
      arguments: { source: { kind: "inline", text: source } },
    });
    assert.equal(called.result.isError, false);
    assert.equal(
      called.result.structuredContent.schema_version,
      "Perttool.McpNextResult.v1",
    );
    assert.deepEqual(
      JSON.parse(called.result.content[0].text),
      called.result.structuredContent,
    );
  } finally {
    child.stdin.end();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  assert.equal(stdout, "");
  assert.match(stderr, /Rejected 2025-era request/u);
});

test("implementation cases remain complete and dependency ordered", async () => {
  const cases = await fixture();
  const accepted = new Set();
  for (const implementationCase of cases.cases) {
    assert.equal(
      implementationCase.depends_on.every((id) => accepted.has(id)),
      true,
      implementationCase.id,
    );
    accepted.add(implementationCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from(
      { length: 12 },
      (_, index) => `MCA-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("implementation acceptance and completed lifecycle remain aligned", async () => {
  const [acceptance, plan] = await Promise.all([
    repositoryText("docs/process/adapter-mcp-read-adapter-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Task: `MCP_READ_ADAPTER`/u);
  assert.match(
    acceptance,
    /WE-c1c6559db94c1b46f5bebbf5e13456ff8384fd54823114309cb4d30fedf1c3d4/u,
  );
  assert.match(plan, /task MCP_READ_ADAPTER [\s\S]*?status done/u);
  assert.match(
    plan,
    /work_event WE-c1c6559db94c1b46f5bebbf5e13456ff8384fd54823114309cb4d30fedf1c3d4:/u,
  );
});

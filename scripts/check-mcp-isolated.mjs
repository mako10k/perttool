import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [serverEntry, rootEntry, documentPath] = process.argv.slice(2);
if (serverEntry === undefined || rootEntry === undefined || documentPath === undefined) {
  throw new Error("usage: check-mcp-isolated.mjs SERVER ROOT DOCUMENT");
}

const protocolRevision = "2026-07-28";
const resourceUris = [
  "perttool://capabilities",
  "perttool://help/commands",
  "perttool://guide/index",
  "perttool://schemas",
];
const toolNames = [
  "perttool_check",
  "perttool_analyze",
  "perttool_next",
  "perttool_help",
  "perttool_schema",
];
const source = await readFile(documentPath, "utf8");
const sourceDigest = `sha256:${createHash("sha256").update(
  await readFile(documentPath),
).digest("hex")}`;
const rootApi = await import(pathToFileURL(rootEntry).href);

function startServer(clientName) {
  const child = spawn(
    process.execPath,
    [serverEntry, "--document", `accepted=${path.resolve(documentPath)}`],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let buffered = "";
  let stderr = "";
  const pending = new Map();
  const waiters = [];

  const deliver = (message) => {
    const byId = pending.get(message.id);
    if (byId !== undefined) {
      pending.delete(message.id);
      byId.resolve(message);
      return;
    }
    const index = waiters.findIndex(({ predicate }) => predicate(message));
    if (index >= 0) {
      const [{ resolve }] = waiters.splice(index, 1);
      resolve(message);
    }
  };
  child.stdout.on("data", (chunk) => {
    buffered += chunk;
    while (true) {
      const newline = buffered.indexOf("\n");
      if (newline < 0) break;
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      deliver(JSON.parse(line));
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const envelope = {
    "io.modelcontextprotocol/protocolVersion": protocolRevision,
    "io.modelcontextprotocol/clientInfo": { name: clientName, version: "1.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
  const request = (id, method, params = {}, modern = true) => new Promise(
    (resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timed out waiting for ${method}`));
      }, 5_000);
      pending.set(id, {
        resolve(message) {
          clearTimeout(timer);
          resolve(message);
        },
      });
      child.stdin.write(`${JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params: modern ? { ...params, _meta: envelope } : params,
      })}\n`);
    },
  );
  const waitFor = (predicate) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for message")), 5_000);
    waiters.push({
      predicate,
      resolve(message) {
        clearTimeout(timer);
        resolve(message);
      },
    });
  });
  const close = async () => {
    child.stdin.end();
    const code = await new Promise((resolve) => child.once("exit", resolve));
    assert.equal(code, 0, stderr);
    assert.equal(buffered, "");
    return stderr;
  };
  return { child, request, waitFor, close };
}

async function acceptedSession(clientName) {
  const session = startServer(clientName);
  const legacy = await session.request(1, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "unsupported-client", version: "1.0.0" },
  }, false);
  assert.equal(legacy.error.code, -32022);

  const discovered = await session.request(2, "server/discover");
  assert.deepEqual(discovered.result.supportedVersions, [protocolRevision]);
  assert.deepEqual(discovered.result.capabilities, {
    resources: { subscribe: false, listChanged: false },
    tools: { listChanged: false },
  });

  const resources = await session.request(3, "resources/list");
  assert.deepEqual(resources.result.resources.map(({ uri }) => uri), resourceUris);
  const tools = await session.request(4, "tools/list");
  assert.deepEqual(tools.result.tools.map(({ name }) => name), toolNames);
  assert.equal(tools.result.tools.every(({ annotations }) =>
    annotations.readOnlyHint === true &&
    annotations.destructiveHint === false &&
    annotations.idempotentHint === true &&
    annotations.openWorldHint === false), true);

  const capabilities = await session.request(5, "resources/read", {
    uri: "perttool://capabilities",
  });
  const capabilityValue = JSON.parse(capabilities.result.contents[0].text);
  assert.equal(capabilityValue.schema_version, "Perttool.McpCapabilities.v1");
  assert.ok(capabilityValue.unavailable.includes("mutations"));
  assert.ok(capabilityValue.unavailable.includes("git_refs"));
  assert.ok(capabilityValue.unavailable.includes("network_transport"));

  const checked = await session.request(6, "tools/call", {
    name: "perttool_check",
    arguments: {
      source: {
        kind: "registered",
        documentId: "accepted",
        expectedDigest: sourceDigest,
      },
    },
  });
  assert.equal(checked.result.isError, false);
  assert.equal(
    checked.result.structuredContent.schema_version,
    "Perttool.McpCheckResult.v1",
  );
  assert.deepEqual(
    JSON.parse(checked.result.content[0].text),
    checked.result.structuredContent,
  );
  const direct = rootApi.checkDocument(source);
  assert.equal(
    checked.result.structuredContent.result_schema_version,
    "Perttool.CheckResult.v6",
  );
  assert.equal(checked.result.structuredContent.result.document_id, direct.documentId);
  assert.equal(checked.result.structuredContent.result.grammar_version, direct.grammarVersion);
  assert.deepEqual(checked.result.structuredContent.result.summary, {
    resources: direct.summary.resources,
    milestones: direct.summary.milestones,
    tasks: direct.summary.tasks,
    gates: direct.summary.gates,
    errors: direct.summary.errors,
    warnings: direct.summary.warnings,
  });
  assert.equal(checked.result.structuredContent.result.acceptance, null);

  const mismatch = await session.request(7, "tools/call", {
    name: "perttool_check",
    arguments: {
      source: {
        kind: "registered",
        documentId: "accepted",
        expectedDigest: `sha256:${"0".repeat(64)}`,
      },
    },
  });
  assert.equal(mismatch.result.structuredContent.diagnostic.code, "PTMCP-103");
  assert.equal(JSON.stringify(mismatch).includes(path.resolve(documentPath)), false);

  const invalid = await session.request(8, "tools/call", {
    name: "perttool_check",
    arguments: { source: { kind: "inline", text: "not a PERT document\n" } },
  });
  assert.equal(invalid.result.isError, true);
  assert.notEqual(
    invalid.result.structuredContent.schema_version,
    "Perttool.McpSourceError.v1",
  );
  assert.ok(invalid.result.structuredContent.result.diagnostics.length > 0);

  const unknown = await session.request(9, "perttool/unsupported");
  assert.equal(unknown.error.code, -32601);
  const stderr = await session.close();
  assert.match(stderr, /Rejected 2025-era request/u);
  return checked.result.structuredContent;
}

const first = await acceptedSession("isolated-client-a");
const second = await acceptedSession("isolated-client-b");
assert.deepEqual(second, first);
assert.equal(/authority|accepted_by_owner|governance_decision/u.test(JSON.stringify(first)), false);

const malformed = spawn(
  process.execPath,
  [serverEntry],
  { stdio: ["pipe", "pipe", "pipe"] },
);
let malformedStdout = "";
let malformedStderr = "";
malformed.stdout.setEncoding("utf8");
malformed.stderr.setEncoding("utf8");
malformed.stdout.on("data", (chunk) => {
  malformedStdout += chunk;
});
malformed.stderr.on("data", (chunk) => {
  malformedStderr += chunk;
});
malformed.stdin.end(`{\n${JSON.stringify({
  jsonrpc: "2.0",
  id: 99,
  method: "server/discover",
  params: {
    _meta: {
      "io.modelcontextprotocol/protocolVersion": protocolRevision,
      "io.modelcontextprotocol/clientInfo": {
        name: "must-not-recover",
        version: "1.0.0",
      },
      "io.modelcontextprotocol/clientCapabilities": {},
    },
  },
})}\n`);
const malformedCode = await new Promise((resolve) => malformed.once("exit", resolve));
assert.equal(malformedCode, 0, malformedStderr);
assert.equal(malformedStdout, "");
assert.match(malformedStderr, /^perttool-mcp: .+\n$/u);

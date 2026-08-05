import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("MCP acceptance cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/mcp-acceptance-cases-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.McpAcceptanceCases.v1");
  assert.equal(fixture.protocol_model_version, 1);
  assert.equal(fixture.protocol_revision, "2026-07-28");
  assert.equal(fixture.resources, 4);
  assert.equal(fixture.tools, 5);
  const accepted = new Set();
  for (const acceptanceCase of fixture.cases) {
    assert.equal(
      acceptanceCase.depends_on.every((id) => accepted.has(id)),
      true,
      acceptanceCase.id,
    );
    accepted.add(acceptanceCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from(
      { length: 12 },
      (_, index) => `MCPA-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("complete check runs the isolated private MCP package gate", async () => {
  const [manifestText, gate] = await Promise.all([
    repositoryText("package.json"),
    repositoryText("scripts/check-mcp-package.sh"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.scripts["check:mcp-package"], "bash scripts/check-mcp-package.sh");
  assert.match(manifest.scripts.check, /npm run check:mcp-package/u);
  assert.match(gate, /npm pack --silent \\\s+--workspace perttool-mcp-private/u);
  assert.match(gate, /--ignore-scripts/u);
  assert.match(gate, /check-mcp-isolated\.mjs/u);
  assert.match(gate, /cmp -s "\$before" "\$after"/u);
});

test("malformed stdio input cannot recover from a later valid request", async () => {
  const child = spawn(
    process.execPath,
    [path.join(root, "adapters/mcp/dist/main.js")],
    { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end(`{\n${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "late", version: "1" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  })}\n`);
  const code = await new Promise((resolve) => child.once("exit", resolve));
  assert.equal(code, 0, stderr);
  assert.equal(stdout, "");
  assert.match(stderr, /^perttool-mcp: .+\n$/u);
});

test("MCP source and package closures contain no side-effect adapter", async () => {
  const entries = await readdir(path.join(root, "adapters/mcp/src"));
  const sources = await Promise.all(
    entries.filter((entry) => entry.endsWith(".ts")).sort().map(
      (entry) => repositoryText(`adapters/mcp/src/${entry}`),
    ),
  );
  const closure = sources.join("\n");
  assert.equal(
    /node:(?:child_process|http|https|net|tls|dgram)|\bfetch\s*\(|adapters\/(?:lsp|vscode)|src\/cli/u.test(closure),
    false,
  );
  assert.equal(/\.gitEvidence\.|\.safePersistence\./u.test(closure), false);
  const rootManifest = JSON.parse(await repositoryText("package.json"));
  assert.equal(rootManifest.files.includes("adapters"), false);
  assert.equal(Object.keys(rootManifest.exports).some((key) => key.includes("mcp")), false);
});

test("MCP acceptance and completed lifecycle remain aligned", async () => {
  const [acceptance, plan] = await Promise.all([
    repositoryText("docs/process/adapter-mcp-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Task: `MCP_ACCEPTANCE`/u);
  assert.match(
    acceptance,
    /WE-30dbf9efeaa090fef2416cce23885d40c14e3dccfd1bd2a4b324019648c1f6b1/u,
  );
  assert.match(plan, /task MCP_ACCEPTANCE [\s\S]*?status done/u);
  assert.match(
    plan,
    /work_event WE-30dbf9efeaa090fef2416cce23885d40c14e3dccfd1bd2a4b324019648c1f6b1:/u,
  );
});

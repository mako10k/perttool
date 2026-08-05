import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getJsonSchemaCatalog,
} from "../dist/index.js";
import * as packageRoot from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function tableIds(document, prefix) {
  return [
    ...document.matchAll(
      new RegExp("^\\| `(" + prefix + "-\\d{3})` \\|", "gm"),
    ),
  ].map((match) => match[1]);
}

async function typescriptFiles(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries.sort()) {
    const absolute = path.join(directory, entry);
    if ((await stat(absolute)).isDirectory()) {
      files.push(...await typescriptFiles(absolute));
    } else if (entry.endsWith(".ts")) {
      files.push(absolute);
    }
  }
  return files;
}

test("ADAPTER-001 architecture contract aligns requirements, design, and plan", async () => {
  const [
    requirements,
    specification,
    design,
    backlog,
    acceptance,
    plan,
    planIndex,
    aiGuide,
  ] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/specs/adapter-platform.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/backlog.md"),
      repositoryText("docs/process/adapter-architecture-contract-acceptance.md"),
      repositoryText("plans/adapter-platform.pert"),
      repositoryText("plans/README.md"),
      repositoryText("docs/process/ai-development.md"),
    ]);

  assert.match(specification, /- Status: Normative 1\.0/);
  assert.match(specification, /Adapter architecture model version: 1/);
  assert.match(
    specification,
    /snapshot had twelve lower-layer files containing\s+nineteen imports/,
  );
  assert.match(specification, /`\.\/core` and `\.\/node`/);
  assert.match(specification, /The selected first adapter delivery is read-only/);
  assert.deepEqual(tableIds(specification, "ADP"), expectedIds("ADP", 12));

  assert.match(
    requirements,
    /\[Shared Adapter Architecture Contract\]\(specs\/adapter-platform\.md\)/,
  );
  assert.match(requirements, /read-only DAG Webview/);
  assert.match(requirements, /Rename, formatting edits/);
  assert.match(design, /^### 3\.2 Distribution boundary$/m);
  assert.match(design, /^## 12\. Post-MVP adapter boundaries$/m);
  assert.match(backlog, /^### ADAPTER-001:/m);
  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.deepEqual(tableIds(acceptance, "AACR"), expectedIds("AACR", 12));
  assert.match(planIndex, /`CORE_DEPENDENCY_CLEANUP`/);
  assert.match(aiGuide, /selected `ADAPTER-001` plan composes/);

  const checked = checkDocument(plan);
  assert.equal(checked.ok, true);
  assert.equal(
    checked.document.declarations.find(({ kind }) => kind === "project")?.id,
    "ADAPTER_PLATFORM",
  );
  assert.equal(
    checked.document.declarations.some(
      ({ kind, id }) => kind === "task" && id === "ADAPTER_ARCHITECTURE_CONTRACT",
    ),
    true,
  );
});

test("captured package and reverse-import baselines remain closed", async () => {
  const [packageText, fixtureText, files] = await Promise.all([
    repositoryText("package.json"),
    repositoryText("test/fixtures/adapter-platform-contract-v1.json"),
    typescriptFiles(path.join(root, "src")),
  ]);
  const packageJson = JSON.parse(packageText);
  const fixture = JSON.parse(fixtureText);
  const baseline = fixture.baseline;

  assert.equal(
    fixture.schema_version,
    "Perttool.AdapterArchitectureContractCases.v1",
  );
  assert.equal(fixture.architecture_model_version, 1);
  assert.equal(packageJson.name, baseline.root_package);
  assert.equal(packageJson.type, baseline.module_format);
  assert.equal(packageJson.engines.node, ">=22");
  assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
  assert.equal(Object.keys(packageRoot).length, baseline.package_root_export_count);
  assert.equal(COMMAND_REGISTRY.length, baseline.command_count);
  assert.equal(getJsonSchemaCatalog().length, baseline.root_schema_count);
  assert.equal(baseline.typescript_source_file_count, 144);
  const expectedImports = fixture.legacy_reverse_dependencies.map(
    ({ source, target }) => ({ source, target }),
  );
  assert.equal(
    new Set(expectedImports.map(({ source }) => source)).size,
    baseline.legacy_reverse_dependency_file_count,
  );
  assert.equal(
    expectedImports.length,
    baseline.legacy_reverse_dependency_import_count,
  );
  assert.equal(files.length >= baseline.typescript_source_file_count, true);
});

test("all twelve architecture cases and distribution branches are closed", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/adapter-platform-contract-v1.json"),
  );
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    expectedIds("ADP", 12),
  );

  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      `${contractCase.id}: dependencies must precede the case`,
    );
    assert.equal(typeof contractCase.boundary, "string");
    assert.equal(Object.keys(contractCase.expected).length > 0, true);
    accepted.add(contractCase.id);
  }

  assert.deepEqual(
    fixture.distribution_units.map(({ id }) => id),
    ["perttool", "language_server", "vscode_extension", "mcp_server"],
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "ADP-008").expected.arbitrary_mermaid,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "ADP-009").expected.editor_dependency,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "ADP-012").expected.publication,
    false,
  );
});

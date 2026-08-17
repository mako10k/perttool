import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  getJsonSchemaCatalog,
} from "../dist/index.js";
import * as packageRoot from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
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

function sourcePath(absolute) {
  return path.relative(root, absolute).split(path.sep).join("/");
}

function resolvedTypescriptTarget(absolute, specifier) {
  if (!specifier.startsWith(".")) return null;
  return path.normalize(path.join(path.dirname(absolute), specifier))
    .replace(/\.js$/, ".ts");
}

async function externalApplicationConsumers(files, applicationPrefix) {
  const records = [];
  for (const absolute of files) {
    const source = sourcePath(absolute);
    if (source.startsWith(applicationPrefix)) continue;
    const text = await readFile(absolute, "utf8");
    for (const match of text.matchAll(
      /(?:\bfrom\s+|\bimport\s*\(\s*)["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      assert.ok(specifier);
      const target = resolvedTypescriptTarget(absolute, specifier);
      if (target === null) continue;
      const targetSource = sourcePath(target);
      if (targetSource.startsWith(applicationPrefix)) {
        records.push({ source, target: targetSource });
      }
    }
  }
  return records;
}

test("Core dependency boundary permits only exact composition consumers", async () => {
  const [fixtureText, legacyText, files] = await Promise.all([
    repositoryText("test/fixtures/adapter-core-dependency-cases-v1.json"),
    repositoryText("test/fixtures/adapter-platform-contract-v1.json"),
    typescriptFiles(path.join(root, "src")),
  ]);
  const fixture = JSON.parse(fixtureText);
  const legacy = JSON.parse(legacyText);

  assert.equal(fixture.schema_version, "Perttool.AdapterCoreDependencyCases.v1");
  assert.equal(fixture.boundary_model_version, 1);
  assert.equal(
    legacy.legacy_reverse_dependencies.length,
    fixture.legacy_input.import_count,
  );
  assert.equal(
    new Set(legacy.legacy_reverse_dependencies.map(({ source }) => source)).size,
    fixture.legacy_input.file_count,
  );

  const imports = await externalApplicationConsumers(
    files,
    fixture.target.application_prefix,
  );
  const currentAllowedConsumers = fixture.target.allowed_external_consumers;
  assert.deepEqual(
    [...new Set(imports.map(({ source }) => source))].sort(),
    currentAllowedConsumers,
  );
  assert.equal(
    imports.filter(
      ({ source }) => !currentAllowedConsumers.includes(source),
    ).length,
    fixture.target.reverse_dependency_count,
  );
  const nodeHost = JSON.parse(
    await repositoryText("test/fixtures/node-host-boundary-cases-v1.json"),
  );
  assert.equal(
    nodeHost.baseline.root_runtime_exports,
    fixture.target.package_root_export_count,
  );
  assert.equal(files.length, nodeHost.target.typescript_source_files + 19);
});

test("relocated services retain exact compatibility facades", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/adapter-core-dependency-cases-v1.json"),
  );
  for (const relocation of fixture.relocations) {
    assert.equal(
      await repositoryText(relocation.facade),
      relocation.facade_source,
      relocation.facade,
    );
    assert.equal((await stat(path.join(root, relocation.owner))).isFile(), true);
    const facadeModule = await import(
      `../dist/${relocation.facade.slice("src/".length).replace(/\.ts$/, ".js")}`
    );
    const ownerModule = await import(
      `../dist/${relocation.owner.slice("src/".length).replace(/\.ts$/, ".js")}`
    );
    assert.deepEqual(Object.keys(facadeModule), Object.keys(ownerModule));
    for (const name of Object.keys(facadeModule)) {
      assert.equal(facadeModule[name], ownerModule[name], `${relocation.facade}:${name}`);
    }
  }
});

test("public package closure and dependency cases remain stable", async () => {
  const [fixtureText, nodeHostText, packageText] = await Promise.all([
    repositoryText("test/fixtures/adapter-core-dependency-cases-v1.json"),
    repositoryText("test/fixtures/node-host-boundary-cases-v1.json"),
    repositoryText("package.json"),
  ]);
  const fixture = JSON.parse(fixtureText);
  const nodeHost = JSON.parse(nodeHostText);
  const packageJson = JSON.parse(packageText);
  assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
  assert.equal(
    Object.keys(packageRoot).length,
    nodeHost.target.root_runtime_exports,
  );
  assert.equal(
    nodeHost.baseline.root_runtime_exports,
    fixture.target.package_root_export_count,
  );
  assert.equal(COMMAND_REGISTRY.length, fixture.target.command_count + 9);
  assert.equal(getJsonSchemaCatalog().length, fixture.target.root_schema_count + 3);

  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      contractCase.id,
    );
    accepted.add(contractCase.id);
  }
  assert.deepEqual([...accepted], [
    "CDC-001",
    "CDC-002",
    "CDC-003",
    "CDC-004",
    "CDC-005",
    "CDC-006",
    "CDC-007",
    "CDC-008",
  ]);
});

test("cleanup acceptance, current guidance, and completed plan are aligned", async () => {
  const [specification, design, backlog, acceptance, plan] = await Promise.all([
    repositoryText("docs/specs/adapter-platform.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/process/adapter-core-dependency-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(specification, /^### 3\.2 Accepted cleanup state$/m);
  assert.match(design, /every reusable source module has zero imports/);
  assert.match(backlog, /adapter-core-dependency-acceptance\.md/);
  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.deepEqual(
    [...acceptance.matchAll(/^\| `(CDC-\d{3})` \|/gm)].map((match) => match[1]),
    ["CDC-001", "CDC-002", "CDC-003", "CDC-004", "CDC-005", "CDC-006", "CDC-007", "CDC-008"],
  );
  assert.match(
    acceptance,
    /sha256:69f14c31ab56cb8df4f7d03ef05baf90b1a25e20868488b6da9163d4624d33f4/,
  );
  const checked = packageRoot.checkDocument(plan);
  const task = checked.document.declarations.find(
    ({ kind, id }) => kind === "task" && id === "CORE_DEPENDENCY_CLEANUP",
  );
  assert.equal(task?.fields.find(({ name }) => name === "status")?.value, "done");
});

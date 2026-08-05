import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as packageRoot from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function fixture() {
  return JSON.parse(
    await repositoryText("test/fixtures/adapter-shared-library-cases-v1.json"),
  );
}

function resolvedRuntimeTarget(source, specifier) {
  if (!specifier.startsWith(".")) return null;
  return path.normalize(path.join(path.dirname(source), specifier));
}

async function runtimeClosure(entry) {
  const pending = [entry];
  const modules = new Set();
  const externalSpecifiers = [];
  while (pending.length > 0) {
    const source = pending.pop();
    if (modules.has(source)) continue;
    modules.add(source);
    const text = await repositoryText(source);
    for (const match of text.matchAll(
      /(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*)["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      assert.ok(specifier);
      const target = resolvedRuntimeTarget(source, specifier);
      if (target === null) {
        externalSpecifiers.push({ source, specifier });
      } else {
        pending.push(target);
      }
    }
  }
  return {
    modules: [...modules].sort(),
    externalSpecifiers,
  };
}

test("package manifest exposes exact additive Core and Node subpaths", async () => {
  const [cases, packageText] = await Promise.all([
    fixture(),
    repositoryText("package.json"),
  ]);
  const packageJson = JSON.parse(packageText);
  assert.deepEqual(packageJson.exports["./core"], cases.package_exports.core);
  assert.deepEqual(packageJson.exports["./node"], cases.package_exports.node);
  assert.deepEqual(packageJson.exports["."], {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  });
  assert.equal(Object.keys(packageJson.dependencies ?? {}).length, 0);
});

test("Core runtime catalog and static closure are closed and portable", async () => {
  const cases = await fixture();
  assert.equal(cases.schema_version, "Perttool.AdapterSharedLibraryCases.v1");
  assert.equal(cases.boundary_model_version, 1);
  assert.deepEqual(Object.keys(core), cases.runtime.core_exports);
  assert.equal(Object.keys(core).length, cases.runtime.core_export_count);

  const closure = await runtimeClosure("dist/core/index.js");
  assert.equal(closure.modules.length, cases.runtime.core_runtime_module_count);
  assert.deepEqual(closure.externalSpecifiers, cases.runtime.core_external_specifiers);
  for (const source of closure.modules) {
    assert.equal(
      cases.runtime.core_forbidden_prefixes.some((prefix) => source.startsWith(prefix)),
      false,
      source,
    );
  }
});

test("Core source and reusable functions retain package-root identity", async () => {
  const cases = await fixture();
  for (const name of [
    ...cases.runtime.source_identity_exports,
    ...cases.runtime.facade_identity_exports,
  ]) {
    assert.equal(core[name], packageRoot[name], name);
  }

  const source = await repositoryText("docs/examples/minimal.pert");
  const parsed = core.parseDocument(source);
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(core.validateDocument(parsed.document, parsed.diagnostics).length, 0);
  const formatted = core.formatDocument(source);
  assert.equal(formatted.ok, true);
  assert.equal(formatted.formattedText, source);
  assert.equal(core.getGuide(null, "index").ok, true);
  assert.equal(core.getHelp("syntax", "quick").ok, true);
});

test("Node subpath is the exact 121-name compatibility facade", async () => {
  const cases = await fixture();
  assert.equal(Object.keys(packageRoot).length, cases.runtime.package_root_export_count);
  assert.equal(Object.keys(nodeApi).length, cases.runtime.node_export_count);
  assert.deepEqual(Object.keys(nodeApi), Object.keys(packageRoot));
  for (const name of Object.keys(packageRoot)) {
    assert.equal(nodeApi[name], packageRoot[name], name);
  }
  assert.equal(packageRoot.COMMAND_REGISTRY.length, cases.package.command_count);
  assert.equal(packageRoot.getJsonSchemaCatalog().length, cases.package.root_schema_count);
});

test("shared-library normative cases remain dependency ordered", async () => {
  const cases = await fixture();
  const accepted = new Set();
  for (const contractCase of cases.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      contractCase.id,
    );
    accepted.add(contractCase.id);
  }
  assert.deepEqual([...accepted], [
    "SLB-001",
    "SLB-002",
    "SLB-003",
    "SLB-004",
    "SLB-005",
    "SLB-006",
    "SLB-007",
    "SLB-008",
  ]);
});

test("shared-library acceptance and completed task remain aligned", async () => {
  const [specification, acceptance, backlog, plan] = await Promise.all([
    repositoryText("docs/specs/shared-library.md"),
    repositoryText("docs/process/adapter-shared-library-acceptance.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(specification, /- Document status: Accepted 1\.0/);
  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(
    acceptance,
    /sha256:33a44d94d85ea3134e61033cfea22cc3fad159c7c2fdaf7273ccf48604f1d04c/,
  );
  assert.match(backlog, /adapter-shared-library-acceptance\.md/);
  const checked = packageRoot.checkDocument(plan);
  const task = checked.document.declarations.find(
    ({ kind, id }) => kind === "task" && id === "SHARED_LIBRARY_BOUNDARY",
  );
  assert.equal(task?.fields.find(({ name }) => name === "status")?.value, "done");
});

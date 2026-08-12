import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  planTargetExactDurationGrammarBoundary,
} from "../dist/application/target-grammar-boundary.js";
import {
  planTargetGrammar3Mutation,
} from "../dist/application/target-mutate.js";
import { CONTRACT4_COMMAND_REGISTRY } from "../dist/command/discovery.js";
import {
  formatTargetGrammar3Document,
} from "../dist/formatter/target-source-formatter.js";
import {
  serializeExactDurationSource,
} from "../dist/model/exact-duration-source.js";
import { rational } from "../dist/model/rational.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");
const grammar3Fixture = path.join(
  root,
  "test",
  "fixtures",
  "rational-duration",
  "contract3-rejection-v3.pert",
);

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function contiguousIds(prefix) {
  return Array.from(
    { length: 20 },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("SU-M2R acceptance traces all revised interface and example observations", async () => {
  const [acceptance, baselineText] = await Promise.all([
    repositoryFile("docs/process/scheduling-units-m2r-acceptance.md"),
    repositoryFile("test/fixtures/temporal-units/cases.json"),
  ]);
  const baseline = JSON.parse(baselineText);

  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(acceptance, /There are no open SU-M2R acceptance findings\./);
  assert.match(
    acceptance,
    /this acceptance does not claim that a migration command\s+exists/,
  );
  assert.match(
    acceptance,
    /No Git push, GitHub release, npm publication, or dist-tag change is authorized/,
  );

  const tuiIds = [...acceptance.matchAll(/^\| `(TUI-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  const tueIds = [...acceptance.matchAll(/^\| `(TUE-\d{3})` \|/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(tuiIds, contiguousIds("TUI"));
  assert.deepEqual(tueIds, contiguousIds("TUE"));
  assert.deepEqual(
    baseline.cases.map(({ case_id: caseId }) => caseId),
    contiguousIds("TUE"),
  );

  const tue15 = baseline.cases.find(({ case_id: caseId }) => caseId === "TUE-015");
  assert.ok(tue15);
  assert.equal(tue15.expected.ok, true);
  assert.equal(tue15.expected.target_grammar_version, 3);
  assert.equal(
    tue15.expected.grammar_disposition,
    "upgraded_for_exact_fraction",
  );
  assert.equal(tue15.expected.ptmig_408_emitted, false);

  for (const evidence of [
    "test/rational-duration-source.test.mjs",
    "test/exact-duration-source.test.mjs",
    "test/rational-duration-formatter.test.mjs",
    "test/rational-duration-mutation.test.mjs",
    "test/rational-duration-version-boundary.test.mjs",
    "test/temporal-unit-examples.test.mjs",
    "scripts/check-package.sh",
  ]) {
    assert.ok(acceptance.includes(evidence), evidence);
  }
});

test("Grammar 3 source, formatting, mutation, and version selection compose exactly", async () => {
  const source = await readFile(grammar3Fixture, "utf8");
  const checked = validateTargetGrammar3Document(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.equal(checked.validatedDocument.grammarVersion, 3);

  const formatted = formatTargetGrammar3Document(
    source,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.equal(formatted.changed, true);
  assert.ok(formatted.formattedText.includes("  critical_epsilon 0d\n"));
  assert.ok(formatted.formattedText.includes("  target_duration 2/3d\n"));
  assert.ok(formatted.formattedText.includes("  duration 1/3d\n"));
  const repeated = formatTargetGrammar3Document(
    formatted.formattedText,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(repeated.changed, false);
  assert.equal(repeated.formattedText, formatted.formattedText);

  const changed = planTargetGrammar3Mutation(
    formatted.formattedText,
    {
      kind: "task.set",
      id: "EXACT",
      set: { duration: "6/8d" },
    },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(changed.ok, true);
  assert.ok(changed.updatedText.includes("  duration 0.75d\n"));
  assert.equal(
    validateTargetGrammar3Document(
      changed.updatedText,
      TARGET_GRAMMAR_3_CAPABILITY,
    ).ok,
    true,
  );
  for (const temporalToken of [
    "2026-07-25",
    "2026-07-26",
    "2026-07-27",
  ]) {
    assert.equal(
      changed.updatedText.split(temporalToken).length,
      source.split(temporalToken).length,
      temporalToken,
    );
  }

  const grammar2 = source
    .replace("  version 3", "  version 2")
    .replace("  critical_epsilon 0/7d", "  critical_epsilon 0d")
    .replace("  target_duration 4/6d", "  target_duration 0.5d")
    .replace("  duration 1/3d", "  duration 0.5d");
  const fraction = serializeExactDurationSource(rational(1n, 3n), "day");
  const boundary = planTargetExactDurationGrammarBoundary(
    grammar2,
    [fraction],
    { migrationChanged: true, velocityDisposition: "retained" },
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(boundary.ok, true);
  assert.equal(boundary.sourceGrammarVersion, 2);
  assert.equal(boundary.targetGrammarVersion, 3);
  assert.equal(boundary.grammarDisposition, "upgraded_for_exact_fraction");
  assert.equal(boundary.versionEdits.length, 1);
  assert.equal(
    validateTargetGrammar3Document(
      boundary.versionCandidateText,
      TARGET_GRAMMAR_3_CAPABILITY,
    ).ok,
    true,
  );
});

test("the public package root hides target helpers while Contract 4 exposes accepted schemas", async () => {
  for (const targetName of [
    "TARGET_GRAMMAR_3_CAPABILITY",
    "parseTargetGrammar3Document",
    "validateTargetGrammar3Document",
    "formatTargetGrammar3Document",
    "planTargetGrammar3Mutation",
    "planTargetGrammar3BatchMutation",
    "createTargetGrammar3DocumentFile",
    "replaceTargetGrammar3DocumentFile",
    "serializeExactDurationSource",
    "selectExactDurationGrammarBoundary",
    "planTargetExactDurationGrammarBoundary",
  ]) {
    assert.equal(targetName in publicApi, false, targetName);
  }

  const manifest = JSON.parse(await repositoryFile("package.json"));
  assert.deepEqual(Object.keys(manifest.exports), [
    ".",
    "./core",
    "./node",
    "./schemas/*",
  ]);
  assert.equal(CONTRACT4_COMMAND_REGISTRY.length, 28);
  assert.ok(
    CONTRACT4_COMMAND_REGISTRY.every(
      ({ contractVersion }) => contractVersion === 4,
    ),
  );
  const serializedRegistry = JSON.stringify(CONTRACT4_COMMAND_REGISTRY);
  for (const available of [
    "project migrate-unit",
    "Perttool.UnitMigrationResult.v2",
    "Perttool.AnalysisResult.v3",
    "Perttool.NextResult.v4",
  ]) {
    assert.equal(serializedRegistry.includes(available), true, available);
  }
});

test("active Contract 6 routes retain Grammar 3", () => {
  const cases = [
    [["document", "check"], "Perttool.CheckResult.v5"],
    [["document", "format"], "Perttool.FormatResult.v1"],
    [["project", "show"], "Perttool.ProjectResult.v4"],
    [["dag", "analyze"], "Perttool.AnalysisResult.v6"],
    [["dag", "next"], "Perttool.NextResult.v7"],
  ];

  for (const [route, schemaVersion] of cases) {
    const result = runCli([...route, grammar3Fixture, "--format=json"]);
    assert.equal(result.status, 0, `${route.join(" ")}: ${result.stderr}`);
    assert.equal(result.stderr, "");
    const json = JSON.parse(result.stdout);
    assert.equal(json.schema_version, schemaVersion);
    assert.equal(json.cli_contract_version, 8);
    assert.equal(json.ok, true);
    if (schemaVersion !== "Perttool.FormatResult.v1") {
      assert.equal(json.grammar_version, 3);
    }
  }
});

test("the handoff keeps migration orchestration and public activation gated", async () => {
  const acceptance = await repositoryFile(
    "docs/process/scheduling-units-m2r-acceptance.md",
  );
  assert.match(
    acceptance,
    /SU-M3 must consume the Grammar 3-capable validated source boundary and exact\s+Rational Duration values/,
  );
  assert.match(
    acceptance,
    /SU-M4 must compose the accepted migration inventory and formulas with\s+`serializeExactDurationSource` and the grammar boundary/,
  );
  assert.match(
    acceptance,
    /Only SU-M5 may atomically expose Grammar 2\/3, CLI Contract 4, target result\s+schemas, help, Guide, README workflows, NextResult v4 authority, and installed\s+behavior/,
  );
});

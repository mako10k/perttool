import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const repositoryText = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("source static analysis is pinned, ratcheted, documented, and required by CI", async () => {
  const [
    manifestText,
    requirements,
    jscpdText,
    baselineText,
    workflow,
    development,
    process,
    backlog,
    agents,
    copilot,
  ] = await Promise.all([
    repositoryText("package.json"),
    repositoryText("requirements-static-analysis.txt"),
    repositoryText(".jscpd.json"),
    repositoryText("config/static-analysis-baseline.json"),
    repositoryText(".github/workflows/ci.yml"),
    repositoryText("docs/development.md"),
    repositoryText("docs/process/source-static-analysis.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("AGENTS.md"),
    repositoryText(".github/copilot-instructions.md"),
  ]);

  const manifest = JSON.parse(manifestText);
  const jscpd = JSON.parse(jscpdText);
  const baseline = JSON.parse(baselineText);
  assert.equal(manifest.devDependencies.jscpd, "5.0.15");
  assert.equal(manifest.scripts["check:duplication"], "node scripts/check-duplication.mjs");
  assert.equal(manifest.scripts["check:complexity"], "node scripts/check-complexity.mjs");
  assert.match(manifest.scripts["check:static"], /typecheck.*check:duplication.*check:complexity/u);
  assert.match(manifest.scripts.check, /^npm run check:static/u);
  assert.match(requirements, /^lizard==1\.23\.0$/m);

  assert.equal(jscpd.mode, "strict");
  assert.equal(jscpd.minLines, 8);
  assert.equal(jscpd.minTokens, 60);
  assert.equal(jscpd.threshold, 3.37);
  assert.deepEqual(jscpd.ignore, ["**/dist/**", "**/node_modules/**"]);
  assert.equal(baseline.jscpd.version, "5.0.15");
  assert.equal(baseline.jscpd.maxClones, 148);
  assert.equal(baseline.jscpd.maxDuplicatedLines, 2746);
  assert.equal(baseline.jscpd.maxDuplicatedTokens, 15252);
  assert.equal(baseline.jscpd.maxPercentage, 3.37);
  assert.equal(baseline.lizard.version, "1.23.0");
  assert.deepEqual(baseline.lizard.thresholds, {
    cyclomaticComplexity: 15,
    length: 100,
    parameters: 6,
  });
  assert.equal(Object.keys(baseline.lizard.functions).length, 169);

  assert.match(workflow, /actions\/setup-python@v6/u);
  assert.match(workflow, /pip install --requirement requirements-static-analysis\.txt/u);
  assert.match(workflow, /npm run check/u);
  assert.match(development, /npm run check:static/u);
  assert.match(process, /A new Lizard violation/u);
  assert.match(backlog, /^### STATIC-001:/m);
  assert.match(agents, /pinned jscpd duplicate and Lizard complexity ratchets/u);
  assert.match(copilot, /npm run check:static/u);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("ADV-002 acceptance closes all eight cases without changing release authority", async () => {
  const [
    requirements,
    backlog,
    acceptance,
    historyAcceptance,
    basicDesign,
    mutationSpecification,
    historySafetySpecification,
    changelog,
    readme,
    linkCheck,
    packageCheck,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("docs/process/advance-clean-candidate-acceptance.md"),
    repositoryText("docs/process/advance-history-acceptance.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/specs/mutation.md"),
    repositoryText("docs/specs/advance-history-safety.md"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
    repositoryText("scripts/check-npm-link.sh"),
    repositoryText("scripts/check-package.sh"),
  ]);

  assert.match(
    requirements,
    /20\. \[x\] Ensure one destructive `dag advance` preview is the exact/,
  );
  assert.match(
    backlog,
    /Status: Accepted in source \(2026-07-31; release selection pending\)/,
  );
  assert.match(
    acceptance,
    /- Document status: Accepted 1\.0/,
  );
  for (let index = 1; index <= 8; index += 1) {
    const id = `ACC-${String(index).padStart(3, "0")}`;
    assert.equal(acceptance.includes(`| \`${id}\` |`), true);
  }
  assert.match(acceptance, /Source bytes \| 567/);
  assert.match(acceptance, /Candidate bytes \| 206/);
  assert.match(acceptance, /Diff \| `\+4\/-28`/);
  assert.match(acceptance, /Published `0\.5\.5` remains unchanged/);
  assert.match(historyAcceptance, /- Document status: Accepted 1\.1/);
  assert.match(historyAcceptance, /ADV-002 repository-clean candidate amendment/);
  assert.match(
    basicDesign,
    /Both slices are accepted in\s+\[Advance Clean Candidate Acceptance\]/,
  );
  assert.doesNotMatch(basicDesign, /current source is\s+non-conforming to this target/);
  assert.match(
    mutationSpecification,
    /The current runtime implements this contract/,
  );
  assert.doesNotMatch(
    mutationSpecification,
    /current runtime is non-conforming/,
  );
  assert.match(historySafetySpecification, /- Accepted correction: \[`ADV-002`\]/);
  assert.match(changelog, /newly orphaned blank[\s\S]*separator prefixes/);
  assert.match(linkCheck, /check-advance-clean-candidate\.mjs/);
  assert.match(packageCheck, /check-advance-clean-candidate\.mjs/);
});

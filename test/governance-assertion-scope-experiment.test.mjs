import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("loose assertion experiment fixes one bounded non-malicious threat", async () => {
  const experiment = await repositoryFile(
    "docs/process/governance-assertion-scope-experiment.md",
  );

  for (const expected of [
    "exactly one valid final candidate",
    "affected `goal` and/or `dag` scopes",
    "not workstream, session, task, or future-command authority",
    "owner-assertion-free preview",
    "governance.applicable=false",
    "operation: <operation-id>",
    "updated_digest: <preview updated_digest>",
    "Do not copy it to a later command",
    "Do not treat one confirmed `dag advance` as confirmation for the next",
    "keep `GOV-AUTH-001` independent",
  ]) {
    assert.ok(experiment.includes(expected), expected);
  }
  assert.doesNotMatch(
    experiment,
    /malicious caller is required|signature is required|certificate is required/i,
  );
  assert.match(
    experiment,
    /does not\s+select an `--accepted-scope` spelling/,
  );
  for (let index = 1; index <= 6; index += 1) {
    assert.match(
      experiment,
      new RegExp(`\\| GOV-LOOSE-00${index} \\|`),
    );
  }
});

test("repository agent policies share the single-candidate boundary", async () => {
  const [agents, copilot, processGuide, readme] = await Promise.all([
    repositoryFile("AGENTS.md"),
    repositoryFile(".github/copilot-instructions.md"),
    repositoryFile("docs/process/ai-development.md"),
    repositoryFile("README.md"),
  ]);

  for (const source of [agents, copilot, processGuide, readme]) {
    assert.match(
      source,
      /single-candidate,\s+scope-bound/,
    );
    assert.match(source, /caller\s+assertion/);
    assert.match(source, /assertion-free preview|First preview\s+without it/);
    assert.match(source, /governance is not applicable|governance\.applicable=false/);
    assert.match(source, /source and\s+candidate\s+digests/);
    assert.match(source, /next\s+`dag advance`/);
  }
});

test("normative guidance fixes scope context without changing interface identity", async () => {
  const [requirements, authority, contract, design] = await Promise.all([
    repositoryFile("docs/requirements.md"),
    repositoryFile("docs/specs/governance-authority.md"),
    repositoryFile("docs/specs/governance-interface.md"),
    repositoryFile("docs/basic-design.md"),
  ]);

  assert.match(
    requirements,
    /prohibit carrying that confirmation to another candidate/,
  );
  assert.match(authority, /workstream authority, session authority/);
  assert.match(
    contract,
    /single-candidate assertion that the named\s+owner was consulted for the previewed affected scopes/,
  );
  assert.match(design, /without revising the version\s+1 evaluator/);
  assert.match(contract, /Interface version: `1`/);
  assert.match(contract, /Target CLI contract version: `5`/);
});

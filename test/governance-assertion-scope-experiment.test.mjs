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

  assert.match(
    experiment,
    /Status: Accepted caller-workflow hypothesis 1\.0/,
  );
  assert.match(experiment, /Result: Pass/);
  assert.match(
    experiment,
    /Source commit: `561ed2061058dfd07e8f81bb5be10f16d68721b1`/,
  );
  assert.match(
    experiment,
    /unconfirmed second advance:[\s\S]*sha256:242b7fe44ec0b812efa0c96cf0df5396eb0e4cf0789290c8e6cc1387432f303a/,
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
    assert.match(source, /modification time/);
    assert.match(source, /byte size before and after/);
    assert.match(source, /diff\s+counts/);
    assert.match(source, /supplemental machine identity/);
    assert.match(source, /next\s+`dag advance`/);
    assert.match(source, /PTGOV-103/);
    assert.match(source, /PTGOV-104/);
  }
});

test("normative guidance fixes scope context without changing interface identity", async () => {
  const [requirements, authority, contract, design, experiment] =
    await Promise.all([
      repositoryFile("docs/requirements.md"),
      repositoryFile("docs/specs/governance-authority.md"),
      repositoryFile("docs/specs/governance-interface.md"),
      repositoryFile("docs/basic-design.md"),
      repositoryFile("docs/process/governance-assertion-scope-experiment.md"),
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
  assert.match(design, /retaining the version\s+1 decision shape/);
  assert.match(design, /PTGOV-103/);
  assert.match(experiment, /18 ordinary-maintenance invocations/);
  assert.match(experiment, /five governed previews/);
  assert.match(experiment, /five persistent attempts/);
  assert.match(experiment, /PTGOV-104/);
  assert.match(contract, /Interface version: `1`/);
  assert.match(contract, /Target CLI contract version: `5`/);
});

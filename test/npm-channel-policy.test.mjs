import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const execFile = promisify(execFileCallback);

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("npm distribution policy maintains beta and latest without alpha", async () => {
  const [requirements, adr, script, procedure, agents, copilot, readme] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/adr/0003-beta-versioning.md"),
      repositoryText("scripts/publish-npm.sh"),
      repositoryText("docs/process/alpha-dist-tag-retirement.md"),
      repositoryText("AGENTS.md"),
      repositoryText(".github/copilot-instructions.md"),
      repositoryText("README.md"),
    ]);

  assert.match(
    requirements,
    /Maintain only the npm `beta` and `latest` distribution channels/,
  );
  assert.match(adr, /Do not\s+publish through or retain an `alpha` dist-tag/);
  assert.match(script, /publish_tag" != "beta"/);
  assert.doesNotMatch(script, /^\s*alpha\)$/m);
  assert.match(procedure, /Document status: Accepted 1\.0/);
  assert.match(procedure, /Before: `alpha=0\.1\.0-alpha\.2`/);
  assert.match(procedure, /After: `beta=0\.5\.2`, `latest=0\.5\.1`/);
  assert.match(procedure, /`perttool@0\.1\.0-alpha\.2` remains available/);

  for (const guidance of [agents, copilot, readme]) {
    assert.match(guidance, /alpha.*(?:retired|exact pin)/is);
  }
});

test("npm publication guard rejects an alpha artifact before publication", async () => {
  const fixtureRoot = await mkdtemp(
    path.join(tmpdir(), "perttool-alpha-policy."),
  );
  try {
    await mkdir(path.join(fixtureRoot, "dist"));
    await writeFile(
      path.join(fixtureRoot, "dist", "cli.js"),
      "#!/usr/bin/env node\n",
    );
    await writeFile(
      path.join(fixtureRoot, "package.json"),
      JSON.stringify(
        {
          name: "perttool",
          version: "0.6.0-alpha.1",
          bin: { perttool: "dist/cli.js" },
          files: ["dist"],
          publishConfig: {
            access: "public",
            registry: "https://registry.npmjs.org/",
            tag: "alpha",
          },
        },
        null,
        2,
      ),
    );
    const { stdout } = await execFile(
      "npm",
      ["pack", "--ignore-scripts", "--json"],
      { cwd: fixtureRoot },
    );
    const [{ filename }] = JSON.parse(stdout);
    const tarball = path.join(fixtureRoot, filename);

    await assert.rejects(
      execFile(
        "bash",
        [path.join(root, "scripts", "publish-npm.sh"), "--dry-run", tarball],
        { cwd: root },
      ),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(
          error.stderr,
          /unsupported publishConfig tag: alpha \(only beta is maintained\)/,
        );
        return true;
      },
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

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

test("0.3.0 release gate keeps Contract 4 implementation and publication separate", async () => {
  const [requirements, adr, design, procedure, plan, manifestText] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.3.0-release.md"),
    repositoryText("plans/release-0.3.0.pert"),
    repositoryText("package.json"),
  ]);

  assert.match(requirements, /^### 21\.4 CLI Contract 4 beta release acceptance criteria$/m);
  const releaseSection = requirements.split(
    "### 21.4 CLI Contract 4 beta release acceptance criteria",
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.match(adr, /Select suffix-free `0\.3\.0`/);
  assert.match(design, /^### Post-MVP Slice 4F: Contract 4 `v0\.3\.0` beta release$/m);
  assert.match(procedure, /Status: Planned 1\.0/);
  assert.match(procedure, /latest=0\.2\.0/);
  assert.match(
    procedure,
    /user's 2026-07-25 request to proceed through PUBLISH explicitly authorizes/,
  );
  assert.doesNotMatch(plan, /^task RELEASE_030_GATE_DESIGN /m);
  assert.match(
    plan,
    /^milestone RELEASE_030_GATE_ACCEPTED:\n  title "Version 0\.3\.0 release gate accepted"\n  state reached$/m,
  );
  assert.match(plan, /^task RELEASE_030_CONTRACT_4_READINESS /m);
  assert.match(plan, /^task RELEASE_030_PUBLISH /m);
  assert.match(plan, /^task RELEASE_030_ACCEPTANCE /m);
  assert.match(
    plan,
    /npm latest promotion remains a separate post-acceptance decision/,
  );

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.version, "0.2.0");
  assert.equal(manifest.publishConfig.tag, "beta");
});

// R: Verify durable package guidance and the version-bound README user workflow.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("README is a current user guide with separate historical and developer routes", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");

  assert.match(readme, /Registry snapshot on \d{4}-\d{2}-\d{2}/u);
  assert.match(readme, /The `0\.12\.2` package provides the compatible remaining-estimate patch/u);
  assert.match(readme, /Grammar 10 and CLI Contract 11 remain unchanged/u);
  assert.match(readme, /npm `latest` and `beta` both identify\n`0\.12\.1`/u);
  assert.match(readme, /Exact `0\.12\.1` is the rollback pin/u);
  assert.match(readme, /no `alpha` channel is present/u);
  assert.match(readme, /npm install --global perttool@latest/u);
  assert.match(readme, /^## Create your first plan$/mu);
  assert.match(readme, /^## Migrate an existing plan$/mu);
  assert.match(readme, /document migrate PLAN\.pert --target-grammar 9 --diff/u);
  assert.match(readme, /Automatic migration is not required/u);
  assert.match(readme, /version 9[\s\S]*finish DONE/u);
  assert.match(readme, /there is no automatic Grammar 9 to 8\n+downgrade/u);
  assert.match(readme, /Current changelog and older versions/u);
  assert.match(readme, /Developer guide/u);

  assert.doesNotMatch(readme, /^Version `0\.[0-9]+\.[0-9]+`/mu);
  assert.doesNotMatch(readme, /npm install --global perttool@0\.9\.4/u);
  assert.doesNotMatch(readme, /^## Release work$/mu);
  assert.doesNotMatch(readme, /^## Sources of truth$/mu);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  GOVERNANCE_DIRECT_EDIT_WARNING as initWarning,
} from "../dist/application/target-governance-init.js";
import {
  GOVERNANCE_DIRECT_EDIT_WARNING,
} from "../dist/governance/guidance.js";
import { getGuide, renderGuideResult } from "../dist/help/guide.js";
import {
  getTargetGovernanceGuide,
  renderTargetGovernanceGuideResult,
  serializeTargetGovernanceGuideResult,
  targetGovernanceGuideResultToJson,
} from "../dist/help/target-governance-guide.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

test("target Contract 5 editing Guide states the complete governance boundary", () => {
  const result = getTargetGovernanceGuide("editing", "detail");
  assert.equal(result.ok, true);
  assert.equal(result.schemaVersion, "Perttool.GuideResult.v1");
  assert.equal(result.cliContractVersion, 5);
  assert.deepEqual(
    result.sections.slice(-4).map(({ id }) => id),
    [
      "owner-aware-governance",
      "pre-change-authority",
      "assertion-boundary",
      "direct-edit-boundary",
    ],
  );

  const text = renderTargetGovernanceGuideResult(result);
  for (const expected of [
    "assertion-free preview",
    "effective owner or delegate has direct authority",
    "repeatable --accepted-by-owner caller assertions",
    "explicitly confirmed affected scopes",
    "never reuse them across commands",
    "digest-bound pre-change document",
    "atomic batch must satisfy every affected scope",
    "available modification time",
    "byte size before and after",
    "diff counts",
    "supplemental machine identity",
    "next dag advance",
    "user-response boundary",
    "PTGOV-103",
    "PTGOV-104",
    "--warnings-as-errors prevents it",
    "not authentication, verified identity, signatures, or a durable approval audit",
    "guidance, not technical prevention",
    "bypass the tool-mediated authority check",
  ]) {
    assert.match(text, new RegExp(expected));
  }
  assert.match(text, new RegExp(GOVERNANCE_DIRECT_EDIT_WARNING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const json = targetGovernanceGuideResultToJson(result);
  assert.equal(json.cli_contract_version, 5);
  assert.equal(
    serializeTargetGovernanceGuideResult(result),
    `${JSON.stringify(json)}\n`,
  );
  assert.equal(
    serializeTargetGovernanceGuideResult(
      getTargetGovernanceGuide("editing", "detail"),
    ),
    serializeTargetGovernanceGuideResult(result),
  );
});

test("quick target guidance keeps the preview and persistence distinction", () => {
  const result = getTargetGovernanceGuide("editing", "quick");
  assert.equal(result.cliContractVersion, 5);
  assert.equal(
    result.sections.at(-1).id,
    "owner-aware-governance",
  );
  assert.match(
    result.sections.at(-1).body,
    /assertion-free preview/,
  );
  assert.match(result.sections.at(-1).body, /PTGOV-103/);
  assert.match(result.sections.at(-1).body, /PTGOV-104/);
  assert.doesNotMatch(
    renderTargetGovernanceGuideResult(result),
    /Pre-change authority/,
  );
});

test("active Contract 9 Guide exposes governance through standard names", () => {
  const active = publicApi.getGuide("editing", "detail");
  assert.equal(active.cliContractVersion, 9);
  const text = publicApi.renderGuideResult(active);
  assert.match(text, /owner-aware governance/i);
  assert.match(text, /accepted-by-owner/);
  assert.equal("getTargetGovernanceGuide" in publicApi, false);
  assert.equal(
    publicApi.GOVERNANCE_DIRECT_EDIT_WARNING,
    GOVERNANCE_DIRECT_EDIT_WARNING,
  );
});

test("generated project, README, and process guidance share the exact warning", async () => {
  assert.equal(initWarning, GOVERNANCE_DIRECT_EDIT_WARNING);
  const [readme, processGuide] = await Promise.all([
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(root, "docs/process/ai-development.md"), "utf8"),
  ]);
  assert.match(readme, new RegExp(GOVERNANCE_DIRECT_EDIT_WARNING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(readme, /guidance, not technical prevention/i);
  assert.match(readme, /not authentication/i);
  assert.match(processGuide, new RegExp(GOVERNANCE_DIRECT_EDIT_WARNING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(processGuide, /guidance(?:, not| rather than) technical prevention/i);
  {
    const source = processGuide;
    assert.match(source, /not\s+authentication/i);
    assert.match(source, /Contract 4/);
    assert.match(source, /Contract 6/);
  }
});

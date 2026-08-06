import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  analyzeDocument,
  checkDocument,
  getJsonSchemaCatalog,
  getProjectMetadata,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

function tableIds(document, prefix) {
  return [
    ...document.matchAll(
      new RegExp("^\\| `(" + prefix + "-\\d{3})` \\|", "gm"),
    ),
  ].map((match) => match[1]);
}

test("historical DAG contract fixes the selected first-parent boundary", async () => {
  const [
    requirements,
    specification,
    actuals,
    editor,
    design,
    backlog,
    proposal,
    scmProposal,
  ] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/specs/historical-dag.md"),
      repositoryText("docs/specs/project-actuals.md"),
      repositoryText("docs/specs/editor-protocol.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/backlog.md"),
      repositoryText("docs/process/historical-dag-design.md"),
      repositoryText("docs/process/semantic-diff-merge-design.md"),
    ]);

  assert.match(specification, /- Status: Normative 1\.0/u);
  assert.match(specification, /Perttool\.HistoricalDagModel\.v1/u);
  assert.match(specification, /Perttool\.HistoricalTransitionModel\.v1/u);
  assert.match(specification, /Perttool\.HistoricalGraphResult\.v1/u);
  assert.match(specification, /Ancestry profile: `first_parent`/u);
  assert.match(specification, /inclusive lower[- ]boundary/u);
  assert.match(specification, /endpoint_path_missing/u);
  assert.match(specification, /effective_checkpoint_id/u);
  assert.match(specification, /lineage=null/u);
  assert.match(specification, /event_payload_changed/u);
  assert.match(specification, /HDGE-/u);
  assert.match(specification, /HDGT-/u);
  assert.match(specification, /candidate's complete normalized transition-model semantics equal `B`/u);
  assert.match(specification, /view:\s+snapshot \| lineage \| timeline/u);
  assert.match(specification, /analysis:\s+none \| precedence \| resource \| both/u);
  assert.match(specification, /analysis is unavailable/u);
  assert.match(specification, /PTHDG-101 through PTHDG-106/u);
  assert.match(specification, /Inspected commits \| 2,048/u);
  assert.match(specification, /Aggregate raw snapshot bytes \| 134,217,728/u);
  assert.match(specification, /A `three_way` request returns unavailable/u);
  assert.match(specification, /Current `perttool\/graphView` remains/u);
  assert.deepEqual(tableIds(specification, "HDG"), expectedIds("HDG", 20));

  assert.match(
    requirements,
    /\[Historical DAG Reconstruction Contract\]\(specs\/historical-dag\.md\)/u,
  );
  assert.match(requirements, /23\. \[ \] Implement read-only historical DAG reconstruction/u);
  assert.match(
    actuals,
    /\[Historical DAG Reconstruction Contract\]\(historical-dag\.md\)/u,
  );
  assert.match(
    editor,
    /\[Historical DAG Reconstruction Contract\]\(historical-dag\.md\)/u,
  );
  assert.match(design, /### Post-MVP Slice 6: Historical DAG reconstruction/u);
  assert.match(
    backlog,
    /Status: First-parent normative contract, internal transition model, bounded\nimmutable Git evidence, and pure linear reconstruction implemented/u,
  );
  assert.match(proposal, /Document status: Superseded design input 0\.2/u);
  assert.match(proposal, /Normative successor: \[Historical DAG Reconstruction Contract\]/u);
  assert.match(
    scmProposal,
    /Related selected consumer: \[Historical DAG Reconstruction Contract\]/u,
  );
});

test("all twenty historical DAG cases are dependency ordered and closed", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/historical-dag-contract-v1.json"),
  );

  assert.equal(
    fixture.schema_version,
    "Perttool.HistoricalDagContractCases.v1",
  );
  assert.equal(fixture.historical_dag_model_version, 1);
  assert.equal(fixture.historical_transition_model_version, 1);
  assert.deepEqual(fixture.ancestry_profiles, ["first_parent"]);
  assert.equal(
    fixture.target_result_schema,
    "Perttool.HistoricalGraphResult.v1",
  );
  assert.deepEqual(fixture.active_runtime_unchanged, {
    grammar_version: 6,
    cli_contract_version: 7,
    commands: 44,
    root_schemas: 20,
    project_history_result: "Perttool.ProjectHistoryResult.v1",
    graph_view_result: "Perttool.GraphViewResult.v1",
  });
  assert.deepEqual(fixture.hard_limits, {
    inspected_commits: 2048,
    raw_bytes_per_snapshot: 8388608,
    aggregate_raw_snapshot_bytes: 134217728,
    entity_value_epochs: 100000,
    transition_records: 2047,
    rendered_graph_occurrences: 20000,
    historical_source_bindings: 100000,
  });
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    expectedIds("HDG", 20),
  );

  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      `${contractCase.id}: dependencies must precede the case`,
    );
    assert.equal(typeof contractCase.operation, "string");
    assert.equal(Object.keys(contractCase.expected).length > 0, true);
    accepted.add(contractCase.id);
  }

  assert.equal(
    fixture.cases.find(({ id }) => id === "HDG-003").expected
      .explicit_lower_included,
    true,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "HDG-010").expected
      .retired_topology_rehydrated,
    true,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "HDG-015").expected.cause,
    "unsupported_ancestry_profile",
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "HDG-018").expected.combinations,
    12,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "HDG-020").expected
      .source_git_index_ref_config_writes,
    0,
  );
});

test("contract selection leaves the active runtime surface unchanged", () => {
  assert.equal(COMMAND_REGISTRY.length, 44);
  assert.equal(
    COMMAND_REGISTRY.some(
      ({ path: commandPath }) =>
        commandPath[0] === "dag" && commandPath[1] === "history",
    ),
    false,
  );
  const catalog = getJsonSchemaCatalog();
  assert.equal(catalog.length, 20);
  assert.equal(
    catalog.some(({ schemaId }) => schemaId === "Perttool.HistoricalGraphResult.v1"),
    false,
  );
});

test("accepted linear Core makes only the historical CLI startable", async () => {
  const [
    source,
    acceptance,
    transitionAcceptance,
    linearAcceptance,
    selfUse,
  ] = await Promise.all([
    repositoryText("plans/historical-dag.pert"),
    repositoryText("docs/process/historical-dag-contract-acceptance.md"),
    repositoryText("docs/process/historical-transition-model-acceptance.md"),
    repositoryText("docs/process/historical-linear-core-acceptance.md"),
    repositoryText("scripts/check-self-use.sh"),
  ]);
  const checked = checkDocument(source);
  const metadata = getProjectMetadata(source);
  const analyzed = analyzeDocument(source);
  const next = selectNextTasks(source);

  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.equal(metadata.project.id, "HISTORICAL_DAG");
  assert.equal(metadata.grammarVersion, 6);
  assert.match(
    source,
    /task HISTORICAL_DAG_CONTRACT[\s\S]*?status done/u,
  );
  assert.match(
    source,
    /task HISTORICAL_TRANSITION_MODEL[\s\S]*?status done/u,
  );
  assert.match(
    source,
    /task HISTORICAL_GIT_PROBE[\s\S]*?status done/u,
  );
  assert.match(
    source,
    /task HISTORICAL_LINEAR_CORE[\s\S]*?status done/u,
  );
  assert.match(
    source,
    /task_outcome OUTCOME_HISTORICAL_TRANSITION_MODEL:[\s\S]*?task HISTORICAL_TRANSITION_MODEL[\s\S]*?status conformant/u,
  );
  assert.match(
    source,
    /task_outcome OUTCOME_HISTORICAL_GIT_PROBE:[\s\S]*?task HISTORICAL_GIT_PROBE[\s\S]*?status conformant/u,
  );
  assert.match(
    source,
    /task_outcome OUTCOME_HISTORICAL_LINEAR_CORE:[\s\S]*?task HISTORICAL_LINEAR_CORE[\s\S]*?status conformant/u,
  );
  assert.deepEqual(next.groups.ready, ["HISTORICAL_CLI"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, [
    "HISTORICAL_CLI",
  ]);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, [
    "HISTORICAL_CLI",
  ]);
  assert.deepEqual(
    next.temporal.authority.assuranceUnavailableRecommendedTaskIds,
    [],
  );
  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Runtime status: not implemented/u);
  assert.match(acceptance, /There are no open normative contract findings/u);
  assert.deepEqual(tableIds(acceptance, "HDGR"), expectedIds("HDGR", 14));
  assert.match(transitionAcceptance, /Document status: Accepted 1\.0/u);
  assert.match(transitionAcceptance, /all 35 self-use plans/u);
  assert.match(linearAcceptance, /Document status: Accepted 1\.0/u);
  assert.match(
    linearAcceptance,
    /complete\s+repository gate passes 939 tests/u,
  );
  assert.match(linearAcceptance, /isolated 665-file/u);
  assert.match(
    linearAcceptance,
    /candidate digest\s+`sha256:0ca50c852105de6266e962f589597fd0e10d5a03748e3615e9e64af2a6b905c6`/u,
  );
  assert.match(selfUse, /plans\/historical-dag\.pert/u);
  assert.match(selfUse, /35 plans; check, analyze, next/u);
});

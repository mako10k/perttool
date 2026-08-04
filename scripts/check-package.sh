#!/usr/bin/env bash

set -euo pipefail

if [[ $# -gt 1 ]]; then
  printf 'Usage: bash scripts/check-package.sh [/absolute/path/to/perttool-VERSION.tgz]\n' >&2
  exit 2
fi

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

temporary_root=${TMPDIR:-/tmp}
package_root=$(mktemp -d "$temporary_root/perttool-package.XXXXXX")
case "$package_root" in
  "$temporary_root"/perttool-package.*) ;;
  *)
    printf 'unsafe temporary package root: %s\n' "$package_root" >&2
    exit 1
    ;;
esac
trap 'rm -rf -- "$package_root"' EXIT

package_name=$(node -p 'require("./package.json").name')
package_version=$(node -p 'require("./package.json").version')
if [[ $# -eq 1 ]]; then
  case "$1" in
    /*) tarball=$1 ;;
    *)
      printf 'explicit release tarball must use an absolute path: %s\n' "$1" >&2
      exit 2
      ;;
  esac
else
  npm pack --pack-destination "$package_root" --foreground-scripts >"$package_root/pack-output.txt"
  tarball="$package_root/$package_name-$package_version.tgz"
fi
if [[ ! -f "$tarball" ]]; then
  printf 'release tarball does not exist: %s\n' "$tarball" >&2
  exit 1
fi

bash scripts/publish-npm.sh --dry-run "$tarball"

archive_list="$package_root/archive-list.txt"
tar -tzf "$tarball" >"$archive_list"
# shellcheck disable=SC2016 # The JavaScript template literal is not shell syntax.
packed_identity=$(tar -xOf "$tarball" package/package.json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const manifest = JSON.parse(input);
      process.stdout.write(`${manifest.name}@${manifest.version}`);
    });
  ')
if [[ "$packed_identity" != "$package_name@$package_version" ]]; then
  printf 'release tarball identity mismatch: expected %s@%s, got %s\n' \
    "$package_name" "$package_version" "$packed_identity" >&2
  exit 1
fi
for required in \
  package/package.json \
  package/README.md \
  package/LICENSE \
  package/CHANGELOG.md \
  package/dist/cli.js \
  package/dist/assurance/compatibility.js \
  package/dist/assurance/compatibility.d.ts \
  package/dist/assurance/mermaid.js \
  package/dist/assurance/mermaid.d.ts \
  package/dist/application/target-assurance-inspection.js \
  package/dist/application/target-assurance-inspection.d.ts \
  package/dist/help/guide.js \
  package/dist/index.js \
  package/dist/index.d.ts \
  package/schemas/Perttool.Common.v1.schema.json \
  package/schemas/Perttool.AdvanceResult.v1.schema.json \
  package/schemas/Perttool.CheckResult.v3.schema.json \
  package/schemas/Perttool.SchemaResult.v1.schema.json \
  package/schemas/Perttool.OverrideDecision.v1.schema.json
do
  if ! grep -Fqx "$required" "$archive_list"; then
    printf 'release tarball is missing %s\n' "$required" >&2
    exit 1
  fi
done

if grep -Eq '^package/(src|test|docs|plans|scripts|\.github|\.codex)(/|$)|^package/AGENTS\.md$' "$archive_list"; then
  printf 'release tarball contains repository-only files\n' >&2
  exit 1
fi

install_prefix="$package_root/prefix"
npm install --global --prefix "$install_prefix" --ignore-scripts "$tarball" >/dev/null
installed_cli="$install_prefix/bin/perttool"
if [[ ! -x "$installed_cli" ]]; then
  printf 'packed CLI is not executable: %s\n' "$installed_cli" >&2
  exit 1
fi

expected_version="perttool $package_version"
actual_version=$("$installed_cli" --version)
if [[ "$actual_version" != "$expected_version" ]]; then
  printf 'packed CLI version mismatch: expected %s, got %s\n' \
    "$expected_version" "$actual_version" >&2
  exit 1
fi

"$installed_cli" document check "$repo_root/docs/examples/minimal.pert" --format=json >/dev/null
"$installed_cli" guide --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      const topicIds = result.topics?.map(({ id }) => id);
      if (
        result.schema_version !== "Perttool.GuideResult.v1" ||
        result.cli_contract_version !== 6 ||
        result.operation !== "guide" ||
        JSON.stringify(topicIds) !== JSON.stringify([
          "syntax",
          "analysis",
          "next",
          "editing",
          "actuals",
          "mermaid",
          "workflows",
          "errors",
          "samples",
        ]) ||
        /[\u3040-\u30ff\u4e00-\u9fff]/u.test(JSON.stringify(result))
      ) process.exit(1);
    });
  '
"$installed_cli" guide next --level=detail --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      const sectionIds = result.sections?.map(({ id }) => id);
      if (
        result.schema_version !== "Perttool.GuideResult.v1" ||
        result.cli_contract_version !== 6 ||
        result.operation !== "guide" ||
        result.topic_id !== "next" ||
        JSON.stringify(sectionIds) !== JSON.stringify([
          "classification",
          "recommendation",
          "consumer-safety",
          "authority-adoption",
          "selection",
          "override-validation",
          "explanation",
        ]) ||
        /[\u3040-\u30ff\u4e00-\u9fff]/u.test(JSON.stringify(result))
      ) process.exit(1);
    });
  '
"$installed_cli" guide editing --level=detail --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      const serialized = JSON.stringify(result);
      if (
        result.schema_version !== "Perttool.GuideResult.v1" ||
        result.cli_contract_version !== 6 ||
        result.operation !== "guide" ||
        result.topic_id !== "editing" ||
        !serialized.includes("PTADV-101") ||
        !serialized.includes("PTADV-102") ||
        !serialized.includes("PTADV-103") ||
        !serialized.includes("--force-history-loss")
      ) process.exit(1);
    });
  '
assert_contract2_rejected() {
  set +e
  "$installed_cli" "$@" >/dev/null 2>&1
  contract2_status=$?
  set -e
  if [[ "$contract2_status" -ne 2 ]]; then
    printf 'packed Contract 2 route was not rejected with exit 2: %s\n' "$*" >&2
    exit 1
  fi
}
assert_contract2_rejected dsl check "$repo_root/docs/examples/minimal.pert"
assert_contract2_rejected dsl format "$repo_root/docs/examples/minimal.pert"
assert_contract2_rejected dsl help
assert_contract2_rejected mutation apply "$repo_root/docs/examples/minimal.pert" --request missing.json
"$installed_cli" help project init --format=json >/dev/null
"$installed_cli" project init PACKAGE_SMOKE \
  --title "Package smoke" \
  --duration-unit day \
  --initial-milestone START \
  --initial-milestone-title "Package smoke started" \
  --finish START \
  --format=json >/dev/null
"$installed_cli" gate set "$repo_root/docs/examples/point-velocity.pert" \
  DESIGN_RELEASE --reason "Design and implementation release" \
  --format=json >/dev/null
"$installed_cli" project show "$repo_root/docs/examples/minimal.pert" --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      if (
        result.schema_version !== "Perttool.ProjectResult.v3" ||
        result.project?.id !== "MINIMAL" ||
        result.project?.velocity !== null
      ) process.exit(1);
    });
  '
"$installed_cli" project set "$repo_root/docs/examples/minimal.pert" \
  --as-of 2026-07-23 --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      if (
        result.schema_version !== "Perttool.MutationResult.v3" ||
        result.operation !== "project.set" ||
        !result.updated_text?.includes("  as_of 2026-07-23")
      ) process.exit(1);
    });
  '
"$installed_cli" agent help grok workflow --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      if (
        result.schema_version !== "Perttool.AgentGuidanceResult.v1" ||
        result.query?.canonical_provider_id !== "grok-build" ||
        result.query?.alias_applied !== true ||
        Object.values(result.capabilities ?? {}).some((value) => value !== false)
      ) process.exit(1);
    });
  '
"$installed_cli" dag next "$repo_root/docs/examples/minimal.pert" --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      if (
        result.schema_version !== "Perttool.NextResult.v5" ||
        result.recommendation_interface_version !== 1 ||
        result.recommendation?.explanation_status?.complete !== true ||
        result.temporal?.authority?.policy !== "recommendation_v1_plus_release_gate"
      ) process.exit(1);
    });
  '
"$installed_cli" dag render "$repo_root/docs/examples/minimal.pert" --to mermaid --format=json >/dev/null
node scripts/check-package-file-first.mjs \
  "$installed_cli" \
  "$package_root/file-first-workflow"
node scripts/check-advance-clean-candidate.mjs \
  "$installed_cli" \
  "$package_root/advance-clean-candidate-workflow" >/dev/null
node scripts/check-package-actuals.mjs \
  "$installed_cli" \
  "$package_root/actuals-workflow" \
  "$repo_root/test/fixtures/project-actuals-v5.pert"
installed_guide_module="$install_prefix/lib/node_modules/$package_name/dist/index.js"
node --input-type=module - "$installed_guide_module" <<'NODE'
import { pathToFileURL } from "node:url";

const guide = await import(pathToFileURL(process.argv[2]).href);
const index = JSON.parse(guide.serializeGuideResult(
  guide.getGuide(null, "index"),
));
const text = guide.renderGuideResult(guide.getGuide("syntax", "quick"));
const missing = guide.guideResultToJson(guide.getGuide("missing", "detail"));
if (
  index.schema_version !== "Perttool.GuideResult.v1" ||
  index.cli_contract_version !== 6 ||
  index.operation !== "guide" ||
  index.topics?.length !== 9 ||
  !JSON.stringify(index).includes("Grammar versions 1 through 5") ||
  !text.startsWith("DSL syntax\n") ||
  missing.diagnostics?.[0]?.help_topic !== null ||
  missing.diagnostics?.[0]?.guide_topic !== "syntax"
) process.exit(1);
NODE
installed_module="$install_prefix/lib/node_modules/$package_name/dist/index.js"
node --input-type=module - \
  "$installed_module" \
  "$repo_root/docs/examples/minimal.pert" \
  "$repo_root/test/fixtures/recommendation/rec-001-critical-priority.pert" \
  "$installed_cli" \
  "$repo_root/test/fixtures/temporal-units/calendar-offset-v2.pert" \
  "$repo_root/test/fixtures/rational-duration/contract3-rejection-v3.pert" <<'NODE'
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const api = await import(pathToFileURL(process.argv[2]).href);
const require = createRequire(process.argv[2]);
const exportedSchemaPath = require.resolve(
  "perttool/schemas/Perttool.NextResult.v5.schema.json",
);
const exportedSchema = JSON.parse(readFileSync(exportedSchemaPath, "utf8"));
const exportedAdvanceSchemaPath = require.resolve(
  "perttool/schemas/Perttool.AdvanceResult.v1.schema.json",
);
const exportedAdvanceSchema = JSON.parse(
  readFileSync(exportedAdvanceSchemaPath, "utf8"),
);
for (const targetName of [
  "TARGET_GRAMMAR_2_CAPABILITY",
  "parseTargetDocument",
  "validateTargetDocument",
  "formatTargetDocument",
  "planTargetMutation",
  "planTargetBatchMutation",
  "checkTargetDocument",
  "getTargetProjectMetadata",
  "projectDeclaredCalendarValue",
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
  "prepareTargetUnitMigrationRequest",
  "convertPreparedUnitMigrationRequest",
  "planTargetUnitMigrationCandidate",
  "planTargetUnitMigrationResult",
  "withTargetUnitMigrationWrite",
  "UNIT_MIGRATION_IDENTITY",
  "UNIT_MIGRATION_DIAGNOSTIC_CODES",
  "prepareTargetTemporalInputs",
  "projectTargetTemporalInputs",
  "analyzeTemporalPrecedenceSchedule",
  "analyzeTemporalResourceSchedule",
  "evaluateTemporalDeadlines",
  "analyzeTargetTemporalDocument",
  "selectTargetTemporalTasks",
  "selectNextTasksFromAnalysis",
  "TARGET_GRAMMAR_4_CAPABILITY",
  "parseTargetGrammar4Document",
  "validateTargetGrammar4Document",
  "planTargetGrammar4Mutation",
  "planTargetGovernanceMutation",
  "TARGET_GOVERNANCE_COMMAND_REGISTRY",
]) {
  if (targetName in api) process.exit(1);
}
for (const publicName of [
  "analyzeDocument",
  "selectNextTasks",
  "planUnitMigration",
  "withUnitMigrationWrite",
  "planMutation",
  "planBatchMutation",
  "planAdvance",
  "getProjectMetadata",
  "getGuide",
  "getJsonSchema",
  "getJsonSchemaCatalog",
  "getJsonSchemaResult",
  "validateCommandInvocation",
]) {
  if (typeof api[publicName] !== "function") process.exit(1);
}

const contract5Help = spawnSync(
  process.argv[5],
  ["help", "--format=json"],
  { encoding: "utf8" },
);
const contract5HelpJson = JSON.parse(contract5Help.stdout);
const serializedHelp = JSON.stringify(contract5HelpJson);
if (
  contract5Help.status !== 0 ||
  contract5Help.stderr !== "" ||
  contract5HelpJson.schema_version !== "Perttool.CommandHelpResult.v1" ||
  contract5HelpJson.cli_contract_version !== 6 ||
  contract5HelpJson.commands?.length !== 34 ||
  !serializedHelp.includes("Perttool.SchemaResult.v1") ||
  !serializedHelp.includes("project migrate-unit") ||
  !serializedHelp.includes('"not-before"') ||
  !serializedHelp.includes('"deadline"') ||
  !serializedHelp.includes("Perttool.CheckResult.v3") ||
  !serializedHelp.includes("Perttool.ProjectResult.v3") ||
  !serializedHelp.includes("Perttool.MutationResult.v3") ||
  !serializedHelp.includes("Perttool.AdvanceResult.v1") ||
  !serializedHelp.includes('"force-history-loss"') ||
  !serializedHelp.includes("Perttool.AnalysisResult.v4") ||
  !serializedHelp.includes("Perttool.NextResult.v5") ||
  !serializedHelp.includes("Perttool.UnitMigrationResult.v3") ||
  !serializedHelp.includes('"actor"') ||
  !serializedHelp.includes('"accepted-by-owner"') ||
  !serializedHelp.includes('"goal-owner"')
) process.exit(1);

const schemaCatalog = spawnSync(
  process.argv[5],
  ["schema", "--format=json"],
  { encoding: "utf8" },
);
const schemaCatalogJson = JSON.parse(schemaCatalog.stdout);
const selectedSchema = spawnSync(
  process.argv[5],
  ["schema", "Perttool.NextResult.v5", "--format=json"],
  { encoding: "utf8" },
);
const selectedSchemaJson = JSON.parse(selectedSchema.stdout);
const selectedAdvanceSchema = spawnSync(
  process.argv[5],
  ["schema", "Perttool.AdvanceResult.v1", "--format=json"],
  { encoding: "utf8" },
);
const selectedAdvanceSchemaJson = JSON.parse(
  selectedAdvanceSchema.stdout,
);
const outlineSchema = spawnSync(
  process.argv[5],
  [
    "schema",
    "Perttool.NextResult.v5",
    "--view=outline",
    "--format=json",
  ],
  { encoding: "utf8" },
);
const outlineSchemaJson = JSON.parse(outlineSchema.stdout);
const detailSchema = spawnSync(
  process.argv[5],
  [
    "schema",
    "Perttool.NextResult.v5",
    "--view=outline",
    "--ref=#/$defs/recommendation",
    "--format=json",
  ],
  { encoding: "utf8" },
);
const detailSchemaJson = JSON.parse(detailSchema.stdout);
const apiOutline = api.jsonSchemaResultToJson(
  api.getJsonSchemaResult(
    "Perttool.NextResult.v5",
    { view: "outline" },
  ),
);
if (
  schemaCatalog.status !== 0 ||
  schemaCatalog.stderr !== "" ||
  schemaCatalogJson.schema_version !== "Perttool.SchemaResult.v1" ||
  schemaCatalogJson.schemas?.length !== 19 ||
  schemaCatalogJson.schema !== null ||
  selectedSchema.status !== 0 ||
  selectedSchema.stderr !== "" ||
  selectedSchemaJson.schema?.$schema !==
    "https://json-schema.org/draft/2020-12/schema" ||
  selectedSchemaJson.schema?.$id !==
    "https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v5.schema.json" ||
  selectedAdvanceSchema.status !== 0 ||
  selectedAdvanceSchema.stderr !== "" ||
  selectedAdvanceSchemaJson.schema?.$id !==
    "https://github.com/mako10k/perttool/schemas/Perttool.AdvanceResult.v1.schema.json" ||
  selectedAdvanceSchemaJson.schema?.properties?.history_guard === undefined ||
  outlineSchema.status !== 0 ||
  outlineSchema.stderr !== "" ||
  outlineSchemaJson.query?.view !== "outline" ||
  Object.hasOwn(outlineSchemaJson.schema ?? {}, "$defs") ||
  outlineSchemaJson.schema?.properties?.groups?.$ref !==
    "https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v5.schema.json#/properties/groups" ||
  detailSchema.status !== 0 ||
  detailSchema.stderr !== "" ||
  detailSchemaJson.schema?.properties?.result_decision === undefined ||
  JSON.stringify(apiOutline) !== JSON.stringify(outlineSchemaJson) ||
  api.getJsonSchemaCatalog().length !== 19 ||
  api.getJsonSchema("Perttool.NextResult.v5")?.$id !==
    selectedSchemaJson.schema.$id ||
  api.getJsonSchema("Perttool.AdvanceResult.v1")?.$id !==
    selectedAdvanceSchemaJson.schema.$id ||
  api.ADVANCE_RESULT_SCHEMA_VERSION !== "Perttool.AdvanceResult.v1" ||
  exportedSchema.$id !== selectedSchemaJson.schema.$id ||
  exportedAdvanceSchema.$id !== selectedAdvanceSchemaJson.schema.$id
) process.exit(1);

for (const [fixture, grammarVersion] of [
  [process.argv[6], 2],
  [process.argv[7], 3],
]) {
  for (const [route, schemaVersion] of [
    [["document", "check"], "Perttool.CheckResult.v3"],
    [["document", "format"], "Perttool.FormatResult.v1"],
    [["project", "show"], "Perttool.ProjectResult.v3"],
    [["dag", "analyze"], "Perttool.AnalysisResult.v4"],
    [["dag", "next"], "Perttool.NextResult.v5"],
  ]) {
    const result = spawnSync(
      process.argv[5],
      [...route, fixture, "--format=json"],
      { encoding: "utf8" },
    );
    const json = JSON.parse(result.stdout);
    if (
      result.status !== 0 ||
      result.stderr !== "" ||
      json.schema_version !== schemaVersion ||
      json.cli_contract_version !== 6 ||
      json.ok !== true ||
      (route[1] === "format"
        ? "grammar_version" in json
        : json.grammar_version !== grammarVersion) ||
      json.diagnostics?.length !== 0
    ) process.exit(1);
  }
}

const guidance = api.getAgentHelp({
  providerId: "grok",
  surfaceId: "workflow",
});
const guidanceCli = spawnSync(
  process.argv[5],
  ["agent", "help", "grok", "workflow", "--format=json"],
  { encoding: "utf8" },
);
const guidanceCliJson = JSON.parse(guidanceCli.stdout);
const { cli_contract_version: guidanceContract, ...guidanceCliCore } =
  guidanceCliJson;
const guidanceCoreJson = JSON.parse(
  api.serializeAgentGuidanceResult(guidance),
);
if (
  guidanceCli.status !== 0 ||
  guidanceCli.stderr !== "" ||
  guidanceContract !== 6 ||
  JSON.stringify(guidanceCliCore) !== JSON.stringify(guidanceCoreJson)
) process.exit(1);

const source = await readFile(process.argv[3], "utf8");
const project = api.getProjectMetadata(source);
if (
  !project.ok ||
  project.project?.id !== "MINIMAL" ||
  project.project?.velocity !== null
) process.exit(1);
const result = api.selectNextTasks(source);
if (!result.ok || result.recommendation === null) process.exit(1);
const json = api.recommendationAnalysisToJson(result.recommendation);
if (json.explanation_status?.complete !== true) process.exit(1);

const overrideSource = await readFile(process.argv[4], "utf8");
const overrideNext = api.selectNextTasks(overrideSource);
if (!overrideNext.ok || overrideNext.recommendation === null) process.exit(1);
const override = api.validateOverride(overrideNext, {
  sourceSchemaVersion: "Perttool.NextResult.v5",
  sourceDigest: overrideNext.recommendation.sourceDigest,
  sourceResultDecisionId: overrideNext.recommendation.resultDecision.id,
  selectedTaskIds: ["OPTIONAL_POLISH"],
  actor: {
    kind: "human",
    id: "package-check",
    authentication: "caller_asserted",
  },
  decidedAt: "2026-07-23T00:00:00Z",
  reasonCode: "human_priority_decision",
  reasonText: "Verify the installed read-only override API.",
  evidenceReferences: [],
  acknowledgedNegativeFactReasonIds: [],
});
const overrideJson = api.overrideValidationResultToJson(override);
if (
  !override.ok ||
  overrideJson.schema_version !== "Perttool.OverrideDecision.v1" ||
  !/^override:sha256:[0-9a-f]{64}$/.test(override.override.overrideId)
) process.exit(1);
NODE
printf 'release package check passed (%s)\n' "$actual_version"

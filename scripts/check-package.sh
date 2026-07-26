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
  package/dist/help/guide.js \
  package/dist/index.js \
  package/dist/index.d.ts
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
        result.cli_contract_version !== 4 ||
        result.operation !== "guide" ||
        JSON.stringify(topicIds) !== JSON.stringify([
          "syntax",
          "analysis",
          "next",
          "editing",
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
        result.cli_contract_version !== 4 ||
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
        result.schema_version !== "Perttool.ProjectResult.v2" ||
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
        result.schema_version !== "Perttool.MutationResult.v1" ||
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
        result.schema_version !== "Perttool.NextResult.v4" ||
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
installed_guide_module="$install_prefix/lib/node_modules/$package_name/dist/help/guide.js"
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
  index.cli_contract_version !== 4 ||
  index.operation !== "guide" ||
  index.topics?.length !== 8 ||
  !JSON.stringify(index).includes("Grammar versions 1, 2, and 3") ||
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
import { pathToFileURL } from "node:url";

const api = await import(pathToFileURL(process.argv[2]).href);
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
]) {
  if (targetName in api) process.exit(1);
}
for (const publicName of [
  "analyzeDocument",
  "selectNextTasks",
  "planUnitMigration",
  "withUnitMigrationWrite",
]) {
  if (typeof api[publicName] !== "function") process.exit(1);
}

const contract4Help = spawnSync(
  process.argv[5],
  ["help", "--format=json"],
  { encoding: "utf8" },
);
const contract4HelpJson = JSON.parse(contract4Help.stdout);
const serializedHelp = JSON.stringify(contract4HelpJson);
if (
  contract4Help.status !== 0 ||
  contract4Help.stderr !== "" ||
  contract4HelpJson.schema_version !== "Perttool.CommandHelpResult.v1" ||
  contract4HelpJson.cli_contract_version !== 4 ||
  contract4HelpJson.commands?.length !== 28 ||
  !serializedHelp.includes("project migrate-unit") ||
  !serializedHelp.includes('"not-before"') ||
  !serializedHelp.includes('"deadline"') ||
  !serializedHelp.includes("Perttool.CheckResult.v2") ||
  !serializedHelp.includes("Perttool.ProjectResult.v2") ||
  !serializedHelp.includes("Perttool.AnalysisResult.v3") ||
  !serializedHelp.includes("Perttool.NextResult.v4") ||
  !serializedHelp.includes("Perttool.UnitMigrationResult.v2")
) process.exit(1);

for (const [fixture, grammarVersion] of [
  [process.argv[6], 2],
  [process.argv[7], 3],
]) {
  for (const [route, schemaVersion] of [
    [["document", "check"], "Perttool.CheckResult.v2"],
    [["document", "format"], "Perttool.FormatResult.v1"],
    [["project", "show"], "Perttool.ProjectResult.v2"],
    [["dag", "analyze"], "Perttool.AnalysisResult.v3"],
    [["dag", "next"], "Perttool.NextResult.v4"],
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
      json.cli_contract_version !== 4 ||
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
  guidanceContract !== 4 ||
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
  sourceSchemaVersion: "Perttool.NextResult.v4",
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

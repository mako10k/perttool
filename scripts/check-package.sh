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
  package/dist/application/contract7-assurance.js \
  package/dist/application/contract7-mermaid.js \
  package/dist/application/target-historical-graph.js \
  package/dist/application/target-historical-graph.d.ts \
  package/dist/help/guide.js \
  package/dist/history/historical-graph.js \
  package/dist/history/historical-graph.d.ts \
  package/dist/core/index.js \
  package/dist/core/index.d.ts \
  package/dist/session/document-session.js \
  package/dist/session/document-session.d.ts \
  package/dist/index.js \
  package/dist/index.d.ts \
  package/dist/node/index.js \
  package/dist/node/index.d.ts \
  package/dist/node/historical-host.js \
  package/dist/node/historical-host.d.ts \
  package/schemas/Perttool.Common.v1.schema.json \
  package/schemas/Perttool.AdvanceResult.v4.schema.json \
  package/schemas/Perttool.PlanningMutationResult.v1.schema.json \
  package/schemas/Perttool.PlanningObservationRequest.v1.schema.json \
  package/schemas/Perttool.PlanningPoolResult.v1.schema.json \
  package/schemas/Perttool.PlanningReshapeRequest.v1.schema.json \
  package/schemas/Perttool.PlanningReshapePreflightResult.v1.schema.json \
  package/schemas/Perttool.WindowMutationRequest.v1.schema.json \
  package/schemas/Perttool.CheckResult.v6.schema.json \
  package/schemas/Perttool.HistoricalGraphResult.v1.schema.json \
  package/schemas/Perttool.PlanAssuranceResult.v2.schema.json \
  package/schemas/Perttool.SchemaResult.v1.schema.json \
  package/schemas/Perttool.OverrideDecision.v1.schema.json
do
  if ! grep -Fqx "$required" "$archive_list"; then
    printf 'release tarball is missing %s\n' "$required" >&2
    exit 1
  fi
done

if grep -Eq '^package/(adapters|src|test|docs|plans|scripts|\.github|\.codex)(/|$)|^package/AGENTS\.md$' "$archive_list"; then
  printf 'release tarball contains repository-only files\n' >&2
  exit 1
fi

install_prefix="$package_root/prefix"
npm install --global --prefix "$install_prefix" --ignore-scripts "$tarball" >/dev/null
installed_cli="$install_prefix/bin/perttool"
installed_schema_root="$install_prefix/lib/node_modules/$package_name/schemas"
if [[ ! -x "$installed_cli" ]]; then
  printf 'packed CLI is not executable: %s\n' "$installed_cli" >&2
  exit 1
fi
if [[ ! -d "$installed_schema_root" ]]; then
  printf 'packed schema directory is missing: %s\n' "$installed_schema_root" >&2
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
        result.cli_contract_version !== 10 ||
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
          "plan-assurance",
          "historical-dag",
          "milestone-acceptance",
          "temporal-schedule",
          "planning-pool",
        ]) ||
        /[\u3040-\u30ff\u4e00-\u9fff]/u.test(JSON.stringify(result))
      ) process.exit(1);
    });
  '
"$installed_cli" dag history "$repo_root/plans/historical-dag.pert" \
  --rev HEAD --base HEAD --history first-parent --view lineage --analysis none \
  --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      if (
        result.schema_version !== "Perttool.HistoricalGraphResult.v1" ||
        result.cli_contract_version !== 10 ||
        result.operation !== "dag.history" ||
        result.ok !== true ||
        result.status !== "complete" ||
        result.request?.ancestry_profile !== "first_parent" ||
        result.request?.view !== "lineage" ||
        result.lineage?.occurrences?.length < 2 ||
        result.source_bindings?.length < 1 ||
        result.diagnostics?.length !== 0
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
        result.cli_contract_version !== 10 ||
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
        result.cli_contract_version !== 10 ||
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
"$installed_cli" help work reshape preflight --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      if (
        result.ok !== true ||
        JSON.stringify(result.commands?.map(({ path }) => path)) !==
          JSON.stringify([["work", "reshape", "preflight"]])
      ) process.exit(1);
    });
  '
set +e
compound_help_json=$("$installed_cli" help work reshape --format=json)
compound_help_status=$?
set -e
if [[ "$compound_help_status" -ne 1 ]]; then
  printf 'packed incomplete compound Help did not return exit 1\n' >&2
  exit 1
fi
node -e '
  const result = JSON.parse(process.argv[1]);
  if (
    result.ok !== false ||
    result.diagnostics?.[0]?.code !== "PTHLP-003" ||
    JSON.stringify(result.diagnostics?.[0]?.data?.available_child_actions) !==
      JSON.stringify(["apply", "preflight"])
  ) process.exit(1);
' "$compound_help_json"
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
        result.schema_version !== "Perttool.ProjectResult.v5" ||
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
        result.schema_version !== "Perttool.MutationResult.v6" ||
        result.operation !== "project.set" ||
        !result.updated_text?.includes("  as_of 2026-07-23")
      ) process.exit(1);
    });
  '
"$installed_cli" milestone acceptance replace \
  "$repo_root/test/fixtures/grammar9-acceptance-before-pool.pert" \
  REVIEWED REVIEWED_R2 R2 \
  --criterion "PACKAGE2:required:test:Installed package replay after Pool preservation" \
  --actor codex \
  --format=json |
  node -e '
    const fs = require("node:fs");
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      const candidate = result.updated_text ?? "";
      const source = fs.readFileSync(process.argv[1], "utf8");
      const planningBlocks = (text) => [...text.matchAll(
        /^(?:work [A-Za-z][A-Za-z0-9_-]*:|event [A-Za-z][A-Za-z0-9_-]*:|activity [A-Za-z][A-Za-z0-9_-]* [A-Za-z][A-Za-z0-9_-]* -> [A-Za-z][A-Za-z0-9_-]*:|window [A-Za-z][A-Za-z0-9_-]*:|work_order:)\r?\n(?:^[ \t].*(?:\r?\n|$))*/gmu,
      )].map(([block]) => block);
      const applied = [...(result.edits ?? [])].reverse().reduce(
        (text, edit) => text.slice(0, edit.start_offset) + edit.replacement +
          text.slice(edit.end_offset), source,
      );
      if (
        result.schema_version !== "Perttool.MutationResult.v6" ||
        result.cli_contract_version !== 10 ||
        result.operation !== "milestone-acceptance.replace" ||
        result.ok !== true ||
        result.changed !== true ||
        result.write?.written !== false ||
        result.edits?.length !== 2 ||
        applied !== candidate ||
        JSON.stringify(planningBlocks(candidate)) !==
          JSON.stringify(planningBlocks(source)) ||
        !candidate.includes("  version 9") ||
        !candidate.includes("work W1:") ||
        !candidate.includes("activity DRAFT_ACTIVITY DRAFT_START -> DRAFT_END:") ||
        !candidate.includes("window SPRINT:") ||
        !candidate.includes("work_event BUILD_FINISH:") ||
        candidate.includes("milestone_criterion_set REVIEWED_R1:") ||
        candidate.includes("milestone_acceptance_receipt REVIEWED_WAIVED:") ||
        !candidate.includes("milestone_criterion_set REVIEWED_R2:")
      ) process.exit(1);
    });
  ' "$repo_root/test/fixtures/grammar9-acceptance-before-pool.pert"

denied_plan="$package_root/grammar9-denied.pert"
denied_json="$package_root/grammar9-denied.json"
cp "$repo_root/test/fixtures/grammar9-acceptance-before-pool.pert" "$denied_plan"
denied_digest=$(node -e '
  const fs = require("node:fs");
  const crypto = require("node:crypto");
  const source = fs.readFileSync(process.argv[1]);
  process.stdout.write(`sha256:${crypto.createHash("sha256").update(source).digest("hex")}`);
' "$denied_plan")
if "$installed_cli" milestone acceptance replace "$denied_plan" \
  REVIEWED REVIEWED_R2 R2 \
  --criterion "PACKAGE2:required:test:Denied installed package replay" \
  --actor wrong --write --expect-digest "$denied_digest" --format=json \
  >"$denied_json"; then
  printf 'installed denied milestone replacement unexpectedly succeeded\n' >&2
  exit 1
else
  denied_status=$?
  if [[ "$denied_status" -ne 1 ]]; then
    printf 'installed denied milestone replacement returned %s, expected 1\n' \
      "$denied_status" >&2
    exit 1
  fi
fi
node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const Ajv2020 = require("ajv/dist/2020").default;
  const source = fs.readFileSync(process.argv[1], "utf8");
  const original = fs.readFileSync(process.argv[2], "utf8");
  const result = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of fs.readdirSync(process.argv[4])) {
    if (name.endsWith(".schema.json")) {
      ajv.addSchema(JSON.parse(fs.readFileSync(
        path.join(process.argv[4], name), "utf8",
      )));
    }
  }
  const validate = ajv.getSchema(
    "https://github.com/mako10k/perttool/schemas/" +
      "Perttool.MutationResult.v6.schema.json",
  );
  const planningBlocks = (text) => [...text.matchAll(
    /^(?:work [A-Za-z][A-Za-z0-9_-]*:|event [A-Za-z][A-Za-z0-9_-]*:|activity [A-Za-z][A-Za-z0-9_-]* [A-Za-z][A-Za-z0-9_-]* -> [A-Za-z][A-Za-z0-9_-]*:|window [A-Za-z][A-Za-z0-9_-]*:|work_order:)\r?\n(?:^[ \t].*(?:\r?\n|$))*/gmu,
  )].map(([block]) => block);
  const candidate = result.updated_text ?? "";
  const applied = [...(result.edits ?? [])].reverse().reduce(
    (text, edit) => text.slice(0, edit.start_offset) + edit.replacement +
      text.slice(edit.end_offset), original,
  );
  if (
    source !== original ||
    result.schema_version !== "Perttool.MutationResult.v6" ||
    result.cli_contract_version !== 10 ||
    result.operation !== "milestone-acceptance.replace" ||
    result.ok !== false ||
    result.changed !== true ||
    result.write?.written !== false ||
    result.edits?.length !== 2 ||
    !result.diagnostics?.some(({ code }) => code === "PTGOV-101") ||
    result.governance?.source_digest !== result.source_digest ||
    !candidate.includes("  version 9") ||
    applied !== candidate ||
    JSON.stringify(planningBlocks(candidate)) !==
      JSON.stringify(planningBlocks(original)) ||
    candidate.includes("milestone_criterion_set REVIEWED_R1:") ||
    candidate.includes("milestone_acceptance_receipt REVIEWED_WAIVED:") ||
    !candidate.includes("milestone_criterion_set REVIEWED_R2:") ||
    !candidate.includes(
      "criterion PACKAGE2 required test \"Denied installed package replay\"",
    ) ||
    typeof validate !== "function" ||
    validate(result) !== true
  ) process.exit(1);
' "$denied_plan" \
  "$repo_root/test/fixtures/grammar9-acceptance-before-pool.pert" "$denied_json" \
  "$installed_schema_root"
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
        result.schema_version !== "Perttool.NextResult.v8" ||
        result.recommendation_interface_version !== 1 ||
        result.recommendation?.explanation_status?.complete !== true ||
        result.temporal?.authority?.policy !==
          "recommendation_v1_plus_release_gate_plus_plan_assurance_v1" ||
        !Array.isArray(result.temporal?.authority?.assurance_eligible_task_ids)
      ) process.exit(1);
    });
  '
"$installed_cli" dag render "$repo_root/docs/examples/minimal.pert" --to mermaid --format=json >/dev/null
node scripts/check-package-file-first.mjs \
  "$installed_cli" \
  "$package_root/file-first-workflow"
node scripts/check-package-assurance.mjs \
  "$installed_cli" \
  "$package_root/assurance-workflow" \
  "$repo_root/docs/examples/minimal.pert"
node scripts/check-advance-clean-candidate.mjs \
  "$installed_cli" \
  "$package_root/advance-clean-candidate-workflow" >/dev/null
node scripts/check-package-actuals.mjs \
  "$installed_cli" \
  "$package_root/actuals-workflow" \
  "$repo_root/test/fixtures/project-actuals-v5.pert"
installed_package_root="$install_prefix/lib/node_modules/$package_name"
(
  cd "$installed_package_root"
  node --input-type=module - \
    "$repo_root/docs/examples/minimal.pert" <<'NODE'
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as core from "perttool/core";
import * as nodeApi from "perttool/node";
import * as root from "perttool";

const source = await readFile(process.argv[2], "utf8");
const parsed = core.parseDocument(source);
const formatted = core.formatDocument(source);
const snapshot = core.createDocumentSnapshot(
  {
    uri: "file:///installed/minimal.pert",
    generation: "installed-1",
    version: 1,
    text: source,
  },
  {
    digestText: (text) =>
      `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`,
  },
);
if (
  Object.keys(root).length !== 139 ||
  Object.keys(nodeApi).length !== 139 ||
  Object.keys(core).length !== 51 ||
  !Object.keys(root).every((name) =>
    ["analyzeDocument", "checkDocument", "selectNextTasks"].includes(name) ||
    root[name] === nodeApi[name]
  ) ||
  typeof root.createNodeHost !== "function" ||
  root.createNodeHost !== nodeApi.createNodeHost ||
  "createNodeHost" in core ||
  root.parseDocument !== core.parseDocument ||
  root.validateDocument !== core.validateDocument ||
  root.formatDocument !== core.formatDocument ||
  parsed.diagnostics.length !== 0 ||
  core
    .validateDocument(parsed.document, parsed.diagnostics)
    .some(({ severity }) => severity === "error") ||
  formatted.ok !== true ||
  formatted.formattedText !== source ||
  snapshot.semantic.ok !== true ||
  core.analyzeDocumentSnapshot(snapshot, { mode: "both" }).complete !== true ||
  core.getGuide(null, "index").ok !== true
) process.exit(1);
NODE
)
installed_guide_module="$install_prefix/lib/node_modules/$package_name/dist/index.js"
node --input-type=module - "$installed_guide_module" <<'NODE'
import { pathToFileURL } from "node:url";

const guide = await import(pathToFileURL(process.argv[2]).href);
const index = JSON.parse(guide.serializeGuideResult(
  guide.getGuide(null, "index"),
));
const text = guide.renderGuideResult(guide.getGuide("syntax", "quick"));
const temporal = guide.getGuide("syntax.temporal", "detail");
const actuals = guide.getGuide("actuals", "detail");
const editing = guide.getGuide("editing", "detail");
const planningPool = guide.getGuide("planning-pool", "detail");
const missing = guide.guideResultToJson(guide.getGuide("missing", "detail"));
const expectedTemporalSyntax = [
  "project ID:",
  "  version 2|3|4|5|6|7",
  "  as_of DATE|OFFSET_DATE_TIME",
  "milestone ID:",
  "  deadline DATE|OFFSET_DATE_TIME",
  "task ID FROM -> TO:",
  "  not_before DATE|OFFSET_DATE_TIME",
  "  deadline DATE|OFFSET_DATE_TIME",
  "project ID:",
  "  version 8|9",
  "  time_zone STRING",
  "  tzdb STRING",
  "  calendar ID",
  "  workday DURATION",
  "calendar ID:",
  "  mon 09:00..12:00, 13:00..17:00",
  "milestone ID:",
  "  when reach earliest|latest OFFSET_DATE_TIME",
  "task ID FROM -> TO:",
  "  when start|finish earliest|latest OFFSET_DATE_TIME",
];
if (
  index.schema_version !== "Perttool.GuideResult.v1" ||
  index.cli_contract_version !== 10 ||
  index.operation !== "guide" ||
  index.topics?.length !== 14 ||
  !JSON.stringify(index).includes("Grammar versions 1 through 9") ||
  !text.startsWith("DSL syntax\n") ||
  JSON.stringify(temporal.syntax) !== JSON.stringify(expectedTemporalSyntax) ||
  !temporal.related.includes("temporal-schedule") ||
  !actuals.sections.some(({ body }) =>
    body.includes("Grammars 6 through 9 retain them unchanged")
  ) ||
  !actuals.sections.some(({ body }) => body.includes("Grammar 5 through 9")) ||
  !editing.sections.some(({ body }) =>
    body.includes("current Contract 10 candidate")
  ) ||
  !planningPool.sections.some(({ body }) =>
    body.includes("Remaining Work is advisory planning retention and does not block project.finish")
  ) ||
  !planningPool.sections.some(({ body }) =>
    body.includes("explicit governed strict-DAG candidate") &&
    body.includes("Goal Obligation, Goal Coverage, and Goal Seal")
  ) ||
  !planningPool.sections.some(({ body }) =>
    body.includes("accept the Final Milestone") &&
    body.includes("retaining Work named Add offline export")
  ) ||
  !planningPool.sections.some(({ body }) =>
    body.includes("reverse Work associations") &&
    body.includes("Activity endpoints") &&
    body.includes("source spans")
  ) ||
  !planningPool.related.includes("milestone-acceptance") ||
  missing.diagnostics?.[0]?.help_topic !== null ||
  missing.diagnostics?.[0]?.guide_topic !== "syntax"
) process.exit(1);
NODE
"$installed_cli" event show \
  "$repo_root/test/fixtures/issue-34-planning-entities.pert" READY \
  --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      const event = result.events?.[0];
      if (
        result.schema_version !== "Perttool.PlanningPoolResult.v1" ||
        result.operation !== "event.show" ||
        event?.qualified_id !== "ENTITY_INSPECTION::READY" ||
        event?.span?.start?.offset === undefined ||
        result.works?.length !== 2
      ) process.exit(1);
    });
  '
"$installed_cli" activity show \
  "$repo_root/test/fixtures/issue-34-planning-entities.pert" \
  ENTITY_INSPECTION::REVIEW --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      const activity = result.activities?.[0];
      if (
        result.operation !== "activity.show" ||
        activity?.from?.qualified_id !== "ENTITY_INSPECTION::READY" ||
        activity?.to?.qualified_id !== "ENTITY_INSPECTION::ACCEPTED" ||
        activity?.estimate?.most_likely?.source_text !== "3p" ||
        result.works?.length !== 2
      ) process.exit(1);
    });
  '
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
  "perttool/schemas/Perttool.NextResult.v8.schema.json",
);
const exportedSchema = JSON.parse(readFileSync(exportedSchemaPath, "utf8"));
const exportedAdvanceSchemaPath = require.resolve(
  "perttool/schemas/Perttool.AdvanceResult.v4.schema.json",
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
  if (targetName in api) throw new Error(`private export leaked: ${targetName}`);
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
  "inspectPlanAssurance",
  "planAssuranceMutation",
]) {
  if (typeof api[publicName] !== "function") throw new Error(`public export missing: ${publicName}`);
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
  contract5HelpJson.cli_contract_version !== 10 ||
  contract5HelpJson.commands?.length !== 71 ||
  !serializedHelp.includes("Perttool.SchemaResult.v1") ||
  !serializedHelp.includes("project migrate-unit") ||
  !serializedHelp.includes('"not-before"') ||
  !serializedHelp.includes('"deadline"') ||
  !serializedHelp.includes("Perttool.CheckResult.v6") ||
  !serializedHelp.includes("Perttool.ProjectResult.v5") ||
  !serializedHelp.includes("Perttool.MutationResult.v6") ||
  !serializedHelp.includes("Perttool.AdvanceResult.v4") ||
  !serializedHelp.includes('"force-history-loss"') ||
  !serializedHelp.includes("Perttool.AnalysisResult.v7") ||
  !serializedHelp.includes("Perttool.NextResult.v8") ||
  !serializedHelp.includes("Perttool.PlanAssuranceResult.v2") ||
  !serializedHelp.includes("Perttool.UnitMigrationResult.v5") ||
  !serializedHelp.includes('"actor"') ||
  !serializedHelp.includes('"accepted-by-owner"') ||
  !serializedHelp.includes('"goal-owner"')
) throw new Error("installed command help contract mismatch");

const schemaCatalog = spawnSync(
  process.argv[5],
  ["schema", "--format=json"],
  { encoding: "utf8" },
);
const schemaCatalogJson = JSON.parse(schemaCatalog.stdout);
const selectedSchema = spawnSync(
  process.argv[5],
  ["schema", "Perttool.NextResult.v8", "--format=json"],
  { encoding: "utf8" },
);
const selectedSchemaJson = JSON.parse(selectedSchema.stdout);
const selectedAdvanceSchema = spawnSync(
  process.argv[5],
  ["schema", "Perttool.AdvanceResult.v4", "--format=json"],
  { encoding: "utf8" },
);
const selectedAdvanceSchemaJson = JSON.parse(
  selectedAdvanceSchema.stdout,
);
const selectedAssuranceSchema = spawnSync(
  process.argv[5],
  ["schema", "Perttool.PlanAssuranceResult.v2", "--format=json"],
  { encoding: "utf8" },
);
const selectedAssuranceSchemaJson = JSON.parse(
  selectedAssuranceSchema.stdout,
);
const selectedRequestSchemas = [
  "Perttool.PlanningObservationRequest.v1",
  "Perttool.PlanningReshapeRequest.v1",
  "Perttool.WindowMutationRequest.v1",
].map((schemaId) => {
  const result = spawnSync(
    process.argv[5],
    ["schema", schemaId, "--format=json"],
    { encoding: "utf8" },
  );
  return { schemaId, result, json: JSON.parse(result.stdout) };
});
const outlineSchema = spawnSync(
  process.argv[5],
  [
    "schema",
    "Perttool.NextResult.v8",
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
    "Perttool.NextResult.v8",
    "--view=outline",
    "--ref=#/$defs/recommendation",
    "--format=json",
  ],
  { encoding: "utf8" },
);
const detailSchemaJson = JSON.parse(detailSchema.stdout);
const apiOutline = api.jsonSchemaResultToJson(
  api.getJsonSchemaResult(
    "Perttool.NextResult.v8",
    { view: "outline" },
  ),
);
if (
  schemaCatalog.status !== 0 ||
  schemaCatalog.stderr !== "" ||
  schemaCatalogJson.schema_version !== "Perttool.SchemaResult.v1" ||
  schemaCatalogJson.schemas?.length !== 29 ||
  schemaCatalogJson.schema !== null ||
  selectedSchema.status !== 0 ||
  selectedSchema.stderr !== "" ||
  selectedSchemaJson.schema?.$schema !==
    "https://json-schema.org/draft/2020-12/schema" ||
  selectedSchemaJson.schema?.$id !==
    "https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v8.schema.json" ||
  selectedAdvanceSchema.status !== 0 ||
  selectedAdvanceSchema.stderr !== "" ||
  selectedAdvanceSchemaJson.schema?.$id !==
    "https://github.com/mako10k/perttool/schemas/Perttool.AdvanceResult.v4.schema.json" ||
  selectedAdvanceSchemaJson.schema?.properties?.history_guard === undefined ||
  selectedAdvanceSchemaJson.schema?.properties?.assurance_guard === undefined ||
  selectedAssuranceSchema.status !== 0 ||
  selectedAssuranceSchema.stderr !== "" ||
  selectedAssuranceSchemaJson.schema?.$id !==
    "https://github.com/mako10k/perttool/schemas/Perttool.PlanAssuranceResult.v2.schema.json" ||
  selectedRequestSchemas.some(({ schemaId, result, json }) =>
    result.status !== 0 ||
    result.stderr !== "" ||
    json.schema?.$id !==
      `https://github.com/mako10k/perttool/schemas/${schemaId}.schema.json` ||
    api.getJsonSchema(schemaId)?.$id !== json.schema.$id
  ) ||
  outlineSchema.status !== 0 ||
  outlineSchema.stderr !== "" ||
  outlineSchemaJson.query?.view !== "outline" ||
  Object.hasOwn(outlineSchemaJson.schema ?? {}, "$defs") ||
  outlineSchemaJson.schema?.properties?.groups?.$ref !==
    "https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v8.schema.json#/properties/groups" ||
  detailSchema.status !== 0 ||
  detailSchema.stderr !== "" ||
  detailSchemaJson.schema?.properties?.result_decision === undefined ||
  JSON.stringify(apiOutline) !== JSON.stringify(outlineSchemaJson) ||
  api.getJsonSchemaCatalog().length !== 29 ||
  api.getJsonSchema("Perttool.NextResult.v8")?.$id !==
    selectedSchemaJson.schema.$id ||
  api.getJsonSchema("Perttool.AdvanceResult.v4")?.$id !==
    selectedAdvanceSchemaJson.schema.$id ||
  api.ADVANCE_RESULT_SCHEMA_VERSION !== "Perttool.AdvanceResult.v4" ||
  exportedSchema.$id !== selectedSchemaJson.schema.$id ||
  exportedAdvanceSchema.$id !== selectedAdvanceSchemaJson.schema.$id
) throw new Error("installed schema contract mismatch");

for (const [fixture, grammarVersion] of [
  [process.argv[6], 2],
  [process.argv[7], 3],
]) {
  for (const [route, schemaVersion] of [
    [["document", "check"], "Perttool.CheckResult.v6"],
    [["document", "format"], "Perttool.FormatResult.v1"],
    [["project", "show"], "Perttool.ProjectResult.v5"],
    [["dag", "analyze"], "Perttool.AnalysisResult.v7"],
    [["dag", "next"], "Perttool.NextResult.v8"],
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
      json.cli_contract_version !== 10 ||
      json.ok !== true ||
      (route[1] === "format"
        ? "grammar_version" in json
        : json.grammar_version !== grammarVersion) ||
      json.diagnostics?.some(({ severity }) => severity === "error")
    ) throw new Error(`installed compatibility route mismatch: ${route.join(" ")}`);
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
  guidanceContract !== 10 ||
  JSON.stringify(guidanceCliCore) !== JSON.stringify(guidanceCoreJson)
) throw new Error("installed agent guidance mismatch");

const source = await readFile(process.argv[3], "utf8");
const project = api.getProjectMetadata(source);
if (
  !project.ok ||
  project.project?.id !== "MINIMAL" ||
  project.project?.velocity !== null
) throw new Error("installed project metadata mismatch");
const result = api.selectNextTasks(source);
if (!result.ok || result.recommendation === null) throw new Error("installed recommendation unavailable");
const json = api.recommendationAnalysisToJson(result.recommendation);
if (json.explanation_status?.complete !== true) throw new Error("installed recommendation explanation incomplete");

const overrideSource = await readFile(process.argv[4], "utf8");
const overrideNext = api.selectNextTasks(overrideSource);
if (!overrideNext.ok || overrideNext.recommendation === null) throw new Error("installed override basis unavailable");
const override = api.validateOverride(overrideNext, {
  sourceSchemaVersion: "Perttool.NextResult.v8",
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
) throw new Error("installed override contract mismatch");
NODE
printf 'release package check passed (%s)\n' "$actual_version"

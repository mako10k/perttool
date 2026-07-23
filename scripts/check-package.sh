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

"$installed_cli" dsl check "$repo_root/docs/examples/minimal.pert" --format=json >/dev/null
"$installed_cli" dag next "$repo_root/docs/examples/minimal.pert" --format=json |
  node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const result = JSON.parse(input);
      if (
        result.schema_version !== "Perttool.NextResult.v3" ||
        result.recommendation_interface_version !== 1 ||
        result.recommendation?.explanation_status?.complete !== true
      ) process.exit(1);
    });
  '
"$installed_cli" dag render "$repo_root/docs/examples/minimal.pert" --to mermaid --format=json >/dev/null
installed_module="$install_prefix/lib/node_modules/$package_name/dist/index.js"
node --input-type=module - \
  "$installed_module" \
  "$repo_root/docs/examples/minimal.pert" \
  "$repo_root/test/fixtures/recommendation/rec-001-critical-priority.pert" <<'NODE'
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const api = await import(pathToFileURL(process.argv[2]).href);
const source = await readFile(process.argv[3], "utf8");
const result = api.selectNextTasks(source);
if (!result.ok || result.recommendation === null) process.exit(1);
const json = api.recommendationAnalysisToJson(result.recommendation);
if (json.explanation_status?.complete !== true) process.exit(1);

const overrideSource = await readFile(process.argv[4], "utf8");
const overrideNext = api.selectNextTasks(overrideSource);
if (!overrideNext.ok || overrideNext.recommendation === null) process.exit(1);
const override = api.validateOverride(overrideNext, {
  sourceSchemaVersion: "Perttool.NextResult.v3",
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

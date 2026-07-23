#!/usr/bin/env bash

set -euo pipefail

usage() {
  printf 'Usage: bash scripts/publish-npm.sh --dry-run [TARBALL]\n' >&2
  printf '       bash scripts/publish-npm.sh --publish TARBALL\n' >&2
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 2
fi

mode=$1
package_spec=${2:-.}
case "$mode" in
  --dry-run) ;;
  --publish)
    if [[ "$package_spec" == "." ]]; then
      printf '%s requires an explicit release tarball\n' "$mode" >&2
      exit 2
    fi
    ;;
  *)
    usage
    exit 2
    ;;
esac

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

temporary_root=${TMPDIR:-/tmp}
inspection_root=$(mktemp -d "$temporary_root/perttool-npm-publish.XXXXXX")
case "$inspection_root" in
  "$temporary_root"/perttool-npm-publish.*) ;;
  *)
    printf 'unsafe temporary publish root: %s\n' "$inspection_root" >&2
    exit 1
    ;;
esac
trap 'rm -rf -- "$inspection_root"' EXIT

if [[ "$package_spec" == "." ]]; then
  manifest_path="$repo_root/package.json"
else
  if [[ ! -f "$package_spec" ]]; then
    printf 'release tarball does not exist: %s\n' "$package_spec" >&2
    exit 1
  fi
  manifest_path="$inspection_root/package.json"
  if ! tar -xOf "$package_spec" package/package.json >"$manifest_path"; then
    printf 'release tarball has no readable package/package.json: %s\n' "$package_spec" >&2
    exit 1
  fi
fi

package_name=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).name' "$manifest_path")
package_version=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).version' "$manifest_path")
package_bin=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).bin?.perttool ?? ""' "$manifest_path")
publish_access=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).publishConfig?.access ?? ""' "$manifest_path")
publish_registry=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).publishConfig?.registry ?? ""' "$manifest_path")
publish_tag=$(node -p 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).publishConfig?.tag ?? ""' "$manifest_path")

if [[ "$package_name" != "perttool" ]]; then
  printf 'unexpected package name: %s\n' "$package_name" >&2
  exit 1
fi
if [[ "$package_bin" != "dist/cli.js" ]]; then
  printf 'publishable CLI bin must be dist/cli.js, got %s\n' "$package_bin" >&2
  exit 1
fi
if [[ "$publish_access" != "public" || "$publish_registry" != "https://registry.npmjs.org/" ]]; then
  printf 'publishConfig must pin public access and the npmjs registry\n' >&2
  exit 1
fi
case "$publish_tag" in
  alpha)
    if [[ "$package_version" != *-* ]]; then
      printf 'alpha publication requires a prerelease version: %s\n' "$package_version" >&2
      exit 1
    fi
    ;;
  beta)
    if [[ ! "$package_version" =~ ^0\.[0-9]+\.[0-9]+$ ]]; then
      printf 'beta publication requires a suffix-free 0.x.x version: %s\n' "$package_version" >&2
      exit 1
    fi
    ;;
  *)
    printf 'unsupported publishConfig tag: %s\n' "$publish_tag" >&2
    exit 1
    ;;
esac

publish_output="$inspection_root/npm-publish-output.txt"
if [[ "$mode" == "--dry-run" ]]; then
  # --force is confined to dry-run so normalization remains repeatable after
  # this exact version exists in the registry. Actual publication never uses it.
  if ! npm publish "$package_spec" --dry-run --force --tag "$publish_tag" --access public --json >"$publish_output" 2>&1; then
    cat "$publish_output" >&2
    exit 1
  fi
  if grep -Eq 'auto-corrected|invalid and removed' "$publish_output"; then
    cat "$publish_output" >&2
    printf 'npm changed the package manifest during publish normalization\n' >&2
    exit 1
  fi
  printf 'npm publish dry-run passed (%s@%s, tag %s)\n' \
    "$package_name" "$package_version" "$publish_tag"
  exit 0
fi

if [[ -n $(git status --porcelain --untracked-files=all) ]]; then
  printf 'refusing npm publish from a dirty worktree\n' >&2
  exit 1
fi

local_name=$(node -p 'require("./package.json").name')
local_version=$(node -p 'require("./package.json").version')
if [[ "$package_name" != "$local_name" || "$package_version" != "$local_version" ]]; then
  printf 'tarball identity does not match the checkout: %s@%s != %s@%s\n' \
    "$package_name" "$package_version" "$local_name" "$local_version" >&2
  exit 1
fi

release_tag="v$package_version"
head_commit=$(git rev-parse HEAD)
if ! tag_commit=$(git rev-parse --verify "refs/tags/$release_tag^{commit}" 2>/dev/null); then
  printf 'release tag does not exist: %s\n' "$release_tag" >&2
  exit 1
fi
if [[ "$tag_commit" != "$head_commit" ]]; then
  printf 'release tag %s does not point to HEAD\n' "$release_tag" >&2
  exit 1
fi

remote_main=$(git ls-remote origin refs/heads/main | awk 'NR == 1 { print $1 }')
remote_tag=$(git ls-remote origin "refs/tags/$release_tag^{}" | awk 'NR == 1 { print $1 }')
if [[ "$remote_main" != "$head_commit" ]]; then
  printf 'origin/main does not point to the release commit\n' >&2
  exit 1
fi
if [[ "$remote_tag" != "$head_commit" ]]; then
  printf 'the remote annotated tag %s does not point to the release commit\n' "$release_tag" >&2
  exit 1
fi

if [[ -z ${NPM_TOKEN:-} ]]; then
  printf 'NPM_TOKEN must be injected for --publish\n' >&2
  exit 1
fi

npm_userconfig="$inspection_root/npmrc"
umask 077
# shellcheck disable=SC2016 # npm expands the literal environment placeholder.
printf '%s\n' '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' >"$npm_userconfig"
npm_identity=$(npm whoami --userconfig="$npm_userconfig")
printf 'npm identity: %s\n' "$npm_identity"

dist_tags_before_path="$inspection_root/dist-tags-before.json"
dist_tags_before_error="$inspection_root/dist-tags-before-error.txt"
if npm view "$package_name" dist-tags --json --userconfig="$npm_userconfig" \
  >"$dist_tags_before_path" 2>"$dist_tags_before_error"; then
  latest_before=$(node -p \
    'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).latest ?? ""' \
    "$dist_tags_before_path")
elif grep -Fq 'E404' "$dist_tags_before_error"; then
  latest_before=""
else
  cat "$dist_tags_before_error" >&2
  printf 'could not read the pre-publish dist-tags for %s\n' "$package_name" >&2
  exit 1
fi

version_lookup="$inspection_root/version-lookup.txt"
if npm view "$package_name@$package_version" version --json --userconfig="$npm_userconfig" >"$version_lookup" 2>&1; then
  printf 'refusing to republish existing version %s@%s\n' "$package_name" "$package_version" >&2
  exit 1
fi
if ! grep -Fq 'E404' "$version_lookup"; then
  cat "$version_lookup" >&2
  printf 'could not establish that the release version is unpublished\n' >&2
  exit 1
fi

npm publish "$package_spec" --tag "$publish_tag" --access public --userconfig="$npm_userconfig"
published_version=""
publish_verification_error="$inspection_root/publish-verification-error.txt"
for attempt in 1 2 3 4 5; do
  if published_version=$(npm view "$package_name@$package_version" version --json \
    --userconfig="$npm_userconfig" 2>"$publish_verification_error"); then
    break
  fi
  if ! grep -Fq 'E404' "$publish_verification_error"; then
    cat "$publish_verification_error" >&2
    printf 'published version verification failed without an E404 propagation response\n' >&2
    exit 1
  fi
  if [[ "$attempt" -lt 5 ]]; then
    sleep 2
  fi
done
if [[ "$published_version" != "\"$package_version\"" ]]; then
  cat "$publish_verification_error" >&2
  printf 'published version verification did not become durable: %s\n' "$published_version" >&2
  exit 1
fi

dist_tags_after_path="$inspection_root/dist-tags-after.json"
npm view "$package_name" dist-tags --json --userconfig="$npm_userconfig" >"$dist_tags_after_path"
published_tag_after=$(node -p \
  'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))[process.argv[2]] ?? ""' \
  "$dist_tags_after_path" "$publish_tag")
latest_after=$(node -p \
  'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).latest ?? ""' \
  "$dist_tags_after_path")
if [[ "$published_tag_after" != "$package_version" ]]; then
  printf '%s dist-tag verification failed: expected %s, got %s\n' \
    "$publish_tag" "$package_version" "$published_tag_after" >&2
  exit 1
fi
if [[ -n "$latest_before" && "$latest_after" != "$latest_before" ]]; then
  printf 'publish changed the existing latest dist-tag: %s -> %s\n' \
    "$latest_before" "$latest_after" >&2
  exit 1
fi
if [[ -z "$latest_before" && "$latest_after" == "$package_version" ]]; then
  printf 'registry created the required initial latest dist-tag at %s\n' "$package_version"
fi
printf 'published and verified %s@%s with dist-tag %s\n' \
  "$package_name" "$package_version" "$publish_tag"

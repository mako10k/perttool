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
if [[ "$package_version" != *-* ]]; then
  printf 'npm publication is limited to a prerelease version: %s\n' "$package_version" >&2
  exit 1
fi
if [[ "$package_bin" != "dist/cli.js" ]]; then
  printf 'publishable CLI bin must be dist/cli.js, got %s\n' "$package_bin" >&2
  exit 1
fi
if [[ "$publish_access" != "public" || "$publish_registry" != "https://registry.npmjs.org/" || "$publish_tag" != "alpha" ]]; then
  printf 'publishConfig must pin public access, the npmjs registry, and the alpha tag\n' >&2
  exit 1
fi

publish_output="$inspection_root/npm-publish-output.txt"
if [[ "$mode" == "--dry-run" ]]; then
  if ! npm publish "$package_spec" --dry-run --tag alpha --access public --json >"$publish_output" 2>&1; then
    cat "$publish_output" >&2
    exit 1
  fi
  if grep -Eq 'auto-corrected|invalid and removed' "$publish_output"; then
    cat "$publish_output" >&2
    printf 'npm changed the package manifest during publish normalization\n' >&2
    exit 1
  fi
  printf 'npm publish dry-run passed (%s@%s, tag alpha)\n' "$package_name" "$package_version"
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

npm publish "$package_spec" --tag alpha --access public --userconfig="$npm_userconfig"
published_version=$(npm view "$package_name@$package_version" version --json --userconfig="$npm_userconfig")
if [[ "$published_version" != "\"$package_version\"" ]]; then
  printf 'published version verification failed: %s\n' "$published_version" >&2
  exit 1
fi
printf 'published and verified %s@%s with dist-tag alpha\n' "$package_name" "$package_version"

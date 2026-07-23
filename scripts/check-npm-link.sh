#!/usr/bin/env bash

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

temporary_root=${TMPDIR:-/tmp}
link_prefix=$(mktemp -d "$temporary_root/perttool-npm-link.XXXXXX")
case "$link_prefix" in
  "$temporary_root"/perttool-npm-link.*) ;;
  *)
    printf 'unsafe temporary npm prefix: %s\n' "$link_prefix" >&2
    exit 1
    ;;
esac
trap 'rm -rf -- "$link_prefix"' EXIT

npm_config_prefix=$link_prefix npm link --foreground-scripts

linked_cli=$link_prefix/bin/perttool
if [[ ! -x "$linked_cli" ]]; then
  printf 'linked CLI is not executable: %s\n' "$linked_cli" >&2
  exit 1
fi

expected_version=$(node -p '"perttool " + require("./package.json").version')
actual_version=$("$linked_cli" --version)
if [[ "$actual_version" != "$expected_version" ]]; then
  printf 'linked CLI version mismatch: expected %s, got %s\n' \
    "$expected_version" "$actual_version" >&2
  exit 1
fi

(
  cd "$link_prefix"
  "$linked_cli" dsl check "$repo_root/docs/examples/minimal.pert" --format=json >/dev/null
  "$linked_cli" project show "$repo_root/docs/examples/minimal.pert" --format=json >/dev/null
  "$linked_cli" agent help codex instruction --format=json >/dev/null
  "$linked_cli" dag render "$repo_root/docs/examples/minimal.pert" --to mermaid --format=json >/dev/null
)

printf 'npm link check passed (%s)\n' "$actual_version"

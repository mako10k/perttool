#!/usr/bin/env bash

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

plans=(plans/grammar.pert plans/mvp.pert)
for plan in "${plans[@]}"; do
  node dist/cli.js dsl check "$plan" --format=json >/dev/null
  node dist/cli.js dag analyze "$plan" --format=json >/dev/null
  node dist/cli.js dag next "$plan" --format=json >/dev/null
done

printf 'read-only self-use checks passed (2 plans; check, analyze, next)\n'

#!/usr/bin/env bash

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

node dist/cli.js dsl check plans/grammar.pert --format=json >/dev/null
node dist/cli.js dag analyze plans/grammar.pert --format=json >/dev/null
node dist/cli.js dag next plans/grammar.pert --format=json >/dev/null

printf 'read-only self-use checks passed (check, analyze, next)\n'

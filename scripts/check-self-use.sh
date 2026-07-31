#!/usr/bin/env bash

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

plans=(plans/advance-clean-candidate.pert plans/advance-history-safety.pert plans/agent-guidance.pert plans/cli-surface-reset.pert plans/control-plane.pert plans/english-baseline.pert plans/grammar.pert plans/governance.pert plans/operations.pert plans/project-actuals.pert plans/recommendation.pert plans/release-0.2.0.pert plans/release-0.3.0.pert plans/release-0.4.0.pert plans/release-0.5.0.pert plans/release-0.5.1.pert plans/release-0.5.2.pert plans/release-0.5.3.pert plans/release-0.5.4.pert plans/release-0.5.5.pert plans/release-0.6.0.pert plans/scheduling-units-m1.pert plans/scheduling-units-m2.pert plans/scheduling-units-m2r.pert plans/scheduling-units-m3.pert plans/scheduling-units-m4.pert plans/scheduling-units-m5.pert plans/scheduling-units.pert plans/mvp.pert)
for plan in "${plans[@]}"; do
  node dist/cli.js document check "$plan" --format=json >/dev/null
  node dist/cli.js dag analyze "$plan" --format=json >/dev/null
  node dist/cli.js dag next "$plan" --format=json >/dev/null
done

printf 'read-only self-use checks passed (29 plans; check, analyze, next)\n'

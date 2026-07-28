# Project Actuals History Reconstruction Acceptance

## Decision

`PROJECT_HISTORY` is accepted as an internal pure semantic history boundary.
It reconstructs explicit task work events and qualified legacy Git-recorded
state transitions from the read-only first-parent probe, and projects exact
task-actual summaries without activating Grammar 5 or CLI Contract 6.

Git commit `c0eff39` records the exact completed 6p pre-advance snapshot.

This acceptance is subordinate to ADR 0006, the Project Actuals and Git
History Contract, the Grammar 5 target, and PACT-008 through PACT-012. It does
not revise explicit event time, Git provenance, coverage, or availability
semantics.

## Accepted implementation

| Concern | Accepted behavior |
| --- | --- |
| Composition | The internal file service composes the existing repository/path/revision probe with one pure reducer. It does not write the source, index, refs, worktree, or repository configuration. |
| Snapshot input | Supported Grammar 1 through 5 source bytes and deletion snapshots are reduced in first-parent commit order with repository, path, revision, source-digest, and recorded-time provenance retained. |
| Declared actual | Stable event IDs are deduplicated across snapshots. The last payload, first and last visible commits, and removal commit survive advance removal. Reusing one ID for another payload fails unavailable with `PTHIS-103`. |
| Legacy evidence | Eventless task-state changes may produce `git_recorded_transition` records with commit and recorded-time provenance. They never acquire an actual `occurred_at` value and never become declared actuals. |
| Task summaries | Complete, open, finish-only, unrecorded, and unavailable coverage preserves exact start/finish values, suspension intervals, cycle and active time, explicit active-time and effort measurements, and a qualified start- or finish-snapshot planned baseline. |
| Availability | Shallow, rename, unsupported-grammar, and task-identity boundaries cut semantic continuity and produce typed incomplete results. Missing or racing repository inputs and conflicting event payloads fail unavailable. |
| Projection | The internal target returns deterministic `Perttool.ProjectHistoryResult.v1` JSON and text with stable task and event order, exact quantities, causes, qualifiers, and diagnostics. |
| Compatibility | The standard package root, active Grammar 1 through 4, CLI Contract 5, command discovery, help, schemas, and installed workflow remain unchanged. |

## Verification

The completed pre-advance snapshot passed:

```sh
npm run typecheck
node --test --test-concurrency=1 --test-reporter=spec \
  test/project-actuals-history.test.mjs \
  test/project-actuals-git-history-probe.test.mjs \
  test/project-actuals-finish.test.mjs \
  test/project-actuals-source-core.test.mjs
node --test --test-concurrency=4 test/*.test.mjs
npm run check:docs
npm run check:self-use
npm run check:link
npm run check:package
git diff --check
```

Focused tests cover explicit-event reconstruction, snapshot deduplication,
advance removal, payload conflict, exact complete and finish-only summaries,
legacy recorded transitions, duplicate task selection, shallow history,
task-identity replacement, unsupported grammar, and absence from the active
public package root.

## Retained boundaries

This slice does not implement start, suspend, or resume mutation; suspended
resource and public result behavior; velocity observation; Grammar 5 or CLI
Contract 6 activation; public commands, help, schemas, or root exports; Git
mutation; automatic velocity adoption; durable authorization audit; MIG-08;
release publication; or dist-tag movement.

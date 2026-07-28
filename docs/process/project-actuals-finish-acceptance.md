# Project Actuals Eventful Finish Acceptance

## Decision

`FINISH_ACTUALS` is accepted as an internal Grammar 5 mutation boundary. One
pure request can finish one task and append its task-owned finish event as one
validated candidate. The implementation remains absent from the standard
package root, CLI Contract 5, help, and installed workflow.

Git commit `2af13c4` records the exact completed 5p pre-advance snapshot.

This acceptance is subordinate to ADR 0006, the Project Actuals and Git
History Contract, Mutation semantics 2, the Grammar 5 target, and PACT-001,
PACT-002, PACT-003, PACT-004, PACT-006, and PACT-007. It does not revise their
meanings.

## Accepted implementation

| Concern | Accepted behavior |
| --- | --- |
| Request | `task.finish.actual` requires one caller-supplied fixed-offset event time. Core reads no clock, path, Git state, prior Next result, or environment value. |
| Identity | An omitted event ID is the full SHA-256 identity of the model-1 domain prefix, task ID, `finish`, and canonical event time. Optional measurements do not alter identity. |
| Candidate | Task `status done`, legacy blocked-reason removal, required Grammar 5 version upgrade, and one canonical finish event are applied and revalidated together. No partial candidate or edit is exposed. |
| Measurements | Active time uses exact non-negative hours, effort uses exact non-negative person-hours, and neither is inferred from the other or from resources. A complete sequence must agree exactly with explicit active time. |
| Coverage | An eventless task produces `finish_only`; an accepted start/suspend/resume source sequence produces `complete`. The exact task estimate remains in the pre-advance snapshot as the qualified finish-only baseline. |
| Retry | An identical request is a no-op. Reusing an event ID with another canonical payload is `PTACT-106`; a second distinct finish is `PTACT-104`. |
| Governance and write | Candidate success composes the pre-change `GovernanceDecision.v1`. Grammar 5 persistence reuses digest binding, expected-digest checks, symlink/race rejection, exclusive output creation, and atomic replacement. |
| Advance | The internal Grammar 5 advance profile removes events owned by removed tasks, retains events for residual tasks, and reports stable `removedWorkEventIds`. Active Grammar 1 through 4 advance results are unchanged. |
| Compatibility | Grammar 1 through 4 status-only finish, public MutationResult v2, CLI Contract 5, command discovery, help, and package-root exports remain unchanged. |

## Verification

The completed pre-advance snapshot passed:

```sh
npm run typecheck
node --test test/project-actuals-finish.test.mjs \
  test/project-actuals-source-core.test.mjs \
  test/advance.test.mjs \
  test/governance-authority-core.test.mjs \
  test/governance-preview-target.test.mjs \
  test/governance-safe-write-target.test.mjs \
  test/formatter.test.mjs
node --test --test-concurrency=4 test/*.test.mjs
npm run check:docs
npm run check:self-use
npm run check:link
npm run check:package
git diff --check
```

The bounded full run contains 614 passing tests. Focused tests cover atomic
Grammar 4-to-5 finish, exact quantities, deterministic identity, fixed-offset
input, finish-only and complete coverage, suspension exclusion, retry,
conflict, second finish, blocked-reason ownership, governance, optimistic
safe write, advance ownership, and active public-surface absence.

## Retained boundaries

This slice does not expose Grammar 5 or CLI Contract 6. Start, suspend, and
resume mutation; suspended resource and Next projection; project-history
reduction; task summaries; velocity observation; unit migration v3; public
result schemas; command discovery; help; package-root exports; publication;
Git mutation; automatic velocity adoption; durable authorization audit; and
MIG-08 remain in later tasks.

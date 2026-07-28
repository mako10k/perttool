# Project Actuals Work Lifecycle Acceptance

## Decision

`WORK_LIFECYCLE` is accepted as an internal Grammar 5 lifecycle and suspended
analysis boundary. Start, suspend, and resume now append exact task-owned
events in the same candidate as their state transition. Suspended tasks retain
their complete remaining duration while releasing snapshot resources and
remaining outside ordinary Next classifications and start authority.

Git commit `518a59e` retains the exact completed 7p pre-advance snapshot.
Canonical advance then removed the completed task and its obsolete source
milestone while retaining reached `LIFECYCLE_READY`.

This acceptance is subordinate to ADR 0006, the Project Actuals and Git
History Contract, Graph semantics 2, Mutation semantics 2, and PACT-001
through PACT-006. It does not activate Grammar 5 or CLI Contract 6 and does
not add a recommendation override.

## Accepted implementation

| Concern | Accepted behavior |
| --- | --- |
| Request | `task.start`, `task.suspend`, and `task.resume` require one caller-supplied fixed-offset event time. Core reads no clock, path, Git state, environment value, or prior Next result. |
| Transition | Planned-to-active start, active-to-suspended suspend, and suspended-to-active resume update task state and append one canonical work event as one revalidated candidate. An incomplete state-only or event-only candidate is never exposed. |
| Planned baseline | Start generates `planned_value` from the validated exact task duration or three-point PERT expectation in the project base unit. The caller cannot supply or replace it. |
| Sequence | Complete and open lifecycle reduction requires start first and alternates active and suspended intervals. Stored state and reduced event state must agree. A legacy eventless active task cannot manufacture a suspension interval. |
| Identity and retry | Every omitted ID uses the full model-1 SHA-256 task/kind/canonical-time identity. An identical retry is a no-op; reusing an ID for another canonical payload is `PTACT-106`. |
| Resource authority | Start and resume account for current active requirements before candidate generation. An unavailable capacity fails as `PTACT-108`; suspend removes snapshot occupancy without deleting declared requirements. |
| Analysis | Internal `Perttool.AnalysisResult.v4` handling retains full suspended-task remaining duration and adds stable suspended IDs plus an explicit conditional-on-resumption-at-relative-zero flag to precedence, resource, temporal, and deadline views. No resume instant is inferred. |
| Next | Internal `Perttool.NextResult.v5` handling adds only the suspended group/classification and excludes those tasks from ready, runnable, blocked, upcoming, raw recommendation, release-eligibility sets, and temporal start authority. Recommendation algorithm 1 and policy remain unchanged. |
| Governance and write | Lifecycle candidates compose the existing pre-change GovernanceDecision v1 and reuse the Grammar 5 digest-bound, expected-digest, race-safe atomic persistence boundary accepted for eventful finish. |
| Compatibility | The standard package root, active Grammar 1 through 4, CLI Contract 5, command registry, help, public schemas, and installed workflow remain unchanged. |

## Verification

The completed pre-advance snapshot passed:

```sh
npm run typecheck
node --test --test-concurrency=1 --test-reporter=spec \
  test/project-actuals-lifecycle.test.mjs \
  test/project-actuals-finish.test.mjs \
  test/project-actuals-source-core.test.mjs
node --test --test-concurrency=4 test/*.test.mjs
npm run check:docs
npm run check:self-use
npm run check:link
npm run check:package
git diff --check
```

Focused tests cover exact start baselines, start/suspend/resume state and event
composition, escaping and source preservation, open sequence reduction,
deterministic retry, payload conflict, invalid transitions, legacy event gaps,
resource refusal, suspended source reachability, full remaining duration,
resource release, separate Next classification, temporal start-authority
exclusion, and absence from the active public package root.

## Retained boundaries

This slice does not expose Grammar 5 or CLI Contract 6. Public commands,
registry descriptors, help, Guide, JSON Schema, package-root exports, unit
migration v3, velocity observation, automatic declared-velocity adoption,
Git mutation, durable authorization audit, MIG-08, release publication, and
dist-tag movement remain unavailable.

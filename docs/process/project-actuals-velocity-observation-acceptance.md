# Project Actuals Velocity Observation Acceptance

## Decision

`VELOCITY_OBSERVATION` is accepted as an internal pure observation boundary.
It consumes only `Perttool.ProjectHistoryResult.v1`, derives exact declared
and qualified Git-recorded rates, and never changes source text or declared
project velocity.

Git commit `19b060a` retains the exact completed 5p pre-advance snapshot.
Canonical advance then removed the completed task and satisfied integration
gates, retained their join as reached `ACTUALS_INTEGRATED_INPUT`, and
preserved `ACTUALS_PUBLIC_CONTRACT` as the only ready recommendation.

This acceptance is subordinate to ADR 0006, the Project Actuals and Git
History Contract, and PACT-010 through PACT-013. It does not activate Grammar
5 or CLI Contract 6 and does not authorize automatic velocity adoption.

## Accepted implementation

| Concern | Accepted behavior |
| --- | --- |
| Input | One pure service consumes the versioned project-history result plus an explicit task/evidence selection. It reads no file, Git repository, clock, environment value, or declared velocity. |
| Selection | Omitted tasks select every history task in stable ASCII order. Duplicate, unknown, and unsupported-evidence selections fail as `PTOBS-101`; ordinary sample gaps remain typed candidate unavailability. |
| Baseline | Declared work uses exact start baselines or qualified finish snapshots. Eventless Git-recorded completion retains the exact `done` snapshot value with no event ID and remains recorded, not actual, evidence. |
| Elapsed rate | Complete declared sequences contribute baseline Points over the earliest included start to latest included finish. Parallel task cycle times are never summed. |
| Active dates | Complete active intervals with one fixed offset contribute the distinct half-open local-date union. Mixed offsets or incomplete intervals fail unavailable; no 24-hour day conversion is inferred. |
| Effort | Complete and finish-only samples with explicit person-hours contribute exact Point/person-hour productivity. Effort is never inferred from elapsed time or resource requirements. |
| Git-recorded rate | Recorded active/done transitions produce a separate exact commit-window candidate qualified `recorded_not_actual`; it never provides an adoptable token. |
| Availability | Empty samples, missing sequences, baselines or effort, non-positive windows, history boundaries, and recorded-transition gaps retain stable causes and null unavailable values rather than guessed zeroes. |
| Projection | The internal target returns deterministic `Perttool.VelocityObservationResult.v1` JSON and text in normative candidate order with exact quantities, rates, bounds, samples, baseline provenance, qualifiers, and causes. |
| Read-only boundary | Only available declared elapsed-hour and active-date candidates expose canonical adoption tokens. Observation itself does not edit source or `project.velocity`. |
| Compatibility | The standard package root, active Grammar 1 through 4, CLI Contract 5, command discovery, help, schemas, and installed workflow remain unchanged. |

## Verification

The completed pre-advance snapshot passed:

```sh
npm run typecheck
node --test --test-concurrency=1 --test-reporter=spec \
  test/project-actuals-observation.test.mjs \
  test/project-actuals-history.test.mjs \
  test/project-actuals-lifecycle.test.mjs
node --test --test-concurrency=4 test/*.test.mjs
npm run check:docs
npm run check:self-use
npm run check:link
npm run check:package
git diff --check
```

Focused tests cover PACT-010 parallel-window throughput, PACT-011 explicit
effort productivity, PACT-012 read-only observation, PACT-013 active-date
qualification, finish-only effort, stable selection refusal, incomplete
history, Git-recorded qualification, deterministic JSON/text, and absence
from the active public package root.

## Retained boundaries

This slice does not activate Grammar 5 or CLI Contract 6; add public commands,
registry descriptors, help, Guide, JSON Schema, or package-root exports;
mutate Git or declared velocity; infer day/hour or effort; implement automatic
adoption, confidence, rolling windows, MIG-08, release publication, or
dist-tag movement.

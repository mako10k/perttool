# Project Actuals Source Core Acceptance

## Decision

`ACTUAL_SOURCE_CORE` is accepted as an internal Grammar 5 source boundary.
The implementation can read, validate, format, and project explicit
task-owned work events without activating Grammar 5 or CLI Contract 6 through
the standard package root, CLI, help, mutation, or installed workflow.
Git commit `d6d3d7f` records the exact completed 5p pre-advance snapshot.

This acceptance is subordinate to ADR 0006, the Project Actuals and Git
History Contract, the Grammar 5 target in the DSL Grammar specification, and
the accepted PACT examples. It does not revise their meanings.

## Accepted implementation

| Concern | Accepted behavior |
| --- | --- |
| Capability | One frozen, identity-checked internal Grammar 5 source capability; a copied lookalike is rejected. |
| Syntax | Top-level `work_event` declarations, target `suspended` task status, exact Decimal-or-Fraction `d`/`h`/`p` values, exact `ph` effort, and numeric-offset event date-times. |
| Compatibility | Grammar 1 through 4 use their existing declaration set and task statuses. The active parser rejects future event syntax and `suspended`. |
| Semantics | Model 1, global event IDs, task ownership, kind-specific fields, and exact start `planned_value` equality are validated with stable `PTACT-101` through `PTACT-103` causes. |
| Formatting | Canonical field order, exact values, fixed offsets, fractional seconds, comments, and repeated-format idempotence are retained. |
| Model | `src/actuals/` projects immutable, exact, task-owned events with source tokens and spans from a validated target document. |
| Type boundary | Active `DeclarationNode` and `ParseResult` keep the Grammar 1 through 4 declaration kind; the future work-event kind is confined to the internal target document type. |

The exact planned baseline for a three-point task is its Rational PERT
expectation. Event date-times require an explicit numeric offset; `Z`, local
date-times, date-only values, and unknown `-00:00` offsets are rejected.

## Verification

The acceptance snapshot passed:

```sh
npm run typecheck
node --test test/project-actuals-source-core.test.mjs \
  test/project-actuals-design.test.mjs \
  test/recommendation-self-use-shadow.test.mjs
npm test
npm run check
git diff --check
```

The focused source tests cover capability identity and public absence,
normative source projection, exact PERT baseline equality, source-preserving
formatting, diagnostics, invalid event times and quantities, contextual IDs,
the global ID namespace, and Grammar 1 through 4 closure. The full test run
contains 597 passing tests before the final repository check.

## Retained boundaries

This slice does not implement lifecycle sequence reduction, eventful mutation,
advance-owned event removal, Git inspection or reconstruction, derived task
actual summaries, velocity observations, unit migration v3, public result
schemas, command discovery, help, package-root exports, publication, or any Git
write. Those remain in the residual `plans/project-actuals.pert` workstream.

# Plan Review Mutation Core Resume Review

- Date: 2026-09-29
- Subject: private `PLAN_REVIEW_MUTATION_CORE` WIP at `168f5ba71ae0f0f3775774a77cee80d4935461d9`, plus the local correction described below
- Governing input: accepted [Plan Review Request Contract](../specs/plan-review-request.md), sections 5-8; accepted [Issue #21 requirement](../requirements/plan-review-request-v1.2.md) and [ADR 0010](../adr/0010-separate-plan-review-from-plan-authority.md)
- Review question: whether the private create/resolve planner, authority decision, batch composition, and safe persistence conform to the accepted mutation slice
- Status: technical review passed for the inspected slice; status-only plan progress was recorded separately without milestone or owner acceptance

## Phase boundary

The current implementation slice owns closed request normalization, idempotent create/resolve, candidate-bound Plan Review authority, semantic plan-basis comparison, independent batch guards, deterministic source edits, and one safe-write candidate. The accepted fourteen `PRMC-*` cases and the repository gates supply implementation evidence. For example, request insertion order and replay identity are current obligations.

Task-removal/advance retention belongs to `PLAN_REVIEW_LIFECYCLE_HISTORY`. Public commands, NextResult v9, schemas, and distribution belong to `PLAN_REVIEW_PUBLIC_CONTRACT`; complete cross-surface acceptance belongs to `PLAN_REVIEW_ACCEPTANCE`. For example, adding a public CLI command now would cross the accepted atomic activation boundary.

## Findings

- `INSIDE` — `createInsertion` used `localeCompare(requestId, "en")` to locate the next request. The contract requires deterministic request-ID order; locale collation can reverse the stable string order for allowed IDs such as `PRR-a` and `PRR_A`. The planner now uses `compareStableStrings`, and `PRMC-003` covers the counterexample. The accepted request model, command contract, and public API remain unchanged.
- `INSIDE` — All new Plan Review source modules and the private Application composition now carry module-level `R:` responsibility comments required by repository guidance. This changes no runtime behavior.
- `OUTSIDE` — Task removal, canonical advance, and historical retention remain for `PLAN_REVIEW_LIFECYCLE_HISTORY` under contract section 9. Their absence is not acceptance of that successor slice.
- `OUTSIDE` — Grammar 10 / Contract 11 public activation, four commands, results, schemas, Help, Guide, and adapters remain for `PLAN_REVIEW_PUBLIC_CONTRACT` and final acceptance. The current package continues to expose Grammar 9 / Contract 10.
- `BOUNDARY_DISPUTE` — None identified in this review.

## Current verification

The worktree had no dependencies on resumption. An initial build failed because `@types/node` was absent. `npm ci --ignore-scripts --no-audit --no-fund` restored the lockfile dependency tree without changing tracked files. Under Node.js 22.22.3:

- `npm run build --silent` passed;
- the Plan Review Source and Mutation Core suites passed 26/26 cases;
- `npm run check:static --silent` passed its duplication and complexity gates;
- `npm test --silent` passed 1,372/1,372 tests; and
- `git diff --check` passed.

The correction remained local and uncommitted at this review point. The review neither supplied an owner assertion nor activated a public contract, release, or remote branch.

## Status-only plan progress

After the technical review, exact installed `perttool@0.11.1` checked the accepted plan at source digest `sha256:c3a100e500fbe237f3e8b186f108922974e1ad24c7479b7f412ae955f4936488`. Each `task finish` preview for `PLAN_REVIEW_SOURCE_CORE` and then `PLAN_REVIEW_MUTATION_CORE` was valid, affected no governance owner scope, and required no owner confirmation. Each status-only write used `actor=codex`, the exact immediately observed source digest, and one in-place write followed by readback. No work event, effort, active time, criterion, receipt, outcome, or advance was added.

The final plan digest is `sha256:167ab7bd5a018582015051ac311d560c970058eed505e98ecd5a9d7b8be0eb4b`. Fresh `document check`, precedence/resource analysis, and Next all succeed. Source and Mutation Core are `done`; `PLAN_REVIEW_LIFECYCLE_HISTORY` is the only ready, runnable, and recommended task. The remaining precedence and resource makespans are both 29p, with no declared velocity or dated forecast. `PTDAG-208` closure and `PTMAC-102` missing criterion warnings remain non-blocking; they do not establish milestone acceptance.

## Next boundary

Implement `PLAN_REVIEW_LIFECYCLE_HISTORY` against accepted contract section 9, including open-request Task removal and same-candidate resolution, resolved historical references, and canonical advance retention. Its exit condition is a reviewed private implementation with the required fixture and complete gates. Public Contract 11 activation, owner acceptance, GitHub Issue mutation, release, and plan advance remain separate.

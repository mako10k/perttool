# Issue #21 Delivery Plan Acceptance v1.0

- Document status: Accepted 1.0
- Acceptance date: 2026-09-10
- Decision owner: user
- Owner decision: `ACCEPT`
- Accepted plan: [`plan-review-request.pert`](../../plans/plan-review-request.pert)
- Accepted source digest:
  `sha256:c3a100e500fbe237f3e8b186f108922974e1ad24c7479b7f412ae955f4936488`
- Accepted ADR: [ADR 0010](../adr/0010-separate-plan-review-from-plan-authority.md)
- Accepted contract: [Plan Review Request Contract](../specs/plan-review-request.md)
- Decision audit: `fatal=0 error=0 warning=0`

## Accepted plan boundary

The owner accepted the exact delivery-plan review candidate and authorized its
registration under `plans/plan-review-request.pert`. Readback confirms that the
registered file is byte-identical to the presented candidate.

The plan implements Issue #21 as one future Grammar 10 and CLI Contract 11
boundary while preserving active Grammar 9 and Contract 10 meanings until the
public-contract task activates the complete accepted surface atomically.

Release selection, publication, remote writes, Issue mutation, editor or MCP
mutation, external synchronization, automatic request creation, and canonical
plan advance remain outside the plan.

## Task and dependency structure

The plan contains five Tasks totaling 50p:

1. `PLAN_REVIEW_SOURCE_CORE` — 8p;
2. `PLAN_REVIEW_MUTATION_CORE` — 13p;
3. `PLAN_REVIEW_LIFECYCLE_HISTORY` — 8p;
4. `PLAN_REVIEW_PUBLIC_CONTRACT` — 13p; and
5. `PLAN_REVIEW_ACCEPTANCE` — 8p.

Source Core precedes the mutation and lifecycle/history slices. Those two
slices may execute in parallel with separate semantic resources and developer
capacity two. Both join before public Contract 11 integration, and final
acceptance follows that integration.

## Readback validation

The registered Grammar 9 plan passes document check, precedence analysis,
resource analysis, and Next projection with:

- 6 Resources, 7 Milestones, 5 Tasks, and 2 Gates;
- total task work 50p;
- precedence and resource makespans 42p;
- resource delay 0p; and
- only `PLAN_REVIEW_SOURCE_CORE` ready, recommended, and startable.

Seven non-blocking `PTMAC-102` diagnostics report that initial Milestone
criterion sets are not yet declared. The plan does not infer or waive those
criteria. Each criterion and receipt remains a later candidate-bound acceptance
mutation.

Validation used the locally installed perttool 0.11.0 Grammar 9 and CLI
Contract 10 executable. The accepted 0.11.1 release retains the same grammar,
contract, and planning meanings, but exact 0.11.1 executable revalidation
remains required before the first plan mutation.

## Effects not authorized

Plan registration does not authorize Source Core or any other Task to start.
Implementation, Task lifecycle mutation, criterion or receipt mutation,
commit, push, PR, merge, release, publication, Issue mutation, dist-tag change,
runtime activation, and plan advance remain separate boundaries.

# ADR 0010: Separate plan-review state from plan-change authority

- Status: Accepted
- Date: 2026-09-10
- Decision owner: user
- Related issue: [GitHub Issue #21](https://github.com/mako10k/perttool/issues/21)
- Accepted requirement: [Plan Review Request Requirements v1](../requirements/plan-review-request-v1.2.md)
- Accepted contract: [Plan Review Request Contract](../specs/plan-review-request.md)
- Related specifications: [Governance Authority](../specs/governance-authority.md),
  [Plan Assurance](../specs/plan-assurance.md),
  [Milestone Outcome Acceptance](../specs/milestone-acceptance.md), and
  [Planning Pool](../specs/planning-pool.md)

## Context

Issue #21 asks for a durable way to record that an execution-time observation
makes a planning assumption questionable. Current perttool can validate,
recommend, govern plan mutations, protect accepted planning bases, and accept
milestone outcomes, but none of those states means "review this plan before
starting new downstream work."

Reusing an existing state would change its meaning. A Plan Assurance
`review_required` result means that a sealed planning basis no longer matches.
A Milestone Outcome Acceptance result concerns delivered evidence. Governance
answers whether a caller may persist a candidate. Recommendation and start
authority select executable work. An Issue #21 observation may be credible
without proving any of those facts.

The accepted requirement therefore reserves a separate persistent Plan Review
Request under future Grammar 10 and CLI Contract 11. It also requires a
separate resolution authority decision and forbids that decision from granting
authority for a plan change.

## Proposed decision

### Add an independent Plan Review axis

Introduce one project-owned `plan_review_request` declaration. Any valid actor
may create a request that references a current Task. The record preserves the
reported reason, explicit date-time, actor, and optional opaque locator. The
tool validates and stores those assertions but does not fetch the locator or
claim that the observation is true.

An open request derives project state `review_required` and action
`review_before_new_downstream_work`. This is a strong advisory shown before
the recommendation. It does not change validity, scheduling, recommendation,
eligibility, or start authority and does not interrupt active work.

### Keep review resolution and plan mutation as separate decisions

Resolving a request requires the effective DAG owner or delegate as actor, or
a fresh assertion for the effective DAG owner bound to the complete candidate.
The result exposes a Plan Review authority decision distinct from the existing
Governance Decision.

`plan_retained` resolves the request without changing its Plan Review plan
basis. `plan_changed` is valid only when the same complete candidate changes
that basis. Any governance, assurance, acceptance, history, or safe-write
authority required by the actual plan mutation remains independently required.
All decisions must pass before one atomic write.

### Define a semantic plan basis, not a truth proof

The Plan Review plan basis commits to the outcome, strict DAG plan, temporal
constraints, resources, and Planning Pool planning declarations. It excludes
Plan Review records, execution evidence, lifecycle-only state, assurance and
acceptance evidence, governance declarations, and presentation metadata.

Unequal before and after basis digests prove that plan content changed in the
same candidate. They do not prove that the change addresses the observation or
that the resulting plan is correct. Those remain explicit assertions by the
resolving actor.

### Preserve review evidence through Task lifecycle changes

An open request cannot become a historical Task reference. A candidate that
removes or renames its Task, including canonical advance, must atomically
resolve the request as `plan_changed` or fail.

A resolved request may retain its Task ID as a historical reference. Ordinary
later mutations preserve that record. Canonical advance may remove a resolved
request only when the request was already resolved in the input document. A
request resolved by the same candidate that removes its Task is retained in
the final source, ensuring that the final source still contains the resolution
evidence.

### Activate the boundary atomically

Grammar 9, CLI Contract 10, and `Perttool.NextResult.v8` remain unchanged.
Grammar 10, CLI Contract 11, the source model, commands, results, schemas,
diagnostics, Help, Guide, migration, and `Perttool.NextResult.v9` activate
together only after separate implementation and acceptance work.

## Alternatives

### Reuse Plan Assurance `review_required`

Rejected. That state is derived from accepted basis mismatch or unavailable
assurance evidence. Issue #21 also covers an observation that questions a plan
without proving such a mismatch.

### Make the request a hard start-authority block

Rejected. It would let any reporting actor stop valid downstream work and
would conflate advisory review state with executable authority.

### Resolve `plan_changed` before or after a separate plan mutation

Rejected. Separate writes cannot prove that the reviewed observation and the
selected plan change belong to one candidate, and they introduce an
intermediate false state.

### Treat unequal hashes as proof that the plan is correct

Rejected. A digest proves deterministic inequality of the selected semantic
projection, not relevance, adequacy, or truth.

### Remove a newly resolved request during the same advance

Rejected for model 1. The final source would contain neither an open request
nor its resolution record. Requiring pre-existing resolution provides a
deterministic retention boundary and preserves current evidence.

## Consequences

Positive consequences:

- planning concern becomes durable and machine-readable without changing the
  executable plan;
- the advisory is visible at task selection without silently changing
  recommendation or start authority;
- owner-controlled resolution does not grant plan-mutation authority;
- `plan_changed` is bound to one complete candidate; and
- historical Task removal cannot orphan an open request or erase a newly
  created resolution.

Costs and risks:

- Grammar 10 and Contract 11 add source, result, schema, Help, and Guide
  surface area;
- two authority decisions may be required for one atomic `plan_changed`
  operation;
- the plan-basis projection must remain closed and versioned as planning
  models evolve; and
- advisory state may be ignored by an external control plane, by design.

## Claim, evidence, and action chain

- **E-PRR-001:** The accepted Issue #21 requirement requires a persistent
  advisory that remains independent from recommendation, start authority,
  assurance, acceptance, and governance.
- **E-PRR-002:** Existing governance evaluates authority over actual candidate
  changes and has no operation-specific Plan Review resolution decision.
- **E-PRR-003:** The accepted requirement requires `plan_changed` to contain a
  non-empty semantic plan change in the same complete candidate.
- **E-PRR-004:** The independent requirement review retained exact replay and
  same-candidate advance retention as contract decisions.

- **C-PRR-001 (high confidence):** Plan Review must be a separate state axis,
  because each existing axis answers a different question. References:
  E-PRR-001, E-PRR-002.
- **C-PRR-002 (high confidence):** Resolution and plan mutation must compose
  atomically while retaining independent authority. References: E-PRR-002,
  E-PRR-003.
- **C-PRR-003 (high confidence):** Exact replay must compare stored resolution
  evidence, and a newly resolved request must survive same-candidate advance.
  Reference: E-PRR-004.

- **A-PRR-001:** Fix the exact source, basis, command, result, diagnostic,
  lifecycle, and compatibility contracts before implementation. Supports:
  C-PRR-001 through C-PRR-003.
- **A-PRR-002:** Require separate owner acceptance of this ADR and the
  candidate contract before delivery planning or implementation. Supports:
  C-PRR-001 through C-PRR-003.

## Review and implementation boundary

The decision owner accepted this ADR and the complete Contract Candidate 1.0
on 2026-09-10. Acceptance fixes the architectural and contract direction only.
It is not implementation authority. Delivery-plan mutation, source
implementation, commit, push, PR, release, publication, and Issue mutation
remain separate.

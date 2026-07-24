# Recommendation Design Acceptance Review

- Document status: Accepted 1.0
- Acceptance date: 2026-07-22
- Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)
- Plan: [../../plans/control-plane.pert](../../plans/control-plane.pert)
- Implementation migration: [recommendation-migration.md](recommendation-migration.md)

## 1. Decision

Accept the design for Issue #1. Requirements, normative specifications, basic design, normative examples, and implementation migration are aligned across a deterministic and explainable recommendation contract that separates feasibility from recommendation priority.

This decision means design completion. At acceptance, `selectNextTasks` and `dag next` used `Perttool.NextResult.v2`; recommendation tiers, structured explanations, and override validation/apply were not considered implemented. MIG-04 completed v3 publication on 2026-07-23, but override validation/apply and shadow/adoption remain subsequent gates.

## 2. Review scope

- AI Project Control Plane boundary and completion criteria in [requirements](../requirements.md)
- [Recommendation Semantics](../specs/recommendation.md)
- [Ranking Policy](../specs/recommendation-ranking.md)
- [Reason Taxonomy](../specs/recommendation-reasons.md)
- [Structured Explanation](../specs/recommendation-explanation.md)
- [Interface Contract](../specs/recommendation-interface.md)
- [Human Override Contract](../specs/recommendation-override.md)
- [Recommendation normative example](../examples/recommendation.md)
- [Basic design](../basic-design.md)
- [AI development guidance](ai-development.md)
- [Implementation and self-use migration](recommendation-migration.md)

## 3. Acceptance matrix

| Perspective | Verification result | Decision |
| --- | --- | --- |
| Requirements traceability | Source of truth, global objective, determinism, explainability, and human override can be traced to individual specifications | Accepted |
| Model separation | Does not conflate lifecycle/eligibility, resource selection, and recommendation tier, or redefine `blocked` as a tier | Accepted |
| Deterministic ranking | Selection horizon, lexicographic rules, joint feasibility, complete tie-breaking, and algorithm version are fixed | Accepted |
| Reasons and explanations | Stable reason codes can be mechanically connected to typed facts, expressions, comparisons, decision traces, and description projections | Accepted |
| Interface alignment | Treats Core as the source of truth, derives complete JSON and summary text from the same result, and publishes v2 to v3 atomically | Accepted |
| Override boundary | Does not change normal recommendations; treats feasibility, human reasons, single-use audit, and reanalysis as separate authorities | Accepted |
| Normative examples | Can verify critical versus priority, unlock, gate proximity, parallel sets, resource blockers, empty sets, and override boundaries | Accepted |
| Migration | Separates fixtures, Core, explanations, v3 publication, shadow, normal authority, and override apply by gate | Accepted |
| Current implementation boundary | Does not interpret pre-v3-publication v2 fields as recommendations or expose incomplete results through CLI/help | Accepted |
| Implementation order | Prioritizes operational work after grammar acceptance and parallelizes recommendation and Issue #2 only if they do not delay operational work | Accepted |

## 4. Conditions passed to implementation

The following product implementation was detailed in the [operations detail plan](../../plans/operations.pert) at `M1_ROADMAP_UPDATE` after grammar acceptance.

1. Make `FORMATTER_CORE` and `MUTATION_PREVIEW` the first implementation tracks
2. Implement `WRITE_SAFETY` after accepting both
3. Make `ADVANCE` the next operational task after safe-write; sequence resources with the Mermaid track according to schedule decisions that shorten overall MVP completion
4. Defer MIG-01 through MIG-07 and Issue #2 until `M3_SAFE_WRITE_READY` or later because their shared CLI and reviewers conflict with operational work
5. Do not bring MIG-08, human override apply, ahead of `M3_SAFE_WRITE_READY`

This order does not indicate a defect in the recommendation design. It is a product priority that first resolves operational capabilities missing in Stage 1, and transitions to Stage 2 after safe-write completes. However, do not worsen the forecast for overall MVP completion merely because of local priority within operational work.

## 5. Remaining work

- Implementation of MIG-01 through MIG-08
- Provider-specific AI Agent Guidance Registry design and implementation for Issue #2
- Backlog hierarchy and multi-plan composition design for Issue #3

These are unimplemented or future design work, not design blockers for accepting the Issue #1 recommendation contract.

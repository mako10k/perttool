# Open Issue Priority Review

Date: 2026-08-14

Scope: all live open GitHub Issues, their priority labels, their local backlog
mappings, and the interruption order after the E1 editor-repair contract.

## Result

Seven Issues were open at readback. Issue #19 is the sole P0. Issues #7 and #6
are P1. Issues #13, #18, and #12 are P2. Issue #3 is P3. The ordered delivery
frontier is therefore #19, then the bounded #7 correction, then the larger #6
provenance contract. The selected `EDITOR_REPAIR_ACCEPTANCE` task remains the
plan-assurance recommendation but is paused behind those higher product
priorities.

## Evidence and classification

| Issue | Verified repository boundary | Decision |
| --- | --- | --- |
| #19 | Acceptance-aware advance protects records through `stateChangedMilestoneIds`; the live report demonstrates loss for other retained milestones and a newly invalid warnings-as-errors result. | P0: destructive contract loss in a successful canonical mutation. |
| #7 | `velocityToken` serializes exact Rational Point rates, while `parseVelocity` accepts only integer or decimal components. | P1: deterministic correctness defect rejected before write, with less precise candidates available. |
| #6 | The Git probe classifies detected rename output as `unsupported_rename`; the two public read descriptors expose no provenance override. | P1: blocks valid measurement history but has a documented two-commit workaround and requires a wider contract. |
| #13 | E0 and the E1 child contract are accepted locally; E1 runtime and later tiers remain unfinished. | P2: selected strategic work, safely pausable. |
| #18 | The current static gate passes at 148 clones, 2,746 duplicated lines, 3.352 percent, and 173 reviewed Lizard legacy entries. | P2: ratcheted debt, not a current correctness failure. |
| #12 | The Issue explicitly requires a separate contract and implementation plan for planning-pool and window semantics. | P2: strategic single-project design. |
| #3 | Its single-project backlog/window portion is superseded by #12; genuine multi-document composition remains unselected. | P3: deferred roadmap boundary. |

P0 is reserved for a current delivery blocker or destructive correctness risk.
P1 is a current correctness defect that follows the P0 blocker. P2 is selected
or planned strategic work after corrections. P3 has no current delivery
commitment.

## External mutation and readback

Exactly one GitHub mutation was performed through the guarded remote route:
Issue #7 changed from `priority:P0` to `priority:P1`. Immediate readback showed
`bug` and `priority:P1`, state `OPEN`, and no other label change. A following
complete open-Issue readback showed one priority label on every open Issue and
the distribution recorded above.

No Issue was commented on, edited otherwise, closed, or reopened. No branch,
tag, release, package, dist-tag, or installed artifact was changed.

## Local mapping

The matching backlog identities are `ADV-006` for #19, `ACT-004` for #7,
`ACT-005` for #6, `EDITOR-MUTATION-001` for #13, `STATIC-001` for #18,
`PLAN-POOL-001` for #12, and `MULTI-001` for #3. Their priority table is in
[`docs/backlog.md`](../backlog.md#portfolio-and-issue-inventory).

This review selects priority only. It does not select the #19 implementation
candidate, authorize a hotfix release, move npm tags, push source, close an
Issue, advance a plan, or bypass a validation gate.

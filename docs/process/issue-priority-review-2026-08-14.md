# Open Issue Priority Review

Date: 2026-08-14

Scope: all live open GitHub Issues, their priority labels, their local backlog
mappings, and the post-`0.9.4` frontier after the E1 editor-repair contract.

## Result

The initial readback found seven Issues and selected #19 as the sole P0. After
the accepted `0.9.4` release closed #19, the final readback found six open
Issues and no open P0. Issues #7 and #6 are P1. Issues #13, #18, and #12 are
P2. Issue #3 is P3. The ordered delivery frontier is therefore the bounded #7
correction, then the larger #6 provenance contract. The selected editor plan
resumes from its independently retained recommendation and authority.

## Evidence and classification

| Issue | Verified repository boundary | Decision |
| --- | --- | --- |
| #19 | Released and durably accepted in `0.9.4`; Issue closed with release evidence and only `bug` retained. | Resolved former P0. |
| #7 | `velocityToken` serializes exact Rational Point rates, while `parseVelocity` accepts only integer or decimal components. | P1: deterministic correctness defect rejected before write, with less precise candidates available. |
| #6 | The Git probe classifies detected rename output as `unsupported_rename`; the two public read descriptors expose no provenance override. | P1: blocks valid measurement history but has a documented two-commit workaround and requires a wider contract. |
| #13 | E0 and the E1 child contract are accepted locally; E1 runtime and later tiers remain unfinished. | P2: selected strategic work, safely pausable. |
| #18 | The current static gate passes at 148 clones, 2,746 duplicated lines, 3.352 percent, and 173 reviewed Lizard legacy entries. | P2: ratcheted debt, not a current correctness failure. |
| #12 | The Issue explicitly requires a separate contract and implementation plan for planning-pool and window semantics. | P2: strategic single-project design. |
| #3 | Its single-project backlog/window portion is superseded by #12; genuine multi-document composition remains unselected. | P3: deferred roadmap boundary. |

P0 is reserved for a current delivery blocker or destructive correctness risk;
none remains open after #19. P1 is the current correctness frontier. P2 is
selected or planned strategic work after corrections. P3 has no current
delivery commitment.

## External mutation and readback

Exactly one GitHub mutation was performed through the guarded remote route:
Issue #7 changed from `priority:P0` to `priority:P1`. Immediate readback showed
`bug` and `priority:P1`, state `OPEN`, and no other label change. A following
complete open-Issue readback showed one priority label on every open Issue and
the distribution recorded above.

The later separately authorized release flow closed Issue #19 with one
evidence comment and removed only `priority:P0`; `bug` was retained. Final
readback found #6 and #7 at P1, #12, #13, and #18 at P2, and #3 at P3. No
additional priority mutation was required.

## Local mapping

The matching backlog identities are `ADV-006` for #19, `ACT-004` for #7,
`ACT-005` for #6, `EDITOR-MUTATION-001` for #13, `STATIC-001` for #18,
`PLAN-POOL-001` for #12, and `MULTI-001` for #3. Their priority table is in
[`docs/backlog.md`](../backlog.md#portfolio-and-issue-inventory).

The initial review selected priority only. The later #19 implementation,
release, Issue closure, and release-plan advance were separately authorized
and are recorded in the `0.9.4` release evidence. This review does not
authorize another implementation, release, Issue mutation, or gate bypass.

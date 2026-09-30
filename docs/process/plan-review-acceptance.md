# Plan Review technical acceptance trace

Date: 2026-09-30
Task: `PLAN_REVIEW_ACCEPTANCE`
Source baseline: `e39c739f07558cf0d6030ea89196856459efaed9` plus the retained local public-contract and acceptance changes.

## Phase and governing input

This record supplies technical conformance evidence for accepted Plan Review
Request Normative 1.0, `docs/specs/plan-review-request.md`, and its upstream
requirements and ADR 0010. It does not establish owner acceptance, milestone
criteria or receipts, an assurance outcome, a release, or permission to publish.
Section 13 contains seventeen mandatory groups. The eighteen executable rows
split group 15 into input limits and real persistence races; no normative group
is omitted or added. Earlier handoff references to eighteen cases describe the
executable trace count, not the number of normative groups.

## Executable trace

`test/fixtures/plan-review-acceptance-v1.json` binds each row to the accepted
normative group. `test/plan-review-acceptance.test.mjs` executes every row using
the public root API and CLI, packaged schemas, and the private pure closure
where advance and normalization require it. Its target can be the source tree
or the isolated installed package.

| Row | Normative group | Evidence |
| --- | --- | --- |
| PRAC-001 | 1 | Creation without locator, exact replay, all five creation-field conflicts |
| PRAC-002 | 2 | Mixed open/resolved filtering, deterministic list/show, text presentation |
| PRAC-003 | 3 | Two requests, partial resolution, last resolution, unchanged task-selection meaning |
| PRAC-004 | 4 | Owner, delegate, confirmed owner, denied actor and stale digest |
| PRAC-005 | 5 | Retained-plan equal basis and rejection of change input |
| PRAC-006 | 6 | Atomic changed-plan basis and candidate-bound composed guards |
| PRAC-007 | 7 | Rejected review-only batch, supplemented by real excluded-class guards |
| PRAC-008 | 8 | Outcome/time/actor/reason/batch replay conflicts and later-source exact no-op |
| PRAC-009 | 9 | Active, blocked, suspended and done task references with unchanged selection meaning |
| PRAC-010 | 10 | Open-request removal/rename denial and exact blocking request IDs |
| PRAC-011 | 11 | Atomic resolution with removal/rename and retained historical declaration |
| PRAC-012 | 12 | Later removal preserves resolved bytes; new open historical references fail |
| PRAC-013 | 13 | Pre-resolved advance cleanup, exact destructive proof, changed HEAD/index denial |
| PRAC-014 | 14 | Newly resolved same-candidate advance retains the resolution record |
| PRAC-015 | 15 | Source/request/text/count limits, malformed inputs, inert untrusted locator |
| PRAC-016 | 15 | Two real competing output writes, stale source, no partial write or temporary residue |
| PRAC-017 | 16 | Help, Guide, text/JSON, closed schemas and exact facade counts |
| PRAC-018 | 17 | Grammar 9-to-10 migration and Grammar 1-through-9 Next parity |

`test/plan-review-independent-guards.test.mjs` adds seven real composition
checks: independent goal-owner denial and confirmation, ordinary validation,
assurance denial, preserved assurance warning, milestone-acceptance rejection,
lifecycle/governance-only classification, and excluded evidence/review input.
`test/plan-review-public-advance.test.mjs` supplies a real disposable Git
repository, committed HEAD/stage-0 evidence, CLI migration/create/resolve and
history-guarded advance. No operational repository advance is performed.
Existing source-core, lifecycle/history, mutation and request-size suites remain
part of the complete gate and supply complementary limit and ownership checks.

Adding requests necessarily changes source provenance. Neutrality comparisons
exclude only `sourceDigest`; they retain all recommendation and authority
meaning. Legacy parity compares the complete Next result on identical sources,
excluding only the deliberate result identity and additive Plan Review field.
An exact published `perttool@0.11.1` installation was independently exercised
for Grammar 1-through-9 parity. No inferred compatibility replaces that check.

## Real composition defect and correction

A real batch removing a milestone referenced by an acceptance criterion set
produced the generic internal error `Contract 8 mutation lost milestone
acceptance source validity`. The producing condition was an expected invalid
lower candidate represented as an untyped invariant exception at the Plan
Review composition seam; the previous injected-guard coverage did not exercise
this input. This detection gap is distinct from the producing condition.

The lower adapter now carries its existing parser diagnostics in a private
`MilestoneAcceptanceCandidateError`, preserving the previous throw message.
Only Plan Review resolution translates that exact class to a failed composition
with `PTMAC-105` and `PTREV-109`; unexpected exceptions still propagate. Public
API and CLI tests prove exit 1, no candidate, no write, unchanged source bytes,
and a closed result schema. A regression also proves that the existing lower
legacy batch path retains its throwing behavior. Public counts and authority
contracts are unchanged by the correction. The adjacent command-line
`plan-review-acceptance-review.think` records and audits this reasoning.

## Complete Next presentation

Independent final review found a separate current-clause gap in section 4:
text omitted the complete `clear` projection and JSON appended `plan_review`
after recommendation. The CLI now emits the complete projection first in both
formats. PRAC-017 compares every projected field between text and JSON for both
`clear` and `review_required` and asserts placement before recommendation.
Recommendation and start-authority meanings are unchanged. The recommendation
publication regression validates the additive projection against JSON and
compares all remaining operational text byte-for-byte with the unchanged
historical golden.

## Verification state

The initial focused source trace passed 26/26 cases, including comparison with
the exact published legacy installation. The enhanced real guard CLI regression
passed 7/7. The first complete gate passed 1,421/1,421 tests, static checks, English,
documentation, 47 self-use plans, isolated LSP/MCP, VS Code 1.101.0 host,
temporary link, and the 26/26 installed acceptance trace. That gate preceded
the independently found Next presentation gap; it is retained as intermediate
evidence, not the final acceptance basis.

The first post-presentation run passed 1,419/1,421 tests and failed the old
whole-text golden plus an unchanged MCP stdio discovery timeout. The golden
assertion now separately verifies the additive projection and unchanged
operational text. The MCP producing condition remains unknown; no timeout or
server behavior was changed. The unchanged MCP suite and corrected
recommendation suite passed 19/19 in isolation. The final complete retry bounds
unit-test concurrency to four and keeps every repository gate mandatory.

The final corrected source passed all 1,421 tests under Node.js 22.22.3 with
unit-test concurrency four. Static type/dependency checks, duplication
(147 clones; 2,735 lines; 2.562%) and complexity ratchets (5,393 functions),
English (1,394 text files), documentation (410 Markdown and seven PERT examples),
47 self-use plans, isolated LSP/MCP, the VS Code 1.101.0 trusted/untrusted
install/host/replacement/uninstall gate, and temporary linking all passed.
The isolated 1,112-file public package passed the same 26 acceptance cases,
including published 0.11.1 Grammar 1-through-9 parity, real independent guards,
and real Git advance. Root/Node retain exactly 155 runtime exports and Core
51. npm publication was only a dry run; no external publication occurred.
The command-line decision audit has zero fatal, error or warning findings;
its pending owner boundary remains a limitation, not an acceptance assertion.

## Measurement and remaining boundaries

The remaining acceptance interval was started through the canonical plan at
`2026-09-30T02:10:33+00:00`, event `PR_ACCEPT_START_20260930`, planned value 8p.
Earlier work before this measurement is not reconstructed as actuals.
`project observe-velocity` reports `PTHIS-102` with
`unsupported_source_version` for the retained Grammar 9 plan and historical
sources, so no usable observed velocity or forecast has been established.
This limitation does not authorize extending the history implementation.
The completion event `PR_ACCEPT_FINISH_20260930` records
`2026-09-30T02:49:41+00:00` and exact active time `587/900h` (39 minutes eight
seconds), matching the continuously active event interval. No suspended
interval was observed. This interval includes execution and verification
waiting; it is only the remaining measured part of this task. Person effort
was not measured independently and remains absent. Neither elapsed time nor
allocated resource capacity was converted to person-hours or whole-task
velocity.

A scope-free, authorized finish preview was applied once with actor `codex`,
no owner assertion, and optimistic digest
`sha256:509ef8e13574fd8eca66d7725260cf8c22f66ffb6f32f140ff0b4ef595fba2bc`.
The final plan digest is
`sha256:6247e1bfbbbdd2f2870c782408eea9d8c117d3474034ec0ec381e300b5c84608`.
All five implementation tasks are done. Document check and both schedules
succeeded; precedence and heuristic resource makespans are zero, with no
active, ready, runnable, recommended or startable task. Existing closure
warnings and seven `PTMAC-102` missing-criterion warnings remain visible.
`PLAN_REVIEW_ACCEPTED` is reached with acceptance `not_declared`, not accepted.

The completion-time `project observe-velocity` retry again reports incomplete
unsupported-source history and no available candidate. Exact published 0.11.1
also reproduces that unsupported-source condition on this plan. No velocity was
adopted. The smallest next observation for that separate correction is to
exercise the current Grammar 9 validator route in project history, then verify
an independently measured complete task through the public observation command.
A provisional investigation/correction effort is 0.5-1.5 agent-hours, low
confidence; it requires separate scope selection, and no history changes were
made here. The measurement checkpoint for this session was the completion-time
retry at 2026-09-30 11:49 JST; any new velocity adoption awaits that separate
correction and suitable full-task evidence.

The beneficiary is an agent/user resolving explicit review requests while
retaining ordinary selection and independent guards. Source and disposable
installed capability provide technical readiness; public-release realized value
is zero until separately selected and published. Owner acceptance, criteria,
receipts, outcomes, canonical advance, commit, push, PR, Issue and release
writes remain separate decisions.

## Recommended next action

The authorized technical task is complete with zero remaining internal effort
(high confidence). The next owner decision is review of this exact technical
record and selection of durable acceptance evidence for the parent Plan Review
workstream before any release selection. Preparing and verifying an owner-selected acceptance record or
criterion/receipt candidate is provisionally 0.2-0.5 agent-hours, low
confidence, excluding owner waiting and any separately selected release work.
The exit condition is an owner-approved exact evidence candidate followed by
digest-bound readback and fresh check/analyze/Next, not this test record alone.
No such candidate or owner assertion was written in this task.

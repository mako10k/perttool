# Issue #48: exact selection core implementation

- Date: 2026-11-11
- Scope: private exact optimizer, ranking adapter, and boundary-group projection
- Overall issue status: unfinished; public Next consumers still use v9
- Governing design: [ADR 0011](../adr/0011-rank-backed-start-selection.md)
- Internal contract: [Maximum-count selection core](../specs/maximum-count-selection-core.md)
- Accepted work plan: [Issue #48 implementation](../../plans/issue-48-maximum-count.pert)

## Agreements and actual state

The owner requested implementation in this chat after selecting maximum task
count over priority and clarifying that residual resource units must be shown
for the overflowing same-ranked boundary group. The source messages remain
the authority; these interpreted notes do not substitute for their wording.

The owner separately selected the displayed 365-to-1,215-byte plan candidate
through the explicit plan-registration question in this chat. The exact
[batch request](issue-48-plan-candidate.json) was applied once with actor codex
and the scope-bound user assertion, then read back and checked/analyzed.
An earlier assertion-free write had been rejected with PTGOV-101 and had not
written the candidate. No denial was bypassed and no assertion was carried
into the subsequent status-only task start.

The plan's first task covers the remaining verification of the already written
core. Its start event at 2026-11-11T19:59:41+09:00 is the measurement boundary;
it does not claim to measure earlier investigation or core-authoring time.
The task finished at 2026-11-11T20:14:32+09:00 without an owner assertion.
Fresh check/analyze/Next results passed, with 18p remaining and only
MAX_COUNT_PUBLIC_CONTRACT ready and startable. These are Point-valued forecasts,
not a calendar completion date. There is no adopted velocity: the post-finish
observation returned PTHIS-101 with untracked_target. No inferred rate was
persisted, and no commit was created merely to bypass that missing history.

## Delivered internal behavior

The optimizer maximizes jointly feasible task count first, compares semantic
rank-group selected-count vectors second, and uses stable IDs only to choose
one reproducible result after both objectives tie. It considers all eligible
ready candidates rather than the old recommendation horizon.

Identical requirement profiles are compressed without removing candidates from
the result explanation. Memoization explores exact residual-resource states;
an explicit stack avoids recursion-depth limits and a fully fitting suffix
does not enumerate subsets. There is no candidate cutoff or heuristic fallback.

Boundary groups expose every eligible tied member, its requirements, selected
and unselected IDs, and resource-specific capacity, active usage, outside-group
usage, allocatable units, selected usage, and residual units. The budget is
conditional on the selected outside-group tasks. Unselected group members are
not asserted to be feasible replacement alternatives.

The private ranking adapter consumes actual full-frontier facts and explicit
eligibility, honors capacity overrides and active usage, and derives semantic
ties before the old final task-ID comparison. It does not change the public
ranking function, Application facade or package-root exports.

## Verification record

- Final static gate: type checking, jscpd and Lizard passed. Existing ratchet
  maxima and legacy entries were not enlarged.
- Node 24.19.0: all 12 new-core tests passed.
- Independent exhaustive subset oracle: 500 deterministic small cases matched
  count, rank-group preference, ID choice and input permutation behavior.
- Public-fixture adapter replay: one REVIEWER unit selects CRITICAL; an override
  to two units selects CRITICAL and HIGH_PRIORITY.
- Large homogeneous and fully fitting inputs: 1,000 candidates retained their
  exact identities and complete tied-group membership without truncation.
- Final Node 22.22.3: all 1,475 tests passed with
  `node --test --test-concurrency=4 test/*.test.mjs`.
- The initial default-concurrency Node 22 run passed 1,474 of 1,475 tests.
  Existing editor-format-core stdio coverage failed its JSON-RPC response
  timeout after roughly three seconds and left its disposable LSP child alive.
  That exact child was identified by executable path and parent PID and
  terminated to let the test runner finish. The unchanged test passed in the
  four-file-concurrency full rerun. No LSP source, timeout or test harness was
  modified; the original timeout's cause remains unestablished.
- The earlier complete Node 25 suite passed 1,473 tests before the final suffix
  optimization and additional cases; it is not substituted for the final run.
- The source-count regression was updated from baseline plus 100 to baseline
  plus 104 for exactly four added private modules. Its focused test passed.
- The isolated package gate passed on the final core, including publication
  dry-run, installed workflows and no actual publication. It retained current
  public v9 behavior; it is not installed proof of new public dispatch.
- English and Markdown/PERT documentation checks and diff whitespace checks
  passed before this record; they are repeated after it is complete.

The [SealGraph path manifest](issue-48-core-manifest.json) identifies the exact
core source, test and internal-contract files. It is a path/digest-only claim,
not a Seal, an approval, a correctness certificate, or public acceptance.

## Unfinished consumer obligations

`dag next` still exposes CLI Contract 11, NextResult v9 and the accepted Issue
#37 intersection. The reported automatic-start problem therefore remains at
the public consumer entrypoint. No kn source, installed CLI, LSP, VSIX, MCP
deployment, npm channel, GitHub Issue, remote branch or release was changed.

The remaining tasks are the versioned public contract, shared Application and
consumer adoption, and real-entrypoint/installed-package acceptance. They must
compose existing eligibility before optimization and project one selected set
into recommendation, runnable membership and start authority, with complete
boundary explanations and matching override/schema/Guide/MCP identities.
No public runtime activation, release or installation is inferred from this
internal implementation record. The remaining implementation estimate is
provisionally 12–24 engineer-hours, low confidence and not a measured velocity
forecast. The owner was asked whether that larger budget fits the intended
implementation effort; dependent work waits for that budget decision while
this authorized core slice is preserved and reported.

## 2026-11-13 continuation

The owner explicitly approved the remaining 18p and 12–24 engineer-hours in the
user message immediately following the current-state recheck and requested
public contract work first. MAX_COUNT_PUBLIC_CONTRACT started at
2026-11-13T13:46:11+09:00. The resumed budget is supported by that current source
message. The earlier unverified memory claim about approval is superseded by
this explicit decision. The preceding verification record remains the dated
record of the private-core slice.

# Issue 30 Planning Intent UI Acceptance

## 1. Scope and authority

- GitHub Issue: [#30](https://github.com/mako10k/perttool/issues/30)
- PERT task: `POOL_INTENT_UI`
- Active source boundary: Grammar 9 and CLI Contract 10
- Release, publication, remote mutation, Issue mutation, plan advance, and
  commit are outside this acceptance.

This increment adds a routine intent input to the existing eleven Planning
Pool commands. It does not add a command, root result schema, runtime export,
planning owner, execution graph, or automatic semantic decision.

## 2. Accepted contract

`Perttool.PlanningIntentRequest.v1` is a closed object containing an exact
source digest and one explicit action. Work actions compile to the complete
`Perttool.PlanningReshapeRequest.v2`; Window actions compile to the unchanged
`Perttool.WindowMutationRequest.v1`.

Version 2 preserves every v1 reshape field and meaning and adds only:

- `work_title_dispositions`, for an exact caller-supplied non-empty title; and
- dependency action `create`, for an exact caller-supplied dependency pair.

The existing low-level v1 request remains accepted and canonically stable.
`--request` and `--intent-request` are mutually exclusive. Complex semantic
split and merge retain the low-level request path.

The builder copies exact current descriptions and complete incident typed
relations into the compiled audit inventory. It never partitions natural
language, chooses a Work, infers a dependency, selects a projection or
deferral, chooses carry-over, or combines actions.

## 3. Use-case closure

| Issue requirement | Accepted executable path |
| --- | --- |
| first Work | `create_work` through reshape preflight and apply |
| title and description | `update_work` with independent nullable fields |
| order movement | `move_work` with an exact nullable predecessor |
| dependency maintenance | idempotent `set_dependency` desired presence |
| eligible archive | `archive_work`, still rejected by existing eligibility checks when non-empty or incident |
| projection preview | explicit Event and Activity IDs through reshape preflight |
| narrow deferral preview | explicit Task and Milestone IDs through reshape preflight |
| first Window | `create_window` through `window add` |
| Window select or remove | `set_window_membership` through `window set` |
| carry-over | `close_window` with exact Work IDs and explicit target |

Grammar 8 migration, first Work, first Window, other routine actions,
projection, deferral, close/carry-over, and write review are copy-pasteable in
[`docs/examples/planning-pool-intents.md`](../examples/planning-pool-intents.md).
The same document gives explicit recovery for stale digest, failed preflight,
expired or mismatched token, owner response, history unavailability or
overlap, and interrupted write.

## 4. Preserved safety sequence

The intent input is compiled before the existing audit. The compiled request
then follows the unchanged sequence:

```text
valid source and exact source digest
  -> complete normalized low-level request
  -> one final valid candidate
  -> preflight hash and opaque token for reshape
  -> candidate-bound governance and plan assurance
  -> canonical Git history assessment when destructive
  -> expected-digest and race checks
  -> exclusive or atomic safe write
```

The preflight result exposes the compiled normalized request. The v2
normalization identity, preflight hash, source digest, candidate digest, and
token snapshot are bound together. Token restore accepts v1 and v2 identities
but does not turn either token into approval.

## 5. Executable evidence

`test/issue-30-planning-intent-ui.test.mjs` covers five dependency-ordered
groups:

1. Work create, update, move, dependency, and archive candidates;
2. explicit same-identity projection and narrow deferral;
3. Window create, membership select/remove, and close/carry-over;
4. stale source, invalid intent, expired token, owner-response projection,
   and documented history recovery; and
5. real CLI Grammar 8 migration, first-Work preflight and safe write, first
   Window safe write, exclusive input validation, and v2 JSON Schema checks.

The focused Planning Pool, public contract, schema, discovery, Issue #26
option, adapter dependency, and safe-write gates pass. The supported Node.js
test run passes all 1,309 tests with `TMPDIR`, `TMP`, and `TEMP` fixed to
`/tmp`, which is required under the current WSL host so POSIX mode assertions
do not run on the Windows temporary filesystem.

Static analysis retains its existing thresholds. Type checking passes for the
root and all three private adapters, duplicate analysis reports 147 clones and
2,743 lines at 2.692%, and complexity reports 5,071 functions with only the
168 accepted legacy entries. No new complexity exception was added.

## 6. Retained boundaries

- No automatic semantic inference or autonomous projection is implemented.
- No direct editor or MCP mutation is added.
- No standalone input-request root schemas are published; Issue #31 owns that
  separately reviewed boundary.
- No Goal Seal or goal-coverage work is included.
- No release, npm tag, GitHub Issue write, commit, push, or plan advance is
  authorized by this acceptance.

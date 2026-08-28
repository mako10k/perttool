# Issue 29 Planning Pool Human Text Acceptance

## 1. Scope and authority

- GitHub Issue: [#29](https://github.com/mako10k/perttool/issues/29)
- PERT task: `POOL_HUMAN_TEXT_UI`
- Active source boundary: Grammar 9 and CLI Contract 10
- Release, publication, remote mutation, Issue mutation, plan advance, and
  commit are outside this acceptance.

This increment changes only default CLI presentation and the existing Work
show Window-membership projection. It adds no command, root result identity,
schema, public runtime export, planning owner, execution graph, or mutation
authority.

## 2. Accepted human views

| Command family | Default text boundary |
| --- | --- |
| `work list`, `window list` | Retain the compact one-row-per-entity form. |
| `work show` | Show description, planning associations, strict links, planning dependencies, Window memberships, and global-order neighbors. |
| `window show` | Show objective, document identity, half-open bounds, and selected Work in global order. |
| `work observe`, `window observe` | Separate refinement, execution, outcome, organization, temporal, and global-execution facts; historical mode summarizes the same axes and lineage evidence. |
| `work reshape preflight` | Show source/candidate binding, affected meaning before and after, change counts, diagnostics, authority, token expiry, and the next action. |

Default detail text omits source-span and raw-candidate noise. `--format json`
retains the complete stable result and remains the machine contract. The
human renderer consumes the existing Application result; it does not
recompute Planning Pool semantics.

## 3. Parity and recovery

Work show uses the existing `windows` field to return only active Windows that
select the requested Work. This makes the human membership line and JSON
projection agree without adding a result field.

Observation text retains evidence state, selected Work order, task actual and
completion facts, Milestone closure and acceptance facts, dependency and
Window organization, temporal position and overlap facts, and global
recommendation and start authority. Historical text reports axis-local
completeness and bounded lineage counts without serializing raw JSON.

Preflight text distinguishes ready, no-op, incomplete-binding, and blocked
states. A ready governed candidate names the required owner and instructs the
operator to obtain candidate-bound confirmation before apply. A stale or
otherwise blocked request emits its stable diagnostic, exposes no token, and
instructs the operator to correct the request and rerun preflight.

## 4. Executable evidence

`test/issue-29-planning-human-text.test.mjs` and
`test/golden/planning-pool-human/` fix:

1. unchanged compact lists;
2. Work and Window show semantic text and JSON parity;
3. current Work and Window observation axes and JSON parity;
4. historical axis summaries without raw JSON; and
5. successful and stale reshape preflight binding, meaning, authority, token,
   diagnostic, and next-action behavior.

The focused Issue #29, Planning Pool public-contract, and Core dependency
tests pass. The complete supported Node.js matrix contains 1,313 tests. Its
first full run passed 1,312 and exposed only the exact TypeScript source-file
inventory increment; after correcting that inventory, the focused dependency
and Issue #29 recheck passed 8 of 8. All other tests in that full run passed.

A later complete-gate attempt under concurrent host load timed out only in
four existing JSON-RPC stdio probes. The editor-format, editor-repair, LSP,
and MCP files then passed 41 of 41 when rerun serially without any timeout or
product-code change. `TMPDIR`, `TMP`, and `TEMP` were fixed to `/tmp`, as
required by the current WSL host for POSIX mode assertions. This record does
not claim one uninterrupted all-green `npm run check` invocation.

Static analysis retains the existing thresholds. Type checking passes for the
root and all three private adapters, duplicate analysis reports 147 clones and
2,743 lines at 2.681%, and complexity reports 5,083 functions with only the
168 accepted legacy entries. No quality exception was added.

The remaining repository gates pass serially: the English baseline covers
1,276 text files and three allowlisted lines; documentation covers 362
Markdown files and seven PERT examples; self-use covers 45 plans; and the
private LSP and MCP packages, supported VS Code 1.101.0 host, temporary npm
link, and 1,016-file isolated public package all pass.

## 5. Retained boundaries

- JSON identities, snake-case projections, schemas, and public exports remain
  unchanged.
- Planning observation remains read-only and reshape apply retains the exact
  existing preflight, authority, history, and safe-write sequence.
- No editor or MCP mutation, Goal Seal, or goal-coverage work is included.
- No release, npm tag, GitHub Issue write, commit, push, or plan advance is
  authorized by this acceptance.

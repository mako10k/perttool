# Issue 11 Terminal Deletion Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-12
- Issue: [#11](https://github.com/mako10k/perttool/issues/11)
- Release disposition: Required input to the next selected release

## 1. Decision

Accept the narrow source-order correction in
`src/mutation/advance-deletion.ts`. Consecutive declarations in one terminal
removed suffix retain the ADV-002 separator-ownership model, while each later
deletion starts no earlier than the preceding deletion ends. A separator byte
therefore belongs to at most one edit.

This changes neither the terminal suffix candidate nor the public result
contract. It only makes the already selected deletion ownership representable
as normalized, non-overlapping `TextEdit` values.

## 2. Composition and guard invariants

The regression source contains one conformant completed producer, one retained
consumer, three consecutive removable frontier receipts, and terminal start
and finish work events. Advance removes the old outcome, receipts, and events,
creates the required cross-frontier receipt, and preserves the retained
consumer basis.

The candidate's declaration deletion ranges equal the destructive history
records. Preview, separate output, and in-place write return identical bytes
and digest. The in-place history guard remains `passed/baseline_matches`, the
assurance guard remains `passed/basis_preserved`, and no force or relaxed
validation path was added.

## 3. Cases and verification

[`advance-terminal-separator-issue-11-v1.json`](../../test/fixtures/advance-terminal-separator-issue-11-v1.json)
fixes twelve dependency-ordered cases. Focused tests cover one and multiple
blank lines, LF and CRLF, present and absent final newlines, exact destructive
ranges, retained basis and receipt construction, preview/output/write
identity, the Issue #9 EOF receipt regression, and the existing retained work
event success path.

Acceptance requires:

```sh
npm run build
node --test test/advance-terminal-separator-issue-11.test.mjs \
  test/advance-clean-candidate-core.test.mjs \
  test/plan-assurance-advance-core.test.mjs \
  test/advance-history-cli.test.mjs
npm run check
git diff --check
```

The focused gate passed 31 tests. The complete repository gate then passed
1,031 tests, the English baseline over 835 text files with three allowlisted
lines, documentation checks over 234 Markdown files and seven PERT examples,
read-only self-use over 37 plans, isolated LSP and MCP acceptance, the VSIX
shell/DAG gate under VS Code 1.101.0, temporary linking, and the 709-file
isolated public-package workflow. `git diff --check` also passed.

## 4. Release boundary

Issue #11 is a required input to the same next release target as the accepted
milestone-outcome workstream. This record does not select the exact version,
create a release plan or candidate, publish, move a dist-tag, push a remote,
or mutate the Issue.

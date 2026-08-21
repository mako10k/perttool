# Issue #6 History-Provenance Core Acceptance

Status: Accepted on 2026-08-21.

## Accepted implementation

The immutable first-parent Git probe accepts an internal `automatic` or
`new_root` request. Automatic mode preserves the existing fail-closed rename
diagnostic. Explicit new-root mode requires exactly one rename into the first
retained path, resolves the predecessor through an exact `ls-tree -z` blob
binding, reads that content-addressed blob, and binds the root and excluded
predecessor paths, commits, source digests, and raw bytes.

History reconstruction validates every retained source, requires one endpoint
project identity, parses the excluded predecessor independently, and accepts
the override only when that predecessor has a different project identity.
Missing, multiple, malformed, unreadable, same-project, invalid, or raced
evidence returns `provenance_unavailable`; it never falls back to automatic
interpretation.

## Verified boundary

Focused Node.js 22 type checking, build, contract, Git-probe, and history tests
pass. The real repositories cover automatic refusal, different-project
recovery, same-project refusal, missing rename evidence, a path containing a
space and colon, CLI history/velocity equality, SHA-1/SHA-256, shallow history,
linked worktrees, and source and HEAD races. Blob lookup does not use the
ambiguous `commit:path` spelling.

The implementation reads Git objects and the selected file only. It does not
change the working tree, index, refs, source bytes, or declared velocity.
Reviewed predecessor acceptance, similarity policy, durable receipts, and all
Git mutation remain in `SCM-002`.

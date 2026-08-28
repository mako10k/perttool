# Issue 26 Planning Option Contract Acceptance

- Document status: Accepted focused correction 1.0
- Review date: 2026-08-26
- Issue: [#26](https://github.com/mako10k/perttool/issues/26)
- Release disposition: Required input to the next Planning Pool minor gate

## 1. Decision

Accept one explicit Planning Pool mutation option boundary for Contract 10.
Window add, set, and close and Work reshape apply now share only these
operation-owned infrastructure options:

- governance: `actor`, `accepted-by-owner`;
- result and diagnostics: `format`, `color`, `max-diagnostics`,
  `warnings-as-errors`;
- preview and persistence: `diff`, `write`, `out`, `expect-digest`.

Each operation adds only its own request and reshape binding options. Work
reshape preflight remains read-only and exposes its request, residual,
result, and diagnostic options only.

## 2. Root cause and correction

Contract 10 previously derived Planning Pool mutation options from the
`task.add` descriptor and attempted to remove Task fields with a deny list.
That list used incomplete and stale names. Contract 9-added `not-before` and
`deadline` and active names including `description`, `status`,
`blocked-reason`, `optimistic`, `most-likely`, `pessimistic`, `tag`, and
`require` therefore remained accepted even though no Planning Pool request
consumed them.

The correction replaces the deny list with the closed
`planningMutationSharedOptionNames` allowlist. Initialization fails if any
required shared option is unavailable. A future Task option therefore cannot
silently enter a Planning Pool command merely because its descriptor is used
as the compatibility template.

## 3. Closed command surfaces

The accepted option order is:

- `window add`, `window set`, and `window close`: `request`, followed by the
  ten shared mutation options;
- `work reshape apply`: `request`, `preflight-hash`, `preflight-token`,
  `add-residual-description`, followed by the ten shared mutation options;
- `work reshape preflight`: `request`, `add-residual-description`, `format`,
  `color`, `max-diagnostics`, `warnings-as-errors`.

Help, JSON discovery, and usage validation share these exact descriptors.
The tests reject all fifteen Task-only options across all five commands:
`not-before`, `deadline`, `title`, `description`, `status`, `priority`,
`owner`, `blocked-reason`, `source`, `duration`, `optimistic`,
`most-likely`, `pessimistic`, `tag`, and `require`.

Real CLI probes use nonexistent document and request paths and still return
exit 2 with `PTCLI-001 unknown option`. This establishes rejection before
document or request input and before candidate planning. No ignored option can
therefore produce a success result or a candidate digest.

## 4. Verification

The focused Issue #26 tests passed all three Help, JSON discovery, usage, and
real CLI cases. The wider command discovery, command registry, and Planning
Pool public-contract run passed all 17 tests.

The complete supported repository command exited zero:

```sh
TMPDIR=/tmp TMP=/tmp TEMP=/tmp \
  node --test --test-reporter=dot test/*.test.mjs
```

Static type, duplication, and complexity checks passed at 147 clones, 2,743
duplicated lines, 2.716%, 4,999 functions, and 168 accepted legacy complexity
entries. The English baseline passed across 1,257 text files with three exact
allowlisted lines, documentation checks passed across 359 Markdown files and
seven PERT examples, and `git diff --check` exited zero. The independent
Issue #25 and #28 focused run passed all 21 tests.

## 5. Boundary

This correction does not change a Planning Pool request or result schema,
runtime mutation semantics, governance authority, safe-write behavior,
Grammar 9, CLI Contract 10, command count, schema count, or public export
count. It does not close an Issue, advance a plan, select a release version,
create a release candidate, commit, push, publish, or move an npm dist-tag.

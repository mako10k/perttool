# Plan Review direct-library byte-limit correction

Date: 2026-09-30
Baseline: `e39c739f07558cf0d6030ea89196856459efaed9`
Task: `PLAN_REVIEW_PUBLIC_CONTRACT`

## Governing boundary

This correction resumes the remaining INSIDE finding in
`plan-review-public-contract-wip-handoff-2026-09-29.md`. Section 10 of
`docs/specs/plan-review-request.md` requires the composed batch request to
remain within 8,388,608 UTF-8 bytes before allocation or candidate expansion.
The current question is direct-library normalization, not owner acceptance of
all eighteen cases. The latter belongs to `PLAN_REVIEW_ACCEPTANCE`.

## Detailed design and implementation

The internal `src/plan-review/request-size.ts` counts canonical JSON syntax,
string escapes, UTF-8 scalar widths, and safe integer representations. It
stops when the limit is exceeded without constructing an escaped payload or
complete JSON string. Object key ordering does not affect byte count. Cycles,
unsupported values, invalid surrogate pairs, and traversal failures reject.
The existing RFC 8785 serializer and digest remain the canonical identity
owner; normalization calls them only after the size pass succeeds. No public
export, result schema, input limit, or successful canonical identity changes.

The counter does not prevent the caller from allocating its own input object.
Its boundary is the library's subsequent serialization and expansion.

## Review findings

- `INSIDE`, fixed: direct-library normalization previously serialized the
  complete batch before checking its canonical UTF-8 length. It now checks
  the exact serialized size first.
- `INSIDE`, fixed: initial counter functions exceeded the existing complexity
  ratchet. String, array, and object counting were separated without changing
  the ratchet threshold.
- `INSIDE`, fixed: the dependency inventory still expected 98 additive source
  files. It now expects 99, accounting for the new internal size module while
  retaining the historical baseline and exact dependency checks.
- `OUTSIDE`: full eighteen-case trace and owner acceptance remain assigned to
  `PLAN_REVIEW_ACCEPTANCE`; release, remote writes, Issue changes, and advance
  retain their separate authority boundaries.
- `BOUNDARY_DISPUTE`: none identified.

## Evidence

`test/plan-review-request-size.test.mjs` verifies canonical byte-count equality
for escaping, multibyte Unicode, safe integers, nested records and arrays;
invalid graph rejection; exact 8,388,608-byte direct-library acceptance;
8,388,609-byte rejection; and escaped/multibyte oversized rejection. Its
serialization observation proves that oversized payloads do not reach
`JSON.stringify`. The root-exported `planPlanReviewResolve` also rejects the
oversized request with `PTREV-104` / `invalid_change_request`, no candidate,
and no change. The related initial focused run passed 17/17 tests, and the
final byte-limit suite passed 3/3.

The command-line audit of the adjacent `.think` file reported zero fatal,
error, or warning findings. Its pending acceptance boundary remains an
explicit limitation; audit success does not establish external facts or
owner acceptance.

The first bounded full-suite attempt failed the stale source-file count and
the existing editor-format stdio assertion. That assertion left its child
process alive; the owned test child was terminated to recover the failed run.
The unchanged editor test passed 9/9 in isolation, and the final size,
dependency, and editor regression run passed 16/16. The producing condition of
the stdio failure is unknown; the isolated success is not a full-suite pass.

The final bounded full-suite run passed all 1,396 tests under Node.js 22.22.3.
Build, type checking, duplication and complexity ratchets, English, docs,
read-only self-use on 47 plans, isolated LSP and MCP packages, supported VS Code
1.101.0 trusted/untrusted install/replacement/uninstall, temporary link, and
isolated public-package gates passed. The first failed run remains recorded;
its editor failure cause remains unknown.

## Plan readback and remaining boundary

After successful verification, a status-only CLI preview changed only
`PLAN_REVIEW_PUBLIC_CONTRACT` from planned to done. It required no owner
assertion or affected governance scope. One in-place write used actor `codex`
and source digest
`sha256:41ba829ab7faaabac5e0b0f07e4bc7ca9e74f5ef8588da0fb7e5ab956213bd38`.
Final plan digest:
`sha256:375e5b3d0399ae11723e31f3f705fea30a66a67ec5db91fd31ae302cc326a7b9`.

Fresh document check, both schedules, and Next succeeded. Only
`PLAN_REVIEW_ACCEPTANCE` is recommended and startable. Precedence and heuristic
resource makespans are both 8p, with no velocity or dated forecast. Existing
closure and missing-criterion warnings do not establish owner acceptance.

The next recommendation is the accepted eighteen-case and cross-surface
`PLAN_REVIEW_ACCEPTANCE` trace, ending with its exact evidence and separate
owner acceptance boundary. Its recorded estimate is 8p; duration remains
unknown. No receipt, conformant outcome, plan advance, commit, push, PR, Issue,
release, or publication was performed. External realized value remains zero;
this correction closes the public implementation's preallocation gap for
local source and CLI use.

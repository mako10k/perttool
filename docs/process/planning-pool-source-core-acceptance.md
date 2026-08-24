# Planning Pool Source Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-24
- Accepted candidate parent: `45a3b3a642ecb141641055ed0a0c858f47a34891`
- Plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Plan task: `PLANNING_POOL_SOURCE_CORE`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Source model: `perttool.target-grammar-9-planning-pool-source@1`
- Active public runtime: unchanged package `0.10.5`, Grammar 8, and CLI Contract 9

## 1. Decision

Accept the private Grammar 9 Planning Pool source and semantic Core. It reads,
validates, formats, migrates, and projects Work, project-owned Event and
Activity AoA, persisted Window, project-wide Work order, Work dependency, and
strict projection-link source without activating Grammar 9 or CLI Contract
10.

Grammar 1 through 8 continue through the active Grammar 8 source owner and
return no Planning Pool model. A copied capability object is rejected. The
package root, Core and Node facades, commands, schemas, strict analysis,
mutation authority, adapters, and installed behavior remain unchanged.

## 2. Evidence chain

### C-POOL-SOURCE-001 `high`, accepted

Claim: one private source owner implements the accepted current Planning Pool
meaning without creating a second execution owner.

Evidence:

- `E-POOL-SOURCE-001`: the separately accepted
  `OUTCOME_PLANNING_POOL_CONTRACT` binds the normative forty-case contract and
  makes only `PLANNING_POOL_SOURCE_CORE` startable.
- `E-POOL-SOURCE-002`: `PPSC-001` through `PPSC-016` trace identity-checked
  source composition, AoA, total Work order, associations, strict links,
  dependencies, Activity plan fields, Windows, namespace, spans, formatting,
  migration, limits, candidate validation, and non-activation.
- `E-POOL-SOURCE-003`: the focused and aggregate gates exercise the same
  Grammar 8 validation and safe candidate primitives before and after the new
  private layer.

Action:

- `A-POOL-SOURCE-001`, implementation permitted, executed: add the private
  Grammar 9 lexer, value parser, validator, source model, formatter, migration,
  complete-candidate seam, machine cases, and acceptance trace.

### C-POOL-SOURCE-002 `high`, accepted

Claim: common source transformation mechanics remain one invariant rather
than duplicated Grammar-specific implementations.

Evidence:

- `E-POOL-SOURCE-004`: Grammar 8 and Grammar 9 formatting both normalize
  owned edits, apply one final candidate, and reparse that complete candidate
  through `validated-source.ts`.
- `E-POOL-SOURCE-005`: declaration segmentation and diagnostic-result
  construction are shared without adding a package-root export or changing a
  result identity.
- `E-POOL-SOURCE-006`: duplicate and complexity ratchets pass without a
  baseline increase, and the existing Grammar 8 Source Core cases remain
  green.

Action:

- `A-POOL-SOURCE-002`, implementation permitted, executed: factor only the
  pre-existing source-safe invariants and retain Grammar-specific semantic
  ownership in the temporal and Planning Pool layers.

## 3. Accepted source composition

The source lexer recognizes exactly the five accepted top-level forms:
`work`, `event`, `activity`, `window`, and `work_order`. It masks their
non-newline bytes with same-length comments, maps `version 9` to `version 8`,
and delegates the remaining complete source to the active temporal owner.
BOM, CRLF, UTF-16 positions, source offsets, comments, strict declarations,
assurance and acceptance records remain bound to their original bytes.

The immutable `Perttool.PlanningPoolModel.v1` projection contains:

- local and `PROJECT::ID` qualified identity for every planning entity and
  reference;
- optional residual Work description with no Work lifecycle or completion;
- project-owned Event states and directed Activity transitions whose endpoints
  resolve only to Event or strict Milestone;
- many-to-many Work associations and typed Milestone and Task projection
  links;
- one complete project-wide Work order independent from declaration order;
- planning-only Work dependencies, including deterministic observation of
  valid directed cycles while rejecting self and duplicate relations;
- optional Activity candidate duration, estimate, priority, resources, owner,
  tags, source, calendar, exact event bounds, and deadline without Task status
  or execution meaning; and
- active persisted Windows with required title, temporary objective, non-empty
  Work membership, and optional comparable ordered bounds.

Every current Event and Activity has at least one Work association. Removing
the last association in a complete candidate is invalid. Planning IDs share
the active local namespace, while qualified source references remain rejected.
Retired-ID history checks remain owned by the later history-aware mutation
tasks rather than current-source validity.

## 4. Validation, limits, formatting, and migration

The source and final-candidate UTF-8 byte limit is checked before declaration
scanning. Declaration, association/link, dependency, Window, and membership
counts are preflighted before semantic entity expansion. The exact contract
limits return `PTPOOL-115`; no candidate or truncated semantic projection is
returned.

Activity `when` values reuse the Grammar 8 offset-bearing instant parser,
reject date-only input, enforce one value per event/direction pair, reject an
earliest value after its matching latest value, and validate the written
offset against the selected pinned named-zone profile. Duration and estimate
values are positive and use the project unit. Resource, calendar, strict link,
Window member, endpoint, order, namespace, and Work-association references
all fail closed at their accepted diagnostic owner.

The formatter composes the active Grammar 8 owned edits over the same-length
base with Planning Pool-owned scalar, exact duration, date-time, tag, integer,
estimate, and requirement normalization. It preserves declaration placement,
comments, unrelated fields, line endings, and source descriptions, reparses
the complete final candidate, and is byte-idempotent.

`planPlanningPoolSourceMutation` is only a private complete-TextEdit candidate
seam. It returns no candidate or edits when the final Grammar 9 source is
invalid. It creates no reshape request, preflight token, projection authority,
history proof, governance decision, or persistent write.

`planPlanningPoolMigration` accepts only valid Grammar 8 or already-valid
Grammar 9 input. Grammar 8 to 9 changes exactly the explicit project version,
inserts no planning meaning, and is idempotent. Older input returns
`PTPOOL-116` and must use its existing migration path first.

## 5. Accepted cases

The dependency-ordered matrix is
[`planning-pool-source-core-v1.json`](../../test/fixtures/planning-pool-source-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `PPSC-001`–`PPSC-004` | private capability, legacy delegation, incomplete Work, and cyclic or disconnected project-owned AoA |
| `PPSC-005`–`PPSC-007` | total Work order, associations, strict links, last consumer, and dependency rules |
| `PPSC-008`–`PPSC-010` | exact Activity plan fields, Window validity, shared namespace, and qualified-reference rejection |
| `PPSC-011`–`PPSC-013` | exact source spans, idempotent formatting, and version-only Grammar 8 migration |
| `PPSC-014`–`PPSC-016` | preflighted limits, complete-candidate revalidation, and unchanged active public boundary |

The fixture SHA-256 is
`a3115f785133015e3b7d1f706b06125ca1435ffa0a7e1d2479fc26ebde09c92e`.
The focused test SHA-256 is
`28270d91f9cc2c93751b1434e01cba78bf3cf67a2047b9901e2ef71516897931`.
The static-analysis baseline was not changed.

## 6. Verification

The accepted candidate passed:

```sh
TMPDIR=/tmp npm run check:static
TMPDIR=/tmp npm test
TMPDIR=/tmp npm run check:english
TMPDIR=/tmp npm run check:docs
TMPDIR=/tmp npm run check:self-use
TMPDIR=/tmp npm run check:lsp-package
TMPDIR=/tmp npm run check:mcp-package
TMPDIR=/tmp npm run check:vsix-shell
TMPDIR=/tmp npm run check:link
TMPDIR=/tmp npm run check:package
npm run build
TMPDIR=/tmp node --test \
  test/planning-pool-contract.test.mjs \
  test/planning-pool-source-core.test.mjs \
  test/temporal-schedule-source-core.test.mjs \
  test/contract9-public-integration.test.mjs \
  test/adapter-core-dependency.test.mjs
git diff --check
```

The focused gate passes the sixteen dependency-ordered source cases together
with the accepted contract, active Grammar 8 Source Core, Contract 9 public
integration, and Core dependency boundary. The public readback retains 56
commands, 23 root schemas, 129 root exports, 129 Node exports, and 45 Core
exports. The aggregate and isolated-package gates retain the closed public
package and private-adapter boundaries.

The complete repository run passed all 1,251 tests. Static analysis passed at
147 duplicate clones, 2,740 duplicated lines, 2.992 percent, 4,240 functions,
and the unchanged 168-entry legacy complexity baseline. The English baseline
passed 1,202 text files with three allowlisted lines; documentation checks
passed 348 Markdown files and seven PERT examples. Read-only self-use passed
45 plans. Isolated LSP, MCP, supported VS Code 1.101.0 trusted and untrusted
host, temporary npm link, dry-run publication, and installed-package checks
passed. The retained package candidate contains 905 files and remains
`perttool@0.10.5`.

## 7. Plan lifecycle

The implementation task is complete and retained before canonical advance.
The exact status-only mutation changed the plan digest from
`sha256:3eb59848d872169c77aa7d5b0bfcecd12998759f1bb72b0afe717baa7006882e`
to
`sha256:f1bf4e986879e3a5247851d74d0da20c1567eaba5e7df037cbe8550a0657e871`.
No owner assertion was needed or supplied.

Readback reports the source task's computed and accepted basis as
`sha256:f5eb55d8fc978089504fcbe500a2f4236e1caafa16804a58da809adbb76a1886`.
Its outcome remains deliberately missing, so complete assurance requires
`restore_assurance_evidence` rooted at `PLANNING_POOL_SOURCE_CORE`.
`PLANNING_POOL_RESHAPE_CORE` is structurally ready and recommended, but no
downstream task has start authority until the exact source outcome receives a
separate user confirmation. The expected `PTDAG-208` closure notices for the
contract and source milestones remain warnings; no plan advance occurred.

## 8. Retained boundaries

`PLANNING_RESHAPE_CORE` remains the next dependency-ordered implementation
task after this source task receives its separate conformant outcome. It owns
semantic-element inventory, typed origin and destination dispositions,
normalization, hash and opaque-token preflight, actual before/after mapping,
LLM self-audit inputs, recoverable one-time token consumption, and the narrow
residual-description and byte-identical warnings.

Projection, archival, advance cleanup, deferral, Window mutations and
observation, bounded Git evidence, public Grammar 9 and CLI Contract 10,
schemas, Help, Guide, adapters, installed behavior, release selection,
publication, remote writes, Issue mutation, and plan advance remain separate
tasks or decisions.

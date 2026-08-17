# Temporal Schedule Source Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `104003009c3227aa56e3cc87c8b33930f823f90a`
- Plan: [`plans/temporal-schedule.pert`](../../plans/temporal-schedule.pert)
- Plan task: `CALENDAR_SOURCE_CORE`
- Normative contract: [Temporal Schedule Contract](../specs/temporal-schedule.md)
- Source model: `perttool.target-grammar-8-temporal-schedule-source@1`
- Active public runtime: unchanged Grammar 7 and CLI Contract 8

## 1. Decision

Accept the internal Grammar 8 calendar and availability source Core. It reads,
validates, formats, and projects the complete closed source inventory from the
integrated Temporal Schedule Contract while leaving Grammar 8, CLI Contract 9,
commands, schemas, result identities, and package-root/Core/Node exports
inactive.

This slice does not add a parallel calendar DSL or append independent Grammar
8 behavior to the legacy temporal contracts. `docs/specs/temporal-schedule.md`
remains the sole Grammar 8 temporal owner. Grammar 1 through 7 source continues
through its existing parser, validator, milestone-acceptance, result, and
authority path.

## 2. Accepted source composition

The frozen internal capability is identity checked; a copied lookalike is
rejected. `source-lexical.ts` recognizes only the accepted Grammar 8 calendar,
project, resource, and `when` additions. It replaces their non-newline bytes
with same-length comments, maps `version 8` to `version 7`, and delegates the
remaining complete source to the existing Grammar 7 milestone-acceptance and
Grammar 6 source owners. Original UTF-8 byte offsets, BOM, CRLF, declaration
identity, assurance records, acceptance records, and diagnostics remain bound
to the original source.

The immutable source model contains:

- the exact offset-bearing `as_of` instant for named-zone scheduling;
- one continuous fixed-offset or named-zone project profile;
- reusable weekly calendars and complete dated exceptions;
- optional per-resource calendar replacement;
- exact inclusive `available_from` and exclusive `available_until` bounds;
- sorted non-overlapping, zero-through-nominal capacity replacements; and
- task-start, task-finish, and milestone-reach earliest/latest bounds.

Calendar IDs share the complete existing entity namespace, including Grammar
7 milestone-acceptance records. The implementation introduces no human
resource type, task calendar, inheritance tree, recurrence expression,
external source, or product-specific constraint catalog.

## 3. Pinned zone-data boundary

The tracked `tzdb-2026c.ts` artifact is generated from the exact IANA
`tzdata2026c.tar.gz` archive with SHA-256
`e4a178a4477f3d0ea77cc31828ff72aa38feff8d61aa13e7e99e142e9d902be4`.
The generator rejects any other archive digest before reading the compiled
TZif directory. The generated projection contains 598 names, exact offset
transitions from `1970-01-01T00:00:00Z` inclusive through
`2100-01-01T00:00:00Z` exclusive, and generated source SHA-256
`b8bb047c4b103a58e1fda203ee7a05d79cc1dbf2faecd83ad8da774989d88d9d`.

Source validation uses only this deeply frozen projection. It does not query
the host zone, locale, filesystem, network, wall clock, or a latest-data
alias. Unknown zones, out-of-range instants, and explicit offsets that do not
match the selected zone fail with `PTSCH-105`.

## 4. Formatting and candidate validation

The internal formatter reuses the legacy Grammar 6 formatter over the
same-length sanitized base and adds only Grammar 8-owned edits. It canonicalizes
weekly days, exceptions, availability replacements, exact date-times,
`workday`, and event-bound order. Omitted weekday `off` entries disappear;
unrelated fields, declarations, comments, line endings, and acceptance records
remain source owned. Repeated formatting is byte-idempotent.

`planTemporalScheduleSourceMutation` accepts normalized `TextEdit` inputs as
the reusable Source Core seam. It returns a candidate and edits only after the
complete final Grammar 8 document validates. Invalid references, overlaps,
offsets, bounds, limits, or legacy `not_before` return no candidate and no
edits. Typed `calendar add/set/remove` requests, governance projection,
assurance impact, persistence, and CLI publication remain later work.

## 5. Accepted cases

The dependency-ordered matrix is
[`temporal-schedule-source-core-v1.json`](../../test/fixtures/temporal-schedule-source-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `TSS-001`–`TSS-003` | Internal capability, legacy delegation, and complete Grammar 8 source projection |
| `TSS-004`–`TSS-008` | Pinned zones, windows, exceptions, generic resource availability, rejection, and event bounds |
| `TSS-009`–`TSS-011` | Idempotent formatter, complete-candidate edits, exact spans, and bounded diagnostics |
| `TSS-012`–`TSS-014` | Grammar 7 acceptance composition, immutable offline zone data, and unchanged active runtime |

The llmthink implementation review is
[`temporal-schedule-source-core-review.think`](temporal-schedule-source-core-review.think).
Its warning-or-higher audit reports zero findings. The static gate required no
new complexity or duplication baseline.

## 6. Verification

The accepted candidate passed:

```sh
npm run check:static
npm run check:english
npm run check:docs
npm run check:self-use
npm run check:lsp-package
npm run check:mcp-package
npm run check:vsix-shell
npm run check:link
npm run check:package
npm run build
node --test test/temporal-schedule-source-core.test.mjs \
  test/temporal-schedule-contract.test.mjs \
  test/temporal-calendar-contract.test.mjs \
  test/temporal-source-parser.test.mjs \
  test/temporal-semantic-validator.test.mjs \
  test/temporal-formatter.test.mjs \
  test/temporal-mutation.test.mjs \
  test/adapter-core-dependency.test.mjs \
  test/node-host-boundary.test.mjs
npx --yes node@22 --test \
  test/temporal-schedule-source-core.test.mjs \
  test/temporal-schedule-contract.test.mjs \
  test/adapter-core-dependency.test.mjs \
  test/node-host-boundary.test.mjs
llmthink dsl audit \
  docs/process/temporal-schedule-source-core-review.think \
  --pretty --min-severity warning
git diff --check
```

The focused current-runtime gate passed 64 tests. The direct Node.js 22 gate
passed 32 tests. The complete `npm test` run passed 1,119 of 1,120 tests. Its
single failure is the unchanged, pre-existing
`recommendation-self-use-shadow.test.mjs` expectation for
`plans/editor-mutations.pert`: the current plan selects
`EDITOR_RECOVERABLE_CONTRACT` at digest `sha256:bb9fd570...04d3b4`, while the
golden still expects `EDITOR_REPAIR_ACCEPTANCE` at
`sha256:fac511d0...87af00`. Neither that plan nor its golden is changed by this
slice, so this record does not claim a completely green aggregate test run.

The remaining repository gates passed the English baseline over 953 text
files, documentation checks over 293 Markdown files and seven PERT examples,
read-only check/analyze/next over all 43 self-use plans, isolated LSP and MCP
packages, the trusted/untrusted supported VS Code 1.101.0 host workflow,
temporary npm linking, and the 749-file isolated public-package workflow. The
package root remains closed by `exports`; the compiled future source owner is
not an importable public subpath.

## 7. Plan lifecycle

The status-only `task set` preview changed no governance scope. One in-place
write used the exact expected original digest
`sha256:47a9b6d548b540dbc6ab0c1fef330025973e29915de90997a6c7bf29d4105893`
and produced source digest
`sha256:7318cab57bbd0aaf64b1c0730140f24481225dd4306706c151f9593a40d73350`.
Readback reports `CALENDAR_SOURCE_CORE` done and recommends and makes startable
only `CALENDAR_SCHEDULER_CORE`. The existing `PTDAG-208` closure notices for
`TEMPORAL_CONTRACT_ACCEPTED` and `CALENDAR_SOURCE_READY` remain warnings; no
plan advance was performed.

## 8. Retained boundaries

`CALENDAR_SCHEDULER_CORE` remains the only next implementation frontier. It
owns working-time addition and subtraction, local-window instant expansion,
daylight-saving membership, effective time-varying capacity, simultaneous
multi-resource allocation, deterministic interruption and resume, resource
profiles, utilization, and unavailable-horizon results.

Event-constraint propagation, required schedules, POSTDUE and
POSTDUE_FORECAST, active Check/Analysis/Next projection, public Grammar 8 and
CLI Contract 9 activation, schemas, Help, Guide, adapters, installed behavior,
release selection, publication, remote writes, Issue mutation, and plan
advance remain separate tasks or decisions.

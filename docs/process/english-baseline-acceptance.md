# English repository baseline acceptance

Status: Accepted on 2026-07-29. The exact completed pre-advance snapshot is
the Git commit that first contains this record; its identifier is added after
that commit without changing the accepted plan snapshot.

## Decision

The repository accepts the English baseline defined by
[ADR 0004](../adr/0004-english-repository-baseline.md). Repository-maintained
prose, bundled help, and diagnostics are English. Stable machine identifiers
remain the authority, human conversation language remains independent, and
user-authored or intentionally preserved Unicode content is not translated
automatically.

The accepted repository has no general Japanese-content exception. Its only
Japanese-script occurrences are the three exact lines in the versioned
machine-readable allowlist:

- the scanner's own Unicode expression in
  [`english-surface-inventory.md`](english-surface-inventory.md); and
- the title and blocked-reason lines in the decoded formatter round-trip
  golden.

The exact paths, decoded lines, counts, and preservation reasons are fixed by
`test/fixtures/english-baseline/japanese-script-allowlist.v1.json`.

## Cross-surface trace

| Surface | Accepted evidence |
| --- | --- |
| Architecture decision | ADR 0004 fixes canonical English, machine-contract stability, Unicode preservation, independent conversation language, and the no-i18n boundary. |
| Requirements | [Requirement 2.5](../requirements.md#25-english-is-the-repository-baseline) carries the same mandatory policy and deterministic-output requirement. |
| Design | [Basic design Slice 4B](../basic-design.md#post-mvp-slice-4b-english-repository-baseline) partitions the migration and preserves locale negotiation, translation catalogs, `--locale`, and automatic source translation as non-goals. |
| Runtime and diagnostics | Parser, semantic, mutation, application, conversion, I/O, and CLI diagnostics are English and retain their stable codes, spans, typed fields, and failure boundaries. The language scanner covers tracked and non-ignored untracked source text. |
| Help and usage | The Contract 6 command registry and HelpNode registry derive deterministic English text and JSON projections. Command discovery, help, Guide, link, and installed-package checks cover the published projections. |
| Documentation | Requirements, specifications, design, examples, ADRs, process guidance, security guidance, README, CHANGELOG, and agent-facing documentation are covered by the language and documentation gates. |
| Plans | All twenty self-use plans and `plans/README.md` use English repository-maintained metadata while retaining stable IDs, topology, estimates, states, and historical evidence. |
| Tests and goldens | The exact fail-closed allowlist, fixture layout and semantic digests, parser and formatter round trips, diagnostics, CLI, E2E, and self-use goldens preserve machine and intentional Unicode contracts. |
| Package contents | The package gate builds from the current source, checks normalized package contents, performs only an npm publish dry-run, installs into an isolated prefix, and runs the complete file-first Contract 6 workflow. |
| Agent entrypoints | `AGENTS.md` is the shared policy authority and `.github/copilot-instructions.md` carries the same mandatory English, Unicode, conversation-language, and no-i18n boundaries. |

The earlier slice records retain the detailed evidence:

- [`english-surface-inventory.md`](english-surface-inventory.md)
- [`english-pert-plans-acceptance.md`](english-pert-plans-acceptance.md)
- [`english-golden-unicode-acceptance.md`](english-golden-unicode-acceptance.md)

## No-i18n confirmation

The active command registry has no `locale` option. The source and package
configuration contain no runtime locale selection, `LANG` or `LC_*`
environment dispatch, translation catalog, gettext integration, or message
localization layer.

`src/history/git-probe.ts` uses `localeCompare(..., "en")` only to sort Git
commit IDs deterministically after sorting typed availability causes. The
literal locale is fixed, does not read process state, and does not select or
translate user-facing messages. The recommendation result similarly fixes
`description_locale="en"` as part of its versioned deterministic description
registry rather than negotiating a runtime locale.

## Verification

The focused and complete gates passed locally on Node.js 25.1.0, above the
Node.js 22 runtime baseline. CI retains the repository's Node.js 22 and 24
matrix:

```sh
rg -n -- '--locale|process\.env\.(LANG|LC_)|Intl\.|toLocale|gettext|i18n' \
  src package.json
rg -n 'localeCompare' src
npm run check:english
npm run check:docs
npm run check
git diff --check
```

The first negative search returned no implementation match. The second
returned only the fixed Git commit-ID sort described above. The language gate
scanned 437 text files and observed exactly three allowlisted lines. The
repository gate passed all 641 tests, 96 Markdown documents, seven normative
PERT examples, all twenty self-use plan projections, the temporary-link
workflow, and the isolated release-package workflow. The package check
performed only its documented publish dry-run; it did not publish a package or
change a dist-tag.

## PERT state

The preview-first expected-digest atomic batch changed only velocity from
`39p/2d` to `42p/2d` and set `ENGLISH_ACCEPTANCE` to `done`. The exact
completed pre-advance digest is
`sha256:e9b306ff0423ad8bc8114a1c1c35affae60e6cd79f1f52fa9cd997c3a7727462`.

At the completed pre-advance snapshot, all nine tasks and 42p are accepted over
two active dates. Precedence and the `parallel-sgs` version 1 heuristic
resource makespans are zero with no resource delay. Complete, non-truncated
`Perttool.NextResult.v5` has no ready, recommended, or startable task.

Governed `dag advance` subsequently removes `ENGLISH_ACCEPTANCE` and its prior
frontier while retaining reached `ENGLISH_BASELINE_ACCEPTED`. The residual
digest and exact removal evidence are recorded here after that separate
advance.

## Explicit non-goals

This acceptance does not:

- add runtime i18n, locale negotiation, translation catalogs, or a locale
  option;
- translate user-authored content or remove intentional Unicode coverage;
- implement or select backlog `ACT-002` REOPEN;
- mutate Git history or integrate Git writes into perttool;
- publish a release, move an npm dist-tag, push Git, or close a GitHub issue.

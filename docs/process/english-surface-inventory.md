# English surface migration inventory

- Status: Baseline inventory
- Date: 2026-07-24
- Snapshot: `cc95f5d` before the migration changes in this work
- Policy: [ADR 0004](../adr/0004-english-repository-baseline.md)
- Plan task: `SURFACE_INVENTORY`
- Enforced by: `npm run check:english`

## Method

The inventory scans maintained text for Japanese-script code points with:

```sh
rg -l '[ぁ-んァ-ン一-龠]' <scope>
```

This is a deterministic migration signal, not a natural-language detector. It
does not flag English debt, every CJK extension, escaped Unicode, emoji, or
source-faithful non-Japanese text. Final acceptance therefore also requires
fixture-specific and semantic review.

## Baseline

| Surface | Files | Files with Japanese-script matches | Migration owner |
| --- | ---: | ---: | --- |
| `README.md`, `CHANGELOG.md`, `SECURITY.md`, `AGENTS.md`, Copilot entrypoint | 5 | 5 | process and guidance |
| `docs/requirements.md`, `docs/basic-design.md` | 2 | 2 | normative documentation |
| `docs/adr/` | 4 | 3 | normative documentation |
| `docs/specs/` | 13 | 13 | normative documentation |
| `docs/examples/` | 10 | 10 | normative documentation |
| `docs/process/` | 13 | 12 | process and guidance |
| `plans/` | 8 | 7 | plan metadata |
| `src/` | 52 | 13 | runtime messages and bundled help |
| `test/` | 85 | 17 | corresponding runtime/help/docs slice or Unicode audit |
| `scripts/` | 5 | 0 | no Japanese migration detected |

The 13 runtime files are:

```text
src/application/analyze.ts
src/application/mutate.ts
src/cli.ts
src/conversion/mermaid-import.ts
src/conversion/mermaid.ts
src/help/registry.ts
src/io/safe-write.ts
src/mutation/milestone.ts
src/mutation/project.ts
src/mutation/resource.ts
src/mutation/task.ts
src/parser/document-parser.ts
src/semantic/validator.ts
```

## Unicode allowlist

The repository-level Japanese-script acceptance check may allow only:

1. user-authored `.pert` input supplied outside the repository;
2. `test/fixtures/grammar/formatter-roundtrip.pert` and
   `test/golden/grammar/formatter-roundtrip.expected.pert`, where escaped and
   decoded Japanese plus `😀` verify source preservation and UTF-16 offsets;
3. `test/fixtures/grammar/block-text-spans.pert`, where `😀` verifies UTF-16
   block-text spans;
4. exact external or historical evidence literals whose translation would
   alter the recorded bytes or meaning.

Items 1 and 3 do not require a Japanese-script exception in the scanner, but
they remain explicit Unicode preservation cases. Historical files do not
receive a blanket exception: only the exact source-faithful literal is
allowlisted with a reason.

The machine-readable allowlist is
`test/fixtures/english-baseline/japanese-script-allowlist.v1.json`. Each entry
binds one repository-relative path, one exact decoded line, an exact occurrence
count, and a preservation reason. Wildcards and file-wide exceptions are not
supported. `scripts/check-english-baseline.mjs` scans tracked and non-ignored
untracked text files, rejects every unmatched Japanese-script line, and also
rejects stale or over-consumed allowlist entries.

All other Japanese prose in normative examples, E2E fixtures, invalid fixtures,
current plans, help golden files, and runtime diagnostics is migration debt.
Those fixtures are repository-authored examples, not user-authored content.

## Stable non-language identifiers

Migration must not translate or renumber:

- command, option, DSL keyword, field, enum, JSON key, schema, and operation
  identifiers;
- diagnostic, recommendation reason, guidance, risk, fixture case, task,
  milestone, gate, and resource IDs;
- source spans, digests, canonical record order, URLs, release versions, Git
  references, and package names;
- quoted external output used as byte-level evidence.

## Review outcome

The inventory bounded runtime/help translation to 13 source files and their
focused tests, while the majority of debt was maintained documentation and
examples. After the plan, golden, and fixture migration slices, the executable
allowlist contains three exact lines: the scanner expression in this inventory
and two decoded Japanese lines in the formatter round-trip golden. New
Japanese-script content fails unless an exact line and preservation reason are
added to the machine-readable allowlist and reviewed against this policy.

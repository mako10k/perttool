# E0 Editor Format Core Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-14
- Workstream: `EDITOR-MUTATION-001`
- Task: `EDITOR_FORMAT_CORE`
- Plan: [../../plans/editor-mutations.pert](../../plans/editor-mutations.pert)
- Contract: [../specs/editor-mutations.md](../specs/editor-mutations.md)
- Machine cases:
  [../../test/fixtures/editor-format-core-v1.json](../../test/fixtures/editor-format-core-v1.json)

## 1. Accepted implementation

The E0 Core and private language-server slice is accepted with this boundary:

- every complete valid synchronized snapshot owns a
  `Perttool.EditorSemanticFingerprint.v1` digest over ordered declarations,
  explicit fields, normalized exact values, lifecycle, governance, assurance,
  and Grammar 7 milestone-acceptance records;
- source text, spans, comments, indentation, horizontal spacing, line endings,
  canonical numeric spelling, and other formatter-owned trivia do not enter
  that semantic identity;
- the document session binds the existing Core `formatDocument` result to the
  exact URI, open generation, integer version, source digest, candidate digest,
  normalized offset edits, equal original/candidate fingerprints, full
  candidate validation, and repeated-format no-op proof;
- the private LSP selects the highest common model from `[2, 1]` and advertises
  `documentFormattingProvider: true` only for selected model 2;
- model 1 retains the accepted read-only capabilities and does not advertise or
  serve formatting; and
- the server returns standard UTF-16 `TextEdit` values but never applies them,
  reads or writes a path, invokes Git or the CLI, or changes editor settings.

The model-2 capability is exactly `textDocument/formatting`. Range formatting,
on-type formatting, rename, generic execute command, E1 through E3 operations,
and any direct persistence remain absent.

## 2. Core proof and failure closure

The Core proof performs these checks as one indivisible computation:

1. require a current, complete, valid snapshot and the exact 8 MiB source
   limit;
2. invoke the existing portable formatter over the coordinate-compatible
   Grammar 6 analysis source;
3. require at most 10,000 already normalized, ordered, non-overlapping edits,
   at most 8 MiB of replacement bytes, and exact edit-to-candidate identity;
4. apply the same offsets to the captured full source, including Grammar 7
   records outside formatter ownership;
5. rebuild and fully validate the complete candidate through the same document
   preparation boundary;
6. require byte-identical original and candidate semantic fingerprints; and
7. require a second formatter execution to return the exact candidate and zero
   edits.

Invalid or truncated source, malformed edits, invalid or semantically changed
candidates, exceeded limits, failed idempotence, cancellation, close, reopen,
newer content, or digest mismatch returns no edit. Cancellation maps to LSP
`RequestCancelled` (`-32800`), and stale content maps to `ContentModified`
(`-32801`). Other unavailable E0 proofs return the standard empty formatting
edit list.

## 3. Normative case trace

| Cases | Evidence |
| --- | --- |
| `EFC-001` through `EFC-004` | complete semantic identity, exact formatter candidate/digest, idempotence, and Grammar 7 milestone-acceptance preservation |
| `EFC-005` through `EFC-007` | invalid, malformed, post-format-invalid, truncated, and exact limit failure closure without partial edits |
| `EFC-008` and `EFC-009` | cancellation and all-field snapshot staleness discard computed edits |
| `EFC-010` and `EFC-011` | highest-common model-2 selection and unchanged model-1 read-only fallback |
| `EFC-012` | standard required option validation while perttool canonical formatting ignores presentation preferences and unknown extensions |
| `EFC-013` | the bundled production stdio server formats a synchronized Grammar 7 document through the standard LSP method |
| `EFC-014` | source and import inspection retain the Core/LSP no-write, no-Git, no-CLI, no-settings boundary |

## 4. Compatibility boundary

The public product remains Grammar 7, CLI Contract 8, 53 commands, 23 root
schemas, 129 root and Node runtime exports, 45 Core runtime exports, and
package version `0.9.1`. The type-only fingerprint and format-result records do
not add a public runtime export. The portable Core closure grows from its
accepted 34-module document-session snapshot to 36 modules by adding the
fingerprint owner and portable SHA-256 implementation already used elsewhere.
It retains zero Node builtin and external runtime imports.

Existing Help, GraphView, DAG focus, milestone-acceptance view, historical
view/source, diagnostics, synchronization, CLI, MCP, and public-package
behavior remain unchanged. The private VSIX still offers only model 1 and has
no formatter registration in this task. Format Document, user-enabled
format-on-save, supported-host acceptance, and local VSIX replacement belong
to `EDITOR_FORMAT_ACCEPTANCE`.

## 5. Verification and plan boundary

The implementation is covered by fourteen dependency-ordered machine cases,
the existing document-session, editor-contract, model-1 LSP, milestone-
acceptance adapter, package, documentation, English-baseline, and self-use
regressions. The complete gate passed under Node.js 22.23.2 with 1,061 tests,
forty read-only self-use plans, isolated LSP and MCP packages, the supported
VS Code 1.101.0 trusted/untrusted host workflow, temporary linking, and the
717-file isolated public-package workflow. `git diff --check` also passed.

Implementation commit `5245235` records the accepted code, cases, and guidance.
After that exact revision and gate were reviewed, one previewed expected-digest
`task finish --write` added only `status done` for `EDITOR_FORMAT_CORE`. The
write changed plan source digest `sha256:3323fecd...cc627d` to
`sha256:32606859...f7609b`; governance was not applicable and no owner
assertion was supplied.

The reached-milestone criterion set, its receipt, and the separately governed
conformant task outcome are distinct preview-first, candidate-bound mutations.
The criterion-set candidate was separately confirmed and written once with actor
`codex` and the candidate-bound `user` assertion. It changed source digest
`sha256:32606859...f7609b` to `sha256:9f6b3d2a...152486` and recorded set
commitment `sha256:f5b6802c...6cd63d` plus criterion commitment
`sha256:cf40d138...a5afbe`. Readback reports reached closure with pending
acceptance and exactly one blocking required criterion. The confirmation is
not reused for the receipt or task outcome, which remain unwritten without
their own fresh confirmation. This task performs no release selection,
package or VSIX publication, VSIX installation, remote write, GitHub Issue
mutation, or plan advance.

# Tiered Editor Mutation Contract

- Document status: Accepted 1.0
- Date: 2026-08-13
- Workstream: `EDITOR-MUTATION-001`
- Task: `EDITOR_MUTATION_CONTRACT`
- Editor protocol model version: 2
- Parent contracts: [editor-protocol.md](editor-protocol.md),
  [adapter-platform.md](adapter-platform.md)
- Machine cases:
  [../../test/fixtures/editor-mutation-contract-v1.json](../../test/fixtures/editor-mutation-contract-v1.json)

## 1. Scope and decision

This specification replaces the permanent read-only editor ceiling with an
additive, opt-in mutation model. It fixes four ordered mutation classes:

| Class | Meaning | Maximum implicit surface |
| --- | --- | --- |
| `E0` | proved complete semantic equivalence | standard whole-document formatting, including user-enabled format on save |
| `E1` | validated repair or refactoring confined to a completely unsealed closure | explicit Quick Fix or Fix All; automatic repair only under the extra closure rule in Section 6 |
| `E2` | another non-destructive semantic edit with an independently proved recovery | explicit command, exact preview, then editor-applied `WorkspaceEdit` |
| `E3` | authority-sensitive assurance, governance, destructive, or advance operation | dedicated review UI and fresh candidate-bound authority |

The order is normative: `E0 < E1 < E2 < E3`. Classification evaluates the
complete final candidate and selects the strictest applicable class. An
adapter MUST NOT split, hide, or relabel a stricter member of an atomic
candidate to obtain a less cautious interaction.

This contract fixes classification, evidence, protocol, recovery, interaction,
authority, diagnostics, and limits. It does not implement or advertise any
mutation capability. `EDITOR_FORMAT_CORE` is the first task allowed to
activate model 2, and it may activate only `E0` whole-document formatting.

## 2. Preserved baseline

Editor Protocol model 1 remains accepted exactly as specified by the
[Editor Protocol Contract](editor-protocol.md). A model-1 connection remains
read-only and does not advertise formatting, range formatting, on-type
formatting, rename, execute-command, or file-operation capabilities.

At this contract snapshot, the active product remains Grammar 7, CLI Contract
8, 53 commands, 23 root schemas, 129 root exports, 129 Node exports, and 45
Core exports. The private LSP and VSIX select only editor protocol model 1.
This specification adds no public package export, result schema, command,
dependency, runtime handler, VSIX contribution, setting, release identity, or
publication.

Model 2 reuses the model-1 URI, generation, integer version, exact text,
UTF-8 SHA-256 source digest, incremental UTF-16 synchronization, cancellation,
staleness, and terminal desynchronization rules. A mutation result that does
not bind all four document identity fields is unavailable, even when its text
happens to match the current document.

## 3. Negotiation and capability closure

Model 2 is opt-in. After a task explicitly activates it, a capable client
offers the ordered, unique list `[2, 1]` in
`perttool.editorProtocolModelVersions`. The server selects the highest model it
implements and returns that exact scalar selection. A client that omits the
custom handshake, offers only model 1, or cannot validate the selected model
receives the unchanged model-1 standard capability set.

Before model-2 activation, an offer containing model 2 may fall back to model
1 only when the offer also contains 1. An offer containing only unsupported
models cannot use any perttool custom method. Negotiation, workspace trust,
extension activation, process identity, URI scheme, repository discovery, and
Git identity never grant mutation or owner authority.

Model 2 has this cumulative capability map. A later implementation MUST NOT
advertise a row before its corresponding plan gate is accepted.

| Gate | Protocol surface | Permitted class | Not permitted |
| --- | --- | --- | --- |
| `EDITOR_FORMAT_CORE_READY` | `textDocument/formatting`; `documentFormattingProvider: true` | `E0` | range/on-type formatting, commands, direct write |
| `EDITOR_REPAIR_ACCEPTED` | `textDocument/codeAction` with `quickfix` and `source.fixAll.perttool` | `E1` | authority records, hidden save-time edits |
| `EDITOR_RECOVERABLE_ACCEPTED` | `perttool/editorMutationPreview` and `perttool/editorMutationApply` | `E2` | implicit application, missing recovery |
| `EDITOR_AUTHORITY_UI_READY` | the same custom methods plus the dedicated review UI | `E3` | Code Action, Fix All, save-time application |

The standard whole-document formatting request is the only save-integrated
surface. Model 2 does not advertise `textDocument/rangeFormatting`,
`textDocument/onTypeFormatting`, rename, workspace file operations, or a
generic execute-command escape hatch. Custom methods accept closed typed
operation IDs; they do not accept a command line, module, arbitrary method,
filesystem path, Git argument, or free-form edit.

## 4. Complete candidate and evidence model

### 4.1 Immutable request binding

Every computation captures one immutable model-1 document snapshot at request
start. Its binding is:

```ts
interface PerttoolEditorDocumentBindingV1 {
  documentUri: DocumentUri;
  documentGeneration: string;
  documentVersion: integer;
  sourceDigest: `sha256:${LowerHex64}`;
}
```

The result additionally binds the complete candidate digest, exact normalized
UTF-16 edits, affected entity and field identities, classification evidence,
and any recovery or authority evidence required by the selected class. Before
returning a result and immediately before providing an apply-time
`WorkspaceEdit`, the server rechecks cancellation and all document binding
fields. A mismatch returns stale and exposes no edit.

### 4.2 Complete semantic fingerprint

`Perttool.EditorSemanticFingerprint.v1` is a pure Core-owned digest input. It
is distinct from the source digest and from every plan-assurance hash. It
includes every checked semantic declaration, field, explicit-versus-omitted
choice where the grammar gives that choice source-contract meaning,
relationship, lifecycle state, work event, governance record, assurance
record, milestone-acceptance record, and ordered value whose order is
semantic. It excludes only lexical trivia that the active parser and formatter
classify as non-semantic: indentation, horizontal spacing, canonical quoting,
line-ending spelling, blank-line placement, and comments that own no versioned
semantic record.

The fingerprint is available only when both original and final candidate parse
and validate completely under the same active grammar and semantics. Unknown
grammar, incomplete projection, truncated input, invalid source, invalid
candidate, or an unclassified token makes semantic equivalence unavailable.
Plan-assurance hash equality alone never proves `E0` because those hashes
deliberately exclude lifecycle, work-event, formatting, and other fields.

### 4.3 Classification algorithm

The classifier receives the original snapshot and one complete final
candidate. It performs these steps in order:

1. reject invalid, incomplete, truncated, unbound, or over-limit input;
2. derive exact normalized edits and the complete affected entity/field set;
3. compare complete semantic fingerprints and collect every applicable rule;
4. evaluate unsealed closure, governance scopes, assurance effects,
   milestone-acceptance effects, destructive ranges, advance identity,
   history safety, and recovery;
5. select the maximum class among all applicable rules; and
6. return one closed evidence projection or a fail-closed diagnostic.

Zero edits produce an `E0` unchanged result. Any unknown or conflicting rule
is unclassifiable and returns `PTEDM-102`; it is not rounded down to `E2`.

## 5. Class E0: semantic-preserving formatting

An `E0` candidate MUST satisfy all of the following:

- original and candidate are complete and valid under the same grammar;
- their complete semantic fingerprints are byte-identical;
- every changed range is owned by the active whole-document formatter;
- applying the returned edits to the captured source produces the exact
  candidate bytes; and
- formatting the candidate again returns zero edits.

The server maps only this operation to LSP `textDocument/formatting`. It
validates the standard `FormattingOptions`, but perttool's canonical format is
not altered by client tab width, inserted spaces, trim, or final-newline
preferences. Unknown option extensions are ignored as LSP permits; invalid
required option shapes fail the request. The response is an ordered set of
non-overlapping UTF-16 `TextEdit` values that changes the smallest source
ranges represented by the Core edit planner. An unchanged document returns an
empty array. The server never returns a whole-document replacement merely for
adapter convenience when smaller normalized edits are available.

The VSIX registers the standard document formatter only after successful
model-2 negotiation. `editor.formatOnSave` remains a user-owned VS Code
setting; the extension neither enables nor changes it. Save-time execution
cannot escalate beyond `E0`. Failure, cancellation, staleness, invalid source,
or failed equivalence returns no edits and leaves the document unchanged.

## 6. Class E1: completely unsealed repair

`E1` permits only a repair or refactoring from a closed, versioned repair
registry. The final candidate must be complete and valid, and every affected
planning entity must belong to one complete affected closure whose assurance
state is exactly unsealed before and after the edit. The closure includes each
affected task, its explicit planning dependencies, and every dependent task
whose planning basis would change.

`E1` is unavailable if the candidate:

- creates, changes, removes, or depends on a plan seal, accepted task outcome,
  accepted milestone outcome, advance receipt, or governance owner/delegate;
- changes a goal or DAG governance scope;
- changes a sealed task's canonical planning basis or any accepted basis;
- removes a declaration or relies on Git/history proof;
- changes lifecycle or work-event evidence; or
- lacks an exact affected-closure proof.

An explicit Quick Fix or `source.fixAll.perttool` may return a versioned
`WorkspaceEdit` only after complete candidate validation. Automatic repair is
allowed only when every edit in the final batch is `E1`, the complete affected
closure is unsealed, no diagnostic or candidate is truncated, and a second
validation of the composed final candidate succeeds. `E1` never creates a
seal, reseals content, supplies an owner assertion, or restores start
authority implicitly.

The accepted [E1 Unsealed Editor Repair Contract](editor-repairs.md) fixes
registry `perttool.editor-repair` version 1 to the single
`duration_unit_to_point` repair. It accepts only exact `PTSEM-114` conversion
with an existing sufficient velocity and a whole-plan closure that is
`unsealed` before and after. Version 1 contains no refactoring, inferred input,
work-event change, protected record, or partial Fix All. That child contract is
contract-only until `EDITOR_REPAIR_ACCEPTANCE`; it does not yet activate an
edit-bearing Code Action or `source.fixAll.perttool`.

## 7. Class E2: non-destructive recoverable semantic edit

`E2` covers a semantic change that is not `E0` or `E1`, triggers no `E3` rule,
deletes no declaration or accepted evidence, and has a complete recovery
artifact. It may update ordinary maintenance fields or another later-accepted
closed operation when the complete final candidate validates.

Recovery is independent of editor Undo. It binds the original and candidate
document identities, contains normalized inverse edits, proves that applying
the inverse to the exact candidate recreates the exact original bytes, and is
retained by the extension until application succeeds or the binding becomes
stale. A missing, truncated, mismatched, or over-limit inverse escalates to
unavailable, not `E3` and not an unprotected `E2` edit.

`E2` is never implicit on save. The user invokes an exact contributed command,
reviews the complete candidate and diff, and then explicitly applies a
versioned `WorkspaceEdit`. The language server plans and checks the edit; the
editor owns buffer application. Neither component writes the workspace file
directly.

## 8. Class E3: authority-sensitive operation

Any one of the following makes the complete candidate `E3`:

- adding, changing, removing, accepting, or resealing a plan-assurance record,
  accepted task outcome, frontier receipt, or milestone-acceptance record;
- changing the canonical planning basis protected by an accepted seal or
  accepted outcome;
- changing a `goal` or `dag` governance scope under the active governance
  contract;
- deleting a declaration or accepted evidence;
- planning or applying canonical `dag advance` contraction;
- requesting `--force-history-loss`-equivalent authority; or
- requiring Git, repository, `HEAD`, stage-0 index, destructive-range, or
  history-safety evidence.

`E3` is absent from formatting, Code Action, Fix All, automatic repair, and
save-time paths. Its dedicated review UI shows the exact source binding,
operation identity, strictest class and causes, candidate digest, complete
diff, affected governance and assurance scopes, recovery boundary, required
actor/assertions, warnings, history facts, and whether an edit is currently
eligible. It uses accessible text as well as visual presentation and never
uses workspace text as executable HTML.

Preview does not grant authority. Apply re-evaluates the complete candidate
against the current snapshot and current authority inputs. Owner assertions
are candidate-bound and scope-bound, are never inferred from workspace trust
or earlier previews, and are not reused after any digest changes. Seal,
reseal, milestone acceptance, governance, and advance retain their existing
Core/Application contracts. Advance additionally retains exact current
repository, raw-byte `HEAD`, stage-0 index, destructive-range, race, and
history-loss rules. The adapter cannot weaken, bypass, or synthesize these
decisions.

An authorized response may carry a versioned `WorkspaceEdit`; it never writes
the file. The extension rechecks the document binding, applies the edit once,
and reports the actual editor result. A failed or partial editor application
is not recorded as semantic success and invalidates the preview.

## 9. Custom preview and apply boundary

`perttool/editorMutationPreview` accepts a closed operation ID and typed
operation parameters plus the complete document binding. It returns
`Perttool.EditorMutationPreviewResult.v1` with these closed top-level fields:

```text
schemaVersion, editorProtocolModelVersion, status, complete, previewId,
document, operation, mutationClass, causes, candidateSourceDigest,
semanticEvidence, authorityDecision, historyGuard, recovery, edits, diff,
diagnostics
```

`perttool/editorMutationApply` accepts only a retained `previewId`, the exact
document and candidate digests, actor, candidate-bound owner assertions, and
the operation-specific narrow force flags. It recomputes mutable evidence and
returns `Perttool.EditorMutationApplyResult.v1` with:

```text
schemaVersion, editorProtocolModelVersion, status, complete, previewId,
document, operation, mutationClass, candidateSourceDigest,
authorityDecision, historyGuard, recovery, workspaceEdit, diagnostics
```

Statuses are `preview`, `authorized`, `denied`, `invalid`, `unavailable`, and
`stale`. Only `preview` can contain preview edits and diff. Only `authorized`
can contain a `workspaceEdit`. A response with `complete: false` contains no
applicable edit. Preview IDs are opaque, unpredictable, connection-local,
single-document, bounded, and invalidated by close, new generation, newer
version, source-digest change, successful authorization, cancellation, or
server exit.

The methods are not a public CLI or package-root contract. Their adapter
schemas are self-contained and do not rename existing CLI result identities.

## 10. Diagnostics and protocol failures

| Code | Meaning |
| --- | --- |
| `PTEDM-101` | editor protocol model or operation is unsupported |
| `PTEDM-102` | strict mutation classification is unavailable or conflicting |
| `PTEDM-103` | complete semantic equivalence required for `E0` was not proved |
| `PTEDM-104` | document or candidate binding is stale |
| `PTEDM-105` | recovery proof is unavailable or mismatched |
| `PTEDM-106` | required governance or assurance authority is absent or denied |
| `PTEDM-107` | requested interaction or automation is forbidden for the class |
| `PTEDM-108` | a hard input, edit, diff, entity, recovery, or retained-preview limit was exceeded |
| `PTEDM-109` | required repository or history-safety proof is unavailable |
| `PTEDM-110` | the final mutation candidate is invalid or incomplete |

LSP cancellation uses `RequestCancelled` (`-32800`) and document-content
staleness uses `ContentModified` (`-32801`) where the standard error response
is available. Domain diagnostics remain structured result data for custom
methods. Diagnostics never substitute for a valid edit or authorize an
otherwise denied candidate.

## 11. Exact hard limits

Model-2 computations use these inclusive limits:

| Input or retained value | Limit |
| --- | ---: |
| original UTF-8 source bytes | 8,388,608 |
| final candidate UTF-8 bytes | 8,388,608 |
| normalized forward edits | 10,000 |
| normalized inverse edits | 10,000 |
| total UTF-8 replacement bytes in either direction | 8,388,608 |
| affected entity/field identities | 20,000 |
| rendered UTF-8 diff bytes | 1,048,576 |
| retained previews per connection | 8 |
| retained preview and recovery bytes per connection | 33,554,432 |

An inherited operation-specific limit may be stricter but never looser.
Exceeding any limit yields `PTEDM-108`, `complete: false`, and no applicable
edit. The server does not truncate a candidate, classification cause,
authority decision, recovery proof, or edit list and then label it complete.
A diff may be omitted only as an explicitly incomplete preview with no apply
eligibility.

## 12. Security, ownership, and recovery

- Core owns parsing, validation, semantic fingerprints, candidate planning,
  classification, recovery proof, governance, assurance, and advance meaning.
- Application owns request composition and immutable result identity.
- The Node Host supplies only already accepted filesystem, Git, digest, and
  safe-persistence ports required by the selected operation.
- The LSP owns protocol negotiation, synchronization, cancellation, request
  limits, and wire mapping. It never invokes the CLI.
- The VSIX owns commands, review interaction, accessibility, versioned editor
  application, and retained recovery presentation. It does not reimplement
  semantic classification or authority.
- The Webview receives only a sanitized, closed presentation projection. It
  cannot send source text, edits, commands, paths, Git arguments, assertions,
  or force flags directly to the server.
- No model-2 operation executes workspace code, loads a workspace module,
  searches `PATH`, opens a network endpoint, emits telemetry, or changes VS
  Code settings.

Untrusted and virtual workspaces may use `E0` and editor-buffer-only `E1` or
`E2` operations when their other proofs are complete. Trust remains neither
authority nor a safety proof. An `E3` operation requiring repository evidence
uses the stricter trusted local `file` and repository boundary fixed by its
later contract; otherwise it is unavailable.

## 13. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `EMC-001` | Baseline | model 1 remains exact and active; model 2 is not advertised by contract acceptance |
| `EMC-002` | Negotiation | ordered `[2,1]`, highest common selection, explicit model-1 fallback |
| `EMC-003` | Binding | URI, generation, version, source digest, candidate digest, cancellation, and stale checks |
| `EMC-004` | Fingerprint | complete semantic fingerprint is distinct from source and assurance hashes |
| `EMC-005` | Precedence | classify one complete final candidate and choose the strictest applicable class |
| `EMC-006` | Unknown | invalid, incomplete, truncated, or ambiguous candidates expose no edit |
| `EMC-007` | E0 identity | valid semantic-equivalent candidate, exact normalized edits, idempotence |
| `EMC-008` | E0 protocol | standard whole-document formatting only; no range/on-type/generic command |
| `EMC-009` | E0 save | only user-enabled format on save; failure or stale result returns no edits |
| `EMC-010` | E1 closure | all affected tasks and dependents are exactly unsealed before and after |
| `EMC-011` | E1 interaction | explicit Quick Fix/Fix All; automatic repair needs complete homogeneous validation |
| `EMC-012` | E1 exclusion | no seal, accepted basis, governance scope, deletion, lifecycle, or history proof |
| `EMC-013` | E2 recovery | exact inverse reconstructs original bytes independently of Undo |
| `EMC-014` | E2 interaction | explicit command, complete preview, then versioned editor application |
| `EMC-015` | E2 exclusion | no destructive or E3 authority-sensitive cause |
| `EMC-016` | E3 assurance | seal, reseal, accepted outcome, accepted basis, or milestone acceptance requires E3 |
| `EMC-017` | E3 governance | goal/DAG scope uses the current candidate-bound GovernanceDecision |
| `EMC-018` | E3 advance | canonical contraction and exact repository/history safety remain mandatory |
| `EMC-019` | E3 interaction | dedicated review UI; never formatting, Code Action, Fix All, or save |
| `EMC-020` | Preview/apply | preview grants no authority; apply rechecks binding and mutable evidence |
| `EMC-021` | Editor ownership | server returns edits; editor applies once; no adapter filesystem write |
| `EMC-022` | Recovery failure | missing, mismatched, or over-limit recovery fails closed |
| `EMC-023` | Limits/diagnostics | exact limits and `PTEDM-101` through `PTEDM-110`; no complete truncated result |
| `EMC-024` | Compatibility | active Grammar, CLI, schemas, exports, LSP/VSIX bytes, releases, and publication remain unchanged |

The machine fixture owns the closed class, interaction, method, status,
diagnostic, hard-limit, and case inventories. Cases are dependency ordered.

## 14. Acceptance boundary

Acceptance requires parent-contract agreement, requirements and Basic Design
traceability, all 24 machine cases, model-1 contract regression, direct proof
that the current server does not advertise formatting or model 2, documentation
and English checks, self-use registration, the complete repository gate, and
reviewed diff agreement.

This task may mark only `EDITOR_MUTATION_CONTRACT` complete and may register
its exact plan-assurance outcome candidate for owner review. It does not
authorize runtime activation, VSIX installation, release selection, public
VSIX publication, GitHub Issue mutation, remote writes, plan advance, or any
later `E1` through `E3` behavior.

# E1 Unsealed Editor Repair Contract

Status: Accepted design target for `EDITOR_REPAIR_CONTRACT`

This contract refines class `E1` of the
[Tiered Editor Mutation Contract](editor-mutations.md). It fixes the first
closed repair registry, the exact unsealed-closure proof, and the standard LSP
interaction. It does not activate an edit-bearing Code Action. Runtime
activation remains gated by `EDITOR_REPAIR_ACCEPTED` in
[`plans/editor-mutations.pert`](../../plans/editor-mutations.pert).

## 1. Scope and non-goals

The target is one buffer-only repair for a valid Grammar 6 or Grammar 7 plan:
the exact `day` or `hour` to `point` conversion already described by
`PTSEM-114` and `project migrate-unit`. The repair is eligible only when the
document's existing declared velocity is sufficient, every task belongs to a
complete assurance closure that is `unsealed` before and after the candidate,
and the complete candidate remains class `E1`.

This contract does not:

- infer or request a missing or replacement velocity;
- add a rename, reference retarget, declaration removal, or arbitrary field
  edit;
- change a work event, lifecycle state, plan seal, task outcome, assurance
  receipt, milestone criterion or receipt, governance principal, goal, or DAG;
- accept a hash, create or refresh a seal, synthesize an owner assertion, or
  restore start authority;
- read a path, inspect Git, invoke the CLI, persist a document, save an editor,
  or configure Code Actions on Save;
- add `textDocument/rename`, range formatting, on-type formatting, a custom
  mutation method, a public package export, a root schema, or a CLI command; or
- select a release, publish a VSIX, mutate Issue #13, advance the plan, or
  perform another remote write.

The taxonomy recognizes `repair` and `refactoring` as distinct registry entry
categories. Registry version 1 contains one `repair` and no `refactoring`.
Adding even a deterministic refactoring requires a later registry version and
an accepted contract amendment; an unregistered operation is not `E1`.

## 2. Verified baseline and ownership

The contract is based on source version `0.9.3`, Grammar 7, CLI Contract 8,
53 commands, 23 root schemas, 129 root and Node runtime exports, and 45 Core
runtime exports. Editor Protocol model 2 and whole-document `E0` formatting
are active in the private LSP and VSIX. The existing `textDocument/codeAction`
surface remains the model-1-compatible, read-only Help action: it carries a
command and no `WorkspaceEdit`. `source.fixAll.perttool` and every edit-bearing
repair action remain inactive at this contract slice.

Ownership is fixed as follows:

- the semantic validator owns `PTSEM-114` and its source range;
- the existing exact unit-migration Core owns conversion arithmetic, field
  inventory, normalized source edits, candidate validation, and `PTMIG-*`
  causes;
- plan-assurance Core owns task contracts, explicit planning relations,
  computed bases, task status, and affected-closure evaluation;
- governance Core owns the exact goal/DAG affected-scope classification;
- editor-mutation Core owns the strictest candidate class, document and
  candidate binding, normalized inverse, limits, and `PTEDM-*` failures;
- Application composes those pure projections without weakening one of them;
- the LSP maps one eligible candidate to standard `CodeAction` and
  `WorkspaceEdit` values; and
- VS Code owns the user request, buffer application, optional save-time source
  action configuration, Undo, and persistence.

The LSP, VSIX, and webview do not reimplement unit conversion, assurance,
governance, or mutation classification.

## 3. Closed repair registry version 1

The registry identity is `perttool.editor-repair` version 1. Its sole entry is:

| Field | Fixed value |
| --- | --- |
| repair ID | `duration_unit_to_point` |
| category | `repair` |
| source diagnostic | `PTSEM-114` |
| source grammar | 6 or 7 |
| source unit | `day` or `hour` |
| target unit | `point` |
| request | `{ targetUnit: "point", replacementVelocity: null }` |
| explicit action title | `Migrate duration unit to point` |
| explicit kind | `quickfix` |
| document-wide kind | `source.fixAll.perttool` |
| automatic eligibility | document-wide kind only, under Section 8 |

The operation uses the existing declared velocity exactly. It is unavailable
when velocity is absent, invalid, incompatible with the source unit, or would
need replacement. The editor never guesses a velocity and never exposes an
input prompt as part of this Code Action.

The conversion inventory may include `project.critical_epsilon`,
`project.target_duration`, and every task `duration` or three-point estimate.
An inventory containing any `work_event.planned_value` makes the E1 repair
unavailable because class E1 cannot alter work-event evidence. All absolute
date/time fields remain byte-identical. The candidate changes
`project.duration_unit` and only the exact duration tokens returned by the
conversion inventory. It retains the existing velocity token.

## 4. Source and candidate admissibility

Planning starts from the exact current document-session binding:

```text
documentUri
documentGeneration
documentVersion
sourceDigest
```

The source must be complete, untruncated, valid Grammar 6 or Grammar 7, use
`duration_unit day|hour`, and contain exactly one actionable `PTSEM-114`.
Plan assurance model 1 and hash model 1 must be enabled. An absent, unknown,
invalid, or truncated assurance projection cannot establish `E1`.

The complete candidate must:

1. be the byte result of applying the normalized Core edits to the bound
   source;
2. be complete, untruncated, and valid under the same grammar;
3. use `duration_unit point` and retain the exact declared velocity token;
4. contain the exact converted inventory and no edit outside that inventory
   plus `project.duration_unit`;
5. remove the actionable `PTSEM-114` without suppressing another diagnostic;
6. preserve every absolute temporal token, declaration, reference, lifecycle
   field, work event, assurance record, acceptance record, governance field,
   comment, BOM, line-ending convention, and non-target byte range;
7. have no goal or DAG governance scope and no destructive record range;
8. pass the before-and-after closure proof in Section 5;
9. pass strictest-class classification as exactly `E1`; and
10. satisfy the parent editor-mutation limits without truncated evidence.

A no-op, a point-source document, or a candidate with an unexpected edit is
not an E1 action.

## 5. Complete unsealed affected closure

Registry version 1 defines the direct affected task set as every task whose
canonical planning contract or computed basis changes because of the project
unit context or a converted duration token. The complete affected closure is
the least fixed point containing:

- every direct affected task;
- every explicit planning predecessor of a member, recursively; and
- every dependent task whose computed planning basis changes, recursively.

For this document-wide unit conversion, the proof MUST also evaluate every
task in the plan; a planner cannot reduce the closure merely because an exact
numeric conversion preserves a schedule value. Task identity, task contract
hash, computed basis, and the relation path that admitted each task are
reported in deterministic evaluator order.

The source and candidate assurance evaluations must both be complete with
coverage `unsealed`, and every task in the complete plan must have task status
`unsealed`. No task in either evaluation may have an accepted basis, seal,
outcome, exported accepted assurance hash, mismatch, unavailable cause, or
required authority-restoration action. The before and after task ID sets and
explicit planning-relation identities must be identical.

Any `plan_seal`, `task_outcome`, or `assurance_receipt` declaration therefore
makes this registry entry unavailable. A milestone criterion set or acceptance
receipt also makes it unavailable even when the unit planner would preserve
its bytes: accepted milestone evidence is a protected E3 boundary, not an E1
shortcut. Grammar 7 migration baseline bytes may remain only when they are not
changed, removed, or used as authority or history proof for this operation.

If one protected record or non-unsealed task is discovered, the complete
candidate is not split. It classifies at the strictest applicable later class,
and no E1 Code Action is returned.

## 6. Candidate and recovery evidence

The internal immutable candidate projection is
`EditorRepairCandidateV1`. It is not a public JSON result or package export.
It contains at least:

- registry identity and repair ID;
- original document binding and source digest;
- source and target grammar and unit;
- original and candidate digests;
- exact converted-field inventory;
- normalized forward and inverse source edits;
- affected task IDs, relation paths, contract hashes, computed bases, and
  before/after task states;
- complete-validation, assurance, governance, destructive-range, diagnostic,
  and limit evidence;
- requested interaction and automatic trigger status; and
- final class, completeness, and unavailable cause.

Applying the forward edits to the exact source must produce the exact
candidate, and applying the inverse edits to that exact candidate must produce
the exact original bytes. This proof supports editor Undo and test recovery;
unlike E2, E1 does not retain a separate post-application recovery artifact or
offer a custom recovery command. Missing or mismatched inverse evidence yields
no edit.

## 7. Explicit Quick Fix

For an explicitly invoked Code Action request, the requested range must
intersect the exact current `PTSEM-114` range. The server plans the complete
document candidate and returns at most one preferred `quickfix` action. It
attaches the source diagnostic and a `WorkspaceEdit` using
`documentChanges`, not the unversioned `changes` form. The text-document URI
and version are exact; every edit is ordered, non-overlapping, and represented
in UTF-16.

The action contains no executable command. Opaque `data` may repeat the
registry version, repair ID, source digest, and candidate digest for
diagnostics, but the client must not treat it as authority. If the source is
ineligible, stale, cancelled, malformed, or over limit, the server returns no
edit-bearing action.

## 8. Fix All and opt-in automatic interaction

`source.fixAll.perttool` is document scoped. Registry version 1 deduplicates
all matching `PTSEM-114` observations into exactly one unit-migration planner
request. A duplicate, stale, or malformed diagnostic cannot cause the
conversion to run twice.

Composition is atomic over one complete final candidate:

- candidates are ordered by registry order and then source range;
- overlapping or conflicting edits make the whole composition unavailable;
- every selected entry must classify as E1 over the original and composed
  candidate;
- the union closure must be complete and unsealed before and after;
- the composed candidate is validated and classified again; and
- no eligible repair is silently dropped to make a partial Fix All pass.

With registry version 1, the maximum composed operation count is one. These
composition rules are nevertheless normative so a later registry amendment
cannot weaken atomicity.

An automatic LSP request may return only `source.fixAll.perttool`, only when
the client explicitly requests that kind, and only after the same complete
composition and a second current-binding check. The extension does not add or
change `editor.codeActionsOnSave`. A user may opt in through the editor's own
configuration. An automatic request for `quickfix`, an unrestricted automatic
request, or any mixed-class batch returns no edit-bearing action.

## 9. Strict escalation and unavailable behavior

The server never asks for an owner assertion or another authority input while
handling E1. The following boundaries prevent an E1 action:

- accepted or non-unsealed assurance state, milestone acceptance evidence, or
  an authority-restoration effect: classify as E3 and withhold the action;
- goal/DAG governance effect, declaration or evidence deletion, lifecycle or
  work-event change, or Git/history dependency: classify as E3 and withhold;
- a valid non-destructive semantic edit not registered by this contract:
  classify under E2 when its later contract is available, otherwise withhold;
- unknown, conflicting, incomplete, or truncated evidence: `PTEDM-102` or
  `PTEDM-110`, complete false, and no edit;
- stale binding: LSP `ContentModified` where a request error is available, or
  no action when discovery races the current snapshot;
- cancellation: LSP `RequestCancelled` where available and no action; and
- limit failure: `PTEDM-108`, complete false, and no edit.

There is no partial edit, fallback CLI invocation, hidden E2/E3 preview,
automatic seal, or best-effort conversion.

## 10. Diagnostic ownership

| Diagnostic | Owner and E1 meaning |
| --- | --- |
| `PTSEM-114` | semantic validator; the only registry-v1 source diagnostic |
| `PTMIG-401` through `PTMIG-409` | unit-migration source/request/conversion/candidate refusal; never rewritten as editor authority |
| `PTEDM-102` | editor classifier; strict class or complete closure unavailable/conflicting |
| `PTEDM-104` | editor binding stale |
| `PTEDM-105` | normalized inverse or exact recovery proof unavailable/mismatched |
| `PTEDM-107` | requested automatic or action interaction is forbidden |
| `PTEDM-108` | inherited or editor hard limit exceeded |
| `PTEDM-110` | complete final candidate invalid or incomplete |

The LSP reuses the source `PTSEM-114` diagnostic in an eligible Quick Fix. It
does not publish a second repair-specific warning. Ineligibility retains the
original semantic diagnostic and exposes no edit. Diagnostics do not grant
authority and are not proof that an action remains current.

## 11. Limits, trust, and no-write behavior

All parent editor-mutation limits apply. The existing unit-migration planner's
stricter input or inventory limit applies when one exists. A planner may not
truncate diagnostics, converted fields, affected tasks, relation paths,
edits, inverse edits, or classification evidence and still return a Code
Action.

Because the operation consumes only the synchronized buffer and pure shared
services, an otherwise eligible local, untitled, untrusted, or virtual
document may receive the same version-bound edit. Trust does not grant E1
eligibility, and local-file or Git identity does not strengthen it. The LSP
does not read or write the URI as a path. The editor applies at most one
versioned `WorkspaceEdit`; save remains a separate user/editor action.

## 12. Activation and compatibility boundary

Acceptance of this contract changes documentation and test fixtures only.
Until `EDITOR_REPAIR_ACCEPTANCE` is independently accepted:

- model 2 advertises whole-document formatting but no
  `source.fixAll.perttool` capability;
- existing read-only Help Code Actions remain unchanged for model 1 and 2;
- no Code Action contains a repair `WorkspaceEdit`;
- model 1 remains read-only;
- E0 formatting behavior and all current CLI, package, schema, MCP, historical,
  DAG, governance, assurance, and milestone-acceptance identities remain
  unchanged; and
- package version `0.9.3`, npm tags, installed VSIX state, release state,
  Issue #13, and plan-advance state remain unchanged.

The implementation task must extend the shared Grammar 6 unit-migration path
to Grammar 7 without changing its current CLI meaning, implement the exact
candidate/closure projection, activate only the two accepted Code Action
kinds for model 2, and pass the machine cases below before this boundary can
move.

## 13. Machine-readable acceptance cases

The authoritative cases are in
[`test/fixtures/editor-repair-contract-v1.json`](../../test/fixtures/editor-repair-contract-v1.json).
They are dependency ordered and closed:

| ID | Boundary | Expected result |
| --- | --- | --- |
| `ERC-001` | baseline | E0 model 2 active; edit-bearing E1 actions inactive |
| `ERC-002` | registry | one repair, no refactoring, unknown IDs unavailable |
| `ERC-003` | diagnostic | only current `PTSEM-114` selects the repair |
| `ERC-004` | day conversion | existing day velocity converts exactly to points |
| `ERC-005` | hour conversion | existing hour velocity converts exactly to points |
| `ERC-006` | missing/replacement velocity | no inferred value, prompt, or action |
| `ERC-007` | grammar | only complete valid Grammar 6 or 7 source is eligible |
| `ERC-008` | inventory | exact project/task duration inventory and temporal preservation |
| `ERC-009` | work event | candidate that changes work-event evidence is withheld |
| `ERC-010` | closure | every task and planning dependency is proven |
| `ERC-011` | before state | source coverage and every task are unsealed |
| `ERC-012` | after state | candidate coverage and every task remain unsealed |
| `ERC-013` | protected evidence | seal/outcome/receipt/acceptance makes the action E3 |
| `ERC-014` | governance/history | protected scope, deletion, or history dependency is E3 |
| `ERC-015` | Quick Fix | one preferred diagnostic-bound versioned edit |
| `ERC-016` | Fix All | one deduplicated atomic document candidate |
| `ERC-017` | automatic | only explicit opt-in `source.fixAll.perttool` may run |
| `ERC-018` | composition | conflict, mixed class, or partial eligibility yields no edit |
| `ERC-019` | classification | strictest whole-candidate class cannot be split or downgraded |
| `ERC-020` | recovery | forward and inverse reproduce exact candidate and source bytes |
| `ERC-021` | cancellation/staleness/limits | fail closed without an applicable edit |
| `ERC-022` | compatibility | contract-only artifacts change no active runtime or release state |


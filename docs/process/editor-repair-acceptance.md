# E1 Editor Repair Acceptance

- Document status: Local implementation acceptance 1.0
- Date: 2026-08-14
- Workstream: `EDITOR-MUTATION-001`
- Task: `EDITOR_REPAIR_ACCEPTANCE`
- Plan: [../../plans/editor-mutations.pert](../../plans/editor-mutations.pert)
- Contract: [../specs/editor-repairs.md](../specs/editor-repairs.md)
- RCA: [editor-repair-acceptance-rca.think](editor-repair-acceptance-rca.think)
- Machine cases:
  [../../test/fixtures/editor-repair-acceptance-v1.json](../../test/fixtures/editor-repair-acceptance-v1.json)

## 1. Root cause and accepted correction

The finalized llmthink RCA found a deliberate activation gap rather than a
defect in the existing unit-migration arithmetic. Contract acceptance fixed
the E1 rules, and `project migrate-unit` already produced exact normalized
day/hour-to-point candidates, but no editor-owned whole-candidate evaluator,
Application composition, or edit-bearing LSP mapping existed.

The accepted correction adds those three bounded owners:

- `src/editor/repair.ts` evaluates one immutable candidate from registry
  `perttool.editor-repair` version 1, proves strict class E1, complete unsealed
  before/after assurance, exact forward and inverse bytes, unchanged
  declaration and relation identities, no protected record, and all parent
  limits;
- `src/application/editor-repair.ts` composes Contract 8 document checking,
  the existing unit-migration planner, Grammar 6/7 assurance evaluation, and
  protected-record evidence without changing those services; and
- the private LSP composes that Application and maps only an eligible current
  result to standard `quickfix` or `source.fixAll.perttool` Code Actions.

The evaluator and Application remain private implementation modules. They add
no public package export, root schema, CLI command, dependency, custom LSP
request, extension command, or setting.

## 2. Exact interaction and failure closure

An explicit request must intersect the current `PTSEM-114` diagnostic. The LSP
returns at most one preferred Quick Fix with a versioned `documentChanges`
WorkspaceEdit and no command. Fix All deduplicates matching diagnostics into
one atomic document candidate. An automatic request is eligible only when it
explicitly requests `source.fixAll.perttool`; automatic Quick Fix,
unrestricted automatic discovery, and mixed-kind requests expose no edit.
Before mapping edits, the LSP independently rechecks the returned registry,
repair ID, document URI, generation, version, source digest, interaction,
automatic flag, normalized ordered ranges, and reconstructed candidate digest.

Missing velocity, protected assurance or milestone evidence, work-event
inventory, malformed candidate edits, invalid or incomplete source,
cancellation, staleness, an ineligible range, a model-1 connection, and every
binding or limit failure all fail closed. Model 1 retains only read-only Help.
E0 formatting remains unchanged and can run on the same model-2 connection.

The 24 dependency-ordered `ERA-001` through `ERA-024` cases cover Grammar 6
day and Grammar 7 hour conversion, exact inventory and recovery, complete
closure, strict escalation, Quick Fix, Fix All, duplicate diagnostics,
automatic and mixed requests, malformed output, cancellation, staleness,
model-1 compatibility, E0 compatibility, URI/trust neutrality, stdio
composition, supported-host application and Undo, and public identity closure.

## 3. Supported-host and no-write evidence

The disposable private VSIX gate packages the bundled server, installs it into
isolated extension and profile directories, and runs exact VS Code `1.101.0`
under trusted and untrusted workspace modes. Each host observes the current
`PTSEM-114`, obtains the preferred Quick Fix, applies the returned
WorkspaceEdit exactly once, observes the point-unit buffer candidate, and uses
editor Undo to recover the exact original text and clean state.

The server never reads or writes the document URI as a path. The fixture file,
tracked non-target plan, workspace inventory, and user settings are verified
unchanged after both host runs. The disposable extension is replaced once and
then uninstalled with an empty extension-registry readback. No persistent local
VSIX replacement occurred.

## 4. Verification and compatibility

The focused build and dependency-ordered Core, Application, LSP, stdio, E0,
contract, and integration run passed 48 tests. The supported-host VSIX shell,
package, replacement, trusted/untrusted activation, application, Undo, and
uninstall gate passed.

The pinned static gates pass without an increased allowance:

- jscpd `5.0.15`: 148 clones, 2,746 duplicated lines, 3.311 percent; and
- Lizard `1.23.0`: 3,571 functions and 170 retained legacy entries.

The change removes three stale Lizard exceptions after splitting the host and
stdio responsibilities. It adds no exception and raises no threshold. Grammar
7, CLI Contract 8, 53 commands, 23 root schemas, 129 root and Node exports, 45
Core exports, package version `0.9.4`, MCP behavior, release state, and npm
tags remain unchanged.

## 5. Plan and authority boundary

The complete repository gate passed after the focused and dependency-boundary
corrections: type checking, 1,098 tests, English and Markdown, 43-plan
self-use, isolated LSP and MCP packages, supported-host VSIX, temporary link,
and the 725-file public package workflow. Implementation commit `58ed7a6`
fixes those exact accepted bytes.

The exact expected-digest status-only write then changed plan digest
`sha256:fac511d0...87af00` to `sha256:bb9fd570...04d3b4` and marked only
`EDITOR_REPAIR_ACCEPTANCE` done. Readback reports closure of
`EDITOR_REPAIR_ACCEPTED`, but its milestone acceptance is `not_declared` and
the task outcome is unavailable because it is missing. Seven assurance task
results are therefore unavailable and the required action is
`restore_assurance_evidence` rooted at `EDITOR_REPAIR_ACCEPTANCE`. Although
`dag next` projects `EDITOR_RECOVERABLE_CONTRACT` as the structural ready and
recommended task, a start preview adds `PTASSURE-204` active-attention state;
it is not the current execution frontier.

Reached-milestone criteria, an acceptance receipt bound to a committed
revision, and a conformant plan-assurance outcome require their own fresh
candidate-bound confirmations and are not implied by implementation
acceptance. The current execution frontier is that evidence sequence, not E2.

E2/E3 work, persistent local VSIX installation, release selection, public VSIX
publication, remote writes, Issue mutation, npm mutation, and plan advance
remain separate decisions.

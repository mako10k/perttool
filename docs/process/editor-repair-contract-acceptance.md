# E1 Editor Repair Contract Acceptance

Date: 2026-08-14

Scope: `EDITOR_REPAIR_CONTRACT` design and machine-contract acceptance only.

## Accepted result

The [E1 Unsealed Editor Repair Contract](../specs/editor-repairs.md) is
accepted as the exact child contract for class E1 of the tiered editor-mutation
model. Registry `perttool.editor-repair` version 1 contains one repair,
`duration_unit_to_point`, and deliberately contains no refactoring. The repair
reuses the exact `PTSEM-114` and unit-migration meaning only when a complete
valid Grammar 6 or Grammar 7 buffer has a sufficient existing velocity and
every task is proven `unsealed` before and after the complete candidate.

The contract closes these boundaries:

- the exact registry entry, source diagnostic, supported grammar/unit set,
  target unit, title, Quick Fix kind, and Fix All kind;
- complete source/candidate validation and an exact conversion inventory;
- a whole-plan fixed-point assurance closure with no accepted basis or
  protected assurance/milestone record;
- strict escalation rather than partial repair when governance, lifecycle,
  work-event, deletion, history, or accepted authority is involved;
- one versioned `documentChanges` WorkspaceEdit, exact forward/inverse byte
  recovery, atomic Fix All, and explicit opt-in automatic behavior;
- semantic, unit-migration, and editor diagnostic ownership; and
- contract-only compatibility with active E0 formatting and read-only Help
  Code Actions.

No missing velocity is inferred. No prompt, owner assertion, seal, accepted
hash, authority restoration, lifecycle event, Git proof, CLI subprocess,
direct file write, editor save, or settings mutation is permitted.

## Evidence

The machine contract is
[`test/fixtures/editor-repair-contract-v1.json`](../../test/fixtures/editor-repair-contract-v1.json).
`ERC-001` through `ERC-022` are complete and dependency ordered. The focused
test checks the single-entry registry, exact conversion and closure rules,
Quick Fix/Fix All/automatic boundaries, recovery, diagnostics, active runtime
counts, and the absence of repair code in the current LSP/VSIX surface.

The source audit also confirmed:

- current goal governance is limited to `finish`, `goal_owner`, and
  `goal_delegates`, while DAG governance is limited to structural task/gate
  changes and DAG principals; the bounded unit conversion itself has no
  goal/DAG scope;
- the existing unit-migration planner already owns exact rational conversion,
  field inventory, validation, normalized edits, temporal preservation, and
  assurance-owned-source preservation for Grammar 6;
- Grammar 7 still needs the implementation task's explicit adapter/Core
  extension; this contract does not claim it is already active; and
- current edit-bearing E1 Code Actions and `source.fixAll.perttool` are absent,
  while existing read-only Help Code Actions remain compatible.

## Unchanged boundaries

This acceptance adds no runtime capability. `EDITOR_REPAIR_ACCEPTANCE` remains
the only next implementation gate. E0 formatting, model-1 fallback, the CLI,
public facades, schemas, MCP, historical and DAG views, package version
`0.9.3`, npm tags, installed VSIX state, Issue #13, release state, remote refs,
and plan-advance state remain unchanged.

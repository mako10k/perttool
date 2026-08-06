# Declaration Identity Correction Acceptance

- Status: Accepted 1.0
- Decision date: 2026-08-06
- Work item: `DECL-ID-001`
- Release input: next compatible release gate
- Normative sources:
  [Plan Assurance Interface](../specs/plan-assurance-interface.md) and
  [Editor Protocol](../specs/editor-protocol.md)

## 1. Finding and corrected boundary

A valid Grammar 6 document intentionally gives each `plan_seal` the ID of its
referenced task. The semantic validator excludes a seal from the global
non-seal entity-ID collision rule, and source order is not semantic. The
runtime nevertheless had three order-dependent paths:

1. direct `task add` appended after every existing assurance, outcome,
   receipt, and work-event declaration;
2. task mutation and lifecycle validation selected the first declaration with
   the requested ID before checking its kind; and
3. LSP definition selected the first same-ID declaration without interpreting
   the seal header as a task reference.

After an existing outcome, adding and then sealing a task could therefore
place the same-ID seal before the task. `task set` and lifecycle failed closed
against the seal with a wrong-kind diagnostic, while LSP definition navigated
to the seal range. The ordinary mutation path did not overwrite seal fields in
the reproduced case, but its target selection was still incorrect.

The correction adds one shared declaration insertion primitive, inserts tasks
before the first relation, seal, outcome, receipt, or work event, resolves
task-specific operations by `(kind=task, id)`, and makes definition resolution
prefer the non-seal declaration. Existing valid noncanonical source order is
preserved; no formatter reorder or automatic document rewrite is introduced.

## 2. Closed acceptance cases

| ID | Case | Accepted result |
| --- | --- | --- |
| `DI-01` | Add a task to a sealed document with an outcome | The task is inserted before the first assurance record. |
| `DI-02` | Existing seal and outcome bytes | Both remain byte-identical after task addition. |
| `DI-03` | Seal the newly added task | The source remains valid and task identity stays distinct from the same-ID seal. |
| `DI-04` | Preserve a valid source whose seal precedes its task | The source validates without canonical reordering. |
| `DI-05` | Set a task field in that source | Only the task range changes; the seal block remains byte-identical. |
| `DI-06` | Start that task through lifecycle mutation | Task status and owned work event change; the seal block remains byte-identical. |
| `DI-07` | Request LSP definition from the task ID | The result selects the task ID range, never the earlier seal range. |
| `DI-08` | Existing mutation, assurance, actuals, LSP, and VSIX gates | Existing behavior remains compatible. |

The focused `test/declaration-identity-order.test.mjs` exercises the first
seven cases. The existing mutation, temporal mutation, governance preview,
actuals lifecycle, assurance mutation, public Contract 7, LSP acceptance, and
VSIX tests provide the immediate compatibility trace. The complete repository
gate, isolated packages, temporary link, and disposable VSIX host passed in
the accepted correction state and remain required at release-candidate
acceptance.

The accepted Node.js 22 gate is:

```sh
npm run check
git diff --check
```

It passed 958 tests, the 771-file English baseline, 208 Markdown documents,
all 35 registered self-use plans, isolated LSP and MCP packages, the disposable
minimum-version VS Code host, temporary package linking, npm publication
dry-run, and isolated installed Contract 7 and plan-assurance checks.

## 3. Compatibility and non-goals

This correction retains Grammar 6, CLI Contract 7, every command and option,
all result and schema identities, package-root exports, governance and
plan-assurance meanings, history safety, source-preserving mutation, and the
existing failure policy for genuinely wrong entity kinds. It adds no syntax,
result field, editor mutation, semantic token capability, automatic reseal,
plan advance, three-way merge, MCP mutation, Marketplace publication, or npm
`latest` movement.

The correction itself is backward compatible. The current source also contains
unreleased additive public surfaces after `0.7.1`, so version selection belongs
to the next release self-review and must not misclassify the complete source as
a patch. Public publication remains gated by one immutable candidate and the
separate release procedure.

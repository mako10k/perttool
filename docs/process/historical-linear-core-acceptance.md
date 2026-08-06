# Historical Linear Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-06
- Implementation baseline: `9106d27cbca5018a95f5091e9498dcddf6437579`
- Plan: [`plans/historical-dag.pert`](../../plans/historical-dag.pert)
- Plan task: `HISTORICAL_LINEAR_CORE`
- Normative contract: [Historical DAG Reconstruction Contract](../specs/historical-dag.md)
- Historical DAG model: `Perttool.HistoricalDagModel.v1`
- Ancestry profile: `first_parent`
- Active public runtime: unchanged Grammar 6 and CLI Contract 7

## 1. Decision

Accept the internal pure historical linear reconstruction. The
`reconstructHistoricalLinearHistory` function in
`src/history/historical-graph.ts` consumes only the accepted immutable Git
evidence record, reconstructs semantic checkpoints, selected snapshot, proved
lineage, and timeline, and returns one closed immutable model-1 result.

This acceptance does not activate the reserved
`Perttool.HistoricalGraphResult.v1`, `PTHDG-*` diagnostics, a command, schema,
package-root/Core/Node export, Node Host method, LSP request, VSIX feature, MCP
capability, cache, or write operation. Current `project history`, `dag render`,
44 Contract 7 commands, 20 root schemas, and the exact 122 root/Node and 45 Core
runtime catalogs remain unchanged.

The one new internal TypeScript source advances the closed source-file
inventory from 159 to 160. The Node Host boundary fixture records that exact
change without changing a port, builtin owner, public export, production
dependency, command, or schema.

## 2. Classification and continuity

The fold verifies the complete repository/read-snapshot/path/commit/blob/source
binding before semantic reconstruction. Every raw snapshot independently
passes UTF-8 decoding, supported Grammar 1 through 6 parsing, semantic
validation, stored lifecycle validation, plan-assurance observation, and the
accepted transition projection. Source validity and assurance state remain
separate.

Only semantic-valid sources become checkpoints. Missing, invalid,
grammar-unsupported, syntax-invalid, and semantic-invalid inputs remain exact
timeline entries and close the current continuity segment. No transition,
occurrence identity, canonical advance, or lineage is inferred across the gap.
An invalid endpoint remains the selected commit with a null selected snapshot;
the newest earlier valid commit is only `effective_checkpoint_id` metadata.

## 3. Exact transitions and canonical advance

Connected valid checkpoints reuse
`Perttool.HistoricalTransitionModel.v1`. The fold preserves
representation-only, evidence-extension, lifecycle, future-plan, ambiguous,
conflicting, and merge-provenance distinctions. Stable work events retain one
exact frozen payload; a changed payload under the same ID selects no winner and
makes lineage unavailable.

For each connected pair, the fold calls the active assurance-preserving advance
planner with preview intent and no owner assertion, repository proof, force, or
persistence assumption. It supplies a compatible candidate to the transition
classifier only when the candidate semantic digest and complete removed task,
gate, milestone, work-event, assurance-record, and state-change summary equal
the observed next checkpoint. A proved transition retires the removed
occurrences, retains their last valid context, freezes removed events, and
records both immutable checkpoint bindings plus planner version
`perttool.canonical-advance.v1`.

## 4. Views, bindings, and limits

The selected snapshot contains exactly one checkpoint graph. Timeline preserves
every inspected input, transition class, merge provenance, topology epoch, and
continuity segment. Lineage starts from observed occurrences and adds retired
topology only through proved canonical advance. It is null for an affecting
gap, ambiguous identity reuse, contradictory frozen evidence, noncanonical
removal, open endpoint, topology conflict, or cycle that exists only in the
cumulative lineage.

Every checkpoint carries immutable declaration, field, and nested-field
bindings over repository ID, repository-relative path, commit, blob, source
digest, and exact UTF-16 range. The fold never applies them to current worktree
bytes.

Production fixes the exact output limits from the normative contract:

| Output | Limit |
| --- | ---: |
| Entity value epochs | 100,000 |
| Transition records | 2,047 |
| Rendered graph occurrences | 20,000 |
| Historical source bindings | 100,000 |

Counts are preflighted before transition or graph-array construction. Overflow
returns `incomplete/hard_limit` with no silently truncated checkpoints,
selected snapshot, lineage, or timeline. Smaller overrides are dependency-test
inputs only and are not public request fields.

## 5. Accepted cases

The dependency-ordered matrix is
[`historical-linear-core-v1.json`](../../test/fixtures/historical-linear-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `HLR-001` | One exact selected snapshot and no invented history |
| `HLR-002` | Independent source validity, invalid endpoint, and continuity gaps |
| `HLR-003` | Representation-only, future-plan, topology-epoch, and assurance separation |
| `HLR-004` | Stable actual freezing and changed-payload conflict |
| `HLR-005` | Exact canonical advance and retired-topology rehydration |
| `HLR-006` | Noncanonical deletion combined with an unrelated edit |
| `HLR-007` | No invented occurrence identity after an invalid gap |
| `HLR-008` | Timeline retained and lineage rejected for a union-only cycle |
| `HLR-009` | First-parent merge provenance without side-lane inspection |
| `HLR-010` | Output hard limits and shallow completeness |
| `HLR-011` | Immutable source bindings and byte-deterministic reconstruction |
| `HLR-012` | Unchanged public runtime, no source write, and closed case order |

## 6. Dependency and no-write boundary

The module imports the existing pure parser, validator, actuals, assurance,
advance-planner, digest, and transition owners and the Git-evidence type only.
It imports no Node builtin, Git process, filesystem, Application, CLI, schema,
adapter, or persistence module. It performs no I/O and creates no mutation
candidate. Its result is internal compiled code and is not re-exported by a
public facade.

The public package retains zero production dependencies. The source, worktree,
index, refs, Git configuration, repository objects, editor state, and external
systems are outside this function and unchanged by every accepted case.

## 7. Verification

The accepted gate is:

```sh
npm run typecheck
npm run build
node --test test/historical-linear-core.test.mjs
node --test test/historical-transition-model.test.mjs test/historical-git-evidence.test.mjs
node --test test/project-actuals-git-history-probe.test.mjs test/project-actuals-history.test.mjs
node --test test/advance-history-probe.test.mjs test/advance-history-cli.test.mjs
node --test test/node-host-boundary.test.mjs test/adapter-core-dependency.test.mjs
npm run check
git diff --check
```

The focused Core gate passes twelve tests over all twelve cases. The complete
repository gate passes 939 tests, the English baseline over 753 text files,
documentation checks over 203 Markdown files and seven PERT examples,
read-only check/analyze/next validation for all 35 self-use plans, isolated LSP
and MCP gates, the supported VS Code 1.101.0 trusted/untrusted install/replace/
uninstall host gate, temporary-link acceptance, and the isolated 665-file
public-package workflow. The package retains Contract 7, 44 commands, 20 root
schemas, and plan-assurance installed-package acceptance. `git diff --check`
also passes.

The repository gate was launched from a VS Code extension-host terminal. Its
inherited `VSCODE_IPC_HOOK_CLI`, `ELECTRON_RUN_AS_NODE`, and
`VSCODE_ESM_ENTRYPOINT` variables were removed for the isolated host portion so
the downloaded VS Code executable and disposable extension/profile directories
were used rather than the connected Remote CLI. This changes no repository or
product behavior.

The exact task lifecycle digests are recorded after the status-only write
below. The status-only completion candidate inserted exactly `status done` and
was written once with source digest
`sha256:fb5e0054792d7a46ff631cd19f38d54f7a788014a91c667671edc0b65f37e139`
and candidate digest
`sha256:60bce1465e497087464f8fbd038443edf0c59728e093eb038c1e2fbef1c97975`.
Governance was not applicable, no owner assertion was supplied, and readback
confirms the exact plan digest.

That status write deliberately did not register task assurance evidence. At
that intermediate boundary, fresh complete NextResult v6 reported
`HISTORICAL_CLI` as the only ready and structurally recommended task, but
returned no startable recommendation and listed `HISTORICAL_CLI` as
assurance-unavailable.

The separate assertion-free outcome preview appends one seven-line
`OUTCOME_HISTORICAL_LINEAR_CORE` record against accepted basis
`sha256:dd9be23404e1de0ea3d496f0a013258b1f563cb272e33edd2be0d88bd6bdb4e4`
with reason
`Accepted pure checkpoint, lineage, and timeline reconstruction and twelve closed cases`.
It is bound to source digest
`sha256:60bce1465e497087464f8fbd038443edf0c59728e093eb038c1e2fbef1c97975`
and candidate digest
`sha256:0ca50c852105de6266e962f589597fd0e10d5a03748e3615e9e64af2a6b905c6`.
The candidate affects only `plan_assurance` and requires owner `user`. After
the separate confirmation boundary, it was written once with actor `codex`,
the candidate-bound `user` assertion, and the expected source digest. Readback
confirms plan digest
`sha256:0ca50c852105de6266e962f589597fd0e10d5a03748e3615e9e64af2a6b905c6`,
complete assurance, no unavailable task, mismatch, replan requirement, or
required action, and only `HISTORICAL_CLI` as ready, recommended, and startable.

## 8. Handoff and non-goals

The later `HISTORICAL_CLI` task owns Application request validation, the closed
`Perttool.HistoricalGraphResult.v1` projection, active diagnostics, command,
schema, Help/Guide, Node composition, and isolated installed-package acceptance.
It may consume this internal result but must not move Git parsing or semantic
folding into an adapter.

Historical editor protocol and VSIX presentation, seal semantic highlighting,
MCP history, single-checkpoint analysis composition, three-way ancestry,
semantic diff/patch/merge, cache persistence, Git or source mutation, release
selection, publication, remote writes, Issue mutation, and plan advance remain
separate.

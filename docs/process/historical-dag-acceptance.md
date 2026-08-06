# Historical DAG Reconstruction Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-06
- Workstream: `HIST-DAG-001`
- Task: `HISTORICAL_DAG_ACCEPTANCE`
- Normative model: [../specs/historical-dag.md](../specs/historical-dag.md)
- Editor protocol: [../specs/historical-editor-protocol.md](../specs/historical-editor-protocol.md)
- Machine cases: [../../test/fixtures/historical-dag-acceptance-cases-v1.json](../../test/fixtures/historical-dag-acceptance-cases-v1.json)
- Plan: [../../plans/historical-dag.pert](../../plans/historical-dag.pert)

## 1. Accepted boundary

The complete first-parent historical DAG reconstruction is accepted across the
pure transition and reconstruction Core, bounded immutable Git evidence, the
read-only CLI, the separately negotiated historical editor protocol, the
bundled LSP, and the private VSIX. The result preserves invalid continuity
gaps, freezes stable actual evidence, proves canonical advance by exact
candidate equality, and never infers lineage across an ambiguous transition.

The accepted source remains Grammar 6 and CLI Contract 7. Relative to the
published `0.7.1` compatibility baseline, it additively contains the
`dag history` command, `Perttool.HistoricalGraphResult.v1`, and one
reference-identical Node Host export: 45 commands, 21 root schemas, 122 root
and Node runtime values, and 45 portable Core values. That additive public
surface is a future minor-release input, not a patch-level claim.

## 2. Composed evidence

Sixteen dependency-ordered `HDA-001` through `HDA-016` cases close the
following evidence without duplicating its semantic owners:

- `HDG-001` through `HDG-020` fix the normative historical model;
- `HTM-001` through `HTM-012` fix exact whole-document transitions;
- `HGE-001` through `HGE-012` cover SHA-1, SHA-256, linked worktrees, limits,
  shallow evidence, and source or ref races;
- `HLR-001` through `HLR-012` cover checkpoints, gaps, stable actuals,
  canonical advance, ambiguous identity, lineage, timeline, and immutable
  bindings;
- `HCLI-001` through `HCLI-012` cover the command, result, schema, Help, Guide,
  inclusive bounds, analysis, installation, failure policy, and no-write
  behavior;
- `HED-001` through `HED-018` fix the historical editor contract; and
- `HVI-001` through `HVI-018` cover trusted local execution, all three views,
  all four orthogonal analysis modes, cancellation, replacement, immutable
  source navigation, accessibility, and installed no-write behavior.

The exact canonical-advance cases prove that a current endpoint with only the
remaining frontier can still yield multiple current and retired lineage
occurrences. A single endpoint or an explicitly equal lower boundary remains
one checkpoint; the implementation does not invent intermediate history.

## 3. Identity correction included in the gate

The separate [declaration identity correction](declaration-identity-acceptance.md)
is included as `HDA-012`. Task mutation and lifecycle resolve `(kind=task,
id)`, new tasks are inserted before assurance and actual records, and LSP
definition cannot confuse a same-ID `plan_seal` with its referenced task.
Historical source order remains immutable and source-preserving.

## 4. Verification and no-write result

The focused acceptance test composes every closed component matrix, checks the
45-command and 21-schema source boundary, invokes the real `dag history`
command over the repository, and proves byte-identical Git status before and
after. Existing real-repository tests cover SHA-1, SHA-256, merge first-parent
selection, linked worktrees, canonical advance, invalid sources, immutable
blob navigation, and all hard limits.

The complete Node.js 22 repository gate is:

```sh
/home/katsumata-m/.nvm/versions/node/v22.22.3/bin/npm run check
git diff --check
```

It includes the full test suite, English and documentation baselines, every
self-use plan, isolated LSP and MCP packages, the trusted and untrusted minimum
VS Code host, temporary package linking, npm publication dry-run, and isolated
installed Contract 7 and plan-assurance workflows. The final counts and plan
lifecycle binding are recorded after the completed-task candidate is verified.

No acceptance probe changes source bytes, Git objects, refs, index state,
editor configuration, extension installation outside disposable profiles,
remote state, npm state, GitHub state, or Issue state. Three-way ancestry,
semantic patch or merge, editor or MCP mutation, Marketplace publication, npm
`latest` movement, plan advance, and Issue mutation remain outside this
acceptance.

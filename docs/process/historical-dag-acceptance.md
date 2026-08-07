# Historical DAG Reconstruction Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-06
- Final lifecycle verification: 2026-08-07
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

The complete Node.js 22 repository gate was run through the selected NVM
runtime so that npm scripts and every child process inherited Node.js 22:

```sh
source /home/katsumata-m/.nvm/nvm.sh
nvm exec 22.22.3 npm run check
git diff --check
```

It includes the full test suite, English and documentation baselines, every
self-use plan, isolated LSP and MCP packages, the trusted and untrusted minimum
VS Code host, temporary package linking, npm publication dry-run, and isolated
installed Contract 7 and plan-assurance workflows. The gate passed 961 tests,
775 checked repository text files, 210 Markdown files, 7 PERT examples, all 35
self-use plans, the isolated LSP and MCP packages, the minimum VS Code 1.101.0
trusted and untrusted host cases, the temporary-link workflow, and the
675-file isolated package workflow. The retained package is 2.7 MB compressed
and 6.3 MB unpacked.

The final status-only mutation changed the source digest from
`sha256:a89ef57c89379f589070d2a1eeb46a31583552aa001cd1a3e7e337760d8ead1e`
to
`sha256:e67be36dc0374c0d27c3ec7e51a3fd04872f685c5b340d22d6f04902f9a75f72`.
The separately confirmed outcome is bound to accepted basis
`sha256:cce0e3c757a51cf09215980303509d1aad9e5bbb90d11acf48790e962a894626`
and was written once with actor `codex` and the candidate-bound owner assertion
`user`. Its final candidate and source digest is
`sha256:3a1b78e7e7012ebd0fba568cf10f0a0ca23d20fc33fd834f719b1681a64ea3ef`.
Readback reports all eight task-assurance results verified and conformant, no
direct or inherited mismatch, no replan, no active attention or required
action, and no ready, recommended, runnable, or startable task. The plan is
intentionally retained before advance.

No acceptance probe changes source bytes, Git objects, refs, index state,
editor configuration, extension installation outside disposable profiles,
remote state, npm state, GitHub state, or Issue state. Three-way ancestry,
semantic patch or merge, editor or MCP mutation, Marketplace publication, npm
`latest` movement, plan advance, and Issue mutation remain outside this
acceptance.

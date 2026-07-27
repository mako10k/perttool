# Issue #4 Governance Implementation Handoff

- Document status: Superseded resumable checkpoint
- Handoff date: 2026-07-27
- Issue: [Issue #4](https://github.com/mako10k/perttool/issues/4), open at handoff
- Plan: [../../plans/governance.pert](../../plans/governance.pert)
- Design acceptance:
  [governance-design-acceptance.md](governance-design-acceptance.md)
- Resume base before guidance: `efb13e2`
- Completed implementation tasks: `GOV_SOURCE_MODEL`, `GOV_AUTHORITY_CORE`,
  `GOV_CLI_PREVIEW`, `GOV_WRITE_ENFORCEMENT`, `GOV_GUIDANCE`
- Normal next task: `GOV_ACCEPTANCE`
- Active public package boundary: `0.3.0`, Grammar 1/2/3, CLI Contract 4

This point-in-time checkpoint is superseded by
[Issue #4 Governance Implementation Acceptance](governance-acceptance.md).
The sections below intentionally preserve the pre-activation state and resume
boundary rather than rewriting historical evidence as current state.

## 1. Purpose

This record allows another checkout or agent to resume the Issue #4
owner-aware governance work without reconstructing the completed source,
authority, preview, write, and guidance slices from chat history.

The checkpoint is intentionally incomplete. It contains the accepted
requirements and contracts plus internal target Grammar 4 source support and
the complete target Contract 5 path through guarded persistence and editing
guidance. It does not activate Grammar 4, CLI Contract 5, governed previews,
or owner-aware write enforcement on the public package surface.

## 2. Verified checkpoint

After `GOV_GUIDANCE` completion and canonical advance in this checkout:

- the branch is `main`;
- all intended implementation and plan changes are committed;
- `npm run check` passes, including documentation, all 18 self-use plans,
  local-link checks, package normalization, and isolated installed-package
  Contract 4 acceptance;
- `git diff --check` passes;
- `plans/governance.pert` is valid after completion and canonical advance;
- its remaining work is 4p;
- its precedence and heuristic `parallel-sgs` resource makespans are 4p, and
  the resource result is not an exact optimum;
- its observed velocity is `41p/2d`; and
- a complete, non-truncated `Perttool.NextResult.v4` under
  `recommendation_v1_plus_release_gate` recommends and permits starting only
  `GOV_ACCEPTANCE`.

## 3. Completed implementation

### 3.1 Target governance source model

The internal capability-checked target path now provides:

- Grammar 4 project fields `goal_owner`, `dag_owner`, `goal_delegates`, and
  `dag_delegates`;
- canonical `PrincipalId` and `PrincipalList` parsing;
- duplicate-principal rejection through `PTSEM-113`;
- declared and effective governance metadata, including omitted-field
  defaults of owner `user` and empty delegates;
- an immutable, digest-bound pre-change governance snapshot;
- target Grammar 4 parsing, semantic validation, and formatting;
- target project initialization, project metadata, direct project mutation,
  and atomic-batch project mutation;
- an atomic older-grammar-to-Grammar-4 upgrade when a governance field is
  introduced;
- localized clear and downgrade-compatible behavior;
- preservation of Grammar 4 governance source during exact unit migration;
  and
- the exact generated direct-edit warning required by the source contract.

Primary implementation locations:

- `src/governance/types.ts`
- `src/governance/source.ts`
- `src/application/target-governance-init.ts`
- `src/application/target-governance-project.ts`
- `src/application/target-mutate.ts`
- `src/parser/document-parser.ts`
- `src/semantic/target-validator.ts`
- `src/formatter/target-source-formatter.ts`
- `src/mutation/project.ts`

### 3.2 Pure authority Core

The internal governance Core now provides:

- deterministic actual-change classification into `goal`, `dag`, mixed, or
  ordinary scope;
- actor and repeatable accepted-owner normalization;
- `PTGOV-102` for malformed or duplicate Core assertions;
- one operation-level decision over direct and atomic-batch changes;
- owner and delegate decisions based only on the digest-bound pre-change
  snapshot;
- matching caller-asserted owner confirmation for otherwise unauthorized
  actors;
- distinct-owner requirements for mixed goal/DAG changes;
- rejection of atomic self-authorization through candidate owner or delegate
  changes; and
- stable `PTGOV-101` diagnostic projection for unauthorized persistence.

The classifier and evaluator are pure. They perform no filesystem, Git,
authentication, network, environment, or clock operation. The implementation
is in `src/governance/authority.ts`.

### 3.3 Focused evidence

The primary focused tests are:

- `test/governance-source-core.test.mjs`
- `test/governance-authority-core.test.mjs`
- `test/governance-command-target.test.mjs`
- `test/governance-preview-target.test.mjs`
- `test/governance-write-enforcement.test.mjs`
- `test/governance-guidance-target.test.mjs`
- `test/governance-source-contract.test.mjs`
- `test/governance-interface-contract.test.mjs`
- `test/governance-examples-contract.test.mjs`
- `test/governance-design-acceptance.test.mjs`
- `test/rational-duration-version-boundary.test.mjs`

The machine-readable authority/write baseline remains
`test/fixtures/governance/cases.json`.

### 3.4 Target interface, writes, and guidance

The internal target Contract 5 path now additionally provides:

- operation-level actor and repeatable accepted-owner request preparation;
- complete ProjectResult v3, MutationResult v2, GovernanceDecision v1, text,
  JSON, registry, help, usage-recovery, and diagnostic projections;
- governed preview without requiring persistence authority;
- one guarded persistence composition for direct mutation, atomic batch,
  advance, and existing-document replacement;
- pre-I/O rejection of preview, denied, invalid, or stale authority;
- the unchanged Contract 4 safe-write and exclusive-output guarantees after
  authorization;
- a target-only Contract 5 `guide editing` projection explaining pre-change
  authority, multi-scope batches, caller-assertion limits, and direct-edit
  bypass; and
- README and process guidance aligned byte-for-byte with the generated project
  warning.

The exact warning is owned by `src/governance/guidance.ts`; project generation
and the target Guide consume that one constant. The active Contract 4 Guide,
root exports, and CLI do not expose the target projection.

## 4. Public boundary that remains closed

The active root exports and CLI still expose Contract 4. They intentionally:

- accept only Grammar 1, 2, and 3;
- report `cli_contract_version=4`;
- expose `Perttool.ProjectResult.v2`;
- expose `Perttool.MutationResult.v1`;
- reject Governance Grammar 4 fields through the active parser;
- reject `--actor` and `--accepted-by-owner`;
- expose no governed preview or `Perttool.GovernanceDecision.v1`; and
- perform no owner-aware write enforcement.

Do not expose a partial Contract 5 while implementing the next slices.
[Governance Interface section 11](../specs/governance-interface.md#11-compatibility-and-atomic-cutover)
requires Grammar 4, ProjectResult v3, MutationResult v2, governance decisions,
write enforcement, registry/help, guidance, and installed acceptance to
activate together. Target-only implementation and tests may advance before
that atomic public cutover.

## 5. Remaining plan

| Task | Size | Current state | Required outcome |
| --- | ---: | --- | --- |
| `GOV_ACCEPTANCE` | 4p | Recommended and startable | Review and activate the complete atomic source, Core, CLI, batch, safe-write, help, Guide, and installed-package behavior |

Release version selection, tagging, GitHub Release creation, npm publication,
and dist-tag movement remain outside this plan and need a separately
authorized release workstream after local acceptance.

## 6. Resume procedure

Use Node.js 22 or later from the repository root.

```sh
git status --short --branch
git rev-parse HEAD
npm ci
npm run check
git diff --check
```

Rebuild and re-evaluate the live plan rather than relying only on the numbers
recorded above:

```sh
npm run build
node dist/cli.js document check plans/governance.pert --format=json
node dist/cli.js dag analyze plans/governance.pert --format=json
node dist/cli.js dag next plans/governance.pert --format=json
```

Continue only if NextResult is the known complete v4 authority, its
explanation is complete and non-truncated, its temporal policy remains
`recommendation_v1_plus_release_gate`, and `GOV_ACCEPTANCE` remains in
`temporal.authority.startable_recommended_task_ids`.

Read these normative inputs before changing the target interface:

1. [Requirements sections 2.6 and 12.3](../requirements.md#26-separate-plan-maintenance-from-goal-and-dag-authority)
2. [Governance Source](../specs/governance-source.md)
3. [Governance Authority](../specs/governance-authority.md)
4. [Governance Interface](../specs/governance-interface.md)
5. [Mutation Semantics](../specs/mutation.md)
6. [Normative Governance Examples](../examples/governance.md)
7. [Design Acceptance](governance-design-acceptance.md)

## 7. Next bounded slice

Implement only `GOV_ACCEPTANCE` after revalidation. Its minimum review
boundary is:

1. review the source, authority, preview, write, registry/help, Guide, warning,
   and diagnostic target against the accepted contracts and examples;
2. connect Grammar 4 and CLI Contract 5 only as one public activation change,
   including root exports and installed-package behavior;
3. prove all governed direct, atomic-batch, advance, and existing-document
   replacement writes evaluate the pre-change snapshot before I/O;
4. prove preview, unauthorized persistence, stale source, malformed
   assertions, and ordinary changes retain their specified outcomes;
5. prove text/JSON/help/Guide/diagnostic projections and exit codes from an
   isolated installed package;
6. retain explicit non-goals for authentication, durable audit, MIG-08, Git
   integration, and recommendation ranking; and
7. stop before release version selection, tagging, publication, or dist-tag
   changes.

Stop and update the normative contract before coding if the slice requires a
different option shape, schema identity, authority meaning, diagnostic, exit
code, or activation order. Do not fold release work, authentication, durable
audit, MIG-08, Git integration, or recommendation changes into this slice.

## 8. Completion and plan-record procedure

For the next task:

1. run narrow tests first and then `npm run check`;
2. inspect the intended diff by file and hunk;
3. use `project show --format=json` for current plan metadata;
4. preview any plan completion with the exact current source digest;
5. use Stage 3 expected-digest safe write for the completion;
6. commit the completion snapshot separately;
7. re-read and verify the committed target before previewing `dag advance`;
8. advance once, commit the canonical frontier separately; and
9. re-run check, analyze, and complete NextResult v4 after the advance.

Do not infer that a green target-only preview test activates Contract 5 or
authorizes a release.

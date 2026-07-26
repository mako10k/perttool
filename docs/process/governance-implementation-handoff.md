# Issue #4 Governance Implementation Handoff

- Document status: Resumable checkpoint
- Handoff date: 2026-07-26
- Issue: [Issue #4](https://github.com/mako10k/perttool/issues/4), open at handoff
- Plan: [../../plans/governance.pert](../../plans/governance.pert)
- Design acceptance:
  [governance-design-acceptance.md](governance-design-acceptance.md)
- Implementation checkpoint: `38f2620`
- Completed implementation tasks: `GOV_SOURCE_MODEL`, `GOV_AUTHORITY_CORE`
- Normal next task: `GOV_CLI_PREVIEW`
- Active public package boundary: `0.3.0`, Grammar 1/2/3, CLI Contract 4

## 1. Purpose

This record allows another checkout or agent to resume the Issue #4
owner-aware governance work without reconstructing the completed source and
authority slices from chat history.

The checkpoint is intentionally incomplete. It contains the accepted
requirements and contracts plus internal target Grammar 4 source support and
the pure governance authority Core. It does not activate Grammar 4, CLI
Contract 5, governed previews, or owner-aware write enforcement on the public
package surface.

## 2. Verified checkpoint

At implementation checkpoint `38f2620`:

- the branch is `main`;
- all intended implementation and plan changes are committed;
- `npm run check` passes with 555 tests, documentation, all 18 self-use plans,
  local-link checks, package normalization, and isolated installed-package
  Contract 4 acceptance;
- `git diff --check` passes;
- `plans/governance.pert` is valid after completion and canonical advance;
- its remaining work is 16p;
- its precedence makespan is 13p;
- its heuristic `parallel-sgs` resource makespan is 16p and is not an exact
  optimum;
- its observed velocity is `29p/1d`; and
- a complete, non-truncated `Perttool.NextResult.v4` under
  `recommendation_v1_plus_release_gate` recommends and permits starting only
  `GOV_CLI_PREVIEW`.

`GOV_GUIDANCE` is structurally ready but has tier `deferred` because it does
not fit the selected set on `REVIEWERS`. It is not start authority at this
checkpoint.

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
- `test/governance-source-contract.test.mjs`
- `test/governance-interface-contract.test.mjs`
- `test/governance-examples-contract.test.mjs`
- `test/governance-design-acceptance.test.mjs`
- `test/rational-duration-version-boundary.test.mjs`

The machine-readable authority/write baseline remains
`test/fixtures/governance/cases.json`.

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
| `GOV_CLI_PREVIEW` | 4p | Recommended and startable | Connect operation-level actor/confirmation requests, result projections, registry descriptors, help, diagnostics, and governed preview behavior on the target path |
| `GOV_WRITE_ENFORCEMENT` | 5p | Predecessor blocked | Enforce the same decision before every affected safe-write path without weakening candidate validation or write safety |
| `GOV_GUIDANCE` | 3p | Ready but deferred | Align Guide, README, process guidance, and generated warnings without claiming authentication or direct-edit prevention |
| `GOV_ACCEPTANCE` | 4p | Join blocked | Accept the complete atomic source, Core, CLI, batch, safe-write, help, Guide, and installed-package behavior |

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
`recommendation_v1_plus_release_gate`, and `GOV_CLI_PREVIEW` remains in
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

Implement only `GOV_CLI_PREVIEW` after revalidation. Its minimum review
boundary is:

1. add target request preparation for optional actor and repeatable
   accepted-owner assertions;
2. connect direct and atomic-batch target planners to the existing pure
   classifier and evaluator;
3. return complete target ProjectResult v3, MutationResult v2, and
   GovernanceDecision v1 projections;
4. make governed preview succeed without actor or owner confirmation while
   reporting scopes, effective owners, and whether persistence would require
   confirmation;
5. add the target Contract 5 registry, text help, JSON help, usage recovery,
   and stable diagnostic projections required by the accepted interface;
6. retain the active Contract 4 root and CLI until the later atomic cutover;
   and
7. add focused Core/CLI projection tests plus explicit Contract 4
   non-exposure regressions.

Stop and update the normative contract before coding if the slice requires a
different option shape, schema identity, authority meaning, diagnostic, exit
code, or activation order. Do not fold `GOV_WRITE_ENFORCEMENT`,
`GOV_GUIDANCE`, release work, authentication, MIG-08, Git integration, or
recommendation changes into this slice.

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

# AI Development Guide

- Document status: Active 0.7
- Created: 2026-07-21
- Updated: 2026-08-05
- Shared instructions: [../../AGENTS.md](../../AGENTS.md)
- Self-use plan: [self-use.md](self-use.md)
- Recommendation migration: [recommendation-migration.md](recommendation-migration.md)
- Recommendation design review: [recommendation-design-review.md](recommendation-design-review.md)
- Shared adapter architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Agent Guidance Provider baseline: [agent-guidance-provider-baseline.md](agent-guidance-provider-baseline.md)

## 1. Purpose

Maintain a repository structure in which Codex, GitHub Copilot, and other coding agents can develop perttool by consulting the same canonical sources, work boundaries, verification commands, and Git rules.

Do not give each AI a separate product judgment. Put project-specific meaning in documents and tests, and put only tool-specific entrypoints in `AGENTS.md`, `.github/`, and `.codex/`.

### 1.1 Repository language

English is the canonical language for tracked repository artifacts. New or substantively modified requirements, specifications, design text, process guidance, plan metadata, source comments, bundled help, and diagnostics use English.

This rule does not force the conversation language. Agents continue to answer the user in the language requested by the user, including Japanese, while keeping committed artifacts in English. User-authored `.pert` content and explicit Unicode round-trip fixtures are never translated automatically.

The repository does not currently implement i18n, locale negotiation, translation catalogs, or a `--locale` option. Stable codes, field names, enum values, typed facts, and schema versions are the machine contract; natural-language text is a deterministic projection. The completed migration and exact intentional-Unicode allowlist are recorded by [`plans/english-baseline.pert`](../../plans/english-baseline.pert) and its [final acceptance record](english-baseline-acceptance.md).

## 2. Local repositories consulted

On 2026-07-21, the checkout directories immediately below `~/` that had recent modification times and AI development entrypoints were examined.

| Repository | Extracted pattern | Adoption in perttool |
| --- | --- | --- |
| `~/kafs` | Project map, existing commands, task-start gates, PERT-based next-task selection, conservative Codex settings | Simplified and adopted in `AGENTS.md` |
| `~/power-limit-cdt` | Codex/Copilot compatibility through `AGENTS.md` as shared canonical guidance, traceability from requirements through verification, checks before remote operations | Adopted in shared instructions and Git rules |
| `~/kscr_selfhost` | Inspect the repository first, risk-first review, focused commits, proportional validation, `secdat exec` | Adopted in workflow and review rules |
| `~/secexec` | Separate agent entrypoints from project-specific hard rules and identify detailed sources of truth | Adopted as a policy to place domain invariants in canonical documents |
| `~/openai-xmpp-bot-20250923` | `.editorconfig` and a single CI entrypoint | Adopted in whitespace conventions and repository-check CI |

The following were not adopted.

- Product-specific safety rules or deployment procedures
- Many custom agents whose roles overlap at this stage
- A large-repository workflow that mandates issues, branches, worktrees, and PRs for every change
- Premature definitions of build, lint, or test commands that do not exist
- Abstract completion gates that the current perttool cannot verify

## 3. Instruction architecture

```text
AGENTS.md                         shared canonical guidance
├── .github/copilot-instructions.md  Copilot entrypoint and mandatory summary
├── .codex/config.toml               conservative project-local defaults
├── docs/process/ai-development.md   rationale and operating workflow
├── package.json                     executable repository check
│   └── npm run check                typecheck, test, language, docs, self-use, package
├── scripts/check-english-baseline.mjs  exact Japanese-script allowlist check
├── scripts/check-docs.sh            documentation sub-check
├── scripts/publish-npm.sh           npm dry-run and explicit release-tarball publish gate
└── .github/workflows/ci.yml         same npm check in CI
```

When adding a rule, prioritize a test that can detect a violation or a concrete review checkpoint. Do not lengthen `AGENTS.md` merely by adding general advice.

## 4. Standard workflow

### 4.1 Start

1. Confirm the current state with `git status --short --branch` and `git log`
2. Confirm the user's objective, type of work, and change scope
3. Read canonical sources in the priority order in `AGENTS.md`
4. Determine acceptance criteria, non-goals, and verification commands
5. Decide whether documents or implementation should change first

### 4.2 Change

- Make one coherent capability or specification decision one change
- Do not mix in unrelated cleanup
- Preserve existing contracts such as stable IDs, determinism, source spans, and loss reports
- Propagate specification changes to samples and tests
- For files with user changes, integrate with the existing diff rather than overwriting it

### 4.3 Validate and review

The common checks at this stage are:

```sh
npm ci
npm run check
git diff --check
```

Depending on the change scope, first run `npm run typecheck`, `npm test`,
`npm run check:english`, or `npm run check:docs` as narrow checks. The language
check scans tracked and non-ignored untracked text files and accepts only exact
lines in the versioned Japanese-script allowlist.

Then use `git diff -- <target-file>` to confirm the following.

- There is no contradiction among canonical sources
- No requirement or acceptance criterion is missing
- Examples actually represent the specification
- Heuristics, inferences, and exact results are not confused
- Open matters are not silently pushed into future implementation

### 4.4 Close out

1. Confirm with `git status --short` that only the target files are changed
2. Explicitly stage the target files
3. Review the staged diff and `git diff --cached --check`
4. Distinguish checks that were run from those not run
5. Perform remote writes through `secdat exec`
6. After pushing, confirm the local branch and remote tracking branch

npm publication is outside normal close out. Follow the beta release gate, verify the common tarball, remote commit/tag, and unpublished version, and inject `NPM_TOKEN` through `secdat` only after explicit user permission. Beta publication uses `beta` without moving `latest`. A later `latest` promotion is a separate, explicitly authorized dist-tag mutation. The obsolete `alpha` channel is retired; historical alpha versions remain available only by exact pin. Never retry an ambiguous registry mutation before checking durable state.

## 5. Next-task selection and self-use

Before implementation, use the recommended specification work and open matters in `docs/requirements.md`. Propose the "next task" only after confirming that its hard predecessors are closed in the current checkout.

After meeting Stage 1 of `docs/process/self-use.md`, add perttool's own `.pert`
plans to the canonical sources. In Stage 3, editing commands and `dag advance`
may be used as canonical writers through preview-first, expected-digest, and
post-write reanalysis procedures. Contract 7 retains the MIG-07 recommendation
gate and adds plan-assurance eligibility after the temporal release policy:
task selection uses a complete, known `Perttool.NextResult.v6` and its combined
authority as follows.

1. Run `perttool document check` on `mvp.pert` and the current detail plan to confirm that the plans are valid. Use `perttool project show --format json`, rather than directly viewing the source, to inspect metadata such as project ID, as_of, duration_unit, velocity, and finish
2. Run `dag analyze` and `dag next --format json` for `mvp.pert`, confirm a known version, complete trace, policy `recommendation_v1_plus_release_gate_plus_plan_assurance_v1`, complete assurance authority, and no `PTREC-*` or assurance safe stop, then select a workstream from `startable_recommended_task_ids`
3. Run `dag analyze` and `dag next --format json` for the detail plan corresponding to that work package, confirm the same consumer gate, then select the detail recommended task
4. Treat as normal selection either a startable recommended subset or the startable recommended set plus exactly one time-eligible, resource-feasible `allowed` task while retaining every startable recommended task
5. Explain the decisive step, higher-priority tasks, and comparison from project facts, and confirm external blocks and available resources
6. After a task start, completion, block, or capacity change, do not reuse the result; reanalyze the detail plan and the necessary macro plan

When changing project metadata, inspect the `project set` preview or `--diff`, and use the Stage 3 `--write` procedure with an expected digest for persistence. If a project-wide unit change also requires task duration or estimate changes, combine `project.set` and the related mutations in one atomic batch. Do not depend on visual source inspection or manual editing for normal metadata viewing and editing.

Owner-aware governance is active in repository-source Grammar 6 and CLI
Contract 7. Governed previews may omit actor and owner confirmation, but
persistent goal or DAG changes require an actor. Effective owners and
delegates have direct authority; another actor must provide repeatable
`--accepted-by-owner` caller assertions for every affected effective owner.
Always decide authority from the digest-bound pre-change document, and require
one atomic batch to satisfy every affected scope. These assertions are not
authentication, verified identity, signatures, or durable audit records.

Treat `--accepted-by-owner` as a single-candidate, scope-bound caller
assertion, never as workstream or session authority. Start each candidate with
an assertion-free preview. If governance is not applicable, persist without
the assertion. If a non-direct governed write needs confirmation, present the
operation, target, affected scopes, required owners, available modification
time, byte size before and after, diff counts, and semantic candidate summary.
Keep source and candidate digests as supplemental machine identity rather than
the primary human explanation. Use the assertion only when the current user
instruction explicitly covers that mutation. Do not copy it to later
maintenance, a changed candidate, or the next `dag advance`, and do not chain
preview and confirmation-dependent write without a user-response boundary.
`PTGOV-103` warns when a valid not-applicable candidate still carries an owner
assertion. It does not change default write authority; selecting
`--warnings-as-errors` prevents persistence.
`PTGOV-104` warns when a valid governed preview already carries an owner
assertion. Rerun the first preview without it. The default preview remains
successful; selecting `--warnings-as-errors` returns exit 1 while retaining
the candidate and governance decision. Persistent governed authority is
unchanged.
The complete experimental cases are in the
[loose assertion scope experiment](governance-assertion-scope-experiment.md).

Generated projects state the direct-edit boundary exactly:

```pert
# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.
```

Treat this as guidance rather than technical prevention. A text editor, shell
command, or other program can bypass the tool-mediated authority check. Keep
Git and human review as separate controls. The published `0.3.0` package
remains Contract 4 and does not accept governance fields or caller assertions;
use live command discovery and require the expected contract version rather
than inferring support from the package name alone.

Grammar 5 lifecycle writes require an explicit event time and atomically
change task state and append one work event. Preview and inspect the event
before using the ordinary actor, expected-digest, and safe-write controls.
`project history` and `project observe-velocity` are read-only: they do not
commit, stage, or modify Git and do not adopt an observed velocity. Before an
in-place `dag advance` removes a completed task and its owned events, commit
the exact eventful source snapshot through the established Git workflow.
The active history guard compares every destructive range with `HEAD` and the
stage-0 index, permits dirty ranges retained by the candidate, and returns
`PTADV-101` before persistence when recoverability cannot be proved. Treat
`--force-history-loss` as an exceptional, exact-request choice: never infer or
carry it forward, and remember that it bypasses neither owner authority nor
the warning, digest, source, repository-race, or atomic-write gates.
The canonical candidate owns only newly orphaned blank separator prefixes in
its terminal removed-declaration suffix. Do not invoke the formatter or apply
a second whitespace edit after approval; preview, separate output, and
in-place write must remain the same bytes and pass `git diff --check` directly.

Do not directly compare tasks from different detail plans without a macro decision. Do not substitute `groups.ready`, `groups.runnable_now`, the raw recommended set, or the text summary for start authority. With an unknown schema/model/temporal-policy version, incomplete or truncated trace, unknown tier, `PTREC-*`, or future or unavailable temporal eligibility, do not start a task; stop safely. Do not start `deferred` or `discouraged` work under normal authority.

The 2026-07-22 [Recommendation design acceptance](recommendation-design-review.md), grammar acceptance, formatter/mutation preview, safe write, Mermaid export/import round trip, and advance Core/CLI are complete and are in Stage 3 self-use. The missing MVP acceptance condition 16 found by the [release-readiness audit](mvp-release-readiness.md) was resolved by MIG-01 through MIG-07, totaling 22p, in the [Recommendation implementation plan](../../plans/recommendation.pert). The [five-plan shadow evaluation](recommendation-shadow-review.md), read-only override validation, normal-authority dry run, unknown-version safe stop, and shared-instruction/help synchronization are accepted. The provisional Recommendation-specific observation is `22p/1d`, and distribution of the same `v0.1.0-alpha.2` artifact through GitHub/npm and registry installation are complete.

The first suffix-free beta, `v0.1.0`, is [accepted](beta-release-acceptance.md). One tarball was verified across the GitHub prerelease, npm `beta`, and an isolated registry installation. It was then explicitly promoted to npm `latest`; both tags resolve to `0.1.0`. The macro plan is advanced to `M8_BETA_RELEASED` and has no ready or recommended task. Issue #3 multi-plan composition remains a post-beta backlog. The later selected `ADAPTER-001` plan composes the shared dependency, library, Node Host, CLI parity, document-session, read-only LSP, VSIX/DAG, and read-only MCP gates; its architecture contract is complete and complete NextResult v6 recommends only `CORE_DEPENDENCY_CLEANUP`.

ADR 0004 adopts English as the repository baseline immediately. All nine tasks
in `plans/english-baseline.pert` are accepted and advanced; commit `2001cdf`
records the final-task pre-advance snapshot. The machine-readable allowlist and
scanner are recorded in `english-surface-inventory.md`, the final cross-surface
trace is recorded in `english-baseline-acceptance.md`, and fresh complete
NextResult v5 has no ready, recommended, or startable task.

The human/LLM CLI surface review and its eight backlog items are also tracked
as an independent post-beta workstream in
[`plans/cli-surface-reset.pert`](../../plans/cli-surface-reset.pert).
`CONTRACT_V3_DESIGN`, `CLI_001_COMMAND_REGISTRY`,
`HELP_001_COMMAND_DISCOVERY`, `HELP_002_DOMAIN_GUIDE_SPLIT`,
`HELP_003_USAGE_RECOVERY`, `MUT_001_PROJECT_INIT`, and
`MUT_002_GATE_MAINTENANCE` are complete and advanced.
`CLI_002_CONTRACT_V3_CUTOVER` then activated hierarchical command
help, the separate domain-guide projection, registry-scoped usage recovery,
project initialization, gate maintenance, all renamed commands, and Contract 3
JSON envelopes in one source change. `CLI_003_FILE_FIRST_ACCEPTANCE` completed
the installed-package initialize/read/change/analyze/select/advance/validate
workflow using typed mutations for every entity field. The detail plan is now
complete with no recommendation. The published `0.1.0` artifact remains
Contract 2 until a separately authorized release.

The user then selected suffix-free beta `0.2.0` as the first Contract 3 package
target. The independent [`release-0.2.0.pert`](../../plans/release-0.2.0.pert)
workstream and [`v0.2.0` procedure](0.2.0-release.md) separate normative gate
design, local source preparation, clean-candidate acceptance, explicitly
authorized distribution, and durable release acceptance.
All five `RELEASE_020_*` tasks are complete and advanced. Version `0.2.0` was
published from one verified tarball to a GitHub prerelease and npm `beta`;
local, GitHub, and registry bytes match; and installed Contract 3 and
file-first checks passed. Publication moved only `beta`; after acceptance, a
separately authorized dist-tag operation made npm `beta=latest=0.2.0`. The
plan remains unchanged with no remaining or recommended task at `17p/2d`.
The durable [acceptance record](0.2.0-release-acceptance.md) contains the
release identity, artifact digests, dist-tags, and verification commands.

Suffix-free beta `0.3.0` is the accepted atomic Contract 4 release. The
independent
[`release-0.3.0.pert`](../../plans/release-0.3.0.pert) plan verifies the
accepted scheduling-and-units finish, then separates source preparation,
candidate acceptance, the authorized Git/GitHub/npm `beta` PUBLISH operation,
and durable acceptance. All six tasks are complete and advanced. The
[readiness record](0.3.0-contract4-readiness.md) consumes the reached
scheduling-and-units finish without duplicating its task state.
[PUBLISH record](0.3.0-publish.md) fixes the release commit/tag, common
GitHub/npm tarball identity, installed Contract 4 checks, and
publication-time `beta=0.3.0` with unchanged `latest=0.2.0`. The
[acceptance record](0.3.0-release-acceptance.md) records the separately
authorized promotion to `beta=latest=0.3.0`, the unqualified global
installation, and light smoke. The completed plan has zero makespans, no
recommendation, and observed cumulative velocity `19p/2d`.

The selected next public target is suffix-free beta `0.4.0` for the breaking
Grammar 4 and CLI Contract 5 cutover. The independent
[`release-0.4.0.pert`](../../plans/release-0.4.0.pert) plan verifies reached
governance acceptance, then separates source preparation, one clean candidate
and immutable tarball, the Git/GitHub/npm `beta` PUBLISH operation, and
durable acceptance. `RELEASE_040_GATE_DESIGN` and
`RELEASE_040_CONTRACT_5_READINESS` are complete and advanced, and
`RELEASE_040_PREPARATION` is complete and advanced after aligning the `0.4.0`
source, [Contract 4-to-5 migration](cli-contract-5-migration.md), and full
Node.js 22 repository/package gates. `RELEASE_040_CANDIDATE` is complete and
advanced after read-only external availability and protected-route checks and
acceptance of one retained tarball with SHA-256 `010af9ce...7cc4a`.
The later named PUBLISH authorization pushed release commit and annotated tag
`6b341d1`, created the GitHub prerelease, and published the byte-identical
tarball to npm `beta`. npm reports `beta=0.4.0` and unchanged
`latest=0.3.0`; the [PUBLISH record](0.4.0-publish.md) preserves the exact
identity and commands. The completed PUBLISH task is advanced to the reached
`RELEASE_040_PUBLISHED` frontier. Durable acceptance reverified both public
tarballs, completed all six tasks and 19p at `19p/2d`, and advanced the
zero-makespan plan to reached `RELEASE_040_ACCEPTED` with no recommendation. The
[acceptance record](0.4.0-release-acceptance.md) preserves that boundary.
The user then separately selected `perttool@0.4.0` for npm `latest`; Issue #4
closure remains a separate decision. That one-time dist-tag mutation is now
complete. Fresh registry reads and an unqualified isolated installation
confirmed `beta=latest=0.4.0`, CLI Contract 5, and Grammar 4 without changing
the accepted artifact or completed plan.

The selected public target is suffix-free beta `0.5.0` for the breaking
Grammar 5 and CLI Contract 6 cutover. The independent
[`release-0.5.0.pert`](../../plans/release-0.5.0.pert) plan consumes reached
project-actuals and English-baseline acceptance without duplicating either
workstream. The user authorized the complete named release sequence and an
exact post-release local installation. Git commit `1641a32` records the exact
completed gate-design pre-advance snapshot, and the task is advanced to
reached `RELEASE_050_GATE_ACCEPTED`. The Contract 6 readiness record accepts
the reached implementation and English inputs and the active source/package
boundary. Git commit `ba84cd8` records its completed 2p pre-advance snapshot,
and the task is advanced to reached `RELEASE_050_CONTRACT_6_READY`. Source
preparation then aligned `0.5.0` identity, release guidance, tests, goldens,
and the complete repository and isolated-package gates. Git commit `e1e7ccf`
records its exact pre-advance snapshot, and the task is advanced to reached
`RELEASE_050_SOURCE_PREPARED`. Candidate acceptance then reverified the clean
source, publication identities, external availability, protected routes,
complete repository and installed-package gates, and the retained 468-file
tarball with SHA-256 `f3ba9b3f...2208c`. PUBLISH then fixed release commit
and peeled `v0.5.0` target `af819b4`, byte-identical candidate/GitHub/npm
tarballs, npm `beta=0.5.0` with unchanged `latest=0.4.0`, and complete
isolated public-package checks. Git commit `94a8b62` records the exact
completed PUBLISH pre-advance snapshot, and the task is advanced to reached
`RELEASE_050_PUBLISHED`. Three points remain; precedence and heuristic
resource makespans are 3p at observed `16p/1d`, both forecasts are `3/16d`,
and complete NextResult v5 recommends only `RELEASE_050_ACCEPTANCE`.
Independent acceptance then reread both public channels and references,
reconfirmed three-way artifact identity, and reran both public-package
workflows. All six tasks and 19p are complete at `19p/1d`; both makespans
are zero, and complete NextResult v5 has no recommendation. Git commit
`bacd413` records the exact completed acceptance pre-advance snapshot, and
the plan is advanced to reached `RELEASE_050_ACCEPTED`. The exact
post-acceptance global installation now resolves to registry
`perttool@0.5.0` and passed Contract 6, Grammar 5, and history smoke checks.
npm `latest` promotion and Issue #4 closure remain separate decisions.

The compatible `0.5.1` patch then published the additive read-only schema
command, bundled Draft 2020-12 artifacts, public lookup APIs, and Git 2.54 UTC
compatibility without changing Grammar 5 or CLI Contract 6. After durable
acceptance and canonical plan advance, the user separately selected
`perttool@0.5.1` for npm `latest`. One process-scoped
`npm dist-tag add perttool@0.5.1 latest` mutation succeeded. Fresh npm and
direct registry reads reported `beta=latest=0.5.1`; an unqualified isolated
installation confirmed version `0.5.1`, CLI Contract 6, Grammar 5, and all
eighteen root schemas. Issue #5 closure remains separate.

The published compatible `0.5.2` patch completes every nested result-schema
record and adds opt-in full and reference-based outline/detail discovery while
retaining Grammar 5, CLI Contract 6, result identities, payload meanings, and
the default complete lookup/query semantics. Release commit and peeled
`v0.5.2` target `501d4b1` agree; Node.js 22 and 24 CI passed; candidate,
GitHub, and npm tarballs are byte-identical at SHA-256
`e8512f0d...54bbce`; and npm reports `beta=0.5.2` with unchanged
`latest=0.5.1`. Durable acceptance independently reverified Git, GitHub, npm,
all three artifact copies, exact `0.5.1` compatibility, and both
public-package workflows. All five tasks and 17p are complete at `17p/1d`;
both makespans are zero, and complete NextResult v5 has no recommendation.
Git commit `3f7cc04` records the exact completed acceptance pre-advance
snapshot, and the plan is advanced to reached `RELEASE_052_ACCEPTED`. The
named release authorization does not include npm `latest` promotion or Issue
#5 closure.

The compatible `0.5.3` patch is accepted. It publishes the beta-only channel
guard and single-candidate,
scope-bound loose owner-confirmation workflow while retaining Grammar 5, CLI
Contract 6, and every existing command, option, result, schema, and
package-root identity. Human confirmation leads with available modification
time, exact UTF-8 sizes, diff counts, and semantic changes; digests remain
supplemental machine identity. `RELEASE_053_SELF_REVIEW` and
`RELEASE_053_PREPARATION` are complete. The immutable 491-file candidate was
accepted after clean revalidation and external preflight. Publication to the
GitHub prerelease and npm `beta` and durable acceptance are complete. All five
tasks and 15p are done; both makespans are zero, and complete NextResult v5
has no recommendation. Completed declarations remain until a separately
confirmed single-candidate `dag advance`. npm `latest` promotion remains
separate.

The compatible `0.5.4` patch is selected for the non-blocking `PTGOV-103`
runtime warning. A valid not-applicable candidate with a non-empty
owner-confirmation assertion set remains authorized by default, while
existing `--warnings-as-errors` prevents persistence. The patch retains every
command, option, result, schema, and package-root identity and does not add
accepted scopes, evidence, authentication, or cross-candidate state.
`RELEASE_054_SELF_REVIEW`, source preparation, and candidate acceptance are
complete. The retained 491-file, 521641-byte tarball has SHA-256
`d3123ef0...3c01`. Release commit, peeled tag, Node.js 22/24 CI, GitHub
prerelease, npm `beta=0.5.4`, and the common tarball agree. Independent public
installation and PTGOV-103 default/strict verification accepted the release.
All five tasks and 15p are complete, both makespans are zero, and complete
NextResult v5 has no recommendation. `latest=0.5.1`, plan advance, and npm
`latest` promotion remain separate.

The compatible `0.5.5` patch is durably accepted with the non-blocking `PTGOV-104`
runtime warning. A valid applicable preview with a non-empty
owner-confirmation assertion set remains successful by default and retains
its candidate and GovernanceDecision, while existing `--warnings-as-errors`
returns exit 1 with both still available. Persistent authority is unchanged.
Release commit `04055c9`, peeled tag, Node.js 22/24 CI, GitHub prerelease,
npm `beta=0.5.5`, and the common 491-file, 522117-byte tarball agree. All five
tasks and 15p are complete with zero makespans and no recommendation.
The user later separately authorized one `latest` mutation and the displayed
single-candidate plan advance. Fresh registry and unqualified-install checks
confirmed `beta=latest=0.5.5`, Contract 6, 34 commands, 18 schemas, and
Grammar 5. Governed advance used actor `codex`, owner assertion `user`, and
the exact preview digest; the residual plan has only reached
`RELEASE_055_ACCEPTED`, no diagnostics, no task, and no recommendation.

The selected `0.6.0` beta minor publishes the accepted ADV-001 history guard
and ADV-002 repository-clean candidate. Its exact initial 5,289-byte release
plan was confirmed for goal and DAG scopes. Self-review directly compared the
installed `0.5.5` artifact and current source under Node.js 22: Grammar 5, CLI
Contract 6, and every prior advance JSON key remain, while `dag advance`
selects `Perttool.AdvanceResult.v1`, required nullable `history_guard`, the
nineteenth root schema, and exact write-only `--force-history-loss`.
`0.5.6` would understate that result and write-safety boundary. Source
preparation identifies `0.6.0` and passed 712 tests, 29 self-use plans, 138
Markdown files, the temporary-link workflow, and the 504-file isolated-package
gate under Node.js 22. Candidate acceptance repeated the clean gate and
protected-route preflight and retained one 504-file, 543508-byte tarball with
SHA-256 `6d03e270...e42acd`. PUBLISH completed from that immutable tarball:
release commit `935b097`, peeled tag, successful Node.js 22/24 CI run
`30631050662`, GitHub prerelease, npm `beta=0.6.0`, and all three tarball
copies agree. Independent acceptance covered Git, both successful CI snapshots,
GitHub, npm, artifact identity, installed packages, and the repository-clean
history guard. All five tasks and 17p are complete with zero makespans and no
recommendation. `latest=0.5.5`, plan advance, and Issue mutation remain
outside the named release.

The selected `0.7.0` beta minor is the first package planned to publish the
accepted Grammar 6 and CLI Contract 7 conditional-plan-assurance boundary.
`plans/release-0.7.0.pert` sequences local gate design, Contract 7 readiness,
version-bearing preparation, one immutable candidate, separately authorized
GitHub/npm `beta` publication, and durable acceptance. The initial 2026-08-04
instruction authorized only gate design, and a later instruction separately
authorized Contract 7 readiness; the next instruction separately authorized
source preparation; subsequent instructions authorized candidate acceptance
and PUBLISH. The user then separately authorized the exact `0.7.0` npm
`latest` promotion, and a following instruction authorized the narrow
acceptance-condition replan and durable acceptance. The prepared manifest,
lockfile, and CLI identify `0.7.0`, and
`docs/process/0.7.0-preparation.md` records the accepted local gate. The
`RELEASE_070_CANDIDATE` was authorized only for clean-source verification,
read-only external preflight, and one retained tarball. Final review rejected
the preliminary SHA-256 `7e57cc89...3ac8a0` tarball because its bundled README
retained a transient preparation-time claim; those bytes remain preserved
under a SHA-bound rejected filename. Corrected clean source commit `51984c8`
passed the repeated complete Node.js 22 and read-only external gates. The
accepted fixed-path 601-file, 656702-byte candidate has SHA-256
`8585adb5...f4d623` and passed isolated Contract 7 file-first and
plan-assurance acceptance. Raw recommendation does not override the separate
publication boundary. The user later separately authorized PUBLISH from that
unchanged candidate. Release commit and peeled `v0.7.0` target `1279e3c`
agree; Node.js 22 and 24 CI run `30895944899` passed; the GitHub prerelease,
npm `beta=0.7.0`, and all three tarball copies agree at SHA-256
`8585adb5...f4d623`; at publication, `latest=0.6.0` and `alpha` remained
absent. Exactly one separately authorized post-publication mutation later made
`beta=latest=0.7.0`; an unqualified isolated installation confirmed Contract
7, 44 commands, and 20 schemas. Gate design, Contract 7 readiness, source
preparation, candidate acceptance, PUBLISH, and durable acceptance are complete
before advance. Independent Git, CI, GitHub, npm, byte-identity,
exact/beta/latest installation, rollback-pin, and complete public-package
verification passed. All six tasks and 21p are complete with zero makespans,
and fresh complete NextResult v6 has no ready, recommended, or startable task.
The acceptance record is `docs/process/0.7.0-release-acceptance.md`. Do not
infer authority for either plan advance or Issue mutation.

The selected `0.7.1` beta patch publishes the accepted
`GUIDE-CONSISTENCY-001` runtime guidance corrections without changing Grammar
6, CLI Contract 7, command, option, result, schema, payload-structure,
package-root, or authority identities. `plans/release-0.7.1.pert` sequences
compatibility self-review, version-bearing preparation, one immutable
candidate, separately authorized PUBLISH, and durable acceptance. The user's
2026-08-05 confirmation authorizes the exact initial plan candidate and local
`RELEASE_071_SELF_REVIEW` only. Do not infer authority for preparation,
candidate acceptance, remote writes, publication, npm `latest` promotion,
plan advance, or Issue mutation.

### 5.1 Adopted Recommendation authority

MIG-07 established Recommendation version 1 authority. Contract 4 added the
temporal release gate and Contract 7 adds assurance eligibility without
changing ranking. Because
`AGENTS.md`, `.github/copilot-instructions.md`, help, and safe-stop tests move
together, normal task selection uses the following as authority.

1. Select a work package from the macro plan's complete JSON recommendation
2. Reanalyze the selected work package's detail plan and select a task from its complete JSON recommendation
3. Start only IDs exposed by `startable_recommended_task_ids`; under normal
   authority, select only a subset of that set or retain it and add one
   time-eligible, resource-feasible allowed task
4. Confirm the decisive step, higher-priority tasks, and comparison, and explain the selection from project facts
5. Stop automatic selection for an unknown schema/version or authority policy,
   incomplete trace, `PTREC-*`, an assurance safe stop, future or unavailable
   temporal eligibility, or withheld assurance eligibility
6. Reanalyze the detail plan after a detail-task start, completion, block, or capacity change; also reanalyze the macro plan if macro work-package status, roll-up duration, or capacity changes

Human instructions to select `deferred` or `discouraged` are distinct from normal recommendations. Until the override-apply gate is met, do not fabricate an applied artifact; AI presents the difference and the not-yet-enabled audit/apply boundary. Provider-specific prompts, skills, agents, and hooks reach the same rules through the Issue #2 guide and do not add provider-specific priority rules.

Tool output is evidence for selection, not independent evidence of task completion. Confirm completion through the corresponding specification, code, and test results.

## 6. Parallel-agent workflow using isolated worktrees

Use sub-agents, delegation, or parallel agent work only when the user explicitly requests it or an effective runtime policy permits it. A `dag next` result that returns several `runnable_now` tasks means those tasks can run concurrently in the process; it does not itself authorize using agents.

### 6.1 Applicability conditions

Consider parallel work only when all of the following hold.

- Macro/detail plan checks and analysis succeed, and the target tasks can run concurrently under hard-predecessor and resource conditions
- The current main worktree is clean, and all agents can be pinned to the same base commit
- File ownership can be exclusively separated, or a boundary can be created where only the integration owner changes shared files
- Each task's acceptance criteria, non-goals, narrow validation, and commit condition can be written independently
- Shared external side effects such as deploys, pushes, and issue updates are not performed in parallel by agents

Do not parallelize edits to the same canonical file, an unresolved single semantic decision, serial dependencies, or work overlapping the user's uncommitted changes. Do not assume semantic independence merely because files differ.

### 6.2 Responsibilities of the integration owner and agents

The integration owner alone manages the following.

- Base commit, branch name, and absolute worktree paths
- Each agent's exclusive files, readable canonical sources, and prohibited files
- Integration of shared requirements, parent specifications, plan status, golden files, and process documents
- Review order for agent commits, semantic adjustment after integration, and whole-repository verification

Each agent changes no worktree other than the assigned one and makes one coherent commit containing only its exclusive files. Agents do not mark tasks in a shared plan `done`, push remotely, or cherry-pick from another branch. Completion reports include the commit hash, changed files, verification, and unresolved matters.

### 6.3 Worktree setup

Before creation, use read-only commands to confirm that main status, the base commit, existing worktrees, branches, and target paths do not conflict.

```sh
git status --short --branch
git worktree list --porcelain
git branch --list 'agent/<task-id>'
git worktree add -b agent/<task-id> <validated-absolute-path> <base-commit>
git -C <validated-absolute-path> status --short --branch
```

Use an explicit absolute path for each task as the target path. Do not use `~`, `$HOME`, the workspace root, or unresolved globs as creation/removal targets. Each agent prompt states the worktree path, branch, base, exclusive files, canonical sources to consult, acceptance, validation, and remote prohibition.

### 6.4 Review and integration

For each agent, perform the following in order.

1. Confirm that the target worktree is clean, the branch is as planned, and the commit descends directly from the base
2. Review exclusive-file boundaries, specifications, and missing tests with `git show --stat <commit>` and the actual diff
3. Reconfirm that main is clean and cherry-pick one commit at a time
4. After integrating every agent commit, have the integration owner update shared canonical sources and plans/golden files as one logical change
5. Run `npm run check` and `git diff --check`, then reconfirm macro/detail plan check/analyze/next results

The absence of a cherry-pick conflict does not prove semantic consistency. The integration owner reviews across both agents to ensure they have not fixed the same terms, versions, or invariants to different meanings. If they conflict, do not mechanically adopt both; resolve the shared decision on main.

### 6.5 Success, failure, and cleanup

A parallel trial succeeds only if all of the following hold.

- Each agent commits only exclusive files and its narrow validation succeeds
- Individual integration into main produces no unintended diff
- Cross-specification review and shared-canonical-source adjustment are complete
- The full repository check and post-reanalysis plan golden files succeed
- Commit history preserves logical units for agent results and the integration change

If an agent fails, times out, or exceeds scope, retain the target worktree and branch and inspect status/diff. Do not force-remove, force-delete, or automatically integrate an unreviewed commit. Even after success, before cleanup confirm that the worktree is clean and its branch commit is integrated into main; use only `git worktree remove` on a validated absolute path and ordinary `git branch -d`. Because the commit hash changes after cherry-picking, do not rely only on ancestor checks: confirm that the relevant commit from `git cherry main agent/<task-id>` is `-`, and inspect the actual main-side diff to verify patch equivalence. In that case ordinary `git branch -d` can refuse deletion because the branch is unmerged in ancestry. Do not automatically switch to `-D`; retain the source branch without explicit deletion permission.

### 6.6 2026-07-22 trial

`RANKING_POLICY` and `REASON_CODE_TAXONOMY` were confirmed to be both ready and `runnable_now` in `plans/control-plane.pert`, then separated into different branches/worktrees from commit `aaabd83`. Each agent committed only one new specification file, and they were integrated into main as `7333a12` and `9eb47cb` without conflict.

The integration owner made causal ranking reasons mandatory for recommended tasks in the reason taxonomy, and reconciled canonical references, requirements, basic design, plans, and golden files across both specifications. `npm run check` succeeded with 90 tests, 21 Markdown files, three self-use plans, and link/package checks.

This trial confirmed that main and other worktrees can remain clean and file conflicts can be avoided even when agents complete at different times. After confirming patch equivalence and clean status, the two worktrees were removed. The source branches were retained without force-deletion because ordinary deletion was refused as unmerged in ancestry after cherry-picking. Semantic consistency between specifications, shared traceability, and plan updates are not resolved automatically; they remain the sole responsibility of the integration owner.

## 7. Evolution rule

The TypeScript scaffold fixes the following.

- Node.js 22 or later, npm, ESM, and TypeScript 7.0
- `npm ci`, `npm run build`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:link`, `npm run check:package`, and `npm run check`
- CI runs `npm run check` on Node.js 22 and 24
- Sources are in `src/`, tests/fixtures are in `test/`, and generated artifacts are in `dist/`
- `node_modules/`, `dist/`, coverage, and tsbuildinfo are not tracked by Git
- Runtime dependencies are currently zero; add them only when required

Do not let AI configuration become more complex before the implementation workflow does.

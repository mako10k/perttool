# ADR 0003: `0.x.x` beta versioning and Issue #2 scope

- Status: Accepted
- Accepted scope: Base decision and the amendments listed under `Amended`
- Date: 2026-07-23
- Amended: 2026-07-23 (`v0.1.0` explicit `latest` promotion);
  2026-07-24 (`v0.2.0` Contract 3 release target);
  2026-07-25 (`v0.2.0` explicit `latest` promotion and `v0.3.0` Contract 4
  release target);
  2026-07-26 (`v0.3.0` explicit `latest` promotion);
  2026-07-27 (`v0.4.0` Contract 5 release target);
  2026-07-28 (`v0.4.0` beta publication, acceptance, and explicit `latest`
  promotion);
  2026-07-29 (`v0.5.0` Grammar 5 and Contract 6 release target);
  2026-07-30 (`v0.5.1` compatible Contract 6 patch release target and
  publication; `v0.5.2` compatible JSON Schema patch release target and
  publication; retirement of the obsolete npm `alpha` dist-tag);
  2026-07-31 (`v0.6.0` advance history safety release target);
  2026-08-04 (`v0.7.0` conditional plan assurance release target);
  2026-08-05 (`v0.7.1` Help and Guide consistency patch target);
  2026-08-07 (`v0.8.0` adapter platform and historical DAG beta target);
  2026-08-13 (`v0.9.0` Grammar 7 and CLI Contract 8 milestone-acceptance
  target);
  2026-08-18 (`v0.10.0` Grammar 8 and CLI Contract 9 temporal-scheduling
  target);
  2026-08-28 (accepted `v0.10.6` off-main compatible-hotfix publication
  gate);
  2026-09-07 (accepted `v0.11.0` Grammar 9 and CLI Contract 10 Planning Pool
  Gate Design Candidate 3.0);
  2026-09-08 (accepted compatible `v0.11.1` VSIX host reliability patch
  target)
- Supersedes: ADR 0002's decision to consider `v0.1.0` a stable candidate

## Context

`v0.1.0-alpha.2` completed the MVP acceptance criteria, recommendation authority, distribution of one artifact through GitHub and npm, and installation from the registry. The next publication stage requires read-only guidance that applies AI Project Control Plane decisions to each coding agent.

Operating long-lived SemVer prerelease suffixes would duplicate the product maturity defined by perttool in npm and GitHub notation. Because breaking changes are allowed before 1.0, each version does not need to retain a `-beta` suffix.

## Decision

- `v0.1.0-alpha.2` is the final alpha.
- The first beta candidate is suffix-free `0.1.0`.
- Define `0.x.x` as perttool's beta series and do not use `-alpha` or `-beta` suffixes.
- The stable series begins with a future `1.0.0`. npm `latest` does not declare stability; it identifies the explicitly recommended default installation version.
- Do not require strict compatibility from alpha to the first beta. Necessary breaking changes are allowed.
- A breaking change updates the affected schema version, specifications, migration guidance, CHANGELOG, and tests in the same logical change.
- Treat alpha dogfooding, local linking, and GitHub/npm artifact installation as a sufficient usage period for the beta transition; do not require an additional soak period.
- Include the read-only AI Agent Guidance Registry v1 from [Issue #2](https://github.com/mako10k/perttool/issues/2) in beta scope.
- Do not include the backlog hierarchy and multi-plan composition from Issue #3, the LSP server, VSIX, MCP server, or guidance audit, scaffolding, and enforcement in the beta entry gate.
- Publish to npm under the `beta` dist-tag without changing the existing `latest` tag in that publication operation. After release acceptance, only a separately authorized dist-tag operation explicitly approved by a human may promote the accepted beta to `latest`.
- Maintain only the npm `beta` and `latest` distribution channels. Do not
  publish through or retain an `alpha` dist-tag. Historical alpha versions
  remain installable by exact version pin; reintroducing an alpha channel
  requires a new release-policy decision and separately authorized dist-tag
  creation.
- Publish a suffix-free `0.x.x` GitHub Release as a prerelease to match product maturity.
- Select suffix-free `0.2.0` for the first package that publishes the accepted
  breaking CLI Contract 3 surface. `0.1.1` would understate the compatibility
  change, while `1.0.0` remains reserved for a future stable-series decision.
- Select suffix-free `0.3.0` for the first package that publishes accepted
  Grammar 3, temporal/deadline results, exact unit migration, NextResult v4
  normal authority, and the breaking CLI Contract 4 surface. `0.2.1` would
  understate the public grammar, command, schema, and authority changes.
- Select suffix-free `0.4.0` for the first package that publishes accepted
  Grammar 4, owner-aware goal and DAG mutation governance, and the breaking
  CLI Contract 5 surface. `0.3.1` would understate the grammar, JSON schema,
  command-option, and persistent-write authority changes.
- Select suffix-free `0.5.0` for the first package that publishes accepted
  Grammar 5 work events and suspended state, governed lifecycle mutations,
  read-only project history and velocity observation, and the breaking CLI
  Contract 6 surface. `0.4.1` would understate the grammar, command, result
  schema, and lifecycle compatibility boundary.
- Select suffix-free `0.5.1` for the backward-compatible Contract 6 patch
  that adds read-only JSON Schema discovery and bundled result artifacts and
  accepts Git 2.54's strict `Z` UTC commit-time form. Existing Grammar 5
  meanings, command descriptors, result identities, payload meanings, and
  package-root exports are retained; a new minor or Contract 7 would
  overstate this additive and corrective boundary.
- Select suffix-free `0.5.2` for the backward-compatible Contract 6 patch
  that completes underspecified nested result schemas and adds explicit
  `full` and reference-based `outline` schema views. Existing Grammar 5,
  runtime result identities and payload meanings, default schema lookup
  mode and query projection, commands, and package-root values are retained;
  a new minor, Contract 7, or result-identity cutover would overstate this
  corrective and opt-in boundary.
- Select suffix-free `0.6.0` for the first package that publishes the accepted
  ADV-001 repository-aware `dag advance --write` guard and the ADV-002
  repository-clean candidate correction. `dag advance` changes from the
  closed published `Perttool.MutationResult.v3` identity to
  `Perttool.AdvanceResult.v1`, adds the required nullable `history_guard`, and
  adds exact `--force-history-loss` recovery. `0.5.6` would understate that
  result-identity and write-safety boundary. Grammar 5, CLI Contract 6 command
  names, existing option defaults, and every non-advance result identity
  remain unchanged, so Contract 7 or Grammar 6 would overstate it.
- Select suffix-free `0.7.0` for the first package that publishes the accepted
  Grammar 6 and CLI Contract 7 conditional plan-assurance boundary. The
  command registry, result identities, governance interface, recommendation
  start-authority policy, advance semantics, schema catalog, and package root
  change together. `0.6.1` would understate this breaking public boundary,
  while `1.0.0` remains reserved for a future stable-series decision.
- Select suffix-free `0.7.1` for the backward-compatible Contract 7 patch that
  publishes the accepted `GUIDE-CONSISTENCY-001` corrections to Guide meaning,
  Help examples, diagnostic navigation, conversion-diagnostic coverage, and
  current-versus-historical documentation labels. Grammar 6, CLI Contract 7,
  command and option identities, result and schema identities, payload
  structure, package-root exports, and authority remain unchanged. Leaving the
  correction unreleased would strand runtime guidance fixes in source, while
  `0.8.0` would overstate this corrective boundary.
- Select suffix-free `0.8.0` for the additive Contract 7 package that publishes
  the accepted `perttool/core` and `perttool/node` subpaths, read-only
  `dag history`, `Perttool.HistoricalGraphResult.v1`, the twenty-first root
  schema, the 122-name root and Node facade, and the declaration-identity
  correction. `0.7.2` would understate the new command, schema, and public
  subpath boundary. Grammar 6, CLI Contract 7, existing meanings, and
  start-authority semantics remain unchanged, so a new Grammar or Contract
  version would overstate it. Private LSP, VSIX, and MCP packages remain
  excluded from the public npm artifact.
- Select suffix-free `0.9.0` for the first package that publishes Grammar 7,
  CLI Contract 8, milestone criterion sets and receipts, committed migration,
  acceptance-aware check, analysis, Next and canonical advance, historical
  milestone acceptance, and the accepted read-only adapter projections. The
  public command, result, schema, authority, migration, and root-export
  boundaries change together. `0.8.2` would understate this breaking public
  boundary, while `1.0.0` remains reserved for a future stable-series
  decision. Private LSP, VSIX, and MCP packages remain excluded from the
  public npm artifact.
- Select suffix-free `0.9.1` for the compatible correction that binds
  declared velocity observation to the exact current operand while retaining
  revision-bound Git-recorded evidence. Grammar 7, CLI Contract 8, command,
  result, schema, export, and authority identities remain unchanged. Leaving
  the correction unreleased would strand the installed workflow, while a new
  minor would overstate the boundary.
- Select suffix-free `0.10.0` for the first package that publishes Grammar 8,
  CLI Contract 9, calendar and availability maintenance, event constraints,
  forward and required schedules, POSTDUE projections, source-preserving
  temporal mutation, and the seven replacement result identities. The public
  command boundary changes from 53 to 56 while the active root-schema count
  remains 23 through replacement, root and Node exports remain 129, Core
  exports remain 45, and `Perttool.AdvanceResult.v3` remains unchanged.
  `0.9.5` would understate the grammar, command, result, schema, migration, and
  temporal-authority boundary, while `1.0.0` remains reserved for a future
  stable-series decision. Private LSP, VSIX, and MCP packages remain excluded
  from the public npm artifact.

### Off-main compatible-hotfix publication

#### Context

Issue #36 required a compatible `0.10.6` correction from exact published
`v0.10.5`, while `origin/main` already contained separately preserved future
`0.11.0` Planning Pool work. Making the old-version release commit equal to
`origin/main` would either discard that work or include unreleased `0.11.0`
changes in the patch artifact. Neither result represented the selected hotfix.
The user selected an isolated worktree from `v0.10.5` and separately
authorized the immutable candidate and publication batch.

#### Decision

The default publication route continues to require the release commit, peeled
annotated tag, and `origin/main` to be identical. A compatible hotfix based on
an older published tag may instead use the explicit
`--remote-branch BRANCH --expect-main COMMIT` route when all of these
conditions hold:

1. the local branch name is the exact validated remote branch name;
2. the remote branch and peeled annotated release tag both identify `HEAD`;
3. `origin/main` remains the exact separately approved commit rather than the
   release commit;
4. the release candidate records the old-version base, remote branch, expected
   main commit, and correction-only commit; and
5. no force push, main rewrite, version-line merge, or future-work inclusion is
   permitted by this exception.

#### Alternatives

- Rewriting `origin/main` to the hotfix was rejected because it would replace
  preserved future work.
- Merging future `0.11.0` work into `0.10.6` was rejected because it would make
  the patch version and rollback claim false.
- Publishing manually outside the guarded script was rejected because it would
  remove the exact remote-ref and distribution-tag checks.
- Deferring Issue #36 until `0.11.0` was rejected because the defect existed in
  published `0.10.5` and the user selected a compatible patch release.

#### Claim, evidence, and implementation action

- `CLM-ADR3-HOTFIX-001`: an explicit off-main release ref preserves both the
  old-version candidate and the independently advancing main line.
  - `EVD-ADR3-HOTFIX-001`: the `0.10.6` worktree descended from peeled
    `v0.10.5` commit `7379870db2ec000243f02cda6d86af514af7feef`, while
    `origin/main` identified separately preserved Planning Pool work.
  - `ACT-ADR3-HOTFIX-001`: the exact `v0.10.6` publication source kept the
    script's main-only default and added the explicit branch plus expected-main
    equality gate.
- `CLM-ADR3-HOTFIX-002`: the exception did not broaden npm channel or artifact
  authority.
  - `EVD-ADR3-HOTFIX-002`: exact tag, clean worktree, tarball identity, npm
    identity, unused version, `beta`, and unchanged `latest` checks remained
    mandatory for `v0.10.6`.
  - `ACT-ADR3-HOTFIX-002`: publication and readback verified the explicit
    branch, unchanged main, peeled tag, and common artifact bytes.

#### Consequences and follow-up

Hotfix commits may be published without changing the future-work main line,
but only through a named remote branch and exact expected-main binding. The
extra branch is a release record, not an alternative default branch. The
Issue #36 source correction remains a separate commit so it can be applied to
the preserved `0.11.0` line without importing `0.10.6` version artifacts.

This amendment is accepted for the explicitly selected and durably verified
`0.10.6` hotfix flow. npm `latest` movement, Issue mutation, plan advance, and
later release-line integration retain their separate approval boundaries.

### Accepted Planning Pool `0.11.0` target

#### Context

The accepted Planning Pool source changes the public grammar, CLI contract,
command and schema catalogs, public facades, migration result, and advance
result together. The published `0.10.6` line contains the compatible Issue #36
canonical-governance correction, while the preserved `0.11.0` line contains
future Planning Pool work and must carry that exact source correction without
importing the old line's package identity or candidate artifacts. Independent
gate review also found that the initial Contract 10 composition could not
apply milestone criterion or receipt mutations to a valid Grammar 9 source;
that correction is independently accepted. The later gate audit found two
additional inherited authority defects: generic Grammar 7 through 9 assurance
mutation preserves a lowered nested governance source digest, and Issue #37
permits a complete NextResult to recommend a task that the same result marks
non-runnable. Neither changes the truthful SemVer direction. Both were P1 gate
blockers and now have independently accepted conformant correction Outcomes.
The corrected Candidate 3.0 passed exact-byte independent review with no P0
through P3 findings and was accepted by the owner on 2026-09-07.

#### Decision

The owner accepts exact reviewed Gate Design Candidate 3.0 and selects
suffix-free `0.11.0` for the first package that publishes Grammar 9,
CLI Contract 10, Work, project-owned Event and Activity AoA, bounded Window
operations, Planning Pool observation and history, guided reshape, and the
replacement advance and unit-migration results. The public boundary changes
from 56 to 71 commands, 23 to 29 active root schemas, 129 to 139 root and Node
exports, and 45 to 51 Core exports.

The release line must contain both the exact Issue #36 source correction from
published `0.10.6` and the accepted Grammar 9 milestone-acceptance composition
correction. Grammar 1 through 8 reads remain available. Grammar 8 to 9
migration is explicit and additive: it changes only the version field and
owned migration trivia and inserts no Planning Pool declaration. The exact
published `0.10.6` package is the rollback pin. Private LSP, VSIX, and MCP
packages remain excluded.

Before this gate may become Accepted, generic assurance mutations over Grammar
7 through 9 must expose one authoritative outer governance source binding, and
Issue #37 must no longer expose contradictory recommended and runnable start
signals without an explicit typed distinction. The independently accepted
Issue #38 and #37 correction Outcomes satisfy those two inputs. The exact-byte
independent review and owner acceptance satisfy the Gate Design decision input.
GitHub Issue state and later PERT lifecycle operations remain separately
owner-gated.

Owner acceptance of this gate selects only the release boundary and procedure.
It does not authorize source preparation, candidate commitment, push, tag,
GitHub Release creation, npm publication, distribution-tag movement, Issue
mutation, or plan advance. Each later mutation remains bound to its named PERT
task and separate authority.

#### Alternatives

- `0.10.7` is rejected because it would understate the breaking grammar, CLI
  contract, command, result, schema, migration, and Planning Pool authority
  boundary.
- `1.0.0` is rejected because the stable series remains a future decision and
  this release does not add a stable compatibility promise.
- Releasing Planning Pool without the Issue #36 forward correction is rejected
  because it would reintroduce the published governance defect on the new
  version line.
- Accepting the gate before the Grammar 9 milestone-acceptance correction is
  rejected because a valid Contract 10 document would lose an existing
  Contract 8 mutation capability.
- Accepting the gate with a lowered nested governance source digest is rejected
  because the release could not truthfully claim a digest-bound governance
  result even though outer safe-write checks remain effective.
- Silently carrying Issue #37 is rejected because the same complete NextResult
  would continue to provide contradictory operational start signals.

#### Claim, evidence, and implementation action

- `CLM-ADR3-011-001`: suffix-free `0.11.0` is the smallest truthful version for
  the accepted public boundary.
  - `EVD-ADR3-011-001`: the accepted integration surface has Grammar 9, CLI
    Contract 10, 71 commands, 29 root schemas, 139 root and Node exports, and
    51 Core exports. The direct evidence is
    [`planning-pool-release-integration-acceptance.md`](../process/planning-pool-release-integration-acceptance.md),
    bound to accepted basis
    `sha256:6363d1eef9d59d939c4df259616eeca62a9f367550403678b79859c4c5714013`.
  - `ACT-ADR3-011-001`: bind preparation and candidate checks to those exact
    identities and the replacement advance and unit-migration results.
- `CLM-ADR3-011-002`: the release can preserve rollback and forward-correction
  truth without importing old-line release artifacts.
  - `EVD-ADR3-011-002`: the Issue #36 correction-only commit and its `0.11.0`
    integration commit are
    `56b7142fe4a6dbffa43847d73ba75854a4c696d2` and
    `eb6e59da5f058229fa5e2603ce86329821b4e45e`. They have stable patch ID
    `84fe584b8a2895187bcf72df2af289103b49ca88` and identical changed-file
    bytes, as recorded in
    [`0.11.0-gate-design.md`](../process/0.11.0-gate-design.md).
  - `ACT-ADR3-011-002`: require that correction in source preparation, retain
    exact `0.10.6` as the rollback pin, and reject copied `0.10.6` version or
    candidate artifacts.
- `CLM-ADR3-011-003`: Contract 10 must retain milestone-acceptance mutation on
  Grammar 9 before release-gate acceptance.
  - `EVD-ADR3-011-003`: the independent gate review reproduced exit 1 with no
    candidate for a valid Grammar 9 criterion replacement because the outer
    Planning Pool declarations were not composed through the older
    milestone-acceptance planner. Subsequent exact-byte review also rejected
    the single-range Candidate 1.1 and governance-denied Candidate 1.2. The
    reproductions, causes, corrective edits, complete-gate evidence, and
    current independent-review status are recorded in
    [`grammar9-milestone-acceptance-mutation-acceptance.md`](../process/grammar9-milestone-acceptance-mutation-acceptance.md).
  - `ACT-ADR3-011-003`: complete and independently review
    `POOL_GRAMMAR9_ACCEPTANCE_MUTATION`, including CLI and installed-package
    regression, before `POOL_RELEASE_GATE_DESIGN` becomes eligible.
- `CLM-ADR3-011-004`: accepting this gate cannot serve as release-write
  authority.
  - `EVD-ADR3-011-004`: the release PERT places preparation, candidate,
    PUBLISH, and durable acceptance after the gate-design milestone. The exact
    authority source is
    [`planning-pool-release-readiness.pert`](../../plans/planning-pool-release-readiness.pert),
    currently at source digest
    `sha256:1d1862bb053912097656b1d493108652711fde26e586846688b7a8faca100c52`:
    all three correction Outcomes and Gate Design are conformant and verified.
    Preparation is structurally ready but assurance-withheld by its retained
    `replan_and_reseal` action, and every external mutation remains blocked.
  - `ACT-ADR3-011-004`: request separate authority at each mutation boundary
    and prohibit external writes during gate design and source preparation.
- `CLM-ADR3-011-005`: gate acceptance requires one authoritative outer source
  binding for every nested governance decision and one coherent typed current
  start signal in complete Next results.
  - `EVD-ADR3-011-005`: the exact read-only Grammar 7 replay and Issue #37 are
    recorded in [`0.11.0-gate-design.md`](../process/0.11.0-gate-design.md) as
    `E-011-BINDING-001` and `E-011-NEXT-001`.
  - `ACT-ADR3-011-005`: both P1 corrections were issueized, replanned,
    corrected, and independently accepted under separate owner authority. The
    resealed Candidate 3.0 then passed exact-byte independent review with no P0
    through P3 findings and was accepted by the owner.

#### Consequences and follow-up

This accepted amendment selects a release that, if later published, will add
the accepted Planning Pool public surface while preserving older reads and an
exact Contract 9 rollback pin. A Grammar 9 source that uses
Planning Pool declarations has no automatic downgrade to Grammar 8. Only npm
`beta` may move during a separately authorized PUBLISH operation; `latest`,
public VSIX, Issue closure, plan advance, and Issue #24 Goal Coverage and Goal
Seal remain separate decisions. Gate Design task finish and its conformant
Outcome were separately authorized and completed after amendment acceptance;
Preparation reseal and start remain separate PERT lifecycle decisions.

### Accepted compatible `0.11.1` VSIX host reliability patch

#### Context

The immutable `0.11.0` package is durably accepted, but its first hosted
release check exposed a recurring repository-gate dependency on a second VS
Code extension-inventory process. The supported-host harness already owned the
install or uninstall process and its profile directory. It nevertheless
started another `code --list-extensions --show-versions` process solely to
read back the registry. The second process could remain alive after producing
no decisive failure evidence. The accepted correction instead parses the
CLI-written profile-local `extensions.json` after the owning command exits.

#### Decision

Select suffix-free `0.11.1` for the compatible correction. Retain Grammar 9,
CLI Contract 10, 71 commands, 29 active root schemas, 139 root and Node
exports, 51 Core exports, all result identities, and all public runtime
meanings. Publish only through the existing beta candidate and exact-artifact
gates. Exact `perttool@0.11.0` is the rollback pin.

#### Alternatives

- Reusing `0.11.0` is rejected because published npm and annotated-tag
  identities are immutable.
- Selecting `0.12.0` is rejected because no public grammar, CLI, schema,
  export, or runtime meaning changes.
- Leaving the correction only on `main` is rejected by the owner's explicit
  release decision because it would not create a durable post-correction
  distribution identity.

#### Claim, evidence, and implementation action

- `CLM-ADR3-0111-001`: `0.11.1` is a compatible patch, not a new public
  contract boundary.
  - `EVD-ADR3-0111-001`: the diff from peeled `v0.11.0` through correction
    commit `5197da8148645248ae3c4acfd6e919d00afbab8a` changes the repository
    VSIX harness, tests, and evidence records without changing public runtime
    source or schemas. Node.js 22 and 24 passed GitHub Actions run
    `34190654050` at that commit.
  - `ACT-ADR3-0111-001`: keep every public identity count and semantic
    contract unchanged while aligning only the patch version and release
    records.
- `CLM-ADR3-0111-002`: a new immutable candidate is required even though the
  public runtime semantics are unchanged.
  - `EVD-ADR3-0111-002`: npm reports published `0.11.0` and no `0.11.1`; fresh
    GitHub reads found no `v0.11.1` tag or Release.
  - `ACT-ADR3-0111-002`: retain one exact `0.11.1` tarball, obtain
    candidate-bound publication confirmation, and publish that byte-identical
    artifact once to npm `beta`.

#### Consequences and follow-up

The release creates a new source and package identity for the corrected gate
without claiming a consumer-facing feature change. npm `latest`, public VSIX
publication, Issue mutation, and plan advance remain separate decisions.

On 2026-07-23, after `v0.1.0` beta acceptance, the user explicitly promoted `perttool@0.1.0` to npm `latest`. The `beta` tag continues to point to the same version, and `alpha` remains on `0.1.0-alpha.2`.

On 2026-07-24, after source and isolated-package acceptance of CLI Contract 3,
the user selected `0.2.0` as the next release target. The
[`v0.2.0` release procedure](../process/0.2.0-release.md) governs preparation,
authorization, distribution, and acceptance. This selection does not itself
change package identity or authorize an external write.

On 2026-07-25, after `v0.2.0` beta acceptance, the user explicitly promoted
`perttool@0.2.0` to npm `latest`. Registry reads and an isolated
`perttool@latest` installation confirmed that `beta` and `latest` both resolve
to Contract 3 `0.2.0`; `alpha` remains on `0.1.0-alpha.2`. Product maturity
remains beta.

On 2026-07-25, the user selected the next meaningful release as `0.3.0` and
authorized work through its named publication task. The
[`v0.3.0` release procedure](../process/0.3.0-release.md) keeps scheduling and
unit implementation in its milestone/detail plans, verifies the accepted
Contract 4 input in the release plan, and separates source preparation,
candidate acceptance, publication, and durable acceptance. That authorization
does not include npm `latest` promotion.

On 2026-07-26, after `v0.3.0` beta publication and release acceptance, the
user explicitly promoted `perttool@0.3.0` to npm `latest`. Registry reads and
an unqualified global installation confirmed that `beta` and `latest` both
resolve to Contract 4 `0.3.0`; `alpha` remains on `0.1.0-alpha.2`. Product
maturity remains beta.

On 2026-07-27, after repository-source and locally packed Contract 5
acceptance, the user selected the next task as design of the `0.4.0` release
gate. The [`v0.4.0` release procedure](../process/0.4.0-release.md) verifies
the completed governance acceptance before source preparation and retains
publication as a separately authorized task. This gate-design authorization
does not authorize Git push, tag creation, GitHub or npm publication, npm
`latest` promotion, or Issue #4 closure. A subsequent instruction authorized
only the Contract 5 readiness gate and retained the same external-write
exclusions.

On 2026-07-28, the user instructed perttool to perform the next release task.
That authorizes local `RELEASE_040_PREPARATION`, including version-bearing
source, migration guidance, tests, and package validation. It does not
authorize Git push, tag creation, GitHub or npm publication, npm `latest`
promotion, or Issue #4 closure.

Later on 2026-07-28, after the assistant stated that the next bounded scope
was candidate acceptance without PUBLISH, the user instructed perttool to
continue toward the release. That authorizes local
`RELEASE_040_CANDIDATE`, including read-only external availability and
credential-route checks plus one retained tarball. It does not authorize Git
push, tag creation, GitHub or npm publication, npm `latest` promotion, or
Issue #4 closure.

After the PUBLISH boundary was stated again, the user instructed perttool to
proceed. That separately authorized the named `0.4.0` Git, GitHub prerelease,
and npm `beta` publication batch. The release commit and peeled tag agree,
and the candidate, GitHub, and npm tarballs are byte-identical. npm now
reports `beta=0.4.0` and unchanged `latest=0.3.0`. Release acceptance, npm
`latest` promotion, and Issue #4 closure remain separate decisions.

Later on 2026-07-28, durable acceptance reverified both public tarballs and
their installed Contract 5 workflows. All six release tasks and 19p are
accepted over two active days and advanced to reached
`RELEASE_040_ACCEPTED`; the plan has zero makespans and no recommendation.
The user then explicitly selected `perttool@0.4.0` for a
separate post-acceptance npm `latest` promotion. The one-time dist-tag
mutation succeeded; fresh registry reads and an unqualified isolated
installation confirmed `beta=latest=0.4.0`, CLI Contract 5, and Grammar 4.
Product maturity remains beta, and Issue #4 closure remains a separate
decision.

On 2026-07-29, after Project Actuals and the independent English repository
baseline reached acceptance, the user selected and authorized the complete
named `0.5.0` release flow and an exact post-release local installation. The
[`v0.5.0` release procedure](../process/0.5.0-release.md) keeps those
accepted workstreams separate, then sequences release-gate design, Contract 6
readiness, source preparation, candidate acceptance, Git/GitHub/npm `beta`
publication, durable acceptance, and the requested local installation.
That authorization does not include npm `latest` promotion or Issue #4
closure.

On 2026-07-30, after source acceptance of the Issue #5 JSON Schema artifacts
and the Git 2.54 CI correction, the user requested a self-review and
authorized the complete named `0.5.1` release if no blocking finding
remained. The [`v0.5.1` release
procedure](../process/0.5.1-release.md) sequences compatibility review,
source preparation, candidate acceptance, Git/GitHub/npm `beta`
publication, and durable acceptance. It does not authorize npm `latest`
promotion or Issue #5 closure.

The named PUBLISH gate then passed. Release commit and peeled `v0.5.1` target
`31d162a` agree; candidate, GitHub, and npm tarballs are byte-identical at
SHA-256 `93f3e01a...1339`; npm reports `beta=0.5.1` with unchanged
`latest=0.4.0`; and both public-package workflows pass. Durable acceptance
then independently reverified Git, GitHub, npm, both public artifacts, the
additive compatibility boundary, and installed workflows. The user then
separately authorized one post-acceptance `latest` mutation; fresh registry
reads and an unqualified isolated install confirmed `beta=latest=0.5.1`,
CLI Contract 6, Grammar 5, and schema discovery. Issue #5 closure remains a
separate decision.

Later on 2026-07-30, after finding that the published schemas still contained
underspecified nested object placeholders, the user required complete child
records, requested reference-based compact display, selected `0.5.2`, and
authorized the complete named release. The
[`v0.5.2` release procedure](../process/0.5.2-release.md) keeps compatibility
review, preparation, candidate acceptance, publication, and durable
acceptance sequential. It does not authorize npm `latest` promotion.

The named `v0.5.2` PUBLISH gate then passed. Release commit and peeled
`v0.5.2` target `501d4b1` agree; candidate, GitHub, and npm tarballs are
byte-identical at SHA-256 `e8512f0d...54bbce`; npm reports `beta=0.5.2`
with unchanged `latest=0.5.1`; and both public-package workflows pass.
Durable acceptance then independently reverified Git, GitHub, npm, all three
artifact copies, exact `0.5.1` compatibility, and both public-package
workflows. npm `latest` promotion and Issue #5 closure remain separate
decisions.

Later on 2026-07-30, the user retired the obsolete npm `alpha` distribution
channel because it was not part of the maintained beta-to-`latest` flow and
had remained pinned to `0.1.0-alpha.2`. The separately authorized operation
removed only the `alpha` dist-tag. It did not unpublish the historical
version, move `beta=0.5.2` or `latest=0.5.1`, publish a package, alter a
GitHub Release, promote `latest`, or close Issue #5.

## Beta gate

1. Accept Issue #2's normative contract, five-provider baseline, Core, text and JSON projections, CLI, package, and security boundaries.
2. Where an existing command has local compatibility requirements, satisfy that Issue acceptance. Project-wide alpha compatibility is not required.
3. Align `package.json`, the CLI version, tag, GitHub asset, and npm version on the same suffix-free `0.x.x`.
4. Distribute the same tarball through GitHub and npm, and verify the `beta` dist-tag, registry integrity, and isolated installation.
5. The publish operation leaves `latest` unchanged. Any later promotion is a separately authorized post-acceptance action and is not part of the beta publication gate.

## Consequences

- Stable compatibility cannot be inferred from `0.x.x` alone. Users must review the CHANGELOG and schema versions.
- The publication script accepts only the maintained `beta` channel.
- The 2026-07-23 beta release changed the then-current `0.1.0-alpha.2` package
  identity to `0.1.0` only in the release commit after Issue #2 acceptance.
- Keep historical alpha package versions available by exact pin without an
  active alpha distribution tag.
- Control the beta transition through Issue #2 and the release gate in the project model, without waiting for external feedback.
- An unqualified npm install follows the explicitly promoted `latest` tag. Product maturity remains beta until a separate `1.0.0` stable decision.

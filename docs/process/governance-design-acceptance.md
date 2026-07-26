# Issue #4 Owner-Aware Governance Design Acceptance Review

- Document status: Accepted 1.0
- Acceptance date: 2026-07-26
- Issue: [Issue #4](https://github.com/mako10k/perttool/issues/4)
- Plan: [../../plans/governance.pert](../../plans/governance.pert)
- Governance semantics version: `1`
- Governance source contract version: `1`
- Interface: `perttool.governance-interface@1`
- Interface acceptance IDs: `GOV-IF-001` through `GOV-IF-015`
- Source example IDs: `GOV-SRC-001` through `GOV-SRC-006`
- Authority/write example baseline: `Perttool.GovernanceExampleBaseline.v1`

## 1. Decision

Accept the cross-cutting design for Issue #4. The requirements, DSL and
mutation contracts, governance source, authority, and interface
specifications, basic design, normative examples, and delivery process are
mutually consistent after the resolutions in this review.

There are no open governance design review findings. The accepted contracts
provide complete implementation input for the source model and the pure
authority evaluator. Later implementation must preserve the identities,
criterion trace, non-goals, and atomic activation boundary recorded here.

This is design acceptance, not runtime activation. The active `0.3.0` runtime
continues to support Grammar 1, 2, and 3 and CLI Contract 4. It exposes
`Perttool.ProjectResult.v2` and `Perttool.MutationResult.v1`, rejects explicit
Grammar 4 and governance options, and performs no owner-aware write
enforcement.

No Git push, Git integration, release publication, package-version choice,
GitHub Release, npm publication, or dist-tag change is authorized by this
acceptance.

## 2. Accepted identities

| Concern | Accepted identity |
| --- | --- |
| Governance semantics | version `1` |
| Governance source contract | version `1` |
| Public governance interface | `perttool.governance-interface@1` |
| Target grammar | Grammar 4, with Grammars 1 through 3 retained |
| Target CLI | CLI Contract 5 |
| Project result | `Perttool.ProjectResult.v3` |
| Mutation and advance result | `Perttool.MutationResult.v2` |
| Nested decision | `Perttool.GovernanceDecision.v1` |
| Authority denial | `PTGOV-101`, existing domain-error exit `1` |
| Invalid Core assertions | `PTGOV-102` |
| Retained stale-write denial | `PTIO-501`, existing write-conflict exit `5` |
| Authority/write example baseline | `Perttool.GovernanceExampleBaseline.v1` |

`Perttool.AnalysisResult.v3`, `Perttool.NextResult.v4`, recommendation
interface 1, ranking algorithm 1, reason taxonomy 1.0, and normal start
authority retain their accepted meanings. Governance metadata is not a
recommendation fact, dependency, or scheduling resource.

## 3. Review scope

- Goal/DAG authority and non-goals in
  [Requirements sections 2.6, 4, and 12.3](../requirements.md#26-separate-plan-maintenance-from-goal-and-dag-authority)
- Grammar 4 field and version closure in the
  [DSL Grammar specification](../specs/dsl-grammar.md)
- Localized governance-field edits and atomic candidate behavior in the
  [Mutation Semantics specification](../specs/mutation.md)
- [Governance Source and Effective-Metadata specification](../specs/governance-source.md)
- [Owner-Aware Mutation Governance Semantics specification](../specs/governance-authority.md)
- [Owner-Aware Governance Interface Contract](../specs/governance-interface.md)
- [Normative Governance Source Examples](../examples/governance-source.md)
- [Normative Owner-Aware Governance Examples](../examples/governance.md)
- [Basic design Post-MVP Slice 4G](../basic-design.md#post-mvp-slice-4g-owner-aware-mutation-governance)
- The independent delivery and self-use sequence in
  [`plans/governance.pert`](../../plans/governance.pert) and
  [the self-use process](self-use.md)

## 4. Resolved review findings

| ID | Finding | Resolution | Status |
| --- | --- | --- | --- |
| `GOV-R1` | One non-owner assertion cannot represent distinct goal and DAG owners without ambiguity. | The interface selects a repeatable `--accepted-by-owner`; Core normalizes one operation-level set, rejects duplicates, and requires every distinct effective owner. `GOV-008` and `GOV-009` fix equal-owner and distinct-owner batches. | Resolved |
| `GOV-R2` | A candidate that changes an owner or delegate could otherwise grant the actor authority during the same atomic operation. | Source metadata is resolved from the digest-bound pre-change document. Candidate metadata never replaces that snapshot, and `GOV-010` requires a fresh decision against a new digest before later authority can apply. | Resolved |
| `GOV-R3` | “Graph import” could incorrectly govern creation of a new document or exempt replacement of an existing document. | Current new-document import invents no pre-change authority and remains outside governance. Any existing-document replacement is a DAG change and uses the same classifier and evaluator as direct, batch, and advance paths. `GOV-013` fixes both sides. | Resolved |
| `GOV-R4` | Direct-edit wording could overstate protection that a source file cannot technically provide. | The exact generated warning, help, Guide, README, and installed behavior must state that direct editing bypasses checks. They may not claim authentication or prevention of byte edits. `GOV-015` fixes the wording boundary. | Resolved |

## 5. Issue #4 acceptance-criterion trace

| ID | Issue acceptance criterion | Normative resolution | Boundary evidence | Delivery gate |
| --- | --- | --- | --- | --- |
| `GOV-AC-001` | Omitted governance fields preserve existing documents and resolve both owners to `user` with empty delegates. | Requirements 2.6 and 12.3; Source 5 and 6; Interface `GOV-IF-009` | `GOV-SRC-001`, `GOV-SRC-003`, `GOV-001` | `GOV_SOURCE_MODEL`, then `GOV_ACCEPTANCE` |
| `GOV-AC-002` | Governed preview needs no assertions and reports whether the corresponding write needs confirmation. | Authority 5.2; Interface 4.2, 6.3, and `GOV-IF-004` | `GOV-002` | `GOV_AUTHORITY_CORE`, `GOV_CLI_PREVIEW` |
| `GOV-AC-003` | A non-owner and non-delegate write fails with a stable governance diagnostic. | Authority 5.3 and 7; Interface 8.1 and `GOV-IF-005` | `GOV-004`, `GOV-006`, `GOV-007` | `GOV_AUTHORITY_CORE`, `GOV_WRITE_ENFORCEMENT` |
| `GOV-AC-004` | The same candidate succeeds when the supplied owner confirmation exactly matches the effective owner. | Authority 5.1 and 5.3; Interface 3.1 and 4.1 | `GOV-004`, `GOV-005` | `GOV_AUTHORITY_CORE`, `GOV_WRITE_ENFORCEMENT` |
| `GOV-AC-005` | A DAG delegate has no implicit goal authority. | Requirements 12.3; Authority 3.4 and 5.1 | `GOV-003` | `GOV_AUTHORITY_CORE`, `GOV_ACCEPTANCE` |
| `GOV-AC-006` | Owner and delegate changes use only pre-change authority and cannot self-authorize atomically. | Source 9; Authority 3.2 and 5.4; Interface `GOV-IF-006` | `GOV-010` | `GOV_SOURCE_MODEL`, `GOV_AUTHORITY_CORE`, `GOV_ACCEPTANCE` |
| `GOV-AC-007` | Governed batch members cannot bypass one operation-level decision. | Authority 4.5; Interface 3.2 and `GOV-IF-007` | `GOV-008`, `GOV-009`, `GOV-010` | `GOV_CLI_PREVIEW`, `GOV_WRITE_ENFORCEMENT` |
| `GOV-AC-008` | Ordinary maintenance retains its current behavior. | Requirements 12.3; Authority 4.4; Interface `GOV-IF-008` and `GOV-IF-013` | `GOV-012`, `GOV-013`, `GOV-SRC-006` | `GOV_AUTHORITY_CORE`, `GOV_ACCEPTANCE` |
| `GOV-AC-009` | Help, JSON help, editing guidance, README, generated headers, and normative examples describe one boundary. | Source 8; Interface 10 and `GOV-IF-011`, `GOV-IF-014`, and `GOV-IF-015` | `GOV-014`, `GOV-015`, `GOV-SRC-002` | `GOV_SOURCE_MODEL`, `GOV_CLI_PREVIEW`, `GOV_GUIDANCE` |
| `GOV-AC-010` | Focused Core, CLI, batch, safe-write, and installed tests cover the complete accepted behavior. | Requirements 12.3; Source 11; Authority 11; Interface 12 | `GOV-SRC-001` through `GOV-SRC-006`; `GOV-001` through `GOV-015` | Every implementation gate, then `GOV_ACCEPTANCE` |

## 6. Interface acceptance trace

| ID | Normative evidence | Example and implementation gate | Decision |
| --- | --- | --- | --- |
| `GOV-IF-001` | Interface 3.1 and 3.2 | `GOV-002`; `GOV_AUTHORITY_CORE`, `GOV_CLI_PREVIEW` | Accepted |
| `GOV-IF-002` | Interface 3.1 and 5.1 | `GOV-008`, `GOV-009`; `GOV_CLI_PREVIEW` | Accepted |
| `GOV-IF-003` | Interface 3.1, 5.1, and 8.2 | `GOV-014`, `GOV-SRC-004`; `GOV_CLI_PREVIEW` | Accepted |
| `GOV-IF-004` | Authority 5.2; Interface 4.2 and 6.3 | `GOV-002`; `GOV_AUTHORITY_CORE`, `GOV_CLI_PREVIEW` | Accepted |
| `GOV-IF-005` | Authority 5.3 and 7; Interface 6.3 and 8.1 | `GOV-004`, `GOV-006`, `GOV-007`; `GOV_WRITE_ENFORCEMENT` | Accepted |
| `GOV-IF-006` | Source 9; Authority 3.2 and 5.4 | `GOV-003`, `GOV-005`, `GOV-010`; `GOV_SOURCE_MODEL`, `GOV_AUTHORITY_CORE` | Accepted |
| `GOV-IF-007` | Authority 4.5; Interface 3.2 | `GOV-008` through `GOV-010`; `GOV_CLI_PREVIEW`, `GOV_WRITE_ENFORCEMENT` | Accepted |
| `GOV-IF-008` | Authority 4.4; Interface 4.1 | `GOV-012`; `GOV_AUTHORITY_CORE`, `GOV_ACCEPTANCE` | Accepted |
| `GOV-IF-009` | Source 5 and 6; Interface 6.2 | `GOV-SRC-001`, `GOV-SRC-003`, `GOV-001`; `GOV_SOURCE_MODEL` | Accepted |
| `GOV-IF-010` | Source 7 and 8; Interface 3.3 and 5.2 | `GOV-SRC-002`, `GOV-SRC-003`, `GOV-SRC-005`; `GOV_SOURCE_MODEL`, `GOV_CLI_PREVIEW` | Accepted |
| `GOV-IF-011` | Interface 10 | `GOV-014`, `GOV-015`; `GOV_CLI_PREVIEW`, `GOV_GUIDANCE` | Accepted |
| `GOV-IF-012` | Authority 6; Interface 8.3 and 9 | `GOV-011`; `GOV_WRITE_ENFORCEMENT` | Accepted |
| `GOV-IF-013` | Authority 4.1 and 4.4; Source 10 | `GOV-012`, `GOV-013`, `GOV-SRC-006`; `GOV_AUTHORITY_CORE`, `GOV_ACCEPTANCE` | Accepted |
| `GOV-IF-014` | Source 6; Interface 11 | `GOV-014`, `GOV-SRC-005`; atomic implementation, then `GOV_ACCEPTANCE` | Accepted |
| `GOV-IF-015` | Source 8; Authority 9; Interface 10 | `GOV-015`, `GOV-SRC-002`; `GOV_GUIDANCE`, `GOV_ACCEPTANCE` | Accepted |

## 7. Explicit non-goal and separation trace

| ID | Separate concern | Accepted boundary |
| --- | --- | --- |
| `GOV-NG-001` | Authentication and identity verification | `PrincipalId`, actor, delegate, and owner-confirmation values remain caller assertions. No OS, Git, network, or identity-provider lookup is introduced. |
| `GOV-NG-002` | Signatures, RBAC, approval systems, and durable owner-confirmation ledgers | They remain outside Issue #4. The mutation result reports assertions for the current operation but is not an audit ledger. |
| `GOV-NG-003` | Malicious assertion forgery | The protected threat is accidental authority overreach by a non-malicious executor, not a hostile caller. |
| `GOV-NG-004` | Prevention of direct source editing | The product provides exact guidance and a generated warning; it does not make `.pert` bytes technically uneditable. |
| `GOV-NG-005` | Recommendation ranking and scheduling | Owners and delegates are not ranking facts, dependencies, or resources. Normal `Perttool.NextResult.v4` authority is unchanged. |
| `GOV-NG-006` | Existing validation and write safeguards | Governance composes after candidate validation and before persistence. It never weakens parsing, semantic checks, expected-digest locking, symlink/race rejection, atomic writes, or post-write analysis. |
| `GOV-NG-007` | MIG-08 recommendation override apply and audit | Recommendation override authority, durable audit, and override apply remain unavailable and independently gated. They cannot authorize project-model changes. |
| `GOV-NG-008` | Git integration and history policy | The evaluator performs no Git operation. Existing Git-history guidance is retained; Git-integrated audit/apply remains separate. |
| `GOV-NG-009` | Release publication | Grammar 4 and Contract 5 activation require local installed acceptance first. Tagging, GitHub Release, npm publication, and dist-tag changes require a separate authorized release workstream. |

## 8. Implementation handoff

The remaining plan must retain these gates and ownership boundaries.

1. `GOV_SOURCE_MODEL` implements target Grammar 4 parsing, CST/model,
   declared/effective metadata, formatting, project init/show/set, batch
   fields, target public types, and the generated warning. It may build target
   capability internally but cannot expose a partial public Contract 5
   cutover.
2. `GOV_AUTHORITY_CORE` implements one pure, deterministic classifier and
   evaluator over the pre-change snapshot and accepted candidate. It performs
   no filesystem, Git, authentication, network, or clock operation.
3. The source and authority gates join at `IMPLEMENTATION_INPUT_READY`.
   `GOV_CLI_PREVIEW` then connects the accepted operation-level assertion
   shape, results, registry, help, diagnostics, and preview behavior.
4. `GOV_WRITE_ENFORCEMENT` applies the same decision to direct mutation,
   atomic batch, advance, and existing-document replacement. Candidate
   validation and all safe-write safeguards remain independently mandatory.
5. `GOV_GUIDANCE` aligns `guide editing`, README, process guidance, and the
   generated warning without claiming authentication or direct-edit
   prevention.
6. `GOV_ACCEPTANCE` alone accepts the complete source, Core, CLI, batch,
   safe-write, help, Guide, documentation, self-use, linked-package, packed
   package, and installed-package behavior.
7. Publication remains outside this plan and requires a separately authorized
   release workstream after local acceptance.

`GOV_SOURCE_MODEL` and `GOV_AUTHORITY_CORE` are the two implementation inputs
immediately downstream of this acceptance. `GOV_GUIDANCE` is also
precedence-ready, but the normal complete `Perttool.NextResult.v4`
recommendation must choose actual starts after this task is completed and
advanced; this review does not pre-authorize a later resource combination.

## 9. Verification

This acceptance requires:

- exact checks for all 10 `GOV-AC-*` rows, all 15 `GOV-IF-*` rows, all 9
  `GOV-NG-*` rows, and all four resolved findings;
- contiguous source and authority/write example IDs, with every case cited by
  this review;
- identity alignment across source, authority, interface, requirements, and
  basic design;
- explicit runtime, authentication, recommendation, MIG-08, Git, and release
  boundaries;
- documentation, link, and all self-use-plan checks;
- the full repository gate; and
- review of the intended diff before recording plan completion.

Implementation gates must replace structural target-contract checks with
complete Core, parser, formatter, mutation, CLI, batch, safe-write, text/JSON,
help, Guide, and isolated installed-package tests without changing the
accepted meanings.

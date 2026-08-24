# Planning Pool Contract Acceptance Record

- Document status: Accepted 1.0
- Date: 2026-08-24
- Workstream: `PLAN-POOL-001`
- Completed task: `PLANNING_POOL_CONTRACT`
- Runtime status: not implemented
- Decision owner: user
- Initial plan commit: `55e74db`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Machine cases: [`planning-pool-contract-v1.json`](../../test/fixtures/planning-pool-contract-v1.json)
- Selected plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)

## 1. Decision

Accept one single-document Grammar 9 and CLI Contract 10 target for the three
Issue #12 use cases: incomplete canonical-DAG draft planning, progressive
project-owned Event and Activity AoA refinement with same-identity projection,
and Scrum-like or other bounded Work selection without execution authority.

This contract closes the remaining ADR 0008 source, identity, request,
preflight, token, projection, deferral, Window, observation, history,
diagnostic, limit, migration, and compatibility details. It does not activate
the reserved runtime or broaden the separate Issue #3 composition boundary.

There are no open normative contract findings. Runtime behavior remains absent
until the dependency-ordered source, reshape, projection, Window, observation,
history, public-contract, and final acceptance tasks implement and verify it.

## 2. Evidence chain

### C-POOL-CONTRACT-001 `high`, accepted

Claim: the selected contract preserves one strict execution owner while making
incomplete Work and Window operation representable in the same current `.pert`.

Evidence:

- `E-POOL-CONTRACT-001`: accepted ADR 0008 fixes Work residual intent,
  project-owned Event and Activity, planning-only dependency, total order,
  reshape, guided token preflight, projection, Window, observation, and Git
  history boundaries.
- `E-POOL-CONTRACT-002`: `PPC-001` through `PPC-040` form one contiguous
  dependency-ordered machine matrix and both `PPRH` vectors reproduce their
  exact SHA-256 values.
- `E-POOL-CONTRACT-003`: the focused contract gate verifies the specification,
  cross-document references, fixture closure, current public counts, and
  absence of reserved Work or Window runtime.

Action:

- `A-POOL-CONTRACT-001`, implementation permitted, executed: record the
  normative contract, fixture, focused test, acceptance trace, self-use
  registration, and exact PERT status-only completion candidate.

### C-POOL-CONTRACT-002 `high`, accepted

Claim: source implementation must begin privately and cannot yet advertise
Grammar 9 or CLI Contract 10.

Evidence:

- `E-POOL-CONTRACT-004`: direct inspection measured current package `0.10.5`,
  Grammar 8, CLI Contract 9, 56 commands, 23 active root schemas, 129 root and
  Node exports, and 45 Core exports.
- `E-POOL-CONTRACT-005`: the current command catalog contains no `work` or
  `window` route and the schema catalog contains no Planning Pool result.
- `E-POOL-CONTRACT-006`: the selected plan places
  `PLANNING_POOL_SOURCE_CORE` immediately after this contract task and keeps
  public activation after history composition.

Action:

- `A-POOL-CONTRACT-002`, implementation permitted, pending: implement only the
  private source and semantic Core after the completed task receives its
  separately accepted plan-assurance outcome.

## 3. Accepted artifact identity

| Artifact | SHA-256 before this record |
| --- | --- |
| `docs/specs/planning-pool.md` | `3be5034d3e89c632f3795c47bdbc6b93040700b890eaf0e27896c2693d7d6962` |
| `test/fixtures/planning-pool-contract-v1.json` | `081332e1c6372f87cb3a3fa237ec40383ff59b1f752f26a0cc0d72169edc7e76` |
| `test/planning-pool-contract.test.mjs` | `fe9f343dfda33d26e50a41fff55aa0d7d5853091b1ede159fbfc2b301f56c4b1` |
| `plans/planning-pool.pert` after status-only completion | `8ad2c301bb257636f7938ede6f46e936628298c3bf8a96f0c7542ce44caa340b` |

Requirements, basic design, backlog, active grammar pointer, plan index,
self-use policy, and focused tests link those exact semantic artifacts. The
acceptance record is intentionally not part of its own pre-record digest set.

## 4. Contract closure

### Source and identity

- Grammar 9 inherits Grammar 8 and adds only `work`, `event`, `activity`,
  `window`, and singleton `work_order` declarations.
- The project ID is the effective root namespace; source remains unqualified
  and reserves `::` for Issue #3.
- All current Work appear once in one explicit project-wide order.
- Titles are mutable, non-unique display text; stable IDs remain machine
  identity and retired tracked identity cannot silently acquire new meaning.

### Ownership and mutation

- Event and Activity are project-owned Temporary Draft AoA primitives with
  many-to-many Work associations and no execution authority.
- Reshape is one complete typed origin-to-destination inventory over residual
  text and typed entity/reference dispositions.
- Preflight normalizes and hashes the complete request, returns actual before
  and after evidence, and issues one 256-bit-or-stronger opaque token with a
  fixed 3,600-second lifetime.
- Apply reproduces the exact candidate and consumes the token recoverably once;
  it adds no LLM self-review record and does not treat OS identity or the token
  as owner approval.
- `Add residual description`, `--add-residual-description`, and
  `add_residual_description` are fixed, while mechanical prose assistance is
  limited to the unchanged-value and byte-identical no-op warnings.

### Projection, evidence, and history

- Projection globally moves same-identity Event or Activity meaning once to
  Milestone or Task and changes every association into a link atomically.
- Shared Task execution and actuals and shared Milestone reach and acceptance
  remain indivisible strict-owner facts; details may repeat the authoritative
  fact, but unique aggregates count fully qualified identities once and expose
  non-exclusive contribution.
- Independent accounting requires a semantic split before execution or
  acceptance evidence exists; no retroactive split, copy, or allocation is
  available.
- Temporary Draft ranges need no Git recoverability proof. Work, order,
  dependency, link, Window, membership, and objective ranges do.
- Advance prunes removed-target links and archives newly eligible Work only
  under explicit `--archive-empty-work`; `AdvanceResult.v4` owns the new
  cleanup projection.
- Narrow deferral returns only closed, linked, unstarted, evidence-free strict
  fragments and leaves Window state independent.

### Windows and observation

- Persisted Window presence means active; an ad hoc Window is request-only.
- Membership is many-to-many and has no primary Window or dependency-driven
  auto-selection.
- Optional comparable bounds form a half-open or one-sided interval and never
  read the wall clock or trigger lifecycle changes.
- The required persisted objective is exact temporary outcome-oriented
  rationale without achieved state.
- Close explicitly contracts the Window and optionally carries named Work to
  an existing or fully declared next active Window; source retains no closed
  Window or close report.
- Refinement, execution, outcome, organization, temporal, archiveability, and
  close disposition remain independent facts. Work has no completion state.
- Current source owns current facts; bounded immutable first-parent Git
  evidence may reconstruct removed lineage and returns gaps or races as
  unknown or unavailable rather than inference.

### Public target and compatibility

- Eleven reserved command paths move the future catalog from 56 to 67.
- `PlanningPoolResult.v1`, `PlanningReshapePreflightResult.v1`, and
  `PlanningMutationResult.v1` add three root schemas; replacement
  `AdvanceResult.v4` and `UnitMigrationResult.v5` move the future active catalog
  from 23 to 26.
- Governance retains only `goal` and `dag`; planning-only mutations are
  ordinary maintenance and strict topology changes retain current `dag`
  classification.
- Explicit Grammar 8 to 9 migration creates no planning meaning. Strict DAG,
  actual, velocity, milestone acceptance, assurance, history, render, editor,
  and MCP meanings remain unchanged.

## 5. Case trace

| Cases | Accepted boundary |
| --- | --- |
| `PPC-001` through `PPC-005` | incomplete Work, AoA refinement, logical identity, display title, retired identity |
| `PPC-006` through `PPC-010` | total Work order, insertion and merge, dependencies, cycles, disposition |
| `PPC-011` through `PPC-020` | split, merge, creation, discard, coverage, normalization, preflight, token, rebinding, consumption, user response |
| `PPC-021` through `PPC-027` | Event and Activity projection, shared global impact, residual warning, Temporary Draft, canonical history, advance cleanup |
| `PPC-028` through `PPC-032` | shared Task and Milestone attribution, evidence-bearing split prohibition, deferral and rejection |
| `PPC-033` through `PPC-038` | Window overlap, timebox, objective, close, observation axes, bounded history |
| `PPC-039` through `PPC-040` | migration, compatibility, public target, and current-runtime non-activation |

## 6. Verification

The accepted gate is:

| Gate | Result |
| --- | --- |
| TypeScript and private-adapter build | passed under the current Node.js runtime |
| duplicate and complexity ratchets | passed at 146 clones, 3.048 percent, and 4,090 functions with 168 legacy entries |
| complete repository test suite | passed with the Linux temporary directory required for Unix mode assertions |
| focused planning-pool contract test | passed all five tests |
| normalized SHA-256 vectors | passed both exact byte and digest checks |
| read-only self-use | passed 45 plans through check, analyze, and next |
| English baseline | passed 1,192 text files with 3 allowlisted lines |
| documentation | passed 347 Markdown files and 7 normative PERT examples |
| isolated adapter packages | passed LSP, MCP, and supported VS Code 1.101.0 VSIX gates |
| consumer and public package | passed npm-link, dry-run publication, and isolated installed-package gates |
| whitespace | `git diff --check` passed |

The focused non-activation readback retained package `0.10.5`, 56 commands,
23 root schemas, 129 root exports, 129 Node exports, and 45 Core exports. No
Work or Window command, result schema, or export became active.

## 7. PERT handoff and remaining gate

The exact status-only mutation changed the plan digest from
`sha256:0fc989f34f25c81eef038304ad7ab1c565f104dfa6624790aa084eb7181029c3`
to
`sha256:8ad2c301bb257636f7938ede6f46e936628298c3bf8a96f0c7542ce44caa340b`.
Readback passes document check, analysis, and Next. It structurally reaches
`PLANNING_POOL_CONTRACT_ACCEPTED` and recommends only
`PLANNING_POOL_SOURCE_CORE`.

The completed contract task intentionally has no task-outcome record yet.
Complete plan assurance therefore reports `outcome_missing`, makes the source
Core assurance-unavailable, and requires a separately reviewed exact
conformant outcome before implementation starts. No owner assertion was
invented or reused. Canonical plan advance also remains separate.

No release selection, Git remote write, GitHub Issue mutation, npm operation,
editor or MCP mutation, or plan advance occurred.

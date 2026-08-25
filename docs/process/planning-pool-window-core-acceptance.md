# Planning Pool Window Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-25
- Accepted candidate parent: `47560697b3915ad3026266bc3244898312225a29`
- Plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Plan task: `PLANNING_POOL_WINDOW_CORE`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Private capability: `perttool.planning-window-core@1`
- Active public runtime: unchanged package `0.10.5`, Grammar 8, and CLI Contract 9

## 1. Decision

Accept the private portable Planning Pool Window Core. It constructs complete
persisted Windows, updates them, inspects persisted and request-only ad hoc
selections, and contracts one explicitly closed Window without introducing a
Window lifecycle state. Presence remains the complete active-state model.

Persisted Windows require a non-empty outcome-oriented objective and at least
one Work. Selection follows the global Work order and reports membership,
dependency coverage, and half-open temporal overlap as advisory facts. Work
dependencies remain independent from strict DAG authority, and Window bounds
remain independent from wall-clock triggers or Task scheduling.

Close always discards the Window-owned objective, carries only explicitly
selected Work to an existing or completely defined new Window, reports
already-selected pairs without duplication, and removes the source Window in
the same candidate. A composite Work reshape may perform the same close only
through `intent: "composite"`, its normalized preflight hash, and its opaque
one-time token. Simple Window close never copies meaning to Work, Event,
Activity, Milestone, or Task.

Public Grammar 9 and CLI Contract 10 activation, governed persistence, Git
history proof, observation, historical reconstruction, release, remote
writes, Issue mutation, and plan advance remain separate.

## 2. Evidence chain

### C-POOL-WINDOW-001 `high`, accepted

Claim: a Window is active exactly while its declaration exists; add, set,
selection, and close organize Work without becoming a second owner of Work or
strict-DAG meaning.

Evidence:

- `E-POOL-WINDOW-001`: `PPWC-002` and `PPWC-003` add and replace complete
  persisted declarations while retaining one active-state representation.
- `E-POOL-WINDOW-002`: `PPWC-004` through `PPWC-008` filter the global Work
  order, retain many-to-many membership, report uncovered Work dependencies,
  support a non-persisted empty ad hoc selection, and evaluate comparable
  half-open bounds without consulting a clock.
- `E-POOL-WINDOW-003`: `PPWC-009` through `PPWC-012` remove the complete
  source Window, discard its objective, transfer only explicit memberships,
  preserve every unrelated Work, Window, and strict declaration, and compose
  one close with an audited Work meaning movement.
- `E-POOL-WINDOW-004`: `PPWC-013` rejects empty objectives, invalid or mixed
  bounds, unknown or implicit Work carry-over, missing targets, and attempts
  to preserve the closed objective implicitly.
- `E-POOL-WINDOW-005`: `PPWC-014` and `PPWC-015` bind the source and candidate
  digests, classify exact canonical Window ranges for later Git proof, and
  classify standalone Window change as ordinary maintenance with no DAG owner
  assertion.
- `E-POOL-WINDOW-006`: `PPWC-016` retains the exact public package, Grammar,
  CLI, command, schema, and facade identities.

Action:

- `A-POOL-WINDOW-001`, implementation permitted, executed: add the private
  typed add, set, close, persisted-selection, and ad hoc-selection Core; exact
  selection facts; explicit carry-over; source-bound close report; canonical
  destructive-range classification; and complete Grammar 9 candidate
  validation.
- `A-POOL-WINDOW-002`, implementation permitted, executed: decompose Window
  normalization, close planning, membership mutation, and candidate rendering
  into bounded helpers so the accepted duplicate and complexity ratchets
  remain unchanged.

## 3. Accepted Window model

`Perttool.WindowMutationRequest.v1` is closed and source-digest bound. Add and
set require the complete final title, objective, optional bounds, and non-empty
Work set. Close requires `objective_disposition: "discard"`, one explicit
carry-over set, and a target exactly when that set is non-empty. A new target
states its complete title, objective, and optional bounds.

Persisted and ad hoc selection return one immutable snapshot, global-order
Work IDs, advisory dependency coverage, shared memberships with every other
Window, and pairwise temporal overlap. Date and fixed-offset date-time bounds
are individually comparable but not comparable with each other. Adjacent
half-open intervals are disjoint. One-sided and unbounded intervals do not
invent a current time.

Standalone close emits one source-bound report, complete candidate, exact
candidate digest, and destructive ranges. Carry-over adds only missing pairs
and labels every requested pair as `selected` or `already_selected`. The report
is not persisted; Git remains the owner of former canonical state.

The existing reshape request now accepts a non-null `window_close` only for a
composite request with an audited affected Work set. Normalization preserves
its meaning-bearing values in the preflight hash. Candidate reconstruction
applies membership dispositions first, verifies carry-over against that exact
intermediate selection, then removes the source Window and updates or creates
the target in the same token-bound candidate. The reshape result returns the
same close-report identity.

## 4. Accepted cases

The dependency-ordered matrix is
[`planning-pool-window-core-v1.json`](../../test/fixtures/planning-pool-window-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `PPWC-001`–`PPWC-003` | private closed identity and complete persisted add/set |
| `PPWC-004`–`PPWC-008` | order, dependency coverage, many-to-many membership, ad hoc selection, and temporal overlap |
| `PPWC-009`–`PPWC-012` | explicit contraction, existing/new carry-over, isolation, and token-bound composite close |
| `PPWC-013`–`PPWC-016` | fail-closed inputs, source/candidate binding, canonical range ownership, ordinary authority, and unchanged public runtime |

The fixture SHA-256 is
`accabd033c524a5a6e22565fee964b4706c7861484b167b1cbb06701e3870020`.
The focused test SHA-256 is
`97756c7d6b78e8b7df7512851f361764af39705daae63c6c2576949494f3553f`.
The duplicate and complexity baselines were not changed.

## 5. Verification

The accepted candidate passed:

- all seven focused `PPWC-001` through `PPWC-016` test groups;
- the Window, reshape, projection, source, contract, and Core-dependency
  focused gate, 51 tests in total;
- the complete 1,278-test repository regression gate;
- TypeScript checks for the package, LSP, VSIX, and MCP workspaces;
- pinned jscpd 5.0.15 at 2.862% duplicate lines and Lizard 1.23.0 with no new
  complexity violation or baseline change;
- English-baseline checks over 1,218 text files and documentation checks over
  351 Markdown files and seven PERT examples;
- read-only self-use checks over 45 plans;
- isolated LSP, MCP, VSIX, temporary-link, and public-package workflows; and
- one 933-file, 3.2 MB package dry run plus isolated Contract 9 and plan-
  assurance installation checks.

## 6. Deferred boundaries

This acceptance does not activate a public Window command, result, schema, or
adapter surface. It does not implement governance execution, canonical Git
proof, race-safe persistence, Work or Window observation, historical
reconstruction, editor or MCP mutation, public Grammar 9 or Contract 10,
release selection, publication, remote writes, Issue mutation, or plan
advance.

The implementation task may be marked complete in its exact pre-advance plan.
Its conformant outcome, reached-milestone criterion and receipt, and canonical
advance each remain separately governed operations.

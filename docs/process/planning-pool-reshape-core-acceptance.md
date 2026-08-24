# Planning Pool Reshape Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-24
- Accepted candidate parent: `306b353b28d4dd397decd7124ef63236fbf73477`
- Plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Plan task: `PLANNING_POOL_RESHAPE_CORE`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Request identity: `Perttool.PlanningReshapeRequest.v1`
- Normalization identity: `perttool.planning-reshape-normalization@1`
- Active public runtime: unchanged package `0.10.5`, Grammar 8, and CLI Contract 9

## 1. Decision

Accept the private portable Planning Pool reshape Core. It normalizes and
mechanically audits one complete Work-boundary operation, reconstructs one
valid Grammar 9 candidate, and binds the exact source, request, candidate,
preflight hash, and tool-issued one-time token without activating the public
Grammar 9 or CLI Contract 10 surface.

The Core supports split, merge, partial movement, explicit creation and
discard, Work boundary creation and removal, complete typed reference
dispositions, exact Work order changes, residual-description acknowledgment,
and byte-identical assistance through one common request model. Projection,
deferral, archival, Window close meaning, retired-ID Git proof, governance
execution, history-safe persistence, public CLI and schema activation, editor
and MCP mutation, release selection, publication, remote writes, Issue
mutation, and plan advance remain separate.

## 2. Evidence chain

### C-POOL-RESHAPE-001 `high`, accepted

Claim: one closed operation model structurally conserves every directly
affected residual-description row and typed relationship without treating
natural-language equivalence as machine proof.

Evidence:

- `E-POOL-RESHAPE-001`: `PPRC-004` through `PPRC-009` exercise exact UTF-16
  partitions, split, merge, created and discarded rows, complete association,
  strict-link, dependency, and Window-membership dispositions, final candidate
  validation, no tombstone, and fail-closed incomplete coverage.
- `E-POOL-RESHAPE-002`: candidate descriptions are reconstructed only from
  ordered destination rows; the normalized request remains the explicit
  origin-to-destination and relationship evidence.
- `E-POOL-RESHAPE-003`: the Core emits only structural diagnostics and does
  not infer novelty, equivalence, completion, acceptance, or execution state.

Action:

- `A-POOL-RESHAPE-001`, implementation permitted, executed: add the private
  typed request, normalization, audit, candidate reconstruction, and complete
  disposition evaluators.

### C-POOL-RESHAPE-002 `high`, accepted

Claim: successful preflight and later apply preparation are bound to the same
exact meaning and bytes by an independently reproducible hash plus a
non-reproducible one-time navigation token.

Evidence:

- `E-POOL-RESHAPE-004`: `PPRC-002` and `PPRC-003` reproduce both accepted
  PPRH SHA-256 vectors, canonicalize object and set order, and retain semantic
  element and final-order distinctions.
- `E-POOL-RESHAPE-005`: `PPRC-010` through `PPRC-014` bind normalization
  identity, preflight hash, source digest, candidate digest, expiry, token
  state, request, and replay; any changed binding fails with `PTPOOL-111`.
- `E-POOL-RESHAPE-006`: the default token source uses portable Web Crypto
  `getRandomValues`; a test source may be injected. Every clear token carries
  256 random bits, while transient snapshots contain only its SHA-256 digest.
- `E-POOL-RESHAPE-007`: registry snapshots can be restored across a later
  process composition without storing the clear token. Capacity is 256,
  lifetime is 3,600 seconds, and expired entries are removed rather than
  evicting an unexpired record.
- `E-POOL-RESHAPE-008`: committing recovery returns exact old source to
  `unused`, exact candidate to `consumed`, and rejects a third digest; a bound
  no-op consumes once.

Action:

- `A-POOL-RESHAPE-002`, implementation permitted, executed: add portable
  SHA-256 normalization, opaque token issuance, digest-only transient state,
  snapshot restoration, exact apply rebinding, and recoverable consumption.

### C-POOL-RESHAPE-003 `high`, accepted

Claim: the Core makes the later user-response boundary conspicuous without
claiming OS-user authentication or recording LLM self-review.

Evidence:

- `E-POOL-RESHAPE-009`: a changed DAG-scope candidate reports exact required
  owner, candidate digest through the bound result, and
  `userResponseRequired: true`; an undeclared owner resolves to the existing
  governance default `user`.
- `E-POOL-RESHAPE-010`: no request, result, registry snapshot, source
  candidate, or public facade contains a self-review field or owner assertion.
- `E-POOL-RESHAPE-011`: `PTPOOL-112` is only bounded residual-description
  assistance, and `PTPOOL-117` is the only general byte-identical warning.
  Neither grants mutation authority or consumes a token before the commit
  boundary.

Action:

- `A-POOL-RESHAPE-003`, implementation permitted, executed: expose the exact
  authority-impact navigation fact while leaving existing governance,
  assurance, history, safe-write, and fresh candidate-bound assertion gates
  to their accepted owners.

### C-POOL-RESHAPE-004 `high`, accepted

Claim: the implementation remains private and portable and does not alter the
accepted public runtime.

Evidence:

- `E-POOL-RESHAPE-012`: Node built-in confinement passes; portable SHA-256
  and Web Crypto-compatible random input introduce no new Node import into the
  semantic Core.
- `E-POOL-RESHAPE-013`: root and Node remain exact 129-name facades, Core
  remains 45 names, and the active catalogs remain 56 commands and 23 root
  schemas under CLI Contract 9.
- `E-POOL-RESHAPE-014`: Grammar 1 through 8 public behavior, strict DAG,
  milestone acceptance, plan assurance, history, adapters, installed package,
  and safe persistence pass the complete existing regression gate.

Action:

- `A-POOL-RESHAPE-004`, implementation permitted, executed: keep all reshape
  modules outside root, Core, Node, CLI, schema, LSP, VSIX, and MCP facades and
  adjust only current private-source inventory and advanced-plan assertions.

## 3. Accepted operation model

The normalizer accepts only the closed versioned request. It checks the
8,388,608-byte input limit and collection limits before semantic row
expansion, rejects unknown fields and duplicate identities, preserves exact
parsed strings and semantic array order, sorts only contract-defined sets,
serializes canonical UTF-8 JSON, and computes the accepted SHA-256 hash.

Every affected existing description has one gap-free, non-overlapping UTF-16
partition with exact source text. Every semantic row has one existing or
asserted-created origin and one ordered Work or explicit discard destination.
The destination rows reconstruct each final description without inferred
separators. `Add residual description` acknowledges an intentional unchanged
residual value and suppresses only `PTPOOL-112`.

The same final candidate reconstructs all Work associations, strict projection
links, incident Work dependencies, active Window memberships, boundary
changes, and the complete changed Work order. Unaffected order bytes remain
source-preserved when no reorder is requested. Created Work anchors may refer
to another Work created in the same atomic request. The complete candidate is
reparsed through the private Grammar 9 source owner before it is returned.

## 4. Preflight and token lifecycle

Read-only preflight returns `Perttool.PlanningReshapePreflightResult.v1` with
the normalized request, before and after descriptions and element IDs, exact
source and candidate bytes and digests, preflight hash, diagnostics, authority
impact, expiry, and one clear token. The normalized request itself is the
complete mapping and typed-disposition evidence; no transfer statement or
tombstone is persisted.

Apply preparation re-runs normalization and the complete mechanical audit.
It accepts only the exact caller-supplied hash and matching unexpired `unused`
token binding. It returns `Perttool.PlanningMutationResult.v1` preparation but
does not perform governance, history proof, persistence, or a write. A later
composition moves the token to `committing` only after those independent gates
pass, then settles it from exact post-operation bytes.

Snapshots freeze token digest, binding, issued time, expiry, and state. They
permit a later private storage adapter to span CLI processes without exposing
the clear token. They are not authentication, owner approval, signing, or an
adversarial security boundary.

## 5. Accepted cases

The dependency-ordered matrix is
[`planning-pool-reshape-core-v1.json`](../../test/fixtures/planning-pool-reshape-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `PPRC-001`–`PPRC-003` | private identity, closed limits, fixed hashes, and representation-versus-meaning order |
| `PPRC-004`–`PPRC-009` | split, merge, creation, discard, description coverage, and all typed reference dispositions |
| `PPRC-010`–`PPRC-014` | explanatory preflight, opaque token, exact rebinding, recovery, consumption, and no-op |
| `PPRC-015`–`PPRC-016` | residual-description assistance, user-response navigation, no self-review, and unchanged public runtime |

The fixture SHA-256 is
`4e01d772c558079f4c452ab79c9881a0e865f41ef68849a0ebaad7a38f0b8fd3`.
The focused test SHA-256 is
`8f33cfa2d61ccd61ba4f815183cec0879af23480cd57588f29c43aa8e0edd9d2`.
The duplicate and complexity baselines were not changed.

## 6. Verification

The accepted candidate passed:

- all twelve focused `PPRC-001` through `PPRC-016` test groups;
- both exact PPRH canonical UTF-8 and SHA-256 vectors;
- the complete 1,263-test repository regression gate;
- TypeScript checks for the package, LSP, VSIX, and MCP workspaces;
- pinned jscpd 5.0.15 and Lizard 1.23.0 ratchets without a baseline change;
- English-baseline, documentation-link, and self-use checks;
- isolated LSP, MCP, VSIX, temporary-link, and public-package workflows; and
- exact unchanged public counts: package `0.10.5`, Grammar 8, CLI Contract 9,
  56 commands, 23 root schemas, 129 root exports, 129 Node exports, and 45
  Core exports.

## 7. Deferred boundaries

This acceptance does not authorize or implement projection, deferral,
archiveability, retired-ID history proof, Window add/set/close, observation,
historical reconstruction, public Grammar 9 or Contract 10 activation,
governed persistent reshape execution, editor or MCP mutation, release
selection, publication, remote writes, Issue mutation, or plan advance.

The completed task remains in its exact pre-advance state until its separately
governed outcome and reached-milestone evidence are accepted. The active public
package remains unchanged.

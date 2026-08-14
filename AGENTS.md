# Repository Guidelines

## Scope and communication

These instructions apply to the entire repository. English is the canonical language for tracked repository artifacts. New or substantively modified requirements, specifications, design text, process guidance, plan metadata, source comments, bundled help, and diagnostics use English. Japanese-script content in tracked artifacts is permitted only through the exact versioned allowlist; do not translate user-authored content or intentional Unicode fixtures opportunistically.

User communication is independent from the repository baseline. Unless the user requests otherwise, respond to the user in Japanese. Preserve user-authored `.pert` content and intentional Unicode fixtures. Do not add runtime i18n, locale negotiation, translation catalogs, or a `--locale` option without a new requirement and architecture decision.

- Distinguish directly verified facts, inferences, and unverified matters.
- Verify the current checkout, normative documents, and command results before making a judgment.
- Do not infer or invent commands, files, package scripts, or operational rules that do not exist.
- Do not substitute user-provided terms or completion criteria with a different meaning merely because it is easier to implement.

## Current phase and sources of truth

perttool has accepted its TypeScript CLI MVP and the read-only AI Agent
Guidance Registry v1 from Issue #2 and has durably accepted suffix-free beta
releases through `v0.9.0`.
Version `0.6.0` retains Grammar 5 and CLI Contract 6 while adding repository
history protection, `Perttool.AdvanceResult.v1`, and the narrow
`--force-history-loss` boundary to `dag advance`. Version `0.5.5` retains
Grammar 5 and CLI Contract 6 while adding non-blocking `PTGOV-104` when an
applicable preview already carries an owner assertion. Version `0.5.4` remains
the PTGOV-103, beta-channel, and scope-guidance artifact, and `0.5.2` remains
the complete nested-schema and full/outline/detail schema-view artifact. The obsolete npm
`alpha` dist-tag is retired, while historical `0.1.0-alpha.2` remains
available by exact pin. Version `0.5.1` remains the initial schema-discovery
Contract 6 artifact, `0.5.0` remains the pre-schema Contract 6 artifact,
`0.4.0` remains the Contract 5 compatibility artifact, and `0.3.0` and
`0.2.0` remain the prior Contract 4 and Contract 3 artifacts, all available by
explicit pin. npm reports `beta=0.9.1`, `latest=0.9.0`, and no `alpha`. Version `0.9.0`
is the Grammar 7 and CLI Contract 8 milestone-acceptance beta; `0.8.1` is its
compatible Grammar 6 and CLI Contract 7 rollback pin. Version `0.9.1` is the
durably accepted compatible Contract 8 current-velocity observation patch;
npm `latest` and plan advance remain separate boundaries. The
durably accepted beta `0.7.0` source implements Grammar 1/2/3/4/5/6 reads,
registry-driven Contract 7 `help`, separate Contract 7 `guide`, temporal and
governed project/task/gate/milestone/resource maintenance, exact lifecycle
events, read-only project history and velocity observation, exact
`project migrate-unit`, `Perttool.ProjectResult.v4`,
`Perttool.MutationResult.v4` with `Perttool.GovernanceDecision.v2`,
`Perttool.AdvanceResult.v2` with history-safety and assurance guards,
`Perttool.AnalysisResult.v5`, `Perttool.NextResult.v6`,
`Perttool.UnitMigrationResult.v3`, read-only `validateOverride`,
source-preserving mutation, and authorization-before-safe-write controls. It
bundles complete artifacts for all nineteen active command-result identities
plus public library-only `Perttool.OverrideDecision.v1`, exposes the additive
read-only `schema` command and public catalog APIs, accepts Git 2.54 strict ISO
UTC `Z` commit metadata, rejects retired alpha publication, and projects
human-readable scope-bound owner-confirmation guidance. Version `0.5.5` emits
PTGOV-104 without changing its candidate, decision, default success, or
persistent authority. Issue #5 closure remains a separate decision. A
complete and known `Perttool.NextResult.v7` with complete temporal and
plan-assurance start authority plus milestone-acceptance projection is the
normal AI task-selection
authority. The macro plan is complete and has no ready task. The independent
English-baseline detail plan has completed and advanced all nine tasks through
`ENGLISH_ACCEPTANCE`; Git commit `2001cdf` records the exact completed
final-task pre-advance snapshot, `docs/process/english-baseline-acceptance.md`
records the cross-surface trace, and complete NextResult v5 has no ready,
recommended, or startable task.

The explicitly selected `ADV-001` workstream is tracked independently in
`plans/advance-history-safety.pert`. `ADV_HISTORY_CONTRACT` is complete; Git
commit `2c08618` records its exact pre-advance snapshot, and the task is
advanced to reached `ADV_HISTORY_CONTRACT_ACCEPTED`. The
accepted `docs/specs/advance-history-safety.md` fixes history-safety model 1:
entity/field-owned destructive records, exact raw-byte `HEAD` and stage-0
index proof, retained-dirty behavior, linked-worktree and complete
repository-baseline race boundaries,
the narrow `--force-history-loss` target, `Perttool.AdvanceResult.v1`,
`PTADV-101` through `PTADV-103`, human-readable modification time, byte-size
and diff context, and eighteen machine-readable acceptance cases. Its
acceptance record is
`docs/process/advance-history-contract-acceptance.md`. The pinned `0.5.5`
artifact remains unchanged and does not include ADV-001. `ADV_HISTORY_PROBE` is
complete and advanced; Git commit `4265621`
records its exact completed 4p pre-advance snapshot. Its accepted internal
read-only `HEAD`/stage-0-index capture and pure destructive-range assessment
pass the complete repository gate. `ADV_HISTORY_CLI` is complete and advanced.
The current source exposes the
narrow `--force-history-loss` option, `Perttool.AdvanceResult.v1`, the
complete nineteenth root schema, human-readable guard facts, `PTADV-101`
through `PTADV-103`, and repository/path/`HEAD`/stage-0-index enforcement
before the existing safe write. Preview, separate output, no-op, authority
denial, and prior warning denial do not inspect Git. Retained dirty ranges are
allowed, destructive overlap and unavailable proof block, and a captured
source, `HEAD`, or index race returns exit 5 without writing. Its acceptance
record is `docs/process/advance-history-cli-acceptance.md`. Git commit
`805bdd9` records its exact completed pre-advance snapshot, and commit
`5986cab` advances the plan to reached `ADV_HISTORY_CLI_READY`.
`ADV_HISTORY_ACCEPTANCE` is complete; commit `aa401e4` records its exact
final-task pre-advance snapshot, and commit `7b07bb8` advances the plan to
reached `ADV_HISTORY_ACCEPTED`. Its accepted eighteen-case repository, real
CLI race, linked-worktree, BOM/CRLF, help, Guide, schema, temporary-link,
package-root, and isolated installed trace is recorded in
`docs/process/advance-history-acceptance.md`. All four tasks and 14p are
complete and advanced; precedence and heuristic resource makespans are zero,
and complete NextResult v5 has no ready, recommended, or startable task.
The pinned `0.5.5` artifact remains unchanged. Release selection, GitHub Issue mutation,
npm publication, and dist-tag movement remain separate boundaries.

The explicitly selected `ADV-002` correction is tracked independently in
`plans/advance-clean-candidate.pert`. All three tasks through
`ADV_CLEAN_CANDIDATE_ACCEPTANCE` are complete and retained in their exact
pre-advance state. The accepted target
defines a maximal terminal removed-declaration suffix, narrow
advance-owned blank-line separator prefixes, identical edit and destructive
record ranges, exact `HEAD` and stage-0 proof over those prefixes, and one
byte-identical preview, separate output, and in-place candidate. The
eight-case matrix is
`test/fixtures/advance-clean-candidate-contract-v1.json`, and the acceptance
record is
`docs/process/advance-clean-candidate-contract-acceptance.md`. The shared
planner now gives the candidate and destructive records identical terminal
deletion ranges, removes the observed eventful-advance trailing blank line,
and maps the exact current prefix into `HEAD`; its bounded evidence is
`docs/process/advance-clean-candidate-core-acceptance.md`. Real tracked CLI,
preview/output/write identity, `git diff --check`, temporary link, installed
package, and the corrected ADV-001 trace are accepted in
`docs/process/advance-clean-candidate-acceptance.md`. The plan has zero
precedence and heuristic resource makespans, and complete NextResult v5 has no
ready, recommended, or startable task. Do not globally trim the document or
invoke the formatter from advance. Plan advance, release selection, remote
writes, publication, and dist-tag movement remain separate boundaries.

The explicitly authorized `0.6.0` advance-history-safety beta minor is
tracked independently in `plans/release-0.6.0.pert`. The user confirmed the
exact 5,289-byte initial release-plan candidate affecting goal and DAG scopes;
it was written once with actor `codex` and the scope-bound owner assertion
`user`. `RELEASE_060_SELF_REVIEW` is complete after a direct Node.js 22
comparison with installed `0.5.5` confirmed unchanged Grammar 5 and CLI
Contract 6, all prior advance JSON keys, the deliberate
`MutationResult.v3`-to-`AdvanceResult.v1` cutover, required nullable
`history_guard`, the nineteenth root schema, and exact
`--force-history-loss`. `0.5.6` would understate this boundary; Contract 7 or
Grammar 6 would overstate it. `RELEASE_060_PREPARATION` is complete after the
712-test, 29-plan, 138-Markdown, temporary-link, and 504-file isolated-package
gates passed under Node.js 22. `RELEASE_060_CANDIDATE` is complete after clean
source and protected-route preflight accepted the retained 504-file,
543508-byte tarball with SHA-256 `6d03e270...e42acd`. `RELEASE_060_PUBLISH` is
complete: release commit `935b097`, peeled tag, successful Node.js 22/24 CI
run `30631050662`, GitHub prerelease, npm `beta=0.6.0`, and the common tarball
agree. `RELEASE_060_ACCEPTANCE` is complete after independent Git, CI,
GitHub, npm, artifact, installed-package, and repository-clean history-guard
verification. All five tasks and 17p are complete with zero makespans and no
recommendation. npm `latest=0.5.5` and no `alpha` remain unchanged. Completed
declarations remain until separately authorized release-plan advance. npm
`latest` promotion, release-plan advance, and Issue mutation remain separate
decisions.

The explicitly selected `ASSURE-001` workstream is tracked independently in
`plans/plan-assurance.pert`. The user accepted the 9,698-byte initial plan
candidate affecting goal and DAG scopes; it was written once with actor
`codex` and the scope-bound owner assertion `user`. The user later accepted
one exact DAG-only amendment adding the pinpoint hash-inspection task; the
current ten tasks total 59p.
`ASSURE_INTERFACE_CONTRACT` is complete after accepting Grammar 6, CLI Contract
7, all assurance source records and commands, closed results, diagnostics,
governance interface 2, migration, and six fixed SHA-256 vectors.
`ASSURE_HASH_CORE` is complete with an internal pure `src/assurance/` evaluator
for canonical task and outcome commitments, default and explicit planning
dependencies, topological state propagation, accepted component seals, and
complete cause paths. `ASSURE_SOURCE_CORE` is complete with an internal,
identity-checked Grammar 6 parser, validator, formatter, source-span model,
semantic assurance projection, and frontier receipt self-hash check.
`ASSURE_MUTATION_CORE` is complete with internal preview-first relation,
initial-seal, selected-reseal, and outcome mutation planning; mixed
final-candidate batch composition; GovernanceDecision v2; assurance impact;
and digest-bound Grammar 6 safe persistence. `ASSURE_AUTHORITY_CORE` is
complete with internal assurance-aware check, analysis, Next, mutation-impact,
active-attention, required-action, and fail-closed new-start authority
composition. `ASSURE_ADVANCE_CONTRACTION` is complete with internal
assurance-preserving receipt creation and pruning, exact retained-basis
equality, Grammar 6 destructive history provenance, independent history-force
composition, and digest-bound separate-output persistence.
`ASSURE_COMPATIBILITY` is complete with internal Grammar 6 formatting,
version-preserving unit migration, project metadata, actuals-only history,
semantic Mermaid profile 2, strict loss reporting, mixed-batch preservation,
package-inventory enforcement, and direct-edit guidance.
`ASSURE_HASH_INSPECTION` is complete with one source-bound
`Perttool.PlanAssuranceResult.v1` projection, evaluator-ordered task filtering,
the explicit contract/computed-basis/exported selectors, exact scalar digest
text, and fail-closed unavailable handling. `ASSURE_PUBLIC_CONTRACT` is
complete after atomically activating Grammar 6, CLI Contract 7, 44 commands,
20 root schemas, the public package root, and the installed-package workflow.
Its accepted complete gate and boundary are recorded in
`docs/process/plan-assurance-public-contract-acceptance.md`.
`ASSURE_ACCEPTANCE` is complete after tracing all fourteen semantic and twelve
interface cases through the Core, public CLI, real output race, schemas, help,
temporary link, and isolated package. Its accepted gate is recorded in
`docs/process/plan-assurance-acceptance.md`. All ten tasks and 59p are complete
and remain in their exact pre-advance state; precedence and heuristic resource
makespans are zero, and complete NextResult v6 has no ready, recommended, or
startable task. Published package `0.6.0`, remote writes, publication,
dist-tag movement, plan advance, and Issue mutation remain unchanged and
separately gated.

The selected `0.7.0` conditional-plan-assurance beta minor is tracked
independently in `plans/release-0.7.0.pert`. The six serial tasks total 21p
from `RELEASE_070_GATE_DESIGN` through `RELEASE_070_ACCEPTANCE`. The user's
initial 2026-08-04 instruction authorized local gate design, and a later
instruction separately authorized Contract 7 readiness; the next instruction
separately authorized source preparation; subsequent instructions authorized
candidate acceptance and PUBLISH. The user then separately authorized the
exact `0.7.0` npm `latest` promotion, and a following instruction authorized
the narrow acceptance-condition replan and durable acceptance. The gate selects
suffix-free `0.7.0` for the breaking Grammar 6 and CLI Contract 7 public
boundary, records `beta=latest=0.6.0` with no maintained `alpha` as the
read-only channel baseline. `RELEASE_070_GATE_DESIGN`,
`RELEASE_070_CONTRACT_7_READINESS`, and `RELEASE_070_PREPARATION` are complete
and retained before advance. The current manifest, lockfile, and CLI identify
`0.7.0`; the preparation record is `docs/process/0.7.0-preparation.md`.
`RELEASE_070_CANDIDATE` is complete and accepted. Final review rejected the
preliminary SHA-256 `7e57cc89...3ac8a0` tarball because its bundled README
retained a transient preparation-time claim; the intact bytes remain preserved
under a SHA-bound rejected filename. Corrected clean source commit `51984c8`
passed the repeated complete Node.js 22 and read-only external gates. Its
retained 601-file, 656702-byte candidate has SHA-256
`8585adb5...f4d623` and passed isolated Contract 7 file-first and
plan-assurance acceptance. The user later separately authorized PUBLISH from
that unchanged candidate. Release commit and peeled `v0.7.0` target
`1279e3c` agree; Node.js 22 and 24 CI run `30895944899` passed; the GitHub
prerelease, npm `beta=0.7.0`, and the same 601-file tarball agree at SHA-256
`8585adb5...f4d623`; at publication, `latest=0.6.0` and `alpha` remained
absent. Exactly one separately authorized post-publication mutation later made
`beta=latest=0.7.0`; an unqualified isolated installation confirmed Contract
7, 44 commands, and 20 schemas. The acceptance task description preserves both
time-bound facts without changing its DAG, estimate, or resources. Independent
Git, CI, GitHub, npm, byte-identity, exact/beta/latest installation,
rollback-pin, and complete public-package verification passed. All six tasks
and 21p are complete with zero precedence and heuristic resource makespans;
fresh complete NextResult v6 has no ready, recommended, or startable task.
The acceptance record is `docs/process/0.7.0-release-acceptance.md`. Both plan
advances and Issue mutation remain separate.

The explicitly selected `GUIDE-CONSISTENCY-001` correction is tracked in
`plans/help-guide-consistency.pert`. Its accepted
`docs/specs/help-guide-consistency.md` target fixes exact active Guide
identities and additive version history, argument-valid examples for all 44
commands, repository-wide literal diagnostic-link closure, current-versus-
historical documentation labels, `PTCNV-210` coverage, and bounded reciprocal
navigation for the plan-assurance topic. The active Contract 7 Guide now
projects `Perttool.AnalysisResult.v5`, `Perttool.NextResult.v6`, and authority
policy `recommendation_v1_plus_release_gate_plus_plan_assurance_v1` directly
without semantic prose lifting. All eight assurance-mutation Help examples
pass the active argument parser; history and observation diagnostics resolve
to `actuals`, and unit-migration diagnostics resolve to
`editing.unit-migration`. All four tasks and 14p are complete and retained in
their pre-advance state; precedence and heuristic resource makespans are zero,
and complete NextResult v6 has no ready, recommended, or startable task. Its
acceptance record is `docs/process/help-guide-consistency-acceptance.md`.
Release selection, publication, remote writes, Issue mutation, and plan
advance remain separate.

The explicitly selected compatible `0.7.1` Help and Guide consistency patch is
tracked independently in `plans/release-0.7.1.pert`. Its five serial tasks
total 15p from `RELEASE_071_SELF_REVIEW` through `RELEASE_071_ACCEPTANCE`.
The exact initial candidate affecting goal and DAG scopes was written once
with actor `codex` and the scope-bound owner assertion `user`.
`RELEASE_071_SELF_REVIEW` is complete after selecting suffix-free `0.7.1` for
the accepted `GUIDE-CONSISTENCY-001` runtime guidance correction and directly
comparing the current source with installed `0.7.0`. Grammar 6, CLI Contract
7, all 44 command structures, 20 root schemas, 121 package-root exports,
GuideResult v1, and recommendation, temporal, assurance, and governance
authority remain unchanged. Package, lockfile, and CLI still identify `0.7.0`;
npm reports `beta=latest=0.7.0`, no `alpha`, and no published `0.7.1`.
`RELEASE_071_PREPARATION` is complete after aligning package, lockfile, CLI,
CHANGELOG, README, release records, tests, goldens, self-use metadata, and
package validation to `0.7.1`; its record is
`docs/process/0.7.1-preparation.md`. `RELEASE_071_CANDIDATE` is complete after
the clean Node.js 22 gate, read-only external and protected-route preflight,
and acceptance of the retained 601-file, 660003-byte tarball with SHA-256
`5bf47231...e4454c`. Its source commit is `a05b769`, and its record is
`docs/process/0.7.1-candidate.md`. The separately authorized PUBLISH completed
from release commit `eee0f05`, peeled annotated tag `v0.7.1`, successful
Node.js 22 and 24 CI run `30969627120`, GitHub prerelease, and one npm
publication to `beta`. The candidate, GitHub, and npm tarballs agree at the
same SHA-256. At publication, `beta=0.7.1`, `latest=0.7.0`, and alpha was
absent. The user then separately authorized one exact `0.7.1` npm `latest`
promotion; fresh reads and an unqualified installation confirmed
`beta=latest=0.7.1`, 44 commands, and 20 schemas. Durable acceptance is
recorded in `docs/process/0.7.1-release-acceptance.md`. All five tasks and 15p
are complete with zero makespans and no recommendation. Both plan advances,
Issue mutation, and unrelated work remain separately gated.

The explicitly selected `ADAPTER-001` workstream is tracked independently in
`plans/adapter-platform.pert`. Its sixteen tasks total 91p from
`ADAPTER_ARCHITECTURE_CONTRACT` through `ADAPTER_INTEGRATION_ACCEPTANCE` and
compose the shared dependency contract, Core reverse-dependency cleanup,
library and Node-port boundaries, unchanged CLI facade, protocol-neutral
document session, read-only LSP, VSIX shell and DAG Webview, fail-closed
read-only MCP adapter, and cross-surface acceptance.
`ADAPTER_ARCHITECTURE_CONTRACT`, `CORE_DEPENDENCY_CLEANUP`,
`SHARED_LIBRARY_BOUNDARY`, `EDITOR_PROTOCOL_CONTRACT`, and
`DOCUMENT_SESSION_CORE` are complete and retained in their exact pre-advance
state. `LSP_READ_CORE`, `LSP_ACCEPTANCE`, `VSIX_SHELL`, `VSIX_DAG_VIEW`, and
`NODE_PORT_BOUNDARY` are also complete and retained before advance.
`CLI_FACADE_PARITY` is complete and retained before advance.
`MCP_READ_CONTRACT`, `MCP_READ_ADAPTER`, and `MCP_ACCEPTANCE` are complete and
retained before advance. The accepted
`docs/specs/adapter-platform.md` contract,
`docs/process/adapter-architecture-contract-acceptance.md`, and
`docs/process/adapter-core-dependency-acceptance.md` records fix the
121-export, 44-command, 20-schema, zero-production-dependency baseline; the
exact twelve-file, nineteen-import reverse-dependency input; acyclic layer
directions; additive Core/Node subpaths; private adapter distribution inputs;
result and capability ownership; semantic parity; five neutral implementation
owners with exact Application facades; analyzer and override dependency
inversion; and zero reusable-module imports into Application. The accepted
`docs/specs/shared-library.md` and
`docs/process/adapter-shared-library-acceptance.md` add a closed forty-name
platform-neutral Core runtime, an exact 121-name Node facade, root-identical
Grammar 6 parse/validate/format, and direct isolated-package consumption while
retaining zero production dependencies. The accepted
`docs/specs/editor-protocol.md` and
`docs/process/adapter-editor-protocol-acceptance.md` fix stable LSP 3.17,
URI/generation/version and UTF-16 synchronization, cancellation and stale
rejection, the closed read-only capability set,
`Perttool.GraphViewResult.v1`, four DAG modes, source navigation, VS Code
`^1.101.0`, offline server distribution, workspace trust, restrictive CSP,
and accessibility. The accepted `docs/specs/document-session.md` and
`docs/process/adapter-document-session-acceptance.md` expose five Core-only
snapshot, session, analysis, and UTF-16 functions. The exact current Core has
45 runtime values in a 36-module portable closure; immutable source bindings,
atomic changes, completed projection caching, and cancellation/stale rejection
perform no file or editor write. The accepted
`docs/specs/node-host-boundary.md` adds six closed type-only ports and one
default Node composition; root and Node are now exact 122-name facades while
Core remains an exact 45-name portable runtime. The private `adapters/lsp`
workspace pins
`vscode-languageserver` `9.0.1` and stable protocol 3.17.5, provides the closed
local-stdio read-only capability and negotiated Help/GraphView surfaces, and
is excluded from the public package. The implementation and isolated-package
records are `docs/process/adapter-lsp-read-core-acceptance.md` and
`docs/process/adapter-lsp-acceptance.md`. The private `adapters/vscode`
workspace fixes VS Code `^1.101.0`, exact `vscode-languageclient` `9.0.1`,
lazy `.pert`/Help activation, presentation-only TextMate highlighting,
untrusted and virtual workspace support, a closed version-bound virtual Help
bridge, and an exact offline bundled server. Its disposable eleven-file VSIX
and Node.js 22 server smoke are accepted in
`docs/process/adapter-vsix-shell-acceptance.md`. The current fourteen-file
private VSIX adds the `perttool.dag` Webview, four exact GraphView modes,
closed version-bound messages, binding-checked source navigation, restrictive
local CSP assets, deterministic SVG presentation, and an accessible exact-
value outline without moving semantics into the extension. Its implementation
record is `docs/process/adapter-vsix-dag-view-acceptance.md`. Its final
`docs/process/adapter-vsix-acceptance.md` gate installs that exact artifact
with exact `@vscode/test-electron` `3.1.0` under the minimum VS Code `1.101.0`,
proves trusted/untrusted and virtual activation, offline LSP, navigation,
Help, empty/large/rapid-edit DAG use, replacement, uninstall readback, and
unchanged source bytes, and removes its disposable profiles and extension
directory. The Node Host
implementation and gate are recorded in
`docs/process/adapter-node-host-acceptance.md`.
The accepted `docs/specs/mcp-read-contract.md` and
`docs/process/adapter-mcp-read-contract-acceptance.md` fix final MCP revision
`2026-07-28`, exact stable server SDK `2.0.0`, local stdio, four immutable JSON
resources, five closed read-only tools, exact inline and digest-bound
registered sources, adapter-owned result schemas, failure ownership, hard
limits, and semantic parity without a CLI subprocess. The private
`adapters/mcp` workspace implements the exact modern-only local-stdio server,
four resources, five tools, digest-bound sources, self-contained adapter
schemas, hard limits, and direct Application parity without invoking Git,
persistence, or the CLI. Its implementation record is
`docs/process/adapter-mcp-read-adapter-acceptance.md`. The final
`docs/process/adapter-mcp-acceptance.md` record adds an isolated dual-tarball
install, two-client parity, strict malformed-line fail-closure, installed
source/digest/error probing, and before/after file-identity proof.
`MCP_READ_CONTRACT`, `MCP_READ_ADAPTER`, and `MCP_ACCEPTANCE` are complete and
retained before advance. The CLI now constructs one private Application facade over the
accepted Node Host; document bytes/digests, Git history and advance evidence,
artifact output, and Grammar 6 persistence use injected ports while all 44
Contract 7 commands and package identities remain unchanged. Its record is
`docs/process/adapter-cli-facade-parity-acceptance.md`. The final
`docs/process/adapter-integration-acceptance.md` record closes sixteen
dependency-ordered semantic-parity, protocol-binding, dependency,
distribution, installed-adapter, supported-host, complete self-use, and
no-write cases. `ADAPTER_INTEGRATION_ACCEPTANCE` is complete and retained
before advance. All sixteen tasks and 91p are complete; precedence and
`parallel-sgs` version 1 heuristic resource makespans are zero with zero
resource delay, and complete NextResult v6 has no ready, recommended, or
startable task.
Editor mutation, MCP
mutation, release selection, publication, remote writes, Issue mutation, and
plan advance remain separate.

The explicitly selected `EDITOR-MUTATION-001` workstream is tracked
independently in `plans/editor-mutations.pert`. Its eleven serial tasks total
77p from `EDITOR_MUTATION_CONTRACT` through `EDITOR_MUTATION_ACCEPTANCE`. The
accepted `docs/specs/editor-mutations.md` contract selects additive Editor
Protocol model 2 while retaining active model 1 unchanged. It classifies one
complete final candidate by the strictest of `E0` complete semantic
equivalence, `E1` completely unsealed validated repair, `E2` non-destructive
recoverable semantic edit, and `E3` assurance-, governance-, destructive-, or
advance-sensitive operation. `Perttool.EditorSemanticFingerprint.v1` is
distinct from source and plan-assurance hashes; exact document/candidate
bindings, independent recovery, candidate-bound authority, advance history
safety, `PTEDM-101` through `PTEDM-110`, and exact hard limits fail closed.
The 24 dependency-ordered cases are in
`test/fixtures/editor-mutation-contract-v1.json`, and acceptance is recorded
in `docs/process/editor-mutation-contract-acceptance.md`.
`EDITOR_MUTATION_CONTRACT` is complete and retained before advance. Its exact
conformant outcome was separately confirmed and written once with actor
`codex`, the candidate-bound `user` assertion, accepted basis
`sha256:166d04ca...0294b6`, and final plan source digest
`sha256:e5ebb94a...9436ca`. Complete assurance has no required action and fresh
complete NextResult v7 recommends only `EDITOR_FORMAT_CORE`. The current E0
implementation adds the Core-owned complete semantic fingerprint and a
binding-, validation-, equality-, and idempotence-checked session format
projection. The private LSP selects model 2 only from a compatible offer and
then advertises only standard whole-document formatting; model-1 connections
remain read-only. Its fourteen dependency-ordered cases and accepted boundary
are recorded in `test/fixtures/editor-format-core-v1.json` and
`docs/process/editor-format-core-acceptance.md`. The private VSIX now offers
the exact `[2, 1]` model list and gates standard Format Document plus user-
enabled format-on-save on an accepted model-2 handshake. Its eighteen cases,
trusted/untrusted VS Code 1.101.0 host gate, and accepted boundary are recorded
in `test/fixtures/editor-format-acceptance-v1.json` and
`docs/process/editor-format-acceptance.md`; implementation commit `a5729f7`
retains range/on-type formatting, E1 through E3, settings mutation, and direct
persistence as unavailable. `EDITOR_FORMAT_CORE` is complete and
retained before advance; its status-only write changed the plan digest from
`sha256:3323fecd...cc627d` to `sha256:32606859...f7609b` without an owner
assertion. The implementation commit is `5245235`. The reached-milestone
criterion set was separately confirmed and written once with actor `codex` and
the candidate-bound `user` assertion; the resulting source digest is
`sha256:9f6b3d2a...152486`. Its receipt and the separately governed conformant
outcome require distinct exact candidate-bound owner confirmations. The
receipt was separately confirmed and written once with actor `codex` and a
fresh `user` assertion; source digest `sha256:21ec01eb...a2bbaa` now reports
the reached milestone as accepted with no blocking criterion. The conformant
outcome was separately confirmed and written once with actor `codex`, a fresh
candidate-bound `user` assertion, and accepted basis
`sha256:7c0e42ed...92572`. Final source digest
`sha256:690f65bd...a8b79a` has complete assurance with no unavailable task,
mismatch, replan requirement, or required action. Fresh complete NextResult v7
recommends and makes startable only `EDITOR_FORMAT_ACCEPTANCE`. E1 through E3,
MCP mutation, public VSIX publication, release selection, remote writes, Issue
mutation, and plan advance remain separate.

The explicitly selected `HIST-DAG-001` workstream is tracked independently in
`plans/historical-dag.pert`. Its eight tasks total 44p from
`HISTORICAL_DAG_CONTRACT` through `HISTORICAL_DAG_ACCEPTANCE` and sequence one
normative first-parent contract, a shared whole-document transition model,
bounded immutable Git evidence, pure checkpoint/lineage/timeline
reconstruction, a distinct read-only CLI result, a separate historical editor
contract, VSIX presentation, and cross-surface acceptance. The accepted
`docs/specs/historical-dag.md` contract fixes
`Perttool.HistoricalDagModel.v1`,
`Perttool.HistoricalTransitionModel.v1`, future
`Perttool.HistoricalGraphResult.v1`, inclusive endpoint and lower-boundary
semantics, explicit `first_parent` scope, source-validity gaps, stable actual
freezing, exact canonical-advance proof, deterministic `HDGE-*` occurrence and
`HDGT-*` topology epochs, snapshot/lineage/timeline views, single-checkpoint
analysis, exact hard limits, immutable source bindings, `PTHDG-101` through
`PTHDG-106`, and fail-closed three-way deferral to `SCM-001`. Its twenty
dependency-ordered machine cases are in
`test/fixtures/historical-dag-contract-v1.json`, and its acceptance record is
`docs/process/historical-dag-contract-acceptance.md`.
`HISTORICAL_DAG_CONTRACT` is complete and retained in its exact pre-advance
state with a conformant basis-bound outcome. The pure internal
`src/history/historical-transition.ts` implementation now projects closed
Grammar 1 through 6 semantics apart from source fidelity, preserves exact
Rational and calendar meaning, separates planning, lifecycle, evidence,
governance, assurance, and topology axes, classifies adjacent checkpoints,
requires exact unforced canonical-advance candidate equality, and derives
deterministic `HDGE-*` occurrence, consecutive value, and `HDGT-*` topology
epochs while failing closed on stable-event conflicts, frozen-plan changes,
noncanonical removal, project discontinuity, and ambiguous ID reuse. Its twelve
cases and fixed digest vectors are in
`test/fixtures/historical-transition-model-v1.json`; its technical acceptance
record is `docs/process/historical-transition-model-acceptance.md`.
`HISTORICAL_TRANSITION_MODEL` is complete and retained before advance. Its
exact basis-bound conformant outcome is registered with the separately
confirmed `user` assertion for the `plan_assurance` scope. Complete assurance
had no unavailable task or required action before the next task was completed.
The current internal `probeHistoricalGitEvidence` implementation in
`src/history/git-probe.ts` freezes requested and resolved endpoint and optional
inclusive lower-boundary commits, first-parent commit/parent/blob/raw-source
evidence, opaque common-directory repository and complete read-snapshot IDs,
the exact three input limits, SHA-1/SHA-256 and linked-worktree identity,
shallow completeness, and post-capture ref/path races. Its twelve cases are in
`test/fixtures/historical-git-evidence-v1.json`, and its technical acceptance
record is `docs/process/historical-git-evidence-acceptance.md`. It remains
absent from the public package root, Core/Node facades, Node Host port object,
CLI, schemas, LSP, VSIX, and MCP. `HISTORICAL_GIT_PROBE` is complete and
retained before advance. Its status-only write changed the plan digest from
`sha256:0fbcdb6f...e79257c` to `sha256:f540a7ac...887fe` without an owner
assertion. Its exact basis-bound outcome was separately confirmed and written
once with actor `codex` and the candidate-bound owner assertion `user`. The
resulting plan digest is `sha256:fb5e0054...37e139`. Complete assurance has no
unavailable task, mismatch, replan requirement, or required action. Fresh
complete NextResult v6 recommends and makes startable only
`HISTORICAL_LINEAR_CORE`.
The pure internal `reconstructHistoricalLinearHistory` implementation in
`src/history/historical-graph.ts` now validates the immutable evidence binding,
classifies every Grammar 1 through 6 source, retains invalid continuity gaps,
observes assurance independently, freezes exact work events, invokes the
compatible canonical-advance planner in preview mode, verifies its complete
candidate and summary, and reconstructs exact checkpoints, selected snapshot,
timeline segments, current and retired lineage occurrences, advance proofs,
and immutable UTF-16 source bindings under four fail-closed output limits. Its
twelve cases are in `test/fixtures/historical-linear-core-v1.json`, and its
technical acceptance record is
`docs/process/historical-linear-core-acceptance.md`. It remains absent from the
public root/Core/Node facades, Node Host ports, CLI, schemas, LSP, VSIX, and MCP.
`HISTORICAL_LINEAR_CORE` is complete and retained before advance. Its
status-only write changed the plan digest from `sha256:fb5e0054...37e139` to
`sha256:60bce146...97975` without an owner assertion. Its exact assertion-free
conformant outcome preview is bound to accepted basis
`sha256:dd9be234...db4e4` and candidate digest
`sha256:0ca50c85...b905c6`. It was separately confirmed and written once with
actor `codex` and the candidate-bound `user` assertion for `plan_assurance`.
Readback shows complete assurance with no unavailable task, mismatch, replan
requirement, or required action. Fresh complete NextResult v6 recommends and
makes startable only `HISTORICAL_CLI`.
The current source now implements the additive read-only `dag history`
command over a private Node Git-evidence composition and the pure linear Core.
It activates `Perttool.HistoricalGraphResult.v1`, the twenty-first root
schema, `PTHDG-101` through `PTHDG-106`, exact snapshot/lineage/timeline views,
single-checkpoint analysis, immutable source bindings, hard limits, Help, and
the `historical-dag` Guide topic. The active Contract 7 registry therefore has
45 commands and 21 schemas. Root/Node remain exact 122-name facades, Core
remains an exact 45-name portable runtime, and the public Node Host port object
is unchanged. Current `project history`, `dag render`,
`Perttool.GraphViewResult.v1`, Grammar 6, CLI Contract 7 meanings, LSP, VSIX,
and MCP remain unchanged. Three-way ancestry, semantic patch or merge, MCP
history, editor mutation, release selection, publication, remote writes,
Issue mutation, and plan advance remain separate.
`HISTORICAL_CLI` is complete. Its status-only write changed plan digest
`sha256:0ca50c85...b905c6` to `sha256:ccaf594b...ff8a3c` without an owner
assertion. The assertion-free `OUTCOME_HISTORICAL_CLI` preview is bound to
accepted basis `sha256:a526dada...3f88e`, reason
`Accepted read-only historical CLI and twelve closed cases`, and candidate
digest `sha256:f74371c9...ad786`. It affects only `plan_assurance`, requires the
candidate-bound `user` assertion, and was separately confirmed and written
once with actor `codex` and that owner assertion. Readback shows complete
assurance with no unavailable task, mismatch, replan requirement, or required
action. Before the historical editor contract task was completed, fresh
complete NextResult v6 recommended and made startable only
`HISTORICAL_EDITOR_CONTRACT`.
The accepted `docs/specs/historical-editor-protocol.md` contract now fixes
historical editor protocol model 1, separately negotiated
`perttool/historicalGraphView` and `perttool/historicalSource` methods,
`Perttool.HistoricalGraphViewResult.v1` and
`Perttool.HistoricalSourceResult.v1`, trusted local `file` workspace and
repository selection, exact document/result/commit/blob/digest/range bindings,
snapshot/lineage/timeline presentation, four orthogonal analysis modes,
cancellation, staleness, immutable virtual documents, exact hard limits,
`PTHED-101` through `PTHED-105`, restrictive Webview input, accessibility, and
no-write behavior. Its eighteen dependency-ordered machine cases are in
`test/fixtures/historical-editor-protocol-cases-v1.json`, and its acceptance
record is `docs/process/historical-editor-contract-acceptance.md`. That contract
slice did not activate either method or change current GraphView, LSP, VSIX,
package, command, schema, or runtime catalogs. `HISTORICAL_EDITOR_CONTRACT` is
complete. Its status-only write changed plan digest
`sha256:f74371c9...6ad786` to `sha256:3c25ba69...abf428` without an owner
assertion.
The assertion-free `OUTCOME_HISTORICAL_EDITOR_CONTRACT` preview is bound to
accepted basis `sha256:37373a2e...d26949e1`, reason
`Accepted historical editor protocol and eighteen closed cases`, completed
source digest `sha256:3c25ba69...abf428`, and candidate digest
`sha256:9be391c7...5b8561`. It affects only `plan_assurance`, requires the
candidate-bound `user` assertion, and was separately confirmed and written
once with actor `codex` and that owner assertion. Readback shows complete
assurance with no unavailable task, mismatch, replan requirement, or required
action. Fresh complete NextResult v6 recommends and makes startable only
`HISTORICAL_VSIX`.
The private bundled LSP and VSIX now implement the separately negotiated
`perttool/historicalGraphView` and `perttool/historicalSource` methods. The
server composes the historical Application service directly, permits bounded
read-only Git discovery and immutable object reads only for an eligible trusted
local `file` workspace, binds URI/generation/version/source digest, retains
bounded connection-local results, and verifies exact commit/blob/digest/owner/
UTF-16 source bindings. The VSIX presents snapshot, proved-lineage, and
timeline views with the four analysis modes as an orthogonal selector, sends
only a sanitized presentation clone to its restrictive Webview, and opens
verified read-only `perttool-history` documents. Current GraphView, public
package facades, CLI commands and schemas, MCP, source bytes, and Git state
remain unchanged. Its eighteen dependency-ordered cases are in
`test/fixtures/historical-editor-runtime-cases-v1.json`, and its accepted
implementation record is `docs/process/historical-vsix-acceptance.md`.
`HISTORICAL_VSIX` is complete and retained before advance. Its status-only
write changed the plan digest from `sha256:9be391c7...5b8561` to
`sha256:6b89163c...8dec9` without an owner assertion. Its exact basis-bound
outcome assertion-free preview is bound to accepted basis
`sha256:7edcde414...1c03657d`, reason
`Accepted historical LSP and VSIX implementation and eighteen closed cases`,
completed source digest `sha256:6b89163c...8dec9`, and candidate digest
`sha256:a89ef57c...8ead1e`. It affects only `plan_assurance`, requires the
candidate-bound `user` assertion, and was separately confirmed and written
once with actor `codex` and that owner assertion. Readback shows complete
assurance with no unavailable task, mismatch, replan requirement, or required
action. Fresh complete NextResult v6 recommends and makes startable only
`HISTORICAL_DAG_ACCEPTANCE`.

`HISTORICAL_DAG_ACCEPTANCE` is now complete and retained before advance. Its
separately confirmed conformant outcome is bound to accepted basis
`sha256:cce0e3c7...a894626`, and final plan source digest is
`sha256:3a1b78e7...64ea3ef`. Complete assurance has no unavailable task,
mismatch, replan requirement, required action, ready task, recommendation, or
startable task. The selected local `DAG-UX-001` and
`VSIX-DAG-PRESENT-001` presentation slices add exact bundled Dagre 3.1.0,
default-first history, bounded pan/zoom/fit/scroll, exact current focus,
source-order `Mnn`/`Tnn`/`Gnn` current labels, view-local historical occurrence
labels, accessible graph/detail return paths, and distinct exact precedence
residual, resource remaining, and task time summaries. The preceding 18-file
private VSIX was installed once locally before the compact-label slice. The
user later separately authorized one local replacement with the exact 18-file,
2,188,896-byte compact VSIX at SHA-256
`ac10f4df...a812e6`; installed client, bindings, server, Webview, and CSS bytes
match that artifact. Grammar 6, CLI Contract 7, public facades, GraphView and
historical result identities, source bytes, release, remote, publication,
Issue, and plan-advance state remain unchanged.

Backlog `VSIX-ASSURE-001` records the requested semantic presentation of
unsealed, sealed-and-consistent, and broken-seal states. The current editor
protocol explicitly does not advertise semantic tokens, so the request remains
a separate protocol and presentation design item. It does not change the
active TextMate grammar, GraphView modes, assurance meanings, editor bytes,
reseal authority, VSIX release selection, or publication state.

The explicitly selected `0.8.0` additive beta release is tracked independently
in `plans/release-0.8.0.pert`. Its six serial tasks total 22p from
`RELEASE_080_GATE_DESIGN` through `RELEASE_080_ACCEPTANCE` and cover the
release gate, accepted adapter-platform, historical-DAG and declaration-
identity inputs, source preparation, one immutable candidate, separately
authorized PUBLISH, and durable acceptance. Contract 7 `project init` created
the exact 489-byte Grammar 6 base. The user then confirmed the exact 6,734-byte
18-mutation candidate affecting goal and DAG scopes; it was written once with
actor `codex`, the candidate-bound owner assertion `user`, and final digest
`sha256:a26bb205...fadc69c`. Both precedence and `parallel-sgs` version 1
resource makespans were initially 22p with zero delay.
`RELEASE_080_GATE_DESIGN` is complete after accepting Requirements 21.15,
ADR 0003, the Post-MVP 4S design slice, the release procedure, exact public
counts, private-adapter exclusions, and focused regression coverage.
`RELEASE_080_INPUT_READINESS` is complete after directly rechecking the
retained complete `ADAPTER-001` and `HIST-DAG-001` plans, their final
acceptance records, `DECL-ID-001`, the public package catalogs, compatibility,
and no-write boundaries. Their records are
`docs/process/0.8.0-gate-design.md` and
`docs/process/0.8.0-input-readiness.md`. `RELEASE_080_PREPARATION` is complete
after package, lockfile, adapter-peer, MCP, CLI, CHANGELOG, README, migration,
tests, and goldens were aligned to `0.8.0`; zero-vulnerability install and the
complete Node.js 22 gate passed 973 tests, 36 self-use plans, isolated adapter
gates, temporary linking, and the 679-file public-package workflow. Its record
is `docs/process/0.8.0-preparation.md`, and completed plan digest is
`sha256:0cce301f...858dc457`. `RELEASE_080_CANDIDATE` is complete after the
clean Node.js 22 gate, unused-version and authenticated-route preflight, and
acceptance of the retained 679-file, 2753740-byte tarball from source commit
`f9be1cc`; its SHA-256 is `d761e2a1...1ac00b28`. GitHub reports that `main`
has no branch protection, while the authenticated `secdat` fast-forward
dry-run succeeded; no protection claim is made. Exact installed-package,
historical-DAG, public-facade, schema, declaration-identity, and private-
adapter-exclusion checks passed. Its record is
`docs/process/0.8.0-candidate.md`, and completed plan digest is
`sha256:d91f752c...f3249b3c`. The user then separately authorized the exact
candidate and six-mutation external PUBLISH batch. Release commit and peeled
annotated `v0.8.0` tag target `db5c2f8`; Node.js 22 and 24 CI run
`31154880011` passed; GitHub prerelease `366565943`, npm `beta=0.8.0`, and the
same 679-file tarball agree at SHA-256 `d761e2a1...1ac00b28`. The first
GitHub Release route failed before mutation for missing `workflow` scope;
readback showed no Release, and the unchanged request succeeded once through
the established process-scoped route. npm accepted one publish, while the
short internal readback window returned propagation E404; the operation was
not retried, and fresh reads established durable publication at
`2026-08-07T06:48:55.944Z`. Exact and beta installations expose 45 commands,
21 schemas, 122 root and Node exports, 45 Core exports, historical DAG, and
the declaration-identity correction. At publication and durable acceptance,
`latest=0.7.1` and absent `alpha` remained unchanged. Durable acceptance is
recorded in
`docs/process/0.8.0-release-acceptance.md`; all six tasks and 22p are complete
with zero makespans and no recommendation. The user later separately
authorized one exact npm `latest` mutation; direct registry and fresh-cache
readback established `beta=latest=0.8.0`, no `alpha`, and unchanged package
integrity, while unqualified global and isolated installations resolved to
`perttool 0.8.0` with 45 commands and 21 schemas. Its record is
`docs/process/0.8.0-latest-promotion.md`. Public VSIX identity or publication,
both input-plan advances, release-plan advance, and Issue mutation remain
separate. Initial plan acceptance is recorded in
`docs/process/0.8.0-release-plan-acceptance.md`.

The current repository source atomically activates Grammar 7 and CLI Contract
8 for milestone outcome acceptance. It exposes 53 commands, 23
root schemas, 129 root and Node runtime exports, `Perttool.CheckResult.v5`,
`Perttool.AnalysisResult.v6`, `Perttool.NextResult.v7`,
`Perttool.MutationResult.v5`, and `Perttool.AdvanceResult.v3`. The selected
`plans/milestone-acceptance.pert` workstream is complete and canonically
advanced from committed pre-advance commit `c96e522`; residual source digest
`sha256:a729f5b3dc1565a2666068b9ccd4dc140288f41273289ad8bfabdb9afcbe9066`
retains only accepted reached milestone `MILESTONE_ACCEPTANCE_ACCEPTED` and
has no diagnostics, task, recommendation, or startable task.

The explicitly selected `0.9.0` milestone-acceptance beta minor is tracked in
`plans/release-0.9.0.pert`. Its six serial tasks and 22p through
`RELEASE_090_ACCEPTANCE` completed before canonical advance. Release commit
and peeled annotated `v0.9.0` target `3aca4f0`; Node.js 22 and 24 CI run
`31670558276` passed; GitHub prerelease `369687054`, npm `0.9.0`, and the
retained 713-file tarball agree at SHA-256 `88e51bfe...37345e7`. Independent
Grammar 1 through 7, Contract 8, milestone acceptance, historical
reconstruction, migration, public export/schema, private-adapter exclusion,
and exact, beta, latest, and rollback installation checks passed. Accepted
record commit `4a78e58` was pushed to the work-in-progress branch. A separately
authorized npm mutation made `beta=latest=0.9.0` with no `alpha`, and Issues
#10 and #11 were closed with release evidence. The completed Grammar 6 plan
was migrated at commit `dd00725`; six artifact criteria and receipts were
frozen at pre-advance commit `23e1664`; and history- and acceptance-guarded
advance completed without force. Residual Grammar 7 digest
`sha256:59b5fbbe...d4e71a` retains only accepted reached milestone
`RELEASE_090_ACCEPTED`, has zero tasks and makespans, no diagnostic, and no
ready, recommended, or startable task. Records are
`docs/process/0.9.0-latest-promotion.md` and
`docs/process/0.9.0-post-acceptance-operations.md`. Public VSIX publication
and unrelated work remain separate.

The explicitly selected compatible `0.9.1` current-velocity observation patch
is tracked in `plans/release-0.9.1.pert`. Its five serial tasks total 15p from
`RELEASE_091_SELF_REVIEW` through `RELEASE_091_ACCEPTANCE`.
`RELEASE_091_SELF_REVIEW` is complete after accepting suffix-free `0.9.1` for
`ACT-003` and Issue #8. Grammar 7, CLI Contract 8, all 53 commands, 23 root
schemas, 129 root and Node exports, 45 Core exports, result and schema
identities, and authority remain unchanged. The correction binds declared
velocity candidates to the exact current operand while retaining
selected-revision Git-recorded candidates and does not automatically adopt a
velocity. `RELEASE_091_PREPARATION` is complete after aligning package,
lockfile, CLI, MCP, adapter peer, documentation, test, golden, and self-use
identities to `0.9.1`. The complete Node.js 22 gate passed 1,045 tests, 39
self-use plans, the private-adapter and temporary-link workflows, and the
713-file isolated package workflow; its record is
`docs/process/0.9.1-preparation.md`. At candidate preflight, npm reported
`beta=latest=0.9.0` with no `alpha`, and `v0.9.1`, its GitHub Release, and
`perttool@0.9.1` were unused.
`RELEASE_091_CANDIDATE` is complete after the clean Node.js 22 gate,
read-only external and route preflight, and acceptance of the retained
713-file, 2808175-byte tarball from source commit `b8dba7e`; its SHA-256 is
`27b4d8d...3e77bf`, and its record is
`docs/process/0.9.1-candidate.md`. Release commit and peeled annotated
`v0.9.1` target `ddb12dc`; Node.js 22 and 24 CI run `31684442125` passed;
GitHub prerelease `369785842`, npm `beta=0.9.1`, and the same tarball agree.
At publication, `latest=0.9.0` and `alpha` remained absent. The publication
record is `docs/process/0.9.1-publish.md`. Durable acceptance independently
verified Git, CI, GitHub, npm, byte identity, exact and beta installation, the
real Issue #8 uncommitted-finish regression, and the exact `0.9.0` rollback
pin. Issue #8 was then closed once with the evidence comment while retaining
only its `bug` label. All five tasks and 15p are complete with zero makespans
and no ready, recommended, or startable task; the acceptance record is
`docs/process/0.9.1-release-acceptance.md`. npm `latest=0.9.0`, plan advance,
public VSIX publication, and unrelated work remain separate.

Issue #4 is tracked in the independent `plans/governance.pert` post-beta workstream. All twelve tasks from `GOV_REQUIREMENTS` through `GOV_ACCEPTANCE` are complete and advanced. Grammar 4 parsing, declared/effective metadata and digest-bound snapshots, formatting, project init/show/set and batch fields, unit-migration preservation, deterministic actual-change classification, caller-assertion normalization, pre-change authority decisions, PTGOV diagnostics, governed direct/batch/advance previews, ProjectResult v3, MutationResult v2, GovernanceDecision v1, the complete Contract 5 registry/help/usage projection, guarded in-place/existing-document-out persistence, the exact generated direct-edit warning, and the Contract 5 editing Guide are active through the standard package root, CLI, and installed `0.4.0` and `0.5.0` workflows. Preview, denied, invalid, and stale decisions fail closed before or within the retained safe-write gates. The plan has zero precedence and heuristic resource makespans, no remaining or recommended task, and an observed velocity of `45p/2d`. Issue #4 closure remains a separate authorization boundary. Issue #3 multi-plan composition remains a post-beta backlog, while LSP, VSIX, DAG view, and MCP are now composed by the selected `ADAPTER-001` plan. Human override apply, durable audit, and Git integration remain unavailable until MIG-08.

The explicitly selected project-actuals workstream is tracked independently in
`plans/project-actuals.pert`. `ACTUALS_CONTRACT_REVIEW` is complete, its exact
pre-advance snapshot is committed at `f6e93e1`, and the task has been advanced
to reached `ACTUALS_CONTRACT_READY`. `ACTUAL_SOURCE_CORE` is complete, its
exact pre-advance snapshot is committed at `d6d3d7f`, and the task has been
advanced to reached `ACTUAL_SOURCE_READY`. The internal identity-checked
Grammar 5 source Core parses, validates, formats, and projects exact task-owned
work events and the target suspended state while the standard package root,
CLI Contract 5, and Grammar 1 through 4 remain unchanged. Its acceptance
record is `docs/process/project-actuals-source-core-acceptance.md`.
`ACTUAL_GIT_HISTORY_PROBE` is complete, its exact pre-advance snapshot is
committed at `2198a0b`, and the task and satisfied source/history gates are
advanced to reached `HISTORY_INPUT_READY`. Its internal read-only adapter
binds SHA-1/SHA-256 repository snapshots, first-parent path history, raw
source digests, typed incomplete/unavailable causes, linked worktrees, and
source/HEAD races without changing Git or the active public surface.
`FINISH_ACTUALS` is complete, its exact pre-advance snapshot is committed at
`2af13c4`, and the task is advanced to reached `FINISH_ACTUALS_READY`. Its
internal eventful-finish Core provides deterministic identity, exact
active-time and effort input, finish-only and complete coverage,
retry/conflict handling, governed Grammar 5 safe write, and task-owned advance
removal. Its acceptance record is
`docs/process/project-actuals-finish-acceptance.md`. `PROJECT_HISTORY` is
complete, its exact pre-advance snapshot is committed at `c0eff39`, and the
task is advanced to reached `PROJECT_HISTORY_READY`. Its internal pure reducer
reconstructs explicit events, advance removal, qualified legacy Git-recorded
transitions, exact task summaries, and typed incomplete/unavailable outcomes
from the read-only first-parent probe. Its deterministic
`Perttool.ProjectHistoryResult.v1` JSON and text target remained absent until
the later public-contract cutover; its acceptance record is
`docs/process/project-actuals-history-acceptance.md`. `WORK_LIFECYCLE` is
complete; Git commit `518a59e` records its exact completed 7p pre-advance
snapshot, and the task is advanced to reached `LIFECYCLE_READY`. Its
internal lifecycle target provides exact start/suspend/resume candidates,
deterministic retry and refusal, resource release, full remaining-duration
schedules, and separate `Perttool.AnalysisResult.v4` and
`Perttool.NextResult.v5` suspended handling without changing the active
public surface at that slice. Its acceptance record is
`docs/process/project-actuals-lifecycle-acceptance.md`.
`VELOCITY_OBSERVATION` is complete; Git commit `19b060a` records its exact
completed 5p pre-advance snapshot, and the task and satisfied integration
gates are advanced to reached `ACTUALS_INTEGRATED_INPUT`. Its pure service
derives exact elapsed-hour, active-date, effort-productivity, and separately
qualified Git-recorded rates from ProjectHistoryResult v1 without changing
declared velocity. Its acceptance record is
`docs/process/project-actuals-velocity-observation-acceptance.md`.
`ACTUALS_PUBLIC_CONTRACT` is complete; Git commit `753efea` records its exact
completed 6p pre-advance snapshot, and the task is advanced to reached
`ACTUALS_PUBLIC_READY`. The current source atomically activates Grammar 5 and CLI Contract 6 through
the standard parser, formatter, lifecycle and advance mutations, suspended
analysis/Next results, history, observation, package root, the original
33-command cutover registry, help, Guide, result schema identities and projections, diagnostics,
examples, and isolated installed workflow. Its acceptance record is
`docs/process/project-actuals-public-contract-acceptance.md`.
`ACTUALS_ACCEPTANCE` is complete; Git commit `f994fa2` records its exact
completed 4p pre-advance snapshot, and the task is advanced to reached
`ACTUALS_ACCEPTED`. Its complete fourteen-case trace covers requirements,
source, lifecycle, advance, real Git histories, Core, CLI, result projections,
help, package root, temporary link, and isolated installed workflows. Its
acceptance record is `docs/process/project-actuals-acceptance.md`. All nine
tasks and 47p are complete; precedence and the `parallel-sgs` version 1
heuristic resource makespan are both zero with no resource delay. Complete
NextResult v5 has no ready, recommended, or startable task.
Git mutation, automatic velocity adoption, MIG-08, release publication, and
dist-tag movement remain unauthorized. This independent workstream did not
displace the separately selected English-baseline workstream. Backlog `ACT-002` records a request-only REOPEN concept
for completed work. Its feasibility, semantics, implementation, plan, and
public-contract inclusion are all undecided.
The locally accepted `ACT-003` correction for GitHub Issue #8 makes
`project observe-velocity` reduce declared candidates from the exact current
operand while retaining selected-revision Git-recorded candidates and nested
history provenance. Its real-CLI and documentation evidence is
`docs/process/issue-8-current-velocity-acceptance.md`. The public Core,
result/schema identities, `project history`, package exports, release, remote,
Issue, and publication state remain unchanged.

The reviewed CLI/help reset is tracked independently in `plans/cli-surface-reset.pert`. All nine tasks from `CONTRACT_V3_DESIGN` through `CLI_003_FILE_FIRST_ACCEPTANCE` are complete and advanced. Its accepted Contract 3 design introduced one typed registry for dispatch, option parsing, text help, and JSON help; separated domain guide and agent guidance; added structured usage recovery, project initialization, and direct gate maintenance; and rejected renamed Contract 2 spellings. Contract 4 retains those invariants while extending every active JSON envelope and the installed-package workflow for temporal and exact-unit behavior. The plan has no remaining or recommended task and an observed provisional `49p/1d` velocity.

The first Contract 3 package, suffix-free beta `0.2.0`, is accepted under `docs/process/0.2.0-release.md` and `docs/process/0.2.0-release-acceptance.md`. All five tasks in `plans/release-0.2.0.pert` are complete and advanced. The release commit and peeled annotated tag agree; the local, GitHub, and npm tarballs have the same SHA-256; and installed-package Contract 3 and file-first checks passed. Publication moved only npm `beta`; after acceptance, the user separately authorized one dist-tag operation that made `beta=latest=0.2.0`. The plan itself remains complete and unchanged, with no remaining or recommended task, zero precedence and heuristic resource makespans, and an observed `17p/2d` velocity.

The accepted Contract 4 release is suffix-free beta `0.3.0`.
`plans/release-0.3.0.pert` independently tracks release
gate design, accepted scheduling-and-units input, source preparation,
candidate acceptance, PUBLISH, and durable acceptance without duplicating
SU-M3/SU-M5 task state. All six release tasks from
`RELEASE_030_GATE_DESIGN` through `RELEASE_030_ACCEPTANCE` are complete and
advanced.
Release commit and peeled tag target `af44577` agree; the GitHub prerelease and
npm registry tarballs have SHA-256 `197548a4...62074`; npm
`beta=latest=0.3.0` and `alpha=0.1.0-alpha.2`. An unqualified global
installation and light Contract 4 smoke passed. The plan has zero precedence
and heuristic resource makespans, no remaining or recommended task, and
observed cumulative velocity `19p/2d`.

The accepted release is suffix-free beta `0.4.0` for the breaking
Grammar 4 and CLI Contract 5 cutover. `plans/release-0.4.0.pert`
independently tracks gate design, accepted governance input, source
preparation, candidate acceptance, PUBLISH, and durable acceptance without
restoring completed governance task state. `RELEASE_040_GATE_DESIGN` is
complete and advanced, and `RELEASE_040_CONTRACT_5_READINESS` is complete and
advanced after accepting the Contract 5 readiness record.
`RELEASE_040_PREPARATION` is complete and advanced after aligning the `0.4.0`
package identity, CHANGELOG, README, Contract 4-to-5 migration guidance,
tests, goldens, and full Node.js 22 repository and installed-package gates.
`RELEASE_040_CANDIDATE` is complete and advanced after the clean source,
version and channel identity, external availability, protected routes, and
full Node.js 22 gates were reverified. The retained 392-file candidate
tarball has SHA-256 `010af9ce...7cc4a`. `RELEASE_040_PUBLISH` is complete and advanced:
release commit and peeled `v0.4.0` target `6b341d1` agree; the candidate,
GitHub, and npm tarballs are byte-identical; npm reports `beta=0.4.0`,
`latest=0.3.0`, and `alpha=0.1.0-alpha.2`; and isolated public-package checks
passed. `RELEASE_040_ACCEPTANCE` is complete after rechecking both public
tarballs. All six tasks and 19p are accepted over two active days and
advanced to reached `RELEASE_040_ACCEPTED`; the plan has zero makespans and no
ready or recommended task. The user separately authorized the later
`perttool@0.4.0` npm `latest` promotion; fresh registry reads and an
unqualified isolated installation confirmed `beta=latest=0.4.0`, CLI
Contract 5, and Grammar 4. Issue #4 closure remains a separate
post-acceptance decision.

The accepted release is suffix-free beta `0.5.0` for the atomic Grammar
5 and CLI Contract 6 cutover. `plans/release-0.5.0.pert` independently tracks
gate design, accepted project-actuals and English-baseline input, source
preparation, candidate acceptance, authorized PUBLISH, durable acceptance,
and the exact post-release local-install boundary. Git commit `1641a32`
records the exact completed gate-design pre-advance snapshot; the task is
advanced to reached `RELEASE_050_GATE_ACCEPTED`.
`RELEASE_050_CONTRACT_6_READINESS` is complete; Git commit `ba84cd8` records
its exact pre-advance snapshot, and the task is advanced to reached
`RELEASE_050_CONTRACT_6_READY` after accepting the reached actuals and English
inputs, active Contract 6 boundary, compatibility, safety, and installed workflows.
`RELEASE_050_PREPARATION` is complete after aligning the `0.5.0` package
identity, CHANGELOG, README, Contract 5-to-6 migration guidance, tests,
goldens, and full Node.js 22-or-later repository and installed-package gates. Git
commit `e1e7ccf` records its exact pre-advance snapshot, and the task is
advanced to reached `RELEASE_050_SOURCE_PREPARED`.
`RELEASE_050_CANDIDATE` is complete and advanced after the clean source,
version and channel identity, external availability, protected routes, and
complete repository and installed-package gates were reverified. The retained
468-file candidate tarball has SHA-256 `f3ba9b3f...2208c`.
`RELEASE_050_PUBLISH` is complete: release commit and peeled `v0.5.0` target
`af819b4` agree; the candidate, GitHub, and npm tarballs are byte-identical;
npm reports `beta=0.5.0`, `latest=0.4.0`, and `alpha=0.1.0-alpha.2`; and
isolated public-package checks passed. At the publish snapshot, three points
remained; precedence and
heuristic resource makespans are both 3p with no resource delay, observed
velocity is `16p/1d`, both forecasts are `3/16d`, and complete NextResult v5
recommends only `RELEASE_050_ACCEPTANCE`. Git commit `94a8b62` records the
exact completed PUBLISH pre-advance snapshot, and the task is advanced to
reached `RELEASE_050_PUBLISHED`. `RELEASE_050_ACCEPTANCE` is complete after
independent Git, GitHub, npm, artifact, and installed-package verification.
All six tasks and 19p are complete at `19p/1d`; both makespans are zero, and
complete NextResult v5 has no recommendation. Git commit `bacd413` records
the exact completed acceptance pre-advance snapshot, and the plan is advanced
to reached `RELEASE_050_ACCEPTED`. The exact post-acceptance global
installation resolves to registry `perttool@0.5.0` and passed Contract 6,
Grammar 5, and history smoke checks. The user's
named release authorization applies only after every predecessor gate passes.
npm `latest` promotion and Issue #4 closure remain separate decisions.

The explicitly authorized compatible `0.5.1` patch release is tracked in
`plans/release-0.5.1.pert`. `RELEASE_051_SELF_REVIEW`,
`RELEASE_051_PREPARATION`, and `RELEASE_051_CANDIDATE` are complete and
advanced after
confirming that the additive read-only schema command, bundled Draft 2020-12
artifacts, lookup APIs, and Git 2.54 UTC `Z` fix retain existing Grammar 5,
CLI Contract 6, command descriptors, result identities, payload meanings,
and package exports. The review corrected available-Git result validation
and package wildcard-export consumption coverage. Package, lockfile, CLI,
CHANGELOG, README, release guidance, tests, goldens, and the full Node.js 22
repository and 491-file isolated-package gates identify `0.5.1`. Clean
source, channel availability, protected routes, and the retained tarball with
SHA-256 `93f3e01a...1339` passed candidate acceptance.
`RELEASE_051_PUBLISH` is complete: release commit and peeled `v0.5.1` target
`31d162a` agree; Node.js 22 and 24 CI passed; candidate, GitHub, and npm
tarballs are byte-identical; npm reports `beta=0.5.1`, unchanged
`latest=0.4.0`, and `alpha=0.1.0-alpha.2`; and isolated public-package checks
passed. `RELEASE_051_ACCEPTANCE` is complete after independent Git, GitHub,
npm, artifact, compatibility, and installed-package verification. All five
tasks and 17p are complete at `17p/1d`; both makespans are zero, and complete
NextResult v5 has no recommendation. Git commit `9ecae00` records the exact
completed acceptance pre-advance snapshot, and the plan is advanced to reached
`RELEASE_051_ACCEPTED`. The user's named
release authorization applies only after every predecessor gate passes. The
user later separately authorized one `latest` mutation; fresh registry reads
and an unqualified isolated installation confirmed `beta=latest=0.5.1`, CLI
Contract 6, Grammar 5, and all eighteen root schemas. Issue #5 closure remains
a separate decision.

The explicitly authorized compatible `0.5.2` JSON Schema patch release is
tracked in `plans/release-0.5.2.pert`. `RELEASE_052_SELF_REVIEW` is complete
after reviewing complete nested schemas, strict real-result validation,
default full lookup semantics, opt-in reference-based outline/detail views,
all 34 command descriptors, and all 116 existing runtime exports. Its
acceptance record is `docs/process/0.5.2-self-review.md`.
`RELEASE_052_PREPARATION` is complete after aligning package identity,
CHANGELOG, README, release guidance, tests, goldens, and 23-plan self-use
registration. The complete Node.js 22 gate passed 655 tests, English and
documentation checks, the temporary-link workflow, the 491-file isolated
package workflow, and npm publication normalization. After canonical advance,
`RELEASE_052_CANDIDATE` was the only recommendation and is complete after
clean Node.js 22 revalidation, absent-version/channel preflight,
protected-route verification, and isolated acceptance of the retained
491-file, 519790-byte tarball with SHA-256 `e8512f0d...54bbce`. No external
state changed during candidate acceptance. `RELEASE_052_PUBLISH` is complete:
release commit and peeled `v0.5.2` target `501d4b1` agree; Node.js 22 and 24
CI run 30517079581 passed; candidate, GitHub, and npm tarballs are
byte-identical; npm reports `beta=0.5.2`, unchanged `latest=0.5.1`, and
`alpha=0.1.0-alpha.2`; and isolated public-package checks passed.
`RELEASE_052_ACCEPTANCE` is complete after independent Git, GitHub, npm,
artifact, exact `0.5.1` compatibility, and installed full/outline/detail
verification. All five tasks and 17p are complete at `17p/1d`; both
makespans are zero, and complete NextResult v5 has no recommendation. Git
commit `3f7cc04` records the exact completed acceptance pre-advance snapshot,
and the plan is advanced to reached `RELEASE_052_ACCEPTED`. npm `latest`
promotion and Issue #5 closure remain separate decisions. After acceptance,
the user separately retired the obsolete npm `alpha` dist-tag. Registry
readback confirmed only `beta=0.5.2` and `latest=0.5.1`; historical
`0.1.0-alpha.2` remains available by exact pin.

The explicitly authorized compatible `0.5.3` governance-guidance patch is
tracked in `plans/release-0.5.3.pert`. It retains Grammar 5, CLI Contract 6,
all command, option, result, schema, and package-root identities while
publishing the beta-only channel guard and single-candidate, scope-bound,
human-readable loose owner-confirmation workflow. `RELEASE_053_SELF_REVIEW`
and `RELEASE_053_PREPARATION` are complete after the 662-test, 24-plan,
115-Markdown, temporary-link, and 491-file isolated-package gates passed.
`RELEASE_053_CANDIDATE` is complete after clean revalidation, unused-version
and channel preflight, protected-route checks, and acceptance of the retained
491-file, 520876-byte tarball. `RELEASE_053_PUBLISH` is complete: release
commit, remote main, peeled tag, GitHub prerelease, npm `beta`, and the common
tarball agree, while `latest=0.5.1` and alpha remains absent.
`RELEASE_053_ACCEPTANCE` is complete after independent Git, GitHub, npm,
artifact, and installed-package verification. All five tasks and 15p are
complete; both makespans are zero, and complete NextResult v5 has no
recommendation. Completed declarations remain in the plan until a separately
confirmed single-candidate `dag advance`. npm `latest` promotion remains a
separate decision.

The explicitly authorized compatible `0.5.4` runtime-warning patch is tracked
in `plans/release-0.5.4.pert`. Its self-review and source preparation are
complete after the 667-test, 25-plan, 119-Markdown, temporary-link, and
491-file isolated-package gates passed. Candidate acceptance repeated the
clean gates, external availability and protected-route preflight, and retained
the 521641-byte tarball with SHA-256 `d3123ef0...3c01`.
`RELEASE_054_PUBLISH` is complete: release commit `9c23510`,
peeled tag, successful Node.js 22/24 CI run `30536185188`, GitHub prerelease,
npm `beta=0.5.4`, and the common tarball agree; `latest=0.5.1` and alpha
remains absent. `RELEASE_054_ACCEPTANCE` is complete after independent Git,
GitHub, npm, artifact, installed-package, and PTGOV-103 default/strict
verification. All five tasks and 15p are complete; both makespans are zero
and complete NextResult v5 has no recommendation. The source adds the non-blocking
`PTGOV-103` warning when
a valid governance-not-applicable candidate carries a non-empty
`acceptedByOwner` set. Default write authority and every versioned result
identity remain unchanged; existing `--warnings-as-errors` prevents
persistence. This minimal runtime visibility does not add accepted scopes,
approval evidence, authentication, or cross-candidate reuse detection.
Completed declarations remain until a separately confirmed `dag advance`.
npm `latest` promotion remains a separate decision.

The explicitly authorized compatible `0.5.5` governed-preview-warning patch
is tracked in `plans/release-0.5.5.pert`. Compatibility self-review is
complete, and source preparation and candidate acceptance have passed the
complete Node.js 22 and retained-package gates. The 491-file, 522117-byte
candidate has SHA-256 `1987db1a...5452`. Durable acceptance is complete:
release commit
`04055c9`, peeled tag, Node.js 22/24 CI run `30543700217`, GitHub prerelease,
npm `beta=0.5.5`, and the common tarball agree; `latest=0.5.1` and alpha
remains absent at beta acceptance. The selected patch emits non-blocking
`PTGOV-104` when a valid applicable preview carries a non-empty
`acceptedByOwner` set. The candidate, GovernanceDecision v1, default preview,
and persistent authority remain unchanged; existing `--warnings-as-errors`
returns exit 1 while retaining the candidate and decision. All five tasks and
15p are complete with zero makespans and no recommendation. The user later
separately authorized one npm `latest` mutation and the exact displayed
advance candidate. Fresh reads and an unqualified installation confirmed
`beta=latest=0.5.5`, Contract 6, 34 commands, 18 schemas, and Grammar 5. The
governed advance used actor `codex`, owner assertion `user`, and the preview
source digest. The residual plan retains reached `RELEASE_055_ACCEPTED` and
has no diagnostics, task, recommendation, or makespan.

The explicitly selected `TIME-001` and `UNIT-001` workstream is tracked by the milestone-level `plans/scheduling-units.pert` and its milestone details. SU-M1, SU-M2, SU-M2R, SU-M3, SU-M4, and SU-M5 are complete, rolled up once, and advanced. SU-M4's final acceptance snapshot is committed at `bc75b37`; all six detail tasks and 25p are accepted at `25p/1d`. SU-M3's acceptance snapshot is committed at `9c61bac`; all six detail tasks and 23p are accepted at `23p/1d`. SU-M5's atomic Contract 4 acceptance is committed at `81b4828`; all six detail tasks and 23p are accepted at `23p/1d`, the detail is advanced to reached `CONTRACT4_ACCEPTED` at `f15a7ac`, and the macro rolled it up once and advanced to reached `SCHEDULING_UNITS_ACCEPTED` at `507fbb8`. Both plans now have zero precedence and heuristic resource makespans and no recommendation. The accepted public surface includes Grammar 1/2/3, CLI Contract 4, public result schema identities and root exports, help, Guide, installed behavior, exact unit migration, and Next v4 normal start authority.

`project show`, which returns the complete project metadata including velocity, source-preserving `project set`, and atomic-batch `project.set` are also implemented. The observed operational velocity was recalibrated to `29p/2d` from a cumulative 29p over 2 active days, including 5p on 2026-07-23.

ADR 0004 adopts English as the repository baseline. All nine tasks in `plans/english-baseline.pert` are accepted and advanced, the final cross-surface trace is recorded in `docs/process/english-baseline-acceptance.md`, and the plan has zero precedence and heuristic resource makespans, no remaining or recommended task, and an observed `42p/2d` velocity.

When meaning or design conflicts, use the following order of precedence by default.

1. Must requirements in `docs/requirements.md`
2. Normative specifications in `docs/specs/`
3. `docs/basic-design.md`
4. Normative samples in `docs/examples/`
5. Development and operational procedures in `docs/process/`
6. Current and future work state in `plans/`
7. Guidance in `README.md`

Do not conceal an inconsistency by changing only a lower-precedence document. For a requirements change, update the affected specifications, design, samples, tests, and help in the same logical change. Do not restore past plans or completion states to current documents; refer to Git history instead.

## Project map

- `docs/requirements.md`: product requirements and MVP boundary.
- `docs/basic-design.md`: architecture, module boundaries, and implementation slices.
- `docs/specs/`: normative specifications for grammar, graph semantics, analysis, mutation, interfaces, and the accepted project-actuals/history target.
- `docs/adr/`: adopted architecture and runtime decisions.
- `docs/examples/`: normative parser and analysis samples.
- `docs/process/`: operating procedures for self-use and AI development.
- `plans/`: current and future work for perttool. Use `mvp.pert` as the completed macro roadmap through the first beta; use `grammar.pert`, `control-plane.pert`, `operations.pert`, `recommendation.pert`, `agent-guidance.pert`, and `governance.pert` as Stage 3 preview-first detail plans; use `english-baseline.pert`, `cli-surface-reset.pert`, `project-actuals.pert`, `plan-assurance.pert`, `help-guide-consistency.pert`, `adapter-platform.pert`, `historical-dag.pert`, `milestone-acceptance.pert`, `advance-history-safety.pert`, `advance-clean-candidate.pert`, and `release-0.2.0.pert` through `release-0.9.0.pert` as independent post-beta workstreams; and use `scheduling-units.pert` plus completed `scheduling-units-m1.pert` through `scheduling-units-m5.pert` as the accepted milestone/detail records for `TIME-001` and `UNIT-001`.
- `scripts/`: repository-local verification commands, including the shared disposable tracked-repository executor for repository-clean advance acceptance, isolated-package inventory checks for internal assurance compatibility and inspection modules, and isolated LSP/MCP/VSIX gates.
- `.github/workflows/`: CI using the same entry points as local verification.
- `src/`: TypeScript parser, validator, Core API, CLI, and help implementations.
- `src/actuals/`: active Grammar 5 source projection, Node-backed deterministic event identity and request normalization, and separately owned pure exact lifecycle reduction, measurements, and stored-state validation for task-owned work-event records.
- `src/assurance/`: active ASSURE-001 Grammar 6 source projection, model-1 canonical JSON and SHA-256 commitments, projected planning dependencies, frontier receipt self-hashes, full topological evaluation, outcome commitments, cause paths, fail-closed assurance states, preview-first assurance mutations, GovernanceDecision v2, impact composition, active attention, required actions, assurance-filtered new-start authority, assurance-preserving advance contraction, compatibility source capture and project metadata, direct-edit guidance, and semantic Mermaid profile 2; lower-level target-capability helpers remain internal.
- `src/command/`: immutable typed Contract 8 command descriptors, shared-option expansion, dispatch lookup, deterministic text/JSON help projections, and structured usage-error recovery.
- `src/core/`: additive platform-neutral `perttool/core` entrypoint and the retained portable Grammar 6 parse/validate/format facade; its current exact 45-name runtime catalog has no Node, Application, CLI, I/O, history, schema-loader, or adapter dependency.
- `src/editor/`: portable complete editor-semantic fingerprint ownership for exact E0 equivalence, distinct from source and plan-assurance hashes.
- `src/help/`: the structured domain HelpNode registry, retained Core help data, and the active Contract 8 editing, actuals, plan-assurance, historical-DAG, and milestone-acceptance Guide.
- `src/analysis/`: neutral base analysis service and target temporal input projection; residual graph, precedence CPM, resource-schedule implementations, internal release-aware temporal precedence and resource schedulers, and exact deadline evaluation using Rational values.
- `src/recommendation/`: pure Core that derives candidate facts, complete order, selection horizon, joint-feasible recommended sets, tiers, a typed explanation graph, PTREC invariants, JSON projections, read-only override validation, and canonical artifacts from actual ready tasks.
- `src/schema/`: closed Contract 8 result-schema catalog, local bundled-artifact resolution, `Perttool.SchemaResult.v1`, and deterministic JSON/text projections.
- `src/session/`: protocol-neutral immutable document snapshots, exact UTF-16 conversion and ordered incremental changes, URI/generation/version/digest binding, validated-snapshot analysis, complete semantic fingerprints, fail-closed idempotent E0 format projection, snapshot-scoped completed projection caches, and cancellation/stale/desynchronization handling exposed only through `perttool/core`.
- `schemas/`: twenty-three bundled Draft 2020-12 root artifacts for every active command result and the public OverrideDecision result, plus shared local definitions.
- `src/conversion/`: Mermaid profile/plain export and import, semantic metadata, projection generation, and fail-closed restoration.
- `src/editing/`: deterministic unified diff shared by formatter and mutation.
- `src/formatter/`: the active Grammar 1/2/3/4/5/6 source-preserving formatter Core; exact values use canonical Decimal-or-Fraction serialization.
- `src/guidance/`: read-only pure Core that provides versioned offline AI Agent Guidance profiles, validation, queries, index/quick/detail projections, and deterministic JSON/text.
- `src/governance/`: Grammar 4/5 declared/effective governance metadata, the exact generated direct-edit warning, and one pure actual-change classifier, caller-assertion normalizer, pre-change authority evaluator, and PTGOV diagnostic projection used by the active Contract 6 package surface.
- `src/history/`: active read-only Git probe, validated-snapshot-injected pure semantic reducer, and pure velocity observation Core for SHA-1/SHA-256 repository/path/revision binding, first-parent raw snapshots, declared-event deduplication/removal, qualified legacy transitions, exact task summaries and rates, typed availability, linked worktrees, and race detection; the model-1 whole-document historical transition projection, source-fidelity separation, adjacent classification, and deterministic occurrence/value/topology epochs; the bounded endpoint/lower-boundary first-parent commit/parent/blob/raw-source evidence probe with opaque repository/read-snapshot identity, exact input limits, shallow completeness, and race refusal; the pure checkpoint, selected-snapshot, continuity, frozen-evidence, proved-lineage, timeline, canonical-advance-proof, immutable-source-binding, and fail-closed output-limit reconstruction consumed by the active historical CLI; plus the active ADV-001 current-HEAD/stage-0 capture, destructive-range assessment, and pre-write baseline recheck with internal Grammar 6 history and assurance-record inventory extensions.
- `src/io/`: raw-byte document reads, digests, symlink/race rejection, atomic safe-write mechanics, guarded existing-document output creation, and separate internal Grammar 2/3/4/5/6 target-validation adapters.
- `src/migration/`: exact unit-migration request validation, velocity selection, stable causes, complete Duration inventory, preserved-temporal snapshots, exact Rational conversion records, canonical target tokens, and exact-Duration grammar selection, compatibility, reversibility, localized version-upgrade inputs, and internal retained Grammar 6 migration support.
- `src/model/`: shared syntax/CST records, diagnostics, exact Rational arithmetic, units, internal declared calendar values plus exact Gregorian/fixed-offset comparison and projection, additive exact Duration Fraction values, and exact Decimal-or-Fraction source serialization.
- `src/ports/`: inward-owned type-only contracts for exact digesting, raw document and artifact bytes, read-only Git evidence, established safe persistence, and bounded process context.
- `src/node/`: additive `perttool/node` entrypoint, default public Node Host composition, and private historical Git-evidence CLI composition; root and Node expose the same 129 runtime values with exact key and reference identity while Core remains portable.
- `src/milestone-acceptance/`: Grammar 7 source, migration, pure evaluator, governed criterion and receipt mutation, and acceptance-aware canonical advance composition.
- `src/parser/`: the active Grammar 1/2/3/4/5/6 parser with identity-checked task-owned work-event and plan-assurance source.
- `src/semantic/`: neutral document-check service; active Grammar 1/2/3/4/5/6 validated-document boundaries, task-owned event and assurance validation, exact cross-form Duration constraints, temporal-anchor validation, and duplicate-principal validation.
- `src/mutation/`: neutral base and target mutation planners; active Grammar 1/2/3/4/5 requests for project/task/gate/milestone/resource, lifecycle, and atomic batch; governance project fields; exact changed-field Duration generation; canonical advance, task-owned event removal, and the narrow shared terminal-separator deletion planner; source-preserving UTF-16 TextEdit generation; and application rules.
- `src/application/`: exact compatibility re-exports for neutral check, analyze, mutation, target-mutation, and temporal-input implementations; the private CLI Application facade with injected Node Host ports; retained Contract 7 services plus active Contract 8 Grammar 7 preparation, milestone acceptance, `AnalysisResult.v6`, `NextResult.v7`, `MutationResult.v5`, and `AdvanceResult.v3` composition; project metadata, lifecycle, project history, historical DAG, observation, exact unit migration, assurance mutation and inspection, independent acceptance/assurance/history guards, and authorization-before-safe-write orchestration.
- `adapters/lsp/`: private Node.js 22 language-server workspace with stable LSP 3.17.5 local-stdio composition, exact document-session synchronization, model-1 read-only fallback, opt-in model-2 standard whole-document E0 formatting, negotiated Help and current GraphView wire results, separately negotiated historical GraphView/source results, a bundled private historical Application/Git-read composition, and no public-package inclusion.
- `adapters/vscode/`: private VS Code `^1.101.0` Node workspace extension with presentation-only TextMate grammar, exact language client, closed version-bound virtual Help, offline bundled server, untrusted/virtual current-workspace support, a restrictive read-only current/historical DAG Webview, trusted local historical controls, and verified immutable `perttool-history` source documents without public publication identity.
- `adapters/mcp/`: private Node.js 22 MCP workspace with exact server SDK 2.0.0, modern-only 2026-07-28 local stdio, strict malformed-line fail-closure, four immutable resources, five fail-closed read-only tools, digest-bound inline or launcher-registered sources, self-contained output schemas, isolated two-client/no-write package acceptance, and no public-package inclusion.
- `test/`: fixtures for the Node.js built-in test runner; analysis/next/formatter/mutation/conversion/write-safety and target-governance Core unit tests; and CLI integration/E2E tests.
- `package.json`: Node.js 22 or later, npm scripts, and binary/library entrypoints.

When adding an implementation, update this map to match its actual directories and commands.

## Work start and task selection

Before a non-trivial change, briefly confirm the following.

1. current branch, HEAD, and worktree state
2. the user's goal and the scope of this change
3. the normative documents read and the validity of inherited assumptions
4. acceptance criteria and explicit non-goals
5. verification to run and planned external side effects

For metadata such as Project ID, as_of, duration_unit, velocity, and finish, normally use `project show --format json` rather than inspecting the source file directly. Apply changes through `project set` preview/diff and the Stage 3 safe-write procedure, not by manual editing.

Treat `--accepted-by-owner` as a single-candidate, scope-bound caller assertion, never as workstream or session authority. Start each candidate with an assertion-free preview. If governance is not applicable, persist without the assertion. `PTGOV-103` warns about an assertion on a not-applicable candidate, and `PTGOV-104` warns about one on a governed preview. If a non-direct governed write needs confirmation, present the operation, target, affected scopes, required owners, available modification time, byte size before and after, diff counts, and semantic candidate summary. Keep source and candidate digests as supplemental machine identity rather than the primary human explanation. Use the assertion only when the current user instruction explicitly covers that mutation. Do not copy it to later maintenance, a changed candidate, or the next `dag advance`, and do not chain preview and confirmation-dependent write without a user-response boundary. Follow `docs/process/governance-assertion-scope-experiment.md`.

When the user asks for the “next task,” first present candidates based on recommended specification work in `docs/requirements.md`, unresolved matters, and the current Git state. From self-use Stage 1 onward, use the macro recommendation in `mvp.pert` to choose a workstream, then reanalyze the corresponding detail plan and choose a task from its detail recommendation. Base candidate selection on the `check`, `analyze`, and `next --format json` results for both the macro plan and the target detail plan; do not directly compare tasks from different detail plans without a macro decision.

For the explicitly selected scheduling-and-units workstream, use `scheduling-units.pert` as its macro authority and the current `scheduling-units-m*.pert` as its detail authority. When a detail finish is reached, roll it up once to the matching macro work package, re-estimate later provisional packages, and create only the next milestone-detail plan from accepted semantics.

For normal task selection, use only a known `Perttool.NextResult.v7`, recommendation interface 1, ranking algorithm 1, reason taxonomy 1.0, explanation/expression/description model 1, locale `en`, authority policy `recommendation_v1_plus_release_gate_plus_plan_assurance_v1`, complete assurance authority, complete milestone-acceptance projection, and a complete, non-truncated trace. Start only tasks listed in `startable_recommended_task_ids`. You may choose a subset of that set, or retain the complete startable set with exactly one additional resource-feasible, time-eligible, assurance-eligible `allowed` task. Do not start for an unknown version or authority policy, incomplete trace, `PTREC-*`, assurance safe stop, future or unavailable release eligibility, withheld assurance eligibility, unavailable milestone acceptance, or a `deferred`/`discouraged` selection; stop safely. Reanalyze rather than reusing the same result after task start, completion, blocking, time, capacity, plan, relation, outcome, assurance, or acceptance changes. Do not apply a selection requiring a human override until MIG-08; report its difference from the normal recommendation and the still-unavailable audit/apply boundary.

For changes affecting correctness, proceed in the order of requirements/specification, design, implementation, and verification by default. If an implementation reveals a gap in a specification, do not encode an assumption only in code; update the applicable normative document first or in the same change.

## Domain invariants

- Use Activity-on-Arrow: a task is an edge, a milestone is a node, and a gate is a zero-duration dependency edge.
- A resource requirement is not a dependency edge. Do not automatically convert shared resources into ordering in the normative DAG.
- Distinguish the precedence critical path from the schedule critical path in a resource-constrained schedule.
- Do not present a heuristic resource-schedule result as an exact optimum.
- Return the same analysis result for the same input, options, and algorithm version.
- Do not use binary floating point as the source of truth for duration and PERT calculations.
- `.pert` represents the present and future; track the past through Git history.
- Do not use incomplete perttool as the writer of record before meeting the gates in `docs/process/self-use.md`.

## Validation

Run the repository checks from the root with Node.js 22 or later. CI verifies Node.js 22 and 24. Root `build` and `typecheck` include every private adapter workspace while the public package check excludes `adapters/` from the tarball. `npm run check` includes check/analyze/next validation for all forty self-use plans, including the selected editor-mutations workstream, the `0.9.1` patch, milestone acceptance, the accepted `0.9.0` and `0.8.0` releases, historical-DAG and adapter-platform workstreams, `0.7.1` patch, help-guide consistency, plan-assurance, the accepted `0.7.0` and `0.6.0` releases, repository-clean advance correction, advance-history safety, the accepted `0.5.5` and completed `0.5.4`, `0.5.3`, `0.5.2`, `0.5.1`, and `0.5.0` release plans, project-actuals, owner-aware governance, scheduling-and-units macro, SU-M1/SU-M2/SU-M2R/SU-M3/SU-M4/SU-M5 detail, `0.3.0`, and `0.4.0` plans.

```sh
npm ci
npm run check
git diff --check
```

For narrow checks, use `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run check:english`, `npm run check:docs`, `npm run check:lsp-package`, `npm run check:mcp-package`, `npm run check:vsix-shell`, `npm run check:link`, and `npm run check:package`. `check:english` scans tracked and non-ignored untracked text files and permits Japanese-script content only through the exact versioned allowlist. `check:lsp-package` packs the private language server and root Core separately, installs both into a disposable prefix, and exercises exact stdio initialization, diagnostics, GraphView, shutdown, and exit without publishing either artifact. `check:mcp-package` packs and installs the private MCP server beside the exact root package, exercises strict modern stdio, discovery, registered source/digest handling, errors, two-client parity, and no-write identity in a disposable prefix, and publishes nothing. `check:vsix-shell` builds and packages the private eighteen-file offline VSIX, exercises the bundled server and DAG assets, and uses exact `@vscode/test-electron` `3.1.0` to install, activate, replace, and uninstall it in disposable trusted and untrusted VS Code `1.101.0` profiles. It keeps the host cache outside the repository by default and does not install globally or publish. `check:link` links into a temporary user prefix to inspect the CLI and does not change the real user prefix. `check:package` creates a release tarball in a temporary directory; checks exclusion of repository-only files and npm publish normalization dry-run; installs into an isolated prefix; and runs the complete installed-package file-first workflow. `bash scripts/check-docs.sh` is the documentation-only lower-level entry point.

- Even for documentation-only changes, run bootstrap checks for the local link, Markdown fences, and normative `.pert` samples.
- For grammar changes, check valid/invalid examples, field tables, EBNF, diagnostics, and formatter contracts together.
- For analysis changes, use a small golden graph and verify precedence results and resource-schedule results separately.
- After adding an implementation, run existing narrow tests first and progress to the broader suite only if shared core is touched.
- Do not report tests not run as successful. State failures or environment deficiencies together with their commands.
- The package/runtime baseline is defined by `docs/adr/0005-node-22-runtime-baseline.md`. When commands change, update this section, `docs/process/ai-development.md`, and CI in the same logical change.

## Review and durable guidance

Before committing, inspect the intended diff by file or hunk and look for bugs, regressions, specification inconsistencies, and missing tests before writing a summary. If a superficial symptom fix leaves the same cause, confirm the control path and root cause before fixing it. Mark temporary workarounds as temporary and retain remaining work in the normative backlog or plan.

Do not leave reusable lessons only in chat; reflect them in `AGENTS.md`, the applicable specification, tests, or process documentation. When changing shared policy in `AGENTS.md` and `.github/copilot-instructions.md`, verify both remain aligned in the same commit.

## AI tool compatibility

- Treat `AGENTS.md` as the source of truth for shared policy for Codex and other coding agents.
- Ensure GitHub Copilot can reach the same mandatory policy from `.github/copilot-instructions.md`.
- Put project-local Codex defaults in `.codex/config.toml`; do not copy global configuration into the repository.
- Add custom agents or skills only after a recurring, clear role and verifiable exit criteria arise.
- Use sub-agents, delegation, or parallel agent work only when the user explicitly requests it or an active runtime policy explicitly permits it.

## Git and remote operations

- Check `git status --short --branch` at the start of work and before staging.
- Preserve the user's uncommitted changes and explicitly stage only files within this task's scope.
- Make each commit one coherent change with a concise imperative subject.
- Check remote configuration before pushing. For this repository, use `secdat exec git push ...` for remote writes and `secdat exec gh ...` for GitHub operations.
- npm publish must satisfy the beta release gate and send the explicit GitHub Release tarball to the `beta` dist-tag. The retired `alpha` channel must not be recreated without a new release-policy decision and separate authorization. Beta publication does not itself change `latest`. A later `latest` promotion is a separate dist-tag mutation requiring an explicit user-selected version and permission. Inject `NPM_TOKEN` only into that process through `secdat`.
- Do not run destructive operations such as `git reset --hard`, `git clean`, force-push, or shared-history rewrites without explicit approval that identifies the target and impact.
- Do not commit secrets, credentials, local caches, or generated reports.

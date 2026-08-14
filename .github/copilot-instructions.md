# Repository Instructions

Treat `AGENTS.md` as the source of truth for repository guidance shared by Codex and GitHub Copilot. When changing durable workflows or project rules, verify this file remains aligned in the same commit.

Mandatory summary:

- English is the canonical language for tracked repository artifacts. Respond to the user in Japanese unless requested otherwise. Preserve user-authored Unicode content, and do not introduce runtime i18n or locale negotiation.
- The current published beta is `perttool@0.9.4`; npm reports
  `beta=0.9.4`, `latest=0.9.0`, and no `alpha`. Version `0.9.4` is the
  compatible Issue #19 emergency patch; peeled `v0.9.4` and `origin/main`
  agree at `094132c`, CI passed, the GitHub and npm artifacts agree at
  SHA-256 `63a12ddf...d6fe53b`, and Issue #19 is closed with release evidence.
  Version `0.9.3` remains the exact rollback pin, `0.9.2` remains its preceding
  emergency rollback pin, version `0.9.0` remains the suffix-free Grammar 7
  and CLI Contract 8 rollback pin, and version `0.8.1` remains the compatible
  Grammar 6 and CLI Contract 7 rollback pin.
- The current source atomically activates Grammar 7 and CLI
  Contract 8 with 53 commands, 23 root schemas, 129 root and Node exports,
  and `Perttool.NextResult.v7`. All milestone-acceptance work is complete and
  canonically advanced; the residual plan has no diagnostic, task,
  recommendation, or startable task. The selected `plans/release-0.9.0.pert`
  workstream completed local gates, candidate acceptance, PUBLISH, and durable
  acceptance. Release commit and peeled `v0.9.0` target `3aca4f0`; CI passed;
  GitHub and npm match the retained candidate at SHA-256
  `88e51bfe...37345e7`. The accepted record was pushed, npm now reports
  `beta=latest=0.9.0` with no `alpha`, and Issues #10 and #11 are closed with
  release evidence. The Grammar 6 plan was migrated and given six accepted
  artifact criteria before history- and acceptance-guarded canonical advance.
  Residual Grammar 7 digest `sha256:59b5fbbe...d4e71a` retains only accepted
  reached milestone `RELEASE_090_ACCEPTED`, has zero tasks and makespans, no
  diagnostic, and no ready, recommended, or startable task. Public VSIX
  publication and unrelated work remain separate.
- The selected `plans/release-0.9.1.pert` workstream publishes the compatible
  ACT-003 / Issue #8 current-velocity observation correction. Its
  compatibility review, source preparation, and immutable candidate
  acceptance and beta publication are complete and identify
  `0.9.1`; Grammar 7, Contract 8, 53 commands, 23 schemas, 129 root/Node
  exports, 45 Core exports, result/schema identities, and authority remain
  unchanged. Release commit and peeled `v0.9.1` target `ddb12dc`; CI run
  `31684442125` passed; GitHub and npm beta use the exact accepted tarball.
  Durable public, installed, and Issue #8 acceptance is complete; Issue #8 is
  closed with the `bug` label retained. All five tasks are complete and no
  task is startable. npm `latest=0.9.0`, plan advance, public VSIX publication,
  and unrelated work remain separate.
- The accepted `plans/release-0.9.2.pert` emergency patch keeps valid Point
  plans without declared velocity Point-valued through analysis and Next,
  leaves velocity forecasts null, and reports calendar conversion as
  unavailable. Release commit and peeled `v0.9.2` target `b47a0a4`; CI,
  GitHub, npm beta, and the retained candidate agree; Issue #15 is closed.
  Grammar 7, Contract 8, public identities, npm `latest`, plan advance, public
  VSIX publication, and unrelated work remain unchanged and separate.
- The `plans/release-0.9.3.pert` workstream published and durably accepted the
  compatible Contract 8 emergency corrections for Issues #14, #16, and #17.
  Grammar 7 assurance inspection and acceptance-aware advance composition are restored
  without changing Grammar 7, Contract 8, 53 commands, 23 schemas, 129
  root/Node exports, 45 Core exports, shared TextEdit strictness, or any
  acceptance, assurance, history, governance, and persistence authority.
  Release commit and peeled tag `7755d3e`, Node.js 22/24 CI, GitHub, npm, and
  the common SHA-256 `a86c552b...bcad9708` agree. Exact/beta installation,
  `0.9.2` rollback, and all three public replays passed. All six tasks are
  complete before advance. npm `latest`, plan advance, public VSIX
  publication, and unrelated work remain separate.
- The `plans/release-0.9.4.pert` workstream published and durably accepted the
  compatible Issue #19 retained-milestone criterion correction. It also adds
  pinned jscpd and Lizard repository/CI ratchets without changing Grammar 7,
  Contract 8, 53 commands, 23 schemas, 129 root/Node exports, 45 Core exports,
  authority, or force semantics. All six tasks completed before committed
  milestone evidence and history- and acceptance-guarded canonical advance.
  The residual plan retains only accepted reached `RELEASE_094_ACCEPTED` with
  no diagnostic or task. npm `latest`, public VSIX publication, and unrelated
  work remain separate.
- Install the exact Python tools from `requirements-static-analysis.txt` before
  the complete repository gate. `npm run check:static` composes TypeScript
  type checking with pinned jscpd duplicate and Lizard complexity ratchets;
  `npm run check` includes that gate and all repository acceptance checks.
- ADR 0004 is accepted across all canonical surfaces. All nine tasks in `plans/english-baseline.pert` are complete and advanced, Git commit `2001cdf` records the final-task pre-advance snapshot, `docs/process/english-baseline-acceptance.md` records the final trace and exact Japanese-script allowlist boundary, and complete NextResult v5 has no ready, recommended, or startable task.
- The selected independent `plans/advance-history-safety.pert` workstream
  tracks `ADV-001`. `ADV_HISTORY_CONTRACT` is complete, Git commit `2c08618`
  records its exact pre-advance snapshot, and the task is advanced to reached
  `ADV_HISTORY_CONTRACT_ACCEPTED`. The accepted
  `docs/specs/advance-history-safety.md` fixes model 1 destructive records,
  exact raw-byte `HEAD` and stage-0 index proof, retained-dirty behavior,
  linked-worktree and complete repository-baseline race boundaries, the narrow
  `--force-history-loss` target, `Perttool.AdvanceResult.v1`, `PTADV-101`
  through `PTADV-103`, human-readable modification time, byte-size and diff
  context, and eighteen machine cases. The exact pinned 0.5.5 artifact remains
  unchanged; the later 0.6.0 release is recorded below.
  `ADV_HISTORY_PROBE` is complete and advanced; Git commit `4265621` records
  its exact completed 4p pre-advance snapshot. Its internal read-only baseline
  capture and pure assessment pass the complete repository gate.
  `ADV_HISTORY_CLI` is complete; commit `805bdd9` records its exact
  pre-advance snapshot, and commit `5986cab` advances the plan to reached
  `ADV_HISTORY_CLI_READY`. Current source exposes `--force-history-loss`,
  `Perttool.AdvanceResult.v1`, the complete nineteenth root schema,
  human-readable guard facts, PTADV-101 through PTADV-103, and pre-write
  repository/path/HEAD/stage-0 enforcement while keeping preview, out, no-op,
  governance denial, and warning denial free of Git inspection.
  `ADV_HISTORY_ACCEPTANCE` is complete; commit `aa401e4` records its exact
  final-task pre-advance snapshot, and commit `7b07bb8` advances the plan to
  reached `ADV_HISTORY_ACCEPTED`. Its eighteen-case repository, real CLI race,
  linked-worktree, encoding, help, Guide, schema, temporary-link, package, and
  installed trace is recorded in
  `docs/process/advance-history-acceptance.md`. All four tasks and 14p are
  complete and advanced with zero makespans and no recommendation. The exact
  pinned 0.5.5 artifact remains unchanged; the later 0.6.0 release is recorded
  below.
- The selected independent `plans/advance-clean-candidate.pert` workstream
  tracks the post-acceptance `ADV-002` correction.
  All three tasks through `ADV_CLEAN_CANDIDATE_ACCEPTANCE` are complete and
  retained before advance. The
  accepted target defines a maximal terminal removed-declaration suffix,
  narrow advance-owned blank-line separator prefixes, identical edit and
  destructive-record ranges, exact HEAD and stage-0 proof over those prefixes,
  and one byte-identical preview, separate-output, and in-place candidate. The
  eight cases are in
  `test/fixtures/advance-clean-candidate-contract-v1.json`, with acceptance in
  `docs/process/advance-clean-candidate-contract-acceptance.md`. The shared
  planner now gives candidate edits and destructive records identical terminal
  deletion ranges, removes the eventful trailing blank line, and maps the
  exact current prefix into `HEAD`; bounded evidence is in
  `docs/process/advance-clean-candidate-core-acceptance.md`. Real tracked CLI,
  preview/output/write identity, `git diff --check`, temporary link, installed
  package, and the corrected ADV-001 trace are accepted in
  `docs/process/advance-clean-candidate-acceptance.md`. The plan has zero
  precedence and heuristic resource makespans, and complete NextResult v5 has
  no ready, recommended, or startable task. Do not globally trim or invoke the
  formatter. The later release remained separately gated and is recorded
  below; plan advance and dist-tag movement remain separate.
- The explicitly authorized `plans/release-0.6.0.pert` workstream publishes
  ADV-001 and ADV-002 as the advance-history-safety beta minor. The exact
  5,289-byte initial goal/DAG candidate was confirmed and written once with
  actor `codex` and owner assertion `user`. `RELEASE_060_SELF_REVIEW` is
  complete after a direct Node.js 22 installed-`0.5.5` comparison confirmed
  retained Grammar 5, CLI Contract 6, and prior advance JSON keys, plus the
  deliberate `AdvanceResult.v1`, required nullable `history_guard`, nineteenth
  root schema, and exact force option boundary. `RELEASE_060_PREPARATION` is
  complete after the 712-test, 29-plan, 138-Markdown, temporary-link, and
  504-file isolated-package gates passed under Node.js 22.
  `RELEASE_060_CANDIDATE` is complete after clean source and protected-route
  preflight accepted the retained 504-file, 543508-byte tarball with SHA-256
  `6d03e270...e42acd`. `RELEASE_060_PUBLISH` is complete: release commit
  `935b097`, peeled tag, successful Node.js 22/24 CI run `30631050662`, GitHub
  prerelease, npm `beta=0.6.0`, and the common tarball agree. Complete
  independent acceptance covered Git, CI, GitHub, npm, artifact identity,
  installed packages, and the repository-clean history guard. All five tasks
  and 17p are complete with zero makespans and no recommendation. npm
  `latest=0.5.5` and no alpha remain unchanged. npm `latest`, plan advance,
  and Issue mutation remain separate.
- The explicitly selected `plans/plan-assurance.pert` workstream tracks
  `ASSURE-001`. The confirmed 9,698-byte initial goal/DAG candidate was written
  once with actor `codex` and owner assertion `user`; a later accepted DAG-only
  amendment adds pinpoint hash inspection. Its ten tasks total 59p.
  `ASSURE_INTERFACE_CONTRACT` is complete with the Grammar 6/CLI Contract 7
  interface and six fixed SHA-256 vectors. `ASSURE_HASH_CORE` is complete with
  the internal pure `src/assurance/` canonical hash, dependency, state, outcome,
  and cause-path evaluator. `ASSURE_SOURCE_CORE` is complete with the internal
  identity-checked Grammar 6 parser, validator, formatter, semantic projection,
  source spans, and receipt self-hash boundary. `ASSURE_MUTATION_CORE` is
  complete with internal relation, seal, reseal, outcome, mixed-batch,
  GovernanceDecision v2, impact, and digest-bound Grammar 6 safe-write
  behavior. `ASSURE_AUTHORITY_CORE` is complete with internal assurance-aware
  check, analysis, Next, mutation-impact, active-attention, required-action,
  and fail-closed new-start authority composition. `ASSURE_ADVANCE_CONTRACTION`
  is complete with internal receipt contraction and pruning, retained-basis
  equality, Grammar 6 history provenance, and independent history-force
  composition. `ASSURE_COMPATIBILITY` is complete with internal Grammar 6
  formatting, version-preserving unit migration, project metadata,
  actuals-only history, semantic Mermaid profile 2, strict loss reporting,
  mixed-batch preservation, package-inventory enforcement, and direct-edit
  guidance. `ASSURE_HASH_INSPECTION` is complete with a source-bound
  PlanAssuranceResult v1 projection, evaluator-ordered task filtering, explicit
  contract/computed-basis/exported selectors, exact scalar digest text, and
  fail-closed unavailable handling. `ASSURE_PUBLIC_CONTRACT` is complete after
  atomically activating Grammar 6, CLI Contract 7, 44 commands, 20 root
  schemas, the public package root, and the installed-package workflow. Its
  accepted gate is recorded in
  `docs/process/plan-assurance-public-contract-acceptance.md`.
  `ASSURE_ACCEPTANCE` is complete after tracing all fourteen semantic and
  twelve interface cases through the Core, public CLI, real output race,
  schemas, help, temporary link, and isolated package. Its accepted gate is
  recorded in `docs/process/plan-assurance-acceptance.md`. All ten tasks and
  59p are complete and remain in their exact pre-advance state; precedence and
  heuristic resource makespans are zero, and complete NextResult v6 has no
  ready, recommended, or startable task. Published package 0.6.0, plan advance,
  and every external mutation remain unchanged.
- The selected `plans/release-0.7.0.pert` workstream sequences six serial tasks
  and 21p for the first Grammar 6 and CLI Contract 7 conditional-plan-assurance
  beta. The initial 2026-08-04 instruction authorized local gate design, and a
  later instruction separately authorized Contract 7 readiness; the next
  instruction separately authorized source preparation; subsequent
  instructions authorized candidate acceptance and PUBLISH. The user then
  separately authorized the exact `0.7.0` npm `latest` promotion, and the
  following instruction authorized the narrow acceptance-condition replan and
  durable acceptance. The gate
  selects suffix-free `0.7.0`, records the read-only `beta=latest=0.6.0` and
  absent-alpha baseline. `RELEASE_070_GATE_DESIGN`,
  `RELEASE_070_CONTRACT_7_READINESS`, and `RELEASE_070_PREPARATION` are complete
  before advance. The prepared package and CLI identity is `0.7.0`, its record
  is `docs/process/0.7.0-preparation.md`. `RELEASE_070_CANDIDATE` is complete
  and accepted after final review rejected the preliminary SHA-256
  `7e57cc89...3ac8a0` tarball because its bundled README retained a transient
  preparation-time claim; the intact bytes remain under a SHA-bound rejected
  filename. Corrected clean source commit `51984c8` passed the repeated
  complete Node.js 22 and read-only external gates. Its retained 601-file,
  656702-byte candidate has SHA-256 `8585adb5...f4d623` and passed isolated
  Contract 7 file-first and plan-assurance acceptance. The user later
  separately authorized PUBLISH from that unchanged candidate. Release commit
  and peeled `v0.7.0` target `1279e3c` agree; Node.js 22 and 24 CI run
  `30895944899` passed; the GitHub prerelease, npm `beta=0.7.0`, and the same
  601-file tarball agree at SHA-256 `8585adb5...f4d623`; at publication,
  `latest=0.6.0` and `alpha` remained absent. Exactly one separately authorized
  post-publication mutation later made `beta=latest=0.7.0`; an unqualified
  isolated installation confirmed Contract 7, 44 commands, and 20 schemas.
  Independent Git, CI, GitHub, npm, byte-identity, exact/beta/latest
  installation, rollback-pin, and complete public-package verification passed.
  All six tasks and 21p are complete with zero makespans, and fresh complete
  NextResult v6 has no ready, recommended, or startable task. The acceptance
  record is `docs/process/0.7.0-release-acceptance.md`; both plan advances and
  Issue mutation remain separate.
- The selected `plans/help-guide-consistency.pert` workstream tracks
  `GUIDE-CONSISTENCY-001`. Its accepted
  `docs/specs/help-guide-consistency.md` target fixes exact active Guide
  identities and additive version history, argument-valid examples for all 44
  commands, repository-wide literal diagnostic-link closure, current and
  historical documentation labels, `PTCNV-210` coverage, and bounded
  reciprocal plan-assurance navigation. The active Guide now states
  AnalysisResult v5, NextResult v6, and
  `recommendation_v1_plus_release_gate_plus_plan_assurance_v1` directly; all
  eight assurance-mutation examples pass argument parsing, and every literal
  runtime diagnostic topic resolves. All four tasks and 14p are complete and
  retained before advance with zero makespans and no startable recommendation.
  Acceptance is recorded in
  `docs/process/help-guide-consistency-acceptance.md`; release, remote writes,
  publication, Issue mutation, and plan advance remain separate.
- The selected `plans/adapter-platform.pert` `ADAPTER-001` workstream has 16
  tasks and 91p covering the shared dependency contract, Core decoupling,
  library and Node-port boundaries, CLI parity, document session, read-only
  LSP, VSIX and DAG Webview, read-only MCP, and integrated acceptance.
  `ADAPTER_ARCHITECTURE_CONTRACT`, `CORE_DEPENDENCY_CLEANUP`,
  `SHARED_LIBRARY_BOUNDARY`, `EDITOR_PROTOCOL_CONTRACT`,
  `DOCUMENT_SESSION_CORE`, `LSP_READ_CORE`, `LSP_ACCEPTANCE`, `VSIX_SHELL`,
  `VSIX_DAG_VIEW`, `NODE_PORT_BOUNDARY`, `CLI_FACADE_PARITY`,
  `MCP_READ_CONTRACT`, `MCP_READ_ADAPTER`, and `MCP_ACCEPTANCE` are complete
  and retained before advance. Their
  accepted specifications and records fix
  the 121-export, 44-command, 20-schema, zero-production-dependency baseline;
  exact twelve-file/nineteen-import migration input; layer and distribution
  boundaries; result and capability ownership; semantic parity; five neutral
  implementation owners with exact Application facades; analyzer and override
  dependency inversion; zero reusable-module imports into Application; a
  closed forty-name platform-neutral Core runtime; an exact 121-name Node
  facade; root-identical Grammar 6 source functions; and isolated-package
  subpath consumption; stable LSP 3.17; exact URI/generation/version and
  UTF-16 behavior; cancellation and stale rejection; the closed read-only
  capability set; `Perttool.GraphViewResult.v1`; four DAG modes; VS Code
  `^1.101.0`; offline server distribution; workspace trust; restrictive CSP;
  and accessibility; five Core-only document snapshot, session, analysis, and
  UTF-16 functions; an exact current 45-name, 36-module portable Core closure;
  immutable source bindings; atomic changes; completed projection caching;
  cancellation/stale rejection; and six closed type-only Node Host ports with
  one default Node composition. Root and Node now remain exact 122-name
  facades while Core remains an exact 45-name portable runtime. Its
  private `adapters/lsp` workspace pins stable LSP 3.17.5, provides the closed
  local-stdio read-only and negotiated Help/GraphView surfaces, remains
  excluded from the public package, and passes its isolated dual-tarball
  Node.js 22 gate. The private `adapters/vscode` workspace fixes VS Code
  `^1.101.0`, exact language client 9.0.1, lazy `.pert`/Help activation,
  TextMate presentation, untrusted/virtual workspace support, closed virtual
  Help, and an offline bundled server. Its current fourteen-file private VSIX
  adds the `perttool.dag` Webview, four exact GraphView modes, closed
  version-bound messages, binding-checked source navigation, restrictive CSP,
  deterministic SVG presentation, and an accessible exact-value outline; its
  record is `docs/process/adapter-vsix-dag-view-acceptance.md`. Final
  `docs/process/adapter-vsix-acceptance.md` installs that exact artifact under
  minimum VS Code `1.101.0` with exact test-electron `3.1.0` and proves
  trusted/untrusted and virtual activation, offline LSP/navigation/Help,
  empty/large/rapid-edit DAG use, replacement, uninstall readback, and source
  identity. The accepted
  read-only MCP contract fixes final revision `2026-07-28`,
  exact stable server SDK `2.0.0`, local stdio, four immutable JSON resources,
  five closed read-only tools, exact inline and digest-bound registered
  sources, adapter-owned result schemas, failure ownership, hard limits, and
  semantic parity without a CLI subprocess. The private `adapters/mcp`
  workspace now implements the exact modern-only stdio server, direct
  Application parity, self-contained adapter schemas, digest-bound sources,
  and the accepted hard limits without Git or persistence calls. Its record is
  `docs/process/adapter-mcp-read-adapter-acceptance.md`. The CLI now composes
  one private Application facade over the accepted Node Host and retains all
  44 Contract 7 commands and package identities; its record is
  `docs/process/adapter-cli-facade-parity-acceptance.md`. Final MCP acceptance
  adds the isolated dual-tarball, strict malformed-line, two-client, source-
  digest, limit, and no-write gate recorded in
  `docs/process/adapter-mcp-acceptance.md`. The final
  `docs/process/adapter-integration-acceptance.md` record closes sixteen
  dependency-ordered semantic-parity, protocol-binding, dependency,
  distribution, installed-adapter, supported-host, complete self-use, and
  no-write cases. `ADAPTER_INTEGRATION_ACCEPTANCE` is complete and retained
  before advance. All sixteen tasks and 91p are complete; precedence and
  `parallel-sgs` version 1 heuristic resource makespans are zero with zero
  resource delay, and complete NextResult v6 has no ready, recommended, or
  startable task.
  Editor and MCP
  mutation, release selection, publication, remote writes, Issue mutation,
  and plan advance remain separate.
- The selected `plans/editor-mutations.pert` `EDITOR-MUTATION-001` workstream
  contains eleven serial tasks and 77p. Its accepted
  `docs/specs/editor-mutations.md` contract adds opt-in Editor Protocol model
  2 while retaining active model 1 unchanged. One complete final candidate is
  classified by the strictest of `E0` complete semantic equivalence, `E1`
  completely unsealed validated repair, `E2` non-destructive recoverable
  semantic edit, and `E3` assurance-, governance-, destructive-, or advance-
  sensitive work. Complete semantic fingerprints are distinct from source and
  plan-assurance hashes; exact bindings, inverse recovery, candidate-bound
  authority, advance history safety, ten `PTEDM-*` diagnostics, and fixed hard
  limits fail closed. `EDITOR_MUTATION_CONTRACT` is complete and retained
  before advance. Its separately confirmed conformant outcome was written once
  with actor `codex`, the candidate-bound `user` assertion, and current source
  digest `sha256:e5ebb94a...9436ca`; complete assurance recommends only
  `EDITOR_FORMAT_CORE`. The current E0 implementation adds the Core-owned
  complete semantic fingerprint and a binding-, validation-, equality-, and
  idempotence-checked session format projection. A compatible private-LSP
  connection may select model 2 and then receives only standard whole-document
  formatting; model-1 connections remain read-only. The private VSIX now offers
  `[2, 1]` and gates standard Format Document plus user-enabled format-on-save
  on the accepted model-2 handshake. Its eighteen cases and supported VS Code
  1.101.0 trusted/untrusted host gate are recorded in
  `docs/process/editor-format-acceptance.md`; range/on-type formatting, E1
  through E3, settings mutation, and direct persistence remain unavailable.
  `EDITOR_FORMAT_CORE` is complete and retained
  before advance; implementation commit `5245235` passed the complete gate,
  and the status-only plan write required no owner assertion. Its reached-
  milestone criterion set was separately confirmed and written once with the
  candidate-bound `user` assertion. Its receipt was then separately confirmed
  and written once with a fresh `user` assertion; the reached milestone is now
  accepted with no blocking criterion. The separately governed conformant
  outcome was separately confirmed and written once with a fresh candidate-
  bound `user` assertion. That restored complete assurance and made only
  `EDITOR_FORMAT_ACCEPTANCE` startable. `EDITOR_FORMAT_ACCEPTANCE` is now
  complete and retained before advance. Its status-only write required no owner
  assertion; its criterion set, receipt, and conformant outcome were separately
  confirmed with fresh candidate-bound `user` assertions. The receipt binds the
  integrated merge revision `a569a47`, and final plan digest
  `sha256:62b134ef...53ad48` has no unavailable task, mismatch, replan
  requirement, or required action. Fresh complete NextResult v7 recommends and
  makes startable only `EDITOR_REPAIR_CONTRACT`. Its accepted
  `docs/specs/editor-repairs.md` child contract fixes registry version 1 to the
  single `duration_unit_to_point` repair and no refactoring, using an existing
  compatible velocity, complete Grammar 6 or 7 validation, every task
  `unsealed` before and after, exact forward/inverse bytes, atomic Quick
  Fix/Fix All, and explicit editor-owned automatic opt-in. Protected records,
  work events, inferred input, governance/history/destructive/lifecycle
  effects, mixed classes, and partial repair fail closed. Its twenty-two cases
  are in `test/fixtures/editor-repair-contract-v1.json`, and the acceptance
  record is `docs/process/editor-repair-contract-acceptance.md`.
  `EDITOR_REPAIR_CONTRACT`, its reached-milestone evidence, and its conformant
  outcome are accepted at final plan digest `sha256:fac511d0...87af00`.
  Complete assurance has no required action, and fresh NextResult v7 makes only
  `EDITOR_REPAIR_ACCEPTANCE` startable. The contract adds no active
  edit-bearing action. Range/on-
  type formatting, E1 implementation, E2, E3, MCP mutation, public VSIX
  publication, release selection, remote writes, Issue mutation, and plan
  advance remain separate.
- The live 2026-08-14 open-Issue review is recorded in
  `docs/process/issue-priority-review-2026-08-14.md`. Issue #19 / `ADV-006` is
  the sole P0 and preempts normal feature work because successful `dag advance`
  can discard retained-milestone criterion sets and introduce `PTMAC-102`.
  Issues #7 / `ACT-004` and #6 / `ACT-005` are P1; Issues #13, #18, and #12
  are P2; and Issue #3 is P3. Only #7 changed remotely, from P0 to P1, and
  readback confirmed exactly one priority label on every open Issue. This
  product ordering pauses but does not rewrite the accepted plan-assurance
  frontier: `EDITOR_REPAIR_ACCEPTANCE` remains the only startable task. The
  local #19 correction now protects all `keptMilestoneIds` and rechecks the
  final Contract 8 candidate. Its llmthink RCA and acceptance evidence are in
  `docs/process/issue-19-advance-criterion-rca.think` and
  `docs/process/issue-19-advance-criterion-acceptance.md`; the published
  `0.9.3` remains affected. Release selection, remote source write, Issue
  closure, and plan advance remain separate.
- The selected compatible `plans/release-0.7.1.pert` patch plan sequences five
  serial tasks and 15p. The exact initial goal-and-DAG candidate was written
  once with actor `codex` and the scope-bound owner assertion `user`.
  `RELEASE_071_SELF_REVIEW` is complete after selecting suffix-free `0.7.1`
  for the accepted `GUIDE-CONSISTENCY-001` runtime guidance correction and
  comparing current source with installed `0.7.0`. Grammar 6, CLI Contract 7,
  all 44 command structures, 20 schemas, 121 package-root exports,
  GuideResult v1, payload structure, and authority remain unchanged. Package,
  lockfile, and CLI still identify `0.7.0`; npm reports
  `beta=latest=0.7.0`, no `alpha`, and no published `0.7.1`. Only
  `RELEASE_071_PREPARATION` was next. It is complete after aligning package,
  lockfile, CLI, CHANGELOG, README, release records, tests, goldens, self-use
  metadata, and package validation to `0.7.1`; its record is
  `docs/process/0.7.1-preparation.md`. `RELEASE_071_CANDIDATE` is complete
  after the clean Node.js 22 gate, read-only external and protected-route
  preflight, and acceptance of the retained 601-file, 660003-byte tarball with
  SHA-256 `5bf47231...e4454c`. Its source commit is `a05b769`, and its record
  is `docs/process/0.7.1-candidate.md`. The separately authorized PUBLISH
  completed from release commit `eee0f05`, peeled annotated tag `v0.7.1`,
  successful Node.js 22 and 24 CI run `30969627120`, GitHub prerelease, and
  one npm publication to `beta`. Candidate, GitHub, and npm tarballs agree at
  the same SHA-256. At publication, `beta=0.7.1`, `latest=0.7.0`, and alpha
  was absent. The user then separately authorized one exact `0.7.1` npm
  `latest` promotion; fresh reads and an unqualified installation confirmed
  `beta=latest=0.7.1`, 44 commands, and 20 schemas. Durable acceptance is
  recorded in `docs/process/0.7.1-release-acceptance.md`. All five tasks and
  15p are complete with zero makespans and no recommendation. Both plan
  advances, Issue mutation, and unrelated work remain separately gated.
- Issue #4 is tracked in independent post-beta `plans/governance.pert`. All twelve tasks through `GOV_ACCEPTANCE` are complete and advanced. Grammar 4 source, declared/effective metadata and digest-bound snapshots, actual-change classification, caller-assertion normalization, pre-change decisions, governed direct/batch/advance planning, PTGOV diagnostics, ProjectResult v3, MutationResult v2 with GovernanceDecision v1, the Contract 5 registry/help/usage/Guide surface, authorization-before-safe-write enforcement, generated direct-edit warning, public root, CLI, and installed `0.4.0` and `0.5.0` workflows are accepted and active together. The plan has zero makespans, no remaining or recommended task, and observed velocity `45p/2d`; it remains distinct from recommendation override MIG-08. Issue #4 closure remains separately gated.
- The selected independent `plans/project-actuals.pert` workstream starts from
  accepted ADR 0006, Grammar 5 source/migration, Graph semantics 2, Mutation
  semantics 2, the Normative target 1.0 Project Actuals and Git History
  Contract, Contract 6 result identities/diagnostics, and fourteen machine-readable PACT
  cases. `ACTUALS_CONTRACT_REVIEW` is complete and advanced from its `f6e93e1`
  pre-advance snapshot. `ACTUAL_SOURCE_CORE` is complete, its exact
  pre-advance snapshot is committed at `d6d3d7f`, and the task is advanced to
  reached `ACTUAL_SOURCE_READY`. Its internal identity-checked Grammar 5
  source Core parses, validates, formats, and projects exact task-owned work
  events while the standard package root, CLI Contract 5, and Grammar 1
  through 4 remain unchanged. `ACTUAL_GIT_HISTORY_PROBE` is complete, its
  exact pre-advance snapshot is committed at `2198a0b`, and the task and
  satisfied source/history gates are advanced to reached
  `HISTORY_INPUT_READY`. Its internal read-only adapter binds SHA-1/SHA-256
  repository snapshots, first-parent path history, raw source digests, typed
  availability, linked worktrees, and source/HEAD races without changing Git
  or the active public surface. `FINISH_ACTUALS` is complete, its exact
  pre-advance snapshot is committed at `2af13c4`, and the task is advanced to
  reached `FINISH_ACTUALS_READY`. Its internal eventful-finish Core provides
  deterministic identity, exact active-time and effort input, finish-only and
  complete coverage, retry/conflict handling, governed Grammar 5 safe write,
  and task-owned advance removal while the active public surface remains
  unchanged. `PROJECT_HISTORY` is complete, its exact pre-advance snapshot is
  committed at `c0eff39`, and the task is advanced to reached
  `PROJECT_HISTORY_READY`. Its internal pure reducer reconstructs explicit
  events, advance removal, qualified legacy Git-recorded transitions, exact
  task summaries, and typed availability from the first-parent probe;
  deterministic Result v1 text/JSON remained publicly inactive until the
  later public-contract cutover.
  `WORK_LIFECYCLE` is complete; Git commit `518a59e` records its exact
  completed 7p pre-advance snapshot, and the task is advanced to reached
  `LIFECYCLE_READY`. Its internal target provides exact
  start/suspend/resume candidates, deterministic retry and refusal, resource
  release, full remaining-duration schedules, and separate AnalysisResult
  v4/NextResult v5 suspended handling without changing the active public
  surface. `VELOCITY_OBSERVATION` is complete; Git commit `19b060a` records
  its exact completed 5p pre-advance snapshot, and the task and satisfied
  integration gates are advanced to reached `ACTUALS_INTEGRATED_INPUT`. Its
  pure service derives exact elapsed-hour, active-date, effort-productivity,
  and separately qualified Git-recorded rates without changing declared
  velocity. `ACTUALS_PUBLIC_CONTRACT` is complete; Git commit `753efea`
  records its exact completed 6p pre-advance snapshot, and the task is
  advanced to reached `ACTUALS_PUBLIC_READY`. The current source atomically
  activates Grammar 5 and CLI Contract 6 through lifecycle, suspended analysis/Next, history,
  observation, standard package root, the original 33-command cutover registry, help, Guide,
  result schema identities and projections, examples, and isolated installed
  workflow. `ACTUALS_ACCEPTANCE` is
  complete; Git commit `f994fa2` records its exact completed 4p pre-advance
  snapshot, and the task is advanced to reached `ACTUALS_ACCEPTED`. Its
  fourteen-case trace covers repository, Git, lifecycle, link, package, and
  installed workflows. All nine tasks and 47p are complete with zero
  precedence and heuristic resource makespans and no ready, recommended, or
  startable task. Git mutation, automatic velocity adoption, MIG-08,
  publication, and dist-tag movement remain outside scope. The independent
  workstream did not displace the separately selected English-baseline workstream. Backlog `ACT-002` records only an
  undecided REOPEN request; it has no selected semantics, implementation,
  plan, or public-contract inclusion.
- The locally accepted `ACT-003` correction for GitHub Issue #8 makes
  `project observe-velocity` reduce declared candidates from the exact current
  operand while retaining selected-revision Git-recorded candidates and nested
  history provenance. Its real-CLI and documentation evidence is
  `docs/process/issue-8-current-velocity-acceptance.md`. The public Core,
  result/schema identities, `project history`, package exports, release,
  remote, Issue, and publication state remain unchanged.
- The CLI/help review is tracked independently in `plans/cli-surface-reset.pert`. All nine tasks through `CLI_003_FILE_FIRST_ACCEPTANCE` are complete and advanced. Its accepted registry-driven design separates command help, domain guide, and agent guidance, includes project initialization and gate maintenance, and rejects renamed Contract 2 spellings. Contract 4 retains those invariants while extending every active JSON envelope and installed-package workflow for temporal and exact-unit behavior. The completed plan has no recommendation at `49p/1d`.
- The first Contract 3 package, suffix-free beta `0.2.0`, is accepted under `plans/release-0.2.0.pert`, `docs/process/0.2.0-release.md`, and its acceptance record. All five release tasks are complete and advanced; release commit/tag identity, common local/GitHub/npm tarball bytes, and installed Contract 3/file-first behavior are verified. Publication moved only `beta`; a separately authorized post-acceptance dist-tag operation then made npm `beta=latest=0.2.0`. The completed release plan remains unchanged with no recommendation at `17p/2d`.
- The suffix-free Contract 4 beta `0.3.0` is accepted. All six release tasks through `RELEASE_030_ACCEPTANCE` are complete and advanced. Release commit and peeled `v0.3.0` target `af44577` agree; the GitHub prerelease and npm registry tarballs have SHA-256 `197548a4...62074`; a separately authorized post-acceptance operation made npm `beta=latest=0.3.0`, while `alpha=0.1.0-alpha.2`. An unqualified global installation and light Contract 4 smoke passed. The plan has zero makespans, no recommendation, and observed cumulative velocity `19p/2d`.
- The accepted suffix-free beta `0.4.0` publishes the breaking Grammar 4 and Contract 5 cutover. `plans/release-0.4.0.pert` keeps completed governance implementation state separate. The release commit and peeled `v0.4.0` target `6b341d1` agree, the candidate/GitHub/npm tarballs have common SHA-256 `010af9ce...7cc4a`, and npm reported `beta=0.4.0`, unchanged `latest=0.3.0`, and `alpha=0.1.0-alpha.2` at acceptance. Public-package checks and a registry install passed. All six tasks and 19p are complete and advanced to reached `RELEASE_040_ACCEPTED`; the plan has zero makespans and no recommendation. A separately authorized post-acceptance operation made npm `beta=latest=0.4.0`; an unqualified isolated installation confirmed CLI Contract 5 and Grammar 4. Issue #4 closure remains separate.
- The accepted release is suffix-free beta `0.5.0` for the atomic Grammar 5 and CLI Contract 6 cutover. `plans/release-0.5.0.pert` consumes accepted project-actuals and English-baseline input without duplicating either workstream. Git commit `1641a32` records the exact completed gate-design pre-advance snapshot, and Git commit `ba84cd8` records the exact completed Contract 6 readiness pre-advance snapshot. `RELEASE_050_PREPARATION` is complete and advanced through reached `RELEASE_050_SOURCE_PREPARED`; Git commit `e1e7ccf` records its exact pre-advance snapshot. `RELEASE_050_CANDIDATE` is complete and advanced after rechecking the clean source, channels, protected routes, full gates, and the retained 468-file tarball with SHA-256 `f3ba9b3f...2208c`. `RELEASE_050_PUBLISH` is complete: release commit and peeled `v0.5.0` target `af819b4` agree, candidate/GitHub/npm tarballs are byte-identical, npm reports `beta=0.5.0`, unchanged `latest=0.4.0`, and `alpha=0.1.0-alpha.2`, and isolated public-package checks passed. Git commit `94a8b62` records the exact completed PUBLISH pre-advance snapshot, and the task is advanced to reached `RELEASE_050_PUBLISHED`. `RELEASE_050_ACCEPTANCE` is complete after independent Git, GitHub, npm, artifact, and installed-package verification. All six tasks and 19p are complete at `19p/1d`; both makespans are zero, and complete NextResult v5 has no recommendation. Git commit `bacd413` records the exact completed acceptance pre-advance snapshot, and the plan is advanced to reached `RELEASE_050_ACCEPTED`. The exact post-acceptance global installation resolves to registry `perttool@0.5.0` and passed Contract 6, Grammar 5, and history smoke checks. The user's named authorization does not cover npm `latest` promotion or Issue #4 closure.
- The compatible `0.5.1` patch release is tracked in `plans/release-0.5.1.pert`. `RELEASE_051_SELF_REVIEW`, `RELEASE_051_PREPARATION`, and `RELEASE_051_CANDIDATE` are complete and advanced after confirming that the additive read-only schema command, bundled Draft 2020-12 artifacts, lookup APIs, and Git 2.54 UTC `Z` fix retain existing Grammar 5, CLI Contract 6, 33 command descriptors, result identities, payload meanings, and 108 package exports. The review corrected available-Git result validation and package wildcard-export consumption coverage. Package, lockfile, CLI, CHANGELOG, README, release guidance, tests, goldens, and the full Node.js 22 repository and 491-file isolated-package gates identify `0.5.1`; clean source, channel availability, protected routes, and the retained tarball with SHA-256 `93f3e01a...1339` passed candidate acceptance. `RELEASE_051_PUBLISH` is complete: release commit and peeled `v0.5.1` target `31d162a` agree; Node.js 22 and 24 CI passed; candidate, GitHub, and npm tarballs are byte-identical; npm reports `beta=0.5.1`, unchanged `latest=0.4.0`, and `alpha=0.1.0-alpha.2`; and isolated public-package checks passed. `RELEASE_051_ACCEPTANCE` is complete after independent Git, GitHub, npm, artifact, compatibility, and installed-package verification. All five tasks and 17p are complete at `17p/1d`; both makespans are zero, and complete NextResult v5 has no recommendation. Git commit `9ecae00` records the exact completed acceptance pre-advance snapshot, and the plan is advanced to reached `RELEASE_051_ACCEPTED`. The user later separately authorized one `latest` mutation; fresh registry reads and an unqualified isolated installation confirmed `beta=latest=0.5.1`, CLI Contract 6, Grammar 5, and all eighteen root schemas. Issue #5 closure remains a separate decision.
- The explicitly authorized compatible `0.5.2` schema patch is tracked in `plans/release-0.5.2.pert`. `RELEASE_052_SELF_REVIEW` is complete after confirming complete nested schemas, strict real-result validation, stable default full lookup/query semantics, opt-in reference-based outline/detail views, all 34 commands, and all 116 existing runtime exports. `RELEASE_052_PREPARATION` is complete after aligning version-bearing source, release documents, tests, goldens, and 23-plan self-use registration; the complete Node.js 22 gate passed 655 tests, English and documentation checks, temporary-link, 491-file isolated-package, and publication-normalization workflows. `RELEASE_052_CANDIDATE` is complete after clean revalidation, absent-version/channel preflight, protected-route checks, and acceptance of the retained 491-file, 519790-byte tarball with SHA-256 `e8512f0d...54bbce`; no external state changed. `RELEASE_052_PUBLISH` is complete: release commit and peeled `v0.5.2` target `501d4b1` agree; Node.js 22 and 24 CI run 30517079581 passed; candidate, GitHub, and npm tarballs are byte-identical; npm reports `beta=0.5.2`, unchanged `latest=0.5.1`, and `alpha=0.1.0-alpha.2`; and isolated public-package checks passed. `RELEASE_052_ACCEPTANCE` is complete after independent Git, GitHub, npm, artifact, exact `0.5.1` compatibility, and installed full/outline/detail verification. All five tasks and 17p are complete at `17p/1d`; both makespans are zero, and complete NextResult v5 has no recommendation. Git commit `3f7cc04` records the exact completed acceptance pre-advance snapshot, and the plan is advanced to reached `RELEASE_052_ACCEPTED`. npm `latest` promotion and Issue #5 closure remain separate decisions.
- The explicitly authorized compatible `0.5.3` governance-guidance patch is tracked in `plans/release-0.5.3.pert`. It retains Grammar 5, CLI Contract 6, all command, option, result, schema, and package-root identities while publishing the beta-only channel guard and single-candidate, scope-bound, human-readable loose owner-confirmation workflow. `RELEASE_053_SELF_REVIEW` and `RELEASE_053_PREPARATION` are complete after the 662-test, 24-plan, 115-Markdown, temporary-link, and 491-file isolated-package gates passed. `RELEASE_053_CANDIDATE` is complete after clean revalidation, unused-version and channel preflight, protected-route checks, and acceptance of the retained 491-file, 520876-byte tarball with SHA-256 `a935b3e7...f7e4`. `RELEASE_053_PUBLISH` is complete: release commit `1dc7c05`, remote main, peeled tag, GitHub prerelease, npm `beta=0.5.3`, and the common tarball agree, while `latest=0.5.1` and alpha remains absent. `RELEASE_053_ACCEPTANCE` is complete after independent Git, GitHub, npm, artifact, and installed-package verification. All five tasks and 15p are complete with zero makespans and no recommendation; completed declarations remain until a separately confirmed single-candidate `dag advance`. npm `latest` promotion remains a separate decision.
- The explicitly authorized compatible `0.5.4` patch is durably accepted through `plans/release-0.5.4.pert`. Release commit `9c23510`, peeled tag, successful Node.js 22/24 CI run `30536185188`, GitHub prerelease, npm `beta=0.5.4`, and the common 521641-byte tarball with SHA-256 `d3123ef0...3c01` agree; `latest=0.5.1` and alpha remains absent. Independent public installation and PTGOV-103 default/strict verification passed. All five tasks and 15p are complete with zero makespans and no recommendation; completed declarations remain until a separately confirmed `dag advance`. The patch emits non-blocking `PTGOV-103` when a valid governance-not-applicable candidate carries a non-empty `acceptedByOwner` set. Default write authority and every result identity remain unchanged; existing `--warnings-as-errors` prevents persistence. This does not add accepted scopes, approval evidence, authentication, or cross-candidate reuse detection. npm `latest` promotion remains separate.
- The explicitly authorized compatible `0.5.5` patch is durably accepted through `plans/release-0.5.5.pert`. Release commit `04055c9`, peeled tag, Node.js 22/24 CI run `30543700217`, GitHub prerelease, npm `beta=0.5.5`, and the common 491-file, 522117-byte tarball with SHA-256 `1987db1a...5452` agree; `latest=0.5.1` and alpha remained absent at beta acceptance. It emits non-blocking `PTGOV-104` when a valid applicable preview carries a non-empty `acceptedByOwner` set while preserving the candidate, GovernanceDecision v1, default preview, persistent authority, commands, options, results, and schemas. Existing `--warnings-as-errors` returns exit 1 while retaining the candidate and decision. All five tasks and 15p are complete with zero makespans and no recommendation. The user later separately authorized one npm `latest` mutation and the exact displayed advance candidate. Fresh registry reads and an unqualified installation confirmed `beta=latest=0.5.5`, Contract 6, 34 commands, 18 schemas, and Grammar 5. Governed advance used actor `codex`, owner assertion `user`, and the preview source digest; the residual plan retains reached `RELEASE_055_ACCEPTED` with no diagnostics, task, recommendation, or makespan.
- `TIME-001` and `UNIT-001` are accepted through SU-M5. SU-M5's 23p atomic Contract 4 acceptance is committed at `81b4828`, the detail is advanced to reached `CONTRACT4_ACCEPTED` at `f15a7ac`, and the macro rolled it up once and advanced to reached `SCHEDULING_UNITS_ACCEPTED` at `507fbb8`. Both plans have zero makespans and no recommendation. The accepted surface includes Grammar 1/2/3, CLI Contract 4, public result schema identities, help, Guide, installed behavior, exact unit migration, and Next v4 normal start authority.
- The TypeScript CLI MVP, recommendation MIG-01 through MIG-07, read-only AI
  Agent Guidance Registry v1, owner-aware governance, project actuals,
  conditional plan assurance, adapter platform, historical DAG, and milestone
  acceptance are accepted. Published compatibility pins retain their original
  Grammar and CLI contracts; the active source boundary is Grammar 7 and CLI
  Contract 8. Issue #3 multi-plan composition and human override apply/audit
  remain separate future work.
- The normative precedence order is `docs/requirements.md`, `docs/specs/`, `docs/basic-design.md`, `docs/examples/`, `docs/process/`, and `plans/`.
- Before a non-trivial change, confirm the current checkout, goal, normative sources, acceptance criteria, non-goals, and verification method.
- Treat `--accepted-by-owner` as a single-candidate, scope-bound caller assertion, never as workstream or session authority. Start with an assertion-free preview; omit the assertion when governance is not applicable; treat `PTGOV-103` as the not-applicable assertion warning and `PTGOV-104` as the governed-preview assertion warning; present the operation, target, affected scopes, required owners, available modification time, byte size before and after, diff counts, and semantic candidate summary before a non-direct governed write; keep digests as supplemental machine identity; and never copy the assertion to later maintenance, a changed candidate, or the next `dag advance`. Do not chain preview and confirmation-dependent write without a user-response boundary. Follow `docs/process/governance-assertion-scope-experiment.md`.
- For the “next task,” treat a known, complete, non-truncated `Perttool.NextResult.v7` with policy `recommendation_v1_plus_release_gate_plus_plan_assurance_v1`, complete assurance authority, and complete milestone acceptance as the authority, choose a workstream from the macro startable recommended work package, and then reanalyze its corresponding detail plan. Start only `startable_recommended_task_ids`; normal selection is limited to a subset of that set, or the complete set plus exactly one resource-feasible, time-eligible, assurance-eligible allowed task. Do not start for an unknown version/policy, incomplete trace, `PTREC-*`, assurance safe stop, future/unavailable release eligibility, withheld assurance eligibility, unavailable milestone acceptance, or deferred/discouraged result; reanalyze after changes to task state, time, capacity, plan, relation, outcome, assurance, or acceptance.
- Maintain traceability across requirements/specification, design, implementation, and verification.
- Maintain task=edge, milestone=node, and gate=zero-duration dependency edge; do not convert shared resources into DAG dependencies.
- Distinguish the precedence critical path from the schedule critical path in a resource schedule.
- `docs/process/self-use.md` is authorized through Stage 3. Editing/advance writes require preview, review of the diff and removal list, expected digest, and post-write reanalysis.
- Confirm metadata such as Project ID, as_of, duration_unit, velocity, and finish with `project show --format json`; make changes through `project set` preview/diff and the Stage 3 safe-write procedure. Do not rely on visual source-file inspection or manual editing for the normal workflow.
- Run repository checks on Node.js 22 or later with `npm ci`, `npm run check`, and `git diff --check`; root build/typecheck include private adapter workspaces, `npm run check:lsp-package` installs the private LSP server beside the exact root Core, `npm run check:mcp-package` installs and exercises the private MCP server beside the exact root package without writes, `npm run check:vsix-shell` packages the offline VSIX and exercises the bundled server, DAG assets, and disposable trusted/untrusted minimum VS Code host install/replace/uninstall workflow, and public-package validation excludes `adapters/` from the root tarball. Use `npm run check:english` for the exact Japanese-script allowlist check. CI covers Node.js 22 and 24.
- Before staging, inspect the diff and status, and do not include unrelated user changes.
- Use `secdat exec` for remote writes and GitHub operations, and obtain explicit permission for destructive Git operations.
- Beta publication uses `beta` and does not itself change `latest`. The retired `alpha` channel must not be recreated without a new release-policy decision and separate authorization. A later `latest` promotion is a separate dist-tag mutation requiring an explicitly selected version and user permission. Use the release gates, the GitHub-identical tarball for publication, process-limited `NPM_TOKEN`, and the repository `secdat` route.
- Use sub-agents or parallel agent work only with an explicit user request or explicit permission in an active runtime policy.

Follow `AGENTS.md` for the detailed project map, domain invariants, validation, and Git rules.

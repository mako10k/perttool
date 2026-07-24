# Repository Instructions

`AGENTS.md`をCodexとGitHub Copilotで共有するrepository guidanceの正本とする。永続的なworkflowやproject ruleを変更するときは、このfileとの整合も同じcommitで確認する。

Mandatory summary:

- English is the canonical language for tracked repository artifacts. Respond to the user in Japanese unless requested otherwise. Preserve user-authored Unicode content, and do not introduce runtime i18n or locale negotiation.
- ADR 0004 is active. Existing Japanese surfaces are migration debt in `plans/english-baseline.pert`. `SURFACE_INVENTORY` is complete and advanced, and `NORMATIVE_DOCS` is the current recommended detail task.
- The TypeScript CLI MVP, recommendation MIG-01 through MIG-07, and the read-only AI Agent Guidance Registry v1 are accepted. A complete and known `Perttool.NextResult.v3` is the normal AI task-selection authority. The first suffix-free beta, `v0.1.0`, was published from one verified tarball to a GitHub prerelease and npm `beta`, then explicitly promoted to npm `latest`; both tags resolve to `0.1.0`. The macro plan is complete with no ready task. Issue #3, the LSP server, VSIX, and MCP server remain post-beta backlogs. Human override apply/audit remains unavailable until MIG-08.
- 正本の優先順は`docs/requirements.md`、`docs/specs/`、`docs/basic-design.md`、`docs/examples/`、`docs/process/`、`plans/`である。
- non-trivialな変更前にcurrent checkout、目的、正本、acceptance criteria、non-goal、検証方法を確認する。
- 「次のタスク」はknown、complete、not-truncatedな`dag next --format json`をauthorityとし、macroのrecommended work packageからworkstreamを選んでから対応detailを再解析する。Recommended subset、またはrecommended set全件にresource-feasibleなallowed taskを1件だけ追加した集合だけをnormal selectionとする。Unknown version、incomplete trace、`PTREC-*`、deferred/discouragedでは開始せず、task stateやcapacity変更後は再解析する。
- requirements/specification、design、implementation、verificationのtraceabilityを維持する。
- task=edge、milestone=node、gate=zero-duration dependency edgeを維持し、resource共有をDAG dependencyへ変換しない。
- precedence critical pathとresource schedule上のschedule critical pathを区別する。
- `docs/process/self-use.md`のStage 3まで解禁済み。Editing/advance writeはpreview、diffと削除一覧の確認、expected digest、write後再解析を必須とする。
- Project ID、as_of、duration_unit、velocity、finishなどのmetadataは`project show --format json`で確認し、変更は`project set`のpreview/diffとStage 3 safe-write手順を使う。通常workflowをsource fileの目視や手編集へ依存させない。
- Run repository checks on Node.js 22 or later with `npm ci`, `npm run check`, and `git diff --check`; CI covers Node.js 22 and 24.
- staging前にdiffとstatusを確認し、利用者の無関係な変更を含めない。
- remote writeとGitHub操作には`secdat exec`を使い、破壊的Git操作には明示許可を得る。
- Beta publication uses `beta` and does not itself change `latest`. A later `latest` promotion is a separate dist-tag mutation requiring an explicitly selected version and user permission. Use the release gates, the GitHub-identical tarball for publication, process-limited `NPM_TOKEN`, and the repository `secdat` route.
- sub-agentやparallel agent workは、利用者の明示要求または有効なruntime policy上の明示許可がある場合だけ使用する。

詳細なproject map、domain invariant、validation、Git規則は`AGENTS.md`に従う。

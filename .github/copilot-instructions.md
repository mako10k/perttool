# Repository Instructions

`AGENTS.md`をCodexとGitHub Copilotで共有するrepository guidanceの正本とする。永続的なworkflowやproject ruleを変更するときは、このfileとの整合も同じcommitで確認する。

Mandatory summary:

- English is the canonical language for tracked repository artifacts. Respond to the user in Japanese unless requested otherwise. Preserve user-authored Unicode content, and do not introduce runtime i18n or locale negotiation.
- ADR 0004 is active. Existing Japanese surfaces are migration debt in `plans/english-baseline.pert`; its first task stays blocked until `M8_BETA_RELEASED`, so `BETA_RELEASE_E2E` remains the current macro recommendation.
- TypeScript CLIのMVP public alphaとIssue #2のread-only AI Agent Guidance Registry v1は受け入れ済みである。Recommendation MIG-01からMIG-07は完了し、5 plan shadowとunknown-version safe stop dry-runを経たcompleteかつknownな`Perttool.NextResult.v3`をnormal AI task selection authorityへ採用した。`v0.1.0-alpha.2`はGitHub prereleaseとnpm `alpha`へ同一artifactで公開・検証済みである。最初のbetaはsuffixなし`0.1.0`、以後の`0.x.x`をbetaとし、alphaからのstrict compatibilityや追加soakをgateにしない。Issue #2は5 provider baseline、公開contract、version付きoffline profile、validator、query、index/quick/detail projection、deterministic JSON/text、structured command help、read-only `agent help` CLI、package-installed Core/CLI parity、security/package受け入れまで完了した。固有実測Velocityは全22p/1 active dayの`22p/1d`、detail残作業は0pである。Macroの唯一のready、`runnable_now`、recommended taskは`BETA_RELEASE_E2E`で、残存makespanは1dである。Issue #3、LSP server、VSIX、MCP serverはbeta blockerではない。Human override apply/auditはMIG-08まで未解禁である。
- 正本の優先順は`docs/requirements.md`、`docs/specs/`、`docs/basic-design.md`、`docs/examples/`、`docs/process/`、`plans/`である。
- non-trivialな変更前にcurrent checkout、目的、正本、acceptance criteria、non-goal、検証方法を確認する。
- 「次のタスク」はknown、complete、not-truncatedな`dag next --format json`をauthorityとし、macroのrecommended work packageからworkstreamを選んでから対応detailを再解析する。Recommended subset、またはrecommended set全件にresource-feasibleなallowed taskを1件だけ追加した集合だけをnormal selectionとする。Unknown version、incomplete trace、`PTREC-*`、deferred/discouragedでは開始せず、task stateやcapacity変更後は再解析する。
- requirements/specification、design、implementation、verificationのtraceabilityを維持する。
- task=edge、milestone=node、gate=zero-duration dependency edgeを維持し、resource共有をDAG dependencyへ変換しない。
- precedence critical pathとresource schedule上のschedule critical pathを区別する。
- `docs/process/self-use.md`のStage 3まで解禁済み。Editing/advance writeはpreview、diffと削除一覧の確認、expected digest、write後再解析を必須とする。
- Project ID、as_of、duration_unit、velocity、finishなどのmetadataは`project show --format json`で確認し、変更は`project set`のpreview/diffとStage 3 safe-write手順を使う。通常workflowをsource fileの目視や手編集へ依存させない。
- repository checkはNode.js 24以上で`npm ci`、`npm run check`、whitespace checkは`git diff --check`を使用する。
- staging前にdiffとstatusを確認し、利用者の無関係な変更を含めない。
- remote writeとGitHub操作には`secdat exec`を使い、破壊的Git操作には明示許可を得る。
- npm publishはalphaの`docs/process/npm-publication.md`またはbetaの`docs/process/beta-release.md`のrelease gate、GitHub Releaseとの同一tarball、明示dist-tag、process限定`NPM_TOKEN`注入を守る。Betaは`beta` tagを使い既存`latest`を変更しない。Actual publish前に利用者の明示許可を得る。
- sub-agentやparallel agent workは、利用者の明示要求または有効なruntime policy上の明示許可がある場合だけ使用する。

詳細なproject map、domain invariant、validation、Git規則は`AGENTS.md`に従う。

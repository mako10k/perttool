# Repository Instructions

`AGENTS.md`をCodexとGitHub Copilotで共有するrepository guidanceの正本とする。永続的なworkflowやproject ruleを変更するときは、このfileとの整合も同じcommitで確認する。

Mandatory summary:

- 利用者から指定がない限り、日本語で応答する。
- 現在はTypeScript CLIのMVP recommendation実装段階である。`dag next`はcomplete recommendation graphを持つ`Perttool.NextResult.v3`を公開し、read-only `validateOverride`と5 planのself-use shadow評価まで完了したが、MIG-07完了まではAI task selection authorityへ昇格せずmanual selectionを維持する。Release readiness監査でMVP受け入れ条件16の未実装を確認したため、macro `plans/mvp.pert`と詳細`plans/recommendation.pert`を含む5計画をStage 3で自己利用中。詳細の次criticalかつrecommended taskは`AUTHORITY_ADOPTION`である。`RECOMMENDATION_IMPLEMENTATION`が唯一のreadyかつcriticalなmacro work packageで、`RELEASE_E2E`はupcomingである。
- 正本の優先順は`docs/requirements.md`、`docs/specs/`、`docs/basic-design.md`、`docs/examples/`、`docs/process/`、`plans/`である。
- non-trivialな変更前にcurrent checkout、目的、正本、acceptance criteria、non-goal、検証方法を確認する。
- 「次のタスク」はmacroでworkstreamを選んでから対応する詳細planのcritical pathから提案し、着手しやすさだけで選ばない。
- requirements/specification、design、implementation、verificationのtraceabilityを維持する。
- task=edge、milestone=node、gate=zero-duration dependency edgeを維持し、resource共有をDAG dependencyへ変換しない。
- precedence critical pathとresource schedule上のschedule critical pathを区別する。
- `docs/process/self-use.md`のStage 3まで解禁済み。Editing/advance writeはpreview、diffと削除一覧の確認、expected digest、write後再解析を必須とする。
- repository checkはNode.js 24以上で`npm ci`、`npm run check`、whitespace checkは`git diff --check`を使用する。
- staging前にdiffとstatusを確認し、利用者の無関係な変更を含めない。
- remote writeとGitHub操作には`secdat exec`を使い、破壊的Git操作には明示許可を得る。
- npm publishは`docs/process/npm-publication.md`のrelease gate、GitHub Releaseとの同一tarball、`alpha` tag、process限定`NPM_TOKEN`注入を守り、actual publish前に利用者の明示許可を得る。
- sub-agentやparallel agent workは、利用者の明示要求または有効なruntime policy上の明示許可がある場合だけ使用する。

詳細なproject map、domain invariant、validation、Git規則は`AGENTS.md`に従う。

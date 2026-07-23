# ADR 0002: Node.js 24 LTS上のTypeScript ESM CLIとして配布する

- Status: Accepted
- Date: 2026-07-21
- Decision owners: perttool maintainers
- Related design: [基本設計](../basic-design.md)
- Related interface: [CLI Interface仕様](../specs/interfaces.md)

## Context

MVPはローカルCLIをprimary interfaceとし、同じCore APIをlibrary、test、将来adapterから利用する。実装開始前にruntime、module形式、package manager、dependency方針、test入口を固定する必要がある。

2026-07-21時点でNode.js 24はLTSであり、開発環境のNode.js 25はEOLである。Current release固有機能へ依存せずLTSをbaselineにする。

## Decision

- runtime baselineはNode.js `>=24`
- package managerはnpm、lockfileは`package-lock.json`
- 1つのnpm packageから`perttool` binaryとlibrary APIを提供する
- package/module形式はESM（`type: module`）
- TypeScript compilerは7.0系をlockfileで固定し、`module`/`moduleResolution`は`NodeNext`
- test runnerはNode.js built-in test runner
- MVP scaffoldはruntime dependencyを持たず、Node.js標準APIだけを使用する
- 公開判断までは`private: true`とし、公開後のpackage tarballはruntimeに必要な`dist/`と利用者向け文書だけを含める
- MCP SDK、transport、server packageをMVP dependencyへ追加しない

## Consequences

- CIはNode.js 24で`npm ci`とrepository checkを実行する
- source importはNode ESM規則に従い`.js` extensionを記述する
- build artifactは`dist/`へ出力しGit管理しない
- TypeScript type、CLI JSON、JSON Schemaは同じlogical changeで更新する
- Node.js 24より古いruntimeはMVP support対象外
- `npm run check:package`でpack内容、CLI実行権限、version、最小文書の検査を行う

## Public alpha decision

2026-07-21にMIT LicenseでGitHub repositoryをpublic化し、`v0.1.0-alpha.1`をGitHub prereleaseとして配布する判断を行った。これはread-only CLIの評価版であり、MVP stable releaseではない。

- npm registryにはこの時点ではpublishしない
- GitHub Releaseへ`npm pack`で生成したtarballを添付する
- package metadataから`private`を外すが、publishは別の明示操作と認証を必要とする
- 当時はstable `v0.1.0`をformatter、mutation、Mermaid、release E2Eを含むMVP gate完了後に判断するとした。この判断は[ADR 0003](0003-beta-versioning.md)が置き換え、suffixなし`0.x.x`をbetaとして扱う

## npm prerelease publication decision

2026-07-23に、残るMVP gate完了後の次期prereleaseをnpm registryへもpublishする方針を採用した。準備を前倒ししても`RELEASE_E2E`やrecommendation taskを完了扱いにはしない。

- 次の候補versionは`0.1.0-alpha.2`とし、現行checkoutを既存GitHub Releaseと同じ`0.1.0-alpha.1`としてpublishしない
- prereleaseは`alpha` dist-tagを明示し、`latest`を変更しない
- package check、GitHub Release asset、npm publishへ同一tarballを使用する
- `package.json`の`publishConfig`でpublic access、npmjs registry、`alpha` tagを固定する
- npmがpublish時にmanifestを自動補正しないことをdry-runで検査する
- TOKENはtracked fileやargumentへ置かず、maintainerの`secdat`から`NPM_TOKEN`としてpublish processだけへ注入する
- actual publishはcleanなrelease commit、同一commitのremote mainとannotated tag、GitHub Release asset、未公開versionを確認した後の明示操作とする
- stable `latest`の設定とtrusted publishingへの移行は別判断とする

この節はpublic alphaのrelease判断を記録する。最初のbeta以降のversionとdist-tagは[ADR 0003](0003-beta-versioning.md)および[beta release手順](../process/beta-release.md)を正とし、alpha用のpublication記録を新しいreleaseへ流用しない。

詳細なalpha preflight、publish、公開後検証は[npm publication手順](../process/npm-publication.md)を正とする。

## Dependency policy

Runtime dependency追加には次を要求する。

1. Node.js標準APIまたは小さなlocal implementationで代替できない理由
2. license、maintenance、supply-chain riskの確認
3. CLI startup、bundle/install sizeへの影響確認
4. lockfile更新とtest

Parser generatorやCLI frameworkは将来必要性が生じた時点で再評価し、scaffold段階では導入しない。

## Validation

```sh
npm ci
npm run check
```

CIとlocal developmentは同じ`npm run check`を入口にする。

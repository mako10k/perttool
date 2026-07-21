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
- pre-release中は`private: true`とし、公開release判断は別途行う
- MCP SDK、transport、server packageをMVP dependencyへ追加しない

## Consequences

- CIはNode.js 24で`npm ci`とrepository checkを実行する
- source importはNode ESM規則に従い`.js` extensionを記述する
- build artifactは`dist/`へ出力しGit管理しない
- TypeScript type、CLI JSON、JSON Schemaは同じlogical changeで更新する
- Node.js 24より古いruntimeはMVP support対象外

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

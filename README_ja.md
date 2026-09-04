# Finch.js <img src="./docs/assets/green-warbler-finch-silhouette-profile-pink.png" alt="横を向いたグリーンムシクイフィンチのピンク色のシルエット" width="56" align="middle" />

[English](./README.md)

🐦 **図はすばやく生成し、仕上げは思いどおりに。** 短いテキストから整った SVG 図を生成し、納得できるまでノードをドラッグして固定できます。ノード ID が同じなら、テキストを直したあとも人が決めた配置を引き継ぎます。

[![ソースを変更しても人が整えた配置を保つ Finch.js](./docs/assets/finch-editing-demo.gif)](./examples/readme-demo.html)

[チュートリアル](./docs/tutorial_ja.md) · [作例を見る](./examples/README.md) · [npm パッケージ](https://www.npmjs.com/package/@hachiware-labs/finch-js)

## クイックスタート

次の内容を `diagram.html` として保存し、ブラウザーで開いてください。バージョンを固定したブラウザー版を読み込むため、インストールもビルドも必要ありません。

```html
<!doctype html>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { margin: 0; }
  #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
</style>

<main id="diagram" aria-label="注文処理のフローチャート"></main>

<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
<script>
  const orderFlowSource = `
@flowchart
start received "注文を受け付ける"
process validate "在庫を確認する"
decision available "在庫あり?"
process reserve "商品を確保する"
end confirmed "注文確定"
end backorder "入荷待ち"

received -> validate
validate -> available
available -> reserve: Yes
available -> backorder: No
reserve -> confirmed
  `.trim();

  Finch.render(orderFlowSource, {
    target: "#diagram",
    editor: { storageKey: "order-flow" },
  });
</script>
```

左下の Finch ボタンを開き、ノードをドラッグしてからダブルクリックして位置を固定します。ソース内の表示名を変えてみてください。図はその場で更新されますが、手で整えた配置は失われません。Save を押すまでは永続化されません。

ID と表示名は別です。`validate` は変えず、`"在庫を確認する"` だけを書き換えれば、保存した位置を引き継げます。

## インストール

```bash
npm install @hachiware-labs/finch-js
```

```js
import Finch, { createFinch } from "@hachiware-labs/finch-js";
```

script 要素から使う場合は、ブラウザーグローバル版を読み込みます。

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
```

## ダイアグラムの種類

| ディレクティブ | 用途 | 作例 |
| --- | --- | --- |
| `@deployment` | システムやインフラの構成 | [Deployment](./examples/deployment.html) |
| `@sequence` | 時系列のやり取り | [Sequence](./examples/sequence.html) |
| `@flowchart` | 手順や分岐 | [Flowchart](./examples/flowchart.html) |
| `@state` | 状態と遷移 | [State](./examples/state.html) |
| `@er` | エンティティと関連 | [ER](./examples/er.html) |
| `@component` | ソフトウェアの境界とインターフェース | [Component](./examples/component.html) |
| `@slide` | プレゼンテーション用の図 | [Slide](./examples/slide.html) |
| `@class` | クラスと UML の関係 | [Class](./examples/class.html) |
| `@usecase` | アクターとシステムの目的 | [Use case](./examples/usecase.html) |
| `@activity` | アクションと制御フロー | [Activity](./examples/activity.html) |

## Codex で図を作る

このリポジトリには [`$finch` スキル](./.agents/skills/finch/SKILL.md)が含まれています。このチェックアウトから Codex に次のように頼めます。

```text
$finch 注文審査フローのアクティビティ図を HTML に描いて。
```

ほかのワークスペースへインストールする場合は、次を実行します。

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

すべてのリポジトリで使う場合は `--global` を追加します。インストール直後にスキルが表示されなければ Codex を再起動してください。

## 詳しく知る

- [チュートリアル](./docs/tutorial_ja.md)：図の生成、配置、更新、保存、組み込みを順に試します。
- [リファレンス](./docs/reference_ja.md)：記法、編集操作、保存、イベント、画像出力、インスタンス API を確認できます。
- [発展例](./examples/README.md)：対応するすべての図法を、編集できる完成例で確認できます。
- [Finch.js の拡張](./docs/extensions_ja.md)：独自の図、Shape、Layout、Theme を追加します。
- [スライドパターン](./docs/slide-patterns_ja.md)：KPI、データストーリー、ロードマップ、比較、顧客の声を再利用できる形で組み立てます。

## 開発

```bash
npm ci
npm run check
```

作例をローカルで見るには `python -m http.server 8000` を実行し、`http://127.0.0.1:8000/examples/` を開いてください。

Finch.js は [MIT License](./LICENSE) で公開しています。

<details>
<summary>画像クレジット</summary>

- ヘッダーのシルエットは、Julien Renoult による[グリーンムシクイフィンチの写真](https://www.inaturalist.org/observations/9398069)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）を加工したものです。
- フッターのシルエットは、Andrew Katsis による[<i>Green warbler-finch on Santa Cruz Island</i>](https://commons.wikimedia.org/wiki/File:Green_warbler-finch_on_Santa_Cruz_Island.jpg)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）を加工したものです。

どちらも背景を除去し、鳥をシルエット化して単色化・再配置しています。
</details>

<p align="right">
  <img src="./docs/assets/green-warbler-finch-silhouette-foraging-pink.png" alt="餌を探すグリーンムシクイフィンチのピンク色のシルエット" width="180" />
</p>

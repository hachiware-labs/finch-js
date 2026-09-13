# Finch.js <img src="./docs/assets/green-warbler-finch-silhouette-profile-pink.png" alt="横を向いたグリーンムシクイフィンチのピンク色のシルエット" width="56" align="middle" />

[English](./README.md)

**テキストで図を描き、手で整えた配置を、テキストの変更後も保つ。** ノードIDで配置を引き継ぐ、編集可能なSVGダイアグラムライブラリです。

[![AWS・PostgreSQL・Lucideアイコンで描いた編集可能なアプリケーション構成図](./docs/assets/finch-architecture-hero-ja.png)](./examples/readme-hero.html?lang=ja)

図版・作例はリポジトリ版です。[生成元と更新記録](./docs/diagram-media.md)。

## クイックスタート

次を `diagram.html` としてUTF-8で保存し、ブラウザーで開いてください。公開済みの0.5.1を使うため、インストールやビルドは不要です。ネット接続が必要です。

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

  Finch.render(orderFlowSource, { target: "#diagram" });
</script>
```

図の左下にあるピンクの鳥アイコンを押すと、Edit モードが開きます。ノードをドラッグしてからダブルクリックし、位置を固定します。ソース内の表示名を変えてみてください。図はその場で更新されますが、手で整えた配置は失われません。Save を押すまでは永続化されません。

ID と表示名は別です。`validate` は変えず、`"在庫を確認する"` だけを書き換えれば、保存した位置を引き継げます。

この入口は公開済み **0.5.1** に固定しています。Saveはブラウザー内への保存です。HTML保存・Markdown・timing・UML追加記法などはリポジトリ版を使います。[15分チュートリアル](./docs/tutorial_ja.md)で保存まで試せます。

## 仕上げは思いどおりに

[![ソースを変更しても人が整えた配置を保つ Finch.js](./docs/assets/finch-editing-demo.gif)](./examples/readme-demo.html)

[チュートリアル](./docs/tutorial_ja.md) · [作例を見る](./examples/README.md) · [npm パッケージ](https://www.npmjs.com/package/@hachiware-labs/finch-js)

## ダイアグラムの種類

| ディレクティブ | 用途 | 作例 |
| --- | --- | --- |
| `@deployment` | システムやインフラの構成 | [Deployment](./examples/deployment.html) |
| `@graph` | 汎用的な関係とグループ化したシステム | [Graph](./examples/graph.html) |
| `@sequence` | 時系列のやり取り | [Sequence](./examples/sequence.html) |
| `@flowchart` | 手順や分岐 | [Flowchart](./examples/flowchart.html) |
| `@state` | 状態と遷移 | [State](./examples/state.html) |
| `@er` | エンティティと関連 | [ER](./examples/er.html) |
| `@component` | ソフトウェアの境界とインターフェース | [Component](./examples/component.html) |
| `@slide` | プレゼンテーション用の図 | [Slide](./examples/slide.html) |
| `@class` | クラスと UML の関係 | [Class](./examples/class.html) |
| `@usecase` | アクターとシステムの目的 | [Use case](./examples/usecase.html) |
| `@activity` | アクションと制御フロー | [Activity](./examples/activity.html) |
| `@timing` | 信号と状態の時間変化 | [Timing](./examples/timing.html) |

## インストール

エディタ拡張や投稿サービスへの組み込みには、[プラグイン開発ガイド](./docs/plugin-development_ja.md)を参照してください。変更通知、保存コールバック、Markdownへの書き戻し、復元とフリーズの契約をまとめています。

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

## スタイル一覧

同じフローチャートを、スタイルを変えて描いています。

<table>
<tr><td align="center"><strong>Default</strong><br><img src="./docs/assets/finch-style-default-ja.png" alt="Default: 注文処理のフローチャート" width="380"></td><td align="center"><strong>Precision</strong><br><img src="./docs/assets/finch-style-precision-ja.png" alt="Precision: 注文処理のフローチャート" width="380"></td></tr>
<tr><td align="center"><strong>Business</strong><br><img src="./docs/assets/finch-style-business-ja.png" alt="Business: 注文処理のフローチャート" width="380"></td><td align="center"><strong>Editorial</strong><br><img src="./docs/assets/finch-style-editorial-ja.png" alt="Editorial: 注文処理のフローチャート" width="380"></td></tr>
</table>

[スタイル比較ページ](./examples/style-study.html)では、図の種類や影の有無を切り替えて、SVGを保存できます。Business・Precision・Editorialは比較ページで定義したカスタムテーマの作例で、Business-shadowはBusinessの影あり版です。

## アイコン・役割色・自分の画像

`icon` と `tone` は、独自テーマを含む全テーマで共通に使えます。コンテナの `tone` は子孫へ継承され、子の指定で上書き、`tone=none` で解除できます。アイコンの絵柄は各ノードで指定し、継承しません。

```text
@deployment
container services "サービス" [tone=green] {
  node api "API" [icon=server]
  node auth "認証" [icon=shield-check tone=coral]
}
```

デフォルトはLucideです。AWS・Azure・Google Cloud・Kubernetes・Simple Iconsの追加パックを読み込めば、`icon=aws:application-auto-scaling` や `icon=simple:github` を指定できます。自分の画像は `image="./photo.png"`、丸型・角丸は `imageShape=circle`・`imageShape=rounded` で指定します。

これらは現在のリポジトリ版の機能です。`npm ci` と `npm run build` で作った本体を使ってください。[アイコンと画像の作例](./examples/icon-packs.html)、[アイコンガイド](./docs/icons_ja.md)、[パックの出典](./icon-packs/NOTICE.md)を参照してください。

## コーディングエージェントで図を作る

このリポジトリには、コーディングエージェントで使える [`finch` スキル](./.agents/skills/finch/SKILL.md)が含まれています。エージェントに次のように頼めます。

```text
Finch スキルを使って、注文審査フローのアクティビティ図を HTML に描いて。
```

Codex はこのチェックアウトからスキルを自動検出し、明示的に呼び出す場合は `$finch` を使えます。ほかのワークスペースや対応エージェントへインストールする場合は、次を実行します。

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

インストーラー上で対象エージェントを選べます。`--agent claude-code cursor` のように直接指定することもできます。すべてのリポジトリで使う場合は `--global` を追加し、インストール直後にスキルが表示されなければエージェントを再起動してください。

## Markdown に図と座標を保存する

図と座標をMarkdownの一つのコードフェンスに保存できます。[Markdown に図と座標を保存する](./docs/markdown_ja.md)で、`exportMarkdown()` と `Finch.renderMarkdown()` の使い方を確認できます。

## 詳しく知る

- [チュートリアル](./docs/tutorial_ja.md)：約15分で描画・配置・更新・保存・図法選びを試します。
- [リファレンス](./docs/reference_ja.md)：記法、編集操作、保存、イベント、画像出力、インスタンス API を確認できます。
- [発展例](./examples/README.md)：対応するすべての図法を、編集できる完成例で確認できます。
- [Finch.js の拡張](./docs/extensions_ja.md)：独自の図、Shape、Layout、Theme を追加します。
- [スライドパターン](./docs/slide-patterns_ja.md)：KPI、データストーリー、ロードマップ、比較、顧客の声を再利用できる形で組み立てます。

- [アプリへの組み込みと保存](./docs/embedding_ja.md)
- [ことばから図を作るデモ](./docs/generating_ja.md)
- [UML作例と追加記法](./examples/uml-guide.html)
- [include・繰り返し・関数](./docs/preprocessing_ja.md)
- [注釈とシーケンスのページ出力](./docs/annotations_ja.md)
- [プラグイン開発ガイド](./docs/plugin-development_ja.md)

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

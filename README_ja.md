# Tit.js

[English](./README.md)

🐦 **図はすばやく生成し、仕上げは思いどおりに。** Tit.js は短いテキストから整った SVG 図をすぐに生成します。ノードはドラッグして固定できるため、ソースを書き換えずにレイアウトを手で細かく調整できます。

[![ブラウザー、ゲートウェイ、カード、盾、星、データベース、書類の Shape を使った Custom service map](./docs/assets/custom-service-map.png)](./examples/extensions.html)

## 代表例

| UMLクラス図 | KPIサマリースライド |
| --- | --- |
| [![interface、継承、合成、依存、多重度を含む注文ドメインのUMLクラス図](./docs/assets/uml-class-diagram.png)](./examples/class.html) | [![3つの主要指標と1つの判断を示すKPIサマリースライド](./docs/assets/slide-pattern-kpi.png)](./examples/slide-patterns.html) |
| `@class` でモデルの構造と関係を表現 | `@slide` で主要指標と判断を一枚に集約 |

## クイックスタート：2ステップ

### 1. HTML にこれだけ書く

リポジトリのルートに `quickstart.html` を作り、次の内容を貼り付けます。

```html
<!doctype html>
<meta charset="UTF-8" />
<style>
  body { display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; margin: 0; }
  textarea { padding: 16px; font: 14px/1.6 monospace; }
  #diagram { padding: 24px; }
</style>

<textarea id="source">@deployment
node browser "Web ブラウザー" [shape=rounded]
server api "API サーバー"
database db "PostgreSQL"
browser -> api: HTTPS
api -> db: SQL</textarea>
<div id="diagram"></div>

<script src="./dist/tit.global.js"></script>
<script>
  const source = document.querySelector("#source");
  const host = document.querySelector("#diagram");
  const layoutKey = "tit-layout";
  const diagram = Tit.render(source.value, "#diagram");

  const saved = localStorage.getItem(layoutKey);
  if (saved) diagram.importLayout(saved);

  source.addEventListener("input", () => diagram.update(source.value));
  host.addEventListener("tit:layoutchange", ({ detail }) => {
    localStorage.setItem(layoutKey, JSON.stringify(detail.overlay));
  });
</script>
```

`quickstart.html` をブラウザーで開くと、テキストから図が生成されます。

### 2. ドラッグして保存する

図のノードをドラッグして配置を整えます。レイアウトはブラウザーへ自動保存され、ページを再読み込みしても復元されます。左のテキストを書き換えると、同じIDの配置を保ったまま図が更新されます。

詳しい説明は[2ステップのチュートリアル](./docs/tutorial_ja.md)、ほかの完成例は[発展例](./examples/README.md)で確認できます。

## 環境構築

`dist/tit.global.js` がまだない場合は、依存パッケージをインストールしてビルドします。

```bash
npm install
npm run build
```

HTTPで配信する場合は、ローカルサーバーを起動します。

```bash
python -m http.server 8000
```

ブラウザーで `http://127.0.0.1:8000/quickstart.html` を開いてください。ESモジュールでは `import Tit from "tit-js"` として読み込めます。

## Codex スキル

このリポジトリには、Tit.jsの図を描画するHTMLを作成・更新するための [Codexスキル `$tit`](./.agents/skills/tit/SKILL.md) が含まれています。図のソースは単独の `.tit` ファイルではなく、HTML内のJavaScript文字列として記述します。

### このリポジトリ内で使う

追加のインストール操作は不要です。このリポジトリ、またはその配下のディレクトリからCodexを起動すると、`.agents/skills/tit` が自動的に検出されます。次のように明示して呼び出せます。

```text
$tit アクティビティ図をHTMLに描いて
```

リポジトリの取得や更新後にスキルが表示されない場合は、Codexを再起動してください。

### Skills CLIでインストールする

[`skills` CLI](https://github.com/vercel-labs/skills) を使って、スキルの検出とインストールができます。ローカルに取得したTit.jsのディレクトリでは、次を実行します。

```bash
npx skills add . --skill tit
```

リポジトリをGitHubで公開した後は、リポジトリ名を指定して直接インストールできます。

```bash
npx skills add <owner>/<repository> --skill tit
```

すべてのリポジトリで `$tit` を使えるようにする場合は、`--global` を追加します。

```bash
npx skills add <owner>/<repository> --skill tit --global
```

インストールせずに利用可能なスキルを確認する場合は、`npx skills add <owner>/<repository> --list` を使います。Codexは新しく追加されたスキルを自動検出します。`$tit` が一覧に表示されない場合はCodexを再起動してください。Codexにおけるスキルのスコープと検出場所については、[OpenAI公式のスキルドキュメント](https://learn.chatgpt.com/ja-JP/docs/build-skills)を参照してください。

## ダイアグラムの種類

10種類の図で、アーキテクチャ、処理のやり取り、業務フロー、状態遷移、データモデル、コンポーネント構成、プレゼン用の図、主要なUMLビューを表現できます。

| ディレクティブ | 用途 | 主な宣言 |
| --- | --- | --- |
| [`@deployment`](./examples/deployment.html) | システムやインフラの構成 | `node`、`device`、`execution`、`artifact`、`server`、`database`、`container` |
| [`@sequence`](./examples/sequence.html) | 時系列のやり取り | `participant`、`actor`、メッセージ、`group`、`alt`、`opt`、`loop`、`par`、`critical`、`break` |
| [`@flowchart`](./examples/flowchart.html) | 手順や分岐 | `start`、`process`、`decision`、`input`、`output`、`end` |
| [`@state`](./examples/state.html) | 状態機械 | `initial`、`state`、`choice`、`fork`、`join`、`history`、`deep-history`、`final` |
| [`@er`](./examples/er.html) | エンティティと関連 | `entity`、フィールド、`pk`、`fk`、`unique`、多重度 |
| [`@component`](./examples/component.html) | ソフトウェア部品と境界 | `system`、`component`、`port`、`provided`、`required`、`artifact`、`external` |
| [`@slide`](./examples/slide.html) | プレゼン用の図 | `title`、`subtitle`、レイアウト、`card`、`metric`、`bar`、`quote`、`milestone`、`callout`、`arrow` |
| [`@class`](./examples/class.html) | UMLクラス図 | `class`、`abstract`、`interface`、`enum`、メンバー、UML関係、多重度 |
| [`@usecase`](./examples/usecase.html) | UMLユースケース図 | `actor`、`system`、`usecase`、`include`、`extend`、`generalize` |
| [`@activity`](./examples/activity.html) | UMLアクティビティ図 | `action`、`decision`、`merge`、`fork`、`join`、`object`、ガード |

KPI、データストーリー、ロードマップ、比較、顧客の声を再利用できる形で組む方法は、[スライドパターンガイド](./docs/slide-patterns_ja.md)または[動くパターン集](./examples/slide-patterns.html)で確認できます。

実線の矢印は `->`、破線は `-->` です。コロンの後ろにラベルを付けられます。

```text
api -> worker: ジョブを投入
worker --> api: 受付完了
```

ノード ID と表示ラベルは別です。表示名を変えても手動配置を引き継げるよう、ID は安定させてください。

```text
server billing-api "請求 API"
```

コメントは、行頭の `'`、または空白の後ろに置く `#` と `//` を使えます。

## 編集と保存

既定の SVG はそのまま編集できます。

- ノードをドラッグすると手動位置が記録されます。
- Ctrl／⌘／Shift を押しながらクリックすると複数選択でき、まとめて移動できます。
- ノードをダブルクリックすると固定と解除を切り替えます。
- 選択したノードは `P` で固定でき、`Escape` で選択を解除できます。
- Ctrl／⌘＋ホイールで拡縮し、Space／Alt＋ドラッグでスクロール可能な図をパンできます。
- `autoLayout()` は、固定していないノードを再配置します。
- `resetLayout()` は、すべての手動位置と固定を破棄します。

意味を表す DSL と、人が調整した配置は分けて保存します。

```js
const json = diagram.exportLayout();
localStorage.setItem("diagram-layout", json);

diagram.importLayout(localStorage.getItem("diagram-layout"));
```

ドラッグ、固定、レイアウト操作で overlay が変わると、SVG から `tit:layoutchange` イベントがバブリングします。`detail` には `{ overlay, changedNodeIds }` が入ります。

```js
diagram.svg.addEventListener("tit:layoutchange", ({ detail }) => {
  localStorage.setItem("diagram-layout", JSON.stringify(detail.overlay));
});
```

ライブエディターでは `diagram.update(nextSource)` を使います。同じ ID のノードは、既存の配置を引き継ぎます。生成した SVG の文字列が必要な場合は `diagram.toSvgString()` を呼び出してください。

表示倍率は、図の意味・座標・保存する layout overlay とは別に管理されます。初期の自動調整はコンテナより横に大きい図だけを縮小し、小さい図を100%より大きくしません。

```js
diagram.zoomIn();
diagram.zoomOut();
diagram.setZoom(1.25);
diagram.fit("diagram");
diagram.fit("width");
diagram.resetZoom();
```

既定の範囲は25〜200%です。`Tit.render()` の `minZoom` と `maxZoom` で変更できます。`tit:zoomchange` イベントの `detail` には、操作バーとの同期に使える `{ zoom, mode }` が入ります。

## テーマと拡張

組み込みテーマは描画時に選ぶほか、あとから切り替えられます。

```js
const diagram = Tit.render(source, {
  target: "#diagram",
  theme: "midnight",
});

diagram.setTheme("default");
diagram.setLayout("compact");
```

共有の既定 registry に影響させたくない場合は、拡張専用の engine を作ります。

```js
import { createTit } from "tit-js";

const tit = createTit();
tit.registerDiagram("custom", diagramPlugin);
tit.registerShape("custom-shape", shapePlugin);
tit.registerLayout("custom-layout", layoutPlugin);
tit.registerTheme("brand", themePlugin);
```

各 plugin の契約と実装例は [Tit.js の拡張](./docs/extensions_ja.md)で説明しています。custom diagram、カード型とアイコン型の shape、layout、theme をまとめて動かす[ブラウザー拡張例](./examples/extensions.html)も用意しています。

## API の概要

`Tit.render()` は `DiagramInstance` を返します。主な操作は次のとおりです。

| 操作 | 用途 |
| --- | --- |
| `update(source)` | 再解析・再描画し、同じ ID の配置を維持する |
| `setTheme(theme)` / `setLayout(name)` | 表示を切り替える |
| `select(ids)` / `clearSelection()` | コードから選択状態を操作する |
| `pin(ids)` / `unpin(ids)` | 手動位置を固定・解除する |
| `autoLayout()` / `resetLayout()` | 再配置する、または配置情報を消す |
| `setZoom(value)` / `zoomIn()` / `zoomOut()` | 表示倍率を操作する |
| `fit("diagram")` / `fit("width")` / `resetZoom()` | 全体・幅に合わせる、または100%へ戻す |
| `exportLayout()` / `importLayout(value)` | layout overlay を保存・復元する |
| `saveLayout(target?)` | JSON の script 要素へ overlay を書き込む |
| `toSvgString()` | 現在の SVG を文字列にする |
| `destroy()` | SVG を削除して instance を終了する |

パッケージには、公開 API と plugin interface の TypeScript 宣言が含まれています。

## 開発

```bash
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` は型検査、テスト、本番ビルドを順に実行します。ライセンスは [MIT](./LICENSE) です。

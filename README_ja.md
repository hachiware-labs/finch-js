# Finch.js <img src="./docs/assets/green-warbler-finch-silhouette-profile-pink.png" alt="横を向いたグリーンムシクイフィンチのピンク色のシルエット" width="56" align="middle" />

[English](./README.md)

🐦 **図はすばやく生成し、仕上げは思いどおりに。** Finch.js は短いテキストから整った SVG 図をすぐに生成します。ノードはドラッグして固定できるため、ソースを書き換えずにレイアウトを手で細かく調整できます。

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
  body { min-height: 100vh; margin: 0; }
  #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
</style>

<div id="diagram" aria-label="デプロイメント図"></div>

<script src="./dist/finch.global.js"></script>
<script>
  const deploymentSource = `
@deployment
node browser "Web ブラウザー" [shape=rounded]
server api "API サーバー"
database db "PostgreSQL"
browser -> api: HTTPS
api -> db: SQL
  `.trim();

  Finch.render(deploymentSource, {
    target: "#diagram",
    editor: { storageKey: "finch-quickstart" },
  });
</script>
```

`quickstart.html` をブラウザーで開くと、テキストから図が生成されます。

### 2. ドラッグして保存する

図のノードをドラッグして配置を整えます。図の左下にある Finch ボタンを開くと、図の直下へソース編集、Undo、SVG/PNG 出力が現れます。Save を押すまでは保存されず、保存後はページを再読み込みしても source と layout が復元されます。

詳しい説明は[2ステップのチュートリアル](./docs/tutorial_ja.md)、ほかの完成例は[発展例](./examples/README.md)で確認できます。

## 環境構築

npm から Finch.js をインストールします。

```bash
npm install @hachiware-labs/finch-js
```

デフォルトのインスタンスを読み込むか、独立したインスタンスを作成できます。

```js
import Finch, { createFinch } from "@hachiware-labs/finch-js";
```

ブラウザーグローバル版を使う場合は、バージョンを固定したCDN URLを指定します。

```html
<script src="https://cdn.jsdelivr.net/npm/@hachiware-labs/finch-js@0.5.1/dist/finch.global.js"></script>
```

Finch.js 本体を開発する場合は、リポジトリの依存パッケージをインストールしてビルドします。

```bash
npm ci
npm run build
```

HTTPで配信する場合は、ローカルサーバーを起動します。

```bash
python -m http.server 8000
```

ブラウザーで `http://127.0.0.1:8000/quickstart.html` を開いてください。

## Codex スキル

このリポジトリには、Finch.js の図を描く HTML を作成または更新するための [Codex スキル `$finch`](./.agents/skills/finch/SKILL.md) が含まれています。図のソースは単独の `.finch` ファイルではなく、HTML 内の JavaScript 文字列として書きます。

### このリポジトリ内で使う

追加のインストール操作は不要です。このリポジトリ、またはその配下のディレクトリからCodexを起動すると、`.agents/skills/finch` が自動的に検出されます。次のように明示して呼び出せます。

```text
$finch アクティビティ図をHTMLに描いて
```

リポジトリの取得や更新後にスキルが表示されない場合は、Codexを再起動してください。

### Skills CLIでインストールする

[`skills` CLI](https://github.com/vercel-labs/skills) を使って、スキルの検出とインストールができます。ローカルに取得した Finch.js のディレクトリでは、次を実行します。

```bash
npx skills add . --skill finch
```

リポジトリをGitHubで公開した後は、リポジトリ名を指定して直接インストールできます。

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

すべてのリポジトリで `$finch` を使えるようにする場合は、`--global` を追加します。

```bash
npx skills add hachiware-labs/finch-js --skill finch --global
```

インストールせずに利用可能なスキルを確認する場合は、`npx skills add hachiware-labs/finch-js --list` を使います。Codexは新しく追加されたスキルを自動検出します。`$finch` が一覧に表示されない場合はCodexを再起動してください。Codexにおけるスキルのスコープと検出場所については、[OpenAI公式のスキルドキュメント](https://learn.chatgpt.com/ja-JP/docs/build-skills)を参照してください。

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

### 長いノードの表示名

通常のノードでは、短い表示名を一行で表示します。表示名が長い場合は、単語の区切りで行を分けます。必要な場合は文字の間でも行を分け、すべての行を読めるようにノードの高さを広げます。

### Deployment の配置ヒント

Deployment のコンテナには `layout=row`、`layout=column`、`layout=grid` を指定できます。grid の列数は `columns`、直接の子 Shape の細かな位置は `order`、`row`、`column` で指定します。トップレベルのコンテナに `place=below` を付けると、後続の列を増やさず、接続元と同じ横位置の下側へ配置します。これらは自動配置へのヒントであり、正確な位置は従来どおりドラッグと固定で調整できます。

Flowchart は上から下へ読む縦方向が既定です。主経路は縦に進み、同じ分岐段階の Shape だけを横方向へ展開します。

State 図の fork/join 部分も縦方向に読みます。並行する State を上側の fork bar と下側の join bar で挟み、合流後の State をその下へ続けます。fork または join に接続する遷移は、自動的に上下の Port を使います。必要なら `[fromPort=bottom toPort=top]` で端点ごとに上書きでき、値には `top`、`right`、`bottom`、`left` を指定できます。

コメントは、行頭の `'`、または空白の後ろに置く `#` と `//` を使えます。

## 編集と保存

新しい図はエディットONで始まります。`setEditable(false)` で閲覧モードにすると、通常の左ドラッグはノード移動ではなく、画像内のパンになります。拡大、縮小、100%へのリセットは引き続き利用でき、Fit、レイアウト変更、Pin、ノード選択は無効になります。

```js
diagram.setEditable(false);
diagram.setEditable(true);
```

エディットONでは、SVGを次のように操作できます。

- ノードをドラッグすると手動位置が記録されます。
- Deployment の枠内にあるノードを動かすと、その枠と外側の枠の四辺が現在の内容に追随します。たとえば唯一の子を右へ動かすと、右端が伸びると同時に左側の余白も縮みます。枠自身の形状とラベルに必要な最小サイズよりは小さくなりません。
- Ctrl／⌘／Shift を押しながらクリックすると複数選択でき、まとめて移動できます。
- ノードをダブルクリックすると固定と解除を切り替えます。
- 選択したノードは `P` で固定でき、`Escape` で選択を解除できます。
- Ctrl／⌘＋ホイールで拡縮し、Space／Alt＋ドラッグでスクロール可能な図をパンできます。
- `autoLayout()` は、固定していないノードを再配置します。
- `resetLayout()` は、すべての手動位置と固定を破棄します。

意味を表す DSL と、人が調整した配置は分けて保存します。`exportLayout()` には `editable` フラグも含まれるため、エディットOFFで保存した図は閲覧モードのまま復元されます。フラグのない旧形式のoverlayはエディットONとして読み込みます。

```js
const json = diagram.exportLayout();
localStorage.setItem("diagram-layout", json);

diagram.importLayout(localStorage.getItem("diagram-layout"));
```

ドラッグ、固定、レイアウト操作、エディット切り替えでoverlayが変わると、SVGから `finch:layoutchange` イベントがバブリングします。`detail` には `{ overlay, changedNodeIds }` が入ります。エディット切り替え時は、ツールバー同期用の `finch:editchange` も発生し、`{ editable, overlay }` を受け取れます。

明示的な編集セッションでは、`changedNodeIds` が空でないときだけ変更ありとして記録し、利用者が Save を押したときだけ `exportLayout()` を保存します。Edit ON/OFF の切り替えでは保存しません。

ライブエディターでは `diagram.update(nextSource)` を使います。同じ ID のノードは、既存の配置を引き継ぎます。生成した SVG の文字列が必要な場合は `diagram.toSvgString()` を呼び出してください。

`Finch.render()` は標準エディターも追加します。生成された SVG 内の左下に Finch ボタンが組み込まれ、各種操作とソース編集ペインを図の直下へ開閉できます。エディターを閉じている間は閲覧モードになり、開くとその編集セッションの状態を復元します。Save は source と layout を `localStorage` へ保存し、Edit ON/OFF の切り替えでは暗黙に保存しません。UI 専用の Finch ボタンは SVG/PNG 出力から除外されます。

```js
const diagram = Finch.render(source, {
  target: "#diagram",
  editor: { storageKey: "system-map" },
});
```

メニューには Undo、Zoom、Fit、Pin、自動配置、Reset、SVG、PNG の操作が含まれます。編集UIが不要な図では `editor: false` を指定し、あとから追加する場合だけ `Finch.attachEditor()` を使います。

### 線の経路

組み込みの配置では、線を引くときに次の順で経路を選びます。

1. ノードを避けます。
2. 線どうしの交差を減らします。
3. 曲がり角を減らします。
4. 同じ条件なら短い経路を選びます。

この処理は、最初の描画、`update()`、配置の読み込み、ノードを動かした後の引き直しで使います。まず、ノードのまわりに余白を取ります。場所が狭い場合は余白を縮めますが、ノード本体は避けます。始点と終点では線の向きを保つため、矢印はノードの外側から境界へ向かいます。ノード同士が重なり、安全な経路を作れない場合は、線を消さず、これまでの基本経路を使います。

### SVG または PNG として保存する

`downloadSvg()` は現在の図を SVG として保存します。Finch ボタンを含む編集 UI は画像出力から除外されます。

```js
diagram.downloadSvg("system-map.svg");
```

`downloadPng()` を呼ぶと、現在の図を PNG ファイルとして保存できます。ノードを移動したあとの位置も画像へ反映されます。画面の表示倍率は PNG の大きさへ影響しません。

```js
await diagram.downloadPng("system-map.png");
```

ファイルを自分で送信または保存する場合は、`toPngBlob()` で `Blob` を取得します。`scale` には画像の倍率を指定できます。背景を透明にする場合は `background: null` を指定します。

```js
const png = await diagram.toPngBlob({ scale: 2 });
```

表示倍率は、図の意味・座標・保存する layout overlay とは別に管理されます。初期の自動調整はコンテナより横に大きい図だけを縮小し、小さい図を100%より大きくしません。

```js
diagram.zoomIn();
diagram.zoomOut();
diagram.setZoom(1.25);
diagram.fit("diagram");
diagram.fit("width");
diagram.resetZoom();
```

既定の範囲は25〜200%です。`Finch.render()` の `minZoom` と `maxZoom` で変更できます。`finch:zoomchange` イベントの `detail` には、操作バーとの同期に使える `{ zoom, mode }` が入ります。

## テーマと拡張

組み込みテーマは描画時に選ぶほか、あとから切り替えられます。

```js
const diagram = Finch.render(source, {
  target: "#diagram",
  theme: "midnight",
});

diagram.setTheme("default");
diagram.setLayout("compact");
```

共有の既定 registry に影響させたくない場合は、拡張専用の engine を作ります。

```js
import { createFinch } from "@hachiware-labs/finch-js";

const finch = createFinch();
finch.registerDiagram("custom", diagramPlugin);
finch.registerShape("custom-shape", shapePlugin);
finch.registerLayout("custom-layout", layoutPlugin);
finch.registerTheme("brand", themePlugin);
```

各 plugin の契約と実装例は [Finch.js の拡張](./docs/extensions_ja.md)で説明しています。custom diagram、カード型とアイコン型の shape、layout、theme をまとめて動かす[ブラウザー拡張例](./examples/extensions.html)も用意しています。

## API の概要

`Finch.render()` は `DiagramInstance` を返します。主な操作は次のとおりです。

| 操作 | 用途 |
| --- | --- |
| `update(source)` | 再解析・再描画し、同じ ID の配置を維持する |
| `setTheme(theme)` / `setLayout(name)` | 表示を切り替える |
| `select(ids)` / `clearSelection()` | コードから選択状態を操作する |
| `pin(ids)` / `unpin(ids)` | 手動位置を固定・解除する |
| `autoLayout()` / `resetLayout()` / `undoLayout()` | 再配置する、配置情報を消す、直前のレイアウト編集を戻す |
| `setZoom(value)` / `zoomIn()` / `zoomOut()` | 表示倍率を操作する |
| `setEditable(value)` / `editable` / `canUndo` | 編集モードを切り替え、Undo の可否を得る |
| `fit("diagram")` / `fit("width")` / `resetZoom()` | 全体・幅に合わせる、または100%へ戻す |
| `exportLayout()` / `importLayout(value)` | layout overlay を保存・復元する |
| `saveLayout(target?)` | JSON の script 要素へ overlay を書き込む |
| `toSvgString()` | 現在の SVG を文字列にする |
| `downloadSvg(filename?)` | 現在の図を SVG ファイルとして保存する |
| `toPngBlob(options?)` | 現在の図から PNG の `Blob` を作る |
| `downloadPng(filename?, options?)` | 現在の図を PNG ファイルとして保存する |
| `Finch.attachEditor(instance, options?)` | 図に追従する HTML 編集メニューとソースペインを追加する |
| `destroy()` | SVG を削除して instance を終了する |

パッケージには、公開 API と plugin interface の TypeScript 宣言が含まれています。

## 画像クレジット

- ヘッダーのシルエットは、Julien Renoult による[グリーンムシクイフィンチの写真](https://www.inaturalist.org/observations/9398069)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）を加工したものです。背景を除去し、鳥をシルエット化して単色化・再配置しています。
- フッターのシルエットは、Andrew Katsis による[*Green warbler-finch on Santa Cruz Island*](https://commons.wikimedia.org/wiki/File:Green_warbler-finch_on_Santa_Cruz_Island.jpg)（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）を加工したものです。背景を除去し、鳥をシルエット化して単色化・再配置しています。

## 開発

```bash
npm run typecheck
npm test
npm run build
npm run check
```

`npm run check` は型検査、テスト、本番ビルドを順に実行します。ライセンスは [MIT](./LICENSE) です。

<p align="right">
  <img src="./docs/assets/green-warbler-finch-silhouette-foraging-pink.png" alt="餌を探すグリーンムシクイフィンチのピンク色のシルエット" width="180" />
</p>

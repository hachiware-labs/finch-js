# アイコンと役割色

`icon` と `tone` を図のソースに記載できます。すべてのテーマで、コンテナの色が子孫ノードへ継承されます。アイコンの絵柄は継承せず、各ノードで指定します。

```html
<div id="diagram"></div>
<script src="../dist/finch.global.js"></script>
<script>
const source = `
@deployment
container security "Security" [tone=coral] {
  node auth "Auth Service" [icon=shield-check]
  artifact token "JWT" [icon=key-round]
}
auth -> token: Issue
`;
Finch.render(source, { target: '#diagram', theme: 'prism' });
</script>
```

## 色の指定

共通の役割色は `cyan`、`coral`、`green`、`amber`、`violet` です。
子に `tone` を書かなければ、最も近い祖先の指定を継承します。子に明示すると上書きされ、`tone=none` でテーマの基本色へ戻ります。未知の名前も基本色へ戻ります。
継承は描画時に解決され、ソースと意味モデルへ属性を追加しません。

独自テーマには `tones: { brand: { fill: '#102b3e', stroke: '#50d6ff', labelColor: '#ffffff' } }` のようなパレットを追加できます。`labelColor` は省略可能です。

## アイコンの指定

同梱する Lucide アイコンは `app-window`、`server`、`users`、`credit-card`、`radio`、`mail`、`file-chart-column`、`shield-check`、`key-round`、`database`、`hard-drive` です。
既存テーマも、今後登録する独自テーマも、追加の対応コードなしで使用できます。

対応する形状は rectangle、rounded、server、database、uml-artifact、uml-device、uml-execution です。例えば deployment の `artifact` は uml-artifact に対応します。コンテナや複数区画のクラス図などにはアイコンを描画しません。未知のアイコン名は無視します。

アイコンは22pxのSVGとして埋め込みます。レイアウト計算時にノード幅を32px広げるため、別途余白を指定する必要はありません。ソース更新、再レイアウト、SVG・PNG書き出しにも反映され、外部フォントや実行時の通信は不要です。

独自アイコンはテーマから独立したレジストリに登録します。例：`Finch.registerIcon('dot', [{ tag: 'circle', attributes: { cx: '12', cy: '12', r: '6' } }])`。登録は Finch エンジン単位で、テーマを替えても同じ絵柄を使えます。使用できる要素は path、rect、circle、ellipse、line、polyline、polygon です。座標属性のみを描画し、イベント属性や外部参照は受け付けません。

## 追加パック

AWS・Azure・Google Cloud・Kubernetes・Simple Icons の5パックを同梱しています。本体には組み込まず、必要なファイルだけを読み込みます。

```html
<script src="../dist/finch.global.js"></script>
<script src="../icon-packs/aws.js"></script>
<script src="../icon-packs/simple.js"></script>
```

ES Modulesでは次のように登録します。

```js
import Finch from '@hachiware-labs/finch-js';
import aws from '@hachiware-labs/finch-js/icon-packs/aws';
Finch.registerIconPack('aws', aws);
```

```text
node scale "Auto Scaling" [icon=aws:application-auto-scaling]
node repo "GitHub" [icon=simple:github]
node pod "Pod" [icon=k8s:pod]
```

名前の一覧は `icon-packs/catalog.json` にあります。カテゴリ付きの名前も使用できます。パック内の画像は埋め込み済みで、表示時の通信は不要です。クラウド系はDiagramsの固定版コレクションを取り込んでおり、各社の最新公式セットを網羅するものではありません。出典・版・ライセンスは `icon-packs/NOTICE.md` にあります。画像アイコンは元の色を保つため、暗いテーマで黒いロゴなどが見えにくい場合は適した画像を指定してください。

独自の画像アイコンも `Finch.registerIcon('company:logo', { src: './logo.svg' })` で登録できます。

## 自分の画像とURL

```text
node original "元の縦横比" [image="./photo.png"]
node me "担当者" [image="./photo.png" imageShape=circle]
node app "自社サービス" [image="https://example.com/logo.svg" imageShape=rounded]
```

相対パスはHTMLの場所を基準にします。PNG・JPEG・GIF・WebP・SVG、および画像のdata URLを使えます。`image` と `icon` を併記した場合は画像を優先します。形状の省略時は縦横比を維持して枠内に収め、circle・roundedは中央を切り抜きます。

`downloadSvg()` と `downloadPng()` は画像を取得して埋め込んでから保存します。両方ともPromiseを返すので、失敗はcatchで表示してください。`toSvgString()` は同期で参照を残し、`await toEmbeddedSvgString()` は画像を埋め込んだ文字列を返します。

外部画像の取得には配信元のCORS許可が必要です。file://で開いたローカル画像は表示できても書き出し時の取得をブラウザが拒否する場合があるため、HTTPで開くかdata URLを使ってください。取得失敗時は欠落したまま保存せずエラーを返します。編集用HTMLの保存はソースの画像参照を保持するので、画像・パック・ランタイムも一緒に配布してください。

[全パックと画像の例](../examples/icon-packs.html)

Lucide のライセンスは配布物の `LUCIDE-LICENSE.txt` に含めています。

継承の解決はテーマとShapeの手前で共通に行います。配色定義は任意です。省略した共通toneは、そのテーマの基本の塗りと共通の役割色で描画するため、green・coralなどの区別が保たれます。一部のtoneだけをテーマで上書きすることもできます。



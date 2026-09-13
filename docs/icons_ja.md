# アイコン・役割色・画像

[English](icons.md) · [チュートリアル](tutorial_ja.md)

この節では現在のリポジトリ版を使います。リポジトリのルートで `npm ci`、`npm run build`、`python -m http.server 8000` を実行してください。次のHTMLを `examples/` 内に保存し、HTTPで開きます。画像の `image-avatar.svg` はそのフォルダに用意されています。別の場所に保存する場合は、スクリプトと画像の相対パスを変更します。

```html
<!doctype html>
<meta charset="UTF-8" />
<div id="diagram"></div>
<script src="../dist/finch.global.js"></script>
<script src="../icon-packs/aws.js"></script>
<script src="../icon-packs/simple.js"></script>
<script>
const source = `
@deployment
container services "Services" [tone=green] {
  node api "API" [icon=server]
  node auth "Auth" [icon=shield-check tone=coral]
}
node scale "Auto Scaling" [icon=aws:application-auto-scaling]
node repo "GitHub" [icon=simple:github]
node owner "Owner" [image="./image-avatar.svg" imageShape=circle]
api -> scale
owner -> repo
`.trim();
const diagram = Finch.render(source, { target: '#diagram', theme: 'prism' });
</script>
```

### 全テーマ共通の属性

- `icon=server` は同梱のLucideアイコンです。定義はテーマから独立して、Finchエンジンが管理します。
- `tone` は指定のある最も近い祖先から継承します。子の指定で上書き、`tone=none` でその配下も含め基本色へ戻します。
- 共通色は `cyan`・`coral`・`green`・`amber`・`violet` です。テーマの配色定義は任意で、未定義の色には共通の役割色とテーマの基本の塗りを使います。
- 属性を変えずに `theme` を `default`・`midnight`・独自テーマオブジェクトへ切り替えられます。Business・Precision・Editorialは独自テーマの作例で、組み込みのテーマ名ではありません。

### 必要なパックを読み込む

| `icon-packs/` 内のファイル | 指定例 |
| --- | --- |
| `aws.js` | `icon=aws:application-auto-scaling` |
| `azure.js` | `icon=azure:virtual-machine` |
| `gcp.js` | `icon=gcp:compute-engine` |
| `k8s.js` | `icon=k8s:pod` |
| `simple.js` | `icon=simple:github` |

各スクリプトは `finch.global.js` の後に読み込みます。パックは画像埋め込み済みで、表示時の通信は不要です。本体とは別ファイルなので、必要なものだけを選べます。名前と別名は[カタログ](../icon-packs/catalog.json)、配布元・版は[出典](../icon-packs/NOTICE.md)を参照してください。クラウド系は第三者コレクションの固定版で、各社の最新画像を保証するものではありません。ブランド画像は元の色を保ち、Lucideの線色は継承後のtoneに従います。

ES Modulesでは、このリポジトリから作ったパッケージの `@hachiware-labs/finch-js/icon-packs/aws` から `aws` をimportし、`Finch.registerIconPack('aws', aws)` で登録します。独自画像は `Finch.registerIcon('company:logo', { src: './logo.svg' })` と登録することもできます。

### 自分の画像を指定する

`image="./photo.png"` の相対パスはHTMLの場所が基準です。画像を直接返すHTTP(S) URLや画像のdata URLも使えます。PNG・JPEG・GIF・WebP・SVGに対応し、`icon` と併記した場合は `image` を優先します。

`imageShape` を省略すると縦横比を保って枠内に収めます。`circle` は丸型、`rounded` は角丸の正方形に切り抜きます。SVG自体に余白や縦横比の設定がある場合も含め、アバターには正方形の素材を使うと形を整えやすくなります。

現在の対応Shapeはrectangle・rounded・server・database・uml-artifact・uml-device・uml-executionです。コンテナや複数区画のクラス・エンティティには画像を追加しません。未知のアイコン名は無視します。

### 画像を含めて書き出す

```js
try {
  await diagram.downloadSvg('services.svg');
  // PNGの場合: await diagram.downloadPng('services.png');
} catch (error) {
  console.error('画像の書き出しに失敗しました:', error);
}
```

SVG・PNG保存では参照画像を取得し、埋め込んでから書き出します。外部画像には配信元のCORS許可が必要です。file://の画像取得は拒否される場合があるため、ローカル画像はHTTPで開いてください。失敗時は画像を欠落させたまま保存せず、エラーを返します。`toSvgString()` は参照を残し、`await toEmbeddedSvgString()` は画像を埋め込んだSVG文字列を返します。

編集用HTMLの保存は元の画像参照を保持します。HTMLを渡すときは、参照画像・パック・ランタイムも一緒に配布してください。自動で画像を含む単一HTMLにする機能ではありません。

[全パックと画像の完成例](../examples/icon-packs.html)で試せます。

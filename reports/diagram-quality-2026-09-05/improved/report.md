# Finch.js 図の品質改善（2026-09-05）

前回の3ケースを、同じソース・同じ2テーマで再描画。座標や改行の個別指定なし。

## 変更内容

- 縦方向 Graph のグループを子要素と一緒に離して配置。内側から外側へ枠を調整し、保存済み位置・ピン留めを尊重。
- flowchart / activity / graph の菱形から出る条件分岐を別の出口に割り当て、分岐線の共有を避ける経路を優先。明示ポート指定は維持。
- 端点の輪郭上をなぞる経路を回避。同じ側同士の接続は外向きに折り返す。再ルーティングでも図の方向を維持。
- 日本語の単語境界、数値・単位、禁則に配慮した折り返しと、末尾の短い行の調整。

既存の文字計測・図形寸法の改善を維持して検証。菱形の文字収容の変化には、この既存実装も含まれる。

## 検証

- npm run check: 全143テスト（うち今回の回帰テスト9件）、型チェック、ビルド成功。
- HTML DSL validator: 3ソース成功。
- ブラウザー実描画: 3ケース × 2スタイル。改善後は部門枠の重なり、金額分岐の共有区間、矩形ノードの縁に沿う線、菱形から出る文字領域がすべて0。
- 比較の基準と測定結果は verification.json。菱形は行ごとの getBBox の四隅と輪郭を比較（正規化距離の許容値 1.01）。視覚的な文字の画素そのものとは区別する。
- 固定したノードを含む枠同士が重なる場合は、固定を尊重するため自動解消できないことがある。

## 再描画手順

リポジトリルートから npm run check を実行後、dist/finch.global.js をこのディレクトリの assets/finch.global.js にコピーする。

```powershell
node reports/diagram-quality-2026-09-05/render.mjs reports/diagram-quality-2026-09-05/improved
node reports/diagram-quality-2026-09-05/improved/verify-results.mjs
node reports/diagram-quality-2026-09-05/improved/build-review.mjs
node reports/diagram-quality-2026-09-05/improved/verify-review.mjs
```

render.mjs は前回比較で使用したローカルの Mermaid と Playwright を参照。D2 の SVG は前回のものを再利用する。比較ページ自体は SVG を埋め込んであり、ネットワーク接続を必要としない。

ブラウザーバンドル SHA-256: fd91c3de95833e3b0c09cf32d08c7890996e1fe497fce76fa9d3a70170abecad

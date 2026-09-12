# 注釈とシーケンスのページ出力

注釈は、説明の対象と本文を指定します。対象はノードID、メッセージID、またはクラスのメンバーです。注釈を追加しても、シーケンスの採番や状態図の遷移は増えません。

## 対象を指定する

HTML内のJavaScriptで、図のソースと描画処理をまとめて記述します。

```javascript
const source = `@sequence
autonumber
client -> api: 注文要求 [id=request]
note request "同じ要求を再送しても二重登録しない"
api --> client: 受付結果`;
const diagram = Finch.render(source, { target: '#diagram' });
```

`note api "説明"` は参加者への注釈です。`note client->api "説明"` も使えますが、その組み合わせに複数のメッセージがある場合はエラーになります。`[id=request]` を付け、`note request` で一意に指定してください。ノードとメッセージには異なるIDを使います。同じIDの場合、注釈の対象はノードが優先されます。

遅延を併用する場合は `[id=request delay=12]` と書けます。属性の順番は自由です。

## 複数行・形状・配置

```javascript
const source = `@sequence
participant api
hnote left of api
外部APIへの入口

認証後に処理を開始する
end hnote`;
Finch.render(source, { target: '#diagram' });
```

| 記法 | 形状 |
| --- | --- |
| `note` | 右上を折り返した注釈 |
| `rnote` | 長方形 |
| `hnote` | 六角形 |
| `constraint` | 本文を波括弧で囲む制約注釈 |

複数行の終端は、それぞれ `end note`、`end rnote`、`end hnote`、`end constraint` です。本文の空行・引用符・バックスラッシュを保持し、本文中の `newpage` などは命令として扱いません。各行の前後の空白は除去します。

`left of`、`right of`、`top of`、`bottom of` で配置側を指定できます。自動配置では図の外側に注釈を並べます。指定しない場合は右側です。左右の列は独立して配置します。必要ならエディターでドラッグして調整できます。

## クラスの属性・操作を説明する

```javascript
const source = `@class
class Worker {
 +start()
 +start(int timeout)
}
rnote left of Worker::start(int timeout)
待機時間の上限を指定する
end rnote`;
Finch.render(source, { target: '#diagram' });
```

属性名や操作のシグネチャを使ってメンバーを指定できます。複数のオーバーロードに一致する名前だけの指定はエラーになります。名前空間内ではローカルなクラス名も解決します。クラスのメンバー本文に書いた注釈風の文字列は、外部注釈として処理しません。

## 改ページと注釈

```javascript
const source = `@sequence
footer "%page% / %lastpage%"
client -> api: 注文要求 [id=request]
newpage "補足"
note request
要求の監査情報を保存する
end note`;
const diagram = Finch.render(source, { target: '#diagram' });
const svgPages = diagram.toSvgPages();
const pngPages = await diagram.toPngPages({ scale: 2 });
```

標準エディターの **Pages** でも、各ページのプレビューとSVG・PNG保存を利用できます。注釈だけのページにも対応します。別ページのメッセージへの注釈には、参照先のページ番号・送受信者・メッセージ名を表示します。生成前・破棄後の参加者への注釈では、参加者を復活させず対象名を表示します。

ページ別出力では `%page%` が現在ページ、`%lastpage%` が総ページ数になります。ソースの変数は保持されます。`ignore newpage` を追加すると1ページにまとめられ、削除すると分割に戻せます。

HTML保存ではソース・配置・テーマを復元します。ページのPNGボタンは、クリックしたプレビューの内容を保存します。

## 現在の範囲

- 複数行記法は、もともと注釈に対応している図種で利用できます。
- `note over a,b: 説明` は参加者を跨ぐ注釈行です。`note over a,b` から `end note` までの複数行記法も使えます。`rnote over` は長方形、`hnote over` は六角形です。通常の `note over` は折り返し付きです。全参加者を跨ぐ場合は `note across: 説明`、または `note across` / `end note` を使います。後から宣言する参加者も含みます。
- ページ別シーケンス出力は、注釈の所属ページを優先して配置し直します。上下配置を元の図と同じ位置関係で保つ処理は未検証です。
- PlantUMLのソースをそのまま読み込む機能ではありません。

[チュートリアルに戻る](tutorial_ja.md) · [リファレンス](reference_ja.md)

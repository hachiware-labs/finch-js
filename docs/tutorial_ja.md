# Finch.js チュートリアル

[English](./tutorial.md) · [README に戻る](../README_ja.md)

所要時間の目安は15分。描く → 動かす → 書き換える → 保存する → 図法を選ぶ、の5ステップです。テキストエディターとブラウザー、CDN読み込み用のネット接続を用意してください。

## 1. 最初の図を表示する

次を `order-flow.html` としてUTF-8で保存し、ブラウザーで開いてください。公開済みの0.5.1を使うため、インストールやビルドは不要です。ネット接続が必要です。

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>注文処理フロー</title>
    <style>
      body { margin: 0; background: #f8fafc; }
      #diagram { min-height: 100vh; overflow: auto; padding: 24px; }
    </style>
  </head>
  <body>
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

      const diagram = Finch.render(orderFlowSource, { target: "#diagram" });
    </script>
  </body>
</html>
```

縦に進む注文処理と、図の左下に小さなピンクの鳥アイコンが表示されれば成功です。

次は、自動生成された配置を自分の図へ仕上げます。

[![正常経路と在庫切れを分けた注文処理](./assets/tutorial-order-ja.png)](../examples/tutorial-order-ja.html)

画像と作例はリポジトリ版のため、細部の見た目が異なる場合があります。正常経路と例外の関係が読めれば、対称性や交差ゼロを目指して整え続ける必要はありません。

## 2. ドラッグして固定する

ピンクの鳥アイコンを押してください。図の下にエディターが開き、レイアウトを編集できるようになります。

次の順に操作します。

1. `入荷待ち` を正常系の経路から少し離れた場所へドラッグします。
2. そのノードをダブルクリックして固定します。Pin の印が表示されます。
3. ほかのノードも動かしますが、こちらは固定しません。
4. **Auto layout** を押します。

固定したノードは手で決めた位置に残り、固定していないノードだけが再配置の対象になります。**Undo** は直前の配置へ戻し、**Reset** は手動位置と固定をすべて破棄します。

次は、配置をやり直さずに図の意味を変更します。

## 3. 配置を保ったままソースを変える

エディターの Source 欄で、次の行を書き換えます。

先に `在庫を確認する` をドラッグして位置を変えておきます。表示名を書き換えるときは、IDの `validate` を変えないでください。

```text
process validate "在庫と引当可能数を確認する"
```

少し待つと図が更新されます。表示文言は変わりますが、`validate` という ID は同じなので、手で整えた位置は変わりません。

続いて新しい副作用を追加します。`reserve` の宣言の次に、次の行を加えてください。

```text
process audit "引当結果を記録する"
```

`reserve -> confirmed` の次に、次の線を加えます。

```text
reserve --> audit: 非同期
```

新しい `audit` は自動配置へ入り、既存 ID に対応する手動位置は引き継がれます。意味が増えて余白が必要になったら、新しいノードをドラッグするか **Auto layout** で全体へなじませます。長く使う同一性は ID に、あとから変わりうる表現は表示名に持たせるのがポイントです。

次は、ソースと配置をどこへ保存するか決めます。

## 4. ソースと配置を保存する

このチュートリアルの **0.5.1** では、**Save** を押すとソースと配置をブラウザーのローカルストレージに保存します。同じブラウザーで同じファイルを再読み込みし、変更した表示名と固定位置が復元されることを確認してください。HTMLファイルそのものは書き換わりません。

ローカルファイルの保存がブラウザーに制限される場合は、ファイルのあるフォルダーで `python -m http.server 8000` を実行し、`http://localhost:8000/order-flow.html` で保存・再読み込みを試してください（Pythonが必要です）。

リポジトリ版のSaveは編集可能なHTMLを保存します。[HTML保存](saving_ja.md)、[Markdown保存](markdown_ja.md)、[アプリへの組み込み](embedding_ja.md)は必要になったときに進めます。

次は、答えたい問いから図法を選びます。

## 5. 図法を選ぶ

| 読み手が知りたいこと | 最初に試す図法 | 作例 |
| --- | --- | --- |
| ソフトウェアがどこで動くか | `@deployment` | [本番サービス](../examples/deployment.html) |
| 型を決めずに要素同士の関係を見たい | `@graph` | [コマースシステムマップ](../examples/graph.html) |
| 何がどの順番で起きるか | `@sequence` | [購入処理の呼び出し](../examples/sequence.html) |
| 手順がどう分岐するか | `@flowchart` | [審査フロー](../examples/flowchart.html) |
| 状態がどう変わるか | `@state` | [ジョブのライフサイクル](../examples/state.html) |
| データがどう関係するか | `@er` | [注文データ](../examples/er.html) |
| ソフトウェアの責任境界がどこか | `@component` | [アプリケーション境界](../examples/component.html) |
| クラスがどう関係するか | `@class` | [注文ドメイン](../examples/class.html) |
| 利用者がシステムで何をしたいか | `@usecase` | [システムの目的](../examples/usecase.html) |
| UML のアクションがどう協調するか | `@activity` | [注文アクティビティ](../examples/activity.html) |
| プレゼンで何を一つ伝えるか | `@slide` | [KPI サマリー](../examples/slide-patterns.html) |
| 信号や状態がいつ変わるか | `@timing` | [Timing](../examples/timing.html) |

最初から全語彙を覚えず、目的に近い作例を開いてソースを変更してください。[リファレンス](./reference_ja.md)には、よく使う宣言とすべての完成例へのリンクがあります。


作例とリファレンスはリポジトリ版を対象とし、timing・UML追加記法などは0.5.1に含まれません。[ローカルでの実行手順](../README_ja.md#開発)を参照してください。

## 次に進む

- [エージェント連携](agents_ja.md)
- [ことばから図を作るデモ](generating_ja.md)
- [アプリへの組み込み](embedding_ja.md)
- [アイコン・色・画像](icons_ja.md)
- [UML example guide](../examples/uml-guide.html)

# 実用UMLの追加記法

[編集できるサンプル](../examples/uml-practical.html)。現在のリポジトリビルドで利用できます。既存の簡潔な記法に、必要な意味を明示する短い指定を追加しています。

## シーケンス

| 記法 | 意味・表示 |
|---|---|
| `a -> b: call` | 同期呼び出し。実線・塗りつぶした矢印。 |
| `a ->> b: event` | 非同期通知。実線・開いた矢印。自動の実行区間は開始しない。 |
| `b --> a: result` | 応答。破線・開いた矢印。 |
| `activate b` | 直前のメッセージ位置で実行区間を開始。入れ子にできる。 |
| `deactivate b` | 対応する明示的な実行区間を終了。 |
| `create b "Worker"` | 次の `a -> b` の位置で参加者を生成。次のメッセージはb宛てにする。 |
| `destroy b` | 直前のメッセージ位置でライフラインを終了し、×を表示。 |

```text
@sequence
participant api
participant queue
api ->> queue: enqueue
create worker "Worker"
queue -> worker: start
activate worker
worker --> queue: done
deactivate worker
destroy worker
```

`activate`を指定した参加者は、その図内では明示制御になります。それ以外は従来どおり同期呼び出し・応答から推定します。開いたままの区間は図の末尾まで続き、破棄時には終了します。複雑な分岐では各区画で開始・終了を明示してください。分岐条件の評価はしません。分岐ごとの寿命に対応し、合流後の利用を全経路で検証します。詳しくは[追加対応](uml-complete_ja.md)を参照してください。

従来同じ見た目だった `->>` は非同期通知として描画されるようになりました。`-->>` は応答の別表記です。

## 状態内の処理

```text
@state
state running "実行中"
entry running "タイマー開始"
do running "ジョブ処理"
internal running "refresh / 設定を再読込"
exit running "タイマー解除"
```

状態内の区画に処理を表示します。`internal` は内部遷移の説明として表示し、外部への遷移や自己遷移を追加しません。複合状態の場合は見出し内に表示します。イベントや処理を実行する機能ではありません。

## ステレオタイプとメンバー

```text
stereotype api "service"
```

既存の要素へ `«service»` を追加します。ラベルを表示する図形で利用できます。初期状態などラベルを表示しない記号には使わないでください。クラスではinterfaceなどの種別と併記します。

```text
@class
class Registry {
 static +count: int
 abstract +resolve(id: UUID): Entity
}
stereotype Registry "service"
```

メンバーの前に `static` を付けると下線、`abstract` を付けると斜体で表示します。可視性の `+` / `-` / `#` は従来どおりです。

## 短いループ

```text
@activity
start begin
while items "未処理あり？" {
 action load "次を読む"
 repeat retry "再試行する？" {
  action send "送信する"
 }
 action save "結果を記録"
}
end done
begin -> items
items.done -> done
```

`while` は前判定、`repeat` は後判定です。条件がyesの間、繰り返します。ブロック内のaction/activity/objectをソース順につなぎ、戻り線と出口を自動生成します。入れ子も使えます。

入口はループID、出口は `ID.done`。`repeat` の判定は `ID.test` です。これらのIDは予約されるため、他の宣言と重複させないでください。ループ内にif/else、break/continue、任意の接続線を書けます。レーンはループの外側で宣言します。空のループはエラーです。

## 関連端名・関連クラス

```text
@class
class User {
}
class Team {
}
class Membership {
 -role: String
 -joinedAt: Date
}
User "*" -- "*" Team [fromRole=members toRole=teams]
association Membership User->Team
```

`fromRole` / `toRole` は始点／終点側の関連端名です。多重度と合わせて表示します。`association` は宣言済みのクラスを関係線の中央へ破線で結びます。`User->Team` は関係の検索指定であり、方向付き関連を追加する意味ではありません。

同じ始点・終点の関係が複数ある場合は[id=名前]を付け、associationでその名前を指定します。関連クラス自身から別クラスへの直接の関係線も使用できます。関連クラスへの注釈・制約は使用できます。

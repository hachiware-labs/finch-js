# 簡潔なUML拡張

[編集できるサンプル](../examples/uml-concise.html)に、次の記法を含む4種類の図を掲載しています。現在のリポジトリのビルドを使用してください。

## 注釈と制約

```text
note Order "確定後は変更しない"
constraint Item "quantity > 0"
note api->stock "引き当ては冪等"
```

`note` は要素または接続に説明を付けます。`constraint` は同じ位置に `{条件}` を表示します。配置は図の右側で自動調整され、注釈を手動で動かすこともできます。接続指定が複数の接続に一致する場合は、ソースで最初に書かれた接続が対象です。注釈はレイアウトの主経路やシーケンスの参加者数に影響しません。制約は説明の表示であり、実行・検証されません。

対象は配置・コンポーネント・ユースケース・クラス・状態・アクティビティ・シーケンス・グラフ・フローチャート・ERです。スライドの `note` は従来の記法を使います。

## シーケンスの分岐

```text
@sequence
alt 在庫あり
 api -> stock: 引き当て
 stock --> api: 成功
else 在庫なし
 api --> user: 入荷待ち
end
```

`alt` の区画を `else 条件`、`par` の区画を `and 説明` で分けます。複数区画と入れ子に対応します。空の区画や、対応する枠のない区切りはエラーになります。実行区間は自動表示に加え、`activate`・`deactivate` で明示制御できます。[実用UML記法](./uml-practical_ja.md)を参照してください。

## 複合状態と並行領域

```text
@state
state running "処理中" {
 region payment "決済" {
  state charged "決済済み"
 }
 region shipping "配送" {
  state packed "梱包済み"
 }
}
```

`state id { ... }` を入れ子にできます。複合状態の直接の子をすべて `region` にすると、並行領域として横並びに配置します。各領域の内部は縦流れです。遷移先には複合状態自体も指定できます。領域は枠で区分して表示します。UML状態機械の実行や完了条件の検証は行いません。

状態図の標準は縦流れです。平坦な図を横流れにする場合は `@state direction=LR` を使います。入れ子の構造は縦流れで配置します。

## アクティビティのレーン

```text
@activity
lane user "利用者" {
 action submit "注文"
}
lane api "サービス" {
 action validate "検証"
}
submit -> validate
```

`lane` に処理を所属させるだけで、担当別の縦レーンと共通の進行順を作ります。レーンはソース順に横並びになります。レーンの入れ子は未対応です。レーン外の処理は左側に配置します。

## クラスのパッケージ

```text
@class
package domain "ドメイン" {
 class Order {
  +confirm(): void
 }
}
package app "アプリケーション" {
 class Checkout {
  +execute(): void
 }
}
Checkout ..> Order
```

パッケージは入れ子にでき、所属クラスを囲みます。クラス間の関係は従来と同じ記法です。

すべてのブロックでIDは図全体で一意にします。ブロックによるローカル名前空間はまだありません。今回の拡張はPlantUML構文の完全互換やUML全機能対応を意味しません。

# UML拡張と検証範囲

[編集できる7つのサンプル](../examples/uml-complete.html)

## 分岐ごとのシーケンス

alt/parの各区画は、入口の実行区間・寿命の状態から解析します。別の区画で開始した実行区間をdeactivateする記述はエラーです。同じ参加者を別々のalt区画でcreate/destroyできます。生成ヘッダー・破棄記号・実行区間も区画ごとに描画します。

合流後の利用は全経路で安全な場合に限ります。いずれかの経路で破棄済み、または任意区画でしか生成されない参加者へのメッセージはエラーになります。opt/loopは実行しない経路も考慮します。parの複数区画が同じ参加者の寿命を変更する場合は衝突としてエラーにします。ガードを評価して経路の実現可能性を証明する機能ではありません。

## ループ内の分岐

```text
@activity
while batch "未処理あり？" {
 action read "読む"
 if skip "スキップ？" {
  continue
 }
 if stop "中止？" {
  break
 }
 action save "保存"
}
```

`if id "条件" { ... }` と別行の `else { ... }` を使えます。breakは最も内側のループの出口、continueはそのループの判定へ進みます。repeatでもcontinueは後判定へ進みます。条件はyesで繰り返し、noで終了です。

ループ内にdecision/merge/fork/joinや通常の接続線も書けます。明示的な出力線を持つノードでは暗黙の次ノードへの接続を生成しません。`.done`、`.test`、`.breakN`、`.continueN` は生成用IDです。レーンはループの外側で宣言します。

## 状態図のイベント

```text
waiting -> retry: after(5s)
waiting -> retry: at(deadline)
waiting -> ready: when(responseReady)
defer waiting "refresh"
```

after/atは時間イベント、whenは変化イベントとしてtriggerKindを保持します。deferは状態内に `refresh / defer` と表示します。時間式やイベント条件は文字列として保持し、実行しません。`invariant state "条件"` は状態不変条件を表示します。

## プロトコル状態機械

```text
@state protocol validation=strict
state closed
state opened
closed -> opened: open() [pre="authorized" post="isOpen"]
```

事前条件・操作・事後条件を `[authorized] open() / [isOpen]` と表示し、pre/postを別々に保持します。プロトコルでは動作効果や状態内実行処理、履歴を診断します。操作が所属するクラスの存在や、事前・事後条件の論理的含意までは検証しません。

## 継承と再定義

```text
machine Base {
 state idle
 state active
 idle -> active: start [id=run]
}
machine Derived extends Base {
 idle -> active: retry [id=run]
}
state process [submachine=Derived]
```

基底のノードと遷移を継承し、同じIDの宣言で再定義します。遷移を再定義するときは明示的なidを付けてください。未定義の基底と継承の循環はエラーです。継承後の構造も検査します。解析結果のstateMachinesには継承を解決したモデルと、その定義を単独で描けるsourceを保持します。外部のクラス分類器を含むUML全体の再定義適合性の証明ではありません。

## 複数接続点の参照

`entryPoint input [state=job ref=prepare,reserve]` のようにカンマで複数の定義点を参照できます。exitPointも同様です。すべての参照について、存在・入口／出口の種別・重複を検証します。参照名はツールチップにも表示します。

## 関連クラス

```text
User -- Team [id=membership]
association Membership membership
Membership --> Policy
```

関連クラス自身から通常の関連を出せます。同じ端点を持つ複数関連はidで選択します。従来の `association Membership User->Team` も使えますが、対象が複数なら曖昧さをエラーにします。

## サンプル検査

examples内の静的なUMLソースをテストで列挙し、パースと状態図の診断を確認します。state-semantics.htmlのinvalidSourceだけは診断表示のための意図的な不正例です。古いstate.htmlとuml-review.htmlは並行領域を明示し、不適切だった履歴の接続を除去しました。履歴の実用例はstate-advanced.htmlにあります。

実行シミュレーション、ガードの網羅性判定、完全なUMLメタモデル適合性証明は今回の対象外です。

参照: [Eclipse UML2 ProtocolTransition](https://download.eclipse.org/modeling/mdt/uml2/javadoc/5.2.0/org/eclipse/uml2/uml/ProtocolTransition.html)、[ProtocolStateMachine](https://download.eclipse.org/modeling/mdt/uml2/javadoc/4.1.0/org/eclipse/uml2/uml/ProtocolStateMachine.html)。

# スライドパターン

[English](./slide-patterns.md) · [動くパターン集を開く](../examples/slide-patterns.html) · [READMEに戻る](../README_ja.md)

`@slide` には、プレゼンテーションで使いやすい要素を小さく揃えています。`row`、`column`、`grid` で組み合わせ、描画キャンバスとしてではなく「一枚で一つの主張を伝える」ために使います。

## パターン一覧

| パターン | 中心となる要素 | 向いている用途 |
| --- | --- | --- |
| KPIサマリー | `metric` + `callout` | 重要な数値と、そこから導く判断を示す |
| データストーリー | `bar` + `callout` | 項目を比較し、結論を一つに絞る |
| 比較 | `card` + `arrow` | Before/After、選択肢、変化を示す |
| ロードマップ | `milestone` + `arrow` | 少数の段階や判断ゲートを示す |
| 顧客の声 | `quote` + `metric` | 定性的な声に定量的な裏付けを添える |

[動くパターン集](../examples/slide-patterns.html)では、各パターンの完成例とソースを切り替えて確認できます。

## KPIサマリー

`label` で指標名、`delta` で比較情報を付けます。スライドで最も強調したい数値だけに `tone=accent` を指定します。

```text
@slide
title "Q2 product health"
row metrics {
  metric activation "72%" [label="Activation" delta="+8 pt vs Q1" tone=accent]
  metric teams "1,284" [label="Active teams" delta="+19% QoQ"]
  metric time "4.6 min" [label="Time to first diagram" delta="−31% vs Q1"]
}
callout decision "Double down on guided templates."
```

## 順位付きデータ

`bar` では `value`、省略可能な `max`、`suffix` を指定できます。同じ比較の中ではスケールを揃えてください。

```text
column adoption {
  bar templates "Started from a template" [value=82 suffix="%"]
  bar import "Imported an existing model" [value=64 suffix="%"]
  bar blank "Started from a blank file" [value=37 suffix="%"]
}
```

## ロードマップ

`milestone` には `period`、`step`、`body` を指定できます。節目は `arrow` で接続します。詳細なタスク管理表ではなく、少数の段階を伝える用途に向いています。

```text
row roadmap [gap=50] {
  milestone pilot "Prove repeat use" [period="Q2" step=1 body="Pilot with 3 teams"]
  arrow
  milestone launch "Launch patterns" [period="Q3" step=2 body="Ship gallery and docs"]
  arrow
  milestone scale "Scale adoption" [period="Q4" step=3 body="Measure activation"]
}
```

## 顧客の声

`quote` には `by` と `role` を指定できます。引用を主役にし、その影響を示す数値は一つか二つに絞ると伝わりやすくなります。

```text
row evidence {
  quote customer "We stopped redrawing the same architecture for every review." [by="Aiko Sato" role="Platform design lead"]
  column impact {
    metric review "−46%" [label="Review preparation" delta="3.1 hours saved"]
    metric reuse "3.4×" [label="Diagram reuse" delta="Across docs and slides"]
  }
}
```

4つの要素では、意図した構成に仕上げるための `width` と `height` も指定できます。まずはレイアウトの `gap` と自動計測を使い、明示的な寸法は仕上げに使うのがおすすめです。

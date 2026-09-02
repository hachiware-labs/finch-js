# Slide patterns

[日本語](./slide-patterns_ja.md) · [Open the live gallery](../examples/slide-patterns.html) · [Back to README](../README.md)

`@slide` provides a small set of presentation-native elements. Compose them with `row`, `column`, and `grid`; use each slide to make one point instead of treating the DSL as a drawing canvas.

## Pattern recipes

| Pattern | Core elements | Best for |
| --- | --- | --- |
| KPI summary | `metric` + `callout` | Reporting a few headline numbers and the decision they support |
| Data story | `bar` + `callout` | Ranking categories and stating the takeaway |
| Comparison | `card` + `arrow` | Before/after, alternatives, or a transformation |
| Roadmap | `milestone` + `arrow` | A small number of phases or evidence gates |
| Customer evidence | `quote` + `metric` | Pairing qualitative evidence with measured impact |

The [live pattern gallery](../examples/slide-patterns.html) includes a complete source for each recipe.

## KPI summary

Use `label` to name the metric, `delta` to add context, and `tone=accent` for the one number that should lead the slide.

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

## Ranked data

`bar` accepts `value`, optional `max`, and `suffix`. Keep every bar in a set on the same scale.

```text
column adoption {
  bar templates "Started from a template" [value=82 suffix="%"]
  bar import "Imported an existing model" [value=64 suffix="%"]
  bar blank "Started from a blank file" [value=37 suffix="%"]
}
```

## Roadmap

`milestone` accepts `period`, `step`, and `body`. Connect milestones with `arrow`; do not use it for a detailed task schedule.

```text
row roadmap [gap=50] {
  milestone pilot "Prove repeat use" [period="Q2" step=1 body="Pilot with 3 teams"]
  arrow
  milestone launch "Launch patterns" [period="Q3" step=2 body="Ship gallery and docs"]
  arrow
  milestone scale "Scale adoption" [period="Q4" step=3 body="Measure activation"]
}
```

## Customer evidence

`quote` accepts `by` and `role`. A quotation is strongest when one or two metrics size the impact without competing with the voice of the customer.

```text
row evidence {
  quote customer "We stopped redrawing the same architecture for every review." [by="Aiko Sato" role="Platform design lead"]
  column impact {
    metric review "−46%" [label="Review preparation" delta="3.1 hours saved"]
    metric reuse "3.4×" [label="Diagram reuse" delta="Across docs and slides"]
  }
}
```

All four elements support `width` and `height` when a deliberate slide composition needs tighter control. Prefer layout gaps and natural measurements first; explicit dimensions are the finishing pass.

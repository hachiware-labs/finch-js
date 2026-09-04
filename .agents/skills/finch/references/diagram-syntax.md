# Finch.js diagram syntax

Use this reference to choose the directive and compose valid Finch.js DSL in a JavaScript string inside HTML. The parser implementation in `src/parser.ts` is authoritative; the advanced examples listed below are the preferred models for realistic diagrams.

## Shared rules

- The first meaningful line is exactly one diagram directive.
- Use stable IDs containing letters, digits, `_`, `-`, or `.`. Keep the human-facing text in a quoted label.
- Declare nodes before connecting them, except sequence participants, which Finch.js may infer from messages.
- Use `->` for a solid relationship, `-->` for a dashed relationship, and `..>` where the applicable syntax supports dependency-like relationships.
- Add an edge label after `:`. Flow, state, and activity edges also accept guard/action text such as `[valid] / reserve`.
- Add attributes in brackets: `[key=value other="quoted value"]`.
- Comments can start with `'`, or follow whitespace as `#` or `//` comments.

## Pick the diagram

| Request intent | Directive | Canonical example |
| --- | --- | --- |
| Infrastructure, runtime, physical placement | `@deployment` | `examples/deployment.html` |
| Time-ordered calls or messages | `@sequence` | `examples/sequence.html` |
| General process or decision flow | `@flowchart` | `examples/flowchart.html` |
| Lifecycle and event-driven transitions | `@state` | `examples/state.html` |
| Tables/entities, fields, keys, cardinalities | `@er` | `examples/er.html` |
| Logical software boundaries and interfaces | `@component` | `examples/component.html` |
| Presentation narrative or data story | `@slide` | `examples/slide.html`, `examples/slide-patterns.html`, and `docs/slide-patterns_ja.md` |
| Classes, members, inheritance, composition | `@class` | `examples/class.html` |
| Actors and system goals | `@usecase` | `examples/usecase.html` |
| UML actions, control/object flow, fork and join | `@activity` | `examples/activity.html` |

## Deployment

Declarations include `node`, `device`, `execution`, `artifact`, `server`, `database`, and `container`. Containers may nest with braces.

```text
@deployment
container cloud "本番環境" {
  server api "APIサーバー"
  database db "注文DB"
}
api -> db: SQL
```

Containers accept `layout=row`, `layout=column`, or `layout=grid`; a grid may set `columns`. Direct children may set `order`, `row`, and `column`. On a top-level container, `place=below` keeps the container below its predecessor rather than opening another horizontal band.

## Sequence

Declare `participant` or `actor`, then write messages in order. Frame kinds are `group`, `alt`, `opt`, `loop`, `par`, `critical`, and `break`; close each frame with `end`.

```text
@sequence
actor User "利用者"
participant API "API"
User -> API: 送信
opt 成功時
  API --> User: 200 OK
end
```

## Flowchart

Node declarations are `start`, `process` or `step`, `decision`, `input`, `output`, `node`, and `end`.
Flowcharts are laid out vertically by default: ranks progress from top to bottom and branches in the same rank spread horizontally.

```text
@flowchart
start begin "開始"
decision valid "妥当?"
end done "完了"
begin -> valid
valid -> done: Yes
```

## State

Declarations are `initial`, `state`, `choice`, `junction`, `fork`, `join`, `history`, `deep-history`, `final`, and `terminate`.
Fork/join sections are arranged vertically: the fork bar sits above its parallel states, the join bar sits below them, and a single successor continues downward.
Transitions connected to a fork or join use vertical ports automatically. Override either endpoint when needed with `fromPort` and `toPort`; accepted values are `top`, `right`, `bottom`, and `left`:

```text
audit -> merged [fromPort=bottom toPort=top]
```

```text
@state
initial start
state idle "待機中"
final done
start -> idle
idle -> done: 完了
```

## ER

An entity is a brace-delimited field list. A field is `<name> <type> [flags...]`; common flags are `pk`, `fk`, and `unique`. Cardinalities accept `1`, `0..1`, `N`, `many`, and `0..N`.

```text
@er
entity users "Users" {
  id uuid pk
  email varchar(255) unique
}
entity orders "Orders" {
  id uuid pk
  user_id uuid fk
}
users 1 -> many orders: places
```

## Component

Use nested `system` blocks with `component`, `external`, `port`, `provided`, `required`, `artifact`, and `database` declarations.

```text
@component
system shop "Shop" {
  component api "API"
  provided events "Events"
}
external payment "Payment Provider"
api -> payment: authorize
api -> events: publish
```

## Slide

Use `title`, `subtitle`, `row`, `column`, or `grid`, and presentation items `card`, `note`, `callout`, `badge`, `metric`, `bar`, `quote`, and `milestone`. `arrow` connects adjacent items in the active layout block.

```text
@slide
title "今期の成果" [align=center]
grid kpis [columns=3 gap=22] {
  metric revenue "¥24M" [label="売上" delta="+18%" tone=accent]
  metric users "12K" [label="利用者"]
  metric nps "+42" [label="NPS"]
}
callout decision "次四半期は継続率を優先する"
```

## Class

Classifiers are `class`, `abstract`, `interface`, and `enum`, each with a brace-delimited member list. Relations include inheritance `--|>`, realization `..|>`, composition `*--`, aggregation `o--`, dependency `..>`, directed association `-->`, and association `--`. Put optional multiplicities in quotes beside the relation.

```text
@class
class Order {
  -id: UUID
  +submit(): void
}
class LineItem {
  -quantity: int
}
Order "1" *-- "1..N" LineItem: items
```

## Use case

Use `actor`, a brace-delimited `system`, and `usecase`. Special relations are `include`, `extend`, and `generalize`.

```text
@usecase
actor customer "顧客"
system shop "ショップ" {
  usecase checkout "購入する"
  usecase login "認証する"
}
customer -> checkout
include checkout -> login
```

## Activity

Declarations are `start`, `action` or `activity`, `decision`, `merge`, `fork`, `join`, `object`, and `end`. Use guards and optional actions on edges.

```text
@activity
start begin
action validate "注文を検証する"
decision valid "妥当?"
action reject "却下を記録する"
end done
begin -> validate
validate -> valid
valid -> done [valid]
valid -> reject [invalid] / record reason
reject -> done
```

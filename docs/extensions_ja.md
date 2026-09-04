# Finch.js の拡張

[English](./extensions.md) · [README に戻る](../README_ja.md)

Finch.js には4つの plugin 境界があります。Diagram plugin はソースを意味へ変換し、Shape plugin は1種類のノードを計測・描画します。Layout plugin は計測済み item を配置し、Theme plugin は見た目を決める値を提供します。これらは公開 model で接続されるため、parser、router、scene、SVG renderer の内部実装へ触れる必要はありません。

[ブラウザー拡張例](../examples/extensions.html)では、4種類の plugin を小さな service map DSL にまとめています。このガイドでは、各 plugin の役割と、互換性を保つための契約を説明します。

## 独立した engine から始める

既定 export の `Finch` は registry を共有します。単一アプリケーションでは便利ですが、テスト、埋め込み widget、複数の editor が互いに影響しないようにするには、独立した engine が適しています。

```ts
import {
  createFinch,
  defaultTheme,
  type DiagramPlugin,
  type LayoutPlugin,
  type ShapePlugin,
  type ThemePlugin,
} from "finch-js";

const finch = createFinch();
```

plugin を参照するソースを描画する前に、必要な plugin をすべて登録します。registry の名前は小文字へ正規化されます。

## Theme plugin を作る

Theme は、描画と余白に使う値をひと揃い持ちます。Finch.js に新しい field が加わったときも適切な初期値を得られるよう、組み込み theme を基に作ります。

```ts
const oceanTheme: ThemePlugin = {
  ...defaultTheme,
  name: "ocean",
  labelColor: "#083344",
  mutedColor: "#0e7490",
  nodeFill: "#ecfeff",
  nodeStroke: "#67e8f9",
  containerFill: "#f0fdfa",
  containerStroke: "#5eead4",
  edgeColor: "#0891b2",
  accentColor: "#0f766e",
  canvasColor: "#f8fafc",
};

finch.registerTheme("ocean", oceanTheme);
```

`registerTheme()` に渡す registry 名は、アプリケーションが `render({ theme: "ocean" })` や `setTheme("ocean")` で使う名前です。theme object を調べる利用者もいるため、`name` field も同じ値にしておきます。

## Shape plugin を作る

Shape plugin の役割は2つあります。layout の前にノードの大きさを返し、layout の後に SVG group を描画します。両方の method で縦横の大きさを一致させてください。

```ts
const SVG_NS = "http://www.w3.org/2000/svg";

function svg<K extends keyof SVGElementTagNameMap>(
  document: Document,
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
}

const serviceCard: ShapePlugin = {
  name: "service-card",

  measure({ label, theme }) {
    return {
      width: Math.max(160, label.length * theme.fontSize * 0.62 + 40),
      height: 68,
    };
  },

  render({ node, theme, document }) {
    const group = svg(document, "g", {
      transform: `translate(${node.x} ${node.y})`,
      "data-node-id": node.id,
    });
    const card = svg(document, "rect", {
      width: node.width,
      height: node.height,
      rx: 12,
      fill: theme.nodeFill,
      stroke: theme.nodeStroke,
      "stroke-width": theme.nodeStrokeWidth,
    });
    const accent = svg(document, "rect", {
      width: 6,
      height: node.height,
      rx: 3,
      fill: theme.accentColor,
    });
    const label = svg(document, "text", {
      x: 20,
      y: 29,
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
      "font-weight": 700,
    });
    label.textContent = node.label;

    const owner = svg(document, "text", {
      x: 20,
      y: 50,
      fill: theme.mutedColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize - 2,
    });
    owner.textContent = node.attributes.owner ?? "Unassigned";

    group.append(card, accent, label, owner);
    return group;
  },
};

finch.registerShape("service-card", serviceCard);
```

返す group には `data-node-id` を設定します。Finch.js はこの属性を使い、pointer や keyboard の操作を semantic node に対応付けます。利用者が入力したラベルや属性値は `textContent` へ設定し、SVG markup として解釈させないでください。

Shape plugin は独自アイコンとしても使えます。次の例は六角形の tile と分岐する gateway glyph を組み合わせていますが、同じ `render()` method で任意の SVG path や基本図形を合成できます。

```ts
const gatewayIcon: ShapePlugin = {
  name: "gateway-icon",

  measure({ label, theme }) {
    return {
      width: Math.max(124, label.length * theme.fontSize * 0.66 + 28),
      height: 112,
    };
  },

  render({ node, theme, document }) {
    const centerX = node.width / 2;
    const group = svg(document, "g", {
      transform: `translate(${node.x} ${node.y})`,
      "data-node-id": node.id,
    });
    const tile = svg(document, "path", {
      d: `M ${centerX} 4 L ${centerX + 38} 24 L ${centerX + 38} 66 `
        + `L ${centerX} 86 L ${centerX - 38} 66 L ${centerX - 38} 24 Z`,
      fill: theme.nodeFill,
      stroke: theme.accentColor,
      "stroke-width": 2,
    });
    const glyph = svg(document, "path", {
      d: `M ${centerX} 28 V 43 M ${centerX} 43 L ${centerX - 20} 58 `
        + `M ${centerX} 43 L ${centerX + 20} 58`,
      fill: "none",
      stroke: theme.accentColor,
      "stroke-width": 3,
      "stroke-linecap": "round",
    });
    const label = svg(document, "text", {
      x: centerX,
      y: 105,
      "text-anchor": "middle",
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
    });
    label.textContent = node.label;
    group.append(tile, glyph, label);
    return group;
  },
};

finch.registerShape("gateway-icon", gatewayIcon);
```

通常の shape 属性を使い、ノード単位で `service gateway "API Gateway" [shape=gateway-icon]` と指定します。完全版のブラウザー例では glyph に端点の円を加え、custom theme の切り替えでアイコン全体の色も変わります。

custom shape を長方形で囲む必要はありません。同じ例の `star-icon` は、外側と内側で半径を交互に変えた10個の頂点を計算し、SVG polygon に渡して星形を作ります。

```js
const points = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? 39 : 17;
  const angle = -Math.PI / 2 + index * Math.PI / 5;
  return `${centerX + Math.cos(angle) * radius},${44 + Math.sin(angle) * radius}`;
}).join(" ");

const star = svg(document, "polygon", {
  points,
  fill: theme.nodeFill,
  stroke: theme.accentColor,
  "stroke-width": 2.5,
  "stroke-linejoin": "round",
});
```

`examples/extensions.html` のインラインスクリプトには、このほかにブラウザー窓、盾、書類スタックの shape があり、組み込みの database の円筒形も並べています。長方形の装飾違いではなく、小さな shape gallery として比較できます。

parser が未登録の shape を要求した場合、現状の Finch.js は組み込みの長方形へ fallback します。それでも shape 名を明示的に登録すると、不足している拡張をテストや文書から判断しやすくなります。

## Layout plugin を作る

Layout plugin は、計測済み item、semantic connection、現在の layout context を受け取ります。戻り値にはノード、edge、group、canvas の完全な geometry が必要です。

```ts
const serviceLanes: LayoutPlugin = {
  name: "service-lanes",

  layout(model, context) {
    // 計測済み item ごとに既定位置を計算する。
    // context.overlay、context.previous、force、preservePinned を反映する。
    // すべての connection を経路へ変換し、canvas の大きさを決める。
    return {
      kind: model.kind,
      nodes,
      edges,
      groups: [],
      width,
      height,
    };
  },
};

finch.registerLayout("service-lanes", serviceLanes);
```

ここでは method の本体を要約しています。完全に動く実装は [`examples/extensions.html`](../examples/extensions.html) に埋め込んであります。有用な layout は複数の判断をまとめて行う必要があり、座標計算だけを抜き出すと重要な責務が見えなくなるためです。

layout では次の振る舞いを保ちます。

- 各 `LayoutItem` の `id`、`label`、`shape`、`parentId`、`attributes` を `GeometryNode` へ写します。
- 経路を計算できる connection ごとに `GeometryEdge` を返し、connection の metadata を維持します。
- 強制されていないソース更新では、安定したノードの連続性を保つため `context.previous` を使います。
- 通常描画では手動 overlay の座標を反映します。強制自動配置でも `context.preservePinned` が真なら固定済み overlay を残します。
- 強制自動配置では、固定されていない手動座標を無視します。
- すべてのノードと group が入る canvas の幅と高さを返します。

対話操作でノードをドラッグした後は Finch.js が edge を引き直しますが、最初の経路は plugin が作ります。edge の point 配列には、少なくとも始点と終点を含めてください。

## Diagram plugin を作る

Diagram plugin は構文と表示を分けます。`parse()` は `SemanticModel` を作り、`toLayoutModel()` はノードを計測して、選んだ layout へ渡す model を準備します。

次の例では、小さな `@services` 構文を組み込み deployment parser の構文へ変換し、ノードの shape を差し替えます。

```ts
const base = createFinch();

const servicesDiagram: DiagramPlugin = {
  name: "services",
  defaultLayout: "service-lanes",

  parse(source) {
    const translated = source
      .replace(/^\s*@services\b/im, "@deployment")
      .replace(/^\s*service\b/gim, "node");
    const model = base.parse(translated);

    return {
      ...model,
      kind: "services",
      source,
      nodes: model.nodes.map((node) => ({
        ...node,
        shape: node.shape === "rectangle" ? "service-card" : node.shape,
      })),
    };
  },

  toLayoutModel(model, context) {
    return {
      kind: model.kind,
      items: model.nodes.map((node) => ({
        ...node,
        size: context.measure(node.shape, node.label, node.attributes),
      })),
      connections: model.connections,
      groups: model.groups,
      direction: "right",
      minimumGap: context.theme.gapY,
    };
  },
};

finch.registerDiagram("services", servicesDiagram);
```

別の `base` engine を使うことで、新しい `@services` plugin の再帰呼び出しを避けています。構文が本質的に異なる場合は `parse()` を直接実装し、安定した node ID と connection ID を返します。parser の error には、可能な限り入力行と解釈できなかった文字列を含めてください。

`context.measure()` は Diagram plugin と登録済み Shape plugin の境界です。shape の大きさを求める処理を diagram parser 側へ重複実装しないようにします。

## Plugin を組み合わせる

登録を終えたら、アプリケーションは通常の描画 API から拡張を使えます。

```ts
const source = `@services
service gateway "API Gateway" [shape=gateway-icon tier=edge owner=Platform]
service orders "Order Service" [tier=application owner=Commerce]
service database "Order Database" [tier=data owner=Commerce]

gateway -> orders: HTTPS
orders -> database: SQL`;

const diagram = finch.render(source, {
  target: "#diagram",
  theme: "ocean",
});
```

diagram は既定 layout として `service-lanes` を選び、解析したすべての service は `service-card` を要求します。返された instance では、`setTheme()`、`setLayout()`、`update()`、layout の保存操作もそのまま利用できます。

## 拡張の契約をテストする

各境界は、必要な振る舞いを直接確かめます。

1. 代表的なソースを解析し、安定した ID、属性、connection、理解しやすい error を確認します。
2. DOM テストで custom shape を計測・描画し、大きさと `data-node-id` を確認します。
3. 空の overlay、手動 overlay、固定ノードを含む強制 layout の3条件で Layout plugin を実行します。
4. 拡張全体を描画し、drag、ソース更新、overlay の import が維持されることを確認します。

plugin 例を変更した後は、Finch.js 本体の検査も実行します。

```bash
npm run check
```

中心となる契約は明快です。parser は意味、shape はノードの geometry、layout は配置と経路、theme は見た目の値を担当します。この分担を守れば、組み込み diagram と同じ編集・保存ループの中で独自拡張を利用できます。

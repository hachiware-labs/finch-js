// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createFinch } from "../src/index";
import { labelLayout, textWidth, wrappedLines } from "../src/text-layout";
import { placeEdgeLabels } from "../src/edge-labels";
import { builtInShapes } from "../src/shapes";
import { defaultTheme, midnightTheme } from "../src/theme";
import type { Geometry, GeometryNode } from "../src/types";

function textBoxes(group: SVGElement) {
  return (group.matches("text") ? [group] : [...group.querySelectorAll("text")]).flatMap((text) => {
    const parts = text.children.length ? [...text.querySelectorAll("tspan")] : [text];
    const size = Number(text.getAttribute("font-size"));
    const middle = text.getAttribute("dominant-baseline") === "middle";
    const anchor = text.getAttribute("text-anchor");
    return parts.filter((part) => part.textContent).map((part) => {
      const width = textWidth(part.textContent!, size);
      const x = Number(part.getAttribute("x") ?? text.getAttribute("x"));
      const y = Number(part.getAttribute("y") ?? text.getAttribute("y"));
      return { x: x - (anchor === "middle" ? width / 2 : anchor === "end" ? width : 0), y: y - size * (middle ? 0.5 : 1), width, height: size * (middle ? 1 : 1.25) };
    });
  });
}

describe("complete, contained labels", () => {
  beforeEach(() => { document.body.innerHTML = '<div id="diagram"></div>'; });

  for (const theme of [defaultTheme, midnightTheme, { ...defaultTheme, edgeColor: "#7a8aa3", nodeStroke: "#c8d2e0" }]) {
    it(`uses the theme's structural line color for the actor (${theme.edgeColor})`, () => {
      const instance = createFinch().render('@graph\na "担当者" [shape=actor]', { editor: false, theme });
      const group = instance.svg.querySelector('.finch-shape-actor')!;
      for (const part of group.querySelectorAll('circle,path')) expect(part.getAttribute('stroke')).toBe(theme.edgeColor);
      expect(group.querySelector('text')!.getAttribute('fill')).toBe(theme.labelColor);
      expect(group.querySelector('[filter]')).toBeNull();
    });
  }

  it("contains the required interface arc and its label inside measured bounds", () => {
    const shape = builtInShapes.find(item => item.name === 'uml-required-interface')!;
    for (const fontSize of [13, 14, 20, 24]) for (const label of ['要求', '長い要求の説明を複数行に分けて表示する']) {
      const theme = { ...defaultTheme, fontSize };
      const attributes = { wrapWidth: '90' };
      const size = shape.measure({ label, attributes, theme });
      const group = shape.render({ node: { id: 'required', shape: shape.name, label, attributes, x: 0, y: 0, ...size }, theme, document });
      const path = group.querySelector('path')!;
      const [x, y, rx, ry, , , , endX, endY] = path.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const halfStroke = Number(path.getAttribute('stroke-width')) / 2;
      expect(y! - ry! - halfStroke).toBeGreaterThanOrEqual(0);
      expect(x! - halfStroke).toBeGreaterThanOrEqual(0);
      expect(endX! + halfStroke).toBeLessThanOrEqual(size.width);
      expect(endX! - x!).toBe(rx! * 2);
      expect(endY).toBe(y);
      for (const box of textBoxes(group)) {
        expect(box.y).toBeGreaterThan(y! + halfStroke);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      }
    }
  });

  it("leaves space above the milestone period and between wrapped text sections", () => {
    const shape = builtInShapes.find(item => item.name === 'slide-milestone')!;
    for (const period of ['', '2026 Q3', '準備期間を確認してから運用を始める']) {
      const attributes = { period, body: '本文を複数行に分けて最後まで表示する', width: '150', height: '20' };
      const label = '注文内容と配送先を確認する';
      const size = shape.measure({ label, attributes, theme: defaultTheme });
      const group = shape.render({ node: { id: 'milestone', shape: shape.name, label, attributes, x: 0, y: 0, ...size }, theme: defaultTheme, document });
      const sections = [...group.querySelectorAll('text')].slice(1).map(textBoxes);
      if (period) expect(sections[0]![0]!.y - 18).toBeGreaterThanOrEqual(7);
      for (let i = 1; i < sections.length; i++) {
        const previousSection = sections[i - 1]!;
        const previous = previousSection[previousSection.length - 1]!;
        expect(sections[i]![0]!.y).toBeGreaterThan(previous.y + previous.height);
      }
      for (const box of sections.flat()) expect(box.y + box.height).toBeLessThanOrEqual(size.height - (period ? 12 : 8));
    }
  });

  it("preserves explicit breaks, blank lines, words and long graphemes", () => {
    expect(wrappedLines("first\\n\\nlast", 100, (s) => s.length)).toEqual(["first", "", "last"]);
    const phrase = "長い文章を折り返すためのテストです。 ALongWordWithoutAnySpaces 👨‍👩‍👧‍👦が確認します。";
    const lines = labelLayout(phrase, 72, 13).lines;
    expect(lines.join("")).toBe(phrase);
    expect(lines.some((line) => line.includes("👨‍👩‍👧‍👦"))).toBe(true);
    for (const line of lines) expect(textWidth(line, 13)).toBeLessThanOrEqual(72);
  });

  for (const shapeName of ["rectangle", "rounded", "diamond", "circle", "usecase", "parallelogram", "database", "server", "component", "external", "actor", "uml-artifact", "uml-device", "uml-execution", "uml-required-interface", "uml-provided-interface", "entity", "uml-class"]) {
    it(`grows ${shapeName} to contain every line`, () => {
      const shape = builtInShapes.find((item) => item.name === shapeName)!;
      const label = "指定した改行\\nその後も長い日本語の文章が続く場合は自動で折り返して最後まで表示します。";
      const attributes = { wrapWidth: "120", kind: "class" };
      const size = shape.measure({ label, attributes, theme: defaultTheme });
      const node: GeometryNode = { id: "test", shape: shapeName, label, attributes, x: 0, y: 0, ...size };
      const group = shape.render({ node, theme: defaultTheme, document });
      expect(group.textContent).toContain("指定した改行");
      expect(group.textContent).toContain("最後まで表示します。");
      expect(group.textContent).not.toContain("\\n");
      for (const box of textBoxes(group)) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(node.width);
        expect(box.y + box.height).toBeLessThanOrEqual(node.height);
        if (["diamond", "circle", "usecase"].includes(shapeName)) {
          for (const x of [box.x, box.x + box.width]) for (const y of [box.y, box.y + box.height]) {
            const dx = Math.abs(x - node.width / 2) / (node.width / 2);
            const dy = Math.abs(y - node.height / 2) / (node.height / 2);
            expect(shapeName === "diamond" ? dx + dy : dx * dx + dy * dy).toBeLessThanOrEqual(1);
          }
        }
      }
    });
  }

  it("underlines each object label line without a fixed rule crossing the text", () => {
    const shape = builtInShapes.find((item) => item.name === "uml-object")!;
    const label = "注文オブジェクト\\n確認待ちの注文内容";
    const attributes = { wrapWidth: "90" };
    const size = shape.measure({ label, attributes, theme: defaultTheme });
    const group = shape.render({ node: { id: "object", shape: shape.name, label, attributes, x: 0, y: 0, ...size }, theme: defaultTheme, document });
    expect(group.querySelector("text")?.getAttribute("text-decoration")).toBe("underline");
    expect(group.querySelectorAll("tspan").length).toBeGreaterThan(2);
    expect(group.querySelector("line")).toBeNull();
  });

  it("keeps database labels below the lid with theme padding on both sides", () => {
    const shape = builtInShapes.find((item) => item.name === "database")!;
    for (const padding of [10, 13, 24]) {
      const theme = { ...defaultTheme, nodePaddingY: padding };
      const label = "注文情報\\n配送先を確認";
      const size = shape.measure({ label, attributes: {}, theme });
      const group = shape.render({ node: { id: "db", shape: shape.name, label, attributes: {}, x: 0, y: 0, ...size }, theme, document });
      const cap = Number(group.querySelector("ellipse")!.getAttribute("ry"));
      for (const box of textBoxes(group)) {
        expect(box.y).toBeGreaterThanOrEqual(cap * 2 + padding);
        expect(box.y + box.height).toBeLessThanOrEqual(size.height - cap - padding);
      }
    }
  });

  for (const name of ["circle", "diamond"]) {
    it(`balances long ${name} labels while preserving explicit wrap widths`, () => {
      const shape = builtInShapes.find((item) => item.name === name)!;
      const label = "法人顧客の注文内容と配送先を確認して出荷を手配";
      const compact = shape.measure({ label, attributes: {}, theme: defaultTheme });
      const wide = shape.measure({ label, attributes: { wrapWidth: "180" }, theme: defaultTheme });
      expect(compact.width).toBeLessThan(wide.width);
      const group = shape.render({ node: { id: name, shape: name, label, attributes: {}, x: 0, y: 0, ...compact }, theme: defaultTheme, document });
      expect(group.textContent).toBe(label);
      for (const box of textBoxes(group)) {
        for (const x of [box.x, box.x + box.width]) for (const y of [box.y, box.y + box.height]) {
          const dx = Math.abs(x - compact.width / 2) / (compact.width / 2);
          const dy = Math.abs(y - compact.height / 2) / (compact.height / 2);
          expect(name === "diamond" ? dx + dy : dx * dx + dy * dy).toBeLessThan(1);
        }
      }
    });
  }

  it("reserves the whole wrapped container heading above its children", () => {
    const instance = createFinch().render(String.raw`@deployment
container box "コンテナの長い見出しを\n複数行に分けても\n子の要素には重ねない" [wrapWidth=120] {
  node child "子の要素"
}`, { editor: false });
    const container = instance.geometry.nodes.find((node) => node.id === "box")!;
    const child = instance.geometry.nodes.find((node) => node.id === "child")!;
    expect(container.headerHeight).toBeGreaterThan(42);
    expect(child.y).toBeGreaterThanOrEqual(container.y + container.headerHeight!);
  });

  it("keeps pinned positions but rejects obsolete sizes smaller than the text", () => {
    const instance = createFinch().render('@flowchart\nprocess a "長い文章を表示するために必要な高さと幅を確保し、すべての行を読めるようにする" [wrapWidth=100]', {
      editor: false, overlay: { version: 1, nodes: { a: { x: 77, y: 88, width: 20, height: 20, manual: true, pinned: true } } },
    });
    expect(instance.geometry.nodes[0]).toMatchObject({ x: 77, y: 88 });
    expect(instance.geometry.nodes[0]!.height).toBeGreaterThan(60);
  });

  it("wraps edge labels with hard breaks and reserves their complete viewport bounds", () => {
    const instance = createFinch().render(String.raw`@flowchart
process a "申請"
process b "処理"
a -> b: 申請の内容を確認してから処理を進めます。\n確認が必要な項目がある場合は利用者に連絡して回答を待ちます。`, { editor: false });
    const label = instance.svg.querySelector(".finch-edge-label")!;
    expect(label.querySelectorAll("tspan").length).toBeGreaterThan(2);
    const placement = [...placeEdgeLabels(instance.geometry, 12).labels.values()][0]!;
    expect(placement.lines.join("")).toBe(instance.geometry.edges[0]!.label!.replace(/\\n/g, ""));
    expect(placement.width).toBeLessThanOrEqual(188);
    const origin = instance.geometry.origin!;
    expect(placement.y).toBeGreaterThanOrEqual(origin.y);
    expect(placement.y + placement.height).toBeLessThanOrEqual(origin.y + instance.geometry.height);
  });

  it("spaces successive long sequence messages apart", () => {
    const message = "必要な情報を確認して処理を進めるための長いメッセージです。".repeat(4);
    const instance = createFinch().render(`@sequence\nparticipant a "A"\nparticipant b "B"\na -> b: ${message}\nb --> a: ${message}`, { editor: false });
    const labels = [...placeEdgeLabels(instance.geometry, 12).labels.values()];
    expect(labels[0]!.y + labels[0]!.height).toBeLessThan(labels[1]!.y);
  });

  for (const shapeName of ["slide-title", "slide-subtitle", "slide-card", "slide-note", "slide-callout", "slide-badge", "slide-metric", "slide-bar", "slide-quote", "slide-milestone"]) {
    it(`keeps long ${shapeName} text without ellipses or overflow`, () => {
      const shape = builtInShapes.find((item) => item.name === shapeName)!;
      const label = "長い文章の見出しを途中で省略することなく表示します。".repeat(3);
      const attributes = { width: "300", height: "20", badge: "長いバッジの表示内容も省略しません。".repeat(3), body: "本文も最後まで表示し、枠を広げて読みやすくします。".repeat(3) };
      const size = shape.measure({ label, attributes, theme: defaultTheme });
      const node: GeometryNode = { id: "slide", shape: shapeName, label, attributes, x: 0, y: 0, ...size };
      const group = shape.render({ node, theme: defaultTheme, document });
      expect(group.textContent).toContain(label);
      expect(group.textContent).not.toContain("…");
      for (const box of textBoxes(group)) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(node.width);
        expect(box.y).toBeGreaterThanOrEqual(shapeName === "slide-quote" ? 8 : 0);
        expect(box.y + box.height).toBeLessThanOrEqual(node.height);
      }
    });
  }
});

it('orients reading triangles along the chosen segment of a self relation',()=>{
 const geometry:Geometry={kind:'class',nodes:[],groups:[],width:300,height:200,edges:[{id:'self',from:'a',to:'a',label:'reads',order:0,dashed:false,attributes:{labelDirection:'forward'},points:[{x:0,y:0},{x:0,y:100},{x:-200,y:100},{x:-200,y:0},{x:0,y:0}]}]};
 // The two long horizontal segments point in opposite directions. Block the return segment.
 geometry.nodes.push({id:'block',label:'',shape:'rectangle',attributes:{},x:-220,y:-40,width:240,height:80});
 const result=placeEdgeLabels(geometry,12,text=>text.length*7);
 expect(result.labels.get('self')!.lines.join(' ')).toBe('reads ◀');
 geometry.edges[0]!.attributes!.labelDirection='backward';
 expect(placeEdgeLabels(geometry,12,text=>text.length*7).labels.get('self')!.lines.join(' ')).toBe('reads ▶');
});


it('sizes every component notation using the same padding as its label',()=>{
 const shape=builtInShapes.find(item=>item.name==='component')!;
 for(const componentStyle of ['uml1','uml2','rectangle'])for(const wrapWidth of ['70','120','216']){
  const label='Long component description with several responsibilities and explicit\\nline breaks to preserve throughout rendering.';
  const attributes={componentStyle,wrapWidth};
  const size=shape.measure({label,attributes,theme:defaultTheme});
  const node:GeometryNode={id:'test',shape:'component',label,attributes,x:0,y:0,...size};
  const group=shape.render({node,theme:defaultTheme,document});
  for(const box of textBoxes(group)){
   expect(box.x).toBeGreaterThanOrEqual(componentStyle==='uml1'?24:0);
   expect(box.y).toBeGreaterThanOrEqual(0);
   expect(box.x+box.width).toBeLessThanOrEqual(node.width);
   expect(box.y+box.height).toBeLessThanOrEqual(node.height);
  }
 }
});


it('keeps long group headings above child content and below database caps',()=>{
 const shape=builtInShapes.find(item=>item.name==='container')!;
 for(const containerStyle of ['folder','frame','node','database']){
  const label='Application data processing and persistent audit records';
  const attributes={containerStyle,wrapWidth:'110'};
  const size=shape.measure({label,attributes,theme:defaultTheme});
  const node:GeometryNode={id:'group',shape:'container',label,attributes,x:0,y:0,...size};
  const group=shape.render({node,theme:defaultTheme,document});
  for(const box of textBoxes(group)){
   expect(box.y).toBeGreaterThanOrEqual(containerStyle==='database'?20:10);
   expect(box.y+box.height).toBeLessThan(node.headerHeight!);
   expect(box.x+box.width).toBeLessThan(node.width-10);
  }
 }
});

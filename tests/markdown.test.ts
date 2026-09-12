// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createFinch, parseMarkdown } from "../src/index";

describe("Markdown に図と座標を保存する", () => {
  it.each([
    '@graph\na -> b',
    '@deployment\ncontainer zone "Zone" {\nnode a "A"\nnode b "B"\n}\na -> b',
    '@sequence\nA -> B: Request\nB --> A: Reply',
    '@flowchart\nprocess a "A"\nprocess b "B"\na -> b',
    '@state\nstate a "A"\nstate b "B"\na -> b',
    '@activity\naction a "A"\naction b "B"\na -> b',
    '@er\nentity a "A" {\nid uuid pk\n}\nentity b "B" {\nid uuid pk\n}\na 1 -> many b',
    '@class\nclass A {\n+run(): void\n}\nclass B {\n+run(): void\n}\nA --> B',
    '@component\nsystem zone "Zone" {\ncomponent a "A"\ncomponent b "B"\n}\na -> b',
    '@usecase\nactor a "A"\nsystem zone "Zone" {\nusecase b "B"\n}\na -> b',
    '@slide\ntitle "図を説明する"\nrow steps {\ncard a "A"\narrow\ncard b "B"\n}',
  ])("全ノードの位置と大きさを戻す: %s", (source) => {
    const finch = createFinch();
    const instance = finch.render(source, { editor: false });
    const id = instance.geometry.nodes.find((node) => node.shape !== "container")!.id;
    instance.importLayout({ version: 1, editable: false, nodes: {
      [id]: { x: -123.25, y: 456.75, width: 300, height: 120, manual: true, pinned: true },
      deleted: { x: 9, y: 9, manual: true, pinned: false },
    } });
    const before = instance.exportLayout();
    const markdown = instance.exportMarkdown();
    const parsed = parseMarkdown(markdown)[0]!;
    expect(parsed.source).toBe(source);
    expect(parsed.overlay?.nodes.deleted).toBeUndefined();
    expect(Object.keys(parsed.overlay!.nodes)).toHaveLength(instance.geometry.nodes.length);
    expect(instance.exportLayout()).toBe(before);
    const restored = finch.renderMarkdown(`# 保存した図\n\n${markdown}`, { editor: false });
    const bounds = (diagram: typeof instance) => diagram.geometry.nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
    expect(bounds(restored)).toEqual(bounds(instance));
    expect(restored.isPinned(id)).toBe(true);
    expect(restored.editable).toBe(false);
    expect(restored.exportMarkdown()).toBe(markdown);
  });

  it("自動配置の全ノードも保存し、既存のAPIを保つ", () => {
    const finch = createFinch();
    const instance = finch.render('@graph\na -> b');
    expect(JSON.parse(instance.exportLayout()).nodes).toEqual({});
    const restored = finch.renderMarkdown(instance.exportMarkdown());
    expect(restored.geometry.nodes).toEqual(instance.geometry.nodes);
    expect(restored.overlay.nodes.a?.manual).toBe(false);
    restored.update('@graph\na "名前を変える"\na -> b');
    expect(restored.geometry.nodes[0]?.x).toBe(instance.geometry.nodes[0]?.x);
    restored.autoLayout({ preservePinned: false });
    expect(restored.overlay.nodes).toEqual({});
    expect(finch.parse(instance.source).kind).toBe("graph");
  });

  it("ドラッグで広がった枠と子の位置を戻す", () => {
    const finch = createFinch();
    const instance = finch.render('@deployment\ncontainer outer "Outer" {\ncontainer inner "Inner" {\nnode a "A"\n}\n}', { editor: false });
    const svg = instance.svg;
    Object.defineProperties(svg, {
      createSVGPoint: { value: () => ({ x: 0, y: 0, matrixTransform() { return this; } }) },
      getScreenCTM: { value: () => null },
      setPointerCapture: { value: () => undefined },
      hasPointerCapture: { value: () => false },
    });
    const pointer = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY: 100 });
      Object.defineProperty(event, "pointerId", { value: 1 });
      return event;
    };
    svg.querySelector('[data-node-id="a"]')!.dispatchEvent(pointer('pointerdown', 100));
    svg.dispatchEvent(pointer('pointermove', 500));
    svg.dispatchEvent(pointer('pointerup', 500));
    expect(instance.overlay.nodes.a?.manual).toBe(true);
    expect(instance.overlay.nodes.outer?.width).toBeDefined();
    const restored = finch.renderMarkdown(instance.exportMarkdown(), { editor: false });
    expect(restored.geometry.nodes).toEqual(instance.geometry.nodes);
  });

  it("他のフェンス内の例を読み込まず、複数の図を順に読む", () => {
    const markdown = '````markdown\n```finch\n@graph\nignored\n```\n````\n\n  ~~~finch.js\r\n  @graph\r\n  a -> b\r\n  ~~~~\r\n\n```finchjs title\n@graph\nx -> y\n```';
    const finch = createFinch();
    expect(finch.parseMarkdown(markdown).map((item) => item.source)).toEqual(['@graph\na -> b', '@graph\nx -> y']);
    document.body.innerHTML = '<div id="diagram"></div>';
    expect(finch.renderMarkdown(markdown, '#diagram').host?.id).toBe('diagram');
    expect(finch.renderMarkdown(markdown, { diagramIndex: 1 }).model.nodes[0]?.id).toBe('x');
    expect(() => finch.renderMarkdown(markdown, { diagramIndex: 2 })).toThrow();
    expect(parseMarkdown('図がありません')).toEqual([]);
    expect(() => finch.renderMarkdown('図がありません')).toThrow();
  });

  it("ソース内のバッククォートと末尾の改行を保つ", () => {
    const finch = createFinch();
    const source = '\n@graph\na "``` を使う"\n\n';
    const saved = finch.render(source).exportMarkdown();
    expect(saved.startsWith('````finch\n')).toBe(true);
    expect(parseMarkdown(saved)[0]?.source).toBe(source);
  });

  it("明示した overlay を優先する", () => {
    const finch = createFinch();
    const saved = finch.render('@graph\na').exportMarkdown();
    const restored = finch.renderMarkdown(saved, { overlay: {
      version: 1, nodes: { a: { x: 900, y: 800, pinned: false, manual: true } },
    } });
    expect(restored.geometry.nodes[0]).toMatchObject({ x: 900, y: 800 });
  });

  it("壊れた座標や閉じ忘れをエラーにする", () => {
    const finch = createFinch();
    const saved = finch.render('@graph\na').exportMarkdown();
    expect(() => parseMarkdown('```finch\n@graph')).toThrow();
    expect(() => parseMarkdown(saved.replace("' @end-finch-layout\n", ''))).toThrow();
    expect(() => parseMarkdown(saved.replace('"version": 1', '"version": 2'))).toThrow();
    expect(() => parseMarkdown(saved.replace(/"x": [\d.]+/, '"x": "100"'))).toThrow();
    expect(() => parseMarkdown(saved.replace('"nodes": {', '"nodes": null, "unused": {'))).toThrow();
    expect(() => parseMarkdown(saved.replace("' @end-finch-layout", "' @end-finch-layout\nnode extra"))).toThrow();
  });
});

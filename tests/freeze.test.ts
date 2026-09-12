// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFinch } from "../src/index";
import type { EditorStoredState } from "../src/types";

const source = '@graph\na -> b';

const localStorageAdapter = {
  load: (key: string) => JSON.parse(localStorage.getItem(key) ?? "null") as EditorStoredState | null,
  save: (key: string, value: EditorStoredState) => localStorage.setItem(key, JSON.stringify(value)),
};

describe("図をフリーズする", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="diagram"></div>';
    localStorage.clear();
  });

  it.each([true, false])("編集状態 %s からフリーズし、配置の変更を止める", (editable) => {
    const diagram = createFinch().render(source, { editor: false });
    diagram.pin("a").select("a").setEditable(editable);
    const change = vi.fn();
    diagram.svg.addEventListener("finch:layoutchange", change);
    expect(diagram.freeze()).toBe(diagram);
    expect(change).toHaveBeenCalledTimes(1);
    const saved = diagram.exportLayout();
    diagram.freeze().setEditable(true).select("a").unpin("a").pin("b")
      .autoLayout().resetLayout().undoLayout().setLayout("missing");
    expect(diagram.frozen).toBe(true);
    expect(diagram.editable).toBe(false);
    expect(diagram.selection).toEqual([]);
    expect(diagram.exportLayout()).toBe(saved);
    diagram.zoomIn();
    expect(diagram.zoom).toBeGreaterThan(1);
    expect(diagram.toSvgString()).toContain("<svg");
  });

  it("JSON、script要素、Markdownからフリーズを戻す", () => {
    const finch = createFinch();
    const diagram = finch.render(source, { editor: false }).pin("a").freeze();
    const script = document.createElement("script");
    const saved = diagram.saveLayout(script);
    expect(script.textContent).toBe(saved);
    expect(JSON.parse(saved)).toMatchObject({ version: 1, frozen: true, editable: false });
    const restored = finch.render(source, { target: "#diagram", overlay: saved, editable: true,
      editor: { restore: false, initiallyOpen: true } });
    expect(restored.frozen).toBe(true);
    expect(restored.editable).toBe(false);
    expect(restored.svg.querySelector("[data-finch-editor-trigger]")).toBeNull();
    expect(document.querySelector<HTMLElement>(".finch-editor")!.hidden).toBe(true);
    const markdown = finch.renderMarkdown(diagram.exportMarkdown(), { editor: false });
    expect(markdown.frozen).toBe(true);
    expect(markdown.isPinned("a")).toBe(true);
    restored.importLayout({ version: 1, frozen: true, editable: true, nodes: {} });
    expect(restored.editable).toBe(false);
    restored.update('@graph\na "新しい名前"').setTheme("midnight");
    expect(restored.model.nodes[0]?.label).toBe("新しい名前");
    expect(restored.frozen).toBe(true);
    expect(restored.svg.querySelector("[data-finch-editor-trigger]")).toBeNull();
  });

  it("古いデータと通常の閲覧モードは編集へ戻せる", () => {
    const finch = createFinch();
    const diagram = finch.render(source, { editor: false }).freeze();
    diagram.importLayout({ version: 1, nodes: {} });
    expect(diagram.frozen).toBe(false);
    expect(diagram.editable).toBe(true);
    expect(JSON.parse(diagram.exportLayout())).not.toHaveProperty("frozen");
    diagram.setEditable(false).setEditable(true);
    expect(diagram.editable).toBe(true);
    diagram.importLayout({ version: 1, frozen: false, editable: false, nodes: {} });
    diagram.setEditable(true);
    expect(diagram.editable).toBe(true);
  });

  it("ボタンで入力中のソースも保存し、再読み込み後も編集UIを隠す", () => {
    vi.useFakeTimers();
    try {
      const finch = createFinch();
      const diagram = finch.render(source, { target: "#diagram", editor: { storage: localStorageAdapter, storageKey: "freeze", initiallyOpen: true } });
      const root = document.querySelector<HTMLElement>(".finch-editor")!;
      const input = root.querySelector<HTMLTextAreaElement>("textarea")!;
      input.value = '@graph\na "入力した名前"';
      input.dispatchEvent(new Event("input"));
      root.querySelector<HTMLButtonElement>("[data-action='freeze']")!.click();
      vi.runAllTimers();
      expect(diagram.frozen).toBe(true);
      expect(root.hidden).toBe(true);
      expect(root.querySelector<HTMLElement>("section")!.hidden).toBe(true);
      expect(diagram.svg.querySelector("[data-finch-editor-trigger]")).toBeNull();
      expect(JSON.parse(localStorage.getItem("freeze")!)).toMatchObject({
        source: input.value, layout: { frozen: true, editable: false },
      });
      diagram.destroy();
      const restored = finch.render(source, { target: "#diagram", editor: { storage: localStorageAdapter, storageKey: "freeze", initiallyOpen: true } });
      expect(restored.frozen).toBe(true);
      expect(restored.source).toBe(input.value);
      expect(restored.svg.querySelector("[data-finch-editor-trigger]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Promiseで保存と読み込みを行い、公開エディターAPIでも開けない", async () => {
    const finch = createFinch();
    let stored: EditorStoredState | null = null;
    const storage = { load: async () => stored, save: vi.fn(async (_key: string, value: EditorStoredState) => { stored = value; }) };
    const first = finch.render(source, { target: "#diagram", editor: false });
    const editor = finch.attachEditor(first, { storage, restore: false, initiallyOpen: true });
    editor.element.querySelector<HTMLButtonElement>("[data-action='freeze']")!.click();
    await vi.waitFor(() => expect(editor.dirty).toBe(false));
    expect(storage.save).toHaveBeenCalledTimes(1);
    first.destroy();
    const second = finch.render(source, { target: "#diagram", editor: false });
    const restored = finch.attachEditor(second, { storage, initiallyOpen: true });
    await vi.waitFor(() => expect(second.frozen).toBe(true));
    restored.open();
    restored.setSource('@graph\nchanged');
    expect(second.source).toBe(source);
    expect(restored.element.hidden).toBe(true);
    expect(second.svg.querySelector("[data-finch-editor-trigger]")).toBeNull();
    await restored.save();
    expect((await storage.load())?.layout.frozen).toBe(true);
  });

  it("onSaveの完了までメニューと鳥アイコンを残し、フリーズした状態を保存する", async () => {
    let resolve!: () => void;
    const onSave = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    const diagram = createFinch().render(source, { target: '#diagram', onSave, editor: { initiallyOpen: true } });
    const root = document.querySelector<HTMLElement>('.finch-editor')!;
    const freeze = root.querySelector<HTMLButtonElement>('[data-action=freeze]')!;
    expect(freeze.closest('.finch-editor__exports')).not.toBeNull();
    freeze.click();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ overlay: expect.objectContaining({ frozen: true, editable: false }), markdown: expect.stringContaining('"frozen": true') }));
    expect(diagram.frozen).toBe(false);
    expect(root.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('section')!.hidden).toBe(false);
    expect(diagram.svg.querySelector('[data-finch-editor-trigger]')).not.toBeNull();
    expect(freeze.disabled).toBe(true);
    resolve();
    await vi.waitFor(() => expect(root.hidden).toBe(true));
    expect(diagram.frozen).toBe(true);
    expect(diagram.svg.querySelector('[data-finch-editor-trigger]')).toBeNull();
  });

  it.each([false, true])("保存に失敗したらメニューへ戻して再試行できる: Promise %s", async (asyncSave) => {
    const save = vi.fn(() => {
      if (asyncSave) return Promise.reject(new Error("保存できません"));
      throw new Error("保存できません");
    });
    const finch = createFinch();
    const diagram = finch.render(source, { target: "#diagram", editor: false });
    const editor = finch.attachEditor(diagram, { storage: { load: () => null, save }, initiallyOpen: true });
    editor.element.querySelector<HTMLButtonElement>("[data-action='freeze']")!.click();
    await vi.waitFor(() => expect(editor.element.querySelector("[data-error]")!.textContent).toBe("保存できません"));
    expect(diagram.frozen).toBe(false);
    expect(diagram.editable).toBe(true);
    expect(editor.element.hidden).toBe(false);
    expect(editor.element.querySelector<HTMLElement>("section")!.hidden).toBe(false);
    expect(editor.element.querySelector("[data-error]")!.textContent).toBe("保存できません");
    expect(editor.dirty).toBe(true);
    expect(diagram.svg.querySelector("[data-finch-editor-trigger]")).not.toBeNull();
  });
});

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFinch } from "../src/index";
import type { EditorStoredState } from "../src/types";

const localStorageAdapter = {
  load: (key: string) => JSON.parse(localStorage.getItem(key) ?? "null") as EditorStoredState | null,
  save: (key: string, value: EditorStoredState) => localStorage.setItem(key, JSON.stringify(value)),
};

describe("Finch editor menu", () => {
  it("replaces a stale diagram with a located syntax error and recovers after editing", () => {
    vi.useFakeTimers();
    try {
      const onSave = vi.fn();
      const instance = createFinch().render('@deployment\nnode api "API"', { target: "#diagram", editor: { initiallyOpen: true, onSave } });
      const source = document.querySelector<HTMLTextAreaElement>("[data-source]")!;
      source.value = '@deployment\n\n  node api "unfinished';
      source.dispatchEvent(new Event("input"));
      vi.runAllTimers();
      const diagnostic = document.querySelector<HTMLElement>(".finch-editor__diagnostic")!;
      expect(diagnostic.hidden).toBe(false);
      expect(diagnostic.textContent).toContain('3 |   node api "unfinished');
      expect(getComputedStyle(instance.svg).display).toBe("none");
      expect(source.getAttribute("aria-invalid")).toBe("true");
      expect(instance.source).toBe('@deployment\nnode api "API"');
      diagnostic.querySelector("button")!.click();
      expect(source.value.slice(source.selectionStart, source.selectionEnd)).toBe('  node api "unfinished');
      document.querySelector<HTMLButtonElement>("[data-action=save]")!.click();
      expect(onSave).not.toHaveBeenCalled();
      source.value = '@deployment\nnode api "Fixed"';
      source.dispatchEvent(new Event("input"));
      vi.runAllTimers();
      expect(diagnostic.hidden).toBe(true);
      expect(getComputedStyle(instance.svg).display).not.toBe("none");
      expect(instance.model.nodes[0]?.label).toBe("Fixed");
      expect(source.getAttribute("aria-invalid")).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });

  beforeEach(() => {
    document.body.innerHTML = '<div id="diagram"></div>';
    localStorage.clear();
  });

  it("is enabled by default and can be explicitly disabled", () => {
    const finch = createFinch();
    const standard = finch.render('@deployment\nnode api "API"', "#diagram");

    expect(standard.svg.querySelector("[data-finch-editor-trigger]")).not.toBeNull();
    expect(document.querySelector(".finch-editor")).not.toBeNull();
    expect(standard.editable).toBe(false);

    standard.destroy();
    document.body.innerHTML = '<div id="diagram"></div>';
    const bare = finch.render('@deployment\nnode api "API"', { target: "#diagram", editor: false });

    expect(bare.svg.querySelector("[data-finch-editor-trigger]")).toBeNull();
    expect(document.querySelector(".finch-editor")).toBeNull();
  });

  it("toggles from the Finch button and saves only when Save is pressed", () => {
    const finch = createFinch();
    const instance = finch.render('@deployment\nnode api "API"', { target: "#diagram", editor: { storage: localStorageAdapter, storageKey: "finch-test" } });
    const trigger = instance.svg.querySelector<SVGGElement>("[data-finch-editor-trigger]")!;
    const icon = trigger.querySelector<SVGImageElement>("image")!;
    const badge = trigger.querySelector<SVGCircleElement>("circle")!;
    const editor = document.querySelector<HTMLElement>(".finch-editor")!;
    const panel = editor.querySelector<HTMLElement>(".finch-editor__panel")!;

    expect(document.querySelector("#diagram")?.nextElementSibling).toBe(editor);
    expect(trigger.getAttribute("transform")).toContain(`scale(${0.75 / instance.zoom})`);
    expect(icon.getAttribute("transform")).toBeNull();
    expect(icon.style.filter).toBe("");
    expect(badge.getAttribute("fill")).toBe("#fff");
    expect(panel.hidden).toBe(true);
    expect(instance.editable).toBe(false);
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.hidden).toBe(false);
    expect(instance.editable).toBe(true);
    expect(icon.getAttribute("transform")).toBeNull();
    expect(icon.style.filter).toBe("brightness(0) invert(1)");
    expect(badge.getAttribute("fill")).toBe("#e91e63");

    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(panel.hidden).toBe(true);
    expect(instance.editable).toBe(false);
    expect(icon.style.filter).toBe("");
    expect(badge.getAttribute("fill")).toBe("#fff");
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(instance.editable).toBe(true);

    editor.querySelector<HTMLButtonElement>("[data-action='edit']")!.click();
    expect(instance.editable).toBe(false);
    expect(localStorage.getItem("finch-test")).toBeNull();

    editor.querySelector<HTMLButtonElement>("[data-action='save']")!.click();
    expect(JSON.parse(localStorage.getItem("finch-test")!)).toMatchObject({
      source: '@deployment\nnode api "API"',
      layout: { diagram: "deployment", editable: false },
    });
  });

  it("exposes Undo after a layout edit", () => {
    const finch = createFinch();
    const instance = finch.render('@deployment\nnode api "API"', { target: "#diagram", editor: { restore: false, initiallyOpen: true } });
    const editor = document.querySelector<HTMLElement>(".finch-editor")!;
    const undo = editor.querySelector<HTMLButtonElement>("[data-action='undo']")!;

    expect(undo.disabled).toBe(true);
    instance.pin("api");
    expect(undo.disabled).toBe(false);
    undo.click();
    expect(instance.isPinned("api")).toBe(false);
    expect(undo.disabled).toBe(true);
  });

  it("keeps the bird's display size constant through zoom and rerender", () => {
    const instance = createFinch().render('@graph\na -> b', { target: '#diagram', editor: { initiallyOpen: true } });
    for (const zoom of [0.25, 0.5, 1, 2]) {
      instance.setZoom(zoom);
      for (const rerender of [false, true]) {
        if (rerender) instance.update('@graph\na -> b');
        const transform = instance.svg.querySelector('[data-finch-editor-trigger]')!.getAttribute('transform')!;
        const scale = Number(/scale\(([^)]+)\)/.exec(transform)![1]);
        expect(scale * instance.zoom).toBeCloseTo(0.75);
      }
    }
  });

  it("generates stable, collision-free storage keys when none is supplied", () => {
    document.body.innerHTML = '<div id="orders"></div><div></div><div></div>';
    const finch = createFinch();
    const keys: string[] = [];
    const storage = {
      load: () => null,
      save: (key: string) => { keys.push(key); },
    };
    const hosts = [...document.body.querySelectorAll<HTMLElement>("div")];

    for (const host of hosts) {
      finch.render('@graph\nsource -> destination', { target: host, editor: { storage } });
      host.nextElementSibling?.querySelector<HTMLButtonElement>("[data-action='save']")?.click();
    }

    expect(keys[0]).toBe(`finch-editor:${location.pathname}:orders`);
    expect(keys[1]).toContain(`finch-editor:${location.pathname}:`);
    expect(keys[1]).toMatch(/:\d+$/);
    expect(keys[2]).toMatch(/:\d+$/);
    expect(new Set(keys).size).toBe(3);
  });

  it("loads and saves through an asynchronous storage adapter", async () => {
    const finch = createFinch();
    let stored: EditorStoredState | null = null;
    const storage = {
      load: vi.fn(async () => stored),
      save: vi.fn(async (_key: string, value: EditorStoredState) => { stored = value; }),
    };
    const first = finch.render('@graph\napi "API"', { target: "#diagram", editor: false });
    const firstEditor = finch.attachEditor(first, {
      storage,
      storageKey: "remote:orders",
      restore: false,
      initiallyOpen: true,
    });
    firstEditor.setSource('@graph\napi "Orders API"');
    first.pin("api");

    await firstEditor.save();
    expect(storage.save).toHaveBeenCalledWith("remote:orders", expect.objectContaining({
      source: '@graph\napi "Orders API"',
      layout: expect.objectContaining({ diagram: "graph" }),
    }));

    first.destroy();
    document.body.innerHTML = '<div id="diagram"></div>';
    const second = finch.render('@graph\napi "API"', { target: "#diagram", editor: false });
    finch.attachEditor(second, { storage, storageKey: "remote:orders" });

    await vi.waitFor(() => {
      expect(second.model.nodes.find((node) => node.id === "api")?.label).toBe("Orders API");
      expect(second.isPinned("api")).toBe(true);
    });
    expect(storage.load).toHaveBeenCalledWith("remote:orders");
  });
});

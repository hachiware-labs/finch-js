// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { createFinch } from "../src/index";

describe("Finch editor menu", () => {
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
    const instance = finch.render('@deployment\nnode api "API"', { target: "#diagram", editor: { storageKey: "finch-test" } });
    const trigger = instance.svg.querySelector<SVGGElement>("[data-finch-editor-trigger]")!;
    const icon = trigger.querySelector<SVGImageElement>("image")!;
    const badge = trigger.querySelector<SVGCircleElement>("circle")!;
    const editor = document.querySelector<HTMLElement>(".finch-editor")!;
    const panel = editor.querySelector<HTMLElement>(".finch-editor__panel")!;

    expect(document.querySelector("#diagram")?.nextElementSibling).toBe(editor);
    expect(trigger.getAttribute("transform")).toContain("scale(.75)");
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
});

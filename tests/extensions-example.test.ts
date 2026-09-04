// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFinch, defaultTheme } from "../src/index";

describe("browser extension example", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("composes a custom diagram, shape, layout, and theme", async () => {
    document.body.innerHTML = `
      <button id="layout"></button>
      <button id="reset"></button>
      <button id="theme"></button>
      <div id="diagram"></div>
      <pre id="source"></pre>
      <p id="error" hidden></p>
    `;

    const html = readFileSync(resolve("examples/extensions.html"), "utf8");
    const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
    if (!script) throw new Error("Could not find the inline extension example script.");
    const browserApi = Object.assign(createFinch(), { createFinch, defaultTheme });

    vi.stubGlobal("Finch", browserApi);

    Function(script)();

    await vi.waitFor(() => {
      expect(document.querySelectorAll("#diagram .finch-node")).toHaveLength(7);
    });
    expect(document.querySelector('[data-node-id="orders"]')?.textContent).toContain("Owner");
    expect(document.querySelector('[data-node-id="browser"] .browser-glyph')).not.toBeNull();
    expect(document.querySelector('[data-node-id="gateway"] .gateway-glyph')).not.toBeNull();
    expect(document.querySelectorAll('[data-node-id="gateway"] .gateway-glyph circle')).toHaveLength(3);
    expect(document.querySelector('[data-node-id="billing"] .shield-glyph')).not.toBeNull();
    expect(document.querySelector('[data-node-id="rewards"] .star-glyph')).not.toBeNull();
    expect(document.querySelector('[data-node-id="ledger"] .document-glyph')).not.toBeNull();
    expect(document.querySelector('[data-node-id="order-db"] ellipse')).not.toBeNull();
    expect(document.querySelector("#diagram svg")?.getAttribute("aria-label")).toBe("Custom service map extension");
    expect(document.querySelector("#error")?.hasAttribute("hidden")).toBe(true);

    document.querySelector<HTMLButtonElement>("#theme")?.click();
    expect(document.querySelector<SVGSVGElement>("#diagram svg")?.style.background).toBe("rgb(11, 17, 32)");
  });
});

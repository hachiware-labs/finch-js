// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTit, defaultTheme } from "../src/index";

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

    const sourcePath = resolve("examples/services-extension.tit");
    const scriptPath = resolve("examples/extensions.js");
    const source = readFileSync(sourcePath, "utf8");
    const script = readFileSync(scriptPath, "utf8");
    const browserApi = Object.assign(createTit(), { createTit, defaultTheme });

    vi.stubGlobal("Tit", browserApi);
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => source,
    })));

    Function(script)();

    await vi.waitFor(() => {
      expect(document.querySelectorAll("#diagram .tit-node")).toHaveLength(7);
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

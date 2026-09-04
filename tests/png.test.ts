// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFinch } from "../src/index";

describe("PNG export", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="diagram"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rasterizes the edited diagram without editor selection styles", async () => {
    const finch = createFinch();
    const instance = finch.render('@deployment\nnode api "API"', "#diagram");
    instance.importLayout({
      version: 1,
      diagram: "deployment",
      nodes: { api: { x: 321, y: 123, manual: true, pinned: false } },
    });
    instance.select("api");

    let svgSource: Blob | undefined;
    const createObjectUrl = vi.fn((value: Blob | MediaSource) => {
      if (value instanceof Blob) svgSource = value;
      return "blob:diagram";
    });
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });
    class TestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", TestImage);

    const context = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
      setTransform: vi.fn(),
    };
    let canvas: HTMLCanvasElement | undefined;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      canvas = this;
      return context as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback, type) => {
      callback(new Blob(["png"], { type: type ?? "image/png" }));
    });

    const png = await instance.toPngBlob({ scale: 2 });
    const markup = await svgSource!.text();

    expect(png.type).toBe("image/png");
    expect(canvas?.width).toBe(Math.round(instance.geometry.width * 2));
    expect(canvas?.height).toBe(Math.round(instance.geometry.height * 2));
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(TestImage), 0, 0, instance.geometry.width, instance.geometry.height);
    expect(markup).toContain("translate(321 123)");
    expect(markup).not.toMatch(/class="[^"]*is-selected/);
    expect(markup).not.toContain("data-finch-editor-trigger");
    expect(instance.svg.querySelector(".is-selected")).not.toBeNull();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:diagram");
  });

  it("downloads the PNG with the requested file name", async () => {
    vi.useFakeTimers();
    const finch = createFinch();
    const instance = finch.render('@deployment\nnode api "API"', "#diagram");
    vi.spyOn(instance, "toPngBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:png"), revokeObjectURL: revokeObjectUrl });
    let downloadedName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download;
    });

    await instance.downloadPng("edited-diagram.png");
    expect(downloadedName).toBe("edited-diagram.png");
    expect(document.querySelector("a[download]")).toBeNull();
    await vi.runAllTimersAsync();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:png");
  });

  it("downloads the SVG with the requested file name", async () => {
    vi.useFakeTimers();
    const instance = createFinch().render('@deployment\nnode api "API"', "#diagram");
    const createObjectUrl = vi.fn((_blob: Blob | MediaSource) => "blob:svg");
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });
    let downloadedName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download;
    });

    instance.downloadSvg("edited-diagram.svg");
    expect(downloadedName).toBe("edited-diagram.svg");
    expect(createObjectUrl).toHaveBeenCalledWith(expect.objectContaining({ type: "image/svg+xml;charset=utf-8" }));
    const svgBlob = createObjectUrl.mock.calls[0]?.[0] as Blob;
    expect(await svgBlob.text()).not.toContain("data-finch-editor-trigger");
    await vi.runAllTimersAsync();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:svg");
  });
});

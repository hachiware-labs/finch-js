// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFinch } from "../src/index";
import { exportDocument, saveDocument } from "../src/document-save";

describe("HTML saving and host callbacks", () => {
  beforeEach(() => { document.head.innerHTML = ""; document.body.innerHTML = '<h1>My page</h1><div id="a"></div><div id="b"></div>'; });
  afterEach(() => vi.unstubAllGlobals());
  function setup(onSave?: () => void | Promise<void>) {
    const finch = createFinch();
    const diagram = finch.render('@graph\na "Original"\na -> b', { target: '#a', editor: false });
    const editor = finch.attachEditor(diagram, { initiallyOpen: true, ...(onSave ? { onSave } : {}) });
    return { diagram, editor };
  }
  it("delegates top-level callbacks and does not echo host updates", async () => {
    const onChange = vi.fn(), onSave = vi.fn();
    const diagram = createFinch().render('@graph\na', { target: '#a', onChange, onSave, editor: { initiallyOpen: true } });
    diagram.update('@graph\na "Host"');
    diagram.importLayout(diagram.exportLayout());
    expect(onChange).not.toHaveBeenCalled();
    diagram.pin('a');
    expect(onChange).toHaveBeenCalledTimes(1);
    const input = document.querySelector('textarea')!;
    input.value = '@graph\na "Edited"';
    input.dispatchEvent(new Event('input'));
    document.querySelector<HTMLButtonElement>('[data-action=save]')!.click();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ source: input.value, markdown: expect.stringContaining('Edited'), overlay: expect.objectContaining({ version: 1 }) }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
  it("uses the picker once, reuses the handle, and supports Save As", async () => {
    const write = vi.fn(async (_html: string) => {});
    const handle = { createWritable: vi.fn(async () => ({ write, close: vi.fn(), abort: vi.fn() })) };
    const picker = vi.fn(async () => handle);
    vi.stubGlobal('showSaveFilePicker', picker);
    const { editor } = setup();
    editor.setSource('@graph\na "Saved"');
    await editor.save();
    expect(picker).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]![0]).toContain('data-finch-document');
    expect(editor.dirty).toBe(false);
    await editor.save();
    expect(picker).toHaveBeenCalledTimes(1);
    await editor.saveAs();
    expect(picker).toHaveBeenCalledTimes(2);
    expect(picker.mock.calls[1]).toEqual([expect.objectContaining({ startIn: handle })]);
  });
  it("round-trips multiple diagrams and excludes generated UI without changing the live page", () => {
    const { diagram, editor } = setup();
    editor.setSource('@graph\na "</script> saved"\na -> b');
    diagram.pin('a');
    const finch = createFinch();
    const other = finch.render('@graph\nc -> d', { target: '#b', editor: false });
    const before = diagram.exportState();
    const html = exportDocument(document);
    expect(html).not.toContain('class="finch-editor"');
    expect(html).not.toContain('<svg');
    expect(html).toContain('My page');
    expect(document.querySelector('svg')).not.toBeNull();
    diagram.destroy(); other.destroy();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
    const restored = finch.render('@graph\nold', { target: '#a', editor: false });
    expect(restored.exportState()).toEqual(before);
    expect(finch.render('@graph\nold', { target: '#b', editor: false }).model.nodes.map(n => n.id)).toEqual(['c', 'd']);
  });
  it("keeps edits made during asynchronous saving dirty", async () => {
    let finish!: () => void;
    const callback = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { editor } = setup(callback);
    editor.setSource('@graph\na "First"');
    const pending = editor.save();
    expect(editor.save()).toBe(pending);
    editor.setSource('@graph\na "Second"');
    finish(); await pending;
    expect(editor.dirty).toBe(true);
    expect(callback).toHaveBeenCalledTimes(1);
  });
  it("keeps canceled and failed saves dirty", async () => {
    const { editor } = setup(async () => { throw new DOMException('Canceled', 'AbortError'); });
    editor.setSource('@graph\na "Unsaved"');
    await expect(editor.save()).rejects.toMatchObject({ name: 'AbortError' });
    expect(editor.dirty).toBe(true);
  });
  it("does not invoke saving for invalid pending input", () => {
    const callback = vi.fn();
    const { editor } = setup(callback);
    const input = editor.element.querySelector('textarea')!;
    input.value = '@unknown\na';
    input.dispatchEvent(new Event('input'));
    expect(() => editor.save()).toThrow();
    expect(callback).not.toHaveBeenCalled();
    expect(editor.dirty).toBe(true);
  });
  it("does not write on picker cancellation and can retry", async () => {
    const { editor } = setup();
    editor.setSource('@graph\na "Changed"');
    const picker = vi.fn().mockRejectedValueOnce(new DOMException('Canceled', 'AbortError'));
    const write = vi.fn(), abort = vi.fn();
    picker.mockResolvedValue({ createWritable: async () => ({ write, close: vi.fn(), abort }) });
    vi.stubGlobal('showSaveFilePicker', picker);
    await expect(editor.saveAs()).rejects.toMatchObject({ name: 'AbortError' });
    expect(write).not.toHaveBeenCalled();
    expect(editor.dirty).toBe(true);
    await editor.saveAs();
    expect(write).toHaveBeenCalledTimes(1);
    expect(editor.dirty).toBe(false);
  });
  it("aborts failed writes and retains unsaved edits", async () => {
    const abort = vi.fn(async () => {});
    vi.stubGlobal('showSaveFilePicker', async () => ({ createWritable: async () => ({
      write: async () => { throw new Error('Disk full'); }, close: vi.fn(), abort,
    }) }));
    const { editor } = setup();
    editor.setSource('@graph\na "Changed"');
    await expect(editor.saveAs()).rejects.toThrow('Disk full');
    expect(abort).toHaveBeenCalledTimes(1);
    expect(editor.dirty).toBe(true);
  });
  it("downloads HTML when the picker is unavailable", async () => {
    const detached = document.implementation.createHTMLDocument('Download');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const OriginalURL = URL;
    const createObjectURL = vi.fn(() => 'blob:finch-test');
    vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = createObjectURL; });
    expect(await saveDocument(detached, 'test.html')).toBe('downloaded');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});

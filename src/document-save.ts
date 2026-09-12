import type { DiagramInstance } from "./instance.js";
import type { DiagramState } from "./types.js";

interface FileHandle {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
}
interface SaveWindow extends Window {
  showSaveFilePicker?: (options: { suggestedName: string; startIn?: FileHandle; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileHandle>;
}
type SaveResult = "saved" | "downloaded";
const documents = new WeakMap<Document, { instances: Map<string, DiagramInstance>; handle?: FileHandle; saving?: Promise<SaveResult> }>();
const marker = "data-finch-document-id";
const selector = 'script[type="application/json"][data-finch-document]';

function context(document: Document) {
  let value = documents.get(document);
  if (!value) { value = { instances: new Map() }; documents.set(document, value); }
  return value;
}

export function restoreDocument(host: Element): DiagramState | undefined {
  const key = host.getAttribute(marker) ?? (host.id ? `id:${host.id}` : undefined);
  if (!key) return;
  const text = host.ownerDocument.querySelector(selector)?.textContent;
  if (!text) return;
  const saved = JSON.parse(text) as { version: number; diagrams: Record<string, DiagramState> };
  if (saved.version !== 1) throw new Error("Unsupported Finch HTML document version.");
  return saved.diagrams[key];
}

export function registerDocument(instance: DiagramInstance): void {
  const host = instance.host;
  if (!host) return;
  const state = context(host.ownerDocument);
  let key = host.getAttribute(marker) ?? (host.id ? `id:${host.id}` : undefined);
  if (!key) {
    let index = 1;
    do { key = `diagram:${index++}`; } while ([...host.ownerDocument.querySelectorAll(`[${marker}]`)].some(el => el.getAttribute(marker) === key));
  }
  host.setAttribute(marker, key);
  state.instances.set(key, instance);
}

export function unregisterDocument(instance: DiagramInstance): void {
  if (!instance.host) return;
  const state = context(instance.host.ownerDocument);
  const key = instance.host.getAttribute(marker)!;
  if (state.instances.get(key) === instance) state.instances.delete(key);
}

/** Snapshot the page, keeping its bootstrap scripts and replacing Finch's generated UI with data. */
export function exportDocument(document: Document, overrides: ReadonlyMap<DiagramInstance, DiagramState> = new Map()): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  const diagrams: Record<string, DiagramState> = {};
  for (const [key, instance] of context(document).instances) {
    if (!instance.host?.isConnected) continue;
    diagrams[key] = overrides.get(instance) ?? instance.exportState();
    const host = [...clone.querySelectorAll(`[${marker}]`)].find(el => el.getAttribute(marker) === key);
    if (host) {
      // Only remove this instance's SVG, retaining other page content in its host.
      const index = [...instance.host.children].indexOf(instance.svg);
      host.children[index]?.remove();
      host.classList.remove("finch-editor-host", "finch-editor-open");
    }
  }
  clone.querySelectorAll(`.finch-editor, #finch-editor-styles, ${selector}`).forEach(el => el.remove());
  const data = document.createElement("script");
  data.type = "application/json";
  data.setAttribute("data-finch-document", "");
  data.textContent = JSON.stringify({ version: 1, diagrams }).replace(/</g, "\\u003c");
  clone.querySelector("head")!.prepend(data);
  // Preserve relative assets when the downloaded HTML is moved to another directory.
  const existingBase = clone.querySelector<HTMLBaseElement>("base[href]");
  if (existingBase) existingBase.href = document.baseURI;
  else {
    const base = document.createElement("base");
    base.href = document.baseURI;
    clone.querySelector("head")!.prepend(base);
  }
  return `<!DOCTYPE html>\n${clone.outerHTML}`;
}

export function saveDocument(document: Document, filename?: string, saveAs = false, overrides?: ReadonlyMap<DiagramInstance, DiagramState>): Promise<SaveResult> {
  const state = context(document);
  if (state.saving) return Promise.reject(new Error("別の図のHTML保存が進行中です。完了後にもう一度保存してください。"));
  const view = document.defaultView as SaveWindow | null;
  const name = filename ?? decodeURIComponent(view?.location.pathname.split("/").pop() || "diagram.html").replace(/\.[^.]+$/, "") + ".html";
  // Invoke the picker synchronously in the click's activation window.
  const selected = view?.showSaveFilePicker && (!state.handle || saveAs)
    ? view.showSaveFilePicker({ suggestedName: name, ...(state.handle ? { startIn: state.handle } : {}), types: [{ description: "HTML document", accept: { "text/html": [".html"] } }] })
    : undefined;
  const html = exportDocument(document, overrides);
  const operation = async (): Promise<SaveResult> => {
    const handle = selected ? await selected : state.handle;
    if (handle) {
      const writable = await handle.createWritable();
      try { await writable.write(html); await writable.close(); }
      catch (cause) { await writable.abort().catch(() => {}); throw cause; }
      state.handle = handle;
      return "saved";
    }
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    view?.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "downloaded";
  };
  state.saving = operation().finally(() => { delete state.saving; });
  return state.saving;
}

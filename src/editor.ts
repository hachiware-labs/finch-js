import type { DiagramInstance } from "./instance.js";
import type { EditorController, EditorOptions, LayoutOverlay } from "./types.js";
import finchIconUrl from "../docs/assets/green-warbler-finch-icon-128.png";

const STYLE_ID = "finch-editor-styles";
let editorCount = 0;

export function attachEditor(instance: DiagramInstance, options: EditorOptions = {}): EditorController {
  const host = instance.host;
  if (!host) throw new Error("Finch.attachEditor() requires an instance rendered into a target element.");
  const document = host.ownerDocument;
  installStyles(document);
  host.classList.add("finch-editor-host");

  const root = document.createElement("div");
  root.className = "finch-editor";
  root.innerHTML = `
    <section class="finch-editor__panel" id="finch-editor-panel" aria-label="Finch edit menu" hidden>
      <div class="finch-editor__header">
        <strong>Finch editor</strong>
        <span class="finch-editor__status" data-status>Saved</span>
      </div>
      <div class="finch-editor__tools" role="toolbar" aria-label="Diagram editing tools">
        <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
        <button type="button" data-action="zoom-reset" class="finch-editor__zoom" aria-label="Reset zoom to 100%">100%</button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in">＋</button>
        <span class="finch-editor__separator" aria-hidden="true"></span>
        <button type="button" data-action="edit" aria-pressed="true">Edit ON</button>
        <button type="button" data-action="undo" aria-label="Undo layout change">Undo</button>
        <button type="button" data-action="pin">Pin / Unpin</button>
        <button type="button" data-action="layout">Auto layout</button>
        <button type="button" data-action="reset">Reset</button>
        <button type="button" data-action="fit">Fit</button>
        <button type="button" data-action="width">Width</button>
      </div>
      <div class="finch-editor__exports" role="group" aria-label="Save and export">
        <button type="button" data-action="save" class="finch-editor__save">Save</button>
        <button type="button" data-action="svg">SVG</button>
        <button type="button" data-action="png">PNG</button>
      </div>
      <label class="finch-editor__source">
        <span>Source</span>
        <textarea data-source spellcheck="false" aria-label="Finch diagram source"></textarea>
      </label>
      <p class="finch-editor__error" data-error role="alert" hidden></p>
    </section>
  `;
  host.after(root);

  const panel = required<HTMLElement>(root, ".finch-editor__panel");
  const panelId = `finch-editor-panel-${++editorCount}`;
  panel.id = panelId;
  const source = required<HTMLTextAreaElement>(root, "[data-source]");
  const status = required<HTMLElement>(root, "[data-status]");
  const error = required<HTMLElement>(root, "[data-error]");
  const storageKey = options.storageKey ?? defaultStorageKey(instance);
  let timer: number | undefined;
  let dirty = false;
  let destroyed = false;
  let svgTrigger: SVGGElement | undefined;
  let svgIcon: SVGImageElement | undefined;
  let svgBadge: SVGCircleElement | undefined;
  let editableWhenOpen = instance.editable;

  function syncSvgTrigger(open: boolean): void {
    svgTrigger?.setAttribute("aria-expanded", String(open));
    if (svgBadge) {
      svgBadge.setAttribute("fill", open ? "#e91e63" : "#fff");
      svgBadge.setAttribute("stroke", open ? "#e91e63" : "#fbcfe8");
    }
    if (svgIcon) svgIcon.style.filter = open ? "brightness(0) invert(1)" : "";
  }

  function installSvgTrigger(): void {
    const svg = instance.svg;
    const existing = svg.querySelector<SVGGElement>("[data-finch-editor-trigger]");
    if (existing) {
      svgTrigger = existing;
      svgIcon = existing.querySelector<SVGImageElement>("image") ?? undefined;
      svgBadge = existing.querySelector<SVGCircleElement>("circle") ?? undefined;
      syncSvgTrigger(!panel.hidden);
      return;
    }
    const namespace = "http://www.w3.org/2000/svg";
    const group = document.createElementNS(namespace, "g");
    group.classList.add("finch-editor-trigger");
    group.dataset.finchEditorTrigger = "";
    group.setAttribute("role", "button");
    group.setAttribute("tabindex", "0");
    group.setAttribute("aria-label", "Toggle Finch edit menu");
    group.setAttribute("aria-controls", panelId);
    group.setAttribute("aria-expanded", "false");
    group.setAttribute("transform", `translate(18 ${Math.max(18, instance.geometry.height - 74)}) scale(.75)`);
    group.setAttribute("style", "cursor:pointer;outline:none");
    group.innerHTML = `
      <title>Finch editor</title>
      <circle cx="38" cy="38" r="36" fill="#fff" stroke="#fbcfe8" stroke-width="1.5"/>
      <image href="${finchIconUrl}" x="5" y="5" width="66" height="66" preserveAspectRatio="xMidYMid meet"/>
    `;
    const focusRing = group.querySelector<SVGCircleElement>("circle")!;
    group.addEventListener("focus", () => {
      focusRing.setAttribute("stroke", "#4f46e5");
      focusRing.setAttribute("stroke-width", "3");
    });
    group.addEventListener("blur", () => {
      focusRing.setAttribute("stroke", panel.hidden ? "#fbcfe8" : "#e91e63");
      focusRing.setAttribute("stroke-width", "1.5");
    });
    group.addEventListener("pointerdown", (event) => event.stopPropagation());
    group.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(panel.hidden);
    });
    group.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(panel.hidden);
    });
    svg.append(group);
    svgTrigger = group;
    svgIcon = group.querySelector<SVGImageElement>("image") ?? undefined;
    svgBadge = focusRing;
    syncSvgTrigger(!panel.hidden);
  }

  source.value = instance.source;
  if (options.sourcePane === false) required<HTMLElement>(root, ".finch-editor__source").hidden = true;

  function setOpen(open: boolean): void {
    const wasOpen = !panel.hidden;
    if (!open && (wasOpen || instance.editable)) editableWhenOpen = instance.editable;
    panel.hidden = !open;
    host!.classList.toggle("finch-editor-open", open);
    if (open && !wasOpen) instance.setEditable(editableWhenOpen);
    if (!open && instance.editable) instance.setEditable(false);
    syncSvgTrigger(open);
  }

  function setDirty(next: boolean): void {
    dirty = next;
    status.textContent = dirty ? "Unsaved" : "Saved";
    status.classList.toggle("is-dirty", dirty);
  }

  function showError(cause?: unknown): void {
    error.hidden = cause === undefined;
    error.textContent = cause === undefined ? "" : cause instanceof Error ? cause.message : String(cause);
  }

  function updateControls(): void {
    const editable = instance.editable;
    const edit = required<HTMLButtonElement>(root, "[data-action='edit']");
    edit.textContent = editable ? "Edit ON" : "Edit OFF";
    edit.setAttribute("aria-pressed", String(editable));
    required<HTMLButtonElement>(root, "[data-action='undo']").disabled = !editable || !instance.canUndo;
    required<HTMLButtonElement>(root, "[data-action='pin']").disabled = !editable || !instance.selection.length;
    for (const action of ["layout", "reset", "fit", "width"]) {
      required<HTMLButtonElement>(root, `[data-action='${action}']`).disabled = !editable;
    }
    required<HTMLElement>(root, ".finch-editor__zoom").textContent = `${Math.round(instance.zoom * 100)}%`;
  }

  function save(): void {
    const value = {
      source: source.value,
      layout: JSON.parse(instance.exportLayout()) as LayoutOverlay,
    };
    document.defaultView?.localStorage.setItem(storageKey, JSON.stringify(value));
    setDirty(false);
    showError();
  }

  function restore(): void {
    if (options.restore === false) return;
    const saved = document.defaultView?.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as { source?: unknown; layout?: unknown };
      if (typeof value.source === "string") {
        source.value = value.source;
        instance.update(value.source);
      }
      if (value.layout) instance.importLayout(value.layout as LayoutOverlay);
    } catch (cause) {
      showError(cause);
    }
  }

  function setSource(value: string): void {
    source.value = value;
    instance.update(value);
    setDirty(true);
    updateControls();
  }

  function onPanelClick(event: Event): void {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-action]");
    const action = button?.dataset.action;
    if (!action) return;
    try {
      showError();
      if (action === "zoom-out") instance.zoomOut();
      if (action === "zoom-reset") instance.resetZoom();
      if (action === "zoom-in") instance.zoomIn();
      if (action === "edit") instance.setEditable(!instance.editable);
      if (action === "undo") instance.undoLayout();
      if (action === "pin") {
        for (const id of instance.selection) instance.isPinned(id) ? instance.unpin(id) : instance.pin(id);
      }
      if (action === "layout") instance.autoLayout();
      if (action === "reset") instance.resetLayout();
      if (action === "fit") instance.fit("diagram");
      if (action === "width") instance.fit("width");
      if (action === "save") save();
      if (action === "svg") instance.downloadSvg(options.svgFilename);
      if (action === "png") void instance.downloadPng(options.pngFilename).catch(showError);
      updateControls();
    } catch (cause) {
      showError(cause);
    }
  }

  function onSourceInput(): void {
    setDirty(true);
      if (timer !== undefined) document.defaultView?.clearTimeout(timer);
    timer = document.defaultView?.setTimeout(() => {
      try {
        instance.update(source.value);
        installSvgTrigger();
        showError();
        updateControls();
      } catch (cause) {
        showError(cause);
      }
    }, options.updateDelay ?? 180);
  }

  function onLayoutChange(event: Event): void {
    const detail = (event as CustomEvent<{ changedNodeIds?: string[] }>).detail;
    if (detail?.changedNodeIds?.length) setDirty(true);
    installSvgTrigger();
    updateControls();
  }

  function onRender(): void {
    source.value = instance.source;
    setDirty(true);
    installSvgTrigger();
    updateControls();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  }

  panel.addEventListener("click", onPanelClick);
  source.addEventListener("input", onSourceInput);
  host.addEventListener("finch:layoutchange", onLayoutChange);
  host.addEventListener("finch:editchange", updateControls);
  host.addEventListener("finch:zoomchange", updateControls);
  host.addEventListener("finch:render", onRender);
  host.addEventListener("finch:destroy", destroyEditor);
  host.addEventListener("pointerup", updateControls);
  document.addEventListener("keydown", onKeydown);

  restore();
  editableWhenOpen = instance.editable;
  installSvgTrigger();
  setOpen(options.initiallyOpen ?? false);
  setDirty(false);
  updateControls();

  function destroyEditor(): void {
    if (destroyed) return;
    destroyed = true;
    if (timer !== undefined) document.defaultView?.clearTimeout(timer);
    host!.removeEventListener("finch:layoutchange", onLayoutChange);
    host!.removeEventListener("finch:editchange", updateControls);
    host!.removeEventListener("finch:zoomchange", updateControls);
    host!.removeEventListener("finch:render", onRender);
    host!.removeEventListener("finch:destroy", destroyEditor);
    host!.removeEventListener("pointerup", updateControls);
    document.removeEventListener("keydown", onKeydown);
    svgTrigger?.remove();
    svgIcon = undefined;
    svgBadge = undefined;
    host!.classList.remove("finch-editor-host", "finch-editor-open");
    root.remove();
  }

  return {
    element: root,
    get dirty() { return dirty; },
    open: () => setOpen(true),
    close: () => setOpen(false),
    save,
    setSource,
    destroy: destroyEditor,
  };
}

function defaultStorageKey(instance: DiagramInstance): string {
  const document = instance.svg.ownerDocument;
  const hostName = instance.host?.id || instance.model.kind;
  return `finch-editor:${document.defaultView?.location.pathname ?? "document"}:${hostName}`;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing Finch editor element: ${selector}`);
  return element;
}

function installStyles(document: Document): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .finch-editor { position: relative; z-index: 1; color: #172033; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .finch-editor *, .finch-editor *::before, .finch-editor *::after { box-sizing: border-box; }
    .finch-editor-host.finch-editor-open { border-bottom-right-radius: 0 !important; border-bottom-left-radius: 0 !important; }
    .finch-editor__panel { width: 100%; max-height: 720px; margin-top: -1px; overflow: auto; background: #fff; border: 1px solid #dbe3ee; border-top: 1px solid #e5eaf1; border-radius: 0 0 16px 16px; box-shadow: 0 14px 34px rgb(15 23 42 / 10%); }
    .finch-editor__panel[hidden] { display: none; }
    .finch-editor__header, .finch-editor__exports { display: flex; align-items: center; gap: 8px; padding: 11px 12px; }
    .finch-editor__header { justify-content: space-between; border-bottom: 1px solid #e5eaf1; }
    .finch-editor__header strong { font-size: 13px; letter-spacing: -0.01em; }
    .finch-editor__status { color: #64748b; font-size: 11px; }
    .finch-editor__status.is-dirty { color: #b45309; }
    .finch-editor__tools { display: flex; flex-wrap: wrap; gap: 7px; padding: 12px; border-bottom: 1px solid #e5eaf1; }
    .finch-editor button { min-height: 32px; padding: 6px 10px; color: #334155; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font: 650 12px/1.4 inherit; cursor: pointer; }
    .finch-editor button:hover { color: #4338ca; border-color: #818cf8; }
    .finch-editor button:disabled { cursor: not-allowed; opacity: .45; }
    .finch-editor button[aria-pressed="true"] { color: #fff; background: #4f46e5; border-color: #4f46e5; }
    .finch-editor__zoom { min-width: 58px; font-variant-numeric: tabular-nums; }
    .finch-editor__separator { width: 1px; margin: 2px 2px; background: #e2e8f0; }
    .finch-editor__exports { justify-content: flex-end; border-bottom: 1px solid #e5eaf1; }
    .finch-editor .finch-editor__save { color: #fff; background: #172033; border-color: #172033; }
    .finch-editor__source { display: grid; gap: 7px; padding: 12px; }
    .finch-editor__source[hidden] { display: none; }
    .finch-editor__source > span { color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .finch-editor__source textarea { width: 100%; min-height: 220px; resize: vertical; padding: 13px 14px; color: #dbeafe; background: #111827; border: 0; border-radius: 10px; outline: 0; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
    .finch-editor__source textarea:focus { box-shadow: 0 0 0 3px rgb(129 140 248 / 35%); }
    .finch-editor__error { margin: 0 12px 12px; padding: 9px 11px; color: #b91c1c; background: #fef2f2; border-radius: 8px; font-size: 12px; }
    .finch-editor__error[hidden] { display: none; }
    @media (max-width: 640px) { .finch-editor__panel { max-height: calc(100vh - 82px); } .finch-editor__source textarea { min-height: 170px; } }
  `;
  document.head.append(style);
}

import { expandAncestorContainers, rerouteGeometry } from "./layouts.js";
import { Registry } from "./registry.js";
import { SvgRenderer } from "./renderer.js";
import type {
  AutoLayoutOptions,
  EditChangeDetail,
  FitMode,
  Geometry,
  LayoutChangeDetail,
  LayoutOverlay,
  PngExportOptions,
  RenderOptions,
  SemanticModel,
  Theme,
  ZoomChangeDetail,
} from "./types.js";
import { cloneOverlay, createOverlay, parseOverlay } from "./utils.js";
import { getDiagramKind } from "./parser.js";
import { svgToPngBlob } from "./png.js";

interface DragState {
  pointerId: number;
  start: { x: number; y: number };
  origins: Map<string, { x: number; y: number }>;
  expandedContainerIds: Set<string>;
  moved: boolean;
}

interface PanState {
  pointerId: number;
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
}

export class DiagramInstance {
  readonly host: Element | undefined;
  private sourceValue: string;
  private readonly registry: Registry;
  private options: RenderOptions;
  private modelValue!: SemanticModel;
  private geometryValue!: Geometry;
  private overlayValue: LayoutOverlay;
  private editableValue = true;
  private rendererValue!: SvgRenderer;
  private themeValue!: Theme;
  private layoutName = "";
  private selectedIds = new Set<string>();
  private layoutHistory: LayoutOverlay[] = [];
  private drag: DragState | undefined;
  private pan: PanState | undefined;
  private spacePressed = false;
  private zoomValue = 1;
  private zoomMode: "auto" | "manual" | FitMode = "auto";
  private resizeObserver: ResizeObserver | undefined;
  private destroyed = false;

  constructor(source: string, options: RenderOptions, registry: Registry) {
    this.registry = registry;
    this.sourceValue = source;
    this.options = options;
    this.host = resolveTarget(options.target);
    this.overlayValue = parseOverlay(options.overlay);
    this.editableValue = options.overlay === undefined
      ? options.editable ?? true
      : this.overlayValue.editable ?? options.editable ?? true;
    this.overlayValue.editable = this.editableValue;
    if (typeof options.zoom === "number") {
      this.zoomValue = options.zoom;
      this.zoomMode = "manual";
    } else if (options.zoom === "fit") this.zoomMode = "diagram";
    else if (options.zoom === "width") this.zoomMode = "width";
    this.rebuild({ force: false, preservePinned: true });
  }

  get svg(): SVGSVGElement {
    return this.rendererValue.svg;
  }

  get source(): string {
    return this.sourceValue;
  }

  get model(): SemanticModel {
    return this.modelValue;
  }

  get geometry(): Geometry {
    return this.geometryValue;
  }

  get overlay(): LayoutOverlay {
    return cloneOverlay(this.overlayValue);
  }

  get selection(): string[] {
    return [...this.selectedIds];
  }

  get zoom(): number {
    return this.zoomValue;
  }

  get editable(): boolean {
    return this.editableValue;
  }

  get canUndo(): boolean {
    return this.layoutHistory.length > 0;
  }

  get viewportMode(): "auto" | "manual" | FitMode {
    return this.zoomMode;
  }

  setZoom(zoom: number): this {
    this.assertActive();
    this.zoomMode = "manual";
    this.applyZoom(zoom, true);
    return this;
  }

  zoomIn(factor = 1.1): this {
    return this.setZoom(this.zoomValue * Math.max(1.01, factor));
  }

  zoomOut(factor = 1.1): this {
    return this.setZoom(this.zoomValue / Math.max(1.01, factor));
  }

  resetZoom(): this {
    return this.setZoom(1);
  }

  fit(mode: FitMode = "diagram"): this {
    this.assertActive();
    if (!this.editableValue) return this;
    this.zoomMode = mode;
    this.applyViewport(true);
    const host = this.scrollHost();
    if (host) {
      host.scrollLeft = 0;
      host.scrollTop = 0;
    }
    return this;
  }

  update(source: string): this {
    this.assertActive();
    const previousKind = this.modelValue.kind;
    this.sourceValue = source;
    const nextKind = getDiagramKind(source);
    if (previousKind !== nextKind) {
      this.overlayValue = createOverlay(this.editableValue);
      this.layoutHistory = [];
      this.selectedIds.clear();
    }
    this.rebuild({ force: false, preservePinned: true });
    return this;
  }

  setTheme(theme: string | Theme): this {
    this.assertActive();
    this.options = { ...this.options, theme };
    this.rebuild({ force: false, preservePinned: true });
    return this;
  }

  setLayout(layout: string): this {
    this.assertActive();
    if (!this.editableValue) return this;
    this.options = { ...this.options, layout };
    this.rebuild({ force: true, preservePinned: true });
    return this;
  }

  select(ids: string | string[], additive = false): this {
    if (!this.editableValue) return this;
    const values = typeof ids === "string" ? [ids] : ids;
    if (!additive) this.selectedIds.clear();
    const valid = new Set(this.geometryValue.nodes.map((node) => node.id));
    for (const id of values) if (valid.has(id)) this.selectedIds.add(id);
    this.rendererValue.setSelection(this.selectedIds);
    return this;
  }

  clearSelection(): this {
    this.selectedIds.clear();
    this.rendererValue.setSelection(this.selectedIds);
    return this;
  }

  pin(ids: string | string[] = this.selection): this {
    if (!this.editableValue) return this;
    return this.setPin(ids, true);
  }

  unpin(ids: string | string[] = this.selection): this {
    if (!this.editableValue) return this;
    return this.setPin(ids, false);
  }

  isPinned(id: string): boolean {
    return this.overlayValue.nodes[id]?.pinned ?? false;
  }

  autoLayout(options: AutoLayoutOptions = {}): this {
    this.assertActive();
    if (!this.editableValue) return this;
    this.rememberLayout();
    const preservePinned = options.preservePinned ?? true;
    for (const [id, state] of Object.entries(this.overlayValue.nodes)) {
      if (!preservePinned || !state.pinned) delete this.overlayValue.nodes[id];
    }
    this.rebuild({ force: true, preservePinned });
    this.emitLayoutChange(this.geometryValue.nodes.map((node) => node.id));
    return this;
  }

  resetLayout(): this {
    if (!this.editableValue) return this;
    this.rememberLayout();
    this.overlayValue = createOverlay(this.editableValue);
    this.rebuild({ force: true, preservePinned: false });
    this.emitLayoutChange(this.geometryValue.nodes.map((node) => node.id));
    return this;
  }

  exportLayout(space = 2): string {
    const activeIds = new Set(this.geometryValue.nodes.map((node) => node.id));
    const nodes = Object.fromEntries(Object.entries(this.overlayValue.nodes).filter(([id]) => activeIds.has(id)));
    return JSON.stringify({ version: 1, diagram: this.modelValue.kind, editable: this.editableValue, nodes }, null, space);
  }

  importLayout(layout: LayoutOverlay | string): this {
    const overlay = parseOverlay(layout);
    if (overlay.diagram && overlay.diagram !== this.modelValue.kind) {
      throw new Error(`Layout overlay is for @${overlay.diagram}, not @${this.modelValue.kind}.`);
    }
    this.editableValue = overlay.editable ?? true;
    overlay.editable = this.editableValue;
    this.overlayValue = overlay;
    this.layoutHistory = [];
    this.rebuild({ force: false, preservePinned: true });
    return this;
  }

  undoLayout(): this {
    this.assertActive();
    if (!this.editableValue || !this.layoutHistory.length) return this;
    const current = this.overlayValue;
    const previous = this.layoutHistory.pop()!;
    previous.editable = this.editableValue;
    this.overlayValue = previous;
    this.rebuild({ force: false, preservePinned: true });
    const changedNodeIds = [...new Set([...Object.keys(current.nodes), ...Object.keys(previous.nodes)])]
      .filter((id) => JSON.stringify(current.nodes[id]) !== JSON.stringify(previous.nodes[id]));
    this.emitLayoutChange(changedNodeIds);
    return this;
  }

  setEditable(editable: boolean): this {
    this.assertActive();
    if (this.editableValue === editable) return this;
    this.editableValue = editable;
    this.overlayValue.editable = editable;
    this.drag = undefined;
    this.pan = undefined;
    this.spacePressed = false;
    if (!editable) this.clearSelection();
    this.applyEditState();
    const detail: EditChangeDetail = { editable, overlay: this.overlay };
    this.rendererValue.svg.dispatchEvent(new CustomEvent<EditChangeDetail>("finch:editchange", { detail, bubbles: true }));
    this.emitLayoutChange([]);
    return this;
  }

  saveLayout(target?: HTMLScriptElement | string): string {
    const json = this.exportLayout();
    let element: HTMLScriptElement | null = null;
    if (typeof target === "string") element = this.svg.ownerDocument.querySelector<HTMLScriptElement>(target);
    else if (target) element = target;
    else if (this.host) element = this.host.parentElement?.querySelector<HTMLScriptElement>("script[type='application/json'][data-finch-layout]") ?? null;
    if (element) {
      element.type = "application/json";
      element.dataset.finchLayout = "";
      element.textContent = json;
    }
    return json;
  }

  toSvgString(): string {
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    for (const control of clone.querySelectorAll("[data-finch-editor-trigger]")) control.remove();
    return new XMLSerializer().serializeToString(clone);
  }

  downloadSvg(filename = `${this.modelValue.kind}.svg`): void {
    this.assertActive();
    const blob = new Blob([this.toSvgString()], { type: "image/svg+xml;charset=utf-8" });
    this.downloadBlob(blob, filename);
  }

  toPngBlob(options: PngExportOptions = {}): Promise<Blob> {
    this.assertActive();
    return svgToPngBlob(this.svg, this.geometryValue, this.themeValue.canvasColor, options);
  }

  async downloadPng(filename = `${this.modelValue.kind}.png`, options: PngExportOptions = {}): Promise<void> {
    const blob = await this.toPngBlob(options);
    this.downloadBlob(blob, filename);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.svg.ownerDocument.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    this.svg.ownerDocument.body?.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      const view = this.svg.ownerDocument.defaultView;
      (view?.setTimeout ?? setTimeout)(() => URL.revokeObjectURL(url), 0);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:destroy", { bubbles: true }));
    this.rendererValue.svg.remove();
    this.resizeObserver?.disconnect();
    this.selectedIds.clear();
    this.destroyed = true;
  }

  private rebuild(layoutOptions: { force: boolean; preservePinned: boolean }): void {
    this.assertNotDestroyed();
    const kind = getDiagramKind(this.sourceValue);
    const diagram = this.registry.diagram(kind);
    this.themeValue = typeof this.options.theme === "object"
      ? this.options.theme
      : this.registry.theme(this.options.theme ?? "default");
    this.modelValue = diagram.parse(this.sourceValue);
    const layoutModel = diagram.toLayoutModel(this.modelValue, {
      theme: this.themeValue,
      measure: (shape, label, attributes) => this.registry.shape(shape).measure({ label, attributes, theme: this.themeValue }),
    });
    this.layoutName = this.options.layout ?? diagram.defaultLayout;
    const previous = this.geometryValue?.kind === kind ? this.geometryValue : undefined;
    this.geometryValue = this.registry.layout(this.layoutName).layout(layoutModel, {
      overlay: this.overlayValue,
      ...(previous ? { previous } : {}),
      force: layoutOptions.force,
      preservePinned: layoutOptions.preservePinned,
    });
    this.overlayValue.diagram = kind;
    this.overlayValue.editable = this.editableValue;
    const document = this.host?.ownerDocument ?? globalThis.document;
    if (!document) throw new Error("Finch.render() requires a browser Document or a target Element.");
    const nextRenderer = new SvgRenderer(document, this.themeValue, (name) => this.registry.shape(name), this.options.ariaLabel ?? `${kind} diagram`);
    nextRenderer.draw(this.geometryValue);
    const oldSvg = this.rendererValue?.svg;
    this.rendererValue = nextRenderer;
    if (this.host) {
      if (oldSvg?.parentElement === this.host) oldSvg.replaceWith(nextRenderer.svg);
      else this.host.replaceChildren(nextRenderer.svg);
    }
    this.bindInteractions();
    const active = new Set(this.geometryValue.nodes.map((node) => node.id));
    this.selectedIds = new Set([...this.selectedIds].filter((id) => active.has(id)));
    this.rendererValue.setSelection(this.selectedIds);
    for (const [id, state] of Object.entries(this.overlayValue.nodes)) this.rendererValue.setPinned(id, state.pinned);
    this.applyViewport(false);
    this.observeHost();
    this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:render", { bubbles: true }));
  }

  private bindInteractions(): void {
    this.applyEditState();
    if (this.options.interactive === false) return;
    const svg = this.rendererValue.svg;
    svg.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    svg.addEventListener("pointermove", (event) => this.onPointerMove(event));
    svg.addEventListener("pointerup", (event) => this.onPointerUp(event));
    svg.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    svg.addEventListener("wheel", (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      this.zoomMode = "manual";
      this.applyZoom(this.zoomValue * (event.deltaY < 0 ? 1.1 : 1 / 1.1), true, { clientX: event.clientX, clientY: event.clientY });
    }, { passive: false });
    svg.addEventListener("dblclick", (event) => {
      if (!this.editableValue) return;
      const id = this.rendererValue.nodeIdFromTarget(event.target);
      if (id) this.setPin(id, !this.isPinned(id));
    });
    svg.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.clearSelection();
      if (this.editableValue && event.key.toLowerCase() === "p" && this.selectedIds.size) this.pin();
      if (event.key === " ") {
        this.spacePressed = true;
        event.preventDefault();
      }
      if (event.key === "+" || event.key === "=") this.zoomIn();
      if (event.key === "-") this.zoomOut();
      if (event.key === "0") this.resetZoom();
      if (event.key.toLowerCase() === "f") this.fit("diagram");
    });
    svg.addEventListener("keyup", (event) => {
      if (event.key === " ") this.spacePressed = false;
    });
    svg.addEventListener("blur", () => {
      this.spacePressed = false;
    });
  }

  private onPointerDown(event: PointerEvent): void {
    const scrollHost = this.scrollHost();
    if (scrollHost && (event.button === 1 || (event.button === 0 && (!this.editableValue || this.spacePressed || event.altKey)))) {
      this.pan = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: scrollHost.scrollLeft,
        scrollTop: scrollHost.scrollTop,
      };
      this.rendererValue.svg.classList.add("is-panning");
      this.rendererValue.svg.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (!this.editableValue) return;
    if (event.button !== 0) return;
    const id = this.rendererValue.nodeIdFromTarget(event.target);
    if (!id) {
      if (!event.ctrlKey && !event.metaKey) this.clearSelection();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      if (this.selectedIds.has(id)) this.selectedIds.delete(id);
      else this.selectedIds.add(id);
    } else if (!this.selectedIds.has(id)) {
      this.selectedIds = new Set([id]);
    }
    this.rendererValue.setSelection(this.selectedIds);
    const movingIds = this.withContainerDescendants(this.selectedIds);
    const origins = new Map<string, { x: number; y: number }>();
    for (const node of this.geometryValue.nodes) if (movingIds.has(node.id)) origins.set(node.id, { x: node.x, y: node.y });
    this.drag = {
      pointerId: event.pointerId,
      start: this.rendererValue.clientPoint(event),
      origins,
      expandedContainerIds: new Set(),
      moved: false,
    };
    this.rendererValue.svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.pan && this.pan.pointerId === event.pointerId) {
      const host = this.scrollHost();
      if (host) {
        host.scrollLeft = this.pan.scrollLeft - (event.clientX - this.pan.clientX);
        host.scrollTop = this.pan.scrollTop - (event.clientY - this.pan.clientY);
      }
      return;
    }
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const point = this.rendererValue.clientPoint(event);
    const dx = point.x - this.drag.start.x;
    const dy = point.y - this.drag.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 1) this.drag.moved = true;
    const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
    for (const [id, origin] of this.drag.origins) {
      const node = map.get(id);
      if (!node) continue;
      node.x = Math.max(8, origin.x + dx);
      node.y = Math.max(8, origin.y + dy);
    }
    for (const id of expandAncestorContainers(this.geometryValue.nodes, this.drag.origins.keys())) {
      this.drag.expandedContainerIds.add(id);
    }
    rerouteGeometry(this.geometryValue);
    this.rendererValue.updateGeometry(this.geometryValue);
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.pan && this.pan.pointerId === event.pointerId) {
      this.pan = undefined;
      this.rendererValue.svg.classList.remove("is-panning");
      if (this.rendererValue.svg.hasPointerCapture(event.pointerId)) this.rendererValue.svg.releasePointerCapture(event.pointerId);
      return;
    }
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const drag = this.drag;
    this.drag = undefined;
    if (this.rendererValue.svg.hasPointerCapture(event.pointerId)) this.rendererValue.svg.releasePointerCapture(event.pointerId);
    if (!drag.moved) return;
    this.rememberLayout();
    const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
    for (const id of drag.origins.keys()) {
      const node = map.get(id);
      if (!node) continue;
      const previous = this.overlayValue.nodes[id];
      this.overlayValue.nodes[id] = {
        x: node.x,
        y: node.y,
        manual: true,
        pinned: previous?.pinned ?? false,
        ...(previous?.width ? { width: previous.width } : {}),
        ...(previous?.height ? { height: previous.height } : {}),
      };
    }
    this.emitLayoutChange([...new Set([...drag.origins.keys(), ...drag.expandedContainerIds])]);
  }

  private setPin(ids: string | string[], pinned: boolean): this {
    if (!this.editableValue) return this;
    const values = typeof ids === "string" ? [ids] : ids;
    const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
    const changed = values.filter((id) => map.has(id) && this.isPinned(id) !== pinned);
    if (!changed.length) return this;
    this.rememberLayout();
    for (const id of changed) {
      const node = map.get(id);
      if (!node) continue;
      const existing = this.overlayValue.nodes[id];
      this.overlayValue.nodes[id] = {
        x: existing?.x ?? node.x,
        y: existing?.y ?? node.y,
        manual: existing?.manual ?? false,
        pinned,
        ...(existing?.width ? { width: existing.width } : {}),
        ...(existing?.height ? { height: existing.height } : {}),
      };
      this.rendererValue.setPinned(id, pinned);
    }
    this.emitLayoutChange(changed);
    return this;
  }

  private rememberLayout(): void {
    this.layoutHistory.push(cloneOverlay(this.overlayValue));
  }

  private withContainerDescendants(ids: ReadonlySet<string>): Set<string> {
    const result = new Set(ids);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of this.geometryValue.nodes) {
        if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
          result.add(node.id);
          changed = true;
        }
      }
    }
    return result;
  }

  private emitLayoutChange(changedNodeIds: string[]): void {
    const detail: LayoutChangeDetail = { overlay: this.overlay, changedNodeIds };
    this.rendererValue.svg.dispatchEvent(new CustomEvent<LayoutChangeDetail>("finch:layoutchange", { detail, bubbles: true }));
  }

  private applyEditState(): void {
    const svg = this.rendererValue?.svg;
    if (!svg) return;
    svg.dataset.editable = String(this.editableValue);
    svg.classList.toggle("is-view-only", !this.editableValue);
  }

  private applyViewport(emit: boolean): void {
    const host = this.scrollHost();
    const style = host ? this.rendererValue.svg.ownerDocument.defaultView?.getComputedStyle(host) : undefined;
    const horizontalPadding = (Number.parseFloat(style?.paddingLeft ?? "0") || 0) + (Number.parseFloat(style?.paddingRight ?? "0") || 0);
    const verticalPadding = (Number.parseFloat(style?.paddingTop ?? "0") || 0) + (Number.parseFloat(style?.paddingBottom ?? "0") || 0);
    const availableWidth = Math.max(1, (host?.clientWidth ?? this.geometryValue.width) - horizontalPadding);
    const availableHeight = Math.max(1, (host?.clientHeight ?? this.geometryValue.height) - verticalPadding);
    let zoom = this.zoomValue;
    if (this.zoomMode === "auto") zoom = Math.min(1, availableWidth / this.geometryValue.width);
    if (this.zoomMode === "width") zoom = availableWidth / this.geometryValue.width;
    if (this.zoomMode === "diagram") zoom = Math.min(availableWidth / this.geometryValue.width, availableHeight / this.geometryValue.height);
    this.applyZoom(zoom, emit);
  }

  private applyZoom(zoom: number, emit: boolean, anchor?: { clientX: number; clientY: number }): void {
    const minimum = Math.max(0.05, this.options.minZoom ?? 0.25);
    const maximum = Math.max(minimum, this.options.maxZoom ?? 2);
    const next = Math.max(minimum, Math.min(maximum, Number.isFinite(zoom) ? zoom : 1));
    const host = this.scrollHost();
    const hostRect = host?.getBoundingClientRect();
    const viewportX = anchor && hostRect ? anchor.clientX - hostRect.left : (host?.clientWidth ?? 0) / 2;
    const viewportY = anchor && hostRect ? anchor.clientY - hostRect.top : (host?.clientHeight ?? 0) / 2;
    const contentX = host ? (host.scrollLeft + viewportX) / this.zoomValue : 0;
    const contentY = host ? (host.scrollTop + viewportY) / this.zoomValue : 0;
    this.zoomValue = next;
    const svg = this.rendererValue.svg;
    svg.style.width = `${this.geometryValue.width * next}px`;
    svg.style.height = `${this.geometryValue.height * next}px`;
    svg.style.minWidth = "0";
    svg.style.maxWidth = "none";
    svg.dataset.zoom = String(next);
    if (host && anchor) {
      host.scrollLeft = Math.max(0, contentX * next - viewportX);
      host.scrollTop = Math.max(0, contentY * next - viewportY);
    }
    if (emit) {
      const detail: ZoomChangeDetail = { zoom: next, mode: this.zoomMode };
      svg.dispatchEvent(new CustomEvent<ZoomChangeDetail>("finch:zoomchange", { detail, bubbles: true }));
    }
  }

  private observeHost(): void {
    this.resizeObserver?.disconnect();
    const host = this.scrollHost();
    const ResizeObserverConstructor = this.rendererValue.svg.ownerDocument.defaultView?.ResizeObserver;
    if (!host || !ResizeObserverConstructor) return;
    this.resizeObserver = new ResizeObserverConstructor(() => {
      if (this.zoomMode !== "manual") this.applyViewport(true);
    });
    this.resizeObserver.observe(host);
  }

  private scrollHost(): HTMLElement | undefined {
    const view = this.rendererValue?.svg.ownerDocument.defaultView;
    return view && this.host instanceof view.HTMLElement ? this.host : undefined;
  }

  private assertActive(): void {
    this.assertNotDestroyed();
  }

  private assertNotDestroyed(): void {
    if (this.destroyed) throw new Error("This Finch.js diagram has been destroyed.");
  }
}

function resolveTarget(target: RenderOptions["target"]): Element | undefined {
  if (!target) return undefined;
  if (typeof target !== "string") return target;
  const element = globalThis.document?.querySelector(target);
  if (!element) throw new Error(`Finch.js target "${target}" was not found.`);
  return element;
}

import { timingDiagram, timingLayout, timingShape } from "./timing.js";
import { DiagramInstance } from "./instance.js";
import { builtInLayouts } from "./layouts.js";
import { createObjectDiagram, createActivityDiagram, createClassDiagram, createComponentDiagram, createDeploymentDiagram, createErDiagram, createFlowchartDiagram, createGraphDiagram, createSequenceDiagram, createSlideDiagram, createStateDiagram, createUsecaseDiagram, getDiagramKind } from "./parser.js";
import { lucideIcons } from "./icons.js";
import { Registry } from "./registry.js";
import { builtInShapes } from "./shapes.js";
import { defaultTheme, midnightTheme, prismTheme } from "./theme.js";
import type { IconDefinition, DiagramPlugin, LayoutPlugin, RenderOptions, ShapePlugin, ThemePlugin, FinchApi } from "./types.js";
import { createOverlay } from "./utils.js";
import { attachEditor } from "./editor.js";
import { parseMarkdown } from "./markdown.js";
import type { MarkdownRenderOptions } from "./types.js";

export class FinchEngine implements FinchApi {
  private readonly registry = new Registry();

  constructor() {
    this.registerDiagram("timing", timingDiagram);
    this.registerLayout("timing", timingLayout);
    this.registerShape("timing-track", timingShape);
    this.registerDiagram("deployment", createDeploymentDiagram());
    this.registerDiagram("graph", createGraphDiagram());
    this.registerDiagram("sequence", createSequenceDiagram());
    this.registerDiagram("flowchart", createFlowchartDiagram());
    this.registerDiagram("state", createStateDiagram());
    this.registerDiagram("er", createErDiagram());
    this.registerDiagram("component", createComponentDiagram());
    this.registerDiagram("slide", createSlideDiagram());
    this.registerDiagram("object", createObjectDiagram());
    this.registerDiagram("class", createClassDiagram());
    this.registerDiagram("usecase", createUsecaseDiagram());
    this.registerDiagram("activity", createActivityDiagram());
    for (const [name, icon] of Object.entries(lucideIcons)) this.registerIcon(name, icon);
    for (const shape of builtInShapes) this.registerShape(shape.name, shape);
    for (const layout of builtInLayouts) this.registerLayout(layout.name, layout);
    this.registerTheme("default", defaultTheme);
    this.registerTheme("midnight", midnightTheme);
    this.registerTheme("prism", prismTheme);
  }

  render(source: string, options: RenderOptions | Element | string = {}): DiagramInstance {
    const normalized: RenderOptions = typeof options === "string" || isElement(options)
      ? { target: options }
      : options;
    const instance = new DiagramInstance(source, normalized, this.registry);
    if (instance.host && normalized.editor !== false) {
      attachEditor(instance, {
        ...(typeof normalized.editor === "object" ? normalized.editor : {}),
        ...(normalized.onSave ? { onSave: normalized.onSave } : {}),
      });
    }
    return instance;
  }

  attachEditor(instance: DiagramInstance, options = {}) {
    return attachEditor(instance, options);
  }

  parseMarkdown(markdown: string) {
    return parseMarkdown(markdown);
  }

  renderMarkdown(markdown: string, options: MarkdownRenderOptions | Element | string = {}): DiagramInstance {
    const normalized: MarkdownRenderOptions = typeof options === "string" || isElement(options)
      ? { target: options } : options;
    const { diagramIndex = 0, ...renderOptions } = normalized;
    const diagram = parseMarkdown(markdown)[diagramIndex];
    if (!Number.isInteger(diagramIndex) || !diagram) throw new Error("指定した Finch のコードフェンスがありません。");
    return this.render(diagram.source, {
      ...renderOptions,
      ...(diagram.overlay ? { overlay: diagram.overlay } : {}),
      ...(renderOptions.overlay !== undefined ? { overlay: renderOptions.overlay } : {}),
    });
  }

  parse(source: string) {
    return this.registry.diagram(getDiagramKind(source)).parse(source);
  }

  registerDiagram(name: string, plugin: DiagramPlugin): void {
    this.registry.registerDiagram(name, plugin);
  }

  registerShape(name: string, plugin: ShapePlugin): void {
    this.registry.registerShape(name, plugin);
  }

  registerLayout(name: string, plugin: LayoutPlugin): void {
    this.registry.registerLayout(name, plugin);
  }

  registerIcon(name: string, icon: IconDefinition): void {
    this.registry.registerIcon(name, icon);
  }

  registerIconPack(namespace: string, icons: Record<string, IconDefinition>): void {
    if (!/^[a-z][a-z0-9-]*$/i.test(namespace)) throw new Error("Invalid icon pack namespace.");
    for (const [name, icon] of Object.entries(icons)) this.registerIcon(`${namespace}:${name}`, icon);
  }

  registerTheme(name: string, theme: ThemePlugin): void {
    this.registry.registerTheme(name, theme);
  }

  createLayoutOverlay() {
    return createOverlay();
  }
}

function isElement(value: unknown): value is Element {
  return typeof Element !== "undefined" && value instanceof Element;
}

export function createFinch(): FinchEngine {
  return new FinchEngine();
}

export const Finch = createFinch();
export default Finch;

export { DiagramInstance } from "./instance.js";
export { attachEditor } from "./editor.js";
export { parseMarkdown } from "./markdown.js";
export { defaultTheme, midnightTheme, prismTheme } from "./theme.js";
export { lucideIcons } from "./icons.js";
export { parseObject, parseActivity, parseClass, parseComponent, parseDeployment, parseEr, parseFlowchart, parseGraph, parseSequence, parseSlide, parseState, parseUsecase } from "./parser.js";
export type * from "./types.js";

export { validateState } from "./state-validation.js";

export { parseTiming } from "./timing.js";

export { preprocess, preprocessAsync, snapshotPreprocessAsync, restorePreprocess } from "./preprocess.js";
export type { PreprocessOptions, AsyncPreprocessOptions, PreprocessSnapshot } from "./preprocess.js";

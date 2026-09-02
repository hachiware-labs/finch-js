import { DiagramInstance } from "./instance.js";
import { builtInLayouts } from "./layouts.js";
import { createActivityDiagram, createClassDiagram, createComponentDiagram, createDeploymentDiagram, createErDiagram, createFlowchartDiagram, createSequenceDiagram, createSlideDiagram, createStateDiagram, createUsecaseDiagram, getDiagramKind } from "./parser.js";
import { Registry } from "./registry.js";
import { builtInShapes } from "./shapes.js";
import { defaultTheme, midnightTheme } from "./theme.js";
import type { DiagramPlugin, LayoutPlugin, RenderOptions, ShapePlugin, ThemePlugin, TitApi } from "./types.js";
import { createOverlay } from "./utils.js";

export class TitEngine implements TitApi {
  private readonly registry = new Registry();

  constructor() {
    this.registerDiagram("deployment", createDeploymentDiagram());
    this.registerDiagram("sequence", createSequenceDiagram());
    this.registerDiagram("flowchart", createFlowchartDiagram());
    this.registerDiagram("state", createStateDiagram());
    this.registerDiagram("er", createErDiagram());
    this.registerDiagram("component", createComponentDiagram());
    this.registerDiagram("slide", createSlideDiagram());
    this.registerDiagram("class", createClassDiagram());
    this.registerDiagram("usecase", createUsecaseDiagram());
    this.registerDiagram("activity", createActivityDiagram());
    for (const shape of builtInShapes) this.registerShape(shape.name, shape);
    for (const layout of builtInLayouts) this.registerLayout(layout.name, layout);
    this.registerTheme("default", defaultTheme);
    this.registerTheme("midnight", midnightTheme);
  }

  render(source: string, options: RenderOptions | Element | string = {}): DiagramInstance {
    const normalized: RenderOptions = typeof options === "string" || isElement(options)
      ? { target: options }
      : options;
    return new DiagramInstance(source, normalized, this.registry);
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

export function createTit(): TitEngine {
  return new TitEngine();
}

export const Tit = createTit();
export default Tit;

export { DiagramInstance } from "./instance.js";
export { defaultTheme, midnightTheme } from "./theme.js";
export { parseActivity, parseClass, parseComponent, parseDeployment, parseEr, parseFlowchart, parseSequence, parseSlide, parseState, parseUsecase } from "./parser.js";
export type * from "./types.js";

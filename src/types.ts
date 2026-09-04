export type DiagramKind = string;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds extends Point, Size {}

export interface SemanticNode {
  id: string;
  label: string;
  shape: string;
  parentId?: string;
  attributes: Record<string, string>;
}

export interface SemanticConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  dashed: boolean;
  order: number;
  groupId?: string;
  attributes?: Record<string, string>;
}

export interface SemanticGroup {
  id: string;
  label: string;
  kind?: "group" | "alt" | "opt" | "loop" | "par" | "break" | "critical";
  start: number;
  end: number;
}

export interface SemanticModel {
  kind: DiagramKind;
  nodes: SemanticNode[];
  connections: SemanticConnection[];
  groups: SemanticGroup[];
  source: string;
}

export interface LayoutItem {
  id: string;
  label: string;
  shape: string;
  size: Size;
  parentId?: string;
  attributes: Record<string, string>;
}

export interface LayoutConnection extends SemanticConnection {}

export interface LayoutModel {
  kind: DiagramKind;
  items: LayoutItem[];
  connections: LayoutConnection[];
  groups: SemanticGroup[];
  direction: "right" | "down";
  minimumGap: number;
}

export interface GeometryNode extends Bounds {
  id: string;
  label: string;
  shape: string;
  parentId?: string;
  attributes: Record<string, string>;
}

export interface GeometryEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  dashed: boolean;
  points: Point[];
  order: number;
  groupId?: string;
  attributes?: Record<string, string>;
}

export interface GeometryGroup extends Bounds {
  id: string;
  label: string;
  kind?: "group" | "alt" | "opt" | "loop" | "par" | "break" | "critical";
}

export interface Geometry {
  kind: DiagramKind;
  nodes: GeometryNode[];
  edges: GeometryEdge[];
  groups: GeometryGroup[];
  width: number;
  height: number;
}

export interface LayoutNodeState extends Point {
  manual: boolean;
  pinned: boolean;
  width?: number;
  height?: number;
}

export interface LayoutOverlay {
  version: 1;
  diagram?: DiagramKind;
  editable?: boolean;
  nodes: Record<string, LayoutNodeState>;
}

export interface ShapeMeasureContext {
  label: string;
  attributes: Record<string, string>;
  theme: Theme;
}

export interface ShapeRenderContext {
  node: GeometryNode;
  theme: Theme;
  document: Document;
}

export interface ShapePlugin {
  name: string;
  measure(context: ShapeMeasureContext): Size;
  render(context: ShapeRenderContext): SVGGElement;
}

export interface DiagramPlugin {
  name: string;
  defaultLayout: string;
  parse(source: string): SemanticModel;
  toLayoutModel(model: SemanticModel, context: DiagramContext): LayoutModel;
}

export interface DiagramContext {
  measure(shape: string, label: string, attributes: Record<string, string>): Size;
  theme: Theme;
}

export interface LayoutContext {
  overlay: LayoutOverlay;
  previous?: Geometry;
  force: boolean;
  preservePinned: boolean;
}

export interface LayoutPlugin {
  name: string;
  layout(model: LayoutModel, context: LayoutContext): Geometry;
}

export interface Theme {
  name: string;
  fontFamily: string;
  fontSize: number;
  labelColor: string;
  mutedColor: string;
  nodeFill: string;
  nodeStroke: string;
  nodeStrokeWidth: number;
  nodeRadius: number;
  nodePaddingX: number;
  nodePaddingY: number;
  containerFill: string;
  containerStroke: string;
  edgeColor: string;
  edgeWidth: number;
  accentColor: string;
  canvasColor: string;
  shadow: string;
  gapX: number;
  gapY: number;
}

export interface ThemePlugin extends Theme {}

export interface RenderOptions {
  target?: Element | string;
  layout?: string;
  theme?: string | Theme;
  overlay?: LayoutOverlay | string;
  interactive?: boolean;
  editable?: boolean;
  padding?: number;
  ariaLabel?: string;
  zoom?: number | "auto" | "fit" | "width";
  minZoom?: number;
  maxZoom?: number;
  editor?: boolean | EditorOptions;
}

export type FitMode = "diagram" | "width";

export interface ZoomChangeDetail {
  zoom: number;
  mode: "auto" | "manual" | FitMode;
}

export interface AutoLayoutOptions {
  preservePinned?: boolean;
}

export interface PngExportOptions {
  scale?: number;
  background?: string | null;
}

export interface EditorOptions {
  storageKey?: string;
  restore?: boolean;
  sourcePane?: boolean;
  initiallyOpen?: boolean;
  updateDelay?: number;
  svgFilename?: string;
  pngFilename?: string;
}

export interface EditorController {
  readonly element: HTMLElement;
  readonly dirty: boolean;
  open(): void;
  close(): void;
  save(): void;
  setSource(value: string): void;
  destroy(): void;
}

export interface LayoutChangeDetail {
  overlay: LayoutOverlay;
  changedNodeIds: string[];
}

export interface EditChangeDetail {
  editable: boolean;
  overlay: LayoutOverlay;
}

export interface FinchApi {
  render(source: string, options?: RenderOptions | Element | string): import("./instance.js").DiagramInstance;
  attachEditor(instance: import("./instance.js").DiagramInstance, options?: EditorOptions): EditorController;
  registerDiagram(name: string, plugin: DiagramPlugin): void;
  registerShape(name: string, plugin: ShapePlugin): void;
  registerLayout(name: string, plugin: LayoutPlugin): void;
  registerTheme(name: string, theme: ThemePlugin): void;
  parse(source: string): SemanticModel;
  createLayoutOverlay(): LayoutOverlay;
}

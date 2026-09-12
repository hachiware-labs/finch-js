export type DiagramKind = string;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ShapeSize extends Size {
  /** Space reserved above container children, including a wrapped heading. */
  headerHeight?: number;
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
  branches?: Array<{ start: number; label: string }>;
}

export interface StateDiagnostic {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface DiagramText { title?: string; header?: string; footer?: string; legend?: string; }

export interface SequencePageBreak { at:number; serial:number; title?:string; }

export interface SemanticModel {
  pageBreaks?: SequencePageBreak[];
  diagramText?: DiagramText;
  diagnostics?: StateDiagnostic[];
  stateMachines?: Record<string, SemanticModel>;
  stateMachineKind?: "protocol";
  extendsMachine?: string;
  kind: DiagramKind;
  nodes: SemanticNode[];
  connections: SemanticConnection[];
  groups: SemanticGroup[];
  direction?: "right" | "down";
  source: string;
}

export interface LayoutItem {
  id: string;
  label: string;
  shape: string;
  size: ShapeSize;
  parentId?: string;
  attributes: Record<string, string>;
}

export interface LayoutConnection extends SemanticConnection {}

export interface LayoutModel {
  pageBreaks?: SequencePageBreak[];
  diagramText?: DiagramText;
  labelFontFamily?: string;
  kind: DiagramKind;
  items: LayoutItem[];
  connections: LayoutConnection[];
  groups: SemanticGroup[];
  direction: "right" | "down";
  minimumGap: number;
  labelFontSize?: number;
}

export interface GeometryNode extends Bounds {
  headerHeight?: number;
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
  headerHeight?: number;
  id: string;
  label: string;
  branches?: Array<{ y: number; label: string }>;
  kind?: "group" | "alt" | "opt" | "loop" | "par" | "break" | "critical";
}

export interface Geometry {
  pageBreaks?: SequencePageBreak[];
  diagramText?: {top:number;bottom:number;blocks:Array<{kind:"title"|"header"|"footer"|"legend";text?:string;lines:string[];lineHeight:number;fontSize:number;y:number}>};
  kind: DiagramKind;
  /** Preserve reading direction when routing again after an interactive move. */
  direction?: LayoutModel["direction"];
  nodes: GeometryNode[];
  edges: GeometryEdge[];
  groups: GeometryGroup[];
  width: number;
  height: number;
  /** SVG viewport origin; node and saved overlay coordinates remain unchanged. */
  origin?: Point;
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
  frozen?: boolean;
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
  measure(context: ShapeMeasureContext): ShapeSize;
  render(context: ShapeRenderContext): SVGGElement;
}

export interface DiagramPlugin {
  name: string;
  defaultLayout: string;
  parse(source: string): SemanticModel;
  toLayoutModel(model: SemanticModel, context: DiagramContext): LayoutModel;
}

export interface DiagramContext {
  measure(shape: string, label: string, attributes: Record<string, string>): ShapeSize;
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

export type IconDefinition = { src: string } | Array<{
  tag: "path" | "rect" | "circle" | "ellipse" | "line" | "polyline" | "polygon";
  attributes: Record<string, string>;
}>;

export interface ThemeTone {
  fill: string;
  stroke: string;
  labelColor?: string;
}

export interface Theme {
  /** Named colors inherited through parent containers. tone=none resets inheritance. */
  tones?: Record<string, ThemeTone>;
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
  stateTransitions?: "separate" | "group";
  /** Widen crowded deployment corridors after automatic layout; saved placements are preserved. */
  expandRoutingChannels?: boolean;
  preprocess?: import("./preprocess.js").PreprocessOptions;
  onChange?: (state: DiagramState) => void;
  onSave?: (state: DiagramState) => void | Promise<void>;
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

export interface MarkdownDiagram {
  source: string;
  overlay?: LayoutOverlay;
}

export interface MarkdownRenderOptions extends RenderOptions {
  diagramIndex?: number;
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
  onSave?: (state: DiagramState) => void | Promise<void>;
  htmlFilename?: string;
  storageKey?: string;
  storage?: EditorStorage;
  restore?: boolean;
  sourcePane?: boolean;
  initiallyOpen?: boolean;
  updateDelay?: number;
  svgFilename?: string;
  pngFilename?: string;
}

export interface EditorStoredState {
  source: string;
  layout: LayoutOverlay;
}

export interface DiagramState {
  /** Resolved theme snapshot, including custom palettes, for HTML restoration. */
  theme?: Theme;
  preprocess?: import("./preprocess.js").PreprocessSnapshot;
  source: string;
  overlay: LayoutOverlay;
  markdown: string;
}

export interface EditorStorage {
  load(key: string): EditorStoredState | null | Promise<EditorStoredState | null>;
  save(key: string, value: EditorStoredState): void | Promise<void>;
}

export interface EditorController {
  readonly element: HTMLElement;
  readonly dirty: boolean;
  open(): void;
  close(): void;
  save(): void | Promise<void>;
  saveAs(): void | Promise<void>;
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
  parseMarkdown(markdown: string): MarkdownDiagram[];
  renderMarkdown(markdown: string, options?: MarkdownRenderOptions | Element | string): import("./instance.js").DiagramInstance;
  render(source: string, options?: RenderOptions | Element | string): import("./instance.js").DiagramInstance;
  attachEditor(instance: import("./instance.js").DiagramInstance, options?: EditorOptions): EditorController;
  registerDiagram(name: string, plugin: DiagramPlugin): void;
  registerShape(name: string, plugin: ShapePlugin): void;
  registerLayout(name: string, plugin: LayoutPlugin): void;
  registerTheme(name: string, theme: ThemePlugin): void;
  registerIcon(name: string, icon: IconDefinition): void;
  registerIconPack(namespace: string, icons: Record<string, IconDefinition>): void;
  parse(source: string): SemanticModel;
  createLayoutOverlay(): LayoutOverlay;
}

import type { ThemePlugin } from "./types.js";

export const defaultTheme: ThemePlugin = {
  tones: {
    cyan: { fill: "#ecfeff", stroke: "#087e91" },
    coral: { fill: "#fff1f2", stroke: "#be3455" },
    green: { fill: "#ecfdf5", stroke: "#087f5b" },
    amber: { fill: "#fffbeb", stroke: "#996500" },
    violet: { fill: "#f5f3ff", stroke: "#7552b8" },
  },
  name: "default",
  fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 13,
  labelColor: "#172033",
  mutedColor: "#64748b",
  nodeFill: "#ffffff",
  nodeStroke: "#cbd5e1",
  nodeStrokeWidth: 1.25,
  nodeRadius: 8,
  nodePaddingX: 16,
  nodePaddingY: 10,
  containerFill: "#f8fafc",
  containerStroke: "#94a3b8",
  edgeColor: "#64748b",
  edgeWidth: 1.5,
  accentColor: "#4f46e5",
  canvasColor: "#ffffff",
  shadow: "0 2px 8px rgba(15, 23, 42, 0.10)",
  gapX: 72,
  gapY: 32,
};

export const prismTheme: ThemePlugin = {
  ...defaultTheme, name: "prism", fontFamily: "Segoe UI, sans-serif", fontSize: 15,
  labelColor: "#f0f5ff", mutedColor: "#b1c0d8", nodeFill: "#17243a",
  nodeStroke: "#6683ac", nodeStrokeWidth: 1.6, nodeRadius: 7,
  nodePaddingX: 24, nodePaddingY: 17, containerFill: "#101c30",
  containerStroke: "#3c526f", edgeColor: "#afc3df", edgeWidth: 2,
  accentColor: "#52d7ff", canvasColor: "#0b1323", gapX: 75, gapY: 46, shadow: "none",
  tones: {
    cyan: { fill: "#102b3e", stroke: "#50d6ff" },
    coral: { fill: "#321f30", stroke: "#ff8193" },
    green: { fill: "#142e2d", stroke: "#55e0ae" },
    amber: { fill: "#30291e", stroke: "#ffc566" },
    violet: { fill: "#25223d", stroke: "#b89aff" },
  },
};

export const midnightTheme: ThemePlugin = {
  ...defaultTheme,
  name: "midnight",
  tones: { ...prismTheme.tones },
  labelColor: "#e2e8f0",
  mutedColor: "#94a3b8",
  nodeFill: "#172033",
  nodeStroke: "#475569",
  containerFill: "#101827",
  containerStroke: "#475569",
  edgeColor: "#94a3b8",
  accentColor: "#818cf8",
  canvasColor: "#0b1120",
  shadow: "0 2px 10px rgba(0, 0, 0, 0.28)",
};


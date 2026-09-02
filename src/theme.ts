import type { ThemePlugin } from "./types.js";

export const defaultTheme: ThemePlugin = {
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

export const midnightTheme: ThemePlugin = {
  ...defaultTheme,
  name: "midnight",
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

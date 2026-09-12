import type {GeometryNode, Point} from "./types.js";
export type InterfaceSide = "left" | "right" | "top" | "bottom";
export function interfaceOpening(node: GeometryNode): InterfaceSide {
  const value = node.attributes.opening ?? node.attributes.interfaceOpening;
  return value === "left" || value === "right" || value === "top" ? value : "bottom";
}
export function requiredInterfacePath(node: GeometryNode): string {
  const x=node.width/2, y=22, r=18;
  switch(interfaceOpening(node)) {
    case "right": return `M ${x} ${y+r} A ${r} ${r} 0 0 1 ${x} ${y-r}`;
    case "left": return `M ${x} ${y-r} A ${r} ${r} 0 0 1 ${x} ${y+r}`;
    case "top": return `M ${x+r} ${y} A ${r} ${r} 0 0 1 ${x-r} ${y}`;
    default: return `M ${x-r} ${y} A ${r} ${r} 0 0 1 ${x+r} ${y}`;
  }
}
export function requiredInterfacePort(node: GeometryNode, side: InterfaceSide): Point {
  const opening=interfaceOpening(node);
  // The open half has no stroke. Use its nearest rim instead.
  const anchor=side===opening ? (side==="top"||side==="bottom" ? "right" : "top") : side;
  return {x:node.x+node.width/2+(anchor==="left"?-18:anchor==="right"?18:0),
    y:node.y+22+(anchor==="top"?-18:anchor==="bottom"?18:0)};
}

import type { PngExportOptions, Size } from "./types.js";
import { embedImages } from "./images.js";

export async function svgToPngBlob(
  svg: SVGSVGElement,
  size: Size,
  defaultBackground: string,
  options: PngExportOptions = {},
): Promise<Blob> {
  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("PNG scale must be a positive number.");

  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const background = options.background === undefined ? defaultBackground : options.background;
  clone.removeAttribute("xmlns");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("tabindex");
  clone.removeAttribute("data-zoom");
  clone.classList.remove("is-panning");
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.minWidth = "0";
  clone.style.maxWidth = "none";
  clone.style.background = background ?? "transparent";
  for (const node of clone.querySelectorAll(".finch-node")) node.classList.remove("is-selected");
  for (const control of clone.querySelectorAll("[data-finch-editor-trigger]")) control.remove();

  await embedImages(clone);
  const markup = new XMLSerializer().serializeToString(clone);
  const source = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const sourceUrl = URL.createObjectURL(source);

  try {
    const image = await loadImage(sourceUrl);
    const canvas = svg.ownerDocument.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Finch.js could not create a canvas for PNG export.");
    context.setTransform(scale, 0, 0, scale, 0, 0);
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0, width, height);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Finch.js could not render the SVG for PNG export."));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Finch.js could not encode the diagram as PNG."));
    }, "image/png");
  });
}

/** Rasterize an immutable page snapshot using an HTML document's canvas runtime. */
export function svgMarkupToPngBlob(markup:string,document:Document,options:PngExportOptions={}):Promise<Blob>{
  const parsed=new DOMParser().parseFromString(markup,'image/svg+xml');
  if(parsed.querySelector('parsererror'))throw new Error('Invalid page SVG.');
  const svg=document.importNode(parsed.documentElement,true) as unknown as SVGSVGElement;
  return svgToPngBlob(svg,{width:Number(svg.getAttribute('width')),height:Number(svg.getAttribute('height'))},svg.style.backgroundColor || svg.style.background || 'transparent',options);
}

import type { LayoutOverlay, MarkdownDiagram } from "./types.js";
import { parseOverlay } from "./utils.js";

const layoutStart = /^' @finch-layout(?:\s.*)?$/;
const layoutEnd = "' @end-finch-layout";

/** Markdown の Finch コードフェンスを、文書に現れる順で読みます。 */
export function parseMarkdown(markdown: string): MarkdownDiagram[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const diagrams: MarkdownDiagram[] = [];
  let fence: { character: string; length: number; indent: number; finch: boolean; lines: string[] } | undefined;
  for (const line of lines) {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1]![0] === fence.character && close[1]!.length >= fence.length) {
        if (fence.finch) diagrams.push(readDiagram(fence.lines.join("\n")));
        fence = undefined;
      } else {
        const indent = Math.min(fence.indent, /^ */.exec(line)![0].length);
        fence.lines.push(line.slice(indent));
      }
      continue;
    }
    const open = /^( {0,3})(`{3,}|~{3,})([^\n]*)$/.exec(line);
    if (!open || (open[2]![0] === "`" && open[3]!.includes("`"))) continue;
    const language = open[3]!.trim().split(/\s+/)[0];
    fence = { character: open[2]![0]!, length: open[2]!.length, indent: open[1]!.length,
      finch: language === "finch" || language === "finchjs" || language === "finch.js", lines: [] };
  }
  if (fence?.finch) throw new Error("Finch のコードフェンスが閉じられていません。");
  return diagrams;
}

function readDiagram(body: string): MarkdownDiagram {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => layoutStart.test(line));
  if (start < 0) {
    if (lines.includes(layoutEnd)) throw new Error("Finch の座標の開始がありません。");
    return { source: body };
  }
  const end = lines.indexOf(layoutEnd, start + 1);
  if (end < 0 || lines.slice(end + 1).some((line) => line.trim())) {
    throw new Error("Finch の座標は、図のソースのあとに一つだけ保存してください。");
  }
  const json = lines.slice(start + 1, end).map((line) => {
    if (!line.startsWith("' ")) throw new Error("Finch の座標の行は、アポストロフィと空白で始めてください。");
    return line.slice(2);
  }).join("\n");
  const overlay = readOverlay(json);
  return { source: lines.slice(0, start).join("\n"), overlay };
}

function readOverlay(json: string): LayoutOverlay {
  const raw = JSON.parse(json) as LayoutOverlay;
  if (!raw || !raw.nodes || typeof raw.nodes !== "object" || Array.isArray(raw.nodes)) {
    throw new Error("Finch の座標には nodes オブジェクトが必要です。");
  }
  if (raw.editable !== undefined && typeof raw.editable !== "boolean") {
    throw new Error("Finch の editable には true または false を指定してください。");
  }
  for (const node of Object.values(raw.nodes)) {
    if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)
      || typeof node.manual !== "boolean" || typeof node.pinned !== "boolean"
      || (node.width !== undefined && (!Number.isFinite(node.width) || node.width <= 0))
      || (node.height !== undefined && (!Number.isFinite(node.height) || node.height <= 0))) {
      throw new Error("Finch の座標の値が正しくありません。");
    }
  }
  return parseOverlay(raw);
}

export function writeMarkdown(source: string, overlay: LayoutOverlay): string {
  if (source.split(/\r?\n/).some((line) => layoutStart.test(line))) {
    throw new Error("図のソースに Finch の座標が含まれています。parseMarkdown() で分けてください。");
  }
  const fence = "`".repeat(Math.max(3, ...Array.from(source.matchAll(/`+/g), (match) => match[0].length + 1)));
  const json = JSON.stringify(overlay, null, 2).split("\n").map((line) => `' ${line}`).join("\n");
  return `${fence}finch\n${source}\n' @finch-layout 座標を戻す。ノードの位置と大きさを保存します。\n${json}\n${layoutEnd}\n${fence}\n`;
}

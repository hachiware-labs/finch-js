import { richRuns, richMarkup } from "./rich-text.js";
import type { Theme } from "./types.js";

const canvases = new WeakMap<Document, CanvasRenderingContext2D>();
const defaultFont = 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

function graphemes(value: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: undefined, options: { granularity: "grapheme" }) => { segment(text: string): Iterable<{ segment: string }> } }).Segmenter;
  return Segmenter ? [...new Segmenter(undefined, { granularity: "grapheme" }).segment(value)].map((part) => part.segment) : [...value];
}

export function textWidth(value: string, fontSize: number, fontFamily = defaultFont, weight = 560): number {
  const runs = richRuns(value);
  if(runs.some(r=>r.bold||r.italic||r.strike||r.color||r.href))return runs.reduce((sum,run)=>sum+textWidth(run.text,fontSize,fontFamily,run.bold?700:weight)*(run.italic?1.05:1),0);
  const document = globalThis.document;
  if (document?.defaultView && "CanvasRenderingContext2D" in document.defaultView) {
    let context = canvases.get(document);
    if (!context) {
      context = document.createElement("canvas").getContext("2d") ?? undefined;
      if (context) canvases.set(document, context);
    }
    if (context) {
      context.font = `${weight} ${fontSize}px ${fontFamily}`;
      return Math.ceil(context.measureText(value).width);
    }
  }
  return Math.ceil(graphemes(value).reduce((width, character) => width + fontSize
    * (/[^\u0000-\u00ff]/.test(character) ? 1 : /[MW@#%]/.test(character) ? 0.95 : 0.62), 0));
}

export function wrapWidth(attributes: Record<string, string> | undefined, fallback: number): number {
  const requested = Number(attributes?.wrapWidth);
  return Number.isFinite(requested) && requested > 0 ? Math.max(24, requested) : fallback;
}

/** Hard breaks are preserved; words and long tokens wrap without discarding text. */
export function wrappedLines(value: string, maximumWidth: number, measure: (text: string) => number): string[] {
  const runs=richRuns(value.replace(/\\\\|\\r\\n|\\[nr]/g, escape=>escape==="\\\\"?"\\":"\n"));
  if(runs.some(r=>r.bold||r.italic||r.strike||r.color||r.href)){
    const plain=runs.map(r=>r.text).join("");
    const rows=wrappedLines(plain,maximumWidth,text=>measure(text)*1.12);
    let cursor=0;
    return rows.map(row=>{
      let position=0;
      const start=cursor,end=start+row.length;
      const markup=runs.map(run=>{
        const a=Math.max(start-position,0),b=Math.min(end-position,run.text.length);
        position+=run.text.length;
        return b>a?richMarkup({...run,text:run.text.slice(a,b)}):"";
      }).join("");
      cursor=end;
      if(plain[cursor]==="\n")cursor++;
      return markup;
    });
  }
  const lines: string[] = [];
  for (const paragraph of value.replace(/\\\\|\\r\\n|\\[nr]/g, escape => escape === "\\\\" ? "\\" : "\n").replace(/\r\n?/g, "\n").split("\n")) {
    const characters = graphemes(paragraph);
    if (!characters.length) { lines.push(""); continue; }
    const paragraphLines: string[] = [];
    const offsets = [0];
    for (const character of characters) offsets.push(offsets[offsets.length - 1]! + character.length);
    const Segmenter = (Intl as unknown as { Segmenter?: new (locale: undefined, options: { granularity: "word" }) => { segment(text: string): Iterable<{ segment: string; index: number }> } }).Segmenter;
    const boundaries = new Set<number>();
    if (Segmenter) for (const part of new Segmenter(undefined, { granularity: "word" }).segment(paragraph)) {
      boundaries.add(part.index + part.segment.length);
    }
    const units = [...paragraph.matchAll(/[0-9０-９]+(?:[,.，．][0-9０-９]+)*(?:兆|億|万|千)?(?:円|件|人|日|月|年|台|個|時間|分|秒|%|％)?/gu)]
      .map((match) => ({ start: match.index, end: match.index + match[0].length }));
    const safeBreak = (index: number): boolean => !/[（(「『【［｛〈《]$/u.test(characters[index - 1] ?? "")
      && !/^[、。，．！？!?）)」』】］｝〉》]/u.test(characters[index] ?? "")
      && !units.some((unit) => offsets[index]! > unit.start && offsets[index]! < unit.end);
    let start = 0;
    while (start < characters.length) {
      let end = start;
      let space = -1;
      while (end < characters.length && (end === start || measure(characters.slice(start, end + 1).join("")) <= maximumWidth)) {
        if (/\s/.test(characters[end]!)) space = end;
        end += 1;
      }
      if (end < characters.length) {
        if (space >= start) end = space + 1;
        else {
          const fits = Array.from({ length: end - start }, (_, i) => start + i + 1).filter(safeBreak);
          const preferred = fits.filter((index) => boundaries.has(offsets[index]!)
            && measure(characters.slice(start, index).join("")) >= maximumWidth * 0.5);
          end = preferred[preferred.length - 1] ?? fits[fits.length - 1] ?? end;
        }
      }
      paragraphLines.push(characters.slice(start, end).join(""));
      start = end;
    }
    // Rebalance a short final line without changing the number of lines or
    // crossing an explicit line break. Preserve every original character.
    if (paragraphLines.length > 1 && measure(paragraphLines[paragraphLines.length - 1]!) < maximumWidth * 0.25) {
      const last = paragraphLines.length - 1;
      const tail = graphemes(paragraphLines[last - 1]! + paragraphLines[last]!);
      const tailStart = characters.length - tail.length;
      const candidates = Array.from({ length: tail.length - 1 }, (_, i) => i + 1)
        .filter((index) => safeBreak(tailStart + index))
        .map((index) => {
          const left = tail.slice(0, index).join("");
          const right = tail.slice(index).join("");
          return { left, right, leftWidth: measure(left), rightWidth: measure(right), word: boundaries.has(offsets[tailStart + index]!) };
        }).filter((candidate) => candidate.leftWidth <= maximumWidth && candidate.rightWidth <= maximumWidth);
      candidates.sort((a, b) => Number(b.word) - Number(a.word)
        || Math.abs(a.leftWidth - a.rightWidth) - Math.abs(b.leftWidth - b.rightWidth));
      if (candidates[0]) paragraphLines.splice(last - 1, 2, candidates[0].left, candidates[0].right);
    }
    lines.push(...paragraphLines);
  }
  return lines;
}

export function labelLayout(value: string, width: number, fontSize: number, fontFamily?: string, weight = 560) {
  const measure = (text: string) => textWidth(text, fontSize, fontFamily, weight);
  const lines = wrappedLines(value, Math.max(fontSize, width), measure);
  const lineHeight = Math.ceil(fontSize * 1.4);
  return { lines, lineHeight, width: Math.max(0, ...lines.map(measure)), height: lines.length * lineHeight };
}

export function nodeLabelLayout(label: string, attributes: Record<string, string> | undefined, theme: Theme, maximum = 216) {
  return labelLayout(label, wrapWidth(attributes, maximum), theme.fontSize, theme.fontFamily);
}

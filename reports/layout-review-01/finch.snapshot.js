"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/component-bodies.ts
  function expandComponentBodies(source) {
    if (!/^\s*@(component|deployment|usecase)\b/.test(source)) return void 0;
    const lines = source.split(/\r?\n/);
    let changed = false, shield;
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      if (shield) {
        if (text === `end ${shield}`) shield = void 0;
        continue;
      }
      if (/^(title|header|footer|legend)$/.test(text)) {
        shield = text;
        continue;
      }
      const note = text.match(/^(note|rnote|hnote|constraint)\s+(?:(?:(?:left|right|top|bottom)\s+)?on\s+link|as\s+[\w.-]+|(?:(?:left|right|top|bottom)\s+of\s+)?(?:"(?:\\.|[^"\\])*"|\[[^\]]+\]|[\w.-]+))$/);
      if (note) {
        shield = note[1];
        continue;
      }
      const alias = text.match(/^(component|node|folder|database|usecase\/?|card|artifact|file|queue|cloud|rectangle|hexagon|stack|action|storage|process|agent|person|collections|actor\/?|boundary|control|entity|label)\s+([\w.-]+)\s+(.*?)as\s+"([^"]*)$/);
      if (alias) {
        const body2 = alias[4] ? [alias[4]] : [];
        let end2 = i + 1;
        while (end2 < lines.length && !/^(?:\\.|[^"\\])*"\s*$/.test(lines[end2].trim())) body2.push(lines[end2++].trim());
        if (end2 === lines.length) throw new Error(`Unclosed ${alias[1]} description on line ${i + 1}; expected closing quote.`);
        const last = lines[end2].trim().slice(0, -1);
        if (last) body2.push(last);
        lines[i] = `${alias[1]} ${alias[2]} ${JSON.stringify(body2.join("\n"))} ${alias[3]}`;
        for (let j = i + 1; j <= end2; j++) lines[j] = "";
        i = end2;
        changed = true;
        continue;
      }
      const start = text.match(/^(component|node|folder|database|usecase\/?|card|artifact|file|queue|cloud|rectangle|hexagon|stack|action|storage|process|agent|person|collections|actor\/?|boundary|control|entity|label)\s+([\w.-]+)\s+(.*?)\[$/);
      if (!start) continue;
      const body = [];
      let end = i + 1;
      while (end < lines.length && !/^\](?:\s+(?:\[(?:"(?:\\.|[^"\\])*"|[^"\]])*\]|<<[^<>]*>>|\$[\w.-]+))*(?:\s*(?:#|\/\/).*)?$/.test(lines[end].trim())) body.push(lines[end++].trim());
      if (end === lines.length) throw new Error(`Unclosed ${start[1]} description on line ${i + 1}; expected ].`);
      lines[i] = `${start[1]} ${start[2]} ${JSON.stringify(body.join("\n"))} ${start[3]} ${lines[end].trim().slice(1)}`;
      for (let j = i + 1; j <= end; j++) lines[j] = "";
      i = end;
      changed = true;
    }
    return changed ? lines.join("\n") : void 0;
  }

  // src/element-aliases.ts
  function componentNameId(name) {
    return /^[\w.-]+$/.test(name) ? name : "__component_" + Array.from(name).map((c) => c.codePointAt(0).toString(16)).join("_");
  }
  function normalizeElementAlias(line) {
    line = line.replace(/^(\s*)\(\)\s+/, "$1circle ");
    line = line.replace(/^(\s*)<>\s+/, "$1diamond ");
    line = line.replace(/^(\s*)abstract\s+class\s+/, "$1abstract ");
    const alias = line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|circle)\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+(?:<[^{}]+?>)?)(\s*(?:<<[^<>\n]+>>\s*)?(?:\{\s*\}?)?)\s*$/);
    if (alias) line = `${alias[1]}${alias[2]} ${alias[4]} ${alias[3]}${alias[2] === "stereotype" && !alias[5].trim() ? " {}" : alias[5]}`;
    const named = line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|circle)\s+([\w.-]+(?:<[^{}]+?>)?)\s+as\s+("(?:\\.|[^"\\])*")(\s*(?:<<[^<>\n]+>>\s*)?(?:\{\s*\}?)?)\s*$/);
    if (named) line = `${named[1]}${named[2]} ${named[3]} ${named[4]}${named[2] === "stereotype" && !named[5].trim() ? " {}" : named[5]}`;
    return line;
  }
  function normalizeDeploymentAlias(line) {
    const compact = line.match(/^(\s*)(?::([^:\n]+):|\(([^()\n]+)\))(?:\s+as\s+([\w.-]+))?(\s*(?:\[[^\]]*\])?\s*)$/);
    if (compact) {
      const label = compact[2] ?? compact[3];
      return `${compact[1]}${compact[2] !== void 0 ? "actor" : "usecase"} ${compact[4] ?? componentNameId(label)} ${JSON.stringify(label)}${compact[5]}`;
    }
    line = line.replace(/^(\s*)\(\)\s+/, "$1provided ");
    const bracket = line.match(/^(\s*)(?:component\s+)?\[([^\]\n]+)\](?:\s+as\s+([\w.-]+))?(\s*(?:\[[^\]]*\])?\s*\{?\s*)$/);
    if (bracket) {
      const id = bracket[3] ?? componentNameId(bracket[2]);
      return `${bracket[1]}component ${id} ${JSON.stringify(bracket[2])}${bracket[4]}`;
    }
    const kinds = "node|server|database|container|actor/?|rectangle|rounded|system|component|external|interface|usecase/?|device|execution|artifact|file|card|hexagon|label|circle|boundary|control|entity|collections|stack|action|storage|process|agent|person|package|port|portin|portout|provided|required|queue|cloud|folder|frame";
    const quoted = String.raw`"(?:\\.|[^"\\])*"`;
    const suffix = String.raw`(\s*(?:\[[^\]]*\])?\s*(?:\{\s*\}?)?\s*)`;
    const unnamed = line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+(${quoted})${suffix}$`));
    if (unnamed) {
      const name = unnamed[3].slice(1, -1).replace(/\\"/g, '"');
      return `${unnamed[1]}${unnamed[2]} ${componentNameId(name)} ${unnamed[3]}${unnamed[4]}`;
    }
    const first = line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+(${quoted})\s+as\s+([\w.-]+)${suffix}$`));
    if (first) return `${first[1]}${first[2]} ${first[4]} ${first[3]}${first[5]}`;
    const bare = line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+([\w.-]+)\s+as\s+([\w.-]+)${suffix}$`));
    if (bare) return `${bare[1]}${bare[2]} ${bare[4]} ${JSON.stringify(bare[3])}${bare[5]}`;
    const last = line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+([\w.-]+)\s+as\s+(${quoted})${suffix}$`));
    return last ? `${last[1]}${last[2]} ${last[3]} ${last[4]}${last[5]}` : line;
  }

  // src/class-visibility.ts
  function expandClassVisibility(source) {
    if (!/^\s*@(class|object)\b/m.test(source)) return void 0;
    let body = false, changed = false;
    let heading;
    const result = source.split(/\r?\n/).map((line) => {
      if (body) {
        if (line.trim() === "}") body = false;
        return line;
      }
      if (heading) {
        if (line.trim() === `end ${heading}`) heading = void 0;
        return line;
      }
      if (/^(title|header|footer|legend)$/.test(line.trim())) {
        heading = line.trim();
        return line;
      }
      const prefix = line.match(/^(\s*)([+~#-])\s*((?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*)$/);
      const normalized = prefix ? normalizeElementAlias(prefix[1] + prefix[3]) : line;
      if (/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map)\s+.*\{\s*$/.test(normalized)) body = true;
      if (!prefix) return line;
      const id = normalized.match(/^\s*\w+\s+([\w.-]+)/)?.[1];
      if (!id) throw new Error("A visible classifier requires an identifier or alias.");
      changed = true;
      return `visibility ${id} "${prefix[2]}"
${normalized}`;
    }).join("\n");
    return changed ? result : void 0;
  }

  // src/block-notes.ts
  function expandBlockNotes(source) {
    const lines = source.split(/\r?\n/);
    let changed = false;
    let heading;
    let memberBody = false;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      if (heading) {
        if (line === `end ${heading}`) heading = void 0;
        continue;
      }
      const code = line.replace(/"(?:\\.|[^"\\])*"/g, "").replace(/\s+(?:#|\/\/).*$/, "").trim();
      if (memberBody) {
        if (code === "}") memberBody = false;
        continue;
      }
      if (/^[+~#-]?\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(code)) {
        memberBody = true;
        continue;
      }
      if (/^(title|header|footer|legend)$/.test(line)) {
        heading = line;
        continue;
      }
      const spanning = line.match(/^(note|rnote|hnote)\s+over\s+([\w.-]+(?:\s*,\s*[\w.-]+)*)$/);
      const across = line.match(/^(note|rnote|hnote)\s+across$/);
      const named = line.match(/^(note|rnote|hnote)\s+as\s+([\w.-]+)$/);
      const previous = /^\s*@(class|object)\b/m.test(source) && /^(note|rnote|hnote)\s+(left|right|top|bottom)$/.test(line);
      const link = line.match(/^(note|rnote|hnote)(?:\s+(left|right|top|bottom))?\s+on\s+link$/);
      const start = link ? [line, link[1], link[1], "link"] : named ? [line, named[1], named[1], named[2]] : across ? [line, across[1], across[1], "across"] : spanning ? [line, `${spanning[1]} over`, spanning[1], spanning[2]] : line.match(/^((note|rnote|hnote|constraint)(?:\s+(?:left|right|top|bottom)\s+of)?)\s+("(?:\\.|[^"\\])*"|\[[^\]\n]+\]|[\w.-]+(?:::[^"\n]+|->[\w.-]+)?)$/);
      if (!start) continue;
      const body = [];
      let end = index + 1;
      while (end < lines.length && lines[end].trim() !== `end ${start[2]}`) body.push(lines[end++].trim());
      if (end === lines.length) throw new Error(`Unclosed ${start[2]} block on line ${index + 1}; expected end ${start[2]}.`);
      lines[index] = link ? `${line}: ${JSON.stringify(body.join("\n"))}` : named ? `${start[1]} ${JSON.stringify(body.join("\n"))} as ${start[3]}` : `${start[1]} ${start[3]}${spanning || across || previous ? ":" : ""} ${JSON.stringify(body.join("\n"))}`;
      for (let at = index + 1; at <= end; at++) lines[at] = "";
      index = end;
      changed = true;
    }
    return changed ? lines.join("\n") : void 0;
  }

  // src/rich-text.ts
  function richRuns(input) {
    if (!/(?:<\/?(?:b|i|s|color)\b|\*\*|\/\/|--|\[\[)/.test(input)) return [{ text: input }];
    let value = input.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(?<!:)\/\/([^/]+)\/\//g, "<i>$1</i>").replace(/--([^-]+)--/g, "<s>$1</s>");
    const result = [], stack = [{}];
    const pattern = /<(b|i|s)>|<color:([#\w]+)>|<\/(b|i|s|color)>|\[\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]\]/g;
    let offset = 0;
    for (const match of value.matchAll(pattern)) {
      if (match.index > offset) result.push({ ...stack[stack.length - 1], text: value.slice(offset, match.index) });
      const current = stack[stack.length - 1];
      if (match[4]) result.push({ ...current, text: match[5] ?? match[4], href: match[4] });
      else if (match[3]) {
        if (stack.length > 1 && current.tag === match[3]) stack.pop();
        else result.push({ ...current, text: match[0] });
      } else {
        const tag = match[1] ?? "color";
        stack.push({ ...current, tag, ...tag === "b" ? { bold: true } : tag === "i" ? { italic: true } : tag === "s" ? { strike: true } : { color: match[2] } });
      }
      offset = match.index + match[0].length;
    }
    if (offset < value.length) result.push({ ...stack[stack.length - 1], text: value.slice(offset) });
    return result;
  }
  function richMarkup(run) {
    let text = run.text;
    if (run.href) text = `[[${run.href} ${text}]]`;
    if (run.color) text = `<color:${run.color}>${text}</color>`;
    if (run.strike) text = `<s>${text}</s>`;
    if (run.italic) text = `<i>${text}</i>`;
    if (run.bold) text = `<b>${text}</b>`;
    return text;
  }
  function decorateText(root) {
    for (const element of Array.from(root.querySelectorAll("text, tspan"))) {
      if (element.children.length || element.hasAttribute("data-finch-rich")) continue;
      const runs = richRuns(element.textContent ?? "");
      if (!runs.some((r) => r.bold || r.italic || r.strike || r.color || r.href)) continue;
      element.textContent = "";
      element.setAttribute("data-finch-rich", "true");
      for (const run of runs) {
        const span = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
        span.setAttribute("data-finch-rich", "true");
        span.textContent = run.text;
        if (run.bold) span.setAttribute("font-weight", "700");
        if (run.italic) span.setAttribute("font-style", "italic");
        if (run.strike) span.setAttribute("text-decoration", "line-through");
        if (run.color) span.setAttribute("fill", run.color);
        if (run.href) {
          const link = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "a");
          link.setAttribute("href", run.href);
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          link.append(span);
          element.append(link);
        } else element.append(span);
      }
    }
  }

  // src/text-layout.ts
  var canvases = /* @__PURE__ */ new WeakMap();
  var defaultFont = 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  function graphemes(value) {
    const Segmenter = Intl.Segmenter;
    return Segmenter ? [...new Segmenter(void 0, { granularity: "grapheme" }).segment(value)].map((part) => part.segment) : [...value];
  }
  function textWidth(value, fontSize, fontFamily = defaultFont, weight = 560) {
    const runs = richRuns(value);
    if (runs.some((r) => r.bold || r.italic || r.strike || r.color || r.href)) return runs.reduce((sum, run) => sum + textWidth(run.text, fontSize, fontFamily, run.bold ? 700 : weight) * (run.italic ? 1.05 : 1), 0);
    const document = globalThis.document;
    if (document?.defaultView && "CanvasRenderingContext2D" in document.defaultView) {
      let context2 = canvases.get(document);
      if (!context2) {
        context2 = document.createElement("canvas").getContext("2d") ?? void 0;
        if (context2) canvases.set(document, context2);
      }
      if (context2) {
        context2.font = `${weight} ${fontSize}px ${fontFamily}`;
        return Math.ceil(context2.measureText(value).width);
      }
    }
    return Math.ceil(graphemes(value).reduce((width, character) => width + fontSize * (/[^\u0000-\u00ff]/.test(character) ? 1 : /[MW@#%]/.test(character) ? 0.95 : 0.62), 0));
  }
  function wrapWidth(attributes, fallback) {
    const requested = Number(attributes?.wrapWidth);
    return Number.isFinite(requested) && requested > 0 ? Math.max(24, requested) : fallback;
  }
  function wrappedLines(value, maximumWidth, measure) {
    const runs = richRuns(value.replace(/\\\\|\\r\\n|\\[nr]/g, (escape) => escape === "\\\\" ? "\\" : "\n"));
    if (runs.some((r) => r.bold || r.italic || r.strike || r.color || r.href)) {
      const plain = runs.map((r) => r.text).join("");
      const rows = wrappedLines(plain, maximumWidth, (text) => measure(text) * 1.12);
      let cursor = 0;
      return rows.map((row) => {
        let position = 0;
        const start = cursor, end = start + row.length;
        const markup = runs.map((run) => {
          const a = Math.max(start - position, 0), b = Math.min(end - position, run.text.length);
          position += run.text.length;
          return b > a ? richMarkup({ ...run, text: run.text.slice(a, b) }) : "";
        }).join("");
        cursor = end;
        if (plain[cursor] === "\n") cursor++;
        return markup;
      });
    }
    const lines = [];
    for (const paragraph of value.replace(/\\\\|\\r\\n|\\[nr]/g, (escape) => escape === "\\\\" ? "\\" : "\n").replace(/\r\n?/g, "\n").split("\n")) {
      const characters = graphemes(paragraph);
      if (!characters.length) {
        lines.push("");
        continue;
      }
      const paragraphLines = [];
      const offsets = [0];
      for (const character of characters) offsets.push(offsets[offsets.length - 1] + character.length);
      const Segmenter = Intl.Segmenter;
      const boundaries = /* @__PURE__ */ new Set();
      if (Segmenter) for (const part of new Segmenter(void 0, { granularity: "word" }).segment(paragraph)) {
        boundaries.add(part.index + part.segment.length);
      }
      const units = [...paragraph.matchAll(/[0-9０-９]+(?:[,.，．][0-9０-９]+)*(?:兆|億|万|千)?(?:円|件|人|日|月|年|台|個|時間|分|秒|%|％)?/gu)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
      const safeBreak = (index) => !/[（(「『【［｛〈《]$/u.test(characters[index - 1] ?? "") && !/^[、。，．！？!?）)」』】］｝〉》]/u.test(characters[index] ?? "") && !units.some((unit) => offsets[index] > unit.start && offsets[index] < unit.end);
      let start = 0;
      while (start < characters.length) {
        let end = start;
        let space = -1;
        while (end < characters.length && (end === start || measure(characters.slice(start, end + 1).join("")) <= maximumWidth)) {
          if (/\s/.test(characters[end])) space = end;
          end += 1;
        }
        if (end < characters.length) {
          if (space >= start) end = space + 1;
          else {
            const fits = Array.from({ length: end - start }, (_, i) => start + i + 1).filter(safeBreak);
            const preferred = fits.filter((index) => boundaries.has(offsets[index]) && measure(characters.slice(start, index).join("")) >= maximumWidth * 0.5);
            end = preferred[preferred.length - 1] ?? fits[fits.length - 1] ?? end;
          }
        }
        paragraphLines.push(characters.slice(start, end).join(""));
        start = end;
      }
      if (paragraphLines.length > 1 && measure(paragraphLines[paragraphLines.length - 1]) < maximumWidth * 0.25) {
        const last = paragraphLines.length - 1;
        const tail = graphemes(paragraphLines[last - 1] + paragraphLines[last]);
        const tailStart = characters.length - tail.length;
        const candidates = Array.from({ length: tail.length - 1 }, (_, i) => i + 1).filter((index) => safeBreak(tailStart + index)).map((index) => {
          const left = tail.slice(0, index).join("");
          const right = tail.slice(index).join("");
          return { left, right, leftWidth: measure(left), rightWidth: measure(right), word: boundaries.has(offsets[tailStart + index]) };
        }).filter((candidate) => candidate.leftWidth <= maximumWidth && candidate.rightWidth <= maximumWidth);
        candidates.sort((a, b) => Number(b.word) - Number(a.word) || Math.abs(a.leftWidth - a.rightWidth) - Math.abs(b.leftWidth - b.rightWidth));
        if (candidates[0]) paragraphLines.splice(last - 1, 2, candidates[0].left, candidates[0].right);
      }
      lines.push(...paragraphLines);
    }
    return lines;
  }
  function labelLayout(value, width, fontSize, fontFamily, weight = 560) {
    const measure = (text) => textWidth(text, fontSize, fontFamily, weight);
    const lines = wrappedLines(value, Math.max(fontSize, width), measure);
    const lineHeight = Math.ceil(fontSize * 1.4);
    return { lines, lineHeight, width: Math.max(0, ...lines.map(measure)), height: lines.length * lineHeight };
  }
  function nodeLabelLayout(label, attributes, theme, maximum = 216) {
    return labelLayout(label, wrapWidth(attributes, maximum), theme.fontSize, theme.fontFamily);
  }

  // src/diagram-text.ts
  function measureDiagramText(content, baseFontSize = 12, fontFamily) {
    const diagramText = { top: 0, bottom: 0, blocks: [] };
    for (const kind of ["header", "title", "legend", "footer"]) {
      const text = content?.[kind];
      if (!text) continue;
      const fontSize = baseFontSize + (kind === "title" ? 7 : 0);
      const measured = labelLayout(text, 264, fontSize, fontFamily, kind === "title" ? 700 : 400);
      const zone = kind === "footer" || kind === "legend" ? "bottom" : "top";
      diagramText.blocks.push({ kind, text, lines: measured.lines, lineHeight: measured.lineHeight, fontSize, y: diagramText[zone] + fontSize + (kind === "legend" ? 12 : 0) });
      diagramText[zone] += measured.height + (kind === "legend" ? 40 : 16);
    }
    return diagramText;
  }
  function withDiagramText(source, parse, includeTitle = true) {
    const descriptions = expandComponentBodies(source);
    if (descriptions !== void 0) return { ...parse(descriptions), source };
    const notes = expandBlockNotes(source);
    if (notes !== void 0) return { ...parse(notes), source };
    const visibility = expandClassVisibility(source);
    if (visibility !== void 0) return { ...parse(visibility), source };
    let depth = 0, found = false, literalBody = false;
    const content = {};
    let block;
    let body = [];
    const stripped = source.split(/\r?\n/).map((line) => {
      if (block) {
        if (line.trim() === `end ${block}`) {
          content[block] = body.join("\n");
          block = void 0;
          body = [];
        } else body.push(line.trim());
        return "";
      }
      if (literalBody) {
        if (line.trim() === "}") {
          literalBody = false;
          depth--;
        }
        return line;
      }
      const start = depth === 0 ? line.trim().match(/^(title|header|footer|legend)$/) : null;
      if (start && (includeTitle || start[1] !== "title")) {
        block = start[1];
        found = true;
        return "";
      }
      const match = depth === 0 ? line.trim().match(/^(title|header|footer|legend)\s+("(?:\\.|[^"\\])*")$/) : null;
      if (match && (includeTitle || match[1] !== "title")) {
        content[match[1]] = JSON.parse(match[2]);
        found = true;
        return "";
      }
      const code = line.replace(/"(?:\\.|[^"\\])*"/g, "").replace(/\s+(?:#|\/\/).*$/, "");
      if (/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(code)) literalBody = true;
      if (!/^\s*[#']/.test(code)) for (const char of code) {
        if (char === "{") depth++;
        else if (char === "}") depth--;
      }
      return line;
    }).join("\n");
    if (block) throw new Error(`Unclosed ${block} block; expected end ${block}.`);
    return found ? { ...parse(stripped), source, diagramText: content } : void 0;
  }

  // src/utils.ts
  var SVG_NS = "http://www.w3.org/2000/svg";
  function routeMidpoint(points) {
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
      const length = lengths[i];
      if (remaining <= length && length) {
        const a = points[i], b = points[i + 1];
        return { x: a.x + (b.x - a.x) * remaining / length, y: a.y + (b.y - a.y) * remaining / length };
      }
      remaining -= length;
    }
    return points[0] ?? { x: 0, y: 0 };
  }
  function svgElement(document, name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== void 0) element.setAttribute(key, String(value));
    }
    return element;
  }
  function center(bounds) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  function createOverlay(editable = true) {
    return { version: 1, editable, nodes: {} };
  }
  function parseOverlay(value) {
    if (!value) return createOverlay();
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      throw new Error("Unsupported Finch.js layout overlay.");
    }
    const overlay = parsed;
    return {
      version: 1,
      ...overlay.diagram ? { diagram: overlay.diagram } : {},
      ...typeof overlay.editable === "boolean" ? { editable: overlay.editable } : {},
      ...typeof overlay.frozen === "boolean" ? { frozen: overlay.frozen } : {},
      nodes: Object.fromEntries(Object.entries(overlay.nodes ?? {}).map(([id, node]) => [id, { ...node }]))
    };
  }
  function cloneOverlay(overlay) {
    return parseOverlay(overlay);
  }
  function pathFromPoints(points) {
    if (points.length === 0) return "";
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${round(point.x)} ${round(point.y)}`).join(" ");
  }
  function round(value) {
    return Math.round(value * 10) / 10;
  }
  function uniqueId(prefix, index) {
    return `${prefix}-${index + 1}`;
  }

  // src/timing.ts
  var hidden = (value) => value === "{-}" || value === "{hidden}";
  var uncertain = (value) => value.startsWith("{") && value.endsWith("}") && !hidden(value);
  var alternatives = (value) => uncertain(value) ? value.slice(1, -1).split(",").map((v) => v.trim()) : hidden(value) ? [] : [value];
  var statesOf = (samples) => [...new Set(samples.flatMap((s) => alternatives(s.value)))];
  var data = (node) => JSON.parse(node.attributes.samples ?? "[]");
  var number = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`Invalid timing number: ${value}`);
    return n;
  };
  var unquote = (text) => text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/\\"/g, '"') : text;
  var timestamp = (text) => {
    const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|([+-])(\d{2}):(\d{2})))?$/);
    if (!match) throw new Error(`Invalid timing date: ${text}`);
    const wall = match[1] + (match[2] ? "T" + match[2] : "");
    const local = Date.parse(wall + (match[2] ? "Z" : ""));
    if (!Number.isFinite(local) || !new Date(local).toISOString().startsWith(wall)) throw new Error(`Invalid timing date: ${text}`);
    const hours = Number(match[5] ?? 0), minutes = Number(match[6] ?? 0);
    if (hours > 23 || minutes > 59) throw new Error(`Invalid timing date offset: ${text}`);
    const offset = (hours * 60 + minutes) * 6e4 * (match[4] === "-" ? -1 : 1);
    return local - offset;
  };
  function parseTiming(source) {
    const decorated = withDiagramText(source, parseTiming);
    if (decorated) return decorated;
    const nodes = [], connections = [];
    const header2 = source.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !/^[#']/.test(line)) ?? "";
    const options = Object.fromEntries([...header2.matchAll(/(scale|end|unit|origin)=([^\s]+)/g)].map((m) => [m[1], m[2]]));
    const origin = options.origin === void 0 ? void 0 : timestamp(options.origin);
    const unitMillis = { ms: 1, s: 1e3, min: 6e4, h: 36e5, d: 864e5 }[options.unit ?? "ms"];
    if (origin !== void 0 && unitMillis === void 0) throw new Error("Date timing unit must be ms, s, min, h or d.");
    let time = 0;
    const anchors = /* @__PURE__ */ new Map();
    let participant;
    const resolveTime = (expression) => {
      if (/^\d{4}-\d{2}-\d{2}/.test(expression)) {
        if (origin === void 0) throw new Error("Date timing requires origin=ISO-date.");
        return (timestamp(expression) - origin) / unitMillis;
      }
      const anchor = expression.match(/^:([A-Za-z_]\w*)([+-]\d+(?:\.\d+)?)?$/);
      if (anchor) {
        const base = anchors.get(anchor[1]);
        if (base === void 0) throw new Error(`Unknown timing anchor ${anchor[1]}.`);
        return base + Number(anchor[2] ?? 0);
      }
      if (!/^[+-]?\d+(?:\.\d+)?$/.test(expression)) throw new Error(`Invalid timing expression: ${expression}`);
      return expression.startsWith("+") ? time + number(expression) : number(expression);
    };
    const times = [0];
    const lines = source.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("'") && !s.startsWith("#"));
    if (!/^@timing(?:\s|$)/.test(lines[0] ?? "")) throw new Error("Expected @timing directive.");
    for (let line of lines.slice(1)) {
      const declaration = line.match(/^(robust|concise|binary|analog|clock)\s+([\w.-]+)(?:\s+"([^"]*)")?(?:\s+\[([^\]]+)\])?$/);
      if (declaration) {
        if (nodes.some((n) => n.id === declaration[2])) throw new Error(`Duplicate timing participant ${declaration[2]}.`);
        const attrs = Object.fromEntries([...(declaration[4] ?? "").matchAll(/(period|pulse|offset)=([^\s]+)/g)].map((m) => [m[1], m[2]]));
        nodes.push({ id: declaration[2], label: declaration[3] ?? declaration[2], shape: "timing-track", attributes: { ...attrs, timingKind: declaration[1], samples: "[]" } });
        continue;
      }
      const select = line.match(/^@([\w.-]+)$/);
      if (select && nodes.some((n) => n.id === select[1])) {
        participant = select[1];
        continue;
      }
      const tick = line.match(/^@(\S+)(?:\s+as\s+:([A-Za-z_]\w*))?$/);
      if (tick) {
        time = resolveTime(tick[1]);
        times.push(time);
        if (tick[2]) {
          if (anchors.has(tick[2])) throw new Error(`Duplicate timing anchor ${tick[2]}.`);
          anchors.set(tick[2], time);
        }
        continue;
      }
      const timedSample = line.match(/^([+:\d-]\S*)\s+is\s+(.+)$/);
      if (timedSample && participant) {
        time = resolveTime(timedSample[1]);
        times.push(time);
        line = `${participant} is ${timedSample[2]}`;
      }
      const sample = line.match(/^([\w.-]+)\s+is\s+(.+)$/);
      if (sample) {
        const node = nodes.find((n) => n.id === sample[1]);
        if (!node) throw new Error(`Unknown timing participant ${sample[1]}.`);
        const value = unquote(sample[2]);
        if (node.attributes.timingKind === "clock") throw new Error("Clock values are generated from period/pulse/offset.");
        if (node.attributes.timingKind === "binary" && alternatives(value).some((v) => !["0", "1", "low", "high"].includes(v))) throw new Error(`Invalid binary value ${value}.`);
        if (node.attributes.timingKind === "analog" && !hidden(value)) alternatives(value).forEach(number);
        if (uncertain(value) && alternatives(value).some((v) => !v)) throw new Error("Empty timing state alternative.");
        const values = data(node);
        if (values.some((v) => v.time === time)) throw new Error(`Duplicate timing sample ${node.id} at ${time}.`);
        values.push({ time, value });
        node.attributes.samples = JSON.stringify(values);
        continue;
      }
      const duration = line.match(/^duration\s+([\w.-]+)\s+(\S+)\s+(\S+)\s+"([^"]+)"$/);
      if (duration) {
        const node = nodes.find((n) => n.id === duration[1]);
        if (!node) throw new Error(`Unknown duration participant ${duration[1]}.`);
        const from = resolveTime(duration[2]), to = resolveTime(duration[3]);
        if (to < from) throw new Error("Duration end must not precede start.");
        const values = JSON.parse(node.attributes.durations ?? "[]");
        values.push({ from, to, label: duration[4] });
        node.attributes.durations = JSON.stringify(values);
        times.push(from, to);
        continue;
      }
      const message = line.match(/^([\w.-]+)\s+->\s+([\w.-]+)(?:@([^\s]+))?\s*:\s*(.+)$/);
      if (message) {
        const end = message[3] ? resolveTime(message[3]) : time;
        if (end < time) throw new Error("A timing message cannot arrive before it is sent.");
        connections.push({ id: `timing-${connections.length}`, from: message[1], to: message[2], label: message[4], dashed: false, order: connections.length, attributes: { sent: String(time), received: String(end) } });
        times.push(end);
        continue;
      }
      throw new Error(`Invalid timing statement: ${line}`);
    }
    if (!nodes.length) throw new Error("A timing diagram needs participants.");
    const min = Math.min(...times), last = Math.max(...times);
    const max = options.end ? resolveTime(options.end) : last + Math.max(1, (last - min) * 0.1);
    const scale = options.scale ? number(options.scale) : 640 / Math.max(1, max - min);
    if (max <= min || max < last || scale <= 0) throw new Error("Invalid timing range or scale.");
    for (const node of nodes) {
      if (node.attributes.timingKind === "clock") {
        const period = number(node.attributes.period ?? "10"), pulse = number(node.attributes.pulse ?? String(period / 2)), offset = number(node.attributes.offset ?? "0");
        if (period <= 0 || pulse <= 0 || pulse >= period || (max - min) / period > 5e3) throw new Error("Invalid or excessive clock period/pulse.");
        const values = [];
        const phase = ((min - offset) % period + period) % period;
        values.push({ time: min, value: phase < pulse ? "high" : "low" });
        for (let t = offset + Math.floor((min - offset) / period) * period; t <= max; t += period) {
          if (t > min) values.push({ time: t, value: "high" });
          if (t + pulse > min && t + pulse <= max) values.push({ time: t + pulse, value: "low" });
        }
        node.attributes.samples = JSON.stringify(values);
      } else node.attributes.samples = JSON.stringify(data(node).sort((a, b) => a.time - b.time));
      node.attributes.timingMin = String(min);
      node.attributes.timingMax = String(max);
      node.attributes.timingScale = String(scale);
      node.attributes.timingUnit = options.unit ?? "";
      if (origin !== void 0) {
        node.attributes.timingOrigin = String(origin);
        node.attributes.timingUnitMillis = String(unitMillis);
      }
    }
    for (const edge of connections) if (!nodes.some((n) => n.id === edge.from) || !nodes.some((n) => n.id === edge.to)) throw new Error("Unknown timing message participant.");
    return { kind: "timing", nodes, connections, groups: [], source };
  }
  var sampleY = (samples, kind, value) => {
    if (hidden(value)) return 43;
    if (uncertain(value)) {
      const positions = alternatives(value).map((v) => sampleY(samples, kind, v));
      return (Math.min(...positions) + Math.max(...positions)) / 2;
    }
    if (kind === "concise") return 43;
    if (kind === "binary" || kind === "clock") return value === "1" || value === "high" ? 24 : 62;
    if (kind === "analog") {
      const values = samples.flatMap((s) => alternatives(s.value).map(Number)), lo = Math.min(...values), hi = Math.max(...values);
      return 28 + (1 - (Number(value) - lo) / (hi - lo || 1)) * 36;
    }
    return 26 + statesOf(samples).indexOf(value) * 26;
  };
  var yAt = (node, time) => {
    const samples = data(node), kind = node.attributes.timingKind;
    let index = -1;
    samples.forEach((s, i) => {
      if (s.time <= time) index = i;
    });
    const sample = samples[index];
    if (!sample) return node.y + 38;
    const next = samples[index + 1];
    const value = kind === "analog" && next && !hidden(next.value) && !uncertain(next.value) && !hidden(sample.value) && !uncertain(sample.value) ? String(Number(sample.value) + (Number(next.value) - Number(sample.value)) * (time - sample.time) / (next.time - sample.time)) : sample.value;
    return node.y + sampleY(samples, kind, value);
  };
  var xAt = (node, time) => node.x + 180 + (time - Number(node.attributes.timingMin)) * Number(node.attributes.timingScale);
  function rerouteTiming(geometry) {
    for (const node of geometry.nodes) node.x = 28;
    for (const edge of geometry.edges) {
      const from = geometry.nodes.find((n) => n.id === edge.from), to = geometry.nodes.find((n) => n.id === edge.to);
      edge.points = [{ x: xAt(from, Number(edge.attributes.sent)), y: yAt(from, Number(edge.attributes.sent)) }, { x: xAt(to, Number(edge.attributes.received)), y: yAt(to, Number(edge.attributes.received)) }];
    }
  }
  var timingLayout = { name: "timing", layout(model, context2) {
    let y = 28;
    const nodes = model.items.map((item) => {
      const saved = context2.overlay.nodes[item.id];
      const node = { ...item, ...item.size, x: 28, y: saved && (!context2.force || context2.preservePinned && saved.pinned) ? saved.y : y };
      y += item.size.height + 24;
      return node;
    });
    const geometry = { kind: "timing", nodes, edges: model.connections.map((edge) => ({ ...edge, points: [] })), groups: [], width: Math.max(...nodes.map((n) => n.width)) + 56, height: Math.max(...nodes.map((n) => n.y + n.height)) + 28 };
    rerouteTiming(geometry);
    return geometry;
  } };
  var timingShape = { name: "timing-track", measure({ attributes }) {
    const values = data({ attributes });
    const states = new Set(statesOf(values));
    return { width: 200 + (Number(attributes.timingMax) - Number(attributes.timingMin)) * Number(attributes.timingScale), height: Math.max(126, attributes.timingKind === "robust" ? states.size * 26 + 76 : 126) + (attributes.timingOrigin === void 0 ? 0 : 20) + JSON.parse(attributes.durations ?? "[]").length * 24 };
  }, render({ node, theme, document }) {
    const group = svgElement(document, "g", { transform: `translate(${node.x} ${node.y})` });
    const text = (label, x2, y, anchor = "start") => {
      const el = svgElement(document, "text", { x: x2, y, "text-anchor": anchor, fill: theme.labelColor, "font-size": 12, "font-family": theme.fontFamily });
      el.textContent = label;
      group.append(el);
    };
    const path = (d, stroke = theme.accentColor, dash) => group.append(svgElement(document, "path", { d, fill: "none", stroke, "stroke-width": 1.5, ...dash ? { "stroke-dasharray": dash } : {} }));
    const min = Number(node.attributes.timingMin), max = Number(node.attributes.timingMax), scale = Number(node.attributes.timingScale), x = (t) => 180 + (t - min) * scale;
    const samples = data(node), kind = node.attributes.timingKind;
    const states = statesOf(samples);
    const waveformHeight = kind === "robust" ? Math.max(36, states.length * 26) : 46;
    text(node.label, 8, 22);
    path(`M180 12 V${waveformHeight + 42}`, theme.nodeStroke);
    for (let i = 0; i <= 5; i++) {
      const t = min + (max - min) * i / 5;
      path(`M${x(t)} 12 V${waveformHeight + 42}`, theme.nodeStroke, "3 5");
      if (node.attributes.timingOrigin !== void 0) {
        const date = new Date(Number(node.attributes.timingOrigin) + t * Number(node.attributes.timingUnitMillis)).toISOString();
        text(date.slice(0, 10), x(t), waveformHeight + 60, "middle");
        text(date.slice(11, 19) + "Z", x(t), waveformHeight + 74, "middle");
      } else text(`${Number(t.toFixed(3))}${node.attributes.timingUnit}`, x(t), waveformHeight + 60, "middle");
    }
    const valueY = (value) => sampleY(samples, kind, value);
    if (kind === "binary" || kind === "clock") {
      text("1", 170, 28, "end");
      text("0", 170, 66, "end");
    }
    if (kind === "analog" && states.length) {
      const values = samples.flatMap((s) => alternatives(s.value).map(Number));
      text(String(Math.max(...values)), 170, 32, "end");
      text(String(Math.min(...values)), 170, 68, "end");
    }
    if (kind === "robust") states.forEach((state) => text(state, 170, valueY(state) + 4, "end"));
    samples.forEach((sample, index) => {
      const end = samples[index + 1]?.time ?? max;
      if (hidden(sample.value)) return;
      if (uncertain(sample.value)) {
        const positions = alternatives(sample.value).map(valueY), top = Math.min(...positions) - 4, bottom = Math.max(...positions) + 4;
        group.append(svgElement(document, "rect", { class: "finch-timing-uncertain", x: x(sample.time), y: top, width: Math.max(0, x(end) - x(sample.time)), height: bottom - top, fill: theme.accentColor, "fill-opacity": 0.15, stroke: theme.accentColor, "stroke-dasharray": "3 3" }));
        return;
      }
      if (kind === "concise") {
        group.append(svgElement(document, "rect", { x: x(sample.time), y: 28, width: Math.max(0, x(end) - x(sample.time)), height: 30, fill: theme.nodeFill, stroke: theme.nodeStroke }));
        if (x(end) - x(sample.time) > sample.value.length * 7) text(sample.value, (x(sample.time) + x(end)) / 2, 48, "middle");
      } else {
        const next = samples[index + 1];
        path(`M${x(sample.time)} ${valueY(sample.value)} L${x(end)} ${kind === "analog" && next && !hidden(next.value) && !uncertain(next.value) && !hidden(sample.value) && !uncertain(sample.value) ? valueY(next.value) : valueY(sample.value)}${kind !== "analog" && next && !hidden(next.value) && !uncertain(next.value) ? ` V${valueY(next.value)}` : ""}`);
      }
    });
    const durations = JSON.parse(node.attributes.durations ?? "[]");
    durations.forEach((d, index) => {
      const y = waveformHeight + 80 + (node.attributes.timingOrigin === void 0 ? 0 : 20) + index * 24;
      path(`M${x(d.from)} ${y - 5} V${y + 5} M${x(d.from)} ${y} H${x(d.to)} M${x(d.to)} ${y - 5} V${y + 5}`, theme.edgeColor);
      text(d.label, (x(d.from) + x(d.to)) / 2, y - 6, "middle");
    });
    return group;
  } };
  var timingDiagram = { name: "timing", defaultLayout: "timing", parse: parseTiming, toLayoutModel(model, context2) {
    return { kind: "timing", items: model.nodes.map((n) => ({ ...n, size: context2.measure(n.shape, n.label, n.attributes) })), connections: model.connections, groups: [], direction: "right", minimumGap: 24 };
  } };

  // src/state-transition-display.ts
  function groupStateTransitions(model) {
    if (model.kind !== "state") return;
    if (model.items.some((n) => n.attributes.annotationTarget)) return;
    const grouped = /* @__PURE__ */ new Map();
    const result = [];
    for (const e of model.connections) {
      if (e.from === e.to || !e.label) {
        result.push(e);
        continue;
      }
      const attributes = e.attributes ?? {};
      const visual = Object.entries(attributes).filter(([k]) => !["id", "trigger", "triggerKind", "guard", "effect"].includes(k)).sort(([a], [b]) => a.localeCompare(b));
      const key = JSON.stringify([e.from, e.to, e.dashed, visual]);
      const previous = grouped.get(key);
      if (previous) {
        previous.label += "\\n" + e.label;
        previous.attributes = { ...previous.attributes, groupedTransitionIds: JSON.stringify([...JSON.parse(previous.attributes.groupedTransitionIds), e.id]) };
      } else {
        const copy = { ...e, attributes: { ...attributes, groupedTransitionIds: JSON.stringify([e.id]) } };
        grouped.set(key, copy);
        result.push(copy);
      }
    }
    model.connections = result;
  }

  // src/routing-channels.ts
  function expandRoutingChannels(g, overlay, reroute) {
    if (g.kind !== "deployment" || overlay.frozen || Object.keys(overlay.nodes).length) return 0;
    let total = 0;
    const descendant = (n, id) => {
      let p = n.parentId;
      const seen = /* @__PURE__ */ new Set();
      while (p && !seen.has(p)) {
        if (p === id) return true;
        seen.add(p);
        p = g.nodes.find((n2) => n2.id === p)?.parentId;
      }
      return false;
    };
    const overlaps2 = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    for (let pass = 0; pass < 2; pass++) {
      let changed = false;
      const containers = g.nodes.filter((n) => n.shape === "container");
      for (const left of containers) {
        for (const right of containers) {
          if (left === right || left.parentId !== right.parentId) continue;
          const lo = left.x + left.width, hi = right.x, top = Math.max(left.y, right.y), bottom = Math.min(left.y + left.height, right.y + right.height);
          if (hi < lo || hi - lo >= 120 || bottom - top < 24) continue;
          const intervals = [];
          for (const e of g.edges) for (let i = 1; i < e.points.length; i++) {
            const a = e.points[i - 1], b = e.points[i];
            if (a.x !== b.x || a.x < lo || a.x > hi) continue;
            const start = Math.max(top, Math.min(a.y, b.y)), end = Math.min(bottom, Math.max(a.y, b.y));
            if (end - start >= 24) intervals.push({ id: e.id, a: start, b: end });
          }
          let count = 0;
          for (const interval of intervals) {
            const y = interval.a + 0.01;
            count = Math.max(count, new Set(intervals.filter((v) => v.a <= y && v.b > y).map((v) => v.id)).size);
          }
          if (count < 2) continue;
          const delta = Math.min(48, 96 - total, 36 + (count - 1) * 12 - (hi - lo));
          if (delta <= 0) continue;
          const before = g.nodes.map((n) => ({ x: n.x, y: n.y, width: n.width, height: n.height }));
          const roots = g.nodes.filter((n) => n.parentId === right.parentId && n.x >= right.x);
          for (const n of g.nodes) if (roots.some((r) => n.id === r.id || descendant(n, r.id))) n.x += delta;
          let parent = right.parentId;
          const seen = /* @__PURE__ */ new Set();
          while (parent && !seen.has(parent)) {
            seen.add(parent);
            const n = g.nodes.find((n2) => n2.id === parent);
            if (!n) break;
            n.width += delta;
            parent = n.parentId;
          }
          const collision = g.nodes.some((a, i) => g.nodes.slice(i + 1).some((b) => a.parentId === b.parentId && overlaps2(a, b) && !overlaps2({ ...a, ...before[i] }, { ...b, ...before[g.nodes.indexOf(b)] })));
          if (collision) {
            g.nodes.forEach((n, i) => Object.assign(n, before[i]));
            continue;
          }
          total += delta;
          reroute(g);
          changed = true;
          break;
        }
        if (changed) break;
      }
      if (!changed) break;
    }
    return total;
  }

  // src/sequence-pages.ts
  function participantAlive(node, page) {
    const events = JSON.parse(node.attributes.sequenceEvents ?? "[]");
    let alive = !events.some((event) => event.kind === "create");
    const frames = [];
    for (const event of events.filter((event2) => event2.serial < page.serial)) {
      if (event.kind === "branch-save") frames.push({ base: alive, ends: [] });
      if (event.kind === "branch-reset" || event.kind === "branch-end") {
        const frame = frames[frames.length - 1];
        if (frame) {
          frame.ends.push(alive);
          alive = event.kind === "branch-reset" ? frame.base : frame.ends.every(Boolean);
          if (event.kind === "branch-end") frames.pop();
        }
      }
      if (event.kind === "create") alive = event.at < page.start;
      if (event.kind === "destroy") alive = false;
    }
    return alive;
  }
  function sequencePageRanges(geometry, labelBounds = /* @__PURE__ */ new Map()) {
    if (geometry.kind !== "sequence") throw new Error("Sequence pages require a sequence diagram.");
    const edges = geometry.edges.filter((edge) => !edge.attributes?.annotation);
    const origin = geometry.origin?.y ?? 0;
    const bodyTop = Math.min(...geometry.groups.map((group) => group.y), ...edges.map((edge) => Math.min(...edge.points.map((p) => p.y)) - 24), origin + geometry.height);
    const bodyBottom = origin + geometry.height - (geometry.diagramText?.bottom ?? 0);
    const cut = (at) => {
      if (at === 0) return bodyTop;
      if (at >= edges.length) return bodyBottom;
      const before = Math.max(...edges[at - 1].points.map((p) => p.y));
      const after = Math.min(...edges[at].points.map((p) => p.y));
      return (before + after) / 2;
    };
    const starts = [{ at: 0, serial: 0 }, ...geometry.pageBreaks ?? []];
    return starts.map((start, index) => {
      const next = starts[index + 1];
      const relevant = edges.slice(start.at, next?.at ?? edges.length).flatMap((edge) => {
        const bounds = labelBounds.get(edge.id);
        return bounds ? [bounds] : [];
      });
      return {
        index,
        start: start.at,
        end: next?.at ?? edges.length,
        serial: start.serial,
        ..."title" in start && start.title !== void 0 ? { title: start.title } : {},
        top: Math.min(cut(start.at), ...relevant.map((bounds) => bounds.top - 8)),
        bottom: Math.max(next ? cut(next.at) : bodyBottom, ...relevant.map((bounds) => bounds.bottom + 8))
      };
    });
  }
  function sequencePageSvgs(source, geometry, theme) {
    const document = source.ownerDocument;
    const labelBounds = /* @__PURE__ */ new Map();
    for (const element of source.querySelectorAll(".finch-edge-label")) {
      const id = element.getAttribute("data-edge-id");
      if (!id) continue;
      const font = Number(element.getAttribute("font-size") ?? 12);
      const ys = [...element.querySelectorAll("tspan")].map((span) => Number(span.getAttribute("y")));
      if (!ys.length) ys.push(Number(element.getAttribute("y")));
      labelBounds.set(id, { top: Math.min(...ys) - font, bottom: Math.max(...ys) + font * 0.3 });
    }
    for (const element of source.querySelectorAll(".finch-sequence-fragments > [data-edge-id]")) {
      const rect = element.querySelector("rect");
      if (!rect) continue;
      const top = Number(rect.getAttribute("y")), height = Number(rect.getAttribute("height"));
      labelBounds.set(element.getAttribute("data-edge-id"), { top, bottom: top + height });
    }
    const pages = sequencePageRanges(geometry, labelBounds);
    return pages.map((page) => {
      const notes = geometry.nodes.filter((node) => node.attributes.annotationTarget && Number(node.attributes.sequencePage ?? 0) === page.index);
      const messages = geometry.edges.filter((edge) => !edge.attributes?.annotation);
      const references = new Map(notes.flatMap((note) => {
        const index = messages.findIndex((edge) => edge.id === note.attributes.annotationTarget);
        let label;
        if (index < 0) {
          const target = geometry.nodes.find((node) => node.id === note.attributes.annotationTarget);
          if (!target || participantAlive(target, page)) return [];
          label = `Participant: ${target.label}${target.label === target.id ? "" : ` (${target.id})`}`;
        } else {
          if (index >= page.start && index < page.end) return [];
          const target = messages[index];
          const owner = pages.find((candidate) => index >= candidate.start && index < candidate.end);
          label = `Page ${owner.index + 1} \xB7 ${target.from} \u2192 ${target.to}: ${target.label ?? target.id}`;
        }
        const lines2 = labelLayout(label, note.width, 12, theme.fontFamily, 400).lines;
        return [[note.id, { lines: lines2, height: lines2.length * 16 + 8 }]];
      }));
      const noteIds = new Set(notes.map((node) => node.id));
      const placedNotes = notes.map((note) => ({ ...note, y: page.start < page.end ? Math.max(note.y, page.top + 8 + (references.get(note.id)?.height ?? 0)) : note.y }));
      for (let index = 0; index < placedNotes.length; index++) {
        const note = placedNotes[index];
        for (const previous of placedNotes.slice(0, index)) if (note.x < previous.x + previous.width && note.x + note.width > previous.x && note.y - (references.get(note.id)?.height ?? 0) < previous.y + previous.height + 12) note.y = previous.y + previous.height + 12 + (references.get(note.id)?.height ?? 0);
      }
      if (page.start === page.end && notes.length) {
        page.top = Math.min(...placedNotes.map((node) => node.y - (references.get(node.id)?.height ?? 0))) - 8;
        page.bottom = Math.max(...placedNotes.map((node) => node.y + node.height)) + 8;
      }
      const width = geometry.width, left = geometry.origin?.x ?? 0;
      const pageText = (value) => value.replace(/%page%/g, String(page.index + 1)).replace(/%lastpage%/g, String(pages.length));
      const pageHeadings = measureDiagramText(Object.fromEntries((geometry.diagramText?.blocks ?? []).map((block) => [block.kind, pageText(block.text ?? block.lines.join("\n"))])), theme.fontSize - 1, theme.fontFamily);
      const title = pageText(page.title ?? pageHeadings.blocks.find((block) => block.kind === "title")?.text ?? "");
      const commonHeader = pageHeadings.blocks.find((block) => block.kind === "header");
      const commonHeaderHeight = commonHeader ? commonHeader.lines.length * commonHeader.lineHeight + 16 : 0;
      const bottomHeight = pageHeadings.bottom;
      const lines = labelLayout(title, Math.max(40, width - 48), 18, theme.fontFamily, 700).lines;
      const titleHeight = commonHeaderHeight + (title ? lines.length * 24 + 20 : 16);
      const nodeHeight = Math.max(0, ...geometry.nodes.filter((n) => !n.attributes.annotationTarget).map((n) => n.height));
      const continuations = geometry.groups.filter((group) => page.start < page.end && group.y < page.top && group.y + group.height > page.top).map((group) => {
        const branch = [...group.branches ?? []].reverse().find((branch2) => branch2.y <= page.top);
        const label = `${group.kind ?? "group"} \xB7 ${group.label}${branch ? ` / ${branch.label}` : ""} (continued)`;
        const lines2 = labelLayout(label, Math.max(40, group.width - 20), 12, theme.fontFamily, 400).lines;
        return { group, lines: lines2, height: lines2.length * 16 + 12 };
      });
      const headerHeight = titleHeight + nodeHeight + 24 + continuations.reduce((sum, item) => sum + item.height, 0);
      const clipHeight = page.start === page.end && !notes.length ? 0 : Math.max(1, page.bottom - page.top);
      const durationLabels = [...source.querySelectorAll(".finch-sequence-duration")].filter((duration) => clipHeight > 0 && Number(duration.getAttribute("data-end-y")) >= page.top && Number(duration.getAttribute("data-start-y")) <= page.bottom);
      const bodyHeight = Math.max(clipHeight, ...placedNotes.map((note) => note.y + note.height + 8 - page.top), ...durationLabels.map((duration) => (duration.querySelectorAll("text").length + 1) * 16 + 24));
      const height = headerHeight + bodyHeight + bottomHeight + 32;
      const svg = svgElement(document, "svg", { viewBox: `${left} 0 ${width} ${height}`, width, height, role: "img", "aria-label": title || `Page ${page.index + 1}` });
      svg.style.background = source.style.background;
      for (const element of source.querySelectorAll(":scope > defs, :scope > style")) svg.append(element.cloneNode(true));
      lines.forEach((line, index) => {
        const text = svgElement(document, "text", { x: left + width / 2, y: commonHeaderHeight + 24 + index * 24, "text-anchor": "middle", class: "finch-page-title", "font-size": 18, "font-weight": 700, "font-family": theme.fontFamily, fill: theme.labelColor });
        text.textContent = line;
        svg.append(text);
      });
      for (const block of pageHeadings.blocks) {
        if (block.kind === "title") continue;
        const original = source.querySelector(`.finch-diagram-${block.kind}`);
        if (!original) continue;
        const offset = block.kind === "header" ? 0 : headerHeight + bodyHeight;
        const y = offset + block.y;
        if (block.kind === "legend") {
          const originalFrame = source.querySelector(".finch-diagram-legend-frame");
          if (originalFrame) {
            const frame = originalFrame.cloneNode(true);
            frame.setAttribute("y", String(y - block.fontSize - 8));
            frame.setAttribute("height", String(block.lines.length * block.lineHeight + 20));
            svg.append(frame);
          }
        }
        const text = original.cloneNode(true);
        text.setAttribute("y", String(y));
        text.replaceChildren(...block.lines.map((line, index) => {
          const span = svgElement(document, "tspan", { x: Number(text.getAttribute("x")), y: y + index * block.lineHeight });
          span.textContent = line;
          return span;
        }));
        svg.append(text);
      }
      for (const node of geometry.nodes) {
        if (node.attributes.annotationTarget) continue;
        if (!participantAlive(node, page)) continue;
        const original = [...source.querySelectorAll(".finch-nodes > [data-node-id], .finch-created-header")].find((el) => el.getAttribute("data-node-id") === node.id);
        if (original) {
          const header2 = original.cloneNode(true);
          header2.setAttribute("transform", `translate(${node.x} ${titleHeight})`);
          svg.append(header2);
        }
      }
      {
        const headers = new Set([...svg.children].map((element) => element.getAttribute("data-node-id")).filter(Boolean));
        for (const note of placedNotes) {
          const target = geometry.nodes.find((node) => node.id === note.attributes.annotationTarget);
          if (!target || !headers.has(target.id)) continue;
          const fromX = target.x + target.width / 2, fromY = titleHeight + target.height;
          const left2 = note.x + note.width / 2 < fromX;
          const toX = left2 ? note.x + note.width : note.x, toY = headerHeight + note.y - page.top + note.height / 2;
          const approachX = toX + (left2 ? 12 : -12);
          const bendY = titleHeight + nodeHeight + 12;
          svg.append(svgElement(document, "path", { class: "finch-page-note-link", "data-from": target.id, "data-to": note.id, d: `M ${fromX} ${fromY} V ${bendY} H ${approachX} V ${toY} H ${toX}`, fill: "none", stroke: theme.mutedColor, "stroke-dasharray": "4 4" }));
        }
      }
      for (const note of placedNotes) {
        const reference = references.get(note.id);
        if (!reference) continue;
        reference.lines.forEach((line, index) => {
          const text = svgElement(document, "text", { class: "finch-page-note-reference", "data-note-id": note.id, x: note.x, y: headerHeight + note.y - page.top - reference.height + 12 + index * 16, fill: theme.mutedColor, "font-size": 12, "font-family": theme.fontFamily });
          text.textContent = line;
          svg.append(text);
        });
      }
      let continuationY = titleHeight + nodeHeight + 24;
      const frameStroke = theme.containerStroke;
      const frameText = theme.mutedColor;
      for (const item of continuations) {
        const group = svgElement(document, "g", { class: "finch-page-continuation", "data-group-id": item.group.id });
        group.append(svgElement(document, "rect", { x: item.group.x, y: continuationY, width: item.group.width, height: item.height, fill: "none", stroke: frameStroke, "stroke-dasharray": "5 4" }));
        item.lines.forEach((line, index) => {
          const text = svgElement(document, "text", { x: item.group.x + 10, y: continuationY + 16 + index * 16, "font-size": 12, "font-family": theme.fontFamily, fill: frameText });
          text.textContent = line;
          group.append(text);
        });
        svg.append(group);
        continuationY += item.height;
      }
      const body = source.cloneNode(true);
      for (const element of body.querySelectorAll("[data-finch-editor-trigger],.finch-diagram-text,defs,style")) element.remove();
      const allowed = new Set(geometry.edges.filter((edge) => !edge.attributes?.annotation).slice(page.start, page.end).map((edge) => edge.id));
      for (const edge of geometry.edges) if (edge.attributes?.annotation && noteIds.has(edge.to)) allowed.add(edge.id);
      for (const node of geometry.nodes.filter((node2) => node2.attributes.annotationTarget && !noteIds.has(node2.id))) for (const element of body.querySelectorAll("[data-node-id]")) if (element.getAttribute("data-node-id") === node.id) element.remove();
      if (page.start === page.end) {
        const keep = [...body.querySelectorAll(".finch-nodes > [data-node-id]")].filter((element) => noteIds.has(element.getAttribute("data-node-id")));
        for (const element of keep) {
          const note = placedNotes.find((note2) => note2.id === element.getAttribute("data-node-id"));
          element.setAttribute("transform", `translate(${note.x} ${note.y})`);
        }
        body.replaceChildren(...keep);
      }
      for (const element of body.querySelectorAll("[data-edge-id]")) if (!allowed.has(element.getAttribute("data-edge-id"))) element.remove();
      const noteLayer = svgElement(document, "svg", { class: "finch-page-notes", x: left, y: headerHeight, width, height: bodyHeight, viewBox: `${left} ${page.top} ${width} ${bodyHeight}` });
      if (page.start < page.end) {
        for (const note of placedNotes) {
          const original = [...body.querySelectorAll(".finch-nodes > [data-node-id]")].find((element) => element.getAttribute("data-node-id") === note.id);
          if (original) {
            original.setAttribute("transform", `translate(${note.x} ${note.y})`);
            noteLayer.append(original);
          }
          const link = geometry.edges.find((edge) => edge.attributes?.annotation && edge.to === note.id);
          if (link) {
            for (const element of body.querySelectorAll("[data-edge-id]")) if (element.getAttribute("data-edge-id") === link.id) element.remove();
            if (allowed.has(note.attributes.annotationTarget)) {
              const point = link.points[0];
              noteLayer.prepend(svgElement(document, "path", { class: "finch-page-note-link", "data-from": note.attributes.annotationTarget, "data-to": note.id, d: `M ${point.x} ${point.y} L ${note.x + (note.attributes.annotationSide === "left" ? note.width : 0)} ${note.y + note.height / 2}`, fill: "none", stroke: theme.mutedColor, "stroke-dasharray": "4 4" }));
            }
          }
        }
      }
      const durationLayer = svgElement(document, "svg", { x: left, y: headerHeight, width, height: bodyHeight, viewBox: `${left} ${page.top} ${width} ${bodyHeight}` });
      durationLayer.style.overflow = "hidden";
      for (const duration of body.querySelectorAll(".finch-sequence-duration")) {
        const start = Number(duration.getAttribute("data-start-y")), end = Number(duration.getAttribute("data-end-y"));
        if (bodyHeight === 0 || end < page.top || start > page.bottom) {
          duration.remove();
          continue;
        }
        const continuedBefore = start < page.top, continuedAfter = end > page.bottom;
        const paths = svgElement(document, "svg", { x: left, y: page.top, width, height: clipHeight, viewBox: `${left} ${page.top} ${width} ${clipHeight}` });
        paths.style.overflow = "hidden";
        for (const path of duration.querySelectorAll("path")) paths.append(path);
        duration.prepend(paths);
        durationLayer.append(duration);
        const continued = continuedBefore || continuedAfter;
        duration.setAttribute("data-continued-before", String(continuedBefore));
        duration.setAttribute("data-continued-after", String(continuedAfter));
        const texts = [...duration.querySelectorAll("text")];
        const desired = (Math.max(start, page.top) + Math.min(end, page.bottom)) / 2;
        const intervals = texts.length - 1 + Number(continued);
        const half = intervals * 8;
        const middle = Math.max(page.top + half + 16, Math.min(page.top + bodyHeight - half - 4, desired));
        texts.forEach((text, index) => text.setAttribute("y", String(middle + (index - intervals / 2) * 16)));
        const last = texts[texts.length - 1];
        if (last && continued) {
          const hint = last.cloneNode(false);
          hint.setAttribute("y", String(middle + intervals / 2 * 16));
          hint.textContent = "(continued)";
          duration.append(hint);
        }
      }
      body.removeAttribute("xmlns");
      body.setAttribute("x", String(left));
      body.setAttribute("y", String(headerHeight));
      body.setAttribute("width", String(width));
      body.setAttribute("height", String(clipHeight));
      body.setAttribute("viewBox", `${left} ${page.top} ${width} ${clipHeight}`);
      body.style.aspectRatio = "";
      body.style.overflow = "hidden";
      svg.append(body);
      if (noteLayer.childElementCount) svg.append(noteLayer);
      if (durationLayer.childElementCount) svg.append(durationLayer);
      const number2 = svgElement(document, "text", { x: left + width / 2, y: height - 10, "text-anchor": "middle", class: "finch-page-number", "font-size": 12, "font-family": theme.fontFamily, fill: theme.mutedColor });
      number2.textContent = `${page.index + 1} / ${pages.length}`;
      svg.append(number2);
      return new XMLSerializer().serializeToString(svg);
    });
  }

  // src/source-builtins.ts
  function sourceBuiltin(name, args, values) {
    const arities = { json_set: [3, 3], json_remove: [2, 2], json_encode: [1, 1], json_at: [2, 2], json_get: [2, 2], json_has: [2, 2], json_keys: [1, 1], json_size: [1, 1], json_type: [1, 1], upper: [1, 1], lower: [1, 1], trim: [1, 1], strlen: [1, 1], substr: [2, 3], strpos: [2, 2], replace: [3, 3], concat: [1, 100], string: [1, 1], number: [1, 1], exists: [1, 1], abs: [1, 1], floor: [1, 1], ceil: [1, 1], round: [1, 1], min: [1, 100], max: [1, 100] };
    const arity = Object.prototype.hasOwnProperty.call(arities, name) ? arities[name] : void 0;
    if (!arity) throw new Error(`Unknown source function "${name}".`);
    if (args.length < arity[0] || args.length > arity[1] || args.some((arg) => arg === void 0 || typeof arg === "number" && !Number.isFinite(arg))) throw new Error(`Invalid arguments for ${name}.`);
    const text = (index) => String(args[index]);
    const numeric = (index) => {
      const value = Number(args[index]);
      if (text(index).trim() === "" || !Number.isFinite(value)) throw new Error(`${name} requires finite numbers.`);
      return value;
    };
    if (name.startsWith("json_")) {
      if (name === "json_encode") return JSON.stringify(args[0]);
      const parse = (input) => {
        try {
          return JSON.parse(input, (_key, value2) => {
            if (typeof value2 === "number" && !Number.isFinite(value2)) throw new Error("Nonfinite number");
            return value2;
          });
        } catch {
          throw new Error(`${name} requires valid finite JSON.`);
        }
      };
      const data2 = parse(text(0));
      if (name === "json_type") return data2 === null ? "null" : Array.isArray(data2) ? "array" : typeof data2;
      if (data2 === null || typeof data2 !== "object") throw new Error(`${name} requires a JSON object or array.`);
      if (name === "json_size") return Array.isArray(data2) ? data2.length : Object.keys(data2).length;
      if (name === "json_keys") return JSON.stringify(Object.keys(data2));
      const key = text(1);
      if (Array.isArray(data2) && !/^(0|[1-9]\d*)$/.test(key)) throw new Error("JSON array indices must be nonnegative integers.");
      const found = Object.prototype.hasOwnProperty.call(data2, key);
      if (name === "json_has") return found;
      if (name === "json_set") {
        const value2 = parse(text(2));
        if (Array.isArray(data2)) {
          const index = Number(key);
          if (!Number.isSafeInteger(index) || index > data2.length) throw new Error("JSON array update cannot create gaps.");
          data2[index] = value2;
        } else Object.defineProperty(data2, key, { value: value2, enumerable: true, writable: true, configurable: true });
        return JSON.stringify(data2);
      }
      if (!found) throw new Error(`Unknown JSON key "${key}".`);
      if (name === "json_remove") {
        if (Array.isArray(data2)) data2.splice(Number(key), 1);
        else delete data2[key];
        return JSON.stringify(data2);
      }
      const value = data2[key];
      if (name === "json_at") return JSON.stringify(value);
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error("JSON value must be finite.");
      return value !== null && ["string", "number", "boolean"].includes(typeof value) ? value : JSON.stringify(value);
    }
    switch (name) {
      case "upper":
        return text(0).toUpperCase();
      case "lower":
        return text(0).toLowerCase();
      case "trim":
        return text(0).trim();
      case "strlen":
        return Array.from(text(0)).length;
      case "string":
        return text(0);
      case "number":
        return numeric(0);
      case "exists":
        return values.has(text(0));
      case "concat":
        return args.map(String).join("");
      case "substr": {
        const start = numeric(1), length = args.length === 3 ? numeric(2) : void 0;
        if (!Number.isSafeInteger(start) || start < 0 || length !== void 0 && (!Number.isSafeInteger(length) || length < 0)) throw new Error("substr requires nonnegative integer offsets.");
        return Array.from(text(0)).slice(start, length === void 0 ? void 0 : start + length).join("");
      }
      case "strpos": {
        const position = text(0).indexOf(text(1));
        return position < 0 ? -1 : Array.from(text(0).slice(0, position)).length;
      }
      case "replace": {
        if (text(1) === "") throw new Error("replace requires a nonempty search string.");
        return text(0).split(text(1)).join(text(2));
      }
      case "abs":
        return Math.abs(numeric(0));
      case "floor":
        return Math.floor(numeric(0));
      case "ceil":
        return Math.ceil(numeric(0));
      case "round":
        return Math.round(numeric(0));
      case "min":
        return Math.min(...args.map((_, index) => numeric(index)));
      case "max":
        return Math.max(...args.map((_, index) => numeric(index)));
    }
    throw new Error(`Unknown source function "${name}".`);
  }

  // src/source-blocks.ts
  function validateSourceBlocks(source) {
    const stack = [];
    const closing = { endif: "if", endfor: "foreach", endwhile: "while", endprocedure: "procedure", endfunction: "function" };
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      const directive = line.trim().match(/^!(if|foreach|while|procedure|function|else|elseif|endif|endfor|endwhile|endprocedure|endfunction)(?:\s|$)/)?.[1];
      if (!directive) continue;
      if (["if", "foreach", "while", "procedure", "function"].includes(directive)) {
        stack.push({ kind: directive, line: index + 1, otherwise: false });
        continue;
      }
      const frame2 = stack[stack.length - 1];
      if (directive === "else" || directive === "elseif") {
        if (frame2?.kind !== "if" || frame2.otherwise) throw new Error(`Unexpected !${directive} at source line ${index + 1}.`);
        if (directive === "else") frame2.otherwise = true;
        continue;
      }
      if (frame2?.kind !== closing[directive]) throw new Error(`Mismatched !${directive} at source line ${index + 1}.`);
      stack.pop();
    }
    const frame = stack[stack.length - 1];
    if (frame) throw new Error(`Unclosed !${frame.kind} at source line ${frame.line}.`);
  }

  // src/source-condition.ts
  var truth = (value) => value !== void 0 && !["", "false", "0"].includes(String(value));
  function sourceExpression(expression, values, evaluate = true, invoke) {
    const tokens = [];
    let remaining = expression.trim();
    while (remaining) {
      const token = remaining.match(/^("(?:\\.|[^"\\])*"|&&|\|\||==|!=|<=|>=|[!,()<>+*/%\-]|(?:0|[1-9]\d*)(?:\.\d+)?|[A-Za-z_]\w*)/);
      if (!token) throw new Error(`Invalid source condition: ${expression}`);
      tokens.push(token[0]);
      remaining = remaining.slice(token[0].length).trimStart();
    }
    const numeric = (value) => {
      if (value === void 0 || String(value).trim() === "" || !Number.isFinite(Number(value))) throw new Error("Source arithmetic requires finite numbers.");
      return Number(value);
    };
    let index = 0;
    const atom = (enabled) => {
      const token = tokens[index++];
      if (token === "!") return !truth(atom(enabled));
      if (token === "-" || token === "+") {
        const value = atom(enabled);
        return enabled ? numeric(value) * (token === "-" ? -1 : 1) : 0;
      }
      if (token === "(") {
        const value = or(enabled);
        if (tokens[index++] !== ")") throw new Error("Unclosed condition parentheses.");
        return value;
      }
      if (token?.startsWith('"')) return JSON.parse(token);
      if (token === "true" || token === "false") return token === "true";
      if (token !== void 0 && /^-?\d/.test(token)) return enabled ? numeric(token) : 0;
      if (token !== void 0 && /^[A-Za-z_]\w*$/.test(token)) {
        if (tokens[index] !== "(") return values.get(token);
        index++;
        const args = [];
        if (tokens[index] !== ")") for (; ; ) {
          args.push(or(enabled));
          if (tokens[index] !== ",") break;
          index++;
        }
        if (tokens[index++] !== ")") throw new Error("Unclosed source function call.");
        if (!enabled) return void 0;
        if (!invoke) throw new Error(`Unknown source function "${token}".`);
        return invoke(token, args);
      }
      throw new Error("Expected source condition value.");
    };
    const product = (enabled) => {
      let value = atom(enabled);
      while (["*", "/", "%"].includes(tokens[index] ?? "")) {
        const operator = tokens[index++];
        const right = atom(enabled);
        if (!enabled) {
          value = 0;
          continue;
        }
        const a = numeric(value), b = numeric(right);
        if (operator !== "*" && b === 0) throw new Error("Division by zero in source expression.");
        value = operator === "*" ? a * b : operator === "/" ? a / b : a % b;
        numeric(value);
      }
      return value;
    };
    const sum = (enabled) => {
      let value = product(enabled);
      while (["+", "-"].includes(tokens[index] ?? "")) {
        const operator = tokens[index++];
        const right = product(enabled);
        value = enabled ? numeric(value) + (operator === "+" ? 1 : -1) * numeric(right) : 0;
        if (enabled) numeric(value);
      }
      return value;
    };
    const compare = (enabled) => {
      const left = sum(enabled), operator = tokens[index];
      if (!operator || !["==", "!=", "<", ">", "<=", ">="].includes(operator)) return left;
      index++;
      const right = sum(enabled);
      if (!enabled) return false;
      if (operator === "==") return left === void 0 || right === void 0 ? left === right : String(left) === String(right);
      if (operator === "!=") return left === void 0 || right === void 0 ? left !== right : String(left) !== String(right);
      const a = numeric(left), b = numeric(right);
      return operator === "<" ? a < b : operator === ">" ? a > b : operator === "<=" ? a <= b : a >= b;
    };
    const and = (enabled) => {
      let value = compare(enabled);
      while (tokens[index] === "&&") {
        index++;
        const next = compare(enabled && truth(value));
        value = truth(value) && truth(next);
      }
      return value;
    };
    const or = (enabled) => {
      let value = and(enabled);
      while (tokens[index] === "||") {
        index++;
        const next = and(enabled && !truth(value));
        value = truth(value) || truth(next);
      }
      return value;
    };
    const result = or(evaluate);
    if (index !== tokens.length) throw new Error("Unexpected source condition token.");
    return result;
  }
  function sourceCondition(expression, values, evaluate = true, invoke) {
    return truth(sourceExpression(expression, values, evaluate, invoke));
  }

  // src/preprocess.ts
  function preprocess(source, options = {}) {
    const values = new Map(Object.entries(options.definitions ?? {}).map(([k, v]) => [k, String(v)]));
    const procedures = /* @__PURE__ */ new Map();
    let calls = 0;
    const callKinds = [];
    const includedNames = /* @__PURE__ */ new Set();
    class Returned {
      constructor(value) {
        this.value = value;
      }
    }
    let loops = 0;
    let count = 0;
    const substitute = (text) => text.replace(/\{\{([A-Za-z_]\w*)\}\}/g, (_, name) => {
      if (!values.has(name)) throw new Error(`Undefined source variable "${name}".`);
      return values.get(name);
    });
    const invoke = (name, args, stack) => {
      const fn = procedures.get(name);
      if (!fn) return sourceBuiltin(name, args, values);
      if (!fn.returns) throw new Error(`Unknown source function "${name}".`);
      if (args.length > fn.params.length || fn.params.slice(args.length).some((p) => p.defaultValue === void 0) || args.some((arg) => arg === void 0 || typeof arg === "number" && !Number.isFinite(arg))) throw new Error("Invalid function arguments.");
      if (calls >= 32) throw new Error("Function nesting exceeds 32 levels.");
      const saved = new Map(values);
      calls++;
      callKinds.push(true);
      try {
        fn.params.forEach((param, i) => values.set(param.name, args[i] === void 0 ? substitute(param.defaultValue) : String(args[i])));
        try {
          expand(fn.body, stack);
        } catch (error) {
          if (error instanceof Returned) return error.value;
          throw error;
        }
        throw new Error(`Function "${name}" finished without !return.`);
      } finally {
        calls--;
        callKinds.pop();
        values.clear();
        for (const [key, value] of saved) values.set(key, value);
      }
    };
    const expand = (input, stack) => {
      validateSourceBlocks(input);
      if (stack.length > 32) throw new Error("Include nesting exceeds 32 levels.");
      const evaluate = (expression, enabled2 = true) => sourceExpression(expression, values, enabled2, (name, args) => invoke(name, args, stack));
      const testCondition = (expression, enabled2 = true) => sourceCondition(expression, values, enabled2, (name, args) => invoke(name, args, stack));
      const frames = [];
      let enabled = true;
      const result = [];
      const lines = input.split(/\r?\n/);
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (++count > 1e5) throw new Error("Expanded source exceeds 100000 lines.");
        const procedure = line.trim().match(/^!(?:procedure|function)\s+([A-Za-z_]\w*)\s*\((.*)\)$/);
        if (procedure) {
          const returns = line.trim().startsWith("!function");
          const body = [];
          let closed = false;
          while (++index < lines.length) {
            const text = lines[index];
            if (text.trim() === (returns ? "!endfunction" : "!endprocedure")) {
              closed = true;
              break;
            }
            if (/^\s*!(?:procedure|function)\b/.test(text)) throw new Error("Nested procedure definitions are not supported.");
            body.push(text);
          }
          if (!closed) throw new Error(`Unclosed procedure "${procedure[1]}".`);
          if (enabled) {
            if (calls) throw new Error("Procedure definitions inside calls are not supported.");
            const params = [];
            let remaining = procedure[2].trim();
            let optional = false;
            while (remaining) {
              const parameter = remaining.match(/^([A-Za-z_]\w*)\s*(?:=\s*("(?:\\.|[^"\\])*"|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?))?\s*(,|$)/);
              if (!parameter || params.some((p) => p.name === parameter[1]) || optional && parameter[2] === void 0) throw new Error("Invalid procedure parameters.");
              const value = parameter[2] === void 0 ? void 0 : JSON.parse(parameter[2]);
              if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid procedure default.");
              params.push({ name: parameter[1], ...value === void 0 ? {} : { defaultValue: String(value) } });
              optional || (optional = value !== void 0);
              remaining = remaining.slice(parameter[0].length).trim();
              if (parameter[3] === "," && !remaining) throw new Error("Invalid procedure parameters.");
            }
            if (procedures.has(procedure[1])) throw new Error(`Duplicate procedure "${procedure[1]}".`);
            procedures.set(procedure[1], { params, body: body.join("\n"), returns });
          }
          continue;
        }
        const loop = line.trim().match(/^!(foreach|while)\s+(.+)$/);
        if (loop) {
          const body = [];
          const closing = [loop[1] === "foreach" ? "!endfor" : "!endwhile"];
          while (++index < lines.length) {
            const text = lines[index], trimmed = text.trim();
            if (/^!(?:procedure|function)\b/.test(trimmed)) throw new Error("Procedure definitions inside loops are not supported.");
            if (/^!foreach\s/.test(trimmed)) closing.push("!endfor");
            else if (/^!while\s/.test(trimmed)) closing.push("!endwhile");
            else if (trimmed === "!endfor" || trimmed === "!endwhile") {
              if (closing.pop() !== trimmed) throw new Error("Mismatched source loop terminator.");
              if (!closing.length) break;
            }
            body.push(text);
          }
          if (closing.length) throw new Error(`Unclosed !${loop[1]}.`);
          if (!enabled) continue;
          if (loops >= 32) throw new Error("Source loop nesting exceeds 32 levels.");
          const sourceBody = body.join("\n");
          const run = () => {
            const expanded = expand(sourceBody, stack);
            if (expanded) result.push(expanded);
          };
          loops++;
          try {
            if (loop[1] === "while") {
              let iterations = 0;
              while (testCondition(loop[2])) {
                if (++iterations > 1e4) throw new Error("Source loop exceeds 10000 iterations.");
                run();
              }
            } else {
              const each = loop[2].match(/^([A-Za-z_]\w*)\s+in\s+(.+)$/);
              if (!each) throw new Error("Expected !foreach NAME in JSON-array.");
              const list = each[2].trim();
              let items;
              const listValue = list.startsWith("[") ? list : evaluate(list);
              if (typeof listValue !== "string") throw new Error("Foreach requires a JSON array.");
              try {
                items = JSON.parse(listValue);
              } catch {
                throw new Error("Foreach requires a JSON array.");
              }
              if (!Array.isArray(items)) throw new Error("Foreach requires a JSON array.");
              if (items.length > 1e4) throw new Error("Source loop exceeds 10000 iterations.");
              const encode = (item) => {
                if (typeof item === "string") return substitute(item);
                return JSON.stringify(item, (_key, value) => {
                  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Foreach requires finite JSON numbers.");
                  return typeof value === "string" ? substitute(value) : value;
                });
              };
              const actual = items.map(encode);
              const name = each[1], previous = values.get(name);
              try {
                for (const item of actual) {
                  values.set(name, item);
                  run();
                }
              } finally {
                if (previous === void 0) values.delete(name);
                else values.set(name, previous);
              }
            }
          } finally {
            loops--;
          }
          continue;
        }
        const conditional = line.trim().match(/^!if\s+(.+)$/);
        if (conditional) {
          const condition = testCondition(conditional[1], enabled);
          frames.push({ parent: enabled, condition, otherwise: false });
          enabled = enabled && condition;
          continue;
        }
        const elseif = line.trim().match(/^!elseif\s+(.+)$/);
        if (elseif) {
          const frame = frames[frames.length - 1];
          if (!frame || frame.otherwise) throw new Error("Unexpected !elseif.");
          const condition = testCondition(elseif[1], frame.parent && !frame.condition);
          enabled = frame.parent && !frame.condition && condition;
          frame.condition || (frame.condition = condition);
          continue;
        }
        if (line.trim() === "!else") {
          const frame = frames[frames.length - 1];
          if (!frame || frame.otherwise) throw new Error("Unexpected !else.");
          frame.otherwise = true;
          enabled = frame.parent && !frame.condition;
          continue;
        }
        if (line.trim() === "!endif") {
          const frame = frames.pop();
          if (!frame) throw new Error("Unexpected !endif.");
          enabled = frame.parent;
          continue;
        }
        if (!enabled) continue;
        const returned = line.trim().match(/^!return\s+(.+)$/);
        if (returned) {
          if (callKinds[callKinds.length - 1] !== true) throw new Error("!return requires a function.");
          const value = evaluate(returned[1]);
          if (value === void 0 || typeof value === "number" && !Number.isFinite(value)) throw new Error("Invalid function return value.");
          throw new Returned(value);
        }
        const call = line.trim().match(/^!call\s+([A-Za-z_]\w*)\s*\((.*)\)$/);
        if (call) {
          const procedure2 = procedures.get(call[1]);
          if (!procedure2 || procedure2.returns) throw new Error(`Unknown procedure "${call[1]}".`);
          let args;
          try {
            args = JSON.parse(`[${call[2]}]`);
          } catch {
            throw new Error("Procedure arguments must be JSON strings, numbers or booleans.");
          }
          if (args.length > procedure2.params.length || procedure2.params.slice(args.length).some((p) => p.defaultValue === void 0) || args.some((arg) => !["string", "number", "boolean"].includes(typeof arg) || typeof arg === "number" && !Number.isFinite(arg))) throw new Error("Invalid procedure arguments.");
          const actual = args.map((arg) => substitute(String(arg)));
          if (calls >= 32) throw new Error("Procedure nesting exceeds 32 levels.");
          const saved = new Map(values);
          calls++;
          callKinds.push(false);
          try {
            procedure2.params.forEach((param, i) => values.set(param.name, actual[i] ?? substitute(param.defaultValue)));
            const expanded = expand(procedure2.body, stack);
            if (expanded) result.push(expanded);
          } finally {
            calls--;
            callKinds.pop();
            values.clear();
            for (const [key, value] of saved) values.set(key, value);
          }
          continue;
        }
        const assertion = line.trim().match(/^!assert\s+(.+)$/);
        if (assertion) {
          const parts2 = assertion[1].match(/^((?:"(?:\\.|[^"\\])*"|[^":])+?)(?:\s*:\s*("(?:\\.|[^"\\])*"))?$/);
          if (!parts2) throw new Error('Expected !assert expression : "message".');
          if (!testCondition(parts2[1])) {
            const message = parts2[2] ? substitute(JSON.parse(parts2[2])) : parts2[1].trim();
            const resource = stack[stack.length - 1];
            throw new Error(`Source assertion failed${resource ? ` in "${resource}"` : ""}: ${message}`);
          }
          continue;
        }
        const assignment = line.trim().match(/^!let\s+([A-Za-z_]\w*)\s*=\s*(.+)$/);
        if (assignment) {
          const value = evaluate(assignment[2]);
          if (value === void 0) throw new Error("Cannot assign an undefined source variable.");
          values.set(assignment[1], String(value));
          continue;
        }
        const define = line.trim().match(/^!define\s+([A-Za-z_]\w*)(?:\s+(.*))?$/);
        if (define) {
          values.set(define[1], substitute(define[2] ?? "true"));
          continue;
        }
        const undef = line.trim().match(/^!undef\s+([A-Za-z_]\w*)$/);
        if (undef) {
          values.delete(undef[1]);
          continue;
        }
        const include = line.trim().match(/^!(include|include_once)\s+"([^"\n]+)"$/);
        if (include) {
          const name = substitute(include[2]);
          if (include[1] === "include_once" && includedNames.has(name)) continue;
          if (stack.includes(name)) throw new Error(`Circular include: ${[...stack, name].join(" -> ")}`);
          const text = Object.prototype.hasOwnProperty.call(options.includes ?? {}, name) ? options.includes[name] : options.resolveInclude?.(name, stack[stack.length - 1]);
          if (text === void 0) throw new Error(`Unknown include "${name}".`);
          includedNames.add(name);
          const included = expand(text, [...stack, name]);
          if (included) result.push(included);
          continue;
        }
        if (/^\s*!/.test(line)) throw new Error(`Unknown source directive: ${line.trim()}`);
        if (callKinds.includes(true) && line.trim() && !/^[#']/.test(line.trim())) throw new Error("Functions cannot emit diagram source.");
        result.push(substitute(line));
      }
      if (frames.length) throw new Error("Unclosed !if.");
      return result.join("\n");
    };
    return expand(source, []);
  }
  function snapshotPreprocess(source, options) {
    const snapshot = { includes: { ...options.includes }, definitions: { ...options.definitions }, resources: [] };
    const expanded = preprocess(source, { ...options, resolveInclude: (name, from) => {
      const cached = snapshot.resources.find((resource) => resource.name === name && resource.from === from);
      if (cached) return cached.source;
      const text = options.resolveInclude?.(name, from);
      if (text !== void 0) snapshot.resources.push({ name, ...from === void 0 ? {} : { from }, source: text });
      return text;
    } });
    return { source: expanded, snapshot };
  }
  function restorePreprocess(snapshot) {
    return { includes: snapshot.includes, definitions: snapshot.definitions, resolveInclude: (name, from) => snapshot.resources.find((resource) => resource.name === name && resource.from === from)?.source };
  }

  // src/member-annotations.ts
  function annotationAnchor(node, index) {
    const x = node.x + node.width;
    if (index === void 0) return { x, y: node.y + node.height / 2 };
    const members = JSON.parse(node.attributes.members ?? "[]");
    const hidden2 = JSON.parse(node.attributes.hiddenMembers ?? "[]");
    const visible = members.map((member, i) => ({ ...member, index: i })).filter((m) => !hidden2.includes(m.index));
    if (node.attributes.customCompartments === "true") {
      const header3 = node.height - 12 - visible.length * 23;
      return { x, y: node.y + header3 + 15 + visible.findIndex((m) => m.index === Number(index)) * 23 };
    }
    const attributes = visible.filter((m) => m.kind !== "operation"), operations = visible.filter((m) => m.kind === "operation");
    const rows = Math.max((node.attributes.hideEmptyFields ?? node.attributes.hideEmptyMembers) === "true" ? 0 : 1, attributes.length);
    const operationRows = Math.max((node.attributes.hideEmptyOperations ?? node.attributes.hideEmptyMembers ?? "true") === "true" ? 0 : 1, operations.length);
    const header2 = node.height - 12 - (rows + operationRows) * 23;
    const attribute = attributes.findIndex((m) => m.index === Number(index));
    const operation = operations.findIndex((m) => m.index === Number(index));
    const offset = attribute >= 0 ? header2 + 15 + attribute * 23 : header2 + rows * 23 + 16 + operation * 23;
    return { x, y: node.y + offset };
  }

  // src/architecture-layout.ts
  function arrangeArchitecture(children, nodes, model, move) {
    const groups = children.filter((n) => n.shape === "container");
    if (groups.length !== 3) return false;
    const block = (id) => {
      let n = nodes.find((n2) => n2.id === id);
      const seen = /* @__PURE__ */ new Set();
      while (n && !seen.has(n.id)) {
        if (children.includes(n)) return n.id;
        seen.add(n.id);
        n = nodes.find((p) => p.id === n.parentId);
      }
      return void 0;
    };
    const links = model.connections.map((e) => ({ from: block(e.from), to: block(e.to) })).filter((e) => e.from && e.to && e.from !== e.to);
    const count = (a, b) => links.filter((e) => e.from === a && e.to === b).length;
    const candidates = groups.flatMap((a) => groups.filter((b) => b !== a).map((b) => {
      const c = groups.find((c2) => c2 !== a && c2 !== b);
      return { a, b, c, score: 2 * count(a.id, b.id) + count(a.id, c.id) + count(b.id, c.id) - 2 * count(b.id, a.id) - 2 * count(c.id, a.id) - count(c.id, b.id) };
    })).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best.score <= 0) return false;
    const originX = Math.min(...children.map((n) => n.x)), originY = Math.min(...children.map((n) => n.y)), gap = 72;
    const support = children.filter((n) => n.shape !== "container");
    const ordered = [];
    while (ordered.length < support.length) {
      const remaining = support.filter((n) => !ordered.includes(n));
      const last = ordered[ordered.length - 1];
      remaining.sort((a, b) => last ? count(last.id, b.id) + count(b.id, last.id) - (count(last.id, a.id) + count(a.id, last.id)) : links.filter((e) => e.to === b.id).length - links.filter((e) => e.to === a.id).length);
      ordered.push(remaining[0]);
    }
    let y = originY;
    for (const n of ordered) {
      move(n.id, originX, y);
      y += n.height + 40;
    }
    const entryX = originX + (support.length ? Math.max(...support.map((n) => n.width)) + gap : 0);
    move(best.a.id, entryX, originY);
    const branchX = entryX + best.a.width + gap;
    move(best.b.id, branchX, originY);
    move(best.c.id, branchX, originY + best.b.height + gap);
    return true;
  }

  // src/semantic-arrangement.ts
  function arrangeSharedBlocks(blocks, model, branch, move, orient) {
    if (blocks.length < 4 || blocks.length > 6 || blocks.some((n) => n.attributes.layout || n.attributes.order || n.attributes.row || n.attributes.column || n.attributes.place) || model.connections.some((e) => e.attributes?.layoutDirection)) return false;
    const links = model.connections.map((e) => ({ ...e, from: branch(e.from), to: branch(e.to) })).filter((e) => e.from && e.to && e.from !== e.to);
    const candidates = blocks.filter((n) => model.kind === "class" ? !links.some((e) => e.from === n.id) && new Set(links.filter((e) => e.to === n.id).map((e) => e.from)).size >= 3 : model.kind === "deployment" && new Set(links.filter((e) => e.to === n.id && e.dashed).map((e) => e.from)).size >= 2);
    if (candidates.length !== 1) return false;
    const shared = candidates[0], remaining = blocks.filter((n) => n !== shared), chain = [];
    const edges = links.filter((e) => e.from !== shared.id && e.to !== shared.id);
    while (chain.length < remaining.length) {
      const rest = remaining.filter((n) => !chain.includes(n));
      const sources = rest.filter((n) => !edges.some((e) => e.to === n.id && rest.some((r) => r.id === e.from)));
      if (sources.length === 1) {
        chain.push(sources[0]);
        continue;
      }
      if (model.kind !== "deployment") return false;
      const net = (n) => edges.filter((e) => e.from === n.id && rest.some((r) => r.id === e.to)).length - edges.filter((e) => e.to === n.id && rest.some((r) => r.id === e.from)).length;
      const sorted = rest.sort((a, b) => net(b) - net(a));
      if (sorted.length > 1 && net(sorted[0]) === net(sorted[1])) return false;
      chain.push(sorted[0]);
    }
    if (chain.slice(1).some((n, i) => !edges.some((e) => e.from === chain[i].id && e.to === n.id))) return false;
    const gap = 100;
    if (model.kind === "class") {
      orient(shared.id, "row");
      orient(chain[chain.length - 1].id, "row");
      let y = 28;
      for (const n of chain) {
        move(n.id, 28, y);
        y += n.height + gap;
      }
      move(shared.id, 28 + Math.max(...chain.map((n) => n.width)) + gap, chain[Math.floor(chain.length / 2)].y);
      if (chain.length >= 3) move(chain[0].id, (28 + shared.x) / 2, chain[0].y);
    } else {
      for (const n of chain) orient(n.id, "column");
      orient(shared.id, "row");
      let x = 28;
      for (const n of chain) {
        move(n.id, x, 28);
        x += n.width + gap;
      }
      move(shared.id, Math.max(28, (x - gap + 28 - shared.width) / 2), 28 + Math.max(...chain.map((n) => n.height)) + gap);
    }
    return true;
  }
  function arrangeThreeBlocks(blocks, model, branch, move) {
    if (blocks.length !== 3 || blocks.some((n) => n.attributes.layout || n.attributes.order || n.attributes.row || n.attributes.column || n.attributes.place)) return false;
    if (model.connections.some((e) => e.attributes?.layoutDirection)) return false;
    const links = model.connections.map((e) => ({ from: branch(e.from), to: branch(e.to) })).filter((e) => e.from && e.to && e.from !== e.to);
    if (!blocks.every((a) => blocks.filter((b) => a !== b).every((b) => links.some((e) => e.from === a.id && e.to === b.id || e.to === a.id && e.from === b.id)))) return false;
    const net = (n) => links.filter((e) => e.to === n.id).length - links.filter((e) => e.from === n.id).length;
    const x = 28, y = 28, gap = 100;
    if (model.kind === "class") {
      const sources = blocks.filter((n) => !links.some((e) => e.to === n.id));
      if (sources.length !== 1) return false;
      const a = sources[0], rest = blocks.filter((n) => n !== a);
      const b = [...rest].sort((a2, b2) => net(a2) - net(b2))[0], c = rest.find((n) => n !== b);
      move(a.id, x, y);
      move(b.id, x + a.width + gap, y);
      move(c.id, Math.max(x, x + (a.width + gap + b.width - c.width) / 2), y + Math.max(a.height, b.height) + gap);
    } else if (model.kind === "deployment") {
      const sorted = [...blocks].sort((a2, b2) => net(b2) - net(a2));
      if (net(sorted[0]) <= 0 || net(sorted[0]) === net(sorted[1])) return false;
      const sink = sorted[0], rest = blocks.filter((n) => n !== sink).sort((a2, b2) => net(a2) - net(b2));
      const a = rest[0], b = rest[1];
      move(a.id, x, y);
      move(b.id, x, y + a.height + gap);
      move(sink.id, x + Math.max(a.width, b.width) + gap, Math.max(y, y + (a.height + gap + b.height - sink.height) / 2));
    } else return false;
    return true;
  }
  function arrangeStateAxis(nodes, model) {
    if (model.kind !== "state" || model.direction !== "down" || nodes.some((n) => !["initial-state", "final-state", "uml-state", "rounded"].includes(n.shape))) return;
    if (model.connections.some((e) => e.attributes?.main || e.attributes?.layoutDirection)) return;
    const starts = nodes.filter((n) => n.shape === "initial-state"), ends = nodes.filter((n) => n.shape === "final-state");
    if (starts.length !== 1 || ends.length !== 1) return;
    const start = starts[0].id, end = ends[0].id, queue = [start];
    const distance = /* @__PURE__ */ new Map([[start, 0]]), ways = /* @__PURE__ */ new Map([[start, 1]]), previous = /* @__PURE__ */ new Map();
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index], nextDistance = distance.get(id) + 1;
      for (const to of new Set(model.connections.filter((e) => e.from === id).map((e) => e.to))) {
        if (!distance.has(to)) {
          distance.set(to, nextDistance);
          ways.set(to, ways.get(id));
          previous.set(to, id);
          queue.push(to);
        } else if (distance.get(to) === nextDistance) ways.set(to, Math.min(2, ways.get(to) + ways.get(id)));
      }
    }
    if (ways.get(end) !== 1) return;
    const axis = [end];
    while (axis[0] !== start) axis.unshift(previous.get(axis[0]));
    const side = nodes.filter((n) => !axis.includes(n.id));
    if (!side.length || side.length > 4 || side.some((n) => model.connections.some((e) => e.from === n.id && !axis.includes(e.to) && e.to !== n.id || e.to === n.id && !axis.includes(e.from) && e.from !== n.id))) return;
    const width = Math.max(...nodes.map((n) => n.width)), gap = 100, cx = 28 + width * 1.5 + gap;
    let y = 28;
    for (const id of axis) {
      const n = nodes.find((n2) => n2.id === id);
      n.x = cx - n.width / 2;
      n.y = y;
      y += n.height + 90;
    }
    const bottoms = [28, 28];
    side.forEach((n, index) => {
      const attached = nodes.filter((a) => axis.includes(a.id) && model.connections.some((e) => e.from === n.id && e.to === a.id || e.to === n.id && e.from === a.id));
      const lane = index % 2;
      n.x = lane === 0 ? cx + width / 2 + gap : 28;
      n.y = Math.max(bottoms[lane], attached.length ? attached.reduce((s, a) => s + a.y, 0) / attached.length : 28);
      bottoms[lane] = n.y + n.height + 70;
    });
  }
  function arrangeStateCycles(nodes, model) {
    if (model.kind !== "state" || model.direction !== "down" || nodes.length > 30 || nodes.some((n) => !["initial-state", "final-state", "rounded", "uml-state"].includes(n.shape)) || model.connections.some((e) => e.attributes?.main || e.attributes?.layoutDirection)) return;
    const successors = (id) => [...new Set(model.connections.filter((e) => e.from === id && e.to !== id).map((e) => e.to))];
    const reach = (id) => {
      const seen = /* @__PURE__ */ new Set(), todo = [id];
      while (todo.length) {
        const next = todo.pop();
        if (seen.has(next)) continue;
        seen.add(next);
        todo.push(...successors(next));
      }
      return seen;
    };
    const reachable = new Map(nodes.map((n) => [n.id, reach(n.id)]));
    const clusters = [];
    const used = /* @__PURE__ */ new Set();
    for (const n of nodes) {
      if (used.has(n.id)) continue;
      const group = nodes.filter((m) => reachable.get(n.id).has(m.id) && reachable.get(m.id).has(n.id));
      group.forEach((m) => used.add(m.id));
      if (group.length > 1) clusters.push(group);
    }
    if (clusters.length !== 1 || clusters[0].length < 3 || clusters[0].length > 6) return;
    const core = clusters[0], ids = new Set(core.map((n) => n.id));
    const before = nodes.filter((n) => !ids.has(n.id) && core.some((c) => reachable.get(n.id).has(c.id)));
    const after = nodes.filter((n) => !ids.has(n.id) && core.some((c) => reachable.get(c.id).has(n.id)));
    if (before.length + after.length + core.length !== nodes.length || !before.some((n) => n.shape === "initial-state") || !after.some((n) => n.shape === "final-state")) return;
    const linear = (list) => list.every((n) => successors(n.id).filter((id) => list.some((m) => m.id === id)).length <= 1 && model.connections.filter((e) => e.to === n.id && list.some((m) => m.id === e.from)).length <= 1);
    if (!linear(before) || !linear(after)) return;
    const ordered = (list) => [...list].sort((a, b) => reachable.get(a.id).has(b.id) ? -1 : reachable.get(b.id).has(a.id) ? 1 : 0);
    const exits = core.filter((n) => successors(n.id).some((id) => after.some((a) => a.id === id)));
    if (exits.length < 2) return;
    const width = Math.max(...nodes.map((n) => n.width)), gap = 110, cx = 28 + width + gap;
    let y = 28;
    for (const n of ordered(before)) {
      n.x = cx + (width - n.width) / 2;
      n.y = y;
      y += n.height + 80;
    }
    const coreTop = y;
    for (const n of exits) {
      n.x = cx + (width - n.width) / 2;
      n.y = y;
      y += n.height + 90;
    }
    let sideY = coreTop;
    for (const n of core.filter((n2) => !exits.includes(n2))) {
      n.x = 28;
      n.y = sideY;
      sideY += n.height + 90;
    }
    y = coreTop;
    for (const n of ordered(after)) {
      n.x = cx + width + gap + 50 + (width - n.width) / 2;
      n.y = y;
      y += n.height + 90;
    }
  }

  // src/crossing-quality.ts
  function crossingPoint(a, b, c, d) {
    if (a.x === b.x && a.y === b.y || c.x === d.x && c.y === d.y) return void 0;
    if (a.y === b.y && c.x === d.x && c.x > Math.min(a.x, b.x) && c.x < Math.max(a.x, b.x) && a.y > Math.min(c.y, d.y) && a.y < Math.max(c.y, d.y)) return { x: c.x, y: a.y };
    if (a.x === b.x && c.y === d.y) return crossingPoint(c, d, a, b);
    return void 0;
  }
  function existingCrossings(routes) {
    const found = /* @__PURE__ */ new Map();
    for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++)
      for (let a = 1; a < routes[i].length; a++) for (let b = 1; b < routes[j].length; b++) {
        const p = crossingPoint(routes[i][a - 1], routes[i][a], routes[j][b - 1], routes[j][b]);
        if (p) found.set(`${p.x},${p.y}`, p);
      }
    return [...found.values()];
  }
  function crossingRisk(a, b, routes, occupied, endpoints, clearance) {
    let risk = 0;
    for (const route of routes) for (let i = 1; i < route.length; i++) {
      const p = crossingPoint(a, b, route[i - 1], route[i]);
      if (!p) continue;
      const distance = Math.min(...[...route, ...occupied, ...endpoints].map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
      if (distance < clearance) risk += 1 - distance / clearance;
    }
    return risk;
  }

  // src/routing-policy.ts
  function routingPolicy(attributes = {}) {
    const mode = attributes.routing ?? "balanced";
    if (mode !== "balanced" && mode !== "avoid-crossings") throw new Error(`Unknown routing policy: ${mode}`);
    const value = (key, fallback) => {
      if (attributes[key] === void 0) return fallback;
      const parsed = Number(attributes[key]);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1e4) throw new Error(`${key} must be greater than 0 and at most 10000`);
      return parsed;
    };
    return { mode, crossing: value("crossingCost", 120), bend: value("bendCost", 48), length: value("lengthCost", 1), crossingClearance: value("crossingClearance", 18) };
  }
  function compareRoutingCost(a, b, p) {
    const risk = (a.crossingRisk ?? 0) - (b.crossingRisk ?? 0);
    if (Math.abs(risk) > 1e-3) return risk;
    const congestion = a.branchCongestion + a.congestion - (b.branchCongestion + b.congestion);
    if (Math.abs(congestion) > 1e-3) return congestion;
    if (p.mode === "avoid-crossings" && a.crossings !== b.crossings) return a.crossings - b.crossings;
    const score = (c) => c.crossings * p.crossing + c.bends * p.bend + c.length * p.length;
    return score(a) - score(b) || a.crossings - b.crossings || a.bends - b.bends || a.length - b.length;
  }

  // src/interface-geometry.ts
  function interfaceOpening(node) {
    const value = node.attributes.opening ?? node.attributes.interfaceOpening;
    return value === "left" || value === "right" || value === "top" ? value : "bottom";
  }
  function requiredInterfacePath(node) {
    const x = node.width / 2, y = 22, r = 18;
    switch (interfaceOpening(node)) {
      case "right":
        return `M ${x} ${y + r} A ${r} ${r} 0 0 1 ${x} ${y - r}`;
      case "left":
        return `M ${x} ${y - r} A ${r} ${r} 0 0 1 ${x} ${y + r}`;
      case "top":
        return `M ${x + r} ${y} A ${r} ${r} 0 0 1 ${x - r} ${y}`;
      default:
        return `M ${x - r} ${y} A ${r} ${r} 0 0 1 ${x + r} ${y}`;
    }
  }
  function requiredInterfacePort(node, side) {
    const opening = interfaceOpening(node);
    const anchor = side === opening ? side === "top" || side === "bottom" ? "right" : "top" : side;
    return {
      x: node.x + node.width / 2 + (anchor === "left" ? -18 : anchor === "right" ? 18 : 0),
      y: node.y + 22 + (anchor === "top" ? -18 : anchor === "bottom" ? 18 : 0)
    };
  }

  // src/sequence-fragments.ts
  function sequenceFragmentSpan(nodes, kind) {
    const left = nodes.length ? Math.min(...nodes.map((node) => node.x)) : 0;
    const right = nodes.length ? Math.max(...nodes.map((node) => node.x + node.width)) : 100;
    const width = Math.max(right - left, kind === "note" ? 160 : 0);
    return { x: (left + right - width) / 2, width };
  }

  // src/directed-layout.ts
  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }
  function orderedLayers(model, ranks2) {
    const layers = [...new Set(ranks2.values())].sort((a, b) => a - b).map((rank) => model.items.filter((item) => item.shape !== "container" && ranks2.get(item.id) === rank).sort((a, b) => Number(a.attributes.order ?? Number.MAX_SAFE_INTEGER) - Number(b.attributes.order ?? Number.MAX_SAFE_INTEGER))).filter((layer) => layer.length);
    const edges = model.connections.filter((edge) => (ranks2.get(edge.from) ?? Infinity) < (ranks2.get(edge.to) ?? -Infinity));
    const positions = () => new Map(layers.flatMap((layer) => layer.map((item, index) => [item.id, index])));
    const score = () => {
      const index = positions();
      let crossings = 0;
      for (let i = 0; i < edges.length; i += 1) {
        const first = edges[i];
        for (const second of edges.slice(i + 1)) {
          if (ranks2.get(first.from) !== ranks2.get(second.from) || ranks2.get(first.to) !== ranks2.get(second.to)) continue;
          if ((index.get(first.from) - index.get(second.from)) * (index.get(first.to) - index.get(second.to)) < 0) crossings += 1;
        }
      }
      return crossings;
    };
    for (let sweep = 0; sweep < 4; sweep += 1) {
      const forward = sweep % 2 === 0;
      for (const layer of forward ? layers : [...layers].reverse()) {
        if (layer.length < 2 || layer.some((item) => item.attributes.order !== void 0)) continue;
        const index = positions();
        const before = [...layer];
        const beforeScore = score();
        for (const parent of new Set(layer.map((item) => item.parentId))) {
          const slots = layer.flatMap((item, i) => item.parentId === parent ? [i] : []);
          const values = new Map(slots.map((i) => {
            const item = layer[i];
            const neighbors = edges.filter((edge) => forward ? edge.to === item.id : edge.from === item.id).map((edge) => index.get(forward ? edge.from : edge.to)).filter((value) => value !== void 0);
            return [item.id, neighbors.length ? median(neighbors) : index.get(item.id)];
          }));
          const sorted = slots.map((i) => layer[i]).sort((a, b) => values.get(a.id) - values.get(b.id));
          slots.forEach((slot, i) => {
            layer[slot] = sorted[i];
          });
        }
        if (score() > beforeScore) layer.splice(0, layer.length, ...before);
      }
    }
    return layers;
  }
  function mainPath(model, ranks2) {
    if (model.kind !== "flowchart" && model.kind !== "activity") return /* @__PURE__ */ new Set();
    const forward = model.connections.filter((edge) => (ranks2.get(edge.from) ?? Infinity) < (ranks2.get(edge.to) ?? -Infinity));
    const items = new Map(model.items.map((item) => [item.id, item]));
    const remaining = /* @__PURE__ */ new Map();
    for (const item of [...model.items].sort((a, b) => (ranks2.get(b.id) ?? 0) - (ranks2.get(a.id) ?? 0))) {
      remaining.set(item.id, 1 + Math.max(0, ...forward.filter((edge) => edge.from === item.id).map((edge) => remaining.get(edge.to) ?? 0)));
    }
    const roots = model.items.filter((item) => ranks2.get(item.id) === 0);
    let current = roots.find((item) => item.attributes.main === "true") ?? [...roots].sort((a, b) => remaining.get(b.id) - remaining.get(a.id))[0];
    const path = /* @__PURE__ */ new Set();
    while (current && !path.has(current.id)) {
      path.add(current.id);
      const outgoing = forward.filter((edge) => edge.from === current.id);
      const preference = (edge) => (items.get(edge.to)?.attributes.main === "true" ? 1e3 : 0) + (/^(yes|true|ok|success|low risk|はい|成功|正常)$/i.test(edge.label?.trim() ?? "") ? 100 : 0) + (edge.dashed ? 0 : 10);
      outgoing.sort((a, b) => preference(b) - preference(a) || (remaining.get(b.to) ?? 0) - (remaining.get(a.to) ?? 0) || a.order - b.order);
      current = items.get(outgoing[0]?.to ?? "");
    }
    return path;
  }
  function alignLayers(nodes, layers, model, gap, horizontal = false) {
    const map = new Map(nodes.map((node) => [node.id, node]));
    const rank = new Map(layers.flatMap((layer, i) => layer.map((item) => [item.id, i])));
    const spine = mainPath(model, rank);
    const coordinate2 = (node) => horizontal ? node.y + node.height / 2 : node.x + node.width / 2;
    const size = (node) => horizontal ? node.height : node.width;
    const axis = Math.max(28, ...nodes.filter((node) => spine.has(node.id)).map(coordinate2));
    for (let sweep = 0; sweep < 4; sweep += 1) {
      for (const items of sweep % 2 ? [...layers].reverse() : layers) {
        const layer = items.map((item) => map.get(item.id)).filter((node) => Boolean(node));
        if (!layer.length) continue;
        const offsets = [];
        layer.forEach((node, i) => {
          offsets[i] = i ? offsets[i - 1] + size(layer[i - 1]) / 2 + gap + size(node) / 2 : 0;
        });
        const desired = layer.map((node, i) => {
          const neighbors = model.connections.flatMap((edge) => {
            if ((rank.get(edge.from) ?? Infinity) >= (rank.get(edge.to) ?? -Infinity)) return [];
            const id = edge.from === node.id ? edge.to : edge.to === node.id ? edge.from : void 0;
            const neighbor = id ? map.get(id) : void 0;
            return neighbor ? [coordinate2(neighbor)] : [];
          });
          return (neighbors.length ? median(neighbors) : coordinate2(node)) - offsets[i];
        });
        const blocks = [];
        desired.forEach((value, i) => {
          blocks.push({ start: i, end: i, sum: value, count: 1 });
          while (blocks.length > 1) {
            const right = blocks[blocks.length - 1];
            const left = blocks[blocks.length - 2];
            if (left.sum / left.count <= right.sum / right.count) break;
            blocks.splice(-2, 2, { start: left.start, end: right.end, sum: left.sum + right.sum, count: left.count + right.count });
          }
        });
        const anchor = layer.findIndex((node) => spine.has(node.id));
        const anchorValue = axis - (offsets[anchor] ?? 0);
        for (const block of blocks) {
          for (let i = block.start; i <= block.end; i += 1) {
            let value = block.sum / block.count;
            if (anchor >= 0) value = i < anchor ? Math.min(value, anchorValue) : i > anchor ? Math.max(value, anchorValue) : anchorValue;
            const node = layer[i];
            const position = value + offsets[i] - size(node) / 2;
            if (horizontal) node.y = position;
            else node.x = position;
          }
        }
        if (spine.size > 1 && anchor < 0 && !horizontal) {
          const spineRanks = [...spine].map((id) => rank.get(id));
          const layerRank = rank.get(layer[0].id);
          if (layerRank > Math.min(...spineRanks) && layerRank < Math.max(...spineRanks)) {
            const split = layer.filter((node) => coordinate2(node) <= axis).length;
            let boundary = axis - gap / 2;
            for (let i = split - 1; i >= 0; i -= 1) {
              const node = layer[i];
              node.x = Math.min(node.x, boundary - node.width);
              boundary = node.x - gap;
            }
            boundary = axis + gap / 2;
            for (let i = split; i < layer.length; i += 1) {
              const node = layer[i];
              node.x = Math.max(node.x, boundary);
              boundary = node.x + node.width + gap;
            }
          }
        }
      }
    }
    const minimum = Math.min(...nodes.filter((node) => node.shape !== "container").map((node) => horizontal ? node.y : node.x));
    if (minimum < 28) for (const node of nodes) {
      if (horizontal) node.y += 28 - minimum;
      else node.x += 28 - minimum;
    }
  }

  // src/layouts.ts
  function sequenceDurationWidth(edges) {
    return edges.reduce((sum, edge) => sum + JSON.parse(edge.attributes?.durations ?? "[]").length * 160, 0);
  }
  var CANVAS_PADDING = 28;
  function connectionGap(model, sourceIds, minimum) {
    return Math.max(minimum, ...model.connections.filter((edge) => sourceIds.has(edge.from) && !sourceIds.has(edge.to) && edge.label).map((edge) => labelLayout(edge.label, wrapWidth(edge.attributes, 180), model.labelFontSize ?? 12).width + 32));
  }
  function byId(values) {
    return new Map(values.map((value) => [value.id, value]));
  }
  function applyContinuity(nodes, context2) {
    const previous = byId(context2.previous?.nodes ?? []);
    for (const node of nodes) {
      const state = context2.overlay.nodes[node.id];
      if (state && (!context2.force || context2.preservePinned && state.pinned)) {
        node.x = state.x;
        node.y = state.y;
        if (state.width) node.width = Math.max(state.width, node.width);
        if (state.height) node.height = Math.max(state.height, node.height);
        continue;
      }
      const old = previous.get(node.id);
      if (!context2.force && old) {
        node.x = old.x;
        node.y = old.y;
      }
    }
  }
  function ranks(model) {
    const items = model.items.filter((item) => item.shape !== "container");
    const itemIds = new Set(items.map((item) => item.id));
    const result = new Map(items.map((item) => [item.id, 0]));
    const adjacency = new Map(items.map((item) => [item.id, /* @__PURE__ */ new Set()]));
    const acceptedEdges = [];
    const reaches = (start, goal) => {
      const pending = [start];
      const visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === goal) return true;
        visited.add(current);
        pending.push(...adjacency.get(current) ?? []);
      }
      return false;
    };
    for (const edge of model.connections) {
      if (!itemIds.has(edge.from) || !itemIds.has(edge.to) || edge.from === edge.to) continue;
      if (reaches(edge.to, edge.from)) continue;
      adjacency.get(edge.from)?.add(edge.to);
      acceptedEdges.push(edge);
    }
    for (let iteration = 0; iteration < items.length; iteration += 1) {
      let changed = false;
      for (const edge of acceptedEdges) {
        const next = Math.min(items.length - 1, (result.get(edge.from) ?? 0) + 1);
        if (next > (result.get(edge.to) ?? 0)) {
          result.set(edge.to, next);
          changed = true;
        }
      }
      if (!changed) break;
    }
    return result;
  }
  function arrangeDeployment(model) {
    const rankById = ranks(model);
    const normal = model.items.filter((item) => item.shape !== "container");
    const itemMap = byId(model.items);
    const columns = /* @__PURE__ */ new Map();
    const layers = orderedLayers(model, rankById);
    for (const item of layers.flat()) {
      const rank = rankById.get(item.id) ?? 0;
      const column = columns.get(rank) ?? [];
      column.push(item);
      columns.set(rank, column);
    }
    const columnWidths = /* @__PURE__ */ new Map();
    for (const [rank, items] of columns) columnWidths.set(rank, Math.max(...items.map((item) => item.size.width)));
    const orderedRanks = [...columns.keys()].sort((a, b) => a - b);
    const bandFor = (item) => {
      let parentId = item.parentId;
      let topLevel = "__root";
      let guard = 0;
      while (parentId && guard < model.items.length) {
        topLevel = parentId;
        parentId = itemMap.get(parentId)?.parentId;
        guard += 1;
      }
      return topLevel;
    };
    const bandOrder = [];
    for (const item of normal) {
      const band = bandFor(item);
      if (!bandOrder.includes(band)) bandOrder.push(band);
    }
    const bandTops = /* @__PURE__ */ new Map();
    let nextBandY = CANVAS_PADDING + 28;
    for (const band of bandOrder) {
      let bandHeight = 0;
      for (const items of columns.values()) {
        const members = items.filter((item) => bandFor(item) === band);
        const height = members.reduce((sum, item) => sum + item.size.height, 0) + Math.max(0, members.length - 1) * model.minimumGap;
        bandHeight = Math.max(bandHeight, height);
      }
      bandTops.set(band, nextBandY);
      nextBandY += Math.max(46, bandHeight) + (band === "__root" ? 42 : 72);
    }
    let x = CANVAS_PADDING;
    const nodes = [];
    for (const rank of orderedRanks) {
      const items = columns.get(rank) ?? [];
      for (const band of bandOrder) {
        let y = bandTops.get(band) ?? CANVAS_PADDING;
        for (const item of items.filter((candidate) => bandFor(candidate) === band)) {
          nodes.push({
            id: item.id,
            label: item.label,
            shape: item.shape,
            ...item.parentId ? { parentId: item.parentId } : {},
            attributes: item.attributes,
            x,
            y,
            ...item.size
          });
          y += item.size.height + model.minimumGap;
        }
      }
      x += (columnWidths.get(rank) ?? 120) + connectionGap(model, new Set(items.map((item) => item.id)), 72);
    }
    if (!model.items.some((item) => item.shape === "container")) alignLayers(nodes, layers, model, model.minimumGap, true);
    for (const item of model.items.filter((candidate) => candidate.shape === "container")) {
      nodes.push({
        id: item.id,
        label: item.label,
        shape: item.shape,
        ...item.parentId ? { parentId: item.parentId } : {},
        attributes: item.attributes,
        x: CANVAS_PADDING,
        y: CANVAS_PADDING,
        ...item.size
      });
    }
    return nodes;
  }
  function fitContainers(nodes) {
    const nodeMap = byId(nodes);
    const containers = nodes.filter((node) => node.shape === "container");
    const depth = (node) => {
      let count = 0;
      let parent = node.parentId ? nodeMap.get(node.parentId) : void 0;
      while (parent && count < nodes.length) {
        count += 1;
        parent = parent.parentId ? nodeMap.get(parent.parentId) : void 0;
      }
      return count;
    };
    containers.sort((a, b) => depth(b) - depth(a));
    for (const container of containers) {
      fitContainer(container, nodes);
    }
  }
  function memberContainerInset(children) {
    return children.some((node) => ["uml-class", "uml-instance", "uml-map"].includes(node.shape)) ? 52 : 26;
  }
  function contributesToContainerSize(node) {
    return node.attributes.boundaryPort !== "true" && !node.attributes.connectionPoint;
  }
  function fitContainer(container, nodes) {
    const children = nodes.filter((node) => node.parentId === container.id && contributesToContainerSize(node));
    if (!children.length) return;
    const left = Math.min(...children.map((node) => node.x));
    const top = Math.min(...children.map((node) => node.y));
    const right = Math.max(...children.map((node) => node.x + node.width));
    const bottom = Math.max(...children.map((node) => node.y + node.height));
    const inset = Math.max(memberContainerInset(children), ...nodes.filter((node) => node.parentId === container.id && node.attributes.boundaryPort === "true").map((node) => node.width / 2 + 16));
    container.x = left - inset;
    container.y = top - (container.headerHeight ?? 42);
    container.width = Math.max(container.width, right - left + inset * 2);
    container.height = Math.max(container.height, bottom - top + (container.headerHeight ?? 42) + 26);
  }
  function separateSiblingBlocks(nodes, model, context2) {
    const map = byId(nodes);
    const descendants = (root) => nodes.filter((node) => {
      let current = node;
      for (let i = 0; current && i < nodes.length; i += 1) {
        if (current.id === root.id) return true;
        current = current.parentId ? map.get(current.parentId) : void 0;
      }
      return false;
    });
    const fixed = (node) => {
      const state = context2.overlay.nodes[node.id];
      return Boolean(state && (!context2.force || context2.preservePinned && state.pinned));
    };
    const parents = nodes.filter((node) => node.shape === "container");
    parents.sort((a, b) => descendants(a).length - descendants(b).length);
    const gap = Math.max(32, model.minimumGap);
    for (const parent of [...parents, void 0]) {
      const siblings = nodes.filter((node) => node.parentId === parent?.id);
      if (!siblings.some((node) => node.shape === "container")) continue;
      const blocks = siblings.map((node) => ({ node, members: descendants(node) }));
      const anchored = blocks.filter((block) => block.members.some(fixed));
      const free = blocks.filter((block) => !block.members.some(fixed)).sort((a, b) => a.node.x - b.node.x);
      const placed = anchored.map((block) => block.node);
      for (const { node, members } of free) {
        let x = node.x;
        for (let i = 0; i <= placed.length; i += 1) {
          const conflicts = placed.filter((other) => node.y < other.y + other.height + gap && node.y + node.height + gap > other.y && x < other.x + other.width + gap && x + node.width + gap > other.x);
          if (!conflicts.length) break;
          x = Math.max(...conflicts.map((other) => other.x + other.width + gap));
        }
        const dx = x - node.x;
        for (const member of members) member.x += dx;
        placed.push(node);
      }
      if (parent && !fixed(parent)) {
        if (!nodes.some((node) => node.parentId === parent.id && node.attributes.boundaryPort === "true")) resetContainerSize(parent, model);
        fitContainer(parent, nodes);
      }
    }
  }
  function resizeAncestorContainers(nodes, movedIds, minimumSizes = /* @__PURE__ */ new Map()) {
    const nodeMap = byId(nodes);
    const ancestors = /* @__PURE__ */ new Set();
    for (const id of movedIds) {
      let parentId = nodeMap.get(id)?.parentId;
      while (parentId) {
        const parent = nodeMap.get(parentId);
        if (!parent || parent.shape !== "container") break;
        ancestors.add(parent.id);
        parentId = parent.parentId;
      }
    }
    const depth = (node) => {
      let value = 0;
      let parent = node.parentId ? nodeMap.get(node.parentId) : void 0;
      while (parent && value < nodes.length) {
        value += 1;
        parent = parent.parentId ? nodeMap.get(parent.parentId) : void 0;
      }
      return value;
    };
    const changed = [];
    const containers = [...ancestors].map((id) => nodeMap.get(id)).filter((node) => Boolean(node)).sort((left, right) => depth(right) - depth(left));
    for (const container of containers) {
      const children = nodes.filter((node) => node.parentId === container.id && contributesToContainerSize(node));
      if (!children.length) continue;
      const inset = Math.max(memberContainerInset(children), ...nodes.filter((node) => node.parentId === container.id && node.attributes.boundaryPort === "true").map((node) => node.width / 2 + 16));
      const desiredLeft = Math.min(...children.map((node) => node.x)) - inset;
      const desiredTop = Math.min(...children.map((node) => node.y)) - (container.headerHeight ?? 42);
      const desiredRight = Math.max(...children.map((node) => node.x + node.width)) + inset;
      const desiredBottom = Math.max(...children.map((node) => node.y + node.height)) + 26;
      const minimum = minimumSizes.get(container.id) ?? container;
      const nextLeft = desiredLeft;
      const nextTop = desiredTop;
      const nextRight = nextLeft + Math.max(minimum.width, desiredRight - desiredLeft);
      const nextBottom = nextTop + Math.max(minimum.height, desiredBottom - desiredTop);
      if (nextLeft === container.x && nextTop === container.y && nextRight === container.x + container.width && nextBottom === container.y + container.height) continue;
      container.x = nextLeft;
      container.y = nextTop;
      container.width = nextRight - nextLeft;
      container.height = nextBottom - nextTop;
      changed.push(container.id);
    }
    return changed;
  }
  function resetContainerSize(container, model) {
    const measured = model.items.find((item) => item.id === container.id)?.size;
    if (!measured) return;
    container.width = measured.width;
    container.height = measured.height;
  }
  function layoutNumber(node, name, minimum = 1) {
    const value = Number(node.attributes[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : void 0;
  }
  function orderedForLayout(nodes) {
    return nodes.map((node, index) => ({ node, index, order: layoutNumber(node, "order", 0) })).sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.index - right.index).map(({ node }) => node);
  }
  function arrangeBlocks(children, layout, container, gap, move) {
    const ordered = orderedForLayout(children);
    const originX = Math.min(...children.map((node) => node.x));
    const originY = Math.min(...children.map((node) => node.y));
    if (layout === "column") {
      const width = Math.max(...children.map((node) => node.width));
      let y = originY;
      for (const node of ordered) {
        move(node, originX + (width - node.width) / 2, y);
        y += node.height + gap;
      }
      return;
    }
    if (layout === "row") {
      let x = originX;
      for (const node of ordered) {
        move(node, x, originY);
        x += node.width + gap;
      }
      return;
    }
    const columnCount = Math.min(ordered.length, layoutNumber(container, "columns") ?? Math.ceil(Math.sqrt(ordered.length)));
    const occupied = /* @__PURE__ */ new Set();
    const cells = ordered.map((node, index) => {
      const preferredRow = layoutNumber(node, "row");
      const preferredColumn = layoutNumber(node, "column");
      let row = preferredRow ? preferredRow - 1 : Math.floor(index / columnCount);
      let column = preferredColumn ? preferredColumn - 1 : index % columnCount;
      while (occupied.has(`${row}:${column}`)) {
        column += 1;
        if (column >= columnCount) {
          column = 0;
          row += 1;
        }
      }
      occupied.add(`${row}:${column}`);
      return { node, row, column };
    });
    const rows = Math.max(...cells.map((cell) => cell.row)) + 1;
    const columns = Math.max(columnCount, ...cells.map((cell) => cell.column + 1));
    const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(0, ...cells.filter((cell) => cell.column === column).map((cell) => cell.node.width)));
    const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(0, ...cells.filter((cell) => cell.row === row).map((cell) => cell.node.height)));
    const columnOffsets = columnWidths.map((_, column) => originX + columnWidths.slice(0, column).reduce((sum, width) => sum + width, 0) + column * gap);
    const rowOffsets = rowHeights.map((_, row) => originY + rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) + row * gap);
    for (const cell of cells) move(cell.node, columnOffsets[cell.column], rowOffsets[cell.row]);
  }
  function arrangeContainerContents(nodes, model) {
    const containers = nodes.filter((node) => node.shape === "container");
    for (const container of containers) {
      const children = nodes.filter((node) => node.parentId === container.id && node.shape !== "container" && contributesToContainerSize(node));
      const hasNestedContainer = nodes.some((node) => node.parentId === container.id && node.shape === "container");
      if (children.length < 2 || hasNestedContainer) continue;
      const childIds = new Set(children.map((node) => node.id));
      const internalEdges = model.connections.filter((edge) => childIds.has(edge.from) && childIds.has(edge.to));
      const originX = Math.min(...children.map((node) => node.x));
      const originY = Math.min(...children.map((node) => node.y));
      const requestedLayout = container.attributes.layout;
      if (requestedLayout === "row" || requestedLayout === "column" || requestedLayout === "grid") {
        arrangeBlocks(children, requestedLayout, container, model.minimumGap, (node, x2, y) => {
          node.x = x2;
          node.y = y;
        });
        continue;
      }
      if (!internalEdges.length) {
        const columns = Math.ceil(Math.sqrt(children.length));
        const cellWidth = Math.max(...children.map((node) => node.width)) + 32;
        const cellHeight = Math.max(...children.map((node) => node.height)) + 28;
        children.forEach((node, index) => {
          node.x = originX + index % columns * cellWidth;
          node.y = originY + Math.floor(index / columns) * cellHeight;
        });
        continue;
      }
      const localModel = { ...model, items: model.items.filter((item) => childIds.has(item.id)), connections: internalEdges };
      const localLayers = orderedLayers(localModel, ranks(localModel));
      let x = originX;
      for (const layer of localLayers) {
        const members = layer.map((item) => children.find((node) => node.id === item.id));
        let y = originY;
        for (const node of members) {
          node.x = x;
          node.y = y;
          y += node.height + model.minimumGap;
        }
        x += Math.max(...members.map((node) => node.width)) + connectionGap(localModel, new Set(members.map((node) => node.id)), 40);
      }
      alignLayers(children, localLayers, localModel, model.minimumGap, true);
    }
  }
  function arrangeNestedContainerContents(nodes, model) {
    const nodeMap = byId(nodes);
    const depth = (node) => {
      let count = 0;
      let parent = node.parentId ? nodeMap.get(node.parentId) : void 0;
      while (parent && count < nodes.length) {
        count += 1;
        parent = parent.parentId ? nodeMap.get(parent.parentId) : void 0;
      }
      return count;
    };
    const moveBlock = (rootId, dx, dy) => {
      for (const node of nodes) {
        let current = node;
        let guard = 0;
        while (current && guard < nodes.length) {
          if (current.id === rootId) {
            node.x += dx;
            node.y += dy;
            break;
          }
          current = current.parentId ? nodeMap.get(current.parentId) : void 0;
          guard += 1;
        }
      }
    };
    const containers = nodes.filter((node) => node.shape === "container").sort((a, b) => depth(b) - depth(a));
    for (const container of containers) {
      const children = nodes.filter((node) => node.parentId === container.id && contributesToContainerSize(node));
      if (!children.some((node) => node.shape === "container")) continue;
      const requestedLayout = container.attributes.layout;
      if (model.kind === "deployment" && requestedLayout === "architecture" && arrangeArchitecture(children, nodes, model, (id, x2, y) => {
        const n = nodeMap.get(id);
        moveBlock(id, x2 - n.x, y - n.y);
      })) {
        resetContainerSize(container, model);
        fitContainer(container, nodes);
        continue;
      }
      if (requestedLayout === "row" || requestedLayout === "column" || requestedLayout === "grid") {
        arrangeBlocks(children, requestedLayout, container, Math.max(48, model.minimumGap), (node, x2, y) => {
          moveBlock(node.id, x2 - node.x, y - node.y);
        });
        resetContainerSize(container, model);
        fitContainer(container, nodes);
        continue;
      }
      const blockForNode = /* @__PURE__ */ new Map();
      for (const node of nodes) {
        let current = node;
        let guard = 0;
        while (current?.parentId && current.parentId !== container.id && guard < nodes.length) {
          current = nodeMap.get(current.parentId);
          guard += 1;
        }
        if (current?.parentId === container.id) blockForNode.set(node.id, current.id);
      }
      const childIds = new Set(children.map((node) => node.id));
      const blockRanks = new Map(children.map((node) => [node.id, 0]));
      const adjacency = new Map(children.map((node) => [node.id, /* @__PURE__ */ new Set()]));
      const acceptedEdges = [];
      const reaches = (start, goal) => {
        const pending = [start];
        const visited = /* @__PURE__ */ new Set();
        while (pending.length) {
          const current = pending.pop();
          if (!current || visited.has(current)) continue;
          if (current === goal) return true;
          visited.add(current);
          pending.push(...adjacency.get(current) ?? []);
        }
        return false;
      };
      for (const edge of model.connections) {
        const from = blockForNode.get(edge.from);
        const to = blockForNode.get(edge.to);
        if (!from || !to || from === to || !childIds.has(from) || !childIds.has(to)) continue;
        if (reaches(to, from)) continue;
        adjacency.get(from)?.add(to);
        acceptedEdges.push({ from, to });
      }
      for (let iteration = 0; iteration < children.length; iteration += 1) {
        let changed = false;
        for (const edge of acceptedEdges) {
          const next = Math.min(children.length - 1, (blockRanks.get(edge.from) ?? 0) + 1);
          if (next > (blockRanks.get(edge.to) ?? 0)) {
            blockRanks.set(edge.to, next);
            changed = true;
          }
        }
        if (!changed) break;
      }
      const rankValues = [...new Set(blockRanks.values())].sort((a, b) => a - b);
      const originX = Math.min(...children.map((node) => node.x));
      const originY = Math.min(...children.map((node) => node.y));
      const columnGap = Math.max(96, model.minimumGap + 64);
      let x = originX;
      for (const rank of rankValues) {
        const members = children.filter((node) => blockRanks.get(node.id) === rank);
        const columnWidth = Math.max(...members.map((node) => node.width));
        let y = originY;
        for (const node of members) {
          moveBlock(node.id, x - node.x, y - node.y);
          y += node.height + model.minimumGap;
        }
        x += columnWidth + columnGap;
      }
      resetContainerSize(container, model);
      fitContainer(container, nodes);
    }
  }
  function packTopLevelGroups(nodes, model) {
    const nodeMap = byId(nodes);
    const rootGroup = "__root";
    const groupFor2 = (node) => {
      if (node.shape === "container" && !node.parentId) return node.id;
      let parentId = node.parentId;
      let topLevel;
      let guard = 0;
      while (parentId && guard < nodes.length) {
        topLevel = parentId;
        parentId = nodeMap.get(parentId)?.parentId;
        guard += 1;
      }
      return topLevel ?? rootGroup;
    };
    const groupByNode = new Map(nodes.map((node) => [node.id, groupFor2(node)]));
    const groupOrder = [];
    for (const node of nodes) {
      const group = groupByNode.get(node.id) ?? rootGroup;
      if (!groupOrder.includes(group)) groupOrder.push(group);
    }
    if (groupOrder.length < 2) return;
    const groupRanks = new Map(groupOrder.map((group) => [group, 0]));
    const groupAdjacency = new Map(groupOrder.map((group) => [group, /* @__PURE__ */ new Set()]));
    const acceptedGroupEdges = [];
    const reachesGroup = (start, goal) => {
      const pending = [start];
      const visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const current = pending.pop();
        if (!current || visited.has(current)) continue;
        if (current === goal) return true;
        visited.add(current);
        pending.push(...groupAdjacency.get(current) ?? []);
      }
      return false;
    };
    for (const edge of model.connections) {
      const from = groupByNode.get(edge.from) ?? rootGroup;
      const to = groupByNode.get(edge.to) ?? rootGroup;
      if (from === to || reachesGroup(to, from)) continue;
      groupAdjacency.get(from)?.add(to);
      acceptedGroupEdges.push({ from, to });
    }
    for (let iteration = 0; iteration < groupOrder.length; iteration += 1) {
      let changed = false;
      for (const { from, to } of acceptedGroupEdges) {
        const next = Math.min(groupOrder.length - 1, (groupRanks.get(from) ?? 0) + 1);
        if (next > (groupRanks.get(to) ?? 0)) {
          groupRanks.set(to, next);
          changed = true;
        }
      }
      if (!changed) break;
    }
    for (const group of groupOrder) {
      const groupNode = nodeMap.get(group);
      if (groupNode?.attributes.place !== "below") continue;
      const predecessorRanks = model.connections.filter((edge) => (groupByNode.get(edge.to) ?? rootGroup) === group).map((edge) => groupRanks.get(groupByNode.get(edge.from) ?? rootGroup) ?? 0);
      groupRanks.set(group, Math.max(0, ...predecessorRanks));
    }
    const membersByGroup = /* @__PURE__ */ new Map();
    for (const group of groupOrder) membersByGroup.set(group, []);
    for (const node of nodes) membersByGroup.get(groupByNode.get(node.id) ?? rootGroup)?.push(node);
    const boundsByGroup = /* @__PURE__ */ new Map();
    for (const [group, members] of membersByGroup) {
      if (!members.length) continue;
      const left = Math.min(...members.map((node) => node.x));
      const top = Math.min(...members.map((node) => node.y));
      const right = Math.max(...members.map((node) => node.x + node.width));
      const bottom = Math.max(...members.map((node) => node.y + node.height));
      boundsByGroup.set(group, { x: left, y: top, width: right - left, height: bottom - top });
    }
    const ranksInUse = [...new Set(groupRanks.values())].sort((a, b) => a - b);
    let columnX = CANVAS_PADDING;
    for (const rank of ranksInUse) {
      const groups = groupOrder.filter((group) => groupRanks.get(group) === rank && boundsByGroup.has(group));
      const columnWidth = Math.max(...groups.map((group) => boundsByGroup.get(group)?.width ?? 0));
      let rowY = CANVAS_PADDING;
      for (const group of groups) {
        const bounds = boundsByGroup.get(group);
        if (!bounds) continue;
        const dx = columnX - bounds.x;
        const dy = rowY - bounds.y;
        for (const node of membersByGroup.get(group) ?? []) {
          node.x += dx;
          node.y += dy;
        }
        rowY += bounds.height + 48;
      }
      const sourceIds = new Set(groups.flatMap((group) => (membersByGroup.get(group) ?? []).map((node) => node.id)));
      columnX += columnWidth + connectionGap(model, sourceIds, 72);
    }
  }
  var ROUTE_CLEARANCE = 24;
  var EDGE_CLEARANCE = 12;
  var MAX_ROUTE_SEARCH_STATES = 2e4;
  function segmentCongestion(from, to, edges) {
    const horizontal = from.y === to.y;
    let congestion = 0;
    for (const edge of edges) for (let i = 1; i < edge.points.length; i += 1) {
      const a = edge.points[i - 1];
      const b = edge.points[i];
      if (horizontal ? a.y !== b.y : a.x !== b.x) continue;
      const distance = horizontal ? Math.abs(from.y - a.y) : Math.abs(from.x - a.x);
      if (distance >= EDGE_CLEARANCE) continue;
      const overlap = horizontal ? Math.min(Math.max(from.x, to.x), Math.max(a.x, b.x)) - Math.max(Math.min(from.x, to.x), Math.min(a.x, b.x)) : Math.min(Math.max(from.y, to.y), Math.max(a.y, b.y)) - Math.max(Math.min(from.y, to.y), Math.min(a.y, b.y));
      congestion += Math.max(0, overlap) * (1 - distance / EDGE_CLEARANCE);
    }
    return congestion;
  }
  function simplifyRoute(points) {
    const simplified = [];
    for (const point of points) {
      const previous = simplified[simplified.length - 1];
      if (previous && previous.x === point.x && previous.y === point.y) continue;
      simplified.push(point);
      while (simplified.length >= 3) {
        const before = simplified[simplified.length - 3];
        const middle = simplified[simplified.length - 2];
        const after = simplified[simplified.length - 1];
        const collinear = before.x === middle.x && middle.x === after.x && (middle.y - before.y) * (after.y - middle.y) >= 0 || before.y === middle.y && middle.y === after.y && (middle.x - before.x) * (after.x - middle.x) >= 0;
        if (!collinear) break;
        simplified.splice(simplified.length - 2, 1);
      }
    }
    return simplified;
  }
  function segmentCrossings(from, to, routes) {
    const horizontal = from.y === to.y;
    const vertical = from.x === to.x;
    if (!horizontal && !vertical) return 0;
    let crossings = 0;
    for (const route of routes) {
      for (let index = 1; index < route.length; index += 1) {
        const otherFrom = route[index - 1];
        const otherTo = route[index];
        const otherHorizontal = otherFrom.y === otherTo.y;
        const otherVertical = otherFrom.x === otherTo.x;
        if (horizontal && otherVertical) {
          const x = otherFrom.x;
          const y = from.y;
          if (x > Math.min(from.x, to.x) && x < Math.max(from.x, to.x) && y > Math.min(otherFrom.y, otherTo.y) && y < Math.max(otherFrom.y, otherTo.y)) crossings += 1;
        } else if (vertical && otherHorizontal) {
          const x = from.x;
          const y = otherFrom.y;
          if (y > Math.min(from.y, to.y) && y < Math.max(from.y, to.y) && x > Math.min(otherFrom.x, otherTo.x) && x < Math.max(otherFrom.x, otherTo.x)) crossings += 1;
        }
      }
    }
    return crossings;
  }
  function routeCost(points, crossingRoutes, independentEdges, branchEdges, risk) {
    const route = simplifyRoute(points);
    let crossings = 0;
    let length = 0;
    let congestion = 0;
    let branchCongestion = 0;
    let crossingRisk2 = 0;
    for (let index = 1; index < route.length; index += 1) {
      const from = route[index - 1];
      const to = route[index];
      crossings += segmentCrossings(from, to, crossingRoutes);
      crossingRisk2 += risk(from, to);
      congestion += segmentCongestion(from, to, independentEdges);
      branchCongestion += segmentCongestion(from, to, branchEdges);
      length += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    }
    return { crossingRisk: crossingRisk2, crossings, branchCongestion, bends: Math.max(0, route.length - 2), length, congestion };
  }
  function routeHeading(from, to) {
    return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) };
  }
  function followsHeading(from, to, heading) {
    const candidate = routeHeading(from, to);
    return candidate.x === heading.x && candidate.y === heading.y;
  }
  function chooseSmartRoute(points, source, target, nodes, previousEdges, clearance = ROUTE_CLEARANCE, considerEdgeCrossings = true, attributes, kind) {
    const policy = routingPolicy(attributes);
    const compareRouteCost = (a, b) => compareRoutingCost(a, b, policy);
    const comparedEdges = considerEdgeCrossings ? previousEdges : [];
    const crossingRoutes = comparedEdges.map((edge) => simplifyRoute(edge.points));
    const occupiedCrossings = existingCrossings(crossingRoutes);
    const risk = (a, b) => crossingRisk(a, b, crossingRoutes, occupiedCrossings, [points[0], points[points.length - 1]], policy.crossingClearance);
    const independentEdges = comparedEdges.filter((edge) => kind === "class" || kind === "state" && source.shape !== "uml-bar" && target.shape !== "uml-bar" || edge.from !== source.id && edge.to !== target.id);
    const frameEdges = kind === "deployment" ? nodes.filter((n) => n.shape === "container").flatMap((n) => [
      [{ x: n.x, y: n.y }, { x: n.x + n.width, y: n.y }],
      [{ x: n.x, y: n.y + n.height }, { x: n.x + n.width, y: n.y + n.height }],
      [{ x: n.x, y: n.y }, { x: n.x, y: n.y + n.height }],
      [{ x: n.x + n.width, y: n.y }, { x: n.x + n.width, y: n.y + n.height }]
    ].map((points2, i) => ({ id: `frame-${n.id}-${i}`, from: n.id, to: n.id, order: 0, dashed: false, points: points2 }))) : [];
    independentEdges.push(...frameEdges);
    const branchEdges = source.shape === "diamond" ? comparedEdges.filter((edge) => edge.from === source.id && edge.to !== target.id) : [];
    const boundaryOwners = /* @__PURE__ */ new Set();
    for (const [point, other] of [[source, target], [target, source]]) {
      if (!point?.attributes.connectionPoint || !point.parentId || !other) continue;
      let parent = other.id;
      const seen = /* @__PURE__ */ new Set();
      while (parent && parent !== point.parentId && !seen.has(parent)) {
        seen.add(parent);
        parent = nodes.find((node) => node.id === parent)?.parentId;
      }
      if (parent !== point.parentId) boundaryOwners.add(point.parentId);
    }
    const obstacles = nodes.filter((node) => {
      if (node.shape !== "container" || boundaryOwners.has(node.id)) return true;
      if (kind !== "state") return false;
      const contains = (endpoint) => {
        let id = endpoint.id;
        const seen = /* @__PURE__ */ new Set();
        while (id && !seen.has(id)) {
          if (id === node.id) return true;
          seen.add(id);
          id = nodes.find((n) => n.id === id)?.parentId;
        }
        return false;
      };
      return !contains(source) && !contains(target);
    }).map((node) => {
      const nodeClearance = node.id === source.id || node.id === target.id ? 0 : boundaryOwners.has(node.id) ? Math.min(8, clearance) : clearance;
      const roleEndpoint = ["sequence-boundary", "sequence-control", "sequence-entity"].includes(node.shape) && (node.id === source.id || node.id === target.id);
      const actorEndpoint = node.shape === "actor" && (node.id === source.id || node.id === target.id);
      const portEndpoint = node.shape === "uml-port" && (node.id === source.id || node.id === target.id);
      return {
        left: node.x + (actorEndpoint ? node.width / 2 - 16 : portEndpoint ? node.width / 2 - 11 : roleEndpoint ? node.width / 2 - (node.shape === "sequence-boundary" ? 30 : 18) : 0) - nodeClearance,
        top: node.y + (actorEndpoint ? 2 : portEndpoint ? 2 : roleEndpoint ? node.shape === "sequence-control" ? 30 - Math.sqrt(224) : 12 : 0) - nodeClearance,
        right: node.x + (actorEndpoint ? node.width / 2 + 16 : portEndpoint ? node.width / 2 + 11 : roleEndpoint ? node.width / 2 + 18 : node.width) + nodeClearance,
        bottom: node.y + (actorEndpoint ? 56 : portEndpoint ? 24 : roleEndpoint ? node.shape === "sequence-entity" ? 52 : 48 : node.height) + nodeClearance,
        endpoint: node.id === source.id || node.id === target.id
      };
    });
    const finite = points.length >= 2 && points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (!finite) return points;
    const initialRoute = simplifyRoute(points);
    if (initialRoute.length < 2) return points;
    const start = initialRoute[0];
    const end = initialRoute[initialRoute.length - 1];
    const startHeading = routeHeading(start, initialRoute[1]);
    const endHeading = routeHeading(initialRoute[initialRoute.length - 2], end);
    if (!startHeading.x && !startHeading.y || !endHeading.x && !endHeading.y) return points;
    const forwardGap = startHeading.x === endHeading.x && startHeading.y === endHeading.y ? (end.x - start.x) * startHeading.x + (end.y - start.y) * startHeading.y : Infinity;
    const approach = Math.min(clearance > 0 ? 16 : 0, (Math.abs(end.x - start.x) + Math.abs(end.y - start.y)) / 2, forwardGap > 0 ? forwardGap / 2 : Infinity);
    const nearEndpointTurn = (from, to) => [
      { point: start, heading: startHeading },
      { point: end, heading: endHeading }
    ].some(({ point, heading }) => heading.x ? from.x === to.x && Math.abs(from.x - point.x) < approach && Math.min(from.y, to.y) <= point.y && Math.max(from.y, to.y) >= point.y : from.y === to.y && Math.abs(from.y - point.y) < approach && Math.min(from.x, to.x) <= point.x && Math.max(from.x, to.x) >= point.x);
    const segmentBlocked = (from, to) => nearEndpointTurn(from, to) || obstacles.some((obstacle) => {
      if (from.x === to.x) {
        const top = Math.min(from.y, to.y);
        const bottom = Math.max(from.y, to.y);
        return (obstacle.endpoint ? from.x >= obstacle.left && from.x <= obstacle.right : from.x > obstacle.left && from.x < obstacle.right) && top < obstacle.bottom && bottom > obstacle.top;
      }
      if (from.y === to.y) {
        const left = Math.min(from.x, to.x);
        const right = Math.max(from.x, to.x);
        return (obstacle.endpoint ? from.y >= obstacle.top && from.y <= obstacle.bottom : from.y > obstacle.top && from.y < obstacle.bottom) && left < obstacle.right && right > obstacle.left;
      }
      return true;
    });
    const pathBlocked = (path) => path.slice(1).some((point, index) => segmentBlocked(path[index], point));
    const initialCost = routeCost(initialRoute, crossingRoutes, independentEdges, branchEdges, risk);
    if (!pathBlocked(initialRoute) && initialCost.crossingRisk === 0 && initialCost.crossings === 0 && initialCost.congestion === 0 && initialCost.branchCongestion === 0) return points;
    const edgeChannels = [...comparedEdges, ...frameEdges].flatMap((edge) => edge.points.flatMap((point) => [
      { x: point.x - EDGE_CLEARANCE, y: point.y - EDGE_CLEARANCE },
      { x: point.x + EDGE_CLEARANCE, y: point.y + EDGE_CLEARANCE }
    ]));
    const xs = [.../* @__PURE__ */ new Set([
      start.x + startHeading.x * approach,
      end.x - endHeading.x * approach,
      ...initialRoute.map((point) => point.x),
      ...obstacles.flatMap((obstacle) => [obstacle.left, obstacle.right]),
      ...obstacles.filter((obstacle) => obstacle.endpoint).flatMap((obstacle) => [obstacle.left - EDGE_CLEARANCE, obstacle.right + EDGE_CLEARANCE]),
      ...edgeChannels.map((point) => point.x)
    ])].sort((a, b) => a - b);
    const ys = [.../* @__PURE__ */ new Set([
      start.y + startHeading.y * approach,
      end.y - endHeading.y * approach,
      ...initialRoute.map((point) => point.y),
      ...obstacles.flatMap((obstacle) => [obstacle.top, obstacle.bottom]),
      ...obstacles.filter((obstacle) => obstacle.endpoint).flatMap((obstacle) => [obstacle.top - EDGE_CLEARANCE, obstacle.bottom + EDGE_CLEARANCE]),
      ...edgeChannels.map((point) => point.y)
    ])].sort((a, b) => a - b);
    const startX = xs.indexOf(start.x);
    const startY = ys.indexOf(start.y);
    const endX = xs.indexOf(end.x);
    const endY = ys.indexOf(end.y);
    if ([startX, startY, endX, endY].some((index) => index < 0)) return points;
    const emptyCost = { crossingRisk: 0, crossings: 0, branchCongestion: 0, bends: 0, length: 0, congestion: 0 };
    const queue = [{
      order: 0,
      xIndex: startX,
      yIndex: startY,
      direction: "start",
      cost: emptyCost,
      path: [start]
    }];
    let nextOrder = 1;
    const compareState = (a, b) => compareRouteCost(a.cost, b.cost) || a.order - b.order;
    const enqueue = (state) => {
      queue.push(state);
      let index = queue.length - 1;
      while (index > 0) {
        const parent = index - 1 >> 1;
        if (compareState(queue[parent], state) <= 0) break;
        queue[index] = queue[parent];
        index = parent;
      }
      queue[index] = state;
    };
    const dequeue = () => {
      const result = queue[0], last = queue.pop();
      if (queue.length) {
        let index = 0;
        while (index * 2 + 1 < queue.length) {
          let child = index * 2 + 1;
          if (child + 1 < queue.length && compareState(queue[child + 1], queue[child]) < 0) child++;
          if (compareState(last, queue[child]) <= 0) break;
          queue[index] = queue[child];
          index = child;
        }
        queue[index] = last;
      }
      return result;
    };
    const best = /* @__PURE__ */ new Map();
    const keyFor = (xIndex, yIndex, direction) => `${xIndex}:${yIndex}:${direction}`;
    best.set(keyFor(startX, startY, "start"), emptyCost);
    const pointBlocked = (point) => obstacles.some((obstacle) => point.x > obstacle.left && point.x < obstacle.right && point.y > obstacle.top && point.y < obstacle.bottom);
    const blockedPoints = /* @__PURE__ */ new Map();
    const segmentCosts = /* @__PURE__ */ new Map();
    let routed;
    let searchedStates = 0;
    while (queue.length && searchedStates < MAX_ROUTE_SEARCH_STATES) {
      searchedStates += 1;
      const current = dequeue();
      const stateKey = keyFor(current.xIndex, current.yIndex, current.direction);
      const known = best.get(stateKey);
      if (known && compareRouteCost(current.cost, known) > 0) continue;
      if (current.xIndex === endX && current.yIndex === endY) {
        routed = current.path;
        break;
      }
      const neighbors = [
        { xIndex: current.xIndex - 1, yIndex: current.yIndex, direction: "horizontal" },
        { xIndex: current.xIndex + 1, yIndex: current.yIndex, direction: "horizontal" },
        { xIndex: current.xIndex, yIndex: current.yIndex - 1, direction: "vertical" },
        { xIndex: current.xIndex, yIndex: current.yIndex + 1, direction: "vertical" }
      ];
      const from = { x: xs[current.xIndex], y: ys[current.yIndex] };
      for (const neighbor of neighbors) {
        if (neighbor.xIndex < 0 || neighbor.xIndex >= xs.length || neighbor.yIndex < 0 || neighbor.yIndex >= ys.length) continue;
        const to = { x: xs[neighbor.xIndex], y: ys[neighbor.yIndex] };
        if (current.direction === "start" && !followsHeading(from, to, startHeading)) continue;
        if (neighbor.xIndex === endX && neighbor.yIndex === endY && !followsHeading(from, to, endHeading)) continue;
        const fromIndex = current.yIndex * xs.length + current.xIndex;
        const toIndex = neighbor.yIndex * xs.length + neighbor.xIndex;
        let blocked = blockedPoints.get(toIndex);
        if (blocked === void 0) {
          blocked = pointBlocked(to);
          blockedPoints.set(toIndex, blocked);
        }
        if (blocked) continue;
        const segmentKey = `${Math.min(fromIndex, toIndex)}:${Math.max(fromIndex, toIndex)}`;
        let segment = segmentCosts.get(segmentKey);
        if (segment === void 0) {
          segment = segmentBlocked(from, to) ? null : {
            crossingRisk: risk(from, to),
            crossings: segmentCrossings(from, to, crossingRoutes),
            branchCongestion: segmentCongestion(from, to, branchEdges),
            length: Math.abs(to.x - from.x) + Math.abs(to.y - from.y),
            congestion: segmentCongestion(from, to, independentEdges)
          };
          segmentCosts.set(segmentKey, segment);
        }
        if (segment === null) continue;
        const cost = {
          crossingRisk: current.cost.crossingRisk + segment.crossingRisk,
          crossings: current.cost.crossings + segment.crossings,
          branchCongestion: current.cost.branchCongestion + segment.branchCongestion,
          bends: current.cost.bends + (current.direction !== "start" && current.direction !== neighbor.direction ? 1 : 0),
          length: current.cost.length + segment.length,
          congestion: current.cost.congestion + segment.congestion
        };
        const nextKey = keyFor(neighbor.xIndex, neighbor.yIndex, neighbor.direction);
        const previousCost = best.get(nextKey);
        if (previousCost && compareRouteCost(cost, previousCost) >= 0) continue;
        best.set(nextKey, cost);
        enqueue({ ...neighbor, order: nextOrder++, cost, path: [...current.path, to] });
      }
    }
    if (!routed && clearance > 0) {
      return chooseSmartRoute(points, source, target, nodes, previousEdges, clearance > 12 ? 12 : clearance > 6 ? 6 : 0, considerEdgeCrossings, attributes, kind);
    }
    if (!routed && considerEdgeCrossings && previousEdges.length > 0) {
      return chooseSmartRoute(points, source, target, nodes, [], 0, false, attributes, kind);
    }
    if (!routed) return points;
    const simplified = simplifyRoute(routed);
    if (!pathBlocked(initialRoute) && compareRouteCost(routeCost(simplified, crossingRoutes, independentEdges, branchEdges, risk), initialCost) >= 0) return points;
    return simplified;
  }
  function routeDeployment(nodes, model) {
    for (const port of nodes.filter((node) => node.attributes.boundaryPort === "true" && node.attributes.portDirection === "auto")) {
      const external = (id) => {
        let node = nodes.find((node2) => node2.id === id);
        const seen = /* @__PURE__ */ new Set();
        while (node && !seen.has(node.id)) {
          if (node.id === port.parentId) return false;
          seen.add(node.id);
          node = nodes.find((parent) => parent.id === node.parentId);
        }
        return true;
      };
      const edge = model.connections.find((edge2) => edge2.from === port.id && external(edge2.to) || edge2.to === port.id && external(edge2.from));
      port.attributes = { ...port.attributes, resolvedPortDirection: edge?.from === port.id ? "out" : "in" };
    }
    const portOwners = new Set(nodes.filter((node) => node.attributes.boundaryPort === "true").map((node) => node.parentId));
    for (const owner of nodes.filter((node) => portOwners.has(node.id))) {
      for (const outgoing of [false, true]) {
        const ports = nodes.filter((node) => node.parentId === owner.id && node.attributes.boundaryPort === "true" && (node.attributes.resolvedPortDirection ?? node.attributes.portDirection) === "out" === outgoing);
        if (!ports.length) continue;
        if (model.direction === "down") owner.width = Math.max(owner.width, (ports.length + 1) * (Math.max(...ports.map((port) => port.width)) + 12));
        else owner.height = Math.max(owner.height, (owner.headerHeight ?? 42) + (ports.length + 1) * (Math.max(...ports.map((port) => port.height)) + 12));
      }
    }
    if (portOwners.size) for (let pass = 0; pass < nodes.length; pass++) {
      let changed = false;
      for (const child of nodes) {
        if (!child.parentId || !contributesToContainerSize(child)) continue;
        const parent = nodes.find((node) => node.id === child.parentId);
        if (!parent) continue;
        const width = Math.max(parent.width, child.x + child.width - parent.x + 26), height = Math.max(parent.height, child.y + child.height - parent.y + 26);
        if (width !== parent.width || height !== parent.height) {
          parent.width = width;
          parent.height = height;
          changed = true;
        }
      }
      if (!changed) break;
    }
    for (const port of nodes.filter((node) => node.attributes.boundaryPort === "true" && node.parentId)) {
      const owner = nodes.find((node) => node.id === port.parentId);
      if (!owner) continue;
      const outgoing = (port.attributes.resolvedPortDirection ?? port.attributes.portDirection) === "out", vertical = model.direction === "down";
      const peers = nodes.filter((node) => node.parentId === owner.id && node.attributes.boundaryPort === "true" && (node.attributes.resolvedPortDirection ?? node.attributes.portDirection) === "out" === outgoing);
      const fraction = (peers.indexOf(port) + 1) / (peers.length + 1);
      port.x = vertical ? owner.x + owner.width * fraction - port.width / 2 : owner.x + (outgoing ? owner.width : 0) - port.width / 2;
      const header2 = owner.headerHeight ?? 42;
      port.y = vertical ? owner.y + (outgoing ? owner.height : 0) - 13 : owner.y + header2 + (owner.height - header2) * fraction - 13;
    }
    if (model.kind === "state") {
      for (const point of nodes.filter((n) => n.attributes.connectionPoint && n.parentId)) {
        const owner = nodes.find((n) => n.id === point.parentId);
        if (!owner) continue;
        const side = ["entrypoint", "inputpin"].includes(point.attributes.stateKind ?? "") ? "top" : "bottom";
        const peers = nodes.filter((n) => n.parentId === owner.id && n.attributes.connectionPoint && ["entrypoint", "inputpin"].includes(n.attributes.stateKind ?? "") === (side === "top"));
        point.x = owner.x + owner.width * (peers.indexOf(point) + 1) / (peers.length + 1) - point.width / 2;
        if (peers.length === 1 && ["inputpin", "outputpin"].includes(point.attributes.stateKind ?? "")) {
          const internal = model.connections.filter((edge) => side === "top" ? edge.from === point.id : edge.to === point.id).map((edge) => nodes.find((node) => node.id === (side === "top" ? edge.to : edge.from))).filter((node) => Boolean(node && node.parentId === owner.id));
          if (internal.length === 1) point.x = Math.max(owner.x + 20, Math.min(owner.x + owner.width - 20, internal[0].x + internal[0].width / 2)) - point.width / 2;
        }
        point.y = owner.y + (side === "bottom" ? owner.height : 0) - point.height / 2;
      }
    }
    const map = byId(nodes);
    const plans = [];
    for (const edge of model.connections) {
      const source = map.get(edge.from);
      const target = map.get(edge.to);
      if (!source || !target) continue;
      const sourceCenter = center(source);
      const targetCenter = center(target);
      const requestedSourceSide = (edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex) !== void 0 ? targetCenter.x >= sourceCenter.x ? "right" : "left" : portSide(edge.attributes?.fromPort);
      const requestedTargetSide = (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex) !== void 0 ? edge.from === edge.to || sourceCenter.x > targetCenter.x ? "right" : "left" : portSide(edge.attributes?.toPort);
      const stateBarConnection = ["state", "activity"].includes(model.kind) && (source.shape === "uml-bar" || target.shape === "uml-bar");
      const verticalActivity = (model.kind === "activity" || model.kind === "class") && edge.from !== edge.to && (target.y >= source.y + source.height || source.y >= target.y + target.height);
      const facingContainers = model.kind === "deployment" && source.shape === "container" && target.shape === "container" && Math.min(source.x + source.width, target.x + target.width) - Math.max(source.x, target.x) > 36 && (target.y >= source.y + source.height || source.y >= target.y + target.height);
      const horizontal = !facingContainers && !stateBarConnection && !verticalActivity && (edge.from === edge.to || Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y) * 0.55);
      if (horizontal) {
        const forward2 = targetCenter.x >= sourceCenter.x;
        plans.push({
          edge,
          source,
          target,
          sourceSide: requestedSourceSide ?? (forward2 ? "right" : "left"),
          targetSide: requestedTargetSide ?? (forward2 ? "left" : "right")
        });
        continue;
      }
      const forward = targetCenter.y >= sourceCenter.y;
      plans.push({
        edge,
        source,
        target,
        sourceSide: requestedSourceSide ?? (forward ? "bottom" : "top"),
        targetSide: requestedTargetSide ?? (forward ? "top" : "bottom")
      });
    }
    if (model.kind === "class") for (const plan of plans) {
      if (plan.edge.attributes?.relation !== "dependency" || plan.source.parentId !== plan.target.parentId) continue;
      const right = plan.target.x - (plan.source.x + plan.source.width) >= 80;
      const left = plan.source.x - (plan.target.x + plan.target.width) >= 80;
      if (!right && !left) continue;
      if (!plan.edge.attributes?.fromPort && plan.edge.attributes?.fromMemberIndex === void 0) plan.sourceSide = right ? "right" : "left";
      if (!plan.edge.attributes?.toPort && plan.edge.attributes?.toMemberIndex === void 0) plan.targetSide = right ? "left" : "right";
    }
    if (model.kind === "class") for (const plan of plans) {
      if (plan.edge.attributes?.relation !== "dependency" || plan.source.parentId !== plan.target.parentId || plan.edge.attributes?.fromPort || plan.edge.attributes?.fromMemberIndex !== void 0) continue;
      if (plan.target.y - (plan.source.y + plan.source.height) < 240) continue;
      const blocked = nodes.some((node) => node !== plan.source && node !== plan.target && node.shape !== "container" && node.y > plan.source.y + plan.source.height && node.y + node.height < plan.target.y && node.x < center(plan.source).x && node.x + node.width > center(plan.source).x);
      if (blocked) plan.sourceSide = center(plan.source).x >= center(plan.target).x ? "right" : "left";
    }
    if (model.kind === "class") for (const plan of plans) {
      if (plan.edge.attributes?.relation !== "dependency" || !plan.source.parentId || !plan.target.parentId || plan.source.parentId === plan.target.parentId) continue;
      const sourceOwner = map.get(plan.source.parentId), targetOwner = map.get(plan.target.parentId);
      if (!sourceOwner || !targetOwner || sourceOwner.parentId !== targetOwner.parentId) continue;
      const right = targetOwner.x >= sourceOwner.x + sourceOwner.width;
      const left = sourceOwner.x >= targetOwner.x + targetOwner.width;
      if (!right && !left) continue;
      if (!portSide(plan.edge.attributes?.fromPort)) plan.sourceSide = right ? "right" : "left";
      if (!portSide(plan.edge.attributes?.toPort)) plan.targetSide = center(plan.source).y < plan.target.y ? "top" : right ? "left" : "right";
    }
    const componentPortSide = (port, other) => {
      if (port.attributes.boundaryPort !== "true" || !port.parentId) return void 0;
      let parent = other.parentId, inside = false;
      const seen = /* @__PURE__ */ new Set();
      while (parent && !seen.has(parent)) {
        if (parent === port.parentId) {
          inside = true;
          break;
        }
        seen.add(parent);
        parent = map.get(parent)?.parentId;
      }
      const outgoing = (port.attributes.resolvedPortDirection ?? port.attributes.portDirection) === "out";
      return model.direction === "down" ? inside !== outgoing ? "bottom" : "top" : inside !== outgoing ? "right" : "left";
    };
    for (const plan of plans) {
      if (!portSide(plan.edge.attributes?.fromPort)) plan.sourceSide = componentPortSide(plan.source, plan.target) ?? plan.sourceSide;
      if (!portSide(plan.edge.attributes?.toPort)) plan.targetSide = componentPortSide(plan.target, plan.source) ?? plan.targetSide;
    }
    if (model.kind === "state") {
      const inside = (node, owner) => {
        const seen = /* @__PURE__ */ new Set();
        let parent = node.parentId;
        while (parent && !seen.has(parent)) {
          if (parent === owner) return true;
          seen.add(parent);
          parent = map.get(parent)?.parentId;
        }
        return false;
      };
      const boundarySide = (point, other) => {
        if (!point.attributes.connectionPoint || !point.parentId) return void 0;
        const internal = inside(other, point.parentId);
        return ["entrypoint", "inputpin"].includes(point.attributes.stateKind ?? "") ? internal ? "bottom" : "top" : internal ? "top" : "bottom";
      };
      for (const plan of plans) {
        if (!portSide(plan.edge.attributes?.fromPort)) plan.sourceSide = boundarySide(plan.source, plan.target) ?? plan.sourceSide;
        if (!portSide(plan.edge.attributes?.toPort)) plan.targetSide = boundarySide(plan.target, plan.source) ?? plan.targetSide;
      }
    }
    if (model.kind === "state" && model.direction === "down") {
      for (const plan of plans) {
        if (plan.target.shape === "junction-state" && !portSide(plan.edge.attributes?.toPort)) plan.targetSide = "top";
      }
    }
    if (["flowchart", "activity", "graph"].includes(model.kind)) {
      for (const source of nodes.filter((node) => node.shape === "diamond")) {
        const outgoing = plans.filter((plan) => plan.source.id === source.id && plan.target.id !== source.id);
        if (outgoing.length < 2) continue;
        const origin = center(source);
        const vertical = model.kind !== "graph" || model.direction !== "right";
        const forward = [...outgoing].sort((a, b) => {
          const score = (plan) => {
            const target = center(plan.target);
            const along = vertical ? target.y - origin.y : target.x - origin.x;
            const across = vertical ? Math.abs(target.x - origin.x) : Math.abs(target.y - origin.y);
            return (along <= 0 ? 1e6 : 0) + across * 100 + Math.abs(along);
          };
          return score(a) - score(b) || a.edge.order - b.edge.order;
        })[0];
        const used = /* @__PURE__ */ new Set();
        for (const plan of [forward, ...outgoing.filter((plan2) => plan2 !== forward)]) {
          const requested = portSide(plan.edge.attributes?.fromPort);
          const target = center(plan.target);
          let side = plan === forward ? vertical ? "bottom" : "right" : vertical ? target.x < origin.x ? "left" : "right" : target.y < origin.y ? "top" : "bottom";
          if (plan !== forward && used.has(side)) {
            const alternative = vertical ? side === "left" ? "right" : "left" : side === "top" ? "bottom" : "top";
            if (!used.has(alternative)) side = alternative;
          }
          plan.sourceSide = requested ?? side;
          used.add(plan.sourceSide);
          if (!portSide(plan.edge.attributes?.toPort) && plan !== forward && (vertical ? Math.abs(target.x - origin.x) < 0.5 : Math.abs(target.y - origin.y) < 0.5)) {
            plan.targetSide = plan.sourceSide;
          }
        }
      }
    }
    if (model.kind === "state") for (const plan of plans) {
      if (plan.source.attributes.stateKind !== "exitpoint" || !plan.source.parentId || plan.edge.attributes?.toPort) continue;
      const resume = plans.find((other) => other.source.id === plan.target.id && other.target.attributes.stateKind === "entrypoint" && other.target.parentId === plan.source.parentId);
      if (!resume || plan.targetSide !== resume.sourceSide) continue;
      const owner = map.get(plan.source.parentId);
      if (!owner) continue;
      plan.targetSide = center(plan.target).x <= center(owner).x ? "left" : "right";
    }
    for (const plan of plans) {
      if (["actor", "uml-provided-interface", "uml-required-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(plan.source.shape) && plan.sourceSide === "bottom" && !portSide(plan.edge.attributes?.fromPort)) {
        plan.sourceSide = "right";
        if (!portSide(plan.edge.attributes?.toPort)) plan.targetSide = "right";
      }
      if (["actor", "uml-provided-interface", "uml-required-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(plan.target.shape) && plan.targetSide === "bottom" && !portSide(plan.edge.attributes?.toPort)) {
        plan.targetSide = "right";
        if (!portSide(plan.edge.attributes?.fromPort)) plan.sourceSide = "right";
      }
    }
    for (const node of nodes.filter((node2) => node2.shape === "uml-required-interface")) {
      const plan = plans.find((plan2) => plan2.source.id !== plan2.target.id && (plan2.source === node || plan2.target === node));
      const side = plan ? plan.source === node ? plan.sourceSide : plan.targetSide : "top";
      const opposite = { left: "right", right: "left", top: "bottom", bottom: "top" };
      node.attributes = { ...node.attributes, interfaceOpening: opposite[side] };
    }
    const requestsByPort = /* @__PURE__ */ new Map();
    for (const plan of plans) {
      if (plan.edge.from === plan.edge.to) continue;
      const sourceTargetCenter = center(plan.target);
      const targetSourceCenter = center(plan.source);
      const requests = [
        { plan, endpoint: "source", node: plan.source, side: plan.sourceSide, sortValue: horizontalPort(plan.sourceSide) ? sourceTargetCenter.y : sourceTargetCenter.x },
        { plan, endpoint: "target", node: plan.target, side: plan.targetSide, sortValue: horizontalPort(plan.targetSide) ? targetSourceCenter.y : targetSourceCenter.x }
      ];
      for (const request of requests) {
        const key = `${request.node.id}:${request.side}:${request.node.shape === "container" ? "both" : request.endpoint}`;
        const group = requestsByPort.get(key) ?? [];
        group.push(request);
        requestsByPort.set(key, group);
      }
    }
    const allocatedPorts = /* @__PURE__ */ new Map();
    for (const requests of requestsByPort.values()) {
      requests.sort((a, b) => a.sortValue - b.sortValue || a.plan.edge.order - b.plan.edge.order);
      const centeredTargets = new Set(requests.filter((request) => (["flowchart", "activity", "graph"].includes(model.kind) || model.kind === "deployment" && !horizontalPort(request.side)) && request.endpoint === "target" && Math.abs(request.sortValue - (horizontalPort(request.side) ? center(request.node).y : center(request.node).x)) < 0.5));
      requests.forEach((request, index) => {
        const bundledSource = !["er", "slide", "class"].includes(model.kind) && (model.kind !== "state" || request.node.shape === "uml-bar" || Boolean(request.node.attributes.connectionPoint)) && request.endpoint === "source" && requests.length > 1;
        const count = requests.length + (centeredTargets.size && requests.length % 2 ? 1 : 0);
        allocatedPorts.set(
          `${request.plan.edge.id}:${request.endpoint}`,
          bundledSource || centeredTargets.has(request) ? portPoint(request.node, request.side, 0, 1) : portPoint(request.node, request.side, index, count)
        );
      });
    }
    if (model.kind === "deployment") for (const plan of plans) {
      const { source, target, sourceSide, targetSide } = plan;
      if (source.shape !== "container" || target.shape !== "container") continue;
      if (!(sourceSide === "bottom" && targetSide === "top" && source.y + source.height <= target.y || sourceSide === "top" && targetSide === "bottom" && target.y + target.height <= source.y)) continue;
      const occupiedSide = (node, side) => plans.filter((p) => p.source.id === node.id && p.sourceSide === side || p.target.id === node.id && p.targetSide === side).length;
      if (occupiedSide(source, sourceSide) !== 1 || occupiedSide(target, targetSide) !== 1) continue;
      const left = Math.max(source.x, target.x) + 18;
      const right = Math.min(source.x + source.width, target.x + target.width) - 18;
      if (left > right) continue;
      const x = (left + right) / 2;
      allocatedPorts.set(`${plan.edge.id}:source`, { x, y: source.y + (sourceSide === "bottom" ? source.height : 0) });
      allocatedPorts.set(`${plan.edge.id}:target`, { x, y: target.y + (targetSide === "bottom" ? target.height : 0) });
    }
    if (model.kind === "state") for (const plan of plans) {
      const reverse = plans.find((p) => p.edge.from === plan.edge.to && p.edge.to === plan.edge.from);
      if (!reverse || plan.source === plan.target || plan.edge.attributes?.fromPort || plan.edge.attributes?.toPort || reverse.edge.attributes?.fromPort || reverse.edge.attributes?.toPort) continue;
      if (!["top", "bottom"].includes(plan.sourceSide) || !["top", "bottom"].includes(plan.targetSide)) continue;
      if (Math.abs(center(plan.source).x - center(plan.target).x) > 0.5) continue;
      if (plans.filter((p) => p.source === plan.source && p.target === plan.target || p.source === plan.target && p.target === plan.source).length !== 2) continue;
      if (!["rounded", "uml-state"].includes(plan.source.shape) || !["rounded", "uml-state"].includes(plan.target.shape)) continue;
      const offset = plan.edge.order < reverse.edge.order ? -8 : 8;
      for (const endpoint of ["source", "target"]) {
        const n = plan[endpoint], side = endpoint === "source" ? plan.sourceSide : plan.targetSide;
        if (n.shape === "container" || n.attributes.connectionPoint) continue;
        const point = portPoint(n, side, 0, 1);
        point.x += offset;
        allocatedPorts.set(`${plan.edge.id}:${endpoint}`, point);
      }
    }
    for (const plan of plans) {
      for (const endpoint of ["source", "target"]) {
        const member = plan.edge.attributes?.[endpoint === "source" ? "fromMemberIndex" : "toMemberIndex"];
        const row = plan.edge.attributes?.[endpoint === "source" ? "fromMapRow" : "toMapRow"] ?? member;
        if (row === void 0) continue;
        const node = endpoint === "source" ? plan.source : plan.target;
        const side = endpoint === "source" ? plan.sourceSide : plan.targetSide;
        allocatedPorts.set(`${plan.edge.id}:${endpoint}`, { x: node.x + (side === "right" ? node.width : 0), y: member === void 0 ? node.y + 56 + Number(row) * 28 : annotationAnchor(node, member).y });
      }
    }
    const routedEdges = [];
    for (const plan of plans) {
      const { edge, source, target } = plan;
      const sourceCenter = center(source);
      let points;
      if (edge.from === edge.to && ((edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex) !== void 0 || (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex) !== void 0)) {
        const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, "right", 0, 1);
        const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, "right", 0, 1);
        points = [start, { x: source.x + source.width + 28, y: start.y }, { x: source.x + source.width + 28, y: end.y }, end];
      } else if (edge.from === edge.to && (portSide(edge.attributes?.fromPort) || portSide(edge.attributes?.toPort))) {
        const from = portSide(edge.attributes?.fromPort) ?? "right";
        const to = portSide(edge.attributes?.toPort) ?? "top";
        const start = portPoint(source, from, 0, from === to ? 2 : 1);
        const end = portPoint(source, to, from === to ? 1 : 0, from === to ? 2 : 1);
        const sides = ["top", "right", "bottom", "left"];
        const left = source.x - 28, right = source.x + source.width + 28;
        const top = source.y - 28, bottom = source.y + source.height + 28;
        const project = (point, side) => side === "left" ? { x: left, y: point.y } : side === "right" ? { x: right, y: point.y } : side === "top" ? { x: point.x, y: top } : { x: point.x, y: bottom };
        const corners = [{ x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }, { x: left, y: top }];
        const a = sides.indexOf(from), b = sides.indexOf(to);
        const clockwise = (b - a + 4) % 4;
        const perimeter = [project(start, from)];
        if (clockwise <= 2) {
          for (let step = 0; step < clockwise; step++) perimeter.push(corners[(a + step) % 4]);
        } else {
          for (let step = 0; step < 4 - clockwise; step++) perimeter.push(corners[(a - step + 3) % 4]);
        }
        perimeter.push(project(end, to));
        points = [start, ...perimeter, end];
      } else if (edge.from === edge.to && ["person", "actor", "uml-provided-interface", "uml-required-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(source.shape)) {
        const start = portPoint(source, "right", 0, 1);
        const end = portPoint(source, "top", 0, 1);
        const outside = source.x + source.width + 28;
        points = [start, { x: outside, y: start.y }, { x: outside, y: source.y - 18 }, { x: end.x, y: source.y - 18 }, end];
      } else if (edge.from === edge.to) {
        points = [
          { x: source.x + source.width, y: sourceCenter.y },
          { x: source.x + source.width + 28, y: sourceCenter.y },
          { x: source.x + source.width + 28, y: source.y - 18 },
          { x: sourceCenter.x, y: source.y - 18 },
          { x: sourceCenter.x, y: source.y }
        ];
      } else if (horizontalPort(plan.sourceSide) && horizontalPort(plan.targetSide)) {
        const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
        const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
        const sourceBundle = ["er", "slide"].includes(model.kind) ? 0 : requestsByPort.get(`${source.id}:${plan.sourceSide}:source`)?.length ?? 0;
        const middleX = plan.sourceSide === plan.targetSide ? plan.sourceSide === "right" ? Math.max(start.x, end.x) + 24 : Math.min(start.x, end.x) - 24 : sourceBundle > 1 && model.kind !== "deployment" ? start.x + (plan.sourceSide === "right" ? 24 : -24) : (start.x + end.x) / 2;
        points = [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
        if (((edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex) !== void 0 || (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex) !== void 0) && plan.sourceSide !== plan.targetSide && (plan.sourceSide === "left" ? end.x > start.x : end.x < start.x)) {
          const a = offsetPort(start, plan.sourceSide, 24), b = offsetPort(end, plan.targetSide, 24);
          const midY = source.y < target.y ? (source.y + source.height + target.y) / 2 : (target.y + target.height + source.y) / 2;
          points = [start, a, { x: a.x, y: midY }, { x: b.x, y: midY }, b, end];
        }
      } else if (!horizontalPort(plan.sourceSide) && !horizontalPort(plan.targetSide)) {
        const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
        const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
        const sourceBundle = ["er", "slide"].includes(model.kind) ? 0 : requestsByPort.get(`${source.id}:${plan.sourceSide}:source`)?.length ?? 0;
        const middleY = plan.sourceSide === plan.targetSide ? plan.sourceSide === "bottom" ? Math.max(start.y, end.y) + 24 : Math.min(start.y, end.y) - 24 : sourceBundle > 1 && model.kind !== "deployment" ? start.y + (plan.sourceSide === "bottom" ? 24 : -24) : (start.y + end.y) / 2;
        points = [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
      } else {
        const start = allocatedPorts.get(`${edge.id}:source`) ?? portPoint(source, plan.sourceSide, 0, 1);
        const end = allocatedPorts.get(`${edge.id}:target`) ?? portPoint(target, plan.targetSide, 0, 1);
        const startOutside = offsetPort(start, plan.sourceSide, 24);
        const endOutside = offsetPort(end, plan.targetSide, 24);
        points = horizontalPort(plan.sourceSide) ? [start, startOutside, { x: endOutside.x, y: startOutside.y }, endOutside, end] : [start, startOutside, { x: startOutside.x, y: endOutside.y }, endOutside, end];
        const corner = horizontalPort(plan.sourceSide) ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
        if (followsHeading(start, corner, routeHeading(start, startOutside)) && followsHeading(corner, end, routeHeading(endOutside, end))) points = [start, corner, end];
      }
      const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges, ROUTE_CLEARANCE, true, edge.attributes, model.kind) };
      routedEdges.push(routed);
    }
    return routedEdges;
  }
  function portSide(value) {
    const normalized = value?.toLowerCase();
    return normalized === "left" || normalized === "right" || normalized === "top" || normalized === "bottom" ? normalized : void 0;
  }
  function horizontalPort(side) {
    return side === "left" || side === "right";
  }
  function offsetPort(point, side, distance) {
    if (side === "left") return { x: point.x - distance, y: point.y };
    if (side === "right") return { x: point.x + distance, y: point.y };
    if (side === "top") return { x: point.x, y: point.y - distance };
    return { x: point.x, y: point.y + distance };
  }
  function portPoint(node, side, index, count) {
    if (node.shape === "usecase") {
      const offset = (index + 1) / (count + 1) * 2 - 1;
      const radius = Math.sqrt(Math.max(0, 1 - offset * offset));
      return side === "left" || side === "right" ? { x: node.x + node.width / 2 * (1 + (side === "left" ? -radius : radius)), y: node.y + node.height / 2 * (1 + offset) } : { x: node.x + node.width / 2 * (1 + offset), y: node.y + node.height / 2 * (1 + (side === "top" ? -radius : radius)) };
    }
    if (node.shape === "actor") return {
      x: node.x + node.width / 2 + (side === "left" ? -16 : side === "right" ? 16 : side === "bottom" ? 12 : 0),
      y: node.y + (side === "top" ? 2 : side === "bottom" ? 56 : 40)
    };
    if (node.shape === "person") {
      const fraction = (index + 1) / (count + 1);
      const headOffset = 16 * (2 * fraction - 1);
      return {
        x: node.x + (side === "left" ? 0 : side === "right" ? node.width : side === "bottom" ? 16 + (node.width - 32) * fraction : node.width / 2 + headOffset),
        y: node.y + (side === "top" ? 16 - Math.sqrt(256 - headOffset * headOffset) : side === "bottom" ? node.height : 48 + (node.height - 64) * fraction)
      };
    }
    if (node.shape === "process" || node.shape === "container" && node.attributes.containerStyle === "process") {
      const fraction = (index + 1) / (count + 1);
      if (side === "top" || side === "bottom") return { x: node.x + (node.width - 12) * fraction, y: node.y + (side === "bottom" ? node.height : 0) };
      const y = node.height * fraction;
      const inset = 12 * (1 - Math.abs(2 * fraction - 1));
      return { x: node.x + (side === "left" ? inset : node.width - 12 + inset), y: node.y + y };
    }
    if (node.shape === "uml-node" || node.shape === "uml-device" || node.shape === "container" && node.attributes.containerStyle === "node") {
      const depth = node.shape === "uml-device" ? 12 : 10;
      const fraction = (index + 1) / (count + 1);
      if (side === "left" || side === "right") return {
        x: node.x + (side === "right" ? node.width : 0),
        y: node.y + depth + (node.height - depth * 2) * fraction
      };
      return {
        x: node.x + depth + (node.width - depth * 2) * fraction,
        y: node.y + (side === "bottom" ? node.height : 0)
      };
    }
    if (node.shape === "uml-port") return { x: node.x + node.width / 2 + (side === "left" ? -11 : side === "right" ? 11 : 0), y: node.y + (side === "top" ? 2 : side === "bottom" ? 24 : 13) };
    if (node.shape === "uml-required-interface") return requiredInterfacePort(node, side);
    if (["sequence-boundary", "sequence-control", "sequence-entity"].includes(node.shape)) return {
      x: node.x + node.width / 2 + (side === "left" ? node.shape === "sequence-boundary" ? -30 : -18 : side === "right" ? 18 : side === "top" && node.shape === "sequence-control" ? 10 : 0),
      y: node.y + (side === "top" ? node.shape === "sequence-control" ? 30 - Math.sqrt(224) : 12 : side === "bottom" ? node.shape === "sequence-entity" ? 52 : 48 : 30)
    };
    if (node.shape === "uml-provided-interface") return {
      x: node.x + node.width / 2 + (side === "left" ? -10 : side === "right" ? 10 : 0),
      y: node.y + 14 + (side === "top" ? -10 : side === "bottom" ? 10 : 0)
    };
    if (node.shape === "signal-send" || node.shape === "signal-receive") {
      if (side === "top" || side === "bottom") return { x: node.x + node.width / 2, y: node.y + (side === "bottom" ? node.height : 0) };
      const y = node.height * (index + 1) / (count + 1);
      const notch = 20 * (1 - Math.abs(2 * y / node.height - 1));
      const mirrored = node.attributes.facing === "left";
      const localSide = mirrored ? side === "left" ? "right" : "left" : side;
      const x = localSide === "left" ? node.shape === "signal-receive" ? notch : 0 : node.width - (node.shape === "signal-send" ? 20 - notch : 0);
      return { x: node.x + (mirrored ? node.width - x : x), y: node.y + y };
    }
    if (["diamond", "circle", "initial-state", "final-state", "junction-state"].includes(node.shape)) {
      return {
        x: side === "left" ? node.x : side === "right" ? node.x + node.width : node.x + node.width / 2,
        y: side === "top" ? node.y : side === "bottom" ? node.y + node.height : node.y + node.height / 2
      };
    }
    if (side === "left" || side === "right") {
      const margin2 = Math.min(8, node.height * 0.15);
      const usable2 = Math.max(0, node.height - margin2 * 2);
      return {
        x: side === "left" ? node.x : node.x + node.width,
        y: node.y + margin2 + usable2 * ((index + 1) / (count + 1))
      };
    }
    const margin = Math.min(10, node.width * 0.12);
    const usable = Math.max(0, node.width - margin * 2);
    return {
      x: node.x + margin + usable * ((index + 1) / (count + 1)),
      y: side === "top" ? node.y : node.y + node.height
    };
  }
  function dimensions(nodes, groups = []) {
    const all = [...nodes, ...groups];
    return {
      width: Math.max(320, ...all.map((node) => node.x + node.width + CANVAS_PADDING)),
      height: Math.max(220, ...all.map((node) => node.y + node.height + CANVAS_PADDING))
    };
  }
  function arrangeStateJoinSections(nodes, model) {
    if (model.kind !== "state") return;
    const nodeMap = byId(nodes);
    const outgoing = new Map(nodes.map((node) => [node.id, model.connections.filter((edge) => edge.from === node.id)]));
    const incoming = new Map(nodes.map((node) => [node.id, model.connections.filter((edge) => edge.to === node.id)]));
    const forks = nodes.filter((node) => node.shape === "uml-bar" && (outgoing.get(node.id)?.length ?? 0) > 1);
    const joins = nodes.filter((node) => node.shape === "uml-bar" && (incoming.get(node.id)?.length ?? 0) > 1);
    const reachable = (start, goal) => {
      const pending = [start];
      const visited = /* @__PURE__ */ new Set();
      while (pending.length) {
        const current = pending.shift();
        if (!current || visited.has(current)) continue;
        if (current === goal) return true;
        visited.add(current);
        pending.push(...(outgoing.get(current) ?? []).map((edge) => edge.to));
      }
      return false;
    };
    for (const fork of forks) {
      const branchStarts = (outgoing.get(fork.id) ?? []).map((edge) => edge.to);
      const join = joins.find((candidate) => branchStarts.every((start) => reachable(start, candidate.id)));
      if (!join) continue;
      const between = nodes.filter((node) => node.id !== fork.id && node.id !== join.id && reachable(fork.id, node.id) && reachable(node.id, join.id));
      const distance = /* @__PURE__ */ new Map([[fork.id, 0]]);
      const pending = [fork.id];
      while (pending.length) {
        const current = pending.shift();
        if (!current) continue;
        const nextDistance = (distance.get(current) ?? 0) + 1;
        for (const edge of outgoing.get(current) ?? []) {
          if (edge.to === join.id || !between.some((node) => node.id === edge.to)) continue;
          if (nextDistance < (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
            distance.set(edge.to, nextDistance);
            pending.push(edge.to);
          }
        }
      }
      const itemGap = Math.max(52, model.minimumGap + 8);
      const rankGap = Math.max(58, model.minimumGap + 14);
      const predecessors = (incoming.get(fork.id) ?? []).map((edge) => nodeMap.get(edge.from)).filter((node) => Boolean(node));
      const predecessor = predecessors.length === 1 ? predecessors[0] : void 0;
      const centerX = predecessor ? predecessor.x + predecessor.width / 2 : fork.x + fork.width / 2;
      if (predecessor) {
        fork.x = centerX - fork.width / 2;
        fork.y = predecessor.y + predecessor.height + rankGap;
      }
      let y = fork.y + fork.height + rankGap;
      const ranksInSection = [...new Set(between.map((node) => distance.get(node.id) ?? 1))].sort((a, b) => a - b);
      for (const rank of ranksInSection) {
        const row = model.items.filter((item) => between.some((node) => node.id === item.id) && (distance.get(item.id) ?? 1) === rank).map((item) => nodeMap.get(item.id)).filter((node) => Boolean(node));
        const rowWidth = row.reduce((sum, node) => sum + node.width, 0) + Math.max(0, row.length - 1) * itemGap;
        const rowHeight = Math.max(...row.map((node) => node.height));
        let x = centerX - rowWidth / 2;
        for (const node of row) {
          node.x = x;
          node.y = y + (rowHeight - node.height) / 2;
          x += node.width + itemGap;
        }
        y += rowHeight + rankGap;
      }
      join.x = centerX - join.width / 2;
      join.y = y;
      y += join.height + rankGap;
      const successors = (outgoing.get(join.id) ?? []).map((edge) => nodeMap.get(edge.to)).filter((node) => Boolean(node));
      if (successors.length === 1 && (incoming.get(successors[0].id)?.length ?? 0) === 1) {
        const successor = successors[0];
        successor.x = centerX - successor.width / 2;
        successor.y = y;
      }
    }
  }
  var baseHierarchicalLayout = {
    name: "hierarchical",
    layout(model, context2) {
      if (["component", "deployment"].includes(model.kind) && model.direction === "down") {
        return model.items.some((item) => item.shape === "container") ? layoutUmlHierarchy(model, context2) : layoutVerticalDirected(model, context2);
      }
      const nodes = arrangeDeployment(model);
      arrangeContainerContents(nodes, model);
      fitContainers(nodes);
      arrangeNestedContainerContents(nodes, model);
      packTopLevelGroups(nodes, model);
      if (model.kind === "deployment") {
        const roots = nodes.filter((n) => !n.parentId);
        if (roots.every((n) => n.shape === "container")) arrangeSharedBlocks(roots, model, (id) => {
          let n = nodes.find((n2) => n2.id === id);
          while (n?.parentId) n = nodes.find((p) => p.id === n.parentId);
          return n?.id;
        }, (id, x, y) => {
          const root = nodes.find((n) => n.id === id), dx = x - root.x, dy = y - root.y;
          for (const n of nodes) {
            let p = n;
            while (p && p.id !== id) p = nodes.find((a) => a.id === p.parentId);
            if (p) {
              n.x += dx;
              n.y += dy;
            }
          }
        }, (id, direction) => {
          const root = nodes.find((n) => n.id === id), children = nodes.filter((n) => n.parentId === id);
          if (children.some((n) => n.shape === "container" || n.attributes.order || n.attributes.row || n.attributes.column || n.attributes.place)) return;
          let x = root.x + 28, y = root.y + (root.headerHeight ?? 32) + 28;
          for (const n of [...children].sort((a, b) => a.x - b.x || a.y - b.y)) {
            n.x = x;
            n.y = y;
            if (direction === "row") x += n.width + 80;
            else y += n.height + 80;
          }
          resetContainerSize(root, model);
          fitContainer(root, nodes);
        });
        const arrange = () => arrangeThreeBlocks(roots, model, (id) => {
          let n = nodes.find((n2) => n2.id === id);
          while (n?.parentId) n = nodes.find((p) => p.id === n.parentId);
          return n?.id;
        }, (id, x, y) => {
          const root = nodes.find((n) => n.id === id), dx = x - root.x, dy = y - root.y;
          for (const n of nodes) {
            let p = n;
            while (p && p.id !== id) p = nodes.find((a) => a.id === p.parentId);
            if (p) {
              n.x += dx;
              n.y += dy;
            }
          }
        });
        if (roots.every((n) => n.shape === "container") && arrange()) {
          const receiver = [...roots].sort((a, b) => b.x - a.x)[0];
          const children = nodes.filter((n) => n.parentId === receiver.id);
          if (children.length > 1 && children.every((n) => n.shape !== "container" && !n.attributes.order && !n.attributes.row && !n.attributes.column && !n.attributes.place)) {
            const x = receiver.x + 28;
            let y = receiver.y + (receiver.headerHeight ?? 32) + 28;
            for (const n of [...children].sort((a, b) => a.x - b.x || a.y - b.y)) {
              n.x = x;
              n.y = y;
              y += n.height + 80;
            }
            resetContainerSize(receiver, model);
            fitContainer(receiver, nodes);
            arrange();
          }
        }
      }
      arrangeStateJoinSections(nodes, model);
      if (model.kind === "usecase") {
        for (const edge of model.connections.filter((edge2) => edge2.attributes?.relation === "inheritance")) {
          const child = nodes.find((node) => node.id === edge.from && node.shape === "actor");
          const parent = nodes.find((node) => node.id === edge.to && node.shape === "actor");
          if (!child || !parent) continue;
          if (nodes.some((node) => node !== parent && node.shape === "actor" && Math.abs(node.y - parent.y) < 24 && node.x < parent.x)) {
            const y2 = parent.y + 48;
            if (!nodes.some((node) => node !== parent && node.shape !== "container" && node.parentId === parent.parentId && parent.x < node.x + node.width + 16 && parent.x + parent.width + 16 > node.x && y2 < node.y + node.height + 24 && y2 + parent.height + 24 > node.y)) parent.y = y2;
          }
          if (Math.abs(child.y - parent.y) >= 48) continue;
          let y = parent.y + 48;
          for (let attempt = 0; attempt < nodes.length; attempt++) {
            const obstacle = nodes.find((node) => node !== child && node.shape !== "container" && node.parentId === child.parentId && child.x < node.x + node.width + 16 && child.x + child.width + 16 > node.x && y < node.y + node.height + 24 && y + child.height + 24 > node.y);
            if (!obstacle) break;
            y = obstacle.y + obstacle.height + 24;
          }
          child.y = y;
        }
      }
      applyContinuity(nodes, context2);
      fitContainers(nodes.filter((node) => !context2.overlay.nodes[node.id]?.manual || node.shape !== "container"));
      const edges = routeDeployment(nodes, model);
      return { kind: model.kind, direction: model.direction, nodes, edges, groups: [], ...dimensions(nodes) };
    }
  };
  var hierarchicalLayout = {
    ...baseHierarchicalLayout,
    layout(model, context2) {
      const ports = model.items.filter((item) => item.attributes.boundaryPort === "true" && item.parentId);
      const owners = new Map(ports.map((port) => [port.id, port.parentId]));
      const layoutModel = ports.length ? { ...model, items: model.items.filter((item) => !owners.has(item.id)).map((item) => {
        const incoming = ports.filter((port) => port.parentId === item.id && port.attributes.portDirection !== "out");
        if (model.direction !== "down" || !incoming.length) return item;
        const headerHeight = Math.max(item.size.headerHeight ?? 42, ...incoming.map((port) => port.size.height + 3));
        return { ...item, size: { ...item.size, headerHeight, height: Math.max(item.size.height, headerHeight + 26) } };
      }), connections: model.connections.map((edge) => ({ ...edge, from: owners.get(edge.from) ?? edge.from, to: owners.get(edge.to) ?? edge.to })) } : model;
      const geometry = baseHierarchicalLayout.layout(layoutModel, context2);
      if (ports.length) {
        for (const { size, ...port } of ports) geometry.nodes.push({ ...port, ...size, x: 0, y: 0 });
        geometry.edges = routeDeployment(geometry.nodes, model);
        separateSiblingBlocks(geometry.nodes, model, context2);
        geometry.edges = routeDeployment(geometry.nodes, model);
        Object.assign(geometry, dimensions(geometry.nodes));
      }
      if (!model.connections.some((edge) => edge.attributes?.layoutDirection)) return geometry;
      const nodes = geometry.nodes, map = byId(nodes);
      const locked = (node) => Boolean(context2.overlay.nodes[node.id] && (!context2.force || context2.preservePinned && context2.overlay.nodes[node.id].pinned));
      const ancestry = (node) => {
        const path = [node], seen = /* @__PURE__ */ new Set([node.id]);
        while (path[0].parentId) {
          const parent = map.get(path[0].parentId);
          if (!parent || seen.has(parent.id)) break;
          path.unshift(parent);
          seen.add(parent.id);
        }
        return path;
      };
      const subtree = (root) => nodes.filter((node) => ancestry(node).some((parent) => parent.id === root.id));
      for (const axis of ["x", "y"]) {
        const constraints = [];
        for (const edge of model.connections) {
          const direction = edge.attributes?.layoutDirection;
          if (!direction || axis === "x" !== ["left", "right"].includes(direction)) continue;
          const from = map.get(edge.attributes.layoutFrom), to = map.get(edge.attributes.layoutTo);
          if (!from || !to || from.id === to.id) continue;
          const fromPath = ancestry(from), toPath = ancestry(to);
          let common = 0;
          while (common < fromPath.length && common < toPath.length && fromPath[common].id === toPath[common].id) common++;
          if (common === fromPath.length || common === toPath.length) continue;
          const source = fromPath[common], target = toPath[common];
          const constraint = ["left", "up"].includes(direction) ? { before: target, after: source } : { before: source, after: target };
          const pending = [constraint.after.id], seen = /* @__PURE__ */ new Set();
          while (pending.length) {
            const id = pending.pop();
            if (seen.has(id)) continue;
            seen.add(id);
            pending.push(...constraints.filter((c) => c.before.id === id).map((c) => c.after.id));
          }
          if (!seen.has(constraint.before.id)) constraints.push(constraint);
        }
        for (let pass = 0; pass < nodes.length; pass++) {
          let changed = false;
          for (const { before, after } of constraints) {
            const moving = subtree(after);
            if (moving.some(locked)) continue;
            const minimum = before[axis] + (axis === "x" ? before.width : before.height) + Math.max(36, model.minimumGap ?? 36);
            if (after[axis] < minimum) {
              const delta = minimum - after[axis];
              changed = true;
              for (const node of moving) node[axis] += delta;
            }
          }
          if (!changed) break;
        }
      }
      fitContainers(nodes);
      if (nodes.length && !nodes.some(locked)) {
        const dx = Math.min(...nodes.map((node) => node.x)) - CANVAS_PADDING;
        const dy = Math.min(...nodes.map((node) => node.y)) - CANVAS_PADDING;
        for (const node of nodes) {
          node.x -= dx;
          node.y -= dy;
        }
      }
      geometry.edges = routeDeployment(nodes, model);
      return { ...geometry, ...dimensions(nodes) };
    }
  };
  var compactLayout = {
    name: "compact",
    layout(model, context2) {
      const normal = model.items.filter((item) => item.shape !== "container");
      const columns = Math.max(1, Math.ceil(Math.sqrt(normal.length)));
      const cellWidth = Math.max(150, ...normal.map((item) => item.size.width)) + 42;
      const cellHeight = Math.max(70, ...normal.map((item) => item.size.height)) + 34;
      const nodes = normal.map((item, index) => ({
        id: item.id,
        label: item.label,
        shape: item.shape,
        ...item.parentId ? { parentId: item.parentId } : {},
        attributes: item.attributes,
        x: CANVAS_PADDING + index % columns * cellWidth,
        y: CANVAS_PADDING + Math.floor(index / columns) * cellHeight,
        ...item.size
      }));
      for (const item of model.items.filter((candidate) => candidate.shape === "container")) {
        nodes.push({ id: item.id, label: item.label, shape: item.shape, attributes: item.attributes, ...item.parentId ? { parentId: item.parentId } : {}, x: CANVAS_PADDING, y: CANVAS_PADDING, ...item.size });
      }
      fitContainers(nodes);
      applyContinuity(nodes, context2);
      const edges = routeDeployment(nodes, model);
      return { kind: model.kind, nodes, edges, groups: [], ...dimensions(nodes) };
    }
  };
  var sequenceLayout = {
    name: "sequence",
    layout(model, context2) {
      const diagramText = measureDiagramText(model.diagramText, model.labelFontSize, model.labelFontFamily);
      const headerY = 26 + diagramText.top;
      const laneGap = Math.max(154, ...model.items.map((item) => item.size.width + 54));
      const nodes = model.items.map((item, index) => ({
        id: item.id,
        label: item.label,
        shape: item.shape,
        attributes: item.attributes,
        x: CANVAS_PADDING + index * laneGap,
        y: headerY,
        ...item.size
      }));
      applyContinuity(nodes, context2);
      if (diagramText.top) for (const node of nodes) node.y = Math.max(headerY, node.y);
      const map = byId(nodes);
      const messageLabelHeight = (edge) => {
        const source = map.get(edge.from) ?? (edge.attributes?.external === "incoming" ? map.get(edge.to) : void 0);
        const target = map.get(edge.to) ?? (edge.attributes?.external === "outgoing" ? map.get(edge.from) : void 0);
        const fromX = edge.attributes?.external === "incoming" ? edge.attributes.externalSide === "right" ? Math.max(...nodes.map((n) => n.x + n.width)) + 24 : Math.min(...nodes.map((n) => n.x)) - 24 : source ? center(source).x : 0;
        const toX = edge.attributes?.external === "outgoing" ? edge.attributes.externalSide === "left" ? Math.min(...nodes.map((n) => n.x)) - 24 : Math.max(...nodes.map((n) => n.x + n.width)) + 24 : target ? center(target).x : 0;
        const available = source && target ? Math.max(48, Math.abs(fromX - toX) - 24) : 180;
        return labelLayout(edge.label ?? "", Math.min(wrapWidth(edge.attributes, 180), available), model.labelFontSize ?? 12).height;
      };
      const groupHeaderHeight = (group) => labelLayout(group.kind && group.kind !== "group" ? `${group.kind} \xB7 ${group.label}` : group.label, 216, model.labelFontSize ?? 12).height + 16;
      const firstMessageY = Math.max(...nodes.map((node) => node.y + node.height)) + Math.max(58, (model.connections[0] ? messageLabelHeight(model.connections[0]) : 0) + 30) + Math.max(0, ...model.groups.map(groupHeaderHeight));
      const messageGap = 52;
      let messageY = firstMessageY;
      const frameTops = /* @__PURE__ */ new Map();
      const frameBottoms = /* @__PURE__ */ new Map();
      const branchPositions = /* @__PURE__ */ new Map();
      const edges = model.connections.flatMap((edge, index) => {
        const source = map.get(edge.from) ?? (edge.attributes?.external === "incoming" ? map.get(edge.to) : void 0);
        const target = map.get(edge.to) ?? (edge.attributes?.external === "outgoing" ? map.get(edge.from) : void 0);
        if (!source || !target) return [];
        for (const group of model.groups) {
          const branch = group.branches?.find((branch2) => branch2.start === index);
          if (!branch) continue;
          const positions = branchPositions.get(group.id) ?? [];
          positions.push({ y: messageY, label: branch.label });
          branchPositions.set(group.id, positions);
          messageY += labelLayout(branch.label, 216, model.labelFontSize ?? 12).height + 36;
        }
        for (const group of model.groups.filter((group2) => group2.start === index)) {
          frameTops.set(group.id, messageY);
          messageY += groupHeaderHeight(group) + 12;
        }
        messageY += model.groups.some((group) => group.start === index) ? messageLabelHeight(edge) + 12 : 0;
        const fragment = ["ref", "delay", "divider", "note"].includes(edge.attributes?.messageKind ?? "");
        const fragmentNodes = nodes.filter((n) => (edge.attributes?.participants ?? "").split(",").includes(n.id));
        const fragmentWidth = sequenceFragmentSpan(fragmentNodes, edge.attributes?.messageKind).width;
        const fragmentHeight = fragment ? Math.max(36, labelLayout(edge.attributes?.fragmentLabel ?? "", Math.max(40, fragmentWidth - 52), model.labelFontSize ?? 12, model.labelFontFamily).lines.length * 16 + 22) : 0;
        const y = messageY;
        const nextMessage = model.connections[index + 1];
        const fromX = edge.attributes?.external === "incoming" ? edge.attributes.externalSide === "right" ? Math.max(...nodes.map((n) => n.x + n.width)) + 24 : Math.min(...nodes.map((n) => n.x)) - 24 : source.x + source.width / 2;
        const toX = edge.attributes?.external === "outgoing" ? edge.attributes.externalSide === "left" ? Math.min(...nodes.map((n) => n.x)) - 24 : Math.max(...nodes.map((n) => n.x + n.width)) + 24 : target.x + target.width / 2;
        const receiveOffset = Number(edge.attributes?.receiveOffset ?? 0);
        messageY += receiveOffset + Math.max(messageGap, (nextMessage ? messageLabelHeight(nextMessage) : 0) + 24 + (fromX === toX ? 28 : 0));
        const points = fromX === toX ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 + receiveOffset }, { x: fromX, y: y + 28 + receiveOffset }] : [{ x: fromX, y }, { x: toX, y: y + receiveOffset }];
        messageY = Math.max(messageY, y + fragmentHeight + 24);
        let frameBottom = y + receiveOffset + Math.max(fragmentHeight, fromX === toX ? 28 : 0) + 18;
        for (const group of [...model.groups].reverse().filter((group2) => group2.end === index)) {
          frameBottoms.set(group.id, frameBottom);
          frameBottom += 12;
        }
        messageY = Math.max(messageY, frameBottom + 16);
        return [{ ...edge, ...fragment ? { attributes: { ...edge.attributes, fragmentHeight: String(fragmentHeight), fragmentFontSize: String(model.labelFontSize ?? 12), fragmentFontFamily: model.labelFontFamily ?? "" } } : {}, points }];
      });
      const bottom = messageY + 30;
      for (const node of nodes) {
        const events = JSON.parse(node.attributes.sequenceEvents ?? "[]");
        const positioned = events.map((event) => ({ ...event, y: event.kind === "create" ? edges[event.at]?.points.slice(-1)[0]?.y ?? bottom - 24 : Math.max(firstMessageY - 24, ...edges[event.at - 1]?.points.map((point) => point.y) ?? [firstMessageY - 24]) }));
        node.attributes.sequencePositions = JSON.stringify(positioned);
        if (node.attributes.branchLifetime) for (const event of positioned.filter((e) => e.kind === "create")) {
          const arrival = edges[event.at];
          if (arrival?.to === node.id) {
            arrival.points[arrival.points.length - 1].x = arrival.points[0].x < node.x ? node.x : node.x + node.width;
            arrival.attributes = { ...arrival.attributes, messageKind: "create" };
          }
        }
        const created = positioned.find((event) => event.kind === "create");
        if (created && !node.attributes.branchLifetime) {
          node.y = created.y - node.height / 2;
          const arrival = edges[created.at];
          if (arrival?.to === node.id) {
            const end = arrival.points[arrival.points.length - 1];
            end.x = arrival.points[0].x < node.x ? node.x : node.x + node.width;
            arrival.attributes = { ...arrival.attributes, messageKind: "create" };
          }
        }
      }
      const noteSpans = edges.filter((edge) => edge.attributes?.messageKind === "note").map((edge) => sequenceFragmentSpan(nodes.filter((node) => (edge.attributes.participants ?? "").split(",").includes(node.id)), "note"));
      const frameDepth = (group) => model.groups.filter((other) => other !== group && other.start <= group.start && other.end >= group.end && model.groups.indexOf(other) < model.groups.indexOf(group)).length;
      const framePadding = 14 + Math.max(0, ...model.groups.map(frameDepth)) * 6;
      const groups = model.groups.map((group) => {
        const headerHeight = groupHeaderHeight(group);
        const top = frameTops.get(group.id) ?? firstMessageY;
        const depth = frameDepth(group);
        const left = Math.min(...nodes.map((node) => node.x), ...noteSpans.map((span) => span.x)) - framePadding + depth * 6;
        const right = Math.max(...nodes.map((node) => node.x + node.width), ...noteSpans.map((span) => span.x + span.width)) + framePadding - depth * 6;
        return {
          id: group.id,
          label: group.label,
          ...group.kind ? { kind: group.kind } : {},
          headerHeight,
          ...branchPositions.has(group.id) ? { branches: branchPositions.get(group.id) } : {},
          x: left,
          y: top,
          width: right - left,
          height: (frameBottoms.get(group.id) ?? top + headerHeight + 24) - top
        };
      });
      return {
        kind: model.kind,
        nodes,
        edges,
        groups,
        width: Math.max(320, ...nodes.map((node) => node.x + node.width + CANVAS_PADDING), ...groups.map((group) => group.x + group.width + CANVAS_PADDING)) + sequenceDurationWidth(edges),
        ...diagramText.blocks.length ? { diagramText } : {},
        ...model.pageBreaks ? { pageBreaks: model.pageBreaks } : {},
        height: Math.max(240, bottom + CANVAS_PADDING) + diagramText.bottom + Math.max(0, ...nodes.filter((node) => node.attributes.footbox === "true").map((node) => node.height + 40))
      };
    }
  };
  function layoutVerticalDirected(model, context2, includeContainers = false) {
    const rankById = ranks(model);
    const itemGap = Math.max(64, model.minimumGap + 20);
    const rankGap = Math.max(72, model.minimumGap + 28);
    const rows = orderedLayers(model, rankById);
    const rowWidths = rows.map((items) => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap);
    const contentWidth = Math.max(420, ...rowWidths, 0);
    const nodes = [];
    let y = CANVAS_PADDING;
    rows.forEach((items, rowIndex) => {
      const rowHeight = Math.max(...items.map((item) => item.size.height));
      let x = CANVAS_PADDING + (contentWidth - (rowWidths[rowIndex] ?? 0)) / 2;
      for (const item of items) {
        nodes.push({
          id: item.id,
          label: item.label,
          shape: item.shape,
          ...item.parentId ? { parentId: item.parentId } : {},
          attributes: item.attributes,
          x,
          y: y + (rowHeight - item.size.height) / 2,
          ...item.size
        });
        x += item.size.width + itemGap;
      }
      const outgoing = model.connections.filter((edge) => items.some((item) => item.id === edge.from));
      const crowded = outgoing.length > items.length || outgoing.some((edge) => edge.label);
      const labelHeight = Math.max(0, ...outgoing.map((edge) => labelLayout(edge.label ?? "", wrapWidth(edge.attributes, 180), model.labelFontSize ?? 12).height));
      y += rowHeight + (crowded ? Math.max(rankGap + 16, labelHeight + 32) : Math.max(44, model.minimumGap + 12));
    });
    alignLayers(nodes, rows, model, itemGap);
    arrangeStateAxis(nodes, model);
    arrangeStateCycles(nodes, model);
    if (includeContainers) {
      for (const item of model.items.filter((candidate) => candidate.shape === "container")) {
        nodes.push({
          id: item.id,
          label: item.label,
          shape: item.shape,
          ...item.parentId ? { parentId: item.parentId } : {},
          attributes: item.attributes,
          x: CANVAS_PADDING,
          y: CANVAS_PADDING,
          ...item.size
        });
      }
      fitContainers(nodes);
    }
    applyContinuity(nodes, context2);
    if (includeContainers) {
      fitContainers(nodes.filter((node) => !context2.overlay.nodes[node.id]?.manual || node.shape !== "container"));
      separateSiblingBlocks(nodes, model, context2);
    }
    const edges = routeDeployment(nodes, model);
    const size = dimensions(nodes);
    return {
      kind: model.kind,
      direction: model.direction,
      nodes,
      edges,
      groups: [],
      width: Math.max(contentWidth + CANVAS_PADDING * 2, size.width),
      height: Math.max(320, y - rankGap + CANVAS_PADDING, size.height)
    };
  }
  var flowchartLayout = {
    name: "flowchart",
    layout(model, context2) {
      return layoutVerticalDirected(model, context2);
    }
  };
  var graphLayout = {
    name: "graph",
    layout(model, context2) {
      if (model.kind === "state" && model.items.some((item) => item.shape === "container" || item.attributes.connectionPoint && item.parentId)) return layoutUmlHierarchy(model, context2);
      if (model.direction === "right") return hierarchicalLayout.layout(model, context2);
      return layoutVerticalDirected(model, context2, true);
    }
  };
  function routeActivity(nodes, model) {
    if (nodes.some((node) => ["uml-provided-interface", "sequence-boundary", "sequence-control", "sequence-entity"].includes(node.shape)) || model.kind === "activity" || model.kind === "object" || model.kind === "class" || model.connections.some((edge) => edge.attributes?.fromPort !== void 0 || edge.attributes?.toPort !== void 0 || (edge.attributes?.fromMapRow ?? edge.attributes?.fromMemberIndex) !== void 0 || (edge.attributes?.toMapRow ?? edge.attributes?.toMemberIndex) !== void 0)) return routeDeployment(nodes, model);
    const map = byId(nodes);
    const routedEdges = [];
    for (const edge of model.connections) {
      const source = map.get(edge.from);
      const target = map.get(edge.to);
      if (!source || !target) continue;
      const sourceCenter = center(source);
      const targetCenter = center(target);
      const forward = targetCenter.y >= sourceCenter.y;
      const start = { x: sourceCenter.x, y: forward ? source.y + source.height : source.y };
      const end = { x: targetCenter.x, y: forward ? target.y : target.y + target.height };
      const points = Math.abs(start.x - end.x) < 0.5 ? [start, end] : [
        start,
        { x: start.x, y: forward ? Math.min(end.y - 22, start.y + 34) : Math.max(end.y + 22, start.y - 34) },
        { x: end.x, y: forward ? Math.min(end.y - 22, start.y + 34) : Math.max(end.y + 22, start.y - 34) },
        end
      ];
      const routed = { ...edge, points: chooseSmartRoute(points, source, target, nodes, routedEdges, ROUTE_CLEARANCE, true, edge.attributes, model.kind) };
      routedEdges.push(routed);
    }
    return routedEdges;
  }
  var activityLayout = {
    name: "activity",
    layout(model, context2) {
      if (model.items.some((item) => item.attributes.umlBlock === "lane")) return layoutSwimlanes(model, context2);
      const rankById = ranks(model);
      const rows = orderedLayers(model, rankById);
      const itemGap = 70;
      const rowWidths = rows.map((items) => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap);
      const contentWidth = Math.max(560, ...rowWidths);
      const canvasWidth = contentWidth + CANVAS_PADDING * 2;
      let y = CANVAS_PADDING;
      const nodes = [];
      rows.forEach((items, rowIndex) => {
        const rowHeight = Math.max(...items.map((item) => item.size.height));
        let x = CANVAS_PADDING + (contentWidth - (rowWidths[rowIndex] ?? 0)) / 2;
        for (const item of items) {
          nodes.push({
            id: item.id,
            label: item.label,
            shape: item.shape,
            attributes: item.attributes,
            x,
            y: y + (rowHeight - item.size.height) / 2,
            ...item.size
          });
          x += item.size.width + itemGap;
        }
        y += rowHeight + 58;
      });
      alignLayers(nodes, rows, model, itemGap);
      applyContinuity(nodes, context2);
      const edges = routeActivity(nodes, model);
      return { kind: model.kind, nodes, edges, groups: [], width: canvasWidth, height: Math.max(620, y - 30 + CANVAS_PADDING) };
    }
  };
  function structuralRankingModel(model) {
    if (model.kind !== "class" && model.kind !== "object") return model;
    const priority = (relation) => relation === "inheritance" || relation === "realization" ? 2 : relation === "composition" || relation === "aggregation" ? 1 : 0;
    return {
      ...model,
      connections: [...model.connections].sort((a, b) => priority(b.attributes?.relation) - priority(a.attributes?.relation)).map((edge) => priority(edge.attributes?.relation) === 2 ? { ...edge, from: edge.to, to: edge.from } : edge)
    };
  }
  var classLayout = {
    name: "class",
    layout(model, context2) {
      if (model.items.some((item) => item.shape === "container")) return layoutUmlHierarchy(model, context2);
      const remaining = new Set(model.items.map((item) => item.id));
      const components = [];
      while (remaining.size) {
        const component = /* @__PURE__ */ new Set();
        const pending = [remaining.values().next().value];
        while (pending.length) {
          const id = pending.pop();
          if (!remaining.delete(id)) continue;
          component.add(id);
          for (const edge of model.connections) {
            if (edge.from === id && remaining.has(edge.to)) pending.push(edge.to);
            if (edge.to === id && remaining.has(edge.from)) pending.push(edge.from);
          }
        }
        components.push(component);
      }
      if (components.length > 1 && model.connections.length) {
        const automatic = { overlay: { ...context2.overlay, nodes: {} }, force: true, preservePinned: false };
        const nodes2 = [];
        let x = CANVAS_PADDING, y2 = CANVAS_PADDING, rowHeight = 0;
        components.forEach((ids, index) => {
          const local = classLayout.layout({ ...model, items: model.items.filter((item) => ids.has(item.id)), connections: model.connections.filter((edge) => ids.has(edge.from) && ids.has(edge.to)), groups: [] }, automatic);
          const left = Math.min(...local.nodes.map((node) => node.x));
          const top = Math.min(...local.nodes.map((node) => node.y));
          const width = Math.max(...local.nodes.map((node) => node.x + node.width)) - left;
          const height = Math.max(...local.nodes.map((node) => node.y + node.height)) - top;
          if (index && index % 2 === 0) {
            x = CANVAS_PADDING;
            y2 += rowHeight + 68;
            rowHeight = 0;
          }
          nodes2.push(...local.nodes.map((node) => ({ ...node, x: node.x - left + x, y: node.y - top + y2 })));
          x += width + 68;
          rowHeight = Math.max(rowHeight, height);
        });
        applyContinuity(nodes2, context2);
        return { kind: model.kind, nodes: nodes2, edges: routeActivity(nodes2, model), groups: [], ...dimensions(nodes2) };
      }
      if (model.kind === "class") {
        const strong = /* @__PURE__ */ new Set(["inheritance", "realization", "composition", "aggregation"]);
        const structural = new Set(model.connections.filter((e) => strong.has(e.attributes?.relation ?? "")).flatMap((e) => [e.from, e.to]));
        const parents = new Map(model.items.map((item) => [item.id, item.id]));
        const root = (id) => {
          let current = id;
          while (parents.get(current) !== current) current = parents.get(current);
          return current;
        };
        for (const edge of model.connections) {
          if (!parents.has(edge.from) || !parents.has(edge.to)) continue;
          if (edge.attributes?.relation !== "dependency" || !structural.has(edge.from) && !structural.has(edge.to)) parents.set(root(edge.to), root(edge.from));
        }
        const families = /* @__PURE__ */ new Map();
        for (const item of model.items) {
          const key = root(item.id);
          const group = families.get(key) ?? /* @__PURE__ */ new Set();
          group.add(item.id);
          families.set(key, group);
        }
        const groups = [...families.values()];
        const strongGroups = groups.filter((ids) => model.connections.some((e) => ids.has(e.from) && ids.has(e.to) && strong.has(e.attributes?.relation ?? "")));
        const maximumFamilyColumns = 4;
        const familyColumnGap = 100;
        if (strongGroups.length >= 2) {
          const largest = [...strongGroups].sort((a, b) => b.size - a.size)[0];
          const consumers = groups.filter((ids) => ids.size === 1 && !strongGroups.includes(ids) && !model.connections.some((e) => ids.has(e.to) && !ids.has(e.from)) && strongGroups.filter((g) => model.connections.some((e) => ids.has(e.from) && g.has(e.to))).length >= 2);
          let ordered = groups.length > maximumFamilyColumns ? groups : [...strongGroups.filter((g) => g !== largest), largest, ...groups.filter((g) => !strongGroups.includes(g))];
          if (consumers.length && strongGroups.length <= maximumFamilyColumns) {
            const distanceCost = (order) => model.connections.reduce((cost, e) => {
              const from = order.findIndex((g) => g.has(e.from)), to = order.findIndex((g) => g.has(e.to));
              return cost + (from >= 0 && to >= 0 ? Math.abs(from - to) : 0);
            }, 0);
            let best = [...strongGroups], bestCost = distanceCost(best);
            const visit = (prefix, remaining2) => {
              if (!remaining2.length) {
                const cost = distanceCost(prefix);
                if (cost < bestCost) {
                  best = [...prefix];
                  bestCost = cost;
                }
                return;
              }
              for (const group of remaining2) visit([...prefix, group], remaining2.filter((g) => g !== group));
            };
            visit([], strongGroups);
            ordered = [...best, ...groups.filter((g) => !strongGroups.includes(g) && !consumers.includes(g))];
          }
          const below = consumers.filter((g) => !ordered.includes(g));
          const automatic = { overlay: { ...context2.overlay, nodes: {} }, force: true, preservePinned: false };
          const nodes2 = [];
          let x = CANVAS_PADDING, y2 = CANVAS_PADDING, rowHeight = 0;
          for (const [index, ids] of ordered.entries()) {
            const local = classLayout.layout({ ...model, items: model.items.filter((n) => ids.has(n.id)), connections: model.connections.filter((e) => ids.has(e.from) && ids.has(e.to)), groups: [] }, automatic);
            const left = Math.min(...local.nodes.map((n) => n.x)), top = Math.min(...local.nodes.map((n) => n.y));
            const width = Math.max(...local.nodes.map((n) => n.x + n.width)) - left;
            const height = Math.max(...local.nodes.map((n) => n.y + n.height)) - top;
            if (index && index % maximumFamilyColumns === 0) {
              x = CANVAS_PADDING;
              y2 += rowHeight + 100;
              rowHeight = 0;
            }
            nodes2.push(...local.nodes.map((n) => ({ ...n, x: n.x - left + x, y: n.y - top + y2 })));
            x += width + familyColumnGap;
            rowHeight = Math.max(rowHeight, height);
          }
          if (ordered.length > maximumFamilyColumns && ordered.length % maximumFamilyColumns) {
            const lastIds = new Set(ordered.slice(ordered.length - ordered.length % maximumFamilyColumns).flatMap((ids) => [...ids]));
            const last = nodes2.filter((n) => lastIds.has(n.id)), other = nodes2.filter((n) => !lastIds.has(n.id));
            const right = (list) => Math.max(...list.map((n) => n.x + n.width));
            const dx = (right(other) - right(last)) / 2;
            for (const n of last) n.x += dx;
          }
          for (const ids of below) {
            const item = model.items.find((n) => ids.has(n.id));
            const targets = nodes2.filter((n) => model.connections.some((e) => ids.has(e.from) && e.to === n.id));
            const top = Math.min(...targets.map((n) => n.y));
            const anchors = targets.filter((n) => n.y <= top + Math.max(...targets.map((n2) => n2.height)));
            const centerX = anchors.reduce((sum, n) => sum + n.x + n.width / 2, 0) / anchors.length;
            const x2 = Math.max(CANVAS_PADDING, centerX - item.size.width / 2);
            const overlaps2 = nodes2.filter((n) => n.x < x2 + item.size.width + 32 && n.x + n.width > x2 - 32);
            const y3 = Math.max(CANVAS_PADDING, ...overlaps2.map((n) => n.y + n.height)) + 68;
            nodes2.push({ ...item, ...item.size, x: x2, y: y3 });
          }
          if (below.length > 1 && strongGroups.length <= 4 && !model.connections.some((e) => e.attributes?.layoutDirection)) {
            const chain = nodes2.filter((n) => largest.has(n.id)).sort((a, b) => a.y - b.y || a.x - b.x);
            const chainEdges = model.connections.filter((e) => largest.has(e.from) && largest.has(e.to));
            const ranking = structuralRankingModel({ ...model, connections: chainEdges }).connections;
            if (chainEdges.length === chain.length - 1 && chain.every((n) => ranking.filter((e) => e.from === n.id).length <= 1 && ranking.filter((e) => e.to === n.id).length <= 1)) {
              const candidates = [false, true].map((horizontal) => {
                const candidate = nodes2.map((n) => ({ ...n }));
                let x2 = CANVAS_PADDING;
                for (const original of chain) {
                  const n = candidate.find((n2) => n2.id === original.id);
                  if (horizontal) {
                    n.x = x2;
                    n.y = CANVAS_PADDING;
                    x2 += n.width + 72;
                  }
                }
                const topNodes = candidate.filter((n) => largest.has(n.id));
                const topBottom = Math.max(...topNodes.map((n) => n.y + n.height));
                x2 = CANVAS_PADDING;
                for (const ids of ordered.filter((g) => g !== largest)) {
                  const members = candidate.filter((n) => ids.has(n.id));
                  const left = Math.min(...members.map((n) => n.x)), top = Math.min(...members.map((n) => n.y));
                  for (const n of members) {
                    n.x += x2 - left;
                    n.y += topBottom + 90 - top;
                  }
                  x2 = Math.max(...members.map((n) => n.x + n.width)) + 100;
                }
                const consumerIds = new Set(below.flatMap((g) => [...g]));
                const bottom = Math.max(...candidate.filter((n) => !consumerIds.has(n.id)).map((n) => n.y + n.height)) + 90;
                x2 = CANVAS_PADDING;
                for (const ids of below) {
                  const n = candidate.find((n2) => ids.has(n2.id));
                  n.x = x2;
                  n.y = bottom;
                  x2 += n.width + 100;
                }
                return candidate;
              });
              const supports = ordered.filter((g) => g !== largest);
              if (supports.length === 2 && below.length === 2 && supports.every((g) => g.size === 2)) {
                const outward = supports.filter((g) => model.connections.some((e) => g.has(e.from) && largest.has(e.to)));
                if (outward.length === 1) {
                  const candidate = nodes2.map((n) => ({ ...n })), leftGroup = outward[0], bottomGroup = supports.find((g) => g !== leftGroup);
                  let x2 = CANVAS_PADDING;
                  for (const original of chain) {
                    const n = candidate.find((n2) => n2.id === original.id);
                    n.x = x2;
                    n.y = CANVAS_PADDING;
                    x2 += n.width + 72;
                  }
                  const topBottom = Math.max(...candidate.filter((n) => largest.has(n.id)).map((n) => n.y + n.height));
                  const left = candidate.filter((n) => leftGroup.has(n.id)).sort((a, b) => Number(model.connections.some((e) => e.from === b.id && largest.has(e.to))) - Number(model.connections.some((e) => e.from === a.id && largest.has(e.to))));
                  let y3 = topBottom + 90;
                  for (const n of left) {
                    n.x = CANVAS_PADDING;
                    n.y = y3;
                    y3 += n.height + 80;
                  }
                  const innerX = CANVAS_PADDING + Math.max(...left.map((n) => n.width)) + 140;
                  const inner = candidate.find((n) => below[1].has(n.id));
                  inner.x = innerX;
                  inner.y = left[1].y;
                  const lowerY = Math.max(y3, inner.y + inner.height + 90);
                  const lower = candidate.find((n) => below[0].has(n.id));
                  lower.x = CANVAS_PADDING;
                  lower.y = lowerY;
                  const bottom = candidate.filter((n) => bottomGroup.has(n.id)).sort((a, b) => model.connections.filter((e) => e.to === b.id && !bottomGroup.has(e.from)).length - model.connections.filter((e) => e.to === a.id && !bottomGroup.has(e.from)).length);
                  x2 = innerX;
                  for (const n of bottom) {
                    n.x = x2;
                    n.y = lowerY;
                    x2 += n.width + 90;
                  }
                  candidates.push(candidate);
                }
              }
              const cost = (candidate) => model.connections.reduce((sum, e) => {
                const a = candidate.find((n) => n.id === e.from), b = candidate.find((n) => n.id === e.to);
                return sum + Math.abs(a.x + a.width / 2 - b.x - b.width / 2) + Math.abs(a.y + a.height / 2 - b.y - b.height / 2);
              }, 0);
              const best = candidates.sort((a, b) => cost(a) - cost(b))[0];
              for (const n of nodes2) {
                const chosen = best.find((c) => c.id === n.id);
                n.x = chosen.x;
                n.y = chosen.y;
              }
            }
          }
          applyContinuity(nodes2, context2);
          return { kind: model.kind, nodes: nodes2, edges: routeActivity(nodes2, model), groups: [], ...dimensions(nodes2) };
        }
        const fan = model.items.map((parent) => ({ parent, edges: model.connections.filter((e) => e.to === parent.id && ["inheritance", "realization"].includes(e.attributes?.relation ?? "")) })).find(({ edges: edges2 }) => new Set(edges2.map((e) => e.from)).size >= 3);
        if (fan) {
          const children = model.items.filter((n) => fan.edges.some((e) => e.from === n.id));
          const ids = /* @__PURE__ */ new Set([fan.parent.id, ...children.map((n) => n.id)]);
          const clients = model.items.filter((n) => !ids.has(n.id));
          if (model.connections.every((e) => fan.edges.includes(e) || clients.some((n) => n.id === e.from) && children.some((n) => n.id === e.to) && e.attributes?.relation === "dependency")) {
            const rows = [[fan.parent], children, clients].filter((row) => row.length);
            const nodes2 = [];
            let y2 = CANVAS_PADDING;
            for (const row of rows) {
              for (let offset = 0; offset < row.length; offset += 6) {
                const slice = row.slice(offset, offset + 6);
                let x = CANVAS_PADDING;
                for (const item of slice) {
                  nodes2.push({ ...item, ...item.size, x, y: y2 });
                  x += item.size.width + 58;
                }
                y2 += Math.max(...slice.map((n) => n.size.height)) + 110;
              }
            }
            applyContinuity(nodes2, context2);
            return { kind: model.kind, nodes: nodes2, edges: routeActivity(nodes2, model), groups: [], ...dimensions(nodes2) };
          }
        }
      }
      const rankingModel = structuralRankingModel(model);
      const rankById = ranks(rankingModel);
      const rankValues = [...new Set(rankById.values())].sort((a, b) => a - b);
      const itemGap = 58;
      const maximumColumns = 2;
      const rankRows = rankValues.map((rank) => {
        const items = model.items.filter((item) => rankById.get(item.id) === rank);
        const rows = [];
        for (let index = 0; index < items.length; index += maximumColumns) rows.push(items.slice(index, index + maximumColumns));
        return rows;
      });
      const rowWidth = (items) => items.reduce((sum, item) => sum + item.size.width, 0) + Math.max(0, items.length - 1) * itemGap;
      const contentWidth = Math.max(540, ...rankRows.flat().map(rowWidth));
      const canvasWidth = contentWidth + CANVAS_PADDING * 2;
      const nodes = [];
      let y = CANVAS_PADDING;
      rankRows.forEach((rows) => {
        rows.forEach((items, rowIndex) => {
          const height = Math.max(...items.map((item) => item.size.height));
          let x = CANVAS_PADDING + (contentWidth - rowWidth(items)) / 2;
          for (const item of items) {
            nodes.push({
              id: item.id,
              label: item.label,
              shape: item.shape,
              attributes: item.attributes,
              x,
              y: y + (height - item.size.height) / 2,
              ...item.size
            });
            x += item.size.width + itemGap;
          }
          y += height + (rowIndex === rows.length - 1 ? 68 : 30);
        });
      });
      applyContinuity(nodes, context2);
      const edges = routeActivity(nodes, model);
      return { kind: model.kind, nodes, edges, groups: [], width: canvasWidth, height: Math.max(620, y - 36 + CANVAS_PADDING) };
    }
  };
  function layoutUmlHierarchy(model, context2) {
    const itemMap = byId(model.items);
    const automatic = { overlay: { ...context2.overlay, nodes: {} }, force: true, preservePinned: false };
    const build = (parent) => {
      const children = model.items.filter((item) => item.parentId === parent && !(item.attributes.connectionPoint && item.parentId));
      const subtrees = /* @__PURE__ */ new Map();
      const blocks = children.map((item) => {
        if (item.shape !== "container") return item;
        const descendants = build(item.id);
        const memberInset = memberContainerInset(descendants.filter((node) => node.parentId === item.id));
        const extra = memberInset > 26 ? 24 : 0;
        for (const node of descendants) node.x += extra;
        subtrees.set(item.id, descendants);
        const size = { width: Math.max(0, ...descendants.map((node) => node.x + node.width)) + 28 + extra, height: Math.max(0, ...descendants.map((node) => node.y + node.height)) + 28 };
        const header2 = item.size.headerHeight ?? 32;
        return { ...item, shape: "rectangle", size: { width: Math.max(item.size.width, size.width), height: Math.max(item.size.height, size.height + header2), headerHeight: header2 } };
      });
      const branch = (id) => {
        let item = itemMap.get(id);
        while (item && item.parentId !== parent) item = item.parentId ? itemMap.get(item.parentId) : void 0;
        return item?.id;
      };
      const connections = model.connections.flatMap((edge) => {
        const from = branch(edge.from), to = branch(edge.to);
        return from && to && from !== to ? [{ ...edge, from, to }] : [];
      });
      const local = { ...model, items: blocks, connections, groups: [] };
      const regions = parent && children.length > 0 && children.every((item) => item.attributes.umlBlock === "region");
      const regionRows = regions && itemMap.get(parent)?.attributes.regions === "rows";
      const placed = regions ? blocks.map((item, index) => ({
        ...item,
        ...item.size,
        ...regionRows ? { width: Math.max(...blocks.map((b) => b.size.width)) } : { height: Math.max(...blocks.map((b) => b.size.height)) },
        attributes: { ...item.attributes, regionDivider: index ? "true" : "false", regionDirection: regionRows ? "rows" : "columns" },
        x: 28 + (regionRows ? 0 : blocks.slice(0, index).reduce((x, b) => x + b.size.width + 32, 0)),
        y: 28 + (regionRows ? blocks.slice(0, index).reduce((y, b) => y + b.size.height + 32, 0) : 0)
      })) : layoutVerticalDirected(structuralRankingModel(local), automatic).nodes;
      if (model.kind === "class" && children.every((item) => item.shape === "container")) {
        const move = (id, x, y) => {
          const n = placed.find((n2) => n2.id === id);
          n.x = x;
          n.y = y;
        };
        arrangeSharedBlocks(placed, model, branch, move, (id, direction) => {
          const members = subtrees.get(id) ?? [], block = placed.find((n) => n.id === id);
          if (members.some((n) => n.shape === "container" || n.attributes.order || n.attributes.row || n.attributes.column || n.attributes.place)) return;
          let x = 28, y = 28;
          const incomingHeight = (n) => {
            const sources = model.connections.filter((e) => e.to === n.id && branch(e.from) !== id).flatMap((e) => {
              const owner = placed.find((p) => p.id === branch(e.from));
              const source = owner && subtrees.get(owner.id)?.find((p) => p.id === e.from);
              return source && owner ? [owner.y + source.y] : [];
            });
            return sources.length ? sources.reduce((a, b) => a + b, 0) / sources.length : Infinity;
          };
          const sorted = direction === "row" ? [...members].sort((a, b) => incomingHeight(a) - incomingHeight(b)) : members;
          for (const n of sorted) {
            n.x = x;
            n.y = y;
            if (direction === "row") x += n.width + 64;
            else y += n.height + 64;
          }
          const minimum = itemMap.get(id).size;
          block.width = Math.max(minimum.width, ...members.map((n) => n.x + n.width + 28));
          block.height = Math.max(minimum.height, ...members.map((n) => n.y + n.height + 28 + (block.headerHeight ?? 32)));
        });
        arrangeThreeBlocks(placed, model, branch, move);
      }
      if (model.kind === "class" && children.length === 2 && children.every((item) => item.shape === "container") && connections.length > 0 && connections.every((edge) => edge.attributes?.relation === "dependency") && connections.every((edge) => edge.from === connections[0].from && edge.to === connections[0].to)) {
        const edge = model.connections.find((edge2) => branch(edge2.from) === connections[0].from && branch(edge2.to) === connections[0].to);
        const sourceBlock = placed.find((node) => node.id === branch(edge.from));
        const targetBlock = placed.find((node) => node.id === branch(edge.to));
        const source = subtrees.get(sourceBlock.id)?.find((node) => node.id === edge.from);
        const target = subtrees.get(targetBlock.id)?.find((node) => node.id === edge.to);
        if (source && target) {
          sourceBlock.x = 28;
          sourceBlock.y = 28;
          targetBlock.x = sourceBlock.x + sourceBlock.width + 64;
          targetBlock.y = sourceBlock.y + (sourceBlock.headerHeight ?? 32) + source.y + source.height / 2 + 32 - (targetBlock.headerHeight ?? 32) - target.y;
          if (targetBlock.y < 28) {
            sourceBlock.y += 28 - targetBlock.y;
            targetBlock.y = 28;
          }
        }
      }
      const result = [];
      if (model.kind === "state" && !regions && !connections.some((e) => e.attributes?.layoutDirection)) {
        for (const owner of placed.filter((n) => itemMap.get(n.id)?.shape === "container")) {
          const returns = placed.filter((n) => n.id !== owner.id && ["rounded", "uml-state"].includes(n.shape) && connections.some((e) => e.from === n.id && e.to === owner.id) && connections.some((e) => e.to === n.id && e.from === owner.id));
          let y = owner.y + Math.min(140, owner.height / 3);
          for (const n of returns) {
            n.x = Math.max(...placed.filter((p) => !returns.includes(p)).map((p) => p.x + p.width)) + 120;
            n.y = y;
            y += n.height + 90;
          }
        }
      }
      for (const node of placed) {
        const original = itemMap.get(node.id);
        result.push({ ...node, shape: original.shape });
        for (const child of subtrees.get(node.id) ?? []) result.push({ ...child, x: child.x + node.x, y: child.y + node.y + (node.headerHeight ?? 32) });
      }
      return result;
    };
    const nodes = build();
    for (const point of model.items.filter((item) => item.attributes.connectionPoint && item.parentId)) nodes.push({ ...point, ...point.size, x: 0, y: 0 });
    applyContinuity(nodes, context2);
    return { kind: model.kind, direction: "down", nodes, edges: routeDeployment(nodes, model), groups: [], ...dimensions(nodes) };
  }
  function layoutSwimlanes(model, context2) {
    const lanes = model.items.filter((item) => item.attributes.umlBlock === "lane");
    const rank = ranks(model);
    const normal = model.items.filter((item) => item.shape !== "container");
    const laneIds = [...normal.some((item) => !item.parentId) ? [void 0] : [], ...lanes.map((item) => item.id)];
    const heights = /* @__PURE__ */ new Map();
    for (const item of normal) heights.set(rank.get(item.id) ?? 0, Math.max(heights.get(rank.get(item.id) ?? 0) ?? 0, item.size.height));
    const ranksInUse = [...heights.keys()].sort((a, b) => a - b);
    const top = (r) => 80 + ranksInUse.filter((value) => value < r).reduce((y, value) => y + heights.get(value) + 72, 0);
    const bottom = 108 + ranksInUse.reduce((y, value) => y + heights.get(value) + 72, 0);
    const nodes = [];
    let x = 28;
    for (const id of laneIds) {
      const members = normal.filter((item) => item.parentId === id);
      const width = Math.max(180, ...ranksInUse.map((r) => members.filter((item) => rank.get(item.id) === r).reduce((w, item) => w + item.size.width + 36, 28)));
      if (id) {
        const lane = lanes.find((item) => item.id === id);
        nodes.push({ ...lane, x, y: 28, width, height: bottom - 28 });
      }
      for (const r of ranksInUse) {
        const row = members.filter((item) => rank.get(item.id) === r);
        let left = x + (width - row.reduce((w, item) => w + item.size.width, 0) - Math.max(0, row.length - 1) * 36) / 2;
        for (const item of row) {
          nodes.push({ ...item, ...item.size, x: left, y: top(r) });
          left += item.size.width + 36;
        }
      }
      x += width + 24;
    }
    applyContinuity(nodes, context2);
    return { kind: model.kind, direction: "down", nodes, edges: routeDeployment(nodes, model), groups: [], ...dimensions(nodes) };
  }
  function slideNumber(item, name, fallback, minimum = 1, maximum = 12) {
    const value = Number(item.attributes[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
  }
  function translateSlideBundle(bundle, x, y) {
    for (const node of bundle.nodes) {
      node.x += x;
      node.y += y;
    }
  }
  function arrangeSlideItem(item, childItems, childrenByParent) {
    if (item.shape !== "slide-group") {
      return {
        nodes: [{
          id: item.id,
          label: item.label,
          shape: item.shape,
          ...item.parentId ? { parentId: item.parentId } : {},
          attributes: item.attributes,
          x: 0,
          y: 0,
          ...item.size
        }],
        width: item.size.width,
        height: item.size.height
      };
    }
    const ordered = [...childItems].sort((a, b) => Number(a.attributes.order ?? 0) - Number(b.attributes.order ?? 0));
    const bundles = ordered.map((child) => arrangeSlideItem(child, childrenByParent.get(child.id) ?? [], childrenByParent));
    const layout = item.attributes.layout ?? "row";
    const gap = slideNumber(item, "gap", layout === "row" ? 62 : 24, 8, 160);
    let width = 1;
    let height = 1;
    if (layout === "column") {
      width = Math.max(1, ...bundles.map((bundle) => bundle.width));
      let y = 0;
      for (const bundle of bundles) {
        translateSlideBundle(bundle, (width - bundle.width) / 2, y);
        y += bundle.height + gap;
      }
      height = Math.max(1, y - (bundles.length ? gap : 0));
    } else if (layout === "grid") {
      const columns = Math.min(bundles.length || 1, Math.round(slideNumber(item, "columns", 2, 1, 6)));
      const rows = Math.ceil(bundles.length / columns);
      const columnWidths = Array.from({ length: columns }, (_, column) => Math.max(1, ...bundles.filter((_2, index) => index % columns === column).map((bundle) => bundle.width)));
      const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(1, ...bundles.slice(row * columns, (row + 1) * columns).map((bundle) => bundle.height)));
      const columnX = columnWidths.map((_, index) => columnWidths.slice(0, index).reduce((sum, value) => sum + value, 0) + gap * index);
      const rowY = rowHeights.map((_, index) => rowHeights.slice(0, index).reduce((sum, value) => sum + value, 0) + gap * index);
      bundles.forEach((bundle, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        translateSlideBundle(bundle, (columnX[column] ?? 0) + ((columnWidths[column] ?? bundle.width) - bundle.width) / 2, (rowY[row] ?? 0) + ((rowHeights[row] ?? bundle.height) - bundle.height) / 2);
      });
      width = columnWidths.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, columns - 1);
      height = rowHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, rows - 1);
    } else {
      height = Math.max(1, ...bundles.map((bundle) => bundle.height));
      let x = 0;
      for (const bundle of bundles) {
        translateSlideBundle(bundle, x, (height - bundle.height) / 2);
        x += bundle.width + gap;
      }
      width = Math.max(1, x - (bundles.length ? gap : 0));
    }
    const groupNode = {
      id: item.id,
      label: item.label,
      shape: item.shape,
      ...item.parentId ? { parentId: item.parentId } : {},
      attributes: item.attributes,
      x: 0,
      y: 0,
      width,
      height
    };
    return { nodes: [groupNode, ...bundles.flatMap((bundle) => bundle.nodes)], width, height };
  }
  var slideLayout = {
    name: "slide",
    layout(model, context2) {
      const childrenByParent = /* @__PURE__ */ new Map();
      for (const item of model.items) {
        if (!item.parentId) continue;
        const children = childrenByParent.get(item.parentId) ?? [];
        children.push(item);
        childrenByParent.set(item.parentId, children);
      }
      const roots = model.items.filter((item) => !item.parentId).sort((a, b) => Number(a.attributes.order ?? 0) - Number(b.attributes.order ?? 0));
      const bundles = roots.map((item) => ({ item, bundle: arrangeSlideItem(item, childrenByParent.get(item.id) ?? [], childrenByParent) }));
      const contentWidth = Math.max(880, ...bundles.map(({ bundle }) => bundle.width));
      const canvasWidth = Math.max(960, contentWidth + 80);
      let y = 30;
      const nodes = [];
      for (const { item, bundle } of bundles) {
        const isHeading = ["slide-title", "slide-subtitle"].includes(item.shape);
        const x = isHeading ? 40 : (canvasWidth - bundle.width) / 2;
        translateSlideBundle(bundle, x, y);
        nodes.push(...bundle.nodes);
        y += bundle.height + (item.shape === "slide-title" ? 0 : item.shape === "slide-subtitle" ? 28 : 38);
      }
      applyContinuity(nodes, context2);
      const edges = routeDeployment(nodes, model);
      const calculated = dimensions(nodes);
      return { kind: model.kind, nodes, edges, groups: [], width: Math.max(canvasWidth, calculated.width), height: Math.max(540, calculated.height) };
    }
  };
  var builtInLayouts = [hierarchicalLayout, compactLayout, sequenceLayout, flowchartLayout, graphLayout, activityLayout, classLayout, slideLayout];
  function rerouteGeometry(geometry) {
    if (geometry.kind === "timing") {
      rerouteTiming(geometry);
      return;
    }
    const notes = geometry.nodes.filter((node) => node.attributes.annotationTarget);
    if (notes.length) {
      const links = geometry.edges.filter((edge) => edge.attributes?.annotation);
      geometry.nodes = geometry.nodes.filter((node) => !node.attributes.annotationTarget || node.attributes.associationClass);
      geometry.edges = geometry.edges.filter((edge) => !edge.attributes?.annotation);
      for (const note of notes) if (note.attributes.associationClass) delete note.attributes.annotationTarget;
      rerouteGeometry(geometry);
      for (const note of notes) if (note.attributes.associationClass) note.attributes.annotationTarget = note.attributes.associationEdge;
      for (const note of notes) {
        const targetNode = geometry.nodes.find((node) => node.id === note.attributes.annotationTarget);
        const targetEdge = geometry.edges.find((edge) => edge.id === note.attributes.annotationTarget);
        const link = links.find((edge) => edge.to === note.id);
        if (link) {
          const anchor = targetNode ? annotationAnchor(targetNode, note.attributes.annotationMember) : targetEdge ? routeMidpoint(targetEdge.points) : link.points[0];
          const side = note.attributes.annotationSide;
          const left = side === "left", vertical = side === "top" || side === "bottom";
          if (left && targetNode) anchor.x = targetNode.x;
          if (vertical && targetNode) {
            anchor.x = targetNode.x + targetNode.width / 2;
            anchor.y = targetNode.y + (side === "bottom" ? targetNode.height : 0);
          }
          link.points = [anchor, { x: note.x + (vertical ? note.width / 2 : left ? note.width : 0), y: note.y + (side === "top" ? note.height : side === "bottom" ? 0 : note.height / 2) }];
        }
      }
      geometry.nodes.push(...notes.filter((note) => !geometry.nodes.some((n) => n.id === note.id)));
      geometry.edges.push(...links);
      const size2 = dimensions(geometry.nodes, geometry.groups);
      geometry.width = Math.max(geometry.width, size2.width);
      geometry.height = Math.max(geometry.height, size2.height);
      return;
    }
    if (geometry.kind === "sequence") {
      for (const [index, edge] of geometry.edges.entries()) {
        if (!edge.attributes?.fragmentHeight) continue;
        const ids = (edge.attributes.participants ?? "").split(",");
        const span = sequenceFragmentSpan(geometry.nodes.filter((node) => ids.includes(node.id)), edge.attributes.messageKind);
        const height = Math.max(36, labelLayout(edge.attributes.fragmentLabel ?? "", Math.max(40, span.width - 52), Number(edge.attributes.fragmentFontSize ?? 12), edge.attributes.fragmentFontFamily || void 0).lines.length * 16 + 22);
        const growth = height - Number(edge.attributes.fragmentHeight);
        if (growth === 0) continue;
        edge.attributes.fragmentHeight = String(height);
        const y = edge.points[0].y;
        for (const later of geometry.edges.slice(index + 1)) for (const point of later.points) point.y += growth;
        for (const group of geometry.groups) {
          if (group.y > y) group.y += growth;
          else if (group.y + group.height > y) group.height += growth;
          for (const branch of group.branches ?? []) if (branch.y > y) branch.y += growth;
        }
        for (const node of geometry.nodes) {
          const events = JSON.parse(node.attributes.sequencePositions ?? "[]");
          for (const event of events) if (event.y > y) event.y += growth;
          if (events.length) node.attributes.sequencePositions = JSON.stringify(events);
          const created = events.find((event) => event.kind === "create");
          if (created && !node.attributes.branchLifetime) node.y = created.y - node.height / 2;
        }
        geometry.height += growth;
      }
      const map = byId(geometry.nodes);
      for (const edge of geometry.edges) {
        const source = map.get(edge.from) ?? (edge.attributes?.external === "incoming" ? map.get(edge.to) : void 0);
        const target = map.get(edge.to) ?? (edge.attributes?.external === "outgoing" ? map.get(edge.from) : void 0);
        const y = edge.points[0]?.y ?? 0;
        if (source && target) {
          const fromX = edge.attributes?.external === "incoming" ? edge.attributes.externalSide === "right" ? Math.max(...geometry.nodes.map((n) => n.x + n.width)) + 24 : Math.min(...geometry.nodes.map((n) => n.x)) - 24 : source.x + source.width / 2;
          const toX = edge.attributes?.external === "outgoing" ? edge.attributes.externalSide === "left" ? Math.min(...geometry.nodes.map((n) => n.x)) - 24 : Math.max(...geometry.nodes.map((n) => n.x + n.width)) + 24 : target.x + target.width / 2;
          const receiveOffset = Number(edge.attributes?.receiveOffset ?? 0);
          edge.points = fromX === toX ? [{ x: fromX, y }, { x: fromX + 42, y }, { x: fromX + 42, y: y + 28 + receiveOffset }, { x: fromX, y: y + 28 + receiveOffset }] : [{ x: fromX, y }, { x: toX, y: y + receiveOffset }];
          if (edge.attributes?.messageKind === "create") edge.points[edge.points.length - 1].x = fromX < target.x ? target.x : target.x + target.width;
        }
      }
      const spans = geometry.edges.filter((edge) => edge.attributes?.messageKind === "note").map((edge) => sequenceFragmentSpan(geometry.nodes.filter((node) => (edge.attributes.participants ?? "").split(",").includes(node.id)), "note"));
      const depths = geometry.groups.map((group) => geometry.groups.filter((other) => other !== group && other.y < group.y && other.y + other.height >= group.y + group.height).length);
      const padding = 14 + Math.max(0, ...depths) * 6;
      const minX = Math.min(...geometry.nodes.map((node) => node.x), ...spans.map((span) => span.x));
      const maxX = Math.max(...geometry.nodes.map((node) => node.x + node.width), ...spans.map((span) => span.x + span.width));
      geometry.groups.forEach((group, index) => {
        group.x = minX - padding + depths[index] * 6;
        group.width = maxX + padding - depths[index] * 6 - group.x;
      });
      geometry.width = Math.max(320, ...geometry.nodes.map((node) => node.x + node.width + CANVAS_PADDING), ...geometry.groups.map((group) => group.x + group.width + CANVAS_PADDING)) + sequenceDurationWidth(geometry.edges);
      geometry.height = Math.max(240, ...geometry.nodes.map((node) => node.y + node.height + CANVAS_PADDING), geometry.height);
      return;
    }
    if (geometry.kind === "activity" || geometry.kind === "class") {
      const model2 = {
        kind: geometry.kind,
        items: geometry.nodes.map((node) => ({ ...node, size: { width: node.width, height: node.height } })),
        connections: geometry.edges.map(({ points: _points, ...edge }) => edge),
        groups: [],
        direction: "down",
        minimumGap: 44
      };
      geometry.edges = routeActivity(geometry.nodes, model2);
      const size2 = dimensions(geometry.nodes);
      geometry.width = size2.width;
      geometry.height = size2.height;
      return;
    }
    const model = {
      kind: geometry.kind,
      items: geometry.nodes.map((node) => ({ ...node, size: { width: node.width, height: node.height } })),
      connections: geometry.edges.map(({ points: _points, ...edge }) => edge),
      groups: [],
      direction: geometry.direction ?? (geometry.kind === "flowchart" ? "down" : "right"),
      minimumGap: 44
    };
    geometry.edges = routeDeployment(geometry.nodes, model);
    const size = dimensions(geometry.nodes, geometry.groups);
    geometry.width = size.width;
    geometry.height = size.height;
  }

  // src/images.ts
  function imageUrl(source, document) {
    const url = new URL(source, document.baseURI);
    if (!["https:", "http:", "file:", "blob:", "data:"].includes(url.protocol)) throw new Error("Unsupported image URL protocol.");
    if (url.protocol === "data:" && !/^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(source)) throw new Error("Unsupported image data URL.");
    return url.href;
  }
  async function embedImages(svg) {
    const cache = /* @__PURE__ */ new Map();
    await Promise.all([...svg.querySelectorAll("image")].map(async (image) => {
      const href = image.getAttribute("href");
      if (!href || href.startsWith("data:")) return;
      let pending = cache.get(href);
      if (!pending) {
        pending = (async () => {
          const response = await fetch(href, { credentials: "same-origin" });
          if (!response.ok) throw new Error(`Image export failed (${response.status}): ${href}`);
          const blob = await response.blob();
          if (!/^image\/(png|jpeg|gif|webp|svg\+xml)(;|$)/i.test(blob.type)) throw new Error(`Unsupported image content: ${href}`);
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error(`Could not embed image: ${href}`));
            reader.readAsDataURL(blob);
          });
        })();
        cache.set(href, pending);
      }
      image.setAttribute("href", await pending);
    }));
  }

  // src/node-style.ts
  var nextImageClip = 0;
  var commonToneStrokes = {
    cyan: "#138da5",
    coral: "#d65372",
    green: "#23966c",
    amber: "#b88920",
    violet: "#9271ce"
  };
  function inheritedTone(node, nodes) {
    const visited = /* @__PURE__ */ new Set();
    let current = node;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (current.attributes.tone !== void 0) return current.attributes.tone;
      current = nodes.find((parent) => parent.id === current?.parentId);
    }
    return void 0;
  }
  function nodeTheme(node, nodes, theme) {
    const name = inheritedTone(node, nodes);
    if (name !== void 0) {
      const stroke = commonToneStrokes[name];
      const tone = theme.tones?.[name] ?? (stroke ? { fill: node.shape === "container" ? theme.containerFill : theme.nodeFill, stroke } : void 0);
      if (!tone || name === "none") return theme;
      return {
        ...theme,
        nodeFill: tone.fill,
        containerFill: tone.fill,
        nodeStroke: tone.stroke,
        containerStroke: tone.stroke,
        accentColor: tone.stroke,
        labelColor: tone.labelColor ?? theme.labelColor,
        mutedColor: node.shape === "container" ? tone.stroke : theme.mutedColor
      };
    }
    return theme;
  }
  var supported = /* @__PURE__ */ new Set(["rectangle", "rounded", "storage", "process", "collections", "stack", "person", "server", "database", "card", "queue", "hexagon", "label", "cloud", "uml-artifact", "uml-file", "uml-node", "uml-device", "uml-execution"]);
  function withNodeIcon(shape, resolveIcon) {
    const decoratedLabel = (label, attributes) => [
      !["uml-class", "uml-state", "uml-instance"].includes(shape.name) && attributes.hideStereotype !== "true" && attributes.stereotype ? `\xAB${attributes.stereotype}\xBB` : "",
      attributes.submachine ? `${label} : ${attributes.submachine}` : label,
      shape.name === "container" && attributes.stateBody ? JSON.parse(attributes.stateBody).join("\n") : ""
    ].filter(Boolean).join("\n");
    const iconFor = (attributes) => supported.has(shape.name) ? attributes.image ? { src: attributes.image } : resolveIcon(attributes.icon ?? "") : void 0;
    return {
      ...shape,
      measure(context2) {
        const size = shape.measure({ ...context2, label: decoratedLabel(context2.label, context2.attributes) });
        return iconFor(context2.attributes) ? { ...size, width: size.width + 32, height: Math.max(size.height, 44) } : size;
      },
      render(context2) {
        const group = shape.render({ ...context2, node: { ...context2.node, label: decoratedLabel(context2.node.label, context2.node.attributes) } });
        const definition = iconFor(context2.node.attributes);
        if (!definition) return group;
        const labels = group.querySelectorAll(":scope > text");
        const label = labels[labels.length - 1];
        if (!label) return group;
        const spans = [...label.querySelectorAll("tspan")];
        const lines = spans.length ? spans.map((span) => span.textContent ?? "") : [label.textContent ?? ""];
        const width = Math.max(...lines.map((line) => textWidth(line, context2.theme.fontSize, context2.theme.fontFamily)));
        const ys = spans.length ? spans.map((span) => Number(span.getAttribute("y"))) : [Number(label.getAttribute("y"))];
        label.setAttribute("transform", "translate(16 0)");
        const icon = svgElement(context2.document, "g", {
          class: "finch-node-icon",
          "aria-hidden": "true",
          "pointer-events": "none",
          transform: `translate(${context2.node.width / 2 - width / 2 - 16} ${(Math.min(...ys) + Math.max(...ys)) / 2 - 11}) scale(${22 / 24})`,
          fill: "none",
          stroke: context2.theme.accentColor,
          "stroke-width": 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        });
        if (!Array.isArray(definition)) {
          const crop = context2.node.attributes.imageShape;
          const image = svgElement(context2.document, "image", {
            href: imageUrl(definition.src, context2.document),
            width: 24,
            height: 24,
            preserveAspectRatio: crop === "circle" || crop === "rounded" ? "xMidYMid slice" : "xMidYMid meet"
          });
          if (crop === "circle" || crop === "rounded") {
            const id = `finch-image-clip-${++nextImageClip}`;
            const defs = svgElement(context2.document, "defs", {});
            const clip = svgElement(context2.document, "clipPath", { id });
            clip.append(crop === "circle" ? svgElement(context2.document, "circle", { cx: 12, cy: 12, r: 12 }) : svgElement(context2.document, "rect", { width: 24, height: 24, rx: 5 }));
            defs.append(clip);
            icon.append(defs);
            image.setAttribute("clip-path", `url(#${id})`);
          }
          icon.append(image);
          group.append(icon);
          return group;
        }
        const tags = /* @__PURE__ */ new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
        const attrs = /* @__PURE__ */ new Set(["d", "x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2", "points"]);
        for (const primitive of definition) {
          if (!tags.has(primitive.tag)) continue;
          icon.append(svgElement(
            context2.document,
            primitive.tag,
            Object.fromEntries(Object.entries(primitive.attributes).filter(([key]) => attrs.has(key)))
          ));
        }
        group.append(icon);
        return group;
      }
    };
  }

  // src/shapes.ts
  var MAX_NODE_LABEL_WIDTH = 216;
  var DATABASE_CAP = 10;
  var COMPACT_LABEL_WIDTH = 120;
  function wrappedLabelSize(label, context2, options = {}) {
    const fontSize = context2.theme.fontSize;
    const paddingX = options.paddingX ?? context2.theme.nodePaddingX;
    const paddingY = options.paddingY ?? context2.theme.nodePaddingY;
    const lineHeight = Math.ceil(fontSize * 1.4);
    const lines = nodeLabelLayout(label, context2.attributes, context2.theme, options.maximumTextWidth ?? MAX_NODE_LABEL_WIDTH).lines;
    return {
      width: Math.max(options.minimumWidth ?? 104, ...lines.map((line) => textWidth(line, fontSize, context2.theme.fontFamily) + paddingX * 2)),
      height: Math.max(options.minimumHeight ?? 46, lines.length * lineHeight + paddingY * 2)
    };
  }
  function baseSize(label, context2) {
    return wrappedLabelSize(label, context2);
  }
  function addLabel(group, context2, yOffset = 0, paddingX = context2.theme.nodePaddingX, maximum = MAX_NODE_LABEL_WIDTH) {
    const { node, theme, document } = context2;
    const lines = labelLayout(node.label, Math.min(wrapWidth(node.attributes, maximum), Math.max(theme.fontSize, node.width - paddingX * 2)), theme.fontSize, theme.fontFamily).lines;
    const lineHeight = Math.ceil(theme.fontSize * 1.4);
    const text = svgElement(document, "text", {
      x: node.width / 2,
      y: node.height / 2 + yOffset - (lines.length - 1) * lineHeight / 2,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      fill: theme.labelColor,
      "font-family": theme.fontFamily,
      "font-size": theme.fontSize,
      "font-weight": 560
    });
    if (lines.length === 1) {
      text.textContent = lines[0];
    } else {
      lines.forEach((line, index) => {
        const span = svgElement(document, "tspan", { x: node.width / 2, y: node.height / 2 + yOffset - (lines.length - 1) * lineHeight / 2 + index * lineHeight });
        span.textContent = line;
        text.append(span);
      });
    }
    group.append(text);
  }
  function groupFor(context2) {
    return svgElement(context2.document, "g", {
      class: `finch-shape finch-shape-${context2.node.shape}`,
      "data-node-id": context2.node.id,
      transform: `translate(${context2.node.x} ${context2.node.y})`
    });
  }
  function setTextLines(text, value, width, fontSize, family, weight = 560) {
    const layout = labelLayout(value, width, fontSize, family, weight);
    if (layout.lines.length === 1) text.textContent = layout.lines[0];
    else for (const [index, line] of layout.lines.entries()) {
      const span = svgElement(text.ownerDocument, "tspan", { x: text.getAttribute("x") ?? "0", y: Number(text.getAttribute("y")) + index * layout.lineHeight });
      span.textContent = line;
      text.append(span);
    }
    return layout.height;
  }
  var rectangleShape = {
    name: "rectangle",
    measure: ({ label, theme, attributes }) => baseSize(label, { theme, attributes }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "rect", {
        width: context2.node.width,
        height: context2.node.height,
        rx: context2.theme.nodeRadius,
        fill: context2.theme.nodeFill,
        stroke: context2.theme.nodeStroke,
        "stroke-width": context2.theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2);
      return group;
    }
  };
  var collectionsShape = {
    name: "collections",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, {
      minimumWidth: 120,
      minimumHeight: 64,
      paddingX: 28,
      paddingY: 20
    }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      for (const offset of [8, 4, 0]) group.append(svgElement(document, "rect", {
        x: offset,
        y: 8 - offset,
        width: node.width - 8,
        height: node.height - 8,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth
      }));
      addLabel(group, context2, 4, 28);
      return group;
    }
  };
  var stackShape = { ...collectionsShape, name: "stack" };
  var labelShape = {
    name: "label",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, {
      minimumWidth: 24,
      minimumHeight: 24,
      paddingX: 8,
      paddingY: 6
    }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "rect", {
        width: context2.node.width,
        height: context2.node.height,
        fill: "transparent",
        stroke: "none"
      }));
      addLabel(group, context2, 0, 8);
      return group;
    }
  };
  var roundedShape = {
    ...rectangleShape,
    name: "rounded",
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "rect", {
        width: context2.node.width,
        height: context2.node.height,
        rx: Math.min(context2.node.height / 2, 24),
        fill: context2.theme.nodeFill,
        stroke: context2.theme.nodeStroke,
        "stroke-width": context2.theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2);
      return group;
    }
  };
  var processShape = {
    name: "process",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 120, minimumHeight: 52, paddingX: 32 }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "path", { d: containerOutlinePath({ ...node, attributes: { ...node.attributes, containerStyle: "process" } }, theme), fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      addLabel(group, context2, 0, 32);
      return group;
    }
  };
  var storageShape = {
    ...roundedShape,
    name: "storage",
    render(context2) {
      const group = roundedShape.render(context2);
      group.querySelector("rect")?.setAttribute("rx", String(Math.min(35, context2.node.width / 2, context2.node.height / 2)));
      return group;
    }
  };
  var databaseShape = {
    name: "database",
    measure: ({ label, theme, attributes }) => {
      const size = baseSize(label, { theme, attributes });
      return { width: Math.max(110, size.width), height: Math.max(60, nodeLabelLayout(label, attributes, theme).height + theme.nodePaddingY * 2 + DATABASE_CAP * 3) };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const cap = DATABASE_CAP;
      const path = [
        `M 0 ${cap}`,
        `A ${node.width / 2} ${cap} 0 0 1 ${node.width} ${cap}`,
        `L ${node.width} ${node.height - cap}`,
        `A ${node.width / 2} ${cap} 0 0 1 0 ${node.height - cap}`,
        "Z"
      ].join(" ");
      group.append(svgElement(document, "path", {
        d: path,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "ellipse", {
        cx: node.width / 2,
        cy: cap,
        rx: node.width / 2,
        ry: cap,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth
      }));
      addLabel(group, context2, cap / 2);
      return group;
    }
  };
  var hexagonShape = {
    name: "hexagon",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { paddingX: 32, minimumHeight: 56 }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "path", {
        d: `M20 0 H${node.width - 20} L${node.width} ${node.height / 2} L${node.width - 20} ${node.height} H20 L0 ${node.height / 2} Z`,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2, 0, 32);
      return group;
    }
  };
  var cardShape = {
    name: "card",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { paddingX: 24, minimumHeight: 56 }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "path", {
        d: `M16 0 H${node.width} V${node.height} H0 V16 Z`,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2, 0, 24);
      return group;
    }
  };
  var queueShape = {
    name: "queue",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, {
      minimumWidth: 120,
      minimumHeight: 52,
      paddingX: theme.nodePaddingX + 20
    }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const cap = Math.min(10, node.width / 4);
      group.append(svgElement(document, "path", {
        d: `M ${cap} 0 H ${node.width - cap} A ${cap} ${node.height / 2} 0 0 1 ${node.width - cap} ${node.height} H ${cap} A ${cap} ${node.height / 2} 0 0 1 ${cap} 0 Z`,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "ellipse", {
        cx: node.width - cap,
        cy: node.height / 2,
        rx: cap,
        ry: node.height / 2,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth
      }));
      addLabel(group, context2, 0, theme.nodePaddingX + 20);
      return group;
    }
  };
  var personShape = {
    name: "person",
    measure: ({ label, theme, attributes }) => {
      const body = wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 100, minimumHeight: 48, paddingX: 28, paddingY: 20 });
      return { ...body, height: body.height + 32 };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const style = { fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth };
      group.append(svgElement(document, "circle", { cx: node.width / 2, cy: 16, r: 16, ...style }));
      group.append(svgElement(document, "rect", { x: 0, y: 32, width: node.width, height: node.height - 32, rx: 16, ...style }));
      addLabel(group, context2, 16, 28);
      return group;
    }
  };
  var actorShape = {
    name: "actor",
    measure: ({ label, theme, attributes }) => {
      const text = nodeLabelLayout(label, attributes, theme);
      return { width: Math.max(84, text.width + 22), height: 62 + text.height };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", {
        x: 0,
        y: 0,
        width: node.width,
        height: node.height,
        fill: "transparent",
        "pointer-events": "all",
        class: "finch-actor-hit-area"
      }));
      const cx = node.width / 2;
      const stroke = { fill: "none", stroke: theme.edgeColor, "stroke-width": 1.7, "stroke-linecap": "round" };
      group.append(svgElement(document, "circle", { cx, cy: 10, r: 8, fill: theme.nodeFill, stroke: theme.edgeColor, "stroke-width": 1.7 }));
      if (node.attributes.business === "true") group.append(svgElement(document, "line", {
        x1: cx - 2,
        y1: 10 + Math.sqrt(60),
        x2: cx + Math.sqrt(60),
        y2: 8,
        stroke: theme.edgeColor,
        "stroke-width": 1.7,
        class: "finch-business-mark"
      }));
      group.append(svgElement(document, "path", { d: `M ${cx} 18 L ${cx} 42 M ${cx - 16} 28 L ${cx + 16} 28 M ${cx} 42 L ${cx - 12} 56 M ${cx} 42 L ${cx + 12} 56`, ...stroke }));
      const label = svgElement(document, "text", {
        x: cx,
        y: 72,
        "text-anchor": "middle",
        fill: theme.labelColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize,
        "font-weight": 560
      });
      setTextLines(label, node.label, Math.min(node.width - 22, wrapWidth(node.attributes, 216)), theme.fontSize, theme.fontFamily);
      group.append(label);
      return group;
    }
  };
  var sequenceRoleShapes = ["boundary", "control", "entity", "collections", "queue"].map((role) => ({
    ...actorShape,
    name: `sequence-${role}`,
    render(context2) {
      const group = actorShape.render(context2);
      for (const child of [...group.children]) if (child.tagName !== "text") child.remove();
      const { node, theme, document } = context2, cx = node.width / 2;
      const symbol = svgElement(document, "g", { class: `finch-sequence-${role}`, fill: "none", stroke: theme.edgeColor, "stroke-width": 1.7, "stroke-linecap": "round" });
      if (role === "collections") {
        symbol.append(svgElement(document, "rect", { x: cx - 18, y: 10, width: 40, height: 36, fill: theme.nodeFill }));
        symbol.append(svgElement(document, "rect", { x: cx - 24, y: 16, width: 40, height: 36, fill: theme.nodeFill }));
        group.prepend(symbol);
        return group;
      }
      if (role === "queue") {
        symbol.append(svgElement(document, "path", { d: `M${cx - 24} 12 H${cx + 20} C${cx + 32} 12 ${cx + 32} 48 ${cx + 20} 48 H${cx - 24} C${cx - 36} 48 ${cx - 36} 12 ${cx - 24} 12 Z`, fill: theme.nodeFill }));
        symbol.append(svgElement(document, "ellipse", { cx: cx - 24, cy: 30, rx: 8, ry: 18, fill: theme.nodeFill }));
        group.prepend(symbol);
        return group;
      }
      symbol.append(svgElement(document, "circle", { cx, cy: 30, r: 18, fill: theme.nodeFill }));
      const d = role === "boundary" ? `M${cx - 30} 12 V48 M${cx - 30} 30 H${cx - 18}` : role === "control" ? `M${cx} 12 l-7 -6 M${cx} 12 l-7 6` : `M${cx - 23} 52 H${cx + 23}`;
      symbol.append(svgElement(document, "path", { d }));
      group.prepend(symbol);
      return group;
    }
  }));
  function containerOutlinePath(node, theme) {
    const tab = Math.min(node.width - 24, Math.max(64, labelLayout(node.label, wrapWidth(node.attributes, 216), theme.fontSize - 1, theme.fontFamily, 650).width + 32));
    const header2 = node.headerHeight ?? 42;
    const radius = node.attributes.containerStyle === "storage" ? Math.min(35, node.width / 2, node.height / 2) : 12;
    return node.attributes.containerStyle === "process" ? `M0 0 H${node.width - 12} L${node.width} ${node.height / 2} L${node.width - 12} ${node.height} H0 L12 ${node.height / 2} Z` : ["action", "storage"].includes(node.attributes.containerStyle ?? "") ? `M${radius} 0 H${node.width - radius} Q${node.width} 0 ${node.width} ${radius} V${node.height - radius} Q${node.width} ${node.height} ${node.width - radius} ${node.height} H${radius} Q0 ${node.height} 0 ${node.height - radius} V${radius} Q0 0 ${radius} 0 Z` : ["file", "artifact"].includes(node.attributes.containerStyle ?? "") ? `M0 0 H${node.width - 16} L${node.width} 16 V${node.height} H0 Z M${node.width - 16} 0 V16 H${node.width}` : node.attributes.containerStyle === "stack" ? `M8 0 H${node.width} V${node.height - 8} H${node.width - 4} M4 4 H${node.width - 4} V${node.height - 4} H${node.width - 8} M0 8 H${node.width - 8} V${node.height} H0 Z` : node.attributes.containerStyle === "hexagon" ? `M20 0 H${node.width - 20} L${node.width} ${node.height / 2} L${node.width - 20} ${node.height} H20 L0 ${node.height / 2} Z` : node.attributes.containerStyle === "card" ? `M16 0 H${node.width} V${node.height} H0 V16 Z` : node.attributes.containerStyle === "queue" ? `M10 0 H${node.width - 10} A10 ${node.height / 2} 0 0 1 ${node.width - 10} ${node.height} H10 A10 ${node.height / 2} 0 0 1 10 0 Z M${node.width - 10} 0 A10 ${node.height / 2} 0 0 0 ${node.width - 10} ${node.height}` : node.attributes.containerStyle === "cloud" ? `M20 20 C0 20 0 50 12 56 V${node.height - 50} C0 ${node.height - 30} 12 ${node.height} 40 ${node.height - 12} H${node.width - 40} C${node.width - 10} ${node.height} ${node.width} ${node.height - 20} ${node.width - 12} ${node.height - 44} V50 C${node.width} 30 ${node.width - 8} 12 ${node.width - 30} 18 C${node.width - 35} 0 ${node.width - 70} 0 ${node.width - 82} 14 H80 C65 0 30 0 20 20 Z` : node.attributes.containerStyle === "database" ? `M0 10 C0 -3 ${node.width} -3 ${node.width} 10 V${node.height - 10} C${node.width} ${node.height + 3} 0 ${node.height + 3} 0 ${node.height - 10} Z M0 10 C0 23 ${node.width} 23 ${node.width} 10` : node.attributes.containerStyle === "node" ? `M0 10 L10 0 H${node.width} V${node.height - 10} L${node.width - 10} ${node.height} H0 Z M0 10 H${node.width - 10} L${node.width} 0 M${node.width - 10} 10 V${node.height}` : node.attributes.containerStyle === "folder" ? `M0 0 H${tab} L${tab + 12} 12 H${node.width} V${node.height} H0 Z` : `M0 0 H${node.width} V${node.height} H0 Z M0 ${header2 - 10} H${tab} L${tab + 10} ${header2 - 20} V0`;
  }
  var containerShape = {
    name: "container",
    measure: ({ label, theme, attributes }) => {
      const text = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize - 1, theme.fontFamily, 650);
      const headerHeight = (attributes.containerStyle === "cloud" ? 62 : attributes.containerStyle === "database" ? 56 : 42) + (text.lines.length - 1) * text.lineHeight;
      return { width: Math.max(168, text.width + (attributes.containerStyle === "component" ? 72 : ["queue", "hexagon"].includes(attributes.containerStyle ?? "") ? 60 : 42)), height: Math.max(110, headerHeight + 26), headerHeight };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.classList.add("finch-container");
      group.append(svgElement(document, "rect", {
        width: node.width,
        height: node.height,
        rx: theme.nodeRadius + 2,
        fill: node.attributes.stateKind === "region" ? "transparent" : theme.containerFill,
        stroke: node.attributes.stateKind === "region" ? "none" : theme.containerStroke,
        "stroke-width": theme.nodeStrokeWidth,
        "stroke-dasharray": node.attributes.stateKind === "state" || node.attributes.containerStyle === "component" ? "none" : "5 4"
      }));
      if (node.attributes.containerStyle === "component" && node.attributes.componentStyle !== "rectangle") {
        const mark = svgElement(document, "g", { class: "finch-component-group-mark", transform: node.attributes.componentStyle === "uml1" ? "translate(0 0)" : `translate(${node.width - 30} 10)`, fill: theme.containerFill, stroke: theme.containerStroke, "stroke-width": theme.nodeStrokeWidth });
        if (node.attributes.componentStyle === "uml1") mark.append(svgElement(document, "rect", { x: -6, y: 10, width: 12, height: 7 }), svgElement(document, "rect", { x: -6, y: 24, width: 12, height: 7 }));
        else mark.append(svgElement(document, "rect", { x: 5, y: 0, width: 14, height: 18 }), svgElement(document, "rect", { x: 0, y: 3, width: 9, height: 4 }), svgElement(document, "rect", { x: 0, y: 11, width: 9, height: 4 }));
        group.append(mark);
      }
      if (["folder", "frame", "node", "database", "cloud", "queue", "file", "artifact", "card", "hexagon", "stack", "action", "storage", "process"].includes(node.attributes.containerStyle ?? "")) {
        group.querySelector("rect")?.remove();
        const d = containerOutlinePath(node, theme);
        group.append(svgElement(document, "path", { d, fill: theme.containerFill, stroke: theme.containerStroke, "stroke-width": theme.nodeStrokeWidth, class: `finch-${node.attributes.containerStyle}-outline` }));
      }
      if (node.attributes.stateKind === "region" && node.attributes.regionDivider === "true") group.append(svgElement(document, "path", { d: node.attributes.regionDirection === "rows" ? `M-28 -16 H${node.width + 28}` : `M-16 -28 V${node.height + 28}`, stroke: theme.containerStroke, "stroke-dasharray": "5 4", fill: "none", class: "finch-region-divider" }));
      const text = svgElement(document, "text", {
        x: ["queue", "hexagon"].includes(node.attributes.containerStyle ?? "") ? 26 : 16,
        y: node.attributes.containerStyle === "cloud" ? 43 : node.attributes.containerStyle === "database" ? 37 : 23,
        fill: theme.mutedColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize - 1,
        "font-weight": 650
      });
      setTextLines(text, node.label, Math.min(node.width - (node.attributes.containerStyle === "component" ? 56 : ["queue", "hexagon"].includes(node.attributes.containerStyle ?? "") ? 52 : 32), wrapWidth(node.attributes, 216)), theme.fontSize - 1, theme.fontFamily, 650);
      group.append(text);
      return group;
    }
  };
  var serverShape = {
    ...rectangleShape,
    name: "server",
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", {
        width: node.width,
        height: node.height,
        rx: theme.nodeRadius,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "line", { x1: 13, y1: 18, x2: 13, y2: node.height - 18, stroke: theme.accentColor, "stroke-width": 3, "stroke-linecap": "round" }));
      addLabel(group, context2);
      return group;
    }
  };
  var diamondShape = {
    name: "diamond",
    measure: ({ label, theme, attributes }) => {
      const text = nodeLabelLayout(label, attributes, theme, COMPACT_LABEL_WIDTH);
      return { width: Math.max(148, (text.width + 16) * 2), height: Math.max(86, (text.height + 12) * 2) };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "polygon", {
        points: `${node.width / 2},0 ${node.width},${node.height / 2} ${node.width / 2},${node.height} 0,${node.height / 2}`,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2, 0, 27, COMPACT_LABEL_WIDTH);
      return group;
    }
  };
  var parallelogramShape = {
    name: "parallelogram",
    measure: ({ label, theme, attributes }) => {
      const size = baseSize(label, { theme, attributes });
      return { width: Math.max(124, size.width + 22), height: size.height };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const slant = 16;
      group.append(svgElement(document, "polygon", {
        points: `${slant},0 ${node.width},0 ${node.width - slant},${node.height} 0,${node.height}`,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2, 0, context2.theme.nodePaddingX + 11);
      return group;
    }
  };
  var circleShape = {
    name: "circle",
    measure: ({ label, theme, attributes }) => {
      const size = wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 64, minimumHeight: 64, paddingX: 15, paddingY: 15, maximumTextWidth: COMPACT_LABEL_WIDTH });
      const diameter = Math.ceil(Math.hypot(size.width, size.height));
      return { width: diameter, height: diameter };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "circle", {
        cx: node.width / 2,
        cy: node.height / 2,
        r: Math.min(node.width, node.height) / 2,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2, 0, 15, COMPACT_LABEL_WIDTH);
      return group;
    }
  };
  var initialStateShape = {
    name: "initial-state",
    measure: () => ({ width: 24, height: 24 }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "circle", {
        cx: 12,
        cy: 12,
        r: 11,
        fill: context2.theme.labelColor,
        stroke: context2.theme.labelColor,
        "stroke-width": 1
      }));
      return group;
    }
  };
  var terminateStateShape = {
    name: "terminate-state",
    measure: () => ({ width: 28, height: 28 }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "path", { d: "M3 3 L25 25 M25 3 L3 25", fill: "none", stroke: context2.theme.labelColor, "stroke-width": 2.5 }));
      return group;
    }
  };
  var finalStateShape = {
    name: "final-state",
    measure: () => ({ width: 28, height: 28 }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "circle", {
        cx: 14,
        cy: 14,
        r: 13,
        fill: context2.theme.nodeFill,
        stroke: context2.theme.labelColor,
        "stroke-width": 1.8
      }));
      group.append(svgElement(context2.document, "circle", {
        cx: 14,
        cy: 14,
        r: 6,
        fill: context2.theme.labelColor
      }));
      return group;
    }
  };
  var junctionStateShape = {
    name: "junction-state",
    measure: () => ({ width: 16, height: 16 }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "circle", {
        cx: 8,
        cy: 8,
        r: 7.5,
        fill: context2.theme.labelColor
      }));
      return group;
    }
  };
  function entityFields(attributes) {
    try {
      const value = JSON.parse(attributes.fields ?? "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
  var entityShape = {
    name: "entity",
    measure: ({ label, attributes, theme }) => {
      const fields = entityFields(attributes);
      const fieldWidth = Math.max(0, ...fields.map((field) => textWidth(field.name, theme.fontSize - 1) + textWidth(field.type, theme.fontSize - 2) + 76));
      const title = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize + 1, theme.fontFamily, 700);
      return {
        width: Math.max(190, title.width + 44, fieldWidth),
        height: 40 + (title.lines.length - 1) * title.lineHeight + Math.max(1, fields.length) * 25 + 8
      };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const fields = entityFields(node.attributes);
      const titleLayout = labelLayout(node.label, Math.min(node.width - 28, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 700);
      const headerHeight = 38 + (titleLayout.lines.length - 1) * titleLayout.lineHeight;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", {
        width: node.width,
        height: node.height,
        rx: theme.nodeRadius,
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "path", {
        d: `M ${theme.nodeRadius} 0 H ${node.width - theme.nodeRadius} Q ${node.width} 0 ${node.width} ${theme.nodeRadius} V ${headerHeight} H 0 V ${theme.nodeRadius} Q 0 0 ${theme.nodeRadius} 0 Z`,
        fill: theme.containerFill,
        stroke: "none"
      }));
      group.append(svgElement(document, "line", { x1: 0, y1: headerHeight, x2: node.width, y2: headerHeight, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      const title = svgElement(document, "text", {
        x: 14,
        y: 24,
        fill: theme.labelColor,
        "font-family": theme.fontFamily,
        "font-size": theme.fontSize + 1,
        "font-weight": 700
      });
      setTextLines(title, node.label, Math.min(node.width - 28, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 700);
      group.append(title);
      fields.forEach((field, index) => {
        const y = headerHeight + 21 + index * 25;
        if (index > 0) group.append(svgElement(document, "line", { x1: 10, y1: y - 16, x2: node.width - 10, y2: y - 16, stroke: theme.nodeStroke, "stroke-width": 0.5, opacity: 0.55 }));
        const keyFlags = field.flags.filter((flag) => ["pk", "fk", "unique"].includes(flag));
        const badge = svgElement(document, "text", {
          x: 12,
          y,
          fill: keyFlags.includes("pk") ? theme.accentColor : theme.mutedColor,
          "font-family": theme.fontFamily,
          "font-size": theme.fontSize - 3,
          "font-weight": 750
        });
        badge.textContent = keyFlags.map((flag) => flag === "unique" ? "UQ" : flag.toUpperCase()).join("/");
        const name = svgElement(document, "text", { x: 46, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-weight": keyFlags.includes("pk") ? 650 : 500 });
        name.textContent = field.name;
        const type = svgElement(document, "text", { x: node.width - 12, y, "text-anchor": "end", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2 });
        type.textContent = field.type;
        group.append(badge, name, type);
      });
      return group;
    }
  };
  var componentShape = {
    ...rectangleShape,
    name: "component",
    measure: ({ label, theme, attributes }) => {
      const style = attributes.componentStyle;
      const size = style === "uml1" ? wrappedLabelSize(label, { theme, attributes }, { paddingX: 28 }) : baseSize(label, { theme, attributes });
      return { width: Math.max(126, size.width), height: size.height + (style === "uml1" || style === "rectangle" ? 0 : 26) };
    },
    render(context2) {
      const { node, theme, document } = context2;
      if (node.attributes.componentStyle === "rectangle") return rectangleShape.render(context2);
      if (node.attributes.componentStyle === "uml1") {
        const group2 = groupFor(context2);
        group2.append(svgElement(document, "rect", { x: 12, y: 0, width: node.width - 12, height: node.height, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
        for (const y of [node.height / 3 - 5, node.height * 2 / 3 - 5]) group2.append(svgElement(document, "rect", { x: 0, y, width: 24, height: 10, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, class: "finch-component-tab" }));
        addLabel(group2, context2, 0, 28);
        return group2;
      }
      const group = rectangleShape.render(context2);
      group.querySelector("text")?.remove();
      addLabel(group, context2, 13);
      const icon = svgElement(document, "g", { transform: `translate(${node.width - 31} 10)`, fill: theme.nodeFill, stroke: theme.accentColor, "stroke-width": 1.2 });
      icon.append(svgElement(document, "rect", { x: 6, y: 0, width: 17, height: 17, rx: 2 }));
      icon.append(svgElement(document, "rect", { x: 0, y: 3, width: 10, height: 4, rx: 1 }));
      icon.append(svgElement(document, "rect", { x: 0, y: 10, width: 10, height: 4, rx: 1 }));
      group.append(icon);
      return group;
    }
  };
  var cloudShape = {
    name: "cloud",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, {
      minimumWidth: 168,
      minimumHeight: 110,
      paddingX: 36,
      paddingY: 30
    }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "path", {
        d: containerOutlinePath({ ...node, attributes: { ...node.attributes, containerStyle: "cloud" } }, theme),
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      addLabel(group, context2, 0, 36);
      return group;
    }
  };
  var externalShape = {
    name: "external",
    measure: ({ label, theme, attributes }) => {
      const size = baseSize(label, { theme, attributes });
      return { width: Math.max(126, size.width), height: Math.max(62, size.height + 20) };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", {
        width: node.width,
        height: node.height,
        rx: theme.nodeRadius + 5,
        fill: theme.nodeFill,
        stroke: theme.containerStroke,
        "stroke-width": theme.nodeStrokeWidth,
        "stroke-dasharray": "5 4",
        filter: "url(#finch-shadow)"
      }));
      const stereotype = svgElement(document, "text", { x: node.width / 2, y: 19, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3, "font-weight": 650 });
      stereotype.textContent = "\xABexternal\xBB";
      group.append(stereotype);
      addLabel(group, context2, 10);
      return group;
    }
  };
  function numericAttribute(attributes, name, fallback, minimum, maximum) {
    const value = Number(attributes[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
  }
  function appendSlideText(group, context2, value, options) {
    const lines = labelLayout(value, Math.min(options.width, wrapWidth(context2.node.attributes, options.width)), options.fontSize, context2.theme.fontFamily, options.weight ?? 500).lines;
    const text = svgElement(context2.document, "text", {
      x: options.x,
      y: options.y,
      fill: options.color ?? context2.theme.labelColor,
      "font-family": context2.theme.fontFamily,
      "font-size": options.fontSize,
      "font-weight": options.weight ?? 500,
      "text-anchor": options.align ?? "start"
    });
    lines.forEach((line, index) => {
      const span = svgElement(context2.document, "tspan", { x: options.x, y: options.y + index * options.lineHeight });
      span.textContent = line;
      text.append(span);
    });
    group.append(text);
  }
  function slideExtra(context2, value, width, fontSize, lineHeight, weight = 750) {
    return (labelLayout(value, Math.min(width, wrapWidth(context2.node.attributes, width)), fontSize, context2.theme.fontFamily, weight).lines.length - 1) * lineHeight;
  }
  function growSlideSize(name, context2, size) {
    const { label, attributes, theme } = context2;
    const extra = (value, width, fontSize, lineHeight, weight = 750) => value ? (labelLayout(value, Math.min(width, wrapWidth(attributes, width)), fontSize, theme.fontFamily, weight).lines.length - 1) * lineHeight : 0;
    const w = size.width;
    const minimum = name === "slide-card" && attributes.badge ? attributes.body ? 110 : 76 : name === "slide-card" && attributes.body ? 90 : name === "slide-note" && attributes.body ? 72 : name === "slide-callout" && attributes.body ? 90 : name === "slide-milestone" && attributes.body && attributes.period ? 118 : 0;
    let growth = 0;
    switch (name) {
      case "slide-title":
        growth = extra(label, w, 30, 36, 760);
        break;
      case "slide-subtitle":
        growth = extra(label, w, 16, 22, 500);
        break;
      case "slide-card":
        growth = extra(label, w - 40, 17, 21, 700) + extra(attributes.body, w - 40, 12, 17, 500) + extra(attributes.badge?.toUpperCase(), w - 44, 10, 12);
        break;
      case "slide-note":
        growth = extra(label, w - 48, 14, 18, 650) + extra(attributes.body, w - 36, 12, 17, 500);
        break;
      case "slide-callout":
        growth = extra(label, w - 48, 20, 25, 760) + extra(attributes.body, w - 48, 13, 18, 500);
        break;
      case "slide-badge":
        growth = extra(label, w - 20, 12, 14, 720);
        break;
      case "slide-metric":
        growth = extra(attributes.label, w - 40, 11, 14, 740) + extra(label, w - 40, 31, 34, 780) + extra(attributes.delta, w - 56, 11, 13, 680);
        break;
      case "slide-bar":
        growth = Math.max(extra(label, w - 120, 14, 17, 650), extra(`${attributes.value ?? 0}${attributes.suffix ?? ""}`, 80, 15, 17, 760));
        break;
      case "slide-quote":
        growth = extra(label, w - 104, 18, 25, 620) + extra(attributes.role ? `${attributes.by} \xB7 ${attributes.role}` : attributes.by, w - 104, 12, 15, 650);
        break;
      case "slide-milestone":
        growth = extra(attributes.period?.toUpperCase(), w - 68, 10, 12, 760) + extra(label, w - 68, 16, 20, 720) + extra(attributes.body, w - 50, 12, 17, 500);
        break;
    }
    return { ...size, height: Math.max(size.height, minimum) + growth };
  }
  var slideTitleShape = {
    name: "slide-title",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-title", context2, { width: numericAttribute(attributes, "width", 880, 320, 1400), height: 58 });
    },
    render(context2) {
      const group = groupFor(context2);
      const centered = context2.node.attributes.align === "center";
      appendSlideText(group, context2, context2.node.label, {
        x: centered ? context2.node.width / 2 : 0,
        y: 36,
        width: context2.node.width,
        fontSize: 30,
        lineHeight: 36,
        weight: 760,
        align: centered ? "middle" : "start"
      });
      return group;
    }
  };
  var slideSubtitleShape = {
    name: "slide-subtitle",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-subtitle", context2, { width: numericAttribute(attributes, "width", 880, 320, 1400), height: 36 });
    },
    render(context2) {
      const group = groupFor(context2);
      const centered = context2.node.attributes.align === "center";
      appendSlideText(group, context2, context2.node.label, {
        x: centered ? context2.node.width / 2 : 0,
        y: 23,
        width: context2.node.width,
        fontSize: 16,
        lineHeight: 22,
        color: context2.theme.mutedColor,
        align: centered ? "middle" : "start"
      });
      return group;
    }
  };
  var slideCardShape = {
    name: "slide-card",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-card", context2, {
        width: numericAttribute(attributes, "width", 224, 150, 440),
        height: numericAttribute(attributes, "height", attributes.body ? 126 : 92, 72, 260)
      });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const accent = node.attributes.tone === "accent";
      group.append(svgElement(document, "rect", {
        width: node.width,
        height: node.height,
        rx: 14,
        fill: accent ? theme.containerFill : theme.nodeFill,
        stroke: accent ? theme.accentColor : theme.nodeStroke,
        "stroke-width": accent ? 2 : theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      group.append(svgElement(document, "rect", { x: 0, y: 0, width: 7, height: node.height, rx: 4, fill: theme.accentColor }));
      if (node.attributes.badge) {
        const badgeWidth = Math.min(node.width - 36, Math.max(44, textWidth(node.attributes.badge.toUpperCase(), 10, theme.fontFamily, 750) + 16));
        const badgeExtra = slideExtra(context2, node.attributes.badge.toUpperCase(), badgeWidth - 8, 10, 12);
        group.append(svgElement(document, "rect", { x: 18, y: 14, width: badgeWidth, height: 20 + badgeExtra, rx: 10, fill: theme.containerFill }));
        appendSlideText(group, context2, node.attributes.badge.toUpperCase(), { x: 18 + badgeWidth / 2, y: 28, width: badgeWidth - 8, fontSize: 10, lineHeight: 12, weight: 750, color: theme.accentColor, align: "middle" });
      }
      const titleExtra = slideExtra(context2, node.label, node.width - 40, 17, 21, 700);
      const titleY = node.attributes.badge ? 56 + slideExtra(context2, node.attributes.badge.toUpperCase(), node.width - 44, 10, 12) : node.attributes.body ? 36 : node.height / 2 + 6 - titleExtra / 2;
      appendSlideText(group, context2, node.label, { x: 20, y: titleY, width: node.width - 40, fontSize: 17, lineHeight: 21, weight: 700 });
      if (node.attributes.body) appendSlideText(group, context2, node.attributes.body, { x: 20, y: titleY + 30 + titleExtra, width: node.width - 40, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
      return group;
    }
  };
  var slideNoteShape = {
    name: "slide-note",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-note", context2, { width: numericAttribute(attributes, "width", 300, 180, 700), height: numericAttribute(attributes, "height", attributes.body ? 92 : 68, 56, 200) });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 10, fill: theme.containerFill, stroke: theme.containerStroke, "stroke-width": 1 }));
      group.append(svgElement(document, "circle", { cx: 18, cy: 22, r: 5, fill: theme.accentColor }));
      appendSlideText(group, context2, node.label, { x: 32, y: 27, width: node.width - 48, fontSize: 14, lineHeight: 18, weight: 650 });
      if (node.attributes.body) appendSlideText(group, context2, node.attributes.body, { x: 18, y: 54 + slideExtra(context2, node.label, node.width - 48, 14, 18, 650), width: node.width - 36, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
      return group;
    }
  };
  var slideCalloutShape = {
    name: "slide-callout",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-callout", context2, { width: numericAttribute(attributes, "width", 520, 240, 1e3), height: numericAttribute(attributes, "height", attributes.body ? 112 : 82, 70, 240) });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 16, fill: theme.containerFill, stroke: theme.accentColor, "stroke-width": 2 }));
      appendSlideText(group, context2, node.label, { x: 24, y: 36, width: node.width - 48, fontSize: 20, lineHeight: 25, weight: 760, color: theme.accentColor });
      if (node.attributes.body) appendSlideText(group, context2, node.attributes.body, { x: 24, y: 68 + slideExtra(context2, node.label, node.width - 48, 20, 25, 760), width: node.width - 48, fontSize: 13, lineHeight: 18, color: theme.mutedColor });
      return group;
    }
  };
  var slideBadgeShape = {
    name: "slide-badge",
    measure: (context2) => {
      const { label, theme, attributes } = context2;
      return growSlideSize("slide-badge", context2, { width: Math.max(92, labelLayout(label, wrapWidth(attributes, 216), 12, theme.fontFamily, 720).width + 34), height: 36 });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 18, fill: theme.containerFill, stroke: theme.accentColor, "stroke-width": 1.4 }));
      appendSlideText(group, context2, node.label, { x: node.width / 2, y: 23, width: node.width - 20, fontSize: 12, lineHeight: 14, weight: 720, color: theme.accentColor, align: "middle" });
      return group;
    }
  };
  var slideMetricShape = {
    name: "slide-metric",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-metric", context2, {
        width: numericAttribute(attributes, "width", 224, 160, 440),
        height: numericAttribute(attributes, "height", 132, 104, 240)
      });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const accent = node.attributes.tone === "accent";
      group.append(svgElement(document, "rect", {
        width: node.width,
        height: node.height,
        rx: 16,
        fill: accent ? theme.containerFill : theme.nodeFill,
        stroke: accent ? theme.accentColor : theme.nodeStroke,
        "stroke-width": accent ? 2 : theme.nodeStrokeWidth,
        filter: "url(#finch-shadow)"
      }));
      appendSlideText(group, context2, node.attributes.label ?? "METRIC", {
        x: 20,
        y: 27,
        width: node.width - 40,
        fontSize: 11,
        lineHeight: 14,
        weight: 740,
        color: theme.mutedColor
      });
      appendSlideText(group, context2, node.label, {
        x: 20,
        y: 72 + slideExtra(context2, node.attributes.label ?? "METRIC", node.width - 40, 11, 14, 740),
        width: node.width - 40,
        fontSize: 31,
        lineHeight: 34,
        weight: 780,
        color: accent ? theme.accentColor : theme.labelColor
      });
      if (node.attributes.delta) {
        const positive = !/^[-−]/.test(node.attributes.delta.trim());
        const deltaColor = positive ? theme.accentColor : theme.mutedColor;
        const deltaExtra = slideExtra(context2, node.attributes.delta, node.width - 56, 11, 13, 680);
        group.append(svgElement(document, "rect", { x: 18, y: node.height - 32 - deltaExtra, width: node.width - 36, height: 20 + deltaExtra, rx: 10, fill: theme.containerFill }));
        appendSlideText(group, context2, node.attributes.delta, {
          x: 28,
          y: node.height - 18 - deltaExtra,
          width: node.width - 56,
          fontSize: 11,
          lineHeight: 13,
          weight: 680,
          color: deltaColor
        });
      }
      return group;
    }
  };
  var slideBarShape = {
    name: "slide-bar",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-bar", context2, {
        width: numericAttribute(attributes, "width", 560, 260, 1e3),
        height: numericAttribute(attributes, "height", 68, 58, 120)
      });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const maximum = numericAttribute(node.attributes, "max", 100, 1e-4, Number.MAX_SAFE_INTEGER);
      const value = numericAttribute(node.attributes, "value", 0, 0, maximum);
      const ratio = maximum > 0 ? value / maximum : 0;
      const suffix = node.attributes.suffix ?? "";
      const trackX = 16;
      const trackY = node.height - 20;
      const trackWidth = node.width - 32;
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 12, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      appendSlideText(group, context2, node.label, { x: 16, y: 27, width: node.width - 120, fontSize: 14, lineHeight: 17, weight: 650 });
      appendSlideText(group, context2, `${value}${suffix}`, { x: node.width - 52, y: 27, width: 80, fontSize: 15, lineHeight: 17, weight: 760, color: theme.accentColor, align: "middle" });
      group.append(svgElement(document, "rect", { x: trackX, y: trackY, width: trackWidth, height: 8, rx: 4, fill: theme.containerFill }));
      group.append(svgElement(document, "rect", { x: trackX, y: trackY, width: ratio === 0 ? 0 : Math.max(8, trackWidth * ratio), height: 8, rx: 4, fill: theme.accentColor }));
      return group;
    }
  };
  var slideQuoteShape = {
    name: "slide-quote",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-quote", context2, {
        width: numericAttribute(attributes, "width", 640, 300, 1100),
        height: numericAttribute(attributes, "height", 172, 120, 320)
      });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 18, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      group.append(svgElement(document, "rect", { width: 8, height: node.height, rx: 4, fill: theme.accentColor }));
      const mark = svgElement(document, "text", { x: 28, y: 60, fill: theme.accentColor, "font-family": theme.fontFamily, "font-size": 52, "font-weight": 800 });
      mark.textContent = "\u201C";
      group.append(mark);
      appendSlideText(group, context2, node.label, { x: 76, y: 43, width: node.width - 104, fontSize: 18, lineHeight: 25, weight: 620 });
      if (node.attributes.by) {
        const attribution = node.attributes.role ? `${node.attributes.by} \xB7 ${node.attributes.role}` : node.attributes.by;
        appendSlideText(group, context2, attribution, { x: 76, y: node.height - 24 - slideExtra(context2, attribution, node.width - 104, 12, 15, 650), width: node.width - 104, fontSize: 12, lineHeight: 15, weight: 650, color: theme.mutedColor });
      }
      return group;
    }
  };
  var slideMilestoneShape = {
    name: "slide-milestone",
    measure: (context2) => {
      const { attributes } = context2;
      return growSlideSize("slide-milestone", context2, {
        width: numericAttribute(attributes, "width", 200, 150, 380),
        height: numericAttribute(attributes, "height", attributes.body ? 148 : 116, 100, 260)
      });
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", { x: 14, y: 18, width: node.width - 14, height: node.height - 18, rx: 14, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      group.append(svgElement(document, "circle", { cx: 20, cy: 38, r: 17, fill: theme.accentColor, stroke: theme.nodeFill, "stroke-width": 5 }));
      const dot = svgElement(document, "text", { x: 20, y: 43, "text-anchor": "middle", fill: theme.nodeFill, "font-family": theme.fontFamily, "font-size": 15, "font-weight": 800 });
      dot.textContent = node.attributes.step ?? "\u2022";
      group.append(dot);
      if (node.attributes.period) appendSlideText(group, context2, node.attributes.period.toUpperCase(), { x: 50, y: 36, width: node.width - 68, fontSize: 10, lineHeight: 12, weight: 760, color: theme.accentColor });
      const periodExtra = slideExtra(context2, node.attributes.period?.toUpperCase() ?? "", node.width - 68, 10, 12, 760);
      appendSlideText(group, context2, node.label, { x: 50, y: (node.attributes.period ? 61 : 43) + periodExtra, width: node.width - 68, fontSize: 16, lineHeight: 20, weight: 720 });
      if (node.attributes.body) appendSlideText(group, context2, node.attributes.body, { x: 32, y: (node.attributes.period ? 95 : 88) + periodExtra + slideExtra(context2, node.label, node.width - 68, 16, 20, 720), width: node.width - 50, fontSize: 12, lineHeight: 17, color: theme.mutedColor });
      return group;
    }
  };
  var slideGroupShape = {
    name: "slide-group",
    measure: () => ({ width: 1, height: 1 }),
    render(context2) {
      return groupFor(context2);
    }
  };
  function memberVisibility(group, text, member, context2) {
    const size = Number(context2.node.attributes.visibilityIconSize);
    if (!size || member.visibilityEscaped || member.kind === "separator") return;
    const match = member.text.match(/^([+#~\-])\s*(.*)$/);
    if (!match) return;
    const symbol = match[1], name = { "+": "public", "-": "private", "#": "protected", "~": "package" }[symbol];
    const x = Number(text.getAttribute("x")) + size / 2, y = Number(text.getAttribute("y")) - size / 2;
    const icon = svgElement(context2.document, "g", { class: "finch-visibility-icon", "data-visibility": name, "aria-label": name });
    const filled = member.kind === "operation";
    const attrs = { fill: filled ? context2.theme.labelColor : "none", stroke: context2.theme.labelColor, "stroke-width": 1.2 };
    if (symbol === "+") icon.append(svgElement(context2.document, "circle", { cx: x, cy: y, r: size / 2, ...attrs }));
    else if (symbol === "-") icon.append(svgElement(context2.document, "rect", { x: x - size / 2, y: y - size / 2, width: size, height: size, ...attrs }));
    else icon.append(svgElement(context2.document, "path", { d: symbol === "#" ? `M${x} ${y - size / 2} L${x + size / 2} ${y} L${x} ${y + size / 2} L${x - size / 2} ${y} Z` : `M${x} ${y - size / 2} L${x + size / 2} ${y + size / 2} H${x - size / 2} Z`, ...attrs }));
    text.setAttribute("x", String(Number(text.getAttribute("x")) + size + 6));
    text.textContent = match[2];
    group.append(icon);
  }
  function umlMembers(attributes) {
    try {
      const value = JSON.parse(attributes.members ?? "[]");
      const hidden2 = JSON.parse(attributes.hiddenMembers ?? "[]");
      return Array.isArray(value) ? value.filter((_, index) => !hidden2.includes(index)) : [];
    } catch {
      return [];
    }
  }
  var umlClassShape = {
    name: "uml-class",
    measure: ({ label, attributes, theme }) => {
      const members = umlMembers(attributes);
      const title = labelLayout((attributes.visibility ?? "") + label, wrapWidth(attributes, 216), theme.fontSize + 1, theme.fontFamily, 720);
      const longest = Math.max(title.width, attributes.templateParameters ? textWidth(attributes.templateParameters, theme.fontSize - 2) + 20 : 0, ...members.map((member) => textWidth(member.text, theme.fontSize - 1)));
      const stereotypeHeight = (attributes.hideStereotype === "true" || attributes.kind === "class" && !attributes.stereotype ? 0 : 18) + (attributes.templateParameters ? 26 : 0);
      const attributeRows = Math.max((attributes.hideEmptyFields ?? attributes.hideEmptyMembers) === "true" ? 0 : 1, members.filter((member) => member.kind !== "operation").length);
      const operationRows = Math.max((attributes.hideEmptyOperations ?? attributes.hideEmptyMembers ?? "true") === "true" ? 0 : 1, members.filter((member) => member.kind === "operation").length);
      if (attributes.customCompartments === "true") return { width: Math.max(210, longest + 34), height: 46 + stereotypeHeight + (title.lines.length - 1) * title.lineHeight + members.length * 23 + 12 };
      return { width: Math.max(210, longest + 34), height: 46 + stereotypeHeight + (title.lines.length - 1) * title.lineHeight + attributeRows * 23 + operationRows * 23 + 12 };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const members = umlMembers(node.attributes);
      const kind = node.attributes.kind ?? "class";
      const stereotypeHeight = (node.attributes.hideStereotype === "true" || kind === "class" && !node.attributes.stereotype ? 0 : 18) + (node.attributes.templateParameters ? 26 : 0);
      const titleLayout = labelLayout((node.attributes.visibility ?? "") + node.label, Math.min(node.width - 34, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 720);
      const headerHeight = 46 + stereotypeHeight + (titleLayout.lines.length - 1) * titleLayout.lineHeight;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, rx: 4, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      if (node.attributes.hideStereotype !== "true" && (kind !== "class" || node.attributes.stereotype)) {
        const stereotype = svgElement(document, "text", { x: node.width / 2, y: node.attributes.templateParameters ? 43 : 17, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2 });
        const spot = node.attributes.stereotype?.match(/^\(\s*([^,()])\s*,\s*(#[\da-fA-F]{3,8}|[A-Za-z]+)\s*\)\s*(.*)$/);
        stereotype.textContent = `\xAB${[kind !== "class" ? kind : "", spot ? spot[3] : node.attributes.stereotype].filter(Boolean).join(", ")}\xBB`;
        if (spot) {
          const y2 = node.attributes.templateParameters ? 39 : 13;
          const badge = svgElement(document, "g", { class: "finch-stereotype-spot" });
          badge.append(svgElement(document, "circle", { cx: 17, cy: y2, r: 10, fill: spot[2], stroke: theme.nodeStroke }));
          const letter = svgElement(document, "text", { x: 17, y: y2 + 4, "text-anchor": "middle", "font-family": theme.fontFamily, "font-size": 12, "font-weight": 700, fill: "#111827" });
          letter.textContent = spot[1];
          badge.append(letter);
          group.append(badge);
        }
        group.append(stereotype);
      }
      if (node.attributes.templateParameters) {
        const width = textWidth(node.attributes.templateParameters, theme.fontSize - 2) + 16;
        group.append(svgElement(document, "rect", { x: node.width - width - 4, y: 4, width, height: 22, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-dasharray": "4 3", class: "finch-template-parameters" }));
        const template = svgElement(document, "text", { x: node.width - width / 2 - 4, y: 19, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2 });
        template.textContent = node.attributes.templateParameters;
        group.append(template);
      }
      const title = svgElement(document, "text", { x: node.width / 2, y: 30 + stereotypeHeight, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize + 1, "font-weight": 720, "font-style": kind === "abstract" ? "italic" : void 0 });
      setTextLines(title, (node.attributes.visibility ?? "") + node.label, Math.min(node.width - 34, wrapWidth(node.attributes, 216)), theme.fontSize + 1, theme.fontFamily, 720);
      group.append(title, svgElement(document, "line", { x1: 0, y1: headerHeight, x2: node.width, y2: headerHeight, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      if (node.attributes.customCompartments === "true") {
        members.forEach((member, index) => {
          const y2 = headerHeight + 20 + index * 23;
          if (member.kind === "separator") {
            const width = member.text ? textWidth(member.text, theme.fontSize - 1, theme.fontFamily) + 16 : 0;
            for (const [x1, x2] of [[0, (node.width - width) / 2], [(node.width + width) / 2, node.width]]) group.append(svgElement(document, "line", { x1, x2, y1: y2 - 5, y2: y2 - 5, stroke: theme.nodeStroke, "stroke-width": member.separator === "==" ? 2 : theme.nodeStrokeWidth, "stroke-dasharray": member.separator === ".." ? "3 3" : void 0, class: "finch-compartment-separator" }));
          }
          const text = svgElement(document, "text", { x: member.kind === "separator" ? node.width / 2 : 12, y: y2, "text-anchor": member.kind === "separator" ? "middle" : "start", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-style": member.abstract ? "italic" : void 0, "text-decoration": member.static ? "underline" : void 0 });
          text.textContent = member.text;
          memberVisibility(group, text, member, context2);
          group.append(text);
        });
        return group;
      }
      const attributes = members.filter((member) => member.kind !== "operation");
      const operations = members.filter((member) => member.kind === "operation");
      let y = headerHeight + 20;
      for (const member of attributes) {
        const text = svgElement(document, "text", { x: 12, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1, "font-style": member.kind === "literal" ? "italic" : void 0 });
        text.textContent = member.text;
        memberVisibility(group, text, member, context2);
        if (member.static) text.setAttribute("text-decoration", "underline");
        if (member.abstract) text.setAttribute("font-style", "italic");
        group.append(text);
        y += 23;
      }
      if (operations.length || (node.attributes.hideEmptyOperations ?? node.attributes.hideEmptyMembers ?? "true") === "false") {
        const separatorY = headerHeight + Math.max((node.attributes.hideEmptyFields ?? node.attributes.hideEmptyMembers) === "true" ? 0 : 1, attributes.length) * 23;
        group.append(svgElement(document, "line", { x1: 0, y1: separatorY, x2: node.width, y2: separatorY, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
        y = separatorY + 21;
        for (const member of operations) {
          const text = svgElement(document, "text", { x: 12, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
          text.textContent = member.text;
          memberVisibility(group, text, member, context2);
          if (member.static) text.setAttribute("text-decoration", "underline");
          if (member.abstract) text.setAttribute("font-style", "italic");
          group.append(text);
          y += 23;
        }
      }
      return group;
    }
  };
  var umlMapShape = {
    name: "uml-map",
    measure({ label, theme, attributes }) {
      const entries = JSON.parse(attributes.mapEntries ?? "[]");
      const width = (values) => Math.max(50, ...values.map((value) => textWidth(value, theme.fontSize, theme.fontFamily) + 24));
      return { width: Math.max(160, textWidth(label, theme.fontSize, theme.fontFamily) + 32, width(entries.map((e) => e.key)) + width(entries.map((e) => e.value))), height: 42 + Math.max(1, entries.length) * 28 };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const entries = JSON.parse(node.attributes.mapEntries ?? "[]");
      const group = groupFor(context2);
      const divider = Math.max(50, ...entries.map((e) => textWidth(e.key, theme.fontSize, theme.fontFamily) + 24));
      group.append(svgElement(document, "rect", { width: node.width, height: node.height, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      const text = (value, x, y, header2 = false) => {
        const label = svgElement(document, "text", { x, y, fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize, "text-anchor": header2 ? "middle" : "start", "font-weight": header2 ? 720 : 400 });
        label.textContent = value;
        group.append(label);
      };
      const line = (x1, y1, x2, y2) => group.append(svgElement(document, "line", { x1, y1, x2, y2, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      text(node.label, node.width / 2, 27, true);
      line(0, 42, node.width, 42);
      line(divider, 42, divider, node.height);
      entries.forEach((entry, i) => {
        text(entry.key, 12, 62 + i * 28);
        text(entry.value, divider + 12, 62 + i * 28);
        if (i) line(0, 42 + i * 28, node.width, 42 + i * 28);
      });
      return group;
    }
  };
  var umlInstanceShape = {
    ...umlClassShape,
    name: "uml-instance",
    render(context2) {
      const group = umlClassShape.render(context2);
      group.querySelector('text[font-weight="720"]')?.setAttribute("text-decoration", "underline");
      return group;
    }
  };
  var umlStateShape = {
    ...umlClassShape,
    name: "uml-state",
    render(context2) {
      const group = umlClassShape.render(context2);
      group.querySelector("rect")?.setAttribute("rx", "12");
      return group;
    }
  };
  var usecaseShape = {
    name: "usecase",
    measure: ({ label, theme, attributes }) => {
      const text = nodeLabelLayout(label, attributes, theme, 180);
      return { width: Math.max(150, Math.ceil((text.width + (attributes.business === "true" ? 60 : 36)) * Math.SQRT2)), height: Math.max(72, Math.ceil((text.height + 24) * Math.SQRT2)) };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "ellipse", { cx: node.width / 2, cy: node.height / 2, rx: node.width / 2, ry: node.height / 2, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      if (node.attributes.business === "true") {
        const point = (angle) => ({ x: node.width / 2 * (1 + Math.cos(angle)), y: node.height / 2 * (1 + Math.sin(angle)) });
        const a = point(-Math.PI / 3), b = point(-Math.PI / 18);
        group.append(svgElement(document, "line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, class: "finch-business-mark" }));
      }
      addLabel(group, context2, 0, 27, 180);
      return group;
    }
  };
  var umlArtifactShape = {
    name: "uml-artifact",
    measure: ({ label, theme, attributes }) => {
      const size = wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 132, minimumHeight: 46, paddingX: 20 });
      return { width: size.width + (attributes?.noteShape === "hnote" ? 32 : 0), height: Math.max(66, size.height + 20) };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      if (node.attributes.noteShape === "rnote" || node.attributes.noteShape === "hnote") {
        const style = { fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" };
        if (node.attributes.noteShape === "rnote") group.append(svgElement(document, "rect", { width: node.width, height: node.height, ...style }));
        else group.append(svgElement(document, "polygon", { points: `16,0 ${node.width - 16},0 ${node.width},${node.height / 2} ${node.width - 16},${node.height} 16,${node.height} 0,${node.height / 2}`, ...style }));
        addLabel(group, context2);
        return group;
      }
      const fold = 16;
      group.append(svgElement(document, "path", { d: `M 0 0 H ${node.width - fold} L ${node.width} ${fold} V ${node.height} H 0 Z`, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      group.append(svgElement(document, "path", { d: `M ${node.width - fold} 0 V ${fold} H ${node.width}`, fill: "none", stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      const stereotype = svgElement(document, "text", { x: node.width / 2, y: 20, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3 });
      stereotype.textContent = "\xABartifact\xBB";
      const plain = node.attributes.annotationTarget || node.attributes.standaloneNote || node.shape === "uml-file";
      const defaultStereotype = !plain && !node.attributes.stereotype && node.attributes.hideStereotype !== "true";
      if (defaultStereotype) group.append(stereotype);
      addLabel(group, context2, defaultStereotype ? 10 : 0, node.shape === "uml-file" ? 20 : plain ? 0 : 20);
      return group;
    }
  };
  var umlFileShape = {
    ...umlArtifactShape,
    name: "uml-file"
  };
  var umlNodeShape = {
    name: "uml-node",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 140, minimumHeight: 76, paddingX: 32, paddingY: 24 }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "path", {
        d: containerOutlinePath({ ...node, attributes: { ...node.attributes, containerStyle: "node" } }, theme),
        fill: theme.nodeFill,
        stroke: theme.nodeStroke,
        "stroke-width": theme.nodeStrokeWidth
      }));
      addLabel(group, context2, 6, 32);
      return group;
    }
  };
  var umlDeviceShape = {
    name: "uml-device",
    measure: ({ label, theme, attributes }) => {
      const size = wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 140, minimumHeight: 46, paddingX: 22 });
      return { width: size.width, height: Math.max(76, size.height + 22) };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "path", { d: `M 0 12 L 12 0 H ${node.width} V ${node.height - 12} L ${node.width - 12} ${node.height} H 0 Z M 0 12 H ${node.width - 12} L ${node.width} 0 M ${node.width - 12} 12 V ${node.height}`, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth, filter: "url(#finch-shadow)" }));
      const defaultStereotype = !node.attributes.stereotype && node.attributes.hideStereotype !== "true";
      if (defaultStereotype) {
        const stereotype = svgElement(document, "text", { x: node.width / 2, y: 25, "text-anchor": "middle", fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 3 });
        stereotype.textContent = "\xABdevice\xBB";
        group.append(stereotype);
      }
      addLabel(group, context2, defaultStereotype ? 11 : 6, 22);
      return group;
    }
  };
  var umlExecutionShape = {
    name: "uml-execution",
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { minimumWidth: 146, minimumHeight: 68, paddingX: 23, paddingY: 16 }),
    render(context2) {
      const group = rectangleShape.render(context2);
      group.append(svgElement(context2.document, "rect", { x: 6, y: 6, width: context2.node.width - 12, height: context2.node.height - 12, rx: 4, fill: "none", stroke: context2.theme.containerStroke, "stroke-width": 1 }));
      return group;
    }
  };
  var umlPortShape = {
    name: "uml-port",
    measure: ({ label, theme, attributes }) => {
      const text = labelLayout(label, wrapWidth(attributes, 140), theme.fontSize - 2, theme.fontFamily);
      return { width: Math.max(26, attributes.portLabelSide === "left" ? 2 * (text.width + 18) : text.width + 12), height: 34 + text.height };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "rect", { x: node.width / 2 - 11, y: 2, width: 22, height: 22, fill: theme.nodeFill, stroke: theme.accentColor, "stroke-width": 1.7 }));
      const label = svgElement(document, "text", { x: node.attributes.portLabelSide === "left" ? node.width / 2 - 18 : node.width / 2, y: 36, "text-anchor": node.attributes.portLabelSide === "left" ? "end" : "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 2, class: "finch-port-label" });
      setTextLines(label, node.label, Math.min(node.width - 12, wrapWidth(node.attributes, 140)), theme.fontSize - 2, theme.fontFamily);
      group.append(label);
      return group;
    }
  };
  var umlProvidedInterfaceShape = {
    name: "uml-provided-interface",
    measure: ({ label, theme, attributes }) => {
      const text = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize - 1, theme.fontFamily);
      return { width: Math.max(40, text.width + 20), height: 38 + text.height };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "circle", { cx: node.width / 2, cy: 14, r: 10, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      const label = svgElement(document, "text", { x: node.width / 2, y: 38, "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
      setTextLines(label, node.label, Math.min(node.width - 20, wrapWidth(node.attributes, 216)), theme.fontSize - 1, theme.fontFamily);
      group.append(label);
      return group;
    }
  };
  var umlRequiredInterfaceShape = {
    name: "uml-required-interface",
    measure: ({ label, theme, attributes }) => {
      const text = labelLayout(label, wrapWidth(attributes, 216), theme.fontSize - 1, theme.fontFamily);
      const labelY = Math.max(57, 44 + theme.fontSize - 1);
      return { width: Math.max(76, text.width + 20), height: labelY - 1 + text.height };
    },
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      group.append(svgElement(document, "path", { class: "finch-required-interface-arc", d: requiredInterfacePath(node), fill: "none", stroke: theme.accentColor, "stroke-width": 2 }));
      const label = svgElement(document, "text", { x: node.width / 2, y: Math.max(57, 44 + theme.fontSize - 1), "text-anchor": "middle", fill: theme.labelColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
      setTextLines(label, node.label, Math.min(node.width - 20, wrapWidth(node.attributes, 216)), theme.fontSize - 1, theme.fontFamily);
      group.append(label);
      return group;
    }
  };
  var umlBarShape = {
    name: "uml-bar",
    measure: () => ({ width: 96, height: 14 }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "rect", { y: 3, width: context2.node.width, height: 8, rx: 3, fill: context2.theme.labelColor }));
      return group;
    }
  };
  var choiceStateShape = {
    name: "choice-state",
    measure: () => ({ width: 32, height: 32 }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "polygon", { points: "16,1 31,16 16,31 1,16", fill: context2.theme.nodeFill, stroke: context2.theme.labelColor, "stroke-width": 1.5 }));
      return group;
    }
  };
  function historyShape(name, deep) {
    return {
      name,
      measure: () => ({ width: 36, height: 36 }),
      render(context2) {
        const group = groupFor(context2);
        group.append(svgElement(context2.document, "circle", { cx: 18, cy: 18, r: 16, fill: context2.theme.nodeFill, stroke: context2.theme.labelColor, "stroke-width": 1.5 }));
        const text = svgElement(context2.document, "text", { x: 18, y: 23, "text-anchor": "middle", fill: context2.theme.labelColor, "font-family": context2.theme.fontFamily, "font-size": 13, "font-weight": 700 });
        text.textContent = deep ? "H*" : "H";
        group.append(text);
        return group;
      }
    };
  }
  function connectionPointShape(name, exit) {
    return {
      name,
      measure: () => ({ width: 24, height: 24 }),
      render(context2) {
        const group = groupFor(context2);
        group.append(svgElement(context2.document, "circle", { cx: 12, cy: 12, r: 10, fill: context2.theme.nodeFill, stroke: context2.theme.labelColor, "stroke-width": 1.5 }));
        if (exit) group.append(svgElement(context2.document, "path", { d: "M5 5 L19 19 M19 5 L5 19", stroke: context2.theme.labelColor, "stroke-width": 1.5 }));
        const title = svgElement(context2.document, "title", {});
        title.textContent = context2.node.attributes.ref ? `${context2.node.label}: ${context2.node.attributes.ref}` : context2.node.label;
        group.append(title);
        return group;
      }
    };
  }
  var signalShapes = ["signal-send", "signal-receive"].map((name) => ({
    name,
    measure: ({ label, theme, attributes }) => wrappedLabelSize(label, { theme, attributes }, { paddingX: 30 }),
    render(context2) {
      const { node, theme, document } = context2;
      const group = groupFor(context2);
      const points = name === "signal-send" ? `0,0 ${node.width - 20},0 ${node.width},${node.height / 2} ${node.width - 20},${node.height} 0,${node.height}` : `0,0 ${node.width},0 ${node.width},${node.height} 0,${node.height} 20,${node.height / 2}`;
      group.append(svgElement(document, "polygon", { points, ...node.attributes.facing === "left" ? { transform: `translate(${node.width} 0) scale(-1 1)` } : {}, fill: theme.nodeFill, stroke: theme.nodeStroke, "stroke-width": theme.nodeStrokeWidth }));
      addLabel(group, context2, 0, 30);
      return group;
    }
  }));
  var statePinShapes = ["state-input-pin", "state-output-pin"].map((name) => ({
    name,
    measure: () => ({ width: 20, height: 20 }),
    render(context2) {
      const group = groupFor(context2);
      group.append(svgElement(context2.document, "rect", { x: 2, y: 2, width: 16, height: 16, fill: context2.theme.nodeFill, stroke: context2.theme.labelColor, "stroke-width": 1.5, class: "finch-state-pin" }));
      const title = svgElement(context2.document, "title", {});
      title.textContent = context2.node.label;
      group.append(title);
      return group;
    }
  }));
  var entryPointShape = connectionPointShape("entry-point", false);
  var exitPointShape = connectionPointShape("exit-point", true);
  var historyStateShape = historyShape("history-state", false);
  var deepHistoryStateShape = historyShape("deep-history-state", true);
  var umlObjectShape = {
    ...rectangleShape,
    name: "uml-object",
    render(context2) {
      const group = rectangleShape.render(context2);
      group.querySelector("text").setAttribute("text-decoration", "underline");
      return group;
    }
  };
  var builtInShapes = [
    rectangleShape,
    labelShape,
    collectionsShape,
    stackShape,
    roundedShape,
    storageShape,
    processShape,
    databaseShape,
    queueShape,
    cardShape,
    hexagonShape,
    actorShape,
    personShape,
    ...sequenceRoleShapes,
    containerShape,
    serverShape,
    diamondShape,
    parallelogramShape,
    circleShape,
    initialStateShape,
    entryPointShape,
    ...statePinShapes,
    ...signalShapes,
    exitPointShape,
    finalStateShape,
    terminateStateShape,
    junctionStateShape,
    entityShape,
    componentShape,
    externalShape,
    cloudShape,
    slideTitleShape,
    slideSubtitleShape,
    slideCardShape,
    slideNoteShape,
    slideCalloutShape,
    slideBadgeShape,
    slideMetricShape,
    slideBarShape,
    slideQuoteShape,
    slideMilestoneShape,
    slideGroupShape,
    umlClassShape,
    umlInstanceShape,
    umlMapShape,
    umlStateShape,
    usecaseShape,
    umlArtifactShape,
    umlFileShape,
    umlNodeShape,
    umlDeviceShape,
    umlExecutionShape,
    umlPortShape,
    umlRequiredInterfaceShape,
    umlProvidedInterfaceShape,
    umlBarShape,
    choiceStateShape,
    historyStateShape,
    deepHistoryStateShape,
    umlObjectShape
  ];

  // src/edge-jumps.ts
  var INTERSECTION_EPSILON = 1e-3;
  var DEFAULT_EDGE_JUMP_RADIUS = 6;
  function isRenderedEdge(edge) {
    return edge.attributes?.hidden !== "true" && !["ref", "delay", "divider", "note"].includes(edge.attributes?.messageKind ?? "");
  }
  function pathWithEdgeJumps(edge, lowerEdges, radius = DEFAULT_EDGE_JUMP_RADIUS) {
    if (radius <= 0 || edge.points.length < 2 || lowerEdges.length === 0) return pathFromPoints(edge.points);
    const points = simplifyPoints(edge.points);
    const lowerPaths = lowerEdges.filter(isRenderedEdge).map((lowerEdge) => simplifyPoints(lowerEdge.points));
    const jumpsBySegment = points.slice(0, -1).map(() => []);
    let jumpCount = 0;
    for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
      const start = points[segmentIndex];
      const end = points[segmentIndex + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length <= radius * 2) continue;
      for (const lowerPoints of lowerPaths) {
        for (let lowerIndex = 0; lowerIndex < lowerPoints.length - 1; lowerIndex += 1) {
          const intersection = segmentIntersection(start, end, lowerPoints[lowerIndex], lowerPoints[lowerIndex + 1]);
          if (!intersection) continue;
          const distance = intersection.t * length;
          if (distance <= radius || distance >= length - radius) continue;
          const jumps = jumpsBySegment[segmentIndex];
          if (jumps.some((jump) => Math.abs(jump.distance - distance) < radius * 2)) continue;
          jumps.push({ distance, point: intersection.point });
          jumpCount += 1;
        }
      }
    }
    if (jumpCount === 0) return pathFromPoints(edge.points);
    const commands = [`M ${coordinate(points[0].x)} ${coordinate(points[0].y)}`];
    for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
      const start = points[segmentIndex];
      const end = points[segmentIndex + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const unitX = (end.x - start.x) / length;
      const unitY = (end.y - start.y) / length;
      const jumps = jumpsBySegment[segmentIndex].sort((a, b) => a.distance - b.distance);
      for (const jump of jumps) {
        const before = { x: jump.point.x - unitX * radius, y: jump.point.y - unitY * radius };
        const after = { x: jump.point.x + unitX * radius, y: jump.point.y + unitY * radius };
        commands.push(`L ${coordinate(before.x)} ${coordinate(before.y)}`);
        commands.push(`A ${coordinate(radius)} ${coordinate(radius)} 0 0 1 ${coordinate(after.x)} ${coordinate(after.y)}`);
      }
      commands.push(`L ${coordinate(end.x)} ${coordinate(end.y)}`);
    }
    return commands.join(" ");
  }
  function simplifyPoints(points) {
    const simplified = [];
    for (const point of points) {
      const last = simplified[simplified.length - 1];
      if (!last || Math.hypot(point.x - last.x, point.y - last.y) > INTERSECTION_EPSILON) simplified.push(point);
    }
    let index = 1;
    while (index < simplified.length - 1) {
      const previous = simplified[index - 1];
      const current = simplified[index];
      const next = simplified[index + 1];
      const first = { x: current.x - previous.x, y: current.y - previous.y };
      const second = { x: next.x - current.x, y: next.y - current.y };
      if (Math.abs(cross(first, second)) <= INTERSECTION_EPSILON && first.x * second.x + first.y * second.y >= 0) {
        simplified.splice(index, 1);
      } else {
        index += 1;
      }
    }
    return simplified;
  }
  function segmentIntersection(firstStart, firstEnd, secondStart, secondEnd) {
    const first = { x: firstEnd.x - firstStart.x, y: firstEnd.y - firstStart.y };
    const second = { x: secondEnd.x - secondStart.x, y: secondEnd.y - secondStart.y };
    const denominator = cross(first, second);
    if (Math.abs(denominator) <= INTERSECTION_EPSILON) return void 0;
    const offset = { x: secondStart.x - firstStart.x, y: secondStart.y - firstStart.y };
    const t = cross(offset, second) / denominator;
    const u = cross(offset, first) / denominator;
    if (t <= INTERSECTION_EPSILON || t >= 1 - INTERSECTION_EPSILON) return void 0;
    if (u <= INTERSECTION_EPSILON || u >= 1 - INTERSECTION_EPSILON) return void 0;
    return {
      point: { x: firstStart.x + first.x * t, y: firstStart.y + first.y * t },
      t
    };
  }
  function cross(first, second) {
    return first.x * second.y - first.y * second.x;
  }
  function coordinate(value) {
    return String(round(value));
  }

  // src/edge-labels.ts
  function relationLabel(edge, from, to) {
    const label = edge.label ?? "", direction = edge.attributes?.labelDirection;
    if (!direction || edge.points.length < 2) return label;
    const first = from ?? edge.points[0], last = to ?? edge.points[edge.points.length - 1], sign = direction === "forward" ? 1 : -1;
    const dx = (last.x - first.x) * sign, dy = (last.y - first.y) * sign;
    const arrow = Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? "\u25B6" : "\u25C0" : dy >= 0 ? "\u25BC" : "\u25B2";
    return `${label} ${arrow}`;
  }
  function estimatedTextWidth(text, fontSize) {
    const plain = richRuns(text).map((run) => run.text).join("");
    return [...plain].reduce((width, character) => width + fontSize * (/[^\u0000-\u00ff]/.test(character) ? 1 : 0.62), 0);
  }
  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
  function labelSegments(points) {
    const result = [];
    for (const point of points) {
      const previous = result[result.length - 1];
      if (previous?.x === point.x && previous.y === point.y) continue;
      const before = result[result.length - 2];
      if (before && previous && (before.x === previous.x && previous.x === point.x && (previous.y - before.y) * (point.y - previous.y) >= 0 || before.y === previous.y && previous.y === point.y && (previous.x - before.x) * (point.x - previous.x) >= 0)) result.pop();
      result.push(point);
    }
    return result;
  }
  function segmentHits(from, to, box) {
    if (from.x === to.x) return from.x > box.x && from.x < box.x + box.width && Math.max(from.y, to.y) > box.y && Math.min(from.y, to.y) < box.y + box.height;
    if (from.y === to.y) return from.y > box.y && from.y < box.y + box.height && Math.max(from.x, to.x) > box.x && Math.min(from.x, to.x) < box.x + box.width;
    return overlaps({ x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), width: Math.abs(from.x - to.x), height: Math.abs(from.y - to.y) }, box);
  }
  function cardinalityPoint(edge, endpoint) {
    const points = endpoint === "start" ? edge.points : [...edge.points].reverse();
    let origin = points[0] ?? { x: 0, y: 0 };
    let remaining = 18;
    for (const target of points.slice(1)) {
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const length = Math.hypot(dx, dy);
      if (length >= remaining && length > 0) {
        const point = { x: origin.x + dx * remaining / length, y: origin.y + dy * remaining / length };
        if (Math.abs(dy) > Math.abs(dx)) point.x += estimatedTextWidth(endpointText(edge, endpoint) ?? "", 14) / 2 + 14;
        return point;
      }
      remaining -= length;
      origin = target;
    }
    return origin;
  }
  function textBounds(point, width, fontSize, extraHeight = 0) {
    return { x: point.x - width / 2 - 4, y: point.y - fontSize - 4, width: width + 8, height: fontSize * 1.3 + 8 + extraHeight };
  }
  function endpointText(edge, endpoint) {
    const role = edge.attributes?.[endpoint === "start" ? "fromRole" : "toRole"];
    const count = edge.attributes?.[endpoint === "start" ? "fromCardinality" : "toCardinality"];
    return role && count ? `${role} [${count}]` : role ?? count;
  }
  function placeEdgeLabels(geometry, fontSize, measure = (text) => estimatedTextWidth(text, fontSize)) {
    const labels = /* @__PURE__ */ new Map();
    const reserved = [];
    for (const edge of geometry.edges) for (const endpoint of ["start", "end"]) {
      const text = endpointText(edge, endpoint);
      if (!text) continue;
      const point = cardinalityPoint(edge, endpoint);
      reserved.push(textBounds({ x: point.x, y: point.y - 6 }, measure(text), fontSize));
    }
    const obstacles = geometry.nodes.map((node) => node.shape === "container" ? { x: node.x, y: node.y, width: node.width, height: (node.headerHeight ?? 42) - 10 } : { x: node.x - 6, y: node.y - 6, width: node.width + 12, height: node.height + 12 });
    for (const group of geometry.groups) obstacles.push({ x: group.x, y: group.y, width: group.width, height: group.headerHeight ?? 24 });
    const outgoing = /* @__PURE__ */ new Map();
    for (const edge of geometry.edges) outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    for (const edge of geometry.edges) {
      if (!edge.label || !edge.points.length) continue;
      const maximumWidth = wrapWidth(edge.attributes, 180);
      const lineHeight = Math.ceil(fontSize * 1.4);
      const route = labelSegments(edge.points);
      const branch = ["flowchart", "activity"].includes(geometry.kind) && (outgoing.get(edge.from) ?? 0) > 1;
      const candidates = [];
      let traveled = 0;
      for (let i = 1; i < route.length; i += 1) {
        const from = route[i - 1];
        const to = route[i];
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        if (!length) continue;
        const horizontal = from.y === to.y;
        const label = relationLabel(edge, from, to);
        const tokenWidth = Math.max(48, ...label.split(/\s+/).map(measure));
        const lines2 = wrappedLines(label, horizontal ? Math.min(maximumWidth, Math.max(tokenWidth, length - 24)) : maximumWidth, measure);
        const width = Math.max(0, ...lines2.map(measure));
        const extraHeight = (lines2.length - 1) * lineHeight;
        const needed = horizontal ? width + 16 : fontSize * 1.3 + extraHeight + 16;
        const near = Math.min(0.5, (needed / 2 + 8) / length);
        for (const fraction of branch ? [near, 0.5, 1 - near] : [0.5, near, 1 - near]) {
          const x = from.x + (to.x - from.x) * fraction;
          const y = from.y + (to.y - from.y) * fraction;
          for (const offset of [0, 12, 24]) for (const side of [-1, 1]) {
            const point = horizontal ? { x, y: y + (side < 0 ? -8 - extraHeight - offset : fontSize + 8 + offset) } : { x: x + side * (width / 2 + 10 + offset), y: y + fontSize * 0.35 - extraHeight / 2 };
            candidates.push({
              placement: { ...textBounds(point, width, fontSize, extraHeight), point, lines: lines2, lineHeight },
              preference: Math.max(0, needed - length) * 4 + (branch ? (traveled + length * fraction) * 0.15 : horizontal ? 0 : 30) + Math.abs(fraction - 0.5) * (branch ? 0 : 10) + (side > 0 ? 1 : 0) + lines2.length * 2 + offset * 2
            });
          }
        }
        traveled += length;
      }
      const score = ({ placement: placement2, preference }) => {
        let value = preference;
        for (const box of [...obstacles, ...reserved]) if (overlaps(placement2, box)) value += 1e5;
        for (const other of geometry.edges) for (let i = 1; i < other.points.length; i += 1) {
          if (segmentHits(other.points[i - 1], other.points[i], placement2)) value += 1e3;
        }
        return value;
      };
      const ranked = candidates.map((candidate) => ({ ...candidate, score: score(candidate) })).sort((a, b) => a.score - b.score);
      const fallback = { x: edge.points[0].x, y: edge.points[0].y - 8 };
      const lines = wrappedLines(relationLabel(edge), maximumWidth, measure);
      const placement = ranked[0]?.placement ?? {
        ...textBounds(fallback, Math.max(0, ...lines.map(measure)), fontSize, (lines.length - 1) * lineHeight),
        point: fallback,
        lines,
        lineHeight
      };
      labels.set(edge.id, placement);
      reserved.push(placement);
    }
    return { labels, bounds: reserved };
  }
  function fitVisualBounds(geometry, minimum, labels, padding = 28) {
    const boxes = [...geometry.nodes, ...geometry.groups, ...labels];
    if (geometry.kind === "sequence") for (const edge of geometry.edges.filter((edge2) => edge2.attributes?.messageKind === "note")) {
      const ids = edge.attributes.participants.split(",");
      boxes.push({ ...sequenceFragmentSpan(geometry.nodes.filter((node) => ids.includes(node.id)), "note"), y: edge.points[0].y, height: 0 });
    }
    for (const edge of geometry.edges) for (const point of edge.points) boxes.push({ ...point, width: 0, height: 0 });
    const left = Math.min(0, ...boxes.map((box) => box.x - padding));
    const top = Math.min(0, ...boxes.map((box) => box.y - padding));
    const right = Math.max(minimum.width, ...boxes.map((box) => box.x + box.width + padding));
    const bottom = Math.max(minimum.height, ...boxes.map((box) => box.y + box.height + padding));
    geometry.origin = { x: left, y: top };
    geometry.width = right - left;
    geometry.height = bottom - top;
  }

  // src/renderer.ts
  var SvgRenderer = class {
    constructor(document, theme, resolveShape, ariaLabel) {
      __publicField(this, "svg");
      __publicField(this, "document");
      __publicField(this, "resolveShape");
      __publicField(this, "theme");
      __publicField(this, "geometry");
      __publicField(this, "nodeElements", /* @__PURE__ */ new Map());
      __publicField(this, "containerHeadingElements", /* @__PURE__ */ new Map());
      __publicField(this, "edgeElements", /* @__PURE__ */ new Map());
      __publicField(this, "edgeLabelElements", /* @__PURE__ */ new Map());
      __publicField(this, "labelPlacements", /* @__PURE__ */ new Map());
      __publicField(this, "minimumSize", { width: 320, height: 220 });
      __publicField(this, "textWidths", /* @__PURE__ */ new Map());
      this.document = document;
      this.theme = theme;
      this.resolveShape = resolveShape;
      this.svg = svgElement(document, "svg", {
        xmlns: "http://www.w3.org/2000/svg",
        role: "img",
        "aria-label": ariaLabel,
        class: "finch-canvas",
        width: "100%",
        preserveAspectRatio: "xMinYMin meet",
        tabindex: "0"
      });
    }
    draw(geometry, theme = this.theme) {
      this.geometry = geometry;
      this.theme = theme;
      this.minimumSize = { width: geometry.width + (geometry.origin?.x ?? 0), height: geometry.height + (geometry.origin?.y ?? 0) };
      this.textWidths.clear();
      this.prepareGeometry(geometry);
      this.nodeElements.clear();
      this.containerHeadingElements.clear();
      this.edgeElements.clear();
      this.edgeLabelElements.clear();
      this.svg.replaceChildren();
      this.svg.setAttribute("viewBox", `${geometry.origin?.x ?? 0} ${geometry.origin?.y ?? 0} ${geometry.width} ${geometry.height}`);
      this.svg.style.background = theme.canvasColor;
      this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
      this.svg.append(this.createDefinitions(), this.createStyles());
      this.svg.append(this.createGroups(geometry));
      const containers = svgElement(this.document, "g", { class: "finch-containers" });
      const regularNodes = svgElement(this.document, "g", { class: "finch-nodes" });
      for (const node of geometry.nodes.filter((candidate) => candidate.shape === "container")) this.appendNode(containers, node);
      this.svg.append(containers);
      if (geometry.kind === "sequence") {
        this.svg.append(this.createLifelines(geometry));
        this.svg.append(this.createActivations(geometry));
      }
      if (geometry.kind !== "timing") this.svg.append(this.createEdges(geometry));
      if (geometry.kind === "sequence") this.svg.append(this.createSequenceFragments(geometry));
      for (const node of geometry.nodes.filter((candidate) => candidate.shape !== "container" && !candidate.attributes.branchLifetime)) this.appendNode(regularNodes, node);
      this.svg.append(regularNodes);
      if (geometry.diagramText) this.svg.append(this.createDiagramText(geometry));
      if (geometry.kind === "timing") this.svg.append(this.createEdges(geometry));
      const headings = svgElement(this.document, "g", { class: "finch-container-headings" });
      for (const node of geometry.nodes.filter((candidate) => candidate.shape === "container")) {
        const labels = this.nodeElements.get(node.id)?.querySelectorAll(":scope > text");
        if (!labels?.length) continue;
        const heading = svgElement(this.document, "g", {
          "data-node-id": node.id,
          transform: this.containerHeadingTransform(node, geometry)
        });
        heading.append(...labels);
        headings.append(heading);
        this.containerHeadingElements.set(node.id, heading);
      }
      this.svg.append(headings);
      decorateText(this.svg);
    }
    createGroups(geometry) {
      const theme = this.theme;
      const groupLayer = svgElement(this.document, "g", { class: "finch-groups" });
      for (const group of geometry.groups) {
        groupLayer.append(svgElement(this.document, "rect", {
          x: group.x,
          y: group.y,
          width: group.width,
          height: group.height,
          rx: 8,
          fill: "none",
          stroke: theme.containerStroke,
          "stroke-width": 1,
          "stroke-dasharray": "5 4"
        }));
        const title = group.kind && group.kind !== "group" ? `${group.kind} \xB7 ${group.label}` : group.label;
        const titleLayout = labelLayout(title, Math.min(216, group.width - 24), theme.fontSize - 1, theme.fontFamily, 650);
        const tabWidth = Math.min(group.width - 18, Math.max(78, titleLayout.width + 24));
        const tabHeight = Math.max(22, titleLayout.height + 8);
        groupLayer.append(svgElement(this.document, "path", {
          d: `M ${group.x} ${group.y} L ${group.x + tabWidth} ${group.y} L ${group.x + tabWidth + 10} ${group.y + tabHeight} L ${group.x} ${group.y + tabHeight} Z`,
          fill: theme.containerFill,
          stroke: theme.containerStroke,
          "stroke-width": 1
        }));
        const label = svgElement(this.document, "text", {
          x: group.x + 10,
          y: group.y + 15,
          fill: theme.mutedColor,
          "font-family": theme.fontFamily,
          "font-size": theme.fontSize - 1,
          "font-weight": 650
        });
        for (const [index, line] of titleLayout.lines.entries()) {
          const span = svgElement(this.document, "tspan", { x: group.x + 10, y: group.y + 15 + index * titleLayout.lineHeight });
          span.textContent = line;
          label.append(span);
        }
        groupLayer.append(label);
        for (const branch of group.branches ?? []) {
          groupLayer.append(svgElement(this.document, "path", { d: `M ${group.x} ${branch.y} H ${group.x + group.width}`, fill: "none", stroke: theme.containerStroke, "stroke-dasharray": "5 4", class: "finch-sequence-divider" }));
          const text = svgElement(this.document, "text", { x: group.x + 10, y: branch.y + 17, fill: theme.mutedColor, "font-family": theme.fontFamily, "font-size": theme.fontSize - 1 });
          for (const [index, line] of labelLayout(branch.label, 216, theme.fontSize - 1).lines.entries()) {
            const span = svgElement(this.document, "tspan", { x: group.x + 10, dy: index ? 16 : 0 });
            span.textContent = line;
            text.append(span);
          }
          groupLayer.append(text);
        }
      }
      return groupLayer;
    }
    updateGeometry(geometry) {
      this.geometry = geometry;
      if (geometry.kind === "sequence") {
        this.svg.querySelector(".finch-groups")?.replaceWith(this.createGroups(geometry));
        this.svg.querySelector(".finch-activations")?.replaceWith(this.createActivations(geometry));
      }
      if (geometry.kind === "sequence") {
        this.svg.querySelector(".finch-lifelines")?.remove();
        this.svg.append(this.createLifelines(geometry));
      }
      this.svg.querySelector(".finch-sequence-fragments")?.remove();
      if (geometry.kind === "sequence") this.svg.append(this.createSequenceFragments(geometry));
      this.prepareGeometry(geometry);
      this.svg.querySelector(".finch-diagram-text")?.remove();
      if (geometry.diagramText) this.svg.append(this.createDiagramText(geometry));
      this.svg.setAttribute("viewBox", `${geometry.origin?.x ?? 0} ${geometry.origin?.y ?? 0} ${geometry.width} ${geometry.height}`);
      this.svg.style.aspectRatio = `${geometry.width} / ${geometry.height}`;
      for (const node of geometry.nodes) {
        const element = this.nodeElements.get(node.id);
        element?.setAttribute("transform", `translate(${node.x} ${node.y})`);
        if (node.shape === "uml-required-interface") element?.querySelector(".finch-required-interface-arc")?.setAttribute("d", requiredInterfacePath(node));
        this.containerHeadingElements.get(node.id)?.setAttribute("transform", this.containerHeadingTransform(node, geometry));
        if (node.shape === "container") {
          const frame = element?.querySelector(":scope > rect");
          frame?.setAttribute("width", String(node.width));
          frame?.setAttribute("height", String(node.height));
          const outline = element?.querySelector(":scope > path[class$='-outline']");
          outline?.setAttribute("d", containerOutlinePath(node, nodeTheme(node, geometry.nodes, this.theme)));
          element?.querySelector(".finch-component-group-mark")?.setAttribute("transform", node.attributes.componentStyle === "uml1" ? "translate(0 0)" : `translate(${node.width - 30} 10)`);
        }
      }
      for (const [index, edge] of geometry.edges.entries()) {
        this.edgeElements.get(edge.id)?.setAttribute("d", pathWithEdgeJumps(edge, geometry.edges.slice(0, index)));
        const label = this.edgeLabelElements.get(edge.id);
        if (label) {
          this.setEdgeLabel(label, this.labelPlacements.get(edge.id));
        }
        for (const endpoint of ["start", "end"]) {
          const cardinality = this.svg.querySelector(`.finch-cardinality[data-edge-id="${cssEscape(edge.id)}"][data-endpoint="${endpoint}"]`);
          if (!cardinality) continue;
          const point = cardinalityPoint(edge, endpoint);
          cardinality.setAttribute("x", String(point.x));
          cardinality.setAttribute("y", String(point.y - 6));
        }
      }
      if (geometry.kind === "sequence") {
        for (const node of geometry.nodes) {
          for (const line of this.svg.querySelectorAll(`.finch-lifeline[data-node-id="${cssEscape(node.id)}"]`)) {
            const x = node.x + node.width / 2;
            line.setAttribute("x1", String(x));
            line.setAttribute("x2", String(x));
          }
          const destructions = this.svg.querySelectorAll(`.finch-destruction[data-node-id="${cssEscape(node.id)}"]`);
          const events = JSON.parse(node.attributes.sequencePositions ?? "[]").filter((e) => e.kind === "destroy");
          destructions.forEach((path, index) => {
            const event = events[index];
            const x = node.x + node.width / 2;
            if (event) path.setAttribute("d", `M ${x - 7} ${event.y - 7} l 14 14 M ${x + 7} ${event.y - 7} l -14 14`);
          });
          for (const header2 of this.svg.querySelectorAll(`.finch-created-header[data-node-id="${cssEscape(node.id)}"]`)) {
            const y = header2.getAttribute("transform")?.match(/translate\([^ ]+ ([^)]+)\)/)?.[1] ?? "0";
            header2.setAttribute("transform", `translate(${node.x} ${y})`);
          }
          const activations = this.svg.querySelectorAll(`.finch-activation[data-node-id="${cssEscape(node.id)}"]`);
          for (const activation of activations) {
            const offset = Number(activation.dataset.xOffset ?? -5);
            activation.setAttribute("x", String(node.x + node.width / 2 + offset));
          }
        }
      }
      decorateText(this.svg);
    }
    setSelection(ids) {
      for (const [id, element] of this.nodeElements) element.classList.toggle("is-selected", ids.has(id));
    }
    setPinned(id, pinned) {
      this.nodeElements.get(id)?.classList.toggle("is-pinned", pinned);
    }
    clientPoint(event) {
      const point = this.svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = this.svg.getScreenCTM();
      if (!matrix) return { x: event.clientX, y: event.clientY };
      const transformed = point.matrixTransform(matrix.inverse());
      return { x: transformed.x, y: transformed.y };
    }
    nodeIdFromTarget(target) {
      return target instanceof this.document.defaultView.Element ? target.closest("[data-node-id]")?.dataset.nodeId : void 0;
    }
    containerHeadingTransform(node, geometry) {
      const fontSize = this.theme.fontSize - 1;
      const layout = labelLayout(node.label, Math.min(node.width - 32, wrapWidth(node.attributes, 216)), fontSize, this.theme.fontFamily, 650);
      const left = node.x + 16;
      const top = node.y + 23 - fontSize;
      const obstacles = geometry.nodes.filter((other) => other.shape !== "container" && other.y < top + layout.height + 4 && other.y + other.height > top - 4);
      const candidates = [left, ...obstacles.flatMap((other) => [other.x + other.width + 8, other.x - layout.width - 8])].filter((x2) => x2 >= left && x2 + layout.width <= node.x + node.width - 16).sort((a, b) => a - b);
      const x = candidates.find((candidate) => obstacles.every((other) => candidate + layout.width + 4 <= other.x || candidate - 4 >= other.x + other.width)) ?? left;
      return `translate(${node.x + x - left} ${node.y})`;
    }
    appendNode(layer, node) {
      if (node.attributes.hidden === "true") return;
      const theme = nodeTheme(node, this.geometry?.nodes ?? [], this.theme);
      const element = this.resolveShape(node.shape).render({ node, theme, document: this.document });
      element.classList.add("finch-node");
      layer.append(element);
      this.nodeElements.set(node.id, element);
    }
    prepareGeometry(geometry) {
      const fontSize = this.theme.fontSize - 1;
      const probe = svgElement(this.document, "svg", { "aria-hidden": "true" });
      probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden";
      const text = svgElement(this.document, "text", { "font-family": this.theme.fontFamily, "font-size": fontSize });
      probe.append(text);
      this.document.body?.append(probe);
      try {
        const measure = (value) => {
          const cached = this.textWidths.get(value);
          if (cached !== void 0) return cached;
          text.textContent = value;
          const measured = typeof text.getComputedTextLength === "function" ? text.getComputedTextLength() : 0;
          const width = measured > 0 ? measured : estimatedTextWidth(value, fontSize);
          this.textWidths.set(value, width);
          return width;
        };
        const result = placeEdgeLabels(geometry, fontSize, measure);
        this.labelPlacements = result.labels;
        fitVisualBounds(geometry, this.minimumSize, result.bounds);
        if (geometry.kind !== "sequence" && geometry.diagramText) {
          geometry.origin.y -= geometry.diagramText.top;
          geometry.height += geometry.diagramText.top + geometry.diagramText.bottom;
        }
      } finally {
        probe.remove();
      }
    }
    setEdgeLabel(text, placement) {
      text.removeAttribute("data-finch-rich");
      text.setAttribute("x", String(placement.point.x));
      text.setAttribute("y", String(placement.point.y));
      text.replaceChildren();
      if (placement.lines.length === 1) text.textContent = placement.lines[0];
      else for (const [index, line] of placement.lines.entries()) {
        const span = svgElement(this.document, "tspan", { x: placement.point.x, y: placement.point.y + index * placement.lineHeight });
        span.textContent = line;
        text.append(span);
      }
    }
    createSequenceFragments(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-sequence-fragments" });
      for (const edge of geometry.edges.filter((e) => ["ref", "delay", "divider", "note"].includes(e.attributes?.messageKind ?? ""))) {
        const ids = edge.attributes.participants.split(",");
        const nodes = geometry.nodes.filter((n) => ids.includes(n.id));
        if (!nodes.length) continue;
        const { x, width } = sequenceFragmentSpan(nodes, edge.attributes?.messageKind);
        const right2 = x + width, y = edge.points[0].y;
        const kind = edge.attributes.messageKind;
        const lines = labelLayout(edge.attributes.fragmentLabel ?? "", Math.max(40, width - 52), this.theme.fontSize - 1, this.theme.fontFamily).lines;
        const height = Math.max(36, lines.length * 16 + 22);
        const group = svgElement(this.document, "g", { class: `finch-sequence-${kind}`, "data-edge-id": edge.id });
        if (kind === "divider") {
          group.append(svgElement(this.document, "rect", { x, y: y - 18, width, height, fill: this.theme.nodeFill }));
          group.append(svgElement(this.document, "path", { d: `M ${x} ${y - 18} H ${right2} M ${x} ${y - 14} H ${right2} M ${x} ${y + height - 22} H ${right2} M ${x} ${y + height - 18} H ${right2}`, fill: "none", stroke: this.theme.nodeStroke }));
          lines.forEach((line, index) => {
            const text = svgElement(this.document, "text", { x: x + width / 2, y: y + 6 + index * 16, "text-anchor": "middle", fill: this.theme.labelColor, "font-size": this.theme.fontSize - 1, "font-weight": 700, "font-family": this.theme.fontFamily });
            text.textContent = line;
            group.append(text);
          });
          layer.append(group);
          continue;
        }
        const shapedNote = kind === "note" && edge.attributes.noteShape !== "rnote";
        group.append(svgElement(this.document, "rect", { x, y: y - 18, width, height, rx: kind === "ref" || kind === "note" ? 0 : 6, fill: shapedNote ? "none" : this.theme.nodeFill, stroke: shapedNote ? "none" : this.theme.nodeStroke, "stroke-dasharray": kind === "delay" ? "3 4" : "none" }));
        if (shapedNote) {
          const top = y - 18, bottom = top + height;
          const style = { fill: this.theme.nodeFill, stroke: this.theme.nodeStroke };
          if (edge.attributes.noteShape === "hnote") group.append(svgElement(this.document, "polygon", { points: `${x + 16},${top} ${right2 - 16},${top} ${right2},${top + height / 2} ${right2 - 16},${bottom} ${x + 16},${bottom} ${x},${top + height / 2}`, ...style }));
          else {
            group.append(svgElement(this.document, "path", { d: `M ${x} ${top} H ${right2 - 16} L ${right2} ${top + 16} V ${bottom} H ${x} Z`, ...style }));
            group.append(svgElement(this.document, "path", { d: `M ${right2 - 16} ${top} V ${top + 16} H ${right2}`, fill: "none", stroke: this.theme.nodeStroke }));
          }
        }
        const title = svgElement(this.document, "text", { x: x + 6, y: y - 4, fill: this.theme.mutedColor, "font-size": 10, "font-family": this.theme.fontFamily });
        title.textContent = kind === "ref" ? "ref" : "\u2026";
        if (kind !== "note") group.append(title);
        lines.forEach((line, index) => {
          const text = svgElement(this.document, "text", { x: x + width / 2, y: y + 6 + index * 16, "text-anchor": "middle", fill: this.theme.labelColor, "font-size": this.theme.fontSize - 1, "font-family": this.theme.fontFamily });
          text.textContent = line;
          group.append(text);
        });
        layer.append(group);
      }
      let lane = 0;
      const right = Math.max(0, ...geometry.nodes.map((node) => node.x + node.width), ...geometry.groups.map((group) => group.x + group.width));
      for (const start of geometry.edges) {
        const durations = JSON.parse(start.attributes?.durations ?? "[]");
        for (const duration of durations) {
          const end = geometry.edges.find((edge) => edge.id === duration.to);
          if (!end) continue;
          const x = right + 36 + lane++ * 160, y1 = start.points[duration.fromEndpoint === "receive" ? start.points.length - 1 : 0].y, y2 = end.points[duration.toEndpoint === "receive" ? end.points.length - 1 : 0].y;
          const group = svgElement(this.document, "g", { class: "finch-sequence-duration", "data-from": start.id, "data-to": end.id, "data-start-y": y1, "data-end-y": y2 });
          group.append(svgElement(this.document, "path", { d: `M ${right + 8} ${y1} H ${x} M ${right + 8} ${y2} H ${x}`, fill: "none", stroke: this.theme.mutedColor, "stroke-dasharray": "3 4" }));
          group.append(svgElement(this.document, "path", { d: `M ${x} ${y1} V ${y2} M ${x - 4} ${y1 + 6} L ${x} ${y1} L ${x + 4} ${y1 + 6} M ${x - 4} ${y2 - 6} L ${x} ${y2} L ${x + 4} ${y2 - 6}`, fill: "none", stroke: this.theme.edgeColor }));
          const lines = labelLayout(duration.label, 112, this.theme.fontSize - 1, this.theme.fontFamily).lines;
          lines.forEach((line, index) => {
            const text = svgElement(this.document, "text", { x: x + 9, y: (y1 + y2) / 2 + (index - (lines.length - 1) / 2) * 16, fill: this.theme.labelColor, "font-size": this.theme.fontSize - 1, "font-family": this.theme.fontFamily });
            text.textContent = line;
            group.append(text);
          });
          layer.append(group);
        }
      }
      return layer;
    }
    createEdges(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-edges" });
      for (const [index, edge] of geometry.edges.entries()) {
        if (!isRenderedEdge(edge)) continue;
        const relation = edge.attributes?.relation;
        const markerEnd = edge.attributes?.toDecoration ? `url(#finch-decoration-${edge.attributes.toDecoration})` : edge.attributes?.nonNavigableEnd === "to" ? "url(#finch-non-navigable)" : edge.attributes?.unknownEndpoint === "lost" ? "url(#finch-message-dot)" : edge.attributes?.annotation ? void 0 : ["async", "reply", "create"].includes(edge.attributes?.messageKind ?? "") ? "url(#finch-open-arrow)" : ["inheritance", "realization"].includes(relation ?? "") ? "url(#finch-triangle)" : edge.attributes?.navigable === "true" || edge.attributes?.bidirectional === "true" ? "url(#finch-open-arrow)" : ["association", "aggregation", "composition"].includes(relation ?? "") ? void 0 : "url(#finch-arrow)";
        const markerStart = edge.attributes?.fromDecoration ? `url(#finch-decoration-${edge.attributes.fromDecoration})` : edge.attributes?.nonNavigableEnd === "from" ? "url(#finch-non-navigable)" : edge.attributes?.bidirectional === "true" ? "url(#finch-open-arrow)" : edge.attributes?.unknownEndpoint === "found" ? "url(#finch-message-dot)" : relation === "composition" ? "url(#finch-diamond-filled)" : relation === "aggregation" ? "url(#finch-diamond-open)" : void 0;
        const lineColor = edge.attributes?.lineColor && /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i.test(edge.attributes.lineColor) ? edge.attributes.lineColor : this.theme.edgeColor;
        const colorMarker = (reference) => {
          if (!reference || lineColor === this.theme.edgeColor) return reference;
          const id = reference.slice(5, -1);
          const original = this.svg.querySelector(`[id="${id}"]`);
          if (!original) return reference;
          const coloredId = `${id}-edge-${index}`;
          this.svg.querySelector(`[id="${coloredId}"]`)?.remove();
          const copy = original.cloneNode(true);
          copy.setAttribute("id", coloredId);
          for (const part of Array.from(copy.querySelectorAll("[stroke], [fill]"))) {
            if (part.getAttribute("stroke") === this.theme.edgeColor) part.setAttribute("stroke", lineColor);
            if (part.getAttribute("fill") === this.theme.edgeColor) part.setAttribute("fill", lineColor);
          }
          this.svg.querySelector("defs").append(copy);
          return `url(#${coloredId})`;
        };
        const path = svgElement(this.document, "path", {
          d: pathWithEdgeJumps(edge, geometry.edges.slice(0, index)),
          fill: "none",
          stroke: lineColor,
          "stroke-width": Number.isFinite(Number(edge.attributes?.thickness)) && Number(edge.attributes?.thickness) > 0 ? Number(edge.attributes?.thickness) : this.theme.edgeWidth * (edge.attributes?.lineStyle === "bold" ? 2 : 1),
          "stroke-dasharray": edge.attributes?.lineStyle === "plain" ? void 0 : edge.attributes?.lineStyle === "dotted" ? "1 5" : edge.attributes?.lineStyle === "dashed" || edge.dashed || ["dependency", "realization"].includes(relation ?? "") ? "6 5" : void 0,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          "marker-start": colorMarker(markerStart),
          "marker-end": colorMarker(markerEnd),
          class: "finch-edge",
          "data-edge-id": edge.id
        });
        layer.append(path);
        this.edgeElements.set(edge.id, path);
        const cardinalities = [
          ["start", endpointText(edge, "start"), cardinalityPoint(edge, "start")],
          ["end", endpointText(edge, "end"), cardinalityPoint(edge, "end")]
        ];
        for (const [endpoint, value, point] of cardinalities) {
          if (!value) continue;
          const cardinality = svgElement(this.document, "text", {
            x: point.x,
            y: point.y - 6,
            "text-anchor": "middle",
            fill: this.theme.accentColor,
            "font-family": this.theme.fontFamily,
            "font-size": this.theme.fontSize - 1,
            "font-weight": 750,
            class: "finch-cardinality",
            "data-edge-id": edge.id,
            "data-endpoint": endpoint
          });
          cardinality.textContent = value;
          layer.append(cardinality);
        }
        if (edge.label) {
          const point = this.labelPlacements.get(edge.id).point;
          const text = svgElement(this.document, "text", {
            x: point.x,
            y: point.y,
            "text-anchor": "middle",
            fill: this.theme.mutedColor,
            "font-family": this.theme.fontFamily,
            "font-size": this.theme.fontSize - 1,
            class: "finch-edge-label",
            "data-edge-id": edge.id
          });
          this.setEdgeLabel(text, this.labelPlacements.get(edge.id));
          layer.append(text);
          this.edgeLabelElements.set(edge.id, text);
        }
      }
      return layer;
    }
    createDiagramText(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-diagram-text" });
      for (const block of geometry.diagramText?.blocks ?? []) {
        const x = (geometry.origin?.x ?? 0) + geometry.width / 2;
        const y = block.y + (block.kind === "footer" || block.kind === "legend" ? (geometry.origin?.y ?? 0) + geometry.height - geometry.diagramText.bottom - 12 : 12 + (geometry.kind !== "sequence" ? geometry.origin?.y ?? 0 : 0));
        if (block.kind === "legend") layer.append(svgElement(this.document, "rect", { x: x - 144, y: y - block.fontSize - 8, width: 288, height: block.lines.length * block.lineHeight + 20, rx: this.theme.nodeRadius, fill: this.theme.containerFill, stroke: this.theme.containerStroke, class: "finch-diagram-legend-frame" }));
        const text = svgElement(this.document, "text", { x, y, fill: this.theme.labelColor, "font-family": this.theme.fontFamily, "font-size": block.fontSize, "font-weight": block.kind === "title" ? 700 : 400, "text-anchor": "middle", class: `finch-diagram-${block.kind}` });
        block.lines.forEach((line, index) => {
          const span = svgElement(this.document, "tspan", { x, y: y + index * block.lineHeight });
          span.textContent = line;
          text.append(span);
        });
        layer.append(text);
      }
      return layer;
    }
    createLifelines(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-lifelines" });
      for (const node of geometry.nodes) {
        if (node.attributes.annotationTarget) continue;
        const x = node.x + node.width / 2;
        const events = JSON.parse(node.attributes.sequencePositions ?? "[]");
        let alive = !events.some((e) => e.kind === "create");
        let start = node.y + node.height;
        const frames = [];
        const draw = (end) => {
          if (alive && end > start) layer.append(svgElement(this.document, "line", { x1: x, x2: x, y1: start, y2: end, stroke: this.theme.nodeStroke, "stroke-width": 1, "stroke-dasharray": "5 5", class: "finch-lifeline", "data-node-id": node.id }));
        };
        for (const event of events) {
          if (event.kind === "branch-save") frames.push({ base: alive, ends: [] });
          if (event.kind === "branch-reset" || event.kind === "branch-end") {
            const frame = frames[frames.length - 1];
            if (frame) {
              frame.ends.push(alive);
              draw(event.y);
              alive = event.kind === "branch-reset" ? frame.base : frame.ends.every(Boolean);
              start = event.y;
              if (event.kind === "branch-end") frames.pop();
            }
          }
          if (event.kind === "create") {
            alive = true;
            start = event.y + node.height / 2;
            if (node.attributes.branchLifetime) {
              const createdNode = { ...node, y: event.y - node.height / 2 };
              const header2 = this.resolveShape(node.shape).render({ node: createdNode, theme: nodeTheme(node, geometry.nodes, this.theme), document: this.document });
              header2.classList.add("finch-created-header");
              header2.setAttribute("data-node-id", node.id);
              header2.setAttribute("transform", `translate(${node.x} ${createdNode.y})`);
              layer.append(header2);
            }
          }
          if (event.kind === "destroy") {
            draw(event.y);
            alive = false;
            layer.append(svgElement(this.document, "path", { d: `M ${x - 7} ${event.y - 7} l 14 14 M ${x + 7} ${event.y - 7} l -14 14`, stroke: this.theme.edgeColor, "stroke-width": 2, class: "finch-destruction", "data-node-id": node.id }));
          }
        }
        const footY = (geometry.origin?.y ?? 0) + geometry.height - 32 - (geometry.diagramText?.bottom ?? 0) - Math.max(0, ...geometry.nodes.filter((n) => n.attributes.footbox === "true").map((n) => n.height + 40));
        draw(footY);
        if (alive && node.attributes.footbox === "true") {
          const footNode = { ...node, y: footY };
          const foot = this.resolveShape(node.shape).render({ node: footNode, theme: nodeTheme(node, geometry.nodes, this.theme), document: this.document });
          foot.classList.add("finch-footbox");
          foot.setAttribute("data-node-id", node.id);
          foot.setAttribute("transform", `translate(${node.x} ${footY})`);
          layer.append(foot);
        }
      }
      return layer;
    }
    createActivations(geometry) {
      const layer = svgElement(this.document, "g", { class: "finch-activations" });
      const nodeMap = new Map(geometry.nodes.map((node) => [node.id, node]));
      const intervals = [];
      for (const node of geometry.nodes) {
        const events = JSON.parse(node.attributes.sequencePositions ?? "[]");
        const timeline = node.attributes.explicitActivation ? events : [
          ...events.filter((e) => e.kind.startsWith("branch-") || e.kind === "destroy"),
          ...geometry.edges.flatMap((edge, at) => {
            if (edge.attributes?.annotation || ["async", "create", "ref", "delay", "divider", "note"].includes(edge.attributes?.messageKind ?? "")) return [];
            const kind = edge.dashed && edge.from === node.id ? "deactivate" : !edge.dashed && edge.to === node.id ? "activate" : void 0;
            return kind ? [{ kind, y: edge.points[kind === "activate" ? edge.points.length - 1 : 0]?.y ?? 0, at: at + 0.5, serial: 0 }] : [];
          })
        ].sort((a, b) => a.at - b.at || (a.serial ?? 0) - (b.serial ?? 0));
        let active = [];
        const frames = [];
        const close = (y) => {
          for (const item of active) intervals.push({ nodeId: node.id, ...item, end: y });
        };
        const resume = (depth, y) => {
          active = Array.from({ length: depth }, (_, depth2) => ({ start: y, depth: depth2 }));
        };
        for (const event of timeline) {
          if (event.kind === "branch-save") frames.push({ base: active.length, ends: [] });
          if (event.kind === "branch-reset" || event.kind === "branch-end") {
            const frame = frames[frames.length - 1];
            if (frame) {
              frame.ends.push(active.length);
              close(event.y);
              resume(event.kind === "branch-reset" ? frame.base : Math.min(...frame.ends), event.y);
              if (event.kind === "branch-end") frames.pop();
            }
          }
          if (event.kind === "activate") {
            const created = events.filter((e) => e.kind === "create" && e.at <= event.at).slice(-1)[0];
            active.push({ start: created ? Math.max(event.y, created.y + node.height / 2) : event.y, depth: active.length });
          }
          if (event.kind === "deactivate") {
            const start = active.pop();
            if (start) intervals.push({ nodeId: node.id, ...start, end: event.y });
          }
          if (event.kind === "destroy") {
            close(event.y);
            active = [];
          }
        }
        close(geometry.height - 38 - (geometry.diagramText?.bottom ?? 0) - Math.max(0, ...geometry.nodes.filter((n) => n.attributes.footbox === "true").map((n) => n.height + 40)));
      }
      const merged = [];
      for (const interval of intervals.filter((i) => i.end > i.start).sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.depth - b.depth || a.start - b.start)) {
        const previous = merged[merged.length - 1];
        if (previous && previous.nodeId === interval.nodeId && previous.depth === interval.depth && previous.end === interval.start) previous.end = interval.end;
        else merged.push({ ...interval });
      }
      for (const interval of merged) {
        const node = nodeMap.get(interval.nodeId);
        if (!node) continue;
        const offset = -5 + interval.depth * 3;
        layer.append(svgElement(this.document, "rect", {
          x: node.x + node.width / 2 + offset,
          y: interval.start,
          width: 10,
          height: Math.max(10, interval.end - interval.start),
          rx: 2,
          fill: this.theme.nodeFill,
          stroke: this.theme.accentColor,
          "stroke-width": 1.25,
          class: "finch-activation",
          "data-node-id": interval.nodeId,
          "data-x-offset": offset
        }));
      }
      return layer;
    }
    createDefinitions() {
      const defs = svgElement(this.document, "defs");
      const dot = svgElement(this.document, "marker", { id: "finch-message-dot", viewBox: "0 0 10 10", refX: 5, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto" });
      dot.append(svgElement(this.document, "circle", { cx: 5, cy: 5, r: 4, fill: this.theme.edgeColor }));
      defs.append(dot);
      for (const [name, d] of Object.entries({
        square: "M 1 1 H 9 V 9 H 1 Z",
        crowfoot: "M 9 1 L 1 5 L 9 9 M 1 5 H 9",
        "circle-cross": "M 9 5 A 4 4 0 1 0 1 5 A 4 4 0 1 0 9 5 M 1 5 H 9 M 5 1 V 9",
        triangle: "M 1 1 L 9 5 L 1 9 Z"
      })) {
        const decoration = svgElement(this.document, "marker", { id: `finch-decoration-${name}`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, orient: "auto-start-reverse" });
        decoration.append(svgElement(this.document, "path", { d, fill: name === "crowfoot" ? "none" : this.theme.nodeFill, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
        defs.append(decoration);
      }
      const nonNavigable = svgElement(this.document, "marker", { id: "finch-non-navigable", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
      nonNavigable.append(svgElement(this.document, "path", { d: "M 2 2 L 8 8 M 8 2 L 2 8", fill: "none", stroke: this.theme.edgeColor, "stroke-width": 1.5 }));
      defs.append(nonNavigable);
      const openArrow = svgElement(this.document, "marker", { id: "finch-open-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
      openArrow.append(svgElement(this.document, "path", { d: "M 1 1 L 9 5 L 1 9", fill: "none", stroke: this.theme.edgeColor, "stroke-width": 1.4 }));
      defs.append(openArrow);
      const marker2 = svgElement(this.document, "marker", {
        id: "finch-arrow",
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: "auto-start-reverse"
      });
      marker2.append(svgElement(this.document, "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: this.theme.edgeColor }));
      const triangle = svgElement(this.document, "marker", {
        id: "finch-triangle",
        viewBox: "0 0 12 12",
        refX: 11,
        refY: 6,
        markerWidth: 9,
        markerHeight: 9,
        orient: "auto-start-reverse"
      });
      triangle.append(svgElement(this.document, "path", { d: "M 1 1 L 11 6 L 1 11 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
      const openDiamond = svgElement(this.document, "marker", {
        id: "finch-diamond-open",
        viewBox: "0 0 14 10",
        refX: 13,
        refY: 5,
        markerWidth: 11,
        markerHeight: 9,
        orient: "auto-start-reverse"
      });
      openDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.canvasColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
      const filledDiamond = svgElement(this.document, "marker", {
        id: "finch-diamond-filled",
        viewBox: "0 0 14 10",
        refX: 13,
        refY: 5,
        markerWidth: 11,
        markerHeight: 9,
        orient: "auto-start-reverse"
      });
      filledDiamond.append(svgElement(this.document, "path", { d: "M 1 5 L 7 1 L 13 5 L 7 9 Z", fill: this.theme.edgeColor, stroke: this.theme.edgeColor, "stroke-width": 1.2 }));
      const filter = svgElement(this.document, "filter", { id: "finch-shadow", x: "-20%", y: "-30%", width: "140%", height: "170%" });
      filter.append(svgElement(this.document, "feDropShadow", { dx: 0, dy: 2, stdDeviation: 2.5, "flood-color": "#0f172a", "flood-opacity": 0.1 }));
      defs.append(marker2, triangle, openDiamond, filledDiamond, filter);
      return defs;
    }
    createStyles() {
      const style = svgElement(this.document, "style");
      style.textContent = `
      .finch-node { cursor: grab; outline: none; }
      .finch-node:active { cursor: grabbing; }
      .finch-node > :first-child { transition: stroke 120ms ease, stroke-width 120ms ease; }
      .finch-node.is-selected > :first-child { stroke: ${this.theme.accentColor}; stroke-width: 2.4; }
      .finch-node.is-pinned::after { content: ""; }
      .finch-container-headings { cursor: grab; }
      .finch-container-headings text { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; }
      .finch-canvas.is-view-only, .finch-canvas.is-view-only .finch-node { cursor: grab; }
      .finch-canvas.is-panning { cursor: grabbing; user-select: none; }
      .finch-canvas.is-panning .finch-node { cursor: grabbing; }
      .finch-edge { pointer-events: none; }
      .finch-activation { pointer-events: none; }
      .finch-edge-label { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; }
      .finch-cardinality { paint-order: stroke; stroke: ${this.theme.canvasColor}; stroke-width: 5px; stroke-linejoin: round; pointer-events: none; }
      .finch-canvas:focus-visible { outline: 2px solid ${this.theme.accentColor}; outline-offset: 2px; }
    `;
      return style;
    }
  };
  function cssEscape(value) {
    const css = globalThis.CSS;
    return css?.escape ? css.escape(value) : value.replace(/["\\]/g, "\\$&");
  }

  // src/component-decorations.ts
  function componentDecorations(line) {
    const compact = line.match(/^(\s*)(?::([^:\n]+):|\(([^()\n]+)\))(?=\s|$)(.*)$/);
    if (compact && !/^\s*(?:[-<.]|:)/.test(compact[4])) {
      line = `${compact[1]}${compact[2] !== void 0 ? "actor" : "usecase"} ${JSON.stringify(compact[2] ?? compact[3])}${compact[4]}`;
    }
    if (!/^\s*(?:\[|\(\)|(?:node|server|database|container|actor\/?|rectangle|rounded|system|component|external|interface|usecase\/?|device|execution|artifact|file|card|hexagon|label|circle|boundary|control|entity|collections|stack|action|storage|process|agent|person|package|port|portin|portout|provided|required|queue|cloud|folder|frame)\s)/.test(line)) return { text: line, tags: [] };
    let text = "", quoted = false, depth = 0;
    const tags = [];
    const stereotypes = [];
    for (let i = 0; i < line.length; ) {
      const c = line[i];
      if (quoted && c === "\\") {
        text += line.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === '"') {
        quoted = !quoted;
        text += c;
        i++;
        continue;
      }
      if (!quoted) {
        if (c === "[") depth++;
        if (c === "]") depth--;
        if (depth === 0 && (i === 0 || /\s/.test(line[i - 1]))) {
          const rest = line.slice(i);
          const tag = rest.match(/^\$([\w.-]+)(?=\s|$|\{)/);
          if (tag) {
            tags.push(tag[1]);
            i += tag[0].length;
            continue;
          }
          const kind = rest.match(/^<<([^<>]+)>>(?=\s|$|\{)/);
          if (kind) {
            stereotypes.push(kind[1].trim());
            i += kind[0].length;
            continue;
          }
          if (/^(?:[-<.]|:)/.test(rest)) return { text: line, tags: [] };
        }
      }
      text += c;
      i++;
    }
    return { text, tags, ...stereotypes.length ? { stereotype: [...new Set(stereotypes)].join(", "), stereotypes: [...new Set(stereotypes)] } : {} };
  }

  // src/component-display.ts
  function applyComponentDisplay(model, rules, kinds) {
    const linked = new Set(model.connections.flatMap((edge) => [edge.from, edge.to]));
    for (const rule of rules) {
      const match = rule.match(/^(hide|show|remove|restore)\s+(.+)$/);
      let selector2 = match[2].trim();
      if (selector2 === "@unlinked") selector2 = "unlinked";
      const stereotypeOnly = selector2 === "stereotype" || /\s+stereotype$/.test(selector2);
      if (stereotypeOnly) {
        if (!["hide", "show"].includes(match[1])) throw new Error("Only hide/show can select stereotype labels.");
        selector2 = selector2 === "stereotype" ? "*" : selector2.replace(/\s+stereotype$/, "");
      }
      const literalTarget = selector2.startsWith("[") && selector2.endsWith("]") || selector2.startsWith('"') && selector2.endsWith('"');
      if (selector2.startsWith("[") && selector2.endsWith("]")) selector2 = componentNameId(selector2.slice(1, -1));
      if (selector2.startsWith('"') && selector2.endsWith('"')) selector2 = componentNameId(JSON.parse(selector2));
      const selected = model.nodes.filter((node) => node.id === selector2 || !literalTarget && (selector2 === "*" || kinds.get(node.id) === selector2 || selector2.startsWith("$") && JSON.parse(node.attributes.tags ?? "[]").includes(selector2.slice(1)) || JSON.parse(node.attributes.stereotypes ?? JSON.stringify(node.attributes.stereotype ? [node.attributes.stereotype] : [])).some((value) => selector2 === `<<${value}>>`) || selector2 === "unlinked" && !linked.has(node.id)));
      if (!selected.length && (literalTarget || !selector2.startsWith("$") && !/^<<.+>>$/.test(selector2) && !["*", "unlinked", "component", "interface", "provided", "required", "node", "package", "folder", "frame", "cloud", "database", "artifact", "file", "card", "hexagon", "label", "circle", "boundary", "control", "entity", "collections", "stack", "action", "storage", "process", "agent", "person", "json", "port", "portin", "portout", "rectangle", "server", "container", "actor", "rounded", "system", "external", "usecase", "device", "execution", "queue"].includes(selector2))) throw new Error(`Unknown display target ${selector2}.`);
      for (const node of selected) {
        if (stereotypeOnly) {
          node.attributes.hideStereotype = String(match[1] === "hide");
          continue;
        }
        node.attributes.hidden = String(match[1] === "hide" || match[1] === "remove");
        node.attributes.removed = String(match[1] === "remove");
      }
    }
  }
  function componentDisplayModel(model) {
    const hidden2 = new Set(model.nodes.filter((node) => node.attributes.hidden === "true").map((node) => node.id));
    const removed = new Set(model.nodes.filter((node) => node.attributes.removed === "true").map((node) => node.id));
    for (let changed = true; changed; ) {
      changed = false;
      for (const node of model.nodes) for (const set of [hidden2, removed]) {
        if ((node.parentId && set.has(node.parentId) || node.attributes.jsonRoot && set.has(node.attributes.jsonRoot)) && !set.has(node.id)) {
          set.add(node.id);
          changed = true;
        }
      }
    }
    const connections = model.connections.filter((edge) => !removed.has(edge.from) && !removed.has(edge.to)).map((edge) => hidden2.has(edge.from) || hidden2.has(edge.to) ? { ...edge, attributes: { ...edge.attributes, hidden: "true" } } : edge);
    const targets = /* @__PURE__ */ new Set([...model.nodes.filter((node) => !hidden2.has(node.id) && !removed.has(node.id)).map((node) => node.id), ...connections.filter((edge) => edge.attributes?.hidden !== "true").map((edge) => edge.id)]);
    const nodes = model.nodes.filter((node) => !removed.has(node.id) && (!node.attributes.annotationTarget || targets.has(node.attributes.annotationTarget))).map((node) => hidden2.has(node.id) ? { ...node, attributes: { ...node.attributes, hidden: "true" } } : node);
    const ids = new Set(nodes.map((node) => node.id));
    return { ...model, nodes, connections: connections.filter((edge) => ids.has(edge.from) && ids.has(edge.to)) };
  }

  // src/member-modifiers.ts
  function parseMemberModifiers(source) {
    const modifiers = /* @__PURE__ */ new Set();
    const quoted = String.raw`"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'`;
    let text = source.replace(new RegExp(`${quoted}|\\{(field|method|static|abstract|classifier)\\}`, "g"), (token, modifier) => {
      if (!modifier) return token;
      modifiers.add(modifier === "classifier" ? "static" : modifier);
      return " ";
    });
    text = text.replace(new RegExp(`${quoted}|[ \\t]+`, "g"), (token) => /^\s/.test(token) ? " " : token).trim();
    for (; ; ) {
      const prefix = text.match(/^(static|abstract)\s+/);
      if (!prefix) break;
      modifiers.add(prefix[1]);
      text = text.slice(prefix[0].length);
    }
    if (modifiers.has("field") && modifiers.has("method")) throw new Error("A member cannot be both field and method.");
    if (!text) throw new Error("A member modifier requires a member.");
    return { text, modifiers };
  }

  // src/class-relations.ts
  var classRelationOperators = String.raw`[#}+^](?:--|\.\.)>|<(?:--|\.\.)[#\{+^]|[#}+^](?:--|\.\.)|(?:--|\.\.)[#\{+^]|x-->|x\.\.>|<--x|<\.\.x|x--|x\.\.|--x|\.\.x|<-->|<\.\.>|\*-->|\*\.\.>|o-->|o\.\.>|<--\*|<\.\.\*|<--o|<\.\.o|<\|--|<\|\.\.|\.\.\|>|--\|>|\*--|\*\.\.|o--|o\.\.|--\*|\.\.\*|--o|\.\.o|<--|<\.\.|\.\.>|-->|--|\.\.`;

  // src/class-members.ts
  function expandClassMembers(source, implicit = false) {
    const additions = /* @__PURE__ */ new Map();
    const firstLine = /* @__PURE__ */ new Map();
    let body = false;
    const lines = source.split(/\r?\n/).map((line, index) => {
      if (body) {
        if (line.trim() === "}") body = false;
        return line;
      }
      if (/^\s*(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line)) {
        body = true;
        return line;
      }
      const match = line.trim().match(/^([\w.-]+)\s*:(?!:)\s*(.+)$/);
      if (!match) return line;
      if (!firstLine.has(match[1])) firstLine.set(match[1], index);
      additions.set(match[1], [...additions.get(match[1]) ?? [], match[2]]);
      return "";
    });
    let active;
    const seen = /* @__PURE__ */ new Set();
    const result = lines.map((line) => {
      if (active) {
        if (line.trim() === "}") {
          const extra = additions.get(active) ?? [];
          active = void 0;
          return [...extra, line].join("\n");
        }
        return line;
      }
      const declaration = line.match(/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+).*\{\s*$/);
      if (declaration) {
        active = declaration[1];
        seen.add(active);
      }
      return line;
    });
    for (const [id, members] of additions) if (!seen.has(id)) {
      if (!implicit) throw new Error(`Unknown classifier member target "${id}".`);
      result[firstLine.get(id)] = `class ${id} ${JSON.stringify(id.split(".").slice(-1)[0])} {
${members.join("\n")}
}`;
    }
    return result.join("\n");
  }

  // src/sequence-number-format.ts
  function decimalSequenceNumber(value, format) {
    const chars = [];
    let quoted = false;
    for (let i = 0; i < format.length; i++) {
      const char = format[i];
      if (char === "'") {
        if (format[i + 1] === "'") {
          chars.push({ char, literal: true });
          i++;
        } else quoted = !quoted;
      } else chars.push({ char, literal: quoted });
    }
    if (quoted) throw new Error("Unclosed quote in autonumber format.");
    const start = chars.findIndex((c) => !c.literal && /[0#]/.test(c.char));
    if (start < 0) throw new Error("Autonumber format requires {n} or a numeric digit pattern.");
    let end = start;
    while (end < chars.length && !chars[end].literal && /[0#,.]/.test(chars[end].char)) end++;
    const before = chars.slice(0, start), after = chars.slice(end);
    if ([...before, ...after].some((c) => !c.literal && /[0#.,;%‰¤E]/.test(c.char))) throw new Error("Unsupported autonumber format; quote literal punctuation.");
    const pattern = chars.slice(start, end).map((c) => c.char).join("");
    if (!/^#*0*(?:\.0*#*)?$/.test(pattern.replace(/,/g, "")) || !/[0#]/.test(pattern) || pattern.startsWith(",") || pattern.includes(",,") || /\.[^]*,/.test(pattern) || /,(?:\.|$)/.test(pattern)) throw new Error("Invalid autonumber numeric format.");
    const [integer, fraction = ""] = pattern.split(".");
    const minimum = (integer.match(/0/g) ?? []).length;
    let digits = String(value).padStart(minimum, "0");
    const comma = integer.lastIndexOf(",");
    if (comma >= 0) {
      const group = integer.length - comma - 1;
      if (!group) throw new Error("Invalid autonumber grouping.");
      let grouped = "";
      while (digits.length > group) {
        grouped = "," + digits.slice(-group) + grouped;
        digits = digits.slice(0, -group);
      }
      digits += grouped;
    }
    const zeros = (fraction.match(/0/g) ?? []).length;
    const suffix = pattern.endsWith(".") || zeros ? "." + "0".repeat(zeros) : "";
    return before.map((c) => c.char).join("") + digits + suffix + after.map((c) => c.char).join("");
  }
  function sequenceNumber(number2) {
    const values = [...number2.prefix ?? [], number2.value];
    const join = (width = 0) => values.map((value, i) => `${i ? number2.separators?.[i - 1] ?? "." : ""}${String(value).padStart(width, "0")}`).join("");
    if (number2.format === void 0) return join() + ".";
    if (/\{n(?::0?[1-9]\d?)?\}/.test(number2.format)) return number2.format.replace(/\{n(?::0?([1-9]\d?))?\}/g, (_, width) => join(Number(width ?? 0)));
    if (values.length > 1) throw new Error("Hierarchical autonumber requires a {n} format.");
    return decimalSequenceNumber(number2.value, number2.format);
  }

  // src/object-json.ts
  function normalizeJsonAlias(line) {
    return line.trim().replace(/^json\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+)\s*(?=[\[{])/, "json $2 $1 ").replace(/^json\s+([\w.-]+)\s+as\s+("(?:\\.|[^"\\])*")\s*(?=[\[{])/, "json $1 $2 ").replace(/^json\s+([\w.-]+)\s+as\s+([\w.-]+)\s*(?=[\[{])/, (_, name, id) => `json ${id} ${JSON.stringify(name)} `);
  }
  function expandObjectJson(source) {
    const maps = /* @__PURE__ */ new Map(), owners = /* @__PURE__ */ new Map(), output = [];
    const lines = source.split(/\r?\n/);
    let inBody = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (inBody) {
        output.push(line);
        if (line.trim() === "}") inBody = false;
        continue;
      }
      const normalized = normalizeJsonAlias(line);
      const match = normalized.match(/^json\s+([\w.-]+)(?:\s+("(?:\\.|[^"\\])*"))?\s*([\[{].*)$/);
      if (!match) {
        if (/^(object|map|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line.trim())) inBody = true;
        output.push(line);
        continue;
      }
      let raw = match[3], depth = 0, quoted = false, escaped = false, position = 0;
      while (true) {
        for (; position < raw.length; position++) {
          const char = raw[position];
          if (quoted) {
            if (escaped) escaped = false;
            else if (char === "\\") escaped = true;
            else if (char === '"') quoted = false;
          } else if (char === '"') quoted = true;
          else if (char === "{" || char === "[") depth++;
          else if (char === "}" || char === "]") depth--;
        }
        if (depth <= 0 && !quoted) break;
        if (++i >= lines.length) throw new Error(`Unclosed JSON block "${match[1]}".`);
        raw += "\n" + lines[i];
      }
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON block "${match[1]}".`);
      }
      const root = match[1];
      let serial = 0;
      const add = (id, label, value2, level) => {
        if (level > 32 || maps.size >= 1e3) throw new Error("JSON diagram exceeds nesting or node limit.");
        if (maps.has(id)) throw new Error(`Duplicate JSON node "${id}".`);
        const entries = [];
        maps.set(id, entries);
        owners.set(id, root);
        output.push(`object ${id} ${JSON.stringify(label)}`);
        const children = Array.isArray(value2) ? value2.map((item, index) => [String(index), item]) : Object.entries(value2);
        for (const [key, item] of children) {
          const displayKey = /[\r\n\t]/.test(key) ? JSON.stringify(key) : key;
          const row = entries.length;
          if (item !== null && typeof item === "object") {
            const child = `${root}__json${++serial}`;
            entries.push({ key: displayKey, value: Array.isArray(item) ? "[]" : "{}" });
            add(child, `${displayKey} ${Array.isArray(item) ? "[]" : "{}"}`, item, level + 1);
            output.push(`${id} --> ${child} [fromMapRow=${row}]`);
          } else entries.push({ key: displayKey, value: JSON.stringify(item) });
        }
      };
      add(root, match[2] ? JSON.parse(match[2]) : root, value, 0);
    }
    return { source: output.join("\n"), maps, owners };
  }

  // src/inline-stereotypes.ts
  function expandInlineStereotypes(source) {
    let body = false;
    return source.split(/\r?\n/).map((line) => {
      if (body) {
        if (line.trim() === "}") body = false;
        return line;
      }
      line = normalizeElementAlias(line);
      const declaration = line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+(?:<[^{}\n]+?>)?)(?:\s+("(?:\\.|[^"\\])*"))?\s+<<([^<>\n]+)>>(\s*(?:\{\s*\}?)?)\s*$/);
      if (/^(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map)\s+.*\{\s*$/.test(line.trim())) body = true;
      if (!declaration) return line;
      const id = declaration[3].replace(/<.*>$/, "");
      const header2 = `${declaration[1]}${declaration[2]} ${declaration[3]}${declaration[4] ? " " + declaration[4] : ""}${declaration[2] === "stereotype" && !declaration[6].trim() ? " {}" : declaration[6]}`;
      return `stereotype ${id} ${JSON.stringify(declaration[5].trim())}
${header2}`;
    }).join("\n");
  }

  // src/class-namespaces.ts
  function expandClassNamespaces(source, implicit = false) {
    let separator = ".";
    let literalBody = false, serial = 0;
    source = source.split(/\r?\n/).map((line) => {
      if (literalBody) {
        if (line.trim() === "}") literalBody = false;
        return line;
      }
      const setting = line.trim().match(/^set namespaceSeparator\s+(\S+)$/);
      if (setting) {
        separator = setting[1];
        return "";
      }
      if (/^\s*(class|abstract|interface|enum|record|annotation|struct|protocol|entity)\s+.*\{\s*$/.test(line)) literalBody = true;
      if (separator !== "." && separator !== "none") {
        const chunks = line.split(/("(?:\\.|[^"\\])*")/);
        line = chunks.map((part, index) => index % 2 ? part : part.replace(new RegExp("[\\w]+(?:" + separator.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&") + "[\\w]+)+", "g"), (name) => name.split(separator).join("."))).join("");
      }
      if (/^\s*<>\s*$/.test(line)) {
        let id;
        do {
          id = `__anonymous_diamond_${++serial}`;
        } while (source.includes(id));
        return `diamond ${id} ""`;
      }
      if (/^\s*<>\s+[\w.-]+/.test(line)) return line;
      const diamonds = [];
      line = line.replace(/(^|\s)<>(?=\s|$)/g, (_, space) => {
        let id;
        do {
          id = `__anonymous_diamond_${++serial}`;
        } while (source.includes(id));
        diamonds.push(`diamond ${id} ""`);
        return space + id;
      });
      return [...diamonds, line].join("\n");
    }).join("\n");
    source = expandInlineStereotypes(source);
    let literal = false;
    source = source.split(/\r?\n/).map((line) => {
      if (literal) {
        if (line.trim() === "}") literal = false;
        return line;
      }
      line = normalizeElementAlias(line);
      if (/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(line)) {
        literal = true;
        return line;
      }
      if (/^\s*stereotype\s+[\w.-]+\s+"(?:\\.|[^"\\])*"\s*$/.test(line)) return line;
      const empty = line.match(/^(\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+[\w.-]+(?:<[^{}\n]+>)?(?:\s+"(?:\\.|[^"\\])*")?)\s*(?:\{\s*\})?\s*$/);
      return empty ? `${empty[1]} {
}` : line;
    }).join("\n");
    if (/^\s*package\s+.*\[namespace\]\s*\{/m.test(source)) return source;
    const expanded = [];
    let body = false;
    let closing = 0;
    for (const line of source.split(/\r?\n/)) {
      if (body) {
        expanded.push(line);
        if (line.trim() === "}") {
          body = false;
          while (closing-- > 0) expanded.push("}");
          closing = 0;
        }
        continue;
      }
      const declaration = line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)(.*\{)\s*$/);
      if (declaration) {
        const parts2 = separator === "none" ? [declaration[3]] : declaration[3].split(".");
        if (parts2.some((part) => !part)) throw new Error("Invalid qualified classifier name.");
        closing = parts2.length - 1;
        for (const part of parts2.slice(0, -1)) expanded.push(`namespace ${part} {`);
        expanded.push(`${declaration[1]}${declaration[2]} ${parts2[parts2.length - 1]}${declaration[4]}`);
        body = true;
      } else expanded.push(line);
    }
    source = expanded.join("\n");
    if (!/^\s*namespace\s/m.test(source)) return source;
    const scopes = [];
    const frames = [];
    const symbols = /* @__PURE__ */ new Set();
    const namespaceLabels = /* @__PURE__ */ new Map();
    const explicitLabels = /* @__PURE__ */ new Set();
    let inClass = false;
    const qualify = (id) => [...scopes, id].join(".");
    const lines = source.split(/\r?\n/).map((text) => {
      const scope = scopes.join(".");
      if (inClass) {
        if (text.trim() === "}") inClass = false;
        return { text, scope, body: true };
      }
      const namespace = text.match(/^\s*namespace\s+([\w.-]+)(?:\s+"([^"]*)")?\s*\{$/);
      if (namespace) {
        const id = qualify(namespace[1]);
        const previous = namespaceLabels.get(id);
        if (explicitLabels.has(id) && namespace[2] !== void 0 && previous !== namespace[2]) throw new Error(`Conflicting namespace label for "${id}".`);
        const label = namespace[2] ?? previous ?? namespace[1];
        if (namespace[2] !== void 0) explicitLabels.add(id);
        namespaceLabels.set(id, label);
        symbols.add(id);
        scopes.push(namespace[1]);
        frames.push("namespace");
        return { text: `package ${id} "${label}" [namespace] {`, scope, body: true };
      }
      const packageBlock = text.match(/^\s*package\s+([\w.-]+)(?:\s+"([^"]*)")?\s*\{$/);
      if (packageBlock) {
        frames.push("package");
        const id = qualify(packageBlock[1]);
        symbols.add(id);
        return { text: `package ${id} "${packageBlock[2] ?? packageBlock[1]}" {`, scope, body: true };
      }
      if (text.trim() === "}") {
        if (frames.pop() === "namespace") scopes.pop();
        return { text, scope, body: true };
      }
      const namedNote = text.match(/^(\s*(?:note|rnote|hnote)\s+"(?:\\.|[^"\\])*"\s+as\s+)([\w.-]+)\s*$/);
      if (namedNote) {
        const id = qualify(namedNote[2]);
        symbols.add(id);
        return { text: `${namedNote[1]}${id}`, scope, body: true };
      }
      const diamond = text.match(/^(\s*(?:diamond|circle)\s+)([\w.-]+)(.*)$/);
      if (diamond) {
        const id = qualify(diamond[2]);
        symbols.add(id);
        return { text: `${diamond[1]}${id}${diamond[3]}`, scope, body: true };
      }
      const declaration = text.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)(<.*>)?(\s*(?:"[^"]*"|[^\s{]+)?\s*\{)\s*$/);
      if (declaration) {
        inClass = true;
        const id = qualify(declaration[3]);
        symbols.add(id);
        const tail = declaration[5];
        return { text: `${declaration[1]}${declaration[2]} ${id}${declaration[4] ?? ""}${tail.trim() === "{" ? ` "${declaration[3]}" {` : tail}`, scope, body: true };
      }
      return { text, scope, body: false };
    });
    if (scopes.length) throw new Error("Unclosed namespace.");
    const resolve = (id, scope, infer = false) => {
      const parts2 = scope ? scope.split(".") : [];
      for (let length = parts2.length; length >= 0; length--) {
        const candidate = [...parts2.slice(0, length), id].join(".");
        if (symbols.has(candidate)) return candidate;
      }
      if (implicit && infer) {
        const candidate = scope && !id.includes(".") ? `${scope}.${id}` : id;
        symbols.add(candidate);
        return candidate;
      }
      return id;
    };
    if (implicit) {
      const endpoints = new RegExp(String.raw`^\s*([\w.-]+)(?:::~?[\w$]+(?:\([^)]*\))?)?(?:\s+"[^"]*")?\s+(?:${classRelationOperators})(?:\s+"[^"]*")?\s+([\w.-]+)`);
      for (const line of lines) {
        if (line.body) continue;
        const relation = line.text.match(endpoints);
        if (relation) {
          resolve(relation[1], line.scope, true);
          resolve(relation[2], line.scope, true);
        }
        const member = line.text.match(/^\s*([\w.-]+)\s*:(?!:)/);
        if (member) resolve(member[1], line.scope, true);
      }
    }
    return lines.map(({ text, scope, body: body2 }) => {
      if (body2) return text.replace(/^package ([\w.-]+) "[^"]*" \[namespace\] \{$/, (_, id) => `package ${id} "${namespaceLabels.get(id)}" [namespace] {`);
      const slot = text.match(/^(\s*)([\w.-]+)(\s*:(?!:).*)$/);
      if (slot) return `${slot[1]}${resolve(slot[2], scope, true)}${slot[3]}`;
      const binding = text.match(/^(\s*bind\s+)([\w.-]+)\s+([\w.-]+)(.*)$/);
      if (binding) return `${binding[1]}${resolve(binding[2], scope)} ${resolve(binding[3], scope)}${binding[4]}`;
      const association = text.match(/^(\s*association\s+)([\w.-]+)\s+([\w.-]+)(?:->([\w.-]+))?\s*$/);
      if (association) return `${association[1]}${resolve(association[2], scope)} ${association[4] ? `${resolve(association[3], scope)}->${resolve(association[4], scope)}` : association[3]}`;
      const memberRelation = text.match(new RegExp(String.raw`^(\s*)([\w.-]+)(::~?[\w$]+(?:\([^)]*\))?)?(\s+(?:"[^"]*"\s+)?(?:${classRelationOperators})(?:\s+"[^"]*")?\s+)([\w.-]+)(::~?[\w$]+(?:\([^)]*\))?)?(.*)$`));
      if (memberRelation && (memberRelation[3] || memberRelation[6])) return `${memberRelation[1]}${resolve(memberRelation[2], scope, true)}${memberRelation[3] ?? ""}${memberRelation[4]}${resolve(memberRelation[5], scope, true)}${memberRelation[6] ?? ""}${memberRelation[7]}`;
      const relation = text.match(new RegExp(String.raw`^(\s*)([\w.-]+)(\s+(?:"[^"]*"\s+)?(?:${classRelationOperators})(?:\s+"[^"]*")?\s+)([\w.-]+)(.*)$`));
      if (relation) return `${relation[1]}${resolve(relation[2], scope, true)}${relation[3]}${resolve(relation[4], scope, true)}${relation[5]}`;
      text = text.replace(/^(\s*(?:note|rnote|hnote|constraint)(?:\s+(?:left|right|top|bottom)\s+of)?\s+)([\w.-]+)->([\w.-]+)/, (_, prefix, from, to) => `${prefix}${resolve(from, scope)}->${resolve(to, scope)}`);
      return text.replace(/^(\s*(?:(?:note|rnote|hnote|constraint)(?:\s+(?:left|right|top|bottom)\s+of)?|visibility|stereotype|tag|hide|show|remove|restore)\s+)([\w.-]+)/, (_, prefix, id) => prefix + resolve(id, scope));
    }).join("\n");
  }

  // src/object-namespaces.ts
  function expandObjectNamespaces(source, implicit = false) {
    let markerPrefix = "__finch_object_";
    while (source.includes(markerPrefix)) markerPrefix += "x";
    const blockPattern = new RegExp(`^${markerPrefix}block_(\\d+)$`);
    const refPattern = new RegExp(`^[\\w.-]+ --> ([\\w.-]+): ${markerPrefix}ref_(\\d+)_(\\d+)$`);
    const blocks = [];
    const masked = [];
    const lines = source.split(/\r?\n/);
    let classifier = false;
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (classifier) {
        masked.push(line);
        if (line.trim() === "}") classifier = false;
        continue;
      }
      line = normalizeJsonAlias(normalizeElementAlias(line));
      if (/^\s*(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line)) {
        classifier = true;
        masked.push(line);
        continue;
      }
      const match = line.match(/^\s*(object|map|json)\s+([\w.-]+)(.*)$/);
      if (!match) {
        masked.push(line);
        continue;
      }
      const labelTail = match[3].trim();
      const implicitLabel = !labelTail || /^[{[]/.test(labelTail);
      const declaration = implicitLabel ? `${match[1]} ${match[2]} ${JSON.stringify(match[2])}${match[3]}` : line;
      const block = { lines: [declaration] };
      if (match[1] === "json") {
        const header2 = match[3].match(/^\s*(?:"(?:\\.|[^"\\])*"\s*)?([\[{].*)$/);
        let raw = header2?.[1] ?? "";
        let depth = 0, quoted = false, escaped = false, pos = 0;
        if (!header2) throw new Error("JSON declaration needs an object or array.");
        while (true) {
          for (; pos < raw.length; pos++) {
            const c = raw[pos];
            if (quoted) {
              if (escaped) escaped = false;
              else if (c === "\\") escaped = true;
              else if (c === '"') quoted = false;
            } else if (c === '"') quoted = true;
            else if (c === "{" || c === "[") depth++;
            else if (c === "}" || c === "]") depth--;
          }
          if (depth <= 0 && !quoted) break;
          if (++i >= lines.length) throw new Error(`Unclosed JSON block "${match[2]}".`);
          block.lines.push(lines[i]);
          raw += "\n" + lines[i];
        }
      } else if (/\{\s*$/.test(line)) {
        do {
          if (++i >= lines.length) throw new Error(`Unclosed ${match[1]} "${match[2]}".`);
          block.lines.push(lines[i]);
        } while (lines[i].trim() !== "}");
      }
      const index = blocks.length;
      blocks.push(block);
      masked.push(`class ${match[2]} {`, `${markerPrefix}block_${index}`, "}");
      if (match[1] === "map") block.lines.forEach((row, j) => {
        const ref = row.match(/\*-+>\s*([\w.-]+)\s*$/);
        if (ref) {
          masked.push(`${match[2]} --> ${ref[1]}: ${markerPrefix}ref_${index}_${j}`);
        }
      });
    }
    const normalized = expandClassNamespaces(masked.join("\n"), implicit).split("\n");
    const filtered = normalized.filter((line) => {
      const ref = line.match(refPattern);
      if (!ref) return true;
      const block = blocks[Number(ref[2])];
      const row = Number(ref[3]);
      block.lines[row] = block.lines[row].replace(/(\*-+>\s*)[\w.-]+\s*$/, `$1${ref[1]}`);
      return false;
    });
    const output = [];
    for (let i = 0; i < filtered.length; i++) {
      const marker2 = filtered[i + 1]?.match(blockPattern);
      if (!marker2) {
        output.push(filtered[i]);
        continue;
      }
      const id = filtered[i].match(/^class ([\w.-]+)/)[1];
      const block = blocks[Number(marker2[1])];
      output.push(block.lines[0].replace(/^(\s*(?:object|map|json)\s+)[\w.-]+/, `$1${id}`), ...block.lines.slice(1));
      i += 2;
    }
    return output.join("\n");
  }

  // src/member-target.ts
  function resolveMemberIndex(members, target) {
    const normalized = members.map((member, index) => ({ index, kind: member.kind, text: (member.visibilityEscaped ? member.text : member.text.replace(/^[+~#-]\s*/, "")).trim() })).filter((member) => member.kind !== "separator");
    const exact = normalized.filter((member) => member.text === target);
    const matches = exact.length ? exact : normalized.filter((member) => {
      if (target.includes("(")) {
        return member.text.match(/([A-Za-z_$][\w$]*\([^)]*\))/)?.[1] === target;
      }
      const head = member.text.split(/[(:=]/)[0].trim();
      return head === target || head.match(/([A-Za-z_$][\w$]*)$/)?.[1] === target;
    });
    if (matches.length !== 1) throw new Error(`Unknown or ambiguous member target "${target}". Use the full signature for overloaded operations.`);
    return matches[0].index;
  }

  // src/object-maps.ts
  function expandObjectMaps(source, initialMaps = /* @__PURE__ */ new Map()) {
    const maps = new Map(initialMaps);
    const output = [];
    const links = [];
    let active;
    let objectBody = false;
    for (const line of source.split(/\r?\n/)) {
      const text = line.trim();
      if (objectBody) {
        output.push(line);
        if (text === "}") objectBody = false;
        continue;
      }
      if (active !== void 0) {
        if (text === "}") {
          output.push("}");
          active = void 0;
          continue;
        }
        if (!text || /^(#|')/.test(text)) continue;
        const row = text.match(/^(.+?)\s*(=>|\*-+>)\s*(.*)$/);
        if (!row) throw new Error(`Invalid map entry "${text}".`);
        const key = row[1].trim();
        const value = row[3].trim();
        const entries = maps.get(active);
        if (entries.some((e) => e.key === key)) throw new Error(`Duplicate map key "${key}".`);
        entries.push({ key, value: row[2] === "=>" ? value : "" });
        if (row[2] !== "=>") {
          if (!/^[\w.-]+$/.test(value)) throw new Error(`Invalid map reference "${value}".`);
          links.push(`${active} --> ${value} [fromMapRow=${entries.length - 1}]`);
        }
        continue;
      }
      const declaration = text.match(/^map\s+([\w.-]+)(?:\s+("[^"\n]*"))?\s*\{\s*(\})?$/);
      if (declaration) {
        active = declaration[1];
        if (maps.has(active)) throw new Error(`Duplicate map "${active}".`);
        maps.set(active, []);
        output.push(`object ${active} ${declaration[2] ?? `"${active}"`} {`);
        if (declaration[3]) {
          output.push("}");
          active = void 0;
        }
        continue;
      }
      if (/^(object|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(text)) objectBody = true;
      output.push(line);
    }
    if (active !== void 0) throw new Error(`Unclosed map "${active}".`);
    const transformed = output.map((line) => {
      const match = line.match(new RegExp(String.raw`^([\w.-]+)(?:::(~?[\w.$-]+(?:\([^)]*\))?))?(\s+(?:"[^"]+"\s+)?(?:${classRelationOperators})(?:\s+"[^"]+")?\s+)([\w.-]+)(?:::(~?[\w.$-]+(?:\([^)]*\))?))?(.*)$`));
      if (!match || !match[2] && !match[5]) return line;
      const attrs = [];
      for (const [id, key, endpoint] of [[match[1], match[2], "from"], [match[4], match[5], "to"]]) {
        if (key === void 0 || !maps.has(id)) continue;
        const index = maps.get(id)?.findIndex((e) => e.key === key) ?? -1;
        if (index < 0) throw new Error(`Unknown map entry "${id}::${key}".`);
        attrs.push(`${endpoint}MapRow=${index}`);
      }
      if (!attrs.length) return line;
      const from = match[1] + (match[2] && !maps.has(match[1]) ? `::${match[2]}` : "");
      const to = match[4] + (match[5] && !maps.has(match[4]) ? `::${match[5]}` : "");
      const tail = match[6];
      return `${from}${match[3]}${to}${tail.replace(/\s*\[([^\]]*)\]\s*$/, (_, existing) => {
        attrs.unshift(existing);
        return "";
      })} [${attrs.join(" ")}]`;
    });
    return { source: [...transformed, ...links].join("\n"), maps };
  }

  // src/activity-lanes.ts
  function parseActivityLaneSwitches(source, parse) {
    if (!/^\s*in\s+[\w.-]+\s*$/m.test(source) && !(/^\s*@activity\s+flow\b/m.test(source) && /^\s*lane\s+.*\{\s*$/m.test(source))) return void 0;
    const lanes = /* @__PURE__ */ new Map(), owners = /* @__PURE__ */ new Map();
    let current;
    const frames = [];
    let serial = 0;
    const lines = source.split(/\r?\n/);
    for (const line of lines) {
      const lane = line.trim().match(/^lane\s+([\w.-]+)(?:\s+"([^"]*)")?(?:\s*\{)?$/);
      if (lane) {
        const old = lanes.get(lane[1]);
        if (old !== void 0 && lane[2] !== void 0 && old !== lane[2]) throw new Error(`Conflicting lane label ${lane[1]}.`);
        lanes.set(lane[1], lane[2] ?? old ?? lane[1]);
      }
    }
    const body = lines.map((line) => {
      if (/^\s*(?:#|')/.test(line)) return line;
      const laneBlock = line.trim().match(/^lane\s+([\w.-]+)(?:\s+"[^"]*")?\s*\{$/);
      if (laneBlock) {
        if (frames.some((frame) => frame.lane)) throw new Error("Lanes cannot be nested.");
        frames.push({ lane: laneBlock[1], previous: current });
        current = laneBlock[1];
        return "";
      }
      if (/^\s*lane\s+[\w.-]+(?:\s+"[^"]*")?\s*$/.test(line)) return "";
      const change = line.trim().match(/^in\s+([\w.-]+)$/);
      if (change) {
        if (!lanes.has(change[1])) throw new Error(`Unknown lane ${change[1]}.`);
        current = change[1];
        return "";
      }
      if (line.trim() === "}") {
        const frame = frames.pop();
        if (frame?.lane) {
          current = frame.previous;
          return "";
        }
      }
      const loop = line.trim().match(/^(while|repeat)\s+([\w.-]+)/);
      if (line.trim().endsWith("{")) frames.push({ ...loop ? { loop: loop[2] } : {}, previous: current });
      if (/^(break|continue)$/.test(line.trim())) {
        const ownerLoop = [...frames].reverse().find((frame) => frame.loop)?.loop;
        serial++;
        if (ownerLoop && current) owners.set(`${ownerLoop}.${line.trim()}${serial}`, current);
      }
      const declaration = line.trim().match(/^(start|end|flowfinal|action|activity|send|receive|object|decision|merge|fork|join|if|while|repeat|switch|split)\s+([\w.-]+)/);
      if (declaration && current) {
        owners.set(declaration[2], current);
        if (["if", "while", "repeat", "switch", "split"].includes(declaration[1])) {
          owners.set(`${declaration[2]}.done`, current);
          owners.set(`${declaration[2]}.test`, current);
        }
      }
      return line;
    }).join("\n");
    if (frames.some((frame) => frame.lane)) throw new Error("Unclosed lane block.");
    const model = parse(body);
    for (const node of model.nodes) {
      const owner = owners.get(node.id);
      if (owner) node.parentId = owner;
    }
    for (const [id, label] of lanes) {
      if (model.nodes.some((n) => n.id === id)) throw new Error(`Lane ID conflicts with node ${id}.`);
      model.nodes.push({ id, label, shape: "container", attributes: { umlBlock: "lane" } });
    }
    return { ...model, source };
  }

  // src/template-binding.ts
  function parts(text) {
    const result = [];
    const stack = [];
    let start = 0;
    let quote = "";
    for (let i = 0; i < text.length; i++) {
      const token = text[i];
      if (quote) {
        if (token === "\\") {
          i++;
          continue;
        }
        if (token === quote) quote = "";
        continue;
      }
      if (token === '"' || token === "'") {
        quote = token;
        continue;
      }
      if ("<([".includes(token)) stack.push(token);
      if (">)]".includes(token) && stack.pop() !== { ">": "<", ")": "(", "]": "[" }[token]) throw new Error("Unbalanced template arguments.");
      if (token === "," && !stack.length) {
        result.push(text.slice(start, i).trim());
        start = i + 1;
      }
    }
    if (quote) throw new Error("Unclosed quoted template argument.");
    if (stack.length) throw new Error("Unbalanced template arguments.");
    result.push(text.slice(start).trim());
    return result;
  }
  function addTemplateBinding(model, from, to, text) {
    const source = model.nodes.find((n) => n.id === from && n.shape === "uml-class");
    const target = model.nodes.find((n) => n.id === to && n.shape === "uml-class");
    if (!source || !target?.attributes.templateParameters) throw new Error("Binding requires a classifier and a declared template.");
    const names = parts(target.attributes.templateParameters).map((p) => p.split(/[:=]/)[0].trim());
    const values = /* @__PURE__ */ Object.create(null);
    for (const part of parts(text)) {
      const pair = part.match(/^([\w]+)\s*=\s*(.+)$/);
      if (!pair || !names.includes(pair[1]) || Object.prototype.hasOwnProperty.call(values, pair[1])) throw new Error(`Invalid or duplicate template substitution: ${part}`);
      values[pair[1]] = pair[2];
    }
    let id = `binding-${model.connections.length + 1}`;
    while (model.connections.some((e) => e.id === id)) id += "-bind";
    model.connections.push({ id, from, to, label: `\xABbind\xBB <${Object.entries(values).map(([formal, actual]) => `${formal} \u2192 ${actual}`).join(", ")}>`, dashed: true, order: model.connections.length, attributes: { relation: "dependency", templateBinding: JSON.stringify(values) } });
  }

  // src/class-display.ts
  function applyClassDisplay(model, rules) {
    for (const rule of rules) {
      const match = rule.match(/^(hide|show|remove|restore)\s+(.+)$/);
      const show = match[1] === "show" || match[1] === "restore";
      const tokens = match[2].split(/\s+/);
      if (tokens[0] === "@unlinked") tokens[0] = "unlinked";
      const categories = /* @__PURE__ */ new Set(["members", "fields", "attributes", "methods", "operations", "stereotype", "empty", "private", "protected", "public", "package"]);
      const selector2 = categories.has(tokens[0]) && !(tokens[0] === "stereotype" && tokens.length > 1) ? "*" : tokens.shift();
      const subject = tokens.join(" ") || "node";
      const valid = /^(node|stereotype|members|fields|attributes|methods|operations|empty (members|fields|attributes|methods|operations)|(private|protected|public|package) members)$/;
      if (!valid.test(subject)) throw new Error(`Unsupported display rule: ${rule}`);
      if (["remove", "restore"].includes(match[1]) && subject !== "node") throw new Error("remove/restore select classifiers, not member compartments.");
      const linked = new Set(model.connections.flatMap((e) => [e.from, e.to]));
      model.nodes.filter((n) => n.attributes.associationClass).forEach((n) => linked.add(n.id));
      const nodes = model.nodes.filter((n) => ["uml-class", "uml-instance", "uml-map"].includes(n.shape) && (selector2 === "*" || selector2.startsWith("$") && JSON.parse(n.attributes.tags ?? "[]").includes(selector2.slice(1)) || selector2 === "unlinked" && !linked.has(n.id) || n.id === selector2 || n.attributes.kind === selector2 || selector2 === `<<${n.attributes.stereotype}>>`));
      if (!nodes.length && selector2 !== "*" && selector2 !== "unlinked" && !["class", "abstract", "interface", "enum", "annotation", "record", "dataclass", "struct", "protocol", "exception", "metaclass", "stereotype", "entity"].includes(selector2) && !selector2.startsWith("<<")) throw new Error(`Unknown display target ${selector2}.`);
      for (const node of nodes) {
        if (subject === "node") {
          node.attributes.hidden = String(!show);
          node.attributes.removed = String(match[1] === "remove");
          continue;
        }
        if (subject === "stereotype") {
          node.attributes.hideStereotype = String(!show);
          continue;
        }
        if (subject.startsWith("empty ")) {
          const compartment = subject.slice(6);
          if (["members", "fields", "attributes"].includes(compartment)) node.attributes.hideEmptyFields = String(!show);
          if (["members", "methods", "operations"].includes(compartment)) node.attributes.hideEmptyOperations = String(!show);
          continue;
        }
        const members = JSON.parse(node.attributes.members ?? "[]");
        const hidden2 = JSON.parse(node.attributes.hiddenMembers ?? "[]");
        const selected = new Set(hidden2);
        members.forEach((member, index) => {
          const visibility = { private: "-", protected: "#", public: "+", package: "~" }[tokens[tokens.length - 2] ?? ""];
          const matches = subject === "members" || (visibility ? !member.visibilityEscaped && member.text.trimStart().startsWith(visibility) : ["fields", "attributes"].includes(subject) ? member.kind !== "operation" && member.kind !== "separator" : member.kind === "operation");
          if (matches) {
            if (show) selected.delete(index);
            else selected.add(index);
          }
        });
        node.attributes.hiddenMembers = JSON.stringify([...selected]);
        node.attributes.hideEmptyMembers = "true";
      }
    }
  }

  // src/activity-blocks.ts
  function expandActivityBlocks(source) {
    const automatic = /^\s*@activity\s+flow\s*(?:\r?\n|$)/.test(source);
    if (!automatic && !/^\s*(while|repeat|if|switch|split)\s+[^\n]*\{/m.test(source)) return source;
    const lines = source.split(/\r?\n/).filter((line) => line.trim() && !/^\s*['#]/.test(line));
    let cursor = 0, serial = 0;
    const output = [], generated = [], explicit = [], back = [];
    const connect = (from, to) => from.forEach((id) => generated.push(`${id} -> ${to}`));
    const block = (loop) => {
      let entry = "";
      let exits = [];
      while (cursor < lines.length && lines[cursor].trim() !== "}") {
        const line = lines[cursor].trim();
        if (!line || line.startsWith("'")) {
          cursor++;
          continue;
        }
        let next;
        const split = line.match(/^split\s+([\w.-]+)\s*\{$/);
        if (split) {
          cursor++;
          const id = split[1];
          let count = 0, live = 0;
          output.push(`fork ${id}`);
          while (cursor < lines.length && lines[cursor].trim() !== "}") {
            if (!lines[cursor].trim() || lines[cursor].trim().startsWith("'")) {
              cursor++;
              continue;
            }
            if (!/^branch\s*\{$/.test(lines[cursor++].trim())) throw new Error(`Expected branch in split ${id}.`);
            const body = block(loop);
            if (lines[cursor++]?.trim() !== "}") throw new Error(`Unclosed branch in split ${id}.`);
            generated.push(`${id} -> ${body.entry}`);
            connect(body.exits, `${id}.done`);
            live += body.exits.length;
            count++;
          }
          if (count < 2 || lines[cursor++]?.trim() !== "}") throw new Error(`Split ${id} needs at least two closed branches.`);
          if (live) output.push(`merge ${id}.done "" [shape=choice-state]`);
          next = { entry: id, exits: live ? [`${id}.done`] : [] };
          if (!entry) entry = id;
          else {
            connect(exits, id);
            if (!exits.length) next.exits = [];
          }
          exits = next.exits;
          continue;
        }
        const selection = line.match(/^switch\s+([\w.-]+)\s+"((?:\\.|[^"])*)"\s*\{$/);
        if (selection) {
          cursor++;
          const id = selection[1];
          const labels = /* @__PURE__ */ new Set();
          let count = 0, live = 0;
          output.push(`decision ${id} "${selection[2]}"`);
          while (cursor < lines.length && lines[cursor].trim() !== "}") {
            const branch = lines[cursor++].trim().match(/^case\s+"((?:\\.|[^"])*)"\s*\{$/);
            if (!branch || labels.has(branch[1])) throw new Error(`Invalid or duplicate case in ${id}.`);
            labels.add(branch[1]);
            const body = block(loop);
            if (lines[cursor++]?.trim() !== "}") throw new Error(`Unclosed case in ${id}.`);
            generated.push(`${id} -> ${body.entry}: [${branch[1]}]`);
            connect(body.exits, `${id}.done`);
            live += body.exits.length;
            count++;
          }
          if (!count || lines[cursor++]?.trim() !== "}") throw new Error(`Empty or unclosed switch ${id}.`);
          if (live) output.push(`merge ${id}.done "" [shape=choice-state]`);
          next = { entry: id, exits: live ? [`${id}.done`] : [] };
          if (!entry) entry = next.entry;
          else {
            connect(exits, next.entry);
            if (!exits.length) next.exits = [];
          }
          exits = next.exits;
          continue;
        }
        if (/^(kill|detach)$/.test(line)) {
          if (!entry) throw new Error(`${line} requires a preceding activity in the block.`);
          exits = [];
          cursor++;
          continue;
        }
        const header2 = line.match(/^(while|repeat|if)\s+([\w.-]+)\s+"((?:\\.|[^"])*)"\s*\{$/);
        if (header2) {
          cursor++;
          const [, kind, id, label] = header2;
          const condition = kind === "repeat" ? `${id}.test` : id;
          const body = block(kind === "if" ? loop : { id, condition });
          if (lines[cursor++]?.trim() !== "}") throw new Error(`Unclosed ${kind} ${id}.`);
          const testsCondition = kind !== "repeat" || body.exits.length > 0 || back.some((edge) => edge.endsWith(` -> ${condition}`));
          if (testsCondition) output.push(`decision ${condition} "${label}"`);
          if (kind === "if") {
            generated.push(`${id} -> ${body.entry} [yes]`);
            connect(body.exits, `${id}.done`);
            if (/^else\s*\{$/.test(lines[cursor]?.trim() ?? "")) {
              cursor++;
              const alternative = block(loop);
              if (lines[cursor++]?.trim() !== "}") throw new Error(`Unclosed else ${id}.`);
              generated.push(`${id} -> ${alternative.entry} [no]`);
              connect(alternative.exits, `${id}.done`);
              next = { entry: id, exits: body.exits.length || alternative.exits.length ? [`${id}.done`] : [] };
            } else {
              generated.push(`${id} -> ${id}.done [no]`);
              next = { entry: id, exits: [`${id}.done`] };
            }
            if (next.exits.length) output.push(`merge ${id}.done "" [shape=choice-state]`);
          } else {
            const exitsLoop = testsCondition || generated.some((edge) => edge.endsWith(` -> ${id}.done`));
            if (exitsLoop) output.push(`merge ${id}.done "" [shape=choice-state]`);
            if (testsCondition) generated.push(`${condition} -> ${id}.done [no]`);
            if (kind === "while") {
              generated.push(`${condition} -> ${body.entry} [yes]`);
              body.exits.forEach((exit) => back.push(`${exit} -> ${condition}`));
            } else {
              output.push(`merge ${id} "" [shape=choice-state]`);
              generated.push(`${id} -> ${body.entry}`);
              connect(body.exits, condition);
              if (testsCondition) back.push(`${condition} -> ${body.entry} [yes]`);
            }
            next = { entry: id, exits: exitsLoop ? [`${id}.done`] : [] };
          }
        } else if (/^(break|continue)$/.test(line)) {
          if (!loop) throw new Error(`${line} requires a loop.`);
          cursor++;
          const id = `${loop.id}.${line}${++serial}`;
          output.push(`merge ${id} "" [shape=choice-state]`);
          (line === "continue" ? back : generated).push(`${id} -> ${line === "break" ? `${loop.id}.done` : loop.condition}`);
          next = { entry: id, exits: [] };
        } else if (/^[\w.-]+\s+(?:--?>|\.\.>)/.test(line)) {
          explicit.push(line);
          cursor++;
          continue;
        } else {
          const node = line.match(/^(start|action|activity|send|receive|object|decision|merge|fork|join|end|flowfinal)\s+([\w.-]+)/);
          if (!node) throw new Error(`Invalid loop statement: ${line}`);
          output.push(lines[cursor++]);
          next = { entry: node[2], exits: ["end", "flowfinal"].includes(node[1]) ? [] : [node[2]] };
        }
        if (!entry) entry = next.entry;
        else {
          connect(exits, next.entry);
          if (!exits.length) next.exits = [];
        }
        exits = next.exits;
      }
      if (!entry) throw new Error("Activity block cannot be empty.");
      return { entry, exits };
    };
    if (automatic) {
      cursor = lines.findIndex((line) => line.trim().startsWith("@activity")) + 1;
      output.push("@activity");
      block();
      if (cursor < lines.length) throw new Error("Unexpected closing brace in activity flow.");
    }
    while (cursor < lines.length) {
      if (/^\s*(while|repeat|if|switch|split)\s+[^\n]*\{/.test(lines[cursor])) {
        const begin = cursor;
        let depth = 0;
        do {
          const line = lines[cursor++].trim();
          if (line.endsWith("{")) depth++;
          if (line === "}") depth--;
        } while (cursor < lines.length && depth);
        if (/^\s*else\s*\{$/.test(lines[cursor] ?? "")) {
          do {
            const line = lines[cursor++].trim();
            if (line.endsWith("{")) depth++;
            if (line === "}") depth--;
          } while (cursor < lines.length && depth);
        }
        const end = cursor;
        lines.splice(end, 0, "}");
        cursor = begin;
        block();
        lines.splice(end, 1);
        cursor = end;
      } else output.push(lines[cursor++]);
    }
    const overridden = new Set(explicit.map((line) => line.match(/^([\w.-]+)/)[1]));
    return [...output, ...generated.filter((line) => !overridden.has(line.split(" ")[0])), ...explicit, ...back.filter((line) => !overridden.has(line.split(" ")[0]))].join("\n");
  }

  // src/state-validation.ts
  function validateState(model) {
    const library = model.stateMachines ?? /* @__PURE__ */ Object.create(null);
    const result = validateStateStructure(model, library);
    for (const [name, machine] of Object.entries(library)) {
      result.push(...validateStateStructure(machine, library).map((d) => ({ ...d, message: `${name}: ${d.message}` })));
    }
    const visit = (name, path) => {
      if (path.includes(name)) {
        result.push({ code: "submachine-cycle", message: `Recursive submachine reference: ${[...path, name].join(" -> ")}` });
        return;
      }
      for (const node of library[name]?.nodes ?? []) if (node.attributes.submachine && library[node.attributes.submachine]) visit(node.attributes.submachine, [...path, name]);
    };
    for (const name of Object.keys(library)) visit(name, []);
    return result;
  }
  function validateStateStructure(model, library) {
    if (model.kind !== "state") return [];
    const result = [];
    const nodes = new Map(model.nodes.map((node) => [node.id, node]));
    const kind = (id) => nodes.get(id)?.attributes.stateKind;
    const descendant = (id, ancestor) => {
      const seen = /* @__PURE__ */ new Set();
      let parent = nodes.get(id)?.parentId;
      while (parent && !seen.has(parent)) {
        if (parent === ancestor) return true;
        seen.add(parent);
        parent = nodes.get(parent)?.parentId;
      }
      return false;
    };
    const regionsOf = (id) => {
      const regions = /* @__PURE__ */ new Map();
      let node = nodes.get(id);
      const seen = /* @__PURE__ */ new Set();
      while (node?.parentId && !seen.has(node.id)) {
        seen.add(node.id);
        const parent = nodes.get(node.parentId);
        if (parent?.attributes.stateKind === "region" && parent.parentId) regions.set(parent.parentId, parent.id);
        node = parent;
      }
      return regions;
    };
    const orthogonal = (a, b) => {
      const ar = regionsOf(a), br = regionsOf(b);
      return [...ar].some(([owner, region]) => br.has(owner) && br.get(owner) !== region);
    };
    const add = (code, message, nodeId, edgeId) => result.push({ code, message, ...nodeId ? { nodeId } : {}, ...edgeId ? { edgeId } : {} });
    for (const node of model.nodes) {
      const k = kind(node.id);
      if (!k) continue;
      const incoming = model.connections.filter((edge) => edge.to === node.id);
      const outgoing = model.connections.filter((edge) => edge.from === node.id);
      if (k === "region" && (!node.parentId || kind(node.parentId) !== "state")) add("region-owner", `${node.id}: region requires a state owner.`, node.id);
      if (node.parentId && !nodes.has(node.parentId)) add("state-owner", `${node.id}: unknown owner ${node.parentId}.`, node.id);
      if (model.stateMachineKind === "protocol" && (node.attributes.stateBehaviors || node.attributes.defer || ["history", "deep-history"].includes(k))) add("protocol-state", `${node.id}: protocol machines cannot define execution behaviors, deferred events, or history.`, node.id);
      if (k === "state") {
        const children = model.nodes.filter((n) => n.parentId === node.id && !n.attributes.connectionPoint);
        if (children.some((n) => kind(n.id) === "region") && children.some((n) => kind(n.id) !== "region")) add("region-mixed", `${node.id}: explicit regions cannot be mixed with directly owned vertices.`, node.id);
        if (node.attributes.submachine) {
          if (!library[node.attributes.submachine]) add("submachine-reference", `${node.id}: unknown machine ${node.attributes.submachine}.`, node.id);
          if (children.length) add("submachine-regions", `${node.id}: a submachine state cannot also own regions.`, node.id);
        }
      }
      if (["inputpin", "outputpin"].includes(k)) {
        const owner = node.parentId ? nodes.get(node.parentId) : void 0;
        if (!owner || owner.attributes.stateKind !== "state" || owner.shape !== "container") add("pin-owner", `${node.id}: a state boundary pin requires a composite state owner.`, node.id);
        if (node.attributes.ref) add("pin-reference", `${node.id}: state boundary pins are not machine connection-point references.`, node.id);
        if (owner) {
          const input = k === "inputpin";
          if (incoming.some((edge) => descendant(edge.from, owner.id) === input) || outgoing.some((edge) => descendant(edge.to, owner.id) !== input)) add("pin-direction", `${node.id}: boundary pin connections must follow its input/output direction.`, node.id);
        }
      }
      if (["entrypoint", "exitpoint"].includes(k)) {
        const owner = node.parentId ? nodes.get(node.parentId) : void 0;
        if (node.parentId && kind(node.parentId) !== "state") add("point-owner", `${node.id}: a connection point belongs to a state or machine, not a region.`, node.id);
        if (owner?.attributes.submachine) {
          const definition = library[owner.attributes.submachine];
          const refs = (node.attributes.ref ?? "").split(",");
          const points = refs.map((ref) => definition?.nodes.find((n) => n.id === ref && !n.parentId && n.attributes.stateKind === k));
          if (new Set(refs).size !== refs.length || points.some((point) => !point)) add("point-reference", `${node.id}: ref must name a matching machine connection point.`, node.id);
        } else {
          if (node.attributes.ref) add("point-reference", `${node.id}: ref requires a submachine owner.`, node.id);
          if (owner && !model.nodes.some((n) => n.parentId === owner.id && !n.attributes.connectionPoint)) add("point-composite", `${node.id}: connection points require a composite state.`, node.id);
        }
        if (k === "entrypoint") {
          if (owner && incoming.some((e) => descendant(e.from, owner.id))) add("entry-direction", `${node.id}: entry must be entered from outside its owner.`, node.id);
          if (owner?.attributes.submachine ? outgoing.length > 0 : outgoing.some((e) => owner && !descendant(e.to, owner.id))) add("entry-direction", `${node.id}: entry must lead inside its owner.`, node.id);
        } else {
          if (owner?.attributes.submachine ? incoming.length > 0 : incoming.some((e) => owner && !descendant(e.from, owner.id))) add("exit-direction", `${node.id}: exit must be reached from inside its owner.`, node.id);
          if (owner && outgoing.some((e) => descendant(e.to, owner.id))) add("exit-direction", `${node.id}: exit must lead outside its owner.`, node.id);
        }
      }
      if (k === "choice" && (incoming.length < 1 || outgoing.length < 1)) add("choice-degree", `${node.id}: choice requires incoming and outgoing transitions.`, node.id);
      if (k === "junction" && (incoming.length < 1 || outgoing.length < 1)) add("junction-degree", `${node.id}: junction requires incoming and outgoing transitions.`, node.id);
      if (["entrypoint", "exitpoint"].includes(k) && !node.attributes.ref) {
        const segments = k === "entrypoint" ? outgoing.map((e) => e.to) : incoming.map((e) => e.from);
        if (segments.some((a, i) => segments.slice(i + 1).some((b) => !orthogonal(a, b)))) add("point-regions", `${node.id}: multiple boundary segments must belong to different orthogonal regions.`, node.id);
        if (!node.parentId && (k === "entrypoint" ? incoming.length : outgoing.length)) add("machine-boundary", `${node.id}: machine entry/exit cannot connect in the reverse direction.`, node.id);
      }
      if (k === "fork" || k === "join") {
        const ends = k === "fork" ? outgoing.map((e) => e.to) : incoming.map((e) => e.from);
        if (ends.some((a, i) => ends.slice(i + 1).some((b) => !orthogonal(a, b)))) add("parallel-regions", `${node.id}: fork/join branches must belong to different regions of an orthogonal state.`, node.id);
      }
      if (k === "initial") {
        if (incoming.length || outgoing.length > 1) add("initial-degree", `${node.id}: initial allows no incoming and at most one outgoing transition.`, node.id);
        if (model.nodes.some((other) => other.id !== node.id && other.parentId === node.parentId && kind(other.id) === "initial")) add("initial-unique", `${node.id}: only one initial per region.`, node.id);
      }
      if (["final", "terminate"].includes(k) && outgoing.length) add("terminal-outgoing", `${node.id}: ${k} cannot have outgoing transitions.`, node.id);
      if (k === "fork" && (incoming.length !== 1 || outgoing.length < 2)) add("fork-degree", `${node.id}: fork requires one incoming and at least two outgoing transitions.`, node.id);
      if (k === "join" && (incoming.length < 2 || outgoing.length !== 1)) add("join-degree", `${node.id}: join requires at least two incoming and one outgoing transition.`, node.id);
      if (["history", "deep-history"].includes(k)) {
        for (const edge of outgoing) {
          const target = nodes.get(edge.to);
          const sameRegion = target?.parentId === node.parentId;
          const nestedRegion = !node.parentId || descendant(edge.to, node.parentId);
          if (!["state", "final"].includes(kind(edge.to) ?? "") || !(k === "history" ? sameRegion : sameRegion || nestedRegion)) add("history-target", `${node.id}: history default must target a state in its region${k === "deep-history" ? " or a descendant" : ""}.`, node.id, edge.id);
          if (edge.attributes?.guard !== void 0) add("history-guard", `${node.id}: history default cannot have a guard.`, node.id, edge.id);
        }
        if (outgoing.length > 1) add("history-default", `${node.id}: history permits at most one default transition.`, node.id);
        if (model.nodes.some((other) => other.id !== node.id && other.parentId === node.parentId && kind(other.id) === k)) add("history-unique", `${node.id}: duplicate history kind in region.`, node.id);
      }
    }
    for (const edge of model.connections) {
      const from = kind(edge.from), to = kind(edge.to);
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) add("unknown-vertex", "Unknown transition vertex.", void 0, edge.id);
      if (orthogonal(edge.from, edge.to)) add("cross-region", "A direct transition cannot cross orthogonal regions; use fork/join or exit the composite state.", void 0, edge.id);
      if (from === "region" || to === "region") add("region-endpoint", "Transitions connect vertices, not regions.", void 0, edge.id);
      if (from === "fork" && !["state", "final"].includes(to ?? "")) add("fork-target", "A fork segment must target a state.", void 0, edge.id);
      if (to === "join" && !["state", "final"].includes(from ?? "")) add("join-source", "A join segment must originate at a state.", void 0, edge.id);
      const attrs = edge.attributes ?? {};
      if (model.stateMachineKind === "protocol" && attrs.effect) add("protocol-effect", "Protocol transitions use pre/post conditions, not effects.", void 0, edge.id);
      if ((["initial", "history", "deep-history", "fork", "join", "choice", "junction", "entrypoint", "exitpoint"].includes(from ?? "") || to === "join") && attrs.trigger) add("pseudostate-trigger", "This transition segment cannot have a trigger.", void 0, edge.id);
      if ((["initial", "fork"].includes(from ?? "") || to === "join") && attrs.guard !== void 0) add("pseudostate-guard", "This transition segment cannot have a guard.", void 0, edge.id);
      if (attrs.transitionKind === "local" && (from === "entrypoint" ? false : from !== "state" || !descendant(edge.to, edge.from))) add("local-target", "A local transition requires a composite source and a descendant target.", void 0, edge.id);
    }
    return result;
  }

  // src/parser.ts
  function meaningfulLines(source) {
    return source.split(/\r?\n/).map((line, index) => {
      if (line.trim().startsWith("'")) return { text: "", number: index + 1 };
      let quoted = false;
      let opening = 0;
      let bracketDepth = 0;
      const bracketNames = /^\s*@(component|deployment|usecase)\b/.test(source);
      for (let column = 0; column < line.length; column++) {
        const char = line[column];
        if (quoted && char === "\\") {
          column++;
          continue;
        }
        if (char === '"') {
          quoted = !quoted;
          if (quoted) opening = column;
        }
        if (bracketNames && !quoted) {
          if (char === "[") bracketDepth++;
          if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
        }
        const protectedMember = source.trimStart().startsWith("@class") && /^\s*(?:(?:static|abstract)\s+)*$/.test(line.slice(0, column)) && /\w/.test(line[column + 1] ?? "");
        if (!quoted && bracketDepth === 0 && column > 0 && /\s/.test(line[column - 1]) && (char === "#" && !protectedMember && !(source.trimStart().startsWith("@class") && /^#(?:--|\.\.)>?\s/.test(line.slice(column))) || line.slice(column, column + 2) === "//")) {
          line = line.slice(0, column);
          break;
        }
      }
      if (quoted) throw new Error(`Line ${index + 1}, column ${opening + 1}: missing closing quote (").`);
      return { text: line.trim(), number: index + 1 };
    }).filter((line) => line.text);
  }
  function parseStateTransition(text) {
    let depth = 0;
    let parentheses = 0;
    let quote = "";
    let separator = -1;
    let guardStart = -1, guardEnd = -1;
    for (let i = 0; i < text.length; i++) {
      if (quote) {
        if (text[i] === "\\") {
          i++;
          continue;
        }
        if (text[i] === quote) quote = "";
        continue;
      }
      if (text[i] === '"' || text[i] === "'") {
        quote = text[i];
        continue;
      }
      if (text[i] === "(") parentheses++;
      if (text[i] === ")") parentheses = Math.max(0, parentheses - 1);
      if (text[i] === "[") {
        if (depth === 0 && parentheses === 0) guardStart = i;
        depth++;
      }
      if (text[i] === "]") {
        depth--;
        if (depth === 0 && parentheses === 0 && guardStart >= 0) guardEnd = i;
      }
      if (text[i] === "/" && depth === 0 && parentheses === 0) {
        separator = i;
        break;
      }
    }
    const head = (separator < 0 ? text : text.slice(0, separator)).trimEnd();
    const hasGuard = guardStart >= 0 && guardEnd === head.length - 1;
    const trigger = (hasGuard ? head.slice(0, guardStart) : head).trim();
    const triggerKind = /^(after|at)\s*\(/.test(trigger) ? "time" : /^when\s*\(/.test(trigger) ? "change" : trigger ? "event" : "completion";
    return { trigger, triggerKind, ...hasGuard ? { guard: head.slice(guardStart + 1, guardEnd).trim() } : {}, ...separator >= 0 ? { effect: text.slice(separator + 1).trim() } : {} };
  }
  function header(source) {
    const first = meaningfulLines(source)[0]?.text;
    if (!first?.startsWith("@")) throw new Error("Finch.js source must begin with a diagram directive such as @deployment or @sequence.");
    return first.slice(1).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  }
  function unquote2(value, fallback) {
    if (!value) return fallback;
    return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1).replace(/\\"/g, '"') : value;
  }
  function attributesFrom(value) {
    if (!value) return {};
    const attributes = {};
    for (const match of value.matchAll(/([\w-]+)\s*=\s*("(?:\\.|[^"])*"|[^\s\]]+)/g)) {
      const key = match[1];
      if (key) attributes[key] = unquote2(match[2], "");
    }
    for (const key of ["fromPort", "toPort"]) {
      const port = attributes[key];
      if (port !== void 0 && !["left", "right", "top", "bottom"].includes(port.toLowerCase())) {
        throw new Error(`Invalid ${key} "${port}". Expected left, right, top, or bottom.`);
      }
    }
    return attributes;
  }
  var componentRelationPattern = /^("(?:\\.|[^"\\])*"|\[[^\]\n]+\]|:[^:\n]+:|\([^()\n]+\)|[\w.-]+?(?:::(?:[\w.-]+|"(?:\\.|[^"\\])*"))?)\s*(<?-\[(?:bold|dashed|dotted|plain|#[\w]+|thickness=[\w.+-]+)(?:\s*,\s*(?:bold|dashed|dotted|plain|#[\w]+|thickness=[\w.+-]+))*\]->?|<\.(?:left|right|up|down|le|ri|do|[lrud])\.|\.(?:left|right|up|down|le|ri|do|[lrud])\.>|\.(?:left|right|up|down|le|ri|do|[lrud])\.(?=[\s\["])|<-?(?:left|right|up|down|le|ri|do|[lrud])-?|-(?:left|right|up|down|le|ri|do|[lrud])->|-(?:left|right|up|down|le|ri|do|[lrud])-(?=[\s\["])|(?<=\s)[o*](?:-{1,2}|\.{1,2})>?|<?(?:-{1,2}|\.{1,2})[o*](?=\s)|<\|\.{1,2}|\.{1,2}\|>|<\|-{1,2}|-{1,2}\|>|<={2,}>?|={2,}>?|<-{1,2}>|<-{1,2}|<\.\.|-{1,2}>|\.\.>|--|(?<=[\s\]"])-(?=[\s\["])|\.\.)\s*("(?:\\.|[^"\\])*"|\[[^\]\n]+\]|:[^:\n]+:|\([^()\n]+\)|[\w.-]+?(?:::(?:[\w.-]+|"(?:\\.|[^"\\])*"))?)(?:\s*:\s*(.+))?$/;
  function componentEdgeOptions(text) {
    const match = text.match(/\s+\[((?:"(?:\\.|[^"\\])*"|[^"\]])+)\]$/);
    return match && /[\w-]+\s*=/.test(match[1]) && componentRelationPattern.test(text.slice(0, match.index)) ? match : null;
  }
  function withAnnotations(source, parse, declarationOwners) {
    const notes = [];
    let annotationPage = 0;
    let memberBody = false;
    let lastElement;
    let relationCount = 0;
    const details = [];
    const associations = [];
    const body = source.split(/\r?\n/).filter((line) => {
      if (/^\s*@(component|deployment|usecase)\b/m.test(source)) line = meaningfulLines("@component\n" + line)[1]?.text ?? "";
      const code = line.replace(/"(?:\\.|[^"\\])*"/g, "").replace(/\s+(?:#|\/\/).*$/, "").trim();
      if (memberBody) {
        if (code === "}") memberBody = false;
        return true;
      }
      if (/^\s*@class\b/m.test(source) && new RegExp(String.raw`^[\w.-]+(?:::~?[\w$]+(?:\([^)]*\))?)?\s+(?:"[^"]*"\s+)?(?:${classRelationOperators})\s+`).test(line.trim())) relationCount++;
      if (/^\s*@(component|deployment|usecase)\b/m.test(source)) {
        const trimmed = line.trim(), options = componentEdgeOptions(trimmed);
        const relationText = options ? trimmed.slice(0, options.index) : trimmed;
        if (componentRelationPattern.test(relationText)) relationCount++;
      }
      const linkNote = line.trim().match(/^(note|rnote|hnote)\s+(?:(left|right|top|bottom)\s+)?on\s+link\s*:\s*(.+)$/);
      if (linkNote) {
        if (!relationCount) throw new Error("A link note requires a preceding relation.");
        const label = linkNote[3].startsWith('"') ? unquote2(linkNote[3], "") : linkNote[3];
        notes.push({ target: "", edgeIndex: relationCount - 1, label, page: annotationPage, kind: linkNote[1], ...linkNote[2] ? { side: linkNote[2] } : {} });
        return false;
      }
      const declared = code.match(/^(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|diamond|circle)\s+([\w.-]+)(?:\s*\{|\s*$)/);
      if (declared) lastElement = declared[1];
      if (/^\s*@(component|deployment|usecase)\b/m.test(source)) {
        const normalized = normalizeDeploymentAlias(componentDecorations(line.trim()).text);
        const component = normalized.match(/^(?:node|server|database|container|actor\/?|rectangle|rounded|system|component|external|interface|usecase\/?|device|execution|artifact|file|card|hexagon|label|circle|boundary|control|entity|collections|stack|action|storage|process|agent|person|package|port|portin|portout|provided|required|queue|cloud|folder|frame)\s+([\w.-]+)(?:\s|$)/);
        if (component) lastElement = declarationOwners?.get(component[1]) ?? component[1];
      }
      const named = line.trim().match(/^(?:note|rnote|hnote)\s+"(?:\\.|[^"\\])*"\s+as\s+([\w.-]+)$/);
      if (named) lastElement = named[1];
      const previous = line.trim().match(/^(note|rnote|hnote)\s+(left|right|top|bottom)\s*:\s*(.+)$/);
      if (previous) {
        if (!lastElement) throw new Error("A shorthand note requires a preceding element.");
        const label = previous[3].startsWith('"') ? unquote2(previous[3], "") : previous[3];
        notes.push({ target: lastElement, label, page: annotationPage, kind: previous[1], side: previous[2] });
        return false;
      }
      if (/^(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(code)) {
        memberBody = true;
        return true;
      }
      if (/^newpage(?:\s+"(?:\\.|[^"\\])*")?$/.test(line.trim())) annotationPage++;
      const detail = line.trim().match(/^(visibility|stereotype|entry|exit|do|internal|defer|invariant)\s+([\w.-]+)\s+"((?:\\.|[^"])*)"$/);
      if (detail) {
        details.push({ kind: detail[1], target: detail[2], text: detail[3] });
        return false;
      }
      const association = line.trim().match(/^association\s+([\w.-]+)\s+([\w.-]+)(?:->([\w.-]+))?$/);
      if (association) {
        associations.push({ id: association[1], from: association[2], to: association[3] });
        return false;
      }
      const bracketNote = /^\s*@(component|deployment|usecase)\b/m.test(source) && line.trim().match(/^(note|rnote|hnote|constraint)(?:\s+(left|right|top|bottom)\s+of)?\s+(\[[^\]\n]+\]|"(?:\\.|[^"\\])*"|[\w.-]+)\s*(?::\s*(.+)|\s+("(?:\\.|[^"\\])*"))$/);
      if (bracketNote) {
        const raw = bracketNote[4] ?? bracketNote[5];
        const label = raw.startsWith('"') ? unquote2(raw, "") : raw;
        notes.push({ target: componentNameId(bracketNote[3].startsWith("[") ? bracketNote[3].slice(1, -1) : unquote2(bracketNote[3], "")), label: bracketNote[1] === "constraint" ? `{${label}}` : label, kind: bracketNote[1], page: annotationPage, ...bracketNote[2] ? { side: bracketNote[2] } : {} });
        return false;
      }
      const side = line.trim().match(/^(?:note|rnote|hnote|constraint)\s+(left|right|top|bottom)\s+of\s+/)?.[1];
      const match = line.trim().replace(/^(note|rnote|hnote|constraint)\s+(?:left|right|top|bottom)\s+of\s+/, "$1 ").match(/^(note|rnote|hnote|constraint)\s+([\w.-]+(?:::[^"]+?|->[\w.-]+)?)\s+"((?:\\.|[^"])*)"$/);
      if (!match) return true;
      notes.push({ target: match[2], page: annotationPage, kind: match[1], ...side ? { side } : {}, label: match[1] === "constraint" ? `{${match[3]}}` : match[3] });
      return false;
    }).join("\n");
    if (!notes.length && !details.length && !associations.length) return void 0;
    const model = parse(body);
    for (const detail of details) {
      const node = model.nodes.find((node2) => node2.id === detail.target);
      if (!node) throw new Error(`Unknown detail target "${detail.target}".`);
      if (detail.kind === "visibility") {
        node.attributes.visibility = detail.text;
        continue;
      }
      if (detail.kind === "stereotype") {
        node.attributes.stereotype = detail.text;
        continue;
      }
      if (model.kind !== "state" || node.attributes.stateKind !== "state") throw new Error(`${detail.kind} requires a state.`);
      if (detail.kind === "defer" || detail.kind === "invariant") {
        node.attributes[detail.kind] = detail.text;
        const text = detail.kind === "defer" ? `${detail.text} / defer` : `{${detail.text}}`;
        const body2 = JSON.parse(node.attributes.stateBody ?? "[]");
        body2.push(text);
        node.attributes.stateBody = JSON.stringify(body2);
        if (node.shape !== "container") {
          node.shape = "uml-state";
          node.attributes.kind = "class";
          node.attributes.members = JSON.stringify(body2.map((text2) => ({ text: text2, kind: "attribute" })));
        }
        continue;
      }
      const behaviors = JSON.parse(node.attributes.stateBehaviors ?? "[]");
      behaviors.push({ kind: detail.kind, ...detail.kind === "internal" ? parseStateTransition(detail.text) : { effect: detail.text } });
      node.attributes.stateBehaviors = JSON.stringify(behaviors);
      const members = JSON.parse(node.attributes.stateBody ?? "[]");
      members.push(detail.kind === "internal" ? detail.text : `${detail.kind} / ${detail.text}`);
      node.attributes.stateBody = JSON.stringify(members);
      if (node.shape !== "container") {
        node.shape = "uml-state";
        node.attributes.kind = "class";
        node.attributes.members = JSON.stringify(members.map((text) => ({ text, kind: "attribute" })));
      }
    }
    for (const association of associations) {
      const node = model.nodes.find((node2) => node2.id === association.id);
      const matches = model.connections.filter((edge2) => association.to ? edge2.from === association.from && edge2.to === association.to : edge2.id === association.from);
      if (matches.length > 1) throw new Error("Ambiguous association: assign [id=name] and reference that ID.");
      const edge = matches[0];
      if (model.kind !== "class" || node?.shape !== "uml-class" || !edge) throw new Error(`Invalid association class "${association.id}".`);
      node.attributes.associationClass = "true";
      node.attributes.associationEdge = edge.id;
      node.attributes.annotationTarget = edge.id;
      node.attributes.annotationKind = "edge";
    }
    for (const [index, note] of notes.entries()) {
      const [owner, member] = note.target.split("::");
      const [from, to] = owner.split("->");
      let memberIndex;
      if (member) {
        const node = model.nodes.find((n) => n.id === owner);
        const members = JSON.parse(node?.attributes.members ?? "[]");
        memberIndex = resolveMemberIndex(members, member);
      }
      const targetNode = note.edgeIndex === void 0 && !to ? model.nodes.find((node) => node.id === from) : void 0;
      const matches = note.edgeIndex !== void 0 ? model.connections.slice(note.edgeIndex, note.edgeIndex + 1) : to ? model.connections.filter((edge) => edge.from === from && edge.to === to) : targetNode ? [] : model.connections.filter((edge) => edge.id === from);
      if (matches.length > 1) throw new Error(`Ambiguous annotation target "${note.target}"; assign a message ID and reference it directly.`);
      const targetEdge = matches[0];
      const target = targetNode?.id ?? targetEdge?.id;
      if (!target) throw new Error(`Unknown annotation target "${note.target}".`);
      let id = `annotation-${index + 1}`;
      while (model.nodes.some((node) => node.id === id)) id += "-note";
      model.nodes.push({ id, label: note.label.replace(/\\"/g, '"'), shape: "uml-artifact", attributes: { ...model.kind === "sequence" ? { sequencePage: String(note.page) } : {}, ...["rnote", "hnote"].includes(note.kind) ? { noteShape: note.kind } : {}, ...note.side ? { annotationSide: note.side } : {}, annotationTarget: target, annotationKind: member ? "member" : targetEdge ? "edge" : "node", ...memberIndex === void 0 ? {} : { annotationMember: String(memberIndex) }, tone: "amber" } });
    }
    return { ...model, source };
  }
  function assertUnique(nodes, node, line) {
    if (nodes.some((existing) => existing.id === node.id)) throw new Error(`Line ${line}: duplicate node id "${node.id}".`);
  }
  function connectionId(from, to, index) {
    return `${from}-${to}-${index + 1}`;
  }
  function getDiagramKind(source) {
    return header(source);
  }
  function parseDeployment(source) {
    return parseDeploymentCore(source, /* @__PURE__ */ new Map(), /* @__PURE__ */ new Map());
  }
  function parseDeploymentCore(source, jsonEntries, jsonOwners) {
    const parse = (text) => parseDeploymentCore(text, jsonEntries, jsonOwners);
    const decorated = withDiagramText(source, parse);
    if (decorated) return decorated;
    const json = expandObjectJson(source.replace(/^\s*allowmixing\s*$/gm, ""));
    if (json.maps.size) {
      const expanded = json.source.split(/\r?\n/).map((line) => {
        const declaration = line.match(/^object\s+([\w.-]+)\s+/);
        return declaration && json.maps.has(declaration[1]) ? line.replace(/^object\s+/, "component ") : line;
      }).join("\n");
      const model2 = parseDeploymentCore(expanded, new Map([...jsonEntries, ...json.maps]), new Map([...jsonOwners, ...json.owners]));
      return { ...model2, source };
    }
    if (json.source !== source) return { ...parse(json.source), source };
    const annotated = withAnnotations(source, parse, jsonOwners);
    if (annotated) return annotated;
    let anonymousGroup = 0;
    const lines = meaningfulLines(source).flatMap((line) => {
      const decoration = componentDecorations(line.text);
      let text = normalizeDeploymentAlias(decoration.text);
      const anonymous = text.match(/^(package|folder|frame|node|database|cloud|container|system|rectangle|queue|file|artifact|card|hexagon|stack|action|storage|process)\s*(\[[^\]]*\])?\s*(\{\s*\}?)$/);
      if (anonymous) {
        let id;
        do {
          id = `__anonymous_group_${++anonymousGroup}`;
        } while (source.includes(id));
        text = `${anonymous[1]} ${id} "" ${anonymous[2] ?? ""} ${anonymous[3]}`;
      }
      const decoratedLine = { ...line, decoration };
      return /\{\s*\}$/.test(text) ? [{ ...decoratedLine, text: text.replace(/\{\s*\}$/, "{") }, { ...decoratedLine, text: "}" }] : [{ ...decoratedLine, text }];
    });
    const nodes = [];
    const connections = [];
    const containerStack = [];
    const displayRules = [];
    const declarationKinds = /* @__PURE__ */ new Map();
    const componentTags = [];
    let componentStyle;
    let deploymentDirection = "right";
    const implicitComponents = /* @__PURE__ */ new Map();
    const compactKinds = /* @__PURE__ */ new Map();
    for (const line of lines.slice(1)) {
      if (line.text === "}") {
        if (!containerStack.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        continue;
      }
      const tag = line.text.match(/^tag\s+([\w.-]+)\s+([\w.-]+(?:\s+[\w.-]+)*)$/);
      if (tag) {
        componentTags.push({ id: tag[1], values: tag[2].split(/\s+/) });
        continue;
      }
      if (/^(hide|show|remove|restore)\s+/.test(line.text)) {
        displayRules.push(line.text);
        continue;
      }
      const style = line.text.match(/^(?:skinparam\s+)?componentStyle\s+(\S+)$/);
      if (style) {
        if (!["uml1", "uml2", "rectangle"].includes(style[1])) throw new Error(`Unknown component style "${style[1]}".`);
        componentStyle = style[1];
        continue;
      }
      const orientation = line.text.match(/^(left to right|top to bottom) direction$/);
      if (orientation) {
        deploymentDirection = orientation[1] === "left to right" ? "right" : "down";
        continue;
      }
      const standaloneNote = line.text.match(/^(note|rnote|hnote)\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+)$/);
      if (standaloneNote) {
        const node = { id: standaloneNote[3], label: unquote2(standaloneNote[2], ""), shape: "uml-artifact", attributes: { standaloneNote: "true", noteShape: standaloneNote[1], tone: "amber" }, ...containerStack.length ? { parentId: containerStack[containerStack.length - 1] } : {} };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        continue;
      }
      const edgeOptions = componentEdgeOptions(line.text);
      const edgeText = edgeOptions ? line.text.slice(0, edgeOptions.index) : line.text;
      const relation = edgeText.match(componentRelationPattern);
      if (relation) {
        const resolveComponent = (value) => {
          if (value.startsWith(":") || value.startsWith("(")) {
            const label2 = value.slice(1, -1), id2 = componentNameId(label2);
            const shape = value.startsWith(":") ? "actor" : "usecase";
            const previous2 = compactKinds.get(id2);
            if (previous2 && previous2 !== shape) throw new Error(`Conflicting endpoint kinds for "${label2}": ${previous2} and ${shape}. Use distinct IDs.`);
            compactKinds.set(id2, shape);
            const existing2 = implicitComponents.get(id2);
            if (existing2) existing2.shape = shape;
            else implicitComponents.set(id2, { id: id2, label: label2, shape, attributes: {}, ...containerStack.length ? { parentId: containerStack[containerStack.length - 1] } : {} });
            return id2;
          }
          if (!value.startsWith('"') && !value.startsWith("[")) value = value.split("::")[0];
          if (!value.startsWith("[")) {
            const label2 = unquote2(value, ""), id2 = componentNameId(label2);
            if (/^\s*@component\b/.test(source) && !implicitComponents.has(id2)) {
              implicitComponents.set(id2, { id: id2, label: label2, shape: "uml-provided-interface", attributes: {}, ...containerStack.length ? { parentId: containerStack[containerStack.length - 1] } : {} });
            }
            return id2;
          }
          const label = value.slice(1, -1), id = componentNameId(label);
          const previous = compactKinds.get(id);
          if (previous && previous !== "component") throw new Error(`Conflicting endpoint kinds for "${label}": ${previous} and component. Use distinct IDs.`);
          compactKinds.set(id, "component");
          const existing = implicitComponents.get(id);
          if (existing) existing.shape = "component";
          else implicitComponents.set(id, { id, label, shape: "component", attributes: {}, ...containerStack.length ? { parentId: containerStack[containerStack.length - 1] } : {} });
          return id;
        };
        const rawArrow = relation[2] ?? "->";
        const bracket = rawArrow.match(/\[([^\]]+)\]/)?.[1];
        const bracketTokens = bracket?.split(",").map((value) => value.trim()) ?? [];
        const bracketStyle = bracketTokens.find((value) => ["bold", "dashed", "dotted", "plain"].includes(value));
        const lineColorToken = bracketTokens.find((value) => value.startsWith("#"));
        const lineColor = lineColorToken && (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(lineColorToken) ? lineColorToken : lineColorToken.slice(1));
        const thickness = bracketTokens.find((value) => value.startsWith("thickness="))?.slice(10);
        if (thickness !== void 0 && (!Number.isFinite(Number(thickness)) || Number(thickness) <= 0)) throw new Error("Arrow thickness must be a positive finite number.");
        const arrow = rawArrow.replace(/\[[^\]]+\]/, "");
        const bidirectional = arrow.startsWith("<") && arrow.endsWith(">");
        const reversed = !bidirectional && (arrow.startsWith("<") || /[o*]$/.test(arrow));
        const from = resolveComponent(relation[reversed ? 3 : 1] ?? "");
        const to = resolveComponent(relation[reversed ? 1 : 3] ?? "");
        const namedRows = {};
        for (const [endpoint, raw, id] of [["from", relation[reversed ? 3 : 1], from], ["to", relation[reversed ? 1 : 3], to]]) {
          const memberToken = raw.match(/^[\w.-]+::([\w.-]+|"(?:\\.|[^"\\])*")$/)?.[1];
          const member = memberToken?.startsWith('"') ? JSON.parse(memberToken) : memberToken;
          if (member === void 0) continue;
          const entries = jsonEntries.get(id);
          const index = entries?.findIndex((entry) => entry.key === (/[\r\n\t]/.test(member) ? JSON.stringify(member) : member)) ?? -1;
          if (index < 0) throw new Error(`Unknown JSON key "${member}" on "${id}".`);
          namedRows[`${endpoint}MapRow`] = String(index);
        }
        const hint = arrow.match(/left|right|up|down|le|ri|do|[lrud]/)?.[0];
        const direction = hint ? { l: "left", r: "right", u: "up", d: "down" }[hint[0]] : void 0;
        const ownership = arrow.includes("*") ? "composition" : arrow.includes("o") && !/down|do/.test(arrow) ? "aggregation" : void 0;
        const inheritance = arrow.includes("|");
        const realization = inheritance && arrow.includes(".");
        const undirected = !arrow.includes("<") && !arrow.includes(">");
        const explicitAttributes = attributesFrom(edgeOptions?.[1]);
        if (explicitAttributes.thickness !== void 0 && (!Number.isFinite(Number(explicitAttributes.thickness)) || Number(explicitAttributes.thickness) <= 0)) throw new Error("Arrow thickness must be a positive finite number.");
        const relationKind = ownership ?? (inheritance ? realization ? "realization" : "inheritance" : explicitAttributes.relation);
        const semanticDashed = ownership ? arrow.includes(".") : relationKind === "realization" || relationKind === "dependency" ? true : ["inheritance", "aggregation", "composition", "association"].includes(relationKind ?? "") ? false : void 0;
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[4]?.trim() ? { label: unquote2(relation[4].trim(), "") } : {},
          dashed: bracket ? ["dashed", "dotted"].includes(bracketStyle ?? "") : semanticDashed ?? (arrow.includes(".") || !undirected && arrow.includes("--")),
          order: connections.length,
          ...edgeOptions || bracket || arrow.includes("=") || undirected || bidirectional || ownership || inheritance || direction || Object.keys(namedRows).length ? { attributes: { ...explicitAttributes, ...lineColor ? { lineColor } : {}, ...thickness !== void 0 ? { thickness } : {}, ...bracketStyle ? { lineStyle: bracketStyle } : {}, ...arrow.includes("=") ? { lineStyle: "bold" } : {}, ...namedRows, ...bidirectional ? { bidirectional: "true" } : {}, ...direction ? { layoutDirection: direction, layoutFrom: resolveComponent(relation[1]), layoutTo: resolveComponent(relation[3]) } : {}, ...ownership ? { relation: ownership, ...!undirected ? { navigable: "true" } : {} } : inheritance ? { relation: realization ? "realization" : "inheritance" } : explicitAttributes.relation ? {} : undirected ? { relation: "association" } : {} } } : {}
        });
        continue;
      }
      const containment = line.text.match(/^([\w.-]+)\s+(?:in|inside)\s+([\w.-]+)$/);
      if (containment) {
        const node = nodes.find((candidate) => candidate.id === containment[1]);
        if (!node) throw new Error(`Line ${line.number}: unknown node "${containment[1]}".`);
        node.parentId = containment[2] ?? "";
        continue;
      }
      const contains = line.text.match(/^([\w.-]+)\s+contains\s+(.+)$/);
      if (contains) {
        for (const id of (contains[2] ?? "").split(/[\s,]+/).filter(Boolean)) {
          const node = nodes.find((candidate) => candidate.id === id);
          if (!node) throw new Error(`Line ${line.number}: unknown node "${id}".`);
          node.parentId = contains[1] ?? "";
        }
        continue;
      }
      const declaration = line.text.match(/^(node|server|database|container|actor\/?|rectangle|rounded|system|component|external|interface|usecase\/?|device|execution|artifact|file|card|hexagon|label|circle|boundary|control|entity|collections|stack|action|storage|process|agent|person|package|port|portin|portout|provided|required|queue|cloud|folder|frame)\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\[\{]+))?(?:\s*\[([^\]]+)\])?\s*(\{)?$/);
      if (declaration) {
        const keyword = (declaration[1] ?? "node").replace(/\/$/, "");
        const id = declaration[2] ?? "";
        const attributes = attributesFrom(declaration[4]);
        if (["usecase/", "actor/"].includes(declaration[1])) attributes.business = "true";
        declarationKinds.set(id, jsonEntries.has(id) ? "json" : keyword);
        if (jsonEntries.has(id)) {
          attributes.mapEntries = JSON.stringify(jsonEntries.get(id));
          attributes.jsonRoot = jsonOwners.get(id);
        }
        if (line.decoration.tags.length) componentTags.push({ id, values: line.decoration.tags });
        if (line.decoration.stereotype) {
          attributes.stereotype = line.decoration.stereotype;
          attributes.stereotypes = JSON.stringify(line.decoration.stereotypes);
        }
        const defaultShape = {
          node: "uml-node",
          action: "rounded",
          agent: "rectangle",
          system: "container",
          component: "component",
          external: "external",
          interface: "uml-provided-interface",
          usecase: "usecase",
          device: "uml-device",
          execution: "uml-execution",
          artifact: "uml-artifact",
          file: "uml-file",
          boundary: "sequence-boundary",
          control: "sequence-control",
          entity: "sequence-entity",
          collections: "collections",
          package: "container",
          folder: "container",
          frame: "container",
          port: "uml-port",
          portin: "uml-port",
          portout: "uml-port",
          provided: "uml-provided-interface",
          required: "uml-required-interface",
          queue: "queue",
          cloud: "cloud"
        };
        if (keyword === "folder" || keyword === "frame") attributes.containerStyle = keyword;
        const nodeBlock = ["node", "database", "cloud", "rectangle", "component", "queue", "file", "artifact", "card", "hexagon", "stack", "action", "storage", "process"].includes(keyword) && Boolean(declaration[5]);
        if (nodeBlock) attributes.containerStyle = keyword;
        if (["artifact", "device"].includes(keyword) && !attributes.stereotype) attributes.stereotype = keyword;
        const shape = jsonEntries.has(id) ? "uml-map" : attributes.shape ?? (nodeBlock ? "container" : defaultShape[keyword] ?? keyword);
        delete attributes.shape;
        const activeContainer = containerStack[containerStack.length - 1];
        if (["port", "portin", "portout"].includes(keyword) && activeContainer) {
          attributes.boundaryPort = "true";
          attributes.portDirection = keyword === "portout" ? "out" : keyword === "portin" ? "in" : "auto";
        }
        const node = {
          id,
          label: unquote2(declaration[3], id),
          shape,
          ...activeContainer ? { parentId: activeContainer } : {},
          attributes
        };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        if (declaration[5]) {
          if (shape !== "container") throw new Error(`Line ${line.number}: only containers can open a block.`);
          containerStack.push(id);
        }
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (containerStack.length) throw new Error(`Container "${containerStack[containerStack.length - 1]}" is missing a closing brace.`);
    for (const [id, kind] of compactKinds) {
      const declared = declarationKinds.get(id);
      if (declared && declared !== kind) throw new Error(`Conflicting endpoint kinds for "${id}": ${declared} and ${kind}. Use distinct IDs.`);
    }
    for (const node of implicitComponents.values()) if (!nodes.some((existing) => existing.id === node.id)) nodes.push(node);
    if (componentStyle) {
      for (const node of nodes) if ((node.shape === "component" || node.attributes.containerStyle === "component") && node.attributes.componentStyle === void 0) node.attributes.componentStyle = componentStyle;
    }
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Connection references unknown node "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Connection references unknown node "${edge.to}".`);
      for (const endpoint of ["from", "to"]) {
        const row = edge.attributes?.[`${endpoint}MapRow`];
        if (row === void 0) continue;
        const node = nodes.find((node2) => node2.id === edge[endpoint]);
        const entries = JSON.parse(node.attributes.mapEntries ?? "[]");
        if (node.shape !== "uml-map" || !/^\d+$/.test(row) || !Number.isSafeInteger(Number(row)) || Number(row) >= entries.length) {
          throw new Error(`Invalid ${endpoint}MapRow "${row}" for "${node.id}"; expected an existing JSON row index.`);
        }
      }
    }
    for (const node of nodes) if (node.parentId && !ids.has(node.parentId)) throw new Error(`Node "${node.id}" references unknown container "${node.parentId}".`);
    for (const node of nodes) if (node.attributes.boundaryPort === "true" && deploymentDirection === "down") node.attributes.portLabelSide = "left";
    const parents = new Map(nodes.map((node) => [node.id, node]));
    for (const node of nodes) {
      if (node.parentId && parents.get(node.parentId).shape !== "container") throw new Error(`Node "${node.id}" requires a container parent; "${node.parentId}" is not a group.`);
      const seen = /* @__PURE__ */ new Set();
      let current = node;
      while (current) {
        if (seen.has(current.id)) throw new Error(`Containment cycle involving "${current.id}".`);
        seen.add(current.id);
        current = current.parentId ? parents.get(current.parentId) : void 0;
      }
    }
    const model = { kind: "deployment", nodes, connections, groups: [], source, direction: deploymentDirection };
    for (const node of implicitComponents.values()) if (!declarationKinds.has(node.id)) declarationKinds.set(node.id, ["component", "actor", "usecase"].includes(node.shape) ? node.shape : "interface");
    for (const tag of componentTags) {
      const node = nodes.find((node2) => node2.id === tag.id);
      if (!node) throw new Error(`Unknown tag target ${tag.id}.`);
      node.attributes.tags = JSON.stringify([.../* @__PURE__ */ new Set([...JSON.parse(node.attributes.tags ?? "[]"), ...tag.values])]);
    }
    applyComponentDisplay(model, displayRules, declarationKinds);
    return model;
  }
  function parseSequence(source) {
    const decorated = withDiagramText(source, parseSequence);
    if (decorated) return decorated;
    const pageLines = meaningfulLines(source);
    if (pageLines.some((line) => line.text === "ignore newpage")) {
      const ignored = new Set(pageLines.filter((line) => line.text === "ignore newpage" || /^newpage(?:\s+"(?:\\.|[^"\\])*")?$/.test(line.text)).map((line) => line.number));
      const combined = source.split(/\r?\n/).map((line, index) => ignored.has(index + 1) ? "" : line).join("\n");
      return { ...parseSequence(combined), source };
    }
    const annotated = withAnnotations(source, parseSequence);
    if (annotated) return annotated;
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    const groups = [];
    const openGroups = [];
    const activationDepth = /* @__PURE__ */ new Map();
    const destroyed = /* @__PURE__ */ new Set();
    const used = /* @__PURE__ */ new Set();
    const createdIds = /* @__PURE__ */ new Set();
    const lifeChanges = /* @__PURE__ */ new Map();
    const snapshot = () => ({ depth: new Map(activationDepth), dead: new Set(destroyed), used: new Set(used), changes: new Map(lifeChanges) });
    const frames = [];
    const boundaries = [];
    let serial = 0;
    const timeAnchors = /* @__PURE__ */ new Map();
    const durations = [];
    let numbering;
    let pausedNumbering;
    let footbox = false;
    const pageBreaks = [];
    const diagramText = {};
    const restore = (state) => {
      activationDepth.clear();
      state.depth.forEach((v, k) => activationDepth.set(k, v));
      destroyed.clear();
      state.dead.forEach((id) => destroyed.add(id));
      used.clear();
      state.used.forEach((id) => used.add(id));
      lifeChanges.clear();
      state.changes.forEach((v, k) => lifeChanges.set(k, v));
    };
    const ensureParticipant = (id, label = id, shape = "rectangle", line = 0) => {
      const existing = nodes.find((node2) => node2.id === id);
      if (existing) return existing;
      const node = { id, label, shape, attributes: {} };
      assertUnique(nodes, node, line);
      nodes.push(node);
      return node;
    };
    for (const line of lines.slice(1)) {
      serial++;
      const page = line.text.match(/^newpage(?:\s+("(?:\\.|[^"\\])*"))?$/);
      if (page) {
        pageBreaks.push({ at: connections.length, serial, ...page[1] ? { title: JSON.parse(page[1]) } : {} });
        continue;
      }
      const decoration = line.text.match(/^(title|header|footer|legend)\s+("(?:\\.|[^"\\])*")$/);
      if (decoration) {
        diagramText[decoration[1]] = JSON.parse(decoration[2]);
        continue;
      }
      const foot = line.text.match(/^(show|hide) footbox$/);
      if (foot) {
        footbox = foot[1] === "show";
        continue;
      }
      const anchor = line.text.match(/^anchor\s+([\w.-]+)(?:\s+(send|receive))?$/);
      if (anchor) {
        const previous = connections[connections.length - 1];
        if (!previous || ["ref", "delay", "divider", "note"].includes(previous.attributes?.messageKind ?? "")) throw new Error("A time anchor must follow a message.");
        if (timeAnchors.has(anchor[1])) throw new Error(`Duplicate time anchor "${anchor[1]}".`);
        timeAnchors.set(anchor[1], { edge: previous, endpoint: anchor[2] === "receive" ? "receive" : "send" });
        continue;
      }
      const duration = line.text.match(/^duration\s+([\w.-]+)\s+([\w.-]+)\s+"([^"\n]+)"$/);
      if (duration) {
        durations.push({ from: duration[1], to: duration[2], label: duration[3] });
        continue;
      }
      const increment = line.text.match(/^autonumber\s+inc\s+([A-Z])$/);
      if (increment) {
        if (!numbering) throw new Error("Autonumber inc requires active numbering.");
        const values = [...numbering.prefix ?? [], numbering.value];
        const index = increment[1].charCodeAt(0) - 65;
        if (index >= values.length) throw new Error("Autonumber level is out of range.");
        values[index]++;
        if (!Number.isSafeInteger(values[index])) throw new Error("Autonumber overflow.");
        for (let i = index + 1; i < values.length; i++) values[i] = 1;
        numbering.value = values.pop();
        numbering.prefix = values;
        continue;
      }
      const number2 = line.text.match(/^autonumber(?:\s+(stop|resume|\d+(?:[.;,:]\d+)*))?(?:\s+(\d+))?(?:\s+"([^"]*)")?$/);
      if (number2) {
        const format = number2[3];
        if (format !== void 0 && !/\{n(?::0?[1-9]\d?)?\}/.test(format)) decimalSequenceNumber(1, format);
        if (number2[1] === "stop" && (format !== void 0 || number2[2] !== void 0)) throw new Error("Autonumber stop does not accept arguments.");
        if (number2[1] === "stop") {
          pausedNumbering = numbering ?? pausedNumbering;
          numbering = void 0;
        } else if (number2[1] === "resume") {
          numbering = numbering ?? pausedNumbering ?? { value: 1, step: 1 };
          if (number2[2] !== void 0) {
            const step = Number(number2[2]);
            if (!Number.isSafeInteger(step) || step <= 0) throw new Error("Invalid autonumber step.");
            numbering.step = step;
          }
        } else {
          const raw = number2[1] ?? "1";
          const values = raw.split(/[.;,:]/).map(Number);
          const step = Number(number2[2] ?? 1);
          if (values.some((value) => !Number.isSafeInteger(value)) || !Number.isSafeInteger(step) || step <= 0) throw new Error("Invalid autonumber.");
          numbering = { value: values.pop(), step, prefix: values, separators: raw.match(/[.;,:]/g) ?? [] };
        }
        if (numbering && format !== void 0) numbering.format = format;
        continue;
      }
      const across = line.text.match(/^(?:note|rnote|hnote)\s+across\s*:\s*(.+)$/);
      const spanningNote = line.text.match(/^(?:note|rnote|hnote)\s+over\s+([\w.-]+(?:\s*,\s*[\w.-]+)*)\s*:\s*(.+)$/);
      const reference = line.text.match(/^ref\s+(?:over\s+)?([\w.,-]+)\s*:\s*(.+)$/);
      const delay = line.text.match(/^delay\s+(.+)$/);
      const divider = line.text.match(/^divider\s+(.+)$/) ?? line.text.match(/^==\s*(.+?)\s*==$/);
      if (across || spanningNote || reference || delay || divider) {
        const ids = spanningNote ?? reference ? (spanningNote ?? reference)[1].split(",").map((id) => id.trim()) : nodes.map((n) => n.id);
        if (!ids.length && !across) throw new Error("Declare participants before delay or divider.");
        for (const id of ids) {
          if (!divider && !across && destroyed.has(id)) throw new Error("Fragment uses a destroyed participant.");
          ensureParticipant(id);
        }
        connections.push({ id: across ? `across-${connections.length + 1}` : connectionId(ids[0], ids[ids.length - 1], connections.length), from: ids[0] ?? "", to: ids[ids.length - 1] ?? "", order: connections.length, dashed: false, attributes: { ...across ? { noteAcross: "true" } : {}, ...spanningNote || across ? { noteShape: line.text.split(/\s+/)[0] } : {}, messageKind: spanningNote || across ? "note" : reference ? "ref" : divider ? "divider" : "delay", fragmentLabel: unquote2(across?.[1] ?? spanningNote?.[2] ?? reference?.[2] ?? delay?.[1] ?? divider?.[1], ""), participants: ids.join(",") } });
        continue;
      }
      const control = line.text.match(/^(activate|deactivate|create|destroy)\s+([\w.-]+)(?:\s+"([^"]+)")?$/);
      if (control) {
        const [, op, id, label] = control;
        const node = ensureParticipant(id, label ?? id);
        if (destroyed.has(id)) throw new Error(`Line ${line.number}: ${id} is already destroyed.`);
        const events = JSON.parse(node.attributes.sequenceEvents ?? "[]");
        if (op === "create" && used.has(id)) throw new Error(`Line ${line.number}: create must precede use of ${id}.`);
        if (op === "activate") activationDepth.set(id, (activationDepth.get(id) ?? 0) + 1);
        if (op === "deactivate") {
          if ((activationDepth.get(id) ?? 0) <= 0) throw new Error(`Line ${line.number}: no explicit activation for ${id}.`);
          activationDepth.set(id, activationDepth.get(id) - 1);
        }
        if (op === "destroy") destroyed.add(id);
        if (op === "create") createdIds.add(id);
        if (op === "create" || op === "destroy") lifeChanges.set(id, (lifeChanges.get(id) ?? 0) + 1);
        used.add(id);
        events.push({ kind: op, at: connections.length, serial });
        node.attributes.sequenceEvents = JSON.stringify(events);
        if (op === "activate" || op === "deactivate") node.attributes.explicitActivation = "true";
        continue;
      }
      const participant = line.text.match(/^(participant|actor|boundary|control|entity|database|collections|queue)\s+([\w.-]+)(?:\s+(?:as\s+)?("(?:\\.|[^"])*"|.+))?$/i);
      if (participant) {
        const id = participant[2];
        const node = ensureParticipant(id, id, "rectangle", line.number);
        node.label = unquote2(participant[3]?.trim(), id);
        node.shape = { actor: "actor", boundary: "sequence-boundary", control: "sequence-control", entity: "sequence-entity", database: "database", collections: "sequence-collections", queue: "sequence-queue" }[participant[1].toLowerCase()] ?? "rectangle";
        continue;
      }
      const branch = line.text.match(/^(else|and)(?:\s+(.+))?$/i);
      if (branch) {
        const group = openGroups[openGroups.length - 1];
        if (!group || (branch[1] === "else" ? group.kind !== "alt" : group.kind !== "par")) throw new Error(`Line ${line.number}: ${branch[1]} requires ${branch[1] === "else" ? "alt" : "par"}.`);
        if (connections.length === (group.branches?.slice(-1)[0]?.start ?? group.start)) throw new Error(`Line ${line.number}: empty branch.`);
        const frame = frames[frames.length - 1];
        frame.ends.push(snapshot());
        restore(frame.base);
        boundaries.push({ kind: "branch-reset", at: connections.length, serial });
        (group.branches ?? (group.branches = [])).push({ start: connections.length, label: branch[2] ?? branch[1] });
        continue;
      }
      const groupStart = line.text.match(/^(group|alt|opt|loop|par|break|critical)\s+(.+)$/i);
      if (groupStart) {
        const group = {
          id: uniqueId("group", groups.length),
          label: groupStart[2]?.trim() ?? "Group",
          kind: groupStart[1]?.toLowerCase() ?? "group",
          start: connections.length,
          end: connections.length
        };
        groups.push(group);
        openGroups.push(group);
        frames.push({ base: snapshot(), ends: [] });
        boundaries.push({ kind: "branch-save", at: connections.length, serial });
        continue;
      }
      if (/^end$/i.test(line.text)) {
        const group = openGroups.pop();
        if (!group) throw new Error(`Line ${line.number}: unexpected end.`);
        if (group.branches?.slice(-1)[0]?.start === connections.length) throw new Error(`Line ${line.number}: empty branch.`);
        const frame = frames.pop();
        frame.ends.push(snapshot());
        if (group.kind === "par") for (const id of new Set(frame.ends.flatMap((state) => [...state.changes.keys()]))) {
          if (frame.ends.filter((state) => (state.changes.get(id) ?? 0) > (frame.base.changes.get(id) ?? 0)).length > 1) throw new Error(`Parallel operands have conflicting lifetimes for ${id}.`);
        }
        if (["opt", "loop"].includes(group.kind ?? "")) frame.ends.push(frame.base);
        if (["alt", "opt", "loop", "par"].includes(group.kind ?? "")) {
          restore(frame.base);
          for (const state of frame.ends) {
            state.dead.forEach((id) => destroyed.add(id));
            state.used.forEach((id) => used.add(id));
          }
          for (const id of createdIds) if (frame.ends.some((state) => !state.used.has(id))) destroyed.add(id);
          for (const id of new Set(frame.ends.flatMap((state) => [...state.depth.keys()]))) {
            const depths = frame.ends.map((state) => state.depth.get(id) ?? 0);
            activationDepth.set(id, depths.every((d) => d === depths[0]) ? depths[0] : -1);
          }
        }
        if (["opt", "loop"].includes(group.kind ?? "")) boundaries.push({ kind: "branch-reset", at: connections.length, serial: serial - 0.1 });
        boundaries.push({ kind: "branch-end", at: connections.length, serial });
        group.end = Math.max(group.start, connections.length - 1);
        continue;
      }
      let messageLine = line.text;
      const messageOptions = {};
      let optionBlock;
      while (optionBlock = messageLine.match(/\s+\[((?:id|delay|lineColor|lineStyle|thickness)=[^\]]*)\]$/)) {
        for (const option of optionBlock[1].trim().split(/\s+/)) {
          const match = option.match(/^(id|delay|lineColor|lineStyle|thickness)=(.+)$/);
          if (!match) throw new Error(`Invalid message option "${option}".`);
          if (messageOptions[match[1]] !== void 0) throw new Error(`Duplicate message option "${match[1]}".`);
          messageOptions[match[1]] = match[2];
        }
        messageLine = messageLine.slice(0, optionBlock.index);
      }
      const messageId = messageOptions.id;
      if (messageId !== void 0 && !/^[\w.-]+$/.test(messageId)) throw new Error("Invalid message id.");
      const receiveOffset = messageOptions.delay === void 0 ? 0 : Number(messageOptions.delay);
      if (!Number.isFinite(receiveOffset) || receiveOffset < 0 || receiveOffset > 1e4) throw new Error("Message delay must be between 0 and 10000.");
      const reverseMessage = messageLine.match(/^([\w.-]+|\[|\]|\?)\s*(<<?-{1,2})\s*([\w.-]+|\[|\]|\?)\s*(?::\s*(.*))?$/);
      const messageText = reverseMessage ? `${reverseMessage[3]} ${reverseMessage[2].split("").reverse().join("").replace(/</g, ">")} ${reverseMessage[1]}${reverseMessage[4] === void 0 ? "" : `: ${reverseMessage[4]}`}` : messageLine;
      const message = messageText.match(/^([\w.-]+|\[|\]|\?)\s*(-{1,2}>>?|-->>?)\s*([\w.-]+|\[|\]|\?)\s*(?::\s*(.*))?$/);
      if (message) {
        const from = message[1] ?? "";
        const arrow = message[2] ?? "->";
        const to = message[3] ?? "";
        if (destroyed.has(from) || destroyed.has(to)) throw new Error(`Line ${line.number}: message uses a destroyed participant.`);
        if (["[", "]", "?"].includes(from) && ["[", "]", "?"].includes(to)) throw new Error("An external message needs a participant.");
        if (!["[", "]", "?"].includes(from)) ensureParticipant(from, from, "rectangle", line.number);
        if (!["[", "]", "?"].includes(to)) ensureParticipant(to, to, "rectangle", line.number);
        if (connections.some((edge) => edge.id === (messageId ?? connectionId(from, to, connections.length)))) throw new Error(`Duplicate message id "${messageId ?? connectionId(from, to, connections.length)}".`);
        used.add(from);
        used.add(to);
        const activeGroup = openGroups[openGroups.length - 1];
        connections.push({
          id: messageId ?? connectionId(from, to, connections.length),
          from,
          to,
          ...numbering || message[4]?.trim() ? { label: `${numbering ? sequenceNumber(numbering) + " " : ""}${message[4]?.trim() ?? ""}` } : {},
          dashed: arrow.includes("--"),
          attributes: { ...Object.fromEntries(Object.entries(messageOptions).filter(([key]) => ["lineColor", "lineStyle", "thickness"].includes(key))), ...messageOptions.delay !== void 0 ? { receiveOffset: String(receiveOffset) } : {}, messageKind: arrow.includes("--") ? "reply" : arrow.endsWith(">>") ? "async" : "call", ...["[", "]", "?"].includes(from) ? { external: "incoming" } : ["[", "]", "?"].includes(to) ? { external: "outgoing" } : {}, ...from === "[" || to === "[" ? { externalSide: "left" } : from === "]" || to === "]" ? { externalSide: "right" } : {}, ...from === "?" ? { unknownEndpoint: "found", externalSide: reverseMessage ? "right" : "left" } : to === "?" ? { unknownEndpoint: "lost", externalSide: reverseMessage ? "left" : "right" } : {} },
          order: connections.length,
          ...activeGroup ? { groupId: activeGroup.id } : {}
        });
        if (numbering) {
          if (!Number.isSafeInteger(numbering.value)) throw new Error("Autonumber overflow.");
          numbering.value += numbering.step;
        }
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (openGroups.length) throw new Error(`Group "${openGroups[openGroups.length - 1]?.label}" is missing end.`);
    for (const node of nodes) {
      if (footbox) node.attributes.footbox = "true";
      const events = JSON.parse(node.attributes.sequenceEvents ?? "[]");
      for (const created of events.filter((event) => event.kind === "create")) if (connections[created.at]?.to !== node.id) throw new Error(`create ${node.id} must precede a message to ${node.id}.`);
      if (boundaries.length) {
        node.attributes.sequenceEvents = JSON.stringify([...events, ...boundaries].sort((a, b) => a.serial - b.serial));
        if (events.some((event) => event.kind === "create")) node.attributes.branchLifetime = "true";
      }
    }
    for (const note of connections.filter((edge) => edge.attributes?.noteAcross === "true")) {
      if (!nodes.length) throw new Error("note across requires at least one participant.");
      note.from = nodes[0].id;
      note.to = nodes[nodes.length - 1].id;
      note.attributes.participants = nodes.map((node) => node.id).join(",");
    }
    const sequenceIds = /* @__PURE__ */ new Set();
    for (const connection of connections) {
      if (sequenceIds.has(connection.id)) throw new Error(`Duplicate message id "${connection.id}".`);
      sequenceIds.add(connection.id);
    }
    for (const duration of durations) {
      const from = timeAnchors.get(duration.from), to = timeAnchors.get(duration.to);
      if (!from || !to) throw new Error("Duration references an unknown time anchor.");
      for (const group of groups.filter((group2) => group2.kind === "alt")) {
        const operand = (order) => order < group.start || order > group.end ? -1 : (group.branches ?? []).filter((branch) => branch.start <= order).length;
        const left = operand(from.edge.order), right = operand(to.edge.order);
        if (left >= 0 && right >= 0 && left !== right) throw new Error("Duration endpoints cannot belong to mutually exclusive alternatives.");
      }
      if (to.edge.order < from.edge.order || to.edge.order === from.edge.order && !(from.endpoint === "send" && to.endpoint === "receive")) throw new Error("Duration end must follow its start.");
      const attributes = from.edge.attributes ?? (from.edge.attributes = {});
      const spans = JSON.parse(attributes.durations ?? "[]");
      spans.push({ to: to.edge.id, label: duration.label, ...from.endpoint === "receive" ? { fromEndpoint: from.endpoint } : {}, ...to.endpoint === "receive" ? { toEndpoint: to.endpoint } : {} });
      attributes.durations = JSON.stringify(spans);
    }
    return { kind: "sequence", nodes, connections, groups, source, ...pageBreaks.length ? { pageBreaks } : {}, ...Object.keys(diagramText).length ? { diagramText } : {} };
  }
  function parseSimpleDirectedGraph(source, kind, declarationShapes, defaultLabels = {}) {
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    const keywords = Object.keys(declarationShapes).join("|");
    const parents = [];
    const declarationPattern = new RegExp(`^(${keywords})\\s+([\\w.-]+)(?:\\s+("(?:\\\\.|[^"])*"|[^\\s\\[]+))?(?:\\s*\\[([^\\]]+)\\])?$`, "i");
    for (const line of lines.slice(1)) {
      if (line.text === "}") {
        if (!parents.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        continue;
      }
      const block = line.text.match(/^(state|region|lane)\s+([\w.-]+)(?:\s+"([^"]+)")?(?:\s*\[([^\]]+)\])?\s*\{$/);
      if (block) {
        if (!(kind === "state" && ["state", "region"].includes(block[1]) || kind === "activity" && block[1] === "lane")) throw new Error(`Line ${line.number}: unsupported block.`);
        if (block[1] === "lane" && parents.length) throw new Error(`Line ${line.number}: lanes cannot be nested.`);
        if (block[1] === "region" && !parents.length) throw new Error(`Line ${line.number}: region requires a containing state.`);
        const blockAttributes = attributesFrom(block[4]);
        if (blockAttributes.regions && (block[1] !== "state" || !["rows", "columns"].includes(blockAttributes.regions))) throw new Error("regions must be rows or columns on a composite state.");
        const node = { id: block[2], label: block[3] ?? block[2], shape: "container", attributes: { ...blockAttributes, umlBlock: block[1], ...kind === "state" ? { stateKind: block[1] } : {} }, ...parents.length ? { parentId: parents[parents.length - 1] } : {} };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        parents.push(node.id);
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:(?:\s*:\s*(.+))|(?:\s+(\[[^\]]+\](?:\s*\/\s*.+)?)))?$/);
      if (relation) {
        const from = relation[1] ?? "";
        const to = relation[3] ?? "";
        const rawLabel = (relation[4] ?? relation[5])?.trim();
        let label = rawLabel;
        let attributes;
        const portBlock = rawLabel?.match(/^(.*?)(?:\s*)\[([^\]]*(?:fromPort|from-port|toPort|to-port|kind|id|pre|post|lineColor|lineStyle|thickness)\s*=.+)\]$/i);
        if (portBlock) {
          const parsed = attributesFrom(portBlock[2]);
          const fromPort = parsed.fromPort ?? parsed["from-port"];
          const toPort = parsed.toPort ?? parsed["to-port"];
          const validPorts = /* @__PURE__ */ new Set(["top", "right", "bottom", "left"]);
          if (fromPort && !validPorts.has(fromPort.toLowerCase())) throw new Error(`Line ${line.number}: invalid fromPort "${fromPort}".`);
          if (toPort && !validPorts.has(toPort.toLowerCase())) throw new Error(`Line ${line.number}: invalid toPort "${toPort}".`);
          attributes = {
            ...Object.fromEntries(Object.entries(parsed).filter(([key]) => ["lineColor", "lineStyle", "thickness"].includes(key))),
            ...kind === "state" ? { ...parsed, ...parsed.kind ? { transitionKind: parsed.kind } : {} } : {},
            ...fromPort ? { fromPort: fromPort.toLowerCase() } : {},
            ...toPort ? { toPort: toPort.toLowerCase() } : {}
          };
          label = portBlock[1]?.trim() || void 0;
        }
        if (kind === "state") {
          const parts2 = parseStateTransition(unquote2(label, ""));
          attributes = { ...parts2, transitionKind: "external", ...attributes };
          if (!["external", "local"].includes(attributes.transitionKind)) throw new Error("State transition kind must be external or local; use internal for a state-body transition.");
          if (attributes.pre !== void 0 || attributes.post !== void 0) label = `${attributes.pre !== void 0 ? `[${attributes.pre}] ` : ""}${label ?? ""}${attributes.post !== void 0 ? ` / [${attributes.post}]` : ""}`;
          if (attributes.transitionKind === "local") label = `${label ?? ""} {local}`.trim();
        }
        connections.push({
          id: attributes?.id ?? connectionId(from, to, connections.length),
          from,
          to,
          ...label ? { label: unquote2(label, "") } : {},
          dashed: (relation[2] ?? "").includes("--") || (relation[2] ?? "").includes(".."),
          order: connections.length,
          ...attributes ? { attributes } : {}
        });
        continue;
      }
      const declaration = line.text.match(declarationPattern);
      if (declaration) {
        const keyword = declaration[1]?.toLowerCase() ?? "";
        const id = declaration[2] ?? "";
        const attributes = attributesFrom(declaration[4]);
        if (kind === "state") attributes.stateKind = keyword;
        if (kind === "activity") attributes.activityKind = keyword;
        const shape = attributes.shape ?? declarationShapes[keyword] ?? "rectangle";
        delete attributes.shape;
        const node = {
          id,
          label: unquote2(declaration[3], defaultLabels[keyword] ?? id),
          shape,
          ...parents.length ? { parentId: parents[parents.length - 1] } : {},
          attributes
        };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (parents.length) throw new Error(`Unclosed block "${parents[parents.length - 1]}".`);
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from) && !/\binherited\b/.test(lines[0]?.text ?? "")) throw new Error(`Connection references unknown node "${edge.from}".`);
      if (!ids.has(edge.to) && !/\binherited\b/.test(lines[0]?.text ?? "")) throw new Error(`Connection references unknown node "${edge.to}".`);
      if (kind === "activity" && ["end", "flowfinal"].includes(nodes.find((n) => n.id === edge.from)?.attributes.activityKind ?? "")) throw new Error(`Activity final "${edge.from}" cannot have outgoing connections.`);
    }
    return { kind, nodes, connections, groups: [], source, ...kind === "state" ? { direction: /\bdirection=LR\b/.test(lines[0]?.text ?? "") ? "right" : "down" } : {} };
  }
  function parseFlowchart(source) {
    const decorated = withDiagramText(source, parseFlowchart);
    if (decorated) return decorated;
    const annotated = withAnnotations(source, parseFlowchart);
    if (annotated) return annotated;
    return parseSimpleDirectedGraph(source, "flowchart", {
      start: "rounded",
      end: "rounded",
      step: "rectangle",
      process: "rectangle",
      decision: "diamond",
      input: "parallelogram",
      output: "parallelogram",
      node: "rectangle"
    }, { start: "Start", end: "End" });
  }
  function parseGraph(source) {
    const decorated = withDiagramText(source, parseGraph);
    if (decorated) return decorated;
    const annotated = withAnnotations(source, parseGraph);
    if (annotated) return annotated;
    const lines = meaningfulLines(source);
    const directive = lines[0]?.text ?? "";
    const rawOptions = directive.replace(/^@graph\b/i, "").trim();
    let direction = "down";
    if (rawOptions) {
      const normalized = rawOptions.replace(/^\[|\]$/g, "").trim();
      const option = normalized.match(/^direction\s*=\s*(LR|TB|TD)$/i);
      if (!option) throw new Error(`Line ${lines[0]?.number ?? 1}: unsupported @graph option "${rawOptions}".`);
      direction = option[1]?.toUpperCase() === "LR" ? "right" : "down";
    }
    const nodes = [];
    const connections = [];
    const groupStack = [];
    const implicitIds = /* @__PURE__ */ new Set();
    const nodeById = () => new Map(nodes.map((node) => [node.id, node]));
    const activeGroup = () => groupStack[groupStack.length - 1];
    const ensureNode = (id) => {
      const existing = nodes.find((node2) => node2.id === id);
      if (existing) return existing;
      const parentId = activeGroup();
      const node = {
        id,
        label: id,
        shape: "rectangle",
        ...parentId ? { parentId } : {},
        attributes: {}
      };
      nodes.push(node);
      implicitIds.add(id);
      return node;
    };
    const declareNode = (node, line) => {
      const existing = nodes.find((candidate) => candidate.id === node.id);
      if (!existing) {
        nodes.push(node);
        return;
      }
      if (!implicitIds.has(node.id)) throw new Error(`Line ${line}: duplicate node id "${node.id}".`);
      existing.label = node.label;
      existing.shape = node.shape;
      existing.attributes = node.attributes;
      if (node.parentId) existing.parentId = node.parentId;
      else delete existing.parentId;
      implicitIds.delete(node.id);
    };
    for (const line of lines.slice(1)) {
      if (line.text === "}") {
        if (!groupStack.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
      if (relation) {
        const from = relation[1] ?? "";
        const arrow = relation[2] ?? "->";
        const to = relation[3] ?? "";
        ensureNode(from);
        ensureNode(to);
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[4]?.trim() ? { label: unquote2(relation[4].trim(), "") } : {},
          dashed: arrow.includes("--") || arrow.includes(".."),
          order: connections.length
        });
        continue;
      }
      const group = line.text.match(/^group\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"))?(?:\s*\[([^\]]+)\])?\s*\{$/i);
      if (group) {
        const id = group[1] ?? "";
        const attributes = attributesFrom(group[3]);
        const parentId = activeGroup();
        declareNode({
          id,
          label: unquote2(group[2], id),
          shape: "container",
          ...parentId ? { parentId } : {},
          attributes
        }, line.number);
        groupStack.push(id);
        continue;
      }
      const declaration = line.text.match(/^(?:node\s+)?([\w.-]+)(?:\s+("(?:\\.|[^"])*"))?(?:\s*\[([^\]]+)\])?$/i);
      if (declaration) {
        const id = declaration[1] ?? "";
        const attributes = attributesFrom(declaration[3]);
        const shape = attributes.shape ?? "rectangle";
        delete attributes.shape;
        const parentId = activeGroup();
        declareNode({
          id,
          label: unquote2(declaration[2], id),
          shape,
          ...parentId ? { parentId } : {},
          attributes
        }, line.number);
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (groupStack.length) throw new Error(`Group "${groupStack[groupStack.length - 1]}" is missing a closing brace.`);
    const ids = nodeById();
    for (const node of nodes) {
      if (node.parentId && !ids.has(node.parentId)) throw new Error(`Node "${node.id}" references unknown group "${node.parentId}".`);
    }
    return { kind: "graph", nodes, connections, groups: [], direction, source };
  }
  function parseState(source) {
    const decorated = withDiagramText(source, parseState);
    if (decorated) return decorated;
    const lines = meaningfulLines(source);
    const body = [];
    let blockDepth = 0;
    const machines = /* @__PURE__ */ Object.create(null);
    for (let i = 0; i < lines.length; i++) {
      const definition = lines[i].text.match(/^machine\s+([\w.-]+)(?:\s+extends\s+([\w.-]+))?(?:\s+(protocol))?\s*\{$/);
      if (!definition) {
        const line = lines[i].text;
        if (/^(state|region)\b.*\{$/.test(line)) blockDepth++;
        if (line === "}") blockDepth--;
        body.push(line);
        continue;
      }
      if (blockDepth !== 0) throw new Error("Machine definitions must be top-level.");
      const name = definition[1];
      if (Object.prototype.hasOwnProperty.call(machines, name)) throw new Error(`Duplicate machine "${name}".`);
      let depth = 1;
      const content = [];
      for (i++; i < lines.length; i++) {
        const line = lines[i].text;
        if (/^(state|region)\b.*\{$/.test(line)) depth++;
        if (line === "}" && --depth === 0) break;
        content.push(line);
      }
      if (depth) throw new Error(`Unclosed machine "${name}".`);
      machines[name] = parseStateBody(`@state${definition[3] ? " protocol" : ""}${definition[2] ? " inherited" : ""}
${content.join("\n")}`);
      if (definition[2]) machines[name].extendsMachine = definition[2];
    }
    const resolving = /* @__PURE__ */ new Set(), resolved = /* @__PURE__ */ new Set();
    const inherit = (name) => {
      if (resolved.has(name)) return;
      if (resolving.has(name)) throw new Error(`Cyclic machine inheritance: ${name}.`);
      const derived = machines[name];
      const baseName = derived.extendsMachine;
      if (baseName) {
        if (!machines[baseName]) throw new Error(`Unknown base machine ${baseName}.`);
        resolving.add(name);
        inherit(baseName);
        const base = machines[baseName];
        const ownIds = new Set(derived.nodes.map((n) => n.id)), edgeIds = new Set(derived.connections.map((e) => e.id));
        derived.nodes = [...base.nodes.filter((n) => !ownIds.has(n.id)).map((n) => ({ ...n, attributes: { ...n.attributes } })), ...derived.nodes];
        derived.connections = [...base.connections.filter((e) => !edgeIds.has(e.id)).map((e) => ({ ...e, attributes: { ...e.attributes } })), ...derived.connections];
        if (!derived.stateMachineKind && base.stateMachineKind) derived.stateMachineKind = base.stateMachineKind;
        resolving.delete(name);
      }
      resolved.add(name);
    };
    Object.keys(machines).forEach(inherit);
    for (const machine of Object.values(machines)) if (machine.extendsMachine) {
      const quote = (text) => `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      const lines2 = [`@state${machine.stateMachineKind === "protocol" ? " protocol" : ""}`];
      const write = (parent) => {
        for (const node of machine.nodes.filter((n) => n.parentId === parent)) {
          const kind = node.attributes.stateKind ?? "state";
          const children = machine.nodes.some((n) => n.parentId === node.id);
          if (children && !node.attributes.submachine) {
            const attrs = Object.entries(node.attributes).filter(([key]) => !["stateKind", "stateBody", "stateBehaviors", "connectionPoint", "defer", "invariant", "kind", "members"].includes(key)).map(([key, value]) => `${key}=${quote(value)}`).join(" ");
            lines2.push(`${kind} ${node.id} ${quote(node.label)}${attrs ? ` [${attrs}]` : ""} {`);
            write(node.id);
            lines2.push("}");
          } else {
            const attrs = Object.entries(node.attributes).filter(([key]) => !["stateKind", "stateBody", "stateBehaviors", "connectionPoint", "defer", "invariant", "kind", "members"].includes(key)).map(([k, v]) => `${k}=${quote(v)}`).join(" ");
            lines2.push(`${kind} ${node.id} ${quote(node.label)}${attrs ? ` [${attrs}]` : ""}`);
            if (children) write(node.id);
          }
          for (const behavior of JSON.parse(node.attributes.stateBehaviors ?? "[]")) lines2.push(`${behavior.kind} ${node.id} ${quote(behavior.kind === "internal" ? `${behavior.trigger ?? ""}${behavior.guard !== void 0 ? ` [${behavior.guard}]` : ""}${behavior.effect !== void 0 ? ` / ${behavior.effect}` : ""}` : behavior.effect ?? "")}`);
          for (const key of ["defer", "invariant"]) if (node.attributes[key]) lines2.push(`${key} ${node.id} ${quote(node.attributes[key])}`);
        }
      };
      write();
      for (const edge of machine.connections) {
        const a = edge.attributes ?? {};
        const label = `${a.trigger ?? ""}${a.guard !== void 0 ? ` [${a.guard}]` : ""}${a.effect !== void 0 ? ` / ${a.effect}` : ""}`.trim();
        const attrs = [`id=${quote(edge.id)}`, `kind=${quote(a.transitionKind ?? a.kind ?? "external")}`, ...Object.entries(a).filter(([k]) => !["id", "trigger", "triggerKind", "guard", "effect", "transitionKind", "kind"].includes(k)).map(([k, v]) => `${k}=${quote(v)}`)].join(" ");
        lines2.push(`${edge.from} ${edge.dashed ? "-->" : "->"} ${edge.to}: ${label} [${attrs}]`);
      }
      machine.source = lines2.join("\n");
    }
    const model = parseStateBody(body.join("\n"));
    model.source = source;
    if (Object.keys(machines).length) model.stateMachines = machines;
    model.diagnostics = validateState(model);
    if (/\bvalidation=strict\b/.test(lines[0]?.text ?? "") && model.diagnostics.length) throw new Error(model.diagnostics.map((item) => `${item.code}: ${item.message}`).join("\n"));
    return model;
  }
  function parseStateBody(source) {
    const annotated = withAnnotations(source, parseStateBody);
    if (annotated) return annotated;
    const model = parseSimpleDirectedGraph(source, "state", {
      initial: "initial-state",
      junction: "junction-state",
      choice: "choice-state",
      fork: "uml-bar",
      join: "uml-bar",
      history: "history-state",
      "deep-history": "deep-history-state",
      final: "final-state",
      terminate: "terminate-state",
      state: "rounded",
      entryPoint: "entry-point",
      exitPoint: "exit-point",
      sdlreceive: "signal-receive",
      inputPin: "state-input-pin",
      outputPin: "state-output-pin",
      inputpin: "state-input-pin",
      outputpin: "state-output-pin",
      entrypoint: "entry-point",
      exitpoint: "exit-point"
    }, { initial: "", junction: "", choice: "", fork: "", join: "", history: "H", "deep-history": "H*", final: "", terminate: "" });
    if (/\bprotocol\b/.test(meaningfulLines(source)[0]?.text ?? "")) model.stateMachineKind = "protocol";
    for (const node of model.nodes) {
      if (["entrypoint", "exitpoint", "inputpin", "outputpin"].includes(node.attributes.stateKind ?? "")) {
        node.attributes.connectionPoint = "true";
        if (node.attributes.state) node.parentId = node.attributes.state;
      }
    }
    for (const edge of model.connections) {
      const from = model.nodes.find((n) => n.id === edge.from);
      if (from?.attributes.stateKind === "entrypoint" && !from.attributes.ref) edge.attributes = { ...edge.attributes, transitionKind: "local" };
    }
    return model;
  }
  function parseActivity(source) {
    const decorated = withDiagramText(source, parseActivity);
    if (decorated) return decorated;
    const lanes = parseActivityLaneSwitches(source, parseActivity);
    if (lanes) return lanes;
    const annotated = withAnnotations(source, parseActivity);
    if (annotated) return annotated;
    const expanded = expandActivityBlocks(source);
    if (expanded !== source) return { ...parseActivity(expanded), source };
    return parseSimpleDirectedGraph(source, "activity", {
      start: "initial-state",
      send: "signal-send",
      receive: "signal-receive",
      action: "rounded",
      activity: "rounded",
      decision: "diamond",
      merge: "diamond",
      fork: "uml-bar",
      join: "uml-bar",
      object: "uml-object",
      end: "final-state",
      flowfinal: "exit-point"
    }, { start: "", fork: "", join: "", end: "", flowfinal: "" });
  }
  function normalizeCardinality(value) {
    const normalized = value.toLowerCase();
    return {
      one: "1",
      "zero-one": "0..1",
      many: "N",
      n: "N",
      "zero-many": "0..N"
    }[normalized] ?? value.toUpperCase();
  }
  function parseEr(source) {
    const decorated = withDiagramText(source, parseEr);
    if (decorated) return decorated;
    const annotated = withAnnotations(source, parseEr);
    if (annotated) return annotated;
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    let active;
    for (const line of lines.slice(1)) {
      if (active) {
        if (line.text === "}") {
          active.node.attributes.fields = JSON.stringify(active.fields);
          nodes.push(active.node);
          active = void 0;
          continue;
        }
        const field = line.text.match(/^([\w.-]+)\s+([^\s]+)(?:\s+(.+))?$/);
        if (!field) throw new Error(`Line ${line.number}: invalid entity field "${line.text}".`);
        const flags = (field[3] ?? "").split(/\s+/).filter(Boolean).map((flag) => {
          const normalized = flag.toLowerCase();
          if (["primary", "primary-key"].includes(normalized)) return "pk";
          if (["foreign", "foreign-key"].includes(normalized)) return "fk";
          return normalized;
        });
        active.fields.push({ name: field[1] ?? "", type: field[2] ?? "", flags });
        continue;
      }
      const entity = line.text.match(/^entity\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\{]+))?\s*\{$/i);
      if (entity) {
        const id = entity[1] ?? "";
        const node = { id, label: unquote2(entity[2], id), shape: "entity", attributes: {} };
        assertUnique(nodes, node, line.number);
        active = { node, fields: [], line: line.number };
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(1|one|0\.\.1|zero-one|N|many|0\.\.N|zero-many)\s+(-{1,2}>|-->)\s+(1|one|0\.\.1|zero-one|N|many|0\.\.N|zero-many)\s+([\w.-]+)(?:\s*:\s*(.+))?$/i);
      if (relation) {
        const from = relation[1] ?? "";
        const to = relation[5] ?? "";
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[6]?.trim() ? { label: relation[6].trim() } : {},
          dashed: (relation[3] ?? "").includes("--"),
          order: connections.length,
          attributes: {
            fromCardinality: normalizeCardinality(relation[2] ?? "1"),
            toCardinality: normalizeCardinality(relation[4] ?? "N")
          }
        });
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (active) throw new Error(`Entity "${active.node.id}" opened on line ${active.line} is missing a closing brace.`);
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Relation references unknown entity "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Relation references unknown entity "${edge.to}".`);
    }
    return { kind: "er", nodes, connections, groups: [], source };
  }
  function parseComponent(source) {
    const model = parseDeployment(source);
    return { ...model, kind: "component" };
  }
  function parseObject(source, implicitClassifiers = false) {
    const decorated = withDiagramText(source, (value) => parseObject(value, implicitClassifiers));
    if (decorated) return decorated;
    const json = expandObjectJson(expandObjectNamespaces(source, implicitClassifiers));
    const expanded = expandObjectMaps(json.source, json.maps);
    const slots = /* @__PURE__ */ new Map();
    const objects = new Set([...expanded.source.matchAll(/^\s*object\s+([\w.-]+)/gm)].map((match) => match[1]));
    const classifiers = new Set([...expanded.source.matchAll(/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)/gm)].map((match) => match[1]));
    const additions = /* @__PURE__ */ new Map();
    const rules = [];
    let inBody = false;
    const objectLines = meaningfulLines(expanded.source).filter((line) => {
      if (inBody) {
        if (line.text === "}") inBody = false;
        return true;
      }
      if (/^(object|package|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+/.test(line.text)) {
        if (/^(object|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{$/.test(line.text)) inBody = true;
        return true;
      }
      if (/^(hide|show|remove|restore)\s+/.test(line.text)) {
        rules.push(line.text);
        return false;
      }
      const slot = line.text.match(/^([\w.-]+)\s*:(?!:)\s*(.+)$/);
      if (!slot || classifiers.has(slot[1])) return true;
      if (expanded.maps.has(slot[1])) throw new Error(`Map or JSON "${slot[1]}" entries must be declared in its body.`);
      if (implicitClassifiers && !objects.has(slot[1])) return true;
      const values = additions.get(slot[1]) ?? [];
      values.push(slot[2]);
      additions.set(slot[1], values);
      return false;
    });
    let active;
    let classifierBody = false;
    const transformed = objectLines.map((line) => {
      if (line.text.startsWith("@object")) return line.text.replace("@object", "@class");
      if (classifierBody) {
        if (line.text === "}") classifierBody = false;
        return line.text;
      }
      if (active) {
        if (line.text === "}") {
          const extra = additions.get(active) ?? [];
          slots.get(active).push(...extra);
          active = void 0;
          return [...extra.map((text) => `{literal} ${text}`), "}"].join("\n");
        }
        slots.get(active).push(line.text);
        return `{literal} ${line.text}`;
      }
      if (/^(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{$/.test(line.text)) {
        classifierBody = true;
        return line.text;
      }
      const declaration = line.text.match(/^object\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s{]+))?\s*(\{)?$/);
      if (declaration) {
        const id = declaration[1];
        if (slots.has(id)) throw new Error(`Duplicate object ${id}.`);
        slots.set(id, declaration[3] ? [] : [...additions.get(id) ?? []]);
        if (declaration[3]) active = id;
        return `class ${id} ${declaration[2] ?? `"${id}"`} {${declaration[3] ? "" : `
${slots.get(id).map((text) => `{literal} ${text}`).join("\n")}
}`}`;
      }
      return line.text;
    }).join("\n");
    for (const id of additions.keys()) if (!slots.has(id)) throw new Error(`Unknown object slot target "${id}".`);
    const model = parseClass(transformed, implicitClassifiers);
    for (const node of model.nodes) if (slots.has(node.id)) {
      node.shape = "uml-instance";
      node.attributes.instance = "true";
      node.attributes.slots = JSON.stringify(slots.get(node.id));
      node.attributes.members = JSON.stringify(slots.get(node.id).map((text) => ({ text, kind: "attribute" })));
    }
    for (const [id, entries] of expanded.maps) {
      const node = model.nodes.find((n) => n.id === id);
      node.shape = "uml-map";
      node.attributes.mapEntries = JSON.stringify(entries);
    }
    applyClassDisplay(model, rules);
    return { ...model, kind: "object", source };
  }
  function parseClass(source, implicit = true) {
    const decorated = withDiagramText(source, (value) => parseClass(value, implicit));
    if (decorated) return decorated;
    let body = false;
    for (const line of meaningfulLines(source)) {
      if (body) {
        if (line.text === "}") body = false;
        continue;
      }
      if (/^(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{$/.test(line.text)) {
        body = true;
        continue;
      }
      if (/^(object|json|map)\s+/.test(line.text)) return { ...parseObject(source.replace("@class", "@object"), implicit), kind: "class", source };
    }
    let visibilityIconSize = 0;
    const parameters = /* @__PURE__ */ new Map();
    const rules = [];
    const tags = [];
    const bindings = [];
    let inClass = false;
    const normalized = expandClassNamespaces(source, implicit).split(/\r?\n/).map((line) => {
      const iconSetting = !inClass && line.trim().match(/^(?:skinparam\s+)?classAttributeIconSize\s+(\d+)$/);
      if (iconSetting) {
        visibilityIconSize = Number(iconSetting[1]);
        if (visibilityIconSize > 16) throw new Error("classAttributeIconSize must be between 0 and 16.");
        return "";
      }
      const binding = !inClass && line.trim().match(/^bind\s+([\w.-]+)\s+([\w.-]+)\s+"([^"]+)"$/);
      if (binding) {
        bindings.push({ from: binding[1], to: binding[2], text: binding[3] });
        return "";
      }
      const tag = !inClass && line.trim().match(/^tag\s+([\w.-]+)\s+([\w.-]+(?:\s+[\w.-]+)*)$/);
      if (tag) {
        tags.push({ id: tag[1], values: tag[2].split(/\s+/) });
        return "";
      }
      if (!inClass && /^\s*(hide|show|remove|restore)\s+/.test(line)) {
        rules.push(line.trim());
        return "";
      }
      if (/^\s*(class|interface|abstract|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line)) inClass = true;
      else if (inClass && line.trim() === "}") inClass = false;
      const match = line.match(/^(\s*)(class|abstract|interface|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)<(.+)>(\s*(?:"(?:\\.|[^"])*")?\s*\{)\s*$/);
      if (!match) return line;
      if (parameters.has(match[3])) throw new Error(`Duplicate template ${match[3]}.`);
      parameters.set(match[3], match[4]);
      return `${match[1]}${match[2]} ${match[3]}${match[5]}`;
    }).join("\n");
    const model = parseClassCore(expandClassMembers(normalized, implicit), implicit);
    for (const node of model.nodes) if (node.shape === "uml-class") node.attributes.visibilityIconSize = String(visibilityIconSize);
    for (const node of model.nodes) if (parameters.has(node.id)) node.attributes.templateParameters = parameters.get(node.id);
    for (const tag of tags) {
      const node = model.nodes.find((n) => n.id === tag.id && n.shape === "uml-class");
      if (!node) throw new Error(`Unknown class tag target ${tag.id}.`);
      node.attributes.tags = JSON.stringify([.../* @__PURE__ */ new Set([...JSON.parse(node.attributes.tags ?? "[]"), ...tag.values])]);
    }
    for (const binding of bindings) addTemplateBinding(model, binding.from, binding.to, binding.text);
    applyClassDisplay(model, rules);
    return { ...model, source };
  }
  function parseClassCore(source, implicit) {
    const annotated = withAnnotations(source, (value) => parseClass(value, implicit));
    if (annotated) return annotated;
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    let active;
    const packages = [];
    const inferredParents = /* @__PURE__ */ new Map();
    for (const line of lines.slice(1)) {
      if (active) {
        if (line.text === "}") {
          active.node.attributes.members = JSON.stringify(active.members);
          nodes.push(active.node);
          active = void 0;
          continue;
        }
        if (line.text.startsWith("{literal} ")) {
          active.members.push({ text: line.text.slice(10), kind: "attribute" });
          continue;
        }
        const separator = line.text.match(/^(--|\.\.|==|__)(?:\s+(.*?)\s*\1)?$/);
        if (separator) {
          active.node.attributes.customCompartments = "true";
          active.members.push({ kind: "separator", text: separator[2] ?? "", separator: separator[1] });
          continue;
        }
        let { text: memberText, modifiers } = parseMemberModifiers(line.text);
        const visibilityEscaped = /^\\[+~#-]/.test(memberText);
        if (visibilityEscaped) memberText = memberText.slice(1);
        const kind = active.node.attributes.kind === "enum" ? "literal" : modifiers.has("field") ? "attribute" : modifiers.has("method") || memberText.includes("(") ? "operation" : "attribute";
        active.members.push({ text: memberText, kind, ...visibilityEscaped ? { visibilityEscaped: true } : {}, ...modifiers.has("static") ? { static: true } : {}, ...modifiers.has("abstract") ? { abstract: true } : {} });
        continue;
      }
      if (line.text === "}") {
        if (!packages.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        continue;
      }
      const packageBlock = line.text.match(/^package\s+([\w.-]+)(?:\s+"([^"]+)")?(?:\s+(\[namespace\]))?\s*\{$/);
      if (packageBlock) {
        const node = { id: packageBlock[1], label: packageBlock[2] ?? packageBlock[1], shape: "container", attributes: { umlBlock: "package" }, ...packages.length ? { parentId: packages[packages.length - 1] } : {} };
        if (packageBlock[3]) node.attributes.namespace = "true";
        const existing = nodes.find((n) => n.id === node.id);
        if (existing && packageBlock[3] && existing.attributes.namespace === "true") {
          if (existing.parentId !== node.parentId || existing.label !== node.label) throw new Error(`Conflicting namespace declaration "${node.id}".`);
        } else {
          assertUnique(nodes, node, line.number);
          nodes.push(node);
        }
        packages.push(node.id);
        continue;
      }
      const namedNote = line.text.match(/^(note|rnote|hnote)\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+)$/);
      if (namedNote) {
        const node = { id: namedNote[3], label: unquote2(namedNote[2], ""), shape: "uml-artifact", attributes: { standaloneNote: "true", noteShape: namedNote[1], tone: "amber" }, ...packages.length ? { parentId: packages[packages.length - 1] } : {} };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        continue;
      }
      const circle = line.text.match(/^circle\s+([\w.-]+)(?:\s+("(?:\\.|[^"\\])*"))?$/);
      if (circle) {
        const node = { id: circle[1], label: unquote2(circle[2], circle[1].split(".").pop()), shape: "uml-provided-interface", attributes: { kind: "interface" }, ...packages.length ? { parentId: packages[packages.length - 1] } : {} };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        continue;
      }
      const diamond = line.text.match(/^diamond\s+([\w.-]+)(?:\s+("(?:\\.|[^"\\])*"))?$/);
      if (diamond) {
        const node = { id: diamond[1], label: unquote2(diamond[2], ""), shape: "diamond", attributes: { kind: "association" }, ...packages.length ? { parentId: packages[packages.length - 1] } : {} };
        assertUnique(nodes, node, line.number);
        nodes.push(node);
        continue;
      }
      const declaration = line.text.match(/^(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\{]+))?\s*\{$/i);
      if (declaration) {
        const kind = declaration[1]?.toLowerCase() ?? "class";
        const id = declaration[2] ?? "";
        const node = {
          id,
          label: unquote2(declaration[3], id),
          shape: "uml-class",
          ...packages.length ? { parentId: packages[packages.length - 1] } : {},
          attributes: { kind }
        };
        assertUnique(nodes, node, line.number);
        active = { node, members: [], line: line.number };
        continue;
      }
      const roleBlock = line.text.match(/\s+\[([^\]]*(?:fromRole|toRole|fromMapRow|toMapRow|fromPort|toPort|id|lineColor|lineStyle|thickness)\s*=[^\]]+)\]$/);
      const roleAttributes = attributesFrom(roleBlock?.[1]);
      const relationText = roleBlock ? line.text.slice(0, roleBlock.index) : line.text;
      const relation = relationText.match(new RegExp(String.raw`^([\w.-]+)(?:::(~?[\w$]+(?:\([^)]*\))?))?(?:\s+"([^"]+)")?\s+(${classRelationOperators})(?:\s+"([^"]+)")?\s+([\w.-]+)(?:::(~?[\w$]+(?:\([^)]*\))?))?(?:\s*:\s*(.+))?$`));
      if (relation) {
        const left = relation[1] ?? "";
        const leftCardinality = relation[3];
        const operator = relation[4] ?? "--";
        const rightCardinality = relation[5];
        const right = relation[6] ?? "";
        const specialNavigation = /^[#}+^](?:--|\.\.)>$|^<(?:--|\.\.)[#\{+^]$/.test(operator);
        const reversed = specialNavigation && operator.startsWith("<") || ["<|--", "<|..", "--*", "..*", "--o", "..o", "<--", "<..", "<--*", "<..*", "<--o", "<..o", "<--x", "<..x"].includes(operator);
        const relationKind = {
          "<|--": "inheritance",
          "<|..": "realization",
          "..|>": "realization",
          "--|>": "inheritance",
          "*-->": "composition",
          "*..>": "composition",
          "<--*": "composition",
          "<..*": "composition",
          "*--": "composition",
          "*..": "composition",
          "--*": "composition",
          "..*": "composition",
          "o-->": "aggregation",
          "o..>": "aggregation",
          "<--o": "aggregation",
          "<..o": "aggregation",
          "o--": "aggregation",
          "o..": "aggregation",
          "--o": "aggregation",
          "..o": "aggregation",
          "..>": "dependency",
          "<..": "dependency",
          "x-->": "directed-association",
          "x..>": "directed-association",
          "<--x": "directed-association",
          "<..x": "directed-association",
          "<-->": "directed-association",
          "<..>": "dependency",
          "-->": "directed-association",
          "<--": "directed-association",
          "--": "association"
        }[operator] ?? (specialNavigation ? "directed-association" : "association");
        const rawLabel = relation[8]?.trim();
        const reading = rawLabel?.match(/^(<|>)\s+(.+)$|^(.+?)\s+(<|>)$/);
        const label = reading ? reading[2] ?? reading[3] : rawLabel;
        const labelDirection = reading ? (reading[1] ?? reading[4]) === ">" !== reversed ? "forward" : "backward" : void 0;
        const from = reversed ? right : left;
        const to = reversed ? left : right;
        for (const id of [from, to]) if (!inferredParents.has(id)) inferredParents.set(id, packages[packages.length - 1]);
        const fromCardinality = reversed ? rightCardinality : leftCardinality;
        const toCardinality = reversed ? leftCardinality : rightCardinality;
        connections.push({
          id: roleAttributes.id ?? connectionId(from, to, connections.length),
          from,
          to,
          ...label ? { label } : {},
          dashed: operator.includes(".."),
          order: connections.length,
          attributes: {
            ...Object.fromEntries(Object.entries(roleAttributes).filter(([key]) => ["lineColor", "lineStyle", "thickness"].includes(key))),
            relation: relationKind,
            .../^[#}+^]/.test(operator) ? { fromDecoration: { "#": "square", "}": "crowfoot", "+": "circle-cross", "^": "triangle" }[operator[0]] } : {},
            .../[#\{+^]$/.test(operator) ? { [reversed ? "fromDecoration" : "toDecoration"]: { "#": "square", "{": "crowfoot", "+": "circle-cross", "^": "triangle" }[operator[operator.length - 1]] } : {},
            ...labelDirection ? { labelDirection } : {},
            ...["x--", "x..", "x-->", "x..>", "<--x", "<..x"].includes(operator) ? { nonNavigableEnd: "from" } : ["--x", "..x"].includes(operator) ? { nonNavigableEnd: "to" } : {},
            ...["<-->", "<..>"].includes(operator) ? { bidirectional: "true" } : {},
            ...specialNavigation || ["*-->", "*..>", "o-->", "o..>", "<--*", "<..*", "<--o", "<..o", "x-->", "x..>", "<--x", "<..x"].includes(operator) ? { navigable: "true" } : {},
            ...(reversed ? relation[7] : relation[2]) ? { fromMember: reversed ? relation[7] : relation[2] } : {},
            ...(reversed ? relation[2] : relation[7]) ? { toMember: reversed ? relation[2] : relation[7] } : {},
            ...(reversed ? roleAttributes.toMapRow : roleAttributes.fromMapRow) !== void 0 ? { fromMapRow: reversed ? roleAttributes.toMapRow : roleAttributes.fromMapRow } : {},
            ...(reversed ? roleAttributes.fromMapRow : roleAttributes.toMapRow) !== void 0 ? { toMapRow: reversed ? roleAttributes.fromMapRow : roleAttributes.toMapRow } : {},
            ...roleAttributes.fromPort ? { fromPort: roleAttributes.fromPort } : {},
            ...roleAttributes.toPort ? { toPort: roleAttributes.toPort } : {},
            ...roleAttributes.fromRole ? { fromRole: roleAttributes.fromRole } : {},
            ...roleAttributes.toRole ? { toRole: roleAttributes.toRole } : {},
            ...fromCardinality ? { fromCardinality } : {},
            ...toCardinality ? { toCardinality } : {}
          }
        });
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (active) throw new Error(`${active.node.attributes.kind} "${active.node.id}" opened on line ${active.line} is missing a closing brace.`);
    if (packages.length) throw new Error(`Unclosed package "${packages[packages.length - 1]}".`);
    if (implicit) for (const [id, parentId] of inferredParents) {
      if (!nodes.some((node) => node.id === id)) nodes.push({ id, label: id.split(".").slice(-1)[0], shape: "uml-class", attributes: { kind: "class", members: "[]", implicit: "true" }, ...parentId ? { parentId } : {} });
    }
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Relation references unknown classifier "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Relation references unknown classifier "${edge.to}".`);
      for (const endpoint of ["from", "to"]) {
        const member = edge.attributes?.[`${endpoint}Member`];
        if (!member) continue;
        const node = nodes.find((n) => n.id === edge[endpoint]);
        const members = JSON.parse(node.attributes.members ?? "[]");
        edge.attributes[`${endpoint}MemberIndex`] = String(resolveMemberIndex(members, member));
      }
    }
    return { kind: "class", nodes, connections, groups: [], source };
  }
  function parseUsecase(source) {
    const decorated = withDiagramText(source, parseUsecase);
    if (decorated) return decorated;
    const transformed = source.split(/\r?\n/).map((line) => {
      const relation = line.trim().match(/^(include|extend|generalize)\s+([\w.-]+)\s+->\s+([\w.-]+)(\s+\[[^\]]+\])?$/i);
      if (relation) {
        const kind = relation[1].toLowerCase();
        return `${relation[2]} ${kind === "generalize" ? "->" : "..>"} ${relation[3]}: \xAB${kind}\xBB${relation[4] ?? ""}`;
      }
      return line;
    }).join("\n");
    const parsed = parseDeployment(transformed);
    const connections = parsed.connections.map((edge) => {
      if (edge.label === "\xABgeneralize\xBB") {
        const { label: _label, ...withoutLabel } = edge;
        return { ...withoutLabel, dashed: false, attributes: { ...edge.attributes, relation: "inheritance" } };
      }
      return edge.label === "\xABinclude\xBB" || edge.label === "\xABextend\xBB" ? { ...edge, attributes: { ...edge.attributes, relation: "dependency" } } : edge;
    });
    return { ...parsed, kind: "usecase", connections, source };
  }
  function parseSlide(source) {
    const decorated = withDiagramText(source, parseSlide, false);
    if (decorated) return decorated;
    const lines = meaningfulLines(source);
    const nodes = [];
    const connections = [];
    const contexts = [{}];
    let order = 0;
    const activeContext = () => contexts[contexts.length - 1] ?? contexts[0];
    const addNode = (node, line, connectable = true) => {
      assertUnique(nodes, node, line);
      node.attributes.order = String(order++);
      nodes.push(node);
      if (!connectable) return;
      const context2 = activeContext();
      if (context2.pendingArrow !== void 0 && context2.lastItemId) {
        connections.push({
          id: connectionId(context2.lastItemId, node.id, connections.length),
          from: context2.lastItemId,
          to: node.id,
          ...context2.pendingArrow ? { label: context2.pendingArrow } : {},
          dashed: false,
          order: connections.length
        });
        delete context2.pendingArrow;
      }
      context2.lastItemId = node.id;
    };
    for (const line of lines.slice(1)) {
      if (line.text === "}") {
        if (contexts.length === 1) throw new Error(`Line ${line.number}: unexpected closing brace.`);
        const closed = contexts.pop();
        if (closed?.pendingArrow !== void 0) throw new Error(`Line ${line.number}: arrow must be followed by another slide item.`);
        continue;
      }
      const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|-->)\s+([\w.-]+)(?:\s*:\s*(.+))?$/);
      if (relation) {
        const from = relation[1] ?? "";
        const to = relation[3] ?? "";
        connections.push({
          id: connectionId(from, to, connections.length),
          from,
          to,
          ...relation[4]?.trim() ? { label: unquote2(relation[4].trim(), "") } : {},
          dashed: (relation[2] ?? "").includes("--"),
          order: connections.length
        });
        continue;
      }
      const layout = line.text.match(/^(row|column|grid)(?:\s+([\w.-]+))?(?:\s*\[([^\]]+)\])?\s*\{$/i);
      if (layout) {
        const kind = layout[1]?.toLowerCase() ?? "row";
        const id = layout[2] ?? uniqueId(kind, nodes.filter((node) => node.shape === "slide-group").length);
        const attributes = { ...attributesFrom(layout[3]), layout: kind };
        const parentId = activeContext().id;
        addNode({ id, label: attributes.label ?? "", shape: "slide-group", ...parentId ? { parentId } : {}, attributes }, line.number, false);
        contexts.push({ id });
        continue;
      }
      const heading = line.text.match(/^(title|subtitle)\s+("(?:\\.|[^"])*")(?:\s*\[([^\]]+)\])?$/i);
      if (heading) {
        const kind = heading[1]?.toLowerCase() ?? "title";
        const id = uniqueId(kind, nodes.filter((node) => node.shape === `slide-${kind}`).length);
        const parentId = activeContext().id;
        addNode({ id, label: unquote2(heading[2], id), shape: `slide-${kind}`, ...parentId ? { parentId } : {}, attributes: attributesFrom(heading[3]) }, line.number, false);
        continue;
      }
      const item = line.text.match(/^(card|note|callout|badge|metric|bar|quote|milestone)\s+([\w.-]+)\s+("(?:\\.|[^"])*"|[^\s\[]+)(?:\s*\[([^\]]+)\])?$/i);
      if (item) {
        const kind = item[1]?.toLowerCase() ?? "card";
        const id = item[2] ?? "";
        const parentId = activeContext().id;
        addNode({ id, label: unquote2(item[3], id), shape: `slide-${kind}`, ...parentId ? { parentId } : {}, attributes: attributesFrom(item[4]) }, line.number);
        continue;
      }
      const arrow = line.text.match(/^arrow(?:\s*:\s*(.+))?$/i);
      if (arrow) {
        const context2 = activeContext();
        if (!context2.lastItemId) throw new Error(`Line ${line.number}: arrow must follow a slide item.`);
        if (context2.pendingArrow !== void 0) throw new Error(`Line ${line.number}: consecutive arrows are not allowed.`);
        context2.pendingArrow = arrow[1] ? unquote2(arrow[1].trim(), "") : "";
        continue;
      }
      throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
    }
    if (contexts.length > 1) throw new Error(`Slide layout "${contexts[contexts.length - 1]?.id}" is missing a closing brace.`);
    if (contexts[0]?.pendingArrow !== void 0) throw new Error("Arrow must be followed by another slide item.");
    const ids = new Set(nodes.map((node) => node.id));
    for (const edge of connections) {
      if (!ids.has(edge.from)) throw new Error(`Connection references unknown slide item "${edge.from}".`);
      if (!ids.has(edge.to)) throw new Error(`Connection references unknown slide item "${edge.to}".`);
    }
    return { kind: "slide", nodes, connections, groups: [], source };
  }
  function createDirectedGraphDiagram(name, parse, defaultLayout = "hierarchical", direction = "right") {
    return {
      name,
      defaultLayout,
      parse,
      toLayoutModel(model, context2) {
        const hidden2 = new Set(model.nodes.filter((n) => n.attributes.hidden === "true").map((n) => n.id));
        const candidates = model.nodes.filter((n) => n.attributes.removed !== "true");
        const targets = /* @__PURE__ */ new Set([...candidates.filter((n) => !hidden2.has(n.id)).map((n) => n.id), ...model.connections.filter((e) => !hidden2.has(e.from) && !hidden2.has(e.to)).map((e) => e.id)]);
        const visible = candidates.filter((n) => {
          if (!n.attributes.annotationTarget) return true;
          if (!targets.has(n.attributes.annotationTarget)) return false;
          const target = candidates.find((t) => t.id === n.attributes.annotationTarget);
          return n.attributes.annotationMember === void 0 || !JSON.parse(target?.attributes.hiddenMembers ?? "[]").includes(Number(n.attributes.annotationMember));
        });
        const ids = new Set(visible.map((n) => n.id));
        return {
          kind: model.kind,
          items: visible.map((node) => ({ ...node, size: context2.measure(node.shape, node.label, node.attributes) })),
          connections: model.connections.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => hidden2.has(e.from) || hidden2.has(e.to) || ["from", "to"].some((endpoint) => {
            const index = e.attributes?.[`${endpoint}MemberIndex`];
            return index !== void 0 && JSON.parse(model.nodes.find((n) => n.id === e[endpoint])?.attributes.hiddenMembers ?? "[]").includes(Number(index));
          }) ? { ...e, attributes: { ...e.attributes, hidden: "true" } } : e),
          groups: [],
          direction: model.direction ?? direction,
          minimumGap: context2.theme.gapY,
          labelFontSize: context2.theme.fontSize - 1
        };
      }
    };
  }
  function createFlowchartDiagram() {
    return createDirectedGraphDiagram("flowchart", parseFlowchart, "flowchart", "down");
  }
  function createGraphDiagram() {
    return {
      ...createDirectedGraphDiagram("graph", parseGraph, "graph", "down"),
      toLayoutModel(model, context2) {
        return {
          kind: model.kind,
          items: model.nodes.map((node) => ({ ...node, size: context2.measure(node.shape, node.label, node.attributes) })),
          connections: model.connections,
          groups: [],
          direction: model.direction ?? "down",
          minimumGap: context2.theme.gapY,
          labelFontSize: context2.theme.fontSize - 1
        };
      }
    };
  }
  function createActivityDiagram() {
    return createDirectedGraphDiagram("activity", parseActivity, "activity");
  }
  function createStateDiagram() {
    return createDirectedGraphDiagram("state", parseState, "graph", "down");
  }
  function createErDiagram() {
    return createDirectedGraphDiagram("er", parseEr);
  }
  function createClassDiagram() {
    return createDirectedGraphDiagram("class", parseClass, "class");
  }
  function createSlideDiagram() {
    return createDirectedGraphDiagram("slide", parseSlide, "slide");
  }
  function createDeploymentDiagram() {
    return {
      name: "deployment",
      defaultLayout: "hierarchical",
      parse: parseDeployment,
      toLayoutModel(model, context2) {
        model = componentDisplayModel(model);
        return {
          kind: model.kind,
          items: model.nodes.map((node) => ({
            ...node,
            size: context2.measure(node.shape, node.label, node.attributes)
          })),
          connections: model.connections,
          groups: model.groups,
          direction: model.direction ?? "right",
          minimumGap: context2.theme.gapY,
          labelFontSize: context2.theme.fontSize - 1
        };
      }
    };
  }
  function createComponentDiagram() {
    return {
      ...createDeploymentDiagram(),
      name: "component",
      parse: parseComponent
    };
  }
  function createUsecaseDiagram() {
    return {
      ...createDeploymentDiagram(),
      name: "usecase",
      parse: parseUsecase
    };
  }
  function createSequenceDiagram() {
    return {
      name: "sequence",
      defaultLayout: "sequence",
      parse: parseSequence,
      toLayoutModel(model, context2) {
        return {
          kind: model.kind,
          items: model.nodes.map((node) => ({ ...node, size: context2.measure(node.shape, node.label, node.attributes) })),
          connections: model.connections,
          groups: model.groups,
          direction: "down",
          minimumGap: 54,
          ...model.diagramText ? { diagramText: model.diagramText } : {},
          ...model.pageBreaks ? { pageBreaks: model.pageBreaks } : {},
          labelFontFamily: context2.theme.fontFamily,
          labelFontSize: context2.theme.fontSize - 1
        };
      }
    };
  }
  function createObjectDiagram() {
    return createDirectedGraphDiagram("object", parseObject, "class");
  }

  // src/png.ts
  async function svgToPngBlob(svg, size, defaultBackground, options = {}) {
    const scale = options.scale ?? 1;
    if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("PNG scale must be a positive number.");
    const width = Math.max(1, Math.round(size.width));
    const height = Math.max(1, Math.round(size.height));
    const clone = svg.cloneNode(true);
    const background = options.background === void 0 ? defaultBackground : options.background;
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
      const context2 = canvas.getContext("2d");
      if (!context2) throw new Error("Finch.js could not create a canvas for PNG export.");
      context2.setTransform(scale, 0, 0, scale, 0, 0);
      if (background) {
        context2.fillStyle = background;
        context2.fillRect(0, 0, width, height);
      }
      context2.drawImage(image, 0, 0, width, height);
      return await canvasToBlob(canvas);
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Finch.js could not render the SVG for PNG export."));
      image.src = url;
    });
  }
  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Finch.js could not encode the diagram as PNG."));
      }, "image/png");
    });
  }
  function svgMarkupToPngBlob(markup, document, options = {}) {
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    if (parsed.querySelector("parsererror")) throw new Error("Invalid page SVG.");
    const svg = document.importNode(parsed.documentElement, true);
    return svgToPngBlob(svg, { width: Number(svg.getAttribute("width")), height: Number(svg.getAttribute("height")) }, svg.style.backgroundColor || svg.style.background || "transparent", options);
  }

  // src/markdown.ts
  var layoutStart = /^' @finch-layout(?:\s.*)?$/;
  var layoutEnd = "' @end-finch-layout";
  function parseMarkdown(markdown) {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const diagrams = [];
    let fence;
    for (const line of lines) {
      if (fence) {
        const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
        if (close && close[1][0] === fence.character && close[1].length >= fence.length) {
          if (fence.finch) diagrams.push(readDiagram(fence.lines.join("\n")));
          fence = void 0;
        } else {
          const indent = Math.min(fence.indent, /^ */.exec(line)[0].length);
          fence.lines.push(line.slice(indent));
        }
        continue;
      }
      const open = /^( {0,3})(`{3,}|~{3,})([^\n]*)$/.exec(line);
      if (!open || open[2][0] === "`" && open[3].includes("`")) continue;
      const language = open[3].trim().split(/\s+/)[0];
      fence = {
        character: open[2][0],
        length: open[2].length,
        indent: open[1].length,
        finch: language === "finch" || language === "finchjs" || language === "finch.js",
        lines: []
      };
    }
    if (fence?.finch) throw new Error("Finch \u306E\u30B3\u30FC\u30C9\u30D5\u30A7\u30F3\u30B9\u304C\u9589\u3058\u3089\u308C\u3066\u3044\u307E\u305B\u3093\u3002");
    return diagrams;
  }
  function readDiagram(body) {
    const lines = body.split("\n");
    const start = lines.findIndex((line) => layoutStart.test(line));
    if (start < 0) {
      if (lines.includes(layoutEnd)) throw new Error("Finch \u306E\u5EA7\u6A19\u306E\u958B\u59CB\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
      return { source: body };
    }
    const end = lines.indexOf(layoutEnd, start + 1);
    if (end < 0 || lines.slice(end + 1).some((line) => line.trim())) {
      throw new Error("Finch \u306E\u5EA7\u6A19\u306F\u3001\u56F3\u306E\u30BD\u30FC\u30B9\u306E\u3042\u3068\u306B\u4E00\u3064\u3060\u3051\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    const json = lines.slice(start + 1, end).map((line) => {
      if (!line.startsWith("' ")) throw new Error("Finch \u306E\u5EA7\u6A19\u306E\u884C\u306F\u3001\u30A2\u30DD\u30B9\u30C8\u30ED\u30D5\u30A3\u3068\u7A7A\u767D\u3067\u59CB\u3081\u3066\u304F\u3060\u3055\u3044\u3002");
      return line.slice(2);
    }).join("\n");
    const overlay = readOverlay(json);
    return { source: lines.slice(0, start).join("\n"), overlay };
  }
  function readOverlay(json) {
    const raw = JSON.parse(json);
    if (!raw || !raw.nodes || typeof raw.nodes !== "object" || Array.isArray(raw.nodes)) {
      throw new Error("Finch \u306E\u5EA7\u6A19\u306B\u306F nodes \u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u304C\u5FC5\u8981\u3067\u3059\u3002");
    }
    if (raw.editable !== void 0 && typeof raw.editable !== "boolean") {
      throw new Error("Finch \u306E editable \u306B\u306F true \u307E\u305F\u306F false \u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    for (const node of Object.values(raw.nodes)) {
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y) || typeof node.manual !== "boolean" || typeof node.pinned !== "boolean" || node.width !== void 0 && (!Number.isFinite(node.width) || node.width <= 0) || node.height !== void 0 && (!Number.isFinite(node.height) || node.height <= 0)) {
        throw new Error("Finch \u306E\u5EA7\u6A19\u306E\u5024\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093\u3002");
      }
    }
    return parseOverlay(raw);
  }
  function writeMarkdown(source, overlay) {
    if (source.split(/\r?\n/).some((line) => layoutStart.test(line))) {
      throw new Error("\u56F3\u306E\u30BD\u30FC\u30B9\u306B Finch \u306E\u5EA7\u6A19\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002parseMarkdown() \u3067\u5206\u3051\u3066\u304F\u3060\u3055\u3044\u3002");
    }
    const fence = "`".repeat(Math.max(3, ...Array.from(source.matchAll(/`+/g), (match) => match[0].length + 1)));
    const json = JSON.stringify(overlay, null, 2).split("\n").map((line) => `' ${line}`).join("\n");
    return `${fence}finch
${source}
' @finch-layout \u5EA7\u6A19\u3092\u623B\u3059\u3002\u30CE\u30FC\u30C9\u306E\u4F4D\u7F6E\u3068\u5927\u304D\u3055\u3092\u4FDD\u5B58\u3057\u307E\u3059\u3002
${json}
${layoutEnd}
${fence}
`;
  }

  // src/document-save.ts
  var documents = /* @__PURE__ */ new WeakMap();
  var marker = "data-finch-document-id";
  var selector = 'script[type="application/json"][data-finch-document]';
  function context(document) {
    let value = documents.get(document);
    if (!value) {
      value = { instances: /* @__PURE__ */ new Map() };
      documents.set(document, value);
    }
    return value;
  }
  function restoreDocument(host) {
    const key = host.getAttribute(marker) ?? (host.id ? `id:${host.id}` : void 0);
    if (!key) return;
    const text = host.ownerDocument.querySelector(selector)?.textContent;
    if (!text) return;
    const saved = JSON.parse(text);
    if (saved.version !== 1) throw new Error("Unsupported Finch HTML document version.");
    return saved.diagrams[key];
  }
  function registerDocument(instance) {
    const host = instance.host;
    if (!host) return;
    const state = context(host.ownerDocument);
    let key = host.getAttribute(marker) ?? (host.id ? `id:${host.id}` : void 0);
    if (!key) {
      let index = 1;
      do {
        key = `diagram:${index++}`;
      } while ([...host.ownerDocument.querySelectorAll(`[${marker}]`)].some((el) => el.getAttribute(marker) === key));
    }
    host.setAttribute(marker, key);
    state.instances.set(key, instance);
  }
  function unregisterDocument(instance) {
    if (!instance.host) return;
    const state = context(instance.host.ownerDocument);
    const key = instance.host.getAttribute(marker);
    if (state.instances.get(key) === instance) state.instances.delete(key);
  }
  function exportDocument(document, overrides = /* @__PURE__ */ new Map()) {
    const clone = document.documentElement.cloneNode(true);
    const diagrams = {};
    for (const [key, instance] of context(document).instances) {
      if (!instance.host?.isConnected) continue;
      diagrams[key] = overrides.get(instance) ?? instance.exportState();
      const host = [...clone.querySelectorAll(`[${marker}]`)].find((el) => el.getAttribute(marker) === key);
      if (host) {
        const index = [...instance.host.children].indexOf(instance.svg);
        host.children[index]?.remove();
        host.classList.remove("finch-editor-host", "finch-editor-open");
      }
    }
    clone.querySelectorAll(`.finch-editor, #finch-editor-styles, ${selector}`).forEach((el) => el.remove());
    const data2 = document.createElement("script");
    data2.type = "application/json";
    data2.setAttribute("data-finch-document", "");
    data2.textContent = JSON.stringify({ version: 1, diagrams }).replace(/</g, "\\u003c");
    clone.querySelector("head").prepend(data2);
    const existingBase = clone.querySelector("base[href]");
    if (existingBase) existingBase.href = document.baseURI;
    else {
      const base = document.createElement("base");
      base.href = document.baseURI;
      clone.querySelector("head").prepend(base);
    }
    return `<!DOCTYPE html>
${clone.outerHTML}`;
  }
  function saveDocument(document, filename, saveAs = false, overrides) {
    const state = context(document);
    if (state.saving) return Promise.reject(new Error("\u5225\u306E\u56F3\u306EHTML\u4FDD\u5B58\u304C\u9032\u884C\u4E2D\u3067\u3059\u3002\u5B8C\u4E86\u5F8C\u306B\u3082\u3046\u4E00\u5EA6\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044\u3002"));
    const view = document.defaultView;
    const name = filename ?? decodeURIComponent(view?.location.pathname.split("/").pop() || "diagram.html").replace(/\.[^.]+$/, "") + ".html";
    const selected = view?.showSaveFilePicker && (!state.handle || saveAs) ? view.showSaveFilePicker({ suggestedName: name, ...state.handle ? { startIn: state.handle } : {}, types: [{ description: "HTML document", accept: { "text/html": [".html"] } }] }) : void 0;
    const html = exportDocument(document, overrides);
    const operation = async () => {
      const handle = selected ? await selected : state.handle;
      if (handle) {
        const writable = await handle.createWritable();
        try {
          await writable.write(html);
          await writable.close();
        } catch (cause) {
          await writable.abort().catch(() => {
          });
          throw cause;
        }
        state.handle = handle;
        return "saved";
      }
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      view?.setTimeout(() => URL.revokeObjectURL(url), 6e4);
      return "downloaded";
    };
    state.saving = operation().finally(() => {
      delete state.saving;
    });
    return state.saving;
  }

  // src/instance.ts
  var DiagramInstance = class {
    constructor(source, options, registry) {
      __publicField(this, "host");
      __publicField(this, "sourceValue");
      __publicField(this, "preprocessSnapshot");
      __publicField(this, "registry");
      __publicField(this, "options");
      __publicField(this, "modelValue");
      __publicField(this, "geometryValue");
      __publicField(this, "overlayValue");
      __publicField(this, "editableValue", true);
      __publicField(this, "rendererValue");
      __publicField(this, "themeValue");
      __publicField(this, "layoutName", "");
      __publicField(this, "selectedIds", /* @__PURE__ */ new Set());
      __publicField(this, "layoutHistory", []);
      __publicField(this, "drag");
      __publicField(this, "pan");
      __publicField(this, "spacePressed", false);
      __publicField(this, "zoomValue", 1);
      __publicField(this, "zoomMode", "auto");
      __publicField(this, "resizeObserver");
      __publicField(this, "containerMinimumSizes", /* @__PURE__ */ new Map());
      __publicField(this, "destroyed", false);
      this.registry = registry;
      this.sourceValue = source;
      this.options = options;
      this.host = resolveTarget(options.target);
      const saved = this.host ? restoreDocument(this.host) : void 0;
      if (saved) {
        this.sourceValue = saved.source;
        options = { ...options, ...saved.theme ? { theme: saved.theme } : {}, overlay: saved.overlay, ...saved.preprocess ? { preprocess: restorePreprocess(saved.preprocess) } : {} };
        this.options = options;
      }
      this.overlayValue = parseOverlay(options.overlay);
      this.editableValue = options.overlay === void 0 ? options.editable ?? true : this.overlayValue.editable ?? options.editable ?? true;
      this.overlayValue.editable = this.editableValue;
      if (this.frozen) this.overlayValue.editable = this.editableValue = false;
      if (typeof options.zoom === "number") {
        this.zoomValue = options.zoom;
        this.zoomMode = "manual";
      } else if (options.zoom === "fit") this.zoomMode = "diagram";
      else if (options.zoom === "width") this.zoomMode = "width";
      this.rebuild({ force: false, preservePinned: true });
      registerDocument(this);
    }
    get svg() {
      return this.rendererValue.svg;
    }
    get source() {
      return this.sourceValue;
    }
    get model() {
      return this.modelValue;
    }
    get geometry() {
      return this.geometryValue;
    }
    get overlay() {
      return cloneOverlay(this.overlayValue);
    }
    get selection() {
      return [...this.selectedIds];
    }
    get zoom() {
      return this.zoomValue;
    }
    get editable() {
      return this.editableValue;
    }
    get frozen() {
      return this.overlayValue.frozen === true;
    }
    freeze() {
      this.assertActive();
      if (this.frozen) return this;
      const wasEditable = this.editableValue;
      this.overlayValue.frozen = true;
      this.setEditable(false);
      if (!wasEditable) this.emitLayoutChange([]);
      return this;
    }
    get canUndo() {
      return this.layoutHistory.length > 0;
    }
    get viewportMode() {
      return this.zoomMode;
    }
    setZoom(zoom) {
      this.assertActive();
      this.zoomMode = "manual";
      this.applyZoom(zoom, true);
      return this;
    }
    zoomIn(factor = 1.1) {
      return this.setZoom(this.zoomValue * Math.max(1.01, factor));
    }
    zoomOut(factor = 1.1) {
      return this.setZoom(this.zoomValue / Math.max(1.01, factor));
    }
    resetZoom() {
      return this.setZoom(1);
    }
    fit(mode = "diagram") {
      this.assertActive();
      if (!this.editableValue) return this;
      this.zoomMode = mode;
      this.applyViewport(true);
      const host = this.scrollHost();
      if (host) {
        host.scrollLeft = 0;
        host.scrollTop = 0;
      }
      return this;
    }
    update(source) {
      this.assertActive();
      const previousKind = this.modelValue.kind;
      const prepared = this.options.preprocess ? snapshotPreprocess(source, this.options.preprocess) : { source };
      const expanded = prepared.source;
      const nextKind = getDiagramKind(expanded);
      this.registry.diagram(nextKind).parse(expanded);
      this.sourceValue = source;
      if (previousKind !== nextKind) {
        this.overlayValue.diagram = nextKind;
        this.layoutHistory = [];
        this.selectedIds.clear();
      }
      this.rebuild({ force: false, preservePinned: true }, prepared);
      return this;
    }
    setTheme(theme) {
      this.assertActive();
      this.options = { ...this.options, theme };
      this.rebuild({ force: false, preservePinned: true });
      return this;
    }
    setLayout(layout) {
      this.assertActive();
      if (!this.editableValue) return this;
      this.options = { ...this.options, layout };
      this.rebuild({ force: true, preservePinned: true });
      return this;
    }
    select(ids, additive = false) {
      if (!this.editableValue) return this;
      const values = typeof ids === "string" ? [ids] : ids;
      if (!additive) this.selectedIds.clear();
      const valid = new Set(this.geometryValue.nodes.map((node) => node.id));
      for (const id of values) if (valid.has(id)) this.selectedIds.add(id);
      this.rendererValue.setSelection(this.selectedIds);
      return this;
    }
    clearSelection() {
      this.selectedIds.clear();
      this.rendererValue.setSelection(this.selectedIds);
      return this;
    }
    pin(ids = this.selection) {
      if (!this.editableValue) return this;
      return this.setPin(ids, true);
    }
    unpin(ids = this.selection) {
      if (!this.editableValue) return this;
      return this.setPin(ids, false);
    }
    isPinned(id) {
      return this.overlayValue.nodes[id]?.pinned ?? false;
    }
    autoLayout(options = {}) {
      this.assertActive();
      if (!this.editableValue) return this;
      this.rememberLayout();
      const preservePinned = options.preservePinned ?? true;
      for (const [id, state] of Object.entries(this.overlayValue.nodes)) {
        if (!preservePinned || !state.pinned) delete this.overlayValue.nodes[id];
      }
      this.rebuild({ force: true, preservePinned });
      this.emitLayoutChange(this.geometryValue.nodes.map((node) => node.id));
      return this;
    }
    resetLayout() {
      if (!this.editableValue) return this;
      this.rememberLayout();
      this.overlayValue = createOverlay(this.editableValue);
      this.rebuild({ force: true, preservePinned: false });
      this.emitLayoutChange(this.geometryValue.nodes.map((node) => node.id));
      return this;
    }
    exportLayout(space = 2) {
      const activeIds = new Set(this.geometryValue.nodes.map((node) => node.id));
      const nodes = Object.fromEntries(Object.entries(this.overlayValue.nodes).filter(([id]) => activeIds.has(id)));
      return JSON.stringify({
        version: 1,
        diagram: this.modelValue.kind,
        editable: this.editableValue,
        ...this.overlayValue.frozen !== void 0 ? { frozen: this.frozen } : {},
        nodes
      }, null, space);
    }
    exportMarkdown() {
      const nodes = Object.fromEntries(this.geometryValue.nodes.map((node) => [node.id, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        manual: this.overlayValue.nodes[node.id]?.manual ?? false,
        pinned: this.overlayValue.nodes[node.id]?.pinned ?? false
      }]));
      return writeMarkdown(this.preprocessSnapshot ? preprocess(this.sourceValue, restorePreprocess(this.preprocessSnapshot)) : this.sourceValue, {
        version: 1,
        diagram: this.modelValue.kind,
        editable: this.editableValue,
        nodes,
        ...this.overlayValue.frozen !== void 0 ? { frozen: this.frozen } : {}
      });
    }
    exportState() {
      const overlay = JSON.parse(this.exportLayout());
      overlay.nodes = Object.fromEntries(this.geometryValue.nodes.map((node) => [node.id, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        manual: this.overlayValue.nodes[node.id]?.manual ?? false,
        pinned: this.overlayValue.nodes[node.id]?.pinned ?? false
      }]));
      return { source: this.sourceValue, theme: JSON.parse(JSON.stringify(this.themeValue)), overlay, markdown: writeMarkdown(this.preprocessSnapshot ? preprocess(this.sourceValue, restorePreprocess(this.preprocessSnapshot)) : this.sourceValue, overlay), ...this.preprocessSnapshot ? { preprocess: JSON.parse(JSON.stringify(this.preprocessSnapshot)) } : {} };
    }
    /** Notify a committed edit. Host updates and layout imports do not call this. */
    notifyChange() {
      this.options.onChange?.(this.exportState());
    }
    importLayout(layout) {
      const overlay = parseOverlay(layout);
      overlay.diagram = this.modelValue.kind;
      this.editableValue = overlay.frozen === true ? false : overlay.editable ?? true;
      this.drag = void 0;
      this.pan = void 0;
      this.spacePressed = false;
      this.selectedIds.clear();
      overlay.editable = this.editableValue;
      this.overlayValue = overlay;
      this.layoutHistory = [];
      this.rebuild({ force: false, preservePinned: true });
      return this;
    }
    undoLayout() {
      this.assertActive();
      if (!this.editableValue || !this.layoutHistory.length) return this;
      const current = this.overlayValue;
      const previous = this.layoutHistory.pop();
      previous.editable = this.editableValue;
      this.overlayValue = previous;
      this.rebuild({ force: false, preservePinned: true });
      const changedNodeIds = [.../* @__PURE__ */ new Set([...Object.keys(current.nodes), ...Object.keys(previous.nodes)])].filter((id) => JSON.stringify(current.nodes[id]) !== JSON.stringify(previous.nodes[id]));
      this.emitLayoutChange(changedNodeIds);
      return this;
    }
    setEditable(editable) {
      this.assertActive();
      if (this.frozen && editable) return this;
      if (this.editableValue === editable) return this;
      this.editableValue = editable;
      this.overlayValue.editable = editable;
      this.drag = void 0;
      this.pan = void 0;
      this.spacePressed = false;
      if (!editable) this.clearSelection();
      this.applyEditState();
      const detail = { editable, overlay: this.overlay };
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:editchange", { detail, bubbles: true }));
      this.emitLayoutChange([]);
      return this;
    }
    saveLayout(target) {
      const json = this.exportLayout();
      let element = null;
      if (typeof target === "string") element = this.svg.ownerDocument.querySelector(target);
      else if (target) element = target;
      else if (this.host) element = this.host.parentElement?.querySelector("script[type='application/json'][data-finch-layout]") ?? null;
      if (element) {
        element.type = "application/json";
        element.dataset.finchLayout = "";
        element.textContent = json;
      }
      return json;
    }
    toSvgPages() {
      this.assertActive();
      return sequencePageSvgs(this.svg, this.geometryValue, this.themeValue);
    }
    toSvgString() {
      const clone = this.svg.cloneNode(true);
      for (const control of clone.querySelectorAll("[data-finch-editor-trigger]")) control.remove();
      return new XMLSerializer().serializeToString(clone);
    }
    async toEmbeddedSvgString() {
      const clone = this.svg.cloneNode(true);
      for (const control of clone.querySelectorAll("[data-finch-editor-trigger]")) control.remove();
      await embedImages(clone);
      return new XMLSerializer().serializeToString(clone);
    }
    async downloadSvg(filename = `${this.modelValue.kind}.svg`) {
      this.assertActive();
      const blob = new Blob([await this.toEmbeddedSvgString()], { type: "image/svg+xml;charset=utf-8" });
      this.downloadBlob(blob, filename);
    }
    async toPngPages(options = {}) {
      this.assertActive();
      const pages = this.toSvgPages();
      const document = this.svg.ownerDocument;
      const results = [];
      for (const text of pages) {
        results.push(await svgMarkupToPngBlob(text, document, options));
      }
      return results;
    }
    toPngBlob(options = {}) {
      this.assertActive();
      return svgToPngBlob(this.svg, this.geometryValue, this.themeValue.canvasColor, options);
    }
    async downloadPng(filename = `${this.modelValue.kind}.png`, options = {}) {
      const blob = await this.toPngBlob(options);
      this.downloadBlob(blob, filename);
    }
    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = this.svg.ownerDocument.createElement("a");
      link.href = url;
      link.download = filename;
      link.style.display = "none";
      this.svg.ownerDocument.body?.append(link);
      try {
        link.click();
      } finally {
        link.remove();
        const view = this.svg.ownerDocument.defaultView;
        (view?.setTimeout ?? setTimeout)(() => URL.revokeObjectURL(url), 0);
      }
    }
    destroy() {
      if (this.destroyed) return;
      unregisterDocument(this);
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:destroy", { bubbles: true }));
      this.rendererValue.svg.remove();
      this.resizeObserver?.disconnect();
      this.selectedIds.clear();
      this.destroyed = true;
    }
    rebuild(layoutOptions, supplied) {
      this.assertNotDestroyed();
      const prepared = supplied ?? (this.options.preprocess ? snapshotPreprocess(this.sourceValue, this.preprocessSnapshot ? restorePreprocess(this.preprocessSnapshot) : this.options.preprocess) : void 0);
      this.preprocessSnapshot = prepared?.snapshot;
      const expanded = prepared?.source ?? this.sourceValue;
      const kind = getDiagramKind(expanded);
      const diagram = this.registry.diagram(kind);
      this.themeValue = typeof this.options.theme === "object" ? this.options.theme : this.registry.theme(this.options.theme ?? "default");
      this.modelValue = diagram.parse(expanded);
      this.modelValue.source = this.sourceValue;
      const layoutModel = diagram.toLayoutModel(this.modelValue, {
        theme: this.themeValue,
        measure: (shape, label, attributes) => withNodeIcon(this.registry.shape(shape), (name) => this.registry.icon(name)).measure({ label, attributes, theme: this.themeValue })
      });
      if (this.options.stateTransitions === "group") groupStateTransitions(layoutModel);
      this.layoutName = this.options.layout ?? diagram.defaultLayout;
      const previous = this.geometryValue?.kind === kind ? this.geometryValue : void 0;
      const layout = this.registry.layout(this.layoutName);
      this.containerMinimumSizes = new Map(layoutModel.items.filter((item) => item.shape === "container").map((item) => [item.id, { width: item.size.width, height: item.size.height }]));
      const annotations = layoutModel.items.filter((item) => item.attributes.annotationTarget);
      this.geometryValue = layout.layout({ ...layoutModel, items: layoutModel.items.filter((item) => !item.attributes.annotationTarget || item.attributes.associationClass) }, {
        overlay: this.overlayValue,
        ...previous ? { previous } : {},
        force: layoutOptions.force,
        preservePinned: layoutOptions.preservePinned
      });
      if (this.options.expandRoutingChannels !== false) expandRoutingChannels(this.geometryValue, this.overlayValue, rerouteGeometry);
      if (kind !== "sequence" && this.modelValue.diagramText) this.geometryValue.diagramText = measureDiagramText(this.modelValue.diagramText, this.themeValue.fontSize - 1, this.themeValue.fontFamily);
      const contentNodes = this.geometryValue.nodes.filter((node) => !node.attributes.annotationTarget);
      const noteY = { left: 28, right: 28, top: Math.min(28, ...contentNodes.map((node) => node.y), ...this.geometryValue.groups.map((group) => group.y)) - 24, bottom: this.geometryValue.height + 24 };
      const noteX = this.geometryValue.width + 24;
      for (const item of annotations) {
        const targetNode = this.geometryValue.nodes.find((node2) => node2.id === item.attributes.annotationTarget);
        const targetEdge = this.geometryValue.edges.find((edge) => edge.id === item.attributes.annotationTarget);
        const anchor = targetNode ? annotationAnchor(targetNode, item.attributes.annotationMember) : targetEdge ? routeMidpoint(targetEdge.points) : { x: 28, y: 28 };
        const left = item.attributes.annotationSide === "left";
        const side = item.attributes.annotationSide ?? "right";
        const vertical = side === "top" || side === "bottom";
        if (left && targetNode) anchor.x = targetNode.x;
        if (vertical && targetNode) {
          anchor.x = targetNode.x + targetNode.width / 2;
          anchor.y = targetNode.y + (side === "bottom" ? targetNode.height : 0);
        }
        const preferredX = vertical ? anchor.x - item.size.width / 2 : left ? Math.min(...this.geometryValue.nodes.filter((node2) => !node2.attributes.annotationTarget).map((node2) => node2.x), ...this.geometryValue.groups.map((group) => group.x)) - item.size.width - 24 : noteX;
        const saved = this.overlayValue.nodes[item.id];
        const node = this.geometryValue.nodes.find((n) => n.id === item.id) ?? { ...item, ...item.size, x: saved && (!layoutOptions.force || saved.pinned) ? saved.x : preferredX, y: saved && (!layoutOptions.force || saved.pinned) ? saved.y : side === "top" ? noteY.top - item.size.height : side === "bottom" ? noteY.bottom : Math.max(noteY[side], anchor.y - item.size.height / 2) };
        if (!this.geometryValue.nodes.some((n) => n.id === node.id)) this.geometryValue.nodes.push(node);
        this.geometryValue.edges.push({ id: `${item.id}-link`, from: targetNode?.id ?? targetEdge?.from ?? item.id, to: item.id, dashed: true, order: this.geometryValue.edges.length, attributes: { annotation: "true" }, points: [anchor, { x: node.x + (vertical ? node.width / 2 : left ? node.width : 0), y: node.y + (side === "top" ? node.height : side === "bottom" ? 0 : node.height / 2) }] });
        noteY[side] = side === "top" ? Math.min(noteY.top, node.y - 24) : Math.max(noteY[side], node.y + node.height + 24);
        this.geometryValue.width = Math.max(this.geometryValue.width, node.x + node.width + 28);
        this.geometryValue.height = Math.max(this.geometryValue.height, noteY[side]);
      }
      this.overlayValue.diagram = kind;
      this.overlayValue.editable = this.editableValue;
      const document = this.host?.ownerDocument ?? globalThis.document;
      if (!document) throw new Error("Finch.render() requires a browser Document or a target Element.");
      const nextRenderer = new SvgRenderer(document, this.themeValue, (name) => withNodeIcon(this.registry.shape(name), (icon) => this.registry.icon(icon)), this.options.ariaLabel ?? `${kind} diagram`);
      nextRenderer.draw(this.geometryValue);
      const oldSvg = this.rendererValue?.svg;
      this.rendererValue = nextRenderer;
      if (this.host) {
        if (oldSvg?.parentElement === this.host) oldSvg.replaceWith(nextRenderer.svg);
        else this.host.replaceChildren(nextRenderer.svg);
      }
      this.bindInteractions();
      const active = new Set(this.geometryValue.nodes.map((node) => node.id));
      this.selectedIds = new Set([...this.selectedIds].filter((id) => active.has(id)));
      this.rendererValue.setSelection(this.selectedIds);
      for (const [id, state] of Object.entries(this.overlayValue.nodes)) this.rendererValue.setPinned(id, state.pinned);
      this.applyViewport(false);
      this.observeHost();
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:render", { bubbles: true }));
    }
    bindInteractions() {
      this.applyEditState();
      if (this.options.interactive === false) return;
      const svg = this.rendererValue.svg;
      svg.addEventListener("pointerdown", (event) => this.onPointerDown(event));
      svg.addEventListener("pointermove", (event) => this.onPointerMove(event));
      svg.addEventListener("pointerup", (event) => this.onPointerUp(event));
      svg.addEventListener("pointercancel", (event) => this.onPointerUp(event));
      svg.addEventListener("wheel", (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        this.zoomMode = "manual";
        this.applyZoom(this.zoomValue * (event.deltaY < 0 ? 1.1 : 1 / 1.1), true, { clientX: event.clientX, clientY: event.clientY });
      }, { passive: false });
      svg.addEventListener("dblclick", (event) => {
        if (!this.editableValue) return;
        const id = this.rendererValue.nodeIdFromTarget(event.target);
        if (id) this.setPin(id, !this.isPinned(id));
      });
      svg.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.clearSelection();
        if (this.editableValue && event.key.toLowerCase() === "p" && this.selectedIds.size) this.pin();
        if (event.key === " ") {
          this.spacePressed = true;
          event.preventDefault();
        }
        if (event.key === "+" || event.key === "=") this.zoomIn();
        if (event.key === "-") this.zoomOut();
        if (event.key === "0") this.resetZoom();
        if (event.key.toLowerCase() === "f") this.fit("diagram");
      });
      svg.addEventListener("keyup", (event) => {
        if (event.key === " ") this.spacePressed = false;
      });
      svg.addEventListener("blur", () => {
        this.spacePressed = false;
      });
    }
    onPointerDown(event) {
      const scrollHost = this.scrollHost();
      if (scrollHost && (event.button === 1 || event.button === 0 && (!this.editableValue || this.spacePressed || event.altKey))) {
        this.pan = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          scrollLeft: scrollHost.scrollLeft,
          scrollTop: scrollHost.scrollTop
        };
        this.rendererValue.svg.classList.add("is-panning");
        this.rendererValue.svg.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (!this.editableValue) return;
      if (event.button !== 0) return;
      const id = this.rendererValue.nodeIdFromTarget(event.target);
      if (!id) {
        if (!event.ctrlKey && !event.metaKey) this.clearSelection();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        if (this.selectedIds.has(id)) this.selectedIds.delete(id);
        else this.selectedIds.add(id);
      } else if (!this.selectedIds.has(id)) {
        this.selectedIds = /* @__PURE__ */ new Set([id]);
      }
      this.rendererValue.setSelection(this.selectedIds);
      const movingIds = this.withContainerDescendants(this.selectedIds);
      const origins = /* @__PURE__ */ new Map();
      for (const node of this.geometryValue.nodes) if (movingIds.has(node.id)) origins.set(node.id, { x: node.x, y: node.y });
      this.drag = {
        pointerId: event.pointerId,
        start: this.rendererValue.clientPoint(event),
        origins,
        resizedContainerIds: /* @__PURE__ */ new Set(),
        moved: false
      };
      this.rendererValue.svg.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
    onPointerMove(event) {
      if (this.pan && this.pan.pointerId === event.pointerId) {
        const host = this.scrollHost();
        if (host) {
          host.scrollLeft = this.pan.scrollLeft - (event.clientX - this.pan.clientX);
          host.scrollTop = this.pan.scrollTop - (event.clientY - this.pan.clientY);
        }
        return;
      }
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const point = this.rendererValue.clientPoint(event);
      const dx = point.x - this.drag.start.x;
      const dy = point.y - this.drag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) this.drag.moved = true;
      const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
      for (const [id, origin] of this.drag.origins) {
        const node = map.get(id);
        if (!node) continue;
        node.x = Math.max(8, origin.x + dx);
        node.y = Math.max(8, origin.y + dy);
      }
      for (const id of resizeAncestorContainers(
        this.geometryValue.nodes,
        this.drag.origins.keys(),
        this.containerMinimumSizes
      )) {
        this.drag.resizedContainerIds.add(id);
      }
      rerouteGeometry(this.geometryValue);
      this.rendererValue.updateGeometry(this.geometryValue);
    }
    onPointerUp(event) {
      if (this.pan && this.pan.pointerId === event.pointerId) {
        this.pan = void 0;
        this.rendererValue.svg.classList.remove("is-panning");
        if (this.rendererValue.svg.hasPointerCapture(event.pointerId)) this.rendererValue.svg.releasePointerCapture(event.pointerId);
        return;
      }
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      const drag = this.drag;
      this.drag = void 0;
      if (this.rendererValue.svg.hasPointerCapture(event.pointerId)) this.rendererValue.svg.releasePointerCapture(event.pointerId);
      if (!drag.moved) return;
      this.rememberLayout();
      const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
      for (const id of drag.origins.keys()) {
        const node = map.get(id);
        if (!node) continue;
        const previous = this.overlayValue.nodes[id];
        this.overlayValue.nodes[id] = {
          x: node.x,
          y: node.y,
          manual: true,
          pinned: previous?.pinned ?? false,
          ...previous?.width ? { width: previous.width } : {},
          ...previous?.height ? { height: previous.height } : {}
        };
      }
      for (const id of drag.resizedContainerIds) {
        if (drag.origins.has(id)) continue;
        const node = map.get(id);
        if (!node) continue;
        const previous = this.overlayValue.nodes[id];
        this.overlayValue.nodes[id] = {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
          manual: true,
          pinned: previous?.pinned ?? false
        };
      }
      this.emitLayoutChange([.../* @__PURE__ */ new Set([...drag.origins.keys(), ...drag.resizedContainerIds])]);
    }
    setPin(ids, pinned) {
      if (!this.editableValue) return this;
      const values = typeof ids === "string" ? [ids] : ids;
      const map = new Map(this.geometryValue.nodes.map((node) => [node.id, node]));
      const changed = values.filter((id) => map.has(id) && this.isPinned(id) !== pinned);
      if (!changed.length) return this;
      this.rememberLayout();
      for (const id of changed) {
        const node = map.get(id);
        if (!node) continue;
        const existing = this.overlayValue.nodes[id];
        this.overlayValue.nodes[id] = {
          x: existing?.x ?? node.x,
          y: existing?.y ?? node.y,
          manual: existing?.manual ?? false,
          pinned,
          ...existing?.width ? { width: existing.width } : {},
          ...existing?.height ? { height: existing.height } : {}
        };
        this.rendererValue.setPinned(id, pinned);
      }
      this.emitLayoutChange(changed);
      return this;
    }
    rememberLayout() {
      this.layoutHistory.push(cloneOverlay(this.overlayValue));
    }
    withContainerDescendants(ids) {
      const result = new Set(ids);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of this.geometryValue.nodes) {
          if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
            result.add(node.id);
            changed = true;
          }
        }
      }
      return result;
    }
    emitLayoutChange(changedNodeIds) {
      const detail = { overlay: this.overlay, changedNodeIds };
      this.rendererValue.svg.dispatchEvent(new CustomEvent("finch:layoutchange", { detail, bubbles: true }));
      if (changedNodeIds.length) this.notifyChange();
    }
    applyEditState() {
      const svg = this.rendererValue?.svg;
      if (!svg) return;
      svg.dataset.editable = String(this.editableValue);
      svg.classList.toggle("is-view-only", !this.editableValue);
    }
    applyViewport(emit) {
      const host = this.scrollHost();
      const style = host ? this.rendererValue.svg.ownerDocument.defaultView?.getComputedStyle(host) : void 0;
      const horizontalPadding = (Number.parseFloat(style?.paddingLeft ?? "0") || 0) + (Number.parseFloat(style?.paddingRight ?? "0") || 0);
      const verticalPadding = (Number.parseFloat(style?.paddingTop ?? "0") || 0) + (Number.parseFloat(style?.paddingBottom ?? "0") || 0);
      const availableWidth = Math.max(1, (host?.clientWidth ?? this.geometryValue.width) - horizontalPadding);
      const availableHeight = Math.max(1, (host?.clientHeight ?? this.geometryValue.height) - verticalPadding);
      let zoom = this.zoomValue;
      if (this.zoomMode === "auto") zoom = Math.min(1, availableWidth / this.geometryValue.width);
      if (this.zoomMode === "width") zoom = availableWidth / this.geometryValue.width;
      if (this.zoomMode === "diagram") zoom = Math.min(availableWidth / this.geometryValue.width, availableHeight / this.geometryValue.height);
      this.applyZoom(zoom, emit);
    }
    applyZoom(zoom, emit, anchor) {
      const minimum = Math.max(0.05, this.options.minZoom ?? 0.25);
      const maximum = Math.max(minimum, this.options.maxZoom ?? 2);
      const next = Math.max(minimum, Math.min(maximum, Number.isFinite(zoom) ? zoom : 1));
      const host = this.scrollHost();
      const hostRect = host?.getBoundingClientRect();
      const viewportX = anchor && hostRect ? anchor.clientX - hostRect.left : (host?.clientWidth ?? 0) / 2;
      const viewportY = anchor && hostRect ? anchor.clientY - hostRect.top : (host?.clientHeight ?? 0) / 2;
      const contentX = host ? (host.scrollLeft + viewportX) / this.zoomValue : 0;
      const contentY = host ? (host.scrollTop + viewportY) / this.zoomValue : 0;
      this.zoomValue = next;
      const svg = this.rendererValue.svg;
      svg.style.width = `${this.geometryValue.width * next}px`;
      svg.style.height = `${this.geometryValue.height * next}px`;
      svg.style.minWidth = "0";
      svg.style.maxWidth = "none";
      svg.dataset.zoom = String(next);
      if (host && anchor) {
        host.scrollLeft = Math.max(0, contentX * next - viewportX);
        host.scrollTop = Math.max(0, contentY * next - viewportY);
      }
      if (emit) {
        const detail = { zoom: next, mode: this.zoomMode };
        svg.dispatchEvent(new CustomEvent("finch:zoomchange", { detail, bubbles: true }));
      }
    }
    observeHost() {
      this.resizeObserver?.disconnect();
      const host = this.scrollHost();
      const ResizeObserverConstructor = this.rendererValue.svg.ownerDocument.defaultView?.ResizeObserver;
      if (!host || !ResizeObserverConstructor) return;
      this.resizeObserver = new ResizeObserverConstructor(() => {
        if (this.zoomMode !== "manual") this.applyViewport(true);
      });
      this.resizeObserver.observe(host);
    }
    scrollHost() {
      const view = this.rendererValue?.svg.ownerDocument.defaultView;
      return view && this.host instanceof view.HTMLElement ? this.host : void 0;
    }
    assertActive() {
      this.assertNotDestroyed();
    }
    assertNotDestroyed() {
      if (this.destroyed) throw new Error("This Finch.js diagram has been destroyed.");
    }
  };
  function resolveTarget(target) {
    if (!target) return void 0;
    if (typeof target !== "string") return target;
    const element = globalThis.document?.querySelector(target);
    if (!element) throw new Error(`Finch.js target "${target}" was not found.`);
    return element;
  }

  // src/icons.ts
  var lucideIcons = {
    "app-window": [
      {
        "tag": "rect",
        "attributes": {
          "x": "2",
          "y": "4",
          "width": "20",
          "height": "16",
          "rx": "2"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M10 4v4"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M2 8h20"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M6 4v4"
        }
      }
    ],
    "server": [
      {
        "tag": "rect",
        "attributes": {
          "width": "20",
          "height": "8",
          "x": "2",
          "y": "2",
          "rx": "2",
          "ry": "2"
        }
      },
      {
        "tag": "rect",
        "attributes": {
          "width": "20",
          "height": "8",
          "x": "2",
          "y": "14",
          "rx": "2",
          "ry": "2"
        }
      },
      {
        "tag": "line",
        "attributes": {
          "x1": "6",
          "x2": "6.01",
          "y1": "6",
          "y2": "6"
        }
      },
      {
        "tag": "line",
        "attributes": {
          "x1": "6",
          "x2": "6.01",
          "y1": "18",
          "y2": "18"
        }
      }
    ],
    "users": [
      {
        "tag": "path",
        "attributes": {
          "d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M16 3.128a4 4 0 0 1 0 7.744"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M22 21v-2a4 4 0 0 0-3-3.87"
        }
      },
      {
        "tag": "circle",
        "attributes": {
          "cx": "9",
          "cy": "7",
          "r": "4"
        }
      }
    ],
    "credit-card": [
      {
        "tag": "rect",
        "attributes": {
          "width": "20",
          "height": "14",
          "x": "2",
          "y": "5",
          "rx": "2"
        }
      },
      {
        "tag": "line",
        "attributes": {
          "x1": "2",
          "x2": "22",
          "y1": "10",
          "y2": "10"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M6 14h2"
        }
      }
    ],
    "radio": [
      {
        "tag": "path",
        "attributes": {
          "d": "M16.247 7.761a6 6 0 0 1 0 8.478"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M19.075 4.933a10 10 0 0 1 0 14.134"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M4.925 19.067a10 10 0 0 1 0-14.134"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M7.753 16.239a6 6 0 0 1 0-8.478"
        }
      },
      {
        "tag": "circle",
        "attributes": {
          "cx": "12",
          "cy": "12",
          "r": "2"
        }
      }
    ],
    "mail": [
      {
        "tag": "path",
        "attributes": {
          "d": "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"
        }
      },
      {
        "tag": "rect",
        "attributes": {
          "x": "2",
          "y": "4",
          "width": "20",
          "height": "16",
          "rx": "2"
        }
      }
    ],
    "file-chart-column": [
      {
        "tag": "path",
        "attributes": {
          "d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M14 2v5a1 1 0 0 0 1 1h5"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M8 18v-1"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M12 18v-6"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M16 18v-3"
        }
      }
    ],
    "shield-check": [
      {
        "tag": "path",
        "attributes": {
          "d": "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "m9 12 2 2 4-4"
        }
      }
    ],
    "key-round": [
      {
        "tag": "path",
        "attributes": {
          "d": "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"
        }
      },
      {
        "tag": "circle",
        "attributes": {
          "cx": "16.5",
          "cy": "7.5",
          "r": ".5",
          "fill": "currentColor"
        }
      }
    ],
    "database": [
      {
        "tag": "ellipse",
        "attributes": {
          "cx": "12",
          "cy": "5",
          "rx": "9",
          "ry": "3"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M3 5V19A9 3 0 0 0 21 19V5"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M3 12A9 3 0 0 0 21 12"
        }
      }
    ],
    "hard-drive": [
      {
        "tag": "path",
        "attributes": {
          "d": "M10 16h.01"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M21.946 12.013H2.054"
        }
      },
      {
        "tag": "path",
        "attributes": {
          "d": "M6 16h.01"
        }
      }
    ]
  };

  // src/registry.ts
  var Registry = class {
    constructor() {
      __publicField(this, "icons", /* @__PURE__ */ new Map());
      __publicField(this, "diagrams", /* @__PURE__ */ new Map());
      __publicField(this, "shapes", /* @__PURE__ */ new Map());
      __publicField(this, "layouts", /* @__PURE__ */ new Map());
      __publicField(this, "themes", /* @__PURE__ */ new Map());
    }
    registerIcon(name, icon) {
      this.icons.set(normalize(name), Array.isArray(icon) ? icon.map((part) => ({ ...part, attributes: { ...part.attributes } })) : { ...icon });
    }
    icon(name) {
      return this.icons.get(normalize(name));
    }
    registerDiagram(name, plugin) {
      this.diagrams.set(normalize(name), { ...plugin, name: normalize(name) });
    }
    registerShape(name, plugin) {
      this.shapes.set(normalize(name), { ...plugin, name: normalize(name) });
    }
    registerLayout(name, plugin) {
      this.layouts.set(normalize(name), { ...plugin, name: normalize(name) });
    }
    registerTheme(name, theme) {
      this.themes.set(normalize(name), { ...theme, name: normalize(name) });
    }
    diagram(name) {
      const plugin = this.diagrams.get(normalize(name));
      if (!plugin) throw new Error(`Unknown diagram "${name}". Register it with Finch.registerDiagram().`);
      return plugin;
    }
    shape(name) {
      return this.shapes.get(normalize(name)) ?? this.shapes.get("rectangle") ?? missing("shape", name);
    }
    layout(name) {
      const plugin = this.layouts.get(normalize(name));
      if (!plugin) throw new Error(`Unknown layout "${name}". Register it with Finch.registerLayout().`);
      return plugin;
    }
    theme(name) {
      const theme = this.themes.get(normalize(name));
      if (!theme) throw new Error(`Unknown theme "${name}". Register it with Finch.registerTheme().`);
      return theme;
    }
  };
  function normalize(name) {
    return name.trim().toLowerCase();
  }
  function missing(kind, name) {
    throw new Error(`Unknown ${kind} "${name}".`);
  }

  // src/theme.ts
  var defaultTheme = {
    tones: {
      cyan: { fill: "#ecfeff", stroke: "#087e91" },
      coral: { fill: "#fff1f2", stroke: "#be3455" },
      green: { fill: "#ecfdf5", stroke: "#087f5b" },
      amber: { fill: "#fffbeb", stroke: "#996500" },
      violet: { fill: "#f5f3ff", stroke: "#7552b8" }
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
    gapY: 32
  };
  var prismTheme = {
    ...defaultTheme,
    name: "prism",
    fontFamily: "Segoe UI, sans-serif",
    fontSize: 15,
    labelColor: "#f0f5ff",
    mutedColor: "#b1c0d8",
    nodeFill: "#17243a",
    nodeStroke: "#6683ac",
    nodeStrokeWidth: 1.6,
    nodeRadius: 7,
    nodePaddingX: 24,
    nodePaddingY: 17,
    containerFill: "#101c30",
    containerStroke: "#3c526f",
    edgeColor: "#afc3df",
    edgeWidth: 2,
    accentColor: "#52d7ff",
    canvasColor: "#0b1323",
    gapX: 75,
    gapY: 46,
    shadow: "none",
    tones: {
      cyan: { fill: "#102b3e", stroke: "#50d6ff" },
      coral: { fill: "#321f30", stroke: "#ff8193" },
      green: { fill: "#142e2d", stroke: "#55e0ae" },
      amber: { fill: "#30291e", stroke: "#ffc566" },
      violet: { fill: "#25223d", stroke: "#b89aff" }
    }
  };
  var midnightTheme = {
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
    shadow: "0 2px 10px rgba(0, 0, 0, 0.28)"
  };

  // src/page-preview.ts
  function pagePreview(instance, container, onError) {
    const document = container.ownerDocument;
    return () => {
      container.replaceChildren();
      for (const [index, markup] of instance.toSvgPages().entries()) {
        const section = document.createElement("section");
        section.className = "finch-editor__page";
        const title = document.createElement("h3");
        title.textContent = `Page ${index + 1}`;
        const image = document.createElement("img");
        image.alt = `Page ${index + 1}`;
        image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
        image.style.cssText = "max-width:100%;height:auto;display:block";
        const link = document.createElement("a");
        link.textContent = "SVG";
        link.href = image.src;
        link.download = `sequence-page-${index + 1}.svg`;
        const png = document.createElement("button");
        png.type = "button";
        png.textContent = "PNG";
        png.addEventListener("click", async () => {
          png.disabled = true;
          try {
            const blob = await svgMarkupToPngBlob(markup, document);
            const url = URL.createObjectURL(blob);
            const download = document.createElement("a");
            download.href = url;
            download.download = `sequence-page-${index + 1}.png`;
            download.click();
            setTimeout(() => URL.revokeObjectURL(url), 1e3);
          } catch (error) {
            onError(error);
          } finally {
            png.disabled = false;
          }
        });
        section.append(title, image, link, png);
        container.append(section);
      }
    };
  }

  // docs/assets/green-warbler-finch-icon-128.png
  var green_warbler_finch_icon_128_default = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABgCAYAAADVenpJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAgYSURBVHhe7dx/iBxXHQDwTS2tNnf7/b69XG21WPyBYrH4CxtbNVohaFp/tNYgRGN6O+/Nm73LmcRqikJJabVIoKLpP6KggooQpbSFQv+QFEWtqSISgk0qaWh+3O3szOzOzu7dpXe9e/KdzYbjJWoutzO7sd8PfOFub/beg+/MvB/z5hUKjDHGGGOMMcYYY4wxxhhjjDHGGGOMMfaa1x4dv65ZUuubQm2KivJTNeHcEaDzlRbq7XPgfXLphl1vsL/D/g9EQt/RRu/xBrittqiYV8SEOSPGzSti3CyK7caIr6W/J+gdT1DvbYP6gP0/2GVoSoxtmsPKn2fFuFkSk6aJ2tTRNRGqcxGeDfp5RlSMEZNmVlTo2P1hyXm3/T/ZZaKK6uYmuk26uinp3URfTDTQTU+EEFQSgdodC/dLzWG1vr1OXW8Ke66wy2IDxhQKa3yQv6bkBxdI8MUEfY/uGHTnoGaihZ6JQLXr6L7UQv1MA5Q0N257vV02GwDTa71r6+jWKGl2YlcadCJQk0AnE90V6G6SoPdiA9QP46JTsstmA8BH59HVXP3Loy08ahKONkB9tym8TTMjE2+yy2MDJAR57wx6i9SO28lcSXSbgAUxYXyhbrPLYQMoBLmTEpagt+qrn5JPowIfnN12OWwABaB2d4d6q00+tfN066+BfMQuhw2gGPWjlPwY9XnJvJSgzl4AzoN2OWzAhEV9Sxu9Z7u9czuRKw26c9CQr47uc0uFyavt8tiAeBkqIkHvgQS9eUqYnchLDRo2ttCLTg2X32WXyQZEHdXWNnonaJjXi/a+GzQVTON9H+QX7TLZANhTKFxRR/dnr4rtZk6M9yzx3ZgXEyYA9Ue7XDYATpbkDS2h/9Cd1+918unqpxOghmqvXTbrM7/ovCMBfciIHeclrpdBd5YA5Zft8lkfVUX5VuqULXSSc17SehV0B6AJpKCotth1YH0SCana6J3Jor2349wJgOpzdj1YH8So91J7T8OyrJNPQc8NmqjnfdTvtevCcnRMbH1LE/WBXk3sXGykw0mQrWTIXWfXieVkamjspjZWTqYrcS6QpCwjbWZAHjKFza+z68VycAq2va+F3olOT/z8BGUdVG4IzhN2vVgOpkpjN3V6+tQJy66n/9+i8/BHPmbXjeWgBvJJGuP348rvxmK6AFTebdeNZSwS5fe00Fta7eqd1US6eARk3FrrXWvXj2UsQLl/qYdP81YadNdJ1w6C/I5dN5axENX3qN1f/nJG3kELSBLUC3QnsuvHMuQX5f3U7vfz1t+5+ncaH50f2/VjGfKF8xF6N48mX+yk5BltrJgY3ZfqWL7RriPLyIuFyavrqF6gE6BfvX4ql279prTTTKP8jF1HlqEaOPt69cLGpQYlP0a9FIL6Ja/7y1Ed3Q105fez3acOZzrnAOphu34sYzWUv6Ol2/28+jtDPrVvP8/552t6WK2n17XyfMK3PDo9/vQJ4/PPFj5+pV0/liFTMGtqIP/Srwc9VCbtBJKgnp7iHn/+AnQ+249HvBSUfNodpIXe3Ckov9+uG8tBAPL3NONnJyfr6CS/YmaxMl9F+Xm7XiwHAciHevnmzsUGJZ82fWqhN1vD8ga7XiwH1aKj6daf97CPkk/9jRlRiaeKzqfterEc+EX19gT1Yi+2aFlJ0Difhppt9P55Esd4gWe/1FH9Js8xP5VDzxbojhOj+9vDo5uH7DqxnETg/pwmXOwkZRHUvCSo09e6YtSv0pZuPMnTRwHKn1Dys3zGT5NJ1MHrPFOQCyHKegu9F3wo32PXh+WoCs59/2tTRtp2JR2aicqKOod0bDfptG9PhOqvMbrfpnV8NSzf+TJsEXZ9WI4ioW6jsf6Ftmihtpn2501fv0Z1LER5IAD1XACyTTN01FGkdXnRshOC2nRKOn2H+hINdBciVAdnhPdIA/Qn7PJZH5nC5qtCVH8/+27duSTS1U4JpN01I1RH6+j+yb9m/DozOj5UQ3dDAPIHIapnQlS1EFWD7go0Z3B2n176H6dDUL+KhPTOrJt4p10uGxA+qq3dTh+dAHQ1pw9ewD0dgdpXR/kx2pJ9GuRbl38vLE0WA1C3h0VnY1h0bkl/RueBFuoj9P0E9VKC+qc0pFz+PTZATGHPlRGqY3OikiafrvgW6lYD9MPVtc4bu8f9p4UXtELI/uxwYfNVtDlzgvpvpnRfejIloJ+Ki3qjfSzrs84KHxrvy06iUB+owtjb7OMuVQL67gS9g+mJUNpJTcOBGL0txwu8SXPfTWP5TuqZU6//7Dj86HHYhvZxvdAAdU8T3H90T4QE9b8S4d6fDI2N2seyHFC73EIv7bjRREwbK/M5TL2uSUA7CeqqKe3qDAmxEjRBP0hNkX0wy8jp691rQlRHuh0/uvVXi9Kzj8vKqeGtI5T0BPUslW1K36T3+g7x1u058bH8fVP6Oq2tOxmiWqiB/IV9TNaqxXs3zojKYozukRDUE/OdR87b7ONYj01D+fal0g7q6U8HoL4RoDzoj47n+uAlBLXLjHyLhptPd/scNOoIeYPHbFE720Tv8GJph6lBuRygejwuqg/Zx2UpEu6tIcrnZ7Hyo27yg5HycDgsP0xrD+3jWQ9F4D5Gna+aGNtUF+5HactW+5isBaAeCsH9gv05y1gM8oMJar8KYy79TtO/9jF5CEC6Abh32Z+zjEWobj5R+uqb7c/z1hyeGAlBOjSNbP+NvUbQtDINRe3PGWOMMcYYY4wxxhhjjDHGGGOMMcYYY+zy9G94ssRUzRj3BgAAAABJRU5ErkJggg==";

  // src/editor.ts
  var STYLE_ID = "finch-editor-styles";
  var editorCount = 0;
  var occurrenceByDocument = /* @__PURE__ */ new WeakMap();
  function attachEditor(instance, options = {}) {
    const host = instance.host;
    if (!host) throw new Error("Finch.attachEditor() requires an instance rendered into a target element.");
    const document = host.ownerDocument;
    installStyles(document);
    host.classList.add("finch-editor-host");
    const root = document.createElement("div");
    root.className = "finch-editor";
    root.innerHTML = `
    <section class="finch-editor__panel" id="finch-editor-panel" aria-label="Finch edit menu" hidden>
      <div class="finch-editor__header">
        <strong>Finch editor</strong>
        <span class="finch-editor__status" data-status>Saved</span>
      </div>
      <div class="finch-editor__tools" role="toolbar" aria-label="Diagram editing tools">
        <button type="button" data-action="zoom-out" aria-label="Zoom out">\u2212</button>
        <button type="button" data-action="zoom-reset" class="finch-editor__zoom" aria-label="Reset zoom to 100%">100%</button>
        <button type="button" data-action="zoom-in" aria-label="Zoom in">\uFF0B</button>
        <span class="finch-editor__separator" aria-hidden="true"></span>
        <button type="button" data-action="edit" aria-pressed="true">Edit ON</button>
        <button type="button" data-action="undo" aria-label="Undo layout change">Undo</button>
        <button type="button" data-action="pin">Pin / Unpin</button>
        <button type="button" data-action="layout">Auto layout</button>
        <button type="button" data-action="reset">Reset</button>
        <button type="button" data-action="fit">Fit</button>
        <button type="button" data-action="width">Width</button>
      </div>
      <div class="finch-editor__exports" role="group" aria-label="Save and export">
        <button type="button" data-action="save" class="finch-editor__save">Save</button>
        <button type="button" data-action="save-as">\u540D\u524D\u3092\u4ED8\u3051\u3066\u4FDD\u5B58</button>
        <button type="button" data-action="freeze" class="finch-editor__freeze">\u30D5\u30EA\u30FC\u30BA</button>
        <button type="button" data-action="svg">SVG</button>
        <button type="button" data-action="png">PNG</button>
        <button type="button" data-action="pages" aria-expanded="false" hidden>Pages</button>
      </div>
      <div class="finch-editor__pages" hidden aria-label="Sequence pages"></div>
      <label class="finch-editor__source">
        <span>Source</span>
        <textarea data-source spellcheck="false" aria-label="Finch diagram source"></textarea>
      </label>
      <p class="finch-editor__error" data-error role="alert" hidden></p>
    </section>
  `;
    host.after(root);
    const panel = required(root, ".finch-editor__panel");
    const panelId = `finch-editor-panel-${++editorCount}`;
    panel.id = panelId;
    const source = required(root, "[data-source]");
    const status = required(root, "[data-status]");
    const error = required(root, "[data-error]");
    const diagnostic = document.createElement("div");
    diagnostic.className = "finch-editor__diagnostic";
    diagnostic.hidden = true;
    diagnostic.setAttribute("role", "alert");
    host.append(diagnostic);
    const pages = required(root, ".finch-editor__pages");
    const renderPages = pagePreview(instance, pages, showError);
    let sourceInvalid = false;
    function showSourceError(cause) {
      sourceInvalid = cause !== void 0;
      host.classList.toggle("finch-editor-invalid", sourceInvalid);
      diagnostic.hidden = !sourceInvalid;
      source.setAttribute("aria-invalid", String(sourceInvalid));
      diagnostic.replaceChildren();
      if (!sourceInvalid) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      const lines = source.value.split(/\r?\n/);
      const match = /\bline\s+(\d+)/i.exec(message);
      const line = match ? Number(match[1]) : /directive|Unknown diagram/i.test(message) ? lines.findIndex((text) => text.trim() && !text.trim().startsWith("'")) + 1 : void 0;
      const title = document.createElement("strong");
      title.textContent = "\u5165\u529B\u5185\u5BB9\u306B\u30A8\u30E9\u30FC\u304C\u3042\u308A\u307E\u3059";
      const detail = document.createElement("p");
      detail.textContent = message.includes("could not parse") ? `\u3053\u306E\u884C\u306E\u6587\u6CD5\u3092\u89E3\u91C8\u3067\u304D\u307E\u305B\u3093\u3002\u5BA3\u8A00\u3001\u77E2\u5370\u3001\u5F15\u7528\u7B26\u3001\u62EC\u5F27\u306E\u66F8\u304D\u65B9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002
${message}` : message;
      diagnostic.append(title, detail);
      if (line && lines[line - 1] !== void 0) {
        const excerpt = document.createElement("pre");
        excerpt.textContent = `${line} | ${lines[line - 1]}`;
        const jump = document.createElement("button");
        jump.type = "button";
        jump.textContent = `${line} \u884C\u76EE\u3092\u7DE8\u96C6`;
        jump.addEventListener("click", () => {
          setOpen(true);
          required(root, ".finch-editor__source").hidden = false;
          const start = source.value.split("\n").slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
          source.focus();
          source.setSelectionRange(start, start + lines[line - 1].length);
        });
        diagnostic.append(excerpt, jump);
      } else {
        const excerpt = document.createElement("pre");
        excerpt.textContent = lines.map((text, index) => `${index + 1} | ${text}`).join("\n");
        diagnostic.append(excerpt);
      }
      setOpen(true);
    }
    function updateSource(value) {
      try {
        instance.update(value);
        showSourceError();
      } catch (cause) {
        showSourceError(cause);
        throw cause;
      }
    }
    const storageKey = options.storageKey ?? defaultStorageKey(instance);
    const storage = options.storage;
    required(root, "[data-action=save-as]").hidden = !!(options.onSave || storage);
    let saving;
    let freezing = false;
    let revision = 0;
    let timer;
    let dirty = false;
    let destroyed = false;
    let svgTrigger;
    let svgIcon;
    let svgBadge;
    let editableWhenOpen = instance.editable;
    function syncSvgTrigger(open) {
      positionSvgTrigger();
      svgTrigger?.setAttribute("aria-expanded", String(open));
      if (svgBadge) {
        svgBadge.setAttribute("fill", open ? "#e91e63" : "#fff");
        svgBadge.setAttribute("stroke", open ? "#e91e63" : "#fbcfe8");
      }
      if (svgIcon) svgIcon.style.filter = open ? "brightness(0) invert(1)" : "";
    }
    function positionSvgTrigger() {
      const zoom = instance.zoom;
      const origin = instance.geometry.origin ?? { x: 0, y: 0 };
      svgTrigger?.setAttribute("transform", `translate(${origin.x + 18 / zoom} ${origin.y + Math.max(18 / zoom, instance.geometry.height - 74 / zoom)}) scale(${0.75 / zoom})`);
    }
    function installSvgTrigger() {
      const svg = instance.svg;
      if (instance.frozen) {
        svg.querySelector("[data-finch-editor-trigger]")?.remove();
        svgTrigger = void 0;
        svgIcon = void 0;
        svgBadge = void 0;
        return;
      }
      const existing = svg.querySelector("[data-finch-editor-trigger]");
      if (existing) {
        svgTrigger = existing;
        svgIcon = existing.querySelector("image") ?? void 0;
        svgBadge = existing.querySelector("circle") ?? void 0;
        syncSvgTrigger(!panel.hidden);
        return;
      }
      const namespace = "http://www.w3.org/2000/svg";
      const group = document.createElementNS(namespace, "g");
      group.classList.add("finch-editor-trigger");
      group.dataset.finchEditorTrigger = "";
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("aria-label", "Toggle Finch edit menu");
      group.setAttribute("aria-controls", panelId);
      group.setAttribute("aria-expanded", "false");
      group.setAttribute("style", "cursor:pointer;outline:none");
      group.innerHTML = `
      <title>Finch editor</title>
      <circle cx="38" cy="38" r="36" fill="#fff" stroke="#fbcfe8" stroke-width="1.5"/>
      <image href="${green_warbler_finch_icon_128_default}" x="5" y="5" width="66" height="66" preserveAspectRatio="xMidYMid meet"/>
    `;
      const focusRing = group.querySelector("circle");
      group.addEventListener("focus", () => {
        focusRing.setAttribute("stroke", "#4f46e5");
        focusRing.setAttribute("stroke-width", "3");
      });
      group.addEventListener("blur", () => {
        focusRing.setAttribute("stroke", panel.hidden ? "#fbcfe8" : "#e91e63");
        focusRing.setAttribute("stroke-width", "1.5");
      });
      group.addEventListener("pointerdown", (event) => event.stopPropagation());
      group.addEventListener("click", (event) => {
        event.stopPropagation();
        setOpen(panel.hidden);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(panel.hidden);
      });
      svg.append(group);
      svgTrigger = group;
      svgIcon = group.querySelector("image") ?? void 0;
      svgBadge = focusRing;
      syncSvgTrigger(!panel.hidden);
    }
    source.value = instance.source;
    if (options.sourcePane === false) required(root, ".finch-editor__source").hidden = true;
    function setOpen(open) {
      if (freezing && !instance.frozen) return;
      if (instance.frozen) open = false;
      const wasOpen = !panel.hidden;
      if (!open && (wasOpen || instance.editable)) editableWhenOpen = instance.editable;
      panel.hidden = !open;
      host.classList.toggle("finch-editor-open", open);
      if (open && !wasOpen) instance.setEditable(editableWhenOpen);
      if (!open && instance.editable) instance.setEditable(false);
      syncSvgTrigger(open);
    }
    function setDirty(next) {
      if (next) revision++;
      dirty = next;
      status.textContent = dirty ? "Unsaved" : "Saved";
      status.classList.toggle("is-dirty", dirty);
    }
    function showError(cause) {
      if (cause instanceof Error && cause.name === "AbortError") cause = void 0;
      error.hidden = cause === void 0;
      error.textContent = cause === void 0 ? "" : cause instanceof Error ? cause.message : String(cause);
    }
    function updateControls() {
      const pageButton = required(root, "[data-action=pages]");
      pageButton.hidden = instance.model.kind !== "sequence" || !instance.model.pageBreaks?.length;
      if (pageButton.hidden) {
        pages.hidden = true;
        pageButton.setAttribute("aria-expanded", "false");
        pages.replaceChildren();
      }
      positionSvgTrigger();
      root.hidden = instance.frozen;
      if (instance.frozen) {
        if (timer !== void 0) document.defaultView?.clearTimeout(timer);
        setOpen(false);
        installSvgTrigger();
      }
      const editable = instance.editable;
      const edit = required(root, "[data-action='edit']");
      edit.textContent = editable ? "Edit ON" : "Edit OFF";
      edit.setAttribute("aria-pressed", String(editable));
      required(root, "[data-action='undo']").disabled = !editable || !instance.canUndo;
      required(root, "[data-action='pin']").disabled = !editable || !instance.selection.length;
      for (const action of ["layout", "reset", "fit", "width"]) {
        required(root, `[data-action='${action}']`).disabled = !editable;
      }
      required(root, ".finch-editor__zoom").textContent = `${Math.round(instance.zoom * 100)}%`;
    }
    function save(saveAs = false, freezeAfter = false) {
      if (saving) return saving;
      if (timer !== void 0) document.defaultView?.clearTimeout(timer);
      if (source.value !== instance.source) setSource(source.value);
      else updateSource(source.value);
      const atRevision = revision;
      const snapshot = instance.exportState();
      if (freezeAfter) {
        snapshot.overlay.frozen = true;
        snapshot.overlay.editable = false;
        snapshot.markdown = writeMarkdown(snapshot.source, snapshot.overlay);
      }
      const value = { source: snapshot.source, layout: snapshot.overlay };
      const saved = options.onSave ? options.onSave(snapshot) : storage ? storage.save(storageKey, value) : saveDocument(document, options.htmlFilename, saveAs, /* @__PURE__ */ new Map([[instance, snapshot]]));
      const complete = (result) => {
        if (destroyed) return;
        if (freezeAfter) instance.freeze();
        if (revision === atRevision) setDirty(false);
        else setDirty(true);
        if (!dirty && result === "downloaded") status.textContent = "Downloaded";
        showError();
      };
      if (isPromiseLike(saved)) {
        status.textContent = "Saving\u2026";
        for (const button of root.querySelectorAll("[data-action=save], [data-action=save-as], [data-action=freeze]")) button.disabled = true;
        saving = Promise.resolve(saved).then(complete).catch((cause) => {
          setDirty(true);
          throw cause;
        }).finally(() => {
          saving = void 0;
          for (const button of root.querySelectorAll("[data-action=save], [data-action=save-as], [data-action=freeze]")) button.disabled = false;
        });
        return saving;
      }
      complete();
    }
    function applyStoredState(value) {
      if (!value || destroyed || dirty || instance.frozen) return;
      if (typeof value.source === "string") {
        source.value = value.source;
        updateSource(value.source);
      }
      if (value.layout) instance.importLayout(value.layout);
      editableWhenOpen = instance.editable;
      setDirty(false);
      showError();
      updateControls();
    }
    function restore() {
      if (options.restore === false || !storage || options.onSave) return;
      try {
        const loaded = storage.load(storageKey);
        if (isPromiseLike(loaded)) {
          void Promise.resolve(loaded).then(applyStoredState).catch(showError);
        } else {
          applyStoredState(loaded);
        }
      } catch (cause) {
        showError(cause);
      }
    }
    function setSource(value) {
      if (instance.frozen || freezing) return;
      source.value = value;
      setDirty(true);
      updateSource(value);
      instance.notifyChange();
      setDirty(true);
      updateControls();
    }
    function onPanelClick(event) {
      if (instance.frozen || freezing) return;
      const button = event.target.closest("button[data-action]");
      const action = button?.dataset.action;
      if (!action) return;
      if (sourceInvalid && !["save", "save-as", "freeze"].includes(action)) return;
      try {
        showError();
        if (action === "zoom-out") instance.zoomOut();
        if (action === "zoom-reset") instance.resetZoom();
        if (action === "zoom-in") instance.zoomIn();
        if (action === "edit") instance.setEditable(!instance.editable);
        if (action === "freeze") {
          if (timer !== void 0) document.defaultView?.clearTimeout(timer);
          if (source.value !== instance.source) setSource(source.value);
          const previousEditable = instance.editable;
          freezing = true;
          source.disabled = true;
          instance.setEditable(false);
          setDirty(true);
          const finish = () => {
            freezing = false;
            source.disabled = false;
            updateControls();
          };
          const failed = (cause) => {
            if (destroyed) return;
            finish();
            instance.setEditable(previousEditable);
            editableWhenOpen = previousEditable;
            setDirty(true);
            showError(cause);
          };
          try {
            const saved = save(false, true);
            if (isPromiseLike(saved)) void Promise.resolve(saved).then(finish, failed);
            else finish();
          } catch (cause) {
            failed(cause);
          }
        }
        if (action === "undo") instance.undoLayout();
        if (action === "pin") {
          for (const id of instance.selection) instance.isPinned(id) ? instance.unpin(id) : instance.pin(id);
        }
        if (action === "layout") instance.autoLayout();
        if (action === "reset") instance.resetLayout();
        if (action === "fit") instance.fit("diagram");
        if (action === "width") instance.fit("width");
        if (action === "save" || action === "save-as") {
          const saved = save(action === "save-as");
          if (isPromiseLike(saved)) void Promise.resolve(saved).catch(showError);
        }
        if (action === "pages") {
          pages.hidden = !pages.hidden;
          required(root, "[data-action=pages]").setAttribute("aria-expanded", String(!pages.hidden));
          if (!pages.hidden) renderPages();
        }
        if (action === "svg") void instance.downloadSvg(options.svgFilename).catch(showError);
        if (action === "png") void instance.downloadPng(options.pngFilename).catch(showError);
        updateControls();
      } catch (cause) {
        showError(cause);
      }
    }
    function onSourceInput() {
      if (instance.frozen) return;
      setDirty(true);
      if (timer !== void 0) document.defaultView?.clearTimeout(timer);
      timer = document.defaultView?.setTimeout(() => {
        try {
          updateSource(source.value);
          instance.notifyChange();
          installSvgTrigger();
          showError();
          updateControls();
        } catch (cause) {
          showError(cause);
        }
      }, options.updateDelay ?? 180);
    }
    function onLayoutChange(event) {
      if (!pages.hidden) renderPages();
      const detail = event.detail;
      if (detail?.changedNodeIds?.length) setDirty(true);
      installSvgTrigger();
      updateControls();
    }
    function onRender() {
      showSourceError();
      source.value = instance.source;
      if (!pages.hidden && instance.model.kind === "sequence") renderPages();
      setDirty(true);
      installSvgTrigger();
      updateControls();
    }
    function onKeydown(event) {
      if (event.key === "Escape" && !panel.hidden) setOpen(false);
    }
    panel.addEventListener("click", onPanelClick);
    source.addEventListener("input", onSourceInput);
    host.addEventListener("finch:layoutchange", onLayoutChange);
    host.addEventListener("finch:editchange", updateControls);
    host.addEventListener("finch:zoomchange", updateControls);
    host.addEventListener("finch:render", onRender);
    host.addEventListener("finch:destroy", destroyEditor);
    host.addEventListener("pointerup", updateControls);
    document.addEventListener("keydown", onKeydown);
    restore();
    editableWhenOpen = instance.editable;
    installSvgTrigger();
    setOpen(options.initiallyOpen ?? false);
    setDirty(false);
    updateControls();
    function destroyEditor() {
      if (destroyed) return;
      destroyed = true;
      if (timer !== void 0) document.defaultView?.clearTimeout(timer);
      host.removeEventListener("finch:layoutchange", onLayoutChange);
      host.removeEventListener("finch:editchange", updateControls);
      host.removeEventListener("finch:zoomchange", updateControls);
      host.removeEventListener("finch:render", onRender);
      host.removeEventListener("finch:destroy", destroyEditor);
      host.removeEventListener("pointerup", updateControls);
      document.removeEventListener("keydown", onKeydown);
      svgTrigger?.remove();
      diagnostic.remove();
      host.classList.remove("finch-editor-invalid");
      svgIcon = void 0;
      svgBadge = void 0;
      host.classList.remove("finch-editor-host", "finch-editor-open");
      root.remove();
    }
    return {
      element: root,
      get dirty() {
        return dirty;
      },
      open: () => setOpen(true),
      close: () => setOpen(false),
      save,
      saveAs: () => save(true),
      setSource,
      destroy: destroyEditor
    };
  }
  function defaultStorageKey(instance) {
    const document = instance.svg.ownerDocument;
    const pathname = document.defaultView?.location.pathname ?? "document";
    if (instance.host?.id) return `finch-editor:${pathname}:${instance.host.id}`;
    let state = occurrenceByDocument.get(document);
    if (!state) {
      state = { next: 1, byHost: /* @__PURE__ */ new WeakMap() };
      occurrenceByDocument.set(document, state);
    }
    const host = instance.host;
    let occurrence = host ? state.byHost.get(host) : void 0;
    if (occurrence === void 0) {
      occurrence = state.next++;
      if (host) state.byHost.set(host, occurrence);
    }
    return `finch-editor:${pathname}:${occurrence}`;
  }
  function isPromiseLike(value) {
    return value !== null && value !== void 0 && typeof value.then === "function";
  }
  function required(root, selector2) {
    const element = root.querySelector(selector2);
    if (!element) throw new Error(`Missing Finch editor element: ${selector2}`);
    return element;
  }
  function installStyles(document) {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .finch-editor { position: relative; z-index: 1; color: #172033; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    .finch-editor *, .finch-editor *::before, .finch-editor *::after { box-sizing: border-box; }
    .finch-editor-host { min-height: 94px; }
    .finch-editor-host > svg { overflow: visible; }
    .finch-editor-host.finch-editor-invalid > svg { display: none !important; }
    .finch-editor__diagnostic { padding: 20px; color: #991b1b; background: #fff1f2; border: 1px solid #fecaca; border-radius: 10px; font: 14px/1.6 system-ui, sans-serif; }
    .finch-editor__diagnostic[hidden] { display: none; }
    .finch-editor__diagnostic p, .finch-editor__diagnostic pre { white-space: pre-wrap; overflow-wrap: anywhere; }
    .finch-editor__diagnostic pre { max-height: 280px; overflow: auto; }
    .finch-editor__diagnostic button { cursor: pointer; padding: 6px 12px; }
    .finch-editor__source textarea[aria-invalid=true] { border-color: #dc2626; }
    .finch-editor-host.finch-editor-open { border-bottom-right-radius: 0 !important; border-bottom-left-radius: 0 !important; }
    .finch-editor__panel { width: 100%; max-height: 720px; margin-top: -1px; overflow: auto; background: #fff; border: 1px solid #dbe3ee; border-top: 1px solid #e5eaf1; border-radius: 0 0 16px 16px; box-shadow: 0 14px 34px rgb(15 23 42 / 10%); }
    .finch-editor__panel[hidden] { display: none; }
    .finch-editor__header, .finch-editor__exports { display: flex; align-items: center; gap: 8px; padding: 11px 12px; }
    .finch-editor__header { justify-content: space-between; border-bottom: 1px solid #e5eaf1; }
    .finch-editor__header strong { font-size: 13px; letter-spacing: -0.01em; }
    .finch-editor__status { color: #64748b; font-size: 11px; }
    .finch-editor__status.is-dirty { color: #b45309; }
    .finch-editor__tools { display: flex; flex-wrap: wrap; gap: 7px; padding: 12px; border-bottom: 1px solid #e5eaf1; }
    .finch-editor button { min-height: 32px; padding: 6px 10px; color: #334155; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font: 650 12px/1.4 inherit; cursor: pointer; }
    .finch-editor button:hover { color: #4338ca; border-color: #818cf8; }
    .finch-editor button:disabled { cursor: not-allowed; opacity: .45; }
    .finch-editor button[aria-pressed="true"] { color: #fff; background: #4f46e5; border-color: #4f46e5; }
    .finch-editor__zoom { min-width: 58px; font-variant-numeric: tabular-nums; }
    .finch-editor__separator { width: 1px; margin: 2px 2px; background: #e2e8f0; }
    .finch-editor__pages { padding:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
    .finch-editor__pages[hidden] { display:none; }
    .finch-editor__page { min-width:0; }
    .finch-editor__page a { margin-right:12px; }
    .finch-editor__exports { justify-content: flex-end; flex-wrap: wrap; border-bottom: 1px solid #e5eaf1; }
    .finch-editor .finch-editor__save { color: #fff; background: #172033; border-color: #172033; }
    .finch-editor .finch-editor__freeze { color: #b42332; background: #fff1f2; border-color: #f2a6ae; }
    .finch-editor .finch-editor__freeze:hover { color: #881c28; background: #ffe4e6; border-color: #d94b60; }
    .finch-editor__source { display: grid; gap: 7px; padding: 12px; }
    .finch-editor__source[hidden] { display: none; }
    .finch-editor__source > span { color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .finch-editor__source textarea { width: 100%; min-height: 220px; resize: vertical; padding: 13px 14px; color: #dbeafe; background: #111827; border: 0; border-radius: 10px; outline: 0; font: 12px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
    .finch-editor__source textarea:focus { box-shadow: 0 0 0 3px rgb(129 140 248 / 35%); }
    .finch-editor__error { margin: 0 12px 12px; padding: 9px 11px; color: #b91c1c; background: #fef2f2; border-radius: 8px; font-size: 12px; }
    .finch-editor__error[hidden] { display: none; }
    @media (max-width: 640px) { .finch-editor__panel { max-height: calc(100vh - 82px); } .finch-editor__source textarea { min-height: 170px; } }
  `;
    document.head.append(style);
  }

  // src/index.ts
  var FinchEngine = class {
    constructor() {
      __publicField(this, "registry", new Registry());
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
    render(source, options = {}) {
      const normalized = typeof options === "string" || isElement(options) ? { target: options } : options;
      const instance = new DiagramInstance(source, normalized, this.registry);
      if (instance.host && normalized.editor !== false) {
        attachEditor(instance, {
          ...typeof normalized.editor === "object" ? normalized.editor : {},
          ...normalized.onSave ? { onSave: normalized.onSave } : {}
        });
      }
      return instance;
    }
    attachEditor(instance, options = {}) {
      return attachEditor(instance, options);
    }
    parseMarkdown(markdown) {
      return parseMarkdown(markdown);
    }
    renderMarkdown(markdown, options = {}) {
      const normalized = typeof options === "string" || isElement(options) ? { target: options } : options;
      const { diagramIndex = 0, ...renderOptions } = normalized;
      const diagram = parseMarkdown(markdown)[diagramIndex];
      if (!Number.isInteger(diagramIndex) || !diagram) throw new Error("\u6307\u5B9A\u3057\u305F Finch \u306E\u30B3\u30FC\u30C9\u30D5\u30A7\u30F3\u30B9\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
      return this.render(diagram.source, {
        ...renderOptions,
        ...diagram.overlay ? { overlay: diagram.overlay } : {},
        ...renderOptions.overlay !== void 0 ? { overlay: renderOptions.overlay } : {}
      });
    }
    parse(source) {
      return this.registry.diagram(getDiagramKind(source)).parse(source);
    }
    registerDiagram(name, plugin) {
      this.registry.registerDiagram(name, plugin);
    }
    registerShape(name, plugin) {
      this.registry.registerShape(name, plugin);
    }
    registerLayout(name, plugin) {
      this.registry.registerLayout(name, plugin);
    }
    registerIcon(name, icon) {
      this.registry.registerIcon(name, icon);
    }
    registerIconPack(namespace, icons) {
      if (!/^[a-z][a-z0-9-]*$/i.test(namespace)) throw new Error("Invalid icon pack namespace.");
      for (const [name, icon] of Object.entries(icons)) this.registerIcon(`${namespace}:${name}`, icon);
    }
    registerTheme(name, theme) {
      this.registry.registerTheme(name, theme);
    }
    createLayoutOverlay() {
      return createOverlay();
    }
  };
  function isElement(value) {
    return typeof Element !== "undefined" && value instanceof Element;
  }
  function createFinch() {
    return new FinchEngine();
  }
  var Finch = createFinch();
  var index_default = Finch;

  // src/browser.ts
  var browserFinch = Object.assign(index_default, { createFinch, defaultTheme, midnightTheme, prismTheme, lucideIcons, parseState, validateState });
  globalThis.Finch = browserFinch;
})();
//# sourceMappingURL=finch.global.js.map

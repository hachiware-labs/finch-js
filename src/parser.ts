import {componentDecorations} from "./component-decorations.js";
import {applyComponentDisplay,componentDisplayModel} from "./component-display.js";
import {normalizeDeploymentAlias,componentNameId} from './element-aliases.js';
import {parseMemberModifiers} from './member-modifiers.js';
import {classRelationOperators} from './class-relations.js';
import {expandClassMembers} from './class-members.js';
import {withDiagramText} from './diagram-text.js';
import {sequenceNumber,decimalSequenceNumber} from './sequence-number-format.js';
import {expandObjectNamespaces} from './object-namespaces.js';
import { resolveMemberIndex } from "./member-target.js";
import { expandObjectJson } from "./object-json.js";
import { expandObjectMaps } from "./object-maps.js";
import type { MapEntry } from "./object-maps.js";
import { parseActivityLaneSwitches } from "./activity-lanes.js";
import { addTemplateBinding } from "./template-binding.js";
import { expandClassNamespaces } from "./class-namespaces.js";
import { applyClassDisplay } from "./class-display.js";
import { expandActivityBlocks } from "./activity-blocks.js";
import type { DiagramPlugin, SemanticConnection, SemanticGroup, SemanticModel, SemanticNode } from "./types.js";
import { validateState } from "./state-validation.js";
import { uniqueId } from "./utils.js";

function meaningfulLines(source: string): Array<{ text: string; number: number }> {
  return source.split(/\r?\n/).map((line, index) => {
    if (line.trim().startsWith("'")) return { text: "", number: index + 1 };
    let quoted = false;
    let opening = 0;
    let bracketDepth = 0;
    const bracketNames = /^\s*@(component|deployment|usecase)\b/.test(source);
    for (let column = 0; column < line.length; column++) {
      const char = line[column];
      if (quoted && char === "\\") { column++; continue; }
      if (char === '"') {
        quoted = !quoted;
        if (quoted) opening = column;
      }
      if (bracketNames && !quoted) {
        if (char === "[") bracketDepth++;
        if (char === "]") bracketDepth = Math.max(0,bracketDepth-1);
      }
      const protectedMember = source.trimStart().startsWith("@class") && /^\s*(?:(?:static|abstract)\s+)*$/.test(line.slice(0,column)) && /\w/.test(line[column+1] ?? "");
      if (!quoted && bracketDepth === 0 && column > 0 && /\s/.test(line[column - 1]!) && ((char === "#" && !protectedMember && !(source.trimStart().startsWith("@class") && /^#(?:--|\.\.)>?\s/.test(line.slice(column)))) || line.slice(column, column + 2) === "//")) {
        line = line.slice(0, column);
        break;
      }
    }
    if (quoted) throw new Error(`Line ${index + 1}, column ${opening + 1}: missing closing quote (\").`);
    return { text: line.trim(), number: index + 1 };
  }).filter((line) => line.text);
}

export function parseStateTransition(text: string): Record<string, string> {
  // A slash inside a guard expression is not the effect separator.
  let depth = 0; let parentheses = 0; let quote = ""; let separator = -1;
  let guardStart = -1, guardEnd = -1;
  for (let i = 0; i < text.length; i++) {
    if (quote) {
      if (text[i] === "\\") { i++; continue; }
      if (text[i] === quote) quote = "";
      continue;
    }
    if (text[i] === '"' || text[i] === "'") { quote = text[i]!; continue; }
    if (text[i] === "(") parentheses++;
    if (text[i] === ")") parentheses = Math.max(0,parentheses-1);
    if (text[i] === "[") {
      if (depth === 0 && parentheses === 0) guardStart = i;
      depth++;
    }
    if (text[i] === "]") {
      depth--;
      if (depth === 0 && parentheses === 0 && guardStart >= 0) guardEnd = i;
    }
    if (text[i] === "/" && depth === 0 && parentheses === 0) { separator = i; break; }
  }
  const head = (separator < 0 ? text : text.slice(0, separator)).trimEnd();
  const hasGuard = guardStart >= 0 && guardEnd === head.length - 1;
  const trigger = (hasGuard ? head.slice(0,guardStart) : head).trim();
  const triggerKind = /^(after|at)\s*\(/.test(trigger) ? "time" : /^when\s*\(/.test(trigger) ? "change" : trigger ? "event" : "completion";
  return { trigger, triggerKind, ...(hasGuard ? { guard: head.slice(guardStart+1,guardEnd).trim() } : {}), ...(separator >= 0 ? { effect: text.slice(separator + 1).trim() } : {}) };
}

function header(source: string): string {
  const first = meaningfulLines(source)[0]?.text;
  if (!first?.startsWith("@")) throw new Error("Finch.js source must begin with a diagram directive such as @deployment or @sequence.");
  return first.slice(1).trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function unquote(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1).replace(/\\"/g, '"') : value;
}

function attributesFrom(value: string | undefined): Record<string, string> {
  if (!value) return {};
  const attributes: Record<string, string> = {};
  for (const match of value.matchAll(/([\w-]+)\s*=\s*("(?:\\.|[^"])*"|[^\s\]]+)/g)) {
    const key = match[1];
    if (key) attributes[key] = unquote(match[2], "");
  }
  for (const key of ["fromPort", "toPort"]) {
    const port = attributes[key];
    if (port !== undefined && !["left", "right", "top", "bottom"].includes(port.toLowerCase())) {
      throw new Error(`Invalid ${key} "${port}". Expected left, right, top, or bottom.`);
    }
  }
  return attributes;
}

const componentRelationPattern = /^("(?:\\.|[^"\\])*"|\[[^\]\n]+\]|:[^:\n]+:|\([^()\n]+\)|[\w.-]+?(?:::(?:[\w.-]+|"(?:\\.|[^"\\])*"))?)\s*(<?-\[(?:bold|dashed|dotted|plain|#[\w]+|thickness=[\w.+-]+)(?:\s*,\s*(?:bold|dashed|dotted|plain|#[\w]+|thickness=[\w.+-]+))*\]->?|<\.(?:left|right|up|down|le|ri|do|[lrud])\.|\.(?:left|right|up|down|le|ri|do|[lrud])\.>|\.(?:left|right|up|down|le|ri|do|[lrud])\.(?=[\s\["])|<-?(?:left|right|up|down|le|ri|do|[lrud])-?|-(?:left|right|up|down|le|ri|do|[lrud])->|-(?:left|right|up|down|le|ri|do|[lrud])-(?=[\s\["])|(?<=\s)[o*](?:-{1,2}|\.{1,2})>?|<?(?:-{1,2}|\.{1,2})[o*](?=\s)|<\|\.{1,2}|\.{1,2}\|>|<\|-{1,2}|-{1,2}\|>|<={2,}>?|={2,}>?|<-{1,2}>|<-{1,2}|<\.\.|-{1,2}>|\.\.>|--|(?<=[\s\]"])-(?=[\s\["])|\.\.)\s*("(?:\\.|[^"\\])*"|\[[^\]\n]+\]|:[^:\n]+:|\([^()\n]+\)|[\w.-]+?(?:::(?:[\w.-]+|"(?:\\.|[^"\\])*"))?)(?:\s*:\s*(.+))?$/;

function componentEdgeOptions(text: string): RegExpMatchArray | null {
  const match = text.match(/\s+\[((?:"(?:\\.|[^"\\])*"|[^"\]])+)\]$/);
  return match && /[\w-]+\s*=/.test(match[1]!) && componentRelationPattern.test(text.slice(0,match.index))
    ? match : null;
}

function withAnnotations(source: string, parse: (source: string) => SemanticModel, declarationOwners?: ReadonlyMap<string,string>): SemanticModel | undefined {
  const notes: Array<{ target: string; label: string; page: number; side?: string; kind:string; edgeIndex?:number }> = [];
  let annotationPage = 0;
  let memberBody = false;
  let lastElement: string | undefined;
  let relationCount=0;
  const details: Array<{ kind: string; target: string; text: string }> = [];
  const associations: Array<{ id: string; from: string; to?: string }> = [];
  const body = source.split(/\r?\n/).filter(line => {
    if(/^\s*@(component|deployment|usecase)\b/m.test(source))line=meaningfulLines("@component\n"+line)[1]?.text ?? "";
    const code=line.replace(/"(?:\\.|[^"\\])*"/g,'').replace(/\s+(?:#|\/\/).*$/,'').trim();
    if(memberBody){if(code==='}')memberBody=false;return true;}
    if(/^\s*@class\b/m.test(source) && new RegExp(String.raw`^[\w.-]+(?:::~?[\w$]+(?:\([^)]*\))?)?\s+(?:"[^"]*"\s+)?(?:${classRelationOperators})\s+`).test(line.trim()))relationCount++;
    if(/^\s*@(component|deployment|usecase)\b/m.test(source)){
      const trimmed = line.trim(), options = componentEdgeOptions(trimmed);
      const relationText = options ? trimmed.slice(0,options.index) : trimmed;
      if(componentRelationPattern.test(relationText))relationCount++;
    }
    const linkNote=line.trim().match(/^(note|rnote|hnote)\s+(?:(left|right|top|bottom)\s+)?on\s+link\s*:\s*(.+)$/);
    if(linkNote){
      if(!relationCount)throw new Error('A link note requires a preceding relation.');
      const label=linkNote[3]!.startsWith('"') ? unquote(linkNote[3],"") : linkNote[3]!;
      notes.push({target:"",edgeIndex:relationCount-1,label,page:annotationPage,kind:linkNote[1]!,...(linkNote[2]?{side:linkNote[2]}:{})});return false;
    }
    const declared=code.match(/^(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|diamond|circle)\s+([\w.-]+)(?:\s*\{|\s*$)/);
    if(declared)lastElement=declared[1];
    if(/^\s*@(component|deployment|usecase)\b/m.test(source)){
      const normalized=normalizeDeploymentAlias(componentDecorations(line.trim()).text);
      const component=normalized.match(/^(?:node|server|database|container|actor\/?|rectangle|rounded|system|component|external|interface|usecase\/?|device|execution|artifact|file|card|hexagon|label|circle|boundary|control|entity|collections|stack|action|storage|process|agent|person|package|port|portin|portout|provided|required|queue|cloud|folder|frame)\s+([\w.-]+)(?:\s|$)/);
      if(component)lastElement=declarationOwners?.get(component[1]!) ?? component[1];
    }
    const named=line.trim().match(/^(?:note|rnote|hnote)\s+"(?:\\.|[^"\\])*"\s+as\s+([\w.-]+)$/);
    if(named)lastElement=named[1];
    const previous=line.trim().match(/^(note|rnote|hnote)\s+(left|right|top|bottom)\s*:\s*(.+)$/);
    if(previous){
      if(!lastElement)throw new Error('A shorthand note requires a preceding element.');
      const label=previous[3]!.startsWith('"') ? unquote(previous[3],"") : previous[3]!;
      notes.push({target:lastElement,label,page:annotationPage,kind:previous[1]!,side:previous[2]!});return false;
    }

    if(/^(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(code)){memberBody=true;return true;}

    if (/^newpage(?:\s+"(?:\\.|[^"\\])*")?$/.test(line.trim())) annotationPage++;
    const detail = line.trim().match(/^(visibility|stereotype|entry|exit|do|internal|defer|invariant)\s+([\w.-]+)\s+"((?:\\.|[^"])*)"$/);
    if (detail) { details.push({ kind: detail[1]!, target: detail[2]!, text: detail[3]! }); return false; }
    const association = line.trim().match(/^association\s+([\w.-]+)\s+([\w.-]+)(?:->([\w.-]+))?$/);
    if (association) { associations.push({ id: association[1]!, from: association[2]!, to: association[3]! }); return false; }
    const bracketNote=/^\s*@(component|deployment|usecase)\b/m.test(source) && line.trim().match(/^(note|rnote|hnote|constraint)(?:\s+(left|right|top|bottom)\s+of)?\s+(\[[^\]\n]+\]|"(?:\\.|[^"\\])*"|[\w.-]+)\s*(?::\s*(.+)|\s+("(?:\\.|[^"\\])*"))$/);
    if(bracketNote){
      const raw=bracketNote[4] ?? bracketNote[5]!;
      const label=raw.startsWith('"') ? unquote(raw,"") : raw;
      notes.push({target:componentNameId(bracketNote[3]!.startsWith("[") ? bracketNote[3]!.slice(1,-1) : unquote(bracketNote[3],"")),label:bracketNote[1]==='constraint'?`{${label}}`:label,kind:bracketNote[1]!,page:annotationPage,...(bracketNote[2]?{side:bracketNote[2]}:{})});return false;
    }
    const side=line.trim().match(/^(?:note|rnote|hnote|constraint)\s+(left|right|top|bottom)\s+of\s+/)?.[1];
    const match = line.trim().replace(/^(note|rnote|hnote|constraint)\s+(?:left|right|top|bottom)\s+of\s+/, '$1 ').match(/^(note|rnote|hnote|constraint)\s+([\w.-]+(?:::[^"]+?|->[\w.-]+)?)\s+"((?:\\.|[^"])*)"$/);
    if (!match) return true;
    notes.push({ target: match[2]!, page: annotationPage, kind:match[1]!, ...(side ? {side} : {}), label: match[1] === "constraint" ? `{${match[3]}}` : match[3]! }); return false;
  }).join("\n");
  if (!notes.length && !details.length && !associations.length) return undefined;
  const model = parse(body);
  for (const detail of details) {
    const node = model.nodes.find(node => node.id === detail.target);
    if (!node) throw new Error(`Unknown detail target "${detail.target}".`);
    if (detail.kind === "visibility") { node.attributes.visibility = detail.text; continue; }
    if (detail.kind === "stereotype") { node.attributes.stereotype = detail.text; continue; }
    if (model.kind !== "state" || node.attributes.stateKind !== "state") throw new Error(`${detail.kind} requires a state.`);
    if (detail.kind === "defer" || detail.kind === "invariant") {
      node.attributes[detail.kind] = detail.text;
      const text = detail.kind === "defer" ? `${detail.text} / defer` : `{${detail.text}}`;
      const body = JSON.parse(node.attributes.stateBody ?? "[]") as string[]; body.push(text); node.attributes.stateBody=JSON.stringify(body);
      if (node.shape !== "container") { node.shape="uml-state"; node.attributes.kind="class"; node.attributes.members=JSON.stringify(body.map(text=>({text,kind:"attribute"}))); }
      continue;
    }
    const behaviors = JSON.parse(node.attributes.stateBehaviors ?? "[]");
    behaviors.push({ kind: detail.kind, ...(detail.kind === "internal" ? parseStateTransition(detail.text) : { effect: detail.text }) });
    node.attributes.stateBehaviors = JSON.stringify(behaviors);
    const members = JSON.parse(node.attributes.stateBody ?? "[]") as string[];
    members.push(detail.kind === "internal" ? detail.text : `${detail.kind} / ${detail.text}`);
    node.attributes.stateBody = JSON.stringify(members);
    if (node.shape !== "container") {
      node.shape = "uml-state"; node.attributes.kind = "class";
      node.attributes.members = JSON.stringify(members.map(text => ({ text, kind: "attribute" })));
    }
  }
  for (const association of associations) {
    const node = model.nodes.find(node => node.id === association.id);
    const matches = model.connections.filter(edge => association.to ? edge.from === association.from && edge.to === association.to : edge.id === association.from);
    if (matches.length > 1) throw new Error("Ambiguous association: assign [id=name] and reference that ID.");
    const edge = matches[0];
    if (model.kind !== "class" || node?.shape !== "uml-class" || !edge) throw new Error(`Invalid association class "${association.id}".`);
    node.attributes.associationClass = "true";
    node.attributes.associationEdge = edge.id; node.attributes.annotationTarget = edge.id; node.attributes.annotationKind = "edge";
  }
  for (const [index,note] of notes.entries()) {
    const [owner,member] = note.target.split("::");
    const [from,to] = owner!.split("->");
    let memberIndex: number | undefined;
    if(member) {
      const node=model.nodes.find(n=>n.id===owner);
      const members=JSON.parse(node?.attributes.members ?? '[]') as Array<{text:string}>;
      memberIndex=resolveMemberIndex(members,member);
    }
    const targetNode = note.edgeIndex===undefined && !to ? model.nodes.find(node => node.id === from) : undefined;
    const matches = note.edgeIndex!==undefined ? model.connections.slice(note.edgeIndex,note.edgeIndex+1) : to ? model.connections.filter(edge => edge.from === from && edge.to === to) : targetNode ? [] : model.connections.filter(edge => edge.id === from);
    if(matches.length>1)throw new Error(`Ambiguous annotation target "${note.target}"; assign a message ID and reference it directly.`);
    const targetEdge=matches[0];
    const target = targetNode?.id ?? targetEdge?.id;
    if (!target) throw new Error(`Unknown annotation target "${note.target}".`);
    let id = `annotation-${index+1}`;
    while (model.nodes.some(node => node.id === id)) id += "-note";
    model.nodes.push({ id, label: note.label.replace(/\\"/g, '"'), shape: "uml-artifact", attributes: { ...(model.kind === "sequence" ? { sequencePage: String(note.page) } : {}), ...(["rnote","hnote"].includes(note.kind) ? {noteShape:note.kind} : {}), ...(note.side ? {annotationSide:note.side} : {}), annotationTarget: target, annotationKind: member ? "member" : targetEdge ? "edge" : "node", ...(memberIndex === undefined ? {} : {annotationMember:String(memberIndex)}), tone: "amber" } });
  }
  return { ...model, source };
}

function assertUnique(nodes: SemanticNode[], node: SemanticNode, line: number): void {
  if (nodes.some((existing) => existing.id === node.id)) throw new Error(`Line ${line}: duplicate node id "${node.id}".`);
}

function connectionId(from: string, to: string, index: number): string {
  return `${from}-${to}-${index + 1}`;
}

export function getDiagramKind(source: string): string {
  return header(source);
}

export function parseDeployment(source: string): SemanticModel {
  return parseDeploymentCore(source, new Map(), new Map());
}

function parseDeploymentCore(source: string, jsonEntries: Map<string, MapEntry[]>, jsonOwners: Map<string,string>): SemanticModel {
  const parse = (text: string) => parseDeploymentCore(text, jsonEntries, jsonOwners);
  const decorated=withDiagramText(source,parse);if(decorated)return decorated;
  const json = expandObjectJson(source.replace(/^\s*allowmixing\s*$/gm, ""));
  if (json.maps.size) {
    const expanded = json.source.split(/\r?\n/).map(line => {
      const declaration = line.match(/^object\s+([\w.-]+)\s+/);
      return declaration && json.maps.has(declaration[1]!) ? line.replace(/^object\s+/, "component ") : line;
    }).join("\n");
    const model = parseDeploymentCore(expanded, new Map([...jsonEntries, ...json.maps]), new Map([...jsonOwners, ...json.owners]));
    return {...model, source};
  }
  if (json.source !== source) return {...parse(json.source), source};
  const annotated = withAnnotations(source, parse, jsonOwners);
  if (annotated) return annotated;
  let anonymousGroup = 0;
  const lines = meaningfulLines(source).flatMap(line=>{
    const decoration=componentDecorations(line.text);
    let text=normalizeDeploymentAlias(decoration.text);
    const anonymous=text.match(/^(package|folder|frame|node|database|cloud|container|system|rectangle|queue|file|artifact|card|hexagon|stack|action|storage|process)\s*(\[[^\]]*\])?\s*(\{\s*\}?)$/);
    if(anonymous){
      let id:string;
      do{id=`__anonymous_group_${++anonymousGroup}`;}while(source.includes(id));
      text=`${anonymous[1]} ${id} "" ${anonymous[2] ?? ''} ${anonymous[3]}`;
    }
    const decoratedLine={...line,decoration};
    return /\{\s*\}$/.test(text) ? [{...decoratedLine,text:text.replace(/\{\s*\}$/, "{")},{...decoratedLine,text:"}"}] : [{...decoratedLine,text}];
  });
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const containerStack: string[] = [];
  const displayRules: string[] = [];
  const declarationKinds = new Map<string,string>();
  const componentTags: Array<{id:string;values:string[]}> = [];
  let componentStyle: string | undefined;
  let deploymentDirection: "right" | "down" = "right";
  const implicitComponents = new Map<string,SemanticNode>();
  const compactKinds = new Map<string,string>();

  for (const line of lines.slice(1)) {
    if (line.text === "}") {
      if (!containerStack.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
      continue;
    }

    const tag=line.text.match(/^tag\s+([\w.-]+)\s+([\w.-]+(?:\s+[\w.-]+)*)$/);
    if(tag){componentTags.push({id:tag[1]!,values:tag[2]!.split(/\s+/)});continue;}
    if(/^(hide|show|remove|restore)\s+/.test(line.text)){displayRules.push(line.text);continue;}
    const style=line.text.match(/^(?:skinparam\s+)?componentStyle\s+(\S+)$/);
    if(style){
      if(!["uml1","uml2","rectangle"].includes(style[1]!))throw new Error(`Unknown component style "${style[1]}".`);
      componentStyle=style[1];continue;
    }
    const orientation=line.text.match(/^(left to right|top to bottom) direction$/);
    if(orientation){deploymentDirection=orientation[1]==="left to right"?"right":"down";continue;}
    const standaloneNote=line.text.match(/^(note|rnote|hnote)\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+)$/);
    if(standaloneNote){
      const node:SemanticNode={id:standaloneNote[3]!,label:unquote(standaloneNote[2],""),shape:"uml-artifact",attributes:{standaloneNote:"true",noteShape:standaloneNote[1]!,tone:"amber"},...(containerStack.length?{parentId:containerStack[containerStack.length-1]!}:{})};
      assertUnique(nodes,node,line.number);nodes.push(node);continue;
    }

    const edgeOptions = componentEdgeOptions(line.text);
    const edgeText = edgeOptions ? line.text.slice(0,edgeOptions.index) : line.text;
    const relation = edgeText.match(componentRelationPattern);
    if (relation) {
      const resolveComponent = (value:string):string => {
        if (value.startsWith(':') || value.startsWith('(')) {
          const label=value.slice(1,-1), id=componentNameId(label);
          const shape=value.startsWith(':')?'actor':'usecase';
          const previous=compactKinds.get(id);
          if(previous && previous!==shape)throw new Error(`Conflicting endpoint kinds for "${label}": ${previous} and ${shape}. Use distinct IDs.`);
          compactKinds.set(id,shape);
          const existing=implicitComponents.get(id);
          if(existing) existing.shape=shape;
          else implicitComponents.set(id,{id,label,shape,attributes:{},...(containerStack.length?{parentId:containerStack[containerStack.length-1]!}:{})});
          return id;
        }
        if (!value.startsWith('"') && !value.startsWith('[')) value=value.split('::')[0]!;
        if (!value.startsWith("[")) {
          const label=unquote(value,""), id=componentNameId(label);
          if (/^\s*@component\b/.test(source) && !implicitComponents.has(id)) {
            implicitComponents.set(id,{id,label,shape:"uml-provided-interface",attributes:{},...(containerStack.length?{parentId:containerStack[containerStack.length-1]!}:{})});
          }
          return id;
        }
        const label=value.slice(1,-1), id=componentNameId(label);
        const previous=compactKinds.get(id);
        if(previous && previous!=="component")throw new Error(`Conflicting endpoint kinds for "${label}": ${previous} and component. Use distinct IDs.`);
        compactKinds.set(id,"component");
        const existing=implicitComponents.get(id);
        if(existing)existing.shape="component";
        else implicitComponents.set(id,{id,label,shape:"component",attributes:{},...(containerStack.length?{parentId:containerStack[containerStack.length-1]!}:{})});
        return id;
      };
      const rawArrow = relation[2] ?? "->";
      const bracket = rawArrow.match(/\[([^\]]+)\]/)?.[1];
      const bracketTokens = bracket?.split(",").map(value=>value.trim()) ?? [];
      const bracketStyle = bracketTokens.find(value=>["bold","dashed","dotted","plain"].includes(value));
      const lineColorToken = bracketTokens.find(value=>value.startsWith("#"));
      const lineColor = lineColorToken && (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(lineColorToken) ? lineColorToken : lineColorToken.slice(1));
      const thickness = bracketTokens.find(value=>value.startsWith("thickness="))?.slice(10);
      if(thickness !== undefined && (!Number.isFinite(Number(thickness)) || Number(thickness)<=0))throw new Error("Arrow thickness must be a positive finite number.");
      const arrow = rawArrow.replace(/\[[^\]]+\]/,"");
      const bidirectional = arrow.startsWith("<") && arrow.endsWith(">");
      const reversed = !bidirectional && (arrow.startsWith("<") || /[o*]$/.test(arrow));
      const from = resolveComponent(relation[reversed ? 3 : 1] ?? "");
      const to = resolveComponent(relation[reversed ? 1 : 3] ?? "");
      const namedRows: Record<string,string> = {};
      for (const [endpoint, raw, id] of [["from",relation[reversed ? 3 : 1]!,from],["to",relation[reversed ? 1 : 3]!,to]]) {
        const memberToken = raw!.match(/^[\w.-]+::([\w.-]+|"(?:\\.|[^"\\])*")$/)?.[1];
        const member = memberToken?.startsWith('"') ? JSON.parse(memberToken) as string : memberToken;
        if (member === undefined) continue;
        const entries=jsonEntries.get(id!);
        const index=entries?.findIndex(entry=>entry.key===(/[\r\n\t]/.test(member) ? JSON.stringify(member) : member)) ?? -1;
        if(index<0)throw new Error(`Unknown JSON key "${member}" on "${id}".`);
        namedRows[`${endpoint}MapRow`]=String(index);
      }
      const hint=arrow.match(/left|right|up|down|le|ri|do|[lrud]/)?.[0];
      const direction=hint ? ({l:"left",r:"right",u:"up",d:"down"} as Record<string,string>)[hint[0]!] : undefined;
      const ownership = arrow.includes("*") ? "composition" : arrow.includes("o") && !/down|do/.test(arrow) ? "aggregation" : undefined;
      const inheritance = arrow.includes("|");
      const realization = inheritance && arrow.includes(".");
      const undirected = !arrow.includes('<') && !arrow.includes('>');
      const explicitAttributes = attributesFrom(edgeOptions?.[1]);
      if(explicitAttributes.thickness !== undefined && (!Number.isFinite(Number(explicitAttributes.thickness)) || Number(explicitAttributes.thickness)<=0))throw new Error("Arrow thickness must be a positive finite number.");
      const relationKind = ownership ?? (inheritance ? realization ? "realization" : "inheritance" : explicitAttributes.relation);
      const semanticDashed = ownership ? arrow.includes(".") : relationKind === "realization" || relationKind === "dependency" ? true
        : ["inheritance", "aggregation", "composition", "association"].includes(relationKind ?? "") ? false : undefined;
      connections.push({
        id: connectionId(from, to, connections.length),
        from,
        to,
        ...(relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {}),
        dashed: bracket ? ["dashed","dotted"].includes(bracketStyle ?? "") : semanticDashed ?? (arrow.includes(".") || (!undirected && arrow.includes("--"))),
        order: connections.length,
        ...((edgeOptions || bracket || arrow.includes("=") || undirected || bidirectional || ownership || inheritance || direction || Object.keys(namedRows).length) ? {attributes:{...explicitAttributes,...(lineColor?{lineColor}:{}),...(thickness!==undefined?{thickness}:{}),...(bracketStyle?{lineStyle:bracketStyle}:{}),...(arrow.includes("=")?{lineStyle:"bold"}:{}),...namedRows,...(bidirectional?{bidirectional:"true"}:{}),...(direction ? {layoutDirection:direction,layoutFrom:resolveComponent(relation[1]!),layoutTo:resolveComponent(relation[3]!)} : {}),...(ownership ? {relation:ownership,...(!undirected?{navigable:"true"}:{})} : inheritance ? {relation:realization?"realization":"inheritance"} : explicitAttributes.relation ? {} : undirected ? {relation:"association"} : {})}} : {}),
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
      if (["usecase/", "actor/"].includes(declaration[1]!)) attributes.business = "true";
      declarationKinds.set(id,jsonEntries.has(id) ? "json" : keyword);
      if (jsonEntries.has(id)) { attributes.mapEntries = JSON.stringify(jsonEntries.get(id)); attributes.jsonRoot = jsonOwners.get(id)!; }
      if(line.decoration.tags.length)componentTags.push({id,values:line.decoration.tags});
      if(line.decoration.stereotype){attributes.stereotype=line.decoration.stereotype;attributes.stereotypes=JSON.stringify(line.decoration.stereotypes); }
      const defaultShape: Record<string, string> = {
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
        cloud: "cloud",
      };
      if (keyword === "folder" || keyword === "frame") attributes.containerStyle = keyword;
      const nodeBlock = ["node","database","cloud","rectangle","component","queue","file","artifact","card","hexagon","stack","action","storage","process"].includes(keyword) && Boolean(declaration[5]);
      if (nodeBlock) attributes.containerStyle = keyword;
      if (["artifact", "device"].includes(keyword) && !attributes.stereotype) attributes.stereotype = keyword;
      const shape = jsonEntries.has(id) ? "uml-map" : attributes.shape ?? (nodeBlock ? "container" : defaultShape[keyword] ?? keyword);
      delete attributes.shape;
      const activeContainer = containerStack[containerStack.length - 1];
      if(["port","portin","portout"].includes(keyword) && activeContainer){attributes.boundaryPort="true";attributes.portDirection=keyword==='portout'?'out':keyword==='portin'?'in':'auto';}
      const node: SemanticNode = {
        id,
        label: unquote(declaration[3], id),
        shape,
        ...(activeContainer ? { parentId: activeContainer } : {}),
        attributes,
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
  for(const [id,kind] of compactKinds){
    const declared=declarationKinds.get(id);
    if(declared && declared!==kind)throw new Error(`Conflicting endpoint kinds for "${id}": ${declared} and ${kind}. Use distinct IDs.`);
  }
  for(const node of implicitComponents.values())if(!nodes.some(existing=>existing.id===node.id))nodes.push(node);
  if(componentStyle)for(const node of nodes)if((node.shape==="component" || node.attributes.containerStyle==="component") && node.attributes.componentStyle===undefined)node.attributes.componentStyle=componentStyle;
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Connection references unknown node "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Connection references unknown node "${edge.to}".`);
    for (const endpoint of ["from", "to"] as const) {
      const row = edge.attributes?.[`${endpoint}MapRow`];
      if (row === undefined) continue;
      const node = nodes.find(node => node.id === edge[endpoint])!;
      const entries = JSON.parse(node.attributes.mapEntries ?? "[]") as MapEntry[];
      if (node.shape !== "uml-map" || !/^\d+$/.test(row) || !Number.isSafeInteger(Number(row)) || Number(row) >= entries.length) {
        throw new Error(`Invalid ${endpoint}MapRow "${row}" for "${node.id}"; expected an existing JSON row index.`);
      }
    }
  }
  for (const node of nodes) if (node.parentId && !ids.has(node.parentId)) throw new Error(`Node "${node.id}" references unknown container "${node.parentId}".`);
  for(const node of nodes)if(node.attributes.boundaryPort === "true" && deploymentDirection === "down")node.attributes.portLabelSide="left";
  const parents=new Map(nodes.map(node=>[node.id,node]));
  for(const node of nodes){
    if(node.parentId && parents.get(node.parentId)!.shape!=="container")throw new Error(`Node "${node.id}" requires a container parent; "${node.parentId}" is not a group.`);
    const seen=new Set<string>();let current:SemanticNode|undefined=node;
    while(current){
      if(seen.has(current.id))throw new Error(`Containment cycle involving "${current.id}".`);
      seen.add(current.id);current=current.parentId?parents.get(current.parentId):undefined;
    }
  }

  const model: SemanticModel = { kind: "deployment", nodes, connections, groups: [], source, direction:deploymentDirection };
  for(const node of implicitComponents.values())if(!declarationKinds.has(node.id))declarationKinds.set(node.id,["component","actor","usecase"].includes(node.shape)?node.shape:"interface");
  for(const tag of componentTags){
    const node=nodes.find(node=>node.id===tag.id);
    if(!node)throw new Error(`Unknown tag target ${tag.id}.`);
    node.attributes.tags=JSON.stringify([...new Set([...(JSON.parse(node.attributes.tags ?? '[]') as string[]),...tag.values])]);
  }
  applyComponentDisplay(model,displayRules,declarationKinds);
  return model;
}

export function parseSequence(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseSequence);if(decorated)return decorated;
  const pageLines=meaningfulLines(source);
  if(pageLines.some(line=>line.text==='ignore newpage')){
    const ignored=new Set(pageLines.filter(line=>line.text==='ignore newpage' || /^newpage(?:\s+"(?:\\.|[^"\\])*")?$/.test(line.text)).map(line=>line.number));
    const combined=source.split(/\r?\n/).map((line,index)=>ignored.has(index+1)?'':line).join('\n');
    return {...parseSequence(combined),source};
  }
  const annotated = withAnnotations(source, parseSequence);
  if (annotated) return annotated;
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const groups: SemanticGroup[] = [];
  const openGroups: SemanticGroup[] = [];
  const activationDepth = new Map<string, number>();
  const destroyed = new Set<string>();
  const used = new Set<string>();
  const createdIds = new Set<string>();
  const lifeChanges = new Map<string,number>();
  const snapshot = () => ({ depth:new Map(activationDepth), dead:new Set(destroyed), used:new Set(used), changes:new Map(lifeChanges) });
  type Snapshot = ReturnType<typeof snapshot>;
  const frames: Array<{ base:Snapshot; ends:Snapshot[] }> = [];
  const boundaries: Array<{kind:string;at:number;serial:number}> = [];
  let serial = 0;
  const timeAnchors=new Map<string,{edge:SemanticConnection;endpoint:"send"|"receive"}>();
  const durations:Array<{from:string;to:string;label:string}>=[];
  let numbering: {value:number;step:number;format?:string;prefix?:number[];separators?:string[]} | undefined;
  let pausedNumbering: typeof numbering;
  let footbox=false;
  const pageBreaks:NonNullable<SemanticModel['pageBreaks']>=[];
  const diagramText:{title?:string;header?:string;footer?:string;legend?:string}={};
  const restore = (state:Snapshot) => { activationDepth.clear(); state.depth.forEach((v,k)=>activationDepth.set(k,v)); destroyed.clear(); state.dead.forEach(id=>destroyed.add(id)); used.clear(); state.used.forEach(id=>used.add(id)); lifeChanges.clear();state.changes.forEach((v,k)=>lifeChanges.set(k,v)); };


  const ensureParticipant = (id: string, label = id, shape = "rectangle", line = 0): SemanticNode => {
    const existing = nodes.find((node) => node.id === id);
    if (existing) return existing;
    const node: SemanticNode = { id, label, shape, attributes: {} };
    assertUnique(nodes, node, line);
    nodes.push(node);
    return node;
  };

  for (const line of lines.slice(1)) {
    serial++;
    const page=line.text.match(/^newpage(?:\s+("(?:\\.|[^"\\])*"))?$/);
    if(page){pageBreaks.push({at:connections.length,serial,...(page[1] ? {title:JSON.parse(page[1]) as string} : {})});continue;}
    const decoration=line.text.match(/^(title|header|footer|legend)\s+("(?:\\.|[^"\\])*")$/);
    if(decoration){diagramText[decoration[1] as keyof typeof diagramText]=JSON.parse(decoration[2]!);continue;}
    const foot=line.text.match(/^(show|hide) footbox$/);
    if(foot){footbox=foot[1]==="show";continue;}
    const anchor=line.text.match(/^anchor\s+([\w.-]+)(?:\s+(send|receive))?$/);
    if(anchor){
      const previous=connections[connections.length-1];
      if(!previous || ['ref','delay','divider','note'].includes(previous.attributes?.messageKind ?? ''))throw new Error('A time anchor must follow a message.');
      if(timeAnchors.has(anchor[1]!))throw new Error(`Duplicate time anchor "${anchor[1]}".`);
      timeAnchors.set(anchor[1]!,{edge:previous,endpoint:anchor[2] === "receive" ? "receive" : "send"});continue;
    }
    const duration=line.text.match(/^duration\s+([\w.-]+)\s+([\w.-]+)\s+"([^"\n]+)"$/);
    if(duration){durations.push({from:duration[1]!,to:duration[2]!,label:duration[3]!});continue;}
    const increment=line.text.match(/^autonumber\s+inc\s+([A-Z])$/);
    if(increment){
      if(!numbering)throw new Error('Autonumber inc requires active numbering.');
      const values=[...(numbering.prefix ?? []),numbering.value];
      const index=increment[1]!.charCodeAt(0)-65;
      if(index>=values.length)throw new Error('Autonumber level is out of range.');
      values[index]!++;
      if(!Number.isSafeInteger(values[index]))throw new Error('Autonumber overflow.');
      for(let i=index+1;i<values.length;i++)values[i]=1;
      numbering.value=values.pop()!;numbering.prefix=values;
      continue;
    }
    const number = line.text.match(/^autonumber(?:\s+(stop|resume|\d+(?:[.;,:]\d+)*))?(?:\s+(\d+))?(?:\s+"([^"]*)")?$/);
    if(number) {
      const format=number[3];
      if(format!==undefined && !/\{n(?::0?[1-9]\d?)?\}/.test(format))decimalSequenceNumber(1,format);
      if(number[1] === "stop" && (format!==undefined || number[2]!==undefined))throw new Error('Autonumber stop does not accept arguments.');
      if(number[1] === "stop") { pausedNumbering=numbering ?? pausedNumbering;numbering=undefined; }
      else if(number[1] === "resume") {
        numbering=numbering ?? pausedNumbering ?? {value:1,step:1};
        if(number[2]!==undefined){const step=Number(number[2]);if(!Number.isSafeInteger(step)||step<=0)throw new Error("Invalid autonumber step.");numbering.step=step;}
      }
      else {
        const raw=number[1] ?? '1';const values=raw.split(/[.;,:]/).map(Number);const step=Number(number[2] ?? 1);
        if(values.some(value=>!Number.isSafeInteger(value))||!Number.isSafeInteger(step)||step<=0)throw new Error("Invalid autonumber.");
        numbering={value:values.pop()!,step,prefix:values,separators:raw.match(/[.;,:]/g) ?? []};
      }
      if(numbering && format!==undefined)numbering.format=format;
      continue;
    }
    const across=line.text.match(/^(?:note|rnote|hnote)\s+across\s*:\s*(.+)$/);
    const spanningNote=line.text.match(/^(?:note|rnote|hnote)\s+over\s+([\w.-]+(?:\s*,\s*[\w.-]+)*)\s*:\s*(.+)$/);
    const reference = line.text.match(/^ref\s+(?:over\s+)?([\w.,-]+)\s*:\s*(.+)$/);
    const delay = line.text.match(/^delay\s+(.+)$/);
    const divider = line.text.match(/^divider\s+(.+)$/) ?? line.text.match(/^==\s*(.+?)\s*==$/);
    if(across || spanningNote || reference || delay || divider) {
      const ids=(spanningNote ?? reference) ? (spanningNote ?? reference)![1]!.split(",").map(id=>id.trim()) : nodes.map(n=>n.id);
      if(!ids.length && !across) throw new Error("Declare participants before delay or divider.");
      for(const id of ids) { if(!divider && !across && destroyed.has(id)) throw new Error("Fragment uses a destroyed participant.");ensureParticipant(id); }
      connections.push({id:across?`across-${connections.length+1}`:connectionId(ids[0]!,ids[ids.length-1]!,connections.length),from:ids[0] ?? '',to:ids[ids.length-1] ?? '',order:connections.length,dashed:false,attributes:{...(across?{noteAcross:"true"}:{}),...(spanningNote||across?{noteShape:line.text.split(/\s+/)[0]!}:{}),messageKind:spanningNote || across ? "note" : reference ? "ref" : divider ? "divider" : "delay",fragmentLabel:unquote(across?.[1] ?? spanningNote?.[2] ?? reference?.[2] ?? delay?.[1] ?? divider?.[1],""),participants:ids.join(",")}});
      continue;
    }
    const control = line.text.match(/^(activate|deactivate|create|destroy)\s+([\w.-]+)(?:\s+"([^"]+)")?$/);
    if (control) {
      const [,op,id,label] = control;
      const node = ensureParticipant(id!, label ?? id!);
      if (destroyed.has(id!)) throw new Error(`Line ${line.number}: ${id} is already destroyed.`);
      const events = JSON.parse(node.attributes.sequenceEvents ?? "[]") as Array<{ kind: string; at: number; serial:number }>;
      if (op === "create" && used.has(id!)) throw new Error(`Line ${line.number}: create must precede use of ${id}.`);
      if (op === "activate") activationDepth.set(id!, (activationDepth.get(id!) ?? 0) + 1);
      if (op === "deactivate") {
        if ((activationDepth.get(id!) ?? 0) <= 0) throw new Error(`Line ${line.number}: no explicit activation for ${id}.`);
        activationDepth.set(id!, activationDepth.get(id!)! - 1);
      }
      if (op === "destroy") destroyed.add(id!);
      if(op === "create") createdIds.add(id!);
      if(op === "create" || op === "destroy") lifeChanges.set(id!,(lifeChanges.get(id!) ?? 0)+1);
      used.add(id!);
      events.push({ kind: op!, at: connections.length, serial } as typeof events[number]);
      node.attributes.sequenceEvents = JSON.stringify(events);
      if (op === "activate" || op === "deactivate") node.attributes.explicitActivation = "true";
      continue;
    }
    const participant = line.text.match(/^(participant|actor|boundary|control|entity|database|collections|queue)\s+([\w.-]+)(?:\s+(?:as\s+)?("(?:\\.|[^"])*"|.+))?$/i);
    if (participant) {
      const id=participant[2]!;
      const node=ensureParticipant(id,id,"rectangle",line.number);
      node.label=unquote(participant[3]?.trim(),id);
      node.shape=({actor:"actor",boundary:"sequence-boundary",control:"sequence-control",entity:"sequence-entity",database:"database",collections:"sequence-collections",queue:"sequence-queue"} as Record<string,string>)[participant[1]!.toLowerCase()] ?? "rectangle";
      continue;
    }

    const branch = line.text.match(/^(else|and)(?:\s+(.+))?$/i);
    if (branch) {
      const group = openGroups[openGroups.length - 1];
      if (!group || (branch[1] === "else" ? group.kind !== "alt" : group.kind !== "par")) throw new Error(`Line ${line.number}: ${branch[1]} requires ${branch[1] === "else" ? "alt" : "par"}.`);
      if (connections.length === (group.branches?.slice(-1)[0]?.start ?? group.start)) throw new Error(`Line ${line.number}: empty branch.`);
      const frame = frames[frames.length-1]!; frame.ends.push(snapshot()); restore(frame.base);
      boundaries.push({kind:"branch-reset",at:connections.length,serial});
      (group.branches ??= []).push({ start: connections.length, label: branch[2] ?? branch[1]! });
      continue;
    }
    const groupStart = line.text.match(/^(group|alt|opt|loop|par|break|critical)\s+(.+)$/i);
    if (groupStart) {
      const group: SemanticGroup = {
        id: uniqueId("group", groups.length),
        label: groupStart[2]?.trim() ?? "Group",
        kind: (groupStart[1]?.toLowerCase() ?? "group") as NonNullable<SemanticGroup["kind"]>,
        start: connections.length,
        end: connections.length,
      };
      groups.push(group);
      openGroups.push(group);
      frames.push({base:snapshot(),ends:[]});
      boundaries.push({kind:"branch-save",at:connections.length,serial});
      continue;
    }
    if (/^end$/i.test(line.text)) {
      const group = openGroups.pop();
      if (!group) throw new Error(`Line ${line.number}: unexpected end.`);
      if (group.branches?.slice(-1)[0]?.start === connections.length) throw new Error(`Line ${line.number}: empty branch.`);
      const frame = frames.pop()!;
      frame.ends.push(snapshot());
      if(group.kind === "par") for(const id of new Set(frame.ends.flatMap(state=>[...state.changes.keys()]))) {
        if(frame.ends.filter(state=>(state.changes.get(id) ?? 0) > (frame.base.changes.get(id) ?? 0)).length > 1) throw new Error(`Parallel operands have conflicting lifetimes for ${id}.`);
      }
      if (["opt","loop"].includes(group.kind ?? "")) frame.ends.push(frame.base);
      // A post-fragment message must be safe on every alternative path.
      if (["alt","opt","loop","par"].includes(group.kind ?? "")) {
        restore(frame.base);
        for (const state of frame.ends) { state.dead.forEach(id=>destroyed.add(id)); state.used.forEach(id=>used.add(id)); }
        for(const id of createdIds) if(frame.ends.some(state=>!state.used.has(id))) destroyed.add(id);
        for (const id of new Set(frame.ends.flatMap(state=>[...state.depth.keys()]))) {
          const depths = frame.ends.map(state=>state.depth.get(id) ?? 0);
          activationDepth.set(id, depths.every(d=>d===depths[0]) ? depths[0]! : -1);
        }
      }
      if (["opt","loop"].includes(group.kind ?? "")) boundaries.push({kind:"branch-reset",at:connections.length,serial:serial-0.1});
      boundaries.push({kind:"branch-end",at:connections.length,serial});
      group.end = Math.max(group.start, connections.length - 1);
      continue;
    }

    let messageLine=line.text;
    const messageOptions:Record<string,string>={};
    let optionBlock:RegExpMatchArray|null;
    while((optionBlock=messageLine.match(/\s+\[((?:id|delay|lineColor|lineStyle|thickness)=[^\]]*)\]$/))){
      for(const option of optionBlock[1]!.trim().split(/\s+/)){
        const match=option.match(/^(id|delay|lineColor|lineStyle|thickness)=(.+)$/);
        if(!match)throw new Error(`Invalid message option "${option}".`);
        if(messageOptions[match[1]!]!==undefined)throw new Error(`Duplicate message option "${match[1]}".`);
        messageOptions[match[1]!]=match[2]!;
      }
      messageLine=messageLine.slice(0,optionBlock.index);
    }
    const messageId=messageOptions.id;
    if(messageId!==undefined && !/^[\w.-]+$/.test(messageId))throw new Error('Invalid message id.');
    const receiveOffset=messageOptions.delay===undefined ? 0 : Number(messageOptions.delay);
    if(!Number.isFinite(receiveOffset) || receiveOffset<0 || receiveOffset>10000)throw new Error('Message delay must be between 0 and 10000.');
    const reverseMessage=messageLine.match(/^([\w.-]+|\[|\]|\?)\s*(<<?-{1,2})\s*([\w.-]+|\[|\]|\?)\s*(?::\s*(.*))?$/);
    const messageText=reverseMessage ? `${reverseMessage[3]} ${reverseMessage[2]!.split('').reverse().join('').replace(/</g,'>')} ${reverseMessage[1]}${reverseMessage[4]===undefined ? '' : `: ${reverseMessage[4]}`}` : messageLine;
    const message = messageText.match(/^([\w.-]+|\[|\]|\?)\s*(-{1,2}>>?|-->>?)\s*([\w.-]+|\[|\]|\?)\s*(?::\s*(.*))?$/);
    if (message) {
      const from = message[1] ?? "";
      const arrow = message[2] ?? "->";
      const to = message[3] ?? "";
      if (destroyed.has(from) || destroyed.has(to)) throw new Error(`Line ${line.number}: message uses a destroyed participant.`);
      if(['[',']','?'].includes(from) && ['[',']','?'].includes(to))throw new Error('An external message needs a participant.');
      if(!['[',']','?'].includes(from))ensureParticipant(from, from, "rectangle", line.number);
      if(!['[',']','?'].includes(to))ensureParticipant(to, to, "rectangle", line.number);
      if(connections.some(edge=>edge.id===(messageId ?? connectionId(from,to,connections.length))))throw new Error(`Duplicate message id "${messageId ?? connectionId(from,to,connections.length)}".`);
      used.add(from); used.add(to);
      const activeGroup = openGroups[openGroups.length - 1];
      connections.push({
        id: messageId ?? connectionId(from, to, connections.length),
        from,
        to,
        ...((numbering || message[4]?.trim()) ? { label: `${numbering ? sequenceNumber(numbering)+" " : ""}${message[4]?.trim() ?? ""}` } : {}),
        dashed: arrow.includes("--"),
        attributes: { ...Object.fromEntries(Object.entries(messageOptions).filter(([key])=>["lineColor","lineStyle","thickness"].includes(key))), ...(messageOptions.delay!==undefined ? {receiveOffset:String(receiveOffset)} : {}), messageKind: arrow.includes("--") ? "reply" : arrow.endsWith(">>") ? "async" : "call", ...(['[',']','?'].includes(from) ? {external:"incoming"} : ['[',']','?'].includes(to) ? {external:"outgoing"} : {}), ...((from==='[' || to==='[') ? {externalSide:"left"} : (from===']' || to===']') ? {externalSide:"right"} : {}), ...(from==='?' ? {unknownEndpoint:"found",externalSide:reverseMessage ? "right" : "left"} : to==='?' ? {unknownEndpoint:"lost",externalSide:reverseMessage ? "left" : "right"} : {}) },
        order: connections.length,
        ...(activeGroup ? { groupId: activeGroup.id } : {}),
      });
      if(numbering) {if(!Number.isSafeInteger(numbering.value))throw new Error("Autonumber overflow.");numbering.value+=numbering.step;}
      continue;
    }
    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (openGroups.length) throw new Error(`Group "${openGroups[openGroups.length - 1]?.label}" is missing end.`);
  for (const node of nodes) {
    if(footbox)node.attributes.footbox="true";
    const events = JSON.parse(node.attributes.sequenceEvents ?? "[]") as Array<{ kind: string; at: number; serial:number }>;
    for (const created of events.filter(event => event.kind === "create")) if (connections[created.at]?.to !== node.id) throw new Error(`create ${node.id} must precede a message to ${node.id}.`);
    if (boundaries.length) {
      node.attributes.sequenceEvents = JSON.stringify([...events,...boundaries].sort((a,b)=>a.serial-b.serial));
      if (events.some(event => event.kind === "create")) node.attributes.branchLifetime = "true";
    }
  }
  for(const note of connections.filter(edge=>edge.attributes?.noteAcross==='true')){
    if(!nodes.length)throw new Error('note across requires at least one participant.');
    note.from=nodes[0]!.id;note.to=nodes[nodes.length-1]!.id;
    note.attributes!.participants=nodes.map(node=>node.id).join(',');
  }
  const sequenceIds=new Set<string>();
  for(const connection of connections){
    if(sequenceIds.has(connection.id))throw new Error(`Duplicate message id "${connection.id}".`);
    sequenceIds.add(connection.id);
  }
  for(const duration of durations){
    const from=timeAnchors.get(duration.from),to=timeAnchors.get(duration.to);
    if(!from || !to)throw new Error('Duration references an unknown time anchor.');
    for(const group of groups.filter(group=>group.kind==='alt')){
      const operand=(order:number)=>order<group.start || order>group.end ? -1 : (group.branches ?? []).filter(branch=>branch.start<=order).length;
      const left=operand(from.edge.order),right=operand(to.edge.order);
      if(left>=0 && right>=0 && left!==right)throw new Error('Duration endpoints cannot belong to mutually exclusive alternatives.');
    }
    if(to.edge.order<from.edge.order || to.edge.order===from.edge.order && !(from.endpoint==='send' && to.endpoint==='receive'))throw new Error('Duration end must follow its start.');
    const attributes=from.edge.attributes ?? (from.edge.attributes={});
    const spans=JSON.parse(attributes.durations ?? '[]') as Array<{to:string;label:string;fromEndpoint?:string;toEndpoint?:string}>;
    spans.push({to:to.edge.id,label:duration.label,...(from.endpoint==='receive'?{fromEndpoint:from.endpoint}:{}),...(to.endpoint==='receive'?{toEndpoint:to.endpoint}:{})});attributes.durations=JSON.stringify(spans);
  }
  return { kind: "sequence", nodes, connections, groups, source, ...(pageBreaks.length ? {pageBreaks} : {}), ...(Object.keys(diagramText).length ? {diagramText} : {}) };
}

function parseSimpleDirectedGraph(
  source: string,
  kind: string,
  declarationShapes: Record<string, string>,
  defaultLabels: Record<string, string> = {},
): SemanticModel {
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const keywords = Object.keys(declarationShapes).join("|");
  const parents: string[] = [];
  const declarationPattern = new RegExp(`^(${keywords})\\s+([\\w.-]+)(?:\\s+(\"(?:\\\\.|[^\"])*\"|[^\\s\\[]+))?(?:\\s*\\[([^\\]]+)\\])?$`, "i");

  for (const line of lines.slice(1)) {
    if (line.text === "}") {
      if (!parents.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
      continue;
    }
    const block = line.text.match(/^(state|region|lane)\s+([\w.-]+)(?:\s+"([^"]+)")?(?:\s*\[([^\]]+)\])?\s*\{$/);
    if (block) {
      if (!(kind === "state" && ["state", "region"].includes(block[1]!) || kind === "activity" && block[1] === "lane")) throw new Error(`Line ${line.number}: unsupported block.`);
      if (block[1] === "lane" && parents.length) throw new Error(`Line ${line.number}: lanes cannot be nested.`);
      if (block[1] === "region" && !parents.length) throw new Error(`Line ${line.number}: region requires a containing state.`);
      const blockAttributes=attributesFrom(block[4]);
      if(blockAttributes.regions && (block[1]!=='state' || !['rows','columns'].includes(blockAttributes.regions)))throw new Error('regions must be rows or columns on a composite state.');
      const node: SemanticNode = { id: block[2]!, label: block[3] ?? block[2]!, shape: "container", attributes: { ...blockAttributes, umlBlock: block[1]!, ...(kind === "state" ? { stateKind: block[1]! } : {}) }, ...(parents.length ? { parentId: parents[parents.length - 1]! } : {}) };
      assertUnique(nodes, node, line.number); nodes.push(node); parents.push(node.id); continue;
    }
    const relation = line.text.match(/^([\w.-]+)\s+(-{1,2}>|\.\.>)\s+([\w.-]+)(?:(?:\s*:\s*(.+))|(?:\s+(\[[^\]]+\](?:\s*\/\s*.+)?)))?$/);
    if (relation) {
      const from = relation[1] ?? "";
      const to = relation[3] ?? "";
      const rawLabel = (relation[4] ?? relation[5])?.trim();
      let label = rawLabel;
      let attributes: Record<string, string> | undefined;
      const portBlock = rawLabel?.match(/^(.*?)(?:\s*)\[([^\]]*(?:fromPort|from-port|toPort|to-port|kind|id|pre|post|lineColor|lineStyle|thickness)\s*=.+)\]$/i);
      if (portBlock) {
        const parsed = attributesFrom(portBlock[2]);
        const fromPort = parsed.fromPort ?? parsed["from-port"];
        const toPort = parsed.toPort ?? parsed["to-port"];
        const validPorts = new Set(["top", "right", "bottom", "left"]);
        if (fromPort && !validPorts.has(fromPort.toLowerCase())) throw new Error(`Line ${line.number}: invalid fromPort "${fromPort}".`);
        if (toPort && !validPorts.has(toPort.toLowerCase())) throw new Error(`Line ${line.number}: invalid toPort "${toPort}".`);
        attributes = {
          ...Object.fromEntries(Object.entries(parsed).filter(([key])=>["lineColor","lineStyle","thickness"].includes(key))),
          ...(kind === "state" ? { ...parsed, ...(parsed.kind ? { transitionKind: parsed.kind } : {}) } : {}),
          ...(fromPort ? { fromPort: fromPort.toLowerCase() } : {}),
          ...(toPort ? { toPort: toPort.toLowerCase() } : {}),
        };
        label = portBlock[1]?.trim() || undefined;
      }
      if (kind === "state") {
        const parts = parseStateTransition(unquote(label, ""));
        attributes = { ...parts, transitionKind: "external", ...attributes };
        if (!["external", "local"].includes(attributes.transitionKind!)) throw new Error("State transition kind must be external or local; use internal for a state-body transition.");
        if (attributes.pre !== undefined || attributes.post !== undefined) label = `${attributes.pre !== undefined ? `[${attributes.pre}] ` : ""}${label ?? ""}${attributes.post !== undefined ? ` / [${attributes.post}]` : ""}`;
        if (attributes.transitionKind === "local") label = `${label ?? ""} {local}`.trim();
      }
      connections.push({
        id: attributes?.id ?? connectionId(from, to, connections.length),
        from,
        to,
        ...(label ? { label: unquote(label, "") } : {}),
        dashed: (relation[2] ?? "").includes("--") || (relation[2] ?? "").includes(".."),
        order: connections.length,
        ...(attributes ? { attributes } : {}),
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
      const node: SemanticNode = {
        id,
        label: unquote(declaration[3], defaultLabels[keyword] ?? id),
        shape,
        ...(parents.length ? { parentId: parents[parents.length - 1]! } : {}),
        attributes,
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
    if(kind==='activity' && ['end','flowfinal'].includes(nodes.find(n=>n.id===edge.from)?.attributes.activityKind ?? ''))throw new Error(`Activity final "${edge.from}" cannot have outgoing connections.`);
  }
  return { kind, nodes, connections, groups: [], source, ...(kind === "state" ? { direction: /\bdirection=LR\b/.test(lines[0]?.text ?? "") ? "right" as const : "down" as const } : {}) };
}

export function parseFlowchart(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseFlowchart);if(decorated)return decorated;
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
    node: "rectangle",
  }, { start: "Start", end: "End" });
}

export function parseGraph(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseGraph);if(decorated)return decorated;
  const annotated = withAnnotations(source, parseGraph);
  if (annotated) return annotated;
  const lines = meaningfulLines(source);
  const directive = lines[0]?.text ?? "";
  const rawOptions = directive.replace(/^@graph\b/i, "").trim();
  let direction: "right" | "down" = "down";
  if (rawOptions) {
    const normalized = rawOptions.replace(/^\[|\]$/g, "").trim();
    const option = normalized.match(/^direction\s*=\s*(LR|TB|TD)$/i);
    if (!option) throw new Error(`Line ${lines[0]?.number ?? 1}: unsupported @graph option "${rawOptions}".`);
    direction = option[1]?.toUpperCase() === "LR" ? "right" : "down";
  }

  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const groupStack: string[] = [];
  const implicitIds = new Set<string>();
  const nodeById = () => new Map(nodes.map((node) => [node.id, node]));
  const activeGroup = () => groupStack[groupStack.length - 1];

  const ensureNode = (id: string): SemanticNode => {
    const existing = nodes.find((node) => node.id === id);
    if (existing) return existing;
    const parentId = activeGroup();
    const node: SemanticNode = {
      id,
      label: id,
      shape: "rectangle",
      ...(parentId ? { parentId } : {}),
      attributes: {},
    };
    nodes.push(node);
    implicitIds.add(id);
    return node;
  };

  const declareNode = (node: SemanticNode, line: number): void => {
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
        ...(relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {}),
        dashed: arrow.includes("--") || arrow.includes(".."),
        order: connections.length,
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
        label: unquote(group[2], id),
        shape: "container",
        ...(parentId ? { parentId } : {}),
        attributes,
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
        label: unquote(declaration[2], id),
        shape,
        ...(parentId ? { parentId } : {}),
        attributes,
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

export function parseState(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseState);if(decorated)return decorated;
  const lines = meaningfulLines(source);
  const body: string[] = [];
  let blockDepth = 0;
  const machines: Record<string, SemanticModel> = Object.create(null);
  for (let i = 0; i < lines.length; i++) {
    const definition = lines[i]!.text.match(/^machine\s+([\w.-]+)(?:\s+extends\s+([\w.-]+))?(?:\s+(protocol))?\s*\{$/);
    if (!definition) {
      const line = lines[i]!.text;
      if (/^(state|region)\b.*\{$/.test(line)) blockDepth++;
      if (line === "}") blockDepth--;
      body.push(line); continue;
    }
    if (blockDepth !== 0) throw new Error("Machine definitions must be top-level.");
    const name = definition[1]!;
    if (Object.prototype.hasOwnProperty.call(machines, name)) throw new Error(`Duplicate machine "${name}".`);
    let depth = 1; const content: string[] = [];
    for (i++; i < lines.length; i++) {
      const line = lines[i]!.text;
      if (/^(state|region)\b.*\{$/.test(line)) depth++;
      if (line === "}" && --depth === 0) break;
      content.push(line);
    }
    if (depth) throw new Error(`Unclosed machine "${name}".`);
    machines[name] = parseStateBody(`@state${definition[3] ? " protocol" : ""}${definition[2] ? " inherited" : ""}\n${content.join("\n")}`);
    if (definition[2]) machines[name]!.extendsMachine = definition[2];
  }
  const resolving = new Set<string>(), resolved = new Set<string>();
  const inherit = (name:string) => {
    if (resolved.has(name)) return;
    if (resolving.has(name)) throw new Error(`Cyclic machine inheritance: ${name}.`);
    const derived=machines[name]!; const baseName=derived.extendsMachine;
    if (baseName) {
      if (!machines[baseName]) throw new Error(`Unknown base machine ${baseName}.`);
      resolving.add(name); inherit(baseName); const base=machines[baseName]!;
      const ownIds=new Set(derived.nodes.map(n=>n.id)), edgeIds=new Set(derived.connections.map(e=>e.id));
      derived.nodes=[...base.nodes.filter(n=>!ownIds.has(n.id)).map(n=>({...n,attributes:{...n.attributes}})),...derived.nodes];
      derived.connections=[...base.connections.filter(e=>!edgeIds.has(e.id)).map(e=>({...e,attributes:{...e.attributes}})),...derived.connections];
      if (!derived.stateMachineKind && base.stateMachineKind) derived.stateMachineKind = base.stateMachineKind;
      resolving.delete(name);
    }
    resolved.add(name);
  };
  Object.keys(machines).forEach(inherit);
  for (const machine of Object.values(machines)) if (machine.extendsMachine) {
    const quote = (text:string) => `"${text.replace(/\\/g,"\\\\").replace(/"/g,'\\"')}"`;
    const lines = [`@state${machine.stateMachineKind === "protocol" ? " protocol" : ""}`];
    const write = (parent?:string) => {
      for (const node of machine.nodes.filter(n=>n.parentId === parent)) {
        const kind=node.attributes.stateKind ?? "state";
        const children=machine.nodes.some(n=>n.parentId === node.id);
        if(children && !node.attributes.submachine) {
          const attrs=Object.entries(node.attributes).filter(([key])=>!['stateKind','stateBody','stateBehaviors','connectionPoint','defer','invariant','kind','members'].includes(key)).map(([key,value])=>`${key}=${quote(value)}`).join(' ');
          lines.push(`${kind} ${node.id} ${quote(node.label)}${attrs ? ` [${attrs}]` : ''} {`);write(node.id);lines.push("}");
        }
        else {
          const attrs=Object.entries(node.attributes).filter(([key])=>!['stateKind','stateBody','stateBehaviors','connectionPoint','defer','invariant','kind','members'].includes(key)).map(([k,v])=>`${k}=${quote(v)}`).join(" ");
          lines.push(`${kind} ${node.id} ${quote(node.label)}${attrs ? ` [${attrs}]` : ""}`);
          if(children) write(node.id);
        }
        for(const behavior of JSON.parse(node.attributes.stateBehaviors ?? "[]")) lines.push(`${behavior.kind} ${node.id} ${quote(behavior.kind === "internal" ? `${behavior.trigger ?? ""}${behavior.guard !== undefined ? ` [${behavior.guard}]` : ""}${behavior.effect !== undefined ? ` / ${behavior.effect}` : ""}` : behavior.effect ?? "")}`);
        for(const key of ["defer","invariant"]) if(node.attributes[key]) lines.push(`${key} ${node.id} ${quote(node.attributes[key]!)}`);
      }
    };
    write();
    for(const edge of machine.connections) {
      const a=edge.attributes ?? {};
      const label=`${a.trigger ?? ""}${a.guard !== undefined ? ` [${a.guard}]` : ""}${a.effect !== undefined ? ` / ${a.effect}` : ""}`.trim();
      const attrs=[`id=${quote(edge.id)}`, `kind=${quote(a.transitionKind ?? a.kind ?? "external")}`, ...Object.entries(a).filter(([k])=>!["id","trigger","triggerKind","guard","effect","transitionKind","kind"].includes(k)).map(([k,v])=>`${k}=${quote(v)}`)].join(" ");
      lines.push(`${edge.from} ${edge.dashed ? "-->" : "->"} ${edge.to}: ${label} [${attrs}]`);
    }
    machine.source=lines.join("\n");
  }
  const model = parseStateBody(body.join("\n"));
  model.source = source;
  if (Object.keys(machines).length) model.stateMachines = machines;
  model.diagnostics = validateState(model);
  if (/\bvalidation=strict\b/.test(lines[0]?.text ?? "") && model.diagnostics.length) throw new Error(model.diagnostics.map(item => `${item.code}: ${item.message}`).join("\n"));
  return model;
}

function parseStateBody(source: string): SemanticModel {
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
    exitpoint: "exit-point",
  }, { initial: "", junction: "", choice: "", fork: "", join: "", history: "H", "deep-history": "H*", final: "", terminate: "" });
  if (/\bprotocol\b/.test(meaningfulLines(source)[0]?.text ?? "")) model.stateMachineKind = "protocol";
  for (const node of model.nodes) {
    if (["entrypoint", "exitpoint", "inputpin", "outputpin"].includes(node.attributes.stateKind ?? "")) {
      node.attributes.connectionPoint = "true";
      if (node.attributes.state) node.parentId = node.attributes.state;
    }
  }
  for (const edge of model.connections) {
    const from = model.nodes.find(n => n.id === edge.from);
    if (from?.attributes.stateKind === "entrypoint" && !from.attributes.ref) edge.attributes = { ...edge.attributes, transitionKind: "local" };
  }
  return model;
}

export function parseActivity(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseActivity);if(decorated)return decorated;
  const lanes=parseActivityLaneSwitches(source,parseActivity);
  if(lanes)return lanes;
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
    flowfinal: "exit-point",
  }, { start: "", fork: "", join: "", end: "", flowfinal: "" });
}


interface EntityField {
  name: string;
  type: string;
  flags: string[];
}

function normalizeCardinality(value: string): string {
  const normalized = value.toLowerCase();
  return ({
    one: "1",
    "zero-one": "0..1",
    many: "N",
    n: "N",
    "zero-many": "0..N",
  } as Record<string, string>)[normalized] ?? value.toUpperCase();
}

export function parseEr(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseEr);if(decorated)return decorated;
  const annotated = withAnnotations(source, parseEr);
  if (annotated) return annotated;
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  let active: { node: SemanticNode; fields: EntityField[]; line: number } | undefined;

  for (const line of lines.slice(1)) {
    if (active) {
      if (line.text === "}") {
        active.node.attributes.fields = JSON.stringify(active.fields);
        nodes.push(active.node);
        active = undefined;
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
      const node: SemanticNode = { id, label: unquote(entity[2], id), shape: "entity", attributes: {} };
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
        ...(relation[6]?.trim() ? { label: relation[6].trim() } : {}),
        dashed: (relation[3] ?? "").includes("--"),
        order: connections.length,
        attributes: {
          fromCardinality: normalizeCardinality(relation[2] ?? "1"),
          toCardinality: normalizeCardinality(relation[4] ?? "N"),
        },
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

export function parseComponent(source: string): SemanticModel {
  const model = parseDeployment(source);
  return { ...model, kind: "component" };
}

interface UmlMember {
  text: string;
  kind: "attribute" | "operation" | "literal" | "separator";
  separator?: string;
  visibilityEscaped?: boolean;
  static?: boolean;
  abstract?: boolean;
}

export function parseObject(source: string, implicitClassifiers = false): SemanticModel {
  const decorated=withDiagramText(source,value=>parseObject(value,implicitClassifiers));if(decorated)return decorated;
  const json=expandObjectJson(expandObjectNamespaces(source,implicitClassifiers));
  const expanded=expandObjectMaps(json.source,json.maps);
  const slots=new Map<string,string[]>();
  const objects=new Set([...expanded.source.matchAll(/^\s*object\s+([\w.-]+)/gm)].map(match=>match[1]!));
  const classifiers=new Set([...expanded.source.matchAll(/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)/gm)].map(match=>match[1]!));
  const additions=new Map<string,string[]>();
  const rules:string[]=[];
  let inBody=false;
  const objectLines=meaningfulLines(expanded.source).filter(line=>{
    if(inBody){if(line.text==='}')inBody=false;return true;}
    if(/^(object|package|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+/.test(line.text)){
      if(/^(object|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{$/.test(line.text))inBody=true;
      return true;
    }
    if(/^(hide|show|remove|restore)\s+/.test(line.text)){rules.push(line.text);return false;}
    const slot=line.text.match(/^([\w.-]+)\s*:(?!:)\s*(.+)$/);
    if(!slot || classifiers.has(slot[1]!))return true;
    if(expanded.maps.has(slot[1]!))throw new Error(`Map or JSON "${slot[1]}" entries must be declared in its body.`);
    if(implicitClassifiers && !objects.has(slot[1]!))return true;
    const values=additions.get(slot[1]!) ?? [];
    values.push(slot[2]!);additions.set(slot[1]!,values);return false;
  });
  let active:string | undefined;
  let classifierBody=false;
  const transformed=objectLines.map(line=>{
    if(line.text.startsWith("@object"))return line.text.replace("@object","@class");
    if(classifierBody){if(line.text==='}')classifierBody=false;return line.text;}
    if(active) {
      if(line.text === "}") {
        const extra=additions.get(active) ?? [];slots.get(active)!.push(...extra);
        active=undefined;return [...extra.map(text=>`{literal} ${text}`),'}'].join('\n');
      }
      slots.get(active)!.push(line.text);return `{literal} ${line.text}`;
    }
    if(/^(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{$/.test(line.text)){classifierBody=true;return line.text;}
    const declaration=line.text.match(/^object\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s{]+))?\s*(\{)?$/);
    if(declaration) {
      const id=declaration[1]!; if(slots.has(id))throw new Error(`Duplicate object ${id}.`);
      slots.set(id,declaration[3] ? [] : [...(additions.get(id) ?? [])]);
      if(declaration[3])active=id;
      return `class ${id} ${declaration[2] ?? `"${id}"`} {${declaration[3] ? "" : `\n${slots.get(id)!.map(text=>`{literal} ${text}`).join('\n')}\n}`}`;
    }
    return line.text;
  }).join("\n");
  for(const id of additions.keys())if(!slots.has(id))throw new Error(`Unknown object slot target "${id}".`);
  const model=parseClass(transformed,implicitClassifiers);
  for(const node of model.nodes) if(slots.has(node.id)) {
    node.shape="uml-instance";
    node.attributes.instance="true";
    node.attributes.slots=JSON.stringify(slots.get(node.id));
    node.attributes.members=JSON.stringify(slots.get(node.id)!.map(text=>({text,kind:"attribute"})));
  }
  for(const [id,entries] of expanded.maps){
    const node=model.nodes.find(n=>n.id===id)!;
    node.shape="uml-map";node.attributes.mapEntries=JSON.stringify(entries);
  }
  applyClassDisplay(model,rules);
  return {...model,kind:"object",source};
}

export function parseClass(source: string, implicit = true): SemanticModel {
  const decorated=withDiagramText(source,value=>parseClass(value,implicit));if(decorated)return decorated;
  let body=false;
  for(const line of meaningfulLines(source)){
    if(body){if(line.text==='}')body=false;continue;}
    if(/^(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{$/.test(line.text)){body=true;continue;}
    if(/^(object|json|map)\s+/.test(line.text))return {...parseObject(source.replace('@class','@object'),implicit),kind:'class',source};
  }
  let visibilityIconSize = 0;
  const parameters = new Map<string,string>();
  const rules: string[] = [];
  const tags: Array<{id:string;values:string[]}> = [];
  const bindings:Array<{from:string;to:string;text:string}>=[];
  let inClass = false;
  const normalized=expandClassNamespaces(source,implicit).split(/\r?\n/).map(line=>{
    const iconSetting=!inClass && line.trim().match(/^(?:skinparam\s+)?classAttributeIconSize\s+(\d+)$/);
    if(iconSetting){visibilityIconSize=Number(iconSetting[1]);if(visibilityIconSize>16)throw new Error("classAttributeIconSize must be between 0 and 16.");return "";}

    const binding=!inClass && line.trim().match(/^bind\s+([\w.-]+)\s+([\w.-]+)\s+"([^"]+)"$/);
    if(binding){bindings.push({from:binding[1]!,to:binding[2]!,text:binding[3]!});return "";}
    const tag=!inClass && line.trim().match(/^tag\s+([\w.-]+)\s+([\w.-]+(?:\s+[\w.-]+)*)$/);
    if(tag){tags.push({id:tag[1]!,values:tag[2]!.split(/\s+/)});return "";}
    if(!inClass && /^\s*(hide|show|remove|restore)\s+/.test(line)) {rules.push(line.trim());return "";}
    if(/^\s*(class|interface|abstract|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line))inClass=true;
    else if(inClass && line.trim() === "}")inClass=false;
    const match=line.match(/^(\s*)(class|abstract|interface|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)<(.+)>(\s*(?:"(?:\\.|[^"])*")?\s*\{)\s*$/);
    if(!match)return line;
    if(parameters.has(match[3]!))throw new Error(`Duplicate template ${match[3]}.`);
    parameters.set(match[3]!,match[4]!);
    return `${match[1]}${match[2]} ${match[3]}${match[5]}`;
  }).join("\n");
  const model=parseClassCore(expandClassMembers(normalized,implicit),implicit);
  for(const node of model.nodes)if(node.shape==="uml-class")node.attributes.visibilityIconSize=String(visibilityIconSize);
  for(const node of model.nodes) if(parameters.has(node.id))node.attributes.templateParameters=parameters.get(node.id)!;
  for(const tag of tags){
    const node=model.nodes.find(n=>n.id===tag.id && n.shape==='uml-class');
    if(!node)throw new Error(`Unknown class tag target ${tag.id}.`);
    node.attributes.tags=JSON.stringify([...new Set([...(JSON.parse(node.attributes.tags ?? '[]') as string[]),...tag.values])]);
  }
  for(const binding of bindings)addTemplateBinding(model,binding.from,binding.to,binding.text);
  applyClassDisplay(model,rules);
  return {...model,source};
}

function parseClassCore(source: string, implicit: boolean): SemanticModel {
  const annotated = withAnnotations(source, value=>parseClass(value,implicit));
  if (annotated) return annotated;
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  let active: { node: SemanticNode; members: UmlMember[]; line: number } | undefined;
  const packages: string[] = [];
  const inferredParents=new Map<string,string|undefined>();

  for (const line of lines.slice(1)) {
    if (active) {
      if (line.text === "}") {
        active.node.attributes.members = JSON.stringify(active.members);
        nodes.push(active.node);
        active = undefined;
        continue;
      }
      if(line.text.startsWith('{literal} ')){
        active.members.push({text:line.text.slice(10),kind:'attribute'});continue;
      }
      const separator=line.text.match(/^(--|\.\.|==|__)(?:\s+(.*?)\s*\1)?$/);
      if(separator){active.node.attributes.customCompartments="true";active.members.push({kind:"separator",text:separator[2] ?? "",separator:separator[1]!});continue;}
      let {text:memberText,modifiers}=parseMemberModifiers(line.text);
      const visibilityEscaped=/^\\[+~#-]/.test(memberText);
      if(visibilityEscaped)memberText=memberText.slice(1);
      const kind = active.node.attributes.kind === "enum" ? "literal"
        : modifiers.has('field') ? "attribute" : modifiers.has('method') || memberText.includes('(') ? "operation" : "attribute";
      active.members.push({text:memberText,kind,...(visibilityEscaped?{visibilityEscaped:true}:{}),...(modifiers.has('static') ? {static:true} : {}),...(modifiers.has('abstract') ? {abstract:true} : {})});
      continue;
    }

    if (line.text === "}") {
      if (!packages.pop()) throw new Error(`Line ${line.number}: unexpected closing brace.`);
      continue;
    }
    const packageBlock = line.text.match(/^package\s+([\w.-]+)(?:\s+"([^"]+)")?(?:\s+(\[namespace\]))?\s*\{$/);
    if (packageBlock) {
      const node: SemanticNode = { id: packageBlock[1]!, label: packageBlock[2] ?? packageBlock[1]!, shape: "container", attributes: { umlBlock: "package" }, ...(packages.length ? { parentId: packages[packages.length - 1]! } : {}) };
      if(packageBlock[3])node.attributes.namespace="true";
      const existing=nodes.find(n=>n.id===node.id);
      if(existing && packageBlock[3] && existing.attributes.namespace==="true") {
        if(existing.parentId!==node.parentId || existing.label!==node.label)throw new Error(`Conflicting namespace declaration "${node.id}".`);
      } else {assertUnique(nodes,node,line.number);nodes.push(node);}
      packages.push(node.id); continue;
    }
    const namedNote=line.text.match(/^(note|rnote|hnote)\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+)$/);
    if(namedNote){
      const node:SemanticNode={id:namedNote[3]!,label:unquote(namedNote[2],""),shape:"uml-artifact",attributes:{standaloneNote:"true",noteShape:namedNote[1]!,tone:"amber"},...(packages.length?{parentId:packages[packages.length-1]!}:{})};
      assertUnique(nodes,node,line.number);nodes.push(node);continue;
    }
    const circle = line.text.match(/^circle\s+([\w.-]+)(?:\s+("(?:\\.|[^"\\])*"))?$/);
    if(circle){
      const node: SemanticNode = {id:circle[1]!,label:unquote(circle[2],circle[1]!.split('.').pop()!),shape:"uml-provided-interface",attributes:{kind:"interface"},...(packages.length ? {parentId:packages[packages.length-1]!} : {})};
      assertUnique(nodes,node,line.number);nodes.push(node);continue;
    }
    const diamond = line.text.match(/^diamond\s+([\w.-]+)(?:\s+("(?:\\.|[^"\\])*"))?$/);
    if (diamond) {
      const node: SemanticNode = {id:diamond[1]!,label:unquote(diamond[2],""),shape:"diamond",attributes:{kind:"association"},...(packages.length ? {parentId:packages[packages.length-1]!} : {})};
      assertUnique(nodes,node,line.number);nodes.push(node);continue;
    }
    const declaration = line.text.match(/^(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)(?:\s+("(?:\\.|[^"])*"|[^\s\{]+))?\s*\{$/i);
    if (declaration) {
      const kind = declaration[1]?.toLowerCase() ?? "class";
      const id = declaration[2] ?? "";
      const node: SemanticNode = {
        id,
        label: unquote(declaration[3], id),
        shape: "uml-class",
        ...(packages.length ? { parentId: packages[packages.length - 1]! } : {}),
        attributes: { kind },
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
      const reversed = (specialNavigation && operator.startsWith("<")) || ["<|--", "<|..", "--*", "..*", "--o", "..o", "<--", "<..", "<--*", "<..*", "<--o", "<..o", "<--x", "<..x"].includes(operator);
      const relationKind = ({
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
        "--": "association",
      } as Record<string, string>)[operator] ?? (specialNavigation ? "directed-association" : "association");
      const rawLabel=relation[8]?.trim();
      const reading=rawLabel?.match(/^(<|>)\s+(.+)$|^(.+?)\s+(<|>)$/);
      const label=reading ? (reading[2] ?? reading[3])! : rawLabel;
      const labelDirection=reading ? (((reading[1] ?? reading[4])==='>') !== reversed ? 'forward' : 'backward') : undefined;
      const from = reversed ? right : left;
      const to = reversed ? left : right;
      for(const id of [from,to])if(!inferredParents.has(id))inferredParents.set(id,packages[packages.length-1]);
      const fromCardinality = reversed ? rightCardinality : leftCardinality;
      const toCardinality = reversed ? leftCardinality : rightCardinality;
      connections.push({
        id: roleAttributes.id ?? connectionId(from, to, connections.length),
        from,
        to,
        ...(label ? { label } : {}),
        dashed: operator.includes(".."),
        order: connections.length,
        attributes: {
          ...Object.fromEntries(Object.entries(roleAttributes).filter(([key])=>["lineColor","lineStyle","thickness"].includes(key))),
          relation: relationKind,
          ...(/^[#}+^]/.test(operator) ? {fromDecoration: ({'#':'square','}':'crowfoot','+':'circle-cross','^':'triangle'} as Record<string,string>)[operator[0]!]!} : {}),
          ...(/[#\{+^]$/.test(operator) ? {[reversed ? "fromDecoration" : "toDecoration"]: ({'#':'square','{':'crowfoot','+':'circle-cross','^':'triangle'} as Record<string,string>)[operator[operator.length-1]!]!} : {}),
          ...(labelDirection?{labelDirection}:{}),
          ...(["x--","x..","x-->","x..>","<--x","<..x"].includes(operator)?{nonNavigableEnd:"from"}: ["--x","..x"].includes(operator)?{nonNavigableEnd:"to"}:{}),
          ...(["<-->","<..>"].includes(operator) ? {bidirectional:"true"} : {}),
          ...((specialNavigation || ["*-->","*..>","o-->","o..>","<--*","<..*","<--o","<..o","x-->","x..>","<--x","<..x"].includes(operator)) ? {navigable:"true"} : {}),
          ...((reversed ? relation[7] : relation[2]) ? {fromMember:(reversed ? relation[7] : relation[2])!} : {}),
          ...((reversed ? relation[2] : relation[7]) ? {toMember:(reversed ? relation[2] : relation[7])!} : {}),
          ...((reversed ? roleAttributes.toMapRow : roleAttributes.fromMapRow) !== undefined ? {fromMapRow:(reversed ? roleAttributes.toMapRow : roleAttributes.fromMapRow)!} : {}),
          ...((reversed ? roleAttributes.fromMapRow : roleAttributes.toMapRow) !== undefined ? {toMapRow:(reversed ? roleAttributes.fromMapRow : roleAttributes.toMapRow)!} : {}),
          ...(roleAttributes.fromPort ? {fromPort:roleAttributes.fromPort} : {}),
          ...(roleAttributes.toPort ? {toPort:roleAttributes.toPort} : {}),
          ...(roleAttributes.fromRole ? { fromRole: roleAttributes.fromRole } : {}),
          ...(roleAttributes.toRole ? { toRole: roleAttributes.toRole } : {}),
          ...(fromCardinality ? { fromCardinality } : {}),
          ...(toCardinality ? { toCardinality } : {}),
        },
      });
      continue;
    }
    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (active) throw new Error(`${active.node.attributes.kind} "${active.node.id}" opened on line ${active.line} is missing a closing brace.`);
  if (packages.length) throw new Error(`Unclosed package "${packages[packages.length - 1]}".`);
  if(implicit)for(const [id,parentId] of inferredParents){
    if(!nodes.some(node=>node.id===id))nodes.push({id,label:id.split('.').slice(-1)[0]!,shape:"uml-class",attributes:{kind:"class",members:"[]",implicit:"true"},...(parentId?{parentId}:{})});
  }
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Relation references unknown classifier "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Relation references unknown classifier "${edge.to}".`);
    for(const endpoint of ['from','to'] as const){
      const member=edge.attributes?.[`${endpoint}Member`];if(!member)continue;
      const node=nodes.find(n=>n.id===edge[endpoint])!;
      const members=JSON.parse(node.attributes.members ?? '[]') as Array<{text:string}>;
      edge.attributes![`${endpoint}MemberIndex`]=String(resolveMemberIndex(members,member));
    }
  }
  return { kind: "class", nodes, connections, groups: [], source };
}

export function parseUsecase(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseUsecase);if(decorated)return decorated;
  const transformed = source.split(/\r?\n/).map((line) => {
    const relation = line.trim().match(/^(include|extend|generalize)\s+([\w.-]+)\s+->\s+([\w.-]+)(\s+\[[^\]]+\])?$/i);
    if (relation) {
      const kind=relation[1]!.toLowerCase();
      return `${relation[2]} ${kind==='generalize'?'->':'..>'} ${relation[3]}: «${kind}»${relation[4] ?? ''}`;
    }
    return line;
  }).join("\n");
  const parsed = parseDeployment(transformed);
  const connections = parsed.connections.map((edge) => {
    if (edge.label === "«generalize»") {
      const { label: _label, ...withoutLabel } = edge;
      return { ...withoutLabel, dashed: false, attributes: { ...edge.attributes, relation: "inheritance" } };
    }
    return edge.label === "«include»" || edge.label === "«extend»"
      ? { ...edge, attributes: { ...edge.attributes, relation: "dependency" } }
      : edge;
  });
  return { ...parsed, kind: "usecase", connections, source };
}

interface SlideContext {
  id?: string;
  lastItemId?: string;
  pendingArrow?: string;
}

export function parseSlide(source: string): SemanticModel {
  const decorated=withDiagramText(source,parseSlide,false);if(decorated)return decorated;
  const lines = meaningfulLines(source);
  const nodes: SemanticNode[] = [];
  const connections: SemanticConnection[] = [];
  const contexts: SlideContext[] = [{}];
  let order = 0;

  const activeContext = (): SlideContext => contexts[contexts.length - 1] ?? contexts[0]!;
  const addNode = (node: SemanticNode, line: number, connectable = true): void => {
    assertUnique(nodes, node, line);
    node.attributes.order = String(order++);
    nodes.push(node);
    if (!connectable) return;
    const context = activeContext();
    if (context.pendingArrow !== undefined && context.lastItemId) {
      connections.push({
        id: connectionId(context.lastItemId, node.id, connections.length),
        from: context.lastItemId,
        to: node.id,
        ...(context.pendingArrow ? { label: context.pendingArrow } : {}),
        dashed: false,
        order: connections.length,
      });
      delete context.pendingArrow;
    }
    context.lastItemId = node.id;
  };

  for (const line of lines.slice(1)) {
    if (line.text === "}") {
      if (contexts.length === 1) throw new Error(`Line ${line.number}: unexpected closing brace.`);
      const closed = contexts.pop();
      if (closed?.pendingArrow !== undefined) throw new Error(`Line ${line.number}: arrow must be followed by another slide item.`);
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
        ...(relation[4]?.trim() ? { label: unquote(relation[4].trim(), "") } : {}),
        dashed: (relation[2] ?? "").includes("--"),
        order: connections.length,
      });
      continue;
    }

    const layout = line.text.match(/^(row|column|grid)(?:\s+([\w.-]+))?(?:\s*\[([^\]]+)\])?\s*\{$/i);
    if (layout) {
      const kind = layout[1]?.toLowerCase() ?? "row";
      const id = layout[2] ?? uniqueId(kind, nodes.filter((node) => node.shape === "slide-group").length);
      const attributes: Record<string, string> = { ...attributesFrom(layout[3]), layout: kind };
      const parentId = activeContext().id;
      addNode({ id, label: attributes.label ?? "", shape: "slide-group", ...(parentId ? { parentId } : {}), attributes }, line.number, false);
      contexts.push({ id });
      continue;
    }

    const heading = line.text.match(/^(title|subtitle)\s+("(?:\\.|[^"])*")(?:\s*\[([^\]]+)\])?$/i);
    if (heading) {
      const kind = heading[1]?.toLowerCase() ?? "title";
      const id = uniqueId(kind, nodes.filter((node) => node.shape === `slide-${kind}`).length);
      const parentId = activeContext().id;
      addNode({ id, label: unquote(heading[2], id), shape: `slide-${kind}`, ...(parentId ? { parentId } : {}), attributes: attributesFrom(heading[3]) }, line.number, false);
      continue;
    }

    const item = line.text.match(/^(card|note|callout|badge|metric|bar|quote|milestone)\s+([\w.-]+)\s+("(?:\\.|[^"])*"|[^\s\[]+)(?:\s*\[([^\]]+)\])?$/i);
    if (item) {
      const kind = item[1]?.toLowerCase() ?? "card";
      const id = item[2] ?? "";
      const parentId = activeContext().id;
      addNode({ id, label: unquote(item[3], id), shape: `slide-${kind}`, ...(parentId ? { parentId } : {}), attributes: attributesFrom(item[4]) }, line.number);
      continue;
    }

    const arrow = line.text.match(/^arrow(?:\s*:\s*(.+))?$/i);
    if (arrow) {
      const context = activeContext();
      if (!context.lastItemId) throw new Error(`Line ${line.number}: arrow must follow a slide item.`);
      if (context.pendingArrow !== undefined) throw new Error(`Line ${line.number}: consecutive arrows are not allowed.`);
      context.pendingArrow = arrow[1] ? unquote(arrow[1].trim(), "") : "";
      continue;
    }

    throw new Error(`Line ${line.number}: could not parse "${line.text}".`);
  }

  if (contexts.length > 1) throw new Error(`Slide layout "${contexts[contexts.length - 1]?.id}" is missing a closing brace.`);
  if (contexts[0]?.pendingArrow !== undefined) throw new Error("Arrow must be followed by another slide item.");
  const ids = new Set(nodes.map((node) => node.id));
  for (const edge of connections) {
    if (!ids.has(edge.from)) throw new Error(`Connection references unknown slide item "${edge.from}".`);
    if (!ids.has(edge.to)) throw new Error(`Connection references unknown slide item "${edge.to}".`);
  }
  return { kind: "slide", nodes, connections, groups: [], source };
}

function createDirectedGraphDiagram(
  name: string,
  parse: (source: string) => SemanticModel,
  defaultLayout = "hierarchical",
  direction: "right" | "down" = "right",
): DiagramPlugin {
  return {
    name,
    defaultLayout,
    parse,
    toLayoutModel(model, context) {
      const hidden = new Set(model.nodes.filter(n=>n.attributes.hidden === "true").map(n=>n.id));
      const candidates = model.nodes.filter(n=>n.attributes.removed !== "true");
      const targets = new Set([...candidates.filter(n=>!hidden.has(n.id)).map(n=>n.id), ...model.connections.filter(e=>!hidden.has(e.from) && !hidden.has(e.to)).map(e=>e.id)]);
      const visible = candidates.filter(n=>{
        if(!n.attributes.annotationTarget)return true;
        if(!targets.has(n.attributes.annotationTarget))return false;
        const target=candidates.find(t=>t.id===n.attributes.annotationTarget);
        return n.attributes.annotationMember === undefined || !(JSON.parse(target?.attributes.hiddenMembers ?? '[]') as number[]).includes(Number(n.attributes.annotationMember));
      });
      const ids = new Set(visible.map(n=>n.id));
      return {
        kind: model.kind,
        items: visible.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
        connections: model.connections.filter(e=>ids.has(e.from) && ids.has(e.to)).map(e=>hidden.has(e.from) || hidden.has(e.to) || (['from','to'] as const).some(endpoint=>{const index=e.attributes?.[`${endpoint}MemberIndex`];return index!==undefined && (JSON.parse(model.nodes.find(n=>n.id===e[endpoint])?.attributes.hiddenMembers ?? '[]') as number[]).includes(Number(index));}) ? {...e,attributes:{...e.attributes,hidden:"true"}} : e),
        groups: [],
        direction: model.direction ?? direction,
        minimumGap: context.theme.gapY,
        labelFontSize: context.theme.fontSize - 1,
      };
    },
  };
}

export function createFlowchartDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("flowchart", parseFlowchart, "flowchart", "down");
}

export function createGraphDiagram(): DiagramPlugin {
  return {
    ...createDirectedGraphDiagram("graph", parseGraph, "graph", "down"),
    toLayoutModel(model, context) {
      return {
        kind: model.kind,
        items: model.nodes.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
        connections: model.connections,
        groups: [],
        direction: model.direction ?? "down",
        minimumGap: context.theme.gapY,
        labelFontSize: context.theme.fontSize - 1,
      };
    },
  };
}

export function createActivityDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("activity", parseActivity, "activity");
}

export function createStateDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("state", parseState, "graph", "down");
}

export function createErDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("er", parseEr);
}

export function createClassDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("class", parseClass, "class");
}

export function createSlideDiagram(): DiagramPlugin {
  return createDirectedGraphDiagram("slide", parseSlide, "slide");
}

export function createDeploymentDiagram(): DiagramPlugin {
  return {
    name: "deployment",
    defaultLayout: "hierarchical",
    parse: parseDeployment,
    toLayoutModel(model, context) {
      model=componentDisplayModel(model);
      return {
        kind: model.kind,
        items: model.nodes.map((node) => ({
          ...node,
          size: context.measure(node.shape, node.label, node.attributes),
        })),
        connections: model.connections,
        groups: model.groups,
        direction: model.direction ?? "right",
        minimumGap: context.theme.gapY,
        labelFontSize: context.theme.fontSize - 1,
      };
    },
  };
}

export function createComponentDiagram(): DiagramPlugin {
  return {
    ...createDeploymentDiagram(),
    name: "component",
    parse: parseComponent,
  };
}

export function createUsecaseDiagram(): DiagramPlugin {
  return {
    ...createDeploymentDiagram(),
    name: "usecase",
    parse: parseUsecase,
  };
}

export function createSequenceDiagram(): DiagramPlugin {
  return {
    name: "sequence",
    defaultLayout: "sequence",
    parse: parseSequence,
    toLayoutModel(model, context) {
      return {
        kind: model.kind,
        items: model.nodes.map((node) => ({ ...node, size: context.measure(node.shape, node.label, node.attributes) })),
        connections: model.connections,
        groups: model.groups,
        direction: "down",
        minimumGap: 54,
        ...(model.diagramText ? {diagramText:model.diagramText} : {}),
        ...(model.pageBreaks ? {pageBreaks:model.pageBreaks} : {}),
        labelFontFamily: context.theme.fontFamily,
        labelFontSize: context.theme.fontSize - 1,
      };
    },
  };
}

export function createObjectDiagram(): DiagramPlugin { return createDirectedGraphDiagram("object", parseObject, "class"); }

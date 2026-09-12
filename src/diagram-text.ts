import {expandComponentBodies} from './component-bodies.js';
import {expandClassVisibility} from './class-visibility.js';
import {expandBlockNotes} from './block-notes.js';
import type {DiagramText,Geometry,SemanticModel} from './types.js';
import {labelLayout} from './text-layout.js';

/** Shared metrics for headings and legends, independent of diagram routing. */
export function measureDiagramText(content:DiagramText|undefined,baseFontSize=12,fontFamily?:string):NonNullable<Geometry['diagramText']> {
    const diagramText:NonNullable<Geometry['diagramText']>={top:0,bottom:0,blocks:[]};
    for(const kind of ['header','title','legend','footer'] as const){
      const text=content?.[kind];if(!text)continue;
      const fontSize=(baseFontSize)+(kind==='title' ? 7 : 0);
      const measured=labelLayout(text,264,fontSize,fontFamily,kind==='title' ? 700 : 400);
      const zone=kind==='footer' || kind==='legend' ? 'bottom' : 'top';
      diagramText.blocks.push({kind,text,lines:measured.lines,lineHeight:measured.lineHeight,fontSize,y:diagramText[zone]+fontSize+(kind==='legend'?12:0)});
      diagramText[zone]+=measured.height+(kind==='legend'?40:16);
    }
    return diagramText;
}

/** Only top-level declarations are diagram text; classifier bodies stay literal. */
export function withDiagramText(source:string,parse:(source:string)=>SemanticModel,includeTitle=true):SemanticModel|undefined {
 const descriptions=expandComponentBodies(source);if(descriptions!==undefined)return {...parse(descriptions),source};
 const notes=expandBlockNotes(source);if(notes!==undefined)return {...parse(notes),source};
 const visibility=expandClassVisibility(source);if(visibility!==undefined)return {...parse(visibility),source};
 let depth=0,found=false,literalBody=false;const content:DiagramText={};
 let block:keyof DiagramText|undefined;let body:string[]=[];
 const stripped=source.split(/\r?\n/).map(line=>{
  if(block){
   if(line.trim()===`end ${block}`){content[block]=body.join('\n');block=undefined;body=[];}
   else body.push(line.trim());
   return '';
  }
  if(literalBody){if(line.trim()==='}'){literalBody=false;depth--;}return line;}
  const start=depth===0 ? line.trim().match(/^(title|header|footer|legend)$/) : null;
  if(start && (includeTitle || start[1]!=="title")){block=start[1] as keyof DiagramText;found=true;return '';}
  const match=depth===0 ? line.trim().match(/^(title|header|footer|legend)\s+("(?:\\.|[^"\\])*")$/) : null;
  if(match && (includeTitle || match[1]!=="title")){content[match[1] as keyof DiagramText]=JSON.parse(match[2]!);found=true;return '';}
  const code=line.replace(/"(?:\\.|[^"\\])*"/g,'').replace(/\s+(?:#|\/\/).*$/,'');
  if(/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(code))literalBody=true;
  if(!/^\s*[#']/.test(code))for(const char of code){if(char==='{')depth++;else if(char==='}')depth--;}
  return line;
 }).join('\n');
 if(block)throw new Error(`Unclosed ${block} block; expected end ${block}.`);
 return found ? {...parse(stripped),source,diagramText:content} : undefined;
}

import {normalizeElementAlias} from './element-aliases.js';
/** Normalize visibility before namespace resolution; preserve member text. */
export function expandClassVisibility(source:string):string|undefined {
 if(!/^\s*@(class|object)\b/m.test(source))return undefined;
 let body=false,changed=false;let heading:string|undefined;
 const result=source.split(/\r?\n/).map(line=>{
  if(body){if(line.trim()==='}')body=false;return line;}
  if(heading){if(line.trim()===`end ${heading}`)heading=undefined;return line;}
  if(/^(title|header|footer|legend)$/.test(line.trim())){heading=line.trim();return line;}
  const prefix=line.match(/^(\s*)([+~#-])\s*((?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*)$/);
  const normalized=prefix?normalizeElementAlias(prefix[1]!+prefix[3]!):line;
  if(/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map)\s+.*\{\s*$/.test(normalized))body=true;
  if(!prefix)return line;
  const id=normalized.match(/^\s*\w+\s+([\w.-]+)/)?.[1];
  if(!id)throw new Error('A visible classifier requires an identifier or alias.');
  changed=true;
  return `visibility ${id} "${prefix[2]}"\n${normalized}`;
 }).join('\n');
 return changed?result:undefined;
}

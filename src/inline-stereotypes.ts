import {normalizeElementAlias} from './element-aliases.js';
/** Expand declaration stereotypes while preserving literal member bodies. */
export function expandInlineStereotypes(source:string):string {
 let body=false;
 return source.split(/\r?\n/).map(line=>{
  if(body){if(line.trim()==='}')body=false;return line;}
  line=normalizeElementAlias(line);
  const declaration=line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+(?:<[^{}\n]+?>)?)(?:\s+("(?:\\.|[^"\\])*"))?\s+<<([^<>\n]+)>>(\s*(?:\{\s*\}?)?)\s*$/);
  if(/^(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map)\s+.*\{\s*$/.test(line.trim()))body=true;
  if(!declaration)return line;
  const id=declaration[3]!.replace(/<.*>$/,'');
  const header=`${declaration[1]}${declaration[2]} ${declaration[3]}${declaration[4] ? ' '+declaration[4] : ''}${declaration[2]==='stereotype' && !declaration[6]!.trim() ? ' {}' : declaration[6]}`;
  return `stereotype ${id} ${JSON.stringify(declaration[5]!.trim())}\n${header}`;
 }).join('\n');
}

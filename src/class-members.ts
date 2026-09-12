/** Insert external member declarations before normal member/annotation parsing. */
export function expandClassMembers(source:string,implicit=false):string {
 const additions=new Map<string,string[]>();const firstLine=new Map<string,number>();let body=false;
 const lines=source.split(/\r?\n/).map((line,index)=>{
  if(body){if(line.trim()==='}')body=false;return line;}
  if(/^\s*(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line)){body=true;return line;}
  const match=line.trim().match(/^([\w.-]+)\s*:(?!:)\s*(.+)$/);
  if(!match)return line;
  if(!firstLine.has(match[1]!))firstLine.set(match[1]!,index);
  additions.set(match[1]!,[...(additions.get(match[1]!) ?? []),match[2]!]);return '';
 });
 let active:string|undefined;const seen=new Set<string>();
 const result=lines.map(line=>{
  if(active){if(line.trim()==='}'){const extra=additions.get(active) ?? [];active=undefined;return [...extra,line].join('\n');}return line;}
  const declaration=line.match(/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+).*\{\s*$/);
  if(declaration){active=declaration[1]!;seen.add(active);}
  return line;
 });
 for(const [id,members] of additions)if(!seen.has(id)){
  if(!implicit)throw new Error(`Unknown classifier member target "${id}".`);
  result[firstLine.get(id)!]=`class ${id} ${JSON.stringify(id.split('.').slice(-1)[0])} {\n${members.join('\n')}\n}`;
 }
 return result.join('\n');
}

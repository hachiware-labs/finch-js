import {classRelationOperators} from './class-relations.js';
export interface MapEntry { key:string; value:string }

/** Expand map bodies to object declarations and row-qualified links. */
export function expandObjectMaps(source:string,initialMaps:Map<string,MapEntry[]>=new Map()):{source:string; maps:Map<string,MapEntry[]>} {
 const maps=new Map(initialMaps);
 const output:string[]=[]; const links:string[]=[];
 let active:string|undefined; let objectBody=false;
 for(const line of source.split(/\r?\n/)) {
  const text=line.trim();
  if(objectBody){output.push(line);if(text==='}')objectBody=false;continue;}
  if(active!==undefined){
   if(text==='}'){output.push('}');active=undefined;continue;}
   if(!text || /^(#|')/.test(text))continue;
   const row=text.match(/^(.+?)\s*(=>|\*-+>)\s*(.*)$/);
   if(!row)throw new Error(`Invalid map entry "${text}".`);
   const key=row[1]!.trim();const value=row[3]!.trim();
   const entries=maps.get(active)!;
   if(entries.some(e=>e.key===key))throw new Error(`Duplicate map key "${key}".`);
   entries.push({key,value:row[2]==='=>' ? value : ''});
   if(row[2]!=='=>'){
    if(!/^[\w.-]+$/.test(value))throw new Error(`Invalid map reference "${value}".`);
    links.push(`${active} --> ${value} [fromMapRow=${entries.length-1}]`);
   }
   continue;
  }
  const declaration=text.match(/^map\s+([\w.-]+)(?:\s+("[^"\n]*"))?\s*\{\s*(\})?$/);
  if(declaration){
   active=declaration[1]!;
   if(maps.has(active))throw new Error(`Duplicate map "${active}".`);
   maps.set(active,[]);output.push(`object ${active} ${declaration[2] ?? `"${active}"`} {`);
   if(declaration[3]){output.push("}");active=undefined;}
   continue;
  }
  if(/^(object|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(text))objectBody=true;
  output.push(line);
 }
 if(active!==undefined)throw new Error(`Unclosed map "${active}".`);
 const transformed=output.map(line=>{
  // Qualified row endpoints use identifier keys; arbitrary text keys work in map bodies.
  const match=line.match(new RegExp(String.raw`^([\w.-]+)(?:::(~?[\w.$-]+(?:\([^)]*\))?))?(\s+(?:"[^"]+"\s+)?(?:${classRelationOperators})(?:\s+"[^"]+")?\s+)([\w.-]+)(?:::(~?[\w.$-]+(?:\([^)]*\))?))?(.*)$`));
  if(!match || (!match[2] && !match[5]))return line;
  const attrs:string[]=[];
  for(const [id,key,endpoint] of [[match[1],match[2],'from'],[match[4],match[5],'to']]) {
   if(key===undefined || !maps.has(id!))continue;
   const index=maps.get(id!)?.findIndex(e=>e.key===key) ?? -1;
   if(index<0)throw new Error(`Unknown map entry "${id}::${key}".`);
   attrs.push(`${endpoint}MapRow=${index}`);
  }
  if(!attrs.length)return line;
  const from=match[1]!+(match[2] && !maps.has(match[1]!) ? `::${match[2]}` : '');
  const to=match[4]!+(match[5] && !maps.has(match[4]!) ? `::${match[5]}` : '');
  const tail=match[6]!;
  return `${from}${match[3]}${to}${tail.replace(/\s*\[([^\]]*)\]\s*$/,(_,existing:string)=>{attrs.unshift(existing);return '';})} [${attrs.join(' ')}]`;
 });
 return {source:[...transformed,...links].join('\n'),maps};
}

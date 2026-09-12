import type {MapEntry} from './object-maps.js';

export function normalizeJsonAlias(line:string):string {
 return line.trim()
   .replace(/^json\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+)\s*(?=[\[{])/, 'json $2 $1 ')
   .replace(/^json\s+([\w.-]+)\s+as\s+("(?:\\.|[^"\\])*")\s*(?=[\[{])/, 'json $1 $2 ')
   .replace(/^json\s+([\w.-]+)\s+as\s+([\w.-]+)\s*(?=[\[{])/, (_,name:string,id:string)=>`json ${id} ${JSON.stringify(name)} `);
}

/** Preserve JSON values while expressing nested containers as map references. */
export function expandObjectJson(source:string):{source:string;maps:Map<string,MapEntry[]>;owners:Map<string,string>} {
 const maps=new Map<string,MapEntry[]>(),owners=new Map<string,string>(),output:string[]=[];
 const lines=source.split(/\r?\n/);let inBody=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i]!;
  if(inBody){output.push(line);if(line.trim()==='}')inBody=false;continue;}
  const normalized=normalizeJsonAlias(line);
  const match=normalized.match(/^json\s+([\w.-]+)(?:\s+("(?:\\.|[^"\\])*"))?\s*([\[{].*)$/);
  if(!match){if(/^(object|map|class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line.trim()))inBody=true;output.push(line);continue;}
  let raw=match[3]!,depth=0,quoted=false,escaped=false,position=0;
  while(true){
   for(;position<raw.length;position++){
    const char=raw[position];
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}
    else if(char==='"')quoted=true;
    else if(char==='{'||char==='[')depth++;
    else if(char==='}'||char===']')depth--;
   }
   if(depth<=0 && !quoted)break;
   if(++i>=lines.length)throw new Error(`Unclosed JSON block "${match[1]}".`);
   raw+='\n'+lines[i];
  }
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new Error(`Invalid JSON block "${match[1]}".`);}
  const root=match[1]!;let serial=0;
  const add=(id:string,label:string,value:unknown,level:number)=>{
   if(level>32 || maps.size>=1000)throw new Error('JSON diagram exceeds nesting or node limit.');
   if(maps.has(id))throw new Error(`Duplicate JSON node "${id}".`);
   const entries:MapEntry[]=[];maps.set(id,entries);owners.set(id,root);
   output.push(`object ${id} ${JSON.stringify(label)}`);
   const children:Array<[string,unknown]>=Array.isArray(value)?value.map((item,index)=>[String(index),item]):Object.entries(value as Record<string,unknown>);
   for(const [key,item] of children){
    const displayKey=/[\r\n\t]/.test(key)?JSON.stringify(key):key;
    const row=entries.length;
    if(item!==null && typeof item==='object'){
     const child=`${root}__json${++serial}`;
     entries.push({key:displayKey,value:Array.isArray(item)?'[]':'{}'});
     add(child,`${displayKey} ${Array.isArray(item)?'[]':'{}'}`,item,level+1);
     output.push(`${id} --> ${child} [fromMapRow=${row}]`);
    }else entries.push({key:displayKey,value:JSON.stringify(item)});
   }
  };
  add(root,match[2] ? JSON.parse(match[2]) as string : root,value,0);
 }
 return {source:output.join('\n'),maps,owners};
}

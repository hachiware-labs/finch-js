import {normalizeJsonAlias} from './object-json.js';
import {normalizeElementAlias} from './element-aliases.js';
import {expandClassNamespaces} from './class-namespaces.js';

/** Shield literal object bodies while reusing classifier namespace resolution. */
export function expandObjectNamespaces(source:string,implicit=false):string {
 let markerPrefix='__finch_object_';
 while(source.includes(markerPrefix))markerPrefix+='x';
 const blockPattern=new RegExp(`^${markerPrefix}block_(\\d+)$`);
 const refPattern=new RegExp(`^[\\w.-]+ --> ([\\w.-]+): ${markerPrefix}ref_(\\d+)_(\\d+)$`);
 const blocks:Array<{lines:string[]}> = [];
 const masked:string[]=[];const lines=source.split(/\r?\n/);let classifier=false;
 for(let i=0;i<lines.length;i++){
  let line=lines[i]!;
  if(classifier){masked.push(line);if(line.trim()==='}')classifier=false;continue;}
  line=normalizeJsonAlias(normalizeElementAlias(line));
  if(/^\s*(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+.*\{\s*$/.test(line)){classifier=true;masked.push(line);continue;}
  const match=line.match(/^\s*(object|map|json)\s+([\w.-]+)(.*)$/);
  if(!match){masked.push(line);continue;}
  const labelTail=match[3]!.trim();
  const implicitLabel=!labelTail || /^[{[]/.test(labelTail);
  const declaration=implicitLabel ? `${match[1]} ${match[2]} ${JSON.stringify(match[2])}${match[3]}` : line;
  const block={lines:[declaration]};
  if(match[1]==='json'){
   const header=match[3]!.match(/^\s*(?:"(?:\\.|[^"\\])*"\s*)?([\[{].*)$/);
   let raw=header?.[1] ?? '';
   let depth=0,quoted=false,escaped=false,pos=0;
   if(!header)throw new Error('JSON declaration needs an object or array.');
   while(true){
    for(;pos<raw.length;pos++){
     const c=raw[pos];
     if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
     else if(c==='"')quoted=true;
     else if(c==='{'||c==='[')depth++;
     else if(c==='}'||c===']')depth--;
    }
    if(depth<=0&&!quoted)break;
    if(++i>=lines.length)throw new Error(`Unclosed JSON block "${match[2]}".`);
    block.lines.push(lines[i]!);raw+='\n'+lines[i];
   }
  }else if(/\{\s*$/.test(line)){
   do{if(++i>=lines.length)throw new Error(`Unclosed ${match[1]} "${match[2]}".`);block.lines.push(lines[i]!);}while(lines[i]!.trim()!=='}');
  }
  const index=blocks.length;blocks.push(block);
  masked.push(`class ${match[2]} {`, `${markerPrefix}block_${index}`, '}');
  if(match[1]==='map')block.lines.forEach((row,j)=>{
   const ref=row.match(/\*-+>\s*([\w.-]+)\s*$/);
   if(ref){masked.push(`${match[2]} --> ${ref[1]}: ${markerPrefix}ref_${index}_${j}`);}
  });
 }
 const normalized=expandClassNamespaces(masked.join('\n'),implicit).split('\n');
 // Resolve map references in their declaration's lexical scope before moving them.
 const filtered=normalized.filter(line=>{
  const ref=line.match(refPattern);
  if(!ref)return true;
  const block=blocks[Number(ref[2])]!;const row=Number(ref[3]);
  block.lines[row]=block.lines[row]!.replace(/(\*-+>\s*)[\w.-]+\s*$/,`$1${ref[1]}`);return false;
 });
 const output:string[]=[];
 for(let i=0;i<filtered.length;i++){
  const marker=filtered[i+1]?.match(blockPattern);
  if(!marker){output.push(filtered[i]!);continue;}
  const id=filtered[i]!.match(/^class ([\w.-]+)/)![1]!;
  const block=blocks[Number(marker[1])]!;
  output.push(block.lines[0]!.replace(/^(\s*(?:object|map|json)\s+)[\w.-]+/,`$1${id}`),...block.lines.slice(1));i+=2;
 }
 return output.join('\n');
}

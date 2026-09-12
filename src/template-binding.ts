import type {SemanticModel} from './types.js';

function parts(text:string):string[] {
  const result:string[]=[];const stack:string[]=[];let start=0;let quote="";
  for(let i=0;i<text.length;i++){
    const token=text[i]!;
    if(quote){if(token==="\\"){i++;continue;}if(token===quote)quote="";continue;}
    if(token==='"'||token==="'"){quote=token;continue;}
    if('<(['.includes(token))stack.push(token);
    if('>)]'.includes(token) && stack.pop()!==({'>' : '<', ')' : '(', ']' : '['} as Record<string,string>)[token])throw new Error('Unbalanced template arguments.');
    if(token===','&&!stack.length){result.push(text.slice(start,i).trim());start=i+1;}
  }
  if(quote)throw new Error('Unclosed quoted template argument.');
  if(stack.length)throw new Error('Unbalanced template arguments.');
  result.push(text.slice(start).trim());return result;
}

export function addTemplateBinding(model:SemanticModel,from:string,to:string,text:string):void {
  const source=model.nodes.find(n=>n.id===from&&n.shape==='uml-class');
  const target=model.nodes.find(n=>n.id===to&&n.shape==='uml-class');
  if(!source||!target?.attributes.templateParameters)throw new Error('Binding requires a classifier and a declared template.');
  const names=parts(target.attributes.templateParameters).map(p=>p.split(/[:=]/)[0]!.trim());
  const values:Record<string,string>=Object.create(null);
  for(const part of parts(text)){
    const pair=part.match(/^([\w]+)\s*=\s*(.+)$/);
    if(!pair||!names.includes(pair[1]!)||Object.prototype.hasOwnProperty.call(values,pair[1]!))throw new Error(`Invalid or duplicate template substitution: ${part}`);
    values[pair[1]!]=pair[2]!;
  }
  let id=`binding-${model.connections.length+1}`;
  while(model.connections.some(e=>e.id===id))id+='-bind';
  model.connections.push({id,from,to,label:`«bind» <${Object.entries(values).map(([formal,actual])=>`${formal} → ${actual}`).join(', ')}>`,dashed:true,order:model.connections.length,attributes:{relation:'dependency',templateBinding:JSON.stringify(values)}});
}

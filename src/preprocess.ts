import {sourceBuiltin} from './source-builtins.js';
import {validateSourceBlocks} from './source-blocks.js';
import { sourceCondition, sourceExpression, type SourceValue } from "./source-condition.js";
export interface PreprocessOptions {
 includes?: Record<string,string>;
 definitions?: Record<string,string | number | boolean>;
 /** Synchronous host loader. Return undefined for unknown resources. */
 resolveInclude?: (name:string,from?:string)=>string | undefined;
}

/** Expand reusable source without executing JavaScript or fetching implicitly. */
export function preprocess(source:string,options:PreprocessOptions={}):string {
 const values=new Map(Object.entries(options.definitions ?? {}).map(([k,v])=>[k,String(v)]));
 const procedures=new Map<string,{params:Array<{name:string;defaultValue?:string}>;body:string;returns:boolean}>();
 let calls=0;
 const callKinds:boolean[]=[];
 const includedNames=new Set<string>();
 class Returned {constructor(readonly value:SourceValue){}}
 let loops=0;
 let count=0;
 const substitute=(text:string)=>text.replace(/\{\{([A-Za-z_]\w*)\}\}/g,(_,name:string)=>{
  if(!values.has(name))throw new Error(`Undefined source variable "${name}".`);
  return values.get(name)!;
 });
 const invoke=(name:string,args:SourceValue[],stack:string[]):SourceValue=>{
  const fn=procedures.get(name);
  if(!fn)return sourceBuiltin(name,args,values);
  if(!fn.returns)throw new Error(`Unknown source function "${name}".`);
  if(args.length>fn.params.length || fn.params.slice(args.length).some(p=>p.defaultValue===undefined) || args.some(arg=>arg===undefined || typeof arg==='number' && !Number.isFinite(arg)))throw new Error('Invalid function arguments.');
  if(calls>=32)throw new Error('Function nesting exceeds 32 levels.');
  const saved=new Map(values);calls++;callKinds.push(true);
  try{
   fn.params.forEach((param,i)=>values.set(param.name,args[i]===undefined ? substitute(param.defaultValue!) : String(args[i])));
   try{expand(fn.body,stack);}catch(error){if(error instanceof Returned)return error.value;throw error;}
   throw new Error(`Function "${name}" finished without !return.`);
  }finally{calls--;callKinds.pop();values.clear();for(const [key,value] of saved)values.set(key,value);}
 };
 const expand=(input:string,stack:string[]):string=>{
  validateSourceBlocks(input);
  if(stack.length>32)throw new Error('Include nesting exceeds 32 levels.');
  const evaluate=(expression:string,enabled=true)=>sourceExpression(expression,values,enabled,(name,args)=>invoke(name,args,stack));
  const testCondition=(expression:string,enabled=true)=>sourceCondition(expression,values,enabled,(name,args)=>invoke(name,args,stack));
  const frames:Array<{parent:boolean;condition:boolean;otherwise:boolean}>=[];
  let enabled=true;const result:string[]=[];
  const lines=input.split(/\r?\n/);
  for(let index=0;index<lines.length;index++) {
   const line=lines[index]!;
   if(++count>100000)throw new Error('Expanded source exceeds 100000 lines.');
   const procedure=line.trim().match(/^!(?:procedure|function)\s+([A-Za-z_]\w*)\s*\((.*)\)$/);
   if(procedure){
    const returns=line.trim().startsWith("!function");
    const body:string[]=[];let closed=false;
    while(++index<lines.length){
      const text=lines[index]!;
      if(text.trim()===(returns ? '!endfunction' : '!endprocedure')){closed=true;break;}
      if(/^\s*!(?:procedure|function)\b/.test(text))throw new Error('Nested procedure definitions are not supported.');
      body.push(text);
    }
    if(!closed)throw new Error(`Unclosed procedure "${procedure[1]}".`);
    if(enabled){
      if(calls)throw new Error('Procedure definitions inside calls are not supported.');
      const params:Array<{name:string;defaultValue?:string}>=[];
      let remaining=procedure[2]!.trim();let optional=false;
      while(remaining){
        const parameter=remaining.match(/^([A-Za-z_]\w*)\s*(?:=\s*("(?:\\.|[^"\\])*"|true|false|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?))?\s*(,|$)/);
        if(!parameter || params.some(p=>p.name===parameter[1]) || optional && parameter[2]===undefined)throw new Error('Invalid procedure parameters.');
        const value=parameter[2]===undefined ? undefined : JSON.parse(parameter[2]) as unknown;
        if(typeof value==='number' && !Number.isFinite(value))throw new Error('Invalid procedure default.');
        params.push({name:parameter[1]!,...(value===undefined?{}:{defaultValue:String(value)})});
        optional ||= value!==undefined;
        remaining=remaining.slice(parameter[0].length).trim();
        if(parameter[3]===',' && !remaining)throw new Error('Invalid procedure parameters.');
      }
      if(procedures.has(procedure[1]!))throw new Error(`Duplicate procedure "${procedure[1]}".`);
      procedures.set(procedure[1]!,{params,body:body.join('\n'),returns});
    }
    continue;
   }
   const loop=line.trim().match(/^!(foreach|while)\s+(.+)$/);
   if(loop){
    const body:string[]=[];const closing=[loop[1]==='foreach' ? '!endfor' : '!endwhile'];
    while(++index<lines.length){
     const text=lines[index]!,trimmed=text.trim();
     if(/^!(?:procedure|function)\b/.test(trimmed))throw new Error('Procedure definitions inside loops are not supported.');
     if(/^!foreach\s/.test(trimmed))closing.push('!endfor');
     else if(/^!while\s/.test(trimmed))closing.push('!endwhile');
     else if(trimmed==='!endfor' || trimmed==='!endwhile'){
      if(closing.pop()!==trimmed)throw new Error('Mismatched source loop terminator.');
      if(!closing.length)break;
     }
     body.push(text);
    }
    if(closing.length)throw new Error(`Unclosed !${loop[1]}.`);
    if(!enabled)continue;
    if(loops>=32)throw new Error('Source loop nesting exceeds 32 levels.');
    const sourceBody=body.join('\n');
    const run=()=>{const expanded=expand(sourceBody,stack);if(expanded)result.push(expanded);};
    loops++;
    try{
     if(loop[1]==='while'){
      let iterations=0;
      while(testCondition(loop[2]!)){
       if(++iterations>10000)throw new Error('Source loop exceeds 10000 iterations.');
       run();
      }
     }else{
      const each=loop[2]!.match(/^([A-Za-z_]\w*)\s+in\s+(.+)$/);
      if(!each)throw new Error('Expected !foreach NAME in JSON-array.');
      const list=each[2]!.trim();let items:unknown;
      const listValue=list.startsWith('[') ? list : evaluate(list);
      if(typeof listValue!=='string')throw new Error('Foreach requires a JSON array.');
      try{items=JSON.parse(listValue);}catch{throw new Error('Foreach requires a JSON array.');}
      if(!Array.isArray(items))throw new Error('Foreach requires a JSON array.');
      if(items.length>10000)throw new Error('Source loop exceeds 10000 iterations.');
      const encode=(item:unknown):string=>{
       if(typeof item==='string')return substitute(item);
       return JSON.stringify(item,(_key,value:unknown)=>{
        if(typeof value==='number' && !Number.isFinite(value))throw new Error('Foreach requires finite JSON numbers.');
        return typeof value==='string' ? substitute(value) : value;
       });
      };
      const actual=items.map(encode);
      const name=each[1]!,previous=values.get(name);
      try{for(const item of actual){values.set(name,item);run();}}
      finally{if(previous===undefined)values.delete(name);else values.set(name,previous);}
     }
    }finally{loops--;}
    continue;
   }
   const conditional=line.trim().match(/^!if\s+(.+)$/);
   if(conditional){
    const condition=testCondition(conditional[1]!,enabled);
    frames.push({parent:enabled,condition,otherwise:false});enabled=enabled && condition;continue;
   }
   const elseif=line.trim().match(/^!elseif\s+(.+)$/);
   if(elseif){
    const frame=frames[frames.length-1];if(!frame || frame.otherwise)throw new Error('Unexpected !elseif.');
    const condition=testCondition(elseif[1]!,frame.parent && !frame.condition);
    enabled=frame.parent && !frame.condition && condition;
    frame.condition ||= condition;continue;
   }
   if(line.trim()==='!else'){
    const frame=frames[frames.length-1];if(!frame || frame.otherwise)throw new Error('Unexpected !else.');
    frame.otherwise=true;enabled=frame.parent && !frame.condition;continue;
   }
   if(line.trim()==='!endif'){
    const frame=frames.pop();if(!frame)throw new Error('Unexpected !endif.');enabled=frame.parent;continue;
   }
   if(!enabled)continue;
   const returned=line.trim().match(/^!return\s+(.+)$/);
   if(returned){
    if(callKinds[callKinds.length-1]!==true)throw new Error('!return requires a function.');
    const value=evaluate(returned[1]!);
    if(value===undefined || typeof value==='number' && !Number.isFinite(value))throw new Error('Invalid function return value.');
    throw new Returned(value);
   }
   const call=line.trim().match(/^!call\s+([A-Za-z_]\w*)\s*\((.*)\)$/);
   if(call){
    const procedure=procedures.get(call[1]!);
    if(!procedure || procedure.returns)throw new Error(`Unknown procedure "${call[1]}".`);
    let args:unknown[];
    try{args=JSON.parse(`[${call[2]}]`) as unknown[];}catch{throw new Error('Procedure arguments must be JSON strings, numbers or booleans.');}
    if(args.length>procedure.params.length || procedure.params.slice(args.length).some(p=>p.defaultValue===undefined) || args.some(arg=>!['string','number','boolean'].includes(typeof arg) || typeof arg==='number' && !Number.isFinite(arg)))throw new Error('Invalid procedure arguments.');
    const actual=args.map(arg=>substitute(String(arg)));
    if(calls>=32)throw new Error('Procedure nesting exceeds 32 levels.');
    const saved=new Map(values);
    calls++;callKinds.push(false);
    try{
      procedure.params.forEach((param,i)=>values.set(param.name,actual[i] ?? substitute(param.defaultValue!)));
      const expanded=expand(procedure.body,stack);if(expanded)result.push(expanded);
    }finally{calls--;callKinds.pop();values.clear();for(const [key,value] of saved)values.set(key,value);}
    continue;
   }
   const assertion=line.trim().match(/^!assert\s+(.+)$/);
   if(assertion){
    const parts=assertion[1]!.match(/^((?:"(?:\\.|[^"\\])*"|[^":])+?)(?:\s*:\s*("(?:\\.|[^"\\])*"))?$/);
    if(!parts)throw new Error('Expected !assert expression : "message".');
    if(!testCondition(parts[1]!)){
     const message=parts[2] ? substitute(JSON.parse(parts[2]) as string) : parts[1]!.trim();
     const resource=stack[stack.length-1];
     throw new Error(`Source assertion failed${resource ? ` in "${resource}"` : ''}: ${message}`);
    }
    continue;
   }
   const assignment=line.trim().match(/^!let\s+([A-Za-z_]\w*)\s*=\s*(.+)$/);
   if(assignment){
    const value=evaluate(assignment[2]!);
    if(value===undefined)throw new Error('Cannot assign an undefined source variable.');
    values.set(assignment[1]!,String(value));continue;
   }
   const define=line.trim().match(/^!define\s+([A-Za-z_]\w*)(?:\s+(.*))?$/);
   if(define){values.set(define[1]!,substitute(define[2] ?? 'true'));continue;}
   const undef=line.trim().match(/^!undef\s+([A-Za-z_]\w*)$/);
   if(undef){values.delete(undef[1]!);continue;}
   const include=line.trim().match(/^!(include|include_once)\s+"([^"\n]+)"$/);
   if(include){
    const name=substitute(include[2]!);
    if(include[1]==='include_once' && includedNames.has(name))continue;
    if(stack.includes(name))throw new Error(`Circular include: ${[...stack,name].join(' -> ')}`);
    const text=Object.prototype.hasOwnProperty.call(options.includes ?? {},name) ? options.includes![name] : options.resolveInclude?.(name,stack[stack.length-1]);
    if(text===undefined)throw new Error(`Unknown include "${name}".`);
    includedNames.add(name);
    const included=expand(text,[...stack,name]);if(included)result.push(included);continue;
   }
   if(/^\s*!/.test(line))throw new Error(`Unknown source directive: ${line.trim()}`);
   if(callKinds.includes(true) && line.trim() && !/^[#']/.test(line.trim()))throw new Error('Functions cannot emit diagram source.');
   result.push(substitute(line));
  }
  if(frames.length)throw new Error('Unclosed !if.');
  return result.join('\n');
 };
 return expand(source,[]);
}


export interface PreprocessSnapshot {
 includes: Record<string,string>;
 definitions: Record<string,string | number | boolean>;
 resources: Array<{name:string;from?:string;source:string}>;
}

export function snapshotPreprocess(source:string,options:PreprocessOptions):{source:string;snapshot:PreprocessSnapshot} {
 const snapshot:PreprocessSnapshot={includes:{...options.includes},definitions:{...options.definitions},resources:[]};
 const expanded=preprocess(source,{...options,resolveInclude:(name,from)=>{
  const cached=snapshot.resources.find(resource=>resource.name===name && resource.from===from);
  if(cached)return cached.source;
  const text=options.resolveInclude?.(name,from);
  if(text!==undefined)snapshot.resources.push({name,...(from===undefined?{}:{from}),source:text});
  return text;
 }});
 return {source:expanded,snapshot};
}

export function restorePreprocess(snapshot:PreprocessSnapshot):PreprocessOptions {
 return {includes:snapshot.includes,definitions:snapshot.definitions,resolveInclude:(name,from)=>snapshot.resources.find(resource=>resource.name===name && resource.from===from)?.source};
}


export interface AsyncPreprocessOptions extends Omit<PreprocessOptions,'resolveInclude'> {
 resolveInclude: (name:string,from?:string)=>Promise<string|undefined>;
 signal?: AbortSignal;
}

/** Resolve only includes selected by the source's actual conditions. */
export async function snapshotPreprocessAsync(source:string,options:AsyncPreprocessOptions):Promise<{source:string;snapshot:PreprocessSnapshot}> {
 class PendingInclude {constructor(readonly name:string,readonly from:string|undefined){}}
 const resources=new Map<string,string|undefined>();
 const key=(name:string,from:string|undefined)=>JSON.stringify([name,from]);
 // Replay the deterministic expander with cached resources as each dependency arrives.
 for(;;){
  options.signal?.throwIfAborted();
  try{
   return snapshotPreprocess(source,{...(options.includes?{includes:options.includes}:{}),...(options.definitions?{definitions:options.definitions}:{}),resolveInclude:(name,from)=>{
    const id=key(name,from);
    if(!resources.has(id))throw new PendingInclude(name,from);
    return resources.get(id);
   }});
  }catch(error){
   if(!(error instanceof PendingInclude))throw error;
   if(resources.size>=1000)throw new Error('Too many external include resources.');
   const value=await options.resolveInclude(error.name,error.from);
   options.signal?.throwIfAborted();
   resources.set(key(error.name,error.from),value);
  }
 }
}

export async function preprocessAsync(source:string,options:AsyncPreprocessOptions):Promise<string> {
 return (await snapshotPreprocessAsync(source,options)).source;
}

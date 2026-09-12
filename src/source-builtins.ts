import type {SourceValue} from './source-condition.js';

/** Deterministic helpers for labels and calculations; no host I/O. */
export function sourceBuiltin(name:string,args:SourceValue[],values:ReadonlyMap<string,string>):SourceValue {
 const arities:Record<string,[number,number]>={json_set:[3,3],json_remove:[2,2],json_encode:[1,1],json_at:[2,2],json_get:[2,2],json_has:[2,2],json_keys:[1,1],json_size:[1,1],json_type:[1,1],upper:[1,1],lower:[1,1],trim:[1,1],strlen:[1,1],substr:[2,3],strpos:[2,2],replace:[3,3],concat:[1,100],string:[1,1],number:[1,1],exists:[1,1],abs:[1,1],floor:[1,1],ceil:[1,1],round:[1,1],min:[1,100],max:[1,100]};
 const arity=Object.prototype.hasOwnProperty.call(arities,name) ? arities[name] : undefined;
 if(!arity)throw new Error(`Unknown source function "${name}".`);
 if(args.length<arity[0] || args.length>arity[1] || args.some(arg=>arg===undefined || typeof arg==='number' && !Number.isFinite(arg)))throw new Error(`Invalid arguments for ${name}.`);
 const text=(index:number)=>String(args[index]);
 const numeric=(index:number)=>{
  const value=Number(args[index]);
  if(text(index).trim()==='' || !Number.isFinite(value))throw new Error(`${name} requires finite numbers.`);
  return value;
 };
 if(name.startsWith('json_')){
  if(name==='json_encode')return JSON.stringify(args[0]);
  const parse=(input:string):unknown=>{
   try{return JSON.parse(input,(_key,value:unknown)=>{
    if(typeof value==='number' && !Number.isFinite(value))throw new Error('Nonfinite number');
    return value;
   });}catch{throw new Error(`${name} requires valid finite JSON.`);}
  };
  const data=parse(text(0));
  if(name==='json_type')return data===null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
  if(data===null || typeof data!=='object')throw new Error(`${name} requires a JSON object or array.`);
  if(name==='json_size')return Array.isArray(data) ? data.length : Object.keys(data).length;
  if(name==='json_keys')return JSON.stringify(Object.keys(data));
  const key=text(1);
  if(Array.isArray(data) && !/^(0|[1-9]\d*)$/.test(key))throw new Error('JSON array indices must be nonnegative integers.');
  const found=Object.prototype.hasOwnProperty.call(data,key);
  if(name==='json_has')return found;
  if(name==='json_set'){
   const value=parse(text(2));
   if(Array.isArray(data)){
    const index=Number(key);
    if(!Number.isSafeInteger(index)||index>data.length)throw new Error('JSON array update cannot create gaps.');
    data[index]=value;
   }else Object.defineProperty(data,key,{value,enumerable:true,writable:true,configurable:true});
   return JSON.stringify(data);
  }
  if(!found)throw new Error(`Unknown JSON key "${key}".`);
  if(name==='json_remove'){
   if(Array.isArray(data))data.splice(Number(key),1);
   else delete (data as Record<string,unknown>)[key];
   return JSON.stringify(data);
  }
  const value=(data as Record<string,unknown>)[key];
  if(name==='json_at')return JSON.stringify(value);
  if(typeof value==='number' && !Number.isFinite(value))throw new Error('JSON value must be finite.');
  return value!==null && ['string','number','boolean'].includes(typeof value) ? value as SourceValue : JSON.stringify(value);
 }
 switch(name){
  case 'upper':return text(0).toUpperCase();
  case 'lower':return text(0).toLowerCase();
  case 'trim':return text(0).trim();
  case 'strlen':return Array.from(text(0)).length;
  case 'string':return text(0);
  case 'number':return numeric(0);
  case 'exists':return values.has(text(0));
  case 'concat':return args.map(String).join('');
  case 'substr':{
   const start=numeric(1),length=args.length===3 ? numeric(2) : undefined;
   if(!Number.isSafeInteger(start)||start<0 || length!==undefined && (!Number.isSafeInteger(length)||length<0))throw new Error('substr requires nonnegative integer offsets.');
   return Array.from(text(0)).slice(start,length===undefined ? undefined : start+length).join('');
  }
  case 'strpos':{
   const position=text(0).indexOf(text(1));
   return position<0 ? -1 : Array.from(text(0).slice(0,position)).length;
  }
  case 'replace':{
   if(text(1)==='')throw new Error('replace requires a nonempty search string.');
   return text(0).split(text(1)).join(text(2));
  }
  case 'abs':return Math.abs(numeric(0));
  case 'floor':return Math.floor(numeric(0));
  case 'ceil':return Math.ceil(numeric(0));
  case 'round':return Math.round(numeric(0));
  case 'min':return Math.min(...args.map((_,index)=>numeric(index)));
  case 'max':return Math.max(...args.map((_,index)=>numeric(index)));
 }
 throw new Error(`Unknown source function "${name}".`);
}

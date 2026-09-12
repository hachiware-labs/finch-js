export type SourceValue=string|number|boolean|undefined;
const truth=(value:SourceValue)=>value!==undefined && !['','false','0'].includes(String(value));

/** Deliberately limited expression grammar; never evaluates host code. */
export function sourceExpression(expression:string,values:ReadonlyMap<string,string>,evaluate=true,invoke?:(name:string,args:SourceValue[])=>SourceValue):SourceValue {
 const tokens:string[]=[];let remaining=expression.trim();
 while(remaining){
  const token=remaining.match(/^("(?:\\.|[^"\\])*"|&&|\|\||==|!=|<=|>=|[!,()<>+*/%\-]|(?:0|[1-9]\d*)(?:\.\d+)?|[A-Za-z_]\w*)/);
  if(!token)throw new Error(`Invalid source condition: ${expression}`);
  tokens.push(token[0]);remaining=remaining.slice(token[0].length).trimStart();
 }
 const numeric=(value:SourceValue):number=>{
  if(value===undefined || String(value).trim()==='' || !Number.isFinite(Number(value)))throw new Error('Source arithmetic requires finite numbers.');
  return Number(value);
 };
 let index=0;
 const atom=(enabled:boolean):SourceValue=>{
  const token=tokens[index++];
  if(token==='!')return !truth(atom(enabled));
  if(token==='-'||token==='+'){const value=atom(enabled);return enabled ? numeric(value)*(token==='-'?-1:1) : 0;}
  if(token==='('){const value=or(enabled);if(tokens[index++]!==')')throw new Error('Unclosed condition parentheses.');return value;}
  if(token?.startsWith('"'))return JSON.parse(token) as string;
  if(token==='true'||token==='false')return token==='true';
  if(token!==undefined && /^-?\d/.test(token))return enabled ? numeric(token) : 0;
  if(token!==undefined && /^[A-Za-z_]\w*$/.test(token)){
   if(tokens[index]!=='(')return values.get(token);
   index++;const args:SourceValue[]=[];
   if(tokens[index]!==')')for(;;){args.push(or(enabled));if(tokens[index]!==',')break;index++;}
   if(tokens[index++]!==')')throw new Error('Unclosed source function call.');
   if(!enabled)return undefined;
   if(!invoke)throw new Error(`Unknown source function "${token}".`);
   return invoke(token,args);
  }
  throw new Error('Expected source condition value.');
 };
 const product=(enabled:boolean):SourceValue=>{
  let value=atom(enabled);
  while(['*','/','%'].includes(tokens[index] ?? '')){
   const operator=tokens[index++]!;const right=atom(enabled);
   if(!enabled){value=0;continue;}
   const a=numeric(value),b=numeric(right);
   if(operator!=='*' && b===0)throw new Error('Division by zero in source expression.');
   value=operator==='*'?a*b:operator==='/'?a/b:a%b;numeric(value);
  }
  return value;
 };
 const sum=(enabled:boolean):SourceValue=>{
  let value=product(enabled);
  while(['+','-'].includes(tokens[index] ?? '')){
   const operator=tokens[index++]!;const right=product(enabled);
   value=enabled ? numeric(value)+(operator==='+'?1:-1)*numeric(right) : 0;
   if(enabled)numeric(value);
  }
  return value;
 };
 const compare=(enabled:boolean):SourceValue=>{
  const left=sum(enabled),operator=tokens[index];
  if(!operator || !['==','!=','<','>','<=','>='].includes(operator))return left;
  index++;const right=sum(enabled);
  if(!enabled)return false;
  if(operator==='==')return left===undefined || right===undefined ? left===right : String(left)===String(right);
  if(operator==='!=')return left===undefined || right===undefined ? left!==right : String(left)!==String(right);
  const a=numeric(left),b=numeric(right);
  return operator==='<'?a<b:operator==='>'?a>b:operator==='<='?a<=b:a>=b;
 };
 const and=(enabled:boolean):SourceValue=>{let value=compare(enabled);while(tokens[index]==='&&'){index++;const next=compare(enabled && truth(value));value=truth(value)&&truth(next);}return value;};
 const or=(enabled:boolean):SourceValue=>{let value=and(enabled);while(tokens[index]==='||'){index++;const next=and(enabled && !truth(value));value=truth(value)||truth(next);}return value;};
 const result=or(evaluate);if(index!==tokens.length)throw new Error('Unexpected source condition token.');return result;
}

export function sourceCondition(expression:string,values:ReadonlyMap<string,string>,evaluate=true,invoke?:(name:string,args:SourceValue[])=>SourceValue):boolean { return truth(sourceExpression(expression,values,evaluate,invoke)); }

/** Read member modifiers without interpreting quoted default values. */
export function parseMemberModifiers(source:string):{text:string;modifiers:Set<string>} {
 const modifiers=new Set<string>();
 const quoted=String.raw`"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'`;
 let text=source.replace(new RegExp(`${quoted}|\\{(field|method|static|abstract|classifier)\\}`,'g'),(token:string,modifier:string|undefined)=>{
  if(!modifier)return token;
  modifiers.add(modifier==='classifier'?'static':modifier);
  return ' ';
 });
 text=text.replace(new RegExp(`${quoted}|[ \\t]+`,'g'),token=>/^\s/.test(token)?' ':token).trim();
 for(;;){
  const prefix=text.match(/^(static|abstract)\s+/);
  if(!prefix)break;
  modifiers.add(prefix[1]!);text=text.slice(prefix[0].length);
 }
 if(modifiers.has('field') && modifiers.has('method'))throw new Error('A member cannot be both field and method.');
 if(!text)throw new Error('A member modifier requires a member.');
 return {text,modifiers};
}

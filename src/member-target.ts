/** Resolve a member without guessing between overloaded operations. */
export function resolveMemberIndex(members:Array<{text:string;kind?:string;visibilityEscaped?:boolean}>,target:string):number {
 const normalized=members.map((member,index)=>({index,kind:member.kind,text:(member.visibilityEscaped?member.text:member.text.replace(/^[+~#-]\s*/,'')).trim()})).filter(member=>member.kind!=='separator');
 const exact=normalized.filter(member=>member.text===target);
 const matches=exact.length ? exact : normalized.filter(member=>{
  if(target.includes('(')){
   // Return types may follow a UML signature or precede a language-style one.
   return member.text.match(/([A-Za-z_$][\w$]*\([^)]*\))/)?.[1]===target;
  }
  const head=member.text.split(/[(:=]/)[0]!.trim();
  return head===target || head.match(/([A-Za-z_$][\w$]*)$/)?.[1]===target;
 });
 if(matches.length!==1)throw new Error(`Unknown or ambiguous member target "${target}". Use the full signature for overloaded operations.`);
 return matches[0]!.index;
}

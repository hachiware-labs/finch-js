export interface TextRun { text:string; bold?:boolean; italic?:boolean; strike?:boolean; color?:string; href?:string }
export function richRuns(input:string):TextRun[] {
 if(!/(?:<\/?(?:b|i|s|color)\b|\*\*|\/\/|--|\[\[)/.test(input))return [{text:input}];
 let value=input.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/(?<!:)\/\/([^/]+)\/\//g,'<i>$1</i>').replace(/--([^-]+)--/g,'<s>$1</s>');
 const result:TextRun[]=[],stack:Array<Omit<TextRun,'text'>&{tag?:string}>=[{}];
 const pattern=/<(b|i|s)>|<color:([#\w]+)>|<\/(b|i|s|color)>|\[\[(https?:\/\/[^\s\]]+)(?:\s+([^\]]+))?\]\]/g;
 let offset=0;
 for(const match of value.matchAll(pattern)){
  if(match.index!>offset)result.push({...stack[stack.length-1],text:value.slice(offset,match.index)});
  const current=stack[stack.length-1]!;
  if(match[4])result.push({...current,text:match[5]??match[4],href:match[4]});
  else if(match[3]){
   if(stack.length>1 && current.tag===match[3])stack.pop();
   else result.push({...current,text:match[0]});
  } else {
   const tag=match[1]??'color';
   stack.push({...current,tag,...(tag==='b'?{bold:true}:tag==='i'?{italic:true}:tag==='s'?{strike:true}:{color:match[2]!})});
  }
  offset=match.index!+match[0].length;
 }
 if(offset<value.length)result.push({...stack[stack.length-1],text:value.slice(offset)});
 return result;
}
export function richMarkup(run:TextRun):string {
 let text=run.text;
 if(run.href)text=`[[${run.href} ${text}]]`;
 if(run.color)text=`<color:${run.color}>${text}</color>`;
 if(run.strike)text=`<s>${text}</s>`;
 if(run.italic)text=`<i>${text}</i>`;
 if(run.bold)text=`<b>${text}</b>`;
 return text;
}
export function decorateText(root:SVGElement):void {
 for(const element of Array.from(root.querySelectorAll('text, tspan'))){
  if(element.children.length || element.hasAttribute('data-finch-rich'))continue;
  const runs=richRuns(element.textContent??'');
  if(!runs.some(r=>r.bold||r.italic||r.strike||r.color||r.href))continue;
  element.textContent='';
  element.setAttribute('data-finch-rich','true');
  for(const run of runs){
   const span=element.ownerDocument.createElementNS('http://www.w3.org/2000/svg','tspan');
   span.setAttribute('data-finch-rich','true');
   span.textContent=run.text;
   if(run.bold)span.setAttribute('font-weight','700');
   if(run.italic)span.setAttribute('font-style','italic');
   if(run.strike)span.setAttribute('text-decoration','line-through');
   if(run.color)span.setAttribute('fill',run.color);
   if(run.href){
    const link=element.ownerDocument.createElementNS('http://www.w3.org/2000/svg','a');
    link.setAttribute('href',run.href);link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');
    link.append(span);element.append(link);
   }else element.append(span);
  }
 }
}

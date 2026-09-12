/** Extract declaration metadata outside quoted labels and bracketed names/attributes. */
export function componentDecorations(line: string): {text:string; tags:string[]; stereotype?:string; stereotypes?:string[]} {
  const compact=line.match(/^(\s*)(?::([^:\n]+):|\(([^()\n]+)\))(?=\s|$)(.*)$/);
  if(compact && !/^\s*(?:[-<.]|:)/.test(compact[4]!)) {
    line=`${compact[1]}${compact[2] !== undefined ? 'actor' : 'usecase'} ${JSON.stringify(compact[2] ?? compact[3])}${compact[4]}`;
  }
  if(!/^\s*(?:\[|\(\)|(?:node|server|database|container|actor\/?|rectangle|rounded|system|component|external|interface|usecase\/?|device|execution|artifact|file|card|hexagon|label|circle|boundary|control|entity|collections|stack|action|storage|process|agent|person|package|port|portin|portout|provided|required|queue|cloud|folder|frame)\s)/.test(line))return {text:line,tags:[]};
  let text='',quoted=false,depth=0;
  const tags:string[]=[];
  const stereotypes:string[]=[];
  for(let i=0;i<line.length;){
    const c=line[i]!;
    if(quoted && c==='\\'){text+=line.slice(i,i+2);i+=2;continue;}
    if(c==='"'){quoted=!quoted;text+=c;i++;continue;}
    if(!quoted){
      if(c==='[')depth++;
      if(c===']')depth--;
      if(depth===0 && (i===0 || /\s/.test(line[i-1]!))){
        const rest=line.slice(i);
        const tag=rest.match(/^\$([\w.-]+)(?=\s|$|\{)/);
        if(tag){tags.push(tag[1]!);i+=tag[0].length;continue;}
        const kind=rest.match(/^<<([^<>]+)>>(?=\s|$|\{)/);
        if(kind){stereotypes.push(kind[1]!.trim());i+=kind[0].length;continue;}
        // Relations and their labels are not declarations.
        if(/^(?:[-<.]|:)/.test(rest))return {text:line,tags:[]};
      }
    }
    text+=c;i++;
  }
  return {text,tags,...(stereotypes.length?{stereotype:[...new Set(stereotypes)].join(", "),stereotypes:[...new Set(stereotypes)]}:{})};
}

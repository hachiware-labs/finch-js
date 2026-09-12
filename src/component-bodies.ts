/** Fold multiline deployment descriptions before interpreting their contents. */
export function expandComponentBodies(source:string):string|undefined {
 if(!/^\s*@(component|deployment|usecase)\b/.test(source))return undefined;
 const lines=source.split(/\r?\n/);let changed=false,shield:string|undefined;
 for(let i=0;i<lines.length;i++){
  const text=lines[i]!.trim();
  if(shield){if(text===`end ${shield}`)shield=undefined;continue;}
  if(/^(title|header|footer|legend)$/.test(text)){shield=text;continue;}
  const note=text.match(/^(note|rnote|hnote|constraint)\s+(?:(?:(?:left|right|top|bottom)\s+)?on\s+link|as\s+[\w.-]+|(?:(?:left|right|top|bottom)\s+of\s+)?(?:"(?:\\.|[^"\\])*"|\[[^\]]+\]|[\w.-]+))$/);
  if(note){shield=note[1];continue;}
  const alias=text.match(/^(component|node|folder|database|usecase\/?|card|artifact|file|queue|cloud|rectangle|hexagon|stack|action|storage|process|agent|person|collections|actor\/?|boundary|control|entity|label)\s+([\w.-]+)\s+(.*?)as\s+"([^"]*)$/);
  if(alias){
    const body:string[]=alias[4]?[alias[4]]:[];
    let end=i+1;
    while(end<lines.length&&!/^(?:\\.|[^"\\])*"\s*$/.test(lines[end]!.trim()))body.push(lines[end++]!.trim());
    if(end===lines.length)throw new Error(`Unclosed ${alias[1]} description on line ${i+1}; expected closing quote.`);
    const last=lines[end]!.trim().slice(0,-1);
    if(last)body.push(last);
    lines[i]=`${alias[1]} ${alias[2]} ${JSON.stringify(body.join('\n'))} ${alias[3]}`;
    for(let j=i+1;j<=end;j++)lines[j]='';
    i=end;changed=true;continue;
  }
  const start=text.match(/^(component|node|folder|database|usecase\/?|card|artifact|file|queue|cloud|rectangle|hexagon|stack|action|storage|process|agent|person|collections|actor\/?|boundary|control|entity|label)\s+([\w.-]+)\s+(.*?)\[$/);
  if(!start)continue;
  const body:string[]=[];let end=i+1;
  while(end<lines.length&&!/^\](?:\s+(?:\[(?:"(?:\\.|[^"\\])*"|[^"\]])*\]|<<[^<>]*>>|\$[\w.-]+))*(?:\s*(?:#|\/\/).*)?$/.test(lines[end]!.trim()))body.push(lines[end++]!.trim());
  if(end===lines.length)throw new Error(`Unclosed ${start[1]} description on line ${i+1}; expected ].`);
  lines[i]=`${start[1]} ${start[2]} ${JSON.stringify(body.join('\n'))} ${start[3]} ${lines[end]!.trim().slice(1)}`;
  for(let j=i+1;j<=end;j++)lines[j]='';
  i=end;changed=true;
 }
 return changed?lines.join('\n'):undefined;
}

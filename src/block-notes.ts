/** Fold block notes before other directives can interpret their literal body. */
export function expandBlockNotes(source:string):string|undefined {
 const lines=source.split(/\r?\n/);let changed=false;let heading:string|undefined;let memberBody=false;
 for(let index=0;index<lines.length;index++){
  const line=lines[index]!.trim();
  if(heading){if(line===`end ${heading}`)heading=undefined;continue;}
  const code=line.replace(/"(?:\\.|[^"\\])*"/g,'').replace(/\s+(?:#|\/\/).*$/,'').trim();
  if(memberBody){if(code==='}')memberBody=false;continue;}
  if(/^[+~#-]?\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(code)){memberBody=true;continue;}
  if(/^(title|header|footer|legend)$/.test(line)){heading=line;continue;}
  const spanning=line.match(/^(note|rnote|hnote)\s+over\s+([\w.-]+(?:\s*,\s*[\w.-]+)*)$/);
  const across=line.match(/^(note|rnote|hnote)\s+across$/);
  const named=line.match(/^(note|rnote|hnote)\s+as\s+([\w.-]+)$/);
  const previous=/^\s*@(class|object)\b/m.test(source) && /^(note|rnote|hnote)\s+(left|right|top|bottom)$/.test(line);
  const link=line.match(/^(note|rnote|hnote)(?:\s+(left|right|top|bottom))?\s+on\s+link$/);
  const start=link ? [line,link[1]!,link[1]!, 'link'] : named ? [line,named[1]!,named[1]!,named[2]!] : across ? [line,across[1]!,across[1]!,'across'] : spanning ? [line,`${spanning[1]} over`,spanning[1]!,spanning[2]!] : line.match(/^((note|rnote|hnote|constraint)(?:\s+(?:left|right|top|bottom)\s+of)?)\s+("(?:\\.|[^"\\])*"|\[[^\]\n]+\]|[\w.-]+(?:::[^"\n]+|->[\w.-]+)?)$/);
  if(!start)continue;
  const body:string[]=[];let end=index+1;
  while(end<lines.length && lines[end]!.trim()!==`end ${start[2]}`)body.push(lines[end++]!.trim());
  if(end===lines.length)throw new Error(`Unclosed ${start[2]} block on line ${index+1}; expected end ${start[2]}.`);
  lines[index]=link ? `${line}: ${JSON.stringify(body.join('\n'))}` : named ? `${start[1]} ${JSON.stringify(body.join('\n'))} as ${start[3]}` : `${start[1]} ${start[3]}${spanning||across||previous?':':''} ${JSON.stringify(body.join('\n'))}`;
  for(let at=index+1;at<=end;at++)lines[at]='';
  index=end;changed=true;
 }
 return changed?lines.join('\n'):undefined;
}

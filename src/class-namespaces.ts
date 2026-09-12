import {expandInlineStereotypes} from './inline-stereotypes.js';
import {normalizeElementAlias} from './element-aliases.js';
import {classRelationOperators} from './class-relations.js';
/** Resolve namespace-local IDs before the ordinary class parser runs. */
export function expandClassNamespaces(source:string,implicit=false):string {
  let separator=".";
  let literalBody=false,serial=0;
  source=source.split(/\r?\n/).map(line=>{
    if(literalBody){if(line.trim()==="}")literalBody=false;return line;}
    const setting=line.trim().match(/^set namespaceSeparator\s+(\S+)$/);
    if(setting){separator=setting[1]!;return "";}
    if(/^\s*(class|abstract|interface|enum|record|annotation|struct|protocol|entity)\s+.*\{\s*$/.test(line))literalBody=true;
    if(separator!=="." && separator!=="none"){
      const chunks=line.split(/("(?:\\.|[^"\\])*")/);
      line=chunks.map((part,index)=>index%2 ? part : part.replace(new RegExp("[\\w]+(?:" + separator.replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&") + "[\\w]+)+","g"),name=>name.split(separator).join("."))).join("");
    }
    if(/^\s*<>\s*$/.test(line)){
      let id;do{id=`__anonymous_diamond_${++serial}`;}while(source.includes(id));
      return `diamond ${id} ""`;
    }
    if(/^\s*<>\s+[\w.-]+/.test(line))return line;
    const diamonds:string[]=[];
    line=line.replace(/(^|\s)<>(?=\s|$)/g,(_,space:string)=>{
      let id;do{id=`__anonymous_diamond_${++serial}`;}while(source.includes(id));
      diamonds.push(`diamond ${id} ""`);return space+id;
    });
    return [...diamonds,line].join("\n");
  }).join("\n");
  source=expandInlineStereotypes(source);
  // Normalize empty declarations before namespace and template processing.
  let literal=false;
  source=source.split(/\r?\n/).map(line=>{
    if(literal){if(line.trim()==='}')literal=false;return line;}
    line=normalizeElementAlias(line);

    if(/^\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|entity)\s+.*\{\s*$/.test(line)){literal=true;return line;}
    // Quoted stereotype assignments predate classifier declarations; braces disambiguate declarations.
    if(/^\s*stereotype\s+[\w.-]+\s+"(?:\\.|[^"\\])*"\s*$/.test(line))return line;
    const empty=line.match(/^(\s*(?:class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+[\w.-]+(?:<[^{}\n]+>)?(?:\s+"(?:\\.|[^"\\])*")?)\s*(?:\{\s*\})?\s*$/);
    return empty ? `${empty[1]} {\n}` : line;
  }).join('\n');
  // Already-expanded source may re-enter through annotation parsing.
  if(/^\s*package\s+.*\[namespace\]\s*\{/m.test(source))return source;
  const expanded:string[]=[];let body=false;let closing=0;
  for(const line of source.split(/\r?\n/)){
    if(body){expanded.push(line);if(line.trim()==='}'){body=false;while(closing-->0)expanded.push('}');closing=0;}continue;}
    const declaration=line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)(.*\{)\s*$/);
    if(declaration){
      const parts=separator==='none'?[declaration[3]!]:declaration[3]!.split('.');
      if(parts.some(part=>!part))throw new Error('Invalid qualified classifier name.');
      closing=parts.length-1;
      for(const part of parts.slice(0,-1))expanded.push(`namespace ${part} {`);
      expanded.push(`${declaration[1]}${declaration[2]} ${parts[parts.length-1]}${declaration[4]}`);body=true;
    }else expanded.push(line);
  }
  source=expanded.join('\n');
  if(!/^\s*namespace\s/m.test(source))return source;
  const scopes:string[]=[];
  const frames:Array<'namespace'|'package'>=[];
  const symbols=new Set<string>();
  const namespaceLabels=new Map<string,string>();
  const explicitLabels=new Set<string>();
  let inClass=false;
  const qualify=(id:string)=>[...scopes,id].join('.');
  const lines=source.split(/\r?\n/).map(text=>{
    const scope=scopes.join('.');
    if(inClass){if(text.trim()==='}')inClass=false;return {text,scope,body:true};}
    const namespace=text.match(/^\s*namespace\s+([\w.-]+)(?:\s+"([^"]*)")?\s*\{$/);
    if(namespace){
      const id=qualify(namespace[1]!);
      const previous=namespaceLabels.get(id);
      if(explicitLabels.has(id) && namespace[2]!==undefined && previous!==namespace[2])throw new Error(`Conflicting namespace label for "${id}".`);
      const label=namespace[2] ?? previous ?? namespace[1]!;
      if(namespace[2]!==undefined)explicitLabels.add(id);
      namespaceLabels.set(id,label);symbols.add(id);scopes.push(namespace[1]!);frames.push('namespace');
      return {text:`package ${id} "${label}" [namespace] {`,scope,body:true};
    }
    const packageBlock=text.match(/^\s*package\s+([\w.-]+)(?:\s+"([^"]*)")?\s*\{$/);
    if(packageBlock){
      frames.push('package');const id=qualify(packageBlock[1]!);symbols.add(id);
      return {text:`package ${id} "${packageBlock[2] ?? packageBlock[1]}" {`,scope,body:true};
    }
    if(text.trim()==='}') {if(frames.pop()==='namespace')scopes.pop();return {text,scope,body:true};}
    const namedNote=text.match(/^(\s*(?:note|rnote|hnote)\s+"(?:\\.|[^"\\])*"\s+as\s+)([\w.-]+)\s*$/);
    if(namedNote){const id=qualify(namedNote[2]!);symbols.add(id);return {text:`${namedNote[1]}${id}`,scope,body:true};}
    const diamond=text.match(/^(\s*(?:diamond|circle)\s+)([\w.-]+)(.*)$/);
    if(diamond){const id=qualify(diamond[2]!);symbols.add(id);return {text:`${diamond[1]}${id}${diamond[3]}`,scope,body:true};}
    const declaration=text.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity)\s+([\w.-]+)(<.*>)?(\s*(?:"[^"]*"|[^\s{]+)?\s*\{)\s*$/);
    if(declaration){
      inClass=true;const id=qualify(declaration[3]!);symbols.add(id);
      const tail=declaration[5]!;
      return {text:`${declaration[1]}${declaration[2]} ${id}${declaration[4] ?? ''}${tail.trim()==='{' ? ` "${declaration[3]}" {` : tail}`,scope,body:true};
    }
    return {text,scope,body:false};
  });
  if(scopes.length)throw new Error('Unclosed namespace.');
  const resolve=(id:string,scope:string,infer=false):string=>{
    const parts=scope ? scope.split('.') : [];
    for(let length=parts.length;length>=0;length--){const candidate=[...parts.slice(0,length),id].join('.');if(symbols.has(candidate))return candidate;}
    if(implicit && infer){const candidate=scope && !id.includes('.') ? `${scope}.${id}` : id;symbols.add(candidate);return candidate;}
    return id;
  };
  if(implicit){
    const endpoints=new RegExp(String.raw`^\s*([\w.-]+)(?:::~?[\w$]+(?:\([^)]*\))?)?(?:\s+"[^"]*")?\s+(?:${classRelationOperators})(?:\s+"[^"]*")?\s+([\w.-]+)`);
    for(const line of lines){
      if(line.body)continue;
      const relation=line.text.match(endpoints);
      if(relation){resolve(relation[1]!,line.scope,true);resolve(relation[2]!,line.scope,true);}
      const member=line.text.match(/^\s*([\w.-]+)\s*:(?!:)/);
      if(member)resolve(member[1]!,line.scope,true);
    }
  }
  return lines.map(({text,scope,body})=>{
    if(body)return text.replace(/^package ([\w.-]+) "[^"]*" \[namespace\] \{$/,(_,id:string)=>`package ${id} "${namespaceLabels.get(id)}" [namespace] {`);
    const slot=text.match(/^(\s*)([\w.-]+)(\s*:(?!:).*)$/);
    if(slot)return `${slot[1]}${resolve(slot[2]!,scope,true)}${slot[3]}`;
    const binding=text.match(/^(\s*bind\s+)([\w.-]+)\s+([\w.-]+)(.*)$/);
    if(binding)return `${binding[1]}${resolve(binding[2]!,scope)} ${resolve(binding[3]!,scope)}${binding[4]}`;
    const association=text.match(/^(\s*association\s+)([\w.-]+)\s+([\w.-]+)(?:->([\w.-]+))?\s*$/);
    if(association)return `${association[1]}${resolve(association[2]!,scope)} ${association[4] ? `${resolve(association[3]!,scope)}->${resolve(association[4],scope)}` : association[3]}`;
    const memberRelation=text.match(new RegExp(String.raw`^(\s*)([\w.-]+)(::~?[\w$]+(?:\([^)]*\))?)?(\s+(?:"[^"]*"\s+)?(?:${classRelationOperators})(?:\s+"[^"]*")?\s+)([\w.-]+)(::~?[\w$]+(?:\([^)]*\))?)?(.*)$`));
    if(memberRelation && (memberRelation[3] || memberRelation[6]))return `${memberRelation[1]}${resolve(memberRelation[2]!,scope,true)}${memberRelation[3] ?? ''}${memberRelation[4]}${resolve(memberRelation[5]!,scope,true)}${memberRelation[6] ?? ''}${memberRelation[7]}`;
    const relation=text.match(new RegExp(String.raw`^(\s*)([\w.-]+)(\s+(?:"[^"]*"\s+)?(?:${classRelationOperators})(?:\s+"[^"]*")?\s+)([\w.-]+)(.*)$`));
    if(relation)return `${relation[1]}${resolve(relation[2]!,scope,true)}${relation[3]}${resolve(relation[4]!,scope,true)}${relation[5]}`;
    text=text.replace(/^(\s*(?:note|rnote|hnote|constraint)(?:\s+(?:left|right|top|bottom)\s+of)?\s+)([\w.-]+)->([\w.-]+)/,(_,prefix:string,from:string,to:string)=>`${prefix}${resolve(from,scope)}->${resolve(to,scope)}`);
    return text.replace(/^(\s*(?:(?:note|rnote|hnote|constraint)(?:\s+(?:left|right|top|bottom)\s+of)?|visibility|stereotype|tag|hide|show|remove|restore)\s+)([\w.-]+)/,(_,prefix:string,id:string)=>prefix+resolve(id,scope));
  }).join('\n');
}

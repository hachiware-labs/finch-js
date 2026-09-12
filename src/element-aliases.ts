/** Stable internal identity for a bracketed display name without an alias. */
export function componentNameId(name:string):string {
 return /^[\w.-]+$/.test(name) ? name : '__component_' + Array.from(name).map(c=>c.codePointAt(0)!.toString(16)).join('_');
}

/** Normalize display-name aliases without changing member bodies. */
export function normalizeElementAlias(line:string):string {
    line=line.replace(/^(\s*)\(\)\s+/, '$1circle ');
    line=line.replace(/^(\s*)<>\s+/, '$1diamond ');
    line=line.replace(/^(\s*)abstract\s+class\s+/, '$1abstract ');
    const alias=line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|circle)\s+("(?:\\.|[^"\\])*")\s+as\s+([\w.-]+(?:<[^{}]+?>)?)(\s*(?:<<[^<>\n]+>>\s*)?(?:\{\s*\}?)?)\s*$/);
    if(alias)line=`${alias[1]}${alias[2]} ${alias[4]} ${alias[3]}${alias[2]==='stereotype' && !alias[5]!.trim() ? ' {}' : alias[5]}`;
    const named=line.match(/^(\s*)(class|abstract|interface|enum|annotation|record|dataclass|struct|protocol|exception|metaclass|stereotype|entity|object|map|circle)\s+([\w.-]+(?:<[^{}]+?>)?)\s+as\s+("(?:\\.|[^"\\])*")(\s*(?:<<[^<>\n]+>>\s*)?(?:\{\s*\}?)?)\s*$/);
    if(named)line=`${named[1]}${named[2]} ${named[3]} ${named[4]}${named[2]==='stereotype' && !named[5]!.trim() ? ' {}' : named[5]}`;

 return line;
}


/** Preserve declaration suffixes such as style attributes and container braces. */
export function normalizeDeploymentAlias(line:string):string {
 const compact=line.match(/^(\s*)(?::([^:\n]+):|\(([^()\n]+)\))(?:\s+as\s+([\w.-]+))?(\s*(?:\[[^\]]*\])?\s*)$/);
 if(compact){
   const label=compact[2] ?? compact[3]!;
   return `${compact[1]}${compact[2] !== undefined ? 'actor' : 'usecase'} ${compact[4] ?? componentNameId(label)} ${JSON.stringify(label)}${compact[5]}`;
 }
 line=line.replace(/^(\s*)\(\)\s+/, '$1provided ');
 const bracket=line.match(/^(\s*)(?:component\s+)?\[([^\]\n]+)\](?:\s+as\s+([\w.-]+))?(\s*(?:\[[^\]]*\])?\s*\{?\s*)$/);
 if(bracket){
   const id=bracket[3] ?? componentNameId(bracket[2]!);
   return `${bracket[1]}component ${id} ${JSON.stringify(bracket[2])}${bracket[4]}`;
 }
 const kinds='node|server|database|container|actor/?|rectangle|rounded|system|component|external|interface|usecase/?|device|execution|artifact|file|card|hexagon|label|circle|boundary|control|entity|collections|stack|action|storage|process|agent|person|package|port|portin|portout|provided|required|queue|cloud|folder|frame';
 const quoted=String.raw`"(?:\\.|[^"\\])*"`;
 const suffix=String.raw`(\s*(?:\[[^\]]*\])?\s*(?:\{\s*\}?)?\s*)`;
 const unnamed=line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+(${quoted})${suffix}$`));
 if(unnamed){
   const name=unnamed[3]!.slice(1,-1).replace(/\\"/g,'"');
   return `${unnamed[1]}${unnamed[2]} ${componentNameId(name)} ${unnamed[3]}${unnamed[4]}`;
 }
 const first=line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+(${quoted})\s+as\s+([\w.-]+)${suffix}$`));
 if(first)return `${first[1]}${first[2]} ${first[4]} ${first[3]}${first[5]}`;
 const bare=line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+([\w.-]+)\s+as\s+([\w.-]+)${suffix}$`));
 if(bare)return `${bare[1]}${bare[2]} ${bare[4]} ${JSON.stringify(bare[3])}${bare[5]}`;
 const last=line.match(new RegExp(String.raw`^(\s*)(${kinds})\s+([\w.-]+)\s+as\s+(${quoted})${suffix}$`));
 return last ? `${last[1]}${last[2]} ${last[3]} ${last[4]}${last[5]}` : line;
}

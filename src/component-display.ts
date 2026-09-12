import type {SemanticModel} from "./types.js";
import {componentNameId} from "./element-aliases.js";

export function applyComponentDisplay(model: SemanticModel, rules: string[], kinds: Map<string,string>): void {
  const linked=new Set(model.connections.flatMap(edge=>[edge.from,edge.to]));
  for(const rule of rules){
    const match=rule.match(/^(hide|show|remove|restore)\s+(.+)$/)!;
    let selector=match[2]!.trim();
    if(selector==='@unlinked')selector='unlinked';
    const stereotypeOnly=selector==='stereotype' || /\s+stereotype$/.test(selector);
    if(stereotypeOnly){
      if(!['hide','show'].includes(match[1]!))throw new Error('Only hide/show can select stereotype labels.');
      selector=selector==='stereotype'?'*':selector.replace(/\s+stereotype$/,'');
    }
    const literalTarget=selector.startsWith('[') && selector.endsWith(']') || selector.startsWith('"') && selector.endsWith('"');
    if(selector.startsWith("[") && selector.endsWith("]"))selector=componentNameId(selector.slice(1,-1));
    if(selector.startsWith('"') && selector.endsWith('"'))selector=componentNameId(JSON.parse(selector));
    const selected=model.nodes.filter(node=>node.id===selector || !literalTarget && (selector==='*' || kinds.get(node.id)===selector || selector.startsWith('$') && (JSON.parse(node.attributes.tags ?? '[]') as string[]).includes(selector.slice(1)) || (JSON.parse(node.attributes.stereotypes ?? JSON.stringify(node.attributes.stereotype ? [node.attributes.stereotype] : [])) as string[]).some(value=>selector===`<<${value}>>`) || selector==='unlinked' && !linked.has(node.id)));
    if(!selected.length && (literalTarget || !selector.startsWith('$') && !/^<<.+>>$/.test(selector) && !['*','unlinked','component','interface','provided','required','node','package','folder','frame','cloud','database','artifact','file','card','hexagon','label','circle','boundary','control','entity','collections','stack','action','storage','process','agent','person','json','port','portin','portout','rectangle','server','container','actor','rounded','system','external','usecase','device','execution','queue'].includes(selector)))throw new Error(`Unknown display target ${selector}.`);
    for(const node of selected){
      if(stereotypeOnly){node.attributes.hideStereotype=String(match[1]==='hide');continue;}
      node.attributes.hidden=String(match[1]==='hide'||match[1]==='remove');
      node.attributes.removed=String(match[1]==='remove');
    }
  }
}

export function componentDisplayModel(model: SemanticModel): SemanticModel {
  const hidden=new Set(model.nodes.filter(node=>node.attributes.hidden==='true').map(node=>node.id));
  const removed=new Set(model.nodes.filter(node=>node.attributes.removed==='true').map(node=>node.id));
  // A hidden or removed group also controls its descendants, without changing their own settings.
  for(let changed=true;changed;){
    changed=false;
    for(const node of model.nodes)for(const set of [hidden,removed]){
      if((node.parentId && set.has(node.parentId) || node.attributes.jsonRoot && set.has(node.attributes.jsonRoot)) && !set.has(node.id)){set.add(node.id);changed=true;}
    }
  }
  const connections=model.connections.filter(edge=>!removed.has(edge.from)&&!removed.has(edge.to)).map(edge=>hidden.has(edge.from)||hidden.has(edge.to)?{...edge,attributes:{...edge.attributes,hidden:'true'}}:edge);
  const targets=new Set([...model.nodes.filter(node=>!hidden.has(node.id)&&!removed.has(node.id)).map(node=>node.id),...connections.filter(edge=>edge.attributes?.hidden!=='true').map(edge=>edge.id)]);
  const nodes=model.nodes.filter(node=>!removed.has(node.id)&&(!node.attributes.annotationTarget||targets.has(node.attributes.annotationTarget))).map(node=>hidden.has(node.id)?{...node,attributes:{...node.attributes,hidden:'true'}}:node);
  const ids=new Set(nodes.map(node=>node.id));
  return {...model,nodes,connections:connections.filter(edge=>ids.has(edge.from)&&ids.has(edge.to))};
}

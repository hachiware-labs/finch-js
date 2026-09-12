import type {SemanticModel} from './types.js';

export function parseActivityLaneSwitches(source:string,parse:(source:string)=>SemanticModel):SemanticModel|undefined {
  if(!/^\s*in\s+[\w.-]+\s*$/m.test(source) && !(/^\s*@activity\s+flow\b/m.test(source) && /^\s*lane\s+.*\{\s*$/m.test(source)))return undefined;
  const lanes=new Map<string,string>(),owners=new Map<string,string>();let current:string|undefined;
  const frames:Array<{loop?:string;lane?:string;previous:string|undefined}>=[];let serial=0;
  const lines=source.split(/\r?\n/);
  for(const line of lines){
    const lane=line.trim().match(/^lane\s+([\w.-]+)(?:\s+"([^"]*)")?(?:\s*\{)?$/);
    if(lane){const old=lanes.get(lane[1]!);if(old!==undefined && lane[2]!==undefined && old!==lane[2])throw new Error(`Conflicting lane label ${lane[1]}.`);lanes.set(lane[1]!,lane[2] ?? old ?? lane[1]!);}
  }
  const body=lines.map(line=>{
    if(/^\s*(?:#|')/.test(line))return line;
    const laneBlock=line.trim().match(/^lane\s+([\w.-]+)(?:\s+"[^"]*")?\s*\{$/);
    if(laneBlock){
      if(frames.some(frame=>frame.lane))throw new Error('Lanes cannot be nested.');
      frames.push({lane:laneBlock[1]!,previous:current});current=laneBlock[1]!;return '';
    }
    if(/^\s*lane\s+[\w.-]+(?:\s+"[^"]*")?\s*$/.test(line))return '';
    const change=line.trim().match(/^in\s+([\w.-]+)$/);
    if(change){if(!lanes.has(change[1]!))throw new Error(`Unknown lane ${change[1]}.`);current=change[1]!;return '';}
    if(line.trim()==='}') {const frame=frames.pop();if(frame?.lane){current=frame.previous;return '';}}
    const loop=line.trim().match(/^(while|repeat)\s+([\w.-]+)/);
    if(line.trim().endsWith('{'))frames.push({...(loop ? {loop:loop[2]!}:{}),previous:current});
    if(/^(break|continue)$/.test(line.trim())) {
      const ownerLoop=[...frames].reverse().find(frame=>frame.loop)?.loop;
      serial++;
      if(ownerLoop&&current)owners.set(`${ownerLoop}.${line.trim()}${serial}`,current);
    }
    const declaration=line.trim().match(/^(start|end|flowfinal|action|activity|send|receive|object|decision|merge|fork|join|if|while|repeat|switch|split)\s+([\w.-]+)/);
    if(declaration&&current){owners.set(declaration[2]!,current);if(['if','while','repeat','switch','split'].includes(declaration[1]!)){owners.set(`${declaration[2]}.done`,current);owners.set(`${declaration[2]}.test`,current);}}
    return line;
  }).join('\n');
  if(frames.some(frame=>frame.lane))throw new Error('Unclosed lane block.');
  const model=parse(body);
  for(const node of model.nodes){const owner=owners.get(node.id);if(owner)node.parentId=owner;}
  for(const [id,label] of lanes){
    if(model.nodes.some(n=>n.id===id))throw new Error(`Lane ID conflicts with node ${id}.`);
    model.nodes.push({id,label,shape:'container',attributes:{umlBlock:'lane'}});
  }
  return {...model,source};
}

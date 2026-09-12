import type {LayoutModel} from './types.js';
/** Display-only grouping: parsed transitions and original source remain untouched. */
export function groupStateTransitions(model:LayoutModel):void {
 if(model.kind!=='state')return;
 // Notes and edge-ID references need their individual visual targets.
 if(model.items.some(n=>n.attributes.annotationTarget))return;
 const grouped=new Map<string,typeof model.connections[number]>();
 const result:typeof model.connections=[];
 for(const e of model.connections){
  if(e.from===e.to||!e.label){result.push(e);continue;}
  const attributes=e.attributes ?? {};
  const visual=Object.entries(attributes).filter(([k])=>!['id','trigger','triggerKind','guard','effect'].includes(k)).sort(([a],[b])=>a.localeCompare(b));
  const key=JSON.stringify([e.from,e.to,e.dashed,visual]);
  const previous=grouped.get(key);
  if(previous){previous.label+='\\n'+e.label;previous.attributes={...previous.attributes,groupedTransitionIds:JSON.stringify([...JSON.parse(previous.attributes!.groupedTransitionIds!),e.id])};}
  else{const copy={...e,attributes:{...attributes,groupedTransitionIds:JSON.stringify([e.id])}};grouped.set(key,copy);result.push(copy);}
 }
 model.connections=result;
}

import type { GeometryNode } from './types.js';

/** Keep member attachment positions stable after filtering, reordering and dragging. */
export function annotationAnchor(node: GeometryNode, index?: string): {x:number;y:number} {
  const x=node.x+node.width;
  if(index===undefined)return {x,y:node.y+node.height/2};
  const members=JSON.parse(node.attributes.members ?? '[]') as Array<{kind:string}>;
  const hidden=JSON.parse(node.attributes.hiddenMembers ?? '[]') as number[];
  const visible=members.map((member,i)=>({...member,index:i})).filter(m=>!hidden.includes(m.index));
  if(node.attributes.customCompartments==='true'){
    const header=node.height-12-visible.length*23;
    return {x,y:node.y+header+15+visible.findIndex(m=>m.index===Number(index))*23};
  }
  const attributes=visible.filter(m=>m.kind!=='operation'),operations=visible.filter(m=>m.kind==='operation');
  const rows=Math.max((node.attributes.hideEmptyFields ?? node.attributes.hideEmptyMembers)==='true' ? 0 : 1,attributes.length);
  const operationRows=Math.max((node.attributes.hideEmptyOperations ?? node.attributes.hideEmptyMembers ?? 'true')==='true' ? 0 : 1,operations.length);
  const header=node.height-12-(rows+operationRows)*23;
  const attribute=attributes.findIndex(m=>m.index===Number(index));
  const operation=operations.findIndex(m=>m.index===Number(index));
  const offset=attribute>=0 ? header+15+attribute*23 : header+rows*23+16+operation*23;
  return {x,y:node.y+offset};
}

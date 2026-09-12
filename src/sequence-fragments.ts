/** Shared horizontal bounds for sequence fragments and spanning notes. */
export function sequenceFragmentSpan(nodes:ReadonlyArray<{x:number;width:number}>,kind?:string):{x:number;width:number}{
 const left=nodes.length?Math.min(...nodes.map(node=>node.x)):0;
 const right=nodes.length?Math.max(...nodes.map(node=>node.x+node.width)):100;
 const width=Math.max(right-left,kind==='note'?160:0);
 return {x:(left+right-width)/2,width};
}

/** Costs use SVG units, independent of browser zoom. */
export interface RoutingCost {
 crossingRisk?:number; crossings:number; branchCongestion:number; congestion:number; bends:number; length:number;
}
export interface RoutingPolicy {mode:'balanced'|'avoid-crossings'; crossing:number; bend:number; length:number; crossingClearance:number;}
export function routingPolicy(attributes:Record<string,string>={}):RoutingPolicy {
 const mode=attributes.routing ?? 'balanced';
 if(mode!=='balanced' && mode!=='avoid-crossings')throw new Error(`Unknown routing policy: ${mode}`);
 const value=(key:string,fallback:number)=>{
  if(attributes[key]===undefined)return fallback;
  const parsed=Number(attributes[key]);
  if(!Number.isFinite(parsed)||parsed<=0||parsed>10000)throw new Error(`${key} must be greater than 0 and at most 10000`);
  return parsed;
 };
 return {mode,crossing:value('crossingCost',120),bend:value('bendCost',48),length:value('lengthCost',1),crossingClearance:value('crossingClearance',18)};
}
export function compareRoutingCost(a:RoutingCost,b:RoutingCost,p:RoutingPolicy):number {
 // Keep ambiguous shared channels more expensive than clear perpendicular crossings.
 const risk=(a.crossingRisk ?? 0)-(b.crossingRisk ?? 0);
 if(Math.abs(risk)>0.001)return risk;
 const congestion=(a.branchCongestion+a.congestion)-(b.branchCongestion+b.congestion);
 if(Math.abs(congestion)>0.001)return congestion;
 if(p.mode==='avoid-crossings' && a.crossings!==b.crossings)return a.crossings-b.crossings;
 const score=(c:RoutingCost)=>c.crossings*p.crossing+c.bends*p.bend+c.length*p.length;
 return score(a)-score(b)||a.crossings-b.crossings||a.bends-b.bends||a.length-b.length;
}

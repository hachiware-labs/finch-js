import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
let src=await readFile('src/paired-block-order.ts','utf8');
const scoreBody=src.slice(src.indexOf(' const score='),src.indexOf(' const better='));
src=`export let mode='full';export let stats:any={};export function configure(value:string){mode=value;stats={evaluations:0,pairs:0};}\n`+src;
src=src.replace(" if(!['graph'", " if(mode==='off')return;\n if(!['graph'");
src=src.replace(' const permutations=',` const perspectives=(group:GeometryNode[])=>{
 const patterns:Array<{keys:string[],nodes:GeometryNode[]}>=[];
 const keys=[...new Set(model.connections.map(e=>e.label?.trim()).filter(Boolean))] as string[];
 for(const key of keys){const ids=model.connections.filter(e=>e.label?.trim()===key).flatMap(e=>[e.from,e.to]);const ordered=[...group].sort((a,b)=>{const rank=(n:GeometryNode)=>{const i=ids.indexOf(n.id);return i<0?Infinity:i;};return rank(a)-rank(b);});const existing=patterns.find(p=>p.nodes.map(n=>n.id).join(',')===ordered.map(n=>n.id).join(','));if(existing)existing.keys.push(key);else if(patterns.length<3)patterns.push({keys:[key],nodes:ordered});}
 if(!patterns.length)patterns.push({keys:['declaration'],nodes:group});return patterns;
 };\n const permutations=`);
src=src.replace('  for(const a of permutations(left))for(const b of permutations(right))for(const [stagger,ports] of variants){',`  const lp=perspectives(left),rp=perspectives(right);
  const matched=lp.flatMap(a=>rp.filter(b=>a.keys.some(k=>b.keys.includes(k))).map(b=>({a:a.nodes,b:b.nodes})));
  const mixed=lp.flatMap(a=>rp.filter(b=>!a.keys.some(k=>b.keys.includes(k))).map(b=>({a:a.nodes,b:b.nodes})));
  const orderPairs=mode==='full'?permutations(left).flatMap(a=>permutations(right).map(b=>({a,b}))):mode==='same'?matched.length?matched:[{a:lp[0]!.nodes,b:rp[0]!.nodes}]:[...matched,...mixed];
  stats.pairs+=orderPairs.length;stats.patterns=[lp.length,rp.length];
  for(const {a,b} of orderPairs)for(const [stagger,ports] of variants){`);
src=src.replace('   const candidate=score(route(candidateModel));','   stats.evaluations++;const candidate=score(route(candidateModel));');
src=src.replace(" if(mode==='off')return;"," if(mode==='off')return;const started=performance.now();").replace(' return selectedModel;',' stats.searchMs=performance.now()-started;return selectedModel;');
src+=`\nexport function evaluate(nodes:GeometryNode[],model:LayoutModel,edges:GeometryEdge[]){${scoreBody}return score(edges)[1];}\n`;
await build({stdin:{contents:`export {createFinch} from './src/index.ts';export {configure,stats,evaluate} from './src/paired-block-order.ts';`,resolveDir:process.cwd()},loader:{'.png':'dataurl'},bundle:true,format:'esm',platform:'node',outfile:'reports/search-benchmark/experiment.mjs',plugins:[{name:'experiment-only',setup(b){b.onLoad({filter:/paired-block-order\.ts$/},()=>({contents:src,loader:'ts'}));}}]});
await writeFile('reports/search-benchmark/experimental-order.ts',src);

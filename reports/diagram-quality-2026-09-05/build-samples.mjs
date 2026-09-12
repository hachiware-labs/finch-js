import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));
const root = path.resolve(out,'../..');
const scratch = 'C:/Users/naruhide/AppData/Local/Temp/finch-quality-20260905';
const nodes = [
 ['submit','申請を提出','start'],['check','申請内容を確認','process'],
 ['valid','必要な情報は揃っている？','decision'],['fix','申請内容を修正','process'],
 ['amount','10万円以上？','decision'],['manager','部門長が承認','process'],
 ['finance','経理が確認','process'],['pay','振込を手配','process'],['done','申請者へ完了を通知','end']
];
const edges = [['submit','check'],['check','valid'],['valid','fix','不備あり'],['fix','check','再申請'],['valid','amount','不備なし'],['amount','manager','はい'],['amount','finance','いいえ'],['manager','finance','承認'],['finance','pay'],['pay','done']];
const cases = [
 {id:'approval',title:'01 差し戻しのある経費精算',purpose:'2つの条件分岐・差し戻し・合流。主経路と例外経路を追えるか。',kind:'flowchart',nodes,edges},
 {id:'departments',title:'02 部門をまたぐ受注・請求',purpose:'3つの部門境界と顧客をまたぐ関係。枠、接続線、ラベルを区別できるか。',kind:'graph',groups:[['sales','営業部'],['ops','業務部'],['accounting','経理部']],nodes:[['customer','顧客','process'],['inquiry','依頼内容を確認','process','sales'],['quote','見積を作成','process','sales'],['order','受注を登録','process','ops'],['arrange','出荷を手配','process','ops'],['stock','在庫管理','database','ops'],['invoice','請求書を発行','process','accounting'],['paid','入金を確認','process','accounting']],edges:[['customer','inquiry','依頼'],['inquiry','quote'],['quote','order','受注確定'],['order','arrange'],['arrange','stock','在庫引当'],['order','invoice','請求依頼'],['invoice','customer','請求書'],['customer','paid','支払い'],['paid','order','入金状況']]},
 {id:'long-labels',title:'03 説明が増えた経費精算',purpose:'01と同じノード・接続で、日本語の説明だけを延長。改行は手で指定しない。',kind:'flowchart',nodes:nodes.map(([id,label,type])=>[id,({submit:'領収書と費用の内訳を添付して経費精算を申請',check:'申請内容と添付された証憑の整合性を確認',valid:'申請に必要な情報と領収書がすべて揃っている？',fix:'差し戻し理由を確認し不足している情報を追記',amount:'今回の申請金額は税込みで10万円以上？',manager:'部門長が利用目的と予算の妥当性を確認して承認',finance:'経理担当が勘定科目と支払先の口座情報を確認',pay:'次回の支払日に合わせて振込処理を手配',done:'振込予定日と処理結果を申請者へ通知'})[id],type]),edges:edges.map(([a,b,l])=>[a,b,({不備あり:'不足情報や確認が必要な項目がある',再申請:'不足情報を追記して再申請',不備なし:'必要事項と証憑を確認できた',はい:'税込み10万円以上',いいえ:'税込み10万円未満',承認:'部門長による承認が完了'})[l]??l])}
];
const q=s=>JSON.stringify(s);
function finch(c){
 const node=n=>c.kind==='graph'?`${n[0]} ${q(n[1])}${n[2]==='database'?' [shape=database]':''}`:`${n[2]} ${n[0]} ${q(n[1])}`;
 const lines=[`@${c.kind}`,...c.nodes.filter(n=>!n[3]).map(node)];
 for(const [id,label]of c.groups??[])lines.push(`group ${id} ${q(label)} {`,...c.nodes.filter(n=>n[3]===id).map(n=>'  '+node(n)),'}');
 lines.push(...c.edges.map(([a,b,l])=>`${a} -> ${b}${l?': '+l:''}`));return lines.join('\n');
}
function mermaid(c){
 const node=([id,label,type])=>type==='decision'?`${id}{${q(label)}}`:type==='database'?`${id}[(${q(label)})]`:['start','end'].includes(type)?`${id}([${q(label)}])`:`${id}[${q(label)}]`;
 const lines=['flowchart TB',...c.nodes.filter(n=>!n[3]).map(node)];
 for(const[id,label]of c.groups??[])lines.push(`subgraph ${id}[${q(label)}]`,...c.nodes.filter(n=>n[3]===id).map(node),'end');
 lines.push(...c.edges.map(([a,b,l])=>`${a} -->${l?'|'+q(l)+'|':''} ${b}`));return lines.join('\n');
}
function d2(c){
 const node=([id,label,type])=>`${id}: ${q(label)}${type==='decision'?' {shape: diamond}':type==='database'?' {shape: cylinder}':['start','end'].includes(type)?' {shape: oval}':''}`;
 const ref=id=>{const n=c.nodes.find(n=>n[0]===id);return n[3]?`${n[3]}.${id}`:id;};
 const lines=['direction: down',...c.nodes.filter(n=>!n[3]).map(node)];
 for(const[id,label]of c.groups??[])lines.push(`${id}: ${q(label)} {`,...c.nodes.filter(n=>n[3]===id).map(n=>'  '+node(n)),'}');
 lines.push(...c.edges.map(([a,b,l])=>`${ref(a)} -> ${ref(b)}${l?': '+q(l):''}`));return lines.join('\n');
}
for(const c of cases){c.sources={finch:finch(c),mermaid:mermaid(c),d2:d2(c)};await fs.writeFile(path.join(out,'assets',`${c.id}.d2`),c.sources.d2);for(const engine of ['dagre','elk']){execFileSync(`${scratch}/d2-v0.8.2/bin/d2.exe`,['--layout',engine,'--pad','24',path.join(out,'assets',`${c.id}.d2`),path.join(out,'assets',`${c.id}-d2-${engine}.svg`)],{stdio:'pipe'});}}
const study=await fs.readFile(path.join(root,'examples/style-study.html'),'utf8');
const businessMatch=study.match(/business: \{\s*theme: (\{[\s\S]*?gapY: 44 \})/);
const businessTheme=businessMatch[1].replace('Finch.defaultTheme','window.Finch.defaultTheme').replace('fontFamily: sans',`fontFamily: 'Arial, "Yu Gothic", "Meiryo", "Hiragino Sans", sans-serif'`);
const escapeTemplate=s=>s.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${');
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><title>Rendering fixtures</title><style>body{margin:0;background:white}.target{display:inline-block}svg{max-width:none!important}</style><script src="./assets/finch.global.js"></script><script type="module">
import mermaid from '/vendor/mermaid/dist/mermaid.esm.min.mjs';
window.samples=${JSON.stringify(cases)};window.result={};
const businessTheme=${businessTheme};
${cases.map(c=>`const ${c.id.replaceAll('-','_')}Source = \`${escapeTemplate(c.sources.finch)}\`;`).join('\n')}
await document.fonts.ready;
for(const c of window.samples){
 for(const variant of ['finch-default','finch-business','mermaid']){
  const host=document.createElement('div');host.id=c.id+'-'+variant;host.className='target';document.body.append(host);
  try{
   if(variant.startsWith('finch')){
    const diagram=Finch.render(c.sources.finch,{target:host,editor:false,interactive:false,...(variant==='finch-business'?{theme:businessTheme}:{})});
    if(variant==='finch-business'){const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.finch-node [filter]{filter:none}.finch-node text{font-weight:600}.finch-edge-label{font-weight:400}';diagram.svg.append(style);}
    window.result[host.id]={svg:diagram.toSvgString(),geometry:diagram.geometry};
   }else{mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'default'});const {svg}=await mermaid.render('m-'+c.id,c.sources.mermaid);host.innerHTML=svg;window.result[host.id]={svg};}
  }catch(e){window.result[host.id]={error:String(e)};}
 }
}
window.done=true;
</script></html>`;
await fs.writeFile(path.join(out,'fixtures.html'),html);
await fs.writeFile(path.join(out,'cases.json'),JSON.stringify(cases,null,2));
const manifest={capturedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),finchPackage:'0.5.1 + working-tree snapshot',finchBundleSha256:createHash('sha256').update(await fs.readFile(path.join(out,'assets/finch.global.js'))).digest('hex'),styleStudySha256:createHash('sha256').update(study).digest('hex'),mermaid:'11.17.2',d2:'0.8.2',d2Engines:['dagre (default)','elk (alternative)'],viewport:1280,manualPositions:false,notes:['Synthetic Japanese business examples, not user business data.','Identical labels and connections across products. Natural shapes and explicit top-to-bottom direction; no manual line breaks.','Finch Business is study theme + font weight / shadow CSS, without sample-specific emphasis.','D2 outer padding normalized to 24, defaults otherwise.','Layout quality and default visual styles are observed jointly; not a speed/LLM reliability benchmark.']};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({out,cases:cases.map(c=>({id:c.id,nodes:c.nodes.length,edges:c.edges.length}))}));

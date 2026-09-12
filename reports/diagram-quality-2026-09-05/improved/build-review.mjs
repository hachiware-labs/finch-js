import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const out=path.dirname(fileURLToPath(import.meta.url));
const baseline=path.dirname(out);
const cases=JSON.parse(await fs.readFile(path.join(out,'cases.json'),'utf8'));
const checks=JSON.parse(await fs.readFile(path.join(out,'verification.json'),'utf8'));
const data={cases:cases.map(({id,title,purpose,sources})=>({id,title,purpose,source:sources.finch})),checks,images:{},metrics:{}};
for(const [phase,dir]of [['before',baseline],['after',out]]){
 data.metrics[phase]=JSON.parse(await fs.readFile(path.join(dir,'metrics.json'),'utf8'));
 data.images[phase]={};
 for(const c of cases)for(const theme of ['finch-default','finch-business']){
  const id=c.id+'-'+theme;
  data.images[phase][id]='data:image/svg+xml;base64,'+(await fs.readFile(path.join(dir,'assets',id+'.svg'))).toString('base64');
 }
}
const html=`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Finch.js — 図の品質改善</title>
<style>
:root{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;color:#20324b;background:#f3f6fa;font-size:15px;line-height:1.7}*{box-sizing:border-box}body{margin:0}main{max-width:1440px;margin:auto;padding:36px 32px 56px}h1{font-size:30px;letter-spacing:.02em;margin:4px 0 8px}h2{font-size:18px;margin:0}p{margin:6px 0;color:#52657e}.eyebrow{font-size:12px;letter-spacing:.12em;color:#426393}a{color:#315aa3;text-underline-offset:3px}.intro{max-width:880px}.status{display:inline-block;font-size:12px;font-weight:700;color:#226445;background:#e7f3eb;border:1px solid #bcddc9;border-radius:20px;padding:4px 12px;margin-top:12px}.controls{margin:26px 0 18px;padding:18px 20px;background:#fff;border:1px solid #d9e1ec;border-radius:12px;display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap}label{display:grid;gap:5px;font-size:12px;font-weight:700}select,button{font:inherit;font-size:14px;background:#fff;color:#20324b;border:1px solid #bccadd;border-radius:6px;padding:8px 12px;min-height:40px;cursor:pointer}button:hover{background:#f3f6fa}button[aria-pressed=true]{color:#fff;background:#315aa3}button:focus-visible,select:focus-visible{outline:3px solid #8cb3ef;outline-offset:3px}.controls p{font-size:12px;margin-left:auto;max-width:250px}#purpose{margin-bottom:16px;font-size:14px}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:20px}.panel{min-width:0;background:#fff;border:1px solid #d9e1ec;border-radius:12px;overflow:hidden}.panel.after{border-top:3px solid #426eab}.panel header{padding:15px 20px;border-bottom:1px solid #e2e8f1;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:69px}.panel header p{font-size:12px;margin:0}.canvas{overflow:auto;padding:20px;display:flex;align-items:flex-start;justify-content:flex-start;min-height:200px}.canvas img{display:block;flex:none;margin:0 auto}.dimensions{font-size:12px;color:#64758c;white-space:nowrap}.findings{background:white;border:1px solid #d9e1ec;border-radius:12px;margin-top:22px;padding:22px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px;margin:12px 0}th,td{text-align:left;border-bottom:1px solid #e3e9f1;padding:10px 12px}thead th{color:#53667f;background:#f7f9fc}td:last-child{color:#216343;font-weight:700}.note{font-size:12px}details{margin-top:18px;border-top:1px solid #dce4ef;padding-top:14px}summary{cursor:pointer;font-weight:700}pre{overflow:auto;background:#f7f9fc;padding:18px;border-radius:8px;font-size:12px;line-height:1.6}ul{padding-left:22px;margin:12px 0}li{margin:5px 0}footer{font-size:12px;margin-top:24px;color:#667990}footer a{margin-right:18px}@media(max-width:700px){main{padding:22px 14px}h1{font-size:24px}.comparison{grid-template-columns:1fr}.controls{padding:14px;gap:12px}.controls label{width:100%}select{max-width:100%;width:100%}.controls p{margin:0;max-width:none}.panel header{padding:12px 14px}.canvas{padding:12px}.findings{padding:16px}th,td{padding:8px 6px;font-size:12px}}
</style></head><body><main>
<div class="eyebrow">FINCH.JS / QUALITY REVIEW / 2026.09.05</div>
<h1>図の品質改善を確認する</h1>
<p class="intro">前回比較の保存画像と、現在の実装による出力を同じ縮尺で比較します。入力文、テーマ、フォントは共通で、ノードの位置や改行は手で指定していません。</p>
<span class="status">全143テスト・型チェック・ビルド成功 / 3ケース × 2スタイルを実描画で確認</span>
<div class="controls">
 <label>比較する図<select id="case">${cases.map(c=>`<option value="${c.id}" ${c.id==='long-labels'?'selected':''}>${c.title}</option>`).join('')}</select></label>
 <label>スタイル<select id="theme"><option value="finch-business">Business</option><option value="finch-default">標準</option></select></label>
 <button type="button" id="size" aria-pressed="false">原寸で見る</button><p>左右を同じ倍率で表示。原寸表示では図の領域をスクロールできます。</p>
</div>
<p id="purpose"></p>
<section id="comparison" class="comparison" aria-label="改善前後の図">
 <article class="panel"><header><div><h2>改善前</h2><p>前回の品質比較時点</p></div><span class="dimensions" id="before-size"></span></header><div class="canvas"><img id="before-img" alt="改善前の図"></div></article>
 <article class="panel after"><header><div><h2>改善後</h2><p>現在の実装による自動描画</p></div><span class="dimensions" id="after-size"></span></header><div class="canvas"><img id="after-img" alt="改善後の図"></div></article>
</section>
<section class="findings"><h2>この図で確認した変化</h2><div class="table-wrap"><table><thead><tr><th>確認項目</th><th>改善前</th><th>改善後</th></tr></thead><tbody id="results"></tbody></table></div>
<p class="note">菱形は各行の実フォントによる外接矩形と輪郭を照合。枠と線は SVG の座標で測定しています。文字領域の照合は、文字の見た目そのものより厳しい判定です。</p>
<details><summary>この図の入力ソース</summary><pre id="source"></pre></details></section>
<section class="findings"><h2>実装した改善</h2><ul>
<li>部門枠を内容に合わせて広げた後、子要素ごと離して配置。入れ子の枠とピン留めにも対応。</li>
<li>条件分岐は出口を分け、別の条件の線と同じ区間を共有しにくい経路を選択。</li>
<li>戻り線と同じ側につながる線を輪郭の外へ出し、ノードの縁をなぞる経路を修正。</li>
<li>日本語の単語境界・数値と単位・閉じ括弧を考慮し、極端に短い末尾行を調整。</li>
</ul><p class="note">改善後には、作業開始時点で存在していた文字計測・図形寸法の改善も含みます。今回の修正と合わせ、長文を菱形の内側に収められることを確認しました。</p>
<p>部門枠の分離や長文の収容には面積を使います。図全体の小ささだけでなく、所属と分岐を読み違えずに追えることを優先しています。固定済みの枠同士の重なりは、固定位置を動かさずには解消できない場合があります。</p>
</section>
<footer><a href="../index.html">前回の競合比較</a><a href="verification.json">測定結果 JSON</a><a href="report.md">変更内容と再現手順</a></footer>
</main><script>
const data=${JSON.stringify(data).replaceAll('<','\u003c')};
const byId=id=>document.getElementById(id);
let natural=false;
function draw(){
 const c=data.cases.find(c=>c.id===byId('case').value), id=c.id+'-'+byId('theme').value;
 byId('purpose').textContent=c.purpose;byId('source').textContent=c.source;
 const before=data.checks.before[id],after=data.checks.after[id];
 const rows=[['部門枠の重なり',before.groupOverlaps.length+'組',after.groupOverlaps.length+'組'],['金額条件の分岐線の共有',before.sharedBranchPixels+' px',after.sharedBranchPixels+' px'],['ノードの縁をなぞる線',before.borderContacts.length+'件',after.borderContacts.length+'件'],['菱形の外へ出る文字領域',before.diamondOverflow.length+'行',after.diamondOverflow.length+'行']];
 byId('results').replaceChildren(...rows.map(row=>{const tr=document.createElement('tr');row.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});return tr}));
 const frames=[...document.querySelectorAll('.canvas')];
 const available=Math.min(...frames.map(el=>el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight)));
 const scale=natural?1:Math.min(1,available/Math.max(data.metrics.before[id].width,data.metrics.after[id].width));
 for(const phase of ['before','after']){
  const metric=data.metrics[phase][id],img=byId(phase+'-img');
  if(img.getAttribute('src')!==data.images[phase][id])img.src=data.images[phase][id];
  img.style.width=metric.width*scale+'px';img.style.height=metric.height*scale+'px';
  byId(phase+'-size').textContent=Math.round(metric.width)+' × '+Math.round(metric.height)+' px';
  img.alt=c.title+' / '+byId('theme').selectedOptions[0].text+' / '+(phase==='before'?'改善前':'改善後');
 }
}
byId('case').addEventListener('change',draw);byId('theme').addEventListener('change',draw);
byId('size').addEventListener('click',()=>{natural=!natural;byId('size').setAttribute('aria-pressed',String(natural));byId('size').textContent=natural?'全体を収める':'原寸で見る';draw()});
window.addEventListener('resize',draw);draw();
</script></body></html>`;
await fs.writeFile(path.join(out,'index.html'),html);
const hash=createHash('sha256').update(await fs.readFile(path.join(out,'assets','finch.global.js'))).digest('hex');
await fs.writeFile(path.join(out,'report.md'),`# Finch.js 図の品質改善（2026-09-05）

前回の3ケースを、同じソース・同じ2テーマで再描画。座標や改行の個別指定なし。

## 変更内容

- 縦方向 Graph のグループを子要素と一緒に離して配置。内側から外側へ枠を調整し、保存済み位置・ピン留めを尊重。
- flowchart / activity / graph の菱形から出る条件分岐を別の出口に割り当て、分岐線の共有を避ける経路を優先。明示ポート指定は維持。
- 端点の輪郭上をなぞる経路を回避。同じ側同士の接続は外向きに折り返す。再ルーティングでも図の方向を維持。
- 日本語の単語境界、数値・単位、禁則に配慮した折り返しと、末尾の短い行の調整。

既存の文字計測・図形寸法の改善を維持して検証。菱形の文字収容の変化には、この既存実装も含まれる。

## 検証

- npm run check: 全143テスト（うち今回の回帰テスト9件）、型チェック、ビルド成功。
- HTML DSL validator: 3ソース成功。
- ブラウザー実描画: 3ケース × 2スタイル。改善後は部門枠の重なり、金額分岐の共有区間、矩形ノードの縁に沿う線、菱形から出る文字領域がすべて0。
- 比較の基準と測定結果は verification.json。菱形は行ごとの getBBox の四隅と輪郭を比較（正規化距離の許容値 1.01）。視覚的な文字の画素そのものとは区別する。
- 固定したノードを含む枠同士が重なる場合は、固定を尊重するため自動解消できないことがある。

## 再描画手順

リポジトリルートから npm run check を実行後、dist/finch.global.js をこのディレクトリの assets/finch.global.js にコピーする。

\`\`\`powershell
node reports/diagram-quality-2026-09-05/render.mjs reports/diagram-quality-2026-09-05/improved
node reports/diagram-quality-2026-09-05/improved/verify-results.mjs
node reports/diagram-quality-2026-09-05/improved/build-review.mjs
node reports/diagram-quality-2026-09-05/improved/verify-review.mjs
\`\`\`

render.mjs は前回比較で使用したローカルの Mermaid と Playwright を参照。D2 の SVG は前回のものを再利用する。比較ページ自体は SVG を埋め込んであり、ネットワーク接続を必要としない。

ブラウザーバンドル SHA-256: ${hash}
`);
console.log('Built '+path.join(out,'index.html'));

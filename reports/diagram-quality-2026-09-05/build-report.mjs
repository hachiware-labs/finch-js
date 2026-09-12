import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));
const cases=JSON.parse(await fs.readFile(path.join(out,'cases.json'),'utf8'));
const metrics=JSON.parse(await fs.readFile(path.join(out,'metrics.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8'));
const geometry=JSON.parse(await fs.readFile(path.join(out,'finch-geometry.json'),'utf8'));
const variants={'finch-default':'Finch / 現行標準','finch-business':'Finch / Business 案','mermaid':'Mermaid / 標準','d2-dagre':'D2 / Dagre 標準','d2-elk':'D2 / ELK'};
const notes={
 approval:{'finch-default':'主経路が縦に揃い、短い文書図としてまとまる。ただし「10万円以上？」の「はい／いいえ」が同じ縦線を通ってから分かれ、条件と線の対応が曖昧。','finch-business':'影のない青灰色と大きめの文字で整った印象。分岐の曖昧さは残り、再申請の線が修正ノードの下辺・左辺に沿う。','mermaid':'条件ごとの線が分かれ、分岐先を追いやすい。菱形が大きく、主経路は左右に振れる。','d2-dagre':'分岐・合流が明快。横長の菱形と大きい間隔で、図は縦横に広がる。','d2-elk':'直角主体の経路で分岐を区別できる。条件から次の条件への軸は揃わず、縦の余白が大きい。'},
 departments:{'finch-default':'営業部と経理部、業務部と経理部の枠が重なる。「受注を登録」が経理部にも属するように見え、業務部の枠内に請求ノードの一部が入る。コンパクトさより所属の明確さを優先して直す必要がある。','finch-business':'文字・色の整理は効くが、枠の重なりは同じ。スタイル変更だけでは所属の誤読を解消できない。','mermaid':'3部門の枠が分離し、所属が明確。顧客との長い往復線と一部の枠見出し近くの接続は残るが、今回の初回出力では扱いやすい。','d2-dagre':'部門を明確に分離。部門名が大きく、見出し近くを接続線が通る。経理部の内部に大きい空白がある。','d2-elk':'部門境界は明確。部門が縦に積まれ、長い外周線が増えて高さ1,808pxに拡大する。'},
 'long-labels':{'finch-default':'ノード内の自動折り返しで横幅643pxに収まる。語の途中や「10／万円」のような改行、最後の1文字だけの行が残る。長い分岐ラベルの近くを戻り線が通る。','finch-business':'文字が読みやすくなる一方、菱形の斜辺に文章が重なる箇所が出る。字体・サイズ変更を含めて文字の実測と形状内の余白を検証したい。','mermaid':'ノードと接続ラベルを折り返し、長い日本語を収める。菱形とラベル領域が拡大して縦長になるが、条件と線の対応は維持。','d2-dagre':'今回のプレーンラベルは自動で折り返されず、横幅1,449px。1,000pxの文書幅では約69%に縮小され、文字が小さくなる。','d2-elk':'経路を変えてもラベルの横長化は残る。横幅1,347pxで、1,000px幅では約74%の縮小。'}
};
const scores=[['主経路の整列',4,4,3,3,3],['分岐・線と条件の対応',2,2,4,4,4],['部門の所属の明確さ',1,1,4,4,4],['長い日本語の収まり',4,2,4,2,2],['スタイルの整い方〈主観〉',3,4,3,3,3],['文書へ収めるコンパクトさ',4,4,3,2,2]];
const images={};for(const c of cases)for(const v of Object.keys(variants)){const id=c.id+'-'+v;images[id]='data:image/svg+xml;base64,'+(await fs.readFile(path.join(out,'assets',id+'.svg'))).toString('base64');}
const h=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
const gs=geometry['departments-finch-default'].nodes.filter(n=>n.shape==='container');
const groupOverlaps=gs.flatMap((a,i)=>gs.slice(i+1).filter(b=>overlap(a,b)).map(b=>[a.id,b.id]));
const findings={groupOverlaps,approvalSharedBranchSegment:{from:'amount',branches:['manager','finance'],verticalPixels:64},textViewportOverflowCount:Object.values(metrics).reduce((n,m)=>n+m.textOutsideViewport.length,0)};
await fs.writeFile(path.join(out,'findings.json'),JSON.stringify(findings,null,2));
const summary=`# 業務図の初回生成品質比較 — 2026-09-05

対象はエージェントを使い、業務の図を作成するユーザー。架空の同じ業務内容を Finch、Mermaid、D2 に記述し、手動位置・手動改行なしで出力した。3例 × 5バリエーション = 15図を Edge で描画し、全図を目視確認した。

## 結論

Finch は主経路の整列と長い日本語のコンパクトな表示が良い。一方、部門枠の重なりと条件分岐の共有経路が、意味の読み取りに影響する。Business 案は配色と影の整理が良いが、文字を大きくしたときの菱形内の収まりに課題がある。

今回の3例では Mermaid が境界と条件の読み取りで安定。D2 は部門を分離し分岐を明確にする一方、標準のプレーンラベルと間隔では長い日本語が横長になった。D2 の ELK は今回、文書へのコンパクトな収まりを改善しなかった。

## 評価（この3例に限定、5は大きな問題なし、3は要調整、1は誤読リスクが大きい）

| 軸 | Finch 標準 | Business 案 | Mermaid | D2 Dagre | D2 ELK |
| --- | --- | --- | --- | --- | --- |
${scores.map(r=>'| '+[r[0],...r.slice(1).map(n=>'★'.repeat(n)+'☆'.repeat(5-n))].join(' | ')+' |').join('\n')}

合計点は出さない。枠の重なりなどの誤読リスクを、配色・コンパクトさの高得点で相殺しないため。

## 優先して直したいこと

1. P0 部門の枠を重ねない。営業部×経理部、業務部×経理部の2組で重なりを確認。子ノード単位の配置だけでなくグループ境界を配置制約として扱う案を検討する。
2. P0 条件分岐の出口を区別する。経費精算の2本の条件経路が、菱形の下から64pxの区間を共有。条件ラベルを別々の線区間に対応付ける。
3. P1 フォント変更後も菱形に文字を収める。Business 案で長いラベルが斜辺に接する／重なる。矩形の文字領域だけでなく形状内の利用可能幅を考慮する。
4. P1 戻り線とラベルの間隔、ノード輪郭に沿う経路を改善する。Business の再申請線で輪郭との区別が弱い。
5. P2 日本語の改行位置と見た目の調整。語・数値単位を分断しにくい折り返しと、末尾1文字だけの行の回避を検討する。

## 条件と限界

- Finch: package 0.5.1 + 未コミットの作業ツリーを独立してバンドル。npm公開版そのものの評価ではない。取得時刻とハッシュは manifest.json。
- Business: examples/style-study.html のテーマ値と文字ウェイト・影のCSSを適用。元サンプル専用の強調色は適用していない。gap・文字サイズも変わるため、配色だけの比較ではない。
- Mermaid 11.17.2 標準テーマ・既定配置。D2 0.8.2 の Dagre 標準と ELK。D2 の外周余白だけ24pxへ揃え、それ以外の寸法・色・フォントは既定値。
- 全図のラベル・ノード・関係は共通。上から下への方向のみ指定。Finch graph、Mermaid subgraph、D2 container を自然な対応記法として使用。
- デフォルトのフォント・図形比率は異なる。寸法だけで品質・性能の優劣を決めない。評価は Windows / Edge での実表示に限定。
- SVGの外枠から出る文字は機械検査では0件。ただし枠内の重なり、菱形の斜辺との衝突、意味の誤読はこの検査だけでは検出できない。
- LLMの生成成功率、速度、手直し回数、全図法の網羅評価は行っていない。PlantUML / Graphviz / draw.io は今回未描画・未採点。
- 既存の本体コードとスタイル検討ファイルは変更していない。修正後の再比較に使うため、今回のバンドル・入力・SVG・PNGを保存した。

## 再現データ

- index.html: SVGを埋め込んだ単独で開ける比較ページ。左右のツールと図を変更可能。
- cases.json: ノード、接続、各記法の入力。
- metrics.json: SVG寸法と文字の描画範囲。
- finch-geometry.json: Finchの位置・経路。
- assets/: SVG、PNG、D2入力、固定したFinchバンドル。
- build-samples.mjs / render.mjs / build-report.mjs: この環境で使った生成スクリプト。ツールのパスはこの端末向け。

公式資料: [Mermaid](https://mermaid.js.org/syntax/flowchart.html)、[D2 positions](https://d2lang.com/tour/positions/)、[D2 v0.8.2](https://github.com/d2lang/d2/releases/tag/v0.8.2)。星と所見は今回の実図からの判断。
`;
await fs.writeFile(path.join(out,'report.md'),summary);
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finch 図の品質比較 — 2026-09-05</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#1c2b3b;font-family:Arial,"Yu Gothic",Meiryo,sans-serif}main{max-width:1480px;margin:auto;padding:36px 32px 80px}header{border-bottom:1px solid #ccd4df;padding-bottom:24px}.eyebrow{font-size:12px;letter-spacing:.12em;color:#65758a}h1{font-size:30px;line-height:1.4;margin:14px 0}h2{font-size:19px;margin:30px 0 14px}p{line-height:1.8;font-size:14px}.lead{max-width:940px}a{color:#2451af;text-underline-offset:3px}.tags{display:flex;gap:8px;flex-wrap:wrap}.tag{padding:6px 10px;font-size:12px;border:1px solid #ccd4df;border-radius:4px;background:white}.callouts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0}.callout{background:white;padding:18px 22px;border-left:3px solid #3c69a8}.callout.issue{border-color:#ba653b}.callout strong{font-size:15px}.callout p{margin:8px 0 0}.controls{position:sticky;top:0;background:#f5f6f8f5;padding:16px 0;z-index:2;border-bottom:1px solid #dbe1e8;display:flex;gap:18px;align-items:center;flex-wrap:wrap}label{font-size:13px}select,button{font:inherit;color:inherit;background:white;border:1px solid #bbc7d5;border-radius:5px;padding:9px 12px}select{margin-left:8px}button{cursor:pointer}button:hover{background:#eef3fc}:focus-visible{outline:3px solid #567fbe;outline-offset:3px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}.panel{min-width:0;background:white;border:1px solid #d4dce7;border-radius:7px;overflow:hidden}.panel-head{padding:18px 20px;border-bottom:1px solid #e2e7ee}.panel-head h3{margin:0;font-size:17px}.meta{font-size:12px;color:#617086;margin:8px 0 0}.note{min-height:92px;padding:14px 20px;margin:0;background:#f9fafc;font-size:13px}.canvas{padding:24px;overflow:auto;text-align:center}.canvas img{display:block;margin:auto;max-width:100%;height:auto}.natural .canvas img{max-width:none}.source{padding:0 20px 18px;font-size:12px}summary{cursor:pointer;padding:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f2f5f9;padding:16px;line-height:1.65}table{border-collapse:collapse;background:white;width:100%;font-size:13px}th,td{padding:12px;border:1px solid #dbe1e8;text-align:left}td:not(:first-child){white-space:nowrap;color:#315886}th{background:#eaf0f7}.table-wrap{overflow:auto}.method{padding:18px 22px;background:white;border:1px solid #d4dce7;margin-top:28px}.method li{font-size:13px;line-height:1.9;margin-bottom:6px}.muted{color:#627287;font-size:12px}footer{margin-top:24px;font-size:12px;color:#627287}.case-description{margin:16px 0}.download{font-size:12px;display:inline-block;margin-top:10px}@media(max-width:800px){main{padding:24px 16px}.grid,.callouts{grid-template-columns:1fr}.controls{position:static}.note{min-height:0}h1{font-size:25px}}
</style></head><body><main>
<header><div class="eyebrow">DIAGRAM QUALITY REVIEW · 2026.09.05</div><h1>綺麗に生成できるか。<br>同じ業務図で、今の品質を見る。</h1><p class="lead">Finch は主経路の整列とコンパクトさが良好。一方、部門の所属と条件分岐の読み取りには改善が必要です。架空の日本語業務図3例を、手動配置・手動改行なしで比較しました。</p><div class="tags"><span class="tag">3例 / 15出力を目視確認</span><span class="tag">Finch 作業ツリーの固定版</span><span class="tag">Mermaid 11.17.2</span><span class="tag">D2 0.8.2 / Dagre・ELK</span></div></header>
<div class="callouts"><div class="callout"><strong>良い点：文書へ収めやすい</strong><p>Finch は主経路が縦に揃い、日本語を自動で折り返します。Business 案の影を抑えたスタイルも、業務文書に馴染みます。</p></div><div class="callout issue"><strong>先に直す点：所属と分岐の明確さ</strong><p>部門枠が重なる例、条件の違う線が同じ経路を通る例があります。見た目の整い方とは分けて評価します。</p></div></div>
<h2>実図を左右で比較</h2><div class="controls"><label>業務図<select id="case">${cases.map(c=>`<option value="${c.id}">${c.title}</option>`).join('')}</select></label><label>左<select id="left">${Object.entries(variants).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label><label>右<select id="right">${Object.entries(variants).map(([v,n])=>`<option value="${v}" ${v==='mermaid'?'selected':''}>${n}</option>`).join('')}</select></label><button id="mode" aria-pressed="false">原寸で見る</button></div><p class="case-description" id="purpose"></p><div class="grid" id="comparison">${['left','right'].map(side=>`<article class="panel"><div class="panel-head"><h3 id="${side}-title"></h3><p class="meta" id="${side}-meta"></p></div><p class="note" id="${side}-note"></p><div class="canvas"><img id="${side}-img" alt=""></div><div class="source"><a class="download" id="${side}-download" download>SVGを保存</a><details><summary>入力ソースを見る</summary><pre id="${side}-source"></pre></details></div></article>`).join('')}</div>
<h2>今回の3例からの評価</h2><p class="muted">5＝大きな問題なし、3＝要調整、1＝誤読リスクが大きい。スタイルは主観。合計点は出さず、意味の誤読を装飾や省スペースの得点で相殺しません。</p><div class="table-wrap"><table><thead><tr><th>評価軸</th>${Object.values(variants).map(v=>`<th>${v}</th>`).join('')}</tr></thead><tbody>${scores.map(r=>`<tr><th>${r[0]}</th>${r.slice(1).map(n=>`<td aria-label="5段階中${n}">${'★'.repeat(n)+'☆'.repeat(5-n)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
<h2>Finch の改善優先度</h2><div class="table-wrap"><table><tr><th>優先度</th><th>今回確認した課題</th><th>改善後に確認すること</th></tr><tr><td>P0</td><td>部門の枠が2組で重なる</td><td>無関係な部門枠が重ならず、他部門のノードを含まない</td></tr><tr><td>P0</td><td>条件の異なる2本の線が64pxの区間を共有</td><td>分岐の出口と条件ラベルが一対一で追える</td></tr><tr><td>P1</td><td>Business 案の長文が菱形の斜辺に重なる</td><td>フォント・太さ・サイズを変えても形状内に余白が残る</td></tr><tr><td>P1</td><td>戻り線がラベルやノード輪郭に近い</td><td>線・輪郭・文字を見分ける間隔が残る</td></tr><tr><td>P2</td><td>日本語の語中改行・末尾1文字の行</td><td>語と数値単位を分断しにくい折り返しになる</td></tr></table></div>
<details class="method"><summary>比較条件・数値・限界</summary><ul><li>同じノード・接続・ラベルを自然な各記法へ変換。上から下の方向のみ指定。手動座標・手動改行・グループ別の位置調整はなし。</li><li>Finch は作業ツリーを別バンドルに固定。Business は style-study.html のテーマと文字ウェイト・影のCSSを使用し、サンプル専用の強調は除外。公開版や将来の完成版の評価ではありません。</li><li>各製品の既定のフォント・配色・図形比率で評価。D2 外周余白のみ24pxに統一。Business は余白と文字サイズも変わります。</li><li>標準表示は各パネル幅へ縮小し、拡大はしません。原寸表示では横スクロールできます。SVG内部の文字切れと、表示幅に合わせた縮小を区別してください。</li><li>機械検査ではSVGの外枠から出る文字は15図で0件。ただし、菱形の斜辺との衝突や枠の重なりはこの検査に含みません。</li><li>LLMの生成成功率・速度・修正回数は未測定。3例の観察であり、全図法や全テーマに一般化しません。PlantUML / Graphviz / draw.io は今回は未採点。</li></ul><div class="table-wrap"><table><tr><th>図</th>${Object.values(variants).map(v=>`<th>${v}</th>`).join('')}</tr>${cases.map(c=>`<tr><th>${c.title}</th>${Object.keys(variants).map(v=>{const m=metrics[c.id+'-'+v];return`<td>${Math.round(m.width)} × ${Math.round(m.height)}</td>`;}).join('')}</tr>`).join('')}</table></div><p class="muted">単位：SVG内部のpx。フォントサイズが異なるため、面積だけで品質を比較しません。取得：${h(manifest.capturedAt)}<br>Finch SHA-256：${manifest.finchBundleSha256}</p><p>公式仕様：<a href="https://mermaid.js.org/syntax/flowchart.html">Mermaid</a> · <a href="https://d2lang.com/tour/positions/">D2 配置</a> · <a href="https://github.com/d2lang/d2/releases/tag/v0.8.2">D2 リリース</a></p></details>
<footer>このHTMLは比較用SVGと入力ソースを内包しており、単独で開けます。採点は今回の実図からの判断です。</footer>
</main><script>
const cases=${JSON.stringify(cases)}, variants=${JSON.stringify(variants)}, metrics=${JSON.stringify(metrics)}, notes=${JSON.stringify(notes)}, images=${JSON.stringify(images)};
let natural=false;
function render(){const c=cases.find(c=>c.id===document.getElementById('case').value);document.getElementById('purpose').textContent=c.purpose+'（'+c.nodes.length+'ノード / '+c.edges.length+'接続）';for(const side of ['left','right']){const v=document.getElementById(side).value,id=c.id+'-'+v,m=metrics[id];document.getElementById(side+'-title').textContent=variants[v];document.getElementById(side+'-meta').textContent=Math.round(m.width)+' × '+Math.round(m.height)+' px / 手動調整なし';document.getElementById(side+'-note').textContent=notes[c.id][v];const img=document.getElementById(side+'-img');img.src=images[id];img.alt=c.title+' — '+variants[v];img.style.width=m.width+'px';const a=document.getElementById(side+'-download');a.href=images[id];a.download=id+'.svg';document.getElementById(side+'-source').textContent=c.sources[v.startsWith('finch')?'finch':v.startsWith('d2')?'d2':'mermaid'];}}
for(const id of ['case','left','right'])document.getElementById(id).addEventListener('change',render);
document.getElementById('mode').addEventListener('click',e=>{natural=!natural;document.getElementById('comparison').classList.toggle('natural',natural);e.target.textContent=natural?'幅に合わせる':'原寸で見る';e.target.setAttribute('aria-pressed',String(natural));});render();
</script></body></html>`;
await fs.writeFile(path.join(out,'index.html'),html);
console.log(JSON.stringify({groupOverlaps,report:path.join(out,'index.html')}));

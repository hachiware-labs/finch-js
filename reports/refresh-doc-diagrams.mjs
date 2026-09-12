import{readFile,writeFile}from'node:fs/promises';
const p='examples/readme-hero.html';let s=await readFile(p,'utf8');const source=ja=>`@deployment
container requests "${ja?'01 / 注文を受け付ける':'01 / RECEIVE ORDERS'}" [tone=cyan layout=column] {
 node web "${ja?'Webアプリ':'Web App'}" [icon=app-window]
 node gateway "API Gateway" [icon=aws:network/api-gateway]
 node api "${ja?'注文API':'Order API'}" [icon=server]
}
container events "${ja?'02 / イベントを処理する':'02 / PROCESS EVENTS'}" [tone=amber layout=column] {
 node bus "EventBridge" [icon=aws:eventbridge]
 node queue "Amazon SQS" [icon=aws:simple-queue-service-sqs]
 node worker "${ja?'通知Worker':'Notification Worker'}" [icon=aws:lambda]
}
container data "${ja?'03 / 結果を届ける':'03 / STORE AND DELIVER'}" [tone=violet layout=column] {
 database db "PostgreSQL" [icon=simple:postgresql]
 node mail "${ja?'メール配信':'Email delivery'}" [icon=mail]
}
web -> gateway: HTTPS
gateway -> api: ${ja?'注文':'Order'}
api -> db: ${ja?'保存':'Save'}
api -> bus: ${ja?'注文確定イベント':'Order confirmed'}
bus -> queue: ${ja?'配信':'Publish'}
queue -> worker: ${ja?'購読':'Consume'}
worker -> mail: ${ja?'通知':'Notify'}`;
s=s.replace(/const architectureSource = `[\s\S]*?`\.trim\(\);/,'const architectureSource = `\n'+source(false)+'\n`.trim();').replace(/const japaneseArchitectureSource = `[\s\S]*?`\.trim\(\);/,'const japaneseArchitectureSource = `\n'+source(true)+'\n`.trim();');s=s.replace('EVENT-DRIVEN COMMERCE PLATFORM','ORDER → EVENT → NOTIFICATION').replace("fontSize:17","fontSize:15");s=s.replace("const japanese=new URLSearchParams", "const japanese=new URLSearchParams");s=s.replace("const heroTheme=", "document.querySelector('.bar span').textContent=japanese?'注文受付 → イベント処理 → 結果の保存・通知':'ORDER → EVENT → STORE / NOTIFY';\nconst heroTheme=");await writeFile(p,s);
for(const [lang,md]of [['ja','docs/tutorial_ja.md'],['en','docs/tutorial.md']]){let text=await readFile(md,'utf8');const m=text.match(/const orderFlowSource = `([\s\S]*?)`/);if(!m)throw Error(md);const title=lang==='ja'?'注文の正常経路と在庫切れ':'Order flow and out-of-stock branch';const html=`<!doctype html><html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{font:16px system-ui;margin:32px;color:#21334a}#diagram{width:max-content;min-width:500px;padding:24px;border:1px solid #dbe4ec}svg{display:block;max-width:none!important}</style><h1>${title}</h1><p>${lang==='ja'?'正常経路を軸に、在庫切れの分岐を分離。図の左下から編集できます。':'Keep the normal path aligned and the out-of-stock branch separate. Open the editor from the lower-left icon.'}</p><div id="diagram"></div><script src="../dist/finch.global.js"></script><script>const orderFlowSource=\`${m[1]}\`;const diagram=Finch.render(orderFlowSource,{target:'#diagram'});diagram.svg.style.width=diagram.geometry.width+'px';diagram.svg.style.height=diagram.geometry.height+'px';</script></html>`;await writeFile(`examples/tutorial-order-${lang}.html`,html);const marker=lang==='ja'?'## 2. ドラッグして固定する':'## 2.';const index=text.indexOf(marker);if(index<0)throw Error('section '+md);const addition=lang==='ja'?`[![正常経路と在庫切れを分けた注文処理](./assets/tutorial-order-ja.png)](../examples/tutorial-order-ja.html)

上の画像と編集用ページは現在のリポジトリビルドで描画しています。固定CDN版とは配置や編集UIが異なる場合があります。正常経路と例外の関係が読めれば、対称性や交差ゼロを目指して整え続ける必要はありません。

`:`[![Order flow with a separate out-of-stock branch](./assets/tutorial-order-en.png)](../examples/tutorial-order-en.html)

The image and editable page use the current repository build; layout and editor UI may differ from the pinned CDN version. Stop when the normal path and its exception are easy to follow. Symmetry and zero crossings are not requirements.

`;text=text.slice(0,index)+addition+text.slice(index);await writeFile(md,text);}
const skill='.agents/skills/finch/SKILL.md';s=await readFile(skill,'utf8');s=s.replace('## Layout intent','## Layout intent\n\n- Start with the question the diagram should answer. Form meaningful groups, then consider the internal orders of adjacent groups together using a few shared operation/relationship perspectives. Do not enumerate all permutations or silently change the underlying architecture to make a prettier picture.\n- Render ordinary automatic layout first. For a remaining hard spot, compare a few perspective-based arrangements together with stagger, endpoint sides, and routing space. Respect explicit order, direction, ports, and saved positions. Semantic layout hints belong in DSL; exact coordinates belong in overlays.\n- Treat whitespace as room for connections, labels, and boundaries. Penalize avoidable ambiguity or backtracking rather than area or crossing count alone. A clear crossing can be preferable to a large detour.\n- Separate inherent model complexity from avoidable rendering defects. Stop once relationships are sufficiently traceable; a dense design can produce an acceptable diagram without becoming visually simple. Do not continue optimizing a user-accepted example just to remove every crossing.\n- For README/tutorial images, use the same source as the editable linked HTML, regenerate localized assets together, and inspect at the documentation display size. State source layout hints and current-build versus pinned-release differences. Do not imply that experimental hard-case search applies to every diagram type.\n');await writeFile(skill,s);

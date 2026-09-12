// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {createFinch} from '../src/index';
const source = "@flowchart\nstart s \"審査開始\"\nprocess a \"法人顧客の申請内容と添付書類を照合する\"\ndecision c \"本人確認と利用条件の審査をすべて通過したか?\"\nprocess b \"不足している証明書類の追加提出を依頼する\"\nprocess d \"利用開始の案内と初回設定の手順を通知する\"\nend e \"審査完了\"\ns -> a\na -> c\nc -> d: すべての審査項目を通過\nc -> b: 証明書類に不足がある\nb -> a: 追加書類を受領して再審査\nd -> e";
it('places retry between its return target and decision while preserving the normal axis',()=>{
 const i=createFinch().render(source,{editor:false});
 const n=(id:string)=>i.geometry.nodes.find(n=>n.id===id)!;
 expect(n('b').y).toBeGreaterThan(n('a').y);
 expect(n('b').y).toBeLessThan(n('c').y+n('c').height/2);
 expect(n('b').x+n('b').width).toBeLessThan(n('c').x);
 const centers=['s','a','c','d','e'].map(id=>n(id).x+n(id).width/2);
 expect(new Set(centers).size).toBe(1);
 const before=i.geometry.nodes.map(({id,x,y})=>({id,x,y}));
 i.autoLayout();expect(i.geometry.nodes.map(({id,x,y})=>({id,x,y}))).toEqual(before);
 expect(i.geometry.edges).toHaveLength(6);i.destroy();
});
it('preserves saved retry positions through source updates',()=>{
 const i=createFinch().render(source,{editor:false,overlay:{version:1,nodes:{b:{x:30,y:800,manual:true,pinned:true}}}});
 i.update(source);expect(i.geometry.nodes.find(n=>n.id==='b')).toMatchObject({x:30,y:800});i.destroy();
});

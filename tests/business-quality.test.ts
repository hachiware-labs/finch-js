// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createFinch } from "../src/index";
import { rerouteGeometry } from "../src/layouts";
import { labelLayout } from "../src/text-layout";
import { defaultTheme } from "../src/theme";
import type { Bounds, Geometry, Point } from "../src/types";

const departments = `@graph
customer "顧客"
group sales "営業部" {
  inquiry "依頼内容を確認"
  quote "見積を作成"
}
group ops "業務部" {
  order "受注を登録"
  arrange "出荷を手配"
  stock "在庫管理" [shape=database]
}
group accounting "経理部" {
  invoice "請求書を発行"
  paid "入金を確認"
}
customer -> inquiry: 依頼
inquiry -> quote
quote -> order: 受注確定
order -> arrange
arrange -> stock: 在庫引当
order -> invoice: 請求依頼
invoice -> customer: 請求書
customer -> paid: 支払い
paid -> order: 入金状況`;
const approval = `@flowchart
start submit "申請を提出"
process check "申請内容を確認"
decision valid "必要な情報は揃っている？"
process fix "申請内容を修正"
decision amount "10万円以上？"
process manager "部門長が承認"
process finance "経理が確認"
process pay "振込を手配"
end done "申請者へ完了を通知"
submit -> check
check -> valid
valid -> fix: 不備あり
fix -> check: 再申請
valid -> amount: 不備なし
amount -> manager: はい
amount -> finance: いいえ
manager -> finance: 承認
finance -> pay
pay -> done`;
const overlap = (a: Bounds, b: Bounds) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
function sharedLength(a: Point[], b: Point[]) {
  let total = 0;
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++) {
    const p = a[i - 1]!, q = a[i]!, r = b[j - 1]!, s = b[j]!;
    if (p.x === q.x && r.x === s.x && p.x === r.x) total += Math.max(0, Math.min(Math.max(p.y,q.y), Math.max(r.y,s.y)) - Math.max(Math.min(p.y,q.y), Math.min(r.y,s.y)));
    if (p.y === q.y && r.y === s.y && p.y === r.y) total += Math.max(0, Math.min(Math.max(p.x,q.x), Math.max(r.x,s.x)) - Math.max(Math.min(p.x,q.x), Math.min(r.x,s.x)));
  }
  return total;
}

describe("business diagram readability", () => {
  beforeEach(() => { document.body.innerHTML = '<main id="diagram"></main>'; });
  for (const prefix of ["", 'group company "会社" {\n']) {
    it(`separates department frames and keeps every child inside its owner (${prefix ? "nested" : "root"})`, () => {
      const source = prefix ? '@graph\n' + prefix + departments.slice('@graph\n'.length) + '\n}' : departments;
      const instance = createFinch().render(source, { target: '#diagram', editor: false });
      const verify = () => {
        const nodes = instance.geometry.nodes;
        for (const a of nodes) for (const b of nodes) if (a.id !== b.id && a.parentId === b.parentId) expect(overlap(a,b)).toBe(false);
        for (const child of nodes.filter(n=>n.parentId)) {
          const parent = nodes.find(n=>n.id===child.parentId)!;
          expect(child.x).toBeGreaterThanOrEqual(parent.x);
          expect(child.y).toBeGreaterThanOrEqual(parent.y + (parent.headerHeight ?? 42));
          expect(child.x+child.width).toBeLessThanOrEqual(parent.x+parent.width);
          expect(child.y+child.height).toBeLessThanOrEqual(parent.y+parent.height);
        }
      };
      verify();
      const before = instance.geometry.nodes.map(({id,x,y})=>({id,x,y}));
      instance.autoLayout();verify();
      expect(instance.geometry.nodes.map(({id,x,y})=>({id,x,y}))).toEqual(before);
      instance.update(source.replace('"受注を登録"','"受注内容と納期を確認して登録する"'));verify();
    });
  }
  it("does not move a pinned child while separating its group from other groups", () => {
    const instance = createFinch().render(departments,{editor:false,overlay:{version:1,nodes:{order:{x:400,y:400,manual:true,pinned:true}}}});
    instance.autoLayout();
    expect(instance.geometry.nodes.find(n=>n.id==='order')).toMatchObject({x:400,y:400});
    const groups=instance.geometry.nodes.filter(n=>n.shape==='container');
    for(const a of groups)for(const b of groups)if(a.id!==b.id)expect(overlap(a,b)).toBe(false);
  });
  it("preserves both pinned children when their frames overlap and draws children above frames", () => {
    const source = '@graph\ngroup sales "営業部" {\n a "注文を確認"\n}\ngroup ops "業務部" {\n b "出荷を手配"\n}';
    const instance = createFinch().render(source, {
      target: '#diagram', editor: false,
      overlay: { version: 1, nodes: {
        a: { x: 100, y: 100, manual: true, pinned: true },
        b: { x: 180, y: 150, manual: true, pinned: true },
      } },
    });
    const verify = () => {
      expect(instance.geometry.nodes.find(n => n.id === 'a')).toMatchObject({ x: 100, y: 100 });
      expect(instance.geometry.nodes.find(n => n.id === 'b')).toMatchObject({ x: 180, y: 150 });
      const frames = instance.geometry.nodes.filter(n => n.shape === 'container');
      expect(overlap(frames[0]!, frames[1]!)).toBe(true);
      const layers = [...instance.svg.children];
      expect(layers.indexOf(instance.svg.querySelector('.finch-nodes')!)).toBeGreaterThan(layers.indexOf(instance.svg.querySelector('.finch-containers')!));
      expect(instance.svg.querySelector('.finch-nodes [data-node-id="a"]')?.textContent).toBe('注文を確認');
      expect(instance.svg.querySelector('.finch-nodes [data-node-id="b"]')?.textContent).toBe('出荷を手配');
      const headings = instance.svg.querySelector('.finch-container-headings')!;
      expect(headings).not.toBeNull();
      expect(layers.indexOf(headings)).toBeGreaterThan(layers.indexOf(instance.svg.querySelector('.finch-nodes')!));
      const heading = headings.querySelector('[data-node-id="ops"]')!;
      const ops = frames.find(n => n.id === 'ops')!;
      const a = instance.geometry.nodes.find(n => n.id === 'a')!;
      expect(overlap(a, { x: ops.x + 16, y: ops.y + 10, width: 39, height: 18 })).toBe(true);
      expect(heading.textContent).toBe('業務部');
      const headingX = Number(heading.getAttribute('transform')!.match(/translate\(([^ ]+)/)![1]);
      const headingWidth = labelLayout('業務部', 216, 13).width;
      expect(headingX + 16).toBeGreaterThanOrEqual(a.x + a.width + 4);
      expect(headingX + 16 + headingWidth).toBeLessThanOrEqual(ops.x + ops.width - 16);
      expect(instance.svg.querySelectorAll('[data-node-id="ops"] text')).toHaveLength(1);
    };
    verify();
    instance.autoLayout(); verify();
    instance.update(source); verify();
    instance.setTheme('midnight'); verify();
    const restored = createFinch().render(source, { editor: false, overlay: instance.exportLayout() });
    expect(restored.svg.querySelector('.finch-container-headings [data-node-id="ops"]')?.textContent).toBe('業務部');
    expect(instance.toSvgString()).toContain('finch-container-headings');
    expect(restored.geometry.nodes.filter(n => n.parentId).map(({id,x,y}) => ({id,x,y})))
      .toEqual(instance.geometry.nodes.filter(n => n.parentId).map(({id,x,y}) => ({id,x,y})));
    instance.unpin(['a', 'b']).autoLayout();
    const frames = instance.geometry.nodes.filter(n => n.shape === 'container');
    expect(overlap(frames[0]!, frames[1]!)).toBe(false);
  });
  it.each(['業務部', '業務部\\n出荷担当'])("keeps a heading in front when no horizontal space is available (%s)", (label) => {
    const instance = createFinch().render(`@graph\ngroup sales "営業部" {\n a "注文を確認"\n}\ngroup ops "${label}" {\n b "出荷を手配"\n}`, {
      target: '#diagram', editor: false,
      overlay: { version: 1, nodes: {
        a: { x: 100, y: 60, width: 500, height: 200, manual: true, pinned: true },
        b: { x: 180, y: 150, manual: true, pinned: true },
      } },
    });
    const ops = instance.geometry.nodes.find(n => n.id === 'ops')!;
    const heading = instance.svg.querySelector('.finch-container-headings [data-node-id="ops"]')!;
    expect(heading.getAttribute('transform')).toBe(`translate(${ops.x} ${ops.y})`);
    expect(heading.textContent).toBe(label.replace('\\n', ''));
    if (label.includes('\\n')) expect(heading.querySelectorAll('tspan')).toHaveLength(2);
    expect(instance.svg.lastElementChild).toBe(heading.parentElement);
    expect(instance.svg.querySelector('style')?.textContent).toContain(`stroke: ${defaultTheme.canvasColor}; stroke-width: 5px`);
    const svg = instance.svg;
    Object.defineProperty(svg, 'createSVGPoint', { value: () => ({ x: 0, y: 0 }) });
    Object.defineProperty(svg, 'getScreenCTM', { value: () => null });
    Object.defineProperty(svg, 'setPointerCapture', { value: () => undefined });
    heading.querySelector('text')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(instance.selection).toEqual(['ops']);
    expect(instance.geometry.nodes.find(n => n.id === 'a')).toMatchObject({ x: 100, y: 60 });
    expect(instance.geometry.nodes.find(n => n.id === 'b')).toMatchObject({ x: 180, y: 150 });
  });
  for (const kind of ['flowchart','activity']) it(`keeps condition paths distinct before and after rerouting (${kind})`, () => {
    const source=kind==='activity'?approval.replace('@flowchart','@activity').replace(/process /g,'action '):approval;
    const instance=createFinch().render(source,{editor:false});
    const verify=()=>{
      const alternatives=instance.geometry.edges.filter(e=>e.from==='amount');
      expect(alternatives[0]!.points[0]).not.toEqual(alternatives[1]!.points[0]);
      expect(sharedLength(alternatives[0]!.points,alternatives[1]!.points)).toBe(0);
    };
    verify();rerouteGeometry(instance.geometry);verify();
  });
  it("honours an explicitly selected decision exit", () => {
    const instance=createFinch().render(approval.replace('amount -> finance: いいえ','amount -> finance: いいえ [fromPort=left toPort=right]'),{editor:false});
    const node=instance.geometry.nodes.find(n=>n.id==='amount')!;
    expect(instance.geometry.edges.find(e=>e.from==='amount'&&e.to==='finance')!.points[0]).toEqual({x:node.x,y:node.y+node.height/2});
  });
  it("routes an equal-width decision bypass outside the intervening node", () => {
    const geometry: Geometry = {
      kind: "flowchart", direction: "down", width: 400, height: 600, groups: [],
      nodes: [
        { id: "amount", label: "10万円以上？", shape: "diamond", attributes: {}, x: 100, y: 0, width: 240, height: 138 },
        { id: "manager", label: "部門長が承認", shape: "rectangle", attributes: {}, x: 100, y: 220, width: 240, height: 58 },
        { id: "finance", label: "経理が確認", shape: "rectangle", attributes: {}, x: 100, y: 380, width: 240, height: 58 },
      ],
      edges: [
        { id: "yes", from: "amount", to: "manager", label: "はい", dashed: false, order: 0, points: [] },
        { id: "no", from: "amount", to: "finance", label: "いいえ", dashed: false, order: 1, points: [] },
      ],
    };
    rerouteGeometry(geometry);
    const route = geometry.edges.find(edge => edge.id === "no")!.points;
    expect(route[0]).toEqual({ x: 340, y: 69 });
    expect(route[1]!.x).toBeGreaterThan(340);
    expect(route[route.length - 2]!.x).toBeGreaterThan(340);
    expect(sharedLength(route, [{ x: 340, y: 220 }, { x: 340, y: 278 }])).toBe(0);
  });
  it("does not trace the return node's border", () => {
    const instance=createFinch().render(approval,{editor:false,theme:{...defaultTheme,fontSize:15,nodePaddingX:24,nodePaddingY:15,gapX:96,gapY:44}});
    const node=instance.geometry.nodes.find(n=>n.id==='fix')!;
    const edge=instance.geometry.edges.find(e=>e.from==='fix')!;
    const border=[{x:node.x,y:node.y},{x:node.x+node.width,y:node.y},{x:node.x+node.width,y:node.y+node.height},{x:node.x,y:node.y+node.height},{x:node.x,y:node.y}];
    expect(sharedLength(edge.points,border)).toBe(0);
  });
  it("keeps Japanese numeric units and closing punctuation together", () => {
    for(const width of [70,85,100,120]) {
      const value='今回の申請金額は税込みで10万円以上？';
      const lines=labelLayout(value,width,13).lines;
      expect(lines.join('')).toBe(value);
      expect(lines.some(line=>line.includes('10万円'))).toBe(true);
      expect(lines.every(line=>!line.startsWith('？'))).toBe(true);
    }
    const lines=labelLayout('振込予定日と処理結果を申請者へ通知',216,13).lines;
    expect(lines.every(line=>[...line].length>1)).toBe(true);
  });
});

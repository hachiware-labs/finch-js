// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createFinch, prismTheme, defaultTheme, midnightTheme } from "../src/index";

describe("node icon and tone attributes", () => {
  it("shares icons and custom images across card, queue and file shapes", () => {
    const source='@deployment\npackage parent [tone=green] {\ncard Card "Review document" [icon=server]\nqueue Queue "Pending messages" [icon=mail]\nfile File "Settings" [image="./settings.png" imageShape=rounded]\n}';
    const instance=createFinch().render(source,{editor:false});
    for(const theme of ['default','midnight','prism']){
      if(theme!=='default')instance.setTheme(theme);
      expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(3);
      const icons=[...instance.svg.querySelectorAll('.finch-node-icon')];
      expect(new Set(icons.map(icon=>icon.getAttribute('stroke'))).size).toBe(1);
      expect(instance.svg.querySelector('.finch-shape-uml-file image')!.getAttribute('href')).toContain('settings.png');
      expect(instance.svg.querySelector('.finch-shape-uml-file clipPath rect')!.getAttribute('rx')).toBe('5');
      for(const kind of ['card','queue'])expect(instance.svg.querySelector(`.finch-shape-${kind} > text`)!.getAttribute('transform')).toBe('translate(16 0)');
    }
    instance.autoLayout();
    expect(instance.toSvgString()).toContain('finch-node-icon');
    instance.destroy();
  });
  it("supports an independent theme with no palette and a partial palette override", () => {
    const { tones: _tones, ...base } = defaultTheme;
    const finch = createFinch();
    finch.registerTheme('independent', { ...base, name: 'independent', nodeFill: '#fafafa' });
    const source = `@deployment
container parent "Parent" [tone=green] {
 container nested "Nested" {
  node inherited "Inherited" [icon=server]
  node override "Override" [tone=coral icon=shield-check]
  container reset "Reset" [tone=none] {
   node plain "Plain" [icon=mail]
  }
 }
}`;
    const draw = (theme: string | typeof defaultTheme) => finch.render(source, { theme, editor: false });
    const instance = draw('independent');
    const stroke = (id: string) => instance.svg.querySelector(`.finch-node[data-node-id="${id}"] > path`)!.getAttribute('stroke');
    expect(stroke('inherited')).not.toBe(stroke('override'));
    expect(stroke('plain')).toBe(base.nodeStroke);
    expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(3);
    const partial = draw({ ...base, tones: { green: { fill: '#eeeeee', stroke: '#123456' } } });
    expect(partial.svg.querySelector('.finch-node[data-node-id="inherited"] > path')!.getAttribute('stroke')).toBe('#123456');
    expect(partial.svg.querySelector('.finch-node[data-node-id="override"] > path')!.getAttribute('stroke')).toBe(stroke('override'));
    instance.autoLayout();
    expect(instance.toSvgString()).toContain('finch-node-icon');
  });
  it.each([defaultTheme, midnightTheme, prismTheme])("shares icon definitions and inheritance in $name", theme => {
    const finch = createFinch();
    finch.registerIcon("custom", [{ tag: "circle", attributes: { cx: "12", cy: "12", r: "5" } }]);
    const instance = finch.render(`@deployment
container parent "Parent" [tone=green icon=server] {
 node child "Child" [icon=custom]
 node plain "Plain"
}`, { theme, editor: false });
    expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(1);
    expect(instance.svg.querySelector('.finch-node-icon circle')?.getAttribute('r')).toBe('5');
    expect(instance.svg.querySelector('.finch-node-icon')?.getAttribute('stroke')).toBe(theme.tones!.green!.stroke);
    expect(instance.model.nodes.find(n => n.id === 'plain')!.attributes.icon).toBeUndefined();
  });
  const source = `@deployment
container outer "Outer" [tone=cyan] {
 container inner "Inner" {
  node inherited "Inherited" [icon=server]
  node overridden "Override" [tone=coral icon=shield-check]
  node reset "Reset" [tone=none]
 }
}
inherited -> overridden`;
  it("inherits through nested containers and respects overrides and reset", () => {
    const instance = createFinch().render(source, { theme: "prism", editor: false });
    const stroke = (id: string) => instance.svg.querySelector(`[data-node-id="${id}"].finch-node > path`)?.getAttribute("stroke");
    expect(stroke("inherited")).toBe(prismTheme.tones!.cyan!.stroke);
    expect(stroke("overridden")).toBe(prismTheme.tones!.coral!.stroke);
    expect(stroke("reset")).toBe(prismTheme.nodeStroke);
    expect(instance.model.nodes.find(n => n.id === "inherited")!.attributes.tone).toBeUndefined();
    expect(instance.toSvgString()).toContain('class="finch-node-icon"');
    instance.autoLayout();
    expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(2);
  });
  it("reserves width before layout and safely falls back for unknown icons", () => {
    const finch = createFinch();
    const width = (icon: string) => finch.render(`@deployment\nnode api "API" [icon=${icon}]`, { editor: false }).geometry.nodes[0]!.width;
    expect(width("server")).toBe(width("unknown") + 32);
    const instance = finch.render('@deployment\nartifact jwt "JWT" [icon=key-round]', { editor: false });
    expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(1);
    instance.update('@deployment\nartifact jwt "JWT"');
    expect(instance.svg.querySelectorAll('.finch-node-icon')).toHaveLength(0);
  });
});


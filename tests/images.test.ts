// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFinch } from "../src/index";

const data = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';
afterEach(() => vi.unstubAllGlobals());
describe('node images and packs', () => {
  it('registers a namespaced image pack independently of themes and gives image precedence', () => {
    const finch = createFinch();
    finch.registerIconPack('company', { logo: { src: data } });
    const instance = finch.render(`@deployment
node a "Logo" [icon=company:logo]
node b "Own" [image="https://example.com/avatar.png" icon=server imageShape=circle]
node c "Rounded" [image="${data}" imageShape=rounded]`, { theme: 'prism', editor: false });
    expect(instance.svg.querySelectorAll('image')).toHaveLength(3);
    expect(instance.svg.querySelectorAll('clipPath')).toHaveLength(2);
    expect(instance.svg.querySelector('image')!.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(instance.svg.querySelector('[data-node-id="b"] image')!.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
    expect(new Set([...instance.svg.querySelectorAll('clipPath')].map(el => el.id)).size).toBe(2);
  });
  it('embeds external images once per URL without changing the editable source', async () => {
    const fetcher=vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(['pixels'],{type:'image/png'})});
    vi.stubGlobal('fetch',fetcher);
    const instance=createFinch().render('@deployment\nnode a "A" [image="https://example.com/a.png"]\nnode b "B" [image="https://example.com/a.png"]',{editor:false});
    const result=await instance.toEmbeddedSvgString();
    expect(result).toContain('data:image/png;base64,');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(instance.source).toContain('https://example.com/a.png');
  });
  it('rejects unsupported URLs and export failures instead of losing images silently', async () => {
    expect(()=>createFinch().render('@deployment\nnode a "A" [image="javascript:alert(1)"]',{editor:false})).toThrow('protocol');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:404}));
    const instance=createFinch().render('@deployment\nnode a "A" [image="https://example.com/missing.png"]',{editor:false});
    await expect(instance.toEmbeddedSvgString()).rejects.toThrow('404');
    await expect(instance.toPngBlob()).rejects.toThrow('404');
  });
});

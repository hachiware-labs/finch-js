// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {pagePreview} from '../src/page-preview';
import {svgMarkupToPngBlob} from '../src/png';
import type {DiagramInstance} from '../src/instance';
vi.mock('../src/png',()=>({svgMarkupToPngBlob:vi.fn()}));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
it('exports only the clicked preview snapshot while a later render replaces it',async()=>{
 vi.useFakeTimers();
 document.body.innerHTML='<div id="pages"></div>';
 let finish!:(blob:Blob)=>void;
 vi.mocked(svgMarkupToPngBlob).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const create=vi.fn(()=> 'blob:page');const revoke=vi.fn();
 vi.stubGlobal('URL',{createObjectURL:create,revokeObjectURL:revoke});
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 let pages=['<svg>first</svg>','<svg>second</svg>'];
 const instance={toSvgPages:()=>pages} as unknown as DiagramInstance;
 const error=vi.fn();const render=pagePreview(instance,document.querySelector('#pages')!,error);
 render();document.querySelectorAll('button')[1]!.click();
 expect(svgMarkupToPngBlob).toHaveBeenCalledExactlyOnceWith('<svg>second</svg>',document);
 pages=['<svg>changed</svg>'];render();
 finish(new Blob(['png'],{type:'image/png'}));await Promise.resolve();await Promise.resolve();
 expect(click).toHaveBeenCalledOnce();
 expect((click.mock.contexts[0] as unknown as HTMLAnchorElement).download).toBe('sequence-page-2.png');
 expect(error).not.toHaveBeenCalled();
 vi.runAllTimers();expect(revoke).toHaveBeenCalledWith('blob:page');
});

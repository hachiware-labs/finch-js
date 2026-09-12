import {sequencePageRanges} from '../src/sequence-pages';
import {sequenceLayout} from '../src/layouts';
import {expect,it} from 'vitest';
import {parseSequence} from '../src/index';
import {createSequenceDiagram} from '../src/parser';
import {defaultTheme} from '../src/theme';
it('preserves page boundaries while numbering and execution continue',()=>{
 const model=parseSequence('@sequence\nautonumber\na -> b: request\nactivate b\nnewpage "Processing"\nb -> c: work\nc --> b: done\nnewpage\nb --> a: accepted\ndeactivate b');
 expect(model.pageBreaks?.map(({at,title})=>({at,title}))).toEqual([{at:1,title:'Processing'},{at:3,title:undefined}]);
 expect(model.connections.map(e=>e.label)).toEqual(['1. request','2. work','3. done','4. accepted']);
 expect(model.nodes).toHaveLength(3);
 const events=JSON.parse(model.nodes.find(n=>n.id==='b')!.attributes.sequenceEvents!);
 expect(events.map((e:{kind:string})=>e.kind)).toEqual(['activate','deactivate']);
 const layout=createSequenceDiagram().toLayoutModel(model,{theme:defaultTheme,measure:()=>({width:100,height:50})});
 expect(layout.pageBreaks).toEqual(model.pageBreaks);
});
it('preserves frames across boundaries and validates page titles',()=>{
 const model=parseSequence('@sequence\nnewpage "Start"\nalt Authorized\na -> b: first\nnewpage "Next"\nb --> a: second\nelse Denied\na -> b: denied\nend\nnewpage');
 expect(model.groups[0]).toMatchObject({start:0,end:2});
 expect(model.pageBreaks?.map(p=>p.at)).toEqual([0,1,3]);
 expect(()=>parseSequence('@sequence\nnewpage "broken')).toThrow();
});

it('derives ordered page windows from current geometry without duplicating messages',()=>{
 const model=parseSequence('@sequence\na -> b: request\nnewpage "Next"\nb --> a: response');
 const layout=createSequenceDiagram().toLayoutModel(model,{theme:defaultTheme,measure:()=>({width:100,height:50})});
 const geometry=sequenceLayout.layout(layout,{overlay:{nodes:{},version:1,diagram:'sequence',editable:false},force:true,preservePinned:false});
 const pages=sequencePageRanges(geometry);
 expect(pages.map(p=>[p.start,p.end])).toEqual([[0,1],[1,2]]);
 expect(pages[0]!.bottom).toBe(pages[1]!.top);
 expect(pages[0]!.bottom).toBeGreaterThan(geometry.edges[0]!.points[0]!.y);
 expect(pages[1]!.top).toBeLessThan(geometry.edges[1]!.points[0]!.y);
 expect(pages[1]!.title).toBe('Next');
 for(const point of geometry.edges[1]!.points)point.y+=40;
 expect(sequencePageRanges(geometry)[1]!.top).toBe(pages[1]!.top+20);
});

it('retains the source page of notes even when pages have no messages',()=>{
 const model=parseSequence('@sequence\nparticipant a\nnote a "Before"\nnewpage "Notes"\nnote a "Middle"\nnewpage\nconstraint a "After"');
 expect(model.connections).toHaveLength(0);
 expect(model.nodes.filter(node=>node.attributes.annotationTarget).map(node=>[node.label,node.attributes.sequencePage])).toEqual([['Before','0'],['Middle','1'],['{After}','2']]);
 const layout=createSequenceDiagram().toLayoutModel(model,{theme:defaultTheme,measure:()=>({width:100,height:50})});
 expect(layout.items.filter(node=>node.attributes.annotationTarget).map(node=>node.attributes.sequencePage)).toEqual(['0','1','2']);
});

it('targets a specific repeated message by ID and rejects ambiguous shorthand',()=>{
 const source='@sequence\na -> b: first [id=first]\na -> b: second [delay=12] [id=second]\nnote second "Second only"';
 const model=parseSequence(source);
 expect(model.connections.map(edge=>edge.id)).toEqual(['first','second']);
 expect(model.connections[1]!.label).toBe('second');
 expect(model.connections[1]!.attributes!.receiveOffset).toBe('12');
 expect(model.nodes.find(node=>node.attributes.annotationTarget)!.attributes).toMatchObject({annotationTarget:'second',annotationKind:'edge'});
 expect(()=>parseSequence(source+'\nnote a->b "Ambiguous"')).toThrow(/Ambiguous/);
 expect(()=>parseSequence(source+'\na -> b: duplicate [id=second]')).toThrow(/Duplicate message/);
});

it('accepts message options in either order or one block without silently duplicating them',()=>{
 for(const options of ['[id=req] [delay=12]','[delay=12] [id=req]','[id=req delay=12]','[delay=12 id=req]']){
  const edge=parseSequence(`@sequence\nb <- a: request ${options}`).connections[0]!;
  expect(edge).toMatchObject({id:'req',from:'a',to:'b',label:'request',attributes:{receiveOffset:'12'}});
 }
 for(const options of ['[id=req id=other]','[delay=12] [delay=14]','[id=bad!]','[delay=NaN]'])expect(()=>parseSequence(`@sequence\na -> b: request ${options}`)).toThrow();
 const automatic=parseSequence('@sequence\na -> b: first\na -> b: second').connections[1]!.id;
 expect(()=>parseSequence(`@sequence\na -> b: first [id=${automatic}]\na -> b: second`)).toThrow(/Duplicate message id/);
});

it('rejects IDs colliding with automatically generated fragment IDs before resolving references',()=>{
 for(const fragment of ['ref over a,b: processing','delay waiting','divider done']){
  const base=`@sequence\nparticipant a\nparticipant b\na -> b: request\n${fragment}`;
  const id=parseSequence(base).connections[1]!.id;
  expect(()=>parseSequence(base.replace('a -> b: request',`a -> b: request [id=${id}]`))).toThrow(/Duplicate message id/);
 }
});

it('ignores page breaks globally while preserving numbering, annotations and editable source',()=>{
 const source='@sequence\nignore newpage\nautonumber\na -> b: first\nnewpage "Next"\nb --> a: second\nnote b "Details"';
 const model=parseSequence(source);
 expect(model.pageBreaks).toBeUndefined();
 expect(model.connections.map(edge=>edge.label)).toEqual(['1. first','2. second']);
 expect(model.nodes.find(node=>node.attributes.annotationTarget)!.attributes.sequencePage).toBe('0');
 expect(model.source).toBe(source);
 expect(parseSequence(source.replace('ignore newpage\n','')+'\nignore newpage').pageBreaks).toBeUndefined();
 expect(()=>parseSequence('@sequence\nignore newpage\nnewpage "broken')).toThrow();
});

it('treats multiline note directives as literal text and retains their page',()=>{
 const source='@sequence\na -> b: request\nnewpage\nnote b\nfirst line\nnewpage\nignore newpage\nheader "literal"\n\nlast line\nend note';
 const model=parseSequence(source);
 expect(model.pageBreaks).toHaveLength(1);
 expect(model.diagramText).toBeUndefined();
 expect(model.nodes.find(node=>node.attributes.annotationTarget)!.attributes.sequencePage).toBe('1');
 expect(model.source).toBe(source);
 expect(()=>parseSequence('@sequence\nparticipant a\nnote a\nunclosed')).toThrow(/Unclosed note/);
});

it('accepts side placement on block notes',()=>{
 const model=parseSequence('@sequence\nparticipant a\nnote left of a\nFirst line\nSecond line\nend note');
 expect(model.nodes.find(node=>node.attributes.annotationTarget)!.attributes.annotationSide).toBe('left');
});

it('reserves an unnumbered spanning note row between messages',()=>{
 const model=parseSequence('@sequence\nautonumber\na -> b: first\nnote over a,b: Shared condition\nb --> a: second');
 expect(model.connections.map(edge=>edge.label)).toEqual(['1. first',undefined,'2. second']);
 expect(model.connections[1]!.attributes).toMatchObject({messageKind:'note',participants:'a,b',fragmentLabel:'Shared condition'});
 expect(()=>parseSequence('@sequence\na -> b: first\nnote over a,b: Condition\nanchor wrong')).toThrow(/follow a message/);
});

it('resolves across notes against every participant including later declarations',()=>{
 const model=parseSequence('@sequence\nnote across\nCommon precondition\nend note\nautonumber\na -> b: first\nparticipant c\nb -> c: second');
 expect(model.connections[0]!.attributes).toMatchObject({noteAcross:'true',participants:'a,b,c',messageKind:'note'});
 expect(model.connections[0]).toMatchObject({from:'a',to:'c'});
 expect(model.connections.slice(1).map(edge=>edge.label)).toEqual(['1. first','2. second']);
 expect(()=>parseSequence('@sequence\nnote across: empty')).toThrow(/at least one participant/);
});

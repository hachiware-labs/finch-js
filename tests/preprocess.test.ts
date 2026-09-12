// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {preprocess,createFinch} from '../src/index';
import {exportDocument} from '../src/document-save';
import {snapshotPreprocess,snapshotPreprocessAsync,preprocessAsync,restorePreprocess} from '../src/preprocess';
it('shares definitions through includes and selects nested conditional branches',()=>{
 expect(preprocess('!include "common"\n!if production\n!if !debug\n{{NAME}}\n!else\nwrong\n!endif\n!else\nwrong\n!endif',{
  includes:{common:'!define NAME Service'},definitions:{production:true,debug:false}
 })).toBe('Service');
 expect(preprocess('!if disabled\n!include "missing"\n{{missing}}\n!endif\nOK')).toBe('OK');
});
it('detects unresolved and recursive resources and malformed conditionals',()=>{
 expect(()=>preprocess('!include "a"',{includes:{a:'!include "b"',b:'!include "a"'}})).toThrow(/Circular/);
 for(const source of ['!include "unknown"','{{unknown}}','!if enabled','!else','!endif','!if x\n!else\n!else\n!endif'])expect(()=>preprocess(source)).toThrow();
});
it('passes include context to host loaders',()=>{
 const calls:Array<[string,string|undefined]>=[];
 expect(preprocess('!include "a"',{resolveInclude:(name,from)=>{
  calls.push([name,from]);return name==='a'?'!include "b"':'hello';
 }})).toBe('hello');
 expect(calls).toEqual([['a',undefined],['b','a']]);
});
it('renders and updates expanded source while retaining the editable original',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@sequence\n!include "actors"\na -> b: {{action}}';
 const instance=createFinch().render(source,{target:'#diagram',editor:false,preprocess:{includes:{actors:'participant a "Client"\nparticipant b "Service"'},definitions:{action:'request'}}});
 expect(instance.model.connections[0]!.label).toBe('request');
 expect(instance.model.source).toBe(source);
 instance.update(source.replace('{{action}}','response'));
 expect(instance.model.connections[0]!.label).toBe('response');
});


it('expands parameterized components with local variables and nested calls',()=>{
 const source=`!define label Outer
!procedure node(id, label)
participant {{id}} "{{label}}"
!define label Local
!endprocedure
!procedure pair(left, right)
!call node("{{left}}", "Client, UI")
!call node("{{right}}", "Service")
{{left}} -> {{right}}: request
!endprocedure
@sequence
!call pair("a", "b")
!call node("c", "{{label}}")`;
 expect(preprocess(source)).toBe('@sequence\nparticipant a "Client, UI"\nparticipant b "Service"\na -> b: request\nparticipant c "Outer"');
});
it('validates procedure arguments and bounds recursion',()=>{
 const base='!procedure p(id)\n{{id}}\n!endprocedure\n';
 for(const call of ['!call p()','!call p(null)','!call p(missing)','!call unknown("a")'])expect(()=>preprocess(base+call)).toThrow();
 expect(()=>preprocess('!procedure p()\n!call p()\n!endprocedure\n!call p()')).toThrow(/nesting/);
 expect(preprocess('!if disabled\n!procedure p()\n!if missing\n{{missing}}\n!endif\n!endprocedure\n!endif\nOK')).toBe('OK');
});


it('saves resolved includes and restores without the original loader',()=>{
 document.body.innerHTML='<div id="saved"></div>';
 let loads=0;
 const source='@sequence\n!include "actors"\na -> b: {{action}}';
 const instance=createFinch().render(source,{target:'#saved',editor:false,preprocess:{definitions:{action:'request'},resolveInclude:()=>{
  loads++;return 'participant a "Client"\nparticipant b "Service"';
 }}});
 const state=instance.exportState();
 expect(loads).toBe(1);
 expect(state.markdown).toContain('participant a "Client"');
 expect(state.markdown).not.toContain('!include');
 const html=exportDocument(document);
 expect(loads).toBe(1);
 instance.destroy();
 document.documentElement.innerHTML=new DOMParser().parseFromString(html,'text/html').documentElement.innerHTML;
 const restored=createFinch().render('@sequence',{target:'#saved',editor:false});
 expect(restored.source).toBe(source);
 expect(restored.model.connections[0]!.label).toBe('request');
 restored.update(source.replace('{{action}}','next'));
 expect(restored.model.connections[0]!.label).toBe('next');
 expect(restored.exportState().preprocess?.resources[0]?.name).toBe('actors');
});


it('uses optional defaults, earlier parameters and explicit overrides',()=>{
 const definition='!procedure p(id, label="{{id}} (default), value", active=true)\n{{id}}: {{label}} / {{active}}\n!endprocedure\n';
 expect(preprocess(definition+'!call p("a")\n!call p("b", "custom", false)')).toBe('a: a (default), value / true\nb: custom / false');
 for(const declaration of ['p(a=1,b)','p(a=[])','p(a=null)','p(a=1,)','p(a,a)','p(a=1e999)'])expect(()=>preprocess(`!procedure ${declaration}\n!endprocedure`)).toThrow();
 expect(()=>preprocess(definition+'!call p()')).toThrow(/arguments/);
});


it('selects comparison branches with boolean precedence and parentheses',()=>{
 const source='!if MODE == "prod" && (REPLICAS >= 2 || DR)\ncluster\n!elseif MODE == "test"\nsandbox\n!else\nlocal\n!endif';
 expect(preprocess(source,{definitions:{MODE:'prod',REPLICAS:3}})).toBe('cluster');
 expect(preprocess(source,{definitions:{MODE:'test'}})).toBe('sandbox');
 expect(preprocess(source,{definitions:{MODE:'prod',REPLICAS:1,DR:false}})).toBe('local');
 expect(preprocess('!if !missing && true\nyes\n!endif')).toBe('yes');
 for(const bad of ['!if a()\n!endif','!if (true\n!endif','!elseif true','!if true\n!else\n!elseif false\n!endif'])expect(()=>preprocess(bad)).toThrow();
});


it('computes local variables with arithmetic precedence and short circuiting',()=>{
 const source='!let N = 2 + 3 * 4\n!let N = (N - 2) / 3\n!let R = N % 3\n!if N == 4 && R == 1\n{{N}}/{{R}}\n!endif';
 expect(preprocess(source)).toBe('4/1');
 expect(preprocess('!let N = -2 * +3\n{{N}}')).toBe('-6');
 expect(preprocess('!if true || 1 / 0 > 1\nyes\n!endif')).toBe('yes');
 for(const source of ['!let N = 1 / 0','!let N = missing','!let N = "text" + 1','!let N = 2 ** 3'])expect(()=>preprocess(source)).toThrow();
});


it('loads each include context once per snapshot and reproduces repeated includes',()=>{
 let loads=0;
 const source='@sequence\n!include "message"\n!include "message"';
 const result=snapshotPreprocess(source,{resolveInclude:()=>`a -> b: version ${++loads}`});
 expect(loads).toBe(1);
 expect(result.source).toBe('@sequence\na -> b: version 1\na -> b: version 1');
 expect(preprocess(source,restorePreprocess(result.snapshot))).toBe(result.source);
 const nested=snapshotPreprocess('!include "a"\n!include "b"',{includes:{a:'!include "child"',b:'!include "child"'},resolveInclude:(_name,from)=>from!});
 expect(nested.source).toBe('a\nb');
 expect(preprocess('!include "a"\n!include "b"',restorePreprocess(nested.snapshot))).toBe(nested.source);
});


it('loads selected asynchronous dependencies once and retains a reusable snapshot',async()=>{
 const calls:string[]=[];
 const source='!include "config"\n!if PROD\n!include "message"\n!include "message"\n!else\n!include "unused"\n!endif';
 const result=await snapshotPreprocessAsync(source,{resolveInclude:async name=>{
  calls.push(name);return name==='config'?'!define PROD true':'a -> b: request';
 }});
 expect(calls).toEqual(['config','message']);
 expect(result.source).toBe('a -> b: request\na -> b: request');
 expect(preprocess(source,restorePreprocess(result.snapshot))).toBe(result.source);
});
it('propagates missing resources, loader failures and cancellation',async()=>{
 await expect(preprocessAsync('!include "missing"',{resolveInclude:async()=>undefined})).rejects.toThrow(/Unknown include/);
 await expect(preprocessAsync('!include "a"',{resolveInclude:async()=>{throw new Error('network failure');}})).rejects.toThrow('network failure');
 const controller=new AbortController();controller.abort();
 await expect(preprocessAsync('!include "a"',{signal:controller.signal,resolveInclude:async()=>''})).rejects.toThrow();
});


it('expands nested foreach and while loops with scoped iteration variables',()=>{
 const source=`!define ITEM outer
!define LIST ["api","worker"]
!let COUNT = 0
!foreach ITEM in LIST
!foreach N in [1,2]
participant {{ITEM}}{{N}}
!let COUNT = COUNT + 1
!endfor
!endfor
!while COUNT < 6
!let COUNT = COUNT + 1
node n{{COUNT}}
!endwhile
{{ITEM}} {{COUNT}}`;
 expect(preprocess(source)).toBe('participant api1\nparticipant api2\nparticipant worker1\nparticipant worker2\nnode n5\nnode n6\nouter 6');
 expect(()=>preprocess('!foreach X in [1]\n{{X}}\n!endfor\n{{X}}')).toThrow(/Undefined/);
});

it('combines loops with procedures, includes and inactive branches',()=>{
 const source=`!procedure emit(NAME)
!foreach N in [1,2]
!include "node"
!endfor
!endprocedure
!call emit("worker")
!if false
!foreach X in MISSING
!include "missing"
!endfor
!endif`;
 expect(preprocess(source,{includes:{node:'participant {{NAME}}{{N}}'}})).toBe('participant worker1\nparticipant worker2');
 expect(preprocess('!foreach X in []\n{{MISSING}}\n!endfor')).toBe('');
});

it('rejects malformed and unbounded source loops',()=>{
 for(const source of ['!foreach X in [1]','!while true\n!endfor','!foreach X in {}\n!endfor'])expect(()=>preprocess(source)).toThrow();
 expect(()=>preprocess('!while true\n!endwhile')).toThrow(/10000/);
 const nested='!foreach X in [1]\n'.repeat(33)+'x\n'+'!endfor\n'.repeat(33);
 expect(()=>preprocess(nested)).toThrow(/nesting/);
});


it('uses one include snapshot per source update and preserves it through visual changes',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source='@sequence\n!include "message"';let loads=0;
 const instance=createFinch().render(source,{target:'#diagram',editor:false,preprocess:{resolveInclude:()=>`a -> b: version ${++loads}`}});
 expect(loads).toBe(1);
 instance.update(source);
 expect(loads).toBe(2);
 expect(instance.model.connections[0]!.label).toBe('version 2');
 expect(instance.exportMarkdown()).toContain('version 2');
 instance.setTheme('default');
 instance.autoLayout();
 expect(loads).toBe(2);
 expect(instance.exportState().preprocess?.resources[0]?.source).toContain('version 2');
});

it('retains the last valid source and snapshot when an updated include is invalid',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 let invalid=false;const source='@sequence\n!include "message"';
 const instance=createFinch().render(source,{target:'#diagram',editor:false,preprocess:{resolveInclude:()=>invalid ? 'invalid source!' : 'a -> b: valid'}});
 const before=instance.exportState();invalid=true;
 expect(()=>instance.update(source+'\n')).toThrow();
 expect(instance.exportState()).toEqual(before);
 instance.setTheme('default');
 expect(instance.model.connections[0]!.label).toBe('valid');
});


it('checks assertions with expressions, quoted colons and contextual failure messages',()=>{
 expect(preprocess('!assert "a:b" == "a:b" : "unused {{MISSING}}"\n!assert true || 1 / 0\nOK')).toBe('OK');
 expect(preprocess('!if false\n!assert false : "skipped"\n!endif')).toBe('');
 expect(()=>preprocess('!define COUNT 0\n!include "validate"',{includes:{validate:'!assert COUNT > 0 : "COUNT={{COUNT}}: must be positive"'}})).toThrow('Source assertion failed in "validate": COUNT=0: must be positive');
 expect(()=>preprocess('!assert false')).toThrow('Source assertion failed: false');
 expect(()=>preprocess('!assert true : missing quotes')).toThrow(/Expected !assert/);
});

it('preserves the document when a procedure assertion fails during an update',()=>{
 document.body.innerHTML='<div id="diagram"></div>';
 const source=`@sequence
!procedure request(COUNT)
!assert COUNT > 0 : "COUNT must be positive"
a -> b: send {{COUNT}}
!endprocedure
!call request(2)`;
 const instance=createFinch().render(source,{target:'#diagram',editor:false,preprocess:{}});
 const before=instance.exportState();
 expect(()=>instance.update(source.replace('request(2)','request(0)'))).toThrow('COUNT must be positive');
 expect(instance.exportState()).toEqual(before);
});


it('evaluates functions in expressions with defaults, nested calls and scoped variables',()=>{
 const source=`!define X original
!function scale(N, FACTOR=2)
!return N * FACTOR
!endfunction
!function label(N)
!let X = scale(N)
!if X >= 6
!return "large"
!endif
!return "small"
!endfunction
!let RESULT = scale(2 + 1, scale(2))
!let LABEL = label(3)
{{RESULT}} {{LABEL}} {{X}}
!assert scale(3) == 6
!if false && missing(1)
wrong
!endif`;
 expect(preprocess(source)).toBe('12 large original');
});

it('returns from loops and rejects missing returns, bad calls and runaway recursion',()=>{
 expect(preprocess(`!function first()
!foreach N in [1,2]
!return N
!endfor
!endfunction
!let X = first()
{{X}}`)).toBe('1');
 for(const body of ['', 'a -> b', '!return MISSING'])expect(()=>preprocess(`!function f()\n${body}\n!endfunction\n!let X = f()`)).toThrow();
 expect(()=>preprocess('!return 1')).toThrow(/requires/);
 expect(()=>preprocess('!function f()\n!return f()\n!endfunction\n!let X = f()')).toThrow(/nesting/);
 expect(()=>preprocess('!function f(X)\n!return X\n!endfunction\n!let X = f()')).toThrow(/arguments/);
 expect(()=>preprocess('!let X = missing(1)')).toThrow(/Unknown/);
 expect(()=>preprocess('!if false && missing(1,)\n!endif')).toThrow();
});


it('validates unreachable function tails and included return bodies before execution',()=>{
 const malformed=[
  '!if true\n!return 1',
  '!return 1\n!while false',
  '!return 1\n!if true\n!else\n!else\n!endif',
  '!foreach N in [1]\n!return N\n!endif\n!endfor',
 ];
 for(const body of malformed)expect(()=>preprocess(`!function f()\n${body}\n!endfunction\n!let X = f()`)).toThrow(/Unclosed|Mismatched|Unexpected/);
 expect(()=>preprocess('!function f()\n!include "body"\n!endfunction\n!let X = f()',{includes:{body:'!return 1\n!if true'}})).toThrow(/Unclosed/);
 expect(preprocess('!function f()\n!if true\n!return 1\n!else\n!return 2\n!endif\n!endfunction\n!let X = f()\n{{X}}')).toBe('1');
});


it('builds labels with deterministic string and numeric functions',()=>{
 const source=`!define PREFIX api
!let LABEL = concat(upper(PREFIX), "-", round(max(2.1, 3.6)))
!let SHORT = substr("A😀東京", 1, 2)
!assert strlen("A😀東京") == 4
!assert strpos("A😀東京", "東") == 2
!assert strpos("abc", "missing") == -1
!assert replace("a-a", "a", "b") == "b-b"
!assert lower(trim(" ABC ")) == "abc"
!assert number("12.5") == 12.5
!assert string(true) == "true"
!assert min(abs(-4), ceil(2.1), floor(4.9)) == 3
!assert exists("PREFIX") && !exists("MISSING")
{{LABEL}} {{SHORT}}`;
 expect(preprocess(source)).toBe('API-4 😀東');
});

it('rejects invalid builtin calls and skips calls in short-circuited expressions',()=>{
 for(const call of ['substr("abc", -1)', 'substr("abc", 0, 0.5)', 'replace("abc", "", "x")','number("no")','max()', 'upper(MISSING)', 'constructor()'])expect(()=>preprocess(`!let X = ${call}`)).toThrow();
 expect(preprocess('!assert true || number("bad")')).toBe('');
 expect(preprocess('!function upper(X)\n!return "custom"\n!endfunction\n!let X = upper("a")\n{{X}}')).toBe('custom');
});


it('rejects nonfinite literals and empty ordered operands without evaluating skipped branches',()=>{
 const huge='9'.repeat(400);
 for(const expression of [huge,`-${huge}`,`1 + ${huge}`,`"" < 1`,`"   " >= 0`]){
  expect(()=>preprocess(`!let result = ${expression}\n{{result}}`)).toThrow(/finite numbers/);
 }
 expect(preprocess(`!let result = true || ${huge}\n{{result}}`)).toBe('true');
 expect(preprocess(`!let result = false && ("" < ${huge})\n{{result}}`)).toBe('false');
 expect(preprocess('!let result = "12" > 2\n{{result}}')).toBe('true');
 expect(preprocess('!let result = "" == ""\n{{result}}')).toBe('true');
});


it('reads JSON objects and arrays and feeds extracted arrays into loops',()=>{
 const source=`!define DATA {"services":["api","worker"],"limits":{"retry":3},"enabled":true,"nothing":null,"__proto__":"literal"}
!let IDS = json_get(DATA, "services")
!assert json_type(IDS) == "array"
!assert json_size(IDS) == 2
!assert json_get(IDS, 1) == "worker"
!assert json_get(json_get(DATA, "limits"), "retry") == 3
!assert json_get(DATA, "enabled")
!assert json_get(DATA, "__proto__") == "literal"
!assert !json_has(DATA, "toString")
!assert json_type(json_get(DATA, "nothing")) == "null"
!foreach ID in IDS
participant {{ID}}
!endfor`;
 expect(preprocess(source)).toBe('participant api\nparticipant worker');
 expect(preprocess('!let KEYS = json_keys(DATA)\n{{KEYS}}',{definitions:{DATA:'{"x":1,"y":2}'}})).toBe('["x","y"]');
 for(const call of ['json_get(DATA, "missing")','json_get("[]", -1)','json_get("[]", 0.5)','json_size("null")','json_get("invalid", "x")'])expect(()=>preprocess(`!let X = ${call}`,{definitions:{DATA:'{}'}})).toThrow(/JSON/);
 expect(preprocess('!assert true || json_get("invalid", "x")')).toBe('');
});


it('iterates JSON objects, nested arrays and null with scoped variables',()=>{
 const source=`!define ROW previous
!foreach ROW in [{"id":"api","label":"{{LABEL}}","tags":["public","http"]}]
!let ID = json_get(ROW, "id")
!let NAME = json_get(ROW, "label")
{{ID}} {{NAME}}
!let TAGS = json_get(ROW, "tags")
!foreach TAG in TAGS
{{TAG}}
!endfor
!endfor
{{ROW}}
!foreach ROW in [null,[1,2]]
!let KIND = json_type(ROW)
{{KIND}}
!endfor`;
 expect(preprocess(source,{definitions:{LABEL:'A "quoted" label'}})).toBe('api A "quoted" label\npublic\nhttp\nprevious\nnull\narray');
 expect(()=>preprocess('!foreach ROW in [{"n":1e999}]\n!endfor')).toThrow(/finite/);
});


it('updates JSON without losing types or modifying the input value',()=>{
 const source=`!define ORIGINAL {"n":1,"s":"null","nil":null}
!let COPY = json_set(ORIGINAL, "n", "2")
!let COPY = json_set(COPY, "__proto__", json_encode("literal"))
!assert json_get(ORIGINAL, "n") == 1
!assert json_get(COPY, "n") == 2
!assert json_get(COPY, "__proto__") == "literal"
!assert json_type(json_at(COPY, "s")) == "string"
!assert json_type(json_at(COPY, "nil")) == "null"
!let COPY = json_remove(COPY, "n")
!assert !json_has(COPY, "n")
!let ROWS = json_set("[]", 0, ORIGINAL)
!let ROWS = json_set(ROWS, 1, "false")
!let ROWS = json_remove(ROWS, 0)
{{ROWS}}`;
 expect(preprocess(source)).toBe('[false]');
 for(const call of ['json_set("[]", 2, "1")','json_remove("[]", 0)','json_set("{}", "x", "bad")','json_at("{}", "missing")','json_keys(DATA)'])expect(()=>preprocess(`!let X = ${call}`,{definitions:{DATA:'{"n":1e999}'}})).toThrow(/JSON/);
});


it('restores the JSON-driven example from saved HTML with editable original source',()=>{
 const htmlSource=readFileSync('examples/json-sequence.html','utf8');
 const source=htmlSource.match(/const jsonSequenceSource = `([^]*?)`;/)![1]!;
 document.body.innerHTML='<div id="json-example"></div>';
 const instance=createFinch().render(source,{target:'#json-example',editor:false,preprocess:{}});
 expect(instance.model.nodes.map(n=>n.label)).toEqual(['Client','Order API','PostgreSQL']);
 expect(instance.model.connections.filter(e=>e.attributes?.messageKind!=='divider')).toHaveLength(4);
 const saved=exportDocument(document);instance.destroy();
 document.documentElement.innerHTML=new DOMParser().parseFromString(saved,'text/html').documentElement.innerHTML;
 const restored=createFinch().render('@sequence',{target:'#json-example',editor:false});
 expect(restored.source).toBe(source);
 expect(restored.model.diagramText?.header).toBe('Production');
 restored.update(source.replace('json_encode("Production")','json_encode("Staging")'));
 expect(restored.model.diagramText?.header).toBe('Staging');
 expect(restored.toSvgString()).toContain('Staging');
});


it('includes a shared resource once per expansion and keeps normal include repeatable',()=>{
 const options={includes:{a:'!include_once "common"\na',b:'!include_once "common"\nb',common:'shared'}};
 expect(preprocess('!include "a"\n!include "b"',options)).toBe('shared\na\nb');
 expect(preprocess('!include "common"\n!include_once "common"\n!include "common"',options)).toBe('shared\nshared');
 expect(preprocess('!if false\n!include_once "common"\n!endif\n!include_once "common"',options)).toBe('shared');
 expect(preprocess('!include_once "self"',{includes:{self:'!include_once "self"\nhello'}})).toBe('hello');
 expect(()=>preprocess('!include_once "self"',{includes:{self:'!include "self"'}})).toThrow(/Circular/);
 expect(preprocess('!include_once "common"',options)).toBe('shared');
});
it('preserves include_once selection with async resolution and saved snapshots',async()=>{
 const calls:string[]=[];
 const source='!include_once "common"\n!include_once "common"';
 const {snapshot,source:expanded}=await snapshotPreprocessAsync(source,{resolveInclude:async name=>{calls.push(name);return 'shared';}});
 expect(calls).toEqual(['common']);expect(expanded).toBe('shared');
 expect(preprocess(source,restorePreprocess(snapshot))).toBe('shared');
});


it('evaluates foreach collection expressions once and skips unselected branches',()=>{
 const source=`!define CONFIG {"actors":["api","worker"]}
!function actors()
!return json_get(CONFIG, "actors")
!endfunction
!foreach ID in actors()
{{ID}}
!let CONFIG = json_set(CONFIG, "actors", "[]")
!endfor
!if false
!foreach ID in unknown()
{{ID}}
!endfor
!endif`;
 expect(preprocess(source)).toBe('api\nworker');
 expect(preprocess('!foreach KEY in json_keys(CONFIG)\n{{KEY}}\n!endfor',{definitions:{CONFIG:'{"api":1,"worker":2}'}})).toBe('api\nworker');
 expect(()=>preprocess('!foreach ID in 42\n!endfor')).toThrow(/JSON array/);
 expect(()=>preprocess('!foreach ID in unknown()\n!endfor')).toThrow(/Unknown/);
});

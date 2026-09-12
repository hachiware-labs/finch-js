import {expect,it} from 'vitest';
import {measureDiagramText} from '../src/diagram-text';
it('reserves independent top and bottom bands and wraps long text',()=>{
 expect(measureDiagramText(undefined)).toEqual({top:0,bottom:0,blocks:[]});
 const result=measureDiagramText({header:'Environment',title:'A long architecture title that should wrap over more than one line',legend:'Request\nResponse',footer:'Internal'},12);
 expect(result.blocks.map(b=>b.kind)).toEqual(['header','title','legend','footer']);
 expect(result.blocks[1]!.lines.length).toBeGreaterThan(1);
 expect(result.blocks[1]!.y).toBeGreaterThan(result.blocks[0]!.y);
 expect(result.blocks[3]!.y).toBeGreaterThan(result.blocks[2]!.y+16);
 expect(result.top).toBeGreaterThan(0);expect(result.bottom).toBeGreaterThan(0);
 const large=measureDiagramText({title:'A title'},24);
 expect(large.top).toBeGreaterThan(measureDiagramText({title:'A title'},12).top);
});

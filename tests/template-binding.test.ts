import {expect,it} from 'vitest';
import {parseClass} from '../src/index';

const source=`@class
namespace data {
 interface Repository<K, V> {
  +find(key: K): V
 }
 class Users {
 }
 bind Users Repository "K=String, V=Map<String, User>"
}`;

it('retains formal to actual substitutions including nested generic arguments',()=>{
 const model=parseClass(source),edge=model.connections[0]!;
 expect([edge.from,edge.to]).toEqual(['data.Users','data.Repository']);
 expect(JSON.parse(edge.attributes!.templateBinding!)).toEqual({K:'String',V:'Map<String, User>'});
 expect(edge.dashed).toBe(true);
 expect(edge.label).toContain('«bind»');
});

it('rejects unknown and duplicate formal parameters and non-template targets',()=>{
 expect(()=>parseClass(source.replace('K=String','X=String'))).toThrow('substitution');
 expect(()=>parseClass(source.replace('K=String','K=String, K=Number'))).toThrow('duplicate');
 expect(()=>parseClass(source.replace('bind Users Repository','bind Repository Users'))).toThrow('template');
 expect(()=>parseClass(source.replace('Map<String, User>','Map<String, User'))).toThrow('Unbalanced');
 expect(()=>parseClass(source.replace('Map<String, User>','Map<String, User]'))).toThrow('Unbalanced');
});

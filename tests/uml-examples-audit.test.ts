import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import Finch, {preprocess} from '../src/index';

it('parses every static UML example and diagnoses only the intentional invalid demonstration',()=>{
 let count=0;
 for(const file of readdirSync('examples').filter(f=>f.endsWith('.html'))) {
  const html=readFileSync(`examples/${file}`,'utf8');
  for(const match of html.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:String\.raw\s*)?`([\s\S]*?)`\s*(?:\.trim\(\))?\s*;/g)) {
   const source=match[2]!.trim(); if(!/^@(state|sequence|class|object|timing|activity|component|usecase)\b/.test(source))continue;
   const model=Finch.parse(/^\s*!(?:define|let|if|procedure|include(?:_once)?|foreach|while|assert|function)\b/m.test(source) ? preprocess(source) : source); count++;
   if(file==='state-semantics.html' && match[1]==='invalidSource') expect(model.diagnostics?.length).toBeGreaterThan(0);
   else expect(model.diagnostics ?? [],`${file}: ${match[1]}`).toEqual([]);
  }
 }
 expect(count).toBeGreaterThan(20);
});

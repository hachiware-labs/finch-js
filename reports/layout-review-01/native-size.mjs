import {readFile,writeFile} from 'node:fs/promises';
const dir='reports/layout-review-01';const cases=JSON.parse(await readFile(`${dir}/cases.json`));
for(const c of cases){let html=await readFile(`${dir}/${c.id}.html`,'utf8');html=html.replace("editor:true});</script>","editor:true});instance.svg.style.width=instance.geometry.width+'px';instance.svg.style.height=instance.geometry.height+'px';instance.svg.style.maxWidth='none';</script>");await writeFile(`${dir}/${c.id}.html`,html)}

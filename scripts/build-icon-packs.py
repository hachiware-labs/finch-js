"""Build optional packs from a Diagrams ZIP and an unpacked simple-icons package.
Usage: python scripts/build-icon-packs.py diagrams.zip path/to/simple-icons
"""
from pathlib import Path
import sys, json, zipfile, base64, hashlib
zip_path, simple_path = Path(sys.argv[1]), Path(sys.argv[2])
out = Path('icon-packs'); out.mkdir(exist_ok=True)
manifest = {}
def emit(name, icons, provenance):
    assets=[]; positions={}; entries=[]
    for key, value in icons.items():
        digest=hashlib.sha256(value['src'].encode()).hexdigest()
        if digest not in positions:
            positions[digest]=len(assets); assets.append(value)
        entries.append([key,positions[digest]])
    payload='const assets='+json.dumps(assets,separators=(',',':'))+';\nconst icons=Object.fromEntries('+json.dumps(entries,separators=(',',':'))+'.map(([key,index])=>[key,assets[index]]));\n'
    (out/(name+'.js')).write_text('// '+provenance+'\n(()=>{\n'+payload+'Finch.registerIconPack('+json.dumps(name)+',icons);\n})();\n',encoding='utf-8')
    (out/(name+'.mjs')).write_text('// '+provenance+'\n'+payload+'export default icons;\n',encoding='utf-8')
    (out/(name+'.d.mts')).write_text('declare const icons: Record<string, {src: string}>;\nexport default icons;\n',encoding='utf-8')
    manifest[name]={'count':len(icons),'uniqueAssets':len(assets),'names':list(icons),'source':provenance}
with zipfile.ZipFile(zip_path) as archive:
    prefix=archive.namelist()[0].split('/')[0]+'/'
    for provider in ['aws','azure','gcp','k8s']:
        icons={}; aliases={}
        for path in archive.namelist():
            marker=prefix+'resources/'+provider+'/'
            if not path.startswith(marker) or not path.endswith('.png'): continue
            name=path[len(marker):-4]
            data={'src':'data:image/png;base64,'+base64.b64encode(archive.read(path)).decode()}
            icons[name]=data
            slug=name.rsplit('/',1)[-1]
            aliases.setdefault(slug,[]).append(name)
        for alias,keys in aliases.items():
            if len(keys)==1: icons[alias]=icons[keys[0]]
        if provider=='aws' and 'application-auto-scaling' not in icons:
            for key in icons:
                if key.endswith('/application-auto-scaling') or key.endswith('/application-autoscaling'):
                    icons['application-auto-scaling']=icons[key]; break
        if provider=='k8s' and 'pod' not in icons and 'pods' in icons: icons['pod']=icons['pods']
        emit(provider,icons,'Diagrams '+prefix.rstrip('/')+'; vendor trademarks retained; see NOTICE.md')
    (out/'DIAGRAMS-LICENSE.txt').write_bytes(archive.read(prefix+'LICENSE'))
metadata=json.loads((simple_path/'data/simple-icons.json').read_text(encoding='utf-8'))
icons={}
for item in metadata:
    svg=(simple_path/'icons'/(item['slug']+'.svg')).read_text(encoding='utf-8')
    svg=svg.replace('<svg ', '<svg fill="#'+item['hex']+'" ',1)
    icons[item['slug']]={'src':'data:image/svg+xml;base64,'+base64.b64encode(svg.encode()).decode()}
version=json.loads((simple_path/'package.json').read_text())['version']
emit('simple',icons,'Simple Icons '+version+'; see SIMPLE-ICONS-LICENSE.md and SIMPLE-ICONS-DISCLAIMER.md')
for source,target in [('LICENSE.md','SIMPLE-ICONS-LICENSE.md'),('DISCLAIMER.md','SIMPLE-ICONS-DISCLAIMER.md'),('data/simple-icons.json','simple-provenance.json')]:
    (out/target).write_bytes((simple_path/source).read_bytes())
(out/'catalog.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print({k:v['count'] for k,v in manifest.items()})
print('Pack bytes:',sum(p.stat().st_size for p in out.glob('*.js')))

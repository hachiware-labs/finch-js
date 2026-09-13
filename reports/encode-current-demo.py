import json
from pathlib import Path
from PIL import Image
for lang in ('en', 'ja'):
    root = Path(f'reports/doc-media-audit/editing-{lang}')
    manifest = json.loads((root/'frames.json').read_text())
    frames = [Image.open(root/f['file']).convert('RGB') for f in manifest]
    target = Path('docs/assets')/f'finch-editing-demo{"-ja" if lang == "ja" else ""}.gif'
    frames[0].save(target, save_all=True, append_images=frames[1:], duration=[f['duration'] for f in manifest], loop=0, optimize=True)
    print(target, target.stat().st_size)

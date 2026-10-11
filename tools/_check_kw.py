import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
KW = "残留溶剂"
hits = []
for p in Path('F:/knowledge-base').rglob('*.md'):
    try:
        text = p.read_text(encoding='utf-8', errors='ignore')[:3000]
    except Exception:
        continue
    if KW in text:
        hits.append((str(p.relative_to('F:/knowledge-base')), text[:120].replace(chr(10), ' ')))
print(f'含 {KW} 的 .md 数: {len(hits)}')
for i, (p, t) in enumerate(hits[:8], 1):
    print(f'{i}. {p}')
    print(f'   {t[:100]}')
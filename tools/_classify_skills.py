import os, sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
root = Path(r'C:\Users\sleep well\.claude\skills')

# 完全空 = 目录本身 + 所有子目录都没有文件
def is_fully_empty(d):
    for _, dirs, files in os.walk(d):
        if files:
            return False
        # 递归继续
    return True

empties = []
has_content = []
for d in sorted(root.iterdir()):
    if not d.is_dir(): continue
    if is_fully_empty(d):
        empties.append(d.name)
    else:
        # 数文件
        n = sum(1 for _, _, files in os.walk(d) for _ in files)
        has_content.append((d.name, n))

print(f'=== 完全空 skill（应该归档）: {len(empties)} ===')
for i, s in enumerate(empties, 1):
    print(f'  {i:2d}. {s}')

print(f'\n=== 有内容 skill（前 15）: {len(has_content)} ===')
for s, n in sorted(has_content, key=lambda x: -x[1])[:15]:
    print(f'  {n:5d} {s}')
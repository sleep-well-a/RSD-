#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v54.317 跨版本 memory 索引自动更新

扫描 ~/.claude/.../memory/rsd-milestone-v54-XXX-*.md，
自动生成 MEMORY.md 索引条目（按版本号倒序）。
保留非 milestone 条目（user/feature 等）。

用法：
  python tools/build_memory_index.py            # 写入 MEMORY.md
  python tools/build_memory_index.py --dry-run  # 只输出不写
"""
import re
import sys
import argparse
from pathlib import Path

MEMORY_DIR = Path(r'C:\Users\sleep well\.claude\projects\C--Users-sleep-well\memory')
MEMORY_FILE = MEMORY_DIR / 'MEMORY.md'


def parse_milestone_file(path):
    """从 milestone memory 提取 frontmatter name 和 description。"""
    text = path.read_text(encoding='utf-8')
    fm_match = re.match(r'^---\n(.*?)\n---', text, re.DOTALL)
    if not fm_match:
        return None
    fm = fm_match.group(1)
    name = re.search(r'^name:\s*(.+)$', fm, re.MULTILINE)
    desc = re.search(r'^description:\s*(.+)$', fm, re.MULTILINE)
    if not name:
        return None
    name_val = name.group(1).strip()
    # 文件名约定：rsd-milestone-v54-XXX-slug.md（横杠）
    # 但 description 里也可能是 v54.XXX（点）
    # 优先从文件名提取
    fname_match = re.search(r'v54[-.](\d+)', path.name)
    if not fname_match:
        fname_match = re.search(r'v54[-.](\d+)', name_val)
    return {
        'name': name_val,
        'description': (desc.group(1).strip() if desc else ''),
        'version': fname_match,
    }


def scan_milestones():
    """扫描所有 rsd-milestone-v54-XXX-*.md 文件，按版本号倒序。"""
    milestones = []
    for f in MEMORY_DIR.glob('rsd-milestone-v54-*.md'):
        info = parse_milestone_file(f)
        if not info or not info.get('version'):
            continue
        info['version_num'] = int(info['version'].group(1))
        info['filename'] = f.name
        milestones.append(info)
    milestones.sort(key=lambda x: x['version_num'], reverse=True)
    return milestones


def read_existing_non_milestones():
    """从现有 MEMORY.md 提取非 milestone 条目。"""
    if not MEMORY_FILE.exists():
        return []
    non_milestone = []
    for line in MEMORY_FILE.read_text(encoding='utf-8').splitlines():
        if not line.startswith('- ['):
            continue
        if 'rsd-milestone-v54-' in line:
            continue  # 跳过 milestone 行
        non_milestone.append(line)
    return non_milestone


def build_index(milestones, non_milestone):
    """生成新的 MEMORY.md 内容。"""
    lines = []
    for m in milestones:
        desc = m['description']
        # 限制单行长度
        if len(desc) > 200:
            desc = desc[:197] + '...'
        lines.append(f"- [{m['name']}]({m['filename']}) — {desc}")
    # 加上非 milestone 条目
    if non_milestone:
        lines.append('')  # 空行
        lines.extend(non_milestone)
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true', help='只输出不写')
    args = parser.parse_args()

    milestones = scan_milestones()
    print(f'[1] 扫描到 {len(milestones)} 个 milestone memory 文件')
    if not milestones:
        print('ERROR: 没找到任何 milestone memory')
        sys.exit(1)

    non_milestone = read_existing_non_milestones()
    print(f'[2] 保留 {len(non_milestone)} 个非 milestone 条目')

    content = build_index(milestones, non_milestone)

    if args.dry_run:
        import sys as _sys
        _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        print('[DRY-RUN] MEMORY.md 内容预览：')
        print(content[:1500])
        if len(content) > 1500:
            print(f'... (total {len(content)} chars)')
        return

    MEMORY_FILE.write_text(content, encoding='utf-8')
    print(f'[3] [OK] MEMORY.md 已更新（{len(milestones)} 个 milestone + {len(non_milestone)} 个其他条目）')


if __name__ == '__main__':
    main()

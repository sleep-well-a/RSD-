#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
archive_empty_skills.py — 归档 47 个完全空 skill（v54.284 Phase D）

策略：mv 到 <name>.archived/ 而非 rm，避免误删。
理由：~/.claude/skills/ 下 <name>.archived/ 不被 Claude 自动加载（validate 会拒绝非法名）。
回滚：mv 回去即可。
"""
import shutil
import sys
from pathlib import Path

SKILLS_ROOT = Path(r"C:\Users\sleep well\.claude\skills")
BACKUP_ROOT = Path(r"C:\Users\sleep well\.claude\skills\_archived_20261004")


def is_fully_empty(d: Path) -> bool:
    """目录 + 所有子目录都没有文件"""
    for _, _, files in __import__("os").walk(d):
        if files:
            return False
    return True


def main():
    sys.stdout.reconfigure(encoding="utf-8")

    if not SKILLS_ROOT.exists():
        print(f"[FAIL] {SKILLS_ROOT} 不存在")
        return 1

    BACKUP_ROOT.mkdir(parents=True, exist_ok=True)

    empty_skills = []
    for d in sorted(SKILLS_ROOT.iterdir()):
        if d == BACKUP_ROOT:
            continue  # 跳过 backup 目录本身
        if not d.is_dir():
            continue
        if is_fully_empty(d):
            empty_skills.append(d)

    print(f"=== 完全空 skill 数: {len(empty_skills)} ===")
    if not empty_skills:
        print("无空 skill")
        return 0

    print()
    print("--- 归档操作（mv → .archived 后缀 + 备份到 _archived_20261004）---")

    for d in empty_skills:
        backup_dst = BACKUP_ROOT / d.name
        # 备份到 _archived_20261004
        shutil.copytree(d, backup_dst, dirs_exist_ok=True)
        # 原位置改 .archived 后缀（让 asm validate 拒绝）
        archived_dst = d.with_name(d.name + ".archived")
        shutil.move(str(d), str(archived_dst))
        print(f"  [mv] {d.name} → {d.name}.archived (backup OK)")

    print()
    print(f"=== 完成: {len(empty_skills)} 个 skill 归档 ===")
    print(f"备份位置: {BACKUP_ROOT}")
    print(f"回滚命令: for d in {BACKUP_ROOT}/*; do mv $d {SKILLS_ROOT}/$(basename $d); done")

    return 0


if __name__ == "__main__":
    sys.exit(main())
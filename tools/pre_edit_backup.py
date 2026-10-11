#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
pre_edit_backup.py — Edit 前自动备份脚本（v54.284 SOP 落地）

目的：杜绝 v54.270 / v54.283 类"备份时机错误 + 完整事故恢复"事故。
每次 Edit / Write 工具调用前应先运行此脚本。

用法：
    python tools/pre_edit_backup.py [theme]

示例：
    python tools/pre_edit_backup.py "修 i18n-data alert 键"
    python tools/pre_edit_backup.py round36_perf_fix
    python tools/pre_edit_backup.py                    # theme=manual

输出：
    [backup] created: F:\自制软件\_backups\pre_edit_20261003_225510_manual\
    [backup] files copied: 8
    [backup] SKIP: xxx    (仅当源文件缺失)

回滚策略：
    任何 Phase 失败 → cp _backups/pre_edit_<最近的>/RSD*.* F:\自制软件\
    黄金救援基线：_backups/v54_283/ (Phase A 前)
"""
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path

# 路径配置
ROOT = Path("F:/自制软件") if sys.platform == "win32" else Path("/f/自制软件")
BACKUPS_ROOT = ROOT / "_backups"

# 备份文件清单（与 phase_a_pre 保持一致）
BACKUP_FILES = [
    "RSD & 含量计算器.html",
    "app.js",
    "styles.css",
    "helpers-i18n.js",
    "helpers-toast.js",
    "helpers-export.js",
    "helpers-export-comprehensive.js",
    "i18n-data.js",
    "i18n-zh.js",
    "i18n-en.js",
    "i18n-alert.js",
]


def main():
    # 1. 解析 theme 参数
    theme = sys.argv[1] if len(sys.argv) > 1 else "manual"
    # sanitize theme（去空格）
    theme_clean = theme.replace(" ", "_").replace("/", "_").replace("\\", "_")

    # 2. 时间戳
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    # 3. 创建备份目录
    backup_dir = BACKUPS_ROOT / f"pre_edit_{ts}_{theme_clean}"
    try:
        backup_dir.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        # 同一秒内重复触发 → 加微秒后缀
        ts2 = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:18]
        backup_dir = BACKUPS_ROOT / f"pre_edit_{ts2}_{theme_clean}"
        backup_dir.mkdir(parents=True, exist_ok=False)

    # 4. cp 核心文件
    copied = 0
    skipped = []
    for fname in BACKUP_FILES:
        src = ROOT / fname
        if not src.exists():
            skipped.append(fname)
            continue
        try:
            shutil.copy2(src, backup_dir / fname)
            copied += 1
        except Exception as e:
            print(f"[backup] ERROR copying {fname}: {e}", file=sys.stderr)
            skipped.append(fname)

    # 5. 输出
    print(f"[backup] created: {backup_dir}")
    print(f"[backup] files copied: {copied}")
    if skipped:
        print(f"[backup] SKIP: {', '.join(skipped)}")
    print(f"[backup] 回滚命令: cp \"{backup_dir}\\*\" \"{ROOT}\\\"")


if __name__ == "__main__":
    main()
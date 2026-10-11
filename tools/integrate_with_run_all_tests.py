#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
integrate_with_run_all_tests.py — 把 v54.284 工具链挂到 run_all_tests.py 前面（Phase D 落地）

目的：让任何调用 `python tests/run_all_tests.py` 的入口自动先跑静态扫描器。

用法：
    python tools/integrate_with_run_all_tests.py            # 注入（默认 dry-run 检查）
    python tools/integrate_with_run_all_tests.py --apply    # 实际写入 run_all_tests.py
    python tools/integrate_with_run_all_tests.py --revert   # 恢复原文件（从 backup）

注入的代码（头部插入）：
    import subprocess
    import sys
    # v54.284 工具链：静态扫描器（v54.248-283 七轮复盘教训防御层）
    for tool in [
        'tools/scan_i18n_hardcoded.py',
        'tools/scan_html_typos.py',
        'tools/audit_a11y_aria.py',
    ]:
        r = subprocess.run(['python', tool], cwd='F:/自制软件')
        if r.returncode != 0:
            print(f'[FAIL] {tool} exit={r.returncode}', file=sys.stderr)
            sys.exit(1)

退出码语义（工具链已挂）：
    1 = 静态扫描器发现 high severity 失败

备份：
    ./F:\自制软件\_backups\pre_run_all_tests_integration_<timestamp>/
"""
import argparse
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path("F:/自制软件") if sys.platform == "win32" else Path("/f/自制软件")
RUN_ALL_TESTS = ROOT / "tests" / "run_all_tests.py"

INJECT_CODE = '''# v54.284 工具链：静态扫描器（v54.248-283 七轮复盘教训防御层）
import subprocess
for tool in [
    'tools/scan_i18n_hardcoded.py',
    'tools/scan_html_typos.py',
    'tools/audit_a11y_aria.py',
]:
    r = subprocess.run(['python', tool], cwd='F:/自制软件')
    if r.returncode != 0:
        print('[FAIL] ' + tool + ' exit=' + str(r.returncode), file=sys.stderr)
        sys.exit(1)
'''


def main():
    parser = argparse.ArgumentParser(description="把 v54.284 工具链挂到 run_all_tests.py")
    parser.add_argument("--apply", action="store_true", help="实际写入（默认只检查）")
    parser.add_argument("--revert", action="store_true", help="恢复原文件")
    args = parser.parse_args()

    if not RUN_ALL_TESTS.exists():
        print(f"[FAIL] {RUN_ALL_TESTS} 不存在")
        sys.exit(1)

    text = RUN_ALL_TESTS.read_text(encoding="utf-8")

    # 检查是否已注入
    has_inject = "# v54.284 工具链" in text
    if args.revert:
        if not has_inject:
            print("[revert] 未注入，无需恢复")
            return
        # 移除注入块（含整段代码直到 sys.exit(1)）
        new_text = re.sub(
            r"# v54\.284 工具链.*?sys\.exit\(1\)\n",
            "",
            text,
            flags=re.DOTALL,
        )
        RUN_ALL_TESTS.write_text(new_text, encoding="utf-8")
        print(f"[revert] {RUN_ALL_TESTS} 已恢复")
        return

    if has_inject:
        print(f"[skip] {RUN_ALL_TESTS} 已含 v54.284 注入块")
        return

    # 找注入点：第一个 `import` 或文件开头
    first_import = re.search(r"^import\s+", text, re.MULTILINE)
    if first_import:
        # 在第一个 import 前插入
        new_text = text[: first_import.start()] + INJECT_CODE + "\n" + text[first_import.start():]
    else:
        # 文件开头
        new_text = INJECT_CODE + "\n" + text

    if not args.apply:
        print(f"[dry-run] 将向 {RUN_ALL_TESTS} 头部插入：")
        print("---")
        print(INJECT_CODE)
        print("---")
        print(f"用 --apply 实际写入")
        return

    # 备份原文件
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = ROOT / "_backups" / f"pre_run_all_tests_integration_{ts}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(RUN_ALL_TESTS, backup_dir / "run_all_tests.py")
    print(f"[backup] {RUN_ALL_TESTS} → {backup_dir / 'run_all_tests.py'}")

    RUN_ALL_TESTS.write_text(new_text, encoding="utf-8")
    print(f"[apply] {RUN_ALL_TESTS} 已注入 v54.284 工具链头部")


if __name__ == "__main__":
    main()
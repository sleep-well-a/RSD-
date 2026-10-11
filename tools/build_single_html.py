#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
build_single_html.py — 从主版生成新的流动相版（v54.284 工具链）

目的：解决流动相版 inline JS 落后主版 15+ 小时的问题（修复 v54.248 反转 bug）

策略：
  - 读主版 HTML（保留 CDN script 引用）
  - 读 11 个 local 资源（styles.css + app.js + helpers-*.js + i18n-*.js）
  - inline local 资源到 <style> / <script> 块
  - 输出新流动相版（与主版 JS 内容完全一致）

用法：
  python tools/build_single_html.py            # 默认输出 流动相版.html（覆盖旧）
  python tools/build_single_html.py --out _v54.284.html  # 输出到新文件
"""
import argparse
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(r"F:\自制软件")

MAIN_HTML = ROOT / "RSD & 含量计算器.html"
LOCAL_FILES = [
    "styles.css",
    "helpers-i18n.js",
    "helpers-toast.js",
    "helpers-export.js",
    "helpers-export-comprehensive.js",
    "i18n-zh.js",
    "i18n-en.js",
    "i18n-alert.js",
    "i18n-data.js",
    "app.js",  # app.js 放最后（依赖前面所有 helper）
]
DEFAULT_OUTPUT = ROOT / "RSD & 含量计算器_流动相版.html"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=None, help="输出路径（默认覆盖流动相版.html）")
    parser.add_argument("--title-suffix", default="（离线版）", help="<title> suffix")
    args = parser.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    out_path = Path(args.out) if args.out else DEFAULT_OUTPUT

    if not MAIN_HTML.exists():
        print(f"[FAIL] {MAIN_HTML} 不存在")
        return 1

    print("=" * 60)
    print("build_single_html.py — 生成新流动相版")
    print("=" * 60)

    # 1. 读主版 HTML
    print("\n--- Step 1: 读主版 HTML ---")
    main_text = MAIN_HTML.read_text(encoding="utf-8")
    print(f"  [+] 主版: {len(main_text):,} 字节")

    # 2. 读 11 个 local 资源
    print("\n--- Step 2: 读 local 资源 ---")
    resources = {}
    for fname in LOCAL_FILES:
        path = ROOT / fname
        if not path.exists():
            print(f"  [SKIP] {fname} 不存在")
            continue
        text = path.read_text(encoding="utf-8")
        resources[fname] = text
        print(f"  [+] {fname}: {len(text):,} 字节")

    # 3. inline styles.css → <style>
    print("\n--- Step 3: inline styles.css ---")
    if "styles.css" in resources:
        # 替换 <link rel="stylesheet" href="styles.css"> 为 <style>...</style>
        old_link = '<link rel="stylesheet" href="styles.css">'
        new_style = f"<style>\n/* === inline styles.css ({len(resources['styles.css'])} bytes) === */\n{resources['styles.css']}\n</style>"
        if old_link in main_text:
            main_text = main_text.replace(old_link, new_style, 1)
            print(f"  [+] styles.css inline ({len(resources['styles.css'])} bytes)")
        else:
            print(f"  [WARN] 找不到 {old_link}")

    # 4. inline i18n/helper/app.js → <script>
    print("\n--- Step 4: inline JS 资源 ---")
    inline_blocks = []
    for fname in LOCAL_FILES:
        if fname == "styles.css":
            continue
        if fname not in resources:
            continue
        text = resources[fname]
        # 用 <script> 包裹，避免内嵌代码与 inline 冲突
        block = (
            f"<script>\n"
            f"/* === inline {fname} ({len(text):,} bytes) === */\n"
            f"{text}\n"
            f"</script>"
        )
        # 替换 <script src="..."></script>
        old_script = f'<script src="{fname}"></script>'
        if old_script in main_text:
            main_text = main_text.replace(old_script, block, 1)
            print(f"  [+] {fname} inline ({len(text)} bytes)")
        else:
            print(f"  [WARN] 找不到 <script src=\"{fname}\">")
            inline_blocks.append(block)

    # 5. 修改 <title> + meta 标记
    print("\n--- Step 5: 标记流动相版 ---")
    if args.title_suffix:
        # 保留原 <title> 内容但加 suffix
        old_title = '<title data-i18n="appTitle">RSD & 含量计算器</title>'
        new_title = f'<title data-i18n="appTitle">RSD & 含量计算器{args.title_suffix}</title>'
        main_text = main_text.replace(old_title, new_title, 1)
        print(f"  [+] <title> 加 suffix: {args.title_suffix}")

    # 6. 写新文件
    print("\n--- Step 6: 写新流动相版 ---")
    out_path.write_text(main_text, encoding="utf-8")
    size = out_path.stat().st_size
    print(f"  [+] 输出: {out_path}")
    print(f"  [+] 大小: {size:,} 字节 ({size // 1024} KB)")
    print(f"  [+] mtime: {datetime.now().isoformat()}")

    print()
    print("=" * 60)
    print(f"完成: {out_path}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
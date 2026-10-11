#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
fix_markdown_warnings.py — 修复 markdownlint 警告（v54.284 SOP 落地）

目的：清理 tools/README.md / milestone 文件的 markdownlint MD031/MD032/MD040/MD047 警告。
        不影响功能，但 IDE markdownlint 提示更干净。

用法：
    python tools/fix_markdown_warnings.py <file.md> ...

修复：
    - MD060: 表格列前后加空格（紧凑格式）
    - MD031: ```代码块前后加空行
    - MD040: ```代码块加 language（默认 text）
    - MD032: 列表前后加空行
    - MD047: 文件末尾单 newline
"""
import re
import sys
from pathlib import Path


def fix_table_columns(text):
    """表格列前后加空格（MD060 compact style）"""
    lines = text.split("\n")
    out = []
    for i, line in enumerate(lines):
        if "|" in line and i + 1 < len(lines) and re.match(r"^\s*\|?[\s\-:|]+\|", lines[i + 1]):
            # 在表格行内，'|' 前后加空格
            line = re.sub(r"(\S)\|(\S)", r"\1 | \2", line)
            # 表格首尾 '|' 也加空格
            line = re.sub(r"^\s*\|", " | ", line)
            line = re.sub(r"\|\s*$", " | ", line)
        out.append(line)
    return "\n".join(out)


def fix_blank_around_fences(text):
    """``` 代码块前后加空行（MD031）"""
    lines = text.split("\n")
    out = []
    in_code = False
    for i, line in enumerate(lines):
        if line.strip().startswith("```"):
            if not in_code:
                # opening fence：检查前一行是否为空行
                if out and out[-1].strip() != "":
                    out.append("")
                # 添加语言标识（如果缺失）
                if line.strip() == "```":
                    out.append("```text")
                else:
                    out.append(line)
                in_code = True
            else:
                # closing fence：检查后一行是否为空行
                out.append(line)
                if i + 1 < len(lines) and lines[i + 1].strip() != "":
                    out.append("")
                in_code = False
        else:
            out.append(line)
    return "\n".join(out)


def fix_blank_around_lists(text):
    """列表前后加空行（MD032）"""
    lines = text.split("\n")
    out = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        # 列表项：- * + 或数字.
        is_list_item = bool(re.match(r"^(\s*[-*+]|\s*\d+\.)\s", line))
        # 缩进式列表项
        is_indent_list = bool(re.match(r"^\s{2,}[-*+]\s", line))
        if is_list_item:
            # 检查前一行是否需要空行
            if out and out[-1].strip() != "" and not re.match(r"^\s*[-*+]", out[-1]) and not re.match(r"^\s*\d+\.", out[-1]):
                out.append("")
            out.append(line)
        elif is_indent_list:
            out.append(line)
        else:
            out.append(line)
    # 后处理：如果列表结束后下一行不是空行，插入空行
    final = []
    for i, line in enumerate(out):
        final.append(line)
        # 列表结束后插空行
        if (
            re.match(r"^\s*[-*+]\s", line)
            and i + 1 < len(out)
            and out[i + 1].strip() != ""
            and not re.match(r"^\s*[-*+]", out[i + 1])
            and not re.match(r"^\s*\d+\.", out[i + 1])
        ):
            final.append("")
    return "\n".join(final)


def fix_trailing_newline(text):
    """文件末尾单 newline（MD047）"""
    return text.rstrip("\n") + "\n"


def fix_file(path):
    text = path.read_text(encoding="utf-8")
    original = text
    text = fix_table_columns(text)
    text = fix_blank_around_fences(text)
    text = fix_blank_around_lists(text)
    text = fix_trailing_newline(text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python tools/fix_markdown_warnings.py <file.md> [...]")
        sys.exit(1)
    changed = 0
    for fname in sys.argv[1:]:
        p = Path(fname)
        if not p.exists():
            print(f"  [SKIP] not found: {fname}")
            continue
        if fix_file(p):
            print(f"  [FIX] {fname}")
            changed += 1
        else:
            print(f"  [ok] {fname} (无变化)")
    print(f"\nTotal: {changed} files fixed")


if __name__ == "__main__":
    main()
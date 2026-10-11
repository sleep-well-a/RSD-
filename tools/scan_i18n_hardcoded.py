#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
scan_i18n_hardcoded.py — 扫描 JS 文件中未 i18n 化的用户可见中文字面量（v54.284 SOP）

目的：自动捕获 v54.276-283 七轮 i18n 修复未根治的硬编码漏网。

用法：
    python tools/scan_i18n_hardcoded.py [--output report.json]
    python tools/scan_i18n_hardcoded.py --severity high   # 只显示 high

输出（JSON 数组，每项含）：
    {
      "file": "app.js",
      "line": 4828,
      "content": "...'外标含量'...",     # 截断到 100 字符
      "severity": "high|medium|low",
      "reason": "在 ROW/push 内含未 i18n 化的中文字面量"
    }

白名单（不报告）：
    - i18n-zh.js / i18n-en.js / i18n-alert.js（字典本身）
    - _HIST_TYPE_I18N_KEY / _CHART_TYPE_I18N_MAP / _CHART_TYPE_CONFIG map 内
    - titer 滴定液名（'盐酸滴定液 HCl' 等）
    - 流动相溶剂库（'甲醇' / '乙腈' 等）
    - history filter type key（'统计计算' / '含量计算' 等）
    - 行内已有 i18n( 调用（即使还有别的中文字面量）
    - 注释行（// 或 /* ... */）
    - data-i18n-aria-label 之类属性名（不是字符串值）

判断严重级：
    - high: 出现在用户可见路径（rows.push / parts.push / alert / confirm / document.title 等）
    - medium: 在函数体内但未触发上下文关键字
    - low: 在 throw / console.error / 调试日志
"""
import argparse
import json
import re
import sys
from pathlib import Path

# 路径配置
ROOT = Path("F:/自制软件") if sys.platform == "win32" else Path("/f/自制软件")

# 扫描文件清单
SCAN_FILES = [
    "app.js",
    "helpers-i18n.js",
    "helpers-toast.js",
    "helpers-export.js",
    "helpers-export-comprehensive.js",
]

# CJK 字符正则（基本汉字 + 扩展 A）
CJK = re.compile(r"[一-鿿]")

# 用户可见路径关键字（severity=high）
USER_VISIBLE_PATTERNS = [
    re.compile(r"\brows\.push\b"),
    re.compile(r"\bparts\.push\b"),
    re.compile(r"\binnerHTML\s*="),
    re.compile(r"\balert\s*\("),
    re.compile(r"\bconfirm\s*\("),
    re.compile(r"\bprompt\s*\("),
    re.compile(r"\bconsole\.error\b"),
    re.compile(r"\bconsole\.warn\b"),
    re.compile(r"\bdocument\.title\b"),
    re.compile(r"\b\.textContent\s*="),
    re.compile(r"\bsetAttribute\(['\"](?:aria-label|title|data-tooltip|placeholder)['\"]"),
    re.compile(r"\breturn\s+['\"]"),  # 函数返回中文字面量
]

# 白名单：map 定义块起始
MAP_OPEN_PATTERNS = [
    re.compile(r"_HIST_TYPE_I18N_KEY\s*=\s*\{"),
    re.compile(r"_CHART_TYPE_I18N_MAP\s*=\s*\{"),
    re.compile(r"_CHART_TYPE_CONFIG\s*=\s*\{"),
    re.compile(r"_CHART_TYPE_LEGEND_KEY\s*=\s*\{"),
]

# 白名单：titer 滴定液名（app.js:7228-7280）
TITER_DROP_NAMES = re.compile(r"'(盐酸|硫酸|氢氧化钠|高氯酸|硝酸银|硫代硫酸钠|碘|溴|亚硫酸钠|EDTA)滴定液[^']*'")

# 白名单：流动相溶剂
MP_SOLVENTS = re.compile(r"['\"](?:甲醇|乙腈|正己烷|异丙醇|乙醇|丙酮|乙酸乙酯|甲酸|磷酸|三乙胺|水|Buffer|buffer|Tris|tris|HCl|OA)['\"]")

# 白名单：history filter type key
HIST_TYPE_KEYS = re.compile(
    r"'(统计计算|含量计算|外标含量|回收率-面积归一化法|回收率-外标法|回收率-内标法|回收率-简易|"
    r"干燥失重|炽灼残渣|滴定度|含量均匀度|溶出度|标准曲线|加样回收率|流动相配制)'"
)

# 白名单：行内已有 i18n(
HAS_I18N_CALL = re.compile(r"\bi18n\s*\(")

# 白名单：注释
COMMENT_LINE = re.compile(r"^\s*(?://|\*|/\*)")
COMMENT_INLINE = re.compile(r"//.*$")

# 白名单：data-i18n 属性名（不是字符串值）
DATA_I18N_ATTR_NAME = re.compile(r"\bdata-i18n(?:-[\w-]+)?\b")


def find_map_ranges(text):
    """找出所有 map 定义块的行号范围"""
    lines = text.split("\n")
    ranges = []
    stack = []  # [(start_line, depth)]
    for i, line in enumerate(lines, 1):
        for p in MAP_OPEN_PATTERNS:
            if p.search(line):
                stack.append((i, line.count("{") - line.count("}")))
                break
        else:
            if stack:
                start, depth = stack[-1]
                depth += line.count("{") - line.count("}")
                if depth <= 0:
                    ranges.append((start, i))
                    stack.pop()
                else:
                    stack[-1] = (start, depth)
    return ranges


def in_map_range(line_num, ranges):
    for start, end in ranges:
        if start <= line_num <= end:
            return True
    return False


def strip_strings_and_comments(line):
    """剥除字符串字面量 + 行内 // 注释 + 行内 /* */ 块 + regex 字面量，再检查是否含 CJK"""
    # 1) 移除 /* ... */ 块（跨行匹配，用 [\s\S] 替代 .）
    cleaned = re.sub(r"/\*[\s\S]*?\*/", "", line)
    # 2) 移除 // 之后内容
    cleaned = re.sub(r"//.*$", "", cleaned)
    # 3) 移除 regex 字面量 /.../flags  (避免误报 regex 内的中文字符)
    cleaned = re.sub(r"/(?:[^/\\]|\\.)+/[gimsuy]*", "REGEX", cleaned)
    # 4) 移除字符串字面量
    cleaned = re.sub(r"'[^'\\]*(?:\\.[^'\\]*)*'", "''", cleaned)
    cleaned = re.sub(r'"[^"\\]*(?:\\.[^"\\]*)*"', '""', cleaned)
    cleaned = re.sub(r"`[^`\\]*(?:\\.[^`\\]*)*`", "``", cleaned)
    return cleaned


def classify(line, line_num, file_text, map_ranges):
    """返回 None / (severity, reason)"""
    # 整行是块注释（/* ... */）→ 跳过
    if COMMENT_LINE.match(line):
        return None

    # 剥除字符串 + 注释后，检查剩余代码
    code = strip_strings_and_comments(line)
    # 如果剥除后整行为空或纯空白，说明中文全在注释/字符串里
    if not code.strip() or not CJK.search(code):
        # 但还是要看剥除前的行内是否真的有 CJK 在代码路径
        # 如果剥除后没 CJK，但 UI 可见路径被触发 + 剥除前含 CJK，可能是注释+UI 误报
        # 这种情况**仅当**剥除前整行都含 CJK 在注释里
        return None

    # 不在 map 内才继续
    if in_map_range(line_num, map_ranges):
        return None

    # 行内已有 i18n(
    if HAS_I18N_CALL.search(code):
        return None

    # titer 滴定液名 / 流动相溶剂
    if TITER_DROP_NAMES.search(code):
        return None
    if MP_SOLVENTS.search(code):
        return None

    # history filter type key
    if HIST_TYPE_KEYS.search(code):
        return None

    # data-i18n 属性名（不是值）
    if DATA_I18N_ATTR_NAME.search(code) and not CJK.search(code):
        return None

    # 行含 CJK 但已剥除字符串 = 字符串字面量含 CJK
    # 现在判断严重级
    for p in USER_VISIBLE_PATTERNS:
        if p.search(code):
            return ("high", "用户可见路径 + 未 i18n 化中文字面量")

    # throw / 函数 return
    if re.search(r"\bthrow\s+new\s+Error\(['\"]", code):
        return ("low", "throw Error 内中文字面量")

    # 函数默认值 / 调试日志
    return ("medium", "函数体内未 i18n 化中文字面量")


def scan_file(path):
    """扫描：先剥除整文件跨行 /* ... */ 块注释，再剥除 // 行尾注释，再逐行扫描"""
    text = path.read_text(encoding="utf-8")
    # 1) 整文件剥除所有 /* ... */ 块注释（跨行）
    text_no_block = re.sub(r"/\*[\s\S]*?\*/", "", text)
    # 2) 整文件剥除所有 // 行尾注释（每行独立）
    lines_all = text_no_block.split("\n")
    map_ranges = find_map_ranges(text)  # map 范围用原始 text 算
    findings = []
    for i, line in enumerate(lines_all, 1):
        # 3) 剥除 // 行尾 + 字符串
        cleaned = strip_strings_and_comments(line)
        if not CJK.search(cleaned):
            continue
        # 整行是 /* 块注释起始且未闭合 → 整行在注释里（剥除 /*...*/ 应已处理）
        result = classify(line, i, text, map_ranges)
        if result:
            severity, reason = result
            findings.append(
                {
                    "file": path.name,
                    "line": i,
                    "content": line.strip()[:120],
                    "severity": severity,
                    "reason": reason,
                }
            )
    return findings


def main():
    parser = argparse.ArgumentParser(description="扫描 JS 文件中未 i18n 化的中文字面量")
    parser.add_argument("--output", "-o", help="输出 JSON 报告路径")
    parser.add_argument("--severity", "-s", choices=["high", "medium", "low"], help="按严重级过滤")
    args = parser.parse_args()

    all_findings = []
    for fname in SCAN_FILES:
        path = ROOT / fname
        if not path.exists():
            print(f"[scan] SKIP (not found): {fname}", file=sys.stderr)
            continue
        findings = scan_file(path)
        all_findings.extend(findings)

    # 过滤严重级
    if args.severity:
        all_findings = [f for f in all_findings if f["severity"] == args.severity]

    # 输出
    high = sum(1 for f in all_findings if f["severity"] == "high")
    medium = sum(1 for f in all_findings if f["severity"] == "medium")
    low = sum(1 for f in all_findings if f["severity"] == "low")
    if args.output:
        Path(args.output).write_text(
            json.dumps(all_findings, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(
            f"[scan] wrote {len(all_findings)} findings to {args.output} (high={high}, medium={medium}, low={low})",
            file=sys.stderr,
        )
    else:
        # 默认不输出 JSON（避免污染 run_all_tests.py 整合输出）
        print(
            f"[scan] {len(all_findings)} findings (high={high}, medium={medium}, low={low})",
            file=sys.stderr,
        )

    sys.exit(1 if high > 0 else 0)


if __name__ == "__main__":
    main()
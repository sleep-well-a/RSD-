#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
scan_html_typos.py — 扫 HTML 文件中三类常见 typo / 死代码（v54.284 SOP）

目的：自动捕获 v54.271/281 `<th scope="col"ead">` typo + v54.256 `data-i18n` 死代码 + a11y 判据陷阱。

用法：
    python tools/scan_html_typos.py [--output report.json]
    python tools/scan_html_typos.py --target html    # 只扫 HTML
    python tools/scan_html_typos.py --target js      # 只扫 JS

输出（JSON 数组，每项含）：
    {
      "file": "RSD & 含量计算器.html",
      "line": 1234,
      "issue": "invalid_th_scope|dead_data_i18n|aria_label_trap",
      "snippet": "<th scope=\"colhead\">...",
      "fix_suggestion": "改 scope 为 col/row/colgroup/rowgroup"
    }

扫描规则：
    1. invalid_th_scope: <th scope="..."> 中值不在 {col, row, colgroup, rowgroup}
    2. dead_data_i18n: JavaScript 字符串字面量内的 data-i18n 属性（v54.256 教训：_applyI18n 只扫 live DOM）
    3. aria_label_trap: <el data-i18n-aria-label="..."> 而非 aria-label="..."（'aria-label' in tag 误判为有 aria-label）
"""
import argparse
import json
import re
import sys
from pathlib import Path

# 路径配置
ROOT = Path("F:/自制软件") if sys.platform == "win32" else Path("/f/自制软件")

# 扫描文件
HTML_FILES = [
    "RSD & 含量计算器.html",
    "RSD & 含量计算器_流动相版.html",
]
JS_FILES = [
    "app.js",
    "helpers-i18n.js",
    "helpers-toast.js",
    "helpers-export.js",
    "helpers-export-comprehensive.js",
]

# 合法 scope 值
VALID_SCOPE = {"col", "row", "colgroup", "rowgroup"}

# 匹配 <th scope="..."> (容忍大小写 + 多种空格)
TH_SCOPE_RE = re.compile(
    r'<th\b[^>]*?\bscope\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)

# 匹配 data-i18n 属性（动态 HTML 字符串内）
DATA_I18N_ATTR_RE = re.compile(r'\bdata-i18n(?:-[\w-]+)?\s*=\s*["\'][^"\']*["\']')

# 匹配 aria-label 但内容含 data-i18n 字面（判据陷阱）
ARIA_TRAP_RE = re.compile(
    r'<(?P<tag>\w+)[^>]*?\b(?:aria-label|data-i18n-aria-label)\s*=\s*["\'](?P<val>[^"\']*)["\']',
    re.IGNORECASE,
)


def scan_html_file(path):
    findings = []
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    for i, line in enumerate(lines, 1):
        # Rule 1: invalid scope
        for m in TH_SCOPE_RE.finditer(line):
            scope = m.group(1).strip().lower()
            if scope not in VALID_SCOPE:
                findings.append(
                    {
                        "file": path.name,
                        "line": i,
                        "issue": "invalid_th_scope",
                        "snippet": m.group(0)[:120],
                        "fix_suggestion": f"改 scope 为 {sorted(VALID_SCOPE)} 之一（v54.271/281 教训）",
                    }
                )
        # Rule 3: aria-label trap
        for m in ARIA_TRAP_RE.finditer(line):
            attr_val = m.group("val")
            tag = m.group("tag").lower()
            # 检查同 tag 行内是否同时含 aria-label/data-i18n-aria-label
            lower_line = line.lower()
            has_aria_label = 'aria-label=' in lower_line
            has_data_i18n_aria = 'data-i18n-aria-label=' in lower_line
            # 如果行只有 data-i18n-aria-label 而无 aria-label 且 val 非空 → 陷阱
            if has_data_i18n_aria and not has_aria_label and attr_val and not attr_val.startswith("aria"):
                # val 是形如 "ariaXxx" 实际指向 i18n key
                findings.append(
                    {
                        "file": path.name,
                        "line": i,
                        "issue": "aria_label_trap",
                        "snippet": m.group(0)[:120],
                        "fix_suggestion": "data-i18n-aria-label 不是真正的 aria-label；'aria-label' in tag 会误判（v54.256 教训）",
                    }
                )
    return findings


def scan_js_file(path):
    """扫 JS 文件中的 export 函数体内 data-i18n（v54.256/277 教训）

    注意：data-i18n 在动态 HTML 字符串中是否生效，取决于该字符串是否注入 live DOM。
    live DOM 注入（innerHTML = ...）会被 _applyI18n 扫到；导出 PDF/HTML 报告则不会。
    静态分析无法可靠区分这两种情况，所以这里只扫描明确的 export 函数。
    """
    findings = []
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    # 已知的 export 函数
    EXPORT_FN_NAMES = [
        "_generatePDFReport",
        "exportComprehensiveReport",
        "exportHistoryXlsx",
        "exportHistoryPDF",
        "exportCVExcel",
        "buildDryingReport",
        "buildResidueReport",
        "buildUniformityReport",
        "buildDissolutionReport",
        "buildSpikeReport",
    ]
    NEXT_FN_RE = re.compile(
        r"^(?:async\s+)?function\s+\w+\s*\(|^\w[\w.]*\s*=\s*function\b|^(?:async\s+)?\w[\w.]*\s*=\s*\(.*?\)\s*=>\s*\{"
    )
    # 找 export 函数体范围（用下一个函数定义作为边界）
    export_ranges = []
    for i, line in enumerate(lines, 1):
        for fn in EXPORT_FN_NAMES:
            pat = re.compile(
                rf"^(?:async\s+)?function\s+{re.escape(fn)}\s*\(|"
                rf"^{re.escape(fn)}\s*=\s*function\b|"
                rf"^{re.escape(fn)}\s*=\s*\(.*?\)\s*=>\s*\{{"
            )
            if pat.search(line):
                end = len(lines)
                for j in range(i, len(lines)):
                    if j + 1 > i + 5 and NEXT_FN_RE.match(lines[j]):
                        end = j + 1
                        break
                export_ranges.append((fn, i, end))
                break
    if not export_ranges:
        return findings
    # 在 export 函数体内扫 data-i18n
    for fn, start, end in export_ranges:
        for i in range(start, end + 1):
            line = lines[i - 1]
            no_inline_comment = re.sub(r"//.*$", "", line)
            for _ in re.finditer(r"\bdata-i18n(?:-\w+)?\s*=", no_inline_comment):
                findings.append(
                    {
                        "file": path.name,
                        "line": i,
                        "issue": "dead_data_i18n_in_export",
                        "snippet": line.strip()[:120],
                        "fix_suggestion": f"在 {fn} 函数内：data-i18n 不会生效（_applyI18n 只扫 live DOM）。改用 _esc(i18n('key'))（v54.256/277 教训）",
                    }
                )
    return findings


def main():
    parser = argparse.ArgumentParser(description="扫 HTML / JS 中 typo + 死代码 + a11y 陷阱")
    parser.add_argument("--output", "-o", help="输出 JSON 报告路径")
    parser.add_argument("--target", "-t", choices=["html", "js", "all"], default="all", help="扫描目标")
    args = parser.parse_args()

    findings = []
    if args.target in ("html", "all"):
        for fname in HTML_FILES:
            p = ROOT / fname
            if not p.exists():
                print(f"[scan] SKIP (not found): {fname}", file=sys.stderr)
                continue
            findings.extend(scan_html_file(p))
    if args.target in ("js", "all"):
        for fname in JS_FILES:
            p = ROOT / fname
            if not p.exists():
                print(f"[scan] SKIP (not found): {fname}", file=sys.stderr)
                continue
            findings.extend(scan_js_file(p))

    if args.output:
        Path(args.output).write_text(
            json.dumps(findings, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        counts = {}
        for f in findings:
            counts[f["issue"]] = counts.get(f["issue"], 0) + 1
        print(
            f"[scan] wrote {len(findings)} findings to {args.output} ({', '.join(f'{k}={v}' for k, v in counts.items())})",
            file=sys.stderr,
        )
    else:
        # 默认不输出 JSON（避免污染 run_all_tests.py 整合输出）
        counts = {}
        for f in findings:
            counts[f["issue"]] = counts.get(f["issue"], 0) + 1
        print(
            f"[scan] {len(findings)} findings ({', '.join(f'{k}={v}' for k, v in counts.items())})",
            file=sys.stderr,
        )

    sys.exit(1 if any(f["issue"] == "invalid_th_scope" for f in findings) else 0)


if __name__ == "__main__":
    main()
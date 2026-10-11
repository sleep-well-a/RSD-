#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
audit_a11y_aria.py — 扫 HTML / JS 文件中 aria-label 判据陷阱（v54.256 教训）

目的：捕获 "'aria-label' in tag" 误判 — data-i18n-aria-label 不是真正的 aria-label 属性
        （v54.256 / v54.282 Round 38 教训）

用法：
    python tools/audit_a11y_aria.py [--output report.json] [--target html|js|all]

输出（JSON 数组，每项含）：
    {
      "file": "RSD & 含量计算器.html",
      "line": 1234,
      "element": "<button>",
      "has_aria_label_attr": false,
      "has_data_i18n_aria_label_attr": true,
      "has_readable_text": true,
      "risk": "low|medium|high",
      "snippet": "..."
    }

扫描规则：
    1. 元素仅有 data-i18n-aria-label 而无 aria-label → 低风险（_applyIson 会翻译）
    2. 元素有 data-i18n-aria-label 但无任何可读文本/aria-label → 中风险（SR 用户听不到）
    3. 元素在 critical UI 路径（button/icon-only）无 aria-label → 高风险

白名单：
    - 自包含 _流动相版.html（无 i18n 体系）
    - 不扫 data-i18n-* 在纯 live DOM 注入路径（_applyIson 已处理）
"""
import argparse
import json
import re
import sys
from pathlib import Path

# 路径配置
ROOT = Path("F:/自制软件") if sys.platform == "win32" else Path("/f/自制软件")

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

# 匹配 <el ...attrs> (greedy until >)
ELEM_RE = re.compile(r"<(\w+)([^>]*)>", re.IGNORECASE)
# 提取属性 (简化：attr=value 形式，容忍引号/无引号)
ATTR_RE = re.compile(
    r"""(?P<name>[\w-]+)\s*=\s*(?:"(?P<dq>[^"]*)"|'(?P<sq>[^']*)'|(?P<uq>[^\s>]*))""",
    re.IGNORECASE,
)


def analyze_element(tag_name: str, attrs_str: str, line: str) -> dict | None:
    """分析一个元素的 aria 属性，返回风险报告或 None"""
    attrs = {}
    for m in ATTR_RE.finditer(attrs_str):
        name = m.group("name").lower()
        val = m.group("dq") if m.group("dq") is not None else (
            m.group("sq") if m.group("sq") is not None else (
                m.group("uq") if m.group("uq") is not None else ""
            )
        )
        attrs[name] = val
    has_aria_label = "aria-label" in attrs
    has_data_i18n_aria = "data-i18n-aria-label" in attrs
    has_data_i18n = "data-i18n" in attrs
    has_text = any(
        attrs.get(a)
        for a in [
            "title",
            "placeholder",
            "alt",
        ]
    )
    has_inner_text_check = bool(attrs.get("data-i18n", "").strip()) or bool(attrs.get("data-i18n-placeholder", "").strip())

    # 风险评估
    risk = None
    reason = None
    # Rule 1: 仅有 data-i18n-aria-label 无 aria-label（_applyIson 会翻译，**不一定是问题**）
    if has_data_i18n_aria and not has_aria_label:
        risk = "low"
        reason = "仅有 data-i18n-aria-label，无 aria-label — _applyIson 会翻译；'aria-label' in tag 会误判"
    # Rule 2: 既无 aria-label 也无 data-i18n-aria-label
    elif not has_aria_label and not has_data_i18n_aria:
        # button / icon-only 风险更高
        if tag_name.lower() in ("button", "a") and not has_text and not has_inner_text_check:
            risk = "high"
            reason = f"<{tag_name}> 无 aria-label 且无可读文本/icon-only"
        elif tag_name.lower() in ("input", "select", "textarea") and not has_text and not has_inner_text_check:
            risk = "medium"
            reason = f"<{tag_name}> 无 aria-label，无 placeholder/title"
    return {
        "has_aria_label": has_aria_label,
        "has_data_i18n_aria": has_data_i18n_aria,
        "has_data_i18n": has_data_i18n,
        "has_text": has_text,
        "risk": risk,
        "reason": reason,
    } if risk else None


def scan_html_file(path):
    findings = []
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    # 跳过 _流动相版.html（无 i18n 体系）
    if "流动相版" in path.name:
        return findings
    for i, line in enumerate(lines, 1):
        for m in ELEM_RE.finditer(line):
            tag = m.group(1)
            attrs_str = m.group(2)
            analysis = analyze_element(tag, attrs_str, line)
            if analysis:
                findings.append(
                    {
                        "file": path.name,
                        "line": i,
                        "element": f"<{tag}>",
                        **analysis,
                        "snippet": m.group(0)[:140],
                    }
                )
    return findings


def _extract_inner_text(elem_text: str) -> str:
    """提取 element 内文（> 与 </tag> 之间）"""
    # 找第一个 > 和最后 </tag>
    open_end = elem_text.find(">")
    close_idx = elem_text.lower().rfind("</")
    if open_end < 0 or close_idx < 0 or close_idx < open_end:
        return ""
    return elem_text[open_end + 1:close_idx]


def _has_i18n_or_text(inner: str) -> bool:
    """内文含 _iXxx hoist 变量 / i18n( 调用 / 任意非空白字符 → true"""
    if not inner.strip():
        return False
    # 容忍：_iXxx + i18n( + 任意 i18n 调用过的字面量
    if re.search(r"\b_i[A-Z]\w*\b", inner):
        return True
    if re.search(r"\bi18n\s*\(", inner):
        return True
    # 含中文字符
    if re.search(r"[一-鿿]", inner):
        return True
    # 含非空白 ASCII（按钮文本）
    if re.search(r"[A-Za-z0-9]", inner):
        return True
    return False


def scan_js_file(path):
    """扫 JS 文件中字符串字面量内的 HTML 元素属性（同 scan_html_typos 模式）

    关注：
    - innerHTML = '...' 中的 <button>/<a>/<input> 无 aria-label
    """
    findings = []
    text = path.read_text(encoding="utf-8")
    # 剥除 /* ... */ 块
    text_no_block = re.sub(r"/\*[\s\S]*?\*/", "", text)
    lines = text_no_block.split("\n")
    # 累积 line offsets（用于把绝对位置转回行号）
    line_offsets = [0]
    for line in lines:
        line_offsets.append(line_offsets[-1] + len(line) + 1)  # +1 for \n
    def abs_to_line(pos):
        for i, off in enumerate(line_offsets):
            if off > pos:
                return i  # 1-indexed
        return len(lines)
    STRING_RE = re.compile(r"""('[^'\\]*(?:\\.[^'\\]*)*'|"[^"\\]*(?:\\.[^"\\]*)*"|`[^`\\]*(?:\\.[^`\\]*)*`)""")
    for m in STRING_RE.finditer(text_no_block):
        s_start = m.start()
        s = m.group(0)
        # 在字符串里找 <tag>...</tag> 完整块（含 inner text，跨行）
        # 用非贪婪跨行匹配
        elem_re = re.compile(
            r"<(\w+)\b([^>]*)>([\s\S]*?)</\1>",
            re.IGNORECASE,
        )
        for em in elem_re.finditer(s):
            tag = em.group(1)
            attrs_str = em.group(2)
            inner = em.group(3)
            # 仅报告关键元素（button/a/input）
            if tag.lower() not in ("button", "a", "input"):
                continue
            # 检查内文是否有 i18n 化文本
            if _has_i18n_or_text(inner):
                # 已有可读文本，可豁免 aria-label 要求
                continue
            analysis = analyze_element(tag, attrs_str, s)
            if analysis:
                line_no = abs_to_line(s_start + em.start())
                findings.append(
                    {
                        "file": path.name,
                        "line": line_no,
                        "element": f"<{tag}>",
                        **analysis,
                        "snippet": em.group(0)[:140],
                    }
                )
    return findings


def main():
    parser = argparse.ArgumentParser(description="扫 aria-label 判据陷阱")
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
        counts = {"high": 0, "medium": 0, "low": 0}
        for f in findings:
            counts[f["risk"]] = counts.get(f["risk"], 0) + 1
        print(
            f"[scan] wrote {len(findings)} findings to {args.output} (high={counts['high']}, medium={counts['medium']}, low={counts['low']})",
            file=sys.stderr,
        )
    else:
        # 默认不输出 JSON（避免污染 run_all_tests.py 整合输出）
        counts = {"high": 0, "medium": 0, "low": 0}
        for f in findings:
            counts[f["risk"]] = counts.get(f["risk"], 0) + 1
        print(
            f"[scan] {len(findings)} findings (high={counts['high']}, medium={counts['medium']}, low={counts['low']})",
            file=sys.stderr,
        )

    sys.exit(1 if counts["high"] > 0 else 0)


if __name__ == "__main__":
    main()
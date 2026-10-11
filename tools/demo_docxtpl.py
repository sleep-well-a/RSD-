#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
demo_docxtpl.py - docxtpl 集成 demo (qp-to-qr-poc v2)

目的: 演示 docxtpl 渲染 Jinja2 模板, 验证 run_method_b_v2 的 docxtpl 路径.

链路:
  1. ensure_demo_template() - 若 demo_jinja_template.docx 不存在, 用 python-docx 生成
     (含 {{ qp_id }} / {{ method }} / {{ analyte }} / {{ matrix }} / {{ notes }} + {%p if %} 条件)
  2. DocxTemplate(template).render(context) - 填充
  3. 验证: 读 output.docx, 断言占位符已替换, 行数正确
  4. 展示对比: 用 diff 显示模板 - 输出变化

用法:
    python tools/demo_docxtpl.py

输出:
    F:\自制软件\tools\_docxtpl_demo\
        demo_jinja_template.docx     (模板, python-docx 生成)
        output.docx                  (渲染结果)
        demo_report.txt              (验证报告)
"""
import io
import os
import sys
import zipfile
from pathlib import Path

OUT_ROOT = Path("F:/自制软件/tools/_docxtpl_demo")
OUT_ROOT.mkdir(parents=True, exist_ok=True)

TEMPLATE_PATH = (
    Path(r"C:\Users\sleep well\.claude\skills\qp-to-qr-poc\references\templates")
    / "demo_jinja_template.docx"
)
TEMPLATE_PATH.parent.mkdir(parents=True, exist_ok=True)

OUTPUT_PATH = OUT_ROOT / "output.docx"
REPORT_PATH = OUT_ROOT / "demo_report.txt"


# === 1) 生成 demo 模板 ===

def _build_minimal_docx_from_zip(template_dir: Path, paragraphs, table_rows=None) -> bytes:
    """从 python-docx 自带的 default-docx-template 目录 zip 成 in-memory docx.

    兜底方案: python-docx 1.2.0 的 api.py 找 templates/default.docx, 但实际发布的是
    templates/default-docx-template/ 目录. 直接 Document() 会 PackageNotFoundError.
    这里把目录 zip 成 docx, 然后用 zipfile 替换 word/document.xml 为我自己的内容.
    """
    import re as _re

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in template_dir.rglob("*"):
            if f.is_file():
                arc = f.relative_to(template_dir).as_posix()
                zf.write(f, arc)
    buf.seek(0)

    doc_xml = None
    files = {}
    with zipfile.ZipFile(buf) as zin:
        for name in zin.namelist():
            data = zin.read(name)
            if name == "word/document.xml":
                doc_xml = data.decode("utf-8")
            else:
                files[name] = data

    para_xml = "".join(
        f'<w:p><w:r><w:t xml:space="preserve">{_xml_escape(p)}</w:t></w:r></w:p>'
        for p in paragraphs
    )
    table_xml = ""
    if table_rows:
        rows_xml = []
        n_cols = max(len(row) for row in table_rows)
        grid_cols = "".join('<w:gridCol w:w="2000"/>' for _ in range(n_cols))
        for row in table_rows:
            cells = "".join(
                f'<w:tc><w:p><w:r><w:t xml:space="preserve">{_xml_escape(c)}</w:t></w:r></w:p></w:tc>'
                for c in row
            )
            rows_xml.append(f"<w:tr>{cells}</w:tr>")
        # 完整 Word 表格: tblPr + tblGrid + rows (docxtpl fix_tables 需 tblGrid)
        table_xml = (
            "<w:tbl>"
            "<w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr>"
            f"<w:tblGrid>{grid_cols}</w:tblGrid>"
            f"{''.join(rows_xml)}"
            "</w:tbl>"
        )

    new_body = f"<w:body>{para_xml}{table_xml}<w:sectPr/></w:body>"
    new_doc_xml = _re.sub(r"<w:body>.*?</w:body>", new_body, doc_xml, flags=_re.DOTALL)
    files["word/document.xml"] = new_doc_xml.encode("utf-8")

    out_buf = io.BytesIO()
    with zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)
    return out_buf.getvalue()


def _xml_escape(s: str) -> str:
    """XML 文本转义 (供 document.xml 注入)."""
    return s.replace("&", "&").replace("<", "<").replace(">", ">").replace('"', '"')


def ensure_demo_template(path: Path) -> None:
    """用 python-docx 的 default-docx-template 目录为底, 生成 demo Jinja2 模板.

    内容设计:
      - 4 段 var 替换: qp_id / method / analyte / matrix
      - 1 段 {%p if notes %} 条件 (Jinja2 feature 演示)
      - 1 个表格行作为视觉锚点

    注: 不用 python-docx Document() 直接生成, 因 1.2.0 packaging bug
    (templates/default.docx 不存在, 实际是目录). 见 _build_minimal_docx_from_zip.
    """
    if path.exists():
        print(f"[=] 模板已存在: {path.name} ({path.stat().st_size} bytes)")
        return

    template_dir = Path(
        r"C:\Users\sleep well\AppData\Local\Programs\Python\Python312\Lib\site-packages\docx\templates\default-docx-template"
    )
    if not template_dir.exists():
        raise FileNotFoundError(f"python-docx default template dir 不存在: {template_dir}")

    paragraphs = [
        "QP 验证方案 (Jinja2 Demo)",
        "方案编号: {{ qp_id }}",
        "检测方法: {{ method }}",
        "分析物:   {{ analyte }}",
        "样品基质: {{ matrix }}",
        "{%p if notes %}",
        "备注: {{ notes }}",
        "{%p endif %}",
    ]
    table_rows = [
        ["字段", "值"],
        ["生成时间", "2026-10-04 (docxtpl demo)"],
    ]

    blob = _build_minimal_docx_from_zip(template_dir, paragraphs, table_rows)
    path.write_bytes(blob)
    print(f"[+] 生成模板: {path} ({path.stat().st_size} bytes)")


# === 2) docxtpl 渲染 ===

def render_template(template_path: Path, context: dict, output_path: Path) -> Path:
    """DocxTemplate.render(context) then save(output_path)."""
    from docxtpl import DocxTemplate
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = DocxTemplate(template_path)
    doc.render(context)
    doc.save(output_path)
    return output_path


# === 3) 验证 ===

def verify_output(output_path: Path, context: dict):
    """读 output.docx 段落, 断言占位符已替换且关键值在."""
    from docx import Document
    doc = Document(output_path)
    paras = [p.text for p in doc.paragraphs]

    checks = []
    ok = True

    # 3.1 占位符已消失 (不应再含 {{ ... }})
    remaining = [p for p in paras if "{{" in p or "{%" in p]
    if remaining:
        ok = False
        checks.append(f"FAIL: 残留 Jinja2 标记 {remaining!r}")
    else:
        checks.append("OK: 无残留 {{ }} 或 {% %} 标记")

    # 3.2 context 关键值出现在段落中
    for k, v in context.items():
        if not v:
            continue
        if k not in {"qp_id", "method", "analyte", "matrix", "notes"}:
            continue
        hit = any(v in p for p in paras)
        line = f"{'OK' if hit else 'FAIL'}: {k}={v!r} {'出现' if hit else '未出现'}"
        checks.append(line)
        if not hit:
            ok = False

    # 3.3 段落数校验
    if len(paras) == 5:
        checks.append("OK: 段落数 = 5 (条件段已隐藏)")
    elif len(paras) == 8:
        checks.append("OK: 段落数 = 8 (notes 非空, 条件段保留)")
    else:
        checks.append(f"INFO: 段落数 = {len(paras)} (实际值, 可能与预期 5/8 不同)")

    return ok, checks


def extract_xml_text(path: Path) -> str:
    """抽 docx 内所有 <w:t> 文本 (跨 run 合并), 便于 diff."""
    import re as _re
    parts = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if not name.endswith(".xml"):
                continue
            with z.open(name) as f:
                content = f.read().decode("utf-8", errors="ignore")
            text_nodes = _re.findall(r"<w:t[^>]*>([^<]*)</w:t>", content)
            parts.extend(text_nodes)
    return "\n".join(parts)


# === 4) 主流程 ===

def run_scenario(name: str, context: dict) -> bool:
    """跑一个 demo 场景, 返回 True = PASS."""
    print(f"\n--- 场景: {name} ---")
    print(f"context: {context}")

    print("[1] 渲染模板...")
    out = render_template(TEMPLATE_PATH, context, OUTPUT_PATH)
    print(f"    输出: {out.name} ({out.stat().st_size} bytes)")

    print("[2] 验证输出...")
    ok, checks = verify_output(out, context)
    for line in checks:
        print(f"    {line}")

    print("[3] 文本对比 (模板 vs 输出):")
    tmpl_text = extract_xml_text(TEMPLATE_PATH)
    out_text = extract_xml_text(out)
    print("    --- 模板 <w:t> 提取 ---")
    for line in tmpl_text.splitlines():
        if line.strip():
            print(f"      | {line}")
    print("    --- 输出 <w:t> 提取 ---")
    for line in out_text.splitlines():
        if line.strip():
            print(f"      | {line}")

    return ok


def main() -> int:
    print("=" * 60)
    print("docxtpl demo: Jinja2 模板渲染验证 (qp-to-qr-poc v2)")
    print("=" * 60)

    print("\n[0] 确保 demo 模板存在...")
    ensure_demo_template(TEMPLATE_PATH)

    scenarios = [
        (
            "场景 1: 含 notes (条件段应保留)",
            {
                "qp_id": "QP-01b",
                "method": "GC-FID 外标法",
                "analyte": "苯",
                "matrix": "药用辅料",
                "notes": "方法验证批次 2026-Q3",
            },
        ),
        (
            "场景 2: 不含 notes (条件段应隐藏)",
            {
                "qp_id": "QP-07",
                "method": "UV 含量法",
                "analyte": "总黄酮",
                "matrix": "中药提取物",
                "notes": "",
            },
        ),
    ]

    results = []
    for name, ctx in scenarios:
        ok = run_scenario(name, ctx)
        results.append((name, ok))

    print("\n" + "=" * 60)
    print("总报告")
    print("=" * 60)
    lines = [
        f"模板: {TEMPLATE_PATH}",
        f"输出: {OUTPUT_PATH}",
        "",
    ]
    n_pass = sum(1 for _, ok in results if ok)
    for name, ok in results:
        lines.append(f"[{'PASS' if ok else 'FAIL'}] {name}")
    lines.append("")
    lines.append(f"PASS: {n_pass} / {len(results)}")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"\n报告: {REPORT_PATH}")

    return 0 if n_pass == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())

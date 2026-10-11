#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
demo_pyzotero_integrated.py — pyzotero 集成 demo（v54.284 后续）

目的：
    验证 pyzotero + 本地 Zotero SQLite 真的能读 metadata，并与
    F:\knowledge-base\亚硝胺论文研究 项目集成。

3 种运行模式：
    1. 默认（什么都不传）  → 跑全部 demo + 写 demo_report.txt
    2. --dry-run            → 只跑 sync demo（dry-run 模式）
    3. --init               → 跑 init demo（仍 dry-run，不改文件）
    4. --export-bibtex      → 导出 .bib 到 F:\自制软件\output\

约束（与 zotero_sync.py 一致）：
    - Zotero DB：只读打开（sqlite URI mode=ro）
    - _extracted_data.json：只读
    - papers/ 子目录：只读（demo 不创建）
    - 输出全部到 F:\自制软件\output\pyzotero_demo\

报告输出：
    F:\自制软件\output\pyzotero_demo\demo_report.txt
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# ─────────────────────────────────────────────────────────────────────────
# 让脚本可独立运行（import zotero_sync + zotero_config）
# ─────────────────────────────────────────────────────────────────────────
THIS_FILE = Path(__file__).resolve()
TOOLS_DIR = Path(r"F:\knowledge-base\亚硝胺论文研究\tools")
sys.path.insert(0, str(TOOLS_DIR))

import zotero_config as zcfg                # noqa: E402
import zotero_sync as zsync                  # noqa: E402


# ─────────────────────────────────────────────────────────────────────────
# Demo 输出位置
# ─────────────────────────────────────────────────────────────────────────
DEMO_OUTPUT_ROOT = Path(r"F:\自制软件\output\pyzotero_demo")
DEMO_REPORT_PATH = DEMO_OUTPUT_ROOT / "demo_report.txt"


def _ensure_output_dir():
    DEMO_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ─────────────────────────────────────────────────────────────────────────
# Demo 报告生成器
# ─────────────────────────────────────────────────────────────────────────
class DemoReport:
    """累积式 demo 报告（写一次文件，便于用户 review）。"""

    def __init__(self):
        self.lines: List[str] = []

    def section(self, title: str):
        self.lines.append("")
        self.lines.append("=" * 70)
        self.lines.append(title)
        self.lines.append("=" * 70)

    def line(self, *args):
        self.lines.append(" ".join(str(a) for a in args))

    def dump(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(self.lines) + "\n", encoding="utf-8")

    def __str__(self) -> str:
        return "\n".join(self.lines)


# ─────────────────────────────────────────────────────────────────────────
# 3 个 demo 子模块
# ─────────────────────────────────────────────────────────────────────────
def demo_dry_run(report: DemoReport) -> Dict:
    """Demo #1：dry-run sync（最常用，只读不写）。"""
    report.section("Demo #1 — dry-run sync（只读扫描）")
    report.line(f"运行时间: {_now()}")
    report.line(f"本地 DB:  {zcfg.get_local_db_path()}")
    report.line(f"接入模式: {zcfg.get_mode()}")
    report.line("")

    if zcfg.get_mode() == "none":
        report.line("[FAIL] 既无 API key 也不存在本地 DB，跳过 dry-run demo")
        return {"skipped": True}

    try:
        engine = zsync.SyncEngine(write=False)
    except (FileNotFoundError, RuntimeError) as exc:
        report.line(f"[FAIL] {exc}")
        return {"error": str(exc)}

    try:
        # ─── item type 统计 ───
        report.line("── 本地 DB itemType 分布 ──")
        for t, n in engine.reader.list_item_types():
            report.line(f"  {t:24s}  {n}")
        report.line("")

        # ─── collections ───
        report.line("── Collections（前 8）──")
        for cid, cname, n in engine.reader.list_collections()[:8]:
            report.line(f"  [{cid:3d}] {cname}  ({n} items)")
        report.line("")

        # ─── sync 主流程（dry-run）──
        t0 = time.time()
        result = engine.sync()
        elapsed = time.time() - t0

        report.line("── sync 流程（dry-run）──")
        for action in result["actions"]:
            report.line(f"  {action}")
        report.line(f"  耗时: {elapsed*1000:.1f} ms")
        report.line("")

        # ─── 匹配样本 ───
        if result["matched"]:
            report.line(f"── 已匹配样本（{len(result['matched'])} 条，展示前 3）──")
            for m in result["matched"][:3]:
                report.line(f"  [{m['score']:.2f}] {Path(m['dir']).name}")
                report.line(f"    Zotero: {m['title'][:70]}")
            report.line("")

        if result["unmatched"]:
            report.line(f"── 未匹配样本（{len(result['unmatched'])} 条，展示前 5）──")
            for item in result["unmatched"][:5]:
                title = item.get("title", "")[:70]
                pub = item.get("publicationTitle", "?")[:30]
                year = item.get("date", "?")[:4]
                doi = item.get("DOI", "?")[:30]
                report.line(f"  • {title}")
                report.line(f"    期刊={pub} 年={year} DOI={doi}")
            report.line("")

        return {
            "total": result["total_zotero"],
            "matched": len(result["matched"]),
            "unmatched": len(result["unmatched"]),
            "elapsed_ms": round(elapsed * 1000, 1),
        }
    finally:
        engine.close()


def demo_init(report: DemoReport) -> Dict:
    """Demo #2：init-from-zotero（模拟首次初始化，仍 dry-run）。"""
    report.section("Demo #2 — init-from-zotero（首次初始化模拟）")
    report.line(f"运行时间: {_now()}")
    report.line("约束：默认 dry-run，不会真的修改 _extracted_data.json 或 papers/")
    report.line("")

    if zcfg.get_mode() == "none":
        report.line("[FAIL] 无可用 Zotero 数据源")
        return {"skipped": True}

    try:
        engine = zsync.SyncEngine(write=False)  # demo 模式永远不写
    except (FileNotFoundError, RuntimeError) as exc:
        report.line(f"[FAIL] {exc}")
        return {"error": str(exc)}

    try:
        result = engine.sync()
        unmatched = result["unmatched"]

        report.line(f"── 当前 _extracted_data.json ──")
        extracted = zcfg.EXTRACTED_JSON
        if extracted.exists():
            data = json.loads(extracted.read_text(encoding="utf-8"))
            report.line(f"  路径:    {extracted}")
            report.line(f"  大小:    {extracted.stat().st_size} bytes")
            report.line(f"  条目数:  {len(data)}")
        else:
            report.line(f"  [WARN] 未找到: {extracted}")
        report.line("")

        report.line(f"── Zotero 中 {len(unmatched)} 条新论文候选 ──")
        report.line("（dry-run 模式，以下展示的'建议操作'不会真正执行）")
        report.line("")

        # 展示前 3 条建议创建的项目
        for i, item in enumerate(unmatched[:3], 1):
            year = (item.get("date") or "")[:4] or "未知年份"
            journal = item.get("publicationTitle") or "未知期刊"
            title = item.get("title", "")
            dirname = zsync._slugify_dirname(year, journal, title)
            report.line(f"  [{i}] 建议目录: papers/{dirname}/")
            report.line(f"      标题:    {title[:80]}")
            report.line(f"      期刊:    {journal[:40]}")
            report.line(f"      年份:    {year}")
            report.line(f"      DOI:     {item.get('DOI', 'N/A')}")
            report.line(f"      作者:    {', '.join(c.get('lastName', '') for c in item.get('creators', [])[:3])}")
            report.line("")

        if not unmatched:
            report.line("  [INFO] 没有未匹配条目（所有 Zotero 条目都已在 papers/ 中）")

        return {"new_candidates": len(unmatched)}
    finally:
        engine.close()


def demo_export_bibtex(report: DemoReport, output_dir: Path) -> Dict:
    """Demo #3：export BibTeX（写到指定目录，不污染项目根）。"""
    report.section(f"Demo #3 — export BibTeX（→ {output_dir}）")
    report.line(f"运行时间: {_now()}")
    report.line("")

    if zcfg.get_mode() == "none":
        report.line("[FAIL] 无可用 Zotero 数据源")
        return {"skipped": True}

    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / "zotero_export.bib"

    try:
        with zsync.ZoteroLocalReader() as reader:
            t0 = time.time()
            items = reader.iter_journal_articles()
            elapsed = time.time() - t0

            n = zsync.export_bibtex(out_file, items)
            size = out_file.stat().st_size

            report.line(f"  拉取 items: {len(items)} 条 (耗时 {elapsed*1000:.1f} ms)")
            report.line(f"  BibTeX 文件: {out_file}")
            report.line(f"  文件大小:   {size} bytes")
            report.line(f"  平均每条:   {size // max(n, 1)} bytes")
            report.line("")

            # 展示前 2 条生成的 BibTeX
            report.line("── 前 2 条 BibTeX 预览 ──")
            for item in items[:2]:
                report.line(zsync.to_bibtex(item))
                report.line("")

            return {
                "n_items": n,
                "size_bytes": size,
                "elapsed_ms": round(elapsed * 1000, 1),
                "output": str(out_file),
            }
    except (FileNotFoundError, RuntimeError) as exc:
        report.line(f"[FAIL] {exc}")
        return {"error": str(exc)}


# ─────────────────────────────────────────────────────────────────────────
# 总结
# ─────────────────────────────────────────────────────────────────────────
def demo_summary(report: DemoReport, results: Dict):
    report.section("Demo 总结")
    report.line(f"运行时间: {_now()}")
    report.line("")
    report.line("── pyzotero 集成验证 ──")
    report.line(f"  pyzotero 版本:    {_safe_pyzotero_version()}")
    report.line(f"  Zotero 接入模式:  {zcfg.get_mode()}")
    report.line(f"  本地 DB:          {zcfg.get_local_db_path()}  "
                 f"{'[OK]' if zcfg.get_local_db_path().exists() else '[MISSING]'}")
    report.line("")

    for k, v in results.items():
        if isinstance(v, dict) and "error" not in v and "skipped" not in v:
            report.line(f"  {k}: {v}")
    report.line("")
    report.line("── 集成路径 ──")
    report.line(f"  配置模块:   {TOOLS_DIR / 'zotero_config.py'}")
    report.line(f"  同步引擎:   {TOOLS_DIR / 'zotero_sync.py'}")
    report.line(f"  Demo 入口:  {THIS_FILE}")
    report.line(f"  Demo 报告:  {DEMO_REPORT_PATH}")
    report.line("")
    report.line("── 后续动作建议 ──")
    report.line("  1. 接入 Zotero Web API（环境变量 ZOTERO_API_KEY / ZOTERO_LIBRARY_ID）")
    report.line("  2. 修改 zotero_sync.py 的 --write 默认值后启用真实同步")
    report.line("  3. 与 00-论文索引.md 对齐（增量更新）")


def _safe_pyzotero_version() -> str:
    try:
        import pyzotero
        return pyzotero.__version__
    except ImportError:
        return "未安装"


# ─────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────
def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="pyzotero 集成 demo（亚硝胺论文研究 / 本地 Zotero）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python demo_pyzotero_integrated.py
    python demo_pyzotero_integrated.py --dry-run
    python demo_pyzotero_integrated.py --init
    python demo_pyzotero_integrated.py --export-bibtex F:/temp/zotero_bib/
        """,
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="只跑 demo #1")
    parser.add_argument("--init", action="store_true",
                        help="只跑 demo #2")
    parser.add_argument("--export-bibtex", metavar="DIR",
                        help="只跑 demo #3（指定输出目录）")
    parser.add_argument("--no-report", action="store_true",
                        help="不写 demo_report.txt（仅 stdout）")
    args = parser.parse_args(argv)

    # 决定跑哪些 demo
    run_all = not (args.dry_run or args.init or args.export_bibtex)

    # Stdout banner
    print("=" * 70)
    print("pyzotero 集成 demo（亚硝胺论文研究 / 本地 Zotero）")
    print("=" * 70)
    print(f"运行时间: {_now()}")
    print(zcfg.describe())
    print()

    _ensure_output_dir()
    report = DemoReport()
    report.section("pyzotero 集成 demo — 报告")
    report.line(f"生成时间: {_now()}")
    report.line(f"运行模式: "
                f"{'全部' if run_all else ('dry-run' if args.dry_run else '')}"
                f"{'init' if args.init else ''}"
                f"{'export-bibtex' if args.export_bibtex else ''}")

    results: Dict = {}

    if run_all or args.dry_run:
        results["dry_run"] = demo_dry_run(report)
        print("[Demo #1] dry-run 完成")

    if run_all or args.init:
        results["init"] = demo_init(report)
        print("[Demo #2] init 完成")

    if run_all or args.export_bibtex:
        out_dir = Path(args.export_bibtex) if args.export_bibtex \
                  else DEMO_OUTPUT_ROOT / "bibtex"
        results["bibtex"] = demo_export_bibtex(report, out_dir)
        print(f"[Demo #3] BibTeX 导出完成 → {out_dir}")

    demo_summary(report, results)

    # 写报告
    if not args.no_report:
        report.dump(DEMO_REPORT_PATH)
        print()
        print(f"[OK] Demo 报告已写入: {DEMO_REPORT_PATH}")
    else:
        print()
        print(report)

    return 0


if __name__ == "__main__":
    sys.exit(main())

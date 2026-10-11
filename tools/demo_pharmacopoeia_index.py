#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
demo_pharmacopoeia_index.py — ChromaDB-Embedding demo（v54.284 落地验证）

目的：验证 ChromaDB 能索引中国药典 2025 版 9101 等关键通则。
        为后续大规模索引（400+ 通则）做准备。

用法：
    python tools/demo_pharmacopoeia_index.py

输出：
    tools/_chroma_demo/
        - chroma.sqlite3（持久化索引）
        - demo_report.json（命中结果）
"""
import sys
from pathlib import Path
import json
import os

# 路径
KB_ROOT = Path("F:/knowledge-base/中国药典2025版/04-四部-通则")
OUT_ROOT = Path("F:/自制软件/tools/_chroma_demo")

# 优先用持久化目录（避免污染用户目录）
OUT_ROOT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(OUT_ROOT))

try:
    import chromadb
except ImportError:
    print("[FAIL] chromadb 未装，请 pip install chromadb")
    sys.exit(1)


def main():
    print("=" * 60)
    print("ChromaDB 药典索引 demo")
    print(f"KB_ROOT: {KB_ROOT}")
    print(f"OUT_ROOT: {OUT_ROOT}")
    print("=" * 60)

    # 1. 收集样本文档（关键 8 个通则）
    samples = [
        ("9101-分析方法验证指导原则.md", "验证项目法规依据"),
        ("9100-分析方法转移指导原则.md", "方法转移"),
        ("9306-遗传毒性杂质控制指导原则.md", "亚硝胺"),
        ("9401-生物制品生物活性_效价测定方法验证指导原则.md", "生物制品"),
        ("9099-分析方法确认指导原则.md", "方法确认"),
        ("9102-药品杂质分析指导原则.md", "杂质"),
        ("9012-生物样品定量分析方法验证指导原则.md", "生物样品"),
        ("9601-药用辅料功能性相关指标指导原则.md", "辅料"),
    ]
    docs = []
    metadatas = []
    ids = []
    for fname, topic in samples:
        path = KB_ROOT / fname
        if not path.exists():
            print(f"  [SKIP] {fname} (not found)")
            continue
        text = path.read_text(encoding="utf-8")
        docs.append(text)
        metadatas.append({"topic": topic, "filename": fname})
        ids.append(fname.replace(".md", ""))
        print(f"  [+] {fname} ({len(text)} chars)")

    if not docs:
        print("[FAIL] 无样本")
        return 1

    # 2. 创建 ChromaDB 客户端（持久化）
    print()
    print("--- 创建 ChromaDB 客户端 ---")
    client = chromadb.PersistentClient(path=str(OUT_ROOT))
    collection_name = "chinese_pharmacopoeia_2025_demo"

    # 清理已有 collection
    try:
        client.delete_collection(collection_name)
        print(f"  [clean] 删除旧 collection")
    except Exception:
        pass

    # 3. 创建 collection + 添加文档
    print()
    print("--- 索引 ---")
    # 不带 embedding 函数（用默认 ChromaDB - 但需要联网下载模型）
    # 这里演示：如果有 OpenAI key 用 OpenAI embeddings，否则用默认
    collection = client.create_collection(
        name=collection_name,
        metadata={"description": "Chinese Pharmacopoeia 2025 demo"}
    )
    collection.add(documents=docs, metadatas=metadatas, ids=ids)
    print(f"  [+] 添加 {len(docs)} 个文档")

    # 4. 查询测试
    print()
    print("--- 查询测试 ---")
    test_queries = [
        "分析方法验证的接受标准是什么？",
        "亚硝胺杂质的控制限度？",
        "含量均匀度的判定公式？",
        "方法转移与确认有什么区别？",
    ]
    results_summary = []
    for q in test_queries:
        try:
            results = collection.query(query_texts=[q], n_results=3)
            hits = []
            for i, (doc, meta) in enumerate(zip(results["documents"][0], results["metadatas"][0])):
                dist = results["distances"][0][i] if "distances" in results else None
                hits.append({
                    "rank": i + 1,
                    "filename": meta["filename"],
                    "topic": meta["topic"],
                    "distance": dist,
                    "preview": doc[:100].replace("\n", " ")
                })
            print(f"\n  Q: {q}")
            for h in hits:
                dist_str = f"dist={h['distance']:.4f}" if h["distance"] is not None else "N/A"
                print(f"    [{h['rank']}] {h['filename']} ({h['topic']}) {dist_str}")
            results_summary.append({"query": q, "hits": hits})
        except Exception as e:
            # 默认 ChromaDB embedding 需要联网；离线场景下 fallback
            print(f"  [WARN] query '{q}' failed: {e}")
            results_summary.append({"query": q, "error": str(e)})

    # 5. 报告
    report_path = OUT_ROOT / "demo_report.json"
    report = {
        "out_dir": str(OUT_ROOT),
        "docs_indexed": len(docs),
        "queries_tested": len(test_queries),
        "queries_succeeded": sum(1 for r in results_summary if "hits" in r),
        "results": results_summary,
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print()
    print("=" * 60)
    print(f"Report: {report_path}")
    print(f"Stats: {report['queries_succeeded']}/{report['queries_tested']} queries succeeded")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
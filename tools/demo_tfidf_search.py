#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
demo_tfidf_search.py — TF-IDF 轻量语义搜索（无大模型下载）

目的：演示 F:\knowledge-base\ 1005 .md 文档的语义搜索能力（fallback 当 ChromaDB embedding 不可用时）

原理：sklearn TfidfVectorizer + cosine_similarity
       - 中文：使用 char-level n-gram（2-4）作为特征（兼容中英文混合）
       - 检索：query 向量化 → 与所有文档 cosine similarity → top-k

用法：
    python tools/demo_tfidf_search.py                          # 索引 + 演示查询
    python tools/demo_tfidf_search.py --query "亚硝胺控制限度"  # 单查询
    python tools/demo_tfidf_search.py --reindex              # 强制重建

输出：
    F:/自制软件/tools/_tfidf_idx/
        - vectorizer.pkl          训练好的 TF-IDF 模型
        - matrix.pkl              doc-term 矩阵
        - _index_log.json         已索引文件清单 + 元数据
"""
import argparse
import json
import sys
from pathlib import Path
import pickle
import re

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
except ImportError:
    print("[FAIL] sklearn 未装，请 pip install scikit-learn")
    sys.exit(1)

KB_ROOT = Path("F:/knowledge-base")
OUT_ROOT = Path("F:/自制软件/tools/_tfidf_idx")


def read_md_safe(path):
    """读 .md，剥 frontmatter"""
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    # 简单剥 frontmatter
    if text.startswith("---"):
        m = re.match(r"^---.*?---\s*\n(.*)$", text, re.DOTALL)
        if m:
            text = m.group(1)
    return text[:8000]  # 截断


def extract_title(text):
    for line in text.split("\n"):
        if line.strip().startswith("# "):
            return line.strip()[2:].strip()[:200]
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reindex", action="store_true", help="强制重建")
    parser.add_argument("--query", help="查询字符串")
    parser.add_argument("--limit", type=int, default=10000)
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    print("=" * 60)
    print("TF-IDF 语义搜索 demo（无大模型下载）")
    print("=" * 60)

    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    vec_path = OUT_ROOT / "vectorizer.pkl"
    mat_path = OUT_ROOT / "matrix.pkl"
    log_path = OUT_ROOT / "_index_log.json"

    # 1. 加载或重建索引
    if vec_path.exists() and mat_path.exists() and log_path.exists() and not args.reindex:
        print("--- 加载已有索引 ---")
        vectorizer = pickle.loads(vec_path.read_bytes())
        tfidf_matrix = pickle.loads(mat_path.read_bytes())
        log = json.loads(log_path.read_text(encoding="utf-8"))
    else:
        print("--- 索引 F:\\knowledge-base ---")
        md_files = list(KB_ROOT.rglob("*.md"))[:args.limit]
        print(f"  发现 {len(md_files)} 个 .md")

        docs = []
        meta_list = []
        for f in md_files:
            text = read_md_safe(f)
            if not text.strip():
                continue
            docs.append(text)
            meta_list.append({
                "path": str(f.relative_to(KB_ROOT)),
                "title": extract_title(text) or f.stem,
                "size_bytes": f.stat().st_size,
            })

        # TF-IDF：char-level ngram（适配中文）
        vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            min_df=1,
            max_df=0.95,
            max_features=50000,
        )
        tfidf_matrix = vectorizer.fit_transform(docs)
        print(f"  [+] 矩阵: {tfidf_matrix.shape}")

        # 持久化
        vec_path.write_bytes(pickle.dumps(vectorizer))
        mat_path.write_bytes(pickle.dumps(tfidf_matrix))
        log = {"docs": meta_list, "created": "now", "vector_shape": list(tfidf_matrix.shape)}
        log_path.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
        docs_text = docs  # 用于查询

    print(f"  [+] 已索引 {len(log['docs'])} 个文档")

    # 2. 查询
    if args.query:
        queries = [args.query]
    else:
        queries = [
            "亚硝胺杂质控制限度",
            "含量均匀度 A+1.80S 公式",
            "分析方法验证接受标准",
            "HPLC 外标法含量计算",
            "残留溶剂",
        ]

    print()
    print("--- 查询测试 ---")
    for q in queries:
        query_vec = vectorizer.transform([q])
        sims = cosine_similarity(query_vec, tfidf_matrix).flatten()
        top_indices = sims.argsort()[-args.top_k:][::-1]

        print(f"\nQ: {q}")
        for rank, idx in enumerate(top_indices, 1):
            if sims[idx] < 0.05:  # 跳过低相似度
                continue
            m = log["docs"][idx]
            print(f"  [{rank}] score={sims[idx]:.3f} {m['path']}")
            print(f"       title: {m['title'][:80]}")

    print()
    print("=" * 60)
    print(f"索引: {OUT_ROOT}")
    print(f"documents: {len(log['docs'])}")
    print(f"vocabulary: {len(vectorizer.vocabulary_)}")
    print("=" * 60)


if __name__ == "__main__":
    sys.exit(main())
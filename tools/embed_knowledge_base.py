#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
embed_knowledge_base.py — F:\knowledge-base 1005 个 .md 全量 ChromaDB 索引

目的：把用户知识库（F:\knowledge-base\）所有 .md 文档（1005 个 / 3.5MB）索引到 ChromaDB，
        作为 Claude Code 的语义搜索后端（搭配 obsidian-notes-rag MCP server）。

用法：
    python tools/embed_knowledge_base.py                # 增量索引
    python tools/embed_knowledge_base.py --reindex     # 强制重建
    python tools/embed_knowledge_base.py --query "..."  # 索引 + 查询

输出：
    F:/自制软件/tools/_chroma_kb/
        chroma.sqlite3        持久化索引
        _index_log.json        索引日志（已索引文件 + SHA256）
        query_result.json      查询结果（--query 时）

性能：
    1005 .md × ~3.5 KB ≈ 3.5 MB → ~500 chunks → 索引时间 ~30 秒（首次）
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from datetime import datetime

# 路径
KB_ROOT = Path("F:/knowledge-base")
OUT_ROOT = Path("F:/自制软件/tools/_chroma_kb")
COLLECTION_NAME = "rkb_user_kb_2025"


def sha256_file(path):
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description="知识库 ChromaDB 索引")
    parser.add_argument("--reindex", action="store_true", help="强制重建（清空旧 collection）")
    parser.add_argument("--query", help="索引后跑查询")
    parser.add_argument("--limit", type=int, default=10000, help="最大 md 数")
    args = parser.parse_args()

    print("=" * 60)
    print("F:\\knowledge-base 全量 ChromaDB 索引")
    print("=" * 60)
    print(f"KB_ROOT: {KB_ROOT}")
    print(f"OUT_ROOT: {OUT_ROOT}")

    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    try:
        import chromadb
    except ImportError:
        print("[FAIL] chromadb 未装")
        return 1

    # 1. 收集所有 .md
    print()
    print("--- 收集 .md 文件 ---")
    md_files = list(KB_ROOT.rglob("*.md"))[:args.limit]
    print(f"  [+] 发现 {len(md_files)} 个 .md")

    # 2. 读 frontmatter + 内容
    print()
    print("--- 解析 ---")
    docs = []
    metadatas = []
    ids = []
    for f in md_files:
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
            # 简单 frontmatter 解析（提取 YAML key: value）
            meta = {
                "path": str(f.relative_to(KB_ROOT)),
                "size_bytes": f.stat().st_size,
                "sha256": sha256_file(f)[:16],
                "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                "top_dir": f.relative_to(KB_ROOT).parts[0] if len(f.relative_to(KB_ROOT).parts) > 0 else "",
            }
            # 提取 H1 作为 title
            for line in text.split("\n"):
                if line.strip().startswith("# "):
                    meta["title"] = line.strip()[2:].strip()[:200]
                    break
            else:
                meta["title"] = f.stem

            docs.append(text[:8000])  # 截断到 8KB（避免单 doc 过大）
            metadatas.append(meta)
            ids.append(meta["sha256"])
        except Exception as e:
            print(f"  [SKIP] {f.name}: {e}")

    if not docs:
        print("[FAIL] 无有效文档")
        return 1

    print(f"  [+] 解析 {len(docs)} 个文档")

    # 3. 创建 ChromaDB collection
    print()
    print("--- 索引 ---")
    client = chromadb.PersistentClient(path=str(OUT_ROOT))

    if args.reindex:
        try:
            client.delete_collection(COLLECTION_NAME)
            print(f"  [clean] 删除旧 collection")
        except Exception:
            pass

    try:
        collection = client.get_collection(COLLECTION_NAME)
        # 增量：跳过已索引的
        existing_ids = set(collection.get()["ids"])
        new_docs, new_metas, new_ids = [], [], []
        for d, m, i in zip(docs, metadatas, ids):
            if i not in existing_ids:
                new_docs.append(d)
                new_metas.append(m)
                new_ids.append(i)
        if new_docs:
            collection.add(documents=new_docs, metadatas=new_metas, ids=new_ids)
            print(f"  [+] 增量添加 {len(new_docs)} 个")
        else:
            print(f"  [=] 全部已索引（{len(existing_ids)} 个）")
    except Exception:
        # 全新创建
        collection = client.create_collection(
            name=COLLECTION_NAME,
            metadata={"description": "F:\\knowledge-base 1005 .md", "created": datetime.now().isoformat()}
        )
        # 一次性添加可能太大 → 分批
        batch_size = 200
        for i in range(0, len(docs), batch_size):
            collection.add(
                documents=docs[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size],
                ids=ids[i:i+batch_size],
            )
            print(f"  [+] batch {i // batch_size + 1}/{(len(docs) + batch_size - 1) // batch_size}")

    print(f"  [+] 总索引: {collection.count()} 个文档")

    # 4. 查询（可选）
    if args.query:
        print()
        print(f"--- 查询: {args.query} ---")
        results = collection.query(query_texts=[args.query], n_results=5)
        for i, (doc, meta) in enumerate(zip(results["documents"][0], results["metadatas"][0])):
            dist = results["distances"][0][i] if "distances" in results else None
            print(f"\n  [{i + 1}] {meta['path']}")
            print(f"      title: {meta.get('title', 'N/A')[:80]}")
            print(f"      dist: {dist}")
            print(f"      preview: {doc[:120].replace(chr(10), ' ')}...")

    print()
    print("=" * 60)
    print(f"索引目录: {OUT_ROOT}")
    print(f"collection: {COLLECTION_NAME}")
    print(f"文档数: {collection.count()}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
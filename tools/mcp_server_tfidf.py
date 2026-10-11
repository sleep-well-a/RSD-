#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
mcp_server_tfidf.py — TF-IDF 知识库搜索 MCP server（仿 obsidian-notes-rag）

目的：
    让 Claude Code 通过 MCP stdio 调用 demo_tfidf_search.py 的 TF-IDF 索引
    搜索 F:\knowledge-base 全库（1005+ .md 文档）。

复用策略：
    - 直接 import demo_tfidf_search 的辅助函数（read_md_safe / extract_title）
    - 完全复用 _tfidf_idx/ 持久化索引（vectorizer.pkl + matrix.pkl + _index_log.json）
    - 不修改 demo_tfidf_search.py

四个工具：
    search_notes(query, top_k=5)        全文 TF-IDF 搜索
    get_similar(file_path, top_k=5)     找与某文件相似的文件
    get_note_context(file_path)         读 metadata + 前 500 字
    reindex()                           强制重建索引

启动（stdio transport，Claude Code 默认）：
    python F:/自制软件/tools/mcp_server_tfidf.py

配置（~/.claude/settings.json）：
    "mcpServers": {
        "tfidf-search": {
            "command": "python",
            "args": ["F:/自制软件/tools/mcp_server_tfidf.py"]
        }
    }
"""
import asyncio
import json
import logging
import pickle
import sys
from pathlib import Path
from typing import Any

# ---- stderr 日志（绝不污染 stdout MCP 协议）----
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format="%(asctime)s [%(levelname)s] tfidf-mcp: %(message)s",
)
log = logging.getLogger("tfidf-mcp")

# ---- sklearn 依赖 ----
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    log.error("sklearn 未装，请 pip install scikit-learn")
    sys.exit(1)

# ---- MCP SDK 依赖 ----
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    log.error("mcp SDK 未装，请 pip install mcp")
    sys.exit(1)

# ---- 复用 demo_tfidf_search.py 的核心辅助函数（不修改原文件）----
_TOOLS_DIR = Path(__file__).resolve().parent
if str(_TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOLS_DIR))
from demo_tfidf_search import read_md_safe, extract_title  # noqa: E402

# ---- 路径常量（与 demo_tfidf_search.py 保持一致）----
KB_ROOT = Path("F:/knowledge-base")
OUT_ROOT = Path("F:/自制软件/tools/_tfidf_idx")
VEC_PATH = OUT_ROOT / "vectorizer.pkl"
MAT_PATH = OUT_ROOT / "matrix.pkl"
LOG_PATH = OUT_ROOT / "_index_log.json"

# ---- 索引单例（首次访问惰性加载）----
_INDEX: dict[str, Any] = {
    "vectorizer": None,
    "matrix": None,
    "log": None,
    "loaded": False,
}


def _load_index() -> None:
    """惰性加载持久化索引（首次访问时调用）"""
    if _INDEX["loaded"]:
        return
    if not (VEC_PATH.exists() and MAT_PATH.exists() and LOG_PATH.exists()):
        raise FileNotFoundError(
            f"索引不存在于 {OUT_ROOT}，请先调用 reindex() 重建"
        )
    log.info("加载 TF-IDF 索引: %s", OUT_ROOT)
    _INDEX["vectorizer"] = pickle.loads(VEC_PATH.read_bytes())
    _INDEX["matrix"] = pickle.loads(MAT_PATH.read_bytes())
    _INDEX["log"] = json.loads(LOG_PATH.read_text(encoding="utf-8"))
    _INDEX["loaded"] = True
    log.info(
        "已加载 %d 个文档，词汇表 %d",
        len(_INDEX["log"]["docs"]),
        len(_INDEX["vectorizer"].vocabulary_),
    )


def _build_index() -> dict[str, Any]:
    """重建索引（复用 demo_tfidf_search.py 同样的 TfidfVectorizer 参数）"""
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    md_files = list(KB_ROOT.rglob("*.md"))
    log.info("发现 %d 个 .md，开始重建索引", len(md_files))

    docs: list[str] = []
    meta_list: list[dict] = []
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

    # 与 demo_tfidf_search.py 完全一致的 vectorizer 参数（中文 char_wb ngram）
    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),
        min_df=1,
        max_df=0.95,
        max_features=50000,
    )
    tfidf_matrix = vectorizer.fit_transform(docs)
    log.info("矩阵形状: %s", tfidf_matrix.shape)

    # 持久化
    VEC_PATH.write_bytes(pickle.dumps(vectorizer))
    MAT_PATH.write_bytes(pickle.dumps(tfidf_matrix))
    log_data = {
        "docs": meta_list,
        "vector_shape": list(tfidf_matrix.shape),
    }
    LOG_PATH.write_text(
        json.dumps(log_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 更新单例
    _INDEX.update({
        "vectorizer": vectorizer,
        "matrix": tfidf_matrix,
        "log": log_data,
        "loaded": True,
    })

    return {
        "documents": len(meta_list),
        "vocabulary": len(vectorizer.vocabulary_),
        "matrix_shape": list(tfidf_matrix.shape),
        "index_dir": str(OUT_ROOT),
    }


def _search(query: str, top_k: int) -> list[dict]:
    """通用 TF-IDF 搜索（query 向量化 → cosine sim → top-k）"""
    _load_index()
    vec = _INDEX["vectorizer"].transform([query])
    sims = cosine_similarity(vec, _INDEX["matrix"]).flatten()
    top_idx = sims.argsort()[-top_k:][::-1]
    results = []
    for rank, idx in enumerate(top_idx, 1):
        score = float(sims[idx])
        if score < 0.05:  # 跳过低相似度（与 demo 一致）
            continue
        m = _INDEX["log"]["docs"][int(idx)]
        results.append({
            "rank": rank,
            "score": round(score, 3),
            "path": m["path"],
            "title": m["title"][:120],
            "size_bytes": m.get("size_bytes", 0),
        })
    return results


def _find_doc_idx(file_path: str) -> int | None:
    """根据 file_path 找 doc 索引（宽容匹配 .md 后缀 / 路径分隔符）"""
    _load_index()
    target = file_path.replace("\\", "/").lstrip("/")
    candidates = {target, target + ".md"}
    if target.endswith(".md"):
        candidates.add(target[:-3])
    for idx, m in enumerate(_INDEX["log"]["docs"]):
        p = m["path"].replace("\\", "/")
        if p in candidates:
            return idx
    return None


# ============== MCP Server ==============
server = Server("tfidf-search")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="search_notes",
            description=(
                "TF-IDF 语义搜索 F:\\knowledge-base 全库。"
                "char-level ngram (2-4) 特征，兼容中英混合。"
                "返回 top-k 文档的 path + title + cosine score。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "查询关键词（中文/英文/混合）",
                    },
                    "top_k": {
                        "type": "integer",
                        "default": 5,
                        "minimum": 1,
                        "maximum": 50,
                        "description": "返回 top k 个结果",
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="get_similar",
            description=(
                "找与某文件最相似的 top k 个文件（基于 TF-IDF cosine sim）。"
                "用文件本身的向量作为 query，自动排除自身。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "相对 KB_ROOT 的路径，如 '00-记忆中枢/foo.md'",
                    },
                    "top_k": {
                        "type": "integer",
                        "default": 5,
                        "minimum": 1,
                        "maximum": 50,
                    },
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="get_note_context",
            description=(
                "读文件的 metadata + 前 500 字（已剥 frontmatter）。"
                "如果文件已索引，返回 title + size_bytes；否则尝试直接读盘。"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "相对 KB_ROOT 的路径，如 '00-记忆中枢/foo.md'",
                    },
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="reindex",
            description=(
                "强制重建 TF-IDF 索引（遍历 F:\\knowledge-base 所有 .md）。"
                "耗时较长（~30s），完成后自动持久化到 _tfidf_idx/。"
            ),
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    def _err(msg: str, **extra) -> list[TextContent]:
        payload = {"error": msg, "tool": name, **extra}
        return [TextContent(type="text", text=json.dumps(payload, ensure_ascii=False, indent=2))]

    try:
        if name == "search_notes":
            q = arguments["query"]
            k = int(arguments.get("top_k", 5))
            results = _search(q, k)
            return [TextContent(
                type="text",
                text=json.dumps(
                    {"query": q, "top_k": k, "count": len(results), "results": results},
                    ensure_ascii=False,
                    indent=2,
                ),
            )]

        elif name == "get_similar":
            fp = arguments["file_path"]
            k = int(arguments.get("top_k", 5))
            _load_index()
            idx = _find_doc_idx(fp)
            if idx is None:
                return _err(f"文件未索引: {fp}", file_path=fp)
            # 用文档向量作为 query（sparse row → cosine vs full matrix）
            doc_vec = _INDEX["matrix"][idx]
            sims = cosine_similarity(doc_vec, _INDEX["matrix"]).flatten()
            sims[idx] = -1.0  # 排除自身
            top_idx = sims.argsort()[-k:][::-1]
            similar = []
            for rank, i in enumerate(top_idx, 1):
                score = float(sims[i])
                if score < 0.05:
                    continue
                m = _INDEX["log"]["docs"][int(i)]
                similar.append({
                    "rank": rank,
                    "score": round(score, 3),
                    "path": m["path"],
                    "title": m["title"][:120],
                })
            src = _INDEX["log"]["docs"][idx]
            return [TextContent(
                type="text",
                text=json.dumps(
                    {
                        "source": {"path": src["path"], "title": src["title"]},
                        "top_k": k,
                        "similar": similar,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            )]

        elif name == "get_note_context":
            fp = arguments["file_path"]
            _load_index()
            idx = _find_doc_idx(fp)
            if idx is not None:
                m = _INDEX["log"]["docs"][idx]
                abs_path = KB_ROOT / m["path"]
                metadata = {
                    "path": m["path"],
                    "title": m["title"],
                    "size_bytes": m["size_bytes"],
                    "indexed": True,
                }
            else:
                # 文件可能未索引，尝试直接读盘
                abs_path = KB_ROOT / fp
                metadata = {
                    "path": fp,
                    "title": Path(fp).stem,
                    "size_bytes": abs_path.stat().st_size if abs_path.exists() else 0,
                    "indexed": False,
                }
            if not abs_path.exists():
                return _err(f"文件不存在: {abs_path}", metadata=metadata)
            text = read_md_safe(abs_path)
            return [TextContent(
                type="text",
                text=json.dumps(
                    {
                        "metadata": metadata,
                        "preview": text[:500],
                        "total_chars": len(text),
                        "truncated": len(text) > 500,
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            )]

        elif name == "reindex":
            log.info("reindex() 被调用")
            stats = _build_index()
            return [TextContent(
                type="text",
                text=json.dumps(
                    {"status": "ok", "stats": stats},
                    ensure_ascii=False,
                    indent=2,
                ),
            )]

        return _err(f"未知工具: {name}")

    except FileNotFoundError as e:
        return _err(str(e))
    except Exception as e:
        log.exception("tool %s 执行失败", name)
        return _err(f"{type(e).__name__}: {e}")


async def main() -> None:
    log.info("TF-IDF MCP server 启动（stdio transport）")
    log.info("KB_ROOT = %s", KB_ROOT)
    log.info("OUT_ROOT = %s", OUT_ROOT)
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("MCP server 退出")

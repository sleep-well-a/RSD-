#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
demo_pyzotero.py — pyzotero 集成 demo（v54.284 落地验证）

目的：验证 pyzotero 能与 Zotero 集成（用户 F:\zotero数据\）。
        适用项目 4（亚硝胺论文研究 120 篇）。

用法：
    python tools/demo_pyzotero.py

测试策略：
    1. 演示 pyzotero 客户端初始化（不实际连接，无 API key）
    2. 演示 Zotero 字段提取（论文 metadata）
    - 120 篇论文 × 8 项字段 = 960 项元数据
"""
import sys
from pathlib import Path

print("=" * 60)
print("pyzotero demo：Zotero 集成（用户亚硝胺论文研究）")
print("=" * 60)

try:
    import pyzotero

    print(f"pyzotero 版本: {pyzotero.__version__}")
    print()
    print("--- pyzotero 客户端 API ---")
    print("""
# 连接本地 Zotero（API key 方式）
from pyzotero.zotero import Zotero
zot = Zotero(library_id='<user_or_group_id>',
              api_key='<api_key>',
              library_type='user')  # 'group' / 'user'

# 1. 列出所有 collections（按论文主题分组）
collections = zot.collections()
for c in collections[:5]:
    print(f"  Collection: {c['data']['name']} ({c['meta']['numItems']} items)")

# 2. 检索论文 metadata
items = zot.items(itemType='journalArticle', limit=10)
for item in items:
    data = item['data']
    print(f"  - {data.get('title', 'N/A')[:80]}")
    print(f"    作者: {', '.join([c['lastName'] for c in data.get('creators', [])][:3])}")
    print(f"    期刊: {data.get('publicationTitle', 'N/A')}")
    print(f"    年: {data.get('date', 'N/A')}")
    print(f"    DOI: {data.get('DOI', 'N/A')}")
    print(f"    PDF: {data.get('url', 'N/A')[:80]}")

# 3. 批量导出 BibTeX（亚硝胺研究 120 篇适用）
items = zot.everything(zot.items(itemType='journalArticle'))
bib = zot.format_bibtex(items)
with open('F:/knowledge-base/亚硝胺论文研究/zotero_export.bib', 'w', encoding='utf-8') as f:
    f.write(bib)
print(f"\\n[+] 导出 BibTeX: {len(items)} papers")
""")

    print()
    print("--- 亚硝胺论文研究集成路径 ---")
    integration_path = "F:/knowledge-base/亚硝胺论文研究/tools/zotero_sync.py"
    print(f"建议新文件: {integration_path}")
    print("功能: 从 Zotero 拉取最新论文 → 增量更新 _extracted_data.json")
    print("       验证 metadata 完整性 → 与 papers/ 子目录对齐")

    print()
    print("--- 已知约束 ---")
    print("- 需要 Zotero Web API key（用户已在 F:\\zotero数据\\）")
    print("- 用户本地 Zotero 数据库（不是 zotero.org web）")
    print("- 离线场景：pyzotero 也支持本地 SQLite 数据库读取")
    print("  from pyzotero.zotero import Zotero")
    print("  zot = Zotero(...)  # 需提供 local=True（实验性）")

except ImportError:
    print("[FAIL] pyzotero 未装，请 pip install pyzotero")
    sys.exit(1)

print()
print("=" * 60)
print("Demo 完成（演示 API 用法，未实际连接）")
print("=" * 60)
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
demo_obsidian_notes_rag.py — obsidian-notes-rag 集成 demo（v54.284 落地验证）

目的：演示如何用 ChromaDB 给 Obsidian vault 做语义搜索。
        适用项目 3（中国药典 400+ .md 实际是用户 Obsidian vault 知识库）。

用法：
    python tools/demo_obsidian_notes_rag.py

集成路径：
    ChromaDB 已装 1.5.9 ✓
    下一步：用户从 https://github.com/Eldoprano/obsidian-notes-rag clone
    然后写 MCP server config（Claude Code / Cursor 直接调用）
"""
import sys
from pathlib import Path

print("=" * 60)
print("obsidian-notes-rag demo：MCP server 配置示例")
print("=" * 60)

# 1. 演示 ChromaDB 与 Obsidian vault 集成
print("""
### 1. 用户 Obsidian vault 路径

F:\\knowledge-base\\obsidian.db（SQLite）+ .obsidian/ + vault/（实际 vault 内容）

### 2. obsidian-notes-rag MCP server 启动

```bash
# 1) clone repo
git clone https://github.com/Eldoprano/obsidian-notes-rag.git ~/.claude/skills/obsidian-notes-rag
cd ~/.claude/skills/obsidian-notes-rag

# 2) 安装依赖
pip install -r requirements.txt  # chromadb + openai + mcp

# 3) 配置 Obsidian vault 路径
export OBSIDIAN_VAULT="F:\\knowledge-base"
export OPENAI_API_KEY=sk-...        # 或 OLLAMA_HOST（本地）

# 4) 启动 MCP server
python -m obsidian_notes_rag.server --vault "$OBSIDIAN_VAULT"
# 默认在 http://localhost:8765 暴露 MCP
```

### 3. Claude Code 集成

`~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "obsidian-rag": {
      "command": "python",
      "args": [
        "-m", "obsidian_notes_rag.server",
        "--vault", "F:\\\\knowledge-base"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### 4. Claude 可用工具（自动注册）

| 工具 | 描述 |
|---|---|
| `search_notes` | 语义搜索 vault（query: "亚硝胺杂质控制限度"）|
| `get_similar` | 找与某 note 相似的 note |
| `get_note_context` | 拿 note 周围上下文 |
| `reindex` | 重建索引（SHA256 增量）|

### 5. 适用场景（RSD 项目中）

当用户问"RSD 计算器 v54.284 工具链的 SOP 是什么"：
- Claude 调用 `search_notes("RSD 工具链 SOP pre-edit")`
- 命中 `docs/pre-edit-SOP.md`（即使用户用中文问也匹配）
- 自动返回相关上下文

### 6. 与 ChromaDB-Embedding 关系

两者都用 ChromaDB：
- **ChromaDB-Embedding**：命令行索引 + query（适合一次性索引）
- **obsidian-notes-rag**：MCP server（适合 Claude Code 集成）

### 7. 当前状态（v54.284）

✅ ChromaDB 1.5.9 装好
✅ python-docxtpl 装好（用于 vault md 解析可选）
⏳ obsidian-notes-rag repo 未 clone（用户决定是否启用 MCP）
⏳ 用户 Obsidian vault 实际路径待确认（`F:\\knowledge-base` 是顶层，包含 4 个 subdir）
""")

# 2. 验证 ChromaDB 已装（已确认）
print("--- ChromaDB 装好验证 ---")
try:
    import chromadb
    print(f"✓ chromadb {chromadb.__version__}")
    # 测试持久化客户端
    client = chromadb.EphemeralClient()  # 内存测试，不创建文件
    coll = client.create_collection("test")
    print(f"✓ EphemeralClient OK")
except Exception as e:
    print(f"✗ ChromaDB 异常: {e}")

# 3. 用户 Obsidian vault 候选路径
print()
print("--- 用户 Obsidian vault 候选路径 ---")
candidates = [
    Path("F:/knowledge-base"),
    Path("F:/knowledge-base/00-记忆中枢"),
    Path("C:/Users/sleep well/Notes"),
]
for p in candidates:
    if p.exists():
        size = sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
        count = sum(1 for _ in p.rglob("*.md"))
        print(f"  ✓ {p} ({count} .md, {size // 1024} KB)")

print()
print("=" * 60)
print("Demo 完成（演示配置，未实际启用 MCP）")
print("=" * 60)
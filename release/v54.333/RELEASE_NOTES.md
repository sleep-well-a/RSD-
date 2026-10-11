# RSD & 含量计算器 v54.333 发布说明

**发布日期**：2026-10-11
**前版本**：v54.332

## 📄 OCR 原始文本展示（用户手动选用）

表格抽取依赖 PPStructureV3 重型 ML 模型（本地实测 total_tables=0），不是当前可行方向。改用轻量方案：**OCR 后端把 stage 2A 抽取的全文返回前端**，用户可在 PWA 内查看/复制原始文本，手动选择需要的数字填入表单。

### 改动

#### 1. 后端增加 raw_text 字段（tools/ocr_server.py）

```python
def _collect_raw_text(job_dir):
    """v54.333：合并 job_dir/pages/*.txt 为 raw_text 字段"""
    pages_dir = job_dir / 'pages'
    if not pages_dir.exists(): return ''
    texts = []
    for txt in sorted(pages_dir.glob('*.txt')):
        texts.append(f'--- {txt.name} ---\n' + txt.read_text(...))
    return '\n\n'.join(texts)

# 在 result 中加：
result = {
    ...,
    'raw_text': _collect_raw_text(job_dir),  # v54.333：OCR 全文
    'tables': [...],  # v54.333：可用表格列表（如果有）
}
```

**响应字段**：
- `fields`：命名字段（RSD / 含量 / 回收率）
- `raw_text`：OCR 全文（按页分隔）
- `tables`：表格文件列表（如果有 PPStructure 输出）

#### 2. 前端展示 raw_text（app.js）

```js
// v54.333：raw_text 展示（可折叠 + 复制）
if (data.raw_text) {
  html += '<button onclick="toggleOcrRawText()">📄 查看原始文本</button>'
       + '<div id="ocr-raw-text" style="display:none;..."></div>';
}
root.innerHTML = html;
// 用 textContent 避免 innerHTML 转义问题
document.getElementById('ocr-raw-text').textContent = data.raw_text;

function toggleOcrRawText() {
  // 显示/隐藏 + 加复制按钮（navigator.clipboard.writeText）
}
```

**用户流程**：
1. 选 PDF → 抽取
2. 看结果表格（如"含量：98.7%"）
3. 看"📄 查看原始文本"→ 显示全文
4. 看表格里**没有**的字段（如 stdArea 数组），手动复制原始数字
5. 复制按钮：navigator.clipboard.writeText → 粘贴到表单

#### 3. 4 个新 i18n key

| key | zh | alert (en) |
|---|---|---|
| `btnOcrShowRawText` | 📄 查看原始文本 | Show Raw Text |
| `btnOcrCopyText` | 📋 复制 | Copy |
| `toast_ocrCopied` | 已复制到剪贴板 | Copied to clipboard |
| `toast_ocrCopyFail` | 复制失败（浏览器权限拒绝）| Copy failed (browser permission denied) |

#### 4. Puppeteer 测试（33/33）

- ✅ "查看原始文本"按钮渲染（mock 含 raw_text 时）
- ✅ raw_text div 显示（点击按钮后）
- ✅ raw_text 含原文（"阿司匹林"/"MV2026055"）

### 完整 OCR 链路（v54.333 最终版）

```
PDF 上传 (multi)
  ↓
/ocr/start → 后台 thread
  ↓
paddleocr 4 阶段（实时写 status.json）
  ↓
前端轮询 /ocr/status/<id>（真实阶段 + progress）
  ↓ done
后端收集 raw_text（pages/*.txt 合并）+ tables（如果有）
  ↓
前端展示：
  - 命名字段表格（RSD/含量/回收率 + 一键应用）
  - 📊 完整报告（iframe viewer）
  - 📄 原始文本（手动复制需要的数字）
  - 缓存（localStorage 避免重复）
  - 批处理（多 PDF 串行）
```

### Puppeteer 测试结果

| 套件 | v54.332 | v54.333 |
|---|---|---|
| `round52_ocr` | 30/30 | **33/33**（+3 项 raw_text 断言）|
| `round48_i18n_sync` | 18/18 | 18/18 |
| `round35_critical` | 49/49 | 49/49 |
| `audit_round17` | 26/26 | 26/26 |
| `pwa_e2e` | 16/16 | 16/16 |

**Puppeteer 总计**：75 套件（约 1393 断言）。

### 累计统计（v54.298 → v54.333）

- **Puppeteer 套件**：58 → 75（+17）
- **断言总数**：~1100 → ~1393（+293）
- **新发布版本**：36 个
- **OCR 端到端**：**9 个版本完成**（v54.325-333）
- **未做的 OCR 扩展**：表格解析（依赖重型 ML 模型，暂缓）

## 发布包

- 文件：`RSD-含量计算器-v54.333.zip`
- 流动相版：`RSD & 含量计算器_流动相版_v54.333.html`
- 后端：tools/ocr_server.py 加 `_collect_raw_text` + `tables` 字段
- 前端：app.js 加 `toggleOcrRawText` + raw_text 展示
- i18n：4 个新 key（zh + alert）
- 测试：round52_ocr 33 项断言

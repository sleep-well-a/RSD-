# RSD & 含量计算器 v54.334 发布说明

**发布日期**：2026-10-11
**前版本**：v54.333

## 📋 OCR 一键复制所有字段

OCR 抽取的字段现在可以**一键复制**为纯文本（key: value）或 TSV 格式（粘贴 Excel）。方便分析师把抽到的字段粘到报告系统、Excel、Word 等。

### 改动

#### 1. 两个新按钮（app.js renderOcrResults）

```js
html += '<button onclick="copyAllOcrFields()">📋 一键复制所有字段</button>'
     + '<button onclick="copyAllOcrFields(\'tsv\')">📊 复制为表格 (TSV)</button>';
```

#### 2. copyAllOcrFields 函数

```js
function copyAllOcrFields(format) {
  // format: 'kv' → "key: value\n..."
  // format: 'tsv' → "key\tvalue\n..."（可粘贴 Excel）
  const sep = format === 'tsv' ? '\t' : ': ';
  const lines = [];
  rows.forEach(tr => {
    const key = tr.tds[0].textContent.trim();
    const value = tr.tds[1].textContent.trim();
    if (key && value) lines.push(key + sep + value);
  });
  navigator.clipboard.writeText(lines.join('\n'));
}
```

**输出示例**（3 个字段 RSD / 含量 / 样品名）：

KV 格式（粘贴到任何文本编辑器）：
```
RSD: 2.5%
含量: 98.7%
样品名: Aspirin
```

TSV 格式（粘贴到 Excel，自动分列）：
```
RSD	2.5%
含量	98.7%
样品名	Aspirin
```

#### 3. 4 个新 i18n key

| key | zh | alert (en) |
|---|---|---|
| `btnOcrCopyAll` | 📋 一键复制所有字段 | Copy All Fields |
| `btnOcrCopyTsv` | 📊 复制为表格 (TSV) | Copy as TSV |
| `toast_ocrCopiedTsv` | 已复制为 TSV（可粘贴 Excel）| Copied as TSV (paste into Excel) |
| `toast_ocrNoFieldsToCopy` | 无可复制字段 | No fields to copy |

#### 4. Puppeteer 测试（37/37）

- ✅ "一键复制所有字段"按钮渲染
- ✅ "复制为 TSV"按钮渲染
- ✅ 一键复制（KV 格式）：含 RSD + 含量
- ✅ 一键复制（TSV 格式）：含 `\t` 分隔符

### 用户使用场景

**场景 1：粘贴到 Word/邮件**
```
选 PDF → 抽取 → 点 "📋 一键复制所有字段"
→ 打开 Word/邮件
→ Ctrl+V
→ 显示:
  RSD: 2.5%
  含量: 98.7%
  样品名: Aspirin
```

**场景 2：粘贴到 Excel**
```
选 PDF → 抽取 → 点 "📊 复制为表格 (TSV)"
→ 打开 Excel
→ Ctrl+V
→ 自动分 2 列：key | value
```

### Puppeteer 测试结果

| 套件 | v54.333 | v54.334 |
|---|---|---|
| `round52_ocr` | 33/33 | **37/37**（+4 项复制断言）|
| `round48_i18n_sync` | 18/18 | 18/18 |
| `round35_critical` | 49/49 | 49/49 |
| `audit_round17` | 26/26 | 26/26 |
| `pwa_e2e` | 16/16 | 16/16 |

**Puppeteer 总计**：75 套件（约 1397 断言）。

### 累计统计（v54.298 → v54.334）

- **Puppeteer 套件**：58 → 75（+17）
- **断言总数**：~1100 → ~1397（+297）
- **新发布版本**：37 个
- **新 i18n key**：32 个（OCR 累积）
- **OCR 端到端**：10 个版本（v54.325-334）

## 发布包

- 文件：`RSD-含量计算器-v54.334.zip`
- 流动相版：`RSD & 含量计算器_流动相版_v54.334.html`
- app.js：加 `copyAllOcrFields(format)` 函数 + 两个按钮
- i18n：4 个新 key（zh + alert）
- 测试：round52_ocr 37 项断言

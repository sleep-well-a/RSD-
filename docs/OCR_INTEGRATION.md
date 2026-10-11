# OCR 集成指南 — RSD & 含量计算器

> 本文档说明如何启动 OCR 后端服务并与 PWA 前端集成。
> 生成时间：2026-10-11（v54.325）

## 目录

1. [架构](#架构)
2. [启动 OCR 后端](#启动-ocr-后端)
3. [API 参考](#api-参考)
4. [前端集成示例](#前端集成示例)
5. [字段配置](#字段配置)
6. [后端选择与限制](#后端选择与限制)

---

## 架构

```
┌─────────────────────┐    HTTP POST /ocr/extract     ┌─────────────────────┐
│  PWA 浏览器          │ ──────────────────────────► │  ocr_server.py      │
│  (GitHub Pages)     │ ◄────────────────────────── │  (Flask :8766)      │
│  PDF 上传 UI         │     { fields: {...} }       │     │                │
└─────────────────────┘                                │     ▼                │
                                                       │  run_pipeline.py     │
                                                       │  (paddleocr skill)   │
                                                       │     │                │
                                                       │     ▼                │
                                                       │  RapidOCR / 百度     │
                                                       │  / Claude / GLM     │
                                                       └─────────────────────┘
```

PWA 在浏览器（GitHub Pages），OCR 服务在用户机器 `localhost:8766`。跨域通过 CORS 头解决。

---

## 启动 OCR 后端

```bash
# 前置：paddleocr skill 已装好（C:\Users\sleep well\.claude\skills\paddleocr\）
# 前置：Python 依赖 flask、rapidocr-onnxruntime 已安装

# 启动（默认端口 8766）
python tools/ocr_server.py

# 自定义端口
python tools/ocr_server.py --port 8888

# 健康检查
curl http://localhost:8766/health
# 返回：{"ok": true, "paddleocr_skill": true, "runner_exists": true, ...}
```

OCR 后端跑在后台，PWA 前端即可调用。

---

## API 参考

### GET /health

健康检查（无需参数）。

**响应**：
```json
{
  "ok": true,
  "service": "rsd-ocr-server",
  "paddleocr_skill": true,
  "runner_exists": true,
  "output_dir": "C:\\Users\\...\\Temp\\rsd_ocr_jobs"
}
```

### POST /ocr/extract

上传 PDF 跑 OCR 抽取字段。

**请求**（multipart/form-data）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pdf` | file | ✅ | PDF 文件 |
| `keys` | string | ❌ | 逗号分隔字段名（默认 `RSD,含量,回收率,均值,标准差,样品名,批号`）|
| `backend` | string | ❌ | `local` / `baidu` / `vision` / `glm`（默认 `local`）|

**响应**：
```json
{
  "fields": {
    "RSD": {"value": "2.5%", "confidence": 0.92, "page": 1},
    "含量": {"value": "98.7%", "confidence": 0.95, "page": 1},
    "样品名": {"value": "Aspirin", "confidence": 0.99, "page": 1}
  },
  "report_url": "/reports/20261011_143022_123/report.html",
  "elapsed_sec": 12.3,
  "pages": 3,
  "job_id": "20261011_143022_123",
  "backend": "local",
  "keys": ["RSD", "含量", "回收率"]
}
```

**错误**：
- 400：缺少 PDF / 非 PDF 文件
- 500：pipeline 失败（stderr 在响应里）

### GET /reports/<job_id>/report.html

获取 OCR 生成的 HTML 报告（Pipeline 的可视化输出）。

---

## 前端集成示例

### 最小集成（PWA → fetch 上传）

```javascript
async function uploadPDF(pdfFile) {
  const formData = new FormData();
  formData.append('pdf', pdfFile);
  formData.append('keys', 'RSD,含量,回收率,样品名');
  formData.append('backend', 'local');

  const resp = await fetch('http://localhost:8766/ocr/extract', {
    method: 'POST',
    body: formData,
  });
  const data = await resp.json();
  if (data.error) {
    console.error('OCR 失败:', data.error);
    return null;
  }
  console.log('抽取字段:', data.fields);
  return data.fields;
}

// 用法
const file = document.querySelector('input[type=file]').files[0];
const fields = await uploadPDF(file);
// 填入计算器表单
if (fields?.RSD?.value) document.querySelector('#rsd-input').value = fields.RSD.value;
```

### UI 推荐结构

```html
<div id="ocr-uploader">
  <input type="file" id="pdf-input" accept=".pdf">
  <button id="ocr-btn">📄 抽取 PDF 字段</button>
  <div id="ocr-status"></div>
  <div id="ocr-results"></div>
</div>
```

### 错误处理

- **fetch 失败**：OCR 服务未启动。提示用户运行 `python tools/ocr_server.py`。
- **CORS 错误**：浏览器拒绝跨域。检查 `Access-Control-Allow-Origin: *` 头。
- **504 timeout**：pipeline >180s。考虑文档拆分或换 backend。

---

## 字段配置

默认抽取字段（针对 RSD & 含量计算器）：

```
RSD, 含量, 回收率, 均值, 标准差, 样品名, 批号
```

自定义：在 `keys` 参数传逗号分隔列表。prompt 模板：

```python
f'请从报告中提取{key}（含数值与单位）'
```

如需更精准抽取，编辑 `tools/ocr_server.py` 的 `DEFAULT_KEYS` 或扩展 prompt。

---

## 后端选择与限制

| 后端 | 速度 | 精度 | 费用 | 限制 |
|---|---|---|---|---|
| **local** (RapidOCR) | 4-8s/页 | 中（公式/手写差）| 免费 | 中文表格佳，复杂版式差 |
| **baidu** (百度 OCR) | 1-2s/页 | 高 | 按次 ¥0.01-0.05 | 需 `BAIDU_API_KEY` |
| **vision** (Claude vision) | 3-5s/页 | 极高 | 按 token 收费 | 需 `ANTHROPIC_API_KEY` |
| **glm** (智谱 GLM) | 2-4s/页 | 高 | 免费层 64K-128K | 需 `ZHIPUAI_API_KEY` |

**推荐**：
- **本地测试**：local（默认）
- **生产环境**：vision（最准）或 glm（免费层可用）
- **离线 / 敏感数据**：local（无云端调用）

### 环境变量

```bash
# 百度 OCR（baidu backend）
export BAIDU_API_KEY=xxx
export BAIDU_SECRET_KEY=xxx

# Claude vision（vision backend）
export ANTHROPIC_API_KEY=xxx

# 智谱 GLM（glm backend）
export ZHIPUAI_API_KEY=xxx
```

---

## 已知限制

1. **跨域**：浏览器 PWA 调用 localhost 服务受 CORS 限制（已配 `*`）。生产环境应限制 origin。
2. **同步等待**：PDF 大或多页时，pipeline 耗时 10-60s。PWA 应显示进度。
3. **并发**：当前 `threaded=True`，并发请求会启动多个 subprocess。资源受限时建议加 queue。
4. **临时目录**：report.html 存在 `%TEMP%\rsd_ocr_jobs\`。重启后丢失。
5. **错误恢复**：pipeline 失败的 stderr 仅返回最后 500 字符。完整日志需直接跑 `run_pipeline.py`。

---

## 下一步

如要继续 OCR 集成（v54.326+）：

1. **PWA 前端集成**：PDF 上传 UI + 抽取结果展示 + 一键填表单
2. **进度轮询**：长任务改成 `/ocr/start` 返回 job_id，`/ocr/status/<id>` 轮询
3. **缓存层**：同一 PDF 不重复抽取，结果缓存到 localStorage
4. **可视化报告嵌入**：在 PWA iframe 显示 OCR 生成的 report.html

参见 [docs/TWA_DEPLOYMENT.md](TWA_DEPLOYMENT.md)（OCR 是 PWA 的延伸能力）。

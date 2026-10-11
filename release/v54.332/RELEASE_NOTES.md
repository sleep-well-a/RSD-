# RSD & 含量计算器 v54.332 发布说明

**发布日期**：2026-10-11
**前版本**：v54.331

## 📡 真实 OCR 进度轮询（后端拆分 + 前端 polling）

v54.328 的"前端推算阶段"基于 elapsed 时间估算，阶段边界不准确。v54.332 实现**真实进度轮询**——后端解析 paddleocr skill 输出的阶段信息（"Stage 1 拆页" / "Stage 2A" / "Stage 2B 表格" / "Stage 2C 字段" / "Stage 3 聚合"），通过 `status.json` 暴露给前端。

### 改动

#### 1. 后端拆分（tools/ocr_server.py 重写）

**新增端点**：
- `POST /ocr/start`：上传 PDF → 启动后台 thread → 立即返回 `{job_id, status_url}`
- `GET /ocr/status/<job_id>`：读 `status.json` → 返回 `{status, stage, progress, result, error}`
- `POST /ocr/extract`：保留同步版本（兜底，老前端兼容）

**后台 thread + status.json**：
```python
def run_pipeline_background(job_dir, pdf_path, keys, backend):
    proc = subprocess.Popen(cmd, stdout=PIPE, stderr=STDOUT, text=True)
    for line in proc.stdout:
        stage = parse_stage(line)  # 解析 "Stage 1 拆页" 等
        if stage:
            write_status(job_dir, {...stage 信息...})
    proc.wait(timeout=180)
    write_status(job_dir, {status: 'done', result: ...})
```

**阶段映射**：
| run_pipeline 输出 | stage |
|---|---|
| `Stage 1 拆页` | split (20%) |
| `Stage 2A` | text (50%) |
| `Stage 2B 表格` | table (70%) |
| `Stage 2C 字段` | keys (80%) |
| `Stage 3 聚合` | done (95%) |

#### 2. 前端 polling（app.js）

```js
async function pollOcrJob(job_id, statusDiv) {
  const start = Date.now();
  while (true) {
    const resp = await fetch(OCR_ENDPOINT + '/ocr/status/' + job_id);
    const data = await resp.json();
    if (data.status === 'done') return data.result;
    if (data.status === 'error') return { error: data.error };
    // running → 更新 status 显示真实阶段
    statusDiv.textContent = i18n('ocrProgressFmt')
      .replace('{0}', i18n('ocrStage' + data.stage))
      .replace('{1}', Math.round((Date.now() - start) / 1000));
    if (Date.now() - start > 200000) return { error: '轮询超时' };
    await sleep(1500);
  }
}
```

**优雅降级**：如果后端没升级（无 /ocr/start），自动回退到 /ocr/extract。

#### 3. Puppeteer 测试（30/30 PASS）

**核心变化**：所有 mock 改为 polling-aware（start + status 双端点）。修 stack overflow bug：
- 旧 mock 用 `new Response()` 抛 stack overflow
- 新 mock 用纯对象 `{ok, status, json: () => Promise.resolve(data)}`
- mock 共享 `window.__originalFetch`（避免递归）

**新增断言**：
- fetch 调用是 START + STATUS = 2 calls（不是 1）
- 错误路径 mock 通过 `__ocrMode = 'error'` 切换
- 缓存命中时 fetch 调用数不再增加

### 累计统计（v54.298 → v54.332）

- **Puppeteer 套件**：58 → 75（+17）
- **断言总数**：~1100 → ~1390（+290）
- **新发布版本**：35 个
- **新工具**：20 个（含 ocr_server.py v54.332）
- **OCR 端到端**：8 个版本（v54.325 后端 / v54.326 前端 / v54.327 应用 / v54.328 进度 / v54.329 缓存 / v54.330 报告 / v54.331 批处理 / **v54.332 真实进度**）

### 完整 OCR 链路

```
PDF 上传 → /ocr/start（异步启动 + 拿 job_id）
  ↓ 后台 thread
paddleocr skill 4 阶段（实时写 status.json）
  ↓
前端每 1.5 秒轮询 /ocr/status/<id>
  ↓ 显示真实阶段 + progress + elapsed
done → 渲染字段 → 一键应用 + 报告嵌入 + 缓存
```

### Puppeteer 测试结果

| 套件 | v54.331 | v54.332 |
|---|---|---|
| `round52_ocr` | 30/30 | **30/30**（mock 升级 + 新断言）|
| `round48_i18n_sync` | 18/18 | 18/18 |
| `round35_critical` | 49/49 | 49/49 |
| `audit_round17` | 26/26 | 26/26 |
| `pwa_e2e` | 16/16 | 16/16 |

**Puppeteer 总计**：75 套件（约 1390 断言）。

## 发布包

- 文件：`RSD-含量计算器-v54.332.zip`
- 流动相版：`RSD & 含量计算器_流动相版_v54.332.html`
- 后端：tools/ocr_server.py 重写（拆分 start + status 端点）
- 前端：app.js 加 pollOcrJob 函数 + 优雅降级
- 测试：round52_ocr mock 全面升级（polling-aware）

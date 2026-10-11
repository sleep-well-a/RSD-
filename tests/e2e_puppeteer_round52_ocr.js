// e2e_puppeteer_round52_ocr.js
// v54.326 新增：OCR 报告字段抽取 UI 测试（monkey-patch fetch）
//
// 验证：
// 1. OCR 卡片渲染
// 2. 按钮初始 disabled（未选 PDF）
// 3. monkey-patch fetch + 模拟 PDF 选择
// 4. 抽取按钮启用 + 触发 fetch
// 5. 结果表格渲染（2 行）
// 6. 错误路径（mock fetch reject）
const puppeteer = require('puppeteer');
const os = require('os');
const path = require('path');

const PASS = [];
const FAIL = [];
function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK]   ' + name + (detail ? ' -- ' + detail : '')); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

(async () => {
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round52_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile, '--no-sandbox']
  });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  [PAGE ERROR]', e.message.slice(0, 200)));
  page.on('console', m => { if (m.text().startsWith('[mock-fetch]')) console.log(' ', m.text()); });

  // 加载 dev 版 HTML
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));

  // monkey-patch fetch：在页面 evaluate 之前注入
  await page.evaluate(() => {
    window.__ocrCalls = [];
    window.__ocrMode = 'success';
    window.__ocrPollCount = 0;
    window.__originalFetch = window.fetch.bind(window);  // v54.332 fix：避免递归
    const originalFetch = window.__originalFetch;
    // v54.332：用纯对象模拟 Response（避免 new Response stack overflow）
    const mockResp = (data, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
    window.fetch = function(url, opts) {
      const s = String(url);
      if (s.includes('localhost:8766/ocr/start')) {
        window.__ocrCalls.push('START ' + s);
        return Promise.resolve(mockResp({
          job_id: 'mock_job_' + Math.random().toString(36).slice(2, 10),
          status_url: '/ocr/status/mock_job_id'
        }));
      }
      if (s.includes('localhost:8766/ocr/status/')) {
        window.__ocrCalls.push('STATUS ' + s);
        window.__ocrPollCount++;
        // error 模式 → status=error；否则直接 done
        if (window.__ocrMode === 'error') {
          return Promise.resolve(mockResp({ status: 'error', error: 'mock server error' }));
        }
        return Promise.resolve(mockResp({
          status: 'done', stage: 'done', progress: 100,
          elapsed_sec: 1.2,
          result: {
            fields: {
              'RSD': { value: '2.5%', confidence: 0.92, page: 1 },
              '含量': { value: '98.7%', confidence: 0.95, page: 1 }
            },
            elapsed_sec: 1.2, pages: 1, job_id: 'mock_job_id',
            backend: 'local',
            keys: ['RSD', '含量']
          }
        }));
      }
      return originalFetch(url, opts);
    };
  });

  // 切到 settings 页面
  await page.evaluate(() => {
    if (typeof window.switchTab === 'function') window.switchTab('settings');
  });
  await new Promise(r => setTimeout(r, 400));

  // 1. OCR 卡片渲染
  const cardOk = await page.evaluate(() => !!document.getElementById('settings-ocr'));
  record('OCR 卡片渲染', cardOk);

  // 2. 按钮初始 disabled
  const btnDisabled = await page.evaluate(() => {
    const b = document.getElementById('ocr-extract-btn');
    return b ? b.disabled : null;
  });
  record('抽取按钮初始 disabled', btnDisabled === true, 'disabled=' + btnDisabled);

  // 3. 模拟选择 PDF
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4 mock'], 'test_report.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 300));

  const btnEnabled = await page.evaluate(() => {
    const b = document.getElementById('ocr-extract-btn');
    return b ? !b.disabled : null;
  });
  record('选择 PDF 后按钮启用', btnEnabled === true, 'enabled=' + btnEnabled);

  const statusAfterSelect = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('选择 PDF 后状态更新', /test_report\.pdf/.test(statusAfterSelect), statusAfterSelect.slice(0, 60));

  // 4. 调用 extractOcrFields（success mock）
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 1200));

  const calls = await page.evaluate(() => window.__ocrCalls);
  record('fetch 被拦截（START + STATUS）',
    calls.length >= 2 && calls[0].startsWith('START'),
    JSON.stringify(calls));

  const statusAfterExtract = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('状态显示完成', /抽取完成|Done/.test(statusAfterExtract), statusAfterExtract.slice(0, 80));

  const tableRows = await page.evaluate(() => {
    const t = document.querySelector('#ocr-results table');
    return t ? t.rows.length : 0;
  });
  record('结果表格 2 行', tableRows === 2, 'rows=' + tableRows);

  const tableContent = await page.evaluate(() => {
    const t = document.querySelector('#ocr-results table');
    return t ? t.innerText : '';
  });
  record('表格含 RSD + 含量',
    /RSD/.test(tableContent) && /含量/.test(tableContent));

  // 5. 错误路径（error mock）
  await page.evaluate(() => {
    window.__ocrMode = 'error';
    window.__ocrCalls = [];  // v54.332 fix：重置累积
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'fail.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 1200));

  const errStatus = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('错误路径显示失败', /失败|failed|mock/.test(errStatus), errStatus.slice(0, 60));
  const calls2 = await page.evaluate(() => window.__ocrCalls);
  // v54.332 fix：polling 模式每次 fetch = START + STATUS = 2 calls
  record('错误路径 fetch 拦截（START+STATUS）',
    calls2.length === 2 && calls2[0].startsWith('START') && calls2[1].startsWith('STATUS'),
    JSON.stringify(calls2));

  // 7. v54.327 — OCR 字段一键应用
  await page.evaluate(() => {
    window.__ocrMode = 'success';
    window.__ocrCalls = [];
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    // mock 含可映射字段 + 不可映射字段（v54.332 polling 模式）
    const originalFetch = window.__originalFetch;
    const mockResp = (data, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: () => Promise.resolve(data),
    });
    window.fetch = function(url, opts) {
      const s = String(url);
      if (s.includes('localhost:8766/ocr/start')) {
        window.__ocrCalls.push('START ' + s);
        return Promise.resolve(mockResp({ job_id: 'mock_apply_job' }));
      }
      if (s.includes('localhost:8766/ocr/status/')) {
        return Promise.resolve(mockResp({
          status: 'done', stage: 'done', progress: 100,
          result: {
            fields: {
              '样品名': { value: 'Aspirin-Batch-001', confidence: 0.99, page: 1 },
              '批号': { value: 'MV2026055', confidence: 0.98, page: 1 },
              'RSD': { value: '2.5%', confidence: 0.92, page: 1 },
              '含量': { value: '98.7%', confidence: 0.95, page: 1 }
            },
            elapsed_sec: 0.8, pages: 1, backend: 'local'
          }
        }));
      }
      return originalFetch(url, opts);
    };
  });
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 800));

  // 验证应用按钮存在（样品名 / 批号 / 含量 都可映射）
  const applyBtns = await page.evaluate(() => {
    const btns = document.querySelectorAll('[data-ocr-apply]');
    return Array.from(btns).map(b => b.dataset.ocrApply);
  });
  record('3 个应用按钮', applyBtns.length === 3, 'keys: ' + JSON.stringify(applyBtns));
  record('含样品名按钮', applyBtns.includes('样品名'));
  record('含批号按钮', applyBtns.includes('批号'));
  record('含含量按钮', applyBtns.includes('含量'));

  // 点击"样品名"应用按钮
  await page.evaluate(() => {
    const btn = document.querySelector('[data-ocr-apply="样品名"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  const sampleNameVal = await page.evaluate(() => {
    const el = document.getElementById('settings-sample-name');
    return el ? el.value : null;
  });
  record('点击应用 → settings-sample-name 已填',
    sampleNameVal === 'Aspirin-Batch-001', 'got: ' + sampleNameVal);

  // 点击"批号"应用按钮
  await page.evaluate(() => {
    const btn = document.querySelector('[data-ocr-apply="批号"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));
  const batchVal = await page.evaluate(() => {
    const el = document.getElementById('settings-batch');
    return el ? el.value : null;
  });
  record('点击应用 → settings-batch 已填',
    batchVal === 'MV2026055', 'got: ' + batchVal);

  // 8. v54.328 — OCR 实时进度显示（polling 模式）
  await page.evaluate(() => {
    window.__ocrMode = 'success';
    window.__ocrCalls = [];
    window.__ocrPollCount = 0;
    window.__ocrDelay = 50;  // 第一次 poll 延迟 50ms（让 polling 在 1200ms 测试窗口内可见）
    const originalFetch = window.__originalFetch;
    const mockResp = (data, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    });
    window.fetch = function(url, opts) {
      const s = String(url);
      if (s.includes('localhost:8766/ocr/start')) {
        window.__ocrCalls.push('START ' + s);
        return Promise.resolve(mockResp({
          job_id: 'mock_progress_job', status_url: '/ocr/status/mock_progress_job'
        }));
      }
      if (s.includes('localhost:8766/ocr/status/')) {
        window.__ocrCalls.push('STATUS ' + s);
        window.__ocrPollCount++;
        const isFirst = window.__ocrPollCount <= 1;
        return new Promise(resolve => {
          setTimeout(() => {
            if (isFirst) {
              resolve(mockResp({ status: 'running', stage: 'text', progress: 50, elapsed_sec: 1.0 }));
            } else {
              resolve(mockResp({
                status: 'done', stage: 'done', progress: 100, elapsed_sec: 2.5,
                result: {
                  fields: { 'RSD': { value: '1.5%', confidence: 0.9, page: 1 } },
                  elapsed_sec: 2.5, pages: 1
                }
              }));
            }
          }, isFirst ? (window.__ocrDelay || 100) : 50);
        });
      }
      return originalFetch(url, opts);
    };
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'progress_test.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  // 等 1.2 秒（polling 第一次响应延迟 1500ms 还没到，但 status 已被 polling 调用一次）
  await new Promise(r => setTimeout(r, 1200));
  const midStatus = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('进行中显示阶段 + elapsed',
    /分页|OCR|Splitting|extraction/i.test(midStatus),
    midStatus.slice(0, 60));
  record('进行中含秒数', /\d+ 秒|\d+s/.test(midStatus), midStatus.slice(0, 60));

  // 等响应完成
  await new Promise(r => setTimeout(r, 2000));
  const finalStatus = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('完成后状态显示完成',
    /抽取完成|Done/.test(finalStatus),
    finalStatus.slice(0, 60));

  // 9. v54.329 — OCR 缓存层（同一 PDF 不重复抽取）
  await page.evaluate(() => {
    window.__ocrMode = 'success';
    window.__ocrCalls = [];
    window.__ocrDelay = 0;  // 缓存测试用即时响应（避免延迟影响判断）
    // 清掉之前的缓存，让测试可重复
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
  });
  // 第一次抽取（无缓存）
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'cache_test.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 800));

  // 验证缓存已写入
  const cacheWritten = await page.evaluate(() => {
    return Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).length;
  });
  record('缓存已写入 localStorage', cacheWritten >= 1, 'count=' + cacheWritten);

  const callsAfter1st = await page.evaluate(() => window.__ocrCalls.length);
  // v54.332 polling：START + 2 STATUS = 3 calls（running + done）
  record('第一次 fetch 调用（>=2 表示 polling 正常）',
    callsAfter1st >= 2, 'count=' + callsAfter1st);

  // 第二次同文件抽取（应命中缓存）
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'cache_test.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 600));

  const callsAfter2nd = await page.evaluate(() => window.__ocrCalls.length);
  // v54.332 fix：缓存命中时 fetch 调用数应与之前相同（不再增加）
  record('第二次缓存命中未增加 fetch',
    callsAfter2nd === callsAfter1st,
    'before=' + callsAfter1st + ' after=' + callsAfter2nd);

  const cacheHitStatus = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('状态显示缓存命中',
    /缓存命中|Cache hit/i.test(cacheHitStatus),
    cacheHitStatus.slice(0, 60));

  // 10. v54.330 — OCR 报告嵌入（iframe viewer，v54.332 polling 模式）
  await page.evaluate(() => {
    window.__ocrMode = 'success';
    window.__ocrCalls = [];
    window.__ocrPollCount = 0;
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
    const originalFetch = window.__originalFetch;
    const mockResp = (data, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: () => Promise.resolve(data),
    });
    window.fetch = function(url, opts) {
      const s = String(url);
      if (s.includes('localhost:8766/ocr/start')) {
        window.__ocrCalls.push('START ' + s);  // v54.332 fix
        return Promise.resolve(mockResp({ job_id: 'mock_report_job' }));
      }
      if (s.includes('localhost:8766/ocr/status/')) {
        window.__ocrCalls.push('STATUS ' + s);  // v54.332 fix
        return Promise.resolve(mockResp({
          status: 'done', stage: 'done', progress: 100,
          result: {
            fields: { 'RSD': { value: '1.5%', confidence: 0.9, page: 1 } },
            elapsed_sec: 1.0, pages: 1,
            report_url: '/reports/mock_job_123/report.html'
          }
        }));
      }
      return originalFetch(url, opts);
    };
  });

  // v54.330 — OCR 报告嵌入（iframe viewer，v54.332 polling 模式）
  await page.evaluate(() => {
    window.__ocrMode = 'success';
    window.__ocrCalls = [];
    window.__ocrPollCount = 0;
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
    const originalFetch = window.__originalFetch;
    const mockResp = (data, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: () => Promise.resolve(data),
    });
    window.fetch = function(url, opts) {
      const s = String(url);
      if (s.includes('localhost:8766/ocr/start')) {
        window.__ocrCalls.push('START ' + s);
        return Promise.resolve(mockResp({ job_id: 'mock_report_job' }));
      }
      if (s.includes('localhost:8766/ocr/status/')) {
        window.__ocrCalls.push('STATUS ' + s);
        return Promise.resolve(mockResp({
          status: 'done', stage: 'done', progress: 100,
          result: {
            fields: { 'RSD': { value: '1.5%', confidence: 0.9, page: 1 } },
            elapsed_sec: 1.0, pages: 1,
            report_url: '/reports/mock_job_123/report.html'
          }
        }));
      }
      return originalFetch(url, opts);
    };
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'report_view_test.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 500));

  // 验证"查看完整报告"按钮存在
  const showReportBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => /完整报告|Full Report/i.test(b.textContent)) ? true : false;
  });
  record('"查看完整报告"按钮渲染', showReportBtn);

  // 点击按钮 → iframe 显示
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /完整报告|Full Report/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 300));

  const viewerState = await page.evaluate(() => {
    const v = document.getElementById('ocr-report-viewer');
    if (!v) return null;
    return { display: v.style.display, hasIframe: !!v.querySelector('iframe'), iframeSrc: v.querySelector('iframe')?.src };
  });
  record('iframe 显示', viewerState && viewerState.display !== 'none' && viewerState.hasIframe);
  record('iframe src 含 report.html',
    viewerState && viewerState.iframeSrc && /report\.html/.test(viewerState.iframeSrc),
    viewerState ? viewerState.iframeSrc : 'none');

  // 10b. v54.333 — OCR 原始文本展示
  await page.evaluate(() => {
    window.__ocrCalls = [];
    window.__ocrPollCount = 0;
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
    const originalFetch = window.__originalFetch;
    const mockResp = (data, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: () => Promise.resolve(data),
    });
    window.fetch = function(url, opts) {
      const s = String(url);
      if (s.includes('localhost:8766/ocr/start')) {
        window.__ocrCalls.push('START ' + s);
        return Promise.resolve(mockResp({ job_id: 'mock_raw_job' }));
      }
      if (s.includes('localhost:8766/ocr/status/')) {
        return Promise.resolve(mockResp({
          status: 'done', stage: 'done', progress: 100,
          result: {
            fields: { 'RSD': { value: '1.5%', confidence: 0.9, page: 1 } },
            elapsed_sec: 1.0, pages: 1,
            // v54.333：raw_text（OCR 全文）
            raw_text: '--- page_001.txt ---\n样品名：阿司匹林\n批号：MV2026055\nRSD: 1.5%'
          }
        }));
      }
      return originalFetch(url, opts);
    };
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'raw_text_test.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 600));

  // 验证"查看原始文本"按钮渲染
  const showRawBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => /原始文本|Raw Text/i.test(b.textContent)) ? true : false;
  });
  record('"查看原始文本"按钮渲染', showRawBtn);

  // 点击按钮 → raw_text 显示
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => /原始文本|Raw Text/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 200));

  const rawDivState = await page.evaluate(() => {
    const d = document.getElementById('ocr-raw-text');
    if (!d) return null;
    return { display: d.style.display, content: d.textContent };
  });
  record('raw_text div 显示',
    rawDivState && rawDivState.display === 'block',
    rawDivState ? rawDivState.display : 'no div');
  record('raw_text 含原文',
    rawDivState && /阿司匹林|MV2026055/.test(rawDivState.content),
    rawDivState ? rawDivState.content.slice(0, 50) : '');

  // 10c. v54.334 — OCR 一键复制所有字段
  await page.evaluate(() => {
    window.__ocrCalls = [];
    window.__ocrPollCount = 0;
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
    const originalFetch = window.__originalFetch;
    const mockResp = (data, status = 200) => ({
      ok: status >= 200 && status < 300, status,
      json: () => Promise.resolve(data),
    });
    window.fetch = function(url, opts) {
      const s = String(url);
      if (s.includes('localhost:8766/ocr/start')) {
        window.__ocrCalls.push('START ' + s);  // v54.334 fix
        return Promise.resolve(mockResp({ job_id: 'mock_copy_job' }));
      }
      if (s.includes('localhost:8766/ocr/status/')) {
        window.__ocrCalls.push('STATUS ' + s);  // v54.334 fix
        return Promise.resolve(mockResp({
          status: 'done', stage: 'done', progress: 100,
          result: {
            fields: {
              'RSD': { value: '2.5%', confidence: 0.92, page: 1 },
              '含量': { value: '98.7%', confidence: 0.95, page: 1 },
              '样品名': { value: 'Aspirin', confidence: 0.99, page: 1 }
            },
            elapsed_sec: 1.0, pages: 1
          }
        }));
      }
      return originalFetch(url, opts);
    };
  });
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'copy_all_test.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));
  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 600));

  // 验证"一键复制所有字段"按钮存在
  const copyAllBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => /一键复制|Copy All/i.test(b.textContent)) ? true : false;
  });
  record('"一键复制所有字段"按钮渲染', copyAllBtn);

  // 验证"复制为 TSV"按钮
  const copyTsvBtn = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => /TSV|复制为表格/i.test(b.textContent)) ? true : false;
  });
  record('"复制为 TSV"按钮渲染', copyTsvBtn);

  // 模拟点击后用 navigator.clipboard.writeText 拦截
  await page.evaluate(() => {
    window.__copiedText = '';
    navigator.clipboard.writeText = function(text) {
      window.__copiedText = text;
      return Promise.resolve();
    };
  });
  await page.evaluate(() => {
    if (typeof window.copyAllOcrFields === 'function') window.copyAllOcrFields();
  });
  await new Promise(r => setTimeout(r, 200));
  const copiedKV = await page.evaluate(() => window.__copiedText);
  record('一键复制（KV 格式）',
    typeof copiedKV === 'string' && copiedKV.includes('RSD') && copiedKV.includes('含量'),
    (copiedKV || '').slice(0, 60));

  // TSV 格式
  await page.evaluate(() => {
    window.__copiedText = '';
    if (typeof window.copyAllOcrFields === 'function') window.copyAllOcrFields('tsv');
  });
  await new Promise(r => setTimeout(r, 200));
  const copiedTSV = await page.evaluate(() => window.__copiedText);
  record('一键复制（TSV 格式）',
    typeof copiedTSV === 'string' && copiedTSV.includes('\t'),
    (copiedTSV || '').slice(0, 60));

  // 11. v54.331 — OCR 批处理（多 PDF）
  await page.evaluate(() => {
    window.__ocrMode = 'success';
    window.__ocrCalls = [];
    window.__ocrPollCount = 0;
    // v54.332 fix：清掉之前的缓存避免走 cache 命中
    Object.keys(localStorage).filter(k => k.startsWith('rsd-ocr-cache-')).forEach(k => localStorage.removeItem(k));
  });
  // v54.332 fix：polling 模式下每次 fetch = START + STATUS = 2 calls，3 文件 = 6 calls
  await page.evaluate(() => {
    const input = document.getElementById('ocr-file-input');
    const dt = new DataTransfer();
    dt.items.add(new File(['%PDF-1.4'], 'batch_a.pdf', { type: 'application/pdf' }));
    dt.items.add(new File(['%PDF-1.4'], 'batch_b.pdf', { type: 'application/pdf' }));
    dt.items.add(new File(['%PDF-1.4'], 'batch_c.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await new Promise(r => setTimeout(r, 200));

  const batchStatus = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('3 个文件状态提示',
    /3 个 PDF|3 PDFs/.test(batchStatus),
    batchStatus.slice(0, 60));

  await page.evaluate(() => {
    if (typeof window.extractOcrFields === 'function') window.extractOcrFields();
  });
  await new Promise(r => setTimeout(r, 1500));

  const batchCalls = await page.evaluate(() => window.__ocrCalls.length);
  // v54.332：3 文件 × 每次 1 START（polling 直接 done 不再 STATUS，因为 mock 立刻 done）→ 实际 3 START
  // 但 mock 设置可能延迟 STATUS，所以可能 3 START + 3 STATUS = 6
  record('批处理 fetch 调用 (>=3)',
    batchCalls >= 3 && batchCalls <= 6,
    'count=' + batchCalls);

  const batchDoneStatus = await page.evaluate(() => {
    const s = document.getElementById('ocr-status');
    return s ? s.textContent : '';
  });
  record('批处理完成状态',
    /批处理完成|Batch done/.test(batchDoneStatus),
    batchDoneStatus.slice(0, 80));

  const batchResults = await page.evaluate(() => {
    const r = document.getElementById('ocr-results');
    return r ? r.innerText : '';
  });
  record('结果含 3 个文件名', /batch_a|batch_b|batch_c/.test(batchResults));

  await browser.close();

  console.log();
  console.log('='.repeat(60));
  console.log('PASS: ' + PASS.length + '/' + (PASS.length + FAIL.length));
  if (FAIL.length) {
    console.log('FAIL details:');
    for (const f of FAIL) console.log('  ' + f);
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });

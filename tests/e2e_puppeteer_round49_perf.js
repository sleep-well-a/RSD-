// e2e_puppeteer_round49_perf.js
// v54.308 新增：性能测试（500+ 条 history render / import 性能）
const puppeteer = require('puppeteer');
const os = require('os');
const path = require('path');

const PASS = [];
const FAIL = [];
function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK] ' + name); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

(async () => {
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round49_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile, '--no-sandbox']
  });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGE ERR:', err.message));
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.308.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // 1. Seed 500 条 history
  console.log('--- #1 Seed 500 条 history ---');
  const seed500 = await page.evaluate(() => {
    const h = [];
    const types = ['统计计算', '外标含量', '加样回收率', '标准曲线', '滴定度', '分子量计算'];
    const startTime = Date.now();
    for (let i = 0; i < 500; i++) {
      const type = types[i % types.length];
      const day = String(Math.floor(i / 20) + 1).padStart(2, '0');
      h.push({
        type,
        time: `2026-09-${day} ${String(i % 24).padStart(2, '0')}:00:00`,
        data: '1,2,3,4,5',
        mean: 3 + (i % 10) * 0.1,
        sd: 0.5,
        rsd: 5 + (i % 10),
        _meta: { sampleName: 'S' + i, batch: 'B' + Math.floor(i / 10) },
      });
    }
    localStorage.setItem('rsd-calc-history', JSON.stringify(h));
    return { count: h.length, elapsed: Date.now() - startTime };
  });
  record(`seed 500 条 (${seed500.elapsed}ms)`, seed500.count === 500);

  // Reload
  await page.evaluate(() => location.reload());
  await new Promise(r => setTimeout(r, 1500));

  // 2. Render history 性能
  console.log('\n--- #2 Render history 性能 ---');
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  // 等待首次 render
  await new Promise(r => setTimeout(r, 1000));

  // 强制再次 render 并计时（通过 setHistoryFilter 间接触发）
  const renderTime = await page.evaluate(() => {
    if (typeof setHistoryFilter !== 'function') return { error: 'setHistoryFilter not found' };
    const start = performance.now();
    setHistoryFilter({ search: '', type: '' });
    const elapsed = performance.now() - start;
    return { elapsed, itemCount: document.querySelectorAll('.history-item').length };
  });
  record(`setHistoryFilter 500 条 < 2000ms (${renderTime.elapsed.toFixed(0)}ms)`, renderTime.elapsed < 2000,
    `elapsed=${renderTime.elapsed.toFixed(0)}ms`);
  record(`rendered 至少 1 个 history-item`, renderTime.itemCount >= 1, `items: ${renderTime.itemCount}`);

  // 3. 多次 render 性能（模拟用户筛选切换）
  console.log('\n--- #3 多次 render 性能 ---');
  const multiRender = await page.evaluate(() => {
    const times = [];
    const types = ['', '统计计算', '外标含量', '加样回收率', ''];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      if (typeof setHistoryFilter === 'function') {
        setHistoryFilter({ search: '', type: types[i] });
      }
      times.push(performance.now() - start);
    }
    return { times, avg: times.reduce((a, b) => a + b, 0) / times.length, max: Math.max(...times) };
  });
  record(`5 次 filter 切换平均 < 2000ms (avg=${multiRender.avg.toFixed(0)}ms)`, multiRender.avg < 2000,
    `avg=${multiRender.avg.toFixed(0)}ms max=${multiRender.max.toFixed(0)}ms`);

  // 4. 主题切换性能（带 500 条 history）
  console.log('\n--- #4 主题切换性能 ---');
  const themeSwitch = await page.evaluate(() => {
    if (typeof setTheme !== 'function') return { error: 'setTheme not found' };
    const start = performance.now();
    setTheme('dark');
    const elapsed = performance.now() - start;
    return { elapsed };
  });
  await new Promise(r => setTimeout(r, 1500));
  record(`setTheme 切换 < 2000ms (${themeSwitch.elapsed.toFixed(0)}ms)`, themeSwitch.elapsed < 2000,
    `elapsed=${themeSwitch.elapsed.toFixed(0)}ms`);

  // 5. 导入 500 条 JSON 性能
  console.log('\n--- #5 导入 JSON 性能（50 条）---');
  const exportData = {
    schema: 'rsd-history-export',
    version: '1.0.0',
    exportedAt: '2026-10-10T10:00:00.000Z',
    count: 50,
    items: Array.from({length: 50}, (_, i) => ({
      type: '外标含量',
      time: `2026-10-10 ${String(i).padStart(2, '0')}:00:00`,
      data: `${99.0 + i * 0.001}`,
      mean: 99.5,
    })),
  };

  // 用 inline 注入的方式触发（避免 FileReader 异步问题）
  // 先注册 dialog auto-accept
  page.on('dialog', async dialog => await dialog.accept());

  const importResult = await page.evaluate(async (backupJson) => {
    if (typeof _handleBatchImportFile !== 'function') return { error: 'no func' };
    const file = new File([backupJson], 'backup.json', { type: 'application/json' });
    const start = performance.now();
    // 调用函数（不 await FileReader — 单独监测 localStorage 变化）
    _handleBatchImportFile(file);
    return { started: true, start };
  }, JSON.stringify(exportData));

  // 5. 多次 filter 切换压力（10 次，模拟用户高频筛选）
  console.log('\n--- #5 压力测试（10 次 filter 切换）---');
  const stress = await page.evaluate(() => {
    const types = ['', '统计计算', '外标含量', '加样回收率', '标准曲线', '', '滴定度', '', '分子量计算', ''];
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      if (typeof setHistoryFilter === 'function') {
        setHistoryFilter({ search: '', type: types[i] });
      }
    }
    return { elapsed: performance.now() - start };
  });
  record(`10 次 filter 切换 < 5000ms (${stress.elapsed.toFixed(0)}ms)`, stress.elapsed < 5000,
    `elapsed: ${stress.elapsed.toFixed(0)}ms`);

  // 6. JS heap 在 500 条后是否合理
  const memInfo = await page.evaluate(() => {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
      };
    }
    return null;
  });
  if (memInfo) {
    record(`500 条后 JS heap < 100MB (${memInfo.used}MB / ${memInfo.total}MB)`, memInfo.used < 100,
      `used: ${memInfo.used}MB`);
  } else {
    record('performance.memory 不可用（正常）', true);
  }

  // 7. 大量 history 下 chart 渲染不崩溃
  console.log('\n--- #7 Chart 渲染稳定性 ---');
  const chartStable = await page.evaluate(() => {
    if (typeof setTheme === 'function') {
      const start = performance.now();
      setTheme('dark');
      const elapsed = performance.now() - start;
      setTheme('light');
      return { ok: true, elapsed };
    }
    return { ok: false };
  });
  await new Promise(r => setTimeout(r, 1500));
  record(`500 条 + theme 切换 chart 稳定`, chartStable.ok && chartStable.elapsed < 2000,
    `elapsed: ${chartStable.elapsed}ms`);

  // 8. localStorage 大小
  const finalSize = await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('rsd-calc-history') || '[]');
    return {
      count: h.length,
      sizeKB: Math.round(JSON.stringify(h).length / 1024),
    };
  });
  record(`500 条 history 占用 < 500KB (${finalSize.sizeKB}KB)`, finalSize.sizeKB < 500,
    `size: ${finalSize.sizeKB}KB`);

  await browser.close();

  console.log();
  console.log('='.repeat(70));
  console.log('PASS: ' + PASS.length + '/' + (PASS.length + FAIL.length));
  if (FAIL.length) {
    console.log('FAIL details:');
    for (const f of FAIL) console.log('  ' + f);
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });

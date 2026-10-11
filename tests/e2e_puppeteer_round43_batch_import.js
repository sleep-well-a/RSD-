// e2e_puppeteer_round43_batch_import.js
// v54.304 新增：批量导入 JSON 测试
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PASS = [];
const FAIL = [];
function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK] ' + name); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

(async () => {
  // 用临时 userDataDir 隔离 localStorage（避免测试间状态污染）
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round43_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.304.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Seed 1 条历史（让 batch bar 渲染）
  await page.evaluate(() => {
    const h = [{ type: '统计计算', time: '2026-10-09 12:00', data: '1,2,3', mean: 2, sd: 1, rsd: 50 }];
    localStorage.setItem('rsd-calc-history', JSON.stringify(h));
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 1. 按钮存在性
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 1500));

  const btns = await page.evaluate(() => ({
    export: !!document.querySelector('button[data-batch-action="export"]'),
    exportMd: !!document.querySelector('button[data-batch-action="export-md"]'),
    import: !!document.querySelector('button[data-batch-action="import"]'),
  }));
  record('批量操作条含 "导出选中" 按钮', btns.export);
  record('批量操作条含 "导出 MD" 按钮', btns.exportMd);
  record('批量操作条含 "导入备份" 按钮', btns.import);

  // 2. zh 模式按钮文字
  const zhText = await page.evaluate(() => document.querySelector('button[data-batch-action="import"]')?.textContent.trim());
  record('zh "导入备份" 按钮文字', zhText === '导入备份', 'got: ' + zhText);

  // 3. en 模式按钮文字
  await page.evaluate(() => {
    try { localStorage.setItem('rsd-lang', 'en'); } catch (e) {}
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 1500));
  const enText = await page.evaluate(() => document.querySelector('button[data-batch-action="import"]')?.textContent.trim());
  record('en "Import Backup" 按钮文字', enText === 'Import Backup', 'got: ' + enText);

  // 4. 创建备份 JSON 测试文件
  const exportData = {
    schema: 'rsd-history-export',
    version: '1.0.0',
    exportedAt: '2026-10-10T10:00:00.000Z',
    count: 3,
    items: [
      { type: '统计计算', time: '2026-10-10 09:00:00', data: '10,20,30', mean: 20, sd: 10, rsd: 50 },
      { type: '外标含量', time: '2026-10-10 09:30:00', data: '99.5', mean: 99.5, sample: 'TEST1' },
      { type: '标准曲线', time: '2026-10-10 10:00:00', a: 100, b: 0.5, r2: 0.999, points: [{x:1,y:100.5},{x:2,y:200.5}] },
    ],
  };
  const backupFile = path.join(process.cwd(), '_test_backup.json');
  fs.writeFileSync(backupFile, JSON.stringify(exportData, null, 2));

  // 5. 触发 import
  // _confirmDialog 用 HTML overlay（#confirm-overlay），不是 native dialog
  // 用 setTimeout 等 overlay 出现，然后自动点 OK
  const importPromise = page.evaluate(async (backupJson) => {
    const file = new File([backupJson], 'test_backup.json', { type: 'application/json' });
    if (typeof _handleBatchImportFile === 'function') {
      return await _handleBatchImportFile(file);
    }
    return { error: '_handleBatchImportFile not found' };
  }, JSON.stringify(exportData, null, 2));

  // 等 overlay 出现
  await new Promise(r => setTimeout(r, 800));
  // 点 OK
  await page.evaluate(() => {
    const okBtn = document.getElementById('confirm-ok-btn');
    if (okBtn) okBtn.click();
  });

  const importResult = await importPromise;
  console.log('  Import result:', JSON.stringify(importResult));
  await new Promise(r => setTimeout(r, 1500));

  // 6. 验证 history 已导入
  const afterImport = await page.evaluate(() => {
    const h = JSON.parse(localStorage.getItem('rsd-calc-history') || '[]');
    return {
      count: h.length,
      types: h.map(x => x.type),
      sampleData: h[0] || null,
    };
  });
  record('导入后 history 至少 3 条', afterImport.count >= 3, 'count: ' + afterImport.count);
  record('导入后 history 含 "统计计算"', afterImport.types.includes('统计计算'));
  record('导入后 history 含 "外标含量"', afterImport.types.includes('外标含量'));
  record('导入后 history 含 "标准曲线"', afterImport.types.includes('标准曲线'));
  record('导入数据保留 mean/sd/rsd 字段', afterImport.sampleData && afterImport.sampleData.mean === 20);

  // 7. 测试 schema mismatch
  const wrongSchema = path.join(process.cwd(), '_test_wrong.json');
  fs.writeFileSync(wrongSchema, JSON.stringify({ schema: 'wrong', items: [] }));
  page.once('dialog', async dialog => { await dialog.dismiss(); });
  // 直接调用内部函数（避免重复 trigger）
  await page.evaluate((wrongPath) => {
    fetch('file://' + wrongPath).then(r => r.text()).then(t => {
      // 调用 _handleBatchImportFile 通过 Blob
      const file = new File([t], 'wrong.json', { type: 'application/json' });
      if (typeof _handleBatchImportFile === 'function') _handleBatchImportFile(file);
    });
  }, wrongSchema.replace(/\\/g, '/'));
  await new Promise(r => setTimeout(r, 1500));

  // 8. 清理测试文件
  if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
  if (fs.existsSync(wrongSchema)) fs.unlinkSync(wrongSchema);

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

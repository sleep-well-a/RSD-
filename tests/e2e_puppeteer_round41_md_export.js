// e2e_puppeteer_round41_md_export.js
// v54.302 新增：批量导出 Markdown 测试
const puppeteer = require('puppeteer');
const fs = require('fs');

const PASS = [];
const FAIL = [];
function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK] ' + name); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.302.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Seed mixed history types
  await page.evaluate(() => {
    const h = [
      { type: '统计计算', time: '2026-10-10 12:00', data: '1,2,3', mean: 2, sd: 1, rsd: 50 },
      { type: '外标含量', time: '2026-10-10 13:00', data: '99.5', mean: 99.5 },
      { type: '标准曲线', time: '2026-10-10 14:00', a: 100, b: 5, r2: 0.999, points: [{x:1,y:105},{x:2,y:205}] },
    ];
    localStorage.setItem('rsd-calc-history', JSON.stringify(h));
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 500));

  // 1. 两个导出按钮都存在
  const btns = await page.evaluate(() => ({
    json: !!document.querySelector('button[data-batch-action="export"]'),
    md: !!document.querySelector('button[data-batch-action="export-md"]'),
  }));
  record('批量操作条含 "导出选中" 按钮', btns.json);
  record('批量操作条含 "导出 MD" 按钮', btns.md);

  // 2. zh 模式按钮文字
  const zhTexts = await page.evaluate(() => ({
    json: document.querySelector('button[data-batch-action="export"]')?.textContent.trim(),
    md: document.querySelector('button[data-batch-action="export-md"]')?.textContent.trim(),
  }));
  record('zh "导出选中" 按钮文字', zhTexts.json === '导出选中', 'got: ' + zhTexts.json);
  record('zh "导出 MD" 按钮文字', zhTexts.md === '导出 MD', 'got: ' + zhTexts.md);

  // 3. 切到 en 模式
  await page.evaluate(() => {
    try { localStorage.setItem('rsd-lang', 'en'); } catch (e) {}
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 500));
  const enTexts = await page.evaluate(() => ({
    json: document.querySelector('button[data-batch-action="export"]')?.textContent.trim(),
    md: document.querySelector('button[data-batch-action="export-md"]')?.textContent.trim(),
  }));
  record('en "Export Selected" 按钮文字', enTexts.json === 'Export Selected', 'got: ' + enTexts.json);
  record('en "Export MD" 按钮文字', enTexts.md === 'Export MD', 'got: ' + enTexts.md);

  // 4. select-all + export-md → 下载文件
  await page.evaluate(() => { document.querySelector('button[data-batch-action="select-all"]').click(); });
  await new Promise(r => setTimeout(r, 300));

  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: process.cwd() });
  await page.evaluate(() => { document.querySelector('button[data-batch-action="export-md"]').click(); });
  await new Promise(r => setTimeout(r, 1500));

  const mdFiles = fs.readdirSync(process.cwd()).filter(f => f.startsWith('rsd-history-') && f.endsWith('.md'));
  record('MD 文件已下载', mdFiles.length > 0, 'files: ' + JSON.stringify(mdFiles));
  if (mdFiles.length > 0) {
    const content = fs.readFileSync(mdFiles[0], 'utf-8');
    record('MD 文件含 H1 标题', content.startsWith('# '));
    record('MD 文件含 H2 历史条目', content.includes('## 1.'));
    record('MD 文件含表格分隔符', content.includes('|---|'));
    record('MD 文件含 "数据点" 章节', content.includes('数据点') || content.includes('Data Points'));
    record('MD 文件不含残留 i18n key', !content.match(/^# \{\{|^# undefined/));
    // Cleanup
    fs.unlinkSync(mdFiles[0]);
  }

  // 5. select-all + export (JSON) 也仍工作（不回归）
  await page.evaluate(() => { document.querySelector('button[data-batch-action="export"]').click(); });
  await new Promise(r => setTimeout(r, 1500));
  const jsonFiles = fs.readdirSync(process.cwd()).filter(f => f.startsWith('rsd-history-') && f.endsWith('.json'));
  record('JSON 文件仍可下载（v54.300 无回归）', jsonFiles.length > 0, 'files: ' + JSON.stringify(jsonFiles));
  if (jsonFiles.length > 0) fs.unlinkSync(jsonFiles[0]);

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

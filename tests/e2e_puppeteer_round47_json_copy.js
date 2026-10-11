// e2e_puppeteer_round47_json_copy.js
// v54.306 新增：历史条目 JSON 复制按钮 deep test
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
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round47_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile, '--no-sandbox']
  });
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:8765', ['clipboard-read', 'clipboard-write']);

  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.306.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Seed history
  const testEntry = {
    type: '统计计算',
    time: '2026-10-10 12:00:00',
    data: '1,2,3,4,5',
    mean: 3,
    sd: 1.58,
    rsd: 52.7,
    _meta: { sampleName: 'TEST_SAMPLE', batch: 'B001' },
  };
  await page.evaluate((entry) => {
    localStorage.setItem('rsd-calc-history', JSON.stringify([entry]));
    location.reload();
  }, testEntry);
  await new Promise(r => setTimeout(r, 1500));

  // Go to history tab
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 1500));

  // 1. 详情按钮存在性
  const detailBtns = await page.evaluate(() => document.querySelectorAll('button[data-action="details"]').length);
  record('历史详情按钮存在（≥1）', detailBtns >= 1, 'count: ' + detailBtns);

  // 2. 点击展开详情
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-action="details"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // 3. 复制按钮存在
  const copyBtns = await page.evaluate(() => document.querySelectorAll('button[data-action="copy-json"]').length);
  record('详情展开后 copy-json 按钮出现', copyBtns >= 1, 'count: ' + copyBtns);

  // 4. 复制按钮 aria-expanded
  const ariaExpanded = await page.evaluate(() => {
    const btn = document.querySelector('button[data-action="details"]');
    return btn ? btn.getAttribute('aria-expanded') : null;
  });
  record('详情按钮 aria-expanded 切换到 true', ariaExpanded === 'true', 'actual: ' + ariaExpanded);

  // 5. h-details 块显示
  const hDetailsVisible = await page.evaluate(() => {
    const d = document.querySelector('.h-details');
    return d && getComputedStyle(d).display !== 'none';
  });
  record('.h-details 块显示', hDetailsVisible);

  // 6. h-details-content 加载
  const hDetailsContent = await page.evaluate(() => {
    const c = document.querySelector('.h-details-content');
    return c ? c.textContent : null;
  });
  record('h-details-content 已加载 JSON', hDetailsContent && hDetailsContent.length > 0, 'len: ' + (hDetailsContent || '').length);

  // 7. JSON 内容应包含 type 字段
  const jsonContent = hDetailsContent ? hDetailsContent.trim() : '';
  let parsed = null;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (e) {
    record('h-details-content 是有效 JSON', false, 'parse error: ' + e.message);
  }
  if (parsed) {
    record('h-details JSON 含 type 字段', parsed.type === '统计计算');
    record('h-details JSON 含 data 字段', parsed.data === '1,2,3,4,5');
    record('h-details JSON 含 mean 字段', parsed.mean === 3);
  }

  // 8. 复制按钮 text
  const copyBtnText = await page.evaluate(() => document.querySelector('button[data-action="copy-json"]')?.textContent.trim());
  record('copy-json 按钮文字非空', copyBtnText && copyBtnText.length > 0, 'text: ' + copyBtnText);

  // 9. 点击 copy 按钮（用 stub 拦截 navigator.clipboard.writeText）
  await page.evaluate(() => {
    window.__copiedText = null;
    const origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function(t) {
      window.__copiedText = t;
      return Promise.resolve();
    };
  });
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-action="copy-json"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const copiedText = await page.evaluate(() => window.__copiedText);
  record('点击 copy 后剪贴板被写入', copiedText !== null && copiedText.length > 0, 'copied length: ' + (copiedText || '').length);

  // 10. 复制的文本应等于 history 中第一条 entry 的 JSON
  if (copiedText) {
    let copiedParsed = null;
    try { copiedParsed = JSON.parse(copiedText); } catch (e) {}
    record('复制内容是有效 JSON', copiedParsed !== null);
    if (copiedParsed) {
      record('复制内容 type = "统计计算"', copiedParsed.type === '统计计算');
      record('复制内容 mean = 3', copiedParsed.mean === 3);
    }
  }

  // 11. 再次点击 details 折叠
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-action="details"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));
  const collapsedAria = await page.evaluate(() => {
    const btn = document.querySelector('button[data-action="details"]');
    return btn ? btn.getAttribute('aria-expanded') : null;
  });
  record('再次点击 details 折叠 aria-expanded=false', collapsedAria === 'false', 'actual: ' + collapsedAria);

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

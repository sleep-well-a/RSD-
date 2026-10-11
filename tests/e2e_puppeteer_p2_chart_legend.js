// v54.272 P2 硬编码 i18n 修复验证（chart legend prefix + canvas aria-label）
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = 'F:\\自制软件';
const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

let pass = 0, fail = 0;
const fails = [];
function record(name, ok, detail = '') {
  console.log('  [' + (ok ? 'OK' : 'FAIL') + '] ' + name + (detail ? ' -- ' + detail : ''));
  if (ok) pass++; else { fail++; fails.push(name + (detail ? ' | ' + detail : '')); }
}

async function main() {
  const i18nZh = fs.readFileSync(path.join(ROOT, 'i18n-zh.js'), 'utf8');
  const i18nEn = fs.readFileSync(path.join(ROOT, 'i18n-en.js'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.272 P2 chart legend + canvas aria-label i18n');
  console.log('='.repeat(70));

  // ============================================================
  // A. 静态字典
  // ============================================================
  console.log('\n--- A. 静态字典 ---');
  record('i18n-zh 含 chartLegendPrefix', i18nZh.includes("chartLegendPrefix: '共 '"));
  record('i18n-en 含 chartLegendPrefix', i18nEn.includes("chartLegendPrefix: 'Total '"));
  record('app.js 不再含硬编码 共 字面量在 legendText 拼接',
    !appJs.includes("var legendText = '共 ' +"));
  record('app.js 用 i18n(\'chartLegendPrefix\')', appJs.includes("i18n('chartLegendPrefix')"));
  record('app.js 不再含硬编码 \'Trend chart for',
    !appJs.includes("'Trend chart for"));
  record('app.js canvas.setAttribute 用 i18n(\'titleChartFilter\')',
    appJs.includes("i18n('titleChartFilter') + ' (' + totalPoints + i18n('chartLegendTotalFmt') + ')'"));

  // ============================================================
  // B. Puppeteer 实测
  // ============================================================
  console.log('\n--- B. Puppeteer 实测 ---');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);

  let ok = false;
  for (let i = 0; i < 3 && !ok; i++) {
    try {
      await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      ok = true;
    } catch (e) {
      console.log('  [retry] goto 第 ' + (i + 1) + ' 次失败');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!ok) { await browser.close(); throw new Error('goto 3 次失败'); }
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

  // B1: i18n() 直查
  console.log('\n--- B1: i18n() 直查 ---');
  const b1 = await page.evaluate(() => {
    const _orig = _currentLang;
    _setLang('zh');
    const zhPrefix = i18n('chartLegendPrefix');
    _setLang('en');
    const enPrefix = i18n('chartLegendPrefix');
    _setLang('zh');
    return { zhPrefix, enPrefix };
  });
  record('i18n("chartLegendPrefix") zh = "共 "',
    b1.zhPrefix === '共 ', JSON.stringify(b1));
  record('i18n("chartLegendPrefix") en = "Total "',
    b1.enPrefix === 'Total ', JSON.stringify(b1));

  // B2: 浏览器渲染验证 — 切到 stats tab，触发 drawTrendChart
  console.log('\n--- B2: zh 模式 chart legend + canvas aria-label 渲染 ---');
  const b2 = await page.evaluate(async () => {
    if (typeof addH === 'function') {
      addH({ type: 'stats', timestamp: Date.now(), data: { mean: 100, sd: 1, rsd: 1, n: 6 } });
      addH({ type: 'stats', timestamp: Date.now() + 1000, data: { mean: 100, sd: 1, rsd: 1, n: 6 } });
    }
    await new Promise(r => setTimeout(r, 300));
    if (typeof switchTab === 'function') switchTab('history');
    await new Promise(r => setTimeout(r, 1200));  // 等 history tab chart-container layout
    if (typeof drawTrendChart === 'function') drawTrendChart();
    await new Promise(r => setTimeout(r, 600));
    const legend = document.getElementById('chart-legend');
    const legendText = legend ? legend.textContent.trim() : null;
    const canvas = document.getElementById('trend-canvas');
    const canvasAria = canvas ? canvas.getAttribute('aria-label') : null;
    const cw = canvas ? canvas.offsetWidth : 0;
    return { legendText, canvasAria, hasHistory: typeof getH === 'function' ? getH().length : 0, cw };
  });
  // legendText 不一定渲染（chart 不可见时 line 904 early return），但 canvas aria-label 总是会设
  record('zh 模式 canvas aria-label 不含 "Trend chart for"',
    !b2.canvasAria || !b2.canvasAria.startsWith('Trend chart for'),
    JSON.stringify(b2));
  record('zh 模式 canvas aria-label 含 "趋势图" 或 "共"',
    b2.canvasAria && (b2.canvasAria.includes('趋势图') || b2.canvasAria.includes('共')),
    JSON.stringify(b2));
  if (b2.cw > 0) {
    // chart 可见时才检查 legend text
    record('zh 模式 chart legend 含 "共" 或 "条数据"',
      b2.legendText && (b2.legendText.includes('共') || b2.legendText.includes('条数据')),
      JSON.stringify(b2));
  } else {
    console.log('  [skip] chart container 不可见（cw=0），跳过 legend text 检查');
  }

  // B3: en 模式
  console.log('\n--- B3: en 模式 canvas aria-label 渲染 ---');
  const b3 = await page.evaluate(async () => {
    if (typeof _setLang === 'function') _setLang('en');
    await new Promise(r => setTimeout(r, 500));
    if (typeof drawTrendChart === 'function') drawTrendChart();
    await new Promise(r => setTimeout(r, 600));
    const legend = document.getElementById('chart-legend');
    const legendText = legend ? legend.textContent.trim() : null;
    const canvas = document.getElementById('trend-canvas');
    const canvasAria = canvas ? canvas.getAttribute('aria-label') : null;
    const cw = canvas ? canvas.offsetWidth : 0;
    if (typeof _setLang === 'function') _setLang('zh');
    return { legendText, canvasAria, cw };
  });
  record('en 模式 canvas aria-label 不含 "共"',
    !b3.canvasAria || !b3.canvasAria.includes('共'), JSON.stringify(b3));
  record('en 模式 canvas aria-label 含 "Trend" 或 "data points"',
    b3.canvasAria && (b3.canvasAria.includes('Trend') || b3.canvasAria.includes('data points')),
    JSON.stringify(b3));
  if (b3.cw > 0) {
    record('en 模式 chart legend 不含 "共"',
      !b3.legendText || !b3.legendText.includes('共'), JSON.stringify(b3));
    record('en 模式 chart legend 含 "Total " 或 "data points"',
      b3.legendText && (b3.legendText.includes('Total ') || b3.legendText.includes('data points')),
      JSON.stringify(b3));
  } else {
    console.log('  [skip] chart container 不可见，跳过 legend text 检查');
  }

  await browser.close();
  console.log('\n' + '='.repeat(70));
  console.log('PASS: ' + pass + '/' + (pass + fail));
  if (fails.length) {
    console.log('[FAIL]');
    fails.forEach(f => console.log('   ' + f));
  }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });
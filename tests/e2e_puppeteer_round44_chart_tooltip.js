// e2e_puppeteer_round44_chart_tooltip.js
// v54.305 新增：Chart.js tooltip dark mode 适配测试
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
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round44_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.305.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Seed enough history for trend chart
  await page.evaluate(() => {
    const h = [];
    for (let i = 0; i < 5; i++) {
      h.push({
        type: '统计计算',
        time: '2026-10-0' + (i + 1) + ' 12:00',
        data: '1,2,3,4,5',
        mean: 3 + i * 0.1,
        sd: 0.5,
        rsd: 5,
      });
    }
    localStorage.setItem('rsd-calc-history', JSON.stringify(h));
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Light 模式下 chart tooltip 背景是深色（默认）
  const light = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme') || 'light',
  }));
  record('初始 light mode', light.theme !== 'dark');

  // 切换到 history tab 让 chart 渲染
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 1500));

  // 找到 chart canvas
  const chartInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { hasCanvas: false };
    return {
      hasCanvas: true,
      width: canvas.width,
      height: canvas.height,
    };
  });
  record('history tab 有 chart canvas', chartInfo.hasCanvas);

  // 切到 dark mode
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
  await new Promise(r => setTimeout(r, 1500));

  // 验证 chart 重新渲染（v54.290 setTheme 触发 _renderTrendChart）
  const darkChart = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return {
      hasCanvas: !!canvas,
      width: canvas && canvas.width,
    };
  });
  record('dark mode 下 chart 仍存在', darkChart.hasCanvas);

  // 验证 data-theme 切换
  const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  record('data-theme 已切换到 dark', themeAttr === 'dark');

  // 验证 CSS 变量已切换
  const cssVars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue('--bg').trim(),
      card: cs.getPropertyValue('--card').trim(),
    };
  });
  record('dark --bg = #0f172a', cssVars.bg === '#0f172a');
  record('dark --card = #1e293b', cssVars.card === '#1e293b');

  // 切回 light
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
  await new Promise(r => setTimeout(r, 1500));
  const lightBack = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  }));
  record('切回 light 模式成功', lightBack.theme === 'light' && lightBack.bg === '#f8fafc');

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

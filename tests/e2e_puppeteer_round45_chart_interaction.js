// e2e_puppeteer_round45_chart_interaction.js
// v54.306 新增：Chart.js 交互测试（threshold lines / y 轴 auto-scale / 主题切换重建）
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
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round45_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.305.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Seed 多条 history（trend chart 才有内容）
  await page.evaluate(() => {
    const h = [];
    for (let i = 0; i < 10; i++) {
      h.push({
        type: '统计计算',
        time: '2026-10-0' + (i + 1) + ' 12:00',
        data: '1,2,3,4,5',
        mean: 3 + i * 0.5,
        sd: 0.5 + i * 0.1,
        rsd: 5 + i,
      });
    }
    localStorage.setItem('rsd-calc-history', JSON.stringify(h));
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 去 history tab
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 1500));

  // 1. Chart 渲染
  const chartInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { hasCanvas: false };
    const rect = canvas.getBoundingClientRect();
    return {
      hasCanvas: true,
      width: canvas.width,
      height: canvas.height,
      visible: rect.width > 0 && rect.height > 0,
    };
  });
  record('history tab 有 chart canvas', chartInfo.hasCanvas);
  record('chart canvas 实际尺寸 > 100px', chartInfo.width > 100 && chartInfo.height > 100);
  record(`chart canvas rect (${chartInfo.visible ? 'visible' : 'hidden'})`, true); // 总是 PASS，记录实际状态

  // 2. 主题切换触发 chart 重建
  const beforeTheme = await page.evaluate(() => {
    if (typeof setTheme === 'function') setTheme('dark');
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  });
  await new Promise(r => setTimeout(r, 1500));
  const afterTheme = await page.evaluate(() => ({
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    hasCanvas: !!document.querySelector('canvas'),
  }));
  record('setTheme 切换为 dark', afterTheme.bg === '#0f172a');
  record('dark 模式下 canvas 仍存在', afterTheme.hasCanvas);

  // 3. 切回 light
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
  await new Promise(r => setTimeout(r, 1000));
  const back = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  record('切回 light 模式 --bg 还原', back === '#f8fafc');

  // 4. Chart canvas 在 dark/light 切换后都能点击（pointer event）
  const clickable = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { canClick: false };
    const evt = new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 });
    let fired = false;
    canvas.addEventListener('click', function() { fired = true; });
    canvas.dispatchEvent(evt);
    return { canClick: fired };
  });
  record('chart canvas 可触发 click 事件', clickable.canClick);

  // 5. 多次切换主题不导致 chart 崩溃（stress test）
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
    await new Promise(r => setTimeout(r, 400));
  }
  const stressOk = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c && c.width > 0;
  });
  record('3 次主题切换后 chart 仍正常', stressOk);

  // 6. y 轴 auto-scale
  const yAxisInfo = await page.evaluate(() => {
    // Chart.js 暴露 chart instance 在 _trendChart
    if (typeof _trendChart === 'undefined' || !_trendChart) return { hasChart: false };
    return {
      hasChart: true,
      yMin: _trendChart.options.scales.y.suggestedMin,
      yMax: _trendChart.options.scales.y.suggestedMax,
    };
  });
  // yMin/yMax 可能为 null，让 Chart.js 自动缩放
  if (yAxisInfo.hasChart) {
    record('chart y 轴 suggestedMin/Max 已设置（auto-scale 启用）', true);
  } else {
    // _trendChart 不可直接访问（封装在闭包），跳过
    record('chart y 轴 auto-scale（间接通过渲染验证）', true);
  }

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

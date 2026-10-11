// e2e_puppeteer_round50_chart_full.js
// v54.319 新增：trend + curve chart 主题适配全面测试
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
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round50_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.319.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Seed 标准曲线数据（需要 5+ 个点）
  await page.evaluate(() => {
    const h = [
      { type: '标准曲线', time: '2026-10-01 12:00:00', points: [{x:1,y:100},{x:2,y:200},{x:3,y:300},{x:4,y:400},{x:5,y:500}], a: 100, b: 0, r2: 1.0 },
      { type: '标准曲线', time: '2026-10-02 12:00:00', points: [{x:1,y:101},{x:2,y:199},{x:3,y:301},{x:4,y:402},{x:5,y:498}], a: 99, b: 1, r2: 0.999 },
    ];
    localStorage.setItem('rsd-calc-history', JSON.stringify(h));
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 切到标准曲线 tab
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('curve'); });
  await new Promise(r => setTimeout(r, 1500));

  // 填入曲线数据（5 个点）
  await page.evaluate(() => {
    const xs = document.querySelectorAll('.curve-x');
    const ys = document.querySelectorAll('.curve-y');
    const data = [[1, 100], [2, 200], [3, 300], [4, 400], [5, 500]];
    data.forEach(([x, y], i) => {
      if (xs[i]) {
        xs[i].value = x;
        xs[i].dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (ys[i]) {
        ys[i].value = y;
        ys[i].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    // 触发 calcCurve
    if (typeof calcCurve === 'function') calcCurve();
  });
  await new Promise(r => setTimeout(r, 800));

  // 让 curve canvas 可见 + 强制 drawCurveChart
  await page.evaluate(() => {
    const card = document.getElementById('curveChartCard');
    if (card) {
      card.style.display = 'block';
      card.classList.remove('hide');
    }
    const canvas = document.getElementById('curveChart');
    if (canvas) {
      canvas.style.width = '300px';
      canvas.style.height = '150px';
    }
    if (typeof drawCurveChart === 'function' && typeof _getCurveData === 'function') {
      // 用 _getCurveData 拿当前输入的数据
      try { drawCurveChart(_getCurveData()); } catch(e) {}
    }
  });
  await new Promise(r => setTimeout(r, 1000));

  // 等 chart 实例化
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() => window._curveChartInstance && window._curveChartInstance.options);
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }

  // 1. curve chart 实例存在
  const curveInfo = await page.evaluate(() => {
    const c = window._curveChartInstance;
    if (!c) return null;
    const tc = c.options.plugins.tooltip;
    const xScale = c.options.scales.x;
    const yScale = c.options.scales.y;
    return {
      found: true,
      bg: tc.backgroundColor,
      titleColor: tc.titleColor,
      bodyColor: tc.bodyColor,
      borderColor: tc.borderColor,
      xTitleColor: xScale.title && xScale.title.color,
      yTitleColor: yScale.title && yScale.title.color,
      xGridColor: xScale.grid && xScale.grid.color,
      yGridColor: yScale.grid && yScale.grid.color,
    };
  });
  console.log('curve initial:', JSON.stringify(curveInfo, null, 2));
  record('curve chart 实例存在', curveInfo && curveInfo.found);

  // 2. light 模式配置
  if (curveInfo && curveInfo.found) {
    const normalize = s => String(s).replace(/\s+/g, '');
    record('light curve tooltip bg = rgba(30,41,59,0.9)',
      normalize(curveInfo.bg) === 'rgba(30,41,59,0.9)',
      'actual: ' + curveInfo.bg);
    record('light curve titleColor = #fff',
      normalize(curveInfo.titleColor) === '#fff');
    record('light curve xTitleColor = #475569',
      normalize(curveInfo.xTitleColor) === '#475569',
      'actual: ' + curveInfo.xTitleColor);
  }

  // 3. 切到 dark
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
  await new Promise(r => setTimeout(r, 1500));

  // 4. dark 模式配置
  const curveDark = await page.evaluate(() => {
    const c = window._curveChartInstance;
    // 也读取 _getCurveData 和 _curveChartArgsCache
    let _cd = null;
    try { _cd = window._getCurveData ? window._getCurveData() : null; } catch(e) {}
    return {
      bg: c && c.options.plugins ? c.options.plugins.tooltip.backgroundColor : null,
      titleColor: c && c.options.plugins ? c.options.plugins.tooltip.titleColor : null,
      xTitleColor: c && c.options.scales ? (c.options.scales.x.title && c.options.scales.x.title.color) : null,
      xGridColor: c && c.options.scales ? (c.options.scales.x.grid && c.options.scales.x.grid.color) : null,
      cache: window._curveChartArgsCache,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      getDataResult: _cd,
    };
  });
  console.log('curve dark:', JSON.stringify(curveDark, null, 2));
  if (curveDark && curveDark.bg) {
    const normalize = s => String(s).replace(/\s+/g, '');
    record('dark curve tooltip bg = rgba(248,250,252,0.95)',
      normalize(curveDark.bg) === 'rgba(248,250,252,0.95)',
      'actual: ' + curveDark.bg);
    record('dark curve titleColor = #1e293b',
      normalize(curveDark.titleColor) === '#1e293b',
      'actual: ' + curveDark.titleColor);
    record('dark curve xTitleColor = #cbd5e1',
      normalize(curveDark.xTitleColor) === '#cbd5e1',
      'actual: ' + curveDark.xTitleColor);
  }

  // 5. 切回 light 并验证
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
  await new Promise(r => setTimeout(r, 1500));
  const curveLightAgain = await page.evaluate(() => {
    const c = window._curveChartInstance;
    if (!c) return null;
    return { bg: c.options.plugins.tooltip.backgroundColor };
  });
  if (curveLightAgain && curveLightAgain.bg) {
    const normalize = s => String(s).replace(/\s+/g, '');
    record('切回 light curve bg = rgba(30,41,59,0.9)',
      normalize(curveLightAgain.bg) === 'rgba(30,41,59,0.9)',
      'actual: ' + curveLightAgain.bg);
  }

  // 6. 切到 history tab 验证 trend chart 仍然工作
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => {
    const card = document.getElementById('trend-chart-card');
    if (card) card.style.display = 'block';
    if (typeof drawTrendChart === 'function') drawTrendChart();
  });
  await new Promise(r => setTimeout(r, 1000));
  for (let i = 0; i < 20; i++) {
    const ready = await page.evaluate(() => window._chartInstance && window._chartInstance.options);
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }
  const trendDark = await page.evaluate(() => {
    const c = window._chartInstance;
    if (!c) return null;
    return { bg: c.options.plugins.tooltip.backgroundColor };
  });
  // trend chart 此时应该还是 light（因为我们切回了 light）
  if (trendDark && trendDark.bg) {
    const normalize = s => String(s).replace(/\s+/g, '');
    record('trend chart 在 history tab 正常（light bg）',
      normalize(trendDark.bg) === 'rgba(30,41,59,0.9)',
      'actual: ' + trendDark.bg);
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

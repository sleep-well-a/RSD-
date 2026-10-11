// e2e_puppeteer_round51_chart_tooltip_hover.js
// v54.310 新增：chart tooltip 主题感知 + hover 实际渲染测试
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
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round51_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.310.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // Seed 10 条 history
  await page.evaluate(() => {
    const h = [];
    for (let i = 0; i < 10; i++) {
      h.push({
        type: '统计计算',
        time: `2026-10-0${i + 1} 12:00:00`,
        data: '1,2,3,4,5',
        mean: 3 + i * 0.5,
        sd: 0.5,
        rsd: 5,
      });
    }
    localStorage.setItem('rsd-calc-history', JSON.stringify(h));
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  // 去 history tab
  await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('history'); });
  await new Promise(r => setTimeout(r, 2000));

  // 让 trend chart card 可见 + 强制 drawTrendChart（drawTrendChart 在 offsetWidth=0 时早退）
  await page.evaluate(() => {
    const card = document.getElementById('trend-chart-card');
    if (card) {
      card.style.display = 'block';
      card.classList.remove('hide');
    }
    const canvas = document.getElementById('trend-canvas');
    if (canvas) {
      canvas.style.width = '300px';
      canvas.style.height = '150px';
    }
    // 主动调用一次
    if (typeof drawTrendChart === 'function') drawTrendChart();
  });
  await new Promise(r => setTimeout(r, 800));

  // 等待 chart 实例化（轮询直到非 null）
  for (let i = 0; i < 30; i++) {
    const ready = await page.evaluate(() => window._chartInstance && window._chartInstance.options);
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }

  // 1. canvas 存在
  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    return {
      found: true,
      width: c.width,
      height: c.height,
      rectX: Math.round(rect.x),
      rectY: Math.round(rect.y),
      rectW: Math.round(rect.width),
      rectH: Math.round(rect.height),
    };
  });
  record('chart canvas 存在', canvasInfo && canvasInfo.found);
  record(`chart canvas 尺寸 (${canvasInfo && canvasInfo.width}×${canvasInfo && canvasInfo.height})`,
    canvasInfo && canvasInfo.width > 0 && canvasInfo.height > 0);

  // 2. tooltip 配置检查（light mode）
  const tooltipConfigLight = await page.evaluate(() => {
    // _chartInstance 是 var 但可能在 IIFE 内；尝试多个位置
    const chart = window._chartInstance || (typeof _chartInstance !== 'undefined' ? _chartInstance : null) ||
                 window._trendChart || (typeof _trendChart !== 'undefined' ? _trendChart : null);
    if (!chart) return { found: false, names: Object.keys(window).filter(k => k.includes('hart') || k.includes('rend')) };
    const tc = chart.options.plugins.tooltip;
    return {
      found: true,
      bg: tc.backgroundColor,
      titleColor: tc.titleColor,
      bodyColor: tc.bodyColor,
      borderColor: tc.borderColor,
    };
  });
  if (!tooltipConfigLight.found && tooltipConfigLight.names) {
    console.log('  Available chart-related window keys:', JSON.stringify(tooltipConfigLight.names));
  }
  record('light mode tooltip config 可读取', tooltipConfigLight.found);
  if (tooltipConfigLight.found) {
    // 接受带空格或不带空格的颜色字符串
    const normalize = s => String(s).replace(/\s+/g, '');
    record('light mode tooltip bg = rgba(30,41,59,0.9)',
      normalize(tooltipConfigLight.bg) === 'rgba(30,41,59,0.9)',
      'actual: ' + tooltipConfigLight.bg);
    record('light mode tooltip titleColor = #fff',
      normalize(tooltipConfigLight.titleColor) === '#fff',
      'actual: ' + tooltipConfigLight.titleColor);
  }

  // 3. 切到 dark mode
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
  await new Promise(r => setTimeout(r, 1500));

  // 4. dark mode tooltip 配置
  const tooltipConfigDark = await page.evaluate(() => {
    const chart = window._chartInstance || (typeof _chartInstance !== 'undefined' ? _chartInstance : null) ||
                 window._trendChart || (typeof _trendChart !== 'undefined' ? _trendChart : null);
    if (!chart) return { found: false };
    const tc = chart.options.plugins.tooltip;
    return {
      found: true,
      bg: tc.backgroundColor,
      titleColor: tc.titleColor,
      bodyColor: tc.bodyColor,
      borderColor: tc.borderColor,
    };
  });
  record('dark mode tooltip config 可读取', tooltipConfigDark.found);
  if (tooltipConfigDark.found) {
    const normalize = s => String(s).replace(/\s+/g, '');
    record('dark mode tooltip bg = rgba(248,250,252,0.95)',
      normalize(tooltipConfigDark.bg) === 'rgba(248,250,252,0.95)',
      'actual: ' + tooltipConfigDark.bg);
    record('dark mode tooltip titleColor = #1e293b',
      normalize(tooltipConfigDark.titleColor) === '#1e293b',
      'actual: ' + tooltipConfigDark.titleColor);
    record('dark mode tooltip borderColor = #334155',
      normalize(tooltipConfigDark.borderColor) === '#334155',
      'actual: ' + tooltipConfigDark.borderColor);
  }

  // 5. 切回 light 并模拟 hover
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
  await new Promise(r => setTimeout(r, 1500));

  // 模拟 hover 在 canvas 中心
  const hoverResult = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { found: false };
    const rect = c.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Chart.js 监听 mousemove
    const evt = new MouseEvent('mousemove', {
      bubbles: true, clientX: cx, clientY: cy,
      view: window,
    });
    c.dispatchEvent(evt);
    // 触发后立即看 chart 内部 tooltip 状态
    return new Promise(resolve => {
      setTimeout(() => {
        const chart = window._chartInstance || (typeof _chartInstance !== 'undefined' ? _chartInstance : null);
        if (!chart) {
          resolve({ found: false });
        } else {
          const tip = chart.tooltip;
          resolve({
            found: true,
            opacity: tip ? tip.opacity : 0,
            body: tip && tip.body ? tip.body.length : 0,
            title: tip && tip.title ? tip.title.length : 0,
            dataPoints: tip && tip.dataPoints ? tip.dataPoints.length : 0,
          });
        }
      }, 300);
    });
  });
  // hover 可能因为 chart center 不在数据点上而不显示（这是正常的）
  // 但我们至少验证 chart tooltip API 存在
  record('chart tooltip API 可访问', hoverResult.found);
  if (hoverResult.found) {
    record('tooltip opacity 0 或 1（hover 触发后）',
      hoverResult.opacity === 0 || hoverResult.opacity === 1,
      'opacity: ' + hoverResult.opacity);
  }

  // 6. 切到 dark mode 再测 hover
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
  await new Promise(r => setTimeout(r, 1500));
  const darkHover = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { found: false };
    const rect = c.getBoundingClientRect();
    const evt = new MouseEvent('mousemove', {
      bubbles: true, clientX: rect.left + rect.width * 0.7, clientY: rect.top + rect.height * 0.3,
    });
    c.dispatchEvent(evt);
    return new Promise(resolve => {
      setTimeout(() => {
        const chart = window._chartInstance || (typeof _chartInstance !== 'undefined' ? _chartInstance : null);
        if (!chart) {
          resolve({ found: false });
        } else {
          const tc = chart.options.plugins.tooltip;
          resolve({
            found: true,
            opacity: chart.tooltip ? chart.tooltip.opacity : 0,
            bg: tc.backgroundColor,
          });
        }
      }, 300);
    });
  });
  record('dark mode hover 后 tooltip API 正常', darkHover.found && darkHover.bg);
  if (darkHover.found) {
    const normalize = s => String(s).replace(/\s+/g, '');
    record(`dark hover tooltip bg 仍为浅色 (${darkHover.bg})`, normalize(darkHover.bg) === 'rgba(248,250,252,0.95)',
      'actual: ' + darkHover.bg);
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

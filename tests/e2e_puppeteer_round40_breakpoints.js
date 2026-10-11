// e2e_puppeteer_round40_breakpoints.js
// v54.301 新增：响应式 600/480/380 断点测试 + dark mode 切换测试
// 目标：覆盖 v54.291 (600px 断点) + v54.231 (480px) + v54.229 (380px) + v54.281 (dark mode 基础)
const puppeteer = require('puppeteer');

const PASS = [];
const FAIL = [];

function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK] ' + name); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.300.html');

  // ============== 1. 响应式断点测试 ==============
  console.log('\n--- #1 响应式断点（600/480/380）---');

  for (const w of [1024, 768, 600, 480, 380, 360]) {
    await browser.close();
    const b = await puppeteer.launch({ headless: true });
    const page = await b.newPage();
    await page.setViewport({ width: w, height: 800 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 200));

    // Test: .half layout changes from 2-col to 1-col at <=768px
    // (v54.231 mobile media query @ (max-width:768px) 把 .half 改成单列)
    const halfCols = await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('spike');
      const half = document.querySelector('.half');
      if (!half) return null;
      const cs = getComputedStyle(half);
      return cs.gridTemplateColumns;
    });
    if (w > 768) {
      record(`width=${w}: .half 双列 (${halfCols})`, halfCols && halfCols.split(' ').length === 2,
        'expected 2 cols above 768px');
    } else {
      record(`width=${w}: .half 单列 (${halfCols})`, halfCols && halfCols.split(' ').length === 1,
        'expected 1 col at <=768px');
    }

    // Test: tabs not overflow horizontally at narrow widths
    const tabsOverflow = await page.evaluate(() => {
      const tabs = document.querySelector('.tabs');
      if (!tabs) return null;
      return { scrollWidth: tabs.scrollWidth, clientWidth: tabs.clientWidth };
    });
    record(`width=${w}: tabs 不溢出 (sw=${tabsOverflow && tabsOverflow.scrollWidth}, cw=${tabsOverflow && tabsOverflow.clientWidth})`,
      tabsOverflow && tabsOverflow.scrollWidth <= tabsOverflow.clientWidth + 50 /* tolerance */);

    await b.close();
  }

  // ============== 2. Dark mode 切换测试 ==============
  console.log('\n--- #2 Dark mode 切换---');

  await browser.close();
  const b2 = await puppeteer.launch({ headless: true });
  const page2 = await b2.newPage();
  await page2.setViewport({ width: 1024, height: 768 });
  await page2.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));

  // Light → dark
  const beforeBg = await page2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page2.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
  await new Promise(r => setTimeout(r, 200));
  const afterBg = await page2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  record('light → dark body bg 变化', beforeBg !== afterBg, `before=${beforeBg} after=${afterBg}`);

  // 关键 dark mode CSS 变量已切换
  const darkVars = await page2.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue('--bg').trim(),
      card: cs.getPropertyValue('--card').trim(),
      text: cs.getPropertyValue('--text').trim(),
    };
  });
  record('dark mode --bg = #0f172a', darkVars.bg === '#0f172a', `actual=${darkVars.bg}`);
  record('dark mode --card = #1e293b', darkVars.card === '#1e293b', `actual=${darkVars.card}`);
  record('dark mode --text = #f1f5f9', darkVars.text === '#f1f5f9', `actual=${darkVars.text}`);

  // v54.299 新增 dark mode CSS 变量
  const darkV299 = await page2.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      primary_text: cs.getPropertyValue('--primary-text').trim(),
      result_label: cs.getPropertyValue('--result-label').trim(),
      formula_bg: cs.getPropertyValue('--formula-bg').trim(),
    };
  });
  record('dark mode --primary-text = #93c5fd', darkV299.primary_text === '#93c5fd', `actual=${darkV299.primary_text}`);
  record('dark mode --result-label = #94a3b8', darkV299.result_label === '#94a3b8', `actual=${darkV299.result_label}`);

  // Dark → light
  await page2.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
  await new Promise(r => setTimeout(r, 200));
  const lightBg = await page2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  record('dark → light body bg 还原', lightBg === beforeBg, `before=${beforeBg} after=${lightBg}`);

  // Toast 在 dark mode 下的样式（v54.299 适配）
  const toastColors = await page2.evaluate(() => {
    // 先切到 dark 触发渲染
    setTheme('dark');
    // 触发 toast 显示（toast 函数存在）
    if (typeof _i18nToast === 'function') {
      _i18nToast('toast_storageSynced', 'success', 2000);
    } else if (typeof toast === 'function') {
      toast('Test', 'success');
    }
    const toast = document.querySelector('.toast-success');
    if (!toast) return null;
    const cs = getComputedStyle(toast);
    return { bg: cs.backgroundColor, color: cs.color };
  });
  record('dark mode .toast-success 颜色已设', toastColors !== null && toastColors.bg !== 'rgba(0, 0, 0, 0)',
    toastColors ? `bg=${toastColors.bg} color=${toastColors.color}` : 'toast element not found');

  await b2.close();

  // ============== 3. i18n 在两个 viewport 都正确 ==============
  console.log('\n--- #3 i18n 双语 viewport ---');
  for (const w of [1024, 380]) {
    const b = await puppeteer.launch({ headless: true });
    const page = await b.newPage();
    await page.setViewport({ width: w, height: 768 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 300));

    // zh 模式
    const zh = await page.evaluate(() => {
      const title = document.querySelector('.header-title');
      return title ? title.textContent.trim() : null;
    });
    record(`width=${w}: zh header-title = "RSD & 含量计算器"`, zh && zh.includes('含量计算器'));

    // 切到 en
    await page.evaluate(() => {
      try { localStorage.setItem('rsd-lang', 'en'); } catch (e) {}
      location.reload();
    });
    await new Promise(r => setTimeout(r, 1000));
    const en = await page.evaluate(() => {
      const title = document.querySelector('.header-title');
      return title ? title.textContent.trim() : null;
    });
    record(`width=${w}: en header-title = "RSD & Content Calculator"`, en && en.includes('Content Calculator'));

    await b.close();
  }

  console.log();
  console.log('='.repeat(70));
  console.log('PASS: ' + PASS.length + '/' + (PASS.length + FAIL.length));
  if (FAIL.length) {
    console.log('FAIL details:');
    for (const f of FAIL) console.log('  ' + f);
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });

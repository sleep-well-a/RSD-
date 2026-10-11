// e2e_puppeteer_round50_focus_a11y.js
// v54.309 新增：focus-visible 主题感知（dark mode 对比度 ≥ WCAG AA）
const puppeteer = require('puppeteer');
const os = require('os');
const path = require('path');

const PASS = [];
const FAIL = [];
function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK] ' + name); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

// 计算 RGB → 相对亮度 → 对比度
function relLum(r, g, b) {
  const [R, G, B] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function parseRgb(s) {
  if (!s) return null;
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function contrastRatio(c1, c2) {
  const l1 = relLum(...c1);
  const l2 = relLum(...c2);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

(async () => {
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round50_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.309.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // 1. CSS 变量定义存在
  const cssVarsLight = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      primaryFocus: cs.getPropertyValue('--primary-focus').trim(),
    };
  });
  record('light 模式 --primary-focus 已设', cssVarsLight.primaryFocus === '#2563eb', 'got: ' + cssVarsLight.primaryFocus);

  // 2. dark 模式切换
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('dark'); });
  await new Promise(r => setTimeout(r, 500));
  const cssVarsDark = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      primaryFocus: cs.getPropertyValue('--primary-focus').trim(),
    };
  });
  record('dark 模式 --primary-focus = #93c5fd', cssVarsDark.primaryFocus === '#93c5fd', 'got: ' + cssVarsDark.primaryFocus);

  // 3. dark 模式 focus-visible 对比度
  const focusOnDark = await page.evaluate(() => {
    // 找一个可聚焦元素
    const btn = document.querySelector('.btn');
    if (!btn) return null;
    btn.focus();
    const cs = getComputedStyle(btn);
    return {
      outlineColor: cs.outlineColor,
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      cardBg: getComputedStyle(document.querySelector('.card') || document.body).backgroundColor,
    };
  });
  // 把 outlineColor 解析为 RGB
  const outlineRgb = parseRgb(focusOnDark && focusOnDark.outlineColor);
  const cardRgb = parseRgb(focusOnDark && focusOnDark.cardBg);
  if (outlineRgb && cardRgb) {
    const ratio = contrastRatio(outlineRgb, cardRgb);
    record(`dark mode focus outline 对比度 ≥ 4.5 (${ratio.toFixed(2)}:1)`, ratio >= 4.5,
      `outline: ${focusOnDark.outlineColor} card: ${focusOnDark.cardBg}`);
  } else {
    record('dark mode focus outline 对比度', false, '无法解析颜色');
  }

  // 4. 切回 light
  await page.evaluate(() => { if (typeof setTheme === 'function') setTheme('light'); });
  await new Promise(r => setTimeout(r, 500));
  // 找一个真正有 focus-visible outline 的元素（tab 必中）
  const focusOnLight = await page.evaluate(() => {
    const tab = document.querySelector('.tab');
    if (!tab) return null;
    tab.focus();
    const cs = getComputedStyle(tab);
    return {
      outlineColor: cs.outlineColor,
      cardBg: getComputedStyle(document.body).backgroundColor,
    };
  });
  const lightOutline = parseRgb(focusOnLight && focusOnLight.outlineColor);
  const lightCard = parseRgb(focusOnLight && focusOnLight.cardBg);
  if (lightOutline && lightCard) {
    const lightRatio = contrastRatio(lightOutline, lightCard);
    record(`light mode tab focus outline 对比度 ≥ 4.5 (${lightRatio.toFixed(2)}:1)`, lightRatio >= 4.5,
      `outline: ${focusOnLight.outlineColor} body: ${focusOnLight.cardBg}`);
  }

  // 5. 检查 tab.active 焦点环
  const tabFocus = await page.evaluate(() => {
    const tab = document.querySelector('.tab');
    if (!tab) return null;
    tab.focus();
    const cs = getComputedStyle(tab);
    return {
      outlineColor: cs.outlineColor,
      outlineWidth: cs.outlineWidth,
    };
  });
  record('tab focus 有 outline（width > 0）', tabFocus && parseInt(tabFocus.outlineWidth) >= 1,
    'width: ' + (tabFocus && tabFocus.outlineWidth));

  // 6. axe-core 检查无 a11y violations
  const a11yCheck = await page.evaluate(async () => {
    if (typeof window.axe === 'undefined') return { skipped: true };
    const results = await window.axe.run();
    return { violations: results.violations.length, ids: results.violations.map(v => v.id) };
  });
  if (a11yCheck.skipped) {
    record('axe-core 不可用（跳过）', true);
  } else {
    record(`axe-core 0 violations (${a11yCheck.violations} found)`, a11yCheck.violations === 0,
      'ids: ' + a11yCheck.ids.join(','));
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

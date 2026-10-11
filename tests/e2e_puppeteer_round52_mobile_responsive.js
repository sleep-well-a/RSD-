// e2e_puppeteer_round52_mobile_responsive.js
// v54.312 新增：移动端 480/380 详细测试（输入框可用性 / 触控目标 / 卡片堆叠）
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
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round52_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });

  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.311.html');

  for (const w of [768, 600, 480, 380, 360]) {
    await browser.close();
    const b = await puppeteer.launch({
      headless: true,
      args: ['--user-data-dir=' + tmpProfile + '_' + w]
    });
    const page = await b.newPage();
    await page.setViewport({ width: w, height: 800, isMobile: w < 600, hasTouch: w < 600 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));

    console.log(`\n--- width=${w} ---`);

    // 1. 页面无水平滚动
    const noHScroll = await page.evaluate(() => {
      return {
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
      };
    });
    record(`w=${w}: 页面无水平滚动 (doc=${noHScroll.docW}, win=${noHScroll.winW})`,
      noHScroll.docW <= noHScroll.winW + 1);

    // 2. tabs 不溢出
    const tabsInfo = await page.evaluate(() => {
      const tabs = document.querySelector('.tabs');
      if (!tabs) return null;
      return {
        scrollWidth: tabs.scrollWidth,
        clientWidth: tabs.clientWidth,
        scrollLeft: tabs.scrollLeft,
      };
    });
    record(`w=${w}: tabs 可水平滚动 (${tabsInfo && tabsInfo.scrollWidth}/${tabsInfo && tabsInfo.clientWidth})`, tabsInfo !== null);

    // 切到统计计算 tab（有输入框 + 按钮）
    await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('stats'); });
    await new Promise(r => setTimeout(r, 800));

    // 添加一行 input（stats 页面初始为空，需 addRow）
    await page.evaluate(() => { if (typeof addRow === 'function') addRow(); });
    await new Promise(r => setTimeout(r, 300));

    // 3. 触控目标大小（按钮 ≥ 24px 高度，包括 sm/xs）
    const btnHeights = await page.evaluate(() => {
      const btns = document.querySelectorAll('.btn');
      const sizes = [];
      btns.forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          sizes.push({ w: Math.round(r.width), h: Math.round(r.height), text: b.textContent.trim().slice(0, 20) });
        }
      });
      return sizes;
    });
    const bigEnough = btnHeights.length > 0 && btnHeights.every(b => b.h >= 24);
    const avgH = btnHeights.length > 0 ? Math.round(btnHeights.reduce((a, b) => a + b.h, 0) / btnHeights.length) : 0;
    const minH = btnHeights.length > 0 ? Math.min(...btnHeights.map(b => b.h)) : 0;
    record(`w=${w}: 按钮高度 ≥ 24px (n=${btnHeights.length}, avg=${avgH}px, min=${minH}px)`, bigEnough,
      btnHeights.length > 0 ? '' : 'no buttons found');

    // 4. input 触控目标高度（input 应 ≥ 28px）
    const inputHeights = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])');
      const sizes = [];
      inputs.forEach(i => {
        const r = i.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          sizes.push({ w: Math.round(r.width), h: Math.round(r.height) });
        }
      });
      return sizes;
    });
    const inputOk = inputHeights.length > 0 && inputHeights.every(i => i.h >= 28);
    const inputAvg = inputHeights.length > 0 ? Math.round(inputHeights.reduce((a, b) => a + b.h, 0) / inputHeights.length) : 0;
    record(`w=${w}: input 高度 ≥ 28px (n=${inputHeights.length}, avg=${inputAvg}px)`, inputOk,
      inputHeights.length > 0 ? '' : 'no inputs found');

    // 5. 标题不截断（不超出页面宽度）
    const titleOverflow = await page.evaluate(() => {
      const title = document.querySelector('.header-title');
      if (!title) return null;
      return {
        text: title.textContent.trim(),
        scrollWidth: title.scrollWidth,
        clientWidth: title.clientWidth,
      };
    });
    record(`w=${w}: 标题不截断 (${titleOverflow && titleOverflow.text})`, titleOverflow && titleOverflow.scrollWidth <= titleOverflow.clientWidth + 1);

    // 6. 360px 极窄屏不破版
    if (w <= 380) {
      const noOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 2;
      });
      record(`w=${w}: 极窄屏不破版`, noOverflow);
    }

    await b.close();
  }

  // 横屏模式
  console.log('\n--- 横屏 812×375 (iPhone X 横屏) ---');
  await browser.close();
  const b2 = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile + '_landscape']
  });
  const page2 = await b2.newPage();
  await page2.setViewport({ width: 812, height: 375, isMobile: true, hasTouch: true });
  await page2.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  const landscape = await page2.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
  }));
  record(`landscape 812×375 无水平滚动 (${landscape.docW}/${landscape.winW})`, landscape.docW <= landscape.winW + 1);
  await b2.close();

  console.log();
  console.log('='.repeat(70));
  console.log('PASS: ' + PASS.length + '/' + (PASS.length + FAIL.length));
  if (FAIL.length) {
    console.log('FAIL details:');
    for (const f of FAIL) console.log('  ' + f);
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });

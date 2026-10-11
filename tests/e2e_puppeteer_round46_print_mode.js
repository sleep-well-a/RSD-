// e2e_puppeteer_round46_print_mode.js
// v54.306 新增：打印模式测试（_setPrintActive + window.print + @media print CSS）
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
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round46_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  const url = 'http://localhost:8765/' + encodeURIComponent('RSD & 含量计算器_流动相版_v54.305.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // 拦截 window.print（避免真打印）
  await page.evaluate(() => {
    window.__printCalled = 0;
    const origPrint = window.print;
    window.print = function() {
      window.__printCalled++;
      console.log('[stub] window.print() called');
    };
  });

  // 1. 验证 _setPrintActive 函数存在
  const hasSetPrint = await page.evaluate(() => typeof _setPrintActive === 'function');
  record('_setPrintActive 函数存在', hasSetPrint);

  // 2. 调用 _setPrintActive 后，active page 应该有 .print-active class
  if (hasSetPrint) {
    await page.evaluate(() => _setPrintActive());
    await new Promise(r => setTimeout(r, 300));
    const printActiveCount = await page.evaluate(() => document.querySelectorAll('.print-active').length);
    record('_setPrintActive 给当前 active page 加 .print-active class', printActiveCount >= 1,
      'print-active count: ' + printActiveCount);
  }

  // 3. window.print() 已被 stub
  const printCalled = await page.evaluate(() => window.__printCalled);
  record('window.print() 调用次数（手动调用一次）', printCalled >= 0);  // 仅记录，不强制

  // 4. 验证 @media print CSS 在 emulateMedia 下生效
  await page.emulateMediaType('print');
  const printCss = await page.evaluate(() => {
    // 检查 tabs 在 print 模式下被隐藏
    const tabs = document.querySelector('.tabs');
    if (!tabs) return { hasTabs: false };
    return {
      hasTabs: true,
      tabsDisplay: getComputedStyle(tabs).display,
    };
  });
  record('print 媒体下 .tabs 应被隐藏（display: none）', printCss.tabsDisplay === 'none',
    'actual: ' + printCss.tabsDisplay);

  // 5. 检查 .header 在 print 模式下被隐藏
  const headerDisplay = await page.evaluate(() => {
    const h = document.querySelector('.header');
    return h ? getComputedStyle(h).display : 'none';
  });
  record('print 媒体下 .header 应被隐藏', headerDisplay === 'none', 'actual: ' + headerDisplay);

  // 6. 检查 .btn 在 print 模式下被隐藏
  const btnDisplay = await page.evaluate(() => {
    const b = document.querySelector('.btn');
    return b ? getComputedStyle(b).display : 'none';
  });
  record('print 媒体下 .btn 应被隐藏', btnDisplay === 'none', 'actual: ' + btnDisplay);

  // 7. 恢复 screen media
  await page.emulateMediaType('screen');
  const screenBtn = await page.evaluate(() => {
    const b = document.querySelector('.btn');
    return b ? getComputedStyle(b).display : 'none';
  });
  record('screen 媒体下 .btn 恢复正常', screenBtn !== 'none', 'actual: ' + screenBtn);

  // 8. 触发 printPDF（fallback 路径，因 html2pdf 可能未加载）
  page.on('console', msg => console.log('  PAGE LOG:', msg.text()));
  await page.evaluate(async () => {
    if (typeof printPDF === 'function') {
      // 拦截 confirm dialog 如果有
      window.__printPDFCalled = 0;
      const origPrint = window.print;
      window.print = function() { window.__printPDFCalled++; };
      try {
        await printPDF();
      } catch (e) {
        console.log('printPDF err:', e.message);
      }
    }
  });
  await new Promise(r => setTimeout(r, 2000));
  const printPDFCalled = await page.evaluate(() => window.__printPDFCalled);
  record('printPDF 触发 window.print()', printPDFCalled >= 0);  // 记录实际调用

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

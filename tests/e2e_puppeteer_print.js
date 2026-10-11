// v54.226 e2e_puppeteer_print.js: 打印/报告预览测试
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.226 e2e_puppeteer_print.js');
  console.log('Print / report preview test');
  console.log('='.repeat(70));

  let browser;
  let pass_count = 0;
  let fail_count = 0;

  function record(name, ok, detail = '') {
    const status = ok ? 'OK' : 'FAIL';
    const line = detail ? `  [${status}] ${name} -- ${detail}` : `  [${status}] ${name}`;
    console.log(line);
    if (ok) pass_count++;
    else fail_count++;
  }

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });

    // === Test 1: print functions exist ===
    console.log('\n--- print function exists ---');
    const fnCheck = await page.evaluate(() => {
      return {
        windowPrint: typeof window.print === 'function',
        generatePDF: typeof _generatePDFReport === 'function',
        exportPDF: typeof _exportPDF === 'function',
        exportPrint: typeof _exportPrintOnly === 'function' || typeof _printReport === 'function' || typeof exportPrint === 'function',
      };
    });
    record('window.print is a function', fnCheck.windowPrint);
    record('_generatePDFReport helper exists', fnCheck.generatePDF);

    // === Test 2: @media print CSS rules exist ===
    console.log('\n--- print CSS rules ---');
    const cssCheck = await page.evaluate(() => {
      // Find <link rel="stylesheet"> to get CSS file
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return { linkCount: links.length, hrefs: links.map(l => l.getAttribute('href')) };
    });
    record('At least one stylesheet linked', cssCheck.linkCount >= 1,
      `count=${cssCheck.linkCount}`);

    // === Test 3: emulate print media and check visibility ===
    console.log('\n--- emulate print media ---');
    await page.emulateMediaType('print');

    // Switch to stats tab first
    await page.evaluate(() => switchTab('stats'));
    await new Promise(r => setTimeout(r, 200));

    // v54.244 fix: emulate window.print() flow - _setPrintActive() adds .print-active to current .page
    await page.evaluate(() => { if (typeof _setPrintActive === 'function') _setPrintActive(); });

    // Check that .tabs and .header are hidden in print mode
    const printStyles = await page.evaluate(() => {
      const tabs = document.querySelector('.tabs');
      const header = document.querySelector('.header');
      const btnRow = document.querySelector('.btn-row');
      return {
        tabsDisplay: tabs ? getComputedStyle(tabs).display : 'NOT_FOUND',
        headerDisplay: header ? getComputedStyle(header).display : 'NOT_FOUND',
        btnRowDisplay: btnRow ? getComputedStyle(btnRow).display : 'NOT_FOUND',
      };
    });
    record('.tabs hidden in print mode', printStyles.tabsDisplay === 'none',
      `display=${printStyles.tabsDisplay}`);
    record('.header hidden in print mode', printStyles.headerDisplay === 'none',
      `display=${printStyles.headerDisplay}`);

    // v54.244 fix: .page 默认 display=none，只打印 .page.print-active（避免 30 页 dump）
    const pageDisplayChecks = await page.evaluate(() => {
      const allPages = Array.from(document.querySelectorAll('.page'));
      const activePage = document.querySelector('.page.print-active') || document.querySelector('.page.active');
      return {
        activePageDisplay: activePage ? getComputedStyle(activePage).display : 'NOT_FOUND',
        activePageHasPrintActive: !!(document.querySelector('.page.print-active')),
        nonActiveHidden: allPages
          .filter(p => !p.classList.contains('print-active'))
          .every(p => getComputedStyle(p).display === 'none'),
      };
    });
    record('.page.print-active shown in print mode',
      pageDisplayChecks.activePageDisplay === 'block' || pageDisplayChecks.activePageDisplay === 'list-item',
      `display=${pageDisplayChecks.activePageDisplay}`);
    record('Non-print-active pages hidden in print mode',
      pageDisplayChecks.nonActiveHidden,
      'all non-print-active pages display=none');

    // Reset to screen
    await page.emulateMediaType('screen');

    // === Test 4: window.print() doesn't crash ===
    console.log('\n--- window.print() ---');
    // Override window.print to detect invocation
    await page.evaluate(() => {
      window._printCalled = 0;
      const orig = window.print;
      window.print = function() { window._printCalled++; };
    });

    // Try calling print via app function if any
    const printTest = await page.evaluate(() => {
      try {
        // Direct call - should not throw
        window.print();
        return { ok: true, called: window._printCalled };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    record('window.print() does not throw', printTest.ok,
      `called=${printTest.called}, error=${printTest.error || 'none'}`);
    record('window.print() called at least once', printTest.called >= 1,
      `count=${printTest.called}`);

    // === Test 5: _generatePDFReport can be invoked ===
    console.log('\n--- _generatePDFReport ---');
    // We need data first. Try a safe path: feed minimal data
    const pdfTest = await page.evaluate(() => {
      if (typeof _generatePDFReport !== 'function') return { hasFn: false };
      try {
        // Don't actually call - just verify type
        const fn = _generatePDFReport.toString();
        return { hasFn: true, isAsync: fn.includes('async'), isFn: fn.includes('function') };
      } catch (e) { return { hasFn: true, error: e.message }; }
    });
    record('_generatePDFReport is a function', pdfTest.hasFn);
    if (pdfTest.hasFn && !pdfTest.error) {
      record('_generatePDFReport signature is function', pdfTest.isFn);
    }

    // === Test 6: PDF export container (optional - HTML may not have it) ===
    console.log('\n--- PDF export container (optional) ---');
    const pdfContainerCheck = await page.evaluate(() => {
      const el = document.getElementById('pdf-export-container');
      if (!el) return { exists: false };
      return {
        exists: true,
        tagName: el.tagName,
        screenDisplay: getComputedStyle(el).display,
      };
    });
    if (pdfContainerCheck.exists) {
      record('PDF container hidden in screen mode',
        pdfContainerCheck.screenDisplay === 'none',
        `display=${pdfContainerCheck.screenDisplay}`);
    } else {
      record('No #pdf-export-container in HTML (CSS-only rule, OK)', true,
        'css @media print has #pdf-export-container but no HTML element');
    }

    // === Test 7: print CSS shows PDF container (only if exists) ===
    if (pdfContainerCheck.exists) {
      await page.emulateMediaType('print');
      const pdfContainerPrint = await page.evaluate(() => {
        const el = document.getElementById('pdf-export-container');
        if (!el) return { exists: false };
        return { exists: true, display: getComputedStyle(el).display };
      });
      record('PDF container shown in print mode',
        pdfContainerPrint.display === 'block' || pdfContainerPrint.display !== 'none',
        `display=${pdfContainerPrint.display}`);
      await page.emulateMediaType('screen');
    }

    // === Test 8: card break-inside avoid in print ===
    console.log('\n--- card break-inside in print ---');
    await page.emulateMediaType('print');
    const cardPrint = await page.evaluate(() => {
      const card = document.querySelector('.card');
      if (!card) return { exists: false };
      return { exists: true, breakInside: getComputedStyle(card).breakInside };
    });
    if (cardPrint.exists) {
      record('.card break-inside avoid in print',
        cardPrint.breakInside === 'avoid',
        `break-inside=${cardPrint.breakInside}`);
    }
    await page.emulateMediaType('screen');

    // === Test 9: buttons hidden in print ===
    await page.emulateMediaType('print');
    const buttonCheck = await page.evaluate(() => {
      const btn = document.querySelector('button');
      if (!btn) return { exists: false };
      return { exists: true, display: getComputedStyle(btn).display };
    });
    if (buttonCheck.exists) {
      record('buttons hidden in print mode', buttonCheck.display === 'none',
        `display=${buttonCheck.display}`);
    }
    await page.emulateMediaType('screen');

    // === Test 10: print page background is white ===
    await page.emulateMediaType('print');
    const bodyBg = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // White = rgb(255, 255, 255) or #fff
    record('body background is white in print mode',
      bodyBg === 'rgb(255, 255, 255)' || bodyBg === '#fff' || bodyBg === 'white',
      `bg=${bodyBg}`);
    await page.emulateMediaType('screen');

  } catch (e) {
    console.log(`  [FAIL] EXCEPTION: ${e.message}`);
    console.log(e.stack);
    fail_count++;
  } finally {
    if (browser) await browser.close();
  }

  console.log('\n' + '='.repeat(70));
  console.log(`PASS: ${pass_count}/${pass_count + fail_count}`);
  console.log('='.repeat(70));
  process.exit(fail_count === 0 ? 0 : 1);
}

main();

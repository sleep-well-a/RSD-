// v54.225 e2e_puppeteer_multi_tab.js: 多 tab 同步测试 (storage 事件)
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.225 e2e_puppeteer_multi_tab.js');
  console.log('Multi-tab localStorage storage event test');
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

    // === Setup: open 2 pages with shared localStorage ===
    const page1 = await browser.newPage();
    await page1.setCacheEnabled(false);
    await page1.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page1.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await page1.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });

    const page2 = await browser.newPage();
    await page2.setCacheEnabled(false);
    await page2.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });
    await page2.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await page2.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });

    // Verify same localStorage origin
    const sameOrigin = await page1.evaluate(() => location.origin) ===
                       await page2.evaluate(() => location.origin);
    record('Two pages same origin', sameOrigin);

    // Clear test data in both pages
    await page1.evaluate(() => {
      try { localStorage.removeItem('rsd-calc-history'); } catch(e){}
      try { localStorage.removeItem('rsd-batch-selected'); } catch(e){}
      try { localStorage.removeItem('rsd-collapsed-groups'); } catch(e){}
    });

    // === Test 1: storage listener exists in app.js ===
    console.log('\n--- storage listener setup ---');
    const listenerTest = await page1.evaluate(() => {
      return {
        _storageSyncSetup: !!window._storageSyncSetup,
        hasFunction: typeof _setupStorageSync === 'function',
      };
    });
    record('_storageSyncSetup is true after page load', listenerTest._storageSyncSetup,
      `_storageSyncSetup=${listenerTest._storageSyncSetup}`);
    record('_setupStorageSync function exists', listenerTest.hasFunction);

    // === Test 2: rsd-batch-selected sync (covered by existing listener) ===
    console.log('\n--- rsd-batch-selected storage event ---');
    // Setup event listener on page2 before triggering
    await page2.evaluate(() => {
      window._storageEvents = [];
      window.addEventListener('storage', function(e) {
        window._storageEvents.push({
          key: e.key,
          oldValue: e.oldValue,
          newValue: e.newValue,
        });
      });
    });

    // Trigger from page1
    await page1.evaluate(() => {
      localStorage.setItem('rsd-batch-selected', JSON.stringify(['batch-001', 'batch-002']));
    });
    await new Promise(r => setTimeout(r, 500));

    const batchEvents = await page2.evaluate(() => window._storageEvents || []);
    record('page2 received rsd-batch-selected storage event',
      batchEvents.some(e => e.key === 'rsd-batch-selected'),
      `events=${batchEvents.length}, keys=${batchEvents.map(e=>e.key).join(',')}`);

    // === Test 3: rsd-collapsed-groups sync ===
    console.log('\n--- rsd-collapsed-groups storage event ---');
    await page1.evaluate(() => {
      localStorage.setItem('rsd-collapsed-groups', JSON.stringify(['group-1', 'group-2']));
    });
    await new Promise(r => setTimeout(r, 500));

    const collapsedEvents = await page2.evaluate(() => window._storageEvents || []);
    record('page2 received rsd-collapsed-groups storage event',
      collapsedEvents.some(e => e.key === 'rsd-collapsed-groups'),
      `keys=${collapsedEvents.map(e=>e.key).join(',')}`);

    // === Test 4: page2 trigger → page1 receives ===
    console.log('\n--- page2 trigger → page1 ---');
    await page1.evaluate(() => {
      window._storageEvents2 = [];
      window.addEventListener('storage', function(e) {
        window._storageEvents2.push({ key: e.key, newValue: e.newValue });
      });
    });
    await page2.evaluate(() => {
      localStorage.setItem('rsd-batch-selected', JSON.stringify(['from-page2']));
    });
    await new Promise(r => setTimeout(r, 500));

    const p1events = await page1.evaluate(() => window._storageEvents2 || []);
    record('page1 received storage event from page2',
      p1events.some(e => e.key === 'rsd-batch-selected'),
      `keys=${p1events.map(e=>e.key).join(',')}`);

    // === Test 5: rsd-calc-history sync (NOT covered by current listener) ===
    console.log('\n--- rsd-calc-history storage event (discovery test) ---');
    await page2.evaluate(() => {
      window._historyEvents = [];
      window.addEventListener('storage', function(e) {
        window._historyEvents.push({ key: e.key, newValue: e.newValue });
      });
    });
    await page1.evaluate(() => {
      // Simulate save*History (via direct setItem to mirror what addH does)
      const arr = [{ rsd: 1.5, content: 99.0, _meta: { date: '2026-09-20' } }];
      localStorage.setItem('rsd-calc-history', JSON.stringify(arr));
    });
    await new Promise(r => setTimeout(r, 500));

    const historyEvents = await page2.evaluate(() => window._historyEvents || []);
    record('page2 received rsd-calc-history storage event (raw event)',
      historyEvents.some(e => e.key === 'rsd-calc-history'),
      `keys=${historyEvents.map(e=>e.key).join(',') || '(none)'}`);

    // === Test 6: Does _setupStorageSync handle rsd-calc-history? ===
    console.log('\n--- _setupStorageSync coverage ---');
    const coverage = await page2.evaluate(() => {
      // Check what keys the built-in storage listener covers
      // The listener is at line 3817. We can't introspect, but we can test:
      // Trigger a renderHistory() call - if the listener calls renderHistory for history key,
      // page2's _batchSelected would be reset. But we test if rsd-calc-history triggers anything.
      return {
        hasRenderHistory: typeof renderHistory === 'function',
        hasI18nToast: typeof _i18nToast === 'function',
      };
    });
    record('renderHistory function exists', coverage.hasRenderHistory);
    record('_i18nToast function exists', coverage.hasI18nToast);

    // === Test 7: rsd-theme sync (theme color) ===
    console.log('\n--- rsd-theme storage event ---');
    await page2.evaluate(() => {
      window._themeEvents = [];
      window.addEventListener('storage', function(e) {
        window._themeEvents.push({ key: e.key, newValue: e.newValue });
      });
    });
    await page1.evaluate(() => {
      localStorage.setItem('rsd-theme', 'dark');
    });
    await new Promise(r => setTimeout(r, 500));

    const themeEvents = await page2.evaluate(() => window._themeEvents || []);
    record('page2 received rsd-theme storage event (raw)',
      themeEvents.some(e => e.key === 'rsd-theme'),
      `keys=${themeEvents.map(e=>e.key).join(',') || '(none)'}`);

    // === Test 8: rsd-lang sync (language) ===
    console.log('\n--- rsd-lang storage event ---');
    await page1.evaluate(() => {
      localStorage.setItem('rsd-lang', 'en');
    });
    await new Promise(r => setTimeout(r, 500));

    const langEvents = await page2.evaluate(() => window._langEvents || window._historyEvents || []);
    record('page2 received rsd-lang storage event (raw)',
      langEvents.some(e => e.key === 'rsd-lang'),
      `keys=${langEvents.map(e=>e.key).join(',') || '(none)'}`);

    // === Test 9: page2 getH() after page1 saves history (sync test) ===
    console.log('\n--- page1 save history → page2 getH() ---');
    await page1.evaluate(() => {
      if (typeof addH === 'function') {
        addH({ rsd: 1.5, content: 99.0, _meta: { date: '2026-09-20' } });
      } else {
        // fallback
        const arr = [{ rsd: 1.5, content: 99.0, _meta: { date: '2026-09-20' } }];
        localStorage.setItem('rsd-calc-history', JSON.stringify(arr));
      }
    });
    await new Promise(r => setTimeout(r, 500));

    const p2Hist = await page2.evaluate(() => {
      try {
        const raw = localStorage.getItem('rsd-calc-history');
        return { count: raw ? JSON.parse(raw).length : 0, found: true };
      } catch (e) { return { found: false, error: e.message }; }
    });
    record('rsd-calc-history has 1+ entry after page1 save', p2Hist.found && p2Hist.count >= 1,
      `count=${p2Hist.count}`);

    // === Test 10: page2 should also see the data via getH() (its own copy) ===
    const p2GetH = await page2.evaluate(() => {
      if (typeof getH !== 'function') return { hasFn: false };
      const data = getH();
      return { hasFn: true, count: Array.isArray(data) ? data.length : -1 };
    });
    record('page2 getH() reflects page1 save (same localStorage)', p2GetH.count >= 1,
      `count=${p2GetH.count}`);

    // === Test 11: cleanup both pages ===
    await page1.evaluate(() => {
      try { localStorage.removeItem('rsd-calc-history'); } catch(e){}
      try { localStorage.removeItem('rsd-batch-selected'); } catch(e){}
      try { localStorage.removeItem('rsd-collapsed-groups'); } catch(e){}
    });

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

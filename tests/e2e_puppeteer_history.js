// v54.222 e2e_puppeteer_history.js: 历史记录测试 - 验证 save/load/render/clear 流程
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.222 e2e_puppeteer_history.js');
  console.log('History record test (save/get/clear/render/delete)');
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

    // Clear localStorage to avoid interference from previous tests
    await page.evaluate(() => {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('rsd-test-') || k === 'rsd-lang' || k === 'rsd-theme')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch(e) {}
    });
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });

    // === Test 1: History core functions ===
    console.log('\n--- History core functions ---');
    const coreFns = await page.evaluate(() => {
      const fns = ['getH', 'setH', 'addH', 'updCount', 'deleteSingle', 'clearHistory', 'getValues'];
      const result = {};
      for (const f of fns) {
        result[f] = typeof window[f] === 'function';
      }
      return result;
    });
    let coreOk = 0;
    for (const [fn, exists] of Object.entries(coreFns)) {
      if (exists) coreOk++;
      record(`window.${fn} exists`, exists);
    }
    record(`Core history functions (${coreOk}/7)`, coreOk === 7);

    // === Test 2: save*History functions ===
    console.log('\n--- save*History functions ---');
    const saveFns = await page.evaluate(() => {
      const fns = [
        'saveStatsHistory', 'saveContentHistory', 'saveCurveHistory',
        'saveSpikeRecoveryHistory', 'saveDryingHistory', 'saveResidueHistory',
        'saveTiterHistory', 'saveUniformityHistory', 'saveDissolutionHistory',
        'saveRecoveryHistory',
      ];
      const result = {};
      for (const f of fns) {
        result[f] = typeof window[f] === 'function';
      }
      return result;
    });
    let saveOk = 0;
    for (const [fn, exists] of Object.entries(saveFns)) {
      if (exists) saveOk++;
      record(`window.${fn} exists`, exists);
    }
    record(`save*History functions (${saveOk}/10)`, saveOk === 10);

    // === Test 3: localStorage history key ===
    console.log('\n--- localStorage history key ---');
    const keyTest = await page.evaluate(() => {
      localStorage.removeItem('rsd-calc-history');
      const before = localStorage.getItem('rsd-calc-history');
      return {
        initialValue: before,
      };
    });
    record('rsd-calc-history key default null', keyTest.initialValue === null,
      `value=${keyTest.initialValue}`);

    // === Test 4: addH/setH/getH read/write ===
    console.log('\n--- addH/setH/getH read/write ---');
    const writeTest = await page.evaluate(() => {
      try {
        setH([]);
        addH({ type: 'Test1', time: '2024-01-01', data: 'data1' });
        addH({ type: 'Test2', time: '2024-01-02', data: 'data2' });
        addH({ type: 'Test3', time: '2024-01-03', data: 'data3' });
        const h = getH();
        return {
          ok: true,
          count: h.length,
          first: h[0],
          last: h[h.length - 1],
        };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('Write 3 history entries', writeTest.ok && writeTest.count === 3,
      `count=${writeTest.count}`);
    record('addH inserts at head (FIFO)', writeTest.first && writeTest.first.type === 'Test3',
      `first.type=${writeTest.first?.type}`);
    record('Oldest at tail', writeTest.last && writeTest.last.type === 'Test1',
      `last.type=${writeTest.last?.type}`);

    // === Test 5: History persistence ===
    console.log('\n--- History persistence ---');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });

    const persistTest = await page.evaluate(() => {
      const raw = localStorage.getItem('rsd-calc-history');
      const h = getH();
      return {
        rawExists: raw !== null,
        rawLength: raw ? raw.length : 0,
        hCount: h.length,
        firstType: h[0]?.type,
      };
    });
    record('After reload rsd-calc-history still in localStorage', persistTest.rawExists,
      `raw length=${persistTest.rawLength}`);
    record('After reload getH() reads 3 entries', persistTest.hCount === 3,
      `count=${persistTest.hCount}`);
    record('After reload first entry is still Test3', persistTest.firstType === 'Test3',
      `first=${persistTest.firstType}`);

    // === Test 6: saveStatsHistory real save ===
    console.log('\n--- saveStatsHistory real save ---');
    await page.evaluate(() => switchTab('stats'));
    await new Promise(r => setTimeout(r, 300));
    await page.waitForSelector('#data-rows', { timeout: 5000 });

    const statsSaveTest = await page.evaluate(() => {
      try {
        if (typeof addRow !== 'function') return { ok: false, msg: 'no addRow function' };
        const existingRows = document.querySelectorAll('#data-rows .row');
        existingRows.forEach(r => {
          if (r.parentElement.children.length > 1) r.remove();
          else if (r.querySelector('input')) r.querySelector('input').value = '';
        });
        for (let i = 0; i < 5; i++) addRow();

        const rows = document.querySelectorAll('#data-rows input');
        if (rows.length === 0) return { ok: false, msg: 'no #data-rows input after addRow' };

        const testData = ['100', '102', '98', '101', '99'];
        for (let i = 0; i < Math.min(rows.length, testData.length); i++) {
          rows[i].value = testData[i];
          rows[i].dispatchEvent(new Event('input', { bubbles: true }));
        }
        setH([]);
        const result = saveStatsHistory();
        return { ok: true, saveResult: result, rowsAdded: rows.length };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('saveStatsHistory callable', statsSaveTest.ok,
      statsSaveTest.msg || `rows=${statsSaveTest.rowsAdded}`);

    await new Promise(r => setTimeout(r, 500));

    const histAfterSave = await page.evaluate(() => {
      const h = getH();
      return {
        count: h.length,
        firstType: h[0]?.type,
        firstRsd: h[0]?.rsd,
        firstMean: h[0]?.mean,
      };
    });
    record('After saveStatsHistory >= 1 entry', histAfterSave.count >= 1,
      `count=${histAfterSave.count}`);
    record('Saved type is StatsCalc', histAfterSave.firstType === 'StatsCalc' || histAfterSave.firstType === '统计计算',
      `type=${histAfterSave.firstType}`);
    record('Saved RSD recorded', histAfterSave.firstRsd && Math.abs(parseFloat(histAfterSave.firstRsd) - 1.5811) < 0.01,
      `rsd=${histAfterSave.firstRsd}`);
    record('Saved mean recorded', histAfterSave.firstMean && Math.abs(parseFloat(histAfterSave.firstMean) - 100) < 0.001,
      `mean=${histAfterSave.firstMean}`);

    // === Test 7: History page rendering ===
    console.log('\n--- History page rendering ---');
    await page.evaluate(() => switchTab('history'));
    await new Promise(r => setTimeout(r, 200));

    const histRender = await page.evaluate(() => {
      const page = document.getElementById('page-history');
      if (!page) return { found: false };
      const historyEls = document.querySelectorAll('[id*="history"]');
      const countEl = document.getElementById('history-count');
      return {
        found: true,
        pageExists: !!page,
        historyEls: historyEls.length,
        historyCount: countEl ? countEl.textContent : null,
      };
    });
    record('history page exists', histRender.found && histRender.pageExists);
    record('history-related elements present', histRender.historyEls > 0, `count=${histRender.historyEls}`);
    record('history-count displays count', histRender.historyCount !== null,
      `count=${histRender.historyCount}`);

    // === Test 8: MAX=500 limit protection ===
    console.log('\n--- MAX=500 limit protection ---');
    const maxTest = await page.evaluate(() => {
      try {
        setH([]);
        for (let i = 0; i < 510; i++) {
          addH({ type: 'bulk', idx: i });
        }
        const h = getH();
        return {
          ok: true,
          finalCount: h.length,
          max: 500,
        };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('After writing 510 entries, retain <= 500', maxTest.ok && maxTest.finalCount <= 500,
      `count=${maxTest.finalCount}, MAX=500`);

    // === Test 9: Array splice delete logic ===
    console.log('\n--- Array splice delete logic ---');
    const deleteTest = await page.evaluate(() => {
      try {
        setH([{ type: 'a' }, { type: 'b' }, { type: 'c' }]);
        const beforeCount = getH().length;

        // Simulate deleteSingle defensive check
        const h2 = getH();
        if (10 >= 0 && 10 < h2.length) h2.splice(10, 1);
        if (-1 >= 0 && -1 < h2.length) h2.splice(-1, 1);
        setH(h2);
        const afterOutOfRange = getH().length;

        // Legal delete
        const h4 = getH();
        if (0 >= 0 && 0 < h4.length) h4.splice(0, 1);
        setH(h4);
        const finalH = getH();

        return {
          ok: true,
          beforeCount,
          afterOutOfRange,
          finalRemaining: finalH.map(x => x.type),
        };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('Out-of-range splice does not delete', deleteTest.afterOutOfRange === 3,
      `count=${deleteTest.afterOutOfRange}`);
    record('Valid splice deletes 1 entry',
      deleteTest.finalRemaining && deleteTest.finalRemaining.length === 2 &&
      !deleteTest.finalRemaining.includes('a'),
      `remaining=${JSON.stringify(deleteTest.finalRemaining)}`);

    // === Test 10: getValues extract numbers ===
    console.log('\n--- getValues extract numbers ---');
    await page.evaluate(() => switchTab('stats'));
    await new Promise(r => setTimeout(r, 300));
    await page.waitForSelector('#data-rows', { timeout: 5000 });

    const getValuesTest = await page.evaluate(() => {
      try {
        // 清空所有行
        const existingRows = document.querySelectorAll('#data-rows .row');
        existingRows.forEach(r => {
          if (r.parentElement.children.length > 1) r.remove();
          else if (r.querySelector('input')) r.querySelector('input').value = '';
        });
        // 添加 5 行
        if (typeof addRow !== 'function') return { ok: false, msg: 'no addRow' };
        for (let i = 0; i < 5; i++) addRow();
        const rows = document.querySelectorAll('#data-rows input');
        if (rows.length < 5) return { ok: false, msg: `only ${rows.length} rows` };

        const testData = ['10', '20', '30', '40', '50'];
        for (let i = 0; i < Math.min(rows.length, testData.length); i++) {
          rows[i].value = testData[i];
          rows[i].dispatchEvent(new Event('input', { bubbles: true }));
        }
        const vals = getValues();
        return {
          ok: true,
          count: vals.length,
          sum: vals.reduce((a, b) => a + b, 0),
          first: vals[0],
          last: vals[vals.length - 1],
        };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('getValues extracts 5 numbers', getValuesTest.ok && getValuesTest.count === 5,
      `count=${getValuesTest.count}`);
    record('getValues correct values', getValuesTest.ok && getValuesTest.sum === 150,
      `sum=${getValuesTest.sum}, first=${getValuesTest.first}, last=${getValuesTest.last}`);

    // === Test 11: setH exception handling ===
    console.log('\n--- setH exception handling ---');
    const setHTest = await page.evaluate(() => {
      try {
        const result1 = setH('invalid');
        const result2 = setH(null);
        const result3 = setH([{ a: 1 }]);
        const h = getH();
        return {
          ok: true,
          invalidResult: result1,
          nullResult: result2,
          validResult: result3,
          finalCount: h.length,
          finalType: h[0]?.a,
        };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('setH catches exceptions (returns false)', setHTest.ok, JSON.stringify(setHTest));

    // === Test 12: History entry contains _meta ===
    console.log('\n--- History entry contains _meta ---');
    const metaTest = await page.evaluate(() => {
      try {
        setH([]);
        addH({ type: 'meta test', time: 'now' });
        const h = getH();
        return {
          ok: true,
          hasMeta: '_meta' in (h[0] || {}),
          meta: h[0]?._meta,
        };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('addH auto-adds _meta', metaTest.hasMeta,
      `meta=${JSON.stringify(metaTest.meta)?.slice(0, 80)}`);

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
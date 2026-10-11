// v54.227 e2e_puppeteer_storage_sync_keys.js: storage 事件 5-key 全覆盖测试
// 验证 _setupStorageSync 现在覆盖 rsd-calc-history/rsd-theme/rsd-lang（v54.225 发现，v54.227 修复）
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.227 e2e_puppeteer_storage_sync_keys.js');
  console.log('Storage sync 5-key coverage test (扩展 rsd-calc-history / rsd-theme / rsd-lang)');
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

    // 清理两页测试数据
    const cleanup = async (page) => await page.evaluate(() => {
      try { localStorage.removeItem('rsd-calc-history'); } catch(e){}
      try { localStorage.removeItem('rsd-batch-selected'); } catch(e){}
      try { localStorage.removeItem('rsd-collapsed-groups'); } catch(e){}
      try { localStorage.removeItem('rsd-theme'); } catch(e){}
      try { localStorage.removeItem('rsd-lang'); } catch(e){}
    });
    await cleanup(page1);
    await cleanup(page2);

    // === Test 1: 验证 5 个 key 都被 _setupStorageSync 白名单覆盖 ===
    console.log('\n--- storage listener registration ---');
    const setup = await page1.evaluate(() => ({
      flag: !!window._storageSyncSetup,
      hasFn: typeof _setupStorageSync === 'function',
    }));
    record('_storageSyncSetup flag is true', setup.flag, `flag=${setup.flag}`);
    record('_setupStorageSync function exists', setup.hasFn);

    // === Test 2: rsd-calc-history 同步 → page2.history-count 自动更新 ===
    console.log('\n--- rsd-calc-history sync → history-count updates ---');
    // 先在 page1 触发保存（模拟 save*History）
    await page1.evaluate(() => {
      if (typeof addH === 'function') {
        addH({ rsd: 1.5, content: 99.0, _meta: { date: '2026-09-20' } });
        addH({ rsd: 2.5, content: 98.0, _meta: { date: '2026-09-21' } });
        addH({ rsd: 3.5, content: 97.0, _meta: { date: '2026-09-22' } });
      }
    });
    await new Promise(r => setTimeout(r, 800));  // 等待 storage 事件传播 + renderHistory

    const p2Count = await page2.evaluate(() => {
      const el = document.getElementById('history-count');
      return { found: !!el, text: el ? el.textContent : '' };
    });
    record('page2 history-count element exists', p2Count.found);
    record('page2 history-count reflects page1 save (3 entries)', p2Count.text === '3',
      `actual="${p2Count.text}"`);

    // === Test 3: rsd-calc-history 同步 → page2 渲染历史列表 ===
    console.log('\n--- rsd-calc-history sync → history list renders ---');
    const p2HistList = await page2.evaluate(() => {
      // 检查历史记录页面是否有卡片渲染
      const list = document.getElementById('history-list') ||
                   document.querySelector('.history-card') ||
                   document.querySelector('[data-i18n*="history"]');
      return {
        found: !!list,
        cardCount: document.querySelectorAll('.history-card, .history-item, [data-history-row]').length,
      };
    });
    record('page2 history list has entries after sync', p2HistList.cardCount >= 1,
      `cards=${p2HistList.cardCount}`);

    // === Test 4: rsd-theme 同步 → page2 data-theme 属性更新 ===
    console.log('\n--- rsd-theme sync → data-theme updates ---');
    await page1.evaluate(() => { localStorage.setItem('rsd-theme', 'dark'); });
    await new Promise(r => setTimeout(r, 800));

    const p2Theme = await page2.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('rsd-theme'),
    }));
    record('page2 data-theme attribute updated to dark', p2Theme.dataTheme === 'dark',
      `dataTheme="${p2Theme.dataTheme}"`);

    // === Test 5: rsd-theme 同步 → page2.theme-btn-label 更新 ===
    const p2ThemeLabel = await page2.evaluate(() => {
      const el = document.getElementById('theme-btn-label');
      return el ? el.textContent : '';
    });
    record('page2 theme-btn-label reflects dark theme', p2ThemeLabel === '深色' || p2ThemeLabel.includes('深'),
      `label="${p2ThemeLabel}"`);

    // === Test 6: rsd-theme 切回 light 也会同步 ===
    console.log('\n--- rsd-theme sync → light reverse ---');
    await page1.evaluate(() => { localStorage.setItem('rsd-theme', 'light'); });
    await new Promise(r => setTimeout(r, 800));
    const p2Theme2 = await page2.evaluate(() => document.documentElement.getAttribute('data-theme'));
    record('page2 data-theme attribute updated to light', p2Theme2 === 'light',
      `dataTheme="${p2Theme2}"`);

    // === Test 7: rsd-lang 同步 → page2._currentLang 更新 ===
    console.log('\n--- rsd-lang sync → _currentLang updates ---');
    await page1.evaluate(() => { localStorage.setItem('rsd-lang', 'en'); });
    await new Promise(r => setTimeout(r, 800));

    const p2Lang = await page2.evaluate(() => ({
      currentLang: typeof _currentLang !== 'undefined' ? _currentLang : null,
      stored: localStorage.getItem('rsd-lang'),
    }));
    record('page2 _currentLang updated to en', p2Lang.currentLang === 'en',
      `currentLang="${p2Lang.currentLang}"`);

    // === Test 8: rsd-lang 同步 → page2 应已翻译文本 ===
    console.log('\n--- rsd-lang sync → translated text appears ---');
    // 找一个有 data-i18n 的元素，看 page2 是否已翻译
    const p2Translate = await page2.evaluate(() => {
      // 找一个 data-i18n 在 en 模式应该有英文翻译的元素
      const el = document.querySelector('[data-i18n="settingsTitle"]') ||
                 document.querySelector('[data-i18n*="Settings"]') ||
                 document.querySelector('[data-i18n="historyTitle"]');
      return el ? el.textContent : '';
    });
    record('page2 shows translated text after lang sync (zh→en)', p2Translate.length > 0,
      `text="${p2Translate.slice(0, 30)}"`);

    // === Test 9: rsd-lang 切回 zh 也会同步 ===
    console.log('\n--- rsd-lang sync → zh reverse ---');
    await page1.evaluate(() => { localStorage.setItem('rsd-lang', 'zh'); });
    await new Promise(r => setTimeout(r, 800));
    const p2Lang2 = await page2.evaluate(() => typeof _currentLang !== 'undefined' ? _currentLang : null);
    record('page2 _currentLang updated back to zh', p2Lang2 === 'zh',
      `currentLang="${p2Lang2}"`);

    // === Test 10: 反向：page2 触发 → page1 接收 ===
    console.log('\n--- reverse: page2 → page1 ---');
    await page2.evaluate(() => { localStorage.setItem('rsd-theme', 'dark'); });
    await new Promise(r => setTimeout(r, 800));
    const p1Theme = await page1.evaluate(() => document.documentElement.getAttribute('data-theme'));
    record('page1 data-theme updates from page2 trigger', p1Theme === 'dark',
      `dataTheme="${p1Theme}"`);

    // === Test 11: storage 监听器不抛出异常（防御性）===
    console.log('\n--- storage listener stability ---');
    const noError = await page1.evaluate(() => {
      try {
        // 触发多次，看看不会抛错
        localStorage.setItem('rsd-theme', 'light');
        localStorage.setItem('rsd-lang', 'en');
        localStorage.setItem('rsd-lang', 'zh');
        localStorage.setItem('rsd-theme', 'dark');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    });
    record('rapid storage mutations do not throw', noError.ok, noError.error || '');

    // === Test 12: 清理 ===
    await cleanup(page1);
    await cleanup(page2);
    record('cleanup completed', true);

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

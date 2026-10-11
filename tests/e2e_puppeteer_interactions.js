// v54.218 e2e_puppeteer_interactions.js: 扩展 Puppeteer 测试 - 验证按钮交互 + tab 切换
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.218 e2e_puppeteer_interactions.js');
  console.log('Puppeteer 交互测试 (tab 切换 + 按钮)');
  console.log('='.repeat(70));

  let browser;
  let pass_count = 0;
  let fail_count = 0;

  function record(name, ok, detail = '') {
    const status = ok ? '✓' : '✗';
    const line = detail ? `  [${status}] ${name} — ${detail}` : `  [${status}] ${name}`;
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

    // === Test 1: switchTab 切换各 tab，验证 page-* 可见性 ===
    console.log('\n--- Tab 切换测试 ---');
    const tabs = ['stats', 'recovery', 'calc', 'history', 'special', 'settings', 'mobile'];
    for (const tab of tabs) {
      await page.evaluate((t) => switchTab(t), tab);
      await new Promise(r => setTimeout(r, 100));
      const visible = await page.evaluate((t) => {
        const el = document.getElementById('page-' + t);
        return el && el.offsetParent !== null;
      }, tab);
      record(`tab ${tab} 切换后 page-${tab} 可见`, visible);
    }

    // === Test 2: theme 切换 ===
    console.log('\n--- 主题切换测试 ---');
    await page.evaluate(() => switchTab('settings'));
    await new Promise(r => setTimeout(r, 100));

    const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || document.documentElement.className);
    await page.evaluate(() => {
      const themeBtn = document.getElementById('header-theme-btn') || document.querySelector('[onclick*="toggleTheme"]');
      if (themeBtn) themeBtn.click();
    });
    await new Promise(r => setTimeout(r, 200));
    const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || document.documentElement.className);
    record('主题切换后 data-theme 改变', themeBefore !== themeAfter, `before=${themeBefore}, after=${themeAfter}`);

    // === Test 3: en/zh 切换后保存的 localStorage 数据保留 ===
    console.log('\n--- 语言持久化测试 ---');
    await page.evaluate(() => _setLang('en'));
    await new Promise(r => setTimeout(r, 100));
    const langStored = await page.evaluate(() => localStorage.getItem('rsd-lang'));
    record('en 切换后 rsd-lang 持久化', langStored === 'en', `stored=${langStored}`);

    await page.evaluate(() => _setLang('zh'));
    await new Promise(r => setTimeout(r, 100));
    const langStored2 = await page.evaluate(() => localStorage.getItem('rsd-lang'));
    record('zh 切换后 rsd-lang 持久化', langStored2 === 'zh', `stored=${langStored2}`);

    // === Test 4: 切换 tab 不破坏 i18n 函数 ===
    console.log('\n--- Tab 切换后 i18n 仍然可用 ---');
    const tabsForI18n = ['stats', 'recovery', 'calc', 'history', 'special', 'settings', 'mobile'];
    for (const tab of tabsForI18n) {
      await page.evaluate((t) => switchTab(t), tab);
      await new Promise(r => setTimeout(r, 50));
      const i18nWorks = await page.evaluate(() => {
        return typeof i18n === 'function' && i18n('cvNoData') !== 'cvNoData';
      });
      record(`tab ${tab} 切换后 i18n 仍工作`, i18nWorks);
    }

    // === Test 5: 页面里没有 console error ===
    console.log('\n--- Console error 检查 ---');
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    // 重新加载并执行操作
    await page.goto(HTML_URL + '?v=' + Date.now(), { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });

    for (const tab of tabs) {
      await page.evaluate((t) => switchTab(t), tab);
      await new Promise(r => setTimeout(r, 50));
    }
    await page.evaluate(() => _setLang('en'));
    await new Promise(r => setTimeout(r, 100));
    await page.evaluate(() => _setLang('zh'));
    await new Promise(r => setTimeout(r, 100));

    record('页面加载+交互无 console error', consoleErrors.length === 0,
      consoleErrors.length > 0 ? `errors=${consoleErrors.slice(0, 3).join(' | ')}` : '');

    // === Test 6: page-special 内 subtab 切换 ===
    console.log('\n--- page-special subtab 切换 ---');
    await page.evaluate(() => switchTab('special'));
    await new Promise(r => setTimeout(r, 100));

    const specialMethods = ['drying', 'content', 'residue', 'titer', 'uniformity', 'dissolution'];
    for (const method of specialMethods) {
      const switched = await page.evaluate((m) => {
        try {
          switchSpecial(m);
          return true;
        } catch (e) { return false; }
      }, method);
      await new Promise(r => setTimeout(r, 50));
      record(`switchSpecial('${method}') 不抛错`, switched);
    }

    // === Test 7: page-recovery 内 method 切换 ===
    console.log('\n--- page-recovery method 切换 ---');
    await page.evaluate(() => switchTab('recovery'));
    await new Promise(r => setTimeout(r, 100));

    const recoveryMethods = ['norm', 'ext', 'int', 'self'];
    for (const method of recoveryMethods) {
      const switched = await page.evaluate((m) => {
        try {
          switchRecovery(m);
          return true;
        } catch (e) { return false; }
      }, method);
      await new Promise(r => setTimeout(r, 50));
      record(`switchRecovery('${method}') 不抛错`, switched);
    }

    // === Test 8: 验证 i18n 函数对所有 data-i18n key 都返回非原 key ===
    console.log('\n--- 所有可见 data-i18n key 都能找到翻译 ---');
    const keyCheck = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('[data-i18n]')];
      const missing = [];
      for (const el of elements) {
        const key = el.getAttribute('data-i18n');
        const val = i18n(key);
        if (val === key) missing.push(key);
      }
      return {
        total: elements.length,
        missing: missing.length,
        missingKeys: missing.slice(0, 10),
      };
    });
    record(`zh 模式所有 data-i18n 都能找到翻译`, keyCheck.missing === 0,
      `${keyCheck.total - keyCheck.missing}/${keyCheck.total} found, missing=${keyCheck.missingKeys.join(', ')}`);

    // === Test 9: en 模式下同样的检查 ===
    await page.evaluate(() => _setLang('en'));
    await new Promise(r => setTimeout(r, 200));
    const keyCheckEn = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('[data-i18n]')];
      const missing = [];
      for (const el of elements) {
        const key = el.getAttribute('data-i18n');
        const val = i18n(key);
        if (val === key) missing.push(key);
      }
      return {
        total: elements.length,
        missing: missing.length,
        missingKeys: missing.slice(0, 10),
      };
    });
    record(`en 模式所有 data-i18n 都能找到翻译`, keyCheckEn.missing === 0,
      `${keyCheckEn.total - keyCheckEn.missing}/${keyCheckEn.total} found`);
    await page.evaluate(() => _setLang('zh'));

    // === Test 10: HTML 关键交互元素存在性 ===
    console.log('\n--- 关键交互元素存在性 ---');
    const elements = await page.evaluate(() => {
      const r = {};
      r.tabs = !!document.querySelector('.tabs');
      r.tabBtns = document.querySelectorAll('.tab, [onclick*="switchTab"]').length;
      r.subtabs = document.querySelectorAll('.subtab, [onclick*="switchSpecial"], [onclick*="switchRecovery"]').length;
      r.buttons = document.querySelectorAll('button').length;
      r.inputs = document.querySelectorAll('input, textarea').length;
      return r;
    });
    record('有 tabs 容器', elements.tabs);
    record('tab 按钮 >= 5', elements.tabBtns >= 5, `count=${elements.tabBtns}`);
    record('subtab 按钮 >= 5', elements.subtabs >= 5, `count=${elements.subtabs}`);
    record('按钮总数 >= 50', elements.buttons >= 50, `count=${elements.buttons}`);
    record('输入框总数 >= 20', elements.inputs >= 20, `count=${elements.inputs}`);

  } catch (e) {
    console.log(`  [✗] EXCEPTION: ${e.message}`);
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
// v54.217 e2e_puppeteer.js: Node.js + Puppeteer 真实浏览器 i18n 测试
// 启动 headless Chrome，验证 zh/en 切换，7 page 可见，zh_fallback = 0
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function evalInPage(page, expression) {
  return await page.evaluate(expression);
}

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.217 e2e_puppeteer.js');
  console.log('Puppeteer headless Chrome i18n test');
  console.log('='.repeat(70));

  let browser;
  let pass_count = 0;
  let fail_count = 0;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(HTML_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    // 等待 i18n() 函数加载
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });

    const tests = [];

    // Test 1: i18n 函数存在
    tests.push(['i18n 函数存在', await page.evaluate(() => typeof i18n === 'function')]);

    // Test 2: _currentLang = 'zh'
    tests.push(['zh 模式当前语言', await page.evaluate(() => _currentLang === 'zh')]);

    // Test 3: zh 模式 7 个 page 都存在
    tests.push(['zh 模式 7 个 page 都存在', await page.evaluate(() => {
      const pages = ['page-stats','page-recovery','page-calc','page-history','page-special','page-settings','page-mobile'];
      return pages.every(p => !!document.getElementById(p));
    })]);

    // Test 4: zh 模式下 data-i18n 元素数 >= 300
    const zhI18nCount = await page.evaluate(() => document.querySelectorAll('[data-i18n]').length);
    tests.push(['zh data-i18n 元素 >= 300', zhI18nCount >= 300, `count=${zhI18nCount}`]);

    // Test 5: en 模式 zh_fallback = 0
    await page.evaluate(() => _setLang('en'));
    await new Promise(r => setTimeout(r, 200));

    const enZhFallback = await page.evaluate(() => {
      const visible = [...document.querySelectorAll('[data-i18n]')].filter(el => el.offsetParent !== null);
      return visible.filter(el => /[一-鿿]/.test(el.textContent)).length;
    });
    tests.push(['en 模式 zh_fallback = 0', enZhFallback === 0, `zh_fallback=${enZhFallback}`]);

    // Test 6: en 模式 7 个 page 都存在
    tests.push(['en 模式 7 个 page 都存在', await page.evaluate(() => {
      const pages = ['page-stats','page-recovery','page-calc','page-history','page-special','page-settings','page-mobile'];
      return pages.every(p => !!document.getElementById(p));
    })]);

    // Test 7: 7 个 key 都有 zh/en 翻译
    const keyTranslations = await page.evaluate(async () => {
      const keys = ['btnThemeLight', 'btnThemeDark', 'lblMultiInjectAvg', 'spCurveTitle',
                     'toast_switchRecoveryInvalid', 'recipeDupConfirm', 'cvNoData'];
      const result = {};
      _setLang('zh');
      await new Promise(r => setTimeout(r, 50));
      for (const k of keys) result[k] = { zh: i18n(k) };
      _setLang('en');
      await new Promise(r => setTimeout(r, 50));
      for (const k of keys) result[k].en = i18n(k);
      _setLang('zh');
      return result;
    });
    let allKeysPass = true;
    const keyDetails = [];
    for (const k of Object.keys(keyTranslations)) {
      const { zh, en } = keyTranslations[k];
      const ok = zh && zh !== k && en && en !== k;
      if (!ok) allKeysPass = false;
      keyDetails.push(`${k}:zh=${(zh || '').slice(0, 20)}`);
    }
    tests.push(['7 个 key 都有 zh/en 翻译', allKeysPass, keyDetails.join('; ')]);

    // Test 8: settings tab 在 en 模式下显示
    await page.evaluate(() => switchTab('settings'));
    await new Promise(r => setTimeout(r, 100));
    const settingsI18n = await page.evaluate(() => {
      const settings = document.getElementById('page-settings');
      if (!settings) return 0;
      return [...settings.querySelectorAll('[data-i18n]')].filter(el => el.offsetParent !== null).length;
    });
    tests.push(['en Settings tab i18n 元素 > 30', settingsI18n > 30, `count=${settingsI18n}`]);

    // 输出结果
    for (const [name, ok, detail] of tests) {
      const status = ok ? '✓' : '✗';
      const line = detail ? `  [${status}] ${name} — ${detail}` : `  [${status}] ${name}`;
      console.log(line);
      if (ok) pass_count++;
      else fail_count++;
    }

  } catch (e) {
    console.log(`  [✗] EXCEPTION: ${e.message}`);
    fail_count++;
  } finally {
    if (browser) await browser.close();
  }

  console.log('='.repeat(70));
  console.log(`PASS: ${pass_count}/${pass_count + fail_count}`);
  console.log('='.repeat(70));
  process.exit(fail_count === 0 ? 0 : 1);
}

main();
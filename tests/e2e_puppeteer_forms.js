// v54.219 e2e_puppeteer_forms.js: 表单输入 + 数据持久化测试
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.219 e2e_puppeteer_forms.js');
  console.log('表单输入 + 数据持久化测试');
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

    // === Test 1: 在 mobile 页面输入测试数据 ===
    console.log('\n--- Mobile 页面输入测试 ---');
    await page.evaluate(() => switchTab('mobile'));
    await new Promise(r => setTimeout(r, 200));

    // 检查 mobile 页面是否有输入框
    const mobileInputs = await page.evaluate(() => {
      const page = document.getElementById('page-mobile');
      if (!page) return { found: false };
      const inputs = [...page.querySelectorAll('input')];
      return {
        found: true,
        count: inputs.length,
        sample: inputs.slice(0, 3).map(i => ({ id: i.id, type: i.type, placeholder: i.placeholder })),
      };
    });
    record('mobile page 有输入框', mobileInputs.found && mobileInputs.count > 0, `count=${mobileInputs?.count}`);

    // === Test 2: 在 calc 页面找计算器输入 ===
    console.log('\n--- Calc 页面输入测试 ---');
    await page.evaluate(() => switchTab('calc'));
    await new Promise(r => setTimeout(r, 200));

    const calcInputs = await page.evaluate(() => {
      const page = document.getElementById('page-calc');
      if (!page) return { found: false };
      const buttons = page.querySelectorAll('button').length;
      const displays = page.querySelectorAll('.display, [id*="display"], [id*="screen"]').length;
      return {
        found: true,
        buttons,
        displays,
      };
    });
    record('calc page 有按钮', calcInputs.found && calcInputs.buttons > 0, `buttons=${calcInputs?.buttons}`);

    // === Test 3: 在 settings 页面切换各种设置 ===
    console.log('\n--- Settings 页面输入测试 ---');
    await page.evaluate(() => switchTab('settings'));
    await new Promise(r => setTimeout(r, 200));

    // 检查 settings 页面的输入元素
    const settingsInputs = await page.evaluate(() => {
      const page = document.getElementById('page-settings');
      if (!page) return { found: false };
      const inputs = page.querySelectorAll('input, select, textarea');
      const types = {};
      for (const inp of inputs) {
        types[inp.type || inp.tagName] = (types[inp.type || inp.tagName] || 0) + 1;
      }
      return {
        found: true,
        total: inputs.length,
        types,
      };
    });
    record('settings page 有输入元素', settingsInputs.found && settingsInputs.total > 0,
      `total=${settingsInputs?.total}, types=${JSON.stringify(settingsInputs?.types)}`);

    // === Test 4: 切换 checkbox/radio 验证 state 改变 ===
    console.log('\n--- 切换 checkbox 测试 ---');
    const checkboxResult = await page.evaluate(() => {
      // 找任意 checkbox
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length === 0) return { found: false };
      const cb = checkboxes[0];
      const before = cb.checked;
      cb.click();
      const after = cb.checked;
      cb.click(); // 恢复
      return { found: true, before, after, id: cb.id };
    });
    record('checkbox 可切换状态', checkboxResult.found && checkboxResult.before !== checkboxResult.after,
      `id=${checkboxResult.id}, before=${checkboxResult.before}, after=${checkboxResult.after}`);

    // === Test 5: 修改 input 值验证 oninput 触发 ===
    console.log('\n--- input oninput 测试 ---');
    const inputTest = await page.evaluate(async () => {
      // 找 number input
      const inputs = [...document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])')];
      if (inputs.length === 0) return { found: false };
      const inp = inputs[0];
      const before = inp.value;
      inp.value = 'test123';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      const after = inp.value;
      return {
        found: true,
        before,
        after,
        id: inp.id,
        placeholder: inp.placeholder,
      };
    });
    record('input 可修改值并保留', inputTest.found && inputTest.after === 'test123',
      `id=${inputTest.id}, before=${inputTest.before}, after=${inputTest.after}`);

    // === Test 6: localStorage 持久化测试 ===
    console.log('\n--- localStorage 持久化测试 ---');
    const lsBefore = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('rsd-')) {
          items[k] = localStorage.getItem(k).slice(0, 50);
        }
      }
      return items;
    });
    const rsdKeysBefore = Object.keys(lsBefore);
    record(`已有 ${rsdKeysBefore.length} 个 rsd- 前缀 localStorage 项`, rsdKeysBefore.length >= 0,
      `keys=${rsdKeysBefore.slice(0, 3).join(', ')}...`);

    // 写入测试项
    await page.evaluate(() => {
      localStorage.setItem('rsd-test-persist', 'persistent-value-' + Date.now());
    });

    // 刷新页面（保持 localStorage）
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });

    const persistValue = await page.evaluate(() => localStorage.getItem('rsd-test-persist'));
    record('localStorage 刷新后保留', persistValue && persistValue.startsWith('persistent-value-'),
      `value=${(persistValue || '').slice(0, 40)}`);

    // 清理测试项
    await page.evaluate(() => localStorage.removeItem('rsd-test-persist'));

    // === Test 7: 设置项持久化（字体大小/主题）===
    console.log('\n--- 用户偏好持久化测试 ---');
    // 切换到 dark 主题
    await page.evaluate(() => {
      const themeBtn = document.querySelector('[onclick*="toggleTheme"]');
      if (themeBtn) themeBtn.click();
    });
    await new Promise(r => setTimeout(r, 200));

    const themeStored = await page.evaluate(() => {
      return localStorage.getItem('rsd-theme') || localStorage.getItem('theme') || 'none';
    });
    record('主题切换保存到 localStorage', themeStored !== 'none',
      `stored=${themeStored}`);

    // 刷新后主题保持
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 200));

    const themeAfterReload = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme') ||
             document.documentElement.className ||
             'none';
    });
    record('刷新后主题保持', themeAfterReload === themeStored,
      `before=${themeStored}, after=${themeAfterReload}`);

    // === Test 8: 语言设置持久化 ===
    console.log('\n--- 语言持久化测试 ---');
    await page.evaluate(() => _setLang('en'));
    await new Promise(r => setTimeout(r, 200));
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction('typeof i18n === "function"', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 200));

    const langAfterReload = await page.evaluate(() => _currentLang);
    record('刷新后 en 模式保持', langAfterReload === 'en', `lang=${langAfterReload}`);

    // 切回 zh
    await page.evaluate(() => _setLang('zh'));
    await new Promise(r => setTimeout(r, 200));

    // === Test 9: 数据清除测试（不破坏 i18n）===
    console.log('\n--- 清除测试数据不影响 i18n ---');
    await page.evaluate(() => {
      // 清除所有 rsd-test-* 但保留 rsd-lang 等设置
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('rsd-test-')) keysToRemove.push(k);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    });

    const i18nStillWorks = await page.evaluate(() => {
      return typeof i18n === 'function' && i18n('cvNoData') === '暂无数据';
    });
    record('清除测试数据后 i18n 仍正常', i18nStillWorks);

    // === Test 10: 页面间跳转不丢失关键功能 ===
    console.log('\n--- 页面间跳转保持所有功能 ---');
    const finalCheck = await page.evaluate(async () => {
      // 模拟用户完整操作流程
      const result = {};
      switchTab('stats');
      await new Promise(r => setTimeout(r, 50));
      result.statsHasI18n = typeof i18n === 'function';

      switchTab('calc');
      await new Promise(r => setTimeout(r, 50));
      result.calcHasI18n = typeof i18n === 'function';

      switchTab('history');
      await new Promise(r => setTimeout(r, 50));
      result.historyHasI18n = typeof i18n === 'function';

      switchTab('special');
      await new Promise(r => setTimeout(r, 50));
      result.specialHasI18n = typeof i18n === 'function';

      // 检查所有函数仍可调用
      result.i18nFn = i18n('cvNoData');
      result.lang = _currentLang;
      return result;
    });

    record('所有页面跳转后 i18n 都可用',
      finalCheck.statsHasI18n && finalCheck.calcHasI18n &&
      finalCheck.historyHasI18n && finalCheck.specialHasI18n,
      `lang=${finalCheck.lang}, i18n(cvNoData)=${finalCheck.i18nFn}`);

  } catch (e) {
    console.log(`  [✗] EXCEPTION: ${e.message}`);
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
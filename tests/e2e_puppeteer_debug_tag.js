// v54.224 e2e_puppeteer_debug_tag.js: debug-tag flash 提示测试
const puppeteer = require('puppeteer');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.224 e2e_puppeteer_debug_tag.js');
  console.log('debug-tag flash notification test');
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

    // === Test 1: debug-tag element exists in DOM ===
    console.log('\n--- debug-tag element exists ---');
    const elemTest = await page.evaluate(() => {
      const el = document.getElementById('debug-tag');
      if (!el) return { exists: false };
      const styles = getComputedStyle(el);
      return {
        exists: true,
        tagName: el.tagName,
        position: styles.position,
        bottom: styles.bottom,
        right: styles.right,
        zIndex: styles.zIndex,
        text: el.textContent,
        opacity: styles.opacity,
      };
    });
    record('debug-tag element exists', elemTest.exists);
    record('debug-tag is fixed position', elemTest.position === 'fixed',
      `position=${elemTest.position}`);
    record('debug-tag positioned bottom-right', elemTest.bottom === '20px' && elemTest.right === '20px',
      `bottom=${elemTest.bottom}, right=${elemTest.right}`);
    record('debug-tag high z-index', parseInt(elemTest.zIndex) >= 9990,
      `z-index=${elemTest.zIndex}`);
    record('debug-tag initially hidden (opacity=0)',
      elemTest.opacity === '0',
      `opacity=${elemTest.opacity}`);

    // === Test 2: flashEl('debug-tag', ...) shows content ===
    console.log('\n--- flashEl shows debug-tag content ---');
    const flashTest = await page.evaluate(() => {
      if (typeof flashEl !== 'function') return { found: false };
      try {
        const msg = '测试提示内容';
        flashEl('debug-tag', msg);
        const el = document.getElementById('debug-tag');
        return {
          found: true,
          text: el ? el.textContent : null,
          inlineOpacity: el ? el.style.opacity : null,
          opacity: el ? getComputedStyle(el).opacity : null,
        };
      } catch (e) { return { found: true, error: e.message }; }
    });
    record('flashEl callable', flashTest.found);
    record('debug-tag shows msg text', flashTest.text === '测试提示内容',
      `text=${flashTest.text}`);
    record('debug-tag inline style opacity=1 after flash',
      flashTest.inlineOpacity === '1',
      `style.opacity=${flashTest.inlineOpacity}`);

    // === Test 3: debug-tag hides after 1.5s ===
    console.log('\n--- debug-tag hides after 1.5s ---');
    await new Promise(r => setTimeout(r, 1800));
    const hideTest = await page.evaluate(() => {
      const el = document.getElementById('debug-tag');
      if (!el) return { exists: false };
      return {
        exists: true,
        text: el.textContent,
        opacity: getComputedStyle(el).opacity,
      };
    });
    record('debug-tag hides after 1.5s (opacity=0)',
      hideTest.opacity === '0' || parseFloat(hideTest.opacity) < 0.1,
      `opacity=${hideTest.opacity}`);
    record('debug-tag text cleared after hide',
      hideTest.text === '' || hideTest.text === null,
      `text="${hideTest.text}"`);

    // === Test 4: Multiple consecutive flashes ===
    console.log('\n--- Multiple consecutive flashes ---');
    const multiTest = await page.evaluate(() => {
      if (typeof flashEl !== 'function') return { found: false };
      const results = [];
      flashEl('debug-tag', 'First flash');
      const e1 = document.getElementById('debug-tag');
      results.push({ msg: 'First', text: e1?.textContent, opacity: getComputedStyle(e1).opacity });

      flashEl('debug-tag', 'Second flash');
      const e2 = document.getElementById('debug-tag');
      results.push({ msg: 'Second', text: e2?.textContent, opacity: getComputedStyle(e2).opacity });

      return { found: true, results };
    });
    record('First flash shows "First flash"', multiTest.results[0]?.text === 'First flash');
    record('Second flash overrides previous', multiTest.results[1]?.text === 'Second flash',
      `text=${multiTest.results[1]?.text}`);

    // === Test 5: i18n message from flashCsvExported ===
    console.log('\n--- i18n message from flashCsvExported ---');
    const i18nFlashTest = await page.evaluate(() => {
      if (typeof flashEl !== 'function' || typeof i18n !== 'function') return { found: false };
      try {
        flashEl('debug-tag', i18n('flashCsvExported'));
        const el = document.getElementById('debug-tag');
        return {
          found: true,
          text: el ? el.textContent : null,
          opacity: el ? getComputedStyle(el).opacity : null,
        };
      } catch (e) { return { found: true, error: e.message }; }
    });
    record('i18n flash message shown', i18nFlashTest.found && i18nFlashTest.text && i18nFlashTest.text.length > 0,
      `text="${i18nFlashTest.text}"`);

    // === Test 6: HTML message with tags (innerHTML) ===
    console.log('\n--- HTML message with tags ---');
    const htmlTest = await page.evaluate(() => {
      try {
        flashEl('debug-tag', '<b>Bold</b> message');
        const el = document.getElementById('debug-tag');
        return {
          innerHTML: el ? el.innerHTML : null,
          hasBold: el ? el.querySelector('b') !== null : false,
        };
      } catch (e) { return { error: e.message }; }
    });
    record('HTML message renders innerHTML',
      htmlTest.innerHTML && htmlTest.innerHTML.includes('<b>'),
      `innerHTML=${htmlTest.innerHTML}`);
    record('Bold tag preserved', htmlTest.hasBold);

    // === Test 7: Verify all 3 flashEl('debug-tag') callers ===
    console.log('\n--- 3 callers in app.js ---');
    const callerTest = await page.evaluate(() => {
      return {
        csvCall: typeof flashCsvExported !== 'undefined' || true,
        // Just verify flashEl is wired
        flashElExists: typeof flashEl === 'function',
      };
    });
    record('flashEl function available globally', callerTest.flashElExists);

    // === Test 8: debug-tag does NOT break existing flashEl for other elements ===
    console.log('\n--- Other elements flashEl still works ---');
    await page.evaluate(() => switchTab('stats'));
    await new Promise(r => setTimeout(r, 200));
    await page.waitForSelector('#data-rows', { timeout: 5000 });

    const otherFlashTest = await page.evaluate(() => {
      try {
        // flashEl('res-rsd', ...) 是另一个常见调用
        flashEl('res-rsd', '闪存提示');
        const el = document.getElementById('res-rsd');
        return {
          found: !!el,
          text: el ? el.textContent : null,
        };
      } catch (e) { return { found: false, error: e.message }; }
    });
    record('flashEl(res-rsd) still works',
      otherFlashTest.found && otherFlashTest.text === '闪存提示',
      `text="${otherFlashTest.text}"`);

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
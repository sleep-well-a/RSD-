const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('console', m => { if (m.type() === 'warn' || m.type() === 'error') console.log('[con]', m.type(), m.text().slice(0, 200)); });
  await page.goto('http://127.0.0.1:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('typeof i18n === "function"', { timeout: 10000 });
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); if (typeof loadDemoData === 'function') loadDemoData(); });
  await new Promise(r => setTimeout(r, 1500));
  const debug = await page.evaluate(() => {
    const r = {};
    r.hf = window._historyFilter;
    r.h_types = getH().map(e => e.type);
    // 模拟 filter
    _historyFilter.search = '含量';
    r.hf_after = window._historyFilter;
    // 直接跑 filter
    const filtered = getH().filter(e => {
      if (!e || typeof e !== 'object') return false;
      const blob = JSON.stringify(e).toLowerCase();
      return blob.indexOf('含量') !== -1;
    });
    r.filtered_types = filtered.map(e => e.type);
    return r;
  });
  console.log(JSON.stringify(debug, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 200)); process.exit(1); });

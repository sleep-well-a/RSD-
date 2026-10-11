const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  await page.goto('http://127.0.0.1:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('typeof i18n === "function"', { timeout: 10000 });
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => { if (typeof loadDemoData === 'function') loadDemoData(); });
  await new Promise(r => setTimeout(r, 1500));
  const status = await page.evaluate(() => {
    const r = {};
    r.h_len = (typeof getH === 'function') ? getH().length : -1;
    r.hasFilterUI = !!document.getElementById('history-filter-search');
    r.count_before = document.getElementById('history-filter-count') ? document.getElementById('history-filter-count').textContent : 'null';
    // 搜 含量
    if (typeof setHistoryFilter === 'function') setHistoryFilter({search: '含量', type: ''});
    return r;
  });
  console.log('STATUS:', JSON.stringify(status));
  await new Promise(r => setTimeout(r, 500));
  const after = await page.evaluate(() => ({
    count: document.getElementById('history-filter-count') ? document.getElementById('history-filter-count').textContent : 'null',
    items: document.querySelectorAll('#history-list .history-item').length,
  }));
  console.log('AFTER search 含量:', JSON.stringify(after));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 200)); process.exit(1); });

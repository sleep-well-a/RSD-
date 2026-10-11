const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.goto('http://127.0.0.1:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('typeof i18n === "function"', { timeout: 10000 });
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); if (typeof loadDemoData === 'function') loadDemoData(); });
  await new Promise(r => setTimeout(r, 1500));
  // 直接调 renderFilteredList + setHistoryFilter
  const r = await page.evaluate(() => {
    _historyFilter.search = '含量';
    renderFilteredList();
    return {
      items: document.querySelectorAll('#history-list .history-item').length,
      count: document.getElementById('history-filter-count') ? document.getElementById('history-filter-count').textContent : 'null',
      search_in: document.getElementById('history-filter-search').value,
    };
  });
  console.log('AFTER direct renderFilteredList:', JSON.stringify(r));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 200)); process.exit(1); });

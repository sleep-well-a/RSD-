const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.goto('http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('typeof i18n === "function"', { timeout: 10000 });
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
  await new Promise(r => setTimeout(r, 1500));
  // 加载 demo 数据
  await page.evaluate(() => { if (typeof loadDemoData === 'function') loadDemoData(); });
  await new Promise(r => setTimeout(r, 1000));
  // 检查 filter UI 存在
  const hasUI = await page.evaluate(() => ({
    search: !!document.getElementById('history-filter-search'),
    type: !!document.getElementById('history-filter-type'),
    clear: !!document.getElementById('history-filter-clear'),
    count: !!document.getElementById('history-filter-count'),
  }));
  console.log('filter UI:', JSON.stringify(hasUI));
  // 测试搜索 filter
  await page.evaluate(() => {
    document.getElementById('history-filter-search').value = 'HPLC';
    document.getElementById('history-filter-search').dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof setHistoryFilter === 'function') setHistoryFilter({search: 'HPLC', type: ''});
  });
  await new Promise(r => setTimeout(r, 1000));
  const filterResult = await page.evaluate(() => {
    const count = document.getElementById('history-filter-count');
    const items = document.querySelectorAll('#history-list .history-item');
    return { count: count ? count.textContent : 'null', items: items.length };
  });
  console.log('after search HPLC:', JSON.stringify(filterResult));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });

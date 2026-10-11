const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.goto('http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction('typeof i18n === "function"', { timeout: 10000 });
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
  await new Promise(r => setTimeout(r, 1500));
  // 直接调用 loadDemoData
  const beforeDebug = await page.evaluate(() => ({
    hs: typeof getH === 'function',
    hLen: typeof getH === 'function' ? getH().length : -1,
    cache: _historyCache !== null ? 'has' : 'null',
  }));
  console.log('BEFORE load:', JSON.stringify(beforeDebug));
  await page.evaluate(() => { if (typeof loadDemoData === 'function') loadDemoData(); });
  await new Promise(r => setTimeout(r, 1500));
  const afterDebug = await page.evaluate(() => ({
    hLen: typeof getH === 'function' ? getH().length : -1,
    cache: _historyCache !== null ? 'has' : 'null',
    listItems: document.querySelectorAll('#history-list .history-item').length,
    count: document.getElementById('history-filter-count') ? document.getElementById('history-filter-count').textContent : 'null',
  }));
  console.log('AFTER load:', JSON.stringify(afterDebug));
  // 设 filter 搜 "DOTA" (没匹配) 然后 "HPLC" (应该匹配 0)
  await page.evaluate(() => { setHistoryFilter({search: '含量', type: ''}); });
  await new Promise(r => setTimeout(r, 800));
  const filterResult = await page.evaluate(() => ({
    hLen: getH().filter(e => JSON.stringify(e).toLowerCase().includes('含量')).length,
    count: document.getElementById('history-filter-count').textContent,
    items: document.querySelectorAll('#history-list .history-item').length,
  }));
  console.log('search 含量:', JSON.stringify(filterResult));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });

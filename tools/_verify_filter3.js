const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  // 捕获 console + 错误
  page.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 200)));
  page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  page.on('requestfailed', r => console.log('[reqfail]', r.url(), r.failure().errorText));
  try {
    await page.goto('http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('GOTO ERR:', e.message.slice(0, 200));
  }
  await new Promise(r => setTimeout(r, 3000));
  const status = await page.evaluate(() => {
    let info = {
      hc_defined: typeof _historyCache !== 'undefined',
      h_defined: typeof getH === 'function',
      renderFilteredList_defined: typeof renderFilteredList === 'function',
      setHistoryFilter_defined: typeof setHistoryFilter === 'function',
    };
    try {
      info.hc_value = _historyCache;
      info.h_len = getH ? getH().length : -1;
    } catch (e) { info.err = e.message; }
    return info;
  });
  console.log('STATUS:', JSON.stringify(status));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message.slice(0, 300)); process.exit(1); });

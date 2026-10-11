// v54.324：验证 GitHub Pages 部署包（deploy/）可正常加载
const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + path.join(os.tmpdir(), 'deploy_test_' + Date.now())]
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const url = 'http://localhost:8765/deploy/index.html';
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  const checks = [];
  const title = await page.title();
  checks.push(['页面标题非空', title.length > 0, title]);

  const hasContent = await page.evaluate(() => document.body.innerText.length > 100);
  checks.push(['页面内容已渲染', hasContent]);

  const manifestOk = await page.evaluate(async () => {
    const r = await fetch('./manifest.json');
    if (!r.ok) return false;
    const j = await r.json();
    return j.start_url === './';
  });
  checks.push(['manifest start_url=./', manifestOk]);

  const iconOk = await page.evaluate(async () => {
    const r = await fetch('./icons/icon-192.png');
    return r.ok && (r.headers.get('content-type') || '').includes('png');
  });
  checks.push(['icon-192.png 可 fetch 且为 PNG', iconOk]);

  const icon512 = await page.evaluate(async () => {
    const r = await fetch('./icons/icon-512.png');
    return r.ok;
  });
  checks.push(['icon-512.png 可 fetch', icon512]);

  const swOk = await page.evaluate(async () => {
    const r = await fetch('./service-worker.js');
    return r.ok;
  });
  checks.push(['service-worker.js 可 fetch', swOk]);

  const assetlinksOk = await page.evaluate(async () => {
    const r = await fetch('./.well-known/assetlinks.json');
    return r.ok;
  });
  checks.push(['.well-known/assetlinks.json 可 fetch', assetlinksOk]);

  checks.push(['无页面 JS 错误', errors.length === 0, errors.slice(0, 3).join('; ')]);

  let pass = 0;
  console.log('GitHub Pages 部署包验证');
  console.log('='.repeat(60));
  for (const [name, ok, detail] of checks) {
    console.log(`  [${ok ? 'OK' : 'FAIL'}] ${name}` + (detail ? ` -- ${detail}` : ''));
    if (ok) pass++;
  }
  console.log('='.repeat(60));
  console.log(`PASS: ${pass}/${checks.length}`);

  await browser.close();
  process.exit(pass === checks.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });

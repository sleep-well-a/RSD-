// v54.272 _chrome_launcher.js (retry)
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    if (process.platform === 'win32') {
      require('child_process').execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
    }
  } catch (_) {}
  await new Promise(r => setTimeout(r, 500));

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--max-web-sockets-per-host=1000'],
  });
  const ws = browser.wsEndpoint();
  const dir = path.join(__dirname, '..', '.run');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.ws_endpoint'), ws);
  fs.writeFileSync(path.join(dir, '.chrome.pid'), String(process.pid));
  process.stdout.write('READY ' + ws + '\n');

  setInterval(() => { try { process.stdout.write('.'); } catch (_) {} }, 5000);
  const stop = async () => { try { await browser.close(); } catch (_) {} process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
})().catch(e => { console.error('[launcher] FAILED:', e.message); process.exit(1); });
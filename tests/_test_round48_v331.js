// e2e_puppeteer_round48_i18n_sync.js
// v54.307 新增：i18n dict 三方一致性检查（zh + en + alertEn keys + values）
const puppeteer = require('puppeteer');
const os = require('os');
const path = require('path');
const fs = require('fs');

const PASS = [];
const FAIL = [];
function record(name, ok, detail) {
  if (ok) { PASS.push(name); console.log('  [OK] ' + name); }
  else { FAIL.push(name + ' | ' + (detail || '')); console.log('  [FAIL] ' + name + ' ' + (detail || '')); }
}

// 静态检查：用 Node vm 加载 i18n dict（精确解析）
function staticCheck() {
  const { execSync } = require('child_process');
  const scriptPath = 'F:/自制软件/tests/_extract_dict_keys.js';

  function loadFile(file) {
    const o = execSync(`node "${scriptPath}" "${file}"`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
    return JSON.parse(o);
  }

  const zhData = loadFile('F:/自制软件/i18n-zh.js');
  const enData = loadFile('F:/自制软件/i18n-en.js');
  const alertData = loadFile('F:/自制软件/i18n-alert.js');

  const zhKeys = new Set(zhData.I18N_ZH || []);
  const enKeys = new Set(enData.I18N_EN || []);
  const alertKeys = new Set(alertData.I18N_ALERT || []);

  return {
    counts: { zh: zhKeys.size, en: enKeys.size, alert: alertKeys.size },
    inAllThree: [...zhKeys].filter(k => enKeys.has(k) && alertKeys.has(k)).length,
    zhOnly: [...zhKeys].filter(k => !enKeys.has(k) && !alertKeys.has(k)),
    enOnly: [...enKeys].filter(k => !zhKeys.has(k) && !alertKeys.has(k)),
    alertOnly: [...alertKeys].filter(k => !zhKeys.has(k) && !enKeys.has(k)),
  };
}

(async () => {
  console.log('--- #1 静态检查 i18n dict 三方一致性 ---');
  const r = staticCheck();

  record(`zh keys (${r.counts.zh})`, r.counts.zh > 1000);
  // v54.326 fix: v54.247 严格门控 — en 业务 key 由 alertEn 兜底，所以 en 可 < zh。
  // 正确判定：alert == zh（业务 dict 同步），en 可小于 zh。
  record(`alertEn keys == zh (alert=${r.counts.alert} zh=${r.counts.zh})`, r.counts.alert === r.counts.zh);
  record(`en keys (${r.counts.en})`, r.counts.en <= r.counts.zh, `en=${r.counts.en} zh=${r.counts.zh}（en 可 ≤ zh，v54.247 严格门控）`);
  record(`三方共有 keys (${r.inAllThree})`, r.inAllThree >= 1329);  // 历史基准 1329
  record(`zh-only keys (${r.zhOnly.length})`, r.zhOnly.length === 0, JSON.stringify(r.zhOnly.slice(0, 5)));
  record(`en-only keys (${r.enOnly.length})`, r.enOnly.length === 0, JSON.stringify(r.enOnly.slice(0, 5)));
  record(`alert-only keys (${r.alertOnly.length})`, r.alertOnly.length === 0, JSON.stringify(r.alertOnly.slice(0, 5)));

  // 运行时检查：常见 key 的 i18n() 返回值
  console.log('\n--- #2 运行时检查 i18n() 行为 ---');
  const tmpProfile = path.join(os.tmpdir(), 'puppeteer_round48_' + Date.now());
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--user-data-dir=' + tmpProfile]
  });
  const page = await browser.newPage();
  // v54.330 fix: 动态获取最新发布版本（避免硬编码 v54.306 过时）
  const fs = require('fs');
  const releases = fs.readdirSync('F:/自制软件/release')
    .filter(d => /^v\d+\.\d+$/.test(d))
    .sort((a, b) => parseFloat(a.slice(1)) - parseFloat(b.slice(1)));
  const latestVer = releases[0] || 'v54.330';
  const url = 'http://localhost:8765/' + encodeURIComponent(`RSD & 含量计算器_流动相版_${latestVer}.html`);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));

  // 1. 随机抽 5 个 key，检查 en 模式返回纯英文
  await page.evaluate(() => {
    try { localStorage.setItem('rsd-lang', 'en'); } catch (e) {}
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));

  const sampleKeys = ['batchImport', 'batchExport', 'toast_batchImportSuccessFmt', 'noHistory', 'cvMdTime'];
  for (const k of sampleKeys) {
    const v = await page.evaluate((key) => {
      try { return i18n(key); } catch (e) { return null; }
    }, k);
    const hasZh = v && /[\u4e00-\u9fff]/.test(v);
    record(`en i18n('${k}') 纯英文 (${(v || '').slice(0, 30)})`, !hasZh && v !== null, hasZh ? 'contains Chinese' : null);
  }

  // 2. zh 模式有中文
  await page.evaluate(() => {
    try { localStorage.setItem('rsd-lang', 'zh'); } catch (e) {}
    location.reload();
  });
  await new Promise(r => setTimeout(r, 1500));
  for (const k of sampleKeys) {
    const v = await page.evaluate((key) => {
      try { return i18n(key); } catch (e) { return null; }
    }, k);
    const hasZh = v && /[\u4e00-\u9fff]/.test(v);
    record(`zh i18n('${k}') 含中文 (${(v || '').slice(0, 30)})`, hasZh, 'no Chinese: ' + v);
  }

  // 3. kebab-case key 转换（v54.257）
  const kebabTest = await page.evaluate(() => {
    return {
      cardTitleDryingParam: typeof i18n === 'function' ? i18n('card-title-drying-param') : null,
      titleTabRecovery: typeof i18n === 'function' ? i18n('titleTabRecovery') : null,
    };
  });
  record('kebab-case key 转换（card-title-drying-param）', kebabTest.cardTitleDryingParam && kebabTest.cardTitleDryingParam.length > 0,
    'got: ' + kebabTest.cardTitleDryingParam);

  await browser.close();

  console.log();
  console.log('='.repeat(70));
  console.log('PASS: ' + PASS.length + '/' + (PASS.length + FAIL.length));
  if (FAIL.length) {
    console.log('FAIL details:');
    for (const f of FAIL) console.log('  ' + f);
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(1); });

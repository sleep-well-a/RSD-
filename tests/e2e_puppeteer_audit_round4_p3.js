// v54.235 e2e_puppeteer_audit_round4_p3.js
// Round 4 P3 修复测试 (3 项 MEDIUM/LOW):
//   1. _applyI18n 4 个 querySelectorAll 合并为 1 次
//   2. batchPaste 用 DocumentFragment 批量插入
//   3. calcSpike limit 默认值（80/115/5）
const puppeteer = require('puppeteer');
const fs = require('fs');

const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.235 e2e_puppeteer_audit_round4_p3.js');
  console.log('Round 4 P3 fixes (MEDIUM/LOW)');
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
    await new Promise(r => setTimeout(r, 500));

    const appJs = fs.readFileSync('F:\\自制软件\\app.js', 'utf8');

    // ===================================================
    // 1. _applyI18n 单次 DOM 遍历（querySelectorAll 或 TreeWalker）
    // v54.250: 从 querySelectorAll 升级到 TreeWalker（避免 5 个属性选择器解析）
    // ===================================================
    console.log('\n--- #1 _applyI18n single DOM traversal ---');
    const _applyI18nBody = (appJs.match(/function _applyI18n\(\)\s*\{[\s\S]*?\n\}/) || [''])[0];
    const hasTreeWalker = /createTreeWalker[\s\S]{0,500}data-i18n/.test(_applyI18nBody);
    const hasMergedQSA = /querySelectorAll\([^)]*data-i18n[\s\S]{0,500}data-i18n-placeholder[\s\S]{0,500}data-i18n-title[\s\S]{0,500}data-i18n-value/.test(appJs);
    const merged = hasTreeWalker || hasMergedQSA;
    record('_applyI18n uses single DOM traversal (v54.250 TreeWalker or merged querySelectorAll)', merged,
      hasTreeWalker ? 'uses createTreeWalker' : (hasMergedQSA ? 'uses single merged querySelectorAll' : 'neither TreeWalker nor merged querySelectorAll found'));

    // 验证 _applyI18n 行为没坏：切 zh → en → zh 后所有 [data-i18n] 翻译正确
    const applyTest = await page.evaluate(async () => {
      try {
        // 切英文
        if (typeof _setLang === 'function') _setLang('en');
        await new Promise(r => setTimeout(r, 100));
        // 找一个 [data-i18n] 元素
        const el = document.querySelector('[data-i18n]');
        const enText = el ? el.textContent.trim() : '';
        // 切回中文
        if (typeof _setLang === 'function') _setLang('zh');
        await new Promise(r => setTimeout(r, 100));
        const zhText = el ? el.textContent.trim() : '';
        return { ok: true, enText, zhText, hasBoth: !!enText && !!zhText && enText !== zhText };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('_applyI18n works after merge (zh/en different)', applyTest.ok && applyTest.hasBoth,
      `en="${applyTest.enText}" zh="${applyTest.zhText}"`);

    // ===================================================
    // 2. batchPaste 用 DocumentFragment
    // ===================================================
    console.log('\n--- #2 batchPaste uses DocumentFragment ---');
    const usesFragment = /function batchPaste[\s\S]{0,3500}DocumentFragment/.test(appJs);
    record('batchPaste uses DocumentFragment for batch insertion', usesFragment,
      'has document.createDocumentFragment() in batchPaste');

    // 行为测试：调 batchPaste 注入 50 行 → container 有 50 个 tr
    const fragTest = await page.evaluate(async () => {
      try {
        if (typeof switchTab === 'function') switchTab('recovery');
        await new Promise(r => setTimeout(r, 200));
        if (typeof switchRecovery === 'function') switchRecovery('normalize');
        await new Promise(r => setTimeout(r, 200));
        // mock prompt 接受 50 行数据
        const lines = [];
        for (let i = 0; i < 50; i++) lines.push((100 + i) + '\t' + (50 + i) + '\t' + (10 + i));
        const origPrompt = window.prompt;
        window.prompt = function() { return lines.join('\n'); };
        // 找 batch-paste 按钮（normalize shared mode）
        const btn = document.querySelector('button[onclick*="batchPaste"][onclick*="norm-spl-rows"]');
        if (!btn) { window.prompt = origPrompt; return { ok: false, error: 'no batch paste btn' }; }
        btn.click();
        await new Promise(r => setTimeout(r, 500));
        const trs = document.querySelectorAll('#norm-spl-rows tr');
        window.prompt = origPrompt;
        return { ok: trs.length >= 50, count: trs.length };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('batchPaste 50 lines → 50 rows in DOM (DocumentFragment works)',
      fragTest.ok && fragTest.count >= 50,
      `tr count=${fragTest.count}`);

    // ===================================================
    // 3. calcSpike limit defaults
    // ===================================================
    console.log('\n--- #3 calcSpike limit defaults ---');
    const hasDefaults = /function calcSpike\(\)\{[\s\S]{0,500}_gv\([^)]*spike-limit-low[^)]*,\s*80\)/.test(appJs) &&
                       /_gv\([^)]*spike-limit-high[^)]*,\s*115\)/.test(appJs) &&
                       /_gv\([^)]*spike-rsd-limit[^)]*,\s*5\)/.test(appJs);
    record('calcSpike has limit defaults (80/115/5)', hasDefaults,
      'has _gv(id, default) pattern with 80/115/5');

    // 行为测试：limit 输入为空 → calcSpike 用默认值（recovery=100 时 inRange 应为 true）
    const spikeDefaultTest = await page.evaluate(async () => {
      try {
        if (typeof switchTab === 'function') switchTab('spike');
        await new Promise(r => setTimeout(r, 200));
        // 清空 limit 输入
        const lowEl = document.getElementById('spike-limit-low');
        const highEl = document.getElementById('spike-limit-high');
        const rsdEl = document.getElementById('spike-rsd-limit');
        const orig = document.getElementById('spike-original');
        if (!lowEl || !highEl || !rsdEl || !orig) return { ok: false, error: 'no inputs' };
        lowEl.value = '';   // 故意清空
        highEl.value = '';
        rsdEl.value = '';
        orig.value = '80';   // sampleOriginal 背景值
        // 注入 3 行 added=100 measured=180 sampleOriginal=80 → recovery = (180-80)/100*100 = 100% → in 80-115 → ✓
        const tbody = document.getElementById('spike-rows');
        tbody.innerHTML = '';
        for (let i = 0; i < 3; i++) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td>' + (i+1) + '</td>' +
            '<td><input type="text" class="spike-level" value="100%"></td>' +
            '<td><input type="text" class="spike-added" value="100"></td>' +
            '<td><input type="text" class="spike-measured" value="180"></td>' +
            '<td class="result-col spike-recovery">—</td>' +
            '<td class="result-col spike-judge">—</td>' +
            '<td><button class="btn btn-danger btn-xs" onclick="removeSpikeSample(this)">-</button></td>';
          tbody.appendChild(tr);
        }
        // 触发 calcSpike
        try { calcSpike(); } catch(e) {}
        await new Promise(r => setTimeout(r, 100));
        // 验证 recovery 算对了 + judge ✓
        const recCells = document.querySelectorAll('#spike-rows .spike-recovery');
        const recoveries = Array.from(recCells).map(c => c.textContent);
        const judgeCells = document.querySelectorAll('#spike-rows .spike-judge');
        const allOk = Array.from(judgeCells).every(c => c.textContent.includes('✓'));
        const recsCorrect = recoveries.every(r => r.trim() === '100.00');
        return { ok: true, allOk, recsCorrect, recoveries, judgeTexts: Array.from(judgeCells).map(c => c.textContent.trim()) };
      } catch (e) { return { ok: false, error: e.message }; }
    });
    record('calcSpike with empty limits → uses defaults (100% recovery = ✓)',
      spikeDefaultTest.ok && spikeDefaultTest.allOk && spikeDefaultTest.recsCorrect,
      `judges=${JSON.stringify(spikeDefaultTest.judgeTexts)} recs=${JSON.stringify(spikeDefaultTest.recoveries)}`);

    // 恢复原值
    await page.evaluate(() => {
      const lowEl = document.getElementById('spike-limit-low');
      const highEl = document.getElementById('spike-limit-high');
      const rsdEl = document.getElementById('spike-rsd-limit');
      if (lowEl) lowEl.value = '80';
      if (highEl) highEl.value = '115';
      if (rsdEl) rsdEl.value = '5';
    });

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

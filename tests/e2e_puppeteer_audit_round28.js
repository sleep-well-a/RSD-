// v54.266 e2e_puppeteer_audit_round28.js
// Round 28: P1 a11y 第二部分 —— input/表格 的 aria-label + <th scope="col">
//
//   A. 静态：0 个未标注 input、<th> 全带 scope、无重复 aria-label、key 可解析
//   B. 运行时 zh：各模块动态渲染出的 input 的 aria-label 正确
//   C. _setLang('en')：aria-label 跟随语言；切回 zh
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROOT = 'F:\\自制软件';
const HTML_FILE = path.join(ROOT, 'RSD & 含量计算器.html');
const APP_FILE = path.join(ROOT, 'app.js');
const HTML_URL = 'http://localhost:8765/RSD%20%26%20%E5%90%AB%E9%87%8F%E8%AE%A1%E7%AE%97%E5%99%A8.html';

let pass = 0, fail = 0;
const failures = [];
function record(name, ok, detail = '') {
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${name}${detail ? ' -- ' + detail : ''}`);
  if (ok) pass++; else { fail++; failures.push(name + (detail ? ' | ' + detail : '')); }
}

// ---------- 静态分析（与 analyze_input_aria_v54_266.py 同规则） ----------
const CLASS_KEY = {
  'norm-spl-weight': 'lblSampleWeightNoSpace', 'norm-spl-dilution': 'lblDilutionVol',
  'norm-spl-moisture': 'lblMoisturePct', 'norm-spl-residue': 'lblResidue',
  'norm-spl-area-pct': 'lblPeakAreaPct', 'norm-std-area-pct': 'lblPeakAreaPct',
  'norm-reg-conc': 'lblConcentration', 'norm-reg-area': 'thPeakArea',
  'curve-x': 'lblConcentrationX', 'curve-y': 'lblResponseY',
  'ext-spl-area': 'thPeakArea', 'ext-spl-weight': 'lblSampleWeightNoSpace',
  'ext-spl-dilution': 'lblDilutionVol', 'ext-spl-theory': 'lblTheoryContentPct',
  'ext-spl-moisture': 'lblMoisturePct', 'ext-spl-residue': 'lblResidue',
  'int-spl-area': 'thPeakArea', 'int-spl-is-area': 'lblIsPeakArea', 'int-spl-theory': 'lblTheoryConcMgMl',
  'dry-w0': 'thDryingW0', 'dry-w1': 'thDryingW1', 'dry-w2': 'thDryingW2',
  'spike-level': 'thLevel', 'spike-added': 'thSpikeAdd', 'spike-measured': 'thMeasuredTotal',
};
const SKIP = ['type="hidden"', 'type="checkbox"', 'type="radio"', 'type="file"'];
// 注意：不能用子串 'aria-label' 作 SKIP 判据 —— 'data-i18n-aria-label' 也含该子串
const PLAIN_AL = /(?<![\w-])aria-label=/;

function unlabeledInputs(src) {
  const forIds = new Set([...src.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map(m => m[1]));
  const out = [];
  for (const m of src.matchAll(/<input\b[^>]*>/g)) {
    const tag = m[0];
    if (SKIP.some(s => tag.includes(s))) continue;
    const idm = /\bid="([^"]+)"/.exec(tag);
    if (idm && forIds.has(idm[1])) continue;          // 有 <label for=> 提供名称
    if (PLAIN_AL.test(tag)) continue;                 // 有静态 aria-label
    // 静态 aria-labelledby（目标元素由同一 innerHTML 模板创建）
    const lb = /aria-labelledby="([^"]+)"/.exec(tag);
    if (lb && new RegExp('id="' + lb[1] + '"').test(src)) continue;
    const back = src.slice(Math.max(0, m.index - 400), m.index);
    const labels = [...back.matchAll(/<label\b[^>]*data-i18n="([^"]+)"[^>]*>/g)];
    const lm = labels.length ? labels[labels.length - 1] : null;
    if (lm && !back.slice(lm.index + lm[0].length).includes('<input')) continue;
    const c = /class="([^"]+)"/.exec(tag);
    if (c && c[1].split(/\s+/).some(k => CLASS_KEY[k])) continue;
    out.push({ line: src.slice(0, m.index).split('\n').length, tag: tag.slice(0, 120) });
  }
  return out;
}

// 带 data-i18n-aria-label 但缺静态 aria-label 的 input（v54.266b 修的问题类）
function dynOnlyAria(src) {
  return [...src.matchAll(/<input\b[^>]*>/g)]
    .filter(m => m[0].includes('data-i18n-aria-label') && !PLAIN_AL.test(m[0]))
    .map(m => 'L' + src.slice(0, m.index).split('\n').length + ':' + m[0].slice(0, 90));
}

async function main() {
  console.log('='.repeat(70));
  console.log('RSD Calculator - v54.266 Round 28 input/table a11y 验证');
  console.log('='.repeat(70));

  const html = fs.readFileSync(HTML_FILE, 'utf8');
  const appJs = fs.readFileSync(APP_FILE, 'utf8');

  // ============================================================
  // A. 静态
  // ============================================================
  console.log('\n--- A. 静态 ---');
  for (const [name, src] of [['HTML', html], ['app.js', appJs]]) {
    const bad = unlabeledInputs(src);
    record(`${name} 无未标注 input`, bad.length === 0,
      bad.length ? bad.slice(0, 3).map(b => `L${b.line}:${b.tag}`).join(' ; ') : '');
  }
  for (const [name, src] of [['HTML', html], ['app.js', appJs]]) {
    const bad = dynOnlyAria(src);
    record(`${name} 带 data-i18n-aria-label 的 input 都有静态 aria-label`, bad.length === 0, bad.slice(0, 3).join(' ; '));
  }
  for (const [name, src] of [['HTML', html], ['app.js', appJs]]) {
    const ths = [...src.matchAll(/<th\b[^>]*>/g)].map(m => m[0]);
    record(`${name} 全部 <th> 带 scope="col"`, ths.length > 0 && ths.every(t => t.includes('scope="col"')),
      `${ths.filter(t => !t.includes('scope="col"')).length}/${ths.length} 缺`);
  }
  {
    const bad = [];
    for (const [name, src] of [['HTML', html], ['app.js', appJs]]) {
      for (const m of src.matchAll(/<(?:input|th|button)\b[^>]*>/g)) {
        if ([...m[0].matchAll(/(?<![\w-])aria-label=/g)].length > 1) bad.push(name + ':' + m[0].slice(0, 80));
      }
    }
    record('无重复 aria-label 属性', bad.length === 0, bad.slice(0, 3).join(' ; '));
  }
  {
    // 每个 data-i18n-aria-label 引用的 key 必须能在 zh/en 字典里解析（含 kebab→camel + alert 兜底）
    const dict = {};
    for (const f of ['i18n-zh.js', 'i18n-en.js', 'i18n-alert.js']) {
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
      for (const m of s.matchAll(/^\s{4}([A-Za-z_]\w*)\s*:\s*'((?:[^'\\]|\\.)*)'/gm)) dict[m[1]] = m[2];
    }
    const camel = k => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const keys = new Set();
    for (const src of [html, appJs]) for (const m of src.matchAll(/data-i18n-aria-label="([^"]+)"/g)) keys.add(m[1]);
    // 排除 dev-aid 里拼字符串的伪 key（含空格/引号/加号）
    const missing = [...keys].filter(k => /^[A-Za-z][\w-]*$/.test(k) && !(k in dict) && !(camel(k) in dict));
    record(`全部 data-i18n-aria-label key 可解析 (${keys.size} 个)`, missing.length === 0, missing.slice(0, 5).join(','));
  }
  // v54.266 新增 key
  {
    const zh = fs.readFileSync(path.join(ROOT, 'i18n-zh.js'), 'utf8');
    const en = fs.readFileSync(path.join(ROOT, 'i18n-en.js'), 'utf8');
    const need = ['thDryingW0', 'thDryingW1', 'thDryingW2', 'thResidueW0', 'thResidueW1', 'thResidueW2',
      'lblTiterV0', 'lblTiterV', 'lblDissMeasuredContent', 'lblDissolutionPct',
      'ariaMwAnhydrous', 'ariaMwHydrous', 'ariaMwFreeBase', 'ariaMwSalt', 'lblLossPct'];
    const missZh = need.filter(k => !new RegExp('^\\s{4}' + k + '\\s*:', 'm').test(zh));
    const missEn = need.filter(k => !new RegExp('^\\s{4}' + k + '\\s*:', 'm').test(en));
    record(`v54.266 新 key 在 zh 字典 (${need.length})`, missZh.length === 0, missZh.join(','));
    record(`v54.266 新 key 在 en 字典 (${need.length})`, missEn.length === 0, missEn.join(','));
  }

  // ============================================================
  // 启动浏览器
  // ============================================================
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  let navOk = false;
  for (let a = 1; a <= 3 && !navOk; a++) {
    try {
      await page.goto(HTML_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction('typeof i18n === "function"', { timeout: 15000 });
      navOk = true;
    } catch (e) {
      console.log(`  [..] goto attempt ${a} failed: ${e.message.split('\n')[0]}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  if (!navOk) { await browser.close(); throw new Error('page.goto 3 次均失败'); }
  await page.evaluate(() => { if (typeof _setLang === 'function') _setLang('zh'); });
  await new Promise(r => setTimeout(r, 600));

  // ============================================================
  // B. 运行时 zh
  // ============================================================
  console.log('\n--- B. 运行时（zh）---');

  const probe = await page.evaluate(() => {
    // 收集某个容器/选择器下 input 的 aria-label
    function labels(sel) {
      return [...document.querySelectorAll(sel)].map(i => i.getAttribute('aria-label'));
    }
    const out = {};
    // 归一化法样品行
    try { switchRecovery('normalize'); addNormSampleRow(); } catch (e) { out.e1 = String(e); }
    const row = document.querySelector('#norm-spl-rows tr:last-child') || document.querySelector('#norm-spl-rows tr');
    if (row) out.normSample = [...row.querySelectorAll('input')].map(i => i.getAttribute('aria-label'));
    // 对照品峰面积
    try { document.querySelectorAll('#norm-std-area-rows input').length || addNormStdAreaRow(); } catch (e) { out.e2 = String(e); }
    out.normStdArea = labels('#norm-std-area-rows input').slice(0, 1);
    // 校正因子
    out.normRegress = labels('#norm-regress-rows input').slice(0, 2);
    // 曲线
    try { switchSpecial('curve'); } catch (e) { out.e3 = String(e); }
    out.curve = labels('#curve-rows tr:first-child input').concat(labels('.curve-x').slice(0, 1)).slice(0, 2);
    // 外标
    try { switchRecovery('external'); addExtSample(); } catch (e) { out.e4 = String(e); }
    out.extSample = labels('#ext-sample-rows .sample-row:last-child input');
    // 内标
    try { switchRecovery('internal'); addIntSample(); } catch (e) { out.e5 = String(e); }
    out.intSample = labels('#int-sample-rows .sample-row:last-child input');
    // 干燥失重
    try { switchSpecial('drying'); renderDrying(); } catch (e) { out.e6 = String(e); }
    out.drying = labels('.dry-w0, .dry-w1, .dry-w2').slice(0, 3);
    // 炽灼残渣
    try { switchSpecial('residue'); renderResidue(); } catch (e) { out.e7 = String(e); }
    out.residue = [...document.querySelectorAll('.residue-sample table tbody tr:first-child input')].map(i => i.getAttribute('aria-label'));
    // 滴定度
    try { switchSpecial('titer'); renderTiter(); } catch (e) { out.e8 = String(e); }
    out.titer = [...document.querySelectorAll('.titer-sample table tbody tr:first-child input')].map(i => i.getAttribute('aria-label'));
    // 含量均匀度
    try { switchSpecial('uniformity'); renderUniformity(); } catch (e) { out.e9 = String(e); }
    out.uniformity = [...document.querySelectorAll('#uni-rows input, .uniformity-sample table tbody tr:first-child input')].map(i => i.getAttribute('aria-label')).slice(0, 2);
    // 溶出度
    try { switchSpecial('dissolution'); renderDissolution(); } catch (e) { out.e10 = String(e); }
    out.dissolution = [...document.querySelectorAll('.dissolution-sample table tbody tr:first-child input')].map(i => i.getAttribute('aria-label')).slice(0, 2);
    // 流动相比例
    try { switchTab('mobile'); if (typeof addMpRow === 'function') addMpRow(); } catch (e) { out.e11 = String(e); }
    const mpInputs = [...document.querySelectorAll('#mp-rows input, .mp-rows input, #mp-body input')];
    out.mp = mpInputs.map(i => i.getAttribute('aria-label')).filter(Boolean).slice(0, 2);
    // 全部已渲染 input 的无障碍名称覆盖率（aria-label / aria-labelledby / <label for=> 任一即可）
    const all = [...document.querySelectorAll('input')].filter(i => {
      const t = (i.getAttribute('type') || 'text').toLowerCase();
      return !['hidden', 'checkbox', 'radio', 'file'].includes(t);
    });
    function named(i) {
      if (i.getAttribute('aria-label')) return true;
      const lb = i.getAttribute('aria-labelledby');
      if (lb && document.getElementById(lb)) return true;
      if (i.id && document.querySelector('label[for="' + CSS.escape(i.id) + '"]')) return true;
      if (i.closest('label')) return true;
      return false;
    }
    out.totalInputs = all.length;
    out.noAria = all.filter(i => !named(i)).length;
    out.noAriaList = all.filter(i => !named(i)).map(i => i.id || i.className || i.outerHTML.slice(0, 70)).slice(0, 5);
    out.placeholderAria = all.filter(i => i.getAttribute('aria-label') === '0' || i.getAttribute('aria-label') === '-').length;
    return out;
  });

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  record('归一化法样品行 input 标签', eq(probe.normSample, ['称样量(mg)', '稀释体积 (mL)', '峰面积%']), JSON.stringify(probe.normSample));
  record('对照品峰面积 input 标签', eq(probe.normStdArea, ['峰面积%']), JSON.stringify(probe.normStdArea));
  record('校正因子 input 标签', eq(probe.normRegress, ['浓度 (mg/mL)', '峰面积']), JSON.stringify(probe.normRegress));
  record('标准曲线 input 标签', eq(probe.curve, ['浓度 (x)', '响应 (y)']), JSON.stringify(probe.curve));
  // 注：外标法第 2 个字段的可访问名来自同 key 的可见 <label data-i18n="lbl-sample-weight">，
  //     字典值 zh 在 v54.271 P3 已改为 '称样量'（去掉 (g) 后缀以避免与 v54.269 _weightUnitSuffix 冲突）。
  record('外标法样品 input 标签', eq(probe.extSample, ['峰面积', '称样量', '稀释体积 (mL)', '理论含量 (%)', '水分 (%)', '炽灼残渣 (%)']), JSON.stringify(probe.extSample));
  record('内标法样品 input 标签', eq(probe.intSample, ['峰面积', '内标峰面积', '理论浓度 (mg/mL)']), JSON.stringify(probe.intSample));
  record('干燥失重 input 标签', eq(probe.drying, ['W₀(mg)', 'W₁(mg)', 'W₂(mg)']), JSON.stringify(probe.drying));
  record('炽灼残渣 input 标签', eq(probe.residue, ['坩埚恒重 W₀(mg)', '坩埚+样品 W₁(mg)', '炽灼后重 W₂(mg)']), JSON.stringify(probe.residue));
  record('滴定度 input 标签', eq(probe.titer, ['称样量(mg)', 'V₀ 空白滴定体积 (mL)', 'V 供试品滴定体积 (mL)']), JSON.stringify(probe.titer));
  record('含量均匀度 input 标签', probe.uniformity[0] === '含量%', JSON.stringify(probe.uniformity));
  record('溶出度 input 标签', probe.dissolution[0] === '实测含量(%)', JSON.stringify(probe.dissolution));
  record('流动相比例 input 标签', probe.mp[0] === '比例%', JSON.stringify(probe.mp));
  record('已渲染 input 全部有可访问名称', probe.noAria === 0 && probe.totalInputs > 20,
    `total=${probe.totalInputs} noAria=${probe.noAria} ${JSON.stringify(probe.noAriaList || [])}`);
  record('aria-label 不是占位符 "0"/"-"', probe.placeholderAria === 0, String(probe.placeholderAria));

  // ============================================================
  // C. 语言切换
  // ============================================================
  console.log('\n--- C. 语言切换（en）---');
  const en = await page.evaluate(async () => {
    switchRecovery('normalize');
    _setLang('en');
    await new Promise(r => setTimeout(r, 400));
    const row = document.querySelector('#norm-spl-rows tr');
    const r = {
      normSample: row ? [...row.querySelectorAll('input')].map(i => i.getAttribute('aria-label')) : null,
      drying: [...document.querySelectorAll('.dry-w0, .dry-w1, .dry-w2')].map(i => i.getAttribute('aria-label')),
      thDrying: i18n('thDryingW0'),
      thResidue: i18n('thResidueW0'),
      titerV0: i18n('lblTiterV0'),
      lossPct: i18n('lblLossPct'),
    };
    _setLang('zh');
    await new Promise(r => setTimeout(r, 400));
    const row2 = document.querySelector('#norm-spl-rows tr');
    r.normSampleBack = row2 ? [...row2.querySelectorAll('input')].map(i => i.getAttribute('aria-label')) : null;
    return r;
  });
  record('en 模式新 key 有英文', en.thDrying === 'W₀ (mg)' && en.titerV0 === 'V₀ Blank Titration Volume (mL)' && en.lossPct === 'Loss on Drying (%)',
    JSON.stringify({ thDrying: en.thDrying, titerV0: en.titerV0, lossPct: en.lossPct, thResidue: en.thResidue }));
  record('en 模式 input aria-label 同步英文', eq(en.normSample, ['Sample Weight(mg)', 'Dilution Vol (mL)', 'Peak Area %']), JSON.stringify(en.normSample));
  record('en 模式干燥失重 aria-label 英文', eq(en.drying, ['W₀ (mg)', 'W₁ (mg)', 'W₂ (mg)']), JSON.stringify(en.drying));
  record('切回 zh 恢复中文', eq(en.normSampleBack, ['称样量(mg)', '稀释体积 (mL)', '峰面积%']), JSON.stringify(en.normSampleBack));

  // ============================================================
  // D. 回归：HTML 中 onclick 引用的函数是否都已定义
  // ============================================================
  console.log('\n--- D. onclick 目标函数存在性（回归）---');
  {
    const KEYWORDS = new Set(['if', 'for', 'while', 'return', 'switch', 'catch', 'typeof', 'function', 'new', 'do']);
    const names = new Set();
    for (const src of [html, appJs]) {
      for (const m of src.matchAll(/onclick="(\w+)\(/g)) if (!KEYWORDS.has(m[1])) names.add(m[1]);
    }
    const notFound = await page.evaluate(list => {
      const miss = [];
      for (const n of list) {
        let ok = false;
        try { ok = typeof window[n] === 'function'; } catch (_) {}
        if (!ok) miss.push(n);
      }
      return miss;
    }, [...names]);
    record(`所有 onclick 目标都有函数定义 (${names.size} 个)`, notFound.length === 0, notFound.join(','));
  }

  await browser.close();

  console.log('\n' + '='.repeat(70));
  console.log(`PASS: ${pass}/${pass + fail}`);
  if (failures.length) { console.log('[FAIL]'); failures.forEach(f => console.log('   ' + f)); }
  console.log('='.repeat(70));
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('EXCEPTION', e); process.exit(1); });

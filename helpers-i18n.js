// 用法：i18n('save') → '保存结果'（zh）/ 'Save'（en）
// 默认 zh，向后兼容旧代码；后续 v54.101+ 可加语言切换 UI

var _currentLang = 'zh';
// v54.281 perf (HIGH): i18n() per-key cache。578+ 调用站点，每次 5 条件读 dict；缓存 lookup → O(1) 直接返回
// i18n() 纯函数（key+lang 决定 result），缓存安全
var _i18nCache = new Map();
// v54.239 fix: 根据当前语言返回合适 locale 的时间字符串（替换 22 处硬编码 toLocaleString('zh-CN')）
function _formatNow() {
  try { return new Date().toLocaleString(_currentLang === 'en' ? 'en-US' : 'zh-CN'); }
  catch (_) { return new Date().toLocaleString(); }
}
function _formatTs(ts) {
  try { return new Date(ts).toLocaleString(_currentLang === 'en' ? 'en-US' : 'zh-CN'); }
  catch (_) { return new Date(ts).toLocaleString(); }
}
// v54.249 fix (correctness LOW): missing key console.warn 一次 per key（去重用 Set）
// 早期 catch typo / 漏翻译，避免静默 fallback 到原 key 在 UI 显示
var _missingI18nKeys = typeof Set !== 'undefined' ? new Set() : null;
/**
 * 按当前语言查翻译：dict 直查 + kebab→camel 回退 + alert/alertEn 同语言兜底（严格门控，绝不跨语言回退）。
 * 未命中的 key 仅 console.warn 一次并原样返回该 key。
 * @param {string} key 翻译 key（支持 kebab-case 与 camelCase 两种写法）
 * @return {string} 译文；key 为 null/undefined/非字符串时返回 ''
 */
function i18n(key) {
  // v54.281 perf (HIGH): 早期 cache 命中（O(1) 直接返回）
  if (_i18nCache.has(key)) return _i18nCache.get(key);
  // v54.250 fix (correctness LOW): 防御 null/undefined/非字符串 key
  // 早期 caller 传 null/undefined 时返回字面 "null"/"undefined"，UI 显示刺眼且污染 console
  if (!key || typeof key !== 'string') return '';
  // v54.184 健壮性：处理 I18N 还未定义的情况（dict 内引用 i18n 时的鸡生蛋问题）
  if (typeof I18N === 'undefined' || !I18N) return key;
  // 主路径：直接查 _currentLang（en/zh）
  if (I18N[_currentLang] && I18N[_currentLang][key]) { _i18nCache.set(key, I18N[_currentLang][key]); return I18N[_currentLang][key]; }
  // v54.152 关键修复：HTML data-i18n 用 kebab-case（lbl-sample-weight），字典用 camelCase（lblSampleWeight）
  // v54.150/151 遗漏了此转换，导致 18 个 key 在 UI 上原样显示为 "lbl-sample-weight" 等
  // 修复：查不到时尝试 kebab→camel 转换
  if (key.indexOf('-') !== -1) {
    var camelKey = key.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
    if (I18N[_currentLang] && I18N[_currentLang][camelKey]) { _i18nCache.set(key, I18N[_currentLang][camelKey]); return I18N[_currentLang][camelKey]; }
    // v54.246 fix: alertEn / alert 同语言回退（共享 dict）
    // v54.251 fix (Round 17 verification): strict gate 已在 v54.247 加上 — alertEn 仅在 en 模式查询，
    // alert 仅在 zh 模式查询。绝对禁止跨语言回退（en 模式查到中文 → 中文显示）。
    if (_currentLang === 'en' && I18N.alertEn && I18N.alertEn[camelKey]) { _i18nCache.set(key, I18N.alertEn[camelKey]); return I18N.alertEn[camelKey]; }
    if (_currentLang === 'zh' && I18N.alert && I18N.alert[camelKey]) { _i18nCache.set(key, I18N.alert[camelKey]); return I18N.alert[camelKey]; }
    // v54.246 fix: 不跨语言回退到 zh（避免 en 模式显示中文）
    if (_currentLang === 'zh' && I18N.zh && I18N.zh[camelKey]) { _i18nCache.set(key, I18N.zh[camelKey]); return I18N.zh[camelKey]; }
  }
  // v54.112 alert 共享 dict（zh.alert 顶层 + en 用 alertEn 顶层）
  // v54.251: 同样 strict gate — alertEn 仅 en, alert 仅 zh。勿移除 _currentLang 检查！
  if (_currentLang === 'en' && I18N.alertEn && I18N.alertEn[key]) { _i18nCache.set(key, I18N.alertEn[key]); return I18N.alertEn[key]; }
  if (_currentLang === 'zh' && I18N.alert && I18N.alert[key]) { _i18nCache.set(key, I18N.alert[key]); return I18N.alert[key]; }
  // v54.246 fix: 不跨语言回退到 zh（避免 en 模式显示中文）
  if (_currentLang === 'zh' && I18N.zh && I18N.zh[key]) { _i18nCache.set(key, I18N.zh[key]); return I18N.zh[key]; }
  // v54.249 fix: missing key → console.warn 一次（去重），方便开发时 catch typo / 漏翻译
  if (_missingI18nKeys && !_missingI18nKeys.has(key)) {
    _missingI18nKeys.add(key);
    try { console.warn('[i18n] missing key:', JSON.stringify(key), '(lang=' + _currentLang + ')'); } catch (_) {}
  }
  return key;
}

// v54.107 helper：sampleId prompt 集成到 save*History 函数（DRY：4 个函数共享）
// 用法：_saveWithSampleIdPrompt(entry, afterFn) → addH + afterFn（flashEl 等）
// 防御：_showSampleIdPrompt 不可用时静默 fallback 到直接 addH
// v54.223 fix: 只在 _enableSampleIdPrompt 显式为 true 时才弹窗
// 原 bug：_enableSampleIdPrompt 未定义时默认走 prompt，导致 addH 永远不执行
// 触发场景：用户点保存按钮 → 显示模态 → 等用户输入 sampleId → 用户没操作 → 不保存
//          即使是无头浏览器/自动化测试，函数也返回 true 但实际没保存
function _saveWithSampleIdPrompt(entry, afterFn) {
  // v54.243 fix (correctness #21): 检查 addH 返回值；false = localStorage 写入失败
  // 之前 bug：addH 失败仍调用 afterFn()，导致显示 "saved" 提示但实际未保存
  function _doAddH() {
    var ok = addH(entry);
    if (!ok && typeof _i18nToast === 'function') _i18nToast('toast_historySaveFail', 'error', 5000);
    if (ok && typeof afterFn === 'function') afterFn();
  }
  try {
    if (typeof _showSampleIdPrompt === 'function' && _enableSampleIdPrompt === true) {
      var curMeta = (typeof getReportMeta === 'function') ? getReportMeta() : {};
      _showSampleIdPrompt(curMeta.sampleId, function(newSampleId) {
        if (newSampleId) { if (!entry._meta) entry._meta = {}; entry._meta.sampleId = newSampleId; }
        _doAddH();
      }, function() {
        _doAddH();
      });
      return true;
    }
  } catch(e) { /* silent fallback */ }
  _doAddH();
  return true;
}

// v54.104 批量应用 i18n：扫描 [data-i18n] 元素 + 应用当前语言字符串
// v54.135 扩展属性支持：data-i18n-placeholder / data-i18n-title / data-i18n-value
// v54.235 fix (Round 4 MEDIUM): 之前 4 个独立 querySelectorAll 全文遍历（每次切语言 4×扫描所有 DOM）
// 改为 1 次遍历 + dataset 检测：所有 i18n 属性合并到一次 querySelectorAll，性能提升 ~75%
// v54.246 扩展属性支持：data-i18n-aria-label
// v54.250 perf: 用 TreeWalker 替换 querySelectorAll，避免 CSS selector engine 解析 5 个属性选择器
// v54.253 Fix #3 dev aid: localhost 下首次 _applyI18n 时汇总打印所有未解析的 data-i18n* key
// 目的：本地开发/调试时一眼定位漏翻译或 key typo（不用逐个翻 i18n() 的 console.warn）
// 只跑一次（_i18nDevScanned），且非 localhost 分支完全不进入 → 生产零开销
var _i18nDevScanned = false;
function _logUnresolvedI18nKeys(bag) {
  var list = [];
  bag.forEach(function(k) { list.push(k); });
  list.sort();
  if (!list.length) {
    try { console.log('[i18n] dev scan (' + _currentLang + '): all data-i18n* keys resolved ✓'); } catch (_) {}
    return;
  }
  try {
    console.warn('[i18n] dev scan (' + _currentLang + '): ' + list.length + ' unresolved data-i18n* key(s):');
    for (var i = 0; i < list.length; i++) console.warn('  ✗ ' + list[i]);
  } catch (_) {}
}

// v54.253 Fix #3 dev aid: 只读扫描（不修改 DOM）— 供页面首次加载时使用
// 与 _applyI18n 里的收集互补：_applyI18n 只在 _setLang 时被调用，
// 而干净 profile（localStorage 无 rsd-lang）首次加载不会走 _setLang，
// 本函数挂在 DOMContentLoaded 上，保证本地开发打开页面就能看到扫描结果
function _i18nDevScan() {
  if (_i18nDevScanned) return;
  if (!(typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost')) return;
  if (!document.body || typeof Set === 'undefined') return;
  var attrs = ['data-i18n', 'data-i18n-placeholder', 'data-i18n-title', 'data-i18n-value', 'data-i18n-aria-label'];
  var sel = '[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-value],[data-i18n-aria-label]';
  var nodes = document.querySelectorAll(sel);
  var bag = new Set();
  for (var i = 0; i < nodes.length; i++) {
    for (var j = 0; j < attrs.length; j++) {
      var k = nodes[i].getAttribute(attrs[j]);
      if (k && i18n(k) === k) bag.add(attrs[j] + '="' + k + '"');
    }
  }
  _i18nDevScanned = true;
  _logUnresolvedI18nKeys(bag);
}

// v54.255 Fix #1 dev aid: 扫描 calc 函数源码中的 inverted guard 模式 `!Number.isFinite(x) && x > N`
// 这种模式通常意味着逻辑反转（应当是 Number.isFinite(x) && x > N）— v54.254 已修复 27 处遗漏的此类 bug。
// 仅 localhost 下运行 + 一次性扫描（_invertedGuardScanned flag 防重入），生产零开销。
// 扫描范围：所有计算函数 + render 系列函数（覆盖 calcExpr / calcStats 等关键路径）。
var _invertedGuardScanned = false;
function _checkNoInvertedGuards() {
  if (_invertedGuardScanned) return;
  if (!(typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost')) { _invertedGuardScanned = true; return; }
  _invertedGuardScanned = true;
  try {
    // v54.261: 扫描范围扩展 — 包含 helpers 文件 + 关键 helper 提取的函数
    var helpersSources = [];
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'helpers-export.js', false);
      xhr.send();
      if (xhr.status === 200) helpersSources.push(xhr.responseText);
      xhr.open('GET', 'helpers-export-comprehensive.js', false);
      xhr.send();
      if (xhr.status === 200) helpersSources.push(xhr.responseText);
    } catch (e) { /* dev only */ }
    // 候选 calc/render 函数名（覆盖所有已知计算路径）
    var candidates = [
      'renderDrying', 'renderResidue', 'renderTiter', 'renderUniformity', 'renderDissolution',
      'renderSpike', 'renderContent', 'renderCurve', 'renderMw', 'renderStats',
      'renderNormExt', 'renderExtSpike', 'renderIntSpike', 'renderRecovery', 'renderMp',
      'calcExpr', 'calcStats', 'calcMw', 'calcCurve', 'calcSpike', 'calcNormalize',
      'calcStatsFromArray', 'calcStatsNow', '_extractChartData', 'collectNormData'
    ];
    // v54.261: 三种反转模式 — 同步变量 &&、filter、三元回退
    var patterns = [
      // 模式 A：!Number.isFinite(X) && !Number.isFinite(Y)（X/Y 不同变量，Round 26 calcNormalize bug）
      /!\s*Number\.isFinite\s*\(\s*(\w+)\s*\)\s*&&\s*!\s*Number\.isFinite\s*\(\s*(\w+)\s*\)/g,
      // 模式 B：!Number.isFinite(X) ? X : ...（X 在真分支，Round 26 collectNormData bug）
      /!\s*Number\.isFinite\s*\(\s*(\w+)\s*\)\s*\?\s*\1\b/g,
      // 模式 C：!Number.isFinite(X) && X ...（同变量 &&，v54.248 反转 bug）
      /!\s*Number\.isFinite\s*\(\s*(\w+)\s*\)\s*&&\s*\1\s*[><=!]/g,
      // 模式 D：filter(v => !Number.isFinite(v))（Round 26 _extractChartData bug）
      /\.filter\s*\(\s*(?:function\s*\(\s*(\w+)\s*\)|(\w+)\s*=>)\s*\{\s*return\s*!\s*Number\.isFinite\s*\(\s*\w+\s*\)/g
    ];
    var hits = 0;
    var reported = 0;
    var check = function(label, src) {
      for (var pi = 0; pi < patterns.length; pi++) {
        var m, r = new RegExp(patterns[pi].source, 'g');
        while ((m = r.exec(src)) !== null) {
          // 模式 D 单独处理（捕获组在反向引用之外）
          if (pi === 3) {
            hits++;
            if (reported < 5) { try { console.warn('[checkNoInvertedGuards] ' + label + ' pattern D (filter): ' + m[0]); } catch (_) {} reported++; }
          } else {
            hits++;
            if (reported < 5) { try { console.warn('[checkNoInvertedGuards] ' + label + ' pattern ' + String.fromCharCode(65+pi) + ': ' + m[0]); } catch (_) {} reported++; }
          }
        }
      }
    };
    for (var i = 0; i < candidates.length; i++) {
      var fn = (typeof window !== 'undefined') ? window[candidates[i]] : null;
      if (typeof fn !== 'function') continue;
      try { check(candidates[i], fn.toString()); } catch (e) { /* dev only */ }
    }
    // 扫描 helpers-export*.js
    for (var hi = 0; hi < helpersSources.length; hi++) {
      try { check('helpers-export*.js', helpersSources[hi]); } catch (e) { /* dev only */ }
    }
    if (hits > 0) {
      try { console.warn('[checkNoInvertedGuards] Total ' + hits + ' suspicious pattern(s). Review with v54.254 inversion rule.'); } catch (_) {}
    } else {
      try { console.log('[checkNoInvertedGuards] No inverted guards detected in calc functions ✓'); } catch (_) {}
    }
  } catch (e) { /* dev only */ }
}

// v54.255 Fix #2 dev aid: 静态分析 app.js 源码，确认每个 addH(...) 调用都有 return-value 检查。
// v54.222 / v54.243 发现过 _saveWithSampleIdPrompt / savePlan 中 addH 失败却仍弹 "saved" 提示的 bug。
// 本检查辅助发现此类漏网之鱼。仅 localhost + 一次性扫描，生产零开销。
var _addHReturnCheckScanned = false;
function _checkAddHReturnChecked() {
  if (_addHReturnCheckScanned) return;
  if (!(typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost')) { _addHReturnCheckScanned = true; return; }
  _addHReturnCheckScanned = true;
  try {
    if (typeof XMLHttpRequest === 'undefined') return;
    // 同步 fetch app.js（同源页面部署）
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'app.js', false);
    try { xhr.send(null); } catch (e) { return; }
    if (xhr.status !== 200 || !xhr.responseText) return;
    var lines = xhr.responseText.split('\n');
    var issues = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // 跳过 addH 函数自身定义
      if (/function\s+addH\s*\(/.test(line)) continue;
      // 跳过注释行
      var trimmed = line.trim();
      if (trimmed.indexOf('//') === 0) continue;
      // 检测 addH(...) 调用
      if (!/\baddH\s*\(/.test(line)) continue;
      // 检查是否在同一行有 return-value 检查模式
      // 模式 A：`var ok = addH(...)` 或 `let r = addH(...)`
      // 模式 B：`if (addH(...))` 或 `if (!addH(...))`
      var hasReturnCheck = (
        /=\s*addH\s*\(/.test(line) ||
        /if\s*\(\s*!?\s*addH\s*\(/.test(line) ||
        /addH\s*\([^)]*\)\s*\?\s*/.test(line)
      );
      if (!hasReturnCheck) {
        issues.push((i + 1) + ': ' + trimmed);
      }
    }
    if (issues.length) {
      try {
        console.warn('[checkAddHReturnChecked] ' + issues.length + ' addH() call(s) without inline return-value check:');
        for (var j = 0; j < Math.min(issues.length, 8); j++) console.warn('  ' + issues[j]);
      } catch (_) {}
    } else {
      try { console.log('[checkAddHReturnChecked] All addH() calls check return value ✓'); } catch (_) {}
    }
  } catch (e) { /* dev only */ }
}

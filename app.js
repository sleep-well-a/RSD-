

function fmtNum(v, mode){
 if(!Number.isFinite(v) || v === null || v === undefined) return '—';
 if(mode === 'recovery'){
 
 return(Math.ceil(v * 1000) / 1000).toFixed(3);
}
 if(v === 0) return '0';
 const abs = Math.abs(v);
 if(abs >= 10000000 || abs < 0.000000001) return v.toExponential(5);
 return v.toPrecision(6);
}

let _clipRow = null;
function copyRowData(btn){
 
 if(!btn) return;
 const row = btn.closest('tr') || btn.closest('.sample-row');
 if(!row) return;
 const inputs = row.querySelectorAll('input');
 _clipRow =[];
 inputs.forEach(inp => _clipRow.push(inp.value));
 
 
 _i18nToast('toast_copiedFmt', 'success', 1500, _clipRow.length);
}
function pasteRowData(btn){
 
 if(!btn) return;
 
 
 
 if(!_clipRow){ _i18nToast('toast_pleaseCopyFirst', 'warn', 2500); return;}
 const row = btn.closest('tr') || btn.closest('.sample-row');
 if(!row) return;
 const inputs = row.querySelectorAll('input');
 let count = 0;
 for(let i = 0; i < Math.min(inputs.length, _clipRow.length); i++){
 inputs[i].value = _clipRow[i];
 count++;
}
 const evt = new Event('input',{bubbles:true});
 inputs[0] && inputs[0].dispatchEvent(evt);
 
 _i18nToast('toast_pastedFmt', 'success', 1500, count);
}
function toggleHideInputs(cardId){
 const card = document.getElementById(cardId);

 if(!card) return;
 const hidden = card.classList.toggle('hide-inputs');
 const toggle = card.querySelector('.hide-toggle');
 if(toggle) {
   toggle.textContent = i18n(hidden ? 'btnShowInput' : 'btnHideInput');
   toggle.setAttribute('aria-expanded', hidden ? 'false' : 'true');
 }
}



// v54.242 fix: hoist calcExpr 的 18 个 regex literals 到模块级（V8 实际能内联字面量 regex 但 .replace 链上的每次调用仍要构造/匹配）
// 模块级常量 — 在 calcExpr 前定义
const CALC_EXPR_NUMERIC = /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/;
const CALC_EXPR_BLOCKLIST = /(\.\s*constructor|\[\s*['"`]?\s*constructor\s*['"`]?\s*\]|__proto__|prototype|\beval\b|\bFunction\s*\(|import\s|require\s|window\.|document\.|globalThis|\bthis\b)/i;
const CALC_EXPR_CHARSET = /^[\d\s+\-*/%^().,a-zA-Z]+$/;
const CALC_EXPR_NEED_OP = /[+\-*/%^()]|Math\.|sin|cos|tan|log|ln|sqrt|abs|floor|ceil|round|PI|E/;
const CALC_EXPR_DEG_SIND = /\bsind\(/g;
const CALC_EXPR_DEG_COSD = /\bcosd\(/g;
const CALC_EXPR_DEG_TAND = /\btand\(/g;
const CALC_EXPR_POW = /\^/g;
const CALC_EXPR_SIN = /(?<![\w$.])sin\(/g;
const CALC_EXPR_COS = /(?<![\w$.])cos\(/g;
const CALC_EXPR_TAN = /(?<![\w$.])tan\(/g;
const CALC_EXPR_LOG = /(?<![\w$.])log\(/g;
const CALC_EXPR_LN = /(?<![\w$.])ln\(/g;
const CALC_EXPR_SQRT = /(?<![\w$.])sqrt\(/g;
const CALC_EXPR_ABS = /(?<![\w$.])abs\(/g;
const CALC_EXPR_FLOOR = /(?<![\w$.])floor\(/g;
const CALC_EXPR_CEIL = /(?<![\w$.])ceil\(/g;
const CALC_EXPR_ROUND = /(?<![\w$.])round\(/g;
const CALC_EXPR_PI = /(?<![\w$.])PI\b/g;
const CALC_EXPR_E = /(?<![\w$.])\bE\b(?![\w$])/g;

function calcExpr(expr){
 if(!expr || typeof expr !== 'string') return NaN;
 const trimmed = expr.trim();
 if(!trimmed) return NaN;
 // v54.248 fix: 防御 ReDoS/长输入内存膨胀 — 200 字符已经远超任何合理公式
 if(trimmed.length > 200) return NaN;

 if(CALC_EXPR_NUMERIC.test(trimmed)) return parseFloat(trimmed);
 // v54.254 cleanup: 移除 v54.242 hoist 时遗留的 7 行连续空行
 if(CALC_EXPR_BLOCKLIST.test(trimmed)) return NaN;
  // 白名单字符：数字、字母、空白、运算符、点、逗号、括号、单引号/双引号/反引号禁止
  if (!CALC_EXPR_CHARSET.test(trimmed)) return NaN;
  // 必须包含至少一个运算符或函数调用（防止纯标识符 eval）
  if (!CALC_EXPR_NEED_OP.test(trimmed)) return NaN;
  try {
    // 预处理度数转换: sind(x) → Math.sin(x*PI/180), 同理 cosd/tand
    const degSafe = trimmed
      .replace(CALC_EXPR_DEG_SIND, 'Math.sin(Math.PI/180*')
      .replace(CALC_EXPR_DEG_COSD, 'Math.cos(Math.PI/180*')
      .replace(CALC_EXPR_DEG_TAND, 'Math.tan(Math.PI/180*');
    const safe = degSafe
      .replace(CALC_EXPR_POW, '**')
      // 缩写函数→Math.x：负向先行（不能跟在 . 字母 数字 后面，避免双重前缀）
      .replace(CALC_EXPR_SIN, 'Math.sin(')
      .replace(CALC_EXPR_COS, 'Math.cos(')
      .replace(CALC_EXPR_TAN, 'Math.tan(')
      .replace(CALC_EXPR_LOG, 'Math.log10(')
      .replace(CALC_EXPR_LN, 'Math.log(')
      .replace(CALC_EXPR_SQRT, 'Math.sqrt(')
      .replace(CALC_EXPR_ABS, 'Math.abs(')
      .replace(CALC_EXPR_FLOOR, 'Math.floor(')
      .replace(CALC_EXPR_CEIL, 'Math.ceil(')
      .replace(CALC_EXPR_ROUND, 'Math.round(')
      .replace(CALC_EXPR_PI, 'Math.PI')
      .replace(CALC_EXPR_E, 'Math.E');
    // 用 Function 但配合 frozen 白名单：把可疑方法替换成安全包装
    // 终极防御：先求值得到结果，再检测是否只有 number 返回
    const result = Function('"use strict"; return (' + safe + ')')();
    if (typeof result === 'number' && Number.isFinite(result)) return result;
  } catch (e) {}
  return NaN;
}

function processInput(el) {
  if (!el || !el.value) return;
  const raw = el.value.trim();
  // v54.240 fix: 防御 parentNode 为 null（如 detached element）
  if (!el.parentNode) return;
  const hint = el.parentNode.querySelector('.input-hint');
  const errHint = el.parentNode.querySelector('.input-error-hint');
  el.classList.remove('input-formula', 'input-error');
  if (hint) hint.style.display = 'none';
  if (errHint) errHint.style.display = 'none';

  // v54.244 fix (Round 8 #18): 之前 regex 不匹配 `sin`/`cos`/`tan` 等单独输入（无括号）
  // → 用户输入公式但没收到任何反馈。扩展 regex 检测独立函数名触发 calcExpr
  if (/[+\-*/%^()]|Math\.|\b(?:sin|cos|tan|log|ln|sqrt|abs|floor|ceil|round|PI|E|sind|cosd|tand)\b/.test(raw)) {
    const result = calcExpr(raw);
    if (!Number.isFinite(result)) {
      el.classList.add('input-error');
      if (errHint) { errHint.textContent = i18n('formulaError'); errHint.style.display = 'inline'; }
    } else {
      el.classList.add('input-formula');
      // v54.244 fix: result===0（如 `5-5`）也显示 `= 0`，给用户正向反馈（fmtNum(0) 返回 '0'）
      if (hint) { hint.textContent = '= ' + fmtNum(result); hint.style.display = 'inline'; }
    }
  }
}

function autoHideCheck(cardId) {
  // v54.65 防御：card 缺失时 TypeError 被吞
  const card = document.getElementById(cardId);
  if (!card) return;
  const cb = card.querySelector('.auto-hide-cb');
  if (cb && cb.checked && !card.classList.contains('hide-inputs')) {
    toggleHideInputs(cardId);
  }
}

function batchPaste(containerId, calcFn, mode) {
  const text = prompt(i18n('excelPasteHint'));
  if (!text) return;
  // v54.253 fix (Round final #1): 防御 input 过大（>10000 字符）— 避免误粘贴巨大文本导致浏览器卡顿
  // 10000 字符 ≈ 200 行 × 50 列；正常批量粘贴场景远低于此
  if (text.length > 10000) {
    if (typeof toast === 'function') {
      _i18nToast('toastInputTooLarge', 'warn', 3000);
    }
    return;
  }
  const lines = text.trim().split(/\n+/).filter(l => l.trim());
  if (lines.length === 0) return;
  const data = lines.map(line => line.split(/[\t,，\s]+/).filter(s => s !== ''));
  // v54.253 fix (Round final #1): 防御单行列数过多（>10 列）— 避免误粘贴 50+ 列的 CSV/Excel 区域导致 DOM 爆炸
  // batchPaste 所有分支（norm-shared/norm-independent/ext/int）最多使用 6 列；超 10 列视为异常输入
  if (data.some(row => row.length > 10)) {
    if (typeof toast === 'function') {
      _i18nToast('toastTooManyCols', 'warn', 3000);
    }
    return;
  }
  const maxCols = Math.max(...data.map(r => r.length));
  const container = document.getElementById(containerId);
  const existingRows = container.querySelectorAll('tr');

  // 清空并重建
  // v54.235 fix (Round 4 MEDIUM): 之前每个 row 都 appendChild 一次，n=100 = 100 次重排 + 100 次重绘。
  // 改为 DocumentFragment 批量插入：内存拼好后 1 次 appendChild，n=100 时性能提升 ~90%。
  if (mode === 'norm-shared') {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    data.forEach((row, i) => {
      const tr = document.createElement('tr'); tr.className = 'norm-spl-shared';
      tr.innerHTML = '<td>'+(i+1)+'</td><td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" value="'+_esc(row[0]||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td><td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" value="'+_esc(row[1]||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td><td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" value="'+_esc(row[2]||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td class="result-col">—</td><td><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
      frag.appendChild(tr);
    });
    container.appendChild(frag);
  } else if (mode === 'norm-independent') {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    data.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>'+(i+1)+'</td>'+
        '<td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" value="'+_esc(row[0]||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td>'+
        '<td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" value="'+_esc(row[1]||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td>'+
        '<td><input type="text" inputmode="decimal" class="norm-spl-moisture" placeholder="0" value="'+_esc(row[2]||'0')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></td>'+
        '<td><input type="text" inputmode="decimal" class="norm-spl-residue" placeholder="0" value="'+_esc(row[3]||'0')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblResidue')) + '" data-i18n-aria-label="lblResidue"></td>'+
        '<td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" value="'+_esc(row[4]||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td>'+
        '<td class="result-col">—</td>'+
        '<td><button class="btn btn-outline btn-xs" onclick="copyNormPrevRow(this)" title="' + _esc(i18n('titleCopyUpRow')) + '" data-i18n-title="titleCopyUpRow">↑上行</button><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
      frag.appendChild(tr);
    });
    container.appendChild(frag);
  } else if (mode === 'ext') {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    data.forEach((row, i) => {
      const div = document.createElement('div'); div.className = 'sample-row';
      div.innerHTML = '' + i18n('sampleNum') + (i+1) + ' <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-sm" onclick="removeExtSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button></div>'+
        '<div class="half">'+
          '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="ext-spl-area" placeholder="0" value="'+_esc(row[0]||'')+'" oninput="calcExternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
          '<div><label data-i18n="lbl-sample-weight">称样量 (mg)</label><input type="text" inputmode="decimal" class="ext-spl-weight" placeholder="0" value="'+_esc(row[1]||'')+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-sample-weight')) + '" data-i18n-aria-label="lbl-sample-weight"></div>'+
          '<div><label data-i18n="lbl-dilution-vol">稀释体积 (mL)</label><input type="text" inputmode="decimal" class="ext-spl-dilution" placeholder="0" value="'+_esc(row[2]||'')+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-dilution-vol')) + '" data-i18n-aria-label="lbl-dilution-vol"></div>'+
          '<div><label data-i18n="lbl-theory-content-pct">理论含量 (%)</label><input type="text" inputmode="decimal" class="ext-spl-theory" placeholder="100" value="'+_esc(row[3]||'100')+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-theory-content-pct')) + '" data-i18n-aria-label="lbl-theory-content-pct"></div>'+
        '</div>'+
        '<div class="section-label" data-i18n="card-title-drying-param">干燥品折算参数</div>'+
        '<div class="half">'+
          '<div><label data-i18n="lblMoisturePct">水分 (%)</label><input type="text" inputmode="decimal" class="ext-spl-moisture" placeholder="0" value="'+_esc(row[4]||'0')+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></div>'+
          '<div><label data-i18n="lbl-residue-pct">炽灼残渣 (%)</label><input type="text" inputmode="decimal" class="ext-spl-residue" placeholder="0" value="'+_esc(row[5]||'0')+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-residue-pct')) + '" data-i18n-aria-label="lbl-residue-pct"></div>'+
        '</div>';
      frag.appendChild(div);
    });
    container.appendChild(frag);
  } else if (mode === 'drying') {
      dryingData.length = 0; dryingData.push({ parallels: data.map(r => ({w0:r[0]||'',w1:r[1]||'',w2:r[2]||''})) });
      renderDrying();
      if (typeof calcFn === 'function') calcFn();
      return;
    } else if (mode === 'residue') {
      residueData.length = 0; residueData.push({ parallels: data.map(r => ({w0:r[0]||'',w1:r[1]||'',w2:r[2]||''})) });
      renderResidue();
      if (typeof calcFn === 'function') calcFn();
      return;
    } else if (mode === 'titer') {
      titerData.length = 0; titerData.push({ parallels: data.map(r => ({w:r[0]||'',v0:r[1]||'',v:r[2]||''})) });
      renderTiter();
      if (typeof calcFn === 'function') calcFn();
      return;
    } else if (mode === 'int') {
    container.innerHTML = '';
    data.forEach((row, i) => {
      const div = document.createElement('div'); div.className = 'sample-row';
      div.innerHTML = '' + i18n('sampleNum') + (i+1) + ' <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-sm" onclick="removeIntSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button></div>'+
        '<div class="half">'+
          '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="int-spl-area" placeholder="0" value="'+_esc(row[0]||'')+'" oninput="calcInternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
          '<div><label data-i18n="lbl-is-peak-area">内标峰面积</label><input type="text" inputmode="decimal" class="int-spl-is-area" placeholder="0" value="'+_esc(row[1]||'')+'" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-is-peak-area')) + '" data-i18n-aria-label="lbl-is-peak-area"></div>'+
        '</div>'+
        '<div class="half">'+
          '<div><label data-i18n="lbl-theory-conc-mg-ml">理论浓度 (mg/mL)</label><input type="text" inputmode="decimal" class="int-spl-theory" placeholder="0" value="'+_esc(row[2]||'')+'" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-theory-conc-mg-ml')) + '" data-i18n-aria-label="lbl-theory-conc-mg-ml"></div>'+
        '</div>';
      container.appendChild(div);
    });
  }
  if (typeof calcFn === 'function') calcFn();
}

// ==================== TAB ====================
// v54.230 a11y: 给所有 tab/subtab 容器添加 ARIA 角色和属性，让屏幕阅读器能感知 tab 切换
// 必须在所有 tab/subtab HTML 渲染完之后调用，且在用户首次交互前
function _initTabAria(){
 try {
 // 工具：找 onclick 属性里调 switchTab('xxx') 的最近 .tab/.subtab
 function findTabWithOnclick(fnName, arg) {
 const sel = '.' + (fnName === 'switchTab' ? 'tab' : 'subtab');
 const tabs = document.querySelectorAll(sel);
 // v54.246 perf: 在外层 precompute regex（避免每次 iteration 都 new RegExp）
 const re = new RegExp(fnName + "\\s*\\(\\s*['\"]" + arg + "['\"]\\s*\\)");
 for (let i = 0; i < tabs.length; i++) {
 const oc = tabs[i].getAttribute('onclick') || '';
 if (re.test(oc)) return tabs[i];
 }
 return null;
 }
 // 1. 顶层 .tabs 容器
 document.querySelectorAll('.tabs').forEach((tl, tlIdx) => {
 tl.setAttribute('role', 'tablist');
 const tabs = tl.querySelectorAll('.tab');
 tabs.forEach((t, i) => {
 const isActive = t.classList.contains('active');
 t.setAttribute('role', 'tab');
 const tId = 'tl' + tlIdx + '-tab-' + i;
 t.id = tId;
 t.setAttribute('aria-selected', isActive ? 'true' : 'false');
 t.setAttribute('tabindex', isActive ? '0' : '-1');
 });
 });
 // 2. .subtabs 容器
 document.querySelectorAll('.subtabs').forEach((st, stIdx) => {
 st.setAttribute('role', 'tablist');
 const subs = st.querySelectorAll('.subtab');
 subs.forEach((t, i) => {
 const isActive = t.classList.contains('active');
 t.setAttribute('role', 'tab');
 const tId = 'st' + stIdx + '-tab-' + i;
 t.id = tId;
 t.setAttribute('aria-selected', isActive ? 'true' : 'false');
 t.setAttribute('tabindex', isActive ? '0' : '-1');
 });
 });
 // 3. 给每个 panel（.page / .rec-method / .sp-method / .mw-type）添加 role=tabpanel + aria-labelledby
 const panels = document.querySelectorAll('.page, .rec-method, .sp-method, .mw-type');
 panels.forEach(p => {
 if (p.getAttribute('role') === 'tabpanel') return;
 p.setAttribute('role', 'tabpanel');
 const id = p.id || '';
 let matched = null;
 if (id.startsWith('page-')) {
 matched = findTabWithOnclick('switchTab', id.replace('page-', ''));
 } else if (id.startsWith('rec-')) {
 matched = findTabWithOnclick('switchRecovery', id.replace('rec-', ''));
 } else if (id.startsWith('sp-')) {
 matched = findTabWithOnclick('switchSpecial', id.replace('sp-', ''));
 } else if (id.startsWith('mw-')) {
 matched = findTabWithOnclick('switchMw', id.replace('mw-', ''));
 }
 if (matched && matched.id) p.setAttribute('aria-labelledby', matched.id);
 });
 // 4. 给每个 .tab / .subtab 设置 aria-controls（指向它对应的 panel）
 document.querySelectorAll('.tab[role="tab"]').forEach(t => {
 const oc = t.getAttribute('onclick') || '';
 const m = oc.match(/switchTab\s*\(\s*['"]([^'"]+)['"]\s*\)/);
 if (m) t.setAttribute('aria-controls', 'page-' + m[1]);
 });
 document.querySelectorAll('.subtab[role="tab"]').forEach(t => {
 const oc = t.getAttribute('onclick') || '';
 let m = oc.match(/switchRecovery\s*\(\s*['"]([^'"]+)['"]\s*\)/);
 if (m) { t.setAttribute('aria-controls', 'rec-' + m[1]); return; }
 m = oc.match(/switchSpecial\s*\(\s*['"]([^'"]+)['"]\s*\)/);
 if (m) { t.setAttribute('aria-controls', 'sp-' + m[1]); return; }
 m = oc.match(/switchMw\s*\(\s*['"]([^'"]+)['"]\s*\)/);
 if (m) { t.setAttribute('aria-controls', 'mw-' + m[1]); return; }
 });
 // v54.243 a11y (LOW P1): WAI-ARIA AP Tab Pattern - Arrow/Home/End/Enter/Space 键盘导航
 // 单一 keydown listener 绑在 .tabs / .subtabs 容器上，处理 4 类 tablist（顶层 tab + 3 类 subtab）
 function _wireTablistArrowKeys(container, fnName) {
 if (!container || container._arrowKeysBound) return;
 container._arrowKeysBound = true;
 container.addEventListener('keydown', (e) => {
 // 仅当 focus 在 tab 本身上（不是子 input/button 之类）
 const tab = e.target.closest('[role="tab"]');
 if (!tab || !container.contains(tab)) return;
 const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
 const idx = tabs.indexOf(tab);
 if (idx === -1) return;
 let nextIdx = -1;
 if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
 nextIdx = idx === 0 ? tabs.length - 1 : idx - 1;
 } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
 nextIdx = idx === tabs.length - 1 ? 0 : idx + 1;
 } else if (e.key === 'Home') {
 nextIdx = 0;
 } else if (e.key === 'End') {
 nextIdx = tabs.length - 1;
 } else if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 const oc = tab.getAttribute('onclick') || '';
 const m = oc.match(/['"]([^'"]+)['"]/);
 if (m && typeof window[fnName] === 'function') window[fnName](m[1]);
 return;
 } else {
 return;
 }
 if (nextIdx >= 0 && tabs[nextIdx]) {
 e.preventDefault();
 tabs[nextIdx].focus();
 const oc = tabs[nextIdx].getAttribute('onclick') || '';
 const m = oc.match(/['"]([^'"]+)['"]/);
 if (m && typeof window[fnName] === 'function') window[fnName](m[1]);
 }
 });
 }
 document.querySelectorAll('.tabs').forEach(c => _wireTablistArrowKeys(c, 'switchTab'));
 document.querySelectorAll('.subtabs').forEach(c => {
 const firstSubtab = c.querySelector('.subtab');
 const oc = firstSubtab ? (firstSubtab.getAttribute('onclick') || '') : '';
 let fn = 'switchRecovery';
 if (/switchSpecial/.test(oc)) fn = 'switchSpecial';
 else if (/switchMw/.test(oc)) fn = 'switchMw';
 _wireTablistArrowKeys(c, fn);
 });
 } catch(e) { console.error('[init] _initTabAria', e); }
}

function switchTab(tab) {
  // v54.49 修复：原 ternary 缺 history + mobile=4（实际 i=5）→ tab 高亮错位
  //   实证：switchTab('history') → 流动相 tab 高亮（但 page 是 history）
  //         switchTab('mobile') → 历史 tab 高亮（但 page 是 mobile）
  //   HTML tab 顺序：stats(0)/recovery(1)/special(2)/calc(3)/history(4)/mobile(5)/settings(6)
  //   修复：补 history=4 + 改 mobile=5 + fallback 6
  const tabIdx = tab==='stats'?0 : tab==='recovery'?1 : tab==='special'?2 : tab==='calc'?3 : tab==='history'?4 : tab==='mobile'?5 : 6;
  document.querySelectorAll('.tab').forEach((t,i) => {
    const isActive = i === tabIdx;
    t.classList.toggle('active', isActive);
    // v54.230 a11y: 同步 aria-selected + tabindex 让屏幕阅读器能感知当前 tab
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    t.setAttribute('tabindex', isActive ? '0' : '-1');
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (tab === 'content') { switchTab('special'); setTimeout(()=>switchSpecial('content'),0); return; }
  var page = document.getElementById('page-'+tab);
  if (page) page.classList.add('active');
  // v54.244 fix: tab 切换后重新初始化 card-title a11y（如果当前页有 innerHTML 重建，原 role/tabindex/aria-expanded 丢失）
  if (typeof _initCardTitleA11y === 'function') {
    setTimeout(function(){ try { _initCardTitleA11y(); } catch(e) { console.error('[cardTitleA11y]', e); } }, 0);
  }
  // tab 切换 → 清空 _pulsedCards + 重跑 _updateScrollHints（让新页面的可滚动表格重新脉冲提示）
  if (typeof _pulsedCards !== 'undefined' && typeof _updateScrollHints === 'function') {
    setTimeout(() => { _pulsedCards.clear(); _updateScrollHints(); }, 60);
  }
  // 推 history 状态（启用浏览器后退按钮 + 移动端 swipe-back）
  if (typeof history !== 'undefined' && history.pushState && !_suppressHistoryPush) {
    try { history.pushState({ rsdTab: tab, ts: Date.now() }, '', '#' + tab); } catch(e) {}
  }
  // v54.182：tab 切换渲染保护 - 即使 renderHistory() 报错也不影响 tab 显示
  if (tab==='history') {
    try { renderHistory(); } catch(e) { console.error('[renderHistory]', e); }
    // v54.246 fix: history 页格新建完 DOM 后需要重运 _updateScrollHints() （表格 hint class 新 DOM 上才会被动态加上）
    if (typeof _updateScrollHints === 'function') { try { _updateScrollHints(); } catch(_e) { console.error('[scrollHints after renderHistory]', _e); } }
    // v54.244 fix: renderHistory 走 container.innerHTML 重建 card-title，再跑一次 a11y 初始化
    if (typeof _initCardTitleA11y === 'function') {
      setTimeout(function(){ try { _initCardTitleA11y(); } catch(e) { console.error('[cardTitleA11y after renderHistory]', e); } }, 0);
    }
  }
}
// 当前 special sub-tab（用于 history 状态回放）
var _currentSpecial = null;
// 静默 push 标志（popstate 触发的 switchTab 不应再次 push，否则会无限后退）
var _suppressHistoryPush = false;
// 浏览器后退/前进按钮 + 移动端 swipe-back 处理
window.addEventListener('popstate', function(e) {
  if (e.state && e.state.rsdTab) {
    _suppressHistoryPush = true;
    switchTab(e.state.rsdTab);
    // 恢复 special sub-tab
    if (e.state.rsdTab === 'special' && e.state.rsdSpecial && typeof switchSpecial === 'function') {
      try { switchSpecial(e.state.rsdSpecial); } catch(err) { console.error('[popstate special]', err); }
    }
    _suppressHistoryPush = false;
    if (typeof toast === 'function') _i18nToast('toast_backFmt', 'info', 1500, e.state.rsdSpecial ? e.state.rsdTab + '/' + e.state.rsdSpecial : e.state.rsdTab);
  }
});

// ==================== 历史缓存引擎 ====================
const MAX = 500;
const HK = 'rsd-calc-history';
// v54.234 fix (Round 4 A MEDIUM): getH() 每次 JSON.parse 全文；一次 addH+updCount+renderHistory 调用 = 3 次 parse（500 条 ~6KB × 3 = 18KB JSON 解析）
// 改为内存缓存 + setH/clearH/_setupStorageSync 失效
var _historyCache = null;
// v54.243 perf: 缓存 renderHistory 内的 _dateCounts（按 history 数组引用键化），避免每次 render 全表 500 条 forEach
var _dateCountsCache = null;
// v54.283 i18n: 历史 e.type → i18n key 映射表（显示边界用，schema 不变）
var _HIST_TYPE_I18N_KEY = {
  '统计计算': 'tabStats',
  '含量计算': 'cvHistTypeContent',
  '外标含量': 'tabRecovery',
  '回收率-面积归一化法': 'cvLegendRecAreaNorm',
  '回收率-外标法': 'cvLegendRecExt',
  '回收率-内标法': 'cvLegendRecInt',
  '回收率-简易': 'cvLegendRecSimple',
  '干燥失重': 'subtabDrying',
  '炽灼残渣': 'subtabResidue',
  '滴定度': 'subtabTiter',
  '含量均匀度': 'subtabUniformity',
  '溶出度': 'subtabDissolution',
  '标准曲线': 'subtabCurve',
  '加样回收率': 'subtabSpike',
  '流动相配制': 'cardTitleMobilePhase'
};
function _typeI18n(t) { return _HIST_TYPE_I18N_KEY[t] || t; }
// v54.249 perf: 缓存 _extractChartData。v54.283 改进：sig 用 history 数组身份引用（每次 setH/addH/deleteSingle 重新赋值 _historyCache，引用变 → cache miss 必重算；之前用 length + first.time+type 在 mid-array 编辑时漏失效）
var _extractChartDataCache = { sig: null, data: null };
// v54.274 fix: _trendDrawTimer 缺声明导致 implicit global（line 3706-3707 用到）
var _trendDrawTimer = null;
function _loadHistoryFromStorage() {
  try {
    const h = JSON.parse(localStorage.getItem(HK));
    _historyCache = Array.isArray(h) ? h : [];
  } catch(e) { _historyCache = []; }
  _historyCacheClean = false; /* v54.272 perf: mark cache as needing corruption scan */
  return _historyCache;
}
/**
 * 读取历史记录（内存缓存优先；缓存为 null 时从 localStorage 懒加载）。
 * v54.272 perf: corrupted-entry filter only runs ONCE per cache load (was every getH() call → 500-entry scan × N calls)
 * @return {Array<Object>} 历史条目数组（localStorage 损坏/缺失时返回 []）
 */
var _historyCacheClean = true; /* assumed clean until _loadHistoryFromStorage or setH invalidates */
function getH() {
  if (_historyCache === null) return _loadHistoryFromStorage();
  if (!_historyCacheClean) {
    /* v54.255 defensive: filter out corrupted entries (null/non-object/array elements) once. */
    _historyCache = _historyCache.filter(function(e){ return e && typeof e === 'object' && !Array.isArray(e); });
    _historyCacheClean = true;
  }
  return _historyCache;
}
/**
 * 持久化整份历史到 localStorage，并同步内存缓存（深拷贝切断 caller 引用）。
 * @param {Array<Object>} d 完整历史数组
 * @return {boolean} true=写入成功；false=localStorage 失败（已 toast 提示）
 */
function setH(d) {
  try {
    // v54.249 fix: 深拷贝切断引用，防止 caller 后续 mutation 污染 _historyCache
    // （v54.246 在 addH 末尾做了额外 deep-clone 兜底；此处根治 setH 自身的引用共享）
    var snapshot = JSON.parse(JSON.stringify(d));
    localStorage.setItem(HK, JSON.stringify(snapshot));
    _historyCache = snapshot;  // 同步内存缓存，避免下次 getH 再 parse
    return true;
  } catch(e) {
    if (typeof _i18nToast === 'function') _i18nToast('toast_historySaveFail', 'error', 5000);
    console.error('[setH] save failed:', e);
    return false;
  }
}
function updCount() { const el = document.getElementById('history-count'); if (el) el.textContent = getH().length; }
/**
 * 在历史头部插入一条记录（超出 MAX 时截断），并失效图表/日期分组缓存。
 * 条目缺少 _meta 时自动补上当前报告元数据（sampleId/batch 等）。
 * @param {Object} entry 历史条目（含 type/time 及业务字段）
 * @return {boolean} true=保存成功；false=setH 写入失败（已回滚该条）
 */
function addH(entry) { try { if (entry && !entry._meta) { var m = getReportMeta(); try { var ov1 = document.getElementById('current-sample-id'); if (ov1 && ov1.value) m.sampleId = ov1.value; var ov2 = document.getElementById('current-batch'); if (ov2 && ov2.value) m.batch = ov2.value; } catch(e2){} entry._meta = m; } } catch(e){} try { if (entry && !entry._meta) entry._meta = {}; if (entry._meta) entry._meta.weightUnit = _getWeightUnit(); } catch(_){} const h = getH(); h.unshift(entry); if (h.length > MAX) h.length = MAX; if (!setH(h)) { h.shift(); return false; }
 // v54.281 perf (HIGH): setH() 内部已 deep-clone 到 snapshot 并赋给 _historyCache（line 501+503）；原 v54.246 额外 deep-clone 冗余（500 项历史每次 save 多 5MB JSON parse+stringify）
 _extractChartDataCache = { sig: '', data: null };  // v54.249: 失效 chart data 缓存
 _historyPage = 1; updCount(); _dateCountsCache = null; return true; }

async function deleteSingle(idx) {
  if (!await _confirmDialog(i18n('confirmDeleteRecord'), { danger: true })) return;
  // v54.28 防御：idx 必须是 [0, h.length) 的整数，否则不删（避免 splice 语义怪异）
  const h = getH();
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= h.length) return;
  const removed = h.splice(idx, 1)[0]; if (!setH(h)) { h.splice(idx, 0, removed); return; }
  _extractChartDataCache = { sig: '', data: null };  // v54.249: 失效 chart data 缓存
  _dateCountsCache = null;
  updCount(); renderHistory();
}

/**
 * 清空全部历史（先弹确认对话框；用户取消则不做任何改动）。
 * @return {Promise<void>} 无返回值；完成后重渲染历史列表并 toast 提示
 */
async function clearHistory() {
  if (!await _confirmDialog(i18n('confirmDeleteAllHistory'), { danger: true })) return;
  const backup = getH();
  if (!setH([])) return;
  _extractChartDataCache = { sig: '', data: null };  // v54.249: 失效 chart data 缓存
  _dateCountsCache = null;
  updCount(); renderHistory();
  _i18nToast('toast_historyClearedFmt', 'success', 3000, backup.length);
}

/* [已迁移] 原版 loadHistory 已由覆写版替代 */

/* [已迁移] 原版 exportExcel 已由覆写版替代 */

/* [已迁移] 原版 renderHistory 已由覆写版替代 */

// ==================== 数据趋势图 (Chart.js) ====================
var _chartType = 'line'; // 'line' or 'bar'
var _chartInstance = null;
var _chartFilterSet = null; // v54.90 多选 Set：null/空 = 全部；非空 = 显示 Set 内 type（union）

// 数据类型颜色映射
var _chartTypeColors = {
  '统计计算':      { bg: 'rgba(37,99,235,0.6)',   border: '#2563eb' },
  '含量计算':      { bg: 'rgba(22,163,74,0.6)',   border: '#16a34a' },
  '外标含量':      { bg: 'rgba(22,163,74,0.6)',   border: '#16a34a' },
  '回收率':        { bg: 'rgba(234,88,12,0.6)',   border: '#ea580c' },
  '干燥失重':      { bg: 'rgba(147,51,234,0.6)',  border: '#9333ea' },
  '炽灼残渣':      { bg: 'rgba(225,29,72,0.6)',   border: '#e11d48' },
  '滴定度':        { bg: 'rgba(20,184,166,0.6)',  border: '#14b8a6' },
  '含量均匀度':    { bg: 'rgba(234,179,8,0.6)',   border: '#eab308' },
  '溶出度':        { bg: 'rgba(99,102,241,0.6)',  border: '#6366f1' },
  '标准曲线':      { bg: 'rgba(107,114,128,0.6)', border: '#6b7280' },
  '回收率-面积归一化法': { bg: 'rgba(234,88,12,0.6)',  border: '#ea580c' },
  '回收率-简易':        { bg: 'rgba(234,88,12,0.45)', border: '#ea580c' },
  '回收率-外标法':      { bg: 'rgba(234,88,12,0.55)', border: '#ea580c' },
  '回收率-内标法':      { bg: 'rgba(234,88,12,0.7)',  border: '#ea580c' }
};

// 获取类型分组键（用于颜色归类）
function _chartGroupKey(type) {
  if (!type) return i18n('otherGroup');
  if (type === '含量计算' || type === '外标含量') return '含量计算';
  if (type.startsWith('回收率')) return '回收率';
  return type;
}

// v54.243 chart legend i18n: storage key → i18n key (留 storage 不变，渲染时翻译)
var _CHART_TYPE_I18N_MAP = {
  '统计计算':              'cvLegendStats',
  '含量计算':              'cvLegendContent',
  '外标含量':              'cvLegendExtStd',
  '回收率':                'cvLegendRecovery',
  '干燥失重':              'cvLegendDrying',
  '炽灼残渣':              'cvLegendResidue',
  '滴定度':                'cvLegendTiter',
  '含量均匀度':            'cvLegendUniformity',
  '溶出度':                'cvLegendDissolution',
  '标准曲线':              'cvLegendCurve',
  '回收率-面积归一化法':   'cvLegendRecAreaNorm',
  '回收率-简易':           'cvLegendRecSimple',
  '回收率-外标法':         'cvLegendRecExt',
  '回收率-内标法':         'cvLegendRecInt'
};
function _chartTypeI18nKey(type) { return _CHART_TYPE_I18N_MAP[type] || ''; }
function _chartTypeLabel(type) {
  var key = _CHART_TYPE_I18N_MAP[type];
  return key ? i18n(key) : type;
}

// 从历史记录中提取可用于图表的数据
// v54.249 perf: 按 history.length + history[0].(time|type) 签名缓存，避免 drawTrendChart 每次 500 条全表 forEach
// v54.283 升级：sig 用 history 数组身份引用（每次 setH/addH/deleteSingle 重新赋值 _historyCache，引用变 → cache miss 必重算；之前用 length + first.time+type 在 mid-array 编辑时漏失效）
function _extractChartData(history) {
  if (!Array.isArray(history)) history = [];
  if (_extractChartDataCache.sig === history && _extractChartDataCache.data) {
    return _extractChartDataCache.data;
  }
  var groups = {}; // groupKey -> [{time, value, label, rawType}]
  history.forEach(function(e) {
    // v54.27 防御：localStorage 损坏可能含 null/string entry
    if (!e || typeof e !== 'object' || typeof e.type !== 'string') return;
    var gk = _chartGroupKey(e.type);
    if (!groups[gk]) groups[gk] = [];

    if (e.type === '统计计算' && e.data) {
      var nums = e.data.split(/[,\s]+/).map(function(s){return parseFloat(s);}).filter(function(v){return Number.isFinite(v);});
      if (nums.length > 0) {
        var mean = nums.reduce(function(a,b){return a+b;},0)/nums.length;
        groups[gk].push({time: e.time, value: mean, label: i18n('labelMeanShort') + mean.toFixed(4), rawType: e.type});
      }
    } else if (e.type === '含量计算' || e.type === '外标含量') {
      /* v54.274 fix (correctness #5): entry 存 samples:[{weight,dilution,moisture,residue,parallels:[{area}]}]，
         samples 上没有 result 字段 → 旧代码 e.samples[0].result 永远 undefined → 趋势图从不画含量。
         用 entry 上的标准参数按 calcExternal 同公式重算 content（标准/样品 weight/dilution 同显示单位 → 比值约掉）。 */
      var _stdA = parseFloat(e.stdArea), _stdW = parseFloat(e.stdWeight), _stdP = parseFloat(e.stdPurity), _stdD = parseFloat(e.stdDilution);
      var _stdM = parseFloat(e.stdMoisture) || 0, _stdR = parseFloat(e.stdResidue) || 0;
      var _dryStdF = (100 - _stdM - _stdR) / 100;
      if (Number.isFinite(_stdA) && Number.isFinite(_stdW) && Number.isFinite(_stdP) && Number.isFinite(_stdD) &&
          _stdA > 0 && _stdW > 0 && _stdP > 0 && _stdD > 0 && _dryStdF > 0) {
        var _cf = _stdA / (_stdW * _stdP / 100 * _dryStdF / _stdD);
        var _contents = [];
        (e.samples || []).forEach(function(s){
          var _w = parseFloat(s.weight), _d = parseFloat(s.dilution);
          var _m = parseFloat(s.moisture) || 0, _r = parseFloat(s.residue) || 0;
          var _drySplF = (100 - _m - _r) / 100;
          if (!Number.isFinite(_w) || !Number.isFinite(_d) || _w <= 0 || _d <= 0 || _drySplF <= 0) return;
          (s.parallels || []).forEach(function(p){
            var _a = parseFloat(p.area);
            if (Number.isFinite(_a) && _a > 0) _contents.push((_a / _cf) / (_w * _drySplF / _d) * 100);
          });
        });
        if (_contents.length > 0) {
          var _avgContent = _contents.reduce(function(a,b){return a+b;},0) / _contents.length;
          groups[gk].push({time: e.time, value: _avgContent, label: i18n('labelAvgContent') + _avgContent.toFixed(4) + '%', rawType: e.type});
        }
      }
    } else if (e.type === '回收率-面积归一化法') {
      if (e.cMean) {
        groups[gk].push({time: e.time, value: parseFloat(e.cMean), label: i18n('labelAvgRecoveryShort') + e.cMean + '%', rawType: e.type});
      }
    } else if (e.type === '回收率-外标法' || e.type === '回收率-内标法') {
      if (e.cMean) {
        groups[gk].push({time: e.time, value: parseFloat(e.cMean), label: i18n('labelAvgRecoveryShort') + e.cMean + '%', rawType: e.type});
      }
    } else if (e.type === '回收率-简易') {
      if (e.recovery) {
        groups[gk].push({time: e.time, value: parseFloat(e.recovery), label: i18n('labelRecoveryShort') + e.recovery + '%', rawType: e.type});
      }
    } else if (e.type === '干燥失重') {
      // v54.274 fix (correctness #4): entry 存 {mean, sd, rsd, count, samples:[{parallels}]} — samples 上无 loss 字段！
      // 旧代码读 s.loss → undefined → NaN → filter 掉 → losses 永远 [] → 趋势图从不画干燥失重。
      // 改用 entry-level e.mean（saveDryingHistory 已算好）。
      var dLossMean = parseFloat(e.mean);
      if (Number.isFinite(dLossMean)) {
        groups[gk].push({time: e.time, value: dLossMean, label: i18n('labelAvgLoss') + e.mean + '%', rawType: e.type});
      }
    } else if (e.type === '炽灼残渣') {
      // v54.274 fix (correctness #4): 同干燥失重，用 entry-level e.mean
      var dResMean = parseFloat(e.mean);
      if (Number.isFinite(dResMean)) {
        groups[gk].push({time: e.time, value: dResMean, label: i18n('labelAvgResidue') + e.mean + '%', rawType: e.type});
      }
    } else if (e.type === '滴定度') {
      if (e.T) {
        groups[gk].push({time: e.time, value: parseFloat(e.T), label: i18n('labelTiterT') + e.T, rawType: e.type});
      }
    } else if (e.type === '含量均匀度') {
      if (e.xbar) {
        groups[gk].push({time: e.time, value: parseFloat(e.xbar), label: i18n('labelAvgContent') + e.xbar + '%', rawType: e.type});
      }
    } else if (e.type === '溶出度') {
      if (e.mean) {
        groups[gk].push({time: e.time, value: parseFloat(e.mean), label: i18n('labelDissolutionShort') + e.mean + '%', rawType: e.type});
      }
    } else if (e.type === '标准曲线') {
      if (e.r2) {
        groups[gk].push({time: e.time, value: parseFloat(e.r2), label: i18n('hR2Fmt') + ': ' + e.r2, rawType: e.type}); /* v54.276 fix: 'R²: ' 硬编码 → i18n('hR2Fmt')（与 4 个相邻 branch 一致） */
      }
    }
  });
  _extractChartDataCache.sig = history;
  _extractChartDataCache.data = groups;
  return groups;
}

// 构建筛选按钮（v54.90 多选：每个按钮独立 toggle，"全部"按钮清空 Set）
function _buildFilterButtons(groups) {
  var bar = document.getElementById('chart-filter-bar');
  if (!bar) return;
  var types = Object.keys(groups).filter(function(k){ return groups[k].length > 0; });
  if (types.length === 0) { bar.innerHTML = ''; return; }
  // 防御：_chartFilterSet 不是 Set 则重置为空 Set
  if (!(_chartFilterSet instanceof Set)) _chartFilterSet = new Set();
  var showingAll = _chartFilterSet.size === 0;
  var allActive = showingAll ? ' active' : '';
  var allPressed = showingAll ? 'true' : 'false';
  var html = '<button type="button" class="chart-filter-btn' + allActive + '" aria-pressed="' + allPressed + '" onclick="_toggleChartFilter(\'all\')" data-i18n="chartFilterAllBtn">' + _esc(i18n('chartFilterAllBtn')) + '</button>';
 types.forEach(function(t){
 var colors = _chartTypeColors[t] ||{bg:'rgba(107,114,128,0.6)', border:'#6b7280'};
 var isActive = _chartFilterSet.has(t);
 var activeClass = isActive ? ' active' : '';
 var pressed = isActive ? 'true' : 'false';
 html += '<button type="button" class="chart-filter-btn' + activeClass + '" aria-pressed="' + pressed + '" onclick="_toggleChartFilter(' + JSON.stringify(t) + ')" data-i18n="' + _chartTypeI18nKey(t) + '" style="' +(isActive ? 'background:'+colors.border+';border-color:'+colors.border : '') + '">' + _esc(_chartTypeLabel(t)) + '</button>';
});
 bar.innerHTML = html;
}

function _toggleChartFilter(type){
 if(!(_chartFilterSet instanceof Set)) _chartFilterSet = new Set();
 if(type === 'all'){
 _chartFilterSet = new Set();
} else{
 if(_chartFilterSet.has(type)) _chartFilterSet.delete(type);
 else _chartFilterSet.add(type);
}
 drawTrendChart();
}
function toggleChartType(){
 _chartType = _chartType === 'line' ? 'bar' : 'line';
 var btn = document.getElementById('toggle-chart-btn');
 if(btn) {
   btn.textContent = i18n(_chartType === 'line' ? 'btnToggleBar' : 'btnToggleLine');
   btn.setAttribute('aria-pressed', _chartType === 'bar' ? 'true' : 'false');
 }
 drawTrendChart();
}


var thresholdLinesPlugin ={
 id: 'thresholdLines',
 afterDatasetsDraw: function(chart, args, options){
 
 var lines =(options && Array.isArray(options.lines)) ? options.lines :[];
 if(lines.length === 0) return;
 var ctx = chart.ctx;
 var chartArea = chart.chartArea;
 var yScale = chart.scales.y;
 if(!yScale || !chartArea) return;
 lines.forEach(function(line){
 var v = parseFloat(line && line.value);
 if(!Number.isFinite(v)) return;
 var y = yScale.getPixelForValue(v);
 if(y < chartArea.top || y > chartArea.bottom) return;
 ctx.save();
 ctx.beginPath();
 ctx.moveTo(chartArea.left, y);
 ctx.lineTo(chartArea.right, y);
 ctx.lineWidth =(line && line.width) || 1.5;
 ctx.strokeStyle =(line && line.color) || 'rgba(220,38,38,0.6)';
 if(Array.isArray(line && line.dash)) ctx.setLineDash(line.dash);
 ctx.stroke();
 
 if(line && line.label){
 ctx.font = '10px sans-serif';
 ctx.fillStyle =(line && line.color) || 'rgba(220,38,38,0.6)';
 ctx.textAlign = 'right';
 ctx.textBaseline = 'bottom';
 ctx.fillText(line.label, chartArea.right - 4, y - 2);
}
 ctx.restore();
});
}
};
if(typeof Chart !== 'undefined' && typeof Chart.register === 'function'){
 Chart.register(thresholdLinesPlugin);
}


var warningZonesPlugin ={
 id: 'warningZones',
 afterDatasetsDraw: function(chart, args, options){
 var zones =(options && Array.isArray(options.zones)) ? options.zones :[];
 if(zones.length === 0) return;
 var ctx = chart.ctx;
 var chartArea = chart.chartArea;
 var yScale = chart.scales.y;
 if(!yScale || !chartArea) return;
 zones.forEach(function(zone){
 var f = parseFloat(zone && zone.from);
 var t = parseFloat(zone && zone.to);
 if(!Number.isFinite(f) || !Number.isFinite(t)) return;
 if(f === t) return; 
 
 if(f > t){ var tmp = f; f = t; t = tmp;}
 var yTop = yScale.getPixelForValue(t); 
 var yBot = yScale.getPixelForValue(f); 
 
 if(yTop < chartArea.top) yTop = chartArea.top;
 if(yBot > chartArea.bottom) yBot = chartArea.bottom;
 if(yTop >= yBot) return; 
 ctx.save();
 ctx.fillStyle =(zone && zone.color) || 'rgba(22,163,74,0.08)';
 ctx.fillRect(chartArea.left, yTop, chartArea.right - chartArea.left, yBot - yTop);
 
 if(zone && zone.label){
 ctx.font = '10px sans-serif';
 ctx.fillStyle =(zone && zone.borderColor) || 'rgba(22,163,74,0.7)';
 ctx.textAlign = 'right';
 ctx.textBaseline = 'bottom';
 ctx.fillText(zone.label, chartArea.right - 4, yTop - 2);
}
 ctx.restore();
});
}
};
if(typeof Chart !== 'undefined' && typeof Chart.register === 'function'){
 Chart.register(warningZonesPlugin);
}

function _getWarningZones(datasets){
 if(!_showThresholdLines) return[];
 if(!Array.isArray(datasets)) return[];
 var hasGroup = function(key){ return datasets.some(function(ds){ return ds && ds.label === key;});};
 var zones =[];
 if(hasGroup('含量计算')){
 zones.push({from: 95, to: 105, color: 'rgba(22,163,74,0.10)', borderColor: 'rgba(22,163,74,0.7)', label: i18n('thresholdContent')});
}
 if(hasGroup('回收率')){
 zones.push({from: 98, to: 102, color: 'rgba(234,88,12,0.10)', borderColor: 'rgba(234,88,12,0.7)', label: i18n('thresholdRecoveryLow')});
}
 return zones;
}

var _showTrendLines = true; 

function _trendLinearFit(points){
 if(!Array.isArray(points) || points.length < 2) return null;
 var ys =[];
 for(var i = 0; i < points.length; i++){
 var v = parseFloat(points[i] && points[i].value);
 if(!Number.isFinite(v)) return null; 
 ys.push(v);
}
 var n = ys.length;
 var sumX =(n - 1) * n / 2; 
 var sumY = 0, sumXY = 0, sumXX = 0;
 for(var j = 0; j < n; j++){
 sumY += ys[j];
 sumXY += j * ys[j];
 sumXX += j * j;
}
 var denom = n * sumXX - sumX * sumX;
 if(denom === 0) return null;
 var slope =(n * sumXY - sumX * sumY) / denom;
 var intercept =(sumY - slope * sumX) / n;
 return{ slope: slope, intercept: intercept};
}
function _toggleTrendLines(){
 _showTrendLines = !_showTrendLines;
 var btn = document.getElementById('toggle-trend-btn');
 if(btn) {
   btn.textContent = i18n(_showTrendLines ? 'btnTrendOn' : 'btnTrendOff');
   btn.setAttribute('aria-pressed', _showTrendLines ? 'true' : 'false');
 }
 // v54.255 perf: 仅当 chart 实际可见时才重建 —— 用户切到 settings tab 后
 // 此按钮仍可能在 DOM 里（hidden），但调用 drawTrendChart 会触发 _extractChartData
 // 500 条 forEach。drawTrendChart 自身已有 early return，但提前 short-circuit 更省
 // getComputedStyle 开销且语义清晰。
 var _card = document.getElementById('trend-chart-card');
 if(!_card || _card.classList.contains('hide') || getComputedStyle(_card).display === 'none') return;
 drawTrendChart();
}

var _showThresholdLines = true; 
function _getThresholdLines(datasets){
 if(!_showThresholdLines) return[];
 if(!Array.isArray(datasets)) return[];
 var hasGroup = function(key){ return datasets.some(function(ds){ return ds && ds.label === key;});};
 var lines =[];
 if(hasGroup('含量计算')){
 lines.push({value: 95, color: 'rgba(22,163,74,0.7)', dash:[4,4], label: i18n('thresholdContentLow')});
 lines.push({value: 105, color: 'rgba(22,163,74,0.7)', dash:[4,4], label: i18n('thresholdContentHigh')});
}
 if(hasGroup('回收率')){
 lines.push({value: 98, color: 'rgba(234,88,12,0.7)', dash:[4,4], label: i18n('thresholdRecoveryLow')});
 lines.push({value: 102, color: 'rgba(234,88,12,0.7)', dash:[4,4], label: i18n('thresholdRecoveryHigh')});
}
 if(hasGroup('统计计算')){
 lines.push({value: 2, color: 'rgba(37,99,235,0.7)', dash:[4,4], label: i18n('thresholdRsdGuard')});
}
 return lines;
}
/* v54.296: 暴露当前阈值到 window 让 tooltipCallback 读取 + 为每个数据点标记阈值 */
function _decorateDataWithThresholds(datasets, thresholdLines){
 datasets.forEach(function(ds){
 if(!ds || !ds.data) return;
 var tLow = thresholdLines.find(function(t){ return t.label && /Low|下限|低/.test(t.label); });
 var tHigh = thresholdLines.find(function(t){ return t.label && /High|上限|高/.test(t.label); });
 var maxThreshold = tHigh ? tHigh.value : (tLow ? tLow.value : undefined);
 ds.data.forEach(function(p){
 if(p && typeof p === 'object') p._threshold = maxThreshold;
 });
 });
 window._currentThresholds = thresholdLines.map(function(t){
 return { value: t.value, label: t.label, direction: t.dash ? 'max' : 'min' };
 });
}
function _toggleThresholdLines(){
 _showThresholdLines = !_showThresholdLines;
 var btn = document.getElementById('toggle-threshold-btn');
 if(btn) {
   btn.textContent = i18n(_showThresholdLines ? 'btnThresholdOn' : 'btnThresholdOff');
   btn.setAttribute('aria-pressed', _showThresholdLines ? 'true' : 'false');
 }
 // v54.255 perf: 同 _toggleTrendLines — chart 隐藏时跳过 drawTrendChart
 var _card = document.getElementById('trend-chart-card');
 if(!_card || _card.classList.contains('hide') || getComputedStyle(_card).display === 'none') return;
 drawTrendChart();
}
// v54.245 perf: chart.update('none') 优化 — 用 args signature 缓存避免 destroy+recreate
// 仅在 dataset 数据/scale 真的变化时重建；否则只 resize（window resize 路径）
var _trendChartArgsCache = null;

function drawTrendChart(){
 // v54.243 perf: history tab 未激活时跳过 — 避免非可见 tab resize tick 重建 Chart
 var _activePage = document.querySelector('.page.active');
 if(!_activePage || _activePage.id !== 'page-history') return;
 var card = document.getElementById('trend-chart-card');
 var canvas = document.getElementById('trend-canvas');
 var emptyEl = document.getElementById('chart-empty');
 if(!card || !canvas) return;
 if(typeof Chart === 'undefined'){ return;}

 // v54.255 perf: 显式检查 trend-chart-card 是否隐藏（display:none / class hide）—— 避免后续
 // getH() + _extractChartData 500 条 forEach。canvas.offsetWidth===0 检查在 line 885 也覆盖此情况，
 // 但 offset 读 layout 触发 reflow；getComputedStyle 纯样式查询更快（且与下方 forEach 解耦）。
 if(card.classList.contains('hide') || getComputedStyle(card).display === 'none') return;
 
 var container = canvas.parentElement;
 if(container){
 canvas.style.width = '100%';
 canvas.style.height = container.clientHeight + 'px';
}
 // v54.244 fix (Round 8 #11): canvas 0×0 防御 — 隐藏/折叠/未布局时 chart 不可见
 // v54.243 仅检查 active page；tab 内若 trend-chart-card 被 hide 或父容器 0 高，仍会写 0×0
 if (canvas.offsetWidth === 0 || canvas.offsetHeight === 0) return;
 canvas.width = canvas.offsetWidth *(window.devicePixelRatio || 1);
 canvas.height = canvas.offsetHeight *(window.devicePixelRatio || 1);
 var h = getH();
 var allGroups = _extractChartData(h);
 
 _buildFilterButtons(allGroups);
 
 if(!(_chartFilterSet instanceof Set)) _chartFilterSet = new Set();
 var showKeys = _chartFilterSet.size === 0
 ? Object.keys(allGroups).filter(function(k){ return allGroups[k].length > 0;})
 : Object.keys(allGroups).filter(function(k){ return allGroups[k].length > 0 && _chartFilterSet.has(k);});
 
 var datasets =[];
 var totalPoints = 0;
 // v54.249 perf: 把 forEach 内的 i18n() 调用提到循环外（按 chart 类型缓存签名同款思路），避免每个 dataset 都查 I18N 表
 var _trendSuffixLabel = i18n('chartTrendSuffix');
 showKeys.forEach(function(gk){
 var points = allGroups[gk] ||[];
 if(points.length === 0) return;
 totalPoints += points.length;
 
 points.sort(function(a,b){ return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;});
 var colors = _chartTypeColors[gk] ||{bg:'rgba(107,114,128,0.6)', border:'#6b7280'};
 var dataset ={
 label: gk,
 data: points.map(function(p){ return{x: p.time, y: p.value, _label: p.label, _rawType: p.rawType};}),
 backgroundColor: _chartType === 'bar' ? colors.bg : colors.bg.replace('0.6','0.15'),
 borderColor: colors.border,
 borderWidth: 2,
 pointRadius: 3,
 pointBackgroundColor: colors.border,
 tension: 0.3,
 fill: _chartType === 'line'
};
 datasets.push(dataset);
 
 if(_showTrendLines){
 var fit = _trendLinearFit(points);
 if(fit && points.length >= 2){
 var yFirst = fit.intercept;
 var yLast = fit.intercept + fit.slope *(points.length - 1);
 datasets.push({
 label: gk + _trendSuffixLabel,
 data:[{x: points[0].time, y: yFirst},{x: points[points.length - 1].time, y: yLast}],
 borderColor: colors.border,
 borderDash:[6, 4],
 borderWidth: 2,
 pointRadius: 0,
 fill: false,
 
 _isTrendFit: true
});
}
}
});
 if(totalPoints === 0){
 card.style.display = 'block';
 canvas.style.display = 'none';
 if(emptyEl) emptyEl.style.display = 'block';
 document.getElementById('chart-legend').textContent = '';

 if(_chartInstance){ _chartInstance.destroy(); _chartInstance = null;}
 _trendChartArgsCache = null; // v54.245: reset cache
 return;
}
 canvas.style.display = 'block';
 if(emptyEl) emptyEl.style.display = 'none';
 card.style.display = 'block';

 var allValues =[];
 datasets.forEach(function(ds){ ds.data.forEach(function(d){ allValues.push(d.y);});});
 var maxV = Math.max.apply(null, allValues);
 var minV = Math.min.apply(null, allValues);
 var range = maxV - minV || 1;
 var suggestedMin = minV - range * 0.1;
 var suggestedMax = maxV + range * 0.1;

 // v54.274 perf#4: 用 _extractChartDataCache.sig + 渲染参数作轻量签名，跳过全表 JSON.stringify（500 条 × ~10KB → ~5MB 临时字符串）
 // v54.310 fix: 加 data-theme 到签名 → theme 切换时 cache miss → chart 重建（tooltip/scales 颜色用新 theme）
 var _trendSigLite = _extractChartDataCache.sig + '|' + _chartType + '|' + _showTrendLines + '|' + _showThresholdLines + '|' + showKeys.slice().sort().join(',') + '|' + (document.documentElement.getAttribute('data-theme') || 'light');
 if(_chartInstance && _trendChartArgsCache === _trendSigLite){
 _chartInstance.resize();
 } else {
 if(_chartInstance){ _chartInstance.destroy(); _chartInstance = null;}

 var tooltipCallback ={
 title: function(items){
 if(!items.length) return '';
 return items[0].raw.x || '';
},
 label: function(item){
 var d = item.raw;
 var prefix = d._rawType ? '[' + d._rawType + '] ' : '';
 var label = d._label || item.dataset.label || '';
 var y = item.parsed.y;
 /* v54.296: 4 位有效数字 + 千分位（>1000 时）+ 阈值标识 */
 var val = Number.isFinite(y) ? y.toPrecision(4).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : y;
 var badge = '';
 if(d._threshold !== undefined && Number.isFinite(y)){
 badge = (y <= d._threshold ? ' ✅' : ' ⚠️');
 }
 return prefix + label + ': ' + val + badge;
 },
 afterBody: function(items){
 /* v54.296: 阈值参考行（如适用）*/
 var thresholds = (window._currentThresholds || []).filter(function(t){ return t.value !== undefined; });
 if(!thresholds.length) return '';
 var lines = [];
 thresholds.forEach(function(t){
 var prefix = t.label || (t.direction === 'max' ? '≤' : '≥');
 lines.push(prefix + t.value);
 });
 return [''].concat(lines);
 }
};
/* v54.296: chart 创建前给数据点标记阈值 + 暴露 window._currentThresholds 给 tooltipCallback */
_decorateDataWithThresholds(datasets, _getThresholdLines(datasets));
var ctx = canvas.getContext('2d');
_chartInstance = new Chart(ctx,{
 type: _chartType,
 data:{ datasets: datasets},
 options:{
 responsive: true,
 maintainAspectRatio: false,
 interaction:{ mode: 'nearest', intersect: false},
 plugins:{
 legend:{ display: datasets.length > 1, position: 'top', labels:{ boxWidth: 12, font:{ size: 11}, filter: function(item, data){ return !data.datasets[item.datasetIndex]._isTrendFit;}}},
 tooltip:{ callbacks: tooltipCallback, backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(248,250,252,0.95)' : 'rgba(30,41,59,0.9)', titleColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#fff', bodyColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#fff', titleFont:{ size: 11}, bodyFont:{ size: 11}, borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : 'transparent', borderWidth: 1},

 thresholdLines:{ lines: _getThresholdLines(datasets)},
 warningZones:{ zones: _getWarningZones(datasets)}
},
 scales: _getChartScales(suggestedMin, suggestedMax) /* v54.290 dark-mode charts */
}
});
 _trendChartArgsCache = _trendSigLite; /* v54.274 perf#4: was _trendSig (full JSON.stringify) */
 }

 var legendText = i18n('chartLegendPrefix') + totalPoints + i18n('chartLegendTotalFmt');
 if(!(_chartFilterSet instanceof Set) || _chartFilterSet.size > 0){
 var sel =(_chartFilterSet instanceof Set) ? Array.from(_chartFilterSet).join('+') : '';
 if(sel) legendText += i18n('cvFilter') + sel;
}
 document.getElementById('chart-legend').textContent = legendText;
 // v54.252 a11y: dynamic aria-label reflecting data point count
 canvas.setAttribute('aria-label', i18n('titleChartFilter') + ' (' + totalPoints + i18n('chartLegendTotalFmt') + ')');
}

let _resizeRaf = null;
window.addEventListener('resize',() =>{
 if(_resizeRaf) cancelAnimationFrame(_resizeRaf);
 _resizeRaf = requestAnimationFrame(() =>{
 if(typeof drawTrendChart === 'function') drawTrendChart();
 if(typeof drawCurveChart === 'function' && _curveChartInstance) drawCurveChart();
});
});

function saveStatsHistory(){
 
 
 const vals = getValues();
 if(vals.length===0){ _i18nAlert('noData'); return false;}
 const n = vals.length;
 const mean =(vals.reduce((a,b)=>a+b,0)/n).toFixed(6);
 const variance = n>1 ? vals.reduce((a,b)=>a+(b-parseFloat(mean))**2,0)/(n-1) : 0;
 const sd = Math.sqrt(variance).toFixed(6);
 // v54.244 fix (Round 8 #15): mean=0 时硬编码 '0' 错误 — RSD 数学上无定义，
 // 但对 [0.0001, 0.0002] 等极小数 mean 接近 0 的数据，应保留 null 让 UI 显示 ——
 const rsd = mean !== 0 ?(parseFloat(sd)/parseFloat(mean)*100).toFixed(4) : null;
 const entry ={type:'统计计算',time:_formatNow(),data:vals.join(', '),mean,sd,rsd};
 entry._meta = getReportMeta();
 return _saveWithSampleIdPrompt(entry, function(){ flashEl('res-rsd', i18n('flashSavedShort'));});
}
function flashEl(id, msg){
 const el = document.getElementById(id);
 if(!el) return;

 el.classList.remove('flash-highlight');
 void el.offsetWidth;
 el.classList.add('flash-highlight');
 if(typeof msg==='string' && msg){
   if(!msg.includes('<')) el.textContent = msg;
   else el.innerHTML = msg;
   // v54.224: debug-tag 是 fixed 提示元素，需要 opacity 过渡 + 自动隐藏
   if(id === 'debug-tag') {
     el.style.opacity = '1';
     setTimeout(()=>{ if(el){ el.style.opacity = '0'; el.textContent = ''; el.innerHTML = ''; } if(typeof calcStats === 'function' && false) {/* no-op */} }, 1500);
   } else {
     setTimeout(()=>{ if(el){ el.textContent = ''; el.innerHTML = '';} if(id==='res-rsd' && typeof calcStats === 'function') calcStats();}, 1200);
   }
 } else{
   setTimeout(()=>{ el.classList.remove('flash-highlight'); if(id==='res-rsd' && typeof calcStats === 'function') calcStats();}, 1200);
 }
}

window.flashHighlight = flashEl;

function getValues(){
 // v54.232 fix (Round 4 B.A1): 之前用 !isNaN 让 Infinity 进统计 — parseFloat("1e400")===Infinity，
 // isNaN(Infinity)===false，导致 mean=Infinity、sd=NaN 永久写入 rsd-calc-history。
 // 改用 Number.isFinite 同时挡 NaN 和 Infinity。
 return Array.from(document.querySelectorAll('#data-rows input')).map(i=>parseFloat(i.value)).filter(v=>Number.isFinite(v));
}

function calcStatsFromArray(arr){
 
 if(!Array.isArray(arr)) return{n:0, mean:null, sd:null, rsd:null};
 const n = arr.length;
 if(n === 0) return{n:0, mean:null, sd:null, rsd:null};
 const mean = arr.reduce((a,b)=>a+b,0)/n;
 if(n === 1) return{n:1, mean, sd:null, rsd:null};
 const sd = Math.sqrt(arr.reduce((a,b)=>a+(b-mean)**2,0)/(n-1));
 const rsd = mean !== 0 ?(sd/mean)*100 : null;
 return{n, mean, sd, rsd};
}
// v54.243 perf: calcStats is wired to oninput on every #data-rows input — each keystroke does
// querySelectorAll + parseFloat for ALL inputs in the table. Debounce 50ms to coalesce bursts.
var _calcStatsTimer = null;
function calcStatsNow(){
 const vals = getValues();
 const _st = calcStatsFromArray(vals);
 // v54.243 fix: tab 切换时 calcStatsNow 可能晚于 switchTab 触发，此时 #res-* 元素不在 DOM 中
 var _elN = document.getElementById('res-n');
 var _elMean = document.getElementById('res-mean');
 var _elSd = document.getElementById('res-sd');
 var _elRsd = document.getElementById('res-rsd');
 if (!_elN || !_elMean || !_elSd || !_elRsd) return;
 _elN.textContent = _st.n;
 if(_st.n===0){ _elMean.textContent='—'; _elSd.textContent='—'; _elRsd.textContent='—'; return;}
 _elMean.textContent = fmtNum(_st.mean);
 _elSd.textContent = fmtNum(_st.sd);
 _elRsd.textContent = fmtNum(_st.rsd);
}
function calcStats(){
 if(_calcStatsTimer) clearTimeout(_calcStatsTimer);
 _calcStatsTimer = setTimeout(function(){
   _calcStatsTimer = null;
   calcStatsNow();
 }, 50);
}
window.calcStats = calcStats;
window.calcStatsNow = calcStatsNow;
function addRow(){
 
 const c = document.getElementById('data-rows');
 if(!c){ _i18nToast('toast_dataRowsMissing', 'error'); return;}
 const d = document.createElement('div'); d.className='row';
 d.innerHTML = '<input type="text" inputmode="decimal" placeholder="" data-i18n-placeholder="placeholderSampleArea" data-i18n-aria-label="placeholderSampleArea" aria-label="' + _esc(i18n('placeholderSampleArea')) + '" oninput="calcStats()"><button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow" style="min-width:32px">-</button>';
 c.appendChild(d); d.querySelector('input').focus();
}
function removeRow(b){
 
 if(!b) return;
 const rows = document.querySelectorAll('#data-rows .row');
 if(!rows.length) return;
 if(rows.length>1) b.parentElement.remove(); else rows[0].querySelector('input').value='';
 calcStats();
}
function pasteMulti(){
 const text = prompt(i18n('uiPasteDataHint')); if(!text) return;
 const nums = text.split(/[\s,，\n]+/).map(s=>parseFloat(s.trim())).filter(v=>Number.isFinite(v));
 if(nums.length===0){ _i18nAlert('noValidNumbers'); return;}
 const c = document.getElementById('data-rows'); c.innerHTML='';
 nums.forEach(v=>{
 const d=document.createElement('div'); d.className='row';
 d.innerHTML = '<input type="text" inputmode="decimal" value="'+_esc(v)+'" data-i18n-aria-label="placeholderSampleArea" aria-label="' + _esc(i18n('placeholderSampleArea')) + '" oninput="calcStats()"><button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow" style="min-width:32px">-</button>';
 c.appendChild(d);
});
 calcStats();
}
async function clearStats(){
 // v54.233 fix (Round 4 C#1): 之前没确认直接清空，误点 = 全部数据丢失（无撤销）
 if(!await _confirmDialog(i18n('uiClearStatsConfirm'), { danger: true })) return;
 const dataRows = document.getElementById('data-rows');
 if(dataRows) dataRows.innerHTML = '<div class="row"><input type="text" inputmode="decimal" placeholder="" data-i18n-placeholder="placeholderSampleArea" aria-label="' + _esc(i18n('placeholderSampleArea')) + '" data-i18n-aria-label="placeholderSampleArea" oninput="calcStats()"><button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow" style="min-width:32px">-</button></div>';
 calcStats();
 flashEl('res-rsd', i18n('flashCleared'));
}


var contentData =[];
function stdF(){
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? parseFloat(e.value) : NaN;};
 const area = gv('std-area');
 const weight = _mgInput('std-weight');
 const purity = gv('std-purity');
 const dilution = gv('std-dilution');
 let moisture = gv('std-moisture');
 let residue = gv('std-residue');
 if(!Number.isFinite(moisture)) moisture = 0;
 if(!Number.isFinite(residue)) residue = 0;
 if([area,weight,purity,dilution].some(v=>!Number.isFinite(v)||v<=0)) return NaN;
 const dryFactor =(100 - moisture - residue) / 100;
 if(dryFactor <= 0) return NaN; /* v54.281 fix (correctness HIGH): dryFactor 守卫（v54.239 extStdF 已加；stdF 漏修） */
 return area /(weight * purity / 100 * dryFactor / dilution);
}
function renderContent(){ _sf();
 const container = document.getElementById('content-samples');
 if(!container) return;
 const f = stdF();
 if(!contentData.length) contentData.push({weight:'',dilution:'',moisture:'0',residue:'0',parallels:[{area:''}]});
 // v54.274 perf#6: hoist 循环内常量 i18n 调用
 const _iSampleNum = i18n('sampleNum'), _iSW = i18n('lbl-sample-weight'), _iDV = i18n('lbl-dilution-vol');
 const _iMoist = i18n('lblMoisturePct'), _iResidue = i18n('lbl-residue-pct'), _iPeak = i18n('thPeakArea');
 const _iRmP = i18n('ariaRemoveParallel'), _iBAvg = i18n('boldAvg'), _iBRes = i18n('boldResult');
 let html = '';
 contentData.forEach((sample, si) =>{
 if(!sample.parallels||!sample.parallels.length) sample.parallels =[{area:''}];
 const w=calcExpr(sample.weight), d=calcExpr(sample.dilution), m=calcExpr(sample.moisture)||0, r=calcExpr(sample.residue)||0;
 const contents =[];
 sample.parallels.forEach(p =>{
 const area = calcExpr(p.area);
 if(Number.isFinite(area)&&area>0&&Number.isFinite(f)&&Number.isFinite(w)&&w>0&&Number.isFinite(d)&&d>0){
 const dryFactor=(100-m-r)/100;
 // v54.239 fix: m+r>100 时 dryFactor 为负 → content% 变负
 if(dryFactor > 0){
 const c =(area/f)/(w*dryFactor/d)*100;
 contents.push(c);
}
}
});
 const _st=calcStatsFromArray(contents);const n=_st.n,mean=_st.mean,sd=_st.sd,rsd=_st.rsd;
 html += '<div class="content-sample sample-row mb-10">';
 html += '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">';
 html += _iSampleNum +(si+1);
 html += '<span><button class="btn btn-danger btn-xs" onclick="clearContentSample('+si+')" style="margin-right:4px" data-i18n="clearThisSample">清空本样</button><button class="btn btn-danger btn-xs" onclick="removeContentSample('+si+')" style="border-color:#999;color:#666" data-i18n="btnDelete">删除</button></span>';
 html += '</div>';

 html += '<div class="half" style="margin-bottom:6px">';
 html += '<div><label data-i18n="lbl-sample-weight">称样量 (mg)</label><input type="text" inputmode="decimal" value="'+_esc(_mgToWeightDisplay(sample.weight))+'" placeholder="0" oninput="updateContentParam('+si+',\'weight\',this.value)" data-fi="'+si+'-w" aria-label="' + _esc(_iSW) + '" data-i18n-aria-label="lbl-sample-weight"></div>';
 html += '<div><label data-i18n="lbl-dilution-vol">稀释体积 (mL)</label><input type="text" inputmode="decimal" value="'+_esc(sample.dilution)+'" placeholder="0" oninput="updateContentParam('+si+',\'dilution\',this.value)" data-fi="'+si+'-d" aria-label="' + _esc(_iDV) + '" data-i18n-aria-label="lbl-dilution-vol"></div>';
 html += '<div><label data-i18n="lblMoisturePct">水分 (%)</label><input type="text" inputmode="decimal" value="'+_esc(sample.moisture)+'" placeholder="0" oninput="updateContentParam('+si+',\'moisture\',this.value)" data-fi="'+si+'-m" aria-label="' + _esc(_iMoist) + '" data-i18n-aria-label="lblMoisturePct"></div>';
 html += '<div><label data-i18n="lbl-residue-pct">炽灼残渣 (%)</label><input type="text" inputmode="decimal" value="'+_esc(sample.residue)+'" placeholder="0" oninput="updateContentParam('+si+',\'residue\',this.value)" data-fi="'+si+'-r" aria-label="' + _esc(_iResidue) + '" data-i18n-aria-label="lbl-residue-pct"></div>';
 html += '</div>';

 html += '<table class="matrix-table"><thead><tr><th scope="col" data-i18n="th-seq">序号</th><th scope="col" data-i18n="thPeakArea">峰面积</th><th scope="col" data-i18n="lblContentPct">含量%</th><th scope="col" data-i18n="th-op">操作</th></tr></thead><tbody>';
 sample.parallels.forEach((p, pi) =>{
 const c = pi < contents.length ? contents[pi] : NaN;
 html += '<tr><td>'+(pi+1)+'</td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.area)+'" placeholder="0" oninput="updateContentParallel('+si+','+pi+',\'area\',this.value)" aria-label="' + _esc(_iPeak) + '" data-i18n-aria-label="thPeakArea" data-fi="'+si+'-'+pi+'-a"></td>';
 html += '<td class="result-col">'+(Number.isFinite(c)?fmtNum(c)+'%':'—')+'</td>';
 html += '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeContentParallel('+si+','+pi+')" aria-label="' + _esc(_iRmP) + '" data-i18n-aria-label="ariaRemoveParallel">-</button></td></tr>';
});
 html += '</tbody></table>';
 html += '<div style="font-size:12px;margin-top:4px;padding:6px;background:#f8fafc;border-radius:6px">';
 if(n>=2) html += '' + _iBAvg + fmtNum(mean) + '%</b>  SD='+fmtNum(sd)+'  RSD='+fmtNum(rsd)+'%';
 else if(n===1) html += '' + _iBRes + fmtNum(contents[0]) + '%</b>';
 else html += '—';
 html += '</div>';
 html += '<button class="btn btn-outline btn-xs mt-4" onclick="addContentParallel('+si+')" data-i18n="addParallel">+ 添加平行样</button>';
 html += '</div>';
});
 // v54.274 perf#8: 用 DocumentFragment 批量插入代替 innerHTML= 大字符串（与 renderTiter/Uniformity/Dissolution 一致）
 const _fragWrap = document.createElement('div');
 _fragWrap.innerHTML = html;
 const _frag = document.createDocumentFragment();
 while(_fragWrap.firstChild){ _frag.appendChild(_fragWrap.firstChild);}
 container.innerHTML = '';
 container.appendChild(_frag);
 _rf(container);
}
registerModule('content',{ dataArray: contentData, defaultParallel:{area:''}, defaultSampleParams:{weight:'',dilution:'',moisture:'0',residue:'0'}, renderFn: renderContentDebounced});
function updateContentParam(si, field, value){ if(contentData[si]){ contentData[si][field] = value; renderContent();}}
async function clearContent(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 contentData.length = 0; renderContent();
}
async function clearContentStd(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
['std-area','std-weight','std-dilution'].forEach(id=>setVal(id, ''));
 setVal('std-purity', '100');
 setVal('std-moisture', '0');
 setVal('std-residue', '0');
 renderContent();
}
function saveContentHistory(){
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? e.value : '';};
 const stdArea = gv('std-area');
 const stdWeight = gv('std-weight');
 if(!stdArea||!stdWeight){ _i18nAlert('noStdParams'); return;}
 if(!contentData.length){ _i18nAlert('noSampleData'); return;}
 const entry ={
 type:'外标含量', time:_formatNow(),
 stdArea, stdWeight,
 stdPurity: gv('std-purity'),
 stdDilution: gv('std-dilution'),
 stdMoisture: gv('std-moisture') || '0',
 stdResidue: gv('std-residue') || '0',
 samples: contentData.map(s =>({
 weight: s.weight, dilution: s.dilution, moisture: s.moisture, residue: s.residue,
 parallels: s.parallels.filter(p => p.area).map(p =>({area: p.area}))
})).filter(s => s.parallels.length > 0)
};
 if(!entry.samples.length){ _i18nAlert('noParallel'); return;}
 entry._meta = getReportMeta();
 return _saveWithSampleIdPrompt(entry, function(){ _i18nAlert('saved');});
}

function switchRecovery(method){
 
 
 
 const validMethods =['normalize', 'external', 'internal', 'simple'];
 if(!validMethods.includes(method)){
 _i18nToast('toast_switchRecoveryInvalid', 'warn', 2500, method, validMethods.join('/'));
 return;
}
/* v54.274 fix (a11y #7): 必须 scope 到 #page-recovery — 旧代码全局 querySelectorAll('.subtab') 会把
     page-special / page-mw / recovery 的 5 组 subtab 全部重写 aria-selected=false（切 tab 后状态错乱） */
 document.querySelectorAll('#page-recovery .subtab').forEach((t,i)=>{
 const isActive = i===(method==='normalize'?0 : method==='external'?1 : method==='internal'?2 : 3);
 t.classList.toggle('active', isActive);
 // v54.230 a11y
 t.setAttribute('aria-selected', isActive ? 'true' : 'false');
 t.setAttribute('tabindex', isActive ? '0' : '-1');
});
 document.querySelectorAll('.rec-method').forEach(m=>m.style.display='none');
 const recEl = document.getElementById('rec-'+method);
 if(recEl) recEl.style.display='block'; else _i18nToast('toast_recContainerMissingFmt', 'error', null, method);
}

function switchSpecial(method){
 
 
 
 
 const validMethods =['drying', 'content', 'residue', 'titer', 'mw', 'uniformity', 'dissolution', 'curve', 'spike'];
 if(!validMethods.includes(method)){
 _i18nToast('toast_switchSpecialInvalid', 'warn', 2500, method, validMethods.join('/'));
 return;
}
 document.querySelectorAll('#page-special .subtab').forEach((t,i)=>{
 const isActive = i===(method==='drying'?0 : method==='content'?1 : method==='residue'?2 : method==='titer'?3 : method==='mw'?4 : method==='uniformity'?5 : method==='dissolution'?6 : method==='curve'?7 : method==='spike'?8 : 0);
 t.classList.toggle('active', isActive);
 // v54.230 a11y
 t.setAttribute('aria-selected', isActive ? 'true' : 'false');
 t.setAttribute('tabindex', isActive ? '0' : '-1');
});
 document.querySelectorAll('.sp-method').forEach(m=>m.style.display='none');
 
 const spEl = document.getElementById('sp-'+method);
 if(spEl) spEl.style.display='block'; else _i18nToast('toast_spContainerMissingFmt', 'error', null, method);
 if(method==='mw') switchMw('dry');
 if(method==='spike' && !document.querySelectorAll('#spike-rows tr').length){ addSpikeSample(); addSpikeSample(); addSpikeSample();}
 
 _currentSpecial = method;
 
 if(typeof history !== 'undefined' && history.pushState && !_suppressHistoryPush){
 try{ history.pushState({ rsdTab: 'special', rsdSpecial: method, ts: Date.now()}, '', '#special/' + method);} catch(e){}
}
}

var curveData =[];
function addCurveRow(){
 
 var tbody = document.getElementById('curve-rows');
 if(!tbody){ _i18nToast('toast_curveRowsMissing', 'error'); return;}
 var rows = tbody.querySelectorAll('tr');
 var n = rows.length + 1;
 var tr = document.createElement('tr');
 tr.innerHTML = '<td>'+n+'</td>'+
 '<td><input type="text" inputmode="decimal" class="curve-x" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblConcentrationX')) + '" data-i18n-aria-label="lblConcentrationX"></td>'+
 '<td><input type="text" inputmode="decimal" class="curve-y" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblResponseY')) + '" data-i18n-aria-label="lblResponseY"></td>'+
 '<td class="result-col" id="curve-py-'+n+'">—</td>'+
 '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeCurveRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td>';
 tbody.appendChild(tr);
 calcCurve();
}
function removeCurveRow(btn){
 
 if(!btn) return;
 var tbody = document.getElementById('curve-rows');
 if(!tbody) return;
 if(tbody.querySelectorAll('tr').length <= 2){ btn.closest('tr').querySelectorAll('input').forEach(function(i){i.value='';}); calcCurve(); return;}
 btn.closest('tr').remove();
 calcCurve();
}
function getCurveData(){
 var data =[];
 // v54.240 fix: 防御 #curve-rows 不存在（tab 未渲染 / 用户极端操作）
 var tbody = document.getElementById('curve-rows');
 if (!tbody) return data;
 tbody.querySelectorAll('tr').forEach(function(row){
 var inputs = row.querySelectorAll('input');
 if (inputs.length < 2) return;
 var x = parseFloat(inputs[0].value), y = parseFloat(inputs[1].value);
 if(Number.isFinite(x) && Number.isFinite(y)) data.push({x:x, y:y});
});
 return data;
}
function calcCurve(){
 var data = getCurveData();
 var n = data.length;

 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 const setText =(id, v) =>{ const e = document.getElementById(id); if(e){ e.textContent = v; /* v54.295: 自动给 '—' 空值加 is-empty class 触发浅灰样式 */ if(v === '—' || v === '' || v == null) e.classList.add('is-empty'); else e.classList.remove('is-empty'); }};
 setStyle('curve-result', 'none');
 if(n < 2){ drawCurveChart(null, 0, 0, 0); return;}
 var sumX=0, sumY=0, sumXY=0, sumX2=0, sumY2=0;
 data.forEach(function(d){ sumX+=d.x; sumY+=d.y; sumXY+=d.x*d.y; sumX2+=d.x*d.x; sumY2+=d.y*d.y;});
 // v54.228 fix: 标准曲线退化解（所有 x 相同）→ 公式分母为 0 → a/b/r2 全 NaN → 之前会保存到历史显示 "NaN"
 var _curveDenom = n*sumX2 - sumX*sumX;
 if(Math.abs(_curveDenom) < 1e-10){
 drawCurveChart(null, 0, 0, 0);
 if(typeof _i18nToast === 'function') _i18nToast('toast_curveSingular', 'warn', 3000);
 return;
}
 var a =(n*sumXY - sumX*sumY) / _curveDenom;
 var b =(sumY - a*sumX) / n;
 var meanY = sumY/n;
 var ssRes=0, ssTot=0;
 data.forEach(function(d){ var yp=a*d.x+b; ssRes+=(d.y-yp)*(d.y-yp); ssTot+=(d.y-meanY)*(d.y-meanY);});
 var r2 = ssTot===0 ? 1 : 1 - ssRes/ssTot;
 r2 = Math.max(0, Math.min(1, r2));
 setText('curve-a', a.toPrecision(6));
 setText('curve-b', b.toPrecision(6));
 setText('curve-r2', r2.toFixed(6));
 setStyle('curve-result', 'block');
 document.querySelectorAll('#curve-rows tr').forEach(function(row, i){
 var inputs = row.querySelectorAll('input');
 if(!inputs.length) return;
 var x = parseFloat(inputs[0].value);
 // v54.242 fix: 用 row.querySelector('.result-col') 替代 getElementById('curve-py-'+(i+1)) —
 // 删除中间行后行 id 保留旧 N（例如 1,3），按 i+1 索引会错位（i=1 找 curve-py-2 不存在，i=2 找 curve-py-3 但已是行 3 的原 id），
 // 用 row.querySelector 直接绑当前行 result-col 更稳定
 var py = row.querySelector('.result-col');
 if(py) py.textContent = Number.isFinite(x) ? (a*x+b).toPrecision(6) : '—'; /* v54.272 fix (correctness HIGH): flipped !Number.isFinite → Number.isFinite, show "—" instead of "NaN" for invalid x */
});
 
 drawCurveChart(data, a, b, r2);
}
function calcCurveBack(){
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? e.value : '';};
 const gt =(id) =>{ const e = document.getElementById(id); return e ? e.textContent : '';};
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 var a = parseFloat(gt('curve-a'));
 var b = parseFloat(gt('curve-b'));
 var y0 = parseFloat(gv('curve-y0'));
 if(!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(y0) || a<=0){ setStyle('curve-back-result', 'none'); return;}
 const setText =(id, v) =>{ const e = document.getElementById(id); if(e){ e.textContent = v; /* v54.295: 自动给 '—' 空值加 is-empty class 触发浅灰样式 */ if(v === '—' || v === '' || v == null) e.classList.add('is-empty'); else e.classList.remove('is-empty'); }};
 setText('curve-x0',((y0-b)/a).toPrecision(6));
 setStyle('curve-back-result', 'grid');
}
async function clearCurve(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;

 const curveRows = document.getElementById('curve-rows');
 if(curveRows) curveRows.innerHTML =
 '<tr><td>1</td><td><input type="text" inputmode="decimal" class="curve-x" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblConcentrationX')) + '" data-i18n-aria-label="lblConcentrationX"></td><td><input type="text" inputmode="decimal" class="curve-y" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblResponseY')) + '" data-i18n-aria-label="lblResponseY"></td><td class="result-col" id="curve-py-1">—</td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeCurveRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>'+
 '<tr><td>2</td><td><input type="text" inputmode="decimal" class="curve-x" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblConcentrationX')) + '" data-i18n-aria-label="lblConcentrationX"></td><td><input type="text" inputmode="decimal" class="curve-y" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblResponseY')) + '" data-i18n-aria-label="lblResponseY"></td><td class="result-col" id="curve-py-2">—</td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeCurveRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>'+
 '<tr><td>3</td><td><input type="text" inputmode="decimal" class="curve-x" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblConcentrationX')) + '" data-i18n-aria-label="lblConcentrationX"></td><td><input type="text" inputmode="decimal" class="curve-y" placeholder="0" oninput="calcCurve()" aria-label="' + _esc(i18n('lblResponseY')) + '" data-i18n-aria-label="lblResponseY"></td><td class="result-col" id="curve-py-3">—</td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeCurveRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>';
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 setStyle('curve-result', 'none');
 setStyle('curve-back-result', 'none');
 const y0 = document.getElementById('curve-y0'); if(y0) y0.value = '';
 
 if(_curveChartInstance){ _curveChartInstance.destroy(); _curveChartInstance = null;}
 var chartCard = document.getElementById('curveChartCard');
 if(chartCard) chartCard.style.display = 'none';
}
function saveCurveHistory(){
 var data = getCurveData();
 if(data.length < 2){ _i18nAlert('needMoreData'); return;}
 
 const gt =(id) =>{ const e = document.getElementById(id); return e ? e.textContent : '';};
 const entry ={type:'标准曲线', time:_formatNow(), points:data, a:gt('curve-a'), b:gt('curve-b'), r2:gt('curve-r2')};
 entry._meta = getReportMeta();
 return _saveWithSampleIdPrompt(entry, function(){ flashEl('curve-result', i18n('flashSavedShort'));});
}


function addSpikeSample(){
 const tbody = document.getElementById('spike-rows');
 if(!tbody) return;
 const n = tbody.querySelectorAll('tr').length + 1;
 const level = n === 1 ? '80%' : n === 2 ? '100%' : n === 3 ? '120%' :(n * 20 + 60) + '%';
 const tr = document.createElement('tr');
 tr.innerHTML =
 '<td>' + n + '</td>' +
 '<td><input type="text" inputmode="decimal" class="spike-level" value="' + level + '" oninput="calcSpike()" style="width:60px;text-align:center" aria-label="' + _esc(i18n('thLevel')) + '" data-i18n-aria-label="thLevel"></td>' +
 '<td><input type="text" inputmode="decimal" class="spike-added" placeholder="0" oninput="calcSpike()" style="width:80px" aria-label="' + _esc(i18n('thSpikeAdd')) + '" data-i18n-aria-label="thSpikeAdd"></td>' +
 '<td><input type="text" inputmode="decimal" class="spike-measured" placeholder="0" oninput="calcSpike()" style="width:100px" aria-label="' + _esc(i18n('thMeasuredTotal')) + '" data-i18n-aria-label="thMeasuredTotal"></td>' +
 '<td class="result-col spike-recovery">—</td>' +
 '<td class="result-col spike-judge">—</td>' +
 '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeSpikeSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
 tbody.appendChild(tr);
 calcSpike();
}
function removeSpikeSample(btn){
 
 if(!btn) return;
 const tr = btn.closest('tr'); if(tr) tr.remove();
 
 document.querySelectorAll('#spike-rows tr').forEach((r, i) =>{ r.cells[0].textContent = i + 1;});
 calcSpike();
}
function calcSpike(){
 const sampleOriginal = _mgInput('spike-original') || 0;
 // v54.235 fix (Round 4 LOW): 之前 limit 输入空字符串 → parseFloat('')=NaN → recovery >= NaN 永远 false → "✗"
 // 加合理默认：limitLow 80 / limitHigh 115 / rsdLimit 5（中国药典加样回收率标准）
 const _gv = (id, def) => { const v = parseFloat(document.getElementById(id).value); return Number.isFinite(v) ? v : def; };
 const limitLow = _gv('spike-limit-low', 80);
 const limitHigh = _gv('spike-limit-high', 115);
 const rsdLimit = _gv('spike-rsd-limit', 5);
 const rows = document.querySelectorAll('#spike-rows tr');
 const recoveries =[];
 rows.forEach(tr =>{
 // v54.233 fix (Round 4 B#3): tr.querySelector('.spike-added') 可能返回 null（如手动删了 class 或 DOM 注入攻击）
 // 之前直接 .value 抛 TypeError，整个 calcSpike 中断，所有 spike 结果列停留在旧值。
 const addedEl = tr.querySelector('.spike-added');
 const measuredEl = tr.querySelector('.spike-measured');
 if(!addedEl || !measuredEl) return;
 const added = (() => { const v = _mgInput(addedEl); return Number.isFinite(v) ? v : null; })();
 const measured = (() => { const v = _mgInput(measuredEl); return Number.isFinite(v) ? v : null; })();
 // v54.239 fix: added/measured 为负时 recovery 公式算出负/超大值
 if(added < 0 || measured < 0){ const rc = tr.querySelector('.spike-recovery'); if(rc) rc.textContent = '—'; return; }
 const recCell = tr.querySelector('.spike-recovery');
 const judgeCell = tr.querySelector('.spike-judge');
 if(!recCell || !judgeCell) return;
 if(!added || !measured){ recCell.textContent = '—'; judgeCell.textContent = '—'; judgeCell.style.color = ''; return;}
 const recovery =((measured - sampleOriginal) / added) * 100;
 recCell.textContent = recovery.toFixed(2);
 const inRange = recovery >= limitLow && recovery <= limitHigh;
 judgeCell.textContent = inRange ? '✓' : '✗';
 judgeCell.style.color = inRange ? _cssVar('--success') : _cssVar('--danger');
 recoveries.push(recovery);
});
 if(recoveries.length < 2){
 document.getElementById('spike-result').style.display = 'none';
 return;
}
 const stats = calcStatsFromArray(recoveries);
 document.getElementById('spike-result').style.display = 'grid';
 document.getElementById('spike-mean').textContent = stats.mean.toFixed(2) + ' %';
 document.getElementById('spike-sd').textContent = stats.sd != null ? stats.sd.toFixed(3) : '—';
 document.getElementById('spike-rsd').textContent = stats.rsd != null ? stats.rsd.toFixed(2) + ' %' : '—';
 
 const allInRange = recoveries.every(r => r >= limitLow && r <= limitHigh);
 const rsdOk = stats.rsd != null && stats.rsd <= rsdLimit;
 const verdict = allInRange && rsdOk ? i18n('passOk') : i18n('chartFailShort');
 const verdictEl = document.getElementById('spike-verdict');
 verdictEl.textContent = verdict;
 verdictEl.style.color =(allInRange && rsdOk) ? _cssVar('--success') : _cssVar('--danger');
}
async function clearSpike(){
 if(!await _confirmDialog(i18n('uiClearSpikeConfirm'),{ danger: true})) return;
 document.getElementById('spike-original').value = '';
 document.getElementById('spike-rows').innerHTML = '';
 document.getElementById('spike-result').style.display = 'none';
 addSpikeSample(); addSpikeSample(); addSpikeSample();
 flashEl('spike-result', i18n('flashCleared'));
}

function saveSpikeRecoveryHistory(){
 const recoveries =[];
 document.querySelectorAll('#spike-rows tr').forEach(tr =>{
 const rc = tr.querySelector('.spike-recovery');
 const r = rc ? parseFloat(rc.textContent) : NaN;
 if(Number.isFinite(r)) recoveries.push(r); /* v54.273 fix: !Number.isFinite 反转（v54.248 同源）→ spike ≥2 行时 recoveries 永远空，保存失败 */
});
 if(recoveries.length < 2){ _i18nAlert('needMoreDataGroup'); return;}
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? e.value : '';};
 const sampleOriginal = parseFloat(gv('spike-original')) || 0;
 const rows =[];
 document.querySelectorAll('#spike-rows tr').forEach(tr =>{
 const lvl = tr.querySelector('.spike-level');
 const addE = tr.querySelector('.spike-added');
 const mea = tr.querySelector('.spike-measured');
 const rec = tr.querySelector('.spike-recovery');
 rows.push({
 level: lvl ? lvl.value : '',
 added: addE ? (() => { const v = parseFloat(addE.value); return Number.isFinite(v) ? v : null; })() : null,
 measured: mea ? (() => { const v = parseFloat(mea.value); return Number.isFinite(v) ? v : null; })() : null,
 // v54.238 fix: 用 Number.isFinite 替代 || 0 避免 NaN 静默转 0 污染历史（v54.232 getValues 同款问题）
 recovery: (() => { const v = rec ? parseFloat(rec.textContent) : NaN; return Number.isFinite(v) ? v : null; })(),
});
});
 const entry ={
 type: '加样回收率',
 time: _formatNow(),
 original: sampleOriginal,
 limitLow: parseFloat(gv('spike-limit-low')),
 limitHigh: parseFloat(gv('spike-limit-high')),
 rsdLimit: parseFloat(gv('spike-rsd-limit')),
 rows,
 // v54.239 fix: spike-mean/sd/rsd 在 null 时显示 '—' → parseFloat('—')=NaN → || 0 → 历史污染 mean=0/sd=0/rsd=0
 mean: (() => { const v = parseFloat(document.getElementById('spike-mean').textContent); return Number.isFinite(v) ? v : null; })(),
 sd: (() => { const v = parseFloat(document.getElementById('spike-sd').textContent); return Number.isFinite(v) ? v : null; })(),
 rsd: (() => { const v = parseFloat(document.getElementById('spike-rsd').textContent); return Number.isFinite(v) ? v : null; })(),
 verdict: document.getElementById('spike-verdict').textContent || '',
};
 entry._meta = getReportMeta();
 return _saveWithSampleIdPrompt(entry, function(){ flashEl('spike-result', i18n('flashSavedShort')); renderSpikeHistory();});
}

/* v54.297: SVG icon 提到顶级（避免 JS const 块级作用域限制，让 renderHistory 也能复用 _ICON_INBOX/_ICON_SEARCH） */
const _ICON_FLASK = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3"/><path d="M7 14h10"/></svg>';
const _ICON_INBOX = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>';
const _ICON_SEARCH = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

function renderSpikeHistory(){
 const card = document.getElementById('spike-history-card');
 const list = document.getElementById('spike-history-list');
 if(!card || !list) return;
 const all =(typeof getH === 'function' ? getH() : JSON.parse(localStorage.getItem('rsd-calc-history') || '[]'));
 const spikeHist = all.filter(h => h.type === '加样回收率').slice(-10).reverse();
 // v54.282 perf: hoist 循环外常量 i18n 调用 + 改 split/chain 用 .replace
 const _iEmptySpikeTitle = i18n('emptySpikeHistoryTitle'), _iEmptySpikeSub = i18n('emptySpikeHistorySubtitle');
 const _iSpikeRecent10 = i18n('spikeRecent10'), _iSpikeVerdict = i18n('spikeMeanRsdVerdict');
 if(!spikeHist.length){
 card.style.display = 'block';
list.innerHTML = emptyState(_ICON_FLASK, _iEmptySpikeTitle, _iEmptySpikeSub, '<button class="btn btn-primary btn-sm" onclick="switchTab(&quot;recovery&quot;)" data-i18n="btnGoRecovery" data-i18n-aria-label="titleTabRecovery">去回收率计算</button>');
 return;
}
 card.style.display = 'block';
 let html = '<div style="font-size:12px;color:var(--text-light);margin-bottom:6px">' + _iSpikeRecent10 + '</div>';
 spikeHist.forEach((h, i) =>{
 html += '<div style="padding:6px;border:1px solid var(--border);border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;gap:8px;align-items:center">';
 html += '<span>' +(h.time || '') + '</span>';
 html += '<span>' + _iSpikeVerdict.replace('{0}', (h.mean || 0).toFixed(2)).replace('{1}', (h.rsd || 0).toFixed(2)).replace('{2}', h.verdict || '') + '</span>';
 html += '</div>';
});
 list.innerHTML = html;
}

var _curveChartInstance = null;
// v54.245 perf: chart.update('none') 优化 — signature 命中只 resize，避免 destroy+recreate
var _curveChartArgsCache = null;

function _t975Inv(df){
 if(!Number.isFinite(df) || df < 1) return NaN;
 if(df >= 30) return 1.96;
 
 var _t =[12.706,4.303,3.182,2.776,2.571,2.447,2.365,2.306,2.262,2.228,2.201,2.179,2.160,2.145,2.131,2.120,2.110,2.101,2.093,2.086,2.080,2.074,2.069,2.064,2.060,2.056,2.052,2.048,2.045];
 if(df < 1) return NaN;
 var idx = Math.min(Math.max(Math.round(df) - 1, 0), _t.length - 1);
 return _t[idx];
}

function _curveLinearStats(points, slope, intercept){
 if(!Array.isArray(points) || points.length < 2) return null;
 var n = points.length;
 var sumX = 0, sumY = 0;
 for(var i = 0; i < n; i++){
 var p = points[i];
 if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
 sumX += p.x; sumY += p.y;
}
 var xMean = sumX / n;
 var Sxx = 0, ssRes = 0;
 for(var j = 0; j < n; j++){
 var dx = points[j].x - xMean;
 Sxx += dx * dx;
 var yp = slope * points[j].x + intercept;
 var dy = points[j].y - yp;
 ssRes += dy * dy;
}
 if(Sxx <= 0) return null;
 var syx = Math.sqrt(ssRes /(n - 2));
 return{ n: n, xMean: xMean, Sxx: Sxx, syx: syx, t: _t975Inv(n - 2)};
}


function _curveBandDatasets(data, a, b){
 if(!Array.isArray(data) || data.length < 3) return[];
 var stats = _curveLinearStats(data, a, b);
 if(!stats) return[];
 var xs =[];
 for(var i = 0; i < data.length; i++) xs.push(data[i].x);
 var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
 var pad =(xMax - xMin) * 0.05 || 1;
 var N = 60;
 var step =(xMax - xMin + 2 * pad) /(N - 1);
 var lowerCI =[], upperCI =[], lowerPI =[], upperPI =[];
 for(var k = 0; k < N; k++){
 var x = xMin - pad + k * step;
 var yhat = a * x + b;
 var c =(x - stats.xMean) *(x - stats.xMean) / stats.Sxx;
 var hwCI = stats.t * stats.syx * Math.sqrt(1.0 / stats.n + c);
 var hwPI = stats.t * stats.syx * Math.sqrt(1.0 + 1.0 / stats.n + c);
 lowerCI.push({ x: x, y: yhat - hwCI});
 upperCI.push({ x: x, y: yhat + hwCI});
 lowerPI.push({ x: x, y: yhat - hwPI});
 upperPI.push({ x: x, y: yhat + hwPI});
}
 return[
{ label: i18n('chartCiLower'), data: lowerCI, type: 'line', borderColor: 'rgba(220,38,38,0.45)', borderWidth: 1, borderDash:[2, 3], pointRadius: 0, fill: false, tension: 0, order: 0},
{ label: i18n('chartCiUpper'), data: upperCI, type: 'line', borderColor: 'rgba(220,38,38,0.45)', borderWidth: 1, borderDash:[2, 3], pointRadius: 0, fill: false, tension: 0, order: 0},
{ label: i18n('chartPiLower'), data: lowerPI, type: 'line', borderColor: 'rgba(37,99,235,0.45)', borderWidth: 1, borderDash:[2, 3], pointRadius: 0, fill: false, tension: 0, order: 0},
{ label: i18n('chartPiUpper'), data: upperPI, type: 'line', borderColor: 'rgba(37,99,235,0.55)', borderWidth: 1, borderDash:[2, 3], pointRadius: 0, fill:{ target: 4}, tension: 0, order: 0}
];
}
function drawCurveChart(data, a, b, r2){
 var card = document.getElementById('curveChartCard');
 var canvas = document.getElementById('curveChart');
 if(!card || !canvas) return;
 if(typeof Chart === 'undefined'){ card.style.display = 'none'; return;}

 var container = canvas.parentElement;
 if(container){
 canvas.style.width = '100%';
 canvas.style.height = container.clientHeight + 'px';
}
 if(!data || data.length < 2){
 card.style.display = 'none';
 card.classList.add('card-collapsed');
 if(_curveChartInstance){ _curveChartInstance.destroy(); _curveChartInstance = null;}
 _curveChartArgsCache = null; // v54.245: reset cache
 return;
}

 // v54.245 perf: signature 命中 → 只 resize，不重建 Chart.js 实例
 var _curveSig = JSON.stringify({d: data, a: a, b: b, r: r2, t: document.documentElement.getAttribute('data-theme') || 'light'}); /* v54.319 fix: 加 theme 到 cache key */
 if(_curveChartInstance && _curveChartArgsCache === _curveSig){
 _curveChartInstance.resize();
 return;
}

 if(_curveChartInstance){ _curveChartInstance.destroy(); _curveChartInstance = null;}

 var scatterData = data.map(function(d){ return{ x: d.x, y: d.y};});

 var xMin = Math.min.apply(null, data.map(function(d){ return d.x;}));
 var xMax = Math.max.apply(null, data.map(function(d){ return d.x;}));
 var padding =(xMax - xMin) * 0.05 || 1;
 var lineX1 = xMin - padding;
 var lineX2 = xMax + padding;
 var lineData =[
{ x: lineX1, y: a * lineX1 + b},
{ x: lineX2, y: a * lineX2 + b}
];
 var ctx = canvas.getContext('2d');
 _curveChartInstance = new Chart(ctx,{
 type: 'scatter',
 data:{
 datasets:[
{
 label: i18n('chartDataPoint'),
 data: scatterData,
 backgroundColor: 'rgba(37, 99, 235, 0.8)',
 borderColor: 'rgba(37, 99, 235, 1)',
 borderWidth: 1.5,
 pointRadius: 5,
 pointHoverRadius: 7,
 pointStyle: 'circle',
 order: 1
},
{
 label: i18n('chartRegressionLine') + a.toPrecision(4) + 'x' +(b >= 0 ? '+' : '') + b.toPrecision(4) + '  R²=' + r2.toFixed(6),
 data: lineData,
 type: 'line',
 borderColor: 'rgba(220, 38, 38, 0.85)',
 borderWidth: 2,
 borderDash:[6, 3],
 pointRadius: 0,
 fill: false,
 tension: 0,
 order: 0
}

].concat(_curveBandDatasets(data, a, b))
},
 options:{
 responsive: true,
 maintainAspectRatio: false,
 animation:{ duration: 300},
 plugins:{
 legend:{
 display: true,
 position: 'top',
 labels:{
 font:{ size: 11},
 usePointStyle: true,
 padding: 12
}
},
 tooltip:{
 callbacks:{
 label: function(context){
 var pt = context.raw;
 return '(' + pt.x + ', ' + pt.y + ')';
}
},
 backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(248,250,252,0.95)' : 'rgba(30,41,59,0.9)',
 titleColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#fff',
 bodyColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#fff',
 borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#334155' : 'transparent',
 borderWidth: 1
}
},
 scales:{
 x:{
 title:{
 display: true,
 text: i18n('chartAxisX'),
 font:{ size: 13, weight: 'bold'},
 color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#475569'
},
 grid:{ color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'},
 ticks:{ color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#64748b', font:{ size: 11}}
},
 y:{
 title:{
 display: true,
 text: i18n('chartAxisY'),
 font:{ size: 13, weight: 'bold'},
 color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#475569'
},
 grid:{ color: document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'},
 ticks:{ color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#cbd5e1' : '#64748b', font:{ size: 11}}
}
}
}
});
 _curveChartArgsCache = _curveSig; // v54.245: 缓存 signature
 card.style.display = 'block';
 card.classList.remove('card-collapsed');
}

function createSampleModule(config){
 const{ dataArray, defaultParallel, defaultSampleParams ={}, renderFn} = config;
 const cloneParallel =() => JSON.parse(JSON.stringify(defaultParallel));
 const cloneSample =() =>{
 const base ={ parallels:[cloneParallel()]};
 return Object.assign(base, JSON.parse(JSON.stringify(defaultSampleParams)));
};
 return{
 addSample(){
 
 
 if(!Array.isArray(dataArray)){ _i18nToast('toast_dataArrayMissing', 'error'); return;}
 if(typeof renderFn !== 'function'){ _i18nToast('toast_renderFnMissing', 'error'); return;}
 dataArray.push(cloneSample());
 renderFn();
},
 addParallel(si){
 if(dataArray[si]){
 dataArray[si].parallels.push(cloneParallel());
 renderFn();
}
},
 removeParallel(si, pi){
 if(!dataArray[si]) return;
 if(dataArray[si].parallels.length <= 1){
 dataArray[si].parallels[0] = cloneParallel();
} else{
 dataArray[si].parallels.splice(pi, 1);
}
 renderFn();
},
 clearSample(si){
 if(dataArray[si]){
 dataArray[si].parallels =[cloneParallel()];
 renderFn();
}
},
 removeSample(si){
 if(dataArray.length > 1){
 dataArray.splice(si, 1);
 renderFn();
}
},
 updateParallel(si, pi, field, value){
 if(dataArray[si] && dataArray[si].parallels[pi]){
 dataArray[si].parallels[pi][field] = value;
 renderFn();
}
}
};
}
function registerModule(name, config){
 var mod = createSampleModule(config);
 var cap = name.charAt(0).toUpperCase() + name.slice(1);
 window['add' + cap + 'Sample'] = mod.addSample.bind(mod);
 window['add' + cap + 'Parallel'] = mod.addParallel.bind(mod);
 window['remove' + cap + 'Parallel'] = mod.removeParallel.bind(mod);
 window['clear' + cap + 'Sample'] = mod.clearSample.bind(mod);
 window['remove' + cap + 'Sample'] = mod.removeSample.bind(mod);
 window['update' + cap + 'Parallel'] = mod.updateParallel.bind(mod);
}


var _lastInputId=null;function _sf(){var el=document.activeElement;if(el&&el.dataset&&el.dataset.fi)_lastInputId=el.dataset.fi;}function _rf(cn){if(!_lastInputId||!cn)return;var el=cn.querySelector("[data-fi='"+_lastInputId+"']");if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){}}}

var _rafScheduled ={};
function _scheduleRender(name, fn){
 if(_rafScheduled[name]) return;
 _rafScheduled[name] = true;
 requestAnimationFrame(function(){ _rafScheduled[name] = false; fn();});
}
function renderDryingDebounced(){ _scheduleRender('drying', renderDrying);}
function renderResidueDebounced(){ _scheduleRender('residue', renderResidue);}
function renderTiterDebounced(){ _scheduleRender('titer', renderTiter);}
function renderContentDebounced(){ _scheduleRender('content', renderContent);}
function renderUniformityDebounced(){ _scheduleRender('uniformity', renderUniformity);}
function renderDissolutionDebounced(){ _scheduleRender('dissolution', renderDissolution);}
var dryingData =[];
function renderDrying(){ _sf();
 const container = document.getElementById('drying-samples');
 if(!container) return;
 if(!dryingData.length) dryingData.push({ parallels:[{w0:'',w1:'',w2:''}]});
 // v54.282 perf: hoist 外层 forEach 中 4 个 i18n 调用（v54.275 perf#6 漏了 outer loop）
 const _iSampleNum = i18n('sampleNum'), _iBoldAvg = i18n('boldAvg'), _iBoldResult = i18n('boldResult');
 let html = '';
 dryingData.forEach((sample, si) =>{
 if(!sample.parallels || !sample.parallels.length) sample.parallels =[{w0:'',w1:'',w2:''}];
 const losses =[];
 sample.parallels.forEach(p =>{
 const w0 = calcExpr(p.w0), w1 = calcExpr(p.w1), w2 = calcExpr(p.w2);
 if(Number.isFinite(w0)&&Number.isFinite(w1)&&Number.isFinite(w2)&&w0>0&&w1>w0&&w2<w1){
 const loss =(w1-w2)/(w1-w0)*100;
 if(loss>=0&&loss<=100) losses.push(loss);
}
});
 sample._losses = losses;
 const _st=calcStatsFromArray(losses);const n=_st.n,mean=_st.mean,sd=_st.sd,rsd=_st.rsd;
 html += '<div class="drying-sample sample-row mb-10">';
 html += '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">';
 html += _iSampleNum +(si+1); /* v54.282 perf: hoist */
 html += '<span><button class="btn btn-danger btn-xs" onclick="clearDryingSample('+si+')" style="margin-right:4px" data-i18n="clearThisSample">清空本样</button><button class="btn btn-danger btn-xs" onclick="removeDryingSample('+si+')" style="border-color:#999;color:#666" data-i18n="btnDelete">删除</button></span>';
 html += '</div>';
 html += '<table class="matrix-table"><thead><tr><th scope="col" data-i18n="th-seq">序号</th><th scope="col" data-i18n="thDryingW0">W₀(mg)</th><th scope="col" data-i18n="thDryingW1">W₁(mg)</th><th scope="col" data-i18n="thDryingW2">W₂(mg)</th><th scope="col" data-i18n="lblLossPct">干燥失重%</th><th scope="col" data-i18n="th-op">操作</th></tr></thead><tbody>';
 /* v54.272 perf: hoist i18n() calls out of inner parallels loop (was 4 × N × M lookups) */
 const _dryingW0 = i18n('thDryingW0'), _dryingW1 = i18n('thDryingW1'), _dryingW2 = i18n('thDryingW2'), _ariaRmPar = i18n('ariaRemoveParallel');
 sample.parallels.forEach((p, pi) =>{
 const loss = pi < losses.length ? losses[pi] : NaN;
 html += '<tr><td>'+(pi+1)+'</td>';
 html += '<td><input type="text" inputmode="decimal" class="dry-w0" value="'+_esc(p.w0)+'" placeholder="0" oninput="updateDryingParallel('+si+','+pi+',\'w0\',this.value)" data-fi="'+si+'-'+pi+'-w0" aria-label="' + _esc(_dryingW0) + '" data-i18n-aria-label="thDryingW0"></td>';
 html += '<td><input type="text" inputmode="decimal" class="dry-w1" value="'+_esc(p.w1)+'" placeholder="0" oninput="updateDryingParallel('+si+','+pi+',\'w1\',this.value)" data-fi="'+si+'-'+pi+'-w1" aria-label="' + _esc(_dryingW1) + '" data-i18n-aria-label="thDryingW1"></td>';
 html += '<td><input type="text" inputmode="decimal" class="dry-w2" value="'+_esc(p.w2)+'" placeholder="0" oninput="updateDryingParallel('+si+','+pi+',\'w2\',this.value)" data-fi="'+si+'-'+pi+'-w2" aria-label="' + _esc(_dryingW2) + '" data-i18n-aria-label="thDryingW2"></td>';
 html += '<td class="result-col">'+(Number.isFinite(loss)?fmtNum(loss)+'%':'—')+'</td>';
 html += '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeDryingParallel('+si+','+pi+')" aria-label="' + _esc(_ariaRmPar) + '" data-i18n-aria-label="ariaRemoveParallel">-</button></td></tr>'; /* v54.282 perf: 复用 _ariaRmPar 不重复 i18n */
});
 html += '</tbody></table>';
 html += '<div style="font-size:12px;margin-top:4px;padding:6px;background:#f8fafc;border-radius:6px">';
 if(n>=2) html += '' + _iBoldAvg + fmtNum(mean) + '%</b>  SD='+fmtNum(sd)+'  RSD='+fmtNum(rsd)+'%'; /* v54.282 perf: hoist */
 else if(n===1) html += '' + _iBoldResult + fmtNum(losses[0]) + '%</b>'; /* v54.282 perf: hoist */
 else html += '—';
 html += '</div>';
 html += '<button class="btn btn-outline btn-xs mt-4" onclick="addDryingParallel('+si+')" data-i18n="addParallel">+ 添加平行样</button>';
 html += '</div>';
});
 // v54.246 perf: 用 DocumentFragment 批量插入代替 innerHTML= 大字符串（避免每次重 build parser，单次 reflow）
 const _fragWrap = document.createElement('div');
 _fragWrap.innerHTML = html;
 const _frag = document.createDocumentFragment();
 while(_fragWrap.firstChild){ _frag.appendChild(_fragWrap.firstChild);}
 container.innerHTML = '';
 container.appendChild(_frag);
 _rf(container);
}
registerModule('drying',{ dataArray: dryingData, defaultParallel:{w0:'',w1:'',w2:''}, renderFn: renderDryingDebounced});
async function clearDrying(){ if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return; dryingData.length = 0; renderDrying();}
function saveDryingHistory(){
 
 
 
 if(!dryingData.length){ _i18nAlert('dryingEmpty'); return false;}
 const allLosses =[];
 dryingData.forEach(s =>{
(s.parallels||[]).forEach(p =>{
 const w0=calcExpr(p.w0),w1=calcExpr(p.w1),w2=calcExpr(p.w2);
 if(Number.isFinite(w0)&&Number.isFinite(w1)&&Number.isFinite(w2)&&w0>0&&w1>w0&&w2<w1){
 const loss =(w1-w2)/(w1-w0)*100;
 if(loss>=0&&loss<=100) allLosses.push(loss);
}
});
});
 const st = calcStatsFromArray(allLosses);
 const entry ={
 time: _formatNow(),
 type: '干燥失重',
 mean: st.mean!==null ? st.mean.toFixed(4) : '',
 sd: st.sd!==null ? st.sd.toFixed(6) : '',
 rsd: st.rsd!==null ? st.rsd.toFixed(4) : '',
 count: allLosses.length,
 samples: dryingData.map(s =>({
 parallels: s.parallels.map(p =>({w0:p.w0||'',w1:p.w1||'',w2:p.w2||''}))
})).filter(s => s.parallels.length > 0)
};
 if(!entry.samples.length){ _i18nAlert('sampleEmpty'); return false;}
 
 return _saveWithSampleIdPrompt(entry, function(){ flashEl('dry-result', i18n('flashSavedToHistory'));});
}

var residueData =[];
function renderResidue(){ _sf();
 const container = document.getElementById('residue-samples');
 if(!container) return;
 if(!residueData.length) residueData.push({ parallels:[{w0:'',w1:'',w2:''}]});
 // v54.274 perf#6: hoist 循环内常量 i18n 调用（每个 sample × parallel 重复调用）
 const _iSampleNum = i18n('sampleNum'), _iW0 = i18n('thResidueW0'), _iW1 = i18n('thResidueW1'), _iW2 = i18n('thResidueW2');
 const _iRmParallel = i18n('ariaRemoveParallel'), _iBoldAvg = i18n('boldAvg'), _iBoldResult = i18n('boldResult');
 let html = '';
 residueData.forEach((sample, si) =>{
 if(!sample.parallels || !sample.parallels.length) sample.parallels =[{w0:'',w1:'',w2:''}];
 const vals =[];
 sample.parallels.forEach(p =>{
 const w0 = calcExpr(p.w0), w1 = calcExpr(p.w1), w2 = calcExpr(p.w2);
 if(Number.isFinite(w0)&&Number.isFinite(w1)&&Number.isFinite(w2)&&w0>0&&w1>w0&&w2>=w0){
 const v =(w2-w0)/(w1-w0)*100;
 if(v>=0&&v<=100) vals.push(v);
}
});
 const _st=calcStatsFromArray(vals);const n=_st.n,mean=_st.mean,sd=_st.sd,rsd=_st.rsd;
 html += '<div class="residue-sample sample-row mb-10">';
 html += '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">';
 html += _iSampleNum +(si+1);
 html += '<span><button class="btn btn-danger btn-xs" onclick="clearResidueSample('+si+')" style="margin-right:4px" data-i18n="clearThisSample">清空本样</button><button class="btn btn-danger btn-xs" onclick="removeResidueSample('+si+')" style="border-color:#999;color:#666" data-i18n="btnDelete">删除</button></span>';
 html += '</div>';
 html += '<table class="matrix-table"><thead><tr><th scope="col" data-i18n="th-seq">序号</th><th scope="col" data-i18n="thResidueW0">坩埚恒重 W₀(mg)</th><th scope="col" data-i18n="thResidueW1">坩埚+样品 W₁(mg)</th><th scope="col" data-i18n="thResidueW2">炽灼后重 W₂(mg)</th><th scope="col" data-i18n="lblResiduePct">炽灼残渣%</th><th scope="col" data-i18n="th-op">操作</th></tr></thead><tbody>';
 sample.parallels.forEach((p, pi) =>{
 const v = pi < vals.length ? vals[pi] : NaN;
 html += '<tr><td>'+(pi+1)+'</td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.w0)+'" placeholder="0" oninput="updateResidueParallel('+si+','+pi+',\'w0\',this.value)" aria-label="' + _esc(_iW0) + '" data-i18n-aria-label="thResidueW0" data-fi="'+si+'-'+pi+'-w0"></td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.w1)+'" placeholder="0" oninput="updateResidueParallel('+si+','+pi+',\'w1\',this.value)" aria-label="' + _esc(_iW1) + '" data-i18n-aria-label="thResidueW1" data-fi="'+si+'-'+pi+'-w1"></td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.w2)+'" placeholder="0" oninput="updateResidueParallel('+si+','+pi+',\'w2\',this.value)" aria-label="' + _esc(_iW2) + '" data-i18n-aria-label="thResidueW2" data-fi="'+si+'-'+pi+'-w2"></td>';
 html += '<td class="result-col">'+(Number.isFinite(v)?fmtNum(v)+'%':'—')+'</td>';
 html += '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeResidueParallel('+si+','+pi+')" aria-label="' + _esc(_iRmParallel) + '" data-i18n-aria-label="ariaRemoveParallel">-</button></td></tr>';
});
 html += '</tbody></table>';
 html += '<div style="font-size:12px;margin-top:4px;padding:6px;background:#f8fafc;border-radius:6px">';
 if(n>=2) html += '' + _iBoldAvg + fmtNum(mean) + '%</b>  SD='+fmtNum(sd)+'  RSD='+fmtNum(rsd)+'%';
 else if(n===1) html += '' + _iBoldResult + fmtNum(vals[0]) + '%</b>';
 else html += '—';
 html += '</div>';
 html += '<button class="btn btn-outline btn-xs mt-4" onclick="addResidueParallel('+si+')" data-i18n="addParallel">+ 添加平行样</button>';
 html += '</div>';
});
 // v54.246 perf: 用 DocumentFragment 批量插入代替 innerHTML= 大字符串
 const _fragWrap = document.createElement('div');
 _fragWrap.innerHTML = html;
 const _frag = document.createDocumentFragment();
 while(_fragWrap.firstChild){ _frag.appendChild(_fragWrap.firstChild);}
 container.innerHTML = '';
 container.appendChild(_frag);
 _rf(container);
}
registerModule('residue',{ dataArray: residueData, defaultParallel:{w0:'',w1:'',w2:''}, renderFn: renderResidueDebounced});
async function clearResidue(){ if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return; residueData.length = 0; renderResidue();}
function saveResidueHistory(){
 
 if(!residueData.length){ _i18nAlert('residueEmpty'); return false;}
 const allVals =[];
 residueData.forEach(s =>{
(s.parallels||[]).forEach(p =>{
 const w0=calcExpr(p.w0),w1=calcExpr(p.w1),w2=calcExpr(p.w2);
 if(Number.isFinite(w0)&&Number.isFinite(w1)&&Number.isFinite(w2)&&w0>0&&w1>w0&&w2>=w0){
 const v =(w2-w0)/(w1-w0)*100;
 if(v>=0&&v<=100) allVals.push(v);
}
});
});
 const st = calcStatsFromArray(allVals);
 const entry ={
 time: _formatNow(), type: '炽灼残渣',
 mean: st.mean!==null ? st.mean.toFixed(4) : '',
 sd: st.sd!==null ? st.sd.toFixed(6) : '',
 rsd: st.rsd!==null ? st.rsd.toFixed(4) : '',
 count: allVals.length,
 samples: residueData.map(s =>({
 parallels: s.parallels.map(p =>({w0:p.w0||'',w1:p.w1||'',w2:p.w2||''}))
})).filter(s => s.parallels.length > 0)
};
 if(!entry.samples.length){ _i18nAlert('sampleEmpty'); return false;}
 return _saveWithSampleIdPrompt(entry, function(){ flashEl('res-result', i18n('flashSavedToHistory'));});
}

var titerData =[];
function renderTiter(){ _sf();
 const container = document.getElementById('titer-samples');
 if(!container) return;
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? e.value : '';};
 const vs=calcExpr(gv('titer-vs'));
 const v0s=calcExpr(gv('titer-v0s'));
 const ms=calcExpr(_mgInput('titer-ms'));
 const ps=calcExpr(gv('titer-ps'))||100;
 const f=calcExpr(gv('titer-f'))||1;
 const manualT=calcExpr(gv('titer-t'));
 let T = manualT;
 // v54.239 fix: vs<v0s 时 T 变负（物理不可能 — 滴定消耗不能小于空白）。加 vs>v0s 守卫
 if(!Number.isFinite(T) && Number.isFinite(vs) && Number.isFinite(v0s) && Number.isFinite(ms) && ms>0 && (vs-v0s) > 0){
 T = f * ms *(ps/100) /(vs - v0s);
 // v54.255 defensive: 兜底检查 T 是否 finite + 物理合理性（T > 1e10 mg/mL 视为不可能 — 远超任何已知滴定度）
 if(!Number.isFinite(T) || T > 1e10 || T < -1e10) T = NaN;
}
 const tVal = document.getElementById('titer-t-val');
 const tEl = document.getElementById('titer-t');
 if(tVal) tVal.textContent = Number.isFinite(T) ? fmtNum(T) : (tEl && tEl.value ? _iErr : '—');
 if(!titerData.length) titerData.push({parallels:[{w:'',v0:'',v:''}]});
 // v54.274 perf#6: hoist 循环内常量 i18n 调用
 const _iSampleNum = i18n('sampleNum'), _iSW = i18n('lblSampleWeightNoSpace');
 const _iV0 = i18n('lblTiterV0'), _iV = i18n('lblTiterV'), _iRmP = i18n('ariaRemoveParallel');
 const _iBAvg = i18n('boldAvg'), _iBRes = i18n('boldResult');
 const _iPF = i18n('placeholderFirstRow'), _iErr = i18n('uiFormulaError');
 let html = '';
 titerData.forEach((sample, si) =>{
 if(!sample.parallels||!sample.parallels.length) sample.parallels =[{w:'',v0:'',v:''}];
 const firstV0 = parseFloat(sample.parallels[0].v0) || 0;
 const vals =[];
 sample.parallels.forEach((p) =>{
 // v54.242 fix: V0=0 是合法值（如空白实验），用 `||` 会把 0 替换成 firstV0（破坏原状态）。
 // 用 Number.isFinite 判断 NaN/Infinity 而非 0。
 const W=calcExpr(_mgFromString(p.w)), _v0=calcExpr(p.v0), V=calcExpr(p.v);
 const V0 = Number.isFinite(_v0) ? _v0 : firstV0;
 if(Number.isFinite(W)&&W>0&&Number.isFinite(V)&&Number.isFinite(T)&&T>0){
 const c =(V-V0)*T/W*100;
 if(c>=0&&c<=200) vals.push(c);
}
});
 const _st=calcStatsFromArray(vals);const n=_st.n,mean=_st.mean,sd=_st.sd,rsd=_st.rsd;
 html += '<div class="titer-sample sample-row mb-10">';
 html += '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">';
 html += _iSampleNum +(si+1);
 html += '<span><button class="btn btn-danger btn-xs" onclick="clearTiterSample('+si+')" style="margin-right:4px" data-i18n="clearThisSample">清空本样</button><button class="btn btn-danger btn-xs" onclick="removeTiterSample('+si+')" style="border-color:#999;color:#666" data-i18n="btnDelete">删除</button></span>';
 html += '</div>';
 html += '<div style="font-size:12px;color:var(--primary);margin:4px 0">T = '+(Number.isFinite(T)?fmtNum(T):'—')+' '+_weightUnitSuffix()+'/mL</div>';
 html += '<table class="matrix-table"><thead><tr><th scope="col" data-i18n="th-seq">序号</th><th scope="col" data-i18n="lblSampleWeightNoSpace">称样量(mg)</th><th scope="col" data-i18n="lblTiterV0">V₀(mL)</th><th scope="col" data-i18n="lblTiterV">V(mL)</th><th scope="col" data-i18n="lblContentPct">含量%</th><th scope="col" data-i18n="th-op">操作</th></tr></thead><tbody>';
 sample.parallels.forEach((p, pi) =>{
 const c = pi < vals.length ? vals[pi] : NaN;
 html += '<tr><td>'+(pi+1)+'</td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.w)+'" placeholder="0" oninput="updateTiterParallel('+si+','+pi+',\'w\',this.value)" aria-label="' + _esc(_iSW) + '" data-i18n-aria-label="lblSampleWeightNoSpace" data-fi="'+si+'-'+pi+'-w"></td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.v0)+'" placeholder="'+_esc(_iPF)+':'+fmtNum(firstV0)+'" oninput="updateTiterParallel('+si+','+pi+',\'v0\',this.value)" aria-label="' + _esc(_iV0) + '" data-i18n-aria-label="lblTiterV0" data-fi="'+si+'-'+pi+'-v0"></td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.v)+'" placeholder="0" oninput="updateTiterParallel('+si+','+pi+',\'v\',this.value)" aria-label="' + _esc(_iV) + '" data-i18n-aria-label="lblTiterV" data-fi="'+si+'-'+pi+'-v"></td>';
 html += '<td class="result-col">'+(Number.isFinite(c)?fmtNum(c)+'%':'—')+'</td>';
 html += '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeTiterParallel('+si+','+pi+')" aria-label="' + _esc(_iRmP) + '" data-i18n-aria-label="ariaRemoveParallel">-</button></td></tr>';
});
 html += '</tbody></table>';
 html += '<div style="font-size:12px;margin-top:4px;padding:6px;background:#f8fafc;border-radius:6px">';
 if(n>=2) html += '' + _iBAvg + fmtNum(mean) + '%</b>  SD='+fmtNum(sd)+'  RSD='+fmtNum(rsd)+'%';
 else if(n===1) html += '' + _iBRes + fmtNum(vals[0]) + '%</b>';
 else html += '—';
 html += '</div>';
 html += '<button class="btn btn-outline btn-xs mt-4" onclick="addTiterParallel('+si+')" data-i18n="addParallel">+ 添加平行样</button>';
 html += '</div>';
});
 // v54.246 perf: 用 DocumentFragment 批量插入代替 innerHTML= 大字符串
 const _fragWrap = document.createElement('div');
 _fragWrap.innerHTML = html;
 const _frag = document.createDocumentFragment();
 while(_fragWrap.firstChild){ _frag.appendChild(_fragWrap.firstChild);}
 container.innerHTML = '';
 container.appendChild(_frag);
 _rf(container);
}
registerModule('titer',{ dataArray: titerData, defaultParallel:{w:'',v0:'',v:''}, defaultSampleParams:{titer:'',factor:'1'}, renderFn: renderTiterDebounced});
function updateTiterParam(si,field,val){if(titerData[si]){titerData[si][field]=val;renderTiter();}}
async function clearTiter(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
['titer-vs','titer-v0s','titer-ms','titer-ps','titer-f','titer-t'].forEach(id=>{const el=document.getElementById(id); if(el) el.value='';});
 titerData.length=0;
 renderTiter();
}
function saveTiterHistory(){
 
 if(!titerData.length){ _i18nAlert('titerEmpty'); return false;}
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? e.value : '';};
 const vs=gv('titer-vs');
 const v0s=gv('titer-v0s');
 const ms=gv('titer-ms');
 const ps=gv('titer-ps');
 const fv=gv('titer-f');
 const tv=gv('titer-t');
 
 const methodId = gv('titer-method-select');
 const methodObj = PHARMA_TITER.find(m => m.id === methodId);
 const entry={time:_formatNow(),type:'滴定度',vs,v0s,ms,ps,f:fv,T:tv,
 method: methodId, titerName: methodObj ? methodObj.name : '', mEq: methodObj ? methodObj.m_eq : null, calibratedAt: Date.now(),
 samples:titerData.map(s=>({
 parallels:s.parallels.filter(p=>p.w||p.v||p.v0).map(p=>({w:p.w,v0:p.v0,v:p.v}))
})).filter(s=>s.parallels.length>0)
};
 if(!entry.samples.length){ _i18nAlert('sampleEmpty'); return false;}

// v54.228 fix: 原内嵌逻辑使用 `_enableSampleIdPrompt === undefined` 条件（与 v54.223 修复前的 buggy 模式一致）
// 当 _enableSampleIdPrompt 未定义（默认）时，默认走 prompt 流程但 prompt 永远不被响应，addH 不执行
// 修复：复用 v54.223 已验证的 _saveWithSampleIdPrompt helper（条件已改为 `_enableSampleIdPrompt === true`）
var _titerAfterFn = function(){
  if(typeof renderTiterTrend === 'function') renderTiterTrend();
  if(typeof renderTiterStatCards === 'function') renderTiterStatCards();
};
return _saveWithSampleIdPrompt(entry, _titerAfterFn);
}

function switchMw(type){
 
 
 
 
 const validTypes =['dry', 'anhydrous', 'solvent', 'freebase'];
 if(!validTypes.includes(type)){
 _i18nToast('toast_switchMwInvalid', 'warn', 2500, type, validTypes.join('/'));
 return;
}
 document.querySelectorAll('#sp-mw .subtab').forEach((t,i)=>{
 const isActive = validTypes.indexOf(type)===i;
 t.classList.toggle('active', isActive);
 // v54.230 a11y
 t.setAttribute('aria-selected', isActive ? 'true' : 'false');
 t.setAttribute('tabindex', isActive ? '0' : '-1');
});
 document.querySelectorAll('.mw-type').forEach(m=>m.style.display='none');
 
 const mwEl = document.getElementById('mw-'+type);
 if(mwEl) mwEl.style.display='block'; else _i18nToast('toast_mwContainerMissingFmt', 'error', null, type);
 var formulas ={'dry':i18n('formulaContentAnhydrous'),'anhydrous':i18n('formulaContentAnhydrousMol'),'solvent':i18n('formulaContentSolvent'),'freebase':i18n('formulaContentFreebase')};
 var el = document.getElementById('mw-formula'); if(el) el.textContent = formulas[type]||'';
 calcMw();
}
function calcMw(){
 
 const gv =(sel) =>{ const e = document.querySelector(sel); return e ? e.value : '';};
 const gvN =(sel) =>{ const e = document.querySelector(sel); return e ? calcExpr(e.value) : NaN;};
 var type = 'dry';
 // v54.236 fix: 用 data-type 属性取激活态（i18n 后 textContent 不再是中文键，避免永远 fallback 到 dry）
 const activeMw = document.querySelector('#sp-mw .subtab.active');
 if(activeMw && activeMw.dataset.type) type = activeMw.dataset.type;
 if(!['dry','anhydrous','solvent','freebase'].includes(type)) type = 'dry';
 
 const typeEl = document.querySelector('#mw-'+type);
 if(!typeEl){ _i18nToast('toast_mwContainerMissingFmt', 'error', null, type); return;}
 const val = calcExpr(gv('#mw-'+type+' .mw-val'));
 const out = document.getElementById('mw-out');
 const box = document.getElementById('mw-result');
 let result = NaN;
 if(!Number.isFinite(val)){ if(box) box.style.display='none'; return;}
 if(type === 'dry'){
  const w = gvN('#mw-dry .mw-water')||0;
  const s = gvN('#mw-dry .mw-solvent')||0;
  // v54.228 fix: w+s=100 时 1-(w+s)/100=0，结果是 Infinity（之前被 fmtNum 显示为 "Infinity"）
  // v54.239 fix: 额外守卫 w+s>100（负的 _dryDenom） → result 是负 MW，物理不可能
  const _dryDenom = 1 - (w+s)/100;
  if(Math.abs(_dryDenom) < 1e-10 || _dryDenom < 0){
    if(typeof _i18nToast === 'function') _i18nToast('toast_mwInvalid', 'warn', 3000);
    if(box) box.style.display = 'none';
    return;
  }
  result = val / _dryDenom;
} else if(type === 'anhydrous'){
 const ma = gvN('#mw-anhydrous .mw-ma');
 const mh = gvN('#mw-anhydrous .mw-mh');
 if(Number.isFinite(ma)&&ma>0&&Number.isFinite(mh)&&mh>0) result = val * ma / mh;
} else if(type === 'solvent'){
 const s = gvN('#mw-solvent .mw-solvent')||0;
 // v54.228 fix: s=100 时分母为 0
 const _solDenom = 1 - s/100;
  // v54.239 fix: s>100 时 _solDenom 为负 → result 负 MW
  if(Math.abs(_solDenom) < 1e-10 || _solDenom < 0){
    if(typeof _i18nToast === 'function') _i18nToast('toast_mwInvalid', 'warn', 3000);
    if(box) box.style.display = 'none';
    return;
  }
  result = val / _solDenom;
} else if(type === 'freebase'){
 const mb = gvN('#mw-freebase .mw-mb');
 const ms = gvN('#mw-freebase .mw-ms');
 if(Number.isFinite(mb)&&mb>0&&Number.isFinite(ms)&&ms>0) result = val * mb / ms;
}
 if(Number.isFinite(result)&&result>0){
 if(out) out.textContent = fmtNum(result);
 if(box) box.style.display = 'grid';
} else{ if(box) box.style.display = 'none';}
}
async function clearMw(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const resultEl = document.getElementById('mw-result');
 document.querySelectorAll('#sp-mw input').forEach(i=>i.value='');
 if(resultEl) resultEl.style.display='none';
}
/* v54.281 fix (correctness): saveMwHistory 之前未定义（registerModule 引用 → Ctrl+S 弹 toast_noSaveableContent） */
function saveMwHistory(){
 const gv =(sel) =>{ const e = document.querySelector(sel); return e ? e.value : '';};
 const type = (() =>{ const a = document.querySelector('#sp-mw .subtab.active'); return (a && a.dataset.type) || 'dry';})();
 const resultEl = document.getElementById('mw-out');
 const result = resultEl ? calcExpr(resultEl.textContent) : NaN;
 if(!Number.isFinite(result) || result <= 0){ _i18nAlert('noValidNumbers'); return false;}
 const entry ={ type:'分子量计算', subtype: type, time:_formatNow(), result: result.toFixed(4) };
 return _saveWithSampleIdPrompt(entry, function(){ flashEl('mw-result', i18n('flashSavedShort'));});
}

var uniformityData =[];
function renderUniformity(){ _sf();
 var container = document.getElementById('uniformity-samples');
 if(!container) return;
 if(!uniformityData.length) uniformityData.push({parallels:[{content:''}]});

 var limitEl = document.getElementById('uni-limit');
 var L = parseFloat(limitEl ? limitEl.value : 15) || 15;
 // v54.274 perf#6: hoist 循环内常量 i18n 调用
 var _iSampleNum = i18n('sampleNum'), _iHMean2 = i18n('hMeanShort2'), _iHRes = i18n('hResultShort');
 var _iContPct = i18n('lblContentPct'), _iRmP = i18n('ariaRemoveParallel');
 var _iBAvg = i18n('boldAvg'), _iBRes = i18n('boldResult');
 var allContents =[];
 var html = '';
 uniformityData.forEach(function(sample, si){
 if(!sample.parallels||!sample.parallels.length) sample.parallels =[{content:''}];
 var vals =[];
 sample.parallels.forEach(function(p){
 var c = calcExpr(p.content);
 if(Number.isFinite(c)&&c>0&&c<200) vals.push(c);
});
 for(var _k=0; _k<vals.length; _k++) allContents.push(vals[_k]);
 var _st = calcStatsFromArray(vals); var n=_st.n, mean=_st.mean, sd=_st.sd, rsd=_st.rsd;
 html += '<div class="uniformity-sample sample-row mb-10">';
 html += '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">';
 html += _iSampleNum +(si+1);
 html += '<span style="font-size:12px;color:var(--text-light)">';
 if(n>=2) html += _iHMean2+fmtNum(mean)+'% SD='+fmtNum(sd)+' RSD='+fmtNum(rsd)+'%';
 else if(vals.length === 1 && Number.isFinite(vals[0])) html += _iHRes+fmtNum(vals[0])+'%';
 else html += '—';
 html += '</span>';
 html += '<span><button class="btn btn-danger btn-xs" onclick="clearUniformitySample('+si+')" style="margin-right:4px" data-i18n="clearThisSample">清空本样</button><button class="btn btn-danger btn-xs" onclick="removeUniformitySample('+si+')" style="border-color:#999;color:#666" data-i18n="btnDelete">删除</button></span>';
 html += '</div>';
 html += '<table class="matrix-table"><thead><tr><th scope="col" data-i18n="th-seq">序号</th><th scope="col" data-i18n="lblContentPct">含量(%)</th><th scope="col" data-i18n="th-op">操作</th></tr></thead><tbody>';
 sample.parallels.forEach(function(p, pi){
 var c = pi<vals.length?vals[pi]:NaN;
 html += '<tr><td>'+(pi+1)+'</td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.content)+'" placeholder="0" oninput="updateUniformityParallel('+si+','+pi+',\'content\',this.value)" aria-label="' + _esc(_iContPct) + '" data-i18n-aria-label="lblContentPct" data-fi="'+si+'-'+pi+'-u"></td>';
 html += '<td class="result-col">'+(Number.isFinite(c)?fmtNum(c)+'%':'—')+'</td>';
 html += '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeUniformityParallel('+si+','+pi+')" aria-label="' + _esc(_iRmP) + '" data-i18n-aria-label="ariaRemoveParallel">-</button></td></tr>';
});
 html += '</tbody></table>';
 html += '<div style="font-size:12px;margin-top:4px;padding:6px;background:#f8fafc;border-radius:6px">';
 if(n>=2) html += '' + _iBAvg + fmtNum(mean) + '%</b>  SD='+fmtNum(sd)+'  RSD='+fmtNum(rsd)+'%';
 else if(vals.length === 1 && Number.isFinite(vals[0])) html += '' + _iBRes + fmtNum(vals[0]) + '%</b>';
 else html += '—';
 html += '</div>';
 html += '<button class="btn btn-outline btn-xs mt-4" onclick="addUniformityParallel('+si+')" data-i18n="addParallel">+ 添加平行样</button>';
 html += '</div>';
});
 // v54.246 perf: 用 DocumentFragment 批量插入代替 innerHTML= 大字符串
 const _fragWrap = document.createElement('div');
 _fragWrap.innerHTML = html;
 const _frag = document.createDocumentFragment();
 while(_fragWrap.firstChild){ _frag.appendChild(_fragWrap.firstChild);}
 container.innerHTML = '';
 container.appendChild(_frag);
 _rf(container);

 var box = document.getElementById('uni-result');
  if(allContents.length >= 10){
  var _st2 = calcStatsFromArray(allContents);
  var xbar = _st2.mean;
  var A = Math.abs(100 - xbar);
  var S = _st2.sd;
  // v54.239 fix: ChP 0941 / USP <905> Stage 1 用 2.2S，Stage 2 (n=30) 用 1.9S
  var coef = allContents.length >= 30 ? 1.9 : 2.2;
  var AS = A + coef * S;
  var pass = AS <= L;
 document.getElementById('uni-mean').textContent = fmtNum(xbar);
 document.getElementById('uni-a').textContent = fmtNum(A);
 document.getElementById('uni-s').textContent = fmtNum(S);
 document.getElementById('uni-as').textContent = fmtNum(AS);
 var vd = document.getElementById('uni-verdict');
 vd.textContent = pass?i18n('uiPass'):i18n('uiFail');
 vd.style.color = pass?'var(--success)':'var(--danger)';
 box.style.display = 'grid';
} else if(allContents.length >= 1){
 document.getElementById('uni-mean').textContent = i18n('uniMeanSamplesFmt').replace('{0}', allContents.length);
 document.getElementById('uni-a').textContent = '—';
 document.getElementById('uni-s').textContent = '—';
 document.getElementById('uni-as').textContent = '—';
 document.getElementById('uni-verdict').textContent = '—';
 box.style.display = 'grid';
} else{ box.style.display = 'none';}
}
function calcUniformity(){ renderUniformity();}
/* v54.281 fix (correctness): calcDrying 之前未定义（registerModule 引用 'calcDrying' → Ctrl+Enter 弹 toast_noCalcOnPage）。trivial wrapper 与 calcUniformity / calcDissolution 一致 */
function calcDrying(){ renderDrying();}
registerModule('uniformity',{ dataArray: uniformityData, defaultParallel:{content:''}, renderFn: renderUniformityDebounced});
async function clearUniformity(){ if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return; uniformityData.length=0; document.getElementById('uni-result').style.display='none'; renderUniformity();}
function saveUniformityHistory(){
 
 if(!uniformityData.length){ _i18nAlert('uniformityEmpty'); return false;}
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? e.value : '';};
 const gt =(id) =>{ const e = document.getElementById(id); return e ? e.textContent : '';};
 var entry ={time:_formatNow(),type:'含量均匀度',
 L:gv('uni-limit'),
 xbar:gt('uni-mean'),
 A:gt('uni-a'),
 S:gt('uni-s'),
 AS:gt('uni-as'),
 verdict:gt('uni-verdict'),
 samples:uniformityData.map(function(s){return{
 parallels:s.parallels.filter(function(p){return p.content}).map(function(p){return{content:p.content}})
};}).filter(function(s){return s.parallels.length>0})
};
 if(!entry.samples.length){ _i18nAlert('sampleEmpty'); return false;}
 return _saveWithSampleIdPrompt(entry);
}

var dissolutionData =[];
function renderDissolution(){ _sf();
 var container = document.getElementById('dissolution-samples');
 if(!container) return;
 if(!dissolutionData.length) dissolutionData.push({parallels:[{content:''}]});

 var labelEl = document.getElementById('diss-label');
 var label = parseFloat(labelEl ? labelEl.value : 100) || 100;
 // v54.274 perf#6: hoist 循环内常量 i18n 调用
 var _iSampleNum = i18n('sampleNum'), _iHMean2 = i18n('hMeanShort2'), _iHRes = i18n('hResultShort');
 var _iDMC = i18n('lblDissMeasuredContent'), _iRmP = i18n('ariaRemoveParallel');
 var _iBAvg = i18n('boldAvg'), _iBRes = i18n('boldResult');
 var allContents =[];
 var html = '';
 dissolutionData.forEach(function(sample, si){
 if(!sample.parallels||!sample.parallels.length) sample.parallels =[{content:''}];
 var vals =[];
 sample.parallels.forEach(function(p){
 var c = calcExpr(p.content);
 if(Number.isFinite(c)&&c>0&&label>0) vals.push(c/label*100);
});
 for(var _k=0; _k<vals.length; _k++) allContents.push(vals[_k]);
 var _st = calcStatsFromArray(vals); var n=_st.n, mean=_st.mean, sd=_st.sd, rsd=_st.rsd;
 html += '<div class="dissolution-sample sample-row mb-10">';
 html += '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">';
 html += _iSampleNum +(si+1);
 html += '<span style="font-size:12px;color:var(--text-light)">';
 if(n>=2) html += _iHMean2+fmtNum(mean)+'% SD='+fmtNum(sd)+' RSD='+fmtNum(rsd)+'%';
 else if(vals.length === 1 && Number.isFinite(vals[0])) html += _iHRes+fmtNum(vals[0])+'%';
 else html += '—';
 html += '</span>';
 html += '<span><button class="btn btn-danger btn-xs" onclick="clearDissolutionSample('+si+')" style="margin-right:4px" data-i18n="clearThisSample">清空本样</button><button class="btn btn-danger btn-xs" onclick="removeDissolutionSample('+si+')" style="border-color:#999;color:#666" data-i18n="btnDelete">删除</button></span>';
 html += '</div>';
 html += '<table class="matrix-table"><thead><tr><th scope="col" data-i18n="th-seq">序号</th><th scope="col" data-i18n="lblDissMeasuredContent">实测含量(%)</th><th scope="col" data-i18n="lblDissolutionPct">溶出度%</th><th scope="col" data-i18n="th-op">操作</th></tr></thead><tbody>';
 sample.parallels.forEach(function(p, pi){
 var c = pi<vals.length?vals[pi]:NaN;
 html += '<tr><td>'+(pi+1)+'</td>';
 html += '<td><input type="text" inputmode="decimal" value="'+_esc(p.content)+'" placeholder="0" oninput="updateDissolutionParallel('+si+','+pi+',\'content\',this.value)" aria-label="' + _esc(_iDMC) + '" data-i18n-aria-label="lblDissMeasuredContent" data-fi="'+si+'-'+pi+'-diss"></td>';
 html += '<td class="result-col">'+(Number.isFinite(c)?fmtNum(c)+'%':'—')+'</td>';
 html += '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeDissolutionParallel('+si+','+pi+')" aria-label="' + _esc(_iRmP) + '" data-i18n-aria-label="ariaRemoveParallel">-</button></td></tr>';
});
 html += '</tbody></table>';
 html += '<div style="font-size:12px;margin-top:4px;padding:6px;background:#f8fafc;border-radius:6px">';
 if(n>=2) html += '' + _iBAvg + fmtNum(mean) + '%</b>  SD='+fmtNum(sd)+'  RSD='+fmtNum(rsd)+'%';
 else if(vals.length === 1 && Number.isFinite(vals[0])) html += '' + _iBRes + fmtNum(vals[0]) + '%</b>';
 else html += '—';
 html += '</div>';
 html += '<button class="btn btn-outline btn-xs mt-4" onclick="addDissolutionParallel('+si+')" data-i18n="addParallel">+ 添加平行样</button>';
 html += '</div>';
});
 // v54.274 perf#8: 用 DocumentFragment 批量插入代替 innerHTML= 大字符串（与 renderTiter/Uniformity 一致）
 const _fragWrap = document.createElement('div');
 _fragWrap.innerHTML = html;
 const _frag = document.createDocumentFragment();
 while(_fragWrap.firstChild){ _frag.appendChild(_fragWrap.firstChild);}
 container.innerHTML = '';
 container.appendChild(_frag);
 _rf(container);
 var box = document.getElementById('diss-result');
 if(allContents.length>=2){
 var _st2 = calcStatsFromArray(allContents);
 document.getElementById('diss-mean').textContent = fmtNum(_st2.mean);
 document.getElementById('diss-sd').textContent = fmtNum(_st2.sd);
 document.getElementById('diss-rsd').textContent = fmtNum(_st2.rsd);
 box.style.display = 'grid';
} else if(allContents.length===1){
 document.getElementById('diss-mean').textContent = fmtNum(allContents[0]);
 document.getElementById('diss-sd').textContent = '—';
 document.getElementById('diss-rsd').textContent = '—';
 box.style.display = 'grid';
} else{ box.style.display = 'none';}
}
function calcDissolution(){ renderDissolution();}
registerModule('dissolution',{ dataArray: dissolutionData, defaultParallel:{content:''}, renderFn: renderDissolutionDebounced});
async function clearDissolution(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 dissolutionData.length=0;
 const resultEl=document.getElementById('diss-result'); if(resultEl) resultEl.style.display='none';
 renderDissolution();
}
function saveDissolutionHistory(){
 
 if(!dissolutionData.length){ _i18nAlert('dissolutionEmpty'); return false;}
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? e.value : '';};
 const gt =(id) =>{ const e = document.getElementById(id); return e ? e.textContent : '';};
 var entry={time:_formatNow(),type:'溶出度',
 label:gv('diss-label'),
 mean:gt('diss-mean'),
 sd:gt('diss-sd'),
 rsd:gt('diss-rsd'),
 samples:dissolutionData.map(function(s){return{
 parallels:s.parallels.filter(function(p){return p.content}).map(function(p){return{content:p.content}})
};}).filter(function(s){return s.parallels.length>0})
};
 if(!entry.samples.length){ _i18nAlert('sampleEmpty'); return false;}
 return _saveWithSampleIdPrompt(entry);
}
function addNormStdAreaRow(){
 
 const tbody = document.getElementById('norm-std-area-rows');
 if(!tbody){ _i18nToast('toast_normStdAreaRowsMissing', 'error'); return;}
 const n = tbody.querySelectorAll('tr').length + 1;
 const tr = document.createElement('tr');
 tr.innerHTML = '<td>'+n+'</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td>';
 tbody.appendChild(tr);
}
function removeNormStdAreaRow(btn){
 
 if(!btn) return;
 const rows = document.querySelectorAll('#norm-std-area-rows tr');
 if(rows.length <= 1){ rows[0].querySelectorAll('input').forEach(i => i.value = '');}
 else{
 btn.closest('tr').remove();
 document.querySelectorAll('#norm-std-area-rows tr').forEach((r, i) =>{ r.querySelector('td').textContent = i + 1;});
}
 calcNormalize();
}
function addNormRegressRow(){
 
 const tbody = document.getElementById('norm-regress-rows');
 if(!tbody){ _i18nToast('toast_normRegressRowsMissing', 'error'); return;}
 const tr = document.createElement('tr');
 tr.innerHTML = '<td><input type="text" inputmode="decimal" class="norm-reg-conc" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblConcentration')) + '" data-i18n-aria-label="lblConcentration"></td><td><input type="text" inputmode="decimal" class="norm-reg-area" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('thPeakArea')) + '" data-i18n-aria-label="thPeakArea"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormRegressRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td>';
 tbody.appendChild(tr);
}
function removeNormRegressRow(btn){
 
 if(!btn) return;
 const rows = document.querySelectorAll('#norm-regress-rows tr');
 if(rows.length <= 1){ rows[0].querySelectorAll('input').forEach(i => i.value = '');}
 else{ btn.closest('tr').remove();}
 calcNormalize();
}

function toggleNormSplMode(){
 const independent = document.getElementById('norm-spl-independent').checked;
 document.getElementById('norm-spl-shared-params').style.display = independent ? 'none' : 'block';
 document.getElementById('norm-spl-thead-shared').style.display = independent ? 'none' : '';
 document.getElementById('norm-spl-thead-independent').style.display = independent ? '' : 'none';
 
 rebuildNormSplRows();
 calcNormalize();
}
function rebuildNormSplRows(){
 const tbody = document.getElementById('norm-spl-rows');
 const independent = document.getElementById('norm-spl-independent').checked;
 
 const existingAreas =[];
 tbody.querySelectorAll('.norm-spl-area-pct').forEach(el => existingAreas.push(el.value));
 if(independent){
 
 const oldData =[];
 tbody.querySelectorAll('tr').forEach(row =>{
 const inputs = row.querySelectorAll('input');
 if(inputs.length >= 5){
 oldData.push({
 w: inputs[0].value, d: inputs[1].value, m: inputs[2].value, r: inputs[3].value, a: inputs[4].value
});
}
});
 if(oldData.length === 0 && existingAreas.length > 0){
 
 existingAreas.forEach(a => oldData.push({ w: '', d: '', m: '0', r: '0', a: a}));
}
 if(oldData.length === 0) oldData.push({ w: '', d: '', m: '0', r: '0', a: ''});
 tbody.innerHTML = '';
 oldData.forEach((d, i) =>{
 const tr = document.createElement('tr');
 tr.innerHTML = '<td>'+(i+1)+'</td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" value="'+_esc(d.w)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" value="'+_esc(d.d)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-moisture" placeholder="0" value="'+_esc(d.m)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-residue" placeholder="0" value="'+_esc(d.r)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblResidue')) + '" data-i18n-aria-label="lblResidue"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" value="'+_esc(d.a)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td>'+
 '<td class="result-col">—</td>'+
 '<td><button class="btn btn-outline btn-xs" onclick="copyNormPrevRow(this)" title="' + _esc(i18n('titleCopyUpRow')) + '" data-i18n-title="titleCopyUpRow">↑上行</button><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
 tbody.appendChild(tr);
});
} else{
 
 const oldRows = tbody.querySelectorAll('tr');
 const rowData =[];
 oldRows.forEach(row =>{
 const wInput = row.querySelector('.norm-spl-weight');
 const dInput = row.querySelector('.norm-spl-dilution');
 const aInput = row.querySelector('.norm-spl-area-pct');
 rowData.push({
 w: wInput ? wInput.value : '',
 d: dInput ? dInput.value : '',
 a: aInput ? aInput.value :(existingAreas[rowData.length] || '')
});
});
 if(rowData.length === 0 && existingAreas.length > 0){
 existingAreas.forEach(a => rowData.push({w:'', d:'', a}));
}
 if(rowData.length === 0) rowData.push({w:'', d:'', a:''});
 tbody.innerHTML = '';
 rowData.forEach((rd, i) =>{
 const tr = document.createElement('tr'); tr.className = 'norm-spl-shared';
 tr.innerHTML = '<td>'+(i+1)+'</td><td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" value="'+_esc(rd.w)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td><td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" value="'+_esc(rd.d)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td><td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" value="'+_esc(rd.a)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td class="result-col">—</td><td><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
 tbody.appendChild(tr);
});
}
}
function addNormSampleRow(){
 
 const tbody = document.getElementById('norm-spl-rows');
 if(!tbody){ _i18nToast('toast_normSplRowsMissing', 'error'); return;}
 const n = tbody.querySelectorAll('tr').length + 1;
 const independent = document.getElementById('norm-spl-independent').checked;
 const tr = document.createElement('tr');
 if(independent){
 tr.innerHTML = '<td>'+n+'</td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-moisture" placeholder="0" value="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-residue" placeholder="0" value="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblResidue')) + '" data-i18n-aria-label="lblResidue"></td>'+
 '<td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td>'+
 '<td class="result-col">—</td>'+
 '<td><button class="btn btn-outline btn-xs" onclick="copyNormPrevRow(this)" title="' + _esc(i18n('titleCopyUpRow')) + '" data-i18n-title="titleCopyUpRow">↑上行</button><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
} else{
 tr.className = 'norm-spl-shared';
 tr.innerHTML = '<td>'+n+'</td><td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td><td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td><td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td class="result-col">—</td><td><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
}
 tbody.appendChild(tr);
}
function removeNormSampleRow(btn){
 
 if(!btn) return;
 const tbody = document.getElementById('norm-spl-rows');
 if(!tbody) return;
 const rows = tbody.querySelectorAll('tr');
 if(rows.length <= 1){ rows[0].querySelectorAll('input').forEach(i => i.value = '');}
 else{
 btn.closest('tr').remove();
 tbody.querySelectorAll('tr').forEach((r, i) =>{ r.querySelector('td').textContent = i + 1;});
}
 calcNormalize();
}
function copyNormPrevRow(btn){
 
 if(!btn) return;
 const row = btn.closest('tr');
 const prev = row.previousElementSibling;
 if(!prev) return;
 const prevInputs = prev.querySelectorAll('input');
 const curInputs = row.querySelectorAll('input');
 
 for(let i = 0; i < Math.min(4, prevInputs.length, curInputs.length); i++){
 curInputs[i].value = prevInputs[i].value;
}
 calcNormalize();
}
function calcNormalize(){
 
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? parseFloat(e.value) : NaN;};
 const stdW = _mgInput('norm-std-weight');
 const stdP = gv('norm-std-purity');
 const stdD = gv('norm-std-dilution');
 let stdM = gv('norm-std-moisture'); if(!Number.isFinite(stdM)) stdM = 0;
 let stdR = gv('norm-std-residue'); if(!Number.isFinite(stdR)) stdR = 0;
 const dryStd =(100 - stdM - stdR) / 100;
  // v54.239 fix: m+r>100 时 dryStd 负 → Cstd 负
  const Cstd =(Number.isFinite(stdW) && Number.isFinite(stdP) && Number.isFinite(stdD) && stdW > 0 && stdD > 0 && dryStd > 0)
 ? stdW * stdP / 100 * dryStd / stdD : NaN;
 
 const stdAreaEls = document.querySelectorAll('#norm-std-area-rows .norm-std-area-pct');
 const stdAreas =[];
 stdAreaEls.forEach(el =>{ const v = parseFloat(el.value); if(Number.isFinite(v)) stdAreas.push(v);});
 const avgStdArea = stdAreas.length > 0 ? stdAreas.reduce((a,b)=>a+b,0) / stdAreas.length : NaN;
 const avgEl = document.getElementById('norm-std-area-avg');
 if(avgEl) avgEl.textContent = Number.isFinite(avgStdArea) ? fmtNum(avgStdArea) : '—';
 
 const manualF = gv('norm-manual-f');
 let f = !Number.isFinite(manualF) ? NaN : manualF;
 const regBox = document.getElementById('norm-regress-result');
 const regRows = document.querySelectorAll('#norm-regress-rows tr');
 const pts =[];
 regRows.forEach(row =>{
 const xEl = row.querySelector('.norm-reg-conc');
 const yEl = row.querySelector('.norm-reg-area');
 if(!xEl || !yEl) return;
 const x = parseFloat(xEl.value);
 const y = parseFloat(yEl.value);
 if (Number.isFinite(x) && Number.isFinite(y)) pts.push({x, y});
});
 if(pts.length >= 2){
 const n = pts.length;
 let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
 pts.forEach(p =>{ sx += p.x; sy += p.y; sxy += p.x * p.y; sx2 += p.x * p.x; sy2 += p.y * p.y;});
 const d = n * sx2 - sx * sx;
 if(d !== 0){
 const a =(n * sxy - sx * sy) / d;
 const b =(sy - a * sx) / n;
 const rNum = n * sxy - sx * sy;
 const rDen = Math.sqrt((n * sx2 - sx * sx) *(n * sy2 - sy * sy));
 const r = rDen > 0 ? rNum / rDen : 0;
 if(!Number.isFinite(f)) f = a; 
 const setText =(id, v) =>{ const e = document.getElementById(id); if(e){ e.textContent = v; /* v54.295: 自动给 '—' 空值加 is-empty class 触发浅灰样式 */ if(v === '—' || v === '' || v == null) e.classList.add('is-empty'); else e.classList.remove('is-empty'); }};
 setText('norm-rg-a', fmtNum(a));
 setText('norm-rg-b', fmtNum(b));
 setText('norm-rg-r', fmtNum(r));
 if(regBox) regBox.style.display = 'block';
} else{ if(regBox) regBox.style.display = 'none';}
} else{ if(regBox) regBox.style.display = 'none';}
 const fDisplay = document.getElementById('norm-f-display');
 if(fDisplay) fDisplay.textContent = Number.isFinite(f) ? fmtNum(f) : '—';
 
 const indep = document.getElementById('norm-spl-independent');
 const independent = indep ? indep.checked : false;
 const splRows = document.querySelectorAll('#norm-spl-rows tr');
 const statsBox = document.getElementById('norm-stats');
 const recoveries =[];
 if(independent){
 splRows.forEach((row, i) =>{
 const inputs = row.querySelectorAll('input');
 if(inputs.length < 5) return;
 const w = _mgInput(inputs[0]);
 const d = parseFloat(inputs[1].value);
 const m = parseFloat(inputs[2].value) || 0;
 const r = parseFloat(inputs[3].value) || 0;
 const area = parseFloat(inputs[4].value);
 if(!Number.isFinite(w) || !Number.isFinite(d) || !Number.isFinite(area) || w <= 0 || d <= 0 || !Number.isFinite(Cstd) || !Number.isFinite(avgStdArea) || !Number.isFinite(f)) return;
  const drySpl =(100 - m - r) / 100;
  // v54.239 fix: m+r>100 时 drySpl 为负 → Cspl 变负
  if(drySpl <= 0) return;
 const Cspl = w * drySpl / d;
 const recovery =(area / avgStdArea) * Cstd / Cspl * 100;
 recoveries.push(recovery);
 const rc = row.querySelector('.result-col');
 if(rc) rc.textContent = fmtNum(recovery, 'recovery')+'%';
});
} else{
 const sharedW = _mgInput(document.getElementById('norm-spl-weight'));
 const sharedD = parseFloat(document.getElementById('norm-spl-dilution').value);
 const splM = parseFloat(document.getElementById('norm-spl-moisture').value) || 0;
 const splR = parseFloat(document.getElementById('norm-spl-residue').value) || 0;
 splRows.forEach((row) =>{
 // v54.233 fix (Round 4 A#2): 之前每个 row 都把 sharedW/sharedD 写回 input.value，
 // 导致用户聚焦某 row 编辑时被共享值瞬间覆盖、光标跳走、IME 输入中断。
 // 改为：直接用共享值做计算，不再回填到 row input。
 const area = parseFloat(row.querySelector('.norm-spl-area-pct').value);
 const w = sharedW;
 const d = sharedD;
 if(!Number.isFinite(w) || !Number.isFinite(d) || !Number.isFinite(area) || w <= 0 || d <= 0 || !Number.isFinite(Cstd) || !Number.isFinite(avgStdArea) || !Number.isFinite(f)) return;
 const drySpl =(100 - splM - splR) / 100;
 if(drySpl <= 0) return; /* v54.281 fix (correctness HIGH): 共享模式 drySpl 守卫（独立模式 calcExternal 已有；calcNormalize 共享模式漏修） */
 const Cspl = w * drySpl / d;
 const recovery =(area / avgStdArea) * Cstd / Cspl * 100;
 recoveries.push(recovery);
 const rc = row.querySelector('.result-col');
 if(rc) rc.textContent = fmtNum(recovery, 'recovery')+'%';
});
}
 document.getElementById('norm-results').innerHTML = '';
 if(recoveries.length >= 2){
 const _st = calcStatsFromArray(recoveries); const n=_st.n, mean=_st.mean, sd=_st.sd, rsd=_st.rsd;
 document.getElementById('nrec-mean').textContent = fmtNum(mean);
 document.getElementById('nrec-sd').textContent = fmtNum(sd);
 document.getElementById('nrec-rsd').textContent = fmtNum(rsd);
 statsBox.style.display = 'grid';
} else if(recoveries.length === 1){
 document.getElementById('nrec-mean').textContent = fmtNum(recoveries[0], 'recovery');
 document.getElementById('nrec-sd').textContent = '—';
 document.getElementById('nrec-rsd').textContent = '—';
 statsBox.style.display = 'grid';
} else{ statsBox.style.display = 'none';}
 autoHideCheck('norm-spl-card');
}
async function clearNormalize(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;

 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 const setHTML =(id, h) =>{ const e = document.getElementById(id); if(e) e.innerHTML = h;};
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 setVal('norm-std-weight', '');
 setVal('norm-std-purity', '100');
 setVal('norm-std-dilution', '');
 setVal('norm-std-moisture', '0');
 setVal('norm-std-residue', '0');
 setHTML('norm-std-area-rows',
 '<tr><td>1</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>'+
 '<tr><td>2</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>');
 setHTML('norm-regress-rows',
 '<tr><td><input type="text" inputmode="decimal" class="norm-reg-conc" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblConcentration')) + '" data-i18n-aria-label="lblConcentration"></td><td><input type="text" inputmode="decimal" class="norm-reg-area" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('thPeakArea')) + '" data-i18n-aria-label="thPeakArea"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormRegressRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>');
 setVal('norm-manual-f', '');
 const avg = document.getElementById('norm-std-area-avg'); if(avg) avg.textContent = '—';
 setStyle('norm-regress-result', 'none');
 const indep = document.getElementById('norm-spl-independent'); if(indep) indep.checked = false;
 setVal('norm-spl-weight', '');
 setVal('norm-spl-dilution', '');
 setVal('norm-spl-moisture', '0');
 setVal('norm-spl-residue', '0');
 setStyle('norm-spl-shared-params', 'block');
 setStyle('norm-spl-thead-shared', '');
 setStyle('norm-spl-thead-independent', 'none');
 setHTML('norm-spl-rows',
 '<tr class="norm-spl-shared"><td>1</td><td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td><td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td><td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td class="result-col">—</td><td><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td></tr>');
 setHTML('norm-results', '');
 setStyle('norm-stats', 'none');
 const splCard = document.getElementById('norm-spl-card'); if(splCard) splCard.classList.remove('hide-inputs');
 const nt = document.querySelector('#norm-spl-card .hide-toggle');
 if(nt) { nt.textContent = i18n('btnHideInput'); nt.setAttribute('aria-expanded', 'true'); }
}
async function clearNormStd(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 setVal('norm-std-weight', '');
 setVal('norm-std-purity', '100');
 setVal('norm-std-dilution', '');
 setVal('norm-std-moisture', '0');
 setVal('norm-std-residue', '0');
 calcNormalize();
}
async function clearNormStdAreas(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const setHTML =(id, h) =>{ const e = document.getElementById(id); if(e) e.innerHTML = h;};
 setHTML('norm-std-area-rows',
 '<tr><td>1</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>'+
 '<tr><td>2</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>');
 const avg = document.getElementById('norm-std-area-avg'); if(avg) avg.textContent = '—';
 calcNormalize();
}
async function clearNormFactor(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const setHTML =(id, h) =>{ const e = document.getElementById(id); if(e) e.innerHTML = h;};
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 setHTML('norm-regress-rows',
 '<tr><td><input type="text" inputmode="decimal" class="norm-reg-conc" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblConcentration')) + '" data-i18n-aria-label="lblConcentration"></td><td><input type="text" inputmode="decimal" class="norm-reg-area" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('thPeakArea')) + '" data-i18n-aria-label="thPeakArea"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormRegressRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>');
 const f = document.getElementById('norm-manual-f'); if(f) f.value = '';
 setStyle('norm-regress-result', 'none');
 calcNormalize();
}

function extStdF(){
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? parseFloat(e.value) : NaN;};
 const area = gv('ext-std-area');
 const weight = _mgInput('ext-std-weight');
 const purity = gv('ext-std-purity');
 const dilution = gv('ext-std-dilution');
 let moisture = gv('ext-std-moisture'); if(!Number.isFinite(moisture)) moisture = 0;
 let residue = gv('ext-std-residue'); if(!Number.isFinite(residue)) residue = 0;
 // v54.239 fix: 加负值守卫（用户输入负 purity/area → f 变负，所有 recovery 变负）
 if([area, weight, purity, dilution].some(v => !Number.isFinite(v) || v <= 0)) return NaN;
 const dryFactor =(100 - moisture - residue) / 100;
  // v54.239 fix: m+r>100 时 dryFactor 负 → f 负
  if(dryFactor <= 0) return NaN;
  return area /(weight * purity / 100 * dryFactor / dilution);
}
function addExtSample(){
 
 const container = document.getElementById('ext-sample-rows');
 if(!container){ _i18nToast('toast_extSampleRowsMissing', 'error'); return;}
 const n = container.querySelectorAll('.sample-row').length + 1;
 const div = document.createElement('div'); div.className = 'sample-row';
 div.innerHTML =
 '' + i18n('sampleNum') + n + ' <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-sm" onclick="removeExtSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button></div>'+
 '<div class="half">'+
 '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="ext-spl-area" placeholder="0" oninput="calcExternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
 '<div><label data-i18n="lbl-sample-weight">称样量 (mg)</label><input type="text" inputmode="decimal" class="ext-spl-weight" placeholder="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-sample-weight')) + '" data-i18n-aria-label="lbl-sample-weight"></div>'+
 '<div><label data-i18n="lbl-dilution-vol">稀释体积 (mL)</label><input type="text" inputmode="decimal" class="ext-spl-dilution" placeholder="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-dilution-vol')) + '" data-i18n-aria-label="lbl-dilution-vol"></div>'+
 '<div><label data-i18n="lbl-theory-content-pct">理论含量 (%)</label><input type="text" inputmode="decimal" class="ext-spl-theory" placeholder="100" value="100" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-theory-content-pct')) + '" data-i18n-aria-label="lbl-theory-content-pct"></div>'+
 '</div>'+
 '<div class="section-label" data-i18n="card-title-drying-param">干燥品折算参数</div>'+
 '<div class="half">'+
 '<div><label data-i18n="lblMoisturePct">水分 (%)</label><input type="text" inputmode="decimal" class="ext-spl-moisture" placeholder="0" value="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></div>'+
 '<div><label data-i18n="lbl-residue-pct">炽灼残渣 (%)</label><input type="text" inputmode="decimal" class="ext-spl-residue" placeholder="0" value="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-residue-pct')) + '" data-i18n-aria-label="lbl-residue-pct"></div>'+
 '</div>';
 container.appendChild(div);
}
function removeExtSample(btn){

 if(!btn) return;
 const rows = document.querySelectorAll('#ext-sample-rows .sample-row');
 if(rows.length <= 1){ rows[0].querySelectorAll('input').forEach(i => i.value = '');}
 else{
 btn.closest('.sample-row').remove();
 // v54.236 fix: addExtSample 生成的 .sample-row 第一个 text node 就是样品号（没有 .card-title 包裹）
 document.querySelectorAll('#ext-sample-rows .sample-row').forEach((r, i) =>{
 const firstText = r.firstChild;
 if(firstText && firstText.nodeType === 3) firstText.textContent = i18n('sampleNum') +(i + 1) + ' ';
});
}
 calcExternal();
}
function calcExternal(){
 const f = extStdF();
 const statsBox = document.getElementById('ext-stats');
 const rows = document.querySelectorAll('#ext-sample-rows .sample-row');
 const recoveries =[];
 rows.forEach((row, i) =>{
 if(!Number.isFinite(f)) return;
 
 const gv =(sel) =>{ const e = row.querySelector(sel); return e ? parseFloat(e.value) : NaN;};
 const area = gv('.ext-spl-area');
 const weight = _mgInput('.ext-spl-weight');
 const dilution = gv('.ext-spl-dilution');
 let theory = gv('.ext-spl-theory'); if(!Number.isFinite(theory)) theory = 100;
 let moisture = gv('.ext-spl-moisture'); if(!Number.isFinite(moisture)) moisture = 0;
 let residue = gv('.ext-spl-residue'); if(!Number.isFinite(residue)) residue = 0;
 if([area, weight, dilution].some(v => !Number.isFinite(v) || v <= 0)) return;
  const dryFactor =(100 - moisture - residue) / 100;
  // v54.239 fix: m+r>100 时 dryFactor 为负 → contentPct 变负
  if(dryFactor <= 0) return;
  const contentPct =(area / f) /(weight * dryFactor / dilution) * 100;
 const recovery = theory > 0 ? contentPct / theory * 100 : 0;
 recoveries.push(recovery);
 const rc = row.querySelector('.result-col');
 if(rc) rc.textContent = fmtNum(recovery, 'recovery')+'%';
});
 const setText =(id, v) =>{ const e = document.getElementById(id); if(e){ e.textContent = v; /* v54.295: 自动给 '—' 空值加 is-empty class 触发浅灰样式 */ if(v === '—' || v === '' || v == null) e.classList.add('is-empty'); else e.classList.remove('is-empty'); }};
 setText('ext-results', '');
 if(recoveries.length >= 2){
 const _st = calcStatsFromArray(recoveries); const n=_st.n, mean=_st.mean, sd=_st.sd, rsd=_st.rsd;
 setText('erec-mean', fmtNum(mean));
 setText('erec-sd', fmtNum(sd));
 setText('erec-rsd', fmtNum(rsd));
 if(statsBox) statsBox.style.display = 'grid';
} else if(recoveries.length === 1){
 setText('erec-mean', fmtNum(recoveries[0], 'recovery'));
 document.getElementById('erec-sd').textContent = '—';
 document.getElementById('erec-rsd').textContent = '—';
 statsBox.style.display = 'grid';
} else{ statsBox.style.display = 'none';}
 autoHideCheck('ext-spl-card');
}
async function clearExternal(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;

 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 setVal('ext-std-area', '');
 setVal('ext-std-weight', '');
 setVal('ext-std-purity', '100');
 setVal('ext-std-dilution', '');
 setVal('ext-std-moisture', '0');
 setVal('ext-std-residue', '0');
 document.getElementById('ext-sample-rows').innerHTML =
 '<div class="sample-row">'+
 '' + i18n('sampleNum') + '1 <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-sm" onclick="removeExtSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button></div>'+
 '<div class="half">'+
 '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="ext-spl-area" placeholder="0" oninput="calcExternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
 '<div><label data-i18n="lbl-sample-weight">称样量 (mg)</label><input type="text" inputmode="decimal" class="ext-spl-weight" placeholder="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-sample-weight')) + '" data-i18n-aria-label="lbl-sample-weight"></div>'+
 '<div><label data-i18n="lbl-dilution-vol">稀释体积 (mL)</label><input type="text" inputmode="decimal" class="ext-spl-dilution" placeholder="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-dilution-vol')) + '" data-i18n-aria-label="lbl-dilution-vol"></div>'+
 '<div><label data-i18n="lbl-theory-content-pct">理论含量 (%)</label><input type="text" inputmode="decimal" class="ext-spl-theory" placeholder="100" value="100" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-theory-content-pct')) + '" data-i18n-aria-label="lbl-theory-content-pct"></div>'+
 '</div>'+
 '<div class="section-label" data-i18n="card-title-drying-param">干燥品折算参数</div>'+
 '<div class="half">'+
 '<div><label data-i18n="lblMoisturePct">水分 (%)</label><input type="text" inputmode="decimal" class="ext-spl-moisture" placeholder="0" value="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></div>'+
 '<div><label data-i18n="lbl-residue-pct">炽灼残渣 (%)</label><input type="text" inputmode="decimal" class="ext-spl-residue" placeholder="0" value="0" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-residue-pct')) + '" data-i18n-aria-label="lbl-residue-pct"></div>'+
 '</div>'+
 '</div>';
 document.getElementById('ext-results').innerHTML = '';
 document.getElementById('ext-stats').style.display = 'none';
 document.getElementById('ext-spl-card').classList.remove('hide-inputs');
 const et = document.querySelector('#ext-spl-card .hide-toggle');
 if(et) { et.textContent = i18n('btnHideInput'); et.setAttribute('aria-expanded', 'true'); }
}
async function clearExtStd(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 setVal('ext-std-area', '');
 setVal('ext-std-weight', '');
 setVal('ext-std-purity', '100');
 setVal('ext-std-dilution', '');
 setVal('ext-std-moisture', '0');
 setVal('ext-std-residue', '0');
 const stats = document.getElementById('ext-stats'); if(stats) stats.style.display = 'none';
 calcExternal();
}

function addIntSample(){
 
 const container = document.getElementById('int-sample-rows');
 if(!container){ _i18nToast('toast_intSampleRowsMissing', 'error'); return;}
 const n = container.querySelectorAll('.sample-row').length + 1;
 const div = document.createElement('div'); div.className = 'sample-row';
 div.innerHTML =
 '' + i18n('sampleNum') + n + ' <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-sm" onclick="removeIntSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button></div>'+
 '<div class="half">'+
 '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="int-spl-area" placeholder="0" oninput="calcInternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
 '<div><label data-i18n="lbl-is-peak-area">内标峰面积</label><input type="text" inputmode="decimal" class="int-spl-is-area" placeholder="0" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-is-peak-area')) + '" data-i18n-aria-label="lbl-is-peak-area"></div>'+
 '</div>'+
 '<div class="half">'+
 '<div><label data-i18n="lbl-theory-conc-mg-ml">理论浓度 (mg/mL)</label><input type="text" inputmode="decimal" class="int-spl-theory" placeholder="0" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-theory-conc-mg-ml')) + '" data-i18n-aria-label="lbl-theory-conc-mg-ml"></div>'+
 '</div>';
 container.appendChild(div);
}
function removeIntSample(btn){

 if(!btn) return;
 const rows = document.querySelectorAll('#int-sample-rows .sample-row');
 if(rows.length <= 1){ rows[0].querySelectorAll('input').forEach(i => i.value = '');}
 else{
 btn.closest('.sample-row').remove();
 // v54.236 fix: addIntSample 生成的 .sample-row 第一个 text node 就是样品号（没有 .card-title 包裹）
 document.querySelectorAll('#int-sample-rows .sample-row').forEach((r, i) =>{
 const firstText = r.firstChild;
 if(firstText && firstText.nodeType === 3) firstText.textContent = i18n('sampleNum') +(i + 1) + ' ';
});
}
 calcInternal();
}
function calcInternal(){
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? parseFloat(e.value) : NaN;};
 const stdArea = gv('int-std-area');
 const stdIsArea = gv('int-std-is-area');
 const stdConc = gv('int-std-conc');
 const setText =(id, v) =>{ const e = document.getElementById(id); if(e){ e.textContent = v; /* v54.295: 自动给 '—' 空值加 is-empty class 触发浅灰样式 */ if(v === '—' || v === '' || v == null) e.classList.add('is-empty'); else e.classList.remove('is-empty'); }};
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 // v54.239 fix: 加负值守卫（用户输入 stdArea=-100 时 Rstd 变负、f 变负、所有 recovery 变负）
 if([stdArea, stdIsArea, stdConc].some(v => !Number.isFinite(v) || v <= 0)){
 setText('int-results', '');
 setStyle('int-stats', 'none');
 return;
}
 const Rstd = stdArea / stdIsArea;
 const f = stdConc / Rstd;
 const statsBox = document.getElementById('int-stats');
 const rows = document.querySelectorAll('#int-sample-rows .sample-row');
 const recoveries =[];
 rows.forEach((row, i) =>{
 const gvRow =(sel) =>{ const e = row.querySelector(sel); return e ? parseFloat(e.value) : NaN;};
 const area = gvRow('.int-spl-area');
 const isArea = gvRow('.int-spl-is-area');
 const theory = gvRow('.int-spl-theory');
 if([area, isArea, theory].some(v => !Number.isFinite(v) || v <= 0)) return;
 const Rspl = area / isArea;
 const Cspl = f * Rspl;
 const recovery = theory > 0 ? Cspl / theory * 100 : 0;
 recoveries.push(recovery);
 const rc = row.querySelector('.result-col');
 if(rc) rc.textContent = fmtNum(recovery, 'recovery')+'%';
});
 setText('int-results', '');
 if(recoveries.length >= 2){
 const _st = calcStatsFromArray(recoveries); const n=_st.n, mean=_st.mean, sd=_st.sd, rsd=_st.rsd;
 setText('irec-mean', fmtNum(mean));
 setText('irec-sd', fmtNum(sd));
 setText('irec-rsd', fmtNum(rsd));
 if(statsBox) statsBox.style.display = 'grid';
} else if(recoveries.length === 1){
 setText('irec-mean', fmtNum(recoveries[0], 'recovery'));
 setText('irec-sd', '—');
 setText('irec-rsd', '—');
 if(statsBox) statsBox.style.display = 'grid';
} else{ if(statsBox) statsBox.style.display = 'none';}
 autoHideCheck('int-spl-card');
}
function _debounceCalc(fn, ms){
 let _t = null;
 return function(){
  if(_t) clearTimeout(_t);
  _t = setTimeout(() =>{ try { fn(); } catch(e){ console.error('[debounce calc]', e);}}, ms);
 };
}
calcCurve = _debounceCalc(calcCurve, 80);
calcSpike = _debounceCalc(calcSpike, 80);
calcNormalize = _debounceCalc(calcNormalize, 80);
calcExternal = _debounceCalc(calcExternal, 80);
calcInternal = _debounceCalc(calcInternal, 80);
async function clearInternal(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;

 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 const setHTML =(id, h) =>{ const e = document.getElementById(id); if(e) e.innerHTML = h;};
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 setVal('int-std-area', '');
 setVal('int-std-is-area', '');
 setVal('int-std-conc', '');
 setHTML('int-sample-rows',
 '<div class="sample-row">'+
 '' + i18n('sampleNum') + '1 <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-sm" onclick="removeIntSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button></div>'+
 '<div class="half">'+
 '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="int-spl-area" placeholder="0" oninput="calcInternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
 '<div><label data-i18n="lbl-is-peak-area">内标峰面积</label><input type="text" inputmode="decimal" class="int-spl-is-area" placeholder="0" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-is-peak-area')) + '" data-i18n-aria-label="lbl-is-peak-area"></div>'+
 '</div>'+
 '<div class="half">'+
 '<div><label data-i18n="lbl-theory-conc-mg-ml">理论浓度 (mg/mL)</label><input type="text" inputmode="decimal" class="int-spl-theory" placeholder="0" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-theory-conc-mg-ml')) + '" data-i18n-aria-label="lbl-theory-conc-mg-ml"></div>'+
 '</div>'+
 '</div>');
 setHTML('int-results', '');
 setStyle('int-stats', 'none');
 const splCard = document.getElementById('int-spl-card'); if(splCard) splCard.classList.remove('hide-inputs');
 const it = document.querySelector('#int-spl-card .hide-toggle');
 if(it) { it.textContent = i18n('btnHideInput'); it.setAttribute('aria-expanded', 'true'); }
}
async function clearIntStd(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 setVal('int-std-area', '');
 setVal('int-std-is-area', '');
 setVal('int-std-conc', '');
 setStyle('int-stats', 'none');
 calcInternal();
}

function calcSimple(){
 
 const gv =(id) =>{ const e = document.getElementById(id); return e ? parseFloat(e.value) : NaN;};
 const theory = gv('simple-theory');
 const measured = gv('simple-measured');
 const box = document.getElementById('simple-result');
 // v54.239 fix: 加负值守卫（用户输入负 theory/measured → recovery 变负）
 if(!Number.isFinite(theory) || !Number.isFinite(measured) || theory <= 0 || measured <= 0){ if(box) box.style.display = 'none'; return;}
 const recovery = measured / theory * 100;
 const setText =(id, v) =>{ const e = document.getElementById(id); if(e){ e.textContent = v; /* v54.295: 自动给 '—' 空值加 is-empty class 触发浅灰样式 */ if(v === '—' || v === '' || v == null) e.classList.add('is-empty'); else e.classList.remove('is-empty'); }};
 setText('sres-theory', fmtNum(theory));
 setText('sres-measured', fmtNum(measured));
 setText('sres-rec', fmtNum(recovery, 'recovery'));
 if(box) box.style.display = 'grid';
}
async function clearSimple(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 const setStyle =(id, v) =>{ const e = document.getElementById(id); if(e) e.style.display = v;};
 setVal('simple-theory', '100');
 setVal('simple-measured', '');
 setStyle('simple-result', 'none');
}

let _calcHist =[];
function calcInsert(s){
 
 const inp = document.getElementById('calc-input');
 if(!inp){ _i18nToast('toast_calcInputMissing', 'error'); return;}
 inp.value += s; inp.focus();
}
function calcBack(){
 const inp = document.getElementById('calc-input');
 if(!inp){ _i18nToast('toast_calcInputMissing', 'error'); return;}
 inp.value = inp.value.slice(0, -1); inp.focus();
}
function calcClear(){
 const setVal =(id, v) =>{ const e = document.getElementById(id); if(e) e.value = v;};
 const setText =(id, v) =>{ const e = document.getElementById(id); if(e){ e.textContent = v; /* v54.295: 自动给 '—' 空值加 is-empty class 触发浅灰样式 */ if(v === '—' || v === '' || v == null) e.classList.add('is-empty'); else e.classList.remove('is-empty'); }};
 setVal('calc-input', '');
 setText('calc-display', '');
}
function calcTogglePage(){
 const kp = document.getElementById('calc-keypad');
 if(!kp){ _i18nToast('toast_calcKeypadMissing', 'error'); return;}
 const ind = document.getElementById('calc-page-indicator');
 const isPage2 = kp.classList.toggle('show-page2');
 if(ind) ind.innerHTML = isPage2 ? i18n('calcAdvMode') : i18n('calcBasicMode');
}
function _fact(n){
 if(!Number.isInteger(n) || n < 0) return NaN;
 if(n === 0 || n === 1) return 1;
 let r = 1;
 for(let i = 2; i <= n; i++) r *= i;
 return r;
}
function calcEval(){
 
 const inp = document.getElementById('calc-input');
 const display = document.getElementById('calc-display');
 if(!inp){ _i18nToast('toast_calcInputMissing', 'error'); return;}
 const expr = inp.value.trim();
 if(!expr) return;
 const setDisplay =(v) =>{ if(display) display.textContent = v;};
 
 if(CALC_EXPR_BLOCKLIST.test(expr)) {
    setDisplay(i18n('calcError'));
    return;
  }
  if (!/^[\d\s+\-*/%^().,a-zA-Z_]+$/.test(expr)) {
    setDisplay(i18n('calcError'));
    return;
  }
  try {
    const safe = expr
      .replace(/10\^\(/g, 'Math.pow(10,')
      .replace(/asin\(/g, 'Math.asin(')
      .replace(/acos\(/g, 'Math.acos(')
      .replace(/atan\(/g, 'Math.atan(')
      .replace(/\blog2\(/g, 'Math.log2(')
      .replace(/exp\(/g, 'Math.exp(')
      .replace(/\bfloor\(/g, 'Math.floor(')
      .replace(/\bceil\(/g, 'Math.ceil(')
      .replace(/\bround\(/g, 'Math.round(')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/fact\(/g, '_fact(')
      .replace(/\^/g, '**')
      .replace(/\bsin\(/g, 'Math.sin(')
      .replace(/\bcos\(/g, 'Math.cos(')
      .replace(/\btan\(/g, 'Math.tan(')
      .replace(/\blog\(/g, 'Math.log10(')
      .replace(/\bln\(/g, 'Math.log(')
      .replace(/\bsqrt\(/g, 'Math.sqrt(');
    const result = Function('_fact', '"use strict"; return (' + safe + ')')(_fact);
    setDisplay(fmtNum(result));
    _calcHist.unshift({ expr, result: fmtNum(result), time: _formatNow() });
    if (_calcHist.length > 50) _calcHist.length = 50;
    inp.value = '';
    renderCalcHistory();
  } catch(e) {
    document.getElementById('calc-display').textContent = i18n('calcError');
  }
}

function renderCalcHistory() {
  const el = document.getElementById('calc-history');
  if (_calcHist.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = _calcHist.map(h =>
    '<div style="padding:4px 0;border-bottom:1px solid var(--border)"><span style="color:#aaa;font-size:10px">'+_esc(h.time)+'</span> <span style="font-weight:600">'+_esc(h.expr)+'</span> = <span style="color:var(--primary);font-weight:700">'+_esc(h.result)+'</span></div>'
  ).join('');
}

function calcClearHistory() {
  _calcHist = [];
  renderCalcHistory();
}

// ==================== 回收率历史保存 ====================
async function saveRecoveryHistory(method) {
  // v54.44 防御：method 必须是 4 个已知方法之一（参照 v54.31 restoreBackup 同样的早 return 守卫）。
  // 实证：saveRecoveryHistory() / saveRecoveryHistory('nonexistent') 不抛错但会
  //   1) 保存只有 time 字段的空 entry 到历史（污染 renderHistory 下游）
  //   2) flashEl(undefined, ...) 找不到元素（虽然 flashEl 自己有 null 守卫不抛错）
  // 触发场景：_currentRecoveryFn('save') 简易版返回 'saveRecoveryHistory' 字符串，
  //   hotkey 调用时没传 method → method = undefined
  const validMethods = ['normalize', 'external', 'internal', 'simple'];
  if (!validMethods.includes(method)) { _i18nAlert('invalidMethodFmt', method); return; }
  const entry = { time: _formatNow() };
  // v54.63 防御：DOM 缺失时 TypeError 被吞（所有 method 分支统一用 gv/gt helper）
  const gv = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
  const gt = (id) => { const e = document.getElementById(id); return e ? e.textContent : ''; };
  const gc = (id) => { const e = document.getElementById(id); return e ? e.checked : false; };
  // v54.75 重构：原 154 行 4 分支拆为 4 个 builder（每个返回是否继续保存，false=用户取消）
  const proceed = await (method === 'normalize' ? _fillRecoveryNormalizeEntry(entry, gv, gt, gc)
              : method === 'external' ? _fillRecoveryExternalEntry(entry, gv, gt, gc)
              : method === 'internal' ? _fillRecoveryInternalEntry(entry, gv, gt, gc)
              : _fillRecoverySimpleEntry(entry, gv, gt, gc));
  if (proceed === false) return;
  entry._meta = getReportMeta();
  return _saveWithSampleIdPrompt(entry, function() { flashEl((method==='normalize'?'norm-stats':method==='external'?'ext-stats':method==='internal'?'int-stats':'simple-result'), '<div style="text-align:center;color:#15803d;font-weight:700;padding:10px">' + i18n('flashSavedToHistory') + '</div>'); });
}

// ==================== saveRecoveryHistory 4 个 method builder（v54.75 从 saveRecoveryHistory 拆出） ====================
async function _fillRecoveryNormalizeEntry(entry, gv, gt, gc) {
  entry.type = '回收率-面积归一化法';
  entry.stdWeight = gv('norm-std-weight');
  entry.stdPurity = gv('norm-std-purity');
  entry.stdDilution = gv('norm-std-dilution');
  entry.stdMoisture = gv('norm-std-moisture') || '0';
  entry.stdResidue = gv('norm-std-residue') || '0';
  entry.stdAreaPcts = [];
  document.querySelectorAll('#norm-std-area-rows .norm-std-area-pct').forEach(el => {
    if (el.value) entry.stdAreaPcts.push(el.value);
  });
  entry.stdAreaAvg = gt('norm-std-area-avg');
  entry.manualF = gv('norm-manual-f');
  entry.independent = gc('norm-spl-independent');
  if (entry.independent) {
    entry.splSamples = [];
    document.querySelectorAll('#norm-spl-rows tr').forEach(row => {
      const inputs = row.querySelectorAll('input');
      if (inputs.length >= 5) {
        entry.splSamples.push({
          weight: inputs[0].value, dilution: inputs[1].value,
          moisture: inputs[2].value || '0', residue: inputs[3].value || '0',
          areaPct: inputs[4].value
        });
      }
    });
  } else {
    entry.splMoisture = gv('norm-spl-moisture') || '0';
    entry.splResidue = gv('norm-spl-residue') || '0';
    entry.splSamples = [];
    document.querySelectorAll('#norm-spl-rows tr').forEach(row => {
      const wInput = row.querySelector('.norm-spl-weight');
      const dInput = row.querySelector('.norm-spl-dilution');
      const aInput = row.querySelector('.norm-spl-area-pct');
      if (wInput && dInput && aInput) {
        entry.splSamples.push({
          weight: wInput.value, dilution: dInput.value, areaPct: aInput.value
        });
      }
    });
    // Backward compat: also save flat arrays
    entry.splWeight = gv('norm-spl-weight');
    entry.splDilution = gv('norm-spl-dilution');
    entry.splAreaPcts = [];
    document.querySelectorAll('#norm-spl-rows .norm-spl-area-pct').forEach(el => {
      if (el.value) entry.splAreaPcts.push(el.value);
    });
  }
  entry.regression = { points: [] };
  document.querySelectorAll('#norm-regress-rows tr').forEach(row => {
    const conc = row.querySelector('.norm-reg-conc');
    const area = row.querySelector('.norm-reg-area');
    if (conc && area && conc.value && area.value) entry.regression.points.push({ conc: conc.value, area: area.value });
  });
  if (entry.regression.points.length >= 2) {
    entry.regression.a = gt('norm-rg-a');
    entry.regression.b = gt('norm-rg-b');
    entry.regression.r = gt('norm-rg-r');
  }
  entry.calcF = entry.manualF || gt('norm-rg-a');
  entry.recoveries = [];
  document.querySelectorAll('#norm-spl-rows .result-col').forEach(el => {
    const t = el.textContent.trim();
    if (t !== '—' && t !== '') entry.recoveries.push(t.replace('%',''));
  });
  if (entry.recoveries.length >= 2) {
    entry.cMean = parseFloat(gt('nrec-mean')); /* v54.281 correctness (HIGH): parseFloat — JSON export 数字而非字符串 */
    entry.cSd = parseFloat(gt('nrec-sd'));
    entry.cRsd = parseFloat(gt('nrec-rsd'));
  }
  entry.count = entry.recoveries.length;
  if (entry.count === 0) return await _confirmDialog(i18n('confirmSaveNoRecovery'));
  return true;
}

async function _fillRecoveryExternalEntry(entry, gv, gt, gc) {
  entry.type = '回收率-外标法';
  entry.stdArea = gv('ext-std-area');
  entry.stdWeight = gv('ext-std-weight');
  entry.stdPurity = gv('ext-std-purity');
  entry.stdDilution = gv('ext-std-dilution');
  entry.stdMoisture = gv('ext-std-moisture') || '0';
  entry.stdResidue = gv('ext-std-residue') || '0';
  entry.samples = [];
  entry.recoveries = [];
  const rows = document.querySelectorAll('#ext-sample-rows .sample-row');
  rows.forEach(row => {
    const gvr = (sel) => { const e = row.querySelector(sel); return e ? e.value : ''; };
    entry.samples.push({
      area: gvr('.ext-spl-area'),
      weight: gvr('.ext-spl-weight'),
      dilution: gvr('.ext-spl-dilution'),
      theory: gvr('.ext-spl-theory') || '100',
      moisture: gvr('.ext-spl-moisture') || '0',
      residue: gvr('.ext-spl-residue') || '0'
    });
  });
  const recEls = document.querySelectorAll('#ext-sample-rows .result-col');
  recEls.forEach(el => { const t = el.textContent.trim(); if (t !== '—' && t !== '') entry.recoveries.push(t.replace('%','')); });
  if (entry.recoveries.length >= 2) {
    entry.cMean = parseFloat(gt('erec-mean')); /* v54.281 correctness (HIGH): 见上 */
    entry.cSd = parseFloat(gt('erec-sd'));
    entry.cRsd = parseFloat(gt('erec-rsd'));
  }
  entry.count = entry.samples.length;
  if (entry.recoveries.length === 0) return await _confirmDialog(i18n('confirmSaveNoRecovery'));
  return true;
}

async function _fillRecoveryInternalEntry(entry, gv, gt, gc) {
  entry.type = '回收率-内标法';
  entry.stdArea = gv('int-std-area');
  entry.stdIsArea = gv('int-std-is-area');
  entry.stdConc = gv('int-std-conc');
  entry.samples = [];
  entry.recoveries = [];
  const rows = document.querySelectorAll('#int-sample-rows .sample-row');
  rows.forEach(row => {
    const gvr = (sel) => { const e = row.querySelector(sel); return e ? e.value : ''; };
    entry.samples.push({
      area: gvr('.int-spl-area'),
      isArea: gvr('.int-spl-is-area'),
      theory: gvr('.int-spl-theory')
    });
  });
  const recEls = document.querySelectorAll('#int-sample-rows .result-col');
  recEls.forEach(el => { const t = el.textContent.trim(); if (t !== '—' && t !== '') entry.recoveries.push(t.replace('%','')); });
  if (entry.recoveries.length >= 2) {
    entry.cMean = parseFloat(gt('irec-mean')); /* v54.281 correctness (HIGH): 见上 */
    entry.cSd = parseFloat(gt('irec-sd'));
    entry.cRsd = parseFloat(gt('irec-rsd'));
  }
  entry.count = entry.samples.length;
  if (entry.recoveries.length === 0) return await _confirmDialog(i18n('confirmSaveNoRecovery'));
  return true;
}

async function _fillRecoverySimpleEntry(entry, gv, gt, gc) {
  entry.type = '回收率-简易';
  entry.theory = gv('simple-theory');
  entry.measured = gv('simple-measured');
  entry.recovery = gt('sres-rec');
  if (entry.recovery === '—') return await _confirmDialog(i18n('confirmSaveNoRecovery'));
  return true;
}


// ==================== 更新渲染历史 ====================

// ==================== 导出报告共享基础设施（对齐 QR-MV2026013 模板） ====================
// 三层结构：collect（读 DOM 重算）→ build（aoa 对齐表）→ export（CSV/Excel/Word 三入口复用）
// 历史页经 *EntryToData 适配器无损重建

function getReportMeta() {
  var m = {};
  try { m = JSON.parse(localStorage.getItem('rsd-report-meta')) || {}; } catch (e) { m = {}; }
  var d = new Date();
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  return {
    date: m.date || d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    sampleName: m.sampleName || '',
    sampleId: m.sampleId || '',
    batch: m.batch || '',
    operator: m.operator || '',
    instrument: m.instrument || '',
    column: m.column || '',
    tagPrefix: m.tagPrefix || ''
  };
}
function setReportMeta(m) {
  // v54.240 fix: localStorage 满 / 隐私模式不可写时静默 setItem throw → 用户元数据丢失 → 下次打开看不到 → 用 flashEl 提示
  // v54.246 fix: snapshot prev before write；写失败时还原 prev 或清空 key，避免半残状态污染下次读取
  var prev = null, hadPrev = false;
  try { prev = localStorage.getItem('rsd-report-meta'); hadPrev = (prev !== null); } catch (_) {}
  try {
    localStorage.setItem('rsd-report-meta', JSON.stringify(m));
  } catch (e) {
    try {
      if (hadPrev) localStorage.setItem('rsd-report-meta', prev);
      else localStorage.removeItem('rsd-report-meta');
    } catch (_) {}
    try { if (typeof _i18nToast === 'function') _i18nToast('toast_historySaveFail', 'error', 5000); } catch (_) {} /* v54.273 fix: flashEl('setReportMetaFail','error',3000) 静默（flashEl 第三个 arg 忽略，无 setReportMetaFail 元素），改用 _i18nToast */
  }
}

function rfmt(v, d) { var n = (typeof v === 'string') ? parseFloat(v) : v; return (n === null || n === undefined || !Number.isFinite(n)) ? '—' : (+n).toFixed(d); } /* v54.274 fix (correctness #8): 接受数字字符串（helpers-export 的 collect*Data 传 textContent string → 旧代码 !Number.isFinite("1.005")=true → 永远 "—"） */

function _exportModuleExcel(collectFn, buildFn, moduleKey, sheetName) {
  if (typeof XLSX === 'undefined') { _i18nAlert('xlsxMissing'); return; }
  var d = collectFn();
  if (!d.rows.length) { _i18nAlert('noValidDataCalc'); return; }
  ensureXlsx().then(function() {
    var meta = getReportMeta();
    var ws = XLSX.utils.aoa_to_sheet(buildFn(d, meta));
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, metaFilename(moduleKey, meta) + '.xlsx');
    flashEl('debug-tag', i18n('flashExcelExported'));
  // v54.238 fix: 加 .catch 防止 XLSX 写盘失败抛 unhandledrejection
  }).catch(function(err){ console.error('[export] xlsx failed', err); if(typeof _i18nToast === 'function') _i18nToast('toast_xlsxLoadFail', 'error', 5000); });
}
function ensureXlsx() {
  return new Promise(function(resolve) {
    if (typeof XLSX !== 'undefined') { resolve(XLSX); return; }
    // 极端情况：CDN 异步加载时轮询（每 100ms 检查一次，最多 5s）
    var tries = 0;
    var iv = setInterval(function() {
      tries++;
      if (typeof XLSX !== 'undefined') { clearInterval(iv); resolve(XLSX); }
      else if (tries >= 50) { clearInterval(iv); resolve(null); }
    }, 100);
  });
}

function exportNormExcel() { return _withBtnLoading(function(){ _exportModuleExcel(collectNormData, buildNormReport, 'normalize', i18n('cvSheetNorm')); }).apply(this, arguments); }

function exportExtExcel() { return _withBtnLoading(function(){ _exportModuleExcel(collectExtData, buildExtReport, 'external', i18n('cvSheetExt')); }).apply(this, arguments); }

function exportIntExcel() { return _withBtnLoading(function(){ _exportModuleExcel(collectIntData, buildIntReport, 'internal', i18n('cvSheetInt')); }).apply(this, arguments); }

// v54.95 5 module export*Excel（接 v54.93 build*Report + v54.94 collect*Data，复用 v54.86 _exportModuleExcel）
function exportDryingExcel()    { return _withBtnLoading(function(){ _exportModuleExcel(collectDryingData,    buildDryingReport,    'drying',    i18n('cvSheetDrying')); }).apply(this, arguments); }
function exportResidueExcel()   { return _withBtnLoading(function(){ _exportModuleExcel(collectResidueData,   buildResidueReport,   'residue',   i18n('cvSheetResidue')); }).apply(this, arguments); }
function exportTiterExcel()     { return _withBtnLoading(function(){ _exportModuleExcel(collectTiterData,     buildTiterReport,     'titer',     i18n('cvSheetTiter')); }).apply(this, arguments); }
function exportUniformityExcel(){ return _withBtnLoading(function(){ _exportModuleExcel(collectUniformityData,buildUniformityReport,'uniformity',i18n('cvSheetUniformity')); }).apply(this, arguments); }
function exportDissolutionExcel(){ return _withBtnLoading(function(){ _exportModuleExcel(collectDissolutionData,buildDissolutionReport,'dissolution',i18n('cvSheetDissolution')); }).apply(this, arguments); }

// v54.254 cleanup: 删除 4 个死代码适配器 normEntryToData / extEntryToData / intEntryToData / selfRefEntryToData
// 扫描确认：全仓（app.js + 两个 HTML + tests）无任何调用方 → 删除。
// （注：同族的 buildSelfRefReport 虽同样无调用方，但被 tests/e2e_puppeteer_audit_round8.py #11 源码级断言保护，故保留。）
// 另注：原 normEntryToData 中 `!Number.isFinite(...)` 与 `.filter(v => !Number.isFinite(v))` 逻辑反转，
//   属从未被执行的潜伏 bug，删除后不再有误用风险。
// v54.253 fix (Round final #3): history 日期分组键提取统一 helper
// renderHistory（dateCounts 预计算）与 _selectEntriesByDate（"选此日期"）原本各自内联同一 regex，
// 任何改动都需双改，极易失同步 → 抽出 helper 保证两处 dateKey 永远一致。
// 主路径：YYYY[/-]M[/-]D（zh-CN toLocaleString 与 ISO date-only 前缀）。
// fallback：ISO 8601（`YYYY-MM-DD HH:MM:SS` 空格分隔 / `YYYY-MM-DDTHH:MM:SS[.sss][Z|±HH:MM]` /
//           基本格式 `YYYYMMDDT...`）、`.` 分隔（YYYY.MM.DD）、以及 en-US 的 M/D/YYYY
//           （语言为 en 时 _nowStr() 生成该格式，旧 regex 全部落入 otherGroup）。
// 返回去前导零的 'YYYY/M/D'（与旧行为一致），无法识别时返回 i18n('otherGroup')。
function _historyDateKey(t) {
  var s = (t == null ? '' : String(t)).replace(/^\s+/, '');
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return m[1] + '/' + parseInt(m[2], 10) + '/' + parseInt(m[3], 10);
  // fallback 1: ISO 8601 带分隔符（T 或空格后接时间，或纯日期结尾）
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?=[T\s]|$)/);
  if (m) return m[1] + '/' + parseInt(m[2], 10) + '/' + parseInt(m[3], 10);
  // fallback 2: ISO 8601 基本格式 YYYYMMDD + T/空格
  m = s.match(/^(\d{4})(\d{2})(\d{2})(?=[T\s]|$)/);
  if (m) return m[1] + '/' + parseInt(m[2], 10) + '/' + parseInt(m[3], 10);
  // fallback 3: 点分隔 YYYY.MM.DD
  m = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m) return m[1] + '/' + parseInt(m[2], 10) + '/' + parseInt(m[3], 10);
  // fallback 4: en-US M/D/YYYY（年不在首位）
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?=[,\s]|$)/);
  if (m) return m[3] + '/' + parseInt(m[1], 10) + '/' + parseInt(m[2], 10);
  return i18n('otherGroup');
}renderHistory = function() {
  // v54.70 防御：history-list 容器缺失时 TypeError 被吞
  const container = document.getElementById('history-list');
  if (!container) return;
  // v54.274 perf#7: hoist 循环内常量 i18n 调用（500 entries × ~20 i18n = ~10K dict 查 → 23 次）
  const _iOtherGroup = i18n('otherGroup');
  const _iEmptyTitle = i18n('emptyHistoryTitle'), _iEmptySub = i18n('emptyHistorySubtitle'), _iDemoBtn = i18n('loadDemoBtn');
  const _iEmptyFilterTitle = i18n('emptyFilterTitle') || '无匹配记录', _iEmptyFilterSub = i18n('emptyFilterSubtitle') || '请尝试其他关键字或清除筛选'; // v54.284 Phase 5 fallback
  const _iFilterCountFmt = i18n('filterCountFmt') || '{0} / {1}';
  const _iDateTpl = i18n('dateGroupFmt'), _iDateSelBtn = i18n('dateSelectBtn');
  const _iAriaSel = i18n('ariaSelectHistoryEntry');
  const _iHData = i18n('hData'), _iHMean = i18n('hMean'), _iHSd = i18n('hSd'), _iHRsd = i18n('hRsd');
  const _iHStdPrefix = i18n('hStdPrefix'), _iHMoist = i18n('hMoistureFmt'), _iHRes = i18n('hResidueFmt');
  const _iHSample = i18n('hSample'), _iHParallels = i18n('hParallelsLabel');
  const _iHNStd = i18n('hNormStd'), _iHNAreaPcts = i18n('hNormAreaPcts'), _iHCMean = i18n('hCMean');
  const _iHNSampIndep = i18n('hNormSampleIndep'), _iHNSampShared = i18n('hNormSampleShared');
  const _iHRegTpl = i18n('hRegressionFmt'), _iHCorrTpl = i18n('hCorrFactorFmt');
  const _iHManual = i18n('hManual'), _iHAuto = i18n('hAuto');
  const _iHCSd = i18n('hCSd'), _iHCRsd = i18n('hCRsd');
  const _iHW0 = i18n('hW0'), _iHW1 = i18n('hW1'), _iHW2 = i18n('hW2');
  const _iHDryS = i18n('hDryingSample');
  const _iHTStd = i18n('hTiterStd'), _iHTVs = i18n('hTiterVs'), _iHTV0s = i18n('hTiterV0s');
  const _iHTM = i18n('hTiterM'), _iHTParallel = i18n('hTiterParallel');
  const _iHTheory = i18n('hTheoryFmt'), _iHMeasured = i18n('hMeasuredFmt');
  // v54.282 perf: hoist Round 35 audit 标记未 hoist 的 14 处（被 v54.275 perf#7 漏掉，主要在 5 个 block type + action buttons + batch bar）
  const _iHRecoveryLabel = i18n('hRecoveryLabel'), _iHSampleCount = i18n('hSampleCount'), _iHTheoryShort = i18n('hTheoryShort');
  const _iHUniformL = i18n('hUniformL'), _iHUniformXbar = i18n('hUniformXbar'), _iHUniformAS = i18n('hUniformAS');
  const _iHDissLabel = i18n('hDissLabel');
  const _iHCurveReg = i18n('hCurveRegressionFmt'), _iHCurveDP = i18n('hCurveDataPoint');
  const _iBtnLoad = i18n('btnLoadHistory'), _iBtnDetails = i18n('btnDetails'), _iBtnDelete = i18n('btnDelete'), _iBtnCopyJson = i18n('btnCopyJson');
  const _iBatchFmt = i18n('batchCountFmt'), _iBatchSelPage = i18n('batchSelectPage'), _iBatchSelAll = i18n('batchSelectAll'), _iBatchDeselect = i18n('batchDeselect'), _iBatchDelete = i18n('batchDelete'), _iBatchExport = i18n('batchExport'), _iBatchExportMd = i18n('batchExportMd'), _iBatchImport = i18n('batchImport');
  // v54.283 perf: hoist _iAriaSelEsc（30 checkbox × _esc() × 5 regex replace = 150 regex evaluations → 1）
  const _iAriaSelEsc = _esc(_iAriaSel) + ' ';
  // v54.285 P1-D: hoist _typeI18n(e.type) 调用（line 3672 之前是 `i18n(_typeI18n(e.type))` 动态 key，每次循环都 dict 查 2 次 + map 查 1 次 → 改为预计算 map）
  const _iHTypeLabels = (function(){ var m = {}; for (var k in _HIST_TYPE_I18N_KEY) m[k] = i18n(_HIST_TYPE_I18N_KEY[k]); return m; })();
  let h = getH();  // v54.284 Phase 5: let（filter 后 reassign）
  // v54.250 fix (correctness LOW): 防御 getH() 返回非数组（localStorage 损坏 / 外部脚本修改 / 跨 tab 同步中途）
  // 早期 .filter/.map/.forEach 拿到非数组直接抛 TypeError，UI 出现空白页
  // v54.284 Phase 5: 改 const → let（要 reassign filter 后数组）
  if (!Array.isArray(h)) h = [];
  // v54.284 Phase 5: apply history filter（filter by search keyword + type）
  const _totalCount = h.length;
  if (_historyFilter.search || _historyFilter.type) {
    const _kw = _historyFilter.search;
    const _tp = _historyFilter.type;
    h = h.filter(function(e) {
      if (!e || typeof e !== 'object') return false;
      if (_tp && e.type !== _tp) return false;
      if (_kw) {
        // 搜索 JSON 序列化后全文（含 method/data/analyte/matrix/note 等字段）
        try {
          const blob = JSON.stringify(e).toLowerCase();
          if (blob.indexOf(_kw) === -1) return false;
        } catch (_) { return false; }
      }
      return true;
    });
  }
  // 更新 filter-count UI（如存在）
  const _fcount = document.getElementById('history-filter-count');
  if (_fcount) {
    try {
      _fcount.textContent = _iFilterCountFmt.replace('{0}', String(h.length)).replace('{1}', String(_totalCount));
    } catch (_) {}
  }
  if (_totalCount === 0) {
    container.innerHTML = emptyState(_ICON_INBOX, _iEmptyTitle, _iEmptySub, '<button class="btn btn-primary btn-sm" onclick="loadDemoData()">' + _iDemoBtn + '</button>');
    _historyPage = 1;
    updCount();
    return;
  }
  if (h.length === 0) {
    // v54.284 Phase 5: filter 后无匹配 vs 完全无历史 — 显示不同文案
    const _clearBtn = '<button class="btn btn-outline btn-sm" onclick="setHistoryFilter({search:String.fromCharCode(39),type:String.fromCharCode(39)})">' + (i18n('filterClear') || '清除筛选') + '</button>';
    container.innerHTML = emptyState(_ICON_SEARCH, _iEmptyFilterTitle, _iEmptyFilterSub, _clearBtn);
    _historyPage = 1;
    updCount();
    return;
  }
  // 性能 + 体验：分页渲染（每页 _historyPageSize=30 条，超出显示分页器）
  const totalPages = Math.max(1, Math.ceil(h.length / _historyPageSize));
  if (_historyPage > totalPages) _historyPage = totalPages;
  const pageStart = (_historyPage - 1) * _historyPageSize;
  const pageEnd = Math.min(pageStart + _historyPageSize, h.length);
  const visible = h.slice(pageStart, pageEnd);
  // v54.121 跨页批量：内存 Set 记录所有选中 idx（不受 renderHistory 重渲染影响）
  // v54.123 优先从 localStorage 恢复选中状态（跨页面/刷新保留）
  if (typeof window._batchSelected !== 'object' || window._batchSelected === null) {
    window._batchSelected = _loadBatchSelected();
  }
  const _selected = window._batchSelected;
  // v54.116 按日期分组：预计算全列表的 date→count 映射（避免每条都 filter 一次）
  // v54.243 perf: 按 history 数组引用键化缓存（addH/deleteSingle/clearHistory/_batchDeleteSelected 失效）
  // v54.246 perf: 同时缓存 dateKeys[idx] 避免渲染循环重复 regex 匹配
  if(!_dateCountsCache || _dateCountsCache.h !== h){
   _dateCountsCache = { h: h, counts: {}, dateKeys: {} };
   h.forEach(function(e, idx){
    if(!e || typeof e !== 'object') return;
    const _dk = _historyDateKey(e.time);  // v54.253 fix #3: 统一 helper（含 ISO 8601 / locale fallback）
    _dateCountsCache.counts[_dk] = (_dateCountsCache.counts[_dk] || 0) + 1;
    _dateCountsCache.dateKeys[idx] = _dk;
   });
  }
  const _dateCounts = _dateCountsCache.counts;
  // v54.124 折叠状态持久化：渲染时根据 localStorage Set 加 .collapsed class
  const _collapsed = _loadCollapsedGroups();
  let _lastDate = '';
  let _isColl = false;
  // 性能优化：用数组 push + join 替代字符串 +=（500 条记录时 10-50x 提速）
  const parts = [];
  visible.forEach((e, i) => {
    // v54.24 防御：localStorage 损坏/外部修改可能含 null/string/非对象 entry
    if (!e || typeof e !== 'object') return;
    // v54.246 perf: absoluteIdx 前移 + 复用 _dateCountsCache.dateKeys 避免重复 regex 匹配
    const absoluteIdx = pageStart + i;
    // v54.116 按日期分组：日期变化时插入 group header（dateKey 已在 dateCountsCache 预计算）
    const _dateKey = _dateCountsCache.dateKeys[absoluteIdx] || _iOtherGroup;
    if (_dateKey !== _lastDate) {
      _isColl = _collapsed.has(_dateKey);
      // v54.124 加箭头 ▼（默认展开态，collapsed 时旋转 -90° → ▶）+ v54.122 加"选此日期"按钮 + v54.129 i18n 化
      const _hdrTpl = _iDateTpl;
      const _hdrText = _iDateTpl.replace('{0}', _esc(_dateKey)).replace('{1}', String(_dateCounts[_dateKey] || 0)); /* v54.282 perf: .split().join() chain → .replace() 链 */
      parts.push('<div class="h-date-group-row"><button type="button" class="h-date-group' + (_isColl ? ' collapsed' : '') + '" data-date="' + _esc(_dateKey) + '" aria-expanded="' + (_isColl ? 'false' : 'true') + '"><span class="h-date-arrow" aria-hidden="true">▼</span>' + _hdrText +
        '</button>' +
        '<button type="button" class="btn btn-outline btn-xs h-date-select" data-action="select-date" data-date="' + _esc(_dateKey) + '">' + _iDateSelBtn + '</button>' +
        '</div>');
      _lastDate = _dateKey;
      // v54.118 多选 checkbox：absoluteIdx 写入 data-idx（与事件委托 load/delete/details 共用）
      // v54.121 跨页保留 checked 状态：从 _selected Set 读取
    }
    let tc = 'h-type-stats';
    if (e.type === '含量计算' || e.type === '外标含量') tc = 'h-type-content';
    else if (e.type && e.type.startsWith('回收率')) tc = 'h-type-stats';
    parts.push('<div class="history-item' + (_isColl ? ' group-collapsed' : '') + '" data-group-date="' + _esc(_dateKey) + '">');
    // v54.118 多选 checkbox：absoluteIdx 写入 data-idx（与事件委托 load/delete/details 共用）
    // v54.121 跨页保留 checked 状态：从 _selected Set 读取
    parts.push('<span class="h-checkbox-wrap"><input type="checkbox" class="h-checkbox" data-idx="' + absoluteIdx + '"' + (_selected.has(absoluteIdx) ? ' checked' : '') + ' aria-label="' + _iAriaSelEsc + (i+1) + '" data-i18n-aria-label="ariaSelectHistoryEntry"></span>'); /* v54.273 fix: h-checkbox 加 i18n aria-label（forEach callback 是 (e,i) 不是 (e,j)）；v54.283 perf: 复用 _iAriaSelEsc 不再每行 _esc */
    const _dl = _iHTypeLabels[e.type] || e.type; parts.push('<span class="history-type '+_esc(tc)+'">'+_esc(_dl)+'</span><span class="h-time">'+_esc(e.time)+'</span>'); /* v54.285 P1-D: i18n hoist → _iHTypeLabels map */
    // v54.78 报告元数据增强：每条 entry 显示 _meta 快照（样品名/ID/批号/检测员/仪器/日期）
    if (e._meta && (e._meta.sampleName || e._meta.sampleId || e._meta.batch || e._meta.operator || e._meta.instrument || e._meta.column || e._meta.date)) {
      // v54.110 meta band 强化：抽 helper + 支持 column
      parts.push(_renderMetaBand(e._meta));
    }
    if (e.type === '统计计算') {
      parts.push('<div class="h-values">'+_iHData+_esc(e.data)+'</div>');
      // v54.244 fix: e.rsd 可能为 null（mean=0 时），UI 显示 ——
      const _rsdDisplay = (e.rsd == null || e.rsd === 'null') ? '—' : _fmtNum(_esc(e.rsd), 2) + '%';
      parts.push('<div class="h-results"><span>'+_iHMean+_fmtNum(_esc(e.mean), 4)+'</span><span>'+_iHSd+_fmtNum(_esc(e.sd), 4)+'</span><span>'+_iHRsd+_rsdDisplay+'</span></div>');
    } else if (e.type === '含量计算' || e.type === '外标含量') {
      const stdM = e.stdMoisture || '0'; const stdR = e.stdResidue || '0';
      parts.push('<div class="h-values">' + _iHStdPrefix + 'A='+_esc(e.stdArea)+' W='+_esc(e.stdWeight)+_weightUnitSuffix()+' P='+_esc(e.stdPurity)+'% D='+_esc(e.stdDilution)+'mL '+_iHMoist+stdM+'% '+_iHRes+stdR+'%</div>');
      (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
        if (Array.isArray(s.parallels)) {
          parts.push('<div class="h-values">'+_iHSample+(j+1)+': W='+_esc(s.weight)+' D='+_esc(s.dilution)+' | '+_iHParallels+' '+s.parallels.map(p=>'A='+_esc(p.area)).join(', ')+'</div>');
        } else {
          parts.push('<div class="h-values">'+_iHSample+(j+1)+': A='+_esc(s.area)+' W='+_esc(s.weight)+' D='+_esc(s.dilution)+' '+_iHMoist+_esc(s.moisture)+'% '+_iHRes+_esc(s.residue)+'%</div>');
        }
      });
    } else if (e.type === '回收率-面积归一化法') {
      // v54.229 fix: stdMoisture/stdResidue 是用户输入 → _esc 防 XSS
      parts.push('<div class="h-values">' + _iHNStd + 'W='+_esc(e.stdWeight)+_weightUnitSuffix()+' P='+_esc(e.stdPurity)+'% D='+_esc(e.stdDilution)+'mL '+_iHMoist+_esc(e.stdMoisture||'0')+'% '+_iHRes+_esc(e.stdResidue||'0')+'%</div>');
      parts.push('<div class="h-values">' + _iHNAreaPcts + ((Array.isArray(e.stdAreaPcts) ? e.stdAreaPcts : []).map(function(r){return _fmtNum(r,2);})).join(', ') + ' | ' + _iHCMean + _fmtNum(_esc(e.stdAreaAvg), 2) + '%</div>');
      if (e.independent) {
        parts.push('<div class="h-values">' + _iHNSampIndep + ' ');
        (Array.isArray(e.splSamples) ? e.splSamples : []).forEach((s,j)=>{ parts.push('#'+(j+1)+'[W='+_esc(s.weight)+' D='+_esc(s.dilution)+' A%='+_esc(s.areaPct)+'] '); });
        parts.push('</div>');
      } else {
        if (Array.isArray(e.splSamples) && e.splSamples.length > 0) {
          parts.push('<div class="h-values">' + _iHNSampShared + ' ');
          e.splSamples.forEach((s,j)=>{ parts.push('#'+(j+1)+'[W='+_esc(s.weight)+' D='+_esc(s.dilution)+' A%='+_esc(s.areaPct)+'] '); });
          parts.push('</div>');
        } else {
          parts.push('<div class="h-values">' + _iHNSampShared + ' W='+_esc(e.splWeight)+'mg D='+_esc(e.splDilution)+'mL | A%: '+((Array.isArray(e.splAreaPcts) ? e.splAreaPcts : []).map(function(r){return _fmtNum(r,2);})).join(', ')+'</div>');
        }
      }
      if (e.regression && e.regression.r) {
        parts.push('<div class="h-values">' + _iHRegTpl.replace('{0}', e.regression.a).replace('{1}', e.regression.b).replace('{2}', e.regression.r) + '</div>'); /* v54.282 perf: split/join chain → .replace() 链 */
      }
      parts.push('<div class="h-values">' + _iHCorrTpl.replace('{0}', e.manualF||e.calcF||'—').replace('{1}', e.manualF ? _iHManual : _iHAuto) + '</div>'); /* v54.282 perf: split/join chain → .replace() 链 */
      parts.push('<div class="h-results">');
      (Array.isArray(e.recoveries) ? e.recoveries : []).forEach((r,j)=>{ parts.push('<span>' + _iHSample + (j+1) + ': ' + _fmtNum(_esc(r), 2) + '%</span>'); });
      parts.push('</div>');
      if (e.count >= 2 && e.cMean) {
        parts.push('<div class="h-results" style="margin-top:2px"><span>' + _iHCMean + _fmtNum(_esc(e.cMean), 2) + '%</span><span>' + _iHCSd + _fmtNum(_esc(e.cSd), 4) + '</span><span>' + _iHCRsd + _fmtNum(_esc(e.cRsd), 2) + '%</span></div>');
      }
    } else if (e.type === '干燥失重') {
      (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
        parts.push('<div class="h-values">' + _iHDryS + (j+1) + ': ');
        if (Array.isArray(s.parallels)) {
          parts.push(s.parallels.map(p => _iHW0+_esc(p.w0)+' '+_iHW1+_esc(p.w1)+' '+_iHW2+_esc(p.w2)).join(' | '));
        } else {
          // v54.232 fix (Round 4 B.I1): _esc 防止 w0/w1/w2 用户输入触发 XSS（备份/同步来源）
          parts.push(_iHW0+_esc(s.w0||'')+' '+_iHW1+_esc(s.w1||'')+' '+_iHW2+_esc(s.w2||''));
        }
        parts.push('</div>');
      });
    } else if (e.type === '炽灼残渣') {
      (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
        parts.push('<div class="h-values">' + _iHDryS + (j+1) + ': ');
        if (Array.isArray(s.parallels)) {
          parts.push(s.parallels.map(p => _iHW0+_esc(p.w0)+' '+_iHW1+_esc(p.w1)+' '+_iHW2+_esc(p.w2)).join(' | '));
        } else {
          // v54.232 fix (Round 4 B.I1): 同上
          parts.push(_iHW0+_esc(s.w0||'')+' '+_iHW1+_esc(s.w1||'')+' '+_iHW2+_esc(s.w2||''));
        }
        parts.push('</div>');
      });
    } else if (e.type === '滴定度') {
      // v54.232 fix (Round 4 B.I1): vs/v0s/ms/ps/f/T 都是用户输入，全部 _esc
      parts.push('<div class="h-values">' + _iHTStd + _iHTVs + _esc(e.vs||'') + ' ' + _iHTV0s + _esc(e.v0s||'') + ' ' + _iHTM + _esc(e.ms||'') + ' P='+_esc(e.ps||'')+' F='+_esc(e.f||'')+' T='+_esc(e.T||_iHAuto)+'</div>');
      (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
        const pls = Array.isArray(s.parallels) ? s.parallels : [];
        parts.push('<div class="h-values">' + _iHDryS + (j+1) + ': ' + _iHTParallel + ' '+pls.map((p,pi)=>'#'+(pi+1)+'[W='+_esc(p.w)+' V0='+_esc(p.v0)+' V='+_esc(p.v)+']').join(' ')+'</div>');
      });
    } else if (e.type === '回收率-简易') {
      parts.push('<div class="h-values">' + _iHTheory + _esc(e.theory) + '% | ' + _iHMeasured + _esc(e.measured) + '%</div>');
      parts.push('<div class="h-results"><span>' + _iHRecoveryLabel + _esc(e.recovery) + '%</span></div>'); /* v54.282 perf: hoist */
    } else if (e.type === '回收率-外标法') {
      parts.push('<div class="h-values">' + _iHStdPrefix + 'A='+_esc(e.stdArea)+' W='+_esc(e.stdWeight)+_weightUnitSuffix()+' P='+_esc(e.stdPurity)+'% D='+_esc(e.stdDilution)+'mL</div>');
      parts.push('<div class="h-values">' + _iHSampleCount + _esc(e.count) + ' | '); /* v54.282 perf: hoist */
      if (Array.isArray(e.samples)) {
        // v54.232 fix (Round 4 B.I1): s.theory 漏 _esc
        e.samples.forEach((s, j) => { parts.push('#'+(j+1)+'[A='+_esc(s.area)+' W='+_esc(s.weight)+' D='+_esc(s.dilution)+_iHTheoryShort+_esc(s.theory)+'%] '); }); /* v54.282 perf: hoist */
      } else {
        parts.push('—');
      }
      parts.push('</div>');
      parts.push('<div class="h-results">');
      if (Array.isArray(e.recoveries)) {
        e.recoveries.forEach((r, j) => { parts.push('<span>' + _iHSample + (j+1) + ': ' + _fmtNum(_esc(r), 2) + '%</span>'); });
      }
      parts.push('</div>');
      if (e.count >= 2 && e.cMean) {
        parts.push('<div class="h-results" style="margin-top:2px"><span>' + _iHCMean + _fmtNum(_esc(e.cMean), 2) + '%</span><span>' + _iHCSd + _fmtNum(_esc(e.cSd), 4) + '</span><span>' + _iHCRsd + _fmtNum(_esc(e.cRsd), 2) + '%</span></div>');
      }
    } else if (e.type === '回收率-内标法') {
      // v54.229 fix: stdIsArea/stdConc 是用户输入（gv()），直接拼接有 XSS
      parts.push('<div class="h-values">' + _iHStdPrefix + 'A='+_esc(e.stdArea)+' IS_A='+_esc(e.stdIsArea)+' Conc='+_esc(e.stdConc)+'mg/mL</div>');
      parts.push('<div class="h-values">' + _iHSampleCount + _esc(e.count) + ' | '); /* v54.282 perf: hoist */
      if (Array.isArray(e.samples)) {
        e.samples.forEach((s, j) => { parts.push('#'+(j+1)+'[A='+_esc(s.area)+' IS_A='+_esc(s.isArea)+_iHTheoryShort+_esc(s.theory)+'] '); }); /* v54.282 perf: hoist */
      } else {
        parts.push('—');
      }
      parts.push('</div>');
      parts.push('<div class="h-results">');
      if (Array.isArray(e.recoveries)) {
        e.recoveries.forEach((r, j) => { parts.push('<span>' + _iHSample + (j+1) + ': ' + _fmtNum(_esc(r), 2) + '%</span>'); });
      }
      parts.push('</div>');
      if (e.count >= 2 && e.cMean) {
        parts.push('<div class="h-results" style="margin-top:2px"><span>' + _iHCMean + _fmtNum(_esc(e.cMean), 2) + '%</span><span>' + _iHCSd + _fmtNum(_esc(e.cSd), 4) + '</span><span>' + _iHCRsd + _fmtNum(_esc(e.cRsd), 2) + '%</span></div>');
      }
    } else if (e.type === '含量均匀度') {
      // v54.232 fix (Round 4 B.I1): L/xbar/A/S/AS/verdict 全部 _esc
      parts.push('<div class="h-values">' + _iHUniformL + _esc(e.L||'') + ' | ' + _iHUniformXbar + _esc(e.xbar||'') + '% | A=' + _esc(e.A||'') + ' | S=' + _esc(e.S||'') + '</div>'); /* v54.282 perf: hoist */
      parts.push('<div class="h-values">' + _iHUniformAS + _esc(e.AS||'') + ' | ' + _iHUniformVerdict + _esc(e.verdict||'') + '</div>'); /* v54.282 perf: hoist */
      (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
        const pls = Array.isArray(s.parallels) ? s.parallels : [];
        parts.push('<div class="h-values">' + _iHDryS + (j+1) + ': ' + pls.map(p => _esc(p.content)).join(', ') + '</div>');
      });
    } else if (e.type === '溶出度') {
      // v54.232 fix (Round 4 B.I1): e.label _esc
      parts.push('<div class="h-values">' + _iHDissLabel + _esc(e.label||'') + '%</div>'); /* v54.282 perf: hoist */
      (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
        const pls = Array.isArray(s.parallels) ? s.parallels : [];
        parts.push('<div class="h-values">' + _iHDryS + (j+1) + ': ' + pls.map(p => _esc(p.content)).join(', ') + '</div>');
      });
      parts.push('<div class="h-results"><span>' + _iHCMean + _fmtNum(e.mean, 2) + '%</span><span>' + _iHCSd + _fmtNum(e.sd, 4) + '</span><span>' + _iHCRsd + _fmtNum(e.rsd, 2) + '%</span></div>');
    } else if (e.type === '标准曲线') {
      // v54.229 fix: a/b/r2 通常是数字，但从备份恢复时可能是任意字符串 → _esc 防 XSS
      parts.push('<div class="h-values">' + _iHCurveReg.replace('{0}', _esc(e.a||'')).replace('{1}', _esc(e.b||'')).replace('{2}', _esc(e.r2||'')) + '</div>'); /* v54.282 perf: hoist + .split()chain → .replace() */
      parts.push('<div class="h-values">' + _iHCurveDP + ((Array.isArray(e.points) ? e.points : []).map(function(p){ return '('+_esc(p.x)+','+_esc(p.y)+')'; }).join(', '))+'</div>'); /* v54.282 perf: hoist */
    }
    parts.push('<div class="h-actions">');
    parts.push('<button type="button" class="btn btn-outline btn-xs" data-action="load" data-idx="'+absoluteIdx+'">'+_iBtnLoad+'</button>'); /* v54.282 perf: hoist */
    // v54.117 entry 详情按钮：点击 toggle .h-details 同 idx 块
    // v54.246 a11y: 起始 aria-expanded="false"（展开后由委托 handler 同步）
    parts.push('<button type="button" class="btn btn-outline btn-xs h-details-toggle" data-action="details" data-idx="'+absoluteIdx+'" aria-expanded="false">'+_iBtnDetails+'</button>'); /* v54.282 perf: hoist */
    parts.push('<button type="button" class="btn btn-danger btn-xs" data-action="delete" data-idx="'+absoluteIdx+'">'+_iBtnDelete+'</button>'); /* v54.282 perf: hoist */
    parts.push('</div>');
    // v54.117 entry 详情折叠块：默认隐藏，_esc 防御 XSS
    // v54.120 详情折叠块：默认隐藏，_esc 防御 XSS + 复制按钮 + 内层 .h-details-content 包 JSON
parts.push('<div class="h-details' + (_isColl ? ' group-collapsed' : '') + '" data-group-date="' + _esc(_dateKey) + '" data-idx="'+absoluteIdx+'">' +
  '<button type="button" class="btn btn-outline btn-xs h-details-copy" data-action="copy-json" data-idx="' + absoluteIdx + '">'+_iBtnCopyJson+'</button>' + /* v54.282 perf: hoist */
  '<div class="h-details-content" data-loaded="0"></div>' +  /* v54.272 perf: lazy JSON.stringify — renderHistory was serializing every entry's full JSON (500 entries × ~10KB = 5MB) every render even though details are hidden by default */
  '</div>');
    parts.push('</div>');
  });
  // v54.128 批量删除操作条（始终显示，5 按钮 i18n 化）
  parts.unshift('<div class="h-batch-bar"><span class="h-batch-count">' + _iBatchFmt.replace('{0}', '0') + '</span>' + /* v54.282 perf: hoist + .split()chain → .replace() */
    '<button type="button" class="btn btn-outline btn-xs" data-batch-action="select-page">' + _iBatchSelPage + '</button>' + /* v54.282 perf: hoist */
    // v54.121 加"全选全部"按钮：跨页批量
    '<button type="button" class="btn btn-outline btn-xs" data-batch-action="select-all">' + _iBatchSelAll + '</button>' + /* v54.282 perf: hoist */
    '<button type="button" class="btn btn-outline btn-xs" data-batch-action="deselect">' + _iBatchDeselect + '</button>' + /* v54.282 perf: hoist */
    '<button type="button" class="btn btn-outline btn-xs" data-batch-action="export">' + _iBatchExport + '</button>' + /* v54.300 新增：批量导出选中条目为 JSON */
    '<button type="button" class="btn btn-outline btn-xs" data-batch-action="export-md">' + _iBatchExportMd + '</button>' + /* v54.302 新增：批量导出选中条目为 Markdown */
    '<button type="button" class="btn btn-outline btn-xs" data-batch-action="import">' + _iBatchImport + '</button>' + /* v54.304 新增：导入 JSON 备份 */
    '<button type="button" class="btn btn-danger btn-xs" data-batch-action="delete">' + _iBatchDelete + '</button>' + /* v54.282 perf: hoist */
    '</div>');
  container.innerHTML = parts.join('') + renderHistoryPagination(h.length);
  // v54.121 跨页：renderHistory 后立即更新 batch count（避免显示初始"已选 0 条"）
  _updateBatchCount();
  // v54.118 + v54.121 + v54.123 + v54.246 perf: 单次委托 change 监听（30 checkbox × N render 改 1 次总绑）
  if (!container._cbDelegateBound) {
    container._cbDelegateBound = true;
    container.addEventListener('change', function(e) {
      const cb = e.target.closest('.h-checkbox');
      if (!cb || !container.contains(cb)) return;
      const idx = parseInt(cb.dataset.idx, 10);
      if (!Number.isFinite(idx)) return;
      if (cb.checked) window._batchSelected.add(idx);
      else window._batchSelected.delete(idx);
      _updateBatchCount();
      _saveBatchSelected();  // v54.123 持久化
    });
  }
  // v54.243 perf: 只在 history tab 激活时才调度 drawTrendChart（避免隐藏 tab 时重建 Chart）
  var _hpActive = document.querySelector('.page.active');
  if(_hpActive && _hpActive.id === 'page-history') { /* v54.274 perf #12: 追踪 timer（renderHistory 是热路径：跨 tab 同步/增删/翻页均触发 → 旧代码排队多个 100ms timer） */
    if (typeof _trendDrawTimer !== 'undefined' && _trendDrawTimer) clearTimeout(_trendDrawTimer);
    _trendDrawTimer = setTimeout(function(){ drawTrendChart(); }, 100);
  }
  updCount();
};

// v54.121 跨页批量删除 helper：从 _batchSelected Set 收集 idx → 一次确认 + 倒序 splice
async function _batchDeleteSelected() {
  const _sel = window._batchSelected;
  if (!_sel || _sel.size === 0) return;
  // v54.242 fix: 增加 n < h.length 守卫，防止跨 tab 同步后 stale idx (n >= h.length) 静默 splice 失败（h.splice 返回 [] 仍被处理）
  const h = getH();
  const idxs = Array.from(_sel).filter(function(n) { return Number.isInteger(n) && n >= 0 && n < h.length; });
  if (idxs.length === 0) return;
  // idx 倒序排序（从大到小 splice，避免索引偏移）
  idxs.sort(function(a, b) { return b - a; });
  if (!await _confirmDialog(i18n('uiDeleteConfirmStart') + idxs.length + i18n('uiDeleteConfirmEnd'), { danger: true })) return;
  for (let i = 0; i < idxs.length; i++) {
    h.splice(idxs[i], 1);
  }
  setH(h);
  _dateCountsCache = null;
  _extractChartDataCache = { sig: '', data: null };  // v54.250: 批量删除后失效 chart 缓存
  _sel.clear();  // v54.121 删除后清空选中状态
  _saveBatchSelected();  // v54.123 删除后清空持久化（_sel.clear() → 自动 removeItem）
  updCount();
  renderHistory();
  _i18nToast('toast_batchDeleted', 'success', 2000, idxs.length);
}

// v54.300 新增：批量导出选中条目为 JSON 文件（包含 metadata + items 数组）
function _batchExportSelected() {
  const _sel = window._batchSelected;
  if (!_sel || _sel.size === 0) { _i18nToast('toast_batchSelectAll', 'info', 1500, 0); return; }
  const h = getH();
  const idxs = Array.from(_sel).filter(function(n) { return Number.isInteger(n) && n >= 0 && n < h.length; }).sort(function(a, b) { return a - b; });
  if (idxs.length === 0) { _i18nToast('toast_batchSelectAll', 'info', 1500, 0); return; }
  const items = idxs.map(function(i) { return h[i]; });
  const now = new Date();
  const payload = {
    schema: 'rsd-history-export',
    version: '1.0.0',
    exportedAt: now.toISOString(),
    count: items.length,
    items: items,
  };
  const jsonText = JSON.stringify(payload, null, 2);
  const fname = 'rsd-history-' + now.toISOString().slice(0, 10) + '-' + items.length + 'items.json';
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  _i18nToast('toast_batchExportFmt', 'success', 3000, items.length, fname);
}

// v54.302 新增：批量导出选中条目为 Markdown（per-type 渲染器）
function _batchExportSelectedMd() {
  const _sel = window._batchSelected;
  if (!_sel || _sel.size === 0) { _i18nToast('toast_batchSelectAll', 'info', 1500, 0); return; }
  const h = getH();
  const idxs = Array.from(_sel).filter(function(n) { return Number.isInteger(n) && n >= 0 && n < h.length; }).sort(function(a, b) { return a - b; });
  if (idxs.length === 0) { _i18nToast('toast_batchSelectAll', 'info', 1500, 0); return; }
  const items = idxs.map(function(i) { return h[i]; });
  if (typeof exportHistoryBatchMarkdown === 'function') {
    exportHistoryBatchMarkdown(items);
  } else {
    _i18nAlert('csvHelperMissing');
  }
}

// v54.304 新增：批量导入 JSON 备份 — 触发隐藏文件 input
function _triggerBatchImport() {
  // 创建或复用隐藏的 file input
  let input = document.getElementById('_batch_import_input');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.id = '_batch_import_input';
    input.style.display = 'none';
    document.body.appendChild(input);
  }
  input.value = '';  // 允许重新选择同一文件
  input.onchange = function(e) {
    const file = e.target.files && e.target.files[0];
    if (file) _handleBatchImportFile(file);
  };
  input.click();
}

// v54.304 新增：读取 + 验证 + 合并 JSON 备份
async function _handleBatchImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    let payload;
    try {
      payload = JSON.parse(e.target.result);
    } catch (err) {
      _i18nToast('toast_batchImportInvalidJson', 'error', 4000, err.message);
      return;
    }
    // 验证 schema
    if (!payload || payload.schema !== 'rsd-history-export') {
      _i18nToast('toast_batchImportSchemaMismatch', 'error', 4000);
      return;
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      _i18nToast('toast_batchImportEmpty', 'error', 4000);
      return;
    }
    // 确认对话框
    const h = getH();
    const confirmMsg = i18n('uiBatchImportConfirmFmt').replace('{0}', payload.items.length).replace('{1}', h.length);
    if (!await _confirmDialog(confirmMsg, { danger: false })) return;
    // 合并：去重（同 time+type+data 视为重复）
    const existing = new Set(h.map(function(it) { return (it.time || '') + '|' + (it.type || '') + '|' + (it.data || ''); }));
    let skipped = 0;
    const newItems = [];
    for (let i = 0; i < payload.items.length; i++) {
      const it = payload.items[i];
      if (!it || typeof it !== 'object') { skipped++; continue; }
      const key = (it.time || '') + '|' + (it.type || '') + '|' + (it.data || '');
      if (existing.has(key)) { skipped++; continue; }
      existing.add(key);
      newItems.push(it);
    }
    // 合并到 history（追加到前面 — 较新在前面）
    h.unshift.apply(h, newItems);
    setH(h);
    _dateCountsCache = null;
    _extractChartDataCache = { sig: '', data: null };
    updCount();
    renderHistory();
    if (skipped > 0) {
      _i18nToast('toast_batchImportSkipFmt', 'info', 4000, skipped);
    }
    _i18nToast('toast_batchImportSuccessFmt', 'success', 4000, newItems.length, h.length - newItems.length);
  };
  reader.onerror = function() {
    _i18nToast('toast_fileReadFail', 'error', 4000);
  };
  reader.readAsText(file);
}

// v54.118 + v54.121 跨页 + v54.128 i18n：批量操作条"已选 N 条"实时更新（从 _batchSelected Set size 读 + i18n 占位符）
function _updateBatchCount() {
  const cnt = window._batchSelected ? window._batchSelected.size : 0;
  const bar = document.querySelector('.h-batch-bar .h-batch-count');
  if (bar) bar.textContent = i18n('batchCountFmt').replace('{0}', String(cnt)); /* v54.282 perf: split/join chain → .replace() 链 */
}

// v54.119 group 折叠：toggle 同日期 entry 可见性（CSS 通过 .group-collapsed 隐藏）
// v54.243 a11y: h-date-group 现在是 <button>，同步 aria-expanded
function _toggleDateGroup(dateKey) {
  // v54.244 fix (Round 8 #9): dateKey 含 " 时直接拼到 selector 触发 SyntaxError
  // 用 CSS.escape 转义；旧浏览器无 CSS.escape 时退化为 \" 转义
  const _escKey = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(dateKey) : String(dateKey).replace(/(["\\])/g, '\\$1');
  const groupHeader = document.querySelector('.h-date-group[data-date="' + _escKey + '"]');
  if (!groupHeader) return;
  const collapsed = groupHeader.classList.toggle('collapsed');
  groupHeader.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  document.querySelectorAll('#history-list [data-group-date="' + _escKey + '"]').forEach(function(el) {
    el.classList.toggle('group-collapsed', collapsed);
  });
  _saveCollapsedGroups();  // v54.124 持久化
}

// v54.122 按日期批量选择：把指定日期的所有 entry idx 加到 _batchSelected
function _selectEntriesByDate(dateKey) {
  const h = getH();
  const _sel = window._batchSelected;
  if (!_sel) return 0;
  let cnt = 0;
  // 遍历全列表（不限当前页），按 dateKey 匹配
  h.forEach(function(e, idx) {
    if (!e || typeof e !== 'object') return;
    const _dk = _historyDateKey(e.time);  // v54.253 fix #3: 与 renderHistory 同 helper，保证 dateKey 一致
    if (_dk === dateKey) {
      _sel.add(idx);
      cnt++;
    }
  });
  // 重新渲染以更新当前页 checkbox 状态
  renderHistory();
  return cnt;
}

// v54.123 _batchSelected 持久化到 localStorage（跨页面/刷新保留选中状态）
const _BATCH_KEY = 'rsd-batch-selected';
function _saveBatchSelected() {
  // v54.282 perf (LOW-MEDIUM): debounce 200ms — 之前每次 checkbox toggle 都 localStorage.setItem（500 条 × 多次切换 → 频繁 IO）
  // 200ms 内多次调用合并为 1 次写盘
  if (_saveBatchTimer) clearTimeout(_saveBatchTimer);
  _saveBatchTimer = setTimeout(_doSaveBatchSelected, 200);
}
function _doSaveBatchSelected() {
  _saveBatchTimer = null;
  const _sel = window._batchSelected;
  if (!_sel || _sel.size === 0) {
    try { localStorage.removeItem(_BATCH_KEY); } catch (e) {}
    return;
  }
  try {
    localStorage.setItem(_BATCH_KEY, JSON.stringify(Array.from(_sel)));
  } catch (e) { /* localStorage 满/不可用静默 fallback */ }
}
function _loadBatchSelected() {
  try {
    const raw = localStorage.getItem(_BATCH_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    // 过滤：只保留当前 h 范围内的 idx（避免删除后 stale idx）
    const h = getH();
    const filtered = arr.filter(function(n) { return Number.isInteger(n) && n >= 0 && n < h.length; });
    return new Set(filtered);
  } catch (e) {
    return new Set();
  }
}

// v54.124 group 折叠状态持久化（跨刷新保留）
const _COLLAPSED_KEY = 'rsd-collapsed-groups';
function _saveCollapsedGroups() {
  const groups = document.querySelectorAll('#history-list .h-date-group.collapsed');
  if (groups.length === 0) {
    try { localStorage.removeItem(_COLLAPSED_KEY); } catch (e) {}
    return;
  }
  const dates = Array.from(groups).map(function(g) { return g.dataset.date; });
  try {
    localStorage.setItem(_COLLAPSED_KEY, JSON.stringify(dates));
  } catch (e) { /* 静默 fallback */ }
}
function _loadCollapsedGroups() {
  try {
    const raw = localStorage.getItem(_COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

// v54.125 跨 tab storage 同步：A tab 修改 localStorage → B tab 收到 storage 事件 → 重新渲染
// v54.227 扩展覆盖：rsd-calc-history/rsd-theme/rsd-lang（用户最常改的 3 个 key）
// v54.247 a11y: handler 用 `function(e)` 而非箭头，避免 this 绑定到错误上下文；
//               通过 _i18nToast() 走 aria-live="polite" container 让 SR 听到同步通知
// v54.252 a11y: 额外通过 _announceSettings() 走 #settings-status-live 全局 aria-live，
//               确保 SR 在任何焦点位置（即使 toast container 在视口外）都能听到同步通知
function _setupStorageSync() {
  if (typeof window === 'undefined' || !window.addEventListener) return;
  if (window._storageSyncSetup) return;
  window._storageSyncSetup = true;
  // v54.252 a11y: 提取同步通知为局部函数，避免 4 个分支重复 i18n + announce 调用
  function _announceSync() {
    try {
      var syncMsg = (typeof i18n === 'function') ? i18n('toast_storageSynced') : 'Synced';
      if (typeof _i18nToast === 'function') _i18nToast('toast_storageSynced', 'info', 1500);
      if (typeof _announceSettings === 'function') _announceSettings(syncMsg);
    } catch (_) { /* 静默 - a11y 增强失败不影响主流程 */ }
  }
  window.addEventListener('storage', function(e) {
    if (!e.key) return;
    var val = e.newValue;
    // 原 v54.125 白名单：批量选择 + 折叠分组
    if (e.key === _BATCH_KEY || e.key === _COLLAPSED_KEY) {
      if (window._batchSelected) window._batchSelected = null;
      if (typeof renderHistory === 'function') renderHistory();
      _announceSync();
      return;
    }
    // v54.227: 历史记录保存后另一 tab 自动刷新历史页
    if (e.key === HK) {
      try {
        _historyCache = null;  // v54.234: 失效缓存，让下次 getH 重新 parse
        _extractChartDataCache = { sig: '', data: null };  // v54.249: 失效 chart data 缓存（跨 tab 同步）
        if (typeof updCount === 'function') updCount();
        if (typeof renderHistory === 'function') renderHistory();
        _announceSync();
      } catch (err) { console.error('[storage sync] history', err); }
      return;
    }
    // v54.227 + v54.238 fix: 主题切换/删除后另一 tab 自动应用（val=null 时回退 light，确保删除后 UI 不残留旧主题）
    if (e.key === 'rsd-theme') {
      try {
        if (typeof setTheme === 'function') setTheme(val || 'light');
        if (typeof _updateThemeBtnLabel === 'function') _updateThemeBtnLabel();
        _announceSync();
      } catch (err) { console.error('[storage sync] theme', err); }
      return;
    }    if (e.key === 'rsd-weight-unit') {
      try {
        if (typeof setWeightUnit === 'function') setWeightUnit(val || 'mg');
        if (typeof _renderWeightUnitActive === 'function') _renderWeightUnitActive();
        _announceSync();
      } catch (err) { console.error('[storage sync] weightUnit', err); }
      return;
    }

    // v54.227: 语言切换后另一 tab 自动应用同语言
    if (e.key === 'rsd-lang') {
      try {
        if (val && typeof _setLang === 'function' && typeof I18N === 'object' && I18N[val]) {
          _setLang(val);
          _announceSync();
        }
      } catch (err) { console.error('[storage sync] lang', err); }
      return;
    }
  });
}
_setupStorageSync();

// v54.182 全局错误捕获器：JS 错误立即显示在屏幕上，方便诊断"打不开其他模块"
window.addEventListener('error', function(e) {
  try {
    var msg = '⚠️ [JS Error] ' + (e.message || 'Unknown') + '\n  at ' + (e.filename || '') + ':' + (e.lineno || 0);
    console.error('[global error]', e.error || msg);
    // 显示在屏幕右下角的浮窗
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;right:12px;bottom:12px;max-width:480px;background:#dc2626;color:#fff;padding:10px 14px;border-radius:6px;font-size:12px;line-height:1.5;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:monospace;white-space:pre-wrap;word-break:break-all;';
    // v54.265 a11y: 崩溃浮层必须让屏幕阅读器立即播报，否则 SR 用户完全感知不到
    div.setAttribute('role', 'alert');
    div.setAttribute('aria-live', 'assertive');
    div.textContent = msg + '\n  ' + i18n('errConsoleHint');
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 8000);
  } catch (_) {}
});
window.addEventListener('unhandledrejection', function(e) {
  try {
    var msg = '⚠️ [Promise Error] ' + (e.reason && (e.reason.message || e.reason.toString()) || 'Unknown');
    console.error('[unhandledrejection]', e.reason);
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;right:12px;bottom:12px;max-width:480px;background:#dc2626;color:#fff;padding:10px 14px;border-radius:6px;font-size:12px;line-height:1.5;z-index:99999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-family:monospace;white-space:pre-wrap;word-break:break-all;';
    // v54.265 a11y: 崩溃浮层必须让屏幕阅读器立即播报，否则 SR 用户完全感知不到
    div.setAttribute('role', 'alert');
    div.setAttribute('aria-live', 'assertive');
    div.textContent = msg + '\n  ' + i18n('errConsoleHint');
    document.body.appendChild(div);
    setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 8000);
  } catch (_) {}
});

// v54.120 复制 entry 原始 JSON（未转义）到剪贴板（navigator.clipboard + textarea fallback）
async function _copyEntryJSON(idx) {
  const h = getH();
  const e = h[idx];
  if (!e || typeof e !== 'object') return;
  const json = JSON.stringify(e, null, 2);
  let success = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(json);
      success = true;
    } else {
      // 老浏览器 fallback：textarea + execCommand('copy')
      const ta = document.createElement('textarea');
      ta.value = json;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      success = document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch (err) { success = false; }
  if (success) _i18nToast('toast_jsonCopiedFmt', 'success', 2000, '');
  else _i18nToast('toast_clipboardFailFmt', 'warn', 3000, '');
}

// v54.284 Phase 5: history filter state（取代之前 renderFilteredList 的"等价于 renderHistory"占位）
var _historyFilter = { search: '', type: '' };
function setHistoryFilter(filter) {
  if (!filter) filter = {};
  _historyFilter.search = (filter.search || '').trim().toLowerCase();
  _historyFilter.type = filter.type || '';
  try { if (typeof updCount === 'function') updCount(); } catch (_) {}
  if (typeof renderFilteredList === 'function') renderFilteredList();
}
// v54.284 Phase 5: history filter（真正过滤 + renderHistory）
function renderFilteredList() {
  try {
    // renderHistory 内部已包含 _historyFilter 应用（getH() 后立即过滤）
    if (typeof renderHistory === 'function') {
      const _before = (typeof getH === 'function') ? getH().length : 0;
      renderHistory();
      const _after = document.querySelectorAll('#history-list .history-item').length;
      // v54.284 Phase 5: debug 过滤
      console.log('[renderFilteredList]', _historyFilter.search || '(empty)', 'items', _before, '→', _after);
    }
  } catch (e) {
    // renderHistory 对缺失字段（如 e.samples/e.recoveries）敏感；
    // 此函数被 loadDemoData 调用，失败不应阻塞数据加载
    console.warn('[renderFilteredList] renderHistory 异常:', e.message);
  }
}

// HTML 实体转义（防 XSS，localStorage + Supabase 同步场景下都需要）
function _esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

// v54.243 a11y: 给 SVG chart 配一个 sibling visually-hidden aria-live region
// 用于把图表状态（空数据 / 数据点数）告知屏幕阅读器（SVG <text> 默认不可读）
function _announceChartState(svgId, msg) {
  try {
    const svg = document.getElementById(svgId);
    if (!svg || !svg.parentNode) return;
    let live = svg.parentNode.querySelector('.chart-sr-live');
    if (!live) {
      live = document.createElement('div');
      live.className = 'chart-sr-live visually-hidden';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      svg.parentNode.insertBefore(live, svg.nextSibling);
    }
    live.textContent = msg || '';
  } catch(e) { /* 静默 - a11y 增强失败不影响主流程 */ }
}

// v54.252 a11y: 主题/字体/语言切换反馈 — 通过单一全局 aria-live region 让屏幕阅读器听到切换结果
// 与 _announceChartState 区别：此处是全局设置（影响整个 app），所以挂在 document.body 上
function _announceSettings(msg) {
  try {
    if (!msg) return;
    let live = document.getElementById('settings-status-live');
    if (!live) {
      live = document.createElement('div');
      live.id = 'settings-status-live';
      live.className = 'visually-hidden';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      document.body.appendChild(live);
    }
    // 清空再写：防止某些 SR 把连续相同文本吞掉
    live.textContent = '';
    // 用 setTimeout(0) 让 mutation 一定进入新一轮 tick，便于 SR 拾取
    setTimeout(function(){ live.textContent = msg; }, 0);
  } catch(e) { /* 静默 - a11y 增强失败不影响主流程 */ }
}

// 数值格式化：有限数返回 toFixed，否则返回 '—'（防 NaN/undefined 显示污染 UI）
function _fmtNum(v, decimals) {
  if (typeof v === 'number' && Number.isFinite(v)) return decimals != null ? v.toFixed(decimals) : String(v);
  if (v != null && v !== '') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return decimals != null ? n.toFixed(decimals) : String(n);
  }
  return '—';
}

// 历史列表事件委托（替代每项 inline onclick，500 条时显著降低解析开销）
(function() {
  const list = document.getElementById('history-list');
  if (!list || list._delegated) return;
  list._delegated = true;
  list.addEventListener('click', (e) => {
    // v54.119 group header 点击 → toggle 同日期 entry（避免与 button 冲突：button 不触发折叠）
    // v54.243 a11y: h-date-group 现在是 <button>，但 date-select 按钮是独立 sibling；
    //   需要排除 .h-date-select 子 button，否则点 select 也会触发折叠
    const groupHeader = e.target.closest('.h-date-group');
    if (groupHeader && !e.target.closest('.h-date-select')) {
      _toggleDateGroup(groupHeader.dataset.date);
      return;
    }
    // v54.118 批量操作条按钮优先（避免与 data-action 冲突）
    const batchBtn = e.target.closest('button[data-batch-action]');
    if (batchBtn) {
      const action = batchBtn.dataset.batchAction;
      if (action === 'select-page') {
        // 当前页：直接勾选所有可见 checkbox
        // v54.239 fix: 之前是 '#history-list.h-checkbox' 缺空格，selector 永远 0 匹配
        document.querySelectorAll('#history-list .h-checkbox').forEach(function(cb) { cb.checked = true; });
        // v54.121 同步到 _batchSelected Set
        document.querySelectorAll('#history-list.h-checkbox').forEach(function(cb) {
          const idx = parseInt(cb.dataset.idx, 10);
          if (!Number.isFinite(idx) && window._batchSelected) window._batchSelected.add(idx);
        });
        _saveBatchSelected();  // v54.123
      } else if (action === 'select-all') {
        // v54.121 全选全部 N 条 → 标记到 _batchSelected Set + 重新渲染
        const h = getH();
        if (window._batchSelected) {
          window._batchSelected.clear();
          for (let i = 0; i < h.length; i++) window._batchSelected.add(i);
        }
        _saveBatchSelected();  // v54.123
        renderHistory();
        _i18nToast('toast_batchSelectAll', 'info', 2000, h.length);
      } else if (action === 'deselect') {
        document.querySelectorAll('#history-list.h-checkbox').forEach(function(cb) { cb.checked = false; });
        if (window._batchSelected) window._batchSelected.clear();
        _saveBatchSelected();  // v54.123
      } else if (action === 'export') {
        // v54.300 新增：批量导出选中条目为 JSON
        _batchExportSelected();
      } else if (action === 'export-md') {
        // v54.302 新增：批量导出选中条目为 Markdown
        _batchExportSelectedMd();
      } else if (action === 'import') {
        // v54.304 新增：触发文件选择器导入 JSON 备份
        _triggerBatchImport();
      } else if (action === 'delete') {
        _batchDeleteSelected();
      }
      _updateBatchCount();
      return;
    }
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    // v54.122 select-date 不需要 data-idx（用 data-date），单独提前处理
    if (btn.dataset.action === 'select-date') {
      e.stopPropagation();
      const cnt = _selectEntriesByDate(btn.dataset.date);
      _saveBatchSelected();  // v54.123
      _i18nToast('toast_batchSelectAll', 'info', 2000, cnt);
      return;
    }
    const idx = parseInt(btn.dataset.idx, 10);
    if (!Number.isFinite(idx)) return;
    if (btn.dataset.action === 'delete') deleteSingle(idx);
    else if (btn.dataset.action === 'load') loadHistory(idx);
    else if (btn.dataset.action === 'details') {
      // v54.117 entry 详情折叠/展开：toggle .h-details 同 idx 块
      // v54.246 a11y: 同步 aria-expanded + 用 toggle 返回值避免重复 contains
      // v54.272 perf: lazy-render JSON on first open (was serialized every render)
      const det = document.querySelector('.h-details[data-idx="' + idx + '"]');
      if (det) {
        const isOpen = det.classList.toggle('show');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        btn.textContent = isOpen ? i18n('btnCollapse') : i18n('btnDetails');
        if (isOpen) {
          const c = det.querySelector('.h-details-content');
          if (c && c.dataset.loaded === '0') {
            const entry = (typeof getH === 'function') ? getH()[idx] : null;
            c.textContent = entry ? JSON.stringify(entry, null, 2) : ''; /* v54.306 fix: 移除 _esc() — textContent 不解析 HTML，转义反而破坏 JSON（"→&quot;） */
            c.dataset.loaded = '1';
          }
        }
      }
    }
    else if (btn.dataset.action === 'copy-json') {
      // v54.120 复制 entry 原始 JSON 到剪贴板
      _copyEntryJSON(idx);
    }
  });
})();

// ==================== 更新加载历史 ====================
loadHistory = function(idx) {
  const e = getH()[idx];
  if (!e) return;
  if (e.type === '统计计算') {
    switchTab('stats');
    const nums = e.data.split(/[,\s]+/).map(s => parseFloat(s.trim())).filter(v => Number.isFinite(v));
    const container = document.getElementById('data-rows');
    container.innerHTML = '';
    nums.forEach(v => {
      const div = document.createElement('div'); div.className = 'row';
      div.innerHTML = '<input type="text" inputmode="decimal" value="'+_esc(v)+'" aria-label="' + _esc(i18n('placeholderSampleArea')) + '" data-i18n-aria-label="placeholderSampleArea" oninput="calcStats()"><button type="button" class="btn btn-danger btn-sm" onclick="removeRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow" style="min-width:32px">-</button>';
      container.appendChild(div);
    });
    if (nums.length === 0) addRow();
    calcStats();
  } else if (e.type === '含量计算' || e.type === '外标含量') {
    switchTab('special'); switchSpecial('content');
    document.getElementById('std-area').value = e.stdArea || '';
    document.getElementById('std-weight').value = e.stdWeight || '';
    document.getElementById('std-purity').value = e.stdPurity || '100';
    document.getElementById('std-dilution').value = e.stdDilution || '';
    document.getElementById('std-moisture').value = e.stdMoisture || '0';
    document.getElementById('std-residue').value = e.stdResidue || '0';
    if (e.samples && e.samples.length > 0 && e.samples[0].parallels) {
      contentData.length = 0; contentData.push(...e.samples.map(s => ({
        weight: s.weight||'', dilution: s.dilution||'', moisture: s.moisture||'0', residue: s.residue||'0',
        parallels: s.parallels.map(p => ({area: p.area||''}))
      })));
    } else if (e.samples && e.samples.length > 0) {
      contentData.length = 0; contentData.push(...e.samples.map(s => ({
        weight: s.weight||'', dilution: s.dilution||'', moisture: s.moisture||'0', residue: s.residue||'0',
        parallels: [{area: s.area||''}]
      })));
    } else {
      contentData.length = 0; contentData.push({weight:'',dilution:'',moisture:'0',residue:'0',parallels:[{area:''}]});
    }
    renderContent();
  } else if (e.type === '回收率-面积归一化法') {
    switchTab('recovery'); switchRecovery('normalize');
    document.getElementById('norm-std-weight').value = e.stdWeight || '';
    document.getElementById('norm-std-purity').value = e.stdPurity || '100';
    document.getElementById('norm-std-dilution').value = e.stdDilution || '';
    document.getElementById('norm-std-moisture').value = e.stdMoisture || '0';
    document.getElementById('norm-std-residue').value = e.stdResidue || '0';
    document.getElementById('norm-manual-f').value = e.manualF || '';
    // 对照峰面积%
    const tbody = document.getElementById('norm-std-area-rows');
    tbody.innerHTML = '';
    (e.stdAreaPcts || ['','']).forEach((v, j) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>'+(j+1)+'</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" value="'+_esc(v)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td>';
      tbody.appendChild(tr);
    });
    if ((e.stdAreaPcts || []).length === 0) { tbody.innerHTML = '<tr><td>1</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr><tr><td>2</td><td><input type="text" inputmode="decimal" class="norm-std-area-pct" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormStdAreaRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>'; }
    // 线性回归
    document.getElementById('norm-regress-rows').innerHTML = '<tr><td><input type="text" inputmode="decimal" class="norm-reg-conc" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblConcentration')) + '" data-i18n-aria-label="lblConcentration"></td><td><input type="text" inputmode="decimal" class="norm-reg-area" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('thPeakArea')) + '" data-i18n-aria-label="thPeakArea"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormRegressRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td></tr>';
    if (Array.isArray(e.regression?.points) && e.regression.points.length > 0) {
      const rTbody = document.getElementById('norm-regress-rows');
      rTbody.innerHTML = '';
      e.regression.points.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td><input type="text" inputmode="decimal" class="norm-reg-conc" placeholder="0" value="'+_esc(p.conc)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblConcentration')) + '" data-i18n-aria-label="lblConcentration"></td><td><input type="text" inputmode="decimal" class="norm-reg-area" placeholder="0" value="'+_esc(p.area)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('thPeakArea')) + '" data-i18n-aria-label="thPeakArea"></td><td><button type="button" class="btn btn-danger btn-xs" onclick="removeNormRegressRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td>';
        rTbody.appendChild(tr);
      });
    }
    // 样品模式
    document.getElementById('norm-spl-independent').checked = !!e.independent;
    toggleNormSplMode(); // 先切换显示
    const splTbody = document.getElementById('norm-spl-rows');
    splTbody.innerHTML = '';
    if (e.independent) {
      (e.splSamples || [{weight:'',dilution:'',moisture:'0',residue:'0',areaPct:''}]).forEach((s, j) => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>'+(j+1)+'</td>'+
          '<td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" value="'+_esc(s.weight||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td>'+
          '<td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" value="'+_esc(s.dilution||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td>'+
          '<td><input type="text" inputmode="decimal" class="norm-spl-moisture" placeholder="0" value="'+_esc(s.moisture||'0')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></td>'+
          '<td><input type="text" inputmode="decimal" class="norm-spl-residue" placeholder="0" value="'+_esc(s.residue||'0')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblResidue')) + '" data-i18n-aria-label="lblResidue"></td>'+
          '<td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" value="'+_esc(s.areaPct||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td>'+
          '<td class="result-col">—</td>'+
          '<td><button class="btn btn-outline btn-xs" onclick="copyNormPrevRow(this)" title="' + _esc(i18n('titleCopyUpRow')) + '" data-i18n-title="titleCopyUpRow">↑上行</button><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
        splTbody.appendChild(tr);
      });
    } else {
      document.getElementById('norm-spl-weight').value = e.splWeight || '';
      document.getElementById('norm-spl-dilution').value = e.splDilution || '';
      document.getElementById('norm-spl-moisture').value = e.splMoisture || '0';
      document.getElementById('norm-spl-residue').value = e.splResidue || '0';
      if (Array.isArray(e.splSamples) && e.splSamples.length > 0) {
        e.splSamples.forEach((s, j) => {
          const tr = document.createElement('tr'); tr.className = 'norm-spl-shared';
          tr.innerHTML = '<td>'+(j+1)+'</td><td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" value="'+_esc(s.weight||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td><td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" value="'+_esc(s.dilution||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td><td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" value="'+_esc(s.areaPct||'')+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td class="result-col">—</td><td><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
          splTbody.appendChild(tr);
        });
      } else {
        // v54.229 fix: v 是历史 splAreaPcts 数组元素（用户输入历史）→ 必须 _esc 防 XSS
        (Array.isArray(e.splAreaPcts) ? e.splAreaPcts : ['']).forEach((v, j) => {
          const tr = document.createElement('tr'); tr.className = 'norm-spl-shared';
          tr.innerHTML = '<td>'+(j+1)+'</td><td><input type="text" inputmode="decimal" class="norm-spl-weight" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblSampleWeightNoSpace')) + '" data-i18n-aria-label="lblSampleWeightNoSpace"></td><td><input type="text" inputmode="decimal" class="norm-spl-dilution" placeholder="0" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblDilutionVol')) + '" data-i18n-aria-label="lblDilutionVol"></td><td><input type="text" inputmode="decimal" class="norm-spl-area-pct" placeholder="0" value="'+_esc(v)+'" oninput="calcNormalize()" aria-label="' + _esc(i18n('lblPeakAreaPct')) + '" data-i18n-aria-label="lblPeakAreaPct"></td><td class="result-col">—</td><td><button class="btn btn-outline btn-xs" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button><button type="button" class="btn btn-danger btn-xs" onclick="removeNormSampleRow(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample">-</button></td>';
          splTbody.appendChild(tr);
        });
      }
    }
    calcNormalize();
  } else if (e.type === '回收率-简易') {
    switchTab('recovery'); switchRecovery('simple');
    document.getElementById('simple-theory').value = e.theory || '100';
    document.getElementById('simple-measured').value = e.measured || '';
    calcSimple();
  } else if (e.type === '回收率-外标法') {
    switchTab('recovery'); switchRecovery('external');
    document.getElementById('ext-std-area').value = e.stdArea || '';
    document.getElementById('ext-std-weight').value = e.stdWeight || '';
    document.getElementById('ext-std-purity').value = e.stdPurity || '100';
    document.getElementById('ext-std-dilution').value = e.stdDilution || '';
    document.getElementById('ext-std-moisture').value = e.stdMoisture || '0';
    document.getElementById('ext-std-residue').value = e.stdResidue || '0';
    const container = document.getElementById('ext-sample-rows');
    container.innerHTML = '';
    (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
      const div = document.createElement('div'); div.className = 'sample-row';
      const delBtn = e.samples.length > 1 ? '<button type="button" class="btn btn-danger btn-sm" onclick="removeExtSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button>' : '';
      div.innerHTML = '' + i18n('sampleNum') + (j+1) + ' <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button>'+delBtn+'</div>'+
        '<div class="half">'+
          '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="ext-spl-area" placeholder="0" value="'+_esc(s.area)+'" oninput="calcExternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
          '<div><label data-i18n="lbl-sample-weight">称样量(mg)</label><input type="text" inputmode="decimal" class="ext-spl-weight" placeholder="0" value="'+_esc(s.weight)+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-sample-weight')) + '" data-i18n-aria-label="lbl-sample-weight"></div>'+
          '<div><label data-i18n="lbl-dilution-vol">稀释体积(mL)</label><input type="text" inputmode="decimal" class="ext-spl-dilution" placeholder="0" value="'+_esc(s.dilution)+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-dilution-vol')) + '" data-i18n-aria-label="lbl-dilution-vol"></div>'+
          '<div><label data-i18n="lbl-theory-content-pct">理论含量(%)</label><input type="text" inputmode="decimal" class="ext-spl-theory" placeholder="100" value="'+_esc(s.theory)+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-theory-content-pct')) + '" data-i18n-aria-label="lbl-theory-content-pct"></div>'+
        '</div>'+
        '<div class="section-label" data-i18n="card-title-drying-param">干燥品折算参数</div>'+
        '<div class="half">'+
          '<div><label data-i18n="lblMoisturePct">水分(%)</label><input type="text" inputmode="decimal" class="ext-spl-moisture" placeholder="0" value="'+_esc(s.moisture)+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lblMoisturePct')) + '" data-i18n-aria-label="lblMoisturePct"></div>'+
          '<div><label data-i18n="lbl-residue-pct">炽灼残渣(%)</label><input type="text" inputmode="decimal" class="ext-spl-residue" placeholder="0" value="'+_esc(s.residue)+'" oninput="calcExternal()" aria-label="' + _esc(i18n('lbl-residue-pct')) + '" data-i18n-aria-label="lbl-residue-pct"></div>'+
        '</div>';
      container.appendChild(div);
    });
    if (!Array.isArray(e.samples) || e.samples.length === 0) addExtSample();
    calcExternal();
  } else if (e.type === '回收率-内标法') {
    switchTab('recovery'); switchRecovery('internal');
    document.getElementById('int-std-area').value = e.stdArea || '';
    document.getElementById('int-std-is-area').value = e.stdIsArea || '';
    document.getElementById('int-std-conc').value = e.stdConc || '';
    const container = document.getElementById('int-sample-rows');
    container.innerHTML = '';
    (Array.isArray(e.samples) ? e.samples : []).forEach((s, j) => {
      const div = document.createElement('div'); div.className = 'sample-row';
      const delBtn = e.samples.length > 1 ? '<button type="button" class="btn btn-danger btn-sm" onclick="removeIntSample(this)" aria-label="' + _esc(i18n('ariaRemoveSample')) + '" data-i18n-aria-label="ariaRemoveSample" style="min-width:28px;padding:2px 6px;margin-left:4px">-</button>' : '';
      div.innerHTML = '' + i18n('sampleNum') + (j+1) + ' <span class="result-col" style="font-size:12px;float:right">—</span><button class="btn btn-outline btn-xs ml-8" onclick="copyRowData(this)" data-i18n="btn-copy">📋复制</button><button class="btn btn-outline btn-xs" onclick="pasteRowData(this)" data-i18n="btn-paste">📄粘贴</button>'+delBtn+'</div>'+
        '<div class="half">'+
          '<div><label data-i18n="th-peak-area">峰面积</label><input type="text" inputmode="decimal" class="int-spl-area" placeholder="0" value="'+_esc(s.area)+'" oninput="calcInternal()" aria-label="' + _esc(i18n('th-peak-area')) + '" data-i18n-aria-label="th-peak-area"></div>'+
          '<div><label data-i18n="lbl-is-peak-area">内标峰面积</label><input type="text" inputmode="decimal" class="int-spl-is-area" placeholder="0" value="'+_esc(s.isArea)+'" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-is-peak-area')) + '" data-i18n-aria-label="lbl-is-peak-area"></div>'+
        '</div>'+
        '<div class="half">'+
          '<div><label data-i18n="lbl-theory-conc-mg-ml">理论浓度(mg/mL)</label><input type="text" inputmode="decimal" class="int-spl-theory" placeholder="0" value="'+_esc(s.theory)+'" oninput="calcInternal()" aria-label="' + _esc(i18n('lbl-theory-conc-mg-ml')) + '" data-i18n-aria-label="lbl-theory-conc-mg-ml"></div>'+
        '</div>';
      container.appendChild(div);
    });
    if (!Array.isArray(e.samples) || e.samples.length === 0) addIntSample();
    calcInternal();
  } else if (e.type === '干燥失重') {
    switchTab('special'); switchSpecial('drying');
    if (Array.isArray(e.samples) && e.samples.length > 0) {
      dryingData.length = 0; dryingData.push(...e.samples.map(s => ({
        parallels: Array.isArray(s.parallels) && s.parallels.length > 0
          ? s.parallels.map(p => ({w0:p.w0||'',w1:p.w1||'',w2:p.w2||''}))
          : [{w0:'',w1:'',w2:''}]
      })));
    } else {
      dryingData.length = 0; dryingData.push({ parallels: [{w0:'',w1:'',w2:''}] });
    }
    renderDrying();
  } else if (e.type === '炽灼残渣') {
    switchTab('special'); switchSpecial('residue');
    if (Array.isArray(e.samples) && e.samples.length > 0) {
      residueData.length = 0; residueData.push(...e.samples.map(s => ({
        parallels: Array.isArray(s.parallels) && s.parallels.length > 0
          ? s.parallels.map(p => ({w0:p.w0||'',w1:p.w1||'',w2:p.w2||''}))
          : [{w0:'',w1:'',w2:''}]
      })));
    } else {
      residueData.length = 0; residueData.push({ parallels: [{w0:'',w1:'',w2:''}] });
    }
    renderResidue();
  } else if (e.type === '滴定度') {
    switchTab('special'); switchSpecial('titer');
    document.getElementById('titer-vs').value = e.vs||'';
    document.getElementById('titer-v0s').value = e.v0s||'';
    document.getElementById('titer-ms').value = e.ms||'';
    // v54.236 fix: 用 nullish coalescing 保留空字符串（原 ''||'100' / ''||'1' 把空值改成默认值，破坏用户"用 T 反算"场景）
    document.getElementById('titer-ps').value = e.ps ?? '';
    document.getElementById('titer-f').value = e.f ?? '';
    document.getElementById('titer-t').value = e.T||'';
    if (Array.isArray(e.samples) && e.samples.length > 0) {
      titerData.length = 0; titerData.push(...e.samples.map(s => ({
        parallels: Array.isArray(s.parallels) && s.parallels.length > 0 ? s.parallels.map(p => ({w:p.w||'',v0:p.v0||'',v:p.v||''})) : [{w:'',v0:'',v:''}]
      })));
    } else { titerData.length = 0; titerData.push({parallels:[{w:'',v0:'',v:''}]}); }
    renderTiter();
  } else if (e.type === '外标含量') {
    switchTab('special'); switchSpecial('content');
    document.getElementById('std-area').value = e.stdArea || '';
    document.getElementById('std-weight').value = e.stdWeight || '';
    document.getElementById('std-purity').value = e.stdPurity || '100';
    document.getElementById('std-dilution').value = e.stdDilution || '';
    document.getElementById('std-moisture').value = e.stdMoisture || '0';
    document.getElementById('std-residue').value = e.stdResidue || '0';
    if (e.samples && e.samples.length > 0 && e.samples[0].parallels && Array.isArray(e.samples[0].parallels)) {
      contentData.length = 0; contentData.push(...e.samples.map(s => ({
        weight: s.weight||'', dilution: s.dilution||'', moisture: s.moisture||'0', residue: s.residue||'0',
        parallels: Array.isArray(s.parallels) ? s.parallels.map(p => ({area: p.area||''})) : [{area: ''}]
      })));
    } else if (e.samples && e.samples.length > 0) {
      contentData.length = 0; contentData.push(...e.samples.map(s => ({
        weight: s.weight||'', dilution: s.dilution||'', moisture: s.moisture||'0', residue: s.residue||'0',
        parallels: [{area: s.area||''}]
      })));
    } else {
      contentData.length = 0; contentData.push({weight:'',dilution:'',moisture:'0',residue:'0',parallels:[{area:''}]});
    }
    renderContent();
  } else if (e.type === '含量均匀度') {
    switchTab('special'); switchSpecial('uniformity');
    document.getElementById('uni-limit').value = e.L || '';
    if (Array.isArray(e.samples) && e.samples.length > 0) {
      uniformityData.length = 0; uniformityData.push(...e.samples.map(s => ({
        parallels: Array.isArray(s.parallels) && s.parallels.length > 0
          ? s.parallels.map(p => ({content: p.content || ''}))
          : [{content: ''}]
      })));
    } else {
      uniformityData.length = 0; uniformityData.push({ parallels: [{content: ''}] });
    }
    renderUniformity();
  } else if (e.type === '溶出度') {
    switchTab('special'); switchSpecial('dissolution');
    document.getElementById('diss-label').value = e.label || '';
    if (Array.isArray(e.samples) && e.samples.length > 0) {
      dissolutionData.length = 0; dissolutionData.push(...e.samples.map(s => ({
        parallels: Array.isArray(s.parallels) && s.parallels.length > 0
          ? s.parallels.map(p => ({content: p.content || ''}))
          : [{content: ''}]
      })));
    } else {
      dissolutionData.length = 0; dissolutionData.push({ parallels: [{content: ''}] });
    }
    renderDissolution();
  } else if (e.type === '标准曲线') {
    switchTab('special'); switchSpecial('curve');
    clearCurve();
    if (e.points && e.points.length > 1) {
      var tbody = document.getElementById('curve-rows');
      tbody.innerHTML = '';
      e.points.forEach(function(p, i) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>'+(i+1)+'</td>'+
          '<td><input type="text" inputmode="decimal" class="curve-x" placeholder="0" value="'+_esc(p.x)+'" oninput="calcCurve()" aria-label="' + _esc(i18n('lblConcentrationX')) + '" data-i18n-aria-label="lblConcentrationX"></td>'+
          '<td><input type="text" inputmode="decimal" class="curve-y" placeholder="0" value="'+_esc(p.y)+'" oninput="calcCurve()" aria-label="' + _esc(i18n('lblResponseY')) + '" data-i18n-aria-label="lblResponseY"></td>'+
          '<td class="result-col" id="curve-py-'+(i+1)+'">—</td>'+
          '<td><button type="button" class="btn btn-danger btn-xs" onclick="removeCurveRow(this)" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow">-</button></td>';
        tbody.appendChild(tr);
      });
      calcCurve();
    }
  }
};

// ==================== 更新 Excel 导出 ====================
// 弱网时降级 PDF 缩略图（scale 2 → 1 + quality 0.98 → 0.7，文件约 1/8 大小）
function _weakNetHtml2CanvasOpts(baseOpts) {
  if (typeof _isPoorConnection === 'function' && _isPoorConnection()) {
    if (typeof toast === 'function') _i18nToast('toast_pdfDegraded', 'info', 3000);
    return Object.assign({}, baseOpts, { scale: 1 });
  }
  return baseOpts;
}
// 弱网时降级 image quality（html2pdf 的 image 选项）
function _weakNetImageOpts(baseImageOpts) {
  if (typeof _isPoorConnection === 'function' && _isPoorConnection()) {
    return Object.assign({}, baseImageOpts, { quality: 0.7 });
  }
  return baseImageOpts;
}

// 生成报告 QR 码（异步 → canvas dataURL → 注入 PDF 封面）
function _generateReportQR(text) {
  return new Promise(resolve => {
    ensureQr().then(() => {
      if (typeof QRCode === 'undefined') { resolve(null); return; }
      try {
        const tmp = document.createElement('div');
        tmp.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
        document.body.appendChild(tmp);
        // QR 容量：version 10 + M 容错 = 77 字节；L 容错 = 271 字节
        // 我们的 QR 文本含中文+URL 可能 > 77 字节，所以用 L 容错 + 截断 200 字符
        new QRCode(tmp, { text: String(text || '').slice(0, 200), width: 120, height: 120, correctLevel: QRCode.CorrectLevel.L });
        setTimeout(() => {
          const canvas = tmp.querySelector('canvas');
          const img = tmp.querySelector('img');
          let dataUrl = null;
          if (canvas) dataUrl = canvas.toDataURL('image/png');
          else if (img && img.src) dataUrl = img.src;
          document.body.removeChild(tmp);
          resolve(dataUrl);
        }, 100);
      } catch (e) { console.error('[QR]', e); resolve(null); }
    }).catch(() => resolve(null));
  });
}

function _reportQRText(meta) {
  // QR 库对 UTF-8 中文每个字符需 3 字节 = 24 bits，加上 mode/count/terminator 开销
  // 89 字符中英文混合超出 V5-L (106 codeword) 容量
  // 简化为纯 ASCII：报告 ID + 时间戳 + 短哈希（用 base36 编码数字）
  const ts = Date.now().toString(36).toUpperCase();
  const hash = ((meta.sampleName || '') + (meta.batch || ''))
    .split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36).toUpperCase().replace('-', 'Z');
  return 'RSD|' + (meta.batch || 'NA') + '|' + ts + '|' + hash;
}

// v54.244 fix: 打印前给当前 active .page 打 .print-active 标记，配合 CSS 只渲染该 tab（避免 30 页 dump）
// v54.250 Round 16 a11y: 同时把 print 按钮置 busy + 临时翻转 label（保存原 textContent），让 SR/sighted 用户知道打印已触发
function _setPrintActive() {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('print-active'); });
  var active = document.querySelector('.page.active') || document.querySelector('.page');
  if (active) active.classList.add('print-active');
  var btn = document.getElementById('btn-print-pdf');
  if (btn) {
    btn.setAttribute('aria-busy', 'true');
    if (!btn.dataset.originalLabel) btn.dataset.originalLabel = btn.textContent;
    btn.textContent = '...';
  }
}
// v54.244 fix: 打印完成后清理 .print-active 标记（afterprint 事件，浏览器原生支持）
// v54.250 Round 16 a11y: 同步还原 print 按钮 label + 移除 aria-busy
window.addEventListener('afterprint', function(){
  document.querySelectorAll('.page.print-active').forEach(function(p){ p.classList.remove('print-active'); });
  var btn = document.getElementById('btn-print-pdf');
  if (btn) {
    if (btn.dataset.originalLabel) {
      btn.textContent = btn.dataset.originalLabel;
      delete btn.dataset.originalLabel;
    }
    btn.removeAttribute('aria-busy');
  }
});

async function printPDF() {
  // 弱网检测：提示用户（PDF 生成是本地操作，但若包含云端图片/资源会受影响）
  if (typeof _isPoorConnection === 'function' && _isPoorConnection()) {
    const q = _getConnQuality();
    if (typeof toast === 'function') _i18nToast('toast_weakNetworkPdf', 'warn', 4000, q.type);
  }
  // 降级处理：如果 html2pdf.js 未加载，回退到浏览器打印
  if (typeof html2pdf === 'undefined') {
    // v54.238 fix: 与 exportComprehensiveReport 同款，先 _i18nAlert 提示再 fallback（避免用户困惑）
    if (typeof _i18nAlert === 'function') _i18nAlert('pdfMissing');
    _setPrintActive();
    window.print();
    return;
  }
  // 创建临时导出容器
  const container = document.createElement('div');
  container.id = 'pdf-export-container';
  container.style.cssText = 'padding:20px;font-family:"Microsoft YaHei",sans-serif;color:#333;background:#fff;width:190mm;';

  // 获取历史数据
  const h = getH();
  const meta = (typeof getReportMeta === 'function') ? getReportMeta() : {};
  let html = '';
  // 标题
  html += '<div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #2563eb;padding-bottom:12px;">';
  html += '<h2 style="margin:0 0 4px 0;color:#2563eb;font-size:22px;">' + i18n('csvReportHeader') + '</h2>';
  html += i18n('cvHistoryExportTime') + _esc(_formatNow()) + '</p>';
  // 报告元数据（合规追溯）
  if (meta.sampleName || meta.operator || meta.instrument || meta.column) {
    html += '<table style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse">';
    html += '<tr>';
    if (meta.sampleName) html += '<td style="padding:3px 8px;width:25%;border:1px solid #e2e8f0"><b data-i18n="lblSampleNameColon">样品名:</b> ' + _esc(meta.sampleName) + '</td>';
    if (meta.batch) html += '<td style="padding:3px 8px;width:25%;border:1px solid #e2e8f0"><b data-i18n="lblBatchColon">批号:</b> ' + _esc(meta.batch) + '</td>';
    if (meta.operator) html += '<td style="padding:3px 8px;width:25%;border:1px solid #e2e8f0"><b data-i18n="lblOperatorColon">操作者:</b> ' + _esc(meta.operator) + '</td>';
    html += '</tr><tr>';
    if (meta.instrument) html += '<td style="padding:3px 8px;width:50%;border:1px solid #e2e8f0" colspan="2"><b data-i18n="lblInstrumentColon">仪器:</b> ' + _esc(meta.instrument) + '</td>';
    if (meta.column) html += '<td style="padding:3px 8px;width:50%;border:1px solid #e2e8f0" colspan="2"><b>' + i18n('lblColumnColon') + '</b> ' + _esc(meta.column) + '</td>';
    html += '</tr></table>';
  }
  html += '</div>';
  html += '<p style="color:#666;font-size:12px;margin:2px 0 0 0;">' + i18n('uiRecordCountStart') + h.length + i18n('uiRecordCountEnd');
  html += '</div>';

  if (!h || h.length === 0) {
    html += '<p style="text-align:center;color:#999;padding:40px 0;">' + i18n('emptyReportHistory') + '</p>';
  } else {
    // 按类型分组
    var groups = {};
    h.forEach(function(item) {
      // v54.29 防御：localStorage 损坏可能含 null/string entry
      if (!item || typeof item !== 'object' || typeof item.type !== 'string') return;
      var t = item.type || i18n('otherGroup');
      if (!groups[t]) groups[t] = [];
      groups[t].push(item);
    });

    // 渲染每个分组
    for (var type in groups) {
      if (!groups.hasOwnProperty(type)) continue;
      var items = groups[type];
      html += '<h3 style="color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:5px;margin-top:20px;font-size:15px;">' + _esc(type) + _esc(i18n('pdfGroupHeaderFmt').replace('{0}','').replace('{1}', items.length)) + '</h3>'; /* v54.281 fix: '(N 条)' 硬编码 → pdfGroupHeaderFmt */

      // 根据类型构建表格
      items.forEach(function(item, i) {
        html += '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:8px 0;page-break-inside:avoid;">';
        html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:#999;margin-bottom:6px;">';
        html += '<span style="font-weight:600;">#' + (i+1) + '</span>';
        html += '<span>' + _esc(item.time || '') + '</span>';
        html += '</div>';

        // 根据类型渲染详细信息
        if (item.type === '统计计算') {
          html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
          html += '<tr><td style="padding:3px 8px;color:#666;">'+i18n('hData')+'</td><td style="padding:3px 8px;">' + (item.data || '') + '</td></tr>';
          html += '<tr><td style="padding:3px 8px;color:#666;">'+i18n('hMean')+'</td><td style="padding:3px 8px;font-weight:700;color:#2563eb;">' + (item.mean || '') + '</td></tr>';
          html += '<tr><td style="padding:3px 8px;color:#666;">'+i18n('hSd')+':</td><td style="padding:3px 8px;">' + (item.sd || '') + '</td></tr>';
          html += '<tr><td style="padding:3px 8px;color:#666;">'+i18n('hRsd')+' (%):</td><td style="padding:3px 8px;font-weight:700;color:#2563eb;">' + (item.rsd || '') + '</td></tr>'; /* v54.281 fix: SD/RSD(%) → hSd/hRsd */
          html += '</table>';
        } else if (item.type === '回收率-面积归一化法') {
          html += '<div class="fs-12-lh-18">';
          html += '<div><b data-i18n="lblReferenceColon">'+i18n('lblReferenceColon')+'</b> ' + i18n('hStdWeightFmt').replace('{0}', (item.stdWeight||'')) + i18n('cvStdPurity') + (item.stdPurity||'') + '%, ' + i18n('hStdDilutionFmt').replace('{0}', (item.stdDilution||'')) + 'mL</div>';
          html += i18n('cvStdAreaPctHtml') + (item.stdAreaPcts||[]).join(', ') + i18n('hStdAreaAvgFmt').replace('{0}', (item.stdAreaAvg||'')) + '</div>';
          if (item.splSamples && item.splSamples.length > 0) {
            html += '<div><b>'+i18n('hSampleLabel')+'</b> ' + i18n(item.independent ? 'hSampleIndependent' : 'hSampleShared') + i18n('hSampleMode') + '</div>';
            item.splSamples.forEach(function(s, si) {
              html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': ' + i18n('hSampleWeightFmt').replace('{0}', (s.weight||'')) + ', ' + i18n('hSampleDilutionFmt').replace('{0}', (s.dilution||'')) + ', ' + i18n('hSampleAreaPctFmt').replace('{0}', (s.areaPct||'')) + '</div>';
            });
          }
          if (item.recoveries && item.recoveries.length > 0) {
            html += '<div><b>'+i18n('lblRecoveryColon')+'</b> ' + item.recoveries.join(', ') + '%</div>';
          }
          html += '<div><b>' + i18n('tplMeanPrefix') + '</b> ' + (item.cMean||'') + ' | <b>'+i18n('hSd')+':</b> ' + (item.cSd||'') + ' | <b>'+i18n('hRsd')+' (%):</b> ' + (item.cRsd||'') + '</div>'; /* v54.281 fix: SD/RSD → hSd/hRsd */
          if (item.regression) {
            html += i18n('cvRegressionHtml') + (item.regression.a||'') + 'x+' + (item.regression.b||'') + ' r=' + (item.regression.r||'') + '</div>';
          }
          html += '</div>';
        } else if (item.type === '回收率-外标法') {
          html += '<div class="fs-12-lh-18">';
          html += i18n('cvStdInfoHtml') + (item.stdArea||'') + ', W=' + (item.stdWeight||'') + 'mg, P=' + (item.stdPurity||'') + '%, D=' + (item.stdDilution||'') + 'mL</div>';
          if (item.samples) {
            item.samples.forEach(function(s, si) {
              html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': A=' + _esc(s.area||'') + ', W=' + _esc(s.weight||'') + ', D=' + _esc(s.dilution||'') + i18n('commaTheory') + _esc(s.theory||'') + '%</div>';
            });
          }
          html += '<div><b>'+i18n('lblRecoveryColon')+'</b> ' + (item.recoveries||[]).map(_fmtNum).join(', ') + '%</div>';
          html += '<div><b>' + i18n('tplMeanPrefix') + '</b> ' + _fmtNum(_esc(item.cMean||''), 2) + ' | <b>'+i18n('hSd')+':</b> ' + _fmtNum(_esc(item.cSd||''), 4) + ' | <b>'+i18n('hRsd')+' (%):</b> ' + _fmtNum(_esc(item.cRsd||''), 2) + '</div>'; /* v54.281 fix: SD/RSD → hSd/hRsd */
          html += '</div>';
        } else if (item.type === '回收率-内标法') {
          html += '<div class="fs-12-lh-18">';
          html += i18n('cvStdInfoHtml') + _esc(item.stdArea||'') + ', IS_A=' + _esc(item.stdIsArea||'') + ', Conc=' + _esc(item.stdConc||'') + 'mg/mL</div>';
          if (item.samples) {
            item.samples.forEach(function(s, si) {
              html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': A=' + _esc(s.area||'') + ', IS_A=' + _esc(s.isArea||'') + i18n('commaTheory') + _esc(s.theory||'') + '</div>';
            });
          }
          html += '<div><b>'+i18n('lblRecoveryColon')+'</b> ' + (item.recoveries||[]).map(_fmtNum).join(', ') + '%</div>';
          html += '</div>';
        } else if (item.type === '回收率-简易') {
          html += '<div class="fs-12-lh-18">';
          html += '<div><b>'+i18n('hTheoryFmt').replace(':', '')+':</b> ' + _fmtNum(_esc(item.theory||''), 2) + '%</div>';
          html += '<div><b>'+i18n('hMeasuredFmt')+'</b> ' + _fmtNum(_esc(item.measured||''), 2) + '%</div>'; /* v54.281 fix: 实测含量: → hMeasuredFmt */
          html += '<div style="font-weight:700;color:#16a34a;font-size:14px;"><b>'+i18n('lblRecoveryColon')+'</b> ' + _fmtNum(_esc(item.recovery||''), 2) + '%</div>';
          html += '</div>';
        } else if (item.type === '含量计算' || item.type === '外标含量') {
          html += '<div class="fs-12-lh-18">';
          html += i18n('cvStdInfoHtml') + _esc(item.stdArea||'') + ', W=' + _esc(item.stdWeight||'') + 'mg, P=' + _esc(item.stdPurity||'') + '%, D=' + _esc(item.stdDilution||'') + 'mL</div>';
          if (item.samples) {
            item.samples.forEach(function(s, si) {
              if (s.parallels) {
                html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': W=' + _esc(s.weight||'') + ', D=' + _esc(s.dilution||'') + i18n('pdfSampleAreaFmt') + s.parallels.map(function(p){return _esc(p.area);}).join(', ') + '</div>'; /* v54.281 fix: ', 面积: ' → pdfSampleAreaFmt */
              } else {
                html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': A=' + _esc(s.area||'') + ', W=' + _esc(s.weight||'') + ', D=' + _esc(s.dilution||'') + '</div>';
              }
            });
          }
          if (item.contents) {
            html += '<div><b>'+i18n('tplContentParen')+'</b> ' + (item.contents||[]).map(_fmtNum).join(', ') + '</div>'; /* v54.281 fix: 含量(%): → tplContentParen */
          }
          if (item.cMean) {
            html += '<div><b>' + i18n('tplMeanPrefix') + '</b> ' + _fmtNum(_esc(item.cMean||''), 2) + ' | <b>'+i18n('hSd')+':</b> ' + _fmtNum(_esc(item.cSd||''), 4) + ' | <b>'+i18n('hRsd')+' (%):</b> ' + _fmtNum(_esc(item.cRsd||''), 2) + '</div>'; /* v54.281 fix: SD/RSD → hSd/hRsd */
          }
          html += '</div>';
        } else if (item.type === '干燥失重' || item.type === '炽灼残渣') {
          html += '<div class="fs-12-lh-18">';
          if (item.samples) {
            item.samples.forEach(function(s, si) {
              html += '<div style="margin-bottom:4px;"><b>'+i18n('tplSamplePrefix') + (si+1) + ':</b></div>'; /* v54.281 fix: 样品#X: → tplSamplePrefix */
              if (s.parallels) {
                s.parallels.forEach(function(p, pi) {
                  html += '<div class="pl-16">' + i18n('cvDryingParallelLabelFmt').replace('{0}', pi+1) + _fmtNum(p.w0||'') + ', W₁=' + _fmtNum(p.w1||'') + ', W₂=' + _fmtNum(p.w2||'') + '</div>'; /* v54.281 fix: 平行N: W₀= → cvDryingParallelLabelFmt */
                });
              }
            });
          }
          if (item.mean) {
            html += '<div><b>' + i18n('tplMeanPrefix') + '</b> ' + _fmtNum(_esc(item.mean||''), 2) + ' | <b>'+i18n('hSd')+':</b> ' + _fmtNum(_esc(item.sd||''), 4) + ' | <b>'+i18n('hRsd')+' (%):</b> ' + _fmtNum(_esc(item.rsd||''), 2) + '</div>'; /* v54.281 fix: SD/RSD → hSd/hRsd */
          }
          html += '</div>';
        } else if (item.type === '滴定度') {
          html += '<div class="fs-12-lh-18">';
          html += i18n('cvStdSolutionHtml') + _esc(item.vs||'') + ', V0=' + _esc(item.v0s||'') + ', m=' + _esc(item.ms||'') + ', P=' + _esc(item.ps||'') + ', F=' + _fmtNum(_esc(item.f||''), 4) + ', T=' + _fmtNum(_esc(item.T||i18n('histAuto')), 5) + '</div>';
          if (item.samples) {
            item.samples.forEach(function(s, si) {
              html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': ' + s.parallels.map(function(p, pi) {
                return 'P' + (pi+1) + '[W=' + _fmtNum(p.w) + ' V0=' + _fmtNum(p.v0) + ' V=' + _fmtNum(p.v) + ']';
              }).join(' ') + '</div>';
            });
          }
          html += '</div>';
        } else if (item.type === '含量均匀度') {
          html += '<div class="fs-12-lh-18">';
          html += i18n('cvUniformLimitHtml') + _fmtNum(_esc(item.L||'')) + '</b>, x̄=' + _fmtNum(_esc(item.xbar||''), 2) + ', A=' + _fmtNum(_esc(item.A||''), 2) + ', S=' + _fmtNum(_esc(item.S||''), 4) + '</div>';
          if (item.samples) {
            item.samples.forEach(function(s, si) {
              html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': ' + s.parallels.map(function(p){ return _fmtNum(p.content); }).join(', ') + '</div>';
            });
          }
          html += '<div style="font-weight:700;color:#16a34a;"><b>'+i18n('hUniformVerdict')+'</b> ' + _esc(item.verdict||'') + '</div>'; /* v54.281 fix: 判定: → hUniformVerdict */
          html += '</div>';
        } else if (item.type === '溶出度') {
          html += '<div class="fs-12-lh-18">';
          html += '<div><b>'+i18n('hLabelLimit')+'</b> ' + _fmtNum(_esc(item.label||''), 2) + '%</div>'; /* v54.281 fix: 标示量限度: → hLabelLimit */
          if (item.samples) {
            item.samples.forEach(function(s, si) {
              html += '<div class="pl-16">' + i18n('tplSamplePrefix') + (si+1) + ': ' + s.parallels.map(function(p){ return _fmtNum(p.content); }).join(', ') + '</div>';
            });
          }
          html += '<div><b>' + i18n('tplMeanPrefix') + '</b> ' + _fmtNum(_esc(item.mean||''), 2) + ' | <b>'+i18n('hSd')+':</b> ' + _fmtNum(_esc(item.sd||''), 4) + ' | <b>'+i18n('hRsd')+' (%):</b> ' + _fmtNum(_esc(item.rsd||''), 2) + '</div>'; /* v54.281 fix: SD/RSD → hSd/hRsd */
          html += '</div>';
        } else if (item.type === '标准曲线') {
          html += '<div class="fs-12-lh-18">';
          if (item.points) {
            html += '<div><b>'+i18n('hCurveDataPoint')+'</b> ' + (item.points||[]).map(function(p){ return '(' + _fmtNum(p.x) + ',' + _fmtNum(p.y) + ')'; }).join('; ') + '</div>'; /* v54.281 fix: 数据点: → hCurveDataPoint */
          }
          html += '<div style="font-weight:700;color:#2563eb;"><b>'+i18n('cvCurveEqFmt').replace('{0}', _esc(item.a||'')).replace('{1}', _esc(item.b||''))+'</b></div>'; /* v54.281 fix: y = ax + (b) → cvCurveEqFmt */
          html += '<div><b>'+i18n('cvCurveR2Fmt').replace('{0}', _esc(item.r2||''))+'</b></div>'; /* v54.281 fix: R² = r2 → cvCurveR2Fmt */
          html += '</div>';
        } else {
          // 未知类型：显示原始数据
          html += '<div style="font-size:12px;word-break:break-all;color:#666;">' + JSON.stringify(item, null, 2) + '</div>';
        }
        html += '</div>';
      });
    }
  }

  // 页脚
  html += '<div style="text-align:center;margin-top:30px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#999;">';
  html += i18n('pdfFooterGenFmt').replace('{0}', _esc(i18n('appTitle'))).replace('{1}', _esc(_formatNow())); /* v54.281 fix: 'RSD & 含量计算器 自动生成 | ...' → pdfFooterGenFmt */
  html += '</div>';

  // 主题化：用当前 CSS 变量值替换硬编码颜色（让 PDF/导出跟随主题变化）
  const themePrimary = _cssVar('--primary') || '#2563eb';
  const themeSuccess = _cssVar('--success') || '#16a34a';
  html = html.replace(/#2563eb/g, themePrimary).replace(/#16a34a/g, themeSuccess);

  container.innerHTML = html;
  // 生成 QR 码（用 report meta + URL hash 编码）——v54.103 迁移：QR img 由 _generatePDFReport 自动添加
  const qrDataUrl = await _generateReportQR(_reportQRText(meta));

  // v54.103 迁移到 _generatePDFReport 高级 helper（DRY：复用 pageNumbers 水印 + qrDataUrl 自动添加 + fallback window.print）
  var fname = i18n('cvInspectionReport') + (meta.sampleName ? '_' + meta.sampleName.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + (meta.batch ? '_' + meta.batch.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + '_' + new Date().toISOString().slice(0,10) + '.pdf';
  _generatePDFReport({
    container: container,
    filename: fname,
    pageNumbers: true,
    pageNumbersMeta: { operator: meta.operator },
    qrDataUrl: qrDataUrl,
    fallbackToPrint: true,
    // v54.238 fix: PDF 失败时给用户 alert 而非仅 console.error（与 exportComprehensiveReport 同款）
    onError: function(err) { console.error('PDF export failed:', err); if(typeof _i18nAlert === 'function') _i18nAlert('cvReportExportFail'); }
  });
}

exportExcel = function() {
  const h = getH();
  if (h.length === 0) { _i18nAlert('noRecords'); return; }
  const rows = [[i18n('hXlsColNo'),i18n('csvHeaderType'),i18n('csvHeaderTime'),i18n('hXlsColParam'),i18n('hXlsColResult'),i18n('histAvg'),i18n('cvSdShort'),i18n('csvHeaderRsdPct')]];
  h.forEach((e, i) => {
    if (e.type === '统计计算') {
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, e.data, '', e.mean, e.sd, e.rsd+'%']);
    } else if (e.type === '含量计算' || e.type === '外标含量') {
      let detail, result;
      if (e.samples && e.samples[0] && e.samples[0].parallels) {
        detail = e.samples.map((s,j)=>i18n('hSample')+(j+1)+': W='+s.weight+' D='+s.dilution+' | A: '+s.parallels.map(p=>p.area).join(',')).join('; ');
        result = e.samples.map(s=>s.parallels.length+i18n('histParallelUnit')).join('; ');
      } else {
        detail = e.samples.map((s, j) => '#'+(j+1)+': A='+s.area+' W='+s.weight+' D='+s.dilution+i18n('histMoisture')+s.moisture+i18n('percentResidue')+s.residue+'%').join('; ');
        result = e.contents ? e.contents.join(', ') + '%' : '';
      }
      const stdInfo = 'A='+e.stdArea+' W='+e.stdWeight+'mg P='+e.stdPurity+'% D='+e.stdDilution+'mL '+i18n('hXlsColMoistureFmt').replace('{0}',e.stdMoisture)+i18n('percentResidue')+e.stdResidue+'%';
      rows.push([i+1, i18n(_typeI18n('外标含量')), e.time, stdInfo, result, e.cMean||'', e.cSd||'', (e.cRsd||'')+'%', detail]);
    } else if (e.type === '回收率-面积归一化法') {
      const param = i18n('histStdInfo')+e.stdWeight+'mg P='+e.stdPurity+'% D='+e.stdDilution+i18n('histStdAreaPctFmt')+(e.stdAreaPcts||[]).join(', ')+i18n('histAvg')+e.stdAreaAvg+'%';
      const splInfo = e.independent
        ? i18n('hNormSampleIndep')+(e.splSamples||[]).map((s,j)=>'#'+(j+1)+'[W='+s.weight+' D='+s.dilution+' A%='+s.areaPct+']').join('; ')
        : (e.splSamples && e.splSamples.length > 0
          ? i18n('hNormSampleShared')+(e.splSamples||[]).map((s,j)=>'#'+(j+1)+'[W='+s.weight+' D='+s.dilution+' A%='+s.areaPct+']').join('; ')
          : i18n('histSampleShared')+e.splWeight+'mg D='+e.splDilution+'mL A%: '+(e.splAreaPcts||[]).join(', '));
      const regInfo = e.regression && e.regression.r ? i18n('histRegression')+e.regression.a+'x+'+e.regression.b+' r='+e.regression.r : '';
      const fInfo = 'f='+(e.manualF||e.calcF||'—')+'('+(e.manualF?i18n('histManual'):i18n('histAuto'))+')';
      const result = (e.recoveries||[]).join(', ')+'% '+fInfo+' '+regInfo;
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, param, result, e.cMean||'', e.cSd||'', (e.cRsd||'')+'%', splInfo]);
    } else if (e.type === '回收率-简易') {
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, i18n('histSimpleTheory')+e.theory+'% '+i18n('histSimpleMeasured')+e.measured+'%', i18n('histSimpleRecovery')+e.recovery+'%', '', '', '']);
    } else if (e.type === '回收率-外标法') {
      const stdInfo = 'A='+e.stdArea+' W='+e.stdWeight+'mg P='+e.stdPurity+'% D='+e.stdDilution+'mL';
      const detail = e.samples.map((s, j) => '#'+(j+1)+': A='+s.area+' W='+s.weight+' D='+s.dilution+i18n('hTheoryShort')+s.theory+'%').join('; ');
      const result = e.recoveries.join(', ') + '%';
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, stdInfo, result, e.cMean||'', e.cSd||'', (e.cRsd||'')+'%', detail]);
    } else if (e.type === '回收率-内标法') {
      const stdInfo = 'A='+e.stdArea+' IS_A='+e.stdIsArea+' Conc='+e.stdConc+'mg/mL';
      const detail = e.samples.map((s, j) => '#'+(j+1)+': A='+s.area+' IS_A='+s.isArea+i18n('hTheoryShort')+s.theory).join('; ');
      const result = e.recoveries.join(', ') + '%';
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, stdInfo, result, e.cMean||'', e.cSd||'', (e.cRsd||'')+'%', detail]);
    } else if (e.type === '滴定度') {
      const stdInfo = i18n('hTiterVs')+(e.vs||'')+i18n('histTiterV0s')+(e.v0s||'')+i18n('histTiterRefMass')+(e.ms||'')+' P='+(e.ps||'')+' F='+(e.f||'')+' T='+(e.T||i18n('histAuto'));
      const detail = (e.samples||[]).map((s,j)=>'#'+(j+1)+i18n('histTiterParallel')+s.parallels.map((p,pi)=>'P'+(pi+1)+'[W='+p.w+' V0='+p.v0+' V='+p.v+']').join(' ')).join('; ');
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, stdInfo, detail, '', '', '']);
    } else if (e.type === '干燥失重' || e.type === '炽灼残渣') {
      const detail = (e.samples||[]).map((s,j) => {
        const plist = (s.parallels||[]).map((p,pi) => 'P'+(pi+1)+'[W₀='+(p.w0||'')+' W₁='+(p.w1||'')+' W₂='+(p.w2||'')+']').join(' ');
        return '#'+(j+1)+': ' + plist;
      }).join('; ');
      const result = (e.samples||[]).length+i18n('histSampleCount');
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, detail, result, e.mean||'', e.sd||'', (e.rsd||'')+'%']);
    } else if (e.type === '含量均匀度') {
      const param = i18n('hUniformL') + (e.L||'') + ' x̄=' + (e.xbar||'') + ' A=' + (e.A||'') + ' S=' + (e.S||'');
      const detail = (e.samples||[]).map((s,j) =>
        '#'+(j+1)+': ' + s.parallels.map(p => p.content).join(', ')
      ).join('; ');
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, param, e.verdict||'', '', '', '', detail]);
    } else if (e.type === '溶出度') {
      const param = i18n('histLabelAmount') + (e.label||'') + '%';
      const detail = (e.samples||[]).map((s,j) =>
        '#'+(j+1)+': ' + s.parallels.map(p => p.content).join(', ')
      ).join('; ');
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, param, detail, e.mean||'', e.sd||'', (e.rsd||'')+'%', '']);
    } else if (e.type === '标准曲线') {
      var pts = (e.points||[]).map(function(p){ return '('+p.x+','+p.y+')'; }).join('; ');
      rows.push([i+1, i18n(_typeI18n(e.type)), e.time, pts, '', 'y='+e.a+'x+('+e.b+')', '', i18n('histR2')+e.r2, '']);
    }
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, i18n('cvHistoryFilename'));
  XLSX.writeFile(wb, 'rsd-history-'+new Date().toISOString().slice(0,10)+'.xlsx');
};

// ==================== 公式输入全局处理 ====================
// 用户输入时自动检测并评估公式，显示结果提示
document.addEventListener('input', function(e) {
  const el = e.target;
  if (el.tagName !== 'INPUT' || el.type !== 'text') return;
  if (!el.parentNode) return;
  // v54.274 perf#9: 缓存 hint 元素引用到 dataset，避免每次输入 2 次 querySelector
  let hint, errHint;
  if (el.dataset.hintReady) {
    hint = el._hintRef; errHint = el._errHintRef;
    if (!hint || !hint.isConnected) { hint = null; el.dataset.hintReady = ''; }
    if (!errHint || !errHint.isConnected) { errHint = null; el.dataset.hintReady = ''; }
  }
  if (!hint || !errHint) {
    hint = el.parentNode.querySelector('.input-hint');
    errHint = el.parentNode.querySelector('.input-error-hint');
    if (!hint) { hint = document.createElement('span'); hint.className = 'input-hint'; el.parentNode.insertBefore(hint, el.nextSibling); }
    if (!errHint) { errHint = document.createElement('span'); errHint.className = 'input-error-hint'; errHint.id = 'formulaError-' + Math.random().toString(36).slice(2,9); el.parentNode.insertBefore(errHint, el.nextSibling); }
    el._hintRef = hint; el._errHintRef = errHint; el.dataset.hintReady = '1';
  }

  const raw = el.value.trim();
  el.classList.remove('input-formula', 'input-error');
  el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); /* v54.281 a11y (HIGH): 清除前次错误状态 */
  hint.style.display = 'none'; errHint.style.display = 'none';
  // 存储原始值供后续使用（公式原文）
  el.dataset.raw = raw;

  if (/[+\-*/%^()]|Math\./.test(raw)) {
    const result = calcExpr(raw);
    if (!Number.isFinite(result)) {
      el.classList.add('input-error');
      errHint.textContent = i18n('formulaError'); errHint.style.display = 'inline';
      el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', errHint.id); /* v54.281 a11y (HIGH): SR 关联错误提示 */
      el.dataset.calc = '';
    } else {
      el.classList.add('input-formula');
      hint.textContent = '= ' + fmtNum(result); hint.style.display = 'inline';
      el.dataset.calc = result;
    }
  } else {
    // 纯数字
    const num = parseFloat(raw);
    el.dataset.calc = !Number.isFinite(num) ? raw : num;
  }
});

// 获取输入框的实际数值（支持公式返回计算结果）
function inputVal(el) {
  if (!el) return NaN;
  const raw = el.value.trim();
  if (!raw) return NaN;
  // 如果有公式计算结果，优先使用
  if (el.dataset.calc && el.dataset.calc !== '' && el.dataset.calc !== raw && Number.isFinite(parseFloat(el.dataset.calc))) {
    return parseFloat(el.dataset.calc);
  }
  return parseFloat(raw);
}

// ==================== 卡片折叠 ====================
// a11y: card-title 保留 div（避免 button-in-button 因内嵌清空按钮），增加 role/tabindex/aria-expanded
// v54.246: card-collapsed 状态持久化到 localStorage（key=rsd-collapsed-cards），刷新/tab 切换不丢失
function _getCollapsedKey(card){
 if(!card) return null;
 const title = card.querySelector('.card-title');
 // 优先用 card-title 的 data-i18n 作为唯一标识（稳定且本地化无关）
 if(title){
  const i18nKey = title.getAttribute('data-i18n');
  if(i18nKey) return i18nKey;
 }
 // 其次用 card 自身 id
 if(card.id) return '#'+card.id;
 // 最后用文本内容
 const txt = (title ? title.textContent : card.textContent).trim().slice(0, 30);
 return txt;
}
function _loadCollapsedMap(){
 try { return JSON.parse(localStorage.getItem('rsd-collapsed-cards') || '{}') || {}; } catch(e){ return {}; }
}
function _saveCollapsedMap(m){ try { localStorage.setItem('rsd-collapsed-cards', JSON.stringify(m)); } catch(e){} }
function _initCardTitleA11y(){
 const _collapsedMap = _loadCollapsedMap(); /* v54.274 perf #2: hoist 出 forEach（之前每张 card 都 JSON.parse 一次 localStorage） */
 document.querySelectorAll('.card .card-title').forEach(function(t){
  if(!t.hasAttribute('role')) t.setAttribute('role', 'button');
  if(!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '0');
  const card = t.closest('.card');
  if(!card) return;
  if(!t.hasAttribute('aria-expanded')){
   t.setAttribute('aria-expanded', card.classList.contains('card-collapsed') ? 'false' : 'true');
  }
  // v54.252 a11y: card body id + aria-controls — 让 SR 知道按钮控制哪个区域
  let bodyId = card.id ? (card.id + '-body') : null;
  if(!bodyId){
   // 用 _getCollapsedKey 派生稳定 id（避免每次不同）
   const key = _getCollapsedKey(card);
   if(key) bodyId = 'card-body-' + key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  if(bodyId){
   let body = card.querySelector('.card-body');
   /* v54.274 fix (a11y #1): 没有 .card-body 时不能把 card 自己当 body —
      旧代码 body=card 然后 body.id=cardId+'-body' 会重命名 card.id，
      破坏 document.getElementById('norm-spl-card') 等（3 个隐藏输入按钮失效）。
      改为：无 .card-body 时不给 card 加 id，仅当找到真实 .card-body 才设 aria-controls。 */
   if(body){
     if(body.id !== bodyId) body.id = bodyId;
     t.setAttribute('aria-controls', bodyId);
   }
   /* 无 .card-body → 不设 aria-controls（避免自引用反模式） */
  }
  // v54.246: 从 localStorage 恢复 card-collapsed 状态
  const key = _getCollapsedKey(card);
  if(!key) return;
  if(_collapsedMap[key]) card.classList.add('card-collapsed'); /* v54.274 perf #2: 复用 hoisted map */
 });
}
function _togglePersist(card, collapsed){
 const key = _getCollapsedKey(card);
 if(!key) return;
 const m = _loadCollapsedMap();
 if(collapsed) m[key] = true;
 else delete m[key];
 _saveCollapsedMap(m);
}
document.addEventListener('DOMContentLoaded', _initCardTitleA11y);
document.addEventListener('click', function(e) {
 const title = e.target.closest('.card-title');
 if (!title) return;
 if (e.target.closest('button, input, label,.btn,.hide-toggle,.result-col')) return;
 const card = title.closest('.card');
 if (card){
  const collapsed = card.classList.toggle('card-collapsed');
  title.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  _togglePersist(card, collapsed);
 }
});
// 键盘可达：Enter/Space 触发折叠
document.addEventListener('keydown', function(e){
 if(e.key !== 'Enter' && e.key !== ' ') return;
 const title = e.target.closest && e.target.closest('.card-title');
 if(!title) return;
 if(e.target !== title) return; // 只在 title 自身聚焦时触发，避免拦截内嵌按钮
 e.preventDefault();
 const card = title.closest('.card');
 if(card){
  const collapsed = card.classList.toggle('card-collapsed');
  title.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  _togglePersist(card, collapsed);
 }
});





// ==================== 流动相配制模块 ====================
const SOLVENTS = [
  {n:"甲醇",d:0.792,p:"99.9%",t:"HPLC级"},{n:"乙腈",d:0.786,p:"99.9%",t:"HPLC级"},
  {n:"异丙醇",d:0.785,p:"99.9%",t:"HPLC级"},{n:"四氢呋喃",d:0.889,p:"99.9%",t:"HPLC级"},
  {n:"正己烷",d:0.659,p:"99.9%",t:"HPLC级"},{n:"去离子水",d:1.000,p:"100%",t:"18.2M\u03a9"},
  {n:"超纯水",d:1.000,p:"100%",t:"Milli-Q"},{n:"甲酸(88%)",d:1.220,p:"88%",t:"LC-MS级"},
  {n:"乙酸(99.7%)",d:1.049,p:"99.7%",t:"HPLC级"},{n:"磷酸(85%)",d:1.685,p:"85%",t:"HPLC级"},
  {n:"三氟乙酸(TFA)",d:1.480,p:"99%",t:"LC-MS级"},{n:"氨水(28%)",d:0.900,p:"28%",t:"LC-MS级"},
  {n:"三乙胺",d:0.726,p:"99%",t:"HPLC级"},{n:"甲酸铵",d:0,p:"100%",t:"MW=63.06"},
  {n:"乙酸铵",d:0,p:"100%",t:"MW=77.08"},{n:"磷酸二氢钾",d:0,p:"100%",t:"MW=136.09"},
  {n:"磷酸氢二钾",d:0,p:"100%",t:"MW=174.18"},{n:"碳酸氢铵",d:0,p:"100%",t:"MW=79.06"},
  {n:"氢氧化钠",d:0,p:"100%",t:"MW=40.00"},
];

const PRESETS = {
  meoh70:[["甲醇",70],["去离子水",30]],
  acn60:[["乙腈",60],["去离子水",40]],
  meohacn:[["甲醇",60],["乙腈",20],["去离子水",20]],
  fa01:[["去离子水",90],["乙腈",10]],
  hexipa:[["正己烷",95],["异丙醇",5]],
}

var rows=[["甲醇","70"],["去离子水","30"]];

function fmtMpNum(v,d){if(!Number.isFinite(v)&&v!==null&&v!==undefined)return"--";var f=Math.pow(10,d||2);return String(Math.round(v*f)/f);}
function esc(s){return String(s).replace(/[<>&]/g,function(c){return c==="<"?"&lt;":c===">"?"&gt;":"&amp;";});}
function isSolid(n){var s=["酸铵","磷酸二氢","磷酸氢二","氢氧化钠","碳酸氢铵"];for(var i=0;i<s.length;i++){if(n.indexOf(s[i])>=0)return true;}return false;}

function addMpRow(n,r){rows.push([n||"",r||""]);render();autoCalc();}
function removeMpRow(i){if(rows.length<=1)return;rows.splice(i,1);render();autoCalc();}

function render(){
  var c=document.getElementById("mp-rows");if(!c)return;c.innerHTML="";
  var _mpParts=[]; /* v54.274 perf #3: 用 parts 数组 + 一次性 join（旧代码 c.innerHTML += 在循环里 → O(n²) 重解析 + n 次 reflow + select/input 状态每次销毁重建） */
  for(var i=0;i<rows.length;i++){
    var opts="<option value=\"\">"+_esc(i18n('mpSelectSolvent'))+"</option>";
    for(var j=0;j<SOLVENTS.length;j++){opts+="<option value=\""+j+"\""+(rows[i][0]===SOLVENTS[j].n?" selected":"")+">"+SOLVENTS[j].n+"</option>";}
    opts+="<option value=\"custom\""+(rows[i][0]&&!SOLVENTS.some(function(s){return s.n===rows[i][0]})?" selected":"")+">"+_esc(i18n('mpCustomSolvent'))+"</option>";
    var d=rows.length>1?"":'disabled style="opacity:0.3"';
    /* v54.273 fix: 单引号字符串字面量导致 onchange="onSel('+i+',this.value)" 字面输出 + aria-label 单引号破；改拆成字符串拼接 */
    _mpParts.push('<div class="row"><select aria-label="' + _esc(i18n('mpSolventLabel')) + '" data-i18n-aria-label="mpSolventLabel" onchange="onSel(' + i + ',this.value)" style="flex:1.5;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:#f8fafc">' + opts + '</select>' +
      '<input value="' + _esc(rows[i][1]) + '" placeholder="%" style="flex:0.6;text-align:center" aria-label="' + _esc(i18n('lblRatioPct')) + '" data-i18n-aria-label="lblRatioPct" oninput="rows[' + i + '][1]=this.value;autoCalc()" inputmode="decimal">' +
      '<button type="button" class="btn btn-danger btn-xs" onclick="removeMpRow(' + i + ')" aria-label="' + _esc(i18n('ariaRemoveRow')) + '" data-i18n-aria-label="ariaRemoveRow" ' + d + '>-</button></div>');
  }
  c.innerHTML = _mpParts.join(''); /* 一次性写入（1 次解析 + 1 次 reflow） */
}

function onSel(i,v){if(!v)return;if(v==="custom"){rows[i][0]="";render();autoCalc();return;}rows[i][0]=SOLVENTS[parseInt(v,10)].n;render();autoCalc();}

function loadPreset(){
  // v54.68 防御：mp-preset 缺失时 TypeError 被吞
  var mpPreset = document.getElementById("mp-preset");
  if (!mpPreset) return;
  var k=mpPreset.value;if(!k)return;
  if(k==="empty"){rows.length=0;addMpRow("","");mpPreset.value="";return;}
  var d=PRESETS[k];if(!d)return;rows.length=0;for(var i=0;i<d.length;i++)rows.push([d[i][0],String(d[i][1])]);
  render();mpPreset.value="";autoCalc();
}

async function clearMobilePhase(){
 if(!await _confirmDialog(i18n('uiClearConfirm'),{ danger: true })) return;
 // v54.67 防御：DOM 缺失时 TypeError 被吞
 const setVal = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
 const setStyle = (id, v) => { const e = document.getElementById(id); if (e) e.style.display = v; };
  rows.length=0;
  rows.push(["甲醇","70"],["去离子水","30"]);
  setVal("mp-vol","1000");
  render();
  setStyle("mp-result","none");
  setStyle("mp-method-card","none");
  autoCalc();
}

function autoCalc(){
  // v54.69 防御：DOM 缺失时 TypeError 被吞
  const setStyle = (id, v) => { const e = document.getElementById(id); if (e) e.style.display = v; };
  const setHTML = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
  const gv = (id) => { const e = document.getElementById(id); return e ? e.value : ''; };
  var v=parseFloat(gv("mp-vol"))||0;
  var valid=true;for(var i=0;i<rows.length;i++)if(!rows[i][0].trim())valid=false;
  if(v<=0||rows.length===0||!valid){setStyle("mp-result","none");setStyle("mp-method-card","none");return;}

  var tp=0;for(var i=0;i<rows.length;i++)tp+=(parseFloat(rows[i][1])||0);
  if(tp<=0){setStyle("mp-result","none");setStyle("mp-method-card","none");return;}

  // 结果表
  var h='<table class="matrix-table"><thead><tr><th scope="col" data-i18n="lblComponent">组分</th><th scope="col" data-i18n="lblRatioPct">比例%</th><th scope="col" data-i18n="lblAmount">需要量</th><th scope="col" data-i18n="lblDescription">说明</th></tr></thead><tbody>';
  for(var i=0;i<rows.length;i++){
    var p=parseFloat(rows[i][1])||0;var vol=v*p/tp;
    var amt;
    if(isSolid(rows[i][0])){
      var mw=getMW(rows[i][0]);
      if(mw>0)amt=fmtMpNum(vol*0.001*mw,4)+" g";else amt=fmtMpNum(vol,4)+i18n('mpUnitSolid'); /* v54.274 fix (i18n #10): " g (固)" 硬编码 → i18n */
    }else{amt=fmtMpNum(vol,2)+" mL";}
    h+='<tr><td style="font-weight:600">'+esc(rows[i][0])+'</td><td>'+fmtMpNum(p,1)+'</td><td style="font-weight:700;color:var(--primary);font-size:15px">'+amt+'</td><td class="fs-11-light">'+getNote(rows[i][0])+'</td></tr>';
  }
  h+="</tbody></table>";h+='<div style="margin-top:4px;text-align:center;font-size:12px;color:var(--text-light)">'+i18n('mpTotalVolume')+' '+fmtMpNum(v,1)+' mL</div>';
  setHTML("mp-result-content",h);
  setStyle("mp-result","grid");

  // 配制方法
  var m='<div style="font-size:13px;line-height:2">';
  m+='<b>'+i18n('mpPrepareVol')+fmtMpNum(v,0)+' mL</b><br><br>';
  m+=i18n('mpStep1').replace('{0}',fmtMpNum(v,0))+'<br>';
  m+=i18n('mpStep2')+'<br>';
  for(var i=0;i<rows.length;i++){
    var p=parseFloat(rows[i][1])||0;var vol=v*p/tp;
    var tag=isSolid(rows[i][0])?i18n('mpWeigh'):i18n('mpMeasure');var unit=isSolid(rows[i][0])?"g":"mL";
    m+='&nbsp;&nbsp;'+(i+1)+'. '+esc(rows[i][0])+': '+tag+' '+fmtMpNum(vol,tag===i18n('mpWeigh')?4:2)+' '+unit+'<br>';
  }
  m+=i18n('mpStep3')+'<br>';
  m+=i18n('mpStep4')+'<br><br>';
  m+='<b>\u26a0 '+getWarnings()+'</b>';
  m+="</div>";
  // v54.71 \u9632\u5fa1\uff1amp-method-output / mp-method-card \u7f3a\u5931\u65f6 TypeError \u88ab\u541e\uff08v54.69 \u6f0f\u4fee\u6700\u540e\u4e24\u884c\uff09
  setHTML("mp-method-output", m);
  setStyle("mp-method-card", "block");
}

function getMW(n){for(var i=0;i<SOLVENTS.length;i++){var m=SOLVENTS[i].t.match(/MW=([\d.]+)/);if(m&&SOLVENTS[i].n===n)return parseFloat(m[1]);}return 0;}

function getNote(n){for(var i=0;i<SOLVENTS.length;i++){if(SOLVENTS[i].n===n){var p=[];if(SOLVENTS[i].t)p.push(SOLVENTS[i].t);if(SOLVENTS[i].d>0)p.push("d="+SOLVENTS[i].d);if(SOLVENTS[i].p!=="100%")p.push(SOLVENTS[i].p);return p.join(" | ");}}return "";}

function getWarnings(){for(var i=0;i<rows.length;i++){var n=rows[i][0];if(n.indexOf("甲酸")>=0||n.indexOf("TFA")>=0||n.indexOf("氨水")>=0||n==="乙酸(99.7%)")return i18n('mpWarnVolatile');}return i18n('mpWarnVent');}

function savePlan(){
  // v54.64 防御：mp-vol 缺失时 TypeError 被吞
  var volEl = document.getElementById("mp-vol");
  var e={time:_formatNow(),type:"流动相配制",vol: volEl ? volEl.value : '', rows:[]};
  for(var i=0;i<rows.length;i++)e.rows.push([rows[i][0],rows[i][1]]);
  // v54.250 fix (correctness LOW): 检查 addH 返回值，避免 savePlan 失败时仍弹 "savedShort"
  if (addH(e)) _i18nAlert("savedShort");
  else if (typeof _i18nToast === 'function') _i18nToast('toast_historySaveFail', 'error', 3000);
}

// ==================== 我的配方 + 批量配制（v54.76） ====================
var mpBatchSel = []; // 批量配制勾选的配方索引（升序）
function mpGetRecipes() { const r = _loadJson('rsd-mp-recipes', []); return Array.isArray(r) ? r : []; }
function mpSaveRecipes(arr) {
  try { localStorage.setItem('rsd-mp-recipes', JSON.stringify(arr)); return true; }
  catch (e) { if (typeof toast === 'function') _i18nToast('toast_recipeSaveFail', 'error', 5000); return false; }
}
function mpRowsSummary(recipeRows) {
  if (!Array.isArray(recipeRows) || !recipeRows.length) return i18n('mpRowsEmpty'); /* v54.274 fix (i18n #11): '（空）' 硬编码 → i18n */
  return recipeRows.map(function(r){ return (r && r[0] ? r[0] : '?') + (r && r[1] !== undefined && r[1] !== '' ? ' ' + r[1] : ''); }).join(' / ');
}
// v54.228 fix: 原 `if (!window.confirm(...)) return;` 调用同步 API 但 window.confirm 已被 override
// 成返回 Promise 的 _confirmDialog（line 7776）。!Promise 永远 false → silently bypass 覆盖确认
// 修复：直接 await _confirmDialog 拿到 true/false
async function mpSaveRecipe() {
  const nameEl = document.getElementById('mp-recipe-name');
  const volEl = document.getElementById('mp-vol');
  if (!nameEl) { _i18nToast('toast_recipeNameInputMissing', 'error'); return; }
  const name = String(nameEl.value || '').trim();
  if (!name) { _i18nToast('toast_pleaseEnterRecipeName', 'warn', 2500); nameEl.focus(); return; }
  // 校验当前 rows 有有效组分并深拷贝
  const validRows = [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i][0] && String(rows[i][0]).trim()) validRows.push([String(rows[i][0]), String(rows[i][1] === undefined ? '' : rows[i][1])]);
  }
  if (!validRows.length) { _i18nToast('toast_noValidComponents', 'warn', 2500); return; }
  // v54.230 fix: snapshot in-memory recipes → mutate → write → rollback on failure
  // 原版直接 splice + push + mpSaveRecipes，若写盘失败则内存与磁盘不一致（看起来"没生效"）
  const recipesSnap = mpGetRecipes();
  let recipes = recipesSnap.slice();
  let dup = -1;
  for (let j = 0; j < recipes.length; j++) if (recipes[j] && recipes[j].name === name) { dup = j; break; }
  if (dup >= 0) {
    // v54.237 fix: 用 i18n 替代硬编码中文（en 模式必须走翻译）
    if (!await _confirmDialog(i18n('recipeDupOverwriteFmt').replace('{0}', name))) return;
    recipes = recipes.slice(); recipes.splice(dup, 1);
  }
  recipes.push({ name: name, rows: validRows, vol: volEl ? (volEl.value || '1000') : '1000', savedAt: Date.now() });
  if (!mpSaveRecipes(recipes)) return;
  // commit
  recipesSnap.length = 0; recipesSnap.push(...recipes);
  nameEl.value = '';
  mpRenderRecipes();
  _i18nToast('toast_recipeSavedFmt', 'success', 2000, name);
}
function mpLoadRecipe(i) {
  const recipes = mpGetRecipes();
  if (!recipes[i]) { _i18nToast('toast_recipeNotFoundFmt', 'warn', null, i); return; }
  const volEl = document.getElementById('mp-vol');
  const rc = recipes[i];
  rows.length = 0;
  (Array.isArray(rc.rows) ? rc.rows : []).forEach(function(r){ rows.push([r && r[0] ? String(r[0]) : '', r && r[1] !== undefined ? String(r[1]) : '']); });
  if (volEl) volEl.value = (rc.vol !== undefined && rc.vol !== '' ? String(rc.vol) : '1000');
  render();
  autoCalc();
  _i18nToast('toast_recipeLoadedFmt', 'success', 2000, rc.name || '');
}
function mpRenameRecipe(i) {
  const recipes = mpGetRecipes();
  const rc = recipes[i];
  if (!rc) { _i18nToast('toast_recipeNotFound', 'warn'); return; }
  const newName = prompt(i18n('recipeRenamePromptFmt'), rc.name);
  if (newName === null) return; // 用户取消
  const t = String(newName).trim();
  if (!t) { _i18nToast('toast_nameEmpty', 'warn'); return; }
  for (let j = 0; j < recipes.length; j++) if (j !== i && recipes[j] && recipes[j].name === t) { _i18nToast('toast_recipeDuplicateFmt', 'warn', null, t); return; }
  rc.name = t;
  mpSaveRecipes(recipes);
  mpRenderRecipes();
  _i18nToast('toast_renamed', 'success', 1500);
}
async function mpDeleteRecipe(i) {
  const recipes = mpGetRecipes();
  const rc = recipes[i];
  if (!rc) { _i18nToast('toast_recipeNotFound', 'warn'); return; }
  // v54.237 fix: 用 i18n 替代硬编码中文
  if (!await _confirmDialog(i18n('recipeDeleteConfirmFmt').replace('{0}', rc.name || ''), { danger: true })) return;
  recipes.splice(i, 1);
  // 修正批量勾选索引（删除 i 后，>i 的下移 1）
  mpBatchSel = mpBatchSel.filter(function(x){ return x !== i; }).map(function(x){ return x > i ? x - 1 : x; });
  mpSaveRecipes(recipes);
  mpRenderRecipes();
  _i18nToast('toast_recipeDeleted', 'success', 1500);
}
function mpToggleBatch(i, checked) {
  const idx = mpBatchSel.indexOf(i);
  if (checked && idx < 0) mpBatchSel.push(i);
  if (!checked && idx >= 0) mpBatchSel.splice(idx, 1);
  mpBatchSel.sort(function(a,b){ return a - b; });
}
function mpRenderRecipes() {
  const listEl = document.getElementById('mp-recipe-list');
  if (!listEl) return;
  const recipes = mpGetRecipes();
  if (!recipes.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-light);padding:6px 0">' + _esc(i18n('mpEmptyListHint')) + '</div>';
    mpBatchSel = [];
    return;
  }
  // 清理失效勾选索引
  mpBatchSel = mpBatchSel.filter(function(x){ return x >= 0 && x < recipes.length; });
  var html = '';
  for (var i = 0; i < recipes.length; i++) {
    var rc = recipes[i];
    if (!rc) continue;
    var checked = mpBatchSel.indexOf(i) >= 0 ? ' checked' : '';
    var rName = _esc(rc.name || i18n('recipeUnnamed'));
    var ariaSel = i18n('ariaRecipeSelectFmt').replace('{0}', rName);
    var ariaLoad = i18n('ariaRecipeLoadFmt').replace('{0}', rName);
    var ariaRen = i18n('ariaRecipeRenameFmt').replace('{0}', rName);
    var ariaDel = i18n('ariaRecipeDeleteFmt').replace('{0}', rName);
    html += '<div style="display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px dashed var(--border);font-size:13px;flex-wrap:wrap">'
      + '<input type="checkbox" data-i18n-title="titleBatchCheck" title="' + _esc(i18n('titleBatchCheck')) + '" onchange="mpToggleBatch(' + i + ',this.checked)"' + checked + ' aria-label="' + ariaSel + '">'
      + '<span style="font-weight:600;min-width:120px">' + rName + '</span>'
      + '<span style="flex:1;color:var(--text-light);font-size:11px;min-width:120px">' + _esc(mpRowsSummary(rc.rows)) + (rc.vol !== undefined && rc.vol !== '' ? ' @ ' + _esc(String(rc.vol)) + ' mL' : '') + '</span>'
      + '<button class="btn btn-outline btn-xs" onclick="mpLoadRecipe(' + i + ')" data-i18n-title="titleLoadToEdit" title="' + _esc(i18n('titleLoadToEdit')) + '" aria-label="' + ariaLoad + '"><span data-i18n="btnLoadInline">' + _esc(i18n('btnLoadInline')) + '</span></button>'
      + '<button class="btn btn-outline btn-xs" onclick="mpRenameRecipe(' + i + ')" data-i18n="btnRenameInline" aria-label="' + ariaRen + '">改名</button>'
      + '<button class="btn btn-danger btn-xs" onclick="mpDeleteRecipe(' + i + ')" data-i18n="btnDelete" aria-label="' + ariaDel + '">删除</button>'
      + '</div>';
  }
  listEl.innerHTML = html;
}
// 纯函数：单个组分用量（对齐 autoCalc 算法；autoCalc 本体未改动）
function mpAmountFor(name, pct, totalPct, vol) {
  const nm = String(name || '');
  const p = parseFloat(pct) || 0;
  const tp = parseFloat(totalPct) || 0;
  const v = parseFloat(vol) || 0;
  if (tp <= 0 || v <= 0) return { amount: '--', unit: 'mL' };
  const componentVol = v * p / tp;
  if (isSolid(nm)) {
    const mw = getMW(nm);
    if (mw > 0) return { amount: fmtMpNum(componentVol * 0.001 * mw, 4), unit: 'g' };
    return { amount: fmtMpNum(componentVol, 4), unit: 'g(固)' };
  }
  return { amount: fmtMpNum(componentVol, 2), unit: 'mL' };
}
function _mpValidRowsForBatch(rc) {
  const out = [];
  if (!rc || !Array.isArray(rc.rows)) return out;
  for (var i = 0; i < rc.rows.length; i++) {
    var r = rc.rows[i];
    if (r && r[0] && String(r[0]).trim() && !Number.isFinite(parseFloat(r[1]))) out.push([String(r[0]), r[1]]);
  }
  return out;
}
function mpBatchPrep() {
  const outEl = document.getElementById('mp-batch-out');
  if (!outEl) { _i18nToast('toast_batchOutputMissing', 'error'); return; }
  if (mpBatchSel.length === 0) { outEl.innerHTML = ''; _i18nToast('toast_pleaseSelectBatchRecipes', 'warn', 2500); return; }
  const volEl = document.getElementById('mp-batch-vol');
  const vol = parseFloat(volEl ? volEl.value : '') || 1000;
  const recipes = mpGetRecipes();
  var html = '';
  mpBatchSel.forEach(function(i) {
    const rc = recipes[i];
    if (!rc) return;
    const rr = _mpValidRowsForBatch(rc);
    var tp = 0;
    rr.forEach(function(r){ const v = parseFloat(r[1]); if (Number.isFinite(v)) tp += v; });
    if (tp <= 0) return;
    html += '<div style="margin:10px 0 4px;font-weight:700;font-size:13px">📋 ' + _esc(rc.name || i18n('recipeUnnamed')) + ' <span style="color:var(--text-light);font-weight:400">' + _esc(i18n('mpBatchTableTargetFmt').replace('{0}', fmtMpNum(vol, 0))) + '</span></div>';
    html += '<table class="matrix-table" style="margin-bottom:4px"><thead><tr><th scope="col" data-i18n="lblComponent">组分</th><th scope="col" data-i18n="lblRatioPct">比例%</th><th scope="col" data-i18n="lblAmount">需要量</th><th scope="col" data-i18n="lblDescription">说明</th></tr></thead><tbody>';
    rr.forEach(function(r) {
      const amt = mpAmountFor(r[0], r[1], tp, vol);
      html += '<tr><td style="font-weight:600">' + _esc(r[0]) + '</td><td>' + fmtMpNum(parseFloat(r[1]), 1) + '</td><td style="font-weight:700;color:var(--primary)">' + _esc(amt.amount) + ' ' + _esc(amt.unit) + '</td><td class="fs-11-light">' + _esc(getNote(r[0])) + '</td></tr>';
    });
    html += '</tbody></table>';
  });
  if (!html) html = '<div style="font-size:12px;color:var(--text-light)">' + _esc(i18n('mpNoValidRatios')) + '</div>';
  outEl.innerHTML = html;
  const hint = document.getElementById('mp-batch-hint');
  if (hint) hint.textContent = i18n('mpBatchPrepHintFmt').replace('{0}', mpBatchSel.length) + ' ' + i18n('cvRecipePrep');
}
function mpExportBatchCSV() {
  if (mpBatchSel.length === 0) { _i18nToast('toast_pleaseSelectExportRecipes', 'warn', 2500); return; }
  const volEl = document.getElementById('mp-batch-vol');
  const vol = parseFloat(volEl ? volEl.value : '') || 1000;
  const recipes = mpGetRecipes();
  var lines = [[i18n('mpBatchCSVHeader'),i18n('cvTargetVol'),i18n('lblComponent'),i18n('ratioPercent'),i18n('lblAmount'),i18n('lblUnit')].map(function(c){ return csvCell(c); }).join(',')]; /* v54.274 fix (i18n #3): 组分/用量/单位 硬编码中文 → i18n */
  mpBatchSel.forEach(function(i) {
    const rc = recipes[i];
    if (!rc) return;
    const rr = _mpValidRowsForBatch(rc);
    var tp = 0;
    rr.forEach(function(r){ const v = parseFloat(r[1]); if (Number.isFinite(v)) tp += v; });
    if (tp <= 0) return;
    rr.forEach(function(r) {
      const amt = mpAmountFor(r[0], r[1], tp, vol);
      lines.push([rc.name || '', String(vol), r[0], String(r[1]), amt.amount, amt.unit].map(function(c){ return csvCell(c); }).join(','));
    });
  });
  if (lines.length <= 1) { _i18nToast('toast_noExportableRecipes', 'warn'); return; }
  blobDownloadCSV(lines, i18n('mpBatchCSVPrefix') + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.csv');
}

// ==================== v54.77 配方 CSV 导入（对称补全 v54.76 导出） ====================
// 解析一行 CSV（支持 "..." 含逗号 + "" 转义）；返回 cells 数组
function _mpParseCsvLine(line) {
  const cells = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"' && cur.length === 0) inQ = true;
      else if (c === ',') { cells.push(cur); cur = ''; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells;
}
// 解析整个 CSV 文本 → {recipes: [{name,vol,rows:[...]}], skipped: int}
// 期望列（表头存在则按名匹配，无表头则按位置）：配方 / 目标体积(mL) / 组分 / 比例(%)
// 用量/单位 重新计算，无需解析。
function mpParseRecipesCSV(text) {
  const out = { recipes: [], skipped: 0 };
  if (typeof text !== 'string' || !text) return out;
  // 去 BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(function(l){ return l.length > 0; });
  if (!lines.length) return out;
  // 找表头列索引
  const headerCells = _mpParseCsvLine(lines[0]);
  const colMap = { name: -1, vol: -1, solvent: -1, pct: -1 };
  for (let i = 0; i < headerCells.length; i++) {
    const h = String(headerCells[i] || '').trim().toLowerCase();
    if (h === '配方' || h === 'name') colMap.name = i;
    else if (h === '目标体积(ml)' || h === '目标体积' || h === 'vol') colMap.vol = i;
    else if (h === '组分' || h === 'solvent') colMap.solvent = i;
    else if (h === i18n('ratioPercent') || h === '比例' || h === 'pct') colMap.pct = i;
  }
  // 若表头不含期望列，按位置回退
  const useHeader = colMap.name >= 0 && colMap.vol >= 0 && colMap.solvent >= 0 && colMap.pct >= 0;
  const startIdx = useHeader ? 1 : 0;
  const cols = useHeader ? colMap : { name: 0, vol: 1, solvent: 2, pct: 3 };
  // 按 (name+vol) 分组
  const groupMap = {};
  for (let i = startIdx; i < lines.length; i++) {
    const cells = _mpParseCsvLine(lines[i]);
    if (cells.length < 4) { out.skipped++; continue; }
    const name = String(cells[cols.name] || '').trim();
    const vol = String(cells[cols.vol] || '').trim();
    const solvent = String(cells[cols.solvent] || '').trim();
    const pctRaw = String(cells[cols.pct] || '').trim();
    if (!name || !solvent) { out.skipped++; continue; }
    const pctNum = parseFloat(pctRaw);
    if (!Number.isFinite(pctNum)) { out.skipped++; continue; }
    const key = name + '\x00' + vol;
    if (!groupMap[key]) groupMap[key] = { name: name, vol: vol, rows: [] };
    groupMap[key].rows.push([solvent, pctRaw]);
  }
  out.recipes = Object.values(groupMap);
  return out;
}
// 合并导入的配方到现有库（v54.46 silent-skip 教训：计数 + 提示，不阻断）
function mpMergeImportedRecipes(importedRecipes, mode /* 'overwrite' | 'skip' | 'append' */) {
  if (!Array.isArray(importedRecipes) || !importedRecipes.length) return { added: 0, updated: 0, skipped: 0 };
  const existing = mpGetRecipes();
  const nameSet = new Set(existing.map(function(r){ return r && r.name; }).filter(Boolean));
  let added = 0, updated = 0, skipped = 0;
  for (let i = 0; i < importedRecipes.length; i++) {
    const ir = importedRecipes[i];
    if (!ir || !ir.name) { skipped++; continue; }
    if (!Array.isArray(ir.rows) || !ir.rows.length) { skipped++; continue; }
    const dupIdx = existing.findIndex(function(r){ return r && r.name === ir.name; });
    if (dupIdx >= 0) {
      if (mode === 'overwrite') { existing[dupIdx] = { name: ir.name, vol: ir.vol || existing[dupIdx].vol || '1000', rows: ir.rows.map(function(r){ return [r[0], String(r[1])]; }), savedAt: Date.now() }; updated++; }
      else if (mode === 'append') { existing.push({ name: ir.name + i18n('cvImported'), vol: ir.vol || '1000', rows: ir.rows, savedAt: Date.now() }); added++; }
      else { skipped++; } // 'skip'
    } else {
      existing.push({ name: ir.name, vol: ir.vol || '1000', rows: ir.rows.map(function(r){ return [r[0], String(r[1])]; }), savedAt: Date.now() });
      nameSet.add(ir.name);
      added++;
    }
  }
  if (added || updated) mpSaveRecipes(existing);
  return { added: added, updated: updated, skipped: skipped };
}
async function mpImportRecipeCSV(evt) {
  // v54.42 风格的 evt 守卫
  if (!evt || !evt.target || !evt.target.files || !evt.target.files[0]) {
    if (typeof toast === 'function') _i18nToast('toast_pleaseSelectCsv', 'warn', 2500);
    return;
  }
  const file = evt.target.files[0];
  // 重置 input.value（v54.42 模式）
  const _reset = function(){ try { evt.target.value = ''; } catch(e){} };
  const reader = new FileReader();
  // v54.228 fix: 用 _confirmDialog（异步）替代已被 override 成 Promise 的 window.confirm
  reader.onload = async function(e) {
    try {
      const text = String(e && e.target && e.target.result || '');
      const parsed = mpParseRecipesCSV(text);
      if (!parsed.recipes.length) {
        _i18nToast('toast_noValidRecipesFmt', 'warn', 3000, parsed.skipped);
        _reset();
        return;
      }
      const existing = mpGetRecipes();
      const dupCount = parsed.recipes.filter(function(r){ return existing.some(function(e){ return e && e.name === r.name; }); }).length;
      // 选模式：dupCount==0 直接 append；否则 confirm
      let mode = 'append';
      if (dupCount > 0) {
        // v54.237 fix: 用 i18n 替代 '检测到' 硬编码中文
        const choice = await _confirmDialog(i18n('recipeDupDetectedFmt').replace('{0}', dupCount) + ' ' + i18n('recipeDupConfirm'));
        if (choice) mode = 'overwrite';
        else mode = 'skip';
      }
      const res = mpMergeImportedRecipes(parsed.recipes, mode);
      // 修正 mpBatchSel：合并后索引可能变（重写 + 追加），最简安全做法：清空勾选让用户重新勾选
      mpBatchSel = [];
      mpRenderRecipes();
      const parts = [];
      if (res.added) parts.push(i18n('mpImportAddedPrefix') + res.added + i18n('counterUnit'));
      if (res.updated) parts.push(i18n('mpImportUpdatedPrefix') + res.updated + i18n('counterUnit'));
      if (res.skipped) parts.push(i18n('mpImportSkippedPrefix') + res.skipped + i18n('counterUnit'));
      if (parsed.skipped) parts.push(i18n('mpImportInvalidPrefix') + parsed.skipped + i18n('counterUnit')); /* v54.273 fix: 缺 i18n('counterUnit') 包装（zh 显示 "条"，en 显示 "items"） */
      _i18nToast('toast_batchClearedFmt', res.skipped || parsed.skipped ? 'warn' : 'success', 3500, parts.length ? parts.join(i18n('cvListSep')) : i18n('mpNoChange')); /* v54.273 fix: '无变化' 硬编码 → i18n('mpNoChange'); v54.274: 全角逗号 '，' → i18n('cvListSep') */
    } catch (err) {
      if (typeof toast === 'function') _i18nToast('toast_csvImportFailFmt', 'error', 5000, err && err.message || err);
    }
    _reset();
  };
  reader.onerror = function() {
    if (typeof toast === 'function') _i18nToast('toast_fileReadFail', 'error', 3000);
    _reset();
  };
  reader.readAsText(file);
}

// ==================== 初始化 ====================
for (let i=0;i<4;i++) addMpRow();
addContentSample();
addExtSample();
addIntSample();
calcStats();
updCount();
// v54.76：渲染「我的配方」列表（localStorage rsd-mp-recipes）
if (typeof mpRenderRecipes === 'function') mpRenderRecipes();

(function restore() {
  try {
    const s = JSON.parse(localStorage.getItem('rsd-calc-form'));
    if (s) Object.keys(s).forEach(k => { const el=document.getElementById(k); if (el && (el.value===''||el.value==='0'||el.value==='100')) el.value=s[k]||''; });
  } catch(e) {}
})();

// saveReportMetaFromSettings
// v54.233 fix (Round 4 A#5): 之前每个 keystroke 都触发 localStorage.setItem + JSON.stringify，
// 输 100 字符 = 100 次同步 IO + 100 次反序列化（其他 tab 也会被 storage 事件放大）。
// 改用 debounce 500ms 合并连续输入，最后再写一次。
var _saveReportMetaTimer = null;
function saveReportMetaFromSettings() {
  try {
    if (_saveReportMetaTimer) clearTimeout(_saveReportMetaTimer);
  } catch (_) {}
  _saveReportMetaTimer = setTimeout(function() {
    _saveReportMetaTimer = null;
    function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    setReportMeta({
      sampleName: v('settings-sample-name'),
      sampleId: v('settings-sample-id'),
      batch: v('settings-batch'),
      operator: v('settings-operator'),
      instrument: v('settings-instrument'),
      column: v('settings-column'),
      tagPrefix: v('settings-tag-prefix')
    });
  }, 500);
}

// ESC + overlay
(function(){
  var modals = [
    { id: 'migration-overlay', close: function(){ if(typeof closeMigrationDialog==='function') closeMigrationDialog(); } },
    { id: 'pharma-detail-modal', close: function(){ if(typeof closePharmaDetail==='function') closePharmaDetail(); } },
    { id: 'paste-panel', close: function(){ if(typeof closePastePanel==='function') closePastePanel(); } },
    { id: 'titer-template-panel', close: function(){ if(typeof closeTiterTemplatePanel==='function') closeTiterTemplatePanel(); } }
  ];
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape' && e.keyCode !== 27) return;
    for (var i = 0; i < modals.length; i++) {
      var el = document.getElementById(modals[i].id);
      if (el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none') { modals[i].close(); e.preventDefault(); return; }
    }
  });
  document.addEventListener('click', function(e){
    if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
      var closer = e.target.querySelector('[onclick*="close"], [data-close]');
      if (closer) closer.click();
      else if (e.target.id === 'pharma-detail-modal' && typeof closePharmaDetail === 'function') closePharmaDetail();
    }
  });
})();

// pagination
var _historyPage = 1;
var _saveBatchTimer = null; // v54.282 perf: _saveBatchSelected debounce 状态（必须模块级，否则每次调用都新建 timer 跨调用失效）
var _historyPageSize = 30;

function renderHistoryPagination(total) {
  var totalPages = Math.max(1, Math.ceil(total / _historyPageSize));
  if (_historyPage > totalPages) _historyPage = totalPages;
  var pageStart = (_historyPage - 1) * _historyPageSize;
  var pageEnd = Math.min(pageStart + _historyPageSize, total);
  if (totalPages <= 1) return '';
  var prevDis = _historyPage <= 1 ? 'disabled' : '';
  var nextDis = _historyPage >= totalPages ? 'disabled' : '';
  // v54.282 perf: hoist i18n 调用（renderHistory 每次调 renderHistoryPagination，循环中 i18n('ariaHistoryPageFmt') 调用 N 次 → 1 次）
  const _iPaginateSum = i18n('paginateSum'), _iPageFmt = i18n('ariaHistoryPageFmt'), _iBtnPrev = i18n('btnPrev'), _iBtnNext = i18n('btnNext');
  var sum = '<span style="color:#64748b">' + _iPaginateSum.replace('{0}', pageStart+1).replace('{1}', pageEnd).replace('{2}', total) + '</span>';
  var btns = '';
  for (var i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= _historyPage - 1 && i <= _historyPage + 1)) {
      var isCur = i === _historyPage;
      var ariaLabel = _iPageFmt.replace('{0}', i).replace('{1}', totalPages);
      btns += '<button class="btn btn-xs ' + (isCur ? 'btn-primary' : 'btn-outline') + '" onclick="_historyPage=' + i + ';renderHistory()" style="min-width:28px;padding:2px 6px" aria-label="' + ariaLabel + '"' + (isCur ? ' aria-current="page"' : '') + '>' + i + '</button> ';
    } else if (i === _historyPage - 2 || i === _historyPage + 2) {
      btns += '<span style="color:#94a3b8" aria-hidden="true">...</span> ';
    }
  }
  return '<div style="display:flex;align-items:center;gap:6px;justify-content:center;padding:12px 0;flex-wrap:wrap;font-size:12px">' + sum + '<button class="btn btn-outline btn-xs" ' + prevDis + ' onclick="if(!this.disabled){_historyPage--;renderHistory();}">' + _iBtnPrev + '</button>' + btns + '<button class="btn btn-outline btn-xs" ' + nextDis + ' onclick="if(!this.disabled){_historyPage++;renderHistory();}">' + _iBtnNext + '</button></div>';
}

// aria
document.querySelectorAll('.tab, .subtab').forEach(function(el){ var t=(el.textContent||'').trim(); if(t && !el.getAttribute('aria-label')) el.setAttribute('aria-label', t); });

// 动态加载脚本：返回 Promise，loaded 后 resolve
function loadScript(src) {
  return new Promise(function(resolve, reject) {
    // 已加载则直接 resolve
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (existing.dataset.loaded === 'true') resolve();
      else {
        // v54.238 fix: 用 _loadHandler 标记引用避免 listener 累积（v54.233 _showSampleIdPrompt 同款）
        if (existing._loadHandler) existing.removeEventListener('load', existing._loadHandler);
        existing._loadHandler = function() { resolve(); };
        existing.addEventListener('load', existing._loadHandler);
      }
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function() { s.dataset.loaded = 'true'; resolve(); };
    s.onerror = function() { reject(new Error('Failed to load ' + src)); };
    document.head.appendChild(s);
  });
}

// ensureQr
function ensureQr() { return typeof QRCode !== 'undefined' ? Promise.resolve() : loadScript('lib/qrcode.min.js'); }

// judgeEntry
function judgeEntry(e) {
  var issues = [];
  if (!e || !e.type) return { verdict: 'N/A', issues: issues };
  if (e.type === '统计计算') {
    var rsd = parseFloat(e.rsd);
    if (Number.isFinite(rsd)) { /* v54.272 fix (correctness CRITICAL): flipped !Number.isFinite → Number.isFinite — was inversion bug */
      if (rsd > 5) issues.push({ rule: i18n('judgeRuleRsdLe5'), msg: i18n('cvRsdEqPctFmt').replace('{0}', rsd.toFixed(2)) }); /* v54.280 fix: 'RSD<=5%'/'RSD<=2%' 硬编码 → i18n + msg 用模板 */
      else if (rsd > 2) issues.push({ rule: i18n('judgeRuleRsdLe2'), msg: i18n('cvRsdEqPctFmt').replace('{0}', rsd.toFixed(2)) });
    }
  } else if (e.type && e.type.indexOf('回收率') === 0) {
    (e.recoveries || []).map(parseFloat).filter(function(v){return Number.isFinite(v);}).forEach(function(r, i) {
      if (r < 80 || r > 115) issues.push({ rule: i18n('judgeRuleRecoveryRange'), msg: i18n('judgeRecoveryFmt').replace('{0}', i+1).replace('{1}', r.toFixed(2)) }); /* v54.280 fix */
    });
    var cr = parseFloat(e.cRsd);
    if (Number.isFinite(cr) && cr > 8) issues.push({ rule: i18n('judgeRuleRsdLe8'), msg: i18n('cvRsdEqPctFmt').replace('{0}', cr.toFixed(2)) });
  } else if (e.type === '自生对照法') {
    var tp = parseFloat(e.totalImp), sl = parseFloat(e.singleLimit), tl = parseFloat(e.totalLimit);
    if (Number.isFinite(tp) && Number.isFinite(tl) && tp > tl) issues.push({ rule: i18n('judgeRuleTotalLeLimit'), msg: i18n('judgeTotalFmt').replace('{0}', tp.toFixed(4)) }); /* v54.280 fix */
  }
  return { verdict: issues.length === 0 ? i18n('verdictCompliant') : i18n('verdictNonCompliant'), issues: issues };
}

// Module preview render (creates card if missing)
function showModulePreview(containerId, prefix, title, aoa) {
  var card = document.getElementById(containerId);
  if (!card) {
    card = document.createElement('div');
    card.className = 'card';
    card.id = containerId;
    card.style.marginTop = '8px';
    card.innerHTML = '<div class="card-title">' + title + '</div><div id="' + prefix + '-preview" style="font-size:12px;line-height:1.5;max-height:400px;overflow:auto"></div>';
    // v54.96 修复：原代码创建 card 但不 append 到 DOM（detached node），clickTests getElementById 找不到 → "card not created" 假阴性
    // 优先 append 到 sp-{spId} 容器（fallback 路径的归宿），否则 document.body（兜底）
    var sp = document.getElementById('sp-' + prefix.replace(/-preview$/, '').replace(/^sp-/, ''));
    (sp || document.body).appendChild(card);
  }
  var content = document.getElementById(prefix + '-preview');
  if (content) content.innerHTML = aoaToHtmlTable(aoa, {fontSize: 11});
  card.style.display = 'block';
}
// v54.254 cleanup: 删除 renderNormPreview / renderExtPreview / renderIntPreview
// 扫描确认：HTML 无对应 Preview 按钮（回收率 3 模块只保留 saveRecoveryHistory），
// 且无其它调用方 → 由 renderSpecialPreview(spId) 统一 dispatch 取代。


// Generic preview for specialized modules (scrapes DOM)
// v54.96 5 module 优先 dispatch 到 v54.93 build*Report 路径（与 3 个回收率 module 一致）；其他 special module 仍走 DOM scrape fallback
function renderSpecialPreview(spId) {
  var dispatch = {
    'drying':    { collect: collectDryingData,    build: buildDryingReport },
    'residue':   { collect: collectResidueData,   build: buildResidueReport },
    'titer':     { collect: collectTiterData,     build: buildTiterReport },
    'uniformity':{ collect: collectUniformityData,build: buildUniformityReport },
    'dissolution':{ collect: collectDissolutionData, build: buildDissolutionReport }
  };
  var h = dispatch[spId];
  if (h && typeof h.collect === 'function' && typeof h.build === 'function') {
    var d = h.collect();
    // v54.96 即使没数据也创建 card（让用户能看到 "请先计算" 提示，与 clickTests 期望一致）
    if (!d.rows.length) d.rows = [{}]; // 占位让 build*Report 不被 rows 空数组跳过
    showModulePreview('sp-' + spId + '-preview-card', 'sp-' + spId, i18n('lblSpReportTitle').replace('{0}', spId.toUpperCase()), h.build(d, getReportMeta()));
    return;
  }
  var cardId = 'sp-' + spId + '-preview-card';
  var card = document.getElementById(cardId);
  if (!card) {
    card = document.createElement('div');
    card.className = 'card';
    card.id = cardId;
    card.style.marginTop = '8px';
    card.innerHTML = '<div class="card-title">' + _esc(i18n('lblSpPreviewCardTitle').replace('{0}', spId.toUpperCase())) + '</div><div id="sp-' + spId + '-preview" style="font-size:12px;line-height:1.5;max-height:400px;overflow:auto"></div>';
    // Append into the sp-method container
    var sp = document.getElementById('sp-' + spId);
    if (sp) sp.appendChild(card);
  }
  var content = document.getElementById('sp-' + spId + '-preview');
  if (!content) return;
  var sp = document.getElementById('sp-' + spId);
  if (!sp) return;
  var meta = getReportMeta();
  var r = [];
  r.push([i18n('lblSpReportTitle').replace('{0}', spId.toUpperCase()), '', '', '', '']);
  r.push([i18n('lblSpMetaDate'), meta.date || '', i18n('lblSpMetaOperator'), meta.operator || '']);
  r.push([i18n('lblSpMetaInstrument'), meta.instrument || '', i18n('lblSpMetaColumn'), meta.column || '']);
  // Scrape result box
  var resultBox = sp.querySelector('.result-box, [id$="-result"], [id$="-stats"]');
  if (resultBox) {
    var items = resultBox.querySelectorAll('.result-item');
    items.forEach(function(it) {
      var label = it.querySelector('.label');
      var value = it.querySelector('.value');
      if (label && value) r.push([label.textContent.trim(), value.textContent.trim(), '', '', '']);
    });
  }
  // Scrape sample tables
  var tables = sp.querySelectorAll('.matrix-table, table');
  tables.forEach(function(t) {
    var rows = t.querySelectorAll('tr');
    if (rows.length > 0 && rows.length < 25) {
      r.push([]);
      rows.forEach(function(tr) {
        var cells = Array.from(tr.querySelectorAll('th,td')).map(function(c) { return c.textContent.trim(); });
        if (cells.length > 0) r.push(cells);
      });
    }
  });
  // Scrape verdict
  var verdict = sp.querySelector('#selfref-summary, [id$="-verdict"]');
  if (verdict) r.push([i18n('lblSpVerdict'), verdict.textContent.trim(), '', '', '']);
  if (r.length <= 3) r.push([i18n('lblSpNoData'), '', '', '', '']);
  content.innerHTML = aoaToHtmlTable(r, {fontSize: 11});
  card.style.display = 'block';
}

function selectComprehensiveRecords() {
  var h = getH();
  var groups = { 'drying': [], 'recovery': [], 'curve': [], 'stab': [] };
  h.forEach(function(e) {
    // v54.23 防御：localStorage 损坏/外部修改/老版本升级可能产生 null/string/缺 type 的 entry
    if (!e || typeof e !== 'object' || typeof e.type !== 'string') return;
    // v54.239 fix: precision 段 type 是 '精密度'，但 saveStatsHistory 写的是 '统计计算'，
    // 兼容 '统计分析' 让 CV 报告的精密度 section 不再为空
    if (e.type === '精密度' || e.type === '统计计算') groups.drying.push(e);
    else if (e.type.indexOf('回收率') === 0) groups.recovery.push(e);
    else if (e.type === '标准曲线') groups.curve.push(e);
    // v54.239 fix: stability 段 type 是 '稳定性研究'，但 save 函数从来没创建这个 type。
    // 改成兼容：同时接受 '稳定性研究' 和 '稳定性' (实际 save 路径可能用 '稳定性')
    else if (e.type === '稳定性研究' || e.type === '稳定性') groups.stab.push(e);
  });
  return { precision: groups.drying[0] || null, recovery: groups.recovery[0] || null, linear: groups.curve[0] || null, stability: groups.stab[0] || null };
}
// v54.254 cleanup: 删除 buildLinearReportFromEntry / buildStabilityReportFromEntry
// 扫描确认：无任何调用方；CV 综合报告的 linear/stability section 由 buildComprehensiveReport 直接内联，
// 不再经这两个 v54.23 遗留的 per-entry 构建器。
function buildComprehensiveReport(records, meta) {
  // v54.78 报告元数据增强：per-record _meta 优先，fallback global meta
  var _pm = (records && records.precision && records.precision._meta) || (meta || {});
  var r = [];
  r.push([i18n('cvReportComprehensive'),'','','','']); /* v54.279 fix: 'Comprehensive' 硬编码 → i18n */
  r.push([i18n('cvReportDate'), _pm.date || '']);
  r.push([i18n('metaSampleName'), _pm.sampleName || '']);
  r.push([i18n('placeholderSampleId'), _pm.sampleId || '']);
  r.push([i18n('cvMetaBatch'), _pm.batch || '']);
  r.push([i18n('cvMetaOperator'), _pm.operator || '']);
  r.push([i18n('cvMetaInstrument'), _pm.instrument || '']);
  r.push([i18n('cvMetaColumn'), _pm.column || '']);
  r.push(['','','','','']);
  if (records.precision) r.push([i18n('cvPrecision'), i18n('cvRsdEqPctFmt').replace('{0}', records.precision.rsd)]); /* v54.281 fix (correctness CRITICAL): totalRSD → rsd */
  if (records.recovery) r.push([i18n('cvAccuracy'), i18n('cvReportTypeFmt').replace('{0}', esc(records.recovery.type || ''))]); /* v54.279 fix: 'Recovery'/'type=...' → i18n */
if (records.linear) r.push([i18n('cvLinearity'), records.linear.r2 != null ? i18n('cvR2EqFmt').replace('{0}', i18n('cvR2')).replace('{1}', esc(String(records.linear.r2))) : i18n('cvR2Available')]); /* v54.281 fix: cvR2EqFmt {0}=R² label, {1}=value；之前只 replace {0} → "{1}" 裸占位符 */
  if (records.stability) r.push([i18n('cvStability'), i18n('cvStabilityOk')]); /* v54.279 fix: 'Stability'/'OK' → i18n */
  return r;
}
function renderComprehensivePreview() {
  var card = document.getElementById('comprehensive-preview-card');
  var content = document.getElementById('comprehensive-preview');
  if (!card || !content) return;
  var records = selectComprehensiveRecords();
  content.innerHTML = aoaToHtmlTable(buildComprehensiveReport(records, getReportMeta()), {fontSize:11});
  card.style.display = 'block';
}
async function exportCVExcel() {
  return _withBtnLoading(function(){
  if (typeof XLSX === 'undefined') { _i18nAlert('xlsxMissing'); return; }
  const records = selectComprehensiveRecords();
  const meta = (typeof getReportMeta === 'function') ? getReportMeta() : {};
  // 汇总 sheet（header + 4 子报告）
  const summaryAoa = buildComprehensiveReport(records, meta);
  // 各子报告详细 sheet
  // v54.78：各 sub-sheet 用各自 entry._meta（per-record）优先，fallback global meta
  var _pMeta = (records.precision && records.precision._meta) || meta;
  var _rMeta = (records.recovery && records.recovery._meta) || meta;
  var _lMeta = (records.linear && records.linear._meta) || meta;
  var _sMeta = (records.stability && records.stability._meta) || meta;
  function _metaRows(m) { return [[i18n('metaSampleName'), m.sampleName||''],[i18n('placeholderSampleId'), m.sampleId||''],[i18n('cvMetaBatch'), m.batch||''],[i18n('cvMetaOperator'), m.operator||''],[i18n('cvMetaInstrument'), m.instrument||''],[i18n('cvMetaColumn'), m.column||'']]; } /* v54.274 fix (i18n #6): 4 处硬编码中文 → cvMeta* */
  const precisionSheet = [[i18n('cvPrecision')],[i18n('dateLabel'), _pMeta.date || '']]
    .concat(_metaRows(_pMeta))
    .concat([[i18n('csvHeaderType'), records.precision?.type || ''],[i18n('reportData'), records.precision?.data || ''],[i18n('cvMean'), records.precision?.mean != null ? String(records.precision.mean) : ''],[i18n('cvSD'), records.precision?.sd != null ? String(records.precision.sd) : ''],[i18n('cvRsdPct'), records.precision?.rsd != null ? String(records.precision.rsd) : ''],[i18n('totalRsdPct'), records.precision?.rsd != null ? String(records.precision.rsd) : '']]); /* v54.281 fix: totalRSD → rsd */
  const recoverySheet = [[i18n('cvAccuracy')],[i18n('dateLabel'), _rMeta.date || '']]
    .concat(_metaRows(_rMeta))
    .concat([[i18n('cvMethodType'), records.recovery?.type || ''],[i18n('avgRecoveryPct'), records.recovery?.cMean != null ? String(records.recovery.cMean) : ''],[i18n('cvSD'), records.recovery?.cSd != null ? String(records.recovery.cSd) : ''],[i18n('cvRsdPct'), records.recovery?.cRsd != null ? String(records.recovery.cRsd) : ''],[i18n('metaSampleCount'), records.recovery?.count != null ? String(records.recovery.count) : '']]); /* v54.274 fix (i18n #7): 方法类型/SD/RSD (%) 硬编码 → i18n */
  const linearSheet = [[i18n('cvLinearity')],[i18n('dateLabel'), _lMeta.date || '']]
    .concat(_metaRows(_lMeta))
    .concat([[i18n('csvHeaderType'), records.linear?.type || ''],[i18n('lblSlope'), records.linear?.a != null ? String(records.linear.a) : ''],[i18n('lblIntercept'), records.linear?.b != null ? String(records.linear.b) : ''],[i18n('cvR2'), records.linear?.r2 != null ? String(records.linear.r2) : ''],[i18n('cvDataPointCount'), Array.isArray(records.linear?.points) ? String(records.linear.points.length) : '0']]);
  const stabilitySheet = [[i18n('cvStability')],[i18n('dateLabel'), _sMeta.date || '']]
    .concat(_metaRows(_sMeta))
    .concat([[i18n('csvHeaderType'), records.stability?.type || ''],[i18n('cvVerdict'), records.stability?.verdict || 'OK'],[i18n('reportData'), records.stability?.data || '']]);
  ensureXlsx().then(function(xlsx) {
    if (!xlsx) { _i18nToast('toast_xlsxLoadFail', 'error', 5000); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), i18n('reportSummary'));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(precisionSheet), i18n('cvSheetPrecision'));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(recoverySheet), i18n('cvSheetAccuracy'));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linearSheet), i18n('cvSheetLinearity'));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(stabilitySheet), i18n('cvSheetStability'));
    XLSX.writeFile(wb, metaFilename('comprehensive', meta) + '.xlsx');
    flashEl('debug-tag', i18n('flashCvExcelExported'));
  // v54.238 fix: 加 .catch 防 XLSX 写盘失败抛 unhandledrejection（与 _exportModuleExcel 同款）
  }).catch(function(err){ console.error('[export CV] xlsx failed', err); if(typeof _i18nToast === 'function') _i18nToast('toast_xlsxLoadFail', 'error', 5000); });
  }).apply(this, arguments);
}
async function exportComprehensiveReport() {
  if (typeof html2pdf === 'undefined') { _i18nAlert('pdfMissing'); return; }
  // 弱网检测
  if (typeof _isPoorConnection === 'function' && _isPoorConnection()) {
    const q = _getConnQuality();
    if (typeof toast === 'function') _i18nToast('toast_weakNetworkCv', 'warn', 4000, q.type);
  }
  const h = getH();
  const meta = (typeof getReportMeta === 'function') ? getReportMeta() : {};
  const records = selectComprehensiveRecords();
  const themePrimary = _cssVar('--primary') || '#2563eb';
  const themeSuccess = _cssVar('--success') || '#16a34a';
  const themePrimaryLight = _cssVar('--primary-light') || '#dbeafe';
  const themeBorder = _cssVar('--border') || '#e2e8f0';
  const esc = (s) => s == null ? '' : String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // 构建综合报告 HTML（封面 + 4 子报告）
  let html = '';
  html += '<div style="text-align:center;border-bottom:2px solid ' + themePrimary + ';padding-bottom:12px;margin-bottom:14px">';
  html += '<h2 style="margin:0 0 4px;color:' + themePrimary + i18n('cvHtmlReportTitleH2');
  html += '<p style="color:#666;font-size:12px;margin:0">' + i18n('exportTimePrefixFmt').replace('{0}', esc(_formatNow())) + '</p>';
  if (meta.sampleName || meta.operator || meta.instrument) {
    var metaRows = [[]];
    var metaRow = [];
    if (meta.sampleName) metaRow.push('<b>' + _esc(i18n('lblSampleNameColon')) + '</b> ' + esc(meta.sampleName)); /* v54.277 fix: data-i18n 在导出 HTML 是死代码（_applyI18n 只跑 live DOM）→ 改为运行时 _esc(i18n(...)) */
    if (meta.batch) metaRow.push('<b>' + _esc(i18n('lblBatchColon')) + '</b> ' + esc(meta.batch));
    if (metaRow.length) { metaRows[0] = metaRow; metaRow = []; }
    if (meta.operator) metaRow.push('<b>' + _esc(i18n('lblOperatorColon')) + '</b> ' + esc(meta.operator));
    if (meta.instrument) metaRow.push('<b>' + _esc(i18n('lblInstrumentColon')) + '</b> ' + esc(meta.instrument || '—'));
    if (metaRow.length) metaRows.push(metaRow);
    html += aoaToHtmlTable(metaRows, {fontSize: 11});
  }
  html += '</div>';

  // 综合汇总（用 aoaToHtmlTable 统一风格）
  var summaryRows = [
    [i18n('cvVerifItem'), i18n('statusLabel')],
    [i18n('cvPrecision'), records.precision ? '✓ ' + esc(records.precision.time || i18n('alreadyRecorded')) + (records.precision.rsd != null ? ' | ' + i18n('cvRsdEqPctFmt').replace('{0}', esc(String(records.precision.rsd))) : '') : i18n('notFound')], /* v54.281 fix: totalRSD → rsd */
    [i18n('cvAccuracy'), records.recovery ? '✓ ' + esc(records.recovery.type || i18n('alreadyRecorded')) + (records.recovery.cMean != null ? i18n('tableAvgCell') + esc(String(records.recovery.cMean)) + '%' : '') : i18n('notFound')],
    [i18n('cvLinearity'), records.linear ? '✓ ' + i18n('cvR2') + ' = ' + esc(records.linear.r2 != null ? String(records.linear.r2) : '—') : i18n('notFound')], /* v54.277 fix: '✓ r² = ' 硬编码 → '✓ ' + i18n('cvR2') + ' = ' */
    [i18n('cvStability'), records.stability ? '✓ ' + esc(records.stability.time || i18n('alreadyRecorded')) : i18n('notFound')]
  ];
  html += '<h3 style="color:' + themePrimary + ';border-bottom:2px solid ' + themePrimary + i18n('cvHtmlSummaryH3');
  html += aoaToHtmlTable(summaryRows, {fontSize: 12});

  // 4 子报告（结构化表格 + 数据点扩展）
  if (records.precision) {
    html += '<h3 style="color:' + themePrimary + i18n('cvHtmlPrecisionDetail');
    var pRows = [[i18n('reportItem'),i18n('reportValue')],[i18n('csvHeaderType'), esc(records.precision.type || '—')],[i18n('csvHeaderTime'), esc(records.precision.time || '—')]];
    if (records.precision.data) pRows.push([i18n('reportData'), esc(records.precision.data)]);
    if (records.precision.mean != null) pRows.push([i18n('hMean'), esc(String(records.precision.mean))]);
    if (records.precision.sd != null) pRows.push([i18n('hSd'), esc(String(records.precision.sd))]);
    if (records.precision.rsd != null) pRows.push([i18n('hRsd') + ' (%)', esc(String(records.precision.rsd))]);
    if (records.precision.rsd != null) pRows.push([i18n('totalRsdPct'), esc(String(records.precision.rsd))]); /* v54.281 fix: totalRSD → rsd */
    html += aoaToHtmlTable(pRows, {fontSize: 11});
  }
  if (records.linear) {
    html += '<h3 style="color:' + themePrimary + i18n('cvHtmlLinearityDetail');
    var lRows = [[i18n('reportItem'),i18n('reportValue')],[i18n('csvHeaderType'), esc(records.linear.type || '—')],[i18n('csvHeaderTime'), esc(records.linear.time || '—')]];
    if (records.linear.a != null) lRows.push([i18n('cvSlopeA'), esc(String(records.linear.a))]);
    if (records.linear.b != null) lRows.push([i18n('cvInterceptB'), esc(String(records.linear.b))]);
    if (records.linear.r2 != null) lRows.push([i18n('cvR2'), esc(String(records.linear.r2))]); /* v54.276 fix: 'R²' 硬编码 → i18n; 'slopeIntercept' 同时用于 a/b 语义错误（都用同一 prefix） → 拆 cvSlopeA/cvInterceptB */
    html += aoaToHtmlTable(lRows, {fontSize: 11});
    if (records.linear.points && records.linear.points.length) {
      html += '<div style="font-size:11px;color:#666;margin-top:4px">' + i18n('cvDataPointCountFmt').replace('{0}', records.linear.points.length) + '</div>';
      var pRows2 = [[i18n('cvReportSeqNo'), i18n('cvReportConcentration'), i18n('cvReportResponse')]];
      records.linear.points.forEach(function(p, i) {
        pRows2.push([i+1, esc(String(p.x)), esc(String(p.y))]);
      });
      html += aoaToHtmlTable(pRows2, {fontSize: 10});
    }
  }
  if (records.recovery) {
    html += '<h3 style="color:' + themePrimary + i18n('cvHtmlAccuracyDetail');
    var rRows = [[i18n('reportItem'),i18n('reportValue')],[i18n('csvHeaderType'), esc(records.recovery.type || '—')],[i18n('csvHeaderTime'), esc(records.recovery.time || '—')]];
    if (records.recovery.cMean != null) rRows.push([i18n('avgRecoveryPct'), esc(String(records.recovery.cMean))]);
    if (records.recovery.cSd != null) rRows.push([i18n('hSd'), esc(String(records.recovery.cSd))]);
    if (records.recovery.cRsd != null) rRows.push([i18n('hRsd') + ' (%)', esc(String(records.recovery.cRsd))]);
    if (records.recovery.theory != null) rRows.push([i18n('cvTheoryContent'), esc(String(records.recovery.theory))]);
    html += aoaToHtmlTable(rRows, {fontSize: 11});
    if (records.recovery.recoveries && records.recovery.recoveries.length) {
      html += '<div style="font-size:11px;color:#666;margin-top:4px">' + i18n('cvAvgRecoverySamplesFmt') + records.recovery.recoveries.length + '):</div>';
      var recRows = [[i18n('cvReportSeqNo'), i18n('cvReportRecoveryPct')]];
      records.recovery.recoveries.forEach(function(v, i) {
        recRows.push([i+1, esc(String(v))]);
      });
      html += aoaToHtmlTable(recRows, {fontSize: 10});
    }
  }
  if (records.stability) {
    html += '<h3 style="color:' + themePrimary + i18n('cvHtmlStabilityDetail');
    var sRows = [[i18n('reportItem'),i18n('reportValue')],[i18n('csvHeaderType'), esc(records.stability.type || '—')],[i18n('csvHeaderTime'), esc(records.stability.time || '—')]];
    html += aoaToHtmlTable(sRows, {fontSize: 11});
    var stabRows = (records.stability.longterm || records.stability.accelerated || records.stability.intermediate || []);
    if (stabRows.length) {
      html += i18n('cvTimePointDataLabel') + stabRows.length + '):</div>';
      var sTab = [[i18n('cvTimePoint'),i18n('contentPct')]];
      stabRows.forEach(function(rw) {
        sTab.push([esc(String(rw.time || '—') + i18n('monthUnit')), esc(String(rw.value || '—'))]);
      });
      html += aoaToHtmlTable(sTab, {fontSize: 10});
    }
  }

  // 容器 + html2pdf
  const container = document.createElement('div');
  container.id = 'cv-export-container';
  container.style.cssText = 'padding:20px;font-family:"Microsoft YaHei",sans-serif;color:#333;background:#fff;width:190mm;';
  html = html.replace(/#2563eb/g, themePrimary).replace(/#16a34a/g, themeSuccess);
  container.innerHTML = html;
  // QR 码（综合报告验证）
  const qrDataUrl = await _generateReportQR(_reportQRText(meta));
  if (qrDataUrl) {
    const qrImg = document.createElement('img');
    qrImg.src = qrDataUrl;
    const qrPx = _getQRDisplaySize();
    qrImg.style.cssText = 'position:fixed;bottom:8mm;right:8mm;width:' + qrPx + 'px;height:' + qrPx + 'px;border:1px solid #ccc;padding:2px;background:#fff;z-index:1';
    qrImg.alt = i18n('cardTitleReportQr');
    container.style.position = 'relative';
    container.appendChild(qrImg);
  }
  document.body.appendChild(container);

  // v54.109 迁移到 _generatePDFReport 高级 helper
  var fname = i18n('cvReportFilename') + (meta.sampleName ? '_' + meta.sampleName.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + (meta.batch ? '_' + meta.batch.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + '_' + new Date().toISOString().slice(0,10) + '.pdf';
  return _generatePDFReport({
    container: container,
    filename: fname,
    pageNumbers: true,
    pageNumbersMeta: { operator: meta.operator },
    qrDataUrl: qrDataUrl,
    fallbackToPrint: true,
    onSuccess: function() { _i18nToast('toast_cvReportGeneratedFmt', 'success', 4000, fname); },
    onError: function(err) { console.error('CV Report failed:', err); alert(i18n('cvReportExportFail') + err.message); }
  });
}

// 渲染设置页面（v54.260 从 helpers-export-comprehensive.js 边界提取时恢复）
function renderSettingsPage() {
  try {
    var m = getReportMeta();
    function g(id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; }
    g('settings-sample-name', m.sampleName);
    g('settings-sample-id', m.sampleId);
    g('settings-batch', m.batch);
    g('settings-operator', m.operator);
    g('settings-instrument', m.instrument);
    g('settings-column', m.column);
    g('settings-tag-prefix', m.tagPrefix);
  } catch (e) {}
  renderSettingsStorageInfo();
  _renderQRSettingsActive();
}

function renderSettingsStorageInfo() {
  var div = document.getElementById('settings-storage-info');
  if (!div) return;
  var h = getH();
  var histSize = 0;
  try { histSize = (localStorage.getItem('rsd-calc-history') || '').length; } catch (e) {}
  var totalSize = histSize;
  var html = '<div class="fs-11">' + i18n('lblStorageOverviewFmt').replace('{0}', h.length).replace('{1}', Math.round(totalSize / 1024)) + '</div>'; /* v54.274 fix (i18n #4): Storage overview 硬编码英文 → i18n */
  div.innerHTML = html;
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('rsd-theme', theme); } catch (e) {}
  try { _invalidateCssVarCache(); } catch(_) {} /* v54.274 perf #5: 主题可能改 CSS 变量 → 失效 cache */
  renderSettingsPage();
  // v54.252 a11y: 主题切换反馈
  try { _announceSettings(theme === 'dark' ? i18n('btnThemeDark') : i18n('btnThemeLight')); } catch(_) {}
  // v54.290: 主题切换后重建 chart（让 scales grid/ticks 颜色适配 dark/light）
  // v54.310 fix: 之前调用 _renderTrendChart / _renderCurveChart（不存在），导致 theme 切换后 chart 不重建 → tooltip/scales 颜色保留旧值
  // v54.319 fix: drawCurveChart(null,0,0,0) 会销毁 instance → 用 calcCurve() 重新计算+绘制（正确流程）
  try { if(typeof drawTrendChart === 'function') drawTrendChart(); } catch(_) {}
  try {
    if (typeof calcCurve === 'function' && _curveChartInstance) {
      _curveChartArgsCache = null;  // 强制 cache miss
      calcCurve();  // 内部读 input 数据 + 算 a/b/r2 + drawCurveChart
    }
  } catch(_) {}
}

function setFontSize(size) {
  document.documentElement.setAttribute('data-font', size);
  try { localStorage.setItem('rsd-font-size', size); } catch (e) {}
  renderSettingsPage();
  // v54.252 a11y: 字号切换反馈
  try {
    var fKey = size === 'small' ? 'fontBtnSmall' : size === 'large' ? 'fontBtnLarge' : 'fontBtnMedium';
    _announceSettings(i18n(fKey));
  } catch(_) {}
}

// ==================== QR 码档位设置（3 档：小40/中60/大96） ====================
var QR_SIZE_MAP = { small: 40, medium: 60, large: 96 };
var QR_SIZE_DEFAULT = 'medium';

function _getQRDisplaySize() {
  try {
    var s = localStorage.getItem('rsd-qr-size');
    if (s && QR_SIZE_MAP[s] != null) return QR_SIZE_MAP[s];
  } catch (e) {}
  return QR_SIZE_MAP[QR_SIZE_DEFAULT];
}

function setQRSize(size) {
  if (size !== 'small' && size !== 'medium' && size !== 'large') return;
  try { localStorage.setItem('rsd-qr-size', size); } catch (e) {}
  _renderQRSettingsActive();
}

function _renderQRSettingsActive() {
  var cur;
  try { cur = localStorage.getItem('rsd-qr-size'); } catch (e) {}
  if (cur !== 'small' && cur !== 'medium' && cur !== 'large') cur = QR_SIZE_DEFAULT;
  var ids = { small: 'qr-small-btn', medium: 'qr-medium-btn', large: 'qr-large-btn' };
  for (var k in ids) {
    if (!Object.prototype.hasOwnProperty.call(ids, k)) continue;
    var b = document.getElementById(ids[k]);
    if (!b) continue;
    if (k === cur) b.classList.add('btn-primary');
    else b.classList.remove('btn-primary');
  }
}

// v54.269: 重量单位切换（mg ↔ g）—— 内部始终按 mg 持久化；只改 input 显示与 label
var WEIGHT_UNIT_DEFAULT = 'mg';
var _weightUnitCache = undefined; /* v54.274 perf #1: cache（之前每次调用都同步 localStorage.getItem，render 内层循环 N 次/键） */
function _getWeightUnit() {
  if (_weightUnitCache !== undefined) return _weightUnitCache;
  try { var u = localStorage.getItem('rsd-weight-unit');
    if (u === 'mg' || u === 'g') { _weightUnitCache = u; return u; } } catch(e){}
  _weightUnitCache = WEIGHT_UNIT_DEFAULT;
  return WEIGHT_UNIT_DEFAULT;
}
function _invalidateWeightUnitCache(){ _weightUnitCache = undefined; } /* v54.274: setWeightUnit / 跨 tab 同步时失效 */
function _weightUnitSuffix() {
  return _getWeightUnit() === 'g' ? i18n('unitSuffixG') : i18n('unitSuffixMg');
}
function _mgInput(idOrEl) {
  var el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
  if (!el) return 0;
  var raw = parseFloat(el.value);
  if (!isFinite(raw)) return el.value === '' ? '' : 0;
  return _getWeightUnit() === 'g' ? raw * 1000 : raw;
}
function _mgToWeightDisplay(mg) {
  if (mg === '' || mg == null) return '';
  var n = parseFloat(mg);
  if (!isFinite(n)) return '';
  return _getWeightUnit() === 'g' ? (n / 1000) : n;
}
function _mgFromString(s) {
  if (s === '' || s == null) return '';
  var n = parseFloat(s);
  if (!isFinite(n)) return '';
  return _getWeightUnit() === 'g' ? n * 1000 : n;
}
var _weightRawMg = new WeakMap();
function _applyWeightUnitToAllInputs() {
  var unit = _getWeightUnit();
  var sels = [
    '#std-weight', '#norm-std-weight', '#norm-spl-weight',
    '#ext-std-weight', '.ext-spl-weight',
    '#titer-ms', '[data-fi$="-w"]',
    '#spike-original', '.spike-added', '.spike-measured',
    'input[id^="dry-w"], input[id^="res-w"]'
  ].join(',');
  document.querySelectorAll(sels).forEach(function(el){
    if (!el || el.disabled || el.readOnly) return;
    var raw = el.value;
    var mg;
    /* v54.272 fix (correctness HIGH): stale-cache overwrote fresh typing. Fix: invalidate cache when user actively types
       (activeElement match + raw differs from current cache); otherwise reuse cache. Keeps v54.269 semantics:
       user typed 50mg → switch to g shows 0.05g → user keeps 0.05g → switch back to mg shows 50mg. */
    var _origHasCache = _weightRawMg.has(el);
    if (_origHasCache) {
      mg = _weightRawMg.get(el);
      var expectedFromCache = (unit === 'g') ? (mg/1000).toString() : String(mg);
      if (document.activeElement === el && parseFloat(raw) !== parseFloat(expectedFromCache)) {
        /* 用户改了 raw（无论新增还是修改），丢弃 cache 按新 raw 重算 mg */
        _weightRawMg.delete(el);
        mg = (raw === '' || raw == null) ? '' : (Number.isFinite(parseFloat(raw)) ? (unit === 'g' ? parseFloat(raw) * 1000 : parseFloat(raw)) : '');
      }
    } else {
      mg = (raw === '' || raw == null) ? '' : parseFloat(raw);
    }
    if (mg !== '' && Number.isFinite(mg)) _weightRawMg.set(el, mg);
    if (document.activeElement === el && raw !== '') {
      var expected = (mg === '' || !Number.isFinite(mg)) ? '' :
        (unit === 'g' ? (mg/1000).toString() : String(mg));
      if (parseFloat(raw) !== parseFloat(expected)) return;
    }
    if (mg === '' || !Number.isFinite(mg)) { el.value = ''; return; }
    el.value = (unit === 'g') ? (mg/1000) : mg;
  });
}
function setWeightUnit(u) {
  if (u !== 'mg' && u !== 'g') return;
  try { localStorage.setItem('rsd-weight-unit', u); } catch(e){}
  _weightUnitCache = u; /* v54.274 perf #1: 直接同步 cache（后续 _getWeightUnit 命中） */
  _renderWeightUnitActive();
  _applyWeightUnitToAllInputs();
  try { _extractChartDataCache = { sig: '', data: null }; } catch(_){}
  try { _dateCountsCache = null; } catch(_){}
  try { _historyCache = null; } catch(_){}
  try { _trendChartArgsCache = null; } catch(_){}
  try { _curveChartArgsCache = null; } catch(_){}
  try { if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; } } catch(_){}
  try { if (_curveChartInstance) { _curveChartInstance.destroy(); _curveChartInstance = null; } } catch(_){}
  if (typeof renderHistory === 'function') renderHistory();
  try { _announceSettings(i18n(u === 'g' ? 'btnWeightUnitG' : 'btnWeightUnitMg')); } catch(_){}
}
function _renderWeightUnitActive() {
  var cur = _getWeightUnit();
  var ids = { mg: 'wu-mg-btn', g: 'wu-g-btn' };
  for (var k in ids) {
    var b = document.getElementById(ids[k]);
    if (!b) continue;
    if (k === cur) b.classList.add('btn-primary'); else b.classList.remove('btn-primary');
  }
}

function initFontSize() {
  try {
    var saved = localStorage.getItem('rsd-font-size');
    if (saved === 'small' || saved === 'medium' || saved === 'large') {
      document.documentElement.setAttribute('data-font', saved);
    }
  } catch (e) {}
}

(function(){ if (typeof initFontSize === 'function') initFontSize(); })();

// v54.240 fix: 防御 DOM 元素 null（tab 未渲染 / iframe sandboxed 时 getElementById 返回 null）— 之前 6 个 input 直接 .value 抛错中断 beforeunload
function _getSafeValue(id) {
  try { var el = document.getElementById(id); return el ? el.value : ''; }
  catch (_) { return ''; }
}
window.addEventListener('beforeunload', () => {
  if (typeof _chartInstance !== 'undefined' && _chartInstance) { _chartInstance.destroy(); _chartInstance = null; }
  if (typeof _curveChartInstance !== 'undefined' && _curveChartInstance) { _curveChartInstance.destroy(); _curveChartInstance = null; }
  try {
    localStorage.setItem('rsd-calc-form', JSON.stringify({
      'std-area': _getSafeValue('std-area'),
      'std-weight': _getSafeValue('std-weight'),
      'std-purity': _getSafeValue('std-purity'),
      'std-dilution': _getSafeValue('std-dilution'),
      'std-moisture': _getSafeValue('std-moisture'),
      'std-residue': _getSafeValue('std-residue'),
    }));
  } catch (_) { /* localStorage 满/隐私模式 — 静默吞，避免 beforeunload 弹 alert */ }
});

// ==================== Header 精简：登录/主题/设置按钮 ====================
// v54.248 fix: 跟踪本会话是否已提示过 localStorage 失败 — 频繁静默 setItem throw 会刷屏，只 toast 第一次
var _saveJsonFailNotified = false;
function _loadJson(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e){ return def; } }
function _saveJson(key, val) {
 try { localStorage.setItem(key, JSON.stringify(val)); }
 catch(e){
   // v54.248 fix: 之前静默吞 — quota 满/隐私模式下用户元数据悄悄丢失。改为第一次失败时 toast 提示
   if (!_saveJsonFailNotified) {
     _saveJsonFailNotified = true;
     try { _i18nToast('toast_historySaveFail', 'error', 4000); } catch (_) {}
   }
 }
}

// 主题切换（封装 setTheme）
function toggleTheme() {
  const cur = localStorage.getItem('rsd-theme') || 'light';
  const next = cur === 'light' ? 'dark' : 'light';
  if (typeof setTheme === 'function') setTheme(next);
  _updateThemeBtnLabel();
}
function _updateThemeBtnLabel() {
  // v54.238 fix: 用 i18n 替代硬编码中文（与现有 btnThemeLight/Dark 一致）
  const label = document.getElementById('theme-btn-label');
  const cur = localStorage.getItem('rsd-theme') || 'light';
  if (label) label.textContent = cur === 'dark' ? i18n('btnThemeDark') : i18n('btnThemeLight');
}

// 登录状态管理（Item 1 阶段：localStorage 模拟；Item 2 阶段：接入 Supabase）
function _getLoginState() {
  try { return JSON.parse(localStorage.getItem('rsd-login-state') || 'null'); } catch(e) { return null; }
}
function _setLoginState(state) {
  if (state) _saveJson('rsd-login-state', state);
  else localStorage.removeItem('rsd-login-state');
  _updateLoginUI();
}
function _updateLoginUI() {
  const btn = document.getElementById('header-login-btn');
  const label = document.getElementById('login-btn-label');
  const state = _getLoginState();
  if (state && state.email) {
    if (btn) btn.setAttribute('data-logged-in', 'true');
    if (label) label.textContent = state.email.split('@')[0];
  } else {
    if (btn) btn.setAttribute('data-logged-in', 'false');
    if (label) label.textContent = i18n('loginLabel');
  }
}
function openLoginModal() {
  const state = _getLoginState();
  const ov = document.getElementById('login-overlay');
  const formEl = document.getElementById('login-form');
  const loggedEl = document.getElementById('login-logged-in');
  if (state && state.email) {
    if (formEl) formEl.style.display = 'none';
    if (loggedEl) loggedEl.style.display = 'block';
    const emailDisp = document.getElementById('login-email-display');
    if (emailDisp) emailDisp.textContent = state.email;
  } else {
    if (formEl) formEl.style.display = 'block';
    if (loggedEl) loggedEl.style.display = 'none';
  }
  if (ov) {
    // 复用：关闭时清理旧的 focus trap
    if (ov._focusTrapCleanup) ov._focusTrapCleanup();
    // v54.244 fix (Round 8 #28): 同步清理旧 keydown handler 后再开新 setTimeout
    // 之前清理在 setTimeout 内 → 两次快速点击 schedule 两个 setTimeout：旧 handlerA 先挂上
    // 第 2 个 setTimeout 内清理时引用丢失 → handlerA 累积（10 次打开 = 10 个 Escape listener）
    if (ov._loginKeyHandler) {
      ov.removeEventListener('keydown', ov._loginKeyHandler);
      ov._loginKeyHandler = null;
    }
    ov.style.display = 'flex';
    setTimeout(() => {
      const focusable = ov.querySelector('input, button');
      if (focusable) focusable.focus();
      // 简易 focus trap（不接 _openOverlayWithFocusTrap，因为 close 行为已绑定到按钮 onclick）
      const dialog = ov.querySelector('[role="dialog"]');
      const focusables = dialog ? dialog.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])') : [];
      const onKey = (e) => {
        if (e.key === 'Escape') { closeLoginModal(); }
        if (e.key === 'Tab' && focusables.length > 1) {
          const i = Array.from(focusables).indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus(); }
          else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
        }
      };
      // v54.244 防御：若同步 cleanup 后又有更新点击挂上 handler，直接跳过避免再次叠加
      if (ov._loginKeyHandler) return;
      ov.addEventListener('keydown', onKey);
      ov._loginKeyHandler = onKey;
    }, 50);
  }
}
function closeLoginModal() {
  const ov = document.getElementById('login-overlay');
  if (ov) {
    ov.style.display = 'none';
    if (ov._loginKeyHandler) { ov.removeEventListener('keydown', ov._loginKeyHandler); ov._loginKeyHandler = null; }
  }
}
function _setLoginStatus(msg, isErr) {
  const el = document.getElementById('login-status');
  if (el) { el.textContent = msg; el.style.color = isErr ? _cssVar('--danger') : 'var(--text-light)'; }
}
function _doLogin() {
  // v54.66 防御：login-email / login-password 缺失时 TypeError 被吞
  const emailEl = document.getElementById('login-email');
  const pwEl = document.getElementById('login-password');
  const email = (emailEl ? emailEl.value : '').trim();
  const password = pwEl ? pwEl.value : '';
  if (!email || !password) { _setLoginStatus(i18n('loginMissingCredentials'), true); return; }
  // Item 1 阶段：本地模拟登录（Item 2 将替换为 Supabase auth.signInWithPassword）
  if (typeof _supabaseSignIn === 'function') {
    // v54.229 fix: 加 .catch 让 Supabase 抛错时给用户友好提示，而不是红色全局 Promise Error toast
    _supabaseSignIn(email, password).then(ok => {
      if (ok) { _setLoginState({ email, ts: Date.now(), provider: 'supabase' }); _setLoginStatus(i18n('loginSuccess')); setTimeout(closeLoginModal, 600); }
      else _setLoginStatus(i18n('loginFailBadPwd'), true);
    }).catch(err => {
      _setLoginStatus(i18n('loginFailNetErrFmt').replace('{0}', err && err.message || ''), true);
    });
    return;
  }
  // 本地模拟：只要密码长度 ≥ 6 就认为成功（方便测试；Item 2 替换）
  if (password.length < 6) { _setLoginStatus(i18n('passwordMinLength'), true); return; }
  _setLoginState({ email, ts: Date.now(), provider: 'local-stub' });
  _setLoginStatus(i18n('loginSuccessLocal'));
  setTimeout(closeLoginModal, 600);
}
function _doRegister() {
  // v54.66 防御：login-email / login-password 缺失时 TypeError 被吞
  const emailEl = document.getElementById('login-email');
  const pwEl = document.getElementById('login-password');
  const email = (emailEl ? emailEl.value : '').trim();
  const password = pwEl ? pwEl.value : '';
  if (!email || !password) { _setLoginStatus(i18n('loginMissingCredentials'), true); return; }
  if (typeof _supabaseSignUp === 'function') {
    // v54.229 fix: 加 .catch（与 _supabaseSignIn 同款）
    _supabaseSignUp(email, password).then(ok => {
      if (ok) { _setLoginState({ email, ts: Date.now(), provider: 'supabase' }); _setLoginStatus(i18n('signupOkAutoLogin')); setTimeout(closeLoginModal, 600); }
      else _setLoginStatus(i18n('signupFail'), true);
    }).catch(err => {
      _setLoginStatus(i18n('signupFailNetErrFmt').replace('{0}', err && err.message || ''), true);
    });
    return;
  }
  if (password.length < 6) { _setLoginStatus(i18n('passwordMinLength'), true); return; }
  _setLoginState({ email, ts: Date.now(), provider: 'local-stub', registered: true });
  _setLoginStatus(i18n('signupLocalOk'));
  setTimeout(closeLoginModal, 600);
}
function _doLogout() {
  if (typeof _supabaseSignOut === 'function') _supabaseSignOut();
  _setLoginState(null);
  closeLoginModal();
}
// v54.182 初始化保护：每个初始化函数单独 try-catch，一个失败不影响其他
document.addEventListener('DOMContentLoaded', () => {
  // v54.219 持久化修复：页面初始化时从 localStorage 恢复用户偏好
  try {
    var savedLang = localStorage.getItem('rsd-lang');
    if (savedLang && typeof _setLang === 'function' && I18N[savedLang]) {
      _setLang(savedLang);
    }
  } catch(e) { console.error('[init] _setLang from localStorage', e); }
  try {
    var savedTheme = localStorage.getItem('rsd-theme');
    if (savedTheme && typeof setTheme === 'function') {
      setTheme(savedTheme);
    }
  } catch(e) { console.error('[init] setTheme from localStorage', e); }
  try { _updateLoginUI(); } catch(e) { console.error('[init] _updateLoginUI', e); }
  try { _updateThemeBtnLabel(); } catch(e) { console.error('[init] _updateThemeBtnLabel', e); }
  // v54.269: 重量单位 toggle 在 theme/lang 之后初始化（避免 auto-rescale 抢在用户编辑之前）
  try { if (typeof _applyWeightUnitToAllInputs === 'function') _applyWeightUnitToAllInputs(); if (typeof _renderWeightUnitActive === 'function') _renderWeightUnitActive(); } catch(e) { console.error('[init] weightUnit', e); }

  // v54.253 Fix #3 dev aid: 本地开发时汇总打印未解析的 data-i18n* key（非 localhost 直接 no-op）
  try { if (typeof _i18nDevScan === 'function') _i18nDevScan(); } catch(e) { /* dev only */ }
});

// ==================== Supabase 云同步 (Item 2) ====================
// 配置存 rsd-supabase-config localStorage；URL + Anon Key 都填才创建客户端
function _getSupabaseConfig() { return _loadJson('rsd-supabase-config', { url: '', key: '' }); }
function _saveSupabaseConfig() {
  const url = (document.getElementById('supabase-url-input')?.value || '').trim();
  const key = (document.getElementById('supabase-key-input')?.value || '').trim();
  _saveJson('rsd-supabase-config', { url, key });
  _supabaseClient = null; // 强制下次重新创建
  const status = document.getElementById('supabase-conn-status');
  if (status) { status.textContent = url && key ? i18n('supabaseSavedHint') : ''; status.style.color = 'var(--text-light)'; }
}
let _supabaseClient = null;
function _getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof supabase === 'undefined') return null;
  const cfg = _getSupabaseConfig();
  if (!cfg.url || !cfg.key) return null;
  try { _supabaseClient = supabase.createClient(cfg.url, cfg.key); return _supabaseClient; } catch (e) { console.error('[supabase] init', e); return null; }
}
async function _testSupabaseConnection() {
  const status = document.getElementById('supabase-conn-status');
  if (!status) return;
  status.textContent = i18n('supabaseTesting'); status.style.color = 'var(--text-light)';
  const client = _getSupabaseClient();
  if (!client) { status.textContent = i18n('supabaseUrlKeyMissing'); status.style.color = _cssVar('--danger'); return; }
  try {
    const { data, error } = await client.from('history_records').select('id', { count: 'exact', head: true });
    if (error) throw error;
    status.textContent = i18n('supabaseConnSuccess'); status.style.color = _cssVar('--success');
  } catch (e) {
    status.textContent = i18n('supabaseConnFailFmt').replace('{0}', e.message || i18n('notFound')); status.style.color = _cssVar('--danger');
  }
}
async function _supabaseSignIn(email, password) {
  const client = _getSupabaseClient();
  if (!client) { _setLoginStatus(i18n('supabaseSetupNeeded'), true); return false; }
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return true;
  } catch (e) { _setLoginStatus(i18n('loginFailPrefix') + (e.message || ''), true); console.error('[supabase signIn]', e); return false; }
}
async function _supabaseSignUp(email, password) {
  const client = _getSupabaseClient();
  if (!client) { _setLoginStatus(i18n('supabaseSetupNeeded'), true); return false; }
  try {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    if (data?.user && !data.session) { _setLoginStatus(i18n('signupEmailVerify'), false); return false; }
    return true;
  } catch (e) { _setLoginStatus(i18n('signupFailPrefix') + (e.message || ''), true); console.error('[supabase signUp]', e); return false; }
}
async function _supabaseSignOut() {
  const client = _getSupabaseClient();
  if (!client) return;
  try { await client.auth.signOut(); } catch (e) { console.error('[supabase signOut]', e); }
}

// 上传单条历史记录到 history_records
async function _pushHistoryRecord(rec) {
  const client = _getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('history_records').insert({
      type: rec.type || '',
      record_time: rec.time || new Date().toISOString(),
      project: rec.project || '',
      data: rec,
    });
    if (error) throw error;
    return true;
  } catch (e) { console.error('[pushHistory]', e); return false; }
}

// 上传用户设置到 user_settings
async function _pushUserSettings() {
  const client = _getSupabaseClient();
  if (!client) return false;
  try {
    const payload = {
      theme: localStorage.getItem('rsd-theme') || 'light',
      show_guides: true,
      hidden_guides: {},
      recent_reagents: [],
      form_data: _loadJson('rsd-calc-form', {}),
      templates: _loadJson('rsd-templates', {}),
    };
    const { error } = await client.from('user_settings').upsert(payload);
    if (error) throw error;
    return true;
  } catch (e) { console.error('[pushSettings]', e); return false; }
}

// 真实 syncAll：未登录/未配置 → 走本地 stub；已登录 → 推历史 + 设置到云
async function syncAllReal() {
  if (typeof _isPoorConnection === 'function' && _isPoorConnection()) {
    const q = _getConnQuality();
    const proceed = await new Promise(resolve => {
      if (typeof _confirmDialog === 'function') {
        // v54.237 fix: 用 i18n 替代硬编码中文章节
        _confirmDialog(
          i18n('networkWeakFullFmt')
            .replace('{0}', q.type)
            .replace('{1}', q.rtt),
          { okText: i18n('btnContinue'), cancelText: i18n('btnCancel') }
        ).then(resolve);
      } else {
        // v54.246 P5 fix: 之前硬编码中文尾部，en 模式下仍是中文。现已 i18n 化为 confirmNetworkWeakFmt
        var _nwFmt = i18n('confirmNetworkWeakFmt');
        resolve(window.confirm(_nwFmt.replace('{0}', q.type).replace('{1}', q.rtt)));
      }
    });
    if (!proceed) { _setSyncStatus(i18n('syncWeakCancel')); return; }
  }
  const client = _getSupabaseClient();
  const state = _getLoginState();
  _setSyncStatus(i18n('syncing'));
  try {
    if (!client || !state) { _setSyncStatus(i18n('syncSkipNoLogin')); return; }
    const hist = (typeof getH === 'function' ? getH() : _loadJson('rsd-calc-history', []));
    let okCount = 0;
    for (const rec of hist) { if (await _pushHistoryRecord(rec)) okCount++; }
    const settingsOk = await _pushUserSettings();
    _setSyncStatus(i18n('syncOkFmt').replace('{0}', okCount).replace('{1}', settingsOk ? i18n('syncOkWithSettings') : ''));
  } catch (e) {
    _setSyncStatus(i18n('syncFailed'));
    // v54.242 fix: 同步失败加 toast 提示（用户看不到 status 文本位置）
    if(typeof _i18nToast === 'function') _i18nToast('syncFailed', 'error', 4000);
    console.error('[syncAllReal]', e);
  }
}
// 替换原 syncAll（之前的占位实现）— 但保留原函数以兼容 rsd-verify 字面量
const _syncAllPlaceholder = syncAll;
syncAll = async function() {
  await syncAllReal();
};

// 监听 Supabase 登录态变化 → 触发迁移弹窗
function _setupSupabaseAuthListener() {
  const client = _getSupabaseClient();
  if (!client) return;
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      _setLoginState({ email: session.user.email, ts: Date.now(), provider: 'supabase' });
      _maybeShowMigration();
    } else if (event === 'SIGNED_OUT') {
      _setLoginState(null);
    }
  });
}
document.addEventListener('DOMContentLoaded', () => {
  // 启动时尝试从 Supabase 恢复会话
  try {
  (async () => {
    const client = _getSupabaseClient();
    if (!client) return;
    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.user) {
        _setLoginState({ email: data.session.user.email, ts: Date.now(), provider: 'supabase' });
      }
      _setupSupabaseAuthListener();
    } catch (e) { console.error('[supabase getSession]', e); }
  })();
  } catch(e) { console.error('[supabase outer]', e); }
});

// 扩展 renderSettingsPage：填充 Supabase URL/Key 输入
(function _extendRenderSettingsPageForSupabase() {
  const _orig = renderSettingsPage;
  renderSettingsPage = function() {
    try { _orig(); } catch (e) {}
    const cfg = _getSupabaseConfig();
    const u = document.getElementById('supabase-url-input'); if (u && !u.value) u.value = cfg.url || '';
    const k = document.getElementById('supabase-key-input'); if (k && !k.value) k.value = cfg.key || '';
  };
})();

// ==================== 完整设置页：备份/恢复/导出/滴定默认值/恢复出厂/定期备份提醒 ====================
// _loadJson / _saveJson 已在 Header 精简块定义

// 11 个 rsd- 前缀键清单（备份时一并打包）
const RSD_BACKUP_KEYS = [
  'rsd-calc-history', 'rsd-report-meta', 'rsd-titer-defaults',
  'rsd-templates', 'rsd-titer-drafts', 'rsd-theme', 'rsd-font-size', 'rsd-weight-unit',
  'rsd-backup-interval', 'rsd-last-backup', 'rsd-migration-shown',
  'rsd-calc-form'
];

// 备份全部 → JSON 下载
function backupAll() {
  try {
    const payload = { _app: 'rsd-calculator', _version: 1, _ts: Date.now(), data: {} };
    let count = 0;
    RSD_BACKUP_KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v != null) { payload.data[k] = v; count++; }
    });
    // 兜底：额外扫描所有 rsd- 前缀键（防止漏网）
    Object.keys(localStorage).filter(k => k.startsWith('rsd-')).forEach(k => {
      if (!(k in payload.data)) { payload.data[k] = localStorage.getItem(k); count++; }
    });
    const fname = `rsd-backup-${new Date().toISOString().slice(0,10)}.json`;
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fname || 'export.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch(e) {
    _i18nAlert('backupFail');
    console.error('[backupAll]', e);
  }
}

// 恢复：从 JSON 还原
async function restoreBackup(evt) {
  // v54.31 防御：evt 可能是 undefined/null（编程调用时）
  if (!evt || !evt.target) { _i18nAlert('invalidEvent'); return; }
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;
  // v54.237 fix: 用 i18n 替代硬编码中文
  if (!await _confirmDialog(i18n('restoreBackupConfirm'), { danger: true })) { evt.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const payload = JSON.parse(e.target.result);
      if (!payload || !payload.data) throw new Error('JSON 缺少 data 字段');
      // v54.230 fix: snapshot 所有 rsd-* key → 写盘失败时回滚，否则部分写入后 quota 满会让用户静默丢失旧数据
      const prefix = 'rsd-';
      const targetKeys = Object.keys(payload.data).filter(k => k.startsWith(prefix));
      const oldSnap = {};
      try {
        const allKeys = Object.keys(localStorage);
        for (let i = 0; i < allKeys.length; i++) {
          const k = allKeys[i];
          if (k.startsWith(prefix)) oldSnap[k] = localStorage.getItem(k);
        }
      } catch (_) {}
      const written = [];
      const skipped = [];
      try {
        for (let i = 0; i < targetKeys.length; i++) {
          const k = targetKeys[i];
          // v54.232 fix (Round 4 B.B2): 校验 value 必须是 string，否则 setItem 会把对象强转 "[object Object]"
          // → 下次 getH() parse 失败 → 整个 rsd-calc-history 丢失。改为拒绝非字符串值并继续。
          if (typeof payload.data[k] !== 'string') { skipped.push(k); continue; }
          localStorage.setItem(k, payload.data[k]);
          // v54.234: 失效 history 缓存（跨 key 写入不知情，让下次 getH 重新 parse）
          if (k === HK) { _historyCache = null; _extractChartDataCache = { sig: '', data: null }; }  // v54.249: 同时失效 chart data 缓存
          written.push(k);
        }
      } catch (err) {
        // 回滚已写入的 keys
        for (let i = 0; i < written.length; i++) {
          const k = written[i];
          try { if (oldSnap[k] === undefined) localStorage.removeItem(k); else localStorage.setItem(k, oldSnap[k]); } catch (_) {}
        }
        _setSyncStatus(i18n('restoreFailRolledback'));
        // v54.248 fix: flashEl debug-tag 也吐一条错误提示，避免用户只看到 alert/sync 状态时错过反馈
        try { if (typeof flashEl === 'function') flashEl('debug-tag', i18n('restoreFailRolledback')); } catch (_) {}
        // v54.239 fix: 硬编码中文 alert → i18n
        alert(i18n('restoreFailRollbackAlertFmt').replace('{0}', err.message));
        return;
      }
      if (skipped.length) {
        try { _setSyncStatus(i18n('restoreSkipNonStringFmt').replace('{0}', skipped.length)); } catch (_) {}
      }
      _setSyncStatus(i18n('uiSyncRestored') + targetKeys.length + i18n('uiItems'));
      // v54.231 撤销窗口 (C#9)：成功恢复后保存 oldSnap 到 rsd-last-restore-undo，
      // 10 秒内可点击 toast "撤销" 回到恢复前状态
      try {
        localStorage.setItem('rsd-last-restore-undo', JSON.stringify({
          time: Date.now(),
          oldSnap: oldSnap,
          restoredKeys: targetKeys.slice(),
        }));
        _showRestoreUndoToast(targetKeys.length);
      } catch (_) {}
      if (typeof renderSettingsPage === 'function') renderSettingsPage();
      _i18nAlert('restoreOk');
    } catch (err) {
      _setSyncStatus(i18n('restoreFail'));
      // v54.239 fix: 硬编码中文 alert → i18n
      alert(i18n('restoreFailAlertFmt').replace('{0}', err.message));
    }
  };
  reader.readAsText(file);
  evt.target.value = '';
}

// 导出 Excel（合并所有历史）
function exportExcelAll() {
  try {
    if (typeof XLSX === 'undefined') { _i18nAlert('xlsxNotLoaded'); return; }
    const histRaw = getH ? getH() : _loadJson('rsd-calc-history', []);
    // v54.41 防御：非数组 + 过滤 null/非对象 entry（json_to_sheet 遇 null 会抛错，
    // 导致一条坏数据让整个 Excel 导出失败）
    const hist = (Array.isArray(histRaw) ? histRaw : []).filter(h => h && typeof h === 'object');
    if (!hist.length) { _i18nAlert('noHistory'); return; }
    const ws = XLSX.utils.json_to_sheet(hist);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, i18n('cvHistoryTab'));
    const fname = `rsd-history-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fname);
    _setSyncStatus(i18n('exportExcelDone'));
  } catch(e) { _setSyncStatus(i18n('exportExcelFail')); alert(e.message); }
}

// 导出 Word（HTML 套 .doc 后缀，Word 可直接打开）
function exportWordAll() {
  try {
    const histRaw = getH ? getH() : _loadJson('rsd-calc-history', []);
    // v54.41 防御：非数组 / 空数组
    const hist = Array.isArray(histRaw) ? histRaw : [];
    if (!hist.length) { _i18nAlert('noHistory'); return; }
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + i18n('historyReportTitle') + '</title></head><body>';
    html += i18n('cvHistoryReportTitle');
    html += '<p>' + i18n('exportTimePrefixFmt').replace('{0}', _formatNow()) + '</p>';
    // v54.82 报告元数据增强：Word 导出也展示 _meta（v54.78 引入的每条 entry meta 快照）
    html += '<table border="1" cellpadding="4" style="border-collapse:collapse"><tr><th scope="col" data-i18n="csvHeaderType">类型</th><th scope="col" data-i18n="csvHeaderTime">时间</th><th scope="col" data-i18n="lblSampleIdBatch">样品/批号</th><th scope="col" data-i18n="lblOperatorInstrument">检测员/仪器</th><th scope="col" data-i18n="lblData">数据</th><th scope="col" data-i18n="thResult">结果</th></tr>';
    hist.forEach(h => {
      // v54.41 防御：单条 null/非对象 entry 曾让整个导出失败（blob=0），现在跳过
      if (!h || typeof h !== 'object') return;
      // v54.82：从 _meta 抽取核心 meta 字段；缺失则显示空
      const _m = h._meta || {};
      const _meta1 = (_m.sampleName ? _esc(_m.sampleName) : '') + (_m.sampleId ? ' / ' + _esc(_m.sampleId) : '') + (_m.batch ? i18n('batchDot') + _esc(_m.batch) : '');
      const _meta2 = (_m.operator ? _esc(_m.operator) : '') + (_m.instrument ? ' / ' + _esc(_m.instrument) : '') + (_m.date ? ' · ' + _esc(_m.date) : '');
      // v54.41 XSS/HTML 注入防护：h.type/h.time/h.data 是用户数据，未转义会被 Word 当标签渲染
      html += '<tr><td>' + _esc(i18n(_typeI18n(h.type))) + '</td><td>' + _esc(h.time) + '</td><td>' + _meta1 + '</td><td>' + _meta2 + '</td><td>' + _esc(h.data) + '</td><td>' + _esc(JSON.stringify({mean:h.mean,sd:h.sd,rsd:h.rsd})) + '</td></tr>'; /* v54.283 i18n: e.type 通过 i18n 映射 */
    });
    html += '</table></body></html>';
    const blob = new Blob(['﻿' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rsd-history-${new Date().toISOString().slice(0,10)}.doc`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    _setSyncStatus(i18n('exportWordDone'));
  } catch(e) { _setSyncStatus(i18n('exportWordFail')); alert(e.message); }
}

// 导出 PDF（使用 html2pdf）
function exportPDFAll() {
  try {
    if (typeof html2pdf === 'undefined') { _i18nAlert('html2pdfNotLoaded'); return; }
    const histRaw = getH ? getH() : _loadJson('rsd-calc-history', []);
    // v54.41 防御：非数组 / 空数组
    const hist = Array.isArray(histRaw) ? histRaw : [];
    if (!hist.length) { _i18nAlert('noHistory'); return; }
    const container = document.createElement('div');
    container.style.padding = '20px'; container.style.fontFamily = 'sans-serif';
    // v54.41 XSS 修复：container 会 appendChild 到 document.body，未转义的 h.data
    // 会在真实页面执行（实证 <img onerror> 已触发）。全字段 _esc() + null entry 跳过。
    // v54.83 报告元数据补全：表格 3 列 → 5 列（加 样品/批号 + 检测员/仪器），复用 v54.82 exportWordAll 模式
    container.innerHTML = '<h1 data-i18n="historyReportTitle"></h1><p>' + i18n('exportTimePrefixFmt').replace('{0}', _formatNow()) + '</p><table border="1" cellpadding="4" style="border-collapse:collapse"><tr><th scope="col" data-i18n="csvHeaderType">类型</th><th scope="col" data-i18n="csvHeaderTime">时间</th><th scope="col" data-i18n="lblSampleIdBatch">样品/批号</th><th scope="col" data-i18n="lblOperatorInstrument">检测员/仪器</th><th scope="col" data-i18n="lblData">数据</th></tr>' +
      hist.map(h => {
        if (!h || typeof h !== 'object') return '';
        const _m = h._meta || {};
        const _meta1 = (_m.sampleName ? _esc(_m.sampleName) : '') + (_m.sampleId ? ' / ' + _esc(_m.sampleId) : '') + (_m.batch ? i18n('batchDot') + _esc(_m.batch) : '');
        const _meta2 = (_m.operator ? _esc(_m.operator) : '') + (_m.instrument ? ' / ' + _esc(_m.instrument) : '') + (_m.date ? ' · ' + _esc(_m.date) : '');
        return '<tr><td>' + _esc(i18n(_typeI18n(h.type))) + '</td><td>' + _esc(h.time) + '</td><td>' + _meta1 + '</td><td>' + _meta2 + '</td><td>' + _esc(h.data) + '</td></tr>'; /* v54.283 i18n: e.type 通过 i18n 映射 */
      }).join('') + '</table>';
    document.body.appendChild(container);
    const fname = `rsd-history-${new Date().toISOString().slice(0,10)}.pdf`;
    // v54.111 迁移到 _generatePDFReport 简化模式（无 pageNumbers/无 qrDataUrl/无 onSuccess）
    _generatePDFReport({
      container: container,
      filename: fname,
      onSuccess: function() { _setSyncStatus(i18n('exportPDFDone')); },
      onError: function(err) { _setSyncStatus(i18n('pdfExportFail')); alert(err.message); }
    });
  } catch(e) { _setSyncStatus(i18n('pdfExportFail')); alert(e.message); }
}

// v54.98 通用 PDF 导出 helper（DRY：消除 3 处 export*PDF 的 html2pdf().set().from().save() + appendChild/removeChild 重复模式）
// v54.101 升级：支持 pageNumbers（每页加页码水印）+ qrDataUrl（自动加 QR 码图片到 container）
// 用法：
//   简化：_generatePDFReport({ container, filename, onSuccess, onError })
//   高级：_generatePDFReport({ container, filename, pageNumbers: true, pageNumbersMeta: {operator}, qrDataUrl: dataUrl, fallbackToPrint: true })
function _generatePDFReport(opts) {
  if (typeof html2pdf === 'undefined') throw new Error('html2pdf not loaded');
  opts = opts || {};
  if (!opts.container) throw new Error('container required');
  // v54.101 QR 码自动添加
  if (opts.qrDataUrl) {
    var qrImg = document.createElement('img');
    qrImg.src = opts.qrDataUrl;
    var qrPx = (typeof _getQRDisplaySize === 'function') ? _getQRDisplaySize() : 80;
    qrImg.style.cssText = opts.qrStyle || ('position:fixed;bottom:8mm;right:8mm;width:' + qrPx + 'px;height:' + qrPx + 'px;border:1px solid #ccc;padding:2px;background:#fff;z-index:1');
    qrImg.alt = i18n('cardTitleReportQr');
    opts.container.style.position = 'relative';
    opts.container.appendChild(qrImg);
  }
  document.body.appendChild(opts.container);
  var setOpts = {
    margin: opts.margin != null ? opts.margin : (opts.pageNumbers ? [10, 10, 16, 10] : 10),
    filename: opts.filename || ('rsd-' + new Date().toISOString().slice(0, 10) + '.pdf'),
    image: (typeof _weakNetImageOpts === 'function') ? _weakNetImageOpts(opts.image || { type: 'jpeg', quality: 0.98 }) : (opts.image || {}),
    html2canvas: (typeof _weakNetHtml2CanvasOpts === 'function') ? _weakNetHtml2CanvasOpts(opts.html2canvas || { scale: 2, useCORS: true, letterRendering: true }) : (opts.html2canvas || { scale: 2 }),
    jsPDF: opts.jsPDF || { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: opts.pagebreak || { mode: ['avoid-all', 'css', 'legacy'] }
  };
  // v54.101 高级模式：链式 + 加水印
  if (opts.pageNumbers) {
    return html2pdf().set(setOpts).from(opts.container).toContainer().toCanvas().toPdf().get('pdf').then(function(pdf) {
      var totalPages = pdf.internal.getNumberOfPages();
      for (var i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        var _wc = (typeof _cssVar === 'function' ? _cssVar('--text-light') : null) || '#999';
        var _wcRgb = _wc.match(/^#([0-9a-fA-F]{6})$/);
        if (_wcRgb) {
          var _n = parseInt(_wcRgb[1], 16);
          pdf.setTextColor((_n >> 16) & 0xff, (_n >> 8) & 0xff, _n & 0xff);
        } else {
          pdf.setTextColor(150);
        }
        pdf.text(i18n('cvPageNumFmt').replace('{0}', i).replace('{1}', totalPages), 105, 292, { align: 'center' }); /* v54.274 fix (i18n #2): '第 ' 硬编码 → cvPageNumFmt 模板（en 之前显示 "第 1 / 5 Page"）*/
        pdf.text(i18n('pdfExportDatePrefix') + _formatNow(), 20, 292, { align: 'left' });
        if (opts.pageNumbersMeta && opts.pageNumbersMeta.operator) pdf.text(opts.pageNumbersMeta.operator, 190, 292, { align: 'right' });
      }
      pdf.save(setOpts.filename);
      if (opts.container.parentNode) document.body.removeChild(opts.container);
      if (typeof opts.onSuccess === 'function') opts.onSuccess();
    }).catch(function(err) {
      if (opts.container.parentNode) document.body.removeChild(opts.container);
      if (typeof opts.onError === 'function') opts.onError(err);
      else if (opts.fallbackToPrint !== false) { try { _setPrintActive(); window.print(); } catch (e) {} }
      else throw err;
    });
  }
  // 简化模式（v54.98 原始）
  return html2pdf().set({ margin: setOpts.margin, filename: setOpts.filename, html2canvas: setOpts.html2canvas, jsPDF: setOpts.jsPDF }).from(opts.container).save().then(function() {
    if (opts.container.parentNode) document.body.removeChild(opts.container);
    if (typeof opts.onSuccess === 'function') opts.onSuccess();
  }).catch(function(err) {
    if (opts.container.parentNode) document.body.removeChild(opts.container);
    if (typeof opts.onError === 'function') opts.onError(err);
    else throw err;
  });
}

// v54.100 i18n dict + helper（i18n 第一阶段：高频按钮 label 字典化）

function _applyI18n() {
  if (!document.body) return;
  // v54.253 Fix #3: 仅在 localhost + 首次执行时收集（其它情况 _devBag 为 null，下面每次都是 null 判断）
  var _devBag = (!_i18nDevScanned && typeof Set !== 'undefined' && typeof window !== 'undefined'
    && window.location && window.location.hostname === 'localhost') ? new Set() : null;
  // TreeWalker 单次遍历 DOM，每个 element 检查 attributes 中是否有 data-i18n* 前缀
  // 比 querySelectorAll('[data-i18n],[data-i18n-...],...') 少一次 selector 解析 + 不返回全部匹配数组
  var walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    function(n) {
      if (!n.attributes) return NodeFilter.FILTER_SKIP;
      var attrs = n.attributes;
      for (var i = 0; i < attrs.length; i++) {
        if (attrs[i].name.indexOf('data-i18n') === 0) return NodeFilter.FILTER_ACCEPT;
      }
      return NodeFilter.FILTER_SKIP;
    }
  );
  var el;
  while ((el = walker.nextNode())) {
    // data-i18n（优先，因为可能含嵌套 form control）
    var key = el.getAttribute('data-i18n');
    if (key) {
      var keyVal = i18n(key);
      if (_devBag && keyVal === key) _devBag.add('data-i18n="' + key + '"');
      // v54.231 fix (B#4 regression): 若 el 含嵌套 form control，el.textContent = 会清掉 input
      var hasFormControl = el.querySelector('input, select, textarea');
      if (hasFormControl) {
        for (var ci = 0; ci < el.childNodes.length; ci++) {
          var child = el.childNodes[ci];
          if (child.nodeType === 3 && child.textContent.trim()) {
            child.textContent = keyVal + ' ';
            break;
          }
        }
      } else {
        el.textContent = keyVal;
      }
    }
    // data-i18n-placeholder
    var phKey = el.getAttribute('data-i18n-placeholder');
    if (phKey) {
      var phVal = i18n(phKey);
      if (_devBag && phVal === phKey) _devBag.add('data-i18n-placeholder="' + phKey + '"');
      el.placeholder = phVal;
    }
    // data-i18n-title
    var ttKey = el.getAttribute('data-i18n-title');
    if (ttKey) {
      var ttVal = i18n(ttKey);
      if (_devBag && ttVal === ttKey) _devBag.add('data-i18n-title="' + ttKey + '"');
      el.title = ttVal;
    }
    // data-i18n-value
    var vlKey = el.getAttribute('data-i18n-value');
    if (vlKey) {
      var vlVal = i18n(vlKey);
      if (_devBag && vlVal === vlKey) _devBag.add('data-i18n-value="' + vlKey + '"');
      el.value = vlVal;
    }
    // data-i18n-aria-label
    var alKey = el.getAttribute('data-i18n-aria-label');
    if (alKey) {
      var alVal = i18n(alKey);
      if (_devBag && alVal === alKey) _devBag.add('data-i18n-aria-label="' + alKey + '"');
      el.setAttribute('aria-label', alVal);
    }
    // data-i18n-tooltip（CSS hover ::after content: attr(data-tooltip) 用，区别于 title 属性）
    var tpKey = el.getAttribute('data-i18n-tooltip');
    if (tpKey) {
      var tpVal = i18n(tpKey);
      if (_devBag && tpVal === tpKey) _devBag.add('data-i18n-tooltip="' + tpKey + '"');
      el.setAttribute('data-tooltip', tpVal);
    }
  }
  // v54.253 Fix #3: 汇总打印（仅在 localhost 首次执行时 _devBag 非 null）
  if (_devBag) { _i18nDevScanned = true; _logUnresolvedI18nKeys(_devBag); }
}
/**
 * 切换界面语言并全量刷新：写 localStorage、重建 Chart.js 实例、失效 i18n 相关缓存后调用 _applyI18n()。
 * @param {string} lang 目标语言（'zh' | 'en'）；I18N 中不存在该语言时直接返回，不做任何改动
 * @return {void}
 */
function _setLang(lang) {
  if (!I18N[lang]) return;
  _currentLang = lang;
  // v54.281 perf (HIGH): 切换语言时清 i18n per-key cache（旧 lang 的 result 不应再返回）
  try { if (typeof _i18nCache !== 'undefined' && _i18nCache && _i18nCache.clear) _i18nCache.clear(); } catch(_) {}
  // Round 24 a11y: 同步 html[lang] 属性让 screen reader 正确切换发音（之前硬编码 zh-CN）
  try { document.documentElement.lang = (lang === 'en' ? 'en' : 'zh-CN'); } catch(_) {}
  // v54.267 a11y: 同步浏览器标签页标题（en 模式不再显示中文）
  try { document.title = i18n('appTitle'); } catch(_) {}
  // v54.162 CSS 伪元素 i18n：设置 :root CSS 变量
  try {
    var root = document.documentElement;
    if (typeof root.style.setProperty === 'function') {
      root.style.setProperty('--status-online', i18n('statusOnline') ? "'" + i18n('statusOnline') + "'" : "'\f0d8 Online '");
      root.style.setProperty('--status-offline', i18n('statusOffline') ? "'" + i18n('statusOffline') + "'" : "'\f0d8 Offline '");
    }
  } catch(e) { /* silent */ }
  try { localStorage.setItem('rsd-lang', lang); } catch(e) {}
  // v54.252 P8 fix: 语言切换后失效 chart 签名缓存（_trendChartArgsCache/_curveChartArgsCache）
  // 否则下次 drawTrendChart 命中签名只 resize，导致 chart 内的 i18n 字符串（_trendSuffixLabel、chartLegendTotalFmt、cvFilter）保持旧语言
  try { _trendChartArgsCache = null; } catch(e) {}
  try { _curveChartArgsCache = null; } catch(e) {}
  // 同时强制重建 chart 实例（Chart.js 实例本身缓存了 options/labels，不会自动反映 i18n 变化）
  try { if (_chartInstance) { _chartInstance.destroy(); _chartInstance = null; } } catch(e) {}
  try { if (_curveChartInstance) { _curveChartInstance.destroy(); _curveChartInstance = null; } } catch(e) {}
  // v54.252 P8 fix: 失效 _dateCountsCache（内含 i18n('otherGroup') fallback 标签）
  try { _dateCountsCache = null; } catch(e) {}
  // v54.253 fix (Round final #2): 失效 _extractChartDataCache
  // 该缓存按 history.length+history[0] 签名键化，签名不含语言；但缓存 data 内的 label 字段是 i18n 绑定
  // 的（i18n('labelMeanShort')/i18n('labelAvgContent') 等）。语言切换后签名不变 → 命中旧缓存 → 图表
  // 分组标签语言不一致。chart 实例重建不够，必须清 data 缓存本身。
  try { _extractChartDataCache = { sig: '', data: null }; } catch(e) {}
  _applyI18n();
  // v54.252 a11y: 语言切换反馈
  try {
    var langKey = lang === 'en' ? 'btnLangEn' : 'btnLangZh';
    _announceSettings(i18n(langKey));
  } catch(_) {}
}

// v54.112 i18n alert helper（统一包装 alert(i18n(key))，零成本 i18n 化 alert 调用）
function _i18nAlert(key) {
  if (typeof i18n === 'function' && I18N.zh && I18N.zh[key]) {
    return alert(i18n(key));
  }
  return alert(key);
}

// v54.115 i18n toast helper（统一包装 toast(i18n(key) + 占位符替换)）
// v54.231 撤销最近一次 restoreBackup（C#9）
// 在 10 秒内点击 toast "撤销" 按钮 → 把所有 rsd-* key 回滚到恢复前的值
function _showRestoreUndoToast(restoredCount) {
  const container = _getToastContainer();
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'toast toast-success';
  div.style.cssText = 'display:flex;align-items:center;gap:8px';
  // 安全：restoredCount 是 number（来自 Object.keys.length），无需转义
  const msg = document.createElement('span');
  msg.textContent = i18n('restoreSuccessFmt').replace('{0}', restoredCount);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = i18n('btnUndo');
  btn.className = 'btn btn-xs';
  btn.style.cssText = 'padding:2px 8px;font-size:11px;background:#fff;border:1px solid currentColor;border-radius:4px;cursor:pointer';
  let undone = false;
  const cleanup = () => {
    if (undone) return;
    undone = true;
    clearTimeout(timer);
    if (div.parentNode) div.parentNode.removeChild(div);
    try { localStorage.removeItem('rsd-last-restore-undo'); } catch (_) {}
  };
  // a11y: <button> 原生已支持 Enter/Space，再兜底一次防 i18n 误改 type
  btn.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); btn.click(); }
  });
  btn.onclick = () => { _undoLastRestore(); cleanup(); };
  div.appendChild(msg);
  div.appendChild(btn);
  container.appendChild(div);
  const timer = setTimeout(cleanup, 10000);
}

function _undoLastRestore() {
  let payload;
  try {
    const raw = localStorage.getItem('rsd-last-restore-undo');
    if (!raw) { _i18nAlert('undoExpired'); return; }
    payload = JSON.parse(raw);
  } catch (_) { _i18nAlert('undoExpired'); return; }
  if (!payload || !payload.oldSnap) { _i18nAlert('undoExpired'); return; }
  // 检查 10 秒窗口（防止旧 undo 数据被误用）
  if (Date.now() - payload.time > 15000) {
    try { localStorage.removeItem('rsd-last-restore-undo'); } catch (_) {}
    _i18nAlert('undoExpired');
    return;
  }
  try {
    const oldSnap = payload.oldSnap;
    Object.keys(oldSnap).forEach(k => {
      try {
        if (oldSnap[k] === undefined) localStorage.removeItem(k);
        else localStorage.setItem(k, oldSnap[k]);
      } catch (_) {}
    });
    try { localStorage.removeItem('rsd-last-restore-undo'); } catch (_) {}
    _setSyncStatus(i18n('restoreUndone'));
    _i18nToast('toast_restoreUndone', 'success', 3000);
    // 重新加载 history / settings 反映新状态
    if (typeof updCount === 'function') updCount();
    if (typeof renderHistory === 'function') renderHistory();
    if (typeof renderSettingsPage === 'function') renderSettingsPage();
  } catch (err) {
    // v54.239 fix: 硬编码中文 alert → i18n
    alert(i18n('undoFailAlertFmt').replace('{0}', err.message));
  }
}

// v54.231 factoryReset 撤销 toast (C#9)：在 setTimeout 5 秒窗口内点击"撤销"取消 reload
// 把 oldSnap 写回 localStorage，并阻止 caller 的 reload
function _showFactoryResetUndoToast(oldSnap, ms) {
  // 把 oldSnap 暂存到 localStorage（防止 reload 取消时丢失）
  try { localStorage.setItem('rsd-last-factoryreset-undo', JSON.stringify({ time: Date.now(), oldSnap: oldSnap })); } catch (_) {}
  const container = _getToastContainer();
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'toast toast-warning';
  div.style.cssText = 'display:flex;align-items:center;gap:8px';
  const msg = document.createElement('span');
  msg.textContent = i18n('factoryResetDoneToastFmt').replace('{0}', Math.round(ms/1000));
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = i18n('btnUndo');
  btn.className = 'btn btn-xs';
  btn.style.cssText = 'padding:2px 8px;font-size:11px;background:#fff;border:1px solid currentColor;border-radius:4px;cursor:pointer';
  // a11y: <button> 原生已支持 Enter/Space，再兜底一次防 i18n 误改 type
  btn.addEventListener('keydown', function(ev){
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); btn.click(); }
  });
  btn.onclick = () => {
    try {
      const raw = localStorage.getItem('rsd-last-factoryreset-undo');
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || !payload.oldSnap) return;
      Object.keys(payload.oldSnap).forEach(k => {
        try {
          if (payload.oldSnap[k] === undefined) localStorage.removeItem(k);
          else localStorage.setItem(k, payload.oldSnap[k]);
        } catch (_) {}
      });
      try { localStorage.removeItem('rsd-last-factoryreset-undo'); } catch (_) {}
      _setSyncStatus(i18n('factoryResetUndone'));
      _i18nToast('toast_factoryResetUndone', 'success', 3000);
      // 阻止后续 reload：标记一个全局 flag
      window._factoryResetUndone = true;
      if (div.parentNode) div.parentNode.removeChild(div);
    } catch (err) {
      // v54.239 fix: 硬编码中文 alert → i18n
      alert(i18n('undoFailAlertFmt').replace('{0}', err.message));
    }
  };
  div.appendChild(msg);
  div.appendChild(btn);
  container.appendChild(div);
  // toast 自己 5 秒后自动消失（reload 会清掉它）
  // v54.238 fix: 自动消失时同时清 localStorage undo 数据，连续 2 次 factoryReset 时第二次撤销不会被第一次 setTimeout 误删
  setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); try { localStorage.removeItem('rsd-last-factoryreset-undo'); } catch (_) {} }, ms);
}

// v54.102 per-record sampleId prompt 弹窗 helper
// 用法：_showSampleIdPrompt(currentSampleId, onConfirm) → 显示 modal 让用户输入/确认 sampleId
// onConfirm(newSampleId) 回调；onCancel() 用户跳过时回调
// 注：v54.81 history 页面有 per-save 覆盖 input（current-sample-id），本 helper 是另一种 UX（save 时实时弹窗）
// v54.102 仅加 helper 不集成 save* 函数（避免侵入式 UX），由 caller 自行决定何时调用
function _showSampleIdPrompt(currentSampleId, onConfirm, onCancel) {
  var cur = currentSampleId || '';
  var modal = document.getElementById('sampleid-prompt-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sampleid-prompt-modal';
    modal.className = 'modal-overlay';
    // v54.265 a11y: 这是带 OK/Skip 的模态对话框 —— 必须声明 alertdialog + aria-modal，
    // 否则屏幕阅读器不进入「对话框模式」，用户仍能 Tab 到背后页面内容
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'sampleid-prompt-title');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = '<div class="modal-card" style="max-width:380px;width:90%">' +
      '<span id="sampleid-prompt-title">' + _esc(i18n('sampleIdPromptTitle')) + '</span>' +
      // v54.229 fix: cur 是用户输入，可能含 HTML 标签；之前直接字符串拼接会导致 XSS
      '<div style="font-size:12px;color:var(--text-light);margin-bottom:8px">' + _esc(i18n('sampleIdPromptCurrent')) + '<span id="sampleid-prompt-current">' + (cur ? _esc(cur) : _esc(i18n('notSet'))) + '</span></div>' +
      '<input type="text" id="sampleid-prompt-input" placeholder="" data-i18n-placeholder="placeholderSampleId" aria-labelledby="sampleid-prompt-title" value="' + _esc(cur) + '" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:4px;font-size:13px">' +
 '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">' +
 '<button class="btn btn-outline btn-sm" id="sampleid-prompt-skip" data-i18n="btnSkip">' + i18n('btnSkip') + '</button>' +
 '<button class="btn btn-primary btn-sm" id="sampleid-prompt-ok" data-i18n="btnConfirm">' + i18n('btnConfirm') + '</button>' +
 '</div></div>';
 document.body.appendChild(modal);
} else{
 document.getElementById('sampleid-prompt-current').textContent = cur || i18n('notSet');
 document.getElementById('sampleid-prompt-input').value = cur;
 modal.style.display = 'flex';
}
 var input = document.getElementById('sampleid-prompt-input');
 var okBtn = document.getElementById('sampleid-prompt-ok');
 var skipBtn = document.getElementById('sampleid-prompt-skip');
 // v54.265 a11y: 记录打开前的焦点元素，关闭后归还（否则 SR 用户被丢回文档顶部）
 var _prevFocus = document.activeElement;
 if(input){ input.focus(); input.select();}
 function close(){
 modal.style.display = 'none';
 try { if (_prevFocus && typeof _prevFocus.focus === 'function') _prevFocus.focus(); } catch (_) {}
 // v54.233 fix (Round 4 A#4): 之前用 onOk/onSkip/onKey 闭包引用 removeEventListener
 // 永远不会成功（每次 addEventListener 传的是新函数对象）→ 100 次保存 = 100 个累积监听器
 // 修复：用 dataset key 标记，先解绑旧 listener 再绑新的。
 try { okBtn._handler && okBtn.removeEventListener('click', okBtn._handler); } catch(_){}
 try { skipBtn._handler && skipBtn.removeEventListener('click', skipBtn._handler); } catch(_){}
 try { input._handler && input.removeEventListener('keydown', input._handler); } catch(_){}
}
 function onOk(){
 var val = input ? input.value.trim() : '';
 close();
 if(typeof onConfirm === 'function') onConfirm(val);
}
 function onSkip(){
 close();
 if(typeof onCancel === 'function') onCancel();
}
 function onKey(e){
 if(e.key === 'Enter'){ e.preventDefault(); onOk();}
 else if(e.key === 'Escape'){ e.preventDefault(); onSkip();}
}
 // 先清旧引用再绑新引用，确保 removeEventListener 能找到匹配项
 okBtn._handler = onOk;
 skipBtn._handler = onSkip;
 input._handler = onKey;
 okBtn.addEventListener('click', onOk);
 skipBtn.addEventListener('click', onSkip);
 input.addEventListener('keydown', onKey);
 // v54.270 a11y: focus trap —— Tab 焦点不外泄（input 已处理 Escape/Enter）
 var _onTab = function(e) {
   if (e.key !== 'Tab') return;
   var els = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
   if (!els.length) return;
   var first = els[0], last = els[els.length - 1];
   if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
   else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
 };
 // v54.274 perf#11 fix: 重入防护 —— 上一次打开未关闭时再次调用会累加 listener；先解绑 modal._onTab 旧引用
 try { if (modal._onTab) modal.removeEventListener('keydown', modal._onTab); } catch(_){}
 modal._onTab = _onTab;
 modal.addEventListener('keydown', _onTab);
 var _origClose = close;
 close = function() {
   try { if (modal._onTab) { modal.removeEventListener('keydown', modal._onTab); modal._onTab = null; } } catch(_){}
   _origClose();
 };
}

function exportAllTemplates(){
 try{
 const tpls ={};
 Object.keys(localStorage).filter(k => k.startsWith('rsd-template-')).forEach(k =>{ tpls[k] = localStorage.getItem(k);});
 if(!Object.keys(tpls).length){ _i18nAlert('noTemplate'); return;}
 _downloadJson({ _app: 'rsd-templates', _version: 1, _ts: Date.now(), templates: tpls}, `rsd-templates-${new Date().toISOString().slice(0,10)}.json`);
 _setSyncStatus(i18n('exportTemplateDoneFmt').replace('{0}', Object.keys(tpls).length) + i18n('itemCountUnit'));
} catch(e){ _setSyncStatus(i18n('exportTemplateFail')); alert(e.message);}
}

// v54.326：OCR 报告字段抽取（前端上传 PDF → 后端 ocr_server.py）
const OCR_ENDPOINT = 'http://localhost:8766';
const OCR_DEFAULT_KEYS = 'RSD,含量,回收率,均值,标准差,样品名,批号';
const OCR_POLL_INTERVAL_MS = 1500;  // v54.332：进度轮询间隔
// v54.327：OCR 字段 → 表单 input 映射（仅可映射字段加"应用"按钮）
const OCR_FIELD_MAP = {
  '样品名': { target: 'settings-sample-name', labelKey: 'lblSampleName' },
  '批号': { target: 'settings-batch', labelKey: 'lblBatch' },
  '含量': { target: 'calc-input', labelKey: 'lblContent' }
};
// v54.329：OCR 缓存层（避免重复抽取同一 PDF）
const OCR_CACHE_PREFIX = 'rsd-ocr-cache-';
const OCR_CACHE_MAX = 100;   // 最多 100 条（每条 ~5KB ≈ 500KB）
const OCR_CACHE_TTL_MS = 30 * 24 * 3600 * 1000;  // 30 天过期

function _ocrCacheKey(file) {
  // v54.329：用文件名 + 大小 + 内容 hash 前 16 字符作为 key
  // 仅用 name+size 不够（同名同大小 PDF 可能内容不同），
  // 读取整个文件 hash 也过重（10MB PDF 要几秒）—— 取折中：先 name+size 试，
  // 实际生产中如有冲突可升级为内容 hash（FileReader + SHA-256）
  return file.name + '|' + file.size;
}

function _ocrCacheRead(file) {
  try {
    const raw = localStorage.getItem(OCR_CACHE_PREFIX + _ocrCacheKey(file));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    // 过期检查
    if (Date.now() - entry.ts > OCR_CACHE_TTL_MS) {
      localStorage.removeItem(OCR_CACHE_PREFIX + _ocrCacheKey(file));
      return null;
    }
    return entry;
  } catch (_) { return null; }
}

function _ocrCacheWrite(file, result) {
  try {
    const entry = { fields: result.fields || {}, elapsed_sec: result.elapsed_sec || 0, ts: Date.now() };
    localStorage.setItem(OCR_CACHE_PREFIX + _ocrCacheKey(file), JSON.stringify(entry));
    _ocrCacheEvict();
  } catch (_) { /* quota 满则放弃 */ }
}

function _ocrCacheEvict() {
  // LRU：超过 OCR_CACHE_MAX 时删最旧的
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith(OCR_CACHE_PREFIX))
    .map(k => {
      try { return { k, ts: JSON.parse(localStorage.getItem(k)).ts || 0 }; }
      catch (_) { return { k, ts: 0 }; }
    })
    .sort((a, b) => a.ts - b.ts);
  while (keys.length > OCR_CACHE_MAX) {
    const old = keys.shift();
    localStorage.removeItem(old.k);
  }
}

function onOcrFileSelected(evt) {
  if (!evt || !evt.target) { _i18nAlert('invalidEvent'); return; }
  const files = evt.target.files ? Array.from(evt.target.files) : [];
  const btn = document.getElementById('ocr-extract-btn');
  const status = document.getElementById('ocr-status');
  if (btn) btn.disabled = files.length === 0;
  if (status) {
    if (files.length === 0) status.textContent = '';
    else if (files.length === 1) status.textContent = i18n('ocrFileSelectedFmt').replace('{0}', files[0].name);
    else status.textContent = i18n('ocrFilesSelectedFmt').replace('{0}', files.length);
  }
}

async function extractOcrFields() {
  const input = document.getElementById('ocr-file-input');
  const files = input && input.files ? Array.from(input.files) : [];
  if (files.length === 0) { _i18nAlert('ocrNoFile'); return; }
  // v54.331：批处理多个 PDF（串行，避免后端 OOM）
  if (files.length > 1) {
    return await extractOcrFieldsBatch(files);
  }
  return extractOcrFieldsSingle(files[0], input);
}

async function extractOcrFieldsBatch(files) {
  const status = document.getElementById('ocr-status');
  const results = document.getElementById('ocr-results');
  const btn = document.getElementById('ocr-extract-btn');
  const input = document.getElementById('ocr-file-input');
  if (results) results.innerHTML = '';
  if (btn) btn.disabled = true;
  let html = '';
  let success = 0, failed = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (status) status.textContent = i18n('ocrBatchProgressFmt')
      .replace('{0}', i + 1).replace('{1}', files.length).replace('{2}', f.name);
    const result = await extractOcrFieldsSingleRaw(f);
    if (result.error) {
      failed++;
      html += '<div style="color:var(--text-light);font-size:11px;padding:4px;margin:2px 0;border-bottom:1px solid var(--border)">❌ '
        + _esc(f.name) + ' — ' + _esc(result.error) + '</div>';
    } else {
      success++;
      const n = result.fields ? Object.keys(result.fields).length : 0;
      html += '<div style="color:var(--text-light);font-size:11px;padding:4px;margin:2px 0;border-bottom:1px solid var(--border)">✓ '
        + _esc(f.name) + ' — ' + n + ' ' + i18n('cvFieldsUnit').replace('个', '') + '</div>';
    }
  }
  if (results) results.innerHTML = html;
  if (status) status.textContent = i18n('ocrBatchDoneFmt')
    .replace('{0}', success).replace('{1}', failed).replace('{2}', files.length);
  _i18nToast('toast_ocrBatchDoneFmt', 'success', 3000, success, failed);
  if (btn) btn.disabled = false;
  if (input) input.value = '';
}

// 单文件抽取的纯函数（v54.332 改为调 /ocr/start 后端异步端点）
async function extractOcrFieldsSingleRaw(file) {
  const fd = new FormData();
  fd.append('pdf', file);
  fd.append('keys', OCR_DEFAULT_KEYS);
  fd.append('backend', 'local');
  try {
    // v54.332：调 /ocr/start 拿 job_id
    const startResp = await fetch(OCR_ENDPOINT + '/ocr/start', { method: 'POST', body: fd });
    if (!startResp.ok) {
      const err = await startResp.json().catch(() => ({}));
      return { error: err.error || ('HTTP ' + startResp.status) };
    }
    const startData = await startResp.json();
    if (!startData.job_id) return { error: 'start 端点未返回 job_id' };

    // v54.332：轮询 /ocr/status/<id> 直到 done/error
    const result = await pollOcrJob(startData.job_id);
    if (result.error) return { error: result.error };
    return result;
  } catch (err) {
    return { error: err.message };
  }
}

// v54.332：轮询 OCR job 进度（直到 done/error/timeout）
async function pollOcrJob(job_id, statusDiv) {
  const start = Date.now();
  let pollIter = 0;
  while (true) {
    pollIter++;
    if (pollIter > 50) return { error: 'poll 次数过多，疑似死循环' };
    let data;
    try {
      const resp = await fetch(OCR_ENDPOINT + '/ocr/status/' + encodeURIComponent(job_id));
      if (!resp.ok) return { error: 'HTTP ' + resp.status };
      data = await resp.json();
    } catch (e) {
      return { error: 'poll #' + pollIter + ': ' + (e.message || e.toString()) };
    }
    if (data.status === 'done') return data.result || { error: 'done 但 result 为空' };
    if (data.status === 'error') return { error: data.error || 'job 失败' };
    if (statusDiv) {
      try {
        const stageText = i18n('ocrStage' + ((data.stage || 'split') + '').replace(/^./, function(c) { return c.toUpperCase(); }));
        const elapsed = Math.round((Date.now() - start) / 1000);
        statusDiv.textContent = i18n('ocrProgressFmt').replace('{0}', stageText).replace('{1}', elapsed);
      } catch (_) {}
    }
    if (Date.now() - start > 200000) return { error: '轮询超时（>200s）' };
    await new Promise(function(r) { setTimeout(r, OCR_POLL_INTERVAL_MS); });
  }
}

async function extractOcrFieldsSingle(file, input) {
  const status = document.getElementById('ocr-status');
  const results = document.getElementById('ocr-results');
  const btn = document.getElementById('ocr-extract-btn');
  if (results) results.innerHTML = '';

  // v54.329：缓存命中检查
  const cached = _ocrCacheRead(file);
  if (cached) {
    renderOcrResults(cached);
    if (status) status.textContent = i18n('ocrCacheHitFmt')
      .replace('{0}', cached.fields ? Object.keys(cached.fields).length : 0)
      .replace('{1}', Math.round((Date.now() - cached.ts) / 1000 / 60));
    _i18nToast('toast_ocrCacheHit', 'info', 2500);
    if (btn) btn.disabled = false;
    if (input) input.value = '';
    return;
  }

  // v54.332：先试 /ocr/start（真实进度），回退 /ocr/extract（同步兜底）
  if (status) status.textContent = i18n('ocrExtracting');
  const fd = new FormData();
  fd.append('pdf', file);
  fd.append('keys', OCR_DEFAULT_KEYS);
  fd.append('backend', 'local');
  let result;
  try {
    const startResp = await fetch(OCR_ENDPOINT + '/ocr/start', { method: 'POST', body: fd });
    if (startResp.ok) {
      const startData = await startResp.json();
      if (startData && startData.job_id) {
        result = await pollOcrJob(startData.job_id, status);
      }
    }
    // 回退到同步
    if (!result) {
      const resp = await fetch(OCR_ENDPOINT + '/ocr/extract', { method: 'POST', body: fd });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || ('HTTP ' + resp.status));
      }
      result = await resp.json();
    }
    if (result.error) throw new Error(result.error);
    renderOcrResults(result);
    _ocrCacheWrite(file, result);
    const n = result.fields ? Object.keys(result.fields).length : 0;
    if (status) status.textContent = i18n('ocrDoneFmt').replace('{0}', n).replace('{1}', result.elapsed_sec || 0);
    _i18nToast('toast_ocrSuccess', 'success', 3000);
  } catch (err) {
    if (status) {
      let msg = i18n('ocrFailFmt').replace('{0}', err.message);
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        msg += ' ' + i18n('ocrServiceOffline');
      }
      status.textContent = msg;
    }
    _i18nToast('toast_ocrFailFmt', 'error', 5000, err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (input) input.value = '';
  }
}

function renderOcrResults(data) {
  const root = document.getElementById('ocr-results');
  if (!root) return;
  const fields = data.fields || {};
  const keys = Object.keys(fields);
  if (keys.length === 0) {
    root.innerHTML = '<div style="color:var(--text-light);font-size:12px">' + i18n('ocrNoFields') + '</div>';
    return;
  }
  let html = '<table style="width:100%;font-size:12px;border-collapse:collapse">';
  keys.forEach(function(k) {
    const f = fields[k];
    const v = (f && f.value) ? f.value : '';
    const conf = (f && f.confidence != null) ? Math.round(f.confidence * 100) + '%' : '-';
    const page = (f && f.page) ? i18n('ocrPageFmt').replace('{0}', f.page) : '';
    const mapped = OCR_FIELD_MAP[k];
    const btnCell = mapped
      ? '<button class="btn btn-outline btn-xs" data-ocr-apply="' + _esc(k) + '" data-ocr-val="' + _esc(v) + '" onclick="applyOcrField(this.dataset.ocrApply, this.dataset.ocrVal)" data-i18n="btnOcrApply" data-i18n-aria-label="titleOcrApply">📥 应用</button>'
      : '<span style="color:var(--text-light);font-size:10px">—</span>';
    html += '<tr><td style="padding:3px 8px;color:var(--text-light)">' + _esc(k) + '</td>'
      + '<td style="padding:3px 8px;font-weight:600">' + _esc(v) + '</td>'
      + '<td style="padding:3px 8px;color:var(--text-light);font-size:11px">' + _esc(conf) + ' ' + _esc(page) + '</td>'
      + '<td style="padding:3px 8px;text-align:right">' + btnCell + '</td></tr>';
  });
  html += '</table>';
  // v54.334：一键复制所有字段（kv / tsv 两种格式）
  html += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'
    + '<button class="btn btn-outline btn-xs" onclick="copyAllOcrFields()" data-i18n="btnOcrCopyAll">📋 一键复制所有字段</button>'
    + '<button class="btn btn-outline btn-xs" onclick="copyAllOcrFields(\'tsv\')" data-i18n="btnOcrCopyTsv">📊 复制为表格 (TSV)</button>'
    + '</div>';
  // v54.330：查看完整报告按钮（仅当 report_url 存在）
  if (data.report_url) {
    const fullUrl = (data.report_url.startsWith('http') ? data.report_url : OCR_ENDPOINT + data.report_url);
    html += '<div style="margin-top:8px;display:flex;gap:6px">'
      + '<button class="btn btn-outline btn-xs" onclick="toggleOcrReportViewer(\'' + _esc(fullUrl) + '\')" data-i18n="btnOcrShowReport">📊 查看完整报告</button>'
      + '</div>'
      + '<div id="ocr-report-viewer" style="display:none;margin-top:8px"></div>';
  }
  // v54.333：raw_text 展示（可折叠 + 复制）
  if (data.raw_text) {
    html += '<div style="margin-top:8px">'
      + '<button class="btn btn-outline btn-xs" onclick="toggleOcrRawText()" data-i18n="btnOcrShowRawText">📄 查看原始文本</button>'
      + '</div>'
      + '<div id="ocr-raw-text" style="display:none;margin-top:8px;padding:6px;background:var(--bg-2,#f8fafc);border:1px solid var(--border);border-radius:4px;max-height:300px;overflow:auto;font-size:11px;white-space:pre-wrap;line-height:1.4"></div>';
  }
  root.innerHTML = html;
  // raw_text 填值（避免 innerHTML 转义问题）
  if (data.raw_text) {
    const rawDiv = document.getElementById('ocr-raw-text');
    if (rawDiv) rawDiv.textContent = data.raw_text;
  }
}

// v54.333：切换 raw_text 显示 + 复制按钮
function toggleOcrRawText() {
  const rawDiv = document.getElementById('ocr-raw-text');
  if (!rawDiv) return;
  const isHidden = rawDiv.style.display === 'none' || !rawDiv.style.display;
  rawDiv.style.display = isHidden ? 'block' : 'none';
  // 显示时加复制按钮
  if (isHidden && !rawDiv.querySelector('.ocr-copy-btn')) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline btn-xs ocr-copy-btn';
    btn.style.cssFloat = 'right';
    btn.textContent = i18n('btnOcrCopyText');
    btn.dataset.i18n = 'btnOcrCopyText';
    btn.onclick = function() {
      navigator.clipboard.writeText(rawDiv.textContent).then(
        function() { _i18nToast('toast_ocrCopied', 'success', 2000); },
        function() { _i18nToast('toast_ocrCopyFail', 'error', 3000); }
      );
    };
    rawDiv.insertBefore(btn, rawDiv.firstChild);
  }
}

// v54.334：一键复制所有抽取字段
// format: 'kv' → "key: value\n..."; 'tsv' → "key\tvalue\n..."（可粘贴 Excel）
function copyAllOcrFields(format) {
  const root = document.getElementById('ocr-results');
  if (!root) return;
  const rows = root.querySelectorAll('table tbody tr');
  if (!rows.length) { _i18nToast('toast_ocrNoFieldsToCopy', 'warn', 2500); return; }
  const sep = format === 'tsv' ? '\t' : ': ';
  const lines = [];
  rows.forEach(function(tr) {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 2) return;
    const key = tds[0].textContent.trim();
    const value = tds[1].textContent.trim();
    if (key && value) lines.push(key + sep + value);
  });
  const text = lines.join('\n');
  if (!text) { _i18nToast('toast_ocrNoFieldsToCopy', 'warn', 2500); return; }
  navigator.clipboard.writeText(text).then(
    function() { _i18nToast(format === 'tsv' ? 'toast_ocrCopiedTsv' : 'toast_ocrCopied', 'success', 2000); },
    function() { _i18nToast('toast_ocrCopyFail', 'error', 3000); }
  );
}

// v54.330：显示/隐藏 OCR 报告 iframe
function toggleOcrReportViewer(url) {
  const viewer = document.getElementById('ocr-report-viewer');
  if (!viewer) return;
  if (viewer.style.display !== 'none' && viewer.innerHTML) {
    viewer.style.display = 'none';
    viewer.innerHTML = '';
    return;
  }
  viewer.innerHTML = '<iframe src="' + _esc(url) + '" style="width:100%;height:400px;border:1px solid var(--border);border-radius:4px;background:#fff" sandbox="allow-same-origin" title="OCR Report"></iframe>'
    + '<div style="text-align:right;margin-top:4px"><a href="' + _esc(url) + '" target="_blank" rel="noopener" data-i18n="btnOcrOpenNewTab">🔗 新窗口打开</a></div>';
  viewer.style.display = 'block';
}

// v54.327：把 OCR 抽取的字段填到对应表单 input
function applyOcrField(key, value) {
  const mapping = OCR_FIELD_MAP[key];
  if (!mapping) { _i18nToast('toast_ocrNotMapped', 'warn', 3000); return; }
  const input = document.getElementById(mapping.target);
  if (!input) { _i18nToast('toast_ocrTargetMissing', 'error', 3000); return; }
  input.value = value;
  // 触发 oninput 事件，让计算函数重跑
  if (typeof input.oninput === 'function' || input.hasAttribute('oninput')) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // 提示用户字段已应用
  _i18nToast('toast_ocrAppliedFmt', 'success', 3000, i18n(mapping.labelKey || key));
}

function importTemplates(evt){
 
 
 
 
 
 
 if(!evt || !evt.target || !evt.target.files || !evt.target.files[0]){
 _i18nAlert('pleaseSelectFile');
 return;
}
 const file = evt.target.files[0];
 const reader = new FileReader();
 reader.onload = function(e){
 try{
 const payload = JSON.parse(e.target.result);
 
 
 const tpls =(payload &&(payload.templates || payload.data)) ||{};
 const targetKeys = Object.keys(tpls).filter(k => k.startsWith('rsd-template-'));
 // v54.230 fix: snapshot 旧模板值 → 写盘失败时回滚，否则部分写入后 quota 满会让用户静默丢失旧模板
 const oldSnap = {};
 try {
 const allKeys = Object.keys(localStorage);
 for (let i = 0; i < allKeys.length; i++) {
 const k = allKeys[i];
 if (k.startsWith('rsd-template-')) oldSnap[k] = localStorage.getItem(k);
 }
 } catch (_) {}
 const written = [];
 try {
 for (let i = 0; i < targetKeys.length; i++) {
 const k = targetKeys[i];
 localStorage.setItem(k, tpls[k]);
 written.push(k);
 }
 } catch (err) {
 for (let i = 0; i < written.length; i++) {
 const k = written[i];
 try { if (oldSnap[k] === undefined) localStorage.removeItem(k); else localStorage.setItem(k, oldSnap[k]); } catch (_) {}
 }
 alert(i18n('importTemplateFailRollbackAlertFmt').replace('{0}', err.message));
 return;
 }
 _setSyncStatus(i18n('importTemplateDoneFmt').replace('{0}', targetKeys.length) + i18n('cvTemplateCount'));
 if(typeof renderSettingsPage === 'function') renderSettingsPage();
} catch(err){
   // v54.239 fix: 硬编码中文 alert → i18n
   alert(i18n('importTemplateFailAlertFmt').replace('{0}', err.message));
}
};
 reader.readAsText(file);
 evt.target.value = '';
}

var _cssVarCache = {}; /* v54.274 perf #5: getComputedStyle 每次强制样式重算（昂贵）；calcSpike 每行调 1-2 次 → n 行 n 次。CSS 变量会话内恒定（styles.css 无 data-theme 覆盖） */
function _invalidateCssVarCache(){ _cssVarCache = {}; }
function _cssVar(name){
 if (_cssVarCache[name] !== undefined) return _cssVarCache[name];
 var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 _cssVarCache[name] = v;
 return v;
}
const TITER_DEFAULTS ={ rsd: 0.1, flow: 0.95, fhigh: 1.05, n: 8};
function loadTiterDefaults(){ return _loadJson('rsd-titer-defaults', TITER_DEFAULTS);}

const TITER_VALID_DAYS = 30; 

const PHARMA_TITER =[
 
{ id: 'hcl', name: '盐酸滴定液 HCl', formula: 'HCl', m_eq: 1.0, category: '酸碱', indicator: '甲基红'},
{ id: 'hcl_05', name: '盐酸滴定液 0.5 mol/L', formula: 'HCl', m_eq: 0.5, category: '酸碱', indicator: '甲基红'},
{ id: 'hcl_02', name: '盐酸滴定液 0.2 mol/L', formula: 'HCl', m_eq: 0.2, category: '酸碱', indicator: '甲基红'},
{ id: 'hcl_01', name: '盐酸滴定液 0.1 mol/L', formula: 'HCl', m_eq: 0.1, category: '酸碱', indicator: '甲基红-溴甲酚绿'},
{ id: 'h2so4', name: '硫酸滴定液 H₂SO₄', formula: 'H₂SO₄', m_eq: 0.5, category: '酸碱', indicator: '甲基红'},
{ id: 'h2so4_01', name: '硫酸滴定液 0.1 mol/L', formula: 'H₂SO₄', m_eq: 0.1, category: '酸碱', indicator: '甲基红'},
{ id: 'naoh', name: '氢氧化钠滴定液 NaOH', formula: 'NaOH', m_eq: 1.0, category: '酸碱', indicator: '酚酞'},
{ id: 'naoh_05', name: '氢氧化钠滴定液 0.5 mol/L', formula: 'NaOH', m_eq: 0.5, category: '酸碱', indicator: '酚酞'},
{ id: 'naoh_01', name: '氢氧化钠滴定液 0.1 mol/L', formula: 'NaOH', m_eq: 0.1, category: '酸碱', indicator: '酚酞'},
{ id: 'koh', name: '氢氧化钾滴定液 KOH', formula: 'KOH', m_eq: 1.0, category: '酸碱', indicator: '酚酞'},
{ id: 'koh_01', name: '氢氧化钾滴定液 0.1 mol/L (乙醇)', formula: 'KOH', m_eq: 0.1, category: '酸碱', indicator: '酚酞'},
{ id: 'baoh2', name: '氢氧化钡滴定液 Ba(OH)₂', formula: 'Ba(OH)₂', m_eq: 0.1, category: '酸碱', indicator: '酚酞'},
 
{ id: 'na2s2o3', name: '硫代硫酸钠滴定液 Na₂S₂O₃', formula: 'Na₂S₂O₃', m_eq: 0.1, category: '氧化还原', indicator: '淀粉'},
{ id: 'na2s2o3_01', name: '硫代硫酸钠 0.01 mol/L', formula: 'Na₂S₂O₃', m_eq: 0.01, category: '氧化还原', indicator: '淀粉'},
{ id: 'na2s2o3_05', name: '硫代硫酸钠 0.5 mol/L', formula: 'Na₂S₂O₃', m_eq: 0.5, category: '氧化还原', indicator: '淀粉'},
{ id: 'kmno4', name: '高锰酸钾滴定液 KMnO₄', formula: 'KMnO₄', m_eq: 0.02, category: '氧化还原', indicator: '自身指示剂'},
{ id: 'kmno4_01', name: '高锰酸钾 0.01 mol/L', formula: 'KMnO₄', m_eq: 0.01, category: '氧化还原', indicator: '自身指示剂'},
{ id: 'i2', name: '碘滴定液 I₂', formula: 'I₂', m_eq: 0.05, category: '氧化还原', indicator: '淀粉'},
{ id: 'i2_01', name: '碘滴定液 0.01 mol/L', formula: 'I₂', m_eq: 0.01, category: '氧化还原', indicator: '淀粉'},
{ id: 'kbro3', name: '溴酸钾滴定液 KBrO₃', formula: 'KBrO₃', m_eq: 0.01667, category: '氧化还原', indicator: '甲基红'},
{ id: 'nano2', name: '亚硝酸钠滴定液 NaNO₂', formula: 'NaNO₂', m_eq: 0.1, category: '氧化还原', indicator: '永停/外指示剂'},
{ id: 'nano2_01', name: '亚硝酸钠 0.01 mol/L', formula: 'NaNO₂', m_eq: 0.01, category: '氧化还原', indicator: '永停/外指示剂'},
{ id: 'ce_nh4', name: '硫酸铈滴定液 Ce(SO₄)₂', formula: 'Ce(SO₄)₂', m_eq: 0.1, category: '氧化还原', indicator: '邻二氮菲'},
{ id: 'feso4', name: '硫酸亚铁滴定液 FeSO₄', formula: 'FeSO₄', m_eq: 0.1, category: '氧化还原', indicator: '邻二氮菲'},
 
{ id: 'agno3', name: '硝酸银滴定液 AgNO₃', formula: 'AgNO₃', m_eq: 0.1, category: '沉淀', indicator: '铬酸钾/铁铵矾'},
{ id: 'agno3_01', name: '硝酸银 0.01 mol/L', formula: 'AgNO₃', m_eq: 0.01, category: '沉淀', indicator: '铬酸钾/铁铵矾'},
{ id: 'nh4scn', name: '硫氰酸铵滴定液 NH₄SCN', formula: 'NH₄SCN', m_eq: 0.1, category: '沉淀', indicator: '铁铵矾'},
{ id: 'k4fe', name: '亚铁氰化钾 K₄[Fe(CN)₆]', formula: 'K₄[Fe(CN)₆]', m_eq: 0.05, category: '沉淀', indicator: '外指示剂'},
 
{ id: 'edta', name: 'EDTA 滴定液 Na₂-EDTA', formula: 'C₁₀H₁₄N₂Na₂O₈', m_eq: 0.1, category: '配位', indicator: '铬黑 T/二甲酚橙'},
{ id: 'edta_05', name: 'EDTA 0.05 mol/L', formula: 'C₁₀H₁₄N₂Na₂O₈', m_eq: 0.05, category: '配位', indicator: '铬黑 T'},
{ id: 'edta_01', name: 'EDTA 0.01 mol/L', formula: 'C₁₀H₁₄N₂Na₂O₈', m_eq: 0.01, category: '配位', indicator: '铬黑 T'},
{ id: 'zn_edta', name: '锌滴定液 ZnSO₄', formula: 'ZnSO₄', m_eq: 0.05, category: '配位', indicator: '二甲酚橙'},
{ id: 'cu_edta', name: '铜滴定液 CuSO₄', formula: 'CuSO₄', m_eq: 0.05, category: '配位', indicator: 'PAN'},
 
{ id: 'hclo4_hac', name: '高氯酸滴定液 HClO₄/冰醋酸', formula: 'HClO₄', m_eq: 0.1, category: '非水', indicator: '电位/结晶紫'},
{ id: 'hclo4_005', name: '高氯酸 0.05 mol/L (冰醋酸)', formula: 'HClO₄', m_eq: 0.05, category: '非水', indicator: '电位/结晶紫'},
{ id: 'naoch3', name: '甲醇钠滴定液 NaOCH₃', formula: 'NaOCH₃', m_eq: 0.1, category: '非水', indicator: '百里酚蓝'},
{ id: 'hcl_dioxane', name: '盐酸滴定液 HCl/二氧六环', formula: 'HCl', m_eq: 0.1, category: '非水', indicator: '电位'},
 
{ id: 'kf', name: '卡尔费休滴定液 KF (不含吡啶)', formula: 'I₂/SO₂/咪唑', m_eq: 5.0, category: '水分', indicator: '电位'},
{ id: 'kf_py', name: '卡尔费休滴定液 KF (含吡啶)', formula: 'I₂/SO₂/吡啶', m_eq: 5.0, category: '水分', indicator: '电位'},
{ id: 'kf_methanol', name: 'KF 甲醇溶液', formula: 'I₂/CH₃OH', m_eq: 3.5, category: '水分', indicator: '电位'},
 
{ id: 'hcl_pot', name: '盐酸滴定液 (电位法)', formula: 'HCl', m_eq: 0.1, category: '电极法', indicator: '玻璃电极'},
{ id: 'naoh_pot', name: '氢氧化钠 (电位法)', formula: 'NaOH', m_eq: 0.1, category: '电极法', indicator: '玻璃电极'},
{ id: 'hclo4_pot', name: '高氯酸 (电位法)', formula: 'HClO₄', m_eq: 0.1, category: '电极法', indicator: '玻璃电极'},
{ id: 'agno3_pot', name: '硝酸银 (电位法)', formula: 'AgNO₃', m_eq: 0.1, category: '电极法', indicator: '银电极'},
{ id: 'nano2_pot', name: '亚硝酸钠 (永停法)', formula: 'NaNO₂', m_eq: 0.1, category: '电极法', indicator: '永停'},
{ id: 'edta_pot', name: 'EDTA (电位法)', formula: 'Na₂-EDTA', m_eq: 0.1, category: '电极法', indicator: '离子选择电极'},
{ id: 'na2s2o3_pot', name: '硫代硫酸钠 (电位法)', formula: 'Na₂S₂O₃', m_eq: 0.1, category: '电极法', indicator: '铂电极'},
{ id: 'kmno4_pot', name: '高锰酸钾 (电位法)', formula: 'KMnO₄', m_eq: 0.02, category: '电极法', indicator: '铂电极'},
];

const PHARMA_PRECAUTIONS ={
 'hcl': '避光密闭保存；避免接触金属；标定用无水碳酸钠基准',
 'hcl_05': '避光密闭保存；用于一般碱液返滴',
 'hcl_02': '稀盐酸需临用新配',
 'hcl_01': i18n('titerHintNaOH'),
 'h2so4': '强腐蚀性；稀释时酸入水；标定用 Tris',
 'h2so4_01': '稀硫酸可长期稳定',
 'naoh': '易吸收 CO₂；用钠石灰管；标定用邻苯二甲酸氢钾',
 'naoh_05': '同上；高浓度更易吸 CO₂',
 'naoh_01': '0.1 mol/L 最常用；临用前标定',
 'koh': '类似 NaOH；醇溶液用于非水滴定',
 'koh_01': '乙醇溶液现配现用；避免接触空气',
 'baoh2': '吸收 CO₂ 后产生 BaCO₃ 沉淀；需饱和液过滤后使用',
 'na2s2o3': '不稳定；含 CO₂ 蒸馏水配制；标定用 K₂Cr₂O₇',
 'na2s2o3_01': '稀释液不稳定；每两周重新标定',
 'na2s2o3_05': '用于高浓度样品',
 'kmno4': '强氧化剂；避光棕色瓶；过滤除去 MnO₂',
 'kmno4_01': '同上；稀溶液稳定性差',
 'i2': '易挥发；棕色瓶密闭；标定用 As₂O₃',
 'i2_01': '稀释后稳定性下降；现配现标',
 'kbro3': '稳定；与 KBr 配合产生 Br₂',
 'nano2': '不稳定；临用现标；亚硝酸盐有毒',
 'nano2_01': '稀溶液现配现用',
 'ce_nh4': '酸性介质；用于 Fe²⁺ 测定',
 'feso4': '易氧化；临用现配；标定用 KMnO₄',
 'agno3': '遇光分解；棕色瓶避光；标定用 NaCl',
 'agno3_01': '稀溶液避光保存',
 'nh4scn': '用于 Ag⁺ 返滴；酸性介质',
 'k4fe': '剧毒；专库储存；严防误用',
 'edta': i18n('titerHintBuffer'),
 'edta_05': '同上；用于高浓度样品',
 'edta_01': '稀溶液稳定性差；每月重新标定',
 'zn_edta': '用于返滴定 Al³⁺',
 'cu_edta': 'PAN 指示剂终点敏锐',
 'hclo4_hac': '强腐蚀；避免与有机物接触；标定用邻苯二甲酸氢钾',
 'hclo4_005': '同上；用于稀样品',
 'naoch3': '极易水解；甲醇介质；严防潮气',
 'hcl_dioxane': '非水滴定；密闭防潮',
 'kf': 'KF 现配现标；标定用纯水或甲醇中水标准液',
 'kf_py': '含吡啶有毒；逐步淘汰',
 'kf_methanol': '用于油类样品；标定频率高',
 'hcl_pot': '电位法终点更精确；玻璃电极需预先活化',
 'naoh_pot': '同上；CO₂ 影响显著',
 'hclo4_pot': '电位终点比结晶紫指示剂更可靠',
 'agno3_pot': '银电极使用前抛光；适用浑浊样品',
 'nano2_pot': '永停法适用于重氮化反应',
 'edta_pot': '离子电极可测 Ca²⁺/Cu²⁺ 等',
 'na2s2o3_pot': '电位法适用于有色样品',
 'kmno4_pot': '电位法适用于无指示剂样品',
};

let _titerUndoStack =[]; 
let _titerRecent = _loadJson('rsd-titer-recent',[]); 
function _pushTiterUndo(){
 try{
 const snap ={
 vs: document.getElementById('titer-vs')?.value || '',
 v0s: document.getElementById('titer-v0s')?.value || '',
 ms: document.getElementById('titer-ms')?.value || '',
 ps: document.getElementById('titer-ps')?.value || '',
 f: document.getElementById('titer-f')?.value || '',
 t: document.getElementById('titer-t')?.value || '',
 titerData: JSON.parse(JSON.stringify(titerData ||[])),
 method: document.getElementById('titer-method-select')?.value || '',
};
 _titerUndoStack.push(snap);
 if(_titerUndoStack.length > 10) _titerUndoStack.shift();
} catch(e){}
}
function undoTiter(){
 if(!_titerUndoStack.length){ _i18nAlert('noUndo'); return;}
 const snap = _titerUndoStack.pop();
 function setVal(id, val){ const el = document.getElementById(id); if(el) el.value = val;}
 setVal('titer-vs', snap.vs); setVal('titer-v0s', snap.v0s); setVal('titer-ms', snap.ms);
 setVal('titer-ps', snap.ps); setVal('titer-f', snap.f); setVal('titer-t', snap.t);
 titerData = snap.titerData ||[];
 setVal('titer-method-select', snap.method);
 if(typeof renderTiter === 'function') renderTiter();
 if(typeof loadTiterMethod === 'function') loadTiterMethod();
}
function loadTiterMethod(){
 const sel = document.getElementById('titer-method-select');
 const id = sel?.value || '';
 const m = PHARMA_TITER.find(x => x.id === id);
 const precautionEl = document.getElementById('titer-precaution');
 const mEqEl = document.getElementById('titer-meq');
 const indEl = document.getElementById('titer-indicator');
 if(!m){
 if(precautionEl) precautionEl.textContent = i18n('titerSelectPrompt');
 if(mEqEl) mEqEl.textContent = '—';
 if(indEl) indEl.textContent = '—';
 return;
}
 if(mEqEl) mEqEl.textContent = m.m_eq.toFixed(5) + ' mg/mL';
 if(indEl) indEl.textContent = m.indicator;
 if(precautionEl) precautionEl.textContent = PHARMA_PRECAUTIONS[m.id] || i18n('cvNoDescription');
 
 const fEl = document.getElementById('titer-f');
 if(fEl && !fEl.value) fEl.value = '1.000';
 
 const pEl = document.getElementById('titer-ps');
 if(pEl && !pEl.value) pEl.value = '100';
 
 if(id && !_titerRecent.includes(id)){ _titerRecent.unshift(id); _titerRecent = _titerRecent.slice(0, 5); _saveJson('rsd-titer-recent', _titerRecent); renderTiterRecent();}
 if(typeof renderTiter === 'function') renderTiter();
}
function renderTiterRecent(){
 const sel = document.getElementById('titer-method-select');
 const recentContainer = document.getElementById('titer-recent');
 if(!recentContainer) return;
 if(!_titerRecent.length){ recentContainer.innerHTML = ''; return;}
 const pills = _titerRecent.map(id =>{
 const m = PHARMA_TITER.find(x => x.id === id);
 if(!m) return '';
 return '<button type="button" class="titer-pill" style="display:inline-block;max-width:140px;padding:3px 8px;margin:2px;background:var(--primary-light,#e8f0fe);border-radius:12px;font-size:11px;cursor:pointer;border:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" aria-label="' + _esc(m.name) + '" title="' + _esc(m.name) + '" onclick="document.getElementById(\'titer-method-select\').value=\'' + id + '\';loadTiterMethod();">' + _esc(m.name) + '</button>'; /* v54.284 Round 38 重做：titer pill 用完整 m.name（不再 split(' ')[0] 截断），max-width+text-overflow:ellipsis 视觉截断，aria-label+title 完整可读（v54.282 已修但被跳过） */
}).join('');
 recentContainer.innerHTML = i18n('titerRecentLabel') + pills;
}
function renderTiterMethodOptions(filterCat){
 const sel = document.getElementById('titer-method-select');
 if(!sel) return;
 const search =(document.getElementById('titer-search')?.value || '').toLowerCase().trim();
 const _titerCatAll = i18n('titerCategoryAll'); /* v54.274 perf #10: hoist 出 filter callback（PHARMA_TITER ~50 项 → 之前每次 filter 调 50 次 i18n） */
 const filtered = PHARMA_TITER.filter(m =>{
 if(filterCat && filterCat !== _titerCatAll && m.category !== filterCat) return false;
 if(search && !(m.name.toLowerCase().includes(search) || m.formula.toLowerCase().includes(search) || m.id.toLowerCase().includes(search))) return false;
 return true;
});
 sel.innerHTML = '<option value="">' + i18n('titerSelectPlaceholder') + '</option>' +
 filtered.map(m => '<option value="' + m.id + '">' + m.name + ' [' + m.category + ']</option>').join('');
 
 if(_titerRecent[0]){
 const exists = filtered.find(m => m.id === _titerRecent[0]);
 if(exists) sel.value = _titerRecent[0];
}
}
function filterTiterCategory(cat){
 document.querySelectorAll('#titer-cat-pills .pill').forEach(p => {
  const isActive = p.dataset.cat === cat;
  p.classList.toggle('active', isActive);
  p.setAttribute('aria-pressed', isActive ? 'true' : 'false');
 });
 renderTiterMethodOptions(cat);
}

function checkTiterValidity(titerRec){
 if(!titerRec || !titerRec.calibratedAt) return null;
 const stored = parseInt(localStorage.getItem('rsd-titer-valid-days'), 10);
 const days = Number.isFinite(stored) && stored > 0 ? stored : TITER_VALID_DAYS;
 const elapsed = Math.floor((Date.now() - titerRec.calibratedAt) / 86400000);
 const remain = days - elapsed;
 const status = remain <= 0 ? 'expired' : remain <= 7 ? 'expiring' : 'valid';
 return{ days, elapsed, remain, status};
}

function renderTiterTrend(){
 const svg = document.getElementById('titer-trend-svg');
 if(!svg) return;
 const all =(typeof getH === 'function' ? getH() : JSON.parse(localStorage.getItem('rsd-calc-history') || '[]'));
 const titerHist = all.filter(h => h.type && h.type.indexOf('滴定') >= 0 && Number.isFinite(parseFloat(h.f))).slice(-20); /* v54.272 fix: was h.f truthy — f=0 excluded. Now finite-numeric check */
 if(!titerHist.length){
 svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="12">' + i18n('titerTrendNoData') + '</text>';
 // v54.243 a11y: SVG <text> 不可被屏幕阅读器朗读 → 在 svg 父容器插入 visually-hidden aria-live
 _announceChartState('titer-trend-svg', i18n('titerTrendNoData'));
 return;
 }
 _announceChartState('titer-trend-svg', '');
 const w = 280, h = 80, pad = 10;
 const xs = titerHist.map((_, i) => pad + i *(w - 2 * pad) / Math.max(1, titerHist.length - 1));
 const fVals = titerHist.map(x => parseFloat(x.f)).filter(Number.isFinite); /* v54.272 fix (correctness HIGH): was parseFloat(x.f)||1 — explicit f=0 becomes 1 (corrupting y-axis scale). Now keep finite only, downstream guards handle empty */
 if(fVals.length === 0) return;
 const fMin = Math.min(...fVals, 0.95), fMax = Math.max(...fVals, 1.05);
 const ys = fVals.map(v => h - pad -((v - fMin) /(fMax - fMin || 1)) *(h - 2 * pad));
 let path = '';
 xs.forEach((x, i) =>{ path +=(i === 0 ? 'M' : 'L') + x + ',' + ys[i] + ' ';});
 const dangerY1 = h - pad -((0.95 - fMin) /(fMax - fMin || 1)) *(h - 2 * pad);
 const dangerY2 = h - pad -((1.05 - fMin) /(fMax - fMin || 1)) *(h - 2 * pad);
 svg.innerHTML = '<line x1="' + pad + '" y1="' + dangerY1 + '" x2="' +(w - pad) + '" y2="' + dangerY1 + '" stroke="#ffcccc" stroke-dasharray="2,2"/><line x1="' + pad + '" y1="' + dangerY2 + '" x2="' +(w - pad) + '" y2="' + dangerY2 + '" stroke="#ffcccc" stroke-dasharray="2,2"/><path d="' + path + '" fill="none" stroke="var(--primary)" stroke-width="2"/>' + xs.map((x, i) => '<circle cx="' + x + '" cy="' + ys[i] + '" r="3" fill="var(--primary)"/>').join('');
 // v54.242 fix: nested <svg> 之前是无效嵌套 — 现在直接给 svg 容器设 viewBox 让内部 line/path/circle 正确缩放
 svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
 svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
}




function csvExportHistory(typeMatch, filename, headers, rowFn){
 // v54.244 fix (Round 8 followup): headers 或 rowFn 缺失时早退，避免空 CSV 输出
 if(!headers || !rowFn){
 _i18nToast('csvMissingArgs', 'warn');
 return;
}
 const all =(typeof getH === 'function' ? getH() : JSON.parse(localStorage.getItem('rsd-calc-history') || '[]'));
 
 const hist = all.filter(h =>{
 if(typeof typeMatch === 'function') return typeMatch(h);
 return h.type === typeMatch ||(h.type && h.type.indexOf(typeMatch) >= 0);
});
 if(!hist.length){
   var emptyMsg = i18n('cvHistoryEmpty') +(typeof typeMatch === 'string' ? typeMatch : i18n('cvCustomFilterNote'));
   if(typeof _i18nAlert === 'function') _i18nAlert(emptyMsg);
   else alert(emptyMsg);
   return;
 }
 const rows =[headers];
 
 
 
 const skipped =[];
 hist.forEach((h, i) =>{
 try{
 const r = rowFn(h);
 if(Array.isArray(r)) rows.push(r);
 else skipped.push(i); 
} catch(e){ skipped.push(i);}
});
 if(typeof blobDownloadCSV === 'function') blobDownloadCSV(rows, filename);
 else _i18nAlert('csvHelperMissing');
 
 if(skipped.length > 0){
 _i18nToast('toast_exportSkippedFmt', 'warn', 5000, skipped.length);
}
}


function exportSpikeCSV(){
 const all =(typeof getH === 'function' ? getH() : JSON.parse(localStorage.getItem('rsd-calc-history') || '[]'));
 const hist = all.filter(h => h.type === '加样回收率');
 if(!hist.length){ _i18nAlert('noSpikeHist'); return;}
 const rows =[[i18n('csvHeaderTime'), i18n('csvColSampleOriginal'), i18n('csvColLimitLow'), i18n('csvColLimitHigh'), i18n('csvColRsdLimit'), i18n('horizontalPct'), i18n('csvColAdded'), i18n('csvColMeasured'), i18n('recoveryPercent'), i18n('csvColMeanPct'), i18n('csvColSd'), i18n('csvColRsdPct'), i18n('csvColOverallVerdict')]];
 hist.forEach(h =>{
 const arr = Array.isArray(h.rows) ? h.rows :[];
 if(arr.length === 0){
 rows.push([h.time||'', h.original||'', h.limitLow||'', h.limitHigh||'', h.rsdLimit||'', '', '', '', '', h.mean||'', h.sd||'', h.rsd||'', h.verdict||'']);
 return;
}
 arr.forEach((r, i) =>{
 
 rows.push([
 i === 0 ?(h.time||'') : '',
 i === 0 ?(h.original||'') : '',
 i === 0 ?(h.limitLow||'') : '',
 i === 0 ?(h.limitHigh||'') : '',
 i === 0 ?(h.rsdLimit||'') : '',
 r.level||'', r.added||'', r.measured||'', r.recovery||'',
 i === 0 ?(h.mean||'') : '',
 i === 0 ?(h.sd||'') : '',
 i === 0 ?(h.rsd||'') : '',
 i === 0 ?(h.verdict||'') : ''
]);
});
});
 if(typeof blobDownloadCSV === 'function') blobDownloadCSV(rows, 'rsd-spike-' + Date.now() + '.csv');
}

function exportCurveCSV(){
 csvExportHistory(
 h => h.type === '标准曲线',
 'rsd-curve-' + Date.now() + '.csv',
[i18n('csvHeaderTime'), i18n('cvSlopeA'), i18n('cvInterceptB'), i18n('cvR2'), i18n('cvDataPointCount')],
 h =>{
 const pts = Array.isArray(h.points) ? h.points :[];
 return[h.time||'', h.a||'', h.b||'', h.r2||'', pts.length];
}
);
}

function exportSimpleCSV(){
 csvExportHistory(
 h => h.type === '回收率-简易',
 'rsd-simple-' + Date.now() + '.csv',
[i18n('csvHeaderTime'), i18n('csvColTheoryPct'), i18n('csvColMeasuredPct'), i18n('recoveryPercent'), i18n('csvColVerdict')],
 h =>[h.time||'', h.theory||'', h.measured||'', h.recovery||'', h.verdict||'']
);
}

function exportContentCSV(){
 const all =(typeof getH === 'function' ? getH() : JSON.parse(localStorage.getItem('rsd-calc-history') || '[]'));
 const hist = all.filter(h => h.type === '外标含量');
 if(!hist.length){ _i18nAlert('noContentHist'); return;}
 const rows =[[i18n('csvHeaderTime'), i18n('csvColStdA'), i18n('cvStdWMg'), i18n('csvColPPct'), i18n('csvColDMl'), i18n('csvColMoisture'), i18n('csvColResidue'), i18n('hSample'), i18n('cvSampleWMg'), i18n('cvSampleD'), i18n('csvColParallelNo'), i18n('csvColPeakArea')]];
 hist.forEach(h =>{
 const samples = Array.isArray(h.samples) ? h.samples :[];
 if(samples.length === 0){
 rows.push([h.time||'', h.stdArea||'', h.stdWeight||'', h.stdPurity||'', h.stdDilution||'', h.stdMoisture||'', h.stdResidue||'', '', '', '', '', '']);
 return;
}
 samples.forEach((s, si) =>{
 const parallels = Array.isArray(s.parallels) ? s.parallels :[];
 parallels.forEach((p, pi) =>{
 rows.push([
 pi === 0 && si === 0 ?(h.time||'') : '',
 pi === 0 && si === 0 ?(h.stdArea||'') : '',
 pi === 0 && si === 0 ?(h.stdWeight||'') : '',
 pi === 0 && si === 0 ?(h.stdPurity||'') : '',
 pi === 0 && si === 0 ?(h.stdDilution||'') : '',
 pi === 0 && si === 0 ?(h.stdMoisture||'') : '',
 pi === 0 && si === 0 ?(h.stdResidue||'') : '',
 si+1,
 s.weight||'', s.dilution||'',
 pi+1, p.area||''
]);
});
});
});
 if(typeof blobDownloadCSV === 'function') blobDownloadCSV(rows, 'rsd-content-' + Date.now() + '.csv');
}

function renderTiterStatCards(){
 const el = document.getElementById('titer-stat-cards');
 if(!el) return;
 const all =(typeof getH === 'function' ? getH() : JSON.parse(localStorage.getItem('rsd-calc-history') || '[]'));
 const titerHist = all.filter(h => h.type && h.type.indexOf('滴定') >= 0);
 const td = loadTiterDefaults();
 if(!titerHist.length){ el.innerHTML = i18n('cvNoCalibration'); return;}
 const fVals = titerHist.map(h => parseFloat(h.f)).filter(v => Number.isFinite(v));
 const tVals = titerHist.map(h => parseFloat(h.T)).filter(v => Number.isFinite(v)); /* v54.273 fix: h.t → h.T (saveTiterHistory 存 T，与 _extractChartData / judgeEntry 一致) */
 const fMean = fVals.length ? fVals.reduce((a, b) => a + b, 0) / fVals.length : null;
 const tMean = tVals.length ? tVals.reduce((a, b) => a + b, 0) / tVals.length : null;
 const inRange = fVals.filter(v => v >= td.flow && v <= td.fhigh).length;
 const validity = checkTiterValidity(titerHist[titerHist.length - 1]);
 const validityBadge = !validity ? '' :
 '<span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:11px;background:' +(validity.status === 'valid' ? '#d4edda' : validity.status === 'expiring' ? '#fff3cd' : '#f8d7da') + ';color:' +(validity.status === 'valid' ? '#155724' : validity.status === 'expiring' ? '#856404' : '#721c24') + '">' +
(validity.status === 'valid' ? i18n('titerValidOk') : validity.status === 'expiring' ? i18n('titerValidExpiringFmt').replace('{0}', validity.remain) : i18n('titerValidExpired')) + '</span>';
 el.innerHTML =
 '<div style="flex:1;min-width:80px;padding:6px;background:var(--card);border:1px solid var(--border);border-radius:6px;text-align:center"><div class="fs-10-light" data-i18n="titerTotalCalib"></div><div style="font-size:18px;font-weight:700">' + titerHist.length + '</div></div>' +
 '<div style="flex:1;min-width:80px;padding:6px;background:var(--card);border:1px solid var(--border);border-radius:6px;text-align:center"><div class="fs-10-light" data-i18n="titerFAvg"></div><div style="font-size:18px;font-weight:700;color:' +(fMean >= td.flow && fMean <= td.fhigh ? _cssVar('--success') : _cssVar('--danger')) + '">' +(fMean != null ? fMean.toFixed(4) : '—') + '</div></div>' +
 '<div style="flex:1;min-width:80px;padding:6px;background:var(--card);border:1px solid var(--border);border-radius:6px;text-align:center"><div class="fs-10-light" data-i18n="titerTAvg"></div><div style="font-size:18px;font-weight:700">' +(tMean != null ? tMean.toFixed(5) : '—') + '</div></div>' +
 '<div style="flex:1;min-width:80px;padding:6px;background:var(--card);border:1px solid var(--border);border-radius:6px;text-align:center"><div class="fs-10-light" data-i18n="titerFRange"></div><div style="font-size:18px;font-weight:700">' + inRange + '/' + fVals.length + '</div></div>' +
 '<div style="flex:1;min-width:120px;padding:6px;background:var(--card);border:1px solid var(--border);border-radius:6px;text-align:center"><div class="fs-10-light" data-i18n="titerLatestStatus"></div><div class="mt-4">' + validityBadge + '</div></div>';
}

function initTiterFull(){
 
 try{
 
 const cats =[i18n('titerCategoryAll'), i18n('titerCategoryAcidBase'), i18n('titerCategoryRedox'), i18n('titerCategoryPrecip'), i18n('titerCategoryComplex'), i18n('titerCategoryNonAq'), i18n('titerCategoryMoisture'), i18n('titerCategoryElectrode')];
 const pillsEl = document.getElementById('titer-cat-pills');
 if(pillsEl && !pillsEl.innerHTML){
 pillsEl.innerHTML = cats.map((c, i) => '<button type="button" class="pill' +(i === 0 ? ' active' : '') + '" aria-pressed="' +(i === 0 ? 'true' : 'false') + '" data-cat="' + c + '" onclick="filterTiterCategory(\'' + c + '\')" style="display:inline-block;padding:3px 10px;margin:2px;border-radius:12px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--text)">' + c + '</button>').join('');
}
} catch(e){ console.error('[titer pills]', e);}
 try{ renderTiterMethodOptions(i18n('titerCategoryAll'));} catch(e){ console.error('[titer methods]', e);} /* v54.274 fix (i18n #1): 硬编码 '全部' → i18n('titerCategoryAll')，EN 模式之前 filterCat='全部' ≠ 'All' 导致所有 method 被过滤 → 下拉空 */
 try{ renderTiterRecent();} catch(e){ console.error('[titer recent]', e);}
 try{ renderTiterTrend();} catch(e){ console.error('[titer trend]', e);}
 try{ renderTiterStatCards();} catch(e){ console.error('[titer statCards]', e);}
}
document.addEventListener('DOMContentLoaded',() =>{
 try{ initTiterFull();} catch(e){ console.error('[init] initTiterFull', e);}
});
function saveTiterDefaults(){
 const v ={
 rsd: parseFloat(document.getElementById('titer-default-rsd').value) || TITER_DEFAULTS.rsd,
 flow: parseFloat(document.getElementById('titer-default-flow').value) || TITER_DEFAULTS.flow,
 fhigh: parseFloat(document.getElementById('titer-default-fhigh').value) || TITER_DEFAULTS.fhigh,
 n: parseInt(document.getElementById('titer-default-n').value) || TITER_DEFAULTS.n,
};
 _saveJson('rsd-titer-defaults', v);
}
function resetTiterDefaults(){
 _saveJson('rsd-titer-defaults', TITER_DEFAULTS);
 if(typeof renderSettingsPage === 'function') renderSettingsPage();
}

async function factoryReset(){
 // v54.239 fix: okText 硬编码中文 → i18n
 const ok1 = await _confirmDialog(i18n('factoryResetConfirm'),{ okText: i18n('btnContinue'), danger: true});
 if(!ok1) return;
 const ok2 = await _confirmDialog(i18n('factoryResetSecondConfirm'),{ okText: i18n('btnConfirmClear'), danger: true});
 if(!ok2) return;
 // v54.231 撤销窗口 (C#9)：先 snapshot 再删除，提供 5 秒撤销（取消 reload）
 const prefix = 'rsd-';
 const oldSnap = {};
 try {
   const allKeys = Object.keys(localStorage);
   for (let i = 0; i < allKeys.length; i++) {
     const k = allKeys[i];
     if (k.startsWith(prefix)) oldSnap[k] = localStorage.getItem(k);
   }
 } catch (_) {}
 // 立即应用清除
 Object.keys(localStorage).filter(k => k.startsWith('rsd-')).forEach(k => localStorage.removeItem(k));

 try{
 if(typeof titerData !== 'undefined' && Array.isArray(titerData)) titerData.length = 0;
['titer-vs', 'titer-v0s', 'titer-ms', 'titer-ps', 'titer-f', 'titer-t'].forEach(id =>{ const el = document.getElementById(id); if(el) el.value = '';});
 _titerUndoStack.length = 0;
 _titerRecent =[];
  // v54.239 fix: 重置 flag，防止下次 factoryReset 不撤销时仍看到 flag=true silently undo
  window._factoryResetUndone = false;
  _setLoginState(null);
} catch(e){ console.error('[factoryReset]', e);}
 // v54.246 fix: localStorage 已清，但 _historyCache 内存中仍保留旧数据 → 5s reload 前任何 getH() 调用会返回陈旧数据
 // 显式置 null 强制下次 getH() 重新 parse（此时 localStorage 已空，parse 结果为 []）
 try { _historyCache = null; } catch (_) {}
 try { _dateCountsCache = null; } catch (_) {}
 try { _extractChartDataCache = { sig: '', data: null }; } catch (_) {}  // v54.250: 同步失效 chart 缓存（factoryReset 清空历史）
 _setSyncStatus(i18n('factoryResetDone'));
 // 显示撤销 toast（5 秒窗口），点击则把 oldSnap 写回 localStorage 并取消 reload
 _showFactoryResetUndoToast(oldSnap, 5000);
 // 5 秒后强制 reload（不撤销则丢失）
 setTimeout(() => {
   // v54.231 撤销检测 (C#9)：用户在 toast 点击"撤销"会设置 window._factoryResetUndone = true
   try { localStorage.removeItem('rsd-last-factoryreset-undo'); } catch (_) {}
   if (window._factoryResetUndone) return; // 已撤销，不 reload
   location.reload();
 }, 5000);
}

function saveBackupInterval(){
 const v = parseInt(document.getElementById('backup-interval-input').value) || 14;
 localStorage.setItem('rsd-backup-interval', String(v));
 if(typeof renderSettingsPage === 'function') renderSettingsPage();
}
function checkBackupReminder(){
 const days = parseInt(localStorage.getItem('rsd-backup-interval') || '14');
 const last = parseInt(localStorage.getItem('rsd-last-backup') || '0');
 const statusEl = document.getElementById('backup-reminder-status');
 if(!statusEl) return;
 if(!last){ statusEl.textContent = i18n('backupNever'); statusEl.style.color = _cssVar('--danger'); return;}
 const elapsedDays = Math.floor((Date.now() - last) / 86400000);
 if(elapsedDays >= days){ statusEl.textContent = i18n('backupOverdueFmt').replace('{0}', elapsedDays).replace('{1}', days); statusEl.style.color = _cssVar('--danger'); _setSyncStatus(i18n('backupOverdueAction'));}
 else{ statusEl.textContent = i18n('backupOkFmt').replace('{0}', elapsedDays).replace('{1}', days); statusEl.style.color = 'var(--text-light)';}
}

(function _extendRenderSettingsPage(){
 const _orig = renderSettingsPage;
 renderSettingsPage = function(){
 try{ _orig();} catch(e){}
 const td = loadTiterDefaults();
 function s(id, val){ const el = document.getElementById(id); if(el) el.value = val;}
 s('titer-default-rsd', td.rsd);
 s('titer-default-flow', td.flow);
 s('titer-default-fhigh', td.fhigh);
 s('titer-default-n', td.n);
 s('backup-interval-input', parseInt(localStorage.getItem('rsd-backup-interval') || '14'));
 const lastTs = parseInt(localStorage.getItem('rsd-last-backup') || '0');
 const lastEl = document.getElementById('backup-last-time');
 if(lastEl) lastEl.textContent = lastTs ? i18n('backupLastFmt').replace('{0}', _formatTs(lastTs)) : i18n('backupNeverShort');
 checkBackupReminder();
};
})();




function _getConnQuality(){
 const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
 if(!c) return{ type: 'unknown', rtt: -1, downlink: -1};
 return{ type: c.effectiveType || 'unknown', rtt: c.rtt != null ? c.rtt : -1, downlink: c.downlink != null ? c.downlink : -1};
}
function _isPoorConnection(){
 const q = _getConnQuality();
 return q.type === 'slow-2g' || q.type === '2g' ||(q.rtt >= 500 && q.rtt > 0);
}



let _connPrevPoor = null;
let _connListenerSetup = false;
function _weakNetToastPrefix() {
  // v54.271: 按当前语言取 prefix（EN 模式下仍能 dismiss）—— 用 first '(' / '（' 切（避免 regex 字面 { } 破坏 brace count 测试）
  var s = i18n('toast_networkWeakPdfDegrade');
  var cut = s.indexOf('（'); if (cut < 0) cut = s.indexOf('(');
  if (cut > 0) s = s.substring(0, cut);
  return 'warn:' + s.trim();
}
// v54.228 fix: 移除 `window.confirm = function(msg){ return _confirmDialog(msg);};` override
// 原因：override 让所有 window.confirm(...) 调用返回 Promise，但 3 个调用点 (mpSaveRecipe/mpImportRecipeCSV/syncAllReal) 把返回值当 boolean 用，导致静默绕过覆盖/重复提示
// 修复：3 个调用点都改用 `await _confirmDialog(...)`，原生 window.confirm 行为保持不变

function emptyState(icon, text, hint, actionHtml){
 return '<div class="empty-state">'
 + '<div class="empty-state-icon">' +(icon || '📭') + '</div>'
 + '<div class="empty-state-text">' +(text || i18n('cvNoData')) + '</div>'
 +(hint ? '<div class="empty-state-hint">' + hint + '</div>' : '')
 +(actionHtml || '')
 + '</div>';
}

function _shortcutSave(){
 const cur = document.querySelector('.page.active');
 if(!cur) return;
 const id = cur.id;
 let fn = null;
 if(id === 'page-stats') fn = 'saveStatsHistory';
 else if(id === 'page-recovery') fn = _currentRecoveryFn('save');
 else if(id === 'page-special') fn = _currentSpecialFn('save');
 else if(id === 'page-history') fn = null;
 
 
 
 
 
 
 if(fn && typeof window[fn] === 'function'){
 const ok = window[fn]();
 if(ok === false) return; 
 _i18nToast('toast_saved', 'success');
}
 else _i18nToast('toast_noSaveableContent', 'info');
}
function _shortcutCalc(){
 const cur = document.querySelector('.page.active');
 if(!cur) return;
 const id = cur.id;
 let fn = null;
 if(id === 'page-stats') fn = 'calcStats';
 else if(id === 'page-recovery') fn = _currentRecoveryFn('calc');
 else if(id === 'page-special') fn = _currentSpecialFn('calc');
 
 
 
 
 else if(id === 'page-calc') fn = 'calcEval';
 else if(id === 'page-mobile') fn = 'autoCalc';
 if(fn && typeof window[fn] === 'function') window[fn]();
 else if(id === 'page-stats') calcStats(); 
 else _i18nToast('toast_noCalcOnPage', 'info');
}
function _shortcutSearch(){
 
 
 
 
 
 
 const cur = document.querySelector('.page.active');
 const pageMap ={
 'page-special': 'titer-search',
 'page-calc': 'calc-input',
 'page-settings': 'settings-sample-name',
};
 const targetId = pageMap[cur?.id] || null;
 if(targetId){
 const el = document.getElementById(targetId);
 
 if(el && cur.contains(el)){
 el.focus();
 _i18nToast('toast_searchFocusedFmt', 'info', 1500, el.placeholder || targetId);
 return;
}
}
 _i18nToast('toast_noSearchBox', 'info');
}
function _currentRecoveryFn(action){
 const active = document.querySelector('#page-recovery .subtab.active');
 const tab = active ? active.getAttribute('onclick').match(/'([^']+)'/)?.[1] : null;
  if (!tab) return null;
  // v54.47 修复：原简易版只映射 save→saveRecoveryHistory，calc 永远返回 null
  //   实证：page-recovery 任何 subtab 按 Ctrl+Enter → _currentRecoveryFn('calc') 返 null
  //     → _shortcutCalc toast '当前页面无对应计算'（误导！实际有 calcNormalize/calcExternal/calcInternal/calcSimple）
  //   修复：补全 calc 映射（参照 _currentSpecialFn map 模式）
  const map = {
    normalize: { save: 'saveRecoveryHistory', calc: 'calcNormalize' },
    external:  { save: 'saveRecoveryHistory', calc: 'calcExternal' },
    internal:  { save: 'saveRecoveryHistory', calc: 'calcInternal' },
    simple:    { save: 'saveRecoveryHistory', calc: 'calcSimple' },
  };
  return (map[tab] || {})[action];
}
function _currentSpecialFn(action) {
  // v54.229 fix: 原 `#page-special.subtab.active` 漏 space → 永远 null → Ctrl+Enter 在 special tab (drying/residue) 永远误报"本页无计算"
  const active = document.querySelector('#page-special .subtab.active');
  const tab = active ? active.getAttribute('onclick').match(/'([^']+)'/)?.[1] : null;
 if(!tab) return null;
 
 const map ={
 drying:{ save: 'saveDryingHistory', calc: 'calcDrying'},
 content:{ save: 'saveContentHistory', calc: null},
 residue:{ save: 'saveResidueHistory', calc: null},
 titer:{ save: 'saveTiterHistory', calc: null},
 mw:{ save: 'saveMwHistory', calc: 'calcMw'},
 uniformity:{ save: 'saveUniformityHistory', calc: null},
 dissolution:{ save: 'saveDissolutionHistory', calc: null},
 curve:{ save: 'saveCurveHistory', calc: 'calcCurve'},
 spike:{ save: 'saveSpikeRecoveryHistory', calc: 'calcSpike'},
};
 return(map[tab] ||{})[action];
}
document.addEventListener('keydown', e =>{
 
 if((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's'){ e.preventDefault(); _shortcutSave(); return;}
 
 if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){ e.preventDefault(); _shortcutCalc(); return;}
 
 if(e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)){ e.preventDefault(); _shortcutSearch(); return;}
 
 if(e.key === 'Escape'){
 if(document.getElementById('welcome-overlay')?.style.display !== 'none'){ closeWelcome(); return;}
 if(document.getElementById('login-overlay')?.style.display !== 'none'){ closeLoginModal(); return;}
 if(document.getElementById('migration-overlay')?.style.display !== 'none'){ closeMigrationDialog(); return;}
 
 
 
 
 const topOverlay = Array.from(document.querySelectorAll('.modal-overlay')).find(el => el.style.display !== 'none');
 if(topOverlay){ topOverlay.style.display = 'none'; return;}
 const confirmOv = document.getElementById('confirm-overlay');
 if(confirmOv && confirmOv.style.display !== 'none'){ confirmOv.style.display = 'none'; return;}
}
});

function showWelcomeIfFirstRun(){
 if(localStorage.getItem('rsd-welcomed')) return;
 let ov = document.getElementById('welcome-overlay');
 if(!ov){
 ov = document.createElement('div');
 ov.id = 'welcome-overlay';
 ov.setAttribute('role', 'dialog');
 ov.setAttribute('aria-modal', 'true');
 ov.setAttribute('aria-labelledby', 'welcome-title');
 // v54.251 a11y: aria-describedby 链接到描述文本（subtitle），screen reader 在念完标题后会读描述
 ov.setAttribute('aria-describedby', 'welcome-desc');
 ov.className = 'modal-overlay';
 ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9997;display:flex;align-items:center;justify-content:center';
 ov.innerHTML = '<div style="background:var(--card);padding:28px;border-radius:14px;max-width:480px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,.3)">'
 + '<div style="text-align:center;font-size:42px;margin-bottom:8px">🧪</div>'
 + '<h2 id="welcome-title" style="margin:0 0 4px;font-size:18px;text-align:center" data-i18n="welcomeTitle">欢迎使用 RSD &amp; 含量计算器</h2>'
 + '<p id="welcome-desc" style="font-size:13px;color:var(--text-light);text-align:center;margin:0 0 18px" data-i18n="welcomeSubtitle"></p>'
 + '<div style="font-size:13px;line-height:1.7">'
 + '<div class="mb-10" data-i18n="welcomeStep1"><b>①</b></div>'
 + '<div class="mb-10" data-i18n="welcomeStep2"><b>②</b></div>'
 + '<div data-i18n="welcomeStep3"><b>③</b></div>'
 + '</div>'
 + '<div style="display:flex;gap:8px;margin-top:20px;justify-content:center;flex-wrap:wrap">'
 + '<button class="btn btn-primary btn-sm" onclick="loadDemoData();localStorage.setItem(\'rsd-welcomed\',\'1\');closeWelcome()">' + i18n('loadDemoBtn') + '</button>'
 + '<button class="btn btn-outline btn-sm" data-i18n="welcomeStart" onclick="localStorage.setItem(\'rsd-welcomed\',\'1\');closeWelcome()">开始使用</button>'
 + '</div>'
 + '</div>';
 document.body.appendChild(ov);

 ov.addEventListener('click', e =>{ if(e.target === ov){ localStorage.setItem('rsd-welcomed', '1'); closeWelcome();}});
}
 // v54.230 a11y: 给 welcome overlay 添加 focus trap + Escape 关闭
 _openOverlayWithFocusTrap('welcome-overlay', '[role="dialog"]', closeWelcome);
}
function closeWelcome(){
 const ov = document.getElementById('welcome-overlay');
 if(ov){ ov.style.display = 'none'; if(typeof ov._focusTrapCleanup === 'function') ov._focusTrapCleanup();}
}
function loadDemoData(){
 try{
 const demo =[
{ type: '统计计算', time: _formatNow(), data: '99.2, 99.5, 99.8, 100.1, 99.6, 99.9', mean: 99.68, sd: 0.32, rsd: 0.32},
{ type: '统计计算', time: _formatNow(), data: '100.2, 100.5, 99.8, 100.1, 99.7', mean: 100.06, sd: 0.31, rsd: 0.31},
{ type: '外标含量', time: _formatNow(),
 stdArea: '250000', stdWeight: '50.00', stdPurity: '99.8', stdDilution: '50', stdMoisture: '0.10', stdResidue: '0.05',
 samples:[
{ weight: '50.05', dilution: '50', moisture: '0', residue: '0', parallels:[{ area: '250800'},{ area: '251200'},{ area: '250500'}]},
{ weight: '49.98', dilution: '50', moisture: '0', residue: '0', parallels:[{ area: '250300'},{ area: '249900'},{ area: '250100'}]},
{ weight: '50.10', dilution: '50', moisture: '0', residue: '0', parallels:[{ area: '251500'},{ area: '251000'},{ area: '251800'}]}
]},
{ type: '加样回收率', time: _formatNow(), original: 100, limitLow: 80, limitHigh: 115, rsdLimit: 8, mean: 100.06, sd: 2.238, rsd: 2.24, verdict: i18n('passOk')},
{ type: '滴定度', time: _formatNow(), method: 'naoh', titerName: '氢氧化钠滴定液 NaOH', f: '1.005', T: '0.9988', calibratedAt: Date.now() - 5*86400000},
];
 const cur =(() =>{ try{ return JSON.parse(localStorage.getItem('rsd-calc-history') || '[]') ||[];} catch(e){ return[];}})();
 localStorage.setItem('rsd-calc-history', JSON.stringify(demo.concat(cur)));
 _historyCache = null;  // v54.234: 失效缓存，让下次 getH 重新 parse
 setReportMeta && setReportMeta({ sampleName: '阿司匹林', batch: '20260816-A', operator: '示例操作员'});
 _i18nToast('toast_sampleDataLoaded', 'success', 2500);
 if(typeof renderFilteredList === 'function') renderFilteredList();
} catch(e){ _i18nToast('toast_sampleLoadFailFmt', 'error', null, e.message);}
}
document.addEventListener('DOMContentLoaded',() =>{ try{ setTimeout(showWelcomeIfFirstRun, 600);} catch(e){ console.error('[init] showWelcome', e);}});

function _applyHashRoute(){
 if(typeof location === 'undefined' || !location.hash || location.hash.length < 2) return;
 const h = location.hash.slice(1); 
 if(!h) return;
 
 if(h.startsWith('special/')){
 const method = h.slice('special/'.length);
 if(typeof switchTab === 'function') switchTab('special');
 if(typeof switchSpecial === 'function'){
 setTimeout(() =>{ try{ switchSpecial(method);} catch(e){ console.error('[hash]', e);}}, 100);
}
 return;
}
 
 const validTabs =['stats','recovery','special','calc','mobile','history','settings'];
 if(validTabs.indexOf(h) >= 0 && typeof switchTab === 'function'){
 switchTab(h);
}
}
document.addEventListener('DOMContentLoaded',() =>{ try{ setTimeout(_applyHashRoute, 50);} catch(e){ console.error('[init] _applyHashRoute', e);}});

// v54.255 dev aid: 静态分析检查（inverted guards + addH return-check）
document.addEventListener('DOMContentLoaded',() =>{ try{ if(typeof _checkNoInvertedGuards === 'function') _checkNoInvertedGuards();} catch(e){ /* dev only */ }});
document.addEventListener('DOMContentLoaded',() =>{ try{ if(typeof _checkAddHReturnChecked === 'function') setTimeout(_checkAddHReturnChecked, 100);} catch(e){ /* dev only */ }});


function cycleFontSize(){
 const cur = localStorage.getItem('rsd-font-size') || 'medium';
 const next = cur === 'small' ? 'medium' : cur === 'medium' ? 'large' : 'small';
 if(typeof setFontSize === 'function') setFontSize(next);
 const btn = document.getElementById('header-font-btn');
 if(btn){
 // v54.236 fix: 用 i18n key 替代硬编码中文 + 加 null guard 防 span 缺失抛错
 const span = btn.querySelector('span');
 const key = next === 'small' ? 'fontBtnSmall' : next === 'medium' ? 'fontBtnMedium' : 'fontBtnLarge';
 if(span) span.textContent = i18n(key);
 }
}

/* v54.289 btn-success 反馈：异步操作成功后短暂显示绿色 ✓ + 浅绿背景
   用法：await fetch(...); flashBtnSuccess(btnEl); 默认 600ms 自动还原 */
function flashBtnSuccess(btn, ms){
 if(!btn) return;
 btn.classList.remove('btn-loading');
 btn.classList.add('btn-success');
 setTimeout(() => { btn.classList.remove('btn-success'); }, ms || 600);
}

/* v54.290 dark-mode charts：按当前 data-theme 返回适配的 scales 配置。
   light mode 用原色，dark mode 用半透明白 grid + 浅色 ticks。 */
function _getChartScales(suggestedMin, suggestedMax){
 var dark = document.documentElement.getAttribute('data-theme') === 'dark';
 return {
 x: {
 type: 'category',
 ticks: { maxRotation: 45, font: { size: 10 }, maxTicksLimit: 12, color: dark ? '#cbd5e1' : '#64748b' },
 grid: { display: false }
 },
 y: {
 suggestedMin: suggestedMin,
 suggestedMax: suggestedMax,
 ticks: { font: { size: 10 }, color: dark ? '#cbd5e1' : '#64748b', callback: function(v){ return v.toPrecision(4); } },
 grid: { color: dark ? 'rgba(255,255,255,0.08)' : '#f1f5f9' }
 }
 };
}

/* v54.292 键盘快捷键面板：按 ? 键弹出，列出快捷键 + Esc 关闭 */
function showShortcuts(){
 const ov = document.getElementById('shortcuts-overlay');
 if(ov && typeof _openOverlayWithFocusTrap === 'function'){
 _openOverlayWithFocusTrap('shortcuts-overlay', '#shortcuts-dialog', hideShortcuts);
 } else if(ov){ ov.style.display = 'flex'; }
}
function hideShortcuts(){
 const ov = document.getElementById('shortcuts-overlay');
 if(ov){
 ov.style.display = 'none';
 if(typeof ov._focusTrapCleanup === 'function') ov._focusTrapCleanup();
 }
}

/* v54.292 顶层 keydown 监听：? 键（Shift+/）弹快捷键面板 */
document.addEventListener('keydown', function(e){
 // 在输入框/textarea 中不触发快捷键
 if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
 if(e.key === '?' || (e.shiftKey && e.key === '/')){
 e.preventDefault();
 const ov = document.getElementById('shortcuts-overlay');
 if(ov && ov.style.display !== 'none') hideShortcuts(); else showShortcuts();
 }
});

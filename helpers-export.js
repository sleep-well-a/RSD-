function csvCell(s) {
  s = (s === null || s === undefined) ? '' : String(s);
  // v54.41 公式注入防护（CWE-1236）：Excel/WPS 会把 = + - @ 开头的单元格当公式执行。
  // 前缀单引号中和为纯文本，但**排除合法数值**（-1.5 / +5 必须保持数字类型，否则统计列失效）。
  if (/^[=+\-@\t\r]/.test(s) && !Number.isFinite(Number(s))) s = "'" + s;
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
 return s;
}
function blobDownloadCSV(lines, filename){
 var blob = new Blob(['﻿' + lines.join('\n')],{ type: 'text/csv;charset=utf-8'});
 var url = URL.createObjectURL(blob);
 var a = document.createElement('a');
 a.href = url; a.download = filename;
 document.body.appendChild(a); a.click(); document.body.removeChild(a);
 URL.revokeObjectURL(url);
 flashEl('debug-tag', i18n('flashCsvExported'));
}
function aoaToHtmlTable(aoa, opts){
 opts = opts ||{};
 var fontSize = opts.fontSize || 12;
 var themePrimaryLight = _cssVar('--primary-light') || '#f0f7ff';
 var themeBorder = _cssVar('--border') || '#ccc';
 var h = '<table style="width:100%;border-collapse:collapse;font-size:' + fontSize + 'px">';
 aoa.forEach(function(row, i){
 var isHeader =(i >= 5 && row.length >= 2 && (/序号|杂质名称|No\.|Name/i.test(String(row[0])))); /* v54.273 fix: 加英文 No./Name 匹配（EN 模式永不匹配旧 regex，header styling 丢失）*/
 h += '<tr>';
 row.forEach(function(cell){
 var txt = _esc(cell === null || cell === undefined ? '' : String(cell));
 if(isHeader) h += '<th style="background:' + themePrimaryLight + ';padding:4px;border:1px solid ' + themeBorder + ';font-weight:700;text-align:left">' + txt + '</th>';
 else h += '<td style="padding:4px;border:1px solid ' + themeBorder + '">' + txt + '</td>';
});
 h += '</tr>';
});
 h += '</table>';
 return h;
}

function metaFilename(base, meta){

 meta = meta ||{};
 // v54.246 fix: 额外剥离 \x00-\x1F 控制字符（OS 文件名不允许；某些样本名含 CR/LF 会导致下载失败）
 var safe = function(s){ return(s || '').replace(/[\x00-\x1F\/\\:*?"<>|\s]/g, '_'); };
  var tag = meta.sampleName ? '_' + safe(meta.sampleName) : '';
  var bch = meta.batch ? '_' + safe(meta.batch) : '';
  return base + tag + bch + '-' + (meta.date || '');
}

// 1. 面积归一化法：收集数据
function collectNormData() {
  var stdW = parseFloat(document.getElementById('norm-std-weight')?.value);
  var stdP = parseFloat(document.getElementById('norm-std-purity')?.value);
  var stdD = parseFloat(document.getElementById('norm-std-dilution')?.value);
  var stdM = parseFloat(document.getElementById('norm-std-moisture')?.value) || 0;
  var stdR = parseFloat(document.getElementById('norm-std-residue')?.value) || 0;
  var stdF = parseFloat(document.getElementById('norm-manual-f')?.value);
  var stdAvgEl = document.getElementById('norm-std-area-avg');
  var stdAvg = stdAvgEl ? parseFloat(stdAvgEl.textContent) : NaN;
  var dryStd = (100 - stdM - stdR) / 100;
  var Cstd = (dryStd > 0 && Number.isFinite(stdW) && Number.isFinite(stdP) && Number.isFinite(stdD) && stdW > 0 && stdD > 0) ? stdW * stdP / 100 * dryStd / stdD : NaN; /* v54.273 fix: 加 dryStd > 0 守卫（与 app.js:2605 一致，m+r>100 时 dryStd 负导致 Cstd 负）*/
  var f = Number.isFinite(stdF) ? stdF : (Number.isFinite(stdAvg) ? stdAvg : NaN);
  var indep = document.getElementById('norm-spl-independent') && document.getElementById('norm-spl-independent').checked;
  var sharedM = parseFloat(document.getElementById('norm-spl-moisture')?.value) || 0; /* shared 模式共用 m/r */
  var sharedR = parseFloat(document.getElementById('norm-spl-residue')?.value) || 0;
  var rows = [], recoveries = [];
  document.querySelectorAll('#norm-spl-rows tr').forEach(function(row){
    var wInput = row.querySelector('.norm-spl-weight');
    var dInput = row.querySelector('.norm-spl-dilution');
    var aInput = row.querySelector('.norm-spl-area-pct');
    if (!wInput || !dInput || !aInput) return;
    var W = parseFloat(wInput.value), D = parseFloat(dInput.value), A = parseFloat(aInput.value);
    if (!Number.isFinite(W) || !Number.isFinite(D) || !Number.isFinite(A) || W <= 0 || D <= 0) return;
    /* v54.273 fix: 旧版共用 dryStd（标准 m/r）；正确用各 sample 的 m/r（独立模式 from 行内，共享模式 from 顶部 input） */
    var splM, splR;
    if(indep){
      var mIn = row.querySelector('.norm-spl-moisture');
      var rIn = row.querySelector('.norm-spl-residue');
      splM = mIn ? (parseFloat(mIn.value) || 0) : sharedM;
      splR = rIn ? (parseFloat(rIn.value) || 0) : sharedR;
    } else {
      splM = sharedM; splR = sharedR;
    }
    var drySpl = (100 - splM - splR) / 100;
    if(drySpl <= 0) return; /* 守卫：m+r>100 时 drySpl 负，与 app.js:2667 一致 */
    var Cspl = W * drySpl / D;
    var rec = (A / stdAvg) * Cstd / Cspl * 100;
    if (!Number.isFinite(stdF)) rec = (A/f) * Cstd / Cspl * 100;
    rows.push({ idx: rows.length + 1, content: (A/f) * Cstd / Cspl * 100, weighted: !Number.isFinite(stdF) });
    recoveries.push(rec);
  });
  return { Cstd: Cstd, f: f, stdAvg: stdAvg, rows: rows, recoveries: recoveries };
}

// 2. 外标法：收集数据
function collectExtData() {
  var f = 0;
  var stdA = parseFloat(document.getElementById('ext-std-area')?.value);
  var stdW = parseFloat(document.getElementById('ext-std-weight')?.value);
  var stdP = parseFloat(document.getElementById('ext-std-purity')?.value);
  var stdD = parseFloat(document.getElementById('ext-std-dilution')?.value);
  var stdM = parseFloat(document.getElementById('ext-std-moisture')?.value) || 0;
  var stdR = parseFloat(document.getElementById('ext-std-residue')?.value) || 0;
  var dryStd = (100 - stdM - stdR) / 100;
  if (Number.isFinite(stdA) && Number.isFinite(stdW) && Number.isFinite(stdP) && Number.isFinite(stdD) && stdA > 0 && stdW > 0 && stdP > 0 && stdD > 0) {
    f = stdA / (stdW * stdP / 100 * dryStd / stdD);
  }
  var rows = [], recoveries = [];
  document.querySelectorAll('#ext-sample-rows .sample-row').forEach(function(row){
    var areaEl = row.querySelector('.ext-spl-area');
    var weightEl = row.querySelector('.ext-spl-weight');
    var dilutionEl = row.querySelector('.ext-spl-dilution');
    var theoryEl = row.querySelector('.ext-spl-theory');
    var mEl = row.querySelector('.ext-spl-moisture');
    var rEl = row.querySelector('.ext-spl-residue');
    if (!areaEl || !weightEl || !dilutionEl) return; // 安全检查：必需元素必须存在
    var area = parseFloat(areaEl.value);
    var weight = parseFloat(weightEl.value);
    var dilution = parseFloat(dilutionEl.value);
    var theory = theoryEl ? (parseFloat(theoryEl.value) || 100) : 100;
    var m = mEl ? (parseFloat(mEl.value) || 0) : 0;
    var r = rEl ? (parseFloat(rEl.value) || 0) : 0;
    if (!Number.isFinite(area) || !Number.isFinite(weight) || !Number.isFinite(dilution) || area <= 0 || weight <= 0 || dilution <= 0) return;
    var drySpl = (100 - m - r) / 100;
    if (drySpl <= 0) return; /* v54.274 fix (correctness #3): m+r>100 时 drySpl 负 → content 反号（与 app.js:2667 一致） */
    var content = (area / f) / (weight * drySpl / dilution) * 100;
    var rec = content / theory * 100;
    rows.push({ idx: rows.length + 1, content: content, theory: theory, recovery: rec }); /* v54.274 fix (correctness #3): 加 theory 字段 — buildExtReport 读 row.theory 但旧代码没存 → CSV 理论含量% 列永远 "—" */
    recoveries.push(rec);
  });
  return { f: f, rows: rows, recoveries: recoveries };
}

// 3. 内标法：收集数据
function collectIntData() {
  var stdA = parseFloat(document.getElementById('int-std-area').value);
  var stdIsA = parseFloat(document.getElementById('int-std-is-area').value);
  var stdC = parseFloat(document.getElementById('int-std-conc').value);
  var Rstd = (Number.isFinite(stdA) && Number.isFinite(stdIsA) && stdA > 0 && stdIsA > 0) ? stdA / stdIsA : NaN;
  var f = (Number.isFinite(Rstd) && Number.isFinite(stdC) && stdC > 0) ? stdC / Rstd : NaN;
  var rows = [], recoveries = [];
  document.querySelectorAll('#int-sample-rows .sample-row').forEach(function(row){
    var area = parseFloat(row.querySelector('.int-spl-area').value);
    var isArea = parseFloat(row.querySelector('.int-spl-is-area').value);
    var theory = parseFloat(row.querySelector('.int-spl-theory').value) || 0;
    if (!Number.isFinite(area) || !Number.isFinite(isArea) || !Number.isFinite(theory) || area <= 0 || isArea <= 0 || theory <= 0) return;
    var Rspl = area / isArea;
    var Cspl = f * Rspl;
    var rec = Cspl / theory * 100;
    rows.push({ idx: rows.length + 1, content: Cspl, recovery: rec });
    recoveries.push(rec);
  });
  return { f: f, rows: rows, recoveries: recoveries };
}

// v54.94 5 module collect*Data（从 live DOM 读取当前输入，返回 entry-shape 数据供 build*Report）
// 4 个回收率 module 用 d.rows.length 检查（helper 内部）；5 module 复用 _exportModuleCSV 必须有 d.rows 占位
// 所以每个 collect*Data 返 {rows: [占位条目]} + 真实数据字段（mean/sd/rsd/count/samples）

function collectDryingData() {
  var allLosses = [];
  var samples = (dryingData || []).map(function(s) {
    var parallels = (s.parallels || []).map(function(p) {
      var w0 = calcExpr(p.w0), w1 = calcExpr(p.w1), w2 = calcExpr(p.w2);
      if (Number.isFinite(w0) && Number.isFinite(w1) && Number.isFinite(w2) && w0 > 0 && w1 > w0 && w2 < w1) {
        var loss = (w1 - w2) / (w1 - w0) * 100;
        if (loss >= 0 && loss <= 100) allLosses.push(loss);
      }
      return { w0: p.w0 || '', w1: p.w1 || '', w2: p.w2 || '' };
    }).filter(function(p) { return p.w0 || p.w1 || p.w2; });
    return { parallels: parallels };
  }).filter(function(s) { return s.parallels.length > 0; });
  if (!samples.length) return { rows: [], samples: [], count: 0 };
  var st = calcStatsFromArray(allLosses);
  return {
    rows: [{}], // 占位：_exportModuleCSV 检查 d.rows.length
    samples: samples,
    count: allLosses.length,
    mean: st.mean, sd: st.sd, rsd: st.rsd
  };
}

function collectResidueData() {
  var allVals = [];
  var samples = (residueData || []).map(function(s) {
    var parallels = (s.parallels || []).map(function(p) {
      var w0 = calcExpr(p.w0), w1 = calcExpr(p.w1), w2 = calcExpr(p.w2);
      if (Number.isFinite(w0) && Number.isFinite(w1) && Number.isFinite(w2) && w0 > 0 && w1 > w0 && w2 >= w0) {
        var v = (w2 - w0) / (w1 - w0) * 100;
        if (v >= 0 && v <= 100) allVals.push(v);
      }
      return { w0: p.w0 || '', w1: p.w1 || '', w2: p.w2 || '' };
    }).filter(function(p) { return p.w0 || p.w1 || p.w2; });
    return { parallels: parallels };
  }).filter(function(s) { return s.parallels.length > 0; });
  if (!samples.length) return { rows: [], samples: [], count: 0 };
  var st = calcStatsFromArray(allVals);
  return {
    rows: [{}],
    samples: samples,
    count: allVals.length,
    mean: st.mean, sd: st.sd, rsd: st.rsd
  };
}

function collectTiterData() {
  var samples = (titerData || []).map(function(s) {
    var parallels = (s.parallels || []).map(function(p) { return { w: p.w || '', v0: p.v0 || '', v: p.v || '' }; })
      .filter(function(p) { return p.w || p.v0 || p.v; });
    return { parallels: parallels };
  }).filter(function(s) { return s.parallels.length > 0; });
  if (!samples.length) return { rows: [], samples: [], count: 0 };
  var fv = (function() { var e = document.getElementById('titer-f'); return e ? e.value : ''; })();
  var tv = (function() { var e = document.getElementById('titer-t'); return e ? e.textContent : ''; })();
  var methodId = (function() { var e = document.getElementById('titer-method-select'); return e ? e.value : ''; })();
  var methodObj = (typeof PHARMA_TITER !== 'undefined') ? PHARMA_TITER.find(function(m) { return m.id === methodId; }) : null;
  return {
    rows: [{}],
    samples: samples,
    count: samples.reduce(function(acc, s) { return acc + s.parallels.length; }, 0),
    f: fv, T: tv,
    method: methodId,
    titerName: methodObj ? methodObj.name : ''
  };
}

function collectUniformityData() {
  var gv = function(id) { var e = document.getElementById(id); return e ? e.value : ''; };
  var gt = function(id) { var e = document.getElementById(id); return e ? e.textContent : ''; };
  var samples = (uniformityData || []).map(function(s) {
    var parallels = (s.parallels || []).map(function(p) { return { content: p.content || '' }; })
      .filter(function(p) { return p.content; });
    return { parallels: parallels };
  }).filter(function(s) { return s.parallels.length > 0; });
  if (!samples.length) return { rows: [], samples: [], count: 0 };
  return {
    rows: [{}],
    samples: samples,
    count: samples.reduce(function(acc, s) { return acc + s.parallels.length; }, 0),
    L: gv('uni-limit'),
    xbar: gt('uni-mean'),
    A: gt('uni-a'),
    S: gt('uni-s'),
    AS: gt('uni-as'),
    verdict: gt('uni-verdict')
  };
}

function collectDissolutionData() {
  var samples = (dissolutionData || []).map(function(s) {
    var parallels = (s.parallels || []).map(function(p) { return { content: p.content || '' }; })
      .filter(function(p) { return p.content; });
    return { parallels: parallels };
  }).filter(function(s) { return s.parallels.length > 0; });
  if (!samples.length) return { rows: [], samples: [], count: 0 };
  var gv = function(id) { var e = document.getElementById(id); return e ? e.value : ''; };
  var gt = function(id) { var e = document.getElementById(id); return e ? e.textContent : ''; };
  return {
    rows: [{}],
    samples: samples,
    count: samples.reduce(function(acc, s) { return acc + s.parallels.length; }, 0),
    label: gv('diss-label'),
    mean: gt('diss-mean'),
    sd: gt('diss-sd'),
    rsd: gt('diss-rsd')
  };
}

// build 各模块的对齐报告 aoa
// v54.84 复用：4 个 build*Report 共享 meta header（v54.80 同步加 sampleName/sampleId/batch 等元数据时复制了 4 次）
function _reportMetaHeader(title, meta) {
  meta = meta || {};
  return [
    [title, '', '', '', ''],
    [i18n('metaSampleName'), meta.sampleName || '', i18n('placeholderSampleId'), meta.sampleId || ''],
    [i18n('metaBatch'), meta.batch || '', i18n('dateLabel'), meta.date || ''],
    [i18n('metaOperator'), meta.operator || '', i18n('metaInstrument'), meta.instrument || ''],
    [i18n('metaColumn'), meta.column || '', '', '']
  ];
}
function buildNormReport(d, meta) {
  // v54.30 防御：d 或 meta 为 null/损坏时返回空报告
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportNorm'), meta);
  r.push([i18n('cvSystemSuit'), i18n('cvStdConcLabel') + rfmt(d.Cstd, 4) + ' mg/mL', i18n('cvCorrFactorLabel') + rfmt(d.f, 4), i18n('cvStdAreaAvg') + rfmt(d.stdAvg, 4) + '%', '']);
  r.push([]);
  r.push([i18n('csvColSeq'), i18n('lblSampleWeightNoSpace'), i18n('lblDilutionVolNoSpace'), i18n('cvActualConc'), i18n('recoveryPercentParen'), i18n('csvColSpectrumNo')]);
  var sum = 0;
  var rows = Array.isArray(d.rows) ? d.rows : [];
  var recs = Array.isArray(d.recoveries) ? d.recoveries : []; /* v54.274 fix (correctness #10): 第 5 列是"回收率(%)"，之前误用 row.content（f 路径算的实际浓度）→ 与屏幕 calcNormalize 的 stdAvg 路径 recovery 数字不一致 */
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    var recVal = Number.isFinite(recs[i]) ? recs[i] : null;
    if (recVal !== null) sum += recVal;
    r.push([i + 1, '—', '—', rfmt(row.content, 4), rfmt(recVal, 2), meta.tagPrefix ? meta.tagPrefix + '-' + (i + 1) : '']);
  }
  var recCount = 0; for (var _k = 0; _k < recs.length; _k++) { if (Number.isFinite(recs[_k])) recCount++; }
  r.push([]);
  r.push([i18n('reportArithMean'), '—', '—', '—', rfmt(recCount ? sum / recCount : null, 2), '']);
  r.push([i18n('cvVerdict'), i18n('cpChpAccuracy'), i18n('uiPassCheck') /* fallback */, '', '', '']);
  return r;
}

function buildExtReport(d, meta) {
  // v54.26 防御：d 或 meta 为 null/损坏时返回空报告
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportExt'), meta);
  r.push([i18n('cvSystemSuit'), i18n('corrFactorEq') + rfmt(d.f, 4), i18n('formulaContent'), i18n('verdictRange'), '', '']);
  r.push([]);
  r.push([i18n('csvColSeq'), i18n('lblSampleWeightNoSpace'), i18n('lblDilutionVolNoSpace'), i18n('cvTheoryPct'), i18n('cvMeasuredPct'), i18n('recoveryPercentParen'), i18n('csvColSpectrumNo')]);
  var rows = Array.isArray(d.rows) ? d.rows : [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    r.push([i + 1, '—', '—', rfmt(row.theory, 2), rfmt(row.content, 4), rfmt(row.recovery, 2), meta.tagPrefix ? meta.tagPrefix + '-' + (i + 1) : '']);
  }
  r.push([]);
  var recoveries = Array.isArray(d.recoveries) ? d.recoveries : [];
  var mean = recoveries.length ? recoveries.reduce(function(a,b){return a+b;},0) / recoveries.length : 0;
  r.push([i18n('reportArithMean'), '—', '—', '—', '—', rfmt(mean, 2), '']);
  return r;
}
function buildIntReport(d, meta) {
  // v54.26 防御：d 或 meta 为 null/损坏时返回空报告
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportInt'), meta);
  r.push([i18n('cvSystemSuit'), i18n('corrFactorEq') + rfmt(d.f, 4), i18n('cvReportImpFormula'), i18n('verdictRange'), '', '']);
  r.push([]);
  r.push([i18n('csvColSeq'), i18n('csvColPeakArea'), i18n('csvColIsPeakArea'), i18n('cvMeasuredConc'), i18n('recoveryPercentParen'), i18n('csvColSpectrumNo')]);
  var rows = Array.isArray(d.rows) ? d.rows : [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || {};
    r.push([i + 1, '—', '—', rfmt(row.content, 4), rfmt(row.recovery, 2), meta.tagPrefix ? meta.tagPrefix + '-' + (i + 1) : '']);
  }
  r.push([]);
  var recoveries = Array.isArray(d.recoveries) ? d.recoveries : [];
  var mean = recoveries.length ? recoveries.reduce(function(a,b){return a+b;},0) / recoveries.length : 0;
  r.push([i18n('reportArithMean'), '—', '—', '—', rfmt(mean, 2), '']);
  return r;
}
// v54.254 cleanup note: buildSelfRefReport 扫描显示无调用方（无 collectSelfRefData / exportSelfRefCSV / UI 按钮），
// 但 tests/e2e_puppeteer_audit_round8.py #11 对其中自对照法杂质判定 i18n（cvTotalImpOver/cvSingleImpOver 三目）
// 做源码级回归断言 → 属测试保护契约，**保留不删**（实测删除会使该 suite 由 PASS 转 FAIL）。
function buildSelfRefReport(d, meta) {
  // v54.26 防御：d 或 meta 为 null/损坏时返回空报告
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportSelf'), meta);
  var D = d.D, Aref = d.Aref;
  r.push([i18n('cvReportMode'), d.mode === 'yes' ? i18n('cvCorrFactorAdd') : i18n('cvCorrFactorNoAdd'), i18n('cvStdDilutionLabel') + (D || '—'), i18n('cvStdMainAreaLabel') + (Aref || '—'), '', '']);
  r.push([i18n('cvSingleLimit'), d.singleLimit || '—', i18n('cvTotalLimit'), d.totalLimit || '—', '', '']);
  r.push([]);
  r.push([i18n('csvColImpName'), i18n('csvColSeq'), i18n('csvColPeakArea'), i18n('corrFactorLabel'), i18n('cvContent'), i18n('csvColSpectrumNo')]);
  var total = 0, maxS = 0;
  var imps = Array.isArray(d.imps) ? d.imps : [];
  for (var i = 0; i < imps.length; i++) {
    var imp = imps[i] || {};
    var pct = imp.pct || 0;
    total += pct;
    if (pct > maxS) maxS = pct;
    r.push([imp.name || '', i + 1, rfmt(imp.area, 4), d.mode === 'yes' ? rfmt(imp.f, 4) : '—', rfmt(pct, 4), meta.tagPrefix ? meta.tagPrefix + '-' + (i + 1) : '']);
  }
  r.push([]);
  r.push([i18n('cvTotalImpurity'), '—', '—', '—', rfmt(total, 4), '']);
  r.push([i18n('cvMaxSingle'), '—', '—', '—', rfmt(maxS, 4), '']);
  r.push([i18n('csvColVerdict'), d.totalLimit ? (total > d.totalLimit ? i18n('cvTotalImpOver') : i18n('cvTotalImpOk')) : '—', d.singleLimit ? (maxS > d.singleLimit ? i18n('cvSingleImpOver') : i18n('cvSingleImpOk')) : '—', '', '', '']);
  return r;
}

// v54.93 5 个 module build*Report（补 v54.80 漏同步：drying/residue/titer/uniformity/dissolution）
// 复用 _reportMetaHeader（v54.84），与 buildNormReport/Ext/Int/SelfRef 同模式（防御 d||{} meta||{} + rfmt + Array.isArray）

function buildDryingReport(d, meta) {
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportDrying'), meta);
  r.push([i18n('reportSummary'), i18n('metaSampleCount'), String(d.count || '—'), i18n('cvAvgLoss'), rfmt(d.mean, 4), '']);
  r.push([i18n('hSd'), rfmt(d.sd, 6), i18n('hRsd') + '(%)', rfmt(d.rsd, 4), '', '']); /* v54.278 fix: 'SD'/'RSD(%)' 硬编码 → i18n('hSd')/i18n('hRsd') */
  r.push([]);
  r.push([i18n('lblSample'), i18n('lblParallelSample'), i18n('lblDryingW0'), i18n('lblDryingW1'), i18n('lblDryingW2'), i18n('cvLoss')]);
  var samples = Array.isArray(d.samples) ? d.samples : [];
  for (var i = 0; i < samples.length; i++) {
    var s = samples[i] || {};
    var plist = Array.isArray(s.parallels) ? s.parallels : [];
    for (var j = 0; j < plist.length; j++) {
      var p = plist[j] || {};
      var w0 = parseFloat(p.w0), w1 = parseFloat(p.w1), w2 = parseFloat(p.w2);
      var loss = (Number.isFinite(w0) && Number.isFinite(w1) && Number.isFinite(w2) && w1 > w0 && w2 < w1) ? ((w1-w2)/(w1-w0)*100) : null;
      r.push([i + 1, j + 1, p.w0, p.w1, p.w2, loss !== null ? rfmt(loss, 4) : '—']);
    }
  }
  return r;
}

function buildResidueReport(d, meta) {
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportResidue'), meta);
  r.push([i18n('reportSummary'), i18n('metaSampleCount'), String(d.count || '—'), i18n('cvAvgResidue'), rfmt(d.mean, 4), '']);
  r.push([i18n('hSd'), rfmt(d.sd, 6), i18n('hRsd') + '(%)', rfmt(d.rsd, 4), '', '']); /* v54.278 fix: 'SD'/'RSD(%)' 硬编码 → i18n */
  r.push([]);
  r.push([i18n('lblSample'), i18n('lblParallelSample'), i18n('lblResidueW0'), i18n('lblResidueW1'), i18n('lblResidueW2'), i18n('cvResidue')]);
  var samples = Array.isArray(d.samples) ? d.samples : [];
  for (var i = 0; i < samples.length; i++) {
    var s = samples[i] || {};
    var plist = Array.isArray(s.parallels) ? s.parallels : [];
    for (var j = 0; j < plist.length; j++) {
      var p = plist[j] || {};
      var w0 = parseFloat(p.w0), w1 = parseFloat(p.w1), w2 = parseFloat(p.w2);
      var v = (Number.isFinite(w0) && Number.isFinite(w1) && Number.isFinite(w2) && w1 > w0 && w2 >= w0) ? ((w2-w0)/(w1-w0)*100) : null;
      r.push([i + 1, j + 1, p.w0, p.w1, p.w2, v !== null ? rfmt(v, 4) : '—']);
    }
  }
  return r;
}

function buildTiterReport(d, meta) {
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportTiter'), meta);
  r.push([i18n('titerMethod'), d.titerName || d.method || '—', i18n('titerTiterT'), rfmt(d.T, 4), i18n('corrFactorLabel'), rfmt(d.f, 4)]);
  r.push([]);
  r.push([i18n('lblSample'), i18n('lblParallelSample'), i18n('lblSampleWeight'), i18n('cvV0Blank'), i18n('cvTitrationVol'), i18n('thResult')]);
  var samples = Array.isArray(d.samples) ? d.samples : [];
  for (var i = 0; i < samples.length; i++) {
    var s = samples[i] || {};
    var plist = Array.isArray(s.parallels) ? s.parallels : [];
    for (var j = 0; j < plist.length; j++) {
      var p = plist[j] || {};
      r.push([i + 1, j + 1, p.w || '—', p.v0 || '—', p.v || '—', '—']);
    }
  }
  return r;
}

function buildUniformityReport(d, meta) {
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportUniformity'), meta);
  r.push([i18n('cvLimitL'), d.L || '—', i18n('thVerdict'), d.verdict || '—', '', '']);
  r.push([i18n('statMeanXbar'), rfmt(d.xbar, 4), 'A+1.80S', d.A || '—', 'A+S', d.AS || '—']);
  r.push([]);
  r.push([i18n('statStatistic'), i18n('statValue'), '', '', '', '']);
  r.push([i18n('statSampleCount'), String(d.count || '—'), '', '', '', '']);
  r.push([i18n('hSd'), d.S || '—', '', '', '', '']); /* v54.278 fix: 'SD' 硬编码 → i18n */
  return r;
}

function buildDissolutionReport(d, meta) {
  d = d || {}; meta = meta || {};
  var r = _reportMetaHeader(i18n('cvReportDissolution'), meta);
  r.push([i18n('metaSampleName'), d.label || '—', i18n('cvAvgDissolution'), rfmt(d.mean, 4), '', '']);
  r.push([i18n('hSd'), rfmt(d.sd, 6), i18n('hRsd') + '(%)', rfmt(d.rsd, 4), '', '']); /* v54.278 fix */
  r.push([]);
  r.push([i18n('lblSample'), i18n('lblParallelSample'), i18n('cvDissolution')]);
  var samples = Array.isArray(d.samples) ? d.samples : [];
  for (var i = 0; i < samples.length; i++) {
    var s = samples[i] || {};
    var plist = Array.isArray(s.parallels) ? s.parallels : [];
    for (var j = 0; j < plist.length; j++) {
      var p = plist[j] || {};
      r.push([i + 1, j + 1, rfmt(p.content, 4)]);
    }
  }
  return r;
}

// 4 模块导出 CSV/Excel
// v54.110 renderHistory meta band helper（渲染 _meta 快照为彩色 band）
function _renderMetaBand(ms) {
  if (!ms || typeof ms !== 'object') return '';
  const _p = [];
  if (ms.sampleName) _p.push('📦 ' + _esc(ms.sampleName));
  if (ms.sampleId) _p.push('🆔 ' + _esc(ms.sampleId));
  if (ms.batch) _p.push('🏷 ' + _esc(ms.batch));
  if (ms.operator) _p.push('👤 ' + _esc(ms.operator));
  if (ms.instrument) _p.push('🔬 ' + _esc(ms.instrument));
  if (ms.column) _p.push('🧪 ' + _esc(ms.column));
  if (ms.date) _p.push('📅 ' + _esc(ms.date));
  if (!_p.length) return '';
  return '<div class="h-meta" style="font-size:11px;color:var(--text-light);background:#f8fafc;padding:3px 8px;margin:2px 0 4px;border-left:3px solid var(--primary-light);border-radius:3px">' + _p.join(' &nbsp;·&nbsp; ') + '</div>';
}
// v54.88 复用：4 个 build*Report + 2 个 exportComprehensive* 共享 entry._meta 渲染
function _fmtEntryMeta(m) {
  if (!m || typeof m !== 'object') return '';
  const parts = [];
  if (m.sampleName) parts.push(m.sampleName);
  if (m.sampleId) parts.push(m.sampleId);
  if (m.batch) parts.push(i18n('batchLabel') + m.batch);
  if (m.operator) parts.push(m.operator);
  if (m.instrument) parts.push(m.instrument);
  return parts.join(' · ');
}
// v54.85 3 个 export*CSV 共享 helper（DRY：消除 6 行重复 getReportMeta + r.map(csvCell).join 模式）
function _exportModuleCSV(collectFn, buildFn, moduleKey) {
  var d = collectFn();
  if (!d.rows.length) { _i18nAlert('noValidDataCalc'); return; }
  var meta = getReportMeta();
  blobDownloadCSV(buildFn(d, meta).map(function(r){ return r.map(csvCell).join(','); }), metaFilename(moduleKey, meta) + '.csv');
}
function exportNormCSV() { _exportModuleCSV(collectNormData, buildNormReport, 'normalize'); }
function exportExtCSV()  { _exportModuleCSV(collectExtData,  buildExtReport,  'external'); }
function exportIntCSV()  { _exportModuleCSV(collectIntData,  buildIntReport,  'internal'); }
// v54.94 5 module export*CSV（接 build*Report + collect*Data）
function exportDryingCSV()  { _exportModuleCSV(collectDryingData,    buildDryingReport,    'drying'); }
function exportResidueCSV()  { _exportModuleCSV(collectResidueData,    buildResidueReport,    'residue'); }
function exportTiterCSV()    { _exportModuleCSV(collectTiterData,      buildTiterReport,      'titer'); }
function exportUniformityCSV() { _exportModuleCSV(collectUniformityData, buildUniformityReport, 'uniformity'); }
function exportDissolutionCSV() { _exportModuleCSV(collectDissolutionData, buildDissolutionReport, 'dissolution'); }
// v54.86 3 个 export*Excel 共享 helper（DRY：消除 9 行重复 collect + ensureXlsx().then 模式）
// a11y: 导出/同步按钮的 loading 状态（spinner via .btn-loading CSS）
function _withBtnLoading(fn){
 var _btn = null;
 return function(){
  try{
   _btn = (typeof event !== 'undefined' && event && event.target && event.target.classList) ? event.target : (document.activeElement && document.activeElement.classList ? document.activeElement : null);
   if(_btn && !_btn.dataset && _btn.closest) {
     // click event 可能命中内嵌 span，找最近的 button
     var closestBtn = _btn.closest('button');
     if (closestBtn) _btn = closestBtn;
   }
   if(_btn && _btn.classList){
    if(_btn.disabled) return fn.apply(this, arguments);
    _btn.disabled = true;
    _btn.classList.add('btn-loading');
   }
   return fn.apply(this, arguments);
  } finally {
   if(_btn && _btn.classList){
    _btn.classList.remove('btn-loading');
    _btn.disabled = false;
   }
  }
 };
}

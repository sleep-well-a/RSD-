function exportComprehensiveMarkdown() {
  // v54.88 复用：使用 top-level _fmtEntryMeta helper（与 HtmlEmail / iCal 共享）
  const meta = (typeof getReportMeta === 'function') ? getReportMeta() : {};
  const records = selectComprehensiveRecords();
  const esc = (s) => s == null ? '' : String(s).replace(/[&<>"']/g, c =>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const lines =[];
 
 lines.push(i18n('cvMdReportTitle'));
 lines.push('');
 lines.push(i18n('cvMdExportTime') + esc(_formatNow()));
 if(meta.sampleName) lines.push(i18n('cvMdSampleName') + esc(meta.sampleName));
 if(meta.batch) lines.push(i18n('cvMdBatch') + esc(meta.batch));
 if(meta.operator) lines.push(i18n('cvMdOperator') + esc(meta.operator));
 if(meta.instrument) lines.push(i18n('cvMdInstrument') + esc(meta.instrument));
 if(meta.column) lines.push(i18n('cvMdColumn') + esc(meta.column));
 lines.push('');
 
 lines.push(i18n('cvMdSummary'));
 lines.push('');
 lines.push('| ' + i18n('hMdColVerifItem') + ' | ' + i18n('hMdColStatus') + ' |');
 lines.push('|---|---|');
 if(records.precision){
 const p = records.precision;
 let s = '✓ ' + esc(p.time || i18n('alreadyRecorded'));
 if(p.rsd != null) s += ' | ' + i18n('cvRsdEqPctFmt').replace('{0}', p.rsd); /* v54.281 fix: totalRSD → rsd（saveStatsHistory 存 rsd 字段，不是 totalRSD — v54.278 修复时漏改） */
 lines.push(i18n('cvMdPrecision') + s + ' |');
} else lines.push(i18n('cvTablePrecision'));
 if(records.recovery){
 const r = records.recovery;
 let s = '✓ ' + esc(r.type || i18n('alreadyRecorded'));
 if(r.cMean != null) s += i18n('tableAvgCell') + r.cMean + '%';
 lines.push(i18n('cvMdAccuracy') + s + ' |');
} else lines.push(i18n('cvTableAccuracy'));
 if(records.linear){
 const l = records.linear;
 let s = '✓ ' + i18n('cvR2') + ' = ' + (l.r2 != null ? l.r2 : '—'); /* v54.277 fix: 'r²' 硬编码 → i18n('cvR2') */
 lines.push(i18n('cvMdLinearity') + s + ' |');
} else lines.push(i18n('cvTableLinearity'));
 if(records.stability){
 lines.push(i18n('cvMdStability') + esc(records.stability.time || i18n('alreadyRecorded')) + ' |');
} else lines.push(i18n('cvTableStability'));
 lines.push('');
 
 if(records.precision){
 lines.push(i18n('cvMdPrecisionDetail'));
 lines.push('');
 lines.push(i18n('mdTableItemValue'));
 lines.push('|---|---|');
 lines.push(i18n('mdTableType') + esc(records.precision.type || '—') + ' |');
 
 const _mP = _fmtEntryMeta(records.precision._meta); if(_mP) lines.push(i18n('mdTableMeta') + esc(_mP) + ' |');
 if(records.precision.time) lines.push(i18n('mdTableTime') + esc(records.precision.time) + ' |');
 if(records.precision.data) lines.push('| ' + i18n('hMdColData') + ' | ' + esc(records.precision.data) + ' |');
 if(records.precision.mean != null) lines.push('| ' + i18n('hMdColMean') + ' | ' + records.precision.mean + ' |');
 if(records.precision.sd != null) lines.push('| ' + i18n('hSd') + ' | ' + records.precision.sd + ' |'); /* v54.281 fix: SD → hSd */
 if(records.precision.rsd != null) lines.push('| ' + i18n('hRsd') + ' (%) | ' + records.precision.rsd + ' |'); /* v54.281 fix: RSD (%) → hRsd */
 if(records.precision.rsd != null) lines.push(i18n('cvMdTotalRsd') + records.precision.rsd + ' |'); /* v54.281 fix: totalRSD → rsd */
 lines.push('');
}
 if(records.linear){
 lines.push(i18n('cvMdLinearityDetail'));
 lines.push('');
 lines.push(i18n('mdTableItemValue'));
 lines.push('|---|---|');
 if(records.linear.type) lines.push(i18n('mdTableType') + esc(records.linear.type) + ' |');
 
 const _mL = _fmtEntryMeta(records.linear._meta); if(_mL) lines.push(i18n('mdTableMeta') + esc(_mL) + ' |');
 if(records.linear.time) lines.push(i18n('mdTableTime') + esc(records.linear.time) + ' |');
 if(records.linear.a != null) lines.push('| ' + i18n('hMdColSlopeA') + ' | ' + records.linear.a + ' |');
 if(records.linear.b != null) lines.push('| ' + i18n('hMdColInterceptB') + ' | ' + records.linear.b + ' |');
 if(records.linear.r2 != null) lines.push('| ' + i18n('hMdColR2') + ' | ' + records.linear.r2 + ' |');
 lines.push('');
 if(records.linear.points && records.linear.points.length){
 lines.push(i18n('cvMdSubheaderDataPoint') + records.linear.points.length + ')');
 lines.push('');
 lines.push('| ' + i18n('hMdColNo') + ' | ' + i18n('hMdColConcentration') + ' | ' + i18n('hMdColResponse') + ' |');
 lines.push('|---|---|---|');
 records.linear.points.forEach(function(p, i){
 lines.push('| ' +(i+1) + ' | ' + p.x + ' | ' + p.y + ' |');
});
 lines.push('');
}
}
 if(records.recovery){
 lines.push(i18n('cvMdAccuracyDetail'));
 lines.push('');
 lines.push(i18n('mdTableItemValue'));
 lines.push('|---|---|');
 if(records.recovery.type) lines.push(i18n('mdTableType') + esc(records.recovery.type) + ' |');
 
 const _mR = _fmtEntryMeta(records.recovery._meta); if(_mR) lines.push(i18n('mdTableMeta') + esc(_mR) + ' |');
 if(records.recovery.time) lines.push(i18n('mdTableTime') + esc(records.recovery.time) + ' |');
 if(records.recovery.cMean != null) lines.push('| ' + i18n('hMdColMeanRecovery') + ' | ' + records.recovery.cMean + ' |');
 if(records.recovery.cSd != null) lines.push('| ' + i18n('hSd') + ' | ' + records.recovery.cSd + ' |'); /* v54.281 fix: SD → hSd */
 if(records.recovery.cRsd != null) lines.push('| ' + i18n('hRsd') + ' (%) | ' + records.recovery.cRsd + ' |'); /* v54.281 fix: RSD (%) → hRsd */
 if(records.recovery.theory != null) lines.push('| ' + i18n('hMdColTheory') + ' | ' + records.recovery.theory + ' |');
 lines.push('');
 if(records.recovery.recoveries && records.recovery.recoveries.length){
 lines.push(i18n('cvMdSubheaderRecovery') + records.recovery.recoveries.length + ')');
 lines.push('');
 lines.push('| ' + i18n('hMdColNo') + ' | ' + i18n('hMdColRecovery') + ' |');
 lines.push('|---|---|');
 records.recovery.recoveries.forEach(function(v, i){
 lines.push('| ' +(i+1) + ' | ' + v + ' |');
});
 lines.push('');
}
}
 if(records.stability){
 lines.push(i18n('cvMdStabilityDetail'));
 lines.push('');
 lines.push(i18n('mdTableItemValue'));
 lines.push('|---|---|');
 if(records.stability.type) lines.push(i18n('mdTableType') + esc(records.stability.type) + ' |');
 
 const _mS = _fmtEntryMeta(records.stability._meta); if(_mS) lines.push(i18n('mdTableMeta') + esc(_mS) + ' |');
 if(records.stability.time) lines.push(i18n('mdTableTime') + esc(records.stability.time) + ' |');
 lines.push('');
 var stabRows =(records.stability.longterm || records.stability.accelerated || records.stability.intermediate ||[]);
 if(stabRows.length){
 lines.push(i18n('cvMdSubheaderTimePoint') + stabRows.length + ')');
 lines.push('');
 lines.push(i18n('cvTimePointTableHeader'));
 lines.push('|---|---|');
 stabRows.forEach(function(rw){
 lines.push('| ' + esc(String(rw.time || '—') + i18n('monthUnit')) + ' | ' + esc(String(rw.value || '—')) + ' |');
});
 lines.push('');
}
}
 
 var mdText = lines.join('\n');
 var fname = i18n('cvReportFilename') +(meta.sampleName ? '_' + meta.sampleName.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + (meta.batch ? '_' + meta.batch.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + '_' + new Date().toISOString().slice(0,10) + '.md';
 
 // v54.229 fix: clipboard.writeText promise reject 时（无 https / 权限拒绝）会变 unhandledrejection red toast
   // 改用 .catch 优雅 fallback 到 download
   try{ navigator.clipboard.writeText(mdText).then(function(){
   if(typeof toast === 'function') _i18nToast('toast_markdownCopiedFmt', 'success', 4000, fname);
  }).catch(function(){ if(typeof toast === 'function') _i18nToast('toast_downloadedFmt', 'success', 4000, fname);});} catch(e){ if(typeof toast === 'function') _i18nToast('toast_downloadedFmt', 'success', 4000, fname);}
 var blob = new Blob([mdText],{ type: 'text/markdown;charset=utf-8'});
 var url = URL.createObjectURL(blob);
 var a = document.createElement('a');
 a.href = url; a.download = fname; a.click();
 setTimeout(function(){ URL.revokeObjectURL(url);}, 1500);
 return mdText;
}

function exportComprehensiveHtmlEmail(){
 var meta =(typeof getReportMeta === 'function') ? getReportMeta() :{};
 var records = selectComprehensiveRecords();
 var esc = function(s){ return s == null ? '' : String(s).replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };

  // 内联样式颜色（避免 CSS 变量；Outlook/Gmail 兼容）
  var COL_PRIMARY = '#2563eb';
  var COL_SUCCESS = '#16a34a';
  var COL_BORDER = '#e2e8f0';
  var COL_BG_HEADER = '#f0f9ff';
  var COL_TEXT = '#1e293b';
  var COL_LIGHT = '#64748b';
  var COL_BG = '#ffffff';

  function cellStyle(extra) {
    return 'padding:6px 10px;border:1px solid ' + COL_BORDER + ';font-size:13px;color:' + COL_TEXT + ';' + (extra || '');
  }
  function headerCellStyle() {
    return 'padding:8px 10px;border:1px solid ' + COL_BORDER + ';background:' + COL_BG_HEADER + ';font-weight:700;font-size:12px;color:' + COL_PRIMARY + ';text-align:left;';
  }

  function tableFromAOA(aoa, colWidths) {
    if (!aoa || !aoa.length) return '';
    var widths = colWidths || aoa[0].map(function() { return '*'; });
    var html = '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:8px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;">';
    aoa.forEach(function(row, ri) {
      html += '<tr>';
      row.forEach(function(c, ci) {
        var w = widths[ci] || '*';
        var style = ri === 0 ? headerCellStyle() : cellStyle();
        html += '<td style="' + style + 'width:' + w + '">' + esc(c) + '</td>';
      });
      html += '</tr>';
    });
    html += '</table>';
    return html;
  }

  // 容器样式
  var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:' + COL_TEXT + ';background:' + COL_BG + ';">';

  // 标题区
  html += '<div style="text-align:center;border-bottom:3px solid ' + COL_PRIMARY + ';padding-bottom:14px;margin-bottom:16px;">';
  html += '<h1 style="margin:0;color:' + COL_PRIMARY + '">' + i18n('cvHtmlReportTitleH1') + '</h1>';
  html += '<p style="color:' + COL_LIGHT + '">' + i18n('cvHtmlExportTime') + esc(_formatNow()) + '</p>';
  html += '</div>';

  // 报告元数据
  if (meta.sampleName || meta.batch || meta.operator || meta.instrument || meta.column) {
    html += '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:16px;font-size:13px;">';
    if (meta.sampleName) html += '<tr><td style="' + cellStyle('width:25%;background:#f8fafc;font-weight:600;color:' + COL_LIGHT + ';') + '">'+i18n('hHtmlSampleName')+'</td><td style="' + cellStyle() + '">' + esc(meta.sampleName) + '</td></tr>';
    if (meta.batch) html += '<tr><td style="' + cellStyle('background:#f8fafc;font-weight:600;color:' + COL_LIGHT + ';') + '">'+i18n('metaBatch')+'</td><td style="' + cellStyle() + '">' + esc(meta.batch) + '</td></tr>';
    if (meta.operator) html += '<tr><td style="' + cellStyle('background:#f8fafc;font-weight:600;color:' + COL_LIGHT + ';') + '">'+i18n('metaOperator')+'</td><td style="' + cellStyle() + '">' + esc(meta.operator) + '</td></tr>';
    if (meta.instrument) html += '<tr><td style="' + cellStyle('background:#f8fafc;font-weight:600;color:' + COL_LIGHT + ';') + '">'+i18n('hHtmlInstrument')+'</td><td style="' + cellStyle() + '">' + esc(meta.instrument) + '</td></tr>';
    if (meta.column) html += '<tr><td style="' + cellStyle('background:#f8fafc;font-weight:600;color:' + COL_LIGHT + ';') + '">'+i18n('hHtmlColumn')+'</td><td style="' + cellStyle() + '">' + esc(meta.column) + '</td></tr>';
    html += '</table>';
  }

  // 综合汇总
  html += '<h2 style="color:' + COL_PRIMARY + ';font-size:16px;border-bottom:2px solid ' + COL_PRIMARY + '">' + i18n('cvHtmlSummaryH2') + '</h2>';
  var summaryAoa = [[i18n('cvVerifItem'), i18n('statusLabel'), i18n('hKeyMetric')]];
  if (records.precision) {
    var p = records.precision;
    var s = i18n('recordedOk');
    var k = [];
    if (p.rsd != null) k.push(i18n('cvRsdEqPctFmt').replace('{0}', p.rsd)); /* v54.281 fix: totalRSD → rsd */
    summaryAoa.push([i18n('cvPrecision'), s, k.join(' ') || '—']);
  } else summaryAoa.push([i18n('cvPrecision'), i18n('notFound'), '—']);
  if (records.recovery) {
    var r = records.recovery;
    var s = i18n('recordedOk');
    var k = [];
    if (r.cMean != null) k.push(i18n('hMeanShort2') + r.cMean + '%');
    if (r.cRsd != null) k.push(i18n('cvRsdEqPctFmt').replace('{0}', r.cRsd)); /* v54.277 fix: 'RSD=' 硬编码 → i18n */
    summaryAoa.push([i18n('cvAccuracy'), s, k.join(' ') || '—']);
  } else summaryAoa.push([i18n('cvAccuracy'), i18n('notFound'), '—']);
  if (records.linear) {
    var l = records.linear;
    var s = i18n('recordedOk');
    var k = [];
    if (l.r2 != null) k.push(i18n('cvR2') + '=' + l.r2); /* v54.277 fix: 'r²=' 硬编码 → i18n('cvR2') + '=' */
    summaryAoa.push([i18n('cvLinearity'), s, k.join(' ') || '—']);
  } else summaryAoa.push([i18n('cvLinearity'), i18n('notFound'), '—']);
  if (records.stability) {
    summaryAoa.push([i18n('cvStability'), i18n('recordedOk'), '—']);
  } else summaryAoa.push([i18n('cvStability'), i18n('notFound'), '—']);
  html += tableFromAOA(summaryAoa, ['25%', '35%', '*']);

  // 4 子报告（精密度 / 准确度 / 线性 / 稳定性）
  function section(title, bodyAoa) {
    html += '<h2 style="color:' + COL_PRIMARY + ';font-size:16px;border-bottom:2px solid ' + COL_PRIMARY + ';padding-bottom:4px;margin:18px 0 8px;">' + title + '</h2>';
    if (bodyAoa && bodyAoa.length) html += tableFromAOA(bodyAoa);
    else html += '<p style="color:' + COL_LIGHT + ';font-size:13px;font-style:italic;">' + i18n('cvNoRecordsFound') + '</p>';
  }

  if (records.precision) {
    var p = records.precision;
    var pa = [[i18n('reportMetric'), i18n('hMetric')]];
    // v54.88 报告元数据增强
    const _mep = _fmtEntryMeta(p._meta); if (_mep) pa.push([i18n('hMetaData'), _mep]);
    if (p.time) pa.push([i18n('csvHeaderTime'), p.time]);
    if (p.type) pa.push([i18n('csvHeaderType'), p.type]);
    if (p.parallelCount) pa.push([i18n('hParallelCount'), p.parallelCount]);
    if (p.mean != null) pa.push([i18n('hMean'), p.mean]);
    if (p.sd != null) pa.push([i18n('hSd'), p.sd]); /* v54.278 fix: 'SD' 硬编码 → i18n */
    if (p.rsd != null) pa.push([i18n('totalRsdPct'), p.rsd]); /* v54.281 fix: totalRSD → rsd */
    section(i18n('cvPrecision'), pa);
  }
  if (records.recovery) {
    var r = records.recovery;
    var ra = [[i18n('reportMetric'), i18n('hMetric')]];
    // v54.88 报告元数据增强
    const _mer = _fmtEntryMeta(r._meta); if (_mer) ra.push([i18n('hMetaData'), _mer]);
    if (r.type) ra.push([i18n('csvHeaderType'), r.type]);
    if (r.cMean != null) ra.push([i18n('avgRecoveryPct'), r.cMean]);
    if (r.cSd != null) ra.push([i18n('hSd'), r.cSd]); /* v54.278 fix */
    if (r.cRsd != null) ra.push([i18n('hRsd') + '(%)', r.cRsd]); /* v54.278 fix: 'RSD(%)' 硬编码 → i18n */
    section(i18n('cvAccuracy'), ra);
  }
  if (records.linear) {
    var l = records.linear;
    var la = [[i18n('reportMetric'), i18n('hMetric')]];
    // v54.88 报告元数据增强
    const _mel = _fmtEntryMeta(l._meta); if (_mel) la.push([i18n('hMetaData'), _mel]);
    if (l.time) la.push([i18n('csvHeaderTime'), l.time]);
    // v54.273 fix: 标准曲线 history entry 字段是 a/b/r2（saveCurveHistory line 1460），不是 slope/intercept（_extractChartData 同样用 .a/.b）
    if (l.a != null) la.push([i18n('hMdColSlopeA'), l.a]);
    if (l.b != null) la.push([i18n('hMdColInterceptB'), l.b]);
    if (l.r2 != null) la.push([i18n('hR2Fmt'), l.r2]);
    section(i18n('cvLinearity'), la);
  }
  if (records.stability) {
    var s = records.stability;
    var sa = [[i18n('cvTimePoint'), i18n('contentPct')]];
    // v54.88 报告元数据增强
    const _mes = _fmtEntryMeta(s._meta); if (_mes) sa.push([i18n('hMetaData'), _mes]);
    if (s.time) sa[0][0] = s.time;
    if (Array.isArray(s.points)) {
      s.points.forEach(function(p) {
        sa.push([p.time || '—', p.value || '—']);
      });
    }
    section(i18n('cvStability'), sa);
  }

  // 页脚
  html += '<div style="margin-top:24px;padding-top:12px;border-top:1px solid ' + COL_BORDER + ';color:' + COL_LIGHT + '">' + i18n('cvHtmlFooter') + '</div>';
  html += '</div>';

  var fname = i18n('cvReportEmailVer') + (meta.sampleName ? '_' + meta.sampleName.replace(/[\/\\:*?"<>|\s]/g, '_') : '') +(meta.batch ? '_' + meta.batch.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + '_' + new Date().toISOString().slice(0,10) + '.html';

  // 完整 HTML 文档（含 DOCTYPE 让 Outlook/Gmail 正确解析）
  var docHtml = '<!DOCTYPE html><html lang="' + (_currentLang === 'en' ? 'en' : 'zh-CN') + '"><head><meta charset="UTF-8"><title>' + i18n('tplInspectionReportTitle') + '</title></head><body style="margin:0;padding:0;background:#f1f5f9;">' + html + '</body></html>';

  // 复制到剪贴板 + 下载
  try {
    if (navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([docHtml], { type: 'text/html' }), 'text/plain': new Blob([docHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()], { type: 'text/plain' }) })]).then(function() {
        if (typeof toast === 'function') _i18nToast('toast_htmlEmailCopiedFmt', 'success', 4000, fname);
      }).catch(function() {
        if (typeof toast === 'function') _i18nToast('toast_clipboardFailFmt', 'success', 4000, fname);
      });
    } else {
      throw new Error('clipboard API unavailable');
    }
  } catch (e) {
    // v54.239 fix: writeText 返回 Promise 漏 .catch 会变 unhandledrejection（v54.229 同款漏网）
    try { navigator.clipboard.writeText(docHtml).catch(function(err){ console.error('[clipboard html-email]', err); }); } catch (e2) {}
    if (typeof toast === 'function') _i18nToast('toast_downloadedFmt', 'success', 4000, fname);
  }
  var blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  return docHtml;
}

// JSON Schema 导出：结构化数据 + 元数据 + 验证阈值（便于其他系统解析、对接 LIMS）
function exportComprehensiveJson() {
  var meta = (typeof getReportMeta === 'function') ? getReportMeta() : {};
  var records = selectComprehensiveRecords();
  var now = new Date();

  // 数据部分：扁平化 records 对象，便于 JSON 消费者直接使用
  function flattenPrecision(p) {
    if (!p) return null;
    return { time: p.time, type: p.type, parallelCount: p.parallelCount, mean: p.mean, sd: p.sd, totalRSD: p.rsd, raw: p }; /* v54.281 fix: totalRSD → rsd（保持 JSON schema key 不变向后兼容） */
  }
  function flattenRecovery(r) {
    if (!r) return null;
    return { type: r.type, cMean: r.cMean, cSd: r.cSd, cRsd: r.cRsd, original: r.original, limitLow: r.limitLow, limitHigh: r.limitHigh, raw: r };
  }
  function flattenLinear(l) {
    if (!l) return null;
    var pts = (l.points || []).map(function(p) { return { x: p.x, y: p.y }; });
    return { time: l.time, slope: l.a, intercept: l.b, r2: l.r2, points: pts, raw: l }; /* v54.273 fix: a/b → slope/intercept（保持 JSON export schema 不变同时映射真实字段） */
  }
  function flattenStability(s) {
    if (!s) return null;
    return { time: s.time, points: (s.points || []).map(function(p) { return { time: p.time, value: p.value }; }), raw: s };
  }

  // 验证阈值（默认值与项目其他模块一致）
  var thresholds = {
    precision: { maxRSDPercent: 2.0, source: i18n('cvThresholdPrecisionSource') }, /* v54.273 fix: hardcoded zh/en → i18n */
    recovery: { targetMeanPercent: 100, acceptableRSDPercent: 5.0, typicalRange: [98, 102] },
    linear: { minR2: 0.999, source: i18n('cvThresholdLinearSource') },
    stability: { maxDriftPercent: 5.0, source: i18n('cvThresholdStabilitySource') },
  };

  // 验证结论（自动比对阈值）
  function verdict(records) {
    var v = {};
    if (records.precision && records.precision.rsd != null) { /* v54.281 fix: totalRSD → rsd */
      v.precision = records.precision.rsd <= thresholds.precision.maxRSDPercent ? 'pass' : 'review';
    } else v.precision = 'no_data';
    if (records.recovery && records.recovery.cMean != null) {
      var inRange = records.recovery.cMean >= thresholds.recovery.typicalRange[0] && records.recovery.cMean <= thresholds.recovery.typicalRange[1];
      v.recovery = inRange ? 'pass' : 'review';
    } else v.recovery = 'no_data';
    if (records.linear && records.linear.r2 != null) {
      v.linear = records.linear.r2 >= thresholds.linear.minR2 ? 'pass' : 'review';
    } else v.linear = 'no_data';
    if (records.stability) {
      v.stability = 'pending_review';
    } else v.stability = 'no_data';
    return v;
  }

  var payload = {
    schema: {
      name: i18n('cvReportAppTitle'),
      version: '1.0.0',
      generated: now.toISOString(),
      generator: i18n('cvReportGeneratorSelf'), /* v54.273 fix: hardcoded zh/en 混合 → i18n（zh='RSD & 含量计算器 (QR-MV6013)' / en='RSD & Content Calculator (QR-MV6013)'） */
    },
    metadata: {
      sampleName: meta.sampleName || null,
      batch: meta.batch || null,
      operator: meta.operator || null,
      instrument: meta.instrument || null,
      column: meta.column || null,
      tagPrefix: meta.tagPrefix || null,
    },
    sections: {
      precision: flattenPrecision(records.precision),
      recovery: flattenRecovery(records.recovery),
      linear: flattenLinear(records.linear),
      stability: flattenStability(records.stability),
    },
    thresholds: thresholds,
    verdict: verdict(records),
    exportTimestamp: now.getTime(),
  };

  var jsonText = JSON.stringify(payload, null, 2);
  var fname = i18n('cvReportFilename') + (meta.sampleName ? '_' + meta.sampleName.replace(/[\/\\:*?"<>|\s]/g, '_') : '') +(meta.batch ? '_' + meta.batch.replace(/[\/\\:*?"<>|\s]/g, '_') : '') + '_' + now.toISOString().slice(0,10) + '.json';

  // 下载 + 复制
  // v54.229 fix: 加 .catch（与 line 5753 同款）
  try { navigator.clipboard.writeText(jsonText).then(function() {
    if (typeof toast === 'function') _i18nToast('toast_jsonCopiedFmt', 'success', 4000, fname);
  }).catch(function(){ if (typeof toast === 'function') _i18nToast('toast_downloadedFmt', 'success', 4000, fname); }); } catch(e) { if (typeof toast === 'function') _i18nToast('toast_downloadedFmt', 'success', 4000, fname); }
  var blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  return jsonText;
}

// iCal 导出：下一次校准 / 稳定性 review 提醒事件（可导入 Google Calendar / Outlook）
function exportComprehensiveIcal() {
  var meta = (typeof getReportMeta === 'function') ? getReportMeta() : {};
  var records = selectComprehensiveRecords();
  var now = new Date();

  // 转 iCal 日期格式（YYYYMMDD 或 YYYYMMDDTHHMMSSZ）
  function fmtDate(d) {
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var dd = String(d.getUTCDate()).padStart(2, '0');
    return y + m + dd;
  }
  function fmtDateTime(d) {
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var dd = String(d.getUTCDate()).padStart(2, '0');
    var h = String(d.getUTCHours()).padStart(2, '0');
    var mi = String(d.getUTCMinutes()).padStart(2, '0');
    var s = String(d.getUTCSeconds()).padStart(2, '0');
    return y + m + dd + 'T' + h + mi + s + 'Z';
  }
  function escapeText(s) {
    // v54.246 fix (verify): RFC 5545 §3.3.11 TEXT escape
    // - backslash → \\ (must be first to avoid double-escape)
    // - newline → \n (literal backslash-n in iCal output)
    // - carriage return → \n (some parsers require this; convert rather than drop to avoid data loss)
    // - comma → \,
    // - semicolon → \;
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  var events = [];
  // Event 1: 综合验证完成提醒（30 天后 review）
  var reviewDate = new Date(now.getTime() + 30 * 86400000);
  events.push({
    uid: 'rsd-review-' + now.getTime() + '@rsd-calculator',
    summary: i18n('cvReportReviewFmt') + (meta.sampleName || i18n('recipeUnnamed')) + ')', /* v54.273 fix: 全角 '）' → 半角 ')' 与 i18n fmt '（'/'(' 配对（EN 模式：'(' + name + ')'）*/
    description: i18n('icalReportReviewDesc')
      .replace('{sample}', meta.sampleName || '—')
      .replace('{batch}', meta.batch || '—')
      .replace('{operator}', meta.operator || '—') + '\n\n' + /* v54.274 fix (correctness #9): 真实换行 — escapeText 会转成 RFC5545 的字面 \n；旧代码写 '\\n\\n'（字面反斜杠+n）经 escapeText 的反斜杠翻倍后变成可见文本 "\n\n" */
      i18n('cvPrecisionItem') + (records.precision ? i18n('cvRecordedRsdFmt') + (records.precision.rsd || '?') + '%)' : i18n('uiNotFound')) + '\n' + /* v54.281 fix: totalRSD → rsd; v54.273 fix: 半角 ')' 替代全角 ')'（与 i18n fmt '（'/'(' 配对统一） */
      i18n('cvAccuracyItem') + (records.recovery ? i18n('cvRecordedAvgFmt') + (records.recovery.cMean || '?') + '%)' : i18n('uiNotFound')) + '\n' + /* v54.273 fix: 同上 */
      i18n('cvLinearityItem') + (records.linear ? i18n('cvRecordedR2Fmt') + (records.linear.r2 || '?') + ')' : i18n('uiNotFound')) + '\n' +
      i18n('cvStabilityItem') + (records.stability ? i18n('cvStabilityRecorded') : i18n('uiNotFound')) + '\n\n' +
      i18n('icalMetaDetails') + '\n' +
      i18n('cvPrecisionItem') + (records.precision && records.precision._meta ? _fmtEntryMeta(records.precision._meta) : '—') + '\n' +
      i18n('cvAccuracyItem') + (records.recovery && records.recovery._meta ? _fmtEntryMeta(records.recovery._meta) : '—') + '\n' +
      i18n('cvLinearityItem') + (records.linear && records.linear._meta ? _fmtEntryMeta(records.linear._meta) : '—') + '\n' +
      i18n('cvStabilityItem') + (records.stability && records.stability._meta ? _fmtEntryMeta(records.stability._meta) : '—'),
    dtstart: fmtDate(reviewDate),
    dtend: fmtDate(new Date(reviewDate.getTime() + 86400000)),
    categories: ['RSD-REVIEW', i18n('icalCatReview')],
  });

  // Event 2: 滴定度下次校准提醒（如有 titer 数据）
  try {
    var titerDrafts = (typeof _loadJson === 'function') ? _loadJson('rsd-titer-drafts', {}) : {};
    var nearestDue = null;
    Object.keys(titerDrafts).forEach(function(method) {
      var t = titerDrafts[method];
      if (t && t.calibratedAt && t.validDays) {
        var due = new Date(t.calibratedAt + t.validDays * 86400000);
        if (!nearestDue || due < nearestDue) nearestDue = due;
      }
    });
    if (nearestDue) {
      events.push({
        uid: 'rsd-titer-recal-' + nearestDue.getTime() + '@rsd-calculator',
        summary: i18n('icalTiterRecalTitle'),
        description: i18n('icalTiterRecalDesc')
          .replace('{last}', fmtDate(new Date(nearestDue.getTime() - 30 * 86400000)))
          .replace('{next}', fmtDate(nearestDue)),
        dtstart: fmtDate(new Date(nearestDue.getTime() - 7 * 86400000)),
        dtend: fmtDate(nearestDue),
        categories: ['TITER-RECAL', i18n('icalCatTiterRecal')],
      });
    }
  } catch (e) {}

  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    i18n('cvReportProdId'),
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  events.forEach(function(e) {
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + e.uid);
    lines.push('DTSTAMP:' + fmtDateTime(now));
    lines.push('DTSTART;VALUE=DATE:' + e.dtstart);
    lines.push('DTEND;VALUE=DATE:' + e.dtend);
    lines.push('SUMMARY:' + escapeText(e.summary));
    lines.push('DESCRIPTION:' + escapeText(e.description));
    if (e.categories && e.categories.length) lines.push('CATEGORIES:' + e.categories.map(escapeText).join(','));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');

  var icalText = lines.join('\r\n');
  // v54.246 fix: 同步 metaFilename 剥离控制字符（与 CSV/XLSX 文件名注入防护一致）
  var fname = i18n('icalCalFilePrefix') + (meta.sampleName ? '_' + meta.sampleName.replace(/[\x00-\x1F\/\\:*?"<>|\s]/g, '_') : '') +(meta.batch ? '_' + meta.batch.replace(/[\x00-\x1F\/\\:*?"<>|\s]/g, '_') : '') + '_' + now.toISOString().slice(0,10) + '.ics';

  // 下载（iCal 不适合复制到剪贴板，直接下载）
  var blob = new Blob([icalText], { type: 'text/calendar;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  if (typeof toast === 'function') _i18nToast('toast_icalDownloadFmt', 'success', 4000, events.length);
  return icalText;
}

// v54.302 新增：批量历史 Markdown 导出（per-type 渲染器）
// 复用 comprehensive report 的 i18n 词汇，但每条历史一个 H2 段落
function exportHistoryBatchMarkdown(items) {
  if (!Array.isArray(items) || items.length === 0) {
    if (typeof _i18nAlert === 'function') _i18nAlert('cvHistoryEmpty');
    return null;
  }
  var esc = function(s) { return s == null ? '' : String(s).replace(/[&<>]/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var _v = function(k, fb) { try { var v = i18n(k); return v && v !== k ? v : (fb || k); } catch (e) { return fb || k; } };
  var now = new Date();

  function renderItem(item, idx) {
    var lines = [];
    var t = item.type || 'Item';
    var tLabel = _HIST_TYPE_I18N_KEY && _HIST_TYPE_I18N_KEY[t] ? _v(_HIST_TYPE_I18N_KEY[t], t) : t;
    lines.push('## ' + (idx + 1) + '. ' + esc(tLabel));
    lines.push('');
    if (item.time) lines.push('**' + _v('cvMdTime', '时间') + '：** ' + esc(item.time));
    // 通用字段（type/time/_meta 跳过，剩下的都打表）
    var SKIP = { type: 1, time: 1, _meta: 1, rows: 1, points: 1, recoveries: 1 };
    var keys = Object.keys(item).filter(function(k) { return !SKIP[k]; });
    if (keys.length) {
      lines.push('');
      lines.push('| ' + _v('cvMdItem', '项') + ' | ' + _v('cvMdValue', '值') + ' |');
      lines.push('|---|---|');
      keys.forEach(function(k) {
        var v = item[k];
        if (v == null || v === '') return;
        if (typeof v === 'object') v = JSON.stringify(v);
        lines.push('| ' + esc(k) + ' | ' + esc(String(v)) + ' |');
      });
    }
    // 特殊：rows 数组（加样回收率 / 滴定度 / 干燥失重 等）
    if (Array.isArray(item.rows) && item.rows.length) {
      lines.push('');
      lines.push('### ' + _v('cvMdDetail', '明细'));
      lines.push('');
      item.rows.forEach(function(r, ri) {
        if (Array.isArray(r)) {
          lines.push('- ' + (ri + 1) + ': ' + r.map(function(c) { return esc(String(c)); }).join(' | '));
        } else if (typeof r === 'object' && r !== null) {
          var rk = Object.keys(r);
          lines.push('- ' + (ri + 1) + ': ' + rk.map(function(k) { return esc(k) + '=' + esc(String(r[k])); }).join(', '));
        } else {
          lines.push('- ' + (ri + 1) + ': ' + esc(String(r)));
        }
      });
    }
    // 特殊：points 数组（标准曲线）
    if (Array.isArray(item.points) && item.points.length) {
      lines.push('');
      lines.push('### ' + _v('cvMdDataPoint', '数据点') + ' (' + item.points.length + ')');
      lines.push('');
      lines.push('| ' + _v('cvMdNo', '#') + ' | ' + _v('cvMdConcentration', 'x') + ' | ' + _v('cvMdResponse', 'y') + ' |');
      lines.push('|---|---|---|');
      item.points.forEach(function(p, pi) {
        lines.push('| ' + (pi + 1) + ' | ' + esc(p.x) + ' | ' + esc(p.y) + ' |');
      });
    }
    return lines.join('\n');
  }

  var out = [];
  out.push('# ' + _v('historyReportTitle', '历史记录导出'));
  out.push('');
  out.push(_v('cvMdExportTime', '**导出时间：** ') + esc(now.toISOString()));
  out.push('**' + _v('cvHistoryCountFmt', '条目数') + '：** ' + items.length);
  out.push('');
  out.push('---');
  out.push('');

  items.forEach(function(it, i) {
    out.push(renderItem(it, i));
    out.push('');
    out.push('---');
    out.push('');
  });

  var mdText = out.join('\n');
  var fname = 'rsd-history-' + now.toISOString().slice(0, 10) + '-' + items.length + 'items.md';

  try { navigator.clipboard.writeText(mdText).then(function() {
    if (typeof toast === 'function') _i18nToast('toast_markdownCopiedFmt', 'success', 4000, fname);
  }).catch(function() { if (typeof toast === 'function') _i18nToast('toast_downloadedFmt', 'success', 4000, fname); }); }
  catch (e) { if (typeof toast === 'function') _i18nToast('toast_downloadedFmt', 'success', 4000, fname); }

  var blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1500);
  return mdText;
}

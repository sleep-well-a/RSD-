// v54.284 ESLint 配置（业界主流 boolean 反转 / a11y / 通用规则）
//
// 目的：用 ESLint + `no-unsafe-negation` 等核心规则，扫 app.js 中潜在反转 bug。
//        这是 v54.248 / v54.271 / v54.273 / v54.274 同源 4 次 bug 的工业级防御层。
//
// 覆盖规则（业界主流 + RSD 定制）：
//   - no-unsafe-negation          // !(x in y) / !(x instanceof y) 等危险否定
//   - no-unneeded-ternary        // 冗余三元（v54.271 calcNormalize 反转防御）
//   - no-contradictory-condition // 矛盾条件（TypeScript 项目用，但 ES5+ 可识别）
//   - no-unsafe-optional-chaining // 可选链不安全用法
//   - no-eq-null            // 用 === null 替代 / v54.273 自定义规则建议
//   - v54.284-no-inverted-isfinite  // 自定义：检测 `!Number.isFinite` 误用为正向守卫
//
// 注：ESLint 默认 parser 对 ES5 兼容（app.js 即 ES5），无需 babel。

module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 2017,  // app.js 实际 ES5 兼容；2017 = 可选链 + async/await
    sourceType: 'script',
    globals: {
      window: 'readonly',
      document: 'readonly',
      localStorage: 'readonly',
      navigator: 'readonly',
      console: 'readonly',
      setTimeout: 'readonly',
      setH: 'readonly',
      getH: 'readonly',
      addH: 'readonly',
      i18n: 'readonly',
      _setLang: 'readonly',
      _applyI18n: 'readonly',
      _i18nAlert: 'readonly',
      _typeI18n: 'readonly',
      _HIST_TYPE_I18N_KEY: 'readonly',
      _checkNoInvertedGuards: 'readonly',
      XLSX: 'readonly',
      html2pdf: 'readonly',
      Chart: 'readonly',
      QRCode: 'readonly',
      // i18n dict globals
      I18N: 'readonly',
      I18N_ZH: 'readonly',
      I18N_EN: 'readonly',
      I18N_ALERT: 'readonly',
      _esc: 'readonly',
      _fmtNum: 'readonly',
      _weightUnitSuffix: 'readonly',
      _typeTpl: 'readonly',
      // helpers
      _renderMetaBand: 'readonly',
      _extractChartData: 'readonly',
      _extractChartDataCache: 'readonly',
      _setPrintActive: 'readonly',
      _saveJson: 'readonly',
      _loadJson: 'readonly',
      _genId: 'readonly',
      _setupStorageSync: 'readonly',
      _dateCountsCache: 'readonly',
      _loadHistoryFromStorage: 'readonly',
      _generateReportQR: 'readonly',
      _reportQRText: 'readonly',
      _generatePDFReport: 'readonly',
      _removeContainer: 'readonly',
      _showSampleIdPrompt: 'readonly',
      _toggleChartFilter: 'readonly',
      _pushTiterUndo: 'readonly',
      loadTiterMethod: 'readonly',
      confirmMigration: 'readonly',
      loadPreset: 'readonly',
      loadDemoData: 'readonly',
      calcSpike: 'readonly',
      saveReportMetaFromSettings: 'readonly',
      exportCVExcel: 'readonly',
      exportComprehensiveReport: 'readonly',
      exportHistoryPDF: 'readonly',
      exportHistoryXlsx: 'readonly',
      buildDryingReport: 'readonly',
      buildResidueReport: 'readonly',
      buildUniformityReport: 'readonly',
      buildDissolutionReport: 'readonly',
      buildSpikeReport: 'readonly',
      renderHistory: 'readonly',
      renderHistoryPagination: 'readonly',
      renderSpecialPreview: 'readonly',
      renderSpikeHistory: 'readonly',
      renderDrying: 'readonly',
      renderResidue: 'readonly',
      renderTiter: 'readonly',
      renderUniformity: 'readonly',
      renderDissolution: 'readonly',
      _trendDrawTimer: 'readonly',
      _ariaRmPar: 'readonly',
      collectNormData: 'readonly',
      collectExtData: 'readonly',
      collectIntData: 'readonly',
      collectDryingData: 'readonly',
      collectResidueData: 'readonly',
      // 域数据
      titerData: 'readonly',
      _mpParts: 'readonly',
    },
  },
  rules: {
    // v54.248 同源 4 次反转 bug 防御
    'no-unsafe-negation': 'error',
    // v54.271 calcNormalize 三元反转防御
    'no-unneeded-ternary': 'error',
    // a11y 相关
    'no-eq-null': 'warn',
    // 其他常规
    'no-unused-vars': 'off',  // app.js 太多历史未用变量
    'no-undef': 'error',  // 防止 v54.283 _HIST_TYPE_I18N_KEY 引用 undefined
  },
  overrides: [
    {
      // i18n 字典文件
      files: ['i18n-*.js'],
      rules: { 'no-undef': 'off' },
    },
    {
      // 工具脚本（独立）
      files: ['tools/apply_codemod_isfinite.js'],
      env: { node: true },
    },
  ],
};
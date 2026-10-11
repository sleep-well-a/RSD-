
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = process.argv[2];

function loadObj(file, exportName) {
    const code = fs.readFileSync(file, 'utf-8');
    const sandbox = { window: {}, console: console };
    sandbox.window.global = sandbox;
    // Stub i18n() because i18n-zh.js / i18n-en.js reference it (e.g., copy: i18n('btnCopy'))
    sandbox.i18n = function(key) { return key; };
    sandbox._currentLang = 'en';
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window[exportName];
}
const I18N_ZH = loadObj(path.join(root, 'i18n-zh.js'), 'I18N_ZH');
const I18N_EN = loadObj(path.join(root, 'i18n-en.js'), 'I18N_EN');
const I18N_ALERT = loadObj(path.join(root, 'i18n-alert.js'), 'I18N_ALERT');

// Construct I18N as app.js does
const I18N = {
    zh: I18N_ZH,
    en: I18N_EN,
    alert: I18N_ZH,  // alert dict is shared with zh
    alertEn: I18N_ALERT,
};

function testLang(lang) {
    const _missingI18nKeys = new Set();
    function i18n(key) {
        if (!key || typeof key !== 'string') return '';
        if (typeof I18N === 'undefined' || !I18N) return key;
        if (I18N[lang] && I18N[lang][key]) return I18N[lang][key];
        if (key.indexOf('-') !== -1) {
            const camelKey = key.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
            if (I18N[lang] && I18N[lang][camelKey]) return I18N[lang][camelKey];
            if (lang === 'en' && I18N.alertEn && I18N.alertEn[camelKey]) return I18N.alertEn[camelKey];
            if (lang === 'zh' && I18N.alert && I18N.alert[camelKey]) return I18N.alert[camelKey];
            if (lang === 'zh' && I18N.zh && I18N.zh[camelKey]) return I18N.zh[camelKey];
        }
        if (lang === 'en' && I18N.alertEn && I18N.alertEn[key]) return I18N.alertEn[key];
        if (lang === 'zh' && I18N.alert && I18N.alert[key]) return I18N.alert[key];
        if (lang === 'zh' && I18N.zh && I18N.zh[key]) return I18N.zh[key];
        if (!_missingI18nKeys.has(key)) _missingI18nKeys.add(key);
        return key;
    }
    const tests = lang === 'en' ? [
        ['save', 'Save', 'en direct hit'],
        ['btn-copy', 'Copy', 'kebab→camel: btn-copy'],
        ['card-title-drying-param', 'Drying', 'kebab→camel: 3-hyphen'],
        ['lbl-sample-weight', 'Sample', 'kebab→camel: lbl-sample-weight'],
        ['lbl-theory-content-pct', 'Theoretical', 'kebab→camel: 3-hyphen theory'],
        ['alreadyRecorded', 'Already Recorded', 'newly added key alreadyRecorded'],
        ['cvLinearity', 'Linearity', 'newly added key cvLinearity'],
        ['factoryResetConfirm', 'reset', 'newly added key factoryResetConfirm'],
        ['welcomeTitle', 'Welcome', 'newly added key welcomeTitle'],
        ['nonexistent_key_xyz123', 'nonexistent_key_xyz123', 'missing key returns as-is'],
        [null, '', 'null key returns empty'],
        [undefined, '', 'undefined key returns empty'],
        ['', '', 'empty key returns empty'],
    ] : [
        ['save', '保存', 'zh direct hit'],
        ['btn-copy', '复制', 'kebab→camel zh: btn-copy'],
        ['card-title-drying-param', '干燥', 'kebab→camel zh: 3-hyphen'],
        ['alreadyRecorded', '已有', 'newly added key zh: alreadyRecorded'],
        ['welcomeTitle', '欢迎', 'newly added key zh: welcomeTitle'],
        ['nonexistent_key_xyz123', 'nonexistent_key_xyz123', 'missing key returns as-is'],
        [null, '', 'null key returns empty'],
    ];
    let pass = 0, fail = 0;
    for (const [key, expected, desc] of tests) {
        const got = i18n(key);
        const ok = (typeof expected === 'string' && got.toLowerCase().includes(expected.toLowerCase()));
        if (ok) pass++;
        else { fail++; console.log(`  [FAIL ${lang}] ${desc}: key="${key}" got="${got}" expected contains="${expected}"`); }
    }
    console.log(`[${lang}] Smoke: ${pass}/${pass+fail}`);
    return fail === 0;
}

const en_ok = testLang('en');
const zh_ok = testLang('zh');
process.exit(en_ok && zh_ok ? 0 : 1);

// extract_i18n_full.js — 输出 i18n dict 的所有 (key, value) 对（JSON）
const fs = require('fs');
const vm = require('vm');

function loadDict(file) {
  const code = fs.readFileSync(file, 'utf-8');
  const sandbox = { window: {}, console: console };
  sandbox.window.global = sandbox;
  sandbox.i18n = function(key) { return key; };
  sandbox._currentLang = 'en';
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const exportNames = Object.keys(sandbox.window).filter(k => k.startsWith('I18N_'));
  const result = {};
  for (const exportName of exportNames) {
    const dict = sandbox.window[exportName];
    const entries = {};
    for (const k of Object.keys(dict)) {
      entries[k] = String(dict[k]);
    }
    result[exportName] = entries;
  }
  return result;
}

const file = process.argv[2];
const dict = loadDict(file);
process.stdout.write(JSON.stringify(dict));

// extract_dict_keys.js — 输出每个 I18N_* dict 的所有 keys（JSON）
const fs = require('fs');
const vm = require('vm');

function loadDict(file) {
  const code = fs.readFileSync(file, 'utf-8');
  const sandbox = { window: {}, console: console };
  sandbox.window.global = sandbox;
  // v54.298 fix: i18n() stub (一些 dict value 用 i18n() 委托，如 copy: i18n('btnCopy'))
  sandbox.i18n = function(key) { return key; };
  sandbox._currentLang = 'en';
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const exportNames = Object.keys(sandbox.window).filter(k => k.startsWith('I18N_'));
  const result = {};
  for (const exportName of exportNames) {
    result[exportName] = Object.keys(sandbox.window[exportName]);
  }
  return result;
}

const file = process.argv[2];
const dicts = loadDict(file);
process.stdout.write(JSON.stringify(dicts));

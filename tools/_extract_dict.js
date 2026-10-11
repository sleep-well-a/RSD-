// extract_dict.js — extract i18n dict as JSON lines
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = 'F:/自制软件/';

function loadDict(file, exportName) {
    const code = fs.readFileSync(file, 'utf-8');
    const sandbox = { window: {}, console: console };
    sandbox.window.global = sandbox;
    sandbox.i18n = function(key) { return key; };
    sandbox._currentLang = 'en';
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window[exportName];
}

const basename = process.argv[2];
const exportName = process.argv[3];
const file = path.join(ROOT, basename);
const dict = loadDict(file, exportName);
const out = [];
for (const k of Object.keys(dict)) {
    const v = dict[k];
    out.push(JSON.stringify({k, v}));
}
process.stdout.write(out.join('\n'));

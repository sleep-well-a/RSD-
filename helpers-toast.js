function _dismissToastsByPrefix(prefix){
 
 try{
 const els = document.querySelectorAll('[data-toast-key]');
 els.forEach(el =>{
 const k = el.dataset.toastKey || '';
 if(k.indexOf(prefix) === 0){
 el.classList.add('toast-exit');
 setTimeout(() => el.remove(), 300);
}
});
} catch(e){}
}
function _onConnChange(){
 if(typeof _isPoorConnection !== 'function') return;
 const isPoor = _isPoorConnection();
 
 if(_connPrevPoor === null){
 _connPrevPoor = isPoor;
 return;
}
 
 if(isPoor === _connPrevPoor) return;
 _connPrevPoor = isPoor;
 if(isPoor){
 
 if(typeof toast === 'function'){
 const q =(typeof _getConnQuality === 'function') ? _getConnQuality() :{ type: 'unknown'};
 _i18nToast('toast_networkWeakPdfDegrade', 'warn', 4000, q.type);
}
} else{
 
 _dismissToastsByPrefix(_weakNetToastPrefix());
 if(typeof toast === 'function'){
 _i18nToast('toast_networkRecovered', 'success', 2500);
}
}
}
function _setupConnListener(){
 if(_connListenerSetup) return;
 _connListenerSetup = true;
 const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
 if(!c || typeof c.addEventListener !== 'function') return;
 try{
 c.addEventListener('change', _onConnChange);
} catch(e){
 
}
}
function _updateOnlineUI(){
 const h = document.getElementById('app-header');
 if(!h) return;
 
 h.setAttribute('data-online', navigator.onLine ? 'true' : 'false');
 if(!navigator.onLine){
 
 return;
}
 
 fetch(location.href,{ method: 'HEAD', cache: 'no-store'})
.then(r =>{
 const ok = r &&(r.ok || r.status === 0);
 h.setAttribute('data-online', ok ? 'true' : 'false');
 if(!ok) _probeFallback(h);
})
.catch(() =>{
 
 _probeFallback(h);
});
}
function _probeFallback(h){
 
 h = h || document.getElementById('app-header');
 if(!h) return;
 const img = new Image();
 let settled = false;
 const onResult =(online) =>{
 if(settled) return; settled = true;
 h.setAttribute('data-online', online ? 'true' : 'false');
 if(!online) _i18nToast('toast_networkDisconnected', 'warn', 3000);
};
 img.onload =() => onResult(true);
 img.onerror =() => onResult(false);
 img.src = '/favicon.ico?_=' + Date.now();
 setTimeout(() => onResult(false), 3000); 
}
window.addEventListener('online', _updateOnlineUI);
window.addEventListener('offline', _updateOnlineUI);
document.addEventListener('DOMContentLoaded',() =>{ try{ _updateOnlineUI();} catch(e){ console.error('[init] _updateOnlineUI', e);}});
document.addEventListener('DOMContentLoaded',() =>{ try{ _setupConnListener();} catch(e){ console.error('[init] _setupConnListener', e);}});

let _onlineProbeTimer = null;
function _startOnlineProbe(){
 if(_onlineProbeTimer) return;
 _onlineProbeTimer = setInterval(_updateOnlineUI, 30000);
}
function _stopOnlineProbe(){
 if(_onlineProbeTimer){ clearInterval(_onlineProbeTimer); _onlineProbeTimer = null;}
}
_startOnlineProbe();
document.addEventListener('visibilitychange',() =>{
 if(document.hidden) _stopOnlineProbe();
 else{ _updateOnlineUI(); _startOnlineProbe();}
});

function _setSyncStatus(msg){
 const el = document.getElementById('sync-status');
 if(el) el.textContent = msg || '';
}
function syncAll(){
 return _withBtnLoading(function(){
 _setSyncStatus(i18n('syncing'));
 try{

 setTimeout(() => _setSyncStatus(i18n('syncDone')), 800);
} catch(e){
 _setSyncStatus(i18n('syncFailed'));
 console.error('[syncAll]', e);
}
}).apply(this, arguments);
}

function confirmMigration(){
 try{ localStorage.setItem('rsd-migration-shown', '1');} catch(e){}
 closeMigrationDialog();
 syncAll();
}
function closeMigrationDialog(){
 const ov = document.getElementById('migration-overlay');
 if(ov) ov.style.display = 'none';
}
function _openOverlayWithFocusTrap(overlayId, dialogSelector, closeFn){
 const ov = document.getElementById(overlayId);
 if(!ov) return;
 // v54.240 fix: 防止重复调用累积 listener（v54.233/238 同款 addEventListener 累积问题）
 // 每次 open 之前先清理旧的 cleanup（如果存在）
 if(typeof ov._focusTrapCleanup === 'function'){
   try { ov._focusTrapCleanup(); } catch(_){}
 }
 ov.style.display = 'flex';
 let dialog = ov.querySelector(dialogSelector || '[role="dialog"]');
 // v54.230 修复：若 overlay 自己 role=dialog 但内部没匹配，让 overlay 自己作为 dialog
 if(!dialog && ov.getAttribute('role') === 'dialog') dialog = ov;
 if(!dialog) return;
 // v54.244 fix (Round 8 #3): 重新查询 focusables（dialog 内容可能在 open 后变化）
 const queryFocusables =() => dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
 const focusables = queryFocusables();
 const prevFocus = document.activeElement;
 const onKey =(e) =>{
 if(e.key === 'Escape'){ e.preventDefault(); closeFn();}
 if(e.key !== 'Tab') return;
 // v54.244 fix: 每次 Tab 重新查询（dialog 内容可能变化导致 stale snapshot）
 const focusablesNow = queryFocusables();
 if(!focusablesNow.length) return;
 const first = focusablesNow[0], last = focusablesNow[focusablesNow.length - 1];
 if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus();}
 else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus();}
};
 // v54.231: click-outside-to-close (a11y B#5) — 点 overlay 背景（非 dialog 本身）关闭
 const onBackdropClick =(e) =>{ if(e.target === ov) closeFn();};
 ov._focusTrapCleanup =() =>{
 ov.removeEventListener('keydown', onKey);
 ov.removeEventListener('mousedown', onBackdropClick);
 ov._focusTrapCleanup = null;
 if(prevFocus && prevFocus.focus) prevFocus.focus();
};
 ov.addEventListener('keydown', onKey);
 ov.addEventListener('mousedown', onBackdropClick);
 setTimeout(() =>{ if(focusables[0]) focusables[0].focus();}, 50);
}
function openMigrationDialog(){
 _openOverlayWithFocusTrap('migration-overlay', '#migration-dialog', closeMigrationDialog);
}
function _maybeShowMigration(){
 
 if(localStorage.getItem('rsd-migration-shown')) return;
 let count = 0;
 try{ count = JSON.parse(localStorage.getItem('rsd-calc-history') || '[]').length;} catch(e){}
 
 if(count > 0 && !localStorage.getItem('rsd-migration-shown')){
 openMigrationDialog();
}
}
document.addEventListener('DOMContentLoaded',() =>{ try{ _maybeShowMigration();} catch(e){ console.error('[init] _maybeShowMigration', e);}});

const _pulsedCards = new Set();
// v54.228 fix: resize 事件重复触发 _updateScrollHints，每次都给同一 .card 重新 addEventListener → 监听器泄露
// 修复：用 _scrollHintBound 标志避免重复绑定，但 resize 时仍然需要重新计算 hint classes（仅重跑 update，不 bind）
function _updateScrollHints(){
 document.querySelectorAll('.card').forEach(function(card){
 if(!card.querySelector('.matrix-table, table')) return;
 function update(){
 const overflow = card.scrollWidth > card.clientWidth;
 if(!overflow){ card.classList.remove('scroll-hint-left', 'scroll-hint-right', 'scroll-hint-both', 'scroll-hint-pulse'); return;}
 const atLeft = card.scrollLeft <= 2;
 const atRight = card.scrollLeft + card.clientWidth >= card.scrollWidth - 2;
 card.classList.remove('scroll-hint-left', 'scroll-hint-right', 'scroll-hint-both');
 if(atLeft && atRight) card.classList.add('scroll-hint-both');
 else if(atLeft) card.classList.add('scroll-hint-right');
 else if(atRight) card.classList.add('scroll-hint-left');
 else card.classList.add('scroll-hint-both');

 if(!_pulsedCards.has(card)){
 _pulsedCards.add(card);
 card.classList.add('scroll-hint-pulse');
 setTimeout(function(){ card.classList.remove('scroll-hint-pulse');}, 1200);
}
}
 if(card._scrollHintBound){
 // 已经绑过 listener：本次只重跑初始 update（让 resize 后的新宽度触发正确的 hint class）
 setTimeout(update, 50);
 return;
}
 card._scrollHintBound = true;
 card.addEventListener('scroll', update,{ passive: true});
 setTimeout(update, 50);
});
}
window.addEventListener('resize', _updateScrollHints);
document.addEventListener('DOMContentLoaded',() =>{ try{ _updateScrollHints();} catch(e){ console.error('[init] _updateScrollHints', e);}});
// v54.230 a11y: 初始化 tab/subtab ARIA 角色
document.addEventListener('DOMContentLoaded',() =>{ try{ _initTabAria();} catch(e){ console.error('[init] _initTabAria', e);}});

function _getToastContainer(){
 let c = document.getElementById('toast-container');
 if(!c){ c = document.createElement('div'); c.id = 'toast-container'; c.setAttribute('role', 'status'); c.setAttribute('aria-live', 'polite'); c.setAttribute('aria-atomic', 'false'); document.body.appendChild(c);}
 return c;
}

// v54.243 a11y (LOW P1): error toast 必须用 assertive live region，否则 SR 用户要等 polite 队列清空
// 实现：在创建 error toast 期间临时把 container 的 aria-live 切到 assertive，立即创建后还原
let _toastPrevLive = null;
function _withAssertiveLive(container, fn){
 if(!container){ return fn(); }
 const prev = container.getAttribute('aria-live');
 if(prev !== 'assertive'){
 container.setAttribute('aria-live', 'assertive');
 _toastPrevLive = prev;
 }
 try { return fn(); }
 finally {
 if(_toastPrevLive !== null){
 container.setAttribute('aria-live', _toastPrevLive);
 _toastPrevLive = null;
 }
 }
}

const _toastThrottle = new Map();
const _TOAST_THROTTLE_MAX = 100; 


function _toastTouch(key){
 if(!_toastThrottle.has(key)) return;
 const val = _toastThrottle.get(key);
 _toastThrottle.delete(key);
 _toastThrottle.set(key, val);
}
function _toastThrottleGC(){
 if(_toastThrottle.size <= _TOAST_THROTTLE_MAX) return;
 
 const toDelete = _toastThrottle.size - _TOAST_THROTTLE_MAX;
 const iter = _toastThrottle.keys();
 for(let i = 0; i < toDelete; i++){
 const k = iter.next().value;
 if(k !== undefined) _toastThrottle.delete(k);
}
}
function _shouldThrottle(key, windowMs = 60000, maxMs = 3600000){
 const now = Date.now();
 const last = _toastThrottle.get(key);
 if(last && now - last.ts < windowMs){ last.count++; last.ts = now; _toastTouch(key); _toastThrottleGC(); return true;}
 
 if(last && last.count >= 3){
 
 const newWindow = Math.min(windowMs * Math.pow(2, Math.min(last.count - 3, 6)), maxMs);
 if(now - last.ts < newWindow){ last.count++; last.ts = now; _toastTouch(key); _toastThrottleGC(); return true;}
}
 _toastThrottle.set(key,{ ts: now, count: 1});
 _toastThrottleGC();
 return false;
}
function _dismissOldToasts(key){
 
 const container = _getToastContainer();
 container?.querySelectorAll('.toast').forEach(el =>{
 if(el.dataset.toastKey === key) el.remove();
});
}
/* v54.274 fix (correctness #1 / XSS): toast msg 之前直接拼进 innerHTML，未转义。
   sink 可达：配方名（CSV 导入 / 重命名）、filename（含 sampleName/batch/err.message）、err.message。
   攻击链：导入含 <img src=x onerror=...> 的配方名 → 下次 toast 触发 stored XSS。
   局部 escape（不依赖 app.js 的 _esc —— helpers-toast.js 先于 app.js 加载）。 */
function _escToastHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function toast(msg, type = 'info', duration = 3000){
 const container = _getToastContainer();
 const key =(type || 'info') + ':' +(msg || '');
 const isError = type === 'error';
 // v54.273 fix: aria-label 用 i18n（之前硬编码 "Close"，v54.249 注释说"避免改 i18n-data.js" — 现在加 key）
 const closeBtnHtml = '<button type="button" class="toast-close" aria-label="' + i18n('toastClose') + '" style="background:none;border:none;font-size:16px;line-height:1;padding:0 4px;cursor:pointer;color:inherit;opacity:0.6;flex-shrink:0" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6" onclick="this.parentElement.remove()">×</button>';

 if(_toastThrottle.has(key) && _shouldThrottle(key)){
 const info = _toastThrottle.get(key);
 _dismissOldToasts(key);
 const build = () => {
 const el = document.createElement('div');
 el.className = 'toast toast-' + type +(info.count >= 5 ? ' toast-suppressed' : '');
 el.dataset.toastKey = key;
 el.dataset.toastCount = info.count;

 const suppressedHint = info.count >= 5 ? '<div style="font-size:10px;color:#666;margin-top:2px">' + i18n('toastSuppressedHintFmt').replace('{0}', info.count) + '</div>' : ''; /* v54.274 fix (i18n #9): 硬编码中文 → i18n 模板 */
 el.innerHTML = '<span class="toast-icon">' +(type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warn' ? '⚠' : 'ℹ') + '</span><div class="toast-msg" style="flex:1"><div>' + _escToastHtml(msg) + '<span class="toast-count">×' + info.count + '</span></div>' + suppressedHint + '</div>' + closeBtnHtml;
 container.appendChild(el);
 if(duration > 0){
 setTimeout(() => el.classList.add('toast-exit'), duration - 300);
 setTimeout(() => el.remove(), duration);
}
 return el;
};
 return isError ? _withAssertiveLive(container, build) : build();
}
 _toastThrottle.set(key,{ ts: Date.now(), count: 1});
 _toastThrottleGC();
 const build = () => {
 const el = document.createElement('div');
 el.className = 'toast toast-' + type;
 el.dataset.toastKey = key;
 el.innerHTML = '<span class="toast-icon">' +(type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warn' ? '⚠' : 'ℹ') + '</span><div class="toast-msg" style="flex:1">' + _escToastHtml(msg) + '</div>' + closeBtnHtml;
 container.appendChild(el);
 if(duration > 0){
 setTimeout(() => el.classList.add('toast-exit'), duration - 300);
 setTimeout(() => el.remove(), duration);
}
 return el;
};
 return isError ? _withAssertiveLive(container, build) : build();
}

const _origAlert = window.alert;
window.alert = function(msg){ toast(String(msg || ''), 'warn', 4000);};

const _origConfirm = window.confirm;
function _confirmDialog(msg, opts ={}){
 return new Promise(resolve =>{
 const ov = document.getElementById('confirm-overlay');
 const dialog = document.getElementById('confirm-dialog');
 const msgEl = document.getElementById('confirm-msg');
 const okBtn = document.getElementById('confirm-ok-btn');
 const cancelBtn = document.getElementById('confirm-cancel-btn');
 if(!ov || !dialog){ resolve(_origConfirm(msg)); return;}
 msgEl.textContent = String(msg || '');
 okBtn.textContent = opts.okText || i18n('btnConfirm');
 cancelBtn.textContent = opts.cancelText || i18n('btnCancel');
 
 if(opts.danger){ okBtn.classList.remove('btn-primary'); okBtn.classList.add('btn-danger');}
 else{ okBtn.classList.remove('btn-danger'); okBtn.classList.add('btn-primary');}
 const prevFocus = document.activeElement;
 const cleanup =(result) =>{
 ov.style.display = 'none';
 okBtn.onclick = null; cancelBtn.onclick = null;
 ov.onclick = null;
 document.removeEventListener('keydown', onKey);
 if(prevFocus && prevFocus.focus) prevFocus.focus();
 resolve(result);
};
 const onKey =(e) =>{
 if(e.key === 'Escape'){ e.preventDefault(); cleanup(false);}
 if(e.key === 'Enter' && document.activeElement === okBtn){ e.preventDefault(); cleanup(true);}
 
 if(e.key === 'Tab'){
 const focusables =[okBtn, cancelBtn];
 const i = focusables.indexOf(document.activeElement);
 if(e.shiftKey && i <= 0){ e.preventDefault(); focusables[focusables.length - 1].focus();}
 else if(!e.shiftKey && i === focusables.length - 1){ e.preventDefault(); focusables[0].focus();}
}
};
 okBtn.onclick =() => cleanup(true);
 cancelBtn.onclick =() => cleanup(false);
 // v54.251 a11y verify: backdrop click → cleanup(false) 等同取消（与 _openOverlayWithFocusTrap 一致）
 ov.onclick =(e) =>{ if(e.target === ov) cleanup(false);};
 document.addEventListener('keydown', onKey);
  });
}
// v54.115 i18n toast helper（统一包装 toast(i18n(key) + 占位符替换)）
// 用法：_i18nToast(key, type, duration, ...args) → toast(模板字符串, type, duration)
// 占位符：{0}, {1}, ... 用 args[i] 替换
function _i18nToast(key, type, duration) {
  // 直接走 i18n(key) 路径（已支持 zh.alert/en.alertEn 回退）
  if (typeof i18n === 'function') {
    var tmpl = i18n(key);
    // i18n 返回原 key 表示字典未命中 → fallback 调原 toast(key, ...)
    if (tmpl !== key) {
      // v54.282 perf: 收集额外参数一次 .replace()（N 占位符 → 1 regex.replace，O(N) → O(1) 字符串分配）
      var args = Array.prototype.slice.call(arguments, 3);
      var msg = args.length ? tmpl.replace(/\{(\d+)\}/g, function(_, n) {
        var idx = parseInt(n, 10);
        return String(args[idx] != null ? args[idx] : '');
      }) : tmpl;
      return toast(msg, type, duration);
    }
  }
  // key 不存在时仍尝试 toast 原 key（避免漏改造成完全失效）
  return toast(key, type, duration);
}
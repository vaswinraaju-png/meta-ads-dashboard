// ─────────────────────────────────────────────────────────────
// SETTINGS PAGE — stores Meta credentials in browser localStorage
// ─────────────────────────────────────────────────────────────
const LS_KEYS = 'wl_meta_keys_v1';

function loadKeys(){
  try{ return JSON.parse(localStorage.getItem(LS_KEYS) || '{}'); }
  catch{ return {}; }
}
function saveKeysToStorage(k){ localStorage.setItem(LS_KEYS, JSON.stringify(k)); }

function loadSettingsIntoUI(){
  const k = loadKeys();
  if(el('set-token')) el('set-token').value = k.token || '';
  if(el('set-acct')) el('set-acct').value = k.acct || '';
  if(el('set-page')) el('set-page').value = k.pageId || '';
  if(el('set-ig')) el('set-ig').value = k.igId || '';
}

function saveSettings(){
  const k = {
    token: el('set-token').value.trim(),
    acct: el('set-acct').value.trim(),
    pageId: el('set-page').value.trim(),
    igId: el('set-ig').value.trim()
  };
  saveKeysToStorage(k);
  APP.TOKEN = k.token;
  APP.ACCT = k.acct;
  APP.SOC_FB_PAGE_ID = k.pageId;
  APP.SOC_IG_ID = k.igId;
  const okEl = el('settings-ok');
  if(okEl){ okEl.textContent='Saved to this browser ✓'; okEl.classList.remove('hidden'); setTimeout(()=>okEl.classList.add('hidden'),3000); }
}

function clearSettings(){
  localStorage.removeItem(LS_KEYS);
  APP.TOKEN=''; APP.ACCT=''; APP.SOC_FB_PAGE_ID=''; APP.SOC_IG_ID='';
  loadSettingsIntoUI();
}

document.addEventListener('DOMContentLoaded', loadSettingsIntoUI);

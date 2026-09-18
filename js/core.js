// ─────────────────────────────────────────────────────────────
// CORE — shared state, config (from localStorage), formatters,
// direct-to-Graph-API fetch (no backend dependency)
// ─────────────────────────────────────────────────────────────
const APP = {
  TOKEN: '', ACCT: '', SOC_FB_PAGE_ID: '', SOC_IG_ID: '',
  allCamps: [], allAds: [], allCreatives: [],
  dailyRaw: [], from: '', to: '',
  currentCamp: 'ALL', currentAdset: 'ALL', currentAd: 'ALL',
  charts: {}
};

const LS_TARGETS = 'wl_targets_v1';
const LS_EXP = 40 * 24 * 60 * 60 * 1000;
const GRAPH = 'https://graph.facebook.com';

function el(id){ return document.getElementById(id); }
function fmt(n,d=0){ if(n==null||isNaN(n)) return '—'; return Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtC(n){ if(!n||isNaN(n)) return '—'; return '₹'+fmt(n,0); }
function trunc(s,n=60){ if(!s) return ''; return s.length>n ? s.slice(0,n)+'…' : s; }
function escapeHtml(str){ if(!str) return ''; return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

function getLeads(actions){
  if(!actions || !actions.length) return 0;
  const TYPES=['lead','onsite_conversion.lead_grouped','onsite_conversion.messaging_first_reply','contact_total','leadgen.other'];
  let max=0;
  actions.forEach(a=>{ if(TYPES.includes(a.action_type)){ const v=parseFloat(a.value||0); if(v>max) max=v; } });
  return max;
}

function loadTargets(){
  try{
    const r=localStorage.getItem(LS_TARGETS);
    if(!r) return {budget:0,leads:0};
    const p=JSON.parse(r);
    if(Date.now()-(p._s||0)>LS_EXP){ localStorage.removeItem(LS_TARGETS); return {budget:0,leads:0}; }
    return p.d || {budget:0,leads:0};
  }catch{ return {budget:0,leads:0}; }
}
function saveTargets(d){ localStorage.setItem(LS_TARGETS, JSON.stringify({_s:Date.now(), d})); }

function applyBrand(){
  const b = window.BRAND || {};
  const root = document.documentElement.style;
  if(b.colors){
    root.setProperty('--c-primary', b.colors.primary);
    root.setProperty('--c-accent', b.colors.accent);
    root.setProperty('--c-accent2', b.colors.accent2);
    root.setProperty('--c-success', b.colors.success);
    root.setProperty('--c-warning', b.colors.warning);
    root.setProperty('--c-danger', b.colors.danger);
    root.setProperty('--c-bg', b.colors.bg);
    root.setProperty('--c-surface', b.colors.surface);
    root.setProperty('--c-surface2', b.colors.surface2);
    root.setProperty('--c-border', b.colors.border);
    root.setProperty('--c-border2', b.colors.border2);
    root.setProperty('--c-text', b.colors.text);
    root.setProperty('--c-muted', b.colors.muted);
  }
  if(b.fonts){
    root.setProperty('--f-display', b.fonts.display);
    root.setProperty('--f-body', b.fonts.body);
    root.setProperty('--f-mono', b.fonts.mono);
  }
  if(b.fontImportUrl){
    const link=document.createElement('link');
    link.rel='stylesheet'; link.href=b.fontImportUrl;
    document.head.appendChild(link);
  }
  if(el('brand-logo')) el('brand-logo').src = b.logoUrl || '';
  if(el('brand-name')) el('brand-name').textContent = b.agencyName || 'Agency';
  if(el('brand-sub')) el('brand-sub').textContent = b.productName || 'Ads Dashboard';
  document.title = (b.agencyName||'Agency') + ' · ' + (b.productName||'Ads Dashboard');
  const favicon=document.querySelector('link[rel="icon"]');
  if(favicon && b.favicon) favicon.href = b.favicon;
}

// ── CONFIG: read Meta credentials from localStorage (set on Settings page) ──
function loadConfig(){
  try{
    const k = JSON.parse(localStorage.getItem('wl_meta_keys_v1') || '{}');
    APP.TOKEN = k.token || '';
    APP.ACCT = k.acct || '';
    APP.SOC_FB_PAGE_ID = k.pageId || '';
    APP.SOC_IG_ID = k.igId || '';
  }catch(e){}
  if(!APP.TOKEN || !APP.ACCT){
    showErr('No Meta access token / ad account set. Go to Settings to add them.');
  }
}

// ── Direct Graph API call — replaces the old backend proxy ──
// endpoint: e.g. "v17.0/act_123/insights?fields=..." (no access_token param — added here)
async function graphFetch(endpoint){
  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `${GRAPH}/${endpoint}${sep}access_token=${encodeURIComponent(APP.TOKEN)}`;
  const res = await fetch(url);
  return res.json();
}

function showErr(m){ const e=el('error-box'); if(!e) return; e.textContent=m; e.classList.remove('hidden'); }
function hideErr(){ const e=el('error-box'); if(e) e.classList.add('hidden'); }
function showLoad(v){ const e=el('loading-box'); if(!e) return; if(v){ e.textContent = typeof v==='string' ? v : 'Fetching from Facebook Graph API'; e.classList.remove('hidden'); } else e.classList.add('hidden'); }

// ── CASCADING FILTERS ──
function rebuildCampDropdown(){
  const camps=[...new Set(APP.allCamps.map(c=>c.campaign))].sort();
  const s=el('camp-select');
  if(!s) return;
  s.innerHTML='<option value="ALL">All Campaigns</option>'+camps.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(trunc(c,40))}</option>`).join('');
  s.disabled = camps.length===0; s.value='ALL';
  rebuildAdsetDropdown();
}
function rebuildAdsetDropdown(){
  let filtered=APP.allCamps;
  if(APP.currentCamp!=='ALL') filtered=filtered.filter(c=>c.campaign===APP.currentCamp);
  const adsets=[...new Set(filtered.map(c=>c.name))].sort();
  const s=el('adset-select');
  if(!s) return;
  s.innerHTML='<option value="ALL">All Adsets</option>'+adsets.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(trunc(a,40))}</option>`).join('');
  s.disabled = adsets.length===0; s.value='ALL';
  rebuildAdDropdown();
}
function rebuildAdDropdown(){
  let filtered=APP.allAds;
  if(APP.currentCamp!=='ALL') filtered=filtered.filter(a=>a.campaign===APP.currentCamp);
  if(APP.currentAdset!=='ALL') filtered=filtered.filter(a=>a.adsetName===APP.currentAdset);
  const ads=[...new Set(filtered.map(a=>a.name))].sort();
  const s=el('ad-select');
  if(!s) return;
  s.innerHTML='<option value="ALL">All Ads</option>'+ads.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(trunc(a,40))}</option>`).join('');
  s.disabled = ads.length===0; s.value='ALL';
}
function getFilteredRows(){
  let source = APP.currentAd!=='ALL' ? APP.allAds : APP.allCamps;
  if(APP.currentCamp!=='ALL') source=source.filter(r=>r.campaign===APP.currentCamp);
  if(APP.currentAdset!=='ALL') source=source.filter(r=>(r.adsetName||r.name)===APP.currentAdset);
  if(APP.currentAd!=='ALL') source=source.filter(r=>r.name===APP.currentAd);
  return source;
}

function setCampFilter(v){ APP.currentCamp=v; APP.currentAdset='ALL'; APP.currentAd='ALL'; rebuildAdsetDropdown(); window.applyAllFilters && window.applyAllFilters(); }
function setAdsetFilter(v){ APP.currentAdset=v; APP.currentAd='ALL'; rebuildAdDropdown(); window.applyAllFilters && window.applyAllFilters(); }
function setAdFilter(v){ APP.currentAd=v; window.applyAllFilters && window.applyAllFilters(); }

// ── FETCH ALL (adset + ad level insights) — direct to Graph API ──
async function fetchAll(){
  hideErr();
  if(!APP.TOKEN || !APP.ACCT){ showErr('Add your Meta access token and ad account ID in Settings first.'); return; }
  const from=el('dt-from').value, to=el('dt-to').value;
  if(!from||!to){ showErr('Select both dates.'); return; }
  APP.from=from; APP.to=to;
  showLoad(true);
  try{
    const insFields='campaign_name,adset_name,spend,impressions,clicks,frequency,cpm,ctr,actions';
    const adInsFields='ad_id,ad_name,campaign_name,adset_name,adset_id,spend,impressions,reach,clicks,frequency,cpm,ctr,actions';

    const [ins, daily, adIns] = await Promise.all([
      graphFetch(`v17.0/${APP.ACCT}/insights?fields=${insFields}&level=adset&time_range={"since":"${from}","until":"${to}"}&limit=500`),
      graphFetch(`v17.0/${APP.ACCT}/insights?fields=spend,actions&level=account&time_increment=1&time_range={"since":"${from}","until":"${to}"}&limit=90`),
      graphFetch(`v17.0/${APP.ACCT}/insights?fields=${adInsFields}&level=ad&time_range={"since":"${from}","until":"${to}"}&limit=500`)
    ]);

    if(ins.error){
      const c=ins.error.code;
      if(c===190) showErr('Token expired or invalid. Update it in Settings.');
      else if(c===100) showErr('Invalid Ad Account ID. Check Settings.');
      else if(c===10||c===200) showErr('Permission denied: token needs ads_read + read_insights. '+ins.error.message);
      else showErr('FB Ads API error ('+c+'): '+ins.error.message);
      showLoad(false); return;
    }
    if(!ins.data?.length){ showErr('No adset data for this date range.'); showLoad(false); return; }

    APP.dailyRaw = daily.data || [];
    processAdsetData(ins.data);

    let adRows = adIns.data || [];
    let nextCursor = adIns.paging?.cursors?.after;
    let pageCount=1;
    while(nextCursor && pageCount<10){
      showLoad(`Fetching ads page ${pageCount+1}...`);
      const nextData = await graphFetch(`v17.0/${APP.ACCT}/insights?fields=${adInsFields}&level=ad&time_range={"since":"${from}","until":"${to}"}&limit=500&after=${nextCursor}`);
      if(nextData.error || !nextData.data?.length) break;
      adRows = adRows.concat(nextData.data);
      nextCursor = nextData.paging?.cursors?.after;
      pageCount++;
    }
    showLoad(true);
    processAdData(adRows);

    rebuildCampDropdown();
    window.applyAllFilters && window.applyAllFilters();
    window.buildCreatives && window.buildCreatives();
    showLoad(false);
  }catch(e){
    showErr('Unexpected error: '+e.message);
    showLoad(false);
  }
}

function processAdsetData(rows){
  const map={};
  rows.forEach(r=>{
    const k=(r.adset_name||r.campaign_name)+'|||'+(r.campaign_name||'');
    if(!map[k]) map[k]={name:r.adset_name||r.campaign_name, campaign:r.campaign_name, spend:0,impressions:0,clicks:0,leads:0,freq:0,freqN:0};
    const c=map[k];
    c.spend+=parseFloat(r.spend||0); c.impressions+=parseInt(r.impressions||0); c.clicks+=parseInt(r.clicks||0);
    c.leads+=getLeads(r.actions);
    if(r.frequency){ c.freq+=parseFloat(r.frequency); c.freqN++; }
  });
  APP.allCamps = Object.values(map).sort((a,b)=>b.spend-a.spend);
}

function processAdData(rows){
  const map={};
  rows.forEach(r=>{
    const adId=r.ad_id||''; if(!adId) return;
    if(!map[adId]) map[adId]={
      id:adId, name:r.ad_name||'—', adsetName:r.adset_name||'—', adsetId:r.adset_id||'',
      campaign:r.campaign_name||'—', spend:0,impressions:0,reach:0,clicks:0,leads:0,freq:0,freqN:0, creative:null
    };
    const c=map[adId];
    c.spend+=parseFloat(r.spend||0); c.impressions+=parseInt(r.impressions||0); c.reach+=parseInt(r.reach||0);
    c.clicks+=parseInt(r.clicks||0); c.leads+=getLeads(r.actions);
    if(r.frequency){ c.freq+=parseFloat(r.frequency); c.freqN++; }
  });
  APP.allAds = Object.values(map).sort((a,b)=>b.spend-a.spend);
}

document.addEventListener('DOMContentLoaded', applyBrand);

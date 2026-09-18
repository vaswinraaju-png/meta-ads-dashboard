// ─────────────────────────────────────────────────────────────
// OVERVIEW PAGE
// ─────────────────────────────────────────────────────────────
let C_daily=null;

window.applyAllFilters = function(){
  const filtered = getFilteredRows();
  renderKPIs(filtered);
  renderProgress(filtered);
  renderTable(filtered);
  renderDaily(APP.dailyRaw, APP.from, APP.to);
};

function renderKPIs(rows){
  const t = loadTargets();
  const tS = rows.reduce((s,c)=>s+c.spend,0);
  const tI = rows.reduce((s,c)=>s+c.impressions,0);
  const tC = rows.reduce((s,c)=>s+c.clicks,0);
  const tL = rows.reduce((s,c)=>s+c.leads,0);
  const fArr = rows.filter(c=>c.freqN>0).map(c=>c.freq/c.freqN);
  const aF = fArr.length ? fArr.reduce((a,b)=>a+b,0)/fArr.length : 0;

  el('k-spend').textContent = fmtC(tS);
  el('k-leads').textContent = fmt(Math.round(tL));
  el('k-cpl').textContent = tL>0 ? fmtC(tS/tL) : '—';
  el('k-ctr').textContent = tI>0 ? (tC/tI*100).toFixed(2)+'%' : '—';
  el('k-cpm').textContent = tI>0 ? fmtC(tS/tI*1000) : '—';
  el('k-freq').textContent = aF.toFixed(1)+'x';
  el('k-totbudget').textContent = t.budget ? fmtC(t.budget) : '—';
  el('k-budgetpct').textContent = t.budget>0 ? (tS/t.budget*100).toFixed(0)+'%' : '—';
  el('k-leadtgt').textContent = t.leads ? fmt(t.leads) : '—';
  el('k-leadpct').textContent = t.leads>0 ? (tL/t.leads*100).toFixed(0)+'%' : '—';
}

function renderProgress(rows){
  const t = loadTargets();
  const totS = rows.reduce((s,c)=>s+c.spend,0);
  const totL = rows.reduce((s,c)=>s+c.leads,0);

  const lp = t.leads>0 ? Math.min(totL/t.leads*100,110) : 0;
  el('pg-leads-val').textContent = fmt(Math.round(totL));
  el('pg-leads-of').textContent = 'of '+fmt(t.leads||0)+' target';
  el('pg-leads-fill').style.width = Math.min(lp,100).toFixed(1)+'%';
  el('pg-leads-fill').style.background = lp>=100 ? 'var(--c-success)' : lp>70 ? 'var(--c-warning)' : 'var(--c-accent)';
  el('pg-leads-gap').textContent = lp>=100 ? 'Target hit +'+fmt(Math.round(totL-t.leads)) : 'Gap: '+fmt(Math.max(0,(t.leads||0)-Math.round(totL)))+' leads';
  el('pg-leads-pct').textContent = t.leads>0 ? lp.toFixed(0)+'%' : '—';

  const bp = t.budget>0 ? Math.min(totS/t.budget*100,110) : 0;
  el('pg-budget-val').textContent = fmtC(totS);
  el('pg-budget-of').textContent = 'of '+fmtC(t.budget||0)+' allocated';
  el('pg-budget-fill').style.width = Math.min(bp,100).toFixed(1)+'%';
  el('pg-budget-fill').style.background = bp>100 ? 'var(--c-danger)' : bp>80 ? 'var(--c-warning)' : 'var(--c-accent2)';
  el('pg-budget-gap').textContent = bp>100 ? 'Over by '+fmtC(totS-t.budget) : 'Remaining: '+fmtC((t.budget||0)-totS);
  el('pg-budget-pct').textContent = t.budget>0 ? bp.toFixed(0)+'%' : '—';
}

function renderTable(rows){
  const levelLabel = APP.currentAd!=='ALL' ? 'Ad View' : APP.currentAdset!=='ALL' ? 'Adset View' : APP.currentCamp!=='ALL' ? 'Campaign View' : 'Adset Breakdown';
  el('tbl-label').textContent = levelLabel;
  const t = loadTargets();
  const tbody = el('camp-tbody');
  if(!rows.length){ tbody.innerHTML = '<tr><td colspan="9" class="text-muted" style="padding:20px 14px">No data for this filter</td></tr>'; return; }
  tbody.innerHTML = rows.map(c=>{
    const cpl = c.leads>0 ? fmtC(c.spend/c.leads) : '—';
    const ctr = c.impressions>0 ? (c.clicks/c.impressions*100).toFixed(2)+'%' : '—';
    const level = c.id ? 'Ad' : 'Adset';
    return `<tr>
      <td title="${escapeHtml(c.name)}">${escapeHtml(trunc(c.name,32))}</td>
      <td><span style="font-size:9px;padding:2px 7px;border-radius:5px;background:var(--c-surface2);color:var(--c-muted);font-weight:700">${level}</span></td>
      <td class="mono">${fmtC(c.spend)}</td>
      <td class="mono">${fmt(c.impressions)}</td>
      <td class="mono">${fmt(c.clicks)}</td>
      <td class="mono">${fmt(Math.round(c.leads))}</td>
      <td class="mono">${cpl}</td>
      <td class="mono">${ctr}</td>
    </tr>`;
  }).join('');
}

function renderDaily(daily, from, to){
  if(!from || !to) return;
  const t = loadTargets();
  const fromD=new Date(from), toD=new Date(to);
  const days=Math.max(1, Math.round((toD-fromD)/86400000)+1);
  const dB = (t.budget||0)/days;
  const sMap={};
  daily.forEach(r=>sMap[r.date_start]=(sMap[r.date_start]||0)+parseFloat(r.spend||0));
  const dates=[],actuals=[],paced=[];
  let cA=0,cP=0;
  for(let d=new Date(fromD); d<=toD; d.setDate(d.getDate()+1)){
    const k=d.toISOString().slice(0,10);
    dates.push(k.slice(5)); cA+=(sMap[k]||0); cP+=dB;
    actuals.push(Math.round(cA)); paced.push(Math.round(cP));
  }
  if(C_daily) C_daily.destroy();
  const brand = window.BRAND?.colors || {};
  C_daily = new Chart(el('dailyChart'), {
    type:'line',
    data:{ labels:dates, datasets:[
      {label:'Actual', data:actuals, borderColor:brand.accent2||'#4a90e2', backgroundColor:(brand.accent2||'#4a90e2')+'18', borderWidth:2, pointRadius:0, fill:true, tension:.3},
      {label:'Paced', data:paced, borderColor:brand.border2||'#c7ccd6', backgroundColor:'transparent', borderWidth:1.5, borderDash:[5,4], pointRadius:0, fill:false, tension:.3}
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{mode:'index',intersect:false, callbacks:{label:c=>c.dataset.label+': ₹'+Number(c.raw).toLocaleString('en-IN')}} },
      scales:{ x:{grid:{display:false}, ticks:{maxTicksLimit:10,font:{size:9}}}, y:{grid:{color:'#f0f2f7'}, ticks:{font:{size:9},callback:v=>'₹'+Math.round(v/1000)+'k'}} }
    }
  });
}

// ── PLAN INPUT (single overall target, no per-program) ──
function loadPlanIntoUI(){
  const t = loadTargets();
  if(el('plan-budget')) el('plan-budget').value = t.budget || '';
  if(el('plan-leads')) el('plan-leads').value = t.leads || '';
}
function applyPlan(){
  const budget = parseFloat(el('plan-budget').value||0);
  const leads = parseFloat(el('plan-leads').value||0);
  saveTargets({budget, leads});
  const filtered = getFilteredRows();
  renderKPIs(filtered); renderProgress(filtered);
  const okEl = el('plan-ok');
  if(okEl){ okEl.textContent='Plan saved ✓'; okEl.classList.remove('hidden'); setTimeout(()=>okEl.classList.add('hidden'),3000); }
}
function clearPlan(){
  localStorage.removeItem(LS_TARGETS);
  loadPlanIntoUI();
  const filtered = getFilteredRows();
  renderKPIs(filtered); renderProgress(filtered);
}

document.addEventListener('DOMContentLoaded', loadPlanIntoUI);

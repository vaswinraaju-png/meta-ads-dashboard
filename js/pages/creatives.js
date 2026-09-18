// ─────────────────────────────────────────────────────────────
// CREATIVES PAGE
// ─────────────────────────────────────────────────────────────
window.buildCreatives = function(){
  APP.allCreatives = APP.allAds.map(ad=>{
    const cr = ad.creative || {};
    const spec = cr.object_story_spec || {};
    const linkData = spec.link_data || spec.video_data || spec.photo_data || {};
    const assetFeed = cr.asset_feed_spec || {};

    const primaryText = cr.body || linkData.message || (assetFeed.bodies&&assetFeed.bodies[0]?.text) || '';
    const headline = cr.title || linkData.name || linkData.caption || (assetFeed.titles&&assetFeed.titles[0]?.text) || ad.name || '';
    const description = linkData.description || (assetFeed.descriptions&&assetFeed.descriptions[0]?.text) || cr.name || '';
    const thumbUrl = cr._bestImage || cr.thumbnail_url || cr.image_url || linkData.picture || linkData.image_url || '';

    return {
      adId:ad.id, adName:ad.name, adsetName:ad.adsetName, campaign:ad.campaign,
      headline:headline.trim(), primaryText:primaryText.trim(), description:description.trim(), thumbUrl,
      spend:ad.spend, impressions:ad.impressions, reach:ad.reach||0, clicks:ad.clicks, leads:ad.leads
    };
  });
  renderCreativesGrid(APP.allCreatives);
};

async function fetchCreatives(){
  const btn = el('btn-load-creatives');
  const status = el('creative-load-status');
  if(btn){ btn.textContent='Loading...'; btn.disabled=true; }
  try{
    const adIds = [...new Set(APP.allAds.map(a=>a.id).filter(Boolean))];
    if(!adIds.length){
      if(status) status.textContent='Fetch data on Overview first — no ads loaded yet';
      if(btn){ btn.textContent='Load Creatives'; btn.disabled=false; }
      return;
    }
    if(status) status.textContent = `Fetching creative IDs for ${adIds.length} ads...`;
    const chunks=[]; for(let i=0;i<adIds.length;i+=50) chunks.push(adIds.slice(i,i+50));
    const adCreativeIdMap={};
    for(const chunk of chunks){
      const res = await fetch(`/api/meta-proxy?endpoint=v17.0/&ids=${chunk.join(',')}&fields=id,name,creative{id}&tokenType=ad`);
      const json = await res.json();
      if(!json.error) Object.entries(json).forEach(([adId,ad])=>{ if(ad.creative?.id) adCreativeIdMap[adId]=ad.creative.id; });
    }
    if(status) status.textContent='Fetching creative thumbnails...';
    const crIds=[...new Set(Object.values(adCreativeIdMap))];
    const crDataMap={};
    const crChunks=[]; for(let i=0;i<crIds.length;i+=50) crChunks.push(crIds.slice(i,i+50));
    for(const chunk of crChunks){
      const res = await fetch(`/api/meta-proxy?endpoint=v17.0/&ids=${chunk.join(',')}&fields=id,name,title,body,thumbnail_url,image_url,image_hash,effective_object_story_id,object_story_spec,asset_feed_spec&thumbnail_width=1080&thumbnail_height=1080&tokenType=ad`);
      const json = await res.json();
      if(!json.error) Object.assign(crDataMap, json);
    }
    // full-res images via hash
    const hashes=[...new Set(Object.values(crDataMap).map(cr=>cr.image_hash).filter(Boolean))];
    const hashUrlMap={};
    if(hashes.length){
      const hChunks=[]; for(let i=0;i<hashes.length;i+=50) hChunks.push(hashes.slice(i,i+50));
      for(const chunk of hChunks){
        try{
          const res = await fetch(`/api/meta-proxy?endpoint=v17.0/${APP.ACCT}/adimages?hashes=${encodeURIComponent(JSON.stringify(chunk))}&fields=hash,url,width,height&tokenType=ad`);
          const json = await res.json();
          if(!json.error && json.data) json.data.forEach(img=>{
            if(img.hash && img.url) hashUrlMap[img.hash] = img.url.replace(/\/[sp]\d+x\d+\//,'/s1080x1080/');
          });
        }catch(e){}
      }
    }
    const storyIds=[...new Set(Object.values(crDataMap).map(cr=>cr.effective_object_story_id).filter(Boolean))];
    const storyPicMap={};
    if(storyIds.length){
      const sChunks=[]; for(let i=0;i<storyIds.length;i+=50) sChunks.push(storyIds.slice(i,i+50));
      for(const chunk of sChunks){
        try{
          const res = await fetch(`/api/meta-proxy?endpoint=v17.0/&ids=${chunk.join(',')}&fields=full_picture,attachments{media_type,media{image{src,width,height}}}&tokenType=ad`);
          const json = await res.json();
          if(!json.error) Object.entries(json).forEach(([id,post])=>{
            const attachImg = post.attachments?.data?.[0]?.media?.image;
            const pic = attachImg?.src || post.full_picture || '';
            if(pic) storyPicMap[id]=pic;
          });
        }catch(e){}
      }
    }
    APP.allAds.forEach(ad=>{
      const crId = adCreativeIdMap[ad.id]; if(!crId) return;
      const cr = crDataMap[crId] || {};
      const hash = cr.image_hash;
      const storyId = cr.effective_object_story_id;
      const bestImage = (storyId && storyPicMap[storyId]) || (hash && hashUrlMap[hash]) || cr.thumbnail_url || cr.image_url || '';
      ad.creative = { ...cr, _bestImage: bestImage };
    });
    window.buildCreatives();
    const withImg = APP.allAds.filter(a=>a.creative?._bestImage).length;
    const total = APP.allAds.filter(a=>a.creative?.id).length;
    if(status) status.textContent='';
    if(btn){ btn.textContent=`Reload Creatives (${withImg}/${total} with images)`; btn.disabled=false; }
  }catch(e){
    if(status) status.textContent='Failed: '+e.message;
    if(btn){ btn.textContent='Retry Creatives'; btn.disabled=false; }
  }
}

function renderCreativesGrid(creatives){
  const grid = el('creatives-grid');
  const active = creatives.filter(c=>c.impressions>0);
  const inactive = creatives.filter(c=>c.impressions<=0);
  if(el('creative-count')) el('creative-count').textContent = `${active.length} active · ${inactive.length} no impressions`;
  if(!creatives.length){
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Click Load Creatives (after fetching data on Overview)</div>`;
    return;
  }
  window._curCreatives = creatives;
  const activeHtml = active.map(c=>{
    const i = creatives.indexOf(c);
    const cpl = c.leads>0 ? fmtC(c.spend/c.leads) : '—';
    const ctr = c.impressions>0 ? (c.clicks/c.impressions*100).toFixed(2)+'%' : '—';
    const thumb = c.thumbUrl
      ? `<img class="creative-thumb" src="${c.thumbUrl}" alt="Creative" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="creative-thumb-ph">No preview</div>`;
    return `<div class="creative-tile" onclick="openCreativeDetail(${i})" data-idx="${i}">
      ${thumb}
      <div class="creative-body">
        <div class="creative-headline">${escapeHtml(c.headline||c.adName||'—')}</div>
        <div class="creative-primary">${escapeHtml(c.primaryText||'No primary text')}</div>
      </div>
      <div class="creative-metrics">
        <div class="cm"><div class="cm-val">${fmt(Math.round(c.leads))}</div><div class="cm-lbl">Leads</div></div>
        <div class="cm"><div class="cm-val">${cpl}</div><div class="cm-lbl">CPL</div></div>
        <div class="cm"><div class="cm-val">${ctr}</div><div class="cm-lbl">CTR</div></div>
      </div>
    </div>`;
  }).join('');
  const inactiveHtml = inactive.length ? `
    <div style="grid-column:1/-1;margin-top:16px;">
      <div class="section-title" style="margin-bottom:8px;">No Impressions · ${inactive.length} ads</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${inactive.map(c=>{
          const i=creatives.indexOf(c);
          const thumb = c.thumbUrl ? `<img src="${c.thumbUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">` : '';
          return `<div onclick="openCreativeDetail(${i})" title="${escapeHtml(c.adName||'')}" style="width:52px;height:52px;border-radius:7px;border:1.5px solid var(--c-border);cursor:pointer;overflow:hidden;background:var(--c-surface2);">${thumb}</div>`;
        }).join('')}
      </div>
    </div>` : '';
  grid.innerHTML = activeHtml + inactiveHtml;
}

function openCreativeDetail(idx){
  const list = window._curCreatives || APP.allCreatives;
  const c = list[idx]; if(!c) return;
  const cpl = c.leads>0 ? fmtC(c.spend/c.leads) : '—';
  const ctr = c.impressions>0 ? (c.clicks/c.impressions*100).toFixed(2)+'%' : '—';
  const img = el('cd-img'), ph = el('cd-img-ph');
  if(c.thumbUrl){ img.src=c.thumbUrl; img.style.display='block'; ph.style.display='none'; }
  else{ img.style.display='none'; ph.style.display='flex'; }
  el('cd-campaign').textContent = c.campaign || '';
  el('cd-headline').textContent = c.headline || c.adName || '—';
  el('cd-primary').textContent = c.primaryText || '—';
  el('cd-desc').textContent = c.description || '—';
  el('cd-adname').textContent = c.adName;
  el('cd-spend').textContent = fmtC(c.spend);
  el('cd-leads').textContent = fmt(Math.round(c.leads));
  el('cd-cpl').textContent = cpl;
  el('cd-ctr').textContent = ctr;
  el('cd-imp').textContent = fmt(c.impressions);
  el('cd-clicks').textContent = fmt(c.clicks);
  document.querySelectorAll('.creative-tile').forEach(t=>t.classList.remove('selected'));
  document.querySelector(`.creative-tile[data-idx="${idx}"]`)?.classList.add('selected');
  el('creative-detail').classList.add('open');
  el('creative-detail').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function closeCreativeDetail(){
  el('creative-detail').classList.remove('open');
  document.querySelectorAll('.creative-tile').forEach(t=>t.classList.remove('selected'));
}

// ─────────────────────────────────────────────────────────────
// SOCIAL PAGE
// ─────────────────────────────────────────────────────────────
let _fbPosts=[], _igMedia=[], _fbCharts={}, _igCharts={}, _fbConversations=[], _igDMs=[];
let _pageToken='';
let _socFetched=false;

function initSocial(){
  const to=new Date(), from=new Date(); from.setDate(1);
  if(el('soc-from')) el('soc-from').value = from.toISOString().slice(0,10);
  if(el('soc-to')) el('soc-to').value = to.toISOString().slice(0,10);
}

function switchSocTab(tab){
  el('soc-page-ig').style.display = tab==='ig' ? 'block' : 'none';
  el('soc-page-fb').style.display = tab==='fb' ? 'block' : 'none';
  el('soc-tab-ig').classList.toggle('active', tab==='ig');
  el('soc-tab-fb').classList.toggle('active', tab==='fb');
}
function switchIGSub(sub){
  el('ig-panel-posts').style.display = sub==='posts' ? 'block' : 'none';
  el('ig-panel-dms').style.display = sub==='dms' ? 'block' : 'none';
  el('ig-sub-posts').classList.toggle('active', sub==='posts');
  el('ig-sub-dms').classList.toggle('active', sub==='dms');
}
function switchFBSub(sub){
  el('fb-panel-posts').style.display = sub==='posts' ? 'block' : 'none';
  el('fb-panel-inbox').style.display = sub==='inbox' ? 'block' : 'none';
  el('fb-sub-posts').classList.toggle('active', sub==='posts');
  el('fb-sub-inbox').classList.toggle('active', sub==='inbox');
}

function socErr(m){ el('soc-error').textContent=m; el('soc-error').classList.remove('hidden'); }
function socLoad(m){ if(m){ el('soc-loading').textContent=m; el('soc-loading').classList.remove('hidden'); } else el('soc-loading').classList.add('hidden'); }
function hideSocErr(){ el('soc-error').classList.add('hidden'); }

async function getPageToken(pageId){
  if(_pageToken) return _pageToken;
  try{
    const r = await fetch(`/api/meta-proxy?endpoint=v17.0/${pageId}?fields=access_token&tokenType=social`).then(x=>x.json());
    if(r.access_token){ _pageToken=r.access_token; return _pageToken; }
    if(r.error && r.error.code===190) socErr('Token expired — please regenerate your access token.');
  }catch(e){}
  return '';
}

async function fetchSocial(){
  hideSocErr();
  const pageId=APP.SOC_FB_PAGE_ID, igId=APP.SOC_IG_ID;
  const from=el('soc-from').value, to=el('soc-to').value;
  if(!from||!to){ socErr('Select date range.'); return; }
  const btn=el('btn-fetch-social');
  if(btn){ btn.textContent='Fetching...'; btn.disabled=true; }
  const since=Math.floor(new Date(from).getTime()/1000);
  const until=Math.floor(new Date(to).getTime()/1000)+86399;
  try{
    socLoad('Getting page token...');
    _pageToken='';
    const pageToken = await getPageToken(pageId);
    socLoad('Fetching Instagram data...');
    try{ await fetchIG(igId, since, until); }
    catch(e){ socErr('Instagram data failed: '+e.message); }
    socLoad('Fetching Facebook Page data...');
    try{ await fetchFBPage(pageId, since, until, pageToken); }
    catch(e){ const prev=el('soc-error').textContent; socErr((prev?prev+' | ':'')+'Facebook data failed: '+e.message); }
    socLoad(false);
  }catch(e){ socErr('Fatal error: '+e.message); socLoad(false); }
  if(btn){ btn.textContent='Refresh Social'; btn.disabled=false; }
}

// ── INSTAGRAM ──
async function fetchIG(igId, since, until){
  const igMetrics='impressions,reach,profile_views,follower_count,website_clicks,email_contacts,phone_call_clicks';
  const [profileRes, insRes, mediaRes] = await Promise.all([
    fetch(`/api/meta-proxy?endpoint=v17.0/${igId}&fields=username,name,followers_count,follows_count,media_count,biography&tokenType=social`),
    fetch(`/api/meta-proxy?endpoint=v17.0/${igId}/insights&metric=${igMetrics}&since=${since}&until=${until}&period=day&tokenType=social`),
    fetch(`/api/meta-proxy?endpoint=v17.0/${igId}/media&fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=50&tokenType=social`)
  ]);
  let followerInsRes=null;
  try{ const fr=await fetch(`/api/meta-proxy?endpoint=v17.0/${igId}/insights?metric=follower_count&since=${since}&until=${until}&period=day&tokenType=social`); followerInsRes=await fr.json(); }catch(e){}
  const [profile, ins, mediaData] = await Promise.all([profileRes.json(), insRes.json(), mediaRes.json()]);
  if(profile.error){
    const c=profile.error.code;
    if(c===190) throw new Error('Token expired');
    if(c===100) throw new Error('Invalid IG Business Account ID: '+igId);
    if(c===10||c===200) throw new Error('Missing instagram_basic permission');
    throw new Error('IG profile error ('+c+'): '+profile.error.message);
  }
  el('ig-followers').textContent = fmt(profile.followers_count||0);
  el('ig-following').textContent = fmt(profile.follows_count||0);
  el('ig-media-count').textContent = fmt(profile.media_count||0);

  const igMap={}; (ins.data||[]).forEach(m=>igMap[m.name]=m.values||[]);
  const igSum=k=>(igMap[k]||[]).reduce((s,v)=>s+Number(v.value||0),0);
  const accImp=igSum('impressions'), accReach=igSum('reach');
  const igDays=(igMap['impressions']||[]).map(v=>v.end_time?.slice(5,10)||'');
  const igImp=(igMap['impressions']||[]).map(v=>Number(v.value||0));
  const igReach=(igMap['reach']||[]).map(v=>Number(v.value||0));
  const follMap = followerInsRes?.data?.[0]?.values || igMap['follower_count'] || [];
  const igFollDelta = follMap.map(v=>Number(v.value||0));
  const igFollDays = follMap.map(v=>v.end_time?.slice(5,10)||'');
  renderIGFollowersChart(igFollDays.length?igFollDays:igDays, igFollDelta);

  const media = mediaData.data || [];
  if(media.length>0){
    socLoad(`Fetching insights for ${media.length} IG posts...`);
    const mediaInsights = await Promise.all(media.slice(0,50).map(m=>{
      const isVideo = m.media_type==='VIDEO'||m.media_type==='REELS';
      const metrics = isVideo ? 'impressions,reach,saved,video_views,plays,shares' : 'impressions,reach,saved,shares';
      return fetch(`/api/meta-proxy?endpoint=v17.0/${m.id}/insights?metric=${metrics}&period=lifetime&tokenType=ad`).then(r=>r.json()).catch(()=>({data:[]}));
    }));
    media.slice(0,50).forEach((m,i)=>{
      const ins={}; const resp=mediaInsights[i];
      if(!resp.error) (resp.data||[]).forEach(x=>{ const val=x.values?.[0]?.value??x.value??0; ins[x.name]=Number(val); });
      ins.like_count=m.like_count||0; ins.comments_count=m.comments_count||0;
      m._ins=ins;
    });
    _igMedia = media.slice(0,50);
    const mImp=_igMedia.reduce((s,m)=>s+(m._ins?.impressions||0),0);
    const mReach=_igMedia.reduce((s,m)=>s+(m._ins?.reach||0),0);
    const finalReach = accReach>0?accReach:mReach;
    const totalSaves=_igMedia.reduce((s,m)=>s+(m._ins?.saved||0),0);
    const totalShares=_igMedia.reduce((s,m)=>s+(m._ins?.shares||0),0);
    const totalLikes=_igMedia.reduce((s,m)=>s+(m._ins?.like_count||0),0);
    const totalComments=_igMedia.reduce((s,m)=>s+(m._ins?.comments_count||0),0);
    const totalEng=totalLikes+totalComments+totalSaves+totalShares;
    el('ig-eng-rate').textContent = finalReach>0 ? (totalEng/finalReach*100).toFixed(2)+'%' : '—';
    el('ig-saves-rate').textContent = finalReach>0 ? (totalSaves/finalReach*100).toFixed(2)+'%' : '—';
    el('ig-share-rate').textContent = finalReach>0 ? (totalShares/finalReach*100).toFixed(2)+'%' : '—';

    const dayEngMap={};
    _igMedia.forEach(m=>{
      const d=new Date(m.timestamp||''); if(isNaN(d)) return;
      const day=d.toLocaleDateString('en-IN',{weekday:'short'});
      const ins=m._ins||{}; const eng=(ins.like_count||0)+(ins.comments_count||0)+(ins.saved||0)+(ins.shares||0);
      if(!dayEngMap[day]) dayEngMap[day]={total:0,count:0};
      dayEngMap[day].total+=eng; dayEngMap[day].count++;
    });
    let bestDay='—', bestDayAvg=0;
    Object.entries(dayEngMap).forEach(([d,v])=>{ const avg=v.total/v.count; if(avg>bestDayAvg){bestDayAvg=avg;bestDay=d;} });
    el('ig-best-day').textContent = bestDay;
    el('ig-best-day-sub').textContent = bestDay!=='—' ? `Avg ${bestDayAvg.toFixed(0)} eng/post` : 'Not enough data';

    const follGrowth = igFollDelta.reduce((s,v)=>s+v,0);
    const foll = profile.followers_count||1;
    el('ig-growth-rate').textContent = (follGrowth>=0?'+':'')+follGrowth;
    el('ig-growth-sub').textContent = `${(follGrowth/foll*100).toFixed(2)}% this period`;

    const typeEng={};
    _igMedia.forEach(m=>{
      const t=m.media_type||'OTHER'; const ins=m._ins||{};
      const eng=(ins.like_count||0)+(ins.comments_count||0)+(ins.saved||0)+(ins.shares||0);
      if(!typeEng[t]) typeEng[t]={total:0,count:0};
      typeEng[t].total+=eng; typeEng[t].count++;
    });
    let topType='—',topAvg=0;
    Object.entries(typeEng).forEach(([t,v])=>{ const avg=v.total/v.count; if(avg>topAvg){topAvg=avg;topType=t;} });
    el('ig-top-type').textContent = topType.replace('CAROUSEL_ALBUM','CAROUSEL').replace('_',' ');

    if(accImp===0 && _igMedia.length>0){
      const dMap={};
      _igMedia.forEach(m=>{
        const d=(m.timestamp||'').slice(5,10); if(!d) return;
        if(!dMap[d]) dMap[d]={imp:0,reach:0};
        dMap[d].imp+=(m._ins?.impressions||0); dMap[d].reach+=(m._ins?.reach||0);
      });
      const sd=Object.keys(dMap).sort();
      renderIGTrendChart(sd, sd.map(d=>dMap[d].imp), sd.map(d=>dMap[d].reach));
    } else {
      renderIGTrendChart(igDays, igImp, igReach);
    }
    const types={}; _igMedia.forEach(m=>types[m.media_type]=(types[m.media_type]||0)+1);
    renderIGMediaTypeChart(types);
    renderIGEngTypeChart(typeEng);
    renderIGMedia();
  }
  socLoad('Fetching IG DMs...');
  await fetchIGDMs(igId);
}

// ── FACEBOOK ──
async function fetchFBPage(pageId, since, until, pageToken){
  const pt = pageToken || _pageToken;
  const tokenParam = pt ? `tokenType=dynamic&dynamicToken=${pt}` : `tokenType=social`;
  const pageMetrics=[
    'page_impressions','page_impressions_organic','page_impressions_paid','page_impressions_viral',
    'page_reach','page_reach_organic','page_reach_paid',
    'page_engaged_users','page_post_engagements','page_views_total','page_video_views',
    'page_fan_adds','page_fan_removes','page_actions_post_reactions_total',
    'page_total_actions','page_clicks_by_type'
  ].join(',');
  const [profileRes, insRes, postsRes] = await Promise.all([
    fetch(`/api/meta-proxy?endpoint=v17.0/${pageId}?fields=name,fan_count,followers_count&${tokenParam}`),
    fetch(`/api/meta-proxy?endpoint=v17.0/${pageId}/insights?metric=${pageMetrics}&since=${since}&until=${until}&period=day&${tokenParam}`),
    fetch(`/api/meta-proxy?endpoint=v17.0/${pageId}/posts?fields=message,story,created_time,full_picture,permalink_url&since=${since}&until=${until}&limit=100&${tokenParam}`)
  ]);
  const [profile, ins, postsData] = await Promise.all([profileRes.json(), insRes.json(), postsRes.json()]);
  if(profile.error){
    const c=profile.error.code;
    if(c===190) throw new Error('Token expired');
    if(c===100) throw new Error('Invalid FB Page ID: '+pageId);
    if(c===10||c===200) throw new Error('Missing pages_show_list or pages_read_engagement permission');
    throw new Error('FB Page error ('+c+'): '+profile.error.message);
  }
  el('fb-followers').textContent = fmt(profile.followers_count||profile.fan_count||0);
  const metrics={}; (ins.data||[]).forEach(m=>metrics[m.name]=m.values||[]);
  const sum=key=>(metrics[key]||[]).reduce((s,v)=>{ const val=typeof v.value==='object'?Object.values(v.value).reduce((a,b)=>a+b,0):Number(v.value||0); return s+val; },0);
  const totImp=sum('page_impressions'), orgReachTot=sum('page_reach_organic'), paidReachTot=sum('page_reach_paid'), totReach=sum('page_reach');
  const totEngage=sum('page_engaged_users'), totClicks=sum('page_total_actions');
  el('fb-impressions').textContent = fmt(totImp);
  el('fb-reach-org').textContent = fmt(orgReachTot);
  el('fb-reach-paid').textContent = fmt(paidReachTot);
  el('fb-engaged').textContent = fmt(totEngage);
  el('fb-post-eng').textContent = fmt(sum('page_post_engagements'));
  el('fb-views').textContent = fmt(sum('page_views_total'));
  el('fb-video-views').textContent = fmt(sum('page_video_views'));
  const netFoll = sum('page_fan_adds')-sum('page_fan_removes');
  el('fb-net-followers').textContent = (netFoll>=0?'+':'')+fmt(netFoll);
  el('fb-net-followers').style.color = netFoll>=0 ? 'var(--c-success)' : 'var(--c-danger)';
  el('fb-org-pct').textContent = totReach>0 ? (orgReachTot/totReach*100).toFixed(0)+'%' : '—';
  el('fb-eng-rate').textContent = totReach>0 ? (totEngage/totReach*100).toFixed(2)+'%' : '—';
  const posts = postsData.data || [];
  el('fb-avg-reach').textContent = fmt(Math.round(totReach/(Math.max(posts.length,1))));
  el('fb-avg-reach-sub').textContent = `Across ${posts.length} posts`;
  el('fb-page-ctr').textContent = totImp>0 ? (totClicks/totImp*100).toFixed(2)+'%' : '—';

  const days=(metrics['page_impressions']||[]).map(v=>v.end_time?.slice(5,10)||'');
  renderFBTrendChart(days, (metrics['page_impressions']||[]).map(v=>Number(v.value||0)), (metrics['page_reach_organic']||[]).map(v=>Number(v.value||0)), (metrics['page_reach_paid']||[]).map(v=>Number(v.value||0)));
  const reactionsData = metrics['page_actions_post_reactions_total']||[];
  const totalReactions={};
  reactionsData.forEach(v=>{ if(typeof v.value==='object') Object.entries(v.value).forEach(([k,c])=>totalReactions[k]=(totalReactions[k]||0)+Number(c)); });
  renderFBReactionsChart(totalReactions);
  const fanAdds=(metrics['page_fan_adds']||[]).map(v=>Number(v.value||0));
  const fanRemoves=(metrics['page_fan_removes']||[]).map(v=>-Number(v.value||0));
  renderFBFollowersChart(days, fanAdds, fanRemoves);
  const clicksByType={};
  (metrics['page_clicks_by_type']||[]).forEach(v=>{ if(typeof v.value==='object') Object.entries(v.value).forEach(([k,c])=>clicksByType[k]=(clicksByType[k]||0)+Number(c)); });
  renderFBViewsChart(clicksByType);

  if(posts.length>0){
    socLoad(`Fetching insights for ${posts.length} posts...`);
    const postInsights = await Promise.all(posts.slice(0,30).map(p=>
      fetch(`/api/meta-proxy?endpoint=v17.0/${p.id}/insights?metric=post_impressions,post_reach,post_engaged_users,post_clicks,post_reactions_by_type_total,post_video_views&tokenType=dynamic&dynamicToken=${pt}`).then(r=>r.json()).catch(()=>({data:[]}))
    ));
    posts.slice(0,30).forEach((p,i)=>{
      const ins={};
      (postInsights[i].data||[]).forEach(m=>{
        const v=m.values?.[0]?.value;
        ins[m.name] = typeof v==='object' ? Object.values(v).reduce((a,b)=>a+b,0) : Number(v||0);
      });
      p._ins=ins;
    });
    _fbPosts = posts.slice(0,30);
    renderFBPosts();
  }
  socLoad('Fetching FB inbox...');
  await fetchFBConversations(pageId, pt);
}

// ── CHARTS ──
function renderFBTrendChart(labels, imp, orgReach, paidReach){
  if(_fbCharts.trend) _fbCharts.trend.destroy();
  _fbCharts.trend = new Chart(el('fb-trend-chart'), { type:'line', data:{ labels, datasets:[
    {label:'Impressions', data:imp, borderColor:'#4a90e2', backgroundColor:'#4a90e218', borderWidth:2, pointRadius:0, fill:true, tension:.3},
    {label:'Organic Reach', data:orgReach, borderColor:'#2f9e44', backgroundColor:'transparent', borderWidth:1.5, pointRadius:0, fill:false, tension:.3},
    {label:'Paid Reach', data:paidReach, borderColor:'#e8590c', backgroundColor:'transparent', borderWidth:1.5, borderDash:[4,3], pointRadius:0, fill:false, tension:.3}
  ]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}}, scales:{x:{grid:{display:false},ticks:{maxTicksLimit:10,font:{size:9}}},y:{grid:{color:'#f0f2f7'},ticks:{font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k':v}}} } });
}
function renderFBReactionsChart(reactions){
  const labels=Object.keys(reactions), vals=Object.values(reactions);
  const colors=['#4a90e2','#d0342c','#e8b64a','#2f9e44','#e8590c','#9acbfd'];
  const leg=el('fb-reactions-legend');
  if(leg) leg.innerHTML = labels.map((l,i)=>`<span class="legend-chip"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span>${l}: ${fmt(vals[i])}</span>`).join('');
  if(_fbCharts.reactions) _fbCharts.reactions.destroy();
  if(!labels.length) return;
  _fbCharts.reactions = new Chart(el('fb-reactions-chart'), { type:'doughnut', data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:0,hoverOffset:4}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'65%'} });
}
function renderFBFollowersChart(labels, adds, removes){
  if(_fbCharts.followers) _fbCharts.followers.destroy();
  _fbCharts.followers = new Chart(el('fb-followers-chart'), { type:'bar', data:{labels,datasets:[
    {label:'Adds',data:adds,backgroundColor:'#2f9e44',borderRadius:2},
    {label:'Removes',data:removes,backgroundColor:'#d0342c',borderRadius:2}
  ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12,font:{size:9}}},y:{grid:{color:'#f0f2f7'},ticks:{font:{size:9}}},stacked:true}} });
}
function renderFBViewsChart(clicksByType){
  const labels=Object.keys(clicksByType), vals=Object.values(clicksByType);
  const colors=['#4a90e2','#9acbfd','#e8590c','#2f9e44','#e8b64a'];
  const leg=el('fb-views-legend');
  if(leg) leg.innerHTML = labels.map((l,i)=>`<span class="legend-chip"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span>${l}: ${fmt(vals[i])}</span>`).join('');
  if(_fbCharts.views) _fbCharts.views.destroy();
  if(!labels.length){ if(leg) leg.innerHTML='<span class="text-muted" style="font-size:10px">No click data</span>'; return; }
  _fbCharts.views = new Chart(el('fb-views-chart'), { type:'doughnut', data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:0,hoverOffset:4}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'60%'} });
}
function renderIGTrendChart(labels, imp, reach){
  if(_igCharts.trend) _igCharts.trend.destroy();
  _igCharts.trend = new Chart(el('ig-trend-chart'), { type:'line', data:{labels,datasets:[
    {label:'Impressions',data:imp,borderColor:'#833ab4',backgroundColor:'#833ab418',borderWidth:2,pointRadius:0,fill:true,tension:.3},
    {label:'Reach',data:reach,borderColor:'#fd1d1d',backgroundColor:'transparent',borderWidth:1.5,pointRadius:0,fill:false,tension:.3}
  ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:10,font:{size:9}}},y:{grid:{color:'#f0f2f7'},ticks:{font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k':v}}}} });
}
function renderIGFollowersChart(labels, delta){
  if(_igCharts.followers) _igCharts.followers.destroy();
  _igCharts.followers = new Chart(el('ig-followers-chart'), { type:'bar', data:{labels,datasets:[{label:'Follower Change',data:delta,backgroundColor:delta.map(v=>v>=0?'#2f9e44':'#d0342c'),borderRadius:2}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:12,font:{size:9}}},y:{grid:{color:'#f0f2f7'},ticks:{font:{size:9}}}}} });
}
function renderIGMediaTypeChart(types){
  const labels=Object.keys(types), vals=Object.values(types);
  const colors=['#833ab4','#fd1d1d','#fcb045','#4a90e2'];
  const leg=el('ig-media-legend');
  if(leg) leg.innerHTML = labels.map((l,i)=>`<span class="legend-chip"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span>${l}: ${vals[i]}</span>`).join('');
  if(_igCharts.mediaType) _igCharts.mediaType.destroy();
  _igCharts.mediaType = new Chart(el('ig-media-chart'), { type:'doughnut', data:{labels,datasets:[{data:vals,backgroundColor:colors,borderWidth:0,hoverOffset:4}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'65%'} });
}
function renderIGEngTypeChart(typeEng){
  const labels=Object.keys(typeEng).map(t=>t.replace('CAROUSEL_ALBUM','CAROUSEL'));
  const vals=Object.keys(typeEng).map(t=>typeEng[t].count>0?Math.round(typeEng[t].total/typeEng[t].count):0);
  const colors=['#833ab4','#fd1d1d','#fcb045','#4a90e2'];
  const leg=el('ig-eng-type-legend');
  if(leg) leg.innerHTML = labels.map((l,i)=>`<span class="legend-chip"><span class="legend-dot" style="background:${colors[i%colors.length]}"></span>${l}: ${vals[i]}</span>`).join('');
  if(_igCharts.engType) _igCharts.engType.destroy();
  if(!labels.length) return;
  _igCharts.engType = new Chart(el('ig-eng-type-chart'), { type:'bar', data:{labels,datasets:[{label:'Avg Eng',data:vals,backgroundColor:colors,borderRadius:4}]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{grid:{color:'#f0f2f7'},ticks:{font:{size:9}}}}} });
}

// ── TABLES ──
function renderFBPosts(){
  const sortKey = el('fb-post-sort')?.value||'engagement';
  const tbody = el('fb-posts-tbody');
  if(!_fbPosts.length){ tbody.innerHTML='<tr><td colspan="10" class="text-muted" style="padding:20px 14px">No posts loaded</td></tr>'; return; }
  const sorted=[..._fbPosts].sort((a,b)=>{
    const ai=a._ins||{}, bi=b._ins||{};
    if(sortKey==='date') return new Date(b.created_time)-new Date(a.created_time);
    if(sortKey==='reactions'){
      const ar=Object.values(ai.post_reactions_by_type_total||{}).reduce((s,v)=>s+v,0);
      const br=Object.values(bi.post_reactions_by_type_total||{}).reduce((s,v)=>s+v,0);
      return br-ar;
    }
    if(sortKey==='engagement') return (bi.post_engaged_users||0)-(ai.post_engaged_users||0);
    return (bi[sortKey]||bi['post_'+sortKey]||0)-(ai[sortKey]||ai['post_'+sortKey]||0);
  });
  if(el('fb-post-count')) el('fb-post-count').textContent = sorted.length+' posts';
  tbody.innerHTML = sorted.map(p=>{
    const ins=p._ins||{};
    const text=p.message||p.story||'';
    const thumb=p.full_picture?`<img src="${p.full_picture}" style="width:36px;height:36px;object-fit:cover;border-radius:5px;" onerror="this.style.display='none'">`:'<div style="width:36px;height:36px;background:var(--c-surface2);border-radius:5px;"></div>';
    const date=p.created_time?p.created_time.slice(0,10):'—';
    const reactions=typeof ins.post_reactions_by_type_total==='object'?Object.values(ins.post_reactions_by_type_total||{}).reduce((s,v)=>s+v,0):0;
    const reach=ins.post_reach||0, engaged=ins.post_engaged_users||0;
    const engRate=reach>0?(engaged/reach*100).toFixed(1)+'%':'—';
    const engCls=parseFloat(engRate)>=5?'val-up':parseFloat(engRate)>=2?'val-warn':'val-down';
    return `<tr>
      <td>${thumb}</td>
      <td title="${escapeHtml(text)}" style="max-width:220px">${escapeHtml(text.slice(0,80))||'—'}</td>
      <td class="mono" style="font-size:10px">${date}</td>
      <td class="mono">${fmt(ins.post_impressions||0)}</td>
      <td class="mono">${fmt(reach)}</td>
      <td class="mono">${fmt(engaged)}</td>
      <td class="mono">${fmt(ins.post_clicks||0)}</td>
      <td class="mono">${fmt(reactions)}</td>
      <td class="mono">${fmt(ins.post_video_views||0)}</td>
      <td class="mono ${engCls}">${engRate}</td>
    </tr>`;
  }).join('');
}
function renderIGMedia(){
  const sortKey = el('ig-media-sort')?.value||'engagement';
  const typeFilter = el('ig-type-filter')?.value||'ALL';
  const tbody = el('ig-media-tbody');
  let media = typeFilter==='ALL' ? [..._igMedia] : _igMedia.filter(m=>m.media_type===typeFilter);
  media.sort((a,b)=>{
    const ai=a._ins||{}, bi=b._ins||{};
    if(sortKey==='date') return new Date(b.timestamp)-new Date(a.timestamp);
    if(sortKey==='likes') return (bi.like_count||0)-(ai.like_count||0);
    if(sortKey==='engagement'){
      const ae=(ai.like_count||0)+(ai.comments_count||0)+(ai.saved||0)+(ai.shares||0);
      const be=(bi.like_count||0)+(bi.comments_count||0)+(bi.saved||0)+(bi.shares||0);
      return be-ae;
    }
    return (bi[sortKey]||0)-(ai[sortKey]||0);
  });
  if(el('ig-media-count-label')) el('ig-media-count-label').textContent = media.length+' posts';
  if(!media.length){ tbody.innerHTML='<tr><td colspan="13" class="text-muted" style="padding:20px 14px">No media for this filter</td></tr>'; return; }
  tbody.innerHTML = media.map(m=>{
    const ins=m._ins||{};
    const thumb=m.thumbnail_url||m.media_url||'';
    const thumbEl=thumb?`<img src="${thumb}" style="width:40px;height:40px;object-fit:cover;border-radius:5px;" onerror="this.style.display='none'">`:'<div style="width:40px;height:40px;background:var(--c-surface2);border-radius:5px;"></div>';
    const cap=(m.caption||'').slice(0,70)||'—';
    const date=m.timestamp?m.timestamp.slice(0,10):'—';
    const plays=ins.plays||ins.video_views||0;
    const eng=(ins.like_count||0)+(ins.comments_count||0)+(ins.saved||0)+(ins.shares||0);
    const reach=ins.reach||0;
    const engRate=reach>0?(eng/reach*100).toFixed(1)+'%':'—';
    const savesRate=reach>0?(ins.saved||0)/reach*100:0;
    const engCls=parseFloat(engRate)>=5?'val-up':parseFloat(engRate)>=2?'val-warn':'';
    return `<tr>
      <td>${thumbEl}</td>
      <td title="${escapeHtml(m.caption||'')}" style="max-width:200px">${escapeHtml(cap)}</td>
      <td><span style="font-size:9px;padding:2px 7px;border-radius:99px;background:var(--c-surface2);color:var(--c-muted);font-weight:700">${m.media_type||'—'}</span></td>
      <td class="mono" style="font-size:10px">${date}</td>
      <td class="mono">${fmt(ins.impressions||0)}</td>
      <td class="mono">${fmt(reach)}</td>
      <td class="mono">${fmt(ins.like_count||0)}</td>
      <td class="mono">${fmt(ins.comments_count||0)}</td>
      <td class="mono">${fmt(ins.saved||0)}</td>
      <td class="mono">${fmt(ins.shares||0)}</td>
      <td class="mono">${fmt(plays)}</td>
      <td class="mono ${engCls}">${engRate}</td>
      <td class="mono text-muted">${savesRate>0?savesRate.toFixed(1)+'%':'—'}</td>
    </tr>`;
  }).join('');
}

// ── INBOX ──
async function fetchFBConversations(pageId, pageToken){
  const pt = pageToken || _pageToken;
  const tokenParam = pt ? `tokenType=dynamic&dynamicToken=${pt}` : `tokenType=social`;
  try{
    const r = await fetch(`/api/meta-proxy?endpoint=v17.0/${pageId}/conversations?fields=id,snippet,unread_count,updated_time,participants,messages.limit(1){from,created_time,message}&limit=100&${tokenParam}`).then(x=>x.json());
    if(r.error){
      const tbody=el('fb-conv-tbody');
      if(tbody) tbody.innerHTML=`<tr><td colspan="5" class="text-muted" style="padding:12px 14px">⚠ Inbox unavailable — ${escapeHtml(r.error.message)}</td></tr>`;
      return;
    }
    _fbConversations = (r.data||[]).map(c=>{
      const lastMsg=c.messages?.data?.[0];
      const participants=c.participants?.data||[];
      const customer=participants.find(p=>p.id!==pageId)||{};
      const unresponded = lastMsg && lastMsg.from?.id!==pageId;
      return {id:c.id, customerName:customer.name||'Unknown', unread:c.unread_count||0, updatedTime:c.updated_time, lastMessage:lastMsg?.message||c.snippet||'', unresponded};
    });
    const total=_fbConversations.length, unread=_fbConversations.filter(c=>c.unread>0).length, unresponded=_fbConversations.filter(c=>c.unresponded).length;
    const responded=total-unresponded, rate=total>0?(responded/total*100).toFixed(0)+'%':'—';
    el('fb-conv-total').textContent=fmt(total);
    el('fb-conv-unread').textContent=fmt(unread);
    el('fb-conv-unresponded').textContent=fmt(unresponded);
    el('fb-conv-responded').textContent=fmt(responded);
    el('fb-conv-rate').textContent=rate;
    if(el('fb-inbox-rate')){ el('fb-inbox-rate').textContent=rate; el('fb-inbox-sub').textContent=`${responded}/${total} responded`; }
    renderFBConversations();
  }catch(e){
    const tbody=el('fb-conv-tbody');
    if(tbody) tbody.innerHTML=`<tr><td colspan="5" class="text-muted" style="padding:12px 14px">Network error: ${escapeHtml(e.message)}</td></tr>`;
  }
}
function renderFBConversations(){
  const filter = el('fb-conv-filter')?.value||'ALL';
  const tbody = el('fb-conv-tbody');
  if(!tbody) return;
  let list=[..._fbConversations];
  if(filter==='unresponded') list=list.filter(c=>c.unresponded);
  else if(filter==='unread') list=list.filter(c=>c.unread>0);
  list.sort((a,b)=>{ if(a.unresponded&&!b.unresponded) return -1; if(!a.unresponded&&b.unresponded) return 1; return new Date(b.updatedTime)-new Date(a.updatedTime); });
  if(el('fb-conv-count')) el('fb-conv-count').textContent = list.length+' conversations';
  if(!list.length){ tbody.innerHTML=`<tr><td colspan="5" class="text-muted" style="padding:20px 14px">No conversations</td></tr>`; return; }
  tbody.innerHTML = list.map(c=>{
    const time=c.updatedTime?new Date(c.updatedTime).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
    const statusBadge = c.unresponded ? `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:#fff3e0;color:var(--c-warning);font-weight:700">AWAITING REPLY</span>` : `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:#e8f5e9;color:var(--c-success);font-weight:700">RESPONDED</span>`;
    const unreadBadge = c.unread>0 ? `<span style="background:var(--c-danger);color:#fff;border-radius:99px;font-size:9px;padding:1px 6px;font-weight:700">${c.unread}</span>` : `<span class="text-muted" style="font-size:10px">—</span>`;
    return `<tr>
      <td style="font-weight:600;max-width:140px">${escapeHtml(c.customerName)}</td>
      <td class="text-muted" style="font-size:11px;max-width:200px">${escapeHtml((c.lastMessage||'').slice(0,60))||'—'}</td>
      <td class="mono" style="font-size:10px">${time}</td>
      <td>${statusBadge}</td>
      <td style="text-align:center">${unreadBadge}</td>
    </tr>`;
  }).join('');
}
async function fetchIGDMs(igId){
  const tbody = el('ig-dm-tbody');
  try{
    const r = await fetch(`/api/meta-proxy?endpoint=v17.0/${igId}/conversations&platform=instagram&fields=id,snippet,unread_count,updated_time,participants,messages.limit(1){from,created_time,message}&limit=100&tokenType=social`).then(x=>x.json());
    if(r.error){
      if(tbody) tbody.innerHTML=`<tr><td colspan="5" class="text-muted" style="padding:12px 14px">⚠ IG DMs unavailable — ${escapeHtml(r.error.message)}</td></tr>`;
      return;
    }
    _igDMs = (r.data||[]).map(t=>{
      const lastMsg=t.messages?.data?.[0];
      const participants=t.participants?.data||[];
      const customer=participants.find(p=>p.id!==igId)||{};
      return {id:t.id, customerName:customer.name||customer.username||'User', unread:t.unread_count||0, updatedTime:t.updated_time, snippet:t.snippet||lastMsg?.message||'', unresponded: lastMsg && lastMsg.from?.id!==igId};
    });
    const total=_igDMs.length, unread=_igDMs.filter(t=>t.unread>0).length, unresponded=_igDMs.filter(t=>t.unresponded).length;
    const rate = total>0 ? ((total-unresponded)/total*100).toFixed(0)+'%' : '—';
    el('ig-dm-total').textContent=fmt(total);
    el('ig-dm-unread').textContent=fmt(unread);
    el('ig-dm-unresponded').textContent=fmt(unresponded);
    el('ig-dm-rate').textContent=rate;
    if(el('ig-dm-count')) el('ig-dm-count').textContent = total+' threads';
    if(!_igDMs.length){ if(tbody) tbody.innerHTML='<tr><td colspan="5" class="text-muted" style="padding:20px 14px">No DM conversations found</td></tr>'; return; }
    const sorted=[..._igDMs].sort((a,b)=>{ if(a.unresponded&&!b.unresponded) return -1; if(!a.unresponded&&b.unresponded) return 1; return new Date(b.updatedTime)-new Date(a.updatedTime); });
    if(tbody) tbody.innerHTML = sorted.map(t=>{
      const time=t.updatedTime?new Date(t.updatedTime).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
      const statusBadge = t.unresponded ? `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:#fff3e0;color:var(--c-warning);font-weight:700">AWAITING REPLY</span>` : `<span style="font-size:9px;padding:2px 8px;border-radius:99px;background:#e8f5e9;color:var(--c-success);font-weight:700">RESPONDED</span>`;
      const unreadBadge = t.unread>0 ? `<span style="background:var(--c-danger);color:#fff;border-radius:99px;font-size:9px;padding:1px 6px;font-weight:700">${t.unread}</span>` : `<span class="text-muted" style="font-size:10px">—</span>`;
      return `<tr>
        <td style="font-weight:600">${escapeHtml(t.customerName)}</td>
        <td class="text-muted" style="font-size:11px;max-width:200px">${escapeHtml((t.snippet||'').slice(0,60))||'—'}</td>
        <td class="mono" style="font-size:10px">${time}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center">${unreadBadge}</td>
      </tr>`;
    }).join('');
  }catch(e){
    if(tbody) tbody.innerHTML=`<tr><td colspan="5" class="text-muted" style="padding:12px 14px">Network error: ${escapeHtml(e.message)}</td></tr>`;
  }
}

document.addEventListener('DOMContentLoaded', initSocial);

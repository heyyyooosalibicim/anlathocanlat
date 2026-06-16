/* ══════════ ATTACHMENTS (PDF/IMG) ══════════ */
function openAttachMenu(idx,item){
  var inp=document.createElement('input');inp.type='file';inp.accept='.pdf,image/*';
  inp.onchange=function(){
    if(!inp.files||!inp.files[0])return;
    var file=inp.files[0];
    var reader=new FileReader();
    reader.onload=function(ev){
      var pl=getActivePlaylist();if(!pl)return;
      if(!pl.items[idx].attachments)pl.items[idx].attachments=[];
      var isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
      pl.items[idx].attachments.push({name:file.name,type:isPdf?'pdf':'img',data:ev.target.result});
      renderPlaylist();saveAll();
      showToast((isPdf?'PDF':'Fotoğraf')+' eklendi: '+file.name);
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}
function renderAttachments(item,div){
  var cont=div.querySelector('#attachments-'+item.id);if(!cont)return;
  cont.innerHTML='';
  if(!item.attachments||item.attachments.length===0)return;
  item.attachments.forEach(function(att,ai){
    var chip=document.createElement('span');chip.className='attachment-chip '+(att.type==='pdf'?'pdf-chip':'img-chip');
    chip.innerHTML=(att.type==='pdf'?'📄':'🖼')+'&nbsp;'+(att.name.length>18?att.name.substr(0,18)+'…':att.name)+'<button class="chip-del" title="Sil">✕</button>';
    chip.addEventListener('click',function(e){if(e.target.classList.contains('chip-del')){e.stopPropagation();deleteAttachment(item,ai,div);return;}openAttachViewer(att);});
    cont.appendChild(chip);
  });
}
function deleteAttachment(item,ai,div){
  if(!item.attachments)return;
  item.attachments.splice(ai,1);
  renderAttachments(item,div);
  saveAll();
}
function openAttachViewer(att){
  document.getElementById('attachViewTitle').textContent=att.name;
  var cont=document.getElementById('attachViewContent');cont.innerHTML='';
  if(att.type==='pdf'){
    var frame=document.createElement('iframe');frame.className='attach-viewer-frame';frame.src=att.data;frame.title=att.name;cont.appendChild(frame);
  }else{
    var img=document.createElement('img');img.className='attach-viewer-img';img.src=att.data;img.alt=att.name;cont.appendChild(img);
  }
  document.getElementById('attachViewModalOverlay').classList.add('open');
}
function closeAttachViewModal(){document.getElementById('attachViewModalOverlay').classList.remove('open');}

/* ══════════ DAILY HISTORY SYSTEM ══════════ */
var LS_HISTORY='aha_v4_history';
var dailyHistory={};  // {dateStr: {swMs, playlists:[{id,name,color,items:[{id,title,watched,categoryId}]}], notes:{...}, categories:[...]}}
var lastCheckedDate=null;
var MAX_HISTORY_DAYS=30;

function getTodayStr(){
  var d=new Date();
  // Use local date components explicitly to avoid UTC offset confusion
  var y=d.getFullYear();
  var mo=d.getMonth()+1;
  var day=d.getDate();
  return y+'-'+pad(mo)+'-'+pad(day);
}
function getDateStr(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function formatDateHuman(dateStr){
  var parts=dateStr.split('-');var d=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]));
  var days=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  var months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  return days[d.getDay()]+', '+d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear();
}
function msToHMS(ms){var t=Math.floor(ms/1000);return pad(Math.floor(t/3600))+'s '+pad(Math.floor((t%3600)/60))+'d '+pad(t%60)+'sn';}
function msToPretty(ms){var h=Math.floor(ms/3600000);var m=Math.floor((ms%3600000)/60000);return h>0?h+'sa '+m+'dk':m+'dk';}

function loadHistory(){
  try{var raw=localStorage.getItem(LS_HISTORY);if(raw)dailyHistory=JSON.parse(raw);}catch(e){dailyHistory={};}
  // Load lastCheckedDate from storage so page reloads don't break midnight detection
  try{var lcd=localStorage.getItem('aha_v4_lastdate');lastCheckedDate=lcd||getTodayStr();}catch(e){lastCheckedDate=getTodayStr();}
}
function saveHistory(){
  try{
    var keys=Object.keys(dailyHistory).sort();
    while(keys.length>MAX_HISTORY_DAYS){var oldest=keys.shift();delete dailyHistory[oldest];}
    localStorage.setItem(LS_HISTORY,JSON.stringify(dailyHistory));
  }catch(e){}
}

function snapshotToday(){
  var today=getTodayStr();
  var swMs=swAccum+(swRunning?(Date.now()-swStartTime):0);
  var plSnap=playlists.map(function(pl){
    return {id:pl.id,name:pl.name,color:pl.color,categories:JSON.parse(JSON.stringify(pl.categories||[])),
      notes:JSON.parse(JSON.stringify(pl.notes||{})),
      items:pl.items.map(function(it){return {id:it.id,title:it.title,watched:it.watched,categoryId:it.categoryId||null};})
    };
  });
  dailyHistory[today]={swMs:swMs,playlists:plSnap,timestamp:Date.now()};
  saveHistory();
}

function checkMidnightReset(){
  var today=getTodayStr();
  if(lastCheckedDate&&lastCheckedDate!==today){
    // Snapshot the previous day before resetting
    var prev=lastCheckedDate;
    var swMs=swAccum+(swRunning?(Date.now()-swStartTime):0);
    var plSnap=playlists.map(function(pl){
      return {id:pl.id,name:pl.name,color:pl.color,categories:JSON.parse(JSON.stringify(pl.categories||[])),
        notes:JSON.parse(JSON.stringify(pl.notes||{})),
        items:pl.items.map(function(it){return {id:it.id,title:it.title,watched:it.watched,categoryId:it.categoryId||null};})
      };
    });
    dailyHistory[prev]={swMs:swMs,playlists:plSnap,timestamp:Date.now()};
    saveHistory();
    // Reset stopwatch
    swReset();
    // Hide all playlists (like manager visibility toggle) — don't delete them
    playlists.forEach(function(pl){
      pl.hidden=true;
      pl.items.forEach(function(it){it.watched=false;});
      pl.notes={};
    });
    // Make sure at least one is visible (the first one stays as fallback)
    if(playlists.length>0){
      activePlaylistId=playlists[0].id;
    }
    oopItems={};
    // Reset player visually
    destroyPlayer();
    currentVideoId=null;currentInPlaylist=false;currentPlaylistId=null;
    // Check if there's a planned playlist for today
    applyPlannerForDate(today);
    lastCheckedDate=today;
    try{localStorage.setItem('aha_v4_lastdate',today);}catch(e){}
    renderTabs();renderPlaylist();saveAll();
    showToast('🌅 Yeni gün başladı! Playlistler gizlendi, kronometre sıfırlandı.');
  } else {
    // Update persisted date even if no reset happened
    try{localStorage.setItem('aha_v4_lastdate',today);}catch(e){}
  }
}

// Check planner: if today has planned playlists/videos, apply them
function applyPlannerForDate(dateStr){
  var planned=getPlannedForDate(dateStr);
  if(!planned)return;
  var firstVisible=null;
  // For each planned playlist, if "visible" toggle is on, ensure it exists and has videos
  planned.playlists.forEach(function(pp){
    if(!pp.visible)return;
    var existing=playlists.find(function(p){return p.id===pp.id;});
    if(!existing){
      // Recreate from planner data
      var newPl={id:pp.id,name:pp.name,color:pp.color||null,categories:[],notes:{},collapsedCats:{},catOrder:[],items:[]};
      playlists.push(newPl);
    }
    var pl=playlists.find(function(p){return p.id===pp.id;});
    if(pl){
      pl.hidden=false; // Gece yarısı reset'inden sonra gizlenen playlist'i tekrar görünür yap
      if(!firstVisible)firstVisible=pl.id;
      if(pp.items){
        pp.items.forEach(function(vi){
          if(vi.visible&&!pl.items.some(function(x){return x.id===vi.id;})){
            pl.items.push({id:vi.id,title:vi.title,watched:false});
          }
        });
      }
    }
  });
  // Aktif playlist'i planlayıcıdaki ilk görünür playlist'e ayarla
  if(firstVisible)activePlaylistId=firstVisible;
  else if(playlists.length>0&&!activePlaylistId)activePlaylistId=playlists[0].id;
  renderTabs();renderPlaylist();saveAll();
}

/* ══════════ PLANNER DATA ══════════ */
var LS_PLANNER='aha_v4_planner';
var plannerData={};  // {dateStr: {playlists:[{id,name,color,visible,items:[{id,title,visible}]}]}}

function loadPlanner(){
  try{var raw=localStorage.getItem(LS_PLANNER);if(raw)plannerData=JSON.parse(raw);}catch(e){plannerData={};}
}
function savePlanner(){
  try{localStorage.setItem(LS_PLANNER,JSON.stringify(plannerData));}catch(e){}
}
function getPlannedForDate(dateStr){return plannerData[dateStr]||null;}
function ensurePlannerDate(dateStr){
  if(!plannerData[dateStr])plannerData[dateStr]={playlists:[]};
  return plannerData[dateStr];
}

/* ══════════ CALENDAR PANEL ══════════ */
var calActiveTab='stats';
var calPlannerOffset=0;  // days from today

function openCalendarPanel(){ _openPanel('calendar'); }
function closeCalendarPanel(){ _closePanel('calendar'); }

function switchCalTab(tab){
  calActiveTab=tab;
  ['stats','history','planner','manager'].forEach(function(t){
    document.getElementById('calTab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active',t===tab);
  });
  renderCalBody();
}

function renderCalBody(){
  var body=document.getElementById('calBody');
  body.innerHTML='';
  if(calActiveTab==='stats')renderStatsTab(body);
  else if(calActiveTab==='history')renderHistoryTab(body);
  else if(calActiveTab==='planner')renderPlannerTab(body);
  else if(calActiveTab==='manager')renderManagerTab(body);
}

/* ── STATS TAB ── */
var statsRange=7; // default: last 7 days
function renderStatsTab(body){
  var today=getTodayStr();
  var todayMs=swAccum+(swRunning?(Date.now()-swStartTime):0);

  // Range selector
  var rangeHtml='<div class="stats-range-row">'+
    '<span class="stats-range-label">Zaman Aralığı:</span>'+
    '<div class="stats-range-btns">'+
      '<button class="stats-range-btn'+(statsRange===7?' active':'')+'" onclick="setStatsRange(7)">Son 7 Gün</button>'+
      '<button class="stats-range-btn'+(statsRange===14?' active':'')+'" onclick="setStatsRange(14)">Son 14 Gün</button>'+
      '<button class="stats-range-btn'+(statsRange===30?' active':'')+'" onclick="setStatsRange(30)">Son 30 Gün</button>'+
    '</div>'+
  '</div>';

  var allHistoryKeys=Object.keys(dailyHistory).sort();
  var rangeKeys=allHistoryKeys.slice(-(statsRange-1)); // last N-1 days from history
  // Make sure today is included
  if(rangeKeys.indexOf(today)<0) rangeKeys.push(today);
  rangeKeys=rangeKeys.sort().slice(-statsRange);

  var totalMs=rangeKeys.reduce(function(a,d){
    return a+(d===today?todayMs:(dailyHistory[d]?dailyHistory[d].swMs:0));
  },0);
  var avgMs=rangeKeys.length>0?Math.round(totalMs/rangeKeys.length):0;
  var maxMs=rangeKeys.reduce(function(a,d){
    var ms=d===today?todayMs:(dailyHistory[d]?dailyHistory[d].swMs:0);
    return Math.max(a,ms);
  },0);
  var totalVids=0;playlists.forEach(function(pl){totalVids+=pl.items.filter(function(it){return it.watched;}).length;});
  var totalPlanned=playlists.reduce(function(a,pl){return a+pl.items.length;},0);
  var activeDays=rangeKeys.filter(function(d){
    var ms=d===today?todayMs:(dailyHistory[d]?dailyHistory[d].swMs:0);
    return ms>0;
  }).length;

  var gridHtml='<div class="stats-grid">'+
    '<div class="stat-card"><div class="stat-card-val">'+msToPretty(todayMs)+'</div><div class="stat-card-lbl">Bugün</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+msToPretty(totalMs)+'</div><div class="stat-card-lbl">Toplam ('+statsRange+'G)</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+msToPretty(avgMs)+'</div><div class="stat-card-lbl">Günlük Ort.</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+msToPretty(maxMs)+'</div><div class="stat-card-lbl">En Uzun Gün</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+activeDays+'/'+statsRange+'</div><div class="stat-card-lbl">Aktif Gün</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+totalVids+'/'+totalPlanned+'</div><div class="stat-card-lbl">İzlenen Video</div></div>'+
  '</div>';

  // Bar chart — covers ALL history days + today, never misses test entries
  var allHistoryDates=Object.keys(dailyHistory).sort(); // oldest first
  var chartStartDate=allHistoryDates.length>0?allHistoryDates[0]:today;
  // Build complete day range from earliest history date to today
  var chartDays=[];
  var startD=new Date(chartStartDate+'T00:00:00');
  var endD=new Date(today+'T00:00:00');
  var cursor=new Date(startD);
  while(cursor<=endD){
    chartDays.push(getDateStr(cursor));
    cursor.setDate(cursor.getDate()+1);
  }
  // Limit to 60 days max to avoid overflow (show most recent)
  if(chartDays.length>60)chartDays=chartDays.slice(chartDays.length-60);

  var chartMaxMs=chartDays.reduce(function(a,d){
    var ms2=d===today?todayMs:(dailyHistory[d]?dailyHistory[d].swMs:0);
    return Math.max(a,ms2);
  },1);

  var chartHtml='<div class="chart-wrap"><div class="chart-title">Tüm Kayıtlar ('+chartDays.length+' gün) <span style="font-size:10px;color:var(--muted);font-weight:400">(güne tıkla → detay)</span></div><div class="bar-chart" id="statsBarChart">';
  chartDays.forEach(function(d){
    var ms=d===today?todayMs:(dailyHistory[d]?dailyHistory[d].swMs:0);
    var barH=ms>0?Math.max(Math.round((ms/chartMaxMs)*90),8):0;
    var parts=d.split('-');var shortDate=parseInt(parts[2])+'/'+parseInt(parts[1]);
    var isToday=d===today;
    chartHtml+='<div class="bar-col bar-col-clickable" onclick="showStatsDayDetail(\''+d+'\')" title="'+formatDateHuman(d)+': '+(ms>0?msToPretty(ms):'Çalışma yok')+' — Tıkla">'+
      '<div class="bar-col-val">'+(ms>0?msToPretty(ms):'')+'</div>'+
      '<div class="bar-col-bar'+(isToday?' today':'')+'" style="height:'+(barH>0?barH:isToday?3:2)+'px;opacity:'+(ms>0?1:isToday?0.35:0.08)+'"></div>'+
      '<div class="bar-col-label'+(isToday?' today-label':'')+'">'+shortDate+'</div>'+
    '</div>';
  });
  chartHtml+='</div></div>';

  // Day detail panel (hidden by default)
  var detailHtml='<div class="stats-day-detail" id="statsDayDetail" style="display:none"></div>';

  // Playlist progress
  var pHtml='<div class="chart-wrap"><div class="chart-title">Playlist İlerleme</div>';
  playlists.forEach(function(pl){
    var total=pl.items.length;var watched=pl.items.filter(function(it){return it.watched;}).length;
    var pct=total>0?Math.round(watched/total*100):0;
    var dot=pl.color?'<span style="width:8px;height:8px;border-radius:50%;background:'+pl.color+';display:inline-block;flex-shrink:0"></span>':'';
    pHtml+='<div style="margin-bottom:8px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;font-size:11px;color:var(--text2)">'+
        '<span style="display:flex;align-items:center;gap:5px">'+dot+escapeHtml(pl.name)+'</span>'+
        '<span style="font-family:JetBrains Mono,monospace;font-size:10px;color:var(--muted)">'+watched+'/'+total+' • '+pct+'%</span>'+
      '</div>'+
      '<div style="height:5px;background:var(--surface3);border-radius:5px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pl.color||'var(--green)')+';border-radius:5px;transition:width 0.4s"></div></div>'+
    '</div>';
  });
  pHtml+='</div>';

  body.innerHTML=rangeHtml+gridHtml+chartHtml+detailHtml+pHtml;
}

function setStatsRange(n){
  statsRange=n;
  if(calActiveTab==='stats')renderCalBody();
}

function showStatsDayDetail(dateStr){
  var panel=document.getElementById('statsDayDetail');
  if(!panel)return;
  if(panel.dataset.openDate===dateStr&&panel.style.display!=='none'){
    panel.style.display='none';panel.dataset.openDate='';
    document.querySelectorAll('.bar-col.bar-active').forEach(function(b){b.classList.remove('bar-active');});
    return;
  }
  panel.dataset.openDate=dateStr;
  document.querySelectorAll('.bar-col.bar-active').forEach(function(b){b.classList.remove('bar-active');});
  var today=getTodayStr();
  var isToday=dateStr===today;
  var rec=isToday?null:dailyHistory[dateStr];
  var todayMs=swAccum+(swRunning?(Date.now()-swStartTime):0);
  var ms=isToday?todayMs:(rec?rec.swMs:0);

  var pls=isToday?playlists.map(function(pl){return {
    id:pl.id,name:pl.name,color:pl.color,
    notes:pl.notes||{},
    items:pl.items.map(function(it){return {id:it.id,title:it.title,watched:it.watched,categoryId:it.categoryId||null};})
  };}):((rec&&rec.playlists)||[]);

  var html='<div class="stats-detail-header">'+
    '<div>'+
      '<div class="stats-detail-date">'+formatDateHuman(dateStr)+(isToday?' <span style="color:var(--accent);font-size:10px">BUGÜN</span>':'')+'</div>'+
      '<div class="stats-detail-time">⏱ '+msToPretty(ms)+'</div>'+
    '</div>'+
    '<button class="stats-detail-close" onclick="document.getElementById(\'statsDayDetail\').style.display=\'none\';this.closest(\'.stats-day-detail\').dataset.openDate=\'\'">✕</button>'+
  '</div>';

  if(pls.length===0){
    html+='<div style="color:var(--muted);font-size:12px;padding:8px 0">Bu gün için playlist kaydı yok.</div>';
    if(!isToday){
      html+='<button class="hist-restore-btn" style="margin-top:10px;width:100%;text-align:center" onclick="restoreFromHistory(\''+dateStr+'\')">↩ Bu Günün Playlistlerini Geri Yükle</button>';
    }
  } else {
    pls.forEach(function(pl){
      var watched=pl.items.filter(function(it){return it.watched;}).length;
      var dot=pl.color?'<span style="width:8px;height:8px;border-radius:50%;background:'+pl.color+';display:inline-block;flex-shrink:0;margin-right:4px"></span>':'';
      html+='<div class="stats-detail-pl">'+
        '<div class="stats-detail-pl-name">'+dot+escapeHtml(pl.name)+' <span style="font-size:9px;color:var(--muted)">'+watched+'/'+pl.items.length+' izlendi</span></div>';
      pl.items.forEach(function(it){
        html+='<div class="stats-detail-vid'+(it.watched?' watched':'')+'">'+
          '<span class="stats-detail-chk">'+(it.watched?'✓':'○')+'</span>'+
          '<span class="stats-detail-vid-title">'+escapeHtml(it.title)+'</span>'+
        '</div>';
        // Notes for this video
        var notes=(pl.notes&&pl.notes[it.id])||[];
        if(notes.length>0){
          html+='<div class="stats-detail-notes">';
          notes.forEach(function(n){
            html+='<div class="stats-detail-note-row"><span class="stats-detail-note-ts">'+fmtSec(n.ts)+'</span><span class="stats-detail-note-text">'+escapeHtml(n.text)+'</span></div>';
          });
          html+='</div>';
        }
      });
      html+='</div>';
    });
    // Restore button: show for ALL past days (not just ones with rec data)
    if(!isToday){
      html+='<button class="hist-restore-btn" style="margin-top:10px;width:100%;text-align:center" onclick="restoreFromHistory(\''+dateStr+'\')">↩ Bu Günün Playlistlerini Geri Yükle</button>';
    }
  }

  panel.innerHTML=html;
  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ── HISTORY TAB ── */
var histSearchQuery='';
function renderHistoryTab(body){
  var today=getTodayStr();
  var keys=Object.keys(dailyHistory).sort().reverse(); // newest first

  // Build search bar always
  var searchHtml='<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">'+
    '<input type="text" id="histSearchInput" placeholder="🔍 Tarih ara... (örn: Pazartesi, Ocak, 2025)" '+
    'value="'+escapeHtml(histSearchQuery)+'" oninput="onHistSearch(this.value)" '+
    'style="flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:7px 12px;font-size:12px;font-family:\'JetBrains Mono\',monospace;color:var(--text);outline:none;transition:border-color 0.2s" '+
    'onfocus="this.style.borderColor=\'rgba(139,92,246,0.5)\'" onblur="this.style.borderColor=\'var(--border2)\'">'+
    (histSearchQuery?'<button onclick="onHistSearch(\'\');document.getElementById(\'histSearchInput\').value=\'\'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:7px;color:var(--muted);cursor:pointer;padding:5px 9px;font-size:12px">✕</button>':'')+ 
  '</div>';

  if(keys.length===0){
    body.innerHTML=searchHtml+'<div style="text-align:center;color:var(--muted);padding:30px;font-size:13px">Henüz geçmiş verisi yok.<br>Uygulama her gün gece yarısı snapshot alır.</div>';
    return;
  }

  // Filter by search
  var allKeys=Object.keys(dailyHistory).sort(); // oldest first for day numbering
  var filteredKeys=keys.filter(function(dateStr){
    if(!histSearchQuery)return true;
    var q=histSearchQuery.toLowerCase();
    return formatDateHuman(dateStr).toLowerCase().indexOf(q)>=0||dateStr.indexOf(q)>=0;
  });

  var infoHtml='<div style="font-size:11px;color:var(--muted);margin-bottom:8px">'+
    (histSearchQuery?filteredKeys.length+' sonuç bulundu (toplam '+keys.length+' kayıt)':
    'Son '+keys.length+' günün kaydı. Her satırda o günün tüm çalışma verisini görebilir, playlistleri geri yükleyebilirsiniz.')+
  '</div>';

  if(filteredKeys.length===0){
    body.innerHTML=searchHtml+infoHtml+'<div style="text-align:center;color:var(--muted);padding:20px;font-size:12px">Arama sonucu bulunamadı.</div>';
    return;
  }

  var html='';
  filteredKeys.forEach(function(dateStr){
    var rec=dailyHistory[dateStr];
    var isToday=dateStr===today;
    var swMs=rec.swMs||0;
    // Day number = position in sorted all keys (oldest = Gün 1)
    var dayNum=allKeys.indexOf(dateStr)+1;
    var dayLabel=isToday?'BUGÜN':'Gün '+dayNum;
    html+='<div class="hist-day">'+
      '<div class="hist-day-header" onclick="toggleHistDay(\'hist-'+dateStr+'\')">'+
        '<div class="hist-day-date">'+
          '<span class="hist-day-badge'+(isToday?' today':'')+'">'+dayLabel+'</span>'+
          formatDateHuman(dateStr)+
        '</div>'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div class="hist-day-time">'+msToPretty(swMs)+'</div>'+
          '<span class="hist-day-chevron" id="chev-'+dateStr+'">▾</span>'+
        '</div>'+
      '</div>'+
      '<div class="hist-day-body" id="hist-'+dateStr+'">'+
        '<button class="hist-restore-btn" onclick="restoreFromHistory(\''+dateStr+'\')">↩ Bu Günün Playlistlerini Geri Yükle</button>'+
        renderHistoryDayBody(rec)+
      '</div>'+
    '</div>';
  });
  body.innerHTML=searchHtml+infoHtml+html;
}

function onHistSearch(val){
  histSearchQuery=val.trim();
  if(calActiveTab==='history')renderCalBody();
}

function renderHistoryDayBody(rec){
  var html='';
  var pls=rec.playlists||[];
  if(pls.length===0)return '<div style="color:var(--muted);font-size:11px">Playlist verisi yok.</div>';
  pls.forEach(function(pl){
    var dot=pl.color?'<span style="width:8px;height:8px;border-radius:50%;background:'+pl.color+';display:inline-block;flex-shrink:0"></span>':'';
    html+='<div class="hist-pl-block">'+
      '<div class="hist-pl-name">'+dot+escapeHtml(pl.name)+' <span style="font-size:9px;color:var(--muted);font-weight:400">'+pl.items.length+' video</span></div>';
    pl.items.forEach(function(it){
      var watched=it.watched?'<span class="hist-vid-watched">✓</span>':'<span class="hist-vid-unwatched"></span>';
      html+='<div class="hist-vid-item">'+watched+'<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(it.title)+'</span></div>';
      // Notes for this video
      var notes=(pl.notes&&pl.notes[it.id])||[];
      if(notes.length>0){
        html+='<div class="hist-note-block">';
        notes.forEach(function(n){html+='<div class="hist-note-row"><span class="hist-note-ts">'+fmtSec(n.ts)+'</span><span>'+escapeHtml(n.text)+'</span></div>';});
        html+='</div>';
      }
    });
    html+='</div>';
  });
  return html;
}

function toggleHistDay(id){
  var el=document.getElementById(id);
  var dateStr=id.replace('hist-','');
  var chev=document.getElementById('chev-'+dateStr);
  if(el.classList.contains('open')){el.classList.remove('open');if(chev)chev.classList.remove('open');}
  else{el.classList.add('open');if(chev)chev.classList.add('open');}
}

function restoreFromHistory(dateStr){
  var rec=dailyHistory[dateStr];
  if(!rec)return;

  // Check if any current playlists have content
  var hasContent=playlists.some(function(p){return p.items.length>0;});

  if(hasContent){
    // Show custom modal asking what to do
    showRestoreChoiceModal(dateStr,rec);
  } else {
    doRestoreHistory(dateStr,rec,'replace');
  }
}

function showRestoreChoiceModal(dateStr,rec){
  var overlay=document.getElementById('restoreChoiceOverlay');
  var dateLabel=formatDateHuman(dateStr);
  document.getElementById('restoreChoiceDateLabel').textContent=dateLabel;
  overlay.classList.add('open');
  // Store for later use
  overlay.dataset.dateStr=dateStr;
  overlay._rec=rec;
}
function closeRestoreChoiceModal(){
  document.getElementById('restoreChoiceOverlay').classList.remove('open');
}
function confirmRestoreChoice(mode){
  var overlay=document.getElementById('restoreChoiceOverlay');
  var dateStr=overlay.dataset.dateStr;
  var rec=overlay._rec;
  closeRestoreChoiceModal();
  doRestoreHistory(dateStr,rec,mode);
}

function doRestoreHistory(dateStr,rec,mode){
  var restored=0;
  if(mode==='replace'){
    // Clear all current playlists and recreate from history
    playlists=[];
    (rec.playlists||[]).forEach(function(hp){
      var newPl={id:hp.id,name:hp.name,color:hp.color||null,categories:hp.categories||[],notes:hp.notes||{},collapsedCats:{},catOrder:[],
        items:hp.items.map(function(it){return {id:it.id,title:it.title,watched:it.watched||false,categoryId:it.categoryId||null};})};
      playlists.push(newPl);restored+=newPl.items.length;
    });
    activePlaylistId=playlists[0]?playlists[0].id:null;
  } else {
    // Merge: add videos that don't exist, keep current
    (rec.playlists||[]).forEach(function(hp){
      var existing=playlists.find(function(p){return p.id===hp.id;});
      if(existing){
        hp.items.forEach(function(hv){
          if(!existing.items.some(function(x){return x.id===hv.id;})){
            existing.items.push({id:hv.id,title:hv.title,watched:false});restored++;
          }
        });
      }else{
        var newPl={id:hp.id,name:hp.name+' (geri yüklendi)',color:hp.color||null,categories:hp.categories||[],notes:hp.notes||{},collapsedCats:{},catOrder:[],
          items:hp.items.map(function(it){return {id:it.id,title:it.title,watched:false,categoryId:it.categoryId||null};})};
        playlists.push(newPl);restored+=newPl.items.length;
      }
    });
    if(!activePlaylistId&&playlists.length>0)activePlaylistId=playlists[0].id;
  }
  renderTabs();renderPlaylist();saveAll();
  showToast('✅ '+restored+' video geri yüklendi!');
  closeCalendarPanel();
}

/* ── PLANNER TAB ── */
var plannerSelectedPl=null;  // id of playlist to add video to

var plannerSelectedDate=null;

function renderPlannerTab(body){
  var today=getTodayStr();
  var now=new Date();

  var html='<div class="planner-cal-wrap">';

  // Render current month + next month
  for(var monthOffset=0;monthOffset<2;monthOffset++){
    var mDate=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
    var year=mDate.getFullYear();
    var month=mDate.getMonth();
    var monthNames=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    var daysInMonth=new Date(year,month+1,0).getDate();
    var firstDow=mDate.getDay(); // 0=Sun
    // Monday-first: shift Sun to end
    var startOffset=(firstDow===0?6:firstDow-1);

    html+='<div class="planner-month-block">'+
      '<div class="planner-month-header">'+
        '<div class="planner-month-title">'+monthNames[month]+' '+year+'</div>'+
      '</div>'+
      '<div class="planner-cal-grid">';

    // Day-of-week headers
    ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].forEach(function(d){
      html+='<div class="planner-cal-dow">'+d+'</div>';
    });

    // Empty cells before first day
    for(var e=0;e<startOffset;e++){
      html+='<div class="planner-cal-day empty"></div>';
    }

    // Days
    for(var day=1;day<=daysInMonth;day++){
      var dateStr=year+'-'+pad(month+1)+'-'+pad(day);
      var isToday=dateStr===today;
      var planned=plannerData[dateStr];
      var hasPlan=planned&&((planned.playlists&&planned.playlists.some(function(p){return p.visible;}))||(planned.extraVideos&&planned.extraVideos.length>0));
      var isSelected=plannerSelectedDate===dateStr;
      var cls='planner-cal-day'+(isToday?' is-today':'')+(hasPlan?' has-plan':'')+(isSelected?' selected':'');

      // Dot row from visible playlists
      var dots='';
      var activePls=0;
      if(planned&&planned.playlists){
        planned.playlists.filter(function(p){return p.visible;}).forEach(function(pp){
          var pl=playlists.find(function(x){return x.id===pp.id;});
          var c=pl&&pl.color?pl.color:'var(--blue)';
          dots+='<div class="planner-day-dot" style="background:'+c+'"></div>';
          activePls++;
        });
      }
      if(planned&&planned.extraVideos&&planned.extraVideos.length>0){
        dots+='<div class="planner-day-dot" style="background:var(--gold)"></div>';
      }

      html+='<div class="'+cls+'" onclick="selectPlannerDay(\''+dateStr+'\')">'+
        '<div class="planner-day-num">'+day+'</div>'+
        (dots?'<div class="planner-day-dot-row">'+dots+'</div>':'')+
      '</div>';
    }

    html+='</div></div>'; // grid + month-block
  }
  html+='</div>'; // cal-wrap

  // Detail panel for selected day
  html+='<div id="plannerDetailPanel" style="margin-top:8px">';
  if(plannerSelectedDate){
    html+=renderPlannerDayDetail(plannerSelectedDate);
  }
  html+='</div>';

  body.innerHTML=html;
}

function selectPlannerDay(dateStr){
  if(plannerSelectedDate===dateStr){
    plannerSelectedDate=null;
  } else {
    plannerSelectedDate=dateStr;
  }
  if(calActiveTab==='planner')renderCalBody();
}

function renderPlannerDayDetail(dateStr){
  var today=getTodayStr();
  var isToday=dateStr===today;
  var isPast=dateStr<today;
  var planned=getPlannedForDate(dateStr)||{playlists:[]};
  var d=new Date(dateStr.replace(/-/g,'/'));
  var dayNames=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  var monthNames=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  var dateLabel=dayNames[d.getDay()]+', '+d.getDate()+' '+monthNames[d.getMonth()]+' '+d.getFullYear();

  var html='<div class="planner-detail-panel">'+
    '<div class="planner-detail-header">'+
      '<div class="planner-detail-date">'+dateLabel+
        (isToday?' <span style="font-size:10px;color:var(--accent);font-weight:700">BUGÜN</span>':'')+
        (isPast&&!isToday?' <span style="font-size:10px;color:var(--muted)">Geçmiş</span>':'')+
        (!isPast&&!isToday?' <span style="font-size:10px;color:var(--green)">İleri Tarih</span>':'')+
      '</div>'+
      '<button class="planner-detail-close" onclick="plannerSelectedDate=null;document.getElementById(\'plannerDetailPanel\').innerHTML=\'\'">✕</button>'+
    '</div>';

  // Playlist toggles section
  html+='<div class="planner-detail-section">'+
    '<div class="planner-detail-section-title">📂 Aktif Olacak Playlistler</div>';
  playlists.forEach(function(pl){
    var pp=planned.playlists?planned.playlists.find(function(p){return p.id===pl.id;}):null;
    var visible=pp?pp.visible:(isToday||isPast);
    html+='<div class="planner-pl-row">'+
      '<div class="planner-pl-name">'+
        (pl.color?'<span style="width:8px;height:8px;border-radius:50%;background:'+pl.color+';display:inline-block;flex-shrink:0"></span>':'')+
        escapeHtml(pl.name)+
        ' <span style="font-size:9px;color:var(--muted)">'+pl.items.length+' video</span>'+
      '</div>'+
      '<div class="planner-pl-toggle'+(visible?' on':'')+'" id="pltog-'+dateStr+'-'+pl.id+'" onclick="togglePlannerPl(\''+dateStr+'\',\''+pl.id+'\')">'+
        '<div class="planner-pl-knob"></div></div>'+
    '</div>';
  });
  html+='</div>';

  // Extra videos
  html+='<div class="planner-detail-section">'+
    '<div class="planner-detail-section-title">🎬 Bu Güne Özel Ek Videolar</div>';
  var extraItems=planned.extraVideos||[];
  if(extraItems.length>0){
    extraItems.forEach(function(vi,vi_idx){
      html+='<div class="planner-vid-row">'+
        '<span class="planner-vid-title">'+escapeHtml(vi.title||vi.id)+'</span>'+
        '<span class="planner-vid-vis '+(vi.visible?'visible':'hidden')+'" onclick="togglePlannerVid(\''+dateStr+'\','+vi_idx+')">'+
          (vi.visible?'👁':'🙈')+
        '</span>'+
        '<button class="planner-vid-del" onclick="deletePlannerVid(\''+dateStr+'\','+vi_idx+')">✕</button>'+
      '</div>';
    });
  } else {
    html+='<div style="font-size:11px;color:var(--muted);padding:4px 0 4px">Henüz ek video yok.</div>';
  }
  html+='<div class="planner-add-vid-bar">'+
    '<input type="text" id="plannerVidInput-'+dateStr+'" placeholder="YouTube linki veya Video ID..." onkeydown="if(event.key===\'Enter\')addPlannerVideo(\''+dateStr+'\')">'+
    '<button onclick="addPlannerVideo(\''+dateStr+'\')">+ Ekle</button>'+
  '</div></div>';

  html+='</div>'; // planner-detail-panel
  return html;
}

function togglePlannerPl(dateStr,plId){
  var day=ensurePlannerDate(dateStr);
  var pp=day.playlists?day.playlists.find(function(p){return p.id===plId;}):null;
  if(!pp){
    var pl=playlists.find(function(p){return p.id===plId;});
    if(!pl)return;
    pp={id:plId,name:pl.name,color:pl.color,visible:false};
    if(!day.playlists)day.playlists=[];
    day.playlists.push(pp);
  }
  pp.visible=!pp.visible;
  savePlanner();
  var tog=document.getElementById('pltog-'+dateStr+'-'+plId);
  if(tog)tog.classList.toggle('on',pp.visible);
  // Refresh calendar dots without full re-render
  if(calActiveTab==='planner'){
    // Update just the day cell dot
    var cells=document.querySelectorAll('.planner-cal-day');
    cells.forEach(function(cell){
      // can't easily identify, just update detail panel dots
    });
  }
}

function addPlannerVideo(dateStr){
  var inp=document.getElementById('plannerVidInput-'+dateStr);if(!inp)return;
  var val=inp.value.trim();if(!val)return;
  var vid=extractVideoId(val)||val;
  var day=ensurePlannerDate(dateStr);
  if(!day.extraVideos)day.extraVideos=[];
  if(day.extraVideos.some(function(v){return v.id===vid;})){showToast('Bu video zaten ekli!');return;}
  day.extraVideos.push({id:vid,title:'Yükleniyor...',visible:true});
  savePlanner();inp.value='';
  fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+vid+'&format=json')
    .then(function(r){return r.json();}).then(function(d){
      var di=plannerData[dateStr];if(!di||!di.extraVideos)return;
      var vi=di.extraVideos.find(function(v){return v.id===vid;});if(vi)vi.title=d.title||vid;
      savePlanner();refreshPlannerDetail(dateStr);
    }).catch(function(){});
  refreshPlannerDetail(dateStr);
}

function togglePlannerVid(dateStr,idx){
  var day=plannerData[dateStr];if(!day||!day.extraVideos||!day.extraVideos[idx])return;
  day.extraVideos[idx].visible=!day.extraVideos[idx].visible;
  savePlanner();refreshPlannerDetail(dateStr);
}
function deletePlannerVid(dateStr,idx){
  var day=plannerData[dateStr];if(!day||!day.extraVideos)return;
  day.extraVideos.splice(idx,1);savePlanner();refreshPlannerDetail(dateStr);
}

function refreshPlannerDetail(dateStr){
  // Update just the detail panel without full re-render
  var dp=document.getElementById('plannerDetailPanel');
  if(dp&&plannerSelectedDate===dateStr){
    dp.innerHTML=renderPlannerDayDetail(dateStr);
  } else {
    if(calActiveTab==='planner')renderCalBody();
  }
}

/* ── MANAGER TAB ── */
var mgrExpandedPl=null;
var mgrSearchQuery='';
// Drag state for manager
var mgrDragPlId=null;      // playlist being dragged

function renderManagerTab(body){
  var searchHtml='<input class="mgr-search" type="text" id="mgrSearch" placeholder="Playlist veya video ara..." oninput="onMgrSearch()" value="'+escapeHtml(mgrSearchQuery)+'">';
  var mgrHtml='';
  var filtered=playlists.filter(function(pl){
    if(!mgrSearchQuery)return true;
    var q=mgrSearchQuery.toLowerCase();
    return pl.name.toLowerCase().indexOf(q)>=0||pl.items.some(function(it){return it.title.toLowerCase().indexOf(q)>=0;});
  });

  filtered.forEach(function(pl){
    var isOpen=mgrExpandedPl===pl.id;
    var watched=pl.items.filter(function(it){return it.watched;}).length;
    var dot=pl.color?'<span class="mgr-pl-color-btn" style="background:'+pl.color+';border-color:'+pl.color+'44" onclick="event.stopPropagation();mgrOpenPlColorPicker(event,\''+pl.id+'\')" title="Renk Değiştir"></span>':'<span class="mgr-pl-color-btn" onclick="event.stopPropagation();mgrOpenPlColorPicker(event,\''+pl.id+'\')" title="Renk Seç"></span>';
    var isVisible=!pl.hidden;
    var canDelete=playlists.length>1;
    mgrHtml+='<div class="mgr-pl-block" id="mgrpl-'+pl.id+'" draggable="true" ondragstart="mgrPlDragStart(event,\''+pl.id+'\')" ondragend="mgrPlDragEnd(event)" ondragover="mgrPlDragOver(event,\''+pl.id+'\')" ondragleave="mgrPlDragLeave(event)" ondrop="mgrPlDrop(event,\''+pl.id+'\')">'+
      '<div class="mgr-pl-header" onclick="toggleMgrPl(\''+pl.id+'\')">'+
        '<span class="mgr-drag-handle" title="Sürükle">⠿</span>'+
        dot+
        '<div class="mgr-pl-title" id="mgrpltitle-'+pl.id+'">'+escapeHtml(pl.name)+'</div>'+
        '<div class="mgr-pl-stats">'+watched+'/'+pl.items.length+' izlendi</div>'+
        '<button class="mgr-pl-rename-btn" onclick="event.stopPropagation();mgrRenamePl(\''+pl.id+'\')" title="Yeniden Adlandır">✏</button>'+
        '<div class="mgr-pl-vis-toggle'+(isVisible?' on':'')+'" id="mgrvis-'+pl.id+'" onclick="event.stopPropagation();toggleMgrPlVisibility(\''+pl.id+'\')">'+
          '<div class="mgr-pl-vis-knob"></div></div>'+
        (canDelete?'<button class="mgr-pl-del-btn" onclick="event.stopPropagation();mgrDeletePlaylist(\''+pl.id+'\')" title="Playlist Sil">🗑</button>':'')+
        '<span style="font-size:10px;color:var(--muted);margin-left:2px">'+(isOpen?'▲':'▼')+'</span>'+
      '</div>'+
      '<div class="mgr-pl-body'+(isOpen?' open':'')+'" id="mgrplbody-'+pl.id+'">'+
        renderMgrPlBody(pl)+
      '</div>'+
    '</div>';
  });

  var newPlHtml='<button class="mgr-new-pl-btn" onclick="mgrCreatePlaylist()">＋ Yeni Playlist Oluştur</button>';
  body.innerHTML=searchHtml+mgrHtml+newPlHtml;
  var s=document.getElementById('mgrSearch');if(s&&mgrSearchQuery)s.setSelectionRange(s.value.length,s.value.length);
}

function renderMgrPlBody(pl){
  var html='';

  // ─── Category Management Section ───
  html+='<div class="mgr-cat-section">'+
    '<div class="mgr-cat-section-title">🏷 Kategori Yönetimi <span style="font-size:9px;color:var(--muted);font-weight:400">(sürükle-bırak ile sırala, videoları kategoriye sürükle)</span></div>';

  var cats=pl.categories||[];
  if(!pl.catOrder)pl.catOrder=cats.map(function(c){return c.id;});
  var orderedCats=pl.catOrder.map(function(id){return cats.find(function(c){return c.id===id;});}).filter(Boolean);
  cats.forEach(function(c){if(pl.catOrder.indexOf(c.id)<0){orderedCats.push(c);pl.catOrder.push(c.id);}});

  if(orderedCats.length===0){
    html+='<div style="font-size:11px;color:var(--muted);padding:4px 0 6px">Henüz kategori yok.</div>';
  } else {
    orderedCats.forEach(function(cat){
      var catVids=pl.items.filter(function(it){return it.categoryId===cat.id;});
      var isCatHidden=!!cat.hidden;
      html+='<div class="mgr-cat-block" id="mgrcatblock-'+pl.id+'-'+cat.id+'" draggable="true" style="opacity:'+(isCatHidden?0.45:1)+'" ondragstart="mgrCatDragStart(event,\''+pl.id+'\',\''+cat.id+'\')" ondragend="mgrCatDragEnd(event,\''+pl.id+'\',\''+cat.id+'\')" ondragover="mgrCatDragOver(event,\''+pl.id+'\',\''+cat.id+'\')" ondragleave="mgrCatDragLeave(event,\''+pl.id+'\',\''+cat.id+'\')" ondrop="mgrCatDrop(event,\''+pl.id+'\',\''+cat.id+'\')">'+
        '<div class="mgr-cat-block-header">'+
          '<span class="mgr-drag-handle" title="Kategoriyi Sürükle">⠿</span>'+
          '<span class="mgr-cat-color-dot" style="background:'+cat.color+'"></span>'+
          '<span class="mgr-cat-block-name" style="'+(isCatHidden?'text-decoration:line-through;color:var(--muted)':'')+'">'+escapeHtml(cat.name)+'</span>'+
          '<span style="font-size:10px;color:var(--muted);margin-left:4px">'+catVids.length+' video</span>'+
          '<div class="mgr-cat-block-actions">'+
            '<button class="mgr-vid-btn" onclick="mgrToggleCatHidden(\''+pl.id+'\',\''+cat.id+'\')" title="'+(isCatHidden?'Kategoriyi Göster':'Kategoriyi Gizle')+'" style="color:'+(isCatHidden?'var(--muted)':'var(--text2)')+'">'+
              (isCatHidden?'👁‍🗨':'👁')+
            '</button>'+
            '<button class="mgr-vid-btn" onclick="mgrRenameCat(\''+pl.id+'\',\''+cat.id+'\')" title="Yeniden Adlandır">✏</button>'+
            '<button class="mgr-vid-btn" onclick="mgrOpenCatColorPicker(event,\''+pl.id+'\',\''+cat.id+'\')" title="Renk Değiştir" style="color:'+cat.color+'">🎨</button>'+
            '<button class="mgr-vid-btn" onclick="mgrDeleteCat(\''+pl.id+'\',\''+cat.id+'\')" title="Kategoriyi Sil" style="color:var(--accent)">✕</button>'+
          '</div>'+
        '</div>';
      catVids.forEach(function(it){
        var realIdx=pl.items.indexOf(it);
        html+='<div class="mgr-cat-vid-item">'+
          '<span class="mgr-cat-vid-dot" style="background:'+(it.watched?'var(--green)':'var(--border2)')+'"></span>'+
          '<span class="mgr-cat-vid-title">'+escapeHtml(it.title)+'</span>'+
          '<button class="mgr-vid-btn" onclick="mgrRenameVideo(\''+pl.id+'\','+realIdx+')" title="İsim Değiştir" style="color:var(--gold);font-size:9px">✏</button>'+
          '<button class="mgr-vid-btn" onclick="mgrAttachToVideo(\''+pl.id+'\','+realIdx+')" title="PDF/Fotoğraf Ekle" style="color:var(--blue);font-size:9px">📎'+(it.attachments&&it.attachments.length>0?'<sup>'+it.attachments.length+'</sup>':'')+'</button>'+
          '<button class="mgr-vid-btn" onclick="mgrRemoveFromCat(\''+pl.id+'\','+realIdx+')" title="Kategoriden Çıkar" style="font-size:9px">↩</button>'+
        '</div>';
      });
      html+='<div class="mgr-cat-drop-zone" id="mgrcatdropzone-'+pl.id+'-'+cat.id+'">📁 Videoyu buraya bırak</div>';
      html+='<div class="mgr-cat-add-vid-row">'+
        '<select class="mgr-cat-add-vid-sel" id="mgrcatadd-'+pl.id+'-'+cat.id+'">'+
          '<option value="">— Videoya ata...</option>';
      pl.items.forEach(function(it,vi){
        if(it.categoryId===cat.id)return;
        html+='<option value="'+vi+'">'+escapeHtml(it.title.length>40?it.title.substr(0,40)+'…':it.title)+'</option>';
      });
      html+='</select>'+
        '<button class="mgr-vid-btn" onclick="mgrAssignToCat(\''+pl.id+'\',\''+cat.id+'\')" style="color:var(--green);border-color:rgba(46,204,113,0.4)">+ Ata</button>'+
      '</div>';
      html+='</div>'; // mgr-cat-block
    });
  }

  html+='<div class="mgr-cat-new-row">'+
    '<input type="text" class="mgr-cat-new-inp" id="mgrcatnew-'+pl.id+'" placeholder="Yeni kategori adı..." onkeydown="if(event.key===\'Enter\')mgrCreateCatInline(\''+pl.id+'\')">'+
    '<button class="mgr-vid-btn" onclick="mgrCreateCatInline(\''+pl.id+'\')" style="color:var(--green);border-color:rgba(46,204,113,0.4)">＋</button>'+
  '</div>';
  html+='</div>'; // mgr-cat-section

  html+='<div class="mgr-vid-section-title">🎬 Videolar <span style="font-size:9px;color:var(--muted);font-weight:400">(sürükle → sırala veya kategoriye bırak)</span></div>';
  if(pl.items.length===0){html+='<div style="font-size:11px;color:var(--muted);padding:4px 0 8px">Bu playlistte video yok.</div>';}
  var q=mgrSearchQuery.toLowerCase();
  var filteredItems=mgrSearchQuery?pl.items.filter(function(it){return it.title.toLowerCase().indexOf(q)>=0;}):pl.items;
  filteredItems.forEach(function(it){
    var realIdx=pl.items.indexOf(it);
    var cats2=pl.categories||[];
    var cat=cats2.find(function(c){return c.id===it.categoryId;})||null;
    var catBadge=cat?'<span class="mgr-cat-chip" style="background:'+cat.color+'22;color:'+cat.color+';border-color:'+cat.color+'44">'+escapeHtml(cat.name)+'</span>':'';
    var isWatched=it.watched;
    var isHiddenVid=!!it.hidden;
    var attachCount=it.attachments?it.attachments.length:0;
    html+='<div class="mgr-vid-item" id="mgrviditem-'+pl.id+'-'+realIdx+'" draggable="true" style="opacity:'+(isHiddenVid?0.4:1)+'" ondragstart="mgrVidDragStart(event,\''+pl.id+'\','+realIdx+')" ondragend="mgrVidDragEnd(event)" ondragover="mgrVidDragOver(event,\''+pl.id+'\','+realIdx+')" ondragleave="mgrVidDragLeave(event)" ondrop="mgrVidDrop(event,\''+pl.id+'\','+realIdx+')">'+
      '<span class="mgr-drag-handle" title="Sürükle">⠿</span>'+
      '<div style="width:10px;height:10px;border-radius:2px;flex-shrink:0;background:'+(isWatched?'var(--green)':'transparent')+';border:1.5px solid '+(isWatched?'var(--green)':'var(--border2)')+';display:flex;align-items:center;justify-content:center;font-size:7px;color:#fff">'+(isWatched?'✓':'')+'</div>'+
      '<div class="mgr-vid-title" id="mgrvtitle-'+pl.id+'-'+realIdx+'" style="'+(isHiddenVid?'text-decoration:line-through;color:var(--muted)':'')+'">'+escapeHtml(it.title)+' '+catBadge+(attachCount>0?'<span style="font-size:9px;color:var(--blue);margin-left:3px">📎'+attachCount+'</span>':'')+'</div>'+
      '<div class="mgr-vid-actions">'+
        '<button class="mgr-vid-btn" onclick="mgrRenameVideo(\''+pl.id+'\','+realIdx+')" title="İsim Değiştir" style="color:var(--gold)">✏</button>'+
        '<button class="mgr-vid-btn" onclick="mgrAttachToVideo(\''+pl.id+'\','+realIdx+')" title="PDF/Fotoğraf Ekle" style="color:var(--blue)">📎</button>'+
        '<button class="mgr-vid-btn" onclick="mgrMoveVideoTo(\''+pl.id+'\','+realIdx+')" title="Başka Playliste Kopyala">↗</button>'+
        '<button class="mgr-vid-btn" onclick="mgrToggleVidHidden(\''+pl.id+'\','+realIdx+')" title="'+(isHiddenVid?'Göster':'Gizle')+'" style="color:'+(isHiddenVid?'var(--muted)':'var(--text2)')+'">'+
          (isHiddenVid?'👁‍🗨':'👁')+
        '</button>'+
        '<button class="mgr-vid-btn" onclick="toggleMgrVidWatched(\''+pl.id+'\','+realIdx+')" title="İzlendi İşaretle">'+
          (isWatched?'✓':'○')+
        '</button>'+
        '<button class="mgr-vid-btn" onclick="mgrDeleteVideo(\''+pl.id+'\','+realIdx+')" title="Sil" style="color:var(--accent)">✕</button>'+
      '</div>'+
    '</div>';
  });
  html+='<div class="mgr-add-vid-row">'+
    '<input type="text" id="mgrvid-'+pl.id+'" placeholder="YouTube linki..." onkeydown="if(event.key===\'Enter\')mgrAddVideo(\''+pl.id+'\')">'+
    '<button onclick="mgrAddVideo(\''+pl.id+'\')">+ Ekle</button>'+
  '</div>';
  return html;
}

// ── Manager Category Functions ──
function mgrCreateCatInline(plId){
  var inp=document.getElementById('mgrcatnew-'+plId);if(!inp)return;
  var name=inp.value.trim();if(!name)return;
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  if(!pl.categories)pl.categories=[];
  var color=PALETTE[pl.categories.length%PALETTE.length];
  var cat={id:uid(),name:name,color:color};
  pl.categories.push(cat);
  if(!pl.catOrder)pl.catOrder=[];
  pl.catOrder.push(cat.id);
  saveAll();inp.value='';
  if(calActiveTab==='manager')renderCalBody();
  showToast('Kategori oluşturuldu: '+name);
}

function mgrDeleteCat(plId,catId){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  if(!confirm('Bu kategoriyi sil? Kategorideki videolar kategorisiz kalır.'))return;
  pl.categories=(pl.categories||[]).filter(function(c){return c.id!==catId;});
  pl.items.forEach(function(it){if(it.categoryId===catId)it.categoryId=null;});
  if(pl.catOrder)pl.catOrder=pl.catOrder.filter(function(id){return id!==catId;});
  saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
  showToast('Kategori silindi.');
}

function mgrRenameCat(plId,catId){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  var cat=(pl.categories||[]).find(function(c){return c.id===catId;});if(!cat)return;
  var newName=prompt('Yeni kategori adı:',cat.name);
  if(!newName||!newName.trim())return;
  cat.name=newName.trim();saveAll();
  if(calActiveTab==='manager')renderCalBody();
  showToast('Kategori adı güncellendi.');
}

function mgrOpenCatColorPicker(e,plId,catId){
  e.stopPropagation();
  e.preventDefault();
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  var cat=(pl.categories||[]).find(function(c){return c.id===catId;});if(!cat)return;
  var btn=e.currentTarget||e.target;
  colorPickerCallback=function(color){
    if(!color)return;
    cat.color=color;saveAll();
    renderPlaylist();
    if(calActiveTab==='manager')renderCalBody();
    showToast('Renk güncellendi.');
  };
  showColorPicker(btn,cat.color,null,null);
}

function mgrOpenPlColorPicker(e,plId){
  e.stopPropagation();
  e.preventDefault();
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  var btn=e.currentTarget||e.target;
  colorPickerCallback=function(color){
    pl.color=color;saveAll();
    renderTabs();renderPlaylist();
    if(calActiveTab==='manager')renderCalBody();
    showToast(color?'Playlist rengi güncellendi.':'Renk kaldırıldı.');
  };
  showColorPicker(btn,pl.color,null,null);
}

function mgrRenamePl(plId){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  // Inline rename in the mgr-pl-title span
  var titleEl=document.getElementById('mgrpltitle-'+plId);
  if(!titleEl){
    var newName=prompt('Playlist adı:',pl.name);
    if(!newName||!newName.trim())return;
    pl.name=newName.trim();saveAll();renderTabs();if(calActiveTab==='manager')renderCalBody();return;
  }
  var orig=pl.name;
  var inp=document.createElement('input');inp.className='mgr-pl-rename-inp';inp.type='text';inp.value=orig;
  titleEl.replaceWith(inp);inp.focus();inp.select();
  function done(){
    var v=inp.value.trim();
    if(v&&v!==orig){pl.name=v;saveAll();renderTabs();}
    if(calActiveTab==='manager')renderCalBody();
  }
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'){done();}if(e.key==='Escape'){if(calActiveTab==='manager')renderCalBody();}e.stopPropagation();});
  inp.addEventListener('blur',done);
}

// ── Manager Drag: Playlists ──
function mgrPlDragStart(e,plId){
  mgrDragPlId=plId;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/mgrpl',plId);
  setTimeout(function(){var el=document.getElementById('mgrpl-'+plId);if(el)el.classList.add('mgr-dragging');},0);
}
function mgrPlDragEnd(e){
  if(mgrDragPlId){var el=document.getElementById('mgrpl-'+mgrDragPlId);if(el)el.classList.remove('mgr-dragging');}
  document.querySelectorAll('.mgr-pl-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  mgrDragPlId=null;
}
function mgrPlDragOver(e,plId){
  if(!mgrDragPlId||mgrDragPlId===plId)return;
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.mgr-pl-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  var el=document.getElementById('mgrpl-'+plId);if(el)el.classList.add('mgr-drag-over');
}
function mgrPlDragLeave(e){
  // Only clear if really leaving the block
  if(e.currentTarget&&!e.currentTarget.contains(e.relatedTarget)){
    e.currentTarget.classList.remove('mgr-drag-over');
  }
}
function mgrPlDrop(e,targetPlId){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.mgr-pl-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  if(!mgrDragPlId||mgrDragPlId===targetPlId){mgrDragPlId=null;return;}
  var fromIdx=playlists.findIndex(function(p){return p.id===mgrDragPlId;});
  var toIdx=playlists.findIndex(function(p){return p.id===targetPlId;});
  if(fromIdx<0||toIdx<0){mgrDragPlId=null;return;}
  var moved=playlists.splice(fromIdx,1)[0];playlists.splice(toIdx,0,moved);
  mgrDragPlId=null;saveAll();renderTabs();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
}

// ── Manager Drag: Categories ──
var mgrDragCatInfo=null; // {plId, catId}
function mgrCatDragStart(e,plId,catId){
  mgrDragCatInfo={plId:plId,catId:catId};
  mgrDragVidInfo=null; // clear video drag
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/mgrcatdrag','cat');
  e.stopPropagation();
  setTimeout(function(){var el=document.getElementById('mgrcatblock-'+plId+'-'+catId);if(el)el.classList.add('mgr-dragging');},0);
}
function mgrCatDragEnd(e,plId,catId){
  var el=document.getElementById('mgrcatblock-'+plId+'-'+catId);if(el)el.classList.remove('mgr-dragging');
  document.querySelectorAll('.mgr-cat-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  document.querySelectorAll('.mgr-cat-drop-zone.active').forEach(function(d){d.classList.remove('active');});
  mgrDragCatInfo=null;
}
function mgrCatDragOver(e,plId,catId){
  e.preventDefault();e.stopPropagation();
  // If dragging a video, show drop zone
  if(mgrDragVidInfo&&mgrDragVidInfo.plId===plId){
    document.querySelectorAll('.mgr-cat-drop-zone.active').forEach(function(d){d.classList.remove('active');});
    var dz=document.getElementById('mgrcatdropzone-'+plId+'-'+catId);if(dz)dz.classList.add('active');
    document.querySelectorAll('.mgr-cat-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
    var el=document.getElementById('mgrcatblock-'+plId+'-'+catId);if(el)el.classList.add('mgr-drag-over');
    return;
  }
  // If dragging a category
  if(mgrDragCatInfo&&mgrDragCatInfo.plId===plId&&mgrDragCatInfo.catId!==catId){
    document.querySelectorAll('.mgr-cat-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
    var el2=document.getElementById('mgrcatblock-'+plId+'-'+catId);if(el2)el2.classList.add('mgr-drag-over');
  }
}
function mgrCatDragLeave(e,plId,catId){
  if(e.currentTarget&&!e.currentTarget.contains(e.relatedTarget)){
    e.currentTarget.classList.remove('mgr-drag-over');
    var dz=document.getElementById('mgrcatdropzone-'+plId+'-'+catId);if(dz)dz.classList.remove('active');
  }
}
function mgrCatDrop(e,plId,targetCatId){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.mgr-cat-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  document.querySelectorAll('.mgr-cat-drop-zone.active').forEach(function(d){d.classList.remove('active');});
  // Video drop into category
  if(mgrDragVidInfo&&mgrDragVidInfo.plId===plId){
    var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
    pl.items[mgrDragVidInfo.idx].categoryId=targetCatId;
    mgrDragVidInfo=null;saveAll();renderPlaylist();
    if(calActiveTab==='manager')renderCalBody();
    showToast('Video kategoriye atandı!');
    return;
  }
  // Category reorder
  if(!mgrDragCatInfo||mgrDragCatInfo.plId!==plId||mgrDragCatInfo.catId===targetCatId){mgrDragCatInfo=null;return;}
  var pl2=playlists.find(function(p){return p.id===plId;});if(!pl2||!pl2.catOrder){mgrDragCatInfo=null;return;}
  var fromIdx=pl2.catOrder.indexOf(mgrDragCatInfo.catId);
  var toIdx=pl2.catOrder.indexOf(targetCatId);
  if(fromIdx>=0&&toIdx>=0){pl2.catOrder.splice(fromIdx,1);pl2.catOrder.splice(toIdx,0,mgrDragCatInfo.catId);}
  mgrDragCatInfo=null;saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
}

// ── Manager Drag: Videos ──
var mgrDragVidInfo=null; // {plId, idx}
function mgrVidDragStart(e,plId,idx){
  mgrDragVidInfo={plId:plId,idx:idx};
  mgrDragCatInfo=null;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/mgrvidx',idx);
  e.stopPropagation();
  setTimeout(function(){var el=document.getElementById('mgrviditem-'+plId+'-'+idx);if(el)el.classList.add('mgr-dragging');},0);
}
function mgrVidDragEnd(e){
  document.querySelectorAll('.mgr-vid-item.mgr-dragging,.mgr-vid-item.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-dragging','mgr-drag-over');});
  document.querySelectorAll('.mgr-cat-block.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  document.querySelectorAll('.mgr-cat-drop-zone.active').forEach(function(d){d.classList.remove('active');});
  mgrDragVidInfo=null;
}
function mgrVidDragOver(e,plId,idx){
  e.preventDefault();e.stopPropagation();
  if(!mgrDragVidInfo||mgrDragVidInfo.plId!==plId||mgrDragVidInfo.idx===idx)return;
  document.querySelectorAll('.mgr-vid-item.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  var el=document.getElementById('mgrviditem-'+plId+'-'+idx);if(el)el.classList.add('mgr-drag-over');
}
function mgrVidDragLeave(e){
  if(e.currentTarget&&!e.currentTarget.contains(e.relatedTarget)){e.currentTarget.classList.remove('mgr-drag-over');}
}
function mgrVidDrop(e,plId,toIdx){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.mgr-vid-item.mgr-drag-over').forEach(function(d){d.classList.remove('mgr-drag-over');});
  if(!mgrDragVidInfo||mgrDragVidInfo.plId!==plId||mgrDragVidInfo.idx===toIdx){mgrDragVidInfo=null;return;}
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl){mgrDragVidInfo=null;return;}
  var moved=pl.items.splice(mgrDragVidInfo.idx,1)[0];pl.items.splice(toIdx,0,moved);
  mgrDragVidInfo=null;saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
}

function mgrAssignToCat(plId,catId){
  var selEl=document.getElementById('mgrcatadd-'+plId+'-'+catId);if(!selEl||!selEl.value)return;
  var vidIdx=parseInt(selEl.value);
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  if(!pl.items[vidIdx])return;
  pl.items[vidIdx].categoryId=catId;
  saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
  showToast('Video kategoriye atandı!');
}

function mgrRemoveFromCat(plId,vidIdx){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  if(!pl.items[vidIdx])return;
  pl.items[vidIdx].categoryId=null;
  saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
  showToast('Video kategoriden çıkarıldı.');
}

function onMgrSearch(){
  var s=document.getElementById('mgrSearch');mgrSearchQuery=s?s.value.trim():'';
  renderCalBody();
}

function toggleMgrPl(plId){
  mgrExpandedPl=(mgrExpandedPl===plId)?null:plId;
  renderCalBody();
}

function toggleMgrPlVisibility(plId){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  pl.hidden=!pl.hidden;
  saveAll();
  var tog=document.getElementById('mgrvis-'+plId);
  if(tog)tog.classList.toggle('on',!pl.hidden);
  renderTabs();renderPlaylist();
}

function mgrAddVideo(plId){
  var inp=document.getElementById('mgrvid-'+plId);if(!inp)return;
  var val=inp.value.trim();if(!val)return;
  var vid=extractVideoId(val);
  if(!vid){showToast('Geçersiz YouTube linki!');return;}
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  if(pl.items.some(function(x){return x.id===vid;})){showToast('Bu video zaten mevcut!');return;}
  pl.items.push({id:vid,title:'Yükleniyor...',watched:false});
  fetchTitle(vid);saveAll();inp.value='';
  renderPlaylist();
  showToast('Video eklendi!');
  if(calActiveTab==='manager')renderCalBody();
}

function mgrDeleteVideo(plId,idx){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  pl.items.splice(idx,1);saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
}

function mgrRenameVideo(plId,idx){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl||!pl.items[idx])return;
  var it=pl.items[idx];
  var newName=prompt('Video adı:',it.title);
  if(!newName||!newName.trim())return;
  it.title=newName.trim();
  // Update now-playing bar if this is the current video
  if(currentVideoId===it.id){
    var np=document.getElementById('npTitle');
    if(np)np.textContent=it.title;
  }
  saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
  showToast('Video adı güncellendi.');
}

function mgrAttachToVideo(plId,idx){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl||!pl.items[idx])return;
  var it=pl.items[idx];
  var inp=document.createElement('input');inp.type='file';inp.accept='.pdf,image/*';
  inp.onchange=function(){
    if(!inp.files||!inp.files[0])return;
    var file=inp.files[0];
    var reader=new FileReader();
    reader.onload=function(ev){
      if(!it.attachments)it.attachments=[];
      var isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
      it.attachments.push({name:file.name,type:isPdf?'pdf':'img',data:ev.target.result});
      saveAll();renderPlaylist();
      if(calActiveTab==='manager')renderCalBody();
      showToast((isPdf?'PDF':'Fotoğraf')+' eklendi: '+file.name);
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function mgrToggleCatHidden(plId,catId){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  var cat=pl.categories.find(function(c){return c.id===catId;});if(!cat)return;
  cat.hidden=!cat.hidden;
  saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
}

function mgrToggleVidHidden(plId,idx){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  pl.items[idx].hidden=!pl.items[idx].hidden;
  saveAll();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
}

function toggleMgrVidWatched(plId,idx){
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl||!pl.items[idx])return;
  pl.items[idx].watched=!pl.items[idx].watched;saveAll();renderTabs();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
}

function mgrMoveVideoTo(srcPlId,idx){
  var src=playlists.find(function(p){return p.id===srcPlId;});if(!src)return;
  var vid=src.items[idx];if(!vid)return;
  var opts=playlists.filter(function(p){return p.id!==srcPlId;});
  if(opts.length===0){showToast('Başka playlist yok!');return;}
  // Use openCopyVideoModal which already has a nice UI
  copyVideoSrcPlaylistId=srcPlId;copyVideoItem=vid;copyVideoTargetId=null;
  var el=document.getElementById('copyPlList');
  if(el){
    el.innerHTML='';
    opts.forEach(function(p){
      var row=document.createElement('div');row.className='copy-pl-opt'+(copyVideoTargetId===p.id?' selected':'');
      var dot=p.color?'<span style="width:8px;height:8px;border-radius:50%;background:'+p.color+';display:inline-block;margin-right:6px;flex-shrink:0"></span>':'';
      row.innerHTML=dot+escapeHtml(p.name)+' <span style="font-size:10px;color:var(--muted)">'+p.items.length+' video</span>';
      row.addEventListener('click',function(){copyVideoTargetId=p.id;el.querySelectorAll('.copy-pl-opt').forEach(function(o){o.classList.remove('selected');});row.classList.add('selected');});
      el.appendChild(row);
    });
  }
  document.getElementById('copyVideoModalOverlay').classList.add('open');
}

function mgrCreatePlaylist(){
  openNewPlaylistModal();
}

function mgrDeletePlaylist(plId){
  if(playlists.length<=1){showToast('En az bir playlist olmalı!');return;}
  var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
  if(!confirm('"'+pl.name+'" playlistini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.'))return;
  delete oopItems[plId];
  if(currentPlaylistId===plId){destroyPlayer();currentPlaylistId=null;}
  playlists=playlists.filter(function(p){return p.id!==plId;});
  if(activePlaylistId===plId)activePlaylistId=playlists[0].id;
  if(mgrExpandedPl===plId)mgrExpandedPl=null;
  saveAll();renderTabs();renderPlaylist();
  if(calActiveTab==='manager')renderCalBody();
  showToast('Playlist silindi: '+pl.name);
}


/* showToast → core.js'de tanımlı */

/* ══════════ POMODORO ══════════ */
var pomodoroActive=false;
var pomodoroPaused=false;
var pomodoroPhase='work'; // 'work' or 'break'
var pomodoroRound=1;
var pomodoroTotalRounds=4;
var pomodoroWorkMs=25*60*1000;
var pomodoroBreakMs=5*60*1000;
var pomodoroPhaseStart=0;      // timestamp when current phase started
var pomodoroPausedAt=0;        // elapsed ms when paused
var pomodoroInterval=null;

function openPomodoroSettings(){
  var ov=document.getElementById('pomodoroModalOverlay');
  document.getElementById('pomWorkMin').value=Math.round(pomodoroWorkMs/60000)||25;
  document.getElementById('pomBreakMin').value=Math.round(pomodoroBreakMs/60000)||5;
  document.getElementById('pomRounds').value=pomodoroTotalRounds||4;
  var stat=document.getElementById('pomCurrentStatus');
  if(pomodoroActive){
    var stateStr=pomodoroPaused?'⏸ Duraklatıldı':'▶ Devam ediyor';
    stat.style.display='block';
    stat.textContent='🍅 '+stateStr+' — '+(pomodoroPhase==='work'?'Çalışma':'Mola')+' • Tur '+pomodoroRound+'/'+pomodoroTotalRounds;
  }else{stat.style.display='none';}
  // Update modal buttons for active/paused state
  updatePomodoroModalBtns();
  ov.classList.add('open');
}
function closePomodoroSettings(){document.getElementById('pomodoroModalOverlay').classList.remove('open');}

function updatePomodoroModalBtns(){
  var startBtn=document.getElementById('pomStartBtn');
  var pauseBtn=document.getElementById('pomPauseBtn');
  if(!startBtn||!pauseBtn)return;
  if(pomodoroActive){
    startBtn.style.display='none';
    pauseBtn.style.display='';
    pauseBtn.textContent=pomodoroPaused?'▶ Devam Et':'⏸ Duraklat';
  } else {
    startBtn.style.display='';
    pauseBtn.style.display='none';
  }
}

function startPomodoro(){
  var w=parseInt(document.getElementById('pomWorkMin').value)||25;
  var b=parseInt(document.getElementById('pomBreakMin').value)||5;
  var r=parseInt(document.getElementById('pomRounds').value)||4;
  pomodoroWorkMs=w*60*1000;
  pomodoroBreakMs=b*60*1000;
  pomodoroTotalRounds=r;
  pomodoroRound=1;
  pomodoroPhase='work';
  pomodoroActive=true;
  pomodoroPaused=false;
  pomodoroPausedAt=0;
  pomodoroPhaseStart=Date.now();
  closePomodoroSettings();
  // Pause regular stopwatch during pomodoro
  if(swRunning)swPause();
  clearInterval(pomodoroInterval);
  pomodoroInterval=setInterval(pomodoroTick,200);
  updatePomodoroUI();
  showToast('🍅 Pomodoro başladı! '+w+'dk çalış, '+b+'dk mola × '+r+' tur');
}

function togglePomodoroPlayPause(){
  if(!pomodoroActive)return;
  if(pomodoroPaused){
    // Resume: shift phaseStart forward by how long we were paused
    pomodoroPhaseStart=Date.now()-pomodoroPausedAt;
    pomodoroPaused=false;
    clearInterval(pomodoroInterval);
    pomodoroInterval=setInterval(pomodoroTick,200);
    showToast('▶ Pomodoro devam ediyor');
  } else {
    // Pause: save elapsed so far
    pomodoroPausedAt=Date.now()-pomodoroPhaseStart;
    pomodoroPaused=true;
    clearInterval(pomodoroInterval);
    pomodoroInterval=null;
    showToast('⏸ Pomodoro duraklatıldı');
  }
  updatePomodoroMainBtn();
}

function updatePomodoroMainBtn(){
  var icon=document.getElementById('swPlayPauseIcon');
  var lbl=document.getElementById('swPlayPauseLbl');
  var btn=document.getElementById('swPlayPauseBtn');
  if(!pomodoroActive){return;}
  if(pomodoroPaused){
    icon.textContent='▶';lbl.textContent='Devam Et';
    btn.classList.remove('primary');
    document.getElementById('swDot').classList.remove('running');
    document.getElementById('swDisplay').classList.remove('running');
    document.getElementById('swStatus').textContent='Duraklatıldı';
  } else {
    icon.textContent='⏸';lbl.textContent='Duraklat';
    btn.classList.add('primary');
    document.getElementById('swDot').classList.add('running');
    document.getElementById('swDisplay').classList.add('running');
    document.getElementById('swStatus').textContent=pomodoroPhase==='work'?'🍅 Çalışıyor':'☕ Mola';
  }
}

function stopPomodoro(){
  pomodoroActive=false;
  pomodoroPaused=false;
  pomodoroPausedAt=0;
  clearInterval(pomodoroInterval);
  pomodoroInterval=null;
  // Restore stopwatch mode
  document.getElementById('swModeLabel').textContent='Kronometre';
  document.getElementById('pomodoroInfoBar').style.display='none';
  document.getElementById('swLapBtn').style.display='';
  var sw=document.querySelector('.stopwatch-panel');
  if(sw){sw.classList.remove('pom-work-phase','pom-break-phase');}
  updateSwUI();
  closePomodoroSettings();
  showToast('⬛ Pomodoro durduruldu.');
}

function pomodoroTick(){
  if(!pomodoroActive||pomodoroPaused)return;
  var elapsed=Date.now()-pomodoroPhaseStart;
  var phaseDur=pomodoroPhase==='work'?pomodoroWorkMs:pomodoroBreakMs;
  var remaining=phaseDur-elapsed;
  if(remaining<=0){
    // Phase ended
    if(pomodoroPhase==='work'){
      // Accumulate work time in stopwatch
      swAccum+=pomodoroWorkMs;
      if(pomodoroRound>=pomodoroTotalRounds){
        // All done!
        pomodoroActive=false;
        pomodoroPaused=false;
        clearInterval(pomodoroInterval);
        pomodoroInterval=null;
        document.getElementById('swDisplay').textContent=swFormat(swAccum);
        document.getElementById('swModeLabel').textContent='Kronometre';
        document.getElementById('pomodoroInfoBar').style.display='none';
        document.getElementById('swLapBtn').style.display='';
        document.querySelector('.stopwatch-panel').classList.remove('pom-work-phase','pom-break-phase');
        updateSwUI();saveAll();
        showToast('🎉 Tüm pomodoro turları tamamlandı! Harika iş!');
        beep([880,660],[0,450]);
        return;
      }
      // Move to break
      pomodoroPhase='break';
      pomodoroPhaseStart=Date.now();
      pomodoroPausedAt=0;
      showToast('☕ Tur '+pomodoroRound+' bitti! Mola zamanı!');
      beep([660],[0]);
    } else {
      // Break ended, next round
      pomodoroRound++;
      pomodoroPhase='work';
      pomodoroPhaseStart=Date.now();
      pomodoroPausedAt=0;
      showToast('🍅 Mola bitti! Tur '+pomodoroRound+'/'+pomodoroTotalRounds+' başlıyor!');
      beep([440],[0]);
    }
    updatePomodoroUI();
    return;
  }
  // Update display with countdown (remaining time in this phase)
  document.getElementById('swDisplay').textContent=swFormat(Math.max(0,remaining));
}

function beep(freqs,delays){
  try{
    var ac=new(window.AudioContext||window.webkitAudioContext)();
    freqs.forEach(function(f,i){
      setTimeout(function(){
        var osc=ac.createOscillator();var g=ac.createGain();
        osc.connect(g);g.connect(ac.destination);
        osc.frequency.value=f;g.gain.value=0.25;
        osc.start();osc.stop(ac.currentTime+0.3);
      },delays[i]||0);
    });
  }catch(e){}
}

function updatePomodoroUI(){
  if(!pomodoroActive)return;
  var isWork=pomodoroPhase==='work';
  var panel=document.querySelector('.stopwatch-panel');
  if(panel){
    panel.classList.toggle('pom-work-phase',isWork);
    panel.classList.toggle('pom-break-phase',!isWork);
  }
  document.getElementById('swModeLabel').textContent=isWork?'🍅 Çalışma':'☕ Mola';
  var infoBar=document.getElementById('pomodoroInfoBar');
  infoBar.style.display='block';
  infoBar.innerHTML='<span class="pom-badge '+(isWork?'work':'brk')+'">'+(isWork?'ÇALIŞMA':'MOLA')+'</span> Tur '+pomodoroRound+'/'+pomodoroTotalRounds+' • '+(isWork?Math.round(pomodoroWorkMs/60000):Math.round(pomodoroBreakMs/60000))+'dk';
  // Hide lap button during pomodoro
  document.getElementById('swLapBtn').style.display='none';
  updatePomodoroMainBtn();
}

/* ══════════ YOUTUBE PROXY YARDIMCISI ══════════
 *  Tüm YouTube Data API v3 çağrıları doğrudan googleapis.com yerine
 *  kendi proxy sunucunuza gider. Sunucu API anahtarını ekleyip iletir.
 *
 *  Kullanım: ytFetch('/youtube/v3/videos', {part:'contentDetails', id:'...'})
 *  Proxy URL örneği: GET /yt-api?path=/youtube/v3/videos&part=contentDetails&id=...
 * ═══════════════════════════════════════════════════════════════════════════*/
var LS_USER_YT_KEY = 'aha_user_yt_key_v1';
function getUserYtKey(){ return localStorage.getItem(LS_USER_YT_KEY) || ''; }
function setUserYtKey(k){ localStorage.setItem(LS_USER_YT_KEY, k); }
function clearUserYtKey(){ localStorage.removeItem(LS_USER_YT_KEY); }

function ytFetch(ytPath, params, fetchOptions) {
  var userKey = getUserYtKey();
  var qs = Object.keys(params || {}).map(function(k){
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  if(userKey){
    // Kullanıcının kendi key'i varsa doğrudan googleapis.com'a git
    var keyQs = 'key=' + encodeURIComponent(userKey);
    var directUrl = 'https://www.googleapis.com' + ytPath + '?' + keyQs + (qs ? '&' + qs : '');
    return fetch(directUrl, fetchOptions || {});
  } else {
    // Proxy üzerinden git (sunucu key'i ekler)
    var proxyUrl = YT_PROXY_BASE + '?path=' + encodeURIComponent(ytPath) + (qs ? '&' + qs : '');
    return fetch(proxyUrl, fetchOptions || {});
  }
}

/* ══════════ YOUTUBE PLAYLIST IMPORT ══════════ */
var GOOGLE_CLIENT_ID = '147388008345-01jo9mhgavc14dnu83rsrigdg2ue78pe.apps.googleusercontent.com';
// API anahtarı artık frontend'de bulunmuyor — tüm istekler proxy üzerinden gider
var YT_API_KEY = ''; // Kullanılmıyor; proxy /yt-api?path=... endpoint'i anahtarı sunucuda ekler
var YT_PROXY_BASE = 'https://anlathocanlat.onrender.com/yt-api'; // Kendi proxy sunucunuzun adresi (örn: https://senin-siten.com/yt-api)
var GOOGLE_SCOPES = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/drive.appdata';
var _ytTokenClient = null;
var _ytAccessToken = null;
var _ytImportVideos = [];
var _ytImportFetchTimer = null;
var _musicLastEmail = localStorage.getItem('aha_music_email') || '';

function initGoogleAuth() {
  if (!window.google || !window.google.accounts) return;
  if (_ytTokenClient) return; /* already initialized */
  _ytTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: function(resp) {
      if (resp.error) {
        /* Silent failures (no popup) are expected — ignore them */
        if(resp.error === 'interaction_required' || resp.error === 'access_denied' || resp.error === 'immediate_failed'){
          return;
        }
        showToast('❌ Google girişi başarısız: ' + resp.error);
        return;
      }
      _ytAccessToken = resp.access_token;
      /* Save email hint for future silent login */
      if(resp.email){ _musicLastEmail = resp.email; localStorage.setItem('aha_music_email', resp.email); }
      updateGoogleAuthUI(true);
      if(typeof renderMusicContent==='function') renderMusicContent();
      if(typeof fetchYTMusicPlaylists==='function') fetchYTMusicPlaylists();
      /* If YT import modal is open and has a URL, fetch it */
      var urlEl = document.getElementById('ytImportUrl');
      if(urlEl){
        var plId = extractPlaylistId(urlEl.value.trim());
        if(plId){ setYtStatus('loading','⏳ Playlist çekiliyor...'); fetchPlaylistYTApi(plId, null, [], ''); }
      }
    }
  });
  /* Attempt silent login (no popup) if we have a hint — user never sees this */
  if(_musicLastEmail && !_ytAccessToken){
    try{ _ytTokenClient.requestAccessToken({prompt:'none', hint:_musicLastEmail}); }catch(e){}
  }
}

function signInGoogle() {
  if (!_ytTokenClient) { setYtStatus('err','❌ Google API yüklenemedi, sayfayı yenile.'); return; }
  _ytTokenClient.requestAccessToken();
}

function signOutGoogle() {
  if (_ytAccessToken) google.accounts.oauth2.revoke(_ytAccessToken, function(){});
  _ytAccessToken = null;
  updateGoogleAuthUI(false);
}

function updateGoogleAuthUI(loggedIn) {
  // Settings panelini güncelle (topbar butonları artık yok)
  if(typeof _updateSettingsGoogleUI === 'function') _updateSettingsGoogleUI();
  // Drive butonlarını güncelle
  updateDriveBtnVisibility();
}

function extractPlaylistId(url) {
  if (!url) return null;
  url = url.trim();
  var m = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[A-Z]{2}[a-zA-Z0-9_-]{10,}$/.test(url)) return url;
  return null;
}

function openYtImportModal() {
  _ytImportVideos = [];
  document.getElementById('ytImportUrl').value = '';
  document.getElementById('ytImportUrl').disabled = false;
  document.getElementById('ytImportName').value = '';
  setYtStatus('', '');
  document.getElementById('ytImportPreview').style.display = 'none';
  var btn = document.getElementById('ytImportConfirmBtn');
  btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed';
  updateGoogleAuthUI(!!_ytAccessToken);
  document.getElementById('ytImportModalOverlay').classList.add('open');
  setTimeout(function(){ document.getElementById('ytImportUrl').focus(); }, 80);
  if (window.google && window.google.accounts && !_ytTokenClient) initGoogleAuth();
}

function closeYtImportModal() {
  document.getElementById('ytImportModalOverlay').classList.remove('open');
  if (_ytImportFetchTimer) { clearTimeout(_ytImportFetchTimer); _ytImportFetchTimer = null; }
}

function onYtImportUrlChange() {
  if (_ytImportFetchTimer) clearTimeout(_ytImportFetchTimer);
  _ytImportVideos = [];
  var btn = document.getElementById('ytImportConfirmBtn');
  btn.disabled = true; btn.style.opacity = '0.5'; btn.style.cursor = 'not-allowed';
  document.getElementById('ytImportPreview').style.display = 'none';

  var val = document.getElementById('ytImportUrl').value.trim();
  var plId = extractPlaylistId(val);
  if (!plId) {
    setYtStatus(val.length > 3 ? 'err' : '', val.length > 3 ? 'Geçerli bir YouTube playlist linki değil.' : '');
    return;
  }
  setYtStatus('loading', '⏳ Playlist bilgileri çekiliyor...');
  _ytImportFetchTimer = setTimeout(function(){ fetchPlaylistYTApi(plId, null, [], ''); }, 500);
}

function setYtStatus(type, msg) {
  var el = document.getElementById('ytImportStatus');
  el.textContent = msg;
  el.className = 'ytim-status' + (type ? ' ' + type : '');
}

function fetchPlaylistYTApi(plId, pageToken, accVideos, accName) {
  var namePromise = accName
    ? Promise.resolve(accName)
    : ytFetch('/youtube/v3/playlists', {part:'snippet', id:plId})
        .then(function(r) { return r.json(); })
        .then(function(d) { return (d.items && d.items[0] && d.items[0].snippet.title) || 'YouTube Playlist'; })
        .catch(function() { return 'YouTube Playlist'; });

  namePromise.then(function(name) {
    var params = {part:'snippet', maxResults:'50', playlistId:plId};
    if(pageToken) params.pageToken = pageToken;
    ytFetch('/youtube/v3/playlistItems', params)
      .then(function(r) {
        if (!r.ok) return r.json().then(function(e) { throw new Error(ytApiError(e)); });
        return r.json();
      })
      .then(function(data) {
        (data.items || []).forEach(function(item) {
          var s = item.snippet;
          if (!s || !s.resourceId || s.resourceId.kind !== 'youtube#video') return;
          var title = s.title || '';
          if (title === 'Deleted video' || title === 'Private video') return;
          accVideos.push({ id: s.resourceId.videoId, title: title });
        });

        if (data.nextPageToken && accVideos.length < 500) {
          setYtStatus('loading', '⏳ ' + accVideos.length + ' video alındı, devamı çekiliyor...');
          fetchPlaylistYTApi(plId, data.nextPageToken, accVideos, name);
        } else {
          onYtPlaylistFetched(name, accVideos);
        }
      })
      .catch(function(err) { setYtStatus('err', '❌ ' + (err.message || 'API hatası')); });
  });
}

function ytApiError(e) {
  try {
    var code = e.error.code;
    var reason = e.error.errors[0].reason;
    var msg = e.error.message || '';
    if (code === 401) return 'Oturum süresi doldu, tekrar giriş yap.';
    if (code === 403 && reason === 'quotaExceeded') return 'Günlük API kotası doldu.';
    if (code === 403 && reason === 'refererNotAllowed') return 'API key bu domain\'e izin vermiyor. Google Cloud Console\'da HTTP referrer kısıtlamasını kaldır veya localhost ekle.';
    if (code === 403 && reason === 'ipRefererBlocked') return 'API key IP/referrer kısıtlaması var. Google Cloud Console\'da kısıtlamayı kaldır.';
    if (code === 403 && reason === 'accessNotConfigured') return 'YouTube Data API bu proje için etkinleştirilmemiş. Google Cloud Console\'dan etkinleştir.';
    if (code === 403) return 'Erişim reddedildi [' + reason + ']: ' + msg;
    if (code === 404) return 'Playlist bulunamadı.';
    return 'API hatası ' + code + ' [' + reason + ']: ' + msg;
  } catch(e2) { return 'Bilinmeyen API hatası: ' + JSON.stringify(e); }
}

function onYtPlaylistFetched(name, videos) {
  _ytImportVideos = videos;
  if (videos.length === 0) { setYtStatus('err', '⚠️ Playlist boş veya herkese açık değil.'); return; }
  var nameInp = document.getElementById('ytImportName');
  if (!nameInp.value.trim()) nameInp.value = name;
  setYtStatus('ok', '✅ ' + videos.length + ' video bulundu.');

  var previewVids = document.getElementById('ytImportPreviewVids');
  previewVids.innerHTML = '';
  videos.slice(0, 6).forEach(function(v, i) {
    var d = document.createElement('div');
    d.className = 'ytim-preview-vid';
    d.textContent = (i + 1) + '. ' + v.title;
    previewVids.appendChild(d);
  });
  document.getElementById('ytImportPreviewCount').textContent =
    videos.length > 6 ? '+ ' + (videos.length - 6) + ' video daha...' : '';
  document.getElementById('ytImportPreview').style.display = 'block';

  var btn = document.getElementById('ytImportConfirmBtn');
  btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
}

function confirmYtImport() {
  if (_ytImportVideos.length === 0) return;
  var name = document.getElementById('ytImportName').value.trim() || 'YouTube Playlist';
  /* Import sırasında YouTube playlist ID'sini sakla — ilgili videolar için kullanılır */
  var srcPlId = extractPlaylistId(document.getElementById('ytImportUrl').value.trim()) || null;
  var newPl = {
    id: uid(), name: name, color: PALETTE[playlists.length % PALETTE.length],
    categories: [], notes: {}, collapsedCats: {}, catOrder: [], items: [],
    sourceYtPlaylistId: srcPlId   /* ← yeni alan */
  };
  playlists.push(newPl);
  activePlaylistId = newPl.id;
  _ytImportVideos.forEach(function(v) {
    if (!newPl.items.some(function(x) { return x.id === v.id; }))
      newPl.items.push({ id: v.id, title: v.title, watched: false });
  });
  renderTabs(); renderPlaylist(); saveAll();
  closeYtImportModal();
  showToast('✅ "' + name + '" oluşturuldu — ' + newPl.items.length + ' video eklendi.');
}

/* ══════════ MIDNIGHT SCHEDULER ══════════ */
function scheduleMidnightCheck(){
  var now=new Date();
  // ms until next midnight (00:00:00.000 local time)
  var tomorrow=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,0,0);
  var msUntilMidnight=tomorrow.getTime()-now.getTime();
  // Fire exactly at midnight, then every 24h after that
  setTimeout(function(){
    checkMidnightReset();
    scheduleMidnightCheck(); // reschedule for next midnight
  }, msUntilMidnight+50); // +50ms buffer so Date.now() is clearly in the new day
}

setInterval(function(){if(swRunning){saveAll();}},10000);

/* ══════════ GOOGLE DRIVE BACKUP ══════════ */
var DRIVE_FILE_NAME = 'anlathoca_backup.json';
var _driveFileId = null;

function getAllLocalData() {
  var data = {};
  ['aha_v4_data','aha_v4_history','aha_v4_planner','aha_v4_lastdate'].forEach(function(k) {
    try { var v = localStorage.getItem(k); if (v) data[k] = v; } catch(e) {}
  });
  data._backup_date = new Date().toISOString();
  data._version = 'aha_v4';
  return data;
}

function restoreAllLocalData(data) {
  ['aha_v4_data','aha_v4_history','aha_v4_planner','aha_v4_lastdate'].forEach(function(k) {
    try { if (data[k] !== undefined) localStorage.setItem(k, data[k]); } catch(e) {}
  });
}

function findDriveBackupFile(token) {
  if (_driveFileId) return Promise.resolve(_driveFileId);
  return fetch(
    "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D'" + DRIVE_FILE_NAME + "'&fields=files(id,name,modifiedTime)",
    { headers: { Authorization: 'Bearer ' + token } }
  )
  .then(function(r) { return r.json(); })
  .then(function(d) {
    _driveFileId = (d.files && d.files.length > 0) ? d.files[0].id : null;
    return _driveFileId;
  });
}

function backupToDrive() {
  if (!_ytAccessToken) { showToast('❌ Yedekleme için Google hesabına giriş yap.'); return; }
  var token = _ytAccessToken;
  var payload = JSON.stringify(getAllLocalData(), null, 2);
  var blob = new Blob([payload], { type: 'application/json' });
  setDriveBtn('loading', '⏳ Yedekleniyor...');

  findDriveBackupFile(token)
  .then(function(fileId) {
    if (fileId) {
      return fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: blob
      });
    } else {
      var meta = JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] });
      var form = new FormData();
      form.append('metadata', new Blob([meta], { type: 'application/json' }));
      form.append('file', blob);
      return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form
      }).then(function(r) { return r.json(); })
        .then(function(d) { _driveFileId = d.id; });
    }
  })
  .then(function() {
    var now = new Date();
    var timeStr = pad(now.getHours()) + ':' + pad(now.getMinutes());
    setDriveBtn('ok', '✅ Yedeklendi');
    showToast('✅ Drive\'a yedeklendi — ' + timeStr);
    setTimeout(function(){ setDriveBtn('idle', '☁ Yedekle'); }, 3000);
  })
  .catch(function(err) {
    setDriveBtn('err', '❌ Hata');
    showToast('❌ Yedekleme başarısız: ' + (err.message || ''));
    setTimeout(function(){ setDriveBtn('idle', '☁ Yedekle'); }, 3000);
  });
}

function restoreFromDrive() {
  if (!_ytAccessToken) { showToast('❌ Geri yükleme için Google hesabına giriş yap.'); return; }
  if (!confirm('⚠️ Mevcut veriler Drive\'daki yedekle değiştirilecek. Devam et?')) return;
  var token = _ytAccessToken;
  findDriveBackupFile(token)
  .then(function(fileId) {
    if (!fileId) throw new Error('Drive\'da yedek bulunamadı. Önce yedekle.');
    return fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(function(r) { return r.json(); });
  })
  .then(function(data) {
    if (!data._version) throw new Error('Geçersiz yedek formatı.');
    restoreAllLocalData(data);
    showToast('✅ Veriler geri yüklendi! Sayfa yenileniyor...');
    setTimeout(function(){ location.reload(); }, 1500);
  })
  .catch(function(err) { showToast('❌ ' + (err.message || 'Geri yükleme başarısız')); });
}

function setDriveBtn(state, text) {
  var btn = document.getElementById('driveBkpBtn');
  if (!btn) return;
  btn.textContent = text;
  btn.style.background = state === 'ok' ? 'rgba(46,204,113,0.15)' :
                         state === 'err' ? 'rgba(232,69,69,0.15)' :
                         state === 'loading' ? 'rgba(245,200,66,0.15)' : '';
  btn.style.borderColor = state === 'ok' ? 'rgba(46,204,113,0.4)' :
                          state === 'err' ? 'rgba(232,69,69,0.4)' :
                          state === 'loading' ? 'rgba(245,200,66,0.4)' : '';
  btn.style.color = state === 'ok' ? 'var(--green)' :
                    state === 'err' ? 'var(--accent)' :
                    state === 'loading' ? 'var(--gold)' : '';
}

function updateDriveBtnVisibility() {
  var loggedIn = !!_ytAccessToken;
  // Settings panel drive butonları
  var driveRow = document.getElementById('settingsDriveRow');
  if(driveRow) driveRow.style.display = loggedIn ? 'flex' : 'none';
}

/* ══════════ İLGİLİ VİDEOLAR — HİBRİT 3 KATLI SİSTEM ══════════
 * KAT 1: Lokal playlist eşleştirme — 0 kota, %95 dogruluk
 * KAT 2: Kanal YouTube playlist taraması — 2 kota, %90 dogruluk
 * KAT 3: Uploads fallback + sayisal siralama — 3-5 kota, %65 dogruluk
 * Toplam max: 5 kota. Eski search yöntemi: 102 kota.
 */
var _relatedTabActive = false;
var _relatedCache = {};   /* videoId -> {items, allItems, channelTitle, currentTitle, source} */
var _relatedLastVid = null;

function switchToRelatedTab(){
  _relatedTabActive = true;
  document.getElementById('plContent').style.display = 'none';
  document.getElementById('relatedPanel').style.display = 'flex';
  renderTabs();
  showRelatedSearchArea();
  if(!currentVideoId){
    document.getElementById('relatedList').innerHTML = '<div class="related-empty">Önce bir video oynat,<br>aynı kanalın diğer videoları burada görünür.</div>';
    return;
  }
  if(_relatedCache[currentVideoId]){
    renderRelatedVideos(_relatedCacheShuffled(currentVideoId), _relatedCache[currentVideoId].channelTitle);
  } else {
    fetchRelatedVideos(false);
  }
}

/* ISO 8601 süreyi saniyeye çevirir */
function parseDuration(iso){
  var m=iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if(!m)return 9999;
  return (parseInt(m[1]||0)*3600)+(parseInt(m[2]||0)*60)+(parseInt(m[3]||0));
}

/* Fisher-Yates shuffle – diziyi yerinde karıştırır, kopyasını döner */
function shuffleArray(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
  return a;
}

/*
 * Başlık benzerlik skoru — 0 kota, saf JS
 * Yeni: sayısal yakınlık (103 izliyorsan 104>102>90>60 sırası)
 * + ileriye yönelim bonusu (seri izleyicisi ilerlemek ister)
 */
function _extractLeadingNumber(title){
  /* Başlıktaki "ana seri numarası"nı bul.
     Önce "Ders 103", "103. Ders", "Part 103", "Bölüm 103" gibi
     seri anahtar kelimesinin yanındaki sayıyı ara.
     Bulamazsan başlıktaki ilk 1-4 haneli sayıyı al.
     2024 gibi yıl sayılarını filtrele (>999 ise atla). */
  var s = title.toLowerCase().replace(/[^\w\s]/g,' ');
  /* Seri kelimeleri yanındaki sayı */
  var m = s.match(/(?:ders|bölüm|bolum|kısım|kisim|part|ep|episode|lecture|video|hafta|konu|unite|ünite|sınıf|sinif|lesson)\s*#?\s*(\d{1,4})\b/i);
  if(m) return parseInt(m[1],10);
  /* Sayı + seri kelimesi (ters sıra: "103. Ders") */
  m = s.match(/\b(\d{1,4})\s*\.?\s*(?:ders|bölüm|bolum|kısım|kisim|part|ep|episode|lecture|video|hafta|konu)\b/i);
  if(m) return parseInt(m[1],10);
  /* Başlıktaki ilk 1-4 haneli sayı, yıl değil */
  var nums = s.match(/\b(\d{1,4})\b/g);
  if(nums){
    for(var i=0;i<nums.length;i++){
      var n=parseInt(nums[i],10);
      if(n>0 && n<=9999 && !(n>=1900&&n<=2100)) return n;
    }
  }
  return null;
}

function _titleSimilarity(currentTitle, candidateTitle){
  var normalize = function(s){
    return s.toLowerCase()
      .replace(/[^\w\s]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  };
  var ct   = normalize(currentTitle);
  var cand = normalize(candidateTitle);

  var ctTokens   = ct.split(' ').filter(function(t){ return t.length > 1; });
  var candTokens = cand.split(' ').filter(function(t){ return t.length > 1; });

  if(!ctTokens.length || !candTokens.length) return 0;

  /* ── Sayısal yakınlık skoru ── */
  var curNum  = _extractLeadingNumber(currentTitle);
  var candNum = _extractLeadingNumber(candidateTitle);
  var numScore = 0;
  if(curNum !== null && candNum !== null){
    var diff = candNum - curNum;   /* pozitif = ileri, negatif = geri */
    var absDiff = Math.abs(diff);
    if(absDiff === 0){
      numScore = 0;               /* aynı video, zaten filtrelenmiş */
    } else if(absDiff <= 2){
      numScore = 20;              /* 104, 105 veya 102, 101 — çok yakın */
    } else if(absDiff <= 5){
      numScore = 14;
    } else if(absDiff <= 10){
      numScore = 8;
    } else if(absDiff <= 20){
      numScore = 3;
    } else if(absDiff <= 50){
      numScore = 0;
    } else {
      numScore = -6;              /* çok uzak: aşağı it */
    }
    /* İleriye yönelim bonusu: seri izleyicisi sonraki dersi ister */
    if(diff > 0 && diff <= 10) numScore += 3;
  }

  /* ── Kelime benzerlik skoru ── */
  var wordScore = 0;
  var candSet = {};
  candTokens.forEach(function(t){ candSet[t] = true; });
  ctTokens.forEach(function(t){
    if(candSet[t]){
      if(/^\d+$/.test(t)) { /* sayılar numScore ile halloldu */ }
      else if(/^(part|bölüm|bolum|kisim|kısım|ep|episode|ders|lecture|video|series|hafta|konu)$/i.test(t)) wordScore += 4;
      else if(t.length >= 5) wordScore += 3;
      else if(t.length >= 3) wordScore += 1;
    }
  });
  wordScore = wordScore / Math.max(ctTokens.length, 1);

  return numScore + wordScore;
}

/* Cache'deki videoları akıllıca sıralar — 0 kota
 * KAT 1 veya 2'den gelen veriler zaten sıralı gelir (playlistIndex).
 * Uploads fallback için sayısal skor kullanır.
 */
function _relatedCacheShuffled(vid){
  var c = _relatedCache[vid];
  if(!c) return [];
  var pool = c.allItems && c.allItems.length ? c.allItems : c.items;
  var currentTitle = c.currentTitle || '';

  /* KAT 1/2: playlistIndex varsa sıralı döndür — en güvenilir mod */
  var hasIndex = pool.length > 0 && pool[0].playlistIndex !== undefined;
  if(hasIndex){
    /* Pool zaten izlenen videoyu içermiyor (filtrelenmiş).
       playlistIndex değerlerinden izlenen videonun hangi konumda
       olduğunu bul: izlenen videonun indexini kaydetmişsek kulllan,
       yoksa sayısal tahmin yap */
    var curIdx = (c.currentIndex !== undefined) ? c.currentIndex : -1;

    /* currentIndex yoksa: pool'daki indexlerin "boşluğuna" bak */
    if(curIdx < 0){
      /* pool'u sırala, ardışık index boşluğu = izlenen videonun yeri */
      var sorted = pool.slice().sort(function(a,b){ return a.playlistIndex - b.playlistIndex; });
      for(var si=0; si<sorted.length-1; si++){
        if(sorted[si+1].playlistIndex - sorted[si].playlistIndex > 1){
          curIdx = sorted[si].playlistIndex + 1;
          break;
        }
      }
      /* Hâlâ bulunamadıysa sayısal tahmin */
      if(curIdx < 0){
        var curNum = _extractLeadingNumber(currentTitle);
        if(curNum !== null){
          var bestDiff = Infinity;
          pool.forEach(function(it){
            var n = _extractLeadingNumber(it.title);
            if(n !== null){
              var d = Math.abs(n - curNum);
              if(d < bestDiff){ bestDiff = d; curIdx = it.playlistIndex; }
            }
          });
          /* İzlenen videonun tahmini indexi curIdx ise
             1 öncesi veya 1 sonrasına ayarla */
          if(curIdx >= 0){
            var exact = pool.find(function(it){ return it.playlistIndex === curIdx; });
            if(exact){
              var exNum = _extractLeadingNumber(exact.title);
              if(exNum !== null && exNum < curNum) curIdx = exact.playlistIndex + 1;
              else curIdx = exact.playlistIndex - 1;
            }
          }
        }
      }
    }

    if(curIdx >= 0){
      /* İlk 5: kesinlikle bir sonraki bölümler (sıralı) */
      var after  = pool.filter(function(it){ return it.playlistIndex > curIdx; })
                       .sort(function(a,b){ return a.playlistIndex - b.playlistIndex; });
      var before = pool.filter(function(it){ return it.playlistIndex < curIdx; })
                       .sort(function(a,b){ return b.playlistIndex - a.playlistIndex; });
      var top5   = after.slice(0,5);
      var mid    = before.slice(0,3).concat(after.slice(5,10));
      var farRest = pool.filter(function(it){
        return it.playlistIndex < curIdx-3 || it.playlistIndex > curIdx+10;
      });
      return top5.concat(mid).concat(shuffleArray(farRest)).slice(0,20);
    }
    /* curIdx bulunamadıysa düz playlistIndex sırası */
    return pool.slice().sort(function(a,b){ return a.playlistIndex - b.playlistIndex; }).slice(0,20);
  }

  /* ── Uploads fallback: playlistIndex varsa onu kullan (sayfa tarama sonucu) ── */
  var hasPlIdx = pool.length > 0 && pool[0].playlistIndex !== undefined;
  if(hasPlIdx){
    /* currentIndex cache'den geliyorsa direkt kullan */
    var curIdx2 = (c.currentIndex !== undefined) ? c.currentIndex : -1;
    if(curIdx2 >= 0){
      var after2  = pool.filter(function(it){ return it.playlistIndex > curIdx2; })
                        .sort(function(a,b){ return a.playlistIndex - b.playlistIndex; });
      var before2 = pool.filter(function(it){ return it.playlistIndex < curIdx2; })
                        .sort(function(a,b){ return b.playlistIndex - a.playlistIndex; });

      /* İlk 5: sonraki 5 video (kesin sıralı devam) */
      var top5 = after2.slice(0,5);
      /* 6-20: önce önceki 3, sonra kalan after, geri kalanı shuffle */
      var mid  = before2.slice(0,3).concat(after2.slice(5,10));
      var rest2 = shuffleArray(
        pool.filter(function(it){
          return it.playlistIndex < curIdx2-3 || it.playlistIndex > curIdx2+10;
        })
      );
      return top5.concat(mid).concat(rest2).slice(0,20);
    }
  }

  /* ── Saf skor bazlı (playlistIndex yoksa) ── */
  if(!currentTitle) return shuffleArray(pool).slice(0,20);

  var curNum2 = _extractLeadingNumber(currentTitle);
  var scored = pool.map(function(item){
    var s = _titleSimilarity(currentTitle, item.title);
    /* Sayısal yakınlık bonusu: |curNum - itemNum| == 1 ise güçlü bonus */
    if(curNum2 !== null){
      var itemNum = _extractLeadingNumber(item.title);
      if(itemNum !== null){
        var diff = itemNum - curNum2;
        if(diff === 1)       s += 20; /* bir sonraki bölüm — en yüksek öncelik */
        else if(diff === 2)  s += 10;
        else if(diff === -1) s += 4;  /* bir önceki bölüm */
        else if(diff > 2 && diff <= 5) s += 3;
      }
    }
    return { item:item, score:s };
  });
  scored.sort(function(a,b){ return b.score - a.score; });

  /* İlk 5: kesin en yüksek skor (sıralı devam adayları) */
  var top5s = scored.slice(0,5).map(function(x){ return x.item; });
  /* 6-20: karıştırılmış (çeşitlilik için) */
  var rest5 = shuffleArray(scored.slice(5).map(function(x){ return x.item; }));
  return top5s.concat(rest5).slice(0,20);
}

/*
 * KOTa OPTİMİZASYONU:
 * ESKİ YÖNTEM:  videos(snippet)=1 + search(channelId)=100 + videos(contentDetails)=1 → 102 kota/istek
 * YENİ YÖNTEM:  videos(snippet+contentDetails)=1 + channels(contentDetails)=1 + playlistItems=1 → 3 kota/istek
 *
 * search API'si HİÇ kullanılmıyor. Bunun yerine kanalın uploads playlist'i
 * playlistItems endpoint'i ile çekiliyor (1 kota birimi, search=100 kota birimi).
 * Shorts filtresi de aynı tek çağrıda yapılıyor (contentDetails birleşik sorgu).
 */
/*
 * KAT 1: Lokal playlist kontrolü — sıfır API, sıfır kota
 * ÖNEMLİ: Önce AKTİF playlist'e bak. Video birden fazla playlist'te olsa bile
 * kullanıcının şu an baktığı playlist'ten öneri getir.
 * Aktif playlist'te yoksa diğer playlist'lere bak.
 */
function _tryLocalPlaylistMatch(vid, currentTitle){
  var found = -1;
  var foundPl = null;

  /* 1) Önce aktif playlist */
  var activePl = getActivePlaylist();
  if(activePl){
    var idx = activePl.items.findIndex(function(it){ return it.id===vid; });
    if(idx >= 0){ found = idx; foundPl = activePl; }
  }

  /* 2) Aktif playlist'te yoksa diğerlerine bak */
  if(!foundPl){
    for(var pi=0; pi<playlists.length; pi++){
      var pl = playlists[pi];
      if(activePl && pl.id === activePl.id) continue; /* aktif zaten kontrol edildi */
      var idx2 = pl.items.findIndex(function(it){ return it.id===vid; });
      if(idx2 >= 0){ found = idx2; foundPl = pl; break; }
    }
  }

  if(!foundPl || found < 0) return false;

  /* Pool: sadece foundPl'den, izlenen video hariç, gerçek index ile */
  var pool = foundPl.items
    .map(function(it, realIdx){
      if(it.id === vid) return null;
      return {
        id: it.id,
        title: it.title || it.id,
        channel: foundPl.name,
        thumb: 'https://i.ytimg.com/vi/' + it.id + '/mqdefault.jpg',
        playlistIndex: realIdx
      };
    })
    .filter(Boolean);

  if(!pool.length) return false;

  _relatedCache[vid] = {
    items: pool.slice(0,20),
    allItems: pool,
    channelTitle: foundPl.name,
    currentTitle: currentTitle,
    currentIndex: found,
    source: 'local'
  };
  if(_relatedTabActive) renderRelatedVideos(_relatedCacheShuffled(vid), foundPl.name);
  return true;
}

/*
 * KAT 2: Kanal YouTube playlist taraması — 2 kota
 * channels.list(1) + playlists.list(1) → başlık eşleştir → playlistItems.list(1)
 * Toplam: 3 kota max. search.list yok.
 */
function _fetchByChannelPlaylists(vid, channelId, channelTitle, currentTitle){
  /* playlists.list: kanalın tüm playlistlerini çek (50 adet, genelde yeterli) */
  return ytFetch('/youtube/v3/playlists', {part:'snippet', channelId:channelId, maxResults:'50'})
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(d.error || !d.items || !d.items.length) throw new Error('no_playlists');

      /* Başlık benzerliği ile en iyi playlist'i bul
         Strateji: video başlığındaki "anlamlı" kelimelerin kaç tanesi
         playlist başlığında geçiyor? Stop-word'leri çıkar, kök eşleşmesi yap */
      var stopWords = {ve:1,ile:1,bir:1,bu:1,da:1,de:1,ki:1,in:1,on:1,of:1,the:1,and:1,
                       için:1,kadar:1,olan:1,olan:1,var:1,yok:1,bölüm:1,bolum:1,ders:1,
                       part:1,episode:1,ep:1,video:1,konu:1,hafta:1};

      /* Video başlığından arama kelimeleri çıkar */
      var ctRaw = currentTitle.toLowerCase().replace(/[^\wğüşıöçğüşıöç\s]/gi,' ').replace(/\s+/g,' ').trim();
      var ctTokens = ctRaw.split(' ').filter(function(t){
        return t.length > 2 && !stopWords[t] && !/^\d+$/.test(t);
      });

      var best = null, bestScore = -1;
      d.items.forEach(function(pl){
        var pt = (pl.snippet.title||'').toLowerCase().replace(/[^\wğüşıöçğüşıöç\s]/gi,' ').replace(/\s+/g,' ').trim();
        var ptTokens = pt.split(' ').filter(function(t){ return t.length > 2 && !stopWords[t]; });

        /* Her ctToken için playlist'te kısmi eşleşme ara (startsWith veya includes) */
        var matchCount = 0;
        ctTokens.forEach(function(ct){
          var hit = ptTokens.some(function(pt){
            return pt === ct ||                    /* tam eşleşme */
                   pt.indexOf(ct) === 0 ||         /* ct, pt'nin önekidir */
                   ct.indexOf(pt) === 0 ||         /* pt, ct'nin önekidir */
                   (ct.length >= 5 && pt.indexOf(ct) >= 0);  /* uzun kelime içerme */
          });
          if(hit) matchCount++;
        });

        /* Skor: eşleşen token sayısı / toplam anlamlı ct token sayısı */
        var score = ctTokens.length > 0 ? matchCount / ctTokens.length : 0;

        /* Bonus: playlist başlığı kısaysa ve yüksek örtüşüm varsa */
        if(ptTokens.length > 0 && matchCount > 0){
          var reverseScore = matchCount / ptTokens.length;
          score = Math.max(score, reverseScore);
        }

        if(score > bestScore){ bestScore = score; best = pl; }
      });

      /* Threshold'u düşür: tek kelime eşleşmesi bile yeterli olsun
         (ctTokens.length 1 ise 1/1 = 1.0, 3 ise en az 1 eşleşme = 0.33) */
      var threshold = ctTokens.length <= 2 ? 0.3 : 0.2;
      if(!best || bestScore < threshold) throw new Error('no_match');

      var matchedPlId = best.id;
      var matchedPlTitle = best.snippet.title;

      /* playlistItems.list: eşleşen playlist'in videolarını çek */
      return ytFetch('/youtube/v3/playlistItems', {part:'snippet', playlistId:matchedPlId, maxResults:'50'})
        .then(function(r){ return r.json(); })
        .then(function(d2){
          if(d2.error) throw new Error('pl_items_fail');
          var currentIndex = -1; /* izlenen videonun gerçek playlist konumu */
          var allRaw = d2.items || [];
          /* Önce tüm öğeleri işle (izlenen dahil) gerçek index için */
          var poolWithCurrent = allRaw.map(function(it, idx){
              if(!it.snippet||!it.snippet.resourceId||!it.snippet.resourceId.videoId) return null;
              var sn = it.snippet;
              var vidId = sn.resourceId.videoId;
              if(vidId === vid){ currentIndex = idx; return null; } /* izlenen videoyu çıkar, indexini sakla */
              var thumb = sn.thumbnails && (sn.thumbnails.medium||sn.thumbnails.default) ?
                (sn.thumbnails.medium||sn.thumbnails.default).url :
                'https://i.ytimg.com/vi/'+vidId+'/mqdefault.jpg';
              return { id:vidId, title:sn.title||vidId, channel:channelTitle, thumb:thumb, playlistIndex:idx };
            }).filter(Boolean);
          var pool = poolWithCurrent;

          if(!pool.length) throw new Error('empty_pl');

          /* Sonraki sayfayı da çek (daha büyük havuz için) */
          if(d2.nextPageToken){
            return ytFetch('/youtube/v3/playlistItems', {part:'snippet', playlistId:matchedPlId, maxResults:'50', pageToken:d2.nextPageToken})
              .then(function(r){ return r.json(); })
              .then(function(d3){
                var extra = (d3.items||[])
                  .filter(function(it){
                    return it.snippet&&it.snippet.resourceId&&
                           it.snippet.resourceId.videoId&&
                           it.snippet.resourceId.videoId!==vid;
                  })
                  .map(function(it,idx){
                    var sn=it.snippet;
                    var vidId=sn.resourceId.videoId;
                    var thumb=sn.thumbnails&&(sn.thumbnails.medium||sn.thumbnails.default)?
                      (sn.thumbnails.medium||sn.thumbnails.default).url:
                      'https://i.ytimg.com/vi/'+vidId+'/mqdefault.jpg';
                    return {id:vidId,title:sn.title||vidId,channel:channelTitle,thumb:thumb,playlistIndex:pool.length+idx};
                  });
                return {pool: pool.concat(extra), plTitle: matchedPlTitle, currentIndex: currentIndex};
              })
              .catch(function(){ return {pool:pool, plTitle:matchedPlTitle, currentIndex:currentIndex}; });
          }
          return {pool:pool, plTitle:matchedPlTitle, currentIndex:currentIndex};
        });
    })
    .then(function(result){
      _relatedCache[vid] = {
        items: result.pool.slice(0,20),
        allItems: result.pool,
        channelTitle: result.plTitle || channelTitle,
        currentTitle: currentTitle,
        currentIndex: result.currentIndex >= 0 ? result.currentIndex : undefined,
        source: 'channel_playlist'
      };
      if(_relatedTabActive) renderRelatedVideos(_relatedCacheShuffled(vid), result.plTitle||channelTitle);
      return true;
    });
}

function fetchRelatedVideos(force){
  var vid = currentVideoId;
  if(!vid){
    document.getElementById('relatedList').innerHTML='<div class="related-empty">Önce bir video oynat.</div>';
    return;
  }

  /* Yenile (force=true): cache'i tamamen sil, API'den yeniden çek */
  if(force){ delete _relatedCache[vid]; }
  /* Zaten cache'de varsa direkt göster */
  if(!force && _relatedCache[vid]){
    renderRelatedVideos(_relatedCacheShuffled(vid), _relatedCache[vid].channelTitle);
    return;
  }

  _relatedLastVid = vid;
  document.getElementById('relatedList').innerHTML='<div class="related-loading"><div class="related-spinner"></div><span>Getiriliyor...</span></div>';

  /* İzlenen videonun başlığını bul (tüm kaynaklardan) */
  var currentTitle = '';
  (function(){
    var pl = getActivePlaylist();
    if(pl){ var f=pl.items.find(function(x){return x.id===vid;}); if(f) currentTitle=f.title||''; }
    if(!currentTitle){
      for(var pi=0;pi<playlists.length;pi++){
        var f2=playlists[pi].items.find(function(x){return x.id===vid;});
        if(f2){currentTitle=f2.title||'';break;}
      }
    }
    if(!currentTitle){ var oop=getOopItem(); if(oop&&oop.id===vid) currentTitle=oop.title||''; }
    if(!currentTitle){ var npEl=document.getElementById('npTitle'); if(npEl) currentTitle=npEl.textContent||''; }
  })();

  /* ════ KAT 1: Lokal playlist eşleştirme — 0 kota ════ */
  if(_tryLocalPlaylistMatch(vid, currentTitle)){
    return; /* Bulundu, bitti */
  }

  /* ════ ADIM 1: Video snippet — channelId için (1 kota) ════ */
  ytFetch('/youtube/v3/videos', {part:'snippet', id:vid})
    .then(function(r){ return r.json(); })
    .then(function(data){
      var item = data.items && data.items[0];
      if(!item || data.error) throw new Error('not_found');
      var channelId    = item.snippet.channelId;
      var channelTitle = item.snippet.channelTitle || '';

      /* ════ KAT 2: Kanal playlist taraması — 2 kota ════
         playlists.list(1) + playlistItems.list(1-2)
         Başarılı olursa KAT 3'e geçmez. */
      return _fetchByChannelPlaylists(vid, channelId, channelTitle, currentTitle)
        .catch(function(){
          /* KAT 2 başarısız → KAT 3: uploads playlist fallback */
          return _fetchByUploads(vid, channelId, channelTitle, currentTitle);
        });
    })
    .catch(function(){
      /* videos.list bile başarısız → oEmbed fallback */
      fetchRelatedByTitle(vid);
    });
}

/* ════ KAT 3: Uploads playlist — sayfa bazlı akıllı arama ════
 * Strateji:
 *  1) İlk 50'yi çek → izlenen video bu sayfada mı?
 *  2) Varsa: bu sayfa + bir sonraki sayfa = ~100 video, seri devamı kesin bu aralıkta
 *  3) Yoksa: her sayfayı tara (max 8 sayfa / 400 video), bulunca +1 sayfa ekle
 *  Kota: channels(1) + playlistItems(1-9) + videos/shorts(1-2) = max 12 kota
 */
function _fetchByUploads(vid, channelId, channelTitle, currentTitle){
  return ytFetch('/youtube/v3/channels', {part:'contentDetails', id:channelId})
    .then(function(r){ return r.json(); })
    .then(function(d){
      var ch = d.items && d.items[0];
      if(!ch || d.error) throw new Error('ch_not_found');
      var uploadsPl = ch.contentDetails.relatedPlaylists.uploads;
      _relatedUploadsPlId = uploadsPl; /* filtre araması için sakla */
      _relatedChannelId   = channelId;

      /* ── Sayfa tarama: izlenen videoyu bul ── */
      function fetchPage(pageToken, pageIndex){
        var params = {part:'snippet', playlistId:uploadsPl, maxResults:'50'};
        if(pageToken) params.pageToken = pageToken;
        return ytFetch('/youtube/v3/playlistItems', params).then(function(r){ return r.json(); })
          .then(function(d){
            var items = d.items || [];
            var nextToken = d.nextPageToken || null;
            var vidFound = items.some(function(it){
              return it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId === vid;
            });
            if(vidFound || pageIndex >= 7){ /* bulundu ya da max sayfa */
              return {items:items, nextToken:nextToken, found:vidFound, pageIndex:pageIndex};
            }
            /* Sonraki sayfaya geç */
            if(nextToken) return fetchPage(nextToken, pageIndex+1);
            return {items:items, nextToken:null, found:false, pageIndex:pageIndex};
          });
      }

      return fetchPage(null, 0).then(function(result){
        var pool = result.items;
        /* Bulunduysa ve sonraki sayfa varsa onu da ekle */
        if(result.found && result.nextToken){
          return ytFetch('/youtube/v3/playlistItems', {part:'snippet', playlistId:uploadsPl, maxResults:'50', pageToken:result.nextToken})
            .then(function(r){ return r.json(); })
            .then(function(d2){ return pool.concat(d2.items||[]); })
            .catch(function(){ return pool; });
        }
        return pool;
      });
    })
    .then(function(allItems){
      var currentIndex = -1;
      var rawCandidates = allItems.map(function(it, idx){
        if(!it.snippet||!it.snippet.resourceId||!it.snippet.resourceId.videoId) return null;
        var sn = it.snippet;
        var vidId = sn.resourceId.videoId;
        if(vidId === vid){ currentIndex = idx; return null; }
        var thumb = sn.thumbnails && (sn.thumbnails.medium||sn.thumbnails.default)
          ? (sn.thumbnails.medium||sn.thumbnails.default).url : '';
        return {id:vidId, title:sn.title||vidId, channel:channelTitle, thumb:thumb, playlistIndex:idx};
      }).filter(Boolean);

      if(!rawCandidates.length) throw new Error('empty');

      /* Shorts filtresi — sadece ilk 50 aday için (kota tasarrufu) */
      var checkCandidates = rawCandidates.slice(0, 50);
      var skipShorts = rawCandidates.slice(50); /* geri kalanı filtre etme */
      var checkIds = checkCandidates.map(function(c){ return c.id; });

      var shortsPromise = checkIds.length > 0
        ? ytFetch('/youtube/v3/videos', {part:'contentDetails', id:checkIds.join(','), maxResults:'50'})
            .then(function(r){ return r.json(); })
            .then(function(data){
              var shortIds = {};
              (data.items||[]).forEach(function(it){
                if(parseDuration(it.contentDetails&&it.contentDetails.duration||'PT0S') < 62)
                  shortIds[it.id] = true;
              });
              return shortIds;
            }).catch(function(){ return {}; })
        : Promise.resolve({});

      return shortsPromise.then(function(shortIds){
        var filtered = checkCandidates.filter(function(c){ return !shortIds[c.id]; })
                       .concat(skipShorts);
        _relatedCache[vid] = {
          items: filtered.slice(0,20),
          allItems: filtered,
          channelTitle: channelTitle,
          currentTitle: currentTitle,
          currentIndex: currentIndex >= 0 ? currentIndex : undefined,
          source: 'uploads'
        };
        if(_relatedTabActive) renderRelatedVideos(_relatedCacheShuffled(vid), channelTitle);
      });
    })
    .catch(function(){
      fetchRelatedByTitle(vid);
    });
}

function fetchRelatedByTitle(vid){
  /*
   * Fallback yöntemi — ana yöntem başarısız olursa çalışır.
   * oEmbed ile kanal adını al (0 kota), sonra sadece videos API ile
   * playlist üzerinden değil direkt video ID listesi üzerinden çalış.
   * search.list KULLANILMIYOR — kota tasarrufu korunuyor.
   */
  fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+vid+'&format=json')
    .then(function(r){return r.json();})
    .then(function(d){
      var author=d.author_name||'';
      var channelUrl=d.author_url||'';
      /* channelId'yi URL'den parse et (/channel/UC...) */
      var chMatch=channelUrl.match(/\/channel\/(UC[\w-]+)/);
      if(!chMatch) throw new Error('no_channel_id');
      var channelId=chMatch[1];
      /* Kanalın uploads playlist'ini al */
      return ytFetch('/youtube/v3/channels', {part:'contentDetails', id:channelId})
        .then(function(r){return r.json();})
        .then(function(d2){
          var ch=d2.items&&d2.items[0];
          if(!ch) throw new Error('no_ch');
          var uploadsPl=ch.contentDetails.relatedPlaylists.uploads;
          return ytFetch('/youtube/v3/playlistItems', {part:'snippet', playlistId:uploadsPl, maxResults:'50'})
            .then(function(r){return r.json();})
            .then(function(d3){return {d3:d3, author:author};});
        });
    })
    .then(function(obj){
      var author=obj.author;
      var candidates=(obj.d3.items||[])
        .filter(function(it){
          return it.snippet&&it.snippet.resourceId&&
                 it.snippet.resourceId.videoId&&
                 it.snippet.resourceId.videoId!==currentVideoId;
        })
        .map(function(it){
          var sn=it.snippet;
          var vidId=sn.resourceId.videoId;
          var thumb=sn.thumbnails&&(sn.thumbnails.medium||sn.thumbnails.default)
            ?(sn.thumbnails.medium||sn.thumbnails.default).url:'';
          return {id:vidId, title:sn.title||vidId, channel:author, thumb:thumb};
        });
      if(!candidates.length) throw new Error('empty');
      var ids=candidates.map(function(c){return c.id;});
      return ytFetch('/youtube/v3/videos', {part:'contentDetails', id:ids.slice(0,50).join(','), maxResults:'50'})
        .then(function(r){return r.json();})
        .then(function(data){
          var shortIds={};
          (data.items||[]).forEach(function(it){
            if(parseDuration(it.contentDetails&&it.contentDetails.duration||'PT0S')<62)
              shortIds[it.id]=true;
          });
          var filtered=candidates.filter(function(c){return !shortIds[c.id];});
          return {items:shuffleArray(filtered).slice(0,20), allItems:filtered, channelTitle:author};
        });
    })
    .then(function(result){
      _relatedCache[currentVideoId]={items:result.items, allItems:result.allItems, channelTitle:result.channelTitle, currentTitle:(function(){var pl=getActivePlaylist();if(pl){var f=pl.items.find(function(x){return x.id===currentVideoId;});if(f)return f.title||'';}var oop=getOopItem();if(oop&&oop.id===currentVideoId)return oop.title||'';return document.getElementById('npTitle')?document.getElementById('npTitle').textContent||'':'';}())};
      if(_relatedTabActive) renderRelatedVideos(_relatedCacheShuffled(currentVideoId), result.channelTitle);
    })
    .catch(function(){
      if(_relatedTabActive) document.getElementById('relatedList').innerHTML='<div class="related-empty">Videolar yüklenemedi.<br>API kotası dolmuş olabilir.</div>';
    });
}

/* ══════════ İLGİLİ VİDEO FİLTRE ══════════
 * Sözdizimi:
 *   kelime1 kelime2      → her kelime ayrı ayrı başlıkta geçmeli (AND)
 *   "tam ifade"          → tırnak içindeki string birebir geçmeli (exact phrase)
 *   kelime "tam ifade"   → karma: hem kelime hem exact phrase şartı
 */

var _relatedChannelId   = '';
var _relatedUploadsPlId = '';

function _showFilterRow(show){
  var row = document.getElementById('relatedFilterRow');
  if(row) row.style.display = show ? 'flex' : 'none';
}

function _clearFilterInput(){
  var inp = document.getElementById('relatedFilterInput');
  if(inp) inp.value = '';
  var info = document.getElementById('relatedFilterInfo');
  if(info) info.textContent = '';
}

/*
 * Query parser — query string'ini token listesine çevirir.
 * Her token: { type: 'word'|'phrase', value: string }
 * "word"  → başlıkta .indexOf(value) >= 0
 * "phrase"→ başlıkta birebir .indexOf(value) >= 0 (büyük/küçük harf yok sayılır)
 */
function _parseFilterQuery(raw){
  var tokens = [];
  var s = raw.trim();
  var i = 0;
  while(i < s.length){
    /* Boşluk atla */
    if(s[i] === ' '){ i++; continue; }
    /* Tırnak başladı → exact phrase */
    if(s[i] === '"'){
      var end = s.indexOf('"', i+1);
      if(end < 0) end = s.length; /* kapanmamış tırnak — sonuna kadar al */
      var phrase = s.slice(i+1, end).trim().toLowerCase();
      if(phrase) tokens.push({ type:'phrase', value:phrase });
      i = end + 1;
    } else {
      /* Normal kelime */
      var sp = s.indexOf(' ', i);
      var word = (sp < 0 ? s.slice(i) : s.slice(i, sp)).toLowerCase();
      if(word) tokens.push({ type:'word', value:word });
      i = sp < 0 ? s.length : sp + 1;
    }
  }
  return tokens;
}

/* Token listesiyle bir başlığı test et */
function _matchesTokens(title, tokens){
  var t = title.toLowerCase();
  return tokens.every(function(tok){
    return t.indexOf(tok.value) >= 0; /* hem word hem phrase için indexOf yeterli */
  });
}

/* oninput handler — her tuşta cache üzerinde çalışır, API yok */
function applyRelatedFilter(){
  var inp   = document.getElementById('relatedFilterInput');
  var query = inp ? inp.value : '';
  var info  = document.getElementById('relatedFilterInfo');

  var c = _relatedCache[currentVideoId];
  if(!c){ if(info) info.textContent = ''; return; }
  var pool = c.allItems && c.allItems.length ? c.allItems : c.items;

  /* Kutu boş → filtresiz liste */
  if(!query.trim()){
    if(info) info.textContent = pool.length + ' video';
    _renderRelatedRaw(_relatedCacheShuffled(currentVideoId), c.channelTitle);
    return;
  }

  var tokens = _parseFilterQuery(query);
  if(!tokens.length){
    if(info) info.textContent = pool.length + ' video';
    _renderRelatedRaw(_relatedCacheShuffled(currentVideoId), c.channelTitle);
    return;
  }

  /* Filtrele */
  var filtered = pool.filter(function(it){
    return _matchesTokens(it.title || '', tokens);
  });

  /* Info etiketi */
  var phraseCount = tokens.filter(function(t){ return t.type==='phrase'; }).length;
  var infoStr = filtered.length + ' eşleşme / ' + pool.length + ' video';
  if(phraseCount > 0) infoStr += ' · ' + phraseCount + ' tam ifade aktif';
  if(info) info.textContent = infoStr;

  if(!filtered.length){
    document.getElementById('relatedList').innerHTML =
      '<div class="related-empty">Eşleşme yok.<br>' +
      '<span style="font-size:10px;color:var(--blue);cursor:pointer;text-decoration:underline" ' +
      'onclick="fetchRelatedWithFilter()">⟳ Kanalın tüm videolarında ara</span></div>';
    return;
  }

  /* Sayısal yakınlık ile sırala */
  var curNum = _extractLeadingNumber(c.currentTitle || '');
  var scored = filtered.map(function(it){
    var s = 0;
    if(curNum !== null){
      var n = _extractLeadingNumber(it.title);
      if(n !== null){
        var d = n - curNum;
        if(d === 1)       s = 20;
        else if(d === 2)  s = 10;
        else if(d === -1) s = 4;
        else if(Math.abs(d) <= 5) s = 2;
      }
    }
    return { item: it, score: s };
  });
  scored.sort(function(a, b){ return b.score - a.score; });
  _renderRelatedRaw(scored.map(function(x){ return x.item; }).slice(0, 20), c.channelTitle);
}

/* ⟳ Butonu: kanalın TÜM upload sayfalarını tara — bulana kadar devam et
 * Her 5 sayfada bir ara sonuç göster + "Devam Et" seçeneği sun.
 * uploads plId yoksa önce fetchRelatedVideos çalıştır, o biter bitmez tekrar çağır. */
var _filterScanAbort = false; /* abort flag */

function fetchRelatedWithFilter(){
  if(!currentVideoId){ showToast('❌ Önce video oynat.'); return; }

  /* uploads plId yoksa önce kanalı tanı */
  if(!_relatedUploadsPlId){
    var info = document.getElementById('relatedFilterInfo');
    if(info) info.textContent = '⏳ Kanal bilgisi alınıyor...';
    showToast('⏳ Kanal bilgisi alınıyor, lütfen bekle...');
    fetchRelatedVideos(true);
    /* fetchRelatedVideos bittikten sonra _relatedUploadsPlId set edilir,
       kullanıcı tekrar ⟳'e basarsa bu kez direkt tarar */
    return;
  }

  var inp = document.getElementById('relatedFilterInput');
  var query = inp ? inp.value : '';
  var tokens = _parseFilterQuery(query);
  if(!tokens.length){ showToast('❌ Filtre kutusuna bir şey yaz.'); return; }

  var info = document.getElementById('relatedFilterInfo');
  var list = document.getElementById('relatedList');
  var btn  = document.getElementById('relatedFetchFilterBtn');

  _filterScanAbort = false;
  var plId      = _relatedUploadsPlId;
  var found     = [];
  var pageCount = 0;
  var BATCH     = 5;   /* her 5 sayfada bir ara sonuç göster */

  /* Phrase tokenlarını görünür etikete çevir */
  var queryLabel = tokens.map(function(t){
    return t.type === 'phrase' ? '"' + t.value + '"' : t.value;
  }).join(' + ');

  if(btn){ btn.disabled = true; btn.textContent = '⏹'; btn.title = 'Taramayı durdur'; btn.onclick = function(){ _filterScanAbort = true; }; }

  function updateInfo(extra){
    if(info) info.textContent = pageCount + '. sayfa — ' + found.length + ' eşleşme' + (extra ? ' · ' + extra : '');
  }

  function showInterim(nextToken, isDone){
    /* Ara sonuç kutusu: bulunanları göster + daha fazla ara butonu */
    var curTitle = (document.getElementById('npTitle')||{}).textContent || '';
    var curNum = _extractLeadingNumber(curTitle);
    var scored = found.map(function(it){
      var s = _titleSimilarity(curTitle, it.title);
      if(curNum !== null){
        var n = _extractLeadingNumber(it.title);
        if(n !== null){
          var d = n - curNum;
          if(d === 1) s += 20; else if(d === 2) s += 10; else if(d === -1) s += 4;
        }
      }
      return { item: it, score: s };
    });
    scored.sort(function(a,b){ return b.score - a.score; });
    var sorted = scored.map(function(x){ return x.item; });

    /* Cache güncelle */
    var c = _relatedCache[currentVideoId];
    if(c){
      var existIds = {};
      sorted.forEach(function(x){ existIds[x.id] = true; });
      c.allItems = sorted.concat(c.allItems.filter(function(x){ return !existIds[x.id]; }));
    }

    if(isDone || _filterScanAbort){
      /* Tarama bitti veya iptal — kalıcı render */
      if(btn){
        btn.disabled = false; btn.textContent = '⟳'; btn.title = 'Kanalda ara (API)';
        btn.onclick = function(){ fetchRelatedWithFilter(); };
      }
      var statusMsg = _filterScanAbort
        ? '⏹ Durduruldu — ' + found.length + ' eşleşme (' + pageCount + ' sayfa)'
        : (found.length ? found.length + ' eşleşme (' + pageCount + ' sayfa tarandı)' : pageCount + ' sayfa tarandı, eşleşme yok');
      if(info) info.textContent = statusMsg;

      if(!sorted.length){
        list.innerHTML = '<div class="related-empty">Hiç eşleşme bulunamadı.<br>'
          + '<span style="font-size:10px;color:var(--muted)">('+ pageCount +' sayfa / '+(pageCount*50)+' video tarandı)</span></div>';
        return;
      }
      renderRelatedVideos(sorted.slice(0,20), c ? c.channelTitle : '');
      return;
    }

    /* Henüz bitmedi — ara sonuç + "Devam Et" butonu */
    if(info) info.textContent = found.length + ' eşleşme / ' + pageCount + '. sayfaya kadar · taranıyor...';

    /* Listeyi render et + altta "Devam Et" butonu ekle */
    renderRelatedVideos(sorted.slice(0,20), c ? c.channelTitle : '');
    var cont = document.createElement('div');
    cont.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
    cont.innerHTML =
      '<button style="flex:1;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.4);'
      +'border-radius:8px;color:var(--blue);cursor:pointer;font-size:11px;font-weight:700;padding:7px;font-family:Syne,sans-serif;" '
      +'id="filterContBtn">⟳ Devam Et ('+pageCount+'. sayfadan sonrasını tara)</button>'
      +'<button style="background:rgba(255,70,70,0.08);border:1px solid rgba(255,70,70,0.3);'
      +'border-radius:8px;color:var(--accent);cursor:pointer;font-size:11px;font-weight:700;padding:7px 10px;font-family:Syne,sans-serif;" '
      +'id="filterStopBtn">⏹</button>';
    list.appendChild(cont);
    document.getElementById('filterContBtn').addEventListener('click', function(){
      cont.remove();
      scanBatch(nextToken);
    });
    document.getElementById('filterStopBtn').addEventListener('click', function(){
      _filterScanAbort = true;
      cont.remove();
      showInterim(null, true);
    });
  }

  function scanBatch(startToken){
    if(_filterScanAbort){ showInterim(null, true); return; }

    var batchPage = 0;

    function doPage(pageToken){
      if(_filterScanAbort){ showInterim(null, true); return; }
      batchPage++;
      pageCount++;
      updateInfo();

      var params = {part:'snippet', playlistId:plId, maxResults:'50'};
      if(pageToken) params.pageToken = pageToken;
      ytFetch('/youtube/v3/playlistItems', params).then(function(r){ return r.json(); }).then(function(d){
        if(d.error) throw new Error(d.error.message);
        (d.items||[]).forEach(function(it){
          if(!it.snippet||!it.snippet.resourceId) return;
          var vidId = it.snippet.resourceId.videoId;
          if(vidId === currentVideoId) return;
          if(found.some(function(x){ return x.id === vidId; })) return; /* dedup */
          if(_matchesTokens(it.snippet.title || '', tokens)){
            var sn = it.snippet;
            var thumb = sn.thumbnails && (sn.thumbnails.medium||sn.thumbnails.default)
              ? (sn.thumbnails.medium||sn.thumbnails.default).url
              : 'https://i.ytimg.com/vi/'+vidId+'/mqdefault.jpg';
            found.push({id:vidId, title:sn.title||vidId, channel:sn.channelTitle||'', thumb:thumb});
          }
        });

        if(!d.nextPageToken){
          /* Kanal bitti — kesinlikle son */
          showInterim(null, true);
          return;
        }

        if(batchPage >= BATCH){
          /* Batch doldu — ara sonuç, kullanıcıya sor */
          showInterim(d.nextPageToken, false);
          return;
        }

        /* Devam et */
        doPage(d.nextPageToken);
      }).catch(function(err){
        if(btn){ btn.disabled=false; btn.textContent='⟳'; btn.onclick=function(){fetchRelatedWithFilter();}; }
        list.innerHTML = '<div class="related-empty">Arama başarısız.<br><span style="font-size:10px;color:var(--muted)">'
          + escapeHtml(err.message||'') + '</span></div>';
        if(info) info.textContent = 'Hata: ' + (err.message||'bilinmeyen');
      });
    }

    doPage(startToken);
  }

  /* Başlangıç */
  list.innerHTML = '<div class="related-loading"><div class="related-spinner"></div>'
    + '<span>Taranıyor: <em style="font-style:normal;color:var(--blue)">'
    + escapeHtml(queryLabel) + '</em></span></div>';
  if(info) info.textContent = 'Tarama başlatıldı...';
  scanBatch(null);
}

/* Ham render — prefill yapmaz, filtre tarafından da çağrılır */
function _renderRelatedRaw(items, channelTitle){
  var list = document.getElementById('relatedList');
  _showFilterRow(true);

  /* Başlık etiketi + kaynak */
  var lbl = document.getElementById('relatedRefreshLbl');
  if(lbl){
    var src = _relatedCache[currentVideoId] ? _relatedCache[currentVideoId].source : '';
    var srcTag = src === 'local'            ? ' <span style="font-size:9px;color:var(--green);font-weight:700">● LOKAL</span>'
               : src === 'channel_playlist' ? ' <span style="font-size:9px;color:var(--blue);font-weight:700">● SERİ</span>'
               : src === 'uploads'          ? ' <span style="font-size:9px;color:var(--muted);font-weight:700">● KANAL</span>'
               : '';
    lbl.innerHTML = (channelTitle ? '📺 ' + escapeHtml(channelTitle) : 'Kanal Videoları') + srcTag;
  }

  if(!items || !items.length){
    list.innerHTML = '<div class="related-empty">Bu kanaldan başka video bulunamadı.</div>';
    return;
  }

  list.innerHTML = '';
  items.forEach(function(item){
    var div = document.createElement('div'); div.className = 'rel-item';
    div.innerHTML =
      '<img class="rel-thumb" src="' + escapeHtml(item.thumb||'') + '" onerror="this.style.display=\'none\'" loading="lazy">' +
      '<div class="rel-info">' +
        '<div class="rel-title">' + escapeHtml(item.title||'') + '</div>' +
        '<div class="rel-meta">' + escapeHtml(item.channel||'') + '</div>' +
      '</div>' +
      '<button class="rel-add-btn" title="Playlist\'e ekle">+ Ekle</button>';

    /* closure fix: IIFE ile item'i bağla */
    (function(it){
      div.querySelector('.rel-thumb').addEventListener('click', function(){ loadVideoInPlayer(it.id); switchToRelatedTab(); });
      div.querySelector('.rel-info').addEventListener('click',  function(){ loadVideoInPlayer(it.id); switchToRelatedTab(); });
      div.querySelector('.rel-add-btn').addEventListener('click', function(e){
        e.stopPropagation();
        var pl = getActivePlaylist();
        if(!pl){ showToast('❌ Aktif playlist yok.'); return; }
        if(pl.items.some(function(x){ return x.id === it.id; })){ showToast('⚠️ Zaten listede.'); return; }
        pl.items.push({id:it.id, title:it.title, watched:false, categoryId:null});
        renderPlaylist(); saveAll();
        showToast('✅ Eklendi: ' + (it.title||'').slice(0,40));
      });
    })(item);

    list.appendChild(div);
  });
}

function renderRelatedVideos(items, channelTitle){
  _renderRelatedRaw(items, channelTitle);
}

/* ══════════ RELATED YOUTUBE SEARCH (Manuel / KAT 4) ══════════
 * Sadece kullanıcı butona basınca tetiklenir.
 * search.list = 100 kota/istek — zorunlu kalmadan kullanılmaz.
 */
var _relatedSearchOpen = false;
var _relatedSearchDailyCount = 0; /* Günlük arama sayacı (localStorage, 10:00'da sıfırlanır) */
var DAILY_SEARCH_LIMIT = 5; /* Günde en fazla 5 manuel arama (= 500 kota) */
var _kotaResetTimer = null;

/* ── Kota sıfırlama anahtarı: tarih + 10:00 sonrası mı? ── */
function _kotaDateKey(){
  var now = new Date();
  /* Saat 10:00'dan önce ise bir önceki gün sayılır */
  if(now.getHours() < 10){
    var prev = new Date(now); prev.setDate(prev.getDate()-1);
    return prev.toDateString() + '_post10';
  }
  return now.toDateString() + '_post10';
}

function _loadSearchCount(){
  try{
    var d = JSON.parse(localStorage.getItem('ytSearchCount')||'{}');
    var key = _kotaDateKey();
    if(d.key !== key){ d = {key:key, count:0}; localStorage.setItem('ytSearchCount', JSON.stringify(d)); }
    _relatedSearchDailyCount = d.count || 0;
  }catch(e){ _relatedSearchDailyCount = 0; }
}
function _saveSearchCount(){
  try{
    localStorage.setItem('ytSearchCount', JSON.stringify({key:_kotaDateKey(), count:_relatedSearchDailyCount}));
  }catch(e){}
}

/* Saat 10:00'da tam sıfırlama — her gün otomatik */
function _scheduleKotaReset(){
  if(_kotaResetTimer) clearTimeout(_kotaResetTimer);
  var now = new Date();
  var next = new Date(now);
  next.setHours(10,0,0,0);
  if(now >= next) next.setDate(next.getDate()+1); /* Bugün 10:00 geçtiyse yarın */
  var ms = next - now;
  _kotaResetTimer = setTimeout(function(){
    _relatedSearchDailyCount = 0;
    _saveSearchCount();
    _updateKotaBar();
    showToast('✅ API kotası sıfırlandı (10:00)');
    _scheduleKotaReset(); /* Bir sonraki güne planla */
  }, ms);
}

/* ── Kota bar güncelle + günlük limit kontrolü ── */
function _updateKotaBar(){
  var bar   = document.getElementById('relatedKotaBar');
  var txt   = document.getElementById('relatedKotaText');
  var fill  = document.getElementById('relatedKotaFill');
  var reset = document.getElementById('relatedKotaReset');
  var goBtn = document.getElementById('relatedSearchGoBtn');
  var inp   = document.getElementById('relatedSearchInput');
  if(!bar) return;

  var used = _relatedSearchDailyCount;
  var limitReached = used >= DAILY_SEARCH_LIMIT;
  var pct = Math.min(100, (used / DAILY_SEARCH_LIMIT) * 100);
  var color = limitReached ? 'var(--accent)' : (used >= DAILY_SEARCH_LIMIT-1 ? 'var(--gold)' : 'var(--green)');

  if(txt)  txt.innerHTML  = '<span style="color:'+color+';font-weight:700">'+used+'</span> / '+DAILY_SEARCH_LIMIT+' arama kullanıldı (her biri 100 kota)';
  if(fill){ fill.style.width = pct+'%'; fill.style.background = color; }

  /* Bir sonraki sıfırlanmaya kalan süre */
  if(reset){
    var now = new Date();
    var next = new Date(now); next.setHours(10,0,0,0);
    if(now >= next) next.setDate(next.getDate()+1);
    var diffMs = next - now;
    var hh = Math.floor(diffMs/3600000);
    var mm = Math.floor((diffMs%3600000)/60000);
    reset.textContent = limitReached ? ('🔒 '+hh+'s '+mm+'dk sonra yenilenir') : (hh+'s '+mm+'dk sonra sıfırlanır');
  }

  bar.style.display = 'block';

  /* Günlük hak bittiyse arama kutusunu kilitle */
  if(goBtn) goBtn.disabled = limitReached;
  if(inp){
    inp.disabled = limitReached;
    inp.placeholder = limitReached ? "Günlük hak bitti, 10:00'da yenilenir" : 'Arama terimi...';
  }
}

/* İlgili videolar paneli açıldığında search alanını göster */
function showRelatedSearchArea(){
  var area = document.getElementById('relatedSearchArea');
  if(area) area.style.display = 'block';
  _clearFilterInput();
  _loadSearchCount();
  _updateKotaBar();
}
function hideRelatedSearchArea(){
  var area = document.getElementById('relatedSearchArea');
  if(area) area.style.display = 'none';
}

function toggleRelatedSearch(){
  _relatedSearchOpen = !_relatedSearchOpen;
  var box = document.getElementById('relatedSearchBox');
  var btn = document.getElementById('relatedSearchToggleBtn');
  if(_relatedSearchOpen){
    box.style.display = 'block';
    _updateKotaBar();
    btn.innerHTML = '✕ Aramayı Kapat';
    btn.style.background = 'rgba(255,70,70,0.08)';
    btn.style.borderColor = 'rgba(255,70,70,0.35)';
    btn.style.color = 'var(--accent)';
    /* Mevcut video başlığını öneri olarak doldur */
    var inp = document.getElementById('relatedSearchInput');
    if(inp && !inp.value && currentVideoId){
      var pl = getActivePlaylist();
      var sug = '';
      if(pl){ var f=pl.items.find(function(x){return x.id===currentVideoId;}); if(f) sug=f.title||''; }
      if(!sug){ var np=document.getElementById('npTitle'); if(np) sug=np.textContent||''; }
      /* Bölüm numarasını temizle — daha genel arama için */
      sug = sug.replace(/\s*[-|]\s*\d+\s*\.\s*(bölüm|bolum|ders|part|ep\.?)\b.*$/i,'').trim();
      inp.value = sug;
    }
    setTimeout(function(){ var i=document.getElementById('relatedSearchInput'); if(i) i.focus(); }, 50);
  } else {
    box.style.display = 'none';
    btn.innerHTML = '🔍 YouTube\'da Manuel Ara <span style="font-size:9px;opacity:0.7">(100 kota • günde '+DAILY_SEARCH_LIMIT+' hak)</span>';
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

function _updateSearchKota(){ _updateKotaBar(); } /* eski çağrılar için uyumluluk */

function doRelatedSearch(){
  _loadSearchCount();
  _updateKotaBar();
  if(_relatedSearchDailyCount >= DAILY_SEARCH_LIMIT){
    showToast('⛔ Günlük YouTube arama hakkın bitti ('+DAILY_SEARCH_LIMIT+'/'+DAILY_SEARCH_LIMIT+'). Saat 10:00\'da yenilenecek.');
    return;
  }

  var inp = document.getElementById('relatedSearchInput');
  var query = (inp ? inp.value : '').trim();
  if(!query){ showToast('❌ Arama terimi girin.'); return; }

  var btn = document.getElementById('relatedSearchGoBtn');
  if(btn){ btn.disabled = true; btn.textContent = '⏳'; }

  var list = document.getElementById('relatedList');
  list.innerHTML = '<div class="related-loading"><div class="related-spinner"></div><span>YouTube\'da aranıyor...</span></div>';

  ytFetch('/youtube/v3/search', {part:'snippet', q:query, type:'video', maxResults:'20'})
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data.error) throw new Error(data.error.message || 'API hatası');

      _relatedSearchDailyCount++;
      _saveSearchCount();
      _updateKotaBar();

      var items = (data.items||[]).map(function(it){
        var sn = it.snippet;
        var vidId = it.id && it.id.videoId ? it.id.videoId : '';
        if(!vidId) return null;
        var thumb = sn.thumbnails && (sn.thumbnails.medium||sn.thumbnails.default)
          ? (sn.thumbnails.medium||sn.thumbnails.default).url : '';
        return {id:vidId, title:sn.title||vidId, channel:sn.channelTitle||'', thumb:thumb};
      }).filter(Boolean);

      if(!items.length){
        list.innerHTML = '<div class="related-empty">Sonuç bulunamadı.</div>';
        return;
      }

      /* Başlık etiketini güncelle */
      var lbl = document.getElementById('relatedRefreshLbl');
      if(lbl) lbl.innerHTML = '🔍 Arama: <em style="font-style:normal;color:var(--blue)">' + escapeHtml(query.slice(0,30)) + '</em>';

      /* Normal renderRelatedVideos ile göster */
      list.innerHTML = '';
      items.forEach(function(item){
        var div = document.createElement('div'); div.className = 'rel-item';
        div.innerHTML =
          '<img class="rel-thumb" src="' + escapeHtml(item.thumb) + '" onerror="this.style.display=\'none\'" loading="lazy">' +
          '<div class="rel-info">' +
            '<div class="rel-title">' + escapeHtml(item.title) + '</div>' +
            '<div class="rel-meta">' + escapeHtml(item.channel) + '</div>' +
          '</div>' +
          '<button class="rel-add-btn" title="Playlist\'e ekle">+ Ekle</button>';

        var playFn = function(){
          loadVideoInPlayer(item.id);
          switchToRelatedTab();
        };
        div.querySelector('.rel-thumb').addEventListener('click', playFn);
        div.querySelector('.rel-info').addEventListener('click', playFn);
        div.querySelector('.rel-add-btn').addEventListener('click', function(e){
          e.stopPropagation();
          var pl = getActivePlaylist();
          if(!pl){ showToast('❌ Aktif playlist yok.'); return; }
          if(pl.items.some(function(x){ return x.id === item.id; })){ showToast('⚠️ Bu video zaten listede.'); return; }
          pl.items.push({id:item.id, title:item.title, watched:false, categoryId:null});
          renderPlaylist(); saveAll();
          showToast('✅ Eklendi: ' + item.title.slice(0,40));
        });
        list.appendChild(div);
      });
    })
    .catch(function(err){
      list.innerHTML = '<div class="related-empty">Arama başarısız.<br><span style="font-size:10px;color:var(--muted)">'
        + escapeHtml(err.message||'Bilinmeyen hata') + '</span></div>';
    })
    .finally(function(){
      if(btn){ btn.textContent = 'Ara'; btn.disabled = (_relatedSearchDailyCount >= DAILY_SEARCH_LIMIT); }
    });
}

/* ══ URL KOPYALA ══ */
function copyCurrentVideoUrl(){
  if(!currentVideoId){ showToast('❌ Oynatılan video yok.'); return; }
  var url = 'https://www.youtube.com/watch?v=' + currentVideoId;
  var btn = document.getElementById('npCopyUrlBtn');
  navigator.clipboard.writeText(url).then(function(){
    showToast('🔗 URL kopyalandı!');
    if(btn){ btn.textContent='✓ Kopyalandı'; btn.classList.add('copied'); }
    setTimeout(function(){ if(btn){ btn.textContent='🔗 URL'; btn.classList.remove('copied'); } }, 2000);
  }).catch(function(){
    /* Clipboard API çalışmazsa fallback */
    var ta = document.createElement('textarea');
    ta.value = url; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); showToast('🔗 URL kopyalandı!');
      if(btn){ btn.textContent='✓ Kopyalandı'; btn.classList.add('copied'); }
      setTimeout(function(){ if(btn){ btn.textContent='🔗 URL'; btn.classList.remove('copied'); } }, 2000);
    }catch(e){ showToast('❌ Kopyalanamadı: '+url); }
    document.body.removeChild(ta);
  });
}


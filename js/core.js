/* ══════════ SHARED UTILITIES ══════════ */
function showToast(msg){
  var t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border2);color:var(--text);font-size:12px;font-weight:600;padding:9px 18px;border-radius:20px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);pointer-events:none;font-family:Syne,sans-serif;opacity:0;transition:opacity 0.2s;white-space:nowrap;';
  t.textContent=msg;document.body.appendChild(t);
  requestAnimationFrame(function(){t.style.opacity='1';});
  setTimeout(function(){t.style.opacity='0';setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300);},2200);
}

/* ══════════ PALETTE ══════════ */
var PALETTE=['#e84545','#ff7043','#f5c842','#2ecc71','#3b82f6','#9b59b6','#1abc9c','#e91e63','#00bcd4','#8bc34a','#ff5722','#607d8b','#ff9800','#795548','#f06292','#4fc3f7','#aed581','#ce93d8'];

/* ══════════ STATE ══════════ */
var playlists=[];
var activePlaylistId=null;
var currentVideoId=null;
var currentInPlaylist=false;
var currentPlaylistId=null;
var oopItems={};
var currentSpeed=1;
var theme='dark';
var isExpanded=false;
var searchQuery='';
var dragSrcIndex=null;var dragCatId=null;
var colorPickerCallback=null;
var vidCatTargetIndex=null;
var vidCatSelectedId=null;
var pollTimer=null;
var lastKnownState=-1;
var videoChangeLockTimer=null;
var expectedVideoId=null;
var swRunning=false,swStartTime=0,swAccum=0,swInterval=null,swLaps=[];
var lastLoadedClipUrl=null;
var LS_DATA='aha_v4_data';

/* ══════════ HELPERS ══════════ */
function uid(){return Math.random().toString(36).substr(2,9);}
function escapeHtml(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function pad(n){return n<10?'0'+n:''+n;}
function swFormat(ms){var t=Math.floor(ms/1000);return pad(Math.floor(t/3600))+':'+pad(Math.floor((t%3600)/60))+':'+pad(t%60);}
function fmtSec(s){return pad(Math.floor(s/60))+':'+pad(s%60);}

/* ══════════ STORAGE ══════════ */
function saveAll(){
  try{
    var swEl=swAccum+(swRunning?(Date.now()-swStartTime):0);
    localStorage.setItem(LS_DATA,JSON.stringify({playlists,activePlaylistId,currentVideoId,currentInPlaylist,currentPlaylistId,oopItems,currentSpeed,theme,autoPlayEnabled,sw:{accum:swEl,laps:swLaps}}));
  }catch(e){}
  // NOTE: we do NOT snapshot today here — only midnight reset permanently archives a day
}
function loadSaved(){
  try{
    var raw=localStorage.getItem(LS_DATA);
    // Try old key migration
    if(!raw) raw=localStorage.getItem('aha_v2_data');
    if(!raw){initDefault();return;}
    var d=JSON.parse(raw);
    playlists=d.playlists||[];
    activePlaylistId=d.activePlaylistId||null;
    currentVideoId=d.currentVideoId||null;
    currentInPlaylist=!!d.currentInPlaylist;
    currentPlaylistId=d.currentPlaylistId||null;
    oopItems=d.oopItems||{};
    currentSpeed=d.currentSpeed||1;
    theme=d.theme||'dark';
    autoPlayEnabled=!!d.autoPlayEnabled;
    if(d.sw){swAccum=d.sw.accum||0;swLaps=d.sw.laps||[];}
    playlists.forEach(function(pl){
      if(!pl.color)pl.color=null;
      if(!pl.categories)pl.categories=[];
      if(!pl.notes)pl.notes={};
      pl.items.forEach(function(it){if(!it.watched)it.watched=false;if(!it.attachments)it.attachments=[];});
      if(!pl.collapsedCats)pl.collapsedCats={};
      if(!pl.catOrder)pl.catOrder=pl.categories.map(function(c){return c.id;});
    });
  }catch(e){initDefault();return;}
  if(playlists.length===0)initDefault();
  applyTheme();
  if(autoPlayEnabled){_updateSettingsAutoplay();}
  renderTabs();
  renderPlaylist();
  renderLaps();
  updateSpeedUI();
  document.getElementById('swDisplay').textContent=swFormat(swAccum);
  if(swAccum>0)document.getElementById('swStatus').textContent='Kaydedilmiş süre';
  if(currentVideoId){
    var title='';
    if(currentInPlaylist){var pl=getActivePlaylist();if(pl){var f=pl.items.find(function(x){return x.id===currentVideoId;});if(f)title=f.title;}}
    else{var oop=getOopItem();if(oop&&oop.id===currentVideoId)title=oop.title;}
    showNowPlaying(title,!currentInPlaylist);
    buildIframe(currentVideoId,false);
    renderNotes();
  }
}
function initDefault(){playlists=[{id:uid(),name:'Varsayılan',items:[],color:null,categories:[],notes:{},collapsedCats:{},catOrder:[]}];activePlaylistId=playlists[0].id;oopItems={};}

/* ══════════ THEME ══════════ */
function toggleTheme(){theme=(theme==='dark')?'light':'dark';applyTheme();saveAll();}
function setTheme(t){theme=t;applyTheme();saveAll();_updateSettingsThemeBtns();}
function applyTheme(){
  document.documentElement.setAttribute('data-theme',theme);
  _updateSettingsThemeBtns();
}
function _updateSettingsThemeBtns(){
  var d=document.getElementById('themeDarkBtn');
  var l=document.getElementById('themeLightBtn');
  if(d)d.classList.toggle('active',theme==='dark');
  if(l)l.classList.toggle('active',theme==='light');
}

/* ══════════ CENTRAL PANEL MANAGER ══════════ */
/* Tüm paneller buraya kayıtlı — biri açılınca diğerleri kapanır */
var _panels = {
  settings: {
    open: function(){ document.getElementById('settingsOverlay').classList.add('open'); _updateSettingsThemeBtns(); _updateSettingsAutoplay(); _updateSettingsSpeedBtns(); _updateSettingsGoogleUI(); _updateSettingsAiKeyUI(); },
    close: function(){ document.getElementById('settingsOverlay').classList.remove('open'); }
  },
  calendar: {
    open: function(){
      document.getElementById('calPanelOverlay').classList.add('open');
      if(typeof switchCalTab==='function') switchCalTab(typeof calActiveTab!=='undefined'?calActiveTab:'stats');
    },
    close: function(){ document.getElementById('calPanelOverlay').classList.remove('open'); }
  },
  ai: {
    open: function(){
      var o=document.getElementById('aiPanelOverlay');
      if(o) o.classList.add('open');
      if(typeof _applyAiFullscreenPref==='function') _applyAiFullscreenPref();
      if(typeof renderAiBody==='function') renderAiBody();
    },
    close: function(){ var o=document.getElementById('aiPanelOverlay'); if(o) o.classList.remove('open'); }
  },
  notes: {
    open: function(){ var o=document.getElementById('notesFsOverlay'); if(o) o.classList.add('open'); if(typeof onOpenNotesPanel==='function') onOpenNotesPanel(); },
    close: function(){ var o=document.getElementById('notesFsOverlay'); if(o) o.classList.remove('open'); if(typeof onCloseNotesPanel==='function') onCloseNotesPanel(); }
  }
};
var _activePanel = null;

function _openPanel(name){
  if(_activePanel && _activePanel !== name){
    if(_panels[_activePanel]) _panels[_activePanel].close();
  }
  _activePanel = name;
  if(_panels[name]) _panels[name].open();
}
function _closePanel(name){
  if(_panels[name]) _panels[name].close();
  if(_activePanel === name) _activePanel = null;
}

/* ══════════ SETTINGS PANEL ══════════ */
function openSettingsPanel(){ _openPanel('settings'); }
function closeSettingsPanel(){ _closePanel('settings'); }
function _updateSettingsAutoplay(){
  var tog=document.getElementById('settingsAutoplayToggle');
  if(tog)tog.classList.toggle('on',autoPlayEnabled);
}
function toggleAutoPlayFromSettings(){
  autoPlayEnabled=!autoPlayEnabled;
  _updateSettingsAutoplay();
  saveAll();
}
function _updateSettingsSpeedBtns(){
  document.querySelectorAll('.settings-speed-btn').forEach(function(b){
    var v=parseFloat(b.textContent);
    b.classList.toggle('active',v===currentSpeed);
  });
}
function signInGoogleFromSettings(){
  if(!_ytTokenClient){showToast('❌ Google API yüklenemedi, sayfayı yenile.');return;}
  _ytTokenClient.requestAccessToken();
}
function signOutGoogleFromSettings(){
  if(_ytAccessToken)google.accounts.oauth2.revoke(_ytAccessToken,function(){});
  _ytAccessToken=null;
  updateGoogleAuthUI(false);
  _updateSettingsGoogleUI();
}
function _updateSettingsGoogleUI(){
  var loggedIn=!!_ytAccessToken;
  var signIn=document.getElementById('settingsSignInBtn');
  var signOut=document.getElementById('settingsSignOutBtn');
  var driveRow=document.getElementById('settingsDriveRow');
  var status=document.getElementById('settingsGoogleStatus');
  if(signIn)signIn.style.display=loggedIn?'none':'flex';
  if(signOut)signOut.style.display=loggedIn?'flex':'none';
  if(driveRow)driveRow.style.display=loggedIn?'flex':'none';
  if(status)status.textContent=loggedIn?'✅ Google hesabına bağlandı':'Giriş yapılmadı';
  // YouTube API key alanını doldur
  var ytKeyInp=document.getElementById('settingsYtApiKeyInput');
  var ytKeyStatus=document.getElementById('settingsYtApiKeyStatus');
  if(ytKeyInp){
    var saved=typeof getUserYtKey==='function'?getUserYtKey():'';
    ytKeyInp.value=saved?'●●●●●●●●●●●●●●●●':'';
    ytKeyInp.dataset.hasKey=saved?'1':'0';
    if(ytKeyStatus) ytKeyStatus.textContent=saved?'✅ Kendi key\'in aktif (proxy kullanılmıyor)':'Girilmedi — proxy key kullanılıyor';
    if(ytKeyStatus) ytKeyStatus.style.color=saved?'var(--green)':'var(--muted)';
  }
}
function saveUserYtKeyFromSettings(){
  var inp=document.getElementById('settingsYtApiKeyInput');
  if(!inp) return;
  var v=inp.value.trim();
  // Maskeli değer tekrar kaydedilmesin
  if(v==='' || v.replace(/●/g,'')===''){ showToast('❌ Önce alanı temizle, sonra yeni key gir.'); return; }
  if(typeof setUserYtKey==='function') setUserYtKey(v);
  showToast('✅ YouTube API key kaydedildi! Artık proxy yerine kendi key\'in kullanılacak.');
  _updateSettingsGoogleUI();
}
function clearUserYtKeyFromSettings(){
  if(!confirm('Kayıtlı YouTube API key\'i silinsin mi? Proxy key\'e geri dönülecek.')) return;
  if(typeof clearUserYtKey==='function') clearUserYtKey();
  showToast('🔑 YouTube API key silindi. Proxy key\'e geri dönüldü.');
  _updateSettingsGoogleUI();
}
function onSettingsYtKeyFocus(){
  var inp=document.getElementById('settingsYtApiKeyInput');
  if(inp && inp.dataset.hasKey==='1'){ inp.value=''; inp.dataset.hasKey='0'; }
}

/* ── AI (Gemini) API Key — Ayarlar panelinden yönetim, ai.js'deki getAiKey/setAiKey/clearAiKey'i kullanır ── */
function _updateSettingsAiKeyUI(){
  var inp=document.getElementById('settingsAiApiKeyInput');
  var status=document.getElementById('settingsAiApiKeyStatus');
  if(!inp) return;
  var saved=typeof getAiKey==='function'?getAiKey():'';
  inp.value=saved?'●●●●●●●●●●●●●●●●':'';
  inp.dataset.hasKey=saved?'1':'0';
  if(status) status.textContent=saved?'✅ AI anahtarı kayıtlı (AI sohbet ve flashcard aktif)':'Girilmedi — AI sohbet ve flashcard özellikleri kapalı';
  if(status) status.style.color=saved?'var(--green)':'var(--muted)';
}
function saveAiKeyFromSettings(){
  var inp=document.getElementById('settingsAiApiKeyInput');
  if(!inp) return;
  var v=inp.value.trim();
  if(v==='' || v.replace(/●/g,'')===''){ showToast('❌ Önce alanı temizle, sonra yeni key gir.'); return; }
  if(typeof setAiKey==='function') setAiKey(v);
  showToast('✅ AI API anahtarı kaydedildi!');
  _updateSettingsAiKeyUI();
  if(typeof renderAiBody==='function') renderAiBody();
}
function clearAiKeyFromSettings(){
  if(typeof getAiKey!=='function' || !getAiKey()){ showToast('ℹ️ Kayıtlı bir AI anahtarı yok.'); return; }
  if(!confirm('AI API anahtarından çıkış yapmak (silmek) istediğine emin misin?')) return;
  if(typeof clearAiKey==='function') clearAiKey();
  showToast('🚪 AI API anahtarından çıkış yapıldı.');
  _updateSettingsAiKeyUI();
  if(typeof renderAiBody==='function') renderAiBody();
}
function onSettingsAiKeyFocus(){
  var inp=document.getElementById('settingsAiApiKeyInput');
  if(inp && inp.dataset.hasKey==='1'){ inp.value=''; inp.dataset.hasKey='0'; }
}

/* ══════════ EXPAND ══════════ */
function toggleExpand(){
  isExpanded=!isExpanded;
  var layout=document.getElementById('mainLayout');
  var icon=document.getElementById('expandIcon');
  if(isExpanded){layout.classList.add('expanded');if(icon)icon.textContent='fullscreen_exit';}
  else{layout.classList.remove('expanded');if(icon)icon.textContent='fullscreen';}
}

/* ══════════ PLAYLIST MANAGEMENT ══════════ */
function getActivePlaylist(){return playlists.find(function(p){return p.id===activePlaylistId;})||null;}
function getOopItem(plId){var id=plId||activePlaylistId;return oopItems[id]||null;}
function setOopItem(item,plId){var id=plId||activePlaylistId;if(item===null)delete oopItems[id];else oopItems[id]=item;}

function openNewPlaylistModal(){document.getElementById('modalOverlay').classList.add('open');setTimeout(function(){document.getElementById('modalInput').focus();},80);}
function closeModal(){document.getElementById('modalOverlay').classList.remove('open');document.getElementById('modalInput').value='';}
function closeModalOnBg(e){if(e.target===document.getElementById('modalOverlay'))closeModal();}
function confirmNewPlaylist(){
  var name=document.getElementById('modalInput').value.trim();
  if(!name)name='Playlist '+(playlists.length+1);
  var pl={id:uid(),name:name,items:[],color:null,categories:[],notes:{},collapsedCats:{},catOrder:[]};
  playlists.push(pl);activePlaylistId=pl.id;
  if(calActiveTab==='manager'){mgrExpandedPl=pl.id;}
  closeModal();renderTabs();renderPlaylist();saveAll();
  if(calActiveTab==='manager')renderCalBody();
}
function switchPlaylist(id){
  activePlaylistId = id;
  searchQuery = '';
  document.getElementById('plSearch').value = '';
  _relatedTabActive = false;
  _relatedSearchOpen = false;
  /* Filtre ve cache sıfırla — eski video/playlist öneri göstermesin */
  _clearFilterInput();
  _relatedCache = {};
  _relatedChannelId = '';
  _relatedUploadsPlId = '';
  document.getElementById('plContent').style.display = '';
  document.getElementById('relatedPanel').style.display = 'none';
  hideRelatedSearchArea();
  renderTabs();
  renderPlaylist();
  renderNotes();
  saveAll();
}
function deletePlaylist(id,e){
  e.stopPropagation();
  if(playlists.length<=1)return;
  delete oopItems[id];
  if(currentPlaylistId===id){destroyPlayer();currentPlaylistId=null;}
  playlists=playlists.filter(function(p){return p.id!==id;});
  if(activePlaylistId===id)activePlaylistId=playlists[0].id;
  renderTabs();renderPlaylist();saveAll();
}

/* ══════════ SEARCH ══════════ */
function onSearchInput(){
  searchQuery=document.getElementById('plSearch').value.trim().toLowerCase();
  document.getElementById('plSearchClear').style.display=searchQuery?'block':'none';
  renderPlaylist();
}
function clearSearch(){searchQuery='';document.getElementById('plSearch').value='';document.getElementById('plSearchClear').style.display='none';renderPlaylist();}

/* ══════════ RENDER TABS ══════════ */
function renderTabs(){
  var row=document.getElementById('plTabsRow');
  row.innerHTML='';
  var visiblePls=playlists.filter(function(pl){return !pl.hidden;});
  // If all hidden (post-reset), show nothing except the + button
  visiblePls.forEach(function(pl){
    var watched=pl.items.filter(function(it){return it.watched;}).length;
    var tab=document.createElement('div');
    tab.className='pl-tab'+(pl.id===activePlaylistId&&!_relatedTabActive?' active':'');
    if(pl.color){tab.style.color=pl.color;if(pl.id===activePlaylistId&&!_relatedTabActive)tab.style.borderColor=pl.color;}
    var dot=pl.color?'<span class="pl-tab-color-dot" style="background:'+pl.color+'"></span>':'';
    tab.innerHTML=dot+'<span class="pl-tab-name" data-plid="'+pl.id+'">'+escapeHtml(pl.name)+'</span>'+(watched>0?'<span style="font-size:9px;opacity:0.7">'+watched+'✓</span>':'')+(visiblePls.length>1?'<button class="pl-tab-close" title="Sil">✕</button>':'')+'<button class="pl-tab-paint" title="Renk Seç">🎨</button>';
    tab.addEventListener('click',function(e){if(e.target.classList.contains('pl-tab-close')||e.target.classList.contains('pl-tab-paint')||e.target.classList.contains('pl-tab-name'))return;switchPlaylist(pl.id);});
    var nameSpan=tab.querySelector('.pl-tab-name');if(nameSpan){nameSpan.addEventListener('click',function(e){e.stopPropagation();switchPlaylist(pl.id);});nameSpan.addEventListener('dblclick',function(e){e.stopPropagation();startPlaylistRename(pl,nameSpan);});}
    var cb=tab.querySelector('.pl-tab-close');if(cb)cb.addEventListener('click',function(e){deletePlaylist(pl.id,e);});
    tab.querySelector('.pl-tab-paint').addEventListener('click',function(e){e.stopPropagation();openPlaylistColorPicker(e,pl.id);});
    row.appendChild(tab);
  });
  var add=document.createElement('button');add.className='pl-tab-add';add.title='Yeni Playlist';add.textContent='+';add.onclick=openNewPlaylistModal;row.appendChild(add);
  // Related tab aktif durumu
  var relBtn=document.getElementById('relatedTabBtn');
  if(relBtn)relBtn.classList.toggle('active',!!_relatedTabActive);
  setTimeout(function(){var a=row.querySelector('.pl-tab.active');if(a)a.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});},50);
}

/* ══════════ RENDER PLAYLIST ══════════ */
function renderPlaylist(){
  var el=document.getElementById('playlistEl');
  var pl=getActivePlaylist();
  // If all playlists are hidden (post-midnight reset), show clean slate
  var allHidden=playlists.length>0&&playlists.every(function(p){return p.hidden;});
  if(allHidden){
    document.getElementById('plCount').textContent='0';
    var progressWrap=document.getElementById('plProgressWrap');if(progressWrap)progressWrap.style.display='none';
    el.innerHTML='<div class="empty-playlist">🌅 Yeni gün!<br>Playlistler gizlendi.<br>Playlist Yöneticisi\'nden görünür yapabilir ya da geri yükleyebilirsin.</div>';
    return;
  }
  var items=pl?pl.items.filter(function(it){
    if(it.hidden)return false; // video gizli
    if(it.categoryId){var cat=(pl.categories||[]).find(function(c){return c.id===it.categoryId;});if(cat&&cat.hidden)return false;} // kategorisi gizli
    return true;
  }):[];
  var oopItem=getOopItem();
  var filtered=searchQuery?items.filter(function(it){return it.title.toLowerCase().indexOf(searchQuery)>=0||it.id.indexOf(searchQuery)>=0;}):items;
  var watched=items.filter(function(it){return it.watched;}).length;
  document.getElementById('plCount').textContent=filtered.length+(searchQuery?'/'+items.length:'');
  // Progress
  var progressWrap=document.getElementById('plProgressWrap');
  if(items.length>0){
    progressWrap.style.display='block';
    var pct=Math.round(watched/items.length*100);
    document.getElementById('plProgressText').textContent=watched+'/'+items.length+' izlendi';
    document.getElementById('plProgressFill').style.width=pct+'%';
    document.getElementById('plProgressPct').textContent=pct+'%';
  }else{progressWrap.style.display='none';}
  el.innerHTML='';
  if(filtered.length===0&&!oopItem){
    el.innerHTML='<div class="empty-playlist">'+(searchQuery?'Arama sonucu bulunamadı.':'Henüz video yok.<br>URL yapıştırarak ekleyebilirsin.')+'</div>';
    return;
  }
  var cats=(pl&&pl.categories)?pl.categories:[];
  if(!pl.collapsedCats)pl.collapsedCats={};
  if(!pl.catOrder)pl.catOrder=cats.map(function(c){return c.id;});
  // Sync catOrder with actual cats
  cats.forEach(function(c){if(pl.catOrder.indexOf(c.id)<0)pl.catOrder.push(c.id);});
  pl.catOrder=pl.catOrder.filter(function(id){return cats.some(function(c){return c.id===id;});});

  if(cats.length>0&&!searchQuery){
    var groups={},uncategorized=[];
    filtered.forEach(function(item){
      var realIdx=items.indexOf(item);
      if(item.categoryId){if(!groups[item.categoryId])groups[item.categoryId]=[];groups[item.categoryId].push({item:item,idx:realIdx});}
      else{uncategorized.push({item:item,idx:realIdx});}
    });

    // Render categories in catOrder
    pl.catOrder.forEach(function(catId){
      var cat=cats.find(function(c){return c.id===catId;});
      if(!cat)return;
      if(cat.hidden)return;
      var collapsed=!!pl.collapsedCats[cat.id];
      var groupEl=document.createElement('div');
      groupEl.className='pl-cat-group'+(collapsed?' collapsed':'');
      groupEl.dataset.catId=cat.id;

      // Header
      var h=document.createElement('div');
      h.className='pl-cat-header'+(collapsed?' collapsed':'');
      h.dataset.catId=cat.id;
      var cnt=(groups[cat.id]||[]).length;
      h.innerHTML='<span class="pl-cat-drag-handle" title="Kategoriyi Sürükle">⠿</span>'+(cat.color?'<span class="pl-cat-dot" style="background:'+cat.color+'"></span>':'')+escapeHtml(cat.name)+' <span style="color:var(--muted);font-size:9px;font-weight:400">'+cnt+'</span><span class="pl-cat-chevron">▾</span>';

      // Collapse toggle
      h.addEventListener('click',function(e){
        if(e.target.classList.contains('pl-cat-drag-handle'))return;
        pl.collapsedCats[cat.id]=!pl.collapsedCats[cat.id];
        saveAll();renderPlaylist();
      });

      // Category header drag (reorder categories)
      h.draggable=true;
      h.addEventListener('dragstart',function(e){
        e.stopPropagation();
        dragCatId=cat.id; dragSrcIndex=null;
        e.dataTransfer.effectAllowed='move';
        e.dataTransfer.setData('text/plain','cat:'+cat.id);
        setTimeout(function(){groupEl.style.opacity='0.4';},0);
      });
      h.addEventListener('dragend',function(){
        groupEl.style.opacity='';
        document.querySelectorAll('.pl-cat-header.drop-target-cat,.pl-cat-group.drag-over-cat').forEach(function(d){d.classList.remove('drop-target-cat','drag-over-cat');});
        dragCatId=null;
      });

      // Header as drop target (for both cat-reorder and video-to-cat)
      h.addEventListener('dragover',function(e){
        e.preventDefault();e.stopPropagation();
        document.querySelectorAll('.pl-cat-header.drop-target-cat').forEach(function(d){d.classList.remove('drop-target-cat');});
        document.querySelectorAll('.pl-cat-group.drag-over-cat').forEach(function(d){d.classList.remove('drag-over-cat');});
        h.classList.add('drop-target-cat');
      });
      h.addEventListener('dragleave',function(e){
        if(!h.contains(e.relatedTarget))h.classList.remove('drop-target-cat');
      });
      h.addEventListener('drop',function(e){
        e.preventDefault();e.stopPropagation();
        h.classList.remove('drop-target-cat');
        var pl2=getActivePlaylist();if(!pl2)return;
        if(dragCatId&&dragCatId!==cat.id){
          // Reorder categories
          var fi=pl2.catOrder.indexOf(dragCatId),ti=pl2.catOrder.indexOf(cat.id);
          if(fi>=0&&ti>=0){pl2.catOrder.splice(fi,1);pl2.catOrder.splice(ti,0,dragCatId);}
          dragCatId=null;saveAll();renderPlaylist();
        } else if(dragSrcIndex!==null){
          // Move video into this category
          pl2.items[dragSrcIndex].categoryId=cat.id;
          dragSrcIndex=null;saveAll();renderPlaylist();
        }
      });

      // Group body as drop target (empty space below items)
      groupEl.addEventListener('dragover',function(e){
        if(dragSrcIndex===null)return;
        e.preventDefault();
        // Don't stopPropagation — let item-level dragover also fire
        document.querySelectorAll('.pl-cat-group.drag-over-cat').forEach(function(d){d.classList.remove('drag-over-cat');});
        groupEl.classList.add('drag-over-cat');
      });
      groupEl.addEventListener('dragleave',function(e){
        if(!groupEl.contains(e.relatedTarget))groupEl.classList.remove('drag-over-cat');
      });
      groupEl.addEventListener('drop',function(e){
        // Only handle if not already handled by a child item's drop
        if(e.defaultPrevented)return;
        e.preventDefault();
        groupEl.classList.remove('drag-over-cat');
        if(dragSrcIndex===null)return;
        var pl2=getActivePlaylist();if(!pl2)return;
        pl2.items[dragSrcIndex].categoryId=cat.id;
        dragSrcIndex=null;saveAll();renderPlaylist();
      });

      groupEl.appendChild(h);
      if(groups[cat.id]){groups[cat.id].forEach(function(e2){groupEl.appendChild(buildPlItem(e2.item,e2.idx,cat));});}
      el.appendChild(groupEl);
    });

    // Uncategorized group
    if(uncategorized.length>0){
      var ucCollapsed=!!pl.collapsedCats['__uncategorized__'];
      var ugEl=document.createElement('div');ugEl.className='pl-cat-group'+(ucCollapsed?' collapsed':'');ugEl.dataset.catId='__uncategorized__';
      var uh=document.createElement('div');uh.className='pl-cat-header'+(ucCollapsed?' collapsed':'');
      uh.innerHTML='<span class="pl-cat-drag-handle" style="opacity:0;pointer-events:none">⠿</span><span class="pl-cat-dot" style="background:var(--muted)"></span>Kategorisiz <span style="color:var(--muted);font-size:9px;font-weight:400">'+uncategorized.length+'</span><span class="pl-cat-chevron">▾</span>';
      uh.addEventListener('click',function(){pl.collapsedCats['__uncategorized__']=!pl.collapsedCats['__uncategorized__'];saveAll();renderPlaylist();});
      uh.addEventListener('dragover',function(e){e.preventDefault();e.stopPropagation();if(dragSrcIndex!==null)uh.classList.add('drop-target-cat');});
      uh.addEventListener('dragleave',function(){uh.classList.remove('drop-target-cat');});
      uh.addEventListener('drop',function(e){
        e.preventDefault();e.stopPropagation();uh.classList.remove('drop-target-cat');
        if(dragSrcIndex===null)return;
        var pl2=getActivePlaylist();if(!pl2)return;
        pl2.items[dragSrcIndex].categoryId=null;
        dragSrcIndex=null;saveAll();renderPlaylist();
      });
      ugEl.appendChild(uh);
      uncategorized.forEach(function(e2){ugEl.appendChild(buildPlItem(e2.item,e2.idx,null));});
      el.appendChild(ugEl);
    }
  }else{
    filtered.forEach(function(item){var realIdx=items.indexOf(item);var cat=cats.find(function(c){return c.id===item.categoryId;})||null;el.appendChild(buildPlItem(item,realIdx,cat));});
  }
  if(oopItem&&!searchQuery){
    var isOopActive=(currentVideoId===oopItem.id&&!currentInPlaylist&&currentPlaylistId===activePlaylistId);
    var od=document.createElement('div');od.className='pl-item oop-item'+(isOopActive?' active':'');od.dataset.oopId=oopItem.id;
    od.innerHTML='<span class="pl-num">⊕</span><div class="pl-item-info"><div class="pl-item-title">'+escapeHtml(oopItem.title)+'</div><div class="oop-badge">PLAYLIST DIŞI VIDEO</div></div><div class="pl-item-actions"><button class="pl-action-btn add-oop" title="Playliste Ekle">+</button></div>';
    od.querySelector('.pl-action-btn.add-oop').addEventListener('click',function(e){e.stopPropagation();addOopToPlaylist();});
    od.addEventListener('click',function(){playOopVideo();});
    el.appendChild(od);
  }
}

function buildPlItem(item,i,cat){
  var isActive=(currentVideoId===item.id&&currentInPlaylist&&currentPlaylistId===activePlaylistId);
  var div=document.createElement('div');
  div.className='pl-item'+(isActive?' active':'')+(item.watched?' watched':'');
  div.draggable=true;div.dataset.idx=i;
  var catLabel='';
  if(cat&&cat.color)catLabel='<span class="pl-item-cat" style="background:'+cat.color+'22;color:'+cat.color+';border:1px solid '+cat.color+'44">'+escapeHtml(cat.name)+'</span>';
  var watchedCls=item.watched?' checked':'';
  var thumbUrl='https://i.ytimg.com/vi/'+item.id+'/mqdefault.jpg';
  div.innerHTML=
    '<span class="pl-drag-handle" title="Sürükle">⠿</span>'+
    '<div class="pl-watched-chk'+watchedCls+'" title="'+(item.watched?'İzlendi olarak işaretle':'İzlendi işaretle')+'">'+(item.watched?'✓':'')+'</div>'+
    '<div class="pl-thumb-wrap">'+
      '<img class="pl-thumb" src="'+thumbUrl+'" loading="lazy" alt="" onerror="this.style.display=\'none\'">'+
      (item.watched?'<div class="pl-thumb-watched-overlay"><span>✓</span></div>':'')+
      (isActive?'<div class="pl-thumb-playing-overlay"><span>▶</span></div>':'')+
    '</div>'+
    '<div class="pl-item-info">'+
      '<div class="pl-item-title">'+escapeHtml(item.title)+'</div>'+
      '<div class="pl-item-meta">'+catLabel+'<span class="pl-item-id">'+item.id+'</span></div>'+
      '<div class="pl-item-attachments" id="attachments-'+item.id+'"></div>'+
    '</div>'+
    '<div class="pl-item-actions">'+
      '<button class="pl-action-btn remove" title="Kaldır">✕</button>'+
    '</div>';
  // Watched checkbox
  div.querySelector('.pl-watched-chk').addEventListener('click',function(e){e.stopPropagation();toggleWatched(i);});

  // ── Drag start ──
  div.addEventListener('dragstart',function(e){
    dragSrcIndex=i;
    dragCatId=null;
    div.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain','vid:'+i);
  });
  div.addEventListener('dragend',function(){
    div.classList.remove('dragging');
    // dragSrcIndex is cleared in drop handler; clear here only if drop didn't fire (e.g. cancelled)
    dragSrcIndex=null;
    document.querySelectorAll('.pl-item.drag-over').forEach(function(d){d.classList.remove('drag-over');});
    document.querySelectorAll('.pl-cat-group.drag-over-cat').forEach(function(d){d.classList.remove('drag-over-cat');});
    document.querySelectorAll('.pl-cat-header.drop-target-cat').forEach(function(d){d.classList.remove('drop-target-cat');});
  });

  // ── Dragover on this item → show insert indicator ──
  div.addEventListener('dragover',function(e){
    if(dragSrcIndex===null||dragSrcIndex===i)return;
    e.preventDefault();
    e.stopPropagation(); // prevent group-body dragover from firing while over an item
    document.querySelectorAll('.pl-item.drag-over').forEach(function(d){d.classList.remove('drag-over');});
    document.querySelectorAll('.pl-cat-group.drag-over-cat').forEach(function(d){d.classList.remove('drag-over-cat');});
    div.classList.add('drag-over');
  });
  div.addEventListener('dragleave',function(e){
    if(!div.contains(e.relatedTarget))div.classList.remove('drag-over');
  });

  // ── Drop on this item → reorder AND adopt same category ──
  div.addEventListener('drop',function(e){
    e.preventDefault();
    e.stopPropagation(); // consumed here, don't bubble to group
    div.classList.remove('drag-over');
    document.querySelectorAll('.pl-cat-group.drag-over-cat').forEach(function(d){d.classList.remove('drag-over-cat');});
    var src=dragSrcIndex;
    dragSrcIndex=null;
    if(src===null||src===i)return;
    var pl2=getActivePlaylist();if(!pl2)return;
    // Adopt the target item's category (cross-category drag onto item)
    pl2.items[src].categoryId=pl2.items[i].categoryId||null;
    // Reorder: move src to just before i (adjusting for splice offset)
    var toIdx=i>src?i:i; // destination is always i in original coords before splice
    var moved=pl2.items.splice(src,1)[0];
    var adjusted=src<i?i-1:i; // after splice, target shifted left if src was before it
    pl2.items.splice(adjusted,0,moved);
    renderPlaylist();saveAll();
  });

  // Remove
  div.querySelector('.pl-action-btn.remove').addEventListener('click',function(e){e.stopPropagation();removeFromPlaylist(i);});
  // Play
  div.addEventListener('click',function(e){if(e.target.closest('.pl-item-actions')||e.target.classList.contains('pl-drag-handle')||e.target.classList.contains('pl-watched-chk'))return;playPlaylistVideo(i);});
  return div;
}

/* ══════════ RENAME ══════════ */
function startRename(i,div,item){
  var titleEl=div.querySelector('.pl-item-title');
  var orig=item.title;
  titleEl.outerHTML='<input class="pl-item-title-edit" type="text" value="'+escapeHtml(orig)+'">';
  var inp=div.querySelector('.pl-item-title-edit');
  inp.focus();inp.select();
  function done(){
    var v=inp.value.trim();
    if(v&&v!==orig){item.title=v;if(currentVideoId===item.id)document.getElementById('npTitle').textContent=v;saveAll();}
    renderPlaylist();
  }
  inp.addEventListener('keydown',function(e){if(e.key==='Enter')done();if(e.key==='Escape')renderPlaylist();e.stopPropagation();});
  inp.addEventListener('blur',done);
}

/* ══════════ WATCHED ══════════ */
function toggleWatched(i){
  var pl=getActivePlaylist();if(!pl)return;
  pl.items[i].watched=!pl.items[i].watched;
  renderPlaylist();renderTabs();saveAll();
}

/* ══════════ NOTES ══════════ */
function getCurrentTimeSec(){
  try{
    var f=document.getElementById('ytIframe');
    if(!f)return 0;
  }catch(e){}
  return 0;
}
var _noteTimestamp=0;

function addNote(){
  var inp=document.getElementById('noteInput');
  var text=inp.value.trim();if(!text)return;
  var pl=getActivePlaylist();if(!pl)return;
  var vid=currentVideoId;if(!vid)return;
  if(!pl.notes)pl.notes={};
  if(!pl.notes[vid])pl.notes[vid]=[];
  pl.notes[vid].push({ts:_noteTimestamp,text:text});
  inp.value='';
  renderNotes();saveAll();
}

function renderNotes(){
  var sec=document.getElementById('notesSection');
  var vid=currentVideoId;
  if(!vid){sec.style.display='none';return;}
  sec.style.display='block';
  var pl=getActivePlaylist();
  var notes=(pl&&pl.notes&&pl.notes[vid])?pl.notes[vid]:[];
  var list=document.getElementById('notesList');
  list.innerHTML='';
  if(notes.length===0){list.innerHTML='<div class="notes-empty">Henüz not yok. T tuşuyla veya aşağıdan not ekleyin.</div>';return;}
  notes.forEach(function(n,ni){
    var row=document.createElement('div');row.className='note-item';
    row.innerHTML='<span class="note-ts">'+fmtSec(n.ts)+'</span><span class="note-text">'+escapeHtml(n.text)+'</span><button class="note-del" title="Sil">✕</button>';
    row.querySelector('.note-del').addEventListener('click',function(e){e.stopPropagation();deleteNote(ni,vid);});
    row.addEventListener('click',function(){seekToNote(n.ts);});
    list.appendChild(row);
  });
}

function deleteNote(ni,vid){
  var pl=getActivePlaylist();if(!pl)return;
  if(pl.notes&&pl.notes[vid])pl.notes[vid].splice(ni,1);
  renderNotes();saveAll();
}

function seekToNote(ts){
  try{
    var f=document.getElementById('ytIframe');
    if(!f||!f.contentWindow)return;
    f.contentWindow.postMessage(JSON.stringify({event:'command',func:'seekTo',args:[ts,true],id:1}),'*');
  }catch(e){}
}

function promptAddNote(){
  var sec=document.getElementById('notesSection');
  if(sec.style.display==='none')return;
  var inp=document.getElementById('noteInput');
  inp.focus();
  inp.placeholder='Not (şu an: '+fmtSec(_noteTimestamp)+')';
}

/* ══════════ VIDEO PLAYBACK ══════════ */
function playPlaylistVideo(i){
  var pl=getActivePlaylist();if(!pl||!pl.items[i])return;
  var item=pl.items[i];
  currentVideoId=item.id;currentInPlaylist=true;currentPlaylistId=activePlaylistId;
  setOopItem(null);
  renderPlaylist();showNowPlaying(item.title,false);buildIframe(item.id,true);renderNotes();saveAll();
}
function playOopVideo(){var oop=getOopItem();if(!oop)return;currentVideoId=oop.id;currentInPlaylist=false;currentPlaylistId=activePlaylistId;renderPlaylist();showNowPlaying(oop.title,true);buildIframe(oop.id,true);renderNotes();saveAll();}
function addOopToPlaylist(){
  var oop=getOopItem();if(!oop)return;var pl=getActivePlaylist();if(!pl)return;
  if(!pl.items.some(function(x){return x.id===oop.id;}))pl.items.push({id:oop.id,title:oop.title,watched:false});
  if(currentVideoId===oop.id&&currentPlaylistId===activePlaylistId)currentInPlaylist=true;
  setOopItem(null);renderPlaylist();saveAll();
}
function showNowPlaying(title,isOop){
  var bar=document.getElementById('nowPlayingBar');
  var label=document.getElementById('npLabel');
  var titleEl=document.getElementById('npTitle');
  bar.style.display='flex';
  label.textContent=isOop?'Playlist Dışı Video':'Şu An İzleniyor';
  label.style.color=isOop?'var(--gold)':'var(--accent)';
  titleEl.textContent=title||'—';
  document.getElementById('placeholder').style.display='none';
}
function removeFromPlaylist(i){
  var pl=getActivePlaylist();if(!pl)return;
  var item=pl.items[i];
  var wasActive=(currentVideoId===item.id&&currentInPlaylist&&currentPlaylistId===activePlaylistId);
  pl.items.splice(i,1);
  if(wasActive){if(pl.items.length===0)destroyPlayer();else{var next=Math.min(i,pl.items.length-1);playPlaylistVideo(next);}}
  renderPlaylist();saveAll();
}
function toggleWatchedByVideoId(vid){
  var pl=getActivePlaylist();if(!pl)return;
  var item=pl.items.find(function(x){return x.id===vid;});
  if(item){item.watched=!item.watched;renderPlaylist();renderTabs();saveAll();}
}

/* ══════════ NEXT / PREV ══════════ */
function nextVideo(){
  var pl=getActivePlaylist();if(!pl)return;
  var idx=pl.items.findIndex(function(x){return x.id===currentVideoId;});
  if(idx>=0&&idx+1<pl.items.length)playPlaylistVideo(idx+1);
}
function prevVideo(){
  var pl=getActivePlaylist();if(!pl)return;
  var idx=pl.items.findIndex(function(x){return x.id===currentVideoId;});
  if(idx>0)playPlaylistVideo(idx-1);
}

/* ══════════ INPUT ══════════ */
function handleInput(){
  var inp=document.getElementById('urlInput');var val=inp.value.trim();if(!val)return;
  var vid=extractVideoId(val);
  if(vid){
    var pl=getActivePlaylist();if(!pl)return;
    if(!pl.items.some(function(p){return p.id===vid;})){
      pl.items.push({id:vid,title:'Yükleniyor...',watched:false});
      fetchTitle(vid);renderPlaylist();saveAll();
      if(pl.items.length===1)playPlaylistVideo(0);
    }
    inp.value='';
    updateUrlClearBtn();
  }else{
    // YouTube search: open in new tab but KEEP the search text in the input
    window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(val),'_blank');
    // Do NOT clear inp.value — user can still see & re-use their search
    updateUrlClearBtn();
  }
}
function updateUrlClearBtn(){
  var inp=document.getElementById('urlInput');
  var btn=document.getElementById('urlClearBtn');
  if(!btn)return;
  btn.style.display=inp.value.length>0?'flex':'none';
}
function clearUrlInput(){
  var inp=document.getElementById('urlInput');
  inp.value='';
  inp.focus();
  updateUrlClearBtn();
}
function extractVideoId(s){
  s=s.trim();var m;
  m=s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);if(m)return m[1];
  m=s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);if(m)return m[1];
  m=s.match(/embed\/([a-zA-Z0-9_-]{11})/);if(m)return m[1];
  m=s.match(/shorts\/([a-zA-Z0-9_-]{11})/);if(m)return m[1];
  if(/^[a-zA-Z0-9_-]{11}$/.test(s))return s;
  return null;
}
function extractYouTubeId(text){return extractVideoId(text);}
function fetchTitle(vid){
  fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+vid+'&format=json')
    .then(function(r){return r.json();})
    .then(function(d){
      var title=d.title||('Video '+vid);
      playlists.forEach(function(pl){pl.items.forEach(function(it){if(it.id===vid)it.title=title;});});
      Object.keys(oopItems).forEach(function(plId){if(oopItems[plId]&&oopItems[plId].id===vid)oopItems[plId].title=title;});
      if(currentVideoId===vid)document.getElementById('npTitle').textContent=title;
      renderPlaylist();saveAll();
    })
    .catch(function(){playlists.forEach(function(pl){pl.items.forEach(function(it){if(it.id===vid&&it.title==='Yükleniyor...')it.title='Video '+vid;});});renderPlaylist();});
}

/* ══════════ SPEED ══════════ */
function setSpeed(speed){currentSpeed=speed;updateSpeedUI();applySpeed(speed,false);saveAll();}
function updateSpeedUI(){
  document.querySelectorAll('.speed-btn,.settings-speed-btn').forEach(function(btn){
    btn.classList.toggle('active',parseFloat(btn.textContent)===currentSpeed);
  });
}
function applySpeed(speed,fromLoad){
  var f=document.getElementById('ytIframe');if(!f||!f.contentWindow)return;
  try{f.contentWindow.postMessage(JSON.stringify({event:'command',func:'setPlaybackRate',args:[speed],id:1}),'*');}catch(e){}
}
function flashSpeedBtn(speed){
  document.querySelectorAll('.speed-btn,.settings-speed-btn').forEach(function(btn){
    if(parseFloat(btn.textContent)===speed){btn.classList.add('flash');setTimeout(function(){btn.classList.remove('flash');},400);}
  });
}

/* ══════════ KEYBOARD SHORTCUTS ══════════ */
// Track Ctrl+A+S combo state
var _ctrlAHeld=false;
document.addEventListener('keydown',function(e){
  var tag=document.activeElement?document.activeElement.tagName:'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  // contenteditable div içindeyse (not editörü) kısayolları çalıştırma
  if(document.activeElement && document.activeElement.getAttribute('contenteditable')==='true')return;

  // Ctrl+A+S = midnight reset test
  if(e.ctrlKey&&(e.key==='a'||e.key==='A')){_ctrlAHeld=true;}
  if(e.ctrlKey&&_ctrlAHeld&&(e.key==='s'||e.key==='S')){
    e.preventDefault();
    testMidnightReset();
    _ctrlAHeld=false;
    return;
  }

  if(e.ctrlKey||e.metaKey)return; // don't hijack other ctrl combos

  if(e.key==='1'){setSpeed(1);flashSpeedBtn(1);}
  if(e.key==='2'){setSpeed(2);flashSpeedBtn(2);}
  if(e.key==='5'){setSpeed(0.5);flashSpeedBtn(0.5);}
  if(e.key==='n'||e.key==='N'){nextVideo();}
  if(e.key==='p'||e.key==='P'){prevVideo();}
  if(e.key==='s'||e.key==='S'){swToggle();}
  if(e.key==='t'||e.key==='T'){promptAddNote();}
  if(e.key==='f'||e.key==='F'){toggleExpand();}
  if(e.key==='?'){openShortcutsModal();}
  if(e.key==='a'||e.key==='A'){toggleAutoPlay();}
});
document.addEventListener('keyup',function(e){if(!e.ctrlKey)_ctrlAHeld=false;});

/* ══════════ MIDNIGHT RESET TEST ══════════ */
var _testDayOffset=1;
var _testBaseSnapshot=null; // 1. basışta gerçek veriyi saklar, sonraki basışlar bunu kullanır

function testMidnightReset(){
  var banner=document.createElement('div');
  banner.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e2230;border:2px solid #e84545;border-radius:14px;padding:20px 28px;z-index:99999;font-family:Syne,sans-serif;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.7);min-width:320px;';

  var prevDate=new Date();
  prevDate.setDate(prevDate.getDate()-_testDayOffset);
  var prev=getDateStr(prevDate);

  // İlk basışta gerçek playlist verisini sakla
  // Sonraki basışlar aynı içeriği farklı tarihlere kaydeder (hidden olan boş liste değil)
  if(_testDayOffset===1){
    _testBaseSnapshot=playlists.map(function(pl){
      return {id:pl.id,name:pl.name,color:pl.color,
        categories:JSON.parse(JSON.stringify(pl.categories||[])),
        notes:JSON.parse(JSON.stringify(pl.notes||{})),
        items:pl.items.map(function(it){return {id:it.id,title:it.title,watched:it.watched,categoryId:it.categoryId||null};})
      };
    });
  }
  var swMs=swAccum+(swRunning?(Date.now()-swStartTime):0);
  var plSnap=_testBaseSnapshot||[];

  banner.innerHTML='<div style="font-size:18px;font-weight:800;color:#e84545;margin-bottom:8px">🕛 GECE YARISI TEST</div>'+
    '<div style="font-size:12px;color:#f5c842;font-weight:700;margin-bottom:8px">Kaydedilen gün: '+formatDateHuman(prev)+'</div>'+
    '<div style="font-size:11px;color:#7a8099;font-family:JetBrains Mono,monospace;text-align:left;line-height:1.9">'+
    '1. Snapshot ('+plSnap.length+' playlist) → <b style="color:#c0c5d8">'+prev+'</b> olarak kaydediliyor<br>'+
    '2. Kronometre sıfırlanıyor (00:00:00)<br>'+
    '3. Playlistler gizleniyor (silinmiyor)<br>'+
    '4. Oynatıcı sıfırlanıyor<br>'+
    '5. Ekran yenileniyor</div>'+
    '<div style="font-size:10px;color:#7a8099;margin-top:8px">Sonraki Ctrl+A+S → '+(_testDayOffset+1)+'. gün olacak</div>';
  document.body.appendChild(banner);

  var today=getTodayStr();
  // --- checkMidnightReset ile BİREBİR AYNI KOD ---
  dailyHistory[prev]={swMs:swMs,playlists:plSnap,timestamp:Date.now()};
  saveHistory();
  swReset();
  playlists.forEach(function(pl){
    pl.hidden=true;
    pl.items.forEach(function(it){it.watched=false;});
    pl.notes={};
  });
  if(playlists.length>0)activePlaylistId=playlists[0].id;
  oopItems={};
  destroyPlayer();
  currentVideoId=null;currentInPlaylist=false;currentPlaylistId=null;
  applyPlannerForDate(today);
  lastCheckedDate=today;
  try{localStorage.setItem('aha_v4_lastdate',today);}catch(e){}
  renderTabs();renderPlaylist();saveAll();
  // --- BİTİŞ ---

  _testDayOffset++;
  setTimeout(function(){
    if(banner.parentNode)banner.parentNode.removeChild(banner);
    showToast('✅ Kaydedildi: '+prev+' — Geçmiş sekmesini kontrol et.');
  },2800);
}

/* ══════════ IFRAME ══════════ */
function buildIframe(vid,autoplay){
  var wrap=document.getElementById('playerWrap');
  var old=document.getElementById('ytIframe');
  var origin=encodeURIComponent(location.origin||'null');
  var ap=(autoplay===false)?0:1;
  var src='https://www.youtube-nocookie.com/embed/'+vid+'?autoplay='+ap+'&rel=0&modestbranding=1&enablejsapi=1&origin='+origin+'&playsinline=1&iv_load_policy=3';
  if(old){if(pollTimer){clearInterval(pollTimer);pollTimer=null;}expectedVideoId=vid;lastKnownState=-1;old.src=src;old.onload=function(){setTimeout(function(){applySpeed(currentSpeed,true);},1200);};startPoll(old);return;}
  if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  var iframe=document.createElement('iframe');
  iframe.id='ytIframe';iframe.src=src;iframe.width='100%';iframe.height='100%';iframe.frameBorder='0';
  iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.allowFullscreen=true;iframe.style.display='block';
  wrap.appendChild(iframe);
  iframe.onload=function(){setTimeout(function(){applySpeed(currentSpeed,true);},1200);};
  startPoll(iframe);lastKnownState=-1;
}
function destroyPlayer(){
  document.getElementById('nowPlayingBar').style.display='none';
  document.getElementById('notesSection').style.display='none';
  var wrap=document.getElementById('playerWrap');var old=document.getElementById('ytIframe');
  if(old)wrap.removeChild(old);
  document.getElementById('placeholder').style.display='flex';
  if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  if(videoChangeLockTimer){clearTimeout(videoChangeLockTimer);videoChangeLockTimer=null;}
  expectedVideoId=null;currentVideoId=null;currentInPlaylist=false;currentPlaylistId=null;lastKnownState=-1;
}
function startPoll(iframe){
  if(pollTimer)clearInterval(pollTimer);
  pollTimer=setInterval(function(){
    var f=iframe||document.getElementById('ytIframe');if(!f||!f.contentWindow)return;
    try{
      f.contentWindow.postMessage(JSON.stringify({event:'listening',id:1,channel:'widget'}),'*');
      f.contentWindow.postMessage(JSON.stringify({event:'command',func:'getPlayerState',args:[],id:1}),'*');
      f.contentWindow.postMessage(JSON.stringify({event:'command',func:'getCurrentTime',args:[],id:1}),'*');
      f.contentWindow.postMessage(JSON.stringify({event:'command',func:'getVideoData',args:[],id:1}),'*');
    }catch(err){}
  },500);
}
window.addEventListener('message',function(e){
  if(!e.data)return;
  /* Ignore messages from the music iframe — it has its own listener */
  var mf=document.getElementById('musicYtIframe');
  if(mf&&e.source===mf.contentWindow)return;
  var data;
  try{data=typeof e.data==='string'?JSON.parse(e.data):e.data;}catch(err){return;}
  if(data.event==='infoDelivery'&&data.info){
    var info=data.info;
    if(info.currentTime!==undefined)_noteTimestamp=Math.floor(info.currentTime);
    if(info.videoData&&info.videoData.video_id){
      var newVid=info.videoData.video_id;
      if(newVid===expectedVideoId){expectedVideoId=null;}
      else if(newVid&&newVid!==currentVideoId){handleVideoChange(newVid,info.videoData.title||('Video '+newVid));}
    }
    var s=info.playerState;
    if(s!==undefined&&s!==lastKnownState){handleStateChange(s);lastKnownState=s;}
    if(info.playerState===1&&currentSpeed!==1)applySpeed(currentSpeed,true);
  }
  if(data.event==='onStateChange'){var state=data.info;if(state!==lastKnownState){handleStateChange(state);lastKnownState=state;}}
});
function isShortsDuration(isoDuration){
  var m=isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if(!m)return false;
  var h=parseInt(m[1]||0),min=parseInt(m[2]||0),s=parseInt(m[3]||0);
  return (h*3600+min*60+s) < 62;
}

/* Shorts kontrolü için: işlenmekte olan video ID'lerini takip et */
var _shortsChecking={};   // {videoId: true} — kontrol edilenler
var _shortsBlocked={};    // {videoId: true} — Shorts olduğu tespit edilenler

function handleVideoChange(newVid,newTitle){
  /* Zaten Shorts olduğu bilinen bir video — anında reddet */
  if(_shortsBlocked[newVid]){
    showToast('⏭ Shorts atlandı');
    return;
  }
  /* Zaten kontrol ediliyor — tekrar fetch atma */
  if(_shortsChecking[newVid]) return;

  var prevVid=currentVideoId;
  _shortsChecking[newVid]=true;

  ytFetch('/youtube/v3/videos', {part:'contentDetails', id:newVid})
    .then(function(r){return r.json();})
    .then(function(data){
      delete _shortsChecking[newVid];
      var item=data.items&&data.items[0];
      var dur=item&&item.contentDetails&&item.contentDetails.duration;
      if(dur&&isShortsDuration(dur)){
        _shortsBlocked[newVid]=true;
        showToast('⏭ Shorts atlandı');
        /* iframe'i önceki videoya geri döndür */
        if(prevVid){
          expectedVideoId=prevVid;
          var f=document.getElementById('ytIframe');
          if(f&&f.contentWindow){
            try{f.contentWindow.postMessage(JSON.stringify({event:'command',func:'loadVideoById',args:[prevVid],id:1}),'*');}catch(e){}
          }
        }
        return;
      }
      _applyVideoChange(newVid,newTitle);
    })
    .catch(function(){
      delete _shortsChecking[newVid];
      _applyVideoChange(newVid,newTitle);
    });
}

function _applyVideoChange(newVid,newTitle){
  var pl=getActivePlaylist();var inPl=pl&&pl.items.some(function(x){return x.id===newVid;});
  document.getElementById('placeholder').style.display='none';
  document.getElementById('nowPlayingBar').style.display='flex';
  if(inPl){
    var idx=pl.items.findIndex(function(x){return x.id===newVid;});
    currentVideoId=newVid;currentInPlaylist=true;currentPlaylistId=activePlaylistId;
    showNowPlaying(pl.items[idx].title,false);renderPlaylist();renderNotes();saveAll();
  } else {
    var tempTitle=newTitle&&newTitle!==('Video '+newVid)?newTitle:'İlgili Video...';
    setOopItem({id:newVid,title:tempTitle});
    currentVideoId=newVid;currentInPlaylist=false;currentPlaylistId=activePlaylistId;
    showNowPlaying(tempTitle,true);
    renderPlaylist();renderNotes();saveAll();
    fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+newVid+'&format=json')
      .then(function(r){return r.json();})
      .then(function(d){
        var cur=getOopItem();
        if(cur&&cur.id===newVid&&d.title){
          setOopItem({id:newVid,title:d.title});
          showNowPlaying(d.title,true);
          renderPlaylist();saveAll();
        }
      }).catch(function(){});
  }
  // İlgili tab açıksa yenile
  if(_relatedTabActive){
    setTimeout(function(){fetchRelatedVideos(false);},600);
  }
}

function handleStateChange(state){
  if(state===1&&!swRunning)swStart();
  if(state===2&&swRunning)swPause();
  if(state===0){
    swPause();
    if(autoPlayEnabled&&currentInPlaylist&&currentPlaylistId===activePlaylistId){
      var pl=getActivePlaylist();if(pl){var idx=pl.items.findIndex(function(x){return x.id===currentVideoId;});if(idx>=0&&idx+1<pl.items.length)playPlaylistVideo(idx+1);}
    }
  }
  if(state===1&&currentSpeed!==1)setTimeout(function(){applySpeed(currentSpeed,true);},300);
  /* Music bridge */
  if(typeof onMainVideoStart==='function'){
    if(state===1) onMainVideoStart();
    else if(state===2||state===0||state===-1) onMainVideoStop();
  }
}

/* ══════════ CAPTURE ══════════ */

function tryLoadFromText(text){var vid=extractYouTubeId(text);if(!vid)return false;if(vid===lastLoadedClipUrl)return false;lastLoadedClipUrl=vid;loadVideoInPlayer(vid);return true;}
function loadVideoInPlayer(vid){
  if(!vid||vid===currentVideoId)return;
  var pl=getActivePlaylist();var inPl=pl&&pl.items.some(function(x){return x.id===vid;});
  if(inPl){var idx=pl.items.findIndex(function(x){return x.id===vid;});playPlaylistVideo(idx);}
  else{
    setOopItem({id:vid,title:'Yükleniyor...'});currentVideoId=vid;currentInPlaylist=false;currentPlaylistId=activePlaylistId;
    document.getElementById('placeholder').style.display='none';document.getElementById('nowPlayingBar').style.display='flex';
    showNowPlaying('Yükleniyor...',true);buildIframe(vid,true);
    fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+vid+'&format=json').then(function(r){return r.json();}).then(function(d){var cur=getOopItem();if(cur&&cur.id===vid){setOopItem({id:vid,title:d.title||vid});showNowPlaying(getOopItem().title,true);renderPlaylist();saveAll();}}).catch(function(){});
    renderPlaylist();renderNotes();saveAll();
  }
}


/* ══════════ STOPWATCH ══════════ */
function swTick(){document.getElementById('swDisplay').textContent=swFormat(swAccum+(Date.now()-swStartTime));}
function swToggle(){
  if(pomodoroActive){togglePomodoroPlayPause();return;}
  swRunning?swPause():swStart();
}
function swStart(){if(swRunning)return;swRunning=true;swStartTime=Date.now();swInterval=setInterval(swTick,200);updateSwUI();}
function swPause(){if(!swRunning)return;swRunning=false;swAccum+=Date.now()-swStartTime;clearInterval(swInterval);swInterval=null;updateSwUI();saveAll();}
function swReset(){swRunning=false;swAccum=0;clearInterval(swInterval);swInterval=null;swLaps=[];document.getElementById('swDisplay').textContent='00:00:00';document.getElementById('lapList').innerHTML='';updateSwUI();saveAll();}
function swLap(){var el=swAccum+(swRunning?(Date.now()-swStartTime):0);swLaps.push(el);renderLaps();saveAll();}
function removeLap(i){swLaps.splice(i,1);renderLaps();saveAll();}
function renderLaps(){var list=document.getElementById('lapList');list.innerHTML='';for(var i=swLaps.length-1;i>=0;i--){var d=document.createElement('div');d.className='lap-item';d.innerHTML='<span class="lap-n">Tur '+(i+1)+'</span><span class="lap-t">'+swFormat(swLaps[i])+'</span><button class="lap-del-btn" title="Turu Kaldır" onclick="removeLap('+i+')">✕</button>';list.appendChild(d);}}
function updateSwUI(){
  var dot=document.getElementById('swDot'),disp=document.getElementById('swDisplay'),stat=document.getElementById('swStatus'),icon=document.getElementById('swPlayPauseIcon'),lbl=document.getElementById('swPlayPauseLbl'),btn=document.getElementById('swPlayPauseBtn');
  if(swRunning){dot.classList.add('running');disp.classList.add('running');stat.textContent='Çalışıyor';icon.textContent='⏸';lbl.textContent='Durdur';btn.classList.add('primary');}
  else{dot.classList.remove('running');disp.classList.remove('running');stat.textContent=swAccum>0?'Duraklatıldı':'Bekliyor';icon.textContent='▶';lbl.textContent='Başlat';btn.classList.remove('primary');}
}

/* ══════════ COLOR PICKER ══════════ */
function openPlaylistColorPicker(e,plId){
  var pl=playlists.find(function(p){return p.id===plId;});
  colorPickerCallback=function(color){pl.color=color;renderTabs();saveAll();};
  showColorPicker(e.target,pl?pl.color:null,pl?pl.name:null,function(newName){
    if(newName&&newName!==pl.name){pl.name=newName;renderTabs();saveAll();}
  });
}
function openCatColorPicker(e,catId){
  var pl=getActivePlaylist();if(!pl)return;
  var cat=pl.categories.find(function(c){return c.id===catId;});
  colorPickerCallback=function(color){if(cat)cat.color=color;renderCatList();renderPlaylist();saveAll();};
  showColorPicker(e.target,cat?cat.color:null,null,null);
}
var _nameCallback=null;
function showColorPicker(anchor,currentColor,currentName,nameCallback){
  _nameCallback=nameCallback||null;
  var popup=document.getElementById('colorPickerPopup');
  var nameRow=document.getElementById('colorPickerNameRow');
  var nameInput=document.getElementById('colorPickerNameInput');
  // Show/hide name row
  if(nameCallback&&currentName!==null&&currentName!==undefined){
    nameRow.style.display='block';
    nameInput.value=currentName||'';
  }else{
    nameRow.style.display='none';
  }
  var sw=document.getElementById('colorSwatches');sw.innerHTML='';
  var none=document.createElement('div');none.className='color-swatch none-swatch'+(!currentColor?' selected':'');none.title='Renk yok';none.textContent='✕';
  none.addEventListener('click',function(){
    if(_nameCallback)_nameCallback(nameInput.value.trim());
    if(colorPickerCallback)colorPickerCallback(null);
    popup.style.display='none';
  });sw.appendChild(none);
  PALETTE.forEach(function(color){
    var s=document.createElement('div');s.className='color-swatch'+(currentColor===color?' selected':'');s.style.background=color;s.title=color;
    s.addEventListener('click',function(){
      if(_nameCallback)_nameCallback(nameInput.value.trim());
      if(colorPickerCallback)colorPickerCallback(color);
      popup.style.display='none';
    });sw.appendChild(s);
  });
  popup.style.display='block';
  // Position: use viewport coords of anchor
  var rect=anchor.getBoundingClientRect();
  var pw=popup.offsetWidth||200;
  var ph=popup.offsetHeight||160;
  var left=rect.left;
  var top=rect.bottom+6;
  // Keep within viewport
  if(left+pw>window.innerWidth-10)left=window.innerWidth-pw-10;
  if(left<10)left=10;
  if(top+ph>window.innerHeight-10)top=rect.top-ph-6;
  if(top<10)top=10;
  popup.style.left=left+'px';
  popup.style.top=top+'px';
  // Also close on Enter in name input
  nameInput.onkeydown=function(e){
    if(e.key==='Enter'){
      if(_nameCallback)_nameCallback(nameInput.value.trim());
      if(colorPickerCallback)colorPickerCallback(currentColor);
      popup.style.display='none';
    }
    e.stopPropagation();
  };
  setTimeout(function(){
    function onOut(ev){
      if(!popup.contains(ev.target)){
        // Save name on outside click too
        if(_nameCallback)_nameCallback(nameInput.value.trim());
        popup.style.display='none';
        document.removeEventListener('mousedown',onOut);
      }
    }
    document.addEventListener('mousedown',onOut);
  },10);
}

// openColorPickerPopup: generic wrapper usable from any context (e.g. manager)
function openColorPickerPopup(e,onColor,onName,currentColor,currentName){
  colorPickerCallback=onColor||null;
  _nameCallback=onName||null;
  var anchor=e.target||e.currentTarget||document.body;
  showColorPicker(anchor,currentColor,currentName||null,onName||null);
}

/* ══════════ CATEGORY MODAL ══════════ */
function openCatModal(){renderCatList();document.getElementById('catModalOverlay').classList.add('open');setTimeout(function(){document.getElementById('catNameInput').focus();},80);}
function closeCatModal(){document.getElementById('catModalOverlay').classList.remove('open');document.getElementById('catNameInput').value='';}
function addCategory(){
  var pl=getActivePlaylist();if(!pl)return;
  var name=document.getElementById('catNameInput').value.trim();if(!name)return;
  if(!pl.categories)pl.categories=[];
  if(!pl.catOrder)pl.catOrder=[];
  var newCat={id:uid(),name:name,color:PALETTE[pl.categories.length%PALETTE.length]};
  pl.categories.push(newCat);
  pl.catOrder.push(newCat.id);
  document.getElementById('catNameInput').value='';renderCatList();renderPlaylist();saveAll();
}
function renderCatList(){
  var pl=getActivePlaylist();var cats=(pl&&pl.categories)?pl.categories:[];var el=document.getElementById('catList');el.innerHTML='';
  if(cats.length===0){el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">Henüz kategori yok</div>';return;}
  cats.forEach(function(cat){
    var row=document.createElement('div');row.className='cat-item';
    row.innerHTML='<button class="cat-color-btn" style="background:'+(cat.color||'#888')+'" title="Renk değiştir"></button><span class="cat-name-display">'+escapeHtml(cat.name)+'</span><button class="cat-item-del" title="Sil">✕</button>';
    row.querySelector('.cat-color-btn').addEventListener('click',function(e){openCatColorPicker(e,cat.id);});
    row.querySelector('.cat-item-del').addEventListener('click',function(){
      if(!pl)return;pl.categories=pl.categories.filter(function(c){return c.id!==cat.id;});
      pl.items.forEach(function(it){if(it.categoryId===cat.id)delete it.categoryId;});
      renderCatList();renderPlaylist();saveAll();
    });
    el.appendChild(row);
  });
}

/* ══════════ VID CAT MODAL ══════════ */
function openVidCatModal(idx,item){
  var pl=getActivePlaylist();if(!pl||!pl.categories||pl.categories.length===0){alert('Önce kategori oluşturun (⊞ butonu).');return;}
  vidCatTargetIndex=idx;vidCatSelectedId=item.categoryId||null;
  document.getElementById('vidCatModalTitle').textContent='Kategori Ata: '+(item.title.length>28?item.title.substr(0,28)+'…':item.title);
  renderVidCatList(pl);document.getElementById('vidCatModalOverlay').classList.add('open');
}
function closeVidCatModal(){document.getElementById('vidCatModalOverlay').classList.remove('open');vidCatTargetIndex=null;vidCatSelectedId=null;}
function renderVidCatList(pl){
  var el=document.getElementById('vidCatList');el.innerHTML='';
  var none=document.createElement('div');none.className='vid-cat-opt'+(!vidCatSelectedId?' selected':'');
  none.innerHTML='<span class="vid-cat-dot" style="background:var(--muted)"></span>Kategorisiz';
  none.addEventListener('click',function(){vidCatSelectedId=null;el.querySelectorAll('.vid-cat-opt').forEach(function(o){o.classList.remove('selected');});none.classList.add('selected');});
  el.appendChild(none);
  pl.categories.forEach(function(cat){
    var opt=document.createElement('div');opt.className='vid-cat-opt'+(vidCatSelectedId===cat.id?' selected':'');
    opt.innerHTML='<span class="vid-cat-dot" style="background:'+(cat.color||'#888')+'"></span>'+escapeHtml(cat.name);
    opt.addEventListener('click',function(){vidCatSelectedId=cat.id;el.querySelectorAll('.vid-cat-opt').forEach(function(o){o.classList.remove('selected');});opt.classList.add('selected');});
    el.appendChild(opt);
  });
}
function confirmVidCat(){
  var pl=getActivePlaylist();if(!pl||vidCatTargetIndex===null){closeVidCatModal();return;}
  if(vidCatSelectedId)pl.items[vidCatTargetIndex].categoryId=vidCatSelectedId;
  else delete pl.items[vidCatTargetIndex].categoryId;
  closeVidCatModal();renderPlaylist();saveAll();
}

/* ══════════ SHORTCUTS MODAL ══════════ */
function openShortcutsModal(){document.getElementById('shortcutsModalOverlay').classList.add('open');}
function closeShortcutsModal(){document.getElementById('shortcutsModalOverlay').classList.remove('open');}
function switchScTab(tab){
  ['keys','tips'].forEach(function(t){
    document.getElementById('scTab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active',t===tab);
    document.getElementById('scPage'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active',t===tab);
  });
}


/* ══════════ AUTO-PLAY ══════════ */
var autoPlayEnabled=false;
function toggleAutoPlay(){autoPlayEnabled=!autoPlayEnabled;_updateSettingsAutoplay();saveAll();}

/* ══════════ WHITE NOISE ══════════ */
var whiteNoiseCtx=null,whiteNoiseSource=null,whiteNoiseGain=null,whiteNoiseOn=false;
function toggleWhiteNoise(){
  if(whiteNoiseOn){stopWhiteNoise();}else{startWhiteNoise();}
}
function startWhiteNoise(){
  try{
    if(!whiteNoiseCtx)whiteNoiseCtx=new(window.AudioContext||window.webkitAudioContext)();
    var buf=whiteNoiseCtx.createBuffer(1,whiteNoiseCtx.sampleRate*2,whiteNoiseCtx.sampleRate);
    var data=buf.getChannelData(0);
    for(var i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*0.5;
    whiteNoiseSource=whiteNoiseCtx.createBufferSource();
    whiteNoiseSource.buffer=buf;whiteNoiseSource.loop=true;
    whiteNoiseGain=whiteNoiseCtx.createGain();whiteNoiseGain.gain.value=0.12;
    // Brown noise filter
    var filter=whiteNoiseCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=600;
    whiteNoiseSource.connect(filter);filter.connect(whiteNoiseGain);whiteNoiseGain.connect(whiteNoiseCtx.destination);
    whiteNoiseSource.start();
    whiteNoiseOn=true;
    document.getElementById('whiteNoiseBtn').classList.add('on');
    document.getElementById('wnIcon').textContent='🔊';
  }catch(e){alert('Ses başlatılamadı: '+e.message);}
}
function stopWhiteNoise(){
  try{if(whiteNoiseSource)whiteNoiseSource.stop();}catch(e){}
  whiteNoiseSource=null;whiteNoiseGain=null;whiteNoiseOn=false;
  document.getElementById('whiteNoiseBtn').classList.remove('on');
  document.getElementById('wnIcon').textContent='🎵';
}

/* ══════════ EXAM NOISE ══════════ */
var examNoiseOn = false;
var _examNoiseTimer = null;
var _examNoisePausedAt = null;  /* session içinde kaldığı saniye */
var _examNoiseStartedAt = null; /* o anki oynatma başlangıcı (ms) */
var _examNoiseDur = 9893;       /* 2sa 45dk */
var _examNoiseStartSec = 7;     /* her zaman 7. saniyeden başla (ilk açılış / video sonu) */

function toggleExamNoise(){
  if(examNoiseOn){ stopExamNoise(); } else { startExamNoise(); }
}

function startExamNoise(){
  /* Sayfa ilk açıldıysa _examNoisePausedAt=null → 7. saniyeden başla
     Session içinde durdurulduysa → kaldığı yerden devam */
  var from = (_examNoisePausedAt !== null) ? _examNoisePausedAt : _examNoiseStartSec;
  _examNoisePlay(from);
}

function _examNoisePlay(fromSec){
  var iframe = document.getElementById('examNoiseIframe');
  if(!iframe){
    iframe = document.createElement('iframe');
    iframe.id = 'examNoiseIframe';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.style.cssText = 'position:fixed;width:1px;height:1px;bottom:0;right:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
  }
  iframe.src = 'https://www.youtube.com/embed/YAe8PuIZB6s?autoplay=1&rel=0&modestbranding=1&start=' + Math.floor(fromSec);
  _examNoiseStartedAt = Date.now();
  _examNoisePausedAt = null;
  /* Video bitince 7. saniyeden yeniden başlat */
  if(_examNoiseTimer) clearTimeout(_examNoiseTimer);
  var remaining = (_examNoiseDur - fromSec) * 1000;
  _examNoiseTimer = setTimeout(function(){
    if(!examNoiseOn) return;
    _examNoisePausedAt = null;
    _examNoisePlay(_examNoiseStartSec);
  }, remaining > 500 ? remaining : 500);
  examNoiseOn = true;
  document.getElementById('examNoiseBtn').classList.add('on');
  document.getElementById('examIcon').textContent = '✏️';
}

function stopExamNoise(){
  /* Kaldığı yeri kaydet (sadece session için — localStorage yok) */
  if(_examNoiseStartedAt !== null){
    var elapsed = (Date.now() - _examNoiseStartedAt) / 1000;
    var pos = ((_examNoisePausedAt !== null ? _examNoisePausedAt : _examNoiseStartSec)) + elapsed;
    _examNoisePausedAt = (pos < _examNoiseDur) ? pos : _examNoiseStartSec;
  }
  if(_examNoiseTimer){ clearTimeout(_examNoiseTimer); _examNoiseTimer = null; }
  var iframe = document.getElementById('examNoiseIframe');
  if(iframe){ iframe.src = ''; }
  _examNoiseStartedAt = null;
  examNoiseOn = false;
  document.getElementById('examNoiseBtn').classList.remove('on');
  document.getElementById('examIcon').textContent = '📝';
}

/* ══════════ PLAYLIST RENAME ══════════ */
function startPlaylistRename(pl,nameSpan){
  var orig=pl.name;
  var inp=document.createElement('input');inp.className='pl-tab-rename-input';inp.type='text';inp.value=orig;
  nameSpan.replaceWith(inp);inp.focus();inp.select();
  function done(){
    var v=inp.value.trim();
    if(v&&v!==orig){pl.name=v;saveAll();}
    renderTabs();
  }
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'){done();}if(e.key==='Escape'){renderTabs();}e.stopPropagation();});
  inp.addEventListener('blur',done);
}

/* ══════════ COPY VIDEO ══════════ */
var copyVideoSrcPlaylistId=null,copyVideoItem=null,copyVideoTargetId=null;
function openCopyVideoModal(idx,item){
  copyVideoSrcPlaylistId=activePlaylistId;copyVideoItem=item;copyVideoTargetId=null;
  document.getElementById('copyVideoModalTitle').textContent='Kopyala: '+(item.title.length>26?item.title.substr(0,26)+'…':item.title);
  renderCopyPlList();document.getElementById('copyVideoModalOverlay').classList.add('open');
}
function closeCopyVideoModal(){document.getElementById('copyVideoModalOverlay').classList.remove('open');copyVideoSrcPlaylistId=null;copyVideoItem=null;copyVideoTargetId=null;}
function renderCopyPlList(){
  var el=document.getElementById('copyPlList');el.innerHTML='';
  playlists.forEach(function(pl){
    if(pl.id===copyVideoSrcPlaylistId)return;
    var opt=document.createElement('div');opt.className='copy-pl-opt'+(copyVideoTargetId===pl.id?' selected':'');
    var dot='<div class="copy-pl-dot" style="background:'+(pl.color||'var(--muted)')+'"></div>';
    opt.innerHTML=dot+escapeHtml(pl.name);
    opt.addEventListener('click',function(){copyVideoTargetId=pl.id;el.querySelectorAll('.copy-pl-opt').forEach(function(o){o.classList.remove('selected');});opt.classList.add('selected');});
    el.appendChild(opt);
  });
  if(el.children.length===0)el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:12px">Başka playlist yok.</div>';
}
function confirmCopyVideo(){
  if(!copyVideoTargetId||!copyVideoItem){closeCopyVideoModal();return;}
  var target=playlists.find(function(p){return p.id===copyVideoTargetId;});
  if(!target){closeCopyVideoModal();return;}
  if(!target.items.some(function(x){return x.id===copyVideoItem.id;})){
    target.items.push({id:copyVideoItem.id,title:copyVideoItem.title,watched:false});
  }
  closeCopyVideoModal();saveAll();
  // Show toast
  showToast('Video kopyalandı: '+target.name);
}

/* ══════════ REORDER PLAYLISTS ══════════ */
var reorderDragSrc=null,reorderNewOrder=null;
function openReorderModal(){
  reorderNewOrder=playlists.map(function(p){return p.id;});
  renderReorderList();document.getElementById('reorderModalOverlay').classList.add('open');
}
function closeReorderModal(){document.getElementById('reorderModalOverlay').classList.remove('open');}
function renderReorderList(){
  var el=document.getElementById('reorderList');el.innerHTML='';
  reorderNewOrder.forEach(function(plId,idx){
    var pl=playlists.find(function(p){return p.id===plId;});if(!pl)return;
    var item=document.createElement('div');item.className='reorder-item';item.draggable=true;item.dataset.idx=idx;
    var dot=pl.color?'<span style="width:9px;height:9px;border-radius:50%;background:'+pl.color+';flex-shrink:0;display:inline-block"></span>':'';
    item.innerHTML='<span class="reorder-drag-icon">⠿</span>'+dot+'<span>'+escapeHtml(pl.name)+'</span>';
    item.addEventListener('dragstart',function(){reorderDragSrc=idx;item.classList.add('dragging');});
    item.addEventListener('dragend',function(){item.classList.remove('dragging');el.querySelectorAll('.reorder-item').forEach(function(d){d.classList.remove('drag-over-pl');});});
    item.addEventListener('dragover',function(e){e.preventDefault();el.querySelectorAll('.reorder-item').forEach(function(d){d.classList.remove('drag-over-pl');});item.classList.add('drag-over-pl');});
    item.addEventListener('dragleave',function(){item.classList.remove('drag-over-pl');});
    item.addEventListener('drop',function(e){
      e.preventDefault();item.classList.remove('drag-over-pl');
      if(reorderDragSrc===null||reorderDragSrc===idx)return;
      var moved=reorderNewOrder.splice(reorderDragSrc,1)[0];reorderNewOrder.splice(idx,0,moved);
      reorderDragSrc=null;renderReorderList();
    });
    el.appendChild(item);
  });
}
function confirmReorder(){
  if(!reorderNewOrder)return;
  var newPls=reorderNewOrder.map(function(id){return playlists.find(function(p){return p.id===id;});}).filter(Boolean);
  playlists.length=0;newPls.forEach(function(p){playlists.push(p);});
  closeReorderModal();renderTabs();saveAll();
}


/* ══════════ VIBES PANEL ══════════ */
var _vibesPanelOpen = false;

function _vibesOpenRaw(){
  var panel = document.getElementById('vibesDropdown');
  if(!panel) return;
  _vibesPanelOpen = true;
  panel.style.display = 'block';
  var btn = document.getElementById('vibesBtn');
  if(btn){
    var rect = btn.getBoundingClientRect();
    panel.style.right = (window.innerWidth - rect.right) + 'px';
    panel.style.top   = (rect.bottom + 4) + 'px';
    panel.style.left  = 'auto';
  }
  setTimeout(function(){
    document.addEventListener('mousedown', _vibesOutsideClose);
  }, 10);
}
function _vibesCloseRaw(){
  var panel = document.getElementById('vibesDropdown');
  if(panel) panel.style.display = 'none';
  document.removeEventListener('mousedown', _vibesOutsideClose);
  _vibesPanelOpen = false;
}
function toggleVibesPanel(){
  if(_vibesPanelOpen){
    _vibesCloseRaw();
  } else {
    /* Close fullscreen panels when vibes opens */
    if(_activePanel){ _panels[_activePanel].close(); _activePanel = null; }
    _vibesOpenRaw();
  }
  _updateVibesDot();
}
function _vibesOutsideClose(e){
  var panel = document.getElementById('vibesDropdown');
  var btn   = document.getElementById('vibesBtn');
  if(panel && !panel.contains(e.target) && btn && !btn.contains(e.target)){
    _vibesCloseRaw();
  }
}
function _updateVibesDot(){
  var dot = document.getElementById('vibesActiveDot');
  if(!dot) return;
  dot.style.display = (whiteNoiseOn || examNoiseOn || musicIsPlaying) ? 'block' : 'none';
}
/* Patch noise functions to also update dot */
var _origStartWhiteNoise = startWhiteNoise;
var _origStopWhiteNoise  = stopWhiteNoise;
var _origStartExamNoise  = startExamNoise;
var _origStopExamNoise   = stopExamNoise;
startWhiteNoise = function(){ _origStartWhiteNoise(); _updateVibesDot(); };
stopWhiteNoise  = function(){ _origStopWhiteNoise();  _updateVibesDot(); };
startExamNoise  = function(){ _origStartExamNoise();  _updateVibesDot(); };
stopExamNoise   = function(){ _origStopExamNoise();   _updateVibesDot(); };

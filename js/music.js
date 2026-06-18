/* ══════════ MUSIC PLAYER v2 — YT Music Only, Separate Iframe ══════════ */
var LS_MUSIC_STATE = 'aha_music_v2';

/* ── State ── */
var musicSource = 'ytmusic';
var musicPanelOpen = false;
var _musicSearchQuery = '';

/* ── YT Music ── */
var ytMusicPlaylists = [];
var ytMusicActivePlId = null;
var ytMusicTracks = [];
var ytMusicTrackIndex = -1;

/* ── Playback modes ── */
/* repeatMode: 0=off, 1=repeat-all, 2=repeat-one */
var musicShuffle = false;
var musicRepeat = 0;
var musicShuffleOrder = [];
var musicShufflePos = -1;
var musicIsPlaying = false;
var musicPausedByVideo = false;

/* ── Music iframe ── */
var musicIframe = null;
var musicIframePollTimer = null;
var musicIframeVideoId = null;
var musicIframeState = -1;

/* ═══ PERSIST ═══ */
function saveMusicState(){
  try{
    localStorage.setItem(LS_MUSIC_STATE, JSON.stringify({
      ytPlId: ytMusicActivePlId,
      ytTrackIdx: ytMusicTrackIndex,
      ytMusicTracks: ytMusicTracks,
      ytMusicPlaylists: ytMusicPlaylists,
      shuffle: musicShuffle,
      repeat: musicRepeat
    }));
  }catch(e){}
}

function loadMusicState(){
  try{
    var r = localStorage.getItem(LS_MUSIC_STATE);
    if(r){
      var d = JSON.parse(r);
      ytMusicActivePlId = d.ytPlId || null;
      ytMusicTrackIndex = (d.ytTrackIdx != null) ? d.ytTrackIdx : -1;
      ytMusicTracks = d.ytMusicTracks || [];
      ytMusicPlaylists = d.ytMusicPlaylists || [];
      musicShuffle = !!d.shuffle;
      musicRepeat = d.repeat || 0;
    }
  }catch(e){}
}

/* ═══ INIT ═══ */
function initMusicPanel(){
  loadMusicState();
  updateMusicPanelTag();
  renderMusicContent();
  if(_ytAccessToken && ytMusicPlaylists.length === 0){
    fetchYTMusicPlaylists();
  }
  /* After Google API script loads (async), try silent re-login */
  if(_musicLastEmail && !_ytAccessToken){
    setTimeout(tryMusicSilentLogin, 1200);
  }
}

/* ═══ PANEL TOGGLE ═══ */
function toggleMusicPanel(){ /* music content is inside vibes panel, no-op */ }
function openMusicPanelUI(){ renderMusicContent(); }
function closeMusicPanelUI(){ }
function setMusicSource(src){ /* no-op, kept for compat */ }
function updateMusicSourceBtns(){ /* no-op, kept for compat */ }

function updateMusicPanelTag(){
  var t = document.getElementById('musicPanelTag');
  if(!t) return;
  if(musicIsPlaying){
    t.className = 'music-panel-status-tag ytmusic';
    t.textContent = '▶ Çalıyor';
    t.style.display = 'inline-flex';
  } else {
    t.className = 'music-panel-status-tag';
    t.textContent = '';
    t.style.display = 'none';
  }
  if(typeof _updateVibesDot === 'function') _updateVibesDot();
}

/* ═══ RENDER ═══ */
function renderMusicContent(){
  var c = document.getElementById('musicSourceContent');
  if(!c) return;

  var loggedIn = !!_ytAccessToken;
  if(!loggedIn){
    c.innerHTML =
      '<div class="music-login-section">' +
        '<div class="music-status-text" style="text-align:left;color:var(--text2);margin-bottom:6px">YouTube playlist\'lerinize erişmek için Google hesabınıza giriş yapın.</div>' +
        '<button class="music-login-btn google-login" onclick="signInGoogleForMusic()">' +
          '<svg width="14" height="14" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>' +
          ' Google ile Giriş Yap' +
        '</button>' +
        '<div class="music-login-hint">' +
          '<span class="hint-bold">Ama benim şarkılarım Spotify veya Apple Music\'te!</span><br>' +
          'Dert değil! <a href="https://www.tunemymusic.com" target="_blank">tunemymusic</a> sitesinden playlistlerini YouTube hesabına hızlıca aktarabilirsin!' +
        '</div>' +
      '</div>';
    return;
  }

  var plSel = '<select class="music-pl-select" id="ytMPlSel" onchange="onYTMusicPlChange(this.value)">';
  plSel += '<option value="">— YouTube Playlist seçin —</option>';
  ytMusicPlaylists.forEach(function(pl){
    plSel += '<option value="'+pl.id+'"'+(pl.id===ytMusicActivePlId?' selected':'')+'>'+escapeHtml(pl.name)+' ('+pl.itemCount+')</option>';
  });
  if(ytMusicPlaylists.length===0){ plSel += '<option disabled>Yükleniyor...</option>'; }
  plSel += '</select>';

  var curTrack = (ytMusicTrackIndex>=0 && ytMusicTrackIndex<ytMusicTracks.length) ? ytMusicTracks[ytMusicTrackIndex] : null;
  var nowHtml = '';
  if(curTrack){
    nowHtml = '<div class="music-now-track">' +
      '<div class="music-now-track-label">Şu An'+(musicIsPlaying?' ▶':'')+'</div>' +
      '<div class="music-now-track-name">'+escapeHtml(curTrack.title)+'</div>' +
      '<div class="music-now-track-artist">'+escapeHtml(curTrack.channel||'')+'</div>' +
    '</div>';
  }

  var shuffleStyle = musicShuffle ? 'border-color:var(--blue);color:var(--blue);background:rgba(59,130,246,0.12)' : '';
  var repeatStyle  = musicRepeat>0 ? 'border-color:var(--green);color:var(--green);background:rgba(46,204,113,0.12)' : '';
  var repeatIcon   = musicRepeat===0 ? '↩' : musicRepeat===1 ? '🔁' : '🔂';
  var playIcon     = musicIsPlaying ? '⏸' : '▶';
  var repeatTitle  = musicRepeat===0 ? 'Tekrar Kapalı' : musicRepeat===1 ? 'Liste Tekrar' : 'Şarkı Tekrar';

  var ctrlHtml =
    '<div class="music-controls">' +
      '<button class="music-ctrl-btn" style="'+shuffleStyle+';position:relative" onclick="toggleMusicShuffle()" title="Karışık Çal">🔀<span style="position:absolute;top:-4px;right:-4px;font-size:8px;font-weight:800;background:var(--blue);color:#fff;border-radius:6px;padding:0 3px;line-height:13px;display:'+(musicShuffle?'block':'none')+'">1</span></button>' +
      '<button class="music-ctrl-btn" onclick="musicPrevTrack()" title="Önceki">⏮</button>' +
      '<button class="music-ctrl-btn play" id="musicPlayBtn" onclick="musicTogglePlay()" title="Oynat/Durdur">'+playIcon+'</button>' +
      '<button class="music-ctrl-btn" onclick="musicNextTrack(false)" title="Sonraki">⏭</button>' +
      '<button class="music-ctrl-btn" style="'+repeatStyle+';position:relative" onclick="cycleMusicRepeat()" title="'+repeatTitle+'">'+repeatIcon+'<span style="position:absolute;top:-4px;right:-4px;font-size:8px;font-weight:800;background:var(--green);color:#fff;border-radius:6px;padding:0 3px;line-height:13px;display:'+(musicRepeat>0?'block':'none')+'">'+(musicRepeat===2?'2':'1')+'</span></button>' +
    '</div>' +
    '<div class="music-progress-wrap" id="musicProgressWrap" style="display:'+(musicIsPlaying||ytMusicTrackIndex>=0?'flex':'none')+'">' +
      '<div class="music-progress-bar" id="musicProgressBar" onmousedown="musicSeekStart(event)" ontouchstart="musicSeekTouchStart(event)">' +
        '<div class="music-progress-fill" id="musicProgressFill" style="width:'+((_musicDuration>0)?Math.min(100,(_musicCurrentTime/_musicDuration)*100).toFixed(1):0)+'%"></div>' +
        '<div class="music-progress-thumb" id="musicProgressThumb" style="left:'+((_musicDuration>0)?Math.min(100,(_musicCurrentTime/_musicDuration)*100).toFixed(1):0)+'%"></div>' +
      '</div>' +
      '<div class="music-progress-times">' +
        '<span id="musicProgressCur">'+formatMusicTime(_musicCurrentTime)+'</span>' +
        '<span id="musicProgressDur">'+formatMusicTime(_musicDuration)+'</span>' +
      '</div>' +
    '</div>';

  var trkHtml = '';
  if(ytMusicTracks.length>0){
    /* Arama filtresi */
    var q = _musicSearchQuery.trim().toLowerCase();
    var filtered = q
      ? ytMusicTracks.map(function(t,i){ return {t:t,i:i}; }).filter(function(x){ return x.t.title.toLowerCase().indexOf(q)!==-1 || (x.t.channel||'').toLowerCase().indexOf(q)!==-1; })
      : ytMusicTracks.map(function(t,i){ return {t:t,i:i}; });

    var clearBtn = _musicSearchQuery ? '<button class=\"music-search-clear\" onclick=\"_clearMusicSearch()\" title=\"Temizle\">✕</button>' : '';
    var searchHtml =
      '<div class=\"music-search-wrap\">' +
        '<input class=\"music-search-input\" id=\"musicSearchInput\" type=\"text\" placeholder=\"Şarkı ara...\" value=\"'+escapeHtml(_musicSearchQuery)+'\" oninput=\"_onMusicSearch(this.value)\">' +
        clearBtn +
      '</div>';

    if(filtered.length===0){
      trkHtml = searchHtml + '<div class=\"music-status-text\" style=\"font-size:10px;padding:4px 2px\">Sonuç bulunamadı.</div>';
    } else {
      trkHtml = searchHtml + '<div class=\"music-track-list\">';
      filtered.forEach(function(item){
        var t = item.t; var i = item.i;
        var active = (i===ytMusicTrackIndex);
        trkHtml += '<div class=\"music-track-item'+(active?' active':'')+'\" onclick=\"playYTMusicTrack('+i+')\">' +
          '<span class=\"music-track-num\">'+(i+1)+'</span>' +
          '<span class=\"music-track-play-icon\">▶</span>' +
          '<div class=\"music-track-info\">' +
            '<div class=\"music-track-name\">'+escapeHtml(t.title)+'</div>' +
            '<div class=\"music-track-artist\">'+escapeHtml(t.channel||'')+'</div>' +
          '</div>' +
        '</div>';
      });
      trkHtml += '</div>';
      if(q) trkHtml += '<div style=\"font-size:9px;color:var(--muted);padding:3px 2px;font-family:\'JetBrains Mono\',monospace;\">'+filtered.length+' / '+ytMusicTracks.length+' şarkı</div>';
    }
  } else if(ytMusicActivePlId){
    trkHtml = '<div class=\"music-status-text\">⏳ Parçalar yükleniyor...</div>';
  }

  var bottomHtml =
    '<button class=\"music-sync-btn\" onclick=\"syncYTMusicPlaylist()\">↺ Güncelle</button>' +
    '<button class=\"music-logout-btn\" onclick=\"signOutGoogleMusic()\">🔓 Google Çıkış Yap</button>';

  c.innerHTML = plSel + nowHtml + ctrlHtml + trkHtml + bottomHtml;

  /* Focus koru */
  if(_musicSearchQuery){
    var inp = document.getElementById('musicSearchInput');
    if(inp){ inp.focus(); var len = inp.value.length; inp.setSelectionRange(len,len); }
  }

  if(ytMusicPlaylists.length===0) fetchYTMusicPlaylists();
}

function _onMusicSearch(val){
  _musicSearchQuery = val;
  renderMusicContent();
}
function _clearMusicSearch(){
  _musicSearchQuery = '';
  renderMusicContent();
  var inp = document.getElementById('musicSearchInput');
  if(inp) inp.focus();
}

function updateMusicPlayBtn(){
  var btn = document.getElementById('musicPlayBtn');
  if(btn) btn.textContent = musicIsPlaying ? '⏸' : '▶';
  updateMusicPanelTag();
}

/* ═══ GOOGLE SIGN IN FOR MUSIC ═══ */
function signInGoogleForMusic(){
  if(!_ytTokenClient){
    if(!window.google||!window.google.accounts){ showToast('❌ Google API yüklenemedi, sayfayı yenile.'); return; }
    initGoogleAuth();
    /* initGoogleAuth calls tryMusicSilentLogin if email hint exists — but user clicked, so force popup after a tick */
    setTimeout(function(){
      if(!_ytAccessToken && _ytTokenClient) _ytTokenClient.requestAccessToken({prompt:'select_account'});
    }, 200);
    return;
  }
  /* User explicitly clicked — always show account picker */
  _ytTokenClient.requestAccessToken({prompt:'select_account'});
}

/* Silent auto-login: only works if Google session cookie still valid */
function tryMusicSilentLogin(){
  if(_ytAccessToken || !_musicLastEmail) return;
  if(!window.google || !window.google.accounts) return;
  if(!_ytTokenClient) { initGoogleAuth(); return; } /* initGoogleAuth will do the silent attempt */
  try{ _ytTokenClient.requestAccessToken({prompt:'none', hint:_musicLastEmail}); }catch(e){}
}

function signOutGoogleMusic(){
  try{ if(_ytAccessToken) google.accounts.oauth2.revoke(_ytAccessToken, function(){}); }catch(e){}
  _ytAccessToken = null;
  _musicLastEmail = '';
  localStorage.removeItem('aha_music_email');
  updateGoogleAuthUI(false);
  musicStop();
  ytMusicPlaylists = [];
  ytMusicTracks = [];
  ytMusicTrackIndex = -1;
  ytMusicActivePlId = null;
  saveMusicState();
  renderMusicContent();
  showToast('Google hesabından çıkış yapıldı.');
}

/* ═══ YOUTUBE MUSIC DATA ═══ */
function fetchYTMusicPlaylists(){
  if(!_ytAccessToken) return;
  fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50',{
    headers:{'Authorization':'Bearer '+_ytAccessToken}
  }).then(function(r){ return r.json(); }).then(function(d){
    if(d.error){ showToast('❌ YT Playlist: '+d.error.message); return; }
    ytMusicPlaylists = (d.items||[]).map(function(pl){
      return { id:pl.id, name:pl.snippet&&pl.snippet.title?pl.snippet.title:pl.id, itemCount:pl.contentDetails?pl.contentDetails.itemCount||0:0 };
    });
    saveMusicState();
    renderMusicContent();
  }).catch(function(){ showToast('❌ Playlistler çekilemedi.'); });
}

function fetchYTMusicTracks(plId){
  if(!_ytAccessToken){ showToast('❌ Google girişi gerekli.'); return; }
  var tracks = [];
  function fetchPage(pageToken){
    var url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId='+encodeURIComponent(plId)+'&maxResults=50' + (pageToken?'&pageToken='+encodeURIComponent(pageToken):'');
    fetch(url, { headers:{'Authorization':'Bearer '+_ytAccessToken} })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if(d.error){ showToast('❌ Parçalar çekilemedi.'); return; }
        (d.items||[]).forEach(function(it){
          var sn = it.snippet;
          if(!sn||!sn.resourceId||!sn.resourceId.videoId) return;
          var title = sn.title||sn.resourceId.videoId;
          if(title==='Deleted video'||title==='Private video') return;
          tracks.push({ id:sn.resourceId.videoId, title:title, channel:sn.videoOwnerChannelTitle||'' });
        });
        if(d.nextPageToken && tracks.length<500){
          fetchPage(d.nextPageToken);
        } else {
          ytMusicTracks = tracks;
          ytMusicTrackIndex = -1;
          musicShuffleOrder = [];
          musicShufflePos = -1;
          saveMusicState();
          renderMusicContent();
        }
      }).catch(function(){ showToast('❌ Parçalar çekilemedi.'); });
  }
  fetchPage(null);
}

function onYTMusicPlChange(plId){
  ytMusicActivePlId = plId;
  ytMusicTracks = [];
  ytMusicTrackIndex = -1;
  _musicSearchQuery = '';
  musicStop();
  saveMusicState();
  renderMusicContent();
  if(plId) fetchYTMusicTracks(plId);
}

function syncYTMusicPlaylist(){
  if(!ytMusicActivePlId){ showToast('❌ Playlist seçin.'); return; }
  showToast('⏳ Güncelleniyor...');
  fetchYTMusicTracks(ytMusicActivePlId);
}

/* ═══ MUSIC IFRAME ENGINE ═══ */
function getMusicIframe(){
  var existing = document.getElementById('musicYtIframe');
  if(existing) return existing;
  var f = document.createElement('iframe');
  f.id = 'musicYtIframe';
  f.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.001;pointer-events:none;border:none;z-index:-1';
  f.allow = 'autoplay; encrypted-media';
  document.body.appendChild(f);

  /* Route messages from music iframe */
  window.addEventListener('message', function(e){
    var mf = document.getElementById('musicYtIframe');
    if(!mf || e.source !== mf.contentWindow) return;
    if(!e.data) return;
    var data;
    try{ data = typeof e.data==='string' ? JSON.parse(e.data) : e.data; }catch(err){ return; }
    var newState = null;
    if(data.event==='infoDelivery' && data.info && data.info.playerState !== undefined){
      newState = data.info.playerState;
    }
    if(data.event==='infoDelivery' && data.info){
      var info = data.info;
      var ct = info.currentTime;
      var dur = info.duration;
      /* Accept numeric values only */
      if(typeof ct === 'number' && ct >= 0) _musicCurrentTime = ct;
      if(typeof dur === 'number' && dur > 0) _musicDuration = dur;
      /* Update bar whenever we have both values */
      if(_musicDuration > 0 && !_musicSeeking){
        _applyProgressUI(_musicCurrentTime, _musicDuration);
      }
    }
    if(data.event==='onStateChange'){ newState = data.info; }
    if(newState !== null && newState !== musicIframeState){
      musicIframeState = newState;
      onMusicIframeStateChange(newState);
    }
  });
  return f;
}

function onMusicIframeStateChange(state){
  /* 0=ended 1=playing 2=paused -1=unstarted 3=buffering 5=cued */
  if(state === 0){
    _stopSmoothProgress();
    if(musicRepeat === 2){
      musicIframeCmd('seekTo', [0, true]);
      setTimeout(function(){ musicIframeCmd('playVideo', []); }, 100);
    } else {
      musicNextTrack(true);
    }
  }
  if(state === 1){
    musicIsPlaying = true;
    updateMusicPlayBtn();
    _startSmoothProgress();
    renderMusicContent();
  }
  if(state === 2 || state === -1 || state === 5){
    if(musicIsPlaying){ musicIsPlaying = false; updateMusicPlayBtn(); }
    _stopSmoothProgress();
  }
}

function musicIframeCmd(func, args){
  var f = getMusicIframe();
  if(!f || !f.contentWindow) return;
  try{
    f.contentWindow.postMessage(JSON.stringify({event:'command', func:func, args:args||[], id:2}), '*');
  }catch(e){}
}

function startMusicIframePoll(){
  if(musicIframePollTimer) clearInterval(musicIframePollTimer);
  musicIframePollTimer = setInterval(function(){
    var f = document.getElementById('musicYtIframe');
    if(!f || !f.contentWindow) return;
    try{
      f.contentWindow.postMessage(JSON.stringify({event:'listening', id:2, channel:'widget'}), '*');
      f.contentWindow.postMessage(JSON.stringify({event:'command', func:'getPlayerState', args:[], id:2}), '*');
      f.contentWindow.postMessage(JSON.stringify({event:'command', func:'getCurrentTime', args:[], id:2}), '*');
      f.contentWindow.postMessage(JSON.stringify({event:'command', func:'getDuration', args:[], id:2}), '*');
    }catch(e){}
  }, 700);
}

function loadMusicTrackInIframe(videoId){
  var f = getMusicIframe();
  var origin = encodeURIComponent(location.origin||'null');
  var src = 'https://www.youtube-nocookie.com/embed/'+videoId+'?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin='+origin+'&playsinline=1&iv_load_policy=3';
  musicIframeVideoId = videoId;
  musicIframeState = -1;
  _musicCurrentTime = 0;
  _musicDuration = 0;
  _stopSmoothProgress();
  /* Reset bar immediately */
  var fill = document.getElementById('musicProgressFill');
  if(fill){ fill.style.transition='none'; fill.style.width='0%'; setTimeout(function(){ if(fill) fill.style.transition='width 0.3s linear'; }, 50); }
  var thumb = document.getElementById('musicProgressThumb');
  if(thumb) thumb.style.left = '0%';
  var curEl = document.getElementById('musicProgressCur');
  if(curEl) curEl.textContent = '0:00';
  f.src = src;
  f.onload = function(){
    startMusicIframePoll();
    musicIsPlaying = true;
    updateMusicPlayBtn();
    _startSmoothProgress();
  };
}

/* ═══ PUBLIC PLAYBACK API ═══ */
function playYTMusicTrack(idx){
  if(idx<0 || idx>=ytMusicTracks.length) return;
  ytMusicTrackIndex = idx;
  var track = ytMusicTracks[idx];
  loadMusicTrackInIframe(track.id);
  showToast('🎵 '+track.title.slice(0,40));
  saveMusicState();
  renderMusicContent();
}

function musicTogglePlay(){
  if(musicIsPlaying){
    musicIframeCmd('pauseVideo', []);
    musicIsPlaying = false;
    musicPausedByVideo = false;
    _stopSmoothProgress();
    updateMusicPlayBtn();
  } else {
    if(ytMusicTrackIndex >= 0 && musicIframeVideoId){
      musicIframeCmd('playVideo', []);
      musicIsPlaying = true;
      _startSmoothProgress();
      updateMusicPlayBtn();
    } else if(ytMusicTracks.length > 0){
      playYTMusicTrack(0);
    }
  }
}

var _musicCurrentTime = 0;
var _musicDuration = 0;
var _musicSmoothTimer = null;  /* Local smooth progress ticker */
var _musicSeeking = false;

function formatMusicTime(sec){
  sec = Math.floor(sec || 0);
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function updateMusicProgressBar(cur, dur){
  if(_musicSeeking) return; /* Don't update while user is dragging */
  _musicCurrentTime = cur;
  if(dur && dur > 0) _musicDuration = dur;
  _applyProgressUI(_musicCurrentTime, _musicDuration);
}

function _applyProgressUI(cur, dur){
  var fill  = document.getElementById('musicProgressFill');
  var thumb = document.getElementById('musicProgressThumb');
  var curEl = document.getElementById('musicProgressCur');
  var durEl = document.getElementById('musicProgressDur');
  var wrap  = document.getElementById('musicProgressWrap');
  if(wrap && (musicIsPlaying || ytMusicTrackIndex >= 0)) wrap.style.display = 'flex';
  var pct = (dur > 0) ? Math.min(100, (cur / dur) * 100) : 0;
  if(fill)  fill.style.width  = pct.toFixed(1) + '%';
  if(thumb) thumb.style.left  = pct.toFixed(1) + '%';
  if(curEl) curEl.textContent = formatMusicTime(cur);
  if(durEl && dur > 0) durEl.textContent = formatMusicTime(dur);
}

/* Smooth local ticker — increments currentTime every second while playing */
function _startSmoothProgress(){
  _stopSmoothProgress();
  _musicSmoothTimer = setInterval(function(){
    if(!musicIsPlaying || _musicSeeking) return;
    _musicCurrentTime = Math.min(_musicCurrentTime + 1, _musicDuration || _musicCurrentTime + 1);
    _applyProgressUI(_musicCurrentTime, _musicDuration);
  }, 1000);
}
function _stopSmoothProgress(){
  if(_musicSmoothTimer){ clearInterval(_musicSmoothTimer); _musicSmoothTimer = null; }
}

/* ─── Seek (click on bar) ─── */
function _calcSeekPos(e, bar){
  var rect = bar.getBoundingClientRect();
  var x = (e.clientX !== undefined ? e.clientX : e.touches[0].clientX) - rect.left;
  return Math.max(0, Math.min(1, x / rect.width));
}

function musicSeekStart(e){
  if(!_musicDuration) return;
  _musicSeeking = true;
  var bar = document.getElementById('musicProgressBar');
  function onMove(ev){ _liveSeekPreview(ev, bar); }
  function onUp(ev){
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    var ratio = _calcSeekPos(ev, bar);
    _commitSeek(ratio * _musicDuration);
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  _liveSeekPreview(e, bar);
}

function musicSeekTouchStart(e){
  if(!_musicDuration) return;
  e.preventDefault();
  _musicSeeking = true;
  var bar = document.getElementById('musicProgressBar');
  function onMove(ev){ _liveSeekPreview(ev, bar); }
  function onEnd(ev){
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    var ratio = _calcSeekPos(ev.changedTouches ? {clientX:ev.changedTouches[0].clientX} : ev, bar);
    _commitSeek(ratio * _musicDuration);
  }
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('touchend', onEnd);
  _liveSeekPreview(e, bar);
}

function _liveSeekPreview(e, bar){
  var ratio = _calcSeekPos(e, bar);
  var pct = (ratio * 100).toFixed(1) + '%';
  var fill  = document.getElementById('musicProgressFill');
  var thumb = document.getElementById('musicProgressThumb');
  var curEl = document.getElementById('musicProgressCur');
  if(fill)  fill.style.width = pct;
  if(thumb) thumb.style.left = pct;
  if(curEl) curEl.textContent = formatMusicTime(ratio * _musicDuration);
}

function _commitSeek(sec){
  _musicCurrentTime = sec;
  musicIframeCmd('seekTo', [sec, true]);
  setTimeout(function(){
    _musicSeeking = false;
    _applyProgressUI(_musicCurrentTime, _musicDuration);
  }, 300);
}

/* ─── Ad skip ─── */

function musicStop(){
  if(musicIframePollTimer){ clearInterval(musicIframePollTimer); musicIframePollTimer = null; }
  _stopSmoothProgress();
  var f = document.getElementById('musicYtIframe');
  if(f){
    try{ musicIframeCmd('stopVideo', []); }catch(e){}
    setTimeout(function(){ if(f.src!=='about:blank') f.src='about:blank'; }, 200);
  }
  musicIframeState = -1;
  musicIsPlaying = false;
  musicIframeVideoId = null;
  _musicCurrentTime = 0;
  _musicDuration = 0;
  var fill = document.getElementById('musicProgressFill');
  if(fill){ fill.style.width='0%'; fill.style.transition='none'; }
  var thumb = document.getElementById('musicProgressThumb');
  if(thumb) thumb.style.left='0%';
  var curEl = document.getElementById('musicProgressCur');
  if(curEl) curEl.textContent = '0:00';
  var durEl = document.getElementById('musicProgressDur');
  if(durEl) durEl.textContent = '0:00';
  updateMusicPlayBtn();
}

function musicPrevTrack(){
  if(ytMusicTracks.length === 0) return;
  if(musicShuffle){
    if(musicShufflePos > 0){
      musicShufflePos--;
      playYTMusicTrack(musicShuffleOrder[musicShufflePos]);
    }
  } else {
    var prev = ytMusicTrackIndex - 1;
    if(prev < 0){ if(musicRepeat === 1) prev = ytMusicTracks.length - 1; else return; }
    playYTMusicTrack(prev);
  }
}

function musicNextTrack(auto){
  if(ytMusicTracks.length === 0) return;
  if(musicShuffle){
    if(musicShuffleOrder.length !== ytMusicTracks.length){
      var arr = [];
      for(var i=0;i<ytMusicTracks.length;i++) arr.push(i);
      for(var j=arr.length-1;j>0;j--){
        var k=Math.floor(Math.random()*(j+1));
        var tmp=arr[j]; arr[j]=arr[k]; arr[k]=tmp;
      }
      musicShuffleOrder = arr;
      musicShufflePos = -1;
    }
    musicShufflePos++;
    if(musicShufflePos >= musicShuffleOrder.length){
      if(musicRepeat===1){ musicShuffleOrder=[]; musicShufflePos=-1; musicNextTrack(auto); return; }
      else{ musicStop(); return; }
    }
    playYTMusicTrack(musicShuffleOrder[musicShufflePos]);
  } else {
    var next = ytMusicTrackIndex + 1;
    if(next >= ytMusicTracks.length){
      if(musicRepeat===1) next=0; else { musicStop(); return; }
    }
    playYTMusicTrack(next);
  }
}

function toggleMusicShuffle(){
  musicShuffle = !musicShuffle;
  musicShuffleOrder = [];
  musicShufflePos = -1;
  saveMusicState();
  renderMusicContent();
  showToast(musicShuffle ? '🔀 Karışık çalma açık' : '↔ Karışık çalma kapalı');
}

function cycleMusicRepeat(){
  musicRepeat = (musicRepeat + 1) % 3;
  saveMusicState();
  renderMusicContent();
  var msgs = ['↩ Tekrar kapalı', '🔁 Liste tekrar', '🔂 Şarkı tekrar'];
  showToast(msgs[musicRepeat]);
}

/* ═══ VIDEO ↔ MUSIC BRIDGE ═══ */
function onMainVideoStart(){
  if(musicIsPlaying && !musicPausedByVideo){
    musicPausedByVideo = true;
    musicIframeCmd('pauseVideo', []);
    musicIsPlaying = false;
    _stopSmoothProgress();
    updateMusicPlayBtn();
  }
}
function onMainVideoStop(){
  if(musicPausedByVideo){
    musicPausedByVideo = false;
    musicIframeCmd('playVideo', []);
    musicIsPlaying = true;
    _startSmoothProgress();
    updateMusicPlayBtn();
  }
}

/* ─── Legacy compat stubs ─── */
function clearSpotifyData(){}
function openSpotifySetup(){}
function closeSpotifySetup(){}


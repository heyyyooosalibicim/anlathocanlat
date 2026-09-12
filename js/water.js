/* ══════════════════════════════════════════════════════════════════════
   SU TAKİBİ (Water Tracking)
   ══════════════════════════════════════════════════════════════════════
   Ayarlar > 💧 Su Takibi'den açılıp kapatılabilen, üst barda AI butonunun
   HEMEN SOLUNDA yer alan opsiyonel bir widget. core.js'teki Vibes panelinin
   AYNI "topbar butonu + fixed-position dropdown" desenini kullanır (bkz.
   core.js → VIBES PANEL DROPDOWN).

   VERİ MODELİ — "İZ BIRAKMAYAN GÜNLÜK VERİ":
   aha_water_v1 = { date, goalMl, unitMl, logs:[{ml, ts}, ...] }
   Her gece yarısı (veya widget bir sonraki açılışında) `date` bugünle
   eşleşmiyorsa `logs` SIFIRLANIR — ÖNCEKİ GÜNLERİN KAYITLARI HİÇBİR YERDE
   TUTULMAZ, arşivlenmez (bkz. features.js → BİRLEŞİK GÜNLÜK ARŞİV — su
   takibi BİLEREK o sistemin DIŞINDA tutulur, çünkü istenen davranış "sadece
   o günlük iş görsün" idi). SADECE goalMl/unitMl (hedef ve ölçek tercihi)
   bir sonraki güne taşınır — bunlar "günlük veri" değil kullanıcı tercihidir.

   aha_water_enabled_v1 = '0' | '1' — widget'ın üst barda görünüp
   görünmeyeceği. Anahtar HİÇ YOKSA (ilk kurulum) varsayılan KAPALIdır.

   Bu modül core.js'den SONRA yüklenir (getTodayStr/showToast/pad/_panels/
   _activePanel gibi global'lere ihtiyaç duyar) ama features.js/deneme.js/
   ai.js'e hiç bağımlı DEĞİLDİR — tamamen bağımsız, kaldırılabilir bir
   modüldür (deneme.js'in "tek dosya, tek script tag" felsefesiyle aynı).
   ══════════════════════════════════════════════════════════════════════ */

var LS_WATER_ENABLED = 'aha_water_enabled_v1';
var LS_WATER_DATA    = 'aha_water_v1';

var waterEnabled = false;
var waterData = null; // {date, goalMl, unitMl, logs:[{ml,ts}]}

function _waterDefaultData(dateStr){
  return { date: dateStr, goalMl: 2000, unitMl: 500, logs: [] };
}

function loadWaterEnabled(){
  try{ waterEnabled = localStorage.getItem(LS_WATER_ENABLED) === '1'; }
  catch(e){ waterEnabled = false; }
}

/* Her çağrıldığında güncel tarihi kontrol eder — widget gece yarısını
   aşıp AÇIK kalmış olsa bile (veya bilgisayar uyuyup uyanmış olsa bile) bir
   sonraki render'da otomatik kendini düzeltir. Bkz. dosya başındaki not:
   SADECE logs sıfırlanır, goalMl/unitMl KORUNUR. */
function loadWaterData(){
  var today = getTodayStr();
  try{
    var raw = localStorage.getItem(LS_WATER_DATA);
    waterData = raw ? JSON.parse(raw) : null;
  }catch(e){ waterData = null; }

  if(!waterData || typeof waterData !== 'object'){
    waterData = _waterDefaultData(today);
  } else if(waterData.date !== today){
    waterData = { date: today, goalMl: waterData.goalMl || 2000, unitMl: waterData.unitMl || 500, logs: [] };
  }
  if(!Array.isArray(waterData.logs)) waterData.logs = [];
  if(!waterData.goalMl || waterData.goalMl <= 0) waterData.goalMl = 2000;
  if(!waterData.unitMl || waterData.unitMl <= 0) waterData.unitMl = 500;
  saveWaterData();
}

function saveWaterData(){
  try{ localStorage.setItem(LS_WATER_DATA, JSON.stringify(waterData)); }catch(e){}
}

function _waterTotalMl(){
  return waterData.logs.reduce(function(a,l){ return a + (l.ml||0); }, 0);
}

/* ══════════ KAYIT EKLE/SİL ══════════ */
function waterAddLog(ml){
  ml = Math.round(Number(ml));
  if(!ml || ml <= 0 || isNaN(ml)) return;
  var beforeTotal = _waterTotalMl();
  waterData.logs.push({ ml: ml, ts: Date.now() });
  saveWaterData();
  renderWaterWidget();
  var afterTotal = beforeTotal + ml;
  if(afterTotal >= waterData.goalMl && beforeTotal < waterData.goalMl){
    showToast('💧 Harika! Günlük su hedefine ulaştın (' + afterTotal + ' ml)');
  } else {
    showToast('💧 Eklendi: ' + ml + ' ml');
  }
}
function waterQuickAdd(){
  waterAddLog(waterData.unitMl);
}
function waterManualAdd(){
  var inp = document.getElementById('waterManualInput');
  if(!inp) return;
  var v = parseInt(inp.value, 10);
  if(!v || v <= 0){ inp.focus(); return; }
  waterAddLog(v);
  inp.value = '';
}
function waterRemoveLog(idx){
  waterData.logs.splice(idx, 1);
  saveWaterData();
  renderWaterWidget();
}

/* ══════════ HEDEF & ÖLÇEK AYARLARI (widget içi mini form) ══════════ */
function toggleWaterSettingsForm(){
  var form = document.getElementById('waterSettingsForm');
  if(!form) return;
  form.style.display = (form.style.display === 'none' || !form.style.display) ? 'block' : 'none';
}
function waterSaveGoalSettings(){
  var goalInp = document.getElementById('waterGoalInput');
  var unitInp = document.getElementById('waterUnitInput');
  var goal = goalInp ? parseInt(goalInp.value, 10) : waterData.goalMl;
  var unit = unitInp ? parseInt(unitInp.value, 10) : waterData.unitMl;
  if(goal && goal > 0) waterData.goalMl = goal;
  if(unit && unit > 0) waterData.unitMl = unit;
  saveWaterData();
  renderWaterWidget();
  showToast('💧 Su takibi ayarları kaydedildi.');
}

/* ══════════ RENDER ══════════ */
function renderWaterWidget(){
  loadWaterData(); // her render'da tarih kontrolü — bkz. loadWaterData() notu
  var total = _waterTotalMl();
  var pct = waterData.goalMl > 0 ? Math.min(100, Math.round((total / waterData.goalMl) * 100)) : 0;

  var fill = document.getElementById('waterProgressFill');
  if(fill) fill.style.width = pct + '%';
  var pctLabel = document.getElementById('waterProgressPct');
  if(pctLabel) pctLabel.textContent = pct + '%';
  var totalLabel = document.getElementById('waterTotalLabel');
  if(totalLabel) totalLabel.textContent = total + ' ml / ' + waterData.goalMl + ' ml';

  var quickBtn = document.getElementById('waterQuickAddBtn');
  if(quickBtn) quickBtn.textContent = '+' + waterData.unitMl + ' ml';

  var goalInp = document.getElementById('waterGoalInput');
  if(goalInp && document.activeElement !== goalInp) goalInp.value = waterData.goalMl;
  var unitInp = document.getElementById('waterUnitInput');
  if(unitInp && document.activeElement !== unitInp) unitInp.value = waterData.unitMl;

  var listEl = document.getElementById('waterLogList');
  if(listEl){
    if(waterData.logs.length === 0){
      listEl.innerHTML = '<div class="water-log-empty">Henüz su eklenmedi bugün 💧</div>';
    } else {
      var indexed = waterData.logs.map(function(l, i){ return { l: l, i: i }; });
      indexed.sort(function(a,b){ return b.l.ts - a.l.ts; }); // en yeni üstte
      listEl.innerHTML = indexed.map(function(entry){
        var l = entry.l, i = entry.i;
        var d = new Date(l.ts);
        var hh = pad(d.getHours()), mm = pad(d.getMinutes());
        return '<div class="water-log-row">' +
          '<span class="water-log-time">' + hh + ':' + mm + '</span>' +
          '<span class="water-log-amount">' + l.ml + ' ml</span>' +
          '<button class="water-log-del" onclick="waterRemoveLog(' + i + ')" title="Kaldır">✕</button>' +
        '</div>';
      }).join('');
    }
  }
  var countLabel = document.getElementById('waterCountLabel');
  if(countLabel) countLabel.textContent = waterData.logs.length > 0 ? ('Bugün ' + waterData.logs.length + ' kayıt') : '';

  _updateWaterDot();
}
function _updateWaterDot(){
  var dot = document.getElementById('waterActiveDot');
  if(!dot) return;
  dot.style.display = (waterData && waterData.goalMl > 0 && _waterTotalMl() >= waterData.goalMl) ? 'block' : 'none';
}

/* ══════════ SU TAKİBİ PANELİ (dropdown) — core.js'teki Vibes panelinin
   AYNI "topbar butonu + fixed-position dropdown" deseni ══════════ */
var _waterPanelOpen = false;
function _waterOpenRaw(){
  var panel = document.getElementById('waterDropdown');
  if(!panel) return;
  _waterPanelOpen = true;
  panel.style.display = 'block';
  var btn = document.getElementById('waterBtn');
  if(btn){
    var rect = btn.getBoundingClientRect();
    panel.style.right = (window.innerWidth - rect.right) + 'px';
    panel.style.top   = (rect.bottom + 4) + 'px';
    panel.style.left  = 'auto';
  }
  renderWaterWidget();
  setTimeout(function(){
    document.addEventListener('mousedown', _waterOutsideClose);
  }, 10);
}
function _waterCloseRaw(){
  var panel = document.getElementById('waterDropdown');
  if(panel) panel.style.display = 'none';
  document.removeEventListener('mousedown', _waterOutsideClose);
  _waterPanelOpen = false;
}
function toggleWaterPanel(){
  if(_waterPanelOpen){
    _waterCloseRaw();
  } else {
    /* Tam ekran panelleri (Settings/Calendar/AI/Notes) ve Vibes dropdown'ını kapat */
    if(typeof _activePanel !== 'undefined' && _activePanel){ _panels[_activePanel].close(); _activePanel = null; }
    if(typeof _vibesPanelOpen !== 'undefined' && _vibesPanelOpen && typeof _vibesCloseRaw === 'function') _vibesCloseRaw();
    _waterOpenRaw();
  }
}
function _waterOutsideClose(e){
  var panel = document.getElementById('waterDropdown');
  var btn   = document.getElementById('waterBtn');
  if(panel && !panel.contains(e.target) && btn && !btn.contains(e.target)){
    _waterCloseRaw();
  }
}
/* Vibes paneli açılırken su takibi panelini de kapat (karşılıklı dışlama).
   core.js'in kendi startWhiteNoise/stopWhiteNoise patch tekniğiyle AYNI
   yöntem: orijinal fonksiyonu sarmalayıp üzerine yaz. */
if(typeof toggleVibesPanel === 'function'){
  var _origToggleVibesPanelForWater = toggleVibesPanel;
  toggleVibesPanel = function(){
    if(typeof _vibesPanelOpen !== 'undefined' && !_vibesPanelOpen && _waterPanelOpen) _waterCloseRaw();
    _origToggleVibesPanelForWater();
  };
}

/* ══════════ AYARLARDAN AÇ/KAPAT ══════════ */
function _applyWaterVisibility(){
  var btn = document.getElementById('waterBtn');
  if(btn) btn.style.display = waterEnabled ? 'flex' : 'none';
  if(!waterEnabled) _waterCloseRaw();
}
function toggleWaterFeatureFromSettings(){
  waterEnabled = !waterEnabled;
  try{ localStorage.setItem(LS_WATER_ENABLED, waterEnabled ? '1' : '0'); }catch(e){}
  _updateSettingsWaterToggle();
  _applyWaterVisibility();
}
function _updateSettingsWaterToggle(){
  var tog = document.getElementById('settingsWaterToggle');
  if(tog) tog.classList.toggle('on', waterEnabled);
}

/* ══════════ GECE YARISI TAKİBİ (bağımsız, hafif) ══════════
   features.js'teki scheduleMidnightCheck() ile BİREBİR AYNI zamanlama
   tekniği (tam gece yarısı + 50ms tampon, kendini yeniden zamanlar) — ama
   TAMAMEN BAĞIMSIZ çalışır, ana arşiv sistemine hiç dokunmaz. Ayrıca
   loadWaterData()'nın HER render'da tarih kontrolü yapması sayesinde
   (bkz. yukarısı) bilgisayar uykuda geçen bir gece yarısını kaçırsa bile
   widget bir sonraki açılışta kendini otomatik düzeltir — bu sadece bir
   ek güvenlik katmanı (widget AÇIK bırakılmışsa anında güncellensin diye). */
function _waterScheduleMidnightCheck(){
  var now = new Date();
  var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 0, 0);
  var msUntilMidnight = tomorrow.getTime() - now.getTime();
  setTimeout(function(){
    loadWaterData();
    if(_waterPanelOpen) renderWaterWidget();
    _waterScheduleMidnightCheck();
  }, msUntilMidnight + 50);
}

/* ══════════ INIT ══════════
   notes.js'deki gibi: script </body> sonunda yüklenir, DOM zaten hazırdır —
   DOMContentLoaded beklemeye gerek yok. */
function initWaterTracking(){
  loadWaterEnabled();
  loadWaterData();
  _applyWaterVisibility();
  _updateSettingsWaterToggle();
  _waterScheduleMidnightCheck();
}
initWaterTracking();

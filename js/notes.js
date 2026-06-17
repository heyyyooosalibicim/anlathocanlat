/* ════════════════════════════════════════════════════════════
   NOTLAR — Notion-tarzı ders çalışma defteri
   - Sınırsız not sayfası (liste + tam ekran zengin metin editörü)
   - Playlist videosu / zaman damgası notu / flashcard / fotoğraf / pdf gömme
   - Tüm video + flashcard sistemiyle senkron çalışır
   - Veri: localStorage (aha_notes_v1) — playlists/flashcards verisinden bağımsız
   ════════════════════════════════════════════════════════════ */

var LS_NOTES = 'aha_notes_v1';
var notePages = [];          // [{id,title,html,createdAt,updatedAt}]
var currentNotePageId = null;
var _noteSaveTimer = null;
var _noteColorTarget = null; // 'text' | 'hilite' — hangi butona basıldı
var noteFcMiniDeckRef = null; // mini viewer: tek kartlık sahte deste

var NOTE_TEXT_COLORS = ['#e2e2e9','#ff6b6b','#ff9800','#f5c842','#4ae176','#3b82f6','#a78bfa','#f06292','#4fc3f7','#ffffff','#9e9e9e','#1a1d2e'];
var NOTE_HILITE_COLORS = ['transparent','#fff3a3','#b7f5c4','#aee2ff','#ffd1a8','#e3c6ff','#ffb3c1'];

/* ══════════ STORAGE ══════════ */
function loadNotes(){
  try{
    var raw = localStorage.getItem(LS_NOTES);
    notePages = raw ? (JSON.parse(raw)||[]) : [];
  }catch(e){ notePages = []; }
  notePages.forEach(function(p){
    if(!p.id) p.id = uid();
    if(typeof p.html !== 'string') p.html = '';
    if(!p.title) p.title = '';
    if(!p.createdAt) p.createdAt = Date.now();
    if(!p.updatedAt) p.updatedAt = p.createdAt;
  });
}
function saveNotes(){
  try{ localStorage.setItem(LS_NOTES, JSON.stringify(notePages)); }catch(e){
    showToast('❌ Not kaydedilemedi (depolama alanı dolu olabilir).');
  }
}

/* ══════════ PANEL OPEN/CLOSE HOOKS (core.js _panels tarafından çağrılır) ══════════ */
function onOpenNotesPanel(){
  loadNotes();
  showNotesListView();
}
function onCloseNotesPanel(){
  if(currentNotePageId) flushCurrentNoteSave(true);
}

/* ══════════ LIST <-> EDITOR VIEW SWITCH ══════════ */
function showNotesListView(){
  if(currentNotePageId) flushCurrentNoteSave(true);
  _clearPendingNoteStyle();
  currentNotePageId = null;
  document.getElementById('notesFsListView').classList.add('active');
  document.getElementById('notesFsEditorView').classList.remove('active');
  renderNotesList();
}
function backToNotesList(){ showNotesListView(); }

function createNewNotePage(){
  var page = { id: uid(), title: '', html: '', createdAt: Date.now(), updatedAt: Date.now() };
  notePages.unshift(page);
  saveNotes();
  openNotePage(page.id);
}

function openNotePage(pageId){
  var page = notePages.find(function(p){ return p.id === pageId; });
  if(!page) return;
  _clearPendingNoteStyle();
  currentNotePageId = pageId;
  document.getElementById('notesFsListView').classList.remove('active');
  document.getElementById('notesFsEditorView').classList.add('active');
  document.getElementById('noteEditorTitleInput').value = page.title || '';
  var content = document.getElementById('noteEditorContent');
  content.innerHTML = page.html || '';
  document.getElementById('noteEditorSaveState').textContent = 'Kaydedildi';
  document.getElementById('noteEditorSaveState').classList.remove('saving');
  setTimeout(function(){ document.getElementById('noteEditorTitleInput').focus(); }, 60);
}

function deleteNotePage(pageId, e){
  if(e) e.stopPropagation();
  if(!confirm('Bu not kalıcı olarak silinsin mi?')) return;
  notePages = notePages.filter(function(p){ return p.id !== pageId; });
  saveNotes();
  renderNotesList();
}

/* ══════════ RENDER: LIST VIEW (grid of note cards) ══════════ */
function stripHtmlForPreview(html){
  var div = document.createElement('div');
  div.innerHTML = html || '';
  div.querySelectorAll('.note-block').forEach(function(b){ b.remove(); }); // gömülü bloklar metne karışmasın
  return (div.textContent || '').replace(/\s+/g,' ').trim();
}
function countNoteBlocks(html, cls){
  var div = document.createElement('div');
  div.innerHTML = html || '';
  return div.querySelectorAll('.'+cls).length;
}
function renderNotesList(){
  var grid = document.getElementById('notesFsGrid');
  var q = (document.getElementById('notesFsSearchInput').value || '').trim().toLowerCase();
  var list = notePages.slice().sort(function(a,b){ return b.updatedAt - a.updatedAt; });
  if(q){
    list = list.filter(function(p){
      var hay = (p.title||'').toLowerCase() + ' ' + stripHtmlForPreview(p.html).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  grid.innerHTML = '';
  if(list.length === 0){
    grid.innerHTML = '<div class="notes-fs-empty">'+(q ? '🔍 Arama sonucu bulunamadı.' : '📝 Henüz not yok.<br>Sağ üstten "Yeni Not" ile ilk not defterini oluştur.')+'</div>';
    return;
  }
  list.forEach(function(p){
    var preview = stripHtmlForPreview(p.html);
    var vidCount = countNoteBlocks(p.html,'note-block-video');
    var tsCount = countNoteBlocks(p.html,'note-block-ts');
    var fcCount = countNoteBlocks(p.html,'note-block-fc');
    var card = document.createElement('div');
    card.className = 'note-card';
    var badges = '';
    if(vidCount) badges += '<span class="note-card-badge">🎬 '+vidCount+'</span>';
    if(tsCount) badges += '<span class="note-card-badge">⏱ '+tsCount+'</span>';
    if(fcCount) badges += '<span class="note-card-badge">🎴 '+fcCount+'</span>';
    card.innerHTML =
      '<div class="note-card-title">'+escapeHtml(p.title || 'Başlıksız Not')+'</div>'+
      '<div class="note-card-preview">'+(preview ? escapeHtml(preview) : '<span style="opacity:0.5">Boş not...</span>')+'</div>'+
      '<div class="note-card-footer"><span>'+formatNoteDate(p.updatedAt)+'</span><div class="note-card-badges">'+badges+'</div></div>'+
      '<button class="note-card-del" title="Sil">✕</button>';
    card.addEventListener('click', function(e){
      if(e.target.classList.contains('note-card-del')) return;
      openNotePage(p.id);
    });
    card.querySelector('.note-card-del').addEventListener('click', function(e){ deleteNotePage(p.id, e); });
    grid.appendChild(card);
  });
}
function formatNoteDate(ts){
  var d = new Date(ts);
  var now = new Date();
  var sameDay = d.toDateString() === now.toDateString();
  if(sameDay) return pad(d.getHours())+':'+pad(d.getMinutes());
  return pad(d.getDate())+'.'+pad(d.getMonth()+1)+'.'+d.getFullYear();
}

/* ══════════ EDITOR: TITLE + AUTOSAVE ══════════ */
function onNoteTitleInput(){ scheduleNoteSave(); }
function scheduleNoteSave(){
  var stateEl = document.getElementById('noteEditorSaveState');
  stateEl.textContent = 'Kaydediliyor...'; stateEl.classList.add('saving');
  if(_noteSaveTimer) clearTimeout(_noteSaveTimer);
  _noteSaveTimer = setTimeout(function(){ flushCurrentNoteSave(false); }, 500);
}
function flushCurrentNoteSave(immediate){
  if(_noteSaveTimer){ clearTimeout(_noteSaveTimer); _noteSaveTimer = null; }
  if(!currentNotePageId) return;
  var page = notePages.find(function(p){ return p.id === currentNotePageId; });
  if(!page) return;
  page.title = document.getElementById('noteEditorTitleInput').value.trim();
  page.html = document.getElementById('noteEditorContent').innerHTML;
  page.updatedAt = Date.now();
  saveNotes();
  var stateEl = document.getElementById('noteEditorSaveState');
  if(stateEl){ stateEl.textContent = 'Kaydedildi'; stateEl.classList.remove('saving'); }
}

/* Editor content değişimini dinle (yazı, blok ekleme, vs.)
   NOT: notes.js diğer scriptler gibi </body> sonunda yüklenir, DOM zaten hazırdır —
   bu yüzden DOMContentLoaded beklemek yerine doğrudan kur. */
function _initNotesEditorListeners(){
  var content = document.getElementById('noteEditorContent');
  if(!content) return;
  // ÖNEMLİ SIRALAMA: pending style'ı DOM'a uygula, SONRA kaydetmeyi planla —
  // aksi halde stil uygulanmadan önceki ham HTML kaydedilebilir.
  content.addEventListener('input', function(e){
    _applyPendingNoteStyleToInput(e);
    scheduleNoteSave();
  });

  // Cursor pozisyonunu her hareket/tıklamada güncelle.
  // Kullanıcı caret'i ELLE başka bir yere taşırsa (tıklama/ok tuşu ile),
  // bekleyen renk/vurgu niyeti artık geçersizdir — yoksa kullanıcı rengi
  // seçtikten uzun süre sonra, alakasız bir yere tıklayıp yazınca o da
  // boyanır, bu da kafa karıştırıcı olur. Sadece input event'i pending'i
  // tüketir/korur; her keyup/mouseup/click sıfırlar.
  function _trackCursor(){ _saveNoteCursor(); _clearPendingNoteStyle(); }
  content.addEventListener('keyup', function(e){
    // Karakter tuşları zaten input event'i tetikler ve orada pending tüketilir;
    // burada keyup'ta temizlemek o akışı bozmaz çünkü input, keydown/keypress
    // sonrası ama keyup'tan ÖNCE tetiklenir. Ok tuşları/Home/End gibi caret
    // hareket tuşlarında ise burada temizlenmesi gerekir.
    _saveNoteCursor();
    if(e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
       e.key === 'Home' || e.key === 'End' || e.key === 'PageUp' || e.key === 'PageDown'){
      _clearPendingNoteStyle();
    }
  });
  content.addEventListener('mouseup', _trackCursor);
  content.addEventListener('click', _trackCursor);

  content.addEventListener('keydown', function(e){
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='b'){ e.preventDefault(); execNoteCmd('bold'); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='i'){ e.preventDefault(); execNoteCmd('italic'); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='u'){ e.preventDefault(); execNoteCmd('underline'); }
  });

  // Windows+V / Ctrl+V ile yapıştırılan görselleri küçük thumbnail olarak ekle
  content.addEventListener('paste', function(e){
    var items = e.clipboardData && e.clipboardData.items;
    if(!items) return;
    for(var i = 0; i < items.length; i++){
      if(items[i].type.indexOf('image') === 0){
        e.preventDefault();
        _saveNoteCursor();
        (function(item){
          var file = item.getAsFile();
          if(!file) return;
          var reader = new FileReader();
          reader.onload = function(ev){
            var src = ev.target.result;
            var html =
              '<div class="note-block-wrap">' +
                '<div class="note-img-wrap" contenteditable="false" onclick="openNoteImgLightbox(this)" title="Büyütmek için tıkla">' +
                  '<img class="note-img-thumb" src="' + src + '" alt="Yapıştırılan görsel">' +
                  '<span class="note-img-zoom-hint"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">zoom_in</span></span>' +
                '</div>' +
                '<button class="note-block-del-btn" title="Kaldır" onclick="removeNoteWrap(this)">✕</button>' +
              '</div>';
            insertNoteBlockHtml(html);
          };
          reader.readAsDataURL(file);
        })(items[i]);
        return;
      }
    }
  });

  // Toolbar butonlarına data-cmd ile genel handler bağla
  document.querySelectorAll('.notes-tb-btn[data-cmd]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var cmd = btn.getAttribute('data-cmd');
      if(cmd.indexOf(':') >= 0){
        var parts = cmd.split(':'); execNoteCmd(parts[0], parts[1]);
      } else {
        execNoteCmd(cmd);
      }
    });
  });
}

/* ══════════ BLOCK DELETE (çarpı butonuyla) ══════════ */
function removeNoteWrap(btn){
  // btn, note-block-wrap içinde contenteditable olmayan kardeş buton
  var wrap = btn.parentNode;
  if(wrap && wrap.classList.contains('note-block-wrap')){
    wrap.remove();
  }
  scheduleNoteSave();
}
function removeNoteBlock(btn, e){
  if(e){ e.stopPropagation(); e.preventDefault(); }
  var block = btn.closest('.note-block, .note-img-wrap, .note-block-wrap');
  if(!block) return;
  block.remove();
  scheduleNoteSave();
}
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', _initNotesEditorListeners);
} else {
  _initNotesEditorListeners();
}
function execNoteCmd(cmd, val){
  document.getElementById('noteEditorContent').focus();
  try{ document.execCommand(cmd, false, val || null); }catch(e){}
  scheduleNoteSave();
}
function applyNoteFontSize(size){ execNoteCmd('fontSize', size); }
function applyNoteFontFamily(fam){ execNoteCmd('fontName', fam); }

function confirmDeleteCurrentNote(){
  document.getElementById('noteDeleteConfirmOverlay').classList.add('open');
}
function closeNoteDeleteConfirm(){
  document.getElementById('noteDeleteConfirmOverlay').classList.remove('open');
}
function executeDeleteCurrentNote(){
  if(!currentNotePageId) return;
  notePages = notePages.filter(function(p){ return p.id !== currentNotePageId; });
  saveNotes();
  closeNoteDeleteConfirm();
  showToast('🗑 Not silindi.');
  showNotesListView();
}

/* ══════════ COLOR POPUP (text / highlight) ══════════ */
var _savedNoteColorRange = null;

/* HTML'deki color butonlarının onmousedown'ında çağrılır.
   Click'ten ÖNCE, focus kaybolmadan selection'ı yakalar. */
function _captureNoteColorSelection(e){
  // Focus'un noteEditorContent'te olup olmadığını kontrol et
  var content = document.getElementById('noteEditorContent');
  var sel = window.getSelection();
  if(sel && sel.rangeCount > 0 && content && content.contains(sel.anchorNode)){
    _savedNoteColorRange = sel.getRangeAt(0).cloneRange();
  } else {
    // Genel cursor kaydından fallback
    _savedNoteColorRange = _savedNoteCursorRange ? _savedNoteCursorRange.cloneRange() : null;
  }
  // Buton tıklamasının editördeki focus'u çalmasını engelle
  if(e) e.preventDefault();
}

function openNoteColorPopup(anchorEl, target){
  _noteColorTarget = target;

  // Eğer mousedown'da yakalanmadıysa şimdi dene (fallback)
  if(!_savedNoteColorRange){
    var content = document.getElementById('noteEditorContent');
    var sel0 = window.getSelection();
    if(sel0 && sel0.rangeCount > 0 && content && content.contains(sel0.anchorNode)){
      _savedNoteColorRange = sel0.getRangeAt(0).cloneRange();
    } else if(_savedNoteCursorRange){
      _savedNoteColorRange = _savedNoteCursorRange.cloneRange();
    }
  }

  var popup = document.getElementById('noteColorPopup');
  var title = document.getElementById('noteColorPopupTitle');
  var swatchWrap = document.getElementById('noteColorSwatches');
  title.textContent = target === 'text' ? 'Yazı Rengi' : 'Vurgu Rengi';
  var colors = target === 'text' ? NOTE_TEXT_COLORS : NOTE_HILITE_COLORS;
  // Kapalı target ve range değerlerini closure'a kilitle
  var lockedTarget = target;
  var lockedRange = _savedNoteColorRange ? _savedNoteColorRange.cloneRange() : null;

  swatchWrap.innerHTML = '';
  colors.forEach(function(c){
    var sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.background = c === 'transparent' ? 'repeating-conic-gradient(#888 0% 25%, #bbb 0% 50%) 50% / 10px 10px' : c;
    sw.title = c;
    // mousedown'da focus kaybını kesinlikle önle
    sw.addEventListener('mousedown', function(e){ e.preventDefault(); e.stopPropagation(); });
    sw.addEventListener('click', function(e){
      e.stopPropagation();
      popup.style.display = 'none';
      document.removeEventListener('click', _noteColorPopupOutsideClick);

      var contentEl = document.getElementById('noteEditorContent');
      // Focus'u editöre ver
      contentEl.focus();

      // Kaydedilen selection'ı geri yükle
      if(lockedRange){
        try{
          var rs = window.getSelection();
          rs.removeAllRanges();
          rs.addRange(lockedRange);
        }catch(ex){}
      }

      // SEÇİLİ METİN var mı yoksa imleç sadece KONUMLANMIŞ mı (collapsed)?
      // Seçili metinde execCommand var olan karakterleri direkt boyar, sorun yok.
      // Collapsed'de (sadece caret) ise execCommand "bundan sonra yazılacak metne
      // uygula" davranışını güvenilir yapmaz. Bunun için _setPendingNoteStyle ile
      // "bir sonraki yazılan karaktere bu stili uygula" niyetini kaydediyoruz;
      // gerçek uygulama input event'inde (_applyPendingNoteStyleToInput) olur —
      // çünkü stili önceden bir DOM node'una koyup caret'i içine sokmaya çalışmak
      // tarayıcının caret normalizasyonu yüzünden güvenilmez çıktı.
      var curSel = window.getSelection();
      var isCollapsed = !curSel || curSel.rangeCount === 0 || curSel.getRangeAt(0).collapsed;

      try{
        if(isCollapsed){
          if(lockedTarget === 'text'){ _setPendingNoteStyle('color', c); }
          else { _setPendingNoteStyle('backgroundColor', c === 'transparent' ? 'transparent' : c); }
        } else if(lockedTarget === 'text'){
          document.execCommand('foreColor', false, c);
        } else {
          var ok = false;
          try{ ok = document.execCommand('hiliteColor', false, c === 'transparent' ? 'transparent' : c); }catch(ex){}
          if(!ok){ try{ document.execCommand('backColor', false, c === 'transparent' ? 'transparent' : c); }catch(ex2){} }
        }
      }catch(e){}

      // Toolbar renk çubuklarını güncelle
      if(lockedTarget === 'text'){
        var bar = document.getElementById('noteTextColorBar');
        if(bar) bar.style.background = c;
      } else {
        var bar2 = document.getElementById('noteHiliteColorBar');
        if(bar2) bar2.style.background = c === 'transparent' ? 'var(--border2)' : c;
      }

      scheduleNoteSave();
    });
    swatchWrap.appendChild(sw);
  });
  var rect = anchorEl.getBoundingClientRect();
  popup.style.display = 'block';
  popup.style.position = 'fixed';
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
  setTimeout(function(){
    document.addEventListener('click', _noteColorPopupOutsideClick);
  }, 10);
}

/* ══════════ PENDING STYLE (caret konumlanmışken renk/vurgu seçimi) ══════════
   PROBLEM: kullanıcı seçili metin olmadan (sadece caret) renk/vurgu seçtiğinde
   "bundan sonra yazılacak metne uygula" gerekiyor. execCommand bunu collapsed
   selection'da güvenilir yapmaz. Önceden denenen "caret'i boş bir style'lı
   span'ın içine koy" yaklaşımı da güvenilmez çıktı: tarayıcılar yazı yazılırken
   caret'i boş inline elementlerden çıkarıp normalize edebiliyor, bu da yeni
   karakterin span'ın DIŞINA, eski stille yazılmasına yol açıyor.

   ÇÖZÜM: "pending style" (bekleyen stil) niyetini kaydet. Kullanıcı bir karakter
   yazdığında input event'i tetiklenir — o anda caret'in TAM ÖNÜNDEKİ karakteri
   (az önce eklenen) bulup onu bir <span style="..."> içine alıyoruz. Bu, DOM'a
   önceden bir şey enjekte etmek zorunda kalmadan, GERÇEKTEN yazılan karaktere
   garanti stil uygulamanın tek güvenilir yoludur. Pending state, kullanıcı bir
   karakter yazana, seçim değiştirene, ya da editörden çıkana kadar geçerlidir. */
var _pendingNoteStyle = null; // {prop: 'color'|'backgroundColor', value: '...'}

function _setPendingNoteStyle(prop, value){
  _pendingNoteStyle = { prop: prop, value: value };
}
function _clearPendingNoteStyle(){
  _pendingNoteStyle = null;
}

/* noteEditorContent'in 'input' event handler'ından çağrılır.
   SADECE tek-karakter yazma olaylarında (insertText, insertCompositionText —
   IME/Türkçe karakter girişi dahil) çalışır. insertFromPaste, insertFromDrop
   gibi ÇOKLU karakter ekleyen olaylar BİLEREK hariç tutulur: bu fonksiyon
   sadece "az önce yazılan TEK karakteri" sarmalıyor, çoklu karakterli bir
   ekleme olursa yanlışlıkla sadece son karakteri sarıp öncesini atlardı. */
function _applyPendingNoteStyleToInput(e){
  if(!_pendingNoteStyle) return;
  var allowedTypes = ['insertText', 'insertCompositionText', 'insertLineBreak'];
  if(e && e.inputType && allowedTypes.indexOf(e.inputType) === -1) return;

  var content = document.getElementById('noteEditorContent');
  var sel = window.getSelection();
  if(!sel || sel.rangeCount === 0) return;
  var range = sel.getRangeAt(0);
  if(!range.collapsed) return; // beklenmedik durum, dokunma
  if(!content.contains(range.startContainer)) return;

  var node = range.startContainer;
  var offset = range.startOffset;

  // Caret bir ELEMENT içinde olabilir (text node değil) — özellikle BOŞ bir
  // paragrafa (yeni satıra geçilip) ilk karakter yazıldığında bu durum çok
  // sık görülür: <p><br></p> içinde caret <p>'nin kendisinde konumlanır,
  // karakter yazılınca <br> silinip yerine bir text node gelir ama bazı
  // tarayıcılarda input event'i sırasında startContainer hâlâ <p> olarak
  // raporlanabilir. Bu durumda offset'teki/civarındaki gerçek text node'u
  // arıyoruz; bulamazsak güvenle çıkıyoruz (stil uygulanmaz ama hata da
  // vermez — kullanıcı bir dahaki karakterde tekrar denenir çünkü pending
  // hâlâ aktif kalır, sadece bu fonksiyon onu tüketmemiş olur).
  if(node.nodeType !== 3){
    // En sondaki (en derin) text node'u bul — input event tetiklendiğinde
    // karakter DOM'a zaten eklenmiş olur, biz sadece onu bulmaya çalışıyoruz.
    var deepestText = _findLastTextNode(node);
    if(deepestText && deepestText.textContent.length > 0){
      node = deepestText;
      offset = node.textContent.length;
    } else {
      return; // gerçekten boş, sarılacak karakter yok — pending bir sonraki input'ta tekrar denenir
    }
  }

  // Caret bir metin node'unda ve hemen önünde en az 1 karakter olmalı
  // (az önce yazılan karakter).
  if(offset < 1) return;

  var charText = node.textContent.charAt(offset - 1);
  if(!charText) return;

  // Eğer caret'in önündeki karakter ZATEN doğru stile sahip bir span
  // içindeyse (örn. art arda aynı renkte ikinci karakter yazılıyor), tekrar
  // sarmaya gerek yok — parentNode'u büyütüyoruz gibi davranır, DOM şişmez.
  var parent = node.parentNode;
  if(parent && parent.classList && parent.classList.contains('note-style-span') &&
     parent.style[_pendingNoteStyle.prop] === _styleValueNormalized(_pendingNoteStyle.prop, _pendingNoteStyle.value) &&
     node === parent.firstChild && node === parent.lastChild){
    return; // zaten doğru span'ın içinde büyüyor, bir şey yapmaya gerek yok
  }

  // Tek karakteri ayrı bir text node'a böl, onu style'lı span'a sar.
  var beforeText = node.textContent.slice(0, offset - 1);
  var charNodeText = node.textContent.slice(offset - 1, offset);
  var afterText = node.textContent.slice(offset);

  var span = document.createElement('span');
  span.className = 'note-style-span';
  span.style[_pendingNoteStyle.prop] = _pendingNoteStyle.value;
  span.appendChild(document.createTextNode(charNodeText));

  var parentOfNode = node.parentNode;
  var beforeNode = beforeText ? document.createTextNode(beforeText) : null;
  var afterNode = afterText ? document.createTextNode(afterText) : null;

  if(beforeNode) parentOfNode.insertBefore(beforeNode, node);
  parentOfNode.insertBefore(span, node);
  if(afterNode) parentOfNode.insertBefore(afterNode, node);
  parentOfNode.removeChild(node);

  // Caret'i span'ın içindeki karakterin TAM SONUNA koy — böylece bir
  // sonraki karakter de aynı mantıkla (yukarıdaki "zaten doğru span" kontrolü
  // sayesinde) o span'a eklenmeye devam eder.
  var newRange = document.createRange();
  newRange.setStart(span.firstChild, span.firstChild.textContent.length);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}
/* Bir elementin İÇİNDEKİ en sondaki (DOM sırasında son) text node'u
   derinlemesine arar. Caret bir element üzerinde raporlandığında (text node
   değil) — ki bu özellikle boş paragrafa ilk karakter yazıldığında olur —
   gerçekte yazılan karakterin hangi text node'a girdiğini bulmak için. */
function _findLastTextNode(el){
  for(var i = el.childNodes.length - 1; i >= 0; i--){
    var child = el.childNodes[i];
    if(child.nodeType === 3 && child.textContent.length > 0) return child;
    if(child.nodeType === 1){
      var found = _findLastTextNode(child);
      if(found) return found;
    }
  }
  return null;
}

function _styleValueNormalized(prop, value){
  // Tarayıcı bazı renkleri rgb() formatına çevirebilir; basit string eşitliği
  // her zaman tutmayabilir ama bu fonksiyon sadece "tekrar sarmaya gerek var mı"
  // optimizasyonu için — yanlış negatif olsa bile (yeniden sarsa bile) sonuç
  // görsel olarak doğru kalır, sadece DOM'da bir span daha fazla olur.
  return value;
}

function _noteColorPopupOutsideClick(e){
  var popup = document.getElementById('noteColorPopup');
  if(popup && !popup.contains(e.target) && !e.target.closest('.notes-tb-color-btn')){
    popup.style.display = 'none';
    document.removeEventListener('click', _noteColorPopupOutsideClick);
  }
}

/* ══════════ CURSOR POSITION SAVE/RESTORE ══════════
   Modal açılınca focus kaybolur → cursor sıfırlanır.
   Her picker/modal açılmadan önce buraya kaydet, blok eklerken geri yükle. */
var _savedNoteCursorRange = null;

function _saveNoteCursor(){
  var content = document.getElementById('noteEditorContent');
  if(!content) return;
  var sel = window.getSelection();
  if(sel && sel.rangeCount > 0 && content.contains(sel.anchorNode)){
    _savedNoteCursorRange = sel.getRangeAt(0).cloneRange();
  }
  // kayıt yoksa mevcut olanı koru, sıfırlama
}

function _restoreNoteCursor(){
  if(!_savedNoteCursorRange) return;
  var content = document.getElementById('noteEditorContent');
  if(!content) return;
  content.focus();
  try{
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(_savedNoteCursorRange);
  }catch(e){}
}

/* ══════════ INSERT BLOCK HELPER ══════════ */
function insertNoteBlockHtml(html){
  var content = document.getElementById('noteEditorContent');
  // Blok eklemek (video/flashcard/foto/pdf) yazma akışını kestiği için
  // bekleyen bir renk/vurgu niyeti varsa artık geçersizdir.
  _clearPendingNoteStyle();

  // Kaydedilmiş cursor varsa onu kullan, yoksa mevcut selection'ı dene
  var targetRange = _savedNoteCursorRange || null;
  if(!targetRange){
    var sel0 = window.getSelection();
    if(sel0 && sel0.rangeCount > 0 && content.contains(sel0.anchorNode)){
      targetRange = sel0.getRangeAt(0).cloneRange();
    }
  }

  // Fragment oluştur
  var wrapper = document.createElement('div');
  wrapper.innerHTML = html + '<p><br></p>';
  var frag = document.createDocumentFragment();
  var node, lastNode;
  while((node = wrapper.firstChild)){ lastNode = frag.appendChild(node); }

  if(targetRange && content.contains(targetRange.startContainer)){
    // İmlecin bulunduğu en üst seviye bloğu bul (content'in direkt çocuğu)
    var anchor = targetRange.startContainer;
    var blockEl = (anchor.nodeType === 3) ? anchor.parentNode : anchor;
    while(blockEl && blockEl.parentNode !== content){ blockEl = blockEl.parentNode; }

    if(blockEl && blockEl !== content){
      // O bloğun hemen ALTINA ekle
      content.insertBefore(frag, blockEl.nextSibling);
    } else {
      // Doğrudan content içindeyse range'in sonuna ekle
      targetRange.collapse(false);
      targetRange.insertNode(frag);
    }
  } else {
    // Hiç kayıt yoksa sona ekle
    content.appendChild(frag);
  }

  // İmleci eklenen bloğun altındaki <p>'ye taşı
  if(lastNode){
    try{
      content.focus();
      var nr = document.createRange();
      nr.setStart(lastNode, 0);
      nr.collapse(true);
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(nr);
      // Bir sonraki ekleme için cursor'ı güncelle
      _savedNoteCursorRange = nr.cloneRange();
    }catch(ex){}
  }
  scheduleNoteSave();
}

/* ══════════ BLOCK: VIDEO PICKER ══════════ */
function openNoteVideoPicker(){
  _saveNoteCursor();
  document.getElementById('noteVideoPickerSearch').value = '';
  renderNoteVideoPickerList();
  document.getElementById('noteVideoPickerOverlay').classList.add('open');
}
function closeNoteVideoPicker(){ document.getElementById('noteVideoPickerOverlay').classList.remove('open'); }
function renderNoteVideoPickerList(){
  var q = (document.getElementById('noteVideoPickerSearch').value || '').trim().toLowerCase();
  var listEl = document.getElementById('noteVideoPickerList');
  listEl.innerHTML = '';
  var any = false;
  playlists.forEach(function(pl){
    var items = pl.items.filter(function(it){
      if(!q) return true;
      return it.title.toLowerCase().indexOf(q) >= 0 || pl.name.toLowerCase().indexOf(q) >= 0;
    });
    if(items.length === 0) return;
    any = true;
    var label = document.createElement('div');
    label.className = 'note-picker-group-label';
    label.textContent = pl.name + (pl.hidden ? ' 🔒' : '');
    listEl.appendChild(label);
    items.forEach(function(it){
      var row = document.createElement('div');
      row.className = 'note-picker-item';
      row.innerHTML =
        '<img class="note-picker-item-thumb" src="https://i.ytimg.com/vi/'+it.id+'/mqdefault.jpg" loading="lazy" onerror="this.style.visibility=\'hidden\'">'+
        '<div class="note-picker-item-info">'+
          '<div class="note-picker-item-title">'+escapeHtml(it.title)+'</div>'+
          '<div class="note-picker-item-sub">'+escapeHtml(pl.name)+'</div>'+
        '</div>';
      row.addEventListener('click', function(){
        insertNoteVideoBlock(pl.id, it.id, it.title);
        closeNoteVideoPicker();
      });
      listEl.appendChild(row);
    });
  });
  if(!any) listEl.innerHTML = '<div class="note-picker-empty">Eşleşen video bulunamadı.</div>';
}
function insertNoteVideoBlock(plId, vidId, title){
  var thumb = 'https://i.ytimg.com/vi/'+vidId+'/mqdefault.jpg';
  var html =
        '<div class="note-block-wrap">'+
    '<div class="note-block note-block-video" contenteditable="false" data-pl="'+plId+'" data-vid="'+vidId+'" onclick="noteBlockOpenVideo(this,event)">'+
      '<img class="note-block-thumb" src="'+thumb+'" loading="lazy" onerror="this.style.visibility=\'hidden\'">'+
      '<div class="note-block-info">'+
        '<div class="note-block-title">'+escapeHtml(title)+'</div>'+
        '<div class="note-block-sub"><span class="material-symbols-outlined" style="font-size:12px">play_circle</span> Videoyu Aç</div>'+
      '</div>'+
    '</div>'+
          '<button class="note-block-del-btn" title="Kaldır" onclick="removeNoteWrap(this)">✕</button>'+
        '</div>';
  insertNoteBlockHtml(html);
}
function noteBlockOpenVideo(el, e){
  if(e && e.target && e.target.classList.contains('note-block-del-btn')) return;
  var plId = el.getAttribute('data-pl');
  var vidId = el.getAttribute('data-vid');
  openVideoFromNoteRef(plId, vidId);
}

/* ══════════ BLOCK: TIMESTAMP NOTE PICKER ══════════ */
function openNoteTimestampPicker(){
  _saveNoteCursor();
  document.getElementById('noteTsPickerSearch').value = '';
  renderNoteTsPickerList();
  document.getElementById('noteTsPickerOverlay').classList.add('open');
}
function closeNoteTimestampPicker(){ document.getElementById('noteTsPickerOverlay').classList.remove('open'); }
function renderNoteTsPickerList(){
  var q = (document.getElementById('noteTsPickerSearch').value || '').trim().toLowerCase();
  var listEl = document.getElementById('noteTsPickerList');
  listEl.innerHTML = '';
  var any = false;
  playlists.forEach(function(pl){
    var notesByVid = pl.notes || {};
    Object.keys(notesByVid).forEach(function(vid){
      var item = pl.items.find(function(it){ return it.id === vid; });
      var vidTitle = item ? item.title : vid;
      (notesByVid[vid]||[]).forEach(function(n, ni){
        var hay = (n.text||'').toLowerCase()+' '+vidTitle.toLowerCase()+' '+pl.name.toLowerCase();
        if(q && hay.indexOf(q) < 0) return;
        any = true;
        var row = document.createElement('div');
        row.className = 'note-picker-item';
        row.innerHTML =
          '<div class="note-picker-item-icon">⏱</div>'+
          '<div class="note-picker-item-info">'+
            '<div class="note-picker-item-title">'+escapeHtml(n.text)+'</div>'+
            '<div class="note-picker-item-sub">'+fmtSec(n.ts)+' • '+escapeHtml(vidTitle)+' — '+escapeHtml(pl.name)+'</div>'+
          '</div>';
        row.addEventListener('click', function(){
          insertNoteTimestampBlock(pl.id, vid, vidTitle, n.ts, n.text);
          closeNoteTimestampPicker();
        });
        listEl.appendChild(row);
      });
    });
  });
  if(!any) listEl.innerHTML = '<div class="note-picker-empty">'+(q?'Eşleşen not bulunamadı.':'Henüz hiçbir videoda zaman damgası notu yok.')+'</div>';
}
function insertNoteTimestampBlock(plId, vidId, vidTitle, ts, text){
  var html =
        '<div class="note-block-wrap">'+
    '<div class="note-block note-block-ts" contenteditable="false" data-pl="'+plId+'" data-vid="'+vidId+'" data-ts="'+ts+'" onclick="noteBlockSeekTimestamp(this,event)">'+
      '<div class="note-block-icon ts"><span class="material-symbols-outlined" style="font-size:18px">schedule</span></div>'+
      '<div class="note-block-info">'+
        '<div class="note-block-title">'+escapeHtml(text)+'</div>'+
        '<div class="note-block-sub">'+fmtSec(ts)+' • '+escapeHtml(vidTitle)+'</div>'+
      '</div>'+
    '</div>'+
          '<button class="note-block-del-btn" title="Kaldır" onclick="removeNoteWrap(this)">✕</button>'+
        '</div>';
  insertNoteBlockHtml(html);
}
function noteBlockSeekTimestamp(el, e){
  if(e && e.target && e.target.classList.contains('note-block-del-btn')) return;
  var plId = el.getAttribute('data-pl');
  var vidId = el.getAttribute('data-vid');
  var ts = parseFloat(el.getAttribute('data-ts')) || 0;
  openVideoFromNoteRef(plId, vidId, ts);
}

/* ══════════ SHARED: VIDEO/PLAYLIST OPEN LOGIC ══════════
   Kurallar:
   - Hedef video başka bir playlistteyse o playliste geçilir.
   - Playlist gizliyse önce gizliliği kaldırılır, sonra açılır.
   - Video o playlistte zaten yoksa (silinmiş olabilir) sadece bağımsız oynatılır. */
function openVideoFromNoteRef(plId, vidId, seekTs){
  closeNotesPanel();
  var targetPl = playlists.find(function(p){ return p.id === plId; });
  if(targetPl){
    if(targetPl.hidden){
      targetPl.hidden = false;
      saveAll();
      showToast('🔓 "'+targetPl.name+'" playlisti tekrar görünür yapıldı.');
    }
    var stillThere = targetPl.items.some(function(it){ return it.id === vidId; });
    if(activePlaylistId !== plId){
      switchPlaylist(plId);
    }
    if(stillThere){
      var idx = targetPl.items.findIndex(function(it){ return it.id === vidId; });
      playPlaylistVideo(idx);
    } else {
      loadVideoInPlayer(vidId);
    }
  } else {
    // Playlist artık mevcut değil (silinmiş) — videoyu yine de bağımsız aç
    loadVideoInPlayer(vidId);
  }
  if(seekTs !== undefined && seekTs !== null){
    setTimeout(function(){ seekToNote(seekTs); }, 900);
  }
}

/* ══════════ BLOCK: FLASHCARD PICKER ══════════ */
function openNoteFlashcardPicker(){
  _saveNoteCursor();
  document.getElementById('noteFcPickerSearch').value = '';
  renderNoteFcPickerList();
  document.getElementById('noteFcPickerOverlay').classList.add('open');
}
function closeNoteFlashcardPicker(){ document.getElementById('noteFcPickerOverlay').classList.remove('open'); }
function renderNoteFcPickerList(){
  var q = (document.getElementById('noteFcPickerSearch').value || '').trim().toLowerCase();
  var listEl = document.getElementById('noteFcPickerList');
  listEl.innerHTML = '';
  if(typeof aiFlashcards === 'undefined' || !aiFlashcards){ listEl.innerHTML = '<div class="note-picker-empty">Henüz hiç flashcard oluşturmadın.</div>'; return; }
  var cards = aiFlashcards.filter(function(c){
    if(!q) return true;
    var cat = c.kategoriId && typeof aiCatById==='function' ? aiCatById(c.kategoriId) : null;
    var hay = (c.soru||'')+' '+(c.cevap||'')+' '+(c.baslik||'')+' '+(c.icerik||'')+' '+(cat?cat.ders+' '+cat.konu:'');
    return hay.toLowerCase().indexOf(q) >= 0;
  });
  if(cards.length === 0){ listEl.innerHTML = '<div class="note-picker-empty">'+(q?'Eşleşen kart bulunamadı.':'Henüz hiç flashcard oluşturmadın.')+'</div>'; return; }
  cards.forEach(function(c){
    var isBilgi = c.tip === 'bilgi';
    var front = isBilgi ? (c.baslik||'') : (c.soru||'');
    var cat = c.kategoriId && typeof aiCatById==='function' ? aiCatById(c.kategoriId) : null;
    var row = document.createElement('div');
    row.className = 'note-picker-item';
    row.innerHTML =
      '<div class="note-picker-item-icon">'+(isBilgi?'💡':'❓')+'</div>'+
      '<div class="note-picker-item-info">'+
        '<div class="note-picker-item-title">'+escapeHtml(front)+'</div>'+
        '<div class="note-picker-item-sub">'+(cat?escapeHtml(cat.ders+(cat.konu?' › '+cat.konu:'')):'Kategorisiz')+'</div>'+
      '</div>';
    row.addEventListener('click', function(){
      insertNoteFlashcardBlock(c.id, front);
      closeNoteFlashcardPicker();
    });
    listEl.appendChild(row);
  });
}
function insertNoteFlashcardBlock(cardId, frontPreview){
  var html =
        '<div class="note-block-wrap">'+
    '<div class="note-block note-block-fc" contenteditable="false" data-card-id="'+cardId+'" onclick="noteBlockOpenFlashcard(this,event)">'+
      '<div class="note-block-icon fc"><span class="material-symbols-outlined" style="font-size:18px">style</span></div>'+
      '<div class="note-block-info">'+
        '<div class="note-block-title">'+escapeHtml(frontPreview)+'</div>'+
        '<div class="note-block-sub"><span class="material-symbols-outlined" style="font-size:12px">touch_app</span> Kartı Göster</div>'+
      '</div>'+
    '</div>'+
          '<button class="note-block-del-btn" title="Kaldır" onclick="removeNoteWrap(this)">✕</button>'+
        '</div>';
  insertNoteBlockHtml(html);
}
/* Notlardan flashcard açılınca AI sekmesi/panel AÇILMAZ — sadece kartın kendisi minik bir overlay'de gösterilir. */
function noteBlockOpenFlashcard(el, e){
  if(e && e.target && e.target.classList.contains('note-block-del-btn')) return;
  var cardId = el.getAttribute('data-card-id');
  if(typeof aiFlashcards === 'undefined'){ showToast('❌ Flashcard verisi bulunamadı.'); return; }
  var card = aiFlashcards.find(function(c){ return c.id === cardId; });
  if(!card){ showToast('❌ Bu kart silinmiş görünüyor.'); return; }
  noteFcMiniDeckRef = card;
  renderNoteFcMini();
  document.getElementById('noteFcMiniOverlay').classList.add('open');
  document.addEventListener('keydown', _noteFcMiniKeyHandler);
}
function closeNoteFcMini(){
  document.getElementById('noteFcMiniOverlay').classList.remove('open');
  document.removeEventListener('keydown', _noteFcMiniKeyHandler);
  noteFcMiniDeckRef = null;
}
function _noteFcMiniKeyHandler(e){
  if(e.key === 'Escape') closeNoteFcMini();
  if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); noteFcMiniFlip(); }
}
function noteFcMiniFlip(e){
  var card = document.getElementById('noteFcMiniCard');
  if(!card || card.dataset.flipping) return;
  card.dataset.flipping = '1';
  card.classList.toggle('flipped');
  setTimeout(function(){ delete card.dataset.flipping; }, 650);
}
function renderNoteFcMini(){
  var c = noteFcMiniDeckRef; if(!c) return;
  var isBilgi = c.tip === 'bilgi';
  var frontLabel = isBilgi ? '💡 Bilgi' : '❓ Soru';
  var backLabel = isBilgi ? '📖 Detay' : '✅ Cevap';
  var frontText = isBilgi ? (c.baslik||'') : (c.soru||'');
  var backText = isBilgi ? (c.icerik||'') : (c.cevap||'');
  var card = document.getElementById('noteFcMiniCard');
  card.classList.remove('flipped');
  document.getElementById('noteFcMiniFront').innerHTML =
    '<div class="ai-fcv-tag">'+frontLabel+'</div>'+
    '<div class="ai-fcv-scroll-area"><div class="ai-fcv-text">'+escapeHtml(frontText)+'</div></div>'+
    '<div class="ai-fcv-hint">karta tıkla / boşluk tuşu — çevir</div>';
  document.getElementById('noteFcMiniBack').innerHTML =
    '<div class="ai-fcv-tag">'+backLabel+'</div>'+
    '<div class="ai-fcv-scroll-area"><div class="ai-fcv-text">'+escapeHtml(backText)+'</div></div>'+
    '<div class="ai-fcv-hint">karta tıkla / boşluk tuşu — çevir</div>';
}

/* ══════════ BLOCK: IMAGE UPLOAD ══════════ */
function triggerNoteImageUpload(){
  _saveNoteCursor();
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = function(){
    if(!inp.files || !inp.files[0]) return;
    var file = inp.files[0];
    var reader = new FileReader();
    reader.onload = function(ev){
      var src = ev.target.result;
      var html =
        '<div class="note-block-wrap">' +
          '<div class="note-img-wrap" contenteditable="false" onclick="openNoteImgLightbox(this)" title="Büyütmek için tıkla">' +
            '<img class="note-img-thumb" src="' + src + '" alt="' + escapeHtml(file.name) + '">' +
            '<span class="note-img-zoom-hint"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">zoom_in</span></span>' +
          '</div>' +
          '<button class="note-block-del-btn" title="Kaldır" onclick="removeNoteWrap(this)">✕</button>' +
        '</div>';
      insertNoteBlockHtml(html);
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

function openNoteImgLightbox(wrapEl, e){
  if(e && e.target && e.target.classList.contains('note-block-del-btn')) return;
  var img = wrapEl.querySelector('img');
  if(!img) return;
  var ov = document.getElementById('noteImgLightboxOv');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'noteImgLightboxOv';
    ov.className = 'note-img-lightbox-ov';
    ov.innerHTML =
      '<div class="note-img-lightbox-inner">' +
        '<img id="noteImgLightboxBig">' +
        '<button class="note-img-lightbox-close" onclick="closeNoteImgLightbox()">✕</button>' +
      '</div>';
    ov.addEventListener('click', function(e){ if(e.target === ov) closeNoteImgLightbox(); });
    document.body.appendChild(ov);
  }
  document.getElementById('noteImgLightboxBig').src = img.src;
  document.getElementById('noteImgLightboxBig').alt = img.alt || '';
  ov.classList.add('open');
  ov._esc = function(e){ if(e.key === 'Escape') closeNoteImgLightbox(); };
  document.addEventListener('keydown', ov._esc);
}
function closeNoteImgLightbox(){
  var ov = document.getElementById('noteImgLightboxOv');
  if(!ov) return;
  ov.classList.remove('open');
  if(ov._esc){ document.removeEventListener('keydown', ov._esc); ov._esc = null; }
}

/* ══════════ BLOCK: PDF UPLOAD ══════════ */
function triggerNotePdfUpload(){
  _saveNoteCursor();
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.pdf,application/pdf';
  inp.onchange = function(){
    if(!inp.files || !inp.files[0]) return;
    var file = inp.files[0];
    var reader = new FileReader();
    reader.onload = function(ev){
      var html =
            '<div class="note-block-wrap">'+
        '<div class="note-block note-block-pdf" contenteditable="false" data-pdf-src="'+ev.target.result+'" data-pdf-name="'+escapeHtml(file.name)+'" onclick="noteBlockOpenPdfPreview(this,event)">'+
          '<div class="note-block-icon pdf"><span class="material-symbols-outlined" style="font-size:18px">picture_as_pdf</span></div>'+
          '<div class="note-block-info">'+
            '<div class="note-block-title">'+escapeHtml(file.name)+'</div>'+
            '<div class="note-block-sub"><span class="material-symbols-outlined" style="font-size:12px">open_in_new</span> Önizleme / Aç</div>'+
          '</div>'+
        '</div>'+
              '<button class="note-block-del-btn" title="Kaldır" onclick="removeNoteWrap(this)">✕</button>'+
            '</div>';
      insertNoteBlockHtml(html);
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

/* PDF: önce overlay'de iframe ile aç, yeni sekme butonu da sun */
function noteBlockOpenPdfPreview(el, e){
  if(e && e.target && e.target.classList.contains('note-block-del-btn')) return;
  var src = el.getAttribute('data-pdf-src');
  var name = el.getAttribute('data-pdf-name') || 'Belge.pdf';
  if(!src) return;
  var ov = document.getElementById('notePdfPreviewOv');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'notePdfPreviewOv';
    ov.className = 'note-pdf-preview-ov';
    ov.innerHTML =
      '<div class="note-pdf-preview-box">' +
        '<div class="note-pdf-preview-header">' +
          '<span class="note-pdf-preview-title" id="notePdfPreviewTitle"></span>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="note-pdf-preview-btn" onclick="openNotePdfNewTab()" title="Yeni Sekmede Aç"><span class="material-symbols-outlined" style="font-size:15px">open_in_new</span></button>' +
            '<button class="note-pdf-preview-btn close" onclick="closeNotePdfPreview()">✕</button>' +
          '</div>' +
        '</div>' +
        '<iframe id="notePdfPreviewFrame" src="" style="width:100%;flex:1;border:none;border-radius:0 0 12px 12px;"></iframe>' +
      '</div>';
    ov.addEventListener('click', function(e){ if(e.target === ov) closeNotePdfPreview(); });
    document.body.appendChild(ov);
  }
  document.getElementById('notePdfPreviewTitle').textContent = name;
  document.getElementById('notePdfPreviewFrame').src = src;
  ov._pdfSrc = src;
  ov.classList.add('open');
  ov._esc = function(e){ if(e.key === 'Escape') closeNotePdfPreview(); };
  document.addEventListener('keydown', ov._esc);
}
function closeNotePdfPreview(){
  var ov = document.getElementById('notePdfPreviewOv');
  if(!ov) return;
  ov.classList.remove('open');
  // iframe'i sıfırla (memory)
  var fr = document.getElementById('notePdfPreviewFrame');
  if(fr) fr.src = '';
  if(ov._esc){ document.removeEventListener('keydown', ov._esc); ov._esc = null; }
}
function openNotePdfNewTab(){
  var ov = document.getElementById('notePdfPreviewOv');
  var src = ov && ov._pdfSrc;
  if(!src) return;
  var w = window.open('');
  if(w){ w.document.write('<title>PDF</title><body style="margin:0"><iframe src="'+src+'" style="width:100%;height:100vh;border:none"></iframe></body>'); }
  else { showToast('❌ Pop-up engellendi.'); }
}
/* Geriye dönük uyumluluk - eski noteBlockOpenPdf çağrıları için */
function noteBlockOpenPdf(el){ noteBlockOpenPdfPreview(el); }

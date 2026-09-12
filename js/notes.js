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
  /* DRIVE ASSET STORAGE: flushCurrentNoteSave() zaten kaydetmeden ÖNCE büyük
     gömülü dosyaları (PDF/görsel/çizim) Drive'a taşıyor (bkz. aşağısı) — bu
     yüzden normalde buraya küçülmüş bir html gelir. ahaSafeSetItem burada
     sadece bir GÜVENLİK AĞI: eski/yedekten geri yüklenmiş, hiç offload
     edilmemiş notlar ya da birikimli (tek tek küçük ama toplamda büyük) veri
     yüzünden kota yine de aşılırsa devreye girer. */
  if(typeof ahaSafeSetItem === 'function'){
    ahaSafeSetItem(LS_NOTES, notePages);
  } else {
    try{ localStorage.setItem(LS_NOTES, JSON.stringify(notePages)); }catch(e){
      showToast('❌ Not kaydedilemedi (depolama alanı dolu olabilir).');
    }
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
  // DRIVE ASSET STORAGE: page.html büyük ekler için aha-asset://driveId
  // placeholder'ları içeriyor olabilir — editörde gerçek PDF/görsel/çizim
  // olarak görünmeleri için Drive'dan asenkron çözülmeleri gerekir.
  if(typeof ahaHydrateHtmlAssets === 'function') ahaHydrateHtmlAssets(content);
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
  page.updatedAt = Date.now();
  var rawHtml = document.getElementById('noteEditorContent').innerHTML;
  var stateEl = document.getElementById('noteEditorSaveState');
  /* DRIVE ASSET STORAGE: sayfa şu an ekranda PDF/görsel/çizim gösteriyorsa
     (hydrate edilmiş hallerinde, yani gerçek base64 ile), innerHTML de onları
     ham haliyle içerir. Kaydetmeden ÖNCE büyük olanları Drive'a taşıyıp
     yerlerine küçük bir pointer koyuyoruz — böylece localStorage'a sadece
     küçülmüş HTML yazılır. ahaOffloadHtmlAssets zaten daha önce Drive'a
     taşınmış (aynı bayt) içerikleri _ahaUploadDedup sayesinde TEKRAR
     yüklemez, o yüzden her 500ms'lik autosave'de gereksiz yükleme olmaz. */
  var offloadP = (typeof ahaOffloadHtmlAssets === 'function') ? ahaOffloadHtmlAssets(rawHtml) : Promise.resolve(rawHtml);
  offloadP.then(function(finalHtml){
    page.html = finalHtml;
    saveNotes();
    if(stateEl){ stateEl.textContent = 'Kaydedildi'; stateEl.classList.remove('saving'); }
  });
}

/* Editor content değişimini dinle (yazı, blok ekleme, vs.)
   NOT: notes.js diğer scriptler gibi </body> sonunda yüklenir, DOM zaten hazırdır —
   bu yüzden DOMContentLoaded beklemek yerine doğrudan kur. */
/* BUG FIX (alıntı/blockquote'tan çıkış): insertOrderedList/insertUnorderedList
   listelerinde boş bir maddede Enter'a basmak tarayıcı tarafından native
   olarak listeden çıkışı tetikler (yeni normal paragraf açılır). blockquote
   (formatBlock:blockquote) için tarayıcıların HİÇBİRİ bu davranışı native
   sağlamaz — bu yüzden Enter alıntı içinde sonsuza kadar yeni satır açıyor,
   kullanıcı hiçbir zaman alıntıdan çıkıp normal yazmaya dönemiyordu.
   Bu fonksiyon o native listeleri davranışını blockquote için elle taklit eder:
   caret şu an İÇİNDE BULUNDUĞU SATIR boşsa (blockquote'un doğrudan child'ı
   olan bir <div>/<p> satırı YA DA blockquote'un düz metin+<br> içeriğinin
   tamamı) blockquote'tan çıkılır, imleç blockquote'tan HEMEN SONRA açılan
   yeni boş bir paragrafa taşınır. Satır BOŞ DEĞİLSE (kullanıcı gerçekten
   alıntı yazıyor) hiç müdahale etmez — tarayıcının normal Enter davranışı
   (blockquote içinde yeni satır) olduğu gibi sürer. true dönerse çağıran
   taraf native Enter'ı preventDefault etmeli.

   BUG FIX (2026-09, İKİNCİ TUR): Kullanıcı geri bildirimiyle, yukarıdaki
   ilk düzeltmenin İKİ ayrı senaryoda hâlâ ÇALIŞMADIĞI (kod okunarak değil,
   jsdom ile gerçek DOM/Selection davranışı simüle edilerek) tespit edildi:

   (1) TAMAMEN BOŞ tek-seviyeli bir alıntı (ör. "Alıntı" butonuna basılıp
       HİÇ yazı yazılmadan hemen Enter'a basılması — en sık karşılaşılan
       hâl) hiç çıkılamıyordu. Kök neden: düz/flat dalındaki caret-konumu
       kıyaslaması (`caretIdx < lastBrIdx+1`), blockquote'un TEK çocuğu
       olan yer tutucu <br> için "önünde GERÇEK bir önceki satır var mı"
       diye bir ayrım yapmıyordu — <br> index 0'daysa (hiç önceki içerik
       yokken) caret'in "son satırda değilmiş" gibi yanlış yorumlanmasına
       yol açıyordu. Çözüm: blockquote'un TÜM metni zaten boşsa (gerçek bir
       önceki satırla kıyaslanacak hiçbir şey yoksa) bu pozisyon
       kıyaslamasına hiç girmeden doğrudan çıkılıyor.

   (2) İÇ İÇE (nested) bir alıntıda — ki bu, "Alıntı" butonuna caret ZATEN
       bir alıntı içindeyken tekrar basılmasının execCommand('formatBlock',
       'blockquote') native tuhaflığı yüzünden ürettiği, mevcut blockquote'u
       KALDIRMAK yerine İÇİNE bir tane daha SARAN bir yapıydı (bkz. aşağıdaki
       _noteToggleBlockquote — bu artık BİR DAHA oluşturulamaz) — Enter'a
       basmak "true" dönüp bir <div> oluşturuyordu AMA o yeni <div> hâlâ
       (temizlenmemiş) DIŞ blockquote'un içinde kalıyordu; kullanıcıya
       "hiçbir şey olmadı, hâlâ alıntı içindeyim" gibi görünüyordu — asıl
       bildirilen bug TAM OLARAK buydu. Çözüm: bq'dan çıkıldıktan sonra,
       dışa doğru TÜM blockquote atalarını (arada satır-wrapper <div>'ları
       olsa bile) kontrol edip, o katmanda BAŞKA gerçek içerik KALMADIĞI
       sürece (a) katman boşsa sil ve yukarı çık, (b) katmanda GERÇEK
       içerik varsa (kullanıcı iç alıntıya bir şeyler yazmışsa) o dış
       katmanı SADECE içeriği sarmalayan GEREKSİZ bir kabuksa (başka hiçbir
       şeyi yoksa) İÇERİĞİ KAYBETMEDEN söküp (unwrap) yukarı çıkmaya devam
       eder. Dış katmanda GERÇEK BAŞKA içerik varsa (kasıtlı/anlamlı bir iç
       içe alıntıysa) orada durulur, o katmana dokunulmaz. jsdom ile 16
       senaryoyla (flat/wrapper-div karışımları, tek/çift/üç kat nested,
       her seviyede boş/dolu kombinasyonları, caret'in gerçekten yeni
       paragrafın içine düştüğünün doğrulanması dahil) doğrulanmıştır. */
function _noteFindBlockquoteAncestor(node, content){
  var bq = node && node.nodeType === 3 ? node.parentNode : node;
  while(bq && bq !== content && bq.tagName !== 'BLOCKQUOTE') bq = bq.parentNode;
  if(!bq || bq === content || bq.tagName !== 'BLOCKQUOTE') return null;
  return bq;
}

function _noteTryExitEmptyBlockquoteOnEnter(){
  var sel = window.getSelection();
  if(!sel || !sel.rangeCount || !sel.isCollapsed) return false;
  var content = document.getElementById('noteEditorContent');
  if(!content) return false;
  var range = sel.getRangeAt(0);
  var node = range.startContainer;
  var offset = range.startOffset;
  if(!content.contains(node)) return false;

  // En yakın blockquote atasını bul (yoksa bu fonksiyonun işi değil).
  var bq = _noteFindBlockquoteAncestor(node, content);
  if(!bq) return false;

  // Caret'in içinde bulunduğu "satır"ı bul: blockquote'un DOĞRUDAN child'ı
  // olan en yakın ata. Ara katman yoksa (düz metin/<br> yapısı) bu, bq'nun
  // kendisine kadar çıkar — o durumda ara katman YOK demektir (aşağıdaki else).
  var line = node.nodeType === 3 ? node.parentNode : node;
  while(line && line !== bq && line.parentNode !== bq) line = line.parentNode;
  if(!line) return false;

  if(line !== bq){
    // Ara katman (div/p) VAR — her satır kendi wrapper'ında, "satır" = wrapper'ın kendisi.
    // (Bu dal değişmedi.)
    var lineText = (line.textContent || '').replace(/\u200B/g, '').trim();
    if(lineText !== '') return false; // gerçek içerik var, normal Enter davransın
    if(line.parentNode) line.parentNode.removeChild(line);
  } else {
    // Ara katman YOK (düz/flat yapı) — blockquote'un doğrudan çocukları metin/<br>
    // karışımı.
    var kids = Array.prototype.slice.call(bq.childNodes);
    var wholeBqText = kids.map(function(n){return n.textContent||'';}).join('').replace(/\u200B/g,'').trim();

    if(wholeBqText === ''){
      // BUG FIX (2026-09, ikinci tur, madde 1 — bkz. yukarıdaki yorum):
      // gerçek bir ÖNCEKİ satır yokken (blockquote'un TÜM metni zaten
      // boşken) aşağıdaki caret/lastBr kıyaslamasına hiç gerek yok —
      // hangi konumda olursa olsun çıkılmalı.
      kids.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); });
    } else {
      // BUG FIX (2026-09, ilk tur): eskiden burada HER ZAMAN bq.textContent
      // (TÜM alıntının metni) kontrol ediliyordu — çok satırlı düz bir alıntıda
      // önceki satırlar doluysa, şu an boş olan SON satırda Enter'a basılsa bile
      // "boş değil" sanılıp çıkış engelleniyordu. Artık SADECE en SON satırın
      // (blockquote içindeki en son <br>'den sonraki kısmın) metnine bakılıyor.
      // Caret gerçekten o son satırda değilse (ortadaki dolu bir satırın
      // arasındaki boş bir satırdaysa) kapsam dışı bırakılıp hiç müdahale
      // edilmiyor — native davranış (yeni satır açma) olduğu gibi sürüyor.
      var lastBr = null;
      for(var k=kids.length-1;k>=0;k--){ if(kids[k].nodeType===1 && kids[k].tagName==='BR'){ lastBr=kids[k]; break; } }
      var lastBrIdx = lastBr ? kids.indexOf(lastBr) : -1;
      var lastLineNodes = kids.slice(lastBrIdx+1);
      var lastLineText = lastLineNodes.map(function(n){return n.textContent||'';}).join('').replace(/\u200B/g,'').trim();

      var caretIdx = (node===bq) ? offset : kids.indexOf(node);
      if(caretIdx===-1) return false;
      if(caretIdx < lastBrIdx+1) return false; // caret son satırda değil — dokunma
      if(lastLineText !== '') return false; // son satır dolu, normal Enter davransın

      lastLineNodes.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); });
      if(lastBr && lastBr.parentNode) lastBr.parentNode.removeChild(lastBr);
    }
  }

  // BUG FIX (2026-09, ikinci tur, madde 2 — bkz. yukarıdaki yorum): bq'nun
  // kendi satırından çıkıldı ama bq başka bir blockquote'un İÇİNDE (nested)
  // olabilir. exitPointIsEmpty, bq bu noktada TAMAMEN boş mu (a) yoksa
  // GERÇEK içerik mi taşıyor (b) belirler ve döngü boyunca SABİT kalır —
  // ikisi de tek bir seferde ÜST düzeye çıkılıp çıkılamayacağını belirler.
  var exitPointIsEmpty = (bq.textContent || '').replace(/\u200B/g, '').trim() === '';
  var exitPoint = bq;
  while(true){
    var outerBq = _noteFindBlockquoteAncestor(exitPoint.parentNode, content);
    if(!outerBq) break;

    // exitPoint'in outerBq içindeki karşılığı olan "satır"ı bul (outerBq'nun
    // DOĞRUDAN child'ı olan en yakın ata — arada satır-wrapper <div>'ları
    // olabilir, bkz. test senaryosu 5/12/14).
    var outerLine = exitPoint;
    while(outerLine && outerLine !== outerBq && outerLine.parentNode !== outerBq) outerLine = outerLine.parentNode;
    if(!outerLine) break;

    var outerRestText = '';
    Array.prototype.forEach.call(outerBq.childNodes, function(n){
      if(n !== outerLine) outerRestText += (n.textContent || '');
    });
    outerRestText = outerRestText.replace(/\u200B/g, '').trim();

    if(outerRestText !== ''){
      // Dış blockquote'ta BAŞKA gerçek içerik var — burada dur, yeni
      // paragraf bu satırın (outerLine) hemen sonrasına, dış blockquote'un
      // İÇİNE yerleşecek (aşağıdaki genel ekleme adımı hallediyor); dış
      // katmanın kendisine ASLA dokunulmaz.
      exitPoint = outerLine;
      break;
    }

    if(exitPointIsEmpty){
      // Dış blockquote de bu satır kaldırılınca TAMAMEN boşalacak — satırı
      // (ve içindeki artık-boş zinciri) sil, bir üst seviyeye çıkmaya devam et.
      if(outerLine.parentNode) outerLine.parentNode.removeChild(outerLine);
      exitPoint = outerBq;
    } else {
      // outerBq, exitPoint'in taşıdığı GERÇEK içerik dışında hiçbir şey
      // içermiyor — yani sadece gereksiz bir sarmalayıcı (muhtemelen eski
      // bir "alıntı içinde alıntı" kalıntısı). İçeriği KAYBETMEDEN bu
      // kabuğu sök: outerBq'yu KALDIR, outerLine'ı onun YERİNE koy.
      if(outerBq.parentNode) outerBq.parentNode.replaceChild(outerLine, outerBq);
      exitPoint = outerLine;
    }
  }

  var p = document.createElement('div'); p.innerHTML = '<br>';
  if(!exitPoint.parentNode) return false;
  exitPoint.parentNode.insertBefore(p, exitPoint.nextSibling);
  if((exitPoint.textContent || '').replace(/\u200B/g, '').trim() === ''){
    exitPoint.parentNode.removeChild(exitPoint);
  }

  // Caret'i yeni paragrafın içine taşı.
  var newRange = document.createRange();
  newRange.setStart(p, 0);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
  return true;
}

/* bq'yu (TEK bir blockquote elementini) kaldırıp içeriğini, bulunduğu yere
   düz <div> satırları olarak taşır. Zaten <div>/<p> satır-wrapper'ları
   OLDUĞU GİBİ korunur (iç stil/renk span'ları bozulmaz); doğrudan metin/<br>
   (flat) içerik <br>'lere göre satır satır <div>'lere bölünür. Taşınan son
   satır node'unu döner (caret'i oraya yerleştirmek için kullanılır). */
function _noteUnwrapBlockquoteInPlace(bq){
  var parent = bq.parentNode;
  if(!parent) return null;
  var kids = Array.prototype.slice.call(bq.childNodes);
  var newNodes = [];
  if(kids.length === 0){
    var emptyDiv = document.createElement('div'); emptyDiv.innerHTML = '<br>';
    newNodes.push(emptyDiv);
  } else if(kids.every(function(n){ return n.nodeType===1 && (n.tagName==='DIV' || n.tagName==='P'); })){
    newNodes = kids;
  } else {
    var current = document.createElement('div');
    kids.forEach(function(n){
      if(n.nodeType===1 && n.tagName==='BR'){
        if(current.childNodes.length===0) current.innerHTML = '<br>';
        newNodes.push(current);
        current = document.createElement('div');
      } else {
        current.appendChild(n);
      }
    });
    if(current.childNodes.length===0) current.innerHTML = '<br>';
    newNodes.push(current);
  }
  var lastNode = null;
  newNodes.forEach(function(n){ parent.insertBefore(n, bq); lastNode = n; });
  parent.removeChild(bq);
  return lastNode;
}

/* bq'yu ve İÇİNDE varsa (eski/pasted içerikten kalma) TÜM iç içe (nested)
   blockquote'ları da özyinelemeli olarak söker — böylece kaç kat iç içe
   olursa olsun tek çağrıda TÜMÜ düz metne döner. En İÇTEKİDEN en DIŞTAKİNE
   doğru sökülür (querySelectorAll belge sırasına göre dıştan içe döndüğü
   için ters çevrilir) ki her adımda içerik zaten sadece düz <div>/metin
   olsun. */
function _noteUnwrapBlockquote(bq){
  var nestedBqs = Array.prototype.slice.call(bq.querySelectorAll('blockquote')).reverse();
  nestedBqs.forEach(function(inner){ _noteUnwrapBlockquoteInPlace(inner); });
  return _noteUnwrapBlockquoteInPlace(bq);
}

/* BUG FIX (2026-09) — "Alıntı" butonu gerçek bir TOGGLE değildi: caret
   ZATEN bir blockquote içindeyken tekrar basmak, document.execCommand(
   'formatBlock', false, 'blockquote') native davranışı YÜZÜNDEN (bu komut
   blockquote için insertOrderedList/insertUnorderedList gibi TOGGLE
   DEĞİLDİR) mevcut blockquote'u KALDIRMAK yerine İÇİNE bir tane daha
   SARIYORDU — "alıntı içinde alıntı" (nested blockquote) tam olarak böyle
   oluşuyordu. Bu iç içe yapı da yukarıdaki Enter-ile-çıkış mantığını bozan
   ASIL KÖK NEDENDİ: yeni paragraf hâlâ (temizlenmemiş) dış blockquote'un
   içinde kaldığından kullanıcıya "hiçbir şey olmadı, hâlâ alıntı içindeyim"
   gibi görünüyordu. Kalıcı çözüm: buton artık caret bir alıntı içindeyken
   native execCommand'a HİÇ başvurmuyor — bunun yerine (varsa iç içe TÜM
   katmanlarıyla birlikte) alıntıyı manuel olarak sökup İÇERİĞİ KAYBETMEDEN
   düz paragraflara çeviriyor; böylece buton bir daha ASLA iç içe blockquote
   üretemez. Caret bir alıntı içinde DEĞİLSE davranış DEĞİŞMEDİ (native
   formatBlock ile normal şekilde alıntı uygulanır). */
function _noteToggleBlockquote(){
  var content = document.getElementById('noteEditorContent');
  if(!content) return;
  var sel = window.getSelection();
  if(!sel || !sel.rangeCount) return;
  var range = sel.getRangeAt(0);
  var bq = _noteFindBlockquoteAncestor(range.startContainer, content);

  if(bq){
    // En dıştaki blockquote atasına kadar çık (iç içe olabilir) — sökme
    // işlemi HER ZAMAN en dıştan başlar.
    var outer = bq;
    while(true){
      var next = _noteFindBlockquoteAncestor(outer.parentNode, content);
      if(!next) break;
      outer = next;
    }
    var lastNode = _noteUnwrapBlockquote(outer);
    if(lastNode){
      var newRange = document.createRange();
      newRange.selectNodeContents(lastNode);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  } else {
    content.focus();
    try{ document.execCommand('formatBlock', false, 'blockquote'); }catch(e){}
  }
  scheduleNoteSave();
}

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

    // Sembol kısayolları — sembol panelinde orta-tık ile atanmış kombinasyonlar
    // burada yakalanır; panel hiç açılmadan sembol doğrudan caret konumuna
    // basılır (bkz. SEMBOL KISAYOLLARI bölümü).
    var symCombo = _noteSymbolShortcutComboFromEvent(e);
    if(symCombo && noteSymbolShortcuts[symCombo]){
      e.preventDefault();
      _saveNoteCursor(); // editör zaten focused — ANLIK caret'i taze kaydet ki
                          // insertNoteSymbolInline eski/alakasız bir konuma değil
                          // TAM ŞU AN yazının bulunduğu yere eklesin.
      insertNoteSymbolInline(noteSymbolShortcuts[symCombo]);
    }

    // BUG FIX: Listelerde (insertOrderedList/insertUnorderedList) boş bir
    // maddede Enter'a basmak tarayıcı tarafından native olarak listeden
    // çıkış sağlar (yeni normal paragraf açılır) — ama blockquote
    // (formatBlock:blockquote) için HİÇBİR tarayıcı bu davranışı sağlamaz,
    // bu yüzden Enter alıntı içinde sonsuza kadar yeni satır açıyordu,
    // kullanıcı alıntıdan çıkıp normal not yazmaya asla dönemiyordu.
    // _noteTryExitEmptyBlockquoteOnEnter listelerin native davranışını elle taklit eder.
    if(e.key === 'Enter' && !e.shiftKey){
      if(_noteTryExitEmptyBlockquoteOnEnter()){
        e.preventDefault();
        scheduleNoteSave();
      }
    }
  });

  // Windows+V / Ctrl+V ile yapıştırılan görselleri küçük thumbnail olarak ekle.
  // Görsel değilse ARCHITECTED PASTE SANITIZER devreye girer (aşağıda tanımlı) —
  // LaTeX/KaTeX/MathJax kalıntılarını ve üst/alt simgeleri temiz Unicode'a çevirip
  // caret konumuna düz metin olarak yapıştırır.
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
    // Görsel yok → metin yapıştırması. Varsayılan tarayıcı davranışını (zengin
    // HTML/stil bulaşması) ezip, sanitize edilmiş düz metni caret konumuna basıyoruz.
    e.preventDefault();
    _clearPendingNoteStyle();
    var rawText = (e.clipboardData && (e.clipboardData.getData('text/plain') || '')) || '';
    if(!rawText) return;
    var clean = sanitizePastedNoteText(rawText);
    if(!clean) return;
    var ok = false;
    try{ ok = document.execCommand('insertText', false, clean); }catch(ex){ ok = false; }
    if(!ok){
      // Tarayıcı insertText'i desteklemiyorsa (eski/garip durumlar) manuel ekle.
      _manualInsertPlainTextAtCaret(clean);
    }
    scheduleNoteSave();
  });

  // Toolbar butonlarına data-cmd ile genel handler bağla
  document.querySelectorAll('.notes-tb-btn[data-cmd]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var cmd = btn.getAttribute('data-cmd');
      // BUG FIX (2026-09): "Alıntı" butonu artık native execCommand yerine
      // _noteToggleBlockquote() üzerinden çalışır — caret zaten bir alıntı
      // içindeyse İÇİNE bir tane daha SARMAK yerine gerçek bir TOGGLE olarak
      // alıntıyı kaldırır (bkz. _noteToggleBlockquote üzerindeki yorum).
      if(cmd === 'formatBlock:blockquote'){
        _noteToggleBlockquote();
        return;
      }
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
        } else {
          // BUG FIX (kök neden): burada eskiden document.execCommand('foreColor'/
          // 'hiliteColor'/'backColor', ...) çağrılıyordu. styleWithCSS hiç
          // etkinleştirilmediği için bu, uygulamanın geri kalanının HİÇ tanımadığı
          // <font color="..."> etiketleri üretiyordu — note-style-span mimarisiyle
          // TUTARSIZ iki paralel temsil ortaya çıkıyordu. Kullanıcı seçili metni
          // yeniden renklendirip HEMEN ardından (seçim collapse olduğunda, örn.
          // Sağ Ok/tıklama ile) yazmaya devam ettiğinde, caret bazen bir <font>
          // etiketinin İÇİNDE/SINIRINDA kalıyordu ve _wrapLastTypedCharWithPendingStyle
          // bunu note-style-span sanmadığı için tutarsız/eski renkte devam ediyordu —
          // "rengi değiştirdim ama hâlâ eski renkte yazılıyor" hissi böyle sürüyordu.
          // ÇÖZÜM: seçili metin de artık _applyStyleToRange ile TAMAMEN AYNI
          // note-style-span mimarisine (execCommand'sız, elle DOM manipülasyonu)
          // yeniden yazılıyor — iki kod yolu (collapsed caret / seçili metin) artık
          // TEK bir tutarlı temsile çıkıyor. Detaylar için bkz. _applyStyleToRange.
          var prop = lockedTarget === 'text' ? 'color' : 'backgroundColor';
          var val = c === 'transparent' ? 'transparent' : c;
          var rangeToStyle = curSel && curSel.rangeCount > 0 ? curSel.getRangeAt(0) : null;
          if(rangeToStyle){
            _applyStyleToRange(rangeToStyle, prop, val);
            // Seçim collapse olup hemen devam yazılırsa (artık gerçek bir
            // note-style-span'ın içinde olacağı için tarayıcı doğal DOM
            // genişletmesiyle zaten doğru stilde devam eder) — yine de ekstra
            // bir güvenlik ağı olarak pending'i de eşitliyoruz, zararı olmaz.
            _setPendingNoteStyle(prop, val);
          }
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

  var result = _wrapLastTypedCharWithPendingStyle(range.startContainer, range.startOffset, _pendingNoteStyle);
  if(!result) return;

  // Aynı stildeki ardışık kardeş span'ları birleştir (bkz. _mergeAdjacentSameStyleSpans) —
  // sadece bir stil DEĞİŞİMİ yeni bir span yarattığında bir şey bulur, "aynı
  // stilde büyümeye devam etme" kısayolunda zaten yeni node oluşmaz.
  // KORUMA: result.node'u "korunan node" olarak veriyoruz ki merge sırasında
  // komşu span onu asla DOM'dan koparmasın — merge yönü otomatik olarak
  // result.node'u HER ZAMAN hayatta tutacak şekilde seçilir (bkz. fonksiyon
  // içindeki açıklama). Merge, korunan node'un ÖNÜNE metin eklerse (önceki
  // komşuyu emmek için "prepend" yönü kullanılırsa) offset kayar; döndürülen
  // `shift` değeriyle bunu telafi ediyoruz.
  var _mergeShift = result.node.parentNode ? _mergeAdjacentSameStyleSpans(result.node.parentNode.parentNode, result.node) : 0;
  result.offset += _mergeShift;

  // GÜVENLİK AĞI: yukarıdaki koruma sayesinde result.node artık merge
  // tarafından koparılamaz; bu kontrol normal şartlarda hiç tetiklenmemeli.
  // Yine de öngörülemeyen bir DOM durumuna karşı savunmacı olarak bırakıldı.
  if(!content.contains(result.node)) return;

  // Caret'i sarılan karakterin TAM SONUNA koy — böylece bir sonraki karakter
  // de aynı mantıkla (fonksiyonun içindeki "zaten doğru span" kontrolü
  // sayesinde) o span'a eklenmeye devam eder.
  var newRange = document.createRange();
  newRange.setStart(result.node, result.offset);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/* ══════════ BUG FIX: renk/vurgu DEĞİŞTİRME sırasında eski renkte yazmaya
   devam etme sorunu ══════════
   ESKİ DAVRANIŞ: kullanıcı kırmızı yazıp caret'i hiç oynatmadan beyaza
   geçtiğinde, bir sonraki karakter ESKİ (kırmızı) span'ın hâlâ İÇİNE
   sarılıyordu — çünkü caret o span'ın text node'unun tam sonunda duruyordu
   ve fonksiyon yeni stilli span'ı "parentOfNode = node.parentNode" (yani
   kırmızı span'ın KENDİSİ) içine ekliyordu. Yeni (beyaz) span teknik olarak
   kendi color:white'ını doğru uyguluyordu (iç içe elementte kendi stili
   kazanır) ama karakter karakter yazıldıkça bu iç içe geçme derinleşiyor,
   bazı tarayıcılarda caret normalizasyonu yüzünden bir sonraki karakter
   beklenmedik şekilde DIŞARIDAKİ (kırmızı) span'a düşebiliyordu — kullanıcı
   açısından "rengi değiştirdim ama yazı hâlâ eski renkte yazılmaya devam
   ediyor" gibi görünüyordu.

   KÖKTEN ÇÖZÜM: stil değiştiğinde yeni span'ı ESKİ span'ın İÇİNE DEĞİL,
   onunla AYNI SEVİYEYE (kardeş olarak) yerleştiriyoruz — bkz. aşağıdaki
   _wrapLastTypedCharWithPendingStyle. note-style-span'lar böylece HİÇBİR
   ZAMAN iç içe geçmez, hep DÜZ (flat) bir kardeş dizisi olarak kalır. Eski
   span'ın SAHİP OLDUĞU DİĞER stiller (örn. yazı rengi dururken sadece vurgu
   rengi değişiyorsa) yeni span'a KOPYALANIR ki bir stili değiştirmek
   diğerini kaybettirmesin. Bu mantık jsdom ile izole birim testlerle
   doğrulanmıştır (renk değiştirip devam yazma, vurgu+yazı rengi birleşimi,
   caret metin ORTASINDAYKEN stil değişimi dahil). */
function _wrapLastTypedCharWithPendingStyle(startNode, startOffset, pendingStyle){
  var node = startNode, offset = startOffset;

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
    var deepestText = _findLastTextNode(node);
    if(deepestText && deepestText.textContent.length > 0){
      node = deepestText;
      offset = node.textContent.length;
    } else {
      return null; // gerçekten boş, sarılacak karakter yok — pending bir sonraki input'ta tekrar denenir
    }
  }

  // Caret bir metin node'unda ve hemen önünde en az 1 karakter olmalı
  // (az önce yazılan karakter).
  if(offset < 1) return null;
  var charText = node.textContent.charAt(offset - 1);
  if(!charText) return null;

  var parent = node.parentNode;
  var isStyleSpan = !!(parent && parent.nodeType === 1 && parent.classList && parent.classList.contains('note-style-span'));

  // Eğer caret'in önündeki karakter ZATEN doğru stile sahip bir span
  // içindeyse (örn. art arda aynı renkte ikinci karakter yazılıyor), tekrar
  // sarmaya gerek yok — parentNode'u büyütüyoruz gibi davranır, DOM şişmez.
  // ÖNEMLİ: offset burada `node.textContent.length` DEĞİL, parametre olarak
  // gelen GERÇEK `offset` olmalı. Aksi halde kullanıcı MEVCUT (zaten aynı
  // pending stile sahip) metnin ORTASINA tıklayıp yeni karakter yazdığında
  // — örn. yazdığı yeşil bir cümlenin ortasına unuttuğu bir kelimeyi eklemek
  // için tekrar aynı rengi seçip yazmaya devam ettiğinde — caret yanlışlıkla
  // o span'ın en SONUNA fırlar (kullanıcı imlecin "zıpladığını", yazdığı
  // yerin dışında bir yere yazmaya devam ettiğini görür).
  if(isStyleSpan && node === parent.firstChild && node === parent.lastChild &&
     _noteSpanMatchesPendingStyle(parent, pendingStyle)){
    return { node: node, offset: offset };
  }

  // Tek karakteri ayrı bir text node'a böl.
  var beforeText = node.textContent.slice(0, offset - 1);
  var afterText  = node.textContent.slice(offset);

  var span = document.createElement('span');
  span.className = 'note-style-span';
  // Eski span'ın DİĞER stillerini (örn. arka plan rengi dururken sadece yazı
  // rengi değişiyorsa) yeni span'a devral — sonra pending olanı ÜZERİNE yaz.
  // setProperty/getPropertyValue kullanılır (bracket erişimi yalnızca CAMELCASE
  // isimlerle güvenilir çalışır; style.item(i) KEBAB-CASE döndürür).
  if(isStyleSpan){
    for(var i = 0; i < parent.style.length; i++){
      var propName = parent.style.item(i);
      span.style.setProperty(propName, parent.style.getPropertyValue(propName));
    }
  }
  span.style[pendingStyle.prop] = pendingStyle.value;
  span.appendChild(document.createTextNode(charText));

  if(isStyleSpan){
    // ÖNEMLİ FIX: yeni span'ı eski span'ın İÇİNE DEĞİL, onunla AYNI SEVİYEYE
    // (kardeş olarak, grandparent'a) yerleştir — bkz. yukarıdaki bug açıklaması.
    var grandparent = parent.parentNode;
    if(!grandparent) return null; // güvenlik: DOM'a bağlı olmayan bir node'a kardeş eklenemez

    if(beforeText){ node.textContent = beforeText; } // eski span'da kalan kısım (mevcut node'u mutasyona uğratmak yeterli)
    else { parent.removeChild(node); }

    if(afterText){
      // Nadiren olur (caret genelde span'ın sonunda) — caret metin ORTASINDA
      // konumlanmışken stil değiştirilirse tutarlılık için ele alınır: span'ın
      // KALAN kuyruğu, eski stilin AYNI kopyasıyla yeni span'dan SONRA kardeş
      // olarak eklenir.
      var afterSpan = document.createElement('span');
      afterSpan.className = 'note-style-span';
      for(var j = 0; j < parent.style.length; j++){
        var pn = parent.style.item(j);
        afterSpan.style.setProperty(pn, parent.style.getPropertyValue(pn));
      }
      afterSpan.appendChild(document.createTextNode(afterText));
      if(parent.nextSibling) grandparent.insertBefore(afterSpan, parent.nextSibling);
      else grandparent.appendChild(afterSpan);
    }

    if(parent.nextSibling) grandparent.insertBefore(span, parent.nextSibling);
    else grandparent.appendChild(span);
  } else {
    var beforeNode = beforeText ? document.createTextNode(beforeText) : null;
    var afterNode  = afterText ? document.createTextNode(afterText) : null;
    if(beforeNode) parent.insertBefore(beforeNode, node);
    parent.insertBefore(span, node);
    if(afterNode) parent.insertBefore(afterNode, node);
    parent.removeChild(node);
  }

  return { node: span.firstChild, offset: span.firstChild.textContent.length };
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

/* BUG FIX: eski _styleValueNormalized(prop, value) tarayıcının style'a HİÇ
   yazmadan, ham (normalize edilmemiş) _pendingNoteStyle.value string'ini
   doğrudan geri döndürüyordu — hâlbuki tarayıcılar bir renk inline style'a
   YAZILIR YAZILMAZ onu kendi iç formatına (örn. '#ffffff' -> 'rgb(255, 255,
   255)') çevirir. Bu yüzden karşılaştırma (span'ın GERÇEKTE sahip olduğu,
   normalize edilmiş değer) ile (ham, normalize edilmemiş pending değeri)
   arasında yapılıyordu — bu iki string neredeyse HİÇBİR ZAMAN eşleşmezdi,
   yani "zaten doğru span, tekrar sarmaya gerek yok" kısayolu neredeyse hiç
   tetiklenmiyordu (yanlış negatif — her karakterde gereksiz yeniden sarma,
   DOM şişmesi). Çözüm: gerçek bir <span> üzerinde AYNI atamayı yapıp
   tarayıcının KENDİSİNİN normalize ettiği sonucu okuyoruz (bir "probe"),
   böylece iki taraf da AYNI şekilde normalize edilmiş oluyor ve karşılaştırma
   tarayıcı/renk formatından bağımsız güvenilir çalışıyor. */
function _noteSpanMatchesPendingStyle(spanEl, pendingStyle){
  if(!pendingStyle) return false;
  var probe = document.createElement('span');
  probe.style[pendingStyle.prop] = pendingStyle.value;
  var wanted = probe.style[pendingStyle.prop];
  return !!wanted && spanEl.style[pendingStyle.prop] === wanted;
}

/* ══════════════════════════════════════════════════════════════════════
   BUG FIX (KÖK NEDEN): SEÇİLİ METİNDE renk/vurgu değiştirme
   ══════════════════════════════════════════════════════════════════════
   Yukarıdaki _wrapLastTypedCharWithPendingStyle SADECE caret collapsed
   (sadece imleç, seçim yok) durumundaki tek-karakter yazmayı düzeltiyordu.
   Kullanıcı GERÇEK BİR SEÇİM üzerinde renk/vurgu değiştirdiğinde ise kod
   document.execCommand('foreColor'/'hiliteColor'/'backColor', ...) kullanmaya
   devam ediyordu — styleWithCSS hiç etkinleştirilmediği için bu, uygulamanın
   geri kalanının hiç tanımadığı <font color="..."> etiketleri üretiyordu.
   note-style-span mimarisiyle TUTARSIZ bu ikinci temsil, kullanıcı seçili
   metni renklendirip HEMEN ardından yazmaya devam ettiğinde (caret bir <font>
   sınırında/içinde kalıp _wrapLastTypedCharWithPendingStyle'ın onu tanımaması
   yüzünden) "rengi değiştirdim ama hâlâ eski renkte yazılıyor" hissinin asıl
   kök nedeniydi — ilk tur düzeltmesi SADECE caret senaryosunu kapsadığı için
   sorun kısmen değil TAMAMEN çözülmemişti.

   ÇÖZÜM: execCommand'ı BÜTÜNÜYLE devre dışı bırakıp, seçili metni de collapsed
   caret ile AYNI note-style-span mimarisine, elle DOM manipülasyonuyla
   yeniden yazan bir motor. İki kod yolu (caret / seçim) artık TEK bir tutarlı
   temsile çıkıyor — font tag hiç üretilmiyor. jsdom ile izole birim testlerle
   doğrulanmıştır: düz metin, tek span içi kısmi seçim, iki FARKLI renkli
   span'a yayılan seçim (her iki uçtan kısmi çakışma dahil), hem stil hem düz
   metin karışık seçim, aynı metne renk ÜSTÜNE vurgu (birini diğerini
   silmeden), span'ın TAM içeriği, çok paragraflı seçim, bir span'ın TAM
   ORTASININ seçilmesi (iki taraftan da artık kalan). */

/* splitText() ile bir note-style-span İÇİNDE yeni oluşan bir kardeş text
   node'u, "her style-span TEK bir text node içerir" değişmezini korumak için
   HEMEN (stilini AYNEN koruyan bir klon span'a alıp) kardeş seviyeye çıkarır.
   Bu adım atlanırsa bir style-span GEÇİCİ olarak 2 çocuklu kalır ve sonraki
   restyle adımı "bu parça parent'ın hangi ucundaydı" bilgisini kaybedip
   parçaları YANLIŞ sırada kardeş olarak ekleyebilir. */
function _hoistStyleSpanSiblingText(newSiblingNode){
  var parent = newSiblingNode.parentNode;
  if(!parent || parent.nodeType !== 1 || !parent.classList || !parent.classList.contains('note-style-span')) return;
  var grandparent = parent.parentNode;
  if(!grandparent) return;
  var clone = document.createElement('span');
  clone.className = 'note-style-span';
  for(var i = 0; i < parent.style.length; i++){
    var pn = parent.style.item(i);
    clone.style.setProperty(pn, parent.style.getPropertyValue(pn));
  }
  clone.appendChild(newSiblingNode); // node'u eski span'dan koparıp yeni klona taşır
  if(parent.nextSibling) grandparent.insertBefore(clone, parent.nextSibling);
  else grandparent.appendChild(clone);
}

/* Range sınırlarını, TAM text-node kenarlarına denk gelecek şekilde böler
   (kısmen seçilmiş uç node'lar varsa). END ÖNCE bölünür — start/end AYNI
   text node'daysa, start'ı önce bölmek end offset'ini kaydırırdı. */
function _splitRangeTextBoundaries(range){
  var endContainer = range.endContainer, endOffset = range.endOffset;
  var startContainer = range.startContainer, startOffset = range.startOffset;

  if(endContainer.nodeType === 3 && endOffset > 0 && endOffset < endContainer.textContent.length){
    var newEndSibling = endContainer.splitText(endOffset);
    _hoistStyleSpanSiblingText(newEndSibling);
    range.setEnd(endContainer, endOffset);
  }
  if(startContainer.nodeType === 3 && startOffset > 0 && startOffset < startContainer.textContent.length){
    var newStartNode = startContainer.splitText(startOffset);
    _hoistStyleSpanSiblingText(newStartNode);
    range.setStart(newStartNode, 0);
  } else {
    range.setStart(startContainer, startOffset);
  }
}

/* Sınırları hizalandıktan SONRA, range'in İÇİNDE TAMAMEN kalan text node'ları
   DOM sırasıyla toplar. Range.comparePoint (tüm modern tarayıcılarda ve
   jsdom'da desteklenir) container tipinden (text/element) bağımsız güvenilir
   çalışır. */
function _collectFullTextNodesInRange(range){
  var root = range.commonAncestorContainer;
  if(root.nodeType === 3) return [root];
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  var result = [];
  var node;
  while((node = walker.nextNode())){
    if(node.length === 0) continue;
    var afterStart = range.comparePoint(node, 0) >= 0;
    var beforeEnd  = range.comparePoint(node, node.length) <= 0;
    if(afterStart && beforeEnd) result.push(node);
  }
  return result;
}

/* Tek bir text node'u (TAMAMEN, kısmi değil — bkz. yukarıdaki sınır bölme
   adımı) yeni bir stille yeniden sarar. _wrapLastTypedCharWithPendingStyle
   ile AYNI "eski span'ın İÇİNE değil, kardeş seviyesine yerleştir + eski
   span'ın DİĞER stillerini koru" mantığı — ama tek karakter yerine node'un
   TAM içeriği için (sınır bölme sayesinde bu fonksiyona gelen her node zaten
   "baştan sona" restyle edilmesi gereken parçadır, ayrıca bölmeye gerek yok). */
function _restyleWholeTextNode(node, prop, value){
  var parent = node.parentNode;
  if(!parent) return null;
  var isStyleSpan = !!(parent.nodeType === 1 && parent.classList && parent.classList.contains('note-style-span'));

  if(isStyleSpan && node === parent.firstChild && node === parent.lastChild &&
     _noteSpanMatchesPendingStyle(parent, {prop:prop, value:value})){
    return parent; // zaten doğru stilde, tek çocuk — dokunmaya gerek yok
  }

  var span = document.createElement('span');
  span.className = 'note-style-span';
  if(isStyleSpan){
    for(var i = 0; i < parent.style.length; i++){
      var propName = parent.style.item(i);
      span.style.setProperty(propName, parent.style.getPropertyValue(propName));
    }
  }
  span.style[prop] = value;

  if(isStyleSpan){
    var grandparent = parent.parentNode;
    if(!grandparent) return null;
    span.appendChild(node); // node'u eski span'dan koparıp yeni span'a taşır
    if(parent.childNodes.length === 0){
      // Beklenen/normal durum (hizalama sayesinde parent hep TEK çocukluydu):
      // eski span'ı TAMAMEN yeni span ile aynı konumda değiştir.
      grandparent.replaceChild(span, parent);
    } else {
      // Defansif fallback — normalde buraya girilmez.
      if(parent.nextSibling) grandparent.insertBefore(span, parent.nextSibling);
      else grandparent.appendChild(span);
    }
  } else {
    parent.insertBefore(span, node);
    span.appendChild(node);
  }
  return span;
}

function _sameNoteSpanStyle(a, b){
  if(a.style.length !== b.style.length) return false;
  for(var i = 0; i < a.style.length; i++){
    var p = a.style.item(i);
    if(a.style.getPropertyValue(p) !== b.style.getPropertyValue(p)) return false;
  }
  return true;
}
/* Ardışık, TAM AYNI stile sahip note-style-span kardeşlerini TEK span'a
   birleştirir. Salt bir "tidiness" adımı — birleştirmeden de sonuç görsel
   olarak zaten doğrudur, ama tekrar tekrar seç+renklendir yapıldıkça notun
   HTML'inin onlarca ufak span'a bölünüp şişmesini (ve kaydetme/localStorage
   maliyetinin zamanla büyümesini) önler.

   protectedNode (opsiyonel): çağıranın DOM'dan KOPMAMASINI garanti etmek
   istediği belirli bir text node (örn. kullanıcının az önce yazdığı
   karakter). Normalde iki komşu span eşleştiğinde SOL taraf (child) sağ
   tarafı (next) yutar ve next silinir — ama korunan node `next`'in İÇİNDE
   olduğunda bu, onu DOM'dan koparırdı (çağıran caret'i nereye koyacağını
   şaşırır, kullanıcı "renk değiştirmiyor / imleç zıplıyor" olarak yaşar).
   Bu durumda yön TERSİNE çevrilir: `child`'ın metni `next`'in BAŞINA
   eklenir ve `child` silinir — böylece korunan node HER ZAMAN hayatta
   kalan taraf olur. Bu ters yönde korunan node'un ÖNÜNE metin eklendiği
   için offset kayar; toplam kaç karakter kaydığını (shift) döndürürüz ki
   çağıran kendi offset'ini buna göre düzeltebilsin. */
function _mergeAdjacentSameStyleSpans(container, protectedNode){
  var shift = 0;
  if(!container) return shift;
  var child = container.firstChild;
  while(child){
    var next = child.nextSibling;
    if(child.nodeType === 1 && child.classList && child.classList.contains('note-style-span') &&
       next && next.nodeType === 1 && next.classList && next.classList.contains('note-style-span') &&
       child.childNodes.length === 1 && child.firstChild.nodeType === 3 &&
       next.childNodes.length === 1 && next.firstChild.nodeType === 3 &&
       _sameNoteSpanStyle(child, next)){
      if(protectedNode && protectedNode === next.firstChild && protectedNode !== child.firstChild){
        shift += child.firstChild.textContent.length;
        next.firstChild.textContent = child.firstChild.textContent + next.firstChild.textContent;
        container.removeChild(child);
        child = next; // taramaya hayatta kalan (korunan) node'dan devam et
      } else {
        child.firstChild.textContent += next.firstChild.textContent;
        container.removeChild(next);
        // aynı child'ı BİR SONRAKİ komşuyla tekrar dene (3'lü+ zincir birleşmesi için)
      }
      continue;
    }
    child = next;
  }
  return shift;
}

/* Seçili (collapsed OLMAYAN) bir Range'i verilen stille yeniden yazar —
   execCommand YERİNE geçer. Adımlar: (1) sınırları text-node kenarına hizala,
   (2) range içinde TAM kalan text node'ları topla, (3) her birini kardeş
   seviyesinde yeniden sar, (4) ardışık aynı-stilli kardeşleri birleştir. */
function _applyStyleToRange(range, prop, value){
  if(!range || range.collapsed) return null;
  var container = range.commonAncestorContainer;
  if(container.nodeType === 3) container = container.parentNode;
  _splitRangeTextBoundaries(range);
  var textNodes = _collectFullTextNodesInRange(range);
  if(textNodes.length === 0) return null;
  var resultSpans = textNodes.map(function(tn){ return _restyleWholeTextNode(tn, prop, value); }).filter(Boolean);
  if(resultSpans.length === 0) return null;
  var lastResultSpan = resultSpans[resultSpans.length - 1];
  // Son span'ın text node'unu koru: seçip renklendirdikten hemen sonra o
  // noktadan devam yazan kullanıcı için (bkz. openNoteColorPopup'taki
  // _setPendingNoteStyle güvenlik ağı) döndürülen lastSpan referansının
  // merge'den sonra da hâlâ DOM'da geçerli olduğundan emin oluyoruz.
  _mergeAdjacentSameStyleSpans(container, lastResultSpan.firstChild);
  return { firstSpan: resultSpans[0], lastSpan: lastResultSpan };
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

/* ══════════ ARCHITECTED PASTE SANITIZER ══════════
   ChatGPT / Gemini / Claude gibi araçlardan kopyalanan metinlerde üç tip
   "kirli" içerik gelir:
   1) Çiğ LaTeX komutları: \alpha, \sqrt{2}, \Delta, x^{2}, H_2O
   2) KaTeX/MathJax'in render ettiği HTML'den clipboard'a düşen kalıntı metin
      (örn. "x2" yapışıp üstsimgesi kaybolması, ya da "​" gibi sıfır genişlikli
      boşluklarla bölünmüş simgeler)
   3) Düz Unicode üst/alt simge istekleri (kullanıcı x^2 yazdığında x² bekler)

   STRATEJİ: clipboard'dan SADECE text/plain alınır (HTML hiç kullanılmaz —
   bu, MathJax/KaTeX'in ürettiği <span class="katex">, stil, renk gibi tüm
   "kirliliği" otomatik olarak eler). Ardından bu düz metin üstünde, en
   spesifik (en uzun / en yapısal) kalıplardan en genele doğru sırayla RegEx
   tabanlı dönüşümler uygulanır. Sıralama kritiktir: \sqrt{x} gibi parantezli
   yapılar, \alpha gibi yalın komutlardan ÖNCE işlenmelidir; aksi halde önce
   "\s" gibi bir alt-string yanlış eşleşip yapıyı bozabilir. */

/* Tek harfli LaTeX Yunan/komut haritası — en uzun isimden en kısaya sıralı
   olmasına RegEx aşamasında zaten dikkat edilir (longest-match), bu obje
   sadece lookup tablosu görevi görür. */
var LATEX_SYMBOL_MAP = {
  // Yunan alfabesi (küçük)
  'alpha':'α','beta':'β','gamma':'γ','delta':'δ','epsilon':'ε','varepsilon':'ε',
  'zeta':'ζ','eta':'η','theta':'θ','vartheta':'ϑ','iota':'ι','kappa':'κ',
  'lambda':'λ','mu':'μ','nu':'ν','xi':'ξ','pi':'π','varpi':'ϖ','rho':'ρ',
  'varrho':'ϱ','sigma':'σ','varsigma':'ς','tau':'τ','upsilon':'υ','phi':'φ',
  'varphi':'ϕ','chi':'χ','psi':'ψ','omega':'ω',
  // Yunan alfabesi (büyük)
  'Alpha':'Α','Beta':'Β','Gamma':'Γ','Delta':'Δ','Epsilon':'Ε','Zeta':'Ζ',
  'Eta':'Η','Theta':'Θ','Iota':'Ι','Kappa':'Κ','Lambda':'Λ','Mu':'Μ','Nu':'Ν',
  'Xi':'Ξ','Pi':'Π','Rho':'Ρ','Sigma':'Σ','Tau':'Τ','Upsilon':'Υ','Phi':'Φ',
  'Chi':'Χ','Psi':'Ψ','Omega':'Ω',
  // Operatörler / semboller
  'pm':'±','mp':'∓','times':'×','div':'÷','cdot':'·','ast':'∗','star':'⋆',
  'infty':'∞','partial':'∂','nabla':'∇','sum':'∑','prod':'∏','int':'∫',
  'oint':'∮','approx':'≈','neq':'≠','ne':'≠','equiv':'≡','leq':'≤','le':'≤',
  'geq':'≥','ge':'≥','ll':'≪','gg':'≫','propto':'∝','sim':'∼','simeq':'≃',
  'cong':'≅','perp':'⊥','parallel':'∥','angle':'∠','triangle':'△',
  'forall':'∀','exists':'∃','nexists':'∄','emptyset':'∅','varnothing':'∅',
  'in':'∈','notin':'∉','ni':'∋','subset':'⊂','supset':'⊃','subseteq':'⊆',
  'supseteq':'⊇','cup':'∪','cap':'∩','setminus':'∖','wedge':'∧','land':'∧',
  'vee':'∨','lor':'∨','neg':'¬','lnot':'¬','oplus':'⊕','ominus':'⊖',
  'otimes':'⊗','oslash':'⊘','top':'⊤','bot':'⊥','therefore':'∴',
  'because':'∵','degree':'°','prime':'′','dprime':'″',
  // Oklar
  'rightarrow':'→','to':'→','leftarrow':'←','leftrightarrow':'↔',
  'uparrow':'↑','downarrow':'↓','updownarrow':'↕',
  'Rightarrow':'⇒','Leftarrow':'⇐','Leftrightarrow':'⇔',
  'mapsto':'↦','longrightarrow':'⟶','longleftarrow':'⟵',
  // Noktalar / çeşitli
  'ldots':'…','cdots':'⋯','vdots':'⋮','ddots':'⋱','dots':'…'
};

/* Unicode üstsimge/altsimge haritaları — x^2 → x², H_2O → H₂O gibi
   dönüşümler için. Sadece bu karakter setinde Unicode üst/alt simge KARŞILIĞI
   bulunan karakterler desteklenir (tüm harfler için üstsimge Unicode'da
   mevcut değildir, bu durumda orijinal karakter aynen bırakılır). */
var SUPERSCRIPT_MAP = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ',
  'a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','j':'ʲ',
  'k':'ᵏ','l':'ˡ','m':'ᵃ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ',
  'v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ'
};
var SUBSCRIPT_MAP = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
  'a':'ₐ','e':'ₑ','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ',
  'o':'ₒ','p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ'
};

/* Bir dizgiyi (örn. "23" veya "abc") karşılık haritasından geçirip
   Unicode üst/alt simge dizisine çevirir. Haritada karşılığı OLMAYAN bir
   karakterle karşılaşırsa, o karakteri OLDUĞU GİBİ bırakır — sessizce
   veri kaybetmek yerine "kısmi dönüşüm" yapılır, bu görsel olarak hatalı
   ama bilgi-kaybı içermeyen tek seçenektir. */
function _mapScriptChars(str, map){
  var out = '';
  for(var i = 0; i < str.length; i++){
    var ch = str[i];
    out += map.hasOwnProperty(ch) ? map[ch] : ch;
  }
  return out;
}

/* notes.js'in ana sanitize fonksiyonu. Sıra ÖNEMLİDİR:
   1. KaTeX/MathJax DOM kalıntılarının (varsa) en sık görülen ASCII izlerini temizle
   2. Parantezli LaTeX komutları (\sqrt{..}, \frac{a}{b}, \text{..}) — yapısal,
      önce işlenmeli yoksa içindeki \alpha gibi alt-komutlar karışır
   3. Üst/alt simge yazımı: x^{12}, x^2, H_{2}, H_2
   4. Yalın LaTeX komutları (\alpha, \rightarrow, ...) — en uzun isimden en
      kısaya sıralı RegEx ile (longest-match, "\to" "\theta"yı yanlış kesmesin)
   5. Kalan yapısal LaTeX gürültüsü ($ $, $$ $$, \[ \], \( \), gereksiz {})
   6. Boşluk/satır temizliği (NBSP, zero-width space, >2 ardışık boş satır) */
function sanitizePastedNoteText(text){
  if(!text) return '';
  var out = text;

  // 1) Zero-width space ve NBSP gibi görünmez karakterleri normalize et
  //    (KaTeX/MathJax render'larından clipboard'a sıklıkla bu sızar).
  out = out.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
  out = out.replace(/\u00A0/g, ' ');

  // 2) \sqrt{...} → √(...) — iç içe basit bir parantez kapatma (tek seviye
  //    iç içe küme parantezini de tolere eder, örn. \sqrt{x^{2}+1}).
  out = out.replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, function(_, inner){
    return '√(' + inner.replace(/[{}]/g, '') + ')';
  });
  out = out.replace(/\\sqrt\s*([0-9a-zA-Zα-ωΑ-Ω])/g, '√$1'); // \sqrt2 / \sqrt x (parantezsiz kısa form)

  // 3) \frac{a}{b} → (a)/(b)  — kesirleri okunabilir düz metne çevir
  out = out.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, function(_, a, b){
    return '(' + a.replace(/[{}]/g, '') + ')/(' + b.replace(/[{}]/g, '') + ')';
  });

  // 4) \text{...}, \mathrm{...}, \mathbf{...} gibi "içeriği aynen yazdır" sarmalayıcıları aç
  out = out.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, '$1');

  // 5) Üstsimge: x^{12} veya x^2 / x^a → Unicode üstsimge (haritada karşılığı
  //    olan karakterler için). Küme parantezli (çoklu karakter) önce işlenir.
  out = out.replace(/\^\{([^{}]+)\}/g, function(_, inner){ return _mapScriptChars(inner, SUPERSCRIPT_MAP); });
  out = out.replace(/\^([0-9a-zA-Z+\-=()])/g, function(_, ch){ return _mapScriptChars(ch, SUPERSCRIPT_MAP); });

  // 6) Altsimge: H_{2}O veya H_2O → Unicode altsimge
  out = out.replace(/_\{([^{}]+)\}/g, function(_, inner){ return _mapScriptChars(inner, SUBSCRIPT_MAP); });
  out = out.replace(/_([0-9a-zA-Z+\-=()])/g, function(_, ch){ return _mapScriptChars(ch, SUBSCRIPT_MAP); });

  // 7) Yalın LaTeX komutları: \alpha, \rightarrow, \leq, vb.
  //    En uzun komut isminden en kısaya sıralanmış tek bir RegEx kullanılır;
  //    böylece "\to" işlenirken "\t" gibi bir alt-string'in yanlışlıkla
  //    önce eşleşip komutu yarıda kesmesi engellenir (longest-match prensibi).
  var sortedKeys = Object.keys(LATEX_SYMBOL_MAP).sort(function(a,b){ return b.length - a.length; });
  var latexPattern = new RegExp('\\\\(' + sortedKeys.join('|') + ')(?![a-zA-Z])', 'g');
  out = out.replace(latexPattern, function(_, name){ return LATEX_SYMBOL_MAP[name]; });

  // 8) Kalan matematik-modu sarmalayıcıları ($...$, $$...$$, \(...\), \[...\])
  //    artık içleri temizlendiği için sadece zarfı (delimiter) at.
  out = out.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  out = out.replace(/\$([^$\n]*?)\$/g, '$1');
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, '$1');

  // 9) İşlenmemiş kalan tek/çift küme parantezlerini (LaTeX grup sözdizimi
  //    kalıntısı) temizle — ama normal metindeki parantezleri etkilemesin
  //    diye sadece içinde HİÇ harf/rakam barındırmayan boş {} veya tek
  //    karakterli {x} kalıntılarını hedefliyoruz.
  out = out.replace(/\{\}/g, '');

  // 10) Satır sonu / boşluk normalize: 3+ ardışık boş satırı 2'ye indir,
  //     satır başı/sonu trailing boşlukları temizle.
  out = out.replace(/[ \t]+\n/g, '\n');
  out = out.replace(/\n{3,}/g, '\n\n');

  return out;
}

/* document.execCommand('insertText') tarayıcı tarafından desteklenmiyorsa
   (çok eski/garip ortamlar) kullanılan manuel fallback: Range.insertNode ile
   düz bir text node'u caret konumuna sokar ve caret'i metnin SONUNA taşır. */
function _manualInsertPlainTextAtCaret(text){
  var sel = window.getSelection();
  if(!sel || sel.rangeCount === 0) return;
  var range = sel.getRangeAt(0);
  range.deleteContents();
  var node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ══════════ SEMBOL KISAYOLLARI (orta-tık ile atama) ══════════
   Herhangi bir sembole ORTA TIK (mouse tekerlek tuşu) ile basılırsa küçük
   bir "kısayol ata ve dinle" paneli açılır — kullanıcı bir tuş kombinasyonuna
   basar, panel onu YAKALAR ve gösterir, "Kaydet" ile onaylanır. Bundan sonra
   not editörü İÇİNDE o kombinasyona basmak sembolü doğrudan caret konumuna
   ekler — sembol panelini hiç açmaya gerek kalmaz (bkz. content'in keydown
   handler'ındaki kullanım).

   Depolama: { [comboKey]: symbol } — comboKey e.code tabanlıdır (KLAVYE
   DÜZENİNDEN ve SHIFT'TEN bağımsız, örn. 'Ctrl+Digit1' — Türkçe klavyede de
   ABD klavyesinde de aynı fiziksel tuş aynı comboKey'i üretir), görüntüleme
   için _noteSymbolShortcutLabel ile sadeleştirilir ('Ctrl+1'). Bir sembolün
   en fazla 1 kısayolu, bir kısayolun en fazla 1 sembolü olabilir (1:1). */
var LS_NOTE_SYMBOL_SHORTCUTS = 'aha_note_symbol_shortcuts_v1';
var noteSymbolShortcuts = {};
(function _loadNoteSymbolShortcuts(){
  try{
    var raw = localStorage.getItem(LS_NOTE_SYMBOL_SHORTCUTS);
    noteSymbolShortcuts = raw ? JSON.parse(raw) : {};
  }catch(e){ noteSymbolShortcuts = {}; }
  if(!noteSymbolShortcuts || typeof noteSymbolShortcuts !== 'object') noteSymbolShortcuts = {};
})();
function _saveNoteSymbolShortcuts(){
  try{ localStorage.setItem(LS_NOTE_SYMBOL_SHORTCUTS, JSON.stringify(noteSymbolShortcuts)); }catch(e){}
}

// Not editöründe ZATEN kullanılan kombinasyonlar (bkz. content'in keydown
// handler'ı) — sembol kısayolu olarak atanmaya çalışılırsa reddedilir.
// Hem Ctrl hem Meta (Mac Cmd) sürümleri korunur, çünkü B/I/U handler'ı da
// ikisini birden kabul ediyor ((e.ctrlKey||e.metaKey)).
var _NOTE_SYMBOL_RESERVED_COMBOS = {
  'Ctrl+KeyB':'Kalın', 'Meta+KeyB':'Kalın',
  'Ctrl+KeyI':'İtalik', 'Meta+KeyI':'İtalik',
  'Ctrl+KeyU':'Altı Çizili', 'Meta+KeyU':'Altı Çizili'
};

/* Bir keydown event'inden İÇ KULLANIM anahtarı türetir (e.code tabanlı —
   klavye düzeni/Shift'ten bağımsız). SADECE modifier tuşu basılıyken (henüz
   gerçek bir tuş yokken) VEYA hiç Ctrl/Alt/Meta yokken null döner — ikinci
   kural olmasa her sıradan harf tuşu bir "kısayol" sayılıp normal yazmayı
   kırardı. */
function _noteSymbolShortcutComboFromEvent(e){
  var code = e.code;
  if(!code) return null;
  if(code.indexOf('Control')===0 || code.indexOf('Shift')===0 || code.indexOf('Alt')===0 ||
     code.indexOf('Meta')===0 || code.indexOf('OS')===0) return null;
  if(!e.ctrlKey && !e.altKey && !e.metaKey) return null;
  var parts = [];
  if(e.ctrlKey) parts.push('Ctrl');
  if(e.altKey) parts.push('Alt');
  if(e.shiftKey) parts.push('Shift');
  if(e.metaKey) parts.push('Meta');
  parts.push(code);
  return parts.join('+');
}
/* İç anahtarı OKUNAKLI gösterime çevirir: 'Ctrl+Shift+Digit1' -> 'Ctrl+Shift+1'. */
function _noteSymbolShortcutLabel(comboKey){
  return comboKey
    .replace(/Digit(\d)/, '$1')
    .replace(/Key([A-Z])/, '$1')
    .replace(/Numpad(\d)/, 'Num$1')
    .replace(/Arrow(Up|Down|Left|Right)/, '$1');
}
function _noteSymbolFindShortcutForSymbol(sym){
  for(var k in noteSymbolShortcuts){
    if(noteSymbolShortcuts[k] === sym) return k;
  }
  return null;
}

var _nssTargetSymbol = null;
var _nssCapturedCombo = null;

function openNoteSymbolShortcutAssign(sym, anchorEl){
  _nssTargetSymbol = sym;
  _nssCapturedCombo = null;

  var popup = document.getElementById('noteSymbolShortcutPopup');
  if(!popup) return;
  document.getElementById('nssSymbolPreview').textContent = sym;
  document.getElementById('nssWarning').style.display = 'none';
  document.getElementById('nssActions').style.display = 'none';

  var listenZone = document.getElementById('nssListenZone');
  listenZone.classList.remove('listening');
  listenZone.innerHTML = 'Bir tuş kombinasyonuna bas...<br><span style="font-size:9px;opacity:0.7">(Ctrl / Alt / Cmd + bir tuş)</span>';

  var existing = _noteSymbolFindShortcutForSymbol(sym);
  var currentRow = document.getElementById('nssCurrentRow');
  if(existing){
    currentRow.style.display = 'flex';
    document.getElementById('nssCurrentLabel').textContent = _noteSymbolShortcutLabel(existing);
  } else {
    currentRow.style.display = 'none';
  }

  popup.style.display = 'block';
  var rect = anchorEl.getBoundingClientRect();
  var popupWidth = 220;
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - popupWidth - 12)) + 'px';

  document.addEventListener('keydown', _noteSymbolShortcutListenKeydown, true);
  setTimeout(function(){ document.addEventListener('mousedown', _nssOutsideClick); }, 10);
}
function closeNoteSymbolShortcutAssign(){
  var popup = document.getElementById('noteSymbolShortcutPopup');
  if(popup) popup.style.display = 'none';
  document.removeEventListener('keydown', _noteSymbolShortcutListenKeydown, true);
  document.removeEventListener('mousedown', _nssOutsideClick);
  _nssTargetSymbol = null;
  _nssCapturedCombo = null;
}
function _nssOutsideClick(e){
  var popup = document.getElementById('noteSymbolShortcutPopup');
  if(popup && !popup.contains(e.target)){
    closeNoteSymbolShortcutAssign();
  }
}
/* Panel açıkken document üzerinde CAPTURE fazında dinler (true parametresi) —
   böylece not editörünün kendi Ctrl+B/I/U handler'ından VEYA herhangi bir
   başka sayfa kısayolundan ÖNCE araya girip tuşu yakalar ve olayı durdurur. */
function _noteSymbolShortcutListenKeydown(e){
  if(e.key === 'Escape'){ e.preventDefault(); closeNoteSymbolShortcutAssign(); return; }
  if(e.key === 'Tab') return; // odak gezinmesini bozma

  var combo = _noteSymbolShortcutComboFromEvent(e);
  if(!combo) return; // sadece modifier basılı ya da hiç modifier yok — bekle

  e.preventDefault();
  e.stopPropagation();

  var warning = document.getElementById('nssWarning');
  if(_NOTE_SYMBOL_RESERVED_COMBOS[combo]){
    warning.style.display = 'block';
    warning.textContent = '⚠️ Bu kombinasyon "' + _NOTE_SYMBOL_RESERVED_COMBOS[combo] + '" için ayrılmış, başka bir kombinasyon dene.';
    document.getElementById('nssActions').style.display = 'none';
    _nssCapturedCombo = null;
    return;
  }

  _nssCapturedCombo = combo;
  var listenZone = document.getElementById('nssListenZone');
  listenZone.classList.add('listening');
  listenZone.textContent = _noteSymbolShortcutLabel(combo);

  var conflictSym = noteSymbolShortcuts[combo];
  if(conflictSym && conflictSym !== _nssTargetSymbol){
    warning.style.display = 'block';
    warning.textContent = '⚠️ Bu kısayol zaten "' + conflictSym + '" sembolüne atanmış. Kaydedersen ondan alınıp buna atanacak.';
  } else {
    warning.style.display = 'none';
  }
  document.getElementById('nssActions').style.display = 'flex';
}
function saveNoteSymbolShortcutAssign(){
  if(!_nssCapturedCombo || !_nssTargetSymbol) return;
  // Bu sembolün ESKİ kısayolunu temizle (bir sembolün en fazla 1 kısayolu olur)
  var oldCombo = _noteSymbolFindShortcutForSymbol(_nssTargetSymbol);
  if(oldCombo) delete noteSymbolShortcuts[oldCombo];
  // Bu kombinasyon BAŞKA bir sembole atanmışsa ondan alınır (1 kombinasyon = 1 sembol)
  noteSymbolShortcuts[_nssCapturedCombo] = _nssTargetSymbol;
  _saveNoteSymbolShortcuts();
  showToast('⌨️ "' + _nssTargetSymbol + '" → ' + _noteSymbolShortcutLabel(_nssCapturedCombo));
  closeNoteSymbolShortcutAssign();
  renderNoteSymbolPanel();
}
function removeNoteSymbolShortcutAssign(){
  if(!_nssTargetSymbol) return;
  var existing = _noteSymbolFindShortcutForSymbol(_nssTargetSymbol);
  if(existing){
    delete noteSymbolShortcuts[existing];
    _saveNoteSymbolShortcuts();
    showToast('⌨️ Kısayol kaldırıldı.');
  }
  closeNoteSymbolShortcutAssign();
  renderNoteSymbolPanel();
}

/* ══════════ SEMBOL PANELİ (Matematik / Yunan / Ok / Para / Mantık / Geometri) ══════════
   Tek bir veri yapısı üzerinden render edilir, böylece yeni bir kategori
   eklemek tek satırlık bir obje eklemekten ibarettir. Her tıklama, editörün
   SON KAYDEDİLEN caret konumuna (_savedNoteCursorRange) inline metin olarak
   sembolü basar — blok ekleme (insertNoteBlockHtml) gibi paragraf kesmez,
   yazı akışını bozmaz. */
var NOTE_SYMBOL_CATEGORIES = [
  { id:'math',  label:'Matematik',     icon:'functions',
    symbols:['√','²','³','π','∑','∞','∫','∂','±','÷','×','≈','≠','≡','≤','≥'] },
  { id:'greek', label:'Yunan Alfabesi', icon:'language',
    symbols:['α','β','γ','δ','Δ','θ','λ','μ','π','Ω','σ','Σ'] },
  { id:'arrow', label:'Oklar',          icon:'trending_flat',
    symbols:['→','←','↑','↓','↔','↕','⇒','⇐','⇔'] },
  { id:'currency', label:'Para Birimleri', icon:'payments',
    symbols:['€','$','£','₺','¥','₿'] },
  { id:'logic', label:'Mantık / Küme',  icon:'category',
    symbols:['¬','∧','∨','⊕','∈','∉','⊂','⊃','⊆','⊇','∅','∩','∪'] },
  { id:'geo',   label:'Geometri / Şekil', icon:'shapes',
    symbols:['∠','⊥','∆','∡','≅','○','□','◊','⋆','★','✔','✖'] }
];
var _noteSymbolActiveCat = 'math';

/* Not editörü açıkken toolbar'dan çağrılır. Panel açılmadan ÖNCE caret
   konumunu kaydediyoruz — overlay/modal focus'u editörden çalacağı için,
   bu adım atlanırsa kullanıcı panelde sembole tıkladığında "son bilinen
   konum" kaybolur ve sembol metnin sonuna düşebilir. */
function toggleNoteSymbolPanel(){
  var ov = document.getElementById('noteSymbolPanelOv');
  if(!ov) return;
  if(ov.classList.contains('open')){
    closeNoteSymbolPanel();
    return;
  }
  _saveNoteCursor();
  renderNoteSymbolPanel();
  ov.classList.add('open');
  ov._esc = function(e){ if(e.key === 'Escape') closeNoteSymbolPanel(); };
  document.addEventListener('keydown', ov._esc);
  ov._outsideClick = function(e){ if(e.target === ov) closeNoteSymbolPanel(); };
  ov.addEventListener('click', ov._outsideClick);
}
function closeNoteSymbolPanel(){
  var ov = document.getElementById('noteSymbolPanelOv');
  if(!ov) return;
  ov.classList.remove('open');
  if(ov._esc){ document.removeEventListener('keydown', ov._esc); ov._esc = null; }
  if(ov._outsideClick){ ov.removeEventListener('click', ov._outsideClick); ov._outsideClick = null; }
  // Panel kapanınca focus'u ve caret'i editöre geri ver — kullanıcı panel
  // kapandığı anda yazmaya devam edebilsin, tekrar editöre tıklamak zorunda kalmasın.
  _restoreNoteCursor();
}
function setNoteSymbolCategory(catId){
  _noteSymbolActiveCat = catId;
  renderNoteSymbolPanel();
}
function renderNoteSymbolPanel(){
  var tabsEl = document.getElementById('noteSymbolTabs');
  var gridEl = document.getElementById('noteSymbolGrid');
  if(!tabsEl || !gridEl) return;

  tabsEl.innerHTML = '';
  NOTE_SYMBOL_CATEGORIES.forEach(function(cat){
    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'io-tab note-symbol-tab' + (cat.id === _noteSymbolActiveCat ? ' active' : '');
    tab.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;vertical-align:-2px;margin-right:4px">'+cat.icon+'</span>'+cat.label;
    tab.addEventListener('click', function(){ setNoteSymbolCategory(cat.id); });
    tabsEl.appendChild(tab);
  });

  var activeCat = NOTE_SYMBOL_CATEGORIES.find(function(c){ return c.id === _noteSymbolActiveCat; }) || NOTE_SYMBOL_CATEGORIES[0];
  gridEl.innerHTML = '';
  activeCat.symbols.forEach(function(sym){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'note-symbol-btn';
    btn.textContent = sym;
    // mousedown'da preventDefault — buton tıklaması editördeki focus'u/caret'i
    // ÇALMASIN, aksi halde _savedNoteCursorRange ile gerçek DOM caret'i
    // arasında senkron kayar (renk popup'ındaki aynı problem deseni). Bu ayrıca
    // orta-tıkın Windows'ta otomatik kaydırma ikonu / Linux'ta birincil seçimi
    // yapıştırma gibi varsayılan davranışlarını da engeller.
    btn.addEventListener('mousedown', function(e){ e.preventDefault(); });
    btn.addEventListener('click', function(e){
      if(e.button !== 0) return; // sadece SOL tık sembolü ekler
      insertNoteSymbolInline(sym);
    });
    // ORTA TIK (mouse tekerlek tuşu) = kısayol atama mini panelini aç.
    btn.addEventListener('mouseup', function(e){
      if(e.button === 1){
        e.preventDefault();
        e.stopPropagation();
        openNoteSymbolShortcutAssign(sym, btn);
      }
    });

    var existingCombo = _noteSymbolFindShortcutForSymbol(sym);
    if(existingCombo){
      btn.title = 'Ekle: ' + sym + ' — Kısayol: ' + _noteSymbolShortcutLabel(existingCombo) + ' (orta tık: değiştir)';
      var badge = document.createElement('span');
      badge.className = 'note-symbol-shortcut-badge';
      btn.appendChild(badge);
    } else {
      btn.title = 'Ekle: ' + sym + ' (orta tık: kısayol ata)';
    }
    gridEl.appendChild(btn);
  });
}

/* Sembolü, editörün KAYDEDİLMİŞ caret konumuna inline metin olarak basar.
   insertNoteBlockHtml'in aksine paragraf/blok AÇMAZ — salt metin ekler,
   yazı akışı kesilmeden devam eder. Ekleme sonrası caret, sembolün TAM
   ARDINA taşınır ki üst üste sembole tıklayınca art arda eklenebilsin. */
function insertNoteSymbolInline(sym){
  var content = document.getElementById('noteEditorContent');
  if(!content) return;
  content.focus();

  var targetRange = _savedNoteCursorRange;
  if(targetRange && content.contains(targetRange.startContainer)){
    try{
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(targetRange);
    }catch(ex){ targetRange = null; }
  }

  if(!targetRange || !content.contains(targetRange.startContainer)){
    // Kayıtlı/geçerli bir konum yoksa içerik sonuna ekle (sessizce veri
    // kaybetmek yerine her zaman GÖRÜNÜR bir yere yazmak tercih edilir).
    var p = document.createElement('p');
    p.textContent = sym;
    content.appendChild(p);
    var nr = document.createRange();
    nr.selectNodeContents(p);
    nr.collapse(false);
    var s2 = window.getSelection();
    s2.removeAllRanges();
    s2.addRange(nr);
    _savedNoteCursorRange = nr.cloneRange();
    scheduleNoteSave();
    return;
  }

  var ok = false;
  try{ ok = document.execCommand('insertText', false, sym); }catch(ex){ ok = false; }
  if(!ok){ _manualInsertPlainTextAtCaret(sym); }

  // Ekleme sonrası GÜNCEL caret'i tekrar kaydet — bir sonraki sembol
  // tıklamasında "sembolün hemen ardına" eklensin, eski konuma değil.
  var selAfter = window.getSelection();
  if(selAfter && selAfter.rangeCount > 0){
    _savedNoteCursorRange = selAfter.getRangeAt(0).cloneRange();
  }
  scheduleNoteSave();
}


/* ══════════ INSERT BLOCK HELPER ══════════ */
function insertNoteBlockHtml(html){
  var content = document.getElementById('noteEditorContent');
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

/* PDF: önce overlay'de iframe ile aç, yeni sekme butonu da sun
   ────────────────────────────────────────────────────────────────
   BUG FIX (tekrar girişten sonra "PDF bir türlü açılmıyor"):
   Eskiden bu fonksiyon data-pdf-src attribute'unu OLDUĞU GİBİ okuyup
   doğrudan iframe.src'ye basıyordu — sayfa açılışında BİR KEZ çalışan arka
   plan hydrate'i (ahaHydrateHtmlAssets, bkz. openNotePage) o ana kadar
   Drive'dan indirmeyi bitirmemişse (ör. Google girişi henüz tamamlanmamışsa,
   ağ yavaşsa) attribute hâlâ çözülmemiş bir "aha-asset://driveId" placeholder
   string'iydi. Bu geçersiz bir URL şeması olduğundan iframe hiçbir zaman
   yüklenmiyordu, hiçbir hata da gösterilmiyordu — kullanıcı süresiz bekliyordu.
   Artık TIKLAMA ANINDA kendi çözümünü kendisi (yeniden) dener: hydrate zaten
   başarılıysa anında açar, başarısız/tamamlanmamışsa burada tekrar dener ve
   net bir "İndiriliyor / Başarısız, tekrar dene" geri bildirimi gösterir. */
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
        '<div style="position:relative;flex:1;min-height:0">' +
          '<iframe id="notePdfPreviewFrame" src="" style="width:100%;height:100%;border:none;border-radius:0 0 12px 12px;"></iframe>' +
          '<div id="notePdfPreviewStatus" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;background:var(--surface,#1a1b21);border-radius:0 0 12px 12px;text-align:center;padding:20px"></div>' +
        '</div>' +
      '</div>';
    ov.addEventListener('click', function(e){ if(e.target === ov) closeNotePdfPreview(); });
    document.body.appendChild(ov);
  }
  document.getElementById('notePdfPreviewTitle').textContent = name;
  ov.classList.add('open');
  ov._esc = function(e){ if(e.key === 'Escape') closeNotePdfPreview(); };
  document.addEventListener('keydown', ov._esc);
  ov._retry = function(){ _noteResolvePdfPreview(ov, el); };
  _noteResolvePdfPreview(ov, el);
}

/* el.data-pdf-src ya doğrudan kullanılabilir bir data-URI'dir (yerel/zaten
   hydrate edilmiş) ya da henüz çözülmemiş bir "aha-asset://driveId"
   placeholder'ıdır. Overlay her açıldığında (ve "Tekrar Dene" ile) buradan
   geçer — böylece sayfa-açılışındaki tek seferlik arka plan hydrate'i
   başarısız olsa BİLE PDF bir daha asla açılamaz hâle gelmez. */
function _noteResolvePdfPreview(ov, el){
  var frame = document.getElementById('notePdfPreviewFrame');
  var status = document.getElementById('notePdfPreviewStatus');
  var src = el.getAttribute('data-pdf-src');
  ov._pdfSrc = src;
  var isPointer = src.indexOf('aha-asset://') === 0;
  if(!isPointer){
    status.style.display = 'none';
    frame.style.display = '';
    frame.src = src;
    return;
  }
  frame.style.display = 'none';
  frame.src = '';
  status.style.display = 'flex';
  status.innerHTML = '<span style="font-size:26px">⏳</span><span style="font-size:12.5px;color:var(--muted)">PDF Drive\'dan indiriliyor…</span>';
  var driveId = src.replace('aha-asset://', '');
  if(typeof ahaResolveAssetData !== 'function'){
    status.innerHTML = '<span style="font-size:26px">❌</span><span style="font-size:12.5px;color:var(--muted)">Drive modülü yüklenemedi, sayfayı yenile.</span>';
    return;
  }
  ahaResolveAssetData({ __ahaAsset: true, driveId: driveId }).then(function(dataUrl){
    if(!ov.classList.contains('open')) return; // bu sırada kapatıldıysa iptal
    el.setAttribute('data-pdf-src', dataUrl); // aynı bloğa bir daha tıklanınca / not autosave'inde tekrar Drive'a gidilmesin
    if(typeof _ahaUploadDedup === 'object') _ahaUploadDedup[dataUrl] = driveId; // gereksiz tekrar-yükleme fixi ile aynı önbellek
    ov._pdfSrc = dataUrl;
    status.style.display = 'none';
    frame.style.display = '';
    frame.src = dataUrl;
  }, function(err){
    if(!ov.classList.contains('open')) return;
    status.style.display = 'flex';
    var msg = err && err.message ? err.message : 'Dosya yüklenemedi';
    var needsLogin = msg.indexOf('giriş yapmalısın') !== -1;
    status.innerHTML =
      '<span style="font-size:26px">❌</span>' +
      '<span style="font-size:12.5px;color:var(--muted);max-width:260px;line-height:1.5">' + escapeHtml(msg) + '</span>' +
      (needsLogin
        ? '<button class="note-pdf-preview-btn" style="margin-top:2px" onclick="if(typeof signInGoogle===\'function\')signInGoogle()">🔑 Google\'a Giriş Yap</button>'
        : '<button class="note-pdf-preview-btn" style="margin-top:2px" onclick="(document.getElementById(\'notePdfPreviewOv\')._retry||function(){})()">🔄 Tekrar Dene</button>');
  });
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
  if(src.indexOf('aha-asset://') === 0){ showToast('⏳ Dosya henüz yükleniyor, birkaç saniye bekleyip tekrar dene.'); return; }
  var w = window.open('');
  if(w){ w.document.write('<title>PDF</title><body style="margin:0"><iframe src="'+src+'" style="width:100%;height:100vh;border:none"></iframe></body>'); }
  else { showToast('❌ Pop-up engellendi.'); }
}
/* Geriye dönük uyumluluk - eski noteBlockOpenPdf çağrıları için */
function noteBlockOpenPdf(el){ noteBlockOpenPdfPreview(el); }

/* ════════════════════════════════════════════════════════════
   NOTE DRAW MODULE v2 — Inline, Multi-Instance, Edit-In-Place
   ────────────────────────────────────────────────────────────
   Mimari:
   - Tam ekran modal KALDIRILDI. Çizim aracı doğrudan editör
     akışına (.note-draw-inline-wrap) enjekte edilir.
   - Her blok kendi state'ini (undoStack, redoStack) taşır.
   - Aktif instance pointer ile çakışma engellenir.
   - Pointer Capture ile hızlı sürükleme sırasında olay kaybı önlenir.
   - Kayıt → statik PNG gösterimi; "Düzenle" → canvas yeniden yüklenir.
   - Auto-crop KALDIRILDI: canvas boyutlarında birebir snapshot.
   ════════════════════════════════════════════════════════════ */

/* ── Paylaşılan oturum state'i (aktif çizim bloğu için) ── */
var _noteDrawActiveWrap = null;  // Şu an aktif editing modundaki wrap el.
var _noteDrawMode       = 'pen'; // 'pen' | 'marker' | 'eraser'
var _noteDrawColor      = '#a78bfa';
var _noteDrawSize       = 4;
var _noteDrawActive     = false; // pointer basılı mı?
var _noteDrawLastX      = 0;
var _noteDrawLastY      = 0;
var _noteDrawUndoStack  = [];    // Aktif canvas'ın ImageData[]
var _noteDrawRedoStack  = [];
var _NOTE_DRAW_MAX_HISTORY = 40;
var _noteDrawPressureSeen  = false;

var NOTE_DRAW_PALETTE = [
  '#ffffff','#e2e2e9','#9e9e9e','#1a1d2e',
  '#ff6b6b','#ff9800','#f5c842','#4ae176',
  '#3b82f6','#a78bfa','#ec4899','#06b6d4',
  '#f97316','#84cc16','#14b8a6','#8b5cf6'
];

/* ════ PUBLIC API ════ */

/* Yeni boş çizim bloğu oluştur ve editöre ekle */
function insertInlineDrawBlock(){
  _saveNoteCursor();
  var html = '<div class="note-draw-inline-wrap" contenteditable="false"></div>';
  insertNoteBlockHtml(html);
  /* insertNoteBlockHtml hemen DOM'a ekler; son wrap'ı bul ve aktive et */
  var content = document.getElementById('noteEditorContent');
  var wraps = content.querySelectorAll('.note-draw-inline-wrap');
  var newWrap = wraps[wraps.length - 1];
  if(newWrap) _activateDrawBlock(newWrap, null);
}

/* Mevcut static bloğu edit moduna geri al */
function activateExistingDrawBlock(wrapEl){
  var rawPng = wrapEl.getAttribute('data-raw-snapshot') || null;
  _activateDrawBlock(wrapEl, rawPng);
}

/* Tamamlandı — canvas'ı PNG'ye çevir, statik moda geç */
function finalizeInlineDraw(btn){
  var wrapEl = btn ? btn.closest('.note-draw-inline-wrap') : _noteDrawActiveWrap;
  if(!wrapEl) return;

  var canvas = wrapEl.querySelector('canvas');
  if(!canvas){
    /* Hiç canvas yoksa (örn. yanlış state) sil */
    wrapEl.remove();
    _noteDrawTeardown();
    scheduleNoteSave();
    return;
  }

  /* Boş mu kontrol et */
  var ctx = canvas.getContext('2d');
  var W = canvas.width; var H = canvas.height;
  var imgData = ctx.getImageData(0, 0, W, H).data;
  var hasDrawing = false;
  for(var i = 3; i < imgData.length; i += 4){ if(imgData[i] > 0){ hasDrawing = true; break; } }
  if(!hasDrawing){
    showToast('ℹ️ Önce bir şeyler çiz!');
    return;
  }

  /* Birebir canvas snapshot — auto-crop yok */
  var dataUrl = canvas.toDataURL('image/png');

  /* raw snapshot'ı data attribute'a kaydet (re-edit için) */
  wrapEl.setAttribute('data-raw-snapshot', dataUrl);

  _renderStaticDrawBlock(wrapEl, dataUrl);
  _noteDrawTeardown();
  scheduleNoteSave();
  showToast('🎨 Çizim nota eklendi!');
}

/* Inline çizim bloğunu sil */
function removeNoteInlineDraw(btn){
  var wrap = btn ? btn.closest('.note-draw-inline-wrap') : null;
  if(wrap){
    if(_noteDrawActiveWrap === wrap) _noteDrawTeardown();
    wrap.remove();
  }
  scheduleNoteSave();
}

/* Geriye dönük uyumluluk: eski kayıtlı HTML'deki .note-inline-draw-wrap sınıflı blokları da kaldır */
function removeNoteInlineDrawLegacy(btn){
  var wrap = btn && btn.parentNode && btn.parentNode.parentNode;
  if(wrap) wrap.remove();
  scheduleNoteSave();
}

/* ════ INTERNAL: BLOCK RENDER ════ */

function _activateDrawBlock(wrapEl, existingPng){
  /* Başka bir aktif blok varsa önce orayı sonlandır (ama kaydetme — kullanıcı bırakmadı) */
  if(_noteDrawActiveWrap && _noteDrawActiveWrap !== wrapEl){
    _noteDrawCancelActive();
  }
  _noteDrawActiveWrap = wrapEl;

  /* State sıfırla */
  _noteDrawUndoStack = [];
  _noteDrawRedoStack = [];
  _noteDrawPressureSeen = false;
  _noteDrawActive = false;

  /* Wrap içini temizle (eski static görünüm varsa) */
  wrapEl.innerHTML = '';
  wrapEl.classList.add('editing');

  /* ── Toolbar ── */
  var toolbar = _buildInlineToolbar(wrapEl);
  wrapEl.appendChild(toolbar);

  /* ── Canvas container ── */
  var canvasWrap = document.createElement('div');
  canvasWrap.className = 'nd-canvas-wrap';

  var bgEl = document.createElement('div');
  bgEl.className = 'nd-canvas-bg';
  canvasWrap.appendChild(bgEl);

  var canvas = document.createElement('canvas');
  canvas.className = 'nd-canvas';
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'crosshair';
  canvasWrap.appendChild(canvas);

  wrapEl.appendChild(canvasWrap);

  /* HiDPI init */
  _noteDrawInitInlineCanvas(canvas, existingPng);

  /* Pointer events */
  canvas.addEventListener('pointerdown', _noteDrawOnDown, { passive: false });
  canvas.addEventListener('pointermove', _noteDrawOnMove, { passive: false });
  canvas.addEventListener('pointerup',   _noteDrawOnUp,   { passive: false });
  canvas.addEventListener('pointercancel', _noteDrawOnUp, { passive: false });

  /* Klavye kısayolları */
  document.addEventListener('keydown', _noteDrawKeyHandler);

  /* Görünüme kaydır */
  setTimeout(function(){ wrapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
}

function _renderStaticDrawBlock(wrapEl, dataUrl){
  wrapEl.classList.remove('editing');

  /* ÖNEMLİ: Düzenle/Sil butonları addEventListener DEĞİL, inline onclick ile
     kuruluyor. Neden: bu blok notEditorContent'in innerHTML'i olarak
     page.html'e kaydediliyor ve not tekrar açıldığında yine innerHTML='...'
     ile DOM'a enjekte ediliyor. addEventListener ile bağlanan handler'lar bu
     serialize/deserialize döngüsünü atlatamaz (innerHTML yeniden parse
     edilince kaybolur) — notu kapatıp açtıktan sonra Düzenle/Sil'in
     çalışmamasının sebebi tam olarak buydu. Inline onclick ise HTML'in bir
     parçası olduğu için her zaman çalışır; dosyadaki diğer tüm bloklar
     (resim/video/flashcard/pdf) zaten bu yüzden aynı kalıbı kullanıyor. */
  wrapEl.innerHTML =
    '<img class="note-inline-draw-img" src="'+dataUrl+'" alt="çizim" draggable="false">' +
    '<div class="nd-static-actions">' +
      '<button class="nd-static-btn nd-edit-btn" title="Çizimi düzenle" onclick="event.stopPropagation();activateExistingDrawBlock(this.closest(\'.note-draw-inline-wrap\'))">' +
        '<span class="material-symbols-outlined" style="font-size:13px;pointer-events:none">edit</span> Düzenle' +
      '</button>' +
      '<button class="nd-static-btn nd-del-btn" title="Çizimi kaldır" onclick="event.stopPropagation();removeNoteInlineDraw(this)">' +
        '<span class="material-symbols-outlined" style="font-size:13px;pointer-events:none">delete</span> Sil' +
      '</button>' +
    '</div>';
}

/* Aktif çizim iptal et (kayıt yok — yeni bloksa sil) */
function _noteDrawCancelActive(){
  if(!_noteDrawActiveWrap) return;
  var wrapEl = _noteDrawActiveWrap;
  var hadSnapshot = wrapEl.hasAttribute('data-raw-snapshot');
  if(hadSnapshot){
    /* Daha önce kaydedilmiş bir çizim vardı → eski halini geri yükle */
    _renderStaticDrawBlock(wrapEl, wrapEl.getAttribute('data-raw-snapshot'));
  } else {
    /* Yeni boş bloktu → kaldır */
    wrapEl.remove();
    scheduleNoteSave();
  }
  _noteDrawTeardown();
}

/* Teardown: global listener'ları temizle, pointer'ı sıfırla */
function _noteDrawTeardown(){
  document.removeEventListener('keydown', _noteDrawKeyHandler);
  _noteDrawActiveWrap = null;
  _noteDrawActive = false;
  _noteDrawUndoStack = [];
  _noteDrawRedoStack = [];
}

/* ════ TOOLBAR BUILDER ════ */

function _buildInlineToolbar(wrapEl){
  var tb = document.createElement('div');
  tb.className = 'nd-toolbar';

  /* ── Mod butonları ── */
  var modes = [
    { id:'pen',    icon:'edit',              label:'Kalem',  cls:'' },
    { id:'marker', icon:'format_color_fill', label:'Marker', cls:'marker' },
    { id:'eraser', icon:'ink_eraser',        label:'Silgi',  cls:'eraser' }
  ];
  modes.forEach(function(m){
    var btn = document.createElement('button');
    btn.className = 'note-draw-tool-btn' + (m.id === _noteDrawMode ? ' active' : '') + (m.cls ? ' '+m.cls : '');
    btn.dataset.mode = m.id;
    btn.title = m.label;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;pointer-events:none">'+m.icon+'</span> '+m.label;
    btn.addEventListener('click', function(){
      _noteDrawSetMode(m.id, wrapEl);
    });
    tb.appendChild(btn);
  });

  /* ── Separator ── */
  tb.appendChild(_ndSep());

  /* ── Renk paleti ── */
  var colorRow = document.createElement('div');
  colorRow.className = 'note-draw-colors nd-colors';
  NOTE_DRAW_PALETTE.forEach(function(c){
    var chip = document.createElement('div');
    chip.className = 'note-draw-color-chip' + (c === _noteDrawColor ? ' active' : '');
    chip.style.background = c;
    chip.dataset.color = c;
    chip.title = c;
    chip.addEventListener('click', function(){
      _noteDrawColor = c;
      colorRow.querySelectorAll('.note-draw-color-chip').forEach(function(el){
        el.classList.toggle('active', el.dataset.color === c);
      });
      if(_noteDrawMode === 'eraser') _noteDrawSetMode('pen', wrapEl);
    });
    colorRow.appendChild(chip);
  });
  tb.appendChild(colorRow);

  /* ── Separator ── */
  tb.appendChild(_ndSep());

  /* ── Boyut slider ── */
  var sizeWrap = document.createElement('div');
  sizeWrap.className = 'note-draw-size-wrap';
  var sizeLabel = document.createElement('span');
  sizeLabel.className = 'note-draw-size-label';
  sizeLabel.textContent = 'Boyut';
  var sizeSlider = document.createElement('input');
  sizeSlider.type = 'range'; sizeSlider.min = '1'; sizeSlider.max = '48';
  sizeSlider.value = String(_noteDrawSize);
  sizeSlider.className = 'note-draw-size-slider nd-size-slider';
  var sizeVal = document.createElement('span');
  sizeVal.className = 'note-draw-size-val nd-size-val';
  sizeVal.textContent = Math.round(_noteDrawSize);
  sizeSlider.addEventListener('input', function(){
    _noteDrawSize = parseFloat(this.value);
    sizeVal.textContent = Math.round(_noteDrawSize);
  });
  sizeWrap.appendChild(sizeLabel);
  sizeWrap.appendChild(sizeSlider);
  sizeWrap.appendChild(sizeVal);
  tb.appendChild(sizeWrap);

  /* ── Basınç badge ── */
  var pressureBadge = document.createElement('div');
  pressureBadge.className = 'note-draw-pressure-badge nd-pressure-badge';
  pressureBadge.style.display = 'none';
  pressureBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size:11px;vertical-align:middle">stylus</span> Kalem Basıncı Aktif';
  tb.appendChild(pressureBadge);

  /* ── Eylem butonları ── */
  var actions = document.createElement('div');
  actions.className = 'note-draw-actions nd-actions';

  var undoBtn = document.createElement('button');
  undoBtn.className = 'note-draw-action-btn nd-undo-btn';
  undoBtn.disabled = true;
  undoBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;pointer-events:none">undo</span> Geri';
  undoBtn.title = 'Geri Al (Ctrl+Z)';
  undoBtn.addEventListener('click', function(){ _noteDrawUndo(wrapEl); });

  var redoBtn = document.createElement('button');
  redoBtn.className = 'note-draw-action-btn nd-redo-btn';
  redoBtn.disabled = true;
  redoBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;pointer-events:none">redo</span> İleri';
  redoBtn.title = 'İleri Al (Ctrl+Y)';
  redoBtn.addEventListener('click', function(){ _noteDrawRedo(wrapEl); });

  var clearBtn = document.createElement('button');
  clearBtn.className = 'note-draw-action-btn clear-all';
  clearBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;pointer-events:none">delete_forever</span> Temizle';
  clearBtn.title = 'Tümünü Sil';
  clearBtn.addEventListener('click', function(){ _noteDrawClearAll(wrapEl); });

  var doneBtn = document.createElement('button');
  doneBtn.className = 'note-draw-action-btn save nd-done-btn';
  doneBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;pointer-events:none">check</span> Tamam';
  doneBtn.title = 'Çizimi Kaydet';
  doneBtn.addEventListener('click', function(){ finalizeInlineDraw(doneBtn); });

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'note-draw-close-btn';
  cancelBtn.title = 'İptal';
  cancelBtn.textContent = '✕';
  cancelBtn.addEventListener('click', function(){ _noteDrawCancelActive(); });

  actions.appendChild(undoBtn);
  actions.appendChild(redoBtn);
  actions.appendChild(clearBtn);
  actions.appendChild(doneBtn);
  actions.appendChild(cancelBtn);
  tb.appendChild(actions);

  return tb;
}

function _ndSep(){
  var s = document.createElement('div');
  s.className = 'note-draw-sep';
  return s;
}

/* ════ CANVAS INIT ════ */

function _noteDrawInitInlineCanvas(canvas, existingPng){
  var content = document.getElementById('noteEditorContent');
  var dpr = window.devicePixelRatio || 1;

  // MODÜL 1 – Canvas genişliği: editör içerik alanının GERÇEK genişliği (getBoundingClientRect)
  var contentRect = content ? content.getBoundingClientRect() : null;
  var cssW = (contentRect && contentRect.width > 40) ? Math.floor(contentRect.width) : (content ? content.clientWidth : 680);

  // MODÜL 1 – Canvas yüksekliği: eskiden 280px → %40 artırıldı = 392px
  var cssH = 392;

  // DOM attribute + CSS style her ikisini de güncelle (piksel bozulmasını önler)
  canvas.width  = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  if(existingPng){
    /* Önceki çizimi geri yükle */
    var img = new Image();
    img.onload = function(){
      ctx.drawImage(img, 0, 0, cssW, cssH);
      _noteDrawPushUndoCanvas(canvas);
      _noteDrawUpdateBtns(canvas.closest('.note-draw-inline-wrap'));
    };
    img.src = existingPng;
  } else {
    _noteDrawPushUndoCanvas(canvas);
    _noteDrawUpdateBtns(canvas.closest('.note-draw-inline-wrap'));
  }
}

/* ════ POINTER HANDLERS ════ */

function _noteDrawGetCanvas(e){
  /* e.target her zaman canvas'ın kendisi — pointer capture sayesinde */
  var t = e.target;
  return (t && t.tagName === 'CANVAS') ? t : null;
}

function _noteDrawPos(e){
  var canvas = _noteDrawGetCanvas(e);
  if(!canvas) return { x:0, y:0 };
  var rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function _noteDrawEffectiveSize(e, wrapEl){
  if(e.pointerType === 'pen' && e.pressure && e.pressure > 0){
    if(!_noteDrawPressureSeen){
      _noteDrawPressureSeen = true;
      if(wrapEl){
        var badge = wrapEl.querySelector('.nd-pressure-badge');
        if(badge) badge.style.display = '';
      }
    }
    if(_noteDrawMode === 'eraser') return _noteDrawSize;
    return Math.max(1, _noteDrawSize * (0.3 + e.pressure * 1.2));
  }
  return _noteDrawSize;
}

function _noteDrawOnDown(e){
  e.preventDefault();
  var canvas = _noteDrawGetCanvas(e);
  if(!canvas) return;
  /* Pointer capture — yüksek hızlı sürüklemede olay kaybını önler */
  try { canvas.setPointerCapture(e.pointerId); } catch(ex){}

  _noteDrawActive = true;
  var pos = _noteDrawPos(e);
  _noteDrawLastX = pos.x;
  _noteDrawLastY = pos.y;

  var ctx = canvas.getContext('2d');
  var wrapEl = canvas.closest('.note-draw-inline-wrap');
  _noteDrawApplyMode(ctx, e);
  ctx.beginPath();
  var sz = _noteDrawEffectiveSize(e, wrapEl);
  ctx.arc(pos.x, pos.y, sz / 2, 0, Math.PI * 2);
  ctx.fill();
}

function _noteDrawOnMove(e){
  if(!_noteDrawActive) return;
  e.preventDefault();
  var canvas = _noteDrawGetCanvas(e);
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var wrapEl = canvas.closest('.note-draw-inline-wrap');
  var pos = _noteDrawPos(e);
  _noteDrawApplyMode(ctx, e);
  ctx.lineWidth = _noteDrawEffectiveSize(e, wrapEl);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(_noteDrawLastX, _noteDrawLastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  _noteDrawLastX = pos.x;
  _noteDrawLastY = pos.y;
}

function _noteDrawOnUp(e){
  if(!_noteDrawActive) return;
  _noteDrawActive = false;
  var canvas = _noteDrawGetCanvas(e);
  if(!canvas) return;
  /* Pointer capture'ı serbest bırak */
  try { canvas.releasePointerCapture(e.pointerId); } catch(ex){}
  var ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  _noteDrawPushUndoCanvas(canvas);
  _noteDrawRedoStack = [];
  var wrapEl = canvas.closest('.note-draw-inline-wrap');
  _noteDrawUpdateBtns(wrapEl);
}

/* ════ MODE + DRAW APPLICATION ════ */

function _noteDrawSetMode(mode, wrapEl){
  _noteDrawMode = mode;
  if(wrapEl){
    wrapEl.querySelectorAll('.note-draw-tool-btn[data-mode]').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    var canvas = wrapEl.querySelector('canvas');
    if(canvas) canvas.style.cursor = mode === 'eraser' ? 'cell' : 'crosshair';
  }
}

function _noteDrawApplyMode(ctx, e){
  if(_noteDrawMode === 'eraser'){
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle   = 'rgba(0,0,0,1)';
    ctx.globalAlpha = 1;
  } else if(_noteDrawMode === 'marker'){
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = _noteDrawColor;
    ctx.fillStyle   = _noteDrawColor;
    ctx.globalAlpha = 0.55;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = _noteDrawColor;
    ctx.fillStyle   = _noteDrawColor;
    ctx.globalAlpha = 1;
  }
}

/* ════ UNDO / REDO (instance-scoped) ════ */

function _noteDrawPushUndoCanvas(canvas){
  var ctx = canvas.getContext('2d');
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  var snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
  _noteDrawUndoStack.push(snap);
  if(_noteDrawUndoStack.length > _NOTE_DRAW_MAX_HISTORY) _noteDrawUndoStack.shift();
}

function _noteDrawUndo(wrapEl){
  if(_noteDrawUndoStack.length <= 1) return;
  var canvas = wrapEl ? wrapEl.querySelector('canvas') : null;
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var current = _noteDrawUndoStack.pop();
  _noteDrawRedoStack.push(current);
  ctx.putImageData(_noteDrawUndoStack[_noteDrawUndoStack.length - 1], 0, 0);
  _noteDrawUpdateBtns(wrapEl);
}

function _noteDrawRedo(wrapEl){
  if(_noteDrawRedoStack.length === 0) return;
  var canvas = wrapEl ? wrapEl.querySelector('canvas') : null;
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var snap = _noteDrawRedoStack.pop();
  _noteDrawUndoStack.push(snap);
  ctx.putImageData(snap, 0, 0);
  _noteDrawUpdateBtns(wrapEl);
}

function _noteDrawClearAll(wrapEl){
  var canvas = wrapEl ? wrapEl.querySelector('canvas') : null;
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  _noteDrawRedoStack = [];
  _noteDrawPushUndoCanvas(canvas);
  _noteDrawUpdateBtns(wrapEl);
}

function _noteDrawUpdateBtns(wrapEl){
  if(!wrapEl) return;
  var undoBtn = wrapEl.querySelector('.nd-undo-btn');
  var redoBtn = wrapEl.querySelector('.nd-redo-btn');
  if(undoBtn) undoBtn.disabled = _noteDrawUndoStack.length <= 1;
  if(redoBtn) redoBtn.disabled = _noteDrawRedoStack.length === 0;
}

/* ════ KEYBOARD ════ */

function _noteDrawKeyHandler(e){
  if(!_noteDrawActiveWrap) return;
  if(e.key === 'Escape'){ e.preventDefault(); _noteDrawCancelActive(); return; }
  if((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey){
    e.preventDefault(); _noteDrawUndo(_noteDrawActiveWrap); return;
  }
  if((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))){
    e.preventDefault(); _noteDrawRedo(_noteDrawActiveWrap); return;
  }
}

/* ════ LEGACY COMPAT STUBS (eski HTML'de inline onclick varsa çalışsın) ════ */
function openNoteDrawPanel(){ insertInlineDrawBlock(); }
function closeNoteDrawPanel(){ if(_noteDrawActiveWrap) _noteDrawCancelActive(); }
function saveNoteDrawing(){ if(_noteDrawActiveWrap) finalizeInlineDraw(null); }
function noteDrawUndo(){ if(_noteDrawActiveWrap) _noteDrawUndo(_noteDrawActiveWrap); }
function noteDrawRedo(){ if(_noteDrawActiveWrap) _noteDrawRedo(_noteDrawActiveWrap); }
function noteDrawClearAll(){ if(_noteDrawActiveWrap) _noteDrawClearAll(_noteDrawActiveWrap); }
function setNoteDrawMode(m){ _noteDrawSetMode(m, _noteDrawActiveWrap); }
function onNoteDrawSizeChange(v){ _noteDrawSize = parseFloat(v); }

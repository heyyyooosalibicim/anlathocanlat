/* ═══════════════════════════════════════════════════════════════════════════
 * DENEME.JS — AnlatHoca Deneme Modu (Practice Exam Tracking System)
 * ═══════════════════════════════════════════════════════════════════════════
 * İZOLE MODÜL. index.html / core.js / features.js dosyalarına TEK satır
 * eklenerek bağlanır:
 *
 *   <script src="js/features.js"></script>
 *   <script src="js/deneme.js"></script>   <-- BUNU EKLE (features.js'den SONRA)
 *   <script src="js/ai.js"></script>
 *
 * Başka HİÇBİR dosyaya dokunulmasına gerek yoktur. Bu dosya kendi CSS'ini,
 * kendi modallarını ve İKİ ayrı "Playlist Modu / Deneme Modu" geçiş
 * anahtarını runtime'da DOM'a enjekte eder:
 *   1) Takvim Paneli içinde (.cal-panel-header altı)
 *   2) Ana ekran sidebar'ında, kronometre panelinin altı / playlist panelinin
 *      HEMEN ÜSTÜNDE (.sidebar .playlist-panel'den hemen önce)
 * İkisi de AYNI global `calMode` durumunu okur/yazar ve birbirleriyle senkron
 * çalışır — biri değiştiğinde diğeri de otomatik güncellenir. Kategori/sınav
 * yönetim fonksiyonlarının TAMAMI (oluşturma, düzenleme, silme, başlatma) her
 * iki konumdan da tam yetkiyle çalışır; bunu ID çakışması olmadan sağlamak
 * için tüm render/CRUD fonksiyonları bir `scope` parametresi alır ('Cal' veya
 * 'Side') ve tüm DOM id'lerini bu scope ile damgalar (bkz. `_dnmSid`).
 *
 * Mevcut renderCalBody/swToggle/swReset/checkMidnightReset VE testMidnightReset
 * fonksiyonları (index.html'in openAiPanel'i sarmaladığı yöntemle AYNI
 * şekilde) sarmalanır. checkMidnightReset ve testMidnightReset'in İKİSİ DE
 * sarmalanmış olması bilerek yapıldı: biri (Ctrl+A+S kısayolu) diğerinin
 * (gerçek gece yarısı tetikleyicisinin) adımlarını elle kopyalıyordu, bu da
 * ikisinin zamanla birbirinden sapmasına yol açmıştı — bkz. _denemeWrapCoreFunctions.
 *
 * VERİ MİMARİSİ NOTU: Sınav kayıtları (aha_deneme_v1) flashcard sistemi gibi
 * KÜMÜLATİF ve KALICIDIR — playlist izleme durumunun aksine gece yarısı
 * resetlenmez/silinmez, çünkü İstatistikler sekmesi uzun vadeli net takibi
 * gerektirir. checkMidnightReset() sadece "Bugün" etiketlerini tazeler VE
 * (varsa) o an ekranda AÇIK KALMIŞ canlı bir deneme sayacını/çalışma ekranını
 * kapatır (playlist modundaki oynayan videonun kapatılması gibi) — hiçbir
 * KAYDEDİLMİŞ sınav verisi dokunulmaz/arşivlenmez.
 *
 * SKOR EKRANI NOTU: "Boş" alanı artık elle girilmez — Doğru/Yanlış her
 * değiştiğinde Boş = Toplam - (Doğru + Yanlış) formülüyle KENDİLİĞİNDEN
 * güncellenir (readonly input). Doğru+Yanlış toplamı soru sayısını aşarsa
 * Boş 0'da sabitlenir ve satırda uyarı gösterilir.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ══════════ STORAGE KEYS ══════════ */
var LS_DENEME='aha_deneme_v1';           // Sınav kayıtları (JSON Array)
var LS_DENEME_CATS='aha_deneme_cats_v1'; // Kategoriler (JSON Array)
var LS_DENEME_MODE='aha_deneme_mode_v1'; // 'playlist' | 'deneme'

/* ══════════ STATE ══════════ */
var denemeExams=[];        // [{id,catId,isim,tur,alan,ders,bransTotal,timerMin,pdf,createdAt,plannedDate,completed,completedAt,result}]
var denemeCats=[];         // [{id,name,color,createdAt}]
var calMode='playlist';    // aktif GLOBAL mod — hem takvim panelini hem sidebar'ı kontrol eder
var dnmMgrSearch={Cal:'',Side:''};   // Yönetici arama kutusu — konuma (scope) göre bağımsız
var dnmExpandedCat={Cal:null,Side:null}; // Açık kategori — konuma göre bağımsız
var dnmHistSearch='';
var dnmStatsRangeN=10;     // son N deneme
var dnmPlannerSelectedDate=null;
var _dnmPdfDraft={};       // {"scope_catId": {name,type,data}} — form açıkken geçici PDF taslağı
var _dnmPdfPickTarget={scope:null,catId:null}; // gizli dosya seçicinin hangi form için tetiklendiği
var _dnmActiveExamId=null; // execution akışında yürütülen sınav

/* ══════════ TIMER STATE ══════════ */
var denemeTimerActive=false, denemeTimerRunning=false;
var denemeTimerTotalMs=0, denemeTimerRemainMs=0;
var denemeTimerPhaseStart=0, denemeTimerPausedAt=0;
var denemeTimerInterval=null, denemeTimerExamId=null, denemeTimerUp=false;

/* ══════════ 2027 YKS MÜFREDAT VERİSİ ══════════ */
var TYT_SUBJECTS=[
  {key:'turkce',label:'Türkçe',total:40},
  {key:'matematik',label:'Temel Matematik',total:40},
  {key:'sosyal',label:'Sosyal Bilimler',total:20},
  {key:'fen',label:'Fen Bilimleri',total:20}
];
var AYT_PROFILES={
  sayisal:[
    {key:'matematik',label:'Matematik',total:40},
    {key:'fizik',label:'Fizik',total:14},
    {key:'kimya',label:'Kimya',total:13},
    {key:'biyoloji',label:'Biyoloji',total:13}
  ],
  sozel:[
    {key:'tde_sos1',label:'Türk Dili ve Edebiyatı - Sosyal Bilimler-1',total:40},
    {key:'sos2',label:'Sosyal Bilimler-2',total:40}
  ],
  esit:[
    {key:'tde_sos1',label:'Türk Dili ve Edebiyatı - Sosyal Bilimler-1',total:40},
    {key:'matematik',label:'Matematik',total:40}
  ]
};
var AYT_ALAN_LABELS={sayisal:'Sayısal',sozel:'Sözel',esit:'AYT Genel (Eşit Ağırlık)'};
var BRANS_DERSLER=['Matematik','Geometri','Türkçe','Fizik','Kimya','Biyoloji','Tarih','Coğrafya','Felsefe','Din Kültürü ve Ahlak Bilgisi','İngilizce'];
var BRANS_DEFAULT_Q={Matematik:40,Geometri:30,'Türkçe':40,Fizik:14,Kimya:13,Biyoloji:13,Tarih:20,'Coğrafya':20,Felsefe:20,'Din Kültürü ve Ahlak Bilgisi':20,'İngilizce':40};

var CAL_TAB_LABELS={
  playlist:{stats:'İstatistikler',history:'Geçmiş',planner:'Planlayıcı',manager:'Playlist Yöneticisi'},
  deneme:{stats:'Deneme İstatistikleri',history:'Deneme Geçmişi',planner:'Deneme Planlayıcısı',manager:'Deneme Yöneticisi'}
};

/* ══════════ STORAGE ══════════ */
function denemeLoadAll(){
  try{var raw=localStorage.getItem(LS_DENEME);denemeExams=raw?JSON.parse(raw):[];}catch(e){denemeExams=[];}
  try{var raw2=localStorage.getItem(LS_DENEME_CATS);denemeCats=raw2?JSON.parse(raw2):[];}catch(e){denemeCats=[];}
  try{calMode=localStorage.getItem(LS_DENEME_MODE)||'playlist';}catch(e){calMode='playlist';}
  denemeExams.forEach(function(ex){
    if(!ex.result)ex.result=null;
    if(typeof ex.completed==='undefined')ex.completed=!!ex.result;
    if(typeof ex.plannedDate==='undefined')ex.plannedDate=null;
  });
}
function denemeSaveExams(){
  try{
    localStorage.setItem(LS_DENEME,JSON.stringify(denemeExams));
    return;
  }catch(e){}
  /* BUG FIX: Kategoriler (denemeCats) hep küçük olduğu için hemen hemen her
   * zaman kaydedilir, ama sınav kayıtları (denemeExams) eklenen PDF'leri
   * base64 olarak İÇLERİNDE taşır — birkaç sayfalık taranmış bir PDF bile
   * kolayca birkaç MB tutar ve tarayıcının ~5-10MB'lık localStorage limitini
   * aşırır. Üstteki setItem bu yüzden sessizce (istisna fırlatarak) başarısız
   * olabiliyordu; kullanıcıya "kategoriler kaydediliyor, denemeler
   * kaydedilmiyor" gibi görünmesinin sebebi tam olarak buydu.
   * Çözüm: en büyük PDF'ten başlayarak tek tek çıkar, her adımda tekrar
   * kaydetmeyi dene — SADECE sığana kadar gereken kadarını feda et, sınavın
   * kendisini (isim/kategori/net/sonuç) asla kaybetme. */
  var withPdf=denemeExams.filter(function(ex){return ex.pdf&&ex.pdf.data;});
  withPdf.sort(function(a,b){return (b.pdf.data.length||0)-(a.pdf.data.length||0);});
  var droppedNames=[];
  for(var i=0;i<withPdf.length;i++){
    droppedNames.push(withPdf[i].isim);
    withPdf[i].pdf=null;
    try{
      localStorage.setItem(LS_DENEME,JSON.stringify(denemeExams));
      var list=droppedNames.length>3?(droppedNames.slice(0,3).join(', ')+' ve '+(droppedNames.length-3)+' diğeri'):droppedNames.join(', ');
      showToast('⚠️ Depolama alanı doldu: '+list+' denemesindeki PDF eki kaldırıldı. Sınav kaydın (isim/net/sonuç) güvende — istersen daha küçük bir PDF ile tekrar ekleyebilirsin.');
      return;
    }catch(e2){/* hâlâ sığmadı, bir sonraki en büyük PDF'i de çıkarıp tekrar dene */}
  }
  /* Tüm PDF'ler çıkarılmasına rağmen hâlâ kaydedilemiyorsa sorun PDF'lerden
   * bağımsız, genel depolama doluluğudur (notlar/AI sohbet geçmişi vb.). */
  try{
    localStorage.setItem(LS_DENEME,JSON.stringify(denemeExams));
  }catch(e3){
    showToast('❌ Deneme kaydı depolanamadı (tarayıcı depolaması dolu). Notlar veya AI sohbet geçmişi gibi diğer verileri temizleyip tekrar dene.');
  }
}
function denemeSaveCats(){try{localStorage.setItem(LS_DENEME_CATS,JSON.stringify(denemeCats));}catch(e){}}
function denemeSaveMode(){try{localStorage.setItem(LS_DENEME_MODE,calMode);}catch(e){}}

/* ══════════ HELPERS / LOOKUP ══════════ */
function denemeFindCat(id){return denemeCats.find(function(c){return c.id===id;})||null;}
function denemeFindExam(id){return denemeExams.find(function(e){return e.id===id;})||null;}
function denemeExamsInCat(catId){return denemeExams.filter(function(e){return e.catId===catId;});}
function denemeNet(dogru,yanlis){var n=(dogru||0)-(yanlis||0)*0.25;return Math.round(n*100)/100;}
function denemeFmtNetPlain(n){var v=Math.round(n*100)/100;return v.toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');}

/* Bir sınavın konu/ders profilini (skor ekranı için satırlar) döndürür */
function denemeGetProfile(exam){
  if(exam.tur==='tyt')return TYT_SUBJECTS;
  if(exam.tur==='ayt')return AYT_PROFILES[exam.alan]||AYT_PROFILES.sayisal;
  if(exam.tur==='brans')return [{key:'brans',label:exam.ders||'Branş',total:exam.bransTotal||BRANS_DEFAULT_Q[exam.ders]||40}];
  return TYT_SUBJECTS;
}

function denemeTurLabel(exam){
  if(exam.tur==='tyt')return 'TYT';
  if(exam.tur==='ayt')return 'AYT · '+(AYT_ALAN_LABELS[exam.alan]||'');
  if(exam.tur==='brans')return 'Branş · '+(exam.ders||'');
  return exam.tur;
}
function denemeTurBadgeHtml(exam){
  var cls=exam.tur==='tyt'?'tyt':(exam.tur==='ayt'?'ayt':'brans');
  return '<span class="dnm-tur-badge '+cls+'">'+escapeHtml(denemeTurLabel(exam))+'</span>';
}

/* ══════════ STYLE INJECTION ══════════ */
function _denemeInjectStyles(){
  if(document.getElementById('dnmStyles'))return;
  var css=''+
  /* — Mod geçiş anahtarı — */
  '.dnm-mode-row{padding:12px 20px;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.015);flex-shrink:0}'+
  '.dnm-mode-toggle{display:flex;background:var(--surface3);border:1px solid var(--border2);border-radius:11px;padding:3px;position:relative}'+
  '.dnm-mode-pill{position:absolute;top:3px;left:3px;width:calc(50% - 3px);height:calc(100% - 6px);background:linear-gradient(135deg,var(--accent),var(--accent-hover));border-radius:8px;transition:transform 0.28s cubic-bezier(.4,0,.2,1);box-shadow:0 3px 12px var(--accent-glow);z-index:0}'+
  '.dnm-mode-pill.deneme{transform:translateX(100%)}'+
  '.dnm-mode-btn{flex:1;position:relative;z-index:1;background:none;border:none;padding:9px 8px;font-family:Syne,sans-serif;font-size:11px;font-weight:700;color:var(--muted);cursor:pointer;border-radius:8px;transition:color 0.2s;white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:5px}'+
  '.dnm-mode-btn.active{color:#fff}'+
  /* — Genel boş durum / bölüm başlığı — */
  '.dnm-empty{text-align:center;color:var(--muted);padding:28px 14px;font-size:12px;line-height:1.7}'+
  '.dnm-section-title{font-size:10px;font-weight:800;letter-spacing:1.2px;color:var(--muted);text-transform:uppercase;margin:14px 0 8px}'+
  '.dnm-section-title:first-child{margin-top:0}'+
  /* — Tür rozetleri — */
  '.dnm-tur-badge{display:inline-flex;align-items:center;font-size:9px;font-weight:800;letter-spacing:0.3px;padding:3px 8px;border-radius:20px;border:1px solid;white-space:nowrap}'+
  '.dnm-tur-badge.tyt{background:rgba(59,130,246,0.14);border-color:rgba(59,130,246,0.4);color:var(--blue)}'+
  '.dnm-tur-badge.ayt{background:rgba(139,92,246,0.14);border-color:rgba(139,92,246,0.4);color:var(--accent2)}'+
  '.dnm-tur-badge.brans{background:rgba(245,200,66,0.14);border-color:rgba(245,200,66,0.4);color:var(--gold)}'+
  /* — Sınav kartı (mgr-vid-item üzerine kurulu, genişletilmiş) — */
  '.dnm-exam-card{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:9px;margin-bottom:6px}'+
  '.dnm-exam-card-body{flex:1;min-width:0}'+
  '.dnm-exam-card-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px}'+
  '.dnm-exam-name{font-size:12px;font-weight:700;color:var(--text)}'+
  '.dnm-exam-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:9.5px;color:var(--muted);font-family:"JetBrains Mono",monospace}'+
  '.dnm-exam-meta .net{font-weight:700}'+
  '.dnm-exam-meta .net.pos{color:var(--green)}'+
  '.dnm-exam-meta .net.neg{color:var(--red)}'+
  '.dnm-exam-actions{display:flex;gap:3px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}'+
  '.dnm-exam-btn{background:none;border:1px solid rgba(255,255,255,0.1);color:var(--muted);border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer;font-family:Syne,sans-serif;font-weight:700;transition:all 0.15s;white-space:nowrap}'+
  '.dnm-exam-btn:hover{border-color:rgba(139,92,246,0.4);color:var(--accent)}'+
  '.dnm-exam-btn.play{background:rgba(74,225,118,0.12);border-color:rgba(74,225,118,0.35);color:var(--green)}'+
  '.dnm-exam-btn.play:hover{background:var(--green);color:#003915}'+
  '.dnm-exam-btn.del{border-color:rgba(255,107,107,0.25);color:var(--red)}'+
  '.dnm-exam-btn.del:hover{background:rgba(255,107,107,0.12)}'+
  /* — Yeni Deneme / Kategori formu — */
  '.dnm-add-row{display:flex;gap:6px;margin-top:8px}'+
  '.dnm-add-row input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:7px 10px;font-size:11px;font-family:"JetBrains Mono",monospace;color:var(--text);outline:none}'+
  '.dnm-new-cat-btn{background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.14);color:var(--muted);border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:Syne,sans-serif;width:100%;text-align:center;transition:all 0.15s;margin-top:4px}'+
  '.dnm-new-cat-btn:hover{border-color:rgba(139,92,246,0.4);color:var(--accent)}'+
  '.dnm-new-exam-btn{background:rgba(139,92,246,0.08);border:1px dashed rgba(139,92,246,0.3);color:var(--accent2);border-radius:8px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:Syne,sans-serif;width:100%;text-align:center;transition:all 0.15s;margin-top:2px}'+
  '.dnm-new-exam-btn:hover{background:rgba(139,92,246,0.16)}'+
  '.dnm-form{background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.22);border-radius:10px;padding:12px;margin:8px 0}'+
  '.dnm-form-field{margin-bottom:10px}'+
  '.dnm-form-field:last-child{margin-bottom:0}'+
  '.dnm-form-label{font-size:9.5px;font-weight:700;color:var(--muted);letter-spacing:0.8px;text-transform:uppercase;margin-bottom:6px;display:block}'+
  '.dnm-input,.dnm-select{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 11px;font-size:12px;font-family:Syne,sans-serif;color:var(--text);outline:none;box-sizing:border-box;transition:border-color 0.2s}'+
  '.dnm-input:focus,.dnm-select:focus{border-color:rgba(139,92,246,0.5)}'+
  '.dnm-select{cursor:pointer}'+
  '.dnm-form-row{display:flex;gap:8px}'+
  '.dnm-form-row .dnm-form-field{flex:1;min-width:0}'+
  '.dnm-file-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'+
  '.dnm-file-btn{background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:var(--blue);border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer;font-family:Syne,sans-serif;transition:all 0.15s;white-space:nowrap}'+
  '.dnm-file-btn:hover{background:rgba(59,130,246,0.2)}'+
  '.dnm-file-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(74,225,118,0.1);border:1px solid rgba(74,225,118,0.3);color:var(--green);border-radius:20px;padding:5px 6px 5px 12px;font-size:10.5px;font-weight:600}'+
  '.dnm-file-chip button{background:none;border:none;color:var(--green);cursor:pointer;font-size:12px;padding:2px 6px;opacity:0.7}'+
  '.dnm-file-chip button:hover{opacity:1}'+
  '.dnm-form-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}'+
  /* — Kategori bloğu üst şerit (mgr-cat-block'a ek) — */
  '.dnm-cat-color-btn{width:16px;height:16px;border-radius:5px;border:2px solid rgba(255,255,255,0.15);cursor:pointer;flex-shrink:0;transition:transform 0.15s}'+
  '.dnm-cat-color-btn:hover{transform:scale(1.2)}'+
  /* — PlayerWrap içi PDF embed / bitirme butonları — */
  '.dnm-pdf-embed{position:absolute;inset:0;background:#1a1b21;display:flex;flex-direction:column}'+
  '.dnm-pdf-iframe{flex:1;width:100%;border:none;background:#525659}'+
  '.dnm-pdf-topbar{position:absolute;top:10px;left:10px;right:10px;display:flex;justify-content:space-between;align-items:center;z-index:3;pointer-events:none}'+
  '.dnm-pdf-topbar>*{pointer-events:all}'+
  '.dnm-exit-mini-btn{background:rgba(11,13,18,0.75);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.15);color:var(--text2);width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.15s}'+
  '.dnm-exit-mini-btn:hover{background:rgba(255,107,107,0.25);color:#fff;border-color:rgba(255,107,107,0.4)}'+
  '.dnm-finish-sticky-btn{background:linear-gradient(135deg,#ff6b6b,#e84545);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:12px;font-weight:800;font-family:Syne,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(232,69,69,0.4);transition:all 0.15s;display:flex;align-items:center;gap:6px}'+
  '.dnm-finish-sticky-btn:hover{filter:brightness(1.1);transform:translateY(-1px)}'+
  '.dnm-huge-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(circle at 50% 40%,rgba(139,92,246,0.1),transparent 70%)}'+
  '.dnm-huge-icon{font-size:52px;opacity:0.5}'+
  '.dnm-huge-label{font-size:13px;color:var(--muted);text-align:center;max-width:320px;line-height:1.6;font-family:Syne,sans-serif}'+
  '.dnm-huge-btn{background:linear-gradient(135deg,#ff6b6b,#e84545);color:#fff;border:none;border-radius:16px;padding:22px 46px;font-size:17px;font-weight:800;font-family:Syne,sans-serif;cursor:pointer;box-shadow:0 12px 40px rgba(232,69,69,0.45);transition:all 0.18s;display:flex;align-items:center;gap:10px}'+
  '.dnm-huge-btn:hover{transform:scale(1.04);filter:brightness(1.08)}'+
  '.dnm-huge-btn:active{transform:scale(0.98)}'+
  /* — Skor / Sonuç modalı — */
  '.dnm-modal-wide{max-width:640px!important}'+
  '.dnm-modal-scroll{max-height:calc(90vh - 48px)}'+
  '.dnm-score-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}'+
  '.dnm-score-total{background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:10px 16px;text-align:center;min-width:110px}'+
  '.dnm-score-total-val{font-size:22px;font-weight:800;color:var(--accent2);font-family:"JetBrains Mono",monospace;line-height:1.1}'+
  '.dnm-score-total-lbl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-top:2px}'+
  '.dnm-subject-row{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px;margin-bottom:8px}'+
  '.dnm-subject-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px}'+
  '.dnm-subject-name{font-size:12px;font-weight:700;color:var(--text)}'+
  '.dnm-subject-total{font-size:9.5px;color:var(--muted);font-family:"JetBrains Mono",monospace;white-space:nowrap}'+
  '.dnm-subject-net{font-size:13px;font-weight:800;font-family:"JetBrains Mono",monospace;white-space:nowrap}'+
  '.dnm-subject-net.pos{color:var(--green)}'+
  '.dnm-subject-net.neg{color:var(--red)}'+
  '.dnm-subject-net.zero{color:var(--muted)}'+
  '.dnm-subject-inputs{display:flex;gap:8px}'+
  '.dnm-si-group{flex:1;text-align:center}'+
  '.dnm-si-group label{display:block;font-size:8.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}'+
  '.dnm-si-group input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:7px 4px;font-size:13px;font-weight:700;text-align:center;color:var(--text);font-family:"JetBrains Mono",monospace;outline:none;box-sizing:border-box}'+
  '.dnm-si-group input:focus{border-color:rgba(139,92,246,0.5)}'+
  '.dnm-si-group.dogru input{color:var(--green)}'+
  '.dnm-si-group.yanlis input{color:var(--red)}'+
  '.dnm-subject-remain{font-size:9px;color:var(--muted);text-align:right;margin-top:5px;font-family:"JetBrains Mono",monospace}'+
  '.dnm-subject-remain.over{color:var(--red);font-weight:700}'+
  '.dnm-score-readonly input{pointer-events:none;opacity:0.85}'+
  /* — Zamanlayıcı (stopwatch override) — */
  '.stopwatch-panel.dnm-timer-phase .sw-display{color:var(--accent2)}'+
  '.stopwatch-panel.dnm-timer-up .sw-display{color:var(--red);animation:dnmPulse 1s ease-in-out infinite}'+
  '@keyframes dnmPulse{0%,100%{opacity:1}50%{opacity:0.35}}'+
  '#dnmTimerInfoBar{font-size:10px;color:var(--accent2);text-align:center;padding:2px 0 6px;font-family:"JetBrains Mono",monospace;font-weight:600}'+
  /* — Sonuç detay (geçmiş/istatistik tıklama) — */
  '.dnm-result-mini{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}'+
  '.dnm-result-chip{font-size:9.5px;font-family:"JetBrains Mono",monospace;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:3px 7px;color:var(--text2)}'+
  '.dnm-si-group.bos-auto input{background:rgba(255,255,255,0.02);color:var(--muted);cursor:not-allowed;border-style:dashed;opacity:0.75}'+
  '.dnm-si-group.bos-auto label{opacity:0.7}'+
  /* — Sidebar (ana ekran, playlist panelinin üstü) mod alanı — */
  '.dnm-sidebar-mode-row{padding:10px 14px;flex-shrink:0}'+
  '.dnm-sidebar-wrap{flex:1;display:none;flex-direction:column;overflow:hidden;min-height:0}'+
  '.dnm-sidebar-head{padding:10px 14px 8px;font-size:11px;font-weight:800;color:var(--text2);letter-spacing:0.4px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.05)}'+
  '.dnm-sidebar-body{flex:1;overflow-y:auto;padding:10px 14px 16px;min-height:0}'+
  '@media (max-width:480px){.dnm-form-row{flex-direction:column;gap:10px}.dnm-huge-btn{padding:18px 30px;font-size:15px}.dnm-subject-inputs{gap:5px}}';
  var tag=document.createElement('style');
  tag.id='dnmStyles';
  tag.textContent=css;
  document.head.appendChild(tag);
}

/* ══════════ MODAL DOM ENJEKSİYONU ══════════ */
function _denemeInjectModals(){
  if(document.getElementById('dnmPdfChoiceOverlay'))return;
  var html=''+
  /* PDF açma seçim modalı */
  '<div class="modal-overlay" id="dnmPdfChoiceOverlay" onclick="if(event.target===this)denemeClosePdfChoice()">'+
    '<div class="modal">'+
      '<h3>📄 PDF Nasıl Açılsın?</h3>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.6">Bu denemeye bir PDF eklenmiş. Sınav ekranını nasıl görüntülemek istersin?</div>'+
      '<div style="display:flex;flex-direction:column;gap:8px">'+
        '<button class="dnm-exam-btn play" style="padding:12px;font-size:12px;justify-content:center" onclick="denemeOpenEmbeddedPdf()">🖥 Önizleme Olarak Aç <span style="font-weight:400;opacity:0.7">(uygulama içinde)</span></button>'+
        '<button class="dnm-exam-btn" style="padding:12px;font-size:12px;justify-content:center" onclick="denemeOpenExternalPdf()">↗ Normal PDF Olarak Aç <span style="font-weight:400;opacity:0.7">(yeni sekmede)</span></button>'+
        '<button class="dnm-exam-btn" style="padding:12px;font-size:12px;justify-content:center" onclick="denemeOpenNativeAppPdf()">📲 Bir Uygulamayla Aç <span style="font-weight:400;opacity:0.7">(uygulama seç)</span></button>'+
      '</div>'+
      '<div class="modal-btns"><button class="modal-btn cancel" onclick="denemeClosePdfChoice()">İptal</button></div>'+
    '</div>'+
  '</div>'+
  /* Denemeyi Bitir onay modalı */
  '<div class="modal-overlay" id="dnmFinishConfirmOverlay" onclick="if(event.target===this)denemeCloseFinishConfirm()">'+
    '<div class="modal">'+
      '<h3>🏁 Denemeyi Bitir</h3>'+
      '<div style="font-size:12px;color:var(--text2);margin-bottom:4px;line-height:1.6">Denemeyi bitirmek istediğine emin misin? Bir sonraki adımda net hesaplama ekranı açılacak.</div>'+
      '<div class="modal-btns"><button class="modal-btn cancel" onclick="denemeCloseFinishConfirm()">Vazgeç</button><button class="modal-btn confirm" style="background:var(--red)" onclick="denemeConfirmFinishYes()">Evet, Bitir</button></div>'+
    '</div>'+
  '</div>'+
  /* Skor girişi / sonuç modalı (geniş) */
  '<div class="modal-overlay" id="dnmScoreModalOverlay" onclick="if(event.target===this)denemeCloseScoreModal()">'+
    '<div class="modal dnm-modal-wide" id="dnmScoreModalBox">'+
      '<div id="dnmScoreModalBody"></div>'+
    '</div>'+
  '</div>'+
  /* Gizli PDF dosya seçici (kategori formu tarafından tetiklenir) */
  '<input type="file" id="dnmPdfFileInput" accept="application/pdf,.pdf" style="display:none" onchange="denemeHandlePdfFile(this)">';
  document.body.insertAdjacentHTML('beforeend',html);
}

/* ══════════ MOD GEÇİŞ ANAHTARI ENJEKSİYONU ══════════ */
function _denemeInjectModeToggle(){
  if(document.getElementById('dnmModeRow'))return;
  var header=document.querySelector('#calPanelOverlay .cal-panel-header');
  if(!header)return;
  var html='<div class="dnm-mode-row" id="dnmModeRow">'+
    '<div class="dnm-mode-toggle">'+
      '<div class="dnm-mode-pill" id="dnmModePill"></div>'+
      '<button class="dnm-mode-btn active" id="dnmModeBtnPlaylist" onclick="denemeSetMode(\'playlist\')">🎬 Playlist Modu</button>'+
      '<button class="dnm-mode-btn" id="dnmModeBtnDeneme" onclick="denemeSetMode(\'deneme\')">📝 Deneme Modu</button>'+
    '</div>'+
  '</div>';
  header.insertAdjacentHTML('afterend',html);
}

/* Ana ekran sidebar'ı: kronometre panelinin ALTI / playlist panelinin HEMEN ÜSTÜ.
 * Aynı toggle burada da var; Deneme Modu'na geçince .playlist-panel gizlenip
 * yerine TAM YETKİLİ Deneme Yöneticisi (kategori+sınav CRUD) render edilir. */
function _denemeInjectSidebarMode(){
  if(document.getElementById('dnmSideModeRow'))return;
  var pp=document.querySelector('.sidebar .playlist-panel');
  if(!pp)return;
  var html='<div class="dnm-mode-row dnm-sidebar-mode-row" id="dnmSideModeRow">'+
    '<div class="dnm-mode-toggle">'+
      '<div class="dnm-mode-pill" id="dnmSideModePill"></div>'+
      '<button class="dnm-mode-btn active" id="dnmSideModeBtnPlaylist" onclick="denemeSetMode(\'playlist\')">🎬 Playlist Modu</button>'+
      '<button class="dnm-mode-btn" id="dnmSideModeBtnDeneme" onclick="denemeSetMode(\'deneme\')">📝 Deneme Modu</button>'+
    '</div>'+
  '</div>'+
  '<div class="dnm-sidebar-wrap" id="dnmSideWrap" style="display:none">'+
    '<div class="dnm-sidebar-head"><span>📝 Deneme Yöneticisi</span></div>'+
    '<div class="dnm-sidebar-body" id="dnmSideBody"></div>'+
  '</div>';
  pp.insertAdjacentHTML('beforebegin',html);
}

function denemeSetMode(m){
  if(m===calMode)return;
  calMode=m;
  denemeSaveMode();
  denemeApplyModeLabels();
  renderCalBody();
}

function denemeApplyModeLabels(){
  var map=CAL_TAB_LABELS[calMode];
  if(map){
    var t1=document.getElementById('calTabStats');if(t1)t1.textContent=map.stats;
    var t2=document.getElementById('calTabHistory');if(t2)t2.textContent=map.history;
    var t3=document.getElementById('calTabPlanner');if(t3)t3.textContent=map.planner;
    var t4=document.getElementById('calTabManager');if(t4)t4.textContent=map.manager;
  }
  var pill=document.getElementById('dnmModePill');if(pill)pill.classList.toggle('deneme',calMode==='deneme');
  var bp=document.getElementById('dnmModeBtnPlaylist');if(bp)bp.classList.toggle('active',calMode==='playlist');
  var bd=document.getElementById('dnmModeBtnDeneme');if(bd)bd.classList.toggle('active',calMode==='deneme');
  var title=document.querySelector('#calPanelOverlay .cal-panel-title');
  if(title)title.textContent=calMode==='deneme'?'📝 Deneme Takip, Analiz & Yönetici':'📅 Takvim, Grafikler & Playlist Yöneticisi';

  var sPill=document.getElementById('dnmSideModePill');if(sPill)sPill.classList.toggle('deneme',calMode==='deneme');
  var sbp=document.getElementById('dnmSideModeBtnPlaylist');if(sbp)sbp.classList.toggle('active',calMode==='playlist');
  var sbd=document.getElementById('dnmSideModeBtnDeneme');if(sbd)sbd.classList.toggle('active',calMode==='deneme');
  denemeApplySidebarVisibility();
}

function denemeApplySidebarVisibility(){
  var pp=document.querySelector('.sidebar .playlist-panel');
  var wrap=document.getElementById('dnmSideWrap');
  if(!pp||!wrap)return;
  if(calMode==='deneme'){
    pp.style.display='none';
    wrap.style.display='flex';
    denemeRenderManagerTab(document.getElementById('dnmSideBody'),'Side');
  }else{
    pp.style.display='';
    wrap.style.display='none';
  }
}

/* Deneme verisi değişince, o an EKRANDA GÖRÜNEN tüm yüzeyleri (takvim paneli + sidebar)
 * tazeler. Manager/Stats/History/Planner fonksiyonlarının hepsi bunu çağırır. */
function denemeRefreshAllViews(){
  if(calMode!=='deneme')return;
  var calOv=document.getElementById('calPanelOverlay');
  if(calOv&&calOv.classList.contains('open'))renderCalBody();
  var sideBody=document.getElementById('dnmSideBody');
  if(sideBody)denemeRenderManagerTab(sideBody,'Side');
}

/* ══════════ MEVCUT FONKSİYONLARI SARMALAMA (index.html'deki openAiPanel deseniyle aynı) ══════════ */
function _denemeWrapCoreFunctions(){
  // renderCalBody: mod deneme ise kendi render'ımıza yönlendir
  var _origRenderCalBody=renderCalBody;
  renderCalBody=function(){
    if(calMode==='deneme'){denemeRenderCalBody();return;}
    _origRenderCalBody();
  };
  // swToggle / swReset: deneme sayacı aktifken kronometreyi değil sayacı kontrol et
  var _origSwToggle=swToggle;
  swToggle=function(){
    if(denemeTimerActive){denemeTimerToggle();return;}
    _origSwToggle();
  };
  var _origSwReset=swReset;
  swReset=function(){
    if(denemeTimerActive){denemeTimerReset();return;}
    _origSwReset();
  };
  /* checkMidnightReset / testMidnightReset: sınav KAYITLARINA (denemeExams)
   * DOKUNULMAZ — bunlar flashcard sistemi gibi kalıcıdır, playlist izleme
   * durumunun aksine gece yarısı silinmez. Ama EKRANDA AÇIK KALAN, henüz
   * kaydedilmemiş bir "canlı" durum varsa (çalışan bir deneme sayacı, açık
   * PDF/çalışma ekranı) — tıpkı playlist modunda o an oynayan videonun
   * kapatılması gibi — bu da sıfırlanmalı. Bu yüzden orijinal fonksiyonu
   * çağırmadan ÖNCE aktif sayaç/ekranı burada kapatıyoruz: böylece orijinal
   * fonksiyon içindeki swReset() çağrısı, sarmalanmış swReset'in yanlışlıkla
   * denemeTimerReset()'e yönlenip asıl kronometreyi (swAccum) sıfırlamadan
   * atlamasına engel olur. */
  var _origCheckMidnightReset=checkMidnightReset;
  checkMidnightReset=function(){
    _denemeClearActiveWorkspaceForReset();
    _origCheckMidnightReset();
    if(calMode==='deneme'){
      var ov=document.getElementById('calPanelOverlay');
      if(ov&&ov.classList.contains('open'))renderCalBody();
    }
  };
  /* BUG FIX: Ctrl+A+S test kısayolu (core.js → testMidnightReset) ÖNCEDEN
   * checkMidnightReset()'i ÇAĞIRMIYOR, aynı adımları elle KOPYALIYORDU —
   * bu yüzden yukarıdaki sarmalama (ve deneme moduna özel tazeleme) test
   * kısayolunda hiç devreye girmiyordu; kısayol gerçek gece yarısı
   * sıfırlamasıyla birebir aynı davranmıyordu. testMidnightReset'i de AYNI
   * yöntemle (checkMidnightReset ile birebir aynı şekilde) sarmalayarak
   * ikisini senkron tutuyoruz. */
  if(typeof testMidnightReset==='function'){
    var _origTestMidnightReset=testMidnightReset;
    testMidnightReset=function(){
      _denemeClearActiveWorkspaceForReset();
      _origTestMidnightReset();
      if(calMode==='deneme'){
        var ov=document.getElementById('calPanelOverlay');
        if(ov&&ov.classList.contains('open'))renderCalBody();
      }
    };
  }
}

/* Aktif bir deneme sayacı/çalışma ekranı varsa güvenle kapatır (onay
 * penceresi GÖSTERMEZ — bu otomatik bir sistem olayıdır, denemeExitWorkspace
 * gibi kullanıcı onayı beklemez). Sınavın kaydedilmiş SONUCUNA dokunmaz;
 * sadece o an ekranda açık kalan "canlı" akışı (playlist modundaki oynayan
 * videonun kapatılması gibi) temizler. */
function _denemeClearActiveWorkspaceForReset(){
  if(denemeTimerActive)denemeStopTimer();
  var box=document.getElementById('dnmPlayerOverlay');if(box)box.remove();
  var placeholder=document.getElementById('placeholder');if(placeholder)placeholder.style.display='flex';
  var scoreOv=document.getElementById('dnmScoreModalOverlay');if(scoreOv)scoreOv.classList.remove('open');
  var pdfChoiceOv=document.getElementById('dnmPdfChoiceOverlay');if(pdfChoiceOv)pdfChoiceOv.classList.remove('open');
  var finishConfirmOv=document.getElementById('dnmFinishConfirmOverlay');if(finishConfirmOv)finishConfirmOv.classList.remove('open');
  _dnmActiveExamId=null;
}

function denemeRenderCalBody(){
  var body=document.getElementById('calBody');
  if(!body)return;
  body.innerHTML='';
  if(calActiveTab==='stats')denemeRenderStatsTab(body);
  else if(calActiveTab==='history')denemeRenderHistoryTab(body);
  else if(calActiveTab==='planner')denemeRenderPlannerTab(body);
  else if(calActiveTab==='manager')denemeRenderManagerTab(body,'Cal');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DENEME YÖNETİCİSİ (Kategori + Sınav CRUD)
 * scope parametresi: 'Cal' (takvim paneli) veya 'Side' (ana ekran sidebar'ı).
 * Aynı veriyi (denemeCats/denemeExams) İKİ farklı DOM noktasında, ID çakışması
 * olmadan render edebilmek için tüm eleman id'leri scope ile damgalanır.
 * ═══════════════════════════════════════════════════════════════════════════ */
function _dnmSid(base,scope){return 'dnm'+scope+base;}
function _dnmRerenderScope(scope){
  if(scope==='Cal'){ if(calActiveTab==='manager')renderCalBody(); }
  else{ var sb=document.getElementById('dnmSideBody'); if(sb)denemeRenderManagerTab(sb,'Side'); }
}
function _dnmPdfKey(catId,scope){return scope+'_'+catId;}

function denemeRenderManagerTab(body,scope){
  var searchId=_dnmSid('MgrSearch',scope);
  var searchVal=dnmMgrSearch[scope]||'';
  var searchHtml='<input class="mgr-search" type="text" id="'+searchId+'" placeholder="Kategori veya deneme ara..." oninput="denemeOnMgrSearch(\''+scope+'\')" value="'+escapeHtml(searchVal)+'">';
  var q=searchVal.toLowerCase();
  var filtered=denemeCats.filter(function(cat){
    if(!q)return true;
    if(cat.name.toLowerCase().indexOf(q)>=0)return true;
    return denemeExamsInCat(cat.id).some(function(e){return e.isim.toLowerCase().indexOf(q)>=0;});
  });

  var html='';
  if(denemeCats.length===0){
    html+='<div class="dnm-empty">📁 Henüz kategori yok.<br>Örn: "Altın Karma", "Özdebir", "Branş Denemeleri"<br>Aşağıdan ilk kategorini oluştur.</div>';
  }else if(filtered.length===0){
    html+='<div class="dnm-empty">Arama sonucu bulunamadı.</div>';
  }

  filtered.forEach(function(cat){
    var isOpen=dnmExpandedCat[scope]===cat.id;
    var exams=denemeExamsInCat(cat.id);
    var doneCount=exams.filter(function(e){return e.completed;}).length;
    var dot='<span class="dnm-cat-color-btn" style="background:'+cat.color+'" onclick="event.stopPropagation();denemeOpenCatColorPicker(event,\''+cat.id+'\',\''+scope+'\')" title="Renk Değiştir"></span>';
    html+='<div class="mgr-pl-block" id="dnmcatblock'+scope+'-'+cat.id+'">'+
      '<div class="mgr-pl-header" onclick="denemeToggleCatOpen(\''+cat.id+'\',\''+scope+'\')">'+
        dot+
        '<div class="mgr-pl-title" id="dnmcattitle'+scope+'-'+cat.id+'">'+escapeHtml(cat.name)+'</div>'+
        '<div class="mgr-pl-stats">'+doneCount+'/'+exams.length+' tamamlandı</div>'+
        '<button class="mgr-pl-rename-btn" onclick="event.stopPropagation();denemeRenameCat(\''+cat.id+'\',\''+scope+'\')" title="Yeniden Adlandır">✏</button>'+
        '<button class="mgr-pl-del-btn" onclick="event.stopPropagation();denemeDeleteCat(\''+cat.id+'\',\''+scope+'\')" title="Kategoriyi Sil">🗑</button>'+
        '<span style="font-size:10px;color:var(--muted);margin-left:2px">'+(isOpen?'▲':'▼')+'</span>'+
      '</div>'+
      '<div class="mgr-pl-body'+(isOpen?' open':'')+'" id="dnmcatbody'+scope+'-'+cat.id+'">'+
        (isOpen?denemeRenderCatBody(cat,scope):'')+
      '</div>'+
    '</div>';
  });

  var newCatId=_dnmSid('CatNewInput',scope);
  html+='<div class="dnm-add-row"><input type="text" id="'+newCatId+'" placeholder="Yeni kategori adı... (örn: Altın Karma)" onkeydown="if(event.key===\'Enter\')denemeCreateCatInline(\''+scope+'\')">'+
    '<button class="mgr-vid-btn" onclick="denemeCreateCatInline(\''+scope+'\')" style="color:var(--green);border-color:rgba(46,204,113,0.4)">＋</button></div>';

  body.innerHTML=searchHtml+html;
  var s=document.getElementById(searchId);if(s&&searchVal)s.setSelectionRange(s.value.length,s.value.length);
}

function denemeRenderCatBody(cat,scope){
  var exams=denemeExamsInCat(cat.id);
  var q=(dnmMgrSearch[scope]||'').toLowerCase();
  var filteredExams=q?exams.filter(function(e){return e.isim.toLowerCase().indexOf(q)>=0;}):exams;
  var html='';
  if(exams.length===0){
    html+='<div style="font-size:11px;color:var(--muted);padding:4px 0 8px">Bu kategoride henüz deneme yok.</div>';
  }else{
    filteredExams.forEach(function(ex){html+=denemeExamCardHtml(ex,scope);});
  }
  html+='<div id="dnmexform'+scope+'-'+cat.id+'" class="dnm-form" style="display:none"></div>';
  html+='<button class="dnm-new-exam-btn" onclick="denemeOpenExamForm(\''+cat.id+'\',null,\''+scope+'\')">＋ Yeni Deneme Ekle</button>';
  return html;
}

function denemeExamCardHtml(ex,scope){
  var net=ex.result?ex.result.totalNet:null;
  var netCls=net===null?'':(net>0?'pos':(net<0?'neg':''));
  var netTxt=net===null?'Başlatılmadı':('Net: '+denemeFmtNetPlain(net));
  var timerTxt=ex.timerMin?('⏱ '+ex.timerMin+'dk'):'';
  var pdfTxt=ex.pdf?'📄 PDF':'';
  var completedIcon=ex.completed?'✅':'⏳';
  return '<div class="dnm-exam-card">'+
    '<div class="dnm-exam-card-body">'+
      '<div class="dnm-exam-card-top"><span class="dnm-exam-name">'+completedIcon+' '+escapeHtml(ex.isim)+'</span>'+denemeTurBadgeHtml(ex)+'</div>'+
      '<div class="dnm-exam-meta"><span class="net'+(netCls?' '+netCls:'')+'">'+netTxt+'</span>'+
        (timerTxt?'<span>'+timerTxt+'</span>':'')+(pdfTxt?'<span>'+pdfTxt+'</span>':'')+
      '</div>'+
    '</div>'+
    '<div class="dnm-exam-actions">'+
      (ex.completed?'<button class="dnm-exam-btn" onclick="denemeOpenScoreModal(\''+ex.id+'\')" title="Sonucu Gör / Düzenle">📊 Sonuç</button>':
        '<button class="dnm-exam-btn play" onclick="denemeLaunchExam(\''+ex.id+'\')" title="Başlat">▶ Başlat</button>')+
      '<button class="dnm-exam-btn" onclick="denemeOpenExamForm(\''+ex.catId+'\',\''+ex.id+'\',\''+scope+'\')" title="Düzenle">✏</button>'+
      '<button class="dnm-exam-btn del" onclick="denemeDeleteExam(\''+ex.id+'\')" title="Sil">✕</button>'+
    '</div>'+
  '</div>';
}

/* — Kategori CRUD — */
function denemeToggleCatOpen(catId,scope){
  dnmExpandedCat[scope]=dnmExpandedCat[scope]===catId?null:catId;
  _dnmRerenderScope(scope);
}

function denemeCreateCatInline(scope){
  var inp=document.getElementById(_dnmSid('CatNewInput',scope));if(!inp)return;
  var name=inp.value.trim();if(!name)return;
  var color=PALETTE[denemeCats.length%PALETTE.length];
  var cat={id:'dnmcat_'+uid(),name:name,color:color,createdAt:Date.now()};
  denemeCats.push(cat);denemeSaveCats();inp.value='';
  dnmExpandedCat[scope]=cat.id;
  denemeRefreshAllViews();
  showToast('📁 Kategori oluşturuldu: '+name);
}

function denemeRenameCat(catId,scope){
  var cat=denemeFindCat(catId);if(!cat)return;
  var titleEl=document.getElementById('dnmcattitle'+scope+'-'+catId);
  if(!titleEl){
    var nn=prompt('Yeni kategori adı:',cat.name);
    if(!nn||!nn.trim())return;
    cat.name=nn.trim();denemeSaveCats();
    denemeRefreshAllViews();
    return;
  }
  var orig=cat.name;
  var inp=document.createElement('input');inp.className='mgr-pl-rename-inp';inp.type='text';inp.value=orig;
  titleEl.replaceWith(inp);inp.focus();inp.select();
  function done(){
    var v=inp.value.trim();
    if(v&&v!==orig){cat.name=v;denemeSaveCats();}
    denemeRefreshAllViews();
  }
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'){done();}if(e.key==='Escape'){denemeRefreshAllViews();}e.stopPropagation();});
  inp.addEventListener('blur',done);
}

function denemeDeleteCat(catId,scope){
  var cat=denemeFindCat(catId);if(!cat)return;
  var examCount=denemeExamsInCat(catId).length;
  var msg=examCount>0?('Bu kategoriyi ve içindeki '+examCount+' denemeyi silmek istediğine emin misin? Bu işlem geri alınamaz.'):'Bu kategoriyi sil?';
  if(!confirm(msg))return;
  denemeCats=denemeCats.filter(function(c){return c.id!==catId;});
  denemeExams=denemeExams.filter(function(e){return e.catId!==catId;});
  denemeSaveCats();denemeSaveExams();
  if(dnmExpandedCat.Cal===catId)dnmExpandedCat.Cal=null;
  if(dnmExpandedCat.Side===catId)dnmExpandedCat.Side=null;
  denemeRefreshAllViews();
  showToast('🗑 Kategori silindi.');
}

function denemeOpenCatColorPicker(e,catId,scope){
  e.stopPropagation();e.preventDefault();
  var cat=denemeFindCat(catId);if(!cat)return;
  var btn=e.currentTarget||e.target;
  colorPickerCallback=function(color){
    if(!color)return;
    cat.color=color;denemeSaveCats();
    denemeRefreshAllViews();
    showToast('Renk güncellendi.');
  };
  showColorPicker(btn,cat.color,null,null);
}

function denemeOnMgrSearch(scope){
  var inp=document.getElementById(_dnmSid('MgrSearch',scope));
  dnmMgrSearch[scope]=inp?inp.value.trim():'';
  _dnmRerenderScope(scope);
}

/* — Sınav Formu (Oluştur / Düzenle) — */
function denemeOpenExamForm(catId,examId,scope){
  var cat=denemeFindCat(catId);if(!cat)return;
  var exam=examId?denemeFindExam(examId):null;
  var container=document.getElementById('dnmexform'+scope+'-'+catId);
  if(!container)return;
  var pdfKey=_dnmPdfKey(catId,scope);
  if(exam&&exam.pdf)_dnmPdfDraft[pdfKey]={name:exam.pdf.name,type:'pdf',data:exam.pdf.data};
  else delete _dnmPdfDraft[pdfKey];
  container.innerHTML=denemeExamFormHtml(catId,exam,scope);
  container.dataset.editId=examId||'';
  container.style.display='block';
  denemeRefreshPdfChip(catId,scope);
  denemeOnTurChange(catId,scope);
  container.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function denemeCloseExamForm(catId,scope){
  var container=document.getElementById('dnmexform'+scope+'-'+catId);
  if(container){container.style.display='none';container.innerHTML='';container.dataset.editId='';}
  delete _dnmPdfDraft[_dnmPdfKey(catId,scope)];
}

function denemeExamFormHtml(catId,exam,scope){
  var isEdit=!!exam;
  var isim=exam?exam.isim:'';
  var tur=exam?exam.tur:'tyt';
  var alan=exam&&exam.alan?exam.alan:'sayisal';
  var ders=exam&&exam.ders?exam.ders:BRANS_DERSLER[0];
  var bransTotal=exam&&exam.bransTotal?exam.bransTotal:(BRANS_DEFAULT_Q[ders]||40);
  var timerMin=exam&&exam.timerMin?exam.timerMin:'';

  var turOptions=['tyt','ayt','brans'].map(function(t){
    var lbl=t==='tyt'?'TYT':(t==='ayt'?'AYT':'Branş');
    return '<option value="'+t+'"'+(tur===t?' selected':'')+'>'+lbl+'</option>';
  }).join('');
  var alanOptions=['sayisal','sozel','esit'].map(function(a){
    return '<option value="'+a+'"'+(alan===a?' selected':'')+'>'+AYT_ALAN_LABELS[a]+'</option>';
  }).join('');
  var dersOptions=BRANS_DERSLER.map(function(d){
    return '<option value="'+escapeHtml(d)+'"'+(ders===d?' selected':'')+'>'+escapeHtml(d)+'</option>';
  }).join('');

  return '<div class="dnm-form-field"><label class="dnm-form-label">İsim</label>'+
    '<input type="text" class="dnm-input" id="dnmf-isim'+scope+'-'+catId+'" placeholder="Örn: Altın Karma Deneme 5" value="'+escapeHtml(isim)+'"></div>'+
    '<div class="dnm-form-row">'+
      '<div class="dnm-form-field"><label class="dnm-form-label">Tür</label>'+
      '<select class="dnm-select" id="dnmf-tur'+scope+'-'+catId+'" onchange="denemeOnTurChange(\''+catId+'\',\''+scope+'\')">'+turOptions+'</select></div>'+
      '<div class="dnm-form-field"><label class="dnm-form-label">Zamanlayıcı (dk, opsiyonel)</label>'+
      '<input type="number" class="dnm-input" id="dnmf-timer'+scope+'-'+catId+'" min="1" max="600" placeholder="Boş bırakılabilir" value="'+timerMin+'"></div>'+
    '</div>'+
    '<div class="dnm-form-field" id="dnmf-alan-wrap'+scope+'-'+catId+'" style="display:'+(tur==='ayt'?'block':'none')+'">'+
      '<label class="dnm-form-label">Alan</label><select class="dnm-select" id="dnmf-alan'+scope+'-'+catId+'">'+alanOptions+'</select></div>'+
    '<div class="dnm-form-row" id="dnmf-ders-wrap'+scope+'-'+catId+'" style="display:'+(tur==='brans'?'flex':'none')+'">'+
      '<div class="dnm-form-field"><label class="dnm-form-label">Ders</label>'+
      '<select class="dnm-select" id="dnmf-ders'+scope+'-'+catId+'" onchange="denemeOnBransDersChange(\''+catId+'\',\''+scope+'\')">'+dersOptions+'</select></div>'+
      '<div class="dnm-form-field"><label class="dnm-form-label">Soru Sayısı</label>'+
      '<input type="number" class="dnm-input" id="dnmf-bransq'+scope+'-'+catId+'" min="1" max="100" value="'+bransTotal+'"></div>'+
    '</div>'+
    '<div class="dnm-form-field"><label class="dnm-form-label">PDF Ekle (opsiyonel)</label>'+
    '<div class="dnm-file-row" id="dnmf-pdfchip'+scope+'-'+catId+'"></div></div>'+
    '<div class="dnm-form-btns">'+
    '<button class="modal-btn cancel" onclick="denemeCloseExamForm(\''+catId+'\',\''+scope+'\')">İptal</button>'+
    '<button class="modal-btn confirm" onclick="denemeSaveExam(\''+catId+'\',\''+scope+'\')">'+(isEdit?'Güncelle':'Kaydet')+'</button>'+
    '</div>';
}

function denemeOnTurChange(catId,scope){
  var sel=document.getElementById('dnmf-tur'+scope+'-'+catId);if(!sel)return;
  var tur=sel.value;
  var alanWrap=document.getElementById('dnmf-alan-wrap'+scope+'-'+catId);
  var dersWrap=document.getElementById('dnmf-ders-wrap'+scope+'-'+catId);
  if(alanWrap)alanWrap.style.display=tur==='ayt'?'block':'none';
  if(dersWrap)dersWrap.style.display=tur==='brans'?'flex':'none';
}
function denemeOnBransDersChange(catId,scope){
  var sel=document.getElementById('dnmf-ders'+scope+'-'+catId);
  var qInp=document.getElementById('dnmf-bransq'+scope+'-'+catId);
  if(sel&&qInp){var def=BRANS_DEFAULT_Q[sel.value];if(def)qInp.value=def;}
}

/* — PDF Seçimi (form içi taslak) — */
function denemePickPdfFile(catId,scope){
  _dnmPdfPickTarget={scope:scope,catId:catId};
  var inp=document.getElementById('dnmPdfFileInput');
  if(inp){inp.value='';inp.click();}
}
function denemeHandlePdfFile(inputEl){
  var catId=_dnmPdfPickTarget.catId,scope=_dnmPdfPickTarget.scope;
  if(!catId||!scope)return;
  if(!inputEl.files||!inputEl.files[0])return;
  var file=inputEl.files[0];
  var isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf');
  if(!isPdf){showToast('❌ Sadece PDF dosyası eklenebilir.');return;}
  /* Önleyici uyarı: PDF'ler cihazda base64 olarak (localStorage, ~5-10MB
   * sınırlı) saklanıyor. Büyük dosyalarda kaydetme anında sessizce
   * başarısız olma riskini en baştan bildir (bkz. denemeSaveExams). */
  var PDF_WARN_BYTES=4*1024*1024;
  if(file.size>PDF_WARN_BYTES){
    showToast('⚠️ "'+file.name+'" oldukça büyük ('+(file.size/1024/1024).toFixed(1)+' MB). Cihaz depolaması dolarsa bu PDF otomatik kaldırılabilir — mümkünse daha küçük/sıkıştırılmış bir dosya kullanmanı öneririm.');
  }
  var reader=new FileReader();
  reader.onload=function(ev){
    _dnmPdfDraft[_dnmPdfKey(catId,scope)]={name:file.name,type:'pdf',data:ev.target.result};
    denemeRefreshPdfChip(catId,scope);
    showToast('📎 PDF eklendi: '+file.name);
  };
  reader.readAsDataURL(file);
}
function denemeRefreshPdfChip(catId,scope){
  var chipWrap=document.getElementById('dnmf-pdfchip'+scope+'-'+catId);if(!chipWrap)return;
  var d=_dnmPdfDraft[_dnmPdfKey(catId,scope)];
  if(d){
    chipWrap.innerHTML='<span class="dnm-file-chip">📄 '+escapeHtml(d.name.length>26?d.name.substr(0,26)+'…':d.name)+'<button onclick="denemeRemovePdfDraft(\''+catId+'\',\''+scope+'\')" title="Kaldır">✕</button></span>';
  }else{
    chipWrap.innerHTML='<button type="button" class="dnm-file-btn" onclick="denemePickPdfFile(\''+catId+'\',\''+scope+'\')">📎 PDF Ekle</button>';
  }
}
function denemeRemovePdfDraft(catId,scope){delete _dnmPdfDraft[_dnmPdfKey(catId,scope)];denemeRefreshPdfChip(catId,scope);}

/* — Sınav Kaydet / Sil — */
function denemeSaveExam(catId,scope){
  var isimInp=document.getElementById('dnmf-isim'+scope+'-'+catId);
  var turSel=document.getElementById('dnmf-tur'+scope+'-'+catId);
  if(!isimInp||!turSel)return;
  var isim=isimInp.value.trim();
  if(!isim){showToast('❌ Sınav ismi boş olamaz.');return;}
  var tur=turSel.value;
  var alan=null,ders=null,bransTotal=null;
  if(tur==='ayt'){
    var alanSel=document.getElementById('dnmf-alan'+scope+'-'+catId);
    alan=alanSel?alanSel.value:'sayisal';
  }else if(tur==='brans'){
    var dersSel=document.getElementById('dnmf-ders'+scope+'-'+catId);
    var qInp=document.getElementById('dnmf-bransq'+scope+'-'+catId);
    ders=dersSel?dersSel.value:BRANS_DERSLER[0];
    bransTotal=qInp?(parseInt(qInp.value)||BRANS_DEFAULT_Q[ders]||40):(BRANS_DEFAULT_Q[ders]||40);
  }
  var timerInp=document.getElementById('dnmf-timer'+scope+'-'+catId);
  var timerMin=timerInp&&timerInp.value?parseInt(timerInp.value):null;
  if(timerMin&&timerMin<1)timerMin=null;

  var pdfDraft=_dnmPdfDraft[_dnmPdfKey(catId,scope)]||null;
  var pdf=pdfDraft?{name:pdfDraft.name,data:pdfDraft.data}:null;

  var container=document.getElementById('dnmexform'+scope+'-'+catId);
  var editId=container?container.dataset.editId:'';

  if(editId){
    var exam=denemeFindExam(editId);
    if(exam){
      var profileChanged=exam.tur!==tur||exam.alan!==alan||exam.ders!==ders;
      exam.isim=isim;exam.tur=tur;exam.alan=alan;exam.ders=ders;exam.bransTotal=bransTotal;exam.timerMin=timerMin;exam.pdf=pdf;
      if(profileChanged&&exam.completed){
        exam.completed=false;exam.result=null;exam.completedAt=null;
        showToast('✏ Deneme güncellendi. Tür değiştiği için önceki sonuç sıfırlandı.');
      }else{
        showToast('✅ Deneme güncellendi: '+isim);
      }
    }
  }else{
    denemeExams.push({id:'dnmex_'+uid(),catId:catId,isim:isim,tur:tur,alan:alan,ders:ders,bransTotal:bransTotal,
      timerMin:timerMin,pdf:pdf,createdAt:Date.now(),plannedDate:null,completed:false,completedAt:null,result:null});
    showToast('✅ Deneme oluşturuldu: '+isim);
  }
  denemeSaveExams();
  denemeCloseExamForm(catId,scope);
  denemeRefreshAllViews();
}

function denemeDeleteExam(examId){
  var exam=denemeFindExam(examId);if(!exam)return;
  if(!confirm('"'+exam.isim+'" denemesini silmek istediğine emin misin? Bu işlem geri alınamaz.'))return;
  denemeExams=denemeExams.filter(function(e){return e.id!==examId;});
  denemeSaveExams();
  denemeRefreshAllViews();
  showToast('🗑 Deneme silindi.');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SINAV YÜRÜTME AKIŞI (Launch → PDF Workflow → #playerWrap dönüşümü)
 * ═══════════════════════════════════════════════════════════════════════════ */
function denemeLaunchExam(examId){
  var exam=denemeFindExam(examId);if(!exam)return;
  _dnmActiveExamId=examId;
  closeCalendarPanel();
  if(exam.timerMin)denemeStartTimer(exam);
  if(exam.pdf)denemeShowPdfChoice();
  else denemeOpenScoreModal(examId);
}

/* — PDF açma seçimi modalı — */
function denemeShowPdfChoice(){var ov=document.getElementById('dnmPdfChoiceOverlay');if(ov)ov.classList.add('open');}
function _dnmHidePdfChoiceOverlay(){var ov=document.getElementById('dnmPdfChoiceOverlay');if(ov)ov.classList.remove('open');}
function denemeClosePdfChoice(){
  _dnmHidePdfChoiceOverlay();
  if(denemeTimerActive)denemeStopTimer();
  _dnmActiveExamId=null;
}
function denemeOpenEmbeddedPdf(){
  var exam=denemeFindExam(_dnmActiveExamId);if(!exam)return;
  _dnmHidePdfChoiceOverlay();
  denemeMountPlayerWrap('embedded',exam);
}
function denemeOpenExternalPdf(){
  var exam=denemeFindExam(_dnmActiveExamId);if(!exam)return;
  _dnmHidePdfChoiceOverlay();
  if(exam.pdf&&exam.pdf.data){
    var w=window.open(exam.pdf.data,'_blank');
    if(!w)showToast('⚠️ Yeni sekme engellendi olabilir, tarayıcı izinlerini kontrol et.');
  }
  denemeMountPlayerWrap('external',exam);
}

/* — Cihazdaki bir uygulama ile aç —
   Web Share API (navigator.share) dosya paylaşımını destekliyorsa native
   "Birlikte Aç / Paylaş" panelini açar (Android ve güncel iOS Safari'de
   çalışır) — kullanıcı listeden istediği uygulamayı seçer. Desteklemeyen
   tarayıcılarda (çoğunlukla masaüstü) PDF otomatik indirilir; kullanıcı
   işletim sisteminin kendi "Birlikte Aç" menüsünü kullanabilir.
   NOT: "her zaman bu uygulamayla aç" gibi kalıcı bir varsayılan atama işletim
   sistemi seviyesinde bir ayardır — web sayfası bunu belirleyemez/hatırlayamaz;
   cihazın kendi paneli sunuyorsa (bazı Android sürümlerinde olduğu gibi)
   kullanıcı orada seçer. */
function denemeOpenNativeAppPdf(){
  var exam=denemeFindExam(_dnmActiveExamId);if(!exam)return;
  _dnmHidePdfChoiceOverlay();
  if(!(exam.pdf&&exam.pdf.data)){denemeMountPlayerWrap('nativeapp',exam);return;}

  var filename=exam.pdf.name||exam.isim||'deneme';
  if(!/\.pdf$/i.test(filename))filename+='.pdf';

  var shared=false;
  try{
    var file=_dnmDataUrlToFile(exam.pdf.data,filename,'application/pdf');
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      shared=true;
      navigator.share({files:[file],title:exam.isim}).catch(function(err){
        if(err&&err.name!=='AbortError'){ // kullanıcı paneli iptal ettiyse sessiz geç
          showToast('⚠️ Paylaşım açılamadı, PDF indiriliyor…');
          _dnmDownloadPdf(exam.pdf.data,filename);
        }
      });
    }
  }catch(e){ shared=false; }

  if(!shared){
    _dnmDownloadPdf(exam.pdf.data,filename);
    showToast('⬇️ PDF indirildi — cihazının "Birlikte Aç" menüsünden istediğin uygulamayı seçebilirsin.');
  }
  denemeMountPlayerWrap('nativeapp',exam);
}
function _dnmDataUrlToFile(dataUrl,filename,mime){
  var b64=dataUrl.split(',')[1];
  var byteStr=atob(b64);
  var bytes=new Uint8Array(byteStr.length);
  for(var i=0;i<byteStr.length;i++)bytes[i]=byteStr.charCodeAt(i);
  return new File([bytes],filename,{type:mime||'application/pdf'});
}
function _dnmDownloadPdf(dataUrl,filename){
  var a=document.createElement('a');
  a.href=dataUrl;a.download=filename;
  document.body.appendChild(a);a.click();a.remove();
}

/* — #playerWrap içine PDF önizleme / HUGE buton montajı — */
function denemeMountPlayerWrap(mode,exam){
  destroyPlayer(); // mevcut video state'ini temiz şekilde kapatır, placeholder'ı görünür yapar
  var placeholder=document.getElementById('placeholder');
  if(placeholder)placeholder.style.display='none';
  var wrap=document.getElementById('playerWrap');if(!wrap)return;
  var old=document.getElementById('dnmPlayerOverlay');if(old)old.remove();

  var box=document.createElement('div');box.id='dnmPlayerOverlay';

  if(mode==='embedded'){
    box.className='dnm-pdf-embed';
    box.innerHTML='<iframe class="dnm-pdf-iframe" src="'+exam.pdf.data+'" title="'+escapeHtml(exam.isim)+'"></iframe>'+
      '<div class="dnm-pdf-topbar">'+
        '<button class="dnm-exit-mini-btn" onclick="denemeExitWorkspace()" title="Sınav ekranından çık">✕</button>'+
        '<button class="dnm-finish-sticky-btn" onclick="denemeShowFinishConfirm()">🏁 Denemeyi Bitir</button>'+
      '</div>';
  }else{
    var isNativeApp=mode==='nativeapp';
    var hugeMsg=isNativeApp
      ? '"'+escapeHtml(exam.isim)+'" PDF\'i seçtiğin uygulamaya gönderildi.<br>Sınavı bitirdiğinde aşağıdaki butona bas.'
      : '"'+escapeHtml(exam.isim)+'" PDF\'i yeni sekmede açıldı.<br>Sınavı bitirdiğinde aşağıdaki butona bas.';
    box.className='dnm-huge-wrap';
    box.innerHTML='<button class="dnm-exit-mini-btn" style="position:absolute;top:10px;left:10px" onclick="denemeExitWorkspace()" title="Sınav ekranından çık">✕</button>'+
      '<span class="dnm-huge-icon">'+(isNativeApp?'📲':'📄')+'</span>'+
      '<div class="dnm-huge-label">'+hugeMsg+'</div>'+
      '<button class="dnm-huge-btn" onclick="denemeShowFinishConfirm()">🏁 Denemeyi Bitir</button>';
  }
  wrap.appendChild(box);
}

/* — Sınav ekranından erken çıkış (kaydetmeden) — */
function denemeExitWorkspace(){
  if(!confirm('Sınav ekranından çıkmak istediğine emin misin? Net girişi yapılmadan çıkarsan ilerleme kaydedilmez.'))return;
  var box=document.getElementById('dnmPlayerOverlay');if(box)box.remove();
  var placeholder=document.getElementById('placeholder');if(placeholder)placeholder.style.display='flex';
  if(denemeTimerActive)denemeStopTimer();
  _dnmActiveExamId=null;
  showToast('Sınav ekranından çıkıldı.');
}

/* — "Denemeyi Bitir" onayı → skor ekranına geçiş — */
function denemeShowFinishConfirm(){var ov=document.getElementById('dnmFinishConfirmOverlay');if(ov)ov.classList.add('open');}
function denemeCloseFinishConfirm(){var ov=document.getElementById('dnmFinishConfirmOverlay');if(ov)ov.classList.remove('open');}
function denemeConfirmFinishYes(){
  denemeCloseFinishConfirm();
  var box=document.getElementById('dnmPlayerOverlay');if(box)box.remove();
  var placeholder=document.getElementById('placeholder');if(placeholder)placeholder.style.display='flex';
  if(denemeTimerActive)denemeStopTimer();
  var examId=_dnmActiveExamId;
  denemeOpenScoreModal(examId);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DENEME SONUCU HESAPLAMA (Skor Girişi Modalı) — TYT/AYT/Branş dinamik satırlar
 * ═══════════════════════════════════════════════════════════════════════════ */
function denemeOpenScoreModal(examId){
  var exam=denemeFindExam(examId);if(!exam)return;
  _dnmActiveExamId=examId;
  var body=document.getElementById('dnmScoreModalBody');if(!body)return;
  body.innerHTML=denemeScoreModalHtml(exam);
  var ov=document.getElementById('dnmScoreModalOverlay');if(ov)ov.classList.add('open');
  denemeUpdateScoreNet(examId);
}
function denemeCloseScoreModal(){
  var ov=document.getElementById('dnmScoreModalOverlay');if(ov)ov.classList.remove('open');
  if(denemeTimerActive)denemeStopTimer();
  _dnmActiveExamId=null;
}

function denemeScoreModalHtml(exam){
  var subjects=denemeGetProfile(exam);
  var prevResult=exam.result;
  var rowsHtml='';
  subjects.forEach(function(s){
    var prevSub=prevResult?prevResult.subjects.find(function(x){return x.key===s.key;}):null;
    var d=prevSub?prevSub.dogru:0,y=prevSub?prevSub.yanlis:0;
    var b=prevSub?prevSub.bos:Math.max(0,s.total-d-y);
    rowsHtml+='<div class="dnm-subject-row">'+
      '<div class="dnm-subject-top">'+
        '<span class="dnm-subject-name">'+escapeHtml(s.label)+'</span>'+
        '<span class="dnm-subject-total">'+s.total+' soru</span>'+
        '<span class="dnm-subject-net zero" id="dnmnet-'+exam.id+'-'+s.key+'">0</span>'+
      '</div>'+
      '<div class="dnm-subject-inputs">'+
        '<div class="dnm-si-group dogru"><label>Doğru</label><input type="number" min="0" max="'+s.total+'" value="'+d+'" id="dnmd-'+exam.id+'-'+s.key+'" oninput="denemeUpdateScoreNet(\''+exam.id+'\')"></div>'+
        '<div class="dnm-si-group yanlis"><label>Yanlış</label><input type="number" min="0" max="'+s.total+'" value="'+y+'" id="dnmy-'+exam.id+'-'+s.key+'" oninput="denemeUpdateScoreNet(\''+exam.id+'\')"></div>'+
        '<div class="dnm-si-group bos-auto"><label>Boş (oto)</label><input type="number" value="'+b+'" id="dnmb-'+exam.id+'-'+s.key+'" readonly tabindex="-1"></div>'+
      '</div>'+
      '<div class="dnm-subject-remain" id="dnmrem-'+exam.id+'-'+s.key+'"></div>'+
    '</div>';
  });
  var timerInfo=exam.timerMin?('<div style="font-size:10px;color:var(--muted);margin-bottom:10px">⏱ Süre: '+exam.timerMin+' dakika</div>'):'';
  return '<h3 style="margin-bottom:2px">📊 '+escapeHtml(exam.isim)+'</h3>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:12px">'+denemeTurLabel(exam)+' · Net Hesaplama</div>'+
    timerInfo+
    '<div class="dnm-score-head">'+
      '<div style="font-size:10px;color:var(--muted);flex:1;line-height:1.6">Net = Doğru − (Yanlış × 0.25)</div>'+
      '<div class="dnm-score-total"><div class="dnm-score-total-val" id="dnmTotalNetVal">0</div><div class="dnm-score-total-lbl">Toplam Net</div></div>'+
    '</div>'+
    '<div class="dnm-score-subjects">'+rowsHtml+'</div>'+
    '<div class="modal-btns" style="flex-wrap:wrap;justify-content:'+(exam.completed?'space-between':'flex-end')+'">'+
    (exam.completed?'<button class="modal-btn" style="background:rgba(255,255,255,0.05);color:var(--muted)" onclick="denemeResetExamResult(\''+exam.id+'\')">↺ Sıfırla</button>':'')+
    '<div style="display:flex;gap:8px">'+
    '<button class="modal-btn cancel" onclick="denemeCloseScoreModal()">Kapat</button>'+
    '<button class="modal-btn confirm" onclick="denemeSaveScore(\''+exam.id+'\')">💾 Kaydet</button>'+
    '</div></div>';
}

function denemeUpdateScoreNet(examId){
  var exam=denemeFindExam(examId);if(!exam)return;
  var subjects=denemeGetProfile(exam);
  var totalNet=0;
  subjects.forEach(function(s){
    var dEl=document.getElementById('dnmd-'+examId+'-'+s.key);
    var yEl=document.getElementById('dnmy-'+examId+'-'+s.key);
    var bEl=document.getElementById('dnmb-'+examId+'-'+s.key);
    if(!dEl||!yEl||!bEl)return;
    var d=Math.max(0,parseInt(dEl.value)||0);
    var y=Math.max(0,parseInt(yEl.value)||0);
    var over=(d+y)>s.total;
    // BUG FIX: Boş artık elle girilmiyor — Doğru/Yanlış her değiştiğinde
    // Toplam-(Doğru+Yanlış) formülüyle kendini otomatik günceller.
    var b=over?0:(s.total-d-y);
    bEl.value=b;
    var net=denemeNet(d,y);
    totalNet+=net;
    var netEl=document.getElementById('dnmnet-'+examId+'-'+s.key);
    if(netEl){netEl.textContent=denemeFmtNetPlain(net);netEl.className='dnm-subject-net '+(net>0?'pos':(net<0?'neg':'zero'));}
    var remEl=document.getElementById('dnmrem-'+examId+'-'+s.key);
    if(remEl){
      if(over){remEl.textContent='⚠ Doğru+Yanlış toplam soru sayısını ('+s.total+') '+((d+y)-s.total)+' aşıyor';remEl.className='dnm-subject-remain over';}
      else{remEl.textContent='';remEl.className='dnm-subject-remain';}
    }
  });
  var totalEl=document.getElementById('dnmTotalNetVal');
  if(totalEl)totalEl.textContent=denemeFmtNetPlain(totalNet);
}

function denemeSaveScore(examId){
  var exam=denemeFindExam(examId);if(!exam)return;
  var subjects=denemeGetProfile(exam);
  var resultSubjects=[],totalNet=0,totalD=0,totalY=0,totalB=0;
  subjects.forEach(function(s){
    var dEl=document.getElementById('dnmd-'+examId+'-'+s.key);
    var yEl=document.getElementById('dnmy-'+examId+'-'+s.key);
    var d=dEl?Math.max(0,parseInt(dEl.value)||0):0;
    var y=yEl?Math.max(0,parseInt(yEl.value)||0):0;
    var b=Math.max(0,s.total-d-y); // Boş: DOM'dan okunmaz, aynı formülle burada da türetilir
    var net=denemeNet(d,y);
    resultSubjects.push({key:s.key,label:s.label,total:s.total,dogru:d,yanlis:y,bos:b,net:net});
    totalNet+=net;totalD+=d;totalY+=y;totalB+=b;
  });
  var elapsedMs=null;
  if(exam.timerMin&&denemeTimerActive&&denemeTimerExamId===examId)elapsedMs=(exam.timerMin*60000)-denemeTimerRemainMs;
  exam.result={tur:exam.tur,alan:exam.alan,ders:exam.ders,subjects:resultSubjects,
    totalNet:Math.round(totalNet*100)/100,totalDogru:totalD,totalYanlis:totalY,totalBos:totalB,elapsedMs:elapsedMs};
  exam.completed=true;
  exam.completedAt=Date.now();
  denemeSaveExams();
  denemeCloseScoreModal();
  denemeRefreshAllViews();
  showToast('✅ Sonuç kaydedildi! Net: '+denemeFmtNetPlain(exam.result.totalNet));
}

function denemeResetExamResult(examId){
  var exam=denemeFindExam(examId);if(!exam)return;
  if(!confirm('Bu denemenin sonucunu sıfırlamak istediğine emin misin? Net verileri silinecek.'))return;
  exam.completed=false;exam.result=null;exam.completedAt=null;
  denemeSaveExams();
  denemeCloseScoreModal();
  denemeRefreshAllViews();
  showToast('↺ Sonuç sıfırlandı.');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ZAMANLAYICI (Countdown) — Pomodoro motoruyla AYNI mimari, mola turu olmadan
 * .stopwatch-panel / #swDisplay / #swPlayPauseBtn elemanlarını "override" eder
 * ═══════════════════════════════════════════════════════════════════════════ */
function denemeStartTimer(exam){
  if(typeof pomodoroActive!=='undefined'&&pomodoroActive)stopPomodoro();
  if(swRunning)swPause();
  denemeTimerActive=true;
  denemeTimerExamId=exam.id;
  denemeTimerTotalMs=exam.timerMin*60000;
  denemeTimerRemainMs=denemeTimerTotalMs;
  denemeTimerRunning=true;
  denemeTimerUp=false;
  denemeTimerPhaseStart=Date.now();
  denemeTimerPausedAt=0;
  var pmb=document.getElementById('pomodoroModeBtn');if(pmb)pmb.style.display='none';
  var lapBtn=document.getElementById('swLapBtn');if(lapBtn)lapBtn.style.display='none';
  var modeLbl=document.getElementById('swModeLabel');if(modeLbl)modeLbl.textContent='⏱ '+(exam.isim.length>16?exam.isim.substr(0,16)+'…':exam.isim);
  var panel=document.querySelector('.stopwatch-panel');if(panel)panel.classList.add('dnm-timer-phase');
  clearInterval(denemeTimerInterval);
  denemeTimerInterval=setInterval(denemeTimerTick,200);
  denemeTimerTick();
  denemeUpdateTimerInfoBar();
  denemeUpdateTimerMainBtn();
  showToast('⏱ Sayaç başladı: '+exam.timerMin+' dakika');
}

function denemeTimerTick(){
  if(!denemeTimerActive||!denemeTimerRunning)return;
  var elapsed=Date.now()-denemeTimerPhaseStart;
  var remain=denemeTimerTotalMs-elapsed;
  if(remain<=0){
    denemeTimerRemainMs=0;
    if(!denemeTimerUp){
      denemeTimerUp=true;
      clearInterval(denemeTimerInterval);denemeTimerInterval=null;
      denemeTimerRunning=false;
      var panel=document.querySelector('.stopwatch-panel');if(panel)panel.classList.add('dnm-timer-up');
      var disp=document.getElementById('swDisplay');if(disp)disp.textContent=swFormat(0);
      var statEl=document.getElementById('swStatus');if(statEl)statEl.textContent='⏰ Süre doldu!';
      beep([880,660,880],[0,300,600]);
      showToast('⏰ Süre doldu! Hazır olduğunda "Denemeyi Bitir" butonuna basabilirsin.');
    }
    return;
  }
  denemeTimerRemainMs=remain;
  var disp=document.getElementById('swDisplay');if(disp)disp.textContent=swFormat(remain);
  denemeUpdateTimerInfoBar();
}

function denemeTimerToggle(){
  if(!denemeTimerActive||denemeTimerUp)return;
  if(denemeTimerRunning){
    denemeTimerPausedAt=Date.now()-denemeTimerPhaseStart;
    denemeTimerRunning=false;
    clearInterval(denemeTimerInterval);denemeTimerInterval=null;
    showToast('⏸ Sayaç duraklatıldı');
  }else{
    denemeTimerPhaseStart=Date.now()-denemeTimerPausedAt;
    denemeTimerRunning=true;
    clearInterval(denemeTimerInterval);
    denemeTimerInterval=setInterval(denemeTimerTick,200);
    showToast('▶ Sayaç devam ediyor');
  }
  denemeUpdateTimerMainBtn();
}

function denemeUpdateTimerMainBtn(){
  if(!denemeTimerActive)return;
  var icon=document.getElementById('swPlayPauseIcon'),lbl=document.getElementById('swPlayPauseLbl'),btn=document.getElementById('swPlayPauseBtn');
  var dot=document.getElementById('swDot'),disp=document.getElementById('swDisplay'),stat=document.getElementById('swStatus');
  if(!denemeTimerRunning){
    if(icon)icon.textContent='▶';if(lbl)lbl.textContent='Devam Et';
    if(btn)btn.classList.remove('primary');
    if(dot)dot.classList.remove('running');if(disp)disp.classList.remove('running');
    if(stat&&!denemeTimerUp)stat.textContent='Duraklatıldı';
  }else{
    if(icon)icon.textContent='⏸';if(lbl)lbl.textContent='Duraklat';
    if(btn)btn.classList.add('primary');
    if(dot)dot.classList.add('running');if(disp)disp.classList.add('running');
    if(stat)stat.textContent='⏱ Sayaç işliyor';
  }
}

/* Reset — kalan süreyi TAM olarak başlangıç süresine döndürür (spesifikasyon şartı) */
function denemeTimerReset(){
  if(!denemeTimerActive)return;
  denemeTimerUp=false;
  denemeTimerRemainMs=denemeTimerTotalMs;
  denemeTimerPhaseStart=Date.now();
  denemeTimerPausedAt=0;
  var panel=document.querySelector('.stopwatch-panel');if(panel)panel.classList.remove('dnm-timer-up');
  if(!denemeTimerRunning){
    denemeTimerRunning=true;
    clearInterval(denemeTimerInterval);
    denemeTimerInterval=setInterval(denemeTimerTick,200);
  }
  // NOT: denemeTimerTick() BİLEREK çağrılmıyor — o fonksiyon Date.now() farkından yeniden
  // hesaplama yapar ve saniye sınırında ±1sn'lik görsel sapmaya yol açabilir. Spesifikasyon
  // "TAM başlangıç süresine dönmeli" dediği için değeri burada doğrudan/kesin yazıyoruz.
  var disp=document.getElementById('swDisplay');if(disp)disp.textContent=swFormat(denemeTimerTotalMs);
  denemeUpdateTimerInfoBar();
  denemeUpdateTimerMainBtn();
  showToast('↺ Sayaç sıfırlandı: '+Math.round(denemeTimerTotalMs/60000)+' dakika');
}

function denemeUpdateTimerInfoBar(){
  var bar=document.getElementById('pomodoroInfoBar');if(!bar)return;
  bar.style.display='block';
  var mins=Math.floor(denemeTimerRemainMs/60000),secs=Math.floor((denemeTimerRemainMs%60000)/1000);
  bar.innerHTML='<span style="background:rgba(139,92,246,0.18);color:var(--accent2);border:1px solid rgba(139,92,246,0.4);border-radius:10px;padding:2px 8px;font-weight:800;margin-right:6px">DENEME</span>Kalan: '+pad(mins)+':'+pad(secs);
}

function denemeStopTimer(){
  denemeTimerActive=false;denemeTimerRunning=false;denemeTimerUp=false;
  clearInterval(denemeTimerInterval);denemeTimerInterval=null;
  denemeTimerExamId=null;
  var modeLbl=document.getElementById('swModeLabel');if(modeLbl)modeLbl.textContent='Kronometre';
  var bar=document.getElementById('pomodoroInfoBar');if(bar)bar.style.display='none';
  var lapBtn=document.getElementById('swLapBtn');if(lapBtn)lapBtn.style.display='';
  var pmb=document.getElementById('pomodoroModeBtn');if(pmb)pmb.style.display='';
  var panel=document.querySelector('.stopwatch-panel');if(panel)panel.classList.remove('dnm-timer-phase','dnm-timer-up');
  var disp=document.getElementById('swDisplay');if(disp)disp.textContent=swFormat(swAccum);
  updateSwUI();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DENEME İSTATİSTİKLERİ (mevcut .stats-grid/.chart-wrap/.bar-chart CSS'i tekrar kullanır)
 * ═══════════════════════════════════════════════════════════════════════════ */
function denemeSetStatsRange(n){dnmStatsRangeN=n;if(calActiveTab==='stats')renderCalBody();}

function denemeRenderStatsTab(body){
  var completed=denemeExams.filter(function(e){return e.completed&&e.result;}).sort(function(a,b){return a.completedAt-b.completedAt;});
  if(completed.length===0){
    body.innerHTML='<div class="dnm-empty">📊 Henüz tamamlanmış deneme yok.<br>Bir deneme çözüp sonucunu kaydettiğinde istatistikler burada görünecek.</div>';
    return;
  }
  var rangeHtml='<div class="stats-range-row"><span class="stats-range-label">Gösterilecek:</span><div class="stats-range-btns">'+
    [5,10,20,999].map(function(n){
      var lbl=n===999?'Tümü':('Son '+n);
      return '<button class="stats-range-btn'+(dnmStatsRangeN===n?' active':'')+'" onclick="denemeSetStatsRange('+n+')">'+lbl+'</button>';
    }).join('')+
  '</div></div>';

  var ranged=dnmStatsRangeN>=999?completed:completed.slice(-dnmStatsRangeN);
  var avgNet=ranged.reduce(function(a,e){return a+e.result.totalNet;},0)/ranged.length;
  var maxNet=ranged.reduce(function(a,e){return Math.max(a,e.result.totalNet);},-Infinity);
  var minNet=ranged.reduce(function(a,e){return Math.min(a,e.result.totalNet);},Infinity);
  var lastNet=completed[completed.length-1].result.totalNet;
  var tytCount=completed.filter(function(e){return e.tur==='tyt';}).length;
  var aytCount=completed.filter(function(e){return e.tur==='ayt';}).length;
  var bransCount=completed.filter(function(e){return e.tur==='brans';}).length;

  var gridHtml='<div class="stats-grid">'+
    '<div class="stat-card"><div class="stat-card-val">'+completed.length+'</div><div class="stat-card-lbl">Toplam Deneme</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+denemeFmtNetPlain(avgNet)+'</div><div class="stat-card-lbl">Ortalama Net</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+denemeFmtNetPlain(maxNet)+'</div><div class="stat-card-lbl">En Yüksek Net</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+denemeFmtNetPlain(lastNet)+'</div><div class="stat-card-lbl">Son Deneme</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+tytCount+'/'+aytCount+'/'+bransCount+'</div><div class="stat-card-lbl">TYT/AYT/Branş</div></div>'+
    '<div class="stat-card"><div class="stat-card-val">'+denemeFmtNetPlain(minNet)+'</div><div class="stat-card-lbl">En Düşük Net</div></div>'+
  '</div>';

  var chartMax=ranged.reduce(function(a,e){return Math.max(a,Math.abs(e.result.totalNet));},1);
  var chartHtml='<div class="chart-wrap"><div class="chart-title">Net Grafiği <span style="font-size:10px;color:var(--muted);font-weight:400">(çubuğa tıkla → detay)</span></div><div class="bar-chart" id="dnmStatsBarChart">';
  ranged.forEach(function(ex){
    var net=ex.result.totalNet;
    var barH=Math.max(Math.round((Math.abs(net)/chartMax)*90),4);
    var d=new Date(ex.completedAt);
    var shortDate=d.getDate()+'/'+(d.getMonth()+1);
    chartHtml+='<div class="bar-col bar-col-clickable" onclick="denemeShowStatsExamDetail(\''+ex.id+'\')" title="'+escapeHtml(ex.isim)+': Net '+denemeFmtNetPlain(net)+' — Tıkla">'+
      '<div class="bar-col-val">'+denemeFmtNetPlain(net)+'</div>'+
      '<div class="bar-col-bar" style="height:'+barH+'px;'+(net<0?'background:linear-gradient(to top,var(--red),rgba(255,107,107,0.4))':'')+'"></div>'+
      '<div class="bar-col-label">'+shortDate+'</div>'+
    '</div>';
  });
  chartHtml+='</div></div>';

  var detailHtml='<div class="stats-day-detail" id="dnmStatsExamDetail" style="display:none"></div>';

  var catHtml='<div class="chart-wrap"><div class="chart-title">Kategori Bazlı Ortalama Net</div>';
  var anyCat=false;
  denemeCats.forEach(function(cat){
    var catExams=completed.filter(function(e){return e.catId===cat.id;});
    if(catExams.length===0)return;
    anyCat=true;
    var avg=catExams.reduce(function(a,e){return a+e.result.totalNet;},0)/catExams.length;
    var pct=chartMax>0?Math.min(100,Math.round((Math.abs(avg)/chartMax)*100)):0;
    catHtml+='<div style="margin-bottom:8px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;font-size:11px;color:var(--text2)">'+
        '<span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:'+cat.color+';display:inline-block;flex-shrink:0"></span>'+escapeHtml(cat.name)+'</span>'+
        '<span style="font-family:JetBrains Mono,monospace;font-size:10px;color:var(--muted)">'+catExams.length+' deneme • Ort. '+denemeFmtNetPlain(avg)+'</span>'+
      '</div>'+
      '<div style="height:5px;background:var(--surface3);border-radius:5px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+cat.color+';border-radius:5px;transition:width 0.4s"></div></div>'+
    '</div>';
  });
  if(!anyCat)catHtml+='<div style="font-size:11px;color:var(--muted)">Henüz kategorilendirilmiş tamamlanmış deneme yok.</div>';
  catHtml+='</div>';

  body.innerHTML=rangeHtml+gridHtml+chartHtml+detailHtml+catHtml;
}

function denemeShowStatsExamDetail(examId){
  var panel=document.getElementById('dnmStatsExamDetail');if(!panel)return;
  if(panel.dataset.openId===examId&&panel.style.display!=='none'){
    panel.style.display='none';panel.dataset.openId='';
    document.querySelectorAll('#dnmStatsBarChart .bar-col.bar-active').forEach(function(b){b.classList.remove('bar-active');});
    return;
  }
  panel.dataset.openId=examId;
  document.querySelectorAll('#dnmStatsBarChart .bar-col.bar-active').forEach(function(b){b.classList.remove('bar-active');});
  var exam=denemeFindExam(examId);if(!exam||!exam.result)return;
  panel.innerHTML=denemeResultDetailHtml(exam);
  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function denemeResultDetailHtml(exam){
  var html='<div class="stats-detail-header">'+
    '<div><div class="stats-detail-date">'+escapeHtml(exam.isim)+'</div>'+
    '<div class="stats-detail-time">'+denemeTurLabel(exam)+' · Net: '+denemeFmtNetPlain(exam.result.totalNet)+'</div></div>'+
    '<button class="stats-detail-close" onclick="var p=document.getElementById(\'dnmStatsExamDetail\');p.style.display=\'none\';p.dataset.openId=\'\'">✕</button>'+
  '</div><div class="dnm-result-mini">';
  exam.result.subjects.forEach(function(s){
    html+='<span class="dnm-result-chip">'+escapeHtml(s.label)+': '+s.dogru+'D '+s.yanlis+'Y '+s.bos+'B → '+denemeFmtNetPlain(s.net)+'</span>';
  });
  html+='</div><button class="hist-restore-btn" style="margin-top:10px;width:100%;text-align:center" onclick="denemeOpenScoreModal(\''+exam.id+'\')">📊 Detayları Düzenle</button>';
  return html;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DENEME GEÇMİŞİ (mevcut .hist-day* CSS'i tekrar kullanır, günlere göre gruplar)
 * ═══════════════════════════════════════════════════════════════════════════ */
function denemeOnHistSearch(val){dnmHistSearch=val.trim();if(calActiveTab==='history')renderCalBody();}

function denemeRenderHistoryTab(body){
  var completed=denemeExams.filter(function(e){return e.completed&&e.result;});
  var searchHtml='<div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">'+
    '<input type="text" id="dnmHistSearchInput" placeholder="🔍 Deneme adı veya tarih ara..." value="'+escapeHtml(dnmHistSearch)+'" oninput="denemeOnHistSearch(this.value)" '+
    'style="flex:1;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:7px 12px;font-size:12px;font-family:\'JetBrains Mono\',monospace;color:var(--text);outline:none;transition:border-color 0.2s" '+
    'onfocus="this.style.borderColor=\'rgba(139,92,246,0.5)\'" onblur="this.style.borderColor=\'var(--border2)\'">'+
    (dnmHistSearch?'<button onclick="denemeOnHistSearch(\'\');document.getElementById(\'dnmHistSearchInput\').value=\'\'" style="background:var(--surface2);border:1px solid var(--border2);border-radius:7px;color:var(--muted);cursor:pointer;padding:5px 9px;font-size:12px">✕</button>':'')+
  '</div>';

  if(completed.length===0){
    body.innerHTML=searchHtml+'<div class="dnm-empty">Henüz tamamlanmış deneme yok.<br>Bir denemeyi bitirip sonuç kaydettiğinde burada listelenecek.</div>';
    return;
  }

  var groups={};
  completed.forEach(function(ex){
    var d=new Date(ex.completedAt);
    var dateStr=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    if(!groups[dateStr])groups[dateStr]=[];
    groups[dateStr].push(ex);
  });
  var dateKeys=Object.keys(groups).sort().reverse();
  var q=dnmHistSearch.toLowerCase();
  var filteredKeys=dateKeys.filter(function(dateStr){
    if(!q)return true;
    if(formatDateHuman(dateStr).toLowerCase().indexOf(q)>=0||dateStr.indexOf(q)>=0)return true;
    return groups[dateStr].some(function(ex){return ex.isim.toLowerCase().indexOf(q)>=0;});
  });

  var infoHtml='<div style="font-size:11px;color:var(--muted);margin-bottom:8px">'+
    (dnmHistSearch?filteredKeys.length+' gün bulundu (toplam '+dateKeys.length+' gün, '+completed.length+' deneme)':
    completed.length+' deneme, '+dateKeys.length+' farklı günde tamamlandı.')+
  '</div>';

  if(filteredKeys.length===0){
    body.innerHTML=searchHtml+infoHtml+'<div style="text-align:center;color:var(--muted);padding:20px;font-size:12px">Arama sonucu bulunamadı.</div>';
    return;
  }

  var today=getTodayStr();
  var html='';
  filteredKeys.forEach(function(dateStr){
    var exams=groups[dateStr];
    var isToday=dateStr===today;
    var avgNet=exams.reduce(function(a,e){return a+e.result.totalNet;},0)/exams.length;
    html+='<div class="hist-day">'+
      '<div class="hist-day-header" onclick="denemeToggleHistDay(\'dnmhist-'+dateStr+'\')">'+
        '<div class="hist-day-date"><span class="hist-day-badge'+(isToday?' today':'')+'">'+(isToday?'BUGÜN':exams.length+' deneme')+'</span>'+formatDateHuman(dateStr)+'</div>'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div class="hist-day-time">Ort. Net: '+denemeFmtNetPlain(avgNet)+'</div>'+
          '<span class="hist-day-chevron" id="dnmchev-'+dateStr+'">▾</span>'+
        '</div>'+
      '</div>'+
      '<div class="hist-day-body" id="dnmhist-'+dateStr+'">'+denemeRenderHistDayBody(exams)+'</div>'+
    '</div>';
  });
  body.innerHTML=searchHtml+infoHtml+html;
}

function denemeRenderHistDayBody(exams){
  var html='';
  exams.forEach(function(ex){
    var cat=denemeFindCat(ex.catId);
    var dot=cat?('<span style="width:8px;height:8px;border-radius:50%;background:'+cat.color+';display:inline-block;flex-shrink:0"></span>'):'';
    html+='<div class="hist-pl-block" style="cursor:pointer" onclick="denemeOpenScoreModal(\''+ex.id+'\')">'+
      '<div class="hist-pl-name">'+dot+' '+escapeHtml(ex.isim)+' <span style="font-size:9px;color:var(--muted);font-weight:400">'+denemeTurLabel(ex)+'</span></div>'+
      '<div class="hist-vid-item"><span class="hist-vid-watched">✓</span><span style="flex:1">Net: '+denemeFmtNetPlain(ex.result.totalNet)+' ('+ex.result.totalDogru+'D '+ex.result.totalYanlis+'Y '+ex.result.totalBos+'B)</span></div>'+
    '</div>';
  });
  return html;
}

function denemeToggleHistDay(id){
  var el=document.getElementById(id);if(!el)return;
  var dateStr=id.replace('dnmhist-','');
  var chev=document.getElementById('dnmchev-'+dateStr);
  if(el.classList.contains('open')){el.classList.remove('open');if(chev)chev.classList.remove('open');}
  else{el.classList.add('open');if(chev)chev.classList.add('open');}
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DENEME PLANLAYICISI (mevcut .planner-cal-* CSS'i tekrar kullanır)
 * ═══════════════════════════════════════════════════════════════════════════ */
function denemeRenderPlannerTab(body){
  var today=getTodayStr();
  var now=new Date();
  var html='<div class="planner-cal-wrap">';
  for(var monthOffset=0;monthOffset<2;monthOffset++){
    var mDate=new Date(now.getFullYear(),now.getMonth()+monthOffset,1);
    var year=mDate.getFullYear();
    var month=mDate.getMonth();
    var monthNames=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    var daysInMonth=new Date(year,month+1,0).getDate();
    var firstDow=mDate.getDay();
    var startOffset=(firstDow===0?6:firstDow-1);

    html+='<div class="planner-month-block"><div class="planner-month-header"><div class="planner-month-title">'+monthNames[month]+' '+year+'</div></div><div class="planner-cal-grid">';
    ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'].forEach(function(d){html+='<div class="planner-cal-dow">'+d+'</div>';});
    for(var e=0;e<startOffset;e++)html+='<div class="planner-cal-day empty"></div>';

    for(var day=1;day<=daysInMonth;day++){
      var dateStr=year+'-'+pad(month+1)+'-'+pad(day);
      var isToday=dateStr===today;
      var plannedExams=denemeExams.filter(function(ex){return ex.plannedDate===dateStr;});
      var hasPlan=plannedExams.length>0;
      var isSelected=dnmPlannerSelectedDate===dateStr;
      var cls='planner-cal-day'+(isToday?' is-today':'')+(hasPlan?' has-plan':'')+(isSelected?' selected':'');
      var dots='';
      plannedExams.forEach(function(ex){
        var cat=denemeFindCat(ex.catId);
        var c=cat?cat.color:'var(--accent)';
        dots+='<div class="planner-day-dot" style="background:'+c+(ex.completed?';opacity:0.35':'')+'"></div>';
      });
      html+='<div class="'+cls+'" onclick="denemeSelectPlannerDay(\''+dateStr+'\')"><div class="planner-day-num">'+day+'</div>'+(dots?'<div class="planner-day-dot-row">'+dots+'</div>':'')+'</div>';
    }
    html+='</div></div>';
  }
  html+='</div>';

  html+='<div id="dnmPlannerDetailPanel" style="margin-top:8px">';
  if(dnmPlannerSelectedDate)html+=denemeRenderPlannerDayDetail(dnmPlannerSelectedDate);
  html+='</div>';

  var upcoming=denemeExams.filter(function(ex){return ex.plannedDate&&ex.plannedDate>=today&&!ex.completed;}).sort(function(a,b){return a.plannedDate<b.plannedDate?-1:1;});
  html+='<div class="dnm-section-title">Yaklaşan Denemeler</div>';
  if(upcoming.length===0){
    html+='<div style="font-size:11px;color:var(--muted)">Planlanan yaklaşan deneme yok. Takvimden bir gün seçip deneme atayabilirsin.</div>';
  }else{
    upcoming.slice(0,8).forEach(function(ex){
      html+='<div class="dnm-exam-card" style="cursor:pointer" onclick="denemeSelectPlannerDay(\''+ex.plannedDate+'\')">'+
        '<div class="dnm-exam-card-body"><div class="dnm-exam-card-top"><span class="dnm-exam-name">'+escapeHtml(ex.isim)+'</span>'+denemeTurBadgeHtml(ex)+'</div>'+
        '<div class="dnm-exam-meta"><span>📅 '+formatDateHuman(ex.plannedDate)+'</span></div></div>'+
      '</div>';
    });
  }

  body.innerHTML=html;
}

function denemeSelectPlannerDay(dateStr){
  dnmPlannerSelectedDate=dnmPlannerSelectedDate===dateStr?null:dateStr;
  if(calActiveTab==='planner')renderCalBody();
}

function denemeRenderPlannerDayDetail(dateStr){
  var plannedExams=denemeExams.filter(function(ex){return ex.plannedDate===dateStr;});
  var unplanned=denemeExams.filter(function(ex){return !ex.plannedDate&&!ex.completed;});

  var html='<div class="stats-detail-header">'+
    '<div><div class="stats-detail-date">'+formatDateHuman(dateStr)+'</div></div>'+
    '<button class="stats-detail-close" onclick="denemeSelectPlannerDay(\''+dateStr+'\')">✕</button>'+
  '</div>';

  if(plannedExams.length===0){
    html+='<div style="font-size:11px;color:var(--muted);padding:6px 0">Bu güne atanmış deneme yok.</div>';
  }else{
    plannedExams.forEach(function(ex){
      html+='<div class="dnm-exam-card">'+
        '<div class="dnm-exam-card-body"><div class="dnm-exam-card-top"><span class="dnm-exam-name">'+(ex.completed?'✅ ':'')+escapeHtml(ex.isim)+'</span>'+denemeTurBadgeHtml(ex)+'</div></div>'+
        '<div class="dnm-exam-actions"><button class="dnm-exam-btn del" onclick="denemeUnassignExam(\''+ex.id+'\')" title="Tarihten Kaldır">↩</button></div>'+
      '</div>';
    });
  }

  if(unplanned.length>0){
    html+='<div class="dnm-add-row"><select class="dnm-select" id="dnmPlannerAssignSel" style="flex:1"><option value="">— Deneme seç ve ata...</option>'+
      unplanned.map(function(ex){return '<option value="'+ex.id+'">'+escapeHtml(ex.isim)+'</option>';}).join('')+
    '</select><button class="mgr-vid-btn" onclick="denemeAssignExamToDate(\''+dateStr+'\')" style="color:var(--green);border-color:rgba(46,204,113,0.4)">Ata</button></div>';
  }
  return html;
}

function denemeAssignExamToDate(dateStr){
  var sel=document.getElementById('dnmPlannerAssignSel');if(!sel||!sel.value)return;
  var exam=denemeFindExam(sel.value);if(!exam)return;
  exam.plannedDate=dateStr;
  denemeSaveExams();
  if(calActiveTab==='planner')renderCalBody();
  showToast('📅 "'+exam.isim+'" '+formatDateHuman(dateStr)+' tarihine planlandı.');
}

function denemeUnassignExam(examId){
  var exam=denemeFindExam(examId);if(!exam)return;
  exam.plannedDate=null;
  denemeSaveExams();
  if(calActiveTab==='planner')renderCalBody();
  showToast('Tarihten kaldırıldı.');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * INIT — deneme.js kendi kendini açar, index.html/core.js'e ekstra kod GEREKMEZ
 * ═══════════════════════════════════════════════════════════════════════════ */
function _denemeInit(){
  try{
    denemeLoadAll();
    _denemeInjectStyles();
    _denemeInjectModals();
    _denemeInjectModeToggle();
    _denemeInjectSidebarMode();
    _denemeWrapCoreFunctions();
    denemeApplyModeLabels();
  }catch(err){
    console.error('[deneme.js] init hatası:',err);
  }
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',_denemeInit);
}else{
  _denemeInit();
}

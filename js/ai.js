/* ══════════ AI ASİSTAN & FLASHCARD (Google Gemini) ══════════ */
var GEMINI_MODEL = 'gemini-2.5-flash';
var GEMINI_MODEL_GROUNDING = 'gemini-2.5-flash'; // Google Search grounding için 2.0+
var LS_AI_KEY = 'aha_ai_key_v1';
var LS_AI_CHAT = 'aha_ai_chat_v1';
var LS_AI_CARDS = 'aha_flashcards_v1';
var LS_AI_CATS = 'aha_flashcards_cats_v1';

var aiActiveTab = 'chat';
var aiChatHistory = [];
var aiFlashcards = [];
var aiCategories = []; // [{id, ders, konu, color}]
var aiPastedImage = null;   // {mime, data} — "Flashcard Oluştur" sekmesinde yüklenen SS, sekme değişiminde KAYBOLMAZ
var aiPreviewCards = null;  // [{tip:'soru_cevap'|'bilgi', soru, cevap, baslik, icerik, img, kategoriId}]
var aiChatBusy = false;
var aiFcvDeck = null;       // tam ekran görüntüleyicide gezinilen kart listesi
var aiFcvIndex = 0;         // tam ekran görüntüleyicide aktif kart indeksi
var aiDeckFilter = null;    // null=tümü | {ders:'...'} | {ders:'...', konu:'...'}
var aiCatsOpenDers = {};    // {dersName: true} — Kategoriler sekmesinde açık ders bloğu

/* Kategori renk paleti */
var AI_CAT_COLORS = ['#e84545','#f5c842','#2ecc71','#3b82f6','#8b5cf6','#f97316','#06b6d4','#ec4899','#84cc16','#a78bfa'];
var AI_CAT_DEFAULT_COLOR = '#8b5cf6';

var AI_CHAT_SYSTEM = 'Sen AnlatHoca uygulamasında öğrencilere ders çalışırken yardımcı olan bir AI asistanısın. Güncel bilgilere erişimin var. Türkçe, samimi, kısa ve anlaşılır cevaplar ver. Gerekirse adım adım açıkla ve örnek ver. Güncel haber, gelişme veya tarih soruları için internet araması yaparak güncel bilgi sun ve kaynağını belirt.';

var AI_FC_PROMPT_IMAGE = 'Bu bir ekran görüntüsü. Görseldeki en önemli kavram(lar)ı, tanım(lar)ı veya soru(lar)ı bul ve bunlardan ders çalışmaya yönelik flashcard(lar) üret. '+
  'İki tip kart üretebilirsin: '+
  '1) "soru_cevap" — Görselde zaten bir soru ve şıklar varsa o soruyu ve doğru cevabı kullan (kısa bir açıklama da ekleyebilirsin). Yoksa görseldeki bilgiden kısa, öz bir soru-cevap çıkar. '+
  '2) "bilgi" — Görseldeki önemli bir kavram, tanım, formül veya ezberlenmesi gereken bir bilgi varsa, bunu kısa bir başlık ve rahat okunabilir, öz bir içerik halinde özetle (soru-cevap formatında olmasın, doğrudan bilgi kartı olsun). '+
  'İçerikteki bilgi miktarına ve türüne göre 1 ile 3 arasında, en uygun tiplerde kart üret (sadece soru-cevap, sadece bilgi veya ikisinin karışımı olabilir). '+
  'Her kart için ayrıca "ders" (örn: "Biyoloji", "Matematik", "Tarih", "Fizik", "Kimya", "Türkçe", "Coğrafya" vb.) ve "konu" (o ders içindeki alt başlık, örn: "Hücre Organelleri", "Türevler", "Osmanlı Dönemi") alanlarını da doldur. '+
  'Emin olamazsan makul bir tahmin yap; hiç doldurmamaktan daha iyidir. '+
  'SADECE şu formatta bir JSON dizisi döndür, başka hiçbir açıklama, başlık veya markdown ekleme: '+
  '[{"tip":"soru_cevap","soru":"...","cevap":"...","ders":"...","konu":"..."},{"tip":"bilgi","baslik":"...","icerik":"...","ders":"...","konu":"..."}]';

var AI_FC_PROMPT_TEXT = 'Aşağıdaki soruya kısa, net ve doğru bir cevap yaz. Her kart için ayrıca "ders" (örn: "Matematik", "Biyoloji") ve "konu" (alt başlık) alanını tahmin et. SADECE şu formatta bir JSON dizisi döndür, başka hiçbir açıklama, başlık veya markdown ekleme: [{"tip":"soru_cevap","soru":"...","cevap":"...","ders":"...","konu":"..."}]\n\nSoru: ';

/* ── ID üretimi ── */
function aiGenId(prefix){ return prefix+'_'+Date.now()+'_'+Math.floor(Math.random()*1000); }

/* ── API anahtarı ── */
function getAiKey(){ return localStorage.getItem(LS_AI_KEY) || ''; }
function setAiKey(k){ localStorage.setItem(LS_AI_KEY, k); }
function clearAiKey(){ localStorage.removeItem(LS_AI_KEY); }

function changeAiKey(){
  if(!getAiKey()){ showToast('ℹ️ Kayıtlı bir anahtar yok.'); return; }
  if(!confirm('Kayıtlı API anahtarını silmek istediğine emin misin?')) return;
  clearAiKey();
  showToast('🔑 API anahtarı silindi.');
  renderAiBody();
}

/* ── Sohbet & Kart verisi ── */
function loadAiChat(){
  try{ aiChatHistory = JSON.parse(localStorage.getItem(LS_AI_CHAT)||'[]'); }catch(e){ aiChatHistory=[]; }
}
function saveAiChat(){ localStorage.setItem(LS_AI_CHAT, JSON.stringify(aiChatHistory)); }

function loadAiFlashcards(){
  try{ aiFlashcards = JSON.parse(localStorage.getItem(LS_AI_CARDS)||'[]'); }catch(e){ aiFlashcards=[]; }
}
function saveAiFlashcards(){ localStorage.setItem(LS_AI_CARDS, JSON.stringify(aiFlashcards)); }

function loadAiCategories(){
  try{ aiCategories = JSON.parse(localStorage.getItem(LS_AI_CATS)||'[]'); }catch(e){ aiCategories=[]; }
}
function saveAiCategories(){ localStorage.setItem(LS_AI_CATS, JSON.stringify(aiCategories)); }

/* ── Kategori yardımcıları ── */
function aiCatById(id){ return aiCategories.find(function(c){ return c.id===id; }) || null; }

/* Ders adından renk üret (deterministik — aynı ders adı hep aynı renk) */
function aiDersColor(ders){
  var cat = aiCategories.find(function(c){ return c.ders===ders; });
  if(cat) return cat.color || AI_CAT_DEFAULT_COLOR;
  var hash = 0;
  for(var i=0;i<ders.length;i++) hash = (hash*31+ders.charCodeAt(i))&0xffffffff;
  return AI_CAT_COLORS[Math.abs(hash) % AI_CAT_COLORS.length];
}

/* Verilen ders+konu çiftine karşılık gelen kategori id'sini döndürür; yoksa yeni oluşturur */
function aiGetOrCreateCategory(ders, konu){
  if(!ders) return null;
  ders = ders.trim(); konu = (konu||'').trim();
  var existing = aiCategories.find(function(c){
    return c.ders.toLowerCase()===ders.toLowerCase() && c.konu.toLowerCase()===(konu||'').toLowerCase();
  });
  if(existing) return existing.id;
  var color = aiDersColor(ders);
  var id = aiGenId('cat');
  aiCategories.push({ id:id, ders:ders, konu:konu, color:color });
  saveAiCategories();
  return id;
}

/* Bir kategorinin kaç kartı var */
function aiCatCardCount(catId){
  return aiFlashcards.filter(function(c){ return c.kategoriId===catId; }).length;
}

/* Bir dersin tüm kategorilerindeki kart sayısı */
function aiDersTotalCount(ders){
  var cats = aiCategories.filter(function(c){ return c.ders===ders; });
  var ids = cats.map(function(c){ return c.id; });
  return aiFlashcards.filter(function(c){ return ids.indexOf(c.kategoriId)!==-1; }).length;
}

/* Tüm unique ders adları */
function aiAllDersler(){ return [...new Set(aiCategories.map(function(c){ return c.ders; }))]; }

/* <option> listesi için tüm kategoriler formatlı */
function aiCatSelectOptions(selectedId, includeEmpty){
  var html = includeEmpty ? '<option value="">(Kategori yok)</option>' : '';
  var dersler = aiAllDersler();
  dersler.forEach(function(ders){
    var konular = aiCategories.filter(function(c){ return c.ders===ders; });
    html += '<optgroup label="📚 '+escapeHtml(ders)+'">';
    konular.forEach(function(c){
      var label = c.konu ? c.konu : '(Genel)';
      html += '<option value="'+c.id+'"'+(c.id===selectedId?' selected':'')+'>'+escapeHtml(label)+'</option>';
    });
    html += '</optgroup>';
  });
  return html;
}

/* ── Mesajın internet araması gerektirip gerektirmediğini tahmin et ── */
function needsGrounding(text){
  if(!text) return false;
  var lower = text.toLowerCase();
  var triggers = ['haber','güncel','son dakika','bugün','dün','bu hafta','bu ay','bu yıl',
    'kaç para','dolar','euro','borsa','seçim','sonuç','maç','skor','puan',
    'kim kazandı','ne zaman','yeni','açıkland','duyurul','gelişme',
    'şu an','şu sıralar','son gelişme','recent','news','today','current','latest',
    '2024','2025','2026'];
  return triggers.some(function(t){ return lower.indexOf(t) !== -1; });
}

/* ── Gemini API çağrısı — useGrounding=true → Google Search erişimi ── */
function callGeminiAPI(contents, systemText, jsonMode, useGrounding){
  var key = getAiKey();
  if(!key) return Promise.reject(new Error('Önce API anahtarını gir.'));
  var model = (useGrounding && !jsonMode) ? GEMINI_MODEL_GROUNDING : GEMINI_MODEL;
  var body = { contents: contents };
  if(systemText) body.systemInstruction = { parts:[{text:systemText}] };
  if(jsonMode){
    body.generationConfig = { responseMimeType:'application/json' };
  } else if(useGrounding){
    body.tools = [{ googleSearch: {} }];
  }
  return fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+encodeURIComponent(key), {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }).then(function(r){
    if(!r.ok){
      return r.json().catch(function(){return null;}).then(function(e){
        var msg = (e && e.error && e.error.message) || ('HTTP '+r.status);
        throw new Error(msg);
      });
    }
    return r.json();
  }).then(function(d){
    var cand = d.candidates && d.candidates[0];
    if(!cand || !cand.content || !cand.content.parts) throw new Error('Boş yanıt geldi, tekrar dene.');
    var text = cand.content.parts.map(function(p){ return p.text || ''; }).join('');
    /* Grounding kaynakları varsa sona ekle */
    try {
      var meta = cand.groundingMetadata;
      if(meta && meta.groundingChunks && meta.groundingChunks.length){
        var srcs = meta.groundingChunks
          .filter(function(c){ return c.web && c.web.uri; })
          .slice(0,3)
          .map(function(c,i){ return (i+1)+'. ['+(c.web.title||c.web.uri)+']('+c.web.uri+')'; });
        if(srcs.length) text += '\n\n---\n**🌐 Kaynaklar:**\n'+srcs.join('\n');
      }
    } catch(e){}
    return text;
  });
}

/* ── Panel aç/kapat/sekme ── */
function openAiPanel(){
  document.getElementById('aiPanelOverlay').classList.add('open');
  renderAiBody();
}
function closeAiPanel(){
  document.getElementById('aiPanelOverlay').classList.remove('open');
}
function switchAiTab(tab){
  aiActiveTab = tab;
  ['chat','create','deck','cats'].forEach(function(t){
    var el = document.getElementById('aiTab'+t.charAt(0).toUpperCase()+t.slice(1));
    if(el) el.classList.toggle('active', t===tab);
  });
  renderAiBody();
}

function renderAiBody(){
  var body = document.getElementById('aiBody');
  if(!body) return;
  if(!getAiKey()){ body.innerHTML = aiKeySetupHtml(); return; }
  if(aiActiveTab==='chat'){
    body.innerHTML = aiChatHtml();
    renderAiChatMessages();
    var inp = document.getElementById('aiChatInput');
    if(inp){
      inp.addEventListener('keydown', function(e){
        if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendAiChatMessage(); }
      });
    }
  } else if(aiActiveTab==='create'){
    body.innerHTML = aiCreateHtml();
    setupAiCreateTab();
  } else if(aiActiveTab==='deck'){
    body.innerHTML = aiDeckHtml();
    renderAiDeck();
  } else if(aiActiveTab==='cats'){
    body.innerHTML = aiCatsHtml();
    renderAiCats();
  }
}

/* ── API anahtarı kurulum ekranı ── */
function aiKeySetupHtml(){
  return '<div class="ai-key-box">'+
    '<h4>🔑 Gemini API Anahtarı Gerekli</h4>'+
    '<p>AI sohbet ve flashcard özellikleri için ücretsiz bir Google Gemini API anahtarına ihtiyaç var. '+
    '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> adresine Google hesabınla giriş yap, "Create API key" butonuna bas ve çıkan kodu buraya yapıştır. '+
    'Anahtar sadece bu tarayıcıda (localStorage) saklanır, hiçbir sunucuya gönderilmez.</p>'+
    '<div class="ai-key-row">'+
      '<input type="password" id="aiKeyInput" placeholder="AIza..." autocomplete="off" spellcheck="false">'+
      '<button onclick="saveAiKeyFromInput()">Kaydet</button>'+
    '</div>'+
  '</div>';
}
function saveAiKeyFromInput(){
  var el = document.getElementById('aiKeyInput');
  var v = el ? el.value.trim() : '';
  if(!v){ showToast('❌ Anahtar boş olamaz.'); return; }
  setAiKey(v);
  showToast('✅ API anahtarı kaydedildi!');
  renderAiBody();
}

/* ══ SOHBET ══ */
function aiChatHtml(){
  return '<div class="ai-chat-wrap">'+
    '<div class="ai-chat-clear" onclick="clearAiChat()">🗑 Sohbeti Temizle</div>'+
    '<div class="ai-chat-messages" id="aiChatMessages"></div>'+
    '<div class="ai-chat-input-row">'+
      '<textarea id="aiChatInput" rows="2" placeholder="Bir şey sor... (Enter: gönder, Shift+Enter: yeni satır)"></textarea>'+
      '<button id="aiChatSendBtn" onclick="sendAiChatMessage()">➤</button>'+
    '</div>'+
  '</div>';
}

/* ── AI mesaj highlight parser ── */
function renderAiMd(raw){
  var lines = raw.split('\n');
  var out = [];
  var inList = false, inNumList = false;

  function closeList(){
    if(inList){ out.push('</div>'); inList=false; }
    if(inNumList){ out.push('</div>'); inNumList=false; }
  }

  function inlineFormat(str){
    // Inline code backtick
    str = str.replace(/`([^`]+)`/g, function(_,c){ return '<span class="ai-code">'+escapeHtml(c)+'</span>'; });
    // Bold+italic ***
    str = str.replace(/\*\*\*([^*]+)\*\*\*/g, function(_,t){ return '<span class="ai-hl-yellow">'+escapeHtml(t)+'</span>'; });
    // Bold ** → sarı highlight (anahtar kavramlar)
    str = str.replace(/\*\*([^*]+)\*\*/g, function(_,t){ return '<span class="ai-hl-yellow">'+escapeHtml(t)+'</span>'; });
    // Italic * → mavi vurgu
    str = str.replace(/\*([^*]+)\*/g, function(_,t){ return '<span class="ai-hl-blue">'+escapeHtml(t)+'</span>'; });
    // ==vurgu== → yeşil
    str = str.replace(/==([^=]+)==/g, function(_,t){ return '<span class="ai-hl-green">'+escapeHtml(t)+'</span>'; });
    // ~~önemli~~ → kırmızı
    str = str.replace(/~~([^~]+)~~/g, function(_,t){ return '<span class="ai-hl-red">'+escapeHtml(t)+'</span>'; });
    return str;
  }

  for(var i=0;i<lines.length;i++){
    var line = lines[i];
    var trimmed = line.trim();

    // Horizontal rule
    if(/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)){
      closeList();
      out.push('<span class="ai-sep"></span>');
      continue;
    }
    // H1 ## veya #
    if(/^#{1,2}\s/.test(trimmed)){
      closeList();
      var htxt = trimmed.replace(/^#{1,2}\s+/,'');
      out.push('<span class="ai-h ai-h1">'+inlineFormat(htxt)+'</span>');
      continue;
    }
    // H2-3 ###
    if(/^#{3,}\s/.test(trimmed)){
      closeList();
      var htxt2 = trimmed.replace(/^#{3,}\s+/,'');
      out.push('<span class="ai-h">'+inlineFormat(htxt2)+'</span>');
      continue;
    }
    // Numbered list
    var numMatch = trimmed.match(/^(\d+)[.)]\s+(.*)/);
    if(numMatch){
      if(inList){ out.push('</div>'); inList=false; }
      if(!inNumList){ out.push('<div class="ai-num-list">'); inNumList=true; }
      out.push('<span class="ai-num-item">'+inlineFormat(numMatch[2])+'</span>');
      continue;
    }
    // Bullet list - * veya -
    if(/^[-*+]\s+/.test(trimmed)){
      if(inNumList){ out.push('</div>'); inNumList=false; }
      if(!inList){ out.push('<div class="ai-list">'); inList=true; }
      var liTxt = trimmed.replace(/^[-*+]\s+/,'');
      out.push('<span class="ai-list-item">'+inlineFormat(liTxt)+'</span>');
      continue;
    }
    // Boş satır
    if(!trimmed){
      closeList();
      continue;
    }
    // Normal paragraf
    closeList();
    out.push('<span class="ai-para">'+inlineFormat(escapeHtml(trimmed).replace(/&lt;span/g,'<span').replace(/&lt;\/span&gt;/g,'</span>'))+'</span>');
  }
  closeList();
  return out.join('');
}

/* inline format sonrası escapeHtml çakışmasını önlemek için düzelt */
function renderAiMdSafe(raw){
  // escapeHtml'i inline format öncesi yapalım, sonra span'ları geri koyalım
  var lines = raw.split('\n');
  var out = [];
  var inList = false, inNumList = false;

  function closeList(){
    if(inList){ out.push('</div>'); inList=false; }
    if(inNumList){ out.push('</div>'); inNumList=false; }
  }

  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function inlineFormat(str){
    // önce escape et
    var s = esc(str);
    // inline code
    s = s.replace(/`([^`]+)`/g, '<span class="ai-code">$1</span>');
    // bold+italic
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<span class="ai-hl-yellow">$1</span>');
    // bold → sarı fosforlu
    s = s.replace(/\*\*([^*]+)\*\*/g, '<span class="ai-hl-yellow">$1</span>');
    // italic → mavi
    s = s.replace(/\*([^*]+)\*/g, '<span class="ai-hl-blue">$1</span>');
    // ==vurgu== → yeşil
    s = s.replace(/==([^=]+)==/g, '<span class="ai-hl-green">$1</span>');
    // ~~metin~~ → kırmızı
    s = s.replace(/~~([^~]+)~~/g, '<span class="ai-hl-red">$1</span>');
    return s;
  }

  for(var i=0;i<lines.length;i++){
    var line = lines[i];
    var trimmed = line.trim();

    if(/^---+$/.test(trimmed)||/^\*\*\*+$/.test(trimmed)){
      closeList(); out.push('<span class="ai-sep"></span>'); continue;
    }
    if(/^#{1,2}\s/.test(trimmed)){
      closeList();
      out.push('<span class="ai-h ai-h1">'+inlineFormat(trimmed.replace(/^#{1,2}\s+/,''))+'</span>');
      continue;
    }
    if(/^#{3,}\s/.test(trimmed)){
      closeList();
      out.push('<span class="ai-h">'+inlineFormat(trimmed.replace(/^#{3,}\s+/,''))+'</span>');
      continue;
    }
    var nm = trimmed.match(/^(\d+)[.)]\s+(.*)/);
    if(nm){
      if(inList){out.push('</div>');inList=false;}
      if(!inNumList){out.push('<div class="ai-num-list">');inNumList=true;}
      out.push('<span class="ai-num-item">'+inlineFormat(nm[2])+'</span>');
      continue;
    }
    if(/^[-*+]\s+/.test(trimmed)){
      if(inNumList){out.push('</div>');inNumList=false;}
      if(!inList){out.push('<div class="ai-list">');inList=true;}
      out.push('<span class="ai-list-item">'+inlineFormat(trimmed.replace(/^[-*+]\s+/,''))+'</span>');
      continue;
    }
    if(!trimmed){closeList();continue;}
    closeList();
    out.push('<span class="ai-para">'+inlineFormat(trimmed)+'</span>');
  }
  closeList();
  return out.join('');
}

function renderAiChatMessages(){
  var box = document.getElementById('aiChatMessages');
  if(!box) return;
  if(!aiChatHistory.length){
    box.innerHTML = '<div class="ai-chat-empty">👋 Selam! Bir konuyu anlatabilirim, soru çözebilirim ya da kafana takılan ne varsa sorabilirsin.</div>';
    return;
  }
  box.innerHTML = aiChatHistory.map(function(m){
    var cls = m.role==='user' ? 'ai-msg-user' : 'ai-msg-bot';
    var txt = (m.parts||[]).map(function(p){ return p.text || ''; }).join('');
    if(m.role==='user'){
      return '<div class="ai-msg '+cls+'">'+escapeHtml(txt)+'</div>';
    } else {
      return '<div class="ai-msg '+cls+'">'+renderAiMdSafe(txt)+'</div>';
    }
  }).join('');
  box.scrollTop = box.scrollHeight;
}

function sendAiChatMessage(){
  if(aiChatBusy) return;
  var input = document.getElementById('aiChatInput');
  var text = input.value.trim();
  if(!text) return;
  aiChatBusy = true;
  aiChatHistory.push({role:'user', parts:[{text:text}]});
  saveAiChat();
  renderAiChatMessages();
  input.value = '';
  var btn = document.getElementById('aiChatSendBtn');
  btn.disabled = true;
  var box = document.getElementById('aiChatMessages');
  var loadEl = document.createElement('div');
  loadEl.className = 'ai-msg-loading';
  loadEl.id = 'aiChatLoading';
  var grounding = needsGrounding(text);
  loadEl.textContent = grounding ? '🌐 internette arıyor...' : '🤖 yazıyor...';
  box.appendChild(loadEl);
  box.scrollTop = box.scrollHeight;

  callGeminiAPI(aiChatHistory, AI_CHAT_SYSTEM, false, grounding).then(function(reply){
    aiChatHistory.push({role:'model', parts:[{text:reply}]});
    saveAiChat();
  }).catch(function(err){
    aiChatHistory.pop();
    saveAiChat();
    showToast('❌ '+err.message);
  }).then(function(){
    aiChatBusy = false;
    btn.disabled = false;
    renderAiChatMessages();
    var inp = document.getElementById('aiChatInput');
    if(inp) inp.focus();
  });
}

function clearAiChat(){
  if(!aiChatHistory.length){ showToast('ℹ️ Sohbet zaten boş.'); return; }
  if(!confirm('Tüm sohbet geçmişi silinsin mi?')) return;
  aiChatHistory = [];
  saveAiChat();
  renderAiBody();
}

/* ══ FLASHCARD OLUŞTUR ══ */
function aiCreateHtml(){
  return '<div class="ai-fc-drop" id="aiFcDrop">'+
      '<div id="aiFcDropContent"></div>'+
      '<input type="file" id="aiFcFileInput" accept="image/*" style="display:none">'+
    '</div>'+
    '<div class="ai-fc-or">veya direkt soru yaz</div>'+
    '<div class="ai-fc-q-row">'+
      '<input type="text" id="aiFcQuestion" placeholder="Örn: Mitokondri ne işe yarar?">'+
    '</div>'+
    '<button class="ai-fc-gen-btn" id="aiFcGenBtn" onclick="generateAiFlashcards()">✨ Flashcard Oluştur</button>'+
    '<div id="aiFcPreviewArea"></div>';
}

function setupAiCreateTab(){
  renderAiFcDropContent();
  renderAiFcPreview();
  var drop = document.getElementById('aiFcDrop');
  var fileInput = document.getElementById('aiFcFileInput');
  if(!drop) return;
  drop.addEventListener('click', function(e){
    if(e.target.closest('.ai-fc-img-remove')) return; // kaldır butonuna basıldıysa dosya seçiciyi açma
    fileInput.click();
  });
  drop.addEventListener('dragover', function(e){ e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', function(){ drop.classList.remove('dragover'); });
  drop.addEventListener('drop', function(e){
    e.preventDefault();
    drop.classList.remove('dragover');
    if(e.dataTransfer.files && e.dataTransfer.files[0]) readAiImageFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', function(){
    if(fileInput.files && fileInput.files[0]) readAiImageFile(fileInput.files[0]);
  });
}

/* Yapıştırılan SS'i göster — varsa kaldırma butonuyla, yoksa yapıştırma talimatıyla */
function renderAiFcDropContent(){
  var content = document.getElementById('aiFcDropContent');
  if(!content) return;
  if(aiPastedImage){
    content.innerHTML = '<div class="ai-fc-img-preview">'+
        '<img src="data:'+aiPastedImage.mime+';base64,'+aiPastedImage.data+'" alt="ekran görüntüsü">'+
        '<span class="ai-fc-img-remove" title="SS\'i kaldır" onclick="removeAiPastedImage(event)">✕</span>'+
      '</div>'+
      '<div style="margin-top:8px;font-size:11px;">Başka bir SS yapıştırmak (Ctrl+V) veya seçmek için tıkla</div>';
  } else {
    content.innerHTML = '📋 Ekran görüntüsünü buraya yapıştır (Ctrl+V)<br><span style="font-size:11px">veya tıkla, dosya seç</span>';
  }
}

function removeAiPastedImage(e){
  if(e) e.stopPropagation();
  aiPastedImage = null;
  renderAiFcDropContent();
}

/* Ctrl+V ile ekran görüntüsü yapıştırma — panel açıkken ve "Flashcard Oluştur" sekmesindeyken */
function handleGlobalAiPaste(e){
  if(aiActiveTab!=='create') return;
  var overlay = document.getElementById('aiPanelOverlay');
  if(!overlay || !overlay.classList.contains('open')) return;
  var tag = (e.target && e.target.tagName) || '';
  if(tag==='INPUT' || tag==='TEXTAREA') return; // metin yapıştırmaya karışma
  var items = (e.clipboardData && e.clipboardData.items) || [];
  for(var i=0;i<items.length;i++){
    if(items[i].type.indexOf('image')!==-1){
      readAiImageFile(items[i].getAsFile());
      e.preventDefault();
      return;
    }
  }
}

function readAiImageFile(file){
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    var dataUrl = reader.result;
    var m = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/.exec(dataUrl);
    if(!m) return;
    aiPastedImage = { mime:m[1], data:m[2] };
    renderAiFcDropContent();
  };
  reader.readAsDataURL(file);
}

function generateAiFlashcards(){
  var qEl = document.getElementById('aiFcQuestion');
  var q = qEl ? qEl.value.trim() : '';
  if(!aiPastedImage && !q){ showToast('❌ Önce bir ekran görüntüsü yapıştır veya soru yaz.'); return; }

  var parts = [];
  var imgForCards = null;
  if(aiPastedImage){
    var promptText = AI_FC_PROMPT_IMAGE;
    if(q) promptText += '\n\nEk not / odaklanılacak konu: '+q;
    parts.push({text:promptText});
    parts.push({inline_data:{mime_type:aiPastedImage.mime, data:aiPastedImage.data}});
    imgForCards = { mime:aiPastedImage.mime, data:aiPastedImage.data }; // aynı SS, üretilen tüm kartlarda paylaşılır
  } else {
    parts.push({text: AI_FC_PROMPT_TEXT + q});
  }

  var btn = document.getElementById('aiFcGenBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Oluşturuluyor...';

  callGeminiAPI([{role:'user', parts:parts}], null, true).then(function(raw){
    var cards = parseAiFlashcardJson(raw);
    if(!cards.length){ showToast('❌ Kart üretilemedi, tekrar dene.'); return; }
    // Aynı SS'ten üretilen kartların hepsi aynı görseli paylaşır
    if(imgForCards){ cards.forEach(function(c){ c.img = imgForCards; }); }
    // AI'ın tahmin ettiği ders+konu'ya göre otomatik kategori ata (yoksa oluştur)
    cards.forEach(function(c){
      if(c.ders){
        c.kategoriId = aiGetOrCreateCategory(c.ders, c.konu||'');
      }
    });
    aiPreviewCards = (aiPreviewCards||[]).concat(cards);
    renderAiFcPreview();
  }).catch(function(err){
    showToast('❌ '+err.message);
  }).then(function(){
    btn.disabled = false;
    btn.textContent = '✨ Flashcard Oluştur';
  });
}

function parseAiFlashcardJson(raw){
  try{
    var cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(json)?/i,'').replace(/```$/,'').trim();
    var arr = JSON.parse(cleaned);
    if(!Array.isArray(arr)) arr = [arr];
    return arr.map(function(c){
      if(!c) return null;
      var tip = (c.tip==='bilgi') ? 'bilgi' : 'soru_cevap';
      var ders = typeof c.ders==='string' ? c.ders.trim() : '';
      var konu = typeof c.konu==='string' ? c.konu.trim() : '';
      if(tip==='bilgi'){
        var baslik = c.baslik || c.soru || '';
        var icerik = c.icerik || c.cevap || '';
        if(!baslik && !icerik) return null;
        return { tip:'bilgi', baslik:String(baslik), icerik:String(icerik), ders:ders, konu:konu };
      } else {
        if(!c.soru || !c.cevap) return null;
        return { tip:'soru_cevap', soru:String(c.soru), cevap:String(c.cevap), ders:ders, konu:konu };
      }
    }).filter(Boolean);
  }catch(e){ return []; }
}

function renderAiFcPreview(){
  var area = document.getElementById('aiFcPreviewArea');
  if(!area) return;
  if(!aiPreviewCards || !aiPreviewCards.length){ area.innerHTML=''; return; }
  area.innerHTML = aiPreviewCards.map(function(c,i){
    var isBilgi = c.tip==='bilgi';
    var imgTag = c.img ? ('<div class="ai-fc-preview-img-tag"><img src="data:'+c.img.mime+';base64,'+c.img.data+'" alt="ss"> SS bu karta bağlı</div>') : '';
    var typeRow = '<div class="ai-fc-preview-type">'+
        '<button class="ai-fc-preview-type-tag'+(!isBilgi?' active':'')+'" onclick="setAiPreviewType('+i+',\'soru_cevap\')">Soru-Cevap</button>'+
        '<button class="ai-fc-preview-type-tag'+(isBilgi?' bilgi active':'')+'" onclick="setAiPreviewType('+i+',\'bilgi\')">Bilgi Kartı</button>'+
      '</div>';
    // Kategori seçici
    var catHint = (c.ders||c.konu) ? '<div style="font-size:10px;color:var(--muted);margin-bottom:5px;">🤖 AI önerisi: <b>'+escapeHtml(c.ders||'')+'</b>'+(c.konu?' › <b>'+escapeHtml(c.konu)+'</b>':'')+'</div>' : '';
    var catRow = '<div class="ai-fc-preview-cat">'+
        catHint+
        '<label>Kategori</label>'+
        '<select data-i="'+i+'" onchange="updateAiPreviewCat(this)">'+
          '<option value="">(Kategori yok)</option>'+
          aiCatSelectOptions(c.kategoriId||'', false)+
        '</select>'+
      '</div>';
    var fieldsHtml;
    if(isBilgi){
      fieldsHtml = '<h5>Başlık</h5>'+
        '<textarea data-i="'+i+'" data-f="baslik" oninput="updateAiPreviewField(this)">'+escapeHtml(c.baslik||'')+'</textarea>'+
        '<h5>İçerik</h5>'+
        '<textarea data-i="'+i+'" data-f="icerik" oninput="updateAiPreviewField(this)">'+escapeHtml(c.icerik||'')+'</textarea>';
    } else {
      fieldsHtml = '<h5>Soru</h5>'+
        '<textarea data-i="'+i+'" data-f="soru" oninput="updateAiPreviewField(this)">'+escapeHtml(c.soru||'')+'</textarea>'+
        '<h5>Cevap</h5>'+
        '<textarea data-i="'+i+'" data-f="cevap" oninput="updateAiPreviewField(this)">'+escapeHtml(c.cevap||'')+'</textarea>';
    }
    return '<div class="ai-fc-preview">'+
      imgTag+
      typeRow+
      catRow+
      fieldsHtml+
      '<div class="ai-fc-preview-actions">'+
        '<button class="ai-fc-preview-del-btn" onclick="discardAiPreviewCard('+i+')">İptal</button>'+
        '<button class="ai-fc-preview-save-btn" onclick="saveAiPreviewCard('+i+')">✓ Kaydet</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function updateAiPreviewCat(el){
  var i = parseInt(el.getAttribute('data-i'),10);
  if(aiPreviewCards && aiPreviewCards[i]) aiPreviewCards[i].kategoriId = el.value || null;
}

/* Önizlemede kart tipini değiştir (Soru-Cevap <-> Bilgi Kartı) — mevcut metni karşı tarafa taşır */
function setAiPreviewType(i, tip){
  var c = aiPreviewCards && aiPreviewCards[i];
  if(!c || c.tip===tip) return;
  if(tip==='bilgi'){
    c.baslik = c.baslik || c.soru || '';
    c.icerik = c.icerik || c.cevap || '';
  } else {
    c.soru = c.soru || c.baslik || '';
    c.cevap = c.cevap || c.icerik || '';
  }
  c.tip = tip;
  renderAiFcPreview();
}

function updateAiPreviewField(el){
  var i = parseInt(el.getAttribute('data-i'),10);
  var f = el.getAttribute('data-f');
  if(aiPreviewCards && aiPreviewCards[i]) aiPreviewCards[i][f] = el.value;
}

function saveAiPreviewCard(i){
  var c = aiPreviewCards[i];
  if(!c) return;
  var card = { id:aiGenId('fc'), tip:c.tip, created:Date.now() };
  if(c.tip==='bilgi'){ card.baslik = c.baslik; card.icerik = c.icerik; }
  else { card.soru = c.soru; card.cevap = c.cevap; }
  if(c.img) card.img = { mime:c.img.mime, data:c.img.data };
  if(c.kategoriId) card.kategoriId = c.kategoriId;
  aiFlashcards.unshift(card);
  saveAiFlashcards();
  aiPreviewCards.splice(i,1);
  renderAiFcPreview();
  showToast('✅ Kart "Kartlarım"a eklendi!');
}

function discardAiPreviewCard(i){
  aiPreviewCards.splice(i,1);
  renderAiFcPreview();
}

/* ══ KARTLARIM ══ */
function aiDeckHtml(){
  return '<div id="aiDeckFilterBar" class="ai-deck-filter-bar"></div>'+
    '<div class="ai-deck-count" id="aiDeckCount"></div>'+
    '<div class="ai-deck-grid" id="aiDeckGrid"></div>';
}

function renderAiDeckFilterBar(){
  var bar = document.getElementById('aiDeckFilterBar');
  if(!bar) return;
  if(!aiCategories.length){ bar.innerHTML=''; return; }
  // "Tümü" butonu
  var allCount = aiFlashcards.length;
  var activeAll = !aiDeckFilter;
  var html = '<button class="ai-deck-filter-btn'+(activeAll?' active':'')+'" '+(activeAll?'style="background:var(--accent)"':'')+' onclick="setAiDeckFilter(null)">Tümü <span class="ai-dfb-count">'+allCount+'</span></button>';
  html += '<div class="ai-deck-filter-sep"></div>';
  var dersler = aiAllDersler();
  dersler.forEach(function(ders){
    var dColor = aiDersColor(ders);
    var dCount = aiDersTotalCount(ders);
    var isDersActive = aiDeckFilter && aiDeckFilter.ders===ders && !aiDeckFilter.konu;
    html += '<button class="ai-deck-filter-btn'+(isDersActive?' active':'')+'" style="'+(isDersActive?'background:'+dColor+';border-color:'+dColor:'')+'" onclick="setAiDeckFilter({ders:\''+ders.replace(/'/g,"\\'")+'\'})">'+
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+dColor+';margin-right:2px;flex-shrink:0;"></span>'+
        escapeHtml(ders)+' <span class="ai-dfb-count">'+dCount+'</span>'+
      '</button>';
    // Konu butonları (sadece bu ders seçiliyken göster)
    if(aiDeckFilter && aiDeckFilter.ders===ders){
      var konular = aiCategories.filter(function(c){ return c.ders===ders; });
      konular.forEach(function(cat){
        var kCount = aiCatCardCount(cat.id);
        if(!kCount) return;
        var isKonuActive = aiDeckFilter && aiDeckFilter.konu && aiDeckFilter.konu===cat.konu;
        html += '<button class="ai-deck-filter-btn'+(isKonuActive?' active':'')+'" style="'+(isKonuActive?'background:'+cat.color+';border-color:'+cat.color:'border-color:'+cat.color+';color:'+cat.color)+'" onclick="setAiDeckFilter({ders:\''+ders.replace(/'/g,"\\'")+'\',konu:\''+cat.konu.replace(/'/g,"\\'")+'\'})">'+
            '↳ '+escapeHtml(cat.konu||'Genel')+' <span class="ai-dfb-count">'+kCount+'</span>'+
          '</button>';
      });
    }
  });
  bar.innerHTML = html;
}

function setAiDeckFilter(f){
  aiDeckFilter = f;
  renderAiDeck();
}

function getFilteredDeck(){
  if(!aiDeckFilter) return aiFlashcards;
  return aiFlashcards.filter(function(c){
    if(!c.kategoriId) return false;
    var cat = aiCatById(c.kategoriId);
    if(!cat) return false;
    if(cat.ders!==aiDeckFilter.ders) return false;
    if(aiDeckFilter.konu && cat.konu!==aiDeckFilter.konu) return false;
    return true;
  });
}

function renderAiDeck(){
  renderAiDeckFilterBar();
  var grid = document.getElementById('aiDeckGrid');
  var count = document.getElementById('aiDeckCount');
  if(!grid) return;
  var deck = getFilteredDeck();
  count.textContent = deck.length + ' kart • karta tıkla, büyük görünümde incele';
  if(!deck.length){
    var msg = aiDeckFilter
      ? 'Bu kategoride kart yok.<br><span style="font-size:11px">Filtre seçimini değiştir veya yeni kart oluştur.</span>'
      : 'Henüz kart yok.<br>"📸 Flashcard Oluştur" sekmesinden ekran görüntüsü yapıştırarak veya soru yazarak kart üretebilirsin.';
    grid.innerHTML = '<div class="ai-deck-empty">'+msg+'</div>';
    return;
  }
  grid.innerHTML = deck.map(function(c, idx){
    var isBilgi = c.tip==='bilgi';
    var tagCls = isBilgi ? 'ai-fcard-tag bilgi-tag' : 'ai-fcard-tag';
    var frontLabel = isBilgi ? '💡 Bilgi' : 'Soru';
    var backLabel = isBilgi ? '📖 Detay' : 'Cevap';
    var frontText = isBilgi ? (c.baslik||'') : (c.soru||'');
    var backText = isBilgi ? (c.icerik||'') : (c.cevap||'');
    var imgBadge = c.img ? '<span class="ai-fcard-img-badge" title="Bu karta bağlı bir ekran görüntüsü var">🖼</span>' : '';
    // Kategori rozeti
    var catBadge = '';
    var globalIdx = aiFlashcards.indexOf(c);
    if(globalIdx<0) globalIdx = idx;
    if(c.kategoriId){
      var cat = aiCatById(c.kategoriId);
      if(cat){
        catBadge = '<div class="ai-fcard-cat-badge" style="background:'+cat.color+'22;color:'+cat.color+';border:1px solid '+cat.color+'44">'+
          escapeHtml(cat.ders)+(cat.konu?' › '+escapeHtml(cat.konu):'')+
        '</div>';
      }
    }
    return '<div class="ai-fcard-wrap">'+
      catBadge+
      '<div class="ai-fcard" onclick="openAiFcv('+globalIdx+')">'+
        '<div class="ai-fcard-inner">'+
          '<div class="ai-fcard-face ai-fcard-front"><div class="'+tagCls+'">'+frontLabel+imgBadge+'</div><div class="ai-fcard-text">'+escapeHtml(frontText)+'</div></div>'+
          '<div class="ai-fcard-face ai-fcard-back"><div class="'+tagCls+'">'+backLabel+'</div><div class="ai-fcard-text">'+escapeHtml(backText)+'</div></div>'+
        '</div>'+
      '</div>'+
      '<div class="ai-fcard-actions">'+
        '<span class="ai-fcard-hint">tıkla, büyüt</span>'+
        '<span title="Kategori değiştir" onclick="event.stopPropagation();openAiCardCatEdit(\''+c.id+'\')">🏷</span>'+
        '<span title="Sil" onclick="event.stopPropagation();deleteAiFlashcard(\''+c.id+'\')">🗑</span>'+
      '</div>'+
    '</div>';
  }).join('');
}

function deleteAiFlashcard(id){
  if(!confirm('Bu kart silinsin mi?')) return;
  aiFlashcards = aiFlashcards.filter(function(c){ return c.id!==id; });
  saveAiFlashcards();
  renderAiDeck();
  // Tam ekran görüntüleyici açıksa ve silinen kart oradaysa, görüntüleyiciyi güncelle
  if(aiFcvDeck){
    var newIdx = aiFcvDeck.findIndex(function(c){ return c.id===id; });
    aiFcvDeck = aiFcvDeck.filter(function(c){ return c.id!==id; });
    if(!aiFcvDeck.length){ closeAiFcv(); return; }
    if(aiFcvIndex >= aiFcvDeck.length) aiFcvIndex = aiFcvDeck.length-1;
    renderAiFcvCard();
  }
}

/* Kart için anlık kategori değiştirme (mini modal — sade toast tarzı) */
function openAiCardCatEdit(cardId){
  var c = aiFlashcards.find(function(x){ return x.id===cardId; });
  if(!c) return;
  // Daha önce açık olan varsa kaldır
  var prev = document.getElementById('aiCardCatEditPop');
  if(prev){ prev.remove(); if(prev.dataset.for===cardId) return; }
  var pop = document.createElement('div');
  pop.id = 'aiCardCatEditPop';
  pop.dataset.for = cardId;
  pop.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:16px 18px;z-index:2000;box-shadow:0 8px 40px rgba(0,0,0,0.5);min-width:280px;font-family:Syne,sans-serif;';
  pop.innerHTML = '<div style="font-size:11px;font-weight:800;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">🏷 Kart Kategorisi</div>'+
    '<select id="aiCardCatSel" style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:8px 10px;font-size:12px;font-family:Syne,sans-serif;color:var(--text);outline:none;cursor:pointer;margin-bottom:10px;">'+
      '<option value="">(Kategori yok)</option>'+
      aiCatSelectOptions(c.kategoriId||'', false)+
    '</select>'+
    '<div style="display:flex;gap:7px;justify-content:flex-end;">'+
      '<button onclick="document.getElementById(\'aiCardCatEditPop\').remove()" style="background:var(--surface2);border:1px solid var(--border2);color:var(--text2);border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:Syne,sans-serif;">İptal</button>'+
      '<button onclick="saveAiCardCatEdit(\''+cardId+'\')" style="background:var(--accent);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:Syne,sans-serif;">Kaydet</button>'+
    '</div>';
  document.body.appendChild(pop);
  // Dışarı tıklayınca kapat
  setTimeout(function(){
    document.addEventListener('click', function _closePop(e){
      if(!pop.contains(e.target)){ pop.remove(); document.removeEventListener('click',_closePop); }
    });
  }, 50);
}

function saveAiCardCatEdit(cardId){
  var sel = document.getElementById('aiCardCatSel');
  var catId = sel ? sel.value : '';
  var c = aiFlashcards.find(function(x){ return x.id===cardId; });
  if(c){ c.kategoriId = catId||null; saveAiFlashcards(); }
  var pop = document.getElementById('aiCardCatEditPop');
  if(pop) pop.remove();
  renderAiDeck();
  showToast('✅ Kategori güncellendi!');
}

/* ══ KATEGORİLER SEKMESİ ══ */
function aiCatsHtml(){
  return '<div class="ai-cats-wrap" id="aiCatsWrap">'+
    '<div class="ai-cats-top-bar">'+
      '<span class="ai-cats-top-bar-title">Ders & Konu Kategorileri</span>'+
      '<div style="display:flex;gap:6px;align-items:center;">'+
        '<input type="text" id="aiNewDersInput" placeholder="Yeni ders... (örn: Matematik)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;font-size:12px;font-family:Syne,sans-serif;color:var(--text);outline:none;">'+
        '<button class="ai-cats-add-btn" onclick="aiAddDers()">+ Ders</button>'+
      '</div>'+
    '</div>'+
    '<div id="aiCatsList"></div>'+
  '</div>';
}

function renderAiCats(){
  var list = document.getElementById('aiCatsList');
  if(!list) return;
  var dersler = aiAllDersler();
  if(!dersler.length){
    list.innerHTML = '<div class="ai-cats-empty">Henüz kategori yok.<br>Flashcard oluştururken AI otomatik ekler ya da buradan manuel ekleyebilirsin.</div>';
    return;
  }
  list.innerHTML = dersler.map(function(ders){
    var isOpen = !!aiCatsOpenDers[ders];
    var dColor = aiDersColor(ders);
    var dTotal = aiDersTotalCount(ders);
    var konular = aiCategories.filter(function(c){ return c.ders===ders; });
    var konularHtml = '';
    if(isOpen){
      konularHtml = '<div class="ai-cats-ders-body">'+
        konular.map(function(cat){
          var kCount = aiCatCardCount(cat.id);
          return '<div class="ai-cats-konu-row">'+
            '<div class="ai-cats-konu-dot" style="background:'+cat.color+'" onclick="aiToggleColorPicker(\''+cat.id+'\')"></div>'+
            '<div class="ai-cats-konu-name">'+escapeHtml(cat.konu||'(Genel)')+'</div>'+
            '<div class="ai-cats-konu-count">'+kCount+' kart</div>'+
            '<button class="ai-cats-konu-del-btn" title="Konuya filtrele" onclick="switchAiTab(\'deck\');setAiDeckFilter({ders:\''+ders.replace(/'/g,"\\'")+'\',konu:\''+cat.konu.replace(/'/g,"\\'")+'\'})">🔍</button>'+
            '<button class="ai-cats-konu-del-btn" title="Yeniden adlandır" onclick="aiRenameKonu(\''+cat.id+'\')">✏️</button>'+
            '<button class="ai-cats-konu-del-btn" title="Sil" onclick="aiDeleteKonu(\''+cat.id+'\')">🗑</button>'+
          '</div>'+
          '<div id="colorPicker_'+cat.id+'" style="display:none;flex-wrap:wrap;gap:5px;padding:6px 10px 8px 28px;">'+
            AI_CAT_COLORS.map(function(col){
              return '<div style="width:18px;height:18px;border-radius:50%;background:'+col+';cursor:pointer;border:2px solid '+(cat.color===col?'white':'transparent')+';transition:transform 0.15s;" onclick="aiSetKonuColor(\''+cat.id+'\',\''+col+'\')" onmouseover="this.style.transform=\'scale(1.25)\'" onmouseout="this.style.transform=\'scale(1)\'"></div>';
            }).join('')+
          '</div>';
        }).join('')+
        '<div class="ai-cats-add-row">'+
          '<input type="text" id="aiNewKonu_'+ders.replace(/[^a-z0-9]/gi,'_')+'" placeholder="Yeni konu (örn: Türevler)">'+
          '<button onclick="aiAddKonu(\''+ders.replace(/'/g,"\\'")+'\')">+ Konu</button>'+
        '</div>'+
      '</div>';
    }
    return '<div class="ai-cats-ders-block">'+
      '<div class="ai-cats-ders-header" onclick="aiToggleDers(\''+ders.replace(/'/g,"\\'")+'\')">'+
        '<div class="ai-cats-ders-dot" style="background:'+dColor+'"></div>'+
        '<div class="ai-cats-ders-name">'+escapeHtml(ders)+'</div>'+
        '<div class="ai-cats-ders-count">'+konular.length+' konu · '+dTotal+' kart</div>'+
        '<div style="display:flex;gap:3px;margin-left:auto;" onclick="event.stopPropagation()">'+
          '<button class="ai-cats-ders-del-btn" title="Filtrele" onclick="switchAiTab(\'deck\');setAiDeckFilter({ders:\''+ders.replace(/'/g,"\\'")+'\'})">🔍</button>'+
          '<button class="ai-cats-ders-del-btn" title="Yeniden adlandır" onclick="aiRenameDers(\''+ders.replace(/'/g,"\\'")+'\')" >✏️</button>'+
          '<button class="ai-cats-ders-del-btn" title="Sil" onclick="aiDeleteDers(\''+ders.replace(/'/g,"\\'")+'\')" >🗑</button>'+
        '</div>'+
        '<div class="ai-cats-ders-chevron '+(isOpen?'open':'')+'">▶</div>'+
      '</div>'+
      konularHtml+
    '</div>';
  }).join('');
}

function aiToggleDers(ders){ aiCatsOpenDers[ders]=!aiCatsOpenDers[ders]; renderAiCats(); }

/* Ders ekleme */
function aiAddDers(){
  var inp = document.getElementById('aiNewDersInput');
  var name = inp ? inp.value.trim() : '';
  if(!name){ showToast('❌ Ders adı boş olamaz.'); return; }
  if(aiCategories.find(function(c){ return c.ders.toLowerCase()===name.toLowerCase() && !c.konu; })){
    showToast('ℹ️ Bu ders zaten var.'); return;
  }
  aiGetOrCreateCategory(name, '');
  if(inp) inp.value = '';
  aiCatsOpenDers[name] = true;
  renderAiCats();
  showToast('✅ "'+name+'" ders olarak eklendi!');
}

/* Konu ekleme */
function aiAddKonu(ders){
  var safeId = ders.replace(/[^a-z0-9]/gi,'_');
  var inp = document.getElementById('aiNewKonu_'+safeId);
  var konu = inp ? inp.value.trim() : '';
  if(!konu){ showToast('❌ Konu adı boş olamaz.'); return; }
  if(aiCategories.find(function(c){ return c.ders===ders && c.konu.toLowerCase()===konu.toLowerCase(); })){
    showToast('ℹ️ Bu konu zaten var.'); return;
  }
  aiGetOrCreateCategory(ders, konu);
  if(inp) inp.value = '';
  renderAiCats();
  showToast('✅ "'+konu+'" konusu eklendi!');
}

/* Ders yeniden adlandırma */
function aiRenameDers(ders){
  var newName = prompt('Ders adını değiştir:', ders);
  if(!newName || !newName.trim() || newName.trim()===ders) return;
  newName = newName.trim();
  aiCategories.forEach(function(c){ if(c.ders===ders) c.ders=newName; });
  if(aiCatsOpenDers[ders]){ aiCatsOpenDers[newName]=true; delete aiCatsOpenDers[ders]; }
  saveAiCategories();
  renderAiCats();
  renderAiDeckFilterBar();
}

/* Konu yeniden adlandırma */
function aiRenameKonu(catId){
  var cat = aiCatById(catId);
  if(!cat) return;
  var newKonu = prompt('Konu adını değiştir:', cat.konu||'');
  if(newKonu===null) return;
  newKonu = newKonu.trim();
  // Çakışma kontrolü
  if(aiCategories.find(function(c){ return c.id!==catId && c.ders===cat.ders && c.konu.toLowerCase()===newKonu.toLowerCase(); })){
    showToast('ℹ️ Bu konu adı zaten var.'); return;
  }
  cat.konu = newKonu;
  saveAiCategories();
  renderAiCats();
}

/* Renk değiştirme */
function aiToggleColorPicker(catId){
  var el = document.getElementById('colorPicker_'+catId);
  if(el){ el.style.display = el.style.display==='none' ? 'flex' : 'none'; }
}

function aiSetKonuColor(catId, color){
  var cat = aiCatById(catId);
  if(cat){ cat.color = color; saveAiCategories(); }
  renderAiCats();
  renderAiDeck();
}

/* Konu silme */
function aiDeleteKonu(catId){
  var cat = aiCatById(catId);
  if(!cat) return;
  var kCount = aiCatCardCount(catId);
  var msg = kCount
    ? '"'+cat.konu+'" konusu silinecek. Bu konudaki '+kCount+' kart kategorisiz kalacak. Devam et?'
    : '"'+cat.konu+'" konusu silinsin mi?';
  if(!confirm(msg)) return;
  // Kategorisi silinen kartların kategoriId'sini temizle
  aiFlashcards.forEach(function(c){ if(c.kategoriId===catId) c.kategoriId=null; });
  saveAiFlashcards();
  aiCategories = aiCategories.filter(function(c){ return c.id!==catId; });
  saveAiCategories();
  renderAiCats();
  renderAiDeck();
}

/* Ders silme */
function aiDeleteDers(ders){
  var cats = aiCategories.filter(function(c){ return c.ders===ders; });
  var catIds = cats.map(function(c){ return c.id; });
  var total = aiFlashcards.filter(function(c){ return catIds.indexOf(c.kategoriId)!==-1; }).length;
  var msg = total
    ? '"'+ders+'" dersi ve tüm konuları silinecek. Bu dersteki '+total+' kart kategorisiz kalacak. Devam et?'
    : '"'+ders+'" dersi ve tüm konuları silinsin mi?';
  if(!confirm(msg)) return;
  aiFlashcards.forEach(function(c){ if(catIds.indexOf(c.kategoriId)!==-1) c.kategoriId=null; });
  saveAiFlashcards();
  aiCategories = aiCategories.filter(function(c){ return c.ders!==ders; });
  saveAiCategories();
  delete aiCatsOpenDers[ders];
  renderAiCats();
  renderAiDeck();
}

/* ══ TAM EKRAN FLASHCARD GÖRÜNTÜLEYİCİ ══ */
function openAiFcv(index){
  aiFcvDeck = aiFlashcards;
  aiFcvIndex = index;
  document.getElementById('aiFcvOverlay').classList.add('open');
  renderAiFcvCard();
  document.addEventListener('keydown', aiFcvKeyHandler);
}

function closeAiFcv(){
  document.getElementById('aiFcvOverlay').classList.remove('open');
  document.removeEventListener('keydown', aiFcvKeyHandler);
  aiFcvDeck = null;
  // SS tam ekran overlay'i açık kalmışsa kapat
  var imgOv = document.getElementById('aiFcvImgOverlay');
  if(imgOv) imgOv.remove();
}

function aiFcvKeyHandler(e){
  if(e.key==='Escape'){ closeAiFcv(); return; }
  if(e.key==='ArrowLeft'){ aiFcvNav(-1); return; }
  if(e.key==='ArrowRight'){ aiFcvNav(1); return; }
  if(e.key===' ' || e.key==='Enter'){
    var tag=(e.target&&e.target.tagName)||'';
    if(tag==='INPUT'||tag==='TEXTAREA') return;
    e.preventDefault();
    aiFcvFlip();
  }
}

function aiFcvNav(dir){
  if(!aiFcvDeck || !aiFcvDeck.length) return;
  var newIdx = aiFcvIndex + dir;
  if(newIdx<0 || newIdx>=aiFcvDeck.length) return;
  aiFcvIndex = newIdx;
  renderAiFcvCard();
}

function aiFcvFlip(e){
  if(e && e.target && e.target.closest('.ai-fcv-img-btn, .ai-fcv-img-overlay')) return;
  var card = document.getElementById('aiFcvCard');
  if(card) card.classList.toggle('flipped');
}

function renderAiFcvCard(){
  if(!aiFcvDeck || !aiFcvDeck.length) return;
  var c = aiFcvDeck[aiFcvIndex];
  var isBilgi = c.tip==='bilgi';
  var tagCls = isBilgi ? 'ai-fcv-tag bilgi-tag' : 'ai-fcv-tag';
  var frontLabel = isBilgi ? '💡 Bilgi' : '❓ Soru';
  var backLabel = isBilgi ? '📖 Detay' : '✅ Cevap';
  var frontText = isBilgi ? (c.baslik||'') : (c.soru||'');
  var backText = isBilgi ? (c.icerik||'') : (c.cevap||'');
  var imgBtn = c.img ? '<button class="ai-fcv-img-btn" onclick="event.stopPropagation();showAiFcvImage()">🖼 SS\'i Göster</button>' : '';

  // Kategori rozeti
  var catBadge = '';
  if(c.kategoriId){
    var cat = aiCatById(c.kategoriId);
    if(cat){
      catBadge = '<div class="ai-fcv-cat-badge" style="background:'+cat.color+'22;color:'+cat.color+';border:1px solid '+cat.color+'44">'+
        '📚 '+escapeHtml(cat.ders)+(cat.konu?' › '+escapeHtml(cat.konu):'')+
      '</div>';
    }
  }

  var card = document.getElementById('aiFcvCard');
  card.classList.remove('flipped');
  document.getElementById('aiFcvFront').innerHTML =
    '<div class="'+tagCls+'">'+frontLabel+'</div>'+
    catBadge+
    '<div class="ai-fcv-scroll-area"><div class="ai-fcv-text">'+escapeHtml(frontText)+'</div></div>'+
    (imgBtn ? imgBtn : '')+
    '<div class="ai-fcv-hint">karta tıkla / boşluk tuşu — çevir</div>';
  document.getElementById('aiFcvBack').innerHTML =
    '<div class="'+tagCls+'">'+backLabel+'</div>'+
    '<div class="ai-fcv-scroll-area"><div class="ai-fcv-text">'+escapeHtml(backText)+'</div></div>'+
    (imgBtn ? imgBtn : '')+
    '<div class="ai-fcv-hint">karta tıkla / boşluk tuşu — çevir</div>';

  document.getElementById('aiFcvCounter').textContent = (aiFcvIndex+1)+' / '+aiFcvDeck.length;
  document.getElementById('aiFcvPrev').disabled = (aiFcvIndex<=0);
  document.getElementById('aiFcvNext').disabled = (aiFcvIndex>=aiFcvDeck.length-1);

  // SS tam ekran overlay'i açık kalmışsa kapat (yeni karta geçildi)
  var imgOv = document.getElementById('aiFcvImgOverlay');
  if(imgOv) imgOv.remove();
}

/* Karta bağlı SS'i tam ekran kart üzerinde göster (tek tık) */
function showAiFcvImage(){
  if(!aiFcvDeck) return;
  var c = aiFcvDeck[aiFcvIndex];
  if(!c || !c.img) return;
  var existing = document.getElementById('aiFcvImgOverlay');
  if(existing){ existing.remove(); return; }
  var card = document.getElementById('aiFcvCardInner');
  var ov = document.createElement('div');
  ov.className = 'ai-fcv-img-overlay';
  ov.id = 'aiFcvImgOverlay';
  ov.innerHTML = '<span class="ai-fcv-img-overlay-close" title="Kapat" onclick="event.stopPropagation();this.parentElement.remove()">✕</span>'+
    '<img src="data:'+c.img.mime+';base64,'+c.img.data+'" alt="ekran görüntüsü">';
  ov.addEventListener('click', function(e){ e.stopPropagation(); });
  card.appendChild(ov);
}

/* ══════════ INIT ══════════ */
loadSaved();
_loadSearchCount();
_scheduleKotaReset();
loadHistory();
loadPlanner();
// Run midnight check immediately on load (in case page was open across midnight)
checkMidnightReset();
// Schedule precise midnight reset (fires exactly at 00:00 local time, not every 60s)
scheduleMidnightCheck();
// Music player init
initMusicPanel();
// AI Asistan & Flashcard init
loadAiChat();
loadAiFlashcards();
loadAiCategories();
document.addEventListener('paste', handleGlobalAiPaste);


# AnlatHoca (Anlat Hoca) — Akıllı ve Bütünleşik Ders Çalışma Platformu

AnlatHoca, bir öğrencinin ders çalışırken dikkatini dağıtacak hiçbir dış araca (YouTube sekmeleri, harici not defterleri, süreölçerler, ayrı AI araçları) ihtiyaç duymadan, **tek bir merkezden tüm öğrenme sürecini yönetebilmesi** felsefesiyle tasarlanmış bütünleşik bir ders çalışma ekosistemidir.

Bu belge, uygulamanın çekirdek mimarisini, veri modellerini, kullanıcı deneyimi felsefesini ve teknik akışlarını detaylandırır. **Gelecekte projeyi devralacak veya kod üzerinde geliştirme yapacak yapay zeka (AI) asistanlarının uygulamanın felsefesini ve bağlamını yitirmeden güvenli modifikasyonlar yapabilmesi için bir "Çekirdek Bellek (System Prompt / Context Anchor)" olarak hazırlanmıştır.**

---

## 🧭 1. Vizyon ve Felsefe: "Bütünleşik Odaklanma"

Geleneksel ders çalışma yöntemlerinde öğrenciler birden çok araç arasında mekik dokur: YouTube'dan konu anlatımı izler, fiziksel bir deftere veya Notion'a not alır, süresini telefon kronometresinden tutar, anlamadığı yeri sormak için OpenAI/Gemini sekmelerini açar ve ezber yapmak için Anki kullanır. Bu kontrolsüz geçişler (context switching) öğrencide odak kaybına ve bilişsel yorgunluğa yol açar.

**AnlatHoca'nın Çekirdek Felsefesi:**
*   **Sıfır Sürtünme:** Öğrenci video izlerken tek tıkla not alabilmeli, ekran görüntüsü yapıştırarak (Ctrl+V) saniyeler içinde otomatik flashcard üretebilmeli ve kronometresini durdurmadan AI ile sohbet edebilmelidir.
*   **Akıllı Yapılandırma:** Platformun temel taşı olan **Gelişmiş Video İzleme ve Playlist Sistemi**, sıradan bir video listesi değildir. Ders ve konulara göre kategorize edilebilen, sürükle-bırak destekli, "Playlist Dışı" (OOP) acil izleme mekanizması barındıran dinamik bir öğrenim yol haritasıdır.
*   **Aktif Hatırlama ve Uzun Süreli Bellek:** İzlenen ders videolarından anında üretilen flashcardlar (Bilgi ve Soru-Cevap kartları), öğrenciyi pasif izleyicilikten aktif uygulayıcılığa geçirir.

---

## 🛠 2. Uygulama Mimarisi ve Teknoloji Yığını

Uygulama, sunucu bağımlılığını en aza indiren, hızı ve gizliliği ön planda tutan modern bir **Client-Side (Sunucusuz / Yerel)** mimariye sahiptir.

*   **Veri Depolama:** Tüm kullanıcı verileri, tarayıcının `localStorage` API'si üzerinde şifresiz ve anlık olarak tutulur. Bu, internet kesintilerinde dahi verilerin korunmasını sağlar.
*   **Görsel ve Tema Yönetimi:** CSS değişkenleri (CSS Custom Properties) ile yönetilen dinamik Gece/Gündüz (`dark` / `light`) temaları.
*   **Yapay Zeka Motoru:** Google Gemini API (`gemini-2.5-flash`) entegrasyonu. API anahtarı doğrudan kullanıcının kendi tarayıcısında saklanır ve hiçbir üçüncü taraf sunucuya aktarılmaz.
*   **Panel Yönetimi (Central Panel Manager):** Arayüzde karmaşıklığı önlemek için geliştirilmiş tekil aktif panel modeli (`_openPanel` / `_closePanel`). Aynı anda sadece bir ana panel (Settings, Calendar, AI, Notes) açık kalabilir.

---

## 📦 3. Veri Modelleri ve Yerel Depolama (State & Storage Spec)

Geliştirici AI modellerinin veri tabanı şemasını ve state yapısını bozmaması için kullanılan `localStorage` anahtarları ve JSON şemaları aşağıda tanımlanmıştır:

### 🔑 LocalStorage Anahtar Eşleşmeleri
| Anahtar İsmi | İçerik / Görev | Veri Tipi |
| :--- | :--- | :--- |
| `aha_v4_data` | Ana uygulama verileri (Playlistler, OOP, Kronometre, Tema vb.) | `JSON Object` |
| `aha_v4_archive` | **BİRLEŞİK GÜNLÜK ARŞİV** — geçmiş (izleme) + planlayıcı için özet+detay, gün/ay geçtikçe buraya taşınır (bkz. 4-D) | `JSON Object` |
| `aha_v4_history` | Eski (30 gün sınırlı) geçmiş sistemi — artık SADECE `aha_v4_archive`'a tek seferlik göç kaynağı, aktif olarak yazılmıyor | `JSON Object` |
| `aha_v4_planner` | Planlayıcı/takvim verileri — **SADECE bu ay + gelecek ay** (geçmiş aylar arşive taşınmış olur, bkz. 4-D) | `JSON Object` |
| `aha_v4_lastdate` / `aha_v4_lastmonth` | Gece yarısı / ay geçişi tespiti için son bilinen tarih/ay | `String` |
| `aha_archive_migrated_v1` | Eski geçmişin arşive göçünün bir kez yapıldığını işaretler (idempotency flag) | `String ("1")` |
| `aha_last_auto_backup_v1` | Sessiz otomatik Drive yedeklemesinin son çalıştığı zaman damgası | `String (timestamp)` |
| `aha_ai_key_v1` | Kullanıcının Gemini API Anahtarı | `String` (Şifreli gösterim destekli) |
| `aha_ai_chat_v1` | AI Asistan sohbet geçmişi — çok büyürse en eski kısmı Drive'a arşivlenebilir (bkz. 4-F) | `JSON Array` |
| `aha_flashcards_v1` | Kullanıcının ürettiği tüm Flashcardlar | `JSON Array` |
| `aha_flashcards_cats_v1` | Flashcard Ders ve Konu kategorileri | `JSON Array` |
| `aha_deneme_v1` | Deneme (practice exam) kayıtları — **kümülatif ve kalıcı**, gece yarısı resetlenmez, Drive'a yedeklenir | `JSON Array` |
| `aha_deneme_cats_v1` | Deneme kategorileri (Altın Karma, Özdebir vb.) | `JSON Array` |
| `aha_deneme_mode_v1` | Aktif mod — `"playlist"` veya `"deneme"` | `String` |
| `aha_water_enabled_v1` | Su takibi widget'ı üst barda görünüyor mu — anahtar HİÇ YOKSA (ilk kurulum) varsayılan **kapalı** | `String ("0"\|"1")` |
| `aha_water_v1` | Su takibi: **İZ BIRAKMAYAN GÜNLÜK VERİ** — `{date, goalMl, unitMl, logs[]}`. `date` bugünle eşleşmiyorsa `logs` her yüklemede otomatik sıfırlanır (hiçbir yerde arşivlenmez); sadece `goalMl`/`unitMl` tercih olarak kalıcıdır (bkz. 4-H) | `JSON Object` |
| `aha_note_symbol_shortcuts_v1` | Notlar: orta-tık ile atanmış `{comboKey: symbol}` eşleşmeleri (`comboKey` `e.code` tabanlı, örn. `"Ctrl+Digit1"`) — bkz. 4-J | `JSON Object` |
| `aha_v4_todos` | **Planlayıcı — Günlük Çalışma Planı (to-do list):** SADECE canlı, düzenlenebilir **30 günlük pencere** (bugün + sonraki 29 gün). Gün bitince o günün verisi otomatik olarak `aha_v4_archive`'a taşınıp buradan silinir (bkz. 4-K) | `JSON Object` |
| `aha_todo_viewmode_v1` | To-do list'te son seçili görünüm tercihi | `String ("list"\|"table")` |
| `aha_cal_fullscreen_v1` | Takvim/Planlayıcı panelinin tam ekran tercihi (AI panelinin `aha_ai_fullscreen_v1`'iyle AYNI desen) | `String ("0"\|"1")` |

---

### 📑 Veri Yapıları (Schemas)

#### 1. Ana Uygulama Nesnesi (`aha_v4_data`)
```json
{
  "playlists": [
    {
      "id": "pl_xyz123",
      "name": "YKS Matematik - Limit",
      "color": "#3b82f6",
      "items": [
        {
          "id": "dQw4w9WgXcQ",
          "title": "Limit ve Süreklilik Bölüm 1",
          "watched": true,
          "categoryId": "cat_mat_limit",
          "attachments": []
        }
      ],
      "categories": [
        {"id": "cat_mat_limit", "name": "Limit", "color": "#3b82f6", "hidden": false}
      ],
      "notes": {
        "dQw4w9WgXcQ": "Burada limitin grafiksel tanımı çok önemli..."
      },
      "collapsedCats": {
        "cat_mat_limit": false
      },
      "catOrder": ["cat_mat_limit"]
    }
  ],
  "activePlaylistId": "pl_xyz123",
  "currentVideoId": "dQw4w9WgXcQ",
  "currentInPlaylist": true,
  "currentPlaylistId": "pl_xyz123",
  "oopItems": {
    "pl_xyz123": null
  },
  "currentSpeed": 1.25,
  "theme": "dark",
  "autoPlayEnabled": true,
  "sw": {
    "accum": 15400000,
    "laps": []
  }
}
```

#### 2. Flashcard Nesnesi (`aha_flashcards_v1`)
Flashcardlar iki tipe ayrılır: `soru_cevap` (aktif hatırlama için) ve `bilgi` (saf bilgi kartları).
```json
[
  {
    "id": "fc_1719284305_412",
    "tip": "soru_cevap",
    "soru": "Mitokondrinin görevi nedir?",
    "cevap": "Hücre için gerekli olan ATP'yi (enerjiyi) üretir.",
    "kategoriId": "cat_1719284200_12",
    "created": 1719284305000,
    "img": {
      "mime": "image/png",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    }
  },
  {
    "id": "fc_1719284390_992",
    "tip": "bilgi",
    "baslik": "Planck Sabiti",
    "icerik": "Kuantum mekaniğinde aksiyon kuantumu olarak kullanılan fiziksel bir sabittir. Yaklaşık değeri h = 6.626 x 10^-34 J·s.",
    "kategoriId": "cat_1719284210_55",
    "created": 1719284390000
  }
]
```

#### 3. Flashcard Kategorisi (`aha_flashcards_cats_v1`)
Ders ve Konu bazlı deterministik renk atamalı kategori yapısı:
```json
[
  {
    "id": "cat_1719284200_12",
    "ders": "Biyoloji",
    "konu": "Hücre Organelleri",
    "color": "#2ecc71"
  }
]
```

#### 4. Deneme Nesnesi (`aha_deneme_v1`)
Her deneme (TYT/AYT/Branş) tek bir kayıt olarak tutulur. `result` alanı sınav bitirilene kadar `null`'dır; sonuç girildiğinde doldurulur ve `completed:true` olur. **Bu kayıtlar flashcardlar gibi kalıcıdır — Midnight Reset tarafından ASLA silinmez/arşivlenmez** (bkz. Altın Kural #6).

`pdf.data` iki farklı şekilde olabilir: küçük bir dosya için doğrudan `"data:application/pdf;base64,..."`, büyük bir dosya Drive'a taşınmışsa ise bir **pointer nesnesi** (`{"__ahaAsset":true,"driveId":"...",...}` — bkz. 4-F). Bu alanı KULLANMADAN önce her zaman `ahaResolveAssetData(exam.pdf)` ile çözülmelidir; `exam.pdf.data`'yı asla doğrudan `iframe.src`/`window.open`'a verme.
```json
[
  {
    "id": "dnmex_1719284305_a1b2c3",
    "catId": "dnmcat_1719284200_x9y8z7",
    "isim": "Altın Karma Deneme 5",
    "tur": "tyt",
    "alan": null,
    "ders": null,
    "bransTotal": null,
    "timerMin": 165,
    "pdf": { "name": "deneme5.pdf", "data": "data:application/pdf;base64,..." },
    "createdAt": 1719284305000,
    "plannedDate": "2026-08-03",
    "completed": true,
    "completedAt": 1719290000000,
    "result": {
      "tur": "tyt",
      "alan": null,
      "ders": null,
      "subjects": [
        {"key": "turkce", "label": "Türkçe", "total": 40, "dogru": 35, "yanlis": 3, "bos": 2, "net": 34.25}
      ],
      "totalNet": 93.0,
      "totalDogru": 88,
      "totalYanlis": 15,
      "totalBos": 17,
      "elapsedMs": 9840000
    }
  }
]
```
*   `tur`: `"tyt"` | `"ayt"` | `"brans"`. `alan` sadece `tur:"ayt"` iken dolu (`"sayisal"`|`"sozel"`|`"esit"`); `ders`/`bransTotal` sadece `tur:"brans"` iken dolu.
*   `result.subjects[].bos` **her zaman** `total - (dogru + yanlis)` formülünden türetilir, kullanıcı elle girmez (bkz. Altın Kural #8).

#### 5. Deneme Kategorisi (`aha_deneme_cats_v1`)
Playlist Yöneticisi'ndeki kategori yapısıyla birebir aynı mantık (`PALETTE` dizisinden sıralı renk atama + `showColorPicker` ile değiştirme):
```json
[
  { "id": "dnmcat_1719284200_x9y8z7", "name": "Altın Karma", "color": "#3b82f6", "createdAt": 1719284200000 }
]
```

#### 6. Günlük Çalışma Planı / To-Do List Nesnesi (`aha_v4_todos`)
Anahtarı `'YYYY-MM-DD'` olan bir sözlük; SADECE bugün + sonraki 29 gün için kayıt içerir (bkz. 4-K):
```json
{
  "2026-08-10": {
    "items": [
      {
        "id": "todo_lz3k2j_48213",
        "kind": "study",
        "title": "Türev konusu tekrar",
        "subject": "Matematik",
        "minutes": 45,
        "time": "09:00",
        "done": false,
        "doneAt": null,
        "createdAt": 1754812345000,
        "order": 0,
        "source": "manual"
      }
    ]
  }
}
```
*   `kind`: `"study"` (ders çalışma/soru çözme) \| `"video"` (video izleme görevi) \| `"deneme"` (deneme/prova sınavı) \| `"custom"` (genel görev) — bkz. `TODO_KIND_META`.
*   `minutes`: doluysa listede o öğeye tıklamak özel geri sayım zamanlayıcısını açar (bkz. 4-K).
*   `source`: `"manual"` (kullanıcı elle ekledi) \| `"ai"` (Plan Tanıma ile otomatik eklendi, bkz. 4-L) — sadece kayıt kökenini izler, davranışta fark yaratmaz.

---

## 🚀 4. Çekirdek Sistemler ve Çalışma Mantığı

### 📺 A. Gelişmiş Video & Playlist Sistemi
Bu sistem uygulamanın **ilk inşa edilen, en kararlı ve en temel yapısıdır.** Video izleme odağını kaybetmeden öğrenme akışını düzenler.

1.  **Playlist Gruplama ve Kategorizasyon:** Playlist içindeki her video bir kategoriye ait olabilir. Kategoriler başlıklarına göre gruplanır, katlanabilir (`collapsedCats`) ve sürüklenerek sıralaması değiştirilebilir (`catOrder`).
2.  **Sürükle-Bırak (Drag & Drop) Dinamikleri:**
    *   Bir video sürüklenip başka bir videonun üzerine bırakıldığında, hem hedef videonun sırasını alır hem de hedef videonun kategorisini otomatik olarak miras alır.
    *   Bir video sürüklenip kategori başlığına (`.pl-cat-header`) bırakıldığında doğrudan o kategoriye taşınır.
3.  **Playlist Dışı Video (OOP - Out Of Playlist Items):** Öğrenci o anki aktif playlist akışını bozmak istemiyor ancak acilen harici tek bir konu/soru çözüm videosu izlemek istiyorsa bu özellik devreye girer. OOP video, listenin en altında özel bir rozetle (`oop-item`) belirir ve izlendikten sonra tek tıkla mevcut playlist'e eklenebilir.
4.  **Otomatik Oynatma & İzleme Durumu:** `autoPlayEnabled` aktifse video bittiğinde sıradaki videoya otomatik geçer ve izlenen videoyu `watched: true` yapar.

---

### 🧠 B. AI Asistanı & Görselden Flashcard Üretim Akışı
Uygulamanın yapay zeka beyni Google Gemini API ile doğrudan konuşur.

```
[Kullanıcı Ekran Görüntüsü Yapıştırır (Ctrl+V)]
                   │
                   ▼
       [aiPastedImage Base64 Okuma]
                   │
                   ▼
    [Gemini API - Structured JSON Prompt]
                   │
                   ▼
 [Otomatik "Ders" ve "Konu" Analizi & JSON Yanıt]
                   │
                   ▼
     [Önizleme Kartlarının Oluşturulması]
                   │
                   ▼
  [Kullanıcı Onayı / Kategori ve Tip Düzenleme]
                   │
                   ▼
   [Flashcards Listesine (Storage) Kayıt]
```

1.  **Ekran Görüntüsü Yakalama (Ctrl+V):** `handleGlobalAiPaste` ile tarayıcı seviyesinde dinlenen pano olayları, eğer kullanıcı AI panelinde ve "Flashcard Oluştur" sekmesindeyse görüntüyü yakalayıp base64 formatında hafızaya alır.
2.  **Akıllı Prompt Mühendisliği:** Gemini'ye gönderilen `AI_FC_PROMPT_IMAGE` promptu, görsele ait dersi (örn: "Fizik") ve konuyu (örn: "Optik") tahmin etmesini ister. Çıktı formatı kesin sınırlarla belirlenmiş bir JSON dizisidir.
3.  **Arama Grounding (Google Search Entegrasyonu):** Kullanıcının sorduğu soruda güncel veya zamana duyarlı kavramlar (`needsGrounding()` fonksiyonu tarafından tetiklenen kelimeler: "2025", "güncel", "son dakika", "dolar" vb.) tespit edilirse, `gemini-2.5-flash` modeli arama araçları ile donatılır (`googleSearch: {}`). Yanıta otomatik olarak `🌐 Kaynaklar` listesi eklenir.
4.  **Markdown Parsing:** Gelen AI cevapları `renderAiMdSafe` tarafından parse edilir. Geliştirici AI, standart markdown parser'lar yerine bu özel fonksiyonun ürettiği CSS sınıflarını (`ai-hl-yellow`, `ai-hl-blue`, `ai-hl-green`, `ai-hl-red`, `ai-code`) kullanmalıdır. Bu sınıflar, öğrencilerin okuma kolaylığı için fosforlu kalem (highlight) efektleri sağlar.

---

### 🎨 C. Ders & Konu Yönetimi (Kategoriler)
*   **Deterministik Renk Ataması:** Eğer bir derse özel bir renk atanmamışsa, ders adının karakter kodlarından üretilen deterministik bir hash yöntemiyle (`aiDersColor`) renk paletinden (`AI_CAT_COLORS`) kalıcı ve benzersiz bir renk atanır. Bu sayede görsel bütünlük korunur.
*   **Renk Seçici (Color Picker):** Kullanıcı dilediği konunun rengini palet üzerinden değiştirebilir. Değişiklik yapıldığı an tüm kartlardaki ilgili kategori rozetleri ve grafikler anında güncellenir.

---

### ⏱ D. Kronometre, Midnight Reset ve Birleşik Günlük Arşiv
*   **Süreklilik:** Kronometre sayımı devam ederken sayfa yenilense dahi `swStartTime` ve `swAccum` verileri sayesinde zaman kaybı yaşanmaz.
*   **Midnight Reset:** Gece saat `00:00` olduğunda gün değişimi algılanır (`checkMidnightReset()`, her sayfa yüklemesinde ve düzenli aralıklarla çağrılır). Öğrencinin bir önceki güne ait playlist çalışma durumu **Birleşik Günlük Arşiv**'e (`aha_v4_archive`) yazılıp gizlenir, yeni gün temiz bir sayfa ile karşılanır. Bu, psikolojik olarak öğrenciye her gün yeni bir başlangıç sunma felsefesinin ürünüdür. **Geliştirici test aracı:** `Ctrl+A+S` kısayolu (`core.js`) gerçek günlerin geçmesini beklemeden art arda "sahte gece yarısı" simüle eder — `checkMidnightReset()` ile **birebir aynı** arşivleme kodunu çalıştırır, yeni bir gün türü eklerken/test ederken bunu kullan.
    *   **(2026-09) Ayarlanabilir hale getirildi + deneme kategorilerine genişletildi:** `stopDailyHideEnabled` (`aha_stop_daily_hide_v1`, Ayarlar > "Günlük Playlist & Deneme Gizlemesini Durdur") açıksa `pl.hidden=true` adımı VE deneme kategorilerinin otomatik gizlenmesi (`denemeApplyDailyCatHide()`, bkz. 4-E) TAMAMEN atlanır — izlenme durumu/notlar sıfırlaması yine her zaman çalışır, SADECE görünürlük adımı koşulludur. `"todolist"` (`TODO_AUTO_PLAYLIST_NAME`, bkz. 4-K) playlist'inin silinmesi bu ayardan BAĞIMSIZDIR, her zaman çalışır — o bir görünürlük tercihi değil, kalıcı-olmama tasarımı.

*   **Birleşik Günlük Arşiv (`aha_v4_archive`) — NEDEN VAR:** Eskiden "geçmiş" (izleme durumu) sadece **son 30 günü** tutup ötesini **kalıcı olarak siliyordu**; "planlayıcı" ise hiç sınırlanmadan sonsuza dek büyüyordu (bir yıl sonra binlerce eski gün kaydı taşıyabilirdi). Artık bir gün geçmişe düştüğünde (veya bir ay tamamlandığında — aşağıya bak) verisi TEK bir arşive taşınır:
    *   **Özet (`summary`)** — küçük, sabit boyutlu sayılar (toplam çalışma süresi, izlenen video sayısı, planlanan/tamamlanan öğe sayısı). **Sonsuza dek saklanır, asla silinmez/budanmaz.** Grafik (`renderStatsTab`) ve liste (`renderHistoryTab`) gibi varsayılan görünümler SADECE bunu okur — sürekli yeniden hesaplama yapılmaz, tek seferlik arşivleme anında hesaplanıp önbelleklenmiştir.
    *   **Detay (`detail`)** — tam video/playlist dökümü (geri yükleme için gereken her şey). Depolamayı şişirmemek için **`ARCHIVE_WATCH_DETAIL_DAYS` (60) günden eski** günlerde `null`'a çevrilir (özet kalır, detay gider). Kullanıcı bir günü **açıkça genişlettiğinde** (`toggleHistDay`) ya da geri yüklemek istediğinde (`restoreFromHistory`) okunur — hiçbir zaman toplu/önceden inşa edilmez (bkz. performans notu aşağıda).
    *   **Şema:** `archiveData[dateStr] = { date, watch: {summary:{swMs,videosWatched,videosTotal}, detail:{playlists:[...]}|null}, planner: {summary:{plannedCount}, detail:{playlists,extraVideos}|null} }`

*   **Performans — Lazy Rendering:** `renderHistoryTab` eskiden **her** geçmiş günü için (gizli olsa bile) tam video dökümünü DOM'a basıyordu — sekme her açıldığında TÜM arşiv yeniden hesaplanıyordu. Artık sadece özet satırı (tarih + toplam süre) inşa edilir; `hist-day-body`'nin ağır içeriği `data-loaded` bayrağıyla **SADECE o gün ilk kez genişletildiğinde** inşa edilip DOM'a yazılır.

*   **Planlayıcı — AY bazlı arşivleme (GÜN bazlı DEĞİL):** Takvim UI'ı (`renderPlannerTab`) sadece **"bu ay + gelecek ay"**nı gösterir; bu ayki geçmiş bir gün bile hâlâ tıklanabilir/düzenlenebilir durumdadır (`renderPlannerDayDetail`). Bu yüzden planlayıcı verisi gün geçtiğinde DEĞİL, **ay tamamen geride kaldığında** (`checkMonthRolloverForPlanner`, `lastCheckedMonth` ile takip edilir) arşive taşınıp canlı `plannerData`'dan silinir — asla bu ayın içindeyken dokunulmaz, yoksa "bu ayki geçmiş günü düzelt" özelliği kırılır. **Bunu geçmiş (watch) verisiyle aynı gün-bazlı tetikleyiciye bağlama.**

*   **Deneme (istatistik) — arşive HİÇ taşınmaz/kopyalanmaz:** Altın Kural #6 gereği `denemeExams` tek doğruluk kaynağı olarak kalır. Bir günün deneme özeti gerektiğinde (`archiveDenemeSummaryForDate(dateStr)`) doğrudan `denemeExams`'tan **anlık hesaplanır**, hiçbir yere yazılmaz/önbelleklenmez — böylece bir sınav sonradan düzenlense/silinse bile özet asla bayatlamaz.

*   **Göç (Migration):** Güncelleme öncesi var olan kullanıcıların eski 30 günlük `aha_v4_history` verisi, ilk yüklemede **otomatik ve tek seferlik** olarak yeni arşive taşınır (`loadArchive()`, `aha_archive_migrated_v1` flag'i ile idempotent) — kimse geçmişini kaybetmez.

---

### 📝 E. Deneme Modu (Practice Exam Tracking Sistemi)
`js/deneme.js` içinde yaşayan, **tamamen izole ve kendi kendini enjekte eden** bir modüldür. Diğer hiçbir dosyaya (index.html/core.js/styles.css) elle dokunulmadan, tek bir `<script src="js/deneme.js"></script>` satırıyla (`features.js`'den SONRA, `ai.js`'den ÖNCE) bağlanır. Kendi CSS'ini (`<style id="dnmStyles">`), kendi modallarını (PDF seçim/bitirme onayı/skor girişi) ve iki ayrı toggle arayüzünü runtime'da `document.body`/`document.head`'e ekler.

1.  **Çift Konum (Dual Mount) Mimarisi:** "Playlist Modu / Deneme Modu" geçiş anahtarı **iki farklı yerde** görünür ve ikisi de **aynı global `calMode` state'ini** okur/yazar:
    *   Takvim Paneli'nde (`.cal-panel-header` altı)
    *   Ana ekran sidebar'ında, kronometre panelinin altı / `.playlist-panel`'in hemen üstü (Deneme Modu'na geçilince `.playlist-panel` gizlenir, yerine Deneme Yöneticisi render edilir)

    Bu iki konumdan **herhangi biri** değiştirildiğinde (`denemeSetMode('deneme'|'playlist')`), `denemeApplyModeLabels()` her ikisini de senkron günceller. Kategori/sınav CRUD fonksiyonlarının hepsi bir **`scope`** parametresi alır (`'Cal'` veya `'Side'`) ve tüm ürettikleri DOM id'lerini bu scope ile damgalar (`_dnmSid(base,scope)` ve elle birleştirilen `'...'+scope+'-'+id` kalıpları) — böylece aynı veri iki farklı DOM noktasında ID çakışması olmadan render edilebilir. **Yeni bir CRUD fonksiyonu eklerken scope parametresini atlamak, aynı id'nin iki kez üretilmesine ve `getElementById`'in yanlış/hiçbir elemanı bulamamasına yol açar.**

2.  **Sınav Türleri ve 2027 YKS Müfredatı:** `TYT_SUBJECTS`, `AYT_PROFILES` (`sayisal`/`sozel`/`esit`), `BRANS_DERSLER`+`BRANS_DEFAULT_Q` sabitleri sınav türüne göre skor ekranındaki ders satırlarını (`denemeGetProfile(exam)`) belirler. Net formülü: `Net = Doğru - (Yanlış × 0.25)` (`denemeNet()`).

3.  **Skor Girişi — Boş Otomatik Hesaplama:** Skor modalında (`denemeOpenScoreModal`) **Boş alanı salt-okunurdur**, kullanıcı hiçbir zaman elle girmez. Doğru veya Yanlış her değiştiğinde `oninput="denemeUpdateScoreNet(...)"` tetiklenir ve `Boş = Toplam - (Doğru + Yanlış)` formülüyle kendini günceller (aşım durumunda — Doğru+Yanlış toplam soruyu geçerse — Boş 0'da sabitlenir ve satırda uyarı gösterilir). `denemeSaveScore()` de Boş'u DOM'dan okumaz, aynı formülle bağımsız türetir.

4.  **PDF İş Akışı (`#playerWrap` Dönüşümü):** `denemeLaunchExam(examId)` çağrıldığında: PDF eklenmişse kullanıcıya üç seçenek sunulur — "Önizleme Olarak Aç" (iframe `#playerWrap` içine `denemeMountPlayerWrap('embedded',...)` ile monte edilir, küçük yuvarlak ✕ "Bitir" butonu topbar'ın DIŞINDA bağımsız konumlu — bkz. madde 5.5 altında BUG FIX), "Normal PDF Olarak Aç" (yeni sekmede `window.open`) veya "Bir Uygulamayla Aç" (native `navigator.share`, desteklenmiyorsa indirme). PDF **yoksa AMA süre (`timerMin`) varsa** `denemeMountPlayerWrap('timeronly',exam,null)` ile PDF akışıyla BİREBİR AYNI desende bir "zamanlayıcı çalışıyor" ekranı monte edilir — skor modalı ne PDF ne süre olmadığında (`else` dalı) hâlâ doğrudan açılır. `denemeMountPlayerWrap` önce mevcut videoyu `destroyPlayer()` ile temizler.
    *   **(2026-09) BUG FIX — süre yok sayılıyordu:** Eskiden PDF'siz+süreli bir sınav başlatılınca zamanlayıcı arka planda `denemeStartTimer` ile başlasa bile skor modalı **HEMEN** açılıyordu (süre tamamen anlamsızlaşıyordu). Artık `'timeronly'` modu sayesinde kullanıcı "🏁 Denemeyi Bitir"e basana (istediği an, süre dolmuş olsun ya da olmasın — PDF akışıyla TUTARLI) kadar skor ekranı hiç açılmıyor.
    *   **Drive entegrasyonu:** Büyük PDF'ler artık (Notlar'daki sistemle aynı altyapıyla) otomatik Google Drive'a taşınabilir — bkz. 4-F madde 7. `exam.pdf.data` bu yüzden bir pointer OLABİLİR; üç açma yolunun **ortak giriş noktası** `_dnmResolveExamPdf(exam, onReady)`'dir — bu, `exam.pdf`'i `ahaResolveAssetData()` ile çözüp SADECE `onReady` callback'ine bir yerel data-URI geçirir, **`exam.pdf.data`'yı asla çözülmüş haliyle geri yazmaz** (aksi halde küçük pointer tekrar dev bir string'e döner ve her kayıtta gereksiz yeniden yükleme tetiklenir — bkz. Altın Kural, aşağıda).
    *   **(2026-09) BUG FIX — yanlış "PDF çok büyük" uyarısı:** `denemeHandlePdfFile()`'daki 4MB üzeri uyarı eskiden Google girişi olsun ya da olmasın HER ZAMAN gösteriliyordu; giriş varsa Drive offload zaten sessizce hallettiği için gereksiz/yanıltıcıydı. Artık SADECE `!_ytAccessToken` (giriş YOK) durumunda gösteriliyor.

5.  **Zamanlayıcı (Countdown) — Pomodoro Motorunun Aynısı:** Sınav oluşturulurken opsiyonel `timerMin` girildiyse, `denemeLaunchExam` anında (PDF olsun olmasın, arka planda) `denemeStartTimer()` çalışır. Bu, `swToggle`/`swReset` fonksiyonlarını (index.html'in `openAiPanel`'i sarmaladığı yöntemle AYNI şekilde) sarmalayıp `.stopwatch-panel`/`#swDisplay`/`#pomodoroInfoBar` elemanlarını ele geçirir; normal kronometre ile Pomodoro'yu karşılıklı olarak duraklatır/gizler. `denemeTimerReset()` kalan süreyi elapsed-time hesabına DEĞİL, doğrudan `denemeTimerTotalMs`'e yazar (saniye sınırında ±1sn kayması engellemek için — bkz. Altın Kural #7).

6.  **Veri Kalıcılığı:** Sınav kayıtları flashcardlar gibi **kümülatiftir** — bkz. Altın Kural #6. `denemeSaveExams()` artık `ahaSafeSetItem` ile Drive-offload zincirine bağlıdır (bkz. 4-F madde 7); eski "PDF'i sil" davranışı sadece Drive'a da taşınamazsa (giriş yapılmamışsa) devreye giren bir son çare oldu.

7.  **(2026-09) Kategori Gizleme — Playlist Kategorileriyle AYNI Desen:** `cat.hidden` (`denemeCats` şemasına eklendi) — manuel toggle `denemeToggleCatHidden(catId,scope)` (👁/👁‍🗨 buton, `mgrToggleCatHidden`/features.js ile BİREBİR AYNI görsel desen: `opacity:0.45` + üstü çizili isim). Ayrıca `checkMidnightReset()` her gece `denemeApplyDailyCatHide()` ile TÜM kategorileri otomatik gizler — playlistlerle AYNI "temiz sayfa" felsefesi, AYNI `stopDailyHideEnabled` ayarına bağlı (bkz. 4-D). Gizli bir kategorinin sınavları Yönetici listesinden KAYBOLMAZ, sadece soluklaşır — kullanıcı manuel açabilir, ya da Planlayıcı'dan o kategorideki bir denemeye atanmış bir göreve tıklarsa otomatik açılır (bkz. 4-K, `todoOpenDenemeRef`).

---

### ☁️ F. Drive Asset Storage (localStorage Taşma Koruması)
`features.js` içinde, mevcut Drive Yedekleme sisteminin hemen altında yaşayan, **localStorage kotasını aşan büyük verileri (PDF/görsel/çizim) otomatik olarak kullanıcının Google Drive'ındaki gizli `appDataFolder` alanına taşıyan** jenerik bir katmandır. `drive.appdata` scope'u zaten Drive Yedekleme tarafından isteniyor — bu sistem ek bir izin istemez ve dosyalar kullanıcının normal Drive arayüzünde görünmez.

1.  **Neden var:** localStorage tüm `aha_*` anahtarları arasında paylaşılan tek bir kotaya sahiptir (tarayıcıya göre ~5-10MB). Bir PDF eki base64'e çevrilip bu kotayı aşarsa `localStorage.setItem` `QuotaExceededError` fırlatır. Eskiden `saveAll()`/`saveNotes()` bunu sessizce yutuyordu — kullanıcı fark etmeden o oturumdaki **tüm** değişiklikleri kaybediyordu.
    *   **Eşik `AHA_OFFLOAD_MIN_BYTES = 20KB`** (eskiden 40KB'ydi — canlı testte flashcard görsellerinin tek tek genelde 40KB altında kaldığı, hiçbirinin aday SAYILMADIĞI ama toplamda birkaç MB'a çıkabildiği görüldü, eşik düşürüldü).
    *   **İki farklı tetikleyici bir arada çalışır:** (a) **Reaktif** — `localStorage.setItem` gerçekten fırlarsa (`ahaOffloadAndSave`). (b) **Proaktif** — kayıt teknik olarak BAŞARILI olsa bile, o TEK anahtar `AHA_PROACTIVE_OFFLOAD_KEY_BUDGET` (400KB) üzerindeyse arka planda sessizce hafifletilir (`ahaProactiveOffloadIfOversized`). Bu ikincisi olmadan bir anahtar (ör. yüzlerce küçük flashcard görseli) kota fiilen dolana kadar hiç tetiklenmeden MB'larca büyüyebiliyordu — tarayıcı açısından "hâlâ sığıyor" sayıldığı için hata hiç fırlamıyordu.
2.  **Pointer deseni — ÜÇ farklı yerleşim şekli var:**
    - **Yapısal, tam data-URI** (playlist/OOP video `attachments[].data`, deneme `exam.pdf.data`): tüm alan bir pointer nesnesiyle DEĞİŞTİRİLİR:
      ```json
      { "__ahaAsset": true, "driveId": "…", "assetId": "ast_…", "mime": "application/pdf", "size": 8342011, "name": "deneme5.pdf" }
      ```
    - **HTML içine gömülü** (Notlar'daki `page.html` — contenteditable içine `<img src="data:...">` / `data-pdf-src="data:..."` / `data-raw-snapshot="data:..."` olarak gömülü PDF/görsel/çizim): sadece o base64 SUBSTRING'i çıkarılır, yerine `aha-asset://driveId` metni konur, HTML'in geri kalanı (class'lar, `onclick` handler'ları, yapı) AYNEN kalır.
    - **Sibling mime+data (`data:` ÖNEKİ YOK)** (Flashcard `c.img = {mime,data}` — `ai.js`): tespit, `mime` alanının gerçek bir mime-type gibi görünmesi VE `data`'nın SADECE base64 alfabesinden oluşmasının BİRLİKTE aranmasıyla yapılır (`kind:'rawimg'`, bkz. `ahaFindOffloadCandidates`); eşleşirse TÜM `{mime,data}` nesnesi (yani `card.img`'in kendisi) pointer'la DEĞİŞTİRİLİR.

    Her üç durumda da var olan tüm eski veriler değişmeden kalmaya devam eder — **geriye dönük migration gerekmez**, ilgili resolve fonksiyonları yeni-eski şekilleri otomatik ayırt eder.
3.  **Akış (attachments + flashcard + deneme PDF):** `ahaSafeSetItem(key, obj)` → `localStorage.setItem`'in yerine geçer. Önce normal yolu dener; **başarılı olsa bile** sonuç `AHA_PROACTIVE_OFFLOAD_KEY_BUDGET`'ı aşıyorsa arka planda `ahaProactiveOffloadIfOversized()` tetiklenir; normal yol **fırlarsa** `ahaOffloadAndSave()` devreye girer. İkisi de aynı `ahaFindOffloadCandidates()`'ı kullanır: obj ağacındaki `kind:'whole'`/`kind:'html'`/`kind:'rawimg'` adaylarını bulur, en büyükten başlayarak Drive'a taşır, yerine koyup **yeniden dener** — proaktif yol "artık sığıyor mu" değil "artık bütçenin altında mı" sorusuna baktığı için, reaktif yolun aksine TEK bir dosyada durmaz, gerçekten bütçenin altına düşene kadar sırayla taşımaya devam eder. Upload resumable (büyük dosyalar için gerekli — basit/multipart upload güvenilir değil).
4.  **Akış (Notlar — HER ZAMAN proaktif, farklı):** `notes.js → flushCurrentNoteSave()` her autosave'de kaydetmeden ÖNCE `ahaOffloadHtmlAssets(html)` çağırır — kota/bütçe kontrolünü bile beklemeden, editördeki büyük gömülü dosyaları anında taşır (çünkü içerik canlı bir contenteditable DOM'dan 500ms'de bir okunur, madde 3'teki genel mekanizma bunu YAKALAYAMAZ). `_ahaUploadDedup` (dataUrl→driveId, oturum içi) sayesinde aynı bayt her 500ms'lik autosave'de TEKRAR yüklenmez. **BUG FIX:** bu önbellek eskiden SADECE yükleme sırasında dolduruluyordu; bir notu sadece AÇIP (hydrate → dosya Drive'dan iner, DOM'a geri konur) hiçbir şey değiştirmeden kapatsan bile, autosave o hydrate edilmiş büyük veriyi tekrar bulur ve **yeniden yüklerdi**. Artık `ahaHydrateHtmlAssets` da aynı önbelleği dolduruyor — indirilen bir dosya aynı oturumda değişmeden tekrar kaydedilirse artık sessizce aynı pointer'a geri döner, gereksiz re-upload yapılmaz.
5.  **Görüntüleme/Hydrate — ZAMAN AŞIMI ve TIKLAMA-ANI ÇÖZÜMLEME:** Attachment'ı göstermeden önce `ahaResolveAssetData(att)` (bkz. `openAttachViewer`), deneme PDF'i açmadan önce `_dnmResolveExamPdf(exam,onReady)` (bkz. 4-E madde 4), flashcard SS'ini göstermeden önce `ahaResolveRawImage(c.img)` — hepsi pointer/düz-veri ayrımını kendisi yapar. HTML-gömülü tarafta, `page.html`'i `innerHTML` olarak enjekte eden HER yerden hemen sonra `ahaHydrateHtmlAssets(containerEl)` (bkz. `notes.js → openNotePage`) — bu, sayfa açılışında BİR KEZ çalışan arka plan ön-yüklemesidir. **BUG FIX:** Notlardaki PDF önizlemesi (`noteBlockOpenPdfPreview`) eskiden SADECE bu tek seferlik ön-yüklemeye güveniyordu — token henüz hazır değilken sayfa açılmışsa hydrate sessizce başarısız oluyor, bir daha HİÇ tekrar denenmiyordu; kullanıcı tıklayınca çözülmemiş `aha-asset://` placeholder'ı doğrudan iframe'e basılıyor, süresiz "açılmıyor" görüntüsü veriyordu. Artık PDF'e her TIKLANDIĞINDA `_noteResolvePdfPreview` kendi çözümünü kendisi (yeniden) dener, net bir "⏳ İndiriliyor" / "❌ hata + 🔄 Tekrar Dene" (giriş gerekiyorsa doğrudan "🔑 Google'a Giriş Yap") geri bildirimi gösterir. Ayrıca `ahaResolveAssetData`'nın Drive fetch'ine artık `AbortController` ile gerçek bir **zaman aşımı** (`AHA_ASSET_FETCH_TIMEOUT_MS`, 30sn) var — ağ takılırsa eskiden olduğu gibi süresiz beklemek yerine net bir hata döner. Hepsi `_ahaAssetCache` (driveId→dataUrl) ile önbelleklenir.
6.  **Silme:** Attachment'ta `ahaIsAssetPointer(att.data)`, flashcard'da `ahaIsAssetPointer(card.img)`, deneme'de `exam.pdf.data` (bkz. `_dnmCleanupOldExamPdf` — hem sınav silinirken hem PDF değiştirilirken/kaldırılırken çağrılır), AI sohbet arşivinde `aiChatHistory[0].data` (bkz. `clearAiChat`) true ise `ahaDeleteAssetFromDrive()` çağrılmalı. Not bloğu silmede (`removeNoteWrap` vb.) buna eşdeğer bir ANLIK hook YOK — kasıtlı (bkz. eski gerekçe). Bunun yerine (ve tüm kaçırılan durumlar için) `ahaReconcileDriveAssets()` her 60 saniyede bir + her Google girişinden kısa süre sonra bir **yetim temizliği** sweep'i çalıştırır: `ahaCollectReferencedDriveIds()` canlı `playlists`/`oopItems`'ı VE (canlı değişkenlere değil, ilgili panel hiç açılmamış/init olmamış olabileceği için doğrudan `localStorage.getItem(...)`'e bakarak) **notlar, flashcard'lar, deneme kayıtları (`aha_deneme_v1`) VE AI sohbet arşiv işaretleyicisi (`aha_ai_chat_v1`)** içindeki tüm referansları toplar; Drive'da olup artık hiçbir yerde referans edilmeyen dosyaları siler. **KRİTİK:** yeni bir Drive tüketicisi eklerken bu fonksiyona onu da eklemeyi UNUTMA — unutulursa, o tüketicinin yüklediği HER dosya "referanssız" sanılıp birkaç dakika içinde bu sweep tarafından otomatik silinir (bu hata, deneme PDF'i ve AI sohbet arşivi eklenirken tam olarak yaşanıp düzeltildi).
7.  **Şu an kapsadığı yer — TAMAMI BAĞLI:** `aha_v4_data` (playlist/OOP `attachments`), `aha_notes_v1` (gömülü PDF/görsel/çizim), `aha_flashcards_v1` (ekran görüntüleri), **`aha_deneme_v1`** (sınav PDF ekleri — `denemeSaveExams()` üzerinden, madde 3'teki `kind:'whole'` deseniyle), **`aha_ai_chat_v1`** (çok uzayan sohbet geçmişinin en eski kısmı — bkz. `ahaArchiveOldChatMessages`, TIER-2 son çare: normal offload'un bulacağı ikili bir şey yoksa — sohbet düz metindir — ve hâlâ sığmıyorsa devreye girer, en eski mesajların ~%60'ını tek bir Drive dosyasında arşivler, hiçbir mesajı SİLMEDEN; `aiChatHistory[0]` bir `{role:'_archive',archived:true,count,data}` işaretleyicisi olabilir, bu ASLA Gemini API'ye gönderilmemelidir — `sendAiChatMessage` bunu `apiHistory` filtrelemesiyle zaten yapıyor).
8.  **Yeni bir yere bağlamak için:** Alan **yapısal tam data-URI** (`{data:"data:..."}`) ise: `localStorage.setItem(KEY,JSON.stringify(veri))` satırını `ahaSafeSetItem(KEY,veri)` ile değiştirmek YETERLİ, jenerik tarayıcı hem reaktif hem proaktif tarafı otomatik yakalar. Alan **`{mime,data}` sibling** (data HAM base64) ise: aynı şekilde `ahaSafeSetItem` yeterli (`kind:'rawimg'` otomatik yakalar), göstermeden önce `ahaResolveRawImage()` kullan. Alan bir contenteditable/HTML string'i içine **gömülüyse**: kaydetmeden önce `ahaOffloadHtmlAssets(html)`, o HTML'i DOM'a her enjekte edişte de `ahaHydrateHtmlAssets(containerEl)` çağır. **Unutma:** (a) `ahaCollectReferencedDriveIds()`'a yeni anahtarını ekle (madde 6), (b) çözülmüş data-URI'yi ASLA modelin kendisine (`obj.data`) geri yazma — sadece render için kullanılacak yerel bir değişkende tut, yoksa küçük pointer tekrar dev bir string'e döner ve bir sonraki kayıtta gereksiz yere yeniden Drive'a gider.

---

### 🔐 G. Google Kimlik Doğrulama, Sessiz Oturum Yenileme ve Otomatik Yedekleme
*   **Token hiç kalıcı saklanmaz — bilinçli bir tercih:** `_ytAccessToken` sadece bellekte (JS değişkeni) yaşar, sayfa yenilendiğinde SIFIRLANIR. Bu **kasıtlıdır**: ham bir OAuth access token'ı `localStorage`'a yazmak gerçek bir güvenlik açığı olurdu (XSS/tarayıcı erişimiyle çalınabilecek bir bearer credential), üstelik token zaten kısa ömürlü olduğu için pratik faydası da sınırlı olurdu. **Bunu değiştirmeyi düşünme** — sadece `_musicLastEmail` (bir e-posta ipucu, sır DEĞİL) `aha_music_email` içinde saklanır, gerçek oturum durumu her zaman Google'ın kendi tarayıcı çerezlerine bırakılır.
*   **Sessiz giriş (`prompt:'none'`):** Sayfa her açıldığında, e-posta ipucu varsa `initGoogleAuth()` görünmez bir şekilde yeniden giriş dener. Bu başarısız olursa kullanıcı Ayarlar'dan elle giriş yapar.
*   **Sessiz Token Yenileme:** Giriş başarılı olduğunda `_ytScheduleTokenRefresh(resp.expires_in)` çalışır — mevcut token süresi dolmadan ~5 dakika önce, popup GÖSTERMEDEN aynı sessiz akışı tekrar tetikler (`_ytTokenRefreshTimer`). Bu, uzun bir çalışma oturumunda token'ın ortasında sessizce geçersiz hâle gelip "giriş yapmalısın" hatasına yol açmasını önler. `signOutGoogle()` bu zamanlayıcıyı temizler.
*   **Giriş-anında otomatik tekrar deneme:** Bir PDF önizlemesi/seçim modalı "giriş yapmalısın" hatasıyla açık kalmışsa (bkz. 4-F madde 5), başarılı bir girişten hemen sonra bu arayüzler **otomatik olarak kendini tekrar dener** (`initGoogleAuth`'ın başarı callback'i içinde) — kullanıcı "giriş yap → tekrar PDF'e tıkla" yapmak zorunda kalmaz.
*   **Otomatik (sessiz) Drive yedeklemesi:** Manuel "Yedekle" butonuna ek olarak, her girişten ~8 saniye sonra `ahaAutoBackupIfDue()` çalışır — son otomatik yedeklemenin üzerinden `AHA_AUTO_BACKUP_MIN_INTERVAL_MS` (~20 saat) geçtiyse, TÜM `BACKUP_KEYS` sessizce (toast/UI geri bildirimi OLMADAN) Drive'a yazılır. Kullanıcı manuel yedekleme butonuna hiç basmasa bile veri kaybı riski büyük ölçüde azalır.

---

### 💧 H. Su Takibi (Water Tracking) — `water.js`
*   **Tamamen bağımsız, opsiyonel modül:** deneme.js'in "tek dosya, tek `<script>` etiketi" felsefesiyle aynı şekilde `water.js`, `index.html`/`styles.css`'e sadece topbar butonu + dropdown iskeleti ve CSS olarak yerleşir; TÜM davranış mantığı kendi dosyasındadır. `core.js`'den SONRA yüklenir (`getTodayStr`/`showToast`/`pad`/`_panels`/`_activePanel` global'lerine ihtiyaç duyar) ama `features.js`/`deneme.js`/`ai.js`'e bağımlı DEĞİLDİR.
*   **Varsayılan KAPALI:** `aha_water_enabled_v1` anahtarı hiç yoksa (ilk kurulum) widget üst barda görünmez — kullanıcı Ayarlar > 💧 Su Takibi'den açar. Üst bar butonu AI butonunun **hemen solundadır**.
*   **"İz bırakmayan" günlük veri — ana arşiv sisteminden BİLEREK bağımsız:** `aha_water_v1` = `{date, goalMl, unitMl, logs:[{ml,ts}]}`. Her `renderWaterWidget()`/`loadWaterData()` çağrısında `date` bugünle karşılaştırılır; eşleşmiyorsa `logs` DOĞRUDAN SIFIRLANIR — 4-D'deki Birleşik Günlük Arşiv'in aksine, önceki günün su kayıtları **hiçbir yerde arşivlenmez**. Sadece `goalMl`/`unitMl` (kullanıcı TERCİHİ, günlük veri değil) sonraki güne taşınır.
*   **Çifte güvenlik ağı:** `_waterScheduleMidnightCheck()` tam gece yarısında (features.js → `scheduleMidnightCheck()` ile birebir aynı zamanlama tekniği) kendini tetikler; AYRICA `loadWaterData()` her widget açılışında da tarihi kontrol eder — bilgisayar gece yarısını uykuda geçirse bile widget bir sonraki açılışta kendini otomatik düzeltir.
*   **Kayıt biçimi:** kullanıcı ya sabit bir "ölçek" (`unitMl`, örn. 500ml bardak) ile tek tıkla ekler (`waterQuickAdd()`), ya da serbest bir ml değeri elle girer (`waterManualAdd()`). Her iki yol da AYNI `logs` dizisine `{ml, ts}` olarak düşer — "kaç kez içildi" bilgisi bu dizinin uzunluğundan/gruplamasından türetilir, ayrı bir sayaç tutulmaz (tek doğruluk kaynağı).
*   **Vibes paneliyle karşılıklı dışlama:** su takibi dropdown'ı da tıpkı Vibes dropdown'ı gibi `core.js`'teki merkezi panel yöneticisinden (fullscreen panelleri kapatır) bağımsız ama KENDİ ARALARINDA karşılıklı kapanırlar — `water.js`, `toggleVibesPanel`'i `core.js`'in kendi `startWhiteNoise`/`stopWhiteNoise` patch tekniğiyle AYNI yöntemle sarmalayıp genişletir.
*   **BACKUP_KEYS'e dahil:** `aha_water_enabled_v1` ve `aha_water_v1` Drive yedeğine dahildir (bkz. 4-F ve Altın Kural #13) — bayat bir günlük log Drive'dan geri yüklense bile yukarıdaki tarih kontrolü sayesinde asla sızmaz, sadece hedef/ölçek tercihleri cihazlar arası taşınmış olur.

---

### 🗑 I. Tam Sıfırlama (Factory Reset) — `Ctrl+S+F`
*   **Gece yarısı sıfırlamasıyla KARIŞTIRILMAMALI:** `checkMidnightReset()` (4-D) sadece o günkü playlist izleme durumunu arşivler/gizler — deneme kayıtları, notlar, flashcard'lar ASLA silinmez (Altın Kural #6). `performFullFactoryReset()` ise tamamen farklı, kullanıcının AÇIKÇA istediği, **GERİ ALINAMAZ** bir TAM silmedir; deneme kayıtları dahil gerçekten her şeyi siler ve sayfayı yeniden yükler.
*   **Tetikleyiciler:** `Ctrl+S+F` klavye kısayolu (sıra ÖNEMLİ DEĞİL — S ve F ayrı ayrı izlenir, Ctrl basılıyken ikisi de true olduğu an tetiklenir, bkz. core.js → KEYBOARD SHORTCUTS) VEYA Ayarlar > ⚠️ Tehlikeli Bölge > "Tüm Verileri Sıfırla" butonu. İkisi de `confirmFullFactoryReset()`'i çağırır — tek ama net bir `confirm()` ile onay ister (mevcut yıkıcı aksiyonlarla — playlist/not silme, Drive geri yükleme — AYNI tek-confirm() deseni).
*   **Anahtar listesi ELLE TUTULMUYOR:** `performFullFactoryReset()` localStorage'ı tarayıp `aha_` önekli HER anahtarı (+ `ytSearchCount`) otomatik toplayıp siler. Bu bilinçli bir mimari tercih — yeni bir `aha_*` anahtarı (örn. gelecekte `ai.js`/`deneme.js`/`music.js` içine eklenirse) bu fonksiyona AYRICA eklemeyi unutmak, o anahtarın sıfırlamadan sağ çıkıp "ilk açılış" görünümünü bozmasına yol açardı — bkz. Altın Kural #13'teki AYNI sınıf hata. **Yeni bir `aha_*` anahtarı eklerken bu fonksiyona dokunmana gerek YOK, otomatik yakalanır.**

---

### 🖋 J. Notlar: Renk Motoru ve Sembol Kısayolları

*   **Renk/vurgu motoru — İKİ kod yolu, TEK temsil:** Not editöründeki renk/arka-plan-rengi değişiklikleri hiçbir zaman `document.execCommand('foreColor'/'hiliteColor'/'backColor', ...)` KULLANMAZ — bu, styleWithCSS hiç etkinleştirilmediği için uygulamanın geri kalanının tanımadığı `<font>` etiketleri üretir ve `note-style-span` mimarisiyle tutarsız ikinci bir temsile yol açardı (kökten çözülen bir bug — bkz. Değişiklik Geçmişi). Bunun yerine İKİ ayrı senaryo da (caret collapsed / gerçek metin seçili) AYNI `note-style-span` tabanlı, elle DOM manipülasyonu yapan motora çıkar:
    *   **Caret collapsed (sadece imleç):** `_wrapLastTypedCharWithPendingStyle` — bir sonraki yazılan TEK karakteri sarar. Yeni stil eskisinden FARKLIYSA, yeni span eskisinin İÇİNE değil (iç içe geçme = bug) AYNI SEVİYEYE, kardeş olarak yerleşir. **"Zaten doğru span" kısayolu** (caret zaten pending ile eşleşen bir span içindeyse yeni span oluşturmadan büyümeye devam eder) döndürdüğü offset'i HER ZAMAN `node.textContent.length` (span'ın SONU) DEĞİL, parametre olarak gelen GERÇEK offset'i kullanmalı — aksi halde kullanıcı zaten-doğru-stildeki metnin ORTASINA tıklayıp yazınca (örn. yazdığı bir cümlenin ortasına unuttuğu kelimeyi eklerken) caret o span'ın en SONUNA fırlar (bu oturumda bulunup düzeltilen ikinci bug, bkz. Altın Kural #16 ve Değişiklik Geçmişi).
    *   **Gerçek seçim:** `_applyStyleToRange` — seçili aralığın sınırlarını text-node kenarına hizalar (`_splitRangeTextBoundaries` + `_hoistStyleSpanSiblingText`, "her style-span TEK text node içerir" değişmezini KORUYARAK), aralık içindeki TÜM text node'ları toplar (`_collectFullTextNodesInRange`, `Range.comparePoint` tabanlı), her birini kardeş seviyesinde yeniden sarar.
    *   Her iki yol da, DEĞİŞTİRİLMEYEN diğer stili (örn. sadece yazı rengi değişirken vurgu rengini) eski span'dan yeni span'a KOPYALAYARAK korur — biri diğerini asla silmez.
    *   `_mergeAdjacentSameStyleSpans` her iki yoldan sonra da çağrılır — ardışık, TAM AYNI stildeki kardeş span'ları tek span'a birleştirir; tekrar tekrar seç+renklendir yapıldıkça not HTML'inin onlarca ufak span'a bölünüp şişmesini önler.
    *   jsdom ile izole birim testlerle doğrulanmıştır (nested-span regresyonu, iki FARKLI renkli span'a yayılan kısmi seçim, span'ın TAM ORTASININ seçilmesi, çok paragraflı seçim, düz+stilli karışık seçim dahil).

*   **Sembol Kısayolları (orta-tık ile atama):** Sembol panelindeki (`NOTE_SYMBOL_CATEGORIES`) herhangi bir sembole ORTA TIK, `openNoteSymbolShortcutAssign()`'ı tetikleyip küçük bir "dinle ve ata" paneli açar — kullanıcı bir tuş kombinasyonuna basar (`_noteSymbolShortcutListenKeydown`, panel açıkken `document`'a CAPTURE fazında bağlanır), panel onu yakalayıp gösterir, "Kaydet" ile `aha_note_symbol_shortcuts_v1`'e `{comboKey: symbol}` olarak yazılır.
    *   **comboKey `e.code` tabanlıdır** (örn. `'Ctrl+Digit1'`) — klavye düzeninden ve Shift'ten bağımsız; görüntü için `_noteSymbolShortcutLabel` ile sadeleştirilir (`'Ctrl+1'`).
    *   **En az bir Ctrl/Alt/Cmd zorunludur** — yoksa her sıradan harf tuşu bir "kısayol" sayılıp normal yazmayı kırardı.
    *   **1 sembol = en fazla 1 kısayol, 1 kısayol = en fazla 1 sembol** — yeniden atama eskisini otomatik siler; başka bir sembole ait bir kombinasyon "çalınırsa" o sembolün kısayolu kaybolur (kullanıcı kaydetmeden önce uyarılır).
    *   **`_NOTE_SYMBOL_RESERVED_COMBOS`** Ctrl/Meta+B/I/U'yu (Kalın/İtalik/Altı Çizili) atanmaya karşı korur — bunlar AYNI `content` keydown handler'ında ÖNCE kontrol edildiği için gerçek bir çakışma teşkil ederdi. Uygulama-geneli kısayollar (Ctrl+S+F, Ctrl+A+S) korumaya GEREK DUYMAZ çünkü core.js'in kendi keydown handler'ı `document.activeElement`'in contenteditable olduğu HER durumda zaten en başta çıkar (bkz. core.js → KEYBOARD SHORTCUTS) — iki sistem hiç kesişmez.
    *   Atanmış bir kısayola sahip semboller `.note-symbol-btn` üzerinde küçük bir nokta rozetiyle işaretlenir; tam kısayol `title` tooltip'inde görünür.
    *   `aha_note_symbol_shortcuts_v1` `BACKUP_KEYS`'e dahildir (Drive'a yedeklenir).

*   **(2026-09) BUG FIX — Alıntıdan (blockquote) çıkış:** `insertOrderedList`/`insertUnorderedList` listelerinde boş bir maddede Enter'a basmak tarayıcı tarafından NATIVE olarak listeden çıkışı tetikler (yeni normal paragraf açılır) — ama `formatBlock:blockquote` için tarayıcıların HİÇBİRİ bu davranışı native sağlamaz, bu yüzden Enter alıntı içinde sonsuza kadar yeni satır açıyordu, kullanıcı hiçbir zaman alıntıdan çıkıp normal yazmaya dönemiyordu. `_noteTryExitEmptyBlockquoteOnEnter()` bu native listeleri davranışını blockquote için ELLE taklit eder: caret'in içinde bulunduğu satır (blockquote'un doğrudan child'ı olan bir `<div>`/`<p>` YA DA — ara katman yoksa — blockquote'un TAMAMI) boşsa blockquote'tan çıkılır, imleç hemen sonrasına açılan yeni bir paragrafa taşınır; satır boş DEĞİLSE hiç müdahale etmez. jsdom ile 13 senaryoyla (flat yapı, nested-div yapı, asimetrik yapı, boş/dolu satır, blockquote dışı caret dahil) doğrulanmıştır. **Yeni bir blockquote/liste davranışı eklerken bu fonksiyonu bozmadan üzerine inşa et** — `content` keydown handler'ında `e.key==='Enter'` kontrolünün İÇİNDE yaşar.
    *   jsdom ile izole birim testlerle doğrulanmıştır (kombinasyon türetme, rezerve reddi, yeniden atama/çalma, Escape ile iptal, editörde gerçek kısayol-basımının doğru sembolü eklediği uçtan-uca akış dahil).

---

### 📋 K. Planlayıcı — Günlük Çalışma Planı (To-Do List) Sistemi

**"Planlayıcı" sekmesinin YENİ ana içeriği** (`renderTodoPlannerTab`, features.js). Eski ileri-tarih PLAYLIST/VİDEO planlayıcısının (`renderPlannerTab`) ve `deneme.js`'teki ileri-tarih DENEME planlayıcısının (`denemeRenderPlannerTab`) **yerine** geçer.

*   **Eskiler SİLİNMEDİ, bir kenara kondu:** Kullanıcı isteğiyle her iki eski fonksiyon (ve tüm yardımcıları — `togglePlannerPl`/`addPlannerVideo`/`denemeAssignExamToDate`/vb.) kod tabanında **tamamen sağlam duruyor**, sadece `renderCalBody()`/`denemeRenderCalBody()` artık onları çağırmıyor. **Bu iki fonksiyonun üzerindeki `[BİR KENARA KONDU]` yorum bloklarını silme**, gelecekteki bir AI'ın bu kararın bilinçli olduğunu anlaması için oradalar.
*   **30 Günlük Pencere (Golden Rule #12'yi GENİŞLETİYOR, ÇELİŞMİYOR):** `TODO_WINDOW_DAYS=30` sabit, her render'da "bugün" referans alınarak YENİDEN hesaplanan **kayan (rolling)** bir penceredir. `_todoInWindow(dateStr)` tek doğruluk kaynağıdır.
*   **Gece Yarısı Arşivleme:** Bir gün "bugün" olmaktan çıktığında o günün `todosData[gün]` verisi watch verisiyle AYNI günlük arşiv kaydına taşınır ve canlı `todosData`'dan silinir.
*   **GÖRÜNÜM MİMARİSİ (2026-09 güncellemesi — DİKKAT, isimler kafa karıştırıcı çünkü SEMANTİK değişti, kod ismi değişmedi):** `todoViewMode` (`'list'`\|`'table'`, `aha_todo_viewmode_v1`'de kalıcı) hâlâ iki değer alır ama İKİSİ DE YENİDEN YAZILDI:
    *   `'list'` (buton etiketi "☰ Liste") → `_todoRenderListRow` — **eski `_todoRenderTable`'ın YERİNE geçti** (basit satır listesi, artık sürükle-bırak + renklendirme + kind-farkındalıklı tıklama ile). **Eski checklist-tarzı `_todoRenderListRow` (iki parametreli eski imza) TAMAMEN SİLİNDİ, geri getirilmedi** — kullanıcı açık talimatıyla.
    *   `'table'` (buton etiketi "▦ Tablo") → **YEPYENİ** `_todoRenderWeeklyTable` — Pazartesi-Pazar 7 sütunlu haftalık pano (`todoWeekOffset` ile hafta gezinme, SADECE bugünün haftası ve sonrası — `todoWeekNav` geçmiş haftaya gitmeyi engeller). Her sütun o günün görevlerini `_todoRenderWeekCard` ile `|Ders|` + görev adı + (varsa) `dk` süre formatında gösterir — saat YOKSA hiç saat rozeti basılmaz (ekli örnek görseldeki gibi HER satırı doldurmuyoruz).
    *   **Sürükle-bırak (HER İKİ görünümde de, `todoDragStart/Over/Leave/Drop`):** Kural: iki SAATLİ görev birbirine göre kronolojik sırasını KORUMALI (saat 11:58 olan bir görev saat 10:00 olanın önüne taşınamaz — `_todoValidateTimeOrder` reddeder ve toast gösterir). Görevlerden biri (veya ikisi) saatsizse serbestçe herhangi bir yere sürüklenebilir. Yeni bir görev saatle eklenince `_todoInsertChronologically` onu otomatik doğru kronolojik konuma yerleştirir. jsdom ile 17/17 test geçti (hafta matematiği, sıralama, ekleme, saat-çakışma reddi dahil).
    *   **Ders adı / görev adı renklendirme:** `item.subjectColor` / `item.titleColor` (hex, `showColorPicker`/`colorPickerCallback` — mgrOpenCatColorPicker ile AYNI mekanizma) — `todoOpenSubjectColorPicker`/`todoOpenTitleColorPicker`. Video/deneme türü görevlerde "ders adı" kavramı yok (`isRefKind` kontrolü), sadece görev adı renklendirilebilir.
*   **Video/Deneme atama TAMAMEN YENİDEN YAZILDI (BUG FIX — kullanıcı isteği):** Eskiden `kind==='video'`/`'deneme'` seçilince de aynı serbest-metin "ders adı" alanı gösteriliyordu (anlamsızdı). Artık:
    *   `item.videoRef = {plId, vidId, title}` — `todoOpenVideoPickerForAdd` ile AÇILAN, notes.js `openNoteVideoPicker` ile AYNI görsel desendeki seçiciden ya kendi playlistlerinden bir video seçilir, ya da doğrudan bir YouTube linki yapıştırılır (`todoVideoPickerUseLink`, `extractVideoId`+`fetchTitle`). Yapıştırılan video HİÇBİR playlist'te değilse `_todoEnsureAutoPlaylist()` kalıcı olmayan `"todolist"` (`TODO_AUTO_PLAYLIST_NAME`) playlistini açar/yeniden kullanır ve videoyu oraya ekler (dedup'lu — video zaten bir playliste aitse O playliste referans verilir, ikinci kopya oluşturulmaz).
    *   `item.denemeRef = {examId, catId, title}` — `todoOpenDenemePickerForAdd` ile kendi deneme kategorilerinden/denemelerinden AYNI görsel desende seçim yapılır.
    *   **Göreve tıklayınca açma:** `todoOpenVideoRef`/`todoOpenDenemeRef` — notes.js `openVideoFromNoteRef` ile BİREBİR AYNI mantık: playlist/kategori gizliyse önce görünür yapılır (`showToast` ile bildirilir), sonra sanki oradan açılmış gibi ana ekranda video oynatılır (`switchPlaylist`+`playPlaylistVideo`) ya da deneme başlatılır (`denemeLaunchExam` — zaten tamamlanmışsa `denemeOpenScoreModal`). `videoRef`/`denemeRef` YOKSA (AI Plan Tanıma bir video/deneme görevi tahmin edip GERÇEK bir referans atayamadığında olabilir — bkz. 4-L) tıklama pasiftir, satırda "⚠️ atanmadı" uyarısı gösterilir; sessizce kırılmaz ama yanıltıcı da görünmez.
    *   `"todolist"` playlist'i **KALICI DEĞİLDİR** — `checkMidnightReset()` her gece yarısı bu playlist'i (`TODO_AUTO_PLAYLIST_NAME` adıyla eşleşeni) tamamen siler; eski bir görev hâlâ o playlist'e referans veriyorsa `todoOpenVideoRef` `targetPl` bulunamayınca zarifçe `loadVideoInPlayer`'a (tek video, playlist dışı) düşer.
*   **Özel Zamanlayıcı — global kronometre/Pomodoro'dan BAĞIMSIZ:** SADECE `study`/`custom` türü (video/deneme DEĞİL — o ikisinde tıklama artık video/deneme açar) `minutes` alanı dolu bir öğeye tıklamak `todoStartTimer` ile kendi başına `setInterval` çalıştıran hafif bir geri sayım açar. Süre dolunca (`todoTimerComplete`) öğe otomatik `done:true` olur ve `beep()` çalar.
*   **Kolay Silme (`todoConfirmDeleteScope`/`todoExecuteDeleteScope`):** değişmedi.
*   **Drive Yedeği:** `aha_v4_todos`, `aha_todo_viewmode_v1` ve YENİ `aha_stop_daily_hide_v1` (bkz. 4-D) `BACKUP_KEYS`'e dahildir.
*   jsdom ile izole fonksiyonel testlerle doğrulanmıştır: eski 44 testin yanına, bu güncellemede sürükle-bırak/hafta-matematiği/kronolojik-ekleme için 17 yeni saf-mantık testi eklendi (17/17 geçti).

---

### 🖼️ L. AI Plan Tanıma — Fotoğraftan Haftalık Plan Aktarımı

AI panelindeki **görselden-flashcard-üretme akışının (4-B) AYNI iskeletini** (`callGeminiAPI(..., jsonMode=true)`) kullanarak, kullanıcının yüklediği bir **haftalık plan fotoğrafını** (defter, ajanda, ekran görüntüsü) analiz edip doğrudan yukarıdaki to-do list'e (4-K) yazan AI sekmesi (`aiPlanHtml`, ai.js).

1.  **Akış:** Fotoğraf yükle (yapıştır/sürükle/seç — `aiCreateHtml`'deki `.ai-fc-drop` ile AYNI bileşen, ayrı state: `aiPlanImage`) → hafta seç (`aiPlanSelectedWeekStart`, varsayılan: içinde bulunulan hafta) → **Analiz Et** → Gemini görseldeki HER GÜN için `{gun, etkinlikler:[{baslik,tur,ders,dakika,saat}]}` JSON'ı döndürür (`AI_PLAN_PROMPT`) → gün isimleri seçili haftanın GERÇEK tarihlerine eşlenir (`_aiPlanBuildPreview`) → önizlemede kullanıcı etkinlik bazında checkbox'larla ince ayar yapar → **Seçili Haftaya Ekle** ile `todosData`'ya yazılır (`confirmAiPlanAdd`, `source:'ai'` dışında `todoAddItem`'la BİREBİR AYNI veri şekli).
2.  **Geçmiş Gün Filtrelemesi (kullanıcının asıl istediği kısım):** Örn. bugün Perşembe'yse ve kullanıcı "bu haftanın" planını atarsa, AI'ın döndürdüğü Pazartesi/Salı/Çarşamba günleri **otomatik olarak `notAddableReason:'past'` ile işaretlenir** — önizlemede hangi günlerin ve NEDEN atlandığı açıkça yazılır (`_aiPlanRenderPreview`'daki `.ai-plan-skip-note`), ama veri UYDURULMAZ/gizlenmez, sadece eklenebilir listesinden çıkarılır. Aynı mekanizma, seçilen haftanın son birkaç günü 30-günlük pencerenin (4-K) dışına taşarsa `notAddableReason:'window'` ile de çalışır.
3.  **TR Hafta Kuralı — DİKKAT:** Türkiye'de hafta **Pazartesi** başlar, ama JavaScript'in yerleşik `Date.getDay()`'i Pazar'ı `0` kabul eder. `_aiPlanBuildPreview`'daki `offsetFromMonday` hesabı bunu telafi eder (`Pazar` özel olarak haftanın **6. günü** — yani SONU — olarak ele alınır). Bu alanda yeni bir tarih hesaplaması eklerken `getDay()`'in ham sonucunu TR hafta sırası SANMA — bu tam olarak jsdom testleriyle (gün-ismi→tarih eşlemesi, 7/7 gün) doğrulanan noktaydı.
4.  **Gün adı normalizasyonu:** Gemini bazen `"pazartesi"` (küçük harf) döndürebilir; eşleme öncesi ilk harf büyütülür (`toLocaleUpperCase('tr-TR')` — düz `.toUpperCase()` DEĞİL, aksi halde `"i"` → `"İ"` yerine `"I"` olur ve Türkçe karakterlerde sessizce yanlış eşleşir). Tanınmayan/boş bir gün adı sessizce atlanır, hiçbir zaman uygulamayı çökertmez (bkz. test: "malformed day name").
5.  **Onaydan sonra kullanıcıyı bıraktığı yere değil, SONUCA götürür:** `confirmAiPlanAdd` başarılı eklemeden sonra AI panelini kapatıp Takvim panelini **doğrudan Planlayıcı sekmesinde, eklenen ilk günü seçili halde** açar (`closeAiPanel()` → `openCalendarPanel()` → `switchCalTab('planner')` + `todoSelectedDate`) — kullanıcı "işe yaradı mı?" diye ayrıca kontrol etmek zorunda kalmaz, sonucu anında görür.
6.  jsdom ile izole fonksiyonel testlerle doğrulanmıştır (hafta seçenekleri üretimi, tam 7 günlük eşleme + geçmiş filtreleme — gerçek "bugün" tarihiyle çalıştırılıp geçmiş/gelecek günlerin doğru ayrıldığı bizzat doğrulandı —, malformed girdi güvenliği, seçili/seçilmemiş etkinliklerin onayda doğru şekilde dahil edilip edilmediği dahil — 33/33 geçti).

---

## 🤖 5. Gelecekteki AI Geliştiriciler İçin Altın Kurallar (Development Guardrails)

Eğer bu uygulamanın kodlarını değiştirecek, yeni özellikler ekleyecek veya hataları giderecek bir Yapay Zeka isen, **aşağıdaki kurallara kayıtsız şartsız uymalısın:**

1.  **State Senkronizasyonu:** Kod üzerinde veri (playlist, kart, kategori, not) modifikasyonu yapan her fonksiyondan sonra mutlaka `saveAll()` veya ilgili save fonksiyonunu (`saveAiFlashcards`, `saveAiCategories` vb.) çağırmalısın. Hemen ardından arayüzü güncellemek için ilgili render fonksiyonunu (örn: `renderPlaylist()`, `renderAiBody()`) tetiklemelisin.
2.  **Event Propagation (Olay Yayılması):** Liste elemanlarındaki butonlara (silme, kategori değiştirme, check) tıklandığında üst kapsayıcının tıklama olayının tetiklenmemesi için mutlaka `e.stopPropagation()` kullanmalısın. Aksi takdirde kart silinirken video oynatılmaya başlanabilir.
3.  **WeasyPrint ve HTML Kısıtlamaları (PDF çıktısı alınacaksa):** Arayüz elemanlarında `display: flex` veya `display: grid` kullanımından kaçın, Weasyprint PDF motoru bunları desteklemez. Tablo yapısı veya blok yerleşimleri tercih et.
4.  **API Anahtarı Güvenliği:** API anahtarlarını hiçbir zaman düz metin (plain text) olarak loglama veya dışarı aktarma. Maskeleme işlevlerini (`●●●●●●●●`) bozma.
5.  **Çekirdek Felsefeyi Koru:** Ekleyeceğin her yeni özellik öğrencinin odakta kalmasını desteklemelidir. Uygulamayı harici web sitelerine yönlendiren linkler yerine, özelliklerin uygulama içinde (in-app) çalışmasını sağlayan gömülü sistemleri tercih et.
6.  **Deneme Verisi Asla Arşivlenmez/Silinmez:** `aha_deneme_v1` içindeki sınav kayıtları flashcardlar gibi kalıcı ve kümülatiftir. Playlist izleme durumunun aksine Midnight Reset mantığına ASLA dahil etme — Deneme İstatistikleri sekmesi uzun vadeli net takibi için tüm geçmişe ihtiyaç duyar. `checkMidnightReset()`'i sadece "Bugün" etiketlerini tazelemek için hafifçe sarmalamak yeterlidir, veriye dokunma.
7.  **`deneme.js`'de İki Konum (Cal/Side) Var — Scope'u Asla Atlama:** Deneme Yöneticisi hem Takvim Paneli'nde hem ana ekran sidebar'ında render edilir ve ikisi aynı veriyi paylaşır. Bu modülde yeni bir CRUD/render fonksiyonu eklerken veya var olanı değiştirirken mutlaka `scope` (`'Cal'`/`'Side'`) parametresini fonksiyona ve ürettiği tüm DOM id'lerine taşı; atlarsan iki konum aynı id'yi üretir ve `getElementById` çakışması/yanlış eleman bulma hatası oluşur. Veri mutasyonundan sonra `renderCalBody()`/`if(calActiveTab===...)` yerine `denemeRefreshAllViews()` çağır — bu fonksiyon açık olan HER iki yüzeyi de doğru şekilde tazeler.
8.  **Deneme Skor Ekranında "Boş" Alanı Salt-Okunurdur:** Bilerek elle girilebilir yapılmamıştır — `Boş = Toplam - (Doğru + Yanlış)` formülüyle otomatik hesaplanır (`denemeUpdateScoreNet`/`denemeSaveScore`). Bunu tekrar elle-düzenlenebilir bir input'a çevirme; bu, kullanıcının bizzat bildirdiği bir hesaplama hatasının düzeltilmiş halidir.
9.  **Büyük Veri = `ahaSafeSetItem`/`ahaOffloadHtmlAssets`, Görsel/Ek Okuma = `ahaResolveAssetData`/`ahaResolveRawImage`/`ahaHydrateHtmlAssets` (bkz. 4-F):** Yeni bir localStorage yazma noktası eklerken çıplak `localStorage.setItem(KEY,JSON.stringify(x))` YAZMA. Alan yapısal bir `{data:"data:..."}` veya `{mime,data}` (ham base64) ise `ahaSafeSetItem(KEY,x)` kullan — ikisini de jenerik tarayıcı otomatik ayırt eder. Bir contenteditable/HTML string'i içine gömülüyse (Notlar deseni) kaydetmeden önce `ahaOffloadHtmlAssets(html)`, DOM'a her enjekte edişte `ahaHydrateHtmlAssets(el)` çağır. Bir görseli/attachment'ı ekranda göstermeden önce `.data`/`.img`'i DOĞRUDAN `src`/`iframe` gibi yerlere verme — Drive'a taşınmış olabilir, önce ilgili resolve fonksiyonundan geçir. Silindiğinde `ahaIsAssetPointer(...)` ise `ahaDeleteAssetFromDrive(...)` çağırmayı unutma (not bloğu silmede buna gerek yok — 60sn'lik `ahaReconcileDriveAssets` sweep'i zaten yakalar).
10. **Ham Google Access Token'ı ASLA `localStorage`'a Yazma:** Girişi kolaylaştırmak cazip gelebilir ama bu gerçek bir güvenlik açığıdır (bkz. 4-G). Sürtünmeyi azaltmak istiyorsan sessiz yeniden-giriş (`prompt:'none'`) ve token-süresi-dolmadan-yenileme (`_ytScheduleTokenRefresh`) mekanizmalarını güçlendir, token'ı saklama YOLUNA GİTME.
11. **Drive'dan Çözülen Veriyi ASLA Modele Geri Yazma:** `ahaResolveAssetData`/`ahaResolveRawImage` bir pointer'ı gerçek veriye çevirdiğinde, bu sonuç SADECE render için kullanılan yerel bir değişkende tutulmalı (`iframe.src`, `img.src` vb.) — `exam.pdf.data`, `att.data`, `card.img` gibi kalıcı modelin kendisine YAZILMAMALI. Aksi halde küçük pointer tekrar dev bir base64 string'ine döner ve bir sonraki `saveX()` çağrısı onu gereksiz yere tekrar Drive'a yükler (bu tam olarak Notlar'da yaşanıp düzeltilen bug'dı — bkz. 4-F madde 4).
12. **Planlayıcı Arşivi AY Bazlıdır, Geçmiş (İzleme) Arşivi GÜN Bazlıdır — Karıştırma:** Takvim UI'ı bu ay + gelecek ayı gösterdiği için bu ayki geçmiş bir gün hâlâ düzenlenebilir olmalı; planlayıcı verisini gün geçişinde arşivleyip silersen o özelliği kırarsın (bkz. 4-D). **Bu SADECE eski (artık bir kenara konmuş, bkz. 4-K) ileri-tarih playlist/video planlayıcısı için geçerlidir.** Yeni Günlük Çalışma Planı / to-do list sistemi (`aha_v4_todos`) BİLEREK farklı bir modele bağlıdır — o, kayan (rolling) 30 günlük bir pencere kullanır ve watch verisiyle AYNI GÜN-bazlı arşivleme mantığını izler (bkz. 4-K). Üç farklı arşivleme felsefesi bir arada yaşıyor — hangi sistemde çalışıyorsan ONUN kuralını uygula, birini diğerine kıyasla "tutarlı hale getirmeye" çalışma: deneme = asla arşivlenmez (Kural #6), eski planlayıcı = ay bazlı (bu kural), watch VE yeni to-do list = gün bazlı.
13. **Yeni Bir Drive Tüketicisi = `ahaCollectReferencedDriveIds()`'a Ekleme Zorunlu:** Herhangi bir yeni yer (`aha_*` anahtarı) Drive pointer'ı saklamaya başladığında, bu fonksiyona onu da eklemezsen `ahaReconcileDriveAssets()` yüklenen HER dosyayı "referanssız" sanıp birkaç dakika içinde otomatik siler (bkz. 4-F madde 6 — bu hata bu oturumda deneme PDF'i ve AI sohbet arşivi için gerçekten yaşandı, kod incelemesiyle önceden yakalanıp düzeltildi).
14. **Yeni localStorage Anahtarı = `aha_` Öneki Kullan (Factory Reset Otomatik Yakalar, Ama Drive Yedeği YAKALAMAZ):** `performFullFactoryReset()` (bkz. 4-I) `aha_` önekli HER anahtarı otomatik sildiği için yeni bir anahtar EKLERKEN o fonksiyona dokunmana gerek yok — ama SADECE önek doğruysa. `aha_` önekiyle BAŞLAMAYAN bir anahtar icat edersen (`ytSearchCount` gibi eski bir istisna dışında) hem Factory Reset'ten hem muhtemelen `BACKUP_KEYS`'den kaçar. Kalıcı/kullanıcı tercihi niteliğindeki her yeni anahtarı ayrıca `BACKUP_KEYS`'e (features.js) eklemeyi de unutma — prefix kuralı SADECE sıfırlamayı otomatikleştirir, Drive yedeğine dahil etmek hâlâ elle (bilinçli) bir karardır (bkz. su takibinin `aha_water_v1`'i BACKUP_KEYS'e NEDEN dahil ettiğinin gerekçesi, 4-H).
15. **Not Editöründe Renk/Vurgu İçin ASLA `execCommand('foreColor'/'hiliteColor'/'backColor', ...)` Kullanma:** Bu TAM OLARAK bu oturumda kökten sökülüp atılan bug'dı (bkz. 4-J, Değişiklik Geçmişi) — styleWithCSS hiç etkinleştirilmediği için `<font>` etiketleri üretir, bu da `note-style-span` mimarisiyle tutarsız ikinci bir temsile yol açıp "rengi değiştirdim ama hâlâ eskisi yazılıyor" bug'ına geri döner. Renk/vurgu ile ilgili HERHANGİ bir değişiklik (yeni bir buton, yeni bir davranış) MUTLAKA mevcut `_wrapLastTypedCharWithPendingStyle` (caret) / `_applyStyleToRange` (seçim) motorunun üzerine inşa edilmeli, execCommand'a asla geri dönülmemeli.
16. **Bir DOM Node Referansını Bir "Temizlik/Birleştirme" Adımının ÖTESİNE Taşıyorsan, Onu Açıkça KORU — Sadece Sonradan Doğrulayıp Bailout Etme:** `_mergeAdjacentSameStyleSpans` (4-J), tam da bu oturumda bulunan ÜÇÜNCÜ bir renk bug'ının kök nedeniydi: yeni yazılan karakterin span'ı, komşu AYNI-stildeki bir span'a "emiliyor" (silinip metni komşuya ekleniyor) ve çağıran kod hâlâ ARTIK DOM'DA OLMAYAN eski node referansını (`result.node`) takip etmeye çalışıyordu. Eski kod bunu `content.contains(result.node)` ile sonradan TESPİT EDİYORDU ama tespit ettikten sonra elinde YAPACAK bir şey yoktu — sessizce vazgeçip seçimi tarayıcının kendi (öngörülemeyen) node-silme davranışına bırakıyordu, bu da caret'in beklenmedik bir yere (çoğunlukla bloğun en sonuna) zıplamasına yol açıyordu. Kalıcı çözüm TESPİT DEĞİL, ÖNLEMDİ: `_mergeAdjacentSameStyleSpans` artık opsiyonel bir `protectedNode` parametresi alır ve birleştirme YÖNÜNÜ bu node'un ASLA silinen taraf olmayacağı şekilde otomatik seçer (silinen taraf değişirse metnin ÖNÜNE ekleme olur, bu yüzden fonksiyon çağırana bir `shift` (offset düzeltmesi) döndürür — bunu unutup sadece yön değiştirip offset'i düzeltmemek, karakterin string'in YANLIŞ noktasına yerleşmesine yol açar). **Genel ders:** bir fonksiyon bir node/referansı bir DOM-mutasyon adımının ötesine taşıyorsa ve o adım o node'u kaldırabiliyorsa, "sonradan kontrol edip pes et" yerine mutasyon fonksiyonuna o node'u KORUMASI için açıkça bildir. jsdom ile ADIM ADIM DOM state karşılaştırmasıyla (orijinal vs düzeltilmiş kod, aynı 5+ senaryo, zincirleme/3'lü birleşme dahil) doğrulanmıştır — sadece "hata fırlatmıyor" testi YETMEZ, gerçek caret pozisyonunun/DOM içeriğinin BEKLENENLE birebir eşleştiği doğrulanmalı.

---

## 📜 6. Değişiklik Geçmişi (Bu Güncelleme)

Bu bölüm, mimariyi anlamak için değil, **ne zaman/neden değiştiğini** hatırlamak için kısa bir kronolojik özettir:

*   **Notlar — PDF tekrar-açılamama bug'ı düzeltildi:** Kök neden, tek seferlik arka plan hydrate'inin sessizce başarısız olabilmesi + hiç zaman aşımı olmamasıydı (bkz. 4-F madde 5). Ayrıca aynı PDF'in her oturumda gereksiz yere Drive'a yeniden yüklenmesine yol açan bir dedup-önbellek eksikliği bulunup düzeltildi (madde 4).
*   **Deneme (pratik sınav) PDF'leri Drive'a bağlandı:** Eskiden büyük bir PDF localStorage'a sığmazsa kalıcı olarak SİLİNİYORDU; artık Notlar'daki aynı Drive altyapısını kullanıyor, veri kaybı olmadan otomatik taşınıyor (bkz. 4-E madde 4, 4-F madde 7).
*   **Birleşik Günlük Arşiv eklendi:** Geçmiş (izleme) + planlayıcı, özet (sonsuza dek)/detay (60 gün) ayrımıyla tek bir arşivde birleştirildi; deneme istatistiği hiç kopyalanmadan anlık hesaplanıyor (bkz. 4-D). Eski 30 günlük geçmiş otomatik göç etti.
*   **Proaktif Drive offload eklendi:** Canlı testte flashcard görsellerinin toplamda MB'larca yer kapladığı ama tek tek hiçbirinin eski 40KB eşiğini geçmediği (dolayısıyla hiç offload edilmediği) tespit edildi. Eşik 20KB'ye indirildi ve kota fiilen dolmasa bile tek bir anahtar çok büyükse arka planda hafifleten proaktif bir mekanizma eklendi (bkz. 4-F madde 1,3).
*   **AI sohbet geçmişi güvenceye alındı:** Korumasız (try/catch'siz) kayıt düzeltildi; çok uzayan sohbetler için TIER-2 son çare Drive arşivleme eklendi (bkz. 4-F madde 7).
*   **Google girişi sürtünmesi azaltıldı (token saklanmadan):** Sessiz token yenileme + giriş-anında otomatik tekrar deneme eklendi; ham token kalıcı saklanmadı (bilinçli güvenlik kararı, bkz. 4-G, Altın Kural #10).
*   **Otomatik Drive yedeklemesi eklendi:** Manuel butona ek olarak günde bir sessiz tam yedekleme (bkz. 4-G).
*   **`ahaCollectReferencedDriveIds()` genişletildi:** Deneme ve AI sohbet arşivi Drive tüketicileri reconciliation sweep'ine eklendi — eklenmeseydi kendi yükledikleri dosyalar birkaç dakika içinde otomatik silinecekti (bkz. Altın Kural #13).
*   **İstatistikler bar grafiği bug'ı düzeltildi:** "Son 7/14/30 Gün" butonları üstteki kartları doğru filtreliyordu ama bar grafiği bu seçimi TAMAMEN yok sayıp her zaman en eski arşiv gününden bugüne kadar (60 güne kadar) "Tüm Kayıtlar"ı gösteriyordu — hangi butona basılırsa basılsın grafik hiç değişmiyordu. Kök neden: iki farklı kod yolu (üst kartlar vs. grafik) aynı `statsRange`'i BAĞIMSIZ ve TUTARSIZ yorumluyordu. Artık ikisi de tek bir `_getStatsRangeDays(range)` fonksiyonundan (bugün dahil tam N ardışık takvim günü) besleniyor — sapma yapısal olarak imkansız.
*   **Notlarda renk/vurgu değiştirme bug'ı kökten düzeltildi:** Kullanıcı bir renkte yazarken caret'i hiç oynatmadan başka bir renge geçtiğinde, yeni karakterler ESKİ rengin span'ının İÇİNE sarılmaya devam ediyordu (iç içe geçen span'lar) — bazı durumlarda görsel olarak "rengi değiştirdim ama hâlâ eski renkte yazılıyor" izlenimi veriyordu. Kök neden `_applyPendingNoteStyleToInput`'ın yeni stilli span'ı her zaman `node.parentNode` (yani ESKİ span'ın kendisi) içine eklemesiydi. Çözüm: yeni span artık eski span'ın İÇİNE değil, onunla AYNI SEVİYEYE (kardeş) yerleştiriliyor (`_wrapLastTypedCharWithPendingStyle`); eski span'ın DİĞER stilleri (örn. vurgu rengi) kaybolmasın diye yeni span'a kopyalanıyor. Ayrıca "zaten doğru span, tekrar sarmaya gerek yok" kısayolunun ham string karşılaştırması (tarayıcı renkleri normalize ettiği için pratikte neredeyse hiç eşleşmiyordu) gerçek bir `<span>` üzerinde aynı atamayı yapıp SONUCU okuyan bir "probe" tekniğiyle değiştirildi. jsdom ile izole birim testlerle doğrulandı.
*   **💧 Su Takibi eklendi (`water.js`, yeni bağımsız modül):** Ayarlar'dan açılıp kapatılabilen (varsayılan KAPALI), üst barda AI'ın solunda yer alan, iz bırakmayan günlük su takip widget'ı. Sabit ölçek (örn. 500ml) veya serbest ml girişiyle kayıt tutar, günlük hedef belirlenebilir, her gece yarısı geçmiş bırakmadan sıfırlanır (bkz. 4-H).
*   **🗑 Tam Sıfırlama eklendi (`Ctrl+S+F`):** Ayarlar > ⚠️ Tehlikeli Bölge'den veya klavye kısayolundan tetiklenen, onay isteyen, GERİ ALINAMAZ bir "ilk kuruluma dön" işlemi. `aha_` önekli TÜM anahtarları otomatik (elle liste tutmadan) temizler (bkz. 4-I, Altın Kural #14).
*   **Notlarda renk/vurgu bug'ı — İKİNCİ (kök) düzeltme:** Yukarıdaki ilk düzeltme SADECE caret-collapsed senaryosunu kapsıyordu; kullanıcı geri bildirimiyle sorunun GERÇEK SEÇİLİ METİN üzerinde hâlâ sürdüğü ortaya çıktı. Kök neden bulundu: seçili metinde renk değiştirme hâlâ `document.execCommand('foreColor'/'hiliteColor'/'backColor', ...)` kullanıyordu — bu, `<font>` etiketleri üretip `note-style-span` mimarisiyle TUTARSIZ ikinci bir temsile yol açıyordu. execCommand TAMAMEN kaldırıldı; seçili metin de artık `_applyStyleToRange` ile AYNI note-style-span mimarisine yazılıyor (sınır hizalama + hoisting + ardışık-aynı-stil birleştirme dahil). İki kod yolu artık TEK bir tutarlı temsile çıkıyor (bkz. 4-J, Altın Kural #15). jsdom ile 30+ ek birim testle (iki farklı renkli span'a yayılan kısmi seçim dahil) doğrulandı.
*   **⌨️ Sembol Kısayolları eklendi:** Not editöründeki sembol panelinde herhangi bir sembole ORTA TIK ile küçük bir "dinle ve ata" paneli açılır; kullanıcı bir tuş kombinasyonu belirleyip sembole atar, ardından editör içinde o kombinasyona basmak paneli hiç açmadan sembolü doğrudan ekler (bkz. 4-J).
*   **Notlarda renk/vurgu değiştirme bug'ı — ÜÇÜNCÜ (ve gerçek kök) düzeltme:** İki önceki düzeltmeye rağmen kullanıcı sorunun SÜRDÜĞÜNÜ bildirdi ("bazen çalışıyor bazen çalışmıyor"). Kod okuyarak değil, gerçek tarayıcı DOM'unu taklit eden izole bir test ortamında (jsdom) senaryoları birebir simüle ederek İKİ ayrı, birbirinden bağımsız kök neden bulundu: **(1) Birleşme-sonrası kopma:** Yazılan karakterin span'ı, DOM'da hemen komşusundaki ÖNCEDEN VAR OLAN aynı-stildeki bir span'a otomatik temizlik (`_mergeAdjacentSameStyleSpans`) sırasında "emiliyor" (silinip metni komşuya ekleniyor) ve kod hâlâ artık DOM'da olmayan eski node'u takip etmeye çalışıyordu — tarayıcının kendi node-silme davranışı caret'i öngörülemeyen bir yere (çoğunlukla bloğun en sonuna) fırlatıyordu, kullanıcı yazmaya devam edince karakterler beklenmedik bir konumda beliriyordu. **(2) Ortadan-yazma zıplaması:** Zaten doğru stildeki bir span'ın TAM ORTASINA tıklayıp (örn. bir cümlenin ortasına unutulan bir kelimeyi eklemek için) aynı stili tekrar seçip yazınca, "zaten doğru span" kısayolu caret'i yazılan noktada bırakması gerekirken hep o span'ın EN SONUNA fırlatıyordu. İki bug da hem yazı rengi hem vurgu (arka plan) için AYNI paylaşılan motoru kullandığından kullanıcının "ikisinde de var" gözlemini birebir açıklıyordu; ikisi de belgenin mevcut yapısına/tıklama noktasına bağlı olarak rastgele tetiklendiğinden "bazen oluyor bazen olmuyor" hissini birebir açıklıyordu. Kalıcı çözüm: `_mergeAdjacentSameStyleSpans` artık bir `protectedNode` parametresiyle birleştirme YÖNÜNÜ otomatik seçip yazılan karakterin node'unun ASLA silinmemesini garanti ediyor (offset kayması `shift` dönüş değeriyle telafi ediliyor); kısayol artık `node.textContent.length` yerine gerçek tıklama/yazma offset'ini koruyor (bkz. 4-J, Altın Kural #16). Düzeltme öncesi/sonrası kod aynı jsdom senaryolarından (zincirleme birleşme, vurgu rengi, farklı renge geçiş, seçili metin recolor dahil) yan yana geçirilip DOM içeriğinin ve caret pozisyonunun BEKLENENLE birebir eşleştiği doğrulandı.
*   **📅 Takvim Paneli — sekme sırası ve tam ekran:** "Planlayıcı" sekmesi artık İLK ve panel açıldığında varsayılan aktif sekme (eskiden 3. sıradaydı, "İstatistikler" ilkti — ikisinin yeri değiştirildi). Takvim paneline, AI panelininkiyle (`aha_ai_fullscreen_v1`) BİREBİR AYNI desende bir tam ekran butonu eklendi (`aha_cal_fullscreen_v1`).
*   **İleri-tarihe PLAYLIST/VİDEO ve DENEME planlama bir kenara kondu:** Kullanıcı isteğiyle "Planlayıcı" sekmesinin ana görünümünden kaldırıldı — kod TAMAMEN duruyor (silinmedi), sadece artık çağrılmıyor. Yerine aşağıdaki yeni Günlük Çalışma Planı sistemi geçti (bkz. 4-K, Altın Kural #12).
*   **📋 Planlayıcıya Günlük Çalışma Planı (to-do list) sistemi eklendi:** Bugünden başlayarak kayan bir 30 günlük pencerede, öğrencinin gün gün "30 dk Biyoloji çalış", "2 test çöz", "şu videoyu bitir" veya "Türkçe denemesi çöz" gibi görevler yazabildiği; her göreve opsiyonel ders etiketi, saat ve süre (dakika) eklenebildiği; süre girilen bir göreve tıklayınca özel bir geri sayım zamanlayıcısının açılıp bitince görevi otomatik tamamlandı işaretlediği; hem liste hem tablo görünümü arasında geçiş yapılabildiği; tek tek veya toplu (bugün/önümüzdeki hafta/30 gün) kolayca silinebildiği tam bir sistem (bkz. 4-K). Gün bitince o günün verisi watch verisiyle AYNI birleşik arşive taşınıyor, Drive'a yedekleniyor. jsdom ile 44 fonksiyonel testle doğrulandı.
*   **🖼️ AI'a "Plan Tanıma" sekmesi eklendi:** Görselden-flashcard-üretme akışının aynısını kullanarak, kullanıcının yüklediği bir haftalık plan fotoğrafını (defter, ajanda, ekran görüntüsü) analiz edip gün gün etkinlikleri otomatik olarak Günlük Çalışma Planı'na (yukarıdaki madde) işliyor. Kullanıcının seçtiği haftanın BUGÜNDEN ÖNCEKİ günlerini (ör. bugün Perşembeyse Pazartesi-Çarşamba) otomatik tanıyıp atlıyor, önizlemede hangi günlerin neden eklenmediğini açıkça gösteriyor; kullanıcı eklemeden önce etkinlik bazında onaylayıp/çıkarabiliyor (bkz. 4-L). jsdom ile 33 fonksiyonel testle (gerçek "bugün" tarihiyle çalıştırılıp geçmiş/gelecek gün ayrımının doğruluğu dahil) doğrulandı.

### (2026-09 oturumu)

*   **Notlar — alıntı (blockquote) Enter bug'ı düzeltildi:** bkz. 4-J. jsdom ile 13/13 test.
*   **Deneme — süre girilmiş ama PDF'siz sınavlarda süre yok sayılıyordu:** bkz. 4-E madde 4 BUG FIX. `denemeMountPlayerWrap`'e yeni `'timeronly'` modu eklendi.
*   **Deneme — yanlış "PDF çok büyük" uyarısı düzeltildi:** bkz. 4-E madde 4 BUG FIX. Artık sadece Google girişi yoksa gösteriliyor.
*   **Deneme — PDF önizleme "Bitir" butonu küçük yuvarlak ✕ ikonuna indirilip topbar'ın dışına, bağımsız/ortalı konuma taşındı** — PDF görüntüleyicinin kendi kontrollerini artık örtmüyor.
*   **"Kısayollar" butonu "İpuçları" olarak yeniden adlandırıldı**, kullanıcının verdiği metinle notlardaki renk-değiştirme bug'ı için bir ipucu eklendi; Notlar araç çubuğuna da aynı ipucuna yönlendiren küçük bir bilgi ikonu eklendi.
*   **Ayarlara "Günlük Playlist & Deneme Gizlemesini Durdur" toggle'ı eklendi** (`aha_stop_daily_hide_v1`) — bkz. 4-D. Deneme kategorilerine de playlist kategorileriyle AYNI desende bir `hidden` alanı + manuel göster/gizle toggle'ı eklendi, gece yarısı otomatik gizlemesi bu YENİ ayara bağlandı (bkz. 4-E madde 7).
*   **📋 To-Do List — büyük mimari güncelleme (bkz. 4-K, tamamı yeniden yazıldı):** Eski checklist-tarzı "Liste" görünümü tamamen kaldırıldı; eski basit tablo görünümü onun YERİNE "Liste" oldu (artık sürükle-bırak + ders adı/görev adı renklendirme + kind-farkındalıklı tıklama ile). Tamamen YENİ bir "Tablo" görünümü eklendi: Pazartesi-Pazar haftalık pano (sadece bugünün haftası ve sonrasına gidilebilir), saat sadece görevde GERÇEKTEN varsa gösteriliyor, `|Ders|` + görev adı + süre formatında kartlar. Sürükle-bırak HER İKİ görünümde de saat-çakışma kuralına uyuyor (saatli iki görev birbirine göre kronolojik sırasını koruyor, saatsiz görevler serbest). Video/deneme görev atama TAMAMEN yeniden yazıldı — artık anlamsız "ders adı" metin alanı yerine kendi playlist'lerinden/denemelerinden gerçek bir SEÇİCİ var (video için ayrıca doğrudan YouTube linki yapıştırma seçeneği, kalıcı olmayan otomatik "todolist" playlist'ine dedup'lu ekleme ile); böyle bir göreve tıklayınca video/deneme ana ekranda AÇILIYOR (playlist/kategori gizliyse otomatik açılarak) — notes.js'teki video-referans mimarisiyle birebir aynı desen. jsdom ile 17 yeni saf-mantık testiyle (hafta matematiği, kronolojik sıralama/ekleme, sürükle-bırak saat-çakışma reddi) doğrulandı; eski 44 test de hâlâ geçerli senaryolar için korunuyor.


---

*AnlatHoca, öğrencinin başarısı için tasarlanmış yalın, akıllı ve kararlı bir kişisel asistan olarak kalmalıdır.*

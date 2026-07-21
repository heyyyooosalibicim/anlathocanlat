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
| `aha_ai_key_v1` | Kullanıcının Gemini API Anahtarı | `String` (Şifreli gösterim destekli) |
| `aha_ai_chat_v1` | AI Asistan sohbet geçmişi | `JSON Array` |
| `aha_flashcards_v1` | Kullanıcının ürettiği tüm Flashcardlar | `JSON Array` |
| `aha_flashcards_cats_v1` | Flashcard Ders ve Konu kategorileri | `JSON Array` |

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

### ⏱ D. Kronometre ve Midnight Reset (Gece Yarısı Sıfırlama)
*   **Süreklilik:** Kronometre sayımı devam ederken sayfa yenilense dahi `swStartTime` ve `swAccum` verileri sayesinde zaman kaybı yaşanmaz.
*   **Midnight Reset:** Gece saat `00:00` olduğunda gün değişimi algılanır. Öğrencinin bir önceki güne ait playlist çalışma durumu arşivlenerek gizlenir, yeni gün temiz bir sayfa ile karşılanır. Bu, psikolojik olarak öğrenciye her gün yeni bir başlangıç sunma felsefesinin ürünüdür.

---

## 🤖 5. Gelecekteki AI Geliştiriciler İçin Altın Kurallar (Development Guardrails)

Eğer bu uygulamanın kodlarını değiştirecek, yeni özellikler ekleyecek veya hataları giderecek bir Yapay Zeka isen, **aşağıdaki kurallara kayıtsız şartsız uymalısın:**

1.  **State Senkronizasyonu:** Kod üzerinde veri (playlist, kart, kategori, not) modifikasyonu yapan her fonksiyondan sonra mutlaka `saveAll()` veya ilgili save fonksiyonunu (`saveAiFlashcards`, `saveAiCategories` vb.) çağırmalısın. Hemen ardından arayüzü güncellemek için ilgili render fonksiyonunu (örn: `renderPlaylist()`, `renderAiBody()`) tetiklemelisin.
2.  **Event Propagation (Olay Yayılması):** Liste elemanlarındaki butonlara (silme, kategori değiştirme, check) tıklandığında üst kapsayıcının tıklama olayının tetiklenmemesi için mutlaka `e.stopPropagation()` kullanmalısın. Aksi takdirde kart silinirken video oynatılmaya başlanabilir.
3.  **WeasyPrint ve HTML Kısıtlamaları (PDF çıktısı alınacaksa):** Arayüz elemanlarında `display: flex` veya `display: grid` kullanımından kaçın, Weasyprint PDF motoru bunları desteklemez. Tablo yapısı veya blok yerleşimleri tercih et.
4.  **API Anahtarı Güvenliği:** API anahtarlarını hiçbir zaman düz metin (plain text) olarak loglama veya dışarı aktarma. Maskeleme işlevlerini (`●●●●●●●●`) bozma.
5.  **Çekirdek Felsefeyi Koru:** Ekleyeceğin her yeni özellik öğrencinin odakta kalmasını desteklemelidir. Uygulamayı harici web sitelerine yönlendiren linkler yerine, özelliklerin uygulama içinde (in-app) çalışmasını sağlayan gömülü sistemleri tercih et.

---

*AnlatHoca, öğrencinin başarısı için tasarlanmış yalın, akıllı ve kararlı bir kişisel asistan olarak kalmalıdır.*

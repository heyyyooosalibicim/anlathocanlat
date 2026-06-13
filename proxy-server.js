/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   YouTube API Proxy Sunucusu — "Anlat Hoca Anlat"           ║
 * ║   API anahtarını frontend'den gizler, sunucu tarafında ekler ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Kurulum:
 *   npm install express node-fetch cors dotenv
 *
 * .env dosyası oluşturun (proxy-server.js ile aynı klasörde):
 *   YT_API_KEY=AIzaSyDXjuJFxOq2xuG9_9nZLCApuO3kylrfKwk
 *   ALLOWED_ORIGIN=https://sizin-siteniz.com
 *   PORT=3001
 *
 * Çalıştırma:
 *   node proxy-server.js
 *
 * index.html'deki YT_PROXY_BASE değişkenini ayarlayın:
 *   - Lokal geliştirme : var YT_PROXY_BASE = 'http://localhost:3001/yt-api';
 *   - Üretim (aynı origin): var YT_PROXY_BASE = '/yt-api';
 */

require('dotenv').config();

const express  = require('express');
const fetch    = require('node-fetch');
const cors     = require('cors');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Güvenlik: Sadece kendi sitenizden (veya yerel ağdan) gelen isteklere izin verin ──
 * - Üretimde ALLOWED_ORIGIN'i tam adresinize ayarlayın (örn. https://kullanici.github.io)
 * - Lokal geliştirmede localhost / 127.0.0.1 / 192.168.x.x / 10.x.x.x herhangi bir port
 *   ile otomatik çalışır — serve, Live Server, telefon üzerinden LAN testi vs.
 *   port veya IP değiştikçe .env'i tekrar düzenlemenize gerek kalmaz.
 */
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5500';
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use(cors({
  origin: function(origin, callback) {
    // origin yoksa (same-origin, curl, Postman vs.) geçir
    if (!origin || origin === ALLOWED_ORIGIN || LOCAL_ORIGIN_RE.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS: Bu kaynağa izin verilmiyor: ' + origin));
    }
  }
}));

/* ── Ana proxy endpoint'i ── */
app.get('/yt-api', async (req, res) => {
  const ytPath = req.query.path;

  if (!ytPath || !ytPath.startsWith('/youtube/v3/')) {
    return res.status(400).json({ error: 'Geçersiz API yolu.' });
  }

  // Whitelist: izin verilen YouTube Data API endpoint'leri
  const ALLOWED_PATHS = [
    '/youtube/v3/videos',
    '/youtube/v3/playlists',
    '/youtube/v3/playlistItems',
    '/youtube/v3/channels',
    '/youtube/v3/search',
  ];

  if (!ALLOWED_PATHS.includes(ytPath)) {
    return res.status(403).json({ error: 'Bu endpoint\'e izin verilmiyor.' });
  }

  // Gelen query parametrelerini al, path'i çıkar, key'i sunucudan ekle
  const params = new URLSearchParams(req.query);
  params.delete('path');                              // path parametresini çıkar
  params.set('key', process.env.YT_API_KEY || '');   // API anahtarını sunucu tarafında ekle

  const targetUrl = `https://www.googleapis.com${ytPath}?${params.toString()}`;

  try {
    const ytRes = await fetch(targetUrl);
    const data  = await ytRes.json();
    res.status(ytRes.status).json(data);
  } catch (err) {
    console.error('[Proxy Hatası]', err.message);
    res.status(502).json({ error: 'YouTube API\'ye bağlanılamadı.' });
  }
});

/* ── Sağlık kontrolü ── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ── CORS / genel hata yakalayıcı (en sonda olmalı) ──
 * cors() bir Error ile next() çağırırsa Express varsayılan olarak 500 döner
 * ve hiç CORS header'ı eklemez. Burada bunu yakalayıp temiz bir 403 JSON'a
 * çeviriyoruz, böylece terminalde de ne olduğu açıkça görünür.
 */
app.use((err, req, res, next) => {
  if (err && err.message && err.message.indexOf('CORS') === 0) {
    console.error('[CORS Engellendi]', err.message);
    console.error('  → İzin vermek için .env içindeki ALLOWED_ORIGIN değerini bu adresle güncelleyin.');
    return res.status(403).json({ error: err.message });
  }
  console.error('[Beklenmeyen Hata]', err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

app.listen(PORT, () => {
  console.log(`✅ YouTube API Proxy çalışıyor → http://localhost:${PORT}`);
  console.log(`   API anahtarı: ${process.env.YT_API_KEY ? '✓ Yüklendi' : '✗ YOK (.env dosyasını kontrol edin)'}`);
});

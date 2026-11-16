// Patikat sunucusu: public/ klasorunu yayinlar ve Gunun Seferi siralamasini MongoDB'de tutar.
// Ayni Wi-Fi'deki telefondan da acilabilir. MongoDB yoksa oyun yine calisir, yalnizca siralama kapanir.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8080;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const CATS = ['sarman', 'tekir', 'pamuk', 'kara', 'siyam', 'benek', 'van'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

// ---------- MongoDB ----------
let daily = null;
(async () => {
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    daily = client.db('duvarzipla').collection('daily');
    await daily.createIndex({ date: 1, id: 1 }, { unique: true });
    await daily.createIndex({ date: 1, score: -1 });
    console.log(`MongoDB bağlı (${MONGO_URI}): sıralama açık.`);
  } catch (e) {
    console.log('MongoDB bağlanamadı, sıralama kapalı:', e.message);
  }
})();

// ---------- Yardimcilar ----------
function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}
function readBody(req, limit = 2048) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('cok buyuk')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function allowedDates() { // saat farki olan oyunculari reddetmemek icin dun/bugun/yarin
  const now = Date.now();
  return [-1, 0, 1].map((k) => dayKey(new Date(now + k * 86400000)));
}
const lastPost = new Map(); // basit hiz siniri: IP basina 2 sn

async function api(req, res, url) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, db: !!daily });
  if (url.pathname !== '/api/daily') return json(res, 404, { error: 'bulunamadi' });
  if (!daily) return json(res, 503, { error: 'veritabani yok' });

  if (req.method === 'GET') {
    const date = url.searchParams.get('date') || dayKey(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res, 400, { error: 'tarih' });
    const rows = await daily.find({ date }, { projection: { _id: 0, id: 1, name: 1, score: 1, meters: 1, cat: 1 } })
      .sort({ score: -1 }).limit(20).toArray();
    return json(res, 200, rows);
  }

  if (req.method === 'POST') {
    const ip = req.socket.remoteAddress || '';
    const now = Date.now();
    if (now - (lastPost.get(ip) || 0) < 2000) return json(res, 429, { error: 'yavas' });
    lastPost.set(ip, now);
    let b;
    try { b = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: 'gecersiz' }); }
    const id = String(b.id || '');
    const name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'İsimsiz Kedi';
    const score = Number(b.score), meters = Number(b.meters);
    const date = String(b.date || '');
    const cat = CATS.includes(b.cat) ? b.cat : 'sarman';
    if (!/^[a-f0-9]{16}$/.test(id)) return json(res, 400, { error: 'id' });
    if (!Number.isInteger(score) || score < 0 || score > 200000) return json(res, 400, { error: 'skor' });
    if (!Number.isInteger(meters) || meters < 0 || meters > 50000) return json(res, 400, { error: 'mesafe' });
    if (!allowedDates().includes(date)) return json(res, 400, { error: 'tarih' });
    await daily.updateOne(
      { date, id },
      { $max: { score, meters }, $set: { name, cat, updated: new Date() } },
      { upsert: true },
    );
    return json(res, 200, { ok: true });
  }
  return json(res, 405, { error: 'yontem' });
}

// ---------- Sunucu ----------
http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { res.writeHead(400); return res.end(); }
  if (url.pathname.startsWith('/api/')) {
    try { return await api(req, res, url); } catch (e) { return json(res, 500, { error: 'sunucu' }); }
  }
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bulunamadı'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('Patikat çalışıyor:');
  console.log(`  Bu bilgisayar : http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  Telefon (aynı Wi-Fi): http://${a.address}:${PORT}`);
    }
  }
  console.log('Kapatmak için bu pencereyi kapatın veya Ctrl+C.');
});

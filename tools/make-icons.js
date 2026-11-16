// Uygulama ikonlarini (PNG) bagimliliksiz uretir: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SKY_T = hex('#2e3657'), SKY_B = hex('#6e5f80'), WALLC = hex('#3a3448'), WIN = hex('#e8c27a');
const MOON = hex('#efe6c8'), FUR = hex('#e3a15e'), FUR2 = hex('#c47f3f'), BELLY = hex('#f4dcc0');
const EAR_IN = hex('#e8a0a8'), EYE = hex('#9bc46a'), PUPIL = hex('#1d1a1f'), NOSE = hex('#e48a9a');

const inEll = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
function inTri(px, py, ax, ay, bx, by, cx, cy) {
  const s = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  const t = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) return false;
  const d = (cx - bx) * (py - by) - (cy - by) * (px - bx);
  return d === 0 || (d < 0) === (s + t <= 0);
}

// Normalize koordinatta (0..1) bir noktanin rengi: aksam gokyuzunde sarman kedi yuzu
function colorAt(x, y) {
  // gozler, burun, agiz cevresi
  for (const ex of [0.4, 0.6]) {
    if (inEll(x, y, ex, 0.55, 0.012, 0.042)) return PUPIL;
    if (inEll(x, y, ex, 0.55, 0.045, 0.055)) return EYE;
  }
  if (inTri(x, y, 0.47, 0.63, 0.53, 0.63, 0.5, 0.665)) return NOSE;
  if (inEll(x, y, 0.5, 0.68, 0.1, 0.055)) return BELLY;
  // alin cizgileri
  for (const sx of [0.465, 0.5, 0.535]) if (Math.abs(x - sx) < 0.009 && y > 0.36 && y < 0.44) return FUR2;
  // ic kulak, kulak, bas
  if (inTri(x, y, 0.32, 0.4, 0.34, 0.25, 0.44, 0.36) || inTri(x, y, 0.68, 0.4, 0.66, 0.25, 0.56, 0.36)) return EAR_IN;
  if (inTri(x, y, 0.27, 0.46, 0.31, 0.19, 0.48, 0.36) || inTri(x, y, 0.73, 0.46, 0.69, 0.19, 0.52, 0.36)) return FUR;
  if (inEll(x, y, 0.5, 0.57, 0.25, 0.22)) return FUR;
  // ay, duvarlar ve pencereler
  if (Math.hypot(x - 0.79, y - 0.17) < 0.07) return MOON;
  if (x < 0.1 || x > 0.9) {
    const wx = x < 0.1 ? x : x - 0.9;
    if (wx > 0.02 && wx < 0.08 && (y % 0.3) > 0.08 && (y % 0.3) < 0.18) return WIN;
    return WALLC;
  }
  return SKY_T.map((v, i) => Math.round(v + (SKY_B[i] - v) * y));
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const SS = 3; // kenar yumusatma icin alt ornekleme
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    const row = py * (size * 4 + 1);
    raw[row] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = colorAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const i = row + 1 + px * 4, n = SS * SS;
      raw[i] = Math.round(r / n); raw[i + 1] = Math.round(g / n); raw[i + 2] = Math.round(b / n); raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(out, name), png(size));
  console.log('olusturuldu:', name);
}

// Android uygulama ikonlari (android klasoru varsa)
const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
if (fs.existsSync(res)) {
  const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, s] of Object.entries(dens)) {
    const dir = path.join(res, 'mipmap-' + d);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), png(s));
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), png(s));
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), png(Math.round(s * 2.25)));
  }
  console.log('olusturuldu: Android ikonlari');
}

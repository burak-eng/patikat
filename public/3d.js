// Patikat 3B deneme surumu: kedi arkadan gorulur, uc seritli catilarda kosar.
// Kontroller: kaydir (sol/sag = serit, yukari = zipla, asagi = kay) ya da ok tuslari.
import * as THREE from './lib/three.module.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo'); // test: kendi kendine oynar
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ================= Sahne =================
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance', preserveDrawingBuffer: DEMO });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = false; // golgeler: kedinin altinda yumusak leke (telefonu yormaz)

const scene = new THREE.Scene();
const FOG = 0xf2d8cc;
scene.fog = new THREE.Fog(FOG, 48, 165); // engeller uzaktan net gorunsun

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
// gokyuzu: yumusak pastel gecis
scene.background = canvasTex(4, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#86bde6'); gr.addColorStop(0.55, '#cfe1f0'); gr.addColorStop(1, '#f6dccb');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xfff3e4, 0xb8a6cc, 1.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4c4, 2.6);
sun.castShadow = false;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.0008;
sun.shadow.radius = 4;
scene.add(sun, sun.target);

// ================= Dokular ve malzemeler =================
const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
function facadeTex(wall, trim, shutter, variant) { // 2 pencere x 2 kat (5 x 6 birim)
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.035})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, 246, w, 8); g.fillRect(0, 502, w, 8); // kat silmesi
    for (let fx = 0; fx < 2; fx++) for (let fy = 0; fy < 2; fy++) {
      const x = fx * 256 + 70, y = fy * 256 + 44, ww = 116, wh = 156, k = fx + fy * 2 + variant;
      if (k % 4 === 1) { g.fillStyle = shutter; g.fillRect(x - 50, y - 8, 36, wh + 16); g.fillRect(x + ww + 14, y - 8, 36, wh + 16); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let s = y; s < y + wh + 8; s += 12) { g.fillRect(x - 50, s, 36, 3); g.fillRect(x + ww + 14, s, 36, 3); } }
      g.fillStyle = trim; g.fillRect(x - 12, y - 12, ww + 24, wh + 24);
      const gr = g.createLinearGradient(0, y, 0, y + wh); gr.addColorStop(0, '#d7ecf8'); gr.addColorStop(1, '#93b6d2');
      g.fillStyle = gr; g.fillRect(x, y, ww, wh);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(x + 14, y + wh - 18); g.lineTo(x + 58, y + 12); g.lineTo(x + 80, y + 12); g.lineTo(x + 36, y + wh - 18); g.closePath(); g.fill();
      g.fillStyle = trim; g.fillRect(x + ww / 2 - 5, y, 10, wh); g.fillRect(x, y + 52, ww, 8);
      g.fillStyle = shade(trim, 0.85); g.fillRect(x - 20, y + wh + 12, ww + 40, 14); // pervaz
      if (k % 3 === 0) { // cicekli saksi
        g.fillStyle = '#c47452'; g.fillRect(x - 6, y + wh - 10, ww + 12, 24);
        for (let i = 0; i < 9; i++) { g.fillStyle = ['#f28fa8', '#f6c35b', '#b99be8', '#ffffff'][(i + k) % 4]; g.beginPath(); g.arc(x + 6 + i * 13, y + wh - 14 - (i % 2) * 6, 8, 0, Math.PI * 2); g.fill(); }
      }
      if (k % 4 === 2) { g.strokeStyle = 'rgba(70,60,70,0.55)'; g.lineWidth = 4; g.strokeRect(x - 22, y + wh - 40, ww + 44, 44); for (let bx = x - 18; bx < x + ww + 22; bx += 12) { g.beginPath(); g.moveTo(bx, y + wh - 40); g.lineTo(bx, y + wh + 4); g.stroke(); } } // balkon korkulugu
    }
  });
}
const PALETTE = [['#f1d6c0', '#fff8ee', '#7fa6c9'], ['#e9c2b4', '#fbf1e6', '#c9887a'], ['#f3e2c2', '#ffffff', '#9a86c4'], ['#d6dfe9', '#ffffff', '#c97a7a'], ['#efcfd6', '#fff6f2', '#7fa6c9'], ['#e3d5ec', '#ffffff', '#d9a05f']];
const FACADES = PALETTE.map(([w, t, s], i) => new THREE.MeshLambertMaterial({ map: facadeTex(w, t, s, i) })); // binalar: en hafif isik modeli
const roofTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d8cfc4'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,40,30'},${Math.random() * 0.07})`; g.fillRect(x + 2, y + 2, 60, 60); }
  g.fillStyle = 'rgba(80,60,50,0.12)'; for (let i = 0; i <= w; i += 64) { g.fillRect(i - 1, 0, 2, h); g.fillRect(0, i - 1, w, 2); }
});
const ROOF = new THREE.MeshLambertMaterial({ map: roofTex });
const EDGE = new THREE.MeshStandardMaterial({ color: 0xc98d72, roughness: 0.9 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x9d8f9c, roughness: 1 });
const LANE_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });

// kutu: yuzlerin dokusu dunya olcusunde tekrarlanir (tu x tv birimde bir)
const geoCache = new Map();
function boxGeo(w, h, d, tu = 5, tv = 6) {
  const key = [w, h, d, tu, tv].map((v) => v.toFixed(2)).join('|');
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, (uv.getX(k) * dims[f][0]) / tu, (uv.getY(k) * dims[f][1]) / tv); }
  geoCache.set(key, g);
  return g;
}

// ================= Kedi (tombul, yumusak tuylu) =================
function furMat(color, sheen, map) {
  return new THREE.MeshStandardMaterial({ color, map: map || null, roughness: 0.92, emissive: new THREE.Color(sheen), emissiveIntensity: 0.06 });
}
const tabbyTex = canvasTex(512, 256, (g, w, h) => { // kure kutuplari omurga ekseninde: halkalar = tekir cizgileri, u=0.75 sirt
  for (let x = 0; x < w; x++) {
    const u = x / w, back = Math.max(0, Math.cos((u - 0.75) * Math.PI * 2)); // sirtta 1, karinda 0
    const c = new THREE.Color(0xf4dcc2).lerp(new THREE.Color(0xe39a52), Math.min(1, 0.35 + back * 0.9));
    g.fillStyle = '#' + c.getHexString(); g.fillRect(x, 0, 1, h);
  }
  for (let i = 0; i < 9; i++) { // dalgali, sirtta koyu, yanlarda solan cizgiler
    const y0 = 30 + i * 23 + rand(-3, 3), th = rand(5, 9);
    for (let x = 0; x < w; x++) {
      const u = x / w, back = Math.max(0, Math.cos((u - 0.75) * Math.PI * 2));
      if (back < 0.25) continue;
      g.fillStyle = `rgba(176,104,46,${(0.75 * (back - 0.25)).toFixed(3)})`;
      g.fillRect(x, y0 + Math.sin(u * 30 + i) * 3, 1, th * back);
    }
  }
});
tabbyTex.wrapT = THREE.ClampToEdgeWrapping;

const sphereCache = new Map();
function sphere(r, mat, ws = 18, hs = 12) { const k = r.toFixed(3) + '|' + ws; if (!sphereCache.has(k)) sphereCache.set(k, new THREE.SphereGeometry(r, ws, hs)); return new THREE.Mesh(sphereCache.get(k), mat); }
function makeCat() {
  const C = { fur: furMat(0xffffff, 0xffe6c8, tabbyTex), plain: furMat(0xe8a25c, 0xffe2bf), cream: furMat(0xf6e4cf, 0xffffff), pink: new THREE.MeshStandardMaterial({ color: 0xe8a0aa, roughness: 0.6 }),
    eye: new THREE.MeshStandardMaterial({ color: 0x2a3a24, roughness: 0.15, metalness: 0.1 }), white: new THREE.MeshBasicMaterial({ color: 0xffffff }), ring: furMat(0xc9813f, 0xffd9b0) };
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  // govde: kutuplari omurga boyunca, tombul
  const torsoGeo = new THREE.SphereGeometry(0.5, 40, 28); torsoGeo.rotateX(Math.PI / 2);
  const torso = new THREE.Mesh(torsoGeo, C.fur); torso.castShadow = true;
  torso.scale.set(0.82, 0.74, 1.08); torso.position.set(0, 0.5, 0.02); body.add(torso);
  const rump = sphere(0.36, C.plain); rump.scale.set(1.05, 0.95, 0.9); rump.position.set(0, 0.5, 0.3); body.add(rump); // tombul kalca
  const chest = sphere(0.3, C.cream); chest.scale.set(1, 1, 0.8); chest.position.set(0, 0.47, -0.4); body.add(chest);
  // bas
  const head = new THREE.Group(); head.position.set(0, 0.92, -0.46); head.scale.setScalar(1.2); body.add(head); // buyuk yuvarlak bas (Kedim ekranindaki kedi gibi)
  const skullGeo = new THREE.SphereGeometry(0.31, 36, 26); skullGeo.rotateX(Math.PI / 2);
  const skull = new THREE.Mesh(skullGeo, C.fur); skull.castShadow = true; skull.scale.set(1.12, 0.96, 0.98); head.add(skull);
  for (const s of [-1, 1]) {
    const cheek = sphere(0.15, C.plain); cheek.position.set(s * 0.2, -0.09, -0.08); cheek.scale.set(1, 0.85, 1); head.add(cheek); // yanak tuyleri
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 16), C.plain); ear.castShadow = true;
    ear.position.set(s * 0.17, 0.27, 0.0); ear.rotation.z = -s * 0.32; head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 12), C.pink); inner.position.set(s * 0.165, 0.25, -0.045); inner.rotation.z = -s * 0.32; head.add(inner);
    const eye = sphere(0.09, C.eye, 20, 14); eye.position.set(s * 0.13, 0.04, -0.25); eye.scale.set(1, 1.2, 0.6); head.add(eye); // iri gozler
    const glint = sphere(0.022, C.white, 8, 6); glint.position.set(s * 0.13 + 0.02, 0.08, -0.305); head.add(glint);
    const muzzle = sphere(0.085, C.cream); muzzle.position.set(s * 0.055, -0.1, -0.27); head.add(muzzle);
  }
  const nose = sphere(0.035, C.pink, 12, 8); nose.position.set(0, -0.04, -0.33); nose.scale.set(1.2, 0.8, 0.8); head.add(nose);
  // bacaklar: omuz ve kalca eklemleri (tek govdeye bagli: on ve arka birlikte hareket eder)
  const legs = [];
  const mkLeg = (x, z, front) => {
    const pivot = new THREE.Group(); pivot.position.set(x, front ? 0.36 : 0.4, z); body.add(pivot);
    if (!front) { const thigh = sphere(0.17, C.plain); thigh.position.set(0, -0.02, 0.02); thigh.scale.set(0.8, 1.1, 1.05); pivot.add(thigh); }
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.2, 6, 14), C.plain); leg.castShadow = true; leg.position.y = -0.17; pivot.add(leg);
    const paw = sphere(0.1, C.cream, 16, 12); paw.scale.set(1, 0.7, 1.25); paw.position.set(0, -0.34, -0.03); pivot.add(paw);
    legs.push(pivot); return pivot;
  };
  mkLeg(-0.17, -0.3, true); mkLeg(0.17, -0.3, true); mkLeg(-0.19, 0.3, false); mkLeg(0.19, 0.3, false);
  // kuyruk: kure zinciri, her karede egri boyunca dizilir
  const tail = [];
  for (let i = 0; i < 16; i++) { const k = i / 15, s = sphere(0.095 - k * 0.04, Math.floor(i / 2) % 3 === 1 ? C.ring : C.plain, 12, 8); body.add(s); tail.push(s); } // kabarik kuyruk
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  return { root, body, head, legs, tail, torso };
}

function makeDog() { // Karabas: kangal. Derin gogus, ince bel, eklemli bacaklar, siyah maske, sarkik kulak, kivrik kuyruk
  const fur = furMat(0xcfa06a, 0xf5ddb5), light = furMat(0xe9d2ad, 0xffffff), dark = new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.85 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 }), eyeM = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.2 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const front = new THREE.Group(); front.position.set(0, 0.98, -0.32); body.add(front); // omuzlar (omurga burada esner)
  const back = new THREE.Group(); back.position.set(0, 0.95, 0.42); body.add(back);    // kalca
  const S = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, parent = body) => { const k = sphere(r, m, 20, 14); k.position.set(x, y, z); k.scale.set(sx, sy, sz); parent.add(k); return k; };
  S(0.36, fur, 0, 0, 0, 0.95, 1.08, 1.1, front);          // gogus kafesi
  S(0.25, light, 0, -0.2, -0.22, 1, 1, 1, front);         // on gogus (acik renk)
  S(0.3, fur, 0, 0.02, 0, 0.95, 0.95, 1.1, back);          // kalca
  const waist = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.45, 6, 14), fur); waist.rotation.x = Math.PI / 2; waist.position.set(0, 0.93, 0.05); waist.scale.set(1, 1, 0.85); body.add(waist); // ince bel
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.28, 6, 12), fur); neck.position.set(0, 0.24, -0.3); neck.rotation.x = -0.85; front.add(neck);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), red); collar.position.set(0, 0.2, -0.27); collar.rotation.x = Math.PI / 2 - 0.85; front.add(collar);
  // bas
  const head = new THREE.Group(); head.position.set(0, 0.45, -0.52); front.add(head);
  S(0.22, fur, 0, 0, 0, 0.95, 0.9, 1.1, head);
  const muzzle = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.18, 6, 12), dark); muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, -0.05, -0.24); head.add(muzzle);
  S(0.14, dark, 0, -0.01, -0.12, 1.1, 0.85, 0.9, head);    // siyah maske
  S(0.05, dark, 0, -0.01, -0.39, 1.1, 0.8, 0.9, head);     // burun
  for (const s of [-1, 1]) {
    S(0.03, eyeM, s * 0.1, 0.06, -0.15, 1, 1, 0.6, head);
    const ear = S(0.11, dark, s * 0.18, -0.02, 0.02, 0.4, 1.25, 0.85, head); ear.rotation.z = s * 0.25; ear.userData.s = s;
  }
  const jaw = new THREE.Group(); jaw.position.set(0, -0.1, -0.12); head.add(jaw); // havlarken acilir
  const jm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 6, 10), dark); jm.rotation.x = Math.PI / 2; jm.position.set(0, -0.02, -0.13); jaw.add(jm);
  const tongue = S(0.05, red, 0, 0.01, -0.18, 0.8, 0.3, 1.4, jaw);
  // bacaklar: ust ve alt parca (diz/dirsek ve topuk eklemi)
  const legs = [];
  const mkLeg = (parent, x, y, z, hind) => {
    const up = new THREE.Group(); up.position.set(x, y, z); parent.add(up);
    if (hind) S(0.16, fur, 0, -0.05, 0.02, 0.7, 1.25, 1, up);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(hind ? 0.085 : 0.075, 0.3, 6, 10), fur); a.position.y = -0.22; up.add(a);
    const low = new THREE.Group(); low.position.y = -0.42; up.add(low);
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.28, 6, 10), hind ? fur : light); b.position.y = -0.18; low.add(b);
    S(0.075, light, 0, -0.36, -0.04, 1, 0.7, 1.3, low);
    legs.push({ up, low, hind });
  };
  mkLeg(front, -0.17, -0.12, 0, false); mkLeg(front, 0.17, -0.12, 0, false);
  mkLeg(back, -0.17, -0.08, 0.04, true); mkLeg(back, 0.17, -0.08, 0.04, true);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.055, 8, 18, Math.PI * 1.35), fur); tail.position.set(0, 0.28, 0.3); tail.rotation.set(0, Math.PI / 2, -0.3); back.add(tail); // sirta kivrik
  return { root, body, front, back, legs, head, jaw, tongue, tail };
}

// ================= Engeller ve balik =================
// Her engel turu ne yaptirir: zipla (jump), kay (slide), serit degistir (block), ustune cik (plat)
// Canli renkler ve hafif oz isik: pastel catilarda uzaktan secilsin
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.12, ...o });
const M = {
  basket: mat(0xe0663f), cloth: [0x4f86c6, 0xe8607a, 0xf2b630, 0x8a6bd1, 0xffffff].map((c) => mat(c, { side: THREE.DoubleSide, emissiveIntensity: 0.08 })),
  ac: mat(0xd5dbe3, { emissiveIntensity: 0.05 }), grill: new THREE.MeshStandardMaterial({ color: 0x3d434f, roughness: 0.5, metalness: 0.5 }),
  pole: new THREE.MeshStandardMaterial({ color: 0x5f6675, roughness: 0.45, metalness: 0.6 }), rope: new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 1 }),
  sign: [0xd8473f, 0x2f6fc0, 0xe08a1e].map((c) => mat(c)), white: mat(0xffffff, { emissiveIntensity: 0.25 }),
  fish: new THREE.MeshStandardMaterial({ color: 0xf3b04f, roughness: 0.3, metalness: 0.2, emissive: 0x7a4200, emissiveIntensity: 0.35 }),
  chimney: new THREE.MeshStandardMaterial({ color: 0xb98a78, roughness: 1 }), tank: mat(0x7f97b0, { metalness: 0.4, emissiveIntensity: 0.06 }),
  roomba: mat(0x3a3f4b, { emissiveIntensity: 0.03 }), roombaTop: mat(0xe05a5a), led: new THREE.MeshBasicMaterial({ color: 0x7dff9a }),
  pipe: mat(0xc0563a, { metalness: 0.3 }), hazard: mat(0xf2c230, { emissiveIntensity: 0.2 }), dark: mat(0x2b2b30, { emissiveIntensity: 0 }),
  beam: mat(0xb9773d), dish: mat(0xf0f2f5, { emissiveIntensity: 0.12 }),
  water: new THREE.MeshStandardMaterial({ color: 0x8ec9ff, transparent: true, opacity: 0.75, roughness: 0.1, emissive: 0x3a7ac0, emissiveIntensity: 0.35 }),
  room: mat(0xf0dcc4, { emissiveIntensity: 0.05 }), roomRoof: mat(0xc0563a), ramp: mat(0x9a7b5c, { emissiveIntensity: 0.05 }), door: mat(0x6b4a3a, { emissiveIntensity: 0.03 }), win: mat(0x9fd0f0, { emissiveIntensity: 0.35 }),
};
const G = {
  basket: new THREE.CylinderGeometry(0.36, 0.3, 0.58, 20), clothesPile: new THREE.SphereGeometry(0.32, 16, 10),
  acBox: new THREE.BoxGeometry(0.98, 0.7, 0.62), fan: new THREE.CylinderGeometry(0.23, 0.23, 0.04, 20),
  post: new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8), beamBar: new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8), board: new THREE.BoxGeometry(1.05, 0.74, 0.07), boardEdge: new THREE.BoxGeometry(1.15, 0.84, 0.05),
  shirt: new THREE.PlaneGeometry(0.42, 0.62), sock: new THREE.PlaneGeometry(0.16, 0.5),
  fishBody: new THREE.SphereGeometry(0.17, 12, 8), rope: new THREE.CylinderGeometry(0.012, 0.012, 4.5, 6), tank: new THREE.CylinderGeometry(0.3, 0.3, 0.7, 14), fishTail: new THREE.ConeGeometry(0.12, 0.18, 4),
  roomba: new THREE.CylinderGeometry(0.42, 0.44, 0.24, 24), roombaTop: new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), led: new THREE.SphereGeometry(0.04, 8, 6),
  pipeLong: new THREE.CylinderGeometry(0.13, 0.13, 4.4, 14), pipeFoot: new THREE.BoxGeometry(0.18, 0.42, 0.18),
  beamLong: new THREE.BoxGeometry(4.4, 0.3, 0.32), stripe: new THREE.BoxGeometry(0.22, 0.31, 0.33),
  dish: new THREE.SphereGeometry(0.62, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2.6), dishArm: new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6),
  bigTank: new THREE.CylinderGeometry(0.52, 0.52, 1.6, 22), tankCap: new THREE.ConeGeometry(0.55, 0.3, 22), tankLeg: new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6),
  nozzle: new THREE.CylinderGeometry(0.07, 0.1, 0.18, 10), arc: new THREE.TorusGeometry(0.62, 0.07, 8, 22, Math.PI), drip: new THREE.SphereGeometry(0.05, 8, 6),
};
G.fishBody.scale(1.6, 0.85, 0.5);
const LANES = [-1.3, 0, 1.3];
const ROOF_W = 4.8, RAMP = 3.2;
const OBS = {
  basket: { kind: 'jump', h: 0.64, name: 'Sepete takıldın!' },
  roomba: { kind: 'jump', h: 0.38, name: 'Robot süpürgeye çarptın!' },
  pipe:   { kind: 'jump', h: 0.55, full: true, name: 'Boruya takıldın!' },
  jet:    { kind: 'jump', h: 0.95, name: 'Fıskiyede ıslandın!' },
  sign:   { kind: 'slide', low: 0.55, name: 'Tabelaya çarptın!' },
  line:   { kind: 'slide', low: 0.55, full: true, name: 'Çamaşır ipine takıldın!' },
  beam:   { kind: 'slide', low: 0.62, full: true, name: 'Kirişe çarptın!' },
  ac:     { kind: 'block', name: 'Klimaya çarptın!' },
  dish:   { kind: 'block', name: 'Çanak antene çarptın!' },
  tank:   { kind: 'block', name: 'Su deposuna çarptın!' },
  room:   { kind: 'plat', top: 1.15, name: 'Çatı odasına çarptın!' },
};
const JET_T = 2.6; // fiskiye: 1.3 sn acik, 1.3 sn kapali
const jetOn = (o) => ((clockS + o.phase) % JET_T) < JET_T / 2;
let clockS = 0;

function makeObstacle(type, lane, ex = {}) {
  const g = new THREE.Group();
  g.position.x = lane >= 0 ? LANES[lane] : 0;
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const k = new THREE.Mesh(geo, m); k.position.set(x, y, z); k.rotation.set(rx, ry, rz); g.add(k); return k; };
  if (type === 'basket') { // plastik camasir sepeti
    add(G.basket, M.basket, 0, 0.29, 0);
    add(G.clothesPile, pick(M.cloth), 0, 0.58, 0).scale.set(1, 0.45, 1);
  } else if (type === 'roomba') { // dev robot supurge: kediye dogru gelir
    add(G.roomba, M.roomba, 0, 0.13, 0);
    add(G.roombaTop, M.roombaTop, 0, 0.26, 0);
    g.userData.led = add(G.led, M.led, 0, 0.28, -0.32);
  } else if (type === 'pipe') { // catı boyunca boru: zipla
    add(G.pipeLong, M.pipe, 0, 0.42, 0, 0, 0, Math.PI / 2);
    for (const s of [-1.7, 0, 1.7]) add(G.pipeFoot, M.dark, s, 0.21, 0);
  } else if (type === 'jet') { // fiskiye: acilinca su kemeri
    add(G.nozzle, M.pole, 0, 0.09, 0.3);
    const w = add(G.arc, M.water, 0, 0, 0, 0, Math.PI / 2, 0); w.scale.set(1, 1.35, 1); g.userData.water = w;
    g.userData.drips = [0, 1, 2].map((i) => add(G.drip, M.water, 0, 0.2 + i * 0.12, 0.3));
  } else if (type === 'ac') { // ust uste iki klima
    for (let i = 0; i < 2; i++) {
      add(G.acBox, M.ac, 0, 0.36 + i * 0.71, 0);
      const f = add(G.fan, M.grill, -0.16, 0.36 + i * 0.71, 0.315, Math.PI / 2); g.userData.fans = (g.userData.fans || []).concat(f);
    }
  } else if (type === 'dish') { // uydu canagi: ayakli, yuzu kediye donuk
    add(G.post, M.pole, 0, 0.6, 0).scale.set(1.6, 0.6, 1.6);
    add(G.dish, M.dish, 0, 1.25, 0.05, -Math.PI / 2 + 0.35, 0, 0);
    add(G.dishArm, M.pole, 0, 1.25, 0.32, Math.PI / 2 - 0.3);
  } else if (type === 'tank') { // su deposu
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) add(G.tankLeg, M.pole, x, 0.25, z);
    add(G.bigTank, M.tank, 0, 1.3, 0);
    add(G.tankCap, M.tank, 0, 2.25, 0);
  } else if (type === 'sign') { // iki direk arasinda tabela: kay
    for (const s of [-0.62, 0.62]) add(G.post, M.pole, s, 1.0, 0);
    add(G.beamBar, M.pole, 0, 1.98, 0, 0, 0, Math.PI / 2);
    const y = 0.55 + 0.37 + 0.02;
    add(G.boardEdge, M.white, 0, y, -0.01);
    add(G.board, pick(M.sign), 0, y, 0.02);
    const f = makeFish(); f.position.set(0, y, 0.08); f.scale.setScalar(1.4); g.add(f);
  } else if (type === 'line') { // camasir ipi
    for (const s of [-2.25, 2.25]) add(G.post, M.pole, s, 1.0, 0);
    add(G.rope, M.rope, 0, 1.32, 0, 0, 0, Math.PI / 2);
    for (let x2 = -1.9; x2 < 1.95; x2 += 0.48) add(Math.random() < 0.7 ? G.shirt : G.sock, pick(M.cloth), x2, 1.32 - 0.31, 0);
  } else if (type === 'beam') { // ikaz seritli kiris: kay
    for (const s of [-2.25, 2.25]) add(G.post, M.pole, s, 1.0, 0);
    add(G.beamLong, M.hazard, 0, 0.62 + 0.15, 0);
    for (let x2 = -2.0; x2 < 2.1; x2 += 0.5) add(G.stripe, M.dark, x2, 0.77, 0, 0, 0, 0.6);
  } else if (type === 'room') { // cati odasi: ustunde kosulur; rampa varsa onden cikilir
    const len = ex.len, top = OBS.room.top;
    add(new THREE.BoxGeometry(1.15, top, len), M.room, 0, top / 2, -len / 2);
    add(new THREE.BoxGeometry(1.3, 0.1, len + 0.15), M.roomRoof, 0, top + 0.03, -len / 2);
    add(new THREE.BoxGeometry(0.4, 0.62, 0.04), M.door, 0.22, 0.31, 0.01);
    add(new THREE.BoxGeometry(0.3, 0.26, 0.04), M.win, -0.28, 0.62, 0.01);
    for (let z = -1.2; z > -len + 0.6; z -= 1.6) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.04, 0.3, 0.5), M.win, s * 0.58, 0.62, z);
    if (ex.ramp) {
      const ang = Math.atan2(top, RAMP), L = Math.hypot(top, RAMP);
      add(new THREE.BoxGeometry(1.0, 0.1, L), M.ramp, 0, top / 2 - 0.03, RAMP / 2, ang);
      for (let i = 1; i < 6; i++) add(new THREE.BoxGeometry(1.0, 0.03, 0.06), M.dark, 0, (top * (1 - i / 6)) + 0.02, (RAMP * i) / 6, ang);
    }
  }
  if (lane >= 0 && type !== 'room') { const b = blob(1.1, 1.0); b.position.y = 0.015; g.add(b); } // yere oturan golge
  return g;
}
function makeFish() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(G.fishBody, M.fish); g.add(b);
  const t = new THREE.Mesh(G.fishTail, M.fish); t.rotation.z = Math.PI / 2; t.position.x = 0.32; g.add(t);
  return g;
}

// ================= Dunya: binalar, catilar, uzak sehir =================
const world = new THREE.Group(); scene.add(world);
const roofs = [], obstacles = [], fishes = [], sides = [];
function addRoof(z0, len) {
  const z1 = z0 - len, H = 40, cz = (z0 + z1) / 2;
  const mat = pick(FACADES);
  const b = new THREE.Mesh(boxGeo(ROOF_W, H, len), [mat, mat, ROOF, DARK, mat, mat]);
  b.position.set(0, -H / 2, cz); b.receiveShadow = true; world.add(b);
  const grp = [b];
  for (const s of [-1, 1]) { // korkuluk duvari
    const p = new THREE.Mesh(boxGeo(0.22, 0.4, len, 1, 1), EDGE); p.position.set(s * (ROOF_W / 2 - 0.11), 0.2, cz); p.receiveShadow = true; world.add(p); grp.push(p);
  }
  for (const lx of [-0.65, 0.65]) { const l = new THREE.Mesh(boxGeo(0.05, 0.01, len, 1, 1), LANE_MAT); l.position.set(lx, 0.006, cz); world.add(l); grp.push(l); } // serit cizgileri
  for (let z = z0 - rand(3, 8); z > z1 + 3; z -= rand(7, 16)) { // catı susleri (seritlerin disinda)
    const s = Math.random() < 0.5 ? -1 : 1, x = s * 2.05;
    let d;
    if (Math.random() < 0.55) { d = new THREE.Mesh(boxGeo(0.35, 1.0, 0.35, 1, 1), M.chimney); d.position.set(x, 0.5, z); }
    else { d = new THREE.Mesh(G.tank, M.tank); d.position.set(x, 0.75, z); }
    d.castShadow = true; world.add(d); grp.push(d);
  }
  const r = { z0, z1, meshes: grp };
  roofs.push(r);
  return r;
}
function addSide(side, z0) { // yanlardaki alcak binalar
  const len = rand(8, 18), w = rand(5, 9), top = rand(-7, 2.5), H = 45, mat = pick(FACADES);
  const m = new THREE.Mesh(boxGeo(w, H, len), [mat, mat, ROOF, DARK, mat, mat]);
  m.position.set(side * (ROOF_W / 2 + rand(2.2, 4.5) + w / 2), top - H / 2, z0 - len / 2); m.receiveShadow = true; world.add(m);
  sides.push({ z1: z0 - len - rand(0.5, 3), mesh: m, side });
}
// uzak sehir silueti ve bulutlar: kediyle birlikte ilerler (her zaman ufukta)
const far = new THREE.Group(); scene.add(far);
{
  const fm = new THREE.MeshBasicMaterial({ color: 0xc9b8cf, fog: true });
  const fb = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 26; i++) { const w = rand(8, 18), h = rand(14, 60); const m = new THREE.Mesh(fb, fm); m.scale.set(w, h, w); m.position.set(rand(-160, 160), h / 2 - 25, -rand(150, 210)); far.add(m); }
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, fog: false });
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group(); c.position.set(rand(-90, 90), rand(38, 60), -rand(120, 200));
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(sphere(1, cm, 12, 8).geometry, cm); s.scale.setScalar(rand(5, 9)); s.position.set(k * 7 - 10, rand(-1, 2), 0); s.scale.y *= 0.55; c.add(s); }
    far.add(c);
  }
}

// ================= Oyun durumu =================
const blobTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(60,40,50,0.45)'); gr.addColorStop(1, 'rgba(60,40,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false);
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
function blob(sx, sz) { const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), blobMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m; }
const cat = makeCat(); scene.add(cat.root);
const catShadow = blob(1.1, 1.5); scene.add(catShadow);
const dog = makeDog(); scene.add(dog.root); dog.root.visible = false; dog.root.scale.setScalar(0.8); // kediyi kapatmasin
dog.root.add(blob(1.2, 2));
let state = 'start', genZ = 0, sideZ = [0, 0], lastRowFree = 1;
const P = { lane: 1, x: 0, y: 0, vy: 0, z: 0, ground: true, slide: 0, invul: 0, gait: 0, laneFrom: 1, fallT: 0, drop: false };
let speed = 9, dist = 0, fishN = 0, lives = 3, dogT = 0, dogGap = 6, msgT = 0, runT = 0;
const camPos = new THREE.Vector3(0, 2.7, 4.6);

function clearWorld() {
  for (const r of roofs) r.meshes.forEach((m) => world.remove(m));
  for (const o of obstacles) world.remove(o.mesh);
  for (const f of fishes) world.remove(f.mesh);
  for (const s of sides) world.remove(s.mesh);
  roofs.length = obstacles.length = fishes.length = sides.length = 0;
}
function reset() {
  clearWorld();
  Object.assign(P, { lane: 1, x: 0, y: 0, vy: 0, z: 0, ground: true, slide: 0, invul: 0, gait: 0, laneFrom: 1, fallT: 0, drop: false });
  speed = 9; dist = 0; fishN = 0; lives = 3; dogT = 0; dogGap = 6; runT = 0;
  genZ = 12; sideZ = [12, 12]; lastRowFree = 1;
  addRoof(genZ, 40); genZ -= 40;
  ensureAhead();
  camPos.set(0, 2.7, 4.6);
  hud();
}
function addFishLine(lane, z0, n, y = 0.45) {
  for (let i = 0; i < n; i++) { const m = makeFish(); m.position.set(LANES[lane], y, z0 - i * 1.6); world.add(m); fishes.push({ lane, z: z0 - i * 1.6, y, mesh: m }); }
}
function addFishArc(lane, z0, len) { // bosluk ya da engel ustunden atlama yayi
  const n = 5;
  for (let i = 0; i < n; i++) { const k = i / (n - 1), y = 0.5 + Math.sin(k * Math.PI) * 1.1; const m = makeFish(); const z = z0 - k * len; m.position.set(LANES[lane], y, z); world.add(m); fishes.push({ lane, z, y, mesh: m }); }
}
function addObstacle(type, lane, z, ex = {}) {
  const mesh = makeObstacle(type, lane, ex); mesh.position.z = z; world.add(mesh);
  const o = { type, lane, z, mesh, ...ex };
  if (type === 'room') o.top = OBS.room.top;
  if (type === 'jet') o.phase = Math.random() * JET_T;
  obstacles.push(o);
  return o;
}
// bir sira engel; donen deger: sira icin kullanilan ek uzunluk (cati odasi uzun)
function makeRow(z, zMin) {
  const r = Math.random(), lanes = [0, 1, 2];
  const free = clamp(lastRowFree + pick([-1, 0, 0, 1]), 0, 2), others = lanes.filter((l) => l !== free);
  const blocker = () => pick(['ac', 'ac', 'dish', 'tank']);
  const jumper = () => pick(['basket', 'basket', 'roomba', 'jet']);
  if (r < 0.1) { addObstacle(pick(['line', 'beam']), -1, z); addFishLine(lastRowFree, z + 1.6, 3, 0.3); return 0; }
  if (r < 0.18) { addObstacle('pipe', -1, z); addFishArc(lastRowFree, z + 2.5, 5); return 0; }
  if (r < 0.25) { lanes.forEach((l) => addObstacle(pick(['basket', 'basket', 'roomba']), l, z)); addFishArc(lastRowFree, z + 2.5, 5); return 0; }
  if (r < 0.42) { // cati odasi: rampadan cik, ustunde balik; diger seritlerde engel
    const len = rand(7, 11), ramp = Math.random() < 0.7, front = z - (ramp ? RAMP : 0);
    if (front - len > zMin) {
      addObstacle('room', free, front, { len, ramp });
      addFishLine(free, front - 0.8, Math.floor(len / 1.6), OBS.room.top + 0.45);
      if (Math.random() < 0.6) addObstacle(blocker(), pick(others), z - 1);
      lastRowFree = free;
      return len + (ramp ? RAMP : 0);
    }
  }
  if (r < 0.62) others.forEach((l) => addObstacle(blocker(), l, z));
  else if (r < 0.82) { addObstacle(Math.random() < 0.55 ? jumper() : 'sign', others[0], z); addObstacle(blocker(), others[1], z); }
  else addObstacle(pick([jumper(), 'sign', blocker()]), pick(lanes), z);
  if (Math.random() < 0.7) addFishLine(free, z + 3, 4);
  lastRowFree = free;
  return 0;
}
function ensureAhead() {
  while (genZ > P.z - 150) {
    const gap = runT < 2 ? 0 : rand(2.4, 3.4) * clamp(speed / 10, 1, 1.35);
    const len = rand(30, 52);
    const z0 = genZ - gap;
    if (gap > 0) addFishArc(lastRowFree, genZ + 1, gap + 2);
    addRoof(z0, len);
    const spacing = Math.max(10, speed * 1.05);
    for (let z = z0 - 9; z > z0 - len + 7;) { const used = makeRow(z, z0 - len + 2); z -= used + spacing * rand(1, 1.3); }
    genZ = z0 - len;
    if (roofs.length > 1) runT = Math.max(runT, 2);
  }
  for (const s of [-1, 1]) { const i = s < 0 ? 0 : 1; while (sideZ[i] > P.z - 150) { addSide(s, sideZ[i]); sideZ[i] = sides[sides.length - 1].z1; } }
}
function cleanup() {
  const behind = P.z + 14;
  for (let i = roofs.length - 1; i >= 0; i--) if (roofs[i].z1 > behind) { roofs[i].meshes.forEach((m) => world.remove(m)); roofs.splice(i, 1); }
  for (let i = obstacles.length - 1; i >= 0; i--) if (obstacles[i].z > behind) { world.remove(obstacles[i].mesh); obstacles.splice(i, 1); }
  for (let i = fishes.length - 1; i >= 0; i--) if (fishes[i].z > behind) { world.remove(fishes[i].mesh); fishes.splice(i, 1); }
  for (let i = sides.length - 1; i >= 0; i--) if (sides[i].z1 > behind + 10) { world.remove(sides[i].mesh); sides.splice(i, 1); }
}
const roofAt = (z) => roofs.find((r) => z <= r.z0 + 0.2 && z >= r.z1 - 0.2);
function groundAt(x, z) { // kedinin altindaki zemin: cati (0), rampa ya da cati odasinin ustu
  let g = roofAt(z) ? 0 : -Infinity;
  for (const o of obstacles) {
    if (o.type !== 'room' || Math.abs(LANES[o.lane] - x) > 0.62) continue;
    if (z <= o.z && z >= o.z - o.len) g = Math.max(g, o.top);
    else if (o.ramp && z > o.z && z < o.z + RAMP) g = Math.max(g, o.top * (1 - (z - o.z) / RAMP));
  }
  return g;
}

// ================= Ses (kisa, yumusak efektler) =================
let ac = null;
function sfx(kind) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    const S = { jump: [420, 680, 0.12, 0.08, 'sine'], coin: [880, 1320, 0.09, 0.06, 'triangle'], hit: [220, 90, 0.25, 0.12, 'square'], slide: [300, 180, 0.15, 0.05, 'sine'], lane: [500, 560, 0.05, 0.03, 'sine'] }[kind];
    o.type = S[4]; o.frequency.setValueAtTime(S[0], t); o.frequency.exponentialRampToValueAtTime(S[1], t + S[2]);
    g.gain.setValueAtTime(S[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + S[2] + 0.05);
    o.start(t); o.stop(t + S[2] + 0.06);
  } catch { /* ses yok */ }
}

let barkT = 0.5, barkOpen = 0, barkBuf = null, barkTried = false;
async function loadBark() { if (barkTried) return; barkTried = true; try { const r = await fetch('sounds/havlama.mp3'); if (r.ok) barkBuf = await ac.decodeAudioData(await r.arrayBuffer()); } catch { /* kayit yok */ } }
function bark() {
  barkOpen = 0.5;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); loadBark();
    const t = ac.currentTime;
    if (barkBuf) { const s2 = ac.createBufferSource(), g = ac.createGain(); s2.buffer = barkBuf; g.gain.value = 0.7; s2.connect(g); g.connect(ac.destination); s2.start(t); return; }
    for (const d of [0, 0.2]) { // iki kisa, kalin "hav": testere dalga + gurultu, alcak gecis suzgeci
      const o = ac.createOscillator(), f2 = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(210, t + d); o.frequency.exponentialRampToValueAtTime(120, t + d + 0.13);
      f2.type = 'lowpass'; f2.frequency.value = 900; f2.Q.value = 6;
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.22, t + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
      o.connect(f2); f2.connect(g); g.connect(ac.destination); o.start(t + d); o.stop(t + d + 0.18);
    }
  } catch { /* ses yok */ }
}

// ================= Kontroller =================
function act(a) {
  if (state !== 'play') return;
  if (a === 'left' || a === 'right') {
    const nl = clamp(P.lane + (a === 'left' ? -1 : 1), 0, 2);
    if (nl !== P.lane) { P.laneFrom = P.lane; P.lane = nl; sfx('lane'); }
  } else if (a === 'up') {
    if (P.ground) { P.vy = 7.6; P.ground = false; P.slide = 0; sfx('jump'); }
  } else if (a === 'down') {
    if (!P.ground) { P.vy = Math.min(P.vy, -12); P.drop = true; }
    else { P.slide = 0.75; sfx('slide'); }
  }
}
let touch = null;
canvas.addEventListener('pointerdown', (e) => { touch = { x: e.clientX, y: e.clientY, done: false }; });
canvas.addEventListener('pointermove', (e) => {
  if (!touch || touch.done) return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  if (Math.hypot(dx, dy) < 28) return;
  touch.done = true;
  act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'));
});
canvas.addEventListener('pointerup', () => { if (touch && !touch.done) act('up'); touch = null; }); // dokunmak da zipla
window.addEventListener('keydown', (e) => {
  const k = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ' ': 'up', ArrowDown: 'down', s: 'down' }[e.key];
  if (k) { e.preventDefault(); act(k); }
  if (e.key === 'Escape' || e.key === 'p') pause();
});

// ================= Ekran ve akis =================
function hud() {
  $('fish').textContent = fishN;
  $('dist').textContent = Math.floor(dist) + ' m';
  $('lives').textContent = '❤️'.repeat(Math.max(0, lives)) + '🤍'.repeat(Math.max(0, 3 - lives));
}
function say(text, t = 1.4) { $('msg').textContent = text; $('msg').style.opacity = 1; msgT = t; }
function start() {
  reset(); state = 'play';
  for (const s of ['start', 'over', 'pause']) $(s).classList.add('hidden');
  $('back').classList.remove('hidden');
  say('Koş! Karabaş arkanda!', 1.6); dogT = 3.2; dogGap = 1.9; barkT = 0.3; if (DEMO && params.has('dog')) dogT = 999; // test: kopek hep pesinde
}
function pause() { if (state !== 'play') return; state = 'pause'; $('pause').classList.remove('hidden'); }
function resume() { if (state !== 'pause') return; state = 'play'; $('pause').classList.add('hidden'); last = performance.now(); }
function gameOver() {
  state = 'over';
  $('back').classList.add('hidden');
  try { const k = 'dz_wallet', w = JSON.parse(localStorage.getItem(k) || '0') || 0; if (!DEMO) localStorage.setItem(k, JSON.stringify(w + fishN)); } catch { /* yoksay */ }
  $('overTitle').textContent = dogT > 0 ? 'Karabaş yakaladı!' : 'Tur bitti!';
  const best = Number(localStorage.getItem('dz_best3d') || 0), m = Math.floor(dist), rec = m > best;
  if (rec && !DEMO) localStorage.setItem('dz_best3d', String(m));
  $('overText').textContent = `${m} m koştun${rec ? ' · Yeni rekor! 🏆' : ` · Rekorun ${best} m`} · ${fishN} balık cüzdanına eklendi`;
  showBest();
  $('over').classList.remove('hidden');
}
function showBest() { const b = Number(localStorage.getItem('dz_best3d') || 0); $('best').textContent = b ? `En iyi: ${b} m` : ''; }
showBest();
const goHome = () => { location.href = 'index.html'; };
$('play').onclick = start; $('again').onclick = start; $('resume').onclick = resume; $('back').onclick = pause;
$('home').onclick = goHome; $('home2').onclick = goHome; $('home3').onclick = goHome;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

const hitLog = [];
function crash(o, why) {
  if (P.invul > 0) return;
  if (DEMO) hitLog.push((o ? o.type : '?') + '@' + Math.round(dist) + (o && o.type === 'room' ? '[r' + (o.ramp ? 1 : 0) + ' y' + P.y.toFixed(2) + ' dz' + (o.z - P.z).toFixed(1) + ' L' + P.lane + '/' + o.lane + ' x' + P.x.toFixed(2) + ' g' + (P.ground ? 1 : 0) + ']' : ''));
  o && (o.hit = true);
  const sideways = Math.abs(P.x - LANES[P.lane]) > 0.35;
  if (sideways && P.laneFrom !== P.lane) { // yandan carpma: geri sekersin, kopek yetisir
    P.lane = P.laneFrom; P.invul = 0.6; sfx('hit');
    if (dogT > 0) { loseLife('Karabaş yakaladı!'); return; }
    dogT = 7; dogGap = 3; say('Takıldın! Karabaş peşinde', 1.4); return;
  }
  loseLife(why);
}
function loseLife(why) {
  lives--; P.invul = 2; speed = Math.max(9, speed * 0.75); sfx('hit'); hud();
  if (lives <= 0) { gameOver(); return; }
  say(why, 1.4);
  dogT = 7; dogGap = 3;
}

// ================= Guncelleme =================
function update(dt) {
  runT += dt;
  speed = Math.min(19, speed + dt * 0.09);
  const dz = speed * dt;
  P.z -= dz; dist += dz;
  P.gait += dz * 0.55;
  P.invul = Math.max(0, P.invul - dt);
  P.slide = Math.max(0, P.slide - dt);
  // serit gecisi (yumusak, hizli)
  P.x += (LANES[P.lane] - P.x) * Math.min(1, dt * 13);
  // dikey hareket ve catilar arasi bosluk
  const gh = groundAt(P.x, P.z);
  if (P.ground) {
    if (gh === -Infinity || gh < P.y - 0.08) { P.ground = false; P.vy = 0; } // kenardan ya da odanin ucundan duser
    else if (gh <= P.y + 0.35) P.y = gh; // rampaya tirmanir
  } else {
    P.vy -= 22 * dt; P.y += P.vy * dt;
    if (gh > -Infinity && P.y <= gh && P.y > gh - 0.6 && P.vy < 0) { P.y = gh; P.vy = 0; P.ground = true; if (P.drop) { P.drop = false; P.slide = 0.75; sfx('slide'); } }
    if (P.y < -4) { // dustu: bir can gider, sonraki catinin basinda dogar
      const next = roofs.filter((r) => r.z0 < P.z + 1).sort((a, b) => b.z0 - a.z0)[0];
      if (DEMO) { const prev = roofs.filter((r) => r.z1 > P.z).sort((x, y) => x.z1 - y.z1)[0]; hitLog.push('fall@' + Math.round(dist) + '[sp' + speed.toFixed(1) + ' gap' + (prev && next ? (prev.z1 - next.z0).toFixed(1) : '?') + ']'); }
      loseLife('Aşağı düştün!');
      if (state !== 'play') return;
      if (next) P.z = next.z0 - 1;
      P.y = 0; P.vy = 0; P.ground = true;
    }
  }
  // engeller
  const standH = P.slide > 0 ? 0.42 : 0.78;
  clockS += dt;
  for (const o of obstacles) {
    const D = OBS[o.type];
    if (o.type === 'roomba' && o.z < P.z && o.z > P.z - 40) { o.z += 2.6 * dt; o.mesh.position.z = o.z; o.mesh.rotation.y += dt * 2; } // kediye dogru gelir
    if (o.type === 'jet') { const on = jetOn(o), warn = !on && ((clockS + o.phase) % JET_T) > JET_T - 0.5; o.mesh.userData.water.visible = on; o.mesh.userData.drips.forEach((d, i) => { d.visible = warn; d.position.y = 0.2 + ((clockS * 2 + i / 3) % 1) * 0.5; }); }
    if (o.hit) continue;
    if (D.kind === 'plat') { // cati odasi: onune ya da yanina carpma
      if (Math.abs(LANES[o.lane] - P.x) < 0.7 && P.z <= o.z && P.z >= o.z - o.len && P.y < o.top - 0.25) { crash(o, D.name); if (state === 'play') { P.y = o.top; P.vy = 0; P.ground = true; } }
      continue;
    }
    if (Math.abs(o.z - P.z) > 0.42) continue;
    if (!D.full && Math.abs(LANES[o.lane] - P.x) > 0.72) continue;
    if (D.kind === 'jump') { if ((o.type !== 'jet' || jetOn(o)) && P.y < D.h) crash(o, D.name); }
    else if (D.kind === 'slide') { if (P.y + standH > D.low && P.y < 1.7) crash(o, D.name); }
    else crash(o, D.name);
  }
  // baliklar
  for (let i = fishes.length - 1; i >= 0; i--) {
    const f = fishes[i];
    f.mesh.rotation.y += dt * 3;
    if (Math.abs(f.z - P.z) < 0.7 && Math.abs(LANES[f.lane] - P.x) < 0.6 && Math.abs(f.y - (P.y + 0.45)) < 0.75) {
      world.remove(f.mesh); fishes.splice(i, 1); fishN++; sfx('coin');
    }
  }
  for (const o of obstacles) if (o.mesh.userData.fans) o.mesh.userData.fans.forEach((f) => { f.rotation.y += dt * 9; });
  if (dogT > 0) { barkT -= dt; if (barkT <= 0) { barkT = rand(1.6, 2.8); bark(); } }
  // kopek
  if (dogT > 0) { dogT -= dt; dogGap = lerp(dogGap, dogT > 1.5 ? 1.9 : 10, Math.min(1, dt * 1.5)); } // kovalarken kedinin yan arkasinda gorunur
  barkOpen = Math.max(0, barkOpen - dt);
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
  ensureAhead(); cleanup();
  hud();
}

// ================= Cizim: kedi pozu, kamera =================
function poseCat(t) {
  const c = cat, ph = P.gait * Math.PI;
  c.root.position.set(P.x, P.y, P.z);
  const sg = groundAt(P.x, P.z); catShadow.position.set(P.x, sg > -Infinity ? sg + 0.02 : -50, P.z); const ss = 1 / (1 + Math.max(0, P.y - Math.max(0, sg)) * 0.6); catShadow.scale.set(ss, ss, ss);
  const sliding = P.slide > 0 && P.ground, air = !P.ground;
  // tum govde birlikte: ziplama dalgasi, hafif one-arkaya sallanma (on ve arka kopmaz)
  const bob = air || sliding ? 0 : Math.abs(Math.sin(ph)) * 0.07;
  c.body.position.y = bob;
  c.body.rotation.x = air ? clamp(P.vy * 0.04, -0.35, 0.3) : sliding ? 0.05 : Math.sin(ph * 2) * 0.05;
  c.body.rotation.z = (LANES[P.lane] - P.x) * -0.12; // serit degisirken yana yatar
  c.body.scale.set(1, sliding ? 0.6 : 1 + Math.sin(ph * 2) * 0.025, sliding ? 1.15 : 1);
  if (sliding) c.body.position.y = -0.12;
  // bacaklar: dortnala (onler birlikte, arkalar birlikte, biraz kaymis)
  const [fl, fr, bl, br] = c.legs;
  if (air) { fl.rotation.x = fr.rotation.x = -0.9; bl.rotation.x = br.rotation.x = 0.9; }
  else if (sliding) { fl.rotation.x = fr.rotation.x = -1.35; bl.rotation.x = br.rotation.x = 1.3; }
  else {
    const s = Math.sin(ph * 2);
    fl.rotation.x = s * 0.75; fr.rotation.x = Math.sin(ph * 2 + 0.5) * 0.75;
    bl.rotation.x = -s * 0.8; br.rotation.x = -Math.sin(ph * 2 + 0.5) * 0.8;
  }
  c.head.rotation.x = air ? -0.15 : sliding ? 0.25 : -Math.sin(ph * 2) * 0.04; // bas sabit kalmaya calisir
  // kuyruk: yukari kalkik, ucu hafif kivrik, yumusak sallanir
  let y = 0.62, z = 0.48, a = air ? 0.35 : 0.85;
  for (let i = 0; i < c.tail.length; i++) {
    const k = i / c.tail.length;
    a += 0.036 + (air ? -0.013 : 0); // yukari kalkar, ucu hafifce one kivrilir
    const x = Math.sin(t * 2.6 - k * 2.2) * 0.07 * k; // yumusak yana sallanma (birikmez)
    y += Math.sin(a) * 0.058; z += Math.cos(a) * 0.058;
    c.tail[i].position.set(x, y + (sliding ? -0.2 : 0), z * (sliding ? 1.05 : 1));
  }
  // kopek
  dog.root.visible = dogT > 0 || dogGap < 8.5;
  if (dog.root.visible) {
    const dside = P.x > 0.1 ? -0.75 : 0.75; // kedinin hafif yan arkasinda: kedi hep gorunur
    dog.root.position.x = lerp(dog.root.position.x, P.x + dside, 0.06); dog.root.position.z = P.z + dogGap;
    const dp = P.gait * Math.PI * 0.85 * 2, sp = Math.sin(dp);
    const dgh = groundAt(dog.root.position.x, P.z + dogGap); dog.root.position.y = dgh > -Infinity ? dgh : 0;
    dog.body.position.y = Math.abs(Math.sin(dp / 2 * 2)) * 0.07;
    dog.front.rotation.x = sp * 0.1; dog.back.rotation.x = -sp * 0.12; // omurga esner (on ve arka birlikte)
    dog.legs.forEach((l, i) => {
      const ph = dp + (i % 2) * 0.35, s2 = Math.sin(ph);
      if (!l.hind) { l.up.rotation.x = s2 * 0.85; l.low.rotation.x = -Math.max(0, -Math.cos(ph)) * 0.9; }
      else { l.up.rotation.x = -s2 * 0.75; l.low.rotation.x = Math.max(0, Math.cos(ph)) * 0.8 + 0.15; }
    });
    dog.head.rotation.x = -sp * 0.08;
    const open = barkOpen > 0 ? Math.sin(Math.min(1, barkOpen / 0.25) * Math.PI) : 0.15;
    dog.jaw.rotation.x = open * 0.5; dog.tongue.visible = barkOpen <= 0;
    dog.tail.rotation.z = -0.3 + Math.sin(t * 9) * 0.15;
    dog.head.children.forEach((c) => { if (c.userData.s) c.rotation.z = c.userData.s * (0.25 + Math.sin(dp) * 0.15); }); // kulaklar sallanir
  }
  // yanip sonme (carpismadan sonra korunurken)
  c.root.visible = !(P.invul > 0 && Math.floor(t * 10) % 2 === 0 && state === 'play');
}
function placeCamera(dt) {
  // kamera: kedinin arkasinda; yana yumusak kayar, ziplamada sabit kalir (goz yormaz)
  camPos.x += (P.x * 0.6 - camPos.x) * Math.min(1, dt * 6);
  camera.position.set(camPos.x, 2.75, P.z + 4.8);
  camera.lookAt(P.x * 0.75, 0.75, P.z - 6);
  sun.position.set(P.x + 5, 11, P.z + 3); sun.target.position.set(P.x, 0, P.z - 3);
  far.position.z = P.z;
}

let last = performance.now();
// kalite: telefon zorlanirsa cozunurluk duser, en son golgeler kapanir (akicilik once gelir)
let perfT = 0, perfN = 0, quality = 2;
function adaptQuality(dt) {
  if (DEMO || state !== 'play') return;
  perfT += dt; perfN++;
  if (perfT < 1.2) return;
  const fps = perfN / perfT; perfT = 0; perfN = 0;
  if (fps < 50 && quality > 0) {
    quality--;
    renderer.setPixelRatio(quality === 1 ? 1 : 0.75);
    resize();
  }
}
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = clamp((now - last) / 1000, 0, 0.05); last = now;
  adaptQuality(dt);
  if (state === 'play') {
    if (DEMO && params.has('fast')) { for (let i = 0; i < 20 && state === 'play'; i++) { bot(); update(1 / 60); } } // test: hizli ilerlet
    else { if (DEMO) bot(); update(dt); }
  }
  else if (state === 'start') { P.z -= dt * 3; P.gait += dt * 1.6; ensureAhead(); cleanup(); } // acilista kedi yavasca kosar
  poseCat(now / 1000);
  placeCamera(dt);
  renderer.render(scene, camera);
  if (DEMO) window.__s = { state, dist: Math.round(dist), fish: fishN, lives, speed: +speed.toFixed(1), lane: P.lane, obs: obstacles.length, roofs: roofs.length, hits: hitLog.slice(-8).join(','), types: [...new Set(obstacles.map((o) => o.type))].join(',') };
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.6 ? 68 : 60; // dar ekranda biraz genis gorus
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// test botu: oneki engele gore serit degistirir, ziplar, kayar
function bot() {
  if (params.has('nobot')) return;
  const look = speed * 0.34;
  const lanesOf = (o) => (OBS[o.type].full ? [0, 1, 2] : [o.lane]);
  const front = (o) => (o.type === 'room' && o.ramp ? o.z + RAMP : o.z);
  const blocks = (o) => OBS[o.type].kind === 'block' || (o.type === 'room' && !o.ramp && P.y < o.top - 0.2);
  const near = obstacles.filter((o) => !o.hit && front(o) > P.z - look - 4 && (o.type === 'room' ? o.z - o.len : o.z) < P.z + 0.3); // araligi kedinin onune degen engeller
  const ahead = near.filter((o) => lanesOf(o).includes(P.lane) && front(o) < P.z - 0.2 && front(o) > P.z - look);
  if (P.ground && groundAt(P.x, P.z - speed * 0.16) === -Infinity) { act('up'); return; }
  if (!ahead.length) return;
  const o = ahead.sort((a, b) => b.z - a.z)[0];
  if (blocks(o)) {
    const ok = (l) => l >= 0 && l <= 2 && !near.some((q) => lanesOf(q).includes(l) && !OBS[q.type].full && (OBS[q.type].kind === 'block' || (q.type === 'room' && !q.ramp)) && Math.abs(front(q) - front(o)) < 4);
    const wall = (l) => near.some((q) => q.type === 'room' && q.lane === l && q.z >= P.z - 3 && q.z - q.len <= P.z + 0.6) && P.y < OBS.room.top - 0.2; // yandaki odanin duvarina gecilmez
    const free = [P.lane - 1, P.lane + 1, P.lane - 2, P.lane + 2].filter((l) => ok(l) && !wall(l) && !wall(P.lane + Math.sign(l - P.lane))); // iki serit otedeyse de oraya gider
    if (free.length) { act(free[0] < P.lane ? 'left' : 'right'); return; }
    if (o.type === 'room' && front(o) > P.z - speed * 0.2) act('up');
    return;
  }
  const D = OBS[o.type], dz = P.z - front(o), v = speed + (o.type === 'roomba' ? 2.6 : 0);
  if (D.kind === 'jump' && dz < v * 0.24 && (o.type !== 'jet' || jetOn(o) || ((clockS + o.phase + dz / v) % JET_T) < JET_T / 2)) act('up');
  if (D.kind === 'slide' && dz < speed * 0.2) act('down');
}

resize();
reset();
requestAnimationFrame(frame);
if (DEMO) start();

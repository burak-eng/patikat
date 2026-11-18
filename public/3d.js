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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: DEMO });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const FOG = 0xf2d8cc;
scene.fog = new THREE.Fog(FOG, 30, 125);

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
sun.castShadow = true;
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
const FACADES = PALETTE.map(([w, t, s], i) => new THREE.MeshStandardMaterial({ map: facadeTex(w, t, s, i), roughness: 0.95 }));
const roofTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#d8cfc4'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '60,40,30'},${Math.random() * 0.07})`; g.fillRect(x + 2, y + 2, 60, 60); }
  g.fillStyle = 'rgba(80,60,50,0.12)'; for (let i = 0; i <= w; i += 64) { g.fillRect(i - 1, 0, 2, h); g.fillRect(0, i - 1, w, 2); }
});
const ROOF = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1 });
const EDGE = new THREE.MeshStandardMaterial({ color: 0xc98d72, roughness: 0.9 });
const DARK = new THREE.MeshStandardMaterial({ color: 0x9d8f9c, roughness: 1 });

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
  return new THREE.MeshPhysicalMaterial({ color, map: map || null, roughness: 0.85, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(sheen) });
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

function sphere(r, mat, ws = 28, hs = 20) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat); m.castShadow = true; return m; }
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
  const head = new THREE.Group(); head.position.set(0, 0.86, -0.5); body.add(head);
  const skullGeo = new THREE.SphereGeometry(0.31, 36, 26); skullGeo.rotateX(Math.PI / 2);
  const skull = new THREE.Mesh(skullGeo, C.fur); skull.castShadow = true; skull.scale.set(1.12, 0.96, 0.98); head.add(skull);
  for (const s of [-1, 1]) {
    const cheek = sphere(0.15, C.plain); cheek.position.set(s * 0.2, -0.09, -0.08); cheek.scale.set(1, 0.85, 1); head.add(cheek); // yanak tuyleri
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.24, 16), C.plain); ear.castShadow = true;
    ear.position.set(s * 0.17, 0.27, 0.0); ear.rotation.z = -s * 0.32; head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 12), C.pink); inner.position.set(s * 0.165, 0.25, -0.045); inner.rotation.z = -s * 0.32; head.add(inner);
    const eye = sphere(0.075, C.eye, 20, 14); eye.position.set(s * 0.13, 0.04, -0.26); eye.scale.set(1, 1.15, 0.6); head.add(eye);
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
  for (let i = 0; i < 26; i++) { const k = i / 25, s = sphere(0.095 - k * 0.04, Math.floor(i / 3) % 3 === 1 ? C.ring : C.plain, 16, 12); body.add(s); tail.push(s); } // sik dizili: puruzsuz, kabarik kuyruk
  root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
  return { root, body, head, legs, tail, torso };
}

function makeDog() { // Karabas: kangal, acik kahve govde, siyah maske
  const fur = furMat(0xcfa36d, 0xf2d8b0), mask = new THREE.MeshStandardMaterial({ color: 0x2b2422, roughness: 0.8 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torsoGeo = new THREE.CapsuleGeometry(0.33, 0.75, 8, 20); torsoGeo.rotateX(Math.PI / 2);
  const torso = new THREE.Mesh(torsoGeo, fur); torso.castShadow = true; torso.position.y = 0.8; body.add(torso);
  const head = new THREE.Group(); head.position.set(0, 1.18, -0.68); body.add(head);
  const sk = sphere(0.26, fur); head.add(sk);
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.22, 6, 12), mask); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.07, -0.27); head.add(snout);
  for (const s of [-1, 1]) { const ear = sphere(0.12, mask); ear.scale.set(0.5, 1.3, 0.9); ear.position.set(s * 0.22, -0.02, 0.02); head.add(ear); }
  const legs = [];
  for (const [x, z] of [[-0.18, -0.45], [0.18, -0.45], [-0.18, 0.45], [0.18, 0.45]]) {
    const p = new THREE.Group(); p.position.set(x, 0.68, z); body.add(p);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 6, 12), fur); l.castShadow = true; l.position.y = -0.3; p.add(l); legs.push(p);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 8, 16, Math.PI * 1.4), fur); tail.position.set(0, 1.08, 0.62); tail.rotation.y = Math.PI / 2; body.add(tail);
  return { root, body, legs, head };
}

// ================= Engeller ve balik =================
const M = {
  wicker: new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 0.9 }), cloth: [0x8fb8de, 0xe8a0a8, 0xe9c46a, 0xc9b3e0, 0xffffff].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, side: THREE.DoubleSide })),
  ac: new THREE.MeshStandardMaterial({ color: 0xdfe2e7, roughness: 0.6 }), grill: new THREE.MeshStandardMaterial({ color: 0x7d838f, roughness: 0.5, metalness: 0.4 }),
  pole: new THREE.MeshStandardMaterial({ color: 0x7d8492, roughness: 0.5, metalness: 0.5 }), rope: new THREE.MeshStandardMaterial({ color: 0xa89a88, roughness: 1 }),
  sign: [0xc98f5a, 0x7f9fc4, 0xc97a7a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
  fish: new THREE.MeshStandardMaterial({ color: 0xf0b45e, roughness: 0.35, metalness: 0.15, emissive: 0x5a3000, emissiveIntensity: 0.25 }),
  chimney: new THREE.MeshStandardMaterial({ color: 0xb98a78, roughness: 1 }), tank: new THREE.MeshStandardMaterial({ color: 0xc9ccd3, roughness: 0.5, metalness: 0.3 }),
};
const G = {
  basket: new THREE.CylinderGeometry(0.34, 0.28, 0.55, 20), clothesPile: new THREE.SphereGeometry(0.3, 16, 10),
  acBox: new THREE.BoxGeometry(0.95, 0.68, 0.6), fan: new THREE.CylinderGeometry(0.22, 0.22, 0.04, 20),
  post: new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), beam: new THREE.CylinderGeometry(0.03, 0.03, 1.3, 8), board: new THREE.BoxGeometry(1.0, 0.72, 0.06),
  shirt: new THREE.PlaneGeometry(0.42, 0.62), sock: new THREE.PlaneGeometry(0.16, 0.5),
  fishBody: new THREE.SphereGeometry(0.17, 16, 10), fishTail: new THREE.ConeGeometry(0.12, 0.18, 4),
};
G.fishBody.scale(1.6, 0.85, 0.5);
const LANES = [-1.3, 0, 1.3];
const ROOF_W = 4.8;

function makeObstacle(type, lane) {
  const g = new THREE.Group();
  const x = lane >= 0 ? LANES[lane] : 0;
  g.position.x = x;
  if (type === 'basket') { // camasir sepeti: zipla
    const b = new THREE.Mesh(G.basket, M.wicker); b.position.y = 0.275; b.castShadow = true; g.add(b);
    const c = new THREE.Mesh(G.clothesPile, pick(M.cloth)); c.position.y = 0.55; c.scale.set(1, 0.45, 1); g.add(c);
  } else if (type === 'ac') { // ust uste iki klima: zipla(ma)z, serit degistir
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(G.acBox, M.ac); b.position.y = 0.36 + i * 0.7; b.castShadow = true; g.add(b);
      const f = new THREE.Mesh(G.fan, M.grill); f.rotation.x = Math.PI / 2; f.position.set(-0.15, 0.36 + i * 0.7, 0.305); g.add(f); g.userData.fans = (g.userData.fans || []).concat(f);
    }
  } else if (type === 'sign') { // iki direk arasinda sarkan tabela: kay
    for (const s of [-0.62, 0.62]) { const p = new THREE.Mesh(G.post, M.pole); p.position.set(s, 1.0, 0); g.add(p); }
    const bm = new THREE.Mesh(G.beam, M.pole); bm.rotation.z = Math.PI / 2; bm.position.y = 1.98; g.add(bm);
    const bd = new THREE.Mesh(G.board, pick(M.sign)); bd.position.y = 0.55 + 0.36 + 0.02; bd.castShadow = true; g.add(bd);
    const f = makeFish(); f.position.set(0, bd.position.y, -0.05); f.scale.setScalar(1.3); g.add(f);
  } else if (type === 'line') { // tum seritlere gerili camasir ipi: kay
    for (const s of [-2.25, 2.25]) { const p = new THREE.Mesh(G.post, M.pole); p.position.set(s, 1.0, 0); g.add(p); }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.5, 6), M.rope); rope.rotation.z = Math.PI / 2; rope.position.y = 1.32; g.add(rope);
    for (let x2 = -1.9; x2 < 1.95; x2 += 0.5) {
      const sh = new THREE.Mesh(Math.random() < 0.7 ? G.shirt : G.sock, pick(M.cloth)); sh.position.set(x2, 1.32 - 0.31, 0); sh.castShadow = true; g.add(sh);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
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
  for (let z = z0 - rand(3, 8); z > z1 + 3; z -= rand(7, 16)) { // catı susleri (seritlerin disinda)
    const s = Math.random() < 0.5 ? -1 : 1, x = s * 2.05;
    let d;
    if (Math.random() < 0.55) { d = new THREE.Mesh(boxGeo(0.35, 1.0, 0.35, 1, 1), M.chimney); d.position.set(x, 0.5, z); }
    else { d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 16), M.tank); d.position.set(x, 0.75, z); }
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
  for (let i = 0; i < 60; i++) { const w = rand(6, 16), h = rand(14, 60); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), fm); m.position.set(rand(-160, 160), h / 2 - 25, -rand(150, 210)); far.add(m); }
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, fog: false });
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group(); c.position.set(rand(-90, 90), rand(38, 60), -rand(120, 200));
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rand(5, 9), 16, 10), cm); s.position.set(k * 7 - 10, rand(-1, 2), 0); s.scale.y = 0.55; c.add(s); }
    far.add(c);
  }
}

// ================= Oyun durumu =================
const cat = makeCat(); scene.add(cat.root);
const dog = makeDog(); scene.add(dog.root); dog.root.visible = false;
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
function addObstacle(type, lane, z) {
  const mesh = makeObstacle(type, lane); mesh.position.z = z; world.add(mesh);
  obstacles.push({ type, lane, z, mesh });
}
// bir sira engel: her sirada en az bir serit gecilebilir; bir onceki siranin bos seridinden ulasilabilir
function makeRow(z) {
  const r = Math.random(), lanes = [0, 1, 2];
  if (r < 0.14) { addObstacle('line', -1, z); addFishLine(1, z + 1.6, 3, 0.3); return; }
  if (r < 0.26) { lanes.forEach((l) => addObstacle('basket', l, z)); addFishArc(lastRowFree, z + 2.5, 5); return; }
  // serbest serit: onceki bos seride komsu ya da ayni
  const free = clamp(lastRowFree + pick([-1, 0, 0, 1]), 0, 2);
  const others = lanes.filter((l) => l !== free);
  if (r < 0.55) { others.forEach((l) => addObstacle('ac', l, z)); }
  else if (r < 0.75) { addObstacle(pick(['basket', 'sign']), pick(others), z); addObstacle('ac', others.find((l) => !obstacles.some((o) => o.z === z && o.lane === l)), z); }
  else { addObstacle(pick(['basket', 'sign']), pick(lanes), z); }
  if (Math.random() < 0.7) addFishLine(free, z + 3, 4);
  lastRowFree = free;
}
function ensureAhead() {
  while (genZ > P.z - 150) {
    const gap = runT < 2 ? 0 : rand(2.4, 3.4) * clamp(speed / 10, 1, 1.35);
    const len = rand(26, 46);
    const z0 = genZ - gap;
    if (gap > 0) addFishArc(lastRowFree, genZ + 1, gap + 2);
    addRoof(z0, len);
    const spacing = Math.max(10, speed * 1.05);
    for (let z = z0 - 9; z > z0 - len + 7; z -= spacing * rand(1, 1.3)) makeRow(z);
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
  say('Koş!', 1);
}
function pause() { if (state !== 'play') return; state = 'pause'; $('pause').classList.remove('hidden'); }
function resume() { if (state !== 'pause') return; state = 'play'; $('pause').classList.add('hidden'); last = performance.now(); }
function gameOver() {
  state = 'over';
  $('back').classList.add('hidden');
  try { const k = 'dz_wallet', w = JSON.parse(localStorage.getItem(k) || '0') || 0; if (!DEMO) localStorage.setItem(k, JSON.stringify(w + fishN)); } catch { /* yoksay */ }
  $('overTitle').textContent = dogT > 0 ? 'Karabaş yakaladı!' : 'Tur bitti!';
  $('overText').textContent = `${Math.floor(dist)} m koştun · ${fishN} balık cüzdanına eklendi`;
  $('over').classList.remove('hidden');
}
const goHome = () => { location.href = 'index.html'; };
$('play').onclick = start; $('again').onclick = start; $('resume').onclick = resume; $('back').onclick = pause;
$('home').onclick = goHome; $('home2').onclick = goHome; $('home3').onclick = goHome;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

function crash(o, why) {
  if (P.invul > 0) return;
  o && (o.hit = true);
  const sideways = Math.abs(P.x - LANES[P.lane]) > 0.35;
  if (sideways && P.laneFrom !== P.lane) { // yandan carpma: geri sekersin, kopek yetisir
    P.lane = P.laneFrom; P.invul = 0.6; sfx('hit');
    if (dogT > 0) { loseLife('Karabaş yakaladı!'); return; }
    dogT = 7; dogGap = 4; say('Takıldın! Karabaş peşinde', 1.4); return;
  }
  loseLife(why);
}
function loseLife(why) {
  lives--; P.invul = 2; speed = Math.max(9, speed * 0.75); sfx('hit'); hud();
  if (lives <= 0) { gameOver(); return; }
  say(why, 1.4);
  dogT = 7; dogGap = 3.5;
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
  const roof = roofAt(P.z);
  if (P.ground) {
    if (!roof) { P.ground = false; P.vy = 0; }
  } else {
    P.vy -= 22 * dt; P.y += P.vy * dt;
    if (P.y <= 0 && P.y > -0.6 && roof && P.vy < 0) { P.y = 0; P.vy = 0; P.ground = true; if (P.drop) { P.drop = false; P.slide = 0.75; sfx('slide'); } }
    if (P.y < -4) { // dustu: bir can gider, sonraki catinin basinda dogar
      const next = roofs.filter((r) => r.z0 < P.z + 1).sort((a, b) => b.z0 - a.z0)[0];
      loseLife('Aşağı düştün!');
      if (state !== 'play') return;
      if (next) P.z = next.z0 - 1;
      P.y = 0; P.vy = 0; P.ground = true;
    }
  }
  // engeller
  const standH = P.slide > 0 ? 0.42 : 0.78;
  for (const o of obstacles) {
    if (o.hit || Math.abs(o.z - P.z) > 0.42) continue;
    if (o.type !== 'line' && Math.abs(LANES[o.lane] - P.x) > 0.72) continue;
    if (o.type === 'basket' && P.y < 0.58) crash(o, 'Sepete takıldın!');
    else if (o.type === 'ac') crash(o, 'Klimaya çarptın!');
    else if ((o.type === 'sign' || o.type === 'line') && P.y + standH > 0.55 && P.y < 1.7) crash(o, o.type === 'sign' ? 'Tabelaya çarptın!' : 'İpe takıldın!');
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
  // kopek
  if (dogT > 0) { dogT -= dt; dogGap = lerp(dogGap, dogT > 1.5 ? 2.6 : 9, Math.min(1, dt * 1.5)); }
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
  ensureAhead(); cleanup();
  hud();
}

// ================= Cizim: kedi pozu, kamera =================
function poseCat(t) {
  const c = cat, ph = P.gait * Math.PI;
  c.root.position.set(P.x, P.y, P.z);
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
    a += 0.022 + (air ? -0.008 : 0); // yukari kalkar, ucu hafifce one kivrilir
    const x = Math.sin(t * 2.6 - k * 2.2) * 0.07 * k; // yumusak yana sallanma (birikmez)
    y += Math.sin(a) * 0.036; z += Math.cos(a) * 0.036;
    c.tail[i].position.set(x, y + (sliding ? -0.2 : 0), z * (sliding ? 1.05 : 1));
  }
  // kopek
  dog.root.visible = dogT > 0 || dogGap < 8.5;
  if (dog.root.visible) {
    dog.root.position.set(lerp(dog.root.position.x, P.x, 0.08), 0, P.z + dogGap);
    const dp = P.gait * Math.PI * 0.9;
    dog.body.position.y = Math.abs(Math.sin(dp)) * 0.08;
    dog.legs.forEach((l, i) => { l.rotation.x = Math.sin(dp * 2 + (i < 2 ? 0 : Math.PI)) * 0.7; });
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
  if (perfT < 2) return;
  const fps = perfN / perfT; perfT = 0; perfN = 0;
  if (fps < 45 && quality > 0) {
    quality--;
    if (quality === 1) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    else { renderer.shadowMap.enabled = false; sun.castShadow = false; renderer.setPixelRatio(1); }
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
  if (DEMO) window.__s = { state, dist: Math.round(dist), fish: fishN, lives, speed: +speed.toFixed(1), lane: P.lane, obs: obstacles.length, roofs: roofs.length };
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
  const look = speed * 0.32;
  const ahead = obstacles.filter((o) => !o.hit && o.z < P.z - 0.3 && o.z > P.z - look - 2);
  const inLane = (o, l) => o.type === 'line' || o.lane === l;
  const danger = ahead.filter((o) => inLane(o, P.lane) && o.z > P.z - look);
  const roof = roofAt(P.z - speed * 0.16);
  if (P.ground && !roof) { act('up'); return; }
  if (!danger.length) return;
  const o = danger[0];
  if (o.type === 'ac' || (o.type !== 'line' && Math.random() < 0.3)) {
    const free = [P.lane - 1, P.lane + 1].filter((l) => l >= 0 && l <= 2 && !ahead.some((q) => inLane(q, l) && (q.type === 'ac' || Math.abs(q.z - o.z) < 3)));
    if (free.length) { act(free[0] < P.lane ? 'left' : 'right'); return; }
  }
  if (o.type === 'basket' && o.z > P.z - speed * 0.22) act('up');
  if ((o.type === 'sign' || o.type === 'line') && o.z > P.z - speed * 0.2) act('down');
}

resize();
reset();
requestAnimationFrame(frame);
if (DEMO) start();

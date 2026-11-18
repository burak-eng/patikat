// Patikat 3B Kedi Evi: odalar, esyalar ve 360 derece cevrilebilen 3B kedi.
// Oyun mantigi (bakim, oyuncak, mini oyunlar) game.js'te kalir; bu dosya yalnizca 3B sahneyi cizer.
// game.js window.PH uzerinden durumu verir; ustteki seffaf tuvale efektler (kopuk, kalp, balon) cizilmeye devam eder.
import * as THREE from './lib/three.module.js';
import { makeCat, poseHouse, sphere } from './cat3d.js';

const PH = window.PH;
const glCv = document.getElementById('houseGL');
if (PH && glCv) {
  try { init(); } catch (e) { console.warn('3B ev acilamadi, 2B ev kullanilir', e); }
}

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas: glCv, antialias: (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: location.search.includes('shot') });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const K = 0.012; // oda birimi (300x390) -> dunya birimi
  const X = (px) => (px - PH.HW / 2) * K;
  const camera = new THREE.PerspectiveCamera(50, PH.HW / PH.HH, 0.1, 50);
  const camY = (PH.FLOOR - PH.HH / 2) * K, camD = ((PH.HH * K) / 2) / Math.tan((25 * Math.PI) / 180);
  camera.position.set(0, camY, camD); camera.lookAt(0, camY, 0); // duz bakis: z=0 duzlemi ust tuvaldeki efektlerle hizali

  const hemi = new THREE.HemisphereLight(0xfff4e8, 0xc8b8d8, 2.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8cc, 2.0); sun.position.set(2, 5, 4); scene.add(sun);
  const lamp = new THREE.PointLight(0xffc878, 0, 6, 1.5); lamp.position.set(1.6, 1.6, -1.2); scene.add(lamp);

  // ---------- dokular ----------
  const tex = (w, h, draw, rx = 1, ry = 1) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
  };
  const stripes = (a, b) => tex(128, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 8, h); }, 6, 3);
  const tiles = (a, line, n = 8) => tex(128, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 2; for (let i = 0; i <= w; i += w / 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, n, n * 0.6);
  const checker = (a, b) => tex(128, 128, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * 32, y * 32, 32, 32); } }, 4, 3);
  const parquet = (a, b) => tex(256, 128, (g, w, h) => { for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -40 : 0; x < w; x += 80) { g.fillStyle = Math.random() < 0.5 ? a : b; g.fillRect(x, y, 78, 15); } g.fillStyle = 'rgba(80,40,20,0.15)'; for (let y = 15; y < h; y += 16) g.fillRect(0, y, w, 1); }, 3, 4);
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
  const ROOMS = {
    salon:  { wall: M(0xffffff, { map: stripes('#fbe8d8', '#fdf1e6') }), floor: M(0xffffff, { map: parquet('#cf9e74', '#c39066') }) },
    mutfak: { wall: M(0xffffff, { map: tiles('#e7f0f2', '#c9dde2') }), floor: M(0xffffff, { map: checker('#efe8dc', '#d6ccbc') }) },
    banyo:  { wall: M(0xffffff, { map: tiles('#eef6f4', '#c6e0da', 10) }), floor: M(0xffffff, { map: tiles('#d9e7ef', '#bcd0de', 6) }) },
    yatak:  { wall: M(0xffffff, { map: stripes('#e6def0', '#efe9f6') }), floor: M(0xffffff, { map: parquet('#b99a7c', '#ad8e70') }) },
  };

  // ---------- oda ve esyalar ----------
  const RW = 2.3, BACK = -2.6;
  let roomGrp = null, roomKey = '', bowlFood = null;
  const box = (w, h, d, m, x, y, z, parent) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x, y, z); parent.add(k); return k; };
  const cyl = (rt, rb, h, m, x, y, z, parent, seg = 24) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); k.position.set(x, y, z); parent.add(k); return k; };
  const ball = (r, m, x, y, z, parent) => { const k = sphere(r, m, 20, 14); k.position.set(x, y, z); parent.add(k); return k; };
  const rbox = (w, h, d, r, m, x, y, z, parent) => { // yuvarlak kenarli kutu (kanepe, yastik)
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    box(w - 2 * r, h, d, m, 0, 0, 0, g); box(w, h - 2 * r, d - 2 * r, m, 0, 0, 0, g);
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, h - 2 * r, 6, 12), m); c.position.set(sx * (w / 2 - r), 0, 0); c.scale.z = (d - 0) / (2 * r) * 0.98; g.add(c); }
    return g;
  };
  function windowOn(parent, x, y, night) {
    const frame = M(0xffffff), sky = new THREE.MeshBasicMaterial({ map: tex(64, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, night ? '#2c3a68' : '#8ec5ea'); gr.addColorStop(1, night ? '#4d5d92' : '#fde2c8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = night ? '#fff3d0' : '#fff1c1'; g.beginPath(); g.arc(w * 0.7, h * 0.22, night ? 7 : 9, 0, 7); g.fill(); }) });
    box(1.05, 1.3, 0.06, frame, x, y, BACK + 0.02, parent);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.17), sky); s.position.set(x, y, BACK + 0.06); parent.add(s);
    box(0.05, 1.17, 0.03, frame, x, y, BACK + 0.08, parent); box(0.92, 0.05, 0.03, frame, x, y, BACK + 0.08, parent);
    const cur = M(0xe9a7b4);
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.35, 6, 12), cur); c.position.set(x + sx * 0.62, y - 0.05, BACK + 0.15); parent.add(c); }
  }
  function buildRoom(id) {
    if (roomGrp) scene.remove(roomGrp);
    roomGrp = new THREE.Group(); scene.add(roomGrp);
    const R = ROOMS[id], pl = PH.save.house.placed, night = PH.save.pet.sleep;
    // zemin, arka ve yan duvarlar, supurgelik
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, 5), R.floor); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, BACK + 2.5); roomGrp.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2, 6), R.wall); back.position.set(0, 3, BACK); roomGrp.add(back);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), R.wall); w.rotation.y = -sx * Math.PI / 2; w.position.set(sx * RW, 3, BACK + 2.5); roomGrp.add(w); }
    const base = M(0xffffff);
    box(RW * 2, 0.12, 0.04, base, 0, 0.06, BACK + 0.02, roomGrp);
    for (const sx of [-1, 1]) { const b = box(0.04, 0.12, 5, base, sx * (RW - 0.02), 0.06, BACK + 2.5, roomGrp); }
    bowlFood = null;
    if (id === 'salon') {
      windowOn(roomGrp, 1.0, 2.5, night);
      { const clock = cyl(0.26, 0.26, 0.05, M(0xffffff), -0.1, 3.3, BACK + 0.03, roomGrp, 32); clock.rotation.x = Math.PI / 2; const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 32), M(0xc9945a)); rim.position.set(-0.1, 3.3, BACK + 0.06); roomGrp.add(rim); const hh = box(0.03, 0.14, 0.01, M(0x3a3333), -0.1, 3.36, BACK + 0.07, roomGrp); hh.rotation.z = 0.6; box(0.02, 0.2, 0.01, M(0x3a3333), -0.1, 3.38, BACK + 0.075, roomGrp); } // duvar saati
      const sofa = M(0x8fb3cf), cush = M(0xa9c6dc), leg = M(0x6f5a48);
      rbox(1.7, 0.42, 0.75, 0.12, sofa, -1.15, 0.42, BACK + 0.55, roomGrp);
      rbox(1.7, 0.6, 0.22, 0.1, sofa, -1.15, 0.85, BACK + 0.2, roomGrp);
      for (const sx of [-1, 1]) rbox(0.22, 0.55, 0.75, 0.1, sofa, -1.15 + sx * 0.84, 0.6, BACK + 0.55, roomGrp);
      for (const sx of [-0.38, 0.38]) rbox(0.68, 0.14, 0.6, 0.06, cush, -1.15 + sx, 0.68, BACK + 0.6, roomGrp);
      for (const sx of [-0.75, 0.75]) box(0.06, 0.22, 0.06, leg, -1.15 + sx, 0.11, BACK + 0.85, roomGrp);
      if (pl.tablo) {
        box(0.9, 0.7, 0.05, M(0xb07a48), -1.15, 2.6, BACK + 0.03, roomGrp);
        const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.56), new THREE.MeshBasicMaterial({ map: tex(128, 96, (g, w, h) => { g.fillStyle = pl.tablo === 'tablo_ay' ? '#34406b' : '#bfe3f2'; g.fillRect(0, 0, w, h); g.fillStyle = pl.tablo === 'tablo_ay' ? '#fff3d0' : '#f0b45e'; g.beginPath(); if (pl.tablo === 'tablo_ay') g.arc(80, 40, 20, 0, 7); else { g.ellipse(64, 48, 30, 16, 0, 0, 7); g.moveTo(94, 48); g.lineTo(112, 34); g.lineTo(112, 62); } g.fill(); }) }));
        pic.position.set(-1.15, 2.6, BACK + 0.06); roomGrp.add(pic);
      }
      if (pl.hali === 'hali_pembe') { cyl(1.25, 1.25, 0.02, M(0xf2a6b8), 0, 0.01, -0.4, roomGrp, 40).scale.z = 0.45; cyl(0.95, 0.95, 0.025, M(0xf6c3cf), 0, 0.012, -0.4, roomGrp, 40).scale.z = 0.45; }
      if (pl.hali === 'hali_cizgi') { box(2.4, 0.02, 1.0, M(0x9cc3e6), 0, 0.01, -0.3, roomGrp); for (let x = -1.05; x < 1.1; x += 0.3) box(0.12, 0.025, 1.0, M(0xffffff), x, 0.012, -0.3, roomGrp); }
      if (pl.agac) { // kedi agaci
        const tall = pl.agac === 'agac_buyuk', post = M(0xd8c3a5), pad = M(0x9a7bb3);
        cyl(0.07, 0.07, tall ? 2.0 : 1.1, post, 1.75, (tall ? 2.0 : 1.1) / 2, -1.7, roomGrp);
        cyl(0.4, 0.4, 0.1, pad, 1.75, 0.05, -1.7, roomGrp); cyl(0.32, 0.32, 0.09, pad, 1.75, tall ? 1.0 : 1.1, -1.7, roomGrp);
        if (tall) cyl(0.3, 0.3, 0.09, pad, 1.75, 2.0, -1.7, roomGrp);
      }
      if (pl.bitki) {
        cyl(0.2, 0.15, 0.35, M(0xc8724f), 0.15, 0.17, BACK + 0.35, roomGrp);
        if (pl.bitki === 'bitki_palmiye') for (let i = 0; i < 6; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M(0x6fae6b)); lf.scale.set(0.25, 1, 0.5); lf.position.set(0.15 + Math.sin(i) * 0.2, 0.62, BACK + 0.35 + Math.cos(i) * 0.12); lf.rotation.z = Math.sin(i) * 0.8; roomGrp.add(lf); }
        else for (let i = 0; i < 6; i++) ball(0.07, M([0xf28fa8, 0xf6c35b, 0xb99be8, 0xffffff][i % 4]), 0.15 + Math.sin(i * 1.3) * 0.12, 0.42 + (i % 2) * 0.08, BACK + 0.35 + Math.cos(i * 1.3) * 0.08, roomGrp);
      }
    } else if (id === 'mutfak') {
      const wood = M(0xc9a77f), door = M(0xb8936a), top = M(0xeadfce);
      box(3.2, 0.9, 0.62, wood, 0.6, 0.45, BACK + 0.31, roomGrp); box(3.3, 0.06, 0.68, top, 0.6, 0.93, BACK + 0.34, roomGrp);
      for (let x = -0.7; x < 2.1; x += 0.65) { box(0.58, 0.72, 0.03, door, x + 0.3, 0.45, BACK + 0.63, roomGrp); ball(0.025, M(0x7a5a3a), x + 0.52, 0.55, BACK + 0.66, roomGrp); }
      box(2.4, 0.7, 0.35, wood, 0.9, 2.7, BACK + 0.18, roomGrp);
      box(0.75, 2.1, 0.7, M(0xf4f6f8, { roughness: 0.3 }), -1.75, 1.05, BACK + 0.4, roomGrp); box(0.04, 0.5, 0.04, M(0xd5dbe0), -1.45, 1.4, BACK + 0.77, roomGrp); // buzdolabi
      const gold = pl.mama === 'mama_altin', bm = M(gold ? 0xe9b44c : 0x6fa8dc, { metalness: gold ? 0.6 : 0.1, roughness: 0.35 });
      const bx = X(PH.BOWL_X);
      cyl(0.24, 0.19, 0.12, bm, bx, 0.06, 0.15, roomGrp, 28); cyl(0.2, 0.2, 0.005, M(0x9cc3e6), bx, 0.115, 0.15, roomGrp, 28);
      bowlFood = new THREE.Group(); roomGrp.add(bowlFood);
      for (let i = 0; i < 9; i++) ball(0.04, M(0xb57a46), bx + Math.cos(i * 2.4) * 0.12 * (i / 9), 0.13, 0.15 + Math.sin(i * 2.4) * 0.1 * (i / 9), bowlFood);
    } else if (id === 'banyo') {
      const white = M(0xffffff, { roughness: 0.3 });
      rbox(1.7, 0.6, 0.85, 0.2, white, -1.25, 0.3, BACK + 0.6, roomGrp); // kuvet
      box(1.4, 0.04, 0.55, M(0xcfe6f2, { roughness: 0.1 }), -1.25, 0.58, BACK + 0.6, roomGrp);
      for (let i = 0; i < 7; i++) ball(0.09, white, -1.8 + i * 0.18, 0.66, BACK + 0.6 + (i % 2) * 0.12, roomGrp);
      cyl(0.03, 0.03, 0.5, M(0xb9c3cc, { metalness: 0.7, roughness: 0.3 }), -0.5, 0.85, BACK + 0.2, roomGrp);
      const mir = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ map: tex(64, 80, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.5, '#cfe6f2'); gr.addColorStop(1, '#e8f4fb'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(18, 24, 5, 14, 0.3, 0, 7); g.fill(); }) }));
      cyl(0.47, 0.47, 0.03, M(0xb9c3cc, { metalness: 0.5, roughness: 0.3 }), 0.9, 2.5, BACK + 0.025, roomGrp, 32).rotation.x = Math.PI / 2; mir.scale.y = 1.25; mir.position.set(0.9, 2.5, BACK + 0.04); roomGrp.add(mir);
      box(0.6, 0.04, 0.06, M(0xb9c3cc), 1.75, 1.7, BACK + 0.06, roomGrp); box(0.4, 0.8, 0.04, M(0xf2a6b8), 1.75, 1.3, BACK + 0.1, roomGrp); // havlu
    } else if (id === 'yatak') {
      windowOn(roomGrp, 1.0, 2.5, night);
      const bed = pl.yatak, bxp = X(PH.BED_X);
      if (bed === 'yatak_bulut') { for (const [dx, r] of [[-0.42, 0.22], [-0.15, 0.27], [0.15, 0.26], [0.42, 0.21]]) ball(r, M(0xffffff, { roughness: 1 }), bxp + dx, 0.12, 0.15, roomGrp).scale.y = 0.55; }
      else { const tor = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 12, 32), M(0xc9945a)); tor.rotation.x = Math.PI / 2; tor.position.set(bxp, 0.14, 0.12); tor.scale.y = 0.75; roomGrp.add(tor); cyl(0.55, 0.55, 0.1, M(bed ? 0xe9b4c0 : 0xd7c3e8, { roughness: 1 }), bxp, 0.06, 0.12, roomGrp, 32); }
      cyl(0.03, 0.03, 1.2, M(0x8a7a6a), 1.6, 0.6, -1.4, roomGrp); cyl(0.2, 0.25, 0.05, M(0x8a7a6a), 1.6, 0.03, -1.4, roomGrp);
      cyl(0.18, 0.32, 0.4, new THREE.MeshStandardMaterial({ color: night ? 0xffe2a0 : 0xf6d5b0, emissive: 0xffc878, emissiveIntensity: night ? 0.9 : 0.1 }), 1.6, 1.3, -1.4, roomGrp);
    }
    // gece: oda loslasir, abajur yanar
    const dim = night && id === 'yatak';
    hemi.intensity = dim ? 0.55 : night ? 1.3 : 2.0; sun.intensity = dim ? 0.15 : night ? 1.0 : 2.0; lamp.intensity = dim ? 3 : 0;
    roomKey = id + '|' + JSON.stringify(pl) + '|' + night;
  }

  // ---------- kediler ----------
  const blobMat = new THREE.MeshBasicMaterial({ map: tex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(60,40,50,0.4)'); gr.addColorStop(1, 'rgba(60,40,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false });
  const blob = (s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * 0.7), blobMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.01; return m; };
  let cat = null, catKey = '';
  const catShadow = blob(1.2); scene.add(catShadow);
  function ensureCat() {
    const def = PH.catDef(); const key = JSON.stringify(def);
    if (key === catKey) return;
    if (cat) scene.remove(cat.root);
    cat = makeCat(def); cat.root.scale.setScalar(0.85); scene.add(cat.root); catKey = key;
  }
  const strayCats = new Map(), strayGrp = new THREE.Group(); scene.add(strayGrp);
  function placeStrays() {
    for (const s of strayCats.values()) s.cat.root.visible = false;
    const found = PH.STRAYS.filter((st) => PH.save.strays[st.id]), ri = PH.ROOMS.findIndex((q) => q.id === PH.pet.room);
    found.filter((_, i) => i % 4 === ri).slice(0, 4).forEach((st, j) => {
      let s = strayCats.get(st.id);
      if (!s) { const c = makeCat(st); c.root.scale.setScalar(0.5); c.root.add(blob(1.2)); strayGrp.add(c.root); s = { cat: c }; strayCats.set(st.id, s); }
      const [px, pose] = PH.STRAY_SPOTS[j];
      s.cat.root.visible = true; s.pose = pose; s.j = j;
      s.cat.root.position.set(X(px) * 1.05, 0, -0.75);
      s.cat.root.rotation.y = Math.PI + (px < PH.HW / 2 ? 0.6 : -0.6);
    });
  }

  // ---------- cizim dongusu ----------
  let lastKey = '', lastStrayKey = '';
  function resize() {
    const w = glCv.clientWidth, h = glCv.clientHeight;
    if (!w || !h) return false;
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (glCv.width !== Math.round(w * pr) || glCv.height !== Math.round(h * pr)) { renderer.setPixelRatio(pr); renderer.setSize(w, h, false); }
    return true;
  }
  function frame() {
    requestAnimationFrame(frame);
    if (PH.getState() !== 'menu' || !resize()) return;
    const hc = PH.hc, pet = PH.pet, p = PH.save.pet, t = performance.now() / 1000;
    const key = pet.room + '|' + JSON.stringify(PH.save.house.placed) + '|' + p.sleep;
    if (key !== lastKey) { buildRoom(pet.room); lastKey = key; }
    if (bowlFood) bowlFood.visible = !!pet.bowl;
    ensureCat();
    const sk = pet.room + '|' + Object.keys(PH.save.strays).join(',');
    if (sk !== lastStrayKey) { placeStrays(); lastStrayKey = sk; }
    for (const s of strayCats.values()) if (s.cat.root.visible) poseHouse(s.cat, s.pose === 0 ? 'sit' : s.pose === 1 ? 'sleep' : 'lie', t + s.j * 1.7, { happy: s.pose === 2 });
    // ana kedi: game.js'teki konum, eylem ve bakis yonu
    const act = hc.jy < 0 ? 'jump' : hc.act === 'ready' ? 'sit' : hc.act;
    cat.root.position.set(X(hc.x), -hc.jy * K, 0.1);
    cat.root.rotation.y = Math.PI + (hc.view || 0);
    poseHouse(cat, act, t, { gait: hc.gait, blink: (t % 4.2) < 0.12, closed: p.sleep && act !== 'walk', happy: pet.rubT > 0 || pet.tool === 'rinse' });
    catShadow.position.set(X(hc.x), 0.012, 0.1); const ss = 1 / (1 - hc.jy * K * 0.8); catShadow.scale.set(ss, ss, ss);
    renderer.render(scene, camera);
    window.H3D.ready = true;
  }
  window.H3D = { ready: false };
  requestAnimationFrame(frame);
}

// Patikat ortak 3B kedi modeli: kosu (3d.js) ve Kedi Evi (house3d.js) ayni kediyi kullanir.
// Kedinin renkleri ve deseni (tekir, duz, smokin, uc renkli, benekli, siyam, van) secilen kediden gelir.
import * as THREE from './lib/three.module.js';

export const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

export function furMat(color, sheen, map) {
  return new THREE.MeshStandardMaterial({ color, map: map || null, roughness: 0.92, emissive: new THREE.Color(sheen), emissiveIntensity: 0.06 });
}
const sphereCache = new Map();
export function sphere(r, mat, ws = 18, hs = 12) {
  const k = r.toFixed(3) + '|' + ws;
  if (!sphereCache.has(k)) sphereCache.set(k, new THREE.SphereGeometry(r, ws, hs));
  return new THREE.Mesh(sphereCache.get(k), mat);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
const col = (h) => new THREE.Color(h);
const hex = (c) => '#' + c.getHexString();

// Gövde/kafa dokusu: kure kutuplari omurga ekseninde (u = 0.75 sirt, 0.25 karin), v = burundan kuyruga
function furTexture(def, seed = 1) {
  const fur = col(def.fur), fur2 = col(def.fur2 || def.fur), belly = col(def.belly || '#ffffff'), fur3 = col(def.fur3 || def.fur2 || def.fur);
  let s = seed * 9301 + 49297; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return canvasTex(512, 256, (g, w, h) => {
    const p = def.pattern;
    for (let x = 0; x < w; x++) {
      const u = x / w, back = Math.max(0, Math.cos((u - 0.75) * TAU)), under = Math.max(0, Math.cos((u - 0.25) * TAU));
      let c = fur.clone();
      if (p === 'van' || p === 'spots' || p === 'calico') c = belly.clone().lerp(fur, 0.15); // acik zemin
      if (p === 'points') c = fur.clone();
      c.lerp(belly, Math.min(1, under * (p === 'tuxedo' ? 1.6 : 1.1))); // karin acik
      if (p === 'solid' || p === 'tabby' || p === 'tuxedo') c.lerp(fur.clone().multiplyScalar(0.86), back * 0.35); // sirt biraz koyu
      g.fillStyle = hex(c); g.fillRect(x, 0, 1, h);
    }
    const blot = (x, y, rx, ry, c, a = 1) => { g.globalAlpha = a; g.fillStyle = hex(c); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); g.globalAlpha = 1; };
    if (p === 'tabby') {
      for (let i = 0; i < 10; i++) {
        const y0 = 22 + i * 23 + (rnd() - 0.5) * 6, th = 5 + rnd() * 5;
        for (let x = 0; x < w; x++) {
          const u = x / w, back = Math.max(0, Math.cos((u - 0.75) * TAU));
          if (back < 0.2) continue;
          g.fillStyle = hex(fur2); g.globalAlpha = Math.min(1, (back - 0.2) * 1.3);
          g.fillRect(x, y0 + Math.sin(u * 28 + i) * 3, 1, th * back);
        }
      }
      g.globalAlpha = 1;
    } else if (p === 'calico') {
      for (let i = 0; i < 7; i++) blot(w * (0.45 + rnd() * 0.5), h * rnd(), 40 + rnd() * 50, 22 + rnd() * 30, i % 2 ? fur2 : fur3);
    } else if (p === 'spots') {
      for (let i = 0; i < 6; i++) blot(w * (0.55 + rnd() * 0.4), h * (0.1 + rnd() * 0.8), 26 + rnd() * 26, 16 + rnd() * 18, fur2);
    } else if (p === 'van') {
      blot(w * 0.75, h * 0.98, 80, 40, fur2, 0.9); // kuyruk dibi
    } else if (p === 'points') {
      const gr = g.createLinearGradient(0, h, 0, h * 0.6); gr.addColorStop(0, hex(fur2)); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.55; g.fillStyle = gr; g.fillRect(0, h * 0.6, w, h * 0.4); g.globalAlpha = 1;
    }
  });
}
function headTexture(def) { // kafa: alin cizgileri (tekir), van'da renkli tepe, siyamda koyu maske
  const fur = col(def.fur), fur2 = col(def.fur2 || def.fur), belly = col(def.belly || '#ffffff');
  return canvasTex(256, 128, (g, w, h) => {
    const p = def.pattern;
    for (let x = 0; x < w; x++) {
      const u = x / w, under = Math.max(0, Math.cos((u - 0.25) * TAU));
      let c = (p === 'van' || p === 'spots') ? belly.clone() : fur.clone();
      if (p === 'tuxedo') c.lerp(belly, Math.min(1, Math.max(0, under - 0.35) * 1.8));
      else if (p !== 'van') c.lerp(belly, under * 0.35);
      g.fillStyle = hex(c); g.fillRect(x, 0, 1, h);
    }
    if (p === 'tabby') { g.fillStyle = hex(fur2); for (let i = -1; i <= 1; i++) g.fillRect(w * 0.75 + i * 9 - 2, 10, 4, 36); } // alinda "M"
    if (p === 'van' || p === 'calico') { g.fillStyle = hex(fur2); g.beginPath(); g.ellipse(w * 0.75, 30, 40, 26, 0, 0, TAU); g.fill(); }
    if (p === 'points') { const gr = g.createLinearGradient(0, 0, 0, h * 0.45); gr.addColorStop(0, hex(fur2)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = 0.85; g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.45); g.globalAlpha = 1; }
  });
}

// def: { fur, fur2, fur3, belly, paws, eyes:[c,c], pattern }
export function makeCat(def) {
  def = def || { fur: '#e3a15e', fur2: '#c47f3f', belly: '#f4dcc0', eyes: ['#9bc46a', '#9bc46a'], pattern: 'tabby' };
  const p = def.pattern, dark = p === 'points' || p === 'van';
  const legCol = p === 'points' ? def.fur2 : p === 'van' || p === 'spots' ? def.belly : def.fur;
  const pawCol = def.paws || (p === 'points' ? def.fur2 : p === 'tuxedo' ? def.belly : def.belly);
  const C = {
    fur: furMat(0xffffff, 0xfff0dc, furTexture(def)), head: furMat(0xffffff, 0xfff0dc, headTexture(def)),
    plain: furMat(col(legCol), 0xffe8d0), cream: furMat(col(def.belly || '#f6e4cf'), 0xffffff), paw: furMat(col(pawCol), 0xffffff),
    ear: furMat(col(dark ? def.fur2 : def.fur), 0xffe8d0), tail: furMat(col(dark ? def.fur2 : def.fur), 0xffe8d0),
    ring: furMat(col(def.fur2 || def.fur), 0xffd9b0),
    pink: new THREE.MeshStandardMaterial({ color: 0xe8a0aa, roughness: 0.6 }),
    iris: new THREE.MeshStandardMaterial({ color: col(def.eyes ? def.eyes[0] : '#9bc46a'), roughness: 0.2, emissive: col(def.eyes ? def.eyes[0] : '#9bc46a'), emissiveIntensity: 0.25 }),
    iris2: new THREE.MeshStandardMaterial({ color: col(def.eyes ? def.eyes[1] : '#9bc46a'), roughness: 0.2, emissive: col(def.eyes ? def.eyes[1] : '#9bc46a'), emissiveIntensity: 0.25 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x15100f, roughness: 0.1 }), white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    whisker: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
  };
  const root = new THREE.Group(), sit = new THREE.Group(), body = new THREE.Group();
  root.add(sit); sit.add(body);
  const torsoGeo = new THREE.SphereGeometry(0.5, 40, 28); torsoGeo.rotateX(Math.PI / 2);
  const torso = new THREE.Mesh(torsoGeo, C.fur); torso.scale.set(0.82, 0.74, 1.08); torso.position.set(0, 0.5, 0.02); body.add(torso);
  const rump = sphere(0.36, C.fur); rump.scale.set(1.05, 0.95, 0.9); rump.position.set(0, 0.5, 0.3); rump.material = C.fur; body.add(rump);
  const chest = sphere(0.3, p === 'points' ? C.fur : C.cream); chest.scale.set(1, 1, 0.8); chest.position.set(0, 0.47, -0.4); body.add(chest);
  // bas: buyuk ve yuvarlak, iri gozler (Kedim ekranindaki kedi gibi)
  const head = new THREE.Group(); head.position.set(0, 0.92, -0.46); head.scale.setScalar(1.2); body.add(head);
  const skullGeo = new THREE.SphereGeometry(0.31, 36, 26); skullGeo.rotateX(Math.PI / 2);
  const skull = new THREE.Mesh(skullGeo, C.head); skull.scale.set(1.12, 0.96, 0.98); head.add(skull);
  const eyes = [];
  for (const s of [-1, 1]) {
    const cheek = sphere(0.15, p === 'tuxedo' || p === 'van' ? C.cream : C.plain); cheek.position.set(s * 0.2, -0.09, -0.08); cheek.scale.set(1, 0.85, 1); head.add(cheek);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 16), C.ear); ear.position.set(s * 0.17, 0.27, 0); ear.rotation.z = -s * 0.32; head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 12), C.pink); inner.position.set(s * 0.165, 0.25, -0.045); inner.rotation.z = -s * 0.32; head.add(inner);
    const eye = new THREE.Group(); eye.position.set(s * 0.13, 0.05, -0.24); head.add(eye);
    const iris = sphere(0.088, s < 0 ? C.iris : C.iris2, 20, 14); iris.scale.set(1, 1.15, 0.62); eye.add(iris);
    const pupil = sphere(0.05, C.pupil, 14, 10); pupil.scale.set(0.45, 1.5, 0.5); pupil.position.z = -0.042; eye.add(pupil);
    const glint = sphere(0.022, C.white, 8, 6); glint.position.set(s * 0.02 + 0.015, 0.035, -0.055); eye.add(glint);
    eyes.push(eye);
    const muzzle = sphere(0.085, C.cream); muzzle.position.set(s * 0.055, -0.1, -0.27); head.add(muzzle);
    const wpts = []; // biyiklar
    for (let i = 0; i < 3; i++) { wpts.push(new THREE.Vector3(s * 0.09, -0.09 + i * 0.012, -0.3), new THREE.Vector3(s * 0.36, -0.06 + (i - 1) * 0.05, -0.27)); }
    head.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wpts), C.whisker));
  }
  const nose = sphere(0.035, C.pink, 12, 8); nose.position.set(0, -0.04, -0.33); nose.scale.set(1.2, 0.8, 0.8); head.add(nose);
  // bacaklar (tek govdeye bagli: on ve arka birlikte hareket eder)
  const legs = [];
  const mkLeg = (x, z, front) => {
    const pivot = new THREE.Group(); pivot.position.set(x, front ? 0.36 : 0.4, z); body.add(pivot);
    if (!front) { const thigh = sphere(0.17, C.fur); thigh.position.set(0, -0.02, 0.02); thigh.scale.set(0.8, 1.1, 1.05); pivot.add(thigh); }
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.2, 6, 14), C.plain); leg.position.y = -0.17; pivot.add(leg);
    const paw = sphere(0.1, C.paw, 16, 12); paw.scale.set(1, 0.7, 1.25); paw.position.set(0, -0.34, -0.03); pivot.add(paw);
    legs.push(pivot);
  };
  mkLeg(-0.17, -0.3, true); mkLeg(0.17, -0.3, true); mkLeg(-0.19, 0.3, false); mkLeg(0.19, 0.3, false);
  const tail = [];
  for (let i = 0; i < 16; i++) { const k = i / 15, s2 = sphere(0.095 - k * 0.04, p === 'tabby' && Math.floor(i / 2) % 3 === 1 ? C.ring : C.tail, 12, 8); body.add(s2); tail.push(s2); }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, sit, body, head, legs, tail, torso, eyes };
}

// ---------- Kedi Evi pozlari ----------
// act: sit | walk | chase | lie | sleep | eat | lick | stretch | jump ; t: zaman ; o: { gait, blink, happy }
const RUMP = new THREE.Vector3(0, 0.3, 0.44);
export function poseHouse(c, act, t, o = {}) {
  const [fl, fr, bl, br] = c.legs;
  let pitch = 0, lift = 0, headX = 0, headY = 0, fL = 0, fR = 0, bL = 0, bR = 0, tailMode = 'up', bodyY = 0, scaleY = 1;
  const g = (o.gait || 0) * Math.PI;
  if (act === 'sit' || act === 'lick') {
    pitch = 0.58; fL = fR = -pitch + 0.08; bL = bR = Math.PI / 2 - pitch + 0.15; headX = -pitch * 0.85; tailMode = 'floor';
    if (act === 'lick') { fR = -pitch - 1.2 + Math.sin(t * 7) * 0.15; headX = -pitch * 0.9 + 0.45; headY = 0.25; }
    scaleY = 1 + Math.sin(t * 2.2) * 0.012; // nefes
  } else if (act === 'lie' || act === 'sleep') {
    bodyY = -0.27; fL = fR = -1.45; bL = bR = 1.45; headX = act === 'sleep' ? 0.25 : 0; tailMode = 'curl';
    scaleY = 1 + Math.sin(t * 1.6) * 0.02;
  } else if (act === 'eat') {
    pitch = -0.12; headX = 0.55; fL = fR = 0.12; bL = bR = 0.05;
  } else if (act === 'stretch') {
    pitch = -0.32; fL = fR = -1.0 + 0.32; bL = bR = 0.3; headX = 0.1; tailMode = 'up';
  } else if (act === 'walk' || act === 'chase') {
    const sp = act === 'chase' ? 1 : 0.55, s = Math.sin(g * 2);
    fL = s * 0.6 * sp; fR = -s * 0.6 * sp; bL = -s * 0.6 * sp; bR = s * 0.6 * sp;
    lift = Math.abs(Math.sin(g * 2)) * 0.04 * sp; headX = -s * 0.03;
  } else if (act === 'jump') {
    fL = fR = -0.9; bL = bR = 0.9; pitch = -0.1;
  } else { fL = fR = bL = bR = 0; }
  // oturma: kalca sabit kalir, govde one-yukari doner
  c.sit.rotation.x = pitch;
  const cy = Math.cos(pitch), sy = Math.sin(pitch);
  c.sit.position.set(0, RUMP.y - (RUMP.y * cy - RUMP.z * sy) + bodyY + lift, RUMP.z - (RUMP.y * sy + RUMP.z * cy));
  c.body.position.set(0, 0, 0); c.body.rotation.set(0, 0, 0); c.body.scale.set(1, scaleY, 1);
  fl.rotation.x = fL; fr.rotation.x = fR; bl.rotation.x = bL; br.rotation.x = bR;
  c.head.rotation.set(headX, headY, act === 'sleep' ? 0.15 : 0);
  // gozler: kirpma, uyku, mutluluk
  const closed = act === 'sleep' || o.closed || o.blink;
  for (const e of c.eyes) e.scale.y = closed ? 0.12 : o.happy ? 0.45 : 1;
  // kuyruk
  const T = c.tail;
  if (tailMode === 'floor') { // yerde, yana kivrilir
    for (let i = 0; i < T.length; i++) { const k = i / (T.length - 1), a = k * 2.4 + Math.sin(t * 1.5) * 0.15 * k; T[i].position.set(Math.sin(a) * 0.32, 0.12 - Math.min(0.1, k * 0.2), 0.62 - Math.cos(a) * 0.3 + 0.1); }
    // govde egik oldugu icin kuyruk noktalarini govde cercevesine cevir
    const inv = new THREE.Matrix4().makeRotationX(-pitch);
    for (const s of T) { s.position.y -= c.sit.position.y; s.position.z -= c.sit.position.z; s.position.applyMatrix4(inv); }
  } else if (tailMode === 'curl') { // uzanirken govdenin etrafina sarilir
    for (let i = 0; i < T.length; i++) { const k = i / (T.length - 1), a = -0.2 + k * 2.6; T[i].position.set(Math.sin(a) * 0.45, 0.42, 0.25 - Math.cos(a) * 0.45 + 0.2); }
  } else {
    let y = 0.62, z = 0.48, a = 0.85;
    for (let i = 0; i < T.length; i++) { const k = i / T.length; a += 0.036; const x = Math.sin(t * 2.6 - k * 2.2) * 0.07 * k; y += Math.sin(a) * 0.058; z += Math.cos(a) * 0.058; T[i].position.set(x, y, z); }
  }
}
export { clamp, lerp };

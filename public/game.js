'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo'); // test icin otomatik oynayan bot

  // ================= Sabitler (mantiksal birim; genislik hep 360) =================
  const W = 360;
  const WALL = 28;          // bina duvari kalinligi
  const SPIKE = 18;         // kaktus/klima derinligi
  const TOOTH = 14;         // kaktus bogumu
  const R = 13;             // kedi carpisma yaricapi (gorseli biraz daha buyuk, affedici)
  const JUMP_BASE = 0.2;    // normal ziplama suresi (sn)
  const JUMP_RAIN = 0.24;   // yagmurda kaygan duvar
  const JUMP_MAX = 0.24;    // parkur uretimi hep en uzun sureyi hesaba katar (adil kalsin)
  const STICKY_EXTRA = 0.35; // bal: iki dokunus icin ek sure
  const BAR_W = 110, BAR_H = 18; // ortadaki camasir ipi
  const JET_REACH = 110, JET_H = 22, JET_PERIOD = 2.8; // fiskiye (tunelin ortasina ulasmaz)
  const METER = 40;         // 1 metre = 40 birim
  const STAGE_M = 200;      // sonsuz modda vakit degisim araligi (m)
  const DAILY_TRIES = 3;
  const CHASE_DUR = 14;     // kopek kovalamasi suresi (sn)
  const LEFT_X = WALL + R;
  const RIGHT_X = W - WALL - R;
  const COIN = '#e9b46a', COIN_HI = '#f6dcae';

  // Vakit paletleri: dusuk doygunluk, olculu kontrast, yanip sonme yok.
  const PALETTES = [
    { name: 'Gün Batımı',  skyTop: '#3d4a6d', skyBot: '#b98473', city: '#5a4a5c', wall: '#4b3f4a', mark: '#57495a', edge: '#665566', win: '#e8c27a', cactus: '#6fa36b', cactusDark: '#4f7d4c', moon: '#f2c98a', stars: 0,    cloud: 0.16 },
    { name: 'Akşam',       skyTop: '#2e3657', skyBot: '#6e5f80', city: '#3f3a55', wall: '#3a3448', mark: '#463e55', edge: '#55496a', win: '#e8c27a', cactus: '#6a9e6e', cactusDark: '#4b7a50', moon: '#efe6c8', stars: 0.3,  cloud: 0.11 },
    { name: 'Gece',        skyTop: '#1d2338', skyBot: '#34405e', city: '#262d44', wall: '#2b2f40', mark: '#353a4d', edge: '#424862', win: '#d9b76e', cactus: '#5f9470', cactusDark: '#447256', moon: '#e9e4d0', stars: 0.6,  cloud: 0.07 },
    { name: 'Dolunay',     skyTop: '#20294a', skyBot: '#3e4c75', city: '#2a3352', wall: '#2d3347', mark: '#373e55', edge: '#48506c', win: '#d9b76e', cactus: '#629a74', cactusDark: '#46785a', moon: '#f5f0dc', stars: 0.5,  cloud: 0.09 },
    { name: 'Gece Yarısı', skyTop: '#12151f', skyBot: '#1f2433', city: '#191c27', wall: '#1f222c', mark: '#272a36', edge: '#30343f', win: '#b8995c', cactus: '#567f63', cactusDark: '#3d604a', moon: '#cfcab8', stars: 0.7,  cloud: 0.04 },
    { name: 'Şafak',       skyTop: '#39466a', skyBot: '#a7868c', city: '#56495e', wall: '#463f4f', mark: '#524a5c', edge: '#625870', win: '#e3c48a', cactus: '#6ea36f', cactusDark: '#4f7f52', moon: '#f3d3a0', stars: 0.12, cloud: 0.18 },
    { name: 'Sabah',       skyTop: '#5c7fa8', skyBot: '#b6cadb', city: '#7d8ea3', wall: '#5b5d6e', mark: '#686a7c', edge: '#7a7c8f', win: '#cfd8e3', cactus: '#5e9a5f', cactusDark: '#447a47', moon: '#fff4d6', stars: 0,    cloud: 0.28 },
  ];

  // Sonsuz modda her 200 m'de bir yeni vakit ve yeni zorluklar
  const ALL = { bars: true, ac: true, power: true, jets: true, weather: true, long: true, sticky: true, crows: true, dogs: true };
  const STAGES = [
    { pal: 0, sub: 'Kaktüslere değme, balık ye' },
    { pal: 1, sub: 'Çamaşır ipleri, klimalar ve kargalar', bars: true, ac: true, crows: true },
    { pal: 2, sub: 'Fıskiyeler açıldı, hava değişebilir', bars: true, ac: true, crows: true, power: true, jets: true, weather: true },
    { pal: 3, sub: 'Bal damlıyor, bekçi köpeği uyanık', bars: true, ac: true, crows: true, power: true, jets: true, weather: true, long: true, sticky: true, dogs: true },
    { pal: 4, sub: 'Sokak lambaları söndü', ...ALL, dark: true },
    { pal: 5, sub: 'Hız artıyor', ...ALL },
    { pal: 6, sub: 'Günaydın! Yeni tur başlıyor', ...ALL },
  ];
  const stageAt = (i) => (i < STAGES.length ? STAGES[i] : STAGES[2 + ((i - STAGES.length) % (STAGES.length - 2))]);

  const WEATHERS = {
    clear: { name: 'Açık hava', sub: '' },
    rain:  { name: 'Yağmur', sub: 'Duvarlar kaygan, zıplamalar uzun sürer' },
    fog:   { name: 'Sis', sub: 'Yukarısı zor görünüyor' },
  };

  const DIFFS = {
    kolay:  { name: 'Kolay',  speed: 0.85, react: 1.3,  hit: 4, lives: 5, hunger: 3,   dog: 0.022 },
    normal: { name: 'Normal', speed: 1,    react: 1,    hit: 3, lives: 3, hunger: 4.2, dog: 0.03 },
    zor:    { name: 'Zor',    speed: 1.15, react: 0.85, hit: 2, lives: 2, hunger: 5.2, dog: 0.038 },
  };

  // Kediler: her birinin kendine ozgu yetenegi var
  const CATS = [
    { id: 'sarman', name: 'Sarman', price: 0,   fur: '#e3a15e', fur2: '#c47f3f', belly: '#f4dcc0', eyes: ['#9bc46a', '#9bc46a'], pattern: 'tabby',  ability: 'Çevik: +1 pati enerjisi' },
    { id: 'tekir',  name: 'Tekir',  price: 50,  fur: '#9a8f84', fur2: '#5e554d', belly: '#d9d0c4', eyes: ['#d9b84a', '#d9b84a'], pattern: 'tabby',  ability: 'Tedbirli: Tura kalkanla başlar' },
    { id: 'pamuk',  name: 'Pamuk',  price: 120, fur: '#f2efe9', fur2: '#e0dbd2', belly: '#ffffff', eyes: ['#7fb3d9', '#7fb3d9'], pattern: 'solid',  ability: 'Sakin: Yavaş Çekim +2 sn' },
    { id: 'kara',   name: 'Gece',   price: 250, fur: '#45454f', fur2: '#45454f', belly: '#55555f', eyes: ['#e8c547', '#e8c547'], pattern: 'solid',  ability: 'Gece gözü: Karanlık ve sis etkilemez', rim: true },
    { id: 'siyam',  name: 'Siyam',  price: 400, fur: '#eadfcd', fur2: '#6b4e3d', belly: '#f5eee2', eyes: ['#6fa8dc', '#6fa8dc'], pattern: 'points', ability: 'Dokuz canlı: +1 can' },
    { id: 'benek',  name: 'Benek',  price: 500, fur: '#f2ece3', fur2: '#d9904a', fur3: '#3a3333', belly: '#ffffff', eyes: ['#9bc46a', '#9bc46a'], pattern: 'calico', ability: 'Şanslı: Balıklar 2 kat değerli' },
    { id: 'van',    name: 'Van',    price: 700, fur: '#f4f1ea', fur2: '#c9884d', belly: '#ffffff', eyes: ['#6fa8dc', '#d9a441'], pattern: 'van',    ability: 'Yüzücü: Fıskiyeler ıslatamaz' },
  ];
  const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const OLD_CHAR = {
    kubo: 'sarman', kedi: 'tekir', robot: 'pamuk', hayalet: 'kara', ninja: 'siyam', uzayli: 'benek',
    kage: 'sarman', kizil: 'tekir', bambu: 'pamuk', kar: 'kara', gece: 'siyam', usta: 'benek',
  };

  // Gardirop: kedilere giydirilen aksesuarlar (slot basina bir tane)
  const COSMETICS = [
    { id: 'bere',   slot: 'hat',  name: 'Örgü Bere',      price: 60 },
    { id: 'cicek',  slot: 'hat',  name: 'Papatya',        price: 80 },
    { id: 'kasket', slot: 'hat',  name: 'Kasket',         price: 120 },
    { id: 'parti',  slot: 'hat',  name: 'Parti Şapkası',  price: 150 },
    { id: 'tac',    slot: 'hat',  name: 'Minik Taç',      price: 400 },
    { id: 'papyon', slot: 'neck', name: 'Papyon',         price: 70 },
    { id: 'zil',    slot: 'neck', name: 'Zilli Tasma',    price: 90 },
    { id: 'atki',   slot: 'neck', name: 'Kış Atkısı',     price: 140 },
    { id: 'gozluk', slot: 'face', name: 'Yuvarlak Gözlük', price: 100 },
    { id: 'gunes',  slot: 'face', name: 'Güneş Gözlüğü',  price: 180 },
  ];
  const COS_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
  const SLOT_NAMES = { hat: 'Baş', neck: 'Boyun', face: 'Yüz' };

  const POWERS = {
    shield: { name: 'Kalkan',      color: '#6fa8dc' },
    magnet: { name: 'Mıknatıs',    color: '#e07a7a' },
    slow:   { name: 'Yavaş Çekim', color: '#a99bd6' },
    mama:   { name: 'Mama',        color: '#7fb27a' },
  };

  // Dukkan yukseltmeleri: steps[i] = (i+1). seviyenin etkisi
  const UPGRADES = [
    { id: 'can',      name: 'Dokuz Can',      steps: ['Başlangıç canı +1', 'Başlangıç canı +2'], costs: [300, 800] },
    { id: 'kalkan',   name: 'Sağlam Kalkan',  steps: ['Kalkan 2 darbeye dayanır', 'Her tura kalkanla başla'], costs: [250, 600] },
    { id: 'miknatis', name: 'Güçlü Mıknatıs', steps: ['Mıknatıs 9 sn', 'Mıknatıs 11 sn', 'Mıknatıs 13 sn'], costs: [100, 220, 450] },
    { id: 'pati',     name: 'Pati Enerjisi',  steps: ['Pati enerjisi +1', 'Pati enerjisi +2'], costs: [150, 450] },
    { id: 'tokluk',   name: 'Tok Karın',      steps: ['Açlık %15 yavaş', 'Açlık %30 yavaş', 'Açlık %45 yavaş'], costs: [120, 260, 500] },
    { id: 'balik',    name: 'Balıkçı',        steps: ['Her balık 2 değerinde', 'Her balık 3 değerinde'], costs: [200, 600] },
  ];

  // Gorev turleri: hepsi "tek turda" olculur
  const MISSIONS = {
    fish:  { stat: 'fish',   tiers: [10, 20, 35, 50],     text: (n) => `Tek turda ${n} balık ye` },
    near:  { stat: 'near',   tiers: [5, 10, 20, 30],      text: (n) => `Tek turda ${n} kıl payı yap` },
    dist:  { stat: 'm',      tiers: [200, 400, 700, 1000], text: (n) => `Tek turda ${n} m'ye ulaş` },
    lines: { stat: 'lines',  tiers: [2, 5, 8, 12],        text: (n) => `Tek turda ${n} çamaşır ipini geç` },
    jets:  { stat: 'jets',   tiers: [1, 3, 5, 8],         text: (n) => `Kapalı fıskiyenin yanından ${n} kez geç` },
    dash:  { stat: 'dashes', tiers: [1, 3, 5, 8],         text: (n) => `Tek turda ${n} pati atılması yap` },
    power: { stat: 'powers', tiers: [1, 2, 4, 6],         text: (n) => `Tek turda ${n} güçlendirme al` },
    clean: { stat: 'cleanM', tiers: [150, 300, 500, 800], text: (n) => `Can kaybetmeden ${n} m git` },
    dog:   { stat: 'dogs',   tiers: [1, 2, 3, 5],         text: (n) => `Bekçi köpeğini ${n} kez atlat` },
    crow:  { stat: 'crows',  tiers: [1, 2, 4, 6],         text: (n) => `Kargadan ${n} kez balık kap` },
  };
  const MISSION_REWARD = [30, 50, 80, 120];

  // len: [en kisa, baslangic en uzun, sondaki en uzun]; react: [baslangic, son] tepki suresi (sn)
  const ENDLESS = { speed: 250, ramp: 0.008, cap: 230, react: [0.5, 0.24], len: [70, 130, 260], coins: 0.55, sameMax: 2, hunger: true };
  const LONG_LEN = [100, 180, 300];
  const LEVEL_DEFAULTS = { ramp: 0.005, cap: 80, react: [0.55, 0.38], len: [70, 120, 170], coins: 0.55, sameMax: 2, bars: 0, jets: 0, sticky: 0, ac: 0, power: false, dark: false, weather: 'clear', hunger: false, crows: false, dogs: false };
  const LEVELS = [
    { name: 'Bahçe Duvarı',    goal: 150, speed: 215, ramp: 0.003, cap: 40, react: [0.65, 0.5], pal: 0 },
    { name: 'Balık Pazarı',    goal: 200, speed: 225, coins: 0.95, react: [0.6, 0.45], pal: 5, hunger: true },
    { name: 'Çatı Katı',       goal: 250, speed: 235, power: true, ac: 0.3, react: [0.58, 0.42], pal: 1, hunger: true, crows: true },
    { name: 'Çamaşır Günü',    goal: 300, speed: 240, bars: 0.35, power: true, pal: 6, hunger: true, crows: true },
    { name: 'Fıskiye Sokağı',  goal: 300, speed: 245, jets: 0.3, power: true, pal: 6, hunger: true, crows: true },
    { name: 'Hızlı Pati',      goal: 350, speed: 290, ramp: 0.008, cap: 110, react: [0.48, 0.32], power: true, pal: 2, hunger: true, crows: true },
    { name: 'Bal Duvarı',      goal: 350, speed: 255, sticky: 0.35, power: true, pal: 5, hunger: true, crows: true },
    { name: 'Kaktüs Bahçesi',  goal: 400, speed: 265, len: [140, 220, 320], sameMax: 3, power: true, pal: 0, hunger: true, crows: true, dogs: true },
    { name: 'Yağmurlu Gece',   goal: 400, speed: 265, weather: 'rain', bars: 0.3, power: true, pal: 2, hunger: true, crows: true, dogs: true },
    { name: 'Karanlık Sokak',  goal: 400, speed: 255, dark: true, react: [0.58, 0.42], power: true, pal: 4, hunger: true, crows: true, dogs: true },
    { name: 'Sisli Sabah',     goal: 450, speed: 265, weather: 'fog', jets: 0.25, power: true, pal: 6, hunger: true, crows: true, dogs: true },
    { name: 'İp Cambazı',      goal: 450, speed: 280, bars: 0.6, react: [0.5, 0.34], power: true, pal: 3, hunger: true, crows: true, dogs: true },
    { name: 'Klima Kulesi',    goal: 500, speed: 280, ac: 0.5, sticky: 0.25, jets: 0.25, power: true, pal: 1, hunger: true, crows: true, dogs: true },
    { name: 'Gece Yarısı',     goal: 500, speed: 285, dark: true, bars: 0.4, jets: 0.2, react: [0.52, 0.34], power: true, pal: 4, hunger: true, crows: true, dogs: true },
    { name: 'Ay Işığı',        goal: 600, speed: 310, ramp: 0.01, cap: 150, react: [0.45, 0.26], bars: 0.4, jets: 0.2, sticky: 0.2, ac: 0.3, weather: 'rain', len: [90, 160, 280], power: true, pal: 3, hunger: true, crows: true, dogs: true },
  ];

  // Egitim: her mekanigi sirayla, yavaslatilmis ortamda gosterir (can gitmez)
  const TUTORIAL = { name: 'Eğitim', speed: 200, ramp: 0, cap: 0, react: [0.9, 0.9], len: [70, 84, 84], coins: 0.8, sameMax: 2, hunger: true, power: true, pal: 1, weather: 'clear', bars: 0, jets: 0, sticky: 0, ac: 0, crows: false, dogs: false };
  const TUTORIAL_SCRIPT = [
    { kind: 'spike', hint: ['Dokun!', 'Kedin karşı duvara zıplar. Kaktüslere değme.'] },
    { kind: 'spike' }, { kind: 'spike' },
    { kind: 'spike', fish: true, hint: ['Balık ye', 'Sol üstteki tokluk barını doldurur. Aç kalırsan can gider.'] },
    { kind: 'spike', fish: true },
    { kind: 'bar', hint: ['Çamaşır ipi', 'Ortadan geçerken ipe takılma. İpten önce ya da sonra zıpla.'] },
    { kind: 'jet', hint: ['Fıskiye', 'Açılıp kapanır. Su yetişmeden erken kaç!'] },
    { kind: 'spike' },
    { kind: 'sticky', hint: ['Bal', 'Bala yapışırsan ayrılmak için iki kez dokun.'] },
    { kind: 'empty', hint: ['Pati atılması', 'Zıplarken tekrar dokun: havada geri dönersin. Sağ üstteki patileri harcar.'] },
    { kind: 'ac', hint: ['Klima', 'Kaktüs gibi tehlikelidir.'] },
    { kind: 'power', hint: ['Güçlendirme', 'Kalkan, mıknatıs, yavaş çekim ve mama. Ortadan zıplarken kap.'] },
    { kind: 'spike', fish: true, trigger: 'crow', hint: ['Karga', 'Balık çalar. Balığı taşırken kargaya değersen geri alırsın.'] },
    { kind: 'spike', trigger: 'dog', hint: ['Bekçi köpeği', 'Çarparsan peşine düşer. Kıl payı geçişler ve balıklar onu uzaklaştırır.'] },
    { kind: 'spike', fish: true }, { kind: 'spike' }, { kind: 'spike', fish: true }, { kind: 'spike' }, { kind: 'spike' }, { kind: 'spike' },
  ];

  // ================= Kayit =================
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('dz_' + k); return v === null ? d : JSON.parse(v); }
      catch { return d; }
    },
    set(k, v) { if (DEMO) return; try { localStorage.setItem('dz_' + k, JSON.stringify(v)); } catch { /* yoksay */ } },
  };
  const save = {
    diff: store.get('diff', 'normal'),
    char: store.get('char', 'sarman'),
    owned: store.get('owned', ['sarman']),
    wallet: store.get('wallet', 0),
    stars: store.get('stars15', []),
    bestByDiff: store.get('bestByDiff', { kolay: 0, normal: store.get('best', 0), zor: 0 }),
    sound: store.get('sfx', true),     // ses artik varsayilan olarak acik
    music: store.get('music2', true),
    vibrate: store.get('vibrate', true),
    daily: store.get('daily', null),
    resume: DEMO ? null : store.get('resume', null),
    upg: store.get('upg', {}),
    missions: store.get('missions', { list: [], completed: 0 }),
    bestDist: store.get('bestDist', { kolay: 0, normal: 0, zor: 0 }),
    wardrobe: store.get('wardrobe', { owned: [], hat: '', neck: '', face: '' }),
    tutorialDone: store.get('tutorialDone', false),
    playerName: store.get('playerName', ''),
    playerId: store.get('playerId', ''),
  };
  const KEYS = { stars: 'stars15', sound: 'sfx', music: 'music2' };
  const persist = (k) => store.set(KEYS[k] || k, save[k]);
  if (!DIFFS[save.diff]) save.diff = 'normal';
  save.owned = [...new Set(['sarman', ...save.owned.map((id) => OLD_CHAR[id] || id).filter((id) => CAT_BY_ID[id])])];
  save.char = OLD_CHAR[save.char] || save.char;
  if (!save.owned.includes(save.char)) save.char = 'sarman';
  if (save.resume && save.resume.v !== 4) save.resume = null;
  if (!/^[a-f0-9]{16}$/.test(save.playerId)) {
    save.playerId = Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    persist('playerId');
  }
  if (DEMO && DIFFS[params.get('diff')]) save.diff = params.get('diff');
  if (DEMO && CAT_BY_ID[params.get('cat')]) save.char = params.get('cat');
  if (DEMO && params.get('wear')) for (const id of params.get('wear').split(',')) if (COS_BY_ID[id]) save.wardrobe[COS_BY_ID[id].slot] = id;
  const upg = (id) => save.upg[id] || 0;
  const catIs = (id) => save.char === id;
  const outfit = () => save.wardrobe;

  // ================= Rastgelelik =================
  // Parkur tohumlu (seed) rastgelelikle uretilir: Gunun Seferi'nde herkese ayni parkur gelir.
  let rngState = 1;
  function rnd() {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const grand = (a, b) => a + rnd() * (b - a);
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function dailySeed() {
    let h = 2166136261;
    for (const ch of 'duvar-zipla:' + todayKey()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function dailyState() {
    const key = todayKey();
    if (!save.daily || save.daily.date !== key) save.daily = { date: key, used: 0, best: 0, bestM: 0 };
    return save.daily;
  }
  const dailyLeft = () => DAILY_TRIES - dailyState().used;

  // ================= Palet (yumusak gecisli) =================
  const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const PAL_NUM = PALETTES.map((p) => {
    const o = {};
    for (const k in p) if (k !== 'name') o[k] = typeof p[k] === 'string' ? hexRgb(p[k]) : p[k];
    return o;
  });
  let palFrom = 0, palTo = 0, palT = 1, P = null;
  function computeP() {
    const a = PAL_NUM[palFrom], b = PAL_NUM[palTo], o = {};
    for (const k in a) {
      if (Array.isArray(a[k])) {
        const c = a[k].map((v, i) => Math.round(v + (b[k][i] - v) * palT));
        o[k] = `rgb(${c[0]},${c[1]},${c[2]})`;
        o[k + 'A'] = c.join(',');
      } else {
        o[k] = a[k] + (b[k] - a[k]) * palT;
      }
    }
    P = o;
  }
  function setPalette(i, instant = false) {
    if (instant) { palFrom = palTo = i; palT = 1; }
    else if (i !== palTo) { palFrom = palTo; palTo = i; palT = 0; }
    computeP();
  }

  // Arka plan suslemeleri (bir kez uretilir)
  const STARS = Array.from({ length: 40 }, () => ({ x: rand(WALL + 4, W - WALL - 4), y: rand(0, 900), r: Math.random() < 0.2 ? 2 : 1.3 }));
  const CLOUDS = Array.from({ length: 4 }, (_, i) => ({ x: rand(70, W - 70), y: i * 260 + rand(0, 120), w: rand(28, 46), h: rand(9, 14) }));
  const RAIN = Array.from({ length: 36 }, () => ({ x: rand(WALL, W - WALL), y: rand(0, 900), l: rand(8, 14) }));
  const SKYLINE = [];
  for (let x = WALL; x < W - WALL;) {
    const w = Math.round(rand(24, 50)), h = Math.round(rand(40, 130)), lights = [];
    for (let ly = 10; ly < h - 8; ly += 12) for (let lx = 5; lx < w - 6; lx += 9) if (Math.random() < 0.3) lights.push([lx, ly]);
    SKYLINE.push({ x, w, h, lights });
    x += w + 3;
  }

  // ================= Ekran olcekleme =================
  let H = 640, scale = 1, dpr = 1, safeTop = 0;
  const playerY = () => H * 0.72;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const gw = Math.min(vw, Math.round(vh * 0.62));
    scale = gw / W;
    H = vh / scale;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = gw + 'px';
    canvas.style.height = vh + 'px';
    canvas.width = Math.round(gw * dpr);
    canvas.height = Math.round(vh * dpr);
    document.documentElement.style.setProperty('--gw', gw + 'px');
    safeTop = ($('safe').offsetHeight || 0) / scale;
    if (player) {
      shiftWorld(playerY() - player.y);
      player.y = playerY();
    }
  }
  function shiftWorld(dy) {
    for (const arr of [obstacles, coins, powerups]) for (const o of arr) o.y += dy;
    lastTop += dy;
  }

  // ================= Ses: tamamen kodla uretilen efektler ve sakin muzik =================
  const audio = { ctx: null, sfx: null, music: null, noise: null, nextT: 0, step: 0, playing: false };
  function ac() {
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const c = new AC();
      audio.ctx = c;
      const master = c.createGain(); master.gain.value = 0.9; master.connect(c.destination);
      audio.sfx = c.createGain(); audio.sfx.gain.value = 0.8; audio.sfx.connect(master);
      audio.music = c.createGain(); audio.music.gain.value = 0.25; audio.music.connect(master);
      const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      audio.noise = buf;
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  }
  function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0, attack = 0.006, dest } = {}) {
    const c = audio.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || audio.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function hiss(dur, { freq = 1000, q = 1, vol = 0.15, delay = 0, sweep = 0 } = {}) {
    const c = audio.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = audio.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(audio.sfx);
    s.start(t);
    s.stop(t + dur + 0.05);
  }
  function glide(points, dur, { type = 'sawtooth', vol = 0.08, lp = 1800, delay = 0 } = {}) {
    const c = audio.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; f.type = 'lowpass'; f.frequency.value = lp;
    o.frequency.setValueAtTime(points[0][1], t);
    for (const [at, fr] of points.slice(1)) o.frequency.linearRampToValueAtTime(fr, t + at);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(audio.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  const SFX = {
    jump() { tone(300, 0.09, { type: 'triangle', vol: 0.1, slide: 540 }); hiss(0.05, { freq: 2600, vol: 0.04 }); },
    coin() { tone(1046, 0.12, { vol: 0.1 }); tone(1568, 0.18, { vol: 0.08, delay: 0.06 }); },
    near() { tone(1318, 0.1, { type: 'triangle', vol: 0.06 }); },
    hit() { tone(160, 0.25, { vol: 0.25, slide: 70 }); hiss(0.12, { freq: 400, vol: 0.1 }); },
    meow() { glide([[0, 480], [0.14, 820], [0.45, 430]], 0.48, { vol: 0.08 }); },
    bark() { for (const d of [0, 0.17]) { hiss(0.08, { freq: 650, q: 3, vol: 0.22, delay: d }); tone(230, 0.08, { type: 'square', vol: 0.05, slide: 160, delay: d }); } },
    caw() { for (const d of [0, 0.22]) glide([[0, 950], [0.16, 620]], 0.18, { vol: 0.06, lp: 2400, delay: d }); },
    dash() { hiss(0.18, { freq: 600, sweep: 2400, q: 0.8, vol: 0.1 }); },
    sticky() { tone(180, 0.15, { vol: 0.12, slide: 120 }); hiss(0.1, { freq: 300, vol: 0.05 }); },
    power() { [523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.08, delay: i * 0.06 })); },
    stage() { tone(659, 0.18, { vol: 0.09 }); tone(988, 0.3, { vol: 0.07, delay: 0.12 }); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.09, delay: i * 0.11 })); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.15 })); },
    splash() { hiss(0.3, { freq: 1800, q: 0.6, vol: 0.12, sweep: 600 }); },
    shield() { tone(400, 0.2, { vol: 0.1, slide: 200 }); },
    escape() { [784, 988, 1175].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.07, delay: i * 0.07 })); },
    ui() { tone(880, 0.05, { vol: 0.05 }); },
    click() { tone(660, 0.04, { type: 'triangle', vol: 0.05 }); hiss(0.02, { freq: 3000, vol: 0.02 }); },
    land() { tone(140, 0.07, { vol: 0.09, slide: 90 }); hiss(0.04, { freq: 900, vol: 0.03 }); },
    tick() { tone(740, 0.08, { type: 'triangle', vol: 0.08 }); },
    go() { tone(988, 0.12, { type: 'triangle', vol: 0.09 }); tone(1318, 0.2, { type: 'triangle', vol: 0.08, delay: 0.08 }); },
    start() { [392, 523, 659].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.08, delay: i * 0.07 })); },
    growl() { glide([[0, 110], [0.25, 85], [0.5, 100]], 0.55, { vol: 0.09, lp: 400 }); },
    spray() { hiss(0.35, { freq: 2200, q: 0.5, vol: 0.06, sweep: 1400 }); },
    energy() { tone(1046, 0.08, { vol: 0.05 }); tone(1397, 0.1, { vol: 0.04, delay: 0.05 }); },
    pause() { tone(523, 0.1, { vol: 0.06, slide: 392 }); },
    flap() { hiss(0.06, { freq: 500, q: 1.5, vol: 0.04 }); },
    buy() { tone(784, 0.1, { type: 'triangle', vol: 0.08 }); tone(1175, 0.16, { type: 'triangle', vol: 0.08, delay: 0.08 }); },
    nope() { tone(200, 0.12, { type: 'square', vol: 0.04 }); },
  };
  function sfx(name) {
    if (!save.sound || DEMO) return;
    try { if (ac()) SFX[name](); } catch { /* ses desteklenmiyor */ }
  }
  // Sakin fon muzigi: Cmaj7 - Am7 - Fmaj7 - G7, 80 bpm, yumusak arpej ve bas
  const CHORDS = [[261.6, 329.6, 392.0, 493.9], [220.0, 261.6, 329.6, 392.0], [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 349.2]];
  const EIGHTH = 60 / 80 / 2;
  const ARP = [0, 2, 1, 3, 2, 1, 3, 2];
  function musicTick() {
    const want = save.music && !DEMO && state !== 'pause' && !document.hidden;
    if (!want || !audio.ctx) { audio.playing = false; return; }
    const c = audio.ctx;
    if (!audio.playing) { audio.playing = true; audio.nextT = c.currentTime + 0.1; }
    try {
      while (audio.nextT < c.currentTime + 0.3) {
        const s = audio.step, ch = CHORDS[Math.floor(s / 16) % CHORDS.length], i = s % 8;
        const delay = Math.max(0, audio.nextT - c.currentTime);
        if (s % 16 === 0) tone(ch[0] / 2, EIGHTH * 15, { vol: 0.16, attack: 0.08, delay, dest: audio.music });
        if (i % 2 === 0 || (s * 7) % 5 < 2) tone(ch[ARP[i]] * 2, EIGHTH * 1.8, { type: 'triangle', vol: 0.06, attack: 0.02, delay, dest: audio.music });
        audio.nextT += EIGHTH;
        audio.step++;
      }
    } catch { /* yoksay */ }
  }
  // Yagmur sesi: yagmur yagarken kisik, surekli bir hisirti
  let rainSrc = null, rainGain = null;
  function rainAmbience() {
    const want = save.sound && !DEMO && audio.ctx && weather === 'rain' && (state === 'play' || state === 'count');
    try {
      if (want && !rainSrc) {
        const c = audio.ctx;
        rainSrc = c.createBufferSource(); rainSrc.buffer = audio.noise; rainSrc.loop = true;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
        rainGain = c.createGain(); rainGain.gain.setValueAtTime(0.0001, c.currentTime);
        rainGain.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 1.5);
        rainSrc.connect(f).connect(rainGain).connect(audio.sfx);
        rainSrc.start();
      } else if (!want && rainSrc) {
        const c = audio.ctx, s = rainSrc;
        rainGain.gain.setValueAtTime(Math.max(0.0001, rainGain.gain.value), c.currentTime);
        rainGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8);
        s.stop(c.currentTime + 0.9);
        rainSrc = null;
      }
    } catch { rainSrc = null; }
  }
  const vibrate = (ms) => { if (save.vibrate && navigator.vibrate) navigator.vibrate(ms); };

  // ================= Oyun durumu =================
  // state: menu | levels | chars | shop | missions | wardrobe | board | play | count | pause | over | win
  let state = 'menu';
  let run = null;
  let player = null, obstacles = [], coins = [], powerups = [], particles = [], floaters = [], crows = [];
  let speed = 0, dist = 0, bonus = 0, coinCount = 0, coinsSpawned = 0;
  let lastTop = 0, lastSide = 1, sameRun = 0, spawnDone = false;
  let shieldHP = 0, magnetT = 0, slowT = 0, invulnT = 0, shieldHits = 0;
  let lives = 3, maxLives = 3, tokluk = 100, energy = 3, energyMax = 3, energyT = 0, stickTaps = 0;
  let combo = 0, comboT = 0, runT = 0, jetClock = 0, missionT = 0;
  let chase = null, chaseCooldown = 0, crowT = 8, hintSlow = 0, dogEventDone = false;
  let stats = null;
  let bgOff = 0, clock = 0, overAt = 0, countT = 0;
  let stage = 0, darkAmt = 0, darkTarget = 0, fogAmt = 0, weather = 'clear';
  const toastMsg = { text: '', sub: '', t: 0 };

  const MENU_STATES = ['menu', 'levels', 'chars', 'shop', 'missions', 'wardrobe', 'board'];
  const meters = () => Math.floor(dist / METER);
  const score = () => meters() + bonus;
  const isMenuState = () => MENU_STATES.includes(state);
  const comboMult = () => Math.min(5, 1 + Math.floor(combo / 2));
  const diffOf = () => DIFFS[(run && run.diff) || save.diff];
  const jumpTime = () => (weather === 'rain' ? JUMP_RAIN : JUMP_BASE);
  const fishValue = () => (1 + upg('balik')) * (catIs('benek') ? 2 : 1);
  const hungerOn = () => !!(run && run.cfg.hunger) && (!DEMO || params.has('hunger'));
  const isWallHaz = (o) => o.type === 'spike' || o.type === 'jet';
  const jetPhase = (o) => (jetClock + o.phase) % JET_PERIOD;
  const jetOn = (o) => jetPhase(o) < JET_PERIOD * 0.5;
  const jetWarn = (o) => !jetOn(o) && jetPhase(o) > JET_PERIOD - 0.5;
  const isTutorial = () => run && run.mode === 'tutorial';

  function progress() {
    if (!run) return 0;
    return run.mode === 'level' || run.mode === 'tutorial' ? Math.min(1, dist / run.goal) : Math.min(1, dist / 20000);
  }
  // O anki mekaniklerin cikma olasiliklari
  function features() {
    if (run.mode !== 'endless' && run.mode !== 'daily') {
      const c = run.cfg;
      return { bars: c.bars, power: c.power, long: false, jets: c.jets, sticky: c.sticky, ac: c.ac, crows: c.crows, dogs: c.dogs };
    }
    const S = stageAt(stage), k = Math.max(0, stage - 1);
    return {
      bars: S.bars ? Math.min(0.45, 0.2 + 0.03 * k) : 0,
      power: !!S.power,
      long: !!S.long,
      jets: S.jets ? Math.min(0.3, 0.12 + 0.02 * k) : 0,
      sticky: S.sticky ? Math.min(0.3, 0.12 + 0.02 * k) : 0,
      ac: S.ac ? 0.25 : 0,
      crows: !!S.crows,
      dogs: !!S.dogs,
    };
  }
  function toast(text, sub = '', t = 2) { toastMsg.text = text; toastMsg.sub = sub; toastMsg.t = t; }
  function floater(text, color = '#f6dcae') {
    floaters.push({ text, color, x: W / 2, y: player.y - 34 - floaters.length * 16, t: 1 });
  }

  function reset() {
    player = { side: 0, x: LEFT_X, y: playerY(), jumping: false, jt: 0, dur: JUMP_BASE, fromX: LEFT_X, toX: LEFT_X, queued: false, squash: 0, wiggle: 0 };
    obstacles = []; coins = []; powerups = []; particles = []; floaters = []; crows = [];
    speed = 250; dist = 0; bonus = 0; coinCount = 0; coinsSpawned = 0;
    lastTop = -40; lastSide = 1; sameRun = 0; spawnDone = false;
    shieldHP = 0; magnetT = 0; slowT = 0; invulnT = 0; shieldHits = 0;
    combo = 0; comboT = 0; runT = 0; jetClock = 0; missionT = 0; stickTaps = 0;
    chase = null; chaseCooldown = 0; crowT = rand(7, 11); hintSlow = 0; dogEventDone = false;
    stats = { fish: 0, near: 0, lines: 0, jets: 0, dashes: 0, powers: 0, livesLost: 0, cleanM: -1, dogs: 0, crows: 0 };
    stage = 0; bgOff = 0; weather = 'clear';
  }

  function addCoin(x, y) { coins.push({ x, y, f: rnd() < 0.5 }); coinsSpawned++; }

  // Yeni engel ekranin ustunde uretilir. Karsi duvara gecis gerektiren her aralik
  // "zipla + tepki suresi"ne yetecek kadar uzun tutulur; bal varsa iki dokunus icin ek sure,
  // camasir ipi varsa aralik ikiye bolunur ve iki parca da ayri ayri bu sarti saglar.
  function spawn() {
    const cfg = run.cfg, df = diffOf(), d = progress();
    let item = null;
    if (run.script) {
      item = run.script.shift();
      if (!item) { spawnDone = true; run.goal = dist + (player.y - lastTop) + 160; return; }
    } else if (run.mode === 'level' && dist + (player.y - lastTop) > run.goal - 60) { spawnDone = true; return; }
    const F = features();
    const sameMax = F.long ? 3 : cfg.sameMax;
    const lenCfg = F.long ? LONG_LEN : cfg.len;
    const k = item ? item.kind : null;

    let side = rnd() < 0.5 ? 0 : 1;
    if (side === lastSide && sameRun >= sameMax) side = 1 - side;
    if (k === 'bar' || k === 'sticky' || k === 'power' || k === 'jet') side = 1 - lastSide;
    if (k === 'empty') side = lastSide;
    const switching = side !== lastSide;
    sameRun = switching ? 0 : sameRun + 1;

    const react = Math.max(0.18, lerp(cfg.react[0], cfg.react[1], d) * df.react);
    const need = speed * (JUMP_MAX + react) + 2 * R;
    let gap, barTop = null, sticky = false;
    if (switching) {
      const extra = grand(0, 90 * (1 - d) + 20);
      if (k === 'bar' || (!item && rnd() < F.bars)) {
        gap = 2 * need + BAR_H + extra;
        barTop = lastTop - (need + extra / 2) - BAR_H;
      } else {
        sticky = k === 'sticky' || (!item && rnd() < F.sticky);
        gap = need + extra + (sticky ? speed * STICKY_EXTRA : 0);
      }
    } else {
      gap = k === 'empty' ? need * 2.6 : grand(40, 110);
    }

    const isJet = k === 'jet' || (!item && rnd() < F.jets);
    let len, skin = 'cactus';
    if (isJet) len = JET_H;
    else if (k === 'ac' || (!item && rnd() < F.ac)) { skin = 'ac'; len = rnd() < 0.5 ? 56 : 70; }
    else {
      const lenMax = lerp(lenCfg[1], lenCfg[2], d);
      len = Math.max(TOOTH * 4, Math.round(grand(lenCfg[0], lenMax) / TOOTH) * TOOTH);
    }
    const bottom = lastTop - gap;
    const top = bottom - len;
    const ob = isJet ? { type: 'jet', side, y: top, h: len, phase: grand(0, JET_PERIOD) } : { type: 'spike', side, y: top, h: len, skin };
    if (item && item.hint) ob.hint = item.hint;
    if (item && item.trigger) ob.trigger = item.trigger;
    obstacles.push(ob);
    if (barTop !== null) obstacles.push({ type: 'bar', y: barTop, h: BAR_H, v: Math.floor(rnd() * 3) });
    // Bal: kedinin bu engelden once ayrilmasi gereken duvarda, gecis araligini kaplar
    if (sticky) obstacles.push({ type: 'sticky', side, y: bottom + 6, h: lastTop + 60 - (bottom + 6) });

    const forceFish = item && item.fish;
    if (switching) {
      const midY = barTop !== null ? (bottom + barTop) / 2 : bottom + gap / 2;
      if (k === 'power' || (!item && F.power && rnd() < 0.1)) {
        const kinds = ['magnet', 'slow'];
        if (shieldHP <= 0) kinds.push('shield');
        if (hungerOn() || energy < energyMax) kinds.push('mama');
        powerups.push({ kind: k === 'power' ? 'shield' : kinds[Math.floor(rnd() * kinds.length)], x: W / 2, y: midY });
      } else if (rnd() < cfg.coins) {
        addCoin(W / 2, midY); // havada yakalanan balik
      }
    }
    if ((!switching && rnd() < cfg.coins * 0.65) || forceFish) {
      const cx = side === 0 ? RIGHT_X : LEFT_X; // guvenli duvardaki balik sirasi
      for (let y = top + 20; y < bottom - 10; y += 42) addCoin(cx, y);
    }
    lastTop = top;
    lastSide = side;
  }

  // ================= Kopek ve karga =================
  function startChase(close0, why, dur = CHASE_DUR) {
    if (chase || chaseCooldown > 0) { if (chase) chase.close = Math.min(0.95, chase.close + 0.3); return; }
    chase = { close: close0, t: 0, dur, barkT: 0.4, hav: 0.6 };
    toast('Bekçi köpeği peşinde!', why || 'Kıl payı geç ve balık ye, uzaklaşsın', 2);
    sfx('bark');
  }
  function updateChase(dt, wdt) {
    if (chaseCooldown > 0) chaseCooldown -= dt;
    if (!chase) return;
    chase.t += wdt;
    chase.close = Math.max(0, chase.close + diffOf().dog * wdt);
    chase.hav = Math.max(0, chase.hav - dt);
    chase.barkT -= dt;
    if (chase.barkT <= 0) { chase.barkT = rand(1.8, 2.8); chase.hav = 0.7; sfx('bark'); }
    if (chase.close >= 1) {
      chase = null;
      chaseCooldown = 8;
      loseLife('dog');
    } else if (chase.t >= chase.dur) {
      chase = null;
      chaseCooldown = 6;
      stats.dogs++;
      bonus += 40;
      toast('Köpeği atlattın!', '+40 puan', 1.6);
      sfx('escape');
    }
  }

  function updateCrows(dt, dy) {
    const F = features();
    if (F.crows && !isTutorial()) crowT -= dt;
    if (crowT <= 0) {
      crowT = rand(8, 14);
      const targets = coins.filter((c) => !c.taken && !c.claimed && c.y > 50 && c.y < player.y - 140);
      if (targets.length) {
        const c = targets[Math.floor(Math.random() * targets.length)];
        c.claimed = true;
        const fromLeft = c.x > W / 2;
        crows.push({ x: fromLeft ? -20 : W + 20, y: Math.max(20, c.y - 90), dir: fromLeft ? 1 : -1, state: 'in', target: c, fish: false, flap: 0 });
        sfx('caw');
      }
    }
    for (const k of crows) {
      const fl = Math.floor(k.flap / Math.PI);
      k.flap += dt * 7;
      if (Math.floor(k.flap / Math.PI) !== fl && fl % 3 === 0) sfx('flap');
      if (k.state === 'in') {
        const t = k.target;
        if (!t || t.taken) { k.state = 'out'; continue; }
        const dx = t.x - k.x, dyy = t.y - k.y, d = Math.hypot(dx, dyy);
        const sp = 280 * dt;
        if (d < 10) {
          t.taken = true; t.stolen = true; coinsSpawned--;
          k.fish = true; k.state = 'out';
          sfx('caw');
        } else { k.x += (dx / d) * Math.min(sp, d); k.y += (dyy / d) * Math.min(sp, d) + dy * 0.2; }
      } else {
        k.x += k.dir * 200 * dt;
        k.y -= 50 * dt;
      }
      // kedi havada kargaya deyince baligi geri alir
      if (k.fish && player.jumping && Math.hypot(k.x - player.x, k.y - player.y) < R + 16) {
        k.fish = false;
        coinCount += 2; stats.fish += 2; stats.crows++; bonus += 20;
        tokluk = Math.min(100, tokluk + 18);
        floater('Kargadan balığı kaptın! +2', COIN);
        burst(k.x, k.y, '#4a4a55', 6, 120);
        if (chase) chase.close = Math.max(0, chase.close - 0.1);
        sfx('coin');
      }
    }
    crows = crows.filter((k) => k.x > -40 && k.x < W + 40 && k.y > -60);
  }

  // ================= Kedi hareketi =================
  function nearMiss() {
    combo++;
    comboT = 3;
    stats.near++;
    const m = comboMult();
    bonus += 5 * m;
    if (chase) chase.close = Math.max(0, chase.close - 0.07);
    floater(m > 1 ? `Kıl payı! x${m}` : 'Kıl payı!');
    sfx('near');
  }
  function checkNear(side, leaving) {
    for (const o of obstacles) {
      if (o.type !== 'spike' || o.side !== side) continue;
      const d = leaving ? player.y - R - (o.y + o.h) : o.y - (player.y + R);
      if (d > -2 && d < (leaving ? 50 : 40)) { nearMiss(); return; }
    }
  }
  function onSticky() {
    if (player.jumping) return false;
    for (const o of obstacles) {
      if (o.type === 'sticky' && o.side === player.side && player.y > o.y && player.y < o.y + o.h) return true;
    }
    return false;
  }

  function jump() {
    if (player.jumping) {
      if (player.jt < player.dur * 0.6 && energy >= 1) { dash(); return; }
      if (player.jt > player.dur - 0.09) player.queued = true; // inise yakin dokunusu kacirma
      return;
    }
    if (onSticky() && stickTaps < 1) {
      stickTaps++;
      player.wiggle = 1;
      if (chase) chase.close += 0.06;
      floater('Bala yapıştın! Tekrar dokun', '#e9c46a');
      sfx('sticky');
      return;
    }
    stickTaps = 0;
    checkNear(player.side, true);
    player.jumping = true;
    player.jt = 0;
    player.dur = jumpTime();
    player.fromX = player.x;
    player.side = 1 - player.side;
    player.toX = player.side === 0 ? LEFT_X : RIGHT_X;
    sfx('jump');
  }

  // Pati atilmasi: havadayken geri don (enerji harcar)
  function dash() {
    energy--;
    stats.dashes++;
    player.fromX = player.x;
    player.side = 1 - player.side;
    player.toX = player.side === 0 ? LEFT_X : RIGHT_X;
    player.dur = jumpTime() * Math.abs(player.toX - player.x) / (RIGHT_X - LEFT_X) + 0.02;
    player.jt = 0;
    floater('Pati!', '#c9d8ea');
    burst(player.x, player.y, 'rgba(220,225,235,0.7)', 5, 90);
    sfx('dash');
  }

  function updatePlayer(dt) {
    player.squash = Math.max(0, player.squash - dt * 5);
    player.wiggle = Math.max(0, player.wiggle - dt * 3);
    if (!player.jumping) return;
    player.jt += dt;
    const t = Math.min(1, player.jt / player.dur);
    player.x = player.fromX + (player.toX - player.fromX) * t;
    if (t >= 1) {
      player.jumping = false;
      player.x = player.toX;
      player.squash = 1;
      stickTaps = 0;
      checkNear(player.side, false);
      sfx('land');
      burst(player.side === 0 ? WALL + 2 : W - WALL - 2, player.y + 10, 'rgba(220,215,205,0.5)', 3, 60);
      if (player.queued) { player.queued = false; jump(); }
    }
  }

  function circleRect(cx, cy, r, x0, y0, x1, y1) {
    const nx = Math.max(x0, Math.min(cx, x1));
    const ny = Math.max(y0, Math.min(cy, y1));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function burst(x, y, color, n, sp) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(sp * 0.3, sp);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.35, 0.8), color, size: rand(2, 4), g: 300 });
    }
  }

  // Demo botu: kendi duvarindan tehlike gelince son anda ziplar (fiskiyeden biraz erken,
  // balda iki kez dokunur).
  function bot() {
    if (player.jumping) return;
    for (const o of obstacles) {
      const look = player.y - R - speed * (o.type === 'jet' ? 0.17 : 0.1);
      if (isWallHaz(o) && o.side === player.side && o.y + o.h >= look && o.y <= player.y + R) { jump(); return; }
    }
  }

  function collectPower(p) {
    stats.powers++;
    if (p.kind === 'shield') shieldHP = upg('kalkan') >= 1 ? 2 : 1;
    else if (p.kind === 'magnet') magnetT = 7 + 2 * upg('miknatis');
    else if (p.kind === 'slow') slowT = 4 + (catIs('pamuk') ? 2 : 0);
    else if (p.kind === 'mama') { tokluk = Math.min(100, tokluk + 50); energy = Math.min(energyMax, energy + 1); }
    toast(POWERS[p.kind].name, p.kind === 'mama' ? 'Karın doydu, +1 pati' : '', 1.1);
    burst(p.x, p.y, POWERS[p.kind].color, 6, 110);
    sfx('power');
    vibrate(20);
  }

  const HIT_REASON = { spike: 'Kaktüse değdin!', jet: 'Islandın!', bar: 'İpe takıldın!', hunger: 'Aç kaldın!', dog: 'Köpek yakaladı!' };
  function hit(kind) {
    if (kind === 'jet') sfx('splash');
    if (shieldHP > 0) {
      shieldHP--;
      invulnT = 1.2;
      shieldHits++;
      if (chase) chase.close = Math.min(0.95, chase.close + 0.2);
      burst(player.x, player.y, POWERS.shield.color, 8, 140);
      floater(shieldHP > 0 ? 'Kalkan çatladı' : 'Kalkan kırıldı', '#c9d8ea');
      vibrate(40);
      sfx('shield');
      return;
    }
    loseLife(kind);
  }
  function loseLife(kind) {
    if (isTutorial()) { // egitimde can gitmez
      invulnT = 1.2;
      floater('Eğitimde can gitmez, devam!', '#c9d8ea');
      sfx('hit');
      return;
    }
    lives--;
    stats.livesLost++;
    if (stats.cleanM < 0) stats.cleanM = meters();
    if (lives <= 0) { die(kind); return; }
    invulnT = 1.6;
    combo = 0;
    toast(HIT_REASON[kind] || 'Ah!', `${lives} can kaldı`, 1.4);
    burst(player.x, player.y, '#e07a7a', 8, 140);
    vibrate(60);
    sfx('hit');
    sfx('meow');
    if (kind !== 'dog') startChase(0.4, 'Gürültü bekçi köpeğini uyandırdı!');
  }

  // ================= Gorevler =================
  function refillMissions() {
    const M = save.missions;
    M.list = M.list.filter((m) => !m.done && MISSIONS[m.type]);
    while (M.list.length < 3) {
      const used = M.list.map((m) => m.type);
      const pool = Object.keys(MISSIONS).filter((k) => !used.includes(k));
      const type = pool[Math.floor(Math.random() * pool.length)];
      const tier = Math.min(3, Math.floor(M.completed / 3));
      M.list.push({ type, target: MISSIONS[type].tiers[tier], reward: MISSION_REWARD[tier], best: 0, done: false });
    }
    persist('missions');
  }
  function runStat(key) {
    if (key === 'm') return meters();
    if (key === 'cleanM') return stats.cleanM < 0 ? meters() : stats.cleanM;
    return stats[key] || 0;
  }
  function checkMissions() {
    if (isTutorial()) return;
    let changed = false;
    for (const m of save.missions.list) {
      if (m.done) continue;
      const v = runStat(MISSIONS[m.type].stat);
      if (v > m.best) { m.best = v; changed = true; }
      if (v >= m.target) {
        m.done = true;
        save.missions.completed++;
        save.wallet += m.reward;
        persist('wallet');
        toast('Görev tamam!', `${MISSIONS[m.type].text(m.target)} · +${m.reward} balık`, 2.2);
        sfx('win');
        changed = true;
      }
    }
    if (changed) persist('missions');
  }

  // ================= Siralama (Gunun Seferi) =================
  const API = (window.DZ_API || '') + '/api';
  let apiOk = null;
  async function apiCheck() {
    if (apiOk !== null) return apiOk;
    try {
      const r = await fetch(API + '/health', { cache: 'no-store' });
      apiOk = r.ok && !!(await r.json()).db;
    } catch { apiOk = false; }
    return apiOk;
  }
  async function submitDaily(s, m) {
    if (DEMO || !(await apiCheck())) return;
    try {
      await fetch(API + '/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: save.playerId, name: save.playerName || 'İsimsiz Kedi', score: s, meters: m, date: todayKey(), cat: save.char }),
      });
    } catch { /* cevrimdisi */ }
  }
  async function renderBoard() {
    $('nameInput').value = save.playerName;
    $('boardDate').textContent = todayKey();
    const box = $('boardList');
    box.innerHTML = '<p class="hint">Yükleniyor…</p>';
    if (!(await apiCheck())) {
      box.innerHTML = '<p class="hint">Sıralama sunucusuna ulaşılamadı. Oyunu bilgisayardaki sunucudan (BASLAT.bat) açtığında çalışır. Skorların yine de telefonunda saklanıyor.</p>';
      return;
    }
    try {
      const r = await fetch(`${API}/daily?date=${todayKey()}`, { cache: 'no-store' });
      const rows = await r.json();
      if (!rows.length) { box.innerHTML = '<p class="hint">Bugün henüz kimse oynamadı. İlk sen ol!</p>'; return; }
      box.innerHTML = rows.map((row, i) => `<div class="rk${row.id === save.playerId ? ' me' : ''}"><b>${i + 1}</b><span>${esc(row.name)}</span><small>${esc(CAT_BY_ID[row.cat] ? CAT_BY_ID[row.cat].name : '')} · ${Number(row.meters) || 0} m</small><em>${Number(row.score) || 0}</em></div>`).join('');
    } catch {
      box.innerHTML = '<p class="hint">Sıralama yüklenemedi.</p>';
    }
  }

  // ================= Tur baslat / bitir / kaydet =================
  function startRun(mode, lv = 0, opts = {}) {
    if (mode === 'daily' && !opts.resume && dailyLeft() <= 0) return;
    if (!opts.resume) discardResume();
    if (mode === 'daily' && !opts.resume) { dailyState().used++; persist('daily'); }
    const cfg = mode === 'level' ? { ...LEVEL_DEFAULTS, ...LEVELS[lv] } : mode === 'tutorial' ? TUTORIAL : ENDLESS;
    run = { mode, level: lv, cfg, goal: mode === 'level' ? cfg.goal * METER : Infinity, banked: false, diff: mode === 'daily' || mode === 'tutorial' ? 'normal' : save.diff };
    if (mode === 'tutorial') run.script = TUTORIAL_SCRIPT.map((s) => ({ ...s }));
    // Golge rakip: onceki en uzak mesafe (sonsuz kosuda zorluga gore, gunun seferinde gunluk)
    run.recordM = mode === 'endless' ? save.bestDist[run.diff] || 0 : mode === 'daily' ? dailyState().bestM || 0 : 0;
    run.passedRecord = false;
    reset();
    rngState = mode === 'daily' ? dailySeed() : (Math.random() * 4294967296) >>> 0;
    maxLives = DIFFS[run.diff].lives + upg('can') + (catIs('siyam') ? 1 : 0);
    lives = maxLives;
    energyMax = 3 + upg('pati') + (catIs('sarman') ? 1 : 0);
    energy = energyMax;
    energyT = 0;
    tokluk = 100;
    shieldHP = catIs('tekir') || upg('kalkan') >= 2 ? (upg('kalkan') >= 1 ? 2 : 1) : 0;
    if (mode === 'level' || mode === 'tutorial') {
      setPalette(cfg.pal, true);
      darkAmt = darkTarget = cfg.dark ? 1 : 0;
      weather = cfg.weather;
      if (!opts.resume && mode === 'level') toast(`${lv + 1}. Bölüm`, cfg.name + (weather !== 'clear' ? ` · ${WEATHERS[weather].name}` : ''));
    } else {
      setPalette(STAGES[0].pal, true);
      darkAmt = darkTarget = 0;
      if (!opts.resume) {
        toast(mode === 'daily' ? 'Günün Seferi' : PALETTES[STAGES[0].pal].name,
          mode === 'daily' ? `${dailyState().used}. deneme · herkes aynı parkurda` : `${DIFFS[run.diff].name} · ${STAGES[0].sub}`);
      }
    }
    fogAmt = weather === 'fog' ? 1 : 0;
    if (opts.resume) return;
    state = 'play';
    show(null);
    sfx('start');
  }

  function snapshot() {
    return {
      v: 4, mode: run.mode, level: run.level, diff: run.diff, oldY: player.y,
      player: { ...player }, obstacles, coins: coins.map((c) => ({ x: c.x, y: c.y, f: c.f })), powerups,
      speed, dist, bonus, coinCount, coinsSpawned, lastTop, lastSide, sameRun, spawnDone,
      shieldHP, magnetT, slowT, invulnT, shieldHits, stage, rngState, weather,
      lives, maxLives, tokluk, energy, energyMax, energyT, runT, jetClock, stats, chase, chaseCooldown, dogEventDone,
    };
  }
  function saveResume() {
    if (!run || DEMO || isTutorial()) return;
    save.resume = snapshot();
    persist('resume');
  }
  function clearResume() { if (save.resume) { save.resume = null; persist('resume'); } }
  function discardResume() { // yeni tur baslarsa yarim turdaki baliklar cuzdana gecer
    if (!save.resume) return;
    save.wallet += (save.resume.coinCount || 0) * fishValue();
    persist('wallet');
    clearResume();
  }
  function loadResume() {
    const d = save.resume;
    if (!d) return;
    clearResume();
    startRun(d.mode, d.level, { resume: true });
    run.diff = d.diff;
    player = { ...d.player };
    obstacles = d.obstacles; coins = d.coins; powerups = d.powerups;
    ({ speed, dist, bonus, coinCount, coinsSpawned, lastTop, lastSide, sameRun, spawnDone,
      shieldHP, magnetT, slowT, invulnT, shieldHits, stage, rngState, weather,
      lives, maxLives, tokluk, energy, energyMax, energyT, runT, jetClock, stats, chase, chaseCooldown, dogEventDone } = d);
    bgOff = dist;
    run.passedRecord = meters() >= run.recordM;
    shiftWorld(playerY() - d.oldY);
    player.y = playerY();
    if (run.mode !== 'level') {
      const st = stageAt(stage);
      setPalette(st.pal, true);
      darkAmt = darkTarget = st.dark ? 1 : 0;
    }
    fogAmt = weather === 'fog' ? 1 : 0;
    startCountdown();
  }

  function startCountdown() {
    state = 'count';
    countT = 3;
    show(null);
  }

  function bankCoins(extra = 0) {
    if (!run || run.banked) return 0;
    run.banked = true;
    const earned = coinCount * fishValue() + extra;
    save.wallet += earned;
    persist('wallet');
    return earned;
  }

  function die(kind) {
    state = 'over';
    overAt = performance.now();
    chase = null;
    const c = CAT_BY_ID[save.char];
    burst(player.x, player.y, c.fur, 10, 150);
    burst(player.x, player.y, c.fur2, 5, 130);
    vibrate(90);
    sfx('meow');
    sfx('lose');
    clearResume();
    checkMissions();
    const earned = bankCoins();
    let isBest = false;
    const why = HIT_REASON[kind] || '';
    if (run.mode === 'endless' && meters() > (save.bestDist[run.diff] || 0)) { save.bestDist[run.diff] = meters(); persist('bestDist'); }
    if (run.mode === 'daily' && meters() > (dailyState().bestM || 0)) { dailyState().bestM = meters(); persist('daily'); }
    const statLine = `Balık +${earned} · Kıl payı ${stats.near} · Köpek ${stats.dogs} · Karga ${stats.crows}`;
    if (run.mode === 'level') {
      $('overTitle').textContent = 'Miyav, olmadı!';
      $('overScore').textContent = '%' + Math.floor(progress() * 100);
      $('overInfo').textContent = `${why} Canların bitti.\n${run.level + 1}. ${run.cfg.name}\n${statLine}`;
    } else {
      const s = score();
      let line;
      if (run.mode === 'daily') {
        const ds = dailyState();
        isBest = s > ds.best;
        if (isBest) ds.best = s;
        persist('daily');
        $('overTitle').textContent = 'Günün Seferi';
        line = `Bugünün en iyisi: ${ds.best} · Kalan hak: ${dailyLeft()}`;
        submitDaily(ds.best, ds.bestM || meters());
      } else {
        isBest = s > (save.bestByDiff[run.diff] || 0);
        if (isBest) { save.bestByDiff[run.diff] = s; persist('bestByDiff'); }
        $('overTitle').textContent = 'Oyun bitti';
        line = `En iyi (${DIFFS[run.diff].name}): ${save.bestByDiff[run.diff]}`;
      }
      $('overScore').textContent = s;
      $('overInfo').textContent = `${why} ${meters()} m\n${statLine}\n${line}`;
    }
    $('overTap').textContent = run.mode === 'daily' && dailyLeft() <= 0 ? 'Bugünlük haklar bitti, yarın yeni parkur!' : 'Tekrar için dokun';
    $('newBest').classList.toggle('hidden', !isBest);
    $('pauseBtn').classList.add('hidden');
    setTimeout(() => { if (state === 'over') show('over'); }, 450);
  }

  function win() {
    state = 'win';
    overAt = performance.now();
    chase = null;
    clearResume();
    checkMissions();
    for (const c of [COIN, '#8fb8de', '#e89ab0']) burst(W / 2, H * 0.4, c, 6, 170);
    vibrate(30);
    sfx('win');
    $('pauseBtn').classList.add('hidden');
    if (isTutorial()) {
      const first = !save.tutorialDone;
      save.tutorialDone = true; persist('tutorialDone');
      const earned = bankCoins(first ? 50 : 0);
      $('winTitle').textContent = 'Eğitim tamam!';
      $('winStars').textContent = '🐾';
      $('winInfo').textContent = `Artık her şeyi biliyorsun.\nCüzdana +${earned}${first ? ' (ilk eğitim ödülü dahil)' : ''}`;
      $('nextBtn').classList.add('hidden');
      setTimeout(() => { if (state === 'win') show('win'); }, 500);
      return;
    }
    const ratio = coinsSpawned ? coinCount / coinsSpawned : 1;
    const stars = 1 + (ratio >= 0.5 ? 1 : 0) + (ratio >= 0.85 && stats.livesLost === 0 ? 1 : 0);
    const lv = run.level;
    if (stars > (save.stars[lv] || 0)) { save.stars[lv] = stars; persist('stars'); }
    const earned = bankCoins(stars * 10);
    $('winStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('winInfo').textContent = `Balık: ${coinCount}/${coinsSpawned} · Kayıp can: ${stats.livesLost}\nCüzdana +${earned}` +
      (stars < 3 ? '\n3 yıldız: balıkların %85\'i ve hiç can kaybetmemek' : '');
    const last = lv >= LEVELS.length - 1;
    $('winTitle').textContent = last ? 'Tüm bölümler bitti!' : `${lv + 1}. Bölüm tamam!`;
    $('nextBtn').classList.toggle('hidden', last);
    setTimeout(() => { if (state === 'win') show('win'); }, 500);
  }

  // ================= Guncelleme =================
  function update(dt) {
    clock += dt;
    toastMsg.t = Math.max(0, toastMsg.t - dt);
    if (palT < 1) { palT = Math.min(1, palT + dt / 2.5); computeP(); }
    darkAmt += (darkTarget - darkAmt) * Math.min(1, dt * 1.2);
    fogAmt += ((weather === 'fog' ? 1 : 0) - fogAmt) * Math.min(1, dt * 1.2);
    for (const d of RAIN) { d.y += 380 * dt; if (d.y > H + 20) { d.y -= H + 40; d.x = rand(WALL, W - WALL); } }
    let dy = 0;

    if (state === 'count') {
      const before = Math.ceil(countT);
      countT -= dt;
      if (countT <= 0) { state = 'play'; show(null); sfx('go'); }
      else if (Math.ceil(countT) !== before) sfx('tick');
    } else if (state === 'play') {
      const cfg = run.cfg, df = diffOf();
      if (magnetT > 0) magnetT -= dt;
      if (slowT > 0) slowT -= dt;
      if (invulnT > 0) invulnT -= dt;
      if (hintSlow > 0) hintSlow -= dt;
      if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
      // yavas cekim ve egitim ipuclari tum dunyayi yavaslatir
      const wdt = dt * (slowT > 0 ? 0.6 : 1) * (hintSlow > 0 ? 0.4 : 1);
      runT += wdt;
      jetClock += wdt;

      // pati enerjisi 10 sn'de bir dolar
      if (energy < energyMax) { energyT += dt; if (energyT >= 10) { energyT = 0; energy++; sfx('energy'); } } else energyT = 0;
      // aclik
      if (hungerOn() && runT > 6) {
        const wasFull = tokluk >= 25;
        tokluk -= df.hunger * (1 - 0.15 * upg('tokluk')) * (isTutorial() ? 0.4 : 1) * wdt;
        if (wasFull && tokluk < 25) { sfx('growl'); floater('Karnın guruldadı, balık ye!', '#e0a05f'); }
        if (tokluk <= 0) { tokluk = 60; loseLife('hunger'); if (state !== 'play') return; }
      }

      speed = (cfg.speed + Math.min(cfg.cap, dist * cfg.ramp)) * df.speed;
      dy = speed * wdt;
      dist += dy; bgOff += dy; lastTop += dy;
      for (const o of obstacles) o.y += dy;
      for (const c of coins) c.y += dy;
      for (const p of powerups) p.y += dy;
      while (!spawnDone && lastTop > -120) spawn();
      obstacles = obstacles.filter((o) => o.y < H + 20);
      coins = coins.filter((c) => !c.taken && c.y < H + 20);
      powerups = powerups.filter((p) => !p.taken && p.y < H + 20);

      if (run.mode === 'endless' || run.mode === 'daily') {
        const st = Math.floor(dist / (STAGE_M * METER));
        if (st !== stage) {
          stage = st;
          const S = stageAt(st);
          setPalette(S.pal);
          darkTarget = S.dark ? 1 : 0;
          let wsub = '';
          if (S.weather) {
            const r = rnd();
            const nw = r < 0.5 ? 'clear' : r < 0.75 ? 'rain' : 'fog';
            if (nw !== weather) { weather = nw; wsub = nw === 'clear' ? ' · Hava açtı' : ` · ${WEATHERS[nw].name}: ${WEATHERS[nw].sub}`; }
          }
          toast(PALETTES[S.pal].name, `${st * STAGE_M} m · ${S.sub}${wsub}`, 2.6);
          sfx('stage');
          if (S.dogs && rnd() < 0.35) startChase(0.15, 'Bekçi köpeği uyandı!');
        }
      } else if (run.mode === 'level' && cfg.dogs && !dogEventDone && progress() > 0.4) {
        dogEventDone = true;
        startChase(0.15, 'Bekçi köpeği uyandı!');
      }

      updatePlayer(wdt);
      if (DEMO) bot();
      updateChase(dt, wdt);
      if (state !== 'play') return;
      updateCrows(dt, dy);

      if (magnetT > 0) {
        for (const c of coins) {
          const ddx = player.x - c.x, ddy = player.y - c.y, dd = Math.hypot(ddx, ddy);
          if (dd < 160 && dd > 0) { const m = Math.min(dd, 520 * dt); c.x += (ddx / dd) * m; c.y += (ddy / dd) * m; }
        }
      }
      for (const c of coins) {
        if (!c.taken && Math.hypot(c.x - player.x, c.y - player.y) < R + 9) {
          c.taken = true;
          bonus += 10;
          coinCount++;
          stats.fish++;
          tokluk = Math.min(100, tokluk + 12);
          if (chase) chase.close = Math.max(0, chase.close - 0.025);
          burst(c.x, c.y, COIN, 4, 80);
          sfx('coin');
        }
      }
      for (const p of powerups) {
        if (Math.hypot(p.x - player.x, p.y - player.y) < R + 12) { p.taken = true; collectPower(p); }
      }

      // egitim ipuclari, gecilen camasir ipleri ve kapali fiskiyeler
      for (const o of obstacles) {
        if (o.hint && !o.hinted && o.y + o.h > 30) {
          o.hinted = true;
          toast(o.hint[0], o.hint[1], 3.4);
          hintSlow = 2.4;
          if (o.trigger === 'dog') { chaseCooldown = 0; startChase(0.2, 'Kıl payı geç ve balık ye, uzaklaşsın', 9); }
          if (o.trigger === 'crow') crowT = 0.6;
        }
        if (o.type === 'jet') { // ekrandaki fiskiye acilinca su sesi
          const on = jetOn(o);
          if (on && !o.wasOn && o.y > 0 && o.y < H) sfx('spray');
          o.wasOn = on;
        }
        if (o.type === 'jet' && !player.jumping && player.side === o.side && player.y > o.y - R && player.y < o.y + o.h + R) {
          o.sat = true;
          if (jetOn(o)) o.wet = true;
        }
        if (!o.passed && o.y > player.y + R) {
          o.passed = true;
          if (o.type === 'bar') stats.lines++;
          if (o.type === 'jet' && o.sat && !o.wet) { stats.jets++; bonus += 15; floater('Islanmadan geçtin! +15', '#c9d8ea'); }
        }
      }
      if (isTutorial()) crowT -= dt; // egitimde karga yalnizca ipucuyla gelir

      if (invulnT <= 0) {
        const hr = R - df.hit; // biraz affedici carpisma
        for (const o of obstacles) {
          let x0, x1, y0 = o.y, y1 = o.y + o.h;
          if (o.type === 'sticky') continue;
          if (o.type === 'bar') { x0 = W / 2 - BAR_W / 2; x1 = W / 2 + BAR_W / 2; }
          else if (o.type === 'jet') {
            if (!jetOn(o) || catIs('van')) continue;
            x0 = o.side === 0 ? WALL : W - WALL - JET_REACH; x1 = x0 + JET_REACH; y0 += 3; y1 -= 3;
          } else { x0 = o.side === 0 ? WALL : W - WALL - SPIKE; x1 = x0 + SPIKE; }
          if (circleRect(player.x, player.y, hr, x0, y0, x1, y1)) { hit(o.type); break; }
        }
      }

      if (state === 'play' && run.recordM > 20 && !run.passedRecord && meters() >= run.recordM) {
        run.passedRecord = true;
        toast('Rekorunu geçtin!', `Önceki en iyi: ${run.recordM} m`, 2);
        burst(W / 2, player.y - 40, COIN, 8, 140);
        sfx('escape');
        vibrate(25);
      }
      missionT += dt;
      if (state === 'play' && missionT > 0.5) { missionT = 0; checkMissions(); }
      if (state === 'play' && (run.mode === 'level' || run.mode === 'tutorial') && dist >= run.goal) win();
    }

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt + dy;
      p.vy += p.g * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) { f.t -= dt; f.y -= 18 * dt; }
    floaters = floaters.filter((f) => f.t > 0);
  }

  // ================= Cizim =================
  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  const dot = (g, x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const ell = (g, x, y, rx, ry, rot, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
  const tri = (g, a, b, c, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath(); g.fill(); };

  // Aksesuarlar (hepsi bu oyuna ozgu basit cizimler)
  function drawNeckItem(g, id, nx, ny, D, t) {
    if (id === 'papyon') {
      tri(g, [nx, ny], [nx - 5, ny - 3.5], [nx - 5, ny + 3.5], '#c76b6b');
      tri(g, [nx, ny], [nx + 5, ny - 3.5], [nx + 5, ny + 3.5], '#c76b6b');
      dot(g, nx, ny, 1.6, '#a35454');
    } else if (id === 'zil') {
      g.strokeStyle = '#8fb8de'; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(nx, ny - 1, 6.5, 2.2, 0, 0, Math.PI); g.stroke();
      dot(g, nx, ny + 2.5 + Math.sin(t * 6) * 0.4, 2.3, '#e9c46a');
      dot(g, nx, ny + 3.2, 0.6, '#8a6a2a');
    } else if (id === 'atki') {
      g.strokeStyle = '#7fb27a'; g.lineWidth = 3.4; g.lineCap = 'round';
      g.beginPath(); g.ellipse(nx, ny - 1, 6.5, 2.4, 0, 0, Math.PI); g.stroke();
      g.beginPath(); g.moveTo(nx - D * 3, ny + 1); g.quadraticCurveTo(nx - D * 7, ny + 6, nx - D * 9 + Math.sin(t * 3) * 1.2, ny + 10); g.stroke();
      g.strokeStyle = '#e9e4c9'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(nx - D * 6, ny + 4); g.lineTo(nx - D * 7.5, ny + 6); g.stroke();
    }
  }
  function drawHeadItem(g, id, hx, hy, D, fx) {
    if (id === 'bere') {
      g.fillStyle = '#d9705f';
      g.beginPath(); g.arc(hx, hy - 2, 9.3, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
      g.fillStyle = '#b85a4c'; rr(g, hx - 9.4, hy - 5, 18.8, 3.4, 1.7); g.fill();
      dot(g, hx, hy - 12.5, 3, '#f2efe9');
    } else if (id === 'kasket') {
      ell(g, hx, hy - 7.5, 8.8, 3.8, 0, '#6b7a8f');
      ell(g, hx + D * 7, hy - 5.8, 5.5, 1.9, D * 0.15, '#56637a');
      dot(g, hx, hy - 10.6, 1.3, '#56637a');
    } else if (id === 'parti') {
      tri(g, [hx - 4.5, hy - 7], [hx + 4.5, hy - 7], [hx + D * 1.5, hy - 20], '#8fb8de');
      g.strokeStyle = '#e9c46a'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(hx - 3, hy - 10.5); g.lineTo(hx + 3.4, hy - 10); g.moveTo(hx - 1.4, hy - 14.5); g.lineTo(hx + 2.4, hy - 14.2); g.stroke();
      dot(g, hx + D * 1.5, hy - 20.5, 2, '#e89ab0');
    } else if (id === 'tac') {
      g.fillStyle = '#e9c46a';
      g.beginPath();
      g.moveTo(hx - 6, hy - 7); g.lineTo(hx - 6, hy - 13); g.lineTo(hx - 3, hy - 10); g.lineTo(hx, hy - 14.5);
      g.lineTo(hx + 3, hy - 10); g.lineTo(hx + 6, hy - 13); g.lineTo(hx + 6, hy - 7); g.closePath(); g.fill();
      dot(g, hx, hy - 9.4, 1.4, '#e07a7a');
    } else if (id === 'cicek') {
      const cx = hx - D * 6.5, cy = hy - 9;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ell(g, cx + Math.cos(a) * 2.6, cy + Math.sin(a) * 2.6, 2, 1.3, a, '#f7f4ec'); }
      dot(g, cx, cy, 1.6, '#e9c46a');
    } else if (id === 'gozluk' || id === 'gunes') {
      const ys = hy - 1;
      if (id === 'gunes') { dot(g, fx - 3.2, ys, 3, 'rgba(35,35,45,0.88)'); dot(g, fx + 3.2, ys, 3, 'rgba(35,35,45,0.88)'); dot(g, fx - 4, ys - 1, 0.8, 'rgba(255,255,255,0.6)'); }
      g.strokeStyle = '#3a3036'; g.lineWidth = 0.9;
      g.beginPath(); g.arc(fx - 3.2, ys, 3, 0, Math.PI * 2); g.moveTo(fx + 6.2, ys); g.arc(fx + 3.2, ys, 3, 0, Math.PI * 2);
      g.moveTo(fx - 0.2, ys); g.lineTo(fx + 0.2, ys); g.moveTo(fx - D * 6.2, ys); g.lineTo(fx - D * 8.5, ys - 1); g.stroke();
    }
  }

  // Kediyi (0,0) merkezli cizer. dir: bakis yonu (1 = saga), pose: 'wall' | 'jump' | 'idle'
  function drawCat(g, c, dir, pose, t, wear) {
    const D = dir;
    const sway = Math.sin(t * 2.5) * 1.5;
    const blink = t % 4.3 < 0.12;
    const darkParts = c.pattern === 'points' || c.pattern === 'van';
    let body, head, tail, paws;
    if (pose === 'wall') {
      body = { x: -D * 2, y: 3, rx: 8, ry: 10, rot: 0 };
      head = { x: D * 2, y: -9 };
      tail = [-D * 1, 12, D * 7, 19, D * 9 + sway, 10];
      paws = [[-D * 10, -4], [-D * 10, 3], [-D * 9, 12], [-D * 4, 13]];
    } else if (pose === 'jump') {
      body = { x: 0, y: 2, rx: 11, ry: 7, rot: -D * 0.12 };
      head = { x: D * 9, y: -4 };
      tail = [-D * 9, 1, -D * 16, -6, -D * 20, -2 + sway];
      paws = [[D * 13, 6], [D * 10, 9], [-D * 10, 8], [-D * 13, 4]];
    } else {
      body = { x: 0, y: 5, rx: 9, ry: 10, rot: 0 };
      head = { x: 0, y: -8 };
      tail = [-D * 6, 13, -D * 15, 11, -D * 13, 0 + sway];
      paws = [[-4, 14], [4, 14], [-8, 13], [8, 13]];
    }
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';

    g.strokeStyle = darkParts ? c.fur2 : c.fur;
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(tail[0], tail[1]); g.quadraticCurveTo(tail[2], tail[3], tail[4], tail[5]); g.stroke();

    const pawCol = c.pattern === 'points' ? c.fur2 : c.fur;
    g.strokeStyle = pawCol;
    g.lineWidth = 4.4;
    for (const [px, py] of paws) {
      g.beginPath();
      g.moveTo(body.x + (px - body.x) * 0.25, body.y + (py - body.y) * 0.25);
      g.lineTo(px, py);
      g.stroke();
      dot(g, px, py, 2.6, pawCol);
    }

    ell(g, body.x, body.y, body.rx, body.ry, body.rot, c.fur);
    g.save();
    g.beginPath(); g.ellipse(body.x, body.y, body.rx, body.ry, body.rot, 0, Math.PI * 2); g.clip();
    if (pose === 'jump') ell(g, body.x, body.y + 4, body.rx * 0.7, body.ry * 0.45, 0, c.belly);
    else ell(g, body.x + D * 3, body.y + 2, body.rx * 0.55, body.ry * 0.6, 0, c.belly);
    if (c.pattern === 'tabby') {
      g.strokeStyle = c.fur2; g.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        if (pose === 'jump') { g.moveTo(body.x + i * 5, body.y - body.ry); g.quadraticCurveTo(body.x + i * 5 - D * 2, body.y - 2, body.x + i * 5, body.y + 1); }
        else { g.moveTo(body.x - body.rx, body.y + i * 5 - 2); g.quadraticCurveTo(body.x - D * 2, body.y + i * 5 - 4, body.x - D * 1, body.y + i * 5 - 1); }
        g.stroke();
      }
    } else if (c.pattern === 'calico') {
      dot(g, body.x - 3, body.y - 4, 5, c.fur2);
      dot(g, body.x + 4, body.y + 5, 4, c.fur3);
    }
    g.restore();

    const hx = head.x, hy = head.y;
    if (wear && wear.neck) drawNeckItem(g, wear.neck, lerp(hx, body.x, 0.5), lerp(hy, body.y, 0.5) + 1, D, t);

    const earCol = darkParts ? c.fur2 : c.fur;
    for (const s of [-1, 1]) {
      g.fillStyle = earCol;
      g.beginPath(); g.moveTo(hx + s * 7.5, hy - 2); g.lineTo(hx + s * 6, hy - 12.5); g.lineTo(hx + s * 0.5, hy - 7); g.closePath(); g.fill();
      g.fillStyle = '#e8a0a8';
      g.beginPath(); g.moveTo(hx + s * 6, hy - 4); g.lineTo(hx + s * 5.4, hy - 10); g.lineTo(hx + s * 2.5, hy - 7); g.closePath(); g.fill();
    }

    dot(g, hx, hy, 8.5, c.fur);
    g.save();
    g.beginPath(); g.arc(hx, hy, 8.5, 0, Math.PI * 2); g.clip();
    if (c.pattern === 'tabby') {
      g.strokeStyle = c.fur2; g.lineWidth = 1.4;
      g.beginPath();
      for (const ox of [-2.5, 0, 2.5]) { g.moveTo(hx + D * 1.5 + ox, hy - 8); g.lineTo(hx + D * 1.5 + ox * 0.8, hy - 5); }
      g.stroke();
    } else if (c.pattern === 'points') {
      ell(g, hx + D * 1.5, hy + 2, 5.5, 4.8, 0, c.fur2);
    } else if (c.pattern === 'calico') {
      dot(g, hx - D * 4, hy - 5, 4.5, c.fur2);
      dot(g, hx + D * 5, hy - 6, 3, c.fur3);
    } else if (c.pattern === 'van') {
      dot(g, hx - 5, hy - 7, 4, c.fur2);
      dot(g, hx + 5, hy - 7, 4, c.fur2);
    }
    g.restore();
    if (c.rim) {
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1;
      g.beginPath(); g.arc(hx, hy, 8.5, Math.PI * 0.9, Math.PI * 2.1); g.stroke();
    }

    const fx = hx + D * 2;
    if (c.pattern !== 'points') ell(g, fx, hy + 3.2, 3.6, 2.6, 0, c.belly);
    for (const [i, ex] of [[0, fx - 3.2], [1, fx + 3.2]]) {
      if (blink) {
        g.strokeStyle = '#2a2328'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(ex - 1.8, hy - 1); g.lineTo(ex + 1.8, hy - 1); g.stroke();
      } else {
        ell(g, ex, hy - 1, 2.1, 2.5, 0, c.eyes[i]);
        ell(g, ex + D * 0.5, hy - 1, 0.8, 2, 0, '#1d1a1f');
        dot(g, ex - 0.6, hy - 2, 0.55, 'rgba(255,255,255,0.9)');
      }
    }
    g.fillStyle = '#e48a9a';
    g.beginPath(); g.moveTo(fx - 1.3, hy + 1.6); g.lineTo(fx + 1.3, hy + 1.6); g.lineTo(fx, hy + 3); g.closePath(); g.fill();
    g.strokeStyle = c.rim || c.pattern === 'points' ? 'rgba(255,255,255,0.5)' : 'rgba(70,55,50,0.45)';
    g.lineWidth = 0.8;
    g.beginPath();
    for (const s of [-1, 1]) {
      g.moveTo(fx + s * 2.5, hy + 3); g.lineTo(fx + s * 10, hy + 1.5);
      g.moveTo(fx + s * 2.5, hy + 4); g.lineTo(fx + s * 10, hy + 5);
    }
    g.stroke();
    if (wear && wear.face) drawHeadItem(g, wear.face, hx, hy, D, fx);
    if (wear && wear.hat) drawHeadItem(g, wear.hat, hx, hy, D, fx);
    g.restore();
  }

  // Bekci kopegi Karabas: cephe temizleme asansoruyle asagidan yaklasir
  function drawDog() {
    if (!chase) return;
    const y = lerp(H + 30, player.y + 24, chase.close);
    if (y > H + 28) return;
    const x = W / 2;
    ctx.save();
    ctx.translate(x, y); ctx.scale(1.5, 1.5); ctx.translate(-x, -y);
    ctx.strokeStyle = 'rgba(200,200,210,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 30, -20); ctx.moveTo(x + 30, y); ctx.lineTo(x + 30, -20); ctx.stroke();
    // kopek
    const hy = y - 14, bob = Math.sin(clock * 5) * 1;
    ell(ctx, x, hy + 4 + bob, 13, 9, 0, '#a0714f');
    ell(ctx, x - 9, hy - 1 + bob, 4, 8, 0.35, '#6e4b33');
    ell(ctx, x + 9, hy - 1 + bob, 4, 8, -0.35, '#6e4b33');
    dot(ctx, x, hy - 2 + bob, 9, '#a0714f');
    ell(ctx, x, hy + 3 + bob, 5.5, 4, 0, '#d9b48f');
    dot(ctx, x, hy + 1 + bob, 1.8, '#2a2226');
    dot(ctx, x - 3.6, hy - 4 + bob, 1.4, '#2a2226');
    dot(ctx, x + 3.6, hy - 4 + bob, 1.4, '#2a2226');
    if (chase.hav > 0) ell(ctx, x, hy + 7 + bob, 2, 2.6, 0, '#e48a9a');
    dot(ctx, x - 7, y - 4, 2.6, '#a0714f');
    dot(ctx, x + 7, y - 4, 2.6, '#a0714f');
    // asansor sepeti ve kalan sure tabelasi
    ctx.fillStyle = '#7d8492'; rr(ctx, x - 34, y - 4, 68, 14, 3); ctx.fill();
    ctx.fillStyle = '#5f6675'; ctx.fillRect(x - 34, y - 4, 68, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x - 24, y + 4, 48, 3);
    ctx.fillStyle = '#9ccf8f'; ctx.fillRect(x - 24, y + 4, 48 * Math.max(0, 1 - chase.t / chase.dur), 3);
    if (chase.hav > 0) {
      ctx.globalAlpha = Math.min(1, chase.hav * 2);
      hudText('Hav!', x + 26, hy - 14, '800 14px system-ui, sans-serif', '#f2efe9');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawCrows() {
    for (const k of crows) {
      ctx.save();
      ctx.translate(k.x, k.y);
      ctx.scale(k.dir * 1.5, 1.5);
      const w = Math.sin(k.flap) * 5;
      tri(ctx, [-4, -1], [6, -1], [-1, -9 - w], '#3d3d48');
      ell(ctx, 0, 0, 9, 5, 0, '#4a4a55');
      dot(ctx, 8, -3, 4, '#4a4a55');
      tri(ctx, [11, -4], [11, -1.5], [16, -2.5], '#b9a98a');
      dot(ctx, 9, -4, 0.9, '#f2efe9');
      tri(ctx, [-8, -1], [-8, 2], [-15, 1], '#3d3d48');
      if (k.fish) drawFish(ctx, 2, 8, 0.8, false);
      ctx.restore();
    }
  }

  function drawFish(g, x, y, s, flip) {
    g.save();
    g.translate(x, y);
    g.scale(flip ? -s : s, s);
    g.fillStyle = COIN;
    g.beginPath(); g.ellipse(0, 0, 7, 4.2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-5, 0); g.lineTo(-11, -4.5); g.lineTo(-11, 4.5); g.closePath(); g.fill();
    ell(g, 1, -1.3, 3.5, 1.3, 0, COIN_HI);
    dot(g, 4, -1, 1, '#3a3036');
    g.restore();
  }

  function drawPowerIcon(g, kind) {
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    if (kind === 'shield') {
      g.moveTo(0, -6); g.lineTo(5, -3.5); g.lineTo(4, 3); g.lineTo(0, 6.5); g.lineTo(-4, 3); g.lineTo(-5, -3.5); g.closePath();
    } else if (kind === 'magnet') {
      g.arc(0, 0, 5, 0, Math.PI); g.moveTo(-5, 0); g.lineTo(-5, -6); g.moveTo(5, 0); g.lineTo(5, -6);
    } else if (kind === 'slow') {
      g.arc(0, 0, 6, 0, Math.PI * 2); g.moveTo(0, 0); g.lineTo(0, -4); g.moveTo(0, 0); g.lineTo(3, 1.5);
    } else { // mama kabi
      g.moveTo(-6, -1); g.lineTo(6, -1); g.moveTo(-6, -1); g.quadraticCurveTo(0, 9, 6, -1);
      g.moveTo(-2, -4); g.lineTo(-1, -2); g.moveTo(2, -4.5); g.lineTo(1.5, -2);
    }
    g.stroke();
  }
  function drawHeart(g, x, y, s, col) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(x - s * 0.26, y, s * 0.3, 0, Math.PI * 2);
    g.arc(x + s * 0.26, y, s * 0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath(); g.moveTo(x - s * 0.55, y + s * 0.08); g.lineTo(x + s * 0.55, y + s * 0.08); g.lineTo(x, y + s * 0.62); g.closePath(); g.fill();
  }
  function drawPaw(g, x, y, col) {
    dot(g, x, y + 2, 3.2, col);
    dot(g, x - 3.4, y - 1.8, 1.4, col); dot(g, x - 1.2, y - 3.6, 1.4, col);
    dot(g, x + 1.2, y - 3.6, 1.4, col); dot(g, x + 3.4, y - 1.8, 1.4, col);
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.skyTop);
    g.addColorStop(1, P.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    if (P.stars > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${(P.stars * 0.55).toFixed(3)})`;
      for (const s of STARS) ctx.fillRect(s.x, (s.y + bgOff * 0.02) % (H + 10), s.r, s.r);
    }
    const mx = W * 0.66, my = H * 0.16;
    ctx.globalAlpha = 0.16; dot(ctx, mx, my, 34, P.moon);
    ctx.globalAlpha = 0.9; dot(ctx, mx, my, 20, P.moon);
    ctx.globalAlpha = 1;

    if (P.cloud > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${P.cloud.toFixed(3)})`;
      for (const c of CLOUDS) {
        const y = ((c.y + bgOff * 0.06) % (H + 160)) - 80;
        ctx.beginPath();
        ctx.ellipse(c.x, y, c.w, c.h, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + c.w * 0.55, y + 4, c.w * 0.7, c.h * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const sy = H * 0.82 + bgOff * 0.12;
    if (sy < H + 5) {
      ctx.fillStyle = P.city;
      for (const b of SKYLINE) ctx.fillRect(b.x, sy - b.h, b.w, b.h + H);
      ctx.fillStyle = `rgba(${P.winA},0.45)`;
      for (const b of SKYLINE) for (const [lx, ly] of b.lights) ctx.fillRect(b.x + lx, sy - b.h + ly, 3, 4);
    }
  }

  function drawWalls() {
    const step = 170;
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : W - WALL;
      ctx.fillStyle = P.wall;
      ctx.fillRect(x, -20, WALL, H + 40);
      const off = side ? 60 : 0;
      const k0 = Math.ceil((-50 - bgOff - off) / step), k1 = Math.floor((H - bgOff - off) / step);
      const wx = side === 0 ? 5 : W - WALL + 7;
      for (let k = k0; k <= k1; k++) {
        const y = k * step + bgOff + off;
        ctx.fillStyle = P.mark;
        ctx.fillRect(wx - 2, y - 2, WALL - 8, 34);
        const lit = (((k * 7 + side * 3) % 5) + 5) % 5 < 3;
        ctx.fillStyle = lit ? `rgba(${P.winA},0.55)` : P.wall;
        ctx.fillRect(wx, y, WALL - 12, 30);
        ctx.fillStyle = P.edge;
        ctx.fillRect(wx - 3, y + 31, WALL - 6, 3);
      }
      ctx.fillStyle = P.edge;
      ctx.fillRect(side === 0 ? WALL - 2 : W - WALL, -20, 2, H + 40);
    }
  }

  function drawCactus(o) {
    const left = o.side === 0, base = left ? WALL : W - WALL, s = left ? 1 : -1;
    const depth = SPIKE - 4, y0 = o.y + 1, y1 = o.y + o.h - 1;
    ctx.fillStyle = P.cactus;
    rr(ctx, left ? base : base - depth, y0, depth, y1 - y0, 6);
    ctx.fill();
    for (let y = o.y + TOOTH / 2; y < o.y + o.h; y += TOOTH) dot(ctx, base + s * depth, y, 4, P.cactus);
    ctx.fillStyle = P.cactusDark;
    ctx.fillRect(base + s * depth * 0.45 - 1, y0 + 5, 2, y1 - y0 - 10);
    ctx.strokeStyle = 'rgba(240,238,225,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = o.y + TOOTH / 2; y < o.y + o.h; y += TOOTH) {
      const tx = base + s * (depth + 3.5);
      ctx.moveTo(tx, y); ctx.lineTo(tx + s * 3, y - 1.5);
      ctx.moveTo(tx, y); ctx.lineTo(tx + s * 3, y + 1.5);
    }
    ctx.stroke();
    dot(ctx, base + s * depth * 0.5, o.y + 2, 3.2, '#e89ab0');
    dot(ctx, base + s * depth * 0.5, o.y + 2, 1.2, '#f4d36b');
  }

  function drawAC(o) {
    const left = o.side === 0, x = left ? WALL : W - WALL - SPIKE;
    ctx.fillStyle = '#5f6675';
    ctx.fillRect(left ? WALL : W - WALL - 3, o.y + 6, 3, o.h - 12);
    ctx.fillStyle = '#9aa1ad';
    rr(ctx, x, o.y, SPIKE, o.h, 3); ctx.fill();
    ctx.fillStyle = '#7d8492';
    for (let yy = o.y + 6; yy < o.y + o.h - 14; yy += 5) ctx.fillRect(x + 3, yy, SPIKE - 6, 1.6);
    dot(ctx, x + SPIKE / 2, o.y + o.h - 8, 4.5, '#7d8492');
    dot(ctx, x + SPIKE / 2, o.y + o.h - 8, 1.5, '#9aa1ad');
    const dropY = o.y + o.h + ((jetClock * 30 + o.h) % 18);
    dot(ctx, x + SPIKE / 2, dropY, 1.5, 'rgba(143,184,222,0.6)');
  }

  function drawJet(o) {
    const left = o.side === 0, base = left ? WALL : W - WALL, s = left ? 1 : -1;
    ctx.fillStyle = '#7d8696';
    rr(ctx, left ? base : base - 12, o.y + 4, 12, o.h - 8, 3); ctx.fill();
    dot(ctx, base + s * 12, o.y + o.h / 2, 3.5, '#5f6675');
    const nx = base + s * 12, cy = o.y + o.h / 2;
    if (jetOn(o)) {
      const wob = Math.sin(jetClock * 6 + o.phase) * 1.2;
      ctx.fillStyle = 'rgba(143,184,222,0.5)';
      ctx.beginPath();
      ctx.moveTo(nx, cy - 3);
      ctx.quadraticCurveTo(nx + s * JET_REACH * 0.5, cy - 6 + wob, base + s * JET_REACH, cy - 5 + wob);
      ctx.lineTo(base + s * JET_REACH, cy + 6 + wob);
      ctx.quadraticCurveTo(nx + s * JET_REACH * 0.5, cy + 6 + wob, nx, cy + 3);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 4; i++) dot(ctx, base + s * (JET_REACH + 4 + ((jetClock * 40 + i * 9) % 18)), cy + (i - 1.5) * 3 + wob, 1.6, 'rgba(200,225,240,0.55)');
    } else if (jetWarn(o)) {
      for (let i = 0; i < 3; i++) dot(ctx, nx + s * (4 + i * 5), cy + ((jetClock * 20 + i * 4) % 8) - 2, 1.5, 'rgba(143,184,222,0.7)');
    }
  }

  function drawSticky(o) {
    const left = o.side === 0, base = left ? WALL : W - WALL;
    ctx.fillStyle = 'rgba(217,164,65,0.72)';
    rr(ctx, left ? base - 2 : base - 7, o.y, 9, o.h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(240,200,110,0.6)';
    ctx.fillRect(left ? base : base - 4, o.y + 4, 2, o.h - 8);
    for (let y = o.y + 18; y < o.y + o.h - 8; y += 34) ell(ctx, base + (left ? 7 : -7), y, 3, 5, 0, 'rgba(217,164,65,0.72)');
  }

  const CLOTH_COLORS = [['#8fb8de', '#e8a0a8', '#e9c46a'], ['#a9cf9b', '#c9b3e0', '#e8a0a8'], ['#e9c46a', '#8fb8de', '#d9d2c4']];
  function drawClothesline(o) {
    const ry = o.y + 2, x0 = W / 2 - BAR_W / 2, col = CLOTH_COLORS[o.v || 0];
    ctx.strokeStyle = 'rgba(230,225,210,0.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(WALL, ry - 3); ctx.quadraticCurveTo(W / 2, ry + 3, W - WALL, ry - 3); ctx.stroke();
    let x = x0 + 4;
    ctx.fillStyle = col[0];
    ctx.beginPath();
    ctx.moveTo(x + 6, ry); ctx.lineTo(x + 24, ry); ctx.lineTo(x + 30, ry + 5); ctx.lineTo(x + 26, ry + 8);
    ctx.lineTo(x + 24, ry + 6); ctx.lineTo(x + 24, ry + 16); ctx.lineTo(x + 6, ry + 16); ctx.lineTo(x + 6, ry + 6);
    ctx.lineTo(x + 4, ry + 8); ctx.lineTo(x, ry + 5); ctx.closePath(); ctx.fill();
    x = x0 + 46;
    ctx.fillStyle = col[1];
    ctx.fillRect(x, ry, 8, 11);
    rr(ctx, x, ry + 8, 13, 7, 3.5); ctx.fill();
    x = x0 + 70;
    ctx.fillStyle = col[2];
    rr(ctx, x, ry, 32, 16, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, ry + 11, 32, 2);
    ctx.fillStyle = '#c9b79c';
    for (const px of [x0 + 9, x0 + 29, x0 + 48, x0 + 74, x0 + 98]) ctx.fillRect(px, ry - 3, 2.5, 5);
  }

  function drawItems() {
    for (const c of coins) {
      if (c.taken || c.y < -20 || c.y > H + 20) continue;
      drawFish(ctx, c.x, c.y, 1, c.f);
    }
    for (const p of powerups) {
      if (p.y < -20 || p.y > H + 20) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      dot(ctx, 0, 0, 15, POWERS[p.kind].color + '33');
      dot(ctx, 0, 0, 12, POWERS[p.kind].color);
      drawPowerIcon(ctx, p.kind);
      ctx.restore();
    }
  }

  function drawFinish() {
    if (!run || (run.mode !== 'level' && run.mode !== 'tutorial') || !isFinite(run.goal)) return;
    const y = player.y - (run.goal - dist);
    if (y < -30 || y > H + 30) return;
    const sq = 12;
    for (let i = 0, x = WALL; x < W - WALL; x += sq, i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#e3e0d8' : '#4a4550';
        ctx.fillRect(x, y - sq + j * sq, Math.min(sq, W - WALL - x), sq);
      }
    }
  }

  function drawRecord() {
    if (!run || run.recordM <= 20 || run.passedRecord) return;
    const y = player.y - (run.recordM * METER - dist);
    if (y < -40 || y > H + 20) return;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = COIN_HI;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(WALL, y); ctx.lineTo(W - WALL, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.4;
    ctx.translate(W / 2, y - 22);
    ctx.scale(1.1, 1.1);
    drawCat(ctx, CAT_BY_ID[save.char], 1, 'idle', clock, outfit());
    ctx.restore();
    hudText(`Rekorun: ${run.recordM} m`, W / 2, y + 18, '700 13px system-ui, sans-serif', COIN_HI);
  }

  function drawPlayer() {
    if (state === 'over' || !player) return;
    const p = player;
    const dir = p.jumping ? Math.sign(p.toX - p.fromX) : (p.side === 0 ? 1 : -1);
    ctx.save();
    ctx.translate(p.x + Math.sin(clock * 40) * 1.5 * p.wiggle, p.y);
    if (invulnT > 0) ctx.globalAlpha = 0.5; // yanip sonme yerine sabit yari saydam
    ctx.scale(1.3, 1.3); // gorsel buyukluk (carpisma alani degismez)
    if (!p.jumping && p.squash > 0) ctx.scale(1 - 0.1 * p.squash, 1 + 0.06 * p.squash);
    drawCat(ctx, CAT_BY_ID[save.char], dir, p.jumping ? 'jump' : 'wall', clock, outfit());
    ctx.restore();
    if (shieldHP > 0) {
      ctx.strokeStyle = POWERS.shield.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = shieldHP > 1 ? 3 : 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, R + 12, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)) * 0.8;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawWeather() {
    const seeDark = catIs('kara') ? 0 : 1;
    if (weather === 'rain' && !isMenuState()) {
      ctx.strokeStyle = 'rgba(200,215,235,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of RAIN) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 2, d.y + d.l); }
      ctx.stroke();
    }
    const da = darkAmt * seeDark;
    if (da > 0.02 && player) {
      const cx = player.x, cy = player.y - 60;
      const g = ctx.createRadialGradient(cx, cy, 110, cx, cy, 360);
      g.addColorStop(0, 'rgba(10,12,18,0)');
      g.addColorStop(1, `rgba(10,12,18,${(0.8 * da).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    const fa = fogAmt * seeDark;
    if (fa > 0.02) {
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      g.addColorStop(0, `rgba(205,210,220,${(0.82 * fa).toFixed(3)})`);
      g.addColorStop(0.7, `rgba(205,210,220,${(0.45 * fa).toFixed(3)})`);
      g.addColorStop(1, 'rgba(205,210,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H * 0.5 + 20);
    }
  }

  function hudText(text, x, y, font, color, align = 'center') {
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(15,18,28,0.4)';
    ctx.fillText(text, x + 1, y + 1.5);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function wrapText(text, x, y, maxW, lh, font, color) {
    ctx.font = font;
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { hudText(line, x, y, font, color); line = w; y += lh; }
      else line = test;
    }
    if (line) hudText(line, x, y, font, color);
  }

  function drawHud() {
    if (isMenuState() || !run) return;
    const top = safeTop;
    if (run.mode === 'level' || run.mode === 'tutorial') {
      const goalM = isFinite(run.goal) ? Math.round(run.goal / METER) : null;
      hudText(goalM ? `${Math.min(meters(), goalM)} / ${goalM} m` : `${meters()} m · ${run.cfg.name}`, W / 2, top + 48, '800 24px system-ui, sans-serif', '#f2efe9');
      if (goalM) {
        const bw = W - 170, bx = (W - bw) / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        rr(ctx, bx, top + 58, bw, 6, 3); ctx.fill();
        ctx.fillStyle = COIN;
        rr(ctx, bx, top + 58, Math.max(6, bw * progress()), 6, 3); ctx.fill();
      }
    } else {
      hudText(String(score()), W / 2, top + 56, '800 36px system-ui, sans-serif', '#f2efe9');
    }
    if (comboMult() > 1) hudText(`Kıl payı x${comboMult()}`, W / 2, top + 82, '700 14px system-ui, sans-serif', '#f6dcae');

    const lx = WALL + 10;
    drawFish(ctx, lx + 12, top + 29, 1, false);
    hudText(String(coinCount), lx + 26, top + 35, '700 16px system-ui, sans-serif', COIN, 'left');
    for (let i = 0; i < maxLives; i++) drawHeart(ctx, lx + 8 + i * 15, top + 50, 12, i < lives ? '#e07a7a' : 'rgba(255,255,255,0.18)');
    let y = top + 66;
    if (hungerOn()) {
      ctx.save(); ctx.translate(lx + 7, y + 3); ctx.scale(0.7, 0.7); drawPowerIcon(ctx, 'mama'); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, lx + 16, y, 60, 6, 3); ctx.fill();
      ctx.fillStyle = tokluk > 40 ? '#9ccf8f' : tokluk > 20 ? '#e0a05f' : '#e07a7a';
      rr(ctx, lx + 16, y, Math.max(4, 60 * tokluk / 100), 6, 3); ctx.fill();
      y += 22;
    } else {
      y += 6;
    }
    let x = lx + 12;
    const act = [];
    if (shieldHP > 0) act.push(['shield', 1]);
    if (magnetT > 0) act.push(['magnet', magnetT / (7 + 2 * upg('miknatis'))]);
    if (slowT > 0) act.push(['slow', slowT / (4 + (catIs('pamuk') ? 2 : 0))]);
    for (const [k, frac] of act) {
      ctx.save(); ctx.translate(x, y + 6); ctx.scale(0.75, 0.75);
      dot(ctx, 0, 0, 12, POWERS[k].color); drawPowerIcon(ctx, k);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x - 9, y + 18, 18, 3);
      ctx.fillStyle = '#f2efe9'; ctx.fillRect(x - 9, y + 18, 18 * frac, 3);
      x += 26;
    }

    for (let i = 0; i < energyMax; i++) drawPaw(ctx, W - WALL - 14 - i * 15, top + 74, i < energy ? '#c9d8ea' : 'rgba(255,255,255,0.16)');
    if (energy < energyMax) {
      ctx.fillStyle = 'rgba(201,216,234,0.5)';
      ctx.fillRect(W - WALL - 14 - (energyMax - 1) * 15 - 6, top + 83, (energyMax * 15 - 3) * (energyT / 10), 2);
    }
    if (weather !== 'clear') hudText(WEATHERS[weather].name, W - WALL - 8, top + 102, '600 12px system-ui, sans-serif', '#e3dccf', 'right');

    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.t * 2);
      hudText(f.text, f.x, f.y, '700 14px system-ui, sans-serif', f.color);
    }
    ctx.globalAlpha = 1;

    if (toastMsg.t > 0) {
      ctx.globalAlpha = Math.min(1, toastMsg.t * 1.5);
      hudText(toastMsg.text, W / 2, H * 0.3, '800 28px system-ui, sans-serif', '#f2efe9');
      if (toastMsg.sub) wrapText(toastMsg.sub, W / 2, H * 0.3 + 26, W - 2 * WALL - 30, 19, '600 15px system-ui, sans-serif', '#e3dccf');
      ctx.globalAlpha = 1;
    }

    if (state === 'count') {
      hudText(String(Math.max(1, Math.ceil(countT))), W / 2, H * 0.47, '800 64px system-ui, sans-serif', '#f2efe9');
      hudText('Hazır ol', W / 2, H * 0.47 + 30, '600 16px system-ui, sans-serif', '#e3dccf');
    }
  }

  function draw() {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    drawSky();
    drawWalls();
    drawFinish();
    drawRecord();
    for (const o of obstacles) if (o.type === 'sticky' && o.y < H && o.y + o.h > 0) drawSticky(o);
    for (const o of obstacles) {
      if (o.y > H || o.y + o.h < 0 || o.type === 'sticky') continue;
      if (o.type === 'bar') drawClothesline(o);
      else if (o.type === 'jet') drawJet(o);
      else if (o.skin === 'ac') drawAC(o);
      else drawCactus(o);
    }
    drawItems();
    drawDog();
    drawPlayer();
    drawCrows();
    drawParticles();
    drawWeather();
    drawHud();
  }

  // ================= Ekranlar =================
  const SCREENS = ['menu', 'levels', 'chars', 'shop', 'missions', 'wardrobe', 'board', 'pause', 'over', 'win'];
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('pauseBtn').classList.toggle('hidden', state !== 'play');
  }
  function showScreen(name) {
    state = name;
    if (name === 'menu') renderMenu();
    if (name === 'levels') renderLevels();
    if (name === 'chars') renderChars();
    if (name === 'shop') renderShop();
    if (name === 'missions') renderMissions();
    if (name === 'wardrobe') renderWardrobe();
    if (name === 'board') renderBoard();
    show(name);
  }
  function toMenu() {
    run = null;
    reset();
    weather = 'clear';
    fogAmt = 0;
    setPalette(0, true);
    darkAmt = darkTarget = 0;
    showScreen('menu');
  }
  function pause() {
    if (state !== 'play' && state !== 'count') return;
    state = 'pause';
    saveResume();
    show('pause');
    if (!document.hidden) sfx('pause');
  }
  function resume() { clearResume(); startCountdown(); }

  const MODE_NAMES = { endless: 'Sonsuz Koşu', daily: 'Günün Seferi', level: 'Bölüm' };
  function renderMenu() {
    refillMissions();
    $('wallet').textContent = save.wallet;
    $('menuBest').textContent = save.bestByDiff[save.diff] || 0;
    $('diffName').textContent = DIFFS[save.diff].name;
    $('diffSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.diff === save.diff));
    $('soundBtn').textContent = 'Efekt: ' + (save.sound ? 'Açık' : 'Kapalı');
    $('musicBtn').textContent = 'Müzik: ' + (save.music ? 'Açık' : 'Kapalı');
    $('vibBtn').textContent = 'Titreşim: ' + (save.vibrate ? 'Açık' : 'Kapalı');
    $('levelsInfo').textContent = `${save.stars.filter((s) => s > 0).length}/${LEVELS.length}`;
    const left = dailyLeft();
    $('dailyInfo').textContent = left > 0 ? `${left}/${DAILY_TRIES} hak · en iyi ${dailyState().best}` : `yarın yeni parkur · en iyi ${dailyState().best}`;
    $('dailyBtn').disabled = left <= 0;
    const df = DIFFS[save.diff];
    $('diffInfo').textContent = `${df.lives} can · ${save.diff === 'kolay' ? 'yavaş' : save.diff === 'zor' ? 'hızlı' : 'normal'} hız · ${save.diff === 'kolay' ? 'az' : save.diff === 'zor' ? 'çok' : 'orta'} acıkma`;
    $('tutorialBtn').classList.toggle('resume', !save.tutorialDone);
    $('tutorialBtn').textContent = save.tutorialDone ? 'Eğitim' : 'Yeni misin? Önce eğitimi oyna';
    const r = save.resume;
    $('resumeBtn').classList.toggle('hidden', !r);
    if (r) {
      const what = r.mode === 'level' ? `${r.level + 1}. ${LEVELS[r.level].name}` : MODE_NAMES[r.mode];
      $('resumeInfo').textContent = `${what} · ${Math.floor(r.dist / METER)} m · ${r.lives} can`;
    }
  }

  const levelUnlocked = (i) => i === 0 || (save.stars[i - 1] || 0) > 0;
  // Bina haritasi: her bolum bir kat, asagidan yukari tirmanilir; kedi siradaki katta bekler
  function renderLevels() {
    let cur = LEVELS.findIndex((_, i) => levelUnlocked(i) && !(save.stars[i] > 0));
    if (cur < 0) cur = LEVELS.length - 1;
    const floors = LEVELS.map((lv, i) => {
      const open = levelUnlocked(i), st = save.stars[i] || 0;
      const tags = [lv.hunger && 'Açlık', lv.bars && 'İp', lv.jets && 'Fıskiye', lv.sticky && 'Bal', lv.ac && 'Klima',
        lv.dark && 'Karanlık', lv.weather === 'rain' && 'Yağmur', lv.weather === 'fog' && 'Sis', lv.dogs && 'Köpek'].filter(Boolean).join(' · ');
      return `<div class="node ${i % 2 ? 'r' : 'l'}${i === cur ? ' cur' : ''}">
        <button class="lv${open ? '' : ' locked'}" data-level="${i}"${open ? '' : ' disabled'}>
        <b>${i + 1}</b><span>${lv.name}</span>
        <i>${open ? '★'.repeat(st) + '☆'.repeat(3 - st) : '🔒'}</i>
        <small>${lv.goal} m${tags ? ' · ' + tags : ''}</small></button>
        ${i === cur ? '<canvas class="here" width="112" height="112"></canvas>' : ''}</div>`;
    }).reverse();
    $('levelGrid').innerHTML = `<div class="map"><div class="roof">Çatı</div>${floors.join('')}<div class="ground">Sokak</div></div>`;
    const here = $('levelGrid').querySelector('.here');
    if (here) {
      const g = here.getContext('2d');
      g.setTransform(3.2, 0, 0, 3.2, 56, 58);
      drawCat(g, CAT_BY_ID[save.char], cur % 2 ? -1 : 1, 'idle', 1, outfit());
      if (here.scrollIntoView) setTimeout(() => here.scrollIntoView({ block: 'center' }), 0);
    }
  }

  function renderChars() {
    $('wallet2').textContent = save.wallet;
    $('charGrid').innerHTML = CATS.map((c) => {
      const owned = save.owned.includes(c.id), sel = save.char === c.id;
      const status = sel ? 'Seçili' : owned ? 'Seç' : `🐟 ${c.price}`;
      const cls = sel ? ' sel' : !owned && save.wallet < c.price ? ' cant' : '';
      return `<button class="ch${cls}" data-char="${c.id}"><canvas width="128" height="128"></canvas><b>${c.name}</b><small>${c.ability}</small><span>${status}</span></button>`;
    }).join('');
    $('charGrid').querySelectorAll('button').forEach((b) => {
      const g = b.querySelector('canvas').getContext('2d');
      g.setTransform(3.2, 0, 0, 3.2, 64, 66);
      drawCat(g, CAT_BY_ID[b.dataset.char], 1, 'idle', 1, outfit());
    });
  }

  function renderWardrobe() {
    $('wallet4').textContent = save.wallet;
    const pv = $('wardPreview').getContext('2d');
    pv.setTransform(1, 0, 0, 1, 0, 0);
    pv.clearRect(0, 0, 200, 200);
    pv.setTransform(5, 0, 0, 5, 100, 104);
    drawCat(pv, CAT_BY_ID[save.char], 1, 'idle', 1, outfit());
    const wr = save.wardrobe;
    $('wardList').innerHTML = Object.keys(SLOT_NAMES).map((slot) => {
      const items = COSMETICS.filter((c) => c.slot === slot).map((c) => {
        const owned = wr.owned.includes(c.id), on = wr[slot] === c.id;
        const status = on ? 'Giyili' : owned ? 'Giy' : `🐟 ${c.price}`;
        const cls = on ? ' sel' : !owned && save.wallet < c.price ? ' cant' : '';
        return `<button class="ch wear${cls}" data-cos="${c.id}"><canvas width="96" height="96"></canvas><b>${c.name}</b><span>${status}</span></button>`;
      }).join('');
      return `<h3>${SLOT_NAMES[slot]}</h3><div class="grid chars-grid">${items}</div>`;
    }).join('');
    $('wardList').querySelectorAll('button').forEach((b) => {
      const c = COS_BY_ID[b.dataset.cos];
      const g = b.querySelector('canvas').getContext('2d');
      g.setTransform(3.4, 0, 0, 3.4, 48, c.slot === 'neck' ? 30 : 62);
      drawCat(g, CAT_BY_ID[save.char], 1, 'idle', 1, { [c.slot]: c.id });
    });
  }
  function cosClick(id) {
    const c = COS_BY_ID[id];
    if (!c) return;
    const wr = save.wardrobe;
    if (wr.owned.includes(id)) {
      wr[c.slot] = wr[c.slot] === id ? '' : id; // ayni esyaya tekrar dokununca cikarir
      sfx('ui');
    } else if (save.wallet >= c.price) {
      save.wallet -= c.price; wr.owned.push(id); wr[c.slot] = id;
      persist('wallet');
      sfx('buy');
      vibrate(30);
    } else {
      sfx('nope');
      return;
    }
    persist('wardrobe');
    renderWardrobe();
  }

  function renderShop() {
    $('wallet3').textContent = save.wallet;
    $('shopList').innerHTML = UPGRADES.map((u) => {
      const lvl = upg(u.id), max = u.costs.length, done = lvl >= max;
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      const next = done ? 'En üst seviye' : u.steps[lvl];
      const cost = done ? '' : `🐟 ${u.costs[lvl]}`;
      const cant = !done && save.wallet < u.costs[lvl];
      return `<button class="up${done ? ' done' : ''}${cant ? ' cant' : ''}" data-upg="${u.id}"${done ? ' disabled' : ''}>
        <b>${u.name}</b><span class="pips">${pips}</span><small>${next}</small><em>${cost}</em></button>`;
    }).join('');
  }
  function buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const lvl = upg(id);
    if (!u || lvl >= u.costs.length) return;
    if (save.wallet < u.costs[lvl]) { sfx('nope'); return; }
    save.wallet -= u.costs[lvl];
    save.upg[id] = lvl + 1;
    persist('wallet'); persist('upg');
    sfx('buy');
    vibrate(30);
    renderShop();
  }

  function renderMissions() {
    refillMissions();
    $('missionDone').textContent = save.missions.completed;
    $('missionList').innerHTML = save.missions.list.map((m) => {
      const def = MISSIONS[m.type], pct = Math.min(100, Math.round((m.best / m.target) * 100));
      return `<div class="ms"><b>${def.text(m.target)}</b><div class="bar"><i style="width:${pct}%"></i></div>
        <small>En iyi: ${Math.min(m.best, m.target)} / ${m.target}</small><em>🐟 ${m.reward}</em></div>`;
    }).join('');
  }

  function charClick(id) {
    const c = CAT_BY_ID[id];
    if (!c) return;
    if (save.owned.includes(id)) {
      save.char = id; persist('char');
      sfx('ui');
    } else if (save.wallet >= c.price) {
      save.wallet -= c.price; save.owned.push(id); save.char = id;
      persist('wallet'); persist('owned'); persist('char');
      sfx('buy');
      vibrate(30);
    } else {
      sfx('nope');
      const card = $('charGrid').querySelector(`[data-char="${id}"]`);
      if (card) { card.classList.remove('nope'); void card.offsetWidth; card.classList.add('nope'); }
      return;
    }
    renderChars();
  }

  // ================= Girdi =================
  function onTap() {
    if (state === 'play') jump();
    else if (state === 'pause') resume();
    else if (state === 'over' && performance.now() - overAt > 700) {
      if (run.mode === 'daily' && dailyLeft() <= 0) return;
      startRun(run.mode, run.level);
    }
  }

  window.addEventListener('pointerdown', (e) => {
    if (save.sound || save.music) ac(); // tarayici sesi ilk dokunusta acar
    if (e.target.closest && e.target.closest('button, input, summary')) return;
    if (state === 'play' || state === 'pause' || state === 'over' || state === 'count') e.preventDefault();
    onTap();
  }, { passive: false });

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    if (!b.dataset.char && !b.dataset.cos && !b.dataset.upg && b.id !== 'soundBtn') sfx('click');
    const a = b.dataset.act;
    if (a === 'endless' || a === 'daily' || a === 'tutorial') startRun(a);
    else if (a === 'resume') loadResume();
    else if (['levels', 'chars', 'shop', 'missions', 'wardrobe', 'board'].includes(a)) showScreen(a);
    else if (a === 'menu') toMenu();
    else if (a === 'pause') pause();
    else if (a === 'retry' && run) startRun(run.mode, run.level);
    else if (a === 'next' && run) startRun('level', Math.min(LEVELS.length - 1, run.level + 1));
    else if (a === 'refreshBoard') { apiOk = null; renderBoard(); }
    else if (b.dataset.diff) { save.diff = b.dataset.diff; persist('diff'); sfx('ui'); renderMenu(); }
    else if (b.dataset.level !== undefined) { const i = Number(b.dataset.level); if (levelUnlocked(i)) startRun('level', i); }
    else if (b.dataset.char) charClick(b.dataset.char);
    else if (b.dataset.cos) cosClick(b.dataset.cos);
    else if (b.dataset.upg) buyUpgrade(b.dataset.upg);
    else if (b.id === 'soundBtn') { save.sound = !save.sound; persist('sound'); renderMenu(); sfx('coin'); }
    else if (b.id === 'musicBtn') { save.music = !save.music; persist('music'); if (save.music) ac(); renderMenu(); }
    else if (b.id === 'vibBtn') { save.vibrate = !save.vibrate; persist('vibrate'); renderMenu(); vibrate(40); }
  });
  $('nameInput').addEventListener('change', (e) => {
    save.playerName = String(e.target.value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
    e.target.value = save.playerName;
    persist('playerName');
  });

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter') {
      if (state === 'play' || state === 'pause' || state === 'over') { e.preventDefault(); if (!e.repeat) onTap(); }
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'play' || state === 'count') pause(); else if (state === 'pause') resume();
    }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);
  if (!DEMO) window.addEventListener('blur', pause);

  // ================= Dongu =================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (state !== 'pause') update(dt);
    draw();
    musicTick();
    rainAmbience();
    if (DEMO) {
      document.title = `state:${state} score:${score()} m:${meters()} t:${clock.toFixed(1)} speed:${Math.round(speed)}` +
        ` shieldHits:${shieldHits} lost:${stats.livesLost} coins:${coinCount}/${coinsSpawned} near:${stats.near}` +
        ` lines:${stats.lines} jets:${stats.jets} stage:${stage} weather:${weather} lives:${lives}` +
        ` dogs:${stats.dogs} crows:${stats.crows} chase:${chase ? chase.close.toFixed(2) : '-'}`;
    }
    requestAnimationFrame(frame);
  }

  setPalette(0, true);
  resize();
  window.addEventListener('resize', resize);
  reset();
  showScreen('menu');
  if (DEMO) {
    const lv = Number(params.get('lv'));
    const mode = params.get('mode');
    if (mode === 'level' && LEVELS[lv]) startRun('level', lv);
    else if (mode === 'daily' || mode === 'tutorial') startRun(mode);
    else startRun('endless');
    if (params.has('count')) startCountdown();
    if (params.has('record')) run.recordM = Number(params.get('record'));
    if (params.has('chase')) { startChase(Number(params.get('chase'))); chase.dur = 999; }
  }
  requestAnimationFrame((t) => { last = t; frame(t); });

  if ('serviceWorker' in navigator && !DEMO && location.protocol !== 'capacitor:') {
    // Yeni surum yuklenince sayfayi bir kez yenile (eski surumde takili kalmasin)
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded && isMenuState()) { reloaded = true; location.reload(); }
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {}));
  }
})();

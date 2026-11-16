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

  // Vakit paletleri: aydinlik ve ic acici pasteller (neon yok, yanip sonme yok).
  // hose = supurge hortumu, pipe = islak oluk borusu
  const PALETTES = [
    { name: 'Sabah',       skyTop: '#8ec5ea', skyBot: '#fde2c8', city: '#b9c9dc', wall: '#e9b48e', mark: '#f6d6b8', edge: '#c98d68', win: '#d9eefa', hose: '#d26a6a', pipe: '#8f9bb0', moon: '#fff1c1', stars: 0,    cloud: 0.85 },
    { name: 'Öğle',        skyTop: '#7fbbe8', skyBot: '#d6ecf8', city: '#a9c3dd', wall: '#efc785', mark: '#f8dfae', edge: '#cf9f5a', win: '#dff1fb', hose: '#d26a6a', pipe: '#8f9bb0', moon: '#fff6d8', stars: 0,    cloud: 0.8 },
    { name: 'İkindi',      skyTop: '#9ab8e0', skyBot: '#f6d3b0', city: '#c2b8cc', wall: '#e8a58c', mark: '#f4c6b3', edge: '#c27d66', win: '#fbe7c8', hose: '#c95c6b', pipe: '#8792a8', moon: '#ffe0a8', stars: 0,    cloud: 0.6 },
    { name: 'Gün Batımı',  skyTop: '#7d86c4', skyBot: '#f7b68f', city: '#9b8aa8', wall: '#c98a8a', mark: '#dba7a4', edge: '#a8696b', win: '#ffd99a', hose: '#b8506a', pipe: '#7c84a0', moon: '#ffc98a', stars: 0.05, cloud: 0.45 },
    { name: 'Akşam',       skyTop: '#4f5d9c', skyBot: '#b98fb0', city: '#6b6a96', wall: '#8c7aa8', mark: '#a08fbc', edge: '#6f5f8c', win: '#ffe0a0', hose: '#c25d78', pipe: '#7a7fa0', moon: '#fff3d0', stars: 0.3,  cloud: 0.25 },
    { name: 'Gece',        skyTop: '#283a6b', skyBot: '#4d5d92', city: '#3b4775', wall: '#4f5a85', mark: '#5f6a96', edge: '#3f4870', win: '#ffd98c', hose: '#b95b74', pipe: '#77809e', moon: '#fff6dc', stars: 0.7,  cloud: 0.12 },
    { name: 'Şafak',       skyTop: '#8fa7d6', skyBot: '#ffd0b5', city: '#b3a9c7', wall: '#d6a3a8', mark: '#e6bfc1', edge: '#b37f86', win: '#ffe7c4', hose: '#c9606e', pipe: '#8a93ac', moon: '#ffe2b0', stars: 0.1,  cloud: 0.55 },
  ];

  // Sonsuz modda her 200 m'de bir yeni vakit ve yeni zorluklar
  const ALL = { bars: true, ac: true, power: true, jets: true, weather: true, long: true, sticky: true, crows: true, dogs: true };
  const STAGES = [
    { pal: 0, sub: 'Süpürge hortumlarına ve ıslak borulara değme, balık ye' },
    { pal: 1, sub: 'Çamaşır ipleri, klimalar ve kargalar', bars: true, ac: true, crows: true },
    { pal: 2, sub: 'Fıskiyeler açıldı, hava değişebilir', bars: true, ac: true, crows: true, power: true, jets: true, weather: true },
    { pal: 3, sub: 'Bal damlıyor, bekçi köpeği uyanık', bars: true, ac: true, crows: true, power: true, jets: true, weather: true, long: true, sticky: true, dogs: true },
    { pal: 4, sub: 'Akşam oldu, her şey bir arada', ...ALL },
    { pal: 5, sub: 'Sokak lambaları söndü', ...ALL, dark: true },
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
  // Not: kimlikler (id) kayitlarla uyum icin degismez; 'benek' kimlikli uc renkli kedinin adi artik Irmik.
  const CATS = [
    { id: 'sarman',  name: 'Sarman',  price: 0,   fur: '#e3a15e', fur2: '#c47f3f', belly: '#f4dcc0', eyes: ['#9bc46a', '#9bc46a'], pattern: 'tabby',  ability: 'Çevik: +1 pati enerjisi' },
    { id: 'tekir',   name: 'Tekir',   price: 50,  fur: '#9a8f84', fur2: '#5e554d', belly: '#d9d0c4', eyes: ['#d9b84a', '#d9b84a'], pattern: 'tabby',  ability: 'Tedbirli: Tura kalkanla başlar' },
    { id: 'pamuk',   name: 'Pamuk',   price: 120, fur: '#f2efe9', fur2: '#e0dbd2', belly: '#ffffff', eyes: ['#7fb3d9', '#7fb3d9'], pattern: 'solid',  ability: 'Sakin: Yavaş Çekim +2 sn' },
    { id: 'kara',    name: 'Gece',    price: 250, fur: '#45454f', fur2: '#45454f', belly: '#55555f', eyes: ['#e8c547', '#e8c547'], pattern: 'solid',  ability: 'Gece gözü: Karanlık ve sis etkilemez', rim: true },
    { id: 'duman',   name: 'Duman',   price: 300, fur: '#8e9bad', fur2: '#7a879a', belly: '#b9c3d0', eyes: ['#8fd18a', '#8fd18a'], pattern: 'solid',  ability: 'Sessiz pati: Köpek daha yavaş yaklaşır' },
    { id: 'benekli', name: 'Benek',   price: 350, fur: '#f6f3ee', fur2: '#2e2d33', belly: '#ffffff', eyes: ['#7fb3d9', '#7fb3d9'], pattern: 'spots',  ability: 'Kıl payı ustası: Kıl payı puanı 2 kat' },
    { id: 'siyam',   name: 'Siyam',   price: 400, fur: '#eadfcd', fur2: '#6b4e3d', belly: '#f5eee2', eyes: ['#6fa8dc', '#6fa8dc'], pattern: 'points', ability: 'Dokuz canlı: +1 can' },
    { id: 'karamel', name: 'Karamel', price: 450, fur: '#e9c9a0', fur2: '#c9935e', belly: '#fbefdf', eyes: ['#d9a441', '#d9a441'], pattern: 'tabby',  ability: 'Tatlı diş: Balık ve mama %50 daha doyurur' },
    { id: 'benek',   name: 'İrmik',   price: 500, fur: '#f2ece3', fur2: '#d9904a', fur3: '#3a3333', belly: '#ffffff', eyes: ['#9bc46a', '#9bc46a'], pattern: 'calico', ability: 'Şanslı: Balıklar 2 kat değerli' },
    { id: 'zeytin',  name: 'Zeytin',  price: 600, fur: '#34353c', fur2: '#34353c', belly: '#f4f1ea', paws: '#f4f1ea', eyes: ['#9bd27a', '#9bd27a'], pattern: 'tuxedo', ability: 'Hızlı enerji: Pati enerjisi 6 sn\'de dolar', rim: true },
    { id: 'van',     name: 'Van',     price: 700, fur: '#f4f1ea', fur2: '#c9884d', belly: '#ffffff', eyes: ['#6fa8dc', '#d9a441'], pattern: 'van',    ability: 'Yüzücü: Fıskiyeler ıslatamaz' },
  ];
  // Kedi albumu: her kedinin kisa hikayesi
  const CAT_STORY = {
    sarman: 'Kadıköy çarşısında balıkçının en sevdiği kedi. Her sabah ilk balık onun.',
    tekir: 'Eski bir kitapçının vitrininde büyüdü. Temkinli ama meraklı.',
    pamuk: 'Bir çatı katında, çamaşır sepetinde uyurken bulundu. Hiç acele etmez.',
    kara: 'Gece bekçisinin can dostu. Karanlıkta yolunu hep bulur.',
    duman: 'Bir buharlı fırının sıcak duvarında ısınırken sessiz adımlarını öğrendi.',
    benekli: 'Moda sahilinde martılarla yarışan, kıl payı kaçmayı seven bir kedi.',
    siyam: "Galata'da bir müzisyenin evinde yaşıyor. Sesi bütün sokakta duyulur.",
    karamel: 'Bir pastanenin önünde büyüdü. Tatlı yemeye bayılır.',
    benek: 'Şansına inanan üç renkli bir kedi. Bulduğu her balık iki kat değerli.',
    zeytin: 'Vapur iskelesinin smokinli beyefendisi. Hep hazır, hep enerjik.',
    van: 'Van Gölü kıyısından geldi. Suyu seven nadir kedilerden.',
  };
  const CAT_BY_ID = Object.fromEntries(CATS.map((c) => [c.id, c]));
  const OLD_CHAR = {
    kubo: 'sarman', kedi: 'tekir', robot: 'pamuk', hayalet: 'kara', ninja: 'siyam', uzayli: 'benek',
    kage: 'sarman', kizil: 'tekir', bambu: 'pamuk', kar: 'kara', gece: 'siyam', usta: 'benek',
  };

  // Gardirop: kedilere giydirilen aksesuarlar (slot basina bir tane)
  const COSMETICS = [
    { id: 'bere',     slot: 'hat',  name: 'Örgü Bere',        price: 60 },
    { id: 'cicek',    slot: 'hat',  name: 'Papatya',          price: 80 },
    { id: 'kasket',   slot: 'hat',  name: 'Kasket',           price: 120 },
    { id: 'beyzbol',  slot: 'hat',  name: 'Beyzbol Şapkası',  price: 140 },
    { id: 'parti',    slot: 'hat',  name: 'Parti Şapkası',    price: 150 },
    { id: 'tavsan',   slot: 'hat',  name: 'Tavşan Kulakları', price: 160 },
    { id: 'korsan',   slot: 'hat',  name: 'Korsan Bandanası', price: 180 },
    { id: 'kovboy',   slot: 'hat',  name: 'Kovboy Şapkası',   price: 220 },
    { id: 'cadi',     slot: 'hat',  name: 'Cadı Şapkası',     price: 260 },
    { id: 'kulaklik', slot: 'hat',  name: 'Kulaklık',         price: 300 },
    { id: 'tac',      slot: 'hat',  name: 'Minik Taç',        price: 400 },
    { id: 'papyon',   slot: 'neck', name: 'Papyon',           price: 70 },
    { id: 'zil',      slot: 'neck', name: 'Zilli Tasma',      price: 90 },
    { id: 'kravat',   slot: 'neck', name: 'Kravat',           price: 110 },
    { id: 'kalp',     slot: 'neck', name: 'Kalpli Kolye',     price: 120 },
    { id: 'atki',     slot: 'neck', name: 'Kış Atkısı',       price: 140 },
    { id: 'pelerin',  slot: 'neck', name: 'Kahraman Pelerini', price: 350 },
    { id: 'gozluk',   slot: 'face', name: 'Yuvarlak Gözlük',  price: 100 },
    { id: 'monokl',   slot: 'face', name: 'Monokl',           price: 160 },
    { id: 'gunes',    slot: 'face', name: 'Güneş Gözlüğü',    price: 180 },
    { id: 'kalpgoz',  slot: 'face', name: 'Kalp Gözlük',      price: 200 },
    { id: 'maske',    slot: 'face', name: 'Kahraman Maskesi', price: 240 },
    // Odulle kazanilan ozel esyalar (dukkanda satilmaz)
    { id: 'yildiz',   slot: 'hat',  name: 'Yıldızlı Taç',     price: 0, reward: '7 gün üst üste giriş ödülü' },
    { id: 'yaprak',   slot: 'hat',  name: 'Yaprak Taç',       price: 0, reward: 'Sonbahar Şenliği ödülü' },
    { id: 'noel',     slot: 'hat',  name: 'Noel Şapkası',     price: 0, reward: 'Yılbaşı Şenliği ödülü' },
    { id: 'madalya',  slot: 'neck', name: 'Şampiyon Madalyası', price: 0, reward: 'İlk 15 bölümü geçme ödülü' },
  ];

  // Gunluk giris odulleri (7 gunluk dongu; 7. gun Yildizli Tac)
  const LOGIN_REWARDS = [10, 15, 20, 25, 30, 40, 60];

  // Kedi evi esyalari: her yuvaya bir tane
  const HOUSE_ITEMS = [
    { id: 'hali_pembe',    slot: 'hali',  name: 'Yuvarlak Halı',   price: 80 },
    { id: 'hali_cizgi',    slot: 'hali',  name: 'Çizgili Halı',    price: 120 },
    { id: 'yatak_sepet',   slot: 'yatak', name: 'Hasır Sepet',     price: 150 },
    { id: 'yatak_bulut',   slot: 'yatak', name: 'Bulut Yatak',     price: 260 },
    { id: 'agac_kucuk',    slot: 'agac',  name: 'Tırmalama Direği', price: 180 },
    { id: 'agac_buyuk',    slot: 'agac',  name: 'Kedi Ağacı',      price: 400 },
    { id: 'mama_mavi',     slot: 'mama',  name: 'Mavi Mama Kabı',  price: 60 },
    { id: 'mama_altin',    slot: 'mama',  name: 'Altın Mama Kabı', price: 300 },
    { id: 'bitki_cicek',   slot: 'bitki', name: 'Çiçek Saksısı',   price: 70 },
    { id: 'bitki_palmiye', slot: 'bitki', name: 'Palmiye',         price: 110 },
    { id: 'tablo_balik',   slot: 'tablo', name: 'Balık Tablosu',   price: 90 },
    { id: 'tablo_ay',      slot: 'tablo', name: 'Ay Tablosu',      price: 140 },
  ];
  const HOUSE_BY_ID = Object.fromEntries(HOUSE_ITEMS.map((h) => [h.id, h]));
  const HOUSE_SLOTS = { hali: 'Halı', yatak: 'Yatak', agac: 'Tırmanma', mama: 'Mama kabı', bitki: 'Bitki', tablo: 'Tablo' };

  // Basarimlar: L = omur boyu istatistikler
  const ACHS = [
    { id: 'ilk',      name: 'İlk Adım',        text: 'İlk turunu bitir',                 test: (L) => L.runs >= 1, reward: 20 },
    { id: 'm500',     name: 'Yarım Kilometre', text: "Bir turda 500 m'ye ulaş",           test: (L) => L.maxM >= 500, reward: 40 },
    { id: 'm1000',    name: 'Bir Kilometre',   text: "Bir turda 1000 m'ye ulaş",          test: (L) => L.maxM >= 1000, reward: 80 },
    { id: 'm2000',    name: 'Gökdelen',        text: "Bir turda 2000 m'ye ulaş",          test: (L) => L.maxM >= 2000, reward: 150 },
    { id: 'kil100',   name: 'Kıl Payı Ustası', text: 'Toplam 100 kıl payı yap',           test: (L) => L.near >= 100, reward: 50 },
    { id: 'kopek10',  name: 'Karabaş Kaçağı',  text: 'Bekçi köpeğini toplam 10 kez atlat', test: (L) => L.dogs >= 10, reward: 60 },
    { id: 'balik500', name: 'Balık Gurmesi',   text: 'Toplam 500 balık ye',               test: (L) => L.fish >= 500, reward: 60 },
    { id: 'oyun50',   name: 'Oyun Arkadaşı',   text: 'Oyuncakla 50 kez yakala',           test: (L) => L.catches >= 50, reward: 40 },
    { id: 'kedi3',    name: 'Kedi Sever',      text: '3 kediye sahip ol',                 test: () => save.owned.length >= 3, reward: 40 },
    { id: 'kediall',  name: 'Kedi Sarayı',     text: 'Bütün kedilere sahip ol',           test: () => save.owned.length >= CATS.length, reward: 300 },
    { id: 'esya5',    name: 'Şıklık',          text: '5 aksesuara sahip ol',              test: () => save.wardrobe.owned.length >= 5, reward: 40 },
    { id: 'ev3',      name: 'Sıcak Yuva',      text: 'Kedi evine 3 eşya yerleştir',       test: () => Object.values(save.house.placed).filter(Boolean).length >= 3, reward: 50 },
    { id: 'seri7',    name: 'Sadık Dost',      text: '7 gün üst üste giriş yap',          test: () => save.login.streak >= 7, reward: 80 },
    { id: 'bolum15',  name: 'Çatıya Ulaştın',  text: 'İlk 15 bölümü geç',                 test: () => save.stars.slice(0, 15).filter((s) => s > 0).length >= 15, reward: 150, item: 'madalya' },
  ];

  // Sezon etkinlikleri (tarihe gore kendiliginden acilir)
  function currentEvent() {
    const d = new Date(), m = d.getMonth() + 1, day = d.getDate(), y = d.getFullYear();
    if ((m === 12 && day >= 15) || (m === 1 && day <= 7)) {
      return { id: 'yilbasi-' + (m === 12 ? y : y - 1), name: 'Yılbaşı Şenliği', fx: 'snow', item: 'noel', goal: 600, text: "Sonsuz koşuda 600 m'ye ulaş, Noel Şapkası kazan" };
    }
    if (m === 11) return { id: 'sonbahar-' + y, name: 'Sonbahar Şenliği', fx: 'leaves', item: 'yaprak', goal: 500, text: "Sonsuz koşuda 500 m'ye ulaş, Yaprak Taç kazan" };
    return null;
  }
  const COS_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
  const SLOT_NAMES = { hat: 'Baş', neck: 'Boyun', face: 'Yüz' };

  // Ana sayfada kediyle oynanan oyuncaklar (olta ile sarkitilir)
  const TOYS = [
    { id: 'tuy',     name: 'Tüylü Olta',   price: 0 },
    { id: 'fare',    name: 'Oyuncak Fare', price: 80 },
    { id: 'yumak',   name: 'Yün Yumağı',   price: 120 },
    { id: 'balik',   name: 'Peluş Balık',  price: 150 },
    { id: 'kelebek', name: 'Kelebek',      price: 200 },
    { id: 'lazer',   name: 'Lazer Noktası', price: 300 },
  ];
  const TOY_BY_ID = Object.fromEntries(TOYS.map((t) => [t.id, t]));

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
  // Sonsuz kosu: yumusak baslangic, yavas artan hiz
  const ENDLESS = { speed: 230, ramp: 0.007, cap: 230, react: [0.58, 0.26], len: [70, 120, 250], coins: 0.6, sameMax: 2, hunger: true };
  const BREATHER = 3.2;     // kat degisiminde engelsiz mola (sn)
  const REVIVE_COST = 60;   // ikinci sans bedeli (balik)
  // Desenler: rastgele dizilim yerine ritimli kaliplar
  const PATTERNS = [
    { id: 'normal', w: 0.5, from: 0 },
    { id: 'zigzag', w: 0.2, from: 1, name: 'Zikzak!' },
    { id: 'merdiven', w: 0.15, from: 2, name: 'Merdiven' },
    { id: 'balik', w: 0.1, from: 0, name: 'Balık yolu' },
  ];
  const LONG_LEN = [100, 180, 300];
  // Bolumler: daha hizli, daha kisa tepki suresi, daha cok engel karisimi (yine de her desen gecilebilir)
  const LEVEL_DEFAULTS = { ramp: 0.007, cap: 110, react: [0.46, 0.3], len: [70, 130, 200], coins: 0.55, sameMax: 2, bars: 0, jets: 0, sticky: 0, ac: 0, power: false, dark: false, weather: 'clear', hunger: true, crows: false, dogs: false };
  const LEVELS = [
    { name: 'Bahçe Duvarı',    goal: 220, speed: 255, ramp: 0.005, cap: 70, react: [0.55, 0.4], pal: 0, ac: 0.15, hunger: false },
    { name: 'Balık Pazarı',    goal: 260, speed: 265, coins: 0.95, react: [0.5, 0.36], pal: 1, ac: 0.2, crows: true },
    { name: 'Çatı Katı',       goal: 300, speed: 275, power: true, ac: 0.3, bars: 0.2, pal: 2, crows: true },
    { name: 'Çamaşır Günü',    goal: 340, speed: 285, bars: 0.45, power: true, pal: 1, crows: true },
    { name: 'Fıskiye Sokağı',  goal: 360, speed: 290, jets: 0.35, bars: 0.15, power: true, pal: 0, crows: true },
    { name: 'Hızlı Pati',      goal: 400, speed: 340, ramp: 0.01, cap: 140, react: [0.4, 0.27], power: true, pal: 2, crows: true },
    { name: 'Bal Duvarı',      goal: 400, speed: 300, sticky: 0.4, jets: 0.15, power: true, pal: 6, crows: true, dogs: true },
    { name: 'Boru Labirenti',  goal: 450, speed: 310, len: [140, 240, 340], sameMax: 3, bars: 0.2, power: true, pal: 3, crows: true, dogs: true },
    { name: 'Yağmurlu Akşam',  goal: 450, speed: 310, weather: 'rain', bars: 0.35, jets: 0.15, power: true, pal: 4, crows: true, dogs: true },
    { name: 'Karanlık Sokak',  goal: 450, speed: 300, dark: true, react: [0.48, 0.32], sticky: 0.2, power: true, pal: 5, crows: true, dogs: true },
    { name: 'Sisli Sabah',     goal: 500, speed: 315, weather: 'fog', jets: 0.3, bars: 0.2, power: true, pal: 6, crows: true, dogs: true },
    { name: 'İp Cambazı',      goal: 500, speed: 330, bars: 0.65, react: [0.42, 0.28], power: true, pal: 3, crows: true, dogs: true },
    { name: 'Klima Kulesi',    goal: 550, speed: 330, ac: 0.5, sticky: 0.3, jets: 0.3, power: true, pal: 2, crows: true, dogs: true },
    { name: 'Gece Yarısı',     goal: 600, speed: 340, dark: true, bars: 0.45, jets: 0.25, react: [0.44, 0.28], power: true, pal: 5, crows: true, dogs: true },
    { name: 'Ay Işığı',        goal: 700, speed: 360, ramp: 0.012, cap: 170, react: [0.4, 0.24], bars: 0.45, jets: 0.25, sticky: 0.25, ac: 0.3, weather: 'rain', len: [90, 170, 300], power: true, pal: 4, crows: true, dogs: true },
    // Karabas bolumleri: kopek bolum boyunca pesinde; kil payi ve baliklarla onu geride tut
    { name: 'Karabaş Kovalıyor', goal: 400, speed: 300, react: [0.46, 0.32], bars: 0.2, power: true, pal: 2, crows: true, dogsAll: 1, karabas: true },
    { name: 'Karabaş Geri Döndü', goal: 520, speed: 320, react: [0.44, 0.3], bars: 0.3, jets: 0.2, power: true, pal: 3, dogsAll: 1.15, karabas: true },
    { name: 'Büyük Kaçış',      goal: 650, speed: 340, react: [0.42, 0.27], bars: 0.35, jets: 0.25, sticky: 0.2, power: true, pal: 5, dark: true, dogsAll: 1.3, karabas: true },
  ];

  // Egitim: her mekanigi sirayla, yavaslatilmis ortamda gosterir (can gitmez)
  const TUTORIAL = { name: 'Eğitim', speed: 200, ramp: 0, cap: 0, react: [0.9, 0.9], len: [70, 84, 84], coins: 0.8, sameMax: 2, hunger: true, power: true, pal: 1, weather: 'clear', bars: 0, jets: 0, sticky: 0, ac: 0, crows: false, dogs: false };
  const TUTORIAL_SCRIPT = [
    { kind: 'spike', hint: ['Dokun!', 'Kedin karşı duvara zıplar. Süpürge hortumlarına ve ıslak borulara değme.'] },
    { kind: 'spike' }, { kind: 'spike' },
    { kind: 'spike', fish: true, hint: ['Balık ye', 'Sol üstteki tokluk barını doldurur. Aç kalırsan can gider.'] },
    { kind: 'spike', fish: true },
    { kind: 'bar', hint: ['Çamaşır ipi', 'Ortadan geçerken ipe takılma. İpten önce ya da sonra zıpla.'] },
    { kind: 'jet', hint: ['Fıskiye', 'Açılıp kapanır. Su yetişmeden erken kaç!'] },
    { kind: 'spike' },
    { kind: 'sticky', hint: ['Bal', 'Bala yapışırsan ayrılmak için iki kez dokun.'] },
    { kind: 'empty', hint: ['Pati atılması', 'Zıplarken tekrar dokun: havada geri dönersin. Sağ üstteki patileri harcar.'] },
    { kind: 'ac', hint: ['Klima', 'Süpürge hortumu gibi tehlikelidir.'] },
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
    toys: store.get('toys', { owned: ['tuy'], sel: 'tuy' }),
    login: store.get('login', { last: '', streak: 0 }),
    life: store.get('life', { runs: 0, near: 0, dogs: 0, catches: 0, maxM: 0, fish: 0 }),
    ach: store.get('ach', []),
    house: store.get('house', { owned: [], placed: {} }),
    events: store.get('events', {}),
    tourDone: store.get('tourDone', false),
    theme: store.get('theme', 'klasik'),
    notify: store.get('notify', false),
    rival: store.get('rival', null),
    pet: store.get('pet', { food: 70, clean: 55, fun: 65, energy: 80, t: Date.now(), sleep: false }),
    play: store.get('play', { date: '', catches: 0, rewarded: 0 }),
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
  // Temalar: oyuncu ayarlardan secer. mix = paletin hangi rengini hangi renge ne kadar yaklastiracagi.
  const THEMES = [
    { id: 'klasik',   name: 'Klasik',    icon: '🏙️', fx: null,     mix: {} },
    { id: 'ilkbahar', name: 'İlkbahar',  icon: '🌸', fx: 'petals', mix: { skyBot: ['#fde3ec', 0.3], wall: ['#f0b9c4', 0.22], city: ['#bcd3b4', 0.3], mark: ['#fbe1e6', 0.2] } },
    { id: 'yaz',      name: 'Yaz',       icon: '☀️', fx: 'bfly',   mix: { skyTop: ['#55b2ef', 0.3], skyBot: ['#fff1c2', 0.32], wall: ['#f4cd84', 0.22], city: ['#9fc7e0', 0.2] } },
    { id: 'sonbahar', name: 'Sonbahar',  icon: '🍂', fx: 'leaves', mix: { skyBot: ['#f6c493', 0.32], wall: ['#d98f62', 0.28], city: ['#c3a28c', 0.3], mark: ['#f1c7a3', 0.2] } },
    { id: 'kis',      name: 'Kış',       icon: '❄️', fx: 'snow',   mix: { skyTop: ['#9db4d6', 0.25], skyBot: ['#eef3fa', 0.4], wall: ['#d9dfe9', 0.3], city: ['#c3cfdf', 0.38], mark: ['#f4f7fb', 0.3] } },
    { id: 'istanbul', name: 'İstanbul',  icon: '🕌', fx: 'gulls',  mix: { skyBot: ['#fad3b6', 0.22], wall: ['#dcb79a', 0.3], city: ['#8e8bb0', 0.35], mark: ['#efd8c4', 0.25], edge: ['#a77e62', 0.25] } },
  ];
  const THEME_BY_ID = Object.fromEntries(THEMES.map((x) => [x.id, x]));
  let PAL_NUM = [];
  function buildPalettes() {
    const th = THEME_BY_ID[save.theme] || THEMES[0];
    PAL_NUM = PALETTES.map((p) => {
      const o = {};
      for (const k in p) {
        if (k === 'name') continue;
        if (typeof p[k] !== 'string') { o[k] = p[k]; continue; }
        const c = hexRgb(p[k]), m = th.mix[k];
        o[k] = m ? c.map((v, i) => Math.round(v + (hexRgb(m[0])[i] - v) * m[1])) : c;
      }
      return o;
    });
  }
  const theme = () => THEME_BY_ID[save.theme] || THEMES[0];
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

  // Istanbul silueti: kubbeler, minareler, Galata Kulesi, deniz ve vapur
  const IST = [];
  { let x = WALL - 6; let k = 0;
    while (x < W - WALL) {
      const kind = k === 2 ? 'galata' : (k % 3 === 0 ? 'cami' : 'ev');
      const w = kind === 'cami' ? 78 : kind === 'galata' ? 26 : Math.round(rand(20, 34));
      IST.push({ kind, x, w, h: kind === 'ev' ? Math.round(rand(26, 48)) : 0 });
      x += w + (kind === 'cami' ? 6 : 2); k++;
    }
  }
  function drawIstanbul(sy) {
    const g = ctx;
    g.fillStyle = P.city;
    for (const b of IST) {
      if (b.kind === 'ev') { g.fillRect(b.x, sy - b.h, b.w, b.h + H); continue; }
      if (b.kind === 'galata') {
        const cx = b.x + b.w / 2;
        g.fillRect(cx - 10, sy - 92, 20, 92 + H);
        g.fillRect(cx - 12, sy - 98, 24, 7);
        g.beginPath(); g.moveTo(cx - 12, sy - 98); g.lineTo(cx, sy - 128); g.lineTo(cx + 12, sy - 98); g.closePath(); g.fill();
        continue;
      }
      const cx = b.x + b.w / 2; // cami
      g.fillRect(b.x + 8, sy - 34, b.w - 16, 34 + H);
      g.beginPath(); g.arc(cx, sy - 34, 22, Math.PI, 0); g.fill();
      g.fillRect(cx - 1.5, sy - 64, 3, 9);
      for (const s of [-1, 1]) {
        g.beginPath(); g.arc(cx + s * 22, sy - 34, 10, Math.PI, 0); g.fill();
        const mx = cx + s * (b.w / 2 - 3);
        g.fillRect(mx - 2.5, sy - 92, 5, 92);
        g.fillRect(mx - 3.5, sy - 70, 7, 3);
        g.beginPath(); g.moveTo(mx - 2.5, sy - 92); g.lineTo(mx, sy - 108); g.lineTo(mx + 2.5, sy - 92); g.closePath(); g.fill();
      }
    }
    // pencere isiklari (aksam/gece)
    if (P.stars > 0.05) { g.fillStyle = `rgba(${P.winA},0.5)`; for (const b of IST) if (b.kind === 'ev') for (let ly = 8; ly < b.h - 6; ly += 11) g.fillRect(b.x + 5, sy - b.h + ly, 3, 4); }
    // deniz ve yavas giden vapur
    const sea = g.createLinearGradient(0, sy, 0, sy + 60);
    sea.addColorStop(0, `rgba(${P.skyBotA},0.95)`); sea.addColorStop(1, `rgba(${P.skyTopA},0.95)`);
    g.fillStyle = sea; g.fillRect(0, sy, W, H);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(WALL + ((i * 53 + clock * 6) % (W - WALL * 2)), sy + 10 + (i % 3) * 12, 14, 1.5);
    const fx = WALL + ((clock * 9) % (W - WALL * 2 + 80)) - 40, fy = sy + 22;
    g.fillStyle = '#ffffff'; rr(g, fx - 18, fy - 6, 36, 8, 3); g.fill();
    g.fillStyle = '#3b3552'; g.fillRect(fx - 16, fy + 1, 32, 3);
    g.fillStyle = '#ffffff'; g.fillRect(fx - 8, fy - 11, 14, 5);
    g.fillStyle = '#d9534f'; g.fillRect(fx + 1, fy - 16, 4, 6);
  }

  // ================= Ekran olcekleme =================
  let H = 640, scale = 1, dpr = 1, safeTop = 0;
  let dprCap = 2, perfAcc = 0, perfN = 0; // yavas telefonda cizim cozunurlugu kendiliginden duser
  const playerY = () => H * 0.72;

  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const gw = Math.min(vw, Math.round(vh * 0.62));
    scale = gw / W;
    H = vh / scale;
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
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

  // ================= Ses: tamamen kodla uretilen efektler, kedi/kopek sesleri ve muzik =================
  // Hicbir hazir ses dosyasi kullanilmaz. Sesler sikistirici (compressor) ve hafif yanki (reverb) ile dengelenir.
  const audio = { ctx: null, sfx: null, music: null, noise: null, nextT: 0, step: 0, playing: false, mode: '' };
  function buildAudio(c) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    comp.connect(c.destination);
    const master = c.createGain(); master.gain.value = 0.95; master.connect(comp);
    // yanki: uretilmis, yavasca sonen bir darbe tepkisi
    const len = Math.floor(c.sampleRate * 1.6), imp = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = imp.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const rev = c.createConvolver(); rev.buffer = imp;
    const revOut = c.createGain(); revOut.gain.value = 0.3; rev.connect(revOut).connect(master);
    audio.sfx = c.createGain(); audio.sfx.gain.value = 0.9; audio.sfx.connect(master);
    const sSend = c.createGain(); sSend.gain.value = 0.15; audio.sfx.connect(sSend).connect(rev);
    audio.music = c.createGain(); audio.music.gain.value = 0.34; audio.music.connect(master);
    const mSend = c.createGain(); mSend.gain.value = 0.55; audio.music.connect(mSend).connect(rev);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    audio.noise = nb;
    audio.ctx = c;
  }
  // Gercek kayitlar (telifsiz: CC0 / kamu mali, kaynaklar sounds/KAYNAKLAR.txt). Yuklenemezse kodla uretilen ses calar.
  const SAMPLE_FILES = ['miyav1', 'miyav2', 'miyav3', 'miyav4', 'siyam', 'mirlama'];
  const samples = {};
  let samplesRequested = false;
  function loadSamples() {
    if (samplesRequested || !audio.ctx || typeof fetch !== 'function') return;
    samplesRequested = true;
    for (const n of SAMPLE_FILES) {
      fetch(`sounds/${n}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
        .then((b) => new Promise((ok, no) => { const p = audio.ctx.decodeAudioData(b, ok, no); if (p && p.then) p.then(ok, no); }))
        .then((buf) => { samples[n] = buf; })
        .catch(() => { /* kodla uretilen yedek ses kullanilir */ });
    }
  }
  function playSample(name, { vol = 0.8, rate = 1, delay = 0 } = {}) {
    const buf = samples[name];
    if (!buf) return false;
    const c = audio.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = buf;
    s.playbackRate.value = rate;
    g.gain.value = vol;
    s.connect(g).connect(audio.sfx);
    s.start(c.currentTime + delay);
    return true;
  }
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const jitter = (a = 0.06) => 1 - a + Math.random() * 2 * a;
  function ac() {
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      buildAudio(new AC());
      loadSamples();
    }
    if (audio.ctx.state === 'suspended' && audio.ctx.resume) audio.ctx.resume();
    return audio.ctx;
  }
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0, attack = 0.006, dest, detune = 0 } = {}) {
    const c = audio.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    env(g, t, vol, attack, dur);
    o.connect(g).connect(dest || audio.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function hiss(dur, { freq = 1000, q = 1, vol = 0.15, delay = 0, sweep = 0, type = 'bandpass', attack = 0.003, dest } = {}) {
    const c = audio.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = audio.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain();
    env(g, t, vol, attack, dur);
    s.connect(f).connect(g).connect(dest || audio.sfx);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }
  // Zil gibi ses: temel nota + uyumsuz ust kismi, uzun sonumlu
  function bell(freq, dur, vol, delay = 0, dest) {
    tone(freq, dur, { vol, delay, attack: 0.003, dest });
    tone(freq * 2.76, dur * 0.45, { vol: vol * 0.35, delay, attack: 0.002, dest });
    tone(freq * 5.4, dur * 0.2, { vol: vol * 0.12, delay, attack: 0.002, dest });
  }

  // Kedi miyavlamasi: formant sentezi. Testere dalgasi kaynak, iki bant geciren filtre "i-a-u" unlu gecisini yapar,
  // perde once yukselip sonra iner, hafif titresim (vibrato) ve "m" ile baslayan yumusak giris vardir.
  function catMeow(kind = 'normal', delay = 0, pitch = 1) {
    const c = audio.ctx, t = c.currentTime + delay;
    const K = {
      normal: { dur: 0.6, f0: 640, peak: 1.32, end: 0.74, vol: 0.32 },
      short:  { dur: 0.3, f0: 760, peak: 1.25, end: 0.95, vol: 0.28 },
      sad:    { dur: 0.85, f0: 560, peak: 1.18, end: 0.55, vol: 0.3 },
      happy:  { dur: 0.42, f0: 720, peak: 1.4, end: 1.05, vol: 0.3 },
    }[kind];
    const f0 = K.f0 * pitch * (0.94 + Math.random() * 0.12), d = K.dur;
    const src = c.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0 * 0.82, t);
    src.frequency.linearRampToValueAtTime(f0 * K.peak, t + d * 0.32);
    src.frequency.linearRampToValueAtTime(f0 * K.end, t + d);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 6.5; lg.gain.value = f0 * 0.018;
    lfo.connect(lg).connect(src.frequency);
    const out = c.createGain();
    env(out, t, K.vol, 0.07, d);
    const nasal = c.createBiquadFilter(); nasal.type = 'lowpass'; nasal.Q.value = 0.7;
    nasal.frequency.setValueAtTime(700, t);
    nasal.frequency.exponentialRampToValueAtTime(5000, t + 0.09);
    nasal.frequency.exponentialRampToValueAtTime(1800, t + d);
    const formant = (path, q, gain) => {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(path[0], t);
      bp.frequency.linearRampToValueAtTime(path[1], t + d * 0.35);
      bp.frequency.linearRampToValueAtTime(path[2], t + d);
      const gg = c.createGain(); gg.gain.value = gain;
      src.connect(bp).connect(gg).connect(nasal);
    };
    formant([420, 950, 520], 4, 1.0);   // F1: i -> a -> u
    formant([2300, 1500, 950], 5, 0.7); // F2
    formant([3000, 2800, 2600], 8, 0.25); // F3
    nasal.connect(out).connect(audio.sfx);
    src.start(t); lfo.start(t);
    src.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
  }

  // Kopek havlamasi: sert baslangic, kisa "hav": perde hizla yukselip iner, gogus rezonansi ve nefes gurultusu
  function dogBark(delay = 0, pitch = 1) {
    // Yumusak "huf": "w" ile baslayip "o" unlusune gecen, kisa ve yuvarlak bir havlama.
    const c = audio.ctx, t = c.currentTime + delay, d = 0.2;
    const p = 240 * pitch * (0.96 + Math.random() * 0.08);
    const src = c.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(p * 0.7, t);
    src.frequency.exponentialRampToValueAtTime(p * 1.25, t + 0.035);
    src.frequency.exponentialRampToValueAtTime(p * 0.75, t + d);
    const body = c.createOscillator(); body.type = 'triangle';
    body.frequency.setValueAtTime(p * 0.5, t); body.frequency.exponentialRampToValueAtTime(p * 0.38, t + d);
    const out = c.createGain();
    env(out, t, 0.3, 0.012, d);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.03); lp.frequency.exponentialRampToValueAtTime(700, t + d);
    for (const [f, q, gn] of [[520, 4, 1], [950, 5, 0.6]]) { // "o" unlusu
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * pitch; bp.Q.value = q;
      const gg = c.createGain(); gg.gain.value = gn;
      src.connect(bp).connect(gg).connect(lp);
    }
    const bg = c.createGain(); bg.gain.value = 0.5; body.connect(bg).connect(lp);
    lp.connect(out).connect(audio.sfx);
    src.start(t); body.start(t); src.stop(t + d + 0.05); body.stop(t + d + 0.05);
    hiss(0.05, { freq: 800, q: 0.8, vol: 0.06, delay, attack: 0.004 }); // hafif nefes
  }

  // Karga: genizden, cizik "gaak"
  function crowCaw(delay = 0) {
    const c = audio.ctx, t = c.currentTime + delay, d = 0.26;
    const src = c.createOscillator(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(520, t);
    src.frequency.linearRampToValueAtTime(610, t + 0.05);
    src.frequency.linearRampToValueAtTime(430, t + d);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 2.5;
    const out = c.createGain(); env(out, t, 0.22, 0.01, d);
    src.connect(bp).connect(out).connect(audio.sfx);
    src.start(t); src.stop(t + d + 0.05);
    hiss(d, { freq: 1600, q: 1.5, vol: 0.06, delay });
  }

  const SFX = {
    jump() { tone(330, 0.09, { vol: 0.12, slide: 820, attack: 0.003, type: 'triangle' }); hiss(0.12, { freq: 900, sweep: 3200, q: 0.9, vol: 0.06 }); }, // hizli 'fiyuv'
    land() { hiss(0.06, { freq: 500, q: 0.8, vol: 0.09, type: 'lowpass' }); tone(150, 0.08, { vol: 0.1, slide: 85 }); },
    coin() { // balik yeme: sevimli, yumusak "nyam" ve kucuk bir zil
      const p = jitter(0.06);
      for (const [d, f] of [[0, 330], [0.11, 300]]) {
        tone(f * p, 0.07, { vol: 0.09, slide: f * p * 0.7, delay: d, attack: 0.004 }); // "nyam"
        hiss(0.03, { freq: 2600, q: 1.2, vol: 0.025, delay: d + 0.01 });             // minik isirik
      }
      // pes pese toplayinca yukselen parlak 'bling' (heyecan icin)
      const n = performance.now();
      coinStreak = n - coinLastT < 1300 ? Math.min(coinStreak + 1, 9) : 0;
      coinLastT = n;
      const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
      const f0 = midi(84 + SCALE[coinStreak]);
      bell(f0, 0.2, 0.05, 0.02); bell(f0 * 1.5, 0.16, 0.025, 0.07);
    },
    near() { hiss(0.2, { freq: 700, sweep: 2600, q: 1.2, vol: 0.08 }); tone(1760, 0.12, { vol: 0.035, delay: 0.05 }); },
    hit() { tone(170, 0.32, { vol: 0.32, slide: 55, attack: 0.003 }); hiss(0.15, { freq: 300, q: 0.7, vol: 0.12, type: 'lowpass' }); },
    meow() { catVoice('normal'); },
    meowShort() { catVoice('short'); },
    meowSad() { catVoice('sad'); },
    meowHappy() { catVoice('happy'); },
    purr() {
      const v = CAT_VOICE[save.char] || CAT_VOICE.sarman;
      if (playSample('mirlama', { vol: 0.9, rate: 0.85 + v.rate * 0.15 })) return;
      const c = audio.ctx, t = c.currentTime; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 26; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = c.createGain(); env(g, t, 0.18, 0.15, 1.2); o.connect(lp).connect(g).connect(audio.sfx); o.start(t); o.stop(t + 1.3); },
    bark() { dogBark(0); dogBark(0.26, 1.05); }, // "hav hav" (kodla, temiz ve yumusak)
    growlDog() { const c = audio.ctx, t = c.currentTime; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(80, t + 0.6); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = c.createGain(); env(g, t, 0.14, 0.08, 0.6); o.connect(lp).connect(g).connect(audio.sfx); o.start(t); o.stop(t + 0.7); },
    caw() { crowCaw(0); crowCaw(0.3); },
    dash() { hiss(0.22, { freq: 500, sweep: 3000, q: 1, vol: 0.12 }); tone(600, 0.15, { vol: 0.04, slide: 1200 }); },
    sticky() { const c = audio.ctx, t = c.currentTime; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.22); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 8; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.08); lp.frequency.exponentialRampToValueAtTime(250, t + 0.22); const g = c.createGain(); env(g, t, 0.18, 0.01, 0.24); o.connect(lp).connect(g).connect(audio.sfx); o.start(t); o.stop(t + 0.3); },
    power() { [1047, 1319, 1568, 2093].forEach((f, i) => bell(f, 0.3, 0.06, i * 0.05)); },
    stage() { [523, 659, 784, 1047].forEach((f) => bell(f, 1.1, 0.05)); bell(1568, 0.9, 0.04, 0.12); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => bell(f, 0.5, 0.07, i * 0.1)); setTimeout(() => sfx('meowHappy'), 550); },
    lose() { [440, 392, 330, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.09, delay: i * 0.16 })); },
    splash() { hiss(0.35, { freq: 2500, q: 0.5, vol: 0.15, sweep: 700 }); for (let i = 0; i < 4; i++) tone(600 + Math.random() * 700, 0.05, { vol: 0.04, slide: 1400, delay: 0.05 + i * 0.05 }); },
    shield() { bell(880, 0.5, 0.07); tone(1760, 0.3, { vol: 0.04, slide: 880 }); },
    escape() { [784, 988, 1175, 1568].forEach((f, i) => bell(f, 0.35, 0.06, i * 0.07)); },
    ui() { tone(1000, 0.06, { vol: 0.06, slide: 700 }); },
    click() { tone(900, 0.05, { vol: 0.07, slide: 500, attack: 0.002 }); },
    tick() { bell(1175, 0.18, 0.08); },
    go() { bell(1568, 0.35, 0.09); bell(2093, 0.4, 0.07, 0.06); },
    start() { [523, 784, 1047].forEach((f, i) => bell(f, 0.3, 0.06, i * 0.07)); setTimeout(() => sfx('meowHappy'), 260); },
    growl() { const c = audio.ctx, t = c.currentTime; const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(70, t + 0.7); const am = c.createOscillator(), ag = c.createGain(); am.frequency.value = 13; ag.gain.value = 0.08; const g = c.createGain(); env(g, t, 0.16, 0.1, 0.75); am.connect(ag).connect(g.gain); o.connect(g).connect(audio.sfx); o.start(t); am.start(t); o.stop(t + 0.8); am.stop(t + 0.8); },
    spray() { hiss(0.45, { freq: 3000, q: 0.4, vol: 0.08, sweep: 1600, type: 'highpass' }); },
    energy() { bell(1319, 0.25, 0.05); bell(1760, 0.3, 0.04, 0.05); },
    pause() { tone(659, 0.12, { vol: 0.06, slide: 494 }); },
    flap() { hiss(0.07, { freq: 450, q: 1.3, vol: 0.05 }); },
    buy() { bell(1047, 0.3, 0.07); bell(1568, 0.4, 0.07, 0.08); },
    nope() { tone(220, 0.14, { type: 'triangle', vol: 0.08, slide: 180 }); },
  };
  let coinStreak = 0, coinLastT = 0;
  function sfx(name) {
    if (!save.sound || DEMO) return;
    try { if (ac()) SFX[name](); } catch { /* ses desteklenmiyor */ }
  }

  // ---------- Oyun muzigi: yalnizca kosu sirasinda calar, menulerde sessiz (sadece efektler) ----------
  // Telifsiz (CC0) hareketli parcalar; her turda biri secilir. <audio> ile akarak calinir.
  const GAME_TRACKS = ['sounds/oyun1.mp3', 'sounds/oyun2.mp3', 'sounds/oyun3.mp3'];
  let musicEl = null, musicTry = 0, trackIdx = -1, appAsleep = false;
  function nextTrack() { // her yeni turda farkli parca
    trackIdx = (trackIdx + 1 + Math.floor(Math.random() * (GAME_TRACKS.length - 1))) % GAME_TRACKS.length;
    if (musicEl) { musicEl.src = GAME_TRACKS[trackIdx]; musicEl.volume = 0; }
  }
  function musicTick() {
    const playing = state === 'play' || state === 'count' || state === 'hint';
    const want = save.music && !DEMO && playing && !appAsleep && !document.hidden && !!audio.ctx; // ctx: kullanici dokundu demek
    if (!want) {
      if (musicEl && !musicEl.paused) {
        musicEl.volume = Math.max(0, musicEl.volume - 0.06); // yumusakca sus
        if (musicEl.volume <= 0.01 || appAsleep || document.hidden) musicEl.pause();
      }
      return;
    }
    if (!musicEl) {
      if (typeof Audio !== 'function') return;
      if (trackIdx < 0) trackIdx = Math.floor(Math.random() * GAME_TRACKS.length);
      musicEl = new Audio(GAME_TRACKS[trackIdx]);
      musicEl.loop = true;
      musicEl.preload = 'auto';
      musicEl.volume = 0;
    }
    const target = state === 'hint' ? 0.12 : 0.4;
    musicEl.volume = Math.max(0, Math.min(1, musicEl.volume + (target - musicEl.volume) * 0.05));
    const now = performance.now();
    if (musicEl.paused && now - musicTry > 1500) {
      musicTry = now;
      const p = musicEl.play();
      if (p && p.catch) p.catch(() => { /* tarayici izin vermedi; sonraki dokunusta tekrar denenir */ });
    }
  }
  // Uygulama arka plana gecince / ekran kilitlenince butun sesi hemen kes (kare dongusu o an durdugu icin burada)
  function audioSleep(sleep) {
    if (sleep && !appAsleep) scheduleReminders();
    appAsleep = sleep;
    try {
      if (sleep) {
        if (musicEl) musicEl.pause();
        if (audio.ctx && audio.ctx.state === 'running' && audio.ctx.suspend) audio.ctx.suspend();
      } else if (audio.ctx && audio.ctx.state === 'suspended' && audio.ctx.resume) audio.ctx.resume();
    } catch { /* yoksay */ }
  }
  function capPlugin(name) { // Capacitor eklentisi (yalnizca APK icinde var)
    const C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
    return (C.Plugins && C.Plugins[name]) || (C.registerPlugin ? C.registerPlugin(name) : null);
  }

  // ---------- Her kedinin kendi ses tonu ----------
  // set: kullanilacak gercek kayitlar, rate: perde (1 = dogal; kucuk sayi daha kalin ses)
  const CAT_VOICE = {
    sarman:  { set: ['miyav3', 'miyav4'], rate: 1.0 },
    tekir:   { set: ['miyav1', 'miyav4'], rate: 0.93 },
    pamuk:   { set: ['miyav3', 'miyav2'], rate: 1.16 },
    kara:    { set: ['miyav1', 'miyav4'], rate: 0.82 },
    duman:   { set: ['miyav4', 'miyav1'], rate: 0.95 },
    benekli: { set: ['miyav2', 'miyav3'], rate: 1.08 },
    siyam:   { set: ['siyam'], rate: 1.0 },          // gercek bir Siyam kedisi kaydi
    karamel: { set: ['miyav3'], rate: 1.1 },
    benek:   { set: ['miyav4', 'miyav2'], rate: 1.04 },
    zeytin:  { set: ['miyav1', 'miyav4'], rate: 0.88 },
    van:     { set: ['miyav2', 'miyav3'], rate: 1.13 },
  };
  const KIND_RATE = { normal: 1, short: 1.08, sad: 0.9, happy: 1.12 };
  function catVoice(kind = 'normal', catId = save.char) {
    const v = CAT_VOICE[catId] || CAT_VOICE.sarman;
    const name = kind === 'sad' && v.set.includes('miyav1') ? 'miyav1' : pickOne(v.set);
    const vol = kind === 'short' ? 0.65 : 0.75;
    if (!playSample(name, { vol, rate: v.rate * KIND_RATE[kind] * jitter(0.03) })) catMeow(kind, 0, v.rate);
  }

  // ---------- Oyuncak sesleri (kodla) ----------
  const TOY_SFX = {
    tuy:     { move() { hiss(0.12, { freq: 2600, q: 0.6, vol: 0.035, sweep: 4200 }); }, catch() { bell(2637, 0.25, 0.05); bell(3520, 0.2, 0.035, 0.05); } },
    fare:    { move() { if (Math.random() < 0.4) squeak(1, 0.05); }, catch() { squeak(1.15, 0.08); squeak(1.3, 0.07, 0.11); } },
    yumak:   { move() { hiss(0.09, { freq: 700, q: 0.8, vol: 0.04 }); }, catch() { tone(170, 0.12, { vol: 0.12, slide: 120 }); hiss(0.08, { freq: 900, q: 0.7, vol: 0.05 }); } },
    balik:   { move() {}, catch() { rubberSqueak(0); rubberSqueak(0.16); } },
    kelebek: { move() { flutter(0.18); }, catch() { bell(1760, 0.3, 0.04); flutter(0.3); } },
    lazer:   { move() { tone(1900, 0.04, { vol: 0.02, slide: 2300 }); }, catch() { tone(1400, 0.08, { vol: 0.05, slide: 2100 }); } },
  };
  function squeak(p = 1, vol = 0.06, delay = 0) { // fare cikligi
    const c = audio.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(2900 * p, t);
    o.frequency.linearRampToValueAtTime(3700 * p, t + 0.05);
    o.frequency.linearRampToValueAtTime(3200 * p, t + 0.09);
    env(g, t, vol, 0.006, 0.1);
    o.connect(g).connect(audio.sfx); o.start(t); o.stop(t + 0.12);
  }
  function rubberSqueak(delay = 0) { // pelus oyuncak gicirtisi
    const c = audio.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(), bp = c.createBiquadFilter();
    o.type = 'square'; bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 3;
    o.frequency.setValueAtTime(700, t); o.frequency.exponentialRampToValueAtTime(1150, t + 0.08); o.frequency.exponentialRampToValueAtTime(900, t + 0.13);
    env(g, t, 0.07, 0.01, 0.14);
    o.connect(bp).connect(g).connect(audio.sfx); o.start(t); o.stop(t + 0.16);
  }
  function flutter(dur) { // kanat cirpma
    const c = audio.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = audio.noise;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const g = c.createGain(), am = c.createOscillator(), ag = c.createGain();
    am.frequency.value = 26; ag.gain.value = 0.025;
    g.gain.setValueAtTime(0.025, t); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    am.connect(ag).connect(g.gain);
    s.connect(bp).connect(g).connect(audio.sfx);
    s.start(t, Math.random()); am.start(t); s.stop(t + dur); am.stop(t + dur);
  }
  let toyMoveT = 0;
  function toySound(kind) {
    if (!save.sound || DEMO) return;
    try {
      if (!ac()) return;
      const s = TOY_SFX[save.toys.sel] || TOY_SFX.tuy;
      if (kind === 'catch') s.catch();
      else { const n = performance.now(); if (n - toyMoveT > 380) { toyMoveT = n; s.move(); } }
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
  let pattern = null, points = 0, breatherT = 0;
  let stats = null;
  let bgOff = 0, clock = 0, overAt = 0, countT = 0;
  let stage = 0, darkAmt = 0, darkTarget = 0, fogAmt = 0, weather = 'clear';
  const toastMsg = { text: '', sub: '', t: 0 };

  const MENU_STATES = ['menu', 'levels', 'chars', 'shop', 'missions', 'wardrobe', 'board', 'settings', 'ach', 'house', 'photo'];
  const meters = () => Math.floor(dist / METER);
  const score = () => Math.floor(points) + bonus;
  const isRunMode = () => run && (run.mode === 'endless' || run.mode === 'daily');
  const stageMult = () => (isRunMode() ? Math.round((1 + 0.1 * stage) * 10) / 10 : 1);
  const isMenuState = () => MENU_STATES.includes(state);
  const comboMult = () => Math.min(5, 1 + Math.floor(combo / 2));
  const diffOf = () => DIFFS[(run && run.diff) || save.diff];
  const jumpTime = () => (weather === 'rain' ? JUMP_RAIN : JUMP_BASE);
  const fishValue = () => (1 + upg('balik')) * (catIs('benek') ? 2 : 1);
  const feedMult = () => (catIs('karamel') ? 1.5 : 1);
  const energyTime = () => (catIs('zeytin') ? 6 : 10);
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
    const minY = floaters.reduce((m, f) => Math.min(m, f.y), player.y - 14);
    floaters.push({ text, color, x: W / 2, y: Math.min(player.y - 34, minY - 20), t: 1.1 });
  }

  function reset() {
    player = { side: 0, x: LEFT_X, y: playerY(), jumping: false, jt: 0, dur: JUMP_BASE, fromX: LEFT_X, toX: LEFT_X, queued: false, squash: 0, wiggle: 0 };
    obstacles = []; coins = []; powerups = []; particles = []; floaters = []; crows = [];
    speed = 250; dist = 0; bonus = 0; coinCount = 0; coinsSpawned = 0;
    lastTop = -40; lastSide = 1; sameRun = 0; spawnDone = false;
    shieldHP = 0; magnetT = 0; slowT = 0; invulnT = 0; shieldHits = 0;
    combo = 0; comboT = 0; runT = 0; jetClock = 0; missionT = 0; stickTaps = 0;
    chase = null; chaseCooldown = 0; crowT = rand(7, 11); hintSlow = 0; dogEventDone = false;
    pattern = null; points = 0; breatherT = 0;
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

    // Desen secimi (sonsuz kosu / gunun seferi): 4-6 engellik ritimli kaliplar
    let pat = 'normal', announce = null;
    if (!item && isRunMode()) {
      if (!pattern || pattern.left <= 0) {
        const pool = PATTERNS.filter((p) => stage >= p.from);
        let r = rnd() * pool.reduce((s, p) => s + p.w, 0), chosen = pool[0];
        for (const p of pool) { r -= p.w; if (r <= 0) { chosen = p; break; } }
        pattern = { id: chosen.id, left: 4 + Math.floor(rnd() * 3) };
        announce = chosen.name || null;
      }
      pattern.left--;
      pat = pattern.id;
    }
    const plain = pat === 'zigzag' || pat === 'merdiven'; // ritim desenlerinde ozel engel yok

    let side = rnd() < 0.5 ? 0 : 1;
    if (side === lastSide && sameRun >= sameMax) side = 1 - side;
    if (k === 'bar' || k === 'sticky' || k === 'power' || k === 'jet') side = 1 - lastSide;
    if (k === 'empty') side = lastSide;
    if (pat === 'zigzag') side = 1 - lastSide;
    if (pat === 'merdiven') side = lastSide;
    const switching = side !== lastSide;
    sameRun = switching ? 0 : sameRun + 1;

    const react = Math.max(0.18, lerp(cfg.react[0], cfg.react[1], d) * df.react);
    const need = speed * (JUMP_MAX + react) + 2 * R;
    let gap, barTop = null, sticky = false;
    if (switching) {
      const extra = pat === 'zigzag' ? grand(0, 24) : grand(0, 90 * (1 - d) + 20);
      if (k === 'bar' || (!item && !plain && rnd() < F.bars)) {
        gap = 2 * need + BAR_H + extra;
        barTop = lastTop - (need + extra / 2) - BAR_H;
      } else {
        sticky = k === 'sticky' || (!item && !plain && rnd() < F.sticky);
        gap = need + extra + (sticky ? speed * STICKY_EXTRA : 0);
      }
    } else {
      gap = k === 'empty' ? need * 2.6 : grand(40, 110);
    }

    const isJet = k === 'jet' || (!item && !plain && rnd() < F.jets);
    let len, skin = rnd() < 0.5 ? 'vacuum' : 'pipe';
    if (isJet) len = JET_H;
    else if (k === 'ac' || (!item && !plain && rnd() < F.ac)) { skin = 'ac'; len = rnd() < 0.5 ? 56 : 70; }
    else if (pat === 'zigzag') len = TOOTH * 4;
    else {
      const lenMax = lerp(lenCfg[1], lenCfg[2], d);
      len = Math.max(TOOTH * 4, Math.round(grand(lenCfg[0], lenMax) / TOOTH) * TOOTH);
    }
    const bottom = lastTop - gap;
    const top = bottom - len;
    const ob = isJet ? { type: 'jet', side, y: top, h: len, phase: grand(0, JET_PERIOD) } : { type: 'spike', side, y: top, h: len, skin };
    if (item && item.hint) ob.hint = item.hint;
    if (item && item.trigger) ob.trigger = item.trigger;
    if (announce) ob.announce = announce;
    obstacles.push(ob);
    if (barTop !== null) obstacles.push({ type: 'bar', y: barTop, h: BAR_H, v: Math.floor(rnd() * 3) });
    // Bal: kedinin bu engelden once ayrilmasi gereken duvarda, gecis araligini kaplar
    if (sticky) obstacles.push({ type: 'sticky', side, y: bottom + 6, h: lastTop + 60 - (bottom + 6) });

    const forceFish = (item && item.fish) || pat === 'balik' || (pat === 'merdiven' && rnd() < 0.5);
    if (switching) {
      const midY = barTop !== null ? (bottom + barTop) / 2 : bottom + gap / 2;
      if (pat === 'balik') {
        addCoin(W / 2, midY);
      } else if (k === 'power' || (!item && F.power && rnd() < 0.1)) {
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
    chase.close = Math.max(0, chase.close + diffOf().dog * (catIs('duman') ? 0.6 : 1) * ((run && run.cfg.dogsAll) || 1) * wdt);
    chase.hav = Math.max(0, chase.hav - dt);
    chase.barkT -= dt;
    if (chase.barkT <= 0) {
      chase.barkT = rand(4, 6.5); chase.hav = 0.7; // seyrek havlar, kulak yormaz
      sfx(chase.close > 0.7 ? 'growlDog' : 'bark'); // cok yaklasinca hirlar
      if (chase.close > 0.7) setTimeout(() => sfx('bark'), 650);
    }
    if (chase.close >= 1) {
      chase = null;
      chaseCooldown = run && run.cfg.dogsAll ? 2.5 : 8; // Karabas bolumlerinde kisa sure sonra yine gelir
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
    bonus += 5 * m * (catIs('benekli') ? 2 : 1);
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
    else if (p.kind === 'mama') { tokluk = Math.min(100, tokluk + 50 * feedMult()); energy = Math.min(energyMax, energy + 1); }
    toast(POWERS[p.kind].name, p.kind === 'mama' ? 'Karın doydu, +1 pati' : '', 1.1);
    burst(p.x, p.y, POWERS[p.kind].color, 6, 110);
    sfx('power');
    if (p.kind === 'mama') sfx('meowShort');
    vibrate(20);
  }

  const HIT_REASON = { spike: 'Süpürgeye takıldın!', pipe: 'Borudan ıslandın!', jet: 'Islandın!', bar: 'İpe takıldın!', hunger: 'Aç kaldın!', dog: 'Köpek yakaladı!' };
  function hit(kind) {
    if (kind === 'jet' || kind === 'pipe') sfx('splash');
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
    sfx('meowSad');
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
    nextTrack();
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
    $('hintCard').classList.add('hidden');
    if (opts.resume) return;
    state = 'play';
    show(null);
    sfx('start');
    if (mode === 'tutorial' && !DEMO) { // egitimin ilk karti: ne yapacagini soyle
      state = 'hint';
      $('hintTitle').textContent = 'Hoş geldin! 🐾';
      $('hintSub').textContent = 'Kedin duvardan duvara zıplayarak binaya tırmanacak. Ekrana her dokunduğunda zıplar. Hadi dene!';
      $('hintCard').classList.remove('hidden');
      $('pauseBtn').classList.add('hidden');
    }
  }

  function snapshot() {
    return {
      v: 4, mode: run.mode, level: run.level, diff: run.diff, oldY: player.y,
      player: { ...player }, obstacles, coins: coins.map((c) => ({ x: c.x, y: c.y, f: c.f })), powerups,
      speed, dist, bonus, coinCount, coinsSpawned, lastTop, lastSide, sameRun, spawnDone,
      shieldHP, magnetT, slowT, invulnT, shieldHits, stage, rngState, weather,
      lives, maxLives, tokluk, energy, energyMax, energyT, runT, jetClock, stats, chase, chaseCooldown, dogEventDone,
      points, pattern, revived: !!run.revived, bankedCount: run.bankedCount || 0,
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
    save.wallet += Math.max(0, (save.resume.coinCount || 0) - (save.resume.bankedCount || 0)) * fishValue();
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
    points = d.points || dist / METER;
    pattern = d.pattern || null;
    run.revived = !!d.revived;
    run.bankedCount = d.bankedCount || 0;
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

  function revive() {
    if (!run || run.revived || state !== 'over' || save.wallet < REVIVE_COST) return;
    save.wallet -= REVIVE_COST;
    persist('wallet');
    run.revived = true;
    run.banked = false;
    lives = 1;
    tokluk = Math.max(tokluk, 70);
    chase = null; chaseCooldown = 6;
    // kedinin hemen onundeki engelleri temizle ki geri donunce haksiz yere carpmasin
    obstacles = obstacles.filter((o) => o.y + o.h < player.y - 320);
    player.jumping = false; player.queued = false;
    player.x = player.side === 0 ? LEFT_X : RIGHT_X;
    invulnT = 2.5;
    sfx('power');
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
    const fresh = coinCount - (run.bankedCount || 0); // ikinci sanstan sonra once sayilanlar tekrar sayilmaz
    run.bankedCount = coinCount;
    const earned = fresh * fishValue() + extra;
    save.wallet += earned;
    persist('wallet');
    return earned;
  }

  function die(kind) {
    state = 'over';
    if (!isTutorial()) { recordLife(); eventProgress(meters()); checkAchievements(); }
    lastRunM = meters();
    $('challengeBtn').classList.toggle('hidden', isTutorial() || lastRunM < 20);
    const rv = save.rival; // arkadasinin meydan okumasini gectin mi?
    if (rv && !rv.beaten && run.mode === 'endless' && lastRunM > rv.m) {
      rv.beaten = true; save.wallet += 30; persist('rival'); persist('wallet');
      setTimeout(() => showNote('Arkadaşını geçtin! 🏆', rv.m + ' m rekorunu kırdın · +30 balık'), 600);
    }
    overAt = performance.now();
    chase = null;
    const c = CAT_BY_ID[save.char];
    burst(player.x, player.y, c.fur, 10, 150);
    burst(player.x, player.y, c.fur2, 5, 130);
    vibrate(90);
    sfx('meowSad');
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
    // Ikinci sans: sonsuz kosuda tur basina bir kez, balikla
    const canRevive = run.mode === 'endless' && !run.revived;
    $('reviveBtn').classList.toggle('hidden', !canRevive);
    if (canRevive) {
      $('reviveBtn').disabled = save.wallet < REVIVE_COST;
      $('reviveInfo').textContent = save.wallet < REVIVE_COST ? `🐟 ${REVIVE_COST} gerekli (sende ${save.wallet})` : `🐟 ${REVIVE_COST} · kaldığın yerden 1 canla`;
    }
    $('newBest').classList.toggle('hidden', !isBest);
    $('pauseBtn').classList.add('hidden');
    setTimeout(() => { if (state === 'over') show('over'); }, 450);
  }

  function win() {
    state = 'win';
    if (!isTutorial()) { recordLife(); }
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
      $('nextBtn').classList.remove('hidden');
      $('nextBtn').textContent = 'Ana sayfaya geç';
      $('nextBtn').dataset.act = 'menu';
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
    $('nextBtn').textContent = 'Sonraki bölüm';
    $('nextBtn').dataset.act = 'next';
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
      if (energy < energyMax) { energyT += dt; if (energyT >= energyTime()) { energyT = 0; energy++; sfx('energy'); } } else energyT = 0;
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
      points += (dy / METER) * stageMult();
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
          toast(`${st + 1}. Kat · ${PALETTES[S.pal].name}`, `Puan x${stageMult()} · ${S.sub}${wsub}`, 2.8);
          sfx('stage');
          // Mola: yeni engellerden once engelsiz bir aralik ve iki duvarda balik dizisi
          const startY = lastTop - 60;
          lastTop -= speed * BREATHER;
          pattern = null;
          for (let y = startY, i = 0; y > lastTop + 60; y -= 110, i++) addCoin(i % 2 ? RIGHT_X : LEFT_X, y);
          const reward = Math.min(12, 2 + st);
          coinCount += reward;
          floater(`Kat ödülü: +${reward} balık`, COIN);
          if (S.dogs && rnd() < 0.35) startChase(0.15, 'Bekçi köpeği uyandı!');
        }
      } else if (run.mode === 'level' && cfg.dogsAll && !chase && chaseCooldown <= 0) {
        startChase(dogEventDone ? 0.3 : 0.2, dogEventDone ? 'Karabaş yine peşinde!' : 'Bölüm bitene kadar Karabaş peşinde! Kıl payı geç, balık ye.', Infinity);
        dogEventDone = true;
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
          tokluk = Math.min(100, tokluk + 12 * feedMult());
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
        if (o.announce && !o.announced && o.y + o.h > 20) { o.announced = true; floater(o.announce, '#c9d8ea'); }
        if (o.hint && !o.hinted && o.y + o.h > 30) {
          o.hinted = true;
          if (DEMO) { toast(o.hint[0], o.hint[1], 3.4); hintSlow = 2.4; }
          else { // oyunu durdur, karti goster; dokununca devam
            state = 'hint';
            $('hintTitle').textContent = o.hint[0];
            $('hintSub').textContent = o.hint[1];
            $('hintCard').classList.remove('hidden');
            $('pauseBtn').classList.add('hidden');
            hintSlow = 1.6;
          }
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
          if (circleRect(player.x, player.y, hr, x0, y0, x1, y1)) { hit(o.skin === 'pipe' ? 'pipe' : o.type); break; }
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
    if (id === 'madalya') { // odul: sampiyon madalyasi
      g.strokeStyle = '#d9534f'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(nx - 5, ny - 1); g.lineTo(nx, ny + 3); g.lineTo(nx + 5, ny - 1); g.stroke();
      dot(g, nx, ny + 5.5, 3.2, '#f6c35b'); dot(g, nx, ny + 5.5, 1.8, '#fff1b8');
      return;
    }
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
    } else if (id === 'kravat') {
      tri(g, [nx - 2, ny - 1], [nx + 2, ny - 1], [nx, ny + 2], '#4f7fc4');
      g.fillStyle = '#5b8bd0';
      g.beginPath(); g.moveTo(nx - 1.4, ny + 1.5); g.lineTo(nx + 1.4, ny + 1.5); g.lineTo(nx + 2.4, ny + 8); g.lineTo(nx, ny + 10); g.lineTo(nx - 2.4, ny + 8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(nx - 1.6, ny + 4); g.lineTo(nx + 1.8, ny + 3); g.moveTo(nx - 2, ny + 7); g.lineTo(nx + 2, ny + 6); g.stroke();
    } else if (id === 'kalp') {
      g.strokeStyle = '#e9c46a'; g.lineWidth = 0.9;
      g.beginPath(); g.ellipse(nx, ny - 1, 6, 2.2, 0, 0, Math.PI); g.stroke();
      drawHeart(g, nx, ny + 2.2, 6, '#e46b8a');
    } else if (id === 'pelerin') {
      dot(g, nx, ny, 1.8, '#e9c46a'); // pelerinin tokasi (pelerin govdenin arkasinda cizilir)
    }
  }
  // Kahraman pelerini: govdenin arkasinda, poza gore dalgalanir
  function drawCape(g, nx, ny, D, pose, t) {
    const w = Math.sin(t * 4) * 1.6;
    g.fillStyle = '#c95c6b';
    g.beginPath();
    g.moveTo(nx - 5, ny);
    g.lineTo(nx + 5, ny);
    if (pose === 'jump') {
      g.quadraticCurveTo(nx - D * 8, ny + 4, nx - D * 20, ny + 2 + w);
      g.lineTo(nx - D * 18, ny + 11 + w);
      g.quadraticCurveTo(nx - D * 8, ny + 10, nx - 5, ny + 4);
    } else {
      g.quadraticCurveTo(nx + 9, ny + 8, nx + 9 + w * 0.5, ny + 17);
      g.quadraticCurveTo(nx, ny + 19 + w, nx - 9 - w * 0.5, ny + 17);
      g.quadraticCurveTo(nx - 9, ny + 8, nx - 5, ny);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.stroke();
  }
  function drawHeadItem(g, id, hx, hy, D, fx) {
    if (id === 'yildiz') { // odul: yildizli tac
      g.fillStyle = '#f6c35b';
      g.beginPath(); g.moveTo(hx - 7, hy - 7); g.lineTo(hx - 7, hy - 12); g.lineTo(hx - 3.5, hy - 9.5); g.lineTo(hx, hy - 15); g.lineTo(hx + 3.5, hy - 9.5); g.lineTo(hx + 7, hy - 12); g.lineTo(hx + 7, hy - 7); g.closePath(); g.fill();
      g.fillStyle = '#fff6c8';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 1.6 : 3.6; g.lineTo(hx + Math.cos(a) * r, hy - 17.5 + Math.sin(a) * r); }
      g.closePath(); g.fill();
      dot(g, hx - 4, hy - 9, 1, '#9cc3e6'); dot(g, hx + 4, hy - 9, 1, '#e46b8a');
      return;
    }
    if (id === 'yaprak') { // odul: yaprak tac
      const LC = ['#e8915a', '#d9663f', '#e9b44c', '#c9553a', '#e8915a'];
      for (let i = 0; i < 5; i++) { const a = Math.PI * (1.12 + i * 0.19); ell(g, hx + Math.cos(a) * 8.5, hy - 1 + Math.sin(a) * 8.5, 3.6, 2, a + Math.PI / 2, LC[i]); }
      return;
    }
    if (id === 'noel') { // odul: noel sapkasi
      g.fillStyle = '#d9534f';
      g.beginPath(); g.moveTo(hx - 8, hy - 7); g.quadraticCurveTo(hx - 2, hy - 22, hx + D * 9, hy - 16); g.lineTo(hx + 8, hy - 7); g.closePath(); g.fill();
      g.fillStyle = '#ffffff'; rr(g, hx - 9.5, hy - 9, 19, 4, 2); g.fill();
      dot(g, hx + D * 9.5, hy - 16, 2.6, '#ffffff');
      return;
    }
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
    } else if (id === 'beyzbol') {
      g.fillStyle = '#5b9bd5';
      g.beginPath(); g.arc(hx, hy - 3, 8.8, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); g.fill();
      ell(g, hx + D * 8, hy - 5.5, 6, 1.8, D * 0.1, '#4a86c0');
      dot(g, hx, hy - 11.6, 1.2, '#f2efe9');
      g.fillStyle = '#ffffff'; rr(g, hx - 2.5, hy - 9.5, 5, 3, 1); g.fill();
    } else if (id === 'tavsan') {
      for (const s of [-1, 1]) {
        ell(g, hx + s * 3.4, hy - 17, 2.4, 7.5, s * 0.12, '#f6f3ee');
        ell(g, hx + s * 3.4, hy - 16.5, 1.2, 5.5, s * 0.12, '#f2a6b8');
      }
      g.strokeStyle = '#f2a6b8'; g.lineWidth = 1.4;
      g.beginPath(); g.arc(hx, hy - 1, 8.6, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    } else if (id === 'korsan') {
      g.fillStyle = '#d9534f';
      g.beginPath(); g.arc(hx, hy - 1.5, 9, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
      for (const [ox, oy] of [[-4, -6], [2, -8], [5, -4], [-1, -4]]) dot(g, hx + ox, hy + oy, 0.9, '#fff');
      g.strokeStyle = '#d9534f'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(hx - D * 8.5, hy - 3); g.lineTo(hx - D * 12, hy + 1); g.moveTo(hx - D * 8.5, hy - 3); g.lineTo(hx - D * 13, hy - 3); g.stroke();
    } else if (id === 'kovboy') {
      ell(g, hx, hy - 7.5, 13, 2.8, 0, '#9a6a3e');
      g.fillStyle = '#b07a48'; rr(g, hx - 6, hy - 16, 12, 9, 3.5); g.fill();
      g.fillStyle = '#6b4526'; g.fillRect(hx - 6, hy - 10, 12, 2);
      ell(g, hx, hy - 15.5, 3, 1, 0, '#9a6a3e');
    } else if (id === 'cadi') {
      g.fillStyle = '#7a5aa6';
      g.beginPath(); g.moveTo(hx - 6.5, hy - 8); g.lineTo(hx + 6.5, hy - 8); g.quadraticCurveTo(hx + 1, hy - 20, hx - D * 5, hy - 26); g.quadraticCurveTo(hx - 2, hy - 18, hx - 6.5, hy - 8); g.fill();
      ell(g, hx, hy - 8, 12, 2.4, 0, '#6a4d94');
      g.fillStyle = '#e9c46a'; g.fillRect(hx - 5.6, hy - 11, 11.2, 1.8);
      dot(g, hx + 2, hy - 15, 1.1, '#f6dcae');
    } else if (id === 'kulaklik') {
      g.strokeStyle = '#4a4e5c'; g.lineWidth = 2.2;
      g.beginPath(); g.arc(hx, hy - 1, 9.5, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      for (const s of [-1, 1]) { g.fillStyle = '#e46b8a'; rr(g, hx + s * 9.5 - 2.5, hy - 4, 5, 7, 2.5); g.fill(); }
    } else if (id === 'monokl') {
      g.strokeStyle = '#e9c46a'; g.lineWidth = 1;
      g.beginPath(); g.arc(fx + 3.2, hy - 1, 3.1, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(fx + 3.2, hy + 2); g.quadraticCurveTo(fx + 5, hy + 7, fx + 2, hy + 10); g.stroke();
      ctxAlpha(g, 0.18, () => dot(g, fx + 3.2, hy - 1, 2.8, '#cfe8ff'));
    } else if (id === 'kalpgoz') {
      g.globalAlpha = 0.9;
      drawHeart(g, fx - 3.3, hy - 2.2, 7, '#f07aa0');
      drawHeart(g, fx + 3.3, hy - 2.2, 7, '#f07aa0');
      g.globalAlpha = 1;
      g.strokeStyle = '#c4537a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(fx - 0.6, hy - 1.6); g.lineTo(fx + 0.6, hy - 1.6); g.stroke();
    } else if (id === 'maske') {
      g.fillStyle = '#3f4a7a'; rr(g, fx - 7.8, hy - 3.6, 15.6, 5.2, 2.6); g.fill();
      g.strokeStyle = '#3f4a7a'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(fx - D * 7.5, hy - 1); g.lineTo(fx - D * 11, hy + 2); g.stroke();
      for (const ex of [-3.2, 3.2]) { dot(g, fx + ex, hy - 1, 1.5, '#ffffff'); dot(g, fx + ex + D * 0.4, hy - 1, 0.8, '#1d1a1f'); }
    }
  }
  function ctxAlpha(g, a, fn) { const o = g.globalAlpha; g.globalAlpha = a; fn(); g.globalAlpha = o; }

  // Hex rengi acar (amt > 0) / koyulastirir (amt < 0)
  function shadeC(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  // Ustten-soldan isik alan yumusak tuy dolgusu (radyal gecis) ve ince kontur
  function fur(g, x, y, rx, ry, rot, col, outline = true) {
    const r = Math.max(rx, ry);
    const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.45, r * 0.08, x, y, r * 1.08);
    gr.addColorStop(0, shadeC(col, 0.2)); gr.addColorStop(0.62, col); gr.addColorStop(1, shadeC(col, -0.16));
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill();
    if (outline) { g.strokeStyle = 'rgba(70,45,45,0.16)'; g.lineWidth = 0.8; g.stroke(); }
  }
  // Kediyi (0,0) merkezli cizer. dir: bakis yonu (1 = saga), pose: 'wall' | 'jump' | 'idle'
  function drawCat(g, c, dir, pose, t, wear) {
    const D = dir;
    const sway = Math.sin(t * 2.5) * 1.5 + Math.sin(t * 0.9) * 0.8;
    const blink = t % 4.3 < 0.12;
    const breath = pose === 'jump' ? 1 : 1 + Math.sin(t * 2.3) * 0.03; // nefes alip verme
    const twitch = (t % 5.3) < 0.18 ? Math.sin(((t % 5.3) / 0.18) * Math.PI) : 0; // ara sira kulak oynatir
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
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(tail[0], tail[1]); g.quadraticCurveTo(tail[2], tail[3], tail[4], tail[5]); g.stroke();
    g.lineWidth = 3.2; g.strokeStyle = shadeC(darkParts ? c.fur2 : c.fur, 0.12);
    g.beginPath(); g.moveTo(lerp(tail[0], tail[4], 0.35), lerp(tail[1], tail[5], 0.35)); g.quadraticCurveTo(tail[2], tail[3], tail[4], tail[5]); g.stroke();
    dot(g, tail[4], tail[5], 2.3, c.pattern === 'tabby' ? c.fur2 : darkParts ? c.fur2 : c.fur);
    if (wear && wear.neck === 'pelerin') drawCape(g, lerp(head.x, body.x, 0.5), lerp(head.y, body.y, 0.5) + 1, D, pose, t);

    const pawCol = c.paws || (c.pattern === 'points' ? c.fur2 : c.fur);
    g.strokeStyle = pawCol;
    g.lineWidth = 4.4;
    for (const [px, py] of paws) {
      g.beginPath();
      g.moveTo(body.x + (px - body.x) * 0.25, body.y + (py - body.y) * 0.25);
      g.lineTo(px, py);
      g.stroke();
      dot(g, px, py, 2.6, pawCol);
    }

    fur(g, body.x, body.y, body.rx, body.ry * breath, body.rot, c.fur);
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
    } else if (c.pattern === 'spots') { // beyaz uzerine siyah benekler
      ell(g, body.x - 3.5, body.y - 4, 3.2, 2.6, 0.3, c.fur2);
      ell(g, body.x + 4, body.y + 2, 2.6, 2.2, -0.2, c.fur2);
      ell(g, body.x - 1, body.y + 7, 2.2, 1.8, 0, c.fur2);
    } else if (c.pattern === 'tuxedo') { // smokin: genis beyaz gogus
      ell(g, body.x + (pose === 'jump' ? 0 : D * 2.5), body.y + 3, body.rx * 0.65, body.ry * 0.75, 0, c.belly);
    }
    g.restore();

    const hx = head.x, hy = head.y;
    if (wear && wear.neck) drawNeckItem(g, wear.neck, lerp(hx, body.x, 0.5), lerp(hy, body.y, 0.5) + 1, D, t);

    const earCol = darkParts ? c.fur2 : c.fur;
    for (const s of [-1, 1]) {
      g.fillStyle = earCol;
      const tw = s === 1 ? twitch * 1.6 : 0;
      g.beginPath(); g.moveTo(hx + s * 7.5, hy - 2); g.lineTo(hx + s * 6 + tw, hy - 12.5 + Math.abs(tw) * 0.5); g.lineTo(hx + s * 0.5, hy - 7); g.closePath(); g.fill();
      g.fillStyle = '#e8a0a8';
      g.beginPath(); g.moveTo(hx + s * 6, hy - 4); g.lineTo(hx + s * 5.4, hy - 10); g.lineTo(hx + s * 2.5, hy - 7); g.closePath(); g.fill();
    }

    for (const s of [-1, 1]) { g.fillStyle = c.fur; g.beginPath(); g.moveTo(hx + s * 7.6, hy + 1); g.lineTo(hx + s * 10.2, hy + 3.4); g.lineTo(hx + s * 7.2, hy + 4.4); g.closePath(); g.fill(); } // yanak tuyleri
    fur(g, hx, hy, 8.5, 8.5, 0, c.fur);
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
    } else if (c.pattern === 'spots') {
      ell(g, hx - D * 4.5, hy - 5.5, 3, 3.6, 0.4, c.fur2);
      dot(g, hx + D * 5, hy + 1, 1.6, c.fur2);
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
        const ig = g.createRadialGradient(ex, hy - 1.6, 0.2, ex, hy - 1, 2.6);
        ig.addColorStop(0, shadeC(c.eyes[i], 0.35)); ig.addColorStop(1, shadeC(c.eyes[i], -0.15));
        g.fillStyle = ig; g.beginPath(); g.ellipse(ex, hy - 1, 2.1, 2.5, 0, 0, Math.PI * 2); g.fill();
        dot(g, ex + 0.7, hy + 0.3, 0.35, 'rgba(255,255,255,0.7)');
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

  // ================= 3B kedi (karsilama ekrani) =================
  // Oturan kedi uzayda noktalarla tanimlanir; aci kadar dondurulup arkadan one dogru cizilir.
  // x saga, y asagi, z izleyiciye dogru. aci 0 = kedi bize bakar.
  function drawCat3D(g, c, ang, t, wear, hop = 0, paw = 0, mood = null) { // mood: { eyes: 'closed'|'happy', mouth: 0..1 }
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lift = -Math.sin(Math.min(1, hop) * Math.PI) * 7;
    const P3 = (x, y, z) => ({ x: x * ca + z * sa, y: y + lift, z: -x * sa + z * ca });
    const darkParts = c.pattern === 'points' || c.pattern === 'van';
    const sway = Math.sin(t * 2) * 1.5;
    const ops = [];
    const add = (z, fn) => ops.push({ z, fn });

    // yumusak zemin golgesi (hep en arkada)
    add(-99, () => {
      const sg = g.createRadialGradient(0, 20, 2, 0, 20, 16);
      sg.addColorStop(0, `rgba(0,0,0,${0.28 - Math.min(1, hop) * 0.1})`);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.beginPath(); g.ellipse(0, 20, 16, 4.5, 0, 0, Math.PI * 2); g.fill();
    });
    // kuyruk
    const tp = [P3(0, 16, -8), P3(9 + sway, 17, -6), P3(12 + sway, 6, -3)];
    add((tp[0].z + tp[2].z) / 2, () => {
      g.strokeStyle = darkParts ? c.fur2 : c.fur; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(tp[0].x, tp[0].y); g.quadraticCurveTo(tp[1].x, tp[1].y, tp[2].x, tp[2].y); g.stroke();
    });
    // pelerin: govdenin arkasinda dalgalanir
    if (wear && wear.neck === 'pelerin') {
      const n0 = P3(0, 0, -3), a = P3(-9, 17, -8 + sway), bb = P3(9, 17, -8 - sway);
      add(Math.min(n0.z, a.z, bb.z) - 0.5, () => {
        g.fillStyle = '#c95c6b';
        g.beginPath(); g.moveTo(n0.x - 5, n0.y); g.lineTo(n0.x + 5, n0.y);
        g.quadraticCurveTo(bb.x + 2, (n0.y + bb.y) / 2, bb.x, bb.y);
        g.quadraticCurveTo((a.x + bb.x) / 2, a.y + 3, a.x, a.y);
        g.quadraticCurveTo(a.x - 2, (n0.y + a.y) / 2, n0.x - 5, n0.y);
        g.fill();
      });
    }
    // arka kalcalar
    for (const s of [-1, 1]) {
      const h = P3(s * 7, 14, -3);
      add(h.z, () => ell(g, h.x, h.y, 4 + 2.5 * Math.abs(sa) + 2 * Math.abs(ca) * 0.5, 5.5, 0, c.fur));
    }
    // govde
    const b = P3(0, 8, -1);
    const bodyRx = Math.sqrt((9 * ca) ** 2 + (10.5 * sa) ** 2);
    add(b.z, () => {
      fur(g, b.x, b.y, bodyRx, 11 * (1 + Math.sin(t * 2.3) * 0.025), 0, c.fur);
      g.save();
      g.beginPath(); g.ellipse(b.x, b.y, bodyRx, 11, 0, 0, Math.PI * 2); g.clip();
      const bf = P3(0, 10, 8); // gogus/karin one bakar
      if (bf.z > 0) ell(g, bf.x, bf.y, 5.5 * Math.max(0.2, ca), 7, 0, c.belly);
      if (c.pattern === 'tabby') {
        g.strokeStyle = c.fur2; g.lineWidth = 1.8;
        for (const yy of [2, 6.5, 11]) { g.beginPath(); g.ellipse(b.x, b.y + yy - 6, bodyRx, 2.6, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
      } else if (c.pattern === 'spots') {
        for (const [sx, sy, sz, r] of [[-5, 4, 5, 3.2], [5, 9, 4, 2.6], [0, 13, 7, 2.2], [6, 5, -6, 3], [-4, 11, -7, 2.8]]) {
          const p = P3(sx, sy, sz);
          if (p.z > -4) ell(g, p.x, p.y, r * Math.max(0.4, Math.abs(ca * 0.6 + 0.4)), r * 0.85, 0, c.fur2);
        }
      } else if (c.pattern === 'tuxedo') {
        const bf2 = P3(0, 9, 8);
        if (bf2.z > -2) ell(g, bf2.x, bf2.y, 6.5 * Math.max(0.25, ca), 9, 0, c.belly);
      } else if (c.pattern === 'calico') {
        const p1 = P3(-5, 5, 5), p2 = P3(6, 11, -5);
        if (p1.z > -6) ell(g, p1.x, p1.y, 4.5, 4, 0, c.fur2);
        if (p2.z > -6) ell(g, p2.x, p2.y, 4, 3.5, 0, c.fur3);
      }
      g.restore();
    });
    // on bacaklar ve patiler
    for (const s of [-1, 1]) {
      const up = s === 1 ? Math.sin(Math.min(1, paw) * Math.PI) : 0; // oyuncaga pati atma
      const top = P3(s * 3.6, 9, 5.5), pp = P3(s * (3.6 + up * 3), 18.5 - up * 17, 7 + up * 5);
      const col = c.paws || (c.pattern === 'points' ? c.fur2 : c.fur);
      add(pp.z + up * 6, () => {
        g.strokeStyle = col; g.lineWidth = 4.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(top.x, top.y); g.lineTo(pp.x, pp.y); g.stroke();
        ell(g, pp.x, pp.y, 2.8, 2.2, 0, col);
      });
    }
    // boyundaki aksesuar (one bakiyorsa)
    const nk = P3(0, 1.5, 6);
    if (wear && wear.neck && nk.z > 0) {
      add(nk.z + 0.5, () => { g.save(); g.translate(nk.x, 0); g.scale(Math.max(0.3, ca), 1); drawNeckItem(g, wear.neck, 0, nk.y, 1, t); g.restore(); });
    }
    // bas
    const hd = P3(0, -6, 2);
    add(hd.z, () => {
      fur(g, hd.x, hd.y, 8.5, 8.5, 0, c.fur);
      g.save(); g.beginPath(); g.arc(hd.x, hd.y, 8.5, 0, Math.PI * 2); g.clip();
      if (c.pattern === 'van') { const a = P3(-4.5, -12, 4), bb = P3(4.5, -12, 4); dot(g, a.x, a.y, 4, c.fur2); dot(g, bb.x, bb.y, 4, c.fur2); }
      if (c.pattern === 'calico') { const a = P3(-4, -11, 5); dot(g, a.x, a.y, 4.5, c.fur2); }
      if (c.pattern === 'spots') { const a = P3(-4.5, -11, 5), b2 = P3(4, -3, 8); dot(g, a.x, a.y, 3.4, c.fur2); if (b2.z > 0) dot(g, b2.x, b2.y, 1.5, c.fur2); }
      if (c.pattern === 'tabby') {
        g.strokeStyle = c.fur2; g.lineWidth = 1.4;
        for (const ox of [-2.5, 0, 2.5]) {
          const p1 = P3(ox, -14, 4.5), p2 = P3(ox * 0.8, -11, 7.5);
          g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
        }
      }
      if (c.pattern === 'points') { const m = P3(0, -3.5, 8); if (m.z > 0) ell(g, m.x, m.y, 5.5 * Math.max(0.3, ca), 4.8, 0, c.fur2); }
      g.restore();
    });
    // kulaklar (3B ucgenler: yandan bakinca incelir)
    for (const s of [-1, 1]) {
      const tw3 = s === 1 && (t % 5.3) < 0.18 ? Math.sin(((t % 5.3) / 0.18) * Math.PI) * 1.8 : 0;
      const o = P3(s * 7.6, -9, 1.5), tip = P3(s * 6.2 + tw3, -17.5 + Math.abs(tw3) * 0.5, 1.5 - tw3), inn = P3(s * 1.4, -13, 1.5);
      const io = P3(s * 6.2, -10.5, 1.8), it = P3(s * 5.6, -15.5, 1.8), ii = P3(s * 2.8, -12.8, 1.8);
      add(o.z + 0.2, () => {
        tri(g, [o.x, o.y], [tip.x, tip.y], [inn.x, inn.y], darkParts ? c.fur2 : c.fur);
        if (ca > 0.15) { g.globalAlpha = Math.min(1, ca * 1.5); tri(g, [io.x, io.y], [it.x, it.y], [ii.x, ii.y], '#e8a0a8'); g.globalAlpha = 1; }
      });
    }
    // yuz: her ozellik kendi yuzey yonune gore gorunur (yandan bakinca tek goz ve burun kalir)
    const fc = P3(0, -5, 10.5);
    const vis = (p) => Math.max(0, Math.min(1, (p.z - hd.z) / 6)); // basin bize donuk yuzu
    // burun cikintisi: yandan bakinca profili verir
    const sn = P3(0, -3.4, 8.6);
    add(hd.z + (sn.z - hd.z) * 0.2 + 0.05, () => {
      const side = Math.abs(sa);
      ell(g, sn.x, sn.y, 3.6, 3, 0, c.pattern === 'points' ? c.fur2 : c.fur);
      if (side > 0.35 && c.pattern !== 'points') ell(g, sn.x, sn.y + 0.6, 2.6, 2, 0, c.belly);
      const n = P3(0, -4.6, 10.6);
      if (n.z > hd.z - 2) dot(g, n.x, n.y, 1.25, '#e48a9a');
    });
    add(hd.z + 1, () => {
      const f = vis(fc);
      if (f > 0.05) {
        g.globalAlpha = f;
        const mu = P3(0, -2.8, 9.6);
        if (c.pattern !== 'points') ell(g, mu.x, mu.y, 3.6 * Math.max(0.3, ca), 2.6, 0, c.belly);
        const n = P3(0, -4.4, 10.4);
        tri(g, [n.x - 1.3 * Math.max(0.3, ca), n.y], [n.x + 1.3 * Math.max(0.3, ca), n.y], [n.x, n.y + 1.4], '#e48a9a');
        if (mood && mood.mouth > 0.05) { // agiz acik (yemek yerken / miyavlarken)
          const m = P3(0, -1.9, 10.2), o = mood.mouth;
          ell(g, m.x, m.y, 1.7 * Math.max(0.4, ca), 1.5 * o + 0.2, 0, '#6b2f3c');
          ell(g, m.x, m.y + 0.8 * o, 1.1 * Math.max(0.4, ca), 0.6 * o, 0, '#e9879b');
        }
        g.globalAlpha = 1;
      }
      const eyeMode = mood && mood.eyes;
      const blink = !eyeMode && t % 4.3 < 0.12;
      [[-3.2, 0], [3.2, 1]].forEach(([ex, i]) => {
        const e = P3(ex, -7, 9.4), ev = vis(e);
        if (ev < 0.08) return;
        const w = Math.max(0.35, ev);
        g.globalAlpha = Math.min(1, ev * 1.5);
        if (eyeMode) { // uyku: asagi kavis, mutlu: yukari kavis (^ ^)
          g.strokeStyle = '#2a2328'; g.lineWidth = 1.1; g.lineCap = 'round';
          g.beginPath();
          if (eyeMode === 'closed') g.arc(e.x, e.y - 0.8, 1.9 * w, 0.15 * Math.PI, 0.85 * Math.PI);
          else g.arc(e.x, e.y + 1, 1.9 * w, 1.15 * Math.PI, 1.85 * Math.PI);
          g.stroke();
        } else if (blink) { g.strokeStyle = '#2a2328'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(e.x - 1.8 * w, e.y); g.lineTo(e.x + 1.8 * w, e.y); g.stroke(); }
        else {
          const es = mood && mood.big ? 1.3 : 1; // yakin planda iri, sevimli gozler
          ell(g, e.x, e.y, 2.1 * w * es, 2.5 * es, 0, c.eyes[i]);
          ell(g, e.x + sa * 0.6, e.y, 0.8 * w * es * (mood && mood.wide ? 1.5 : 1), 2 * es, 0, '#1d1a1f');
          dot(g, e.x - 0.6 * w * es, e.y - 1 * es, 0.55 * es, 'rgba(255,255,255,0.9)');
          if (es > 1) dot(g, e.x + 0.7 * w, e.y + 0.9, 0.3, 'rgba(255,255,255,0.75)');
        }
        g.globalAlpha = 1;
      });
      g.strokeStyle = c.rim || c.pattern === 'points' ? 'rgba(255,255,255,0.5)' : 'rgba(70,55,50,0.45)';
      g.lineWidth = 0.8;
      for (const s of [-1, 1]) {
        const a = P3(s * 2.5, -3, 10), b1 = P3(s * 10, -4.5, 7), b2 = P3(s * 10, -1, 7);
        const wv = vis(a);
        if (wv < 0.1) continue;
        g.globalAlpha = wv;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b1.x, b1.y); g.moveTo(a.x, a.y + 1); g.lineTo(b2.x, b2.y); g.stroke();
      }
      g.globalAlpha = 1;
      if (wear && wear.face && ca > 0.3) {
        g.save(); g.translate(fc.x, 0); g.scale(ca, 1); drawHeadItem(g, wear.face, 0, hd.y, 1, 0); g.restore();
      }
    });
    // sapka hep en ustte
    if (wear && wear.hat) add(99, () => drawHeadItem(g, wear.hat, hd.x, hd.y, ca >= 0 ? 1 : -1, hd.x));

    ops.sort((a, b2) => a.z - b2.z);
    for (const o of ops) o.fn();
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
    // ay/gunes: yumusak isik halesi
    const mx = W * 0.66, my = H * 0.16;
    const halo = ctx.createRadialGradient(mx, my, 14, mx, my, 70);
    halo.addColorStop(0, `rgba(${P.moonA},0.35)`);
    halo.addColorStop(1, `rgba(${P.moonA},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 70, my - 70, 140, 140);
    ctx.globalAlpha = 0.92; dot(ctx, mx, my, 20, P.moon);
    ctx.globalAlpha = 0.18; dot(ctx, mx - 6, my - 5, 6, '#ffffff');
    ctx.globalAlpha = 1;

    drawSeason(); // sezon etkinligi: dusen yapraklar / kar
    // kabarik, yumusak bulutlar
    if (P.cloud > 0.01) {
      for (const c of CLOUDS) {
        const y = ((c.y + bgOff * 0.06) % (H + 160)) - 80;
        ctx.fillStyle = `rgba(255,255,255,${(P.cloud * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(c.x, y + 2, c.w * 1.25, c.h * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${P.cloud.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(c.x, y + 3, c.w, c.h * 0.8, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x - c.w * 0.35, y - 2, c.w * 0.45, c.h * 0.9, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + c.w * 0.25, y - 5, c.w * 0.5, c.h * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const sy = H * 0.82 + bgOff * 0.12;
    if (sy < H + 5 && save.theme === 'istanbul') drawIstanbul(sy);
    else if (sy < H + 5) {
      ctx.fillStyle = P.city;
      for (const b of SKYLINE) ctx.fillRect(b.x, sy - b.h, b.w, b.h + H);
      if (save.theme === 'kis') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const b of SKYLINE) rr(ctx, b.x - 1, sy - b.h - 2, b.w + 2, 5, 2.5), ctx.fill(); }
      ctx.fillStyle = `rgba(${P.winA},0.45)`;
      for (const b of SKYLINE) for (const [lx, ly] of b.lights) ctx.fillRect(b.x + lx, sy - b.h + ly, 3, 4);
    }
  }

  function archWin(g, x, y, w, h) { // ust kismi kemerli pencere (Istanbul temasi)
    const r = w / 2;
    g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
  }
  function drawWalls() {
    const ist = save.theme === 'istanbul', kis = save.theme === 'kis';
    const win = ist ? (g, x, y, w, h) => archWin(g, x, y, w, h) : (g, x, y, w, h, r) => rr(g, x, y, w, h, r);
    const step = 170;
    for (const side of [0, 1]) {
      const x = side === 0 ? 0 : W - WALL;
      ctx.fillStyle = P.wall;
      ctx.fillRect(x, -20, WALL, H + 40);
      const off = side ? 60 : 0;
      const k0 = Math.ceil((-50 - bgOff - off) / step), k1 = Math.floor((H - bgOff - off) / step);
      const wx = side === 0 ? 5 : W - WALL + 7;
      const night = P.stars > 0.2;
      const FLOWERS = ['#f28fa8', '#f6c35b', '#b99be8', '#ffffff'];
      for (let k = k0; k <= k1; k++) {
        const y = k * step + bgOff + off;
        const hsh = (((k * 7 + side * 3) % 5) + 5) % 5;
        const lit = night && hsh < 3;
        if (lit) { // gece yanan pencereden yumusak isik
          const gl = ctx.createRadialGradient(wx + 8, y + 15, 2, wx + 8, y + 15, 30);
          gl.addColorStop(0, `rgba(${P.winA},0.22)`);
          gl.addColorStop(1, `rgba(${P.winA},0)`);
          ctx.fillStyle = gl;
          ctx.fillRect(wx - 24, y - 16, 64, 62);
        }
        ctx.fillStyle = P.mark;
        win(ctx, wx - 2, y - 2, WALL - 8, 34, 5); ctx.fill();
        if (night) {
          ctx.fillStyle = lit ? `rgba(${P.winA},0.65)` : shadeA(P.wallA, -0.25);
          win(ctx, wx, y, WALL - 12, 30, 4); ctx.fill();
        } else { // gunduz: gokyuzunu yansitan cam
          const gg = ctx.createLinearGradient(0, y, 0, y + 30);
          gg.addColorStop(0, P.win); gg.addColorStop(1, shadeA(P.winA, -0.18));
          ctx.fillStyle = gg; win(ctx, wx, y, WALL - 12, 30, 4); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath(); ctx.moveTo(wx + 3, y + 22); ctx.lineTo(wx + 9, y + 4); ctx.lineTo(wx + 12, y + 4); ctx.lineTo(wx + 6, y + 22); ctx.closePath(); ctx.fill();
        }
        if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, wx + 2, y + 2, 5, 26, 2.5); ctx.fill(); }
        ctx.fillStyle = P.edge;
        rr(ctx, wx - 3, y + 31, WALL - 6, 3.5, 1.75); ctx.fill();
        if (ist) { // mavi cini seridi
          const ty = y + 58;
          ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(x + 1, ty, WALL - 2, 9);
          for (let i = 0; i < 3; i++) { const cx = x + 4 + i * ((WALL - 8) / 2); dot(ctx, cx, ty + 4.5, 2.6, '#4f7fbf'); dot(ctx, cx, ty + 4.5, 1, '#d9534f'); }
        }
        if (kis) { ctx.fillStyle = 'rgba(235,245,255,0.9)'; for (let i = 0; i < 4; i++) { const ix = wx - 1 + i * ((WALL - 8) / 3); ctx.beginPath(); ctx.moveTo(ix - 1.5, y + 34.5); ctx.lineTo(ix, y + 39 + (i % 2) * 3); ctx.lineTo(ix + 1.5, y + 34.5); ctx.closePath(); ctx.fill(); } }
        if (save.theme === 'kis') { ctx.fillStyle = 'rgba(255,255,255,0.92)'; rr(ctx, wx - 4, y + 28.5, WALL - 4, 4, 2); ctx.fill(); rr(ctx, wx - 3, y - 4, WALL - 6, 3, 1.5); ctx.fill(); }
        if (hsh === 1 || hsh === 4 || (save.theme === 'ilkbahar' && hsh === 2)) { // pencere onunde cicek saksisi (susleme, tehlikeli degil)
          ctx.fillStyle = '#c8724f'; rr(ctx, wx - 2, y + 34, WALL - 8, 6, 2); ctx.fill();
          for (let i = 0; i < 3; i++) {
            const fx = wx + 2 + i * 6, fy = y + 31 - (i % 2) * 2;
            dot(ctx, fx, fy + 3, 1.6, '#7fb27a');
            dot(ctx, fx, fy, 2.4, FLOWERS[(k + i + side) & 3]);
            dot(ctx, fx, fy, 0.9, '#fff3b0');
          }
        }
      }
      // duvarin ic kenarinda yumusak golge gecisi
      const ex = side === 0 ? WALL : W - WALL;
      const sh = ctx.createLinearGradient(ex, 0, ex + (side === 0 ? 10 : -10), 0);
      sh.addColorStop(0, 'rgba(0,0,0,0.16)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(side === 0 ? ex : ex - 10, -20, 10, H + 40);
      ctx.fillStyle = P.edge;
      ctx.fillRect(side === 0 ? WALL - 2 : W - WALL, -20, 2, H + 40);
    }
  }

  // Elektrik supurgesi hortumu: kedilerin en sevmedigi sey. Duvara kelepceli, halkali hortum ve emici baslik.
  function drawVacuum(o) {
    const left = o.side === 0, base = left ? WALL : W - WALL, s = left ? 1 : -1;
    const hx = left ? base + 2 : base - 16, hw = 14, y0 = o.y + 4, y1 = o.y + o.h - 14;
    const g = ctx.createLinearGradient(hx, 0, hx + hw, 0);
    g.addColorStop(0, shadeA(P.hoseA, -0.18)); g.addColorStop(0.45, shadeA(P.hoseA, 0.18)); g.addColorStop(1, shadeA(P.hoseA, -0.25));
    ctx.fillStyle = g;
    rr(ctx, hx, y0, hw, y1 - y0, 6); ctx.fill();
    ctx.fillStyle = 'rgba(60,20,30,0.16)'; // yumusak halkalar
    for (let y = y0 + 6; y < y1 - 4; y += 9) rr(ctx, hx, y, hw, 2.6, 1.3), ctx.fill();
    // kelepceler
    ctx.fillStyle = '#c9ccd6';
    for (let y = y0 + 10; y < y1 - 6; y += 46) { rr(ctx, left ? base - 2 : base - 18, y, 20, 4, 2); ctx.fill(); }
    // emici baslik (altta), icine cekilen toz zerreleri
    ctx.fillStyle = '#6f7686';
    rr(ctx, left ? base : base - SPIKE, y1 - 2, SPIKE, 14, 4); ctx.fill();
    ctx.fillStyle = '#4f5563';
    rr(ctx, left ? base + 2 : base - SPIKE + 2, y1 + 8, SPIKE - 4, 3, 1.5); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const ph = (clock * 1.6 + i / 3) % 1;
      dot(ctx, base + s * (SPIKE + 10 - ph * 10), y1 + 14 + (1 - ph) * 6 * (i - 1), 1.3, `rgba(120,110,100,${(0.5 * (1 - ph)).toFixed(2)})`);
    }
  }

  // Islak oluk borusu: eklem yerlerinden su damlar; kediler islanmayi sevmez.
  function drawPipe(o) {
    const left = o.side === 0, base = left ? WALL : W - WALL;
    const px = left ? base + 1 : base - 13, pw = 12, y0 = o.y, y1 = o.y + o.h;
    // islak leke
    ctx.fillStyle = 'rgba(90,120,160,0.12)';
    rr(ctx, left ? base - 4 : base - 18, y0 + 6, 22, o.h - 6, 8); ctx.fill();
    const g = ctx.createLinearGradient(px, 0, px + pw, 0);
    g.addColorStop(0, shadeA(P.pipeA, -0.2)); g.addColorStop(0.4, shadeA(P.pipeA, 0.28)); g.addColorStop(1, shadeA(P.pipeA, -0.25));
    ctx.fillStyle = g;
    rr(ctx, px, y0, pw, o.h, 4); ctx.fill();
    // eklemler ve damlalar
    for (let y = y0 + 12, i = 0; y < y1 - 6; y += 34, i++) {
      ctx.fillStyle = shadeA(P.pipeA, -0.3);
      rr(ctx, px - 2, y, pw + 4, 6, 2.5); ctx.fill();
      const ph = ((clock * 0.9 + i * 0.37) % 1);
      const dx = left ? px + pw + 3 : px - 3;
      ell(ctx, dx, y + 7 + ph * 18, 1.8, 2.6, 0, `rgba(120,170,220,${(0.85 * (1 - ph)).toFixed(2)})`);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px + 3, y0 + 3, 1.6, o.h - 6);
  }
  // "r,g,b" bicimindeki palet rengini acar (amt > 0) ya da koyulastirir (amt < 0)
  function shadeA(rgb, amt) {
    const [r, g, b] = rgb.split(',').map(Number);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
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
    // duvara dusen yumusak golge
    if (!p.jumping) ell(ctx, p.side === 0 ? WALL + 6 : W - WALL - 6, p.y + 6, 7, 18, 0, 'rgba(0,0,0,0.14)');
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
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWeather() {
    const seeDark = catIs('kara') ? 0 : 1;
    if (weather === 'rain' && !isMenuState()) {
      ctx.strokeStyle = P.stars > 0.2 ? 'rgba(200,215,235,0.22)' : 'rgba(70,95,135,0.3)'; // aydinlik gokte koyu damla
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

  const FONT = 'ui-rounded, "SF Pro Rounded", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
  // Gunduz (aydinlik gok) acik renkli yazilar koyu murekkebe doner, golge beyaz olur: her zaman okunakli
  const isLightColor = (c) => /^#/.test(c) && (() => { const n = parseInt(c.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170; })();
  function hudText(text, x, y, font, color, align = 'center') {
    ctx.font = font.replace('system-ui, sans-serif', FONT);
    ctx.textAlign = align;
    const day = P && P.stars < 0.2 && !isMenuState();
    if (day && isLightColor(color)) color = '#4a3f63';
    ctx.fillStyle = day ? 'rgba(255,255,255,0.65)' : 'rgba(15,18,28,0.4)';
    ctx.fillText(text, x + 1, y + 1.5);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  function wrapText(text, x, y, maxW, lh, font, color) {
    ctx.font = font.replace('system-ui, sans-serif', FONT);
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
        const bw = 104, bx = (W - bw) / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        rr(ctx, bx, top + 58, bw, 6, 3); ctx.fill();
        ctx.fillStyle = COIN;
        rr(ctx, bx, top + 58, Math.max(6, bw * progress()), 6, 3); ctx.fill();
      }
    } else {
      hudText(String(score()), W / 2, top + 52, '800 34px system-ui, sans-serif', '#f2efe9');
      // sonraki kata ilerleme cubugu
      const into = ((dist / METER) % STAGE_M) / STAGE_M;
      const bw = 104, bx = (W - bw) / 2;
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, bx, top + 62, bw, 5, 2.5); ctx.fill();
      ctx.fillStyle = COIN; rr(ctx, bx, top + 62, Math.max(5, bw * into), 5, 2.5); ctx.fill();
      hudText(`${stage + 1}. Kat · puan x${stageMult()}`, W / 2, top + 82, '700 12px system-ui, sans-serif', '#e3dccf');
    }
    if (comboMult() > 1) hudText(`Kıl payı x${comboMult()}`, W / 2, top + 100, '700 14px system-ui, sans-serif', '#f6dcae');

    const lx = WALL + 10;
    // gostergelerin arkasina yumusak zemin (okunaklilik icin)
    ctx.fillStyle = P.stars < 0.2 ? 'rgba(255,255,255,0.5)' : 'rgba(18,22,36,0.26)';
    rr(ctx, lx - 6, top + 12, 96, hungerOn() ? 66 : 50, 14); ctx.fill();
    rr(ctx, W - WALL - 22 - (energyMax - 1) * 15, top + 62, energyMax * 15 + 12, 26, 13); ctx.fill();
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
      ctx.fillRect(W - WALL - 14 - (energyMax - 1) * 15 - 6, top + 83, (energyMax * 15 - 3) * (energyT / energyTime()), 2);
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
      else if (o.skin === 'pipe') drawPipe(o);
      else drawVacuum(o);
    }
    drawItems();
    drawDog();
    drawPlayer();
    drawCrows();
    drawParticles();
    drawWeather();
    drawHud();
  }

  // ================= Karsilama: 360 derece dondurulebilen kedi ve oyuncakla oyun =================
  const hero = { ang: -0.5, vel: 0.35, drag: false, lastX: 0, lastT: 0, downX: 0, hop: 0, msgT: 0, greeted: false };
  const HERO_MSGS = ['Miyav!', 'Hadi tırmanalım!', 'Balık var mı?', 'Prrr prrr...', 'Beni çevirsene!', 'Bugün rekor kırarız!', 'Karabaş uyuyor mu?', 'Süpürgeden korkarım ama!', 'Oltayı salla!'];
  // Oyuncak modu: yukaridan sarkitilan oyuncagi parmakla gezdirirsin, kedi pati atip yakalamaya calisir
  const toy = { on: false, x: 0, y: -26, tx: 0, ty: -26, paw: 0, cool: 0, hearts: [], heldT: 0 };
  const PLAY_DAILY_FISH = 20; // gunde oyundan en fazla bu kadar balik
  function heroSay(text) {
    $('heroBubble').textContent = text;
    $('heroBubble').classList.add('on');
    hero.msgT = 3;
  }
  function playState() {
    const k = todayKey();
    if (save.play.date !== k) save.play = { date: k, catches: 0, rewarded: 0 };
    return save.play;
  }
  function setToyMode(on) {
    toy.on = on;
    if (on) {
      hero.ang = Math.atan2(Math.sin(hero.ang), Math.cos(hero.ang)); // -pi..pi araligina getir
      toy.x = toy.tx = 0; toy.y = toy.ty = -26;
      heroSay(TOY_BY_ID[save.toys.sel].name + ' ile oynayalım!');
      sfx('meowHappy');
    }
    $('toyBtn').textContent = on ? 'Oyunu bitir' : '🎣 Oyuncakla oyna';
    $('toyChips').classList.toggle('hidden', !on);
    $('heroHint').textContent = on ? 'Oyuncağı parmağınla gezdir, kedin yakalamaya çalışsın' : 'Kedini parmağınla çevir · dokununca miyavlar';
    renderToyChips();
  }
  function renderToyChips() {
    const ts = save.toys;
    $('toyChips').innerHTML = ts.owned.map((id) => `<button class="chip${ts.sel === id ? ' on' : ''}" data-toysel="${id}">${TOY_BY_ID[id].name}</button>`).join('') +
      (ts.owned.length < TOYS.length ? '<button class="chip more" data-tab="shop">+ Yeni oyuncak</button>' : '');
  }
  function heroUnits(e) { // ekran koordinatini kedi birimine cevir
    const cv = $('heroCat'), r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 230, height: 230 };
    const k = r.width / 58;
    return { x: (e.clientX - r.left - r.width / 2) / k, y: (e.clientY - r.top - r.height * 0.55) / k };
  }
  function updateHero(dt) {
    if (state !== 'menu') return;
    hero.hop = Math.max(0, hero.hop - dt * 1.8);
    if (hero.msgT > 0) { hero.msgT -= dt; if (hero.msgT <= 0) $('heroBubble').classList.remove('on'); }
    if (!toy.on) {
      if (!hero.drag) {
        hero.ang += hero.vel * dt;
        hero.vel += (0.35 - hero.vel) * Math.min(1, dt * 0.9); // yavasca kendi kendine donmeye doner
      }
      return;
    }
    // oyuncak hareketi: lazer aninda gider, digerleri ip ucunda yumusakca sallanir
    const fast = save.toys.sel === 'lazer' ? 1 : Math.min(1, dt * 9);
    toy.x += (toy.tx - toy.x) * fast;
    toy.y += (toy.ty - toy.y) * fast;
    toy.x = Math.max(-27, Math.min(27, toy.x));
    toy.y = Math.max(-30, Math.min(20, toy.y));
    // kedi oyuncaga doner
    const want = Math.max(-0.95, Math.min(0.95, toy.x / 26));
    hero.ang += (want - hero.ang) * Math.min(1, dt * 5);
    toy.paw = Math.max(0, toy.paw - dt * 2.4);
    toy.cool -= dt;
    const d = Math.hypot(toy.x - 2, toy.y + 3);
    if (d < 17 && toy.cool <= 0) {
      toy.paw = 1; toy.cool = 0.75;
      if (toy.y < -16 && Math.random() < 0.5) hero.hop = 1;
      if (d < 11 || Math.random() < 0.25) { // yakaladi!
        const ps = playState();
        ps.catches++;
        save.life.catches++; persist('life'); if (save.life.catches % 10 === 0) checkAchievements();
        for (let i = 0; i < 5; i++) toy.hearts.push({ x: toy.x + rand(-3, 3), y: toy.y, vy: rand(-14, -8), t: 1.2 });
        toySound('catch');
        sfx(Math.random() < 0.5 ? 'purr' : 'meowHappy');
        let msg = pickOne(['Yakaladım!', 'Hap!', 'Benim bu!', 'Bir daha!']);
        if (ps.catches % 5 === 0 && ps.rewarded < PLAY_DAILY_FISH) { ps.rewarded++; save.wallet++; persist('wallet'); msg += ' 🐟 +1'; $('wallet').textContent = save.wallet; }
        persist('play');
        heroSay(msg);
        toy.tx = rand(-24, 24); toy.ty = -28; toy.y = -18; // oyuncak kacar
      }
    }
    for (const h of toy.hearts) { h.y += h.vy * dt; h.t -= dt; }
    toy.hearts = toy.hearts.filter((h) => h.t > 0);
  }
  function drawToy(g, id, x, y, t) {
    g.save();
    g.translate(x, y);
    if (id === 'tuy') {
      g.rotate(Math.sin(t * 3) * 0.3);
      ell(g, -1.5, 2, 1.6, 4.5, 0.4, '#7fd1c8');
      ell(g, 1.5, 2.5, 1.6, 4.5, -0.4, '#f28fa8');
      ell(g, 0, 3, 1.3, 4, 0, '#f6c35b');
      g.strokeStyle = '#8a7a6a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, -1); g.lineTo(0, 7); g.stroke();
    } else if (id === 'fare') {
      g.strokeStyle = '#c9a6a6'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-4, 1); g.quadraticCurveTo(-8, 3 + Math.sin(t * 6), -9, -1); g.stroke();
      ell(g, 0, 1, 4.6, 3, 0, '#a7a3ad');
      dot(g, 2, -1.8, 1.6, '#bdb9c4'); dot(g, 2, -1.8, 0.8, '#f2b8c6');
      dot(g, 4.4, 1, 0.8, '#f28fa8'); dot(g, 2.8, 0.2, 0.5, '#2a2328');
    } else if (id === 'yumak') {
      dot(g, 0, 1, 4.2, '#e46b6b');
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 0.6;
      for (const a of [0.3, 1.2, 2.1]) { g.beginPath(); g.ellipse(0, 1, 4, 1.6, a, 0, Math.PI * 2); g.stroke(); }
      g.strokeStyle = '#e46b6b'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(3.5, 3); g.quadraticCurveTo(6, 6, 4, 8); g.stroke();
    } else if (id === 'balik') {
      drawFish(g, 0, 1, 0.8, false);
    } else if (id === 'kelebek') {
      const f = 0.35 + Math.abs(Math.sin(t * 9)) * 0.65;
      for (const s of [-1, 1]) { ell(g, s * 3 * f, -0.5, 3 * f, 2.6, s * 0.4, '#b99be8'); ell(g, s * 2.4 * f, 2.6, 2 * f, 1.8, -s * 0.4, '#f6c35b'); }
      ell(g, 0, 1, 0.7, 3, 0, '#4a3f5a');
    } else if (id === 'lazer') {
      const gl = g.createRadialGradient(0, 0, 0.2, 0, 0, 4);
      gl.addColorStop(0, 'rgba(255,60,60,0.95)'); gl.addColorStop(0.35, 'rgba(255,60,60,0.45)'); gl.addColorStop(1, 'rgba(255,60,60,0)');
      g.fillStyle = gl; g.fillRect(-4, -4, 8, 8);
    }
    g.restore();
  }
  function drawHero() {
    if (state !== 'menu') return;
    const cv = $('heroCat');
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const k = cv.width / 58;
    g.setTransform(k, 0, 0, k, cv.width / 2, cv.height * 0.55);
    drawCat3D(g, CAT_BY_ID[save.char], hero.ang, clock, outfit(), hero.hop, toy.on ? toy.paw : 0);
    if (!toy.on) return;
    const id = save.toys.sel, topY = -(cv.height * 0.55) / k;
    const sx = toy.x + Math.sin(clock * 2.2) * 0.8, sy = toy.y;
    if (id === 'kelebek') { // cubuga bagli kelebek
      g.strokeStyle = '#8a6a4a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(sx * 0.4 + 18, topY); g.lineTo(sx, sy); g.stroke();
    } else if (id !== 'lazer') { // olta ipi
      g.strokeStyle = 'rgba(70,60,80,0.55)'; g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(sx * 0.6, topY); g.quadraticCurveTo(sx * 0.8, (topY + sy) / 2 + 2, sx, sy - 1); g.stroke();
    }
    drawToy(g, id, sx, sy, clock);
    for (const h of toy.hearts) { g.globalAlpha = Math.min(1, h.t); drawHeart(g, h.x, h.y, 4, '#f28fa8'); }
    g.globalAlpha = 1;
  }
  (() => {
    const cv = $('heroCat');
    cv.addEventListener('pointerdown', (e) => {
      if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch { /* yoksay */ }
      if (toy.on) { const u = heroUnits(e); toy.tx = u.x; toy.ty = u.y; hero.drag = true; return; }
      hero.drag = true; hero.lastX = hero.downX = e.clientX; hero.lastT = e.timeStamp; hero.vel = 0;
      if (!hero.purred || e.timeStamp - hero.purred > 4000) { hero.purred = e.timeStamp; setTimeout(() => { if (hero.drag) sfx('purr'); }, 250); } // cevirirken mirlar
    });
    cv.addEventListener('pointermove', (e) => {
      if (!hero.drag) return;
      if (toy.on) { const u = heroUnits(e); if (Math.hypot(u.x - toy.tx, u.y - toy.ty) > 1.5) toySound('move'); toy.tx = u.x; toy.ty = u.y; return; }
      const dx = e.clientX - hero.lastX, dtm = Math.max(1, e.timeStamp - hero.lastT) / 1000;
      hero.ang += dx * 0.016;
      hero.vel = Math.max(-9, Math.min(9, (dx * 0.016) / dtm));
      hero.lastX = e.clientX; hero.lastT = e.timeStamp;
    });
    const up = (e) => {
      if (!hero.drag) return;
      hero.drag = false;
      if (toy.on) return;
      if (Math.abs(e.clientX - hero.downX) < 6) { // dokunus: miyavla ve zipla
        hero.hop = 1;
        hero.vel = 0.35;
        sfx(['meow', 'meowShort', 'meowHappy'][Math.floor(Math.random() * 3)]);
        heroSay(HERO_MSGS[Math.floor(Math.random() * HERO_MSGS.length)]);
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  })();


  // ================= Bildirim, gunluk odul, basarimlar, etkinlik =================
  let noteTimer = null;
  function showNote(title, sub = '') {
    const n = $('note');
    $('noteTitle').textContent = title;
    $('noteSub').textContent = sub;
    n.classList.add('on');
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => n.classList.remove('on'), 2800);
  }
  function dayKeyOffset(off) {
    const d = new Date(Date.now() + off * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const loginDue = () => save.login.last !== todayKey();
  const nextStreak = () => (save.login.last === dayKeyOffset(-1) ? save.login.streak + 1 : 1);
  function renderLogin() {
    const due = loginDue();
    $('loginCard').classList.toggle('hidden', !due);
    if (!due) return;
    const s = nextStreak(), idx = (s - 1) % 7;
    $('loginTitle').textContent = `Günlük ödül · ${s}. gün`;
    $('loginDays').innerHTML = LOGIN_REWARDS.map((r, i) =>
      `<span class="${i < idx ? 'got' : i === idx ? 'now' : ''}"><b>${i + 1}</b>${i === 6 ? '👑' : '🐟'}${r}</span>`).join('');
  }
  function claimLogin() {
    if (!loginDue()) return;
    const s = nextStreak(), idx = (s - 1) % 7, fish = LOGIN_REWARDS[idx];
    save.login = { last: todayKey(), streak: s };
    save.wallet += fish;
    let extra = '';
    if (idx === 6 && !save.wardrobe.owned.includes('yildiz')) { save.wardrobe.owned.push('yildiz'); persist('wardrobe'); extra = ' ve Yıldızlı Taç'; }
    persist('login'); persist('wallet');
    sfx('win');
    showNote(`${s}. gün ödülü`, `+${fish} balık${extra}`);
    checkAchievements();
    renderMenu();
  }
  function recordLife() {
    const L = save.life;
    L.runs++; L.near += stats.near; L.dogs += stats.dogs; L.fish += stats.fish;
    L.maxM = Math.max(L.maxM, meters());
    persist('life');
    if (stats.fish > 0 && petHappy()) { // bakimli, mutlu kedi: %10 fazla balik
      const bonus = Math.ceil(stats.fish * 0.1);
      save.wallet += bonus; persist('wallet');
      showNote('Mutlu kedi bonusu 😺', `+${bonus} balık`);
    }
  }
  function checkAchievements() {
    let got = false;
    for (const a of ACHS) {
      if (save.ach.includes(a.id) || !a.test(save.life)) continue;
      save.ach.push(a.id);
      save.wallet += a.reward;
      if (a.item && !save.wardrobe.owned.includes(a.item)) { save.wardrobe.owned.push(a.item); persist('wardrobe'); }
      showNote(`Başarım: ${a.name}`, `+${a.reward} balık${a.item ? ' ve ' + COS_BY_ID[a.item].name : ''}`);
      got = true;
    }
    if (got) { persist('ach'); persist('wallet'); }
  }
  function eventProgress(m) { // sonsuz kosu bitince etkinlik ilerlemesi
    const ev = currentEvent();
    if (!ev || !run || run.mode !== 'endless') return;
    const e = save.events[ev.id] || (save.events[ev.id] = { best: 0, done: false });
    e.best = Math.max(e.best, m);
    if (!e.done && m >= ev.goal) {
      e.done = true;
      if (!save.wardrobe.owned.includes(ev.item)) { save.wardrobe.owned.push(ev.item); persist('wardrobe'); }
      showNote(`${ev.name} tamam!`, `${COS_BY_ID[ev.item].name} kazandın`);
    }
    persist('events');
  }
  function renderEvent() {
    const ev = currentEvent();
    $('eventCard').classList.toggle('hidden', !ev);
    if (!ev) return;
    const e = save.events[ev.id] || { best: 0, done: false };
    $('eventName').textContent = (ev.fx === 'snow' ? '❄️ ' : '🍂 ') + ev.name;
    $('eventText').textContent = e.done ? `Tamamlandı! ${COS_BY_ID[ev.item].name} gardırobunda.` : `${ev.text} · en iyi ${e.best} m`;
    $('eventBar').style.width = Math.min(100, Math.round((e.best / ev.goal) * 100)) + '%';
  }
  function renderAch() {
    const L = save.life;
    $('achCount').textContent = `${save.ach.length}/${ACHS.length}`;
    $('achList').innerHTML = ACHS.map((a) => {
      const done = save.ach.includes(a.id);
      return `<div class="ms ach${done ? ' done' : ''}"><b>${done ? '🏅' : '🔒'} ${a.name}</b><small>${a.text}</small><em>🐟 ${a.reward}${a.item ? ' + ' + COS_BY_ID[a.item].name : ''}</em></div>`;
    }).join('') + `<p class="hint small">Toplam: ${L.runs} tur · ${L.fish} balık · ${L.near} kıl payı · ${L.dogs} köpek atlatma · en uzak ${L.maxM} m</p>`;
  }

  // ================= Sezon suslemesi: dusen yapraklar / kar =================
  const EVFX = Array.from({ length: 22 }, () => ({ x: rand(0, W), y: rand(0, 900), s: rand(0.7, 1.3), ph: rand(0, 6.28), c: Math.floor(rand(0, 3)) }));
  function drawSeason() {
    const ev = currentEvent();
    const fx = theme().fx || (ev && ev.fx);
    if (!fx) return;
    const LEAF = ['#e8915a', '#d9663f', '#e9b44c'], PETAL = ['#f6b8c8', '#fbd3dd', '#ffffff'], WING = ['#f6c35b', '#9cc3e6', '#f2a6b8'];
    if (fx === 'gulls' || fx === 'bfly') { // yavas suzulen martilar / kelebekler (az sayida, sakin)
      for (let i = 0; i < 5; i++) {
        const p = EVFX[i];
        const x = ((p.x + clock * (fx === 'gulls' ? 14 : 9) * p.s) % (W + 60)) - 30;
        const y = (p.y % (H * 0.55)) + 40 + Math.sin(clock * 0.7 + p.ph) * 10;
        if (fx === 'gulls') {
          const f = Math.sin(clock * 3 + p.ph) * 2.2;
          ctx.strokeStyle = 'rgba(70,70,95,0.55)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x - 7 * p.s, y - f); ctx.quadraticCurveTo(x - 3 * p.s, y - 4, x, y); ctx.quadraticCurveTo(x + 3 * p.s, y - 4, x + 7 * p.s, y - f); ctx.stroke();
        } else {
          const f = Math.abs(Math.sin(clock * 6 + p.ph));
          ell(ctx, x - 2.4 * f, y, 2.6 * f + 0.4, 3, 0, WING[p.c]); ell(ctx, x + 2.4 * f, y, 2.6 * f + 0.4, 3, 0, WING[p.c]);
          ell(ctx, x, y, 0.7, 2.4, 0, '#5a4a4a');
        }
      }
      return;
    }
    for (const p of EVFX) {
      const y = (p.y + clock * 22 * p.s + bgOff * 0.05) % (H + 30) - 15;
      const x = p.x + Math.sin(clock * 0.8 + p.ph) * 14;
      if (fx === 'snow') dot(ctx, x, y, 1.6 * p.s, 'rgba(255,255,255,0.85)');
      else { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(clock * 1.3 + p.ph) * 0.8); ell(ctx, 0, 0, 3.4 * p.s, (fx === 'petals' ? 2.3 : 1.8) * p.s, 0, (fx === 'petals' ? PETAL : LEAF)[p.c]); ctx.restore(); }
    }
  }

  // ================= Kedi bakimi: besle, yika, sev, oyna, uyut =================
  // Gostergeler gercek zamanla azalir (oyun kapaliyken de). Saat: kac saatte 100'den 0'a iner.
  const PET_HOURS = { food: 10, clean: 18, fun: 8, energy: 14 };
  const PET_ICON = { food: '🍗', clean: '🛁', fun: '🧶', energy: '💤' };
  const pet = { tool: '', px: 150, py: 120, down: false, foam: [], drops: [], hearts: [], zz: [], sparkles: [],
    mouth: 0, eatT: 0, flyT: -1, rubT: 0, purr: 0, saveT: 0, sayT: 0, say: '', paw: 0, lastMove: 0, dirtFade: 0 };
  const DIRT = [[-5, 4, 3.2], [6, 10, 2.6], [-3, 15, 2.8], [4, -10, 2.2], [-6, -4, 2.4], [3, 3, 2]];
  const snd = (fn) => { if (!save.sound || DEMO) return; try { if (ac()) fn(); } catch { /* ses yok */ } };
  function petTick(force) {
    const p = save.pet, now = Date.now();
    const dt = Math.min(7 * 86400, Math.max(0, (now - p.t) / 1000));
    if (dt < 1 && !force) return;
    p.t = now;
    for (const k of ['food', 'clean', 'fun']) p[k] = Math.max(0, p[k] - (dt * 100) / (PET_HOURS[k] * 3600));
    if (p.sleep) p.energy = Math.min(100, p.energy + (dt * 100) / (1.5 * 3600));
    else p.energy = Math.max(0, p.energy - (dt * 100) / (PET_HOURS.energy * 3600));
    persist('pet');
  }
  const petHappy = () => { petTick(); const p = save.pet; return p.food >= 50 && p.clean >= 50 && p.fun >= 50 && p.energy >= 30; };
  function petAdd(k, v) { save.pet[k] = Math.max(0, Math.min(100, save.pet[k] + v)); }
  function petSay(text, sec = 1.8) { pet.say = text; pet.sayT = sec; }
  function petBars() {
    const p = save.pet;
    for (const k of ['food', 'clean', 'fun', 'energy']) {
      const el = $('pet_' + k);
      if (!el) continue;
      el.style.width = Math.round(p[k]) + '%';
      el.classList.toggle('low', p[k] < 30);
    }
    $('petMood').textContent = petHappy() ? '😺 Kedin çok mutlu: oyunda %10 fazla balık!' : '😿 Kedinin bakıma ihtiyacı var';
    document.querySelectorAll('[data-pet]').forEach((b) => b.classList.toggle('on', b.dataset.pet === pet.tool || (b.dataset.pet === 'sleep' && p.sleep)));
  }
  // mirlama: kedi sevilirken dongude calar, sesi yavasca acilip kapanir
  let purrSrc = null, purrGain = null;
  function purrSet(on) {
    if (!save.sound || DEMO || !audio.ctx || !samples.mirlama) return;
    const c = audio.ctx;
    if (on && !purrSrc) {
      purrSrc = c.createBufferSource(); purrSrc.buffer = samples.mirlama; purrSrc.loop = true;
      purrGain = c.createGain(); purrGain.gain.setValueAtTime(0.0001, c.currentTime);
      purrGain.gain.exponentialRampToValueAtTime(0.7, c.currentTime + 0.4);
      purrSrc.connect(purrGain).connect(audio.sfx); purrSrc.start();
    } else if (!on && purrSrc) {
      purrGain.gain.setValueAtTime(Math.max(0.0001, purrGain.gain.value), c.currentTime);
      purrGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
      purrSrc.stop(c.currentTime + 0.55); purrSrc = null;
    }
  }
  function petTool(tool) {
    petTick(true);
    const p = save.pet;
    if (tool === 'sleep') {
      p.sleep = !p.sleep; pet.tool = '';
      persist('pet'); sfx('ui');
      petSay(p.sleep ? 'İyi geceler...' : 'Günaydın!');
      if (!p.sleep) sfx('meowHappy');
      petBars();
      return;
    }
    if (p.sleep) { petSay('Şşş... uyuyor. Önce lambayı aç.'); sfx('nope'); return; }
    if (tool === 'feed') {
      if (p.food >= 95) { petSay('Tokum, teşekkürler!'); sfx('meowShort'); return; }
      if (save.wallet < 2) { petSay('Mama için 2 balık lazım'); sfx('nope'); return; }
      save.wallet -= 2; persist('wallet'); $('wallet5').textContent = save.wallet;
      pet.flyT = 0; pet.tool = '';
      petBars();
      return;
    }
    if (tool === 'play' && p.energy < 15) { petSay('Çok yorgunum... biraz uyuyayım mı?'); sfx('meowSad'); return; }
    pet.tool = pet.tool === tool ? '' : tool;
    if (pet.tool === 'wash') { pet.foam = []; pet.dirtFade = 0; petSay('Süngerle kedini köpürt!'); }
    if (pet.tool === 'pet') petSay('Başını ve sırtını okşa');
    if (pet.tool === 'play') petSay('Tüyü parmağınla gezdir');
    sfx('click');
    petBars();
  }
  // kedi uzerinde mi? (oda koordinatlari: kedi merkezi 150,228; olcek 3.4)
  const CAT_X = 150, CAT_Y = 228, CAT_S = 3.4;
  function onCat(x, y) {
    const hx = (x - CAT_X) / CAT_S, hy = (y - CAT_Y) / CAT_S;
    return Math.hypot(hx, hy + 6) < 10 || Math.hypot(hx / 1.05, (hy - 8) / 1.1) < 10;
  }
  function petPointer(kind, e) {
    const cv = $('houseCv'), r = cv.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) * 300) / r.width, y = ((e.clientY - r.top) * 300) / r.height;
    const moved = Math.hypot(x - pet.px, y - pet.py);
    pet.px = x; pet.py = y;
    if (kind === 'down') { pet.down = true; if (save.sound || save.music) ac(); }
    if (kind === 'up') { pet.down = false; purrSet(false); return; }
    if (!pet.down && kind !== 'down') return;
    const p = save.pet;
    if (!pet.tool && kind === 'down' && onCat(x, y) && !p.sleep) { sfx('meowShort'); pet.mouth = 1; pet.hearts.push({ x, y, t: 0 }); return; }
    if (pet.tool === 'wash' && onCat(x, y) && moved > 1.5) {
      if (pet.foam.length < 40 && Math.random() < 0.6) pet.foam.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), r: rand(3, 6.5), t: 0 });
      pet.dirtFade = Math.min(1, pet.dirtFade + 0.012);
      if (Math.random() < 0.25) snd(() => hiss(0.08, { freq: 3200, q: 0.8, vol: 0.02 }));
      if (pet.foam.length >= 28 && pet.tool === 'wash') { pet.tool = 'rinse'; petSay('Harika! Şimdi duşla durula 🚿'); snd(() => bell(1568, 0.2, 0.04)); petBars(); }
    } else if (pet.tool === 'rinse' && moved > 1) {
      for (let i = 0; i < 2; i++) pet.drops.push({ x: x + rand(-8, 8), y: y + rand(-4, 4), vy: rand(80, 140), t: 0 });
      if (Math.random() < 0.3) snd(() => hiss(0.1, { freq: 1800, q: 0.5, vol: 0.03 }));
      pet.foam = pet.foam.filter((f) => Math.hypot(f.x - x, f.y - y) > 14);
      if (!pet.foam.length) {
        p.clean = 100; pet.tool = ''; pet.dirtFade = 0; persist('pet');
        for (let i = 0; i < 10; i++) pet.sparkles.push({ x: CAT_X + rand(-40, 40), y: CAT_Y + rand(-60, 60), t: rand(-0.3, 0) });
        petSay('Pırıl pırıl oldum!'); sfx('meowHappy'); sfx('power'); petBars();
      }
    } else if (pet.tool === 'pet' && onCat(x, y) && moved > 0.8) {
      pet.rubT = 0.5; petAdd('fun', 0.12);
      purrSet(true);
      if (Math.random() < 0.05) pet.hearts.push({ x, y: y - 6, t: 0 });
    } else if (pet.tool === 'play' && moved > 1) {
      pet.lastMove = clock;
      petAdd('fun', 0.18); petAdd('energy', -0.04);
      if (Math.hypot(x - CAT_X, y - (CAT_Y - 30)) < 45 && pet.paw <= 0) { pet.paw = 1; toySound('catch'); if (Math.random() < 0.35) pet.hearts.push({ x, y, t: 0 }); }
      else toySound('move');
    }
  }
  function updatePet(dt) {
    if (state !== 'house') { if (purrSrc) purrSet(false); return; }
    const p = save.pet;
    pet.saveT += dt;
    if (pet.saveT > 2) { pet.saveT = 0; petTick(); petBars(); }
    pet.mouth = Math.max(0, pet.mouth - dt * 2.5);
    pet.sayT = Math.max(0, pet.sayT - dt);
    pet.paw = Math.max(0, pet.paw - dt * 3);
    if (pet.rubT > 0) { pet.rubT -= dt; if (pet.rubT <= 0) purrSet(false); }
    if (pet.flyT >= 0) { // balik kaptan agza ucar, sonra 3 kez cignenir
      pet.flyT += dt;
      if (pet.flyT > 0.55 && pet.eatT <= 0) { pet.eatT = 1.2; sfx('coin'); }
      if (pet.flyT > 0.55) pet.flyT = -1;
    }
    if (pet.eatT > 0) {
      pet.eatT -= dt;
      pet.mouth = Math.abs(Math.sin(pet.eatT * 8));
      if (pet.eatT <= 0) { petAdd('food', 30); persist('pet'); pet.hearts.push({ x: CAT_X + 20, y: CAT_Y - 50, t: 0 }); sfx('meowHappy'); petSay('Nefis!'); petBars(); }
    }
    for (const f of pet.foam) f.t += dt;
    for (const d of pet.drops) { d.t += dt; d.y += d.vy * dt; }
    pet.drops = pet.drops.filter((d) => d.t < 0.5);
    for (const h of pet.hearts) { h.t += dt; h.y -= 22 * dt; }
    pet.hearts = pet.hearts.filter((h) => h.t < 1.2);
    for (const s of pet.sparkles) s.t += dt;
    pet.sparkles = pet.sparkles.filter((s) => s.t < 1);
    if (p.sleep && Math.random() < dt * 0.8) pet.zz.push({ x: CAT_X + 18, y: CAT_Y - 52, t: 0 });
    for (const z of pet.zz) { z.t += dt; z.y -= 12 * dt; z.x += 6 * dt; }
    pet.zz = pet.zz.filter((z) => z.t < 2.4);
  }
  function drawPet(g) {
    const p = save.pet, c = CAT_BY_ID[save.char];
    // kedi nereye bakar: oyunda tuye, digerlerinde hafifce salinir
    let ang = -0.2 + Math.sin(clock * 0.45) * 0.25;
    if (pet.tool === 'play') ang = Math.max(-0.9, Math.min(0.9, -(pet.px - CAT_X) / 120));
    if (p.sleep || pet.tool === 'wash' || pet.tool === 'rinse' || pet.rubT > 0 || pet.eatT > 0) ang = -0.12;
    const mood = { eyes: p.sleep ? 'closed' : pet.rubT > 0 || pet.tool === 'rinse' ? 'happy' : pet.tool === 'wash' ? 'closed' : '', mouth: pet.mouth, big: true, wide: pet.tool === 'play' };
    const hop = pet.tool === 'play' && clock - pet.lastMove < 0.4 ? Math.abs(Math.sin(clock * 6)) * 0.35 : 0;
    g.save(); g.translate(CAT_X, CAT_Y); g.scale(CAT_S, CAT_S);
    if (p.sleep) { g.translate(0, 2); g.scale(1, 0.97 + Math.sin(clock * 1.6) * 0.02); }
    drawCat3D(g, c, ang, clock, save.wardrobe, hop, pet.paw, mood);
    // kir lekeleri (temizlik dustukce artar)
    const n = Math.round((100 - p.clean) / 17);
    for (let i = 0; i < Math.min(n, DIRT.length); i++) {
      const [dx, dy, r] = DIRT[i];
      g.globalAlpha = 0.38 * (1 - pet.dirtFade);
      ell(g, dx, dy, r, r * 0.75, i, '#7a5a3a');
    }
    g.globalAlpha = 1;
    g.restore();
    // kopukler, damlalar, kalpler, pirilti, Zzz
    for (const f of pet.foam) { const s = Math.min(1, f.t * 6); dot(g, f.x, f.y, f.r * s, 'rgba(255,255,255,0.92)'); dot(g, f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.3 * s, 'rgba(190,220,255,0.9)'); }
    for (const d of pet.drops) ell(g, d.x, d.y, 1.3, 3, 0, `rgba(120,180,240,${1 - d.t * 2})`);
    for (const h of pet.hearts) { g.globalAlpha = 1 - h.t / 1.2; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('💗', h.x, h.y); }
    for (const s of pet.sparkles) if (s.t > 0) { g.globalAlpha = 1 - s.t; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText('✨', s.x, s.y); }
    g.globalAlpha = 1;
    if (p.sleep) {
      g.fillStyle = 'rgba(30,30,70,0.45)'; g.fillRect(0, 0, 300, 300);
      g.fillStyle = '#ffffff'; g.textAlign = 'center';
      for (const z of pet.zz) { g.globalAlpha = Math.max(0, 1 - z.t / 2.4); g.font = `800 ${10 + z.t * 4}px ${FONT}`; g.fillText('z', z.x, z.y); }
      g.globalAlpha = 1;
    }
    // ucan balik (besleme)
    if (pet.flyT >= 0) {
      const k = Math.min(1, pet.flyT / 0.55), x = lerp(60, CAT_X, k), y = lerp(250, CAT_Y - 20, k) - Math.sin(k * Math.PI) * 50;
      g.save(); g.translate(x, y); g.scale(1.6, 1.6); drawFish(g, 0, 0, 1, false); g.restore();
    }
    // oyun tuyu parmagi izler
    if (pet.tool === 'play') {
      g.strokeStyle = 'rgba(80,70,90,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(pet.px, 0); g.lineTo(pet.px, pet.py); g.stroke();
      ell(g, pet.px, pet.py + 6, 3, 9, Math.sin(clock * 5) * 0.4, '#f2a6b8'); ell(g, pet.px + 3, pet.py + 8, 2.4, 7, 0.5 + Math.sin(clock * 5) * 0.4, '#9cc3e6');
    }
    // sunger / dus imleci
    if ((pet.tool === 'wash' || pet.tool === 'rinse') && pet.down) { g.font = '22px sans-serif'; g.textAlign = 'center'; g.fillText(pet.tool === 'wash' ? '🧽' : '🚿', pet.px, pet.py - 10); }
    // dusunce balonu: en cok neye ihtiyaci var
    const need = p.sleep ? '' : ['food', 'clean', 'fun', 'energy'].filter((k) => p[k] < 30).sort((a, b) => p[a] - p[b])[0];
    const text = pet.sayT > 0 ? pet.say : '';
    if (text) {
      g.font = `700 11px ${FONT}`; const w = Math.min(200, g.measureText(text).width + 18);
      g.fillStyle = 'rgba(255,255,255,0.95)'; rr(g, 150 - w / 2, 120, w, 24, 12); g.fill();
      g.fillStyle = '#3b3552'; g.textAlign = 'center'; g.fillText(text, 150, 136);
    } else if (need) {
      const by = 140 + Math.sin(clock * 2) * 2;
      dot(g, 196, by, 15, 'rgba(255,255,255,0.95)'); dot(g, 182, by + 18, 4, 'rgba(255,255,255,0.95)'); dot(g, 176, by + 25, 2.4, 'rgba(255,255,255,0.95)');
      g.font = '15px sans-serif'; g.textAlign = 'center'; g.fillText(PET_ICON[need], 196, by + 5);
    }
  }
  const houseCvEl = $('houseCv');
  if (houseCvEl && houseCvEl.addEventListener) {
    houseCvEl.addEventListener('pointerdown', (e) => { if (houseCvEl.setPointerCapture) try { houseCvEl.setPointerCapture(e.pointerId); } catch { /* yoksay */ } petPointer('down', e); });
    houseCvEl.addEventListener('pointermove', (e) => petPointer('move', e));
    houseCvEl.addEventListener('pointerup', (e) => petPointer('up', e));
    houseCvEl.addEventListener('pointercancel', (e) => petPointer('up', e));
  }

  // ================= Kedi evi =================
  const house = { ang: -0.45, t: 0 };
  function drawHouse() {
    if (state !== 'house') return;
    const cv = $('houseCv'), g = cv.getContext('2d');
    if (!cv.width) return;
    const k = cv.width / 300;
    g.setTransform(k, 0, 0, k, 0, 0);
    const pl = save.house.placed;
    // duvar ve zemin
    const wg = g.createLinearGradient(0, 0, 0, 160); wg.addColorStop(0, '#fbe7d6'); wg.addColorStop(1, '#f6d5bd');
    g.fillStyle = wg; g.fillRect(0, 0, 300, 160);
    g.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = 12; x < 300; x += 24) g.fillRect(x, 0, 2, 160);
    const fg = g.createLinearGradient(0, 160, 0, 300); fg.addColorStop(0, '#d9a77a'); fg.addColorStop(1, '#c58f62');
    g.fillStyle = fg; g.fillRect(0, 160, 300, 140);
    g.strokeStyle = 'rgba(120,70,40,0.18)'; g.lineWidth = 1; for (let y = 172; y < 300; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(300, y); g.stroke(); }
    g.fillStyle = '#e9c4a4'; g.fillRect(0, 156, 300, 6);
    // pencere
    const sk = g.createLinearGradient(0, 30, 0, 110); sk.addColorStop(0, '#8ec5ea'); sk.addColorStop(1, '#fde2c8');
    g.fillStyle = '#ffffff'; rr(g, 200, 26, 76, 88, 8); g.fill();
    g.fillStyle = sk; rr(g, 205, 31, 66, 78, 6); g.fill();
    dot(g, 252, 52, 9, '#fff1c1');
    g.fillStyle = 'rgba(255,255,255,0.85)'; ell(g, 222, 80, 12, 5, 0, 'rgba(255,255,255,0.85)');
    g.fillStyle = '#ffffff'; g.fillRect(236, 31, 4, 78); g.fillRect(205, 68, 66, 4);
    g.fillStyle = '#f2a6b8'; rr(g, 194, 22, 14, 96, 6); g.fill(); rr(g, 268, 22, 14, 96, 6); g.fill();
    // tablo
    if (pl.tablo) {
      g.fillStyle = '#b07a48'; rr(g, 96, 36, 70, 54, 4); g.fill();
      g.fillStyle = pl.tablo === 'tablo_ay' ? '#34406b' : '#bfe3f2'; g.fillRect(102, 42, 58, 42);
      if (pl.tablo === 'tablo_ay') { dot(g, 140, 56, 8, '#fff3d0'); dot(g, 144, 53, 7, '#34406b'); for (const [sx, sy] of [[112, 50], [124, 72], [150, 76]]) dot(g, sx, sy, 1.3, '#fff3d0'); }
      else { g.save(); g.translate(131, 64); g.scale(2.2, 2.2); drawFish(g, 0, 0, 1, false); g.restore(); }
    }
    g.save(); g.translate(0, 50); // zemindeki esyalar kedinin arkasinda, biraz asagida
    // hali
    if (pl.hali === 'hali_pembe') { ell(g, 150, 200, 78, 16, 0, '#f2a6b8'); ell(g, 150, 200, 60, 11, 0, '#f6c3cf'); }
    if (pl.hali === 'hali_cizgi') { g.fillStyle = '#9cc3e6'; rr(g, 70, 186, 160, 28, 6); g.fill(); g.fillStyle = '#ffffff'; for (let x = 82; x < 222; x += 20) g.fillRect(x, 186, 8, 28); }
    // kedi agaci
    if (pl.agac) {
      g.fillStyle = '#d8c3a5'; g.fillRect(36, pl.agac === 'agac_buyuk' ? 70 : 118, 10, pl.agac === 'agac_buyuk' ? 130 : 82);
      g.strokeStyle = 'rgba(120,90,60,0.35)'; for (let y = 76; y < 200; y += 6) { g.beginPath(); g.moveTo(36, y); g.lineTo(46, y + 3); g.stroke(); }
      g.fillStyle = '#9a7bb3'; rr(g, 16, 194, 50, 10, 4); g.fill(); rr(g, 18, 114, 46, 9, 4); g.fill();
      if (pl.agac === 'agac_buyuk') { rr(g, 22, 66, 40, 9, 4); g.fill(); g.strokeStyle = '#8a6a4a'; g.beginPath(); g.moveTo(58, 75); g.lineTo(58, 95); g.stroke(); dot(g, 58, 98, 4, '#e46b6b'); }
    }
    // bitki
    if (pl.bitki) {
      g.fillStyle = '#c8724f'; rr(g, 254, 178, 30, 26, 5); g.fill();
      if (pl.bitki === 'bitki_palmiye') { for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) ell(g, 269 + Math.sin(a) * 14, 160 - Math.cos(a) * 10, 4, 15, a, '#6fae6b'); }
      else { for (let i = 0; i < 5; i++) { const fx = 258 + i * 6; dot(g, fx, 170 - (i % 2) * 6, 2.5, '#7fb27a'); dot(g, fx, 164 - (i % 2) * 6, 4, ['#f28fa8', '#f6c35b', '#b99be8', '#ffffff', '#f28fa8'][i]); } }
    }
    // yatak
    if (pl.yatak === 'yatak_sepet') { ell(g, 214, 200, 34, 12, 0, '#c9945a'); ell(g, 214, 196, 28, 8, 0, '#e9b4c0'); g.strokeStyle = 'rgba(110,70,30,0.35)'; for (let x = 186; x < 244; x += 6) { g.beginPath(); g.moveTo(x, 196); g.lineTo(x + 2, 210); g.stroke(); } }
    if (pl.yatak === 'yatak_bulut') { for (const [bx, r] of [[192, 11], [206, 14], [222, 13], [236, 10]]) dot(g, bx, 198, r, '#ffffff'); ell(g, 214, 206, 34, 7, 0, '#eef3ff'); }
    // mama kabi
    if (pl.mama) {
      const gold = pl.mama === 'mama_altin';
      ell(g, 112, 208, 16, 6, 0, gold ? '#e9b44c' : '#6fa8dc');
      ell(g, 112, 204, 13, 4, 0, gold ? '#f6d68a' : '#9cc3e6');
      if (gold) { g.save(); g.translate(112, 201); g.scale(0.9, 0.9); drawFish(g, 0, 0, 1, false); g.restore(); }
      else for (let i = 0; i < 6; i++) dot(g, 104 + i * 3, 203 - (i % 2), 1.6, '#b57a46');
    }
    g.restore();
    drawPet(g); // kedi ve bakim etkilesimleri
  }
  function renderHouse() {
    petTick(true); petBars();
    $('wallet5').textContent = save.wallet;
    const H2 = save.house;
    $('houseList').innerHTML = Object.keys(HOUSE_SLOTS).map((slot) => {
      const items = HOUSE_ITEMS.filter((h) => h.slot === slot).map((h) => {
        const owned = H2.owned.includes(h.id), on = H2.placed[slot] === h.id;
        const lbl = on ? 'Yerleşti ✓ (kaldır)' : owned ? 'Yerleştir' : `Satın al · 🐟 ${h.price}`;
        const cant = !owned && save.wallet < h.price;
        return `<button class="up hs${cant ? ' cant' : ''}${on ? ' done' : ''}" data-house="${h.id}"><b>${h.name}</b><em>${lbl}</em></button>`;
      }).join('');
      return `<h3>${HOUSE_SLOTS[slot]}</h3><div class="grid shop-grid">${items}</div>`;
    }).join('');
  }
  function houseClick(id) {
    const h = HOUSE_BY_ID[id], H2 = save.house;
    if (!h) return;
    if (H2.owned.includes(id)) { H2.placed[h.slot] = H2.placed[h.slot] === id ? '' : id; sfx('ui'); }
    else if (save.wallet >= h.price) { save.wallet -= h.price; H2.owned.push(id); H2.placed[h.slot] = id; persist('wallet'); sfx('buy'); sfx('meowHappy'); }
    else { sfx('nope'); return; }
    persist('house');
    checkAchievements();
    renderHouse();
  }

  // ================= Fotograf modu: giydirdigin kedinin fotografini cek, paylas =================
  // kind: 'cat' (kedinin fotografi) | 'challenge' (rekor karti: "Beni gecebilir misin?")
  const SITE_URL = 'https://burak-eng.github.io/patikat/';
  let photoUrl = '', shareText = '', shareLink = '', lastRunM = 0;
  function makePhoto(kind = 'cat') {
    const ch = kind === 'challenge', m = ch ? lastRunM : 0;
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1350;
    const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1350);
    if (ch) { bg.addColorStop(0, '#ffc9b0'); bg.addColorStop(0.55, '#ffe9d6'); bg.addColorStop(1, '#cfe0ff'); }
    else { bg.addColorStop(0, '#ffe3d3'); bg.addColorStop(0.6, '#fdf1e4'); bg.addColorStop(1, '#dfeaff'); }
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    g.globalAlpha = 0.12;
    for (let i = 0; i < 14; i++) { g.save(); g.translate(80 + (i * 173) % 980, 120 + ((i * 271) % 1100)); g.rotate(i); g.scale(6, 6); drawPaw(g, 0, 0, '#c4537a'); g.restore(); }
    g.globalAlpha = 1;
    const cy = ch ? 820 : 720;
    const halo = g.createRadialGradient(540, cy, 40, 540, cy, 470);
    halo.addColorStop(0, 'rgba(255,214,190,0.9)'); halo.addColorStop(1, 'rgba(255,214,190,0)');
    g.fillStyle = halo; g.fillRect(0, cy - 500, 1080, 1000);
    g.save(); g.translate(540, cy); g.scale(ch ? 12 : 15, ch ? 12 : 15);
    drawCat3D(g, CAT_BY_ID[save.char], state === 'chars' ? pv.ang : -0.4, clock, save.wardrobe, 0, 0, ch ? { eyes: 'happy', mouth: 0.6, big: true } : { big: true });
    g.restore();
    g.textAlign = 'center';
    g.fillStyle = '#ff8f70'; g.font = '900 120px ' + FONT; g.fillText('Patikat', 540, 170);
    if (ch) {
      g.fillStyle = '#3b3552'; g.font = '900 150px ' + FONT; g.fillText(m + ' m', 540, 360);
      g.font = '800 64px ' + FONT; g.fillText('Beni geçebilir misin?', 540, 460);
      g.fillStyle = '#7a7391'; g.font = '700 44px ' + FONT; g.fillText(CAT_BY_ID[save.char].name + ' ile tırmandım', 540, 1170);
      g.fillStyle = '#ff8f70'; g.font = '800 40px ' + FONT; g.fillText(SITE_URL.replace('https://', ''), 540, 1250);
      shareLink = SITE_URL + '?vs=' + m;
      shareText = 'Patikat\'ta ' + m + ' metre tırmandım! 🐾 Beni geçebilir misin? ' + shareLink;
    } else {
      g.fillStyle = '#3b3552'; g.font = '800 70px ' + FONT; g.fillText(CAT_BY_ID[save.char].name, 540, 1150);
      g.fillStyle = '#7a7391'; g.font = '600 40px ' + FONT; g.fillText('duvardan duvara, kat kat yukarı', 540, 1225);
      shareLink = SITE_URL;
      shareText = 'Kedim ' + CAT_BY_ID[save.char].name + ' 🐾 #Patikat ' + SITE_URL;
    }
    photoUrl = cv.toDataURL('image/png');
    $('photoImg').src = photoUrl;
    $('photoTitle').textContent = ch ? 'Meydan oku!' : 'Kedinin fotoğrafı';
    $('photoBack').dataset.act = ch ? 'menu' : 'chars';
    $('photoBack').textContent = ch ? 'Ana sayfa' : 'Geri';
    $('photoShare').classList.toggle('hidden', !(capPlugin('Share') || navigator.share));
    $('photoSave').href = photoUrl;
    sfx('click');
    showScreen('photo');
  }
  async function sharePhoto() {
    try {
      const Sh = capPlugin('Share'), Fs = capPlugin('Filesystem');
      if (Sh && Fs) { // APK: resmi onbellege yaz, sistemin paylas penceresini ac
        const w = await Fs.writeFile({ path: 'patikat-paylas.png', data: photoUrl.split(',')[1], directory: 'CACHE' });
        await Sh.share({ title: 'Patikat', text: shareText, files: [w.uri], dialogTitle: 'Paylaş' });
        return;
      }
      if (navigator.share) {
        const blob = await (await fetch(photoUrl)).blob();
        const file = new File([blob], 'patikat.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Patikat', text: shareText });
        else await navigator.share({ title: 'Patikat', text: shareText, url: shareLink });
      }
    } catch { /* kullanici vazgecti */ }
  }

  // ================= Bildirimler (yalnizca APK): kedin acikti, gunluk odul, ozledim =================
  async function scheduleReminders() {
    const LN = capPlugin('LocalNotifications');
    if (!LN || !save.notify) return;
    try {
      await LN.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      petTick(true);
      const name = CAT_BY_ID[save.char].name, now = Date.now();
      const hungrySec = Math.max(1800, ((save.pet.food - 25) * PET_HOURS.food * 3600) / 100);
      const noon = new Date(); noon.setDate(noon.getDate() + 1); noon.setHours(12, 0, 0, 0);
      await LN.schedule({ notifications: [
        { id: 1, title: name + ' acıktı 🐟', body: 'Mama kabı boş kaldı. Gelip besler misin?', schedule: { at: new Date(now + hungrySec * 1000), allowWhileIdle: true } },
        { id: 2, title: 'Günlük ödülün hazır 🎁', body: 'Serini bozma, bugünkü balıklarını al!', schedule: { at: noon, allowWhileIdle: true } },
        { id: 3, title: name + ' seni özledi 😿', body: 'Karabaş uyurken bir tur atalım mı?', schedule: { at: new Date(now + 3 * 86400000), allowWhileIdle: true } },
      ] });
    } catch { /* izin yok ya da desteklenmiyor */ }
  }
  async function askNotify() {
    const LN = capPlugin('LocalNotifications');
    if (!LN) return;
    try {
      const r = await LN.requestPermissions();
      save.notify = r.display === 'granted'; persist('notify'); renderMenu();
    } catch { /* yoksay */ }
  }

  // ================= Ana sayfa turu: onemli yerleri tek tek gosterir =================
  const TOUR = [
    ['endlessBtn', 'Sonsuz Koşu', 'Ne kadar yükseğe çıkabilirsin? Her 200 metre yeni bir kat.'],
    ['toyBtn', 'Kedinle oyna', 'Oltayla oyuncak sarkıt, kedin yakalasın. Her 5 yakalamada 1 balık.'],
    ['dailyBtn', 'Günün Seferi', 'Herkes aynı parkurda yarışır. Günde 3 hakkın var.'],
    ['levelsBtn', 'Bölümler', '18 kat, Karabaş bölümleri ve yıldızlar seni bekliyor.'],
    ['houseBtn', 'Kedi Evi', 'Balıklarla eşya al, kedinin odasını döşe.'],
    ['tab:cat', 'Kedim', 'Yeni kediler ve kıyafetler. Önce dene, beğenirsen satın al.'],
    ['tab:shop', 'Dükkan', 'Yükseltmeler ve yeni oyuncaklar.'],
    ['tab:goals', 'Görevler', 'Görevleri ve başarımları tamamla, balık kazan.'],
    ['settingsBtn', 'Ayarlar', 'Zorluk, ses, müzik ve nasıl oynanır.'],
  ];
  let tourStep = -1;
  function tourEl(key) {
    return key.startsWith('tab:') ? document.querySelector('[data-tab="' + key.slice(4) + '"]') : $(key);
  }
  function showTourStep() {
    const step = TOUR[tourStep], el = step && tourEl(step[0]);
    if (!step) { endTour(); return; }
    $('coach').classList.remove('hidden');
    $('coachTitle').textContent = step[1];
    $('coachSub').textContent = step[2];
    $('coachStep').textContent = `${tourStep + 1}/${TOUR.length} · devam için dokun`;
    const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    const ring = $('coachRing'), tip = $('coachTip');
    if (r && r.width) {
      if (el.scrollIntoView && (r.top < 0 || r.bottom > window.innerHeight)) { el.scrollIntoView({ block: 'center' }); return setTimeout(showTourStep, 250); }
      ring.style.left = r.left - 6 + 'px'; ring.style.top = r.top - 6 + 'px';
      ring.style.width = r.width + 12 + 'px'; ring.style.height = r.height + 12 + 'px';
      const below = r.top < window.innerHeight * 0.55;
      tip.style.top = (below ? r.bottom + 16 : Math.max(10, r.top - 130)) + 'px';
    }
  }
  function startTour() { if (DEMO) return; tourStep = 0; showTourStep(); }
  function nextTour() { tourStep++; sfx('click'); showTourStep(); }
  function endTour() {
    tourStep = -1;
    $('coach').classList.add('hidden');
    save.tourDone = true; persist('tourDone');
    setTimeout(askNotify, 2500);
    showNote('Hazırsın!', 'İyi eğlenceler. Ayarlardan eğitimi tekrar oynayabilirsin.');
  }
  $('coach').addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); if (e.target && e.target.id === 'coachSkip') endTour(); else nextTour(); });

  // ================= Ekranlar =================
  const SCREENS = ['menu', 'levels', 'chars', 'shop', 'missions', 'wardrobe', 'board', 'settings', 'ach', 'house', 'photo', 'pause', 'over', 'win'];
  const TAB_OF = { menu: 'home', settings: 'home', house: 'home', photo: 'cat', ach: 'goals', levels: 'map', chars: 'cat', wardrobe: 'cat', shop: 'shop', missions: 'goals', board: 'goals' };
  const TAB_TARGET = { home: 'menu', map: 'levels', cat: 'chars', shop: 'shop', goals: 'missions' };
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('pauseBtn').classList.toggle('hidden', state !== 'play');
    const tab = id ? TAB_OF[id] : null;
    $('tabbar').classList.toggle('hidden', !tab);
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }
  function showScreen(name) {
    const prev = state;
    state = name;
    if (name === 'chars' && prev !== 'wardrobe' && prev !== 'chars') pv.cat = save.char; // onizleme secili kediden baslar
    if (name === 'wardrobe' && prev !== 'wardrobe') pv.item = '';
    if (name === 'menu') renderMenu();
    if (name === 'levels') renderLevels();
    if (name === 'chars') renderChars();
    if (name === 'shop') renderShop();
    if (name === 'missions') renderMissions();
    if (name === 'wardrobe') renderWardrobe();
    if (name === 'board') renderBoard();
    if (name !== 'menu' && toy.on) setToyMode(false);
    if (name === 'settings') renderMenu();
    if (name === 'ach') renderAch();
    if (name === 'house') renderHouse();
    show(name);
    if (name === 'menu' && save.tutorialDone && !save.tourDone && tourStep < 0) setTimeout(startTour, 600);
    if (name === 'menu' && !hero.greeted) {
      hero.greeted = true;
      hero.hop = 1;
      heroSay(`Miyav! Hoş geldin${save.playerName ? ', ' + save.playerName : ''}!`);
    }
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
    renderLogin();
    renderEvent();
    checkAchievements();
    refillMissions();
    $('wallet').textContent = save.wallet;
    $('menuBest').textContent = save.bestByDiff[save.diff] || 0;
    $('diffName').textContent = DIFFS[save.diff].name;
    $('diffSeg').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.diff === save.diff));
    $('themeGrid').innerHTML = THEMES.map((x) => `<button class="${x.id === save.theme ? 'on' : ''}" data-theme="${x.id}"><span>${x.icon}</span>${x.name}</button>`).join('');
    $('soundBtn').textContent = 'Efekt: ' + (save.sound ? 'Açık' : 'Kapalı');
    $('musicBtn').textContent = 'Müzik: ' + (save.music ? 'Açık' : 'Kapalı');
    $('notifyBtn').textContent = 'Bildirim: ' + (save.notify ? 'Açık' : 'Kapalı');
    $('notifyBtn').classList.toggle('hidden', !capPlugin('LocalNotifications'));
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
        lv.dark && 'Karanlık', lv.weather === 'rain' && 'Yağmur', lv.weather === 'fog' && 'Sis', (lv.karabas ? 'Karabaş' : lv.dogs && 'Köpek')].filter(Boolean).join(' · ');
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

  // ---------- Kedim: dene, sonra satin al ----------
  // Bir kediye ya da esyaya dokununca ustteki buyuk onizlemede denenir; satin alma ayri bir dugmeyle yapilir.
  const pv = { cat: 'sarman', item: '', ang: -0.4, vel: 0.5, drag: false, lastX: 0, lastT: 0 };
  function pvWear() {
    const w = { ...save.wardrobe };
    if (state === 'wardrobe' && pv.item) { const c = COS_BY_ID[pv.item]; w[c.slot] = w[c.slot] === pv.item && save.wardrobe.owned.includes(pv.item) ? pv.item : pv.item; }
    return w;
  }
  function updatePreviewPanel() {
    const btn = $(state === 'wardrobe' ? 'wardPvBtn' : 'charPvBtn');
    if (state === 'chars') {
      const c = CAT_BY_ID[pv.cat], owned = save.owned.includes(c.id);
      $('charPvName').textContent = c.name;
      $('charPvDesc').textContent = c.ability + (CAT_STORY[c.id] ? ' · ' + CAT_STORY[c.id] : '');
      if (owned) { btn.textContent = save.char === c.id ? 'Seçili ✓' : 'Bu kediyi seç'; btn.disabled = save.char === c.id; btn.dataset.mode = 'select'; }
      else if (save.wallet >= c.price) { btn.textContent = `Satın al · 🐟 ${c.price}`; btn.disabled = false; btn.dataset.mode = 'buy'; }
      else { btn.textContent = `🐟 ${c.price} gerekli (sende ${save.wallet})`; btn.disabled = true; btn.dataset.mode = ''; }
    } else if (state === 'wardrobe') {
      if (!pv.item) {
        $('wardPvName').textContent = 'Bir eşyaya dokun';
        $('wardPvDesc').textContent = 'Önce kedinin üstünde denersin, beğenirsen satın alırsın.';
        btn.textContent = 'Eşya seç'; btn.disabled = true; btn.dataset.mode = '';
        return;
      }
      const it = COS_BY_ID[pv.item], owned = save.wardrobe.owned.includes(it.id), on = save.wardrobe[it.slot] === it.id;
      $('wardPvName').textContent = it.name;
      $('wardPvDesc').textContent = owned ? (on ? 'Şu an giyiyor' : 'Senin, istediğin zaman giydirebilirsin') : `${SLOT_NAMES[it.slot]} · deniyorsun`;
      if (owned) { btn.textContent = on ? 'Çıkar' : 'Giydir'; btn.disabled = false; btn.dataset.mode = 'wear'; }
      else if (it.reward) { $('wardPvDesc').textContent = it.reward; btn.textContent = 'Ödülle kazanılır'; btn.disabled = true; btn.dataset.mode = ''; }
      else if (save.wallet >= it.price) { btn.textContent = `Satın al · 🐟 ${it.price}`; btn.disabled = false; btn.dataset.mode = 'buy'; }
      else { btn.textContent = `🐟 ${it.price} gerekli (sende ${save.wallet})`; btn.disabled = true; btn.dataset.mode = ''; }
    }
  }
  function pvAction() {
    if (state === 'chars') {
      const c = CAT_BY_ID[pv.cat];
      if (save.owned.includes(c.id)) { save.char = c.id; persist('char'); sfx('meowShort'); }
      else if (save.wallet >= c.price) {
        save.wallet -= c.price; save.owned.push(c.id); save.char = c.id;
        persist('wallet'); persist('owned'); persist('char');
        sfx('buy'); sfx('meowHappy'); vibrate(30);
        showNote('Yeni kedi!', `${c.name} artık senin`);
      } else { sfx('nope'); return; }
      renderChars();
    } else if (state === 'wardrobe' && pv.item) {
      const it = COS_BY_ID[pv.item], wr = save.wardrobe;
      if (wr.owned.includes(it.id)) { wr[it.slot] = wr[it.slot] === it.id ? '' : it.id; sfx('ui'); }
      else if (!it.reward && save.wallet >= it.price) { save.wallet -= it.price; wr.owned.push(it.id); wr[it.slot] = it.id; persist('wallet'); sfx('buy'); vibrate(30); checkAchievements(); }
      else { sfx('nope'); return; }
      persist('wardrobe');
      renderWardrobe();
    }
  }
  function drawPreview() {
    if (state !== 'chars' && state !== 'wardrobe') return;
    const cv = $(state === 'wardrobe' ? 'wardPv' : 'charPv');
    if (!cv.width) return;
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    const k = cv.width / 60;
    g.setTransform(k, 0, 0, k, cv.width / 2, cv.height * 0.56);
    drawCat3D(g, CAT_BY_ID[state === 'wardrobe' ? save.char : pv.cat], pv.ang, clock, pvWear(), 0, 0);
  }
  function updatePreview(dt) {
    if (state !== 'chars' && state !== 'wardrobe') return;
    if (!pv.drag) { pv.ang += pv.vel * dt; pv.vel += (0.5 - pv.vel) * Math.min(1, dt); }
  }
  for (const id of ['charPv', 'wardPv']) { // onizlemeyi parmakla cevirme
    const cv = $(id);
    cv.addEventListener('pointerdown', (e) => { pv.drag = true; pv.lastX = e.clientX; pv.lastT = e.timeStamp; pv.vel = 0; if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch { /* yoksay */ } });
    cv.addEventListener('pointermove', (e) => {
      if (!pv.drag) return;
      const dx = e.clientX - pv.lastX, dtm = Math.max(1, e.timeStamp - pv.lastT) / 1000;
      pv.ang += dx * 0.016; pv.vel = Math.max(-9, Math.min(9, (dx * 0.016) / dtm));
      pv.lastX = e.clientX; pv.lastT = e.timeStamp;
    });
    const up = () => { pv.drag = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  function renderChars() {
    $('wallet2').textContent = save.wallet;
    if (!CAT_BY_ID[pv.cat]) pv.cat = save.char;
    $('charGrid').innerHTML = CATS.map((c) => {
      const owned = save.owned.includes(c.id), sel = save.char === c.id;
      const status = sel ? 'Seçili' : owned ? 'Senin' : `🐟 ${c.price}`;
      const cls = (pv.cat === c.id ? ' sel' : '') + (!owned && save.wallet < c.price ? ' cant' : '') + (owned ? ' own' : '');
      return `<button class="ch${cls}" data-char="${c.id}"><canvas width="128" height="128"></canvas><b>${c.name}</b><small>${c.ability}</small><span>${status}</span></button>`;
    }).join('');
    $('charGrid').querySelectorAll('button').forEach((b) => {
      const g = b.querySelector('canvas').getContext('2d');
      g.setTransform(3.2, 0, 0, 3.2, 64, 66);
      drawCat(g, CAT_BY_ID[b.dataset.char], 1, 'idle', 1, outfit());
    });
    updatePreviewPanel();
  }
  function charClick(id) { // yalnizca onizler; satin alma ayri dugmede
    if (!CAT_BY_ID[id]) return;
    pv.cat = id;
    if (save.sound && !DEMO) try { if (ac()) catVoice('short', id); } catch { /* yoksay */ } // her kedinin kendi sesi
    renderChars();
  }

  function renderWardrobe() {
    $('wallet4').textContent = save.wallet;
    const wr = save.wardrobe;
    $('wardList').innerHTML = Object.keys(SLOT_NAMES).map((slot) => {
      const items = COSMETICS.filter((c) => c.slot === slot).map((c) => {
        const owned = wr.owned.includes(c.id), on = wr[slot] === c.id;
        const status = on ? 'Giyili' : owned ? 'Senin' : c.reward ? '🏅 Ödül' : `🐟 ${c.price}`;
        const cls = (pv.item === c.id ? ' sel' : '') + (!owned && (c.reward || save.wallet < c.price) ? ' cant' : '') + (owned ? ' own' : '');
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
    updatePreviewPanel();
  }
  function cosClick(id) { // once dene
    if (!COS_BY_ID[id]) return;
    pv.item = pv.item === id && !save.wardrobe.owned.includes(id) ? '' : id;
    sfx('click');
    renderWardrobe();
  }

  // ---------- Dukkan: yukseltmeler ve oyuncaklar ----------
  function renderShop() {
    $('wallet3').textContent = save.wallet;
    $('shopList').innerHTML = UPGRADES.map((u) => {
      const lvl = upg(u.id), max = u.costs.length, done = lvl >= max;
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      const next = done ? 'En üst seviye' : u.steps[lvl];
      const cost = done ? '' : `Satın al · 🐟 ${u.costs[lvl]}`;
      const cant = !done && save.wallet < u.costs[lvl];
      return `<button class="up${done ? ' done' : ''}${cant ? ' cant' : ''}" data-upg="${u.id}"${done ? ' disabled' : ''}>
        <b>${u.name}</b><span class="pips">${pips}</span><small>${next}</small><em>${cost}</em></button>`;
    }).join('');
    const ts = save.toys;
    $('toyList').innerHTML = TOYS.map((t) => {
      const owned = ts.owned.includes(t.id), on = ts.sel === t.id;
      const lbl = on ? 'Seçili ✓' : owned ? 'Seç' : `Satın al · 🐟 ${t.price}`;
      const cant = !owned && save.wallet < t.price;
      return `<button class="up toy${cant ? ' cant' : ''}${on ? ' done' : ''}" data-toy="${t.id}"><canvas width="96" height="96"></canvas><b>${t.name}</b><em>${lbl}</em></button>`;
    }).join('');
    $('toyList').querySelectorAll('button').forEach((b) => {
      const g = b.querySelector('canvas').getContext('2d');
      g.setTransform(4, 0, 0, 4, 48, 52);
      drawToy(g, b.dataset.toy, 0, 0, 1);
    });
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
  function toyClick(id) {
    const t = TOY_BY_ID[id], ts = save.toys;
    if (!t) return;
    if (ts.owned.includes(id)) { ts.sel = id; sfx('ui'); }
    else if (save.wallet >= t.price) { save.wallet -= t.price; ts.owned.push(id); ts.sel = id; persist('wallet'); sfx('buy'); vibrate(30); toast('Yeni oyuncak!', `${t.name}: ana sayfada kedinle oyna`, 1.6); }
    else { sfx('nope'); return; }
    persist('toys');
    renderShop();
    renderToyChips();
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


  // ================= Girdi =================
  function onTap() {
    if (state === 'hint') { state = 'play'; last = performance.now(); $('hintCard').classList.add('hidden'); $('pauseBtn').classList.remove('hidden'); sfx('click'); return; }
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
    if (state === 'play' || state === 'pause' || state === 'over' || state === 'count' || state === 'hint') e.preventDefault();
    onTap();
  }, { passive: false });

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    if (!b.dataset.char && !b.dataset.cos && !b.dataset.upg && b.id !== 'soundBtn') sfx('click');
    const a = b.dataset.act;
    if (a === 'endless' || a === 'daily' || a === 'tutorial') startRun(a);
    else if (a === 'resume') loadResume();
    else if (a === 'revive') revive();
    else if (['levels', 'chars', 'shop', 'missions', 'wardrobe', 'board', 'settings'].includes(a)) showScreen(a);
    else if (b.dataset.tab) showScreen(TAB_TARGET[b.dataset.tab]);
    else if (a === 'menu') toMenu();
    else if (a === 'pause') pause();
    else if (a === 'retry' && run) startRun(run.mode, run.level);
    else if (a === 'next' && run) startRun('level', Math.min(LEVELS.length - 1, run.level + 1));
    else if (a === 'refreshBoard') { apiOk = null; renderBoard(); }
    else if (b.dataset.theme) { save.theme = b.dataset.theme; persist('theme'); buildPalettes(); computeP(); sfx('ui'); renderMenu(); }
    else if (b.dataset.diff) { save.diff = b.dataset.diff; persist('diff'); sfx('ui'); renderMenu(); }
    else if (b.dataset.level !== undefined) { const i = Number(b.dataset.level); if (levelUnlocked(i)) startRun('level', i); }
    else if (b.dataset.char) charClick(b.dataset.char);
    else if (b.dataset.cos) cosClick(b.dataset.cos);
    else if (b.dataset.upg) buyUpgrade(b.dataset.upg);
    else if (b.dataset.toy) toyClick(b.dataset.toy);
    else if (b.dataset.toysel) { save.toys.sel = b.dataset.toysel; persist('toys'); renderToyChips(); sfx('meowShort'); }
    else if (a === 'toyMode') setToyMode(!toy.on);
    else if (a === 'pvAction') pvAction();
    else if (a === 'claimLogin') claimLogin();
    else if (a === 'photo') makePhoto('cat');
    else if (a === 'challenge') makePhoto('challenge');
    else if (a === 'sharePhoto') sharePhoto();
    else if (a === 'ach' || a === 'house') showScreen(a);
    else if (b.dataset.house) houseClick(b.dataset.house);
    else if (b.dataset.pet) petTool(b.dataset.pet);
    else if (b.id === 'soundBtn') { save.sound = !save.sound; persist('sound'); renderMenu(); sfx('coin'); }
    else if (b.id === 'notifyBtn') { if (save.notify) { save.notify = false; persist('notify'); renderMenu(); } else askNotify(); }
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
      if (state === 'play' || state === 'pause' || state === 'over' || state === 'hint') { e.preventDefault(); if (!e.repeat) onTap(); }
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'play' || state === 'count') pause(); else if (state === 'pause') resume();
    }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); audioSleep(document.hidden); });
  window.addEventListener('pagehide', () => { pause(); audioSleep(true); });
  window.addEventListener('pageshow', () => audioSleep(false));
  try { const A = capPlugin('App'); if (A) A.addListener('appStateChange', (s) => { if (!s.isActive) pause(); audioSleep(!s.isActive); }); } catch { /* yoksay */ }
  window.addEventListener('pagehide', pause);
  if (!DEMO) window.addEventListener('blur', pause);

  // ================= Dongu =================
  let last = performance.now();
  let frameNo = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (state !== 'pause') update(dt);
    updateHero(dt);
    updatePreview(dt);
    updatePet(dt);
    // oyun sirasinda kare suresini olc; surekli yavassa cozunurlugu dusur
    if (state === 'play' && !DEMO && document.visibilityState !== 'hidden') {
      perfAcc += dt; perfN++;
      if (perfN >= 120) {
        const avg = perfAcc / perfN;
        if (avg > 0.022 && dprCap > 1) { dprCap = dprCap > 1.5 ? 1.5 : 1; resize(); }
        perfAcc = 0; perfN = 0;
      }
    }
    // menuler acikken arka plan perdenin altinda kalir: her karede degil, 4 karede bir ciz
    const behind = MENU_STATES.includes(state);
    frameNo++;
    if (!behind || frameNo % 4 === 0) draw();
    drawHero();
    drawPreview();
    drawHouse();
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

  if (THEME_BY_ID[params.get('theme')]) save.theme = params.get('theme'); // test icin
  const vs = Math.floor(Number(params.get('vs'))); // meydan okuma linkiyle gelindi
  if (vs > 0 && vs < 100000 && !DEMO) { save.rival = { m: vs, beaten: false }; persist('rival'); setTimeout(() => showNote('Meydan okuma! 🏆', 'Arkadaşın ' + vs + ' m tırmandı. Sonsuz Koşuda onu geçebilir misin?'), 1500); }
  buildPalettes();
  setPalette(0, true);
  resize();
  window.addEventListener('resize', resize);
  reset();
  showScreen('menu');
  if (!DEMO && MENU_STATES.includes(params.get('screen'))) showScreen(params.get('screen')); // dogrudan ekran (test icin)
  else if (!DEMO && !save.tutorialDone && save.life.runs === 0 && !save.resume) startRun('tutorial'); // yeni oyuncu: dogrudan egitim
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

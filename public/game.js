'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo'); // test icin otomatik oynayan bot
  const ZONE_Q = params.has('zone') ? Number(params.get('zone')) : null; // test icin mekan secimi

  // ================= Sabitler (mantiksal birim; genislik hep 360) =================
  const W = 360;
  const WALL = 28;          // gostergelerin kenar boslugu
  const JET_W = 72, JET_H = 26, JET_PERIOD = 2.8; // fiskiye: duvar ustune su yayi
  const METER = 40;         // 1 metre = 40 birim
  const STAGE_M = 200;      // sonsuz modda sokak degisim araligi (m)
  const DAILY_TRIES = 3;
  const COIN = '#e9b46a', COIN_HI = '#f6dcae';
  // ----- Yan gorunum (yatay kosu) -----
  const CAT_SX = 104;        // kedinin ekrandaki yatay yeri
  const CAM_Y = 0.62;        // cati kenarinin ekrandaki yuksekligi (oran)
  const ZOOM = 1.2, VW = W / ZOOM; // sahne yakinlastirmasi; VW: gorunen dunya genisligi
  const GRAV = 1750;         // yercekimi
  const JUMP_V = 540;        // ziplama hizi (tepe ~83 birim)
  const PATI_V = 450;        // havada pati ziplamasi
  const CAT_HW = 15, CAT_H = 26; // kedinin carpisma kutusu
  const CAT_DRAW = 0.95;     // kedi/kopek cizim olcegi
  const BAR_LOW = 46, BAR_HIGH = 68; // camasir ipindeki camasirlarin yerden yuksekligi
  const SPEED_K = 0.82;      // yatay hiz carpani (goz yormasin diye biraz yavas)
  const DOG_NEAR = 78, DOG_AWAY = 760; // kopegin kediye uzakligi
  const SLIDE_T = 0.62;      // kayma suresi (sn)
  const SLIDE_H = 13;        // kayan kedinin yuksekligi
  const SIGN_LOW = 22;       // tabelanin alt kenari: ancak kayarak gecilir
  const LEDGE_UP = 62;       // tentelerin cati ustunden yuksekligi
  const MAX_SPEED = 365;     // ust hiz siniri (ilerisi rahat gorunsun, goz yorulmasin)
  const ROOMBA_V = 70;       // robot supurgenin kediye dogru hizi
  const BALLOON_T = 6, YAY_T = 10;
  // Bina arasi (duvardan duvara): kedi dar araliga girer, duvarlar arasinda ziplayarak ust catiya tirmanir
  const WJ_V = 500, WJ_VX = 330; // duvardan ziplama: yukari ve yana hiz
  const WALL_SLIDE = 48;     // duvarda tutunurken asagi kayma hizi
  const PASSAGE_H = 58;      // sol binanin altindaki gecit yuksekligi

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
  const ALL = { bars: true, ac: true, power: true, jets: true, weather: true, long: true, sticky: true, crows: true, dogs: true, roomba: true };
  const STAGES = [
    { pal: 0, sub: 'Zıpla, aşağı kaydırıp kay, tentelerde koş' },
    { pal: 1, sub: 'Robot süpürgeler, çamaşır ipleri ve kargalar', bars: true, ac: true, crows: true, roomba: true },
    { pal: 2, sub: 'Fıskiyeler açıldı, hava değişebilir', bars: true, ac: true, crows: true, power: true, jets: true, weather: true, roomba: true },
    { pal: 3, sub: 'Bal dökülmüş, boşluklar genişliyor', bars: true, ac: true, crows: true, power: true, jets: true, weather: true, long: true, sticky: true, dogs: true },
    { pal: 4, sub: 'Akşam oldu, her şey bir arada', ...ALL },
    { pal: 5, sub: 'Sokak lambaları söndü', ...ALL, dark: true },
    { pal: 6, sub: 'Günaydın! Yeni tur başlıyor', ...ALL },
  ];
  // Mekanlar: her biri kendi binalari, arka plani ve engel gorunumleriyle (carpisma kutulari aynidir, denge bozulmaz)
  const ZONES = [
    { id: 'apartman', name: 'Apartmanlar', to: 'Apartmanlara', at: 'Apartmanlarda', icon: '🏢', sub: 'Çamaşır ipleri ve süpürgeler', deco: ['baca', 'anten', 'canak', 'depo', 'oda'] },
    { id: 'sahil',    name: 'Sahil',       to: 'Sahile',       at: 'Sahilde', icon: '⚓', sub: 'Balık kasaları, ağlar ve yengeçler', deco: ['fener', 'halat', 'fener'] },
    { id: 'carsi',    name: 'Çarşı',       to: 'Çarşıya',      at: 'Çarşıda', icon: '🕌', sub: 'Semaverler, halılar ve yuvarlanan narlar', deco: ['kubbe', 'baca', 'kubbe'] },
    { id: 'santiye',  name: 'Şantiye',     to: 'Şantiyeye',    at: 'Şantiyede', icon: '🏗️', sub: 'Çimento torbaları, kirişler ve el arabaları', deco: ['demir', 'kum', 'demir'] },
  ];
  // Patronlar: her 10. bolum. Arkadan kovalar, ekranin onunden saldirir (drop: catiya duser -> zipla, low: bas hizasi -> kay).
  // Her atlatilan saldiri patronu yorar; cani bitince pes eder. Karabas saldirmaz, temiz gecilen her engel onu yorar.
  const BOSSES = {
    supurge: { name: 'Dev Süpürge', hp: 7, attacks: ['drop', 'low', 'drop'], intro: 'Hortumu alçaktan gelirse kay, toz torbası düşerse zıpla.', caught: 'Dev Süpürge seni çekti!', beat: 'Dev Süpürgenin fişi çekildi!' },
    marti:   { name: 'Martı Reis',  hp: 7, attacks: ['low', 'drop', 'low'], intro: 'Alçaktan dalarsa kay, kasa atarsa zıpla.', caught: 'Martı Reis kaptı!', beat: 'Martı Reis denize uçup gitti!' },
    kepce:   { name: 'Kepçe',       hp: 8, attacks: ['drop', 'low', 'drop'], intro: 'Moloz dökerse zıpla, kova alçaktan gelirse kay.', caught: 'Kepçe seni kaptı!', beat: 'Kepçenin mazotu bitti!' },
    karabas: { name: 'Karabaş',     hp: 12, attacks: [], intro: 'Her engeli temiz geç, yorulsun.', caught: 'Karabaş yakaladı!', beat: 'Karabaş yoruldu, pes etti!' },
  };
  const ZONE_BOSS = ['supurge', 'marti', 'karabas', 'kepce'];
  const zoneAtStage = (st) => Math.floor(st / 2) % ZONES.length; // sonsuz kosuda her 2 sokakta (400 m) bir yeni mekan
  const stageAt = (i) => (i < STAGES.length ? STAGES[i] : STAGES[2 + ((i - STAGES.length) % (STAGES.length - 2))]);

  const WEATHERS = {
    clear: { name: 'Açık hava', sub: '' },
    rain:  { name: 'Yağmur', sub: 'Duvarlar kaygan, zıplamalar biraz alçak' },
    fog:   { name: 'Sis', sub: 'İlerisi zor görünüyor' },
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
  // Sokak kedileri: kosarken catilarda bulunan kayip yavrular. Her mekanda 4 tane; kurtarilan yavrular Kedi Evi'nde yasar.
  const STRAYS = [
    { id: 'fistik',   name: 'Fıstık',   z: 0, fur: '#d9a066', fur2: '#b07a44', belly: '#f2dcc0', eyes: ['#8fbf6a', '#8fbf6a'], pattern: 'tabby',  note: 'Bacada ısınıyordu' },
    { id: 'bulut',    name: 'Bulut',    z: 0, fur: '#c9ccd3', fur2: '#a9adb6', belly: '#eceef2', eyes: ['#d9b84a', '#d9b84a'], pattern: 'solid',  note: 'Anten tepesinde mahsur kalmış' },
    { id: 'boncuk',   name: 'Boncuk',   z: 0, fur: '#f2ece3', fur2: '#d9904a', fur3: '#4a4040', belly: '#ffffff', eyes: ['#7fb3d9', '#7fb3d9'], pattern: 'calico', note: 'Çamaşır sepetinde uyuyakalmış' },
    { id: 'komur',    name: 'Kömür',    z: 0, fur: '#3b3b42', fur2: '#3b3b42', belly: '#4a4a52', eyes: ['#e8c547', '#e8c547'], pattern: 'solid',  note: 'Gece çatıda yolunu kaybetmiş', rim: true },
    { id: 'lokum',    name: 'Lokum',    z: 1, fur: '#f4f1ea', fur2: '#e0a070', belly: '#ffffff', eyes: ['#6fa8dc', '#d9a441'], pattern: 'van',    note: 'Balıkçı kayığından atlamış' },
    { id: 'midye',    name: 'Midye',    z: 1, fur: '#6a6670', fur2: '#46434c', belly: '#d9d4cc', paws: '#f4f1ea', eyes: ['#9bd27a', '#9bd27a'], pattern: 'tuxedo', note: 'Ağların arasına sıkışmış' },
    { id: 'kumsal',   name: 'Kumsal',   z: 1, fur: '#e6c9a0', fur2: '#c9a070', belly: '#f6ead8', eyes: ['#9bc46a', '#9bc46a'], pattern: 'tabby',  note: 'Martılardan saklanıyordu' },
    { id: 'dalga',    name: 'Dalga',    z: 1, fur: '#9aa6b8', fur2: '#76829a', belly: '#d0d7e2', eyes: ['#e8c547', '#e8c547'], pattern: 'solid',  note: 'İskele babasına tırmanmış' },
    { id: 'tarcin',   name: 'Tarçın',   z: 2, fur: '#c9844e', fur2: '#9c5f32', belly: '#ecd2b4', eyes: ['#9bc46a', '#9bc46a'], pattern: 'tabby',  note: 'Baharatçının çuvalında' },
    { id: 'sutlac',   name: 'Sütlaç',   z: 2, fur: '#f2e9dc', fur2: '#7a5a48', belly: '#fbf6ee', eyes: ['#6fa8dc', '#6fa8dc'], pattern: 'points', note: 'Muhallebicinin önünde bekliyordu' },
    { id: 'kurabiye', name: 'Kurabiye', z: 2, fur: '#f0e6d8', fur2: '#8a6a52', belly: '#ffffff', eyes: ['#d9b84a', '#d9b84a'], pattern: 'spots',  note: 'Halıların arasında saklambaç' },
    { id: 'pasa',     name: 'Paşa',     z: 2, fur: '#8e8478', fur2: '#5a5249', belly: '#d6ccbf', eyes: ['#d9a441', '#d9a441'], pattern: 'tabby',  note: 'Kubbenin tepesinde oturuyordu' },
    { id: 'cakil',    name: 'Çakıl',    z: 3, fur: '#a8a29a', fur2: '#7c766e', belly: '#dad5ce', eyes: ['#8fbf6a', '#8fbf6a'], pattern: 'tabby',  note: 'Kum yığınında oynuyordu' },
    { id: 'kask',     name: 'Kask',     z: 3, fur: '#e8b04a', fur2: '#c48a30', belly: '#f6e2b8', eyes: ['#7fb3d9', '#7fb3d9'], pattern: 'solid',  note: 'İskele tahtasında uyuyordu' },
    { id: 'tugla',    name: 'Tuğla',    z: 3, fur: '#f2ece3', fur2: '#c4664e', fur3: '#3a3333', belly: '#ffffff', eyes: ['#9bc46a', '#9bc46a'], pattern: 'calico', note: 'Tuğla paletinin arasında' },
    { id: 'beton',    name: 'Beton',    z: 3, fur: '#5e6068', fur2: '#43454c', belly: '#f4f1ea', paws: '#f4f1ea', eyes: ['#e8c547', '#e8c547'], pattern: 'tuxedo', note: 'Çimento torbalarının üstünde' },
  ];
  const STRAY_BY_ID = Object.fromEntries(STRAYS.map((s) => [s.id, s]));
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
      return { id: 'yilbasi-' + (m === 12 ? y : y - 1), name: 'Yılbaşı Şenliği', fx: 'snow', item: 'noel', goal: 600, text: "Çatı Koşusunda 600 m'ye ulaş, Noel Şapkası kazan" };
    }
    if (m === 11) return { id: 'sonbahar-' + y, name: 'Sonbahar Şenliği', fx: 'leaves', item: 'yaprak', goal: 500, text: "Çatı Koşusunda 500 m'ye ulaş, Yaprak Taç kazan" };
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
    balon:  { name: 'Balon',       color: '#ec8fa6' },
    yay:    { name: 'Yaylı Pati',  color: '#6fbf8f' },
    box:    { name: 'Sürpriz kutu', color: '#b99be8' },
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
    slide: { stat: 'slides', tiers: [3, 6, 10, 15],       text: (n) => `Tek turda ${n} kez kay` },
    box:   { stat: 'boxes',  tiers: [1, 2, 3, 4],         text: (n) => `Tek turda ${n} sürpriz kutu topla` },
    shaft: { stat: 'shafts', tiers: [1, 2, 4, 6],         text: (n) => `Tek turda ${n} kez bina arasından tırman` },
    ledge: { stat: 'ledges', tiers: [2, 4, 7, 10],        text: (n) => `Tek turda ${n} tentede koş` },
  };
  const MISSION_REWARD = [30, 50, 80, 120];

  // len: [en kisa, baslangic en uzun, sondaki en uzun]; react: [baslangic, son] tepki suresi (sn)
  // Sonsuz kosu: yumusak baslangic, yavas artan hiz
  const ENDLESS = { speed: 230, ramp: 0.006, cap: 240, react: [0.58, 0.26], len: [70, 120, 250], coins: 0.6, sameMax: 2, hunger: true };
  const BREATHER = 3.2;     // kat degisiminde engelsiz mola (sn)
  const REVIVE_COST = 60;   // ikinci sans bedeli (balik)
  // Desenler: rastgele dizilim yerine ritimli kaliplar
  const PATTERNS = [
    { id: 'normal', w: 0.5, from: 0 },
    { id: 'zigzag', w: 0.2, from: 1, name: 'Çatı çatı!' },
    { id: 'merdiven', w: 0.15, from: 2, name: 'Merdiven' },
    { id: 'balik', w: 0.1, from: 0, name: 'Balık yolu' },
    { id: 'tabela', w: 0.12, from: 1, name: 'Tabela sırası!' },
    { id: 'filo', w: 0.1, from: 2, name: 'Süpürge filosu!' },
    { id: 'tente', w: 0.12, from: 0, name: 'Tente yolu' },
  ];
  const LONG_LEN = [100, 180, 300];
  // Bolumler: daha hizli, daha kisa tepki suresi, daha cok engel karisimi (yine de her desen gecilebilir)
  const LEVEL_DEFAULTS = { ledge: 0.4, box: 0.07, ramp: 0.007, cap: 110, react: [0.46, 0.3], len: [70, 130, 200], coins: 0.55, sameMax: 2, bars: 0, jets: 0, sticky: 0, ac: 0, power: false, dark: false, weather: 'clear', hunger: true, crows: false, dogs: false };
  const LEVELS = [
    { name: 'Bahçe Duvarı',    goal: 220, speed: 255, ramp: 0.005, cap: 70, react: [0.55, 0.4], pal: 0, ac: 0.15, hunger: false },
    { name: 'Balık Pazarı',    zone: 1, goal: 260, speed: 265, coins: 0.95, react: [0.5, 0.36], pal: 1, ac: 0.2, crows: true },
    { name: 'Çatı Katı',       goal: 300, speed: 275, power: true, ac: 0.3, bars: 0.2, pal: 2, crows: true },
    { name: 'Çamaşır Günü',    goal: 340, speed: 285, bars: 0.45, power: true, pal: 1, crows: true },
    { name: 'Fıskiye Sokağı',  goal: 360, speed: 290, jets: 0.35, bars: 0.15, power: true, pal: 0, crows: true },
    { name: 'Hızlı Pati',      goal: 400, speed: 340, ramp: 0.01, cap: 140, react: [0.4, 0.27], power: true, pal: 2, crows: true },
    { name: 'Bal Duvarı',      goal: 400, speed: 300, sticky: 0.4, jets: 0.15, power: true, pal: 6, crows: true, dogs: true },
    { name: 'Boru Labirenti',  zone: 3, goal: 450, speed: 310, len: [140, 240, 340], sameMax: 3, bars: 0.2, power: true, pal: 3, crows: true, dogs: true },
    { name: 'Yağmurlu Akşam',  goal: 450, speed: 310, weather: 'rain', bars: 0.35, jets: 0.15, power: true, pal: 4, crows: true, dogs: true },
    { name: 'Patron: Dev Süpürge', boss: 'supurge', dogsAll: 1, karabas: true, goal: 450, speed: 300, dark: true, react: [0.48, 0.32], sticky: 0.2, power: true, pal: 5, crows: true, dogs: true },
    { name: 'Sisli Sabah',     goal: 500, speed: 315, weather: 'fog', jets: 0.3, bars: 0.2, power: true, pal: 6, crows: true, dogs: true },
    { name: 'İp Cambazı',      zone: 2, goal: 500, speed: 330, bars: 0.65, react: [0.42, 0.28], power: true, pal: 3, crows: true, dogs: true },
    { name: 'Klima Kulesi',    goal: 550, speed: 330, ac: 0.5, sticky: 0.3, jets: 0.3, power: true, pal: 2, crows: true, dogs: true },
    { name: 'Gece Yarısı',     goal: 600, speed: 340, dark: true, bars: 0.45, jets: 0.25, react: [0.44, 0.28], power: true, pal: 5, crows: true, dogs: true },
    { name: 'Ay Işığı',        goal: 700, speed: 360, ramp: 0.012, cap: 170, react: [0.4, 0.24], bars: 0.45, jets: 0.25, sticky: 0.25, ac: 0.3, weather: 'rain', len: [90, 170, 300], power: true, pal: 4, crows: true, dogs: true },
    // Karabas bolumleri: kopek bolum boyunca pesinde; kil payi ve baliklarla onu geride tut
    { name: 'Karabaş Kovalıyor', goal: 400, speed: 300, react: [0.46, 0.32], bars: 0.2, power: true, pal: 2, crows: true, dogsAll: 1, karabas: true },
    { name: 'Karabaş Geri Döndü', goal: 520, speed: 320, react: [0.44, 0.3], bars: 0.3, jets: 0.2, power: true, pal: 3, dogsAll: 1.15, karabas: true },
    { name: 'Büyük Kaçış',      goal: 650, speed: 340, react: [0.42, 0.27], bars: 0.35, jets: 0.25, sticky: 0.2, power: true, pal: 5, dark: true, dogsAll: 1.3, karabas: true },
  ];

  // Bolumler 80 olur: ilk 18 el yapimi, gerisi giderek zorlasan mahalle sokaklari (her 10. bolum Karabas)
  { const N1 = ['Kadıköy', 'Balat', 'Cihangir', 'Moda', 'Kuzguncuk', 'Fener', 'Galata', 'Ortaköy', 'Bebek', 'Üsküdar', 'Karaköy', 'Kuledibi', 'Arnavutköy', 'Samatya', 'Beşiktaş', 'Tophane', 'Kumkapı', 'Emirgan', 'Cibali', 'Yeldeğirmeni'];
    const N2 = ['Çatıları', 'Sokakları', 'Arası', 'Damları', 'Gecesi', 'Sabahı', 'Yokuşu', 'Pazarı'];
    for (let i = LEVELS.length; i < 80; i++) {
      const d = (i - 18) / 61;
      const lv = { name: N1[i % N1.length] + ' ' + N2[Math.floor(i / 3) % N2.length], goal: Math.round(450 + d * 550), speed: Math.round(300 + d * 70),
        react: [0.46 - d * 0.06, 0.3 - d * 0.05], bars: 0.2 + 0.3 * d, jets: 0.15 + 0.15 * d, sticky: 0.1 + 0.2 * d, ac: 0.2 + 0.2 * d,
        power: true, pal: i % 7, crows: true, dogs: true, dark: i % 7 === 5, weather: ['clear', 'rain', 'clear', 'fog'][i % 4] };
      lv.zone = [1, 2, 3, 0][Math.floor((i - 18) / 4) % 4];
      if (lv.zone) lv.name = N1[i % N1.length] + ' ' + ['', 'Sahili', 'Çarşısı', 'Şantiyesi'][lv.zone];
      if (i % 10 === 9) { const bk = ZONE_BOSS[lv.zone]; Object.assign(lv, { name: 'Patron: ' + BOSSES[bk].name + ' · ' + N1[i % N1.length], boss: bk, dogsAll: 1 + d * 0.3, karabas: true }); }
      LEVELS.push(lv);
    }
  }
  // Egitim: her mekanigi sirayla, yavaslatilmis ortamda gosterir (can gitmez)
  const TUTORIAL = { name: 'Eğitim', speed: 200, ramp: 0, cap: 0, react: [0.9, 0.9], len: [70, 84, 84], coins: 0.8, sameMax: 2, hunger: true, power: true, pal: 1, weather: 'clear', bars: 0, jets: 0, sticky: 0, ac: 0, crows: false, dogs: false };
  const TUTORIAL_SCRIPT = [
    { kind: 'spike', hint: ['Dokun!', 'Kedin zıplar. Süpürgelere ve ıslak borulara çarpma, üstünden atla.'] },
    { kind: 'spike' },
    { kind: 'gap', hint: ['Boşluk', 'Duvarın bittiği yerde zıpla, aşağı düşme! Düşersen bir can gider.'] },
    { kind: 'spike', fish: true, hint: ['Balık ye', 'Sol üstteki tokluk barını doldurur. Aç kalırsan can gider.'] },
    { kind: 'gap', fish: true },
    { kind: 'bar', hint: ['Çamaşır ipi', 'Altından koşarak geç. İpin altındayken zıplarsan takılırsın.'] },
    { kind: 'sign', hint: ['Kay!', 'Parmağını ekranda aşağı kaydır: kedin yere yatıp kayar. Tabelanın altından ancak böyle geçersin.'] },
    { kind: 'sign' },
    { kind: 'ledge', hint: ['Tente', 'Yukarıdaki tentelere zıpla, üstlerinde koşabilirsin. Balıklar orada!'] },
    { kind: 'jet', hint: ['Fıskiye', 'Açılıp kapanır. Açıkken üstünden atla, kapalıyken rahatça geç.'] },
    { kind: 'sticky', hint: ['Bal', 'Bala basınca yapışırsın. Zıplamak için iki kez dokun.'] },
    { kind: 'shaft', hint: ['Duvardan duvara!', 'Bina arasına girince kedin duvara tutunur. Dokun: karşı duvara zıplar. Hortumlara değmeden yukarı tırman, üstteki çatıya çık!'] },
    { kind: 'empty', hint: ['Pati zıplaması', 'Bu boşluk çok geniş! Zıpla, havadayken bir kez daha dokun. Sağ üstteki patileri harcar.'] },
    { kind: 'ac', hint: ['Klima', 'Geniş ama alçak. Biraz erken zıpla.'] },
    { kind: 'roomba', hint: ['Robot süpürge', 'Sana doğru gelir! Zamanlamayı iyi ayarla, üstünden atla.'] },
    { kind: 'power', hint: ['Güçlendirme', 'Kalkan, mıknatıs, balon, yaylı pati... Zıplayıp kap. Yolda sürpriz kutular da var!'] },
    { kind: 'spike', fish: true, trigger: 'crow', hint: ['Karga', 'Balık çalar. Balığı taşıyan kargaya zıplayıp değersen geri alırsın.'] },
    { kind: 'spike', trigger: 'dog', hint: ['Bekçi köpeği', 'Koşunun başında hep arkandadır, biraz sonra yorulup geride kalır. Bir yere takılırsan yine yetişir; yakınındayken bir daha takılırsan yakalar!'] },
    { kind: 'spike', fish: true }, { kind: 'gap' }, { kind: 'spike', fish: true }, { kind: 'spike' }, { kind: 'gap' }, { kind: 'spike' },
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
    strays: store.get('strays', {}), // kurtarilan sokak kedileri: { id: kac kez }
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
    catNames: store.get('catNames', {}), // oyuncunun kedilerine verdigi isimler
    welcomed: store.get('welcomed', false),
  };
  const KEYS = { stars: 'stars15', sound: 'sfx', music: 'music2' };
  const persist = (k) => store.set(KEYS[k] || k, save[k]);
  if (!DIFFS[save.diff]) save.diff = 'normal';
  save.owned = [...new Set(['sarman', ...save.owned.map((id) => OLD_CHAR[id] || id).filter((id) => CAT_BY_ID[id])])];
  save.char = OLD_CHAR[save.char] || save.char;
  if (!save.owned.includes(save.char)) save.char = 'sarman';
  if (save.resume && save.resume.v !== 5) save.resume = null; // yatay surume gecince eski yarim turlar gecersiz
  if (!/^[a-f0-9]{16}$/.test(save.playerId)) {
    save.playerId = Array.from({ length: 16 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    persist('playerId');
  }
  if (DEMO && DIFFS[params.get('diff')]) save.diff = params.get('diff');
  if (DEMO && CAT_BY_ID[params.get('cat')]) save.char = params.get('cat');
  if (DEMO && params.get('wear')) for (const id of params.get('wear').split(',')) if (COS_BY_ID[id]) save.wardrobe[COS_BY_ID[id].slot] = id;
  const catName = (id = save.char) => (save.catNames && save.catNames[id]) || (CAT_BY_ID[id] ? CAT_BY_ID[id].name : '');
  function genitive(name) { // Turkce iyelik eki: Sarman'ın, Pamuk'un, İrmik'in, Gece'nin
    const low = String(name).toLocaleLowerCase('tr'), vs = low.match(/[aeıioöuü]/g);
    const v = vs ? vs[vs.length - 1] : 'e';
    const suf = { a: 'ın', ı: 'ın', e: 'in', i: 'in', o: 'un', u: 'un', ö: 'ün', ü: 'ün' }[v];
    return name + '’' + (/[aeıioöuü]$/.test(low) ? 'n' : '') + suf;
  }
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
  const SOFT = { wall: 0.45, edge: 0.4, mark: 0.35, hose: 0.2, city: 0.15 };
  // binalarin kendi renkleri: krem, kum, soluk gul, acik gri-mavi (gunun saatine gore isikla karisir)
  const BUILD_TINTS = [[236, 224, 206], [226, 208, 182], [222, 204, 206], [204, 213, 222]].map((c) => c.join(','));
  let PAL_NUM = [];
  function buildPalettes() {
    const th = THEME_BY_ID[save.theme] || THEMES[0];
    PAL_NUM = PALETTES.map((p) => {
      const o = {};
      for (const k in p) {
        if (k === 'name') continue;
        if (typeof p[k] !== 'string') { o[k] = p[k]; continue; }
        const c = hexRgb(p[k]), m = th.mix[k];
        let cc = m ? c.map((v, i) => Math.round(v + (hexRgb(m[0])[i] - v) * m[1])) : c;
        if (SOFT[k]) { const lum = 0.3 * cc[0] + 0.59 * cc[1] + 0.11 * cc[2]; cc = cc.map((v) => Math.round(v + (lum - v) * SOFT[k])); } // daha soluk, goz yormayan tonlar
        o[k] = cc;
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
  const FAR_TILE = 720, MID_TILE = 960;
  const SKYLINE = [];
  for (let x = 0; x < FAR_TILE - 20;) {
    const w = Math.round(rand(24, 50)), h = Math.round(rand(40, 130)), lights = [];
    for (let ly = 10; ly < h - 8; ly += 12) for (let lx = 5; lx < w - 6; lx += 9) if (Math.random() < 0.3) lights.push([lx, ly]);
    SKYLINE.push({ x, w, h, lights });
    x += w + 3;
  }
  const MID = [];
  for (let x = 0; x < MID_TILE - 60;) {
    const w = Math.round(rand(70, 130)), h = Math.round(rand(110, 230));
    MID.push({ x, w, h, sh: [0.06, 0.12, -0.04, 0.0][MID.length % 4] });
    x += w + Math.round(rand(14, 60));
  }

  // Istanbul silueti: kubbeler, minareler, Galata Kulesi, deniz ve vapur
  const IST = [];
  { let x = 0; let k = 0;
    while (x < FAR_TILE - 40) {
      const kind = k === 2 ? 'galata' : (k % 3 === 0 ? 'cami' : 'ev');
      const w = kind === 'cami' ? 78 : kind === 'galata' ? 26 : Math.round(rand(20, 34));
      IST.push({ kind, x, w, h: kind === 'ev' ? Math.round(rand(26, 48)) : 0 });
      x += w + (kind === 'cami' ? 6 : 2); k++;
    }
  }
  function drawIstanbul(sy, off) {
    drawIstanbulSea(sy, off);
    drawIstanbulSkyline(sy, off);
  }
  function drawIstanbulSea(sy, off = 0) {
    const g = ctx;
    // deniz ve yavas giden vapur
    const sea = g.createLinearGradient(0, sy, 0, sy + 60);
    sea.addColorStop(0, `rgba(${P.skyBotA},0.95)`); sea.addColorStop(1, `rgba(${P.skyTopA},0.95)`);
    g.fillStyle = sea; g.fillRect(0, sy - 6, W, H);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(((i * 61 - off * 0.5) % W + W) % W, sy + 4 + (i % 3) * 10, 14, 1.5);
    const fx = ((clock * 9 - off * 0.3) % (W + 80) + W + 80) % (W + 80) - 40, fy = sy + 16;
    g.fillStyle = '#ffffff'; rr(g, fx - 18, fy - 6, 36, 8, 3); g.fill();
    g.fillStyle = '#3b3552'; g.fillRect(fx - 16, fy + 1, 32, 3);
    g.fillStyle = '#ffffff'; g.fillRect(fx - 8, fy - 11, 14, 5);
    g.fillStyle = '#d9534f'; g.fillRect(fx + 1, fy - 16, 4, 6);
  }
  function drawIstanbulSkyline(sy, off) {
    const g = ctx;
    const by = sy - 6; // siluet denizin ardinda
    for (const ox of [-off, FAR_TILE - off]) {
      if (ox > W || ox + FAR_TILE < 0) continue;
      g.save(); g.translate(ox, 0);
      g.fillStyle = P.city;
      for (const b of IST) {
        if (b.kind === 'ev') { g.fillRect(b.x, by - b.h, b.w, b.h); continue; }
        const cx = b.x + b.w / 2;
        if (b.kind === 'galata') {
          g.fillRect(cx - 10, by - 92, 20, 92);
          g.fillRect(cx - 12, by - 98, 24, 7);
          g.beginPath(); g.moveTo(cx - 12, by - 98); g.lineTo(cx, by - 128); g.lineTo(cx + 12, by - 98); g.closePath(); g.fill();
          continue;
        }
        g.fillRect(b.x + 8, by - 34, b.w - 16, 34);
        g.beginPath(); g.arc(cx, by - 34, 22, Math.PI, 0); g.fill();
        g.fillRect(cx - 1.5, by - 64, 3, 9);
        for (const s2 of [-1, 1]) {
          g.beginPath(); g.arc(cx + s2 * 22, by - 34, 10, Math.PI, 0); g.fill();
          const mx = cx + s2 * (b.w / 2 - 3);
          g.fillRect(mx - 2.5, by - 92, 5, 92);
          g.fillRect(mx - 3.5, by - 70, 7, 3);
          g.beginPath(); g.moveTo(mx - 2.5, by - 92); g.lineTo(mx, by - 108); g.lineTo(mx + 2.5, by - 92); g.closePath(); g.fill();
        }
      }
      if (P.stars > 0.05) { g.fillStyle = `rgba(${P.winA},0.5)`; for (const b of IST) if (b.kind === 'ev') for (let ly = 8; ly < b.h - 6; ly += 11) g.fillRect(b.x + 5, by - b.h + ly, 3, 4); }
      g.restore();
    }
  }

  // ================= Ekran olcekleme =================
  let H = 640, scale = 1, dpr = 1, safeTop = 0;
  let dprCap = 2, perfAcc = 0, perfN = 0; // yavas telefonda cizim cozunurlugu kendiliginden duser

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
    if (player && !run) camY = player.lastGy - (H * CAM_Y) / ZOOM;
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
  const SAMPLE_FILES = ['miyav1', 'miyav2', 'mirlama', 'havlama']; // havlama.mp3 varsa gercek kayit calar, yoksa kodla uretilir
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

  // Kopek havlamasi: buyuk bir bekci kopegi gibi kalin ve gur "HAV".
  // Alcak temel ses (gogus), hafif hirli titresim, "a/o" unlusu ve sert bir nefes baslangici.
  let barkCurve = null;
  function dogBark(delay = 0, pitch = 1) {
    const c = audio.ctx, t = c.currentTime + delay, d = 0.34;
    const p = 150 * pitch * (0.96 + Math.random() * 0.08);
    if (!barkCurve) { barkCurve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; barkCurve[i] = Math.tanh(x * 2.4); } }
    const mix = c.createGain(); mix.gain.value = 1;
    const mk = (type, mul, gain) => {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(p * 0.8 * mul, t);
      o.frequency.exponentialRampToValueAtTime(p * 1.3 * mul, t + 0.045);
      o.frequency.exponentialRampToValueAtTime(p * 0.72 * mul, t + d);
      const g = c.createGain(); g.gain.value = gain;
      o.connect(g).connect(mix); o.start(t); o.stop(t + d + 0.05);
    };
    mk('sawtooth', 1, 0.8);
    mk('sawtooth', 1.012, 0.5); // hafif ayri ikinci ses: kalin ve dolgun
    mk('sine', 0.5, 0.9);       // gogus rezonansi
    // hirli titresim (genlik modulasyonu)
    const rough = c.createGain(); rough.gain.value = 0.75;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 38; lg.gain.value = 0.25;
    lfo.connect(lg).connect(rough.gain); lfo.start(t); lfo.stop(t + d + 0.05);
    const shaper = c.createWaveShaper(); shaper.curve = barkCurve;
    mix.connect(rough).connect(shaper);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(1200, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.04); lp.frequency.exponentialRampToValueAtTime(650, t + d);
    for (const [f, q, gn] of [[430, 3, 1.1], [820, 4, 0.8], [1500, 5, 0.3]]) { // "a/o" unlusu
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * pitch; bp.Q.value = q;
      const gg = c.createGain(); gg.gain.value = gn;
      shaper.connect(bp).connect(gg).connect(lp);
    }
    const dry = c.createGain(); dry.gain.value = 0.35; shaper.connect(dry).connect(lp);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.62, t + 0.012);
    out.gain.setValueAtTime(0.62, t + 0.09);
    out.gain.exponentialRampToValueAtTime(0.0001, t + d);
    lp.connect(out).connect(audio.sfx);
    hiss(0.07, { freq: 900, q: 0.7, vol: 0.14, delay, attack: 0.003 }); // sert "h" baslangici
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
    jump() { hiss(0.17, { freq: 520, sweep: 1500, q: 0.6, vol: 0.075, attack: 0.01 }); tone(170, 0.05, { vol: 0.045, slide: 120 }); }, // yumusak hava sesi ve pati itisi
    land() { tone(105, 0.07, { vol: 0.075, slide: 70 }); hiss(0.05, { freq: 420, q: 0.7, vol: 0.045, type: 'lowpass' }); }, // yumusak pati inisi
    step() { hiss(0.028, { freq: 1100 + Math.random() * 500, q: 1.6, vol: 0.014 }); }, // cati ustunde hafif pati sesi
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
      if (playSample('mirlama', { vol: 0.9, rate: 1 })) return;
      const c = audio.ctx, t = c.currentTime; const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 26; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = c.createGain(); env(g, t, 0.18, 0.15, 1.2); o.connect(lp).connect(g).connect(audio.sfx); o.start(t); o.stop(t + 1.3); },
    bark() { if (playSample('havlama', { vol: 1, rate: jitter(0.03) })) return; dogBark(0); dogBark(0.34, 0.96); }, // gur, kalin "HAV HAV"
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
    slide() { hiss(0.32, { freq: 1600, sweep: 500, q: 0.8, vol: 0.09 }); },
    box() { [659, 880, 1109, 1319].forEach((f, i) => bell(f, 0.4, 0.06, i * 0.06)); },
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
    const target = state === 'hint' ? 0.08 : 0.24; // muzik efektleri bastirmasin
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

  // ---------- Kedi sesi: butun kediler ayni, dogal miyavi kullanir ----------
  const MEOW_SAMPLES = ['miyav1', 'miyav2']; // yeni miyav: ayni kedinin iki dogal kaydi
  const KIND_VOL = { normal: 0.8, short: 0.6, sad: 0.75, happy: 0.8 };
  function catVoice(kind = 'normal') {
    if (!playSample(pickOne(MEOW_SAMPLES), { vol: KIND_VOL[kind] || 0.8, rate: 1 })) catMeow(kind, 0, 1);
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
  let cityGain = null, citySrc = null, birdT = 4;
  function cityAmbience(dt) {
    const want = save.sound && !DEMO && audio.ctx && (state === 'play' || state === 'count');
    try {
      const c = audio.ctx;
      if (want && !citySrc) {
        citySrc = c.createBufferSource(); citySrc.buffer = audio.noise; citySrc.loop = true;
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
        cityGain = c.createGain(); cityGain.gain.setValueAtTime(0.0001, c.currentTime);
        cityGain.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 2);
        citySrc.connect(f).connect(cityGain).connect(audio.sfx);
        citySrc.start();
      } else if (!want && citySrc) {
        cityGain.gain.setValueAtTime(Math.max(0.0001, cityGain.gain.value), c.currentTime);
        cityGain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8);
        citySrc.stop(c.currentTime + 0.9); citySrc = null;
      }
      if (want && state === 'play' && P && P.stars < 0.2 && weather !== 'rain') {
        birdT -= dt;
        if (birdT <= 0) { // uzaktan, kisa bir kus civiltisi
          birdT = rand(6, 13);
          const f0 = rand(2600, 3400), n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) tone(f0 * (1 + (i % 2) * 0.12), 0.06, { vol: 0.012, slide: f0 * 1.25, delay: i * 0.11, attack: 0.004 });
        }
      }
    } catch { citySrc = null; }
  }
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
  let ledges = [], shafts = [], balloonT = 0, yayT = 0, press = null;
  let plats = [], trail = [], camX = 0, camY = 0, genX = 0, genY = 0, spawnDone = false;
  let zone = 0, bgZone = 0, bgFrom = 0, bgT = 1; // uretilen mekan; arka plan kedinin bastigi binanin mekanina yumusakca gecer
  let shieldHP = 0, magnetT = 0, slowT = 0, invulnT = 0, shieldHits = 0;
  let lives = 3, maxLives = 3, tokluk = 100, energy = 3, energyMax = 3, energyT = 0, stickTaps = 0;
  let combo = 0, comboT = 0, runT = 0, jetClock = 0, missionT = 0;
  let chase = null, crowT = 8, hintSlow = 0;
  let boss = null; // patron bolumunde: { kind, hp, max, atkT, i, beaten }
  let pattern = null, points = 0;
  let stats = null;
  let bgOff = 0, clock = 0, overAt = 0, countT = 0;
  let stage = 0, darkAmt = 0, darkTarget = 0, fogAmt = 0, weather = 'clear';
  const toastMsg = { text: '', sub: '', t: 0 };

  const MENU_STATES = ['menu', 'levels', 'chars', 'shop', 'missions', 'wardrobe', 'strays', 'board', 'settings', 'ach', 'photo'];
  const meters = () => Math.floor(dist / METER);
  const score = () => Math.floor(points) + bonus;
  const isRunMode = () => run && (run.mode === 'endless' || run.mode === 'daily');
  const stageMult = () => (isRunMode() ? Math.round((1 + 0.1 * stage) * 10) / 10 : 1);
  const isMenuState = () => MENU_STATES.includes(state);
  const permMult = () => 1 + Math.min(29, Math.floor((save.missions.completed || 0) / 3));
  const comboMult = () => Math.min(5, 1 + Math.floor(combo / 2));
  const diffOf = () => DIFFS[(run && run.diff) || save.diff];
  const fishValue = () => (1 + upg('balik')) * (catIs('benek') ? 2 : 1);
  const feedMult = () => (catIs('karamel') ? 1.5 : 1);
  const energyTime = () => (catIs('zeytin') ? 6 : 10);
  const hungerOn = () => !!(run && run.cfg.hunger) && (!DEMO || params.has('hunger'));
  const jetPhase = (o) => (jetClock + o.phase) % JET_PERIOD;
  const jetOn = (o) => jetPhase(o) < JET_PERIOD * 0.5;
  const jetWarn = (o) => !jetOn(o) && jetPhase(o) > JET_PERIOD - 0.5;
  const isTutorial = () => run && run.mode === 'tutorial';

  function progress() {
    if (!run) return 0;
    return run.mode === 'level' || run.mode === 'tutorial' ? (isFinite(run.goal) ? Math.min(1, dist / run.goal) : 0) : Math.min(1, dist / 20000);
  }
  // O anki mekaniklerin cikma olasiliklari
  function features() {
    if (run.mode !== 'endless' && run.mode !== 'daily') {
      const c = run.cfg;
      const lv = run.mode === 'level' ? run.level : 0;
      return { bars: c.bars, power: c.power, long: false, jets: c.jets, sticky: c.sticky, ac: c.ac, crows: c.crows, dogs: c.dogs,
        sign: c.sign !== undefined ? c.sign : run.mode === 'level' ? (lv >= 1 ? 0.14 : 0.06) : 0,
        roomba: c.roomba !== undefined ? c.roomba : run.mode === 'level' && lv >= 4 ? Math.min(0.25, 0.1 + lv * 0.01) : 0,
        ledge: c.ledge || 0, box: c.box || 0, shaft: c.shaft !== undefined ? c.shaft : run.mode === 'level' ? 0.14 : 0 };
    }
    const S = stageAt(stage), k = Math.max(0, stage - 1);
    return {
      bars: S.bars ? Math.min(0.45, 0.2 + 0.03 * k) : 0,
      power: true,
      long: !!S.long,
      jets: S.jets ? Math.min(0.3, 0.12 + 0.02 * k) : 0,
      sticky: S.sticky ? Math.min(0.3, 0.12 + 0.02 * k) : 0,
      ac: S.ac ? 0.25 : 0,
      crows: !!S.crows,
      dogs: !!S.dogs,
      sign: Math.min(0.28, 0.16 + 0.03 * stage),
      roomba: S.roomba ? Math.min(0.25, 0.1 + 0.025 * k) : 0,
      ledge: 0.5,
      shaft: Math.min(0.22, 0.13 + 0.02 * stage),
      box: 0.08,
    };
  }
  function toast(text, sub = '', t = 2) { toastMsg.text = text; toastMsg.sub = sub; toastMsg.t = t; }
  function floater(text, color = '#f6dcae') { // ekran koordinatinda, kedinin ustunde
    const by = SY(player.y) - 56;
    const minY = floaters.reduce((m, f) => Math.min(m, f.y), by + 20);
    floaters.push({ text, color, x: Math.min(W - 90, Math.max(90, SX(player.x) + 30)), y: Math.min(by, minY - 20), t: 1.1 });
  }

  // ================= Yan gorunum: dunya =================
  // Dunya koordinatlari: x saga dogru artar, y asagi dogru artar. Duvar ustleri (plats) y = yuzey.
  // Kedi kendi kendine saga kosar; dokununca ziplar, havada tekrar dokununca pati ziplamasi yapar.
  const SX = (wx) => (wx - camX) * ZOOM, SY = (wy) => (wy - camY) * ZOOM; // dunya -> ekran
  function reset() {
    player = { x: 0, y: 0, vy: 0, ground: true, coyote: 0, buffer: 0, squash: 0, wiggle: 0, stumble: 0, gait: 0, air: 0, lastGy: 0, pati: false, minClr: 0, slide: 0, dropSlide: false, ledge: null, shaft: null, wall: null, dir: 1, wallT: 0, camEase: 0 };
    ledges = []; shafts = []; balloonT = 0; yayT = 0;
    plats = [{ x0: -500, x1: 900, y: 0, s: 0, z: zone }];
    obstacles = []; coins = []; powerups = []; particles = []; floaters = []; crows = []; trail = [];
    camX = -CAT_SX / ZOOM; camY = -(H * CAM_Y) / ZOOM;
    speed = 250; dist = 0; bonus = 0; coinCount = 0; coinsSpawned = 0;
    genX = 900; genY = 0; spawnDone = false;
    shieldHP = 0; magnetT = 0; slowT = 0; invulnT = 0; shieldHits = 0;
    combo = 0; comboT = 0; runT = 0; jetClock = 0; missionT = 0; stickTaps = 0;
    chase = null; crowT = rand(7, 11); hintSlow = 0; boss = null;
    pattern = null; points = 0;
    stats = { fish: 0, near: 0, lines: 0, jets: 0, dashes: 0, powers: 0, livesLost: 0, cleanM: -1, dogs: 0, crows: 0, slides: 0, boxes: 0, ledges: 0, shafts: 0 };
    stage = 0; weather = 'clear';
  }

  function addCoin(x, y) { coins.push({ x, y, f: false }); coinsSpawned++; }
  // ziplama yayi: kalkistan t sn sonra kedinin yuksekligi (negatif = yukarida)
  const arcY = (t, v = JUMP_V) => -v * t + (GRAV * t * t) / 2;
  // dh kadar asagidaki (+) / yukaridaki (-) yuzeye inene kadar havada kalma suresi
  function airTime(dh, v = JUMP_V) { const disc = v * v + 2 * GRAV * dh; return disc < 0 ? 0 : (v + Math.sqrt(disc)) / GRAV; }
  function platAt(x) { for (const q of plats) if (x >= q.x0 && x <= q.x1) return q; return null; }
  const DECO = ['baca', 'anten', 'canak', 'depo', 'baca', 'kumes'];
  function addPlat(x0, x1, y) {
    const q = { x0, x1, y, s: Math.floor(rnd() * 4), deco: [], z: zone };
    const dk = zone ? ZONES[zone].deco : DECO;
    for (let x = x0 + 30 + rnd() * 80; x < x1 - 40; x += 150 + rnd() * 220) q.deco.push({ x, k: dk[Math.floor(rnd() * dk.length)], v: rnd() }); // arka planda, engel degil
    plats.push(q); genX = x1; genY = y; return q;
  }
  // ziplama yayi boyunca balik dizisi (kalkis x0, yuzey y)
  function fishArc(x0, y, n, step) { for (let i = 1; i <= n; i++) { const t = (i * step) / speed; addCoin(x0 + i * step, y + arcY(t) - 14); } }

  // Yeni parca: bosluk + duvar + ustundeki engeller ve baliklar. Her bosluk ve engel tek ziplamayla
  // (bosluk "empty" ise pati ziplamasiyla) gecilebilecek sekilde, hiz ve tepki suresine gore olculur.
  function spawn() {
    const cfg = run.cfg, df = diffOf(), d = progress();
    let item = null;
    if (run.script) {
      item = run.script.shift();
      if (!item) { addPlat(genX + 70, genX + 1500, genY); spawnDone = true; run.goal = genX - 900; return; }
    } else if (run.mode === 'level' && genX > run.goal - 700) {
      addPlat(genX + 80, run.goal + 1400, genY); spawnDone = true; return;
    }
    const F = features();
    const sp = speed;
    const react = Math.max(0.16, lerp(cfg.react[0], cfg.react[1], d) * df.react);
    const k = item ? item.kind : null;

    let pat = 'normal', announce = null;
    if (!item && isRunMode()) {
      if (!pattern || pattern.left <= 0) {
        const pool = PATTERNS.filter((p) => stage >= p.from);
        let r = rnd() * pool.reduce((s, p) => s + p.w, 0), chosen = pool[0];
        for (const p of pool) { r -= p.w; if (r <= 0) { chosen = p; break; } }
        pattern = { id: chosen.id, left: 3 + Math.floor(rnd() * 3) };
        announce = chosen.name || null;
      }
      pattern.left--;
      pat = pattern.id;
    }

    // yukseklik farki ve bosluk
    let dh = Math.round((rnd() * 2 - 1) * 42 - genY * 0.18); // tirmanmalardan sonra yavasca eski yukseklige iner
    if (pat === 'merdiven') dh = -28;
    if (item) dh = k === 'gap' ? 20 : 0;
    if (k === 'shaft' || (!item && pat === 'normal' && rnd() < F.shaft && run.lastShaft !== plats.length)) { buildShaft(item, sp); run.lastShaft = plats.length; return; }
    const ny = genY + Math.max(-70, Math.min(80, dh));
    dh = ny - genY;
    const reach = sp * airTime(dh);
    let gap;
    if (k === 'empty') gap = reach * 1.12; // pati ziplamasi gerekir
    else if (item) gap = k === 'gap' ? reach * 0.5 : 70;
    else {
      const hi = F.long ? 0.74 : lerp(0.5, 0.66, d);
      gap = Math.max(56, Math.min(reach * 0.72, reach * (0.3 + rnd() * (hi - 0.3))));
    }
    const gx0 = genX, x0 = genX + gap;
    let len;
    if (item) len = k === 'gap' || k === 'empty' ? 340 : 520;
    else if (pat === 'zigzag') len = 150 + rnd() * 90;
    else if (pat === 'merdiven') len = 230 + rnd() * 60;
    else len = Math.round(grand(lerp(480, 420, d), lerp(1050, 1150, d)) * Math.max(1, sp / 250)); // hizlandikca duvarlar uzar, engel sigar
    const pl = addPlat(x0, x0 + len, ny);
    if (announce) obstacles.push({ type: 'mark', x: gx0, y: genY, w: 1, h: 1, announce });
    if (k === 'gap' || k === 'empty') obstacles.push({ type: 'mark', x: gx0 - 30, y: pl.y, w: 1, h: 1, hint: item.hint });
    // bosluk ustunde balik yayi
    if ((k !== 'empty' && rnd() < cfg.coins * 0.8) || (item && item.fish && (k === 'gap'))) {
      const t = airTime(dh), n = 4;
      fishArc(gx0 - sp * 0.08, genY - dh, n, (sp * t * 0.9) / (n + 1));
    }

    // engeller
    const slots = [];
    const flight = sp * airTime(0);
    const spacing = flight * 0.95 + sp * react + 30;
    const a0 = x0 + Math.max(flight + 40, sp * react + 60), a1 = x0 + len - flight * 0.9 - sp * react - 30; // engelden sonra duvar bitmeden tepki payi
    // tente (ust rota): yukarida balik ve odul, altinda ip/tabela olmaz
    let led = null;
    if ((k === 'ledge' || pat === 'tente' || (!item && len > 400 && rnd() < F.ledge)) && a1 - a0 > 90) {
      const lx0 = a0 - 20 + rnd() * 40, lw = Math.min(a1 - lx0 + flight * 0.5, 190 + rnd() * 150);
      led = { x0: lx0, x1: lx0 + lw, y: ny - LEDGE_UP, c: Math.floor(rnd() * 3), z: zone };
      ledges.push(led);
      if (k === 'ledge' && item.hint) obstacles.push({ type: 'mark', x: led.x0 - 90, y: ny, w: 1, h: 1, hint: item.hint });
      for (let x = led.x0 + 22; x < led.x1 - 14; x += 34) addCoin(x, led.y - 16);
      if (rnd() < F.box * 2.5 || (item && item.fish)) powerups.push({ kind: 'box', x: led.x1 - 30, y: led.y - 18 });
    }
    if (item) {
      if (['spike', 'bar', 'jet', 'sticky', 'ac', 'power', 'sign', 'roomba'].includes(k)) slots.push(lerp(a0, a1, k === 'roomba' ? 0.7 : 0.45));
    } else if (pat !== 'zigzag' && pat !== 'balik') {
      // ilerledikce engeller sik ve art arda gelir
      for (let x = a0 + rnd() * 60; x < a1; x += spacing * (1 + rnd() * lerp(0.75, 0.1, d))) slots.push(x);
    }
    if (!item && !led && rnd() < F.box) powerups.push({ kind: 'box', x: x0 + len * 0.5, y: ny + arcY(0.28) + 4 });
    // kayip yavru: inis alaninda, engellerden once oturur (en fazla ~200 m'de bir)
    if (!item && run.mode !== 'tutorial' && len > 420 && a0 - x0 > 90 && x0 > (run.nextStrayX || 2400) && rnd() < 0.14) {
      const pool = STRAYS.filter((st) => st.z === zone), fresh = pool.filter((st) => !save.strays[st.id]);
      const pick = fresh.length && rnd() < 0.75 ? fresh : pool;
      powerups.push({ kind: 'stray', id: pick[Math.floor(rnd() * pick.length)].id, x: lerp(x0, a0, 0.62), y: ny - 10 });
      run.nextStrayX = x0 + 200 * METER;
    }
    let lastSafeEnd = x0 + 20;
    for (const sx of slots) {
      if (!item && led && sx > led.x1 - 40 && sx < led.x1 + flight * 0.85) continue; // tenteden inen kedinin onu bos kalsin
      let type;
      if (item) type = k === 'spike' ? 'spike' : k;
      else if (pat === 'tabela') type = 'sign';
      else if (pat === 'filo') type = rnd() < 0.75 ? 'roomba' : 'spike';
      else { // agirlikli secim: her engel turu kendi oraninda gelir
        const W8 = [['spike', 1], ['bar', F.bars * 1.3], ['jet', F.jets * 1.3], ['sticky', F.sticky], ['ac', F.ac * 1.2], ['sign', F.sign * 2.2], ['roomba', F.roomba * 3.2], ['power', F.power ? 0.14 : 0]];
        let r = rnd() * W8.reduce((a, w) => a + w[1], 0);
        type = 'spike';
        for (const [t, w] of W8) { r -= w; if (r <= 0) { type = t; break; } }
      }
      const underLedge = led && sx + 140 > led.x0 && sx - 20 < led.x1;
      if (!item && underLedge && (type === 'bar' || type === 'sign')) type = 'spike';
      if (!item && type === 'roomba' && sx - 80 < a0) type = 'spike'; // supurge iniş alanina girmesin
      let ob;
      if (type === 'spike') {
        const skin = rnd() < 0.5 ? 'vacuum' : 'pipe';
        ob = skin === 'vacuum' ? { type: 'spike', skin, x: sx, y: ny, w: 22, h: 34 } : { type: 'spike', skin, x: sx, y: ny, w: 18, h: 30 + Math.round(rnd() * 12) };
      } else if (type === 'ac') ob = { type: 'spike', skin: 'ac', x: sx, y: ny, w: 46, h: 30 };
      else if (type === 'bar') ob = { type: 'bar', x: sx, y: ny, w: 96 + Math.round(rnd() * 30), h: BAR_HIGH, v: Math.floor(rnd() * 3) };
      else if (type === 'jet') ob = { type: 'jet', x: sx, y: ny, w: JET_W, h: JET_H, phase: rnd() * JET_PERIOD };
      else if (type === 'sticky') ob = { type: 'sticky', x: sx - 40, y: ny, w: 120, h: 4 };
      else if (type === 'sign') ob = { type: 'sign', x: sx, y: ny, w: 34, h: 150, v: Math.floor(rnd() * 3) };
      else if (type === 'roomba') ob = { type: 'roomba', x: sx + 60, y: ny, w: 28, h: 13, vx: -ROOMBA_V };
      else { // guclendirme: ziplayinca kapilir
        const kinds = ['magnet', 'slow', 'balon', 'yay'];
        if (shieldHP <= 0) kinds.push('shield');
        if (hungerOn() || energy < energyMax) kinds.push('mama');
        powerups.push({ kind: k === 'power' ? 'shield' : kinds[Math.floor(rnd() * kinds.length)], x: sx, y: ny + arcY(0.3) + 4 });
        ob = { type: 'mark', x: sx - 60, y: ny, w: 1, h: 1 };
      }
      if (item && item.hint) ob.hint = item.hint;
      if (item && item.trigger) ob.trigger = item.trigger;
      ob.z = zone;
      obstacles.push(ob);
      if (DEMO) { const kk = ob.type + (ob.skin || ''); spawnTally[kk] = (spawnTally[kk] || 0) + 1; }
      // engel ustunde balik yayi ya da engeller arasinda balik dizisi
      if ((ob.type === 'spike' || ob.type === 'roomba') && !underLedge && (rnd() < cfg.coins * 0.55 || (item && item.fish))) fishArc(sx - flight * 0.45, ny, 3, flight * 0.22);
      else if (ob.type === 'sign' && rnd() < cfg.coins) for (let x = sx - 30; x < sx + 70; x += 26) addCoin(x, ny - 9); // tabelanin altinda alcak baliklar
      else if (ob.type !== 'bar' && rnd() < cfg.coins * 0.5) for (let x = lastSafeEnd + 40; x < sx - 60; x += 42) addCoin(x, ny - 16);
      if (ob.type === 'bar' && (rnd() < cfg.coins * 0.7 || (item && item.fish))) for (let x = sx + 10; x < sx + ob.w - 5; x += 34) addCoin(x, ny - 16); // ipin altinda
      lastSafeEnd = sx + (ob.w || 0) + flight * 0.4;
    }
    if (pat === 'balik' || (!slots.length && rnd() < cfg.coins)) for (let x = x0 + 50; x < x0 + len - 50; x += 40) addCoin(x, ny - 16);
  }

  // Bina arasi: onceki cati arali gin icine uzar (zemin), sag duvar ust binanin cephesi, sol duvarin altinda gecit vardir.
  function buildShaft(item, sp) {
    const A = plats[plats.length - 1];
    const w = Math.round(124 + rnd() * 18), hgt = Math.round(230 + rnd() * 120 + Math.min(120, stage * 25));
    const x0 = A.x1 + 50, x1 = x0 + w;
    A.x1 = x1; // zemin gecidin ve araligin altinda devam eder
    const yb = A.y, yt = A.y - hgt;
    const sh = { x0, x1, yb, yt, haz: [] };
    // duvarlardaki tehlikeler: hep bir taraf bos kalir, kayarak beklenebilir
    let side = rnd() < 0.5 ? 0 : 1;
    for (let y = yb - 110 - rnd() * 30; y > yt + 70; y -= 95 + rnd() * 45) {
      if (rnd() < 0.78 || item) sh.haz.push({ side, y0: y - 30 - rnd() * 14, y1: y, kind: rnd() < 0.5 ? 'hose' : 'pipe' });
      side = rnd() < 0.65 ? 1 - side : side;
    }
    for (let y = yb - 70; y > yt + 30; y -= 52) addCoin((x0 + x1) / 2 + (Math.floor((yb - y) / 52) % 2 ? -18 : 18), y);
    if (item && item.hint) obstacles.push({ type: 'mark', x: x0 - 140, y: yb, w: 1, h: 1, hint: item.hint });
    shafts.push(sh);
    const len = Math.round(grand(520, 900) * Math.max(1, sp / 250));
    addPlat(x1, x1 + len, yt);
  }

  // ================= Kopek: Subway usulu kovalama =================
  // Her kosunun basinda 8-10 sn arkandan kosar, sonra yorulup geride kalir. Bir yere takilinca yine yetisir;
  // yakindayken bir daha takilirsan yakalar (bir can gider). Kedinin gectigi yolu izler, o nereden ziplarsa o da oradan ziplar.
  function startChase(why, gap0) {
    const fresh = !chase;
    if (fresh) chase = { gap: gap0 !== undefined ? gap0 : DOG_AWAY, phase: 'near', t: 0, dur: rand(8, 10), barkT: 0.25, hav: 0, lunge: 0 };
    else { chase.phase = 'near'; chase.t = 0; chase.dur = rand(8, 10); chase.barkT = Math.min(chase.barkT, 0.25); }
    if (why) toast('Bekçi köpeği peşinde!', why, 1.8);
  }
  const dogNear = () => !!(chase && chase.phase === 'near' && chase.gap < 190 && !player.shaft); // kopek tirmanamaz
  function updateChase(dt, wdt) {
    if (!chase) return;
    const karabas = !!(run && run.cfg.dogsAll);
    chase.hav = Math.max(0, chase.hav - dt);
    chase.lunge = Math.max(0, chase.lunge - dt);
    if (chase.phase === 'near') {
      chase.t += wdt;
      if (!karabas && chase.t >= chase.dur) {
        chase.phase = 'away';
        stats.dogs++;
        bonus += 40;
        floater('Köpek yoruldu, geride kaldı! +40', '#c9d8ea');
        sfx('escape');
      }
    }
    const target = chase.phase === 'near' ? (karabas ? DOG_NEAR + 26 : DOG_NEAR) : DOG_AWAY;
    const rate = chase.phase === 'near' ? (chase.gap > 220 ? 330 : 70) : 75; // yetisirken hizli, geride kalirken yavas
    chase.gap += Math.max(-rate * wdt, Math.min(rate * wdt, target - chase.gap));
    if (chase.phase === 'away' && chase.gap >= DOG_AWAY - 1) { chase = null; return; }
    if (chase.gap < 260) {
      chase.barkT -= dt;
      if (chase.barkT <= 0) { chase.barkT = rand(3, 4.5); if (!boss || boss.kind === 'karabas') { chase.hav = 0.6; sfx('bark'); } }
    }
  }
  // ---------- Patron ----------
  function updateBoss(dt) {
    if (!boss || boss.beaten || state !== 'play') return;
    boss.swoop = Math.max(0, boss.swoop - dt);
    const B = BOSSES[boss.kind];
    if (!B.attacks.length || player.shaft || balloonT > 0) return;
    boss.atkT -= dt;
    if (boss.atkT > 0) return;
    // saldiri: ekranin sag kenarinda, kedinin onundeki catiya. Engellerden ve duvar ucundan uzak olmali.
    const x = camX + VW - 26, q = platAt(x), flight = speed * airTime(0);
    const clear = q && !player.ledge && q.x1 - x > flight + 50 && x - q.x0 > 40 &&
      !obstacles.some((o) => o.type !== 'mark' && o.x < x + flight + 40 && o.x + o.w > x - flight - 40) &&
      !ledges.some((l) => l.x1 > x - 140 && l.x0 < x + 60) && !shafts.some((sh) => sh.x0 < x + flight + 60 && sh.x1 > x - 60);
    if (!clear) { boss.atkT = 0.3; return; } // uygun yer yok: biraz sonra dene
    const kind = B.attacks[boss.i++ % B.attacks.length];
    const o = kind === 'drop' ? { type: 'spike', skin: 'boss', x, y: q.y, w: 26, h: 26 } : { type: 'sign', x, y: q.y, w: 34, h: 150 };
    o.boss = boss.kind; o.atk = kind; o.t0 = clock; o.z = q.z || 0;
    obstacles.push(o);
    boss.swoop = 0.9;
    sfx(kind === 'drop' ? 'land' : 'ui');
    const df = diffOf();
    boss.atkT = rand(2.4, 3.6) * (df.react > 1 ? 1.25 : df.react < 1 ? 0.88 : 1);
  }
  function bossHurt() {
    if (!boss || boss.beaten) return;
    boss.hp--;
    const B = BOSSES[boss.kind];
    if (boss.hp > 0) { floater(`${B.name} yoruluyor! ${boss.hp}/${boss.max}`, '#f2c98a'); return; }
    boss.beaten = true;
    if (chase) chase.phase = 'away';
    coinCount += 30; bonus += 250; stats.bosses = (stats.bosses || 0) + 1;
    toast(B.beat, 'Patronu yendin! +30 balık · +250 puan', 3);
    burst(player.x, player.y - 30, COIN, 14, 180);
    sfx('escape'); sfx('meowShort'); vibrate(60);
    obstacles = obstacles.filter((o) => !o.boss || o.x < player.x); // bekleyen saldirilar kalkar
  }

  // kopegin dunyadaki yeri: kedinin izinden, chase.gap kadar geride
  function trailAt(x) {
    if (!trail.length) return { y: player.y, air: false };
    if (x <= trail[0].x) return trail[0];
    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i - 1], b = trail[i];
      if (x >= a.x) { const k = b.x > a.x ? (x - a.x) / (b.x - a.x) : 0; return { y: lerp(a.y, b.y, k), air: a.air || b.air, vy: a.vy }; }
    }
    return trail[trail.length - 1];
  }

  function updateCrows(dt) {
    const F = features();
    if (F.crows && !isTutorial()) crowT -= dt;
    if (crowT <= 0) {
      crowT = rand(8, 14);
      const targets = coins.filter((c) => !c.taken && !c.claimed && c.x > player.x + 170 && c.x < camX + VW + 30);
      if (targets.length) {
        const c = targets[Math.floor(Math.random() * targets.length)];
        c.claimed = true;
        crows.push({ x: camX + VW + 30, y: c.y - 120, dir: -1, state: 'in', target: c, fish: false, flap: 0 });
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
        const sp = 300 * dt;
        if (d < 10) {
          t.taken = true; t.stolen = true; coinsSpawned--;
          k.fish = true; k.state = 'out';
          sfx('caw');
        } else { k.x += (dx / d) * Math.min(sp, d); k.y += (dyy / d) * Math.min(sp, d); }
      } else {
        k.x += 60 * dt; // dunya kayarken geriye ve yukari kacar
        k.y -= 90 * dt;
      }
      // kedi havada kargaya deyince baligi geri alir
      if (k.fish && !player.ground && Math.hypot(k.x - player.x, k.y - (player.y - 14)) < 26) {
        k.fish = false;
        coinCount += 2; stats.fish += 2; stats.crows++; bonus += 20;
        tokluk = Math.min(100, tokluk + 18);
        floater('Kargadan balığı kaptın! +2', COIN);
        burst(k.x, k.y, '#4a4a55', 6, 120);
        sfx('coin');
      }
    }
    crows = crows.filter((k) => k.x > camX - 60 && k.x < camX + VW + 80 && k.y > camY - 120);
  }

  // ================= Kedi hareketi =================
  function nearMiss(text) {
    combo++;
    comboT = 3;
    stats.near++;
    const m = comboMult();
    bonus += 5 * m * (catIs('benekli') ? 2 : 1);
    floater(m > 1 ? `${text || 'Kıl payı!'} x${m}` : text || 'Kıl payı!');
    sfx('near');
  }
  function onSticky() {
    if (!player.ground) return false;
    for (const o of obstacles) if (o.type === 'sticky' && player.x > o.x && player.x < o.x + o.w) return true;
    return false;
  }

  function jump() {
    const p = player;
    if (p.shaft) { // bina arasinda: duvardan karsi duvara
      if (p.wall !== null || p.ground) {
        p.dir = p.wall === 1 ? -1 : 1;
        if (p.ground && p.wall === null) p.dir = 1;
        p.wall = null; p.ground = false;
        p.vy = -WJ_V * (yayT > 0 ? 1.15 : 1);
        sfx('jump');
        burst(p.x + (p.dir < 0 ? 10 : -10), p.y - 12, 'rgba(220,215,205,0.55)', 3, 50);
      } else p.buffer = 0.16;
      return;
    }
    if (p.ground || p.coyote > 0) {
      if (onSticky() && stickTaps < 1) {
        stickTaps++;
        p.wiggle = 1;
        floater('Bala yapıştın! Tekrar dokun', '#e9c46a');
        sfx('sticky');
        return;
      }
      stickTaps = 0;
      p.jLedge = p.ledge;
      p.ground = false; p.coyote = 0; p.air = 0; p.pati = false; p.slide = 0; p.ledge = null;
      p.vy = -JUMP_V * (weather === 'rain' ? 0.95 : 1) * (yayT > 0 ? 1.28 : 1);
      p.jx = p.x; p.jy = p.y;
      burst(p.x - 6, p.y, 'rgba(220,215,205,0.55)', 3, 50);
      sfx('jump');
      return;
    }
    if (balloonT > 0) return;
    if (!p.pati && energy >= 1) { dash(); return; }
    p.buffer = 0.16; // inise yakin dokunusu kacirma
  }
  // Kayma: yerde yere yatip kayar (alcak tabelalarin altindan gecer); havada hizla iner ve inince kayar
  function slide() {
    const p = player;
    if (balloonT > 0 || p.shaft) return;
    if (p.ground) {
      if (p.slide <= 0.05) { sfx('slide'); stats.slides++; burst(p.x - 8, p.y, 'rgba(220,215,205,0.6)', 4, 60); }
      p.slide = SLIDE_T; p.buffer = 0;
    } else {
      p.vy = Math.max(p.vy, 820); p.dropSlide = true; p.buffer = 0;
    }
  }

  // Pati ziplamasi: havada ikinci kez zipla (enerji harcar)
  function dash() {
    energy--;
    stats.dashes++;
    player.pati = true;
    player.vy = -PATI_V;
    floater('Pati!', '#c9d8ea');
    burst(player.x, player.y - 10, 'rgba(220,225,235,0.7)', 5, 90);
    sfx('dash');
  }

  function respawn() { // dustukten sonra bir sonraki duvarin basina konur
    player.shaft = null; player.wall = null;
    const pl = plats.find((q) => q.x1 > player.x + 60);
    if (!pl) return;
    player.x = Math.max(pl.x0 + 26, player.x);
    player.y = player.lastGy = pl.y;
    player.vy = 0; player.ground = true; player.pati = false; player.buffer = 0; player.slide = 0; player.ledge = null; player.dropSlide = false;
    obstacles = obstacles.filter((o) => o.type === 'mark' || o.type === 'sticky' || o.x + o.w < player.x - 30 || o.x > player.x + speed * 1.1);
    trail = [];
  }

  function updatePlayer(dt, wdt) {
    const p = player;
    p.squash = Math.max(0, p.squash - dt * 5);
    p.wiggle = Math.max(0, p.wiggle - dt * 3);
    p.stumble = Math.max(0, p.stumble - dt);
    p.slide = Math.max(0, p.slide - wdt);
    if (p.shaft) { updateShaft(dt, wdt); return; }
    // bina arasina giris: sag duvara gelince tutunur
    for (const sh of shafts) {
      if (p.x + CAT_HW >= sh.x1 && p.x < sh.x1 && p.y > sh.yt + 4) {
        p.shaft = sh; p.wall = 1; p.ground = false; p.ledge = null; p.slide = 0; p.vy = 0; p.wallT = 0; p.x = sh.x1 - 13; p.pati = false;
        if (chase && chase.phase === 'near' && !(run && run.cfg.dogsAll)) chase.phase = 'away';
        if (!run.shaftSeen) { run.shaftSeen = true; toast('Duvardan duvara!', 'Dokun: karşı duvara zıpla. Hortumlara değme!', 1.8); }
        sfx('land');
        return;
      }
    }
    const sp = speed * (p.stumble > 0 ? 0.7 : 1) * (onSticky() ? 0.8 : 1);
    const dx = sp * wdt;
    p.x += dx;
    const g0 = Math.floor(p.gait * 2);
    p.gait += dx / (p.ground ? 58 : 80);
    if (p.ground && p.slide <= 0 && Math.floor(p.gait * 2) !== g0 && state === 'play') sfx('step');
    if (balloonT > 0) { // balon: catilarin ustunde suzulur
      balloonT -= wdt;
      const ys = [platAt(p.x), platAt(p.x + 90), platAt(p.x + 180)].filter(Boolean).map((q) => q.y); // onundeki yuksek binayi onceden gor
      if (ys.length) p.lastGy = Math.min(...ys);
      p.ground = false; p.ledge = null; p.vy = 0; p.slide = 0;
      p.y += (p.lastGy - 128 - p.y) * Math.min(1, wdt * 2.5);
      if (balloonT <= 0) { if (!platAt(p.x + 30) || !platAt(p.x + 140)) balloonT = 0.05; else { invulnT = Math.max(invulnT, 1.2); floater('Balon söndü', '#ec8fa6'); } }
      trail.push({ x: p.x, y: p.y, air: true, vy: 0 });
      while (trail.length > 2 && trail[1].x < p.x - DOG_AWAY - 40) trail.shift();
      return;
    }
    if (p.ground) {
      if (p.ledge) {
        if (p.x > p.ledge.x1 + 2) { p.ledge = null; p.ground = false; p.coyote = 0.09; p.vy = 0; p.air = 0; p.pati = false; }
        else p.y = p.ledge.y;
      } else {
        const pl = platAt(p.x);
        if (!pl) { p.ground = false; p.coyote = 0.11; p.vy = 0; p.air = 0; p.pati = false; }
        else { p.y = pl.y; p.lastGy = pl.y; }
      }
    }
    if (!p.ground) {
      p.coyote -= wdt;
      p.air += wdt;
      const prevY = p.y;
      p.vy += GRAV * wdt;
      p.y += p.vy * wdt;
      const lg = p.vy > 0 ? ledges.find((l) => p.x >= l.x0 - 4 && p.x <= l.x1 + 2 && prevY <= l.y + 2 && p.y >= l.y) : null;
      const pl = platAt(p.x) || platAt(p.x + 8);
      if (lg) { // tenteye inis
        p.y = lg.y; p.vy = 0; p.ground = true; p.ledge = lg; p.lastGy = lg.y; p.pati = false;
        p.squash = 1; stickTaps = 0; stats.ledges++;
        sfx('land');
        if (p.dropSlide) { p.dropSlide = false; p.slide = SLIDE_T; }
        if (p.buffer > 0) { p.buffer = 0; jump(); }
      } else if (pl && p.vy > 0 && prevY <= pl.y + 2 && p.y >= pl.y) { // inis
        p.y = pl.y; p.vy = 0; p.ground = true; p.lastGy = pl.y; p.pati = false;
        p.squash = 1; stickTaps = 0;
        sfx('land');
        burst(p.x - 4, p.y, 'rgba(220,215,205,0.5)', 3, 60);
        if (p.dropSlide) { p.dropSlide = false; p.slide = SLIDE_T; stats.slides++; sfx('slide'); }
        if (p.buffer > 0) { p.buffer = 0; jump(); }
      } else if (pl && p.y > pl.y + 6) { // duvarin on yuzune carpti: yuzeyden asagi kayar
        p.x = Math.min(p.x, pl.x0 - 4);
      }
      if (p.buffer > 0) p.buffer -= wdt;
      if (p.y > p.lastGy + 150) {
        if (DEMO) { const a = plats.filter((q) => q.x1 < p.x).pop(), b = plats.find((q) => q.x0 > (a ? a.x1 : p.x)); dbg = `[jx${Math.round((p.jx || 0) - (a ? a.x1 : 0))} gap${a && b ? Math.round(b.x0 - a.x1) : '?'} dh${a && b ? b.y - a.y : '?'} sp${Math.round(speed)} pati${p.pati ? 1 : 0} en${energy} w${weather}]`; }
        respawn(); hit('fall'); return;
      }
    }
    // kopek bu izi takip eder (bina arasinda kopek tirmanamaz, geride kalir)
    trail.push({ x: p.x, y: p.y, air: !p.ground, vy: p.vy });
    while (trail.length > 2 && trail[1].x < p.x - DOG_AWAY - 40) trail.shift();
  }

  // Bina arasinda tirmanma: duvarda yavasca kayar, dokununca karsi duvara capraz ziplar; ust catiya varinca cikar.
  function updateShaft(dt, wdt) {
    const p = player, sh = p.shaft;
    const L = sh.x0 + 13, Rr = sh.x1 - 13;
    const y0 = p.y;
    if (p.wall !== null) {
      p.wallT += wdt;
      p.vy = Math.min(WALL_SLIDE, p.vy + 300 * wdt);
      p.y += p.vy * wdt;
      if (p.y >= sh.yb) { p.y = sh.yb; p.vy = 0; if (p.wall === 0) { p.wall = null; p.ground = true; } }
      if (p.wall === 1 && p.y < sh.yt + 26) { exitShaft(); return; }
      if (p.buffer > 0) { p.buffer = 0; jump(); }
    } else if (p.ground) { // aralik zemininde saga kosar, duvara gelince tutunur
      p.x += speed * 0.6 * wdt; p.gait += (speed * 0.6 * wdt) / 58;
      if (p.x >= Rr) { p.x = Rr; p.wall = 1; p.ground = false; p.wallT = 0; }
      if (p.buffer > 0) { p.buffer = 0; jump(); }
    } else {
      p.x += p.dir * WJ_VX * wdt;
      p.vy += GRAV * wdt;
      p.y += p.vy * wdt;
      p.gait += wdt * 3;
      if (p.y >= sh.yb) { p.y = sh.yb; p.vy = 0; p.ground = true; p.squash = 1; sfx('land'); }
      if (p.dir > 0 && p.x >= Rr) {
        if (p.y <= sh.yt + 6) { exitShaft(); return; }
        p.x = Rr; p.wall = 1; p.vy = 0; p.wallT = 0; p.squash = 1; sfx('land');
      } else if (p.dir < 0 && p.x <= L) {
        p.x = L;
        if (p.y < sh.yb - PASSAGE_H) { p.wall = 0; p.vy = 0; p.wallT = 0; p.squash = 1; sfx('land'); }
      }
      if (p.buffer > 0 && p.wall !== null) { p.buffer = 0; jump(); }
      if (p.buffer > 0) p.buffer -= wdt;
    }
    if (y0 > p.y) points += ((y0 - p.y) / METER) * 0.6 * stageMult() * permMult(); // tirmanmak da puan kazandirir
    // duvardaki hortum ve borular
    if (invulnT <= 0 && balloonT <= 0) {
      const near = p.x <= L + 6 ? 0 : p.x >= Rr - 6 ? 1 : -1;
      for (const h of sh.haz) {
        if (h.side !== near) continue;
        if (p.y - 22 + diffOf().hit < h.y1 && p.y - diffOf().hit > h.y0) {
          p.wall = null; p.ground = false; p.vy = 60; p.dir = near === 1 ? -1 : 1;
          hit(h.kind === 'pipe' ? 'pipe' : 'spike');
          break;
        }
      }
    }
  }
  function exitShaft() {
    const p = player, sh = p.shaft;
    p.shaft = null; p.wall = null;
    p.x = sh.x1 + 8; p.y = p.lastGy = sh.yt; p.vy = 0; p.ground = true; p.squash = 1; p.pati = false;
    p.camEase = 2.5;
    stats.shafts++;
    bonus += 25;
    floater('Tırmandın! +25', '#c9d8ea');
    sfx('land'); sfx('meowShort');
    trail = [];
  }
  function aabb(ax0, ay0, ax1, ay1, bx0, by0, bx1, by1) { return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0; }

  function burst(x, y, color, n, sp) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(sp * 0.3, sp);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, life: rand(0.35, 0.8), color, size: rand(2, 4), g: 300 });
    }
  }

  // Demo botu: engelin hemen onunde, duvarin kenarinda ve acik fiskiyede ziplar; camasir ipinin altinda ziplamaz.
  function bot() {
    const p = player;
    if (p.shaft) { // karsi duvarda varis yuksekliginde tehlike yoksa zipla
      if (p.wall === null && !p.ground) return;
      const target = p.wall === 1 ? 0 : 1, ay = p.y - 62;
      const bad = !!p.shaft && p.shaft.haz.some((h) => h.side === target && ay - 22 < h.y1 + 6 && ay > h.y0 - 6);
      const mine = p.shaft.haz.some((h) => h.side === p.wall && p.y - 20 < h.y1 + 6 && p.y + 30 > h.y0);
      if ((!bad || mine || p.wallT > 1.4) && (p.wallT > 0.08 || p.ground)) jump();
      return;
    }
    if (!p.ground) {
      if (p.vy > 120 && !platAt(p.x + 24) && p.y > p.lastGy - 6 && energy > 0 && !p.pati) jump();
      return;
    }
    if (onSticky() && stickTaps > 0) { jump(); return; }
    if (balloonT > 0) return;
    const look = speed * 0.13 + CAT_HW;
    for (const o of obstacles) { // tabela: kay
      if (o.type === 'sign' && o.x + o.w > p.x - CAT_HW && o.x < p.x + speed * 0.3 && p.slide < 0.25) { slide(); return; }
    }
    if (p.ledge && p.ledge.x1 - p.x < speed * 0.05 + 6) { const q = platAt(p.ledge.x1 + 40); if (!q) { jump(); return; } }
    const pl = platAt(p.x);
    if (!p.ledge && pl && pl.x1 - p.x < speed * 0.05 + 6) { jump(); return; } // duvar bitiyor
    for (const o of obstacles) {
      if ((o.type === 'bar' || o.type === 'sign') && o.x + o.w > p.x - CAT_HW && o.x < p.x + speed * 0.7) return; // ip ya da tabela yakinda: ziplama
    }
    for (const o of obstacles) {
      const fl = speed * airTime(0) * (yayT > 0 ? 1.28 : 1), trig = Math.max(CAT_HW + 4, Math.min(look, fl - o.w - CAT_HW - 8)) + (o.type === 'roomba' ? ROOMBA_V * 0.15 : 0);
      if (o.x + o.w < p.x - CAT_HW || o.x > p.x + trig) continue;
      if (p.ledge && o.y > p.y + 20) continue; // tentedeyken alttaki engeller onemsiz
      if (o.type === 'spike' || o.type === 'roomba' || (o.type === 'jet' && (jetOn(o) || jetWarn(o)))) {
        if (params.has('clumsy') && o.botSkip === undefined) o.botSkip = Math.random() < 0.25; // test: ara sira engeli kacirir
        if (o.botSkip) continue;
        jump(); return;
      }
    }
  }

  // kayip yavruyu kurtar: ilk kez bulunca +25 balik, bir mekanin dordu de bulununca +100
  function rescueStray(p) {
    const s = STRAY_BY_ID[p.id], first = !save.strays[p.id];
    save.strays[p.id] = (save.strays[p.id] || 0) + 1;
    persist('strays');
    stats.strays = (stats.strays || 0) + 1;
    burst(p.x, p.y, '#f6c35b', 10, 130);
    sfx('meowHappy'); vibrate(30);
    if (!first) { coinCount += 5; floater(`${s.name} sevindi, mama verdin! +5`, '#f6dcae'); return; }
    coinCount += 25;
    const zoneDone = STRAYS.filter((st) => st.z === s.z).every((st) => save.strays[st.id]);
    if (zoneDone) coinCount += 100;
    const n = STRAYS.filter((st) => save.strays[st.id]).length;
    toast(`${s.name} kurtarıldı!`, `${s.note}. Artık evinde yaşıyor · +25 balık${zoneDone ? ` · ${ZONES[s.z].name} tamam! +100` : ''} · ${n}/${STRAYS.length}`, 2.8);
  }
  function collectPower(p) {
    if (p.kind === 'stray') { rescueStray(p); return; }
    if (p.kind === 'box') { // surpriz kutu: tur sonunda acilir
      stats.boxes++;
      floater('Sürpriz kutu! Tur sonunda açılır', '#b99be8');
      burst(p.x, p.y, '#b99be8', 6, 110);
      sfx('box'); vibrate(20);
      return;
    }
    stats.powers++;
    if (p.kind === 'balon') { balloonT = BALLOON_T; player.ground = false; player.ledge = null; addBalloonFish(); if (chase && chase.phase === 'near' && !(run && run.cfg.dogsAll)) chase.phase = 'away'; }
    else if (p.kind === 'yay') yayT = YAY_T;
    if (p.kind === 'shield') shieldHP = upg('kalkan') >= 1 ? 2 : 1;
    else if (p.kind === 'magnet') magnetT = 7 + 2 * upg('miknatis');
    else if (p.kind === 'slow') slowT = 4 + (catIs('pamuk') ? 2 : 0);
    else if (p.kind === 'mama') { tokluk = Math.min(100, tokluk + 50 * feedMult()); energy = Math.min(energyMax, energy + 1); }
    toast(POWERS[p.kind].name, p.kind === 'mama' ? 'Karın doydu, +1 pati' : p.kind === 'balon' ? 'Çatıların üstünde süzül, gökteki balıkları topla' : p.kind === 'yay' ? 'Süper zıplama!' : '', 1.3);
    burst(p.x, p.y, POWERS[p.kind].color, 6, 110);
    sfx('power');
    if (p.kind === 'mama') sfx('meowShort');
    vibrate(20);
  }

  function addBalloonFish() { // balonun yolunda gokte balik dizisi
    for (let x = player.x + 90, i = 0; x < player.x + speed * BALLOON_T - 40; x += 38, i++) addCoin(x, player.lastGy - 142 + Math.sin(i * 0.5) * 14);
  }
  // Tur sonunda surpriz kutular acilir: balik, oyuncak ya da aksesuar
  function openBoxes() {
    const out = [];
    for (let i = 0; i < stats.boxes; i++) {
      const r = Math.random();
      const toysLeft = TOYS.filter((t) => !save.toys.owned.includes(t.id));
      const cosLeft = COSMETICS.filter((c) => !c.reward && !save.wardrobe.owned.includes(c.id));
      if (r < 0.12 && toysLeft.length) { const t = pickOne(toysLeft); save.toys.owned.push(t.id); persist('toys'); out.push('🎁 ' + t.name); }
      else if (r < 0.26 && cosLeft.length) { const c = pickOne(cosLeft); save.wardrobe.owned.push(c.id); persist('wardrobe'); out.push('🎁 ' + c.name); }
      else { const f = r > 0.93 ? 150 : 20 + Math.floor(Math.random() * 45); save.wallet += f; out.push('🐟 ' + f); }
    }
    if (out.length) { persist('wallet'); sfx('box'); }
    return out.length ? '\nSürpriz kutular: ' + out.join(' · ') : '';
  }
  const HIT_REASON = { spike: 'Süpürgeye takıldın!', pipe: 'Borudan ıslandın!', ac: 'Klimaya çarptın!', jet: 'Islandın!', bar: 'İpe takıldın!', hunger: 'Aç kaldın!', dog: 'Köpek yakaladı!', fall: 'Aşağı düştün!', sign: 'Tabelaya çarptın!', roomba: 'Robot süpürgeye çarptın!' };
  // Engele carpinca: kopek uzaktaysa yalnizca takilirsin, kopek yetisir. Kopek yakindaysa yakalar, bir can gider.
  let hitLog = '', dbg = ''; const spawnTally = {}; // test icin: son carpmalar
  function hit(kind) {
    if (DEMO) { const p = player, o = obstacles.find((q) => q.hitIt && !q.logged); if (o) o.logged = true; hitLog = (hitLog + ',' + kind + '@' + meters() + (kind === 'fall' ? dbg : `[L${p.ledge ? 1 : 0} S${p.slide > 0 ? 1 : 0} G${p.ground ? 1 : 0} vy${Math.round(p.vy)} dx${o ? Math.round(o.x - p.x) : '?'} ledges${ledges.filter((l) => Math.abs(l.x1 - p.x) < 250).map((l) => Math.round(l.x1 - p.x)).join('/')}]`)).slice(-400); }
    if (kind === 'jet' || kind === 'pipe') sfx('splash');
    if (shieldHP > 0) {
      shieldHP--;
      invulnT = 1.2;
      shieldHits++;
      burst(player.x, player.y - 14, POWERS.shield.color, 8, 140);
      floater(shieldHP > 0 ? 'Kalkan çatladı' : 'Kalkan kırıldı', '#c9d8ea');
      vibrate(40);
      sfx('shield');
      return;
    }
    if (kind === 'fall' || kind === 'hunger') { loseLife(kind); return; }
    if (dogNear() || isTutorial()) {
      if (chase) { chase.lunge = 0.5; chase.gap = Math.min(chase.gap, 40); }
      loseLife(isTutorial() ? kind : 'dog');
      if (chase) { chase.t = 0; chase.gap = DOG_NEAR + 30; }
      return;
    }
    // takildin: can gitmez ama kopek arkana yetisir
    combo = 0;
    invulnT = 1.1;
    player.stumble = 0.45;
    player.wiggle = 1;
    toast(HIT_REASON[kind] || 'Takıldın!', player.shaft ? 'Duvardan kaydın, tekrar tırman!' : 'Köpek arkanda! Bir daha takılırsan yakalar', 1.6);
    burst(player.x, player.y - 14, '#e0a05f', 6, 110);
    vibrate(45);
    sfx('hit');
    sfx('meowShort');
    if (!player.shaft) startChase(null, chase ? chase.gap : CAT_SX + 120);
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
    toast((kind === 'dog' && boss ? BOSSES[boss.kind].caught : HIT_REASON[kind]) || 'Ah!', `${lives} can kaldı`, 1.4);
    burst(player.x, player.y - 14, '#e07a7a', 8, 140);
    vibrate(60);
    sfx('hit');
    sfx('meowSad');
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
    zone = bgZone = bgFrom = mode === 'level' ? cfg.zone || 0 : 0; bgT = 1;
    if (ZONE_Q !== null) zone = bgZone = bgFrom = ZONE_Q; // test icin ?zone=N
    // Golge rakip: onceki en uzak mesafe (sonsuz kosuda zorluga gore, gunun seferinde gunluk)
    run.recordM = mode === 'endless' ? save.bestDist[run.diff] || 0 : mode === 'daily' ? dailyState().bestM || 0 : 0;
    run.passedRecord = false;
    reset();
    if (mode === 'level' && cfg.boss) boss = { kind: cfg.boss, hp: BOSSES[cfg.boss].hp, max: BOSSES[cfg.boss].hp, atkT: 4.5, i: 0, beaten: false, swoop: 0 };
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
    camY = -(H * CAM_Y) / ZOOM;
    if (opts.resume) return;
    if (mode !== 'tutorial') startChase(null, DOG_NEAR + 30); // Subway gibi: kosu baslarken kopek hemen arkanda
    state = 'play';
    show(null);
    sfx('start');
    if (mode === 'tutorial' && !DEMO) { // egitimin ilk karti: ne yapacagini soyle
      state = 'hint';
      $('hintTitle').textContent = 'Hoş geldin! 🐾';
      $('hintSub').textContent = 'Kedin çatıların üstünde koşacak. Ekrana dokununca zıplar, parmağını aşağı kaydırınca kayar. Bina aralarında duvardan duvara zıplayarak tırmanır. Hadi dene!';
      $('hintCard').classList.remove('hidden');
      $('pauseBtn').classList.add('hidden');
    }
  }

  function snapshot() {
    return {
      v: 5, mode: run.mode, level: run.level, diff: run.diff, goal: isFinite(run.goal) ? run.goal : null,
      player: { ...player }, plats, obstacles, coins: coins.map((c) => ({ x: c.x, y: c.y, f: c.f })), powerups,
      speed, dist, bonus, coinCount, coinsSpawned, genX, genY, spawnDone, camX, camY,
      shieldHP, magnetT, slowT, invulnT, shieldHits, stage, rngState, weather,
      lives, maxLives, tokluk, energy, energyMax, energyT, runT, jetClock, stats, chase, ledges, shafts, balloonT, yayT,
      points, pattern, revived: !!run.revived, bankedCount: run.bankedCount || 0, zone, bgZone, boss,
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
    run.goal = d.goal === null || d.goal === undefined ? Infinity : d.goal;
    player = { ...d.player };
    plats = d.plats; obstacles = d.obstacles; coins = d.coins; powerups = d.powerups; trail = [];
    ({ speed, dist, bonus, coinCount, coinsSpawned, genX, genY, spawnDone, camX, camY,
      shieldHP, magnetT, slowT, invulnT, shieldHits, stage, rngState, weather,
      lives, maxLives, tokluk, energy, energyMax, energyT, runT, jetClock, stats, chase } = d);
    ledges = d.ledges || []; shafts = d.shafts || []; balloonT = d.balloonT || 0; yayT = d.yayT || 0; player.ledge = null;
    zone = d.zone || 0; bgZone = bgFrom = d.bgZone || 0; bgT = 1; boss = d.boss || boss;
    if (player.shaft) player.shaft = shafts.find((q) => q.x0 === player.shaft.x0) || null;
    if (!player.shaft) player.wall = null;
    points = d.points || dist / METER;
    pattern = d.pattern || null;
    run.revived = !!d.revived;
    run.bankedCount = d.bankedCount || 0;
    run.passedRecord = meters() >= run.recordM;
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
    chase = null;
    if (player.shaft) { /* bina arasinda kalir */ } else if (!player.ground || !platAt(player.x)) respawn();
    // kedinin hemen onundeki engelleri temizle ki geri donunce haksiz yere carpmasin
    obstacles = obstacles.filter((o) => o.type === 'mark' || o.x + o.w < player.x - 30 || o.x > player.x + speed * 1.6);
    player.buffer = 0; player.stumble = 0;
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
    balloonT = 0;
    burst(player.x, player.y - 14, c.fur, 10, 150);
    burst(player.x, player.y - 14, c.fur2, 5, 130);
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
    const boxLine = openBoxes();
    const statLine = `Balık +${earned} · Kıl payı ${stats.near} · Kayma ${stats.slides} · Köpek ${stats.dogs}${boxLine}`;
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
    for (const c of [COIN, '#8fb8de', '#e89ab0']) burst(player.x + 40, player.y - 70, c, 6, 170);
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
    $('winInfo').textContent = `Balık: ${coinCount}/${coinsSpawned} · Kayıp can: ${stats.livesLost}\nCüzdana +${earned}${openBoxes()}` +
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
    for (const d of RAIN) { d.y += 380 * dt; d.x -= 60 * dt; if (d.y > H + 20) { d.y -= H + 40; d.x = rand(0, W + 60); } }

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

      speed = Math.min(MAX_SPEED, (cfg.speed + Math.min(cfg.cap, dist * cfg.ramp)) * df.speed * SPEED_K);
      if (yayT > 0) yayT -= wdt;
      const px0 = player.x;
      updatePlayer(dt, wdt);
      if (state !== 'play') return;
      const dx = Math.max(0, player.x - px0);
      dist = Math.max(dist, player.x);
      points += (dx / METER) * stageMult() * permMult();
      while (!spawnDone && genX < player.x + W + 500) spawn();
      const cut = player.x - DOG_AWAY - 200;
      plats = plats.filter((q) => q.x1 > cut);
      ledges = ledges.filter((l) => l.x1 > camX - 60);
      obstacles = obstacles.filter((o) => o.x + o.w > camX - 80);
      shafts = shafts.filter((q) => q.x1 > camX - 80 || q === player.shaft);
      coins = coins.filter((c) => !c.taken && c.x > camX - 40);
      powerups = powerups.filter((p) => !p.taken && p.x > camX - 40);

      // kamera: sahne bosuna kaymasin (goz yorar). Yatayda kediyle sabit; dikeyde ancak kedi ekranin
      // ust/alt kenarina yaklasinca yumusakca kayar. Bina arasinda kamera bir kez yerlesir ve durur.
      { // arka plan, kedinin ulastigi binanin mekanina yavasca gecer
        const pq = platAt(player.x);
        if (pq && pq.z !== undefined && pq.z !== bgZone) { bgFrom = bgT < 1 ? bgFrom : bgZone; bgZone = pq.z; bgT = 0; }
        if (bgT < 1) bgT = Math.min(1, bgT + dt / 1.8);
      }
      const VH = H / ZOOM;
      const camYBy =(d, rate, maxPx) => { // dikey kayma yumusak ve hiz sinirli (ekranda en fazla maxPx px/sn)
        const cap = (maxPx / ZOOM) * dt;
        camY += Math.max(-cap, Math.min(cap, d * Math.min(1, dt * rate)));
      };
      if (player.shaft) {
        const sh = player.shaft;
        camX += (sh.x0 + 13 - CAT_SX / ZOOM - camX) * Math.min(1, dt * 4); // aralik ekrana sigar
        let ty = (sh.yb + sh.yt) / 2 - VH * 0.52; // aralik ortalanir; uzun araliklarda kedi takip edilir
        ty = Math.max(ty, sh.yb - VH * 0.9);
        if (player.y - ty < VH * 0.3) ty = player.y - VH * 0.3;
        camYBy(ty - camY, 1.6, player.y - camY < VH * 0.25 ? 420 : 160);
      } else {
        const tx = player.x - CAT_SX / ZOOM;
        if (player.camEase > 0) { // bina arasindan cikis: kamera tek, yumusak bir hareketle yerine doner
          player.camEase -= dt;
          const lim = speed * 1.6 * dt; // dunya en fazla %60 hizli akar
          camX += Math.max(-lim, Math.min(lim, (tx - camX) * Math.min(1, dt * 3.2)));
          if (Math.abs(tx - camX) < 1) { player.camEase = 0; camX = tx; }
          else if (player.camEase <= 0) player.camEase = 0.1; // yetisene kadar yumusak devam
        } else camX = tx;
        const d = player.lastGy - (H * CAM_Y) / ZOOM - camY, band = VH * 0.13;
        const need = d > band ? d - band : d < -band ? d + band : 0; // olu bolge: kucuk yukseklik farklarinda sabit
        const catY = (player.y - camY) / VH; // kedi kenara cok yaklasirsa hizli takip
        camYBy(need, 2.2, catY < 0.15 || catY > 0.9 ? 420 : 160);
      }

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
          const nz = ZONE_Q !== null ? ZONE_Q : zoneAtStage(st);
          if (nz !== zone) { zone = nz; toast(`${ZONES[nz].to} geldin!`, `${ZONES[nz].sub} · Puan x${stageMult()}${wsub}`, 3); }
          else toast(`${st + 1}. Sokak · ${PALETTES[S.pal].name}`, `Puan x${stageMult()} · ${S.sub}${wsub}`, 2.8);
          sfx('stage');
          // Mola: engelsiz uzun bir duvar ve balik dizisi
          const q = addPlat(genX + 70, genX + 70 + speed * BREATHER, genY);
          for (let x = q.x0 + 60; x < q.x1 - 40; x += 46) addCoin(x, q.y - 16);
          pattern = null;
          const reward = Math.min(12, 2 + st);
          coinCount += reward;
          floater(`Sokak ödülü: +${reward} balık`, COIN);
        }
      } else if (run.mode === 'level' && cfg.dogsAll && !chase && !(boss && boss.beaten)) {
        if (boss) { startChase(null, CAT_SX + 140); toast(BOSSES[boss.kind].name + ' peşinde!', BOSSES[boss.kind].intro, 2.6); }
        else startChase('Bölüm bitene kadar Karabaş peşinde! Hiçbir yere takılma.', CAT_SX + 140);
      }

      if (DEMO) bot();
      updateChase(dt, wdt);
      updateBoss(dt);
      if (state !== 'play') return;
      updateCrows(dt);

      const p = player, cy = p.y - 14;
      if (magnetT > 0) {
        for (const c of coins) {
          const ddx = p.x - c.x, ddy = cy - c.y, dd = Math.hypot(ddx, ddy);
          if (dd < 170 && dd > 0) { const m = Math.min(dd, 560 * dt); c.x += (ddx / dd) * m; c.y += (ddy / dd) * m; }
        }
      }
      for (const c of coins) {
        if (!c.taken && Math.abs(c.x - p.x) < CAT_HW + 8 && c.y > p.y - CAT_H - (balloonT > 0 ? 44 : 12) && c.y < p.y + (balloonT > 0 ? 40 : 8)) {
          c.taken = true;
          bonus += 10;
          coinCount++;
          stats.fish++;
          tokluk = Math.min(100, tokluk + 12 * feedMult());
          burst(c.x, c.y, COIN, 4, 80);
          sfx('coin');
        }
      }
      for (const pw of powerups) {
        if (!pw.taken && Math.hypot(pw.x - p.x, pw.y - cy) < CAT_HW + (pw.kind === 'stray' ? 30 : 16)) { pw.taken = true; collectPower(pw); }
      }

      // ipuclari, duyurular, gecilen engeller
      for (const o of obstacles) {
        const sx = SX(o.x);
        if (o.announce && !o.announced && sx < W - 10) { o.announced = true; floater(o.announce, '#c9d8ea'); }
        if (o.hint && !o.hinted && sx < W - 40) {
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
          if (o.trigger === 'dog') startChase(null, CAT_SX + 160);
          if (o.trigger === 'crow') crowT = 0.6;
        }
        if (o.type === 'roomba' && sx < W + 30) { // robot supurge kediye dogru gelir, duvarin ucunda durur
          const nx = o.x + o.vx * wdt, q = platAt(nx);
          if (q && Math.abs(q.y - o.y) < 1 && nx > q.x0 + 4) o.x = nx;
        }
        if (o.type === 'jet') { // ekrandaki fiskiye acilinca su sesi
          const on = jetOn(o);
          if (on && !o.wasOn && sx > 0 && sx < W) sfx('spray');
          o.wasOn = on;
        }
        const over = p.x + CAT_HW > o.x && p.x - CAT_HW < o.x + o.w;
        if (over && o.type === 'sign' && p.slide > 0) o.under = true;
        if (over && (o.type === 'spike' || o.type === 'roomba') && !p.ground) o.clr = Math.min(o.clr === undefined ? 99 : o.clr, o.y - o.h - p.y);
        if (over && o.type === 'jet' && p.ground) { o.sat = true; if (jetOn(o)) o.wet = true; }
        if (over && o.type === 'bar' && p.ground) o.under = true;
        if (!o.passed && p.x - CAT_HW > o.x + o.w) {
          o.passed = true;
          if ((o.type === 'spike' || o.type === 'roomba') && o.clr !== undefined && o.clr < 16 && !o.hitIt) nearMiss();
          if (o.type === 'sign' && o.under && !o.hitIt) nearMiss('Kaydın!');
          if (o.type === 'bar' && o.under && !o.hitIt) { stats.lines++; nearMiss('Altından geçtin!'); }
          if (boss && !o.hitIt && (o.boss || (boss.kind === 'karabas' && o.type !== 'mark' && o.type !== 'sticky'))) bossHurt();
          if (o.type === 'jet' && o.sat && !o.wet) { stats.jets++; bonus += 15; floater('Islanmadan geçtin! +15', '#c9d8ea'); }
        }
      }
      if (isTutorial()) crowT -= dt; // egitimde karga yalnizca ipucuyla gelir

      if (invulnT <= 0 && balloonT <= 0) {
        const hr = df.hit;
        const ax0 = p.x - CAT_HW + hr, ax1 = p.x + CAT_HW - hr, ay0 = p.y - (p.slide > 0 ? SLIDE_H : CAT_H) + hr, ay1 = p.y - 3;
        for (const o of obstacles) {
          let b = null;
          if (o.type === 'spike') b = [o.x, o.y - o.h, o.x + o.w, o.y];
          else if (o.type === 'bar') b = [o.x, o.y - BAR_HIGH, o.x + o.w, o.y - BAR_LOW];
          else if (o.type === 'jet' && jetOn(o) && !catIs('van')) b = [o.x + 6, o.y - JET_H, o.x + JET_W, o.y];
          else if (o.type === 'sign') b = [o.x, o.y - o.h, o.x + o.w, o.y - SIGN_LOW];
          else if (o.type === 'roomba') b = [o.x, o.y - o.h, o.x + o.w, o.y];
          if (b && aabb(ax0, ay0, ax1, ay1, b[0], b[1], b[2], b[3])) { o.hitIt = true; hit(o.skin === 'pipe' ? 'pipe' : o.skin === 'ac' ? 'ac' : o.type); p.slide = 0; break; }
        }
      }

      if (state === 'play' && run.recordM > 20 && !run.passedRecord && meters() >= run.recordM) {
        run.passedRecord = true;
        toast('Rekorunu geçtin!', `Önceki en iyi: ${run.recordM} m`, 2);
        burst(p.x, p.y - 40, COIN, 8, 140);
        sfx('escape');
        vibrate(25);
      }
      missionT += dt;
      if (state === 'play' && missionT > 0.5) { missionT = 0; checkMissions(); }
      if (state === 'play' && (run.mode === 'level' || run.mode === 'tutorial') && dist >= run.goal) win();
    }

    for (const q of particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += q.g * dt;
      q.life -= dt;
    }
    particles = particles.filter((q) => q.life > 0);
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

  // ================= Yandan gorunen gercekci kedi ve kopek =================
  // Iskelet: omuz ve kalca eklemleri, iki/uc parcali bacaklar (ters kinematik), esneyen omurga,
  // dortnala kosu adimlari (her ayak sirayla basar), yayla sallanan kuyruk ve sabit duran bas.
  const TAU = Math.PI * 2;
  const frac = (v) => v - Math.floor(v);
  const smooth = (k) => k * k * (3 - 2 * k);
  function ik(ax, ay, fx, fy, l1, l2, bend) { // bend +1: eklem arkada (dirsek), -1: onde (diz)
    let dx = fx - ax, dy = fy - ay, d = Math.hypot(dx, dy);
    const mx = l1 + l2 - 0.05;
    if (d > mx) { fx = ax + (dx / d) * mx; fy = ay + (dy / d) * mx; d = mx; }
    d = Math.max(d, Math.abs(l1 - l2) + 0.05);
    const a = Math.atan2(fy - ay, fx - ax);
    const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const al = Math.acos(c) * bend;
    return [ax + Math.cos(a + al) * l1, ay + Math.sin(a + al) * l1, fx, fy];
  }
  function gaitFoot(u, stride, lift, st) { // yere basma (st) ve havada ileri tasima
    u = frac(u);
    if (u < st) return [stride / 2 - (u / st) * stride, 0];
    const k = (u - st) / (1 - st);
    return [-stride / 2 + smooth(k) * stride, -lift * Math.sin(Math.PI * k)];
  }
  const mixC = (a, b, k) => { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; };

  // Iskelet olculeri (kedi / kopek)
  // kedi: gercek oranlar (kuyruk govdeden kisa, kalin gogus, kisa boyun, bas sirt hizasinda)
  const CAT_SK = { S: [10.5, -21.5], H: [-10.5, -21], fore: [9.8, 11.2], hind: [11, 10.4], meta: [-3.4, -7], stride: 23, lift: 8, top: 7.2, belly: 8.4, chest: 7.8, rump: 7.8, head: [9.6, -6.6], tailN: 10, tailL: 2.35, tailW: [3.9, 2.1], tuck: 0.3 };
  const DOG_SK = { S: [19, -36], H: [-19, -35], fore: [16.5, 18.5], hind: [17.5, 16], meta: [-5.5, -10], stride: 38, lift: 13, top: 9.5, belly: 10.5, chest: 11, rump: 10.5, head: [10.5, -11], tailN: 9, tailL: 3.6, tailW: [5.2, 2.4] };

  // poz: { gait, ground, vy, squash, idle, stumble, lunge }
  function quadPose(sk, st, t) {
    const S = [...sk.S], Hh = [...sk.H];
    let feet, rot = 0, headDy = 0, tailA, arch = 0;
    if (st.lie) { // uzanir: govde yerde, patiler one uzanmis, kuyruk kivrik
      const br = Math.sin(t * 1.6) * 0.45;
      S[0] = 11; S[1] = -11.5 + br; Hh[0] = -11; Hh[1] = -10 + br * 0.3;
      feet = [[Hh[0] + 7, 0], [Hh[0] + 9, 0], [S[0] + 10, 0], [S[0] + 12.5, 0]];
      tailA = Math.PI - 0.25; arch = -1; headDy = 1.5;
    } else if (st.stretch) { // gerinir: on patiler ileri, gogus asagi, kalca yukari
      const k = st.stretch;
      S[0] += 2 * k; S[1] += 9 * k; Hh[1] -= 1.5 * k;
      feet = [[Hh[0] + 1, 0], [Hh[0] - 1, 0], [S[0] + 4 + 11 * k, 0], [S[0] + 2 + 11 * k, 0]];
      headDy = 7 * k; tailA = -2.1 - 0.4 * k; arch = -2 * k;
    } else if (st.eat) { // ayakta, basi kaba egik
      S[1] += 2.5;
      feet = [[Hh[0] + 1.5, 0], [Hh[0] - 1.5, 0], [S[0] + 2.5, 0], [S[0] - 0.5, 0]];
      headDy = 12; tailA = -2.4; arch = 1;
    } else if (st.sit) { // oturur: kalca yerde, on bacaklar dik, arka bacaklar katli; nefes alir
      const br = Math.sin(t * 2.2) * 0.4;
      S[0] = 7; S[1] = -22 + br; Hh[0] = -6; Hh[1] = -8.5 + br * 0.3;
      feet = [[Hh[0] + 7, 0], [Hh[0] + 9, 0], [S[0] + 0.5, 0], [S[0] + 2.5, 0]];
      tailA = Math.PI - 0.62; arch = -2; headDy = -2.5;
      if (st.lick !== undefined) { const lp = Math.sin(st.lick * 6) * 1.2; feet[3] = [S[0] + 8, -19 + lp]; headDy = 5.5 + lp * 0.4; } // patisini yalar
    } else if (st.idle) { // ayakta, nefes alir
      const br = Math.sin(t * 2.2) * 0.5;
      S[1] += br * 0.4; Hh[1] += br * 0.3;
      feet = [[Hh[0] + 1.5, 0], [Hh[0] - 1.5, 0], [S[0] + 2.5, 0], [S[0] - 0.5, 0]];
      tailA = -2.2; arch = 1;
    } else if (st.slide) { // yere yatip kayar: on patiler ileri, arka patiler geri uzanir
      S[0] += 2; S[1] += 8.5; Hh[1] += 7.5;
      feet = [[Hh[0] - 10, 0], [Hh[0] - 8, 0], [S[0] + 11, 0], [S[0] + 9, 0]];
      headDy = 5.5; tailA = -3.06; arch = -1.2;
    } else if (st.ground && st.walk) { // sakin yuruyus: kisa adimlar, ayaklar sirayla (sol arka, sol on, sag arka, sag on)
      const ph = st.gait, bob = Math.sin(TAU * 2 * ph) * 0.5;
      S[1] += bob; Hh[1] += bob; headDy = -bob * 0.5;
      const L = (o, bx) => { const f = gaitFoot(ph + o, sk.stride * 0.55, sk.lift * 0.5, 0.62); return [bx + f[0], f[1]]; };
      feet = [L(0, Hh[0] + 1), L(0.5, Hh[0] + 1), L(0.25, S[0] + 2), L(0.75, S[0] + 2)];
      tailA = -2.45 + Math.sin(TAU * ph) * 0.06; arch = 0.5;
    } else if (st.ground) {
      const ph = st.gait;
      const flex = Math.sin(TAU * (ph + 0.12)); // govde esner ve toplanir (dortnala)
      const bob = Math.sin(TAU * 2 * ph) * 1.1;
      S[0] += 2.2 * flex; Hh[0] -= 2.2 * flex;
      S[1] += bob - 0.6 * flex; Hh[1] += bob + 0.6 * flex;
      arch = -flex * 1.6;
      headDy = -bob * 0.6; // bas sabit kalmaya calisir
      const L = (o, bx) => { const f = gaitFoot(ph + o, sk.stride, sk.lift, 0.42); return [bx + f[0], f[1]]; };
      feet = [L(0, Hh[0] + 1), L(0.09, Hh[0] + 1), L(0.5, S[0] + 2), L(0.6, S[0] + 2)];
      tailA = -2.78 + Math.sin(TAU * ph) * 0.05;
    } else { // havada: yukselirken uzanir, inerken on ayaklar asagi uzanir
      const k = Math.max(-1, Math.min(1, st.vy / 520)), kk = (k + 1) / 2;
      S[0] += lerp(2.5, 0.5, kk); Hh[0] -= lerp(2.5, 0, kk);
      const fF = [lerp(S[0] + 10, S[0] + 5, kk), lerp(S[1] + 15, S[1] + 19, kk)];
      const fH = [lerp(Hh[0] - 11, Hh[0] + 3, kk), lerp(Hh[1] + 13, Hh[1] + 15, kk)];
      feet = [[fH[0] - 1.5, fH[1] - 1], [fH[0], fH[1]], [fF[0] - 2, fF[1] - 1], [fF[0], fF[1]]];
      rot = lerp(-0.13, 0.1, kk);
      tailA = lerp(-2.95, -2.3, kk);
      arch = lerp(-1.5, 1.5, kk);
    }
    if (st.squash) { S[1] += 2.2 * st.squash; Hh[1] += 1.6 * st.squash; headDy += 1.4 * st.squash; }
    if (st.stumble) { S[1] += 2 * st.stumble; headDy += 3 * st.stumble; rot += 0.12 * st.stumble; }
    if (st.lunge) { S[0] += 4 * st.lunge; headDy -= 2 * st.lunge; }
    return { S, H: Hh, feet, rot, head: [S[0] + sk.head[0], S[1] + sk.head[1] + headDy], tailA, arch };
  }

  function bodyPath(g, sk, S, Hh, arch) {
    const nx = S[0] + 3, ny = S[1] - sk.top + 1;
    const rx = Hh[0] - 2, ry = Hh[1] - sk.top + 2;
    g.beginPath();
    g.moveTo(nx, ny);
    g.quadraticCurveTo((nx + rx) / 2, Math.min(ny, ry) - 1.5 - arch, rx, ry);                       // sirt
    g.quadraticCurveTo(Hh[0] - sk.rump, Hh[1] - 1, Hh[0] - 1, Hh[1] + sk.belly * 0.75);              // sagri
    if (sk.tuck) { // kedi: bel ice cekik, gogus derin
      g.bezierCurveTo(Hh[0] + 6, Hh[1] + sk.belly * (0.75 - sk.tuck), S[0] - 9, S[1] + sk.belly + 1.2, S[0] + 1, S[1] + sk.belly * 0.95);
    } else g.quadraticCurveTo((Hh[0] + S[0]) / 2, Math.max(Hh[1], S[1]) + sk.belly + 0.5, S[0] + 1, S[1] + sk.belly * 0.85); // karin
    g.quadraticCurveTo(S[0] + sk.chest, S[1] + 3, S[0] + sk.chest * 0.8, S[1] - 3);                    // gogus
    g.quadraticCurveTo(S[0] + sk.chest * 0.7, ny - 0.5, nx, ny);
    g.closePath();
  }
  function furGrad(g, y0, y1, top, mid, low) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, top); gr.addColorStop(0.45, mid); gr.addColorStop(1, low);
    return gr;
  }
  function seg(g, x0, y0, x1, y1, w, col, soft) {
    if (soft) { const a = g.globalAlpha; g.globalAlpha = a * 0.35; g.strokeStyle = col; g.lineWidth = w + 0.8; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.globalAlpha = a; } // tuylu yumusak kenar
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  // incelen uzuv: w0 kalinliktan w1 kalinliga yuvarlak uclu dolgu (kas govdeye yakin kalin, aşağı incelir)
  function taper(g, x0, y0, x1, y1, w0, w1, col) {
    const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a), r0 = w0 / 2, r1 = w1 / 2;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x0 + nx * r0, y0 + ny * r0);
    g.lineTo(x1 + nx * r1, y1 + ny * r1);
    g.arc(x1, y1, r1, a + Math.PI / 2, a - Math.PI / 2, true);
    g.lineTo(x0 - nx * r0, y0 - ny * r0);
    g.arc(x0, y0, r0, a - Math.PI / 2, a + Math.PI / 2, true);
    g.closePath(); g.fill();
  }
  function drawCatLeg(g, sk, pose, i, cols) {
    const fore = i >= 2, far = i % 2 === 0;
    const A = fore ? pose.S : pose.H, f = pose.feet[i];
    const ax = A[0] + (far ? -1 : 0), ay = A[1] + 1.5;
    const up = far ? cols.far : cols.up, low = far ? cols.farLow : cols.low, T = sk.top;
    const ground = f[1] > -0.6;
    if (ground) ell(g, f[0] + 1, 0.5, T * 0.45, 0.6, 0, 'rgba(0,0,0,0.18)');
    if (fore) {
      const [ex, ey, fx, fy] = ik(ax, ay, f[0], f[1] - 1.3, sk.fore[0], sk.fore[1], 1);
      taper(g, ax, ay, ex, ey, T * 1.15, T * 0.52, up);          // omuz-dirsek: kasli
      taper(g, ex, ey, fx, fy, T * 0.5, T * 0.4, low);            // on kol: ince
      ell(g, fx + 1, fy + 0.4, T * 0.36, T * 0.21, 0, low);      // pati
    } else {
      const hx = f[0] + sk.meta[0], hy = f[1] + sk.meta[1];
      const [kx, ky] = ik(ax, ay, hx, hy, sk.hind[0], sk.hind[1], -1);
      taper(g, ax, ay, kx, ky, T * 1.3, T * 0.6, up);           // uyluk: genis ve kasli
      taper(g, kx, ky, hx, hy, T * 0.6, T * 0.36, low);          // incik
      taper(g, hx, hy, f[0], f[1] - 1.1, T * 0.38, T * 0.36, low); // uzun ayak tarağı (topuk yukarida)
      ell(g, f[0] + 1, f[1] - 0.2, T * 0.37, T * 0.21, 0, low);
    }
  }
  function drawLeg(g, sk, pose, i, cols) {
    if (sk === CAT_SK) return drawCatLeg(g, sk, pose, i, cols);
    const fore = i >= 2, far = i % 2 === 0;
    const A = fore ? pose.S : pose.H, f = pose.feet[i];
    const ax = A[0] + (far ? -1 : 0), ay = A[1] + 1;
    const up = far ? cols.far : cols.up, low = far ? cols.farLow : cols.low;
    if (fore) {
      const [ex, ey, fx, fy] = ik(ax, ay, f[0], f[1] - 1.4, sk.fore[0], sk.fore[1], 1);
      seg(g, ax, ay, ex, ey, sk.top * 0.78, up, sk === CAT_SK);
      seg(g, ex, ey, fx, fy, sk.top * 0.5, low, sk === CAT_SK);
      if (sk === CAT_SK && fy > -0.6) ell(g, fx + 1, 0.5, sk.top * 0.42, 0.55, 0, 'rgba(0,0,0,0.2)');
      ell(g, fx + 0.9, fy + 0.2, sk.top * 0.38, sk.top * 0.22, 0, low);
    } else {
      const hx = f[0] + sk.meta[0], hy = f[1] + sk.meta[1];
      const [kx, ky] = ik(ax, ay, hx, hy, sk.hind[0], sk.hind[1], -1);
      seg(g, ax, ay, kx, ky, sk.top * 0.95, up, sk === CAT_SK);
      seg(g, kx, ky, hx, hy, sk.top * 0.55, low, sk === CAT_SK);
      seg(g, hx, hy, f[0], f[1] - 1.2, sk.top * 0.44, low, sk === CAT_SK);
      if (sk === CAT_SK && f[1] > -0.6) ell(g, f[0] + 1, 0.5, sk.top * 0.42, 0.55, 0, 'rgba(0,0,0,0.2)');
      ell(g, f[0] + 0.9, f[1] - 0.3, sk.top * 0.38, sk.top * 0.22, 0, low);
    }
  }
  function tailSim(sk, pose, sim, curl, wave, t, vy) {
    const N = sk.tailN;
    if (!sim.a) { sim.a = new Array(N).fill(curl); sim.v = new Array(N).fill(0); sim.root = pose.tailA; sim.rv = 0; sim.t = t; sim.vy = vy || 0; }
    const dt = Math.min(0.04, Math.max(0, t - sim.t)); sim.t = t;
    const acc = dt > 0 ? ((vy || 0) - sim.vy) / dt : 0; sim.vy = vy || 0;
    const kick = Math.max(-2500, Math.min(2500, acc)) * 0.0011; // govdenin ani hiz degisimi kuyrugu savurur
    if (dt > 0) {
      sim.rv += (60 * (pose.tailA - sim.root) - 8 * sim.rv + kick * 0.6) * dt; sim.root += sim.rv * dt;
      for (let i = 0; i < N; i++) {
        const target = curl + Math.sin(t * 4.2 - i * 0.55) * wave * (0.6 + i * 0.1);
        sim.v[i] += (75 * (target - sim.a[i]) - 7 * sim.v[i] + kick * (0.4 + i * 0.12)) * dt;
        sim.a[i] += sim.v[i] * dt;
      }
    }
    const pts = [[pose.H[0] - 2, pose.H[1] - sk.top * 0.55]];
    let a = sim.root;
    for (let i = 1; i <= N; i++) { a += sim.a[i - 1]; const p = pts[i - 1]; pts.push([p[0] + Math.cos(a) * sk.tailL, p[1] + Math.sin(a) * sk.tailL]); }
    return pts;
  }
  function tailPoints(sk, pose, t, curl, wave, vy) {
    const pts = [[pose.H[0] - 2, pose.H[1] - sk.top * 0.55]];
    let a = pose.tailA;
    for (let i = 1; i <= sk.tailN; i++) {
      a += curl + Math.sin(t * 4.2 - i * 0.55) * wave * (0.6 + i * 0.1) + (vy || 0) * 0.00012;
      const p = pts[i - 1];
      pts.push([p[0] + Math.cos(a) * sk.tailL, p[1] + Math.sin(a) * sk.tailL]);
    }
    return pts;
  }
  function drawTail(g, sk, pts, colAt) {
    for (let i = 1; i < pts.length; i++) {
      const k = i / (pts.length - 1);
      seg(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], lerp(sk.tailW[0], sk.tailW[1], k), colAt(i, k));
    }
  }

  // ---------- Kedi ----------
  function drawCatHead(g, c, hx, hy, t, o) {
    const dark = c.pattern === 'points' || c.pattern === 'van';
    const headCol = c.pattern === 'points' ? c.fur : c.fur;
    const earCol = c.pattern === 'points' ? c.fur2 : c.pattern === 'van' ? c.fur2 : c.fur;
    const twitch = (t % 5.3) < 0.18 ? Math.sin(((t % 5.3) / 0.18) * Math.PI) * 1.2 : 0;
    const eb = o.earBack || 0, ebx = -3.6 * eb, eby = 2.6 * eb; // ruzgarda kulaklar geriye yatar
    // uzak kulak
    tri(g, [hx - 4.8, hy - 4.5], [hx - 3.4 + twitch * 0.3 + ebx, hy - 13.4 + eby], [hx - 0.2, hy - 5.6], shadeC(earCol, -0.25));
    // kafa (yandan): ense, alin, burun kemeri, burun, cene
    g.beginPath();
    g.moveTo(hx - 6.6, hy + 3.2);
    g.quadraticCurveTo(hx - 8.2, hy - 5, hx - 2, hy - 7.2);
    g.quadraticCurveTo(hx + 4.2, hy - 8.6, hx + 7, hy - 4.2);
    g.quadraticCurveTo(hx + 8.3, hy - 1.9, hx + 10.4, hy + 0.1);
    g.quadraticCurveTo(hx + 11.7, hy + 1.6, hx + 10.6, hy + 2.9);
    g.quadraticCurveTo(hx + 9.6, hy + 5.7, hx + 6.4, hy + 5.9);
    g.quadraticCurveTo(hx + 2, hy + 7.6, hx - 3, hy + 6.2);
    g.quadraticCurveTo(hx - 6.1, hy + 5.6, hx - 6.6, hy + 3.2);
    g.closePath();
    g.fillStyle = furGrad(g, hy - 8, hy + 7, shadeC(headCol, -0.1), headCol, mixC(headCol, c.belly, 0.45));
    g.fill();
    g.strokeStyle = 'rgba(45,30,30,0.28)'; g.lineWidth = 0.6; g.stroke();
    g.save(); g.clip();
    const hl = g.createRadialGradient(hx + 1, hy - 5, 0.5, hx + 1, hy - 4, 7); hl.addColorStop(0, 'rgba(255,255,255,0.2)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.fillRect(hx - 7, hy - 10, 14, 12); // alinda yumusak isik
    g.lineWidth = 0.28; // yuz tuyleri: burundan geriye dogru
    for (const light of [false, true]) {
      g.strokeStyle = light ? 'rgba(255,250,240,0.24)' : 'rgba(35,22,18,0.16)';
      g.beginPath();
      for (const f of HEAD_STRANDS) {
        if (f.w !== light) continue;
        const x = hx + 1 + Math.cos(f.th) * f.r, y = hy - 0.5 + Math.sin(f.th) * f.r * 0.85, dx = x - (hx + 11), dy = y - (hy + 1), d = Math.hypot(dx, dy) || 1;
        g.moveTo(x, y); g.lineTo(x + (dx / d) * f.l, y + (dy / d) * f.l);
      }
      g.stroke();
    }
    if (c.pattern === 'tabby') {
      g.strokeStyle = shadeC(c.fur2, 0.05); g.lineWidth = 1.1; g.lineCap = 'round';
      g.beginPath();
      for (const ox of [-1.5, 0.8, 3]) { g.moveTo(hx + ox, hy - 8); g.lineTo(hx + ox + 0.6, hy - 4.6); }
      g.moveTo(hx - 3.5, hy + 0.5); g.quadraticCurveTo(hx - 1, hy - 0.5, hx + 1.5, hy + 0.8); // yanak cizgisi
      g.stroke();
    } else if (c.pattern === 'points') {
      const m = g.createRadialGradient(hx + 8, hy + 1.5, 0.5, hx + 7, hy + 1.5, 8);
      m.addColorStop(0, c.fur2); m.addColorStop(0.6, shadeC(c.fur2, 0.15)); m.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = m; g.fillRect(hx - 2, hy - 8, 16, 16);
    } else if (c.pattern === 'calico') {
      dot(g, hx - 3, hy - 4, 4.5, c.fur2); dot(g, hx + 3.5, hy - 6.5, 3, c.fur3);
    } else if (c.pattern === 'spots') {
      ell(g, hx - 2.5, hy - 4.5, 3.6, 3, 0.3, c.fur2);
    } else if (c.pattern === 'van') {
      dot(g, hx - 1.5, hy - 7, 4.2, c.fur2);
    }
    if (c.pattern === 'tuxedo' || c.pattern === 'van' || c.pattern === 'spots' || c.pattern === 'calico') ell(g, hx + 7.5, hy + 4, 4.2, 2.6, -0.2, c.belly); // beyaz agiz cevresi
    else if (c.pattern !== 'points') ell(g, hx + 7, hy + 3.6, 3.8, 2.3, -0.2, mixC(c.fur, c.belly, 0.6));
    g.restore();
    // yanak tuyleri (cenenin arkasinda kabarik)
    g.fillStyle = mixC(headCol, c.belly, 0.25);
    g.beginPath(); g.moveTo(hx - 6.2, hy + 1.5); g.lineTo(hx - 8, hy + 3.6); g.lineTo(hx - 6, hy + 4.2); g.lineTo(hx - 7.2, hy + 6.2); g.lineTo(hx - 4.4, hy + 6); g.closePath(); g.fill();
    // yakin kulak
    tri(g, [hx - 3.4, hy - 5.8], [hx - 1.2 + twitch + ebx, hy - 14.6 + eby], [hx + 3.4, hy - 6.6], earCol);
    tri(g, [hx - 2, hy - 6.6], [hx - 1.1 + twitch * 0.8 + ebx * 0.85, hy - 12.6 + eby * 0.85], [hx + 1.9, hy - 7.1], 'rgba(232,160,168,0.75)');
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.35; // kulak ici tuyler
    g.beginPath(); g.moveTo(hx - 0.6, hy - 7.4); g.lineTo(hx - 1.2 + twitch * 0.6, hy - 10.5); g.moveTo(hx + 0.6, hy - 7.2); g.lineTo(hx + 0.2 + twitch * 0.6, hy - 10); g.stroke();
    // goz
    const ex = hx + 5, ey = hy - 1.7;
    if (o.blink) {
      g.strokeStyle = '#2a2328'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(ex - 2, ey + 0.2); g.quadraticCurveTo(ex, ey + 1, ex + 2.2, ey); g.stroke();
    } else {
      g.save();
      g.beginPath(); g.ellipse(ex, ey, 2.25, 1.75, -0.18, 0, TAU); g.clip();
      const ig = g.createRadialGradient(ex + 0.5, ey - 0.3, 0.2, ex, ey, 2.4);
      ig.addColorStop(0, shadeC(c.eyes[0], 0.35)); ig.addColorStop(1, shadeC(c.eyes[0], -0.2));
      g.fillStyle = ig; g.fillRect(ex - 3, ey - 3, 6, 6);
      g.strokeStyle = shadeC(c.eyes[0], -0.45); g.lineWidth = 0.35; g.beginPath(); g.arc(ex + 0.4, ey, 1.75, 0, TAU); g.stroke(); // irisin koyu dis halkasi
      const dil = o.dilate || 0; ell(g, ex + 0.65, ey, 0.5 + dil * 0.85, 1.45 - dil * 0.05, 0, '#141114'); // goz bebegi: gunduz ince, gece yuvarlak
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(ex - 3, ey - 2.2, 6, 1.1); // ust kapak golgesi
      g.restore();
      dot(g, ex + 1.15, ey - 0.75, 0.42, 'rgba(255,255,255,0.95)');
      dot(g, ex - 0.6, ey + 0.7, 0.22, 'rgba(255,255,255,0.5)');
      g.strokeStyle = '#2a1f22'; g.lineWidth = 0.55; // koyu goz cevresi (kedilerde dogal)
      g.beginPath(); g.ellipse(ex, ey, 2.25, 1.75, -0.18, 0, TAU); g.stroke();
      g.strokeStyle = shadeC(headCol, -0.35); g.lineWidth = 0.5; // gozun arkasindan uzanan cizgi
      g.beginPath(); g.moveTo(ex - 2.1, ey + 0.4); g.quadraticCurveTo(ex - 3.6, ey + 0.6, ex - 4.8, ey + 1.6); g.stroke();
    }
    // burun, agiz, biyiklar
    tri(g, [hx + 10.9, hy + 0.5], [hx + 9.4, hy + 0.3], [hx + 10.4, hy + 1.9], '#c97a86');
    g.strokeStyle = 'rgba(80,40,45,0.6)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(hx + 10.9, hy + 0.5); g.lineTo(hx + 9.4, hy + 0.3); g.lineTo(hx + 10.4, hy + 1.9); g.closePath(); g.stroke();
    g.fillStyle = 'rgba(60,40,40,0.35)'; for (const [px, py] of [[8.2, 3.2], [8.9, 3.6], [7.6, 3.8], [8.4, 4.2]]) { g.beginPath(); g.arc(hx + px, hy + py, 0.18, 0, TAU); g.fill(); } // biyik kokleri
    g.strokeStyle = 'rgba(70,45,50,0.6)'; g.lineWidth = 0.55;
    g.beginPath(); g.moveTo(hx + 10.3, hy + 2); g.quadraticCurveTo(hx + 9.6, hy + 3.8, hx + 7.4, hy + 4.1); g.stroke();
    if (o.mouth > 0) { ell(g, hx + 8.6, hy + 4.4, 1.6, 1.1 * o.mouth + 0.3, 0.2, '#5a2e38'); }
    g.strokeStyle = 'rgba(255,255,255,0.72)';
    g.lineWidth = 0.35;
    g.beginPath();
    for (const [dy1, dy2] of [[2.6, 1.2], [3.2, 3.4], [3.8, 5.6]]) { g.moveTo(hx + 8, hy + dy1); g.quadraticCurveTo(hx + 13, hy + dy1 - 0.5, hx + 17.5, hy + dy2); }
    g.stroke();
  }

  // Kediyi (0,0) = ayaklarinin bastigi yer merkezli, saga bakarken cizer.
  // ---------- Tuy: ince tuy cizgileri (sabit tohumla uretilir, titremez; govdeyle birlikte esner) ----------
  const FUR_RNG = (() => { let x = 987654; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; })();
  const BODY_STRANDS = Array.from({ length: 220 }, () => ({ u: -0.32 + FUR_RNG() * 1.55, v: FUR_RNG() * 2 - 1, l: 1.1 + FUR_RNG() * 1.6, j: (FUR_RNG() - 0.5) * 0.5, w: FUR_RNG() < 0.5 }));
  const EDGE_STRANDS = Array.from({ length: 70 }, (_, i) => ({ u: -0.3 + ((i % 35) / 34) * 1.5, top: i < 35, l: 0.7 + FUR_RNG() * 1.1, j: (FUR_RNG() - 0.5) * 0.5 }));
  const HEAD_STRANDS = Array.from({ length: 70 }, () => ({ r: Math.sqrt(FUR_RNG()) * 8, th: FUR_RNG() * TAU, l: 0.9 + FUR_RNG() * 1.3, w: FUR_RNG() < 0.5 }));
  const natCache = {};
  function natCat(c) { // kedinin renklerini biraz daha soluk ve dogal yap
    if (natCache[c.id]) return natCache[c.id];
    const soft = (h, k = 0.2) => { if (!h) return h; const [r, gg, b] = hexRgb(h), l = 0.3 * r + 0.59 * gg + 0.11 * b; return '#' + [r, gg, b].map((v) => Math.max(0, Math.min(255, Math.round((v + (l - v) * k) * 0.97))).toString(16).padStart(2, '0')).join(''); };
    return (natCache[c.id] = { ...c, fur: soft(c.fur), fur2: soft(c.fur2, 0.15), fur3: soft(c.fur3, 0.15), belly: soft(c.belly, 0.1), paws: soft(c.paws, 0.1) });
  }
  function bodyFrame(S, Hh) { const ax = S[0] - Hh[0], ay = S[1] - Hh[1], L = Math.hypot(ax, ay); return { L, ux: ax / L, uy: ay / L, nx: -ay / L, ny: ax / L }; }
  function bodyPt(sk, fr, Hh, u, v) {
    const bulge = 0.78 + 0.22 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
    const off = v < 0 ? v * (sk.top - 0.6) : v * (sk.belly - 0.8) * bulge;
    return [Hh[0] + fr.ux * u * fr.L + fr.nx * off, Hh[1] + fr.uy * u * fr.L + fr.ny * off];
  }
  function strandDir(fr, droop) { const x = -fr.ux + fr.nx * droop, y = -fr.uy + fr.ny * droop, d = Math.hypot(x, y); return [x / d, y / d]; }
  // govde ici: acik ve koyu notr tuyler (her renk kedide calisir); geriye ve asagi dogru akar
  function furInside(g, sk, S, Hh, k = 1) {
    const fr = bodyFrame(S, Hh);
    g.lineWidth = 0.34;
    for (const light of [false, true]) {
      g.strokeStyle = light ? `rgba(255,250,240,${0.12 * k})` : `rgba(35,22,18,${0.09 * k})`; // hafif: yakindan bakinca hissedilir
      g.beginPath();
      for (const f of BODY_STRANDS) {
        if (f.w !== light) continue;
        const [x, y] = bodyPt(sk, fr, Hh, f.u, f.v), [dx, dy] = strandDir(fr, 0.15 + f.v * 0.45 + f.j);
        g.moveTo(x, y); g.lineTo(x + dx * f.l, y + dy * f.l);
      }
      g.stroke();
    }
  }
  // kabarik siluet: sirtta ve karinda disa tasan tuyler
  function furEdge(g, sk, S, Hh, topCol, lowCol) {
    const fr = bodyFrame(S, Hh);
    g.lineWidth = 0.5;
    for (const top of [false]) { // yalniz karin altinda yumusak tuy; sirtta diken gibi durmasin
      g.strokeStyle = top ? topCol : lowCol;
      g.beginPath();
      for (const f of EDGE_STRANDS) {
        if (f.top !== top) continue;
        const [x, y] = bodyPt(sk, fr, Hh, f.u, top ? -0.97 : 0.97), [dx, dy] = strandDir(fr, (top ? -0.55 : 0.85) + f.j);
        g.moveTo(x, y); g.lineTo(x + dx * f.l, y + dy * f.l);
      }
      g.stroke();
    }
  }

  function drawCatSide(g, c, st, t, wear) {
    c = natCat(c);
    const sk = CAT_SK, pose = quadPose(sk, st, t);
    const pawCol = c.paws || (c.pattern === 'points' ? c.fur2 : c.fur);
    const legCol = c.pattern === 'points' ? c.fur2 : c.fur;
    const upHex = c.pattern === 'tuxedo' ? c.fur : legCol; // hex renkler (mixC 'rgb()' dondurur, tekrar karistirilamaz)
    const legGrad = (k) => furGrad(g, -24, -4, shadeC(upHex, k - 0.06), shadeC(upHex, k), k ? shadeC(pawCol, k) : mixC(upHex, pawCol, 0.6)); // bacak govdeyle ayni isikta
    const cols = { up: legGrad(0), low: pawCol, far: legGrad(-0.28), farLow: shadeC(pawCol, -0.28) };
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.translate(0, -18); g.rotate(pose.rot); g.translate(0, 18);
    // kuyruk
    const tcol = c.pattern === 'points' || c.pattern === 'van' ? c.fur2 : c.fur;
    const curl = st.sit ? 0.105 : st.idle ? -0.13 : -0.035, wave = st.sit ? 0.035 : st.idle ? 0.05 : 0.07;
    const pts = st.tail ? tailSim(sk, pose, st.tail, curl, wave, t, st.vy) : tailPoints(sk, pose, t, curl, wave, st.vy);
    const tailCol = (i, k) => (c.pattern === 'tabby' && i % 3 === 2 ? c.fur2 : c.pattern === 'tabby' && k > 0.85 ? c.fur2 : shadeC(tcol, -0.08 * (1 - k)));
    g.globalAlpha *= 0.4; drawTail(g, { ...sk, tailW: [sk.tailW[0] + 1.8, sk.tailW[1] + 1.4] }, pts, tailCol); g.globalAlpha /= 0.4; // kabarik tuy hali
    drawTail(g, sk, pts, tailCol);
    if (wear && wear.neck === 'pelerin') drawCape(g, pose.S[0] + 3, pose.S[1] - 5, 1, 'jump', t);
    // uzak bacaklar
    drawLeg(g, sk, pose, 0, cols); drawLeg(g, sk, pose, 2, cols);
    // govde (sirt koyu, karin acik: dogal golgelenme)
    bodyPath(g, sk, pose.S, pose.H, pose.arch);
    const bodyLow = c.pattern === 'tuxedo' || c.pattern === 'van' || c.pattern === 'spots' ? c.belly : mixC(c.fur, c.belly, 0.55);
    g.fillStyle = furGrad(g, pose.S[1] - sk.top, pose.S[1] + sk.belly, shadeC(c.fur, -0.12), c.fur, bodyLow);
    g.fill();
    g.strokeStyle = 'rgba(45,30,30,0.14)'; g.lineWidth = 0.6; g.stroke();
    g.save(); bodyPath(g, sk, pose.S, pose.H, pose.arch); g.clip();
    const S = pose.S, Hh = pose.H;
    // isik ve golge: sirtta yumusak parlaklik, karin altinda golge
    const sh2 = g.createLinearGradient(0, S[1] - sk.top, 0, S[1] + sk.belly);
    sh2.addColorStop(0, 'rgba(255,255,255,0.16)'); sh2.addColorStop(0.35, 'rgba(255,255,255,0)'); sh2.addColorStop(0.8, 'rgba(0,0,0,0)'); sh2.addColorStop(1, 'rgba(40,25,25,0.16)');
    g.fillStyle = sh2; g.fillRect(Hh[0] - 14, S[1] - sk.top - 4, S[0] - Hh[0] + 28, sk.top + sk.belly + 8);
    if (c.pattern === 'tabby') { // dogal tekir: sirttan inen, egri, uca dogru incelen ve solan cizgiler (esit aralikli degil)
      const fr = bodyFrame(S, Hh), sc = shadeC(c.fur2, 0.06);
      const TAB = [0.04, 0.17, 0.27, 0.4, 0.5, 0.63, 0.74, 0.86, 0.97];
      TAB.forEach((u, i) => {
        const len = 0.55 + ((i * 37) % 5) * 0.07, w = 1.5 - ((i * 13) % 3) * 0.25;
        const p0 = bodyPt(sk, fr, Hh, u, -0.92), p1 = bodyPt(sk, fr, Hh, u - 0.05, -0.92 + len), p2 = bodyPt(sk, fr, Hh, u + 0.02, -0.92 + len * 1.7);
        const gr = g.createLinearGradient(p0[0], p0[1], p2[0], p2[1]); gr.addColorStop(0, sc); gr.addColorStop(0.6, sc); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(p0[0] - w * 0.6, p0[1]); g.quadraticCurveTo(p1[0] - w * 0.4, p1[1], p2[0], p2[1]); g.quadraticCurveTo(p1[0] + w * 0.5, p1[1], p0[0] + w * 0.6, p0[1]); g.closePath(); g.fill();
      });
      const sp = g.createLinearGradient(0, S[1] - sk.top, 0, S[1] - sk.top + 4); sp.addColorStop(0, shadeC(c.fur2, 0.02)); sp.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sp; g.fillRect(Hh[0] - 10, S[1] - sk.top - 3, S[0] - Hh[0] + 16, 7); // sirt boyunca koyu serit
    } else if (c.pattern === 'calico') {
      ell(g, Hh[0] + 6, S[1] - 4, 8, 6, 0.2, c.fur2); ell(g, S[0] - 6, S[1] - 6, 6, 4.5, -0.2, c.fur3);
    } else if (c.pattern === 'spots') {
      ell(g, Hh[0] + 7, S[1] - 6, 5.5, 4, 0.3, c.fur2); ell(g, S[0] - 7, S[1] - 2, 4, 3, -0.2, c.fur2);
    } else if (c.pattern === 'points') {
      const pg = g.createLinearGradient(Hh[0] - 8, 0, Hh[0] + 8, 0); pg.addColorStop(0, shadeC(c.fur2, 0.3)); pg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = pg; g.fillRect(Hh[0] - 12, S[1] - 12, 20, 24);
    } else if (c.pattern === 'tuxedo') {
      ell(g, S[0] + 4, S[1] + 2, 6, 7.5, 0.3, c.belly); // beyaz gogus
    }
    furInside(g, sk, S, Hh); // desenlerin ustunden tuy dokusu
    const rim = g.createLinearGradient(0, S[1] - sk.top - 1, 0, S[1] - sk.top + 4);
    rim.addColorStop(0, 'rgba(255,248,230,0.5)'); rim.addColorStop(1, 'rgba(255,248,230,0)');
    g.strokeStyle = rim; g.lineWidth = 1.6; bodyPath(g, sk, S, Hh, pose.arch); g.stroke(); // sirtta gunes isigi
    g.restore();
    // kalca kasi, sonra yakin bacaklar
    const thighCol = c.fur;
    g.fillStyle = furGrad(g, Hh[1] - 7, Hh[1] + 9, shadeC(thighCol, -0.1), thighCol, c.pattern === 'points' ? mixC(c.fur, c.fur2, 0.5) : thighCol);
    g.beginPath(); g.ellipse(Hh[0] + 0.5, Hh[1] + 1, 5.2, 6.2, 0.35, 0, TAU); g.fill(); // sagri kasi, uylukla birlesir
    if (c.pattern === 'tabby') { g.strokeStyle = shadeC(c.fur2, 0.05); g.lineWidth = 1; g.beginPath(); g.arc(Hh[0] + 1.2, Hh[1] + 1.8, 3.6, -2.2, -1.1); g.stroke(); }
    if (c.pattern === 'spots') ell(g, Hh[0] - 1, Hh[1] - 1, 3.6, 3, 0, c.fur2);
    drawLeg(g, sk, pose, 1, cols); drawLeg(g, sk, pose, 3, cols);
    // boyun
    const [hx, hy] = pose.head;
    g.beginPath();
    g.moveTo(S[0] + 2, S[1] - sk.top + 1.2);
    g.quadraticCurveTo(hx - 6, hy - 2, hx - 5.5, hy - 1);
    g.lineTo(hx - 1, hy + 6);
    g.quadraticCurveTo(S[0] + 7.5, S[1] - 1, S[0] + 6.5, S[1] + 1);
    g.closePath();
    g.fillStyle = furGrad(g, hy - 4, S[1] + 2, shadeC(c.fur, -0.1), c.fur, c.pattern === 'tuxedo' ? c.belly : mixC(c.fur, c.belly, 0.5));
    g.fill();
    if (wear && wear.neck) { g.save(); g.translate(hx - 3.5, hy + 5.5); g.scale(0.75, 0.75); drawNeckItem(g, wear.neck, 0, 0, 1, t); g.restore(); }
    g.save(); g.translate(hx, hy); g.scale(0.9, 0.9); g.translate(-hx, -hy);
    const bt = t % 5.7, blink = !!st.closed || bt < 0.11 || (bt > 2.9 && bt < 3.0) || (bt > 3.12 && bt < 3.2); // bazen tek, bazen cift goz kirpma
    drawCatHead(g, c, hx, hy, t, { blink, mouth: st.mouth || 0, earBack: st.earBack || 0, dilate: st.dilate || 0 });
    g.restore();
    if (wear && (wear.face || wear.hat)) {
      g.save(); g.translate(hx + 0.5, hy - 0.2); g.scale(0.82, 0.82);
      if (wear.face) drawHeadItem(g, wear.face, 0, 0, 1, 3);
      if (wear.hat) drawHeadItem(g, wear.hat, 0, 0, 1, 3);
      g.restore();
    }
    g.restore();
  }

  // ---------- Kopek: Karabas (kangal: acik kahve govde, siyah maske) ----------
  const DOG_C = { fur: '#cfa36d', back: '#a67b48', belly: '#ead3ac', mask: '#2b2422', collar: '#b5473f' };
  function drawDogHead(g, hx, hy, t, o) {
    const C = DOG_C;
    const open = o.mouth || 0;
    // alt cene (havlarken acilir)
    g.save(); g.translate(hx + 2, hy + 6); g.rotate(open * 0.45);
    g.fillStyle = C.mask;
    g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(7, 3, 13, 0.5); g.lineTo(13, -1.5); g.quadraticCurveTo(6, -0.5, 0, -2.5); g.closePath(); g.fill();
    if (open > 0.1) { ell(g, 9, -1.4, 3, 1.2, 0.1, '#d9707a'); }
    g.restore();
    if (open > 0.1) ell(g, hx + 10, hy + 6, 4.5, 2.4 * open, 0.2, '#4a1f26');
    // kafa
    g.beginPath();
    g.moveTo(hx - 8, hy + 5);
    g.quadraticCurveTo(hx - 10, hy - 6, hx - 1, hy - 8.5);
    g.quadraticCurveTo(hx + 6, hy - 9, hx + 8, hy - 3.5);   // alin, belirgin durak
    g.quadraticCurveTo(hx + 13, hy - 3, hx + 17.5, hy - 1.5); // uzun burun
    g.quadraticCurveTo(hx + 19.5, hy + 0.5, hx + 18, hy + 3.5);
    g.quadraticCurveTo(hx + 12, hy + 6.5, hx + 3, hy + 6.5);
    g.quadraticCurveTo(hx - 5, hy + 8, hx - 8, hy + 5);
    g.closePath();
    g.fillStyle = furGrad(g, hy - 9, hy + 7, C.back, C.fur, C.fur); g.fill();
    g.save(); g.clip();
    const m = g.createLinearGradient(hx + 2, 0, hx + 12, 0); m.addColorStop(0, 'rgba(43,36,34,0)'); m.addColorStop(0.45, C.mask); m.addColorStop(1, C.mask);
    g.fillStyle = m; g.fillRect(hx - 2, hy - 10, 24, 20); // siyah maske
    g.restore();
    // burun ve goz
    ell(g, hx + 18, hy + 0.3, 2.2, 1.8, 0.2, '#141012');
    dot(g, hx + 18.3, hy - 0.4, 0.5, 'rgba(255,255,255,0.4)');
    dot(g, hx + 5.2, hy - 3.6, 1.35, '#3a2a1c'); dot(g, hx + 5.6, hy - 4, 0.4, 'rgba(255,255,255,0.75)');
    g.strokeStyle = 'rgba(20,15,15,0.6)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(hx + 3.6, hy - 5.4); g.quadraticCurveTo(hx + 5.4, hy - 6.4, hx + 7.2, hy - 5.2); g.stroke();
    if (open > 0.1) { g.fillStyle = '#f4efe6'; for (const x of [hx + 13, hx + 16]) tri(g, [x, hy + 3.6], [x + 1.4, hy + 3.6], [x + 0.7, hy + 5.4], '#f4efe6'); }
    // sarkik kulak (kosarken sallanir)
    const sw = Math.sin(t * 9) * 0.12;
    g.save(); g.translate(hx - 2, hy - 6.5); g.rotate(0.25 + sw);
    g.fillStyle = C.mask;
    g.beginPath(); g.moveTo(-3, 0); g.quadraticCurveTo(-4.5, 7, -1.5, 11.5); g.quadraticCurveTo(2.5, 9, 3.5, 0.5); g.closePath(); g.fill();
    g.restore();
  }
  function drawDogSide(g, st, t) {
    const sk = DOG_SK, pose = quadPose(sk, st, t), C = DOG_C;
    const cols = { up: C.fur, low: shadeC(C.fur, 0.06), far: shadeC(C.fur, -0.26), farLow: shadeC(C.fur, -0.2) };
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.translate(0, -28); g.rotate(pose.rot * 0.8); g.translate(0, 28);
    // kivrik kuyruk (kangal kuyrugu sirta dogru kivrilir)
    pose.tailA = -1.75 + (st.ground ? Math.sin(t * 8) * 0.12 : 0);
    const pts = tailPoints(sk, pose, t, 0.3, 0.04, 0);
    drawTail(g, sk, pts, (i, k) => (k > 0.8 ? C.back : C.fur));
    drawLeg(g, sk, pose, 0, cols); drawLeg(g, sk, pose, 2, cols);
    bodyPath(g, sk, pose.S, pose.H, pose.arch);
    g.fillStyle = furGrad(g, pose.S[1] - sk.top, pose.S[1] + sk.belly, C.back, C.fur, C.belly); g.fill();
    g.strokeStyle = 'rgba(45,30,25,0.3)'; g.lineWidth = 0.8; g.stroke();
    g.save(); g.clip();
    g.lineWidth = 0.6;
    for (let i = 0; i < 14; i++) { const x = pose.H[0] + i * ((pose.S[0] - pose.H[0]) / 14), y = pose.S[1] - sk.top + 2.5 + (i % 3) * 2; g.strokeStyle = i % 2 ? 'rgba(255,240,220,0.25)' : 'rgba(60,40,20,0.18)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2.2, y + 3.4); g.stroke(); }
    g.restore();
    drawLeg(g, sk, pose, 1, cols); drawLeg(g, sk, pose, 3, cols);
    const Hh = pose.H, S = pose.S;
    g.fillStyle = furGrad(g, Hh[1] - 9, Hh[1] + 10, C.back, C.fur, C.fur);
    g.beginPath(); g.ellipse(Hh[0] + 0.5, Hh[1] + 1, 9, 10.5, 0.25, 0, TAU); g.fill();
    const [hx, hy] = pose.head;
    // kalin boyun ve tasma
    g.beginPath();
    g.moveTo(S[0] + 1, S[1] - sk.top + 1);
    g.quadraticCurveTo(hx - 8, hy - 4, hx - 7, hy - 1);
    g.lineTo(hx - 1, hy + 7);
    g.quadraticCurveTo(S[0] + 10, S[1], S[0] + 9, S[1] + 3);
    g.closePath();
    g.fillStyle = furGrad(g, hy - 5, S[1] + 3, C.back, C.fur, C.belly); g.fill();
    g.strokeStyle = C.collar; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(hx - 7.5, hy); g.lineTo(hx - 3, hy + 7.5); g.stroke();
    dot(g, hx - 3.4, hy + 8.8, 1.3, '#e9c46a');
    drawDogHead(g, hx, hy, t, { mouth: st.mouth || 0 });
    g.restore();
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
    } else if (kind === 'balon') {
      g.arc(0, -2, 4.5, 0, Math.PI * 2); g.moveTo(0, 2.5); g.quadraticCurveTo(-2, 5, 1, 7.5);
    } else if (kind === 'yay') {
      g.moveTo(-5, 6); g.lineTo(5, 6); g.moveTo(-4, 6); g.lineTo(4, 3); g.lineTo(-4, 0); g.lineTo(4, -3); g.lineTo(-4, -6); g.moveTo(-5, -6); g.lineTo(5, -6);
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

  // ================= Sahne: gokyuzu, uzak sehir, yakindaki apartmanlar, duvarlar =================
  // Goz yormasin diye: uzak katmanlar cok yavas kayar, desenler dusuk kontrastli, yanip sonen hicbir sey yok.
  const wrap = (v, m) => ((v % m) + m) % m;
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, P.skyTop);
    g.addColorStop(1, P.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    if (P.stars > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${(P.stars * 0.55).toFixed(3)})`;
      for (const s of STARS) ctx.fillRect(wrap(s.x - camX * 0.01, W), s.y * 0.55, s.r, s.r);
    }
    const mx = W * 0.7, my = H * 0.14;
    const halo = ctx.createRadialGradient(mx, my, 14, mx, my, 70);
    halo.addColorStop(0, `rgba(${P.moonA},0.35)`);
    halo.addColorStop(1, `rgba(${P.moonA},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 70, my - 70, 140, 140);
    ctx.globalAlpha = 0.92; dot(ctx, mx, my, 20, P.moon);
    ctx.globalAlpha = 0.18; dot(ctx, mx - 6, my - 5, 6, '#ffffff');
    ctx.globalAlpha = 1;
    drawSeason();
    if (P.cloud > 0.01) {
      for (const c of CLOUDS) {
        const x = wrap(c.x - camX * 0.04, W + 200) - 100, y = 30 + c.y * 0.28;
        ctx.fillStyle = `rgba(255,255,255,${(P.cloud * 0.55).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(x, y + 2, c.w * 1.25, c.h * 1.3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${P.cloud.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y + 3, c.w, c.h * 0.8, 0, 0, TAU);
        ctx.ellipse(x - c.w * 0.35, y - 2, c.w * 0.45, c.h * 0.9, 0, 0, TAU);
        ctx.ellipse(x + c.w * 0.25, y - 5, c.w * 0.5, c.h * 1.05, 0, 0, TAU);
        ctx.fill();
      }
    }
    // uzak sehir silueti (cok yavas)
    const base = H * CAM_Y - 30 - (camY + (H * CAM_Y) / ZOOM) * 0.12;
    const off = wrap(camX * 0.1, FAR_TILE);
    zoneFade((z) => drawFar(z, base, off));
  }
  // mekan gecisi: eski mekan altta, yenisi ustte yavasca belirir
  function zoneFade(fn) {
    if (bgT < 1 && bgFrom !== bgZone) { fn(bgFrom); ctx.globalAlpha = bgT; fn(bgZone); ctx.globalAlpha = 1; }
    else fn(bgZone);
  }
  function drawSeaFar(base, off) { // sahil: uzakta tepeler, deniz, vapur ve yelkenli
    const g = ctx;
    g.fillStyle = P.city;
    g.beginPath(); g.moveTo(0, base);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, base - 30 - 18 * Math.sin((x + off * 0.6) * 0.012) - 10 * Math.sin((x + off * 0.6) * 0.031));
    g.lineTo(W, base); g.closePath(); g.fill();
    drawIstanbulSea(base);
    const sx = ((W - clock * 4 - off * 0.2) % (W + 60) + W + 60) % (W + 60) - 30, sy = base + 30; // yelkenli
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(sx, sy - 4); g.lineTo(sx, sy - 26); g.lineTo(sx + 14, sy - 4); g.closePath(); g.fill();
    g.fillStyle = '#6b5a52'; g.beginPath(); g.moveTo(sx - 9, sy - 3); g.lineTo(sx + 17, sy - 3); g.lineTo(sx + 13, sy + 1); g.lineTo(sx - 6, sy + 1); g.closePath(); g.fill();
  }
  function drawCranesFar(base, off) { // santiye: yarim binalar ve vincler
    const g = ctx;
    for (const ox of [-off, FAR_TILE - off]) {
      if (ox > W || ox + FAR_TILE < 0) continue;
      g.fillStyle = P.city;
      for (const b of SKYLINE) g.fillRect(ox + b.x, base - b.h * 0.8, b.w, b.h * 0.8 + H);
      g.strokeStyle = P.city; g.lineWidth = 1.6;
      for (const cx of [110, 380, 600]) {
        const x = ox + cx, top = base - 170;
        g.strokeRect(x - 4, top, 8, 170); // kule
        g.beginPath(); for (let y = top; y < base; y += 12) { g.moveTo(x - 4, y); g.lineTo(x + 4, y + 12); } g.stroke();
        g.fillStyle = P.city; g.fillRect(x - 40, top - 6, 120, 6); // kol
        g.fillRect(x - 46, top - 4, 14, 12); // karsi agirlik
        const hx = x + 30 + ((cx * 7) % 40);
        g.beginPath(); g.moveTo(hx, top); g.lineTo(hx, top + 50 + 10 * Math.sin(clock * 0.5 + cx)); g.stroke();
        g.fillRect(hx - 6, top + 50 + 10 * Math.sin(clock * 0.5 + cx), 12, 6); // asili yuk
      }
    }
  }
  function drawFar(z, base, off) {
    if (z === 1) return drawSeaFar(base, off);
    if (z === 2) return drawIstanbul(base, off);
    if (z === 3) return drawCranesFar(base, off);
    if (save.theme === 'istanbul') drawIstanbul(base, off);
    else {
      for (const ox of [-off, FAR_TILE - off]) {
        if (ox > W || ox + FAR_TILE < 0) continue;
        ctx.fillStyle = P.city;
        for (const b of SKYLINE) ctx.fillRect(ox + b.x, base - b.h, b.w, b.h + H);
        if (save.theme === 'kis') { ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (const b of SKYLINE) { rr(ctx, ox + b.x - 1, base - b.h - 2, b.w + 2, 5, 2.5); ctx.fill(); } }
        ctx.fillStyle = `rgba(${P.winA},0.4)`;
        for (const b of SKYLINE) for (const [lx, ly] of b.lights) ctx.fillRect(ox + b.x + lx, base - b.h + ly, 3, 4);
      }
    }
  }

  function mixA(a, b, k) { const A = a.split(',').map(Number), B = b.split(',').map(Number); return A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(','); }
  // "r,g,b" bicimindeki palet rengini acar (amt > 0) ya da koyulastirir (amt < 0)
  function shadeA(rgb, amt) {
    const [r, g, b] = rgb.split(",").map(Number);
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  // yakindaki apartman cepheleri (orta hizda), aralarindan sokak gorunur
  function drawMid() {
    const base = H * CAM_Y + 70 - (camY + (H * CAM_Y) / ZOOM) * 0.45;
    const off = wrap(camX * 0.35, MID_TILE);
    zoneFade((z) => drawMidZone(z, base, off));
    // sokak zemini ve derinlik golgesi (duvar aralarindan gorunur)
    const gy = H * CAM_Y + 150 - (camY + (H * CAM_Y) / ZOOM);
    const sg = ctx.createLinearGradient(0, base - 40, 0, Math.max(gy, base) + 60);
    sg.addColorStop(0, 'rgba(30,25,45,0)'); sg.addColorStop(1, 'rgba(30,25,45,0.38)');
    ctx.fillStyle = sg; ctx.fillRect(0, base - 40, W, H);
    ctx.fillStyle = shadeA(P.cityA, -0.32);
    ctx.fillRect(0, gy, W, H);
  }
  function drawMidZone(z, base, off) {
    const night = P.stars > 0.2;
    for (const ox of [-off, MID_TILE - off]) {
      if (ox > W || ox + MID_TILE < 0) continue;
      for (const b of MID) {
        const x = ox + b.x;
        if (x > W || x + b.w < 0) continue;
        if (z === 1) { // sahil: alcak kayikhaneler, ucgen cati, kapi
          const h = b.h * 0.42, wood = mixA(P.cityA, '170,130,95', 0.35);
          ctx.fillStyle = shadeA(wood, b.sh); ctx.fillRect(x, base - h, b.w, h + H);
          ctx.fillStyle = shadeA(wood, b.sh - 0.15);
          ctx.beginPath(); ctx.moveTo(x - 4, base - h); ctx.lineTo(x + b.w / 2, base - h - 26); ctx.lineTo(x + b.w + 4, base - h); ctx.closePath(); ctx.fill();
          ctx.fillStyle = shadeA(wood, b.sh - 0.08); for (let y = base - h + 8; y < base; y += 8) ctx.fillRect(x, y, b.w, 1.2);
          ctx.fillStyle = night ? `rgba(${P.winA},0.5)` : shadeA(wood, b.sh - 0.3); rr(ctx, x + b.w / 2 - 14, base - h * 0.6, 28, h * 0.6, 3); ctx.fill();
          continue;
        }
        if (z === 3) { // santiye: bitmemis beton iskelet, bos pencere bosluklari
          const conc = mixA(P.cityA, '170,170,165', 0.4);
          ctx.fillStyle = shadeA(conc, b.sh); ctx.fillRect(x, base - b.h, b.w, b.h + H);
          ctx.fillStyle = shadeA(conc, b.sh - 0.28);
          for (let wy = base - b.h + 8; wy < base - 8; wy += 26) for (let wx = x + 6; wx < x + b.w - 14; wx += 22) ctx.fillRect(wx, wy, 14, 16);
          ctx.fillStyle = 'rgba(126,152,196,0.55)'; ctx.fillRect(x + 4, base - b.h + 30, b.w * 0.4, 40); // mavi branda
          ctx.strokeStyle = shadeA(conc, b.sh - 0.2); ctx.lineWidth = 1.2;
          ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(x + 6 + i * (b.w - 12) / 3, base - b.h); ctx.lineTo(x + 6 + i * (b.w - 12) / 3, base - b.h - 12); } ctx.stroke(); // filiz demirleri
          continue;
        }
        ctx.fillStyle = shadeA(P.cityA, b.sh);
        ctx.fillRect(x, base - b.h, b.w, b.h + H);
        ctx.fillStyle = shadeA(P.cityA, b.sh - 0.12);
        ctx.fillRect(x - 2, base - b.h - 4, b.w + 4, 5); // cati kenari
        for (let wy = base - b.h + 14; wy < base - 10; wy += 26) {
          for (let wx = x + 8; wx < x + b.w - 12; wx += 20) {
            const lit = night && ((wx * 7 + wy * 3) | 0) % 5 < 2;
            ctx.fillStyle = lit ? `rgba(${P.winA},0.55)` : night ? shadeA(P.cityA, b.sh - 0.2) : `rgba(${P.winA},0.35)`;
            if (z === 2) { archWin(ctx, wx, wy, 9, 13); ctx.fill(); } else ctx.fillRect(wx, wy, 9, 13);
          }
        }
        if (z === 2 && b.w > 90) { // carsi: kubbe ve kursun cati
          ctx.fillStyle = shadeA(P.cityA, b.sh - 0.1);
          ctx.beginPath(); ctx.arc(x + b.w / 2, base - b.h - 2, b.w * 0.28, Math.PI, 0); ctx.fill();
          ctx.fillRect(x + b.w / 2 - 1, base - b.h - 2 - b.w * 0.28 - 8, 2, 8);
        }
      }
    }
  }

  function archWin(g, x, y, w, h) { // ust kismi kemerli pencere (Istanbul temasi)
    const r = w / 2;
    g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath();
  }
  // cati kenarlari ve altlarindaki apartman cepheleri (dunya koordinatlari)
  const FLOWERS = ['#f28fa8', '#f6c35b', '#b99be8', '#ffffff'];
  function drawPlats() {
    const bottom = camY + H / ZOOM + 30, L = camX - 30, Rr = camX + VW + 30;
    const night = P.stars > 0.2, ist = save.theme === 'istanbul', kis = save.theme === 'kis';
    const win = ist ? (x, y, w, h) => archWin(ctx, x, y, w, h) : (x, y, w, h, r) => rr(ctx, x, y, w, h, r);
    for (const q of plats) {
      if (q.x1 < L || q.x0 > Rr) continue;
      if (q.z) { drawZonePlat(q, bottom, L, Rr, night); continue; }
      const wallA = mixA(P.wallA, BUILD_TINTS[q.s % BUILD_TINTS.length], 0.55);
      ctx.fillStyle = `rgb(${wallA})`;
      ctx.fillRect(q.x0, q.y + 6, q.x1 - q.x0, bottom - q.y);
      // kat kat pencereler (cephe sabit, kediyle birlikte kayar)
      const ww = 15, wh = 22;
      for (let y = q.y + 26, r = 0; y < bottom; y += 48, r++) {
        ctx.fillStyle = shadeA(wallA, -0.06); ctx.fillRect(q.x0, y + wh + 12, q.x1 - q.x0, 2.5); // kat silmesi
        for (let x = q.x0 + 16; x + ww < q.x1 - 10; x += 40) {
          if (x + ww < L || x > Rr) continue;
          const ci = Math.round((x - q.x0) / 40), hsh = (((ci * 5 + r * 3 + Math.round(q.x0) * 7) % 7) + 7) % 7;
          const lit = night && hsh < 3;
          ctx.fillStyle = P.mark; win(x - 2.5, y - 2.5, ww + 5, wh + 5, 4); ctx.fill();
          if (night) { ctx.fillStyle = lit ? `rgba(${P.winA},0.7)` : shadeA(wallA, -0.3); win(x, y, ww, wh, 3); ctx.fill(); }
          else {
            const gg = ctx.createLinearGradient(0, y, 0, y + wh);
            gg.addColorStop(0, P.win); gg.addColorStop(1, shadeA(P.winA, -0.16));
            ctx.fillStyle = gg; win(x, y, ww, wh, 3); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(x + 2.5, y + wh - 4); ctx.lineTo(x + 8, y + 3); ctx.lineTo(x + 10.5, y + 3); ctx.lineTo(x + 5, y + wh - 4); ctx.closePath(); ctx.fill();
          }
          ctx.fillStyle = P.edge; rr(ctx, x - 4, y + wh + 2, ww + 8, 3.5, 1.5); ctx.fill(); // pervaz
          if (kis) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; rr(ctx, x - 4, y + wh + 0.5, ww + 8, 3, 1.5); ctx.fill(); }
          if (hsh === 6) { // kucuk balkon ve korkuluk
            ctx.fillStyle = shadeA(wallA, -0.18); ctx.fillRect(x - 7, y + wh + 6, ww + 14, 3);
            ctx.strokeStyle = shadeA(wallA, -0.35); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x - 7, y + wh - 6); ctx.lineTo(x + ww + 7, y + wh - 6);
            for (let bx = x - 6; bx <= x + ww + 7; bx += 4) { ctx.moveTo(bx, y + wh - 6); ctx.lineTo(bx, y + wh + 6); }
            ctx.stroke();
          }
          if (hsh === 4 || (save.theme === 'ilkbahar' && hsh === 2)) { // saksi (susleme)
            ctx.fillStyle = '#c8724f'; rr(ctx, x - 2, y + wh + 5, ww + 4, 6, 2); ctx.fill();
            for (let i = 0; i < 3; i++) { const fx = x + 2 + i * 5.5, fy = y + wh + 3 - (i % 2) * 2; dot(ctx, fx, fy, 2.2, FLOWERS[(r + i) & 3]); dot(ctx, fx, fy, 0.8, '#fff3b0'); }
          }
        }
      }
      if (ist) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(q.x0, q.y + 12, q.x1 - q.x0, 7); for (let x = q.x0 + 6; x < q.x1 - 4; x += 14) { if (x < L || x > Rr) continue; dot(ctx, x, q.y + 15.5, 2.3, '#4f7fbf'); dot(ctx, x, q.y + 15.5, 0.9, '#d9534f'); } }
      // yagmur borusu (binanin kosesinde)
      if (q.x1 - q.x0 > 260) { ctx.fillStyle = shadeA(P.pipeA, -0.05); ctx.fillRect(q.x1 - 9, q.y + 9, 3.5, bottom - q.y); for (let y = q.y + 40; y < bottom; y += 70) ctx.fillRect(q.x1 - 10.5, y, 6.5, 2.5); }
      // yan yuzlerde yumusak golge (ara sokak derinligi)
      const lg = ctx.createLinearGradient(q.x0, 0, q.x0 + 12, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(q.x0, q.y + 6, 12, bottom - q.y);
      const rg = ctx.createLinearGradient(q.x1, 0, q.x1 - 10, 0);
      rg.addColorStop(0, 'rgba(0,0,0,0.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.fillRect(q.x1 - 10, q.y + 6, 10, bottom - q.y);
      // cati kenari (parapet)
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(q.x0, q.y + 8, q.x1 - q.x0, 5);
      ctx.fillStyle = P.edge; rr(ctx, q.x0 - 3, q.y - 1, q.x1 - q.x0 + 6, 10, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(q.x0 - 1, q.y - 0.5, q.x1 - q.x0 + 2, 1.6);
      if (kis) { ctx.fillStyle = 'rgba(255,255,255,0.92)'; rr(ctx, q.x0 - 3, q.y - 3, q.x1 - q.x0 + 6, 5, 2.5); ctx.fill(); }
    }
  }

  // Mekana ozel binalar: sahil (ahsap kayikhane), carsi (tas han), santiye (beton iskelet)
  const ZONE_WALL = [null, ['176,134,98', '160,120,90', '186,146,108', '150,118,96'], ['226,204,168', '216,190,152', '230,212,184', '206,186,160'], ['190,190,184', '178,178,174', '198,194,186', '170,172,174']];
  function drawZonePlat(q, bottom, L, Rr, night) {
    const z = q.z, w = q.x1 - q.x0, wallA = mixA(P.wallA, ZONE_WALL[z][q.s % 4], 0.62);
    const x0 = Math.max(q.x0, L), x1 = Math.min(q.x1, Rr);
    ctx.fillStyle = `rgb(${wallA})`; ctx.fillRect(q.x0, q.y + 6, w, bottom - q.y);
    if (z === 1) { // ahsap: yatay tahtalar, lombar pencereler, can simidi
      ctx.fillStyle = shadeA(wallA, -0.1);
      for (let y = q.y + 16; y < bottom; y += 10) ctx.fillRect(x0, y, x1 - x0, 1.4);
      for (let y = q.y + 34, r = 0; y < bottom; y += 56, r++) for (let x = q.x0 + 28 + (r % 2) * 20; x < q.x1 - 20; x += 64) {
        if (x < L || x > Rr) continue;
        dot(ctx, x, y, 9.5, shadeA(wallA, -0.3)); dot(ctx, x, y, 7.5, night ? `rgba(${P.winA},0.7)` : P.win);
        ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 4, Math.PI, Math.PI * 1.5); ctx.lineTo(x - 1.5, y - 1.5); ctx.fill();
        if (((x * 3 + r * 7) | 0) % 5 === 0) { ctx.strokeStyle = '#e9e4dc'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x + 32, y + 4, 7, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#d9605a'; ctx.setLineDash([3.6, 3.6]); ctx.stroke(); ctx.setLineDash([]); }
      }
      ctx.fillStyle = shadeA(wallA, -0.35); rr(ctx, q.x0 - 3, q.y - 1, w + 6, 9, 2); ctx.fill(); // kalin kiris
      ctx.strokeStyle = '#c9b48f'; ctx.lineWidth = 1.6; ctx.beginPath(); // halat korkuluk
      for (let x = q.x0 + 4; x < q.x1 - 4; x += 40) { if (x < L - 40 || x > Rr) continue; ctx.moveTo(x, q.y + 3); ctx.quadraticCurveTo(x + 20, q.y + 10, x + 40, q.y + 3); }
      ctx.stroke();
    } else if (z === 2) { // tas: sira sira taslar, kemerli pencereler, ahsap kafes
      ctx.fillStyle = shadeA(wallA, -0.07);
      for (let y = q.y + 14, r = 0; y < bottom; y += 13, r++) { ctx.fillRect(x0, y, x1 - x0, 1.2); for (let x = q.x0 + (r % 2) * 14; x < q.x1; x += 28) if (x > L && x < Rr) ctx.fillRect(x, y - 12, 1.2, 12); }
      for (let y = q.y + 28; y < bottom; y += 58) for (let x = q.x0 + 22; x + 18 < q.x1 - 10; x += 46) {
        if (x + 18 < L || x > Rr) continue;
        ctx.fillStyle = shadeA(wallA, -0.15); archWin(ctx, x - 3, y - 3, 24, 34); ctx.fill();
        ctx.fillStyle = night ? `rgba(${P.winA},0.65)` : shadeA(P.winA, -0.25); archWin(ctx, x, y, 18, 28); ctx.fill();
        ctx.strokeStyle = 'rgba(120,80,50,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); // kafes
        for (let i = 1; i < 4; i++) { ctx.moveTo(x + i * 4.5, y + 4); ctx.lineTo(x + i * 4.5, y + 28); }
        for (let j = 10; j < 28; j += 6) { ctx.moveTo(x, y + j); ctx.lineTo(x + 18, y + j); }
        ctx.stroke();
      }
      ctx.fillStyle = '#9aa0ab'; rr(ctx, q.x0 - 3, q.y - 2, w + 6, 10, 3); ctx.fill(); // kursun kaplama
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(q.x0 - 1, q.y - 1.5, w + 2, 1.5);
      ctx.fillStyle = '#c56d55'; for (let x = q.x0 + 2; x < q.x1 - 6; x += 12) if (x > L && x < Rr) ctx.fillRect(x, q.y + 8, 8, 3); // kiremit sacak
    } else { // santiye: kat dosemeleri, bos acikliklar, iskele borulari
      ctx.fillStyle = shadeA(wallA, -0.12);
      for (let y = q.y + 50; y < bottom; y += 52) ctx.fillRect(x0, y, x1 - x0, 6);
      ctx.fillStyle = shadeA(wallA, -0.45);
      for (let y = q.y + 14; y < bottom; y += 52) for (let x = q.x0 + 14; x + 26 < q.x1 - 8; x += 44) if (x + 26 > L && x < Rr) ctx.fillRect(x, y, 26, 32);
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 2; ctx.beginPath(); // iskele
      for (let x = q.x0 + 8; x < q.x1; x += 88) { if (x < L - 90 || x > Rr) continue; ctx.moveTo(x, q.y + 8); ctx.lineTo(x, bottom); ctx.moveTo(x, q.y + 30); ctx.lineTo(x + 88, q.y + 82); }
      ctx.stroke();
      ctx.fillStyle = '#e2a24a'; rr(ctx, q.x0 - 3, q.y - 1, w + 6, 9, 1.5); ctx.fill(); // turuncu celik kiris
      ctx.fillStyle = '#3b3a40'; for (let x = q.x0; x < q.x1 - 6; x += 16) if (x > L - 16 && x < Rr) { ctx.beginPath(); ctx.moveTo(x, q.y + 8); ctx.lineTo(x + 6, q.y - 1); ctx.lineTo(x + 11, q.y - 1); ctx.lineTo(x + 5, q.y + 8); ctx.closePath(); ctx.fill(); } // ikaz serit
    }
    const lg = ctx.createLinearGradient(q.x0, 0, q.x0 + 12, 0); lg.addColorStop(0, 'rgba(0,0,0,0.18)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(q.x0, q.y + 6, 12, bottom - q.y);
    const rg = ctx.createLinearGradient(q.x1, 0, q.x1 - 10, 0); rg.addColorStop(0, 'rgba(0,0,0,0.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(q.x1 - 10, q.y + 6, 10, bottom - q.y);
  }

  // ---------- Mekana ozel engel gorunumleri (ayni carpisma kutusu) ----------
  function woodGrad(x0, x1, base) { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, shadeA(base, -0.18)); g.addColorStop(0.5, shadeA(base, 0.08)); g.addColorStop(1, shadeA(base, -0.2)); return g; }
  function drawCrates(o) { // sahil: ust uste balik kasalari
    const x = o.x, y = o.y;
    for (let i = 0; i < 2; i++) {
      const by = y - 17 * (i + 1), bx = x - 2 + i * 2;
      ctx.fillStyle = woodGrad(bx, bx + 26, '196,160,112'); rr(ctx, bx, by, 26 - i * 4, 16, 2); ctx.fill();
      ctx.fillStyle = 'rgba(90,60,40,0.35)'; ctx.fillRect(bx, by + 5, 26 - i * 4, 1.2); ctx.fillRect(bx, by + 10, 26 - i * 4, 1.2);
    }
    ctx.save(); ctx.translate(x + 9, y - 35); ctx.rotate(-0.3); drawFish(ctx, 0, 0, 0.8, false); ctx.restore(); // kasadan tasan balik
    ctx.save(); ctx.translate(x + 15, y - 34); ctx.rotate(0.4); drawFish(ctx, 0, 0, 0.7, false); ctx.restore();
  }
  function drawBollard(o) { // sahil: iskele babasi ve sarili halat
    const x = o.x, y = o.y, top = y - o.h;
    const g = ctx.createLinearGradient(x, 0, x + o.w, 0); g.addColorStop(0, '#3f4652'); g.addColorStop(0.45, '#6f7886'); g.addColorStop(1, '#353b46');
    ctx.fillStyle = g; rr(ctx, x + 2, top + 6, o.w - 4, o.h - 6, 3); ctx.fill();
    rr(ctx, x - 1, top, o.w + 2, 8, 4); ctx.fill();
    ctx.strokeStyle = '#d9c49b'; ctx.lineWidth = 2.6;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + o.w / 2, top + 14 + i * 4, o.w / 2 + 1, 2.4, 0, 0, Math.PI); ctx.stroke(); }
  }
  function drawSemaver(o) { // carsi: bakir semaver, ustunde caydanlik, buhar
    const x = o.x + o.w / 2, y = o.y;
    const g = ctx.createLinearGradient(x - 11, 0, x + 11, 0); g.addColorStop(0, '#9c5a34'); g.addColorStop(0.45, '#e2a066'); g.addColorStop(1, '#8a4c2c');
    ctx.fillStyle = '#6e3f26'; rr(ctx, x - 9, y - 5, 18, 5, 2); ctx.fill();
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 8, y - 5); ctx.quadraticCurveTo(x - 13, y - 18, x - 7, y - 26); ctx.lineTo(x + 7, y - 26); ctx.quadraticCurveTo(x + 13, y - 18, x + 8, y - 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c97a8a'; ell(ctx, x, y - 30, 6, 4, 0, '#e8e2d8'); ctx.fillStyle = '#d9605a'; ctx.fillRect(x - 5, y - 31, 10, 2); // caydanlik
    ctx.fillStyle = '#6e3f26'; ctx.fillRect(x + 7, y - 15, 6, 2); // musluk
    for (let i = 0; i < 2; i++) { const ph = (clock * 0.7 + i * 0.5) % 1; dot(ctx, x + Math.sin(ph * 6 + i) * 2, y - 36 - ph * 14, 2 + ph * 2, `rgba(255,255,255,${(0.45 * (1 - ph)).toFixed(2)})`); }
  }
  function drawKup(o) { // carsi: toprak kup
    const x = o.x, y = o.y, top = y - o.h, cx = x + o.w / 2;
    const g = ctx.createLinearGradient(x - 2, 0, x + o.w + 2, 0); g.addColorStop(0, '#9c5a3c'); g.addColorStop(0.45, '#d08a5e'); g.addColorStop(1, '#8a4a30');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 4, y); ctx.quadraticCurveTo(x - 4, y - o.h * 0.55, cx - 5, top + 4); ctx.lineTo(cx + 5, top + 4); ctx.quadraticCurveTo(x + o.w + 4, y - o.h * 0.55, cx + 4, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a4028'; rr(ctx, cx - 6, top, 12, 5, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,220,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - o.h * 0.5); ctx.quadraticCurveTo(cx, y - o.h * 0.42, x + o.w, y - o.h * 0.5); ctx.stroke();
  }
  function drawCementBags(o) { // santiye: cimento torbalari
    const x = o.x, y = o.y;
    const bag = (bx, by, w) => { ctx.fillStyle = '#d8d2c4'; rr(ctx, bx, by, w, 10, 4); ctx.fill(); ctx.fillStyle = '#b8b0a0'; ctx.fillRect(bx + 2, by + 7, w - 4, 2); ctx.fillStyle = '#c9605a'; ctx.fillRect(bx + w / 2 - 3, by + 3, 6, 3); };
    bag(x - 3, y - 11, 28); bag(x - 1, y - 21, 24); bag(x + 2, y - 31, 18);
  }
  function drawCone(o) { // santiye: trafik konisi
    const x = o.x, y = o.y, top = y - o.h, cx = x + o.w / 2;
    ctx.fillStyle = '#3b3a40'; rr(ctx, x - 4, y - 4, o.w + 8, 4, 1.5); ctx.fill();
    ctx.fillStyle = '#e8834e'; ctx.beginPath(); ctx.moveTo(x - 1, y - 4); ctx.lineTo(cx - 2, top); ctx.lineTo(cx + 2, top); ctx.lineTo(x + o.w + 1, y - 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4f1ea'; for (const k of [0.35, 0.65]) { const yy = y - 4 - (o.h - 4) * k, hw = (o.w / 2 + 1) * (1 - k) + 2; ctx.fillRect(cx - hw, yy - 2.5, hw * 2, 5); }
  }
  function drawIcebox(o) { // sahil: buzlu strafor balik kutulari
    const x = o.x, y = o.y, top = y - o.h;
    ctx.fillStyle = '#eef1f3'; rr(ctx, x, top + 10, o.w, o.h - 10, 3); ctx.fill();
    ctx.fillStyle = '#dfe5ea'; rr(ctx, x + 4, top + 2, o.w - 8, 10, 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,150,180,0.35)'; ctx.fillRect(x, top + 19, o.w, 1.5);
    ctx.fillStyle = '#7fa6c9'; ctx.font = '700 7px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BALIK', x + o.w / 2, y - 5);
    for (let i = 0; i < 4; i++) ell(ctx, x + 8 + i * 9, top + 2, 4, 2.5, 0.3 * i, 'rgba(220,236,248,0.95)'); // buz
  }
  function drawKazan(o) { // carsi: bakir kazan, ayakli
    const x = o.x, y = o.y, cx = x + o.w / 2;
    ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 12, y - 10); ctx.moveTo(x + o.w - 8, y); ctx.lineTo(x + o.w - 12, y - 10); ctx.stroke();
    const g = ctx.createLinearGradient(x, 0, x + o.w, 0); g.addColorStop(0, '#9c5a34'); g.addColorStop(0.4, '#e9aa70'); g.addColorStop(1, '#86482a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y - 27); ctx.lineTo(x + o.w, y - 27); ctx.quadraticCurveTo(x + o.w, y - 6, cx, y - 6); ctx.quadraticCurveTo(x, y - 6, x, y - 27); ctx.fill();
    ctx.fillStyle = '#7a4428'; rr(ctx, x - 2, y - 30, o.w + 4, 4, 2); ctx.fill();
    for (let i = 0; i < 3; i++) { const ph = (clock * 0.6 + i / 3) % 1; dot(ctx, x + 10 + i * 13, y - 32 - ph * 12, 2.5 + ph * 2, `rgba(255,255,255,${(0.4 * (1 - ph)).toFixed(2)})`); }
  }
  function drawMixer(o) { // santiye: betoniyer, kazani doner
    const x = o.x, y = o.y, cx = x + o.w * 0.45, cy = y - 16;
    dot(ctx, x + 8, y - 4, 4, '#3b3a40'); dot(ctx, x + o.w - 8, y - 4, 4, '#3b3a40');
    ctx.fillStyle = '#6c7280'; ctx.fillRect(x + 4, y - 9, o.w - 8, 4);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.35);
    const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#f0b45e'); g.addColorStop(1, '#c9803a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-15, -11); ctx.lineTo(9, -8); ctx.lineTo(18, -4); ctx.lineTo(18, 4); ctx.lineTo(9, 8); ctx.lineTo(-15, 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,20,0.4)'; ctx.lineWidth = 1.5; const sp = (clock * 14) % 8;
    ctx.beginPath(); for (let i = -14 + sp; i < 9; i += 8) { ctx.moveTo(i, -10); ctx.lineTo(i + 4, 10); } ctx.stroke();
    ctx.restore();
  }
  const STICKY_Z = [null, ['rgba(60,62,70,0.82)', 'rgba(150,170,210,0.45)'], ['rgba(214,120,140,0.78)', 'rgba(246,190,200,0.7)'], ['rgba(150,150,146,0.9)', 'rgba(200,200,196,0.7)']];
  function drawStickyZ(o) { // sahil: motor yagi, carsi: dokulmus serbet, santiye: islak cimento
    const [a, b] = STICKY_Z[o.z];
    ctx.fillStyle = a; rr(ctx, o.x, o.y - 2.5, o.w, 5, 2.5); ctx.fill();
    ctx.fillStyle = b; ctx.fillRect(o.x + 6, o.y - 2, o.w - 12, 1.2);
    if (o.z === 3) for (let x = o.x + 18; x < o.x + o.w - 10; x += 34) { dot(ctx, x, o.y - 0.5, 1.2, 'rgba(90,90,88,0.6)'); dot(ctx, x + 3, o.y - 1.5, 0.8, 'rgba(90,90,88,0.6)'); } // pati izi
    else for (let x = o.x + 12; x < o.x + o.w - 6; x += 28) ell(ctx, x, o.y + 6 + Math.sin(clock + x) * 0.6, 2.2, 4, 0, a);
  }
  function drawBarZ(o) { // ayni yukseklikte asili: sahilde balik agi, carsida hali, santiyede branda
    const y = o.y - BAR_HIGH + 2, x0 = o.x, x1 = o.x + o.w, hang = BAR_HIGH - BAR_LOW - 2, sw = Math.sin(clock * 1.6) * 0.8;
    ctx.strokeStyle = 'rgba(120,110,100,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0 - 50, y - 120); ctx.lineTo(x0 - 6, y - 2); ctx.quadraticCurveTo((x0 + x1) / 2, y + 4, x1 + 6, y - 2); ctx.lineTo(x1 + 50, y - 120); ctx.stroke();
    if (o.z === 1) {
      ctx.strokeStyle = 'rgba(110,100,90,0.75)'; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let x = x0; x <= x1; x += 7) { ctx.moveTo(x, y); ctx.lineTo(x + 4, y + hang + sw); ctx.moveTo(x + 7, y); ctx.lineTo(x + 3, y + hang + sw); }
      ctx.moveTo(x0, y + hang + sw); ctx.lineTo(x1, y + hang + sw); ctx.stroke();
      for (let x = x0 + 10; x < x1 - 4; x += 22) ell(ctx, x, y + hang + sw, 3.4, 2.4, 0, '#e8834e'); // samandiralar
    } else if (o.z === 2) {
      const HC = [['#a8443f', '#e9c46a', '#3f4f7a'], ['#3f4f7a', '#e8a0a8', '#a8443f'], ['#7a3f5a', '#f2e6cf', '#c98a3f']];
      for (let x = x0 + 2, i = 0; x < x1 - 20; x += 34, i++) {
        const c = HC[(i + (o.v || 0)) % 3];
        ctx.fillStyle = c[0]; rr(ctx, x, y, 28, hang + sw, 1.5); ctx.fill();
        ctx.fillStyle = c[1]; rr(ctx, x + 3, y + 3, 22, hang + sw - 6, 1); ctx.fill();
        ctx.fillStyle = c[2]; ctx.beginPath(); ctx.moveTo(x + 14, y + 5); ctx.lineTo(x + 21, y + hang / 2); ctx.lineTo(x + 14, y + hang - 5 + sw); ctx.lineTo(x + 7, y + hang / 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c[1]; for (let fx = x + 1; fx < x + 28; fx += 3) ctx.fillRect(fx, y + hang + sw, 1, 2.5); // sacak
      }
    } else {
      ctx.fillStyle = '#7e98c4'; rr(ctx, x0 + 2, y, o.w - 4, hang + sw, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = x0 + 12; x < x1 - 6; x += 20) ctx.fillRect(x, y + 2, 1.2, hang - 4);
      ctx.fillStyle = '#d9605a'; for (let x = x0 + 4; x < x1 - 8; x += 16) { ctx.beginPath(); ctx.moveTo(x, y + hang + sw); ctx.lineTo(x + 8, y + hang + sw); ctx.lineTo(x + 4, y + hang + 6 + sw); ctx.closePath(); ctx.fill(); } // ikaz bayraklari
    }
  }
  function drawSignZ(o) { // sahilde balikci tabelasi, carsida fener sirasi, santiyede vincte asili tugla paleti
    const x = o.x, y = o.y, top = y - o.h, by = y - 64, cx = x + o.w / 2;
    const sw = Math.sin(clock * 1.4 + x) * 0.025;
    if (o.z === 3) {
      ctx.strokeStyle = '#5f6675'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, top - 40); ctx.lineTo(cx, by - 8); ctx.moveTo(cx, by - 8); ctx.lineTo(x - 2, by); ctx.moveTo(cx, by - 8); ctx.lineTo(x + o.w + 2, by); ctx.stroke();
      ctx.strokeStyle = '#e2a24a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, by - 12, 4, 0, Math.PI * 1.4); ctx.stroke(); // kanca
      ctx.save(); ctx.translate(cx, by); ctx.rotate(sw);
      ctx.fillStyle = '#8a6a48'; ctx.fillRect(-o.w / 2 - 4, 40, o.w + 8, 6); // palet
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = (r + c) % 2 ? '#c4664e' : '#b55a44'; ctx.fillRect(-o.w / 2 - 3 + c * 14 + (r % 2) * 3, r * 8, 12, 7); }
      ctx.restore();
    } else {
      ctx.fillStyle = '#6f7686'; ctx.fillRect(x - 6, top, o.w + 12, 5);
      ctx.strokeStyle = '#7d8492'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x + 5, top + 5); ctx.lineTo(x + 5, by); ctx.moveTo(x + o.w - 5, top + 5); ctx.lineTo(x + o.w - 5, by); ctx.stroke();
      ctx.save(); ctx.translate(cx, by); ctx.rotate(sw);
      if (o.z === 1) {
        ctx.fillStyle = woodGrad(-o.w / 2 - 4, o.w / 2 + 4, '170,128,88'); rr(ctx, -o.w / 2 - 4, 0, o.w + 8, 46, 4); ctx.fill();
        ctx.fillStyle = 'rgba(80,50,30,0.3)'; ctx.fillRect(-o.w / 2 - 4, 15, o.w + 8, 1.2); ctx.fillRect(-o.w / 2 - 4, 30, o.w + 8, 1.2);
        ctx.save(); ctx.translate(0, 23); ctx.scale(1.4, 1.4); drawFish(ctx, 0, 0, 1, false); ctx.restore();
      } else { // carsi: bakir fenerler
        for (const lx of [-9, 9]) {
          ctx.strokeStyle = '#7d5a3c'; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 6); ctx.stroke();
          ctx.fillStyle = '#9c6a3c'; ctx.beginPath(); ctx.moveTo(lx - 5, 6); ctx.lineTo(lx + 5, 6); ctx.lineTo(lx + 3, 11); ctx.lineTo(lx - 3, 11); ctx.closePath(); ctx.fill();
          const lg = ctx.createRadialGradient(lx, 26, 2, lx, 26, 14); lg.addColorStop(0, 'rgba(255,214,140,0.95)'); lg.addColorStop(1, 'rgba(232,150,80,0.85)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(lx, 26, 8, 15, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(120,70,40,0.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(lx, 11); ctx.lineTo(lx, 41); ctx.moveTo(lx - 7, 26); ctx.lineTo(lx + 7, 26); ctx.stroke();
          ctx.fillStyle = '#9c6a3c'; ctx.fillRect(lx - 3, 40, 6, 5);
        }
      }
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x - 4, y - 1, o.w + 8, 2);
  }
  function drawRoller(o) { // sahilde yengec, carsida yuvarlanan karpuz, santiyede el arabasi (kediye dogru gelir)
    const x = o.x, y = o.y, cx = x + o.w / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(cx, y, o.w / 2 + 2, 2.2, 0, 0, TAU); ctx.fill();
    if (o.z === 1) {
      const st = Math.sin(clock * 16);
      ctx.strokeStyle = '#b8503f'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 3; i++) for (const s2 of [-1, 1]) { const lx = cx + s2 * (5 + i * 3); ctx.moveTo(lx, y - 5); ctx.lineTo(lx + s2 * 3, y - 2 + (i % 2 ? st : -st)); ctx.lineTo(lx + s2 * 4, y); }
      ctx.stroke();
      ell(ctx, cx, y - 7, 11, 6.5, 0, '#d9604a'); ell(ctx, cx - 2, y - 9, 6, 2.5, 0, 'rgba(255,200,180,0.35)');
      for (const s2 of [-1, 1]) { ell(ctx, cx + s2 * 13, y - 12 + st * 0.6, 4, 3, s2 * 0.5, '#d9604a'); ctx.strokeStyle = '#d9604a'; ctx.beginPath(); ctx.moveTo(cx + s2 * 8, y - 8); ctx.lineTo(cx + s2 * 12, y - 11); ctx.stroke(); }
      for (const s2 of [-1, 1]) { ctx.strokeStyle = '#8a3a2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + s2 * 3, y - 12); ctx.lineTo(cx + s2 * 3, y - 16); ctx.stroke(); dot(ctx, cx + s2 * 3, y - 16.5, 1.5, '#1c1418'); }
    } else if (o.z === 2) {
      ctx.save(); ctx.translate(cx, y - 7); ctx.rotate(-clock * 6);
      dot(ctx, 0, 0, 7.5, '#b8463f'); // nar
      ctx.fillStyle = '#8a3530'; for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i - 1.5) * 0.35; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a + 0.18) * 6.5, Math.sin(a + 0.18) * 6.5); ctx.fill(); } // tac
      ctx.restore();
      dot(ctx, cx - 2.5, y - 10, 2, 'rgba(255,255,255,0.25)');
    } else {
      ctx.fillStyle = '#5f6675'; ctx.save(); ctx.translate(cx, y - 8); ctx.rotate(-clock * 8); ctx.fillRect(-1, -4, 2, 8); ctx.restore();
      dot(ctx, cx - 6, y - 4, 4, '#3b3a40'); dot(ctx, cx - 6, y - 4, 1.4, '#9aa0ab');
      ctx.fillStyle = '#e2a24a'; ctx.beginPath(); ctx.moveTo(x - 2, y - 14); ctx.lineTo(x + o.w - 4, y - 14); ctx.lineTo(x + o.w - 8, y - 6); ctx.lineTo(x + 4, y - 6); ctx.closePath(); ctx.fill();
      ell(ctx, cx - 2, y - 14, 11, 3, 0, '#b8b0a0'); // kum
      ctx.strokeStyle = '#6f5a44'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x + o.w - 6, y - 10); ctx.lineTo(x + o.w + 8, y - 16); ctx.moveTo(x + o.w - 6, y - 7); ctx.lineTo(x + o.w - 2, y); ctx.stroke();
    }
  }
  const AWN_Z = [null, [['#7fa6c9', '#f4f1ea'], ['#4f7fbf', '#ffffff'], ['#e8834e', '#f4f1ea']], [['#a8443f', '#f2e6cf'], ['#3f4f7a', '#e9c46a'], ['#7a3f5a', '#f2e6cf']], null];

  // ---------- Engeller (duvar ustunde) ----------
  function drawVacuum(o) { // dik elektrik supurgesi: kedilerin korkulu ruyasi
    const x = o.x, y = o.y;
    ctx.strokeStyle = shadeA(P.hoseA, -0.3); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 4, y - 14); ctx.quadraticCurveTo(x - 6, y - 8, x + 2, y - 4); ctx.stroke(); // hortum
    ctx.strokeStyle = '#8a8f9c'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x + o.w - 6, y - 22); ctx.lineTo(x + o.w - 3, y - o.h); ctx.stroke(); // sap
    ctx.fillStyle = '#5f6675'; rr(ctx, x + o.w - 7, y - o.h - 2, 8, 5, 2.5); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + o.w, 0);
    g.addColorStop(0, shadeA(P.hoseA, -0.2)); g.addColorStop(0.5, shadeA(P.hoseA, 0.2)); g.addColorStop(1, shadeA(P.hoseA, -0.22));
    ctx.fillStyle = g; rr(ctx, x + 2, y - 26, o.w - 6, 20, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x + 5, y - 23, 3, 13, 1.5); ctx.fill();
    ctx.fillStyle = '#4f5563'; rr(ctx, x - 2, y - 7, o.w + 2, 7, 3); ctx.fill(); // emici baslik
    for (let i = 0; i < 3; i++) {
      const ph = (clock * 1.6 + i / 3) % 1;
      dot(ctx, x - 6 - (1 - ph) * 10, y - 3 - (i - 1) * 2 * (1 - ph), 1.2, `rgba(120,110,100,${(0.5 * (1 - ph)).toFixed(2)})`);
    }
  }
  function drawPipe(o) { // duvardan cikan islak boru: ucundan su damlar
    const x = o.x, y = o.y, top = y - o.h;
    ctx.fillStyle = 'rgba(90,120,160,0.18)'; ctx.beginPath(); ctx.ellipse(x + o.w / 2 + 8, y + 1, 16, 2.5, 0, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + o.w, 0);
    g.addColorStop(0, shadeA(P.pipeA, -0.22)); g.addColorStop(0.4, shadeA(P.pipeA, 0.28)); g.addColorStop(1, shadeA(P.pipeA, -0.25));
    ctx.fillStyle = g;
    rr(ctx, x + 2, top + 6, o.w - 4, o.h - 6, 3); ctx.fill();
    rr(ctx, x + 2, top, o.w + 8, o.w - 6, 5); ctx.fill(); // dirsek
    ctx.fillStyle = shadeA(P.pipeA, -0.35);
    rr(ctx, x + o.w + 6, top - 1, 4, o.w - 4, 2); ctx.fill(); // agiz
    ctx.fillStyle = shadeA(P.pipeA, -0.28);
    for (let yy = y - 10; yy > top + 10; yy -= 12) { rr(ctx, x, yy, o.w, 4, 2); ctx.fill(); } // kelepceler
    for (let i = 0; i < 2; i++) {
      const ph = (clock * 0.9 + i * 0.5) % 1;
      ell(ctx, x + o.w + 8, top + o.w - 2 + ph * (o.h - o.w + 2), 1.6, 2.4, 0, `rgba(120,170,220,${(0.85 * (1 - ph)).toFixed(2)})`);
    }
  }
  function drawAC(o) { // klima dis unitesi, pervanesi doner
    const x = o.x, y = o.y, top = y - o.h;
    ctx.fillStyle = '#6f7686'; ctx.fillRect(x + 4, y - 3, 4, 3); ctx.fillRect(x + o.w - 8, y - 3, 4, 3);
    const g = ctx.createLinearGradient(0, top, 0, y);
    g.addColorStop(0, '#d8dbe1'); g.addColorStop(1, '#aeb3bd');
    ctx.fillStyle = g; rr(ctx, x, top, o.w, o.h - 3, 3); ctx.fill();
    const cx = x + o.w * 0.38, cy = top + (o.h - 3) / 2, r = (o.h - 3) * 0.38;
    dot(ctx, cx, cy, r + 1.5, '#8d93a0'); dot(ctx, cx, cy, r, '#6c7280');
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(clock * 7);
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ell(ctx, r * 0.45, 0, r * 0.45, r * 0.2, 0, '#9aa1ad'); }
    ctx.restore();
    dot(ctx, cx, cy, 1.4, '#c9ccd6');
    ctx.fillStyle = '#9aa1ad'; for (let yy = top + 5; yy < y - 7; yy += 4) ctx.fillRect(x + o.w * 0.72, yy, o.w * 0.2, 1.6);
    dot(ctx, x + o.w - 4, y + ((jetClock * 30) % 14), 1.4, 'rgba(143,184,222,0.6)');
  }
  function drawJet(o) { // fiskiye: acilinca su yayi duvar ustunu kaplar
    const x = o.x, y = o.y;
    ctx.fillStyle = '#7d8696'; rr(ctx, x, y - 6, 8, 6, 2); ctx.fill();
    dot(ctx, x + 6, y - 6, 2.4, '#5f6675');
    if (jetOn(o)) {
      const wob = Math.sin(jetClock * 6 + o.phase) * 1.5;
      ctx.fillStyle = 'rgba(143,184,222,0.5)';
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 6);
      ctx.quadraticCurveTo(x + JET_W * 0.45, y - JET_H * 2 - 4 + wob, x + JET_W, y - 1);
      ctx.lineTo(x + JET_W - 10, y - 1);
      ctx.quadraticCurveTo(x + JET_W * 0.45, y - JET_H * 1.3 + wob, x + 8, y - 4);
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < 5; i++) dot(ctx, x + 10 + ((jetClock * 60 + i * 13) % (JET_W - 10)), y - 3 - ((i * 7) % 9), 1.4, 'rgba(200,225,240,0.6)');
    } else if (jetWarn(o)) {
      for (let i = 0; i < 3; i++) dot(ctx, x + 8 + i * 3, y - 8 - ((jetClock * 20 + i * 4) % 8), 1.4, 'rgba(143,184,222,0.7)');
    }
  }
  function drawSticky(o) { // duvar ustune dokulmus bal
    ctx.fillStyle = 'rgba(217,164,65,0.82)';
    rr(ctx, o.x, o.y - 2.5, o.w, 5, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(245,205,120,0.7)'; ctx.fillRect(o.x + 6, o.y - 2, o.w - 12, 1.2);
    for (let x = o.x + 12; x < o.x + o.w - 6; x += 28) ell(ctx, x, o.y + 6 + Math.sin(clock + x) * 0.6, 2.2, 4, 0, 'rgba(217,164,65,0.8)');
  }
  const CLOTH_COLORS = [['#8fb8de', '#e8a0a8', '#e9c46a'], ['#a9cf9b', '#c9b3e0', '#e8a0a8'], ['#e9c46a', '#8fb8de', '#d9d2c4']];
  function drawClothesline(o) { // yukaridaki pencerelerden gerilmis ip; altindan kosarak gecilir
    const y = o.y - BAR_HIGH + 2, x0 = o.x, x1 = o.x + o.w, col = CLOTH_COLORS[o.v || 0];
    ctx.strokeStyle = 'rgba(120,110,100,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0 - 50, y - 120); ctx.lineTo(x0 - 6, y - 2); ctx.quadraticCurveTo((x0 + x1) / 2, y + 4, x1 + 6, y - 2); ctx.lineTo(x1 + 50, y - 120); ctx.stroke();
    const sw = Math.sin(clock * 1.6) * 0.8;
    let x = x0 + 2;
    const hang = BAR_HIGH - BAR_LOW - 2;
    while (x < x1 - 14) {
      const k = Math.floor((x - x0) / 30) % 3, w = k === 2 ? 26 : 18;
      ctx.fillStyle = col[k];
      if (k === 0) { // tisort
        ctx.beginPath();
        ctx.moveTo(x + 4, y); ctx.lineTo(x + w - 4, y); ctx.lineTo(x + w + 1, y + 5); ctx.lineTo(x + w - 3, y + 7);
        ctx.lineTo(x + w - 4, y + hang + sw); ctx.lineTo(x + 4, y + hang + sw); ctx.lineTo(x + 3, y + 7); ctx.lineTo(x - 1, y + 5); ctx.closePath(); ctx.fill();
      } else if (k === 1) { // corap
        ctx.fillRect(x + 4, y, 7, hang - 5); rr(ctx, x + 4, y + hang - 8 + sw, 12, 7, 3.5); ctx.fill();
      } else { rr(ctx, x, y, w, hang + sw, 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + hang - 5, w, 2); }
      ctx.fillStyle = '#c9b79c'; ctx.fillRect(x + 5, y - 2.5, 2.5, 5);
      x += w + 8;
    }
  }

  function drawSign(o) { // yukaridan zincirle sarkan dukkan tabelasi: altindan kayarak gecilir
    const x = o.x, y = o.y, top = y - o.h, by = y - 64;
    ctx.fillStyle = '#6f7686'; ctx.fillRect(x - 6, top, o.w + 12, 5); // ust demir kol
    ctx.strokeStyle = '#7d8492'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x + 5, top + 5); ctx.lineTo(x + 5, by); ctx.moveTo(x + o.w - 5, top + 5); ctx.lineTo(x + o.w - 5, by); ctx.stroke();
    const sw = Math.sin(clock * 1.4 + x) * 0.025;
    ctx.save(); ctx.translate(x + o.w / 2, by); ctx.rotate(sw);
    const cols = [['#c98f5a', '#a8703f'], ['#7f9fc4', '#5f7fa4'], ['#c97a7a', '#a85c5c']][o.v || 0];
    const g = ctx.createLinearGradient(0, 0, 0, 46); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    ctx.fillStyle = g; rr(ctx, -o.w / 2 - 4, 0, o.w + 8, 46, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2; rr(ctx, -o.w / 2 - 1.5, 2.5, o.w + 3, 41, 3); ctx.stroke();
    ctx.save(); ctx.translate(0, 23); ctx.scale(1.3, 1.3); drawFish(ctx, 0, 0, 1, false); ctx.restore();
    ctx.restore();
    // uyari: yerde alcak golge isareti
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x - 4, y - 1, o.w + 8, 2);
  }
  function drawRoomba(o) { // robot supurge: duz yuvarlak, kediye dogru gelir
    const x = o.x, y = o.y;
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(x + o.w / 2, y, o.w / 2 + 2, 2.2, 0, 0, TAU); ctx.fill();
    const g = ctx.createLinearGradient(0, y - o.h, 0, y);
    g.addColorStop(0, '#5d6472'); g.addColorStop(1, '#3d434f');
    ctx.fillStyle = g; rr(ctx, x, y - o.h, o.w, o.h - 2, 6); ctx.fill();
    ctx.fillStyle = '#7d8492'; rr(ctx, x + 4, y - o.h - 2, o.w - 8, 4, 2); ctx.fill();
    dot(ctx, x + 6, y - o.h + 5, 1.4, '#8fd18a'); // sabit yanan isik
    ctx.fillStyle = '#2b2f37'; ctx.fillRect(x + 3, y - 3, 5, 3); ctx.fillRect(x + o.w - 8, y - 3, 5, 3);
    for (let i = 0; i < 3; i++) { const ph = (clock * 2 + i / 3) % 1; dot(ctx, x + o.w + 3 + ph * 12, y - 3 - i * 2, 1.2, `rgba(150,140,130,${(0.5 * (1 - ph)).toFixed(2)})`); }
  }
  // bina arasi: arka duvar (ic avlu), sol bina ve duvarlardaki hortum/borular
  function drawDeco() {
    for (const q of plats) {
      if (!q.deco || q.x1 < camX - 40 || q.x0 > camX + VW + 40) continue;
      for (const d of q.deco) {
        if (d.x < camX - 40 || d.x > camX + VW + 40) continue;
        const base = q.y - 1, col = shadeA(mixA(P.cityA, P.wallA, 0.35), -0.05), dark = shadeA(mixA(P.cityA, P.wallA, 0.35), -0.22);
        ctx.save(); ctx.globalAlpha = 0.85;
        if (d.k === 'baca') { ctx.fillStyle = col; ctx.fillRect(d.x, base - 30, 12, 30); ctx.fillStyle = dark; ctx.fillRect(d.x - 2, base - 33, 16, 4); if (P.stars < 0.5) { ctx.globalAlpha = 0.25; dot(ctx, d.x + 6 + Math.sin(clock + d.v * 9) * 2, base - 40 - ((clock * 8 + d.v * 30) % 20), 4, '#ffffff'); } }
        else if (d.k === 'anten') { ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(d.x, base); ctx.lineTo(d.x, base - 46); for (let i = 0; i < 3; i++) { ctx.moveTo(d.x - 9 + i * 2, base - 40 + i * 7); ctx.lineTo(d.x + 9 - i * 2, base - 40 + i * 7); } ctx.stroke(); }
        else if (d.k === 'canak') { ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(d.x, base); ctx.lineTo(d.x + 2, base - 14); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(d.x + 3, base - 20, 5, 9, -0.5, 0, TAU); ctx.fill(); }
        else if (d.k === 'fener') { ctx.fillStyle = dark; ctx.fillRect(d.x, base - 40, 2.5, 40); ctx.fillRect(d.x - 3, base - 44, 8.5, 5); dot(ctx, d.x + 1.2, base - 47, 3.2, P.stars > 0.2 ? '#ffd98c' : col); }
        else if (d.k === 'halat') { ctx.strokeStyle = '#c9b48f'; ctx.lineWidth = 2.2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(d.x + 8, base - 2 - i * 2.4, 10 - i * 2, 2.6, 0, 0, TAU); ctx.stroke(); } }
        else if (d.k === 'kubbe') { ctx.fillStyle = col; ctx.fillRect(d.x - 2, base - 10, 28, 10); ctx.beginPath(); ctx.arc(d.x + 12, base - 10, 12, Math.PI, 0); ctx.fill(); ctx.fillStyle = dark; ctx.fillRect(d.x + 11, base - 28, 2, 7); dot(ctx, d.x + 12, base - 29, 2, dark); }
        else if (d.k === 'demir') { ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(d.x + i * 5, base); ctx.lineTo(d.x + i * 5 + (i - 2) * 0.8, base - 26 - (i % 2) * 6); } ctx.stroke(); }
        else if (d.k === 'kum') { ctx.fillStyle = 'rgba(196,176,140,0.95)'; ctx.beginPath(); ctx.moveTo(d.x - 4, base); ctx.quadraticCurveTo(d.x + 14, base - 26, d.x + 34, base); ctx.closePath(); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(d.x + 20, base - 12); ctx.lineTo(d.x + 30, base - 30); ctx.stroke(); }
        else if (d.k === 'depo') { ctx.fillStyle = col; rr(ctx, d.x, base - 26, 26, 22, 4); ctx.fill(); ctx.fillStyle = dark; ctx.fillRect(d.x + 3, base - 4, 3, 4); ctx.fillRect(d.x + 20, base - 4, 3, 4); ctx.fillRect(d.x, base - 18, 26, 2); }
        else { ctx.fillStyle = col; ctx.fillRect(d.x, base - 18, 34, 18); ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(d.x - 3, base - 18); ctx.lineTo(d.x + 17, base - 28); ctx.lineTo(d.x + 37, base - 18); ctx.closePath(); ctx.fill(); } // kucuk cati odasi
        ctx.restore();
      }
    }
  }
  function drawShaftBack() {
    for (const sh of shafts) {
      if (sh.x1 < camX - 60 || sh.x0 - 40 > camX + VW + 20) continue;
      const g = ctx.createLinearGradient(0, sh.yt - 60, 0, sh.yb);
      g.addColorStop(0, shadeA(P.wallA, -0.18)); g.addColorStop(1, shadeA(P.wallA, -0.38));
      ctx.fillStyle = g; ctx.fillRect(sh.x0 - 34, sh.yt - 60, sh.x1 - sh.x0 + 40, sh.yb - sh.yt + 62);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let y = sh.yt - 40; y < sh.yb - 10; y += 46) ctx.fillRect((sh.x0 + sh.x1) / 2 - 7, y, 14, 20); // kucuk havalandirma pencereleri
      ctx.strokeStyle = shadeA(P.pipeA, -0.15); ctx.lineWidth = 3; // arka duvarda uzun su borusu
      ctx.beginPath(); ctx.moveTo(sh.x0 + 18, sh.yt - 60); ctx.lineTo(sh.x0 + 18, sh.yb); ctx.stroke();
    }
  }
  function drawShaftFront() {
    for (const sh of shafts) {
      if (sh.x1 < camX - 60 || sh.x0 - 40 > camX + VW + 20) continue;
      // sol bina: ust catiya kadar yukselir, altinda kemerli gecit vardir
      const lx0 = sh.x0 - 30, top = sh.yt - 46, pb = sh.yb - PASSAGE_H;
      ctx.fillStyle = shadeA(P.wallA, 0.04); ctx.fillRect(lx0, top, 30, pb - top);
      for (let y = top + 22; y < pb - 30; y += 48) { ctx.fillStyle = P.mark; rr(ctx, lx0 + 7, y, 16, 22, 3); ctx.fill(); ctx.fillStyle = P.stars > 0.2 ? `rgba(${P.winA},0.55)` : P.win; rr(ctx, lx0 + 9, y + 2, 12, 18, 2); ctx.fill(); }
      ctx.fillStyle = P.edge; rr(ctx, lx0 - 3, top - 2, 36, 9, 3); ctx.fill();
      ctx.fillStyle = shadeA(P.wallA, -0.12); ctx.beginPath(); ctx.moveTo(lx0, pb); ctx.lineTo(lx0 + 30, pb); ctx.lineTo(lx0 + 30, pb + 6); ctx.quadraticCurveTo(lx0 + 15, pb - 4, lx0, pb + 6); ctx.closePath(); ctx.fill();
      const ig = ctx.createLinearGradient(sh.x0, 0, sh.x0 + 12, 0); ig.addColorStop(0, 'rgba(0,0,0,0.18)'); ig.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ig; ctx.fillRect(sh.x0, top, 12, pb - top);
      // duvarlardaki tehlikeler
      for (const h of sh.haz) {
        const wx = h.side === 0 ? sh.x0 : sh.x1, s2 = h.side === 0 ? 1 : -1, hh = h.y1 - h.y0;
        if (h.kind === 'hose') {
          const g = ctx.createLinearGradient(0, h.y0, 0, h.y1);
          g.addColorStop(0, shadeA(P.hoseA, 0.15)); g.addColorStop(1, shadeA(P.hoseA, -0.2));
          ctx.fillStyle = g; rr(ctx, h.side === 0 ? wx : wx - 13, h.y0, 13, hh, 5); ctx.fill();
          ctx.fillStyle = 'rgba(60,20,30,0.16)'; for (let y = h.y0 + 5; y < h.y1 - 3; y += 7) ctx.fillRect(h.side === 0 ? wx : wx - 13, y, 13, 2);
          ctx.fillStyle = '#4f5563'; rr(ctx, h.side === 0 ? wx : wx - 17, h.y1 - 6, 17, 7, 3); ctx.fill();
        } else {
          const g = ctx.createLinearGradient(0, h.y0, 0, h.y1);
          g.addColorStop(0, shadeA(P.pipeA, 0.25)); g.addColorStop(1, shadeA(P.pipeA, -0.22));
          ctx.fillStyle = g; rr(ctx, h.side === 0 ? wx : wx - 11, h.y0, 11, hh, 3); ctx.fill();
          const ph = (clock * 0.9 + h.y0 * 0.01) % 1;
          ell(ctx, wx + s2 * 13, h.y1 + ph * 30, 1.6, 2.4, 0, `rgba(120,170,220,${(0.85 * (1 - ph)).toFixed(2)})`);
        }
      }
    }
  }
  const AWN = [['#e8a0a8', '#fbeee2'], ['#8fb8de', '#f4f1ea'], ['#e9c46a', '#fbf3df']];
  function drawLedges() { // cizgili tenteler (ust rota)
    for (const l of ledges) {
      if (l.x1 < camX - 20 || l.x0 > camX + VW + 20) continue;
      if (l.z === 3) { // santiye: iskele tahtasi ve borulari
        ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 2;
        ctx.beginPath(); for (let x = l.x0 + 10; x < l.x1; x += 60) { ctx.moveTo(x, l.y + 6); ctx.lineTo(x, l.y + LEDGE_UP); ctx.moveTo(x, l.y + 6); ctx.lineTo(Math.min(l.x1 - 4, x + 50), l.y + LEDGE_UP); } ctx.stroke();
        ctx.fillStyle = '#c9a070'; rr(ctx, l.x0, l.y, l.x1 - l.x0, 7, 1.5); ctx.fill();
        ctx.fillStyle = 'rgba(90,60,40,0.3)'; for (let x = l.x0 + 40; x < l.x1; x += 40) ctx.fillRect(x, l.y, 1.4, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(l.x0, l.y, l.x1 - l.x0, 1.4);
        continue;
      }
      const c = (l.z && AWN_Z[l.z] ? AWN_Z[l.z] : AWN)[l.c || 0], w = l.x1 - l.x0;
      ctx.strokeStyle = 'rgba(90,90,100,0.45)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(l.x0 + 12, l.y + 8); ctx.lineTo(l.x0 + 30, l.y + LEDGE_UP - 2); ctx.moveTo(l.x1 - 12, l.y + 8); ctx.lineTo(l.x1 - 30, l.y + LEDGE_UP - 2); ctx.stroke();
      for (let x = l.x0, i = 0; x < l.x1; x += 14, i++) { ctx.fillStyle = c[i % 2]; ctx.fillRect(x, l.y, Math.min(14, l.x1 - x), 8); }
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(l.x0, l.y, w, 1.5);
      for (let x = l.x0, i = 0; x < l.x1 - 1; x += 14, i++) { ctx.fillStyle = c[i % 2]; ctx.beginPath(); ctx.arc(x + 7, l.y + 8, 7, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(l.x0, l.y + 6, w, 2);
    }
  }
  function drawStray(p) { // catida oturan kayip yavru: gelen kediye bakar, ara sira miyavlar
    const s = STRAY_BY_ID[p.id], y = p.y + 10;
    ctx.fillStyle = 'rgba(246,195,91,0.18)'; ctx.beginPath(); ctx.ellipse(p.x, y - 8, 22, 18, 0, 0, TAU); ctx.fill(); // yumusak hale: dikkat ceksin
    ctx.save(); ctx.translate(p.x, y); ctx.scale(-0.6, 0.6);
    drawCatSide(ctx, s, { sit: true, mouth: (clock % 2.2) < 0.35 ? 1 : 0 }, clock + p.x * 0.01, {});
    ctx.restore();
    if ((clock % 2.2) < 0.9) {
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; rr(ctx, p.x - 22, y - 46, 44, 15, 7); ctx.fill();
      ctx.fillStyle = '#7a5a48'; ctx.font = '700 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(save.strays[p.id] ? 'Miyav!' : 'Yardım!', p.x, y - 35.5);
    }
  }
  function drawBox(x, y) { // hediye kutusu
    ctx.fillStyle = 'rgba(185,155,232,0.25)'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b99be8'; rr(ctx, x - 9, y - 6, 18, 14, 2); ctx.fill();
    ctx.fillStyle = '#a585d8'; ctx.fillRect(x - 10, y - 9, 20, 5);
    ctx.fillStyle = '#f6c35b'; ctx.fillRect(x - 1.8, y - 9, 3.6, 17);
    ell(ctx, x - 4, y - 11, 4, 2.4, -0.4, '#f6c35b'); ell(ctx, x + 4, y - 11, 4, 2.4, 0.4, '#f6c35b');
  }
  function drawItems() {
    for (const c of coins) {
      if (c.taken || c.x < camX - 20 || c.x > camX + VW + 20) continue;
      drawFish(ctx, c.x, c.y + Math.sin(clock * 3 + c.x * 0.05) * 1.2, 1, false);
    }
    for (const p of powerups) {
      if (p.taken || p.x < camX - 20 || p.x > camX + VW + 20) continue;
      if (p.kind === 'box') { drawBox(p.x, p.y + Math.sin(clock * 2.5) * 2); continue; }
      if (p.kind === 'stray') { drawStray(p); continue; }
      ctx.save();
      ctx.translate(p.x, p.y + Math.sin(clock * 2.5) * 2);
      dot(ctx, 0, 0, 15, POWERS[p.kind].color + '33');
      dot(ctx, 0, 0, 12, POWERS[p.kind].color);
      drawPowerIcon(ctx, p.kind);
      ctx.restore();
    }
  }

  function drawFinish() {
    if (!run || (run.mode !== 'level' && run.mode !== 'tutorial') || !isFinite(run.goal)) return;
    const x = run.goal;
    if (x < camX - 40 || x > camX + VW + 40) return;
    const q = platAt(x) || { y: player.y };
    ctx.fillStyle = '#7d8492'; ctx.fillRect(x - 1.5, q.y - 92, 3, 92);
    const sq = 8;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#f4f1ea' : '#4a4550';
      ctx.fillRect(x + 1.5 + i * sq, q.y - 92 + j * sq + Math.sin(clock * 3 + i) * 1.2, sq, sq);
    }
    for (let j = 0; j < 4; j++) { ctx.fillStyle = j % 2 ? '#f4f1ea' : '#4a4550'; ctx.fillRect(x - 4, q.y + j * 6, 8, 6); }
  }

  function drawRecord() { // golge rakip: onceki en uzak mesafen
    if (!run || run.recordM <= 20 || run.passedRecord) return;
    const x = run.recordM * METER;
    if (x < camX - 40 || x > camX + VW + 40) return;
    const q = platAt(x) || { y: player.lastGy };
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = COIN_HI; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(x, q.y - 110); ctx.lineTo(x, q.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.38;
    ctx.translate(x + 6, q.y); ctx.scale(CAT_DRAW, CAT_DRAW);
    drawCatSide(ctx, CAT_BY_ID[save.char], { idle: true }, clock, outfit());
    ctx.restore();
    ctx.save(); ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    hudText(`Rekorun: ${run.recordM} m`, SX(x), SY(q.y) - 140, '700 13px system-ui, sans-serif', COIN_HI);
    ctx.restore();
  }

  function drawPlayer() {
    if (state === 'over' || !player) return;
    const p = player;
    const air = !p.ground ? Math.min(1, (p.lastGy - p.y) / 90) : 0;
    ctx.fillStyle = `rgba(0,0,0,${(0.16 * (1 - air * 0.6)).toFixed(3)})`;
    if (platAt(p.x) && !p.shaft) { ctx.beginPath(); ctx.ellipse(p.x + 2, (platAt(p.x) || p).y + 1, 16 * (1 - air * 0.4), 2.6, 0, 0, TAU); ctx.fill(); }
    ctx.save();
    if (p.shaft && p.wall !== null) { // duvara tutunmus: bas yukarida, karni duvara donuk
      const wx = p.wall === 1 ? p.shaft.x1 : p.shaft.x0;
      ctx.translate(wx + Math.sin(clock * 40) * 1.2 * p.wiggle, p.y - 15);
      if (invulnT > 0) ctx.globalAlpha = 0.55;
      if (p.wall === 0) ctx.scale(-1, 1);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(CAT_DRAW, CAT_DRAW);
      drawCatSide(ctx, CAT_BY_ID[save.char], { gait: p.wallT * 0.6, ground: true, squash: p.squash }, clock, outfit());
      ctx.restore();
      return;
    }
    ctx.translate(p.x + Math.sin(clock * 40) * 1.2 * p.wiggle, p.y);
    if (invulnT > 0) ctx.globalAlpha = 0.55;
    ctx.scale(CAT_DRAW * (p.shaft && p.dir < 0 && !p.ground ? -1 : 1), CAT_DRAW);
    const moving = state === 'play' || state === 'hint';
    drawCatSide(ctx, CAT_BY_ID[save.char], { gait: p.gait, ground: p.ground, slide: p.slide > 0 && p.ground, vy: p.vy, squash: p.squash, stumble: p.stumble > 0 ? Math.min(1, p.stumble * 3) : 0, idle: false, sit: !moving && p.ground && !p.shaft, tail: p.tailSim || (p.tailSim = {}), earBack: moving ? (p.ground ? 0.45 : 0.85) : 0, dilate: P ? Math.min(1, P.stars * 1.5) : 0 }, clock, outfit());
    ctx.restore();
    if (balloonT > 0) { // kediyi tasiyan balonlar
      const bx = p.x - 4, by = p.y - 74;
      ctx.strokeStyle = 'rgba(90,80,90,0.55)'; ctx.lineWidth = 0.8;
      const B = [[-10, -4, '#ec8fa6'], [2, -12, '#8fb8de'], [12, -2, '#f6c35b']];
      ctx.beginPath(); for (const [ox, oy] of B) { ctx.moveTo(p.x + 2, p.y - 22); ctx.quadraticCurveTo(bx + ox * 0.5, by + 30, bx + ox, by + oy + 10); } ctx.stroke();
      for (const [ox, oy, col] of B) { const sw = Math.sin(clock * 2 + ox) * 1.5; ell(ctx, bx + ox + sw, by + oy, 8, 10, 0, col); ell(ctx, bx + ox + sw - 2.5, by + oy - 3, 2, 3, -0.4, 'rgba(255,255,255,0.45)'); }
    }
    if (yayT > 0 && p.ground) { // yayli pati: patilerin altinda yesil yaylar
      ctx.strokeStyle = '#6fbf8f'; ctx.lineWidth = 1.6;
      for (const fx of [p.x - 9, p.x + 9]) { ctx.beginPath(); ctx.moveTo(fx - 3, p.y); for (let i = 1; i <= 4; i++) ctx.lineTo(fx + (i % 2 ? 3 : -3), p.y - i * 1.6); ctx.stroke(); }
    }
    if (shieldHP > 0) {
      ctx.strokeStyle = POWERS.shield.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = shieldHP > 1 ? 3 : 2;
      ctx.beginPath(); ctx.ellipse(p.x + 2, p.y - 14, 26, 22, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Patron cizimleri ----------
  function drawBossChaser(x, gy) { // kedinin arkasinda kovalayan patron (x: dunya, gy: cati yuksekligi)
    const k = boss.kind, sw = boss.swoop, b = Math.sin(clock * 6) * 1.5;
    if (k === 'supurge') { // dev dik supurge robot: tekerlekli govde, kizgin led gozler, one uzanan hortum
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x, gy + 1, 30, 4, 0, 0, TAU); ctx.fill();
      dot(ctx, x - 16, gy - 7, 7, '#2b2f37'); dot(ctx, x + 16, gy - 7, 7, '#2b2f37'); dot(ctx, x - 16, gy - 7, 2.5, '#7d8492'); dot(ctx, x + 16, gy - 7, 2.5, '#7d8492');
      const g = ctx.createLinearGradient(x - 24, 0, x + 24, 0); g.addColorStop(0, '#a84a52'); g.addColorStop(0.45, '#e07a7a'); g.addColorStop(1, '#963f48');
      ctx.fillStyle = g; rr(ctx, x - 24, gy - 74 + b, 48, 62, 14); ctx.fill();
      ctx.fillStyle = '#3b3f4a'; rr(ctx, x - 17, gy - 64 + b, 34, 16, 6); ctx.fill(); // ekran
      const blink = (clock % 3.1) < 0.12;
      for (const ex of [-8, 8]) { ctx.fillStyle = '#ffb36b'; if (blink) ctx.fillRect(x + ex - 4, gy - 56 + b, 8, 1.5); else { ctx.beginPath(); ctx.moveTo(x + ex - 5, gy - 59 + b + (ex < 0 ? 0 : 2)); ctx.lineTo(x + ex + 5, gy - 59 + b + (ex < 0 ? 2 : 0)); ctx.lineTo(x + ex + 4, gy - 53 + b); ctx.lineTo(x + ex - 4, gy - 53 + b); ctx.closePath(); ctx.fill(); } }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, x - 20, gy - 70 + b, 5, 40, 2.5); ctx.fill();
      ctx.strokeStyle = '#5f6675'; ctx.lineWidth = 7; ctx.lineCap = 'round'; // hortum
      const nx = x + 30 + sw * 12, ny = gy - 10;
      ctx.beginPath(); ctx.moveTo(x + 18, gy - 40 + b); ctx.bezierCurveTo(x + 50, gy - 70, nx - 10, gy - 50, nx, ny); ctx.stroke();
      ctx.fillStyle = '#3b3f4a'; rr(ctx, nx - 4, ny - 4, 16, 8, 3); ctx.fill();
      for (let i = 0; i < 4; i++) { const ph = (clock * 2.2 + i / 4) % 1; dot(ctx, nx + 14 + (1 - ph) * 34, ny - 2 + Math.sin(i * 2.3) * 8 * (1 - ph), 1.6, `rgba(170,160,150,${(0.6 * ph).toFixed(2)})`); } // emilen toz
    } else if (k === 'marti') { // iri marti: kanat cirpar, saldirirken kanatlari geriye
      const y = gy - 86 + Math.sin(clock * 2.4) * 8, fl = sw > 0 ? -0.9 : Math.sin(clock * 9) * 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.beginPath(); ctx.ellipse(x, gy + 1, 22, 3, 0, 0, TAU); ctx.fill();
      for (const s2 of [-1, 1]) { // kanatlar
        ctx.fillStyle = s2 < 0 ? '#9aa3b2' : '#b8c0cc';
        ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.quadraticCurveTo(x - 16 + s2 * 4, y - 26 * fl * s2 - 10, x - 44, y - 30 * fl * s2 - 4); ctx.quadraticCurveTo(x - 24, y - 6, x + 8, y + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a4f5c'; ctx.beginPath(); ctx.moveTo(x - 38, y - 28 * fl * s2 - 5); ctx.lineTo(x - 44, y - 30 * fl * s2 - 4); ctx.lineTo(x - 34, y - 20 * fl * s2); ctx.closePath(); ctx.fill();
      }
      ell(ctx, x, y + 2, 22, 10, 0, '#f4f1ea'); ell(ctx, x - 20, y + 1, 9, 4, 0.2, '#e3ded4'); // govde, kuyruk
      dot(ctx, x + 18, y - 4, 9, '#f8f6f1'); // bas
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(x + 25, y - 5); ctx.lineTo(x + 38, y - 2); ctx.lineTo(x + 25, y + 1); ctx.closePath(); ctx.fill(); dot(ctx, x + 33, y - 1, 1.3, '#d9534f');
      dot(ctx, x + 20, y - 7, 2, '#1c1418'); ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x + 16, y - 11); ctx.lineTo(x + 24, y - 9); ctx.stroke(); // kizgin kas
      ctx.strokeStyle = '#e8a06a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 2, y + 11); ctx.lineTo(x - 6, y + 17); ctx.moveTo(x + 4, y + 11); ctx.lineTo(x + 2, y + 17); ctx.stroke();
    } else if (k === 'kepce') { // paletli kepce: sari kabin, iki parcali kol, ucunda kova
      ctx.save(); ctx.translate(x, gy); ctx.scale(0.85, 0.85); ctx.translate(-x, -gy);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x - 6, gy + 1, 38, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3b3a40'; rr(ctx, x - 40, gy - 14, 66, 14, 7); ctx.fill();
      ctx.fillStyle = '#5f6675'; for (let i = 0; i < 6; i++) dot(ctx, x - 33 + i * 10.4, gy - 7, 3.4, '#5f6675');
      ctx.fillStyle = '#e8b04a'; rr(ctx, x - 34, gy - 44, 46, 30, 4); ctx.fill();
      ctx.fillStyle = '#d99a3a'; ctx.fillRect(x - 34, gy - 20, 46, 6);
      ctx.fillStyle = 'rgba(200,225,240,0.85)'; rr(ctx, x - 8, gy - 42, 16, 16, 2); ctx.fill(); // cam
      ctx.fillStyle = '#3b3a40'; ctx.fillRect(x - 30, gy - 52, 4, 10); // egzoz
      if (P.stars < 0.5) dot(ctx, x - 28 + Math.sin(clock * 3) * 2, gy - 58 - (clock * 14) % 12, 3, 'rgba(90,90,96,0.35)');
      const a1 = -0.9 + Math.sin(clock * 1.5) * 0.08 - sw * 0.3, a2 = 0.9 + sw * 0.6;
      const jx = x + 12 + Math.cos(a1) * 44, jy = gy - 36 + Math.sin(a1) * 44, bx = jx + Math.cos(a2) * 34, by = jy + Math.sin(a2) * 34;
      ctx.strokeStyle = '#e8b04a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 12, gy - 36); ctx.lineTo(jx, jy); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = '#6c7280'; ctx.beginPath(); ctx.moveTo(bx - 4, by - 4); ctx.lineTo(bx + 14, by - 2); ctx.lineTo(bx + 10, by + 12); ctx.lineTo(bx - 2, by + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3b3a40'; for (let i = 0; i < 3; i++) ctx.fillRect(bx + 1 + i * 4, by + 10, 2, 3); // dis
      ctx.restore();
    }
  }
  function drawBossAttack(o) { // patron saldirisi: yukaridan duser (drop) ya da bas hizasina iner (low)
    const k = o.boss, t = clock - o.t0, a = Math.min(1, t / 0.45), off = -(1 - a * a) * 170, x = o.x, y = o.y, cx = x + o.w / 2;
    if (a < 1) { ctx.fillStyle = `rgba(0,0,0,${(0.08 + a * 0.12).toFixed(2)})`; ctx.beginPath(); ctx.ellipse(cx, y + 1, o.w / 2 + 4, 2.5, 0, 0, TAU); ctx.fill(); } // yaklasan golge
    if (o.atk === 'drop') {
      ctx.save(); ctx.translate(0, off);
      if (k === 'supurge') { // toz torbasi
        ctx.fillStyle = '#b8b0a4'; ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.quadraticCurveTo(x - 3, y - 20, x + 6, y - o.h); ctx.lineTo(x + o.w - 6, y - o.h); ctx.quadraticCurveTo(x + o.w + 3, y - 20, x + o.w - 2, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a8378'; ctx.fillRect(x + 6, y - o.h - 3, o.w - 12, 5); ctx.fillStyle = '#e07a7a'; ctx.fillRect(x + 8, y - 15, o.w - 16, 5);
      } else if (k === 'marti') { // firlatilan balik kasasi
        ctx.fillStyle = woodGrad(x, x + o.w, '196,160,112'); rr(ctx, x - 2, y - 17, o.w + 4, 17, 2); ctx.fill();
        ctx.fillStyle = 'rgba(90,60,40,0.35)'; ctx.fillRect(x - 2, y - 11, o.w + 4, 1.2); ctx.fillRect(x - 2, y - 6, o.w + 4, 1.2);
        ctx.save(); ctx.translate(cx - 4, y - 21); ctx.rotate(-0.4); drawFish(ctx, 0, 0, 0.9, false); ctx.restore(); ctx.save(); ctx.translate(cx + 5, y - 22); ctx.rotate(0.5); drawFish(ctx, 0, 0, 0.8, false); ctx.restore();
      } else { // moloz yigini
        for (const [dx, dy, r, c] of [[4, -6, 7, '#9a948a'], [16, -7, 8, '#b5ab9c'], [10, -16, 7, '#8a847a'], [21, -17, 5, '#c4664e'], [3, -18, 4, '#a8a094'], [12, -24, 4, '#9a948a']]) dot(ctx, x + dx, y + dy, r, c);
      }
      ctx.restore();
      if (a >= 1 && t < 0.8) for (let i = 0; i < 4; i++) { const p = (t - 0.45) / 0.35; dot(ctx, cx + (i - 1.5) * 12 * (0.5 + p), y - 4 - p * 8, 3 + p * 4, `rgba(200,190,175,${(0.5 * (1 - p)).toFixed(2)})`); } // toz bulutu
      return;
    }
    const ly = y - SIGN_LOW + off * 0.7; // asagi inen ucun alt kenari
    if (k === 'supurge') { // yukaridan sarkan hortum ve emici agiz
      ctx.strokeStyle = '#5f6675'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 60, y - 260); ctx.quadraticCurveTo(cx - 10, y - 150, cx, ly - 22); ctx.stroke();
      ctx.fillStyle = '#3b3f4a'; rr(ctx, x - 4, ly - 24, o.w + 8, 22, 5); ctx.fill();
      ctx.fillStyle = '#2b2f37'; ctx.fillRect(x - 2, ly - 6, o.w + 4, 4);
      for (let i = 0; i < 4; i++) { const ph = (clock * 2.4 + i / 4) % 1; dot(ctx, x - 30 + ph * 28, ly - 8 + Math.sin(i * 1.7) * 6 * (1 - ph), 1.5, `rgba(170,160,150,${(0.6 * ph).toFixed(2)})`); }
    } else if (k === 'marti') { // alcaktan dalan marti
      const by = ly - 16, fl = Math.sin(clock * 12) * 0.5;
      for (const s2 of [-1, 1]) { ctx.fillStyle = s2 < 0 ? '#9aa3b2' : '#b8c0cc'; ctx.beginPath(); ctx.moveTo(cx - 6, by); ctx.quadraticCurveTo(cx + s2 * 6, by - 20 - fl * 10 * s2, cx + 30 * s2 + 4, by - 26 - fl * 12 * s2); ctx.quadraticCurveTo(cx + 10 * s2, by - 4, cx + 8, by + 2); ctx.closePath(); ctx.fill(); }
      ell(ctx, cx, by, 18, 8, 0, '#f4f1ea'); dot(ctx, cx - 14, by - 2, 7, '#f8f6f1'); // sola (kediye) bakar
      ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(cx - 20, by - 3); ctx.lineTo(cx - 31, by); ctx.lineTo(cx - 20, by + 2); ctx.closePath(); ctx.fill();
      dot(ctx, cx - 16, by - 4, 1.6, '#1c1418');
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(cx + 22, by - 8 + i * 6); ctx.lineTo(cx + 40, by - 14 + i * 6); } ctx.stroke(); // hiz cizgileri
    } else { // kepce kovasi: halatla iner
      ctx.strokeStyle = '#5f6675'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, y - 260); ctx.lineTo(cx, ly - 30); ctx.stroke();
      ctx.fillStyle = '#6c7280'; ctx.beginPath(); ctx.moveTo(x - 6, ly - 32); ctx.lineTo(x + o.w + 6, ly - 32); ctx.lineTo(x + o.w, ly - 2); ctx.lineTo(x, ly - 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3b3a40'; for (let i = 0; i < 5; i++) ctx.fillRect(x + 1 + i * 7, ly - 2, 3, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - 3, ly - 30, o.w + 6, 3);
    }
  }

  function drawDog() {
    if (!chase || !player) return;
    const x = player.x - chase.gap;
    if (x < camX - 60) return;
    const tr = trailAt(x);
    const q = platAt(x);
    if (boss && boss.kind !== 'karabas') { // ekranda gorunsun: kedinin hemen arkasinda cizilir (yetisirken/geride kalirken uzaklasir)
      const bx = player.x - { supurge: 62, marti: 54, kepce: 72 }[boss.kind] - Math.max(0, chase.gap - DOG_NEAR - 26), bq = platAt(bx);
      drawBossChaser(bx, bq ? bq.y : q ? q.y : tr.y); return;
    }
    const ground = !tr.air;
    if (q && ground) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.ellipse(x, q.y + 1, 22, 3, 0, 0, TAU); ctx.fill(); }
    ctx.save();
    ctx.translate(x, tr.y);
    ctx.scale(CAT_DRAW, CAT_DRAW);
    const mouth = chase.hav > 0 ? Math.abs(Math.sin(chase.hav * 18)) : chase.lunge > 0 ? 1 : 0;
    drawDogSide(ctx, { gait: x / 92, ground, vy: tr.vy || 0, lunge: chase.lunge > 0 ? 1 : 0, mouth }, clock);
    ctx.restore();
    if (chase.hav > 0) {
      ctx.save(); ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      ctx.globalAlpha = Math.min(1, chase.hav * 2.5);
      hudText('Hav!', SX(x) + 22, SY(tr.y) - 62, '800 15px system-ui, sans-serif', '#f2efe9');
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWeather() {
    const seeDark = catIs('kara') ? 0 : 1;
    if (weather === 'rain' && !isMenuState()) {
      ctx.strokeStyle = P.stars > 0.2 ? 'rgba(200,215,235,0.22)' : 'rgba(70,95,135,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of RAIN) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + d.l); }
      ctx.stroke();
    }
    const da = darkAmt * seeDark;
    if (da > 0.02 && player) {
      const cx = SX(player.x) + 70, cy = SY(player.y) - 36;
      const g = ctx.createRadialGradient(cx, cy, 110, cx, cy, 340);
      g.addColorStop(0, 'rgba(10,12,18,0)');
      g.addColorStop(1, `rgba(10,12,18,${(0.8 * da).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    const fa = fogAmt * seeDark;
    if (fa > 0.02) { // sis: ilerisi (sag taraf) zor gorunur
      const g = ctx.createLinearGradient(W * 0.45, 0, W, 0);
      g.addColorStop(0, 'rgba(205,210,220,0)');
      g.addColorStop(0.55, `rgba(205,210,220,${(0.5 * fa).toFixed(3)})`);
      g.addColorStop(1, `rgba(205,210,220,${(0.85 * fa).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(W * 0.45, -20, W * 0.6, H + 40);
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
      hudText(`${stage + 1}. Sokak · puan x${Math.round(stageMult() * permMult() * 10) / 10}`, W / 2, top + 82, '700 12px system-ui, sans-serif', '#e3dccf');
    }
    if (boss && !boss.beaten) { // patronun can bari
      const bw = 150, bx = (W - bw) / 2, by = top + 74;
      hudText(BOSSES[boss.kind].name, W / 2, by + 2, '800 13px system-ui, sans-serif', '#f6dcae');
      ctx.fillStyle = 'rgba(30,20,30,0.35)'; rr(ctx, bx, by + 8, bw, 8, 4); ctx.fill();
      ctx.fillStyle = '#e07a7a'; rr(ctx, bx, by + 8, Math.max(8, bw * boss.hp / boss.max), 8, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 1; i < boss.max; i++) ctx.fillRect(bx + (bw * i) / boss.max - 0.5, by + 8, 1, 8);
    }
    if (comboMult() > 1) hudText(`Kıl payı x${comboMult()}`, W / 2, top + (boss && !boss.beaten ? 112 : 100), '700 14px system-ui, sans-serif', '#f6dcae');

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
    if (balloonT > 0) act.push(['balon', Math.min(1, balloonT / BALLOON_T)]);
    if (yayT > 0) act.push(['yay', yayT / YAY_T]);
    for (const [k, frac] of act) {
      ctx.save(); ctx.translate(x, y + 6); ctx.scale(0.75, 0.75);
      dot(ctx, 0, 0, 12, POWERS[k].color); drawPowerIcon(ctx, k);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x - 9, y + 18, 18, 3);
      ctx.fillStyle = '#f2efe9'; ctx.fillRect(x - 9, y + 18, 18 * frac, 3);
      x += 26;
    }

    if (stats.boxes > 0) { ctx.save(); ctx.translate(W - WALL - 14, top + 104); ctx.scale(0.75, 0.75); drawBox(0, 0); ctx.restore(); hudText('x' + stats.boxes, W - WALL - 28, top + 109, '700 13px system-ui, sans-serif', '#b99be8', 'right'); }
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
    drawMid();
    ctx.save();
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-camX, -camY);
    drawRecord();
    drawShaftBack();
    drawPlats();
    drawDeco();
    drawShaftFront();
    drawLedges();
    drawFinish();
    for (const o of obstacles) if (o.type === 'sticky' && o.x < camX + VW && o.x + o.w > camX) (o.z ? drawStickyZ : drawSticky)(o);
    for (const o of obstacles) {
      if (o.x > camX + VW + 60 || o.x + o.w < camX - 60 || o.type === 'sticky' || o.type === 'mark') continue;
      const z = o.z || 0;
      if (o.boss) drawBossAttack(o);
      else if (o.type === 'bar') (z ? drawBarZ : drawClothesline)(o);
      else if (o.type === 'sign') (z ? drawSignZ : drawSign)(o);
      else if (o.type === 'roomba') (z ? drawRoller : drawRoomba)(o);
      else if (o.type === 'jet') drawJet(o);
      else if (o.skin === 'ac') [drawAC, drawIcebox, drawKazan, drawMixer][z](o);
      else if (o.skin === 'pipe') [drawPipe, drawBollard, drawKup, drawCone][z](o);
      else [drawVacuum, drawCrates, drawSemaver, drawCementBags][z](o);
    }
    drawItems();
    drawDog();
    drawPlayer();
    drawCrows();
    drawParticles();
    ctx.restore();
    drawWeather();
    drawHud();
  }

  // ================= Oyuncaklar (Kedi Evi'nde "Oyna") =================
  const hero = { greeted: false };
  const PLAY_DAILY_FISH = 20; // gunde oyundan en fazla bu kadar balik
  function playState() {
    const k = todayKey();
    if (save.play.date !== k) save.play = { date: k, catches: 0, rewarded: 0 };
    return save.play;
  }
  function renderToyChips() {
    const ts = save.toys;
    $('toyChips').classList.toggle('hidden', pet.tool !== 'play');
    $('toyChips').innerHTML = ts.owned.map((id) => `<button class="chip${ts.sel === id ? ' on' : ''}" data-toysel="${id}">${TOY_BY_ID[id].name}</button>`).join('') +
      (ts.owned.length < TOYS.length ? '<button class="chip more" data-tab="shop">+ Yeni oyuncak</button>' : '');
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
    mouth: 0, eatT: 0, flyT: -1, rubT: 0, purr: 0, saveT: 0, sayT: 0, say: '', paw: 0, lastMove: 0, dirtFade: 0,
    spin: 0.35, spinVel: 0, spinning: false, downX: 0, downY: 0, dragX: 0, hop: 0, catchCool: 0 };
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
  // ================= Kedi Evi: odalar ve kendi kendine yasayan kedi =================
  const ROOMS = [{ id: 'salon', name: 'Salon' }, { id: 'mutfak', name: 'Mutfak' }, { id: 'banyo', name: 'Banyo' }, { id: 'yatak', name: 'Yatak Odası' }];
  const ROOM_OF = { feed: 'mutfak', wash: 'banyo', sleep: 'yatak', play: 'salon', pet: 'salon' };
  const HW = 300, HH = 390, FLOOR = 352, CS = 2.6; // oda boyutu, zemin cizgisi, kedi olcegi
  const BOWL_X = 232, BED_X = 96;
  const ROOM_FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
  const hc = { x: 150, dir: 1, act: 'sit', t: 0, dur: 2, tx: 150, then: null, gait: 0, jy: 0, jv: 0, tail: {}, mouth: 0, view: 0.35 };
  Object.assign(pet, { room: 'salon', bowl: 0, toy: { x: 200, y: 90, t: 0, tx: 200, ty: 90, hold: 0, nextT: 2 } });
  function setAct(a, dur) { hc.act = a; hc.t = 0; hc.dur = dur; }
  function catGo(x, then) { hc.tx = Math.max(60, Math.min(240, x)); hc.then = then; setAct('walk', 99); }
  function setRoom(id) {
    if (pet.room === id) return;
    pet.room = id; sfx('ui');
    hc.x = id === 'mutfak' ? 120 : id === 'yatak' ? 190 : 150; hc.jy = 0; hc.jv = 0;
    if (!save.pet.sleep) setAct('sit', 1.2);
  }
  function petTool(tool) {
    petTick(true);
    const p = save.pet;
    if (ROOM_OF[tool]) setRoom(ROOM_OF[tool]);
    if (tool === 'sleep') {
      p.sleep = !p.sleep; pet.tool = '';
      persist('pet'); sfx('ui');
      petSay(p.sleep ? 'İyi geceler...' : 'Günaydın!');
      if (p.sleep) catGo(BED_X, 'sleep'); else { sfx('meowHappy'); setAct('stretch', 2.4); }
      renderToyChips(); petBars();
      return;
    }
    if (p.sleep) { petSay('Şşş... uyuyor. Önce lambayı aç.'); sfx('nope'); return; }
    if (tool === 'feed') {
      if (p.food >= 95) { petSay('Tokum, teşekkürler!'); sfx('meowShort'); return; }
      if (save.wallet < 2) { petSay('Mama için 2 balık lazım'); sfx('nope'); return; }
      save.wallet -= 2; persist('wallet'); $('wallet').textContent = save.wallet;
      pet.bowl = 1; pet.tool = ''; sfx('coin');
      catGo(BOWL_X - 46, 'eat'); petSay('Mama! Mama!');
      renderToyChips(); petBars();
      return;
    }
    if (tool === 'play' && p.energy < 15) { petSay('Çok yorgunum... biraz uyuyayım mı?'); sfx('meowSad'); return; }
    pet.tool = pet.tool === tool ? '' : tool;
    if (pet.tool === 'wash') { pet.foam = []; pet.dirtFade = 0; setAct('sit', 99); petSay('Süngerle kedini köpürt!'); }
    if (pet.tool === 'pet') { setAct('sit', 99); petSay('Kedini okşa, mırlasın'); }
    if (pet.tool === 'play') { Object.assign(pet.toy, { x: hc.x + 80, y: 70, t: 0, tx: hc.x + 80, ty: 70, hold: 0, nextT: 2 }); petSay(TOY_BY_ID[save.toys.sel].name + ' ile oynayalım!'); sfx('meowHappy'); }
    if (!pet.tool) setAct('sit', 1.5);
    sfx('click');
    renderToyChips();
    petBars();
  }
  const catTop = () => FLOOR - (hc.act === 'lie' || hc.act === 'sleep' ? 62 : 112) + hc.jy;
  function onCat(x, y) { return Math.abs(x - hc.x) < 64 && y > catTop() && y < FLOOR + 6; }
  const catMidY = () => FLOOR - 44 + hc.jy;
  function petPointer(kind, e) {
    const cv = $('houseCv'), r = cv.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) * HW) / r.width, y = ((e.clientY - r.top) * HH) / r.height;
    const moved = Math.hypot(x - pet.px, y - pet.py), ox = pet.px;
    pet.px = x; pet.py = y;
    if (mg) { miniPointer(kind, x, y); return; }
    const p = save.pet, toy = pet.toy;
    if (kind === 'down') {
      pet.down = true; pet.downX = x; pet.downY = y; pet.spinning = false; pet.spinVel = 0; if (save.sound || save.music) ac();
      if (y < 44 && (x < 70 || x > 230)) { // ustteki oklarla oda degistir
        const i = ROOMS.findIndex((q) => q.id === pet.room);
        setRoom(ROOMS[(i + (x < 70 ? 3 : 1)) % 4].id); pet.down = false;
        return;
      }
      if (pet.tool === 'play') { toy.tx = x; toy.ty = Math.max(50, Math.min(FLOOR - 24, y)); toy.hold = 1.4; toySound('move'); return; }
    }
    if (kind === 'up') {
      const dx = x - pet.downX, dy = y - pet.downY;
      if (pet.spinning) { pet.spinning = false; pet.down = false; return; } // cevirme bitti (oda degismez)
      if (pet.down && !pet.tool && Math.abs(dx) > 70 && Math.abs(dy) < 50) { // yana kaydir: oda degistir
        const i = ROOMS.findIndex((q) => q.id === pet.room);
        setRoom(ROOMS[(i + (dx < 0 ? 1 : 3)) % 4].id);
      } else if (pet.down && !pet.tool && !p.sleep && Math.hypot(dx, dy) < 6 && onCat(x, y)) { // dokunus: miyavlar, kucuk ziplar
        sfx(pickOne(['meow', 'meowShort', 'meowHappy'])); hc.mouth = 1; if (hc.jy === 0) hc.jv = -150;
        pet.hearts.push({ x, y, t: 0 }); petSay(pickOne(HOUSE_MSGS));
        if (hc.act === 'lie' || hc.act === 'lick') setAct('sit', 2);
      }
      pet.down = false; purrSet(false); return;
    }
    if (!pet.down && kind !== 'down') return;
    if (!pet.tool && kind === 'move' && onCat(pet.downX, pet.downY) && (pet.spinning || Math.abs(x - pet.downX) > 6)) { // kediyi cevir
      if (!pet.spinning) { pet.spin = hc.view; pet.spinning = true; if (hc.act !== 'sit') setAct('sit', 6); }
      const d = (x - ox) * 0.035; pet.spin += d; hc.view = pet.spin; pet.spinVel = d * 60;
      return;
    }
    if (pet.tool === 'play') { toy.tx = x; toy.ty = Math.max(50, Math.min(FLOOR - 24, y)); toy.hold = 1.4; if (moved > 2 && Math.random() < 0.35) toySound('move'); return; }
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
        for (let i = 0; i < 10; i++) pet.sparkles.push({ x: hc.x + rand(-50, 50), y: catMidY() + rand(-50, 40), t: rand(-0.3, 0) });
        petSay('Pırıl pırıl oldum!'); sfx('meowHappy'); sfx('power'); setAct('lick', 3); petBars();
      }
    } else if (pet.tool === 'pet' && onCat(x, y) && moved > 0.8) {
      pet.rubT = 0.5; petAdd('fun', 0.12);
      purrSet(true);
      if (Math.random() < 0.05) pet.hearts.push({ x, y: y - 6, t: 0 });
    }
  }
  const HOUSE_MSGS = ['Miyav!', 'Hadi koşalım!', 'Balık var mı?', 'Prrr prrr...', 'Beni çevirsene!', 'Bugün rekor kırarız!', 'Karabaş uyuyor mu?', 'Oynayalım mı?'];
  function toyCaught(x, y) {
    const ps = playState();
    ps.catches++;
    save.life.catches++; persist('life'); if (save.life.catches % 10 === 0) checkAchievements();
    for (let i = 0; i < 4; i++) pet.hearts.push({ x: x + rand(-8, 8), y, t: rand(-0.2, 0) });
    toySound('catch');
    sfx(Math.random() < 0.5 ? 'purr' : 'meowHappy');
    let msg = pickOne(['Yakaladım!', 'Hap!', 'Benim bu!', 'Bir daha!']);
    if (ps.catches % 5 === 0 && ps.rewarded < PLAY_DAILY_FISH) { ps.rewarded++; save.wallet++; persist('wallet'); msg += ' 🐟 +1'; $('wallet').textContent = save.wallet; }
    persist('play');
    petSay(msg);
  }
  function nextAct() { // kendi kendine: oturur, gezinir, patisini yalar, gerinir, uzanir
    const p = save.pet, W8 = [['sit', 3], ['walk', 3.2], ['lick', 2.2], ['stretch', 1], ['lie', p.energy < 40 ? 4 : 1.2]];
    let r = Math.random() * W8.reduce((a, w) => a + w[1], 0), a = 'sit';
    for (const [k, w] of W8) { r -= w; if (r <= 0) { a = k; break; } }
    if (a === hc.act && a !== 'walk') a = 'walk';
    if (a === 'walk') catGo(rand(70, 230), Math.random() < 0.3 ? 'lick' : 'sit');
    else setAct(a, a === 'lie' ? rand(5, 8) : a === 'stretch' ? 2.4 : rand(2.5, 4.5));
    if (a === 'stretch' && Math.random() < 0.5) sfx('meowShort');
  }
  function updatePet(dt) {
    if (!pet.spinning && Math.abs(pet.spinVel) > 0.05) { pet.spin += pet.spinVel * dt; pet.spinVel *= Math.pow(0.12, dt); }
    if (state !== 'menu') { if (purrSrc) purrSet(false); if (mg) endMini(true); return; }
    const p = save.pet;
    updateMini(dt);
    pet.saveT += dt;
    if (pet.saveT > 2) { pet.saveT = 0; petTick(); petBars(); }
    pet.mouth = Math.max(0, pet.mouth - dt * 2.5);
    hc.mouth = Math.max(0, hc.mouth - dt * 2.5);
    pet.sayT = Math.max(0, pet.sayT - dt);
    pet.catchCool -= dt;
    if (pet.rubT > 0) { pet.rubT -= dt; if (pet.rubT <= 0) purrSet(false); }
    // ziplama fizigi (oda birimi)
    if (hc.jy < 0 || hc.jv !== 0) { hc.jv += 900 * dt; hc.jy += hc.jv * dt; if (hc.jy >= 0) { hc.jy = 0; hc.jv = 0; } }
    hc.t += dt;
    if (p.sleep && hc.act !== 'sleep' && hc.act !== 'walk') catGo(BED_X, 'sleep');
    const toy = pet.toy;
    if (pet.tool === 'play') { // oyuncak kendiliginden iner, cikar ve yer degistirir; dokununca senin elinde
      toy.t += dt;
      if (toy.hold > 0) toy.hold -= dt;
      else {
        toy.nextT -= dt;
        if (toy.nextT <= 0) { toy.nextT = rand(1.6, 3.2); toy.tx = Math.max(40, Math.min(260, hc.x + rand(-110, 120))); }
        toy.ty = 64 + (FLOOR - 150) * (0.5 - 0.5 * Math.cos(toy.t * 2.2)) + Math.sin(toy.t * 5.3) * 6;
      }
      toy.x += (toy.tx - toy.x) * Math.min(1, dt * 2.8);
      toy.y += (toy.ty - toy.y) * Math.min(1, dt * 6);
    }
    if (hc.act === 'walk') {
      const d = hc.tx - hc.x; hc.dir = d >= 0 ? 1 : -1;
      const step = Math.min(Math.abs(d), 46 * dt * (mg && mg.kind === 'laser' ? 4 : 1)); // lazerde kosar
      hc.x += hc.dir * step; hc.gait += step / 30;
      if (Math.abs(d) < 1.5) {
        const nx = hc.then || 'sit'; hc.then = null;
        setAct(nx, nx === 'eat' ? 2.8 : nx === 'sleep' ? 1e9 : nx === 'lick' ? rand(2.5, 4) : rand(2, 4));
        if (nx === 'eat') hc.dir = 1;
      }
    } else if (pet.tool === 'play' && !p.sleep) { // oyuncagi kovalar, alttayken ziplar ve pati atar
      if (hc.jy === 0) hc.dir = toy.x >= hc.x ? 1 : -1;
      const front = hc.x + hc.dir * 46, gap = toy.x - front;
      if (Math.abs(gap) > 40 && hc.jy === 0) { const step = Math.min(Math.abs(gap) - 30, 75 * dt) * Math.sign(gap); hc.x = Math.max(55, Math.min(245, hc.x + step)); hc.gait += Math.abs(step) / 26; hc.act = 'chase'; }
      else if (hc.jy === 0) {
        hc.act = 'ready';
        const h = FLOOR - 70 - toy.y;
        if (h < 150 && pet.catchCool <= 0) { hc.jv = -Math.sqrt(2 * 900 * Math.max(25, h + 10)); pet.catchCool = 1.1; sfx('jump'); petAdd('fun', 3); petAdd('energy', -0.6); }
      }
      if (hc.jy < -8 && Math.hypot(toy.x - front, toy.y - (FLOOR - 78 + hc.jy)) < 30 && !hc.caught) { // yakaladi
        hc.caught = true; toyCaught(toy.x, toy.y); toy.ty = 60; toy.hold = 0.8; toy.y -= 10;
      }
      if (hc.jy === 0) hc.caught = false;
    } else if (hc.act === 'eat') {
      hc.mouth = Math.abs(Math.sin(hc.t * 9));
      if (hc.t > hc.dur) { petAdd('food', 30); persist('pet'); pet.bowl = 0; pet.hearts.push({ x: hc.x + 40, y: FLOOR - 70, t: 0 }); sfx('meowHappy'); petSay('Nefis!'); petBars(); setAct('lick', 3); }
    } else if (!pet.tool && hc.act !== 'sleep' && hc.t > hc.dur) nextAct();
    else if (hc.act === 'chase' || hc.act === 'ready') setAct('sit', 1.5);
    if (hc.act === 'sleep' && !p.sleep) setAct('stretch', 2.4);
    for (const f of pet.foam) f.t += dt;
    for (const d of pet.drops) { d.t += dt; d.y += d.vy * dt; }
    pet.drops = pet.drops.filter((d) => d.t < 0.5);
    for (const h of pet.hearts) { h.t += dt; h.y -= 22 * dt; }
    pet.hearts = pet.hearts.filter((h) => h.t < 1.2);
    for (const s2 of pet.sparkles) s2.t += dt;
    pet.sparkles = pet.sparkles.filter((s2) => s2.t < 1);
    if (p.sleep && Math.random() < dt * 0.8) pet.zz.push({ x: hc.x + 40, y: FLOOR - 60, t: 0 });
    for (const z of pet.zz) { z.t += dt; z.y -= 12 * dt; z.x += 6 * dt; }
    pet.zz = pet.zz.filter((z) => z.t < 2.4);
  }
  function houseCatState() {
    const p = save.pet, a = hc.act, base = { tail: hc.tail, mouth: hc.mouth, dilate: p.sleep ? 1 : 0.2 };
    if (hc.jy < 0) return { ...base, ground: false, vy: hc.jv - 200 };
    if (a === 'walk') return { ...base, ground: true, walk: true, gait: hc.gait * 0.6 };
    if (a === 'chase') return { ...base, ground: true, gait: hc.gait };
    if (a === 'lick') return { ...base, sit: true, lick: hc.t, mouth: 0.3 + 0.5 * Math.abs(Math.sin(hc.t * 7)) };
    if (a === 'stretch') return { ...base, stretch: Math.min(1, Math.sin(Math.min(1, hc.t / hc.dur) * Math.PI) * 1.4) };
    if (a === 'lie') return { ...base, lie: true, closed: hc.t > 3 && (hc.t % 3) < 1.6 };
    if (a === 'sleep') return { ...base, lie: true, closed: true };
    if (a === 'eat') return { ...base, eat: true };
    return { ...base, sit: true, closed: pet.rubT > 0 || pet.tool === 'rinse' };
  }
  function drawPet(g) {
    const p = save.pet, c = CAT_BY_ID[save.char];
    // golge
    ell(g, hc.x, FLOOR + 2, 52 * (1 + hc.jy / 260), 6, 0, `rgba(0,0,0,${(0.16 * (1 + hc.jy / 200)).toFixed(3)})`);
    // 360 derece cevrilebilen kedi: yururken yurudugu yone, otururken senin cevirdigin yone bakar
    const walking = hc.act === 'walk' || hc.act === 'chase' || hc.act === 'eat';
    const target = walking ? hc.dir * 1.45 : pet.spin;
    let dA = ((target - hc.view + Math.PI) % TAU + TAU) % TAU - Math.PI;
    hc.view += dA * (pet.spinning ? 1 : 0.14);
    const sleepy = hc.act === 'sleep' || hc.act === 'lie' && (hc.t % 4) < 2.5;
    const mood = sleepy || p.sleep ? { eyes: 'closed' } : pet.rubT > 0 || pet.tool === 'rinse' ? { eyes: 'happy', mouth: 0.4 } : hc.mouth > 0.05 ? { mouth: hc.mouth } : null;
    const hop = walking && hc.jy === 0 ? Math.abs(Math.sin(hc.gait * Math.PI * 1.2)) * 0.25 : 0;
    const sq = hc.act === 'stretch' ? 0.9 : hc.act === 'lie' || hc.act === 'sleep' ? 0.82 : 1; // uzanirken biraz basik
    g.save(); g.translate(hc.x, FLOOR + hc.jy - 20 * CS * sq); g.scale(CS * (2 - sq), CS * sq);
    drawCat3D(g, c, hc.view, clock, save.wardrobe, hop, hc.act === 'lick' ? 0.6 + 0.4 * Math.sin(hc.t * 7) : 0, mood);
    g.restore();
    // kir lekeleri (temizlik dustukce artar)
    const n = Math.round((100 - p.clean) / 17);
    for (let i = 0; i < Math.min(n, DIRT.length); i++) {
      const [dx, dy, r] = DIRT[i];
      g.globalAlpha = 0.38 * (1 - pet.dirtFade);
      g.globalAlpha = 0.22 * (1 - pet.dirtFade);
      ell(g, hc.x + dx * 2.6 * hc.dir, catMidY() + dy * 0.9 - 6, r * 0.9, r * 0.6, i, '#6a4a30');
    }
    g.globalAlpha = 1;
    for (const f of pet.foam) { const s2 = Math.min(1, f.t * 6); dot(g, f.x, f.y, f.r * s2, 'rgba(255,255,255,0.92)'); dot(g, f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.3 * s2, 'rgba(190,220,255,0.9)'); }
    for (const d of pet.drops) ell(g, d.x, d.y, 1.3, 3, 0, `rgba(120,180,240,${1 - d.t * 2})`);
    for (const h of pet.hearts) { g.globalAlpha = Math.max(0, 1 - h.t / 1.2); g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('💗', h.x, h.y); }
    for (const s2 of pet.sparkles) if (s2.t > 0) { g.globalAlpha = 1 - s2.t; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText('✨', s2.x, s2.y); }
    g.globalAlpha = 1;
    if (p.sleep && pet.room === 'yatak') {
      g.fillStyle = 'rgba(30,30,70,0.45)'; g.fillRect(0, 0, HW, HH);
      const lg = g.createRadialGradient(250, 210, 4, 250, 210, 90); lg.addColorStop(0, 'rgba(255,220,150,0.35)'); lg.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = lg; g.fillRect(150, 110, 150, 200);
    }
    if (p.sleep) { g.fillStyle = '#ffffff'; g.textAlign = 'center'; for (const z of pet.zz) { g.globalAlpha = Math.max(0, 1 - z.t / 2.4); g.font = `800 ${10 + z.t * 4}px ${FONT}`; g.fillText('z', z.x, z.y); } g.globalAlpha = 1; }
    // oyuncak: oltanin ucunda
    if (pet.tool === 'play') {
      const id = save.toys.sel, tx = pet.toy.x, ty = pet.toy.y;
      if (id === 'kelebek') { g.strokeStyle = '#8a6a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx * 0.4 + 170, 0); g.lineTo(tx, ty); g.stroke(); }
      else if (id !== 'lazer') { g.strokeStyle = 'rgba(80,70,90,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(tx + Math.sin(clock) * 4, 0); g.lineTo(tx, ty); g.stroke(); }
      g.save(); g.translate(tx, ty + 4); g.scale(3.2, 3.2); drawToy(g, id, 0, 0, clock); g.restore();
    }
    if ((pet.tool === 'wash' || pet.tool === 'rinse') && pet.down) { g.font = '22px sans-serif'; g.textAlign = 'center'; g.fillText(pet.tool === 'wash' ? '🧽' : '🚿', pet.px, pet.py - 10); }
    // konusma balonu ve ihtiyac
    const need = p.sleep ? '' : ['food', 'clean', 'fun', 'energy'].filter((k) => p[k] < 30).sort((a, b) => p[a] - p[b])[0];
    const text = pet.sayT > 0 ? pet.say : '', bx = Math.max(70, Math.min(230, hc.x + hc.dir * 20)), by = catTop() - 30;
    if (text) {
      g.font = `700 11px ${ROOM_FONT}`; const w = Math.min(220, g.measureText(text).width + 18);
      g.fillStyle = 'rgba(255,255,255,0.95)'; rr(g, bx - w / 2, by, w, 24, 12); g.fill();
      g.fillStyle = '#3b3552'; g.textAlign = 'center'; g.fillText(text, bx, by + 16);
    } else if (need) {
      const yy = by + Math.sin(clock * 2) * 2;
      dot(g, bx + 30, yy, 15, 'rgba(255,255,255,0.95)'); dot(g, bx + 16, yy + 18, 4, 'rgba(255,255,255,0.95)');
      g.font = '15px sans-serif'; g.textAlign = 'center'; g.fillText(PET_ICON[need], bx + 30, yy + 5);
    }
  }
  const houseCvEl = $('houseCv');
  if (houseCvEl && houseCvEl.addEventListener) {
    houseCvEl.addEventListener('pointerdown', (e) => { if (houseCvEl.setPointerCapture) try { houseCvEl.setPointerCapture(e.pointerId); } catch { /* yoksay */ } petPointer('down', e); });
    houseCvEl.addEventListener('pointermove', (e) => petPointer('move', e));
    houseCvEl.addEventListener('pointerup', (e) => petPointer('up', e));
    houseCvEl.addEventListener('pointercancel', (e) => petPointer('up', e));
  }

  // ================= Kedi evi: odalar =================
  function drawRoomBase(g, wallTop, wallBot, floorA, floorB) {
    const wg = g.createLinearGradient(0, 0, 0, 290); wg.addColorStop(0, wallTop); wg.addColorStop(1, wallBot);
    g.fillStyle = wg; g.fillRect(0, 0, HW, 300);
    const fg = g.createLinearGradient(0, 296, 0, HH); fg.addColorStop(0, floorA); fg.addColorStop(1, floorB);
    g.fillStyle = fg; g.fillRect(0, 296, HW, HH - 296);
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 296, HW, 4); // supurgelik golgesi
  }
  function drawWindow(g, x, y, w, h, night) {
    g.fillStyle = '#ffffff'; rr(g, x - 5, y - 5, w + 10, h + 10, 8); g.fill();
    const sk = g.createLinearGradient(0, y, 0, y + h);
    sk.addColorStop(0, night ? '#2c3a68' : '#8ec5ea'); sk.addColorStop(1, night ? '#4d5d92' : '#fde2c8');
    g.fillStyle = sk; rr(g, x, y, w, h, 6); g.fill();
    if (night) { dot(g, x + w * 0.7, y + 18, 8, '#fff3d0'); for (const [sx, sy] of [[0.2, 0.3], [0.4, 0.6], [0.8, 0.7]]) dot(g, x + w * sx, y + h * sy, 1.2, '#fff3d0'); }
    else { dot(g, x + w * 0.7, y + 20, 9, '#fff1c1'); ell(g, x + w * 0.3, y + h * 0.65, 12, 5, 0, 'rgba(255,255,255,0.85)'); }
    g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h / 2 - 2, w, 4);
  }
  function drawSalon(g) {
    drawRoomBase(g, '#fbe8d8', '#f4d6c0', '#cf9e74', '#b98458');
    g.fillStyle = 'rgba(255,255,255,0.28)'; for (let x = 10; x < HW; x += 22) g.fillRect(x, 0, 2, 296); // duvar kagidi
    g.strokeStyle = 'rgba(110,60,30,0.16)'; g.lineWidth = 1; for (let y = 312; y < HH; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(HW, y); g.stroke(); } // parke
    drawWindow(g, 196, 60, 76, 96, false);
    g.fillStyle = '#e9a7b4'; rr(g, 186, 52, 14, 116, 6); g.fill(); rr(g, 268, 52, 14, 116, 6); g.fill(); // perdeler
    // kanepe (sol arka)
    g.fillStyle = '#8fb3cf'; rr(g, 14, 218, 120, 62, 12); g.fill(); rr(g, 8, 204, 132, 30, 12); g.fill();
    g.fillStyle = '#a9c6dc'; rr(g, 22, 236, 50, 26, 8); g.fill(); rr(g, 76, 236, 50, 26, 8); g.fill();
    g.fillStyle = '#6f5a48'; g.fillRect(20, 280, 6, 16); g.fillRect(122, 280, 6, 16);
    const pl = save.house.placed;
    if (pl.tablo) {
      g.fillStyle = '#b07a48'; rr(g, 40, 70, 80, 60, 4); g.fill();
      g.fillStyle = pl.tablo === 'tablo_ay' ? '#34406b' : '#bfe3f2'; g.fillRect(46, 76, 68, 48);
      if (pl.tablo === 'tablo_ay') { dot(g, 92, 92, 8, '#fff3d0'); dot(g, 96, 89, 7, '#34406b'); } else { g.save(); g.translate(80, 100); g.scale(2.4, 2.4); drawFish(g, 0, 0, 1, false); g.restore(); }
    }
    if (pl.hali === 'hali_pembe') { ell(g, 150, 360, 110, 18, 0, '#f2a6b8'); ell(g, 150, 360, 86, 12, 0, '#f6c3cf'); }
    if (pl.hali === 'hali_cizgi') { g.fillStyle = '#9cc3e6'; rr(g, 50, 344, 200, 32, 6); g.fill(); g.fillStyle = '#ffffff'; for (let x = 62; x < 244; x += 22) g.fillRect(x, 344, 9, 32); }
    if (pl.agac) { // kedi agaci (sag)
      const tall = pl.agac === 'agac_buyuk';
      g.fillStyle = '#d8c3a5'; g.fillRect(262, tall ? 150 : 220, 12, tall ? 150 : 80);
      g.fillStyle = '#9a7bb3'; rr(g, 240, 292, 56, 10, 4); g.fill(); rr(g, 242, 214, 50, 9, 4); g.fill();
      if (tall) { rr(g, 246, 144, 44, 9, 4); g.fill(); }
    }
    if (pl.bitki) {
      g.fillStyle = '#c8724f'; rr(g, 150, 262, 28, 28, 5); g.fill();
      if (pl.bitki === 'bitki_palmiye') for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) ell(g, 164 + Math.sin(a) * 14, 244 - Math.cos(a) * 10, 4, 15, a, '#6fae6b');
      else for (let i = 0; i < 5; i++) { dot(g, 154 + i * 5, 256 - (i % 2) * 6, 4, ['#f28fa8', '#f6c35b', '#b99be8', '#ffffff', '#f28fa8'][i]); }
    }
  }
  function drawMutfak(g) {
    drawRoomBase(g, '#e7f0f2', '#d8e6ea', '#e9e2d6', '#d6ccbc');
    g.strokeStyle = 'rgba(120,150,160,0.18)'; g.lineWidth = 1; // fayans
    for (let y = 120; y < 230; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(HW, y); g.stroke(); }
    for (let x = 0; x < HW; x += 18) { g.beginPath(); g.moveTo(x, 120); g.lineTo(x, 230); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.06)'; for (let x = 0; x < HW; x += 36) for (let y = 300; y < HH; y += 36) g.fillRect(x + ((y / 36) % 2) * 18, y, 18, 18); // dama zemin
    g.fillStyle = '#c9a77f'; g.fillRect(70, 230, 230, 66); g.fillStyle = '#eadfce'; g.fillRect(64, 222, 236, 10); // tezgah
    g.fillStyle = '#b8936a'; for (let x = 82; x < 290; x += 52) { rr(g, x, 240, 44, 48, 3); g.fill(); dot(g, x + 38, 262, 2, '#7a5a3a'); }
    g.fillStyle = '#c9a77f'; rr(g, 120, 40, 170, 60, 4); g.fill(); g.fillStyle = '#b8936a'; for (let x = 128; x < 285; x += 54) { rr(g, x, 46, 48, 48, 3); g.fill(); }
    g.fillStyle = '#f4f6f8'; rr(g, 10, 120, 52, 176, 6); g.fill(); g.fillStyle = '#d5dbe0'; g.fillRect(10, 186, 52, 3); g.fillRect(52, 140, 3, 34); g.fillRect(52, 200, 3, 50); // buzdolabi
    // mama kabi
    const gold = save.house.placed.mama === 'mama_altin';
    ell(g, BOWL_X, 350, 22, 7, 0, gold ? '#e9b44c' : '#6fa8dc');
    ell(g, BOWL_X, 345, 18, 5, 0, gold ? '#f6d68a' : '#9cc3e6');
    if (pet.bowl) for (let i = 0; i < 8; i++) dot(g, BOWL_X - 12 + i * 3.4, 344 - (i % 2) * 1.5, 2, '#b57a46');
  }
  function drawBanyo(g) {
    drawRoomBase(g, '#eef6f4', '#dcece8', '#d9e7ef', '#c3d6e2');
    g.strokeStyle = 'rgba(110,160,150,0.2)'; g.lineWidth = 1;
    for (let y = 0; y < 296; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(HW, y); g.stroke(); }
    for (let x = 0; x < HW; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 296); g.stroke(); }
    g.fillStyle = '#ffffff'; rr(g, 6, 236, 120, 62, 18); g.fill(); g.fillStyle = '#e4eef2'; rr(g, 12, 240, 108, 14, 7); g.fill(); // kuvet
    g.fillStyle = '#b9c3cc'; g.fillRect(100, 196, 4, 44); rr(g, 92, 192, 22, 6, 3); g.fill(); // musluk
    for (let i = 0; i < 6; i++) dot(g, 20 + i * 16, 234 - (i % 2) * 3, 6, 'rgba(255,255,255,0.95)'); // kopukler
    g.fillStyle = '#cfe2ec'; rr(g, 186, 60, 70, 86, 30); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; ell(g, 206, 86, 8, 18, 0.3, 'rgba(255,255,255,0.5)'); // ayna
    g.fillStyle = '#f2a6b8'; rr(g, 252, 160, 30, 70, 6); g.fill(); g.fillStyle = '#b9c3cc'; g.fillRect(244, 156, 46, 4); // havlu
  }
  function drawYatak(g, night) {
    drawRoomBase(g, night ? '#5a5a86' : '#e6def0', night ? '#4b4b74' : '#d9cfe6', '#b99a7c', '#a3866a');
    drawWindow(g, 200, 54, 72, 90, night);
    // kedi yatagi (sol)
    const bed = save.house.placed.yatak;
    if (bed === 'yatak_bulut') { for (const [bx, r] of [[62, 18], [84, 22], [108, 21], [130, 17]]) dot(g, bx, 340, r, '#ffffff'); ell(g, 96, 352, 56, 9, 0, '#eef3ff'); }
    else { ell(g, BED_X, 350, 62, 16, 0, '#c9945a'); ell(g, BED_X, 344, 52, 11, 0, bed ? '#e9b4c0' : '#d7c3e8'); }
    // abajur (sag)
    g.fillStyle = '#8a7a6a'; g.fillRect(247, 230, 6, 66); rr(g, 232, 292, 36, 6, 3); g.fill();
    g.fillStyle = night ? '#ffe2a0' : '#f6d5b0'; g.beginPath(); g.moveTo(230, 230); g.lineTo(270, 230); g.lineTo(262, 200); g.lineTo(238, 200); g.closePath(); g.fill();
  }
  // ================= Ev mini oyunlari: lazer, yumak, balik tutma (20 sn) =================
  // Her oyun kedinin enerjisinden harcar, eglencesini doldurur; puana gore balik verir (en fazla 15).
  const MINIS = {
    laser: { name: 'Lazer',     room: 'salon',  icon: '🔴', how: 'Parmağını sürükle, kedin noktayı kovalasın!' },
    yarn:  { name: 'Yumak',     room: 'yatak',  icon: '🧶', how: 'Yumağa dokun, yere düşürmeden havada tut!' },
    fish:  { name: 'Balık Tut', room: 'mutfak', icon: '🐠', how: 'Kasedeki balıklara dokun, altın balık 3 puan!' },
  };
  const MINI_T = 20;
  let mg = null;
  function startMini(kind) {
    const p = save.pet;
    if (mg) return;
    if (p.sleep) { petSay('Şşş... uyuyor. Önce lambayı aç.'); sfx('nope'); return; }
    if (p.energy < 15) { petSay('Çok yorgunum... biraz uyuyayım mı?'); sfx('meowSad'); return; }
    pet.tool = ''; renderToyChips();
    setRoom(MINIS[kind].room);
    mg = { kind, t: MINI_T, score: 0, start: 1.2, dot: { x: 200, y: FLOOR - 20, on: false, moved: 0 }, ball: null, fish: [], best: 0, streak: 0, fx: [] };
    if (kind === 'yarn') mg.ball = { x: 150, y: 140, vx: 0, vy: 0, wait: 0 };
    if (kind === 'fish') for (let i = 0; i < 4; i++) mg.fish.push(newMiniFish(i));
    if (kind !== 'laser') setAct('sit', 99);
    petSay(MINIS[kind].how, 2.4);
    sfx('meowHappy');
    document.querySelectorAll('[data-mini]').forEach((b) => b.classList.toggle('on', b.dataset.mini === kind));
  }
  function newMiniFish(i) {
    const gold = Math.random() < 0.15;
    return { a: Math.random() * TAU, r: 30 + Math.random() * 50, sp: (0.7 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1), yk: 0.45 + Math.random() * 0.2, ph: i * 1.3, gold, caught: 0 };
  }
  const BOWL = { x: 150, y: 170, rx: 112, ry: 70 };
  function miniFishPos(f) { return [BOWL.x + Math.cos(f.a) * f.r * 1.25, BOWL.y + 8 + Math.sin(f.a * 2 + f.ph) * BOWL.ry * f.yk * 0.6]; }
  function endMini(quit) {
    if (!mg) return;
    const sc = mg.score, reward = quit ? 0 : Math.min(15, Math.round(sc * (mg.kind === 'yarn' ? 0.8 : 1)));
    const p = save.pet;
    if (!quit) {
      p.fun = Math.min(100, p.fun + 25); p.energy = Math.max(0, p.energy - 10);
      save.wallet += reward; persist('wallet'); persist('pet');
      $('wallet').textContent = save.wallet;
      petSay(`${MINIS[mg.kind].name} bitti! ${sc} puan${reward ? ` · +${reward} balık` : ''}`, 3);
      sfx(sc >= 8 ? 'meowHappy' : 'meowShort'); hc.jv = -170;
      petBars();
    }
    mg = null;
    setAct('sit', 2);
    document.querySelectorAll('[data-mini]').forEach((b) => b.classList.remove('on'));
  }
  function miniPointer(kind, x, y) {
    if (!mg || mg.start > 0) return;
    if (mg.kind === 'laser') {
      if (kind === 'down') mg.dot.on = true;
      if (kind === 'up') mg.dot.on = false;
      if (mg.dot.on) { mg.dot.moved += Math.hypot(x - mg.dot.x, y - mg.dot.y); mg.dot.x = Math.max(20, Math.min(HW - 20, x)); mg.dot.y = Math.max(60, Math.min(FLOOR - 4, y)); }
    } else if (mg.kind === 'yarn' && kind === 'down') {
      const b = mg.ball;
      if (b.wait <= 0 && Math.hypot(x - b.x, y - b.y) < 34) {
        b.vy = -420 - Math.min(120, mg.streak * 6); b.vx = (b.x - x) * 7 + (Math.random() - 0.5) * 60;
        mg.score++; mg.streak++; mg.best = Math.max(mg.best, mg.streak);
        sfx('click'); mg.fx.push({ x: b.x, y: b.y, t: 0, txt: mg.streak > 1 ? 'x' + mg.streak : '+1' });
      }
    } else if (mg.kind === 'fish' && kind === 'down') {
      for (const f of mg.fish) {
        if (f.caught > 0) continue;
        const [fx, fy] = miniFishPos(f);
        if (Math.hypot(x - fx, y - fy) < 20) {
          const pts = f.gold ? 3 : 1; mg.score += pts; f.caught = 0.5;
          mg.fx.push({ x: fx, y: fy, t: 0, txt: '+' + pts }); sfx('coin'); hc.jv = -150; hc.mouth = 1;
          return;
        }
      }
      mg.fx.push({ x, y, t: 0, txt: '💧' }); sfx('splash');
    }
  }
  function updateMini(dt) {
    if (!mg) return;
    for (const e of mg.fx) e.t += dt;
    mg.fx = mg.fx.filter((e) => e.t < 0.9);
    if (mg.start > 0) { mg.start -= dt; return; }
    mg.t -= dt;
    if (mg.t <= 0) { endMini(false); return; }
    if (mg.kind === 'laser') { // kedi noktaya kosar; nokta duvardaysa ziplar; yakalayinca nokta yeniden kacmali
      const d = mg.dot;
      const want = Math.max(60, Math.min(240, d.x - 20 * (d.x >= hc.x ? 1 : -1)));
      if (Math.abs(hc.tx - want) > 6 || hc.act !== 'walk' && Math.abs(hc.x - want) > 8) catGo(want, null);
      const near = Math.abs(hc.x + 20 * hc.dir - d.x) < 26;
      if (near && d.y < FLOOR - 50 && hc.jy === 0) { hc.jv = -260; }
      const reach = d.y > FLOOR - 40 || (hc.jy < -30 && d.y > FLOOR - 160);
      if (near && reach && d.moved > 70 && pet.catchCool <= 0) {
        mg.score++; d.moved = 0; pet.catchCool = 0.5; hc.mouth = 1;
        mg.fx.push({ x: d.x, y: d.y - 14, t: 0, txt: '+1' }); sfx('meowShort');
      }
    } else if (mg.kind === 'yarn') {
      const b = mg.ball;
      if (b.wait > 0) { b.wait -= dt; if (b.wait <= 0) { b.x = 80 + Math.random() * 140; b.y = 110; b.vx = 0; b.vy = 0; } return; }
      b.vy += 520 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 1 - dt * 0.4;
      if (b.x < 22) { b.x = 22; b.vx = Math.abs(b.vx) * 0.8; } if (b.x > HW - 22) { b.x = HW - 22; b.vx = -Math.abs(b.vx) * 0.8; }
      if (b.y < 56) { b.y = 56; b.vy = Math.abs(b.vy) * 0.5; }
      if (Math.abs(b.x - hc.x) < 60 && b.y > FLOOR - 150 && hc.jy === 0 && b.vy > 0) hc.jv = -200; // kedi yumaga atilir
      if (b.y > FLOOR - 12) { b.y = FLOOR - 12; b.wait = 0.9; mg.streak = 0; sfx('land'); }
    } else if (mg.kind === 'fish') {
      const sp = 1 + (MINI_T - mg.t) / MINI_T; // zamanla hizlanir
      mg.fish.forEach((f, i) => {
        if (f.caught > 0) { f.caught -= dt; if (f.caught <= 0) mg.fish[i] = newMiniFish(i); return; }
        f.a += f.sp * sp * dt;
      });
    }
  }
  function drawMini(g) {
    if (!mg) return;
    if (mg.kind === 'fish') { // duvarda buyuk akvaryum kasesi
      g.fillStyle = 'rgba(160,200,230,0.55)'; g.beginPath(); g.ellipse(BOWL.x, BOWL.y, BOWL.rx, BOWL.ry, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(BOWL.x - 50, BOWL.y - 30, 26, 8, -0.4, 0, TAU); g.fill();
      for (const f of mg.fish) {
        const [fx, fy] = miniFishPos(f), dir = Math.sign(-Math.sin(f.a) * f.sp) || 1;
        g.save(); g.translate(fx, fy); g.scale(dir * 2, 2); g.globalAlpha = f.caught > 0 ? f.caught * 2 : 1;
        if (f.gold) dot(g, 0, 0, 7, 'rgba(246,195,91,0.35)');
        drawFish(g, 0, 0, 1, false); g.restore();
      }
    } else if (mg.kind === 'yarn' && mg.ball) {
      const b = mg.ball;
      if (b.wait <= 0 || Math.floor(b.wait * 8) % 2) {
        ell(g, b.x, FLOOR + 2, 14 * (0.5 + b.y / FLOOR / 2), 3, 0, 'rgba(0,0,0,0.12)');
        dot(g, b.x, b.y, 15, '#d9708a'); g.strokeStyle = '#b8506a'; g.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(b.x, b.y, 13 - i * 3, b.y * 0.05 + i, b.y * 0.05 + i + 2.2); g.stroke(); }
        g.beginPath(); g.moveTo(b.x + 10, b.y + 9); g.quadraticCurveTo(b.x + 24, b.y + 22, b.x + 18, b.y + 34); g.stroke();
      }
    } else if (mg.kind === 'laser' && mg.start <= 0) {
      const d = mg.dot;
      const lg = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, 12); lg.addColorStop(0, 'rgba(255,60,60,0.9)'); lg.addColorStop(1, 'rgba(255,60,60,0)');
      g.fillStyle = lg; g.beginPath(); g.arc(d.x, d.y, 12, 0, TAU); g.fill(); dot(g, d.x, d.y, 3, '#ff4a4a');
    }
    for (const e of mg.fx) { g.globalAlpha = 1 - e.t / 0.9; g.fillStyle = '#5b4f73'; g.font = `800 14px ${ROOM_FONT}`; g.textAlign = 'center'; g.fillText(e.txt, e.x, e.y - e.t * 30); g.globalAlpha = 1; }
    // ust bilgi: oyun adi, sure, puan
    g.fillStyle = 'rgba(255,255,255,0.85)'; rr(g, 60, 44, HW - 120, 26, 13); g.fill();
    g.fillStyle = '#5b4f73'; g.font = `800 13px ${ROOM_FONT}`; g.textAlign = 'center';
    g.fillText(mg.start > 0 ? `${MINIS[mg.kind].icon} ${MINIS[mg.kind].name} · Hazır ol...` : `${MINIS[mg.kind].icon} ${Math.ceil(mg.t)} sn · Puan ${mg.score}${mg.kind === 'yarn' ? ` · Seri ${mg.best}` : ''}`, HW / 2, 62);
  }

  // kurtarilan yavrular odalara dagilir: oturur, uzanir ya da uyur (her odada en fazla 4)
  const STRAY_SPOTS = [[42, 0], [262, 1], [96, 2], [214, 0]];
  const straySprites = {};
  function straySprite(st, pose, ang) {
    const key = st.id + pose;
    if (straySprites[key]) return straySprites[key];
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const g = c.getContext('2d');
    g.setTransform(4, 0, 0, 4, 100, 116);
    drawCat3D(g, st, ang, 1, {}, 0, 0, pose === 1 ? { eyes: 'closed' } : pose === 2 ? { eyes: 'happy' } : null);
    return (straySprites[key] = c);
  }
  function drawHouseStrays(g) {
    const found = STRAYS.filter((st) => save.strays[st.id]), ri = ROOMS.findIndex((q) => q.id === pet.room);
    found.filter((_, i) => i % 4 === ri).slice(0, 4).forEach((st, j) => {
      const [x, pose] = STRAY_SPOTS[j], dir = x < HW / 2 ? 1 : -1, k = CS * 0.5;
      const t = clock + j * 1.7, spr = straySprite(st, pose, dir * 0.5), br = 1 + Math.sin(t * 2) * 0.015; // hafif nefes
      const ks = CS * 0.6; // yavru: evdeki kediden kucuk
      g.save(); g.translate(x, FLOOR - 20 * ks * br); g.scale(ks / 4, (ks / 4) * br);
      g.drawImage(spr, -100, -116);
      g.restore();
      if (pose === 1 && (t % 3) < 2) { g.fillStyle = 'rgba(91,79,115,0.5)'; g.font = "700 9px " + ROOM_FONT; g.textAlign = 'center'; g.fillText('z', x + dir * 14, FLOOR - 30 - (t % 3) * 4); }
    });
  }
  function drawHouse() {
    if (state !== 'menu') return;
    const cv = $('houseCv'), g = cv.getContext('2d');
    if (!cv.width) return;
    const k = cv.width / HW;
    g.setTransform(k, 0, 0, k, 0, 0);
    const night = save.pet.sleep;
    if (pet.room === 'mutfak') drawMutfak(g);
    else if (pet.room === 'banyo') drawBanyo(g);
    else if (pet.room === 'yatak') drawYatak(g, night);
    else drawSalon(g);
    drawHouseStrays(g);
    drawPet(g);
    drawMini(g);
    // ust serit: oda adi ve oklar
    g.fillStyle = 'rgba(255,255,255,0.72)'; rr(g, 8, 8, HW - 16, 30, 15); g.fill();
    const i = ROOMS.findIndex((q) => q.id === pet.room);
    g.fillStyle = '#5b4f73'; g.textAlign = 'center';
    g.font = `700 15px ${ROOM_FONT}`; g.fillText(ROOMS[i].name, HW / 2, 28);
    g.font = `800 18px ${ROOM_FONT}`; g.fillText('‹', 30, 29); g.fillText('›', HW - 30, 29);
    g.font = `600 9px ${ROOM_FONT}`; g.fillStyle = 'rgba(91,79,115,0.7)';
    g.fillText(ROOMS[(i + 3) % 4].name, 62, 27); g.fillText(ROOMS[(i + 1) % 4].name, HW - 64, 27);
  }
  function renderHouse() {
    petTick(true); petBars();
    $('wallet').textContent = save.wallet;
    $('houseTitle').textContent = genitive(catName()) + ' Evi';
    renderToyChips();
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
      g.fillStyle = '#7a7391'; g.font = '700 44px ' + FONT; g.fillText(catName() + ' ile tırmandım', 540, 1170);
      g.fillStyle = '#ff8f70'; g.font = '800 40px ' + FONT; g.fillText(SITE_URL.replace('https://', ''), 540, 1250);
      shareLink = SITE_URL + '?vs=' + m;
      shareText = 'Patikat\'ta ' + m + ' metre tırmandım! 🐾 Beni geçebilir misin? ' + shareLink;
    } else {
      g.fillStyle = '#3b3552'; g.font = '800 70px ' + FONT; g.fillText(catName(), 540, 1150);
      g.fillStyle = '#7a7391'; g.font = '600 40px ' + FONT; g.fillText('duvardan duvara, kat kat yukarı', 540, 1225);
      shareLink = SITE_URL;
      shareText = 'Kedim ' + catName() + ' 🐾 #Patikat ' + SITE_URL;
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
      const name = catName(), now = Date.now();
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
    ['houseCv', 'Kedin burada yaşıyor', 'Parmağınla sürükleyip çevir, dokununca miyavlar.'],
    ['petActs', 'Kedine bak', 'Besle, yıka, sev, oyna, uyut. Mutlu kedi oyunda %10 fazla balık getirir.'],
    ['endlessBtn', 'Çatı Koşusu', 'Ne kadar uzağa gidebilirsin? Her 200 metre yeni bir kat.'],
    ['dailyBtn', 'Günün Seferi', 'Herkes aynı parkurda yarışır. Günde 3 hakkın var.'],
    ['levelsBtn', 'Bölümler', '18 kat, Karabaş bölümleri ve yıldızlar seni bekliyor.'],
    ['houseFurn', 'Evi döşe', 'Balıklarla eşya al, kedinin odasını döşe.'],
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
  const SCREENS = ['menu', 'levels', 'chars', 'shop', 'missions', 'wardrobe', 'strays', 'board', 'settings', 'ach', 'photo', 'pause', 'over', 'win'];
  const TAB_OF = { menu: 'home', settings: 'home', photo: 'cat', ach: 'goals', levels: 'map', chars: 'cat', wardrobe: 'cat', strays: 'cat', shop: 'shop', missions: 'goals', board: 'goals' };
  const TAB_TARGET = { home: 'menu', map: 'levels', cat: 'chars', shop: 'shop', goals: 'missions' };
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('pauseBtn').classList.toggle('hidden', state !== 'play');
    const tab = id ? TAB_OF[id] : null;
    $('tabbar').classList.toggle('hidden', !tab);
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  }
  function showScreen(name) {
    if (name === 'house') name = 'menu'; // Kedi Evi artik acilis ekrani
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
    if (name === 'strays') renderStrays();
    if (name === 'board') renderBoard();
    if (name !== 'menu' && pet.tool) { pet.tool = ''; purrSet(false); }
    if (name === 'settings') renderMenu();
    if (name === 'ach') renderAch();
    show(name);
    if (name === 'menu' && save.tutorialDone && !save.tourDone && tourStep < 0 && $('nameBox').classList.contains('hidden')) setTimeout(startTour, 600);
    if (name === 'menu' && !hero.greeted) {
      hero.greeted = true;
      hc.jv = -150;
      petSay(`Miyav! Hoş geldin${save.playerName ? ', ' + save.playerName : ''}!`, 3);
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

  const MODE_NAMES = { endless: 'Çatı Koşusu', daily: 'Günün Seferi', level: 'Bölüm' };
  function renderMenu() {
    renderHouse();
    $('playerBtn').textContent = save.playerName ? save.playerName + ' ✏️' : 'Adını yaz ✏️';
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
    $('tutorialBtn').textContent = save.tutorialDone ? 'Eğitimi tekrar oyna' : 'Yeni misin? Önce eğitimi oyna';
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
        <b>${i + 1}</b><span>${lv.zone ? ZONES[lv.zone].icon + " " : ""}${lv.name}</span>
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
      $('charPvName').textContent = catName(c.id);
      $('renameBtn').classList.toggle('hidden', !owned);
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
        showNote('Yeni kedi!', `${catName(c.id)} artık senin`);
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
      return `<button class="ch${cls}" data-char="${c.id}"><canvas width="128" height="128"></canvas><b>${esc(catName(c.id))}</b><small>${c.ability}</small><span>${status}</span></button>`;
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

  function renderStrays() { // sokak kedileri koleksiyonu: bulunanlar renkli, bulunmayanlar golge ve ipucuyla
    const n = STRAYS.filter((st) => save.strays[st.id]).length;
    $('strayCount').textContent = `${n} / ${STRAYS.length}`;
    $('strayList').innerHTML = ZONES.map((zn, zi) => {
      const list = STRAYS.filter((st) => st.z === zi), got = list.filter((st) => save.strays[st.id]).length;
      const items = list.map((st) => { const has = save.strays[st.id];
        return `<div class="ch stray${has ? ' own' : ' cant'}" data-stray="${st.id}"><canvas width="96" height="96"></canvas><b>${has ? st.name : '???'}</b><span>${has ? st.note : zn.at + ' bulunur'}</span></div>`; }).join('');
      return `<h3>${zn.icon} ${zn.name} · ${got}/${list.length}</h3><div class="grid chars-grid">${items}</div>`;
    }).join('');
    $('strayList').querySelectorAll('[data-stray]').forEach((el) => {
      const st = STRAY_BY_ID[el.dataset.stray], g = el.querySelector('canvas').getContext('2d');
      g.setTransform(2.1, 0, 0, 2.1, 48, 50);
      if (!save.strays[st.id]) g.globalAlpha = 0.22;
      drawCat3D(g, save.strays[st.id] ? st : { ...st, id: 'golge', fur: '#6b6474', fur2: '#6b6474', fur3: '#6b6474', belly: '#6b6474', paws: '#6b6474', pattern: 'solid' }, 0.45, 1, {}, 0, 0, null);
    });
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
    $('missionDone').textContent = `${save.missions.completed} · Kalıcı puan çarpanın: x${permMult()} (her 3 görevde +1)`;
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
    if (state === 'play') { // beklemeden zipla
      const p = player, fromGround = (p.ground || p.coyote > 0) && !p.shaft;
      jump();
      press = { x: e.clientX, y: e.clientY, t: performance.now(), done: false, jumped: fromGround && !p.ground };
      return;
    }
    onTap();
  }, { passive: false });
  window.addEventListener('pointermove', (e) => {
    if (!press || press.done || state !== 'play') return;
    const dy = e.clientY - press.y;
    if (dy > 18) {
      press.done = true;
      const p = player;
      if (press.jumped && performance.now() - press.t < 180 && p.jy !== undefined && p.y > p.jy - 34 && p.vy < 0 && !p.shaft) { // yanlislikla baslayan ziplamayi geri al
        p.y = p.jy; p.vy = 0; p.ground = true; p.ledge = p.jLedge || null; p.pati = false;
      }
      slide();
    }
  });
  const pressEnd = () => { press = null; };
  window.addEventListener('pointerup', pressEnd);
  window.addEventListener('pointercancel', pressEnd);

  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    if (!b.dataset.char && !b.dataset.cos && !b.dataset.upg && b.id !== 'soundBtn') sfx('click');
    const a = b.dataset.act;
    if (a === 'endless' || a === 'daily' || a === 'tutorial') startRun(a);
    else if (a === 'resume') loadResume();
    else if (a === 'revive') revive();
    else if (['levels', 'chars', 'shop', 'missions', 'wardrobe', 'strays', 'board', 'settings'].includes(a)) showScreen(a);
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
    else if (b.dataset.toysel) { save.toys.sel = b.dataset.toysel; persist('toys'); renderToyChips(); sfx('meowShort'); petSay(TOY_BY_ID[save.toys.sel].name + ' ile oynayalım!'); }
    else if (a === 'rename') openNameBox('cat', pv.cat);
    else if (a === 'playerName') openNameBox('player');
    else if (a === 'nameOk') closeNameBox();
    else if (a === 'pvAction') pvAction();
    else if (a === 'claimLogin') claimLogin();
    else if (a === 'photo') makePhoto('cat');
    else if (a === 'challenge') makePhoto('challenge');
    else if (a === 'sharePhoto') sharePhoto();
    else if (a === 'ach' || a === 'house') showScreen(a);
    else if (b.dataset.house) houseClick(b.dataset.house);
    else if (b.dataset.pet) { if (mg) endMini(true); petTool(b.dataset.pet); }
    else if (b.dataset.mini) { if (mg && mg.kind === b.dataset.mini) endMini(true); else startMini(b.dataset.mini); }
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

  // ---------- Isim penceresi: oyuncunun adi (istege bagli) ve kedinin adi ----------
  const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  let nameFor = { kind: '', cat: '', then: null };
  function openNameBox(kind, catId = save.char, then = null) {
    nameFor = { kind, cat: catId, then };
    const welcome = kind === 'welcome';
    $('nameBoxTitle').textContent = welcome ? 'Hoş geldin! 🐾' : kind === 'player' ? 'Adın' : 'Kedine isim ver';
    $('playerRow').classList.toggle('hidden', kind === 'cat');
    $('catRow').classList.toggle('hidden', kind === 'player');
    $('playerNameIn').value = save.playerName;
    $('catNameIn').value = catName(catId);
    $('catNameIn').placeholder = CAT_BY_ID[catId].name;
    $('nameBox').classList.remove('hidden');
  }
  function closeNameBox() {
    const k = nameFor.kind;
    if (k !== 'cat') { save.playerName = clean($('playerNameIn').value, 16); persist('playerName'); if ($('nameInput')) $('nameInput').value = save.playerName; }
    if (k !== 'player') {
      const n = clean($('catNameIn').value, 14);
      if (n && n !== CAT_BY_ID[nameFor.cat].name) save.catNames[nameFor.cat] = n; else delete save.catNames[nameFor.cat];
      persist('catNames');
    }
    if (k === 'welcome') { save.welcomed = true; persist('welcomed'); }
    $('nameBox').classList.add('hidden');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    sfx('meowHappy');
    if (state === 'chars') { renderChars(); updatePreviewPanel(); }
    if (state === 'menu' || state === 'settings') renderMenu();
    const then = nameFor.then; nameFor = { kind: '', cat: '', then: null };
    if (then) then();
    else if (k === 'welcome' && state === 'menu') { hc.jv = -150; petSay(`Miyav! Ben ${catName()}${save.playerName ? ', sen de ' + save.playerName : ''}. Hoş geldin!`, 3); if (save.tutorialDone && !save.tourDone) setTimeout(startTour, 800); }
  }
  for (const id of ['playerNameIn', 'catNameIn']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closeNameBox(); } });

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && state === 'play') { e.preventDefault(); if (!e.repeat) slide(); return; }
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
    drawPreview();
    drawHouse();
    musicTick();
    rainAmbience();
    cityAmbience(1 / 60);
    if (DEMO) {
      document.title = `state:${state} score:${score()} m:${meters()} t:${clock.toFixed(1)} speed:${Math.round(speed)}` +
        ` shieldHits:${shieldHits} lost:${stats.livesLost} coins:${coinCount}/${coinsSpawned} near:${stats.near}` +
        ` lines:${stats.lines} jets:${stats.jets} stage:${stage} weather:${weather} lives:${lives}` +
        ` tally:${JSON.stringify(spawnTally)} sl:${stats.slides} bx:${stats.boxes} ld:${stats.ledges} pw:${stats.powers} spd:${Math.round(speed)} dogs:${stats.dogs} crows:${stats.crows} chase:${chase ? chase.phase + Math.round(chase.gap) : '-'} yavru:${stats.strays || 0} boss:${boss ? boss.kind + boss.hp + (boss.beaten ? 'YENDI' : '') : '-'} x:${Math.round(player.x)} y:${Math.round(player.y)} g:${player.ground ? 1 : 0} hits:${hitLog}`;
    }
    requestAnimationFrame(frame);
  }

  if (THEME_BY_ID[params.get('theme')]) save.theme = params.get('theme'); // test icin
  const vs = Math.floor(Number(params.get('vs'))); // meydan okuma linkiyle gelindi
  if (vs > 0 && vs < 100000 && !DEMO) { save.rival = { m: vs, beaten: false }; persist('rival'); setTimeout(() => showNote('Meydan okuma! 🏆', 'Arkadaşın ' + vs + ' m tırmandı. Çatı Koşusuda onu geçebilir misin?'), 1500); }
  buildPalettes();
  setPalette(0, true);
  resize();
  window.addEventListener('resize', resize);
  reset();
  showScreen('menu');
  if (!DEMO && MENU_STATES.includes(params.get('screen'))) showScreen(params.get('screen')); // dogrudan ekran (test icin)
  else if (!DEMO && !save.tutorialDone && save.life.runs === 0 && !save.resume) openNameBox('welcome', save.char, () => startRun('tutorial')); // yeni oyuncu: once isim, sonra egitim
  else if (!DEMO && !save.welcomed) openNameBox('welcome'); // eski oyunculara bir kez isim sorulur
  if (DEMO) {
    const lv = Number(params.get('lv'));
    const mode = params.get('mode');
    if (mode === 'level' && LEVELS[lv]) startRun('level', lv);
    else if (mode === 'daily' || mode === 'tutorial') startRun(mode);
    else startRun('endless');
    if (params.has('count')) startCountdown();
    if (params.has('record')) run.recordM = Number(params.get('record'));
    if (POWERS[params.get('power')]) collectPower({ kind: params.get('power'), x: player.x, y: player.y }); // test: guclendirmeyle basla
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

// Saisonovo Backend — Node.js + Express
// Run: npm install && node server.js
// API runs on http://localhost:3001

const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

/* ══════════════════════════════════════════
   IN-MEMORY DATABASE
   In production: replace with PostgreSQL/Supabase
   ══════════════════════════════════════════ */

// ── Foods ──
const FOODS = [
  { id:1,  name:'Tomate',       emoji:'🍅', category:'Gemüse',   co2_kg:0.7,  water_l:50  },
  { id:2,  name:'Spargel',      emoji:'🌱', category:'Gemüse',   co2_kg:0.4,  water_l:40  },
  { id:3,  name:'Erdbeere',     emoji:'🍓', category:'Obst',     co2_kg:0.5,  water_l:30  },
  { id:4,  name:'Karotte',      emoji:'🥕', category:'Gemüse',   co2_kg:0.3,  water_l:35  },
  { id:5,  name:'Pilze',        emoji:'🍄', category:'Gemüse',   co2_kg:0.2,  water_l:20  },
  { id:6,  name:'Mangold',      emoji:'🥬', category:'Gemüse',   co2_kg:0.3,  water_l:30  },
  { id:7,  name:'Apfel',        emoji:'🍎', category:'Obst',     co2_kg:0.4,  water_l:70  },
  { id:8,  name:'Kürbis',       emoji:'🎃', category:'Gemüse',   co2_kg:0.5,  water_l:45  },
  { id:9,  name:'Brokkoli',     emoji:'🥦', category:'Gemüse',   co2_kg:0.5,  water_l:50  },
  { id:10, name:'Zucchini',     emoji:'🥒', category:'Gemüse',   co2_kg:0.4,  water_l:30  },
  { id:11, name:'Paprika',      emoji:'🫑', category:'Gemüse',   co2_kg:0.8,  water_l:60  },
  { id:12, name:'Birne',        emoji:'🍐', category:'Obst',     co2_kg:0.4,  water_l:65  },
  { id:13, name:'Pflaume',      emoji:'🍑', category:'Obst',     co2_kg:0.4,  water_l:55  },
  { id:14, name:'Zwiebel',      emoji:'🧅', category:'Gemüse',   co2_kg:0.2,  water_l:25  },
  { id:15, name:'Knoblauch',    emoji:'🧄', category:'Gemüse',   co2_kg:0.2,  water_l:20  },
  { id:16, name:'Kartoffel',    emoji:'🥔', category:'Gemüse',   co2_kg:0.2,  water_l:25  },
  { id:17, name:'Spinat',       emoji:'🍃', category:'Gemüse',   co2_kg:0.3,  water_l:28  },
  { id:18, name:'Gurke',        emoji:'🥒', category:'Gemüse',   co2_kg:0.5,  water_l:40  },
  { id:19, name:'Kohlrabi',     emoji:'🥦', category:'Gemüse',   co2_kg:0.3,  water_l:30  },
  { id:20, name:'Blumenkohl',   emoji:'🥦', category:'Gemüse',   co2_kg:0.5,  water_l:48  },
  { id:21, name:'Himbeere',     emoji:'🍓', category:'Obst',     co2_kg:0.6,  water_l:35  },
  { id:22, name:'Heidelbeere',  emoji:'🫐', category:'Obst',     co2_kg:0.5,  water_l:30  },
  { id:23, name:'Kirsche',      emoji:'🍒', category:'Obst',     co2_kg:0.5,  water_l:40  },
  { id:24, name:'Rote Bete',    emoji:'🟥', category:'Gemüse',   co2_kg:0.3,  water_l:35  },
  { id:25, name:'Lauch',        emoji:'🧅', category:'Gemüse',   co2_kg:0.3,  water_l:30  },
  { id:26, name:'Avocado',      emoji:'🥑', category:'Importiert', co2_kg:2.1, water_l:1000 },
  { id:27, name:'Banane',       emoji:'🍌', category:'Importiert', co2_kg:0.9, water_l:160  },
  { id:28, name:'Mango',        emoji:'🥭', category:'Importiert', co2_kg:1.2, water_l:200  },
  { id:29, name:'Ananas',       emoji:'🍍', category:'Importiert', co2_kg:1.5, water_l:250  },
  { id:30, name:'Hafermilch',   emoji:'🥛', category:'Getränk',  co2_kg:0.3,  water_l:48   },
  { id:31, name:'Kuhmilch',     emoji:'🥛', category:'Getränk',  co2_kg:3.2,  water_l:628  },
  { id:32, name:'Rindfleisch',  emoji:'🥩', category:'Fleisch',  co2_kg:13.3, water_l:1550 },
  { id:33, name:'Hühnchen',     emoji:'🍗', category:'Fleisch',  co2_kg:3.6,  water_l:430  },
  { id:34, name:'Schwein',      emoji:'🥓', category:'Fleisch',  co2_kg:4.9,  water_l:570  },
  { id:35, name:'Linsen',       emoji:'🫘', category:'Hülsenfrucht', co2_kg:0.9, water_l:50 },
  { id:36, name:'Kichererbsen', emoji:'🫘', category:'Hülsenfrucht', co2_kg:0.8, water_l:48 },
  { id:37, name:'Tofu',         emoji:'🟫', category:'Hülsenfrucht', co2_kg:2.0, water_l:244 },
];

// ── Seasons: food_id → { region: [months 1-12] } ──
const SEASONS = {
  1:  { DE:[6,7,8,9],        AT:[6,7,8,9],      CH:[6,7,8,9],      FR:[5,6,7,8,9,10] },
  2:  { DE:[4,5,6],          AT:[4,5,6],        CH:[4,5,6],        FR:[3,4,5,6] },
  3:  { DE:[5,6,7],          AT:[5,6,7],        CH:[5,6,7],        FR:[4,5,6,7] },
  4:  { DE:[3,4,5,6,7,8,9,10,11], AT:[4,5,6,7,8,9,10], CH:[4,5,6,7,8,9,10], FR:[3,4,5,6,7,8,9,10] },
  5:  { DE:[4,5,6,7,8,9,10,11],   AT:[4,5,6,7,8,9,10,11], CH:[5,6,7,8,9,10], FR:[4,5,6,7,8,9,10] },
  6:  { DE:[5,6,7,8,9,10],   AT:[5,6,7,8,9],    CH:[5,6,7,8,9],    FR:[4,5,6,7,8,9,10] },
  7:  { DE:[8,9,10,11,12,1,2,3], AT:[9,10,11,12,1,2,3], CH:[9,10,11,12,1,2], FR:[8,9,10,11,12,1,2] },
  8:  { DE:[9,10,11],        AT:[9,10,11],      CH:[9,10,11],      FR:[8,9,10,11] },
  9:  { DE:[6,7,8,9,10,11],  AT:[6,7,8,9,10],   CH:[6,7,8,9,10],   FR:[5,6,7,8,9,10,11] },
  10: { DE:[6,7,8,9],        AT:[6,7,8,9],      CH:[6,7,8],        FR:[5,6,7,8,9] },
  11: { DE:[7,8,9],          AT:[7,8,9],        CH:[7,8,9],        FR:[6,7,8,9,10] },
  12: { DE:[8,9,10,11],      AT:[8,9,10],       CH:[8,9,10],       FR:[7,8,9,10,11] },
  13: { DE:[7,8,9],          AT:[7,8,9],        CH:[7,8,9],        FR:[6,7,8,9] },
  14: { DE:[3,4,5,6,7,8,9,10,11,12], AT:[4,5,6,7,8,9,10,11], CH:[4,5,6,7,8,9,10,11], FR:[3,4,5,6,7,8,9,10,11,12] },
  15: { DE:[6,7,8,9,10],     AT:[6,7,8,9],      CH:[7,8,9],        FR:[5,6,7,8,9] },
  16: { DE:[4,5,6,7,8,9,10,11,12], AT:[5,6,7,8,9,10,11], CH:[5,6,7,8,9,10,11], FR:[4,5,6,7,8,9,10,11,12] },
  17: { DE:[3,4,5,9,10,11],  AT:[4,5,6,9,10],   CH:[4,5,6,9,10],   FR:[3,4,5,6,9,10,11] },
  18: { DE:[5,6,7,8,9],      AT:[5,6,7,8,9],    CH:[5,6,7,8],      FR:[5,6,7,8,9] },
  19: { DE:[4,5,6,7,8,9,10], AT:[5,6,7,8,9],    CH:[5,6,7,8,9],    FR:[4,5,6,7,8,9] },
  20: { DE:[5,6,7,8,9,10,11],AT:[5,6,7,8,9,10], CH:[6,7,8,9,10],   FR:[4,5,6,7,8,9,10,11] },
  21: { DE:[6,7,8,9],        AT:[6,7,8],        CH:[6,7,8],        FR:[6,7,8,9] },
  22: { DE:[6,7,8,9],        AT:[7,8,9],        CH:[7,8],          FR:[6,7,8] },
  23: { DE:[6,7,8],          AT:[6,7,8],        CH:[6,7],          FR:[5,6,7,8] },
  24: { DE:[6,7,8,9,10,11,12], AT:[7,8,9,10,11], CH:[7,8,9,10,11], FR:[6,7,8,9,10,11] },
  25: { DE:[3,4,5,9,10,11,12,1,2], AT:[4,5,9,10,11,12], CH:[4,5,9,10,11,12], FR:[3,4,5,9,10,11,12,1,2] },
  // 26-29: Importwaren, keine Saison
  30: { DE:[1,2,3,4,5,6,7,8,9,10,11,12], AT:[1,2,3,4,5,6,7,8,9,10,11,12], CH:[1,2,3,4,5,6,7,8,9,10,11,12], FR:[1,2,3,4,5,6,7,8,9,10,11,12] },
};

// ── Users (in-memory, in production: DB) ──
const USERS = new Map(); // token → user object

// ── Shopping Lists: userId → [{id, foodId, name, emoji, quantity, unit, done, addedAt}] ──
const USER_LISTS = new Map();

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */
function nowMonth() { return new Date().getMonth() + 1; }

function isInSeason(foodId, region) {
  const s = SEASONS[foodId];
  if (!s || !s[region]) return false;
  return s[region].includes(nowMonth());
}

function getToken(req) {
  const h = req.headers.authorization || '';
  return h.replace('Bearer ', '').trim();
}

function requireAuth(req, res) {
  const token = getToken(req);
  const user = USERS.get(token);
  if (!user) { res.status(401).json({ error: 'Nicht authentifiziert' }); return null; }
  return user;
}

/* ══════════════════════════════════════════
   AUTH ROUTES
   ══════════════════════════════════════════ */

// Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email und password erforderlich' });
  if ([...USERS.values()].find(u => u.email === email))
    return res.status(409).json({ error: 'E-Mail bereits registriert' });

  const id    = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const user  = {
    id, name, email,
    passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
    region: 'DE',
    diet: ['Alles'],
    goals: ['Saisonal kaufen', 'Weniger CO₂'],
    score: 500,
    level: 1,
    createdAt: new Date().toISOString(),
  };
  USERS.set(token, user);
  USER_LISTS.set(id, []);
  res.status(201).json({ token, user: safeUser(user) });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const hash = crypto.createHash('sha256').update(password || '').digest('hex');
  const [token, user] = [...USERS.entries()].find(([,u]) => u.email === email && u.passwordHash === hash) || [];
  if (!user) return res.status(401).json({ error: 'Falsche E-Mail oder Passwort' });
  res.json({ token, user: safeUser(user) });
});

function safeUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

// Get own profile
app.get('/api/auth/me', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json(safeUser(user));
});

// Update profile (region, diet, goals)
app.patch('/api/auth/me', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { region, diet, goals, name } = req.body;
  if (region) user.region = region;
  if (diet)   user.diet   = diet;
  if (goals)  user.goals  = goals;
  if (name)   user.name   = name;
  res.json(safeUser(user));
});

/* ══════════════════════════════════════════
   FOODS ROUTES
   ══════════════════════════════════════════ */

// All foods (with season info for current month + region)
app.get('/api/foods', (req, res) => {
  const region = req.query.region || 'DE';
  const month  = parseInt(req.query.month) || nowMonth();
  const q      = (req.query.q || '').toLowerCase();

  let list = FOODS;
  if (q) list = list.filter(f => f.name.toLowerCase().includes(q));

  const result = list.map(f => ({
    ...f,
    inSeason: SEASONS[f.id]?.[region]?.includes(month) ?? false,
    seasonMonths: SEASONS[f.id]?.[region] || [],
  }));
  res.json(result);
});

// Single food
app.get('/api/foods/:id', (req, res) => {
  const f = FOODS.find(x => x.id === parseInt(req.params.id));
  if (!f) return res.status(404).json({ error: 'Lebensmittel nicht gefunden' });
  const region = req.query.region || 'DE';
  res.json({
    ...f,
    inSeason: isInSeason(f.id, region),
    seasonByRegion: SEASONS[f.id] || {},
  });
});

// Season calendar: all foods in season for a region/month
app.get('/api/season', (req, res) => {
  const region = req.query.region || 'DE';
  const month  = parseInt(req.query.month) || nowMonth();

  const inSeason  = FOODS.filter(f => SEASONS[f.id]?.[region]?.includes(month));
  const outSeason = FOODS.filter(f => !SEASONS[f.id]?.[region]?.includes(month));

  res.json({
    region, month,
    inSeason: inSeason.map(f => ({ ...f, seasonMonths: SEASONS[f.id]?.[region] || [] })),
    outSeason: outSeason.map(f => ({ ...f, nextMonth: nextSeasonMonth(f.id, region, month) })),
  });
});

function nextSeasonMonth(foodId, region, currentMonth) {
  const ms = SEASONS[foodId]?.[region] || [];
  if (!ms.length) return null;
  const future = ms.filter(m => m > currentMonth);
  return future.length ? future[0] : ms[0];
}

/* ══════════════════════════════════════════
   SHOPPING LIST ROUTES
   ══════════════════════════════════════════ */

// Get list
app.get('/api/list', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const list = USER_LISTS.get(user.id) || [];
  // Enrich with season info
  const enriched = list.map(item => {
    const food = FOODS.find(f => f.id === item.foodId);
    return {
      ...item,
      co2_kg: food?.co2_kg || item.co2_kg,
      water_l: food?.water_l || item.water_l,
      inSeason: food ? isInSeason(food.id, user.region) : null,
      isImported: food?.category === 'Importiert',
    };
  });
  const totalCo2   = enriched.reduce((s,i) => s + (i.co2_kg || 0), 0);
  const totalWater = enriched.reduce((s,i) => s + (i.water_l || 0), 0);
  res.json({ items: enriched, totalCo2: +totalCo2.toFixed(2), totalWater: +totalWater.toFixed(0) });
});

// Add item
app.post('/api/list', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { name, foodId, quantity, unit } = req.body;
  if (!name) return res.status(400).json({ error: 'name erforderlich' });

  const list = USER_LISTS.get(user.id) || [];
  const food = foodId ? FOODS.find(f => f.id === foodId) : FOODS.find(f => f.name.toLowerCase() === name.toLowerCase());

  const item = {
    id:       crypto.randomUUID(),
    foodId:   food?.id || null,
    name:     food?.name || name,
    emoji:    food?.emoji || '🛒',
    quantity: quantity || 1,
    unit:     unit || 'Stück',
    done:     false,
    addedAt:  new Date().toISOString(),
    co2_kg:   food?.co2_kg || null,
    water_l:  food?.water_l || null,
  };
  list.push(item);
  USER_LISTS.set(user.id, list);

  // Warning if not in season
  const warn = food && !isInSeason(food.id, user.region) ? {
    type: food.category === 'Importiert' ? 'imported' : 'out_of_season',
    message: food.category === 'Importiert'
      ? `${food.name} wird importiert — hoher CO₂-Fußabdruck`
      : `${food.name} hat gerade keine Saison in ${user.region}`,
  } : null;

  res.status(201).json({ item, warn });
});

// Toggle done
app.patch('/api/list/:itemId', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const list = USER_LISTS.get(user.id) || [];
  const item = list.find(i => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Artikel nicht gefunden' });
  if (req.body.done !== undefined) item.done = req.body.done;
  if (req.body.quantity !== undefined) item.quantity = req.body.quantity;
  res.json(item);
});

// Delete item
app.delete('/api/list/:itemId', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  let list = USER_LISTS.get(user.id) || [];
  const before = list.length;
  list = list.filter(i => i.id !== req.params.itemId);
  USER_LISTS.set(user.id, list);
  if (list.length === before) return res.status(404).json({ error: 'Artikel nicht gefunden' });
  res.json({ success: true });
});

// Clear done items
app.delete('/api/list/done/all', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const list = (USER_LISTS.get(user.id) || []).filter(i => !i.done);
  USER_LISTS.set(user.id, list);
  res.json({ success: true, remaining: list.length });
});

/* ══════════════════════════════════════════
   SCAN / BARCODE ROUTE (simulated)
   ══════════════════════════════════════════ */

const BARCODE_DB = {
  '4006040139303': { foodId:30, name:'Hafermilch Bio',     brand:'Oatly',      packSize:'1L'  },
  '4000417025005': { foodId:32, name:'Rinderhack 500g',    brand:'Rewe',       packSize:'500g'},
  '4013200893003': { foodId:1,  name:'Tomaten, regional',  brand:'Marktkauf',  packSize:'500g'},
  '4260477500012': { foodId:26, name:'Avocado (Import)',   brand:'Bio Planet', packSize:'1 Stk'},
};

app.get('/api/scan/:barcode', (req, res) => {
  const entry = BARCODE_DB[req.params.barcode];
  if (!entry) return res.status(404).json({ error: 'Produkt nicht gefunden' });
  const food = FOODS.find(f => f.id === entry.foodId);
  if (!food) return res.status(404).json({ error: 'Lebensmittel nicht gefunden' });
  const region = req.query.region || 'DE';
  const inSeason = isInSeason(food.id, region);
  const score = calcScore(food, inSeason);
  res.json({
    barcode: req.params.barcode,
    product: { ...entry, food, inSeason, score },
    impact: {
      co2_kg: food.co2_kg,
      water_l: food.water_l,
      isImported: food.category === 'Importiert',
      seasonWarning: !inSeason && food.category !== 'Importiert',
    },
  });
});

function calcScore(food, inSeason) {
  let s = 100;
  s -= food.co2_kg * 3;
  s -= food.water_l * 0.02;
  if (!inSeason) s -= 15;
  if (food.category === 'Importiert') s -= 20;
  if (s >= 85) return 'A+';
  if (s >= 70) return 'A';
  if (s >= 55) return 'B';
  if (s >= 40) return 'C';
  return 'D';
}

/* ══════════════════════════════════════════
   SCORE / STATS
   ══════════════════════════════════════════ */

app.get('/api/stats', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const list = USER_LISTS.get(user.id) || [];
  const done = list.filter(i => i.done);
  const totalCo2   = done.reduce((s,i) => s + (i.co2_kg||0), 0);
  const totalWater = done.reduce((s,i) => s + (i.water_l||0), 0);
  res.json({
    score:      user.score,
    totalCo2:   +totalCo2.toFixed(2),
    totalWater: +totalWater.toFixed(0),
    itemsBought: done.length,
  });
});

/* ══════════════════════════════════════════
   RECIPE IMPORT — Rezept-Import via JSON-LD
   ══════════════════════════════════════════ */

const https_mod = require('https');
const http_mod  = require('http');
const { URL: NodeURL } = require('url');

function fetchHtml(urlStr, hops) {
  hops = hops || 0;
  if (hops > 5) return Promise.reject(new Error('Zu viele Weiterleitungen'));
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new NodeURL(urlStr); } catch(_) { return reject(new Error('Ungültige URL')); }
    const lib = parsed.protocol === 'https:' ? https_mod : http_mod;
    const req = lib.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      }
    }, (res) => {
      const loc = res.headers.location;
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && loc) {
        res.destroy();
        const next = /^https?:\/\//i.test(loc) ? loc : `${parsed.protocol}//${parsed.host}${loc}`;
        return fetchHtml(next, hops + 1).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout beim Laden')); });
  });
}

function findRecipeNode(node) {
  if (!node) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipeNode(n); if (r) return r; } return null; }
  const t = node['@type'];
  if (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))) return node;
  if (node['@graph']) return findRecipeNode(node['@graph']);
  return null;
}

function extractRecipe(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { const r = findRecipeNode(JSON.parse(m[1])); if (r?.recipeIngredient) return r; } catch(_) {}
  }
  return null;
}

const FRAC = {'½':'0.5','⅓':'0.3333','⅔':'0.6667','¼':'0.25','¾':'0.75','⅛':'0.125','⅜':'0.375','⅝':'0.625','⅞':'0.875'};

const UNIT_PAT = [
  'kg','g','mg',
  'l','ml','cl','dl',
  'EL','TL',
  'Tassen?','Becher',
  'Pck\\.?','Packungen?',
  'Bund(?:el)?',
  'Zehen?',
  'Scheiben?',
  'Dosen?',
  'Gläser?|Glas',
  'Prisen?',
  'Msp\\.?','Messerspitzen?',
  'Tropfen',
  'Zweige?',
  'Blätter|Blatt',
  'Handvoll',
  'Stück|Stk\\.?',
  'Knollen?',
  'Köpfe?|Kopf',
].join('|');

function normalizeUnit(u) {
  const k = u.toLowerCase().replace(/\.$/,'');
  return ({
    tasse:'Tasse',tassen:'Tasse',becher:'Becher',
    stk:'Stück',stück:'Stück',
    pck:'Pck.',packung:'Packung',packungen:'Packung',
    bundel:'Bund',bünde:'Bund',
    zehe:'Zehe',zehen:'Zehe',
    scheibe:'Scheibe',scheiben:'Scheibe',
    dose:'Dose',dosen:'Dose',
    glas:'Glas',gläser:'Glas',
    prise:'Prise',prisen:'Prise',
    messerspitze:'Msp.',messerspitzen:'Msp.',msp:'Msp.',
    zweig:'Zweig',zweige:'Zweig',
    blatt:'Blatt',blätter:'Blatt',
    knolle:'Knolle',knollen:'Knolle',
    kopf:'Kopf',köpfe:'Kopf',
  })[k] || u;
}

function cleanName(s) {
  return s
    .replace(/^(?:etwas|einige?|ein paar|nach Geschmack|n\.G\.?|frisch(?:e[rns]?)?|zum Abschmecken|ggf\.?)\s+/i, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/,\s*\S+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseIngredient(raw) {
  if (!raw) return { raw, amount:null, unit:null, name:'' };
  let s = raw.replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, c => FRAC[c]+' ')
             .replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#?\w+;/g,' ')
             .replace(/\s+/g,' ').trim();
  const re = new RegExp(
    `^(\\d+[\\.,]\\d+|\\d+\\/\\d+|\\d+)\\s*(?:(${UNIT_PAT})\\.?\\s+)?(.+)$`, 'i'
  );
  const m = s.match(re);
  if (m) {
    const a = m[1].replace(',','.');
    const amount = a.includes('/') ? (() => { const [p,q] = a.split('/'); return parseFloat(p)/parseFloat(q); })() : parseFloat(a);
    return { raw, amount, unit: m[2] ? normalizeUnit(m[2]) : 'Stück', name: cleanName(m[3]) };
  }
  return { raw, amount: null, unit: null, name: cleanName(s) };
}

app.get('/api/recipe', async (req, res) => {
  const url = req.query.url || '';
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Gültige http(s)-URL erforderlich' });
  try {
    const html = await fetchHtml(url);
    const recipe = extractRecipe(html);
    if (!recipe) {
      return res.status(422).json({ error: 'Kein Rezept auf dieser Seite gefunden. Unterstützte Seiten: Chefkoch, Lecker, REWE Rezepte, AllRecipes u. v. m.' });
    }
    const servings = typeof recipe.recipeYield === 'string' ? recipe.recipeYield
      : Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : null;
    res.json({
      title: recipe.name || 'Rezept',
      servings,
      ingredients: (recipe.recipeIngredient || []).map(parseIngredient),
    });
  } catch(e) {
    res.status(500).json({ error: 'Fehler beim Laden: ' + e.message });
  }
});

/* ══════════════════════════════════════════
   START
   ══════════════════════════════════════════ */
const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`\n🌿 Saisonovo API läuft auf http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log('  POST   /api/auth/register     – Registrieren');
  console.log('  POST   /api/auth/login        – Einloggen');
  console.log('  GET    /api/auth/me           – Eigenes Profil');
  console.log('  PATCH  /api/auth/me           – Profil aktualisieren');
  console.log('  GET    /api/foods             – Alle Lebensmittel (?region=DE&q=tom)');
  console.log('  GET    /api/foods/:id         – Einzelnes Lebensmittel');
  console.log('  GET    /api/season            – Saisonkalender (?region=DE&month=6)');
  console.log('  GET    /api/list              – Einkaufsliste abrufen');
  console.log('  POST   /api/list              – Artikel hinzufügen');
  console.log('  PATCH  /api/list/:id          – Artikel abhaken/ändern');
  console.log('  DELETE /api/list/:id          – Artikel löschen');
  console.log('  DELETE /api/list/done/all     – Erledigte löschen');
  console.log('  GET    /api/recipe?url=...    – Rezept importieren (JSON-LD)');
  console.log('  GET    /api/scan/:barcode     – Barcode scannen');
  console.log('  GET    /api/stats             – Nutzer-Statistik\n');
});
